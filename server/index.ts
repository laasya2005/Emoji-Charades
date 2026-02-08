import express from "express";
import http from "http";
import { Server } from "socket.io";
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
  const dataPath = path.join(__dirname, "..", "categories.json");
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

function broadcastRoomState(room: GameRoom): void {
  for (const player of room.players) {
    io.to(player.id).emit("room-state", room.getState(player.id));
  }
}

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("create-room", (data: { playerName: string }, callback) => {
    if (typeof callback !== "function") return;

    const name = validatePlayerName(data?.playerName);
    if (!name) {
      return callback({ success: false, error: "Invalid player name" });
    }

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

    callback({ success: true, code });
    broadcastRoomState(room);
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

    callback({ success: true, code });
    broadcastRoomState(room);
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
    console.log(`[disconnect] ${socket.id}`);
    const code = playerRooms.get(socket.id);
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
