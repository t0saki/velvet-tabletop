import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  Copy,
  Play,
  QrCode,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { GAME_CATALOG, getGameCatalogEntry } from '../../shared/catalog.js';
import type { GameId, LanNetworkInfo, RoomPublicState } from '../../shared/types.js';
import { useI18n } from '../i18n/useI18n.js';
import { AvatarBadge } from './AvatarBadge.js';
import { QuickRulesModal } from './QuickRulesModal.js';

export const LobbyScreen: React.FC<{
  room: RoomPublicState;
  myPlayerId: string | null;
  isHost: boolean;
  isTvMode: boolean;
  onEmit: (event: string, payload?: unknown, ack?: (res: unknown) => void) => void;
  onSelectGame: (gameId: GameId) => void;
  onUpdateOptions: (opts: Record<string, unknown>) => void;
}> = ({
  room,
  myPlayerId,
  isHost,
  isTvMode,
  onEmit,
  onSelectGame,
  onUpdateOptions,
}) => {
  const { lang, t, pick } = useI18n();
  const [netInfo, setNetInfo] = useState<LanNetworkInfo | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<string>(() => window.location.origin);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const selectedGame = getGameCatalogEntry(room.selectedGameId);
  const joinUrl = `${selectedOrigin}/?room=${room.roomCode}`;

  useEffect(() => {
    fetch('/api/network')
      .then((r) => r.json())
      .then((info: LanNetworkInfo) => {
        setNetInfo(info);
        // Prefer actual LAN IP over localhost so phones scanning QR work immediately!
        if (
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1'
        ) {
          if (info.primaryUrl) setSelectedOrigin(info.primaryUrl);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/qr?url=${encodeURIComponent(joinUrl)}`)
      .then((r) => r.json())
      .then((d: { dataUrl?: string }) => {
        if (d.dataUrl) setQrDataUrl(d.dataUrl);
      })
      .catch(() => {});
  }, [joinUrl]);

  const canStart =
    room.seats.length >= selectedGame.minPlayers &&
    room.seats.length <= selectedGame.maxPlayers;

  const handleCopy = () => {
    navigator.clipboard?.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleStart = () => {
    setStartError(null);
    onEmit('room:startGame', undefined, (res: unknown) => {
      const r = res as { ok: boolean; error?: string };
      if (!r?.ok && r?.error) setStartError(r.error);
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 pb-28 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: LAN QR & Room Invite Card */}
        <div className="gold-border rounded-3xl bg-[#121724]/90 p-5 backdrop-blur lg:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                {t('roomCode')}
              </div>
              <div className="font-mono text-4xl font-black tracking-[0.2em] text-[#F3E09F]">
                {room.roomCode}
              </div>
            </div>
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3 text-[#D4AF37]">
              <QrCode className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center rounded-2xl bg-[#FBF8F1] p-4 text-center shadow-inner">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Join QR" className="h-44 w-44 rounded-lg" />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center text-xs text-slate-500">
                QR...
              </div>
            )}
            <p className="mt-2 text-xs font-bold text-[#0B0D13]">{t('scanToJoin')}</p>
            <p className="mt-0.5 max-w-full truncate font-mono text-[11px] text-slate-600">
              {joinUrl}
            </p>
          </div>

          {netInfo && netInfo.addresses.length > 1 && (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                {t('selectLanIp')}
              </label>
              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0B0D13] px-3 py-2 text-xs text-slate-200"
              >
                {netInfo.addresses.map((a) => (
                  <option key={a.url} value={a.url}>
                    {a.name}: {a.ip}:{netInfo.port}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? t('copied') : t('copyLink')}
          </button>
        </div>

        {/* Center/Right: Game Switcher, Options & 10-Seat Table */}
        <div className="space-y-5 lg:col-span-8">
          {/* Selected Game Banner & Rules */}
          <div className="gold-border relative overflow-hidden rounded-3xl bg-[#121724]/90 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <img
                src={selectedGame.coverImage}
                alt={pick(selectedGame.title)}
                className="h-28 w-full rounded-2xl object-cover sm:w-40"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#0B0D13]"
                    style={{ backgroundColor: selectedGame.accentColor }}
                  >
                    {pick(selectedGame.classicTag)}
                  </span>
                  <span className="text-xs text-slate-300">
                    {selectedGame.minPlayers}–{selectedGame.maxPlayers}{' '}
                    {lang === 'zh' ? '人适用' : 'Players'}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
                  {pick(selectedGame.title)}
                </h2>
                <p className="mt-1 text-xs text-slate-300">{pick(selectedGame.subtitle)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRules(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-bold text-[#F3E09F] hover:bg-[#D4AF37]/20"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {t('quickRules')}
                  </button>
                </div>
              </div>
            </div>

            {/* Game Switcher Pills (Host or TV) */}
            {isHost && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="mb-2 text-xs font-bold text-slate-400 uppercase">
                  {t('switchGame')}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {GAME_CATALOG.map((g) => {
                    const active = g.id === room.selectedGameId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => onSelectGame(g.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="truncate text-xs font-bold">{pick(g.title)}</div>
                        <div className="text-[10px] text-slate-400">
                          {g.minPlayers}–{g.maxPlayers}P · {pick(g.classicTag)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Game Options Panel (Host editable) */}
          {isHost && (
            <div className="rounded-3xl border border-white/10 bg-[#121724]/85 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#F3E09F] uppercase">
                <SlidersHorizontal className="h-4 w-4" />
                {t('gameOptions')}
              </div>

              {room.selectedGameId === 'avalon' && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.includePercivalMorgana)}
                      onChange={(e) =>
                        onUpdateOptions({ includePercivalMorgana: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '启用 派西维尔 + 莫甘娜' : 'Percival & Morgana'}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.includeMordred)}
                      onChange={(e) =>
                        onUpdateOptions({ includeMordred: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '启用 莫德雷德 (隐身)' : 'Mordred (Hidden)'}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.includeOberon)}
                      onChange={(e) =>
                        onUpdateOptions({ includeOberon: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '启用 奥伯伦 (孤狼)' : 'Oberon (Lone Evil)'}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.includeLadyOfTheLake)}
                      onChange={(e) =>
                        onUpdateOptions({ includeLadyOfTheLake: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '7人+ 启用湖中仙女验人' : 'Lady of the Lake (7+P)'}
                  </label>
                </div>
              )}

              {room.selectedGameId === 'werewolf' && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '发言秒数:' : 'Speech (s):'}</span>
                    <select
                      value={Number(room.gameOptions.speechSeconds ?? 45)}
                      onChange={(e) =>
                        onUpdateOptions({ speechSeconds: Number(e.target.value) })
                      }
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.enableSheriff)}
                      onChange={(e) =>
                        onUpdateOptions({ enableSheriff: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '首日警长竞选 (1.5票)' : 'Sheriff Election (1.5x Vote)'}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.sameGuardHealDies ?? true)}
                      onChange={(e) =>
                        onUpdateOptions({ sameGuardHealDies: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '同守同救奶穿规则' : 'Guard+Heal Clash Dies'}
                  </label>
                </div>
              )}

              {room.selectedGameId === 'texas' && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '起始筹码:' : 'Stack:'}</span>
                    <select
                      value={Number(room.gameOptions.startingChips ?? 2000)}
                      onChange={(e) =>
                        onUpdateOptions({ startingChips: Number(e.target.value) })
                      }
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value={1000}>1000</option>
                      <option value={2000}>2000</option>
                      <option value={5000}>5000</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.allowRebuy)}
                      onChange={(e) =>
                        onUpdateOptions({ allowRebuy: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '聚会无限自动重买' : 'Auto Party Rebuy'}
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '涨盲节奏:' : 'Blind Level:'}</span>
                    <select
                      value={Number(room.gameOptions.blindIncreaseEveryHands ?? 0)}
                      onChange={(e) =>
                        onUpdateOptions({ blindIncreaseEveryHands: Number(e.target.value) })
                      }
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value={0}>{lang === 'zh' ? '固定盲注' : 'Fixed Blinds'}</option>
                      <option value={5}>{lang === 'zh' ? '每 5 手涨盲' : 'Every 5 Hands'}</option>
                      <option value={8}>{lang === 'zh' ? '每 8 手涨盲' : 'Every 8 Hands'}</option>
                    </select>
                  </label>
                </div>
              )}

              {room.selectedGameId === 'monopoly' && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '局数上限:' : 'Max Rounds:'}</span>
                    <select
                      value={Number(room.gameOptions.maxRounds ?? 12)}
                      onChange={(e) =>
                        onUpdateOptions({ maxRounds: Number(e.target.value) })
                      }
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={20}>20</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.partyTurboRent)}
                      onChange={(e) =>
                        onUpdateOptions({ partyTurboRent: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '高倍租金加速模式' : 'Turbo Rent (+25%)'}
                  </label>
                </div>
              )}

              {room.selectedGameId === 'sketch' && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '作画秒数:' : 'Draw Time:'}</span>
                    <select
                      value={Number(room.gameOptions.drawSeconds ?? 65)}
                      onChange={(e) =>
                        onUpdateOptions({ drawSeconds: Number(e.target.value) })
                      }
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value={45}>45s</option>
                      <option value={65}>65s</option>
                      <option value={90}>90s</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '猜词秒数:' : 'Guess Time:'}</span>
                    <select
                      value={Number(room.gameOptions.guessSeconds ?? 40)}
                      onChange={(e) =>
                        onUpdateOptions({ guessSeconds: Number(e.target.value) })
                      }
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value={30}>30s</option>
                      <option value={40}>40s</option>
                      <option value={55}>55s</option>
                    </select>
                  </label>
                </div>
              )}

              {room.selectedGameId === 'undercover' && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span>{lang === 'zh' ? '词库分类:' : 'Category:'}</span>
                    <select
                      value={String(room.gameOptions.category ?? 'all')}
                      onChange={(e) => onUpdateOptions({ category: e.target.value })}
                      className="rounded bg-[#0B0D13] px-2 py-1"
                    >
                      <option value="all">{lang === 'zh' ? '全部分类混抽' : 'All Categories'}</option>
                      <option value="food">{lang === 'zh' ? '美食饮品' : 'Food & Drinks'}</option>
                      <option value="life">{lang === 'zh' ? '生活百货' : 'Daily Life'}</option>
                      <option value="pop">{lang === 'zh' ? '影视娱乐' : 'Pop Culture'}</option>
                      <option value="tech">{lang === 'zh' ? '数码科技' : 'Tech & Apps'}</option>
                      <option value="nature">{lang === 'zh' ? '动物自然' : 'Nature'}</option>
                      <option value="party">{lang === 'zh' ? '聚会脑洞' : 'Party Chaos'}</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(room.gameOptions.includeBlank)}
                      onChange={(e) =>
                        onUpdateOptions({ includeBlank: e.target.checked })
                      }
                    />
                    {lang === 'zh' ? '6人+ 加入白板身份' : 'Include Blank Slate (6+P)'}
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 10-Seat Velvet Round Table */}
          <div className="gold-border rounded-3xl bg-[#121724]/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm font-extrabold text-white">
                  {t('playersCount')}: {room.seats.length} / 10
                </span>
                {room.hasTvConnected && (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    TV Connected
                  </span>
                )}
              </div>

              {isHost && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={room.seats.length >= 10}
                    onClick={() => onEmit('room:addBot')}
                    className="inline-flex items-center gap-1 rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-bold text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-40"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {t('addBot')}
                  </button>
                  {room.seats.some((s) => s.isBot) && (
                    <button
                      type="button"
                      onClick={() => onEmit('room:removeBot')}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('removeBot')}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {room.seats.map((seat, idx) => (
                <div
                  key={seat.id}
                  className="flex flex-col items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-3"
                >
                  <AvatarBadge
                    seat={seat}
                    isMe={seat.id === myPlayerId}
                    subLabel={`#${idx + 1}`}
                  />
                  {isHost && (
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          onEmit('room:moveSeat', { playerId: seat.id, direction: -1 })
                        }
                        className="rounded bg-white/10 p-1 text-slate-300 hover:bg-white/20 disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === room.seats.length - 1}
                        onClick={() =>
                          onEmit('room:moveSeat', { playerId: seat.id, direction: 1 })
                        }
                        className="rounded bg-white/10 p-1 text-slate-300 hover:bg-white/20 disabled:opacity-30"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {room.seats.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm text-slate-400">
                  {isTvMode
                    ? lang === 'zh'
                      ? '请玩家手机扫码加入房间，首位加入的玩家将成为房主'
                      : 'Scan the QR code on your phone to join—first player becomes Host!'
                    : lang === 'zh'
                      ? '等待玩家加入...'
                      : 'Waiting for players...'}
                </div>
              )}
            </div>

            {startError && (
              <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
                {startError}
              </div>
            )}

            {isHost && (
              <div className="mt-5">
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={handleStart}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#F3E09F] px-6 py-3.5 text-base font-black text-[#0B0D13] shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Play className="h-5 w-5 fill-current" />
                  {canStart
                    ? `${t('startGame')} · ${pick(selectedGame.title)}`
                    : t('needMorePlayers', { min: selectedGame.minPlayers })}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <QuickRulesModal
        game={selectedGame}
        open={showRules}
        onClose={() => setShowRules(false)}
      />
    </div>
  );
};
