import type { LocalizedText } from './common.js';

// ==========================================
// 5. SKETCH RELAY (Soul Sketcher)
// ==========================================
export interface SketchOptions {
  drawSeconds: number;
  guessSeconds: number;
}

export interface SketchEntry {
  authorId: string;
  kind: 'prompt' | 'draw' | 'guess';
  text?: string;
  imageDataUrl?: string;
}

export interface SketchBook {
  ownerId: string;
  entries: SketchEntry[];
}

export interface SketchPublicState {
  phase: 'prompt' | 'draw' | 'guess' | 'exhibition' | 'game_over';
  step: number;
  totalSteps: number;
  submittedIds: string[];
  exhibitionBookIndex: number;
  exhibitionEntryIndex: number;
  totalBooks: number;
  currentBookTotalEntries: number;
  revealedBook?: SketchBook;
  allBooks?: SketchBook[];
  mvpVotes: Record<string, string>; // voterId -> targetOwnerId
  winnerBookOwnerIds?: string[];
  phaseDeadline?: number;
}

export interface SketchPrivateState {
  playerId: string;
  assignedBookOwnerId: string;
  hasSubmitted: boolean;
  promptChoices?: LocalizedText[];
  previousEntry?: SketchEntry;
  hasVotedMvp: boolean;
}
