/**
 * @fileoverview 套装进度查询服务（新版）
 * @description
 *   物品系统升级（plan.md §3.4 §3）的套装进度查询层。提供套装穿戴进度、已激活档位、
 *   下一档待激活等查询，供 UI 装备面板展示与战斗模块判断触发（plan.md S6 解决）。
 *
 *   设计：依赖注入。本模块不直接 import 配置数据（旧版 config_item_sets.ts 仍是旧 `ItemSet`
 *   格式，类型不兼容），而是由调用方传入 `sets: ItemSet[]`。P5 配置层重构后，调用方传入
 *   新版 `ITEM_SETS` 即可。这样 P1 可脱离配置数据独立测试进度计算逻辑。
 *
 *   阶段定位：P1（纯新增）。本文件不替换 equipment/service.ts 的旧 `countSetPieces` /
 *   `getActiveSetBonuses`；P5 用本文件函数替换旧版并接入战斗模块。
 *
 * @module equipment
 */
import type { EquipmentState } from '../item/types';
import type {
  ItemSet,
  SetPartSpec,
  SetBonusTier,
  SetBonusEffect,
  SetCategory
} from './setTypes';

// ============================================================================
// 进度类型
// ============================================================================

/**
 * 套装部件穿戴状态
 *
 * @property spec - 部件规格（来自 ItemSet.parts）
 * @property equipped - 该部件当前是否已穿戴且匹配（槽位有装备 + 子类型/ID 约束满足）
 * @property itemId - 实际穿戴的装备 ID（未穿戴为 null）
 */
export interface SetPartStatus {
  spec: SetPartSpec;
  equipped: boolean;
  itemId: string | null;
}

/**
 * 套装进度（供 UI 展示与战斗模块查询）
 *
 * @property setId - 套装 ID
 * @property setName - 套装显示名称
 * @property category - 套装分类
 * @property totalPieces - 套装总件数（= parts.length）
 * @property equippedPieces - 当前穿戴件数
 * @property activeTiers - 已激活的奖励档位（equippedPieces >= requiredPieces）
 * @property nextTier - 下一档未激活档位（最近一档 requiredPieces > equippedPieces），无则为 null
 * @property partsStatus - 各部件穿戴状态清单
 */
export interface SetProgress {
  setId: string;
  setName: string;
  category: SetCategory;
  totalPieces: number;
  equippedPieces: number;
  activeTiers: SetBonusTier[];
  nextTier: SetBonusTier | null;
  partsStatus: SetPartStatus[];
}

// ============================================================================
// 进度计算
// ============================================================================

/**
 * 判断某部件规格在当前装备状态下是否已穿戴匹配
 *
 * 匹配规则：
 * 1. 该槽位必须有装备
 * 2. 若 spec.subtype 指定，装备子类型必须一致
 * 3. 若 spec.itemId 指定，装备 ID 必须一致
 */
function isPartEquipped(spec: SetPartSpec, equipment: EquipmentState): { equipped: boolean; itemId: string | null } {
  const equipped = equipment[spec.slot];
  if (!equipped) {
    return { equipped: false, itemId: null };
  }
  const subtypeMatch = !spec.subtype || equipped.item.subtype === spec.subtype;
  const itemIdMatch = !spec.itemId || equipped.item.id === spec.itemId;
  return {
    equipped: subtypeMatch && itemIdMatch,
    itemId: equipped.item.id
  };
}

/**
 * 计算指定套装的穿戴进度
 *
 * @param set - 套装定义（新版 ItemSet）
 * @param equipment - 当前装备状态
 * @returns 套装进度（含部件清单、已激活档位、下一档）
 */
export function getSetProgress(set: ItemSet, equipment: EquipmentState): SetProgress {
  const partsStatus: SetPartStatus[] = set.parts.map(spec => {
    const { equipped, itemId } = isPartEquipped(spec, equipment);
    return { spec, equipped, itemId };
  });

  const equippedPieces = partsStatus.filter(p => p.equipped).length;

  // 按 requiredPieces 升序计算，确保 nextTier 取"最近一档"
  const sortedTiers = [...set.bonusTiers].sort(
    (a, b) => a.requiredPieces - b.requiredPieces
  );
  const activeTiers = sortedTiers.filter(t => equippedPieces >= t.requiredPieces);
  const nextTier = sortedTiers.find(t => equippedPieces < t.requiredPieces) ?? null;

  return {
    setId: set.id,
    setName: set.name,
    category: set.category,
    totalPieces: set.parts.length,
    equippedPieces,
    activeTiers,
    nextTier,
    partsStatus
  };
}

/**
 * 按套装 ID 查询进度（在提供的套装列表中查找）
 *
 * @param setId - 套装 ID
 * @param equipment - 当前装备状态
 * @param sets - 套装定义列表（由调用方注入）
 * @returns 套装进度，未找到套装定义时返回 null
 */
export function getSetProgressById(
  setId: string,
  equipment: EquipmentState,
  sets: ItemSet[]
): SetProgress | null {
  const set = sets.find(s => s.id === setId);
  return set ? getSetProgress(set, equipment) : null;
}

/**
 * 获取当前装备状态激活的所有套装进度
 *
 * 扫描装备中所有带 `setId` 的部件，去重后查询各自进度。
 *
 * @param equipment - 当前装备状态
 * @param sets - 套装定义列表（由调用方注入）
 * @returns 所有在穿套装的进度数组（未在 sets 中定义的套装 ID 被跳过）
 */
export function getAllSetProgresses(
  equipment: EquipmentState,
  sets: ItemSet[]
): SetProgress[] {
  const setIds = new Set<string>();
  Object.values(equipment).forEach(equipped => {
    if (equipped?.item.setId) {
      setIds.add(equipped.item.setId);
    }
  });
  return [...setIds]
    .map(id => getSetProgressById(id, equipment, sets))
    .filter((p): p is SetProgress => p !== null);
}

// ============================================================================
// 激活效果查询（供战斗模块 P5 接入）
// ============================================================================

/**
 * 收集进度中所有已激活档位的效果（扁平化）
 *
 * 供战斗模块遍历应用 stat/percent_stat/resource 等持续效果。
 */
export function getActiveBonusEffects(progress: SetProgress): SetBonusEffect[] {
  return progress.activeTiers.flatMap(tier => tier.bonuses);
}

/**
 * 收集进度中所有已激活的触发类效果 triggerId
 *
 * 供战斗模块在 on_hit/on_kill/on_turn_start 等时机调用 `executeSetBonus`。
 */
export function getActiveTriggers(progress: SetProgress): string[] {
  return getActiveBonusEffects(progress)
    .filter((b): b is { kind: 'trigger'; triggerId: string; description: string } => b.kind === 'trigger')
    .map(b => b.triggerId);
}

/**
 * 判断套装是否已激活任意档位
 */
export function hasActiveBonus(progress: SetProgress): boolean {
  return progress.activeTiers.length > 0;
}
