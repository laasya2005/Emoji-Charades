"use client";
import { RoomState } from "@/lib/types";

interface GameBoardProps {
  state: RoomState;
  isActor: boolean;
}

export default function GameBoard({ state, isActor }: GameBoardProps) {
  const actor = state.players.find((p) => p.id === state.currentActorId);
  const timerPct = (state.timeRemaining / state.settings.turnDuration) * 100;
  const timerColor =
    state.timeRemaining <= 10
      ? "bg-red-500"
      : state.timeRemaining <= 30
        ? "bg-yellow-500"
        : "bg-green-500";
  const timerText =
    state.timeRemaining <= 10
      ? "text-red-400"
      : state.timeRemaining <= 30
        ? "text-yellow-400"
        : "text-slate-300";

  return (
    <div className="space-y-2 shrink-0">
      {/* Header row */}
      <div className="bg-slate-800 rounded-lg p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 shrink-0">
            R{state.currentRound}/{state.totalRounds}
          </span>
          {isActor ? (
            <span className="text-indigo-400 font-semibold text-sm truncate">Your turn to act!</span>
          ) : (
            <span className="text-sm truncate">
              <span className="text-indigo-400 font-semibold">{actor?.name}</span>
              <span className="text-slate-400"> is acting</span>
            </span>
          )}
        </div>
        <span className={`text-xl font-mono font-bold ${timerText} shrink-0`} aria-label={`${state.timeRemaining} seconds remaining`}>
          {state.timeRemaining}s
        </span>
      </div>

      {/* Timer bar */}
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${timerColor} transition-all duration-1000 ease-linear rounded-full`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Emoji clue display — only shown for guessers */}
      {!isActor && (
        <div className="bg-slate-800 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
          {state.emojis.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center" role="img" aria-label="Emoji clues">
              {state.emojis.map((emoji, i) => (
                <span key={`${emoji}-${i}`} className="text-4xl">{emoji}</span>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Waiting for emojis...</p>
          )}
        </div>
      )}

      {/* Hint */}
      {state.hint && !isActor && (
        <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg px-2 py-2 text-center" role="status">
          <span className="text-yellow-400 text-sm font-mono tracking-widest">
            {state.hint.wordLengths.map((len) => "_ ".repeat(len).trim()).join("   ")}
          </span>
        </div>
      )}
    </div>
  );
}
