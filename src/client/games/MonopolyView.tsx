import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Coins,
  Dice5,
  Gavel,
  Info,
  Landmark,
  ScrollText,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type {
  MonopolyPlayerPublic,
  MonopolyPrivateState,
  MonopolyPublicState,
  MonopolyTile,
} from '../../shared/gameTypes.js';
import {
  MONOPOLY_RENT_MULTIPLIERS,
  computePropertyRent,
  ownsColorGroup,
} from '../../shared/types/monopoly.js';
import type { PlayerSeat, RoomPublicState } from '../../shared/types.js';
import { useI18n } from '../i18n/useI18n.js';
import { CountdownPill } from '../components/CountdownPill.js';

const BUILDING_ICONS = ['', '🏠', '🏠🏠', '🏢', '🏰'] as const;

const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [
    [0, 2],
    [2, 0],
  ],
  3: [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function tileGridPos(index: number): { col: number; row: number } {
  // 28-tile clockwise perimeter on an 8x8 CSS Grid (1-indexed)
  if (index <= 7) return { col: index + 1, row: 1 };
  if (index <= 13) return { col: 8, row: index - 6 };
  if (index <= 21) return { col: 22 - index, row: 8 };
  return { col: 1, row: 29 - index };
}

function tileKindIcon(kind: MonopolyTile['kind']): string {
  switch (kind) {
    case 'start':
      return '🏁';
    case 'park':
      return '🎰';
    case 'tax':
      return '💸';
    case 'jail':
      return '🔒';
    case 'go_jail':
      return '🚨';
    case 'chance':
      return '🎡';
    case 'chest':
      return '🧰';
    case 'transit':
      return '🚄';
    case 'utility':
      return '⚡';
    default:
      return '';
  }
}

function tileBannerColor(tile: MonopolyTile): string {
  if (tile.colorGroup) return tile.colorGroup;
  switch (tile.kind) {
    case 'transit':
      return '#0EA5E9';
    case 'utility':
      return '#14B8A6';
    case 'park':
      return '#D4AF37';
    case 'tax':
      return '#EF4444';
    case 'chance':
      return '#F97316';
    case 'chest':
      return '#10B981';
    case 'start':
      return '#EAB308';
    default:
      return '#64748B';
  }
}

function buildingTierLabel(level: number, lang: string): string {
  if (lang === 'zh') {
    return ['空地', '🏠 精品洋房', '🏠🏠 双栋公馆', '🏢 商业大厦', '🏰 帝国地标'][level] ?? '空地';
  }
  return ['Base Lot', '🏠 Cottage', '🏠🏠 Villa', '🏢 Tower', '🏰 Landmark'][level] ?? 'Base Lot';
}

const PipDie: React.FC<{ value: number }> = ({ value }) => {
  const pips = PIP_LAYOUTS[value] ?? PIP_LAYOUTS[1];
  const isOne = value === 1;

  return (
    <div
      className="grid h-11 w-11 grid-cols-3 grid-rows-3 place-items-center rounded-xl border-2 border-[#D4AF37]/80 bg-gradient-to-br from-[#FFFDF7] via-[#F4E9CC] to-[#DFC896] p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.95)] sm:h-12 sm:w-12"
      aria-label={`Die ${value}`}
    >
      {Array.from({ length: 9 }, (_, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const active = pips.some(([r, c]) => r === row && c === col);
        return (
          <span
            key={idx}
            className={`rounded-full ${
              active
                ? isOne
                  ? 'h-3 w-3 bg-rose-600 shadow-inner'
                  : 'h-2 w-2 bg-slate-900 shadow-inner sm:h-2.5 sm:w-2.5'
                : 'h-2 w-2 opacity-0'
            }`}
          />
        );
      })}
    </div>
  );
};

interface TitleDeedModalProps {
  tile: MonopolyTile;
  pub: MonopolyPublicState;
  seatMap: Map<string, PlayerSeat>;
  playerMap: Map<string, MonopolyPlayerPublic>;
  lang: string;
  onClose: () => void;
}

const TitleDeedModal: React.FC<TitleDeedModalProps> = ({
  tile,
  pub,
  seatMap,
  playerMap,
  lang,
  onClose,
}) => {
  const prop = pub.properties[tile.index];
  const owner = prop?.ownerId ? playerMap.get(prop.ownerId) : undefined;
  const ownerSeat = owner ? seatMap.get(owner.playerId) : undefined;
  const bannerColor = tileBannerColor(tile);
  const partyTurbo = Boolean(pub.partyTurboRent);
  const ownerHasFullGroup = owner
    ? ownsColorGroup(owner.playerId, tile.colorGroup, pub.tiles, pub.properties)
    : false;
  const groupCount = tile.colorGroup
    ? pub.tiles.filter((t) => t.colorGroup === tile.colorGroup).length
    : 0;

  const ownedTransits = owner
    ? pub.tiles.filter(
        (t) => t.kind === 'transit' && pub.properties[t.index]?.ownerId === owner.playerId,
      ).length
    : 0;
  const ownedUtilities = owner
    ? pub.tiles.filter(
        (t) => t.kind === 'utility' && pub.properties[t.index]?.ownerId === owner.playerId,
      ).length
    : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-card-deal relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#D4AF37]/50 bg-[#121724] text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color Header Banner */}
        <div
          className="relative flex items-start justify-between gap-3 px-5 py-4 text-slate-950"
          style={{
            background: `linear-gradient(135deg, ${bannerColor}, ${bannerColor}CC)`,
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-black tracking-widest uppercase opacity-80">
              <span>#{tile.index}</span>
              <span>·</span>
              <span>{tile.kind}</span>
              {tileKindIcon(tile.kind) && <span>{tileKindIcon(tile.kind)}</span>}
            </div>
            <h3 className="mt-0.5 text-xl font-black leading-tight">{tile.name.zh}</h3>
            <p className="text-xs font-bold tracking-wide opacity-85">{tile.name.en}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'zh' ? '关闭弹窗' : 'Close'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/35"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {/* Owner & Building Status */}
          {(tile.kind === 'property' || tile.kind === 'transit' || tile.kind === 'utility') && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {lang === 'zh' ? '当前地主：' : 'Owner: '}
                </span>
                {owner ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-white">
                    <span
                      className="h-3 w-3 rounded-full border border-white/60"
                      style={{ backgroundColor: owner.colorHex }}
                    />
                    {ownerSeat?.name ?? owner.playerId}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-300">
                    {lang === 'zh' ? '无主空地（可购入/拍卖）' : 'Unowned'}
                  </span>
                )}
              </div>
              {tile.kind === 'property' && prop && (
                <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2.5 py-0.5 text-xs font-bold text-[#F3E09F]">
                  Lv.{prop.level} {BUILDING_ICONS[prop.level]}
                </span>
              )}
            </div>
          )}

          {/* Purchase Price & Upgrade Cost */}
          {tile.price !== undefined && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-[#171E30] p-3">
                <div className="text-[11px] text-slate-400">
                  {lang === 'zh' ? '购买价格' : 'Purchase Price'}
                </div>
                <div className="mt-0.5 font-mono text-lg font-black text-[#F3E09F]">
                  ¥{tile.price}
                </div>
              </div>
              {tile.upgradeCost !== undefined ? (
                <div className="rounded-2xl border border-white/10 bg-[#171E30] p-3">
                  <div className="text-[11px] text-slate-400">
                    {lang === 'zh' ? '每级扩建费用' : 'Upgrade Cost'}
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-black text-sky-300">
                    ¥{tile.upgradeCost}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#171E30] p-3">
                  <div className="text-[11px] text-slate-400">
                    {lang === 'zh' ? '基础租金' : 'Base Rent'}
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-black text-emerald-300">
                    ¥{tile.baseRent ?? 0}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full Lv.0 - Lv.4 Rent Table for Property */}
          {tile.kind === 'property' && tile.baseRent !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>
                  {lang === 'zh' ? 'Lv.0 – Lv.4 租金阶梯表' : 'Lv.0 – Lv.4 Rent Schedule'}
                </span>
                {partyTurbo && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {lang === 'zh' ? '极速加租 ×1.25' : 'Turbo ×1.25'}
                  </span>
                )}
              </div>

              <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[#0D111B]">
                {MONOPOLY_RENT_MULTIPLIERS.map((mult, lv) => {
                  const isActiveTier = Boolean(owner && prop?.level === lv);
                  const rentVal = computePropertyRent(
                    tile.baseRent ?? 100,
                    lv,
                    lv === 0 && ownerHasFullGroup,
                    partyTurbo,
                  );
                  return (
                    <div
                      key={lv}
                      className={`flex items-center justify-between px-3.5 py-2 text-xs transition ${
                        isActiveTier
                          ? 'bg-[#D4AF37]/20 font-bold text-[#F3E09F]'
                          : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400">Lv.{lv}</span>
                        <span>{buildingTierLabel(lv, lang)}</span>
                        <span className="text-[10px] text-slate-500">×{mult}</span>
                        {isActiveTier && (
                          <span className="rounded bg-[#D4AF37] px-1.5 py-0.5 text-[9px] font-black text-[#0B0D13]">
                            {lang === 'zh' ? '当前' : 'Active'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 font-mono font-bold">
                        {lv === 0 && ownerHasFullGroup && (
                          <span className="text-[10px] text-emerald-400">×2</span>
                        )}
                        <span className={isActiveTier ? 'text-[#F3E09F]' : 'text-white'}>
                          ¥{rentVal}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Monopoly Color-Set 2x Bonus Notice */}
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {lang === 'zh' ? '同色垄断 ×2 租金加成' : 'Color-Set Monopoly 2× Bonus'}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/85">
                  {lang === 'zh'
                    ? `集齐该色系全部 ${groupCount} 块地产，Lv.0 基础租金翻倍（×2 → ¥${computePropertyRent(tile.baseRent, 0, true, partyTurbo)}）！`
                    : `Own all ${groupCount} properties in this color group to double Lv.0 rent (×2 → ¥${computePropertyRent(tile.baseRent, 0, true, partyTurbo)})!`}
                  {ownerHasFullGroup && (
                    <span className="ml-1.5 inline-block rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                      {lang === 'zh' ? '已激活' : 'ACTIVE'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Transit Rent Table */}
          {tile.kind === 'transit' && (
            <div className="space-y-1.5 rounded-2xl border border-white/10 bg-[#0D111B] p-3.5 text-xs">
              <div className="font-bold text-sky-300">
                {lang === 'zh' ? '交通枢纽联营租金表' : 'Transit Network Rent'}
              </div>
              {[1, 2, 3].map((count) => {
                const active = ownedTransits === count;
                const val = (tile.baseRent ?? 220) * Math.pow(2, count - 1);
                return (
                  <div
                    key={count}
                    className={`flex justify-between rounded-lg px-2 py-1 ${
                      active ? 'bg-sky-500/20 font-bold text-sky-200' : 'text-slate-300'
                    }`}
                  >
                    <span>
                      {lang === 'zh' ? `拥有 ${count} 座车站` : `${count} Transit(s) Owned`}
                    </span>
                    <span className="font-mono">¥{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Utility Rules */}
          {tile.kind === 'utility' && (
            <div className="space-y-1.5 rounded-2xl border border-white/10 bg-[#0D111B] p-3.5 text-xs">
              <div className="font-bold text-teal-300">
                {lang === 'zh' ? '能源设施动态租金' : 'Utility Dynamic Rent'}
              </div>
              <div
                className={`flex justify-between rounded-lg px-2 py-1 ${
                  ownedUtilities === 1 ? 'bg-teal-500/20 font-bold text-teal-200' : 'text-slate-300'
                }`}
              >
                <span>{lang === 'zh' ? '拥有 1 处设施' : '1 Utility Owned'}</span>
                <span className="font-mono">
                  {lang === 'zh' ? '60 × 骰子点数' : '60 × Dice Roll'}
                </span>
              </div>
              <div
                className={`flex justify-between rounded-lg px-2 py-1 ${
                  ownedUtilities >= 2 ? 'bg-teal-500/20 font-bold text-teal-200' : 'text-slate-300'
                }`}
              >
                <span>{lang === 'zh' ? '拥有 2 处设施' : '2 Utilities Owned'}</span>
                <span className="font-mono">
                  {lang === 'zh' ? '120 × 骰子点数' : '120 × Dice Roll'}
                </span>
              </div>
            </div>
          )}

          {/* Special Tiles Info */}
          {tile.kind === 'park' && (
            <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3.5 text-xs text-amber-100">
              <div className="font-bold text-[#F3E09F]">
                {lang === 'zh'
                  ? `💰 当前累计奖池：¥${pub.jackpotPool}`
                  : `💰 Current Jackpot Pool: ¥${pub.jackpotPool}`}
              </div>
              <p className="mt-1 text-slate-300">
                {lang === 'zh'
                  ? '全场的奢侈品税、罚单与保释金均会注入此奖池！踩中即可独吞全部奖金，随后奖池重置为 ¥500。'
                  : 'All Luxury Tax, card fines, and Jail bails feed this pool! Land here to claim it all (resets to ¥500).'}
              </p>
            </div>
          )}

          {tile.kind === 'tax' && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-xs text-rose-100">
              {lang === 'zh'
                ? `停留此格需缴纳奢侈品税 ¥${tile.taxAmount ?? 800}，所缴税款全额注入「免税派对广场」奖池！`
                : `Pay ¥${tile.taxAmount ?? 800} Luxury Tax—100% feeds the Jackpot Plaza prize pool!`}
            </div>
          )}

          {tile.kind === 'start' && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-xs text-amber-100">
              {lang === 'zh'
                ? '每次经过或停留在黄金起点，立刻领取 ¥2000 都市薪资分红！'
                : 'Collect ¥2000 every time you pass or land on START!'}
            </div>
          )}

          {(tile.kind === 'chance' || tile.kind === 'chest') && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-200">
              {tile.kind === 'chance'
                ? lang === 'zh'
                  ? '抽取一张「命运轮盘」卡牌：可能直飞起点、空降奖池广场、收割全场礼金或缴纳罚款！'
                  : 'Draw a dynamic Chance card: fly to START or Jackpot Plaza, collect gifts, or pay fines!'
                : lang === 'zh'
                  ? '开启「财团金库」：可获研发拨款、退税、主权基金注资或特赦金卡！'
                  : 'Open the Vault Chest: corporate grants, tax refunds, bailout bonuses, or a Pardon Card!'}
            </div>
          )}

          {(tile.kind === 'jail' || tile.kind === 'go_jail') && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-200">
              {tile.kind === 'go_jail'
                ? lang === 'zh'
                  ? '触发税务稽查！立即移送审计拘留所，须掷出双数、缴纳 ¥500 保释金（进奖池）或使用特赦金卡出狱。'
                  : 'Sent directly to Audit Jail! Escape via doubles, ¥500 bail (feeds Jackpot Pool), or a Pardon Card.'
                : lang === 'zh'
                  ? '普通路过仅算探访不受罚；若被稽查拘留，可在此等待双数或支付 ¥500 保释。'
                  : 'Passing through is just visiting; detainees need doubles, ¥500 bail, or a Pardon Card.'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const MonopolyView: React.FC<{
  room: RoomPublicState;
  pub: MonopolyPublicState;
  priv: MonopolyPrivateState | null;
  isTvMode: boolean;
  isHost: boolean;
  onAction: (action: Record<string, unknown>) => void;
  onEmit: (event: string) => void;
}> = ({ room, pub, priv, isTvMode, isHost, onAction, onEmit }) => {
  const { lang, pick } = useI18n();
  const seatMap = new Map<string, PlayerSeat>(room.seats.map((s) => [s.id, s]));
  const playerMap = new Map(pub.players.map((p) => [p.playerId, p]));

  const activePlayer = pub.players.find((p) => p.playerId === pub.activePlayerId);
  const activeTile: MonopolyTile | undefined = activePlayer
    ? pub.tiles[activePlayer.position]
    : undefined;
  const auctionTile = pub.auction ? pub.tiles[pub.auction.tileIndex] : null;
  const myPlayer = priv ? playerMap.get(priv.playerId) : undefined;

  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const selectedTile = selectedTileIndex !== null ? pub.tiles[selectedTileIndex] ?? null : null;

  // Trigger dice tumble animation strictly when a roll occurs
  const [diceAnimKey, setDiceAnimKey] = useState(1);
  const prevRollSnapRef = useRef<{
    phase: MonopolyPublicState['phase'];
    activePlayerId: string;
    round: number;
    doublesStreak: number;
    activeInJail: boolean;
    diceStr: string;
  }>({
    phase: pub.phase,
    activePlayerId: pub.activePlayerId,
    round: pub.round,
    doublesStreak: pub.doublesStreak,
    activeInJail: Boolean(activePlayer?.inJail),
    diceStr: pub.lastDice ? pub.lastDice.join('-') : '',
  });

  useEffect(() => {
    const prev = prevRollSnapRef.current;
    const currDiceStr = pub.lastDice ? pub.lastDice.join('-') : '';
    const currInJail = Boolean(activePlayer?.inJail);
    const justPaidBail =
      prev.phase === 'roll' &&
      pub.phase === 'roll' &&
      prev.activePlayerId === pub.activePlayerId &&
      prev.activeInJail &&
      !currInJail;

    if (
      pub.lastDice &&
      prev.phase === 'roll' &&
      !justPaidBail &&
      (pub.phase !== 'roll' ||
        prev.activePlayerId !== pub.activePlayerId ||
        prev.round !== pub.round ||
        prev.doublesStreak !== pub.doublesStreak ||
        prev.diceStr !== currDiceStr)
    ) {
      setDiceAnimKey((k) => k + 1);
    }

    prevRollSnapRef.current = {
      phase: pub.phase,
      activePlayerId: pub.activePlayerId,
      round: pub.round,
      doublesStreak: pub.doublesStreak,
      activeInJail: currInJail,
      diceStr: currDiceStr,
    };
  }, [
    pub.phase,
    pub.activePlayerId,
    pub.round,
    pub.doublesStreak,
    pub.lastDice,
    activePlayer?.inJail,
  ]);

  // Close Title Deed modal on Escape
  useEffect(() => {
    if (selectedTileIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTileIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedTileIndex]);

  const myOwnedTiles = priv
    ? pub.tiles.filter((t) => pub.properties[t.index]?.ownerId === priv.playerId)
    : [];

  const isDoubleRoll = Boolean(pub.lastDice && pub.lastDice[0] === pub.lastDice[1]);
  const eventHistory = [...(pub.eventLog ?? [])].reverse();
  const solventPlayers = pub.players.filter((p) => !p.bankrupt);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 pb-24 sm:px-6">
      {/* Header */}
      <div className="gold-border flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#121724]/90 px-4 py-3 backdrop-blur">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
            <span>
              {lang === 'zh'
                ? `星耀大亨 · 第 ${pub.round}/${pub.maxRounds} 轮`
                : `Metropolis Tycoon · Round ${pub.round}/${pub.maxRounds}`}
            </span>
            {pub.partyTurboRent && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300">
                {lang === 'zh' ? '极速加租 ×1.25' : 'Turbo ×1.25'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm font-black text-white sm:text-lg">
            {activePlayer && (
              <span
                className="inline-block h-3 w-3 rounded-full border border-white/70"
                style={{ backgroundColor: activePlayer.colorHex }}
              />
            )}
            <span>
              {lang === 'zh'
                ? `当前行动：${seatMap.get(pub.activePlayerId)?.name ?? ''}`
                : `Active Turn: ${seatMap.get(pub.activePlayerId)?.name ?? ''}`}
            </span>
          </div>
        </div>
        <CountdownPill deadline={pub.phaseDeadline} paused={room.status === 'paused'} />
      </div>

      {/* 8x8 Perimeter Board (scroll-safe on tiny screens, crisp grid on tablet/TV) */}
      <div className="overflow-x-auto rounded-3xl border border-[#D4AF37]/30 bg-[#0E131F]/95 p-2 shadow-2xl sm:p-4">
        <div className="mx-auto grid min-w-[560px] max-w-[820px] grid-cols-8 grid-rows-8 gap-1">
          {pub.tiles.map((tile) => {
            const { col, row } = tileGridPos(tile.index);
            const prop = pub.properties[tile.index];
            const owner = prop?.ownerId ? playerMap.get(prop.ownerId) : undefined;
            const occupants = pub.players.filter(
              (p) => !p.bankrupt && p.position === tile.index,
            );
            const isHighlighted =
              activePlayer?.position === tile.index ||
              pub.auction?.tileIndex === tile.index;
            const kindEmoji = tileKindIcon(tile.kind);
            const bldgIcon = prop && prop.level > 0 ? BUILDING_ICONS[prop.level] : '';

            return (
              <button
                key={tile.index}
                type="button"
                onClick={() => setSelectedTileIndex(tile.index)}
                style={{ gridColumn: col, gridRow: row }}
                title={
                  lang === 'zh'
                    ? `点击查看「${tile.name.zh}」地契详情`
                    : `Inspect "${tile.name.en}" Title Deed`
                }
                className={`group relative flex min-h-[68px] cursor-pointer flex-col justify-between overflow-hidden rounded-lg border p-1 text-left text-[9px] transition hover:border-[#D4AF37]/70 hover:bg-[#1C253A] sm:min-h-[82px] sm:text-[10px] ${
                  isHighlighted
                    ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/40'
                    : 'border-white/10 bg-[#151C2C]'
                }`}
              >
                {/* Top Color Strip */}
                {tile.colorGroup ? (
                  <div
                    className="h-1.5 w-full shrink-0 rounded-sm"
                    style={{ backgroundColor: tile.colorGroup }}
                  />
                ) : (
                  <div
                    className="h-1 w-full shrink-0 rounded-sm opacity-60"
                    style={{ backgroundColor: tileBannerColor(tile) }}
                  />
                )}

                {/* Title + Special Icon */}
                <div className="mt-0.5 flex items-start justify-between gap-0.5 leading-tight font-bold text-slate-100">
                  <span className="line-clamp-2">{pick(tile.name)}</span>
                  {kindEmoji && <span className="shrink-0 text-[10px]">{kindEmoji}</span>}
                </div>

                {/* Building Tier & Price / Effect */}
                <div className="flex items-center justify-between gap-0.5">
                  {tile.price ? (
                    <span className="font-mono text-[9px] text-amber-200/90">
                      ¥{tile.price}
                    </span>
                  ) : tile.kind === 'park' ? (
                    <span className="font-mono text-[8px] font-bold text-amber-300">
                      ¥{pub.jackpotPool}
                    </span>
                  ) : tile.kind === 'tax' ? (
                    <span className="font-mono text-[8px] text-rose-300">
                      -¥{tile.taxAmount ?? 800}
                    </span>
                  ) : (
                    <span className="text-[8px] text-slate-400 uppercase">{tile.kind}</span>
                  )}

                  {bldgIcon && (
                    <span className="shrink-0 text-[10px] leading-none" title={`Lv.${prop.level}`}>
                      {bldgIcon}
                    </span>
                  )}
                </div>

                {/* Occupant Player Tokens */}
                {occupants.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {occupants.map((occ) => {
                      const isTurnOwner = occ.playerId === pub.activePlayerId;
                      return (
                        <span
                          key={occ.playerId}
                          className={`inline-block h-3 w-3 rounded-full border border-white shadow sm:h-3.5 sm:w-3.5 ${
                            isTurnOwner ? 'ring-2 ring-[#F3E09F]' : ''
                          }`}
                          style={{ backgroundColor: occ.colorHex }}
                          title={seatMap.get(occ.playerId)?.name}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Owner Color Strip */}
                {owner && (
                  <div
                    className="mt-0.5 h-1.5 w-full shrink-0 rounded-sm shadow-sm"
                    style={{ backgroundColor: owner.colorHex }}
                    title={seatMap.get(owner.playerId)?.name}
                  />
                )}
              </button>
            );
          })}

          {/* Center 6x6 Stage Area */}
          <div className="col-start-2 col-end-8 row-start-2 row-end-8 flex flex-col justify-between gap-2 rounded-2xl border border-white/10 bg-black/55 p-3 sm:p-4">
            {/* Jackpot Plaza Prize Pool Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="animate-pulse-gold inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/60 bg-gradient-to-r from-[#D4AF37]/25 via-[#F3E09F]/15 to-[#D4AF37]/25 px-3.5 py-1 text-xs font-black text-[#F3E09F] sm:text-sm">
                <Coins className="h-4 w-4 text-[#D4AF37]" />
                <span>
                  {lang === 'zh'
                    ? `💰 派对广场奖池 ¥${pub.jackpotPool}`
                    : `💰 Jackpot Plaza Pool ¥${pub.jackpotPool}`}
                </span>
              </div>
            </div>

            {/* Real Pip Dice + DOUBLE Badge */}
            {pub.lastDice && (
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div
                  key={diceAnimKey}
                  className="animate-dice-tumble flex items-center justify-center gap-2.5"
                >
                  <PipDie value={pub.lastDice[0]} />
                  <PipDie value={pub.lastDice[1]} />
                  <span className="rounded-xl border border-[#D4AF37]/40 bg-[#171E30] px-2.5 py-1 font-mono text-sm font-black text-[#F3E09F]">
                    = {pub.lastDice[0] + pub.lastDice[1]}
                  </span>
                </div>
                {isDoubleRoll && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-500/30 to-yellow-400/20 px-3 py-0.5 text-[11px] font-black text-amber-200 shadow">
                    {lang === 'zh' ? '🎲 DOUBLE! 再掷一次' : '🎲 DOUBLE! Roll Again'}
                  </span>
                )}
              </div>
            )}

            {/* Live Auction Spotlight */}
            {pub.phase === 'auction' && pub.auction && auctionTile && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/15 p-2.5 text-center shadow-lg">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-black text-amber-300 uppercase">
                  <Gavel className="h-4 w-4" />
                  {lang === 'zh' ? '10秒全员实时抢拍！' : '10s LIVE AUCTION!'}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm font-black text-white sm:text-base">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border border-white/50"
                    style={{ backgroundColor: tileBannerColor(auctionTile) }}
                  />
                  <span>{pick(auctionTile.name)}</span>
                  <span className="text-xs font-semibold text-amber-200">
                    ({lang === 'zh' ? '原价' : 'Price'} ¥{auctionTile.price ?? 0} ·{' '}
                    {lang === 'zh' ? '底租' : 'Base'} ¥{auctionTile.baseRent ?? 0})
                  </span>
                </div>
                <div className="mt-1 text-lg font-black text-[#F3E09F]">
                  {pub.auction.highestBidderId
                    ? `${seatMap.get(pub.auction.highestBidderId)?.name}: ¥${pub.auction.highestBid}`
                    : lang === 'zh'
                      ? '暂无出价 · 起拍 ¥100'
                      : 'No bids yet · Start ¥100'}
                </div>
                {/* Passed / Active Bidder Status Chips */}
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {solventPlayers.map((sp) => {
                    const passed = pub.auction!.passedIds.includes(sp.playerId);
                    const isLeader = pub.auction!.highestBidderId === sp.playerId;
                    return (
                      <span
                        key={sp.playerId}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          isLeader
                            ? 'border-amber-300 bg-amber-400/25 text-amber-100'
                            : passed
                              ? 'border-white/10 bg-white/5 text-slate-400 line-through'
                              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: sp.colorHex }}
                        />
                        {seatMap.get(sp.playerId)?.name}
                        {isLeader ? ' 👑' : passed ? (lang === 'zh' ? ' 弃' : ' Pass') : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Game Over Podium */}
            {pub.phase === 'game_over' && pub.rankings && (
              <div className="rounded-2xl border border-[#D4AF37] bg-[#D4AF37]/15 p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-base font-black text-[#F3E09F] sm:text-lg">
                  <Trophy className="h-5 w-5" />
                  {lang === 'zh'
                    ? `首富诞生：${seatMap.get(pub.winnerId ?? '')?.name ?? ''}`
                    : `Champion: ${seatMap.get(pub.winnerId ?? '')?.name ?? ''}`}
                </div>
                <div className="mt-1.5 flex flex-wrap justify-center gap-2 text-[11px] font-bold">
                  {pub.rankings.slice(0, 3).map((r, i) => (
                    <span
                      key={r.playerId}
                      className="rounded-full border border-[#D4AF37]/40 bg-black/30 px-2.5 py-0.5 text-amber-100"
                    >
                      {['🥇', '🥈', '🥉'][i]} {seatMap.get(r.playerId)?.name} (+{3 - i}pt)
                    </span>
                  ))}
                </div>
                {isHost && (
                  <div className="mt-2.5 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEmit('room:startGame')}
                      className="rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-black text-[#0B0D13]"
                    >
                      {lang === 'zh' ? '再来一局' : 'Play Again'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEmit('room:returnToLobby')}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {lang === 'zh' ? '返回大厅' : 'Lobby'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scrollable EventLog Ticker */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                <span className="inline-flex items-center gap-1">
                  <ScrollText className="h-3 w-3 text-[#D4AF37]" />
                  {lang === 'zh' ? '都市财经快讯' : 'Metropolis Ticker'}
                </span>
                <span className="text-[9px] font-normal normal-case text-slate-400">
                  {lang === 'zh' ? '点击任意格子查看地契' : 'Tap any tile for Deed'}
                </span>
              </div>
              <div className="max-h-20 space-y-1 overflow-y-auto pr-1 sm:max-h-24">
                {eventHistory.length > 0 ? (
                  eventHistory.map((entry, idx) => (
                    <div
                      key={`${entry.round}-${idx}-${entry.text.en.slice(0, 12)}`}
                      className={`flex items-start gap-1.5 rounded-lg px-2 py-1 text-[11px] leading-snug ${
                        idx === 0
                          ? 'bg-[#D4AF37]/15 font-semibold text-[#F3E09F]'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="shrink-0 font-mono text-[10px] text-amber-400/80">
                        R{entry.round}
                      </span>
                      <span>{pick(entry.text)}</span>
                    </div>
                  ))
                ) : (
                  pub.lastEvent && (
                    <div className="px-2 py-1 text-xs font-semibold text-slate-100">
                      {pick(pub.lastEvent)}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Net Worth Standings */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {[...pub.players]
                .sort((a, b) => b.netWorth - a.netWorth)
                .map((mp) => (
                  <div
                    key={mp.playerId}
                    className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-[11px] ${
                      mp.playerId === pub.activePlayerId
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15'
                        : 'border-white/10 bg-white/5'
                    } ${mp.bankrupt ? 'opacity-40 line-through' : ''}`}
                  >
                    <span className="flex items-center gap-1.5 truncate font-semibold">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: mp.colorHex }}
                      />
                      <span className="truncate">{seatMap.get(mp.playerId)?.name}</span>
                      {mp.inJail && <span title="In Jail">🔒</span>}
                    </span>
                    <span className="ml-1 font-mono font-bold text-[#F3E09F]">
                      ¥{mp.netWorth}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Private Mobile Action Console */}
      {!isTvMode && priv && (
        <div className="gold-border space-y-3 rounded-2xl bg-[#121724]/95 p-4">
          {/* Wallet & Location Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-300">
                {lang === 'zh' ? '可用现金：' : 'Cash: '}
                <strong className="font-mono text-base text-[#F3E09F]">
                  ¥{myPlayer?.cash ?? 0}
                </strong>
              </span>
              {myPlayer && myPlayer.jailFreeCards > 0 && (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                  🎫 {lang === 'zh' ? `免罪卡 ×${myPlayer.jailFreeCards}` : `Pardon ×${myPlayer.jailFreeCards}`}
                </span>
              )}
              {myPlayer?.inJail && (
                <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-200">
                  🔒 {lang === 'zh' ? '拘留中' : 'In Jail'}
                </span>
              )}
            </div>
            {myPlayer && (
              <button
                type="button"
                onClick={() => setSelectedTileIndex(myPlayer.position)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-300 hover:border-[#D4AF37]/50 hover:text-white"
              >
                <span>{lang === 'zh' ? '所在：' : 'Tile: '}</span>
                <strong className="text-white">{pick(pub.tiles[myPlayer.position]?.name)}</strong>
                <Info className="h-3 w-3 text-[#D4AF37]" />
              </button>
            )}
          </div>

          {/* Mobile Tycoon Portfolio Row */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span>
                {lang === 'zh'
                  ? `我的地产帝国 (${myOwnedTiles.length})`
                  : `Your Portfolio (${myOwnedTiles.length})`}
              </span>
              <span className="text-[10px] font-normal">
                {lang === 'zh' ? '点按查看地契' : 'Tap to inspect'}
              </span>
            </div>
            {myOwnedTiles.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {myOwnedTiles.map((tile) => {
                  const prop = pub.properties[tile.index];
                  const lvIcon = prop && prop.level > 0 ? BUILDING_ICONS[prop.level] : '';
                  return (
                    <button
                      key={tile.index}
                      type="button"
                      onClick={() => setSelectedTileIndex(tile.index)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#192236] px-2.5 py-1 text-xs font-semibold text-slate-100 transition hover:border-[#D4AF37]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tileBannerColor(tile) }}
                      />
                      <span>{pick(tile.name)}</span>
                      {lvIcon && <span className="text-[11px]">{lvIcon}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                {lang === 'zh'
                  ? '暂无名下地产，掷骰购地或参与拍卖抢占地盘！'
                  : 'No properties owned yet—roll to buy or win an auction!'}
              </p>
            )}
          </div>

          {/* Auction Console */}
          {pub.phase === 'auction' && pub.auction && auctionTile && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-sm border border-white/50"
                    style={{ backgroundColor: tileBannerColor(auctionTile) }}
                  />
                  <div>
                    <div className="font-black text-white">{pick(auctionTile.name)}</div>
                    <div className="text-[11px] text-amber-200/90">
                      {lang === 'zh'
                        ? `原价 ¥${auctionTile.price ?? 0} · 基础租金 ¥${auctionTile.baseRent ?? 0}`
                        : `Price ¥${auctionTile.price ?? 0} · Base Rent ¥${auctionTile.baseRent ?? 0}`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTileIndex(auctionTile.index)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300/40 bg-black/30 px-2 py-1 text-[11px] font-bold text-amber-200"
                >
                  <Info className="h-3 w-3" />
                  {lang === 'zh' ? '地契' : 'Deed'}
                </button>
              </div>

              {pub.auction.passedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                  <span>{lang === 'zh' ? '已弃权：' : 'Passed:'}</span>
                  {pub.auction.passedIds.map((pid) => (
                    <span
                      key={pid}
                      className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      {seatMap.get(pid)?.name ?? pid}
                    </span>
                  ))}
                </div>
              )}

              {priv.canBidInAuction ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[100, 300, 500].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      disabled={(myPlayer?.cash ?? 0) < pub.auction!.highestBid + delta}
                      onClick={() => onAction({ type: 'auction_bid', delta })}
                      className="min-h-[48px] rounded-xl bg-amber-500 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-35"
                    >
                      +¥{delta} (¥{pub.auction!.highestBid + delta})
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'auction_pass' })}
                    className="min-h-[48px] rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-slate-300"
                  >
                    {lang === 'zh' ? '放弃竞拍' : 'Pass'}
                  </button>
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-amber-200">
                  {pub.auction.highestBidderId === priv.playerId
                    ? lang === 'zh'
                      ? '你当前最高出价，等待其他人加价或成交！'
                      : 'You hold the highest bid!'
                    : pub.auction.passedIds.includes(priv.playerId)
                      ? lang === 'zh'
                        ? '你已放弃本次竞拍，等待成交结算...'
                        : 'You passed—waiting for auction to settle...'
                      : lang === 'zh'
                        ? '拍卖进行中...'
                        : 'Auction in progress...'}
                </p>
              )}
            </div>
          )}

          {/* Active Player Actions */}
          {pub.phase !== 'auction' && priv.isActiveTurn && (
            <div className="space-y-2.5">
              {priv.canRoll && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'roll_dice' })}
                    className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3E09F] py-3 text-base font-black text-[#0B0D13]"
                  >
                    <Dice5 className="h-5 w-5" />
                    {lang === 'zh' ? '掷双骰前进！' : 'Roll 2D6!'}
                  </button>
                  {myPlayer?.inJail && (myPlayer.cash >= 500 || myPlayer.jailFreeCards > 0) && (
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'pay_jail_bail' })}
                      className="min-h-[52px] rounded-xl border border-sky-400/50 bg-sky-500/20 px-4 text-xs font-bold text-sky-100"
                    >
                      {myPlayer.jailFreeCards > 0
                        ? lang === 'zh'
                          ? '使用免罪卡'
                          : 'Use Pardon'
                        : lang === 'zh'
                          ? '¥500 保释出狱'
                          : 'Pay ¥500 Bail'}
                    </button>
                  )}
                </div>
              )}

              {pub.phase === 'buy_decision' && activeTile && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: tileBannerColor(activeTile) }}
                      />
                      <span className="font-bold text-white">{pick(activeTile.name)}</span>
                      <span className="text-slate-400">
                        {lang === 'zh'
                          ? `底租 ¥${activeTile.baseRent ?? 0}`
                          : `Rent ¥${activeTile.baseRent ?? 0}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTileIndex(activeTile.index)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F3E09F]"
                    >
                      <Info className="h-3.5 w-3.5" />
                      {lang === 'zh' ? '详情' : 'Deed'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!priv.canBuyCurrentTile}
                      onClick={() => onAction({ type: 'buy_property' })}
                      className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                    >
                      <Landmark className="h-4 w-4" />
                      {lang === 'zh'
                        ? `买入 ¥${activeTile.price}`
                        : `Buy ¥${activeTile.price}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'pass_property' })}
                      className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/20 py-3 text-sm font-bold text-amber-200"
                    >
                      <Gavel className="h-4 w-4" />
                      {lang === 'zh' ? '放弃并开启全员拍卖' : 'Pass to Auction'}
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-Property Upgrade Picker */}
              {pub.phase === 'turn_end' && (
                <div className="space-y-2.5">
                  {priv.canUpgradeTiles.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                        <Building2 className="h-4 w-4" />
                        {lang === 'zh'
                          ? '选择一块名下地产进行建造升级：'
                          : 'Choose a property to upgrade:'}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {priv.canUpgradeTiles.map((tileIdx) => {
                          const t = pub.tiles[tileIdx];
                          const prop = pub.properties[tileIdx];
                          if (!t || !prop) return null;
                          const cost = t.upgradeCost ?? 500;
                          const fullGroup = ownsColorGroup(
                            priv.playerId,
                            t.colorGroup,
                            pub.tiles,
                            pub.properties,
                          );
                          const curRent = computePropertyRent(
                            t.baseRent ?? 100,
                            prop.level,
                            fullGroup,
                            Boolean(pub.partyTurboRent),
                          );
                          const nextRent = computePropertyRent(
                            t.baseRent ?? 100,
                            prop.level + 1,
                            fullGroup,
                            Boolean(pub.partyTurboRent),
                          );
                          return (
                            <div
                              key={tileIdx}
                              className="flex items-center justify-between gap-2 rounded-xl border border-sky-400/35 bg-[#162135] p-2.5"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  onAction({ type: 'upgrade_property', tileIndex: tileIdx })
                                }
                                className="flex min-w-0 flex-1 flex-col text-left"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: tileBannerColor(t) }}
                                  />
                                  <span className="truncate text-xs font-black text-white">
                                    {pick(t.name)}
                                  </span>
                                  <span className="text-[11px] text-amber-300">
                                    Lv.{prop.level}→{prop.level + 1} {BUILDING_ICONS[prop.level + 1]}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px]">
                                  <span className="font-mono font-bold text-sky-300">
                                    -¥{cost}
                                  </span>
                                  <span className="text-slate-400">
                                    {lang === 'zh' ? '租金' : 'Rent'} ¥{curRent} →{' '}
                                    <strong className="text-emerald-300">¥{nextRent}</strong>
                                  </span>
                                </div>
                              </button>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTileIndex(tileIdx)}
                                  aria-label={lang === 'zh' ? '查看地契' : 'Inspect deed'}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 hover:text-white"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAction({ type: 'upgrade_property', tileIndex: tileIdx })
                                  }
                                  className="rounded-lg bg-sky-400 px-2.5 py-1.5 text-xs font-black text-slate-950 hover:bg-sky-300"
                                >
                                  {lang === 'zh' ? '扩建' : 'Build'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onAction({ type: 'end_turn' })}
                    className="w-full min-h-[48px] rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-[#0B0D13] hover:bg-[#e1be49]"
                  >
                    {lang === 'zh' ? '暂不建造 · 结束回合' : 'Skip & End Turn'}
                  </button>
                </div>
              )}
            </div>
          )}

          {pub.phase === 'game_over' && (
            <p className="py-1 text-center text-xs font-bold text-[#F3E09F]">
              {lang === 'zh'
                ? `🏆 商业帝国决胜局结束！本局首富：${seatMap.get(pub.winnerId ?? '')?.name ?? ''}`
                : `🏆 Match Complete! Tycoon Champion: ${seatMap.get(pub.winnerId ?? '')?.name ?? ''}`}
            </p>
          )}

          {pub.phase !== 'auction' && pub.phase !== 'game_over' && !priv.isActiveTurn && (
            <p className="py-1 text-center text-xs text-slate-400">
              {lang === 'zh'
                ? `等待「${seatMap.get(pub.activePlayerId)?.name ?? ''}」行动（流拍地块将触发全员手机竞拍！）`
                : `Waiting for ${seatMap.get(pub.activePlayerId)?.name ?? ''}...`}
            </p>
          )}
        </div>
      )}

      {/* Interactive Title Deed Inspector Modal */}
      {selectedTile && typeof document !== 'undefined' && (
        <TitleDeedModal
          tile={selectedTile}
          pub={pub}
          seatMap={seatMap}
          playerMap={playerMap}
          lang={lang}
          onClose={() => setSelectedTileIndex(null)}
        />
      )}
    </div>
  );
};
