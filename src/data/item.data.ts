/**
 * @fileoverview 物品数据模块
 * @description 包含所有可获取物品的类型定义和掉落物品详情
 * @module data/item
 */

import type { Item } from '../modules/inventory/types';

// ============================================================================
// 药水类物品
// ============================================================================

/** 治疗药水 - 恢复生命值 */
const HEALTH_POTIONS: Item[] = [
  {
    id: 'small_health_potion',
    name: '初级治疗药水',
    icon: '❤️',
    type: 'potion',
    rarity: 'common',
    description: '恢复30点生命值',
    value: 10,
    stackable: true,
    hpRestore: 30,
    consumable: true,
    template: 'small_health_potion'
  },
  {
    id: 'medium_health_potion',
    name: '次级治疗药水',
    icon: '💗',
    type: 'potion',
    rarity: 'uncommon',
    description: '恢复60点生命值',
    value: 25,
    stackable: true,
    hpRestore: 60,
    consumable: true,
    template: 'medium_health_potion'
  },
  {
    id: 'large_health_potion',
    name: '强效治疗药水',
    icon: '💖',
    type: 'potion',
    rarity: 'rare',
    description: '恢复100点生命值',
    value: 50,
    stackable: true,
    hpRestore: 100,
    consumable: true,
    template: 'large_health_potion'
  },
  {
    id: 'super_health_potion',
    name: '超级治疗药水',
    icon: '❤️‍🔥',
    type: 'potion',
    rarity: 'epic',
    description: '恢复150点生命值，燃烧军团的炼金产物',
    value: 80,
    stackable: true,
    hpRestore: 150,
    consumable: true,
    template: 'super_health_potion'
  }
];

/** 法力药水 - 恢复法力值 */
const MANA_POTIONS: Item[] = [
  {
    id: 'small_mana_potion',
    name: '初级法力药水',
    icon: '💙',
    type: 'potion',
    rarity: 'common',
    description: '恢复30点法力值',
    value: 10,
    stackable: true,
    mpRestore: 30,
    consumable: true,
    template: 'small_mana_potion'
  },
  {
    id: 'medium_mana_potion',
    name: '次级法力药水',
    icon: '💎',
    type: 'potion',
    rarity: 'uncommon',
    description: '恢复60点法力值',
    value: 25,
    stackable: true,
    mpRestore: 60,
    consumable: true,
    template: 'medium_mana_potion'
  },
  {
    id: 'large_mana_potion',
    name: '强效法力药水',
    icon: '🔮',
    type: 'potion',
    rarity: 'rare',
    description: '恢复100点法力值',
    value: 50,
    stackable: true,
    mpRestore: 100,
    consumable: true,
    template: 'large_mana_potion'
  },
  {
    id: 'super_mana_potion',
    name: '超级法力药水',
    icon: '✨',
    type: 'potion',
    rarity: 'epic',
    description: '恢复150点法力值，蕴含无尽奥术能量',
    value: 80,
    stackable: true,
    mpRestore: 150,
    consumable: true,
    template: 'super_mana_potion'
  }
];

/** 属性药剂 - 永久提升属性 */
const ATTRIBUTE_POTIONS: Item[] = [
  {
    id: 'strength_potion',
    name: '巨人之力药剂',
    icon: '💪',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后力量永久提升',
    value: 50,
    stackable: true,
    bonus: { str: 1 },
    consumable: true,
    template: 'strength_potion'
  },
  {
    id: 'agility_potion',
    name: '猫鼬药剂',
    icon: '🦶',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后敏捷永久提升',
    value: 50,
    stackable: true,
    bonus: { dex: 1 },
    consumable: true,
    template: 'agility_potion'
  },
  {
    id: 'constitution_potion',
    name: '坚韧药剂',
    icon: '🏋️',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后体质永久提升',
    value: 50,
    stackable: true,
    bonus: { con: 1 },
    consumable: true,
    template: 'constitution_potion'
  },
  {
    id: 'intelligence_potion',
    name: '智慧药剂',
    icon: '🧠',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后智力永久提升',
    value: 50,
    stackable: true,
    bonus: { int: 1 },
    consumable: true,
    template: 'intelligence_potion'
  },
  {
    id: 'wisdom_potion',
    name: '洞察药剂',
    icon: '👁️',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后感知永久提升',
    value: 50,
    stackable: true,
    bonus: { wis: 1 },
    consumable: true,
    template: 'wisdom_potion'
  },
  {
    id: 'charisma_potion',
    name: '魅力药剂',
    icon: '💃',
    type: 'potion',
    rarity: 'uncommon',
    description: '饮用后魅力永久提升',
    value: 50,
    stackable: true,
    bonus: { cha: 1 },
    consumable: true,
    template: 'charisma_potion'
  }
];

// ============================================================================
// 食物类物品
// ============================================================================

/** 普通食物 - 恢复少量生命值 */
const COMMON_FOOD: Item[] = [
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
    id: 'roast_quail',
    name: '烤鹌鹑',
    icon: '🍗',
    type: 'food',
    rarity: 'common',
    description: '暴风城厨师精心烤制的鹌鹑',
    value: 8,
    stackable: true,
    hpRestore: 25,
    consumable: true,
    template: 'roast_quail'
  }
];

/** 优质食物 - 恢复中等生命值 */
const PREMIUM_FOOD: Item[] = [
  {
    id: 'roasted_meat',
    name: '烤野猪肉',
    icon: '🍖',
    type: 'food',
    rarity: 'uncommon',
    description: '新鲜烤制的野猪腿肉',
    value: 15,
    stackable: true,
    hpRestore: 40,
    consumable: true,
    template: 'roasted_meat'
  },
  {
    id: 'murloc_fin_soup',
    name: '鱼人鳍汤',
    icon: '🥣',
    type: 'food',
    rarity: 'uncommon',
    description: '用鱼人鳍熬制的鲜美汤品',
    value: 20,
    stackable: true,
    hpRestore: 45,
    consumable: true,
    template: 'murloc_fin_soup'
  },
  {
    id: 'stormwind_stew',
    name: '暴风城炖肉',
    icon: '🍲',
    type: 'food',
    rarity: 'uncommon',
    description: '暴风城王家厨师的招牌炖肉',
    value: 25,
    stackable: true,
    hpRestore: 50,
    consumable: true,
    template: 'stormwind_stew'
  }
];

/** 稀有食物 - 恢复大量生命值，可能有额外效果 */
const RARE_FOOD: Item[] = [
  {
    id: 'magic_bread',
    name: '魔法蛋糕',
    icon: '✨',
    type: 'food',
    rarity: 'rare',
    description: '达拉然法师特制的魔法糕点',
    value: 30,
    stackable: true,
    hpRestore: 60,
    consumable: true,
    template: 'magic_bread'
  },
  {
    id: 'dragon_breath_chili',
    name: '龙息辣椒',
    icon: '🌶️',
    type: 'food',
    rarity: 'rare',
    description: '据说吃下后能喷出龙息的神奇辣椒',
    value: 35,
    stackable: true,
    hpRestore: 55,
    bonus: { str: 2 },
    consumable: true,
    template: 'dragon_breath_chili'
  }
];

// ============================================================================
// 卷轴类物品
// ============================================================================

/** 攻击型卷轴 */
const OFFENSIVE_SCROLLS: Item[] = [
  {
    id: 'scroll_fireball',
    name: '卷轴：火球术',
    icon: '📜🔥',
    type: 'scroll',
    rarity: 'uncommon',
    description: '记载着火球术的魔法卷轴',
    value: 40,
    stackable: true,
    consumable: true,
    template: 'scroll_fireball'
  },
  {
    id: 'scroll_blizzard',
    name: '卷轴：暴风雪',
    icon: '📜❄️',
    type: 'scroll',
    rarity: 'rare',
    description: '记载着暴风雪法术的古老卷轴',
    value: 60,
    stackable: true,
    consumable: true,
    template: 'scroll_blizzard'
  },
  {
    id: 'scroll_chain_lightning',
    name: '卷轴：闪电链',
    icon: '📜⚡️',
    type: 'scroll',
    rarity: 'rare',
    description: '记载着闪电链法术的魔法卷轴',
    value: 55,
    stackable: true,
    consumable: true,
    template: 'scroll_chain_lightning'
  }
];

/** 治疗型卷轴 */
const HEALING_SCROLLS: Item[] = [
  {
    id: 'scroll_heal',
    name: '卷轴：治疗术',
    icon: '📜❤️',
    type: 'scroll',
    rarity: 'uncommon',
    description: '记载着治疗术的神圣卷轴',
    value: 35,
    stackable: true,
    hpRestore: 50,
    consumable: true,
    template: 'scroll_heal'
  },
  {
    id: 'scroll_mass_heal',
    name: '卷轴：群体治疗',
    icon: '📜✨',
    type: 'scroll',
    rarity: 'epic',
    description: '记载着群体治疗神术的神圣卷轴',
    value: 90,
    stackable: true,
    hpRestore: 80,
    consumable: true,
    template: 'scroll_mass_heal'
  }
];

// ============================================================================
// 材料类物品
// ============================================================================

/** 基础材料 */
const BASIC_MATERIALS: Item[] = [
  {
    id: 'magic_dust',
    name: '奥术粉尘',
    icon: '✨',
    type: 'material',
    rarity: 'common',
    description: '奥术能量凝结的闪光粉尘',
    value: 15,
    stackable: true,
    template: 'magic_dust'
  }
];

/** 稀有材料 */
const RARE_MATERIALS: Item[] = [
  {
    id: 'dragon_scale',
    name: '红龙鳞片',
    icon: '🐉',
    type: 'material',
    rarity: 'rare',
    description: '来自红龙幼崽的珍贵鳞片',
    value: 80,
    stackable: true,
    template: 'dragon_scale'
  },
  {
    id: 'dream_fragment',
    name: '梦境碎片',
    icon: '💎🌿',
    type: 'material',
    rarity: 'rare',
    description: '翡翠梦境中散落的神秘碎片',
    value: 65,
    stackable: true,
    template: 'dream_fragment'
  }
];

/** 源生精华 - 元素材料 */
const PRIMAL_MATERIALS: Item[] = [
  {
    id: 'primal_life',
    name: '源生生命',
    icon: '🌱',
    type: 'material',
    rarity: 'rare',
    description: '生命能量凝聚而成的原始精华',
    value: 50,
    stackable: true,
    template: 'primal_life'
  },
  {
    id: 'primal_fire',
    name: '源生火焰',
    icon: '🔥',
    type: 'material',
    rarity: 'rare',
    description: '火焰之地诞生的原始火焰精华',
    value: 55,
    stackable: true,
    template: 'primal_fire'
  },
  {
    id: 'primal_water',
    name: '源生之水',
    icon: '💧',
    type: 'material',
    rarity: 'rare',
    description: '深海中凝聚的原始水之精华',
    value: 50,
    stackable: true,
    template: 'primal_water'
  },
  {
    id: 'primal_air',
    name: '源生空气',
    icon: '💨',
    type: 'material',
    rarity: 'rare',
    description: '风暴之巅诞生的原始空气精华',
    value: 50,
    stackable: true,
    template: 'primal_air'
  },
  {
    id: 'primal_earth',
    name: '源生大地',
    icon: '🪨',
    type: 'material',
    rarity: 'rare',
    description: '大地之心凝聚的原始土之精华',
    value: 50,
    stackable: true,
    template: 'primal_earth'
  }
];

/** 史诗材料 */
const EPIC_MATERIALS: Item[] = [
  {
    id: 'void_crystal',
    name: '虚空水晶',
    icon: '🔮💜',
    type: 'material',
    rarity: 'epic',
    description: '扭曲虚空中诞生的神秘水晶',
    value: 100,
    stackable: true,
    template: 'void_crystal'
  },
  {
    id: 'sunmote',
    name: '太阳之尘',
    icon: '☀️✨',
    type: 'material',
    rarity: 'epic',
    description: '太阳之井高地散落的神圣尘埃',
    value: 95,
    stackable: true,
    template: 'sunmote'
  }
];

// ============================================================================
// 导出所有物品
// ============================================================================

/**
 * 所有可掉落非装备物品数据
 * @type {Item[]}
 */
export const LOOT_ITEMS: Item[] = [
  // 药水类
  ...HEALTH_POTIONS,
  ...MANA_POTIONS,
  ...ATTRIBUTE_POTIONS,
  
  // 食物类
  ...COMMON_FOOD,
  ...PREMIUM_FOOD,
  ...RARE_FOOD,
  
  // 卷轴类
  ...OFFENSIVE_SCROLLS,
  ...HEALING_SCROLLS,
  
  // 材料类
  ...BASIC_MATERIALS,
  ...RARE_MATERIALS,
  ...PRIMAL_MATERIALS,
  ...EPIC_MATERIALS
];
