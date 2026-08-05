/**
 * @fileoverview 物品数据模块
 * @description 包含所有可获取的掉落物品详情（药水、食物、卷轴、材料等）
 *
 * P3.3 升级：条目改为草稿声明（含 subtype/effects，不含 kind/stackable/consumable），
 * 导出时补全判别联合字面量。旧版的 `type`/`effect`/`bonus` 三字段已统一为
 * `kind`+`subtype`+`effects[]`：
 * - 旧 `type: 'potion'` → 新 `kind: 'consumable', subtype: 'potion'`
 * - 旧 `effect: { type, value }`（单效果）→ 新 `effects: ItemEffect[]`（多效果数组）
 * - 旧 `bonus: { str: 1 }`（属性药剂）→ 新 `effects` 中 `type:'stat'` 效果（plan.md T5/T6）
 * - 旧 `stackable: true`/`consumable: true` → 由判别联合字面量约束，导出时补全
 *
 * 属性药剂识别（plan.md T6）：不再依赖 ATTRIBUTE_POTION_IDS 白名单硬编码，
 * 改由 effects 中是否存在 `type:'stat'` 效果表达。ATTRIBUTE_POTION_IDS 仍保留
 * 供 inventory/store.useItem 过渡使用（P3.3b 删除）。
 * @module data/item
 */

import type { ConsumableItem, MaterialItem } from '../modules/item/types';
import type { Capability } from '../modules/item/capabilityTypes';
import type { Item } from '../modules/inventory/types';

// ============================================================================
// 草稿类型定义（P3.3：配置层只声明业务字段，导出时补全字面量）
// ============================================================================

/**
 * 消耗品能力组合（plan.md §3.4/§3.5）
 *
 * 消耗品（药水/食物/卷轴）能力组合固定为：可描述 + 可使用 + 可堆叠 + 可出售。
 * 在 finalizeConsumable 注入，配置层无需逐条手填（与 kind/stackable/consumable
 * 同属配置层显式声明的字面量，非运行期派生）。
 */
const CONSUMABLE_CAPABILITIES: Capability[] = [
  'describable',
  'usable',
  'stackable',
  'sellable',
];

/**
 * 材料能力组合（plan.md §3.4/§3.5）
 *
 * 材料能力组合固定为：可描述 + 可堆叠 + 可出售（无使用效果）。
 */
const MATERIAL_CAPABILITIES: Capability[] = [
  'describable',
  'stackable',
  'sellable',
];

/**
 * 消耗品配置草稿类型
 *
 * 条目只需声明 subtype / effects / useMode 等业务字段，
 * kind / stackable / consumable / capabilities 恒定字面量在导出时由 map 补全。
 */
type ConsumableItemDraft = Omit<
  ConsumableItem,
  'kind' | 'stackable' | 'consumable' | 'capabilities'
>;

/**
 * 材料配置草稿类型
 *
 * 条目只需声明基础字段，kind / stackable / consumable / effects / capabilities 在导出时补全。
 */
type MaterialItemDraft = Omit<
  MaterialItem,
  'kind' | 'stackable' | 'consumable' | 'effects' | 'capabilities'
>;

// ============================================================================
// 药水类物品
// ============================================================================

/** 生命药水 - 恢复生命值 */
const HEALTH_POTIONS: ConsumableItemDraft[] = [
  {
    id: 'small_health_potion',
    name: '初级生命药水',
    icon: 'game-icons:health-potion',
    subtype: 'potion',
    rarity: 'common',
    level: 1,
    description: '一瓶散发着草药清香的生命药水，能快速愈合轻微伤口',
    value: 10,
    effects: [{ type: 'health_restore', value: 30 }],
    useMode: 'instant',
    template: 'small_health_potion'
  },
  {
    id: 'medium_health_potion',
    name: '次级生命药水',
    icon: 'game-icons:health-potion',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '由炼金师精心调配的红色药水，能有效愈合中度创伤',
    value: 25,
    effects: [{ type: 'health_restore', value: 60 }],
    useMode: 'instant',
    template: 'medium_health_potion'
  },
  {
    id: 'large_health_potion',
    name: '特效生命药水',
    icon: 'game-icons:health-potion',
    subtype: 'potion',
    rarity: 'rare',
    level: 5,
    description: '泛着金色光泽的特效生命药水，即使重伤也能迅速恢复',
    value: 50,
    effects: [{ type: 'health_restore', value: 100 }],
    useMode: 'instant',
    template: 'large_health_potion'
  },
  {
    id: 'super_health_potion',
    name: '超级生命药水',
    icon: 'game-icons:health-potion',
    subtype: 'potion',
    rarity: 'epic',
    level: 7,
    description: '据说是从深渊军团魔能炼金釜中诞生的奇迹药水，猩红的液体翻滚着令人敬畏的再生之力，即便是濒死的战士也能瞬间重返战场',
    value: 80,
    effects: [{ type: 'health_restore', value: 150 }],
    useMode: 'instant',
    template: 'super_health_potion'
  }
];

/** 法力药水 - 恢复法力值 */
const MANA_POTIONS: ConsumableItemDraft[] = [
  {
    id: 'small_mana_potion',
    name: '初级法力药水',
    icon: 'game-icons:magic-potion',
    subtype: 'potion',
    rarity: 'common',
    level: 1,
    description: '一瓶泛着淡蓝微光的法力药水，由银辉城学徒炼金师用魔力草与安神花蒸馏而成，足以补充数道低阶咒语所需的魔力',
    value: 10,
    effects: [{ type: 'mana_restore', value: 30 }],
    useMode: 'instant',
    template: 'small_mana_potion'
  },
  {
    id: 'medium_mana_potion',
    name: '次级法力药水',
    icon: 'game-icons:magic-potion',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '奥术师调配的蓝色药水，蕴含纯净的魔法能量',
    value: 25,
    effects: [{ type: 'mana_restore', value: 60 }],
    useMode: 'instant',
    template: 'medium_mana_potion'
  },
  {
    id: 'large_mana_potion',
    name: '特效法力药水',
    icon: 'game-icons:magic-potion',
    subtype: 'potion',
    rarity: 'rare',
    level: 5,
    description: '晶莹剔透的特效法力药水，由奥法学院资深奥术师以魔力蓟与光耀草精炼而成，饮下后魔力如泉水般从魔网深处奔涌而来',
    value: 50,
    effects: [{ type: 'mana_restore', value: 100 }],
    useMode: 'instant',
    template: 'large_mana_potion'
  },
  {
    id: 'super_mana_potion',
    name: '超级法力药水',
    icon: 'game-icons:magic-potion',
    subtype: 'potion',
    rarity: 'epic',
    level: 7,
    description: '从奥术之源碎片中提炼的超级法力药水，蕴含着近乎无穷的奥术能量',
    value: 80,
    effects: [{ type: 'mana_restore', value: 150 }],
    useMode: 'instant',
    template: 'super_mana_potion'
  }
];

/**
 * 属性药剂 - 永久提升属性
 *
 * 四层属性模型（见 plan.md §3.5）：属性药剂的属性加成通过 `effects` 中的
 * `type:'stat'` 效果表达（P3.3 升级，替代旧版 `bonus` 字段）。
 * inventory/store.ts 的 useItem 通过 `ATTRIBUTE_POTION_IDS` 识别此类药剂并调用
 * `characterStore.applyPotionBonus`，与 HP/MP 恢复药剂（走非 stat 效果）分支互斥。
 *
 * P3.3：effects 仅含一个 stat 效果，computeStatBonus 提取其 value 作为属性加成。
 */
const ATTRIBUTE_POTIONS: ConsumableItemDraft[] = [
  {
    id: 'strength_potion',
    name: '巨人之力药剂',
    icon: 'game-icons:round-bottom-flask',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '散发着原始蛮力的药剂，饮用后仿佛感受到远古巨人的血脉在体内奔涌',
    value: 50,
    effects: [{ type: 'stat', value: { str: 1 } }],
    useMode: 'instant',
    template: 'strength_potion'
  },
  {
    id: 'agility_potion',
    name: '猫鼬药剂',
    icon: 'game-icons:round-bottom-flask',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '用稀有猫鼬草提炼的敏捷药剂，能让你的动作如猎豹般迅捷',
    value: 50,
    effects: [{ type: 'stat', value: { dex: 1 } }],
    useMode: 'instant',
    template: 'agility_potion'
  },
  {
    id: 'constitution_potion',
    name: '坚韧药剂',
    icon: 'game-icons:round-bottom-flask',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '由矮人秘方调制的坚韧药剂，饮用后筋骨如精钢般坚硬',
    value: 50,
    effects: [{ type: 'stat', value: { con: 1 } }],
    useMode: 'instant',
    template: 'constitution_potion'
  },
  {
    id: 'intelligence_potion',
    name: '智慧药剂',
    icon: 'game-icons:round-bottom-flask',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '汇聚了奥法学院学者智慧的药剂，能让思维如水晶般通透',
    value: 50,
    effects: [{ type: 'stat', value: { int: 1 } }],
    useMode: 'instant',
    template: 'intelligence_potion'
  },
  {
    id: 'wisdom_potion',
    name: '洞察药剂',
    icon: 'game-icons:round-bottom-flask',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '由暮精灵祭司祝福的洞察药剂，能让感知穿透世俗的迷雾',
    value: 50,
    effects: [{ type: 'stat', value: { wis: 1 } }],
    useMode: 'instant',
    template: 'wisdom_potion'
  },
  {
    id: 'charisma_potion',
    name: '魅力药剂',
    icon: 'game-icons:round-bottom-flask',
    subtype: 'potion',
    rarity: 'uncommon',
    level: 3,
    description: '散发着迷人芬芳的魅力药剂，让旁人不由自主地心生好感',
    value: 50,
    effects: [{ type: 'stat', value: { cha: 1 } }],
    useMode: 'instant',
    template: 'charisma_potion'
  }
];

/**
 * 属性药剂 ID 白名单
 *
 * 用于 inventory 模块在 useItem 中区分属性药剂（永久叠加到 `potionStats`）与
 * HP/MP 恢复药剂（走即时效果）。基于 `ATTRIBUTE_POTIONS` 数组派生，
 * 避免在 inventory 中硬编码 6 个字符串 ID。
 *
 * 设计说明：P3.3 升级后属性药剂由 `effects` 中 `type:'stat'` 效果表达，
 * `computeStatBonus` 可统一提取 stat 加成。但 useItem 仍需区分两种应用路径：
 * - 属性药剂（命中本白名单）：永久叠加到药剂层 `potionStats`（不可重置）
 * - 其他带 stat 效果的消耗品（如龙息辣椒等食物）：走装备/天赋层 `bonusStats`
 * 仅靠 `effects[].type==='stat'` 无法区分两种语义，白名单是当前最简方案。
 * 未来若引入 `useMode: 'permanent' | 'temporary'` 字段或 buff 系统统一管理临时增益，
 * 可移除本白名单。
 *
 * @see useInventoryStore.useItem 属性药剂识别入口
 * @see useCharacterStore.applyPotionBonus 永久属性叠加 Action
 */
export const ATTRIBUTE_POTION_IDS: ReadonlySet<string> = new Set(
  ATTRIBUTE_POTIONS.map(p => p.id)
);

// ============================================================================
// 食物类物品
// ============================================================================

/** 普通食物 - 恢复少量生命值 */
const COMMON_FOOD: ConsumableItemDraft[] = [
  {
    id: 'bread',
    name: '黑面包',
    icon: 'game-icons:bread',
    subtype: 'food',
    rarity: 'common',
    level: 1,
    description: '辉石城烘焙作坊每天清晨新鲜出炉的黑面包，外皮酥脆内里松软，每一口都带着麦芽的甘甜与大地的质朴，是光辉盟约冒险者行囊里最温暖的味道',
    value: 5,
    effects: [{ type: 'health_restore', value: 20 }],
    useMode: 'instant',
    template: 'bread'
  },
  {
    id: 'roast_quail',
    name: '烤鹌鹑',
    icon: 'game-icons:chicken-leg',
    subtype: 'food',
    rarity: 'common',
    level: 1,
    description: '翠叶森林特产的烤鹌鹑，外皮焦香内里多汁，冒险者最爱的便携美食',
    value: 8,
    effects: [{ type: 'health_restore', value: 25 }],
    useMode: 'instant',
    template: 'roast_quail'
  }
];

/** 优质食物 - 恢复中等生命值 */
const PREMIUM_FOOD: ConsumableItemDraft[] = [
  {
    id: 'roasted_meat',
    name: '烤野猪肉',
    icon: 'game-icons:meat',
    subtype: 'food',
    rarity: 'uncommon',
    level: 3,
    description: '从翠叶森林猎来的野猪后腿，以秘制香料腌制后在篝火上慢烤至金黄，油脂滴落火焰的滋滋声就是冒险者最熟悉的安魂曲',
    value: 15,
    effects: [{ type: 'health_restore', value: 40 }],
    useMode: 'instant',
    template: 'roasted_meat'
  },
  {
    id: 'murloc_fin_soup',
    name: '蛙人鳍汤',
    icon: 'game-icons:bowl-of-rice',
    subtype: 'food',
    rarity: 'uncommon',
    level: 3,
    description: '用新鲜蛙人鳍搭配秘制香料慢火熬制的浓汤，鲜美得让人忘记蛙人的腥臭',
    value: 20,
    effects: [{ type: 'health_restore', value: 45 }],
    useMode: 'instant',
    template: 'murloc_fin_soup'
  },
  {
    id: 'stormwind_stew',
    name: '辉石城炖肉',
    icon: 'game-icons:hot-meal',
    subtype: 'food',
    rarity: 'uncommon',
    level: 3,
    description: '辉石城王家厨师传承三代的家传炖肉，香浓醇厚，连雄狮之王都赞不绝口',
    value: 25,
    effects: [{ type: 'health_restore', value: 50 }],
    useMode: 'instant',
    template: 'stormwind_stew'
  }
];

/** 稀有食物 - 恢复大量生命值，可能有额外效果 */
const RARE_FOOD: ConsumableItemDraft[] = [
  {
    id: 'magic_bread',
    name: '魔法蛋糕',
    icon: 'game-icons:cupcake',
    subtype: 'food',
    rarity: 'rare',
    level: 5,
    description: '奥法学院法师以魔法烘焙的精致糕点，入口即化，余味中带着淡淡的奥术回甘',
    value: 30,
    effects: [{ type: 'health_restore', value: 60 }],
    useMode: 'instant',
    template: 'magic_bread'
  },
  {
    id: 'dragon_breath_chili',
    name: '龙息辣椒',
    icon: 'game-icons:chili-pepper',
    subtype: 'food',
    rarity: 'rare',
    level: 5,
    description: '用龙息椒研磨而成的致命辣椒，据说只有最勇敢的冒险者才敢挑战第三口',
    value: 35,
    // P3.3：旧 effect（health_restore）+ 旧 bonus（{ str: 2 }）合并为 effects 数组
    effects: [
      { type: 'health_restore', value: 55 },
      { type: 'stat', value: { str: 2 } }
    ],
    useMode: 'instant',
    template: 'dragon_breath_chili'
  }
];

// ============================================================================
// 卷轴类物品
// ============================================================================

/** 攻击型卷轴 */
const OFFENSIVE_SCROLLS: ConsumableItemDraft[] = [
  {
    id: 'scroll_fireball',
    name: '卷轴：火球术',
    icon: 'game-icons:scroll-unfurled',
    subtype: 'scroll',
    rarity: 'uncommon',
    level: 3,
    description: '一张泛黄的羊皮卷轴，上面用火焰墨水书写着古老的火球术咒语',
    value: 40,
    effects: [{ type: 'magic_damage', value: 40 }],
    useMode: 'instant',
    template: 'scroll_fireball'
  },
  {
    id: 'scroll_blizzard',
    name: '卷轴：寒冰风暴',
    icon: 'game-icons:scroll-unfurled',
    subtype: 'scroll',
    rarity: 'rare',
    level: 5,
    description: '一张寒气逼人的古老卷轴，边缘凝结着永不融化的冰霜',
    value: 60,
    effects: [{ type: 'magic_damage', value: 70 }],
    useMode: 'instant',
    template: 'scroll_blizzard'
  },
  {
    id: 'scroll_chain_lightning',
    name: '卷轴：连锁雷击',
    icon: 'game-icons:scroll-unfurled',
    subtype: 'scroll',
    rarity: 'rare',
    level: 5,
    description: '一张封印着风暴之力的魔法卷轴，触摸时指尖能感受到微弱的电击',
    value: 55,
    effects: [{ type: 'magic_damage', value: 65 }],
    useMode: 'instant',
    template: 'scroll_chain_lightning'
  }
];

/** 治疗型卷轴 */
const HEALING_SCROLLS: ConsumableItemDraft[] = [
  {
    id: 'scroll_heal',
    name: '卷轴：治疗术',
    icon: 'game-icons:scroll-unfurled',
    subtype: 'scroll',
    rarity: 'uncommon',
    level: 3,
    description: '一张散发着柔和圣光的卷轴，记载着圣光教会传承的神圣祷文',
    value: 35,
    effects: [{ type: 'health_restore', value: 50 }],
    useMode: 'instant',
    template: 'scroll_heal'
  },
  {
    id: 'scroll_mass_heal',
    name: '卷轴：群体治疗',
    icon: 'game-icons:scroll-unfurled',
    subtype: 'scroll',
    rarity: 'epic',
    level: 7,
    description: '一张由大主教亲自祝福的神圣卷轴，展开时光芒能照亮整座教堂',
    value: 90,
    effects: [{ type: 'health_restore', value: 80 }],
    useMode: 'instant',
    template: 'scroll_mass_heal'
  }
];

// ============================================================================
// 材料类物品
// ============================================================================

/** 基础材料 */
const BASIC_MATERIALS: MaterialItemDraft[] = [
  {
    id: 'magic_dust',
    name: '奥术粉尘',
    icon: 'game-icons:cupcake',
    rarity: 'common',
    level: 1,
    description: '漂浮在奥法学院魔法回路中的奥术能量凝结而成的闪光粉尘，指尖触碰时会发出微弱的共鸣，是附魔与炼金术中最基础却也最不可或缺的神秘材料',
    value: 15,
    template: 'magic_dust'
  }
];

/** 稀有材料 */
const RARE_MATERIALS: MaterialItemDraft[] = [
  {
    id: 'dragon_scale',
    name: '赤红龙鳞',
    icon: 'game-icons:dragon-shield',
    rarity: 'rare',
    level: 5,
    description: '一片闪烁着赤红光泽的龙鳞，仍残存着巨龙的生命热能',
    value: 80,
    template: 'dragon_scale'
  },
  {
    id: 'dream_fragment',
    name: '翠绿碎片',
    icon: 'game-icons:emerald',
    rarity: 'rare',
    level: 5,
    description: '从翠绿梦境中散落的神秘碎片，静静散发着令人安心的绿色柔光',
    value: 65,
    template: 'dream_fragment'
  }
];

/** 元素精华 - 元素材料 */
const PRIMAL_MATERIALS: MaterialItemDraft[] = [
  {
    id: 'primal_life',
    name: '精粹生命',
    icon: 'game-icons:sprout',
    rarity: 'rare',
    level: 5,
    description: '从远古生命之树根系下凝聚的原始精华，蕴含着万物生长的力量',
    value: 50,
    template: 'primal_life'
  },
  {
    id: 'primal_fire',
    name: '精粹火焰',
    icon: 'game-icons:flame',
    rarity: 'rare',
    level: 5,
    description: '从火焰之地熔岩核心中提取的原始火焰精华，永不熄灭地燃烧着',
    value: 55,
    template: 'primal_fire'
  },
  {
    id: 'primal_water',
    name: '精粹之水',
    icon: 'game-icons:water-flask',
    rarity: 'rare',
    level: 5,
    description: '从风波角深海裂谷中凝聚的原始水之精华，内部流淌着永不止息的暗流',
    value: 50,
    template: 'primal_water'
  },
  {
    id: 'primal_air',
    name: '精粹空气',
    icon: 'game-icons:wind-hole',
    rarity: 'rare',
    level: 5,
    description: '在雷暴山巅永不止息的雷暴中凝聚而生的原始空气之精华，捧在手心能感受到风元素的低语与闪电的咆哮，是制作风系附魔与工程学装置的珍贵核心',
    value: 50,
    template: 'primal_air'
  },
  {
    id: 'primal_earth',
    name: '精粹大地',
    icon: 'game-icons:stone-block',
    rarity: 'rare',
    level: 5,
    description: '从地脉之渊的大地之心核心萃取而出的原始土之精华，浑厚的石质外壳下封印着山脉沉稳的脉动，触碰时仿佛能感受到整个大地的重量',
    value: 50,
    template: 'primal_earth'
  }
];

/** 史诗材料 */
const EPIC_MATERIALS: MaterialItemDraft[] = [
  {
    id: 'void_crystal',
    name: '暗影水晶',
    icon: 'game-icons:crystal-ball',
    rarity: 'epic',
    level: 7,
    description: '从扭曲虚空中汲取的紫色水晶，内部翻涌着难以名状的暗影能量',
    value: 100,
    template: 'void_crystal'
  },
  {
    id: 'sunmote',
    name: '光辉之尘',
    icon: 'game-icons:sun',
    rarity: 'epic',
    level: 7,
    description: '圣光之泉高地散落的神圣尘埃，每一粒都闪耀着金色圣光，仿佛凝聚了整个太阳的祝福',
    value: 95,
    template: 'sunmote'
  }
];

// ============================================================================
// 导出所有物品（P3.3：草稿 → 完整判别联合，补全字面量）
// ============================================================================

/**
 * 消耗品草稿 → 完整 ConsumableItem（补全 kind/stackable/consumable/capabilities 字面量）
 *
 * 消耗品恒为 kind='consumable'、stackable=true、consumable=true，
 * 能力组合固定为 CONSUMABLE_CAPABILITIES（可描述/可使用/可堆叠/可出售），
 * 由判别联合类型在编译期约束，配置层无需逐条手填。
 */
function finalizeConsumable(draft: ConsumableItemDraft): ConsumableItem {
  return {
    ...draft,
    kind: 'consumable' as const,
    stackable: true as const,
    consumable: true as const,
    capabilities: CONSUMABLE_CAPABILITIES,
  };
}

/**
 * 材料草稿 → 完整 MaterialItem（补全 kind/stackable/consumable/effects/capabilities 字面量）
 *
 * 材料恒为 kind='material'、stackable=true、consumable=false、effects=[]，
 * 能力组合固定为 MATERIAL_CAPABILITIES（可描述/可堆叠/可出售），由判别联合类型在编译期约束。
 */
function finalizeMaterial(draft: MaterialItemDraft): MaterialItem {
  return {
    ...draft,
    kind: 'material' as const,
    stackable: true as const,
    consumable: false as const,
    effects: [] as [],
    capabilities: MATERIAL_CAPABILITIES,
  };
}

/**
 * 所有可掉落非装备物品数据
 *
 * P3.3：草稿数组在导出时经 finalizeConsumable/finalizeMaterial 补全判别联合字面量，
 * 最终类型为 `Item`（ConsumableItem | MaterialItem 的联合成员）。
 *
 * @type {Item[]}
 */
export const LOOT_ITEMS: Item[] = [
  // 药水类
  ...HEALTH_POTIONS.map(finalizeConsumable),
  ...MANA_POTIONS.map(finalizeConsumable),
  ...ATTRIBUTE_POTIONS.map(finalizeConsumable),

  // 食物类
  ...COMMON_FOOD.map(finalizeConsumable),
  ...PREMIUM_FOOD.map(finalizeConsumable),
  ...RARE_FOOD.map(finalizeConsumable),

  // 卷轴类
  ...OFFENSIVE_SCROLLS.map(finalizeConsumable),
  ...HEALING_SCROLLS.map(finalizeConsumable),

  // 材料类
  ...BASIC_MATERIALS.map(finalizeMaterial),
  ...RARE_MATERIALS.map(finalizeMaterial),
  ...PRIMAL_MATERIALS.map(finalizeMaterial),
  ...EPIC_MATERIALS.map(finalizeMaterial)
];
