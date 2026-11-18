import { afterEach, describe, expect, it, vi } from 'vitest';
import { monopolyGame, MONOPOLY_TILES } from '../src/server/games/monopoly.js';

function makeSeats(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    seatIndex: i,
    name: `Tycoon ${i}`,
    avatarId: 'crown',
    connected: true,
    isHost: i === 0,
    isBot: false,
    ready: true,
    score: 0,
  }));
}

describe('Monopoly (Metropolis Tycoon) Engine', () => {
  it('supports property purchase, live multi-player auction on pass, and bankruptcy', () => {
    const seats = makeSeats(4);
    let { state } = monopolyGame.createInitialState(seats, {
      startingCash: 10000,
      maxRounds: 8,
      partyTurboRent: false,
    });

    // Force active player onto unowned property tile 1 (Neon Alley, price 600)
    state.players[0].position = 1;
    state.phase = 'buy_decision';

    // Player 0 passes -> triggers 10s Live Auction!
    const res1 = monopolyGame.applyAction(state, 'm0', { type: 'pass_property' }, seats);
    state = res1.state;
    expect(state.phase).toBe('auction');
    expect(state.auction?.tileIndex).toBe(1);

    // Player 1 and Player 2 bid concurrently
    state = monopolyGame.applyAction(state, 'm1', { type: 'auction_bid', delta: 100 }, seats).state;
    state = monopolyGame.applyAction(state, 'm2', { type: 'auction_bid', delta: 300 }, seats).state;
    expect(state.auction?.highestBidderId).toBe('m2');
    expect(state.auction?.highestBid).toBe(400);

    // Other players pass -> settles auction immediately to m2!
    state = monopolyGame.applyAction(state, 'm0', { type: 'auction_pass' }, seats).state;
    state = monopolyGame.applyAction(state, 'm1', { type: 'auction_pass' }, seats).state;
    state = monopolyGame.applyAction(state, 'm3', { type: 'auction_pass' }, seats).state;

    expect(state.phase).toBe('roll');
    expect(state.properties[1].ownerId).toBe('m2');
    const m2 = state.players.find((p) => p.playerId === 'm2')!;
    expect(m2.cash).toBe(9600);
    expect(MONOPOLY_TILES).toHaveLength(28);
  });

  it('plays dice rolls via bots without deadlocking across multiple turns', () => {
    const seats = makeSeats(4);
    let { state } = monopolyGame.createInitialState(seats, monopolyGame.defaultOptions);

    for (let i = 0; i < 60 && state.phase !== 'game_over'; i++) {
      let acted = false;
      for (const s of seats) {
        const act = monopolyGame.computeBotAction(state, s.id, seats);
        if (act) {
          state = monopolyGame.applyAction(state, s.id, act, seats).state;
          acted = true;
          break;
        }
      }
      if (!acted && state.phase === 'auction' && state.auction) {
        state = monopolyGame.onTick!(state, state.auction.endsAt + 10, seats)!.state;
      }
    }
    expect(state.round).toBeGreaterThanOrEqual(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accumulates jackpotPool from jail bail & Luxury Tax and pays out + resets on Tile 14', () => {
    const seats = makeSeats(4);
    let { state } = monopolyGame.createInitialState(seats, monopolyGame.defaultOptions);
    expect(state.jackpotPool).toBe(500);
    expect(monopolyGame.projectPublic(state).jackpotPool).toBe(500);
    expect(monopolyGame.projectPublic(state).eventLog.length).toBeGreaterThanOrEqual(1);

    // 1) Jail bail adds ¥500 to jackpotPool
    state.players[0].inJail = true;
    state.players[0].position = 7;
    state = monopolyGame.applyAction(state, 'm0', { type: 'pay_jail_bail' }, seats).state;
    expect(state.players[0].inJail).toBe(false);
    expect(state.players[0].cash).toBe(9500);
    expect(state.jackpotPool).toBe(1000);

    // 2) Luxury Tax (Tile 20, ¥800) adds ¥800 to jackpotPool
    state.players[0].position = 17;
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.2); // 1 + 2 = 3 -> Tile 20
    state = monopolyGame.applyAction(state, 'm0', { type: 'roll_dice' }, seats).state;
    expect(state.players[0].cash).toBe(8700);
    expect(state.jackpotPool).toBe(1800);

    // 3) Landing on Tile 14 (Jackpot Plaza) awards entire pool and resets to 500 with cashRegister sfx
    state.activeCursor = 1;
    state.phase = 'roll';
    state.players[1].position = 11;
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.2); // 1 + 2 = 3 -> Tile 14
    const jackpotRes = monopolyGame.applyAction(state, 'm1', { type: 'roll_dice' }, seats);
    state = jackpotRes.state;
    expect(jackpotRes.sfx).toBe('cashRegister');
    expect(state.players[1].cash).toBe(11800);
    expect(state.jackpotPool).toBe(500);
  });

  it('exposes all upgradable properties in canUpgradeTiles, upgrades level, and boosts rent', () => {
    const seats = makeSeats(4);
    let { state } = monopolyGame.createInitialState(seats, monopolyGame.defaultOptions);

    // m0 owns Tile 5 (Jade Garden, upgradeCost 500), stands on Tile 1 and buys it (price 600, upgradeCost 400)
    state.properties[5] = { ownerId: 'm0', level: 0 };
    state.players[0].position = 1;
    state.phase = 'buy_decision';

    state = monopolyGame.applyAction(state, 'm0', { type: 'buy_property' }, seats).state;
    expect(state.phase).toBe('turn_end');
    expect(state.players[0].cash).toBe(9400);

    const priv = monopolyGame.projectPrivate(state, 'm0');
    expect(priv.canUpgradeTiles).toEqual([1, 5]);

    // Upgrade Tile 1 (Neon Alley, baseRent 80, upgradeCost 400 -> Lv.1 rent = round(80 * 2.2) = 176)
    const upgRes = monopolyGame.applyAction(
      state,
      'm0',
      { type: 'upgrade_property', tileIndex: 1 },
      seats,
    );
    state = upgRes.state;
    expect(upgRes.sfx).toBe('cashRegister');
    expect(state.properties[1].level).toBe(1);
    expect(state.players[0].cash).toBe(9000);
    expect(state.phase).toBe('roll');
    expect(state.activeCursor).toBe(1);

    // m1 rolls 1+1=2 from Tile 27 -> wraps past START (+2000) and lands on Tile 1, paying Lv.1 rent ¥176
    state.players[1].position = 27;
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.0);
    state = monopolyGame.applyAction(state, 'm1', { type: 'roll_dice' }, seats).state;
    expect(state.players[0].cash).toBe(9176);
    expect(state.players[1].cash).toBe(11824);
  });

  it('emits +3/+2/+1 scoreDeltas on game_over via both maxRounds and last-player-standing', () => {
    const seats = makeSeats(4);

    // 1) Last-player-standing via Luxury Tax bankruptcy
    let { state: s1 } = monopolyGame.createInitialState(seats, monopolyGame.defaultOptions);
    s1.players[0].cash = 12000;
    s1.players[1].bankrupt = true;
    s1.players[1].cash = 0;
    s1.players[2].bankrupt = true;
    s1.players[2].cash = 0;
    s1.players[3].cash = 200;
    s1.players[3].position = 17;
    s1.activeCursor = 3;
    s1.phase = 'roll';

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.2); // 1 + 2 = 3 -> Tile 20 Luxury Tax
    const koRes = monopolyGame.applyAction(s1, 'm3', { type: 'roll_dice' }, seats);
    expect(koRes.state.phase).toBe('game_over');
    expect(koRes.state.winnerId).toBe('m0');
    expect(koRes.voiceClip).toBe('tycoon_winner');
    expect(koRes.scoreDeltas).toBeDefined();
    const koRankings = koRes.state.rankings!;
    expect(koRes.scoreDeltas).toEqual({
      [koRankings[0].playerId]: 3,
      [koRankings[1].playerId]: 2,
      [koRankings[2].playerId]: 1,
    });

    // 2) maxRounds completion via forceSkipCurrent and onTick
    let { state: s2 } = monopolyGame.createInitialState(seats, {
      startingCash: 10000,
      maxRounds: 2,
      partyTurboRent: false,
    });
    s2.round = 2;
    s2.activeCursor = 3;
    s2.phase = 'turn_end';
    s2.phaseDeadline = Date.now() + 10_000;
    s2.players[0].cash = 12000;
    s2.players[1].cash = 11000;
    s2.players[2].cash = 15000;
    s2.players[3].cash = 9000;

    const skipRes = monopolyGame.forceSkipCurrent(s2, seats);
    expect(skipRes.state.phase).toBe('game_over');
    expect(skipRes.state.winnerId).toBe('m2');
    expect(skipRes.scoreDeltas).toEqual({ m2: 3, m0: 2, m1: 1 });

    const tickRes = monopolyGame.onTick!(
      { ...s2, phaseDeadline: 1000 },
      2000,
      seats,
    )!;
    expect(tickRes.state.phase).toBe('game_over');
    expect(tickRes.scoreDeltas).toEqual({ m2: 3, m0: 2, m1: 1 });
  });

  it('draws distinct Chance/Chest cards, grants +2000 cleanly on moveTo: 0, and caps eventLog at 8', () => {
    const seats = makeSeats(4);
    let { state } = monopolyGame.createInitialState(seats, monopolyGame.defaultOptions);

    // Land m0 on Tile 2 (Vault Chest) with roll 1+1=2 (from pos 0), draw CHEST_CARDS[4] (-700 -> jackpotPool)
    // Wait: avoid doubles by rolling from pos 27 -> 27 + 3 = 30 % 28 = 2 (Wait: 27->2 passes START +2000).
    // Even simpler: start m0 at pos 15 -> 15 + 3 = 18 (Tile 18 is Vault Chest)!
    state.players[0].position = 15;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0) // d1 = 1
      .mockReturnValueOnce(0.2) // d2 = 2 -> pos 18 (Vault Chest)
      .mockReturnValueOnce(0.5625); // index 4 of 8 CHEST_CARDS (-700)
    state = monopolyGame.applyAction(state, 'm0', { type: 'roll_dice' }, seats).state;
    expect(state.players[0].cash).toBe(9300);
    expect(state.jackpotPool).toBe(1200);

    // Land m1 on Tile 11 (Chance) from pos 8 with 1+2=3, draw CHANCE_CARDS[2] (moveTo: 0 -> +2000)
    state.players[1].position = 8;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.2) // pos 11 (Chance)
      .mockReturnValueOnce(0.3125); // index 2 of 8 CHANCE_CARDS (moveTo: 0)
    state = monopolyGame.applyAction(state, 'm1', { type: 'roll_dice' }, seats).state;
    expect(state.players[1].position).toBe(0);
    expect(state.players[1].cash).toBe(12000);

    // Generate 10 more turns and ensure eventLog never exceeds 8 entries
    for (let i = 0; i < 10; i++) {
      const actor = state.players[state.activeCursor].playerId;
      state.phase = 'roll';
      state = monopolyGame.applyAction(state, actor, { type: 'roll_dice' }, seats).state;
      if (state.phase === 'buy_decision') {
        state = monopolyGame.applyAction(state, actor, { type: 'buy_property' }, seats).state;
      }
      if (state.phase === 'turn_end') {
        state = monopolyGame.applyAction(state, actor, { type: 'end_turn' }, seats).state;
      }
      if (state.phase === 'auction' && state.auction) {
        state = monopolyGame.onTick!(state, state.auction.endsAt + 10, seats)!.state;
      }
    }
    expect(state.eventLog.length).toBeLessThanOrEqual(8);
  });
});
