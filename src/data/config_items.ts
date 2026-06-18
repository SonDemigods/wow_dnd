/**
 * @fileoverview 物品数据模块
 * @description 包含所有可获取的掉落物品详情（药水、食物、卷轴、材料等）
 * @module data/item
 */

import type { Item } from '../modules/inventory/types';

// ============================================================================
// 药水类物品
// ============================================================================

/** 生命药水 - 恢复生命值 */
const HEALTH_POTIONS: Item[] = [
  {
    id: 'small_health_potion',
    name: '初级生命药水',
    icon: 'game-icons:health-potion',
    type: 'potion',
    rarity: 'common',
    level: 1,
    description: '一瓶散发着草药清香的生命药水，能快速愈合轻微伤口',
    value: 10,
    stackable: true,
    effect: { type: 'health_restore', value: 30 },
    consumable: true,
    template: 'small_health_potion'
  },
  {
    id: 'medium_health_potion',
    name: '次级生命药水',
    icon: 'game-icons:health-potion',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '由炼金师精心调配的红色药水，能有效愈合中度创伤',
    value: 25,
    stackable: true,
    effect: { type: 'health_restore', value: 60 },
    consumable: true,
    template: 'medium_health_potion'
  },
  {
    id: 'large_health_potion',
    name: '特效生命药水',
    icon: 'game-icons:health-potion',
    type: 'potion',
    rarity: 'rare',
    level: 5,
    description: '泛着金色光泽的特效生命药水，即使重伤也能迅速恢复',
    value: 50,
    stackable: true,
    effect: { type: 'health_restore', value: 100 },
    consumable: true,
    template: 'large_health_potion'
  },
  {
    id: 'super_health_potion',
    name: '超级生命药水',
    icon: 'game-icons:health-potion',
    type: 'potion',
    rarity: 'epic',
    level: 7,
    description: '据说是从深渊军团魔能炼金釜中诞生的奇迹药水，猩红的液体翻滚着令人敬畏的再生之力，即便是濒死的战士也能瞬间重返战场',
    value: 80,
    stackable: true,
    effect: { type: 'health_restore', value: 150 },
    consumable: true,
    template: 'super_health_potion'
  }
];

/** 法力药水 - 恢复法力值 */
const MANA_POTIONS: Item[] = [
  {
    id: 'small_mana_potion',
    name: '初级法力药水',
    icon: 'game-icons:magic-potion',
    type: 'potion',
    rarity: 'common',
    level: 1,
    description: '一瓶泛着淡蓝微光的法力药水，由银辉城学徒炼金师用魔力草与安神花蒸馏而成，足以补充数道低阶咒语所需的魔力',
    value: 10,
    stackable: true,
    effect: { type: 'mana_restore', value: 30 },
    consumable: true,
    template: 'small_mana_potion'
  },
  {
    id: 'medium_mana_potion',
    name: '次级法力药水',
    icon: 'game-icons:magic-potion',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '奥术师调配的蓝色药水，蕴含纯净的魔法能量',
    value: 25,
    stackable: true,
    effect: { type: 'mana_restore', value: 60 },
    consumable: true,
    template: 'medium_mana_potion'
  },
  {
    id: 'large_mana_potion',
    name: '特效法力药水',
    icon: 'game-icons:magic-potion',
    type: 'potion',
    rarity: 'rare',
    level: 5,
    description: '晶莹剔透的特效法力药水，由奥法学院资深奥术师以魔力蓟与光耀草精炼而成，饮下后魔力如泉水般从魔网深处奔涌而来',
    value: 50,
    stackable: true,
    effect: { type: 'mana_restore', value: 100 },
    consumable: true,
    template: 'large_mana_potion'
  },
  {
    id: 'super_mana_potion',
    name: '超级法力药水',
    icon: 'game-icons:magic-potion',
    type: 'potion',
    rarity: 'epic',
    level: 7,
    description: '从奥术之源碎片中提炼的超级法力药水，蕴含着近乎无穷的奥术能量',
    value: 80,
    stackable: true,
    effect: { type: 'mana_restore', value: 150 },
    consumable: true,
    template: 'super_mana_potion'
  }
];

/** 属性药剂 - 永久提升属性 */
const ATTRIBUTE_POTIONS: Item[] = [
  {
    id: 'strength_potion',
    name: '巨人之力药剂',
    icon: 'game-icons:round-bottom-flask',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '散发着原始蛮力的药剂，饮用后仿佛感受到远古巨人的血脉在体内奔涌',
    value: 50,
    stackable: true,
    bonus: { str: 1 },
    consumable: true,
    template: 'strength_potion'
  },
  {
    id: 'agility_potion',
    name: '猫鼬药剂',
    icon: 'game-icons:round-bottom-flask',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '用稀有猫鼬草提炼的敏捷药剂，能让你的动作如猎豹般迅捷',
    value: 50,
    stackable: true,
    bonus: { dex: 1 },
    consumable: true,
    template: 'agility_potion'
  },
  {
    id: 'constitution_potion',
    name: '坚韧药剂',
    icon: 'game-icons:round-bottom-flask',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '由矮人秘方调制的坚韧药剂，饮用后筋骨如精钢般坚硬',
    value: 50,
    stackable: true,
    bonus: { con: 1 },
    consumable: true,
    template: 'constitution_potion'
  },
  {
    id: 'intelligence_potion',
    name: '智慧药剂',
    icon: 'game-icons:round-bottom-flask',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '汇聚了奥法学院学者智慧的药剂，能让思维如水晶般通透',
    value: 50,
    stackable: true,
    bonus: { int: 1 },
    consumable: true,
    template: 'intelligence_potion'
  },
  {
    id: 'wisdom_potion',
    name: '洞察药剂',
    icon: 'game-icons:round-bottom-flask',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '由暮精灵祭司祝福的洞察药剂，能让感知穿透世俗的迷雾',
    value: 50,
    stackable: true,
    bonus: { wis: 1 },
    consumable: true,
    template: 'wisdom_potion'
  },
  {
    id: 'charisma_potion',
    name: '魅力药剂',
    icon: 'game-icons:round-bottom-flask',
    type: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '散发着迷人芬芳的魅力药剂，让旁人不由自主地心生好感',
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
    icon: 'game-icons:bread',
    type: 'food',
    rarity: 'common',
    level: 1,
    description: '辉石城烘焙作坊每天清晨新鲜出炉的黑面包，外皮酥脆内里松软，每一口都带着麦芽的甘甜与大地的质朴，是光辉盟约冒险者行囊里最温暖的味道',
    value: 5,
    stackable: true,
    effect: { type: 'health_restore', value: 20 },
    consumable: true,
    template: 'bread'
  },
  {
    id: 'roast_quail',
    name: '烤鹌鹑',
    icon: 'game-icons:drumstick',
    type: 'food',
    rarity: 'common',
    level: 1,
    description: '翠叶森林特产的烤鹌鹑，外皮焦香内里多汁，冒险者最爱的便携美食',
    value: 8,
    stackable: true,
    effect: { type: 'health_restore', value: 25 },
    consumable: true,
    template: 'roast_quail'
  }
];

/** 优质食物 - 恢复中等生命值 */
const PREMIUM_FOOD: Item[] = [
  {
    id: 'roasted_meat',
    name: '烤野猪肉',
    icon: 'game-icons:meat',
    type: 'food',
    rarity: 'uncommon',
    level: 3,
    description: '从翠叶森林猎来的野猪后腿，以秘制香料腌制后在篝火上慢烤至金黄，油脂滴落火焰的滋滋声就是冒险者最熟悉的安魂曲',
    value: 15,
    stackable: true,
    effect: { type: 'health_restore', value: 40 },
    consumable: true,
    template: 'roasted_meat'
  },
  {
    id: 'murloc_fin_soup',
    name: '蛙人鳍汤',
    icon: 'game-icons:bowl-of-rice',
    type: 'food',
    rarity: 'uncommon',
    level: 3,
    description: '用新鲜蛙人鳍搭配秘制香料慢火熬制的浓汤，鲜美得让人忘记蛙人的腥臭',
    value: 20,
    stackable: true,
    effect: { type: 'health_restore', value: 45 },
    consumable: true,
    template: 'murloc_fin_soup'
  },
  {
    id: 'stormwind_stew',
    name: '辉石城炖肉',
    icon: 'game-icons:hot-meal',
    type: 'food',
    rarity: 'uncommon',
    level: 3,
    description: '辉石城王家厨师传承三代的家传炖肉，香浓醇厚，连雄狮之王都赞不绝口',
    value: 25,
    stackable: true,
    effect: { type: 'health_restore', value: 50 },
    consumable: true,
    template: 'stormwind_stew'
  }
];

/** 稀有食物 - 恢复大量生命值，可能有额外效果 */
const RARE_FOOD: Item[] = [
  {
    id: 'magic_bread',
    name: '魔法蛋糕',
    icon: 'game-icons:cupcake',
    type: 'food',
    rarity: 'rare',
    level: 5,
    description: '奥法学院法师以魔法烘焙的精致糕点，入口即化，余味中带着淡淡的奥术回甘',
    value: 30,
    stackable: true,
    effect: { type: 'health_restore', value: 60 },
    consumable: true,
    template: 'magic_bread'
  },
  {
    id: 'dragon_breath_chili',
    name: '龙息辣椒',
    icon: 'game-icons:chili-pepper',
    type: 'food',
    rarity: 'rare',
    level: 5,
    description: '用龙息椒研磨而成的致命辣椒，据说只有最勇敢的冒险者才敢挑战第三口',
    value: 35,
    stackable: true,
    effect: { type: 'health_restore', value: 55 },
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
    icon: 'game-icons:scroll-unfurled',
    type: 'scroll',
    rarity: 'uncommon',
    level: 3,
    description: '一张泛黄的羊皮卷轴，上面用火焰墨水书写着古老的火球术咒语',
    value: 40,
    stackable: true,
    effect: { type: 'magic_damage', value: 40 },
    consumable: true,
    template: 'scroll_fireball'
  },
  {
    id: 'scroll_blizzard',
    name: '卷轴：寒冰风暴',
    icon: 'game-icons:scroll-unfurled',
    type: 'scroll',
    rarity: 'rare',
    level: 5,
    description: '一张寒气逼人的古老卷轴，边缘凝结着永不融化的冰霜',
    value: 60,
    stackable: true,
    effect: { type: 'magic_damage', value: 70 },
    consumable: true,
    template: 'scroll_blizzard'
  },
  {
    id: 'scroll_chain_lightning',
    name: '卷轴：连锁雷击',
    icon: 'game-icons:scroll-unfurled',
    type: 'scroll',
    rarity: 'rare',
    level: 5,
    description: '一张封印着风暴之力的魔法卷轴，触摸时指尖能感受到微弱的电击',
    value: 55,
    stackable: true,
    effect: { type: 'magic_damage', value: 65 },
    consumable: true,
    template: 'scroll_chain_lightning'
  }
];

/** 治疗型卷轴 */
const HEALING_SCROLLS: Item[] = [
  {
    id: 'scroll_heal',
    name: '卷轴：治疗术',
    icon: 'game-icons:scroll-unfurled',
    type: 'scroll',
    rarity: 'uncommon',
    level: 3,
    description: '一张散发着柔和圣光的卷轴，记载着圣光教会传承的神圣祷文',
    value: 35,
    stackable: true,
    effect: { type: 'health_restore', value: 50 },
    consumable: true,
    template: 'scroll_heal'
  },
  {
    id: 'scroll_mass_heal',
    name: '卷轴：群体治疗',
    icon: 'game-icons:scroll-unfurled',
    type: 'scroll',
    rarity: 'epic',
    level: 7,
    description: '一张由大主教亲自祝福的神圣卷轴，展开时光芒能照亮整座教堂',
    value: 90,
    stackable: true,
    effect: { type: 'health_restore', value: 80 },
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
    icon: 'game-icons:cupcake',
    type: 'material',
    rarity: 'common',
    level: 1,
    description: '漂浮在奥法学院魔法回路中的奥术能量凝结而成的闪光粉尘，指尖触碰时会发出微弱的共鸣，是附魔与炼金术中最基础却也最不可或缺的神秘材料',
    value: 15,
    stackable: true,
    template: 'magic_dust'
  }
];

/** 稀有材料 */
const RARE_MATERIALS: Item[] = [
  {
    id: 'dragon_scale',
    name: '赤红龙鳞',
    icon: 'game-icons:dragon-scales',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '一片闪烁着赤红光泽的龙鳞，仍残存着巨龙的生命热能',
    value: 80,
    stackable: true,
    template: 'dragon_scale'
  },
  {
    id: 'dream_fragment',
    name: '翠绿碎片',
    icon: 'game-icons:emerald',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '从翠绿梦境中散落的神秘碎片，静静散发着令人安心的绿色柔光',
    value: 65,
    stackable: true,
    template: 'dream_fragment'
  }
];

/** 元素精华 - 元素材料 */
const PRIMAL_MATERIALS: Item[] = [
  {
    id: 'primal_life',
    name: '精粹生命',
    icon: 'game-icons:sprout',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '从远古生命之树根系下凝聚的原始精华，蕴含着万物生长的力量',
    value: 50,
    stackable: true,
    template: 'primal_life'
  },
  {
    id: 'primal_fire',
    name: '精粹火焰',
    icon: 'game-icons:flame',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '从火焰之地熔岩核心中提取的原始火焰精华，永不熄灭地燃烧着',
    value: 55,
    stackable: true,
    template: 'primal_fire'
  },
  {
    id: 'primal_water',
    name: '精粹之水',
    icon: 'game-icons:water-flask',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '从风波角深海裂谷中凝聚的原始水之精华，内部流淌着永不止息的暗流',
    value: 50,
    stackable: true,
    template: 'primal_water'
  },
  {
    id: 'primal_air',
    name: '精粹空气',
    icon: 'game-icons:wind-hole',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '在雷暴山巅永不止息的雷暴中凝聚而生的原始空气之精华，捧在手心能感受到风元素的低语与闪电的咆哮，是制作风系附魔与工程学装置的珍贵核心',
    value: 50,
    stackable: true,
    template: 'primal_air'
  },
  {
    id: 'primal_earth',
    name: '精粹大地',
    icon: 'game-icons:stone-block',
    type: 'material',
    rarity: 'rare',
    level: 5,
    description: '从地脉之渊的大地之心核心萃取而出的原始土之精华，浑厚的石质外壳下封印着山脉沉稳的脉动，触碰时仿佛能感受到整个大地的重量',
    value: 50,
    stackable: true,
    template: 'primal_earth'
  }
];

/** 史诗材料 */
const EPIC_MATERIALS: Item[] = [
  {
    id: 'void_crystal',
    name: '暗影水晶',
    icon: 'game-icons:crystal-ball',
    type: 'material',
    rarity: 'epic',
    level: 7,
    description: '从扭曲虚空中汲取的紫色水晶，内部翻涌着难以名状的暗影能量',
    value: 100,
    stackable: true,
    template: 'void_crystal'
  },
  {
    id: 'sunmote',
    name: '光辉之尘',
    icon: 'game-icons:sun',
    type: 'material',
    rarity: 'epic',
    level: 7,
    description: '圣光之泉高地散落的神圣尘埃，每一粒都闪耀着金色圣光，仿佛凝聚了整个太阳的祝福',
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
