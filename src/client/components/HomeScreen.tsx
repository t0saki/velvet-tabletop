import React, { useState } from 'react';
import {
  BookOpen,
  Globe,
  Monitor,
  Play,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react';
import { AVATARS, GAME_CATALOG, type GameCatalogEntry } from '../../shared/catalog.js';
import { useI18n } from '../i18n/useI18n.js';
import { QuickRulesModal } from './QuickRulesModal.js';

export const HomeScreen: React.FC<{
  initialRoomCode: string;
  initialTvMode: boolean;
  connected: boolean;
  errorMsg: string | null;
  onCreatePlay: (name: string, avatarId: string) => void;
  onCreateTv: () => void;
  onJoin: (roomCode: string, name: string, avatarId: string, asTv: boolean) => void;
}> = ({
  initialRoomCode,
  connected,
  errorMsg,
  onCreatePlay,
  onCreateTv,
  onJoin,
}) => {
  const { lang, setLang, t, pick } = useI18n();
  const [name, setName] = useState(
    () => localStorage.getItem('vt_nickname') || (lang === 'zh' ? '派对玩家' : 'Party Guest'),
  );
  const [avatarId, setAvatarId] = useState(
    () => localStorage.getItem('vt_avatar') || AVATARS[0].id,
  );
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [rulesGame, setRulesGame] = useState<GameCatalogEntry | null>(null);

  const persistProfile = (nextName: string, nextAvatar: string) => {
    localStorage.setItem('vt_nickname', nextName);
    localStorage.setItem('vt_avatar', nextAvatar);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0D13] text-[#F5F2EB]">
      {/* Seedance looping luxury velvet tabletop video backdrop */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-35"
        src="/videos/lobby-velvet-25.mp4"
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0B0D13]/75 via-[#0B0D13]/65 to-[#0B0D13]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-5 pb-16 sm:px-6">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/images/brand-crest.webp"
              alt="Velvet Tabletop"
              className="h-11 w-11 rounded-xl border border-[#D4AF37]/50 object-cover shadow-lg"
            />
            <div>
              <h1 className="text-lg font-extrabold tracking-wide text-[#F3E09F] sm:text-xl">
                {t('brandName')}
              </h1>
              <p className="text-[11px] tracking-wider text-slate-300 uppercase">
                {t('brandSub')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                connected
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-200'
              }`}
            >
              <Wifi className="h-3.5 w-3.5" />
              {connected ? t('connected') : t('reconnecting')}
            </span>

            <button
              type="button"
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#141824]/90 px-3 py-1 text-xs font-bold text-[#F3E09F] hover:bg-[#1E2436]"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </header>

        {/* Hero Entry Card */}
        <section className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="gold-border gold-glow rounded-3xl bg-[#121622]/88 p-5 backdrop-blur-md sm:p-7 lg:col-span-7">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-bold text-[#F3E09F]">
              <Sparkles className="h-3.5 w-3.5" />
              {lang === 'zh'
                ? '6款商业级局域网聚会桌游 · 手机扫码秒连 · 零外网依赖'
                : '6 Classic 6–10P Party Games · Instant LAN QR Join · 100% Offline Ready'}
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {lang === 'zh'
                ? '把客厅变成高端私人桌游馆'
                : 'Turn Any Living Room Into a Luxury Party Salon'}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {lang === 'zh'
                ? '支持「电视/电脑当大屏舞台 + 手机当私密手牌」，无大屏时纯手机也能独立同桌开玩！'
                : 'Adaptive Dual-Mode: use a TV/laptop as the dramatic public stage with phones as secret hands, or play 100% phone-to-phone with no big screen needed.'}
            </p>

            {/* Profile Picker */}
            <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    {t('nicknamePlaceholder')}
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      persistProfile(e.target.value, avatarId);
                    }}
                    placeholder={t('nicknamePlaceholder')}
                    className="w-full rounded-xl border border-white/15 bg-[#0B0D13] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate-300">
                  {lang === 'zh' ? '选择你的贵宾面具头像' : 'Choose Avatar'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.slice(0, 12).map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => {
                        setAvatarId(av.id);
                        persistProfile(name, av.id);
                      }}
                      className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${av.bg} text-xl transition-transform ${
                        avatarId === av.id
                          ? 'scale-110 ring-2 ring-[#D4AF37]'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                      title={pick(av.label)}
                    >
                      {av.image ? (
                        <img
                          src={av.image}
                          alt={pick(av.label)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        av.emoji
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-200">
                {errorMsg}
              </div>
            )}

            {/* Primary Actions */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onCreatePlay(name, avatarId)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#F3E09F] px-5 py-3 text-sm font-extrabold text-[#0B0D13] shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Play className="h-4 w-4 fill-current" />
                {t('createAndPlay')}
              </button>

              <button
                type="button"
                onClick={onCreateTv}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/45 bg-[#1B2234] px-5 py-3 text-sm font-bold text-[#F3E09F] transition-colors hover:bg-[#242D45]"
              >
                <Monitor className="h-4 w-4" />
                {t('createTvStage')}
              </button>
            </div>
          </div>

          {/* Join By Code Card */}
          <div className="gold-border flex flex-col justify-between rounded-3xl bg-[#121622]/88 p-5 backdrop-blur-md sm:p-7 lg:col-span-5">
            <div>
              <h3 className="text-lg font-extrabold text-white">{t('joinRoom')}</h3>
              <p className="mt-1 text-xs text-slate-300">
                {lang === 'zh'
                  ? '输入大屏或房主手机上的 4 位房间号，或直接用微信/相机扫一扫屏幕二维码。'
                  : 'Enter the 4-letter Room Code shown on the host screen or TV.'}
              </p>

              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder={t('roomCodePlaceholder')}
                  className="w-full rounded-2xl border border-[#D4AF37]/40 bg-[#0B0D13] px-4 py-3.5 text-center font-mono text-2xl font-black tracking-[0.35em] text-[#F3E09F] uppercase placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-500 focus:border-[#D4AF37] focus:outline-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={roomCode.trim().length < 4}
                    onClick={() => onJoin(roomCode, name, avatarId, false)}
                    className="col-span-2 min-h-[46px] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('joinBtn')}
                  </button>
                  <button
                    type="button"
                    disabled={roomCode.trim().length < 4}
                    onClick={() => onJoin(roomCode, name, avatarId, true)}
                    title="Join as TV Display"
                    className="flex min-h-[46px] items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    TV
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-300">
              <div className="font-bold text-[#F3E09F]">
                {lang === 'zh' ? '聚会人数不足 6 人？' : 'Fewer than 6 friends nearby?'}
              </div>
              <p className="mt-1 leading-relaxed text-slate-400">
                {lang === 'zh'
                  ? '入房后房主可一键「+ 添加 AI 补位」，智能 AI 玩家会参与博弈推理、竞拍和出牌！'
                  : 'The Host can add smart AI Bots in the lobby anytime to fill out 6–10 player tables.'}
              </p>
            </div>
          </div>
        </section>

        {/* 6 Games Commercial Showcase */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white sm:text-xl">
              {lang === 'zh'
                ? '精选 6 款商业级聚会桌游矩阵'
                : 'Curated 6-Game Party Collection'}
            </h3>
            <span className="text-xs text-slate-400">
              {lang === 'zh' ? '支持随时切换游戏免重扫码' : 'Switch games anytime in-room'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GAME_CATALOG.map((game) => (
              <div
                key={game.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-[#131723]/90 transition hover:border-[#D4AF37]/60"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={game.coverImage}
                    alt={pick(game.title)}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131723] via-transparent to-black/30" />
                  <span
                    className="absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#0B0D13]"
                    style={{ backgroundColor: game.accentColor }}
                  >
                    {pick(game.badgeText)}
                  </span>
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                    <Users className="h-3 w-3 text-[#D4AF37]" />
                    {game.minPlayers}-{game.maxPlayers}
                  </span>
                </div>

                <div className="p-4">
                  <div className="text-[11px] font-bold tracking-wider text-[#D4AF37] uppercase">
                    {pick(game.classicTag)}
                  </div>
                  <h4 className="mt-0.5 text-base font-extrabold text-white">
                    {pick(game.title)}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                    {pick(game.subtitle)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRulesGame(game)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#F3E09F] hover:bg-white/10"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {t('quickRules')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {rulesGame && (
        <QuickRulesModal
          game={rulesGame}
          open={Boolean(rulesGame)}
          onClose={() => setRulesGame(null)}
        />
      )}
    </div>
  );
};
