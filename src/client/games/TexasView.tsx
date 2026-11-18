import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Coins, Crown, Flame, Sparkles, Trophy, X } from 'lucide-react';
import type {
  PlayingCard,
  TexasPrivateState,
  TexasPublicState,
} from '../../shared/gameTypes.js';
import type { PlayerSeat, RoomPublicState } from '../../shared/types.js';
import { formatRank } from '../../shared/pokerEvaluator.js';
import { useI18n } from '../i18n/useI18n.js';
import { soundEngine } from '../audio/soundEngine.js';
import { AvatarBadge } from '../components/AvatarBadge.js';
import { CountdownPill } from '../components/CountdownPill.js';
import { PrivacyPeekCard } from '../components/PrivacyPeekCard.js';

const SUIT_META: Record<PlayingCard['suit'], { symbol: string; colorClass: string }> = {
  spades: { symbol: '♠', colorClass: 'text-slate-900' },
  clubs: { symbol: '♣', colorClass: 'text-slate-900' },
  hearts: { symbol: '♥', colorClass: 'text-rose-600' },
  diamonds: { symbol: '♦', colorClass: 'text-rose-600' },
};

const HAND_RANKINGS_GUIDE: Array<{
  rank: number;
  zh: string;
  en: string;
  sample: string;
  descZh: string;
  descEn: string;
}> = [
  {
    rank: 1,
    zh: '皇家同花顺',
    en: 'Royal Flush',
    sample: 'A♠ K♠ Q♠ J♠ 10♠',
    descZh: '同花色 A-K-Q-J-10，至高无上',
    descEn: 'Ace-high straight of the same suit',
  },
  {
    rank: 2,
    zh: '同花顺',
    en: 'Straight Flush',
    sample: '9♥ 8♥ 7♥ 6♥ 5♥',
    descZh: '五张同花色且点数相连',
    descEn: 'Five consecutive cards of the same suit',
  },
  {
    rank: 3,
    zh: '四条（金刚）',
    en: 'Four of a Kind',
    sample: 'Q♠ Q♥ Q♦ Q♣ A♠',
    descZh: '四张同点数牌 + 一张踢脚牌',
    descEn: 'Four cards of matching rank + kicker',
  },
  {
    rank: 4,
    zh: '葫芦（满堂红）',
    en: 'Full House',
    sample: 'K♠ K♥ K♦ 5♣ 5♠',
    descZh: '三张同点数 + 一对同点数',
    descEn: 'Three of a kind plus a pair',
  },
  {
    rank: 5,
    zh: '同花',
    en: 'Flush',
    sample: 'A♦ J♦ 8♦ 5♦ 2♦',
    descZh: '任意五张同花色，按最大牌比大小',
    descEn: 'Any five cards of the same suit',
  },
  {
    rank: 6,
    zh: '顺子',
    en: 'Straight',
    sample: '10♠ 9♦ 8♣ 7♥ 6♠',
    descZh: '五张不同花色的连续点数（A-2-3-4-5 最小）',
    descEn: 'Five consecutive ranks of mixed suits',
  },
  {
    rank: 7,
    zh: '三条',
    en: 'Three of a Kind',
    sample: '8♠ 8♥ 8♣ A♦ J♠',
    descZh: '三张同点数 + 两张单牌',
    descEn: 'Three cards of the same rank',
  },
  {
    rank: 8,
    zh: '两对',
    en: 'Two Pair',
    sample: 'Q♠ Q♥ 6♦ 6♣ A♠',
    descZh: '两组不同点数的对子 + 一张踢脚',
    descEn: 'Two distinct pairs plus a kicker',
  },
  {
    rank: 9,
    zh: '一对',
    en: 'One Pair',
    sample: 'J♠ J♥ A♦ 9♣ 5♠',
    descZh: '两张同点数 + 三张单牌',
    descEn: 'Two matching cards plus three kickers',
  },
  {
    rank: 10,
    zh: '高牌',
    en: 'High Card',
    sample: 'A♠ Q♥ 10♦ 7♣ 4♠',
    descZh: '未成以上牌型时，由最大单牌依次比大小',
    descEn: 'Highest card plays when no hand is made',
  },
];

function isSameCard(a: PlayingCard, b: PlayingCard): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

function hasCard(list: PlayingCard[] | undefined, target: PlayingCard): boolean {
  return Boolean(list?.some((c) => isSameCard(c, target)));
}

const CardFace: React.FC<{
  card: PlayingCard;
  small?: boolean;
  winningGlow?: boolean;
  bestFiveGlow?: boolean;
  dimmed?: boolean;
  flipIn?: boolean;
  dealIn?: boolean;
}> = ({ card, small, winningGlow, bestFiveGlow, dimmed, flipIn, dealIn }) => {
  const meta = SUIT_META[card.suit];
  const frameClass = winningGlow
    ? 'border-2 border-[#D4AF37] ring-2 ring-[#D4AF37]/80 shadow-[0_0_22px_rgba(212,175,55,0.65)] scale-[1.04] animate-flip-in'
    : bestFiveGlow
      ? 'border-2 border-[#D4AF37] ring-2 ring-[#D4AF37]/65 shadow-[0_0_16px_rgba(212,175,55,0.48)]'
      : 'border border-slate-300 shadow-lg';

  const animClass = !winningGlow && flipIn
    ? 'animate-flip-in'
    : !winningGlow && dealIn
      ? 'animate-card-deal'
      : '';

  return (
    <div
      className={`relative flex flex-col items-center justify-between rounded-xl bg-gradient-to-br from-[#FFFDF9] to-[#EDE9DE] font-black transition-all select-none ${
        small ? 'h-14 w-10 p-1 text-xs' : 'h-20 w-14 p-1.5 text-base sm:h-24 sm:w-16 sm:text-lg'
      } ${meta.colorClass} ${frameClass} ${animClass} ${dimmed ? 'opacity-55 saturate-75' : ''}`}
    >
      {(winningGlow || bestFiveGlow) && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#0B0D13] bg-[#D4AF37] text-[9px] font-black text-[#0B0D13] shadow"
          aria-hidden="true"
        >
          ★
        </span>
      )}
      <span className="self-start leading-none">{formatRank(card.rank)}</span>
      <span className={small ? 'text-base leading-none' : 'text-2xl leading-none'}>
        {meta.symbol}
      </span>
      <span className="self-end leading-none">{formatRank(card.rank)}</span>
    </div>
  );
};

const CardSlotPlaceholder: React.FC = () => (
  <div className="flex h-20 w-14 items-center justify-center rounded-xl border border-dashed border-emerald-400/25 bg-black/25 text-xs text-emerald-500/40 sm:h-24 sm:w-16">
    ✦
  </div>
);

export const TexasView: React.FC<{
  room: RoomPublicState;
  pub: TexasPublicState;
  priv: TexasPrivateState | null;
  isTvMode: boolean;
  isHost: boolean;
  onAction: (action: Record<string, unknown>) => void;
  onEmit: (event: string) => void;
}> = ({ room, pub, priv, isTvMode, isHost, onAction, onEmit }) => {
  const { lang, pick } = useI18n();
  const seatMap = new Map<string, PlayerSeat>(room.seats.map((s) => [s.id, s]));
  const [raiseAmount, setRaiseAmount] = useState<number>(priv?.minRaiseTo ?? 40);
  const [showRankings, setShowRankings] = useState(false);

  const bigBlind = Math.max(1, pub.currentBigBlind ?? 20);
  const smallBlind = Math.max(1, pub.currentSmallBlind ?? Math.round(bigBlind / 2));
  const blindIncreaseEvery = Number(room.gameOptions?.blindIncreaseEveryHands ?? 0);

  useEffect(() => {
    if (priv) {
      setRaiseAmount(priv.minRaiseTo);
    }
  }, [priv?.minRaiseTo, pub.phase, pub.activePlayerId]);

  const phaseLabel = (() => {
    const map: Record<TexasPublicState['phase'], { zh: string; en: string }> = {
      preflop: { zh: '翻前圈 Preflop', en: 'Preflop Betting' },
      flop: { zh: '翻牌圈 Flop', en: 'The Flop' },
      turn: { zh: '转牌圈 Turn', en: 'The Turn' },
      river: { zh: '河牌圈 River', en: 'The River' },
      showdown: { zh: '亮牌比拼 Showdown', en: 'Showdown' },
      game_over: { zh: '锦标赛终局 Champions', en: 'Tournament Over' },
    };
    return pick(map[pub.phase]);
  })();

  const myPublicPlayer = pub.players.find((p) => p.playerId === priv?.playerId);
  const canShowBluff =
    !isTvMode &&
    pub.phase === 'showdown' &&
    Boolean(priv && priv.holeCards.length === 2) &&
    !myPublicPlayer?.revealedCards;

  const showdownWinningCards = (pub.showdownResults ?? []).flatMap(
    (r) => r.winningFiveCards ?? [],
  );
  const hasShowdownHighlight = pub.phase === 'showdown' && showdownWinningCards.length > 0;
  const showdownWinnerIds = new Set(
    (pub.showdownResults ?? []).flatMap((r) => r.winnerIds),
  );

  const shouldHighlightHoleBestFive = Boolean(
    priv &&
      (pub.communityCards.length >= 3 ||
        (priv.holeCards.length === 2 && priv.holeCards[0].rank === priv.holeCards[1].rank)),
  );

  const clampRaise = (val: number) => {
    if (!priv) return val;
    return Math.min(priv.maxRaiseTo, Math.max(priv.minRaiseTo, Math.round(val)));
  };

  const rankings =
    pub.rankings ??
    [...pub.players]
      .map((p) => ({
        playerId: p.playerId,
        chips: p.chips,
        rebuyCount: p.rebuyCount ?? 0,
        netProfit: p.chips - (p.totalBuyIn ?? p.chips),
      }))
      .sort((a, b) => (b.netProfit !== a.netProfit ? b.netProfit - a.netProfit : b.chips - a.chips));

  const formatNetProfit = (profit: number) => {
    if (profit > 0) return `+¥${profit}`;
    if (profit < 0) return `-¥${Math.abs(profit)}`;
    return '¥0';
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-24 sm:px-6">
      {/* Emerald Felt Table Stage */}
      <div className="gold-border rounded-3xl bg-gradient-to-b from-[#0C352A]/95 via-[#092820]/95 to-[#0B0D13]/95 p-4 shadow-2xl backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest text-emerald-300 uppercase">
                {lang === 'zh'
                  ? `皇家德州 · 第 ${pub.handNumber} 手牌`
                  : `Royal Hold'em · Hand #${pub.handNumber}`}
              </span>
              <span className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-extrabold text-[#F3E09F]">
                {lang === 'zh'
                  ? `盲注 ¥${smallBlind}/¥${bigBlind}`
                  : `Blinds ¥${smallBlind}/¥${bigBlind}`}
                {blindIncreaseEvery > 0 &&
                  (lang === 'zh'
                    ? ` · 每${blindIncreaseEvery}手升盲`
                    : ` · ↑/${blindIncreaseEvery}h`)}
              </span>
            </div>
            <h2 className="mt-0.5 text-lg font-black text-white sm:text-2xl">{phaseLabel}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playSfx('buttonTap');
                setShowRankings(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:border-[#D4AF37]/60 hover:bg-emerald-900/60"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>{lang === 'zh' ? '牌型大小速查' : 'Hand Rankings'}</span>
            </button>
            <CountdownPill deadline={pub.phaseDeadline} paused={room.status === 'paused'} />
          </div>
        </div>

        {/* Center Pot & Community Cards */}
        <div className="mt-5 flex flex-col items-center rounded-3xl border border-[#D4AF37]/30 bg-black/35 px-4 py-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/20 px-4 py-1 text-sm font-black text-[#F3E09F] shadow">
              <Coins className="h-4 w-4 text-[#D4AF37]" />
              {lang === 'zh' ? '总底池' : 'TOTAL POT'}: ¥{pub.pot}
              <span className="ml-1 text-[11px] font-bold text-[#F3E09F]/75">
                ({Math.round(pub.pot / bigBlind)} BB)
              </span>
            </span>
            {pub.sidePots.length > 1 &&
              pub.sidePots.map((sp, i) => {
                const eligibleNames = sp.eligibleIds
                  .map((id) => seatMap.get(id)?.name)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ');
                return (
                  <span
                    key={i}
                    className="rounded-full border border-emerald-400/25 bg-emerald-950/60 px-3 py-0.5 text-[11px] font-semibold text-emerald-100"
                  >
                    {i === 0
                      ? lang === 'zh'
                        ? '主池'
                        : 'Main'
                      : lang === 'zh'
                        ? `边池 ${i}`
                        : `Side ${i}`}
                    : ¥{sp.amount}
                    {sp.eligibleIds.length > 0 && (
                      <span className="ml-1 text-emerald-300/80">
                        · {sp.eligibleIds.length === 1
                          ? lang === 'zh'
                            ? '退还未跟注'
                            : 'Uncalled'
                          : `${sp.eligibleIds.length}${lang === 'zh' ? '人' : 'p'} (${eligibleNames}${sp.eligibleIds.length > 3 ? '…' : ''})`}
                      </span>
                    )}
                  </span>
                );
              })}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3">
            {[0, 1, 2, 3, 4].map((idx) => {
              const card = pub.communityCards[idx];
              if (!card) return <CardSlotPlaceholder key={idx} />;
              const isWinCard = hasShowdownHighlight && hasCard(showdownWinningCards, card);
              return (
                <CardFace
                  key={`${idx}-${card.rank}-${card.suit}`}
                  card={card}
                  dealIn={!isWinCard}
                  winningGlow={isWinCard}
                  dimmed={hasShowdownHighlight && !isWinCard}
                />
              );
            })}
          </div>

          {/* Showdown Winners Banner */}
          {pub.phase === 'showdown' && pub.showdownResults && (
            <div className="mt-4 w-full max-w-2xl space-y-2.5 rounded-2xl border border-[#D4AF37]/50 bg-black/65 p-3.5 text-center shadow-xl">
              {pub.showdownResults.map((res) => (
                <div key={res.potIndex} className="text-xs sm:text-sm">
                  {pub.showdownResults && pub.showdownResults.length > 1 && (
                    <span className="mr-1.5 rounded bg-[#D4AF37]/20 px-1.5 py-0.5 text-[10px] font-extrabold text-[#F3E09F]">
                      {res.potIndex === 0
                        ? lang === 'zh'
                          ? '主池'
                          : 'Main'
                        : lang === 'zh'
                          ? `边池 ${res.potIndex}`
                          : `Side ${res.potIndex}`}
                    </span>
                  )}
                  <span className="font-bold text-[#F3E09F]">
                    {res.winnerIds.map((id) => seatMap.get(id)?.name).join(' & ')}
                  </span>{' '}
                  {lang === 'zh' ? `赢得 ¥${res.amount}` : `won ¥${res.amount}`} ·{' '}
                  <span className="font-semibold text-emerald-300">{pick(res.handLabel)}</span>
                </div>
              ))}

              {(canShowBluff || isHost) && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {canShowBluff && (
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'reveal_bluff' })}
                      className="rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-1.5 text-xs font-black text-emerald-200 transition hover:bg-emerald-500/35"
                    >
                      {lang === 'zh' ? '🃏 亮底牌秀全场' : '🃏 Show Cards'}
                    </button>
                  )}
                  {isHost && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'next_hand' })}
                        className="rounded-xl bg-[#D4AF37] px-4 py-1.5 text-xs font-black text-[#0B0D13] transition hover:bg-[#E7C85B]"
                      >
                        {lang === 'zh' ? '立即发下一手牌' : 'Deal Next Hand'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'settle_session' })}
                        className="rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-4 py-1.5 text-xs font-black text-[#F3E09F] transition hover:bg-[#D4AF37]/30"
                      >
                        {lang === 'zh' ? '🏆 结算筹码排名' : '🏆 Settle Session'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Game Over Net Profit Podium */}
          {pub.phase === 'game_over' && (
            <div className="mt-5 w-full max-w-2xl space-y-3 rounded-2xl border border-[#D4AF37]/60 bg-gradient-to-b from-[#171B2B]/95 to-[#0B0D13]/95 p-4 shadow-2xl">
              <div className="flex items-center justify-center gap-2 text-base font-black text-[#F3E09F] sm:text-lg">
                <Trophy className="h-5 w-5 text-[#D4AF37]" />
                {lang === 'zh'
                  ? '锦标赛终局 · 筹码净盈亏榜'
                  : 'Final Settlement · Net Profit Standings'}
              </div>

              <div className="space-y-2">
                {rankings.map((r, idx) => {
                  const seat = seatMap.get(r.playerId);
                  const rank = idx + 1;
                  const rankColors =
                    rank === 1
                      ? 'border-[#D4AF37]/70 bg-[#D4AF37]/15'
                      : rank === 2
                        ? 'border-slate-300/40 bg-white/8'
                        : rank === 3
                          ? 'border-amber-600/50 bg-amber-900/15'
                          : 'border-white/10 bg-black/35';
                  const rankBadge =
                    rank === 1
                      ? 'bg-[#D4AF37] text-[#0B0D13]'
                      : rank === 2
                        ? 'bg-slate-200 text-slate-900'
                        : rank === 3
                          ? 'bg-amber-600 text-white'
                          : 'bg-white/10 text-slate-300';
                  const bonusPts = rank <= 3 ? 4 - rank : 0;

                  return (
                    <div
                      key={r.playerId}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${rankColors}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${rankBadge}`}
                        >
                          {rank === 1 ? <Crown className="h-4 w-4" /> : `#${rank}`}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                            <span>{seat?.name ?? r.playerId}</span>
                            {r.playerId === priv?.playerId && (
                              <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] text-emerald-300">
                                {lang === 'zh' ? '你' : 'You'}
                              </span>
                            )}
                            {bonusPts > 0 && (
                              <span className="rounded-full bg-[#D4AF37]/20 px-1.5 py-0.5 text-[10px] font-black text-[#F3E09F]">
                                +{bonusPts} pts
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {lang === 'zh'
                              ? `当前筹码 ¥${r.chips} · 重买 ${r.rebuyCount} 次`
                              : `Chips ¥${r.chips} · ${r.rebuyCount} Rebuy${r.rebuyCount === 1 ? '' : 's'}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-mono text-sm font-black sm:text-base ${
                            r.netProfit > 0
                              ? 'text-emerald-300'
                              : r.netProfit < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                          }`}
                        >
                          {formatNetProfit(r.netProfit)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {lang === 'zh' ? '净盈亏' : 'Net Profit'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isHost && (
                <div className="flex justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onEmit('room:startGame')}
                    className="rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-black text-[#0B0D13] hover:bg-[#E7C85B]"
                  >
                    {lang === 'zh' ? '重开牌局' : 'New Table'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEmit('room:returnToLobby')}
                    className="rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-xs font-bold text-white hover:bg-white/20"
                  >
                    {lang === 'zh' ? '返回大厅' : 'Lobby'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Players Around Felt */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {pub.players.map((tp) => {
            const seat = seatMap.get(tp.playerId);
            if (!seat) return null;
            const isActive = pub.activePlayerId === tp.playerId;
            const isWinner = pub.phase === 'showdown' && showdownWinnerIds.has(tp.playerId);
            const isD = pub.dealerId === tp.playerId;
            const isSB = pub.smallBlindId === tp.playerId;
            const isBB = pub.bigBlindId === tp.playerId;
            const stackBB = Math.round(tp.chips / bigBlind);

            return (
              <div
                key={tp.playerId}
                className={`relative flex flex-col items-center rounded-2xl border p-2.5 transition ${
                  isWinner
                    ? 'animate-pulse-gold border-[#D4AF37] bg-[#D4AF37]/20 ring-2 ring-[#D4AF37]/40'
                    : isActive
                      ? 'border-[#D4AF37] bg-[#D4AF37]/20 ring-2 ring-[#D4AF37]/30'
                      : tp.folded || tp.busted
                        ? 'border-white/5 bg-black/40 opacity-55'
                        : 'border-white/10 bg-black/30'
                }`}
              >
                {/* Casino Dealer / Blind Buttons */}
                {(isD || isSB || isBB) && (
                  <div className="mb-1 flex items-center gap-1">
                    {isD && (
                      <span
                        title="Dealer Button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#D4AF37] bg-[#F5F2EB] text-[10px] font-black text-[#0B0D13] shadow"
                      >
                        D
                      </span>
                    )}
                    {isSB && (
                      <span
                        title="Small Blind"
                        className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-black text-white shadow"
                      >
                        SB
                      </span>
                    )}
                    {isBB && (
                      <span
                        title="Big Blind"
                        className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-[#0B0D13] shadow"
                      >
                        BB
                      </span>
                    )}
                  </div>
                )}

                <AvatarBadge
                  seat={seat}
                  size="sm"
                  isMe={seat.id === priv?.playerId}
                  highlight={isActive || isWinner}
                />

                <div className="mt-1 flex items-baseline gap-1 text-xs font-extrabold text-[#F3E09F]">
                  <span>¥{tp.chips}</span>
                  <span className="text-[10px] font-bold text-emerald-300/80">({stackBB} BB)</span>
                </div>

                {tp.allIn && !tp.busted && (
                  <div className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 px-2 py-0.5 text-[10px] font-black tracking-wide text-white shadow">
                    <Flame className="h-3 w-3" />
                    ALL-IN
                  </div>
                )}

                {tp.busted && (
                  <div className="mt-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                    {lang === 'zh' ? '已出局' : 'BUSTED'}
                  </div>
                )}

                {tp.rebuyCount > 0 && (
                  <div className="mt-0.5 text-[10px] font-semibold text-amber-300/80">
                    {lang === 'zh' ? `重买×${tp.rebuyCount}` : `Rebuy×${tp.rebuyCount}`}
                  </div>
                )}

                {tp.betThisStreet > 0 && (
                  <div className="mt-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                    Bet ¥{tp.betThisStreet}
                  </div>
                )}

                {tp.lastAction && (
                  <div className="mt-0.5 text-[10px] text-slate-300">{pick(tp.lastAction)}</div>
                )}

                {tp.revealedCards && tp.revealedCards.length === 2 && (
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <div className="flex gap-1">
                      {tp.revealedCards.map((rc, idx) => (
                        <CardFace
                          key={`${idx}-${rc.rank}-${rc.suit}`}
                          card={rc}
                          small
                          flipIn
                          winningGlow={
                            pub.phase === 'showdown' && hasCard(tp.winningFiveCards, rc)
                          }
                        />
                      ))}
                    </div>
                    {tp.bestHandLabel && (
                      <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold text-[#F3E09F]">
                        {pick(tp.bestHandLabel)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Private Hole Cards & Action Deck */}
      {!isTvMode && priv && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <PrivacyPeekCard
              title={lang === 'zh' ? '你的底牌' : 'Your Hole Cards'}
              accentColor="#10B981"
            >
              {priv.holeCards.length === 2 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-3">
                    {priv.holeCards.map((hc, idx) => (
                      <CardFace
                        key={`${idx}-${hc.rank}-${hc.suit}`}
                        card={hc}
                        bestFiveGlow={
                          shouldHighlightHoleBestFive &&
                          hasCard(priv.currentBestHand?.bestFive, hc)
                        }
                      />
                    ))}
                  </div>
                  {priv.currentBestHand && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">
                      <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                      {lang === 'zh'
                        ? `当前最佳牌型：${priv.currentBestHand.labelZh}`
                        : `Best Hand: ${priv.currentBestHand.labelEn}`}
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">
                  {lang === 'zh' ? '本手牌暂未发牌' : 'Waiting for next hand'}
                </p>
              )}
            </PrivacyPeekCard>
          </div>

          <div className="gold-border flex flex-col justify-center rounded-2xl bg-[#121724]/95 p-4 lg:col-span-7">
            {priv.isTurn ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#F3E09F]">
                  <span>{lang === 'zh' ? '轮到你行动！' : 'Your Action!'}</span>
                  <span>
                    {priv.canCheck
                      ? lang === 'zh'
                        ? '可免费过牌'
                        : 'Free Check'
                      : `${lang === 'zh' ? '需跟注' : 'To Call'} ¥${priv.toCall} (${Math.max(1, Math.round(priv.toCall / bigBlind))} BB)`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'fold' })}
                    className="min-h-[48px] rounded-xl bg-rose-600/85 py-3 text-sm font-black text-white hover:bg-rose-500"
                  >
                    {lang === 'zh' ? '弃牌 Fold' : 'Fold'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onAction({ type: 'check_call' })}
                    className="min-h-[48px] rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400"
                  >
                    {priv.canCheck
                      ? lang === 'zh'
                        ? '过牌 Check'
                        : 'Check'
                      : `${lang === 'zh' ? '跟注' : 'Call'} ¥${priv.toCall}`}
                  </button>

                  <button
                    type="button"
                    onClick={() => onAction({ type: 'all_in' })}
                    className="flex min-h-[48px] items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 py-3 text-sm font-black text-white"
                  >
                    <Flame className="h-4 w-4" />
                    All-In
                  </button>
                </div>

                {priv.maxRaiseTo > pub.currentBet && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        {lang === 'zh' ? '加注至金额：' : 'Raise To:'}
                      </span>
                      <span className="font-mono text-sm font-black text-[#F3E09F]">
                        ¥{raiseAmount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={priv.minRaiseTo}
                      max={priv.maxRaiseTo}
                      step={5}
                      value={clampRaise(raiseAmount)}
                      onChange={(e) => setRaiseAmount(Number(e.target.value))}
                      className="w-full accent-[#D4AF37]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Min', val: priv.minRaiseTo },
                        {
                          label: '1/2 Pot',
                          val: clampRaise(pub.currentBet + pub.pot * 0.5),
                        },
                        {
                          label: '2/3 Pot',
                          val: clampRaise(pub.currentBet + (pub.pot * 2) / 3),
                        },
                        {
                          label: 'Pot',
                          val: clampRaise(pub.currentBet + pub.pot),
                        },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setRaiseAmount(preset.val)}
                          className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-white/20"
                        >
                          {preset.label} (¥{preset.val})
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          onAction({ type: 'raise_to', amount: clampRaise(raiseAmount) })
                        }
                        className="ml-auto rounded-lg bg-[#D4AF37] px-4 py-1 text-xs font-black text-[#0B0D13] hover:bg-[#E7C85B]"
                      >
                        {lang === 'zh'
                          ? `确认加注 ¥${clampRaise(raiseAmount)}`
                          : `Raise ¥${clampRaise(raiseAmount)}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-sm text-slate-300">
                  {pub.phase === 'showdown'
                    ? lang === 'zh'
                      ? '本手牌已亮牌结算'
                      : 'Hand settled at showdown'
                    : pub.phase === 'game_over'
                      ? lang === 'zh'
                        ? '牌局已终局结算'
                        : 'Session settled'
                      : pub.activePlayerId
                        ? lang === 'zh'
                          ? `等待「${seatMap.get(pub.activePlayerId)?.name ?? ''}」思考决策...`
                          : `Waiting for ${seatMap.get(pub.activePlayerId)?.name ?? ''}...`
                        : lang === 'zh'
                          ? '本轮结算中...'
                          : 'Resolving hand...'}
                </p>
                {canShowBluff && (
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'reveal_bluff' })}
                    className="rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-2 text-xs font-black text-emerald-200 transition hover:bg-emerald-500/35"
                  >
                    {lang === 'zh' ? '🃏 亮底牌秀全场' : '🃏 Show Cards'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hand Rankings Cheat-Sheet Portal */}
      {showRankings &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setShowRankings(false)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-[#D4AF37]/40 bg-[#101420] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-base font-black text-[#F3E09F]">
                  <BookOpen className="h-5 w-5 text-[#D4AF37]" />
                  {lang === 'zh' ? '德州扑克牌型大小速查' : "Texas Hold'em Hand Rankings"}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRankings(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Close hand rankings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 space-y-2 overflow-y-auto pr-1">
                {HAND_RANKINGS_GUIDE.map((item) => (
                  <div
                    key={item.rank}
                    className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#D4AF37]/25 text-[11px] font-black text-[#F3E09F]">
                          {item.rank}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {lang === 'zh' ? `${item.zh} · ${item.en}` : item.en}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {lang === 'zh' ? item.descZh : item.descEn}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-xs font-bold text-[#F3E09F]">
                      {item.sample}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
