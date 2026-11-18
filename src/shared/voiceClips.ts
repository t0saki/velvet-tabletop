export type VoiceRolePreset =
  | 'zh_judge_suspense'
  | 'zh_judge_solemn'
  | 'zh_dealer_female'
  | 'zh_host_female'
  | 'en_judge_werewolf'
  | 'en_judge_avalon'
  | 'en_dealer_male'
  | 'en_host_female';

export interface VoiceClipDefinition {
  key: string;
  zhText: string;
  enText: string;
  zhRole: VoiceRolePreset;
  enRole: VoiceRolePreset;
}

export const VOICE_CLIP_CATALOG: VoiceClipDefinition[] = [
  // Lobby
  {
    key: 'welcome_stage',
    zhText: '欢迎来到天鹅绒桌游盒，请各位玩家手机扫码入座，准备开启今晚的狂欢之夜。',
    enText: 'Welcome to Velvet Tabletop. Scan the QR code on your phone to take a seat and begin tonight’s party.',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'game_starting',
    zhText: '全员就位，好戏正式开场！请大家注意查看自己的私密手牌。',
    enText: 'All seats are ready. Let the games begin! Check your private hand carefully.',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },

  // Avalon (Crown & Chalice)
  {
    key: 'night_vision',
    zhText: '圆桌暗影已降临，请各位骑士按住查看自己的秘密身份与阵营视野。',
    enText: 'Shadows fall across the Round Table. Hold to peek at your secret role and night vision.',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'team_vote',
    zhText: '队长已钦点出征名单，全体骑士请公开表决：赞成还是反对？',
    enText: 'The leader has nominated the expedition. All knights, cast your public vote now!',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'quest_start',
    zhText: '队伍获准出征！请出征成员暗中抉择：守护圣杯，还是暗中破坏？',
    enText: 'The expedition departs! Chosen members, secretly choose success or sabotage.',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'quest_success',
    zhText: '圣杯闪耀光芒，本轮任务顺利达成！',
    enText: 'The Chalice shines bright. This quest has succeeded!',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'quest_fail',
    zhText: '阴影笼罩了任务，队伍中混入了背叛者，任务宣告失败！',
    enText: 'Betrayal strikes in the dark. This quest has failed!',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'assassin_phase',
    zhText: '正义阵营已达成三次胜利！但刺客仍在暗处窥伺，请刺客指认先知梅林！',
    enText: 'Three quests succeeded, yet the Assassin lurks in the shadows. Name Merlin to steal victory!',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'good_wins',
    zhText: '圆桌黎明降临，圣杯重归荣耀，正义阵营获得最终胜利！',
    enText: 'Dawn breaks over Camelot. The Chalice is safe, and the Loyalists claim victory!',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_avalon',
  },
  {
    key: 'evil_wins',
    zhText: '暗影吞噬了王座，潜伏的邪恶势力赢得了这场博弈！',
    enText: 'Shadows claim the throne. The forces of Evil seize ultimate victory!',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_avalon',
  },

  // Werewolf (Moonlit Coven)
  {
    key: 'night_fall',
    zhText: '月蚀降临，天黑请闭眼。谁能安然度过今夜？',
    enText: 'The lunar eclipse begins. Night falls—close your eyes and guard your secrets.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'guard_wake',
    zhText: '守卫请睁眼，请选择今晚你要守护的一位玩家。',
    enText: 'Guard, open your eyes. Choose one player to protect tonight.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'wolf_wake',
    zhText: '狼人请睁眼，请确认彼此身份并统一今晚的袭击目标。',
    enText: 'Werewolves, open your eyes. Recognize your pack and choose tonight’s victim.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'witch_wake',
    zhText: '女巫请睁眼，你的解药与毒药已就绪，请做出今夜的抉择。',
    enText: 'Witch, open your eyes. Choose whether to use your elixir or your poison.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'seer_wake',
    zhText: '预言家请睁眼，请选择一名玩家，查验他隐藏在月色下的真实阵营。',
    enText: 'Seer, open your eyes. Select one player to inspect their true alignment.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'dawn_peace',
    zhText: '天亮了。昨晚是个平安夜，古堡里无人倒下。',
    enText: 'Dawn breaks. Last night was peaceful—no one perished in the manor.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'dawn_death',
    zhText: '天亮了，钟声敲响。昨晚有人倒在了月影之下，请看公屏战报。',
    enText: 'Dawn breaks as the bell tolls. Tragedy struck in the night—check the table.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'hunter_shot',
    zhText: '猎人倒下前举起了银弹猎枪！请选择是否带走场上的一名玩家。',
    enText: 'The fallen Hunter raises a silver rifle! Choose a final target to take down with you.',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'day_speech',
    zhText: '现在进入白天轮流发言阶段，请按顺序陈述你的线索与怀疑。',
    enText: 'Daytime discussion begins. Share your clues and suspicions in seat order.',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'vote_exile',
    zhText: '发言结束！请全员同时投票，选出你认为最可疑的放逐目标。',
    enText: 'Discussion is over! Cast your votes simultaneously to exile the prime suspect.',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'villagers_win',
    zhText: '狼影散尽，古堡重获光明！好人阵营赢得本局胜利！',
    enText: 'The coven is vanquished and light returns to the manor. Villagers win!',
    zhRole: 'zh_judge_solemn',
    enRole: 'en_judge_werewolf',
  },
  {
    key: 'wolves_win',
    zhText: '血月当空，暗夜狼群彻底掌控了古堡！狼人阵营获胜！',
    enText: 'Under the blood moon, the pack claims the manor. Werewolves win!',
    zhRole: 'zh_judge_suspense',
    enRole: 'en_judge_werewolf',
  },

  // Texas Hold'em (Royal Hold'em)
  {
    key: 'new_hand',
    zhText: '新一手牌开始，盲注已下，各位请看底牌。',
    enText: 'New hand dealt. Blinds are posted—check your hole cards.',
    zhRole: 'zh_dealer_female',
    enRole: 'en_dealer_male',
  },
  {
    key: 'flop',
    zhText: '翻牌圈，三张公共牌已发出，请行动。',
    enText: 'Here comes the flop. Three community cards are on the felt.',
    zhRole: 'zh_dealer_female',
    enRole: 'en_dealer_male',
  },
  {
    key: 'turn',
    zhText: '转牌发出，局势逐渐明朗。',
    enText: 'Fourth street—here is the turn card.',
    zhRole: 'zh_dealer_female',
    enRole: 'en_dealer_male',
  },
  {
    key: 'river',
    zhText: '河牌揭晓，最后的决胜时刻到了。',
    enText: 'Final card on the river. Make your decisive move.',
    zhRole: 'zh_dealer_female',
    enRole: 'en_dealer_male',
  },
  {
    key: 'all_in',
    zhText: '全下！桌上的筹码已经推入底池中心！',
    enText: 'All in! The chips are pushed into the center pot!',
    zhRole: 'zh_dealer_female',
    enRole: 'en_dealer_male',
  },
  {
    key: 'showdown',
    zhText: '亮牌比大小！让我们揭晓谁才是本手牌的真正赢家。',
    enText: 'Showdown! Reveal your hands to claim the pot.',
    zhRole: 'zh_dealer_female',
    enRole: 'en_dealer_male',
  },

  // Monopoly (Metropolis Tycoon)
  {
    key: 'auction_start',
    zhText: '地皮流拍进入十秒极速拍卖！全员手机抢拍，价高者得！',
    enText: 'Property passed! Ten-second live auction starts now—all players bid on your phones!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'bankrupt',
    zhText: '资金链断裂，一位财阀黯然破产退场！',
    enText: 'Financial collapse! A tycoon has declared bankruptcy!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'tycoon_winner',
    zhText: '钟声敲响，帝国资产结算完成！恭喜新任大都市首富诞生！',
    enText: 'Final bell! Net worth tallied—hail the new Metropolis Tycoon!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },

  // Sketch Relay & Masquerade Undercover
  {
    key: 'start_drawing',
    zhText: '灵感来袭！请在倒计时结束前，用你的灵魂画技画出屏幕上的题目！',
    enText: 'Grab your brush! Sketch the prompt before the timer runs out!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'start_guessing',
    zhText: '画作传递完毕！快来看看上家的灵魂画作，猜出它到底画了什么！',
    enText: 'Sketch passed! Inspect the artwork and guess what on earth it represents!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'exhibition_reveal',
    zhText: '最爆笑的时刻到了！欢迎来到灵魂画展最终复盘大赏！',
    enText: 'The moment we all waited for! Welcome to the Grand Sketch Exhibition Finale!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'undercover_vote',
    zhText: '描述完毕！谁在浑水摸鱼？请投票指认你心中的卧底或白板！',
    enText: 'Clues are in! Who is faking it? Vote to unmask the Undercover!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'civilians_win',
    zhText: '火眼金睛！所有潜伏卧底已被识破，平民阵营大获全胜！',
    enText: 'Sharp eyes! Every infiltrator has been unmasked—Civilians win!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
  {
    key: 'undercover_wins',
    zhText: '完美伪装！卧底成功潜伏至终局，夺得假面晚宴的胜利！',
    enText: 'Masterful deception! The Undercover team outlasted the salon and claims victory!',
    zhRole: 'zh_host_female',
    enRole: 'en_host_female',
  },
];

export type VoiceClipKey = (typeof VOICE_CLIP_CATALOG)[number]['key'];
