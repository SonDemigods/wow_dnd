/**
 * @fileoverview 种族和阵营数据定义文件
 * @description 包含游戏中所有可选择的阵营和种族信息，包括属性加成、图标和描述
 * @module data/race
 */

// 导入类型定义
import type { FactionData, RaceData } from '@/modules/character/types';

/**
 * 阵营数据定义
 * 包含联盟和部落两大阵营的基本信息
 */
export const FACTIONS: Record<string, FactionData> = {
  alliance: {
    id: 'alliance',
    name: '联盟',
    icon: '🛡️',
    color: '#0078ff',
    description: '人类、矮人、侏儒、夜精灵和德莱尼组成的古老同盟'
  },
  horde: {
    id: 'horde',
    name: '部落',
    icon: '⚔️',
    color: '#ff4400',
    description: '兽人、牛头人、巨魔、血精灵和被遗忘者建立的松散联盟'
  },
  neutral: {
    id: 'neutral',
    name: '中立',
    icon: '⚖️',
    color: '#4CAF50',
    description: '不隶属于任何阵营的中立势力'
  }
};

/**
 * 种族数据定义
 * 包含所有可选择的种族，每个种族有自己的阵营归属、属性加成和描述
 */
export const RACES: Record<string, RaceData> = {
  human: {
    id: 'human',
    name: '人类',
    icon: '🧑',
    factionId: 'alliance',
    bonus: { str: 1, cha: 1 },
    description: '艾泽拉斯最常见的种族，适应性强，擅长外交'
  },
  dwarf: {
    id: 'dwarf',
    name: '矮人',
    icon: '🧔',
    factionId: 'alliance',
    bonus: { con: 2, wis: 1 },
    description: '坚韧的工匠种族，擅长挖矿和锻造'
  },
  gnome: {
    id: 'gnome',
    name: '侏儒',
    icon: '🤖',
    factionId: 'alliance',
    bonus: { int: 2, dex: 1 },
    description: '天才的发明家，掌控着最前沿的机械和魔法技术'
  },
  nightelf: {
    id: 'nightelf',
    name: '暗夜精灵',
    icon: '🧝',
    factionId: 'alliance',
    bonus: { dex: 2, wis: 1 },
    description: '古老的暗夜精灵后裔，敏捷且与自然有深厚联系'
  },
  draenei: {
    id: 'draenei',
    name: '德莱尼',
    icon: '✨',
    factionId: 'alliance',
    bonus: { wis: 2, cha: 1 },
    description: '来自外域的流亡者，拥有圣光的力量'
  },
  worgen: {
    id: 'worgen',
    name: '狼人',
    icon: '🐺',
    factionId: 'alliance',
    bonus: { dex: 2, str: 1 },
    description: '被诅咒的吉尔尼斯人，月圆之夜会化为凶猛的狼人'
  },
  pandaren: {
    id: 'pandaren',
    name: '熊猫人',
    icon: '🐼',
    factionId: 'neutral',
    bonus: { con: 1, wis: 1, dex: 1 },
    description: '古老而神秘的中立种族，传承着古老的武学之道'
  },
  orc: {
    id: 'orc',
    name: '兽人',
    icon: '👹',
    factionId: 'horde',
    bonus: { str: 2, con: 1 },
    description: '来自德拉诺的战士种族，拥有超凡的力量和韧性'
  },
  undead: {
    id: 'undead',
    name: '被遗忘者',
    icon: '💀',
    factionId: 'horde',
    bonus: { int: 2, dex: 1 },
    description: '希尔瓦娜斯率领的亡灵，渴望自由和复仇'
  },
  tauren: {
    id: 'tauren',
    name: '牛头人',
    icon: '🐂',
    factionId: 'horde',
    bonus: { con: 2, wis: 1 },
    description: '与大地母亲和谐的游牧民族，敬畏自然'
  },
  troll: {
    id: 'troll',
    name: '巨魔',
    icon: '🧌',
    factionId: 'horde',
    bonus: { dex: 2, str: 1 },
    description: '古老的丛林巨魔，拥有强大的再生能力'
  },
  bloodelves: {
    id: 'bloodelves',
    name: '血精灵',
    icon: '🧜',
    factionId: 'horde',
    bonus: { int: 2, cha: 1 },
    description: '渴望魔力的高贵种族，精通奥术能量'
  },
  goblin: {
    id: 'goblin',
    name: '地精',
    icon: '👺',
    factionId: 'horde',
    bonus: { dex: 1, cha: 2 },
    description: '精明的商人种族，掌控着艾泽拉斯的商业命脉'
  },
  voidelf: {
    id: 'voidelf',
    name: '虚空精灵',
    icon: '🌑',
    factionId: 'alliance',
    bonus: { dex: 1, int: 2 },
    description: '精通奥术的精灵后裔，掌握着虚空之力'
  },
  lightforgeddraenei: {
    id: 'lightforgeddraenei',
    name: '光铸德莱尼',
    icon: '✨',
    factionId: 'alliance',
    bonus: { con: 1, wis: 2 },
    description: '圣光灌注的德莱尼，圣光的坚定守护者'
  },
  darkirondwarf: {
    id: 'darkirondwarf',
    name: '黑铁矮人',
    icon: '🔥',
    factionId: 'alliance',
    bonus: { str: 1, con: 2, int: 1 },
    description: '精通火焰与锻造的黑铁矮人'
  },
  kul_tiran: {
    id: 'kul_tiran',
    name: '库尔提拉斯人',
    icon: '⚓',
    factionId: 'alliance',
    bonus: { con: 2, wis: 1 },
    description: '海上强国的后裔，勇敢的航海者'
  },
  mechagnome: {
    id: 'mechagnome',
    name: '机械侏儒',
    icon: '⚙️',
    factionId: 'alliance',
    bonus: { dex: 1, int: 2 },
    description: '机械改造的侏儒，精通机械与科技'
  },
  nightborne: {
    id: 'nightborne',
    name: '夜之子',
    icon: '🌙',
    factionId: 'horde',
    bonus: { int: 2, cha: 1 },
    description: '暗夜井的守护者，精通奥术魔法'
  },
  highmountaintauren: {
    id: 'highmountaintauren',
    name: '至高岭牛头人',
    icon: '🏔️',
    factionId: 'horde',
    bonus: { con: 2, wis: 1 },
    description: '高山的守护者，与大地母亲的守护者'
  },
  magharorc: {
    id: 'magharorc',
    name: '玛格汉兽人',
    icon: '👹',
    factionId: 'horde',
    bonus: { str: 2, con: 1 },
    description: '纯净血脉的兽人，来自德拉诺的战士'
  },
  zandalari: {
    id: 'zandalari',
    name: '赞达拉巨魔',
    icon: '🦎',
    factionId: 'horde',
    bonus: { str: 1, con: 2, wis: 1 },
    description: '强大的帝国守护者，赞达拉的骄傲'
  },
  vulpera: {
    id: 'vulpera',
    name: '狐人',
    icon: '🦊',
    factionId: 'horde',
    bonus: { dex: 2, wis: 1 },
    description: '敏捷的沙漠行者，精明的商人和探险家'
  },
  dracthyr: {
    id: 'dracthyr',
    name: '龙希尔',
    icon: '🐉',
    factionId: 'neutral',
    bonus: { dex: 1, int: 2 },
    description: '龙类血脉的守护者，掌握着巨龙的力量'
  },
  earthen: {
    id: 'earthen',
    name: '土灵',
    icon: '🪨',
    factionId: 'neutral',
    bonus: { con: 2, wis: 1 },
    description: '大地的化身，与大地融为一体'
  },
  harenei: {
    id: 'harenei',
    name: '哈籁尼尔',
    icon: '🌿',
    factionId: 'neutral',
    bonus: { dex: 1, int: 1, wis: 1 },
    description: '自然的使者，与自然和谐共生'
  }
};
