import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import path from "path";
import fs from "fs";
import { generateRoomCode, validatePlayerName, validateRoomCode } from "./utils";
import { GameRoom } from "./GameRoom";

const MAX_GUESS_LENGTH = 200;
const MAX_ROOMS = 500;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 10;

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(socketId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

const app = express();
app.use(cors());

const server = http.createServer(app);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET", "POST"] },
});

let movies: string[];
try {
  // Works for both ts-node (server/) and compiled (server/dist/)
  const candidates = [
    path.join(__dirname, "categories.json"),
    path.join(__dirname, "..", "categories.json"),
  ];
  const dataPath = candidates.find((p) => fs.existsSync(p));
  if (!dataPath) throw new Error("categories.json not found");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  movies = data.Movies;
  if (!Array.isArray(movies) || movies.length === 0) {
    throw new Error("No movies found in categories.json");
  }
} catch (err) {
  console.error("Failed to load movie data:", err);
  process.exit(1);
}

const rooms = new Map<string, GameRoom>();
const playerRooms = new Map<string, string>();

// --- Online user tracking (single source of truth: playerRooms for room membership) ---
const onlineSockets = new Set<string>();
const roomCounts = new Map<string, number>();
const MAX_PLAYERS = 12;

function broadcastGlobalStats(): void {
  io.emit("stats:global", { online: onlineSockets.size });
}

function broadcastRoomStats(code: string): void {
  const count = roomCounts.get(code) || 0;
  io.to(code).emit("stats:room", { code, onlineInRoom: count, maxPlayers: MAX_PLAYERS });
}

function incrementRoomCount(code: string): void {
  roomCounts.set(code, (roomCounts.get(code) || 0) + 1);
}

function decrementRoomCount(code: string): void {
  const current = roomCounts.get(code) || 0;
  if (current <= 1) {
    roomCounts.delete(code);
  } else {
    roomCounts.set(code, current - 1);
  }
}

function leaveCurrentRoom(socket: Socket): void {
  const code = playerRooms.get(socket.id);
  if (!code) return;

  playerRooms.delete(socket.id);
  socket.leave(code);
  decrementRoomCount(code);

  const room = rooms.get(code);
  if (room) {
    room.removePlayer(socket.id);

    const hasConnected = room.players.some((p) => p.connected);
    if (room.players.length === 0 || !hasConnected) {
      room.destroy();
      rooms.delete(code);
      roomCounts.delete(code);
    }
  }

  broadcastRoomStats(code);
}

function broadcastRoomState(room: GameRoom): void {
  for (const player of room.players) {
    io.to(player.id).emit("room-state", room.getState(player.id));
  }
}

io.on("connection", (socket) => {
  onlineSockets.add(socket.id);
  console.log(`[connect] ${socket.id} (online: ${onlineSockets.size})`);
  broadcastGlobalStats();

  // Allow clients to request current stats (e.g. after reconnect)
  socket.on("request-stats", () => {
    if (!checkRateLimit(socket.id)) return;
    socket.emit("stats:global", { online: onlineSockets.size });
    const code = playerRooms.get(socket.id);
    if (code) {
      socket.emit("stats:room", { code, onlineInRoom: roomCounts.get(code) || 0, maxPlayers: MAX_PLAYERS });
    }
  });

  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
    broadcastGlobalStats();
  });

  socket.on("kick-player", (data: { targetId: string }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (!data?.targetId || data.targetId === socket.id) return;

    const target = room.players.find((p) => p.id === data.targetId);
    if (!target) return;

    room.removePlayer(data.targetId);
    playerRooms.delete(data.targetId);
    decrementRoomCount(code);

    const targetSocket = io.sockets.sockets.get(data.targetId);
    if (targetSocket) {
      targetSocket.leave(code);
      targetSocket.emit("kicked", { message: "You were removed from the room by the host" });
    }

    const hasConnected = room.players.some((p) => p.connected);
    if (room.players.length === 0 || !hasConnected) {
      room.destroy();
      rooms.delete(code);
      roomCounts.delete(code);
    }

    broadcastRoomStats(code);
    broadcastGlobalStats();
  });

  socket.on("create-room", (data: { playerName: string }, callback) => {
    if (typeof callback !== "function") return;

    const name = validatePlayerName(data?.playerName);
    if (!name) {
      return callback({ success: false, error: "Invalid player name" });
    }

    leaveCurrentRoom(socket);

    if (rooms.size >= MAX_ROOMS) {
      return callback({ success: false, error: "Server is full, try again later" });
    }

    let code: string;
    do {
      code = generateRoomCode();
    } while (rooms.has(code));

    const room = new GameRoom(code, movies, () => broadcastRoomState(room));

    room.addPlayer(socket.id, name);
    rooms.set(code, room);
    playerRooms.set(socket.id, code);
    socket.join(code);
    incrementRoomCount(code);

    callback({ success: true, code });
    broadcastRoomState(room);
    // Send stats directly to joining socket AND broadcast to room
    const roomCount = roomCounts.get(code) || 0;
    socket.emit("stats:room", { code, onlineInRoom: roomCount, maxPlayers: MAX_PLAYERS });
    broadcastRoomStats(code);
    broadcastGlobalStats();
    console.log(`[room:join] ${socket.id} created & joined ${code} (room: ${roomCount}, online: ${onlineSockets.size})`);
  });

  socket.on("join-room", (data: { code: string; playerName: string }, callback) => {
    if (typeof callback !== "function") return;

    const name = validatePlayerName(data?.playerName);
    if (!name) {
      return callback({ success: false, error: "Invalid player name" });
    }

    const code = validateRoomCode(data?.code);
    if (!code) {
      return callback({ success: false, error: "Invalid room code" });
    }

    leaveCurrentRoom(socket);

    const room = rooms.get(code);
    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    if (room.phase !== "LOBBY") {
      return callback({ success: false, error: "Game already in progress" });
    }

    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return callback({ success: false, error: "Name already taken" });
    }

    if (!room.addPlayer(socket.id, name)) {
      return callback({ success: false, error: "Room is full" });
    }
    playerRooms.set(socket.id, code);
    socket.join(code);
    incrementRoomCount(code);

    callback({ success: true, code });
    broadcastRoomState(room);
    // Send stats directly to joining socket AND broadcast to room
    const roomCount = roomCounts.get(code) || 0;
    socket.emit("stats:room", { code, onlineInRoom: roomCount, maxPlayers: MAX_PLAYERS });
    broadcastRoomStats(code);
    broadcastGlobalStats();
    console.log(`[room:join] ${socket.id} joined ${code} (room: ${roomCount}, online: ${onlineSockets.size})`);
  });

  socket.on("update-settings", (data: { roundsPerPlayer?: number; turnDuration?: number }) => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== "LOBBY") return;

    if (data?.roundsPerPlayer && [1, 2, 3].includes(data.roundsPerPlayer)) {
      room.settings.roundsPerPlayer = data.roundsPerPlayer;
    }
    if (data?.turnDuration && [60, 90, 120].includes(data.turnDuration)) {
      room.settings.turnDuration = data.turnDuration;
    }
    broadcastRoomState(room);
  });

  socket.on("start-game", () => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.hostId !== socket.id) return;

    if (!room.startGame()) {
      socket.emit("error-msg", { message: "Need at least 2 players to start" });
    }
  });

  socket.on("emoji-update", (data: { emojis: string[] }) => {
    if (!checkRateLimit(socket.id)) return;
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (!data || !Array.isArray(data.emojis)) return;
    room.updateEmojis(socket.id, data.emojis);
  });

  socket.on("guess", (data: { text: string }) => {
    if (!checkRateLimit(socket.id)) return;
    const room = getRoomForSocket(socket.id);
    if (!room) return;

    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text || text.length > MAX_GUESS_LENGTH) return;

    room.submitGuess(socket.id, text);
  });

  socket.on("return-to-lobby", () => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.returnToLobby();
  });

  socket.on("disconnect", () => {
    onlineSockets.delete(socket.id);
    const code = playerRooms.get(socket.id);
    console.log(`[disconnect] ${socket.id} (online: ${onlineSockets.size}, room: ${code || "none"})`);

    if (code) {
      decrementRoomCount(code);
      broadcastRoomStats(code);
    }
    broadcastGlobalStats();

    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.disconnectPlayer(socket.id);
    playerRooms.delete(socket.id);
    rateLimits.delete(socket.id);

    const hasConnected = room.players.some((p) => p.connected);
    if (room.players.length === 0 || !hasConnected) {
      room.destroy();
      rooms.delete(code);
      roomCounts.delete(code);
      console.log(`[room-deleted] ${code} (no connected players)`);
    }
  });
});

function getRoomForSocket(socketId: string): GameRoom | null {
  const code = playerRooms.get(socketId);
  if (!code) return null;
  return rooms.get(code) || null;
}

const PORT = parseInt(process.env.PORT || "3001", 10);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
