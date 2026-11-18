import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  FlaskConical,
  History,
  Moon,
  ScrollText,
  Shield,
  Skull,
  Sun,
  Vote,
} from 'lucide-react';
import type {
  WerewolfPrivateState,
  WerewolfPublicState,
  WerewolfRole,
} from '../../shared/gameTypes.js';
import type { PlayerSeat, RoomPublicState } from '../../shared/types.js';
import { useI18n } from '../i18n/useI18n.js';
import { soundEngine } from '../audio/soundEngine.js';
import { AvatarBadge } from '../components/AvatarBadge.js';
import { CountdownPill } from '../components/CountdownPill.js';
import { PrivacyPeekCard } from '../components/PrivacyPeekCard.js';

const WW_ROLE_LABELS: Record<WerewolfRole, { zh: string; en: string; descZh: string; descEn: string }> = {
  werewolf: {
    zh: '暗夜狼人',
    en: 'Werewolf',
    descZh: '每晚与狼同伴商议袭击一名玩家，白天伪装成好人。',
    descEn: 'Hunt one player each night with your pack; deceive the village by day.',
  },
  villager: {
    zh: '忠诚平民',
    en: 'Villager',
    descZh: '没有夜间技能，用逻辑与投票揪出所有狼人！',
    descEn: 'No night power—rely on sharp deduction and daytime votes!',
  },
  seer: {
    zh: '月影预言家',
    en: 'Seer',
    descZh: '每晚查验一名存活玩家的真实阵营（好人 / 狼人）。',
    descEn: 'Inspect one living player each night to learn if they are a Werewolf.',
  },
  witch: {
    zh: '神秘女巫',
    en: 'Witch',
    descZh: '拥有一瓶解药（可救当晚狼刀）和一瓶毒药，每晚最多用一瓶。',
    descEn: 'Hold 1 Elixir (saves tonight’s victim) and 1 Poison. Max 1 potion per night.',
  },
  hunter: {
    zh: '银弹猎人',
    en: 'Hunter',
    descZh: '被狼刀或放逐出局时可开枪带走一人（被女巫毒杀不可开枪）。',
    descEn: 'When killed by wolves or exiled, shoot one player down (blocked if poisoned).',
  },
  guard: {
    zh: '圣殿守卫',
    en: 'Guard',
    descZh: '每晚守护一名玩家免受狼刀，不能连续两晚守护同一人。',
    descEn: 'Protect one player per night from wolf attack (no back-to-back repeats).',
  },
};

type StepKey = 'guard' | 'wolf' | 'witch' | 'seer' | 'dawn' | 'speech' | 'vote';

const PHASE_STEPS: Array<{ key: StepKey; zh: string; en: string; isNight: boolean }> = [
  { key: 'guard', zh: '守卫', en: 'Guard', isNight: true },
  { key: 'wolf', zh: '狼人', en: 'Wolves', isNight: true },
  { key: 'witch', zh: '女巫', en: 'Witch', isNight: true },
  { key: 'seer', zh: '预言家', en: 'Seer', isNight: true },
  { key: 'dawn', zh: '黎明', en: 'Dawn', isNight: false },
  { key: 'speech', zh: '发言', en: 'Speak', isNight: false },
  { key: 'vote', zh: '投票', en: 'Vote', isNight: false },
];

const ROLE_POOL_META: Array<{ role: WerewolfRole; emoji: string; zh: string; en: string }> = [
  { role: 'werewolf', emoji: '🐺', zh: '狼人', en: 'Werewolf' },
  { role: 'seer', emoji: '🔮', zh: '预言家', en: 'Seer' },
  { role: 'witch', emoji: '🧪', zh: '女巫', en: 'Witch' },
  { role: 'hunter', emoji: '🔫', zh: '猎人', en: 'Hunter' },
  { role: 'guard', emoji: '🛡️', zh: '守卫', en: 'Guard' },
  { role: 'villager', emoji: '🧑‍🌾', zh: '平民', en: 'Villager' },
];

type SuspectNote = 0 | 1 | 2 | 3;

const SUSPECT_TAG_META: Record<
  SuspectNote,
  { zh: string; en: string; cls: string }
> = {
  0: {
    zh: '? 标记',
    en: '? Note',
    cls: 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
  },
  1: {
    zh: '👍 认好',
    en: '👍 Good',
    cls: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
  },
  2: {
    zh: '🐺 标狼',
    en: '🐺 Wolf',
    cls: 'border-rose-400/50 bg-rose-500/25 text-rose-200',
  },
  3: {
    zh: '✨ 标神',
    en: '✨ God',
    cls: 'border-sky-400/50 bg-sky-500/20 text-sky-200',
  },
};

function getActiveStepKey(pub: WerewolfPublicState): StepKey | null {
  switch (pub.phase) {
    case 'night_guard':
      return 'guard';
    case 'night_wolf':
      return 'wolf';
    case 'night_witch':
      return 'witch';
    case 'night_seer':
      return 'seer';
    case 'dawn_announce':
    case 'sheriff_campaign':
    case 'sheriff_vote':
      return 'dawn';
    case 'day_speech':
      return 'speech';
    case 'day_vote':
      return 'vote';
    case 'sheriff_handover':
    case 'hunter_revenge': {
      const votedToday = pub.voteHistory?.some((v) => v.dayNumber === pub.dayNumber);
      return votedToday ? 'vote' : 'dawn';
    }
    default:
      return null;
  }
}

export const WerewolfView: React.FC<{
  room: RoomPublicState;
  pub: WerewolfPublicState;
  priv: WerewolfPrivateState | null;
  isTvMode: boolean;
  isHost: boolean;
  onAction: (action: Record<string, unknown>) => void;
  onEmit: (event: string) => void;
}> = ({ room, pub, priv, isTvMode, isHost, onAction, onEmit }) => {
  const { lang, pick } = useI18n();
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [showTableLog, setShowTableLog] = useState<boolean>(true);
  const [showPastVotes, setShowPastVotes] = useState<boolean>(false);
  const [suspectNotes, setSuspectNotes] = useState<Record<string, SuspectNote>>({});

  const prevPhaseRef = useRef<WerewolfPublicState['phase']>(pub.phase);
  const lastHowledDayRef = useRef<number>(0);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    if (pub.phase === 'role_peek') {
      lastHowledDayRef.current = 0;
      if (prevPhase !== 'role_peek') {
        setSuspectNotes({});
      }
    }
    if (prevPhase !== pub.phase) {
      prevPhaseRef.current = pub.phase;
      if (
        (pub.phase === 'night_guard' || pub.phase === 'night_wolf') &&
        lastHowledDayRef.current !== pub.dayNumber
      ) {
        lastHowledDayRef.current = pub.dayNumber;
        soundEngine.playSfx('wolfHowl');
      }
      if (pub.phase === 'game_over') {
        soundEngine.playSfx('victoryFanfare');
      }
    }
    if (pub.phase !== 'night_witch') {
      setSelectedTarget('');
    }
  }, [pub.phase, pub.dayNumber]);

  const seatMap = new Map<string, PlayerSeat>(room.seats.map((s) => [s.id, s]));
  const deadMap = new Map(pub.deadPlayers.map((d) => [d.playerId, d]));
  const isNight = pub.phase.startsWith('night_');
  const activeStep = getActiveStepKey(pub);
  const hasGuard = Boolean(pub.rolePoolCounts?.guard);

  const cycleSuspectNote = (playerId: string) => {
    soundEngine.playSfx('buttonTap');
    setSuspectNotes((prev) => ({
      ...prev,
      [playerId]: (((prev[playerId] ?? 0) + 1) % 4) as SuspectNote,
    }));
  };

  const phaseLabel = (() => {
    const m: Record<WerewolfPublicState['phase'], { zh: string; en: string }> = {
      role_peek: { zh: '入夜前确认身份牌', en: 'Confirm Secret Roles' },
      night_guard: { zh: '第 ' + pub.dayNumber + ' 夜 · 守卫请行动', en: `Night ${pub.dayNumber} · Guard Turn` },
      night_wolf: { zh: '第 ' + pub.dayNumber + ' 夜 · 狼人请袭击', en: `Night ${pub.dayNumber} · Wolves Hunt` },
      night_witch: { zh: '第 ' + pub.dayNumber + ' 夜 · 女巫请抉择', en: `Night ${pub.dayNumber} · Witch Turn` },
      night_seer: { zh: '第 ' + pub.dayNumber + ' 夜 · 预言家查验', en: `Night ${pub.dayNumber} · Seer Vision` },
      dawn_announce: { zh: '黎明降临 · 揭晓昨夜战报', en: 'Dawn Breaks · Night Report' },
      sheriff_campaign: { zh: '警长竞选上警阶段', en: 'Sheriff Campaign Signup' },
      sheriff_vote: { zh: '全员投票选举警长', en: 'Vote for Village Sheriff' },
      sheriff_handover: { zh: '警长倒牌 · 移交或撕毁警徽', en: 'Fallen Sheriff · Badge Handover' },
      day_speech: { zh: '白天按序发言讨论', en: 'Daytime Discussion' },
      day_vote: { zh: '全员同步投票放逐', en: 'Daytime Exile Vote' },
      hunter_revenge: { zh: '猎人倒下 · 发动复仇枪击！', en: 'Hunter’s Final Shot!' },
      game_over: { zh: '月蚀终局 · 真相揭晓', en: 'Game Over' },
    };
    return pick(m[pub.phase]);
  })();

  const latestSeerCheck =
    priv?.role === 'seer' && priv.seerChecks?.length
      ? priv.seerChecks[priv.seerChecks.length - 1]
      : null;

  const validPoisonTarget =
    selectedTarget && pub.aliveIds.includes(selectedTarget) ? selectedTarget : '';

  const roleCounts = pub.rolePoolCounts;
  const chronicle = pub.chronicle ?? [];
  const voteHistory = pub.voteHistory ?? [];

  const renderVoteEntry = (
    voteRecord: {
      votes: Record<string, string | 'abstain'>;
      exiledId: string | null;
      tiedIds?: string[];
      sheriffId?: string | null;
    },
    compact = false,
  ) => {
    const sheriffVoterId =
      voteRecord.sheriffId !== undefined ? voteRecord.sheriffId : (pub.sheriffId ?? null);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          {voteRecord.exiledId ? (
            <span className="text-rose-300">
              🔨{' '}
              {lang === 'zh'
                ? `放逐出局：${seatMap.get(voteRecord.exiledId)?.name ?? voteRecord.exiledId}`
                : `Exiled: ${seatMap.get(voteRecord.exiledId)?.name ?? voteRecord.exiledId}`}
            </span>
          ) : voteRecord.tiedIds && voteRecord.tiedIds.length > 0 ? (
            <span className="text-amber-300">
              ⚖️{' '}
              {lang === 'zh'
                ? `平票：${voteRecord.tiedIds.map((id) => seatMap.get(id)?.name ?? id).join(' vs ')}`
                : `Tied: ${voteRecord.tiedIds.map((id) => seatMap.get(id)?.name ?? id).join(' vs ')}`}
            </span>
          ) : (
            <span className="text-slate-300">
              🕊️ {lang === 'zh' ? '无人被放逐' : 'No one was exiled'}
            </span>
          )}
        </div>
        <div className={`grid gap-1.5 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {Object.entries(voteRecord.votes).map(([voterId, target]) => {
            const isSheriffVote = sheriffVoterId === voterId;
            const voterName = seatMap.get(voterId)?.name ?? voterId;
            const targetName =
              target === 'abstain'
                ? lang === 'zh'
                  ? '弃票'
                  : 'Abstain'
                : seatMap.get(target)?.name ?? target;
            return (
              <div
                key={voterId}
                className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${
                  isSheriffVote
                    ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F3E09F]'
                    : 'border-white/10 bg-black/30 text-slate-200'
                }`}
              >
                <span className="truncate font-semibold">
                  {voterName}
                  {isSheriffVote && (
                    <span className="ml-1 rounded bg-[#D4AF37]/30 px-1 text-[10px] font-black text-[#F3E09F]">
                      ⭐1.5
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-slate-400">→</span>
                <span
                  className={`truncate font-bold ${
                    target === 'abstain' ? 'text-slate-400' : 'text-rose-200'
                  }`}
                >
                  {targetName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-24 sm:px-6">
      {/* Public Stage */}
      <div
        className={`rounded-3xl border p-4 backdrop-blur-md transition-colors sm:p-6 ${
          isNight
            ? 'border-rose-500/40 bg-[#0F0B18]/92'
            : 'border-[#D4AF37]/40 bg-[#151A28]/92'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                isNight ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {isNight ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                {lang === 'zh' ? '月蚀古堡 · 全自动语音法官' : 'Moonlit Coven · Auto Judge'}
              </div>
              <h2 className="text-lg font-black text-white sm:text-2xl">{phaseLabel}</h2>
            </div>
          </div>
          <CountdownPill deadline={pub.phaseDeadline} paused={room.status === 'paused'} />
        </div>

        {/* Gothic Phase Stepper & Role Pool Composition Bar */}
        <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-black/35 p-1.5">
            {PHASE_STEPS.map((step, idx) => {
              const isGuardDisabled = step.key === 'guard' && !hasGuard;
              const isActive = activeStep === step.key && !isGuardDisabled;
              return (
                <React.Fragment key={step.key}>
                  {idx > 0 && <span className="text-[10px] text-slate-600">→</span>}
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-all ${
                      isGuardDisabled
                        ? 'text-slate-600 line-through opacity-40'
                        : isActive
                          ? step.isNight
                            ? 'border border-rose-400/70 bg-rose-500/25 text-rose-100 shadow-sm'
                            : 'border border-[#D4AF37]/70 bg-[#D4AF37]/25 text-[#F3E09F] shadow-sm'
                          : 'text-slate-400'
                    }`}
                  >
                    {lang === 'zh' ? step.zh : step.en}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          {roleCounts && (
            <div
              className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#D4AF37]/25 bg-black/35 px-3 py-1.5 text-xs font-semibold text-slate-200"
              title={
                lang === 'zh'
                  ? '本局身份配置（不含座位信息）'
                  : 'Role pool composition (hidden seats)'
              }
            >
              {ROLE_POOL_META.filter((m) => (roleCounts[m.role] ?? 0) > 0).map((m, idx) => {
                const count = roleCounts[m.role] ?? 0;
                return (
                  <React.Fragment key={m.role}>
                    {idx > 0 && <span className="text-slate-600">·</span>}
                    <span
                      className="inline-flex items-center gap-0.5"
                      title={`${lang === 'zh' ? m.zh : m.en} ×${count}`}
                    >
                      <span>{m.emoji}</span>
                      {count > 1 && <span className="text-[11px] text-[#F3E09F]">×{count}</span>}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Night Report Summary */}
        {pub.lastNightSummary && !isNight && pub.phase !== 'role_peek' && (
          <div className="animate-card-deal mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100">
            {pick(pub.lastNightSummary)}
          </div>
        )}

        {/* Day Speech Queue Bar */}
        {pub.phase === 'day_speech' && (
          <div className="animate-card-deal mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3.5 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-black text-[#F3E09F]">
              🎙️ {lang === 'zh' ? '正在发言：' : 'Speaking: '}
              <span className="rounded-lg bg-[#D4AF37] px-2 py-0.5 text-[#0B0D13]">
                {seatMap.get(pub.currentSpeakerId ?? '')?.name ?? '-'}
              </span>
            </span>
            <span className="text-slate-500">|</span>
            {pub.speechQueue.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-slate-200">
                <span className="font-bold text-slate-400">
                  {lang === 'zh' ? '下一位：' : 'Next: '}
                </span>
                {pub.speechQueue.map((sid, idx) => {
                  const isMe = sid === priv?.playerId;
                  return (
                    <React.Fragment key={sid}>
                      {idx > 0 && <span className="text-slate-500">→</span>}
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          idx === 0
                            ? 'border border-amber-400/50 bg-amber-500/20 text-amber-100'
                            : isMe
                              ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                              : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        {seatMap.get(sid)?.name ?? sid}
                        {isMe ? (lang === 'zh' ? ' (你)' : ' (You)') : ''}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <span className="font-semibold text-amber-200">
                {lang === 'zh' ? '最后一位发言，结束后全员投票' : 'Final speaker before exile vote'}
              </span>
            )}
          </div>
        )}

        {/* Sheriff Handover Public Banner */}
        {pub.phase === 'sheriff_handover' && (
          <div className="animate-pulse-gold mt-3 rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-4 py-2.5 text-xs font-bold text-[#F3E09F]">
            ⭐{' '}
            {lang === 'zh'
              ? `警长「${seatMap.get(pub.pendingSheriffHandoverId ?? '')?.name ?? ''}」倒下，正在决定警徽归属（移交或撕毁）...`
              : `Fallen Sheriff ${seatMap.get(pub.pendingSheriffHandoverId ?? '')?.name ?? ''} is passing or tearing up the 1.5x badge...`}
          </div>
        )}

        {/* PK Banner */}
        {pub.pkCandidateIds && pub.pkCandidateIds.length > 0 && (
          <div className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-xs font-bold text-rose-200">
            {lang === 'zh' ? '平票 PK 加投对象：' : 'Tiebreak PK Candidates: '}
            {pub.pkCandidateIds.map((id) => seatMap.get(id)?.name).join(' vs ')}
          </div>
        )}

        {/* Game Over Banner */}
        {pub.phase === 'game_over' && (
          <div
            className={`animate-flip-in mt-4 rounded-2xl border p-5 text-center ${
              pub.winner === 'villagers'
                ? 'border-sky-400/60 bg-sky-500/15'
                : 'border-rose-500/60 bg-rose-500/15'
            }`}
          >
            <h3 className="text-2xl font-black text-white">
              {pub.winner === 'villagers'
                ? lang === 'zh'
                  ? '好人阵营获胜！'
                  : 'Villagers Win!'
                : lang === 'zh'
                  ? '狼人阵营获胜！'
                  : 'Werewolves Win!'}
            </h3>
            <p className="mt-1 text-sm text-slate-200">{pick(pub.winReason)}</p>
            {isHost && (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onEmit('room:startGame')}
                  className="rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-extrabold text-[#0B0D13]"
                >
                  {lang === 'zh' ? '再来一局' : 'Play Again'}
                </button>
                <button
                  type="button"
                  onClick={() => onEmit('room:returnToLobby')}
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-xs font-bold text-white"
                >
                  {lang === 'zh' ? '返回大厅' : 'Lobby'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Seats Grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {room.seats.map((seat) => {
            const alive = pub.aliveIds.includes(seat.id);
            const isSpeaking = pub.currentSpeakerId === seat.id;
            const isSheriff = pub.sheriffId === seat.id;
            const isHandingOver =
              pub.phase === 'sheriff_handover' && pub.pendingSheriffHandoverId === seat.id;
            const revRole = pub.revealedRoles?.[seat.id];
            const death = deadMap.get(seat.id);
            const hasPeeked =
              pub.phase === 'role_peek' && pub.peekedPlayerIds.includes(seat.id);
            const hasVoted =
              pub.phase === 'day_vote' && alive && pub.votedPlayerIds.includes(seat.id);
            const isSheriffCandidate =
              (pub.phase === 'sheriff_campaign' || pub.phase === 'sheriff_vote') &&
              pub.sheriffCandidates?.includes(seat.id);

            const deathLabel = death
              ? death.cause === 'poison'
                ? lang === 'zh'
                  ? '🧪 毒杀'
                  : '🧪 Poisoned'
                : death.cause === 'exile'
                  ? lang === 'zh'
                    ? '⚖️ 放逐'
                    : '⚖️ Exiled'
                  : death.cause === 'hunter'
                    ? lang === 'zh'
                      ? '🔫 中枪'
                      : '🔫 Shot'
                    : lang === 'zh'
                      ? '💀 倒牌'
                      : '💀 Fallen'
              : lang === 'zh'
                ? '💀 已出局'
                : '💀 Fallen';

            const badge = revRole
              ? lang === 'zh'
                ? WW_ROLE_LABELS[revRole].zh
                : WW_ROLE_LABELS[revRole].en
              : isHandingOver
                ? lang === 'zh'
                  ? '⭐ 移交警徽'
                  : '⭐ Passing'
                : !alive
                  ? deathLabel
                  : isSpeaking
                    ? lang === 'zh'
                      ? '🎙️ 发言中'
                      : '🎙️ Speaking'
                    : isSheriff
                      ? lang === 'zh'
                        ? '⭐ 警长(1.5)'
                        : '⭐ Sheriff(1.5)'
                      : hasPeeked
                        ? lang === 'zh'
                          ? '✓ 已看牌'
                          : '✓ Ready'
                        : hasVoted
                          ? lang === 'zh'
                            ? '✓ 已投票'
                            : '✓ Voted'
                          : isSheriffCandidate
                            ? lang === 'zh'
                              ? '🎖️ 竞选'
                              : '🎖️ Candidate'
                            : undefined;

            const note = suspectNotes[seat.id] ?? 0;
            const noteMeta = SUSPECT_TAG_META[note];

            return (
              <div
                key={seat.id}
                className={`flex flex-col items-center rounded-2xl border p-2.5 transition-all ${
                  isSpeaking
                    ? 'animate-pulse-gold border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30'
                    : isHandingOver
                      ? 'border-[#D4AF37]/70 bg-[#D4AF37]/10'
                      : !alive
                        ? 'border-white/5 bg-black/40'
                        : 'border-white/10 bg-black/25'
                }`}
              >
                <AvatarBadge
                  seat={seat}
                  size="sm"
                  isMe={seat.id === priv?.playerId}
                  dimmed={!alive}
                  highlight={isSpeaking}
                  subLabel={badge}
                />
                {revRole && (
                  <img
                    src={`/images/roles/${revRole}.webp`}
                    alt={revRole}
                    className="animate-flip-in mt-2 h-16 w-12 rounded-lg border border-rose-400/40 object-cover shadow"
                  />
                )}
                {revRole && !alive && (
                  <span className="mt-1 text-[10px] text-slate-400">{deathLabel}</span>
                )}
                {!isTvMode && priv && pub.phase !== 'game_over' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleSuspectNote(seat.id);
                    }}
                    className={`mt-2 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${noteMeta.cls}`}
                    title={lang === 'zh' ? '仅自己可见的私密标记' : 'Private local note'}
                  >
                    {lang === 'zh' ? noteMeta.zh : noteMeta.en}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Collapsible Vote Breakdown & Castle Chronicle */}
        {(pub.lastVoteResult || chronicle.length > 0 || voteHistory.length > 0) && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/35">
            <button
              type="button"
              onClick={() => setShowTableLog((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-bold text-[#F3E09F]"
            >
              <span className="inline-flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                {lang === 'zh'
                  ? '古堡编年史与投票复盘'
                  : 'Castle Chronicle & Vote Breakdown'}
                {chronicle.length > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                    {chronicle.length}
                  </span>
                )}
              </span>
              {showTableLog ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showTableLog && (
              <div className="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-2">
                {/* Vote Breakdown */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-200">
                      <Vote className="h-3.5 w-3.5" />
                      {lang === 'zh' ? '最近一次投票明细' : 'Latest Vote Breakdown'}
                    </span>
                    {voteHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowPastVotes((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10"
                      >
                        <History className="h-3 w-3" />
                        {showPastVotes
                          ? lang === 'zh'
                            ? '收起往期'
                            : 'Hide Prior'
                          : lang === 'zh'
                            ? `往期 (${voteHistory.length - 1})`
                            : `History (${voteHistory.length - 1})`}
                      </button>
                    )}
                  </div>

                  {pub.lastVoteResult ? (
                    renderVoteEntry(pub.lastVoteResult)
                  ) : (
                    <p className="text-xs text-slate-500">
                      {lang === 'zh' ? '尚未进行白天放逐投票' : 'No exile vote recorded yet'}
                    </p>
                  )}

                  {showPastVotes && voteHistory.length > 1 && (
                    <div className="max-h-48 space-y-2.5 overflow-y-auto border-t border-white/10 pt-2">
                      {voteHistory
                        .slice(0, -1)
                        .reverse()
                        .map((vh, idx) => (
                          <div
                            key={`${vh.dayNumber}-${vh.isPk}-${idx}`}
                            className="rounded-xl border border-white/10 bg-black/25 p-2.5"
                          >
                            <div className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase">
                              {lang === 'zh'
                                ? `第 ${vh.dayNumber} 天${vh.isPk ? ' · PK加投' : ''}`
                                : `Day ${vh.dayNumber}${vh.isPk ? ' · PK' : ''}`}
                            </div>
                            {renderVoteEntry(vh, true)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Castle Chronicle */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
                    <ScrollText className="h-3.5 w-3.5" />
                    {lang === 'zh' ? '古堡编年史' : 'Castle Chronicle'}
                  </div>
                  {chronicle.length > 0 ? (
                    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                      {chronicle.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/30 px-2.5 py-1.5 text-xs text-slate-200"
                        >
                          <span className="mt-0.5 shrink-0 rounded bg-[#D4AF37]/20 px-1.5 py-0.5 text-[10px] font-black text-[#F3E09F]">
                            D{entry.day}
                          </span>
                          <span>{pick(entry.text)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {lang === 'zh' ? '入夜后将在此记录古堡大事记' : 'Public events will appear here'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Private Hand & Night/Day Controls */}
      {!isTvMode && priv && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <PrivacyPeekCard
              title={lang === 'zh' ? '你的夜幕身份' : 'Your Secret Role'}
              accentColor={priv.role === 'werewolf' ? '#F43F5E' : '#38BDF8'}
            >
              <div className="flex flex-col items-center gap-2.5 text-center sm:flex-row sm:text-left">
                <img
                  src={`/images/roles/${priv.role}.webp`}
                  alt={priv.role}
                  className="aspect-[3/4] w-24 shrink-0 rounded-xl border border-[#D4AF37]/60 object-cover shadow-xl"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h3 className="text-xl font-black text-white">
                    {lang === 'zh'
                      ? WW_ROLE_LABELS[priv.role].zh
                      : WW_ROLE_LABELS[priv.role].en}
                    {!priv.alive && (
                      <span className="ml-2 text-xs text-rose-400">
                        ({lang === 'zh' ? '已出局' : 'Dead'})
                      </span>
                    )}
                  </h3>
                  {pub.sheriffId === priv.playerId && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-black text-[#F3E09F]">
                      ⭐ {lang === 'zh' ? '现任警长 (1.5x 投票权)' : 'Village Sheriff (1.5x Vote)'}
                    </div>
                  )}
                  <p className="text-xs text-slate-300">
                    {lang === 'zh'
                      ? WW_ROLE_LABELS[priv.role].descZh
                      : WW_ROLE_LABELS[priv.role].descEn}
                  </p>
                </div>
              </div>
              <div className="mt-2 space-y-2 text-center">
                {priv.wolfTeammates && priv.wolfTeammates.length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-2 text-xs text-rose-200">
                    {lang === 'zh' ? '狼同伴：' : 'Pack: '}
                    {priv.wolfTeammates.map((id) => seatMap.get(id)?.name).join(' · ')}
                  </div>
                )}

                {priv.seerChecks && priv.seerChecks.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-sky-500/30 bg-sky-950/40 p-2 text-left text-xs">
                    <div className="font-bold text-sky-200">
                      {lang === 'zh' ? '预言家查验记录：' : 'Seer Checks:'}
                    </div>
                    {priv.seerChecks.map((c, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          N{c.night}: {seatMap.get(c.targetId)?.name}
                        </span>
                        <span className={c.isWolf ? 'font-bold text-rose-400' : 'text-emerald-300'}>
                          {c.isWolf
                            ? lang === 'zh'
                              ? '狼人 🐺'
                              : 'Werewolf 🐺'
                            : lang === 'zh'
                              ? '好人 ✓'
                              : 'Good ✓'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PrivacyPeekCard>
          </div>

          <div className="gold-border flex flex-col justify-center rounded-2xl bg-[#121724]/95 p-4 lg:col-span-7">
            {pub.phase === 'role_peek' && (
              <div className="text-center">
                {priv.hasPeeked ? (
                  <p className="text-sm text-emerald-300">
                    {lang === 'zh'
                      ? `✓ 已确认身份，等待全员就绪 (${pub.peekedPlayerIds.length}/${room.seats.length})...`
                      : `✓ Ready — waiting (${pub.peekedPlayerIds.length}/${room.seats.length})...`}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'peek_ready' })}
                    className="min-h-[48px] w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#0B0D13]"
                  >
                    {lang === 'zh' ? '我已记住身份，进入首夜' : 'Ready for Night 1'}
                  </button>
                )}
              </div>
            )}

            {pub.phase === 'night_guard' && priv.canActNow && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-300">
                  <Shield className="h-4 w-4" />
                  {lang === 'zh' ? '选择今晚要守护的玩家（不可连守同一人）：' : 'Protect one player tonight:'}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {pub.aliveIds.map((id) => {
                    const disabled = id === priv.guardLastTargetId;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onAction({ type: 'guard_protect', targetId: id })}
                        className="min-h-[44px] rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500/30 disabled:opacity-30"
                      >
                        {seatMap.get(id)?.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pub.phase === 'night_wolf' && priv.canActNow && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                  <Skull className="h-4 w-4" />
                  {lang === 'zh' ? '狼队请选择今晚袭击的目标（可点击切换）：' : 'Select tonight’s victim (tap to switch):'}
                </div>
                {priv.wolfConsensusWarning && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-2 text-xs font-extrabold text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>
                      {lang === 'zh'
                        ? '狼队友意见分歧，请点选同一目标锁定击杀！'
                        : 'Pack split! Click the same target to lock in tonight’s kill!'}
                    </span>
                  </div>
                )}
                {priv.wolfLivePicks && Object.keys(priv.wolfLivePicks).length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/35 px-3 py-2 text-xs text-rose-200">
                    {lang === 'zh' ? '狼同伴实时意向：' : 'Pack picks: '}
                    {Object.entries(priv.wolfLivePicks)
                      .map(([wid, tid]) => `${seatMap.get(wid)?.name}→${seatMap.get(tid)?.name}`)
                      .join(' · ')}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {pub.aliveIds.map((id) => {
                    const myPick = priv.wolfLivePicks?.[priv.playerId] === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onAction({ type: 'wolf_pick', targetId: id })}
                        className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold text-white transition-all ${
                          myPick
                            ? 'border-rose-400 bg-rose-500/40 ring-2 ring-rose-400/50'
                            : 'border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/35'
                        }`}
                      >
                        {myPick ? '🎯 ' : ''}
                        {seatMap.get(id)?.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pub.phase === 'night_witch' && priv.canActNow && priv.witchState && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-purple-300">
                  <FlaskConical className="h-4 w-4" />
                  {lang === 'zh' ? '女巫魔药抉择：' : 'Witch Potion Choice:'}
                </div>
                {priv.witchState.hasAntidote && priv.witchState.attackedTonightId && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-xs">
                    <span>
                      {lang === 'zh'
                        ? `今晚「${seatMap.get(priv.witchState.attackedTonightId)?.name}」遭到狼人袭击！`
                        : `${seatMap.get(priv.witchState.attackedTonightId)?.name} was attacked tonight!`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'witch_act', choice: 'heal' })}
                      className="mt-2 min-h-[44px] w-full rounded-xl bg-emerald-500 py-2 font-black text-slate-950"
                    >
                      {lang === 'zh' ? '使用解药救活此人' : 'Use Elixir to Save'}
                    </button>
                  </div>
                )}
                {priv.witchState.hasPoison && (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-300">
                      {lang === 'zh' ? '或选择一人使用毒药：' : 'Or use Poison on:'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {pub.aliveIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedTarget(id)}
                          className={`min-h-[40px] rounded-xl border px-2 py-1.5 text-xs font-bold ${
                            validPoisonTarget === id
                              ? 'border-purple-400 bg-purple-500/35 text-white'
                              : 'border-white/10 bg-white/5 text-slate-300'
                          }`}
                        >
                          {seatMap.get(id)?.name}
                        </button>
                      ))}
                    </div>
                    {validPoisonTarget && (
                      <button
                        type="button"
                        onClick={() =>
                          onAction({ type: 'witch_act', choice: 'poison', targetId: validPoisonTarget })
                        }
                        className="min-h-[44px] w-full rounded-xl bg-purple-600 py-2 text-xs font-black text-white"
                      >
                        {lang === 'zh'
                          ? `毒杀 ${seatMap.get(validPoisonTarget)?.name}`
                          : `Poison ${seatMap.get(validPoisonTarget)?.name}`}
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onAction({ type: 'witch_act', choice: 'pass' })}
                  className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-slate-200"
                >
                  {lang === 'zh' ? '今晚不使用魔药' : 'Pass Tonight'}
                </button>
              </div>
            )}

            {pub.phase === 'night_seer' && priv.canActNow && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-300">
                  <Eye className="h-4 w-4" />
                  {lang === 'zh' ? '选择一名玩家查验身份：' : 'Inspect a player:'}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {pub.aliveIds
                    .filter((id) => id !== priv.playerId)
                    .map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onAction({ type: 'seer_check', targetId: id })}
                        className="min-h-[44px] rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500/35"
                      >
                        {seatMap.get(id)?.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {pub.phase === 'night_seer' &&
              !priv.canActNow &&
              priv.role === 'seer' &&
              latestSeerCheck?.night === pub.dayNumber && (
                <div className="animate-flip-in rounded-2xl border border-sky-400/50 bg-sky-500/15 p-4 text-center">
                  <div className="text-xs font-bold text-sky-200">
                    {lang === 'zh' ? '🔮 今夜查验结果' : '🔮 Tonight’s Vision'}
                  </div>
                  <div className="mt-1.5 text-lg font-black text-white">
                    {seatMap.get(latestSeerCheck.targetId)?.name}：{' '}
                    <span className={latestSeerCheck.isWolf ? 'text-rose-400' : 'text-emerald-300'}>
                      {latestSeerCheck.isWolf
                        ? lang === 'zh'
                          ? '狼人阵营 🐺'
                          : 'Werewolf 🐺'
                        : lang === 'zh'
                          ? '好人阵营 ✓'
                          : 'Good Alignment ✓'}
                    </span>
                  </div>
                </div>
              )}

            {pub.phase === 'dawn_announce' && (
              <p className="py-4 text-center text-sm text-amber-200">
                {lang === 'zh'
                  ? '黎明钟声敲响，请查看公屏昨夜战报...'
                  : 'Dawn breaks — check the night report above...'}
              </p>
            )}

            {pub.phase === 'sheriff_campaign' && (
              <div>
                {priv.canActNow ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'sheriff_decide', run: true })}
                      className="min-h-[48px] rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#0B0D13]"
                    >
                      {lang === 'zh' ? '上警竞选警长' : 'Run for Sheriff'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'sheriff_decide', run: false })}
                      className="min-h-[48px] rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-slate-200"
                    >
                      {lang === 'zh' ? '不上警 (退水)' : 'Pass'}
                    </button>
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-slate-300">
                    {lang === 'zh'
                      ? '已表态上警意向，等待其他玩家确认...'
                      : 'Choice recorded — waiting for other players...'}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'sheriff_vote' && pub.sheriffCandidates && (
              <div>
                {priv.canActNow ? (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#F3E09F]">
                      {lang === 'zh' ? '投票选出警长（1.5x 票权）：' : 'Vote for Sheriff (1.5x vote):'}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {pub.sheriffCandidates.map((cid) => (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => onAction({ type: 'sheriff_vote', candidateId: cid })}
                          className="min-h-[44px] rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 py-2 text-xs font-bold text-white hover:bg-[#D4AF37]/30"
                        >
                          {seatMap.get(cid)?.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-slate-300">
                    {priv.alive
                      ? lang === 'zh'
                        ? '✓ 已投警长票，等待计票...'
                        : '✓ Sheriff vote cast, waiting...'
                      : lang === 'zh'
                        ? '你已出局，无法参与警长投票'
                        : 'Eliminated players cannot vote'}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'sheriff_handover' && (
              <div>
                {priv.canActNow ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#F3E09F]">
                      <Award className="h-4 w-4" />
                      {lang === 'zh'
                        ? '警徽移交：选择一位存活玩家继承 1.5x 警徽，或撕毁警徽'
                        : 'Pass your 1.5x Sheriff badge to a survivor, or destroy it:'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {pub.aliveIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onAction({ type: 'sheriff_handover', targetId: id })}
                          className="min-h-[44px] rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-2 text-xs font-bold text-[#F3E09F] hover:bg-[#D4AF37]/30"
                        >
                          ⭐ {seatMap.get(id)?.name}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'sheriff_handover', targetId: null })}
                      className="min-h-[44px] w-full rounded-xl border border-rose-400/40 bg-rose-500/15 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
                    >
                      {lang === 'zh'
                        ? '撕毁警徽（本局不再有警长）'
                        : 'Tear Up Badge (No Sheriff)'}
                    </button>
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-[#F3E09F]">
                    {lang === 'zh'
                      ? `等待阵亡警长「${seatMap.get(pub.pendingSheriffHandoverId ?? '')?.name ?? ''}」移交或撕毁警徽...`
                      : `Waiting for fallen Sheriff ${seatMap.get(pub.pendingSheriffHandoverId ?? '')?.name ?? ''} to pass or destroy the badge...`}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'day_speech' && (
              <div className="text-center">
                {priv.canActNow ? (
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'end_speech' })}
                    className="animate-pulse-gold min-h-[50px] w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#0B0D13]"
                  >
                    {lang === 'zh' ? '结束我的发言 · 轮到下一位' : 'Finish Speaking · Next'}
                  </button>
                ) : (
                  <p className="py-3 text-sm text-slate-300">
                    {lang === 'zh'
                      ? `正在聆听「${seatMap.get(pub.currentSpeakerId ?? '')?.name ?? ''}」发言...`
                      : `Listening to ${seatMap.get(pub.currentSpeakerId ?? '')?.name ?? ''}...`}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'day_vote' && (
              <div>
                {priv.canActNow ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-sm font-bold text-[#F3E09F]">
                      <span className="inline-flex items-center gap-2">
                        <Vote className="h-4 w-4" />
                        {lang === 'zh' ? '请选择放逐投票对象：' : 'Vote to exile a suspect:'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {pub.votedPlayerIds.length}/{pub.aliveIds.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(pub.pkCandidateIds ?? pub.aliveIds).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onAction({ type: 'cast_vote', targetId: id })}
                          className="min-h-[44px] rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500/35"
                        >
                          {seatMap.get(id)?.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'cast_vote', targetId: 'abstain' })}
                        className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300"
                      >
                        {lang === 'zh' ? '弃票' : 'Abstain'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-slate-300">
                    {priv.alive
                      ? lang === 'zh'
                        ? `✓ 已投票，等待其他玩家 (${pub.votedPlayerIds.length}/${pub.aliveIds.length})...`
                        : `✓ Voted, waiting (${pub.votedPlayerIds.length}/${pub.aliveIds.length})...`
                      : lang === 'zh'
                        ? '你已出局，请静观其变'
                        : 'You are eliminated — spectating'}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'hunter_revenge' && (
              <div>
                {priv.canActNow ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                      <Crosshair className="h-4 w-4" />
                      {lang === 'zh' ? '猎人开枪！选择要带走的玩家：' : 'Hunter Shot! Choose target:'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {pub.aliveIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onAction({ type: 'hunter_shoot', targetId: id })}
                          className="min-h-[44px] rounded-xl border border-amber-400/50 bg-amber-500/20 px-3 py-2 text-xs font-bold text-white"
                        >
                          {seatMap.get(id)?.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'hunter_shoot', targetId: null })}
                        className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300"
                      >
                        {lang === 'zh' ? '压枪不打' : 'Hold Fire'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-amber-200">
                    {lang === 'zh' ? '等待倒下的猎人决定是否开枪...' : 'Hunter is choosing a target...'}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'game_over' && (
              <div className="py-3 text-center">
                {(() => {
                  const mySide = priv.role === 'werewolf' ? 'werewolves' : 'villagers';
                  const won = pub.winner === mySide;
                  return (
                    <div className="space-y-1">
                      <div
                        className={`text-base font-black ${
                          won ? 'text-[#F3E09F]' : 'text-slate-300'
                        }`}
                      >
                        {won
                          ? lang === 'zh'
                            ? '🏆 你所在的阵营获得胜利！(+3 积分)'
                            : '🏆 Your side claimed victory! (+3 pts)'
                          : lang === 'zh'
                            ? '🌙 本局惜败，下局再战！'
                            : '🌙 Defeat this round — try again!'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {lang === 'zh'
                          ? '全员身份与毒杀真相已在上方公屏揭晓'
                          : 'All roles & night causes are revealed on the stage above'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {!priv.canActNow &&
              isNight &&
              !(
                pub.phase === 'night_seer' &&
                priv.role === 'seer' &&
                latestSeerCheck?.night === pub.dayNumber
              ) && (
                <p className="py-4 text-center text-sm text-slate-400">
                  {lang === 'zh' ? '夜幕深沉，请静待神职与狼人行动完毕...' : 'Night is in progress...'}
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
