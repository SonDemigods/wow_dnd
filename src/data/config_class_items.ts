/**
 * @fileoverview 职业专属装备数据（Phase 5.3，P3.1 升级）
 * @description 为 6 个核心职业各定义 3-5 件专属装备，含职业限制和套装归属。
 *              装备时由 equipment/service.ts 的 checkClassRestriction 检查职业限制。
 *              套装效果由 config_item_sets.ts 定义，由 equipment/setService.ts 的 getAllSetProgresses 计算进度。
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
 * 全职业专属装备草稿列表
 *
 * 设计原则：
 * 1. 每个职业 3 件专属装备（武器 + 头部 + 胸部），覆盖核心槽位
 * 2. 2 件来自套装（setId 标识），1 件独立装备
 * 3. 装备强度高于同等级普通装备 30%-50%
 * 4. classRestriction 字段强制职业限制
 *
 * P3.1：每个条目声明 subtype（武器额外声明 grip），slots/occupies 在导出时派生。
 * - 头部护甲：subtype: 'helm'
 * - 胸部护甲：subtype: 'chest'
 * - 单手武器：subtype: 'sword'/'hammer'/'dagger'/'staff', grip: 'one_handed'
 * - 双手武器（弓）：subtype: 'greatbow', grip: 'two_handed'（占用主+副两槽）
 */
const CLASS_SPECIFIC_DRAFTS: ClassItemDraft[] = [
  // ==================== 战士专属 ====================
  {
    id: 'warrior_helm_rage',
    name: '愤怒之盔',
    icon: 'game-icons:knight-helmet',
    subtype: 'helm',
    bonus: { str: 5, con: 3 },
    rarity: 'rare',
    description: '传说中战士首领的战盔，盔顶的红色羽饰染满了敌人的鲜血',
    value: 80,
    template: 'warrior_helm_rage',
    levelRequirement: 8,
    classRestriction: ['warrior'],
    setId: 'warrior_might',
  },
  {
    id: 'warrior_chest_might',
    name: '力量胸甲',
    icon: 'game-icons:breastplate',
    subtype: 'chest',
    bonus: { str: 8, con: 5 },
    rarity: 'epic',
    description: '由矮人铁匠用黑铁锻造的厚重胸甲，扛住过无数次致命打击',
    value: 150,
    template: 'warrior_chest_might',
    levelRequirement: 12,
    classRestriction: ['warrior'],
    setId: 'warrior_might',
  },
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

  // ==================== 法师专属 ====================
  {
    id: 'mage_hat_arcane',
    name: '奥术之冠',
    icon: 'game-icons:wizard-face',
    subtype: 'helm',
    bonus: { int: 8, wis: 3 },
    rarity: 'rare',
    description: '镶嵌着奥术宝石的法帽，能增幅佩戴者的法术威力',
    value: 80,
    template: 'mage_hat_arcane',
    levelRequirement: 8,
    classRestriction: ['mage'],
    setId: 'mage_arcane',
  },
  {
    id: 'mage_robe_mystic',
    name: '神秘法袍',
    icon: 'game-icons:witch-cloak',
    subtype: 'chest',
    bonus: { int: 12, wis: 5 },
    rarity: 'epic',
    description: '织入了魔法丝线的长袍，能抵御魔法攻击并提升法力恢复',
    value: 150,
    template: 'mage_robe_mystic',
    levelRequirement: 12,
    classRestriction: ['mage'],
    setId: 'mage_arcane',
  },
  {
    id: 'mage_staff_eternal',
    name: '永恒法杖',
    icon: 'game-icons:staff',
    subtype: 'staff',
    grip: 'one_handed',
    bonus: { int: 18, wis: 8 },
    rarity: 'epic',
    description: '由永恒之木制成的法杖，顶端的水晶蕴含着无尽的奥术能量',
    value: 200,
    template: 'mage_staff_eternal',
    levelRequirement: 15,
    classRestriction: ['mage'],
  },

  // ==================== 圣骑士专属 ====================
  {
    id: 'paladin_helm_holy',
    name: '圣光之盔',
    icon: 'game-icons:visored-helm',
    subtype: 'helm',
    bonus: { str: 4, con: 4, wis: 3 },
    rarity: 'rare',
    description: '经过圣光祝福的头盔，能抵御邪恶力量的侵蚀',
    value: 80,
    template: 'paladin_helm_holy',
    levelRequirement: 8,
    classRestriction: ['paladin'],
    setId: 'paladin_righteous',
  },
  {
    id: 'paladin_chest_guardian',
    name: '守护者胸甲',
    icon: 'game-icons:chest-armor',
    subtype: 'chest',
    bonus: { str: 6, con: 8, wis: 4 },
    rarity: 'epic',
    description: '刻有圣典经文的胸甲，是圣骑士团的标志性装备',
    value: 150,
    template: 'paladin_chest_guardian',
    levelRequirement: 12,
    classRestriction: ['paladin'],
    setId: 'paladin_righteous',
  },
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

  // ==================== 猎人专属 ====================
  {
    id: 'hunter_cap_tracker',
    name: '追踪者之帽',
    icon: 'game-icons:archer',
    subtype: 'helm',
    bonus: { dex: 6, wis: 3 },
    rarity: 'rare',
    description: '轻便的皮帽，能让猎人在野外保持敏锐的感知',
    value: 80,
    template: 'hunter_cap_tracker',
    levelRequirement: 8,
    classRestriction: ['hunter'],
    setId: 'hunter_predator',
  },
  {
    id: 'hunter_tunic_swift',
    name: '迅捷外衣',
    icon: 'game-icons:leather-vest',
    subtype: 'chest',
    bonus: { dex: 10, con: 4 },
    rarity: 'epic',
    description: '由精灵工匠缝制的轻甲，不影响动作的灵活性',
    value: 150,
    template: 'hunter_tunic_swift',
    levelRequirement: 12,
    classRestriction: ['hunter'],
    setId: 'hunter_predator',
  },
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

  // ==================== 潜行者专属 ====================
  {
    id: 'rogue_mask_shadow',
    name: '暗影面罩',
    icon: 'game-icons:ninja-mask',
    subtype: 'helm',
    bonus: { dex: 7, cha: 3 },
    rarity: 'rare',
    description: '遮住面容的黑色面罩，是潜行者的标志性装备',
    value: 80,
    template: 'rogue_mask_shadow',
    levelRequirement: 8,
    classRestriction: ['rogue'],
    setId: 'rogue_shadow',
  },
  {
    id: 'rogue_tunic_silent',
    name: '无声外衣',
    icon: 'game-icons:vest',
    subtype: 'chest',
    bonus: { dex: 11, con: 4 },
    rarity: 'epic',
    description: '特殊材质制成的轻甲，行动时不会发出任何声响',
    value: 150,
    template: 'rogue_tunic_silent',
    levelRequirement: 12,
    classRestriction: ['rogue'],
    setId: 'rogue_shadow',
  },
  {
    id: 'rogue_dagger_venom',
    name: '剧毒匕首',
    icon: 'game-icons:curved-knife',
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

  // ==================== 术士专属 ====================
  {
    id: 'warlock_hood_demon',
    name: '恶魔之兜',
    icon: 'game-icons:hood',
    subtype: 'helm',
    bonus: { int: 7, cha: 3 },
    rarity: 'rare',
    description: '与恶魔签订契约时穿戴的兜帽，浸透了黑暗力量',
    value: 80,
    template: 'warlock_hood_demon',
    levelRequirement: 8,
    classRestriction: ['warlock'],
    setId: 'warlock_demonic',
  },
  {
    id: 'warlock_robe_corrupt',
    name: '腐蚀法袍',
    icon: 'game-icons:robe',
    subtype: 'chest',
    bonus: { int: 11, con: 4 },
    rarity: 'epic',
    description: '用腐蚀能量织就的法袍，能增强术士的诅咒效果',
    value: 150,
    template: 'warlock_robe_corrupt',
    levelRequirement: 12,
    classRestriction: ['warlock'],
    setId: 'warlock_demonic',
  },
  {
    id: 'warlock_staff_soul',
    name: '灵魂权杖',
    icon: 'game-icons:gnome',
    subtype: 'staff',
    grip: 'one_handed',
    bonus: { int: 16, cha: 8 },
    rarity: 'epic',
    description: '顶端的灵魂宝石中封印着无数受害者的灵魂',
    value: 200,
    template: 'warlock_staff_soul',
    levelRequirement: 15,
    classRestriction: ['warlock'],
  },
];

/**
 * 全职业专属装备列表（派生 slots/occupies 后的完整 EquipmentItem）
 *
 * P3.1：由 CLASS_SPECIFIC_DRAFTS 经 slotRegistry 派生槽位信息：
 * - slots：由 subtype 经 deriveSlots 派生（可装备的候选槽位）
 * - occupies：由 SUBTYPE_OCCUPIES 派生（双手武器占主+副两槽，其余同 slots）
 */
export const CLASS_SPECIFIC_ITEMS: EquipmentItem[] = CLASS_SPECIFIC_DRAFTS.map(item => ({
  ...item,
  // P3.3：补全判别联合字面量（草稿 Omit 了 kind/stackable/consumable）
  kind: 'equipment' as const,
  stackable: false as const,
  consumable: false as const,
  // plan.md §3.4：套装部件（有 setId）追加 setMember 能力；独立装备用普通装备能力组合。
  // 配置层按 setId 显式选择能力常量，非运行期派生。
  capabilities: item.setId ? CLASS_SET_MEMBER_CAPABILITIES : CLASS_EQUIPMENT_CAPABILITIES,
  slots: deriveSlots(item.subtype),
  occupies: SUBTYPE_OCCUPIES[item.subtype] ?? deriveSlots(item.subtype)
}));

/**
 * 根据职业 ID 获取其专属装备列表
 * @param classId - 职业 ID
 * @returns 该职业的专属装备数组
 */
export function getClassSpecificItems(classId: string): EquipmentItem[] {
  return CLASS_SPECIFIC_ITEMS.filter(item =>
    item.classRestriction?.includes(classId)
  );
}
