/**
 * @fileoverview 装备槽位注册表（新版 7 槽 + 子类型约束）
 * @description
 *   物品系统升级（plan.md §3.3）的全新槽位映射层。把"哪些子类型能装哪些槽"从
 *   散落的 `slots` 字段收口为单一映射表，消除旧版 `getSlotType` 的 `startsWith('weapon')`
 *   硬编码与"所有护甲 slots 都填满四槽、手套装头部"的 bug。
 *
 *   核心映射表：
 *   - `SUBTYPE_SLOTS`：子类型 → 可装备槽位候选
 *   - `SUBTYPE_OCCUPIES`：子类型 → 实际占用槽位（双手武器占主+副两槽）
 *   - `WEAPON_SUBTYPE_GRIP`：武器子类型 → 握持方式（单手/副手/双手）
 *   - `SLOT_GROUP` / `SLOT_CONFIG`：槽位 → 组别/展示元数据
 *
 *   阶段定位：P3.3 已完成迁移。本文件已替代 equipment/service.ts 的旧 6 槽设施
 *   （`ALL_EQUIPMENT_SLOTS` / `SLOT_CONFIG` / `createEmptySlotMap` / `validateSlot` / `canEquipItem`），
 *   并修复了"手套装头部"等 bug。equipment/service.ts 现复用本文件的映射表。
 *
 * @module equipment
 */
import type {
  EquipmentSlot,
  EquipmentSubtype,
  WeaponSubtype,
  WeaponGrip,
  EquipmentItem,
  EquipmentState
} from '../item/types';

// ============================================================================
// 槽位基础设施（7 槽）
// ============================================================================

/**
 * 所有装备槽位列表（7 槽，定义顺序即 UI 展示顺序）
 *
 * 2 个武器槽（主手、副手） + 5 个护甲部位槽（头/胸/手/腿/鞋）。
 * 取代旧版 6 槽（weapon1/weapon2/armor1-4）。
 */
export const ALL_EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon1', 'weapon2',
  'helm', 'chest', 'gloves', 'legs', 'boots'
];

/**
 * 槽位组别
 * - `weapon`：武器组（weapon1/weapon2）
 * - `armor`：护甲组（helm/chest/gloves/legs/boots）
 */
export type SlotGroup = 'weapon' | 'armor';

/**
 * 槽位 → 组别映射
 *
 * 替代旧版 `getSlotType(slot)` 的 `startsWith('weapon')` 硬编码判断。
 */
export const SLOT_GROUP: Record<EquipmentSlot, SlotGroup> = {
  weapon1: 'weapon',
  weapon2: 'weapon',
  helm: 'armor',
  chest: 'armor',
  gloves: 'armor',
  legs: 'armor',
  boots: 'armor'
};

/**
 * 槽位展示配置（UI 展示用）
 *
 * 定义每个槽位的展示名称、图标、组别。取代旧版 service.ts 的 6 槽 `SLOT_CONFIG`。
 *
 * @property name - 槽位显示名称
 * @property icon - 槽位图标（Iconify 图标 ID）
 * @property group - 槽位组别
 */
export interface SlotConfigEntry {
  name: string;
  icon: string;
  group: SlotGroup;
}

export const SLOT_CONFIG: Record<EquipmentSlot, SlotConfigEntry> = {
  weapon1: { name: '主手', icon: 'game-icons:broadsword', group: 'weapon' },
  weapon2: { name: '副手', icon: 'game-icons:checked-shield', group: 'weapon' },
  helm: { name: '头部', icon: 'game-icons:visored-helm', group: 'armor' },
  chest: { name: '胸部', icon: 'game-icons:chest-armor', group: 'armor' },
  gloves: { name: '手套', icon: 'game-icons:gauntlet', group: 'armor' },
  legs: { name: '腿部', icon: 'game-icons:leg-armor', group: 'armor' },
  boots: { name: '鞋子', icon: 'game-icons:leather-boot', group: 'armor' }
};

/**
 * 创建空槽位映射（泛型工厂函数，7 槽版）
 *
 * 生成包含全部 7 个槽位键、每个键值为 defaultValue 的记录对象。
 * 取代旧版 service.ts 的 6 槽 `createEmptySlotMap`。
 *
 * @param defaultValue - 每个槽位的默认值
 * @returns 包含全部 7 槽位键的映射对象
 */
export function createEmptySlotMap<T>(defaultValue: T): Record<EquipmentSlot, T> {
  const map = {} as Record<EquipmentSlot, T>;
  for (const slot of ALL_EQUIPMENT_SLOTS) {
    map[slot] = defaultValue;
  }
  return map;
}

/**
 * 获取槽位组别（替代旧版 `getSlotType`）
 */
export function getSlotGroup(slot: EquipmentSlot): SlotGroup {
  return SLOT_GROUP[slot];
}

// ============================================================================
// 子类型 → 槽位映射表
// ============================================================================

/**
 * 子类型 → 可装备槽位（候选目标槽）
 *
 * - 单手武器：可装主手或副手
 * - 副手武器：只能副手
 * - 双手武器：只能装主手（但会锁定副手，见 `SUBTYPE_OCCUPIES`）
 * - 护甲：一部位一槽，修正旧版"手套能装头部"的 bug
 *
 * 新增槽位/子类型只改本表与 `SUBTYPE_OCCUPIES`，无需改校验逻辑（开闭原则）。
 */
export const SUBTYPE_SLOTS: Record<EquipmentSubtype, EquipmentSlot[]> = {
  // 单手武器：可装主手或副手
  sword: ['weapon1', 'weapon2'],
  axe: ['weapon1', 'weapon2'],
  hammer: ['weapon1', 'weapon2'],
  dagger: ['weapon1', 'weapon2'],
  // 副手武器：只能副手
  shield: ['weapon2'],
  // 双手武器：只能装主手（占用副手见 SUBTYPE_OCCUPIES）
  staff: ['weapon1'],
  greatsword: ['weapon1'],
  greataxe: ['weapon1'],
  greatbow: ['weapon1'],
  polearm: ['weapon1'],
  // 护甲：一部位一槽
  helm: ['helm'],
  chest: ['chest'],
  gloves: ['gloves'],
  legs: ['legs'],
  boots: ['boots']
};

/**
 * 子类型 → 实际占用槽位
 *
 * 双手武器占用主+副两个槽（装到 weapon1 时 weapon2 被锁定为空）。
 * 未列出的子类型：`occupies` = 装备时选定的单个目标槽。
 */
export const SUBTYPE_OCCUPIES: Partial<Record<EquipmentSubtype, EquipmentSlot[]>> = {
  staff: ['weapon1', 'weapon2'],
  greatsword: ['weapon1', 'weapon2'],
  greataxe: ['weapon1', 'weapon2'],
  greatbow: ['weapon1', 'weapon2'],
  polearm: ['weapon1', 'weapon2']
};

/**
 * 武器子类型 → 握持方式
 *
 * 护甲子类型无 grip（返回 undefined，见 `deriveGrip`）。
 */
export const WEAPON_SUBTYPE_GRIP: Record<WeaponSubtype, WeaponGrip> = {
  // 单手
  sword: 'one_handed',
  axe: 'one_handed',
  hammer: 'one_handed',
  dagger: 'one_handed',
  // 副手
  shield: 'off_hand',
  // 双手
  staff: 'two_handed',
  greatsword: 'two_handed',
  greataxe: 'two_handed',
  greatbow: 'two_handed',
  polearm: 'two_handed'
};

// ============================================================================
// 派生函数
// ============================================================================

/**
 * 由子类型派生可装备槽位候选
 *
 * 配置层构建装备条目时调用本函数填充 `slots` 字段，无需手填（plan.md §3.8）。
 * 返回数组的拷贝，避免外部修改影响映射表。
 */
export function deriveSlots(subtype: EquipmentSubtype): EquipmentSlot[] {
  const slots = SUBTYPE_SLOTS[subtype];
  return slots ? [...slots] : [];
}

/**
 * 由子类型派生握持方式
 *
 * 武器子类型返回对应 `WeaponGrip`，护甲子类型返回 `undefined`。
 */
export function deriveGrip(subtype: EquipmentSubtype): WeaponGrip | undefined {
  return (subtype as WeaponSubtype) in WEAPON_SUBTYPE_GRIP
    ? WEAPON_SUBTYPE_GRIP[subtype as WeaponSubtype]
    : undefined;
}

/**
 * 判断子类型是否为武器
 */
export function isWeaponSubtype(subtype: EquipmentSubtype): subtype is WeaponSubtype {
  return (subtype as WeaponSubtype) in WEAPON_SUBTYPE_GRIP;
}

/**
 * 判断子类型是否为护甲
 */
export function isArmorSubtype(subtype: EquipmentSubtype): subtype is ArmorSubtype {
  return !isWeaponSubtype(subtype);
}
// ArmorSubtype 局部别名（仅用于上方类型守卫的返回类型标注）
type ArmorSubtype = 'helm' | 'chest' | 'gloves' | 'legs' | 'boots';

/**
 * 获取某装备实际占用的槽位
 *
 * - 双手武器：占主+副两槽（`SUBTYPE_OCCUPIES`）
 * - 其余类型：占装备时选定的单个目标槽
 *
 * @param item - 装备模板
 * @param targetSlot - 装备时选定的目标槽
 * @returns 实际占用槽位数组
 */
export function getOccupiedSlots(
  item: EquipmentItem,
  targetSlot: EquipmentSlot
): EquipmentSlot[] {
  const occupied = SUBTYPE_OCCUPIES[item.subtype];
  return occupied ? [...occupied] : [targetSlot];
}

// ============================================================================
// 槽位校验
// ============================================================================

/**
 * 基础槽位校验：子类型是否可装备到指定槽位
 *
 * 替代旧版 `validateSlot`（基于 `getSlotType` 前缀判断 + `slots.includes`）。
 * 新版直接查 `SUBTYPE_SLOTS` 表，规则由数据派生。
 */
export function validateSubtypeSlot(
  subtype: EquipmentSubtype,
  slot: EquipmentSlot
): boolean {
  return SUBTYPE_SLOTS[subtype]?.includes(slot) ?? false;
}

/**
 * 综合可装备性校验（替代旧版 `canEquipItem`）
 *
 * 三重校验：
 * 1. 目标槽位必须在该子类型的可装备槽位列表中（`validateSubtypeSlot`）
 * 2. 目标槽位必须空闲
 * 3. 双手武器额外校验：副手槽也必须空闲（否则无法双手握持）
 *
 * @param item - 装备模板
 * @param equipment - 当前装备状态
 * @param targetSlot - 目标槽位
 * @returns `{ ok, reason }`，ok 为 true 时 reason 为空串
 */
export function canEquip(
  item: EquipmentItem,
  equipment: EquipmentState,
  targetSlot: EquipmentSlot
): { ok: boolean; reason: string } {
  if (!validateSubtypeSlot(item.subtype, targetSlot)) {
    return { ok: false, reason: '该装备不能放入此槽位' };
  }
  if (equipment[targetSlot]) {
    return { ok: false, reason: '目标槽位已被占用' };
  }
  // 双手武器需要主副手同时空闲
  if (item.grip === 'two_handed' && equipment.weapon2) {
    return { ok: false, reason: '双手武器需要主副手槽位都空闲' };
  }
  return { ok: true, reason: '' };
}

/**
 * 查询某装备在当前状态下所有可装备的空闲槽位
 *
 * 供 UI 高亮"可放置槽位"。遍历 `SUBTYPE_SLOTS` 候选，过滤掉被占用与双手武器冲突的槽位。
 */
export function getAvailableSlots(
  item: EquipmentItem,
  equipment: EquipmentState
): EquipmentSlot[] {
  const candidates = SUBTYPE_SLOTS[item.subtype] ?? [];
  return candidates.filter(slot => canEquip(item, equipment, slot).ok);
}
