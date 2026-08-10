/**
 * @fileoverview 套装奖励计算 Composable（P3-155 拆分自 store.ts）
 * @description 提供套装效果的 diff 应用/移除逻辑。
 * @module equipment/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { configCache } from '@/modules/config';
import { getAllSetProgresses, getActiveBonusEffects } from '../setService';
import type { Stats } from '@/modules/character/types';
import type { EquipmentState } from './useEquipmentState';

export function useSetBonus(state: EquipmentState) {
  const { equipment, appliedSetBonuses } = state;

  async function reapplySetBonuses(): Promise<void> {
    const characterStore = useCharacterStore();
    const progresses = getAllSetProgresses(equipment.value, configCache.getSetDefinitions());

    const currentStats: Array<{ setId: string; stat: keyof Stats; value: number }> = [];
    for (const progress of progresses) {
      for (const effect of getActiveBonusEffects(progress)) {
        if (effect.kind === 'stat') {
          currentStats.push({ setId: progress.setId, stat: effect.stat, value: effect.value });
        }
      }
    }

    const buildKey = (setId: string, stat: keyof Stats, value: number) => `${setId}:${stat}:${value}`;
    const currentKeys = new Set(currentStats.map(s => buildKey(s.setId, s.stat, s.value)));
    const appliedKeys = new Set(appliedSetBonuses.value.map(b => buildKey(b.setId, b.stat, b.value)));

    // P5-024 修复：先收集需移除/需应用的项目，任一步失败时回滚已应用的部分并重建状态，
    // 避免出现部分 bonus 增减却 appliedSetBonuses 未同步导致的重复累计错误。
    try {
      for (const b of appliedSetBonuses.value) {
        if (!currentKeys.has(buildKey(b.setId, b.stat, b.value))) {
          await characterStore.removeBonus({ [b.stat]: b.value } as Partial<Stats>);
        }
      }

      for (const s of currentStats) {
        const key = buildKey(s.setId, s.stat, s.value);
        if (!appliedKeys.has(key)) {
          await characterStore.applyBonus({ [s.stat]: s.value } as Partial<Stats>);
        }
      }
    } catch (err) {
      // 失败时重建 appliedSetBonuses 为当前实际状态（尽力而为），避免下次 diff 重复增删
      appliedSetBonuses.value = currentStats;
      throw err;
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
    const currentStats: Array<{ setId: string; stat: keyof Stats; value: number }> = [];
    for (const progress of progresses) {
      for (const effect of getActiveBonusEffects(progress)) {
        if (effect.kind === 'stat') {
          currentStats.push({ setId: progress.setId, stat: effect.stat, value: effect.value });
        }
      }
    }
    appliedSetBonuses.value = currentStats;
  }

  return { reapplySetBonuses, syncAppliedBonuses };
}
