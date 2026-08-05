/**
 * @fileoverview 装备物品数据模块
 * @description 包含所有武器和护甲装备数据
 * @module data/equipment
 */

import type { EquipmentItem, EquipmentItemDraft } from '../modules/equipment/types';
import { deriveSlots, SUBTYPE_OCCUPIES } from '../modules/equipment/slotRegistry';

// ============================================================================
// 武器类装备
// ============================================================================

/** 剑类武器 - 力量型战士首选 */
const SWORDS: EquipmentItemDraft[] = [
  {
    id: 'iron_sword',
    name: '铁剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 8 },
    rarity: 'common',
    description: '由辉石城军械库批量铸造的标准长剑，虽然朴实无华却陪伴无数新兵踏上冒险征程',
    value: 10,
    template: 'iron_sword',
    levelRequirement: 1
  },
  {
    id: 'steel_sword',
    name: '精钢长剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 12 },
    rarity: 'uncommon',
    description: '精炼钢材锻造的长剑，剑刃在阳光下泛着冷冽的寒光',
    value: 25,
    template: 'steel_sword',
    levelRequirement: 5
  },
  {
    id: 'mithril_sword',
    name: '秘银之刃',
    icon: 'game-icons:broadsword',
    bonus: { str: 18, dex: 5 },
    rarity: 'rare',
    description: '用卡兹山脉深矿井中开采的秘银锻造而成，剑身泛着淡蓝色的魔法辉光，削铁如泥',
    value: 50,
    template: 'mithril_sword',
    levelRequirement: 10
  },
  {
    id: 'ashkandi',
    name: '古王之剑·兄弟会之誓',
    icon: 'game-icons:broadsword',
    bonus: { str: 35, con: 15, dex: 10 },
    rarity: 'epic',
    description: '黑岩山脉铸造的传奇巨剑，曾属于光辉之剑的持有者',
    value: 180,
    template: 'ashkandi',
    levelRequirement: 15
  }
];

/** 双手剑类武器 - 占用主+副两槽，P3.2 双手武器 */
const GREATSWORDS: EquipmentItemDraft[] = [
  {
    id: 'thunderfury',
    name: '风暴之怒·烈风之刃',
    icon: 'game-icons:broadsword',
    bonus: { str: 55, dex: 35, int: 25 },
    rarity: 'legendary',
    description: '封印着风暴之灵王子灵魂的神剑，挥舞时雷霆随行，狂风为之呼啸',
    value: 380,
    template: 'thunderfury',
    levelRequirement: 20
  }
];

/** 斧类武器 - 高伤害力量型 */
const AXES: EquipmentItemDraft[] = [
  {
    id: 'iron_axe',
    name: '铁质战斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 10, con: 3 },
    rarity: 'common',
    description: '铁牙堡铁匠铺中用粗铁与怒火锤打而成，每一斧下去都带着铁血盟约战士特有的蛮横力道',
    value: 12,
    template: 'iron_axe',
    levelRequirement: 1
  },
  {
    id: 'mithril_axe',
    name: '秘银战斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 15, con: 5 },
    rarity: 'uncommon',
    description: '以轻灵秘银锻造的战斧，挥砍时迅捷如风又不失劈山裂石的威力',
    value: 28,
    template: 'mithril_axe',
    levelRequirement: 5
  },
  {
    id: 'arcanite_reaper',
    name: '黑铁战斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 25, con: 10 },
    rarity: 'rare',
    description: '以黑铁锭与魔能源质铸就的凶悍战斧，曾是那个年代每一位武器战士朝思暮想的终极武器',
    value: 75,
    template: 'arcanite_reaper',
    levelRequirement: 10
  },
  {
    id: 'dragon_talon_axe',
    name: '龙爪巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 35, dex: 15, con: 10 },
    rarity: 'epic',
    description: '将成年暗黑巨龙的巨爪完整取下后淬以熔岩锻造而成，挥动时仿佛能听到巨龙临死前的咆哮',
    value: 160,
    template: 'dragon_talon_axe',
    levelRequirement: 15
  }
];

/** 双手斧类武器 - 占用主+副两槽，P3.2 双手武器 */
const GREATAXES: EquipmentItemDraft[] = [
  {
    id: 'gorehowl',
    name: '裂颅之斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 50, con: 25 },
    rarity: 'legendary',
    description: '狂怒战王的传奇战斧，斧身每一道划痕都见证着兽人英雄的不朽传奇',
    value: 300,
    template: 'gorehowl',
    levelRequirement: 20
  }
];

/** 锤类武器 - 力量与体质兼备 */
const HAMMERS: EquipmentItemDraft[] = [
  {
    id: 'war_hammer',
    name: '战锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 10, con: 5 },
    rarity: 'common',
    description: '出自熔炉堡老牌矮人铁匠之手，锤头刻有粗犷的氏族符文，虽然朴素但砸在脑袋上绝不好受',
    value: 12,
    template: 'war_hammer',
    levelRequirement: 1
  },
  {
    id: 'steel_mace',
    name: '精钢铁锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 14, con: 8 },
    rarity: 'uncommon',
    description: '精钢锻造的沉重铁锤，每一次挥击都能让大地微微震颤',
    value: 30,
    template: 'steel_mace',
    levelRequirement: 5
  },
  {
    id: 'storm_hammer',
    name: '风暴战锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 25, con: 10 },
    rarity: 'rare',
    description: '矮人符文匠在雷暴之夜锻造的战锤，锤头萦绕着永不消散的闪电',
    value: 52,
    template: 'storm_hammer',
    levelRequirement: 10
  },
  {
    id: 'ironforge_smasher',
    name: '熔炉堡粉碎者',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 32, con: 15 },
    rarity: 'epic',
    description: '熔炉堡国王大厅深处锻造的史诗战锤，凝聚了矮人一族数千年的锻造智慧与对岩石的掌控之力',
    value: 145,
    template: 'ironforge_smasher',
    levelRequirement: 15
  },
  {
    id: 'sulfuras',
    name: '熔岩之锤·烈焰领主之手',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 65, con: 40, int: 20 },
    rarity: 'legendary',
    description: '烈焰领主以熔岩深渊火焰亲手淬炼的传奇战锤，仅仅是触碰它也会灼伤灵魂',
    value: 420,
    template: 'sulfuras',
    levelRequirement: 20
  }
];

/** 匕首武器 - 敏捷型职业首选 */
const DAGGERS: EquipmentItemDraft[] = [
  {
    id: 'dagger',
    name: '钢制匕首',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 10 },
    rarity: 'common',
    description: '辉石城暗影之刃配发给新兵的标准匕首，虽不起眼但在暗巷中足以割开皮甲与喉咙',
    value: 8,
    template: 'dagger',
    levelRequirement: 1
  },
  {
    id: 'poison_dagger',
    name: '毒蛇之牙',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 15 },
    rarity: 'uncommon',
    description: '刀身上涂满了从棘藤谷毒蛇腺体中提炼的致命毒液，只需划破皮肤便能让敌人在数息之间倒地',
    value: 22,
    template: 'poison_dagger',
    levelRequirement: 5
  },
  {
    id: 'shadow_dagger',
    name: '暗影匕首',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 22, int: 8 },
    rarity: 'rare',
    description: '由纯净暗影能量凝聚成的匕首，没有实体却比任何钢铁都锋利',
    value: 48,
    template: 'shadow_dagger',
    levelRequirement: 10
  },
  {
    id: 'void_blade',
    name: '虚空撕裂者',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 35, int: 20 },
    rarity: 'epic',
    description: '一把能够撕裂现实维度的神秘匕首，刃口处隐约可见扭曲虚空中的景象',
    value: 100,
    template: 'void_blade',
    levelRequirement: 15
  },
  {
    id: 'kingsfall',
    name: '王者陨落',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 55, str: 25, int: 20 },
    rarity: 'legendary',
    description: '曾刺穿过光辉盟约之王的传奇匕首，握在手中仍能感到来自亡者堡垒的彻骨寒意',
    value: 320,
    template: 'kingsfall',
    levelRequirement: 20
  }
];

/** 法杖武器 - 法师和治疗职业首选 */
const STAVES: EquipmentItemDraft[] = [
  {
    id: 'oak_staff',
    name: '橡木法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 10 },
    rarity: 'common',
    description: '由月辉林地千年橡木削成的法杖，手感温润，能稳定地引导魔法',
    value: 10,
    template: 'oak_staff',
    levelRequirement: 1
  },
  {
    id: 'crystal_staff',
    name: '水晶聚焦器',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 15, wis: 5 },
    rarity: 'uncommon',
    description: '顶端镶嵌着从水晶废墟中开采的魔力水晶，能将平庸的法术聚焦成致命光束',
    value: 28,
    template: 'crystal_staff',
    levelRequirement: 5
  },
  {
    id: 'arcane_staff',
    name: '奥术师法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 25, wis: 10 },
    rarity: 'rare',
    description: '奥法学院奥术议会授予高阶奥术师的荣誉法杖，杖身流淌着紫罗兰色的奥术之力',
    value: 55,
    template: 'arcane_staff',
    levelRequirement: 10
  },
  {
    id: 'jordan_staff',
    name: '先知法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 40, wis: 20, cha: 10 },
    rarity: 'epic',
    description: '奥术大师乔丹生前最后一件遗作，杖内封印着他毕生钻研的奥术真理',
    value: 150,
    template: 'jordan_staff',
    levelRequirement: 15
  },
  {
    id: 'atiesh',
    name: '星界守护者之杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 60, wis: 30, cha: 20 },
    rarity: 'legendary',
    description: '星界守护者的传说法杖，蕴含跨越次元的无上奥术之力，顶端的乌鸦雕饰仿佛仍在低语着观星之塔的秘密',
    value: 400,
    template: 'atiesh',
    levelRequirement: 20
  }
];

/** 弓类武器 - 猎人和游侠职业首选 */
const BOWS: EquipmentItemDraft[] = [
  {
    id: 'hunting_bow',
    name: '猎人长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 8 },
    rarity: 'common',
    description: '翠叶森林猎人们代代相传的朴素长弓，弓臂用老橡木熏烤成形，质朴却可靠',
    value: 10,
    template: 'hunting_bow',
    levelRequirement: 1
  },
  {
    id: 'reinforced_bow',
    name: '强化复合弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 14 },
    rarity: 'uncommon',
    description: '以兽筋和精钢加固的复合弓，拉力惊人，箭矢能穿透皮甲',
    value: 24,
    template: 'reinforced_bow',
    levelRequirement: 5
  },
  {
    id: 'raptor_bow',
    name: '疾风蜥猎弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 22, str: 8 },
    rarity: 'rare',
    description: '以棘藤谷利爪龙后腿筋为弓弦的强力猎弓，每次拉满弓弦都能感受到野兽蛮力与猎人技艺的交锋',
    value: 50,
    template: 'raptor_bow',
    levelRequirement: 10
  },
  {
    id: 'nerubian_bow',
    name: '虫甲长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 32, str: 12 },
    rarity: 'epic',
    description: '用虫族甲壳和蛛丝制作的恐怖长弓，射出的箭矢带有虫族毒液的诅咒',
    value: 130,
    template: 'nerubian_bow',
    levelRequirement: 15
  },
  {
    id: 'thori_dalis',
    name: '群星之怒·精灵长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 50, str: 20, wis: 15 },
    rarity: 'legendary',
    description: '圣光之泉高地掉落的传奇长弓，蕴含星辰之力',
    value: 350,
    template: 'thori_dalis',
    levelRequirement: 20
  }
];

/** 盾牌武器 - 防御型职业首选 */
const SHIELDS: EquipmentItemDraft[] = [
  {
    id: 'iron_shield',
    name: '铁盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 10 },
    rarity: 'common',
    description: '辉石城步兵团的制式装备，虽只是一块厚重的铸铁板，却曾为无数士兵挡下致命一击',
    value: 12,
    template: 'iron_shield',
    levelRequirement: 1
  },
  {
    id: 'steel_shield',
    name: '精钢护盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 18 },
    rarity: 'uncommon',
    description: '精钢锻造的重型护盾，盾面抛光如镜，能反射魔法飞弹',
    value: 30,
    template: 'steel_shield',
    levelRequirement: 5
  },
  {
    id: 'dragon_scale_shield',
    name: '龙鳞护盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 30, str: 10 },
    rarity: 'rare',
    description: '盾面镶嵌着成年暗黑巨龙的鳞片，每一片都在熔岩中淬炼过，寻常箭矢和刀剑根本无法留下印痕',
    value: 65,
    template: 'dragon_scale_shield',
    levelRequirement: 10
  },
  {
    id: 'holy_shield',
    name: '圣光壁垒',
    icon: 'game-icons:checked-shield',
    bonus: { con: 45, wis: 20, cha: 15 },
    rarity: 'epic',
    description: '白银之拳骑士团在古王国圣光礼拜堂中祈福加持的圣盾，邪恶亡灵触碰到它的瞬间便会灰飞烟灭',
    value: 130,
    template: 'holy_shield',
    levelRequirement: 15
  },
  {
    id: 'bulwark',
    name: '壁垒之盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 60, wis: 30, cha: 20, str: 15 },
    rarity: 'legendary',
    description: '虫巢圣殿掉落的传奇盾牌，坚不可摧',
    value: 280,
    template: 'bulwark',
    levelRequirement: 20
  }
];

// ============================================================================
// 护甲类装备
// ============================================================================

/** 胸甲装备 - 核心防御装备 */
const CHEST_ARMOR: EquipmentItemDraft[] = [
  {
    id: 'leather_chest',
    name: '荒野皮甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 5, dex: 8 },
    rarity: 'common',
    description: '用荒芜平原巨角兽皮鞣制而成的轻便胸甲，既不会阻碍游侠的灵活动作又能抵挡流矢与野兽利爪',
    value: 12,
    template: 'leather_chest',
    levelRequirement: 1
  },
  {
    id: 'chainmail_armor',
    name: '链甲护甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 10, dex: 5 },
    rarity: 'uncommon',
    description: '由数千枚精铁环扣编织的锁子甲，能有效抵御劈砍和穿刺',
    value: 30,
    template: 'chainmail_armor',
    levelRequirement: 5
  },
  {
    id: 'plate_chest',
    name: '板甲战衣',
    icon: 'game-icons:chest-armor',
    bonus: { con: 18, str: 10 },
    rarity: 'rare',
    description: '厚重的精钢板甲，虽然沉重但能抵御最凶猛的正面冲击',
    value: 60,
    template: 'plate_chest',
    levelRequirement: 10
  },
  {
    id: 'dragon_chestplate',
    name: '巨龙护甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 30, str: 20, dex: 10 },
    rarity: 'epic',
    description: '以成年赤红巨龙胸腹部最坚硬的鳞片锻造的传奇护甲，穿上后仿佛获得了巨龙心脏般不灭的生命力',
    value: 120,
    template: 'dragon_chestplate',
    levelRequirement: 15
  },
  {
    id: 'holy_armor',
    name: '圣光守护者',
    icon: 'game-icons:chest-armor',
    bonus: { con: 45, str: 30, wis: 20, cha: 15 },
    rarity: 'legendary',
    description: '在圣光礼拜堂中接受了七七四十九日圣光洗礼的神圣铠甲，金芒流转间如圣光化身降临人间',
    value: 250,
    template: 'holy_armor',
    levelRequirement: 20
  }
];

/** 护腿装备 - 腿部防御 */
const LEG_ARMOR: EquipmentItemDraft[] = [
  {
    id: 'leather_pants',
    name: '皮制护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 4, dex: 6 },
    rarity: 'common',
    description: '轻便的皮革护腿，内衬羊绒，穿着舒适又灵活',
    value: 8,
    template: 'leather_pants',
    levelRequirement: 1
  },
  {
    id: 'iron_leggings',
    name: '铁纹护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 8, str: 5 },
    rarity: 'uncommon',
    description: '用多块锻铁片拼接而成的护腿，虽然走路时嘎吱作响，但能有效保护双腿免受劈砍与钝器重击',
    value: 20,
    template: 'iron_leggings',
    levelRequirement: 5
  },
  {
    id: 'steel_leggings',
    name: '精钢腿甲',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 15, str: 10, dex: 5 },
    rarity: 'rare',
    description: '以熔岩深渊熔岩淬炼的精钢铸造而成的腿甲，关节处灵活自如，膝盖部位加厚钢板可硬接冲锋',
    value: 45,
    template: 'steel_leggings',
    levelRequirement: 10
  },
  {
    id: 'shadow_leggings',
    name: '暗影护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 25, str: 15, int: 10 },
    rarity: 'epic',
    description: '死灵学院暗影法师以黑暗仪式灌注的护腿，漆黑的表面下涌动着不安的暗影能量，仿佛活物般蠕动',
    value: 90,
    template: 'shadow_leggings',
    levelRequirement: 15
  },
  {
    id: 'frost_leggings',
    name: '冰霜巨人护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 38, str: 25, int: 20 },
    rarity: 'legendary',
    description: '寒霜废土永冻冰川深处铸造的护腿，寒气逼人，连巨龙之焰也难以融化',
    value: 180,
    template: 'frost_leggings',
    levelRequirement: 20
  }
];

/** 靴子装备 - 移动和敏捷 */
const BOOTS: EquipmentItemDraft[] = [
  {
    id: 'leather_boots',
    name: '旅行者之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 5 },
    rarity: 'common',
    description: '旅行者钟爱的轻便皮靴，穿久了完全感受不到它的存在',
    value: 8,
    template: 'leather_boots',
    levelRequirement: 1
  },
  {
    id: 'iron_boots',
    name: '铁履',
    icon: 'game-icons:leg-armor',
    bonus: { con: 5, dex: 5 },
    rarity: 'uncommon',
    description: '粗铁打造的行军战靴，坚固耐用，每一步踏在地面都铿锵有力，只是穿久了脚趾会冻得发麻',
    value: 20,
    template: 'iron_boots',
    levelRequirement: 5
  },
  {
    id: 'windwalker_boots',
    name: '疾风步靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 15, con: 8 },
    rarity: 'rare',
    description: '靴底附有鹰风图腾的魔法生效，穿上后身轻如燕，在战场上腾挪闪转如行云流水般自如',
    value: 45,
    template: 'windwalker_boots',
    levelRequirement: 10
  },
  {
    id: 'shadowstep_boots',
    name: '暗影疾行之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 25, int: 10 },
    rarity: 'epic',
    description: '暗影公会暗影行者代代传承的神秘靴子，穿上后脚步无声，如鬼魅般穿梭在阴影之中',
    value: 95,
    template: 'shadowstep_boots',
    levelRequirement: 15
  },
  {
    id: 'boots_of_the_winged_serpent',
    name: '飞蛇之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 35, int: 20, wis: 15 },
    rarity: 'legendary',
    description: '古都废墟丛林巨魔祭祀的靴子，穿上后身形如飞蛇般灵动迅捷',
    value: 190,
    template: 'boots_of_the_winged_serpent',
    levelRequirement: 20
  }
];

/** 手套装备 - 攻击和技能 */
const GLOVES: EquipmentItemDraft[] = [
  {
    id: 'leather_gloves',
    name: '皮手套',
    icon: 'game-icons:gauntlet',
    bonus: { dex: 4 },
    rarity: 'common',
    description: '用铁蹄兽皮缝制而成，指尖处特意削薄以便弓手敏锐感受弓弦的张力',
    value: 6,
    template: 'leather_gloves',
    levelRequirement: 1
  },
  {
    id: 'iron_gauntlets',
    name: '铁护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 6, dex: 4 },
    rarity: 'uncommon',
    description: '用粗糙的铁片拼铆而成，指节和手背处特别加固，一拳砸在兽人脸上也绝不手软',
    value: 18,
    template: 'iron_gauntlets',
    levelRequirement: 5
  },
  {
    id: 'steel_gauntlets',
    name: '精钢护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 12, dex: 8 },
    rarity: 'rare',
    description: '精钢锻造的护手，指节处镶嵌尖刺，一拳便能击碎头骨',
    value: 40,
    template: 'steel_gauntlets',
    levelRequirement: 10
  },
  {
    id: 'flame_gauntlets',
    name: '烈焰守卫',
    icon: 'game-icons:gauntlet',
    bonus: { str: 20, int: 15 },
    rarity: 'epic',
    description: '永远燃烧着不灭之焰的护手，即使是最寒冷的冬夜也温暖如春',
    value: 85,
    template: 'flame_gauntlets',
    levelRequirement: 15
  },
  {
    id: 'hand_of_justice',
    name: '正义之手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 30, int: 25, dex: 20 },
    rarity: 'legendary',
    description: '黑岩深渊掉落的传奇护手，蕴含正义之力',
    value: 170,
    template: 'hand_of_justice',
    levelRequirement: 20
  }
];

// ============================================================================
// 导出所有装备
// ============================================================================

/**
 * 所有可掉落装备物品数据（P3.1：subtype/grip 派生 slots/occupies）
 *
 * 配置层条目使用 EquipmentItemDraft（不含 subtype/grip/occupies/slots），
 * 导出时通过两层 map 转换为完整 EquipmentItem：
 * 1. 第一层：按分组添加 subtype（武器还加 grip）
 * 2. 第二层：由 subtype 派生 slots（SUBTYPE_SLOTS）和 occupies（SUBTYPE_OCCUPIES）
 *
 * 武器子类型映射：
 * - SWORDS → sword, one_handed（单手，可主可副）
 * - AXES → axe, one_handed
 * - HAMMERS → hammer, one_handed
 * - DAGGERS → dagger, one_handed
 * - STAVES → staff, one_handed
 * - GREATSWORDS → greatsword, two_handed（双手，占主+副，P3.2）
 * - GREATAXES → greataxe, two_handed（双手，占主+副，P3.2）
 * - BOWS → greatbow, two_handed（双手，占主+副，P3.2）
 * - SHIELDS → shield, off_hand（副手，只能副手）
 *
 * 护甲子类型映射（一部位一槽）：
 * - CHEST_ARMOR → chest, LEG_ARMOR → legs, BOOTS → boots, GLOVES → gloves
 *
 * @type {EquipmentItem[]}
 */
export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  // 武器类
  ...SWORDS.map(w => ({ ...w, subtype: 'sword' as const, grip: 'one_handed' as const })),
  ...AXES.map(w => ({ ...w, subtype: 'axe' as const, grip: 'one_handed' as const })),
  ...HAMMERS.map(w => ({ ...w, subtype: 'hammer' as const, grip: 'one_handed' as const })),
  ...DAGGERS.map(w => ({ ...w, subtype: 'dagger' as const, grip: 'one_handed' as const })),
  ...STAVES.map(w => ({ ...w, subtype: 'staff' as const, grip: 'one_handed' as const })),
  ...GREATSWORDS.map(w => ({ ...w, subtype: 'greatsword' as const, grip: 'two_handed' as const })),
  ...GREATAXES.map(w => ({ ...w, subtype: 'greataxe' as const, grip: 'two_handed' as const })),
  ...BOWS.map(w => ({ ...w, subtype: 'greatbow' as const, grip: 'two_handed' as const })),
  ...SHIELDS.map(w => ({ ...w, subtype: 'shield' as const, grip: 'off_hand' as const })),

  // 护甲类
  ...CHEST_ARMOR.map(a => ({ ...a, subtype: 'chest' as const })),
  ...LEG_ARMOR.map(a => ({ ...a, subtype: 'legs' as const })),
  ...BOOTS.map(a => ({ ...a, subtype: 'boots' as const })),
  ...GLOVES.map(a => ({ ...a, subtype: 'gloves' as const }))
].map(item => ({
  ...item,
  // P3.3：补全判别联合字面量（草稿 Omit 了 kind/stackable/consumable）
  kind: 'equipment' as const,
  stackable: false as const,
  consumable: false as const,
  slots: deriveSlots(item.subtype),
  occupies: SUBTYPE_OCCUPIES[item.subtype] ?? deriveSlots(item.subtype)
}));
