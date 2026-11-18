import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  Crown,
  FastForward,
  Home,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  UserMinus,
  X,
} from 'lucide-react';
import type { RoomPublicState } from '../../shared/types.js';
import { useI18n } from '../i18n/useI18n.js';

export const HostControlDrawer: React.FC<{
  room: RoomPublicState;
  myPlayerId: string | null;
  onEmit: (event: string, payload?: unknown) => void;
}> = ({ room, myPlayerId, onEmit }) => {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#F3E09F] shadow hover:bg-[#D4AF37]/25"
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('hostControls')}</span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="flex h-full w-full max-w-sm flex-col border-l border-[#D4AF37]/30 bg-[#101420] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-[#F3E09F]">
                <Crown className="h-5 w-5 text-[#D4AF37]" />
                {t('hostControls')}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
              {room.status !== 'lobby' && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    {lang === 'zh' ? '对局流程调度' : 'Match Flow'}
                  </div>

                  {room.status === 'playing' ? (
                    <button
                      type="button"
                      onClick={() => onEmit('room:pause')}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
                    >
                      <Pause className="h-4 w-4" />
                      {t('pauseGame')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEmit('room:resume')}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25"
                    >
                      <Play className="h-4 w-4" />
                      {t('resumeGame')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onEmit('room:forceSkip');
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-200 hover:bg-sky-500/25"
                  >
                    <FastForward className="h-4 w-4" />
                    {t('forceSkip')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEmit('room:startGame');
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('restartGame')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEmit('room:returnToLobby');
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/25"
                  >
                    <Home className="h-4 w-4" />
                    {t('returnLobby')}
                  </button>
                </div>
              )}

              {room.seats.some((s) => s.score > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    onEmit('room:resetScores');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20"
                >
                  <span>🏆</span>
                  {t('resetScores')}
                </button>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  {lang === 'zh' ? '座位与离线托管' : 'Seats & Takeover'}
                </div>
                {room.seats.map((seat) => (
                  <div
                    key={seat.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {seat.seatIndex + 1}. {seat.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {seat.isBot
                          ? 'AI Bot'
                          : seat.connected
                            ? lang === 'zh'
                              ? '在线'
                              : 'Online'
                            : lang === 'zh'
                              ? '已断线'
                              : 'Offline'}
                        {seat.botTakeover ? ' · AI接管中' : ''}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {!seat.isBot && seat.id !== myPlayerId && (
                        <>
                          <button
                            type="button"
                            title={seat.botTakeover ? t('cancelTakeover') : t('botTakeover')}
                            onClick={() =>
                              onEmit('room:toggleBotTakeover', { playerId: seat.id })
                            }
                            className={`rounded-lg p-1.5 text-xs ${
                              seat.botTakeover
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }`}
                          >
                            <Bot className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={t('transferHost')}
                            onClick={() =>
                              onEmit('room:transferHost', { playerId: seat.id })
                            }
                            className="rounded-lg bg-white/10 p-1.5 text-amber-300 hover:bg-white/20"
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {!seat.isHost && (
                        <button
                          type="button"
                          title={t('kickPlayer')}
                          onClick={() => {
                            if (seat.isBot && room.status === 'lobby') {
                              onEmit('room:removeBot', { playerId: seat.id });
                            } else {
                              onEmit('room:kickPlayer', { playerId: seat.id });
                            }
                          }}
                          className="rounded-lg bg-rose-500/20 p-1.5 text-rose-300 hover:bg-rose-500/40"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
};
