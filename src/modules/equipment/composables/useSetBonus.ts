/**
 * @fileoverview 套装奖励计算 Composable（P3-155 拆分自 store.ts）
 * @description 提供套装效果的 diff 应用/移除逻辑。
 * @module equipment/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { configCache } from '@/modules/config';
import { getAllSetProgresses } from '../setService';
import type { Stats } from '@/modules/character/types';
import type { EquipmentState } from './useEquipmentState';

export function useSetBonus(state: EquipmentState) {
  const { equipment, appliedSetBonuses } = state;

  async function reapplySetBonuses(): Promise<void> {
    const characterStore = useCharacterStore();
    const progresses = getAllSetProgresses(equipment.value, configCache.getSetDefinitions());

    // P9-030 修复：遍历 activeTiers 而非 getActiveBonusEffects，携带 requiredPieces 到 key
    // 避免不同档位的同 stat 同类值碰撞（如 2件套 str+5 与 4件套 str+5 被视为同一 bonus）
    // P10-011 修复：在 key 中加入 tierIndex（档位在 activeTiers 中的索引）作为 tier 标识，
    // 进一步确保不同 tier 不会因 requiredPieces 缺失或重复而碰撞
    const currentStats: Array<{ setId: string; stat: keyof Stats; value: number; requiredPieces: number; tierIndex: number }> = [];
    for (const progress of progresses) {
      for (const [tierIndex, tier] of progress.activeTiers.entries()) {
        for (const effect of tier.bonuses) {
          if (effect.kind === 'stat') {
            currentStats.push({ setId: progress.setId, stat: effect.stat, value: effect.value, requiredPieces: tier.requiredPieces, tierIndex });
          }
        }
      }
    }

    const buildKey = (s: { setId: string; stat: keyof Stats; value: number; requiredPieces?: number; tierIndex?: number }) =>
      `${s.setId}:${s.stat}:${s.value}:${s.requiredPieces ?? 0}:${s.tierIndex ?? 0}`;
    const currentKeys = new Set(currentStats.map(s => buildKey(s)));
    const appliedKeys = new Set(appliedSetBonuses.value.map(b => buildKey(b)));

    // P5-024 修复：先收集需移除/需应用的项目，任一步失败时回滚已应用的部分并重建状态，
    // 避免出现部分 bonus 增减却 appliedSetBonuses 未同步导致的重复累计错误。
    // P11-102 修复：若下方 applyBonus/removeBonus 抛出异常，错误直接传播，
    // appliedSetBonuses 保持旧值不变（不到达下方赋值行），让调用方回滚装备后
    // 重新触发完整的 reapplySetBonuses 重建正确基线。
    for (const b of appliedSetBonuses.value) {
      if (!currentKeys.has(buildKey(b))) {
        await characterStore.removeBonus({ [b.stat]: b.value } as Partial<Stats>);
      }
    }

    for (const s of currentStats) {
      const key = buildKey(s);
      if (!appliedKeys.has(key)) {
        await characterStore.applyBonus({ [s.stat]: s.value } as Partial<Stats>);
      }
    }

    appliedSetBonuses.value = currentStats;
  }

  /**
   * 对齐 diff 基线（P9-006 修复）
   *
   * 角色加载时 bonusStats 已从 DB 恢复（含已持久化的套装 bonus），
   * 此方法仅将 appliedSetBonuses 同步为当前装备状态，不调用 applyBonus/removeBonus，
   * 避免套装 bonus 被重复施加。后续 equip/unequip 走 reapplySetBonuses 做 diff。
   */
  function syncAppliedBonuses(): void {
    const progresses = getAllSetProgresses(equipment.value, configCache.getSetDefinitions());
    const currentStats: Array<{ setId: string; stat: keyof Stats; value: number; requiredPieces: number; tierIndex: number }> = [];
    for (const progress of progresses) {
      for (const [tierIndex, tier] of progress.activeTiers.entries()) {
        for (const effect of tier.bonuses) {
          if (effect.kind === 'stat') {
            currentStats.push({ setId: progress.setId, stat: effect.stat, value: effect.value, requiredPieces: tier.requiredPieces, tierIndex });
          }
        }
      }
    }
    appliedSetBonuses.value = currentStats;
  }

  return { reapplySetBonuses, syncAppliedBonuses };
}
