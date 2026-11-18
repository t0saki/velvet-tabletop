import type { PlayerSeat } from '../../shared/types.js';
import type {
  LocalizedText,
  WerewolfOptions,
  WerewolfPrivateState,
  WerewolfPublicState,
  WerewolfRole,
} from '../../shared/gameTypes.js';
import type { GameDefinition, GameStepResult } from './engine.js';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const GOD_ROLES = new Set<WerewolfRole>(['seer', 'witch', 'hunter', 'guard']);

function fakeNightDelayMs(): number {
  return 4500 + Math.floor(Math.random() * 4500);
}

function getSeatName(seats: PlayerSeat[], playerId: string | null | undefined): string {
  if (!playerId) return '';
  return seats.find((s) => s.id === playerId)?.name ?? playerId;
}

function buildRolePoolCounts(pool: WerewolfRole[]): Record<WerewolfRole, number> {
  const counts: Record<WerewolfRole, number> = {
    werewolf: 0,
    villager: 0,
    seer: 0,
    witch: 0,
    hunter: 0,
    guard: 0,
  };
  for (const r of pool) {
    counts[r] = (counts[r] ?? 0) + 1;
  }
  return counts;
}

function buildRolePool(count: number): WerewolfRole[] {
  switch (count) {
    case 6:
      return ['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager'];
    case 7:
      return ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager'];
    case 8:
      return ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager'];
    case 9:
      return ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'];
    case 10:
      return [
        'werewolf',
        'werewolf',
        'werewolf',
        'seer',
        'witch',
        'hunter',
        'guard',
        'villager',
        'villager',
        'villager',
      ];
    default: {
      // Graceful fallback for <6 or edge tests
      const wolves = Math.max(1, Math.floor(count / 3));
      const pool: WerewolfRole[] = Array(wolves).fill('werewolf');
      if (count >= 4) pool.push('seer', 'witch');
      while (pool.length < count) pool.push('villager');
      return pool;
    }
  }
}

export interface WerewolfState {
  options: WerewolfOptions;
  phase: WerewolfPublicState['phase'];
  seatOrder: string[];
  roles: Record<string, WerewolfRole>;
  rolePoolCounts: Record<WerewolfRole, number>;
  aliveIds: string[];
  deadPlayers: WerewolfPublicState['deadPlayers'];
  peekedIds: string[];
  dayNumber: number;
  hasGuardInGame: boolean;
  // Night tracking
  guardTargetId: string | null;
  lastGuardedId: string | null;
  wolfPicks: Record<string, string>;
  wolfTargetId: string | null;
  hasAntidote: boolean;
  hasPoison: boolean;
  witchActedTonight: boolean;
  witchHealed: boolean;
  witchPoisonId: string | null;
  seerActedTonight: boolean;
  seerChecks: Array<{ targetId: string; isWolf: boolean; night: number }>;
  // Day tracking
  sheriffId: string | null;
  sheriffResponses: Record<string, boolean>;
  sheriffCandidates: string[];
  sheriffVotes: Record<string, string>;
  pendingSheriffHandoverId: string | null;
  sheriffHandoverFromPhase: 'dawn' | 'exile' | null;
  lastNightHadDeaths: boolean;
  speechQueue: string[];
  currentSpeakerId: string | null;
  votes: Record<string, string | 'abstain'>;
  pkCandidateIds: string[] | null;
  pendingHunterId: string | null;
  hunterFromPhase: 'dawn' | 'exile' | null;
  lastNightSummary?: LocalizedText;
  lastVoteResult?: WerewolfPublicState['lastVoteResult'];
  chronicle: Array<{ day: number; text: LocalizedText }>;
  voteHistory: WerewolfPublicState['voteHistory'];
  winner?: 'villagers' | 'werewolves';
  winReason?: LocalizedText;
  phaseDeadline?: number;
}

export type WerewolfAction =
  | { type: 'peek_ready' }
  | { type: 'guard_protect'; targetId: string | null }
  | { type: 'wolf_pick'; targetId: string }
  | { type: 'witch_act'; choice: 'heal' | 'poison' | 'pass'; targetId?: string }
  | { type: 'seer_check'; targetId: string }
  | { type: 'sheriff_decide'; run: boolean }
  | { type: 'sheriff_vote'; candidateId: string }
  | { type: 'sheriff_handover'; targetId: string | null }
  | { type: 'end_speech' }
  | { type: 'cast_vote'; targetId: string | 'abstain' }
  | { type: 'hunter_shoot'; targetId: string | null };

function isRoleAlive(state: WerewolfState, role: WerewolfRole): boolean {
  return state.aliveIds.some((id) => state.roles[id] === role);
}

function getLivingWolves(state: WerewolfState): string[] {
  return state.aliveIds.filter((id) => state.roles[id] === 'werewolf');
}

function findStrictMajorityWolfTarget(
  wolfPicks: Record<string, string>,
  livingWolves: string[],
): string | null {
  if (livingWolves.length === 0) return null;
  const picked = livingWolves
    .map((wid) => wolfPicks[wid])
    .filter((tid): tid is string => Boolean(tid));
  if (picked.length < livingWolves.length) return null;
  const counts = new Map<string, number>();
  for (const tid of picked) {
    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }
  for (const [tid, count] of counts.entries()) {
    if (count > livingWolves.length / 2) {
      return tid;
    }
  }
  return null;
}

function appendChronicle(
  state: WerewolfState,
  day: number,
  text: LocalizedText,
): WerewolfState['chronicle'] {
  return [...state.chronicle, { day, text }];
}

function computeWinScoreDeltas(
  state: WerewolfState,
  winner: 'villagers' | 'werewolves',
): Record<string, number> {
  const scoreDeltas: Record<string, number> = {};
  for (const id of state.seatOrder) {
    const isWolf = state.roles[id] === 'werewolf';
    const onWinningSide = winner === 'werewolves' ? isWolf : !isWolf;
    if (onWinningSide) {
      scoreDeltas[id] = 3;
    }
  }
  return scoreDeltas;
}

function buildVictoryResult(
  victorious: WerewolfState,
  sfx?: string,
): GameStepResult<WerewolfState> {
  const winner = victorious.winner ?? 'villagers';
  return {
    state: victorious,
    voiceClip: winner === 'villagers' ? 'villagers_win' : 'wolves_win',
    ...(sfx ? { sfx } : {}),
    scoreDeltas: computeWinScoreDeltas(victorious, winner),
  };
}

function checkVictory(state: WerewolfState): WerewolfState | null {
  const livingWolves = state.aliveIds.filter((id) => state.roles[id] === 'werewolf');
  const livingGods = state.aliveIds.filter((id) => GOD_ROLES.has(state.roles[id]));
  const livingVillagers = state.aliveIds.filter((id) => state.roles[id] === 'villager');

  if (livingWolves.length === 0) {
    const winReason: LocalizedText = {
      zh: '所有狼人已被放逐，村庄重迎黎明！好人阵营获胜！',
      en: 'All Werewolves have been eliminated! The Villagers win!',
    };
    return {
      ...state,
      phase: 'game_over',
      winner: 'villagers',
      winReason,
      chronicle: appendChronicle(state, state.dayNumber, winReason),
      phaseDeadline: undefined,
    };
  }

  if (livingGods.length === 0 || livingVillagers.length === 0) {
    const winReason: LocalizedText = {
      zh:
        livingGods.length === 0
          ? '所有神职阵亡，达成屠神胜利！狼人阵营获胜！'
          : '所有平民阵亡，达成屠民胜利！狼人阵营获胜！',
      en:
        livingGods.length === 0
          ? 'All special roles have fallen! Werewolves claim victory!'
          : 'All Villagers have fallen! Werewolves claim victory!',
    };
    return {
      ...state,
      phase: 'game_over',
      winner: 'werewolves',
      winReason,
      chronicle: appendChronicle(state, state.dayNumber, winReason),
      phaseDeadline: undefined,
    };
  }
  return null;
}

function startNightPhase(state: WerewolfState, now: number): {
  state: WerewolfState;
  voiceClip: string;
} {
  const base: WerewolfState = {
    ...state,
    dayNumber: state.dayNumber + 1,
    guardTargetId: null,
    wolfPicks: {},
    wolfTargetId: null,
    witchActedTonight: false,
    witchHealed: false,
    witchPoisonId: null,
    seerActedTonight: false,
    votes: {},
    pkCandidateIds: null,
    pendingHunterId: null,
    hunterFromPhase: null,
    pendingSheriffHandoverId: null,
    sheriffHandoverFromPhase: null,
  };

  if (base.hasGuardInGame) {
    const alive = isRoleAlive(base, 'guard');
    return {
      state: {
        ...base,
        phase: 'night_guard',
        phaseDeadline: now + (alive ? 25_000 : fakeNightDelayMs()),
      },
      voiceClip: 'guard_wake',
    };
  }

  return {
    state: {
      ...base,
      phase: 'night_wolf',
      phaseDeadline: now + 30_000,
    },
    voiceClip: 'wolf_wake',
  };
}

function enterWolfPhase(state: WerewolfState, now: number): {
  state: WerewolfState;
  voiceClip: string;
} {
  return {
    state: {
      ...state,
      phase: 'night_wolf',
      wolfPicks: {},
      wolfTargetId: null,
      phaseDeadline: now + 30_000,
    },
    voiceClip: 'wolf_wake',
  };
}

function enterWitchPhase(state: WerewolfState, now: number): {
  state: WerewolfState;
  voiceClip: string;
} {
  const alive = isRoleAlive(state, 'witch');
  return {
    state: {
      ...state,
      phase: 'night_witch',
      witchActedTonight: false,
      phaseDeadline: now + (alive ? 25_000 : fakeNightDelayMs()),
    },
    voiceClip: 'witch_wake',
  };
}

function enterSeerPhase(state: WerewolfState, now: number): {
  state: WerewolfState;
  voiceClip: string;
} {
  const alive = isRoleAlive(state, 'seer');
  return {
    state: {
      ...state,
      phase: 'night_seer',
      seerActedTonight: false,
      phaseDeadline: now + (alive ? 25_000 : fakeNightDelayMs()),
    },
    voiceClip: 'seer_wake',
  };
}

function startDayDiscussionOrSheriff(
  state: WerewolfState,
  now: number,
  _seats: PlayerSeat[],
): GameStepResult<WerewolfState> {
  const victorious = checkVictory(state);
  if (victorious) {
    return buildVictoryResult(victorious);
  }

  if (state.dayNumber === 1 && state.options.enableSheriff && state.aliveIds.length >= 4) {
    return {
      state: {
        ...state,
        phase: 'sheriff_campaign',
        sheriffResponses: {},
        sheriffCandidates: [],
        phaseDeadline: now + 18_000,
      },
    };
  }

  return enterDaySpeech(state, now);
}

function finalizeSheriffElection(
  state: WerewolfState,
  winnerId: string | null,
  now: number,
  seats: PlayerSeat[],
  reason: 'none' | 'unopposed' | 'voted',
): GameStepResult<WerewolfState> {
  const text: LocalizedText =
    reason === 'none' || !winnerId
      ? { zh: '无人竞选警长，本局无警长', en: 'No candidates ran—no Sheriff this match' }
      : reason === 'unopposed'
        ? {
            zh: `${getSeatName(seats, winnerId)} 唯一上警，自动当选警长（1.5票）`,
            en: `${getSeatName(seats, winnerId)} became Sheriff unopposed (1.5x vote)`,
          }
        : {
            zh: `${getSeatName(seats, winnerId)} 当选警长（1.5票）`,
            en: `${getSeatName(seats, winnerId)} was elected Sheriff (1.5x vote)`,
          };

  return enterDaySpeech(
    {
      ...state,
      sheriffId: winnerId,
      chronicle: appendChronicle(state, state.dayNumber, text),
    },
    now,
  );
}

function enterDaySpeech(state: WerewolfState, now: number): {
  state: WerewolfState;
  voiceClip: string;
} {
  const queue = [...state.aliveIds];
  const firstSpeaker = queue[0] ?? null;
  return {
    state: {
      ...state,
      phase: 'day_speech',
      speechQueue: queue.slice(1),
      currentSpeakerId: firstSpeaker,
      phaseDeadline: now + state.options.speechSeconds * 1000,
    },
    voiceClip: 'day_speech',
  };
}

function resolveNightToDawn(
  state: WerewolfState,
  now: number,
  seats: PlayerSeat[],
): GameStepResult<WerewolfState> {
  const deaths: Array<{ playerId: string; cause: 'night' | 'poison' }> = [];

  if (state.wolfTargetId && state.aliveIds.includes(state.wolfTargetId)) {
    const guarded = state.guardTargetId === state.wolfTargetId;
    const healed = state.witchHealed;
    let died = true;
    if (guarded && healed) {
      died = state.options.sameGuardHealDies;
    } else if (guarded || healed) {
      died = false;
    }
    if (died) {
      deaths.push({ playerId: state.wolfTargetId, cause: 'night' });
    }
  }

  if (
    state.witchPoisonId &&
    state.aliveIds.includes(state.witchPoisonId) &&
    !deaths.some((d) => d.playerId === state.witchPoisonId)
  ) {
    deaths.push({ playerId: state.witchPoisonId, cause: 'poison' });
  }

  const deadIds = new Set(deaths.map((d) => d.playerId));
  const nextAlive = state.aliveIds.filter((id) => !deadIds.has(id));
  const nextDead = [
    ...state.deadPlayers,
    ...deaths.map((d) => ({
      playerId: d.playerId,
      cause: d.cause,
      dayNumber: state.dayNumber,
    })),
  ];

  const nameMap = new Map(seats.map((s) => [s.id, s.name]));
  const deadNames = deaths.map((d) => nameMap.get(d.playerId) ?? d.playerId);

  const lastNightSummary: LocalizedText =
    deaths.length === 0
      ? { zh: '昨晚是个平安夜，无人出局。', en: 'Peaceful night—nobody was eliminated.' }
      : {
          zh: `昨晚出局的玩家：${deadNames.join('、')}`,
          en: `Eliminated last night: ${deadNames.join(', ')}`,
        };

  // Chronicle NEVER reveals poison vs night attack
  const chronicleEntry: LocalizedText =
    deaths.length === 0
      ? {
          zh: `第 ${state.dayNumber} 夜：平安夜，无人出局`,
          en: `Night ${state.dayNumber}: Peaceful night, no casualties`,
        }
      : {
          zh: `第 ${state.dayNumber} 夜出局：${deadNames.join('、')}`,
          en: `Night ${state.dayNumber} fallen: ${deadNames.join(', ')}`,
        };

  const sheriffDied = Boolean(state.sheriffId && deadIds.has(state.sheriffId));

  let nextState: WerewolfState = {
    ...state,
    lastGuardedId: state.guardTargetId,
    aliveIds: nextAlive,
    deadPlayers: nextDead,
    sheriffId: sheriffDied ? null : state.sheriffId,
    pendingSheriffHandoverId: sheriffDied ? state.sheriffId : null,
    sheriffHandoverFromPhase: sheriffDied ? 'dawn' : null,
    lastNightSummary,
    lastNightHadDeaths: deaths.length > 0,
    chronicle: appendChronicle(state, state.dayNumber, chronicleEntry),
  };

  // Check if Hunter died by wolf night attack (NOT Witch poison!)
  const hunterWolfDeath = deaths.find(
    (d) => d.cause === 'night' && state.roles[d.playerId] === 'hunter',
  );
  if (hunterWolfDeath && nextAlive.length > 0) {
    nextState = {
      ...nextState,
      phase: 'hunter_revenge',
      pendingHunterId: hunterWolfDeath.playerId,
      hunterFromPhase: 'dawn',
      phaseDeadline: now + 20_000,
    };
    return { state: nextState, voiceClip: 'hunter_shot' };
  }

  const victorious = checkVictory(nextState);
  if (victorious) {
    return buildVictoryResult(victorious);
  }

  if (nextState.pendingSheriffHandoverId) {
    return {
      state: {
        ...nextState,
        phase: 'sheriff_handover',
        phaseDeadline: now + 15_000,
      },
      voiceClip: 'dawn_death',
    };
  }

  return {
    state: {
      ...nextState,
      phase: 'dawn_announce',
      phaseDeadline: now + 4000,
    },
    voiceClip: deaths.length === 0 ? 'dawn_peace' : 'dawn_death',
  };
}

function finalizeDayVotes(
  state: WerewolfState,
  now: number,
  seats: PlayerSeat[],
): GameStepResult<WerewolfState> {
  const tally = new Map<string, number>();
  for (const [voterId, target] of Object.entries(state.votes)) {
    if (target === 'abstain' || !state.aliveIds.includes(target)) continue;
    const weight = voterId === state.sheriffId ? 1.5 : 1;
    tally.set(target, (tally.get(target) ?? 0) + weight);
  }

  let topScore = 0;
  let topIds: string[] = [];
  for (const [targetId, score] of tally.entries()) {
    if (score > topScore) {
      topScore = score;
      topIds = [targetId];
    } else if (score === topScore) {
      topIds.push(targetId);
    }
  }

  const isPk = Boolean(state.pkCandidateIds);
  const voteSnapshot = { ...state.votes };

  // Tie triggers 1 PK revote
  if (topIds.length > 1 && !state.pkCandidateIds) {
    const pkNames = topIds.map((id) => getSeatName(seats, id));
    const voteRecord = {
      dayNumber: state.dayNumber,
      isPk: false,
      votes: voteSnapshot,
      exiledId: null,
      sheriffId: state.sheriffId,
    };
    return {
      state: {
        ...state,
        pkCandidateIds: topIds,
        votes: {},
        lastVoteResult: {
          votes: voteSnapshot,
          exiledId: null,
          tiedIds: topIds,
          sheriffId: state.sheriffId,
        },
        voteHistory: [...state.voteHistory, voteRecord],
        chronicle: appendChronicle(state, state.dayNumber, {
          zh: `第 ${state.dayNumber} 天平票 PK：${pkNames.join(' vs ')}`,
          en: `Day ${state.dayNumber} tiebreak PK: ${pkNames.join(' vs ')}`,
        }),
        phaseDeadline: now + 20_000,
      },
      voiceClip: 'vote_exile',
    };
  }

  if (topIds.length !== 1) {
    // Second tie or all abstained -> no exile -> next night
    const voteRecord = {
      dayNumber: state.dayNumber,
      isPk,
      votes: voteSnapshot,
      exiledId: null,
      sheriffId: state.sheriffId,
    };
    const nextState: WerewolfState = {
      ...state,
      lastVoteResult: {
        votes: voteSnapshot,
        exiledId: null,
        tiedIds: topIds.length > 1 ? topIds : undefined,
        sheriffId: state.sheriffId,
      },
      voteHistory: [...state.voteHistory, voteRecord],
      chronicle: appendChronicle(state, state.dayNumber, {
        zh: `第 ${state.dayNumber} 天放逐投票：无人出局`,
        en: `Day ${state.dayNumber} vote: No one was exiled`,
      }),
    };
    const vic = checkVictory(nextState);
    if (vic) {
      return buildVictoryResult(vic);
    }
    return startNightPhase(nextState, now);
  }

  const exiledId = topIds[0];
  const nextAlive = state.aliveIds.filter((id) => id !== exiledId);
  const nextDead = [
    ...state.deadPlayers,
    { playerId: exiledId, cause: 'exile' as const, dayNumber: state.dayNumber },
  ];
  const sheriffDied = state.sheriffId === exiledId;

  const voteRecord = {
    dayNumber: state.dayNumber,
    isPk,
    votes: voteSnapshot,
    exiledId,
    sheriffId: state.sheriffId,
  };

  const afterExile: WerewolfState = {
    ...state,
    aliveIds: nextAlive,
    deadPlayers: nextDead,
    sheriffId: sheriffDied ? null : state.sheriffId,
    pendingSheriffHandoverId: sheriffDied ? exiledId : null,
    sheriffHandoverFromPhase: sheriffDied ? 'exile' : null,
    lastVoteResult: {
      votes: voteSnapshot,
      exiledId,
      sheriffId: state.sheriffId,
    },
    voteHistory: [...state.voteHistory, voteRecord],
    chronicle: appendChronicle(state, state.dayNumber, {
      zh: `第 ${state.dayNumber} 天放逐出局：${getSeatName(seats, exiledId)}`,
      en: `Day ${state.dayNumber} exiled: ${getSeatName(seats, exiledId)}`,
    }),
  };

  if (state.roles[exiledId] === 'hunter' && nextAlive.length > 0) {
    return {
      state: {
        ...afterExile,
        phase: 'hunter_revenge',
        pendingHunterId: exiledId,
        hunterFromPhase: 'exile',
        phaseDeadline: now + 20_000,
      },
      voiceClip: 'hunter_shot',
    };
  }

  const vic = checkVictory(afterExile);
  if (vic) {
    return buildVictoryResult(vic);
  }

  if (afterExile.pendingSheriffHandoverId) {
    return {
      state: {
        ...afterExile,
        phase: 'sheriff_handover',
        phaseDeadline: now + 15_000,
      },
    };
  }

  return startNightPhase(afterExile, now);
}

function finishHunterRevenge(
  state: WerewolfState,
  targetId: string | null,
  now: number,
  seats: PlayerSeat[],
  sfx?: string,
): GameStepResult<WerewolfState> {
  const hunterId = state.pendingHunterId;
  const hunterName = getSeatName(seats, hunterId);
  const fromPhase = state.hunterFromPhase;

  let nextState: WerewolfState = {
    ...state,
    pendingHunterId: null,
    hunterFromPhase: null,
  };

  if (targetId && state.aliveIds.includes(targetId)) {
    const shotSheriff = nextState.sheriffId === targetId;
    nextState = {
      ...nextState,
      aliveIds: nextState.aliveIds.filter((id) => id !== targetId),
      deadPlayers: [
        ...nextState.deadPlayers,
        { playerId: targetId, cause: 'hunter', dayNumber: state.dayNumber },
      ],
      sheriffId: shotSheriff ? null : nextState.sheriffId,
      pendingSheriffHandoverId: shotSheriff ? targetId : nextState.pendingSheriffHandoverId,
      sheriffHandoverFromPhase: shotSheriff
        ? (fromPhase ?? 'exile')
        : nextState.sheriffHandoverFromPhase,
      chronicle: appendChronicle(nextState, state.dayNumber, {
        zh: `猎人 ${hunterName} 开枪带走了 ${getSeatName(seats, targetId)}`,
        en: `Hunter ${hunterName} shot ${getSeatName(seats, targetId)}`,
      }),
    };
  } else if (hunterId) {
    nextState = {
      ...nextState,
      chronicle: appendChronicle(nextState, state.dayNumber, {
        zh: `猎人 ${hunterName} 选择压枪未开枪`,
        en: `Hunter ${hunterName} held fire`,
      }),
    };
  }

  const vic = checkVictory(nextState);
  if (vic) {
    return buildVictoryResult(vic, sfx);
  }

  if (nextState.pendingSheriffHandoverId) {
    return {
      state: {
        ...nextState,
        phase: 'sheriff_handover',
        phaseDeadline: now + 15_000,
      },
      ...(sfx ? { sfx } : {}),
    };
  }

  if (fromPhase === 'dawn') {
    return {
      ...startDayDiscussionOrSheriff(nextState, now, seats),
      ...(sfx ? { sfx } : {}),
    };
  }
  return {
    ...startNightPhase(nextState, now),
    ...(sfx ? { sfx } : {}),
  };
}

function completeSheriffHandover(
  state: WerewolfState,
  targetId: string | null,
  now: number,
  seats: PlayerSeat[],
  sfx?: string,
  timedOut = false,
): GameStepResult<WerewolfState> {
  const fromName = getSeatName(seats, state.pendingSheriffHandoverId);
  const fromPhase = state.sheriffHandoverFromPhase;

  const chronicleText: LocalizedText = targetId
    ? {
        zh: `${fromName} 将警徽移交给 ${getSeatName(seats, targetId)}`,
        en: `${fromName} passed the Sheriff badge to ${getSeatName(seats, targetId)}`,
      }
    : timedOut
      ? {
          zh: `${fromName} 超时未移交，警徽已撕毁`,
          en: `${fromName} timed out—the Sheriff badge was destroyed`,
        }
      : {
          zh: `${fromName} 撕毁了警徽`,
          en: `${fromName} destroyed the Sheriff badge`,
        };

  const nextState: WerewolfState = {
    ...state,
    sheriffId: targetId,
    pendingSheriffHandoverId: null,
    sheriffHandoverFromPhase: null,
    chronicle: appendChronicle(state, state.dayNumber, chronicleText),
  };

  const vic = checkVictory(nextState);
  if (vic) {
    return buildVictoryResult(vic, sfx);
  }

  if (fromPhase === 'dawn') {
    return {
      state: {
        ...nextState,
        phase: 'dawn_announce',
        phaseDeadline: now + 4000,
      },
      ...(sfx ? { sfx } : {}),
    };
  }

  const started = startNightPhase(nextState, now);
  return {
    ...started,
    ...(sfx ? { sfx } : {}),
  };
}

export const werewolfGame: GameDefinition<
  WerewolfState,
  WerewolfOptions,
  WerewolfPublicState,
  WerewolfPrivateState,
  WerewolfAction
> = {
  id: 'werewolf',
  minPlayers: 6,
  maxPlayers: 10,
  defaultOptions: {
    speechSeconds: 45,
    enableSheriff: false,
    sameGuardHealDies: true,
  },

  createInitialState(seats: PlayerSeat[], rawOptions: WerewolfOptions) {
    const options: WerewolfOptions = { ...this.defaultOptions, ...rawOptions };
    const seatOrder = seats.map((s) => s.id);
    const pool = shuffle(buildRolePool(seatOrder.length));
    const roles: Record<string, WerewolfRole> = {};
    seatOrder.forEach((id, idx) => {
      roles[id] = pool[idx];
    });

    const state: WerewolfState = {
      options,
      phase: 'role_peek',
      seatOrder,
      roles,
      rolePoolCounts: buildRolePoolCounts(pool),
      aliveIds: [...seatOrder],
      deadPlayers: [],
      peekedIds: [],
      dayNumber: 0,
      hasGuardInGame: pool.includes('guard'),
      guardTargetId: null,
      lastGuardedId: null,
      wolfPicks: {},
      wolfTargetId: null,
      hasAntidote: true,
      hasPoison: true,
      witchActedTonight: false,
      witchHealed: false,
      witchPoisonId: null,
      seerActedTonight: false,
      seerChecks: [],
      sheriffId: null,
      sheriffResponses: {},
      sheriffCandidates: [],
      sheriffVotes: {},
      pendingSheriffHandoverId: null,
      sheriffHandoverFromPhase: null,
      lastNightHadDeaths: false,
      speechQueue: [],
      currentSpeakerId: null,
      votes: {},
      pkCandidateIds: null,
      pendingHunterId: null,
      hunterFromPhase: null,
      chronicle: [],
      voteHistory: [],
    };

    return { state, voiceClip: 'night_fall' };
  },

  applyAction(state, actorId, action, seats) {
    const now = Date.now();
    if (state.phase === 'game_over') return { state };

    if (action.type === 'peek_ready') {
      if (state.phase !== 'role_peek') return { state };
      const peekedIds = state.peekedIds.includes(actorId)
        ? state.peekedIds
        : [...state.peekedIds, actorId];
      if (peekedIds.length >= state.seatOrder.length) {
        const started = startNightPhase({ ...state, peekedIds }, now);
        return { state: started.state, voiceClip: started.voiceClip, sfx: 'cardFlip' };
      }
      return { state: { ...state, peekedIds }, sfx: 'buttonTap' };
    }

    if (action.type === 'guard_protect') {
      if (state.phase !== 'night_guard') return { state };
      if (state.roles[actorId] !== 'guard' || !state.aliveIds.includes(actorId)) {
        return { state, error: 'Only living Guard can act now' };
      }
      if (action.targetId && action.targetId === state.lastGuardedId) {
        return { state, error: 'Cannot guard the same player two nights in a row' };
      }
      const next = enterWolfPhase({ ...state, guardTargetId: action.targetId }, now);
      return { state: next.state, voiceClip: next.voiceClip, sfx: 'buttonTap' };
    }

    if (action.type === 'wolf_pick') {
      if (state.phase !== 'night_wolf') return { state };
      if (state.roles[actorId] !== 'werewolf' || !state.aliveIds.includes(actorId)) {
        return { state, error: 'Only living Werewolves can act now' };
      }
      if (!state.aliveIds.includes(action.targetId)) {
        return { state, error: 'Target must be alive' };
      }
      const wolfPicks = { ...state.wolfPicks, [actorId]: action.targetId };
      const livingWolves = getLivingWolves(state);
      const majorityTarget = findStrictMajorityWolfTarget(wolfPicks, livingWolves);
      if (majorityTarget) {
        const next = enterWitchPhase(
          { ...state, wolfPicks, wolfTargetId: majorityTarget },
          now,
        );
        return { state: next.state, voiceClip: next.voiceClip, sfx: 'gavelBang' };
      }
      return { state: { ...state, wolfPicks }, sfx: 'buttonTap' };
    }

    if (action.type === 'witch_act') {
      if (state.phase !== 'night_witch') return { state };
      if (state.roles[actorId] !== 'witch' || !state.aliveIds.includes(actorId)) {
        return { state, error: 'Only living Witch can act now' };
      }
      let nextState: WerewolfState = { ...state, witchActedTonight: true };
      if (action.choice === 'heal') {
        if (!state.hasAntidote || !state.wolfTargetId) {
          return { state, error: 'Antidote unavailable' };
        }
        nextState = { ...nextState, hasAntidote: false, witchHealed: true };
      } else if (action.choice === 'poison') {
        if (!state.hasPoison || !action.targetId || !state.aliveIds.includes(action.targetId)) {
          return { state, error: 'Poison unavailable or invalid target' };
        }
        nextState = {
          ...nextState,
          hasPoison: false,
          witchPoisonId: action.targetId,
        };
      }
      const next = enterSeerPhase(nextState, now);
      return { state: next.state, voiceClip: next.voiceClip, sfx: 'buttonTap' };
    }

    if (action.type === 'seer_check') {
      if (state.phase !== 'night_seer') return { state };
      if (state.roles[actorId] !== 'seer' || !state.aliveIds.includes(actorId)) {
        return { state, error: 'Only living Seer can act now' };
      }
      if (state.seerActedTonight) return { state };
      if (!state.aliveIds.includes(action.targetId) || action.targetId === actorId) {
        return { state, error: 'Invalid target' };
      }
      const isWolf = state.roles[action.targetId] === 'werewolf';
      const seerChecks = [
        ...state.seerChecks,
        { targetId: action.targetId, isWolf, night: state.dayNumber },
      ];
      return {
        state: {
          ...state,
          seerActedTonight: true,
          seerChecks,
          phaseDeadline: now + 2600,
        },
        sfx: 'revealDrum',
      };
    }

    if (action.type === 'sheriff_decide') {
      if (state.phase !== 'sheriff_campaign') return { state };
      if (!state.aliveIds.includes(actorId)) return { state };
      const sheriffResponses = { ...state.sheriffResponses, [actorId]: action.run };
      const candidates = Object.entries(sheriffResponses)
        .filter(([, v]) => v)
        .map(([id]) => id);
      if (Object.keys(sheriffResponses).length < state.aliveIds.length) {
        return { state: { ...state, sheriffResponses, sheriffCandidates: candidates } };
      }
      if (candidates.length === 0) {
        return finalizeSheriffElection(
          { ...state, sheriffResponses, sheriffCandidates: [] },
          null,
          now,
          seats,
          'none',
        );
      }
      if (candidates.length === 1) {
        return finalizeSheriffElection(
          { ...state, sheriffResponses, sheriffCandidates: candidates },
          candidates[0],
          now,
          seats,
          'unopposed',
        );
      }
      return {
        state: {
          ...state,
          sheriffResponses,
          sheriffCandidates: candidates,
          sheriffVotes: {},
          phase: 'sheriff_vote',
          phaseDeadline: now + 20_000,
        },
      };
    }

    if (action.type === 'sheriff_vote') {
      if (state.phase !== 'sheriff_vote') return { state };
      if (!state.aliveIds.includes(actorId)) return { state };
      if (!state.sheriffCandidates.includes(action.candidateId)) return { state };
      const sheriffVotes = { ...state.sheriffVotes, [actorId]: action.candidateId };
      if (Object.keys(sheriffVotes).length < state.aliveIds.length) {
        return { state: { ...state, sheriffVotes } };
      }
      const tally = new Map<string, number>();
      Object.values(sheriffVotes).forEach((cid) => tally.set(cid, (tally.get(cid) ?? 0) + 1));
      const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
      const winner = sorted[0]?.[0] ?? state.sheriffCandidates[0] ?? null;
      return finalizeSheriffElection(
        { ...state, sheriffVotes },
        winner,
        now,
        seats,
        'voted',
      );
    }

    if (action.type === 'sheriff_handover') {
      if (state.phase !== 'sheriff_handover') return { state };
      if (actorId !== state.pendingSheriffHandoverId) {
        return { state, error: 'Only the fallen Sheriff can hand over the badge' };
      }
      if (action.targetId !== null && !state.aliveIds.includes(action.targetId)) {
        return { state, error: 'Sheriff handover target must be alive' };
      }
      return completeSheriffHandover(state, action.targetId, now, seats, 'gavelBang');
    }

    if (action.type === 'end_speech') {
      if (state.phase !== 'day_speech') return { state };
      if (actorId !== state.currentSpeakerId) return { state };
      if (state.speechQueue.length > 0) {
        return {
          state: {
            ...state,
            currentSpeakerId: state.speechQueue[0],
            speechQueue: state.speechQueue.slice(1),
            phaseDeadline: now + state.options.speechSeconds * 1000,
          },
          sfx: 'buttonTap',
        };
      }
      return {
        state: {
          ...state,
          currentSpeakerId: null,
          phase: 'day_vote',
          votes: {},
          pkCandidateIds: null,
          phaseDeadline: now + 25_000,
        },
        voiceClip: 'vote_exile',
        sfx: 'gavelBang',
      };
    }

    if (action.type === 'cast_vote') {
      if (state.phase !== 'day_vote') return { state };
      if (!state.aliveIds.includes(actorId)) return { state, error: 'Eliminated players cannot vote' };
      if (
        action.targetId !== 'abstain' &&
        (!state.aliveIds.includes(action.targetId) ||
          (state.pkCandidateIds && !state.pkCandidateIds.includes(action.targetId)))
      ) {
        return { state, error: 'Invalid vote target' };
      }
      const votes = { ...state.votes, [actorId]: action.targetId };
      if (Object.keys(votes).length < state.aliveIds.length) {
        return { state: { ...state, votes }, sfx: 'buttonTap' };
      }
      const result = finalizeDayVotes({ ...state, votes }, now, seats);
      return { ...result, sfx: result.sfx ?? 'gavelBang' };
    }

    if (action.type === 'hunter_shoot') {
      if (state.phase !== 'hunter_revenge') return { state };
      if (actorId !== state.pendingHunterId) return { state };
      return finishHunterRevenge(state, action.targetId, now, seats, 'gavelBang');
    }

    return { state };
  },

  onTick(state, now, seats) {
    if (!state.phaseDeadline || now < state.phaseDeadline || state.phase === 'game_over') {
      return null;
    }

    if (state.phase === 'night_guard') {
      return enterWolfPhase(state, now);
    }

    if (state.phase === 'night_wolf') {
      const livingWolves = getLivingWolves(state);
      const counts = new Map<string, number>();
      for (const wid of livingWolves) {
        const tid = state.wolfPicks[wid];
        if (tid && state.aliveIds.includes(tid)) {
          counts.set(tid, (counts.get(tid) ?? 0) + 1);
        }
      }
      const topPick = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      const fallbackTarget =
        topPick ??
        state.aliveIds.find((id) => state.roles[id] !== 'werewolf') ??
        state.aliveIds[0] ??
        null;
      return enterWitchPhase({ ...state, wolfTargetId: fallbackTarget }, now);
    }

    if (state.phase === 'night_witch') {
      return enterSeerPhase(state, now);
    }

    if (state.phase === 'night_seer') {
      return resolveNightToDawn(state, now, seats);
    }

    if (state.phase === 'sheriff_handover') {
      return completeSheriffHandover(state, null, now, seats, undefined, true);
    }

    if (state.phase === 'dawn_announce') {
      return startDayDiscussionOrSheriff(state, now, seats);
    }

    if (state.phase === 'sheriff_campaign') {
      const candidates = state.sheriffCandidates;
      if (candidates.length === 0) {
        return finalizeSheriffElection(state, null, now, seats, 'none');
      }
      if (candidates.length === 1) {
        return finalizeSheriffElection(state, candidates[0], now, seats, 'unopposed');
      }
      return {
        state: {
          ...state,
          phase: 'sheriff_vote',
          sheriffVotes: {},
          phaseDeadline: now + 20_000,
        },
      };
    }

    if (state.phase === 'sheriff_vote') {
      const tally = new Map<string, number>();
      Object.values(state.sheriffVotes).forEach((cid) =>
        tally.set(cid, (tally.get(cid) ?? 0) + 1),
      );
      const winner =
        Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        state.sheriffCandidates[0] ??
        null;
      return finalizeSheriffElection(state, winner, now, seats, 'voted');
    }

    if (state.phase === 'day_speech') {
      if (state.speechQueue.length > 0) {
        return {
          state: {
            ...state,
            currentSpeakerId: state.speechQueue[0],
            speechQueue: state.speechQueue.slice(1),
            phaseDeadline: now + state.options.speechSeconds * 1000,
          },
        };
      }
      return {
        state: {
          ...state,
          currentSpeakerId: null,
          phase: 'day_vote',
          votes: {},
          pkCandidateIds: null,
          phaseDeadline: now + 25_000,
        },
        voiceClip: 'vote_exile',
      };
    }

    if (state.phase === 'day_vote') {
      const votes = { ...state.votes };
      for (const id of state.aliveIds) {
        if (!votes[id]) votes[id] = 'abstain';
      }
      return finalizeDayVotes({ ...state, votes }, now, seats);
    }

    if (state.phase === 'hunter_revenge') {
      return finishHunterRevenge(state, null, now, seats);
    }

    return null;
  },

  forceSkipCurrent(state, seats) {
    const now = Date.now();
    if (state.phase === 'role_peek') {
      return startNightPhase({ ...state, peekedIds: [...state.seatOrder] }, now);
    }
    return (
      this.onTick?.({ ...state, phaseDeadline: now - 1 }, now, seats) ?? {
        state,
      }
    );
  },

  projectPublic(state): WerewolfPublicState {
    const maskPoison = state.phase !== 'game_over';
    return {
      phase: state.phase,
      dayNumber: state.dayNumber,
      aliveIds: state.aliveIds,
      deadPlayers: maskPoison
        ? state.deadPlayers.map((d) =>
            d.cause === 'poison' ? { ...d, cause: 'night' as const } : d,
          )
        : state.deadPlayers,
      sheriffId: state.sheriffId,
      sheriffCandidates: state.sheriffCandidates,
      pendingSheriffHandoverId: state.pendingSheriffHandoverId,
      currentSpeakerId: state.currentSpeakerId,
      speechQueue: state.speechQueue,
      votedPlayerIds: Object.keys(state.votes),
      peekedPlayerIds: state.peekedIds,
      lastNightSummary: state.lastNightSummary,
      pkCandidateIds: state.pkCandidateIds,
      pendingHunterId: state.pendingHunterId,
      lastVoteResult: state.lastVoteResult,
      rolePoolCounts: state.rolePoolCounts,
      chronicle: state.chronicle,
      voteHistory: state.voteHistory,
      winner: state.winner,
      winReason: state.winReason,
      revealedRoles: state.phase === 'game_over' ? state.roles : undefined,
      phaseDeadline: state.phaseDeadline,
    };
  },

  projectPrivate(state, playerId): WerewolfPrivateState {
    const role = state.roles[playerId] ?? 'villager';
    const alive = state.aliveIds.includes(playerId);
    const isWolf = role === 'werewolf';

    let canActNow = false;
    if (state.phase === 'role_peek') canActNow = !state.peekedIds.includes(playerId);
    else if (state.phase === 'night_guard') canActNow = alive && role === 'guard';
    else if (state.phase === 'night_wolf') canActNow = alive && isWolf;
    else if (state.phase === 'night_witch')
      canActNow = alive && role === 'witch' && !state.witchActedTonight;
    else if (state.phase === 'night_seer')
      canActNow = alive && role === 'seer' && !state.seerActedTonight;
    else if (state.phase === 'sheriff_campaign')
      canActNow = alive && state.sheriffResponses[playerId] === undefined;
    else if (state.phase === 'sheriff_vote')
      canActNow = alive && !state.sheriffVotes[playerId];
    else if (state.phase === 'sheriff_handover')
      canActNow = state.pendingSheriffHandoverId === playerId;
    else if (state.phase === 'day_speech')
      canActNow = state.currentSpeakerId === playerId;
    else if (state.phase === 'day_vote') canActNow = alive && !state.votes[playerId];
    else if (state.phase === 'hunter_revenge')
      canActNow = state.pendingHunterId === playerId;

    const livingWolves = getLivingWolves(state);
    const allWolvesPicked =
      livingWolves.length > 0 && livingWolves.every((wid) => Boolean(state.wolfPicks[wid]));
    const hasWolfMajority =
      allWolvesPicked &&
      findStrictMajorityWolfTarget(state.wolfPicks, livingWolves) !== null;

    return {
      playerId,
      role,
      alive,
      hasPeeked: state.peekedIds.includes(playerId),
      wolfTeammates: isWolf
        ? state.seatOrder.filter((id) => state.roles[id] === 'werewolf')
        : undefined,
      wolfLivePicks: isWolf && state.phase === 'night_wolf' ? state.wolfPicks : undefined,
      wolfConsensusWarning:
        isWolf && state.phase === 'night_wolf'
          ? allWolvesPicked && !hasWolfMajority
          : undefined,
      witchState:
        role === 'witch'
          ? {
              hasAntidote: state.hasAntidote,
              hasPoison: state.hasPoison,
              attackedTonightId:
                state.phase === 'night_witch' && state.hasAntidote ? state.wolfTargetId : null,
              actedTonight: state.witchActedTonight,
            }
          : undefined,
      seerChecks: role === 'seer' ? state.seerChecks : undefined,
      guardLastTargetId: role === 'guard' ? state.lastGuardedId : undefined,
      canActNow,
    };
  },

  computeBotAction(state, botId, seats) {
    if (state.phase === 'role_peek' && !state.peekedIds.includes(botId)) {
      return { type: 'peek_ready' };
    }
    const role = state.roles[botId];
    const alive = state.aliveIds.includes(botId);

    if (state.phase === 'hunter_revenge' && state.pendingHunterId === botId) {
      const targets = state.aliveIds.filter((id) => id !== botId);
      const picked = targets[Math.floor(Math.random() * targets.length)] ?? null;
      return { type: 'hunter_shoot', targetId: picked };
    }

    if (state.phase === 'sheriff_handover' && state.pendingSheriffHandoverId === botId) {
      if (role === 'werewolf') {
        const wolfTeammate = state.aliveIds.find(
          (id) => id !== botId && state.roles[id] === 'werewolf',
        );
        if (wolfTeammate) return { type: 'sheriff_handover', targetId: wolfTeammate };
      }
      if (role === 'seer') {
        const goodChecked = state.seerChecks.find(
          (c) => !c.isWolf && state.aliveIds.includes(c.targetId),
        );
        if (goodChecked) return { type: 'sheriff_handover', targetId: goodChecked.targetId };
      }
      const candidates = state.aliveIds.filter((id) => id !== botId);
      const targetId =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null;
      return { type: 'sheriff_handover', targetId };
    }

    if (!alive) return null;

    if (state.phase === 'night_guard' && role === 'guard') {
      const pool = state.aliveIds.filter((id) => id !== state.lastGuardedId);
      return {
        type: 'guard_protect',
        targetId: pool[Math.floor(Math.random() * pool.length)] ?? null,
      };
    }

    if (state.phase === 'night_wolf' && role === 'werewolf') {
      const livingWolves = getLivingWolves(state);
      const seatIndexOf = (id: string) => {
        const seat = seats.find((s) => s.id === id);
        return seat ? seat.seatIndex : state.seatOrder.indexOf(id);
      };
      const isHumanWolf = (id: string) => {
        const seat = seats.find((s) => s.id === id);
        return Boolean(seat && !seat.isBot && !seat.botTakeover);
      };

      const humanPick = livingWolves
        .filter(isHumanWolf)
        .sort((a, b) => seatIndexOf(a) - seatIndexOf(b))
        .map((wid) => state.wolfPicks[wid])
        .find((tid) => Boolean(tid && state.aliveIds.includes(tid)));

      if (!state.wolfPicks[botId]) {
        if (humanPick) {
          return { type: 'wolf_pick', targetId: humanPick };
        }
        const existing = Object.values(state.wolfPicks).find((tid) =>
          state.aliveIds.includes(tid),
        );
        if (existing) {
          return { type: 'wolf_pick', targetId: existing };
        }
        const nonWolves = state.aliveIds.filter((id) => state.roles[id] !== 'werewolf');
        const target =
          nonWolves[Math.floor(Math.random() * nonWolves.length)] ?? state.aliveIds[0];
        return { type: 'wolf_pick', targetId: target };
      }

      const allPicked = livingWolves.every((wid) => Boolean(state.wolfPicks[wid]));
      if (allPicked && findStrictMajorityWolfTarget(state.wolfPicks, livingWolves) === null) {
        const pickedTargets = livingWolves
          .map((wid) => state.wolfPicks[wid])
          .filter((tid) => state.aliveIds.includes(tid))
          .sort((a, b) => seatIndexOf(a) - seatIndexOf(b));
        const consensusTarget = humanPick ?? pickedTargets[0];
        if (consensusTarget && state.wolfPicks[botId] !== consensusTarget) {
          return { type: 'wolf_pick', targetId: consensusTarget };
        }
      }

      return null;
    }

    if (state.phase === 'night_witch' && role === 'witch' && !state.witchActedTonight) {
      if (
        state.hasAntidote &&
        state.wolfTargetId &&
        (state.wolfTargetId === botId || state.dayNumber === 1)
      ) {
        return { type: 'witch_act', choice: 'heal' };
      }
      if (state.hasPoison && state.dayNumber >= 2 && Math.random() < 0.45) {
        const targets = state.aliveIds.filter((id) => id !== botId);
        return {
          type: 'witch_act',
          choice: 'poison',
          targetId: targets[Math.floor(Math.random() * targets.length)],
        };
      }
      return { type: 'witch_act', choice: 'pass' };
    }

    if (state.phase === 'night_seer' && role === 'seer' && !state.seerActedTonight) {
      const checked = new Set(state.seerChecks.map((c) => c.targetId));
      const candidates = state.aliveIds.filter((id) => id !== botId && !checked.has(id));
      const fallback = state.aliveIds.filter((id) => id !== botId);
      const pool = candidates.length > 0 ? candidates : fallback;
      return {
        type: 'seer_check',
        targetId: pool[Math.floor(Math.random() * pool.length)],
      };
    }

    if (
      state.phase === 'sheriff_campaign' &&
      state.sheriffResponses[botId] === undefined
    ) {
      return { type: 'sheriff_decide', run: role === 'seer' || Math.random() < 0.3 };
    }

    if (state.phase === 'sheriff_vote' && !state.sheriffVotes[botId]) {
      return {
        type: 'sheriff_vote',
        candidateId:
          state.sheriffCandidates[
            Math.floor(Math.random() * state.sheriffCandidates.length)
          ],
      };
    }

    if (state.phase === 'day_speech' && state.currentSpeakerId === botId) {
      return { type: 'end_speech' };
    }

    if (state.phase === 'day_vote' && !state.votes[botId]) {
      if (role === 'seer') {
        const knownWolf = state.seerChecks.find(
          (c) => c.isWolf && state.aliveIds.includes(c.targetId),
        );
        if (
          knownWolf &&
          (!state.pkCandidateIds || state.pkCandidateIds.includes(knownWolf.targetId))
        ) {
          return { type: 'cast_vote', targetId: knownWolf.targetId };
        }
      }
      const pool = (state.pkCandidateIds ?? state.aliveIds).filter((id) =>
        role === 'werewolf' ? state.roles[id] !== 'werewolf' : id !== botId,
      );
      if (pool.length === 0) return { type: 'cast_vote', targetId: 'abstain' };
      return {
        type: 'cast_vote',
        targetId: pool[Math.floor(Math.random() * pool.length)],
      };
    }

    return null;
  },
};
