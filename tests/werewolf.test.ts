import { describe, expect, it } from 'vitest';
import { werewolfGame } from '../src/server/games/werewolf.js';

function makeSeats(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    seatIndex: i,
    name: `P${i}`,
    avatarId: 'wolf',
    connected: true,
    isHost: i === 0,
    isBot: false,
    ready: true,
    score: 0,
  }));
}

describe('Werewolf (Moonlit Coven) Engine', () => {
  it('assigns exact 10-player role set including Guard and runs full night resolution', () => {
    const seats = makeSeats(10);
    let { state } = werewolfGame.createInitialState(seats, {
      speechSeconds: 45,
      enableSheriff: false,
      sameGuardHealDies: true,
    });

    expect(Object.values(state.roles).filter((r) => r === 'werewolf')).toHaveLength(3);
    expect(Object.values(state.roles)).toContain('guard');
    expect(Object.values(state.roles)).toContain('witch');
    expect(Object.values(state.roles)).toContain('seer');
    expect(Object.values(state.roles)).toContain('hunter');

    for (const s of seats) {
      state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;
    }
    expect(state.phase).toBe('night_guard');

    const guardId = Object.entries(state.roles).find(([, r]) => r === 'guard')![0];
    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const witchId = Object.entries(state.roles).find(([, r]) => r === 'witch')![0];
    const seerId = Object.entries(state.roles).find(([, r]) => r === 'seer')![0];
    const villagerId = Object.entries(state.roles).find(([, r]) => r === 'villager')![0];

    // Guard protects villagerId
    state = werewolfGame.applyAction(state, guardId, { type: 'guard_protect', targetId: villagerId }, seats).state;
    expect(state.phase).toBe('night_wolf');

    // Wolves pick villagerId -> should survive because guarded and NOT healed
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerId }, seats).state;
    }
    expect(state.phase).toBe('night_witch');

    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'pass' }, seats).state;
    expect(state.phase).toBe('night_seer');

    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[0] }, seats).state;
    expect(werewolfGame.projectPrivate(state, seerId).seerChecks?.[0].isWolf).toBe(true);

    // Advance deadline after seer peek
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state;
    expect(state.phase).toBe('dawn_announce');
    expect(state.aliveIds).toContain(villagerId);
    expect(state.aliveIds).toHaveLength(10);
  });

  it('triggers Hunter shot when killed by wolves, blocks it when poisoned by Witch', () => {
    const seats = makeSeats(7);
    let { state } = werewolfGame.createInitialState(seats, werewolfGame.defaultOptions);
    for (const s of seats) state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;

    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const witchId = Object.entries(state.roles).find(([, r]) => r === 'witch')![0];
    const seerId = Object.entries(state.roles).find(([, r]) => r === 'seer')![0];
    const hunterId = Object.entries(state.roles).find(([, r]) => r === 'hunter')![0];
    const villagerId = Object.entries(state.roles).find(([, r]) => r === 'villager')![0];

    // Wolves kill villager, Witch poisons hunter -> Hunter MUST NOT get revenge shot!
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerId }, seats).state;
    }
    state = werewolfGame.applyAction(
      state,
      witchId,
      { type: 'witch_act', choice: 'poison', targetId: hunterId },
      seats,
    ).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[0] }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state;

    expect(state.phase).toBe('dawn_announce');
    expect(state.aliveIds).not.toContain(hunterId);
  });

  it('masks poison death cause as night in projectPublic until game_over', () => {
    const seats = makeSeats(7);
    let { state } = werewolfGame.createInitialState(seats, werewolfGame.defaultOptions);
    for (const s of seats) state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;

    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const witchId = Object.entries(state.roles).find(([, r]) => r === 'witch')![0];
    const seerId = Object.entries(state.roles).find(([, r]) => r === 'seer')![0];
    const hunterId = Object.entries(state.roles).find(([, r]) => r === 'hunter')![0];
    const villagerIds = Object.entries(state.roles).filter(([, r]) => r === 'villager').map(([id]) => id);

    // Night 1: Wolves kill villagerIds[0], Witch poisons hunterId
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    }
    state = werewolfGame.applyAction(
      state,
      witchId,
      { type: 'witch_act', choice: 'poison', targetId: hunterId },
      seats,
    ).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[0] }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state;

    // Mid-game: projectPublic must mask 'poison' as 'night'
    const midPub = werewolfGame.projectPublic(state);
    expect(midPub.phase).toBe('dawn_announce');
    expect(midPub.deadPlayers.find((d) => d.playerId === hunterId)?.cause).toBe('night');
    expect(midPub.chronicle.every((c) => !c.text.zh.includes('毒') && !c.text.en.toLowerCase().includes('poison'))).toBe(true);

    // Advance to day_speech -> day_vote -> exile wolfIds[0]
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state;
    while (state.phase === 'day_speech') {
      state = werewolfGame.applyAction(state, state.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }
    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(state, id, { type: 'cast_vote', targetId: wolfIds[0] }, seats).state;
    }
    expect(state.phase).toBe('night_wolf');

    // Night 2: remaining wolf kills villagerIds[1] (last villager) -> werewolves win
    state = werewolfGame.applyAction(state, wolfIds[1], { type: 'wolf_pick', targetId: villagerIds[1] }, seats).state;
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'pass' }, seats).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: villagerIds[1] }, seats).state;
    const gameOverRes = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!;
    state = gameOverRes.state;

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('werewolves');
    const endPub = werewolfGame.projectPublic(state);
    expect(endPub.deadPlayers.find((d) => d.playerId === hunterId)?.cause).toBe('poison');
    expect(gameOverRes.scoreDeltas).toEqual({
      [wolfIds[0]]: 3,
      [wolfIds[1]]: 3,
    });
  });

  it('flags wolfConsensusWarning on split pick and lets bots/players switch picks to resolve', () => {
    const seats = makeSeats(7);
    let { state } = werewolfGame.createInitialState(seats, werewolfGame.defaultOptions);
    for (const s of seats) state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;

    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const villagerIds = Object.entries(state.roles).filter(([, r]) => r === 'villager').map(([id]) => id);

    // 2 wolves pick different targets
    state = werewolfGame.applyAction(state, wolfIds[0], { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    expect(werewolfGame.projectPrivate(state, wolfIds[0]).wolfConsensusWarning).toBe(false);

    state = werewolfGame.applyAction(state, wolfIds[1], { type: 'wolf_pick', targetId: villagerIds[1] }, seats).state;
    expect(state.phase).toBe('night_wolf');
    expect(werewolfGame.projectPrivate(state, wolfIds[0]).wolfConsensusWarning).toBe(true);
    expect(werewolfGame.projectPrivate(state, wolfIds[1]).wolfConsensusWarning).toBe(true);
    expect(werewolfGame.projectPrivate(state, villagerIds[0]).wolfConsensusWarning).toBeUndefined();

    // Mixed human + bot wolf team: bot switches to human wolf's pick
    const mixedSeats = seats.map((s) =>
      s.id === wolfIds[1] ? { ...s, isBot: true } : s,
    );
    const botAction = werewolfGame.computeBotAction(state, wolfIds[1], mixedSeats);
    expect(botAction).toEqual({ type: 'wolf_pick', targetId: villagerIds[0] });

    state = werewolfGame.applyAction(state, wolfIds[1], botAction!, mixedSeats).state;
    expect(state.phase).toBe('night_witch');
    expect(state.wolfTargetId).toBe(villagerIds[0]);
  });

  it('supports sheriff_handover passing 1.5x badge on exile and tearing badge when targetId is null', () => {
    const seats = makeSeats(8);
    let { state } = werewolfGame.createInitialState(seats, {
      speechSeconds: 45,
      enableSheriff: true,
      sameGuardHealDies: true,
    });
    for (const s of seats) state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;

    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const seerId = Object.entries(state.roles).find(([, r]) => r === 'seer')![0];
    const witchId = Object.entries(state.roles).find(([, r]) => r === 'witch')![0];
    const villagerIds = Object.entries(state.roles).filter(([, r]) => r === 'villager').map(([id]) => id);

    // Night 1: Wolves kill villagerIds[0], Witch passes, Seer checks
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    }
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'pass' }, seats).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[0] }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // sheriff_campaign

    expect(state.phase).toBe('sheriff_campaign');
    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(
        state,
        id,
        { type: 'sheriff_decide', run: id === seerId || id === wolfIds[0] },
        seats,
      ).state;
    }
    expect(state.phase).toBe('sheriff_vote');
    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(state, id, { type: 'sheriff_vote', candidateId: seerId }, seats).state;
    }
    expect(state.sheriffId).toBe(seerId);
    expect(state.phase).toBe('day_speech');

    while (state.phase === 'day_speech') {
      state = werewolfGame.applyAction(state, state.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }

    // Exile Sheriff (seerId)
    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(state, id, { type: 'cast_vote', targetId: seerId }, seats).state;
    }
    expect(state.phase).toBe('sheriff_handover');
    expect(state.pendingSheriffHandoverId).toBe(seerId);
    expect(werewolfGame.projectPrivate(state, seerId).canActNow).toBe(true);

    // Pass 1.5x badge to witchId
    state = werewolfGame.applyAction(state, seerId, { type: 'sheriff_handover', targetId: witchId }, seats).state;
    expect(state.sheriffId).toBe(witchId);
    expect(state.pendingSheriffHandoverId).toBeNull();
    expect(state.phase).toBe('night_wolf');

    // Night 2: Wolves target villagerIds[1], Witch heals so game continues
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerIds[1] }, seats).state;
    }
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'heal' }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // night_seer dead seer
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // day_speech

    while (state.phase === 'day_speech') {
      state = werewolfGame.applyAction(state, state.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }

    // Verify handed-over 1.5x vote beats 1.0x vote (witchId -> wolfIds[0], wolfIds[0] -> witchId, rest abstain)
    for (const id of state.aliveIds) {
      const targetId =
        id === witchId ? wolfIds[0] : id === wolfIds[0] ? witchId : 'abstain';
      state = werewolfGame.applyAction(state, id, { type: 'cast_vote', targetId }, seats).state;
    }
    expect(state.lastVoteResult?.exiledId).toBe(wolfIds[0]);

    // Test tearing up the badge (targetId: null) on a fresh game
    let { state: s2 } = werewolfGame.createInitialState(seats, {
      speechSeconds: 45,
      enableSheriff: true,
      sameGuardHealDies: true,
    });
    for (const s of seats) s2 = werewolfGame.applyAction(s2, s.id, { type: 'peek_ready' }, seats).state;
    const s2Wolves = Object.entries(s2.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const s2Seer = Object.entries(s2.roles).find(([, r]) => r === 'seer')![0];
    const s2Witch = Object.entries(s2.roles).find(([, r]) => r === 'witch')![0];
    const s2Villagers = Object.entries(s2.roles).filter(([, r]) => r === 'villager').map(([id]) => id);

    for (const wid of s2Wolves) {
      s2 = werewolfGame.applyAction(s2, wid, { type: 'wolf_pick', targetId: s2Villagers[0] }, seats).state;
    }
    s2 = werewolfGame.applyAction(s2, s2Witch, { type: 'witch_act', choice: 'pass' }, seats).state;
    s2 = werewolfGame.applyAction(s2, s2Seer, { type: 'seer_check', targetId: s2Wolves[0] }, seats).state;
    s2 = werewolfGame.onTick!(s2, (s2.phaseDeadline ?? 0) + 10, seats)!.state;
    s2 = werewolfGame.onTick!(s2, (s2.phaseDeadline ?? 0) + 10, seats)!.state;

    for (const id of s2.aliveIds) {
      s2 = werewolfGame.applyAction(
        s2,
        id,
        { type: 'sheriff_decide', run: id === s2Seer },
        seats,
      ).state;
    }
    expect(s2.sheriffId).toBe(s2Seer);

    while (s2.phase === 'day_speech') {
      s2 = werewolfGame.applyAction(s2, s2.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }
    for (const id of s2.aliveIds) {
      s2 = werewolfGame.applyAction(s2, id, { type: 'cast_vote', targetId: s2Seer }, seats).state;
    }
    expect(s2.phase).toBe('sheriff_handover');

    s2 = werewolfGame.applyAction(s2, s2Seer, { type: 'sheriff_handover', targetId: null }, seats).state;
    expect(s2.sheriffId).toBeNull();
    expect(s2.phase).toBe('night_wolf');
    expect(s2.chronicle.some((c) => c.text.zh.includes('撕毁'))).toBe(true);
  });

  it('tracks rolePoolCounts, chronicle, voteHistory, and attaches +3 scoreDeltas on villager victory', () => {
    const seats = makeSeats(6);
    let { state } = werewolfGame.createInitialState(seats, werewolfGame.defaultOptions);
    const pubStart = werewolfGame.projectPublic(state);
    expect(pubStart.rolePoolCounts).toEqual({
      werewolf: 2,
      villager: 2,
      seer: 1,
      witch: 1,
      hunter: 0,
      guard: 0,
    });
    expect(pubStart.chronicle).toEqual([]);
    expect(pubStart.voteHistory).toEqual([]);

    for (const s of seats) state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;

    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const witchId = Object.entries(state.roles).find(([, r]) => r === 'witch')![0];
    const seerId = Object.entries(state.roles).find(([, r]) => r === 'seer')![0];
    const villagerIds = Object.entries(state.roles).filter(([, r]) => r === 'villager').map(([id]) => id);

    // Night 1: Wolves target villagerIds[0], Witch heals (peace night)
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    }
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'heal' }, seats).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[0] }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // day_speech

    while (state.phase === 'day_speech') {
      state = werewolfGame.applyAction(state, state.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }
    // Day 1: Exile wolfIds[0]
    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(state, id, { type: 'cast_vote', targetId: wolfIds[0] }, seats).state;
    }
    expect(state.voteHistory).toHaveLength(1);
    expect(state.voteHistory[0]).toMatchObject({
      dayNumber: 1,
      isPk: false,
      exiledId: wolfIds[0],
    });

    // Night 2: Remaining wolf kills villagerIds[0], Witch passes, Seer checks
    state = werewolfGame.applyAction(state, wolfIds[1], { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'pass' }, seats).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[1] }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // day_speech

    while (state.phase === 'day_speech') {
      state = werewolfGame.applyAction(state, state.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }

    // Day 2: Exile final wolf wolfIds[1] -> villagers win with scoreDeltas
    let lastVoteRes = werewolfGame.applyAction(state, state.aliveIds[0], { type: 'cast_vote', targetId: wolfIds[1] }, seats);
    for (const id of state.aliveIds.slice(1)) {
      lastVoteRes = werewolfGame.applyAction(lastVoteRes.state, id, { type: 'cast_vote', targetId: wolfIds[1] }, seats);
    }
    state = lastVoteRes.state;
    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('villagers');
    expect(lastVoteRes.scoreDeltas).toEqual({
      [seerId]: 3,
      [witchId]: 3,
      [villagerIds[0]]: 3,
      [villagerIds[1]]: 3,
    });

    const pubEnd = werewolfGame.projectPublic(state);
    expect(pubEnd.voteHistory).toHaveLength(2);
    expect(pubEnd.chronicle.length).toBeGreaterThanOrEqual(5);
    expect(pubEnd.revealedRoles).toBeDefined();
  });

  it('triggers sheriff_handover on night death before dawn_announce and tears badge on timeout', () => {
    const seats = makeSeats(10);
    let { state } = werewolfGame.createInitialState(seats, {
      speechSeconds: 45,
      enableSheriff: true,
      sameGuardHealDies: true,
    });
    for (const s of seats) state = werewolfGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;

    const guardId = Object.entries(state.roles).find(([, r]) => r === 'guard')![0];
    const wolfIds = Object.entries(state.roles).filter(([, r]) => r === 'werewolf').map(([id]) => id);
    const witchId = Object.entries(state.roles).find(([, r]) => r === 'witch')![0];
    const seerId = Object.entries(state.roles).find(([, r]) => r === 'seer')![0];
    const villagerIds = Object.entries(state.roles).filter(([, r]) => r === 'villager').map(([id]) => id);

    // Night 1: peace night, then elect villagerIds[0] as Sheriff
    state = werewolfGame.applyAction(state, guardId, { type: 'guard_protect', targetId: villagerIds[0] }, seats).state;
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    }
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'pass' }, seats).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[0] }, seats).state;
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // sheriff_campaign

    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(
        state,
        id,
        { type: 'sheriff_decide', run: id === villagerIds[0] },
        seats,
      ).state;
    }
    expect(state.sheriffId).toBe(villagerIds[0]);

    while (state.phase === 'day_speech') {
      state = werewolfGame.applyAction(state, state.currentSpeakerId!, { type: 'end_speech' }, seats).state;
    }
    // Exile guardId so Night 2 tests randomized dead-guard delay in [4500, 9000)ms too
    for (const id of state.aliveIds) {
      state = werewolfGame.applyAction(state, id, { type: 'cast_vote', targetId: guardId }, seats).state;
    }
    expect(state.phase).toBe('night_guard');
    const guardDeadDelay = (state.phaseDeadline ?? 0) - Date.now();
    expect(guardDeadDelay).toBeGreaterThanOrEqual(4000);
    expect(guardDeadDelay).toBeLessThanOrEqual(9200);

    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state; // night_wolf
    // Wolves kill the Sheriff (villagerIds[0])
    for (const wid of wolfIds) {
      state = werewolfGame.applyAction(state, wid, { type: 'wolf_pick', targetId: villagerIds[0] }, seats).state;
    }
    state = werewolfGame.applyAction(state, witchId, { type: 'witch_act', choice: 'pass' }, seats).state;
    state = werewolfGame.applyAction(state, seerId, { type: 'seer_check', targetId: wolfIds[1] }, seats).state;

    // Night resolves -> enters sheriff_handover before dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state;
    expect(state.phase).toBe('sheriff_handover');
    expect(state.pendingSheriffHandoverId).toBe(villagerIds[0]);

    // Timeout tears badge and transitions to dawn_announce
    state = werewolfGame.onTick!(state, (state.phaseDeadline ?? 0) + 10, seats)!.state;
    expect(state.phase).toBe('dawn_announce');
    expect(state.sheriffId).toBeNull();
    expect(state.pendingSheriffHandoverId).toBeNull();
  });
});
