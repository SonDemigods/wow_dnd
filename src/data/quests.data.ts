/**
 * @fileoverview 游戏任务数据模块
 * @description 包含所有可接任务的详细信息，包括任务目标和奖励
 * @module data/quests
 */

import type { QuestDefinition } from '../types';

export const QUESTS: Record<string, QuestDefinition> = {
  teldrassil_defense: {
    id: 'teldrassil_defense',
    title: '泰达希尔的守卫',
    description: '暗影森林深处有蜘蛛巢穴正在向外扩张，需要清剿它们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死5只蜘蛛',
        target: 5,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 1,
    xpReward: 80,
    goldReward: 40,
    boardId: 'teldrassil'
  },
  teldrassil_goblins: {
    id: 'teldrassil_goblins',
    title: '森林强盗',
    description: '豺狼人在森林边缘袭击过路的旅行者，快去教训他们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_goblin',
        type: 'kill',
        description: '杀死4只豺狼人',
        target: 4,
        enemyId: 'goblin'
      }
    ],
    levelRequirement: 1,
    xpReward: 100,
    goldReward: 50,
    boardId: 'teldrassil'
  },
  azuremyst_spiders: {
    id: 'azuremyst_spiders',
    title: '蜘蛛入侵',
    description: '大量蜘蛛从洞穴中涌出，威胁着秘蓝岛的安全！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死6只蜘蛛',
        target: 6,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'azuremyst'
  },
  azuremyst_goblins: {
    id: 'azuremyst_goblins',
    title: '强盗窝点',
    description: '豺狼人在秘蓝岛建立了临时据点，必须将其驱散！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_goblin',
        type: 'kill',
        description: '杀死3只豺狼人',
        target: 3,
        enemyId: 'goblin'
      }
    ],
    levelRequirement: 1,
    xpReward: 50,
    goldReward: 25,
    boardId: 'azuremyst'
  },
  ashenvale_orcs: {
    id: 'ashenvale_orcs',
    title: '兽人入侵',
    description: '战歌氏族的兽人正在灰谷疯狂砍伐森林，前去阻止他们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死5只兽人',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 5,
    xpReward: 120,
    goldReward: 60,
    boardId: 'ashenvale'
  },
  ashenvale_spiders: {
    id: 'ashenvale_spiders',
    title: '毒蛛清剿',
    description: '森林深处的巨型毒蛛对居民造成了巨大威胁！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死4只毒蛛',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 5,
    xpReward: 100,
    goldReward: 50,
    boardId: 'ashenvale'
  },
  elwynn_goblins: {
    id: 'elwynn_goblins',
    title: '豺狼之灾',
    description: '艾尔文森林的豺狼人越来越猖獗，威胁着农场的安全！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_goblin',
        type: 'kill',
        description: '杀死4只豺狼人',
        target: 4,
        enemyId: 'goblin'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'elwynn'
  },
  elwynn_bandits: {
    id: 'elwynn_bandits',
    title: '打击盗匪',
    description: '一群盗匪在森林边缘活动，快去为民除害！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bandit',
        type: 'kill',
        description: '杀死3名盗匪',
        target: 3,
        enemyId: 'bandit'
      }
    ],
    levelRequirement: 1,
    xpReward: 50,
    goldReward: 25,
    boardId: 'elwynn'
  },
  westfall_bandits: {
    id: 'westfall_bandits',
    title: '西部荒野的强盗',
    description: '迪菲亚兄弟会在西部荒野横行霸道，必须将其绳之以法！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bandit',
        type: 'kill',
        description: '杀死5名强盗',
        target: 5,
        enemyId: 'bandit'
      }
    ],
    levelRequirement: 3,
    xpReward: 80,
    goldReward: 40,
    boardId: 'westfall'
  },
  westfall_skeletons: {
    id: 'westfall_skeletons',
    title: '闹鬼的农场',
    description: '月溪镇附近的农场出现了亡灵，快去调查！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死3只骷髅',
        target: 3,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 3,
    xpReward: 70,
    goldReward: 35,
    boardId: 'westfall'
  },
  redridge_orcs: {
    id: 'redridge_orcs',
    title: '黑石兽人的威胁',
    description: '黑石部落的兽人正在赤脊山集结，准备入侵！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死4只兽人',
        target: 4,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 5,
    xpReward: 100,
    goldReward: 50,
    boardId: 'redridge'
  },
  redridge_spiders: {
    id: 'redridge_spiders',
    title: '峡谷蜘蛛',
    description: '赤脊峡谷中的巨型蜘蛛开始攻击过往的旅人！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死3只蜘蛛',
        target: 3,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 5,
    xpReward: 90,
    goldReward: 45,
    boardId: 'redridge'
  },
  duskwood_skeletons: {
    id: 'duskwood_skeletons',
    title: '墓地的亡灵',
    description: '夜色镇的墓地正在遭受亡灵的侵扰，需要有人去处理！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死6只骷髅',
        target: 6,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 8,
    xpReward: 120,
    goldReward: 60,
    boardId: 'duskwood'
  },
  duskwood_spiders: {
    id: 'duskwood_spiders',
    title: '森林毒蛛',
    description: '暮色森林中的蜘蛛比其他地方的更加危险！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死4只毒蛛',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 8,
    xpReward: 110,
    goldReward: 55,
    boardId: 'duskwood'
  },
  silverpine_skeletons: {
    id: 'silverpine_skeletons',
    title: '被遗忘者的威胁',
    description: '银松森林中游荡着大量亡灵，需要被清理！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死5只骷髅',
        target: 5,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 8,
    xpReward: 130,
    goldReward: 65,
    boardId: 'silverpine'
  },
  silverpine_wolves: {
    id: 'silverpine_wolves',
    title: '疯狼之灾',
    description: '森林中的狼群变得异常凶猛，威胁着过往旅人！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_wolf',
        type: 'kill',
        description: '杀死4只狼',
        target: 4,
        enemyId: 'wolf'
      }
    ],
    levelRequirement: 8,
    xpReward: 120,
    goldReward: 60,
    boardId: 'silverpine'
  },
  tirisfal_skeletons: {
    id: 'tirisfal_skeletons',
    title: '亡灵的起源',
    description: '提瑞斯法林地的亡灵需要被净化！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死4只骷髅',
        target: 4,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 1,
    xpReward: 50,
    goldReward: 25,
    boardId: 'tirisfal'
  },
  tirisfal_ghouls: {
    id: 'tirisfal_ghouls',
    title: '食尸鬼之患',
    description: '大量食尸鬼在坟墓间游荡，快去消灭它们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_ghoul',
        type: 'kill',
        description: '杀死3只食尸鬼',
        target: 3,
        enemyId: 'ghoul'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'tirisfal'
  },
  plaguelands_skeletons: {
    id: 'plaguelands_skeletons',
    title: '天灾军团',
    description: '瘟疫之地的亡灵必须被彻底消灭！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死5只骷髅',
        target: 5,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 15,
    xpReward: 250,
    goldReward: 120,
    boardId: 'plaguelands'
  },
  plaguelands_demons: {
    id: 'plaguelands_demons',
    title: '燃烧军团的先锋',
    description: '恶魔在瘟疫之地横行，必须将其驱逐！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死3只恶魔',
        target: 3,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 15,
    xpReward: 280,
    goldReward: 140,
    boardId: 'plaguelands'
  },
  stranglethorn_trolls: {
    id: 'stranglethorn_trolls',
    title: '血顶巨魔',
    description: '血顶巨魔部落正在荆棘谷进行疯狂的劫掠！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死4只巨魔',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 10,
    xpReward: 150,
    goldReward: 75,
    boardId: 'stranglethorn'
  },
  stranglethorn_orcs: {
    id: 'stranglethorn_orcs',
    title: '风险投资公司',
    description: '风险投资公司的兽人在丛林中掠夺资源！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死3只兽人',
        target: 3,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 10,
    xpReward: 160,
    goldReward: 80,
    boardId: 'stranglethorn'
  },
  stonetalon_orcs: {
    id: 'stonetalon_orcs',
    title: '石爪要塞',
    description: '石爪山脉中的兽人据点需要被拔除！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死5只兽人',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 8,
    xpReward: 140,
    goldReward: 70,
    boardId: 'stonetalon'
  },
  stonetalon_spiders: {
    id: 'stonetalon_spiders',
    title: '洞穴毒蛛',
    description: '石爪山脉的洞穴中充满了危险的蜘蛛！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死4只蜘蛛',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 8,
    xpReward: 130,
    goldReward: 65,
    boardId: 'stonetalon'
  },
  deserts_trolls: {
    id: 'deserts_trolls',
    title: '沙怒巨魔',
    description: '沙怒巨魔在沙漠中袭击商队，必须被阻止！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死4只巨魔',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 12,
    xpReward: 180,
    goldReward: 90,
    boardId: 'deserts'
  },
  deserts_skeletons: {
    id: 'deserts_skeletons',
    title: '祖尔法拉克的亡灵',
    description: '古老的巨魔墓穴中出现了亡灵！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死5只骷髅',
        target: 5,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 12,
    xpReward: 170,
    goldReward: 85,
    boardId: 'deserts'
  },
  feralas_trolls: {
    id: 'feralas_trolls',
    title: '暗矛巨魔',
    description: '菲拉斯的森林深处有暗矛巨魔的活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死5只巨魔',
        target: 5,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 14,
    xpReward: 200,
    goldReward: 100,
    boardId: 'feralas'
  },
  feralas_dragons: {
    id: 'feralas_dragons',
    title: '龙的领地',
    description: '幼龙在菲拉斯出没，这是勇士的试炼！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死2只幼龙',
        target: 2,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 14,
    xpReward: 250,
    goldReward: 125,
    boardId: 'feralas'
  },
  borean_tundra_trolls: {
    id: 'borean_tundra_trolls',
    title: '冰雪巨魔',
    description: '冰雪巨魔在苔原上游荡，威胁着远征军的安全！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死5只巨魔',
        target: 5,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 18,
    xpReward: 300,
    goldReward: 150,
    boardId: 'borean_tundra'
  },
  borean_tundra_nerubians: {
    id: 'borean_tundra_nerubians',
    title: '蛛魔入侵',
    description: '蛛魔从地下涌出，必须将其击退！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_nerubian',
        type: 'kill',
        description: '杀死4只蛛魔',
        target: 4,
        enemyId: 'nerubian'
      }
    ],
    levelRequirement: 18,
    xpReward: 320,
    goldReward: 160,
    boardId: 'borean_tundra'
  },
  storm_peaks_dwarves: {
    id: 'storm_peaks_dwarves',
    title: '铁矮人的威胁',
    description: '铁矮人正在风暴峭壁进行秘密活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dwarf',
        type: 'kill',
        description: '杀死5只铁矮人',
        target: 5,
        enemyId: 'iron_dwarf'
      }
    ],
    levelRequirement: 20,
    xpReward: 350,
    goldReward: 175,
    boardId: 'storm_peaks'
  },
  storm_peaks_elementals: {
    id: 'storm_peaks_elementals',
    title: '元素暴动',
    description: '风暴元素变得异常狂暴！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        description: '杀死4只元素',
        target: 4,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 20,
    xpReward: 340,
    goldReward: 170,
    boardId: 'storm_peaks'
  },
  icecrown_demons: {
    id: 'icecrown_demons',
    title: '巫妖王的仆从',
    description: '大量恶魔在冰冠冰川聚集，必须阻止他们的阴谋！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死6只恶魔',
        target: 6,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 20,
    xpReward: 500,
    goldReward: 250,
    boardId: 'icecrown'
  },
  icecrown_undead: {
    id: 'icecrown_undead',
    title: '天灾军团的末日',
    description: '给予亡灵天灾最后的一击！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        description: '杀死5只亡灵',
        target: 5,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 20,
    xpReward: 480,
    goldReward: 240,
    boardId: 'icecrown'
  },
  darkshore_murlocs: {
    id: 'darkshore_murlocs',
    title: '鱼人侵扰',
    description: '鱼人正在黑海岸的海滩上作乱！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_murloc',
        type: 'kill',
        description: '杀死6只鱼人',
        target: 6,
        enemyId: 'murloc'
      }
    ],
    levelRequirement: 2,
    xpReward: 70,
    goldReward: 35,
    boardId: 'darkshore'
  },
  darkshore_bears: {
    id: 'darkshore_bears',
    title: '狂野之熊',
    description: '凶猛的熊威胁着黑海岸的旅者安全！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bear',
        type: 'kill',
        description: '杀死4只熊',
        target: 4,
        enemyId: 'bear'
      }
    ],
    levelRequirement: 2,
    xpReward: 80,
    goldReward: 40,
    boardId: 'darkshore'
  },
  darkshore_gnolls: {
    id: 'darkshore_gnolls',
    title: '豺狼人袭击',
    description: '豺狼人正在袭击沿海的营地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_gnoll',
        type: 'kill',
        description: '杀死5只豺狼人',
        target: 5,
        enemyId: 'gnoll'
      }
    ],
    levelRequirement: 2,
    xpReward: 75,
    goldReward: 38,
    boardId: 'darkshore'
  },
  bloodmyst_elementals: {
    id: 'bloodmyst_elementals',
    title: '元素暴动',
    description: '元素生物在秘血岛肆虐！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        description: '杀死5只元素',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 3,
    xpReward: 90,
    goldReward: 45,
    boardId: 'bloodmyst'
  },
  bloodmyst_demons: {
    id: 'bloodmyst_demons',
    title: '恶魔踪迹',
    description: '发现恶魔的踪迹，必须消灭他们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死2只恶魔',
        target: 2,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 3,
    xpReward: 100,
    goldReward: 50,
    boardId: 'bloodmyst'
  },
  winterspring_elementals: {
    id: 'winterspring_elementals',
    title: '寒冰元素',
    description: '冰霜元素正在冬泉谷狂暴！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        description: '杀死5只元素',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 14,
    xpReward: 200,
    goldReward: 100,
    boardId: 'winterspring'
  },
  winterspring_demons: {
    id: 'winterspring_demons',
    title: '恶魔威胁',
    description: '恶魔潜入了冬泉谷，必须驱逐他们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死3只恶魔',
        target: 3,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 14,
    xpReward: 220,
    goldReward: 110,
    boardId: 'winterspring'
  },
  winterspring_dragons: {
    id: 'winterspring_dragons',
    title: '蓝龙幼崽',
    description: '蓝龙幼崽需要被击败以证明你的勇气！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死2只幼龙',
        target: 2,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 14,
    xpReward: 230,
    goldReward: 115,
    boardId: 'winterspring'
  },
  hyjal_demons: {
    id: 'hyjal_demons',
    title: '燃烧军团残党',
    description: '燃烧军团的余孽仍在海加尔山活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死4只恶魔',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 16,
    xpReward: 280,
    goldReward: 140,
    boardId: 'hyjal'
  },
  hyjal_dragons: {
    id: 'hyjal_dragons',
    title: '守护巨龙',
    description: '与守护巨龙的幼崽战斗以获得认可！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死3只幼龙',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 16,
    xpReward: 300,
    goldReward: 150,
    boardId: 'hyjal'
  },
  felwood_demons: {
    id: 'felwood_demons',
    title: '恶魔腐化',
    description: '清除费伍德森林中的恶魔！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死4只恶魔',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 12,
    xpReward: 180,
    goldReward: 90,
    boardId: 'felwood'
  },
  felwood_trolls: {
    id: 'felwood_trolls',
    title: '森林巨魔',
    description: '巨魔在费伍德森林作乱！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死3只巨魔',
        target: 3,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 12,
    xpReward: 170,
    goldReward: 85,
    boardId: 'felwood'
  },
  desolace_centaurs: {
    id: 'desolace_centaurs',
    title: '半人马冲突',
    description: '半人马部落正在互相争斗，需要调停！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_centaur',
        type: 'kill',
        description: '杀死5只半人马',
        target: 5,
        enemyId: 'centaur'
      }
    ],
    levelRequirement: 10,
    xpReward: 190,
    goldReward: 95,
    boardId: 'desolace'
  },
  desolace_skeletons: {
    id: 'desolace_skeletons',
    title: '亡灵遗迹',
    description: '古老的遗迹中出现了亡灵！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        description: '杀死6只骷髅',
        target: 6,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 10,
    xpReward: 180,
    goldReward: 90,
    boardId: 'desolace'
  },
  durotar_boars: {
    id: 'durotar_boars',
    title: '野猪威胁',
    description: '野猪正在破坏杜隆塔尔的农田！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_boar',
        type: 'kill',
        description: '杀死6只野猪',
        target: 6,
        enemyId: 'boar'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'durotar'
  },
  durotar_quilboars: {
    id: 'durotar_quilboars',
    title: '野猪人入侵',
    description: '野猪人正在入侵杜隆塔尔！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_quilboar',
        type: 'kill',
        description: '杀死4只野猪人',
        target: 4,
        enemyId: 'quilboar'
      }
    ],
    levelRequirement: 1,
    xpReward: 70,
    goldReward: 35,
    boardId: 'durotar'
  },
  mulgore_wolves: {
    id: 'mulgore_wolves',
    title: '狼群威胁',
    description: '灰狼正在莫高雷游荡！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_wolf',
        type: 'kill',
        description: '杀死5只狼',
        target: 5,
        enemyId: 'wolf'
      }
    ],
    levelRequirement: 1,
    xpReward: 55,
    goldReward: 28,
    boardId: 'mulgore'
  },
  mulgore_bears: {
    id: 'mulgore_bears',
    title: '熊之领地',
    description: '棕熊占据了莫高雷的部分地区！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bear',
        type: 'kill',
        description: '杀死4只熊',
        target: 4,
        enemyId: 'bear'
      }
    ],
    levelRequirement: 1,
    xpReward: 65,
    goldReward: 32,
    boardId: 'mulgore'
  },
  barrens_quilboars: {
    id: 'barrens_quilboars',
    title: '野猪人营地',
    description: '摧毁野猪人的营地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_quilboar',
        type: 'kill',
        description: '杀死5只野猪人',
        target: 5,
        enemyId: 'quilboar'
      }
    ],
    levelRequirement: 5,
    xpReward: 90,
    goldReward: 45,
    boardId: 'barrens'
  },
  barrens_centaurs: {
    id: 'barrens_centaurs',
    title: '半人马掠夺',
    description: '半人马正在掠夺贫瘠之地的商队！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_centaur',
        type: 'kill',
        description: '杀死4只半人马',
        target: 4,
        enemyId: 'centaur'
      }
    ],
    levelRequirement: 5,
    xpReward: 100,
    goldReward: 50,
    boardId: 'barrens'
  },
  thousand_needles_centaurs: {
    id: 'thousand_needles_centaurs',
    title: '千针石林的半人马',
    description: '半人马控制了千针石林的高地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_centaur',
        type: 'kill',
        description: '杀死5只半人马',
        target: 5,
        enemyId: 'centaur'
      }
    ],
    levelRequirement: 10,
    xpReward: 160,
    goldReward: 80,
    boardId: 'thousand_needles'
  },
  thousand_needles_harpies: {
    id: 'thousand_needles_harpies',
    title: '鹰身人巢穴',
    description: '鹰身人在千针石林筑巢！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_harpy',
        type: 'kill',
        description: '杀死4只鹰身人',
        target: 4,
        enemyId: 'harpy'
      }
    ],
    levelRequirement: 10,
    xpReward: 150,
    goldReward: 75,
    boardId: 'thousand_needles'
  },
  silithus_silithids: {
    id: 'silithus_silithids',
    title: '异种虫入侵',
    description: '异种虫正在希利苏斯肆虐！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_silithid',
        type: 'kill',
        description: '杀死4只异种虫',
        target: 4,
        enemyId: 'silithid'
      }
    ],
    levelRequirement: 18,
    xpReward: 260,
    goldReward: 130,
    boardId: 'silithus'
  },
  silithus_demons: {
    id: 'silithus_demons',
    title: '其拉的秘密',
    description: '发现了恶魔与异种虫勾结的证据！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死3只恶魔',
        target: 3,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 18,
    xpReward: 280,
    goldReward: 140,
    boardId: 'silithus'
  },
  western_plaguelands_undead: {
    id: 'western_plaguelands_undead',
    title: '通灵学院的亡灵',
    description: '通灵学院的亡灵正在向外扩散！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        description: '杀死6只亡灵',
        target: 6,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 12,
    xpReward: 220,
    goldReward: 110,
    boardId: 'western_plaguelands'
  },
  western_plaguelands_ghouls: {
    id: 'western_plaguelands_ghouls',
    title: '食尸鬼潮',
    description: '大量食尸鬼涌出墓地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_ghoul',
        type: 'kill',
        description: '杀死5只食尸鬼',
        target: 5,
        enemyId: 'ghoul'
      }
    ],
    levelRequirement: 12,
    xpReward: 210,
    goldReward: 105,
    boardId: 'western_plaguelands'
  },
  loch_modan_kobolds: {
    id: 'loch_modan_kobolds',
    title: '狗头人矿洞',
    description: '狗头人占据了洛克莫丹的矿洞！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_kobold',
        type: 'kill',
        description: '杀死6只狗头人',
        target: 6,
        enemyId: 'kobold'
      }
    ],
    levelRequirement: 3,
    xpReward: 80,
    goldReward: 40,
    boardId: 'loch_modan'
  },
  loch_modan_spiders: {
    id: 'loch_modan_spiders',
    title: '洞穴蜘蛛',
    description: '巨型蜘蛛在洞穴中结网！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死4只蜘蛛',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 3,
    xpReward: 90,
    goldReward: 45,
    boardId: 'loch_modan'
  },
  wetlands_murlocs: {
    id: 'wetlands_murlocs',
    title: '沼泽鱼人',
    description: '鱼人在湿地的沼泽中泛滥！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_murloc',
        type: 'kill',
        description: '杀死6只鱼人',
        target: 6,
        enemyId: 'murloc'
      }
    ],
    levelRequirement: 6,
    xpReward: 110,
    goldReward: 55,
    boardId: 'wetlands'
  },
  wetlands_trolls: {
    id: 'wetlands_trolls',
    title: '沼泽巨魔',
    description: '巨魔潜伏在湿地深处！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死3只巨魔',
        target: 3,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 6,
    xpReward: 130,
    goldReward: 65,
    boardId: 'wetlands'
  },
  arathi_orcs: {
    id: 'arathi_orcs',
    title: '阿拉希兽人',
    description: '兽人在阿拉希高地活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死5只兽人',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 10,
    xpReward: 170,
    goldReward: 85,
    boardId: 'arathi'
  },
  arathi_trolls: {
    id: 'arathi_trolls',
    title: '巨魔遗迹',
    description: '古老的巨魔遗迹中仍有巨魔出没！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死4只巨魔',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 10,
    xpReward: 180,
    goldReward: 90,
    boardId: 'arathi'
  },
  hillsbrad_orcs: {
    id: 'hillsbrad_orcs',
    title: '兽人斥候',
    description: '兽人斥候正在刺探情报！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死4只兽人',
        target: 4,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 6,
    xpReward: 120,
    goldReward: 60,
    boardId: 'hillsbrad'
  },
  hillsbrad_bandits: {
    id: 'hillsbrad_bandits',
    title: '丘陵强盗',
    description: '强盗在希尔斯布莱德丘陵横行！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bandit',
        type: 'kill',
        description: '杀死5名强盗',
        target: 5,
        enemyId: 'bandit'
      }
    ],
    levelRequirement: 6,
    xpReward: 130,
    goldReward: 65,
    boardId: 'hillsbrad'
  },
  deadwind_demons: {
    id: 'deadwind_demons',
    title: '卡拉赞的恶魔',
    description: '卡拉赞周围出现了恶魔！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死4只恶魔',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 16,
    xpReward: 250,
    goldReward: 125,
    boardId: 'deadwind'
  },
  deadwind_undead: {
    id: 'deadwind_undead',
    title: '徘徊的亡灵',
    description: '亡灵在逆风小径徘徊！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        description: '杀死5只亡灵',
        target: 5,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 16,
    xpReward: 240,
    goldReward: 120,
    boardId: 'deadwind'
  },
  burning_steppes_orcs: {
    id: 'burning_steppes_orcs',
    title: '黑石兽人',
    description: '黑石兽人在燃烧平原活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死5只兽人',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 15,
    xpReward: 260,
    goldReward: 130,
    boardId: 'burning_steppes'
  },
  burning_steppes_dragons: {
    id: 'burning_steppes_dragons',
    title: '红龙幼崽',
    description: '红龙幼崽在燃烧平原出没！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死3只幼龙',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 15,
    xpReward: 280,
    goldReward: 140,
    boardId: 'burning_steppes'
  },
  searing_gorge_elementals: {
    id: 'searing_gorge_elementals',
    title: '火焰元素',
    description: '火焰元素从熔岩中涌出！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        description: '杀死5只元素',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 12,
    xpReward: 220,
    goldReward: 110,
    boardId: 'searing_gorge'
  },
  searing_gorge_spiders: {
    id: 'searing_gorge_spiders',
    title: '熔岩蜘蛛',
    description: '蜘蛛在灼热峡谷的岩石间筑巢！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死4只蜘蛛',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 12,
    xpReward: 210,
    goldReward: 105,
    boardId: 'searing_gorge'
  },
  badlands_elementals: {
    id: 'badlands_elementals',
    title: '土元素',
    description: '土元素在荒芜之地苏醒！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        description: '杀死5只元素',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 10,
    xpReward: 200,
    goldReward: 100,
    boardId: 'badlands'
  },
  badlands_ogres: {
    id: 'badlands_ogres',
    title: '食人魔营地',
    description: '食人魔在荒芜之地建立了营地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_ogre',
        type: 'kill',
        description: '杀死3只食人魔',
        target: 3,
        enemyId: 'ogre'
      }
    ],
    levelRequirement: 10,
    xpReward: 210,
    goldReward: 105,
    boardId: 'badlands'
  },
  swamp_of_sorrows_murlocs: {
    id: 'swamp_of_sorrows_murlocs',
    title: '沼泽鱼人',
    description: '鱼人在悲伤沼泽中繁衍！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_murloc',
        type: 'kill',
        description: '杀死6只鱼人',
        target: 6,
        enemyId: 'murloc'
      }
    ],
    levelRequirement: 8,
    xpReward: 140,
    goldReward: 70,
    boardId: 'swamp_of_sorrows'
  },
  swamp_of_sorrows_trolls: {
    id: 'swamp_of_sorrows_trolls',
    title: '神庙巨魔',
    description: '巨魔守卫着古老的神庙！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死4只巨魔',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 8,
    xpReward: 160,
    goldReward: 80,
    boardId: 'swamp_of_sorrows'
  },
  blasted_lands_demons: {
    id: 'blasted_lands_demons',
    title: '黑暗之门的恶魔',
    description: '恶魔从黑暗之门涌出！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        description: '杀死4只恶魔',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 18,
    xpReward: 300,
    goldReward: 150,
    boardId: 'blasted_lands'
  },
  blasted_lands_dragons: {
    id: 'blasted_lands_dragons',
    title: '黑龙幼崽',
    description: '黑龙幼崽在诅咒之地游荡！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死3只幼龙',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 18,
    xpReward: 320,
    goldReward: 160,
    boardId: 'blasted_lands'
  },
  hinterlands_trolls: {
    id: 'hinterlands_trolls',
    title: '辛萨罗巨魔',
    description: '巨魔在辛特兰的高山上建立了城市！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死5只巨魔',
        target: 5,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 12,
    xpReward: 200,
    goldReward: 100,
    boardId: 'hinterlands'
  },
  hinterlands_wolves: {
    id: 'hinterlands_wolves',
    title: '巨狼威胁',
    description: '巨狼在辛特兰的森林中游荡！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_wolf',
        type: 'kill',
        description: '杀死6只狼',
        target: 6,
        enemyId: 'wolf'
      }
    ],
    levelRequirement: 12,
    xpReward: 190,
    goldReward: 95,
    boardId: 'hinterlands'
  },
  zuldrak_vrykul: {
    id: 'zuldrak_vrykul',
    title: '维库人战士',
    description: '维库人在祖达克巡逻！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_vrykul',
        type: 'kill',
        description: '杀死5名维库人',
        target: 5,
        enemyId: 'vrykul'
      }
    ],
    levelRequirement: 18,
    xpReward: 260,
    goldReward: 130,
    boardId: 'zuldrak'
  },
  zuldrak_undead: {
    id: 'zuldrak_undead',
    title: '亡灵天灾',
    description: '亡灵正在入侵祖达克！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        description: '杀死6只亡灵',
        target: 6,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 18,
    xpReward: 270,
    goldReward: 135,
    boardId: 'zuldrak'
  },
  howling_fjord_vrykul: {
    id: 'howling_fjord_vrykul',
    title: '乌特加德维库人',
    description: '维库人从乌特加德要塞出击！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_vrykul',
        type: 'kill',
        description: '杀死5名维库人',
        target: 5,
        enemyId: 'vrykul'
      }
    ],
    levelRequirement: 16,
    xpReward: 230,
    goldReward: 115,
    boardId: 'howling_fjord'
  },
  howling_fjord_trolls: {
    id: 'howling_fjord_trolls',
    title: '冰巨魔',
    description: '冰巨魔在峡湾中活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        description: '杀死4只巨魔',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 16,
    xpReward: 240,
    goldReward: 120,
    boardId: 'howling_fjord'
  },
  dragonblight_dragons: {
    id: 'dragonblight_dragons',
    title: '龙眠神殿',
    description: '与龙眠神殿的幼崽交流（战斗）！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死3只幼龙',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 18,
    xpReward: 300,
    goldReward: 150,
    boardId: 'dragonblight'
  },
  dragonblight_undead: {
    id: 'dragonblight_undead',
    title: '天灾入侵',
    description: '亡灵天灾正在亵渎巨龙的安息之地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        description: '杀死6只亡灵',
        target: 6,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 18,
    xpReward: 290,
    goldReward: 145,
    boardId: 'dragonblight'
  },
  grizzly_hills_bears: {
    id: 'grizzly_hills_bears',
    title: '灰熊之王',
    description: '灰熊在丘陵中称霸！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bear',
        type: 'kill',
        description: '杀死5只熊',
        target: 5,
        enemyId: 'bear'
      }
    ],
    levelRequirement: 16,
    xpReward: 240,
    goldReward: 120,
    boardId: 'grizzly_hills'
  },
  grizzly_hills_orcs: {
    id: 'grizzly_hills_orcs',
    title: '兽人斥候',
    description: '兽人在灰熊丘陵活动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        description: '杀死4只兽人',
        target: 4,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 16,
    xpReward: 250,
    goldReward: 125,
    boardId: 'grizzly_hills'
  },
  sholazar_tigers: {
    id: 'sholazar_tigers',
    title: '丛林猛虎',
    description: '猛虎在索拉查盆地的丛林中捕猎！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_tiger',
        type: 'kill',
        description: '杀死4只猛虎',
        target: 4,
        enemyId: 'tiger'
      }
    ],
    levelRequirement: 18,
    xpReward: 260,
    goldReward: 130,
    boardId: 'sholazar'
  },
  sholazar_spiders: {
    id: 'sholazar_spiders',
    title: '巨型蜘蛛',
    description: '巨型蜘蛛在丛林中结网！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        description: '杀死5只蜘蛛',
        target: 5,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 18,
    xpReward: 250,
    goldReward: 125,
    boardId: 'sholazar'
  },
  crystal_song_elementals: {
    id: 'crystal_song_elementals',
    title: '水晶元素',
    description: '水晶元素在晶歌森林中苏醒！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        description: '杀死5只元素',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 20,
    xpReward: 300,
    goldReward: 150,
    boardId: 'crystal_song'
  },
  crystal_song_dragons: {
    id: 'crystal_song_dragons',
    title: '蓝龙军团',
    description: '蓝龙在晶歌森林上空巡逻！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        description: '杀死3只幼龙',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 20,
    xpReward: 320,
    goldReward: 160,
    boardId: 'crystal_song'
  }
};
