import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  History,
  Shield,
  Skull,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Waves,
  XCircle,
} from 'lucide-react';
import type {
  AvalonPrivateState,
  AvalonPublicState,
  AvalonRole,
} from '../../shared/gameTypes.js';
import type { PlayerSeat, RoomPublicState } from '../../shared/types.js';
import { useI18n } from '../i18n/useI18n.js';
import { soundEngine } from '../audio/soundEngine.js';
import { AvatarBadge } from '../components/AvatarBadge.js';
import { CountdownPill } from '../components/CountdownPill.js';
import { PrivacyPeekCard } from '../components/PrivacyPeekCard.js';

const EVIL_ROLE_SET = new Set<AvalonRole>([
  'morgana',
  'assassin',
  'mordred',
  'oberon',
  'minion',
]);

type DeductionMark = 'unknown' | 'good' | 'evil';

const ROLE_LABELS: Record<
  AvalonRole,
  { zh: string; en: string; shortZh: string; shortEn: string; descZh: string; descEn: string }
> = {
  merlin: {
    zh: '先知 梅林',
    en: 'Merlin',
    shortZh: '梅林',
    shortEn: 'Merlin',
    descZh: '你能洞察大多数邪恶爪牙，但必须隐藏身份以防终局被刺杀。',
    descEn: 'You see Evil (except Mordred). Stay hidden from the Assassin!',
  },
  percival: {
    zh: '骑士 派西维尔',
    en: 'Percival',
    shortZh: '派西维尔',
    shortEn: 'Percival',
    descZh: '你能看见梅林与莫甘娜，请分辨谁才是真正指引正义的梅林。',
    descEn: 'You see Merlin and Morgana—deduce which one is truly Merlin!',
  },
  loyal: {
    zh: '亚瑟忠臣',
    en: 'Loyal Servant of Arthur',
    shortZh: '忠臣',
    shortEn: 'Loyal',
    descZh: '纯粹的正义骑士，通过投票与发言找出潜伏的背叛者。',
    descEn: 'Pure loyalist knight. Deduce allies and pass 3 quests!',
  },
  morgana: {
    zh: '魔女 莫甘娜',
    en: 'Morgana',
    shortZh: '莫甘娜',
    shortEn: 'Morgana',
    descZh: '你在派西维尔视野中伪装成梅林，误导好人出征失败。',
    descEn: 'You appear as Merlin to Percival. Sow confusion and sabotage!',
  },
  assassin: {
    zh: '暗影 刺客',
    en: 'Assassin',
    shortZh: '刺客',
    shortEn: 'Assassin',
    descZh: '若正义完成3次任务，你可拔出匕首刺杀梅林逆转胜局！',
    descEn: 'If Good passes 3 quests, assassinate Merlin to steal victory!',
  },
  mordred: {
    zh: '魔王 莫德雷德',
    en: 'Mordred',
    shortZh: '莫德雷德',
    shortEn: 'Mordred',
    descZh: '梅林的眼睛看不见你，你是深藏于暗影的最致命领袖。',
    descEn: 'Hidden from Merlin’s vision. Infiltrate quests undetected.',
  },
  oberon: {
    zh: '孤狼 奥伯伦',
    en: 'Oberon',
    shortZh: '奥伯伦',
    shortEn: 'Oberon',
    descZh: '你与邪恶同伙互不认识，但梅林看得见你，小心行事。',
    descEn: 'Unknown to Evil allies (and vice versa), though visible to Merlin.',
  },
  minion: {
    zh: '莫德雷德爪牙',
    en: 'Minion of Mordred',
    shortZh: '爪牙',
    shortEn: 'Minion',
    descZh: '与邪恶同伴配合破坏任务，或拖延至5次组队遭否决。',
    descEn: 'Coordinate with fellow Evil agents to fail 3 quests.',
  },
};

function formatRoleGroup(roles: AvalonRole[], lang: 'zh' | 'en'): string {
  const counts = new Map<AvalonRole, number>();
  const order: AvalonRole[] = [];
  for (const r of roles) {
    if (!counts.has(r)) order.push(r);
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return order
    .map((r) => {
      const label = lang === 'zh' ? ROLE_LABELS[r].shortZh : ROLE_LABELS[r].shortEn;
      const n = counts.get(r) ?? 1;
      return n > 1 ? `${label}×${n}` : label;
    })
    .join(' · ');
}

function nextDeductionMark(curr: DeductionMark | undefined): DeductionMark {
  if (!curr || curr === 'unknown') return 'good';
  if (curr === 'good') return 'evil';
  return 'unknown';
}

export const AvalonView: React.FC<{
  room: RoomPublicState;
  pub: AvalonPublicState;
  priv: AvalonPrivateState | null;
  isTvMode: boolean;
  isHost: boolean;
  onAction: (action: Record<string, unknown>) => void;
  onEmit: (event: string) => void;
}> = ({ room, pub, priv, isTvMode, isHost, onAction, onEmit }) => {
  const { lang, pick } = useI18n();
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [ladyTarget, setLadyTarget] = useState<string>('');
  const [assassinTarget, setAssassinTarget] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [deductionNotes, setDeductionNotes] = useState<Record<string, DeductionMark>>({});
  const [revealedCardCount, setRevealedCardCount] = useState(0);
  const [showRevealBanner, setShowRevealBanner] = useState(false);
  const prevPhaseRef = useRef<AvalonPublicState['phase']>(pub.phase);

  const seatMap = new Map<string, PlayerSeat>(room.seats.map((s) => [s.id, s]));
  const currentQuest = pub.quests[pub.questIndex];

  useEffect(() => {
    setSelectedTeam([]);
    setLadyTarget('');
    setAssassinTarget('');
  }, [pub.phase, pub.questIndex, pub.leaderId]);

  useEffect(() => {
    if (prevPhaseRef.current === 'game_over' && pub.phase === 'role_peek') {
      setDeductionNotes({});
    }
    prevPhaseRef.current = pub.phase;
  }, [pub.phase]);

  // Staggered suspenseful Quest Reveal: 0ms, 400ms, 800ms... + cardFlip / swordClash SFX
  useEffect(() => {
    if (pub.phase !== 'quest_reveal' || !pub.lastReveal) {
      setRevealedCardCount(0);
      setShowRevealBanner(false);
      return;
    }

    const cards = pub.lastReveal.cards;
    setRevealedCardCount(0);
    setShowRevealBanner(false);

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    cards.forEach((card, idx) => {
      const t = setTimeout(() => {
        setRevealedCardCount(idx + 1);
        soundEngine.playSfx(card === 'success' ? 'cardFlip' : 'swordClash');
      }, idx * 400);
      timers.push(t);
    });

    const bannerTimer = setTimeout(() => {
      setShowRevealBanner(true);
    }, cards.length * 400);
    timers.push(bannerTimer);

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [pub.phase, pub.lastReveal]);

  const toggleTeamMember = (id: string) => {
    if (!currentQuest) return;
    soundEngine.playSfx('buttonTap');
    setSelectedTeam((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= currentQuest.teamSize) return prev;
      return [...prev, id];
    });
  };

  const cycleNote = (playerId: string) => {
    soundEngine.playSfx('buttonTap');
    setDeductionNotes((prev) => ({
      ...prev,
      [playerId]: nextDeductionMark(prev[playerId]),
    }));
  };

  const phaseTitle = (() => {
    const map: Record<AvalonPublicState['phase'], { zh: string; en: string }> = {
      role_peek: {
        zh: '身份确认阶段：请各位骑士按住查看暗牌',
        en: 'Identity Check: Hold to Peek Your Role',
      },
      team_propose: {
        zh: '队长组队：请挑选出征骑士名单',
        en: 'Team Proposal: Leader Picks Expedition',
      },
      team_vote: {
        zh: '圆桌公开表决：是否同意此队伍出征？',
        en: 'Public Vote: Approve or Reject Team?',
      },
      quest_execute: {
        zh: '圣杯远征：出征队员正在秘密抉择',
        en: 'Quest Execution: Secret Submissions',
      },
      quest_reveal: {
        zh: '圣杯开牌揭晓时刻！',
        en: 'Quest Result Reveal!',
      },
      lady_peek: {
        zh: '湖中仙女赐福：持牌者正在秘密查验阵营',
        en: 'Lady of the Lake: Inspecting True Loyalty',
      },
      assassin_shot: {
        zh: '终局暗杀时刻：刺客正在锁定梅林！',
        en: 'Final Shot: Assassin Hunts Merlin!',
      },
      game_over: {
        zh: '圆桌终局 · 真相大白',
        en: 'Game Over · Roles Revealed',
      },
    };
    return pick(map[pub.phase]);
  })();

  const isEvil = priv?.faction === 'evil';
  const roleDeck = pub.roleDeckSummary ?? [];
  const goodDeck = roleDeck.filter((r) => !EVIL_ROLE_SET.has(r));
  const evilDeck = roleDeck.filter((r) => EVIL_ROLE_SET.has(r));
  const ladyActive = Boolean(pub.ladyHolderId);
  const showLastVoteOnSeats =
    Boolean(pub.lastVoteEntry) &&
    pub.phase !== 'role_peek' &&
    pub.phase !== 'team_vote' &&
    pub.phase !== 'game_over';

  const lastVoteApproveCount = pub.lastVoteEntry
    ? Object.values(pub.lastVoteEntry.votes).filter((v) => v === 'approve').length
    : 0;
  const lastVoteRejectCount = pub.lastVoteEntry
    ? Object.values(pub.lastVoteEntry.votes).filter((v) => v === 'reject').length
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-24 sm:px-6">
      {/* Public Round Table Stage */}
      <div className="gold-border gold-glow rounded-3xl bg-gradient-to-b from-[#13192B]/95 to-[#0C101B]/95 p-4 backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest text-[#D4AF37] uppercase">
                {lang === 'zh' ? '圆桌暗影：圣杯骑士' : 'Crown & Chalice'}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                {lang === 'zh'
                  ? `${room.seats.length}人局 · 第 ${pub.questIndex + 1}/5 圣杯`
                  : `${room.seats.length}P · Quest ${pub.questIndex + 1}/5`}
              </span>
            </div>
            <h2 className="mt-0.5 text-lg font-black text-white sm:text-2xl">{phaseTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <CountdownPill deadline={pub.phaseDeadline} paused={room.status === 'paused'} />
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
            >
              <History className="h-3.5 w-3.5" />
              {lang === 'zh' ? '投票记录' : 'Votes'} ({pub.voteHistory.length})
            </button>
          </div>
        </div>

        {/* Role Deck Summary Strip */}
        {roleDeck.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4AF37]/25 bg-black/35 px-3.5 py-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-0.5 font-bold text-sky-200">
                <Shield className="h-3 w-3" />
                {formatRoleGroup(goodDeck, lang)}
              </span>
              <span className="font-bold text-slate-500">vs</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-0.5 font-bold text-rose-200">
                <Swords className="h-3 w-3" />
                {formatRoleGroup(evilDeck, lang)}
              </span>
            </div>
            {ladyActive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                <span>🌊</span>
                {lang === 'zh' ? '湖中仙女启用' : 'Lady of the Lake'}
              </span>
            )}
          </div>
        )}

        {/* 5 Quest Medallions */}
        <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-4">
          {pub.quests.map((q) => {
            const isCurrent = q.questIndex === pub.questIndex && pub.phase !== 'game_over';
            return (
              <div
                key={q.questIndex}
                className={`relative flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition sm:p-4 ${
                  q.status === 'success'
                    ? 'border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.18)]'
                    : q.status === 'fail'
                      ? 'border-rose-500/70 bg-rose-500/20 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.18)]'
                      : isCurrent
                        ? 'animate-pulse-gold border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30'
                        : 'border-white/10 bg-black/30 text-slate-400'
                }`}
              >
                <span className="text-[10px] font-bold uppercase">
                  {lang === 'zh' ? `任务 ${q.questIndex + 1}` : `Q${q.questIndex + 1}`}
                </span>
                <span className="mt-1 text-xl font-black sm:text-2xl">{q.teamSize}</span>
                {q.requiredFails > 1 && (
                  <span className="mt-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                    {lang === 'zh' ? '需2失败' : '2 Fails'}
                  </span>
                )}
                {q.status === 'success' && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-sky-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-sky-300" />
                    <span>{q.successCount}</span>
                  </div>
                )}
                {q.status === 'fail' && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-200">
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                    <span>
                      {q.failCount} {lang === 'zh' ? '破坏' : 'Fail'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Reject Track (0..5) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-300">
              {lang === 'zh' ? '连续否决进度（满5次邪恶直胜）：' : 'Reject Track (5 = Evil Wins):'}
            </span>
            {pub.rejectTrack >= 4 && pub.phase !== 'game_over' && (
              <span className="animate-pulse rounded-full bg-rose-500/25 px-2 py-0.5 text-[10px] font-extrabold text-rose-200">
                {lang === 'zh' ? '⚠️ 再否决一次邪恶直接获胜！' : '⚠️ 1 reject from Evil victory!'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((pip) => (
              <span
                key={pip}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                  pip <= pub.rejectTrack
                    ? 'bg-rose-500 text-white shadow'
                    : 'border border-white/15 bg-white/5 text-slate-400'
                }`}
              >
                {pip}
              </span>
            ))}
          </div>
        </div>

        {/* Instant Last-Vote Matrix Bar */}
        {pub.lastVoteEntry && pub.phase !== 'role_peek' && pub.phase !== 'game_over' && (
          <div className="mt-3 rounded-2xl border border-[#D4AF37]/30 bg-[#182036]/80 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 font-bold">
                <span className="text-[#F3E09F]">
                  {lang === 'zh'
                    ? `上轮表决 · 任务${pub.lastVoteEntry.questIndex + 1}#${pub.lastVoteEntry.attempt}`
                    : `Last Vote · Q${pub.lastVoteEntry.questIndex + 1} #${pub.lastVoteEntry.attempt}`}
                </span>
                <span className="text-slate-300">
                  ({seatMap.get(pub.lastVoteEntry.leaderId)?.name ?? ''})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                    pub.lastVoteEntry.approved
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {pub.lastVoteEntry.approved
                    ? lang === 'zh'
                      ? `赞成✓ ${lastVoteApproveCount}:${lastVoteRejectCount} 通过`
                      : `Approved ${lastVoteApproveCount}:${lastVoteRejectCount}`
                    : lang === 'zh'
                      ? `反对✕ ${lastVoteApproveCount}:${lastVoteRejectCount} 否决`
                      : `Rejected ${lastVoteApproveCount}:${lastVoteRejectCount}`}
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {room.seats.map((seat) => {
                const v = pub.lastVoteEntry?.votes[seat.id];
                if (!v) return null;
                return (
                  <span
                    key={seat.id}
                    className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${
                      v === 'approve'
                        ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                        : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                    }`}
                  >
                    {seat.name}: {v === 'approve' ? (lang === 'zh' ? '赞成✓' : '✓') : lang === 'zh' ? '反对✕' : '✕'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Staggered Suspenseful Quest Reveal */}
        {pub.phase === 'quest_reveal' && pub.lastReveal && (
          <div className="mt-5 rounded-2xl border border-[#D4AF37]/60 bg-black/55 p-4 text-center shadow-2xl">
            {showRevealBanner ? (
              <div
                className={`animate-card-deal mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-black ${
                  pub.lastReveal.passed
                    ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                    : 'border-rose-500/70 bg-rose-500/25 text-rose-100'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {pub.lastReveal.passed
                  ? lang === 'zh'
                    ? '圣杯闪耀 · 任务成功！'
                    : 'Quest Succeeded!'
                  : lang === 'zh'
                    ? `出现 ${pub.lastReveal.failCount} 张破坏卡 · 任务失败！`
                    : `Quest Failed (${pub.lastReveal.failCount} Sabotage)!`}
              </div>
            ) : (
              <div className="text-sm font-bold text-[#F3E09F]">
                {lang === 'zh'
                  ? `圣杯依次开牌中 (${revealedCardCount}/${pub.lastReveal.cards.length})...`
                  : `Revealing Quest Cards (${revealedCardCount}/${pub.lastReveal.cards.length})...`}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {pub.lastReveal.cards.map((card, i) => {
                const isFlipped = i < revealedCardCount;
                if (!isFlipped) {
                  return (
                    <div
                      key={i}
                      className="flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 border-[#D4AF37]/40 bg-gradient-to-br from-[#1b2236] to-[#0d1018] text-xs font-black text-[#D4AF37]/70 shadow-inner"
                    >
                      <Sparkles className="h-5 w-5 animate-pulse" />
                      <span className="mt-1 text-[10px]">?</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={`animate-flip-in flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 text-xs font-black shadow-xl ${
                      card === 'success'
                        ? 'border-sky-400 bg-sky-950/90 text-sky-200'
                        : 'border-rose-500 bg-rose-950/90 text-rose-200'
                    }`}
                  >
                    {card === 'success' ? (
                      <Shield className="mb-1 h-6 w-6" />
                    ) : (
                      <Skull className="mb-1 h-6 w-6" />
                    )}
                    {card === 'success'
                      ? lang === 'zh'
                        ? '成功'
                        : 'PASS'
                      : lang === 'zh'
                        ? '破坏'
                        : 'FAIL'}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lady of the Lake Public Stage Prompt */}
        {pub.phase === 'lady_peek' && pub.ladyHolderId && (
          <div className="animate-card-deal mt-5 rounded-2xl border border-cyan-400/55 bg-gradient-to-r from-cyan-950/60 via-[#12243a]/80 to-cyan-950/60 p-4 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-200">
              <Waves className="h-4 w-4" />
              {lang === 'zh' ? '🌊 湖中仙女降临' : '🌊 Lady of the Lake Vision'}
            </div>
            <p className="mt-2 text-sm font-bold text-white">
              {lang === 'zh'
                ? `当前持牌者「${seatMap.get(pub.ladyHolderId)?.name ?? ''}」正在秘密查验一名未曾被查验的骑士！`
                : `${seatMap.get(pub.ladyHolderId)?.name ?? ''} is secretly inspecting an untested knight’s loyalty!`}
            </p>
            {pub.ladyHistory && pub.ladyHistory.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-cyan-200/80">
                {pub.ladyHistory.map((h, idx) => (
                  <span key={idx} className="rounded-lg border border-cyan-400/25 bg-black/30 px-2 py-0.5">
                    Q{h.questIndex + 1}: {seatMap.get(h.holderId)?.name} 🌊→{' '}
                    {seatMap.get(h.targetId)?.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assassin Public Stage Prompt */}
        {pub.phase === 'assassin_shot' && (
          <div className="animate-card-deal mt-5 rounded-2xl border border-rose-500/60 bg-rose-950/40 p-4 text-center">
            <div className="text-xs font-bold tracking-widest text-rose-300 uppercase">
              {lang === 'zh' ? '🗡️ 终局刺杀时刻' : '🗡️ Final Assassination'}
            </div>
            <p className="mt-1 text-sm font-bold text-white">
              {lang === 'zh'
                ? `刺客「${seatMap.get(pub.assassinId ?? '')?.name ?? ''}」正在锁定隐藏在圆桌中的梅林...`
                : `Assassin ${seatMap.get(pub.assassinId ?? '')?.name ?? ''} is hunting for Merlin...`}
            </p>
          </div>
        )}

        {/* Game Over Banner */}
        {pub.phase === 'game_over' && (
          <div
            className={`animate-card-deal mt-5 rounded-2xl border p-5 text-center ${
              pub.winner === 'good'
                ? 'border-sky-400/60 bg-sky-500/15'
                : 'border-rose-500/60 bg-rose-500/15'
            }`}
          >
            <div className="text-2xl font-black text-white">
              {pub.winner === 'good'
                ? lang === 'zh'
                  ? '正义阵营胜利！'
                  : 'Loyalists Victory!'
                : lang === 'zh'
                  ? '邪恶阵营胜利！'
                  : 'Evil Victory!'}
            </div>
            <p className="mt-1 text-sm text-slate-200">{pick(pub.winReason)}</p>
            <div className="mt-2 inline-block rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-0.5 text-[11px] font-bold text-[#F3E09F]">
              {lang === 'zh'
                ? '🏆 积分结算：胜方全员 +3 · 梅林守护/刺客狙杀 +1'
                : '🏆 Scoreboard: Winners +3 · Merlin/Assassin Bonus +1'}
            </div>
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

        {/* Knights Ring */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {room.seats.map((seat) => {
            const isLeader = seat.id === pub.leaderId;
            const onTeam = pub.proposedTeamIds.includes(seat.id);
            const isLadyHolder = pub.ladyHolderId === seat.id;
            const isLadyTested = Boolean(pub.ladyTestedIds?.includes(seat.id));
            const isPickedInDraft = Boolean(priv?.canPropose && selectedTeam.includes(seat.id));
            const isLadyDraft = Boolean(priv?.canLadyInspect && ladyTarget === seat.id);
            const isAssassinDraft = Boolean(priv?.canAssassinate && assassinTarget === seat.id);
            const canTapPropose = Boolean(priv?.canPropose);
            const canTapLady = Boolean(
              priv?.canLadyInspect && seat.id !== priv.playerId && !isLadyTested,
            );
            const canTapAssassin = Boolean(priv?.canAssassinate && seat.id !== priv.playerId);
            const canTapSeat = canTapPropose || canTapLady || canTapAssassin;

            const hasDone =
              (pub.phase === 'role_peek' && pub.peekedPlayerIds.includes(seat.id)) ||
              (pub.phase === 'team_vote' && pub.votedPlayerIds.includes(seat.id)) ||
              (pub.phase === 'quest_execute' && pub.questSubmittedIds.includes(seat.id));
            const revealedRole = pub.revealedRoles?.[seat.id];
            const lastSeatVote = showLastVoteOnSeats
              ? pub.lastVoteEntry?.votes[seat.id]
              : undefined;
            const note = deductionNotes[seat.id] ?? 'unknown';

            const badge = revealedRole
              ? lang === 'zh'
                ? ROLE_LABELS[revealedRole].zh
                : ROLE_LABELS[revealedRole].en
              : isPickedInDraft
                ? lang === 'zh'
                  ? '✓ 已选出征'
                  : '✓ Picked'
                : isLeader
                  ? lang === 'zh'
                    ? '👑 当前队长'
                    : '👑 Leader'
                  : onTeam
                    ? lang === 'zh'
                      ? '⚔️ 出征队员'
                      : '⚔️ On Quest'
                    : hasDone
                      ? '✓'
                      : undefined;

            const handleSeatTap = () => {
              if (canTapPropose) {
                toggleTeamMember(seat.id);
              } else if (canTapLady) {
                soundEngine.playSfx('buttonTap');
                setLadyTarget(seat.id);
              } else if (canTapAssassin) {
                soundEngine.playSfx('buttonTap');
                setAssassinTarget(seat.id);
              }
            };

            return (
              <div
                key={seat.id}
                role={canTapSeat ? 'button' : undefined}
                tabIndex={canTapSeat ? 0 : undefined}
                onClick={canTapSeat ? handleSeatTap : undefined}
                onKeyDown={
                  canTapSeat
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSeatTap();
                        }
                      }
                    : undefined
                }
                className={`relative flex flex-col items-center rounded-2xl border p-2.5 transition ${
                  canTapSeat ? 'cursor-pointer hover:border-[#D4AF37]/80' : ''
                } ${
                  isPickedInDraft
                    ? 'border-[#D4AF37] bg-[#D4AF37]/25 ring-2 ring-[#D4AF37]/40'
                    : isLadyDraft
                      ? 'border-cyan-400 bg-cyan-500/20 ring-2 ring-cyan-400/40'
                      : isAssassinDraft
                        ? 'border-rose-500 bg-rose-500/25 ring-2 ring-rose-500/40'
                        : onTeam
                          ? 'border-[#D4AF37] bg-[#D4AF37]/15'
                          : isLeader
                            ? 'border-sky-400/50 bg-sky-500/10'
                            : 'border-white/10 bg-black/25'
                }`}
              >
                {/* Lady & Shot Micro Badges */}
                {(isLadyHolder || isLadyTested || (pub.phase === 'game_over' && pub.assassinTargetId === seat.id)) && (
                  <div className="mb-1 flex flex-wrap items-center justify-center gap-1">
                    {isLadyHolder && (
                      <span
                        title={lang === 'zh' ? '湖中仙女持牌者' : 'Lady of the Lake Holder'}
                        className="rounded-full border border-cyan-400/60 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200"
                      >
                        🌊
                      </span>
                    )}
                    {isLadyTested && (
                      <span
                        title={lang === 'zh' ? '已被湖中仙女查验' : 'Tested by Lady of the Lake'}
                        className="rounded-full border border-teal-400/45 bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-200"
                      >
                        ✓ {lang === 'zh' ? '已验' : 'Tested'}
                      </span>
                    )}
                    {pub.phase === 'game_over' && pub.assassinTargetId === seat.id && (
                      <span className="rounded-full border border-rose-400/60 bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                        🎯 {lang === 'zh' ? '刺杀' : 'Shot'}
                      </span>
                    )}
                  </div>
                )}

                <AvatarBadge
                  seat={seat}
                  size="sm"
                  isMe={seat.id === priv?.playerId}
                  highlight={isLeader || onTeam || isPickedInDraft}
                  subLabel={badge}
                />

                {/* Last Vote Matrix Badge on Seat */}
                {lastSeatVote && (
                  <span
                    className={`mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      lastSeatVote === 'approve'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {lastSeatVote === 'approve'
                      ? lang === 'zh'
                        ? '赞成✓'
                        : 'Approve✓'
                      : lang === 'zh'
                        ? '反对✕'
                        : 'Reject✕'}
                  </span>
                )}

                {/* Revealed Role Card on Game Over */}
                {revealedRole && (
                  <img
                    src={`/images/roles/${revealedRole}.webp`}
                    alt={revealedRole}
                    className="mt-2 h-16 w-12 rounded-lg border border-[#D4AF37]/50 object-cover shadow"
                  />
                )}

                {/* Non-TV Private Local Deduction Note Pill */}
                {!isTvMode && (
                  <button
                    type="button"
                    title={lang === 'zh' ? '个人推理标记（仅自己可见）' : 'Private Deduction Note'}
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleNote(seat.id);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className={`mt-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${
                      note === 'good'
                        ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                        : note === 'evil'
                          ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                          : 'border-white/15 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {note === 'good' ? '🛡️' : note === 'evil' ? '⚠️' : '?'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Vote History Drawer */}
        {showHistory && pub.voteHistory.length > 0 && (
          <div className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-xs">
            {pub.voteHistory.map((vh, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-2.5">
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {lang === 'zh'
                      ? `任务 ${vh.questIndex + 1} · 第${vh.attempt}次提名 (${seatMap.get(vh.leaderId)?.name ?? ''})`
                      : `Quest ${vh.questIndex + 1} #${vh.attempt} (${seatMap.get(vh.leaderId)?.name ?? ''})`}
                  </span>
                  <span className={vh.approved ? 'text-emerald-400' : 'text-rose-400'}>
                    {vh.approved
                      ? lang === 'zh'
                        ? '通过'
                        : 'Approved'
                      : lang === 'zh'
                        ? '否决'
                        : 'Rejected'}
                  </span>
                </div>
                <div className="mt-1 text-slate-300">
                  {lang === 'zh' ? '队伍: ' : 'Team: '}
                  {vh.teamIds.map((id) => seatMap.get(id)?.name).join('、')}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(vh.votes).map(([pid, v]) => (
                    <span
                      key={pid}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        v === 'approve'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-rose-500/20 text-rose-200'
                      }`}
                    >
                      {seatMap.get(pid)?.name}: {v === 'approve' ? '✓' : '✕'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Private Player Hand & Controls */}
      {!isTvMode && priv && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <PrivacyPeekCard
              title={lang === 'zh' ? '你的绝密身份' : 'Your Secret Role'}
              subtitle={
                priv.ladyKnowledge && priv.ladyKnowledge.length > 0
                  ? lang === 'zh'
                    ? '内含身份与湖中仙女查验情报 · 松手即隐藏'
                    : 'Includes Role & Lady Intel · Release to Hide'
                  : undefined
              }
              accentColor={isEvil ? '#F43F5E' : '#38BDF8'}
            >
              <div className="flex flex-col items-center gap-2.5 text-center sm:flex-row sm:text-left">
                <img
                  src={`/images/roles/${priv.role}.webp`}
                  alt={priv.role}
                  className="aspect-[3/4] w-24 shrink-0 rounded-xl border border-[#D4AF37]/60 object-cover shadow-xl"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div
                    className={`inline-block rounded-full px-3 py-0.5 text-xs font-extrabold ${
                      isEvil ? 'bg-rose-500/25 text-rose-200' : 'bg-sky-500/25 text-sky-200'
                    }`}
                  >
                    {isEvil
                      ? lang === 'zh'
                        ? '邪恶阵营'
                        : 'Evil Faction'
                      : lang === 'zh'
                        ? '正义阵营'
                        : 'Good Faction'}
                  </div>
                  <h3 className="text-xl font-black text-white">
                    {lang === 'zh' ? ROLE_LABELS[priv.role].zh : ROLE_LABELS[priv.role].en}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {lang === 'zh'
                      ? ROLE_LABELS[priv.role].descZh
                      : ROLE_LABELS[priv.role].descEn}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-center">
                {priv.visionPlayers.length > 0 && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-2.5 text-left">
                    <div className="text-[11px] font-bold text-[#F3E09F]">
                      {lang === 'zh' ? '你的夜视情报：' : 'Night Vision:'}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {priv.visionPlayers.map((vp) => (
                        <span
                          key={vp.playerId}
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white"
                        >
                          {seatMap.get(vp.playerId)?.name} · {pick(vp.label)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {priv.ladyKnowledge && priv.ladyKnowledge.length > 0 && (
                  <div className="mt-2 rounded-xl border border-cyan-400/35 bg-cyan-950/35 p-2.5 text-left">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-200">
                      <Waves className="h-3.5 w-3.5" />
                      {lang === 'zh' ? '湖中仙女绝密查验：' : 'Lady of the Lake Intel:'}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {priv.ladyKnowledge.map((lk, idx) => (
                        <span
                          key={`${lk.targetId}-${idx}`}
                          className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                            lk.faction === 'evil'
                              ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                              : 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                          }`}
                        >
                          Q{lk.questIndex + 1} · {seatMap.get(lk.targetId)?.name}:{' '}
                          {lk.faction === 'evil'
                            ? lang === 'zh'
                              ? '💀 邪恶'
                              : '💀 Evil'
                            : lang === 'zh'
                              ? '🛡️ 正义'
                              : '🛡️ Good'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PrivacyPeekCard>
          </div>

          <div className="gold-border flex flex-col justify-center rounded-2xl bg-[#121724]/95 p-4 lg:col-span-7">
            {pub.phase === 'role_peek' && (
              <div className="text-center">
                {priv.hasPeeked ? (
                  <p className="text-sm font-semibold text-emerald-300">
                    {lang === 'zh'
                      ? '✓ 你已确认身份，等待其他骑士...'
                      : '✓ Ready — waiting for others...'}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'peek_ready' })}
                    className="min-h-[48px] w-full rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-[#0B0D13]"
                  >
                    {lang === 'zh' ? '我已看清身份，准备开始' : 'I Know My Role · Ready'}
                  </button>
                )}
              </div>
            )}

            {pub.phase === 'team_propose' && (
              <div>
                {priv.canPropose && currentQuest ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-[#F3E09F]">
                      <span className="flex items-center gap-1.5">
                        <Crown className="h-4 w-4" />
                        {lang === 'zh'
                          ? `你是队长！请选择 ${currentQuest.teamSize} 名骑士出征`
                          : `You are Leader! Select ${currentQuest.teamSize} knights`}
                      </span>
                      <span>
                        {selectedTeam.length}/{currentQuest.teamSize}
                      </span>
                    </div>

                    {/* Quick 1-Tap Include Me & Clear Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={
                          !selectedTeam.includes(priv.playerId) &&
                          selectedTeam.length >= currentQuest.teamSize
                        }
                        onClick={() => toggleTeamMember(priv.playerId)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                          selectedTeam.includes(priv.playerId)
                            ? 'border-[#D4AF37] bg-[#D4AF37]/25 text-[#F3E09F]'
                            : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {selectedTeam.includes(priv.playerId)
                          ? lang === 'zh'
                            ? '✓ 已带上自己'
                            : '✓ Me Included'
                          : lang === 'zh'
                            ? '带上我自己'
                            : 'Include Me'}
                      </button>
                      <span className="text-[11px] text-slate-400">
                        {lang === 'zh'
                          ? '可点击圆桌席位或下方名单'
                          : 'Tap seats above or buttons below'}
                      </span>
                      {selectedTeam.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playSfx('buttonTap');
                            setSelectedTeam([]);
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                        >
                          {lang === 'zh' ? '清空' : 'Clear'}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {room.seats.map((s) => {
                        const checked = selectedTeam.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleTeamMember(s.id)}
                            className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                              checked
                                ? 'border-[#D4AF37] bg-[#D4AF37]/25 text-white'
                                : 'border-white/10 bg-white/5 text-slate-300'
                            }`}
                          >
                            {checked ? '✓ ' : ''}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={selectedTeam.length !== currentQuest.teamSize}
                      onClick={() => onAction({ type: 'propose_team', teamIds: selectedTeam })}
                      className="min-h-[48px] w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#0B0D13] disabled:opacity-40"
                    >
                      <Swords className="mr-1.5 inline h-4 w-4" />
                      {lang === 'zh' ? '提交出征名单并全员表决' : 'Submit Team for Vote'}
                    </button>
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-slate-300">
                    {lang === 'zh'
                      ? `等待队长「${seatMap.get(pub.leaderId)?.name ?? ''}」挑选出征队员...`
                      : `Waiting for Leader ${seatMap.get(pub.leaderId)?.name ?? ''} to propose...`}
                  </div>
                )}
              </div>
            )}

            {pub.phase === 'team_vote' && (
              <div className="space-y-3">
                <div className="text-center text-xs text-slate-300">
                  {lang === 'zh' ? '当前提议出征队伍：' : 'Proposed Team: '}
                  <strong className="text-[#F3E09F]">
                    {pub.proposedTeamIds.map((id) => seatMap.get(id)?.name).join(' · ')}
                  </strong>
                </div>
                {priv.hasVoted ? (
                  <p className="py-3 text-center text-sm font-semibold text-emerald-300">
                    {lang === 'zh' ? '✓ 已投票，等待他人...' : '✓ Vote cast, waiting...'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'cast_vote', vote: 'approve' })}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {lang === 'zh' ? '赞成出征' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'cast_vote', vote: 'reject' })}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-black text-white hover:bg-rose-500"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      {lang === 'zh' ? '反对否决' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {pub.phase === 'quest_execute' && (
              <div className="space-y-3">
                {pub.proposedTeamIds.includes(priv.playerId) ? (
                  priv.hasSubmittedQuest ? (
                    <p className="py-3 text-center text-sm font-semibold text-emerald-300">
                      {lang === 'zh' ? '✓ 已投出任务卡，等待其余队员...' : '✓ Card submitted...'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'submit_quest', card: 'success' })}
                        className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-sky-400 bg-sky-500/25 py-3 text-sm font-black text-sky-100 hover:bg-sky-500/40"
                      >
                        <Shield className="h-5 w-5" />
                        {lang === 'zh' ? '任务成功' : 'Success'}
                      </button>
                      <button
                        type="button"
                        disabled={!isEvil}
                        onClick={() => onAction({ type: 'submit_quest', card: 'fail' })}
                        className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-rose-500 bg-rose-500/25 py-3 text-sm font-black text-rose-100 hover:bg-rose-500/40 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Skull className="h-5 w-5" />
                        {isEvil
                          ? lang === 'zh'
                            ? '暗中破坏'
                            : 'Sabotage'
                          : lang === 'zh'
                            ? '好人不可破坏'
                            : 'Good Only Passes'}
                      </button>
                    </div>
                  )
                ) : (
                  <p className="py-4 text-center text-sm text-slate-300">
                    {lang === 'zh'
                      ? '你不在本次出征队伍中，请耐心等待开牌...'
                      : 'Waiting for the expedition team...'}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'lady_peek' && (
              <div>
                {priv.canLadyInspect ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-cyan-200">
                      <Waves className="h-4 w-4" />
                      {lang === 'zh'
                        ? '🌊 你持有湖中仙女！请选择一位未查验的玩家洞察阵营：'
                        : '🌊 Lady of the Lake: Select an untested knight to inspect:'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {room.seats
                        .filter((s) => s.id !== priv.playerId)
                        .map((s) => {
                          const alreadyTested = Boolean(pub.ladyTestedIds?.includes(s.id));
                          const picked = ladyTarget === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={alreadyTested}
                              onClick={() => {
                                soundEngine.playSfx('buttonTap');
                                setLadyTarget(s.id);
                              }}
                              className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                picked
                                  ? 'border-cyan-400 bg-cyan-500/30 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-300'
                              }`}
                            >
                              <div>{s.name}</div>
                              {alreadyTested && (
                                <div className="text-[10px] font-normal text-teal-300">
                                  {lang === 'zh' ? '✓ 已查验' : '✓ Tested'}
                                </div>
                              )}
                            </button>
                          );
                        })}
                    </div>
                    <button
                      type="button"
                      disabled={!ladyTarget}
                      onClick={() => onAction({ type: 'lady_inspect', targetId: ladyTarget })}
                      className="min-h-[48px] w-full rounded-xl bg-cyan-400 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                    >
                      {lang === 'zh'
                        ? '🌊 查验此人阵营并传递仙女牌'
                        : '🌊 Inspect Loyalty & Pass Token'}
                    </button>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-cyan-200">
                    {lang === 'zh'
                      ? `🌊 「${seatMap.get(pub.ladyHolderId ?? '')?.name ?? ''}」正在使用湖中仙女查验一名骑士...`
                      : `🌊 ${seatMap.get(pub.ladyHolderId ?? '')?.name ?? ''} is inspecting a knight with the Lady of the Lake...`}
                  </p>
                )}
              </div>
            )}

            {pub.phase === 'assassin_shot' && (
              <div>
                {priv.canAssassinate ? (
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-rose-300">
                      {lang === 'zh'
                        ? '拔出你的匕首！请指认你认为的「梅林」：'
                        : 'Draw your blade! Select who you believe is Merlin:'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {room.seats
                        .filter((s) => s.id !== priv.playerId)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setAssassinTarget(s.id)}
                            className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold ${
                              assassinTarget === s.id
                                ? 'border-rose-500 bg-rose-500/30 text-white'
                                : 'border-white/10 bg-white/5 text-slate-300'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      disabled={!assassinTarget}
                      onClick={() => onAction({ type: 'assassinate', targetId: assassinTarget })}
                      className="min-h-[48px] w-full rounded-xl bg-rose-600 py-3 text-sm font-black text-white disabled:opacity-40"
                    >
                      {lang === 'zh' ? '锁定目标并执行刺杀！' : 'Assassinate Target!'}
                    </button>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-rose-200">
                    {lang === 'zh'
                      ? '刺客正在凝视圆桌，寻找梅林的踪迹...'
                      : 'The Assassin is choosing their final target...'}
                  </p>
                )}
              </div>
            )}

            {(pub.phase === 'quest_reveal' || pub.phase === 'game_over') && (
              <p className="py-4 text-center text-sm text-slate-300">
                {lang === 'zh' ? '请查看上方公共圆桌舞台揭晓！' : 'Watch the main stage above!'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
