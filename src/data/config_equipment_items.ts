/**
 * @fileoverview 装备物品数据模块
 * @description 包含所有武器和护甲装备数据
 * @module data/equipment
 */

import type { EquipmentItem, EquipmentItemDraft } from '../modules/equipment/types';
import type { Capability } from '../modules/item/capabilityTypes';
import { deriveSlots, SUBTYPE_OCCUPIES } from '../modules/equipment/slotRegistry';

// ============================================================================
// 装备能力组合（plan.md §3.4/§3.5）
// ============================================================================

/**
 * 普通装备能力组合：可描述 + 可装备 + 可出售 + 可附魔
 *
 * config_equipment_items 中的装备均为普通装备（无 setId / 无主动技能），
 * 能力组合固定，在导出 map 注入（与 kind/stackable/consumable 同属配置层显式声明）。
 * 套装部件（setMember）/ 魔法武器（usable）见 config_class_equipment 与 C3 复合物品。
 */
const EQUIPMENT_CAPABILITIES: Capability[] = [
  'describable',
  'equippable',
  'sellable',
  'enchantable',
];

/**
 * 法杖能力组合：可描述 + 可装备 + 可使用 + 可出售 + 可附魔
 *
 * C3 复合物品：法杖是首个 equippable + usable 复合装备。
 * 'usable' 能力 + effects 主动技能（magic_damage）实现"持杖施法"语义：
 * 法杖必须装备到武器槽后，战斗中方可通过物品菜单施放主动技能，且不消耗物品。
 */
const STAFF_CAPABILITIES: Capability[] = [
  'describable',
  'equippable',
  'usable',
  'sellable',
  'enchantable',
];

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
    id: 'bronze_shortsword',
    name: '青铜短剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 10 },
    rarity: 'common',
    description: '辉石城学徒匠人练习铸造的青铜短剑，剑身略带铜绿却胜在易得，是新兵最常佩戴的随身兵刃',
    value: 15,
    template: 'bronze_shortsword',
    levelRequirement: 3
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
    id: 'knight_longsword',
    name: '骑士长剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 16 },
    rarity: 'uncommon',
    description: '白银之拳骑士团制式装备，剑柄缠绕圣纹皮革，握持时仿佛能感受到骑士誓言的余温',
    value: 42,
    template: 'knight_longsword',
    levelRequirement: 8
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
    id: 'moonlight_blade',
    name: '月光之刃',
    icon: 'game-icons:broadsword',
    bonus: { str: 24, dex: 8 },
    rarity: 'rare',
    description: '月辉林地祭司在双月高悬之夜淬火的奇剑，剑身流转着银白月华，挥砍时如月光倾泻',
    value: 95,
    template: 'moonlight_blade',
    levelRequirement: 13
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
  },
  {
    id: 'rune_carved_sword',
    name: '符文刻剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 38, con: 15, dex: 10 },
    rarity: 'epic',
    description: '矮人符文匠在熔炉堡深层熔岩旁刻就的符文长剑，剑身符文在战斗中迸裂出灼热火星',
    value: 250,
    template: 'rune_carved_sword',
    levelRequirement: 18
  },
  {
    id: 'dragon_slayer_blade',
    name: '屠龙之刃',
    icon: 'game-icons:broadsword',
    bonus: { str: 45, dex: 18, con: 12 },
    rarity: 'legendary',
    description: '卡兹山脉英雄斩杀赤红巨龙后以其胸骨锻造的传奇长剑，剑刃至今仍残留着龙血的余温',
    value: 360,
    template: 'dragon_slayer_blade',
    levelRequirement: 20
  },
  {
    id: 'eternity_blade',
    name: '永恒之刃',
    icon: 'game-icons:broadsword',
    bonus: { str: 65, dex: 25, con: 20 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古神兵，传说其锋芒能斩断时间本身，唯有时之守护者方可驾驭',
    value: 550,
    template: 'eternity_blade',
    levelRequirement: 20
  }
];

/** 双手剑类武器 - 占用主+副两槽，P3.2 双手武器 */
const GREATSWORDS: EquipmentItemDraft[] = [
  {
    id: 'iron_greatsword',
    name: '铁制巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 20 },
    rarity: 'common',
    description: '辉石城军械库为重装步兵铸造的双手巨剑，挥动需倾尽全身之力，却能将盾阵一刀两断',
    value: 12,
    template: 'iron_greatsword',
    levelRequirement: 1
  },
  {
    id: 'bronze_greatsword',
    name: '青铜巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 25 },
    rarity: 'common',
    description: '荒芜平原佣兵团批量配备的青铜巨剑，沉重而粗陋，胜在锻造简单且足以劈开野兽颅骨',
    value: 16,
    template: 'bronze_greatsword',
    levelRequirement: 3
  },
  {
    id: 'steel_greatsword',
    name: '精钢巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 30 },
    rarity: 'uncommon',
    description: '熔炉堡精钢锻就的双手巨剑，剑身宽阔厚实，挥砍时宛如银色门扇横扫战场',
    value: 30,
    template: 'steel_greatsword',
    levelRequirement: 5
  },
  {
    id: 'jagged_greatsword',
    name: '锯齿巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 35, con: 8 },
    rarity: 'uncommon',
    description: '黑岩山脉铁匠刻意留下的锯齿剑刃，每一道缺口都是过往战斗的勋章，撕裂伤口难以愈合',
    value: 50,
    template: 'jagged_greatsword',
    levelRequirement: 8
  },
  {
    id: 'mithril_greatsword',
    name: '秘银巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 38, dex: 12 },
    rarity: 'rare',
    description: '卡兹山脉秘银矿脉锻造的轻巧巨剑，看似笨重却轻盈异常，挥舞时剑身泛起淡蓝魔法辉光',
    value: 65,
    template: 'mithril_greatsword',
    levelRequirement: 10
  },
  {
    id: 'rune_greatsword',
    name: '符文巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 45, dex: 15 },
    rarity: 'rare',
    description: '矮人符文匠在剑脊上錾刻了十二道力量符文的双手巨剑，符文激活时整把剑嗡鸣震颤',
    value: 100,
    template: 'rune_greatsword',
    levelRequirement: 13
  },
  {
    id: 'dragonbone_greatsword',
    name: '龙骨巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 50, dex: 18, con: 12 },
    rarity: 'epic',
    description: '以成年赤红巨龙股骨打磨淬火的史诗巨剑，剑身隐约可见龙骨纹理，挥动时龙吟阵阵',
    value: 160,
    template: 'dragonbone_greatsword',
    levelRequirement: 15
  },
  {
    id: 'void_greatsword',
    name: '虚空巨剑',
    icon: 'game-icons:broadsword',
    bonus: { str: 55, dex: 22, int: 15 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑巨剑，挥砍时空间如水面般泛起涟漪',
    value: 240,
    template: 'void_greatsword',
    levelRequirement: 18
  },
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
  },
  {
    id: 'apocalypse_blade',
    name: '末日之刃',
    icon: 'game-icons:broadsword',
    bonus: { str: 75, dex: 40, int: 30, con: 25 },
    rarity: 'legendary',
    description: '熔岩深渊最底层封印的太古终末之剑，传说其出鞘之时便是世界终结之刻，剑心涌动着末日之火',
    value: 580,
    template: 'apocalypse_blade',
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
    id: 'bronze_handaxe',
    name: '铜质手斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 12, con: 4 },
    rarity: 'common',
    description: '铁牙堡外围村落的日常用斧，挥砍柴木之余也能在山贼来袭时充当防身利器',
    value: 16,
    template: 'bronze_handaxe',
    levelRequirement: 3
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
    id: 'berserker_axe',
    name: '狂战士之斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 18, con: 6 },
    rarity: 'uncommon',
    description: '荒芜平原狂战士部落代代相传的战斧，斧柄浸透了历代主人的鲜血与怒火',
    value: 45,
    template: 'berserker_axe',
    levelRequirement: 8
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
    id: 'bone_cleaver',
    name: '碎骨者',
    icon: 'game-icons:battle-axe',
    bonus: { str: 26, con: 10 },
    rarity: 'rare',
    description: '以巨魔肩胛骨为斧背、黑铁为斧刃的稀有战斧，每一次劈砍都能听到骨头碎裂的脆响',
    value: 95,
    template: 'bone_cleaver',
    levelRequirement: 13
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
  },
  {
    id: 'warlord_axe',
    name: '军阀之斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 36, con: 15, dex: 10 },
    rarity: 'epic',
    description: '黑岩山脉军阀部落首领的权杖之斧，斧身镶嵌的血宝石在战意高涨时会发出妖艳红光',
    value: 260,
    template: 'warlord_axe',
    levelRequirement: 18
  },
  {
    id: 'bloodthirst_axe',
    name: '嗜血战斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 48, con: 20, dex: 12 },
    rarity: 'legendary',
    description: '熔岩深渊血魔以凝血锻就的传奇战斧，每斩一敌便愈发鲜红，仿佛在贪婪地吮吸鲜血',
    value: 370,
    template: 'bloodthirst_axe',
    levelRequirement: 20
  },
  {
    id: 'worldbreaker_axe',
    name: '裂界者',
    icon: 'game-icons:battle-axe',
    bonus: { str: 68, con: 30, dex: 15 },
    rarity: 'legendary',
    description: '古都废墟深处出土的太古巨斧，传说其曾一斧劈开山岳，斧刃裂痕中至今涌动着地脉之力',
    value: 560,
    template: 'worldbreaker_axe',
    levelRequirement: 20
  }
];

/** 双手斧类武器 - 占用主+副两槽，P3.2 双手武器 */
const GREATAXES: EquipmentItemDraft[] = [
  {
    id: 'iron_greataxe',
    name: '铁制巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 20, con: 8 },
    rarity: 'common',
    description: '铁牙堡铁匠为重装斧兵铸造的双手巨斧，斧头沉重如石，挥砍时带着不可阻挡的惯性',
    value: 12,
    template: 'iron_greataxe',
    levelRequirement: 1
  },
  {
    id: 'bronze_greataxe',
    name: '青铜巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 25, con: 10 },
    rarity: 'common',
    description: '荒芜平原兽人氏族批量锻造的青铜巨斧，粗糙却致命，一斧下去足以劈开皮甲与肋骨',
    value: 16,
    template: 'bronze_greataxe',
    levelRequirement: 3
  },
  {
    id: 'steel_greataxe',
    name: '精钢巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 30, con: 12 },
    rarity: 'uncommon',
    description: '熔炉堡精钢锻就的双手巨斧，斧刃经多次淬火，锋利到能将马鞍一并斩断',
    value: 30,
    template: 'steel_greataxe',
    levelRequirement: 5
  },
  {
    id: 'jagged_greataxe',
    name: '锯齿巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 35, con: 14 },
    rarity: 'uncommon',
    description: '黑岩山脉蛮族刻意打磨的锯齿斧刃，砍中敌人时会顺势撕裂肌肉与血管，伤口触目惊心',
    value: 50,
    template: 'jagged_greataxe',
    levelRequirement: 8
  },
  {
    id: 'mithril_greataxe',
    name: '秘银巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 38, con: 15, dex: 8 },
    rarity: 'rare',
    description: '卡兹山脉秘银矿脉锻造的轻巧巨斧，挥舞速度远胜同侪，斧身流转着淡蓝魔法辉光',
    value: 65,
    template: 'mithril_greataxe',
    levelRequirement: 10
  },
  {
    id: 'rune_greataxe',
    name: '符文巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 45, con: 18, dex: 10 },
    rarity: 'rare',
    description: '矮人符文匠在斧背錾刻了十二道符文的双手巨斧，符文激活时斧身燃烧着炽热红光',
    value: 100,
    template: 'rune_greataxe',
    levelRequirement: 13
  },
  {
    id: 'dragon_greataxe',
    name: '巨龙之斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 50, con: 22, dex: 12 },
    rarity: 'epic',
    description: '以成年赤红巨龙肩骨与鳞片锻造的史诗巨斧，挥动时龙吟阵阵，仿佛巨龙之魂仍在咆哮',
    value: 160,
    template: 'dragon_greataxe',
    levelRequirement: 15
  },
  {
    id: 'void_greataxe',
    name: '虚空巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 55, con: 28, dex: 15 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑巨斧，斧刃所过之处空间隐隐扭曲',
    value: 240,
    template: 'void_greataxe',
    levelRequirement: 18
  },
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
  },
  {
    id: 'world_cleaver',
    name: '裂界巨斧',
    icon: 'game-icons:battle-axe',
    bonus: { str: 72, con: 40, dex: 18 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古巨斧，传说其曾一斧劈开大地形成峡谷，斧身至今涌动着地脉之力',
    value: 580,
    template: 'world_cleaver',
    levelRequirement: 20
  }
];

/** 长柄武器 - 双手武器，占主+副两槽 */
const POLEARMS: EquipmentItemDraft[] = [
  {
    id: 'wooden_spear',
    name: '木制长矛',
    icon: 'game-icons:barbed-spear',
    bonus: { str: 10, dex: 8 },
    rarity: 'common',
    description: '翠叶森林猎人随手削制的白蜡木长矛，矛尖以燧石打磨，质朴却足以刺穿野兽心脏',
    value: 10,
    template: 'wooden_spear',
    levelRequirement: 1
  },
  {
    id: 'iron_spear',
    name: '铁尖长矛',
    icon: 'game-icons:barbed-spear',
    bonus: { str: 12, dex: 10 },
    rarity: 'common',
    description: '辉石城民兵制式装备，铁质矛尖经淬火后坚硬锋利，长柄可远距离拒敌于丈外',
    value: 14,
    template: 'iron_spear',
    levelRequirement: 3
  },
  {
    id: 'steel_halberd',
    name: '精钢战戟',
    icon: 'game-icons:halberd',
    bonus: { str: 16, dex: 12 },
    rarity: 'uncommon',
    description: '熔炉堡为城卫军打造的制式战戟，斧刃与矛尖结合，可劈可刺，是阵地战中的多面利器',
    value: 25,
    template: 'steel_halberd',
    levelRequirement: 5
  },
  {
    id: 'jagged_pike',
    name: '锯齿长枪',
    icon: 'game-icons:barbed-spear',
    bonus: { str: 20, dex: 15 },
    rarity: 'uncommon',
    description: '荒芜平原佣兵在矛尖刻下倒刺的长枪，刺入后拔出会带出大块血肉，杀伤力骇人',
    value: 45,
    template: 'jagged_pike',
    levelRequirement: 8
  },
  {
    id: 'mithril_spear',
    name: '秘银长矛',
    icon: 'game-icons:barbed-spear',
    bonus: { str: 22, dex: 18 },
    rarity: 'rare',
    description: '卡兹山脉秘银锻就的轻盈长矛，矛身泛着淡蓝魔法辉光，刺击时快如闪电难以闪避',
    value: 60,
    template: 'mithril_spear',
    levelRequirement: 10
  },
  {
    id: 'rune_polearm',
    name: '符文长柄',
    icon: 'game-icons:halberd',
    bonus: { str: 26, dex: 22 },
    rarity: 'rare',
    description: '矮人符文匠在长柄上錾刻符文的稀有战戟，符文激活时矛尖缠绕着雷电之力',
    value: 95,
    template: 'rune_polearm',
    levelRequirement: 13
  },
  {
    id: 'dragon_lance',
    name: '巨龙长枪',
    icon: 'game-icons:barbed-spear',
    bonus: { str: 32, dex: 25, con: 10 },
    rarity: 'epic',
    description: '以成年赤红巨龙尾骨与鳞片锻造的史诗长枪，曾一枪刺穿过同伴巨龙的胸膛',
    value: 150,
    template: 'dragon_lance',
    levelRequirement: 15
  },
  {
    id: 'void_halberd',
    name: '虚空战戟',
    icon: 'game-icons:halberd',
    bonus: { str: 38, dex: 30, int: 12 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑战戟，挥舞时空间如镜面般泛起涟漪',
    value: 240,
    template: 'void_halberd',
    levelRequirement: 18
  },
  {
    id: 'celestial_spear',
    name: '天界长矛',
    icon: 'game-icons:barbed-spear',
    bonus: { str: 45, dex: 35, wis: 15 },
    rarity: 'legendary',
    description: '圣光之泉高地天使遗落人间的传奇长矛，矛尖凝聚着星光，刺击时如流星划破夜空',
    value: 350,
    template: 'celestial_spear',
    levelRequirement: 20
  },
  {
    id: 'eternity_polearm',
    name: '永恒长柄',
    icon: 'game-icons:halberd',
    bonus: { str: 60, dex: 45, con: 20 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古神兵，传说其曾刺穿时间之壁，柄身流转着永恒不灭的星辉',
    value: 580,
    template: 'eternity_polearm',
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
    id: 'iron_maul',
    name: '铁制大锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 12, con: 6 },
    rarity: 'common',
    description: '辉石城工兵标配的沉重铁锤，本是用于敲碎城门与拒马，砸在敌人身上同样令人骨碎',
    value: 15,
    template: 'iron_maul',
    levelRequirement: 3
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
    id: 'spiked_mace',
    name: '尖刺锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 18, con: 10 },
    rarity: 'uncommon',
    description: '熔炉堡铁匠在锤头镶嵌尖刺的改良战锤，挥击时既能钝击又能刺穿，敌人防不胜防',
    value: 42,
    template: 'spiked_mace',
    levelRequirement: 8
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
    id: 'rune_hammer',
    name: '符文战锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 28, con: 12 },
    rarity: 'rare',
    description: '矮人符文匠在锤头錾刻符文的稀有战锤，符文激活时锤身萦绕着永不消散的雷霆',
    value: 95,
    template: 'rune_hammer',
    levelRequirement: 13
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
    id: 'thunder_crash_hammer',
    name: '雷霆坠击锤',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 38, con: 18, wis: 10 },
    rarity: 'epic',
    description: '黑岩山脉雷暴之夜锻造的史诗战锤，挥动时雷云随行，锤落之处必有惊雷炸响',
    value: 260,
    template: 'thunder_crash_hammer',
    levelRequirement: 18
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
  },
  {
    id: 'world_smasher',
    name: '碎界者',
    icon: 'game-icons:flat-hammer',
    bonus: { str: 70, con: 45, int: 25 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古战锤，传说其曾一锤震碎山岳，锤心至今涌动着大地的怒吼',
    value: 580,
    template: 'world_smasher',
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
    id: 'rusty_dagger',
    name: '锈蚀匕首',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 12 },
    rarity: 'common',
    description: '暗影公会废弃的锈蚀匕首，虽已锈迹斑斑，但刀刃上残留的毒素仍能让伤口溃烂',
    value: 12,
    template: 'rusty_dagger',
    levelRequirement: 3
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
    id: 'twin_fang',
    name: '双子之牙',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 18 },
    rarity: 'uncommon',
    description: '棘藤谷双头蛇的毒牙淬炼而成的稀有匕首，双刃如獠牙般弯曲，刺入即注入剧毒',
    value: 38,
    template: 'twin_fang',
    levelRequirement: 8
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
    id: 'spectral_dagger',
    name: '幽灵匕首',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 26, int: 10 },
    rarity: 'rare',
    description: '死灵学院幽灵法师以亡灵之力凝聚的半透明匕首，能直接刺穿灵魂无视皮甲防御',
    value: 95,
    template: 'spectral_dagger',
    levelRequirement: 13
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
    id: 'abyss_dagger',
    name: '深渊匕首',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 40, int: 22 },
    rarity: 'epic',
    description: '熔岩深渊恶魔领主馈赠给暗影公会主的史诗匕首，刃身流淌着深渊的低语',
    value: 260,
    template: 'abyss_dagger',
    levelRequirement: 18
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
  },
  {
    id: 'void_piercer',
    name: '虚空穿刺者',
    icon: 'game-icons:plain-dagger',
    bonus: { dex: 65, str: 30, int: 25 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古匕首，传说其曾刺穿维度之壁，刃口至今涌动着扭曲虚空的景象',
    value: 560,
    template: 'void_piercer',
    levelRequirement: 20
  }
];

/** 法杖武器 - 法师和治疗职业首选（双手武器，占主+副两槽；保留 C3 复合物品 usable 主动技能） */
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
    levelRequirement: 1,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 15 }]
  },
  {
    id: 'ash_staff',
    name: '白蜡法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 12 },
    rarity: 'common',
    description: '月辉林地新手法师惯用的白蜡木法杖，杖身温润如玉，能稳定引导初阶魔法不致反噬',
    value: 15,
    template: 'ash_staff',
    levelRequirement: 3,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 20 }]
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
    levelRequirement: 5,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 25 }]
  },
  {
    id: 'ember_staff',
    name: '余烬法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 18, wis: 6 },
    rarity: 'uncommon',
    description: '熔炉堡余烬祭司以熔岩淬火的法杖，杖顶镶嵌的火晶石永不熄灭，能将火系法术威力倍增',
    value: 42,
    template: 'ember_staff',
    levelRequirement: 8,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 32 }]
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
    levelRequirement: 10,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 40 }]
  },
  {
    id: 'frost_staff',
    name: '寒霜法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 28, wis: 12 },
    rarity: 'rare',
    description: '寒霜废土永冻冰川深处采掘的冰晶法杖，杖身寒气逼人，挥动时空气中的水汽瞬间凝结成霜',
    value: 95,
    template: 'frost_staff',
    levelRequirement: 13,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 50 }]
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
    levelRequirement: 15,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 60 }]
  },
  {
    id: 'nether_staff',
    name: '幽冥法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 45, wis: 22, cha: 12 },
    rarity: 'epic',
    description: '死灵学院幽冥议会授予高阶死灵法师的史诗法杖，杖身涌动着幽蓝幽冥之力，低语声不绝于耳',
    value: 260,
    template: 'nether_staff',
    levelRequirement: 18,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 75 }]
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
    levelRequirement: 20,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 90 }]
  },
  {
    id: 'cosmos_staff',
    name: '宇宙法杖',
    icon: 'game-icons:crystal-wand',
    bonus: { int: 70, wis: 35, cha: 25 },
    rarity: 'legendary',
    description: '观星之塔顶层的太古法杖，传说其能沟通星界，杖顶的星辰结晶中封印着一片微型宇宙',
    value: 580,
    template: 'cosmos_staff',
    levelRequirement: 20,
    // C3：魔法武器主动技能（持杖施法，可重复使用不消耗）
    effects: [{ type: 'magic_damage', value: 100 }]
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
    id: 'short_bow',
    name: '短弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 10 },
    rarity: 'common',
    description: '翠叶森林新晋猎人惯用的短弓，弓臂柔韧易拉，虽射程有限却胜在轻便灵巧',
    value: 12,
    template: 'short_bow',
    levelRequirement: 3
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
    id: 'yew_longbow',
    name: '紫杉长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 18 },
    rarity: 'uncommon',
    description: '月辉林地百年紫杉木削制的长弓，弓身弹性十足，箭矢射出时带着破空的清啸',
    value: 38,
    template: 'yew_longbow',
    levelRequirement: 8
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
    id: 'phantom_bow',
    name: '幻影长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 26, str: 10 },
    rarity: 'rare',
    description: '暗影公会幻影射手以暗影之力灌注的稀有长弓，拉弦时弓身若隐若现，箭无虚发',
    value: 95,
    template: 'phantom_bow',
    levelRequirement: 13
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
    id: 'tempest_bow',
    name: '风暴长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 38, str: 14 },
    rarity: 'epic',
    description: '黑岩山脉雷暴之夜锻造的史诗长弓，弓弦以雷云纺成，箭矢离弦时雷霆相随',
    value: 260,
    template: 'tempest_bow',
    levelRequirement: 18
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
  },
  {
    id: 'celestial_bow',
    name: '天界长弓',
    icon: 'game-icons:high-shot',
    bonus: { dex: 60, str: 25, wis: 18 },
    rarity: 'legendary',
    description: '圣光之泉天界使者遗落人间的传奇长弓，拉满时弦上凝聚星光，箭出如流星坠地',
    value: 560,
    template: 'celestial_bow',
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
    id: 'wooden_shield',
    name: '木盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 12 },
    rarity: 'common',
    description: '翠叶森林猎人以老橡木拼制的朴素木盾，虽粗糙却轻便，足以挡下流矢与野兽扑击',
    value: 14,
    template: 'wooden_shield',
    levelRequirement: 3
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
    id: 'kite_shield',
    name: '鸢形盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 22 },
    rarity: 'uncommon',
    description: '白银之拳骑士团制式鸢形盾，盾面狭长便于护住大腿，冲锋时如银色羽翼展开',
    value: 38,
    template: 'kite_shield',
    levelRequirement: 8
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
    id: 'runic_shield',
    name: '符文盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 35, str: 12 },
    rarity: 'rare',
    description: '矮人符文匠在盾面錾刻守护符文的稀有盾牌，符文激活时盾前凝聚出一道淡蓝护盾',
    value: 95,
    template: 'runic_shield',
    levelRequirement: 13
  },
  {
    id: 'holy_shield',
    name: '圣光壁垒',
    icon: 'game-icons:checked-shield',
    bonus: { con: 35, wis: 15, cha: 10 },
    rarity: 'epic',
    description: '白银之拳骑士团在古王国圣光礼拜堂中祈福加持的圣盾，邪恶亡灵触碰到它的瞬间便会灰飞烟灭',
    value: 130,
    template: 'holy_shield',
    levelRequirement: 15
  },
  {
    id: 'aegis_shield',
    name: '神盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 38, wis: 16, cha: 12 },
    rarity: 'epic',
    description: '圣光之泉高阶祭司在圣光礼拜堂祈福七日的史诗盾牌，邪魔触之即灰飞烟灭',
    value: 260,
    template: 'aegis_shield',
    levelRequirement: 18
  },
  {
    id: 'bulwark',
    name: '壁垒之盾',
    icon: 'game-icons:checked-shield',
    bonus: { con: 45, wis: 22, cha: 15, str: 10 },
    rarity: 'legendary',
    description: '虫巢圣殿掉落的传奇盾牌，坚不可摧',
    value: 280,
    template: 'bulwark',
    levelRequirement: 20
  },
  {
    id: 'eternal_bulwark',
    name: '永恒壁垒',
    icon: 'game-icons:checked-shield',
    bonus: { con: 52, wis: 26, cha: 18, str: 12 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古神盾，传说其曾独自抵挡过灭世洪水，盾面至今流转着不灭圣光',
    value: 580,
    template: 'eternal_bulwark',
    levelRequirement: 20
  }
];

// ============================================================================
// 护甲类装备
// ============================================================================

/** 头部护甲装备 - 头部防御 */
const HELM_ARMOR: EquipmentItemDraft[] = [
  {
    id: 'leather_cap',
    name: '皮盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 4, dex: 3 },
    rarity: 'common',
    description: '翠叶森林猎人惯用的轻便皮盔，内衬羊绒缓冲撞击，戴久了几乎感觉不到它的存在',
    value: 8,
    template: 'leather_cap',
    levelRequirement: 1
  },
  {
    id: 'iron_helm',
    name: '铁盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 6 },
    rarity: 'common',
    description: '辉石城步兵团制式铁盔，虽沉重却能稳稳挡下一记战锤，是无数新兵活下来的倚仗',
    value: 12,
    template: 'iron_helm',
    levelRequirement: 3
  },
  {
    id: 'steel_helm',
    name: '精钢盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 8, str: 3 },
    rarity: 'uncommon',
    description: '熔炉堡精钢锻就的头盔，盔顶铆接加强钢条，正面撞击也难以留下凹陷',
    value: 25,
    template: 'steel_helm',
    levelRequirement: 5
  },
  {
    id: 'knight_helm',
    name: '骑士盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 12, str: 5 },
    rarity: 'uncommon',
    description: '白银之拳骑士团制式全盔，面罩可放下护住整张脸，戴上后只见圣光映照的双眼',
    value: 45,
    template: 'knight_helm',
    levelRequirement: 8
  },
  {
    id: 'mithril_helm',
    name: '秘银盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 15, str: 6, dex: 4 },
    rarity: 'rare',
    description: '卡兹山脉秘银锻就的轻巧头盔，盔身泛着淡蓝魔法辉光，佩戴者反应敏捷如风',
    value: 55,
    template: 'mithril_helm',
    levelRequirement: 10
  },
  {
    id: 'rune_helm',
    name: '符文盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 18, str: 8, wis: 5 },
    rarity: 'rare',
    description: '矮人符文匠在盔顶錾刻守护符文的稀有头盔，符文激活时眼前浮现淡蓝护盾',
    value: 95,
    template: 'rune_helm',
    levelRequirement: 13
  },
  {
    id: 'dragon_helm',
    name: '巨龙头盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 22, str: 12, dex: 6 },
    rarity: 'epic',
    description: '以成年赤红巨龙头骨打磨淬火的史诗头盔，盔顶的龙角仍能发出威慑一切的低吼',
    value: 150,
    template: 'dragon_helm',
    levelRequirement: 15
  },
  {
    id: 'void_helm',
    name: '虚空头盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 28, str: 15, int: 10 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑头盔，戴上后能窥见常人不可见的暗影',
    value: 240,
    template: 'void_helm',
    levelRequirement: 18
  },
  {
    id: 'crown_of_wisdom',
    name: '智慧之冠',
    icon: 'game-icons:visored-helm',
    bonus: { con: 35, str: 20, wis: 15, int: 12 },
    rarity: 'legendary',
    description: '观星之塔历代塔主传承的传奇冠冕，戴上后思如泉涌，仿佛能听到星辰的低语',
    value: 350,
    template: 'crown_of_wisdom',
    levelRequirement: 20
  },
  {
    id: 'eternity_helm',
    name: '永恒之盔',
    icon: 'game-icons:visored-helm',
    bonus: { con: 50, str: 30, wis: 20, cha: 15 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古头盔，传说其曾护住太古英雄斩杀邪神，盔心至今涌动着永恒之力',
    value: 580,
    template: 'eternity_helm',
    levelRequirement: 20
  }
];

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
    id: 'padded_armor',
    name: '棉甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 6, dex: 5 },
    rarity: 'common',
    description: '辉石城民兵惯用的厚棉甲，层层棉布缝缀铜钉，虽朴素却能挡下流矢与轻击',
    value: 14,
    template: 'padded_armor',
    levelRequirement: 3
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
    id: 'scale_armor',
    name: '鳞甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 12, dex: 6 },
    rarity: 'uncommon',
    description: '荒芜平原佣兵团惯用的鳞片胸甲，钢鳞层层叠覆，刀剑难入却又不失灵活',
    value: 45,
    template: 'scale_armor',
    levelRequirement: 8
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
    id: 'mithril_chainmail',
    name: '秘银链甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 20, str: 10, dex: 8 },
    rarity: 'rare',
    description: '卡兹山脉秘银锻就的稀有链甲，环扣泛着淡蓝魔法辉光，轻盈如羽却坚逾精钢',
    value: 95,
    template: 'mithril_chainmail',
    levelRequirement: 13
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
    id: 'void_chestplate',
    name: '虚空胸甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 30, str: 18, int: 12 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑胸甲，甲面如镜映出扭曲的暗影',
    value: 240,
    template: 'void_chestplate',
    levelRequirement: 18
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
  },
  {
    id: 'eternal_armor',
    name: '永恒战甲',
    icon: 'game-icons:chest-armor',
    bonus: { con: 50, str: 35, wis: 25, cha: 20 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古战甲，传说其曾伴随太古英雄征战四方，甲心涌动着永恒不灭之力',
    value: 580,
    template: 'eternal_armor',
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
    id: 'padded_leggings',
    name: '棉护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 5, dex: 4 },
    rarity: 'common',
    description: '辉石城民兵惯用的厚棉护腿，层层棉布缝缀铜钉，虽朴素却能挡下流矢与轻击',
    value: 10,
    template: 'padded_leggings',
    levelRequirement: 3
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
    id: 'scale_leggings',
    name: '鳞片护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 10, str: 4 },
    rarity: 'uncommon',
    description: '荒芜平原佣兵团惯用的鳞片护腿，钢鳞层层叠覆，关节处仍灵活自如',
    value: 40,
    template: 'scale_leggings',
    levelRequirement: 8
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
    id: 'mithril_leggings',
    name: '秘银护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 18, str: 8, dex: 5 },
    rarity: 'rare',
    description: '卡兹山脉秘银锻就的稀有护腿，腿甲泛着淡蓝魔法辉光，轻盈如羽却坚逾精钢',
    value: 95,
    template: 'mithril_leggings',
    levelRequirement: 13
  },
  {
    id: 'shadow_leggings',
    name: '暗影护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 25, str: 15, int: 10 },
    rarity: 'epic',
    description: '死灵学院暗影法师以黑暗仪式灌注的护腿，漆黑的表面下涌动着不安的暗影能量，仿佛活物般蠕动',
    value: 100,
    template: 'shadow_leggings',
    levelRequirement: 15
  },
  {
    id: 'void_leggings',
    name: '虚空护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 28, str: 15, int: 10 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑护腿，腿甲表面如镜映出扭曲的暗影',
    value: 240,
    template: 'void_leggings',
    levelRequirement: 18
  },
  {
    id: 'frost_leggings',
    name: '冰霜巨人护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 38, str: 25, int: 20 },
    rarity: 'legendary',
    description: '寒霜废土永冻冰川深处铸造的护腿，寒气逼人，连巨龙之焰也难以融化',
    value: 250,
    template: 'frost_leggings',
    levelRequirement: 20
  },
  {
    id: 'eternal_legguards',
    name: '永恒护腿',
    icon: 'game-icons:armor-cuisses',
    bonus: { con: 45, str: 25, wis: 18 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古护腿，传说其曾伴随太古英雄征战四方，腿甲涌动着永恒之力',
    value: 580,
    template: 'eternal_legguards',
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
    id: 'padded_boots',
    name: '棉靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 6 },
    rarity: 'common',
    description: '辉石城民兵惯用的厚棉靴，鞋底缝缀铜钉防滑，长途行军也能保持轻盈步伐',
    value: 10,
    template: 'padded_boots',
    levelRequirement: 3
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
    id: 'scale_boots',
    name: '鳞片靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 10, con: 4 },
    rarity: 'uncommon',
    description: '荒芜平原佣兵团惯用的鳞片战靴，钢鳞覆盖脚背，既灵活又能挡住刀剑偷袭',
    value: 40,
    template: 'scale_boots',
    levelRequirement: 8
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
    id: 'mithril_boots',
    name: '秘银靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 18, con: 8 },
    rarity: 'rare',
    description: '卡兹山脉秘银锻就的稀有战靴，靴身泛着淡蓝魔法辉光，轻盈如羽却坚逾精钢',
    value: 95,
    template: 'mithril_boots',
    levelRequirement: 13
  },
  {
    id: 'shadowstep_boots',
    name: '暗影疾行之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 25, int: 10 },
    rarity: 'epic',
    description: '暗影公会暗影行者代代传承的神秘靴子，穿上后脚步无声，如鬼魅般穿梭在阴影之中',
    value: 100,
    template: 'shadowstep_boots',
    levelRequirement: 15
  },
  {
    id: 'void_boots',
    name: '虚空之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 28, int: 12 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑战靴，踏出的每一步都让空间微微扭曲',
    value: 240,
    template: 'void_boots',
    levelRequirement: 18
  },
  {
    id: 'boots_of_the_winged_serpent',
    name: '飞蛇之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 35, int: 20, wis: 15 },
    rarity: 'legendary',
    description: '古都废墟丛林巨魔祭祀的靴子，穿上后身形如飞蛇般灵动迅捷',
    value: 250,
    template: 'boots_of_the_winged_serpent',
    levelRequirement: 20
  },
  {
    id: 'eternal_boots',
    name: '永恒之靴',
    icon: 'game-icons:leg-armor',
    bonus: { dex: 40, int: 22, wis: 15 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古战靴，传说其曾伴随太古英雄踏遍九幽，靴心涌动着永恒之力',
    value: 580,
    template: 'eternal_boots',
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
    id: 'padded_gloves',
    name: '棉手套',
    icon: 'game-icons:gauntlet',
    bonus: { dex: 5 },
    rarity: 'common',
    description: '辉石城民兵惯用的厚棉手套，指尖处削薄以便拉弓扣弦，既能护手又不失灵活',
    value: 8,
    template: 'padded_gloves',
    levelRequirement: 3
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
    id: 'scale_gauntlets',
    name: '鳞片护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 8, dex: 6 },
    rarity: 'uncommon',
    description: '荒芜平原佣兵团惯用的鳞片护手，钢鳞覆盖手背，指节处加固足以一拳击碎头骨',
    value: 40,
    template: 'scale_gauntlets',
    levelRequirement: 8
  },
  {
    id: 'steel_gauntlets',
    name: '精钢护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 12, dex: 8 },
    rarity: 'rare',
    description: '精钢锻造的护手，指节处镶嵌尖刺，一拳便能击碎头骨',
    value: 45,
    template: 'steel_gauntlets',
    levelRequirement: 10
  },
  {
    id: 'mithril_gauntlets',
    name: '秘银护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 15, dex: 10 },
    rarity: 'rare',
    description: '卡兹山脉秘银锻就的稀有护手，手背泛着淡蓝魔法辉光，握持武器时反应迅捷如风',
    value: 95,
    template: 'mithril_gauntlets',
    levelRequirement: 13
  },
  {
    id: 'flame_gauntlets',
    name: '烈焰守卫',
    icon: 'game-icons:gauntlet',
    bonus: { str: 20, int: 15 },
    rarity: 'epic',
    description: '永远燃烧着不灭之焰的护手，即使是最寒冷的冬夜也温暖如春',
    value: 100,
    template: 'flame_gauntlets',
    levelRequirement: 15
  },
  {
    id: 'void_gauntlets',
    name: '虚空护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 25, int: 18 },
    rarity: 'epic',
    description: '死灵学院暗影法师以扭曲虚空能量灌注的幽黑护手，握住武器时掌心涌动着暗影之力',
    value: 240,
    template: 'void_gauntlets',
    levelRequirement: 18
  },
  {
    id: 'hand_of_justice',
    name: '正义之手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 30, int: 25, dex: 20 },
    rarity: 'legendary',
    description: '黑岩深渊掉落的传奇护手，蕴含正义之力',
    value: 250,
    template: 'hand_of_justice',
    levelRequirement: 20
  },
  {
    id: 'eternal_gauntlets',
    name: '永恒护手',
    icon: 'game-icons:gauntlet',
    bonus: { str: 35, int: 28, dex: 22 },
    rarity: 'legendary',
    description: '古都废墟最深处封印的太古护手，传说其曾握住过神兵斩杀邪神，掌心涌动着永恒之力',
    value: 580,
    template: 'eternal_gauntlets',
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
 * - STAVES → staff, two_handed（双手，占主+副；保留 C3 复合物品 usable 主动技能）
 * - GREATSWORDS → greatsword, two_handed（双手，占主+副，P3.2）
 * - GREATAXES → greataxe, two_handed（双手，占主+副，P3.2）
 * - POLEARMS → polearm, two_handed（双手，占主+副，P3.2 长柄武器）
 * - BOWS → greatbow, two_handed（双手，占主+副，P3.2）
 * - SHIELDS → shield, off_hand（副手，只能副手）
 *
 * 护甲子类型映射（一部位一槽）：
 * - HELM_ARMOR → helm, CHEST_ARMOR → chest, LEG_ARMOR → legs, BOOTS → boots, GLOVES → gloves
 *
 * @type {EquipmentItem[]}
 */
export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  // 武器类
  ...SWORDS.map(w => ({ ...w, subtype: 'sword' as const, grip: 'one_handed' as const })),
  ...AXES.map(w => ({ ...w, subtype: 'axe' as const, grip: 'one_handed' as const })),
  ...HAMMERS.map(w => ({ ...w, subtype: 'hammer' as const, grip: 'one_handed' as const })),
  ...DAGGERS.map(w => ({ ...w, subtype: 'dagger' as const, grip: 'one_handed' as const })),
  ...STAVES.map(w => ({ ...w, subtype: 'staff' as const, grip: 'two_handed' as const })),
  ...GREATSWORDS.map(w => ({ ...w, subtype: 'greatsword' as const, grip: 'two_handed' as const })),
  ...GREATAXES.map(w => ({ ...w, subtype: 'greataxe' as const, grip: 'two_handed' as const })),
  ...POLEARMS.map(w => ({ ...w, subtype: 'polearm' as const, grip: 'two_handed' as const })),
  ...BOWS.map(w => ({ ...w, subtype: 'greatbow' as const, grip: 'two_handed' as const })),
  ...SHIELDS.map(w => ({ ...w, subtype: 'shield' as const, grip: 'off_hand' as const })),

  // 护甲类
  ...HELM_ARMOR.map(a => ({ ...a, subtype: 'helm' as const })),
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
  // plan.md §3.4：装备能力组合（配置层注入静态常量，非运行期派生）
  // C3：法杖（staff）为复合物品，注入含 usable 的 STAFF_CAPABILITIES；其他装备注入普通能力组合
  capabilities: item.subtype === 'staff' ? STAFF_CAPABILITIES : EQUIPMENT_CAPABILITIES,
  slots: deriveSlots(item.subtype),
  occupies: SUBTYPE_OCCUPIES[item.subtype] ?? deriveSlots(item.subtype)
}));
