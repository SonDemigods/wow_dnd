/**
 * @fileoverview 技能模块 service 纯函数单元测试（CODE-61 修复）
 *
 * 重点覆盖 canCastSkill 的四维校验逻辑（BIZ-11 修复后扩展）：
 * 1. 沉默状态校验
 * 2. 冷却时间校验
 * 3. 法力值校验
 * 4. 资源系统校验（怒气/能量/连击点等）
 * 5. 旧签名向后兼容（第二个参数为 number）
 */
import { describe, it, expect } from 'vitest';
import { canCastSkill } from './service';
import type { CanCastSkillOptions } from './service';
import type { Skill } from './types';

/** 构造测试用 Skill 实例 */
function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_skill',
    name: '测试技能',
    icon: 'game-icons:shield',
    description: '测试用技能',
    mpCost: 20,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 50 },
    unlockLevel: 1,
    ...overrides,
  };
}

describe('canCastSkill 施放校验', () => {
  // ==================== 沉默检查 ====================
  describe('沉默状态校验', () => {
    it('被沉默时禁止施放任何技能', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, {
        currentMana: 100,
        isSilenced: true,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('沉默');
    });

    it('未沉默时不受此条件影响', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, {
        currentMana: 100,
        isSilenced: false,
      });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 冷却检查 ====================
  describe('冷却时间校验', () => {
    it('冷却中（currentCooldown > 0）禁止施放', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, {
        currentMana: 100,
        currentCooldown: 2,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('冷却');
    });

    it('冷却已就绪（currentCooldown = 0）可以施放', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, {
        currentMana: 100,
        currentCooldown: 0,
      });
      expect(result.canCast).toBe(true);
    });

    it('未传入 currentCooldown 时不做冷却校验', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, { currentMana: 100 });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 法力检查 ====================
  describe('法力值校验', () => {
    it('法力不足时禁止施放', () => {
      const skill = makeSkill({ mpCost: 50 });
      const result = canCastSkill(skill, { currentMana: 30 });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('法力');
    });

    it('法力刚好等于消耗量时可以施放', () => {
      const skill = makeSkill({ mpCost: 50 });
      const result = canCastSkill(skill, { currentMana: 50 });
      expect(result.canCast).toBe(true);
    });

    it('法力充足时可以施放', () => {
      const skill = makeSkill({ mpCost: 20 });
      const result = canCastSkill(skill, { currentMana: 100 });
      expect(result.canCast).toBe(true);
    });

    it('零消耗技能始终满足法力条件', () => {
      const skill = makeSkill({ mpCost: 0 });
      const result = canCastSkill(skill, { currentMana: 0 });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 资源系统检查 ====================
  describe('资源系统校验', () => {
    it('技能配置 resourceType/resourceCost 且资源不足时禁止施放', () => {
      const skill = makeSkill({
        mpCost: 0,
        resourceType: 'rage',
        resourceCost: 30,
      });
      const result = canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: (_type, _cost) => false,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('资源');
    });

    it('技能配置 resourceType/resourceCost 且资源充足时可以施放', () => {
      const skill = makeSkill({
        mpCost: 0,
        resourceType: 'energy',
        resourceCost: 40,
      });
      const result = canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: (_type, _cost) => true,
      });
      expect(result.canCast).toBe(true);
    });

    it('hasEnoughResource 接收正确的 resourceType 和 resourceCost', () => {
      const skill = makeSkill({
        resourceType: 'combo_point',
        resourceCost: 3,
      });
      let receivedType = '';
      let receivedCost = 0;
      canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: (type, cost) => {
          receivedType = type;
          receivedCost = cost;
          return true;
        },
      });
      expect(receivedType).toBe('combo_point');
      expect(receivedCost).toBe(3);
    });

    it('技能未配置 resourceType 时跳过资源校验', () => {
      const skill = makeSkill({ mpCost: 10 });
      const result = canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: () => false,
      });
      expect(result.canCast).toBe(true);
    });

    it('未传入 hasEnoughResource 时跳过资源校验', () => {
      const skill = makeSkill({
        mpCost: 10,
        resourceType: 'rage',
        resourceCost: 20,
      });
      const result = canCastSkill(skill, { currentMana: 100 });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 校验顺序 ====================
  describe('校验顺序（短路求值）', () => {
    it('沉默优先于冷却', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, {
        currentMana: 100,
        isSilenced: true,
        currentCooldown: 5,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('沉默');
    });

    it('冷却优先于法力', () => {
      const skill = makeSkill({ mpCost: 999 });
      const result = canCastSkill(skill, {
        currentMana: 1,
        currentCooldown: 3,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('冷却');
    });

    it('法力优先于资源系统', () => {
      const skill = makeSkill({
        mpCost: 999,
        resourceType: 'rage',
        resourceCost: 999,
      });
      const result = canCastSkill(skill, {
        currentMana: 1,
        hasEnoughResource: () => false,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('法力');
    });
  });

  // ==================== 向后兼容 ====================
  describe('旧签名向后兼容', () => {
    it('第二个参数为 number 时视为 currentMana', () => {
      const skill = makeSkill({ mpCost: 20 });
      const result = canCastSkill(skill, 100);
      expect(result.canCast).toBe(true);
    });

    it('旧签名法力不足时返回 false', () => {
      const skill = makeSkill({ mpCost: 50 });
      const result = canCastSkill(skill, 10);
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('法力');
    });
  });

  // ==================== 全部通过 ====================
  describe('全部条件通过', () => {
    it('所有校验均通过时返回 canCast=true', () => {
      const skill = makeSkill({
        mpCost: 20,
        resourceType: 'rage',
        resourceCost: 30,
      });
      const opts: CanCastSkillOptions = {
        currentMana: 100,
        currentCooldown: 0,
        isSilenced: false,
        hasEnoughResource: () => true,
      };
      const result = canCastSkill(skill, opts);
      expect(result.canCast).toBe(true);
      expect(result.reason).toBe('');
    });
  });
});
