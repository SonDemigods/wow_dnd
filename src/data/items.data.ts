/**
 * @fileoverview 物品数据模块
 * @description 包含所有可获取物品的类型定义和掉落物品详情
 * @module data/items
 */

import type { ItemTypeData, LootItemData } from '../types';

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
  armor: { name: '护甲', stackable: false, maxStack: 1 },
  misc: { name: '杂项', stackable: true, maxStack: 1 }
};

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
  }
];
