"use client";
import { Player } from "@/lib/types";

interface ScoreboardProps {
  players: Player[];
  currentActorId?: string;
}

export default function Scoreboard({ players, currentActorId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-800 rounded-lg p-2">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 px-1">
        Scoreboard
      </h3>
      <div className="space-y-1">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-2 py-1 rounded text-sm ${
              p.id === currentActorId
                ? "bg-indigo-900/40 border border-indigo-500/50"
                : "bg-slate-700/50"
            } ${!p.connected ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-500 text-xs w-3 shrink-0">{i + 1}</span>
              <span className="font-medium truncate text-sm">{p.name}</span>
              {p.id === currentActorId && (
                <span className="text-[10px] text-indigo-400 shrink-0">🎭</span>
              )}
            </div>
            <span className="font-bold text-indigo-400 shrink-0 ml-1 text-sm">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
