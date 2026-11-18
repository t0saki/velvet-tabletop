import type { LocalizedText } from './common.js';

// ==========================================
// 6. MASQUERADE UNDERCOVER
// ==========================================
export type UndercoverRole = 'civilian' | 'undercover' | 'blank';

export interface UndercoverOptions {
  category: string;
  includeBlank: boolean;
  clueSeconds: number;
}

export interface UndercoverClueRecord {
  round: number;
  playerId: string;
  clue: string;
  isPk?: boolean;
}

export interface UndercoverVoteRecord {
  round: number;
  isPk: boolean;
  votes: Record<string, string>;
  eliminatedId: string;
}

export interface UndercoverPublicState {
  phase: 'word_peek' | 'clue_round' | 'vote_round' | 'elimination_reveal' | 'game_over';
  round: number;
  category: LocalizedText;
  aliveIds: string[];
  eliminatedIds: string[];
  peekedIds: string[];
  clueQueue: string[];
  currentSpeakerId: string | null;
  clues: UndercoverClueRecord[];
  votedIds: string[];
  pkIds?: string[] | null;
  remainingThreatCount: number;
  voteHistory: UndercoverVoteRecord[];
  lastEliminated?: {
    playerId: string;
    role: UndercoverRole;
    votes: Record<string, string>;
  } | null;
  winner?: 'civilians' | 'undercover';
  revealedIdentities?: Record<
    string,
    { role: UndercoverRole; word: string; wordObj?: LocalizedText | null }
  >;
  civilianWord?: string;
  undercoverWord?: string;
  civilianWordObj?: LocalizedText;
  undercoverWordObj?: LocalizedText;
  phaseDeadline?: number;
}

export interface UndercoverPrivateState {
  playerId: string;
  role: UndercoverRole;
  secretWord: string | null; // null if blank
  secretWordObj?: LocalizedText | null;
  alive: boolean;
  hasPeeked: boolean;
  isMyTurnToClue: boolean;
  hasVoted: boolean;
}
