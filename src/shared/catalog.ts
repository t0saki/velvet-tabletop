import type { GameId } from './types.js';
import type { LocalizedText } from './gameTypes.js';

export interface GameCatalogEntry {
  id: GameId;
  title: LocalizedText;
  subtitle: LocalizedText;
  classicTag: LocalizedText;
  minPlayers: number;
  maxPlayers: number;
  recommendedPlayers: string;
  durationMins: string;
  coverImage: string;
  backdropVideo: string;
  bgmTrack: string;
  accentColor: string;
  badgeText: LocalizedText;
  quickRules: {
    zh: string[];
    en: string[];
  };
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'avalon',
    title: { zh: '圆桌暗影：圣杯骑士', en: 'Crown & Chalice' },
    subtitle: {
      zh: '阵营推理 · 全程无淘汰 · 梅林与刺客的终极博弈',
      en: 'Hidden Loyalty · Zero Elimination · Merlin vs. Assassin',
    },
    classicTag: { zh: '阿瓦隆机制', en: 'Avalon Mechanics' },
    minPlayers: 5,
    maxPlayers: 10,
    recommendedPlayers: '6-10',
    durationMins: '20-35m',
    coverImage: '/images/cover-avalon.webp',
    backdropVideo: '/videos/stage-avalon.mp4',
    bgmTrack: '/audio/bgm/suspense.mp3',
    accentColor: '#D4AF37',
    badgeText: { zh: '聚会推理首选', en: 'Top Deduction' },
    quickRules: {
      zh: [
        '开局按住查看自己的阵营：忠臣保护圣杯，爪牙暗中破坏。',
        '每轮队长挑选出征人选，全员公开投票（连续5次否决直接邪恶胜）。',
        '出征队私密投出「成功/破坏」；正义方必须集齐3次任务成功。',
        '若正义达成3胜，刺客将获得最后一次刺杀梅林翻盘的机会！',
      ],
      en: [
        'Hold to peek at your loyalty. Merlin knows Evil (except Mordred); Evil knows each other.',
        'The rotating Leader nominates a Quest Team; all players vote publicly (5 consecutive rejections = Evil wins).',
        'Chosen teammates secretly submit Success or Fail. 7+ players require 2 Fails on Quest 4.',
        'If Good wins 3 Quests, the Assassin gets one final shot to identify Merlin and steal victory!',
      ],
    },
  },
  {
    id: 'werewolf',
    title: { zh: '月蚀古堡：暗夜审判', en: 'Moonlit Coven' },
    subtitle: {
      zh: '全自动语音法官 · 预女猎守标准局 · 彻底解放真人主持',
      en: 'Automated AI Judge · Seer/Witch/Hunter/Guard · No Moderator Needed',
    },
    classicTag: { zh: '经典狼人杀', en: 'Werewolf' },
    minPlayers: 6,
    maxPlayers: 10,
    recommendedPlayers: '6-10',
    durationMins: '25-40m',
    coverImage: '/images/cover-werewolf.webp',
    backdropVideo: '/videos/stage-werewolf.mp4',
    bgmTrack: '/audio/bgm/suspense.mp3',
    accentColor: '#E11D48',
    badgeText: { zh: '全自动语音法官', en: 'Auto Voice Judge' },
    quickRules: {
      zh: [
        '免真人上帝！大屏或房主端自动用豆包悬疑嗓音播报夜晚流程。',
        '夜晚按「守卫 → 狼人 → 女巫 → 预言家」依次在自己手机上静默行动。',
        '白天按座位顺序发言推理，随后全员同步投票放逐可疑对象。',
        '采用屠边规则：神职或平民全部出局则狼胜，狼人全灭则好人胜。',
      ],
      en: [
        'Zero human moderator required! Automated studio narration guides every night and day phase.',
        'At night, Guard, Werewolves, Witch, and Seer secretly act directly on their phones.',
        'At dawn, discuss in turn order and cast simultaneous exile votes.',
        'Side-wipe victory: Wolves win if all Gods OR all Villagers fall; Good wins when all Wolves are exiled.',
      ],
    },
  },
  {
    id: 'texas',
    title: { zh: '皇家德州：霓虹赌桌', en: "Royal Hold'em: Velvet Stakes" },
    subtitle: {
      zh: '无限注德州扑克 · 多人All-in精准边池 · 实时牌型提示',
      en: 'No-Limit Hold’em · Multi-Way Side Pots · Live Hand Strength Helper',
    },
    classicTag: { zh: '德州扑克', en: "Texas Hold'em" },
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: '6-10',
    durationMins: '15-45m',
    coverImage: '/images/cover-texas.webp',
    backdropVideo: '/videos/stage-texas.mp4',
    bgmTrack: '/audio/bgm/lobby.mp3',
    accentColor: '#10B981',
    badgeText: { zh: '真实边池算分', en: 'Pro Side-Pot Engine' },
    quickRules: {
      zh: [
        '免买实体筹码！大屏展现豪华牌桌与公共牌，手机按住看两张底牌。',
        '手机端自带实时最佳牌型提示（如两对/同花），新手也能轻松上桌。',
        '支持短码全下自动切分主池与多级边池，金额精确到每枚筹码。',
        '可开启「聚会无限重买」，筹码归零也可继续爽玩不冷场。',
      ],
      en: [
        'No physical chips needed! Public cards shine on the stage while your phone protects your hole cards.',
        'Your private screen calculates your live best 5-card hand automatically for effortless play.',
        'True side-pot slicing handles multiple unequal All-Ins down to the exact chip.',
        'Enable Party Rebuy in options so busted players can re-enter and keep the fun going.',
      ],
    },
  },
  {
    id: 'monopoly',
    title: { zh: '星耀大亨：财阀帝国', en: 'Metropolis Tycoon' },
    subtitle: {
      zh: '聚会快节奏大富翁 · 流拍全员10秒手机抢拍 · 地产升级收租',
      en: 'Party-Paced Monopoly · 10s Live Multi-Phone Auctions · Skyline Upgrades',
    },
    classicTag: { zh: '大富翁机制', en: 'Classic Monopoly' },
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: '4-8',
    durationMins: '20-35m',
    coverImage: '/images/cover-monopoly.webp',
    backdropVideo: '/videos/stage-monopoly.mp4',
    bgmTrack: '/audio/bgm/party.mp3',
    accentColor: '#F59E0B',
    badgeText: { zh: '全员同屏拍卖', en: 'Live Phone Auctions' },
    quickRules: {
      zh: [
        '在手机上掷双骰环游28格繁华大都市，经过起点领 ¥2000 薪资。',
        '踩中无主地皮不买？立即触发「10秒全员手机同屏抢拍」，人人有戏不枯坐！',
        '踩中自有地块或集齐同色系可建造摩天大楼，租金暴涨数倍。',
        '在规定回合内净资产（现金+地产+建筑）最高者荣登首富王座！',
      ],
      en: [
        'Roll 2D6 on your phone to circle the 28-tile Art-Deco metropolis (+¥2000 passing START).',
        'Pass on buying a property? It immediately triggers a 10s live auction across every player’s phone!',
        'Upgrade your districts up to Lv4 Megacorps for exponential rent.',
        'Highest total net worth at the final round (or last tycoon standing) wins the crown!',
      ],
    },
  },
  {
    id: 'sketch',
    title: { zh: '灵魂画手：传声晚宴', en: 'Sketch Relay' },
    subtitle: {
      zh: '全员同步画猜接龙 · 零等待时间 · 大屏逐帧爆笑画展复盘',
      en: 'Simultaneous Draw & Guess · Zero Downtime · Grand Exhibition Finale',
    },
    classicTag: { zh: 'Gartic Phone 机制', en: 'Telestrations' },
    minPlayers: 4,
    maxPlayers: 10,
    recommendedPlayers: '6-10',
    durationMins: '12-20m',
    coverImage: '/images/cover-sketch.webp',
    backdropVideo: '/videos/stage-sketch.mp4',
    bgmTrack: '/audio/bgm/party.mp3',
    accentColor: '#EC4899',
    badgeText: { zh: '聚会破冰必玩', en: 'Zero-Wait Party Hit' },
    quickRules: {
      zh: [
        '第1步全员同时输入或抽取一个脑洞句子（可自选官方搞笑题库）。',
        '之后每轮画册同步传给下家：看到文字就画出来，看到画作就猜出句子！',
        '全员同步作画/猜词完全不冷场，手机手指流畅绘画支持撤销与油漆桶填色。',
        '终局大屏逐本揭秘「离谱歪楼演变史」，并投票选出今晚灵魂画作 MVP！',
      ],
      en: [
        'Everyone simultaneously picks or writes a wacky prompt in Step 1.',
        'Albums rotate every round: draw the prompt you received, or guess the sketch you see!',
        'Zero downtime—every phone draws or guesses at the same time with smooth touch tools.',
        'At the Grand Exhibition, watch hilarious distortions unfold step-by-step and vote for MVP!',
      ],
    },
  },
  {
    id: 'undercover',
    title: { zh: '假面卧底：谍影晚宴', en: 'Masquerade Undercover' },
    subtitle: {
      zh: '120+双语精品词库 · 支持白板与PK · 聚会零门槛秒开局',
      en: '120+ Bilingual Word Pairs · Blank Slate Support · Instant Icebreaker',
    },
    classicTag: { zh: '谁是卧底', en: 'Undercover' },
    minPlayers: 4,
    maxPlayers: 10,
    recommendedPlayers: '6-10',
    durationMins: '10-15m',
    coverImage: '/images/cover-undercover.webp',
    backdropVideo: '/videos/stage-undercover.mp4',
    bgmTrack: '/audio/bgm/party.mp3',
    accentColor: '#A855F7',
    badgeText: { zh: '10秒上手破冰', en: 'Instant Icebreaker' },
    quickRules: {
      zh: [
        '按住查看自己的秘密词语：多数平民词相同，卧底拿到极相似的关联词，白板无词。',
        '轮流用一句话描述自己的词（既不能太明显让卧底猜到，也不能太离谱被当成卧底）。',
        '全员同步投票放逐嫌疑人，平票则触发加时 PK 描述。',
        '投出所有卧底和白板即平民胜；否则卧底混到最后翻盘获胜！',
      ],
      en: [
        'Hold to peek at your secret word: Civilians share one word, Undercovers get a close twist, Blank gets none.',
        'Take turns giving a subtle 1-sentence clue (loggable on screen for easy 10-player tracking).',
        'Vote simultaneously to unmask suspects; ties trigger a sudden-death PK clue.',
        'Civilians win by eliminating all Undercovers & Blanks; infiltrators win if they reach parity!',
      ],
    },
  },
];

export interface AvatarMeta {
  id: string;
  emoji: string;
  image?: string;
  bg: string;
  label: LocalizedText;
}

export const AVATARS: AvatarMeta[] = [
  { id: 'crown', emoji: '👑', image: '/images/avatars/crown.webp', bg: 'from-amber-500/30 to-yellow-900/60', label: { zh: '黄金爵士', en: 'Gold Sovereign' } },
  { id: 'fox', emoji: '🦊', image: '/images/avatars/fox.webp', bg: 'from-orange-500/30 to-red-900/60', label: { zh: '狡黠狐狸', en: 'Velvet Fox' } },
  { id: 'wolf', emoji: '🐺', image: '/images/avatars/wolf.webp', bg: 'from-slate-400/30 to-slate-900/70', label: { zh: '月影孤狼', en: 'Lunar Wolf' } },
  { id: 'owl', emoji: '🦉', image: '/images/avatars/owl.webp', bg: 'from-indigo-500/30 to-slate-900/70', label: { zh: '夜巡猫头鹰', en: 'Night Owl' } },
  { id: 'cat', emoji: '🐱', image: '/images/avatars/cat.webp', bg: 'from-pink-500/30 to-rose-900/60', label: { zh: '黑猫名伶', en: 'Salon Cat' } },
  { id: 'dragon', emoji: '🐉', image: '/images/avatars/dragon.webp', bg: 'from-emerald-500/30 to-teal-900/60', label: { zh: '翡翠神龙', en: 'Jade Dragon' } },
  { id: 'mask', emoji: '🎭', image: '/images/avatars/mask.webp', bg: 'from-purple-500/30 to-fuchsia-900/60', label: { zh: '假面歌剧', en: 'Phantom' } },
  { id: 'unicorn', emoji: '🦄', image: '/images/avatars/unicorn.webp', bg: 'from-cyan-400/30 to-indigo-900/60', label: { zh: '霓虹独角', en: 'Neon Star' } },
  { id: 'lion', emoji: '🦁', image: '/images/avatars/lion.webp', bg: 'from-yellow-500/30 to-amber-900/60', label: { zh: '雄狮骑士', en: 'Lionheart' } },
  { id: 'swan', emoji: '🦢', image: '/images/avatars/swan.webp', bg: 'from-sky-400/30 to-blue-900/60', label: { zh: '天鹅公爵', en: 'Ivory Swan' } },
  { id: 'octopus', emoji: '🐙', image: '/images/avatars/octopus.webp', bg: 'from-rose-500/30 to-purple-900/60', label: { zh: '深海八爪', en: 'Kraken' } },
  { id: 'panda', emoji: '🐼', image: '/images/avatars/panda.webp', bg: 'from-zinc-300/30 to-zinc-800/70', label: { zh: '功夫国宝', en: 'Bamboo Baron' } },
  { id: 'bee', emoji: '🐝', bg: 'from-amber-400/30 to-stone-900/60', label: { zh: '黄金蜂王', en: 'Gilded Bee' } },
  { id: 'butterfly', emoji: '🦋', bg: 'from-teal-400/30 to-blue-900/60', label: { zh: '幻彩蝶影', en: 'Morpho' } },
  { id: 'ghost', emoji: '👻', bg: 'from-violet-400/30 to-slate-900/70', label: { zh: '古堡幽灵', en: 'Manor Ghost' } },
  { id: 'alien', emoji: '👽', bg: 'from-lime-400/30 to-emerald-950/70', label: { zh: '星际来客', en: 'Star Visitor' } },
];

export const REACTION_EMOJIS = ['😂', '🔥', '😱', '🤔', '👏', '💀', '🎭', '💰'];

export const BOT_NAMES: LocalizedText[] = [
  { zh: '伯爵 AI', en: 'Earl Bot' },
  { zh: '公爵夫人 AI', en: 'Duchess Bot' },
  { zh: '黑桃K AI', en: 'King Spades' },
  { zh: '月光女巫 AI', en: 'Luna Bot' },
  { zh: '大亨先生 AI', en: 'Baron Bot' },
  { zh: '达芬奇 AI', en: 'Vinci Bot' },
  { zh: '夜莺 AI', en: 'Vesper Bot' },
  { zh: '金库管家 AI', en: 'Sterling Bot' },
  { zh: '怪盗 AI', en: 'Lupin Bot' },
];

export function getGameCatalogEntry(id: GameId): GameCatalogEntry {
  return GAME_CATALOG.find((g) => g.id === id) ?? GAME_CATALOG[0];
}
