/**
 * @fileoverview 装备物品数据模块
 * @description 包含所有武器和护甲装备数据
 * @module data/equipment
 */

import type { EquipmentItem } from '../modules/equipment/types';

// ============================================================================
// 武器类装备
// ============================================================================

/** 剑类武器 - 力量型战士首选 */
const SWORDS: EquipmentItem[] = [
  {
    id: 'ironSword',
    name: '铁剑',
    icon: '⚔️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 8 },
    rarity: 'common',
    description: '普通的铁制长剑',
    value: 10,
    stackable: false,
    template: 'ironSword',
    levelRequirement: 1
  },
  {
    id: 'steelSword',
    name: '精钢长剑',
    icon: '⚔️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 12 },
    rarity: 'uncommon',
    description: '精炼钢材锻造的长剑',
    value: 25,
    stackable: false,
    template: 'steelSword',
    levelRequirement: 5
  },
  {
    id: 'mithrilSword',
    name: '秘银之刃',
    icon: '⚔️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 18, dex: 5 },
    rarity: 'rare',
    description: '蕴含神秘力量的秘银长剑',
    value: 50,
    stackable: false,
    template: 'mithrilSword',
    levelRequirement: 10
  },
  {
    id: 'ashkandi',
    name: '阿什坎迪，兄弟会之剑',
    icon: '⚔️🔥',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 35, con: 15, dex: 10 },
    rarity: 'epic',
    description: '黑石山铸造的传奇巨剑，曾属于安度因·洛萨',
    value: 180,
    stackable: false,
    template: 'ashkandi',
    levelRequirement: 15
  },
  {
    id: 'thunderfury',
    name: '雷霆之怒，逐风者的祝福之剑',
    icon: '⚡⚔️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 55, dex: 35, int: 25 },
    rarity: 'legendary',
    description: '封印着逐风者桑德兰灵魂的神剑',
    value: 380,
    stackable: false,
    template: 'thunderfury',
    levelRequirement: 20
  }
];

/** 斧类武器 - 高伤害力量型 */
const AXES: EquipmentItem[] = [
  {
    id: 'ironAxe',
    name: '铁质战斧',
    icon: '🪓',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 10, con: 3 },
    rarity: 'common',
    description: '铁匠铺打造的战斧',
    value: 12,
    stackable: false,
    template: 'ironAxe',
    levelRequirement: 1
  },
  {
    id: 'mithrilAxe',
    name: '秘银战斧',
    icon: '🪓',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 15, con: 5 },
    rarity: 'uncommon',
    description: '用轻盈的秘银锻造的战斧',
    value: 28,
    stackable: false,
    template: 'mithrilAxe',
    levelRequirement: 5
  },
  {
    id: 'arcaniteReaper',
    name: '奥金斧',
    icon: '🪓✨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 25, con: 10 },
    rarity: 'rare',
    description: '用奥金锻造的精良战斧',
    value: 75,
    stackable: false,
    template: 'arcaniteReaper',
    levelRequirement: 10
  },
  {
    id: 'dragonTalonAxe',
    name: '龙爪巨斧',
    icon: '🪓🐉',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 35, dex: 15, con: 10 },
    rarity: 'epic',
    description: '用巨龙之爪打造的沉重战斧',
    value: 160,
    stackable: false,
    template: 'dragonTalonAxe',
    levelRequirement: 15
  },
  {
    id: 'gorehowl',
    name: '血吼',
    icon: '🪓🩸',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 50, con: 25 },
    rarity: 'legendary',
    description: '格罗玛什·地狱咆哮的传奇战斧',
    value: 300,
    stackable: false,
    template: 'gorehowl',
    levelRequirement: 20
  }
];

/** 锤类武器 - 力量与体质兼备 */
const HAMMERS: EquipmentItem[] = [
  {
    id: 'warHammer',
    name: '战锤',
    icon: '🔨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 10, con: 5 },
    rarity: 'common',
    description: '矮人工匠锻造的沉重战锤',
    value: 12,
    stackable: false,
    template: 'warHammer',
    levelRequirement: 1
  },
  {
    id: 'steelMace',
    name: '精钢铁锤',
    icon: '🔨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 14, con: 8 },
    rarity: 'uncommon',
    description: '精钢锻造的铁锤',
    value: 30,
    stackable: false,
    template: 'steelMace',
    levelRequirement: 5
  },
  {
    id: 'stormHammer',
    name: '风暴战锤',
    icon: '🔨⚡',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 25, con: 10 },
    rarity: 'rare',
    description: '蕴含风暴之力的矮人战锤',
    value: 52,
    stackable: false,
    template: 'stormHammer',
    levelRequirement: 10
  },
  {
    id: 'ironforgeSmasher',
    name: '铁炉堡粉碎者',
    icon: '�🏔️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 32, con: 15 },
    rarity: 'epic',
    description: '铁炉堡矮人大师锻造的战锤',
    value: 145,
    stackable: false,
    template: 'ironforgeSmasher',
    levelRequirement: 15
  },
  {
    id: 'sulfuras',
    name: '萨弗拉斯，炎魔拉格纳罗斯之手',
    icon: '🔨🔥',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { str: 65, con: 40, int: 20 },
    rarity: 'legendary',
    description: '炎魔之王拉格纳罗斯的传奇战锤',
    value: 420,
    stackable: false,
    template: 'sulfuras',
    levelRequirement: 20
  }
];

/** 匕首武器 - 敏捷型职业首选 */
const DAGGERS: EquipmentItem[] = [
  {
    id: 'dagger',
    name: '钢制匕首',
    icon: '�️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 10 },
    rarity: 'common',
    description: '普通的匕首',
    value: 8,
    stackable: false,
    template: 'dagger',
    levelRequirement: 1
  },
  {
    id: 'poisonDagger',
    name: '毒蛇之牙',
    icon: '☠️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 15 },
    rarity: 'uncommon',
    description: '涂抹致命毒药的匕首',
    value: 22,
    stackable: false,
    template: 'poisonDagger',
    levelRequirement: 5
  },
  {
    id: 'shadowDagger',
    name: '暗影匕首',
    icon: '🖤',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 22, int: 8 },
    rarity: 'rare',
    description: '暗影能量凝聚的匕首',
    value: 48,
    stackable: false,
    template: 'shadowDagger',
    levelRequirement: 10
  },
  {
    id: 'voidBlade',
    name: '虚空撕裂者',
    icon: '🌌',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 35, int: 20 },
    rarity: 'epic',
    description: '撕裂虚空的神秘匕首',
    value: 100,
    stackable: false,
    template: 'voidBlade',
    levelRequirement: 15
  },
  {
    id: 'kingsfall',
    name: '王者陨落',
    icon: '🗡️👑',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 55, str: 25, int: 20 },
    rarity: 'legendary',
    description: '纳克萨玛斯掉落的传奇匕首，曾刺穿过国王心脏',
    value: 320,
    stackable: false,
    template: 'kingsfall',
    levelRequirement: 20
  }
];

/** 法杖武器 - 法师和治疗职业首选 */
const STAVES: EquipmentItem[] = [
  {
    id: 'oakStaff',
    name: '橡木法杖',
    icon: '🪄',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { int: 10 },
    rarity: 'common',
    description: '普通的橡木法杖',
    value: 10,
    stackable: false,
    template: 'oakStaff',
    levelRequirement: 1
  },
  {
    id: 'crystalStaff',
    name: '水晶聚焦器',
    icon: '🔮',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { int: 15, wis: 5 },
    rarity: 'uncommon',
    description: '镶嵌水晶的精致法杖',
    value: 28,
    stackable: false,
    template: 'crystalStaff',
    levelRequirement: 5
  },
  {
    id: 'arcaneStaff',
    name: '奥术师法杖',
    icon: '✨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { int: 25, wis: 10 },
    rarity: 'rare',
    description: '蕴含强大奥术能量的法杖',
    value: 55,
    stackable: false,
    template: 'arcaneStaff',
    levelRequirement: 10
  },
  {
    id: 'jordanStaff',
    name: '乔丹法杖',
    icon: '🪄✨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { int: 40, wis: 20, cha: 10 },
    rarity: 'epic',
    description: '大法师乔丹遗留的奥术法杖',
    value: 150,
    stackable: false,
    template: 'jordanStaff',
    levelRequirement: 15
  },
  {
    id: 'atiesh',
    name: '埃提耶什，守护者的传说之杖',
    icon: '🪄✨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { int: 60, wis: 30, cha: 20 },
    rarity: 'legendary',
    description: '守护者麦迪文的传说法杖，蕴含无尽奥术之力',
    value: 400,
    stackable: false,
    template: 'atiesh',
    levelRequirement: 20
  }
];

/** 弓类武器 - 猎人和游侠职业首选 */
const BOWS: EquipmentItem[] = [
  {
    id: 'huntingBow',
    name: '猎人长弓',
    icon: '🏹',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 8 },
    rarity: 'common',
    description: '猎人常用的长弓',
    value: 10,
    stackable: false,
    template: 'huntingBow',
    levelRequirement: 1
  },
  {
    id: 'reinforcedBow',
    name: '强化复合弓',
    icon: '🏹',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 14 },
    rarity: 'uncommon',
    description: '用强化材料制作的复合弓',
    value: 24,
    stackable: false,
    template: 'reinforcedBow',
    levelRequirement: 5
  },
  {
    id: 'raptorBow',
    name: '迅猛龙猎弓',
    icon: '🏹',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 22, str: 8 },
    rarity: 'rare',
    description: '用迅猛龙筋制作的强力猎弓',
    value: 50,
    stackable: false,
    template: 'raptorBow',
    levelRequirement: 10
  },
  {
    id: 'nerubianBow',
    name: '蛛魔长弓',
    icon: '🏹🕷️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 32, str: 12 },
    rarity: 'epic',
    description: '用蛛魔材料制作的强力长弓',
    value: 130,
    stackable: false,
    template: 'nerubianBow',
    levelRequirement: 15
  },
  {
    id: 'thoriDalis',
    name: '索利达尔，群星之怒',
    icon: '🏹⭐',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { dex: 50, str: 20, wis: 15 },
    rarity: 'legendary',
    description: '太阳之井高地掉落的传奇长弓，蕴含星辰之力',
    value: 350,
    stackable: false,
    template: 'thoriDalis',
    levelRequirement: 20
  }
];

/** 盾牌武器 - 防御型职业首选 */
const SHIELDS: EquipmentItem[] = [
  {
    id: 'ironShield',
    name: '铁盾',
    icon: '🛡️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { con: 10 },
    rarity: 'common',
    description: '普通的铁盾',
    value: 12,
    stackable: false,
    template: 'ironShield',
    levelRequirement: 1
  },
  {
    id: 'steelShield',
    name: '精钢护盾',
    icon: '🛡️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { con: 18 },
    rarity: 'uncommon',
    description: '精钢锻造的盾牌',
    value: 30,
    stackable: false,
    template: 'steelShield',
    levelRequirement: 5
  },
  {
    id: 'dragonScaleShield',
    name: '龙鳞护盾',
    icon: '🐉',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { con: 30, str: 10 },
    rarity: 'rare',
    description: '龙鳞镶嵌的盾牌',
    value: 65,
    stackable: false,
    template: 'dragonScaleShield',
    levelRequirement: 10
  },
  {
    id: 'holyShield',
    name: '圣光壁垒',
    icon: '☀️',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { con: 45, wis: 20, cha: 15 },
    rarity: 'epic',
    description: '圣光加持的神圣盾牌',
    value: 130,
    stackable: false,
    template: 'holyShield',
    levelRequirement: 15
  },
  {
    id: 'bulwark',
    name: '壁垒之盾',
    icon: '🛡️✨',
    type: 'weapon',
    slots: ['weapon1', 'weapon2'],
    bonus: { con: 60, wis: 30, cha: 20, str: 15 },
    rarity: 'legendary',
    description: '安其拉神殿掉落的传奇盾牌，坚不可摧',
    value: 280,
    stackable: false,
    template: 'bulwark',
    levelRequirement: 20
  }
];

// ============================================================================
// 护甲类装备
// ============================================================================

/** 胸甲装备 - 核心防御装备 */
const CHEST_ARMOR: EquipmentItem[] = [
  {
    id: 'leatherChest',
    name: '荒野皮甲',
    icon: '👕',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 5, dex: 8 },
    rarity: 'common',
    description: '轻便的皮甲护胸',
    value: 12,
    stackable: false,
    template: 'leatherChest',
    levelRequirement: 1
  },
  {
    id: 'chainmailArmor',
    name: '链甲护甲',
    icon: '🛡️',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 10, dex: 5 },
    rarity: 'uncommon',
    description: '由金属环编织的锁子甲',
    value: 30,
    stackable: false,
    template: 'chainmailArmor',
    levelRequirement: 5
  },
  {
    id: 'plateChest',
    name: '板甲战衣',
    icon: '🛡️',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 18, str: 10 },
    rarity: 'rare',
    description: '厚重的板甲护胸',
    value: 60,
    stackable: false,
    template: 'plateChest',
    levelRequirement: 10
  },
  {
    id: 'dragonChestplate',
    name: '巨龙护甲',
    icon: '🐉',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 30, str: 20, dex: 10 },
    rarity: 'epic',
    description: '用巨龙鳞片锻造的传奇胸甲',
    value: 120,
    stackable: false,
    template: 'dragonChestplate',
    levelRequirement: 15
  },
  {
    id: 'holyArmor',
    name: '圣光守护者',
    icon: '☀️',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 45, str: 30, wis: 20, cha: 15 },
    rarity: 'legendary',
    description: '沐浴圣光的神圣铠甲',
    value: 250,
    stackable: false,
    template: 'holyArmor',
    levelRequirement: 20
  }
];

/** 护腿装备 - 腿部防御 */
const LEG_ARMOR: EquipmentItem[] = [
  {
    id: 'leatherPants',
    name: '皮制护腿',
    icon: '👖',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 4, dex: 6 },
    rarity: 'common',
    description: '轻便的皮制长裤',
    value: 8,
    stackable: false,
    template: 'leatherPants',
    levelRequirement: 1
  },
  {
    id: 'ironLeggings',
    name: '铁纹护腿',
    icon: '🦵',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 8, str: 5 },
    rarity: 'uncommon',
    description: '铁制护腿',
    value: 20,
    stackable: false,
    template: 'ironLeggings',
    levelRequirement: 5
  },
  {
    id: 'steelLeggings',
    name: '精钢腿甲',
    icon: '🦵',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 15, str: 10, dex: 5 },
    rarity: 'rare',
    description: '精炼钢材打造的护腿',
    value: 45,
    stackable: false,
    template: 'steelLeggings',
    levelRequirement: 10
  },
  {
    id: 'shadowLeggings',
    name: '暗影护腿',
    icon: '🖤',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 25, str: 15, int: 10 },
    rarity: 'epic',
    description: '暗影能量灌注的护腿',
    value: 90,
    stackable: false,
    template: 'shadowLeggings',
    levelRequirement: 15
  },
  {
    id: 'frostLeggings',
    name: '冰霜巨人护腿',
    icon: '🧊',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 38, str: 25, int: 20 },
    rarity: 'legendary',
    description: '永冻冰川铸造的护腿',
    value: 180,
    stackable: false,
    template: 'frostLeggings',
    levelRequirement: 20
  }
];

/** 靴子装备 - 移动和敏捷 */
const BOOTS: EquipmentItem[] = [
  {
    id: 'leatherBoots',
    name: '旅行者之靴',
    icon: '👢',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { dex: 5 },
    rarity: 'common',
    description: '轻便的皮靴',
    value: 8,
    stackable: false,
    template: 'leatherBoots',
    levelRequirement: 1
  },
  {
    id: 'ironBoots',
    name: '铁履',
    icon: '👢',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { con: 5, dex: 5 },
    rarity: 'uncommon',
    description: '铁制护靴',
    value: 20,
    stackable: false,
    template: 'ironBoots',
    levelRequirement: 5
  },
  {
    id: 'windwalkerBoots',
    name: '疾风步靴',
    icon: '💨',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { dex: 15, con: 8 },
    rarity: 'rare',
    description: '轻盈如风的魔法靴子',
    value: 45,
    stackable: false,
    template: 'windwalkerBoots',
    levelRequirement: 10
  },
  {
    id: 'shadowstepBoots',
    name: '暗影步之靴',
    icon: '👻',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { dex: 25, int: 10 },
    rarity: 'epic',
    description: '暗影行走者的神秘靴子',
    value: 95,
    stackable: false,
    template: 'shadowstepBoots',
    levelRequirement: 15
  },
  {
    id: 'bootsOfTheWingedSerpent',
    name: '飞蛇之靴',
    icon: '👢⚡',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { dex: 35, int: 20, wis: 15 },
    rarity: 'legendary',
    description: '祖尔格拉布掉落的传奇靴子，轻盈如飞蛇',
    value: 190,
    stackable: false,
    template: 'bootsOfTheWingedSerpent',
    levelRequirement: 20
  }
];

/** 手套装备 - 攻击和技能 */
const GLOVES: EquipmentItem[] = [
  {
    id: 'leatherGloves',
    name: '皮手套',
    icon: '🧤',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { dex: 4 },
    rarity: 'common',
    description: '轻便的皮手套',
    value: 6,
    stackable: false,
    template: 'leatherGloves',
    levelRequirement: 1
  },
  {
    id: 'ironGauntlets',
    name: '铁护手',
    icon: '🧤',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { str: 6, dex: 4 },
    rarity: 'uncommon',
    description: '铁制护手',
    value: 18,
    stackable: false,
    template: 'ironGauntlets',
    levelRequirement: 5
  },
  {
    id: 'steelGauntlets',
    name: '精钢护手',
    icon: '⚔️',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { str: 12, dex: 8 },
    rarity: 'rare',
    description: '精钢锻造的护手',
    value: 40,
    stackable: false,
    template: 'steelGauntlets',
    levelRequirement: 10
  },
  {
    id: 'flameGauntlets',
    name: '烈焰守卫',
    icon: '🔥',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { str: 20, int: 15 },
    rarity: 'epic',
    description: '燃烧着永恒火焰的护手',
    value: 85,
    stackable: false,
    template: 'flameGauntlets',
    levelRequirement: 15
  },
  {
    id: 'handOfJustice',
    name: '正义之手',
    icon: '🧤⚖️',
    type: 'armor',
    slots: ['armor1', 'armor2', 'armor3', 'armor4'],
    bonus: { str: 30, int: 25, dex: 20 },
    rarity: 'legendary',
    description: '黑石深渊掉落的传奇护手，蕴含正义之力',
    value: 170,
    stackable: false,
    template: 'handOfJustice',
    levelRequirement: 20
  }
];

// ============================================================================
// 导出所有装备
// ============================================================================

/**
 * 所有可掉落装备物品数据
 * @type {EquipmentItem[]}
 */
export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  // 武器类
  ...SWORDS,
  ...AXES,
  ...HAMMERS,
  ...DAGGERS,
  ...STAVES,
  ...BOWS,
  ...SHIELDS,
  
  // 护甲类
  ...CHEST_ARMOR,
  ...LEG_ARMOR,
  ...BOOTS,
  ...GLOVES
];
