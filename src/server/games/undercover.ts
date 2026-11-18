import type { Language, PlayerSeat } from '../../shared/types.js';
import type {
  LocalizedText,
  UndercoverClueRecord,
  UndercoverOptions,
  UndercoverPrivateState,
  UndercoverPublicState,
  UndercoverRole,
} from '../../shared/gameTypes.js';
import { UNDERCOVER_WORD_PAIRS } from '../data/undercoverWords.js';
import type { GameDefinition, GameStepResult } from './engine.js';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const BOT_CLUE_BANK: Record<string, string[]> = {
  food: [
    '香气挺上头的 · Tempting aroma',
    '吃起来很有满足感 · Satisfying',
    '聚会夜宵常客 · Party staple',
    '味道蛮有记忆点 · Distinct taste',
    '口感层次很丰富 · Great texture',
    '街边和店里都能买到 · Easy to find',
    '冷热吃各有风味 · Tasty treat',
    '配饮料简直绝配 · Pairs with drinks',
    '不少人每周都要来一口 · Weekly fave',
    '颜值和风味都在线 · Crowd pleaser',
    '老少皆宜的一口 · Classic favorite',
    '越吃越让人停不下来 · Addictive',
  ],
  life: [
    '几乎每天都会用到 · Daily staple',
    '家里和出门都少不了 · Must-have',
    '造型设计挺实用的 · Handy design',
    '质感摸起来挺舒服 · Nice texture',
    '价格不算太夸张 · Affordable item',
    '用久了真离不开 · Hard to skip',
    '放在房间里很常见 · Common around home',
    '送礼自用都挺合适 · Practical pick',
    '大小携带还算方便 · Easy to carry',
    '生活里存在感很高 · Everyday gear',
    '换季时特别派得上用场 · Seasonal hit',
    '材质和细节很讲究 · Well crafted',
  ],
  pop: [
    '知名度真的超级高 · Iconic hit',
    '一提起大家都秒懂 · Crowd favorite',
    '名场面特别多 · Memorable scenes',
    '氛围感直接拉满 · Pure vibes',
    '网上讨论度一直很高 · Trending topic',
    '周末放松很适合这个 · Weekend pick',
    '很有辨识度的经典 · Unmistakable',
    '粉丝群体非常庞大 · Huge fanbase',
    '童年或青春回忆杀 · Nostalgic hit',
    '节奏和看点都很足 · Full of hype',
    '经常被拿来玩梗 · Meme-worthy',
    '聚会聊起来停不下 · Hot topic',
  ],
  tech: [
    '现代人几乎离不开 · Modern staple',
    '用顺手了效率翻倍 · Super handy',
    '更新换代速度挺快 · Evolves fast',
    '出门总想带着或打开 · Go-to tech',
    '功能越来越聪明了 · Smart features',
    '没电或断网会很慌 · Essential tool',
    '界面或外观挺酷的 · Sleek look',
    '上班摸鱼都能见到 · Work & play',
    '年轻人群体里超火 · Super popular',
    '操作其实很容易上手 · User friendly',
    '科技感还挺足的 · High-tech vibe',
    '每天不碰几下不习惯 · Daily habit',
  ],
  nature: [
    '大自然里的奇观 · Natural wonder',
    '画面感特别震撼 · Visually stunning',
    '外观特征很明显 · Distinct look',
    '纪录片里经常出现 · Doc favorite',
    '颜色和形态很迷人 · Vivid beauty',
    '让人一眼就印象深刻 · Unforgettable',
    '生态或季节感很强 · Seasonal aura',
    '远离城市更容易见到 · Wild & free',
    '自带一种独特气场 · Unique charm',
    '适合拍照打卡的画面 · Photogenic',
    '说起来挺有生命力的 · Full of life',
    '名字听着就很有画面 · Evocative',
  ],
  party: [
    '打工人和学生都懂 · So relatable',
    '一聊这个全桌炸锅 · Table icebreaker',
    '真实到有点扎心 · Too real',
    '聚会吐槽高频词 · Party classic',
    '情绪价值直接拉满 · Big mood',
    '朋友圈经常刷到 · Social feed hit',
    '经历过的人会心一笑 · Know the feel',
    '自带喜剧和戏剧感 · Pure drama',
    '既期待又有点纠结 · Mixed feelings',
    '听完瞬间有共鸣 · Instant vibe',
    '过节或周末常发生 · Weekend mood',
    '人生必经名场面 · Classic moment',
  ],
  blank: [
    '感觉生活里挺常见 · Fairly common',
    '大家都应该接触过 · Familiar to all',
    '说出来很有画面感 · Easy to picture',
    '平时关注度还不低 · Well known',
    '辨识度其实挺高的 · Recognizable',
    '这个词还挺有意思 · Pretty neat',
    '第一反应还挺亲切 · Feels familiar',
    '聊起来话题蛮多的 · Good talking point',
    '特征其实比较明显 · Clear traits',
    '算是大家的共同记忆 · Shared memory',
    '听名字就很有氛围 · Nice vibe',
    '日常出镜率不算低 · Pops up often',
  ],
};

export interface UndercoverState {
  options: UndercoverOptions;
  language: Language;
  phase: UndercoverPublicState['phase'];
  round: number;
  categoryId?: string;
  category: LocalizedText;
  civilianWord: LocalizedText;
  undercoverWord: LocalizedText;
  seatOrder: string[];
  roles: Record<string, UndercoverRole>;
  aliveIds: string[];
  eliminatedIds: string[];
  peekedIds: string[];
  clueQueue: string[];
  currentSpeakerId: string | null;
  clues: UndercoverClueRecord[];
  votes: Record<string, string>;
  voteHistory: UndercoverPublicState['voteHistory'];
  pkIds: string[] | null;
  lastEliminated: UndercoverPublicState['lastEliminated'];
  winner?: 'civilians' | 'undercover';
  phaseDeadline?: number;
}

export type UndercoverAction =
  | { type: 'peek_ready' }
  | { type: 'submit_clue'; clue: string }
  | { type: 'cast_vote'; targetId: string }
  | { type: 'next_round' };

function resolveCategoryId(state: UndercoverState): string {
  if (state.categoryId && BOT_CLUE_BANK[state.categoryId]) {
    return state.categoryId;
  }
  const en = state.category.en.toLowerCase();
  if (en.includes('food')) return 'food';
  if (en.includes('life')) return 'life';
  if (en.includes('pop')) return 'pop';
  if (en.includes('tech')) return 'tech';
  if (en.includes('nature')) return 'nature';
  return 'party';
}

function buildRoleCounts(
  count: number,
  includeBlank: boolean,
): UndercoverRole[] {
  let undercoverCount = 1;
  let blankCount = 0;
  if (count >= 8) {
    undercoverCount = 2;
    blankCount = includeBlank ? 1 : 0;
  } else if (count >= 6) {
    undercoverCount = includeBlank ? 1 : 2;
    blankCount = includeBlank ? 1 : 0;
  } else {
    undercoverCount = 1;
    blankCount = 0;
  }
  const roles: UndercoverRole[] = [];
  for (let i = 0; i < undercoverCount; i++) roles.push('undercover');
  for (let i = 0; i < blankCount; i++) roles.push('blank');
  while (roles.length < count) roles.push('civilian');
  return shuffle(roles);
}

function checkUndercoverVictory(state: UndercoverState): UndercoverState | null {
  const aliveInfiltrators = state.aliveIds.filter(
    (id) => state.roles[id] === 'undercover' || state.roles[id] === 'blank',
  ).length;
  const aliveCivilians = state.aliveIds.filter(
    (id) => state.roles[id] === 'civilian',
  ).length;

  if (aliveInfiltrators === 0) {
    return {
      ...state,
      phase: 'game_over',
      winner: 'civilians',
      phaseDeadline: undefined,
    };
  }
  if (aliveInfiltrators >= aliveCivilians || state.aliveIds.length <= 2) {
    return {
      ...state,
      phase: 'game_over',
      winner: 'undercover',
      phaseDeadline: undefined,
    };
  }
  return null;
}

function computeUndercoverScoreDeltas(state: UndercoverState): Record<string, number> {
  const deltas: Record<string, number> = {};
  if (!state.winner) return deltas;
  for (const id of state.seatOrder) {
    const role = state.roles[id];
    if (state.winner === 'civilians') {
      if (role === 'civilian') {
        deltas[id] = 3;
      }
    } else if (role === 'undercover' || role === 'blank') {
      // +3 for winning infiltrator side, +1 survival bonus if still alive
      deltas[id] = state.aliveIds.includes(id) ? 4 : 3;
    }
  }
  return deltas;
}

function startClueRound(
  state: UndercoverState,
  now: number,
  subsetIds?: string[],
): UndercoverState {
  const speakers = subsetIds ?? state.aliveIds;
  const offset = Math.floor(Math.random() * speakers.length);
  const rotated = [...speakers.slice(offset), ...speakers.slice(0, offset)];
  return {
    ...state,
    phase: 'clue_round',
    clueQueue: rotated.slice(1),
    currentSpeakerId: rotated[0] ?? null,
    votes: {},
    phaseDeadline: now + state.options.clueSeconds * 1000,
  };
}

function finalizeVotes(
  state: UndercoverState,
  now: number,
): GameStepResult<UndercoverState> {
  const tally = new Map<string, number>();
  for (const targetId of Object.values(state.votes)) {
    if (state.aliveIds.includes(targetId)) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
  }
  let topCount = 0;
  let topIds: string[] = [];
  for (const [id, count] of tally.entries()) {
    if (count > topCount) {
      topCount = count;
      topIds = [id];
    } else if (count === topCount) {
      topIds.push(id);
    }
  }

  if (topIds.length > 1 && !state.pkIds) {
    // Trigger PK clue round for tied players
    const pkState = startClueRound({ ...state, pkIds: topIds }, now, topIds);
    return { state: pkState, sfx: 'gavelBang' };
  }

  // Resolve PK revote ties fairly at random among tied top candidates
  const fallbackPool = state.pkIds && state.pkIds.length > 0 ? state.pkIds : state.aliveIds;
  const eliminatedId =
    topIds.length > 0
      ? topIds[Math.floor(Math.random() * topIds.length)]
      : fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  const nextAlive = state.aliveIds.filter((id) => id !== eliminatedId);
  const nextEliminated = [...state.eliminatedIds, eliminatedId];
  const voteRecord = {
    round: state.round,
    isPk: Boolean(state.pkIds),
    votes: { ...state.votes },
    eliminatedId,
  };

  const afterElim: UndercoverState = {
    ...state,
    aliveIds: nextAlive,
    eliminatedIds: nextEliminated,
    pkIds: null,
    voteHistory: [...(state.voteHistory ?? []), voteRecord],
    lastEliminated: {
      playerId: eliminatedId,
      role: state.roles[eliminatedId],
      votes: { ...state.votes },
    },
  };

  const vic = checkUndercoverVictory(afterElim);
  if (vic) {
    return {
      state: vic,
      voiceClip: vic.winner === 'civilians' ? 'civilians_win' : 'undercover_wins',
      sfx: 'victoryFanfare',
      scoreDeltas: computeUndercoverScoreDeltas(vic),
    };
  }

  return {
    state: {
      ...afterElim,
      phase: 'elimination_reveal',
      phaseDeadline: now + 4500,
    },
    sfx: 'revealDrum',
  };
}

export const undercoverGame: GameDefinition<
  UndercoverState,
  UndercoverOptions,
  UndercoverPublicState,
  UndercoverPrivateState,
  UndercoverAction
> = {
  id: 'undercover',
  minPlayers: 4,
  maxPlayers: 10,
  defaultOptions: {
    category: 'all',
    includeBlank: true,
    clueSeconds: 30,
  },

  createInitialState(seats: PlayerSeat[], rawOptions: UndercoverOptions) {
    const options: UndercoverOptions = { ...this.defaultOptions, ...rawOptions };
    const pool =
      options.category && options.category !== 'all'
        ? UNDERCOVER_WORD_PAIRS.filter((p) => p.categoryId === options.category)
        : UNDERCOVER_WORD_PAIRS;
    const chosen =
      pool[Math.floor(Math.random() * pool.length)] ?? UNDERCOVER_WORD_PAIRS[0];
    const swap = Math.random() < 0.5;
    const civilianWord = swap ? chosen.undercover : chosen.civilian;
    const undercoverWord = swap ? chosen.civilian : chosen.undercover;

    const seatOrder = seats.map((s) => s.id);
    const assigned = buildRoleCounts(seatOrder.length, options.includeBlank);
    const roles: Record<string, UndercoverRole> = {};
    seatOrder.forEach((id, idx) => {
      roles[id] = assigned[idx];
    });

    return {
      state: {
        options,
        language: 'zh',
        phase: 'word_peek',
        round: 1,
        categoryId: chosen.categoryId,
        category: chosen.category,
        civilianWord,
        undercoverWord,
        seatOrder,
        roles,
        aliveIds: [...seatOrder],
        eliminatedIds: [],
        peekedIds: [],
        clueQueue: [],
        currentSpeakerId: null,
        clues: [],
        votes: {},
        voteHistory: [],
        pkIds: null,
        lastEliminated: null,
      },
      voiceClip: 'game_starting',
    };
  },

  applyAction(state, actorId, action) {
    const now = Date.now();
    if (state.phase === 'game_over') return { state };

    if (action.type === 'peek_ready' && state.phase === 'word_peek') {
      const peekedIds = state.peekedIds.includes(actorId)
        ? state.peekedIds
        : [...state.peekedIds, actorId];
      if (peekedIds.length >= state.seatOrder.length) {
        return {
          state: startClueRound({ ...state, peekedIds }, now),
          sfx: 'cardFlip',
        };
      }
      return { state: { ...state, peekedIds }, sfx: 'buttonTap' };
    }

    if (action.type === 'submit_clue' && state.phase === 'clue_round') {
      if (actorId !== state.currentSpeakerId) {
        return { state, error: 'Not your speaking turn' };
      }
      const cleanClue = action.clue.trim().slice(0, 40) || '已口头描述';
      const clues: UndercoverClueRecord[] = [
        ...state.clues,
        {
          round: state.round,
          playerId: actorId,
          clue: cleanClue,
          isPk: state.pkIds !== null,
        },
      ];
      if (state.clueQueue.length > 0) {
        return {
          state: {
            ...state,
            clues,
            currentSpeakerId: state.clueQueue[0],
            clueQueue: state.clueQueue.slice(1),
            phaseDeadline: now + state.options.clueSeconds * 1000,
          },
          sfx: 'buttonTap',
        };
      }
      return {
        state: {
          ...state,
          clues,
          currentSpeakerId: null,
          phase: 'vote_round',
          votes: {},
          phaseDeadline: now + 25_000,
        },
        voiceClip: 'undercover_vote',
        sfx: 'gavelBang',
      };
    }

    if (action.type === 'cast_vote' && state.phase === 'vote_round') {
      if (!state.aliveIds.includes(actorId)) return { state };
      const validPool = state.pkIds ?? state.aliveIds;
      if (!validPool.includes(action.targetId) || action.targetId === actorId) {
        return { state, error: 'Invalid vote target' };
      }
      const votes = { ...state.votes, [actorId]: action.targetId };
      if (Object.keys(votes).length < state.aliveIds.length) {
        return { state: { ...state, votes }, sfx: 'buttonTap' };
      }
      return finalizeVotes({ ...state, votes }, now);
    }

    if (action.type === 'next_round' && state.phase === 'elimination_reveal') {
      return {
        state: startClueRound({ ...state, round: state.round + 1 }, now),
        sfx: 'cardSlide',
      };
    }

    return { state };
  },

  onTick(state, now) {
    if (!state.phaseDeadline || now < state.phaseDeadline || state.phase === 'game_over') {
      return null;
    }
    if (state.phase === 'clue_round' && state.currentSpeakerId) {
      return this.applyAction(
        state,
        state.currentSpeakerId,
        { type: 'submit_clue', clue: '已口头描述' },
        [],
      );
    }
    if (state.phase === 'vote_round') {
      const votes = { ...state.votes };
      const pool = state.pkIds ?? state.aliveIds;
      for (const id of state.aliveIds) {
        if (!votes[id]) {
          votes[id] = pool.find((t) => t !== id) ?? pool[0];
        }
      }
      return finalizeVotes({ ...state, votes }, now);
    }
    if (state.phase === 'elimination_reveal') {
      return {
        state: startClueRound({ ...state, round: state.round + 1 }, now),
        sfx: 'cardSlide',
      };
    }
    return null;
  },

  forceSkipCurrent(state) {
    const now = Date.now();
    if (state.phase === 'word_peek') {
      return {
        state: startClueRound({ ...state, peekedIds: [...state.seatOrder] }, now),
      };
    }
    return this.onTick?.({ ...state, phaseDeadline: now - 1 }, now, []) ?? { state };
  },

  projectPublic(state): UndercoverPublicState {
    const remainingThreatCount = state.aliveIds.filter(
      (id) => state.roles[id] === 'undercover' || state.roles[id] === 'blank',
    ).length;

    const revealedIdentities =
      state.phase === 'game_over'
        ? Object.fromEntries(
            state.seatOrder.map((id) => {
              const role = state.roles[id];
              const word =
                role === 'civilian'
                  ? `${state.civilianWord.zh} / ${state.civilianWord.en}`
                  : role === 'undercover'
                    ? `${state.undercoverWord.zh} / ${state.undercoverWord.en}`
                    : '白板 / Blank';
              const wordObj =
                role === 'civilian'
                  ? state.civilianWord
                  : role === 'undercover'
                    ? state.undercoverWord
                    : null;
              return [id, { role, word, wordObj }];
            }),
          )
        : undefined;

    return {
      phase: state.phase,
      round: state.round,
      category: state.category,
      aliveIds: state.aliveIds,
      eliminatedIds: state.eliminatedIds,
      peekedIds: state.peekedIds,
      clueQueue: state.clueQueue,
      currentSpeakerId: state.currentSpeakerId,
      clues: state.clues,
      votedIds: Object.keys(state.votes),
      pkIds: state.pkIds,
      remainingThreatCount,
      voteHistory: state.voteHistory ?? [],
      lastEliminated: state.lastEliminated,
      winner: state.winner,
      revealedIdentities,
      civilianWord:
        state.phase === 'game_over'
          ? `${state.civilianWord.zh} (${state.civilianWord.en})`
          : undefined,
      undercoverWord:
        state.phase === 'game_over'
          ? `${state.undercoverWord.zh} (${state.undercoverWord.en})`
          : undefined,
      civilianWordObj:
        state.phase === 'game_over' ? state.civilianWord : undefined,
      undercoverWordObj:
        state.phase === 'game_over' ? state.undercoverWord : undefined,
      phaseDeadline: state.phaseDeadline,
    };
  },

  projectPrivate(state, playerId): UndercoverPrivateState {
    const role = state.roles[playerId] ?? 'civilian';
    const secretWord =
      role === 'civilian'
        ? `${state.civilianWord.zh} · ${state.civilianWord.en}`
        : role === 'undercover'
          ? `${state.undercoverWord.zh} · ${state.undercoverWord.en}`
          : null;
    const secretWordObj =
      role === 'civilian'
        ? state.civilianWord
        : role === 'undercover'
          ? state.undercoverWord
          : null;

    return {
      playerId,
      role,
      secretWord,
      secretWordObj,
      alive: state.aliveIds.includes(playerId),
      hasPeeked: state.peekedIds.includes(playerId),
      isMyTurnToClue:
        state.phase === 'clue_round' && state.currentSpeakerId === playerId,
      hasVoted: Boolean(state.votes[playerId]),
    };
  },

  computeBotAction(state, botId) {
    if (state.phase === 'word_peek' && !state.peekedIds.includes(botId)) {
      return { type: 'peek_ready' };
    }
    if (state.phase === 'clue_round' && state.currentSpeakerId === botId) {
      const role = state.roles[botId];
      const catKey = role === 'blank' ? 'blank' : resolveCategoryId(state);
      const pool = BOT_CLUE_BANK[catKey] ?? BOT_CLUE_BANK.blank;
      const usedClues = new Set(state.clues.map((c) => c.clue));
      const fresh = pool.filter((hint) => !usedClues.has(hint));
      const candidates =
        fresh.length > 0
          ? fresh
          : BOT_CLUE_BANK.blank.filter((hint) => !usedClues.has(hint));
      const clue =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : `印象挺深的 · Clue #${state.clues.length + 1}`;
      return {
        type: 'submit_clue',
        clue,
      };
    }
    if (
      state.phase === 'vote_round' &&
      state.aliveIds.includes(botId) &&
      !state.votes[botId]
    ) {
      const pool = (state.pkIds ?? state.aliveIds).filter((id) => id !== botId);
      if (pool.length === 0) return null;
      return {
        type: 'cast_vote',
        targetId: pool[Math.floor(Math.random() * pool.length)],
      };
    }
    return null;
  },
};
