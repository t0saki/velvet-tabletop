import { describe, expect, it } from 'vitest';
import { SKETCH_PROMPTS } from '../src/server/data/sketchPrompts.js';
import { makeBlankCanvasDataUrl, sketchGame } from '../src/server/games/sketch.js';

function makeSeats(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
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

describe('Sketch Relay Engine', () => {
  it('routes 6 simultaneous Sketch Relay chains to Exhibition Finale', () => {
    const seats = makeSeats(6);
    let { state } = sketchGame.createInitialState(seats, sketchGame.defaultOptions);
    expect(state.phase).toBe('prompt');
    expect(state.totalSteps).toBe(6);

    while (state.phase !== 'exhibition') {
      for (const s of seats) {
        const act = sketchGame.computeBotAction(state, s.id, seats);
        if (act) {
          state = sketchGame.applyAction(state, s.id, act, seats).state;
        }
      }
    }

    expect(state.phase).toBe('exhibition');
    expect(state.books).toHaveLength(6);
    for (const book of state.books) {
      expect(book.entries).toHaveLength(6);
      const uniqueAuthors = new Set(book.entries.map((e) => e.authorId));
      expect(uniqueAuthors.size).toBe(6);
    }

    state = sketchGame.applyAction(state, 's0', { type: 'finish_exhibition' }, seats).state;
    expect(state.phase).toBe('game_over');
  });

  it('provides at least 80 unique bilingual party prompts', () => {
    expect(SKETCH_PROMPTS.length).toBeGreaterThanOrEqual(80);
    const zhSet = new Set(SKETCH_PROMPTS.map((p) => p.zh.trim()));
    const enSet = new Set(SKETCH_PROMPTS.map((p) => p.en.trim()));
    expect(zhSet.size).toBe(SKETCH_PROMPTS.length);
    expect(enSet.size).toBe(SKETCH_PROMPTS.length);
    for (const prompt of SKETCH_PROMPTS) {
      expect(prompt.zh.trim().length).toBeGreaterThan(0);
      expect(prompt.en.trim().length).toBeGreaterThan(0);
    }
  });

  it('refreshes 3 fresh prompts during prompt phase before submission', () => {
    const seats = makeSeats(4);
    let { state } = sketchGame.createInitialState(seats, sketchGame.defaultOptions);
    const initialChoices = state.promptChoicesByPlayer.s0;
    expect(initialChoices).toHaveLength(3);

    const refreshRes = sketchGame.applyAction(
      state,
      's0',
      { type: 'refresh_prompts' },
      seats,
    );
    expect(refreshRes.sfx).toBe('cardFlip');
    const refreshedChoices = refreshRes.state.promptChoicesByPlayer.s0;
    expect(refreshedChoices).toHaveLength(3);

    const initialZh = new Set(initialChoices.map((p) => p.zh));
    const refreshedZh = new Set(refreshedChoices.map((p) => p.zh));
    expect(refreshedZh.size).toBe(3);
    for (const zh of refreshedZh) {
      expect(initialZh.has(zh)).toBe(false);
    }

    // Cannot refresh after submitting a prompt
    const submitted = sketchGame.applyAction(
      refreshRes.state,
      's0',
      { type: 'submit_prompt', text: refreshedChoices[0].zh },
      seats,
    );
    const afterSubmitRefresh = sketchGame.applyAction(
      submitted.state,
      's0',
      { type: 'refresh_prompts' },
      seats,
    );
    expect(afterSubmitRefresh.sfx).toBeUndefined();
    expect(afterSubmitRefresh.state.promptChoicesByPlayer.s0).toEqual(refreshedChoices);
  });

  it('generates 8 distinct bot SVG doodle scenes and projects totalBooks/currentBookTotalEntries', () => {
    const scenes = new Set(
      Array.from({ length: 8 }, (_, idx) => makeBlankCanvasDataUrl('Party Time', idx)),
    );
    expect(scenes.size).toBe(8);
    for (const dataUrl of scenes) {
      expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    }

    const seats = makeSeats(4);
    let { state } = sketchGame.createInitialState(seats, sketchGame.defaultOptions);
    for (const s of seats) {
      state = sketchGame.applyAction(
        state,
        s.id,
        { type: 'submit_prompt', text: `Prompt ${s.id}` },
        seats,
      ).state;
    }
    expect(state.phase).toBe('draw');

    const botDrawings = seats.map((s) => {
      const act = sketchGame.computeBotAction(state, s.id, seats);
      expect(act?.type).toBe('submit_drawing');
      return act && act.type === 'submit_drawing' ? act.imageDataUrl : '';
    });
    expect(new Set(botDrawings).size).toBe(4);

    // Advance to exhibition
    while (state.phase !== 'exhibition') {
      for (const s of seats) {
        const act = sketchGame.computeBotAction(state, s.id, seats);
        if (act) state = sketchGame.applyAction(state, s.id, act, seats).state;
      }
    }

    const pub = sketchGame.projectPublic(state);
    expect(pub.totalBooks).toBe(4);
    expect(pub.currentBookTotalEntries).toBe(4);
    expect(pub.revealedBook?.entries).toHaveLength(1);

    const selected = sketchGame.applyAction(
      state,
      's0',
      { type: 'exhibition_select_book', bookIndex: 2 },
      seats,
    );
    expect(selected.sfx).toBe('revealDrum');
    const pubSelected = sketchGame.projectPublic(selected.state);
    expect(pubSelected.exhibitionBookIndex).toBe(2);
    expect(pubSelected.exhibitionEntryIndex).toBe(0);
    expect(pubSelected.totalBooks).toBe(4);
    expect(pubSelected.currentBookTotalEntries).toBe(4);
  });

  it('computes winnerBookOwnerIds and scoreDeltas on finish_exhibition and forceSkipCurrent', () => {
    const seats = makeSeats(4);
    let { state } = sketchGame.createInitialState(seats, sketchGame.defaultOptions);
    while (state.phase !== 'exhibition') {
      for (const s of seats) {
        const act = sketchGame.computeBotAction(state, s.id, seats);
        if (act) state = sketchGame.applyAction(state, s.id, act, seats).state;
      }
    }

    // s0, s1, s2 vote for s2; s3 votes for s1 => s2 gets 3 votes (+3 MVP + 3 = 6), s1 gets 1 vote (+1)
    state = sketchGame.applyAction(state, 's0', { type: 'vote_mvp', ownerId: 's2' }, seats).state;
    state = sketchGame.applyAction(state, 's1', { type: 'vote_mvp', ownerId: 's2' }, seats).state;
    state = sketchGame.applyAction(state, 's2', { type: 'vote_mvp', ownerId: 's2' }, seats).state;
    state = sketchGame.applyAction(state, 's3', { type: 'vote_mvp', ownerId: 's1' }, seats).state;

    const finished = sketchGame.applyAction(
      state,
      's0',
      { type: 'finish_exhibition' },
      seats,
    );
    expect(finished.state.phase).toBe('game_over');
    expect(finished.sfx).toBe('victoryFanfare');
    expect(finished.state.winnerBookOwnerIds).toEqual(['s2']);
    expect(finished.scoreDeltas).toEqual({ s2: 6, s1: 1 });

    // Test tie + forceSkipCurrent from exhibition
    let tieState = state;
    tieState = sketchGame.applyAction(tieState, 's0', { type: 'vote_mvp', ownerId: 's1' }, seats).state;
    tieState = sketchGame.applyAction(tieState, 's3', { type: 'vote_mvp', ownerId: 's1' }, seats).state;
    tieState = sketchGame.applyAction(tieState, 's1', { type: 'vote_mvp', ownerId: 's2' }, seats).state;
    tieState = sketchGame.applyAction(tieState, 's2', { type: 'vote_mvp', ownerId: 's2' }, seats).state;

    const skipped = sketchGame.forceSkipCurrent(tieState, seats);
    expect(skipped.state.phase).toBe('game_over');
    expect(skipped.state.winnerBookOwnerIds?.sort()).toEqual(['s1', 's2']);
    expect(skipped.scoreDeltas).toEqual({ s1: 5, s2: 5 });
  });
});
