"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Theme, EmojiStyle } from "emoji-picker-react";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const MAX_EMOJIS = 12;

interface EmojiPickerProps {
  emojis: string[];
  onUpdate: (emojis: string[]) => void;
}

export default function EmojiPickerPanel({ emojis, onUpdate }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(true);

  const addEmoji = (emojiData: { emoji: string }) => {
    if (emojis.length >= MAX_EMOJIS) return;
    onUpdate([...emojis, emojiData.emoji]);
  };

  const removeEmoji = (index: number) => {
    onUpdate(emojis.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Emoji board */}
      <div className="p-2 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Your clues ({emojis.length}/{MAX_EMOJIS})
          </span>
          {emojis.length > 0 && (
            <button
              onClick={() => onUpdate([])}
              aria-label="Clear all emojis"
              className="text-xs text-red-400 hover:text-red-300 transition"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="min-h-[48px] flex items-center">
          {emojis.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {emojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  onClick={() => removeEmoji(i)}
                  aria-label={`Remove ${emoji}`}
                  className="text-2xl bg-slate-700 hover:bg-red-500/30 rounded-lg w-10 h-10 flex items-center justify-center transition relative group"
                >
                  {emoji}
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    x
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Tap an emoji below to add clues</p>
          )}
        </div>
      </div>

      {/* Picker toggle */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="w-full px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition flex items-center justify-center gap-1"
      >
        {showPicker ? "Hide picker" : "Show picker"}
      </button>

      {/* Picker */}
      {showPicker && (
        <div className="flex-1 min-h-[350px]">
          <Picker
            onEmojiClick={addEmoji}
            width="100%"
            height="100%"
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            searchDisabled={false}
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}
