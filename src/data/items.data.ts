/**
 * @fileoverview 物品数据模块
 * @description 包含所有可获取物品的类型定义和掉落物品详情
 * @module data/items
 */

import type { Item, ItemTypeData } from '../types';

/**
 * 物品类型定义
 * @type {Record<string, ItemTypeData>}
 */
export const ITEM_TYPES: Record<string, ItemTypeData> = {
  gold: { id: 'gold', name: '货币', stackable: true, maxStack: 999999 },
  potion: { id: 'potion', name: '药水', stackable: true, maxStack: 20, usable: true },
  scroll: { id: 'scroll', name: '卷轴', stackable: true, maxStack: 10, usable: true },
  food: { id: 'food', name: '食物', stackable: true, maxStack: 20, usable: true },
  material: { id: 'material', name: '材料', stackable: true, maxStack: 99 },
  quest: { id: 'quest', name: '任务物品', stackable: true, maxStack: 1 },
  weapon: { id: 'weapon', name: '武器', stackable: false, maxStack: 1 },
  armor: { id: 'armor', name: '护甲', stackable: false, maxStack: 1 },
  misc: { id: 'misc', name: '杂项', stackable: true, maxStack: 1 }
};

/**
 * 所有可掉落非装备物品数据
 * @type {Item[]}
 */
export const LOOT_ITEMS: Item[] = [
  {
    id: 'smallHealthPotion',
    name: '初级治疗药水',
    icon: '❤️',
    type: 'potion',
    rarity: 'common',
    description: '恢复30点生命值',
    value: 10,
    stackable: true,
    hpRestore: 30,
    consumable: true,
    template: 'smallHealthPotion'
  },
  {
    id: 'mediumHealthPotion',
    name: '次级治疗药水',
    icon: '💗',
    type: 'potion',
    rarity: 'uncommon',
    description: '恢复60点生命值',
    value: 25,
    stackable: true,
    hpRestore: 60,
    consumable: true,
    template: 'mediumHealthPotion'
  },
  {
    id: 'largeHealthPotion',
    name: '强效治疗药水',
    icon: '💖',
    type: 'potion',
    rarity: 'rare',
    description: '恢复100点生命值',
    value: 50,
    stackable: true,
    hpRestore: 100,
    consumable: true,
    template: 'largeHealthPotion'
  },
  {
    id: 'smallManaPotion',
    name: '初级法力药水',
    icon: '💙',
    type: 'potion',
    rarity: 'common',
    description: '恢复30点法力值',
    value: 10,
    stackable: true,
    mpRestore: 30,
    consumable: true,
    template: 'smallManaPotion'
  },
  {
    id: 'mediumManaPotion',
    name: '次级法力药水',
    icon: '💎',
    type: 'potion',
    rarity: 'uncommon',
    description: '恢复60点法力值',
    value: 25,
    stackable: true,
    mpRestore: 60,
    consumable: true,
    template: 'mediumManaPotion'
  },
  {
    id: 'largeManaPotion',
    name: '强效法力药水',
    icon: '🔮',
    type: 'potion',
    rarity: 'rare',
    description: '恢复100点法力值',
    value: 50,
    stackable: true,
    mpRestore: 100,
    consumable: true,
    template: 'largeManaPotion'
  },
  {
    id: 'strengthPotion',
    name: '巨人之力药剂',
    icon: '💪',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后力量永久提升',
    value: 50,
    stackable: true,
    bonus: { str: 1 },
    consumable: true,
    template: 'strengthPotion'
  },
  {
    id: 'agilityPotion',
    name: '猫鼬药剂',
    icon: '🦶',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后敏捷永久提升',
    value: 50,
    stackable: true,
    bonus: { dex: 1 },
    consumable: true,
    template: 'agilityPotion'
  },
  {
    id: 'constitutionPotion',
    name: '坚韧药剂',
    icon: '🏋️',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后体质永久提升',
    value: 50,
    stackable: true,
    bonus: { con: 1 },
    consumable: true,
    template: 'constitutionPotion'
  },
  {
    id: 'intelligencePotion',
    name: '智慧药剂',
    icon: '🧠',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后智力永久提升',
    value: 50,
    stackable: true,
    bonus: { int: 1 },
    consumable: true,
    template: 'intelligencePotion'
  },
  {
    id: 'wisdomPotion',
    name: '洞察药剂',
    icon: '👁️',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后感知永久提升',
    value: 50,
    stackable: true,
    bonus: { wis: 1 },
    consumable: true,
    template: 'wisdomPotion'
  },
  {
    id: 'charismaPotion',
    name: '魅力药剂',
    icon: '💃',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后魅力永久提升',
    value: 50,
    stackable: true,
    bonus: { cha: 1 },
    consumable: true,
    template: 'charismaPotion'
  },
  {
    id: 'bread',
    name: '黑面包',
    icon: '🍞',
    type: 'food',
    rarity: 'common',
    description: '暴风城特产的黑面包',
    value: 5,
    stackable: true,
    hpRestore: 20,
    consumable: true,
    template: 'bread'
  },
  {
    id: 'roastedMeat',
    name: '烤野猪肉',
    icon: '🍖',
    type: 'food',
    rarity: 'uncommon',
    description: '新鲜烤制的野猪腿肉',
    value: 15,
    stackable: true,
    hpRestore: 40,
    consumable: true,
    template: 'roastedMeat'
  },
  {
    id: 'magicBread',
    name: '魔法蛋糕',
    icon: '✨',
    type: 'food',
    rarity: 'rare',
    description: '达拉然法师特制的魔法糕点',
    value: 30,
    stackable: true,
    hpRestore: 60,
    consumable: true,
    template: 'magicBread'
  },
  {
    id: 'scrollFireball',
    name: '卷轴：火球术',
    icon: '📜',
    type: 'scroll',
    rarity: 'uncommon',
    description: '记载着火球术的魔法卷轴',
    value: 40,
    stackable: true,
    consumable: true,
    template: 'scrollFireball'
  },
  {
    id: 'scrollHeal',
    name: '卷轴：治疗术',
    icon: '📜',
    type: 'scroll',
    rarity: 'uncommon',
    description: '记载着治疗术的神圣卷轴',
    value: 35,
    stackable: true,
    hpRestore: 50,
    consumable: true,
    template: 'scrollHeal'
  },
  {
    id: 'dragonScale',
    name: '红龙鳞片',
    icon: '🐉',
    type: 'material',
    rarity: 'rare',
    description: '来自红龙幼崽的珍贵鳞片',
    value: 80,
    stackable: true,
    template: 'dragonScale'
  },
  {
    id: 'magicDust',
    name: '奥术粉尘',
    icon: '✨',
    type: 'material',
    rarity: 'common',
    description: '奥术能量凝结的闪光粉尘',
    value: 15,
    stackable: true,
    template: 'magicDust'
  }
];
