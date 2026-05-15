import type { QuestData } from '../types'

export const QUESTS: Record<string, QuestData> = {
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
  },
  darkshore_murlocs: {
    key: 'darkshore_murlocs',
    locationKey: 'darkshore',
    name: '鱼人侵扰',
    description: '鱼人正在黑海岸的海滩上作乱！',
    objectives: [
      { type: 'kill', enemyKey: 'murloc', target: 6 }
    ],
    reward: { xp: 70, gold: 35 }
  },
  darkshore_bears: {
    key: 'darkshore_bears',
    locationKey: 'darkshore',
    name: '狂野之熊',
    description: '凶猛的熊威胁着黑海岸的旅者安全！',
    objectives: [
      { type: 'kill', enemyKey: 'bear', target: 4 }
    ],
    reward: { xp: 80, gold: 40 }
  },
  darkshore_gnolls: {
    key: 'darkshore_gnolls',
    locationKey: 'darkshore',
    name: '豺狼人袭击',
    description: '豺狼人正在袭击沿海的营地！',
    objectives: [
      { type: 'kill', enemyKey: 'gnoll', target: 5 }
    ],
    reward: { xp: 75, gold: 38 }
  },
  bloodmyst_elementals: {
    key: 'bloodmyst_elementals',
    locationKey: 'bloodmyst',
    name: '元素暴动',
    description: '元素生物在秘血岛肆虐！',
    objectives: [
      { type: 'kill', enemyKey: 'elemental', target: 5 }
    ],
    reward: { xp: 90, gold: 45 }
  },
  bloodmyst_demons: {
    key: 'bloodmyst_demons',
    locationKey: 'bloodmyst',
    name: '恶魔踪迹',
    description: '发现恶魔的踪迹，必须消灭他们！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 2 }
    ],
    reward: { xp: 100, gold: 50 }
  },
  winterspring_elementals: {
    key: 'winterspring_elementals',
    locationKey: 'winterspring',
    name: '寒冰元素',
    description: '冰霜元素正在冬泉谷狂暴！',
    objectives: [
      { type: 'kill', enemyKey: 'elemental', target: 5 }
    ],
    reward: { xp: 200, gold: 100 }
  },
  winterspring_demons: {
    key: 'winterspring_demons',
    locationKey: 'winterspring',
    name: '恶魔威胁',
    description: '恶魔潜入了冬泉谷，必须驱逐他们！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 3 }
    ],
    reward: { xp: 220, gold: 110 }
  },
  winterspring_dragons: {
    key: 'winterspring_dragons',
    locationKey: 'winterspring',
    name: '蓝龙幼崽',
    description: '蓝龙幼崽需要被击败以证明你的勇气！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 2 }
    ],
    reward: { xp: 230, gold: 115 }
  },
  hyjal_demons: {
    key: 'hyjal_demons',
    locationKey: 'hyjal',
    name: '燃烧军团残党',
    description: '燃烧军团的余孽仍在海加尔山活动！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 4 }
    ],
    reward: { xp: 280, gold: 140 }
  },
  hyjal_dragons: {
    key: 'hyjal_dragons',
    locationKey: 'hyjal',
    name: '守护巨龙',
    description: '与守护巨龙的幼崽战斗以获得认可！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 3 }
    ],
    reward: { xp: 300, gold: 150 }
  },
  felwood_demons: {
    key: 'felwood_demons',
    locationKey: 'felwood',
    name: '恶魔腐化',
    description: '清除费伍德森林中的恶魔！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 4 }
    ],
    reward: { xp: 180, gold: 90 }
  },
  felwood_trolls: {
    key: 'felwood_trolls',
    locationKey: 'felwood',
    name: '森林巨魔',
    description: '巨魔在费伍德森林作乱！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 3 }
    ],
    reward: { xp: 170, gold: 85 }
  },
  desolace_centaurs: {
    key: 'desolace_centaurs',
    locationKey: 'desolace',
    name: '半人马冲突',
    description: '半人马部落正在互相争斗，需要调停！',
    objectives: [
      { type: 'kill', enemyKey: 'centaur', target: 5 }
    ],
    reward: { xp: 190, gold: 95 }
  },
  desolace_skeletons: {
    key: 'desolace_skeletons',
    locationKey: 'desolace',
    name: '亡灵遗迹',
    description: '古老的遗迹中出现了亡灵！',
    objectives: [
      { type: 'kill', enemyKey: 'skeleton', target: 6 }
    ],
    reward: { xp: 180, gold: 90 }
  },
  durotar_boars: {
    key: 'durotar_boars',
    locationKey: 'durotar',
    name: '野猪威胁',
    description: '野猪正在破坏杜隆塔尔的农田！',
    objectives: [
      { type: 'kill', enemyKey: 'boar', target: 6 }
    ],
    reward: { xp: 60, gold: 30 }
  },
  durotar_quilboars: {
    key: 'durotar_quilboars',
    locationKey: 'durotar',
    name: '野猪人入侵',
    description: '野猪人正在入侵杜隆塔尔！',
    objectives: [
      { type: 'kill', enemyKey: 'quilboar', target: 4 }
    ],
    reward: { xp: 70, gold: 35 }
  },
  mulgore_wolves: {
    key: 'mulgore_wolves',
    locationKey: 'mulgore',
    name: '狼群威胁',
    description: '灰狼正在莫高雷游荡！',
    objectives: [
      { type: 'kill', enemyKey: 'wolf', target: 5 }
    ],
    reward: { xp: 55, gold: 28 }
  },
  mulgore_bears: {
    key: 'mulgore_bears',
    locationKey: 'mulgore',
    name: '熊之领地',
    description: '棕熊占据了莫高雷的部分地区！',
    objectives: [
      { type: 'kill', enemyKey: 'bear', target: 4 }
    ],
    reward: { xp: 65, gold: 32 }
  },
  barrens_quilboars: {
    key: 'barrens_quilboars',
    locationKey: 'barrens',
    name: '野猪人营地',
    description: '摧毁野猪人的营地！',
    objectives: [
      { type: 'kill', enemyKey: 'quilboar', target: 5 }
    ],
    reward: { xp: 90, gold: 45 }
  },
  barrens_centaurs: {
    key: 'barrens_centaurs',
    locationKey: 'barrens',
    name: '半人马掠夺',
    description: '半人马正在掠夺贫瘠之地的商队！',
    objectives: [
      { type: 'kill', enemyKey: 'centaur', target: 4 }
    ],
    reward: { xp: 100, gold: 50 }
  },
  thousand_needles_centaurs: {
    key: 'thousand_needles_centaurs',
    locationKey: 'thousand_needles',
    name: '千针石林的半人马',
    description: '半人马控制了千针石林的高地！',
    objectives: [
      { type: 'kill', enemyKey: 'centaur', target: 5 }
    ],
    reward: { xp: 160, gold: 80 }
  },
  thousand_needles_harpies: {
    key: 'thousand_needles_harpies',
    locationKey: 'thousand_needles',
    name: '鹰身人巢穴',
    description: '鹰身人在千针石林筑巢！',
    objectives: [
      { type: 'kill', enemyKey: 'harpy', target: 4 }
    ],
    reward: { xp: 150, gold: 75 }
  },
  silithus_silithids: {
    key: 'silithus_silithids',
    locationKey: 'silithus',
    name: '异种虫入侵',
    description: '异种虫正在希利苏斯肆虐！',
    objectives: [
      { type: 'kill', enemyKey: 'silithid', target: 4 }
    ],
    reward: { xp: 260, gold: 130 }
  },
  silithus_demons: {
    key: 'silithus_demons',
    locationKey: 'silithus',
    name: '其拉的秘密',
    description: '发现了恶魔与异种虫勾结的证据！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 3 }
    ],
    reward: { xp: 280, gold: 140 }
  },
  western_plaguelands_undead: {
    key: 'western_plaguelands_undead',
    locationKey: 'western_plaguelands',
    name: '通灵学院的亡灵',
    description: '通灵学院的亡灵正在向外扩散！',
    objectives: [
      { type: 'kill', enemyKey: 'undead', target: 6 }
    ],
    reward: { xp: 220, gold: 110 }
  },
  western_plaguelands_ghouls: {
    key: 'western_plaguelands_ghouls',
    locationKey: 'western_plaguelands',
    name: '食尸鬼潮',
    description: '大量食尸鬼涌出墓地！',
    objectives: [
      { type: 'kill', enemyKey: 'ghoul', target: 5 }
    ],
    reward: { xp: 210, gold: 105 }
  },
  loch_modan_kobolds: {
    key: 'loch_modan_kobolds',
    locationKey: 'loch_modan',
    name: '狗头人矿洞',
    description: '狗头人占据了洛克莫丹的矿洞！',
    objectives: [
      { type: 'kill', enemyKey: 'kobold', target: 6 }
    ],
    reward: { xp: 80, gold: 40 }
  },
  loch_modan_spiders: {
    key: 'loch_modan_spiders',
    locationKey: 'loch_modan',
    name: '洞穴蜘蛛',
    description: '巨型蜘蛛在洞穴中结网！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 4 }
    ],
    reward: { xp: 90, gold: 45 }
  },
  wetlands_murlocs: {
    key: 'wetlands_murlocs',
    locationKey: 'wetlands',
    name: '沼泽鱼人',
    description: '鱼人在湿地的沼泽中泛滥！',
    objectives: [
      { type: 'kill', enemyKey: 'murloc', target: 6 }
    ],
    reward: { xp: 110, gold: 55 }
  },
  wetlands_trolls: {
    key: 'wetlands_trolls',
    locationKey: 'wetlands',
    name: '沼泽巨魔',
    description: '巨魔潜伏在湿地深处！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 3 }
    ],
    reward: { xp: 130, gold: 65 }
  },
  arathi_orcs: {
    key: 'arathi_orcs',
    locationKey: 'arathi',
    name: '阿拉希兽人',
    description: '兽人在阿拉希高地活动！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 5 }
    ],
    reward: { xp: 170, gold: 85 }
  },
  arathi_trolls: {
    key: 'arathi_trolls',
    locationKey: 'arathi',
    name: '巨魔遗迹',
    description: '古老的巨魔遗迹中仍有巨魔出没！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 4 }
    ],
    reward: { xp: 180, gold: 90 }
  },
  hillsbrad_orcs: {
    key: 'hillsbrad_orcs',
    locationKey: 'hillsbrad',
    name: '兽人斥候',
    description: '兽人斥候正在刺探情报！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 4 }
    ],
    reward: { xp: 120, gold: 60 }
  },
  hillsbrad_bandits: {
    key: 'hillsbrad_bandits',
    locationKey: 'hillsbrad',
    name: '丘陵强盗',
    description: '强盗在希尔斯布莱德丘陵横行！',
    objectives: [
      { type: 'kill', enemyKey: 'bandit', target: 5 }
    ],
    reward: { xp: 130, gold: 65 }
  },
  deadwind_demons: {
    key: 'deadwind_demons',
    locationKey: 'deadwind',
    name: '卡拉赞的恶魔',
    description: '卡拉赞周围出现了恶魔！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 4 }
    ],
    reward: { xp: 250, gold: 125 }
  },
  deadwind_undead: {
    key: 'deadwind_undead',
    locationKey: 'deadwind',
    name: '徘徊的亡灵',
    description: '亡灵在逆风小径徘徊！',
    objectives: [
      { type: 'kill', enemyKey: 'undead', target: 5 }
    ],
    reward: { xp: 240, gold: 120 }
  },
  burning_steppes_orcs: {
    key: 'burning_steppes_orcs',
    locationKey: 'burning_steppes',
    name: '黑石兽人',
    description: '黑石兽人在燃烧平原活动！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 5 }
    ],
    reward: { xp: 260, gold: 130 }
  },
  burning_steppes_dragons: {
    key: 'burning_steppes_dragons',
    locationKey: 'burning_steppes',
    name: '红龙幼崽',
    description: '红龙幼崽在燃烧平原出没！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 3 }
    ],
    reward: { xp: 280, gold: 140 }
  },
  searing_gorge_elementals: {
    key: 'searing_gorge_elementals',
    locationKey: 'searing_gorge',
    name: '火焰元素',
    description: '火焰元素从熔岩中涌出！',
    objectives: [
      { type: 'kill', enemyKey: 'elemental', target: 5 }
    ],
    reward: { xp: 220, gold: 110 }
  },
  searing_gorge_spiders: {
    key: 'searing_gorge_spiders',
    locationKey: 'searing_gorge',
    name: '熔岩蜘蛛',
    description: '蜘蛛在灼热峡谷的岩石间筑巢！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 4 }
    ],
    reward: { xp: 210, gold: 105 }
  },
  badlands_elementals: {
    key: 'badlands_elementals',
    locationKey: 'badlands',
    name: '土元素',
    description: '土元素在荒芜之地苏醒！',
    objectives: [
      { type: 'kill', enemyKey: 'elemental', target: 5 }
    ],
    reward: { xp: 200, gold: 100 }
  },
  badlands_ogres: {
    key: 'badlands_ogres',
    locationKey: 'badlands',
    name: '食人魔营地',
    description: '食人魔在荒芜之地建立了营地！',
    objectives: [
      { type: 'kill', enemyKey: 'ogre', target: 3 }
    ],
    reward: { xp: 210, gold: 105 }
  },
  swamp_of_sorrows_murlocs: {
    key: 'swamp_of_sorrows_murlocs',
    locationKey: 'swamp_of_sorrows',
    name: '沼泽鱼人',
    description: '鱼人在悲伤沼泽中繁衍！',
    objectives: [
      { type: 'kill', enemyKey: 'murloc', target: 6 }
    ],
    reward: { xp: 140, gold: 70 }
  },
  swamp_of_sorrows_trolls: {
    key: 'swamp_of_sorrows_trolls',
    locationKey: 'swamp_of_sorrows',
    name: '神庙巨魔',
    description: '巨魔守卫着古老的神庙！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 4 }
    ],
    reward: { xp: 160, gold: 80 }
  },
  blasted_lands_demons: {
    key: 'blasted_lands_demons',
    locationKey: 'blasted_lands',
    name: '黑暗之门的恶魔',
    description: '恶魔从黑暗之门涌出！',
    objectives: [
      { type: 'kill', enemyKey: 'demon', target: 4 }
    ],
    reward: { xp: 300, gold: 150 }
  },
  blasted_lands_dragons: {
    key: 'blasted_lands_dragons',
    locationKey: 'blasted_lands',
    name: '黑龙幼崽',
    description: '黑龙幼崽在诅咒之地游荡！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 3 }
    ],
    reward: { xp: 320, gold: 160 }
  },
  hinterlands_trolls: {
    key: 'hinterlands_trolls',
    locationKey: 'hinterlands',
    name: '辛萨罗巨魔',
    description: '巨魔在辛特兰的高山上建立了城市！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 5 }
    ],
    reward: { xp: 200, gold: 100 }
  },
  hinterlands_wolves: {
    key: 'hinterlands_wolves',
    locationKey: 'hinterlands',
    name: '巨狼威胁',
    description: '巨狼在辛特兰的森林中游荡！',
    objectives: [
      { type: 'kill', enemyKey: 'wolf', target: 6 }
    ],
    reward: { xp: 190, gold: 95 }
  },
  zuldrak_vrykul: {
    key: 'zuldrak_vrykul',
    locationKey: 'zuldrak',
    name: '维库人战士',
    description: '维库人在祖达克巡逻！',
    objectives: [
      { type: 'kill', enemyKey: 'vrykul', target: 5 }
    ],
    reward: { xp: 260, gold: 130 }
  },
  zuldrak_undead: {
    key: 'zuldrak_undead',
    locationKey: 'zuldrak',
    name: '亡灵天灾',
    description: '亡灵正在入侵祖达克！',
    objectives: [
      { type: 'kill', enemyKey: 'undead', target: 6 }
    ],
    reward: { xp: 270, gold: 135 }
  },
  howling_fjord_vrykul: {
    key: 'howling_fjord_vrykul',
    locationKey: 'howling_fjord',
    name: '乌特加德维库人',
    description: '维库人从乌特加德要塞出击！',
    objectives: [
      { type: 'kill', enemyKey: 'vrykul', target: 5 }
    ],
    reward: { xp: 230, gold: 115 }
  },
  howling_fjord_trolls: {
    key: 'howling_fjord_trolls',
    locationKey: 'howling_fjord',
    name: '冰巨魔',
    description: '冰巨魔在峡湾中活动！',
    objectives: [
      { type: 'kill', enemyKey: 'troll', target: 4 }
    ],
    reward: { xp: 240, gold: 120 }
  },
  dragonblight_dragons: {
    key: 'dragonblight_dragons',
    locationKey: 'dragonblight',
    name: '龙眠神殿',
    description: '与龙眠神殿的幼崽交流（战斗）！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 3 }
    ],
    reward: { xp: 300, gold: 150 }
  },
  dragonblight_undead: {
    key: 'dragonblight_undead',
    locationKey: 'dragonblight',
    name: '天灾入侵',
    description: '亡灵天灾正在亵渎巨龙的安息之地！',
    objectives: [
      { type: 'kill', enemyKey: 'undead', target: 6 }
    ],
    reward: { xp: 290, gold: 145 }
  },
  grizzly_hills_bears: {
    key: 'grizzly_hills_bears',
    locationKey: 'grizzly_hills',
    name: '灰熊之王',
    description: '灰熊在丘陵中称霸！',
    objectives: [
      { type: 'kill', enemyKey: 'bear', target: 5 }
    ],
    reward: { xp: 240, gold: 120 }
  },
  grizzly_hills_orcs: {
    key: 'grizzly_hills_orcs',
    locationKey: 'grizzly_hills',
    name: '兽人斥候',
    description: '兽人在灰熊丘陵活动！',
    objectives: [
      { type: 'kill', enemyKey: 'orc', target: 4 }
    ],
    reward: { xp: 250, gold: 125 }
  },
  sholazar_tigers: {
    key: 'sholazar_tigers',
    locationKey: 'sholazar',
    name: '丛林猛虎',
    description: '猛虎在索拉查盆地的丛林中捕猎！',
    objectives: [
      { type: 'kill', enemyKey: 'tiger', target: 4 }
    ],
    reward: { xp: 260, gold: 130 }
  },
  sholazar_spiders: {
    key: 'sholazar_spiders',
    locationKey: 'sholazar',
    name: '巨型蜘蛛',
    description: '巨型蜘蛛在丛林中结网！',
    objectives: [
      { type: 'kill', enemyKey: 'spider', target: 5 }
    ],
    reward: { xp: 250, gold: 125 }
  },
  crystal_song_elementals: {
    key: 'crystal_song_elementals',
    locationKey: 'crystal_song',
    name: '水晶元素',
    description: '水晶元素在晶歌森林中苏醒！',
    objectives: [
      { type: 'kill', enemyKey: 'elemental', target: 5 }
    ],
    reward: { xp: 300, gold: 150 }
  },
  crystal_song_dragons: {
    key: 'crystal_song_dragons',
    locationKey: 'crystal_song',
    name: '蓝龙军团',
    description: '蓝龙在晶歌森林上空巡逻！',
    objectives: [
      { type: 'kill', enemyKey: 'dragon_whelp', target: 3 }
    ],
    reward: { xp: 320, gold: 160 }
  }
}
