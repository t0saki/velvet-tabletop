import type { LocalizedText } from './common.js';

// ==========================================
// 1. AVALON (Crown & Chalice)
// ==========================================
export type AvalonRole =
  | 'merlin'
  | 'percival'
  | 'loyal'
  | 'morgana'
  | 'assassin'
  | 'mordred'
  | 'oberon'
  | 'minion';

export type AvalonFaction = 'good' | 'evil';

export interface AvalonOptions {
  includePercivalMorgana: boolean;
  includeMordred: boolean;
  includeOberon: boolean;
  includeLadyOfTheLake?: boolean;
}

export interface AvalonQuestRecord {
  questIndex: number;
  teamSize: number;
  requiredFails: number;
  status: 'pending' | 'active' | 'success' | 'fail';
  teamIds: string[];
  failCount: number;
  successCount: number;
}

export interface AvalonVoteHistoryEntry {
  questIndex: number;
  attempt: number;
  leaderId: string;
  teamIds: string[];
  votes: Record<string, 'approve' | 'reject'>;
  approved: boolean;
}

export interface AvalonPublicState {
  phase:
    | 'role_peek'
    | 'team_propose'
    | 'team_vote'
    | 'quest_execute'
    | 'quest_reveal'
    | 'lady_peek'
    | 'assassin_shot'
    | 'game_over';
  questIndex: number;
  leaderId: string;
  rejectTrack: number;
  proposedTeamIds: string[];
  votedPlayerIds: string[];
  questSubmittedIds: string[];
  peekedPlayerIds: string[];
  quests: AvalonQuestRecord[];
  voteHistory: AvalonVoteHistoryEntry[];
  lastVoteEntry?: AvalonVoteHistoryEntry;
  roleDeckSummary: AvalonRole[];
  lastReveal?: {
    questIndex: number;
    cards: Array<'success' | 'fail'>;
    passed: boolean;
    failCount: number;
  };
  ladyHolderId?: string;
  ladyTestedIds?: string[];
  ladyHistory?: Array<{
    questIndex: number;
    holderId: string;
    targetId: string;
  }>;
  assassinId?: string;
  assassinTargetId?: string;
  winner?: AvalonFaction;
  winReason?: LocalizedText;
  revealedRoles?: Record<string, AvalonRole>;
  phaseDeadline?: number;
}

export interface AvalonPrivateState {
  playerId: string;
  role: AvalonRole;
  faction: AvalonFaction;
  visionPlayers: Array<{
    playerId: string;
    label: LocalizedText;
  }>;
  hasPeeked: boolean;
  hasVoted: boolean;
  hasSubmittedQuest: boolean;
  canPropose: boolean;
  canLadyInspect?: boolean;
  canAssassinate: boolean;
  ladyKnowledge?: Array<{
    targetId: string;
    faction: AvalonFaction;
    questIndex: number;
  }>;
}
