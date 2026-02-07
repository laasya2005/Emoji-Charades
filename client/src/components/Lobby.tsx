"use client";
import { RoomState } from "@/lib/types";

interface LobbyProps {
  state: RoomState;
  isHost: boolean;
  onStart: () => void;
  onUpdateSettings: (s: { roundsPerPlayer?: number; turnDuration?: number }) => void;
}

export default function Lobby({ state, isHost, onStart, onUpdateSettings }: LobbyProps) {
  const copyCode = () => {
    navigator.clipboard.writeText(state.code);
  };

  return (
    <div className="max-w-lg mx-auto mt-6 space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Room Lobby</h2>
        <div className="inline-flex items-center gap-2 bg-slate-700 rounded-lg px-4 py-2">
          <span className="text-3xl font-mono tracking-widest text-indigo-400">{state.code}</span>
          <button
            onClick={copyCode}
            className="text-sm bg-slate-600 hover:bg-slate-500 px-2 py-1 rounded transition"
          >
            Copy
          </button>
        </div>
        <p className="text-slate-400 text-sm mt-2">Share this code with friends</p>
      </div>

      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Players ({state.players.length})</h3>
        <div className="space-y-2">
          {state.players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2">
              <span className="text-lg">👤</span>
              <span className="font-medium">{p.name}</span>
              {p.id === state.hostId && (
                <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded-full ml-auto">
                  Host
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold">Settings</h3>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Rounds per player</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => onUpdateSettings({ roundsPerPlayer: n })}
                  className={`w-10 h-10 rounded-lg font-bold transition ${
                    state.settings.roundsPerPlayer === n
                      ? "bg-indigo-600"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Turn duration</span>
            <div className="flex gap-2">
              {[60, 90, 120].map((n) => (
                <button
                  key={n}
                  onClick={() => onUpdateSettings({ turnDuration: n })}
                  className={`px-3 h-10 rounded-lg font-bold transition ${
                    state.settings.turnDuration === n
                      ? "bg-indigo-600"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  {n}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isHost && (
        <button
          onClick={onStart}
          disabled={state.players.length < 2}
          className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-bold text-lg transition"
        >
          {state.players.length < 2 ? "Need at least 2 players" : "Start Game"}
        </button>
      )}

      {!isHost && (
        <p className="text-center text-slate-400">Waiting for host to start the game...</p>
      )}
    </div>
  );
}
