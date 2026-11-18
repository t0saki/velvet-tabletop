import React from 'react';
import { AVATARS } from '../../shared/catalog.js';
import type { PlayerSeat } from '../../shared/types.js';
import { Bot, Crown, WifiOff } from 'lucide-react';

export const AvatarBadge: React.FC<{
  seat: PlayerSeat;
  size?: 'sm' | 'md' | 'lg';
  isMe?: boolean;
  highlight?: boolean;
  dimmed?: boolean;
  subLabel?: string;
}> = ({ seat, size = 'md', isMe, highlight, dimmed, subLabel }) => {
  const avatar = AVATARS.find((a) => a.id === seat.avatarId) ?? AVATARS[0];
  const dims =
    size === 'sm'
      ? 'w-9 h-9 text-lg'
      : size === 'lg'
        ? 'w-16 h-16 text-3xl'
        : 'w-12 h-12 text-2xl';

  return (
    <div
      className={`relative inline-flex flex-col items-center gap-1 select-none transition-opacity ${
        dimmed ? 'opacity-45 grayscale' : 'opacity-100'
      }`}
    >
      <div
        className={`relative flex items-center justify-center rounded-full bg-gradient-to-br ${avatar.bg} ${dims} border-2 transition-all ${
          highlight
            ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/30 scale-105'
            : isMe
              ? 'border-emerald-400/80'
              : 'border-white/20'
        }`}
      >
        {avatar.image ? (
          <img
            src={avatar.image}
            alt={seat.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span>{avatar.emoji}</span>
        )}
        {seat.isHost && (
          <span
            title="Host"
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#D4AF37] text-[#0B0D13] shadow"
          >
            <Crown className="h-3 w-3" />
          </span>
        )}
        {seat.isBot && (
          <span
            title="AI"
            className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-500 text-white shadow"
          >
            <Bot className="h-3 w-3" />
          </span>
        )}
        {!seat.isBot && !seat.connected && (
          <span
            title="Disconnected"
            className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-white shadow"
          >
            <WifiOff className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="max-w-[84px] truncate text-center text-xs font-medium text-[#F5F2EB]">
        {seat.name}
      </div>
      {seat.score > 0 && (
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-1.5 py-0.5 text-[10px] font-black text-[#F3E09F]">
          <span>🏆</span>
          <span>{seat.score}</span>
        </div>
      )}
      {subLabel && (
        <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#F3E09F]">
          {subLabel}
        </div>
      )}
    </div>
  );
};
