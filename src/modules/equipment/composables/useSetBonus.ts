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
    const currentStats: Array<{ setId: string; stat: keyof Stats; value: number; requiredPieces: number }> = [];
    for (const progress of progresses) {
      for (const tier of progress.activeTiers) {
        for (const effect of tier.bonuses) {
          if (effect.kind === 'stat') {
            currentStats.push({ setId: progress.setId, stat: effect.stat, value: effect.value, requiredPieces: tier.requiredPieces });
          }
        }
      }
    }

    const buildKey = (s: { setId: string; stat: keyof Stats; value: number; requiredPieces?: number }) =>
      `${s.setId}:${s.stat}:${s.value}:${s.requiredPieces ?? 0}`;
    const currentKeys = new Set(currentStats.map(s => buildKey(s)));
    const appliedKeys = new Set(appliedSetBonuses.value.map(b => buildKey(b)));

    // P5-024 修复：先收集需移除/需应用的项目，任一步失败时回滚已应用的部分并重建状态，
    // 避免出现部分 bonus 增减却 appliedSetBonuses 未同步导致的重复累计错误。
    try {
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
    const currentStats: Array<{ setId: string; stat: keyof Stats; value: number; requiredPieces: number }> = [];
    for (const progress of progresses) {
      for (const tier of progress.activeTiers) {
        for (const effect of tier.bonuses) {
          if (effect.kind === 'stat') {
            currentStats.push({ setId: progress.setId, stat: effect.stat, value: effect.value, requiredPieces: tier.requiredPieces });
          }
        }
      }
    }
    appliedSetBonuses.value = currentStats;
  }

  return { reapplySetBonuses, syncAppliedBonuses };
}
