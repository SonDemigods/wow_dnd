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

    appliedSetBonuses.value = currentStats;
  }

  return { reapplySetBonuses };
}
