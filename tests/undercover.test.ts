import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNDERCOVER_WORD_PAIRS } from '../src/server/data/undercoverWords.js';
import { undercoverGame } from '../src/server/games/undercover.js';

function makeSeats(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    seatIndex: i,
    name: `Guest ${i}`,
    avatarId: 'mask',
    connected: true,
    isHost: i === 0,
    isBot: false,
    ready: true,
    score: 0,
  }));
}

describe('Masquerade Undercover Engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has 155+ curated bilingual word pairs across all 6 categories with zero duplicates', () => {
    expect(UNDERCOVER_WORD_PAIRS.length).toBeGreaterThanOrEqual(155);

    const categories = new Set(UNDERCOVER_WORD_PAIRS.map((p) => p.categoryId));
    expect(categories).toEqual(new Set(['food', 'life', 'pop', 'tech', 'nature', 'party']));

    const seenZh = new Set<string>();
    const seenEn = new Set<string>();
    for (const pair of UNDERCOVER_WORD_PAIRS) {
      expect(pair.civilian.zh).not.toBe(pair.undercover.zh);
      expect(pair.civilian.en.toLowerCase()).not.toBe(pair.undercover.en.toLowerCase());
      expect(seenZh.has(pair.civilian.zh)).toBe(false);
      expect(seenZh.has(pair.undercover.zh)).toBe(false);
      expect(seenEn.has(pair.civilian.en.toLowerCase())).toBe(false);
      expect(seenEn.has(pair.undercover.en.toLowerCase())).toBe(false);
      seenZh.add(pair.civilian.zh);
      seenZh.add(pair.undercover.zh);
      seenEn.add(pair.civilian.en.toLowerCase());
      seenEn.add(pair.undercover.en.toLowerCase());
    }
  });

  it('assigns Undercover + Blank roles, runs clues, tiebreak PK, and civilian victory', () => {
    const seats = makeSeats(6);
    let { state } = undercoverGame.createInitialState(seats, {
      category: 'food',
      includeBlank: true,
      clueSeconds: 30,
    });

    const roles = Object.values(state.roles);
    expect(roles.filter((r) => r === 'undercover')).toHaveLength(1);
    expect(roles.filter((r) => r === 'blank')).toHaveLength(1);
    expect(roles.filter((r) => r === 'civilian')).toHaveLength(4);

    // Ensure Blank gets null word while civilians & undercover get distinct words
    const blankId = Object.entries(state.roles).find(([, r]) => r === 'blank')![0];
    const civId = Object.entries(state.roles).find(([, r]) => r === 'civilian')![0];
    const ucId = Object.entries(state.roles).find(([, r]) => r === 'undercover')![0];
    expect(undercoverGame.projectPrivate(state, blankId).secretWord).toBeNull();
    expect(undercoverGame.projectPrivate(state, blankId).secretWordObj).toBeNull();
    expect(undercoverGame.projectPrivate(state, civId).secretWordObj).toEqual(
      state.civilianWord,
    );
    expect(undercoverGame.projectPrivate(state, ucId).secretWordObj).toEqual(
      state.undercoverWord,
    );
    expect(undercoverGame.projectPrivate(state, civId).secretWord).not.toBe(
      undercoverGame.projectPrivate(state, ucId).secretWord,
    );

    expect(undercoverGame.projectPublic(state).remainingThreatCount).toBe(2);
    expect(undercoverGame.projectPublic(state).civilianWordObj).toBeUndefined();

    // All peek ready -> clue_round
    for (const s of seats) {
      state = undercoverGame.applyAction(state, s.id, { type: 'peek_ready' }, seats).state;
    }
    expect(state.phase).toBe('clue_round');

    while (state.phase === 'clue_round') {
      const speaker = state.currentSpeakerId!;
      state = undercoverGame.applyAction(
        state,
        speaker,
        { type: 'submit_clue', clue: 'tasty' },
        seats,
      ).state;
    }
    expect(state.phase).toBe('vote_round');
    expect(state.clues.every((c) => c.isPk === false)).toBe(true);

    // Eliminate blank first, then next round eliminate undercover -> Civilians win!
    for (const s of seats) {
      const target = s.id === blankId ? civId : blankId;
      state = undercoverGame.applyAction(state, s.id, { type: 'cast_vote', targetId: target }, seats).state;
    }
    expect(state.phase).toBe('elimination_reveal');
    expect(state.lastEliminated?.playerId).toBe(blankId);

    const midPub = undercoverGame.projectPublic(state);
    expect(midPub.remainingThreatCount).toBe(1);
    expect(midPub.voteHistory).toHaveLength(1);
    expect(midPub.voteHistory[0]).toMatchObject({
      round: 1,
      isPk: false,
      eliminatedId: blankId,
    });

    state = undercoverGame.applyAction(state, 'u0', { type: 'next_round' }, seats).state;
    while (state.phase === 'clue_round') {
      const speaker = state.currentSpeakerId!;
      state = undercoverGame.applyAction(
        state,
        speaker,
        { type: 'submit_clue', clue: 'spicy' },
        seats,
      ).state;
    }

    let finalStep = undercoverGame.applyAction(
      state,
      state.aliveIds[0],
      { type: 'cast_vote', targetId: state.aliveIds[0] === ucId ? civId : ucId },
      seats,
    );
    state = finalStep.state;
    for (const pid of state.aliveIds.slice(1)) {
      const target = pid === ucId ? civId : ucId;
      finalStep = undercoverGame.applyAction(
        state,
        pid,
        { type: 'cast_vote', targetId: target },
        seats,
      );
      state = finalStep.state;
    }

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('civilians');
    expect(finalStep.sfx).toBe('victoryFanfare');
    expect(finalStep.voiceClip).toBe('civilians_win');

    // Score deltas: +3 to every civilian, nothing to infiltrators
    for (const s of seats) {
      if (state.roles[s.id] === 'civilian') {
        expect(finalStep.scoreDeltas?.[s.id]).toBe(3);
      } else {
        expect(finalStep.scoreDeltas?.[s.id]).toBeUndefined();
      }
    }

    const endPub = undercoverGame.projectPublic(state);
    expect(endPub.remainingThreatCount).toBe(0);
    expect(endPub.voteHistory).toHaveLength(2);
    expect(endPub.civilianWordObj).toEqual(state.civilianWord);
    expect(endPub.undercoverWordObj).toEqual(state.undercoverWord);
  });

  it('resolves 2nd-round PK ties fairly at random, logs isPk clues/voteHistory, and awards Undercover survival bonus', () => {
    const seats = makeSeats(6);
    const baseInit = undercoverGame.createInitialState(seats, {
      category: 'party',
      includeBlank: true,
      clueSeconds: 30,
    }).state;

    const civIds = Object.entries(baseInit.roles)
      .filter(([, r]) => r === 'civilian')
      .map(([id]) => id);
    const ucId = Object.entries(baseInit.roles).find(([, r]) => r === 'undercover')![0];
    const blankId = Object.entries(baseInit.roles).find(([, r]) => r === 'blank')![0];

    const tA = civIds[0];
    const tB = civIds[1];

    // Advance from word_peek -> clue_round -> vote_round
    let state = undercoverGame.forceSkipCurrent(baseInit, seats).state;
    while (state.phase === 'clue_round') {
      state = undercoverGame.applyAction(
        state,
        state.currentSpeakerId!,
        { type: 'submit_clue', clue: 'round1 clue' },
        seats,
      ).state;
    }
    expect(state.phase).toBe('vote_round');

    const castSplitTieVotes = (s: typeof state) => {
      const votesPlan: Record<string, string> = {
        [tA]: tB,
        [tB]: tA,
        [civIds[2]]: tA,
        [ucId]: tA,
        [civIds[3]]: tB,
        [blankId]: tB,
      };
      let res = undercoverGame.applyAction(
        s,
        s.aliveIds[0],
        { type: 'cast_vote', targetId: votesPlan[s.aliveIds[0]] },
        seats,
      );
      for (const pid of s.aliveIds.slice(1)) {
        res = undercoverGame.applyAction(
          res.state,
          pid,
          { type: 'cast_vote', targetId: votesPlan[pid] },
          seats,
        );
      }
      return res;
    };

    // 1st tie triggers PK clue round
    state = castSplitTieVotes(state).state;
    expect(state.phase).toBe('clue_round');
    expect(state.pkIds).toHaveLength(2);
    expect(new Set(state.pkIds)).toEqual(new Set([tA, tB]));
    expect(state.voteHistory).toHaveLength(0);

    // PK clues must be flagged isPk: true
    while (state.phase === 'clue_round') {
      state = undercoverGame.applyAction(
        state,
        state.currentSpeakerId!,
        { type: 'submit_clue', clue: 'pk defense' },
        seats,
      ).state;
    }
    expect(state.phase).toBe('vote_round');
    const pkClues = state.clues.filter((c) => c.isPk);
    expect(pkClues).toHaveLength(2);

    // Prove 2nd-round PK tie picks fairly among topIds instead of always index 0
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const lowRoll = castSplitTieVotes(state).state;
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.95);
    const highRoll = castSplitTieVotes(state).state;
    vi.restoreAllMocks();

    expect(lowRoll.phase).toBe('elimination_reveal');
    expect(highRoll.phase).toBe('elimination_reveal');
    expect(lowRoll.lastEliminated?.playerId).not.toBe(highRoll.lastEliminated?.playerId);
    expect(new Set([lowRoll.lastEliminated?.playerId, highRoll.lastEliminated?.playerId])).toEqual(
      new Set([tA, tB]),
    );

    // Continue with highRoll: vote out blankId in Round 2, then eliminate remaining civilians -> Undercover survives & wins
    state = highRoll;
    expect(state.pkIds).toBeNull();
    expect(state.voteHistory).toHaveLength(1);
    expect(state.voteHistory[0].isPk).toBe(true);

    const voteEveryoneOutTarget = (s: typeof state, targetId: string) => {
      let cur = undercoverGame.applyAction(s, 'u0', { type: 'next_round' }, seats).state;
      while (cur.phase === 'clue_round') {
        cur = undercoverGame.applyAction(
          cur,
          cur.currentSpeakerId!,
          { type: 'submit_clue', clue: `clue-r${cur.round}` },
          seats,
        ).state;
      }
      const fallback = cur.aliveIds.find((id) => id !== targetId)!;
      let stepRes = undercoverGame.applyAction(
        cur,
        cur.aliveIds[0],
        { type: 'cast_vote', targetId: cur.aliveIds[0] === targetId ? fallback : targetId },
        seats,
      );
      for (const pid of cur.aliveIds.slice(1)) {
        stepRes = undercoverGame.applyAction(
          stepRes.state,
          pid,
          { type: 'cast_vote', targetId: pid === targetId ? fallback : targetId },
          seats,
        );
      }
      return stepRes;
    };

    // Round 2: eliminate Blank (infiltrator dies, uc still alive)
    state = voteEveryoneOutTarget(state, blankId).state;
    expect(state.phase).toBe('elimination_reveal');
    expect(undercoverGame.projectPublic(state).remainingThreatCount).toBe(1);

    // Round 3: eliminate another civilian
    state = voteEveryoneOutTarget(state, civIds[2]).state;
    expect(state.phase).toBe('elimination_reveal');

    // Round 4: eliminate another civilian -> 1 civ vs 1 uc -> Undercover wins!
    const winRes = voteEveryoneOutTarget(state, civIds[3]);
    expect(winRes.state.phase).toBe('game_over');
    expect(winRes.state.winner).toBe('undercover');
    expect(winRes.sfx).toBe('victoryFanfare');
    expect(winRes.voiceClip).toBe('undercover_wins');

    // Surviving undercover gets +3 + 1 = 4, eliminated blank gets +3, civilians get nothing
    expect(winRes.scoreDeltas?.[ucId]).toBe(4);
    expect(winRes.scoreDeltas?.[blankId]).toBe(3);
    for (const cid of civIds) {
      expect(winRes.scoreDeltas?.[cid]).toBeUndefined();
    }
  });

  it('generates category-smart non-repeating bot clues across multiple rounds', () => {
    const seats = makeSeats(6).map((s) => ({ ...s, isBot: true }));
    let { state } = undercoverGame.createInitialState(seats, {
      category: 'tech',
      includeBlank: true,
      clueSeconds: 30,
    });

    for (const s of seats) {
      const act = undercoverGame.computeBotAction(state, s.id, seats);
      expect(act).toEqual({ type: 'peek_ready' });
      state = undercoverGame.applyAction(state, s.id, act!, seats).state;
    }

    // Run 2 full clue rounds of bot clues and ensure zero repeats
    for (let round = 1; round <= 2; round++) {
      expect(state.phase).toBe('clue_round');
      while (state.phase === 'clue_round') {
        const speaker = state.currentSpeakerId!;
        const act = undercoverGame.computeBotAction(state, speaker, seats);
        expect(act?.type).toBe('submit_clue');
        state = undercoverGame.applyAction(state, speaker, act!, seats).state;
      }
      if (round === 1) {
        // Vote out one player using bot votes so we can enter round 2
        while (state.phase === 'vote_round') {
          const voter = state.aliveIds.find((id) => !state.votes[id])!;
          const act = undercoverGame.computeBotAction(state, voter, seats);
          expect(act?.type).toBe('cast_vote');
          state = undercoverGame.applyAction(state, voter, act!, seats).state;
        }
        if (state.phase === 'clue_round') {
          // If bots tied in vote, finish PK clues & votes
          while (state.phase === 'clue_round') {
            const speaker = state.currentSpeakerId!;
            const act = undercoverGame.computeBotAction(state, speaker, seats)!;
            state = undercoverGame.applyAction(state, speaker, act, seats).state;
          }
          while (state.phase === 'vote_round') {
            const voter = state.aliveIds.find((id) => !state.votes[id])!;
            const act = undercoverGame.computeBotAction(state, voter, seats)!;
            state = undercoverGame.applyAction(state, voter, act, seats).state;
          }
        }
        if (state.phase === 'elimination_reveal') {
          state = undercoverGame.applyAction(state, 'u0', { type: 'next_round' }, seats).state;
        }
        if (state.phase === 'game_over') break;
      }
    }

    const clueTexts = state.clues.map((c) => c.clue);
    expect(clueTexts.length).toBeGreaterThanOrEqual(6);
    expect(new Set(clueTexts).size).toBe(clueTexts.length);
  });
});
