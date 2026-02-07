"use client";
import { TurnResult } from "@/lib/types";

const PLACE_ICONS = ["🥇", "🥈", "🥉"];

interface TurnEndModalProps {
  result: TurnResult;
}

export default function TurnEndModal({ result }: TurnEndModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-label="Turn results">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-2">Turn Over!</h2>
        <div className="text-center mb-6">
          <p className="text-slate-400 mb-1">{result.actorName} was acting out:</p>
          <p className="text-3xl font-bold text-indigo-400">{result.word}</p>
        </div>

        {result.winners.length > 0 ? (
          <div className="space-y-2 mb-4">
            <h3 className="font-semibold text-green-400">Correct Guessers:</h3>
            {result.winners.map((w, i) => (
              <div key={w.name} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-2">
                <span>{PLACE_ICONS[i] || `#${i + 1}`} {w.name}</span>
                <span className="text-green-400 font-bold">+{w.points}</span>
              </div>
            ))}
            {result.actorPoints > 0 && (
              <div className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-2">
                <span>🎭 {result.actorName} (actor bonus)</span>
                <span className="text-green-400 font-bold">+{result.actorPoints}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-slate-400 mb-4">Nobody guessed correctly!</p>
        )}

        <p className="text-center text-sm text-slate-500">Next turn starting soon...</p>
      </div>
    </div>
  );
}
