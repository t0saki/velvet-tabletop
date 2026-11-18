import type { LocalizedText } from './common.js';

// ==========================================
// 2. WEREWOLF (Moonlit Coven)
// ==========================================
export type WerewolfRole =
  | 'werewolf'
  | 'villager'
  | 'seer'
  | 'witch'
  | 'hunter'
  | 'guard';

export interface WerewolfOptions {
  speechSeconds: number;
  enableSheriff: boolean;
  sameGuardHealDies: boolean;
}

export interface WerewolfPublicState {
  phase:
    | 'role_peek'
    | 'night_guard'
    | 'night_wolf'
    | 'night_witch'
    | 'night_seer'
    | 'dawn_announce'
    | 'sheriff_campaign'
    | 'sheriff_vote'
    | 'sheriff_handover'
    | 'day_speech'
    | 'day_vote'
    | 'hunter_revenge'
    | 'game_over';
  dayNumber: number;
  aliveIds: string[];
  deadPlayers: Array<{
    playerId: string;
    cause: 'night' | 'exile' | 'hunter' | 'poison';
    dayNumber: number;
  }>;
  sheriffId?: string | null;
  sheriffCandidates?: string[];
  pendingSheriffHandoverId?: string | null;
  currentSpeakerId?: string | null;
  speechQueue: string[];
  votedPlayerIds: string[];
  peekedPlayerIds: string[];
  lastNightSummary?: LocalizedText;
  pkCandidateIds?: string[] | null;
  pendingHunterId?: string | null;
  lastVoteResult?: {
    votes: Record<string, string | 'abstain'>;
    exiledId: string | null;
    tiedIds?: string[];
    sheriffId?: string | null;
  };
  rolePoolCounts: Record<WerewolfRole, number>;
  chronicle: Array<{ day: number; text: LocalizedText }>;
  voteHistory: Array<{
    dayNumber: number;
    isPk: boolean;
    votes: Record<string, string | 'abstain'>;
    exiledId: string | null;
    sheriffId?: string | null;
  }>;
  winner?: 'villagers' | 'werewolves';
  winReason?: LocalizedText;
  revealedRoles?: Record<string, WerewolfRole>;
  phaseDeadline?: number;
}

export interface WerewolfPrivateState {
  playerId: string;
  role: WerewolfRole;
  alive: boolean;
  hasPeeked: boolean;
  wolfTeammates?: string[];
  wolfLivePicks?: Record<string, string>;
  wolfConsensusWarning?: boolean;
  witchState?: {
    hasAntidote: boolean;
    hasPoison: boolean;
    attackedTonightId: string | null;
    actedTonight: boolean;
  };
  seerChecks?: Array<{
    targetId: string;
    isWolf: boolean;
    night: number;
  }>;
  guardLastTargetId?: string | null;
  canActNow: boolean;
}
