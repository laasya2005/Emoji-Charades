"use client";
import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { RoomState } from "@/lib/types";

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const CONNECT_TIMEOUT_MS = 5000;
const CALLBACK_TIMEOUT_MS = 10000;

let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
    });
  }
  return globalSocket;
}

type RoomCallback = { success: boolean; code?: string; error?: string };

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function useSocket() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [globalOnline, setGlobalOnline] = useState(0);
  const [roomOnline, setRoomOnline] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(12);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      // Request current stats on (re)connect so we never stay stale at 0
      socket.emit("request-stats");
    };
    const onDisconnect = () => {
      setConnected(false);
      setRoomOnline(0);
    };
    const onRoomState = (state: RoomState) => setRoomState(state);
    const onError = (data: { message: string }) => setError(data.message);
    const onGlobalStats = (data: { online: number }) => setGlobalOnline(data.online);
    const onRoomStats = (data: { code: string; onlineInRoom: number; maxPlayers?: number }) => {
      setRoomOnline(data.onlineInRoom);
      if (data.maxPlayers != null) setMaxPlayers(data.maxPlayers);
    };
    const onKicked = (data: { message: string }) => {
      setRoomState(null);
      setError(data.message);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-state", onRoomState);
    socket.on("error-msg", onError);
    socket.on("stats:global", onGlobalStats);
    socket.on("stats:room", onRoomStats);
    socket.on("kicked", onKicked);

    if (socket.connected) {
      setConnected(true);
      socket.emit("request-stats");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-state", onRoomState);
      socket.off("error-msg", onError);
      socket.off("stats:global", onGlobalStats);
      socket.off("stats:room", onRoomStats);
      socket.off("kicked", onKicked);
    };
  }, []);

  const waitForConnect = useCallback((): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (socket.connected) return resolve(socket);
      const timer = setTimeout(() => {
        socket.off("connect", onConnect);
        reject(new Error("timeout"));
      }, CONNECT_TIMEOUT_MS);
      const onConnect = () => {
        clearTimeout(timer);
        resolve(socket);
      };
      socket.once("connect", onConnect);
    });
  }, []);

  const createRoom = useCallback(
    async (playerName: string): Promise<RoomCallback> => {
      try {
        const socket = await waitForConnect();
        return withTimeout(
          new Promise<RoomCallback>((resolve) => {
            socket.emit("create-room", { playerName }, resolve);
          }),
          CALLBACK_TIMEOUT_MS,
          { success: false, error: "Server did not respond" }
        );
      } catch {
        return { success: false, error: "Could not connect to server" };
      }
    },
    [waitForConnect]
  );

  const joinRoom = useCallback(
    async (code: string, playerName: string): Promise<RoomCallback> => {
      try {
        const socket = await waitForConnect();
        return withTimeout(
          new Promise<RoomCallback>((resolve) => {
            socket.emit("join-room", { code, playerName }, resolve);
          }),
          CALLBACK_TIMEOUT_MS,
          { success: false, error: "Server did not respond" }
        );
      } catch {
        return { success: false, error: "Could not connect to server" };
      }
    },
    [waitForConnect]
  );

  const emit = useCallback((event: string, data?: object) => {
    const socket = getSocket();
    if (socket.connected) socket.emit(event, data);
  }, []);

  return {
    roomState,
    error,
    setError,
    connected,
    globalOnline,
    roomOnline,
    maxPlayers,
    createRoom,
    joinRoom,
    startGame: useCallback(() => emit("start-game"), [emit]),
    updateSettings: useCallback(
      (s: { roundsPerPlayer?: number; turnDuration?: number }) => emit("update-settings", s),
      [emit]
    ),
    updateEmojis: useCallback((emojis: string[]) => emit("emoji-update", { emojis }), [emit]),
    submitGuess: useCallback((text: string) => emit("guess", { text }), [emit]),
    returnToLobby: useCallback(() => emit("return-to-lobby"), [emit]),
    kickPlayer: useCallback((targetId: string) => emit("kick-player", { targetId }), [emit]),
    getSocketId: useCallback(() => getSocket().id || "", []),
  };
}
