const QUESTS = {
  // 卡利姆多 - 泰达希尔
  teldrassil_defense: {
    key: 'teldrassil_defense',
    locationKey: 'teldrassil',
    name: '泰达希尔的守卫',
    description: '暗影森林深处有蜘蛛巢穴正在向外扩张，需要清剿它们！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 5 }
    ],
    reward: { xp: 80, gold: 40 }
  },
  teldrassil_goblins: {
    key: 'teldrassil_goblins',
    locationKey: 'teldrassil',
    name: '森林强盗',
    description: '豺狼人在森林边缘袭击过路的旅行者，快去教训他们！',
    objectives: [
      { type: 'kill', enemyKey: 'goblin', target: 4 }
    ],
    reward: { xp: 100, gold: 50 }
  },

  // 卡利姆多 - 秘蓝岛
  azuremyst_spiders: {
    key: 'azuremyst_spiders',
    locationKey: 'azuremyst',
    name: '蜘蛛入侵',
    description: '大量蜘蛛从洞穴中涌出，威胁着秘蓝岛的安全！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 6 }
    ],
    reward: { xp: 60, gold: 30 }
  },
  azuremyst_goblins: {
    key: 'azuremyst_goblins',
    locationKey: 'azuremyst',
    name: '强盗窝点',
    description: '豺狼人在秘蓝岛建立了临时据点，必须将其驱散！',
    objectives: [
      { type: 'kill', enemyKey: 'goblin', target: 3 }
    ],
    reward: { xp: 50, gold: 25 }
  },

  // 卡利姆多 - 灰谷
  ashenvale_orcs: {
    key: 'ashenvale_orcs',
    locationKey: 'ashenvale',
    name: '兽人入侵',
    description: '战歌氏族的兽人正在灰谷疯狂砍伐森林，前去阻止他们！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 5 }
    ],
    reward: { xp: 120, gold: 60 }
  },
  ashenvale_spiders: {
    key: 'ashenvale_spiders',
    locationKey: 'ashenvale',
    name: '毒蛛清剿',
    description: '森林深处的巨型毒蛛对居民造成了巨大威胁！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 4 }
    ],
    reward: { xp: 100, gold: 50 }
  },

  // 东部王国 - 艾尔文森林
  elwynn_goblins: {
    key: 'elwynn_goblins',
    locationKey: 'elwynn',
    name: '豺狼之灾',
    description: '艾尔文森林的豺狼人越来越猖獗，威胁着农场的安全！',
    objectives: [
      { type: 'kill', enemyKey: 'goblin', target: 4 }
    ],
    reward: { xp: 60, gold: 30 }
  },
  elwynn_bandits: {
    key: 'elwynn_bandits',
    locationKey: 'elwynn',
    name: '打击盗匪',
    description: '一群盗匪在森林边缘活动，快去为民除害！',
    objectives: [
      { type: 'kill', enemyKey: 'bandit', target: 3 }
    ],
    reward: { xp: 50, gold: 25 }
  },

  // 东部王国 - 西部荒野
  westfall_bandits: {
    key: 'westfall_bandits',
    locationKey: 'westfall',
    name: '西部荒野的强盗',
    description: '迪菲亚兄弟会在西部荒野横行霸道，必须将其绳之以法！',
    objectives: [
      { type: 'kill', enemyKey: 'bandit', target: 5 }
    ],
    reward: { xp: 80, gold: 40 }
  },
  westfall_skeletons: {
    key: 'westfall_skeletons',
    locationKey: 'westfall',
    name: '闹鬼的农场',
    description: '月溪镇附近的农场出现了亡灵，快去调查！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 3 }
    ],
    reward: { xp: 70, gold: 35 }
  },

  // 东部王国 - 赤脊山
  redridge_orcs: {
    key: 'redridge_orcs',
    locationKey: 'redridge',
    name: '黑石兽人的威胁',
    description: '黑石部落的兽人正在赤脊山集结，准备入侵！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 4 }
    ],
    reward: { xp: 100, gold: 50 }
  },
  redridge_spiders: {
    key: 'redridge_spiders',
    locationKey: 'redridge',
    name: '峡谷蜘蛛',
    description: '赤脊峡谷中的巨型蜘蛛开始攻击过往的旅人！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 3 }
    ],
    reward: { xp: 90, gold: 45 }
  },

  // 东部王国 - 暮色森林
  duskwood_skeletons: {
    key: 'duskwood_skeletons',
    locationKey: 'duskwood',
    name: '墓地的亡灵',
    description: '夜色镇的墓地正在遭受亡灵的侵扰，需要有人去处理！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 6 }
    ],
    reward: { xp: 120, gold: 60 }
  },
  duskwood_spiders: {
    key: 'duskwood_spiders',
    locationKey: 'duskwood',
    name: '森林毒蛛',
    description: '暮色森林中的蜘蛛比其他地方的更加危险！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 4 }
    ],
    reward: { xp: 110, gold: 55 }
  },

  // 东部王国 - 银松森林
  silverpine_skeletons: {
    key: 'silverpine_skeletons',
    locationKey: 'silverpine',
    name: '被遗忘者的威胁',
    description: '银松森林中游荡着大量亡灵，需要被清理！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 5 }
    ],
    reward: { xp: 130, gold: 65 }
  },
  silverpine_wolves: {
    key: 'silverpine_wolves',
    locationKey: 'silverpine',
    name: '疯狼之灾',
    description: '森林中的狼群变得异常凶猛，威胁着过往旅人！',
    objectives: [
      { type: 'kill', enemyKey: 'wolf', target: 4 }
    ],
    reward: { xp: 120, gold: 60 }
  },

  // 东部王国 - 提瑞斯法林地
  tirisfal_skeletons: {
    key: 'tirisfal_skeletons',
    locationKey: 'tirisfal',
    name: '亡灵的起源',
    description: '提瑞斯法林地的亡灵需要被净化！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 4 }
    ],
    reward: { xp: 50, gold: 25 }
  },
  tirisfal_ghouls: {
    key: 'tirisfal_ghouls',
    locationKey: 'tirisfal',
    name: '食尸鬼之患',
    description: '大量食尸鬼在坟墓间游荡，快去消灭它们！',
    objectives: [
      { type: 'kill', enemyKey: 'ghoul', target: 3 }
    ],
    reward: { xp: 60, gold: 30 }
  },

  // 东部王国 - 东瘟疫之地
  plaguelands_skeletons: {
    key: 'plaguelands_skeletons',
    locationKey: 'plaguelands',
    name: '天灾军团',
    description: '瘟疫之地的亡灵必须被彻底消灭！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 5 }
    ],
    reward: { xp: 250, gold: 120 }
  },
  plaguelands_demons: {
    key: 'plaguelands_demons',
    locationKey: 'plaguelands',
    name: '燃烧军团的先锋',
    description: '恶魔在瘟疫之地横行，必须将其驱逐！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 3 }
    ],
    reward: { xp: 280, gold: 140 }
  },

  // 东部王国 - 荆棘谷
  stranglethorn_trolls: {
    key: 'stranglethorn_trolls',
    locationKey: 'stranglethorn',
    name: '血顶巨魔',
    description: '血顶巨魔部落正在荆棘谷进行疯狂的劫掠！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 4 }
    ],
    reward: { xp: 150, gold: 75 }
  },
  stranglethorn_orcs: {
    key: 'stranglethorn_orcs',
    locationKey: 'stranglethorn',
    name: '风险投资公司',
    description: '风险投资公司的兽人在丛林中掠夺资源！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 3 }
    ],
    reward: { xp: 160, gold: 80 }
  },

  // 卡利姆多 - 石爪山脉
  stonetalon_orcs: {
    key: 'stonetalon_orcs',
    locationKey: 'stonetalon',
    name: '石爪要塞',
    description: '石爪山脉中的兽人据点需要被拔除！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 5 }
    ],
    reward: { xp: 140, gold: 70 }
  },
  stonetalon_spiders: {
    key: 'stonetalon_spiders',
    locationKey: 'stonetalon',
    name: '洞穴毒蛛',
    description: '石爪山脉的洞穴中充满了危险的蜘蛛！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 4 }
    ],
    reward: { xp: 130, gold: 65 }
  },

  // 卡利姆多 - 塔纳利斯
  deserts_trolls: {
    key: 'deserts_trolls',
    locationKey: 'deserts',
    name: '沙怒巨魔',
    description: '沙怒巨魔在沙漠中袭击商队，必须被阻止！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 4 }
    ],
    reward: { xp: 180, gold: 90 }
  },
  deserts_skeletons: {
    key: 'deserts_skeletons',
    locationKey: 'deserts',
    name: '祖尔法拉克的亡灵',
    description: '古老的巨魔墓穴中出现了亡灵！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 5 }
    ],
    reward: { xp: 170, gold: 85 }
  },

  // 卡利姆多 - 菲拉斯
  feralas_trolls: {
    key: 'feralas_trolls',
    locationKey: 'feralas',
    name: '暗矛巨魔',
    description: '菲拉斯的森林深处有暗矛巨魔的活动！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 5 }
    ],
    reward: { xp: 200, gold: 100 }
  },
  feralas_dragons: {
    key: 'feralas_dragons',
    locationKey: 'feralas',
    name: '龙的领地',
    description: '幼龙在菲拉斯出没，这是勇士的试炼！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 2 }
    ],
    reward: { xp: 250, gold: 125 }
  },

  // 诺森德 - 北风苔原
  borean_tundra_trolls: {
    key: 'borean_tundra_trolls',
    locationKey: 'borean_tundra',
    name: '冰雪巨魔',
    description: '冰雪巨魔在苔原上游荡，威胁着远征军的安全！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 5 }
    ],
    reward: { xp: 300, gold: 150 }
  },
  borean_tundra_nerubians: {
    key: 'borean_tundra_nerubians',
    locationKey: 'borean_tundra',
    name: '蛛魔入侵',
    description: '蛛魔从地下涌出，必须将其击退！',
    objectives: [
      { type: 'kill', enemyKey: 'nerubian', target: 4 }
    ],
    reward: { xp: 320, gold: 160 }
  },

  // 诺森德 - 风暴峭壁
  storm_peaks_dwarves: {
    key: 'storm_peaks_dwarves',
    locationKey: 'storm_peaks',
    name: '铁矮人的威胁',
    description: '铁矮人正在风暴峭壁进行秘密活动！',
    objectives: [
      { type: 'kill', enemyKey: 'iron_dwarf', target: 5 }
    ],
    reward: { xp: 350, gold: 175 }
  },
  storm_peaks_elementals: {
    key: 'storm_peaks_elementals',
    locationKey: 'storm_peaks',
    name: '元素暴动',
    description: '风暴元素变得异常狂暴！',
    objectives: [
      { type: 'kill', enemyKey: 'elemental', target: 4 }
    ],
    reward: { xp: 340, gold: 170 }
  },

  // 诺森德 - 冰冠冰川
  icecrown_demons: {
    key: 'icecrown_demons',
    locationKey: 'icecrown',
    name: '巫妖王的仆从',
    description: '大量恶魔在冰冠冰川聚集，必须阻止他们的阴谋！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 6 }
    ],
    reward: { xp: 500, gold: 250 }
  },
  icecrown_undead: {
    key: 'icecrown_undead',
    locationKey: 'icecrown',
    name: '天灾军团的末日',
    description: '给予亡灵天灾最后的一击！',
    objectives: [
      { type: 'kill', enemyKey: 'undead', target: 5 }
    ],
    reward: { xp: 480, gold: 240 }
  }
};
