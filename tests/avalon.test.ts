import { describe, expect, it } from 'vitest';
import { avalonGame, isEvilRole } from '../src/server/games/avalon.js';

function makeSeats(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    seatIndex: i,
    name: `Player ${i}`,
    avatarId: 'crown',
    connected: true,
    isHost: i === 0,
    isBot: false,
    ready: true,
    score: 0,
  }));
}

describe('Avalon (Crown & Chalice) Engine', () => {
  it('sets exact team matrices including 7-player Quest 4 two-fail requirement', () => {
    const seats7 = makeSeats(7);
    const { state } = avalonGame.createInitialState(seats7, avalonGame.defaultOptions);
    const pub = avalonGame.projectPublic(state);
    expect(pub.quests.map((q) => q.teamSize)).toEqual([2, 3, 3, 4, 4]);
    expect(pub.quests.map((q) => q.requiredFails)).toEqual([1, 1, 1, 2, 1]);
  });

  it('enforces Merlin/Mordred/Oberon/Percival vision isolation in 10-player full role game', () => {
    const seats = makeSeats(10);
    const { state } = avalonGame.createInitialState(seats, {
      includePercivalMorgana: true,
      includeMordred: true,
      includeOberon: true,
    });

    const merlinId = Object.entries(state.roles).find(([, r]) => r === 'merlin')![0];
    const mordredId = Object.entries(state.roles).find(([, r]) => r === 'mordred')![0];
    const oberonId = Object.entries(state.roles).find(([, r]) => r === 'oberon')![0];
    const assassinId = Object.entries(state.roles).find(([, r]) => r === 'assassin')![0];
    const percivalId = Object.entries(state.roles).find(([, r]) => r === 'percival')![0];
    const morganaId = Object.entries(state.roles).find(([, r]) => r === 'morgana')![0];

    const merlinVis = avalonGame.projectPrivate(state, merlinId).visionPlayers.map((v) => v.playerId);
    expect(merlinVis).not.toContain(mordredId);
    expect(merlinVis).toContain(oberonId);
    expect(merlinVis).toContain(assassinId);

    const oberonVis = avalonGame.projectPrivate(state, oberonId).visionPlayers;
    expect(oberonVis).toHaveLength(0);

    const assassinVis = avalonGame.projectPrivate(state, assassinId).visionPlayers.map((v) => v.playerId);
    expect(assassinVis).not.toContain(oberonId);
    expect(assassinVis).toContain(mordredId);

    const percivalVis = avalonGame.projectPrivate(state, percivalId).visionPlayers.map((v) => v.playerId);
    expect(percivalVis.sort()).toEqual([merlinId, morganaId].sort());
  });

  it('prevents Good players from submitting Fail cards and handles 5-rejection Evil win', () => {
    const seats = makeSeats(5);
    let { state } = avalonGame.createInitialState(seats, avalonGame.defaultOptions);

    for (const s of seats) {
      state = avalonGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;
    }
    expect(state.phase).toBe('team_propose');

    // Reject 5 proposals in a row -> Evil wins immediately
    for (let attempt = 0; attempt < 5; attempt++) {
      const leaderId = avalonGame.projectPublic(state).leaderId;
      state = avalonGame.applyAction(
        state,
        leaderId,
        { type: 'propose_team', teamIds: [seats[0].id, seats[1].id] },
        seats,
      ).state;
      for (const s of seats) {
        state = avalonGame.applyAction(state, s.id, { type: 'cast_vote', vote: 'reject' }, seats).state;
      }
    }
    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('evil');

    // Also test Good fail coercion on quest_execute
    let { state: s2 } = avalonGame.createInitialState(seats, avalonGame.defaultOptions);
    for (const s of seats) s2 = avalonGame.applyAction(s2, s.id, { type: 'peek_ready' }, seats).state;
    const goodIds = seats.filter((s) => !isEvilRole(s2.roles[s.id])).map((s) => s.id);
    const leaderId = avalonGame.projectPublic(s2).leaderId;
    s2 = avalonGame.applyAction(s2, leaderId, { type: 'propose_team', teamIds: goodIds.slice(0, 2) }, seats).state;
    for (const s of seats) s2 = avalonGame.applyAction(s2, s.id, { type: 'cast_vote', vote: 'approve' }, seats).state;
    for (const gid of goodIds.slice(0, 2)) {
      // Good tries submitting 'fail' -> coerced to 'success'
      s2 = avalonGame.applyAction(s2, gid, { type: 'submit_quest', card: 'fail' }, seats).state;
    }
    expect(s2.lastReveal?.passed).toBe(true);
    expect(s2.lastReveal?.failCount).toBe(0);
  });

  it('exposes accurate roleDeckSummary & lastVoteEntry without leaking secret "roles" in projectPublic', () => {
    const seats10 = makeSeats(10);
    const { state } = avalonGame.createInitialState(seats10, {
      includePercivalMorgana: true,
      includeMordred: true,
      includeOberon: true,
      includeLadyOfTheLake: true,
    });

    const pub = avalonGame.projectPublic(state);
    expect(pub.roleDeckSummary).toHaveLength(10);
    expect([...pub.roleDeckSummary].sort()).toEqual(Object.values(state.roles).sort());
    expect(JSON.stringify(pub)).not.toContain('"roles"');
    expect(pub.revealedRoles).toBeUndefined();
    expect(pub.lastVoteEntry).toBeUndefined();

    // Advance to team_vote and finish a vote -> lastVoteEntry updates immediately
    let s = state;
    for (const seat of seats10) {
      s = avalonGame.applyAction(s, seat.id, { type: 'peek_ready' }, seats10).state;
    }
    const leaderId = avalonGame.projectPublic(s).leaderId;
    s = avalonGame.applyAction(
      s,
      leaderId,
      { type: 'propose_team', teamIds: seats10.slice(0, 3).map((x) => x.id) },
      seats10,
    ).state;
    for (const seat of seats10) {
      s = avalonGame.applyAction(s, seat.id, { type: 'cast_vote', vote: 'approve' }, seats10).state;
    }
    const pubAfterVote = avalonGame.projectPublic(s);
    expect(pubAfterVote.phase).toBe('quest_execute');
    expect(pubAfterVote.lastVoteEntry).toBeDefined();
    expect(pubAfterVote.lastVoteEntry?.approved).toBe(true);
    expect(Object.keys(pubAfterVote.lastVoteEntry?.votes ?? {})).toHaveLength(10);
    expect(JSON.stringify(pubAfterVote)).not.toContain('"roles"');
  });

  it('runs Lady of the Lake in 7-player games: Quest 2 trigger, private Mordred inspection, token transfer, no re-inspect, zero public leak', () => {
    // 5-player room should NOT activate Lady of the Lake even if option is true
    const seats5 = makeSeats(5);
    const { state: s5 } = avalonGame.createInitialState(seats5, {
      ...avalonGame.defaultOptions,
      includeLadyOfTheLake: true,
    });
    expect(avalonGame.projectPublic(s5).ladyHolderId).toBeUndefined();

    // 7-player room with Mordred + Lady of the Lake
    const seats7 = makeSeats(7);
    let { state } = avalonGame.createInitialState(seats7, {
      includePercivalMorgana: true,
      includeMordred: true,
      includeOberon: false,
      includeLadyOfTheLake: true,
    });

    const expectedInitialHolder =
      state.seatOrder[(state.leaderCursor - 1 + state.seatOrder.length) % state.seatOrder.length];
    expect(state.ladyHolderId).toBe(expectedInitialHolder);
    expect(state.ladyTestedIds).toEqual([expectedInitialHolder]);

    const mordredId = Object.entries(state.roles).find(([, r]) => r === 'mordred')![0];
    // Ensure initial holder is not Mordred so we can inspect Mordred on Quest 2
    if (expectedInitialHolder === mordredId) {
      const swapId = state.seatOrder.find((id) => id !== expectedInitialHolder && state.roles[id] !== 'merlin')!;
      const swappedRole = state.roles[swapId];
      state = {
        ...state,
        roles: { ...state.roles, [expectedInitialHolder]: swappedRole, [swapId]: 'mordred' },
      };
    }
    const currentMordredId = Object.entries(state.roles).find(([, r]) => r === 'mordred')![0];

    // Ready up
    for (const s of seats7) {
      state = avalonGame.applyAction(state, s.id, { type: 'peek_ready' }, seats7).state;
    }

    const completeQuestWithTeam = (st: typeof state, teamIds: string[], card: 'success' | 'fail') => {
      let cur = st;
      const leaderId = avalonGame.projectPublic(cur).leaderId;
      cur = avalonGame.applyAction(cur, leaderId, { type: 'propose_team', teamIds }, seats7).state;
      for (const s of seats7) {
        cur = avalonGame.applyAction(cur, s.id, { type: 'cast_vote', vote: 'approve' }, seats7).state;
      }
      for (const tid of teamIds) {
        cur = avalonGame.applyAction(cur, tid, { type: 'submit_quest', card }, seats7).state;
      }
      expect(cur.phase).toBe('quest_reveal');
      const ticked = avalonGame.onTick!(cur, (cur.phaseDeadline ?? 0) + 1, seats7);
      expect(ticked).not.toBeNull();
      return ticked!.state;
    };

    const goodIds = seats7.filter((s) => !isEvilRole(state.roles[s.id])).map((s) => s.id);

    // Quest 1 (index 0, size 2) -> after reveal goes directly to team_propose (NO lady_peek)
    state = completeQuestWithTeam(state, goodIds.slice(0, 2), 'success');
    expect(state.phase).toBe('team_propose');
    expect(state.questIndex).toBe(1);

    // Quest 2 (index 1, size 3) -> after reveal transitions to lady_peek!
    state = completeQuestWithTeam(state, goodIds.slice(0, 3), 'success');
    expect(state.phase).toBe('lady_peek');
    expect(state.questIndex).toBe(1);
    expect(state.phaseDeadline).toBeDefined();

    const holderId = state.ladyHolderId!;
    const otherPlayerId = seats7.find((s) => s.id !== holderId && s.id !== currentMordredId)!.id;

    // Only holder can inspect
    expect(avalonGame.projectPrivate(state, holderId).canLadyInspect).toBe(true);
    expect(avalonGame.projectPrivate(state, otherPlayerId).canLadyInspect).toBe(false);
    const nonHolderTry = avalonGame.applyAction(
      state,
      otherPlayerId,
      { type: 'lady_inspect', targetId: currentMordredId },
      seats7,
    );
    expect(nonHolderTry.error).toBeDefined();

    // Holder cannot inspect self
    const selfTry = avalonGame.applyAction(
      state,
      holderId,
      { type: 'lady_inspect', targetId: holderId },
      seats7,
    );
    expect(selfTry.error).toBeDefined();

    // Holder inspects Mordred -> revealed privately as 'evil'
    const inspectRes = avalonGame.applyAction(
      state,
      holderId,
      { type: 'lady_inspect', targetId: currentMordredId },
      seats7,
    );
    expect(inspectRes.error).toBeUndefined();
    expect(inspectRes.sfx).toBe('revealDrum');
    state = inspectRes.state;

    expect(state.phase).toBe('team_propose');
    expect(state.questIndex).toBe(2);
    expect(state.ladyHolderId).toBe(currentMordredId);
    expect(state.ladyTestedIds).toEqual([holderId, currentMordredId]);

    // Private knowledge strictly isolated to holderId
    const holderPriv = avalonGame.projectPrivate(state, holderId);
    expect(holderPriv.ladyKnowledge).toEqual([
      { targetId: currentMordredId, faction: 'evil', questIndex: 1 },
    ]);
    expect(avalonGame.projectPrivate(state, currentMordredId).ladyKnowledge).toBeUndefined();
    expect(avalonGame.projectPrivate(state, otherPlayerId).ladyKnowledge).toBeUndefined();

    // Public state leaks zero loyalty result
    const pub = avalonGame.projectPublic(state);
    expect(pub.ladyHolderId).toBe(currentMordredId);
    expect(pub.ladyTestedIds).toEqual([holderId, currentMordredId]);
    expect(pub.ladyHistory).toEqual([
      { questIndex: 1, holderId, targetId: currentMordredId },
    ]);
    expect(JSON.stringify(pub.ladyHistory)).not.toContain('evil');
    expect(JSON.stringify(pub.ladyHistory)).not.toContain('good');
    expect(JSON.stringify(pub)).not.toContain('"roles"');

    // Quest 3 (index 2, size 3) fails -> 2-1 score -> triggers lady_peek again!
    const evilOnTeam = [currentMordredId, ...goodIds.slice(0, 2)];
    state = completeQuestWithTeam(state, evilOnTeam, 'fail');
    expect(state.phase).toBe('lady_peek');
    expect(state.ladyHolderId).toBe(currentMordredId);

    // New holder (Mordred) CANNOT re-inspect already-tested holderId!
    const reinspectRes = avalonGame.applyAction(
      state,
      currentMordredId,
      { type: 'lady_inspect', targetId: holderId },
      seats7,
    );
    expect(reinspectRes.error).toBeDefined();

    // Inspecting untested player transfers token cleanly (test computeBotAction on lady_peek)
    const botAct = avalonGame.computeBotAction(state, currentMordredId, seats7);
    expect(botAct?.type).toBe('lady_inspect');
    if (botAct?.type === 'lady_inspect') {
      expect(state.ladyTestedIds).not.toContain(botAct.targetId);
      expect(botAct.targetId).not.toBe(currentMordredId);
      state = avalonGame.applyAction(state, currentMordredId, botAct, seats7).state;
      expect(state.ladyHolderId).toBe(botAct.targetId);
    }
    expect(state.questIndex).toBe(3);
    expect(avalonGame.projectPrivate(state, currentMordredId).ladyKnowledge).toHaveLength(1);
    expect(avalonGame.projectPrivate(state, holderId).ladyKnowledge).toHaveLength(1);
  });

  it('awards accurate scoreDeltas across 5-reject, 3-fail, Assassin snipe, and Merlin survival wins', () => {
    const seats5 = makeSeats(5);

    // 1. 5-reject Evil win via applyAction -> +3 to each Evil player
    let { state: rejectState } = avalonGame.createInitialState(seats5, avalonGame.defaultOptions);
    for (const s of seats5) {
      rejectState = avalonGame.applyAction(rejectState, s.id, { type: 'peek_ready' }, seats5).state;
    }
    let lastVoteRes;
    for (let attempt = 0; attempt < 5; attempt++) {
      const leaderId = avalonGame.projectPublic(rejectState).leaderId;
      rejectState = avalonGame.applyAction(
        rejectState,
        leaderId,
        { type: 'propose_team', teamIds: [seats5[0].id, seats5[1].id] },
        seats5,
      ).state;
      for (const s of seats5) {
        lastVoteRes = avalonGame.applyAction(
          rejectState,
          s.id,
          { type: 'cast_vote', vote: 'reject' },
          seats5,
        );
        rejectState = lastVoteRes.state;
      }
    }
    expect(rejectState.phase).toBe('game_over');
    expect(rejectState.winner).toBe('evil');
    for (const s of seats5) {
      const expected = isEvilRole(rejectState.roles[s.id]) ? 3 : undefined;
      expect(lastVoteRes?.scoreDeltas?.[s.id]).toBe(expected);
    }

    // 2. 3-fail Evil win via onTick after Quest 3 reveal -> +3 to each Evil player
    let { state: failState } = avalonGame.createInitialState(seats5, avalonGame.defaultOptions);
    for (const s of seats5) {
      failState = avalonGame.applyAction(failState, s.id, { type: 'peek_ready' }, seats5).state;
    }
    const evilIdsForFail = seats5.filter((s) => isEvilRole(failState.roles[s.id])).map((s) => s.id);
    const goodIdsForFail = seats5.filter((s) => !isEvilRole(failState.roles[s.id])).map((s) => s.id);
    let lastRevealTick;
    for (let q = 0; q < 3; q++) {
      const size = failState.quests[q].teamSize;
      const leaderId = avalonGame.projectPublic(failState).leaderId;
      const team = [evilIdsForFail[0], ...goodIdsForFail].slice(0, size);
      failState = avalonGame.applyAction(failState, leaderId, { type: 'propose_team', teamIds: team }, seats5).state;
      for (const s of seats5) {
        failState = avalonGame.applyAction(failState, s.id, { type: 'cast_vote', vote: 'approve' }, seats5).state;
      }
      for (const tid of team) {
        failState = avalonGame.applyAction(
          failState,
          tid,
          { type: 'submit_quest', card: tid === evilIdsForFail[0] ? 'fail' : 'success' },
          seats5,
        ).state;
      }
      lastRevealTick = avalonGame.onTick!(failState, (failState.phaseDeadline ?? 0) + 1, seats5)!;
      failState = lastRevealTick.state;
    }
    expect(failState.phase).toBe('game_over');
    expect(failState.winner).toBe('evil');
    for (const s of seats5) {
      const expected = isEvilRole(failState.roles[s.id]) ? 3 : undefined;
      expect(lastRevealTick?.scoreDeltas?.[s.id]).toBe(expected);
    }

    // 3. Assassin hits Merlin -> +3 to Evil, +1 bonus (total 4) to Assassin
    let { state: snipeState } = avalonGame.createInitialState(seats5, avalonGame.defaultOptions);
    for (const s of seats5) {
      snipeState = avalonGame.applyAction(snipeState, s.id, { type: 'peek_ready' }, seats5).state;
    }
    const goodIds = seats5.filter((s) => !isEvilRole(snipeState.roles[s.id])).map((s) => s.id);
    const merlinId = Object.entries(snipeState.roles).find(([, r]) => r === 'merlin')![0];
    const assassinId = snipeState.assassinId;

    for (let q = 0; q < 3; q++) {
      const size = snipeState.quests[q].teamSize;
      const leaderId = avalonGame.projectPublic(snipeState).leaderId;
      const team = goodIds.slice(0, size);
      snipeState = avalonGame.applyAction(snipeState, leaderId, { type: 'propose_team', teamIds: team }, seats5).state;
      for (const s of seats5) {
        snipeState = avalonGame.applyAction(snipeState, s.id, { type: 'cast_vote', vote: 'approve' }, seats5).state;
      }
      for (const tid of team) {
        snipeState = avalonGame.applyAction(snipeState, tid, { type: 'submit_quest', card: 'success' }, seats5).state;
      }
      snipeState = avalonGame.onTick!(snipeState, (snipeState.phaseDeadline ?? 0) + 1, seats5)!.state;
    }
    expect(snipeState.phase).toBe('assassin_shot');

    const snipeRes = avalonGame.applyAction(
      snipeState,
      assassinId,
      { type: 'assassinate', targetId: merlinId },
      seats5,
    );
    expect(snipeRes.state.phase).toBe('game_over');
    expect(snipeRes.state.winner).toBe('evil');
    for (const s of seats5) {
      if (s.id === assassinId) {
        expect(snipeRes.scoreDeltas?.[s.id]).toBe(4);
      } else if (isEvilRole(snipeState.roles[s.id])) {
        expect(snipeRes.scoreDeltas?.[s.id]).toBe(3);
      } else {
        expect(snipeRes.scoreDeltas?.[s.id]).toBeUndefined();
      }
    }

    // 3. Assassin misses Merlin -> +3 to Good, +1 bonus (total 4) to Merlin
    const nonMerlinGoodId = goodIds.find((id) => id !== merlinId)!;
    const missRes = avalonGame.applyAction(
      snipeState,
      assassinId,
      { type: 'assassinate', targetId: nonMerlinGoodId },
      seats5,
    );
    expect(missRes.state.phase).toBe('game_over');
    expect(missRes.state.winner).toBe('good');
    for (const s of seats5) {
      if (s.id === merlinId) {
        expect(missRes.scoreDeltas?.[s.id]).toBe(4);
      } else if (!isEvilRole(snipeState.roles[s.id])) {
        expect(missRes.scoreDeltas?.[s.id]).toBe(3);
      } else {
        expect(missRes.scoreDeltas?.[s.id]).toBeUndefined();
      }
    }

    // 4. Stalled turn protection via onTick auto-resolves team_propose / team_vote / quest_execute / assassin_shot
    let { state: timeoutState } = avalonGame.createInitialState(seats5, avalonGame.defaultOptions);
    for (const s of seats5) {
      timeoutState = avalonGame.applyAction(timeoutState, s.id, { type: 'peek_ready' }, seats5).state;
    }
    expect(timeoutState.phase).toBe('team_propose');
    expect(timeoutState.phaseDeadline).toBeDefined();
    // Before deadline -> null
    expect(avalonGame.onTick!(timeoutState, (timeoutState.phaseDeadline ?? 0) - 500, seats5)).toBeNull();
    // After deadline -> resolves to team_vote
    timeoutState = avalonGame.onTick!(timeoutState, (timeoutState.phaseDeadline ?? 0) + 1, seats5)!.state;
    expect(timeoutState.phase).toBe('team_vote');
    // Force-skip on assassin_shot also returns scoreDeltas
    const forcedMiss = avalonGame.forceSkipCurrent(snipeState, seats5);
    expect(forcedMiss.state.phase).toBe('game_over');
    expect(forcedMiss.scoreDeltas).toBeDefined();
  });
});
