import type { EnemyData } from '../types'

export const ENEMIES: Record<string, EnemyData> = {
  goblin: {
    name: '豺狼人',
    icon: '👺',
    hp: 25,
    damage: [4, 8],
    xp: 15,
    gold: 5,
    dangerLevel: '普通'
  },
  kobold: {
    name: '狗头人',
    icon: '🐀',
    hp: 20,
    damage: [3, 6],
    xp: 12,
    gold: 3,
    dangerLevel: '普通'
  },
  murloc: {
    name: '鱼人',
    icon: '🐟',
    hp: 22,
    damage: [4, 7],
    xp: 14,
    gold: 4,
    dangerLevel: '普通'
  },
  skeleton: {
    name: '骷髅',
    icon: '💀',
    hp: 30,
    damage: [5, 10],
    xp: 20,
    gold: 8,
    dangerLevel: '普通'
  },
  orc: {
    name: '兽人战士',
    icon: '👹',
    hp: 45,
    damage: [8, 15],
    xp: 35,
    gold: 15,
    dangerLevel: '困难'
  },
  spider: {
    name: '剧毒蜘蛛',
    icon: '🕷️',
    hp: 35,
    damage: [6, 12],
    xp: 25,
    gold: 10,
    dangerLevel: '普通'
  },
  bandit: {
    name: '迪菲亚强盗',
    icon: '🗡️',
    hp: 40,
    damage: [7, 14],
    xp: 30,
    gold: 20,
    dangerLevel: '困难'
  },
  troll: {
    name: '丛林巨魔',
    icon: '🧌',
    hp: 80,
    damage: [12, 20],
    xp: 60,
    gold: 30,
    dangerLevel: '危险'
  },
  dragon_whelp: {
    name: '幼龙',
    icon: '🐉',
    hp: 120,
    damage: [15, 30],
    xp: 100,
    gold: 50,
    dangerLevel: '极危险'
  },
  demon: {
    name: '恶魔卫士',
    icon: '👿',
    hp: 150,
    damage: [20, 35],
    xp: 150,
    gold: 75,
    dangerLevel: '致命'
  },
  wolf: {
    name: '灰狼',
    icon: '🐺',
    hp: 28,
    damage: [5, 9],
    xp: 18,
    gold: 6,
    dangerLevel: '普通'
  },
  ghoul: {
    name: '食尸鬼',
    icon: '🧟',
    hp: 32,
    damage: [6, 11],
    xp: 22,
    gold: 9,
    dangerLevel: '普通'
  },
  frostwyrm: {
    name: '冰霜巨龙',
    icon: '🐲',
    hp: 130,
    damage: [16, 32],
    xp: 110,
    gold: 55,
    dangerLevel: '极危险'
  },
  iron_dwarf: {
    name: '铁矮人',
    icon: '⚒️',
    hp: 70,
    damage: [10, 18],
    xp: 55,
    gold: 28,
    dangerLevel: '危险'
  },
  elemental: {
    name: '元素生物',
    icon: '🔮',
    hp: 65,
    damage: [9, 16],
    xp: 50,
    gold: 25,
    dangerLevel: '危险'
  },
  nerubian: {
    name: '蛛魔',
    icon: '🕸️',
    hp: 75,
    damage: [11, 19],
    xp: 58,
    gold: 29,
    dangerLevel: '危险'
  },
  vrykul: {
    name: '维库人',
    icon: '⚔️',
    hp: 78,
    damage: [11, 18],
    xp: 56,
    gold: 27,
    dangerLevel: '危险'
  },
  undead: {
    name: '亡灵',
    icon: '💀',
    hp: 35,
    damage: [7, 13],
    xp: 28,
    gold: 12,
    dangerLevel: '普通'
  },
  bear: {
    name: '棕熊',
    icon: '🐻',
    hp: 50,
    damage: [8, 14],
    xp: 32,
    gold: 12,
    dangerLevel: '困难'
  },
  boar: {
    name: '野猪',
    icon: '🐗',
    hp: 38,
    damage: [6, 12],
    xp: 26,
    gold: 8,
    dangerLevel: '普通'
  },
  centaur: {
    name: '半人马',
    icon: '🏇',
    hp: 60,
    damage: [9, 16],
    xp: 45,
    gold: 20,
    dangerLevel: '困难'
  },
  harpy: {
    name: '鹰身人',
    icon: '🦅',
    hp: 42,
    damage: [7, 13],
    xp: 33,
    gold: 16,
    dangerLevel: '困难'
  },
  naga: {
    name: '纳迦',
    icon: '🐍',
    hp: 85,
    damage: [11, 19],
    xp: 65,
    gold: 35,
    dangerLevel: '危险'
  },
  ogre: {
    name: '食人魔',
    icon: '👹',
    hp: 90,
    damage: [13, 22],
    xp: 70,
    gold: 40,
    dangerLevel: '危险'
  },
  quilboar: {
    name: '野猪人',
    icon: '🐗',
    hp: 48,
    damage: [8, 15],
    xp: 38,
    gold: 18,
    dangerLevel: '困难'
  },
  scorpid: {
    name: '蝎子',
    icon: '🦂',
    hp: 36,
    damage: [7, 12],
    xp: 27,
    gold: 11,
    dangerLevel: '普通'
  },
  silithid: {
    name: '异种虫',
    icon: '🦗',
    hp: 95,
    damage: [14, 24],
    xp: 75,
    gold: 45,
    dangerLevel: '危险'
  },
  gnoll: {
    name: '豺狼人',
    icon: '🐺',
    hp: 33,
    damage: [6, 11],
    xp: 24,
    gold: 10,
    dangerLevel: '普通'
  },
  undead_knight: {
    name: '死亡骑士',
    icon: '⚔️',
    hp: 110,
    damage: [14, 26],
    xp: 90,
    gold: 50,
    dangerLevel: '极危险'
  },
  lich: {
    name: '巫妖',
    icon: '💀',
    hp: 140,
    damage: [18, 32],
    xp: 120,
    gold: 65,
    dangerLevel: '极危险'
  },
  frost_giant: {
    name: '冰霜巨人',
    icon: '🧊',
    hp: 160,
    damage: [20, 38],
    xp: 160,
    gold: 80,
    dangerLevel: '致命'
  },
  tiger: {
    name: '猛虎',
    icon: '🐅',
    hp: 75,
    damage: [12, 22],
    xp: 55,
    gold: 25,
    dangerLevel: '危险'
  },
  dwarf: {
    name: '黑铁矮人',
    icon: '⚒️',
    hp: 65,
    damage: [10, 18],
    xp: 48,
    gold: 22,
    dangerLevel: '困难'
  }
}
