import type { PlayerSeat } from '../../shared/types.js';
import type {
  LocalizedText,
  SketchBook,
  SketchEntry,
  SketchOptions,
  SketchPrivateState,
  SketchPublicState,
} from '../../shared/gameTypes.js';
import { SKETCH_PROMPTS } from '../data/sketchPrompts.js';
import type { GameDefinition } from './engine.js';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BOT_DOODLE_SCENES: readonly (() => string)[] = [
  // 0: UFO beam
  () =>
    `<rect x="40" y="40" width="720" height="450" rx="22" fill="#0F172A"/>` +
    `<circle cx="130" cy="110" r="4" fill="#FDE68A"/><circle cx="660" cy="95" r="5" fill="#FDE68A"/><circle cx="590" cy="160" r="3" fill="#FFF"/>` +
    `<polygon points="330,195 470,195 570,455 230,455" fill="#34D399" opacity="0.34"/>` +
    `<ellipse cx="400" cy="170" rx="130" ry="38" fill="#94A3B8" stroke="#1E293B" stroke-width="8"/>` +
    `<path d="M325 155 Q400 75 475 155 Z" fill="#67E8F9" stroke="#1E293B" stroke-width="7"/>` +
    `<circle cx="320" cy="175" r="10" fill="#FACC15"/><circle cx="400" cy="182" r="10" fill="#F472B6"/><circle cx="480" cy="175" r="10" fill="#FACC15"/>` +
    `<ellipse cx="400" cy="365" rx="46" ry="30" fill="#FFF" stroke="#1E293B" stroke-width="6"/>` +
    `<circle cx="378" cy="355" r="10" fill="#1E293B"/><circle cx="422" cy="368" r="12" fill="#1E293B"/>` +
    `<circle cx="448" cy="352" r="16" fill="#FFF" stroke="#1E293B" stroke-width="6"/>`,

  // 1: Crowned cat
  () =>
    `<polygon points="325,135 355,80 390,120 400,72 410,120 445,80 475,135" fill="#FACC15" stroke="#92400E" stroke-width="7" stroke-linejoin="round"/>` +
    `<polygon points="265,220 285,125 350,185" fill="#FDBA74" stroke="#1F2937" stroke-width="8" stroke-linejoin="round"/>` +
    `<polygon points="535,220 515,125 450,185" fill="#FDBA74" stroke="#1F2937" stroke-width="8" stroke-linejoin="round"/>` +
    `<ellipse cx="400" cy="295" rx="145" ry="125" fill="#FED7AA" stroke="#1F2937" stroke-width="8"/>` +
    `<circle cx="345" cy="275" r="18" fill="#1F2937"/><circle cx="455" cy="275" r="18" fill="#1F2937"/>` +
    `<circle cx="340" cy="268" r="5" fill="#FFF"/><circle cx="450" cy="268" r="5" fill="#FFF"/>` +
    `<circle cx="305" cy="315" r="18" fill="#FDA4AF" opacity="0.75"/><circle cx="495" cy="315" r="18" fill="#FDA4AF" opacity="0.75"/>` +
    `<polygon points="388,305 412,305 400,322" fill="#EC4899"/>` +
    `<path d="M365 335 Q382 355 400 328 Q418 355 435 335" fill="none" stroke="#1F2937" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M210 295 L290 305 M210 335 L290 330 M590 295 L510 305 M590 335 L510 330" stroke="#1F2937" stroke-width="6" stroke-linecap="round"/>`,

  // 2: Pizza slices
  () =>
    `<polygon points="400,95 600,425 200,425" fill="#FDE047" stroke="#92400E" stroke-width="8" stroke-linejoin="round"/>` +
    `<path d="M185 425 Q400 470 615 425 L600 390 Q400 428 200 390 Z" fill="#D97706" stroke="#78350F" stroke-width="8" stroke-linejoin="round"/>` +
    `<circle cx="400" cy="230" r="28" fill="#EF4444" stroke="#991B1B" stroke-width="6"/>` +
    `<circle cx="340" cy="330" r="26" fill="#EF4444" stroke="#991B1B" stroke-width="6"/>` +
    `<circle cx="455" cy="345" r="30" fill="#EF4444" stroke="#991B1B" stroke-width="6"/>` +
    `<circle cx="410" cy="300" r="14" fill="none" stroke="#166534" stroke-width="8"/>` +
    `<circle cx="365" cy="260" r="12" fill="none" stroke="#166534" stroke-width="7"/>` +
    `<path d="M295 165 Q280 130 305 100 M505 165 Q520 130 495 100" fill="none" stroke="#9CA3AF" stroke-width="7" stroke-linecap="round"/>`,

  // 3: Haunted castle
  () =>
    `<rect x="44" y="44" width="712" height="442" rx="22" fill="#1E1B4B"/>` +
    `<path d="M620 95 A45 45 0 1 0 665 155 A35 35 0 1 1 620 95 Z" fill="#FDE047"/>` +
    `<rect x="230" y="235" width="340" height="215" fill="#312E81" stroke="#0F172A" stroke-width="7"/>` +
    `<rect x="210" y="175" width="90" height="275" fill="#4338CA" stroke="#0F172A" stroke-width="7"/>` +
    `<rect x="500" y="175" width="90" height="275" fill="#4338CA" stroke="#0F172A" stroke-width="7"/>` +
    `<polygon points="195,175 255,95 315,175" fill="#EC4899" stroke="#0F172A" stroke-width="7"/>` +
    `<polygon points="485,175 545,95 605,175" fill="#EC4899" stroke="#0F172A" stroke-width="7"/>` +
    `<polygon points="340,235 400,130 460,235" fill="#A855F7" stroke="#0F172A" stroke-width="7"/>` +
    `<path d="M360 450 L360 360 Q400 325 440 360 L440 450 Z" fill="#F59E0B" stroke="#0F172A" stroke-width="7"/>` +
    `<path d="M130 220 Q150 170 175 220 Q180 260 165 255 Q150 245 140 255 Q125 260 130 220 Z" fill="#F8FAFC"/>` +
    `<circle cx="145" cy="212" r="4" fill="#0F172A"/><circle cx="160" cy="212" r="4" fill="#0F172A"/>`,

  // 4: Trophy rocket
  () =>
    `<polygon points="355,370 400,475 445,370" fill="#F97316" stroke="#EA580C" stroke-width="6"/>` +
    `<polygon points="375,370 400,440 425,370" fill="#FDE047"/>` +
    `<polygon points="325,280 265,365 335,345" fill="#EF4444" stroke="#1F2937" stroke-width="7" stroke-linejoin="round"/>` +
    `<polygon points="475,280 535,365 465,345" fill="#EF4444" stroke="#1F2937" stroke-width="7" stroke-linejoin="round"/>` +
    `<path d="M400 75 Q485 180 465 365 L335 365 Q315 180 400 75 Z" fill="#E2E8F0" stroke="#1F2937" stroke-width="8"/>` +
    `<path d="M362 135 Q400 118 438 135 L400 75 Z" fill="#EF4444" stroke="#1F2937" stroke-width="7"/>` +
    `<circle cx="400" cy="235" r="42" fill="#38BDF8" stroke="#1F2937" stroke-width="8"/>` +
    `<path d="M382 222 L418 222 L412 246 Q400 258 388 246 Z" fill="#FACC15" stroke="#92400E" stroke-width="4"/>` +
    `<circle cx="180" cy="150" r="10" fill="#FACC15"/><circle cx="620" cy="180" r="12" fill="#FACC15"/>`,

  // 5: Grumpy cactus
  () =>
    `<polygon points="300,355 500,355 470,465 330,465" fill="#EA580C" stroke="#7C2D12" stroke-width="8" stroke-linejoin="round"/>` +
    `<rect x="285" y="335" width="230" height="32" rx="10" fill="#FB923C" stroke="#7C2D12" stroke-width="7"/>` +
    `<rect x="348" y="135" width="104" height="200" rx="52" fill="#22C55E" stroke="#14532D" stroke-width="8"/>` +
    `<path d="M348 250 L275 250 Q250 250 250 220 L250 185" fill="none" stroke="#22C55E" stroke-width="46" stroke-linecap="round"/>` +
    `<path d="M348 250 L275 250 Q250 250 250 220 L250 185" fill="none" stroke="#14532D" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M452 225 L525 225 Q550 225 550 195 L550 165" fill="none" stroke="#22C55E" stroke-width="46" stroke-linecap="round"/>` +
    `<path d="M452 225 L525 225 Q550 225 550 195 L550 165" fill="none" stroke="#14532D" stroke-width="8" stroke-linecap="round"/>` +
    `<circle cx="400" cy="115" r="22" fill="#EC4899" stroke="#831843" stroke-width="6"/>` +
    `<path d="M368 200 L392 212 M432 200 L408 212" stroke="#14532D" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="378" cy="222" r="8" fill="#14532D"/><circle cx="422" cy="222" r="8" fill="#14532D"/>` +
    `<path d="M375 268 Q400 245 425 268" fill="none" stroke="#14532D" stroke-width="7" stroke-linecap="round"/>`,

  // 6: Roaring dino
  () =>
    `<polygon points="240,180 210,150 255,155" fill="#FACC15" stroke="#14532D" stroke-width="5"/>` +
    `<polygon points="230,240 195,220 240,215" fill="#FACC15" stroke="#14532D" stroke-width="5"/>` +
    `<path d="M180 420 Q235 420 265 320 Q285 180 355 120 Q435 85 520 125 L520 185 L445 190 L520 225 Q505 265 445 265 L405 255 Q425 345 415 435 L350 435 L350 385 L305 385 L305 435 L235 435 Z" fill="#4ADE80" stroke="#14532D" stroke-width="8" stroke-linejoin="round"/>` +
    `<circle cx="435" cy="140" r="12" fill="#14532D"/>` +
    `<polygon points="455,187 470,208 485,187 500,208 515,187" fill="#FFF"/>` +
    `<path d="M445 290 L485 280 L475 305" fill="none" stroke="#14532D" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M555 160 L615 130 M565 205 L635 205 M555 250 L615 280" stroke="#EF4444" stroke-width="8" stroke-linecap="round"/>`,

  // 7: Disco robot
  () =>
    `<line x1="400" y1="44" x2="400" y2="105" stroke="#64748B" stroke-width="6"/>` +
    `<circle cx="400" cy="125" r="42" fill="#CBD5E1" stroke="#334155" stroke-width="6"/>` +
    `<path d="M362 125 L438 125 M400 83 L400 167 M370 102 L430 102 M370 148 L430 148" stroke="#64748B" stroke-width="3"/>` +
    `<rect x="305" y="190" width="190" height="125" rx="20" fill="#60A5FA" stroke="#1E293B" stroke-width="8"/>` +
    `<rect x="330" y="218" width="140" height="44" rx="12" fill="#0F172A"/>` +
    `<circle cx="365" cy="240" r="12" fill="#FACC15"/><circle cx="435" cy="240" r="12" fill="#EC4899"/>` +
    `<path d="M355 285 L445 285" stroke="#1E293B" stroke-width="7" stroke-linecap="round"/>` +
    `<rect x="325" y="325" width="150" height="120" rx="18" fill="#A855F7" stroke="#1E293B" stroke-width="8"/>` +
    `<circle cx="400" cy="385" r="24" fill="#FDE047" stroke="#1E293B" stroke-width="6"/>` +
    `<path d="M325 355 L235 295 M475 355 L565 280" stroke="#1E293B" stroke-width="14" stroke-linecap="round"/>` +
    `<circle cx="220" cy="220" r="8" fill="#FACC15"/><circle cx="585" cy="195" r="10" fill="#EC4899"/>`,
];

export function makeBlankCanvasDataUrl(
  label: string,
  variantSeed?: string | number,
): string {
  const safe = label.replace(/[<>&"']/g, '').slice(0, 24);
  const sceneIdx =
    typeof variantSeed === 'number'
      ? (hashString(label) + Math.abs(Math.trunc(variantSeed))) % BOT_DOODLE_SCENES.length
      : variantSeed !== undefined
        ? hashString(`${label}::${variantSeed}`) % BOT_DOODLE_SCENES.length
        : hashString(label) % BOT_DOODLE_SCENES.length;
  const sceneMarkup = BOT_DOODLE_SCENES[sceneIdx]();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
    `<rect width="800" height="600" fill="#FFFDF7"/>` +
    `<rect x="24" y="24" width="752" height="552" rx="28" fill="none" stroke="#E5DEC9" stroke-width="6" stroke-dasharray="16 12"/>` +
    sceneMarkup +
    `<rect x="190" y="500" width="420" height="44" rx="22" fill="#F3F4F6" stroke="#E5E7EB" stroke-width="3"/>` +
    `<text x="400" y="530" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#374151">${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export interface SketchState {
  options: SketchOptions;
  phase: SketchPublicState['phase'];
  seatOrder: string[];
  step: number;
  totalSteps: number;
  books: SketchBook[];
  promptChoicesByPlayer: Record<string, LocalizedText[]>;
  pendingSubmissions: Record<string, SketchEntry>;
  exhibitionBookIndex: number;
  exhibitionEntryIndex: number;
  mvpVotes: Record<string, string>;
  winnerBookOwnerIds?: string[];
  phaseDeadline?: number;
}

export type SketchAction =
  | { type: 'submit_prompt'; text: string }
  | { type: 'refresh_prompts' }
  | { type: 'submit_drawing'; imageDataUrl: string }
  | { type: 'submit_guess'; text: string }
  | { type: 'exhibition_next' }
  | { type: 'exhibition_prev' }
  | { type: 'exhibition_select_book'; bookIndex: number }
  | { type: 'vote_mvp'; ownerId: string }
  | { type: 'finish_exhibition' };

function bookIndexForActor(
  seatOrder: string[],
  actorId: string,
  step: number,
): number {
  const actorIdx = seatOrder.indexOf(actorId);
  const n = seatOrder.length;
  return (((actorIdx - step) % n) + n) % n;
}

function advanceSketchStep(state: SketchState, now: number): {
  state: SketchState;
  voiceClip: string;
} {
  const n = state.seatOrder.length;
  const books = state.books.map((b) => ({
    ...b,
    entries: [...b.entries],
  }));

  for (let actorIdx = 0; actorIdx < n; actorIdx++) {
    const actorId = state.seatOrder[actorIdx];
    const bIdx = bookIndexForActor(state.seatOrder, actorId, state.step);
    const sub = state.pendingSubmissions[actorId];
    if (sub) {
      books[bIdx].entries.push(sub);
    } else if (state.step === 0) {
      const fallback = state.promptChoicesByPlayer[actorId]?.[0]?.zh ?? '派对狂欢';
      books[bIdx].entries.push({ authorId: actorId, kind: 'prompt', text: fallback });
    } else if (state.step % 2 === 1) {
      books[bIdx].entries.push({
        authorId: actorId,
        kind: 'draw',
        imageDataUrl: makeBlankCanvasDataUrl('Time Up!', `${actorId}:${state.step}`),
      });
    } else {
      books[bIdx].entries.push({
        authorId: actorId,
        kind: 'guess',
        text: '???',
      });
    }
  }

  const nextStep = state.step + 1;
  if (nextStep >= state.totalSteps) {
    return {
      state: {
        ...state,
        books,
        step: nextStep,
        pendingSubmissions: {},
        phase: 'exhibition',
        exhibitionBookIndex: 0,
        exhibitionEntryIndex: 0,
        phaseDeadline: undefined,
      },
      voiceClip: 'exhibition_reveal',
    };
  }

  const nextKind = nextStep % 2 === 1 ? 'draw' : 'guess';
  return {
    state: {
      ...state,
      books,
      step: nextStep,
      pendingSubmissions: {},
      phase: nextKind,
      phaseDeadline:
        now +
        (nextKind === 'draw'
          ? state.options.drawSeconds
          : state.options.guessSeconds) *
          1000,
    },
    voiceClip: nextKind === 'draw' ? 'start_drawing' : 'start_guessing',
  };
}

export const sketchGame: GameDefinition<
  SketchState,
  SketchOptions,
  SketchPublicState,
  SketchPrivateState,
  SketchAction
> = {
  id: 'sketch',
  minPlayers: 4,
  maxPlayers: 10,
  defaultOptions: {
    drawSeconds: 65,
    guessSeconds: 40,
  },

  createInitialState(seats: PlayerSeat[], rawOptions: SketchOptions) {
    const options: SketchOptions = { ...this.defaultOptions, ...rawOptions };
    const seatOrder = seats.map((s) => s.id);
    const totalSteps = Math.max(3, Math.min(seatOrder.length, 6));
    const shuffledPrompts = shuffle(SKETCH_PROMPTS);

    const promptChoicesByPlayer: Record<string, LocalizedText[]> = {};
    seatOrder.forEach((id, idx) => {
      promptChoicesByPlayer[id] = [
        shuffledPrompts[(idx * 3) % shuffledPrompts.length],
        shuffledPrompts[(idx * 3 + 1) % shuffledPrompts.length],
        shuffledPrompts[(idx * 3 + 2) % shuffledPrompts.length],
      ];
    });

    const books: SketchBook[] = seatOrder.map((id) => ({
      ownerId: id,
      entries: [],
    }));

    return {
      state: {
        options,
        phase: 'prompt',
        seatOrder,
        step: 0,
        totalSteps,
        books,
        promptChoicesByPlayer,
        pendingSubmissions: {},
        exhibitionBookIndex: 0,
        exhibitionEntryIndex: 0,
        mvpVotes: {},
        phaseDeadline: Date.now() + 45_000,
      },
      voiceClip: 'game_starting',
    };
  },

  applyAction(state, actorId, action) {
    const now = Date.now();

    if (action.type === 'refresh_prompts' && state.phase === 'prompt') {
      if (!state.seatOrder.includes(actorId) || state.pendingSubmissions[actorId]) {
        return { state };
      }
      const prevSet = new Set(
        (state.promptChoicesByPlayer[actorId] ?? []).map((p) => p.zh),
      );
      const pool = SKETCH_PROMPTS.filter((p) => !prevSet.has(p.zh));
      const fresh = shuffle(pool.length >= 3 ? pool : SKETCH_PROMPTS).slice(0, 3);
      return {
        state: {
          ...state,
          promptChoicesByPlayer: {
            ...state.promptChoicesByPlayer,
            [actorId]: fresh,
          },
        },
        sfx: 'cardFlip',
      };
    }

    if (action.type === 'submit_prompt' && state.phase === 'prompt') {
      if (!state.seatOrder.includes(actorId) || state.pendingSubmissions[actorId]) {
        return { state };
      }
      const clean = action.text.trim().slice(0, 60);
      if (!clean) return { state, error: 'Prompt cannot be empty' };
      const pendingSubmissions = {
        ...state.pendingSubmissions,
        [actorId]: { authorId: actorId, kind: 'prompt' as const, text: clean },
      };
      if (Object.keys(pendingSubmissions).length >= state.seatOrder.length) {
        return {
          ...advanceSketchStep({ ...state, pendingSubmissions }, now),
          sfx: 'cardSlide',
        };
      }
      return { state: { ...state, pendingSubmissions }, sfx: 'buttonTap' };
    }

    if (action.type === 'submit_drawing' && state.phase === 'draw') {
      if (!state.seatOrder.includes(actorId) || state.pendingSubmissions[actorId]) {
        return { state };
      }
      if (
        typeof action.imageDataUrl !== 'string' ||
        !action.imageDataUrl.startsWith('data:image/') ||
        action.imageDataUrl.length > 350_000
      ) {
        return { state, error: 'Invalid or oversized sketch image' };
      }
      const pendingSubmissions = {
        ...state.pendingSubmissions,
        [actorId]: {
          authorId: actorId,
          kind: 'draw' as const,
          imageDataUrl: action.imageDataUrl,
        },
      };
      if (Object.keys(pendingSubmissions).length >= state.seatOrder.length) {
        return {
          ...advanceSketchStep({ ...state, pendingSubmissions }, now),
          sfx: 'cardSlide',
        };
      }
      return { state: { ...state, pendingSubmissions }, sfx: 'buttonTap' };
    }

    if (action.type === 'submit_guess' && state.phase === 'guess') {
      if (!state.seatOrder.includes(actorId) || state.pendingSubmissions[actorId]) {
        return { state };
      }
      const clean = action.text.trim().slice(0, 60);
      if (!clean) return { state, error: 'Guess cannot be empty' };
      const pendingSubmissions = {
        ...state.pendingSubmissions,
        [actorId]: { authorId: actorId, kind: 'guess' as const, text: clean },
      };
      if (Object.keys(pendingSubmissions).length >= state.seatOrder.length) {
        return {
          ...advanceSketchStep({ ...state, pendingSubmissions }, now),
          sfx: 'cardSlide',
        };
      }
      return { state: { ...state, pendingSubmissions }, sfx: 'buttonTap' };
    }

    if (state.phase === 'exhibition') {
      if (action.type === 'exhibition_next') {
        const currentBook = state.books[state.exhibitionBookIndex];
        if (!currentBook) return { state };
        if (state.exhibitionEntryIndex + 1 < currentBook.entries.length) {
          return {
            state: {
              ...state,
              exhibitionEntryIndex: state.exhibitionEntryIndex + 1,
            },
            sfx: 'cardFlip',
          };
        }
        if (state.exhibitionBookIndex + 1 < state.books.length) {
          return {
            state: {
              ...state,
              exhibitionBookIndex: state.exhibitionBookIndex + 1,
              exhibitionEntryIndex: 0,
            },
            sfx: 'revealDrum',
          };
        }
        return { state };
      }

      if (action.type === 'exhibition_prev') {
        if (state.exhibitionEntryIndex > 0) {
          return {
            state: {
              ...state,
              exhibitionEntryIndex: state.exhibitionEntryIndex - 1,
            },
            sfx: 'buttonTap',
          };
        }
        if (state.exhibitionBookIndex > 0) {
          const prevIdx = state.exhibitionBookIndex - 1;
          return {
            state: {
              ...state,
              exhibitionBookIndex: prevIdx,
              exhibitionEntryIndex: Math.max(0, state.books[prevIdx].entries.length - 1),
            },
            sfx: 'buttonTap',
          };
        }
        return { state };
      }

      if (action.type === 'exhibition_select_book') {
        if (
          typeof action.bookIndex !== 'number' ||
          !Number.isInteger(action.bookIndex) ||
          action.bookIndex < 0 ||
          action.bookIndex >= state.books.length
        ) {
          return { state };
        }
        return {
          state: {
            ...state,
            exhibitionBookIndex: action.bookIndex,
            exhibitionEntryIndex: 0,
          },
          sfx: 'revealDrum',
        };
      }

      if (action.type === 'vote_mvp') {
        if (!state.seatOrder.includes(action.ownerId)) return { state };
        const mvpVotes = { ...state.mvpVotes, [actorId]: action.ownerId };
        return { state: { ...state, mvpVotes }, sfx: 'emojiPop' };
      }

      if (action.type === 'finish_exhibition') {
        const tally = new Map<string, number>();
        Object.values(state.mvpVotes).forEach((oid) =>
          tally.set(oid, (tally.get(oid) ?? 0) + 1),
        );
        const maxVotes = Math.max(0, ...tally.values());
        const winners =
          maxVotes > 0
            ? Array.from(tally.entries())
                .filter(([, c]) => c === maxVotes)
                .map(([id]) => id)
            : [state.books[0]?.ownerId ?? state.seatOrder[0]];

        const scoreDeltas: Record<string, number> = {};
        for (const winnerId of winners) {
          scoreDeltas[winnerId] = (scoreDeltas[winnerId] ?? 0) + 3;
        }
        for (const [ownerId, votes] of tally.entries()) {
          if (votes > 0) {
            scoreDeltas[ownerId] = (scoreDeltas[ownerId] ?? 0) + votes;
          }
        }

        return {
          state: {
            ...state,
            phase: 'game_over',
            winnerBookOwnerIds: winners,
          },
          sfx: 'victoryFanfare',
          scoreDeltas,
        };
      }
    }

    return { state };
  },

  onTick(state, now) {
    if (
      !state.phaseDeadline ||
      now < state.phaseDeadline ||
      state.phase === 'exhibition' ||
      state.phase === 'game_over'
    ) {
      return null;
    }
    return advanceSketchStep(state, now);
  },

  forceSkipCurrent(state) {
    const now = Date.now();
    if (state.phase === 'exhibition') {
      return this.applyAction(state, state.seatOrder[0], { type: 'finish_exhibition' }, []);
    }
    if (state.phase !== 'game_over') {
      return advanceSketchStep(state, now);
    }
    return { state };
  },

  projectPublic(state): SketchPublicState {
    const currentBook = state.books[state.exhibitionBookIndex];
    const revealedBook =
      state.phase === 'exhibition' && currentBook
        ? {
            ownerId: currentBook.ownerId,
            entries: currentBook.entries.slice(0, state.exhibitionEntryIndex + 1),
          }
        : undefined;

    return {
      phase: state.phase,
      step: state.step,
      totalSteps: state.totalSteps,
      submittedIds: Object.keys(state.pendingSubmissions),
      exhibitionBookIndex: state.exhibitionBookIndex,
      exhibitionEntryIndex: state.exhibitionEntryIndex,
      totalBooks: state.books.length,
      currentBookTotalEntries: currentBook?.entries.length ?? 0,
      revealedBook,
      allBooks: state.phase === 'game_over' ? state.books : undefined,
      mvpVotes: state.mvpVotes,
      winnerBookOwnerIds: state.winnerBookOwnerIds,
      phaseDeadline: state.phaseDeadline,
    };
  },

  projectPrivate(state, playerId): SketchPrivateState {
    const bIdx = bookIndexForActor(state.seatOrder, playerId, state.step);
    const book = state.books[bIdx];
    const previousEntry =
      state.step > 0 && book ? book.entries[book.entries.length - 1] : undefined;

    return {
      playerId,
      assignedBookOwnerId: book?.ownerId ?? playerId,
      hasSubmitted: Boolean(state.pendingSubmissions[playerId]),
      promptChoices: state.step === 0 ? state.promptChoicesByPlayer[playerId] : undefined,
      previousEntry,
      hasVotedMvp: Boolean(state.mvpVotes[playerId]),
    };
  },

  computeBotAction(state, botId) {
    if (state.phase === 'prompt' && !state.pendingSubmissions[botId]) {
      const choice = state.promptChoicesByPlayer[botId]?.[0]?.zh ?? '派对狂欢';
      return { type: 'submit_prompt', text: choice };
    }
    if (state.phase === 'draw' && !state.pendingSubmissions[botId]) {
      const bIdx = bookIndexForActor(state.seatOrder, botId, state.step);
      const prevText = state.books[bIdx]?.entries.slice(-1)[0]?.text ?? 'Art';
      return {
        type: 'submit_drawing',
        imageDataUrl: makeBlankCanvasDataUrl(prevText, `${botId}:${state.step}`),
      };
    }
    if (state.phase === 'guess' && !state.pendingSubmissions[botId]) {
      const fallback = SKETCH_PROMPTS[Math.floor(Math.random() * SKETCH_PROMPTS.length)].zh;
      return { type: 'submit_guess', text: fallback };
    }
    if (state.phase === 'exhibition' && !state.mvpVotes[botId]) {
      const target =
        state.books[Math.floor(Math.random() * state.books.length)]?.ownerId ??
        state.seatOrder[0];
      return { type: 'vote_mvp', ownerId: target };
    }
    return null;
  },
};
