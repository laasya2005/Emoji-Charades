"use client";
import { Player } from "@/lib/types";

const PLACE_ICONS = ["🏆", "🥈", "🥉"];

interface GameEndModalProps {
  standings: Player[];
  isHost: boolean;
  onReturnToLobby: () => void;
}

export default function GameEndModal({ standings, isHost, onReturnToLobby }: GameEndModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label="Final results">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-3xl font-bold text-center mb-6">Game Over!</h2>

        <div className="space-y-3 mb-6">
          {standings.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                i === 0
                  ? "bg-yellow-900/40 border border-yellow-500"
                  : i === 1
                    ? "bg-slate-600"
                    : i === 2
                      ? "bg-amber-900/30"
                      : "bg-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PLACE_ICONS[i] || `#${i + 1}`}</span>
                <span className="font-semibold text-lg">{p.name}</span>
              </div>
              <span className="text-xl font-bold text-indigo-400">{p.score}</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={onReturnToLobby}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition"
          >
            Return to Lobby
          </button>
        ) : (
          <p className="text-center text-slate-400">Waiting for host to return to lobby...</p>
        )}
      </div>
    </div>
  );
}
