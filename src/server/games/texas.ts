import type { PlayerSeat } from '../../shared/types.js';
import type {
  LocalizedText,
  PlayingCard,
  TexasOptions,
  TexasPlayerPublic,
  TexasPrivateState,
  TexasPublicState,
  TexasSidePot,
} from '../../shared/gameTypes.js';
import {
  compareEvaluatedHands,
  createShuffledDeck,
  evaluateTexasHand,
  type EvaluatedHand,
} from '../../shared/pokerEvaluator.js';
import type { GameDefinition } from './engine.js';

export interface TexasPlayerState {
  playerId: string;
  chips: number;
  holeCards: PlayingCard[];
  betThisStreet: number;
  committedThisHand: number;
  folded: boolean;
  allIn: boolean;
  busted: boolean;
  rebuyCount: number;
  totalBuyIn: number;
  lastAction?: LocalizedText;
}

export interface TexasState {
  options: TexasOptions;
  phase: TexasPublicState['phase'];
  handNumber: number;
  seatOrder: string[];
  dealerCursor: number;
  smallBlindId: string;
  bigBlindId: string;
  currentSmallBlind: number;
  currentBigBlind: number;
  activePlayerId: string | null;
  deck: PlayingCard[];
  communityCards: PlayingCard[];
  players: TexasPlayerState[];
  currentBet: number;
  minRaiseDelta: number;
  actedThisStreet: string[];
  showdownResults?: TexasPublicState['showdownResults'];
  revealedHands?: Record<string, { cards: PlayingCard[]; label: LocalizedText }>;
  winningFiveByPlayer?: Record<string, PlayingCard[]>;
  rankings?: TexasPublicState['rankings'];
  phaseDeadline?: number;
}

export type TexasAction =
  | { type: 'fold' }
  | { type: 'check_call' }
  | { type: 'raise_to'; amount: number }
  | { type: 'all_in' }
  | { type: 'reveal_bluff' }
  | { type: 'settle_session' }
  | { type: 'next_hand' };

function activeNonBustedIndices(players: TexasPlayerState[]): number[] {
  return players.map((p, i) => (!p.busted ? i : -1)).filter((i) => i >= 0);
}

function nextIndexWhere(
  players: TexasPlayerState[],
  fromIdx: number,
  pred: (p: TexasPlayerState) => boolean,
): number | null {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIdx + offset) % n;
    if (pred(players[idx])) return idx;
  }
  return null;
}

function totalPot(players: TexasPlayerState[]): number {
  return players.reduce((sum, p) => sum + p.committedThisHand, 0);
}

export function computeSidePots(players: TexasPlayerState[]): TexasSidePot[] {
  const levels = Array.from(
    new Set(players.filter((p) => p.committedThisHand > 0).map((p) => p.committedThisHand)),
  ).sort((a, b) => a - b);

  const rawPots: TexasSidePot[] = [];
  let prev = 0;
  for (const lvl of levels) {
    let amount = 0;
    const eligibleIds: string[] = [];
    for (const p of players) {
      if (p.committedThisHand > prev) {
        amount += Math.min(p.committedThisHand, lvl) - prev;
      }
      if (!p.folded && p.committedThisHand >= lvl) {
        eligibleIds.push(p.playerId);
      }
    }
    if (amount > 0 && eligibleIds.length > 0) {
      const last = rawPots[rawPots.length - 1];
      if (
        last &&
        last.eligibleIds.length === eligibleIds.length &&
        last.eligibleIds.every((id, i) => id === eligibleIds[i])
      ) {
        last.amount += amount;
      } else {
        rawPots.push({ amount, eligibleIds });
      }
    }
    prev = lvl;
  }
  return rawPots;
}

function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function computeCurrentBlinds(
  handNumber: number,
  options: TexasOptions,
): { smallBlind: number; bigBlind: number } {
  const every = options.blindIncreaseEveryHands ?? 0;
  if (every <= 0 || handNumber <= every) {
    return { smallBlind: options.smallBlind, bigBlind: options.bigBlind };
  }
  const level = Math.floor((handNumber - 1) / every);
  const factor = Math.pow(1.5, level);
  const smallBlind = roundToFive(options.smallBlind * factor);
  const bigBlind =
    options.bigBlind === options.smallBlind * 2
      ? smallBlind * 2
      : Math.max(smallBlind, roundToFive(options.bigBlind * factor));
  return { smallBlind, bigBlind };
}

function computeRankings(
  players: TexasPlayerState[],
): NonNullable<TexasPublicState['rankings']> {
  return [...players]
    .map((p) => ({
      playerId: p.playerId,
      chips: p.chips,
      rebuyCount: p.rebuyCount,
      netProfit: p.chips - p.totalBuyIn,
    }))
    .sort((a, b) => {
      if (b.netProfit !== a.netProfit) return b.netProfit - a.netProfit;
      return b.chips - a.chips;
    });
}

function computeScoreDeltas(
  rankings: NonNullable<TexasPublicState['rankings']>,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const rewards = [3, 2, 1];
  for (let i = 0; i < Math.min(rewards.length, rankings.length); i++) {
    deltas[rankings[i].playerId] = rewards[i];
  }
  return deltas;
}

function postForcedBet(player: TexasPlayerState, amount: number, label: LocalizedText) {
  const paid = Math.min(player.chips, amount);
  player.chips -= paid;
  player.betThisStreet += paid;
  player.committedThisHand += paid;
  if (player.chips === 0) player.allIn = true;
  player.lastAction = label;
}

function startNewHand(
  seatOrder: string[],
  prevPlayers: TexasPlayerState[],
  prevDealerCursor: number,
  handNumber: number,
  options: TexasOptions,
  now: number,
): TexasState {
  const deck = createShuffledDeck();
  const players: TexasPlayerState[] = prevPlayers.map((p) => {
    const didRebuy = p.chips <= 0 && options.allowRebuy;
    const chips = didRebuy ? options.startingChips : p.chips;
    return {
      playerId: p.playerId,
      chips,
      holeCards: [],
      betThisStreet: 0,
      committedThisHand: 0,
      folded: chips <= 0,
      allIn: false,
      busted: chips <= 0,
      rebuyCount: p.rebuyCount + (didRebuy ? 1 : 0),
      totalBuyIn: p.totalBuyIn + (didRebuy ? options.startingChips : 0),
      lastAction: undefined,
    };
  });

  const { smallBlind, bigBlind } = computeCurrentBlinds(handNumber, options);
  const liveIndices = activeNonBustedIndices(players);
  if (liveIndices.length < 2) {
    return {
      options,
      phase: 'game_over',
      handNumber: handNumber > 1 ? handNumber - 1 : handNumber,
      seatOrder,
      dealerCursor: prevDealerCursor,
      smallBlindId: seatOrder[0],
      bigBlindId: seatOrder[0],
      currentSmallBlind: smallBlind,
      currentBigBlind: bigBlind,
      activePlayerId: null,
      deck,
      communityCards: [],
      players,
      currentBet: 0,
      minRaiseDelta: bigBlind,
      actedThisStreet: [],
      rankings: computeRankings(players),
    };
  }

  let dealerIdx = prevDealerCursor;
  if (handNumber > 1) {
    dealerIdx =
      nextIndexWhere(players, prevDealerCursor, (p) => !p.busted) ?? liveIndices[0];
  } else {
    dealerIdx = liveIndices[0];
  }

  // Deal 2 hole cards to active players
  for (const idx of liveIndices) {
    players[idx].holeCards = [deck.pop()!, deck.pop()!];
  }

  const isHeadsUp = liveIndices.length === 2;
  const sbIdx = isHeadsUp
    ? dealerIdx
    : nextIndexWhere(players, dealerIdx, (p) => !p.busted)!;
  const bbIdx = nextIndexWhere(players, sbIdx, (p) => !p.busted)!;

  postForcedBet(players[sbIdx], smallBlind, {
    zh: `小盲 ¥${smallBlind}`,
    en: `SB ${smallBlind}`,
  });
  postForcedBet(players[bbIdx], bigBlind, {
    zh: `大盲 ¥${bigBlind}`,
    en: `BB ${bigBlind}`,
  });

  const currentBet = Math.max(players[sbIdx].betThisStreet, players[bbIdx].betThisStreet);
  const firstActorIdx = nextIndexWhere(players, bbIdx, (p) => !p.folded && !p.allIn);

  const state: TexasState = {
    options,
    phase: 'preflop',
    handNumber,
    seatOrder,
    dealerCursor: dealerIdx,
    smallBlindId: players[sbIdx].playerId,
    bigBlindId: players[bbIdx].playerId,
    currentSmallBlind: smallBlind,
    currentBigBlind: bigBlind,
    activePlayerId: firstActorIdx !== null ? players[firstActorIdx].playerId : null,
    deck,
    communityCards: [],
    players,
    currentBet,
    minRaiseDelta: bigBlind,
    actedThisStreet: [],
    phaseDeadline: now + options.turnSeconds * 1000,
  };

  if (!state.activePlayerId) {
    return advanceStreetOrShowdown(state, now);
  }
  return state;
}

function resolveShowdown(state: TexasState, now: number): TexasState {
  const players = state.players.map((p) => ({ ...p }));
  const contenders = players.filter((p) => !p.folded);

  const deck = [...state.deck];
  const community = [...state.communityCards];

  // Single survivor (everyone else folded)
  if (contenders.length === 1) {
    const winner = contenders[0];
    const potAmount = totalPot(players);
    winner.chips += potAmount;
    return {
      ...state,
      phase: 'showdown',
      deck,
      communityCards: community,
      players,
      activePlayerId: null,
      showdownResults: [
        {
          potIndex: 0,
          amount: potAmount,
          winnerIds: [winner.playerId],
          handLabel: { zh: '对手全数弃牌胜出', en: 'Won Uncontested' },
        },
      ],
      revealedHands: {},
      winningFiveByPlayer: {},
      phaseDeadline: now + 6500,
    };
  }

  // Deal remaining community cards if all-in early
  while (community.length < 5 && deck.length > 0) {
    community.push(deck.pop()!);
  }

  const evaluations = new Map<string, EvaluatedHand>();
  const revealedHands: Record<string, { cards: PlayingCard[]; label: LocalizedText }> = {};
  for (const p of contenders) {
    const ev = evaluateTexasHand([...p.holeCards, ...community]);
    evaluations.set(p.playerId, ev);
    revealedHands[p.playerId] = {
      cards: p.holeCards,
      label: { zh: ev.labelZh, en: ev.labelEn },
    };
  }

  const pots = computeSidePots(players);
  const showdownResults: NonNullable<TexasPublicState['showdownResults']> = [];
  const winningFiveByPlayer: Record<string, PlayingCard[]> = {};

  pots.forEach((pot, potIndex) => {
    if (pot.eligibleIds.length === 1) {
      // Uncalled bet returned directly
      const onlyPlayer = players.find((p) => p.playerId === pot.eligibleIds[0]);
      if (onlyPlayer) onlyPlayer.chips += pot.amount;
      return;
    }

    let bestIds: string[] = [];
    let bestEval: EvaluatedHand | null = null;
    for (const pid of pot.eligibleIds) {
      const ev = evaluations.get(pid)!;
      if (!bestEval) {
        bestEval = ev;
        bestIds = [pid];
      } else {
        const cmp = compareEvaluatedHands(ev, bestEval);
        if (cmp > 0) {
          bestEval = ev;
          bestIds = [pid];
        } else if (cmp === 0) {
          bestIds.push(pid);
        }
      }
    }

    const share = Math.floor(pot.amount / bestIds.length);
    let remainder = pot.amount % bestIds.length;
    // Order winners clockwise from left of dealer for odd chips
    const orderedWinners = [...bestIds].sort((a, b) => {
      const ia = players.findIndex((p) => p.playerId === a);
      const ib = players.findIndex((p) => p.playerId === b);
      const da = (ia - state.dealerCursor - 1 + players.length) % players.length;
      const db = (ib - state.dealerCursor - 1 + players.length) % players.length;
      return da - db;
    });

    for (const wid of orderedWinners) {
      const wp = players.find((p) => p.playerId === wid)!;
      wp.chips += share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      const wEval = evaluations.get(wid);
      if (wEval) {
        winningFiveByPlayer[wid] = wEval.bestFive;
      }
    }

    showdownResults.push({
      potIndex,
      amount: pot.amount,
      winnerIds: orderedWinners,
      handLabel: {
        zh: bestEval?.labelZh ?? '',
        en: bestEval?.labelEn ?? '',
      },
      winningFiveCards: bestEval?.bestFive,
    });
  });

  return {
    ...state,
    phase: 'showdown',
    deck,
    communityCards: community,
    players,
    activePlayerId: null,
    showdownResults,
    revealedHands,
    winningFiveByPlayer,
    phaseDeadline: now + 7000,
  };
}

function advanceStreetOrShowdown(state: TexasState, now: number): TexasState {
  const contenders = state.players.filter((p) => !p.folded);
  if (contenders.length <= 1) {
    return resolveShowdown(state, now);
  }

  const players = state.players.map((p) => ({
    ...p,
    betThisStreet: 0,
    lastAction: p.folded || p.allIn ? p.lastAction : undefined,
  }));
  const deck = [...state.deck];
  const community = [...state.communityCards];

  let nextPhase: TexasPublicState['phase'];
  if (state.phase === 'preflop') {
    nextPhase = 'flop';
    community.push(deck.pop()!, deck.pop()!, deck.pop()!);
  } else if (state.phase === 'flop') {
    nextPhase = 'turn';
    community.push(deck.pop()!);
  } else if (state.phase === 'turn') {
    nextPhase = 'river';
    community.push(deck.pop()!);
  } else {
    return resolveShowdown({ ...state, players, deck, communityCards: community }, now);
  }

  const canActCount = players.filter((p) => !p.folded && !p.allIn).length;
  const firstIdx =
    canActCount >= 2
      ? nextIndexWhere(players, state.dealerCursor, (p) => !p.folded && !p.allIn)
      : null;

  return {
    ...state,
    phase: nextPhase,
    deck,
    communityCards: community,
    players,
    currentBet: 0,
    minRaiseDelta: state.currentBigBlind,
    actedThisStreet: [],
    activePlayerId: firstIdx !== null ? players[firstIdx].playerId : null,
    phaseDeadline: firstIdx !== null ? now + state.options.turnSeconds * 1000 : now + 1500,
  };
}

function afterPlayerAction(
  state: TexasState,
  actorIdx: number,
  now: number,
): { state: TexasState; voiceClip?: string; sfx?: string } {
  const contenders = state.players.filter((p) => !p.folded);
  if (contenders.length === 1) {
    return { state: resolveShowdown(state, now), voiceClip: 'showdown', sfx: 'chipClink' };
  }

  const actedSet = new Set(state.actedThisStreet);
  const everyoneMatchedAndActed = state.players.every((p) => {
    if (p.folded || p.allIn || p.busted) return true;
    return actedSet.has(p.playerId) && p.betThisStreet === state.currentBet;
  });

  if (everyoneMatchedAndActed) {
    const prevPhase = state.phase;
    const next = advanceStreetOrShowdown(state, now);
    const voiceMap: Record<string, string> = {
      flop: 'flop',
      turn: 'turn',
      river: 'river',
      showdown: 'showdown',
    };
    return {
      state: next,
      voiceClip: next.phase !== prevPhase ? voiceMap[next.phase] : undefined,
      sfx: next.phase === 'showdown' ? 'revealDrum' : 'cardSlide',
    };
  }

  const nextIdx = nextIndexWhere(
    state.players,
    actorIdx,
    (p) => !p.folded && !p.allIn && !p.busted,
  );
  if (nextIdx === null) {
    const next = advanceStreetOrShowdown(state, now);
    return { state: next, sfx: 'cardSlide' };
  }

  return {
    state: {
      ...state,
      activePlayerId: state.players[nextIdx].playerId,
      phaseDeadline: now + state.options.turnSeconds * 1000,
    },
    sfx: 'chipClink',
  };
}

function hasFlushDraw(holeCards: PlayingCard[], communityCards: PlayingCard[]): boolean {
  const allCards = [...holeCards, ...communityCards];
  const suitCounts = new Map<PlayingCard['suit'], number>();
  for (const c of allCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  return holeCards.some((hc) => (suitCounts.get(hc.suit) ?? 0) >= 4);
}

function hasStraightDraw(holeCards: PlayingCard[], communityCards: PlayingCard[]): boolean {
  const allCards = [...holeCards, ...communityCards];
  const rankSet = new Set(allCards.map((c) => c.rank));
  const holeRanks = new Set(holeCards.map((c) => c.rank));
  const windows: number[][] = [[14, 2, 3, 4, 5]];
  for (let low = 2; low <= 10; low++) {
    windows.push([low, low + 1, low + 2, low + 3, low + 4]);
  }
  return windows.some((win) => {
    let hits = 0;
    let usesHole = false;
    for (const r of win) {
      if (rankSet.has(r)) {
        hits++;
        if (holeRanks.has(r)) usesHole = true;
      }
    }
    return hits >= 4 && usesHole;
  });
}

function evaluateBotStrength(holeCards: PlayingCard[], communityCards: PlayingCard[]): number {
  if (holeCards.length !== 2) return 0.25;
  const hi = Math.max(holeCards[0].rank, holeCards[1].rank);
  const lo = Math.min(holeCards[0].rank, holeCards[1].rank);
  const isPocketPair = hi === lo;
  const isSuited = holeCards[0].suit === holeCards[1].suit;
  const gap = hi - lo;
  const isConnected = (gap > 0 && gap <= 2) || (hi === 14 && lo <= 3);

  if (communityCards.length === 0) {
    let preflop = isPocketPair
      ? 0.74 + (hi / 14) * 0.24
      : 0.22 + (hi - 2) * 0.021 + (lo - 2) * 0.014;
    if (!isPocketPair && isSuited) preflop += 0.08;
    if (!isPocketPair && isConnected) preflop += gap === 1 ? 0.07 : 0.04;
    return Math.min(0.99, preflop);
  }

  const ev = evaluateTexasHand([...holeCards, ...communityCards]);
  const maxBoardRank = Math.max(...communityCards.map((c) => c.rank));
  let postflop = 0.22;
  if (ev.category === 0) {
    postflop = 0.22 + (hi >= 13 ? 0.08 : 0);
  } else if (ev.category === 1) {
    postflop = ev.tiebreakers[0] >= maxBoardRank ? 0.62 : 0.46;
  } else if (ev.category === 2) {
    postflop = 0.73;
  } else if (ev.category === 3) {
    postflop = 0.83;
  } else if (ev.category === 4) {
    postflop = 0.88;
  } else if (ev.category === 5) {
    postflop = 0.92;
  } else {
    postflop = 0.97;
  }

  if (communityCards.length < 5 && ev.category < 4) {
    if (hasFlushDraw(holeCards, communityCards)) postflop += 0.16;
    if (hasStraightDraw(holeCards, communityCards)) postflop += 0.12;
  }
  return Math.min(0.99, postflop);
}

export const texasGame: GameDefinition<
  TexasState,
  TexasOptions,
  TexasPublicState,
  TexasPrivateState,
  TexasAction
> = {
  id: 'texas',
  minPlayers: 2,
  maxPlayers: 10,
  defaultOptions: {
    startingChips: 2000,
    smallBlind: 10,
    bigBlind: 20,
    allowRebuy: true,
    turnSeconds: 25,
    blindIncreaseEveryHands: 0,
  },

  createInitialState(seats: PlayerSeat[], rawOptions: TexasOptions) {
    const options: TexasOptions = { ...this.defaultOptions, ...rawOptions };
    const seatOrder = seats.map((s) => s.id);
    const initialPlayers: TexasPlayerState[] = seatOrder.map((id) => ({
      playerId: id,
      chips: options.startingChips,
      holeCards: [],
      betThisStreet: 0,
      committedThisHand: 0,
      folded: false,
      allIn: false,
      busted: false,
      rebuyCount: 0,
      totalBuyIn: options.startingChips,
    }));
    const state = startNewHand(seatOrder, initialPlayers, 0, 1, options, Date.now());
    return { state, voiceClip: 'new_hand', sfx: 'cardSlide' };
  },

  applyAction(state, actorId, action, seats) {
    const now = Date.now();
    if (action.type === 'next_hand') {
      if (state.phase !== 'showdown') return { state };
      const next = startNewHand(
        state.seatOrder,
        state.players,
        state.dealerCursor,
        state.handNumber + 1,
        state.options,
        now,
      );
      if (next.phase === 'game_over' && next.rankings) {
        return {
          state: next,
          voiceClip: 'showdown',
          sfx: 'victoryFanfare',
          scoreDeltas: computeScoreDeltas(next.rankings),
        };
      }
      return {
        state: next,
        voiceClip: 'new_hand',
        sfx: 'cardSlide',
      };
    }

    if (action.type === 'reveal_bluff') {
      if (state.phase !== 'showdown') {
        return { state, error: 'Can only show cards during showdown' };
      }
      const actor = state.players.find((p) => p.playerId === actorId);
      if (!actor || actor.busted || actor.holeCards.length !== 2) {
        return { state, error: 'No hole cards to reveal' };
      }
      if (state.revealedHands?.[actorId]) {
        return { state };
      }
      const ev = evaluateTexasHand([...actor.holeCards, ...state.communityCards]);
      const revealedHands = {
        ...(state.revealedHands ?? {}),
        [actorId]: {
          cards: actor.holeCards,
          label: { zh: ev.labelZh, en: ev.labelEn },
        },
      };
      return {
        state: { ...state, revealedHands },
        sfx: 'revealDrum',
      };
    }

    if (action.type === 'settle_session') {
      if (state.phase !== 'showdown') {
        return { state, error: 'Can only settle session during showdown' };
      }
      const isHost =
        seats.find((s) => s.id === actorId)?.isHost || actorId === state.seatOrder[0];
      if (!isHost) {
        return { state, error: 'Only host can settle session' };
      }
      const rankings = computeRankings(state.players);
      return {
        state: {
          ...state,
          phase: 'game_over',
          activePlayerId: null,
          phaseDeadline: undefined,
          rankings,
        },
        scoreDeltas: computeScoreDeltas(rankings),
        voiceClip: 'showdown',
        sfx: 'victoryFanfare',
      };
    }

    if (
      state.phase === 'showdown' ||
      state.phase === 'game_over' ||
      actorId !== state.activePlayerId
    ) {
      return { state, error: 'Not your turn' };
    }

    const players = state.players.map((p) => ({ ...p }));
    const actorIdx = players.findIndex((p) => p.playerId === actorId);
    if (actorIdx < 0) return { state, error: 'Unknown player' };
    const player = players[actorIdx];

    if (action.type === 'fold') {
      player.folded = true;
      player.lastAction = { zh: '弃牌', en: 'Fold' };
      const actedThisStreet = Array.from(new Set([...state.actedThisStreet, actorId]));
      return afterPlayerAction({ ...state, players, actedThisStreet }, actorIdx, now);
    }

    if (action.type === 'check_call') {
      const needed = Math.max(0, state.currentBet - player.betThisStreet);
      const paid = Math.min(player.chips, needed);
      player.chips -= paid;
      player.betThisStreet += paid;
      player.committedThisHand += paid;
      if (player.chips === 0) player.allIn = true;
      player.lastAction =
        needed === 0
          ? { zh: '过牌', en: 'Check' }
          : player.allIn
            ? { zh: `全下 ¥${player.betThisStreet}`, en: `All-In ${player.betThisStreet}` }
            : { zh: `跟注 ¥${paid}`, en: `Call ${paid}` };

      const actedThisStreet = Array.from(new Set([...state.actedThisStreet, actorId]));
      return afterPlayerAction({ ...state, players, actedThisStreet }, actorIdx, now);
    }

    if (action.type === 'all_in') {
      const targetStreetBet = player.betThisStreet + player.chips;
      const paid = player.chips;
      player.chips = 0;
      player.betThisStreet = targetStreetBet;
      player.committedThisHand += paid;
      player.allIn = true;
      player.lastAction = { zh: `全下 ¥${targetStreetBet}`, en: `All-In ${targetStreetBet}` };

      let currentBet = state.currentBet;
      let minRaiseDelta = state.minRaiseDelta;
      let actedThisStreet = Array.from(new Set([...state.actedThisStreet, actorId]));

      if (targetStreetBet > currentBet) {
        const delta = targetStreetBet - currentBet;
        currentBet = targetStreetBet;
        if (delta >= minRaiseDelta) {
          minRaiseDelta = delta;
          actedThisStreet = [actorId]; // Reopen betting for others
        }
      }

      const res = afterPlayerAction(
        { ...state, players, currentBet, minRaiseDelta, actedThisStreet },
        actorIdx,
        now,
      );
      return { ...res, voiceClip: res.voiceClip ?? 'all_in' };
    }

    if (action.type === 'raise_to') {
      const maxTotal = player.betThisStreet + player.chips;
      const minTotal = Math.min(maxTotal, state.currentBet + state.minRaiseDelta);
      const targetStreetBet = Math.max(minTotal, Math.min(maxTotal, Math.floor(action.amount)));
      const paid = Math.max(0, targetStreetBet - player.betThisStreet);
      if (paid <= 0) {
        return { state, error: 'Invalid raise amount' };
      }
      player.chips -= paid;
      player.betThisStreet = targetStreetBet;
      player.committedThisHand += paid;
      if (player.chips === 0) player.allIn = true;

      const delta = targetStreetBet - state.currentBet;
      const isFullRaise = delta >= state.minRaiseDelta;
      const currentBet = Math.max(state.currentBet, targetStreetBet);
      const minRaiseDelta = isFullRaise ? delta : state.minRaiseDelta;
      const actedThisStreet = isFullRaise
        ? [actorId]
        : Array.from(new Set([...state.actedThisStreet, actorId]));

      player.lastAction = player.allIn
        ? { zh: `全下 ¥${targetStreetBet}`, en: `All-In ${targetStreetBet}` }
        : { zh: `加注到 ¥${targetStreetBet}`, en: `Raise to ${targetStreetBet}` };

      const res = afterPlayerAction(
        { ...state, players, currentBet, minRaiseDelta, actedThisStreet },
        actorIdx,
        now,
      );
      return {
        ...res,
        voiceClip: player.allIn ? res.voiceClip ?? 'all_in' : res.voiceClip,
      };
    }

    return { state };
  },

  onTick(state, now, seats) {
    if (!state.phaseDeadline || now < state.phaseDeadline || state.phase === 'game_over') {
      return null;
    }

    if (state.phase === 'showdown') {
      const next = startNewHand(
        state.seatOrder,
        state.players,
        state.dealerCursor,
        state.handNumber + 1,
        state.options,
        now,
      );
      if (next.phase === 'game_over' && next.rankings) {
        return {
          state: next,
          voiceClip: 'showdown',
          sfx: 'victoryFanfare',
          scoreDeltas: computeScoreDeltas(next.rankings),
        };
      }
      return {
        state: next,
        voiceClip: 'new_hand',
        sfx: 'cardSlide',
      };
    }

    // All-in early runout street tick
    if (!state.activePlayerId) {
      const prevPhase = state.phase;
      const next = advanceStreetOrShowdown(state, now);
      const voiceMap: Record<string, string> = {
        flop: 'flop',
        turn: 'turn',
        river: 'river',
        showdown: 'showdown',
      };
      return {
        state: next,
        voiceClip: next.phase !== prevPhase ? voiceMap[next.phase] : undefined,
        sfx: next.phase === 'showdown' ? 'revealDrum' : 'cardSlide',
      };
    }

    // Turn timeout: Check if possible, otherwise Fold
    const actor = state.players.find((p) => p.playerId === state.activePlayerId);
    if (!actor) return null;
    const canCheck = actor.betThisStreet >= state.currentBet;
    return this.applyAction(
      state,
      actor.playerId,
      canCheck ? { type: 'check_call' } : { type: 'fold' },
      seats,
    );
  },

  forceSkipCurrent(state, seats) {
    const now = Date.now();
    if (state.phase === 'showdown') {
      return this.applyAction(state, state.seatOrder[0], { type: 'next_hand' }, seats);
    }
    return this.onTick?.({ ...state, phaseDeadline: now - 1 }, now, seats) ?? { state };
  },

  projectPublic(state): TexasPublicState {
    const players: TexasPlayerPublic[] = state.players.map((p) => {
      const rev = state.revealedHands?.[p.playerId];
      return {
        playerId: p.playerId,
        chips: p.chips,
        betThisStreet: p.betThisStreet,
        committedThisHand: p.committedThisHand,
        folded: p.folded,
        allIn: p.allIn,
        busted: p.busted,
        rebuyCount: p.rebuyCount,
        totalBuyIn: p.totalBuyIn,
        lastAction: p.lastAction,
        revealedCards: rev?.cards,
        bestHandLabel: rev?.label,
        winningFiveCards: state.winningFiveByPlayer?.[p.playerId],
      };
    });
    return {
      phase: state.phase,
      handNumber: state.handNumber,
      dealerId: state.seatOrder[state.dealerCursor] ?? state.seatOrder[0],
      smallBlindId: state.smallBlindId,
      bigBlindId: state.bigBlindId,
      currentSmallBlind: state.currentSmallBlind,
      currentBigBlind: state.currentBigBlind,
      activePlayerId: state.activePlayerId,
      communityCards: state.communityCards,
      pot: totalPot(state.players),
      sidePots: computeSidePots(state.players),
      currentBet: state.currentBet,
      minRaiseDelta: state.minRaiseDelta,
      players,
      showdownResults: state.showdownResults,
      rankings: state.rankings,
      phaseDeadline: state.phaseDeadline,
    };
  },

  projectPrivate(state, playerId): TexasPrivateState {
    const player = state.players.find((p) => p.playerId === playerId);
    const holeCards = player?.holeCards ?? [];
    const toCall = player ? Math.max(0, state.currentBet - player.betThisStreet) : 0;
    const maxRaiseTo = player ? player.betThisStreet + player.chips : 0;
    const minRaiseTo = Math.min(maxRaiseTo, state.currentBet + state.minRaiseDelta);
    const ev =
      holeCards.length === 2
        ? evaluateTexasHand([...holeCards, ...state.communityCards])
        : undefined;

    return {
      playerId,
      holeCards,
      isTurn: state.activePlayerId === playerId && state.phase !== 'showdown',
      canCheck: toCall === 0,
      toCall,
      minRaiseTo,
      maxRaiseTo,
      currentBestHand: ev
        ? { labelZh: ev.labelZh, labelEn: ev.labelEn, bestFive: ev.bestFive }
        : undefined,
    };
  },

  computeBotAction(state, botId) {
    if (state.phase === 'showdown' || state.phase === 'game_over') return null;
    if (state.activePlayerId !== botId) return null;

    const player = state.players.find((p) => p.playerId === botId);
    if (!player || player.holeCards.length !== 2) return null;

    const toCall = Math.max(0, state.currentBet - player.betThisStreet);
    const pot = totalPot(state.players);
    const effectiveCall = Math.min(toCall, player.chips);
    const potOdds = effectiveCall / Math.max(1, pot + effectiveCall);
    const strength = evaluateBotStrength(player.holeCards, state.communityCards);
    const maxRaiseTo = player.betThisStreet + player.chips;
    const minRaiseTo = Math.min(maxRaiseTo, state.currentBet + state.minRaiseDelta);

    if (toCall === 0) {
      if (strength >= 0.72 && player.chips > state.currentBigBlind && Math.random() < 0.55) {
        const target = Math.min(
          maxRaiseTo,
          Math.max(minRaiseTo, Math.round(state.currentBet + Math.max(state.currentBigBlind * 2, pot * 0.55))),
        );
        return { type: 'raise_to', amount: target };
      }
      if (strength >= 0.56 && player.chips > state.currentBigBlind * 2 && Math.random() < 0.25) {
        const target = Math.min(
          maxRaiseTo,
          Math.max(minRaiseTo, Math.round(state.currentBet + Math.max(state.currentBigBlind * 2, pot * 0.4))),
        );
        return { type: 'raise_to', amount: target };
      }
      return { type: 'check_call' };
    }

    const stackRatio = effectiveCall / Math.max(1, player.chips);
    if (stackRatio > 0.55 && strength < 0.62) {
      return { type: 'fold' };
    }
    if (effectiveCall > state.currentBigBlind * 4 && strength < 0.45) {
      return { type: 'fold' };
    }
    if (effectiveCall > state.currentBigBlind && strength < potOdds * 1.15) {
      return { type: 'fold' };
    }
    if (strength >= 0.82 && Math.random() < 0.4 && player.chips > toCall + state.minRaiseDelta) {
      const target = Math.min(
        maxRaiseTo,
        Math.max(minRaiseTo, Math.round(state.currentBet + Math.max(state.minRaiseDelta, pot * 0.6))),
      );
      return { type: 'raise_to', amount: target };
    }
    return { type: 'check_call' };
  },
};
