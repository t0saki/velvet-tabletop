import { describe, expect, it } from 'vitest';
import type { PlayingCard } from '../src/shared/gameTypes.js';
import { compareEvaluatedHands, evaluateTexasHand } from '../src/shared/pokerEvaluator.js';
import { computeSidePots, texasGame, type TexasPlayerState } from '../src/server/games/texas.js';

const c = (rank: number, suit: PlayingCard['suit']): PlayingCard => ({ rank, suit });

const makeSeats = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    seatIndex: i,
    name: `P${i}`,
    avatarId: 'crown',
    connected: true,
    isHost: i === 0,
    isBot: true,
    ready: true,
    score: 0,
  }));

describe('Poker Evaluator & Texas Holdem Side-Pot Engine', () => {
  it('evaluates all 9 hand categories including Royal Flush and A-2-3-4-5 wheel straight', () => {
    const royal = evaluateTexasHand([
      c(14, 'spades'),
      c(13, 'spades'),
      c(12, 'spades'),
      c(11, 'spades'),
      c(10, 'spades'),
      c(2, 'hearts'),
      c(3, 'clubs'),
    ]);
    expect(royal.category).toBe(8);
    expect(royal.labelEn).toBe('Royal Flush');

    const quads = evaluateTexasHand([
      c(9, 'spades'),
      c(9, 'hearts'),
      c(9, 'diamonds'),
      c(9, 'clubs'),
      c(14, 'spades'),
      c(4, 'hearts'),
      c(2, 'clubs'),
    ]);
    expect(quads.category).toBe(7);

    const fullHouse = evaluateTexasHand([
      c(13, 'spades'),
      c(13, 'hearts'),
      c(13, 'diamonds'),
      c(5, 'clubs'),
      c(5, 'spades'),
      c(2, 'hearts'),
      c(7, 'clubs'),
    ]);
    expect(fullHouse.category).toBe(6);

    const flush = evaluateTexasHand([
      c(14, 'hearts'),
      c(10, 'hearts'),
      c(8, 'hearts'),
      c(5, 'hearts'),
      c(2, 'hearts'),
      c(13, 'spades'),
      c(13, 'clubs'),
    ]);
    expect(flush.category).toBe(5);

    const wheel = evaluateTexasHand([
      c(14, 'spades'),
      c(2, 'hearts'),
      c(3, 'diamonds'),
      c(4, 'clubs'),
      c(5, 'spades'),
      c(12, 'hearts'),
      c(9, 'clubs'),
    ]);
    expect(wheel.category).toBe(4);
    expect(wheel.tiebreakers[0]).toBe(5);

    const sixHighStraight = evaluateTexasHand([
      c(6, 'spades'),
      c(2, 'hearts'),
      c(3, 'diamonds'),
      c(4, 'clubs'),
      c(5, 'spades'),
      c(12, 'hearts'),
      c(9, 'clubs'),
    ]);
    expect(compareEvaluatedHands(sixHighStraight, wheel)).toBeGreaterThan(0);

    const trips = evaluateTexasHand([
      c(8, 'spades'),
      c(8, 'hearts'),
      c(8, 'clubs'),
      c(14, 'diamonds'),
      c(11, 'spades'),
      c(3, 'hearts'),
      c(2, 'clubs'),
    ]);
    expect(trips.category).toBe(3);

    const twoPair = evaluateTexasHand([
      c(12, 'spades'),
      c(12, 'hearts'),
      c(6, 'diamonds'),
      c(6, 'clubs'),
      c(14, 'spades'),
      c(3, 'hearts'),
      c(2, 'clubs'),
    ]);
    expect(twoPair.category).toBe(2);

    const onePair = evaluateTexasHand([
      c(11, 'spades'),
      c(11, 'hearts'),
      c(14, 'diamonds'),
      c(9, 'clubs'),
      c(5, 'spades'),
      c(3, 'hearts'),
      c(2, 'clubs'),
    ]);
    expect(onePair.category).toBe(1);

    const highCard = evaluateTexasHand([
      c(14, 'spades'),
      c(12, 'hearts'),
      c(10, 'diamonds'),
      c(7, 'clubs'),
      c(4, 'spades'),
      c(3, 'hearts'),
      c(2, 'clubs'),
    ]);
    expect(highCard.category).toBe(0);
  });

  it('breaks ties accurately with kickers', () => {
    const ak = evaluateTexasHand([
      c(14, 'spades'),
      c(13, 'hearts'),
      c(14, 'clubs'),
      c(9, 'diamonds'),
      c(6, 'spades'),
      c(4, 'hearts'),
      c(2, 'clubs'),
    ]);
    const aq = evaluateTexasHand([
      c(14, 'diamonds'),
      c(12, 'hearts'),
      c(14, 'clubs'),
      c(9, 'diamonds'),
      c(6, 'spades'),
      c(4, 'hearts'),
      c(2, 'clubs'),
    ]);
    expect(compareEvaluatedHands(ak, aq)).toBeGreaterThan(0);
  });

  it('computes exact multi-way unequal All-In side pots and conserves total chips', () => {
    const players: TexasPlayerState[] = [
      { playerId: 'p1', chips: 0, holeCards: [], betThisStreet: 0, committedThisHand: 100, folded: false, allIn: true, busted: false, rebuyCount: 0, totalBuyIn: 1000 },
      { playerId: 'p2', chips: 0, holeCards: [], betThisStreet: 0, committedThisHand: 400, folded: false, allIn: true, busted: false, rebuyCount: 0, totalBuyIn: 1000 },
      { playerId: 'p3', chips: 0, holeCards: [], betThisStreet: 0, committedThisHand: 1000, folded: false, allIn: true, busted: false, rebuyCount: 0, totalBuyIn: 1000 },
      { playerId: 'p4', chips: 0, holeCards: [], betThisStreet: 0, committedThisHand: 200, folded: true, allIn: false, busted: false, rebuyCount: 0, totalBuyIn: 1000 },
    ];
    const pots = computeSidePots(players);
    // Main pot: 100*4 = 400 (eligible: p1,p2,p3)
    // Side pot 1 (100..400): p2(300)+p3(300)+p4(100) = 700 (eligible: p2,p3)
    // Side pot 2 (400..1000): p3(600) = 600 (eligible: p3 uncalled)
    expect(pots).toEqual([
      { amount: 400, eligibleIds: ['p1', 'p2', 'p3'] },
      { amount: 700, eligibleIds: ['p2', 'p3'] },
      { amount: 600, eligibleIds: ['p3'] },
    ]);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(1700);
  });

  it('plays through a full 6-player hand preserving chip conservation', () => {
    const seats = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      seatIndex: i,
      name: `P${i}`,
      avatarId: 'crown',
      connected: true,
      isHost: i === 0,
      isBot: true,
      ready: true,
      score: 0,
    }));
    let { state } = texasGame.createInitialState(seats, {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      allowRebuy: true,
      turnSeconds: 20,
    });

    for (let guard = 0; guard < 80 && state.phase !== 'showdown'; guard++) {
      if (state.activePlayerId) {
        const res = texasGame.applyAction(state, state.activePlayerId, { type: 'check_call' }, seats);
        state = res.state;
      } else {
        const tick = texasGame.onTick?.(state, (state.phaseDeadline ?? 0) + 10, seats);
        if (tick) state = tick.state;
      }
    }
    expect(state.phase).toBe('showdown');
    const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(totalChips).toBe(6000);
  });

  it('returns exact bestFive 5-card subset across 7-card evaluations and projects winningFiveCards', () => {
    // 1) Flush beats pair of Queens: bestFive must be exact 5 hearts
    const flushOverPair = evaluateTexasHand([
      c(14, 'hearts'),
      c(12, 'spades'),
      c(13, 'hearts'),
      c(9, 'hearts'),
      c(6, 'hearts'),
      c(2, 'hearts'),
      c(12, 'clubs'),
    ]);
    expect(flushOverPair.category).toBe(5);
    expect(flushOverPair.bestFive).toHaveLength(5);
    expect(flushOverPair.bestFive.every((card) => card.suit === 'hearts')).toBe(true);
    expect(flushOverPair.bestFive.map((card) => card.rank)).toEqual([14, 13, 9, 6, 2]);

    // 2) One Pair with kickers drops unused 2d and 9c
    const pairWithKickers = evaluateTexasHand([
      c(14, 'spades'),
      c(2, 'diamonds'),
      c(14, 'hearts'),
      c(13, 'clubs'),
      c(12, 'spades'),
      c(11, 'diamonds'),
      c(9, 'clubs'),
    ]);
    expect(pairWithKickers.category).toBe(1);
    expect(pairWithKickers.bestFive).toEqual([
      c(14, 'spades'),
      c(14, 'hearts'),
      c(13, 'clubs'),
      c(12, 'spades'),
      c(11, 'diamonds'),
    ]);

    // 3) Playing the board Straight excludes low hole cards
    const playBoard = evaluateTexasHand([
      c(2, 'clubs'),
      c(3, 'diamonds'),
      c(9, 'spades'),
      c(8, 'hearts'),
      c(7, 'diamonds'),
      c(6, 'clubs'),
      c(5, 'spades'),
    ]);
    expect(playBoard.category).toBe(4);
    expect(playBoard.bestFive.map((card) => card.rank)).toEqual([9, 8, 7, 6, 5]);

    // 4) Private & public projections include bestFive and winningFiveCards at showdown
    const seats = makeSeats(2);
    let { state } = texasGame.createInitialState(seats, {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      allowRebuy: false,
      turnSeconds: 20,
    });
    state = {
      ...state,
      players: state.players.map((p, idx) =>
        idx === 0
          ? { ...p, holeCards: [c(14, 'spades'), c(14, 'hearts')] }
          : { ...p, holeCards: [c(13, 'spades'), c(13, 'hearts')] },
      ),
      deck: [c(9, 'clubs'), c(7, 'diamonds'), c(5, 'spades'), c(3, 'clubs'), c(2, 'hearts')],
    };

    for (let guard = 0; guard < 30 && state.phase !== 'showdown'; guard++) {
      if (state.activePlayerId) {
        state = texasGame.applyAction(state, state.activePlayerId, { type: 'check_call' }, seats).state;
      } else {
        const tick = texasGame.onTick?.(state, (state.phaseDeadline ?? 0) + 10, seats);
        if (tick) state = tick.state;
      }
    }
    expect(state.phase).toBe('showdown');
    const privWinner = texasGame.projectPrivate(state, 'p0');
    expect(privWinner.currentBestHand?.bestFive).toHaveLength(5);
    expect(privWinner.currentBestHand?.bestFive).toEqual([
      c(14, 'spades'),
      c(14, 'hearts'),
      c(9, 'clubs'),
      c(7, 'diamonds'),
      c(5, 'spades'),
    ]);

    const pub = texasGame.projectPublic(state);
    expect(pub.showdownResults?.[0].winningFiveCards).toEqual(privWinner.currentBestHand?.bestFive);
    const p0Pub = pub.players.find((p) => p.playerId === 'p0');
    const p1Pub = pub.players.find((p) => p.playerId === 'p1');
    expect(p0Pub?.winningFiveCards).toEqual(privWinner.currentBestHand?.bestFive);
    expect(p1Pub?.winningFiveCards).toBeUndefined();
  });

  it('supports reveal_bluff at showdown without altering chip payouts and guards invalid callers', () => {
    const seats = makeSeats(3);
    let { state } = texasGame.createInitialState(seats, {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      allowRebuy: true,
      turnSeconds: 20,
    });

    // Cannot reveal before showdown
    const earlyRes = texasGame.applyAction(state, 'p0', { type: 'reveal_bluff' }, seats);
    expect(earlyRes.error).toBeDefined();

    // Two players fold so remaining survivor wins uncontested
    for (let guard = 0; guard < 10 && state.phase !== 'showdown'; guard++) {
      if (state.activePlayerId) {
        state = texasGame.applyAction(state, state.activePlayerId, { type: 'fold' }, seats).state;
      }
    }
    expect(state.phase).toBe('showdown');

    const chipsSnapshot = state.players.map((p) => ({ id: p.playerId, chips: p.chips }));
    const winnerId = state.showdownResults![0].winnerIds[0];
    const loserId = state.players.find((p) => p.playerId !== winnerId)!.playerId;

    // Uncontested winner shows bluff/cards
    const winShow = texasGame.applyAction(state, winnerId, { type: 'reveal_bluff' }, seats);
    expect(winShow.error).toBeUndefined();
    expect(winShow.sfx).toBe('revealDrum');
    state = winShow.state;

    // Folded player also shows their cards
    const foldShow = texasGame.applyAction(state, loserId, { type: 'reveal_bluff' }, seats);
    expect(foldShow.error).toBeUndefined();
    expect(foldShow.sfx).toBe('revealDrum');
    state = foldShow.state;

    const pub = texasGame.projectPublic(state);
    expect(pub.players.find((p) => p.playerId === winnerId)?.revealedCards).toHaveLength(2);
    expect(pub.players.find((p) => p.playerId === loserId)?.revealedCards).toHaveLength(2);
    expect(pub.players.find((p) => p.playerId === winnerId)?.bestHandLabel).toBeDefined();

    // Chip payouts are completely unchanged
    expect(state.players.map((p) => ({ id: p.playerId, chips: p.chips }))).toEqual(chipsSnapshot);

    // Busted / no-card player cannot reveal
    const bustedState = {
      ...state,
      players: state.players.map((p, idx) =>
        idx === 2 ? { ...p, busted: true, holeCards: [] } : p,
      ),
    };
    const bustedRes = texasGame.applyAction(bustedState, 'p2', { type: 'reveal_bluff' }, seats);
    expect(bustedRes.error).toBeDefined();
  });

  it('tracks rebuyCount, escalates blinds cleanly to multiples of 5, and settles session with rankings + scoreDeltas', () => {
    const seats = makeSeats(3);
    let { state } = texasGame.createInitialState(seats, {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      allowRebuy: true,
      turnSeconds: 20,
      blindIncreaseEveryHands: 2,
    });

    // Hand 1 blinds: 10 / 20
    expect(texasGame.projectPublic(state).currentSmallBlind).toBe(10);
    expect(texasGame.projectPublic(state).currentBigBlind).toBe(20);

    // Rig Hand 1 cards deterministically so p0 (AA) busts p1 (KK) all-in while p2 folds
    state = {
      ...state,
      players: state.players.map((p) => {
        if (p.playerId === 'p0') return { ...p, holeCards: [c(14, 'spades'), c(14, 'hearts')] };
        if (p.playerId === 'p1') return { ...p, holeCards: [c(13, 'spades'), c(13, 'hearts')] };
        return { ...p, holeCards: [c(7, 'clubs'), c(2, 'diamonds')] };
      }),
      deck: [c(11, 'spades'), c(9, 'hearts'), c(8, 'clubs'), c(4, 'diamonds'), c(3, 'clubs')],
    };

    for (let guard = 0; guard < 20 && state.phase !== 'showdown'; guard++) {
      if (state.activePlayerId === 'p2') {
        state = texasGame.applyAction(state, 'p2', { type: 'fold' }, seats).state;
      } else if (state.activePlayerId) {
        state = texasGame.applyAction(state, state.activePlayerId, { type: 'all_in' }, seats).state;
      } else {
        const tick = texasGame.onTick?.(state, (state.phaseDeadline ?? 0) + 10, seats);
        if (tick) state = tick.state;
      }
    }
    expect(state.phase).toBe('showdown');
    expect(state.players.find((p) => p.playerId === 'p1')?.chips).toBe(0);

    // Advance to Hand 2 -> p1 auto-rebuys (+1 rebuyCount, totalBuyIn 2000), blinds still 10/20
    state = texasGame.applyAction(state, 'p0', { type: 'next_hand' }, seats).state;
    expect(state.handNumber).toBe(2);
    const p1AfterRebuy = state.players.find((p) => p.playerId === 'p1')!;
    expect(p1AfterRebuy.rebuyCount).toBe(1);
    expect(p1AfterRebuy.totalBuyIn).toBe(2000);
    expect(p1AfterRebuy.chips).toBe(1000);
    expect(texasGame.projectPublic(state).currentSmallBlind).toBe(10);
    expect(texasGame.projectPublic(state).currentBigBlind).toBe(20);

    // Finish Hand 2 quickly by folding to showdown
    for (let guard = 0; guard < 10 && state.phase !== 'showdown'; guard++) {
      if (state.activePlayerId) {
        state = texasGame.applyAction(state, state.activePlayerId, { type: 'fold' }, seats).state;
      }
    }
    expect(state.phase).toBe('showdown');

    // Advance to Hand 3 -> blindIncreaseEveryHands=2 triggers escalation (15 / 30, multiples of 5)
    state = texasGame.applyAction(state, 'p0', { type: 'next_hand' }, seats).state;
    expect(state.handNumber).toBe(3);
    const pubHand3 = texasGame.projectPublic(state);
    expect(pubHand3.currentSmallBlind).toBe(15);
    expect(pubHand3.currentBigBlind).toBe(30);
    expect(pubHand3.currentSmallBlind % 5).toBe(0);
    expect(pubHand3.currentBigBlind % 5).toBe(0);

    // Finish Hand 3 to showdown
    for (let guard = 0; guard < 10 && state.phase !== 'showdown'; guard++) {
      if (state.activePlayerId) {
        state = texasGame.applyAction(state, state.activePlayerId, { type: 'fold' }, seats).state;
      }
    }
    expect(state.phase).toBe('showdown');

    // Non-host cannot settle session
    const nonHostRes = texasGame.applyAction(state, 'p1', { type: 'settle_session' }, seats);
    expect(nonHostRes.error).toBe('Only host can settle session');

    // Host settles session -> game_over with sorted net-profit rankings and +3/+2/+1 scoreDeltas
    const settleRes = texasGame.applyAction(state, 'p0', { type: 'settle_session' }, seats);
    expect(settleRes.error).toBeUndefined();
    expect(settleRes.state.phase).toBe('game_over');
    expect(settleRes.sfx).toBe('victoryFanfare');

    const finalPub = texasGame.projectPublic(settleRes.state);
    expect(finalPub.rankings).toHaveLength(3);
    const rankings = finalPub.rankings!;
    expect(rankings[0].netProfit).toBeGreaterThanOrEqual(rankings[1].netProfit);
    expect(rankings[1].netProfit).toBeGreaterThanOrEqual(rankings[2].netProfit);
    expect(rankings.reduce((s, r) => s + r.netProfit, 0)).toBe(0);
    expect(rankings.find((r) => r.playerId === 'p1')?.rebuyCount).toBe(1);
    expect(settleRes.scoreDeltas).toEqual({
      [rankings[0].playerId]: 3,
      [rankings[1].playerId]: 2,
      [rankings[2].playerId]: 1,
    });

    // Also verify automatic game_over (< 2 non-busted survivors with allowRebuy=false) returns rankings & scoreDeltas
    const twoSeats = makeSeats(2);
    let { state: huState } = texasGame.createInitialState(twoSeats, {
      startingChips: 500,
      smallBlind: 10,
      bigBlind: 20,
      allowRebuy: false,
      turnSeconds: 20,
    });
    huState = {
      ...huState,
      players: huState.players.map((p) =>
        p.playerId === 'p0'
          ? { ...p, holeCards: [c(14, 'spades'), c(14, 'clubs')] }
          : { ...p, holeCards: [c(12, 'hearts'), c(12, 'diamonds')] },
      ),
      deck: [c(10, 'spades'), c(8, 'hearts'), c(6, 'clubs'), c(4, 'diamonds'), c(2, 'clubs')],
    };
    for (let guard = 0; guard < 15 && huState.phase !== 'showdown'; guard++) {
      if (huState.activePlayerId) {
        huState = texasGame.applyAction(huState, huState.activePlayerId, { type: 'all_in' }, twoSeats).state;
      } else {
        const tick = texasGame.onTick?.(huState, (huState.phaseDeadline ?? 0) + 10, twoSeats);
        if (tick) huState = tick.state;
      }
    }
    const autoEnd = texasGame.applyAction(huState, 'p0', { type: 'next_hand' }, twoSeats);
    expect(autoEnd.state.phase).toBe('game_over');
    expect(autoEnd.state.rankings).toEqual([
      { playerId: 'p0', chips: 1000, rebuyCount: 0, netProfit: 500 },
      { playerId: 'p1', chips: 0, rebuyCount: 0, netProfit: -500 },
    ]);
    expect(autoEnd.scoreDeltas).toEqual({ p0: 3, p1: 2 });
  });

  it('bot folds weak trash facing large all-in pot odds', () => {
    const seats = makeSeats(2);
    let { state } = texasGame.createInitialState(seats, {
      startingChips: 2000,
      smallBlind: 10,
      bigBlind: 20,
      allowRebuy: true,
      turnSeconds: 20,
    });
    // p0 (SB/dealer in heads-up) shoves all-in
    state = texasGame.applyAction(state, state.activePlayerId!, { type: 'all_in' }, seats).state;
    const defenderId = state.activePlayerId!;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === defenderId
          ? { ...p, holeCards: [c(7, 'spades'), c(2, 'hearts')] }
          : p,
      ),
    };
    const botDecision = texasGame.computeBotAction(state, defenderId, seats);
    expect(botDecision).toEqual({ type: 'fold' });
  });
});
