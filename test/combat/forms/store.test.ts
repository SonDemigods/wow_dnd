/**
 * @fileoverview 德鲁伊形态系统 Pinia Store 单元测试
 *
 * 覆盖 useFormStore 的：
 * 1. 生命周期：initialize（默认/带 savedState）、reset
 * 2. 计算属性：currentForm、switchableForms、statModifiers、各项 multiplier
 * 3. 查询：canSwitch、isSkillAvailable、getSkills、calculateHealAmount
 * 4. 操作：switchTo（成功/失败/冷却阻断）、tickCooldownEnd
 *
 * Mock 策略：
 *  - useCharacterStore 和 useLogStore 通过 vi.hoisted 进行 stub。
 *  - generateLogId 被 mock 为固定值。
 *  - forms/service 中的纯函数使用真实实现，以验证 store 与 service 的集成。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../../utils/setup';
import { useFormStore, setFormContext } from '@/modules/combat/forms/store';
import { FORM_SWITCH_CONFIG } from '@/modules/combat/forms/types';

// ==================== vi.hoisted：跨 store stub 持有对象 ====================
const mocks = vi.hoisted(() => ({
  characterStore: {
    maxHp: 100,
    receiveHeal: vi.fn().mockResolvedValue(undefined),
    // P9-077 修复：测试更新 — 补充 applyBonus/removeBonus 供 setFormContext 注入
    applyBonus: vi.fn().mockResolvedValue(undefined),
    removeBonus: vi.fn().mockResolvedValue(undefined),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
}));

// ==================== Mock：跨 store 依赖 ====================
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => mocks.characterStore,
}));

vi.mock('@/modules/log/store', () => ({
  useLogStore: () => mocks.logStore,
}));

vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log_test_001'),
}));

// ==================== 测试用例 ====================
describe('德鲁伊形态系统 Store', () => {
  let store: ReturnType<typeof useFormStore>;

  beforeEach(() => {
    createTestPinia();
    store = useFormStore();

    mocks.characterStore.receiveHeal.mockClear();
    mocks.logStore.addLogEntry.mockClear();
    mocks.characterStore.applyBonus.mockClear();
    mocks.characterStore.removeBonus.mockClear();
    mocks.characterStore.maxHp = 100;

    // P9-077 修复：测试更新 — 通过 setFormContext 注入外部依赖，替代直接 import useCharacterStore/useLogStore
    setFormContext({
      get maxHp() { return mocks.characterStore.maxHp; },
      receiveHeal: mocks.characterStore.receiveHeal,
      applyBonus: mocks.characterStore.applyBonus,
      removeBonus: mocks.characterStore.removeBonus,
      // P12-006 修复：测试更新 — 补充 setFormHpMultiplier
      setFormHpMultiplier: vi.fn(),
      addLogEntry: mocks.logStore.addLogEntry,
    });
  });

  // ============================================================
  // 生命周期：initialize / reset
  // ============================================================

  describe('生命周期', () => {
    it('initialize: 无参数时重置为默认状态', () => {
      store.initialize();
      expect(store.currentForm).toBe('humanoid');
      expect(store.formState.availableForms).toEqual(['humanoid', 'bear', 'cat', 'moonkin']);
      expect(store.formState.cooldownRemaining).toBe(0);
    });

    it('initialize: 传入 savedState 时正确合并状态', () => {
      store.initialize({ currentForm: 'bear', cooldownRemaining: 1 });
      expect(store.currentForm).toBe('bear');
      expect(store.formState.cooldownRemaining).toBe(1);
    });

    it('reset: 将状态重置为人形形态且冷却清零', () => {
      store.formState.currentForm = 'cat';
      store.formState.cooldownRemaining = 5;
      store.reset();
      expect(store.currentForm).toBe('humanoid');
      expect(store.formState.cooldownRemaining).toBe(0);
    });
  });

  // ============================================================
  // 计算属性
  // ============================================================

  describe('计算属性', () => {
    it('currentForm: 初始值为 humanoid', () => {
      expect(store.currentForm).toBe('humanoid');
    });

    it('switchableForms: 返回不含当前形态的 3 个形态', () => {
      const switchable = store.switchableForms;
      expect(switchable).toHaveLength(3);
      expect(switchable.map(f => f.id)).not.toContain('humanoid');
    });

    it('statModifiers: 人形形态返回所有 1.0 倍率且无属性修正', () => {
      const mods = store.statModifiers;
      expect(mods.hpMultiplier).toBe(1.0);
      expect(mods.damageMultiplier).toBe(1.0);
      expect(mods.defenseMultiplier).toBe(1.0);
      expect(mods.speedMultiplier).toBe(1.0);
      expect(mods.statModifiers).toEqual({});
    });

    it('计算属性: 切换到 bear 形态后各项倍率正确反映', () => {
      store.formState.currentForm = 'bear';
      expect(store.hpMultiplier).toBe(1.3);
      expect(store.damageMultiplier).toBe(0.9);
      expect(store.defenseMultiplier).toBe(1.3);
      expect(store.speedMultiplier).toBe(0.8);
    });

    it('计算属性: 切换到 cat 形态后各项倍率正确反映', () => {
      store.formState.currentForm = 'cat';
      expect(store.hpMultiplier).toBe(0.9);
      expect(store.damageMultiplier).toBe(1.2);
      expect(store.defenseMultiplier).toBe(0.9);
      expect(store.speedMultiplier).toBe(1.3);
    });

    it('计算属性: 切换到 moonkin 形态后各项倍率正确反映', () => {
      store.formState.currentForm = 'moonkin';
      expect(store.hpMultiplier).toBe(1.1);
      expect(store.damageMultiplier).toBe(1.15);
      expect(store.defenseMultiplier).toBe(1.1);
      expect(store.speedMultiplier).toBe(0.9);
    });

    it('currentFormDef: 返回当前形态定义对象', () => {
      const def = store.currentFormDef;
      expect(def.id).toBe('humanoid');
      expect(def.name).toBe('人形形态');
    });
  });

  // ============================================================
  // 查询方法
  // ============================================================

  describe('查询方法', () => {
    it('canSwitch: 相同形态返回 false', () => {
      expect(store.canSwitch('humanoid')).toBe(false);
    });

    it('canSwitch: 冷却中返回 false', () => {
      store.formState.cooldownRemaining = 2;
      expect(store.canSwitch('bear')).toBe(false);
    });

    it('canSwitch: 不同形态且无冷却返回 true', () => {
      expect(store.canSwitch('bear')).toBe(true);
    });

    it('isSkillAvailable: 当前形态技能返回 true，其他形态技能返回 false', () => {
      // humanoid skills: healing_touch, moonfire, wrath, rejuvenation
      expect(store.isSkillAvailable('healing_touch')).toBe(true);
      expect(store.isSkillAvailable('mangle')).toBe(false); // bear skill
    });

    it('getSkills: 初始返回人形形态技能列表', () => {
      const skills = store.getSkills();
      expect(skills).toEqual(
        expect.arrayContaining(['healing_touch', 'moonfire', 'wrath', 'rejuvenation'])
      );
    });

    it('getSkills: 切换到 bear 后返回熊形态技能', () => {
      store.formState.currentForm = 'bear';
      const skills = store.getSkills();
      expect(skills).toEqual(
        expect.arrayContaining(['mangle', 'swipe', 'growl', 'frenzied_regeneration'])
      );
    });

    it('calculateHealAmount: 返回 ceil(maxHp * 0.10)', () => {
      expect(store.calculateHealAmount('bear')).toBe(10); // ceil(100 * 0.10) = 10
      mocks.characterStore.maxHp = 105;
      expect(store.calculateHealAmount('cat')).toBe(11); // ceil(105 * 0.10) = 11
    });
  });

  // ============================================================
  // 操作：switchTo / tickCooldownEnd
  // ============================================================

  describe('switchTo', () => {
    it('成功切换形态并调用 receiveHeal', async () => {
      const result = await store.switchTo('bear');
      expect(result.success).toBe(true);
      expect(store.currentForm).toBe('bear');
      expect(store.formState.cooldownRemaining).toBe(FORM_SWITCH_CONFIG.cooldownTurns);
      expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(10);
      expect(mocks.logStore.addLogEntry).toHaveBeenCalled();
    });

    it('切换为相同形态返回失败及原因', async () => {
      const result = await store.switchTo('humanoid');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已处于该形态');
    });

    it('冷却中切换返回失败及原因', async () => {
      store.formState.cooldownRemaining = 2;
      const result = await store.switchTo('bear');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('冷却中');
    });

    it('receiveHeal 失败时不阻断切换流程', async () => {
      mocks.characterStore.receiveHeal.mockRejectedValueOnce(new Error('DB error'));
      const result = await store.switchTo('cat');
      expect(result.success).toBe(true);
      expect(store.currentForm).toBe('cat');
    });
  });

  describe('tickCooldownEnd', () => {
    it('冷却大于 0 时减少 1', () => {
      store.formState.cooldownRemaining = 2;
      store.tickCooldownEnd();
      expect(store.formState.cooldownRemaining).toBe(1);
    });

    it('冷却为 0 时保持不变', () => {
      store.formState.cooldownRemaining = 0;
      store.tickCooldownEnd();
      expect(store.formState.cooldownRemaining).toBe(0);
    });
  });
});
