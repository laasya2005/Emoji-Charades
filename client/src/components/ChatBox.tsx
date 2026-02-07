"use client";
import { useState, useRef, useEffect } from "react";
import { GuessMessage } from "@/lib/types";

interface ChatBoxProps {
  guesses: GuessMessage[];
  onGuess: (text: string) => void;
  disabled: boolean;
  hasGuessedCorrectly: boolean;
}

export default function ChatBox({ guesses, onGuess, disabled, hasGuessedCorrectly }: ChatBoxProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [guesses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || hasGuessedCorrectly) return;
    onGuess(input.trim());
    setInput("");
  };

  return (
    <div className="bg-slate-800 rounded-lg flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-700">
        <h3 className="font-semibold text-sm">Chat & Guesses</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {guesses.length === 0 && (
          <p className="text-slate-500 text-sm text-center mt-4">
            Type your guesses below!
          </p>
        )}
        {guesses.map((msg, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg px-2.5 py-1.5 ${
              msg.system
                ? "bg-green-900/30 text-green-400 font-semibold"
                : "bg-slate-700"
            }`}
          >
            {msg.system ? (
              msg.text
            ) : (
              <>
                <span className="font-semibold text-indigo-400">{msg.playerName}: </span>
                {msg.text}
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              hasGuessedCorrectly
                ? "You already guessed correctly!"
                : disabled
                  ? "Waiting..."
                  : "Type your guess..."
            }
            disabled={disabled || hasGuessedCorrectly}
            maxLength={200}
            className="flex-1 px-3 py-2 bg-slate-700 rounded-lg text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm"
          />
          <button
            type="submit"
            disabled={disabled || hasGuessedCorrectly || !input.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition disabled:opacity-50 text-sm"
          >
            Guess
          </button>
        </div>
      </form>
    </div>
  );
}
