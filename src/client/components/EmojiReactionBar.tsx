import React from 'react';
import { REACTION_EMOJIS } from '../../shared/catalog.js';
import type { EmojiReaction } from '../../shared/types.js';
import { soundEngine } from '../audio/soundEngine.js';

export const EmojiReactionBar: React.FC<{
  onSend: (emoji: string) => void;
}> = ({ onSend }) => {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#141824]/85 px-3 py-1.5 shadow-xl backdrop-blur-md">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            soundEngine.playSfx('emojiPop');
            onSend(emoji);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export const FloatingReactionsOverlay: React.FC<{
  reactions: EmojiReaction[];
}> = ({ reactions }) => {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center overflow-hidden">
      <div className="flex flex-wrap justify-center gap-2 px-4">
        {reactions.slice(-6).map((r) => (
          <div
            key={r.id}
            className="animate-bounce rounded-full border border-[#D4AF37]/30 bg-black/75 px-3 py-1 text-sm shadow-lg backdrop-blur"
          >
            <span className="mr-1.5 text-base">{r.emoji}</span>
            <span className="text-xs font-medium text-[#F3E09F]">{r.playerName}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
