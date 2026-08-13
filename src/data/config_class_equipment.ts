/**
 * @fileoverview 职业专属武器数据（Phase 5.3，P3.1 升级，P3 武器扩展）
 * @description 为 13 个职业定义专属武器（不含护甲），含职业限制。
 *              装备时由 equipment/service.ts 的 checkClassRestriction 检查职业限制。
 *              套装效果由 config_set_definitions.ts 定义，由 equipment/setService.ts 的 getAllSetProgresses 计算进度。
 *
 *              P3.1 升级：条目改为草稿声明（含 subtype/grip，不含 slots/occupies），
 *              slots/occupies 由 slotRegistry 的 deriveSlots/SUBTYPE_OCCUPIES 统一派生，
 *              消除旧版手填 armor1-4 槽位的问题。
 * @module data
 */
import type { EquipmentItem } from '@/modules/equipment/types';
import type { Capability } from '@/modules/item/capabilityTypes';
import { deriveSlots, SUBTYPE_OCCUPIES } from '@/modules/equipment/slotRegistry';

// ============================================================================
// 职业装备能力组合（plan.md §3.4/§3.5）
// ============================================================================

/**
 * 普通职业装备能力组合：可描述 + 可装备 + 可出售 + 可附魔
 *
 * 无 setId 的职业专属装备使用此组合（独立装备，如 warrior_blade_bloodlust）。
 */
const CLASS_EQUIPMENT_CAPABILITIES: Capability[] = [
  'describable',
  'equippable',
  'sellable',
  'enchantable',
];

/**
 * 套装部件能力组合：在普通装备基础上追加 setMember（计入套装进度）
 *
 * 有 setId 的职业专属装备使用此组合。setMember 能力使套装进度计算从隐式 setId 字段
 * 改为显式能力查询（C2 接入）。
 */
const CLASS_SET_MEMBER_CAPABILITIES: Capability[] = [
  'describable',
  'equippable',
  'setMember',
  'sellable',
  'enchantable',
];

/**
 * 职业专属装备草稿类型（P3.1 新增）
 *
 * 与 EquipmentItemDraft 的差异：本类型保留 subtype/grip（因职业装备按条目内联声明，
 * 非按子类型分组 map），仅省略 slots/occupies/capabilities（由派生/注入填充）。
 */
type ClassItemDraft = Omit<
  EquipmentItem,
  'kind' | 'slots' | 'occupies' | 'stackable' | 'consumable' | 'capabilities'
>;

/**
 * 全职业专属武器草稿列表
 *
 * 设计原则：
 * 1. 每个职业 1-3 件专属武器，覆盖各武器子类型
 * 2. 装备强度高于同等级普通装备 30%-50%
 * 3. classRestriction 字段强制职业限制
 *
 * P3.1：每个条目声明 subtype（武器额外声明 grip），slots/occupies 在导出时派生。
 * - 单手武器：subtype: 'sword'/'axe'/'hammer'/'dagger', grip: 'one_handed'
 * - 双手武器：subtype: 'greatsword'/'greataxe'/'polearm'/'staff'/'greatbow', grip: 'two_handed'（占用主+副两槽）
 */
const CLASS_EQUIPMENT_DRAFTS: ClassItemDraft[] = [
  // ==================== 战士（str）====================
  {
    id: 'warrior_blade_bloodlust',
    name: '嗜血巨刃',
    icon: 'game-icons:broad-dagger',
    subtype: 'sword',
    grip: 'one_handed',
    bonus: { str: 15, con: 5 },
    rarity: 'epic',
    description: '刀刃上刻有嗜血符文，每次挥舞都渴望敌人的鲜血',
    value: 200,
    template: 'warrior_blade_bloodlust',
    levelRequirement: 15,
    classRestriction: ['warrior'],
  },
  {
    id: 'warrior_axe_berserker',
    name: '狂战士之斧',
    icon: 'game-icons:war-axe',
    subtype: 'axe',
    grip: 'one_handed',
    bonus: { str: 32, con: 10 },
    rarity: 'legendary',
    description: '熔炉堡狂战士氏族的传家战斧，斧刃浸染过无数兽人的鲜血，挥舞时如野兽般凶猛',
    value: 400,
    template: 'warrior_axe_berserker',
    levelRequirement: 18,
    classRestriction: ['warrior'],
  },

  // ==================== 圣骑士（cha）====================
  {
    id: 'paladin_hammer_judgment',
    name: '审判之锤',
    icon: 'game-icons:warhammer',
    subtype: 'hammer',
    grip: 'one_handed',
    bonus: { str: 12, wis: 8 },
    rarity: 'epic',
    description: '一锤定音的神圣战锤，挥舞时伴随圣光绽放',
    value: 200,
    template: 'paladin_hammer_judgment',
    levelRequirement: 15,
    classRestriction: ['paladin'],
  },
  {
    id: 'paladin_greatsword_holy',
    name: '圣光巨剑',
    icon: 'game-icons:broadsword',
    subtype: 'greatsword',
    grip: 'two_handed',
    bonus: { cha: 30, str: 10 },
    rarity: 'legendary',
    description: '圣光之泉洗礼过的双手巨剑，剑身铭刻圣典经文，挥动时圣光绽放驱散一切黑暗',
    value: 420,
    template: 'paladin_greatsword_holy',
    levelRequirement: 18,
    classRestriction: ['paladin'],
  },

  // ==================== 猎人（dex）====================
  {
    id: 'hunter_bow_eagle',
    name: '鹰眼长弓',
    icon: 'game-icons:perspective-dice-six-faces-random',
    subtype: 'greatbow',
    grip: 'two_handed',
    bonus: { dex: 18, wis: 6 },
    rarity: 'epic',
    description: '由上古神木制成的长弓，箭无虚发的传说之弓',
    value: 200,
    template: 'hunter_bow_eagle',
    levelRequirement: 15,
    classRestriction: ['hunter'],
  },
  {
    id: 'hunter_dagger_quick',
    name: '疾风匕首',
    icon: 'game-icons:curvy-knife',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { dex: 30, wis: 8 },
    rarity: 'legendary',
    description: '棘藤谷游侠锻造的轻便匕首，刃薄如蝉翼，挥动时划破空气发出尖锐啸声',
    value: 380,
    template: 'hunter_dagger_quick',
    levelRequirement: 18,
    classRestriction: ['hunter'],
  },

  // ==================== 潜行者（dex）====================
  {
    id: 'rogue_dagger_venom',
    name: '剧毒匕首',
    icon: 'game-icons:curvy-knife',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { dex: 14, cha: 5 },
    rarity: 'epic',
    description: '刀刃涂有致命毒药的匕首，可双持使用',
    value: 180,
    template: 'rogue_dagger_venom',
    levelRequirement: 15,
    classRestriction: ['rogue'],
  },
  {
    id: 'rogue_sword_shadow',
    name: '暗影之剑',
    icon: 'game-icons:plain-dagger',
    subtype: 'sword',
    grip: 'one_handed',
    bonus: { dex: 32, cha: 8 },
    rarity: 'legendary',
    description: '暗影公会刺客大师的佩剑，剑身淬过暗影之力，挥舞时如鬼魅般无声无息',
    value: 390,
    template: 'rogue_sword_shadow',
    levelRequirement: 18,
    classRestriction: ['rogue'],
  },

  // ==================== 牧师（wis）====================
  {
    id: 'priest_staff_light',
    name: '圣光法杖',
    icon: 'game-icons:light-sabers',
    subtype: 'staff',
    grip: 'two_handed',
    bonus: { wis: 20, int: 6 },
    rarity: 'epic',
    description: '圣光之泉大祭司的法杖，顶端镶嵌的圣光水晶能治愈伤痛并驱散邪恶力量',
    value: 200,
    template: 'priest_staff_light',
    levelRequirement: 12,
    classRestriction: ['priest'],
    effects: [{ type: 'magic_damage', value: 50 }],
  },
  {
    id: 'priest_dagger_ceremonial',
    name: '仪式匕首',
    icon: 'game-icons:sacrificial-dagger',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { wis: 30, cha: 8 },
    rarity: 'legendary',
    description: '虫巢圣殿祭祀用的古老匕首，刃身刻有神秘符文，曾用于神圣仪式割破祭司之手',
    value: 380,
    template: 'priest_dagger_ceremonial',
    levelRequirement: 18,
    classRestriction: ['priest'],
  },

  // ==================== 萨满（wis）====================
  {
    id: 'shaman_staff_elements',
    name: '元素法杖',
    icon: 'game-icons:flame',
    subtype: 'staff',
    grip: 'two_handed',
    bonus: { wis: 20, int: 6 },
    rarity: 'epic',
    description: '卡兹山脉萨满长老传承的法杖，四元素之力在杖顶水晶中流转不息，能召唤雷霆与烈焰',
    value: 210,
    template: 'shaman_staff_elements',
    levelRequirement: 12,
    classRestriction: ['shaman'],
    effects: [{ type: 'magic_damage', value: 55 }],
  },
  {
    id: 'shaman_hammer_ancestral',
    name: '先祖之锤',
    icon: 'game-icons:warhammer',
    subtype: 'hammer',
    grip: 'one_handed',
    bonus: { wis: 30, con: 8 },
    rarity: 'legendary',
    description: '卡兹山脉矮人氏族的传家战锤，锤头刻有先祖图腾，挥舞时先祖之灵附体',
    value: 380,
    template: 'shaman_hammer_ancestral',
    levelRequirement: 18,
    classRestriction: ['shaman'],
  },

  // ==================== 法师（int）====================
  {
    id: 'mage_staff_eternal',
    name: '永恒法杖',
    icon: 'game-icons:wizard-staff',
    subtype: 'staff',
    grip: 'two_handed',
    bonus: { int: 18, wis: 8 },
    rarity: 'epic',
    description: '由永恒之木制成的法杖，顶端的水晶蕴含着无尽的奥术能量',
    value: 200,
    template: 'mage_staff_eternal',
    levelRequirement: 15,
    classRestriction: ['mage'],
    effects: [{ type: 'magic_damage', value: 50 }],
  },
  {
    id: 'mage_dagger_arcane',
    name: '奥术匕首',
    icon: 'game-icons:curvy-knife',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { int: 30, dex: 8 },
    rarity: 'legendary',
    description: '奥法学院大法师的近战匕首，刃身流淌着奥术之力，挥动时残留紫色光痕',
    value: 380,
    template: 'mage_dagger_arcane',
    levelRequirement: 18,
    classRestriction: ['mage'],
  },

  // ==================== 术士（int）====================
  {
    id: 'warlock_staff_soul',
    name: '灵魂权杖',
    icon: 'game-icons:bad-gnome',
    subtype: 'staff',
    grip: 'two_handed',
    bonus: { int: 16, cha: 8 },
    rarity: 'epic',
    description: '顶端的灵魂宝石中封印着无数受害者的灵魂',
    value: 200,
    template: 'warlock_staff_soul',
    levelRequirement: 15,
    classRestriction: ['warlock'],
    effects: [{ type: 'magic_damage', value: 45 }],
  },
  {
    id: 'warlock_dagger_ritual',
    name: '仪式匕首',
    icon: 'game-icons:sacrificial-dagger',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { int: 30, cha: 8 },
    rarity: 'legendary',
    description: '死灵学院高阶术士的祭祀匕首，刃身刻有吞噬灵魂的符文，刺中目标时会汲取生命力',
    value: 390,
    template: 'warlock_dagger_ritual',
    levelRequirement: 18,
    classRestriction: ['warlock'],
  },

  // ==================== 武僧（dex）====================
  {
    id: 'monk_dagger_wind',
    name: '疾风短刃',
    icon: 'game-icons:feather',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { dex: 20, wis: 5 },
    rarity: 'epic',
    description: '翠叶森林武僧修行所用的轻便短刃，重心精妙，出招时如清风般难以捉摸',
    value: 190,
    template: 'monk_dagger_wind',
    levelRequirement: 12,
    classRestriction: ['monk'],
  },
  {
    id: 'monk_polearm_staff',
    name: '武僧长棍',
    icon: 'game-icons:crescent-staff',
    subtype: 'polearm',
    grip: 'two_handed',
    bonus: { dex: 30, con: 8 },
    rarity: 'legendary',
    description: '翠叶森林千年竹木削制的长棍，棍身柔韧如藤，挥舞时虎虎生风势不可挡',
    value: 380,
    template: 'monk_polearm_staff',
    levelRequirement: 18,
    classRestriction: ['monk'],
  },

  // ==================== 德鲁伊（wis）====================
  {
    id: 'druid_staff_nature',
    name: '自然法杖',
    icon: 'game-icons:oak-leaf',
    subtype: 'staff',
    grip: 'two_handed',
    bonus: { wis: 20, int: 6 },
    rarity: 'epic',
    description: '翡翠梦境古树馈赠的法杖，杖顶翡翠蕴含自然之力，能催生万物复苏',
    value: 200,
    template: 'druid_staff_nature',
    levelRequirement: 12,
    classRestriction: ['druid'],
    effects: [{ type: 'magic_damage', value: 45 }],
  },
  {
    id: 'druid_polearm_spear',
    name: '翠叶长矛',
    icon: 'game-icons:barbed-spear',
    subtype: 'polearm',
    grip: 'two_handed',
    bonus: { wis: 30, str: 8 },
    rarity: 'legendary',
    description: '棘藤谷德鲁伊守护者使用的长矛，矛尖淬有藤蔓汁液，刺中伤口会迅速蔓延',
    value: 380,
    template: 'druid_polearm_spear',
    levelRequirement: 18,
    classRestriction: ['druid'],
  },

  // ==================== 死亡骑士（str）====================
  {
    id: 'dk_greatsword_frost',
    name: '寒霜巨剑',
    icon: 'game-icons:ice-bolt',
    subtype: 'greatsword',
    grip: 'two_handed',
    bonus: { str: 20, con: 6 },
    rarity: 'epic',
    description: '冰冠堡垒死亡骑士的双手巨剑，剑身永覆寒霜，斩击时寒气透骨冻结血脉',
    value: 200,
    template: 'dk_greatsword_frost',
    levelRequirement: 12,
    classRestriction: ['death_knight'],
  },
  {
    id: 'dk_greataxe_blood',
    name: '鲜血巨斧',
    icon: 'game-icons:battle-axe',
    subtype: 'greataxe',
    grip: 'two_handed',
    bonus: { str: 32, con: 10 },
    rarity: 'legendary',
    description: '冰冠堡垒鲜血议会的双手巨斧，斧刃嗜血成性，每次斩杀都让斧身更加猩红',
    value: 400,
    template: 'dk_greataxe_blood',
    levelRequirement: 18,
    classRestriction: ['death_knight'],
  },

  // ==================== 恶魔猎手（dex）====================
  {
    id: 'dh_dagger_twin',
    name: '双月匕首',
    icon: 'game-icons:dripping-blade',
    subtype: 'dagger',
    grip: 'one_handed',
    bonus: { dex: 20, cha: 5 },
    rarity: 'epic',
    description: '扭曲虚空恶魔猎手的双刃匕首，刃身淬过恶魔之血，能切割灵魂与肉体',
    value: 200,
    template: 'dh_dagger_twin',
    levelRequirement: 12,
    classRestriction: ['demon_hunter'],
  },
  {
    id: 'dh_greatsword_illidari',
    name: '伊利达雷巨剑',
    icon: 'game-icons:flame',
    subtype: 'greatsword',
    grip: 'two_handed',
    bonus: { dex: 30, str: 8 },
    rarity: 'legendary',
    description: '深渊之门恶魔猎手统帅的双手巨剑，剑身燃烧着邪能之火，斩击时吞噬一切生机',
    value: 400,
    template: 'dh_greatsword_illidari',
    levelRequirement: 18,
    classRestriction: ['demon_hunter'],
  },

  // ==================== 唤魔者（int）====================
  {
    id: 'evoker_staff_dragon',
    name: '巨龙法杖',
    icon: 'game-icons:dragon-head',
    subtype: 'staff',
    grip: 'two_handed',
    bonus: { int: 20, wis: 6 },
    rarity: 'epic',
    description: '观星之塔唤魔者长老的法杖，杖顶镶嵌巨龙之眼，蕴含五色巨龙的原始力量',
    value: 210,
    template: 'evoker_staff_dragon',
    levelRequirement: 12,
    classRestriction: ['evoker'],
    effects: [{ type: 'magic_damage', value: 60 }],
  },
  {
    id: 'evoker_polearm_scales',
    name: '龙鳞长戟',
    icon: 'game-icons:halberd',
    subtype: 'polearm',
    grip: 'two_handed',
    bonus: { int: 30, cha: 8 },
    rarity: 'legendary',
    description: '观星之塔唤龙者使用的长戟，戟身覆盖五色龙鳞，挥舞时龙威赫赫震慑敌人',
    value: 380,
    template: 'evoker_polearm_scales',
    levelRequirement: 18,
    classRestriction: ['evoker'],
  },
];

/**
 * 全职业专属装备列表（派生 slots/occupies 后的完整 EquipmentItem）
 *
 * P3.1：由 CLASS_EQUIPMENT_DRAFTS 经 slotRegistry 派生槽位信息：
 * - slots：由 subtype 经 deriveSlots 派生（可装备的候选槽位）
 * - occupies：由 SUBTYPE_OCCUPIES 派生（双手武器占主+副两槽，其余同 slots）
 *
 * P3 套装扩展：套装部件（195 件）已迁移到 config_set_parts.ts 独立导出（SET_PARTS），
 * 本文件仅导出职业专属武器，不再合并套装部件。
 */
const CLASS_EQUIPMENT_ITEMS: EquipmentItem[] = CLASS_EQUIPMENT_DRAFTS.map(item => ({
  ...item,
  // P3.3：补全判别联合字面量（草稿 Omit 了 kind/stackable/consumable）
  kind: 'equipment' as const,
  stackable: false as const,
  consumable: false as const,
  // plan.md §3.4：套装部件（有 setId）追加 setMember 能力；独立装备用普通装备能力组合。
  // 配置层按 setId 显式选择能力常量，非运行期派生。
  // P12-002 修复：法杖（staff）注入含 usable 的能力组合，与 config_equipment_items.ts 保持一致
  capabilities: item.subtype === 'staff'
    ? ([...CLASS_EQUIPMENT_CAPABILITIES, 'usable'] as Capability[])
    : (item.setId ? CLASS_SET_MEMBER_CAPABILITIES : CLASS_EQUIPMENT_CAPABILITIES),
  slots: deriveSlots(item.subtype),
  occupies: SUBTYPE_OCCUPIES[item.subtype] ?? deriveSlots(item.subtype)
}));

export const CLASS_EQUIPMENT: EquipmentItem[] = CLASS_EQUIPMENT_ITEMS;

/**
 * 根据职业 ID 获取其专属装备列表
 * @param classId - 职业 ID
 * @returns 该职业的专属装备数组
 */
export function getClassEquipment(classId: string): EquipmentItem[] {
  return CLASS_EQUIPMENT.filter(item =>
    item.classRestriction?.includes(classId)
  );
}
