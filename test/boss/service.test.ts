/**
 * @fileoverview Boss 模块服务函数单元测试
 * @description 测试 createBossInstance 的实例创建、等级缩放、掉落注入、阶段管理器注入等行为
 */
import { describe, it, expect } from 'vitest';
import { createBossInstance } from '@/modules/boss/service';
import { BOSS_DROP_TABLE, generateEnemyStats } from '@/modules/enemy/service';
import { BossPhaseManager } from '@/modules/boss/phaseManager';
import type { BossTemplate } from '@/modules/boss/types';

/** 创建测试用 Boss 模板 */
function makeBossTemplate(overrides: Partial<BossTemplate> = {}): BossTemplate {
  return {
    id: 'boss_test_001',
    name: '测试Boss',
    icon: 'game-icons:dragon',
    maxHp: 1000,
    damage: [20, 40],
    xp: 500,
    gold: 300,
    dangerLevel: '致命',
    isBoss: true,
    physicalAttack: 50,
    physicalDefense: 20,
    magicAttack: 30,
    magicDefense: 15,
    critChance: 0.2,
    dodgeChance: 0.1,
    ...overrides
  };
}

describe('createBossInstance', () => {
  describe('ID 与基础属性', () => {
    it('创建的实例 ID 以 boss_ 开头', () => {
      const boss = createBossInstance(makeBossTemplate(), 10);
      expect(boss.id).toMatch(/^boss_\d+_[a-z0-9]+$/);
    });

    it('dataId 等于模板 ID', () => {
      const template = makeBossTemplate();
      const boss = createBossInstance(template, 10);
      expect(boss.dataId).toBe(template.id);
    });

    it('level 等于传入的等级', () => {
      const boss = createBossInstance(makeBossTemplate(), 15);
      expect(boss.level).toBe(15);
    });

    it('isBoss 固定为 true', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.isBoss).toBe(true);
    });

    it('每次创建的实例 ID 不同', () => {
      const template = makeBossTemplate();
      const boss1 = createBossInstance(template, 1);
      const boss2 = createBossInstance(template, 1);
      expect(boss1.id).not.toBe(boss2.id);
    });
  });

  describe('等级缩放属性', () => {
    it('hp 和 maxHp 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ maxHp: 1000 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.hp).toBe(derived.hp);
      expect(boss.maxHp).toBe(derived.maxHp);
    });

    it('stats 等于等级缩放后的六维属性', () => {
      const template = makeBossTemplate();
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.stats).toEqual(derived.stats);
    });

    it('expReward 等于等级缩放后的经验值', () => {
      const template = makeBossTemplate({ xp: 500 });
      const boss = createBossInstance(template, 3);
      const derived = generateEnemyStats(template, 3);
      expect(boss.expReward).toBe(derived.expReward);
    });

    it('goldReward 等于等级缩放后的金币', () => {
      const template = makeBossTemplate({ gold: 300 });
      const boss = createBossInstance(template, 3);
      const derived = generateEnemyStats(template, 3);
      expect(boss.goldReward).toBe(derived.goldReward);
    });

    it('physicalAttack 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ physicalAttack: 50 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.physicalAttack).toBe(derived.physicalAttack);
    });

    it('physicalDefense 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ physicalDefense: 20 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.physicalDefense).toBe(derived.physicalDefense);
    });

    it('magicAttack 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ magicAttack: 30 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.magicAttack).toBe(derived.magicAttack);
    });

    it('magicDefense 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ magicDefense: 15 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.magicDefense).toBe(derived.magicDefense);
    });

    it('damage 等于等级缩放后的伤害范围', () => {
      const template = makeBossTemplate({ damage: [20, 40] });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.damage).toEqual(derived.damage);
    });

    it('等级为 1 时属性不缩放', () => {
      const template = makeBossTemplate({ maxHp: 1000, physicalAttack: 50 });
      const boss = createBossInstance(template, 1);
      expect(boss.maxHp).toBe(1000);
      expect(boss.physicalAttack).toBe(50);
    });
  });

  describe('掉落表与阶段管理器', () => {
    it('drops 是 BOSS_DROP_TABLE 的副本', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.drops).toEqual(BOSS_DROP_TABLE);
      expect(boss.drops).not.toBe(BOSS_DROP_TABLE); // 新数组，非同引用
    });

    it('注入了 BossPhaseManager 实例', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.phaseManager).toBeInstanceOf(BossPhaseManager);
    });

    it('保留模板上的 phases 配置', () => {
      const phases = [
        { hpThreshold: 1.0, name: 'P1', dialogue: [], aiStrategy: 'balanced' as const, mechanics: [] }
      ];
      const boss = createBossInstance(makeBossTemplate({ phases }), 1);
      expect(boss.phases).toEqual(phases);
    });

    it('保留模板上的 intro 配置', () => {
      const intro = { effect: 'darken' as const, lines: ['出现'], duration: 1000 };
      const boss = createBossInstance(makeBossTemplate({ intro }), 1);
      expect(boss.intro).toEqual(intro);
    });
  });
});
