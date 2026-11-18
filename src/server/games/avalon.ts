import type { PlayerSeat } from '../../shared/types.js';
import type {
  AvalonFaction,
  AvalonOptions,
  AvalonPrivateState,
  AvalonPublicState,
  AvalonQuestRecord,
  AvalonRole,
  AvalonVoteHistoryEntry,
} from '../../shared/gameTypes.js';
import type { GameDefinition, GameStepResult } from './engine.js';

const PHASE_DEADLINES = {
  team_propose: 90_000,
  team_vote: 45_000,
  quest_execute: 40_000,
  quest_reveal: 4_500,
  lady_peek: 35_000,
  assassin_shot: 60_000,
} as const;

const QUEST_TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

const EVIL_COUNTS: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isEvilRole(role: AvalonRole): boolean {
  return (
    role === 'assassin' ||
    role === 'morgana' ||
    role === 'mordred' ||
    role === 'oberon' ||
    role === 'minion'
  );
}

export interface AvalonLadyKnowledgeRecord {
  holderId: string;
  targetId: string;
  faction: AvalonFaction;
  questIndex: number;
}

export interface AvalonState {
  options: AvalonOptions;
  phase: AvalonPublicState['phase'];
  seatOrder: string[];
  roles: Record<string, AvalonRole>;
  roleDeckSummary: AvalonRole[];
  peekedIds: string[];
  questIndex: number;
  leaderCursor: number;
  rejectTrack: number;
  proposedTeamIds: string[];
  votes: Record<string, 'approve' | 'reject'>;
  questCards: Record<string, 'success' | 'fail'>;
  quests: AvalonQuestRecord[];
  voteHistory: AvalonVoteHistoryEntry[];
  lastReveal?: AvalonPublicState['lastReveal'];
  ladyHolderId?: string;
  ladyTestedIds?: string[];
  ladyHistory?: Array<{
    questIndex: number;
    holderId: string;
    targetId: string;
  }>;
  ladyKnowledge?: AvalonLadyKnowledgeRecord[];
  assassinId: string;
  assassinTargetId?: string;
  winner?: AvalonFaction;
  winReason?: AvalonPublicState['winReason'];
  phaseDeadline?: number;
}

export type AvalonAction =
  | { type: 'peek_ready' }
  | { type: 'propose_team'; teamIds: string[] }
  | { type: 'cast_vote'; vote: 'approve' | 'reject' }
  | { type: 'submit_quest'; card: 'success' | 'fail' }
  | { type: 'lady_inspect'; targetId: string }
  | { type: 'assassinate'; targetId: string };

function buildRoleDeck(seatCount: number, options: AvalonOptions): AvalonRole[] {
  const count = Math.max(5, Math.min(10, seatCount));
  const evilTotal = EVIL_COUNTS[count] ?? 2;
  const goodTotal = seatCount - evilTotal;

  const goodRoles: AvalonRole[] = ['merlin'];
  if (options.includePercivalMorgana && goodRoles.length < goodTotal) {
    goodRoles.push('percival');
  }
  while (goodRoles.length < goodTotal) {
    goodRoles.push('loyal');
  }

  const evilRoles: AvalonRole[] = ['assassin'];
  if (options.includePercivalMorgana && evilRoles.length < evilTotal) {
    evilRoles.push('morgana');
  }
  if (options.includeMordred && evilRoles.length < evilTotal) {
    evilRoles.push('mordred');
  }
  if (options.includeOberon && evilRoles.length < evilTotal) {
    evilRoles.push('oberon');
  }
  while (evilRoles.length < evilTotal) {
    evilRoles.push('minion');
  }

  return [...goodRoles, ...evilRoles];
}

function assignRoles(
  seatIds: string[],
  roleDeck: AvalonRole[],
): Record<string, AvalonRole> {
  const allRoles = shuffle(roleDeck);
  const map: Record<string, AvalonRole> = {};
  seatIds.forEach((id, idx) => {
    map[id] = allRoles[idx];
  });
  return map;
}

function computeScoreDeltas(
  state: AvalonState,
  winner: AvalonFaction,
  assassinTargetId?: string,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const id of state.seatOrder) {
    const role = state.roles[id];
    const evil = isEvilRole(role);
    if ((winner === 'evil' && evil) || (winner === 'good' && !evil)) {
      deltas[id] = winner === 'good' && role === 'merlin' ? 4 : 3;
    }
  }
  if (
    winner === 'evil' &&
    assassinTargetId &&
    state.roles[assassinTargetId] === 'merlin'
  ) {
    deltas[state.assassinId] = (deltas[state.assassinId] ?? 0) + 1;
  }
  return deltas;
}

function advanceToNextQuest(state: AvalonState, now: number): AvalonState {
  const nextQuestIndex = state.questIndex + 1;
  const nextLeader = (state.leaderCursor + 1) % state.seatOrder.length;
  const nextQuests = state.quests.map((q, idx) =>
    idx === nextQuestIndex ? { ...q, status: 'active' as const } : q,
  );

  return {
    ...state,
    phase: 'team_propose',
    questIndex: nextQuestIndex,
    leaderCursor: nextLeader,
    rejectTrack: 0,
    proposedTeamIds: [],
    votes: {},
    questCards: {},
    quests: nextQuests,
    phaseDeadline: now + PHASE_DEADLINES.team_propose,
  };
}

function performLadyInspect(
  state: AvalonState,
  holderId: string,
  targetId: string,
  now: number,
): GameStepResult<AvalonState> {
  const faction: AvalonFaction = isEvilRole(state.roles[targetId]) ? 'evil' : 'good';
  const ladyKnowledge: AvalonLadyKnowledgeRecord[] = [
    ...(state.ladyKnowledge ?? []),
    { holderId, targetId, faction, questIndex: state.questIndex },
  ];
  const ladyHistory = [
    ...(state.ladyHistory ?? []),
    { questIndex: state.questIndex, holderId, targetId },
  ];
  const tested = state.ladyTestedIds ?? [];
  const ladyTestedIds = tested.includes(targetId) ? tested : [...tested, targetId];

  const nextState = advanceToNextQuest(
    {
      ...state,
      ladyHolderId: targetId,
      ladyTestedIds,
      ladyHistory,
      ladyKnowledge,
    },
    now,
  );

  return {
    state: nextState,
    sfx: 'revealDrum',
  };
}

function advanceAfterReveal(state: AvalonState, now: number): GameStepResult<AvalonState> {
  const successCount = state.quests.filter((q) => q.status === 'success').length;
  const failCount = state.quests.filter((q) => q.status === 'fail').length;

  if (failCount >= 3) {
    return {
      state: {
        ...state,
        phase: 'game_over',
        winner: 'evil',
        winReason: {
          zh: '邪恶阵营累计破坏了三次任务，暗影夺取王座！',
          en: 'Evil sabotaged three quests and seized the Round Table!',
        },
        phaseDeadline: undefined,
      },
      voiceClip: 'evil_wins',
      sfx: 'gavelBang',
      scoreDeltas: computeScoreDeltas(state, 'evil'),
    };
  }

  if (successCount >= 3) {
    return {
      state: {
        ...state,
        phase: 'assassin_shot',
        phaseDeadline: now + PHASE_DEADLINES.assassin_shot,
      },
      voiceClip: 'assassin_phase',
      sfx: 'revealDrum',
    };
  }

  const ladyEligible =
    Boolean(state.options.includeLadyOfTheLake) &&
    state.seatOrder.length >= 7 &&
    Boolean(state.ladyHolderId) &&
    (state.questIndex === 1 || state.questIndex === 2 || state.questIndex === 3);

  if (ladyEligible && state.ladyHolderId) {
    const tested = state.ladyTestedIds ?? [];
    const hasUntested = state.seatOrder.some(
      (id) => id !== state.ladyHolderId && !tested.includes(id),
    );
    if (hasUntested) {
      return {
        state: {
          ...state,
          phase: 'lady_peek',
          phaseDeadline: now + PHASE_DEADLINES.lady_peek,
        },
        sfx: 'cardFlip',
      };
    }
  }

  return {
    state: advanceToNextQuest(state, now),
  };
}

function resolveVoteOutcome(
  state: AvalonState,
  votes: Record<string, 'approve' | 'reject'>,
  now: number,
): GameStepResult<AvalonState> {
  const approveCount = Object.values(votes).filter((v) => v === 'approve').length;
  const approved = approveCount > state.seatOrder.length / 2;
  const leaderId = state.seatOrder[state.leaderCursor];

  const entry: AvalonVoteHistoryEntry = {
    questIndex: state.questIndex,
    attempt: state.rejectTrack + 1,
    leaderId,
    teamIds: state.proposedTeamIds,
    votes,
    approved,
  };
  const voteHistory = [...state.voteHistory, entry];

  if (approved) {
    return {
      state: {
        ...state,
        votes,
        voteHistory,
        questCards: {},
        phase: 'quest_execute',
        phaseDeadline: now + PHASE_DEADLINES.quest_execute,
      },
      voiceClip: 'quest_start',
      sfx: 'gavelBang',
    };
  }

  const nextReject = state.rejectTrack + 1;
  if (nextReject >= 5) {
    return {
      state: {
        ...state,
        votes,
        voteHistory,
        rejectTrack: nextReject,
        phase: 'game_over',
        winner: 'evil',
        winReason: {
          zh: '同一轮连续五次组队遭否决，议会陷入混乱，邪恶阵营获胜！',
          en: 'Five consecutive team proposals were rejected—Evil claims victory!',
        },
        phaseDeadline: undefined,
      },
      voiceClip: 'evil_wins',
      sfx: 'gavelBang',
      scoreDeltas: computeScoreDeltas(state, 'evil'),
    };
  }

  return {
    state: {
      ...state,
      votes,
      voteHistory,
      rejectTrack: nextReject,
      leaderCursor: (state.leaderCursor + 1) % state.seatOrder.length,
      proposedTeamIds: [],
      phase: 'team_propose',
      phaseDeadline: now + PHASE_DEADLINES.team_propose,
    },
    sfx: 'gavelBang',
  };
}

function resolveQuestOutcome(
  state: AvalonState,
  questCards: Record<string, 'success' | 'fail'>,
  now: number,
): GameStepResult<AvalonState> {
  const cards = shuffle(Object.values(questCards));
  const failCount = cards.filter((c) => c === 'fail').length;
  const successCount = cards.length - failCount;
  const requiredFails = state.quests[state.questIndex].requiredFails;
  const passed = failCount < requiredFails;

  const quests = state.quests.map((q, idx) =>
    idx === state.questIndex
      ? {
          ...q,
          status: passed ? ('success' as const) : ('fail' as const),
          teamIds: state.proposedTeamIds,
          failCount,
          successCount,
        }
      : q,
  );

  return {
    state: {
      ...state,
      questCards,
      quests,
      phase: 'quest_reveal',
      lastReveal: {
        questIndex: state.questIndex,
        cards,
        passed,
        failCount,
      },
      phaseDeadline: now + PHASE_DEADLINES.quest_reveal,
    },
    voiceClip: passed ? 'quest_success' : 'quest_fail',
    sfx: 'revealDrum',
  };
}

function resolveAssassinShot(
  state: AvalonState,
  targetId: string,
): GameStepResult<AvalonState> {
  const hitMerlin = state.roles[targetId] === 'merlin';
  const winner: AvalonFaction = hitMerlin ? 'evil' : 'good';
  return {
    state: {
      ...state,
      assassinTargetId: targetId,
      phase: 'game_over',
      winner,
      winReason: hitMerlin
        ? {
            zh: '刺客精准识破并刺杀了先知梅林！邪恶阵营惊天翻盘！',
            en: 'The Assassin struck true and felled Merlin! Evil steals victory!',
          }
        : {
            zh: '刺客错失了真正的梅林！正义阵营守住了圣杯！',
            en: 'The Assassin missed Merlin! Camelot and the Loyalists triumph!',
          },
      phaseDeadline: undefined,
    },
    voiceClip: hitMerlin ? 'evil_wins' : 'good_wins',
    sfx: hitMerlin ? 'gavelBang' : 'victoryFanfare',
    scoreDeltas: computeScoreDeltas(state, winner, targetId),
  };
}

function resolvePhaseTimeout(state: AvalonState, now: number): GameStepResult<AvalonState> {
  if (state.phase === 'role_peek') {
    return {
      state: {
        ...state,
        peekedIds: [...state.seatOrder],
        phase: 'team_propose',
        phaseDeadline: now + PHASE_DEADLINES.team_propose,
      },
      sfx: 'cardFlip',
    };
  }

  if (state.phase === 'team_propose') {
    const needed = state.quests[state.questIndex].teamSize;
    const leaderId = state.seatOrder[state.leaderCursor];
    const others = state.seatOrder.filter((id) => id !== leaderId);
    const team = [leaderId, ...others].slice(0, needed);
    return {
      state: {
        ...state,
        proposedTeamIds: team,
        votes: {},
        phase: 'team_vote',
        phaseDeadline: now + PHASE_DEADLINES.team_vote,
      },
      voiceClip: 'team_vote',
      sfx: 'cardSlide',
    };
  }

  if (state.phase === 'team_vote') {
    const votes: Record<string, 'approve' | 'reject'> = { ...state.votes };
    for (const id of state.seatOrder) {
      if (!votes[id]) votes[id] = 'approve';
    }
    return resolveVoteOutcome(state, votes, now);
  }

  if (state.phase === 'quest_execute') {
    const questCards: Record<string, 'success' | 'fail'> = { ...state.questCards };
    for (const id of state.proposedTeamIds) {
      if (!questCards[id]) questCards[id] = 'success';
    }
    return resolveQuestOutcome(state, questCards, now);
  }

  if (state.phase === 'quest_reveal') {
    return advanceAfterReveal(state, now);
  }

  if (state.phase === 'lady_peek') {
    const tested = state.ladyTestedIds ?? [];
    const holderId = state.ladyHolderId;
    const targetId = holderId
      ? state.seatOrder.find((id) => id !== holderId && !tested.includes(id))
      : undefined;
    if (holderId && targetId) {
      return performLadyInspect(state, holderId, targetId, now);
    }
    return { state: advanceToNextQuest(state, now) };
  }

  if (state.phase === 'assassin_shot') {
    const goodTargets = state.seatOrder.filter((id) => !isEvilRole(state.roles[id]));
    const targetId = goodTargets[0] ?? state.seatOrder[0];
    return resolveAssassinShot(state, targetId);
  }

  return { state };
}

export const avalonGame: GameDefinition<
  AvalonState,
  AvalonOptions,
  AvalonPublicState,
  AvalonPrivateState,
  AvalonAction
> = {
  id: 'avalon',
  minPlayers: 5,
  maxPlayers: 10,
  defaultOptions: {
    includePercivalMorgana: true,
    includeMordred: false,
    includeOberon: false,
    includeLadyOfTheLake: false,
  },

  createInitialState(seats: PlayerSeat[], rawOptions: AvalonOptions) {
    const options: AvalonOptions = {
      ...this.defaultOptions,
      ...rawOptions,
    };
    const seatOrder = seats.map((s) => s.id);
    const roleDeckSummary = buildRoleDeck(seatOrder.length, options);
    const roles = assignRoles(seatOrder, roleDeckSummary);
    const count = Math.max(5, Math.min(10, seatOrder.length));
    const sizes = QUEST_TEAM_SIZES[count] ?? QUEST_TEAM_SIZES[5];

    const quests: AvalonQuestRecord[] = sizes.map((teamSize, idx) => ({
      questIndex: idx,
      teamSize,
      requiredFails: count >= 7 && idx === 3 ? 2 : 1,
      status: idx === 0 ? 'active' : 'pending',
      teamIds: [],
      failCount: 0,
      successCount: 0,
    }));

    const assassinId =
      Object.entries(roles).find(([, r]) => r === 'assassin')?.[0] ?? seatOrder[0];
    const leaderCursor = Math.floor(Math.random() * seatOrder.length);
    const ladyEnabled = Boolean(options.includeLadyOfTheLake && seatOrder.length >= 7);
    const ladyHolderId = ladyEnabled
      ? seatOrder[(leaderCursor - 1 + seatOrder.length) % seatOrder.length]
      : undefined;

    const state: AvalonState = {
      options,
      phase: 'role_peek',
      seatOrder,
      roles,
      roleDeckSummary,
      peekedIds: [],
      questIndex: 0,
      leaderCursor,
      rejectTrack: 0,
      proposedTeamIds: [],
      votes: {},
      questCards: {},
      quests,
      voteHistory: [],
      ladyHolderId,
      ladyTestedIds: ladyHolderId ? [ladyHolderId] : undefined,
      ladyHistory: ladyEnabled ? [] : undefined,
      ladyKnowledge: ladyEnabled ? [] : undefined,
      assassinId,
    };

    return { state, voiceClip: 'night_vision' };
  },

  applyAction(state, actorId, action) {
    if (state.phase === 'game_over') {
      return { state, error: 'Game already finished' };
    }

    const now = Date.now();

    if (action.type === 'peek_ready') {
      if (state.phase !== 'role_peek') return { state };
      if (!state.seatOrder.includes(actorId)) return { state };
      const peekedIds = state.peekedIds.includes(actorId)
        ? state.peekedIds
        : [...state.peekedIds, actorId];
      if (peekedIds.length >= state.seatOrder.length) {
        return {
          state: {
            ...state,
            peekedIds,
            phase: 'team_propose',
            phaseDeadline: now + PHASE_DEADLINES.team_propose,
          },
          sfx: 'cardFlip',
        };
      }
      return {
        state: { ...state, peekedIds },
        sfx: 'buttonTap',
      };
    }

    if (action.type === 'propose_team') {
      if (state.phase !== 'team_propose') {
        return { state, error: 'Not in team proposal phase' };
      }
      const leaderId = state.seatOrder[state.leaderCursor];
      if (actorId !== leaderId) {
        return { state, error: 'Only the current leader can propose a team' };
      }
      const needed = state.quests[state.questIndex].teamSize;
      const uniqueTeam = Array.from(new Set(action.teamIds)).filter((id) =>
        state.seatOrder.includes(id),
      );
      if (uniqueTeam.length !== needed) {
        return { state, error: `Select exactly ${needed} players` };
      }
      return {
        state: {
          ...state,
          proposedTeamIds: uniqueTeam,
          votes: {},
          phase: 'team_vote',
          phaseDeadline: now + PHASE_DEADLINES.team_vote,
        },
        voiceClip: 'team_vote',
        sfx: 'cardSlide',
      };
    }

    if (action.type === 'cast_vote') {
      if (state.phase !== 'team_vote') {
        return { state, error: 'Not in voting phase' };
      }
      if (!state.seatOrder.includes(actorId)) {
        return { state, error: 'Invalid player' };
      }
      const votes = { ...state.votes, [actorId]: action.vote };
      if (Object.keys(votes).length < state.seatOrder.length) {
        return { state: { ...state, votes }, sfx: 'buttonTap' };
      }
      return resolveVoteOutcome(state, votes, now);
    }

    if (action.type === 'submit_quest') {
      if (state.phase !== 'quest_execute') {
        return { state, error: 'Not in quest execution phase' };
      }
      if (!state.proposedTeamIds.includes(actorId)) {
        return { state, error: 'You are not on the expedition team' };
      }
      if (state.questCards[actorId]) {
        return { state };
      }
      // Enforce anti-cheat: Good faction can NEVER submit Fail
      const role = state.roles[actorId] ?? 'loyal';
      const safeCard: 'success' | 'fail' = isEvilRole(role) ? action.card : 'success';

      const questCards = { ...state.questCards, [actorId]: safeCard };
      if (Object.keys(questCards).length < state.proposedTeamIds.length) {
        return { state: { ...state, questCards }, sfx: 'cardSlide' };
      }

      return resolveQuestOutcome(state, questCards, now);
    }

    if (action.type === 'lady_inspect') {
      if (state.phase !== 'lady_peek') {
        return { state, error: 'Not in Lady of the Lake phase' };
      }
      if (!state.ladyHolderId || actorId !== state.ladyHolderId) {
        return { state, error: 'Only the Lady of the Lake holder can inspect' };
      }
      if (!state.seatOrder.includes(action.targetId)) {
        return { state, error: 'Invalid target' };
      }
      if (action.targetId === actorId) {
        return { state, error: 'Cannot inspect yourself' };
      }
      if ((state.ladyTestedIds ?? []).includes(action.targetId)) {
        return { state, error: 'Player already inspected by Lady of the Lake' };
      }
      return performLadyInspect(state, actorId, action.targetId, now);
    }

    if (action.type === 'assassinate') {
      if (state.phase !== 'assassin_shot') {
        return { state, error: 'Not in assassination phase' };
      }
      if (actorId !== state.assassinId) {
        return { state, error: 'Only the Assassin can take the final shot' };
      }
      if (!state.seatOrder.includes(action.targetId)) {
        return { state, error: 'Invalid target' };
      }
      return resolveAssassinShot(state, action.targetId);
    }

    return { state };
  },

  onTick(state, now) {
    if (state.phase === 'game_over') return null;
    if (!state.phaseDeadline || now < state.phaseDeadline) return null;
    return resolvePhaseTimeout(state, now);
  },

  forceSkipCurrent(state) {
    if (state.phase === 'game_over') return { state };
    return resolvePhaseTimeout(state, Date.now());
  },

  projectPublic(state): AvalonPublicState {
    return {
      phase: state.phase,
      questIndex: state.questIndex,
      leaderId: state.seatOrder[state.leaderCursor],
      rejectTrack: state.rejectTrack,
      proposedTeamIds: state.proposedTeamIds,
      votedPlayerIds: Object.keys(state.votes),
      questSubmittedIds: Object.keys(state.questCards),
      peekedPlayerIds: state.peekedIds,
      quests: state.quests,
      voteHistory: state.voteHistory,
      lastVoteEntry: state.voteHistory[state.voteHistory.length - 1],
      roleDeckSummary: state.roleDeckSummary,
      lastReveal: state.lastReveal,
      ladyHolderId: state.ladyHolderId,
      ladyTestedIds: state.ladyTestedIds,
      ladyHistory: state.ladyHistory,
      assassinId:
        state.phase === 'assassin_shot' || state.phase === 'game_over'
          ? state.assassinId
          : undefined,
      assassinTargetId: state.assassinTargetId,
      winner: state.winner,
      winReason: state.winReason,
      revealedRoles: state.phase === 'game_over' ? state.roles : undefined,
      phaseDeadline: state.phaseDeadline,
    };
  },

  projectPrivate(state, playerId): AvalonPrivateState {
    const role = state.roles[playerId] ?? 'loyal';
    const faction: AvalonFaction = isEvilRole(role) ? 'evil' : 'good';
    const visionPlayers: AvalonPrivateState['visionPlayers'] = [];

    if (role === 'merlin') {
      for (const [id, r] of Object.entries(state.roles)) {
        if (id !== playerId && isEvilRole(r) && r !== 'mordred') {
          visionPlayers.push({
            playerId: id,
            label: { zh: '邪恶阵营（梅林视野）', en: 'Evil (Merlin Vision)' },
          });
        }
      }
    } else if (role === 'percival') {
      const candidates = Object.entries(state.roles)
        .filter(([, r]) => r === 'merlin' || r === 'morgana')
        .map(([id]) => id);
      // Sort deterministically by seatOrder so secret position isn't leaked by insertion order
      const ordered = state.seatOrder.filter((id) => candidates.includes(id));
      for (const id of ordered) {
        visionPlayers.push({
          playerId: id,
          label: { zh: '梅林 / 莫甘娜（二选一）', en: 'Merlin or Morgana' },
        });
      }
    } else if (isEvilRole(role) && role !== 'oberon') {
      for (const [id, r] of Object.entries(state.roles)) {
        if (id !== playerId && isEvilRole(r) && r !== 'oberon') {
          visionPlayers.push({
            playerId: id,
            label: { zh: '邪恶同伙', en: 'Evil Ally' },
          });
        }
      }
    }

    const myLadyKnowledge = (state.ladyKnowledge ?? [])
      .filter((k) => k.holderId === playerId)
      .map(({ targetId, faction: targetFaction, questIndex }) => ({
        targetId,
        faction: targetFaction,
        questIndex,
      }));

    return {
      playerId,
      role,
      faction,
      visionPlayers,
      hasPeeked: state.peekedIds.includes(playerId),
      hasVoted: Boolean(state.votes[playerId]),
      hasSubmittedQuest: Boolean(state.questCards[playerId]),
      canPropose:
        state.phase === 'team_propose' &&
        state.seatOrder[state.leaderCursor] === playerId,
      canLadyInspect:
        state.phase === 'lady_peek' && state.ladyHolderId === playerId,
      canAssassinate:
        state.phase === 'assassin_shot' && state.assassinId === playerId,
      ladyKnowledge: myLadyKnowledge.length > 0 ? myLadyKnowledge : undefined,
    };
  },

  computeBotAction(state, botId) {
    if (state.phase === 'role_peek' && !state.peekedIds.includes(botId)) {
      return { type: 'peek_ready' };
    }

    const role = state.roles[botId];
    const isEvil = isEvilRole(role);

    if (state.phase === 'lady_peek' && state.ladyHolderId === botId) {
      const tested = state.ladyTestedIds ?? [];
      const eligible = state.seatOrder.filter(
        (id) => id !== botId && !tested.includes(id),
      );
      if (eligible.length === 0) return null;

      if (isEvil) {
        const nonTeammates = eligible.filter(
          (id) => !isEvilRole(state.roles[id]) || state.roles[id] === 'oberon',
        );
        const pool = nonTeammates.length > 0 ? nonTeammates : eligible;
        return { type: 'lady_inspect', targetId: shuffle(pool)[0] };
      }

      const taintedIds = new Set<string>();
      for (const q of state.quests) {
        if (q.status === 'fail') {
          q.teamIds.forEach((id) => taintedIds.add(id));
        }
      }
      const suspectPool = eligible.filter((id) => taintedIds.has(id));
      const pool = suspectPool.length > 0 ? suspectPool : eligible;
      return { type: 'lady_inspect', targetId: shuffle(pool)[0] };
    }

    const knownEvilFromLady = new Set<string>(
      (state.ladyKnowledge ?? [])
        .filter((k) => k.holderId === botId && k.faction === 'evil')
        .map((k) => k.targetId),
    );

    if (
      state.phase === 'team_propose' &&
      state.seatOrder[state.leaderCursor] === botId
    ) {
      const needed = state.quests[state.questIndex].teamSize;
      // Find suspected players from failed quests or private Lady inspections
      const taintedIds = new Set<string>(knownEvilFromLady);
      for (const q of state.quests) {
        if (q.status === 'fail') {
          q.teamIds.forEach((id) => taintedIds.add(id));
        }
      }
      const cleanPool = state.seatOrder.filter(
        (id) => id !== botId && !taintedIds.has(id),
      );
      const restPool = state.seatOrder.filter(
        (id) => id !== botId && taintedIds.has(id),
      );
      const candidates = isEvil
        ? shuffle(state.seatOrder.filter((id) => id !== botId))
        : [...shuffle(cleanPool), ...shuffle(restPool)];
      return {
        type: 'propose_team',
        teamIds: [botId, ...candidates].slice(0, needed),
      };
    }

    if (state.phase === 'team_vote' && !state.votes[botId]) {
      if (state.rejectTrack >= 4 && !isEvil) {
        return { type: 'cast_vote', vote: 'approve' };
      }
      if (state.proposedTeamIds.includes(botId)) {
        return { type: 'cast_vote', vote: 'approve' };
      }
      if (isEvil) {
        const hasEvilOnTeam = state.proposedTeamIds.some((id) =>
          isEvilRole(state.roles[id]),
        );
        return {
          type: 'cast_vote',
          vote: hasEvilOnTeam || Math.random() < 0.35 ? 'approve' : 'reject',
        };
      }
      if (state.proposedTeamIds.some((id) => knownEvilFromLady.has(id))) {
        return { type: 'cast_vote', vote: 'reject' };
      }
      if (role === 'merlin') {
        const seesEvilOnTeam = state.proposedTeamIds.some((id) => {
          const r = state.roles[id];
          return isEvilRole(r) && r !== 'mordred';
        });
        return { type: 'cast_vote', vote: seesEvilOnTeam ? 'reject' : 'approve' };
      }
      const failedTeamOverlap = state.quests.some(
        (q) =>
          q.status === 'fail' &&
          q.teamIds.every((id) => state.proposedTeamIds.includes(id)),
      );
      return {
        type: 'cast_vote',
        vote: failedTeamOverlap ? 'reject' : Math.random() < 0.72 ? 'approve' : 'reject',
      };
    }

    if (
      state.phase === 'quest_execute' &&
      state.proposedTeamIds.includes(botId) &&
      !state.questCards[botId]
    ) {
      if (!isEvil) return { type: 'submit_quest', card: 'success' };
      // Strategic fail: sometimes pass quest 1, usually fail later quests
      const shouldFail =
        state.questIndex > 0 || state.proposedTeamIds.length >= 3 || Math.random() < 0.65;
      return { type: 'submit_quest', card: shouldFail ? 'fail' : 'success' };
    }

    if (state.phase === 'assassin_shot' && state.assassinId === botId) {
      const goodIds = state.seatOrder.filter((id) => !isEvilRole(state.roles[id]));
      // Guess among good players who rejected evil teams often
      const rejectCounts = new Map<string, number>();
      for (const vh of state.voteHistory) {
        const evilCount = vh.teamIds.filter((id) => isEvilRole(state.roles[id])).length;
        if (evilCount > 0) {
          for (const gid of goodIds) {
            if (vh.votes[gid] === 'reject') {
              rejectCounts.set(gid, (rejectCounts.get(gid) ?? 0) + 1);
            }
          }
        }
      }
      const ranked = [...goodIds].sort(
        (a, b) => (rejectCounts.get(b) ?? 0) - (rejectCounts.get(a) ?? 0),
      );
      return { type: 'assassinate', targetId: ranked[0] ?? state.seatOrder[0] };
    }

    return null;
  },
};
