/**
 * @fileoverview 物品数据模块
 * @description 包含所有可获取物品的类型定义和掉落物品详情
 * @module data/items
 */

import type { ItemTypeData, LootItemData, Stats } from '../types'

export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type EquipmentType = 'weapon' | 'armor'

export interface RarityConfig {
  name: string
  color: string
  multiplier: number
}

export const RARITY_CONFIG: Record<EquipmentRarity, RarityConfig> = {
  common: { name: '普通', color: '#ffffff', multiplier: 1.0 },
  uncommon: { name: '优秀', color: '#1eff00', multiplier: 1.2 },
  rare: { name: '稀有', color: '#0070dd', multiplier: 1.5 },
  epic: { name: '史诗', color: '#a335ee', multiplier: 2.0 },
  legendary: { name: '传说', color: '#ff8000', multiplier: 3.0 }
}

export interface EquipmentItem {
  name: string
  icon: string
  type: EquipmentType
  stats: Partial<Stats>
  rarity: EquipmentRarity
  description: string
  template: string
  levelRequirement?: number
}

/**
 * 物品类型定义
 * @type {Record<string, ItemTypeData>}
 */
export const ITEM_TYPES: Record<string, ItemTypeData> = {
  gold: { name: '货币', stackable: true, maxStack: 999999 },
  potion: { name: '药水', stackable: true, maxStack: 20, usable: true },
  scroll: { name: '卷轴', stackable: true, maxStack: 10, usable: true },
  food: { name: '食物', stackable: true, maxStack: 20, usable: true },
  material: { name: '材料', stackable: true, maxStack: 99 },
  quest: { name: '任务物品', stackable: true, maxStack: 1 },
  weapon: { name: '武器', stackable: false, maxStack: 1 },
  armor: { name: '防具', stackable: false, maxStack: 1 }
}

/**
 * 所有可掉落非装备物品数据
 * @type {LootItemData[]}
 */
export const LOOT_ITEMS: LootItemData[] = [
  {
    name: '初级治疗药水',
    icon: '❤️',
    type: 'potion',
    healing: 30,
    rarity: 'common',
    description: '恢复30点生命值',
    template: 'smallHealthPotion'
  },
  {
    name: '次级治疗药水',
    icon: '💗',
    type: 'potion',
    healing: 60,
    rarity: 'uncommon',
    description: '恢复60点生命值',
    template: 'mediumHealthPotion'
  },
  {
    name: '强效治疗药水',
    icon: '💖',
    type: 'potion',
    healing: 100,
    rarity: 'rare',
    description: '恢复100点生命值',
    template: 'largeHealthPotion'
  },
  {
    name: '初级法力药水',
    icon: '💙',
    type: 'potion',
    manaRestore: 30,
    rarity: 'common',
    description: '恢复30点法力值',
    template: 'smallManaPotion'
  },
  {
    name: '次级法力药水',
    icon: '💎',
    type: 'potion',
    manaRestore: 60,
    rarity: 'uncommon',
    description: '恢复60点法力值',
    template: 'mediumManaPotion'
  },
  {
    name: '强效法力药水',
    icon: '🔮',
    type: 'potion',
    manaRestore: 100,
    rarity: 'rare',
    description: '恢复100点法力值',
    template: 'largeManaPotion'
  },
  {
    name: '巨人之力药剂',
    icon: '💪',
    type: 'potion',
    statBonus: { str: 1 },
    rarity: 'uncommon',
    description: '饮用后力量永久提升',
    template: 'strengthPotion'
  },
  {
    name: '猫鼬药剂',
    icon: '🦶',
    type: 'potion',
    statBonus: { dex: 1 },
    rarity: 'uncommon',
    description: '饮用后敏捷永久提升',
    template: 'agilityPotion'
  },
  {
    name: '坚韧药剂',
    icon: '🏋️',
    type: 'potion',
    statBonus: { con: 1 },
    rarity: 'uncommon',
    description: '饮用后体质永久提升',
    template: 'constitutionPotion'
  },
  {
    name: '智慧药剂',
    icon: '🧠',
    type: 'potion',
    statBonus: { int: 1 },
    rarity: 'uncommon',
    description: '饮用后智力永久提升',
    template: 'intelligencePotion'
  },
  {
    name: '洞察药剂',
    icon: '👁️',
    type: 'potion',
    statBonus: { wis: 1 },
    rarity: 'uncommon',
    description: '饮用后感知永久提升',
    template: 'wisdomPotion'
  },
  {
    name: '魅力药剂',
    icon: '💃',
    type: 'potion',
    statBonus: { cha: 1 },
    rarity: 'uncommon',
    description: '饮用后魅力永久提升',
    template: 'charismaPotion'
  },
  {
    name: '黑面包',
    icon: '🍞',
    type: 'food',
    healing: 20,
    rarity: 'common',
    description: '暴风城特产的黑面包',
    template: 'bread'
  },
  {
    name: '烤野猪肉',
    icon: '🍖',
    type: 'food',
    healing: 40,
    rarity: 'uncommon',
    description: '新鲜烤制的野猪腿肉',
    template: 'roastedMeat'
  },
  {
    name: '魔法蛋糕',
    icon: '✨',
    type: 'food',
    healing: 60,
    rarity: 'rare',
    description: '达拉然法师特制的魔法糕点',
    template: 'magicBread'
  },
  {
    name: '卷轴：火球术',
    icon: '📜',
    type: 'scroll',
    effect: 'damage',
    damage: [25, 40],
    rarity: 'uncommon',
    description: '记载着火球术的魔法卷轴',
    template: 'scrollFireball'
  },
  {
    name: '卷轴：治疗术',
    icon: '📜',
    type: 'scroll',
    effect: 'heal',
    healing: 50,
    rarity: 'uncommon',
    description: '记载着治疗术的神圣卷轴',
    template: 'scrollHeal'
  },
  {
    name: '奥达曼钥匙',
    icon: '🗝️',
    type: 'quest',
    rarity: 'rare',
    description: '打开奥达曼深处密室的古老钥匙',
    template: 'ancientKey'
  },
  {
    name: '红龙鳞片',
    icon: '🐉',
    type: 'material',
    rarity: 'rare',
    description: '来自红龙幼崽的珍贵鳞片',
    template: 'dragonScale'
  },
  {
    name: '奥术粉尘',
    icon: '✨',
    type: 'material',
    rarity: 'common',
    description: '奥术能量凝结的闪光粉尘',
    template: 'magicDust'
  },
  {
    name: '强效治疗水晶',
    icon: '💎',
    type: 'potion',
    healing: 80,
    rarity: 'rare',
    description: '蕴含治愈能量的纯净水晶',
    template: 'healingCrystal'
  },
  {
    name: '风暴符文石',
    icon: '🔮',
    type: 'material',
    rarity: 'uncommon',
    description: '刻有风暴符文的古老石头',
    template: 'runeStone'
  }
]

/**
 * 所有装备物品数据
 * @type {EquipmentItem[]}
 */
export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  {
    name: '铁剑',
    icon: '⚔️',
    type: 'weapon',
    stats: { str: 8 },
    rarity: 'common',
    description: '普通的铁制长剑',
    template: 'ironSword',
    levelRequirement: 1
  },
  {
    name: '精钢长剑',
    icon: '⚔️',
    type: 'weapon',
    stats: { str: 12 },
    rarity: 'uncommon',
    description: '精炼钢材锻造的长剑',
    template: 'steelSword',
    levelRequirement: 5
  },
  {
    name: '秘银之刃',
    icon: '⚔️',
    type: 'weapon',
    stats: { str: 18, dex: 5 },
    rarity: 'rare',
    description: '蕴含神秘力量的秘银长剑',
    template: 'mithrilSword',
    levelRequirement: 10
  },
  {
    name: '暗影打击者',
    icon: '🗡️',
    type: 'weapon',
    stats: { str: 28, int: 10 },
    rarity: 'epic',
    description: '汲取暗影之力的神秘长剑',
    template: 'shadowBlade',
    levelRequirement: 15
  },
  {
    name: '龙牙之刃',
    icon: '🐉',
    type: 'weapon',
    stats: { str: 45, int: 20, dex: 15 },
    rarity: 'legendary',
    description: '用远古巨龙之牙锻造的传奇武器',
    template: 'dragonFangBlade',
    levelRequirement: 20
  },
  {
    name: '橡木法杖',
    icon: '🪄',
    type: 'weapon',
    stats: { int: 10 },
    rarity: 'common',
    description: '普通的橡木法杖',
    template: 'oakStaff',
    levelRequirement: 1
  },
  {
    name: '水晶聚焦器',
    icon: '🔮',
    type: 'weapon',
    stats: { int: 15, wis: 5 },
    rarity: 'uncommon',
    description: '镶嵌水晶的精致法杖',
    template: 'crystalStaff',
    levelRequirement: 5
  },
  {
    name: '奥术师法杖',
    icon: '✨',
    type: 'weapon',
    stats: { int: 25, wis: 10 },
    rarity: 'rare',
    description: '蕴含强大奥术能量的法杖',
    template: 'arcaneStaff',
    levelRequirement: 10
  },
  {
    name: '冰霜之触',
    icon: '❄️',
    type: 'weapon',
    stats: { int: 38, wis: 15 },
    rarity: 'epic',
    description: '凝结永恒寒冰的法杖',
    template: 'frostStaff',
    levelRequirement: 15
  },
  {
    name: '暗影烈焰法杖',
    icon: '💜',
    type: 'weapon',
    stats: { int: 55, wis: 25, cha: 15 },
    rarity: 'legendary',
    description: '暗影议会传承的传奇法杖',
    template: 'shadowStaff',
    levelRequirement: 20
  },
  {
    name: '荒野皮甲',
    icon: '👕',
    type: 'armor',
    stats: { con: 5, dex: 8 },
    rarity: 'common',
    description: '轻便的皮甲护胸',
    template: 'leatherChest',
    levelRequirement: 1
  },
  {
    name: '链甲护甲',
    icon: '🛡️',
    type: 'armor',
    stats: { con: 10, dex: 5 },
    rarity: 'uncommon',
    description: '由金属环编织的锁子甲',
    template: 'chainmailArmor',
    levelRequirement: 5
  },
  {
    name: '板甲战衣',
    icon: '🛡️',
    type: 'armor',
    stats: { con: 18, str: 10 },
    rarity: 'rare',
    description: '厚重的板甲护胸',
    template: 'plateChest',
    levelRequirement: 10
  },
  {
    name: '巨龙护甲',
    icon: '🐉',
    type: 'armor',
    stats: { con: 30, str: 20, dex: 10 },
    rarity: 'epic',
    description: '用巨龙鳞片锻造的传奇胸甲',
    template: 'dragonChestplate',
    levelRequirement: 15
  },
  {
    name: '圣光守护者',
    icon: '☀️',
    type: 'armor',
    stats: { con: 45, str: 30, wis: 20, cha: 15 },
    rarity: 'legendary',
    description: '沐浴圣光的神圣铠甲',
    template: 'holyArmor',
    levelRequirement: 20
  },
  {
    name: '皮制护腿',
    icon: '👖',
    type: 'armor',
    stats: { con: 4, dex: 6 },
    rarity: 'common',
    description: '轻便的皮制长裤',
    template: 'leatherPants',
    levelRequirement: 1
  },
  {
    name: '铁纹护腿',
    icon: '🦵',
    type: 'armor',
    stats: { con: 8, str: 5 },
    rarity: 'uncommon',
    description: '铁制护腿',
    template: 'ironLeggings',
    levelRequirement: 5
  },
  {
    name: '精钢腿甲',
    icon: '🦵',
    type: 'armor',
    stats: { con: 15, str: 10, dex: 5 },
    rarity: 'rare',
    description: '精炼钢材打造的护腿',
    template: 'steelLeggings',
    levelRequirement: 10
  },
  {
    name: '暗影护腿',
    icon: '🖤',
    type: 'armor',
    stats: { con: 25, str: 15, int: 10 },
    rarity: 'epic',
    description: '暗影能量灌注的护腿',
    template: 'shadowLeggings',
    levelRequirement: 15
  },
  {
    name: '冰霜巨人护腿',
    icon: '🧊',
    type: 'armor',
    stats: { con: 38, str: 25, int: 20 },
    rarity: 'legendary',
    description: '永冻冰川铸造的护腿',
    template: 'frostLeggings',
    levelRequirement: 20
  },
  {
    name: '旅行者之靴',
    icon: '👢',
    type: 'armor',
    stats: { dex: 5 },
    rarity: 'common',
    description: '轻便的皮靴',
    template: 'leatherBoots',
    levelRequirement: 1
  },
  {
    name: '铁履',
    icon: '👢',
    type: 'armor',
    stats: { con: 5, dex: 5 },
    rarity: 'uncommon',
    description: '铁制护靴',
    template: 'ironBoots',
    levelRequirement: 5
  },
  {
    name: '疾风步靴',
    icon: '💨',
    type: 'armor',
    stats: { dex: 15, con: 8 },
    rarity: 'rare',
    description: '轻盈如风的魔法靴子',
    template: 'windwalkerBoots',
    levelRequirement: 10
  },
  {
    name: '暗影步之靴',
    icon: '👻',
    type: 'armor',
    stats: { dex: 25, int: 10 },
    rarity: 'epic',
    description: '暗影行走者的神秘靴子',
    template: 'shadowstepBoots',
    levelRequirement: 15
  },
  {
    name: '雷霆之怒',
    icon: '⚡',
    type: 'armor',
    stats: { dex: 35, int: 20, wis: 15 },
    rarity: 'legendary',
    description: '蕴含雷霆之力的传奇战靴',
    template: 'thunderBoots',
    levelRequirement: 20
  },
  {
    name: '皮手套',
    icon: '🧤',
    type: 'armor',
    stats: { dex: 4 },
    rarity: 'common',
    description: '轻便的皮手套',
    template: 'leatherGloves',
    levelRequirement: 1
  },
  {
    name: '铁护手',
    icon: '🧤',
    type: 'armor',
    stats: { str: 6, dex: 4 },
    rarity: 'uncommon',
    description: '铁制护手',
    template: 'ironGauntlets',
    levelRequirement: 5
  },
  {
    name: '精钢护手',
    icon: '⚔️',
    type: 'armor',
    stats: { str: 12, dex: 8 },
    rarity: 'rare',
    description: '精钢锻造的护手',
    template: 'steelGauntlets',
    levelRequirement: 10
  },
  {
    name: '烈焰守卫',
    icon: '🔥',
    type: 'armor',
    stats: { str: 20, int: 15 },
    rarity: 'epic',
    description: '燃烧着永恒火焰的护手',
    template: 'flameGauntlets',
    levelRequirement: 15
  },
  {
    name: '时空扭曲护手',
    icon: '⏰',
    type: 'armor',
    stats: { str: 30, int: 25, dex: 20 },
    rarity: 'legendary',
    description: '扭曲时空的传奇护手',
    template: 'timeGauntlets',
    levelRequirement: 20
  },
  {
    name: '钢制匕首',
    icon: '🗡️',
    type: 'weapon',
    stats: { dex: 10 },
    rarity: 'common',
    description: '普通的匕首',
    template: 'dagger',
    levelRequirement: 1
  },
  {
    name: '致命之刺',
    icon: '☠️',
    type: 'weapon',
    stats: { dex: 15 },
    rarity: 'uncommon',
    description: '涂抹致命毒药的匕首',
    template: 'poisonDagger',
    levelRequirement: 5
  },
  {
    name: '暗影匕首',
    icon: '🖤',
    type: 'weapon',
    stats: { dex: 22, int: 8 },
    rarity: 'rare',
    description: '暗影能量凝聚的匕首',
    template: 'shadowDagger',
    levelRequirement: 10
  },
  {
    name: '虚空撕裂者',
    icon: '🌌',
    type: 'weapon',
    stats: { dex: 35, int: 20 },
    rarity: 'epic',
    description: '撕裂虚空的神秘匕首',
    template: 'voidBlade',
    levelRequirement: 15
  },
  {
    name: '毁灭之牙',
    icon: '💀',
    type: 'weapon',
    stats: { dex: 50, int: 35, str: 20 },
    rarity: 'legendary',
    description: '带来毁灭的传奇匕首',
    template: 'doomBlade',
    levelRequirement: 20
  },
  {
    name: '铁盾',
    icon: '🛡️',
    type: 'weapon',
    stats: { con: 10 },
    rarity: 'common',
    description: '普通的铁盾',
    template: 'ironShield',
    levelRequirement: 1
  },
  {
    name: '精钢护盾',
    icon: '🛡️',
    type: 'weapon',
    stats: { con: 18 },
    rarity: 'uncommon',
    description: '精钢锻造的盾牌',
    template: 'steelShield',
    levelRequirement: 5
  },
  {
    name: '龙鳞护盾',
    icon: '🐉',
    type: 'weapon',
    stats: { con: 30, str: 10 },
    rarity: 'rare',
    description: '龙鳞镶嵌的盾牌',
    template: 'dragonScaleShield',
    levelRequirement: 10
  },
  {
    name: '圣光壁垒',
    icon: '☀️',
    type: 'weapon',
    stats: { con: 45, wis: 20, cha: 15 },
    rarity: 'epic',
    description: '圣光加持的神圣盾牌',
    template: 'holyShield',
    levelRequirement: 15
  },
  {
    name: '世界守护者',
    icon: '🌍',
    type: 'weapon',
    stats: { con: 65, wis: 35, cha: 25, str: 20 },
    rarity: 'legendary',
    description: '守护世界的传奇盾牌',
    template: 'worldShield',
    levelRequirement: 20
  }
]
