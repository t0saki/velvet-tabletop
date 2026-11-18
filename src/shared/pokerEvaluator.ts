import type { CardSuit, PlayingCard } from './gameTypes.js';

export interface EvaluatedHand {
  category: number; // 0=High Card .. 8=Straight Flush
  tiebreakers: number[];
  bestFive: PlayingCard[];
  labelZh: string;
  labelEn: string;
}

const CATEGORY_LABELS: Array<{ zh: string; en: string }> = [
  { zh: '高牌', en: 'High Card' },
  { zh: '一对', en: 'One Pair' },
  { zh: '两对', en: 'Two Pair' },
  { zh: '三条', en: 'Three of a Kind' },
  { zh: '顺子', en: 'Straight' },
  { zh: '同花', en: 'Flush' },
  { zh: '葫芦', en: 'Full House' },
  { zh: '四条', en: 'Four of a Kind' },
  { zh: '同花顺', en: 'Straight Flush' },
];

export function createShuffledDeck(rng: () => number = Math.random): PlayingCard[] {
  const suits: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const deck: PlayingCard[] = [];
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getStraightHigh(sortedDescRanks: number[]): number | null {
  // Assumes 5 unique sorted descending ranks or 5 sorted descending ranks
  const unique = Array.from(new Set(sortedDescRanks));
  if (unique.length !== 5) return null;
  if (unique[0] - unique[4] === 4) return unique[0];
  // Wheel straight: A-5-4-3-2 => [14, 5, 4, 3, 2]
  if (
    unique[0] === 14 &&
    unique[1] === 5 &&
    unique[2] === 4 &&
    unique[3] === 3 &&
    unique[4] === 2
  ) {
    return 5;
  }
  return null;
}

function evaluateFiveCards(cards: PlayingCard[]): EvaluatedHand {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);
  const straightHigh = getStraightHigh(ranks);

  const counts = new Map<number, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  // Sort rank groups by (count desc, rank desc)
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  let category = 0;
  let tiebreakers: number[] = ranks;

  if (isFlush && straightHigh !== null) {
    category = 8;
    tiebreakers = [straightHigh];
  } else if (groups[0][1] === 4) {
    category = 7;
    tiebreakers = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = 6;
    tiebreakers = [groups[0][0], groups[1][0]];
  } else if (isFlush) {
    category = 5;
    tiebreakers = ranks;
  } else if (straightHigh !== null) {
    category = 4;
    tiebreakers = [straightHigh];
  } else if (groups[0][1] === 3) {
    category = 3;
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = 2;
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2) {
    category = 1;
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  } else {
    category = 0;
    tiebreakers = ranks;
  }

  // Special label for Royal Flush
  const isRoyal = category === 8 && straightHigh === 14;
  return {
    category,
    tiebreakers,
    bestFive: sorted,
    labelZh: isRoyal ? '皇家同花顺' : CATEGORY_LABELS[category].zh,
    labelEn: isRoyal ? 'Royal Flush' : CATEGORY_LABELS[category].en,
  };
}

export function compareEvaluatedHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const va = a.tiebreakers[i] ?? 0;
    const vb = b.tiebreakers[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function evaluateTexasHand(cards: PlayingCard[]): EvaluatedHand {
  if (cards.length < 5) {
    // Partial hand (preflop / partial helper): classify high card or pair for UI helper
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const counts = new Map<number, number>();
    for (const c of sorted) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
    const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    if (groups[0]?.[1] === 2) {
      return {
        category: 1,
        tiebreakers: [groups[0][0]],
        bestFive: sorted,
        labelZh: '口袋对子',
        labelEn: 'Pocket Pair',
      };
    }
    return {
      category: 0,
      tiebreakers: sorted.map((c) => c.rank),
      bestFive: sorted,
      labelZh: '起手高牌',
      labelEn: 'High Card',
    };
  }

  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }

  let best: EvaluatedHand | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const candidate = evaluateFiveCards([
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[e],
            ]);
            if (!best || compareEvaluatedHands(candidate, best) > 0) {
              best = candidate;
            }
          }
        }
      }
    }
  }
  return best!;
}

export function formatRank(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}
