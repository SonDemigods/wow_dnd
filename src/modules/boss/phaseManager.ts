/**
 * @fileoverview Boss 阶段管理器
 * @description 管理 Boss 多阶段战斗逻辑，包括阶段定位、阶段切换检测。
 *              从原 engine.ts 中独立拆分，以解决 types.ts ↔ engine.ts 的循环依赖问题。
 *
 *              阶段七升级（P3-92）：
 *              - currentPhaseIndex 改为 ref<number>，使 UI 组件可直接订阅阶段变化
 *              - 外部通过 readonly currentPhaseIndex 读取响应式索引
 *              - combat 层无需手动同步索引到 store，减少重复状态
 */
import { ref, readonly, type Ref, type DeepReadonly } from 'vue';
import type { BossPhase } from './types';

/**
 * Boss 阶段管理器
 *
 * 维护 currentPhaseIndex 内部状态以跟踪当前阶段。战斗开始时索引为 -1（未初始化），
 * 首次调用 getCurrentPhase 时自动定位到对应阶段。阶段切换通过 changed 返回值通知调用方。
 *
 * 阶段查找规则：从高索引向低索引遍历 phases 数组，返回第一个 hpPercent ≤ hpThreshold 的阶段。
 * 若 HP 高于所有阈值，则处于基础阶段（数组最后一个，即索引最大的阶段）。
 *
 * 响应式说明（阶段七）：
 *   - 内部 _currentPhaseIndex 为 ref<number>，阶段切换时响应式更新
 *   - 外部通过 readonly currentPhaseIndex 订阅变化，UI 组件可直接 watch
 *   - combat 层不再需要在 store 中维护重复的 currentPhaseIndex ref
 */
export class BossPhaseManager {
  /** 当前阶段索引（响应式），-1 表示未初始化（战斗开始时自动定位到对应阶段） */
  private readonly _currentPhaseIndex: Ref<number> = ref(-1);

  /**
   * 当前阶段索引的只读响应式引用
   *
   * 供 UI 组件和外部订阅者读取阶段变化。写入仅限本类内部通过 getCurrentPhase/reset。
   *
   * @returns DeepReadonly<Ref<number>> - 只读 ref，值为当前阶段索引（-1 表示未初始化）
   */
  readonly currentPhaseIndex: DeepReadonly<Ref<number>> = readonly(this._currentPhaseIndex);

  /**
   * 获取当前阶段并检测是否发生切换
   *
   * @param phases - 阶段配置数组（按 HP 阈值降序排列，索引越大阈值越高）
   * @param currentHp - Boss 当前 HP
   * @param maxHp - Boss 最大 HP
   * @returns phase：当前应处于的阶段（null 表示 phases 为空）；changed：本次调用是否发生了阶段切换
   */
  getCurrentPhase(phases: BossPhase[], currentHp: number, maxHp: number): {
    phase: BossPhase | null;
    changed: boolean;
  } {
    // P8-024 修复：maxHp 为 0 时返回基础阶段，避免 NaN 导致阶段定位失真
    if (maxHp <= 0) return { phase: null, changed: false };
    const hpPercent = currentHp / maxHp;
    const newIndex = this.findPhaseIndex(phases, hpPercent);

    if (newIndex === null) return { phase: null, changed: false };

    const changed = newIndex !== this._currentPhaseIndex.value;
    if (changed) {
      this._currentPhaseIndex.value = newIndex;
    }
    return { phase: phases[newIndex] || null, changed };
  }

  /**
   * 重置阶段索引到未初始化状态
   *
   * 战斗重新开始或 Boss 复活时调用，使 getCurrentPhase 在下一次调用时重新定位阶段。
   * 响应式更新 _currentPhaseIndex，订阅者会收到变化通知。
   */
  reset(): void {
    this._currentPhaseIndex.value = -1;
  }

  /**
   * 根据 HP 百分比查找应处于的阶段索引
   *
   * 从高索引向低索引遍历（高阈值优先），找到第一个满足 hpPercent ≤ hpThreshold 的阶段。
   * 跳过 hpThreshold === 0 的基础阶段（BIZ-23 修复：防止 BOSS 临死时切回基础阶段）。
   * 若 HP 高于所有阈值，返回最后一个阶段索引（基础阶段）。
   * 若 phases 为空，返回 null。
   */
  private findPhaseIndex(phases: BossPhase[], hpPercent: number): number | null {
    for (let i = phases.length - 1; i >= 0; i--) {
      // 跳过基础阶段（hpThreshold === 0），防止 BOSS HP=0 时切回基础阶段而非濒死挣扎阶段
      if (phases[i].hpThreshold === 0) continue;
      if (hpPercent <= phases[i].hpThreshold) {
        return i;
      }
    }
    // HP 高于所有阈值时，处于基础阶段（数组最后一个阶段）
    return phases.length > 0 ? phases.length - 1 : null;
  }
}
