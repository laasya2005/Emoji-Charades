"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";

export default function Home() {
  const router = useRouter();
  const { globalOnline } = useSocket();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "join">("create");

  const handleCreate = () => {
    if (!name.trim()) return setError("Please enter your name");
    router.push(`/room/NEW?name=${encodeURIComponent(name.trim())}&action=create`);
  };

  const handleJoin = () => {
    if (!name.trim()) return setError("Please enter your name");
    if (!joinCode.trim()) return setError("Please enter the room code");
    router.push(
      `/room/${joinCode.trim().toUpperCase()}?name=${encodeURIComponent(name.trim())}&action=join`
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-4xl font-bold text-center mb-1">🎬 Emoji Charades</h1>
        <p className="text-slate-400 text-center mb-2 text-sm">Act it out with emojis!</p>
        {globalOnline > 0 && (
          <p className="text-center mb-4 text-xs text-emerald-400">
            <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full mr-1 animate-pulse" />
            {globalOnline} online
          </p>
        )}

        {error && (
          <div
            className="bg-red-500/20 border border-red-500 text-red-300 rounded-lg p-3 mb-4 text-sm flex justify-between items-center"
            role="alert"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="font-bold ml-2">
              ×
            </button>
          </div>
        )}

        {/* Name input — always visible */}
        <label htmlFor="name" className="block text-sm text-slate-400 mb-1">
          Your name
        </label>
        <input
          id="name"
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          className="w-full px-4 py-3 bg-slate-700 rounded-lg text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 mb-5"
        />

        {/* Tab toggle */}
        <div className="flex rounded-lg bg-slate-700 p-1 mb-5">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              tab === "create" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            New Game
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              tab === "join" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Join Game
          </button>
        </div>

        {tab === "create" ? (
          <button
            onClick={handleCreate}
            className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition text-lg"
          >
            Create Room
          </button>
        ) : (
          <div className="space-y-3">
            <label htmlFor="code" className="block text-sm text-slate-400">
              Room code
            </label>
            <input
              id="code"
              type="text"
              placeholder="e.g. AB3K7"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-3 bg-slate-700 rounded-lg text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 text-center text-2xl tracking-widest font-mono"
            />
            <button
              onClick={handleJoin}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition text-lg"
            >
              Join Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
