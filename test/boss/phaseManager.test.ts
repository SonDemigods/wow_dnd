/**
 * @fileoverview Boss 阶段管理器单元测试
 * @description 测试 BossPhaseManager 类的阶段定位、切换检测、重置等行为
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BossPhaseManager } from '@/modules/boss/phaseManager';
import type { BossPhase } from '@/modules/boss/types';

/**
 * 创建测试用阶段配置
 *
 * 按 HP 阈值降序排列（高阈值在前，低阈值在后），
 * 配合 findPhaseIndex 从高索引向低索引遍历的逻辑：
 * - 高索引阈值低，HP 降到该阈值以下时匹配
 * - 低索引阈值高，HP 较高时匹配
 */
function makePhases(): BossPhase[] {
  return [
    { hpThreshold: 1.0, name: '阶段1', dialogue: [], aiStrategy: 'balanced', mechanics: [] },
    { hpThreshold: 0.5, name: '阶段2', dialogue: [], aiStrategy: 'aggressive', mechanics: [] },
    { hpThreshold: 0.2, name: '阶段3', dialogue: [], aiStrategy: 'boss_phase', mechanics: [] }
  ];
}

describe('BossPhaseManager', () => {
  let manager: BossPhaseManager;

  beforeEach(() => {
    manager = new BossPhaseManager();
  });

  describe('getCurrentPhase', () => {
    it('phases 为空时返回 null 且不切换', () => {
      const result = manager.getCurrentPhase([], 500, 1000);
      expect(result.phase).toBeNull();
      expect(result.changed).toBe(false);
    });

    it('HP 满血时返回初始阶段1（首次 changed=true）', () => {
      const phases = makePhases();
      const result = manager.getCurrentPhase(phases, 1000, 1000);
      expect(result.phase?.name).toBe('阶段1');
      expect(result.changed).toBe(true);
    });

    it('HP 降到 50% 阈值时切换到阶段2', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 初始阶段1
      const result = manager.getCurrentPhase(phases, 500, 1000);
      expect(result.phase?.name).toBe('阶段2');
      expect(result.changed).toBe(true);
    });

    it('HP 降到 20% 阈值时切换到阶段3', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      manager.getCurrentPhase(phases, 500, 1000); // 阶段2
      const result = manager.getCurrentPhase(phases, 200, 1000);
      expect(result.phase?.name).toBe('阶段3');
      expect(result.changed).toBe(true);
    });

    it('连续调用相同 HP 时 changed 为 false', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 首次 changed=true
      const result = manager.getCurrentPhase(phases, 1000, 1000);
      expect(result.changed).toBe(false);
      expect(result.phase?.name).toBe('阶段1');
    });

    it('HP 在同一阶段内波动时不切换', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      // 60% HP 仍高于 50% 阈值，停留在阶段1
      const result = manager.getCurrentPhase(phases, 600, 1000);
      expect(result.phase?.name).toBe('阶段1');
      expect(result.changed).toBe(false);
    });

    it('HP 降到 0 时返回最后阶段', () => {
      const phases = makePhases();
      const result = manager.getCurrentPhase(phases, 0, 1000);
      expect(result.phase?.name).toBe('阶段3');
      expect(result.changed).toBe(true);
    });

    it('HP 降到 30% 时切换到阶段2（30% > 20% 阈值）', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      const result = manager.getCurrentPhase(phases, 300, 1000);
      expect(result.phase?.name).toBe('阶段2');
      expect(result.changed).toBe(true);
    });

    it('HP 降到 10% 时切换到阶段3（10% < 20% 阈值）', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      const result = manager.getCurrentPhase(phases, 100, 1000);
      expect(result.phase?.name).toBe('阶段3');
      expect(result.changed).toBe(true);
    });

    it('阶段切换后 HP 继续下降到更低阶段时 changed=true', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      manager.getCurrentPhase(phases, 500, 1000); // 阶段2
      manager.getCurrentPhase(phases, 500, 1000); // 阶段2（changed=false）
      const result = manager.getCurrentPhase(phases, 200, 1000); // 阶段3
      expect(result.phase?.name).toBe('阶段3');
      expect(result.changed).toBe(true);
    });

    it('findPhaseIndex 返回越界索引时 phase 为 null（防御性兜底分支）', () => {
      const phases = makePhases();
      // 模拟 findPhaseIndex 返回越界索引以覆盖 `phases[newIndex] || null` 的 falsy 分支
      vi.spyOn(manager as unknown as { findPhaseIndex: () => number | null }, 'findPhaseIndex').mockReturnValue(99);
      const result = manager.getCurrentPhase(phases, 500, 1000);
      expect(result.phase).toBeNull();
      expect(result.changed).toBe(true);
    });
  });

  describe('reset', () => {
    it('重置后下一次调用 changed 为 true', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 首次
      manager.getCurrentPhase(phases, 1000, 1000); // changed=false
      manager.reset();
      const result = manager.getCurrentPhase(phases, 1000, 1000);
      expect(result.changed).toBe(true);
    });

    it('重置后可重新定位到当前 HP 对应阶段', () => {
      const phases = makePhases();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      manager.reset();
      // 直接从 50% HP 开始定位
      const result = manager.getCurrentPhase(phases, 500, 1000);
      expect(result.phase?.name).toBe('阶段2');
      expect(result.changed).toBe(true);
    });

    it('连续 reset 不影响后续定位', () => {
      const phases = makePhases();
      manager.reset();
      manager.reset();
      const result = manager.getCurrentPhase(phases, 1000, 1000);
      expect(result.phase?.name).toBe('阶段1');
      expect(result.changed).toBe(true);
    });
  });

  // -------------------- hpThreshold=0 基础阶段跳过（BIZ-23） --------------------

  describe('基础阶段（hpThreshold=0）跳过逻辑', () => {
    /** 构造含基础阶段（hpThreshold=0）的阶段配置 */
    function makePhasesWithBase(): BossPhase[] {
      return [
        { hpThreshold: 1.0, name: '阶段1', dialogue: [], aiStrategy: 'balanced', mechanics: [] },
        { hpThreshold: 0.5, name: '阶段2', dialogue: [], aiStrategy: 'aggressive', mechanics: [] },
        { hpThreshold: 0.2, name: '濒死挣扎', dialogue: [], aiStrategy: 'boss_phase', mechanics: [] },
        { hpThreshold: 0, name: '基础阶段', dialogue: [], aiStrategy: 'balanced', mechanics: [] },
      ];
    }

    it('HP 满血时定位到阶段1（跳过基础阶段）', () => {
      const phases = makePhasesWithBase();
      const result = manager.getCurrentPhase(phases, 1000, 1000);
      expect(result.phase?.name).toBe('阶段1');
      expect(result.changed).toBe(true);
    });

    it('HP 降到 0 时不切回基础阶段，停留在濒死挣扎（BIZ-23）', () => {
      const phases = makePhasesWithBase();
      manager.getCurrentPhase(phases, 1000, 1000); // 阶段1
      manager.getCurrentPhase(phases, 500, 1000); // 阶段2
      manager.getCurrentPhase(phases, 200, 1000); // 濒死挣扎
      // HP=0 时应跳过基础阶段（hpThreshold=0），停留在濒死挣扎
      const result = manager.getCurrentPhase(phases, 0, 1000);
      expect(result.phase?.name).toBe('濒死挣扎');
      expect(result.changed).toBe(false);
    });

    it('仅含基础阶段（hpThreshold=0）时 HP 满血返回基础阶段', () => {
      const phases: BossPhase[] = [
        { hpThreshold: 0, name: '基础阶段', dialogue: [], aiStrategy: 'balanced', mechanics: [] },
      ];
      // 基础阶段被跳过，但 HP 高于所有非零阈值（无），返回最后一个阶段（基础阶段）
      const result = manager.getCurrentPhase(phases, 1000, 1000);
      expect(result.phase?.name).toBe('基础阶段');
      expect(result.changed).toBe(true);
    });

    it('仅含基础阶段且 HP=0 时仍返回基础阶段（兜底返回最后一个）', () => {
      const phases: BossPhase[] = [
        { hpThreshold: 0, name: '基础阶段', dialogue: [], aiStrategy: 'balanced', mechanics: [] },
      ];
      const result = manager.getCurrentPhase(phases, 0, 1000);
      expect(result.phase?.name).toBe('基础阶段');
    });
  });
});
