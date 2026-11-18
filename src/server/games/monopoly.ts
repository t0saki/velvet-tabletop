import type { PlayerSeat } from '../../shared/types.js';
import type {
  LocalizedText,
  MonopolyAuctionState,
  MonopolyOptions,
  MonopolyPlayerPublic,
  MonopolyPrivateState,
  MonopolyPropertyState,
  MonopolyPublicState,
  MonopolyTile,
} from '../../shared/gameTypes.js';
import {
  computePropertyRent,
  ownsColorGroup,
  type MonopolyEventEntry,
} from '../../shared/types/monopoly.js';
import type { GameDefinition, GameStepResult } from './engine.js';

const PLAYER_COLORS = [
  '#F59E0B',
  '#38BDF8',
  '#EC4899',
  '#10B981',
  '#A855F7',
  '#EF4444',
  '#14B8A6',
  '#F97316',
  '#818CF8',
  '#84CC16',
];

export const MONOPOLY_TILES: MonopolyTile[] = [
  { index: 0, kind: 'start', name: { zh: '黄金起点', en: 'START' } },
  { index: 1, kind: 'property', name: { zh: '霓虹夜市', en: 'Neon Alley' }, colorGroup: '#A855F7', price: 600, baseRent: 80, upgradeCost: 400 },
  { index: 2, kind: 'chest', name: { zh: '财团金库', en: 'Vault Chest' } },
  { index: 3, kind: 'property', name: { zh: '黑胶街区', en: 'Vinyl Row' }, colorGroup: '#A855F7', price: 650, baseRent: 90, upgradeCost: 400 },
  { index: 4, kind: 'transit', name: { zh: '中央高铁', en: 'Central Rail' }, price: 1200, baseRent: 220 },
  { index: 5, kind: 'property', name: { zh: '翡翠花园', en: 'Jade Garden' }, colorGroup: '#10B981', price: 900, baseRent: 130, upgradeCost: 500 },
  { index: 6, kind: 'property', name: { zh: '翠微大道', en: 'Emerald Ave' }, colorGroup: '#10B981', price: 1000, baseRent: 150, upgradeCost: 500 },
  { index: 7, kind: 'jail', name: { zh: '审计拘留所', en: 'Audit Jail' } },

  { index: 8, kind: 'property', name: { zh: '琥珀歌剧院', en: 'Amber Opera' }, colorGroup: '#F59E0B', price: 1200, baseRent: 180, upgradeCost: 650 },
  { index: 9, kind: 'utility', name: { zh: '星链电网', en: 'Grid Power' }, price: 1100, baseRent: 120 },
  { index: 10, kind: 'property', name: { zh: '鎏金画廊', en: 'Gilded Gallery' }, colorGroup: '#F59E0B', price: 1300, baseRent: 200, upgradeCost: 650 },
  { index: 11, kind: 'chance', name: { zh: '命运轮盘', en: 'Chance' } },
  { index: 12, kind: 'property', name: { zh: '蓝宝石码头', en: 'Sapphire Pier' }, colorGroup: '#38BDF8', price: 1500, baseRent: 240, upgradeCost: 750 },
  { index: 13, kind: 'property', name: { zh: '星港湾畔', en: 'Starlight Bay' }, colorGroup: '#38BDF8', price: 1600, baseRent: 260, upgradeCost: 750 },

  { index: 14, kind: 'park', name: { zh: '免税派对广场', en: 'Jackpot Plaza' } },
  { index: 15, kind: 'property', name: { zh: '绯红公馆', en: 'Crimson Manor' }, colorGroup: '#EC4899', price: 1800, baseRent: 300, upgradeCost: 900 },
  { index: 16, kind: 'transit', name: { zh: '云端空港', en: 'Sky Terminal' }, price: 1200, baseRent: 220 },
  { index: 17, kind: 'property', name: { zh: '天鹅绒俱乐部', en: 'Velvet Club' }, colorGroup: '#EC4899', price: 1950, baseRent: 330, upgradeCost: 900 },
  { index: 18, kind: 'chest', name: { zh: '财团金库', en: 'Vault Chest' } },
  { index: 19, kind: 'property', name: { zh: '皇家交易所', en: 'Royal Exchange' }, colorGroup: '#EF4444', price: 2200, baseRent: 380, upgradeCost: 1100 },
  { index: 20, kind: 'tax', name: { zh: '奢侈品税', en: 'Luxury Tax' }, taxAmount: 800 },

  { index: 21, kind: 'go_jail', name: { zh: '税务稽查', en: 'Go To Jail' } },
  { index: 22, kind: 'property', name: { zh: '天际摩天塔', en: 'Skyline Tower' }, colorGroup: '#EF4444', price: 2400, baseRent: 420, upgradeCost: 1100 },
  { index: 23, kind: 'utility', name: { zh: '量子数据中心', en: 'Quantum Data' }, price: 1100, baseRent: 120 },
  { index: 24, kind: 'chance', name: { zh: '命运轮盘', en: 'Chance' } },
  { index: 25, kind: 'transit', name: { zh: '深海磁浮', en: 'Maglev Port' }, price: 1200, baseRent: 220 },
  { index: 26, kind: 'property', name: { zh: '皇冠大道', en: 'Crown Blvd' }, colorGroup: '#D4AF37', price: 2800, baseRent: 500, upgradeCost: 1400 },
  { index: 27, kind: 'property', name: { zh: '帝国顶峰', en: 'Imperial Peak' }, colorGroup: '#D4AF37', price: 3200, baseRent: 600, upgradeCost: 1400 },
];

interface ChanceEvent {
  text: LocalizedText;
  cashDelta?: number;
  moveTo?: number;
  collectFromAll?: number;
  grantJailCard?: boolean;
}

const CHANCE_CARDS: ChanceEvent[] = [
  { text: { zh: '牛市分红！股息暴涨获得 ¥1500', en: 'Bull market dividend! Collect ¥1500' }, cashDelta: 1500 },
  { text: { zh: '内幕交易罚金：缴纳 ¥800（注入广场奖池）', en: 'Insider trading fine: Pay ¥800 (added to Jackpot Pool)' }, cashDelta: -800 },
  { text: { zh: '直飞黄金起点并领取 ¥2000 薪资！', en: 'Fly straight to START and collect ¥2000!' }, moveTo: 0 },
  { text: { zh: '今晚寿星！每位在场富豪向你献礼 ¥300', en: 'Birthday toast! Collect ¥300 from each tycoon' }, collectFromAll: 300 },
  { text: { zh: '私人直升机空降免税派对广场！', en: 'Chopper direct to Jackpot Plaza!' }, moveTo: 14 },
  { text: { zh: '商业审计补税：缴纳 ¥600（注入广场奖池）', en: 'Tax audit surcharge: Pay ¥600 (added to Jackpot Pool)' }, cashDelta: -600 },
  { text: { zh: '艺术藏品拍卖大赚 ¥1200！', en: 'Art collection auctioned for ¥1200!' }, cashDelta: 1200 },
  { text: { zh: '跨界联名爆款分红：获得 ¥900', en: 'Brand collaboration bonus: Collect ¥900' }, cashDelta: 900 },
];

const CHEST_CARDS: ChanceEvent[] = [
  { text: { zh: '财团研发专项拨款：入账 ¥1200', en: 'Corporate R&D grant: Collect ¥1200' }, cashDelta: 1200 },
  { text: { zh: '年度税收返还到账：获得 ¥700', en: 'Annual tax refund arrived: Collect ¥700' }, cashDelta: 700 },
  { text: { zh: '获得金库「特赦金卡」一张，可免除拘留！', en: 'Vault granted a VIP Pardon Card (Jail Free)!' }, grantJailCard: true },
  { text: { zh: '主权基金战略注资：爆赚 ¥1800！', en: 'Sovereign fund bailout bonus: Collect ¥1800!' }, cashDelta: 1800 },
  { text: { zh: '奢华慈善晚宴承办费：支付 ¥700（注入广场奖池）', en: 'Luxury gala hosting fee: Pay ¥700 (added to Jackpot Pool)' }, cashDelta: -700 },
  { text: { zh: '财团董事分红：获得 ¥1000', en: 'Executive board dividend: Collect ¥1000' }, cashDelta: 1000 },
  { text: { zh: '游艇码头维护账单：支付 ¥500（注入广场奖池）', en: 'Yacht marina maintenance fee: Pay ¥500 (added to Jackpot Pool)' }, cashDelta: -500 },
  { text: { zh: '全城联名卡返利：每位在场富豪分红给你 ¥200', en: 'Co-brand card rebate: Collect ¥200 from each tycoon' }, collectFromAll: 200 },
];

export interface MonopolyState {
  options: MonopolyOptions;
  phase: MonopolyPublicState['phase'];
  round: number;
  seatOrder: string[];
  activeCursor: number;
  lastDice: [number, number] | null;
  doublesStreak: number;
  players: Array<Omit<MonopolyPlayerPublic, 'netWorth'>>;
  properties: Record<number, MonopolyPropertyState>;
  auction: MonopolyAuctionState | null;
  lastEvent: LocalizedText | null;
  jackpotPool: number;
  eventLog: MonopolyEventEntry[];
  winnerId?: string;
  rankings?: Array<{ playerId: string; netWorth: number }>;
  phaseDeadline?: number;
}

export type MonopolyAction =
  | { type: 'roll_dice' }
  | { type: 'buy_property' }
  | { type: 'pass_property' }
  | { type: 'auction_bid'; delta: number }
  | { type: 'auction_pass' }
  | { type: 'upgrade_property'; tileIndex: number }
  | { type: 'end_turn' }
  | { type: 'pay_jail_bail' };

function computeNetWorth(
  player: Omit<MonopolyPlayerPublic, 'netWorth'>,
  properties: Record<number, MonopolyPropertyState>,
): number {
  if (player.bankrupt) return 0;
  let total = player.cash;
  for (const [idxStr, prop] of Object.entries(properties)) {
    if (prop.ownerId === player.playerId) {
      const tile = MONOPOLY_TILES[Number(idxStr)];
      total += (tile?.price ?? 0) + prop.level * (tile?.upgradeCost ?? 0);
    }
  }
  return total;
}

function withEvent(state: MonopolyState, text: LocalizedText): MonopolyState {
  return {
    ...state,
    lastEvent: text,
    eventLog: [...(state.eventLog ?? []), { round: state.round, text }].slice(-8),
  };
}

function getUpgradableTileIndices(
  player: Omit<MonopolyPlayerPublic, 'netWorth'>,
  properties: Record<number, MonopolyPropertyState>,
): number[] {
  if (player.bankrupt) return [];
  const indices: number[] = [];
  for (const tile of MONOPOLY_TILES) {
    if (tile.kind !== 'property') continue;
    const prop = properties[tile.index];
    if (
      prop &&
      prop.ownerId === player.playerId &&
      prop.level < 4 &&
      player.cash >= (tile.upgradeCost ?? 0)
    ) {
      indices.push(tile.index);
    }
  }
  return indices;
}

function calculateRent(
  tile: MonopolyTile,
  prop: MonopolyPropertyState,
  properties: Record<number, MonopolyPropertyState>,
  diceSum: number,
  partyTurbo: boolean,
): number {
  if (!prop.ownerId) return 0;
  if (tile.kind === 'transit') {
    const ownedTransits = MONOPOLY_TILES.filter(
      (t) => t.kind === 'transit' && properties[t.index]?.ownerId === prop.ownerId,
    ).length;
    return (tile.baseRent ?? 200) * Math.pow(2, Math.max(0, ownedTransits - 1));
  }
  if (tile.kind === 'utility') {
    const ownedUtils = MONOPOLY_TILES.filter(
      (t) => t.kind === 'utility' && properties[t.index]?.ownerId === prop.ownerId,
    ).length;
    return diceSum * (ownedUtils >= 2 ? 120 : 60);
  }
  const base = tile.baseRent ?? 100;
  const fullGroup = ownsColorGroup(prop.ownerId, tile.colorGroup, MONOPOLY_TILES, properties);
  return computePropertyRent(base, prop.level, fullGroup, partyTurbo);
}

function chargePlayer(
  state: MonopolyState,
  debtorId: string,
  amount: number,
  creditorId: string | null,
): { state: MonopolyState; wentBankrupt: boolean; paidAmount: number } {
  const players = state.players.map((p) => ({ ...p }));
  const properties: Record<number, MonopolyPropertyState> = {};
  for (const [k, v] of Object.entries(state.properties)) {
    properties[Number(k)] = { ...v };
  }

  const debtor = players.find((p) => p.playerId === debtorId)!;
  const creditor = creditorId
    ? players.find((p) => p.playerId === creditorId && !p.bankrupt)
    : undefined;

  if (debtor.cash >= amount) {
    debtor.cash -= amount;
    if (creditor) creditor.cash += amount;
    return { state: { ...state, players, properties }, wentBankrupt: false, paidAmount: amount };
  }

  // Auto-liquidate buildings first, then properties
  for (const [idxStr, prop] of Object.entries(properties)) {
    if (debtor.cash >= amount) break;
    if (prop.ownerId === debtorId && prop.level > 0) {
      const tile = MONOPOLY_TILES[Number(idxStr)];
      const sellVal = Math.round((tile.upgradeCost ?? 400) * 0.8);
      while (prop.level > 0 && debtor.cash < amount) {
        prop.level -= 1;
        debtor.cash += sellVal;
      }
    }
  }
  for (const [idxStr, prop] of Object.entries(properties)) {
    if (debtor.cash >= amount) break;
    if (prop.ownerId === debtorId) {
      const tile = MONOPOLY_TILES[Number(idxStr)];
      debtor.cash += Math.round((tile.price ?? 500) * 0.6);
      prop.ownerId = null;
      prop.level = 0;
    }
  }

  if (debtor.cash >= amount) {
    debtor.cash -= amount;
    if (creditor) creditor.cash += amount;
    return { state: { ...state, players, properties }, wentBankrupt: false, paidAmount: amount };
  }

  // Bankruptcy
  const paid = Math.max(0, debtor.cash);
  if (creditor) creditor.cash += paid;
  debtor.cash = 0;
  debtor.bankrupt = true;
  for (const prop of Object.values(properties)) {
    if (prop.ownerId === debtorId) {
      prop.ownerId = creditor ? creditor.playerId : null;
    }
  }

  return { state: { ...state, players, properties }, wentBankrupt: true, paidAmount: paid };
}

function buildScoreDeltas(
  rankings: Array<{ playerId: string; netWorth: number }> | undefined,
): Record<string, number> | undefined {
  if (!rankings || rankings.length === 0) return undefined;
  const pts = [3, 2, 1];
  const scoreDeltas: Record<string, number> = {};
  for (let i = 0; i < Math.min(3, rankings.length); i++) {
    scoreDeltas[rankings[i].playerId] = pts[i];
  }
  return scoreDeltas;
}

function finalizeGame(state: MonopolyState): MonopolyState {
  const rankings = state.players
    .map((p) => ({
      playerId: p.playerId,
      netWorth: computeNetWorth(p, state.properties),
    }))
    .sort((a, b) => b.netWorth - a.netWorth);
  return {
    ...state,
    phase: 'game_over',
    winnerId: rankings[0]?.playerId,
    rankings,
    auction: null,
    phaseDeadline: undefined,
  };
}

function advanceTurn(state: MonopolyState, now: number): GameStepResult<MonopolyState> {
  const solvent = state.players.filter((p) => !p.bankrupt);
  if (solvent.length <= 1) {
    const finalized = finalizeGame(state);
    return {
      state: finalized,
      voiceClip: 'tycoon_winner',
      scoreDeltas: buildScoreDeltas(finalized.rankings),
    };
  }

  // If rolled doubles and not in jail and streak < 3, allow bonus roll!
  const current = state.players[state.activeCursor];
  if (
    state.lastDice &&
    state.lastDice[0] === state.lastDice[1] &&
    state.doublesStreak > 0 &&
    state.doublesStreak < 3 &&
    !current.inJail &&
    !current.bankrupt
  ) {
    return {
      state: {
        ...state,
        phase: 'roll',
        phaseDeadline: now + 22_000,
      },
    };
  }

  let nextCursor = state.activeCursor;
  let nextRound = state.round;
  for (let i = 1; i <= state.players.length; i++) {
    const candidate = (state.activeCursor + i) % state.players.length;
    if (!state.players[candidate].bankrupt) {
      if (candidate <= state.activeCursor) {
        nextRound += 1;
      }
      nextCursor = candidate;
      break;
    }
  }

  if (nextRound > state.options.maxRounds) {
    const finalized = finalizeGame(state);
    return {
      state: finalized,
      voiceClip: 'tycoon_winner',
      scoreDeltas: buildScoreDeltas(finalized.rankings),
    };
  }

  return {
    state: {
      ...state,
      round: nextRound,
      activeCursor: nextCursor,
      doublesStreak: 0,
      phase: 'roll',
      phaseDeadline: now + 22_000,
    },
  };
}

function finishTurnOrUpgrade(
  state: MonopolyState,
  now: number,
  sfx: string,
  voiceClip?: string,
): GameStepResult<MonopolyState> {
  const solvent = state.players.filter((p) => !p.bankrupt);
  if (solvent.length <= 1) {
    const fin = advanceTurn(state, now);
    return { ...fin, voiceClip: voiceClip ?? fin.voiceClip, sfx };
  }
  const active = state.players[state.activeCursor];
  if (
    active &&
    !active.bankrupt &&
    !active.inJail &&
    getUpgradableTileIndices(active, state.properties).length > 0
  ) {
    return {
      state: {
        ...state,
        phase: 'turn_end',
        phaseDeadline: now + 14_000,
      },
      voiceClip,
      sfx,
    };
  }
  const next = advanceTurn(state, now);
  return {
    ...next,
    voiceClip: next.state.phase === 'game_over' ? next.voiceClip : voiceClip ?? next.voiceClip,
    sfx,
  };
}

function resolveChargedTurn(
  state: MonopolyState,
  wentBankrupt: boolean,
  now: number,
  sfx: string,
  allowUpgradeIfSolvent = false,
): GameStepResult<MonopolyState> {
  if (!wentBankrupt && allowUpgradeIfSolvent) {
    return finishTurnOrUpgrade(state, now, sfx);
  }
  const next = advanceTurn(state, now);
  return {
    ...next,
    voiceClip:
      next.state.phase === 'game_over'
        ? next.voiceClip
        : wentBankrupt
          ? 'bankrupt'
          : next.voiceClip,
    sfx,
  };
}

function startAuction(
  state: MonopolyState,
  tileIndex: number,
  now: number,
): { state: MonopolyState; voiceClip: string; sfx: string } {
  const tile = MONOPOLY_TILES[tileIndex];
  const nextState = withEvent(
    {
      ...state,
      phase: 'auction',
      auction: {
        tileIndex,
        highestBid: 0,
        highestBidderId: null,
        passedIds: [],
        endsAt: now + 10_000,
      },
      phaseDeadline: now + 10_000,
    },
    {
      zh: `🔨 「${tile.name.zh}」开启全员 10 秒实时抢拍！`,
      en: `🔨 Live 10s auction started for "${tile.name.en}"!`,
    },
  );
  return {
    state: nextState,
    voiceClip: 'auction_start',
    sfx: 'gavelBang',
  };
}

function settleAuction(state: MonopolyState, now: number): GameStepResult<MonopolyState> {
  const auction = state.auction;
  if (!auction) return advanceTurn(state, now);

  const players = state.players.map((p) => ({ ...p }));
  const properties: Record<number, MonopolyPropertyState> = {};
  for (const [k, v] of Object.entries(state.properties)) {
    properties[Number(k)] = { ...v };
  }
  const tile = MONOPOLY_TILES[auction.tileIndex];

  let lastEvent: LocalizedText;
  if (auction.highestBidderId && auction.highestBid > 0) {
    const winner = players.find((p) => p.playerId === auction.highestBidderId);
    if (winner && winner.cash >= auction.highestBid) {
      winner.cash -= auction.highestBid;
      properties[auction.tileIndex] = { ownerId: winner.playerId, level: 0 };
      lastEvent = {
        zh: `拍卖成交！以 ¥${auction.highestBid} 拍得「${tile.name.zh}」`,
        en: `Sold! "${tile.name.en}" won at auction for ¥${auction.highestBid}`,
      };
    } else {
      lastEvent = {
        zh: `「${tile.name.zh}」拍卖流拍`,
        en: `Auction for "${tile.name.en}" ended without sale`,
      };
    }
  } else {
    lastEvent = {
      zh: `无人出价，「${tile.name.zh}」保持无主`,
      en: `No bids—"${tile.name.en}" remains unowned`,
    };
  }

  return advanceTurn(
    withEvent(
      {
        ...state,
        players,
        properties,
        auction: null,
      },
      lastEvent,
    ),
    now,
  );
}

export const monopolyGame: GameDefinition<
  MonopolyState,
  MonopolyOptions,
  MonopolyPublicState,
  MonopolyPrivateState,
  MonopolyAction
> = {
  id: 'monopoly',
  minPlayers: 2,
  maxPlayers: 10,
  defaultOptions: {
    startingCash: 10000,
    maxRounds: 12,
    partyTurboRent: false,
  },

  createInitialState(seats: PlayerSeat[], rawOptions: MonopolyOptions) {
    const options: MonopolyOptions = { ...this.defaultOptions, ...rawOptions };
    const seatOrder = seats.map((s) => s.id);
    const properties: Record<number, MonopolyPropertyState> = {};
    for (const t of MONOPOLY_TILES) {
      if (t.kind === 'property' || t.kind === 'transit' || t.kind === 'utility') {
        properties[t.index] = { ownerId: null, level: 0 };
      }
    }
    const players = seatOrder.map((id, idx) => ({
      playerId: id,
      position: 0,
      cash: options.startingCash,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      bankrupt: false,
      colorHex: PLAYER_COLORS[idx % PLAYER_COLORS.length],
    }));

    const initEvent: LocalizedText = {
      zh: '大都市开盘！全员起始资金 ¥' + options.startingCash,
      en: `Metropolis opens! Everyone starts with ¥${options.startingCash}`,
    };

    return {
      state: {
        options,
        phase: 'roll',
        round: 1,
        seatOrder,
        activeCursor: 0,
        lastDice: null,
        doublesStreak: 0,
        players,
        properties,
        auction: null,
        lastEvent: initEvent,
        jackpotPool: 500,
        eventLog: [{ round: 1, text: initEvent }],
        phaseDeadline: Date.now() + 22_000,
      },
      voiceClip: 'game_starting',
    };
  },

  applyAction(state, actorId, action) {
    const now = Date.now();
    if (state.phase === 'game_over') return { state };

    const activePlayer = state.players[state.activeCursor];

    if (action.type === 'auction_bid' || action.type === 'auction_pass') {
      if (state.phase !== 'auction' || !state.auction) return { state };
      const bidder = state.players.find((p) => p.playerId === actorId && !p.bankrupt);
      if (!bidder) return { state };

      if (action.type === 'auction_pass') {
        const passedIds = state.auction.passedIds.includes(actorId)
          ? state.auction.passedIds
          : [...state.auction.passedIds, actorId];
        const nextAuction = { ...state.auction, passedIds };
        const solventIds = state.players.filter((p) => !p.bankrupt).map((p) => p.playerId);
        const remainingPotential = solventIds.filter(
          (id) => id !== nextAuction.highestBidderId && !passedIds.includes(id),
        );
        if (
          remainingPotential.length === 0 &&
          (nextAuction.highestBidderId !== null || passedIds.length >= solventIds.length)
        ) {
          return { ...settleAuction({ ...state, auction: nextAuction }, now), sfx: 'gavelBang' };
        }
        return { state: { ...state, auction: nextAuction }, sfx: 'buttonTap' };
      }

      const delta = Math.max(100, Math.min(2000, Math.floor(action.delta || 100)));
      const newBid = state.auction.highestBid + delta;
      if (bidder.cash < newBid) {
        return { state, error: 'Insufficient cash for bid' };
      }
      const endsAt = Math.max(state.auction.endsAt, now + 4500);
      return {
        state: {
          ...state,
          auction: {
            ...state.auction,
            highestBid: newBid,
            highestBidderId: actorId,
            passedIds: state.auction.passedIds.filter((id) => id !== actorId),
            endsAt,
          },
          phaseDeadline: endsAt,
        },
        sfx: 'chipClink',
      };
    }

    if (actorId !== activePlayer.playerId) {
      return { state, error: 'Not your turn' };
    }

    if (action.type === 'pay_jail_bail' && state.phase === 'roll' && activePlayer.inJail) {
      const players = state.players.map((p) => ({ ...p }));
      const p = players[state.activeCursor];
      if (p.jailFreeCards > 0) {
        p.jailFreeCards -= 1;
        p.inJail = false;
        p.jailTurns = 0;
        return {
          state: withEvent(
            {
              ...state,
              players,
            },
            { zh: '使用免罪卡离开拘留所！', en: 'Used Pardon Card to leave Jail!' },
          ),
          sfx: 'chipClink',
        };
      }
      if (p.cash >= 500) {
        p.cash -= 500;
        p.inJail = false;
        p.jailTurns = 0;
        return {
          state: withEvent(
            {
              ...state,
              players,
              jackpotPool: state.jackpotPool + 500,
            },
            {
              zh: '缴纳 ¥500 保释金重获自由（¥500 注入广场奖池）！',
              en: 'Paid ¥500 bail to exit Jail (+¥500 to Jackpot Pool)!',
            },
          ),
          sfx: 'chipClink',
        };
      }
      return { state, error: 'Not enough cash for bail' };
    }

    if (action.type === 'roll_dice') {
      if (state.phase !== 'roll') return { state };
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const isDouble = d1 === d2;
      const sum = d1 + d2;

      const players = state.players.map((p) => ({ ...p }));
      const p = players[state.activeCursor];

      if (p.inJail) {
        if (isDouble || p.jailTurns >= 2) {
          p.inJail = false;
          p.jailTurns = 0;
        } else {
          p.jailTurns += 1;
          return {
            ...advanceTurn(
              withEvent(
                {
                  ...state,
                  players,
                  lastDice: [d1, d2],
                  doublesStreak: 0,
                },
                {
                  zh: `掷出 ${d1}+${d2}，仍需留守审计拘留所`,
                  en: `Rolled ${d1}+${d2}—remaining in Audit Jail`,
                },
              ),
              now,
            ),
            sfx: 'diceRoll',
          };
        }
      }

      const doublesStreak = isDouble ? state.doublesStreak + 1 : 0;
      if (doublesStreak >= 3) {
        p.position = 7;
        p.inJail = true;
        p.jailTurns = 0;
        return {
          ...advanceTurn(
            withEvent(
              {
                ...state,
                players,
                lastDice: [d1, d2],
                doublesStreak: 0,
              },
              {
                zh: '连续三次双数超速，被送入审计拘留所！',
                en: 'Three doubles in a row! Sent to Audit Jail!',
              },
            ),
            now,
          ),
          sfx: 'gavelBang',
        };
      }

      const oldPos = p.position;
      const newPos = (oldPos + sum) % MONOPOLY_TILES.length;
      let passedStartBonus = 0;
      if (newPos < oldPos) {
        passedStartBonus = 2000;
        p.cash += 2000;
      }
      p.position = newPos;

      const tile = MONOPOLY_TILES[newPos];
      let workingState: MonopolyState = {
        ...state,
        players,
        lastDice: [d1, d2],
        doublesStreak,
      };

      if (tile.kind === 'go_jail') {
        p.position = 7;
        p.inJail = true;
        p.jailTurns = 0;
        return {
          ...advanceTurn(
            withEvent(
              {
                ...workingState,
                doublesStreak: 0,
              },
              {
                zh: `掷出 ${sum} 点踏入税务稽查，直接进入拘留所！`,
                en: `Rolled ${sum} and landed on Go To Jail!`,
              },
            ),
            now,
          ),
          sfx: 'gavelBang',
        };
      }

      if (tile.kind === 'tax') {
        const tax = tile.taxAmount ?? 800;
        const charged = chargePlayer(workingState, p.playerId, tax, null);
        const evt: LocalizedText = {
          zh: `支付奢侈品税 ¥${tax}（¥${charged.paidAmount} 注入广场奖池）${charged.wentBankrupt ? '（破产！）' : ''}`,
          en: `Paid Luxury Tax ¥${tax} (+¥${charged.paidAmount} to Jackpot Pool)${charged.wentBankrupt ? ' (Bankrupt!)' : ''}`,
        };
        const taxedState = withEvent(
          {
            ...charged.state,
            jackpotPool: charged.state.jackpotPool + charged.paidAmount,
          },
          evt,
        );
        return resolveChargedTurn(taxedState, charged.wentBankrupt, now, 'diceRoll');
      }

      if (tile.kind === 'chance' || tile.kind === 'chest') {
        const deck = tile.kind === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
        const card = deck[Math.floor(Math.random() * deck.length)];
        let cardEvent = card.text;
        let cardSfx = 'diceRoll';

        if (card.moveTo !== undefined) {
          p.position = card.moveTo;
          if (card.moveTo === 0) {
            p.cash += 2000;
          } else if (card.moveTo === 14) {
            const prize = workingState.jackpotPool;
            p.cash += prize;
            workingState = { ...workingState, jackpotPool: 500 };
            cardSfx = 'cashRegister';
            cardEvent = {
              zh: `${card.text.zh} 喜提头奖奖池 ¥${prize}！`,
              en: `${card.text.en} Won ¥${prize} Jackpot Pool!`,
            };
          }
        }
        if (card.grantJailCard) {
          p.jailFreeCards += 1;
        }
        if (card.collectFromAll) {
          for (const other of players) {
            if (!other.bankrupt && other.playerId !== p.playerId) {
              const pay = Math.min(other.cash, card.collectFromAll);
              other.cash -= pay;
              p.cash += pay;
            }
          }
        }
        if (card.cashDelta && card.cashDelta > 0 && card.moveTo !== 0) {
          p.cash += card.cashDelta;
        } else if (card.cashDelta && card.cashDelta < 0) {
          const charged = chargePlayer(workingState, p.playerId, -card.cashDelta, null);
          const finedState = withEvent(
            {
              ...charged.state,
              jackpotPool: charged.state.jackpotPool + charged.paidAmount,
            },
            cardEvent,
          );
          return resolveChargedTurn(finedState, charged.wentBankrupt, now, 'diceRoll', true);
        }
        return finishTurnOrUpgrade(withEvent(workingState, cardEvent), now, cardSfx);
      }

      if (tile.kind === 'property' || tile.kind === 'transit' || tile.kind === 'utility') {
        const prop = workingState.properties[tile.index];
        if (!prop.ownerId) {
          // If player can afford, give buy_decision; otherwise go straight to live auction!
          if (p.cash >= (tile.price ?? 0)) {
            return {
              state: withEvent(
                {
                  ...workingState,
                  phase: 'buy_decision',
                  phaseDeadline: now + 18_000,
                },
                {
                  zh: `掷出 ${sum} 点来到「${tile.name.zh}」，是否以 ¥${tile.price} 购入？`,
                  en: `Rolled ${sum}, landed on "${tile.name.en}". Buy for ¥${tile.price}?`,
                },
              ),
              sfx: 'diceRoll',
            };
          }
          return startAuction(workingState, tile.index, now);
        }

        if (prop.ownerId === p.playerId) {
          const canUpgradeAny = getUpgradableTileIndices(p, workingState.properties).length > 0;
          const ownState = withEvent(workingState, {
            zh: canUpgradeAny
              ? `回到自家领地「${tile.name.zh}」，可选择建造升级！`
              : `来到自家领地「${tile.name.zh}」`,
            en: canUpgradeAny
              ? `Visited own "${tile.name.en}"—building upgrades available!`
              : `Landed on own "${tile.name.en}"`,
          });
          return finishTurnOrUpgrade(ownState, now, 'diceRoll');
        }

        // Pay rent to opponent
        const rent = calculateRent(
          tile,
          prop,
          workingState.properties,
          sum,
          workingState.options.partyTurboRent,
        );
        const charged = chargePlayer(workingState, p.playerId, rent, prop.ownerId);
        const rentState = withEvent(charged.state, {
          zh: `踩中「${tile.name.zh}」，向地主缴纳租金 ¥${rent}${charged.wentBankrupt ? '（破产！）' : ''}`,
          en: `Paid ¥${rent} rent at "${tile.name.en}"${charged.wentBankrupt ? ' (Bankrupt!)' : ''}`,
        });
        return resolveChargedTurn(rentState, charged.wentBankrupt, now, 'chipClink');
      }

      if (tile.kind === 'park') {
        const prize = workingState.jackpotPool;
        p.cash += prize;
        const parkState = withEvent(
          {
            ...workingState,
            jackpotPool: 500,
          },
          {
            zh:
              passedStartBonus > 0
                ? `🎉 经过起点领 ¥2000 并踏入免税派对广场！喜提头奖奖池 ¥${prize}！`
                : `🎉 踏入免税派对广场！喜提头奖奖池 ¥${prize}！`,
            en:
              passedStartBonus > 0
                ? `🎉 Passed START (+¥2000) & landed on Jackpot Plaza! Won ¥${prize} pool!`
                : `🎉 Landed on Jackpot Plaza! Won the ¥${prize} prize pool!`,
          },
        );
        return finishTurnOrUpgrade(parkState, now, 'cashRegister');
      }

      // Start or Jail (just visiting)
      const neutralState = withEvent(workingState, {
        zh:
          passedStartBonus > 0
            ? `经过起点领 ¥2000，停在「${tile.name.zh}」`
            : tile.kind === 'jail'
              ? `探访「${tile.name.zh}」（仅路过免受稽查）`
              : `悠闲停驻在「${tile.name.zh}」`,
        en:
          passedStartBonus > 0
            ? `Passed START (+¥2000) & landed on ${tile.name.en}`
            : tile.kind === 'jail'
              ? `Just visiting ${tile.name.en}`
              : `Resting at ${tile.name.en}`,
      });
      return finishTurnOrUpgrade(neutralState, now, 'diceRoll');
    }

    if (action.type === 'buy_property') {
      if (state.phase !== 'buy_decision') return { state };
      const tile = MONOPOLY_TILES[activePlayer.position];
      const price = tile.price ?? 0;
      if (activePlayer.cash < price) {
        return startAuction(state, tile.index, now);
      }
      const players = state.players.map((p, i) =>
        i === state.activeCursor ? { ...p, cash: p.cash - price } : { ...p },
      );
      const properties = {
        ...state.properties,
        [tile.index]: { ownerId: activePlayer.playerId, level: 0 },
      };
      const boughtState = withEvent(
        {
          ...state,
          players,
          properties,
        },
        {
          zh: `豪掷 ¥${price} 买下「${tile.name.zh}」！`,
          en: `Purchased "${tile.name.en}" for ¥${price}!`,
        },
      );
      return finishTurnOrUpgrade(boughtState, now, 'chipClink');
    }

    if (action.type === 'pass_property') {
      if (state.phase !== 'buy_decision') return { state };
      return startAuction(state, activePlayer.position, now);
    }

    if (action.type === 'upgrade_property') {
      if (state.phase !== 'turn_end') return { state };
      const prop = state.properties[action.tileIndex];
      const tile = MONOPOLY_TILES[action.tileIndex];
      if (
        !prop ||
        !tile ||
        prop.ownerId !== activePlayer.playerId ||
        tile.kind !== 'property' ||
        prop.level >= 4
      ) {
        return { state };
      }
      const cost = tile.upgradeCost ?? 500;
      if (activePlayer.cash < cost) return { state };

      const players = state.players.map((p, i) =>
        i === state.activeCursor ? { ...p, cash: p.cash - cost } : { ...p },
      );
      const properties = {
        ...state.properties,
        [action.tileIndex]: { ...prop, level: prop.level + 1 },
      };
      return {
        ...advanceTurn(
          withEvent(
            {
              ...state,
              players,
              properties,
            },
            {
              zh: `花费 ¥${cost} 将「${tile.name.zh}」扩建至 Lv.${prop.level + 1}！`,
              en: `Upgraded "${tile.name.en}" to Lv.${prop.level + 1} for ¥${cost}!`,
            },
          ),
          now,
        ),
        sfx: 'cashRegister',
      };
    }

    if (action.type === 'end_turn') {
      if (state.phase !== 'turn_end') return { state };
      return advanceTurn(state, now);
    }

    return { state };
  },

  onTick(state, now) {
    if (!state.phaseDeadline || now < state.phaseDeadline || state.phase === 'game_over') {
      return null;
    }
    if (state.phase === 'auction') {
      return settleAuction(state, now);
    }
    if (state.phase === 'roll') {
      return this.applyAction(
        state,
        state.players[state.activeCursor].playerId,
        { type: 'roll_dice' },
        [],
      );
    }
    if (state.phase === 'buy_decision') {
      return startAuction(state, state.players[state.activeCursor].position, now);
    }
    if (state.phase === 'turn_end') {
      return advanceTurn(state, now);
    }
    return null;
  },

  forceSkipCurrent(state) {
    if (state.phase === 'game_over') return { state };
    const now = Date.now();
    return this.onTick?.({ ...state, phaseDeadline: now - 1 }, now, []) ?? { state };
  },

  projectPublic(state): MonopolyPublicState {
    const players: MonopolyPlayerPublic[] = state.players.map((p) => ({
      ...p,
      netWorth: computeNetWorth(p, state.properties),
    }));
    return {
      phase: state.phase,
      round: state.round,
      maxRounds: state.options.maxRounds,
      activePlayerId: state.players[state.activeCursor]?.playerId ?? state.seatOrder[0],
      lastDice: state.lastDice,
      doublesStreak: state.doublesStreak,
      tiles: MONOPOLY_TILES,
      properties: state.properties,
      players,
      auction: state.auction,
      lastEvent: state.lastEvent,
      jackpotPool: state.jackpotPool,
      eventLog: state.eventLog,
      partyTurboRent: state.options.partyTurboRent,
      winnerId: state.winnerId,
      rankings: state.rankings,
      phaseDeadline: state.phaseDeadline,
    };
  },

  projectPrivate(state, playerId): MonopolyPrivateState {
    const activePlayer = state.players[state.activeCursor];
    const me = state.players.find((p) => p.playerId === playerId);
    const isActive = activePlayer?.playerId === playerId;
    const tile = MONOPOLY_TILES[activePlayer?.position ?? 0];

    const canUpgradeTiles =
      isActive && state.phase === 'turn_end' && me
        ? getUpgradableTileIndices(me, state.properties)
        : [];

    const canBidInAuction =
      state.phase === 'auction' &&
      Boolean(state.auction) &&
      Boolean(me && !me.bankrupt) &&
      state.auction!.highestBidderId !== playerId &&
      !state.auction!.passedIds.includes(playerId) &&
      (me?.cash ?? 0) >= (state.auction?.highestBid ?? 0) + 100;

    return {
      playerId,
      isActiveTurn: isActive,
      canRoll: isActive && state.phase === 'roll',
      canBuyCurrentTile:
        isActive &&
        state.phase === 'buy_decision' &&
        Boolean(me && me.cash >= (tile.price ?? 0)),
      canUpgradeTiles,
      canBidInAuction,
    };
  },

  computeBotAction(state, botId) {
    if (state.phase === 'game_over') return null;

    if (state.phase === 'auction' && state.auction) {
      const me = state.players.find((p) => p.playerId === botId && !p.bankrupt);
      if (
        !me ||
        state.auction.highestBidderId === botId ||
        state.auction.passedIds.includes(botId)
      ) {
        return null;
      }
      const tile = MONOPOLY_TILES[state.auction.tileIndex];
      const maxWilling = Math.min(me.cash * 0.65, (tile.price ?? 800) * 1.15);
      if (state.auction.highestBid + 100 <= maxWilling) {
        return { type: 'auction_bid', delta: 100 };
      }
      return { type: 'auction_pass' };
    }

    const active = state.players[state.activeCursor];
    if (active.playerId !== botId) return null;

    if (state.phase === 'roll') {
      if (active.inJail && active.cash > 2500) {
        return { type: 'pay_jail_bail' };
      }
      return { type: 'roll_dice' };
    }

    if (state.phase === 'buy_decision') {
      const tile = MONOPOLY_TILES[active.position];
      const price = tile.price ?? 0;
      if (active.cash >= price + 500 || (active.cash >= price && Math.random() < 0.7)) {
        return { type: 'buy_property' };
      }
      return { type: 'pass_property' };
    }

    if (state.phase === 'turn_end') {
      const upgradable = getUpgradableTileIndices(active, state.properties)
        .filter((idx) => active.cash >= (MONOPOLY_TILES[idx].upgradeCost ?? 0) + 1200)
        .sort((a, b) => (MONOPOLY_TILES[b].baseRent ?? 0) - (MONOPOLY_TILES[a].baseRent ?? 0));
      if (upgradable.length > 0) {
        return { type: 'upgrade_property', tileIndex: upgradable[0] };
      }
      return { type: 'end_turn' };
    }

    return null;
  },
};
