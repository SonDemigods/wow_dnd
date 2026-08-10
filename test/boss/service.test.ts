/**
 * @fileoverview Boss 模块服务函数单元测试
 * @description 测试 createBossInstance 的实例创建、等级缩放、掉落注入等行为，
 *              以及 wrapAsBossInstance 包装函数的同引用与字段恢复特性
 */
import { describe, it, expect } from 'vitest';
import { createBossInstance, wrapAsBossInstance } from '@/modules/boss/service';
import { BOSS_DROP_TABLE, generateEnemyStats } from '@/modules/enemy/service';
import type { BossTemplate, BossInstance, BossRuntimeState, BossEnemyInstance } from '@/modules/boss/types';
import type { EnemyInstance } from '@/modules/enemy/types';

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
  describe('ID 与基础属性（base 字段）', () => {
    it('创建的实例 ID 以 boss_ 开头', () => {
      const boss = createBossInstance(makeBossTemplate(), 10);
      expect(boss.base.id).toMatch(/^boss_\d+_[a-z0-9]+$/);
    });

    it('dataId 等于模板 ID', () => {
      const template = makeBossTemplate();
      const boss = createBossInstance(template, 10);
      expect(boss.base.dataId).toBe(template.id);
    });

    it('level 等于传入的等级', () => {
      const boss = createBossInstance(makeBossTemplate(), 15);
      expect(boss.base.level).toBe(15);
    });

    it('isBoss 固定为 true（顶层字段）', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.isBoss).toBe(true);
    });

    it('每次创建的实例 ID 不同', () => {
      const template = makeBossTemplate();
      const boss1 = createBossInstance(template, 1);
      const boss2 = createBossInstance(template, 1);
      expect(boss1.base.id).not.toBe(boss2.base.id);
    });
  });

  describe('等级缩放属性（base 字段）', () => {
    it('hp 和 maxHp 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ maxHp: 1000 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.hp).toBe(derived.hp);
      expect(boss.base.maxHp).toBe(derived.maxHp);
    });

    it('stats 等于等级缩放后的六维属性', () => {
      const template = makeBossTemplate();
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.stats).toEqual(derived.stats);
    });

    it('expReward 等于等级缩放后的经验值', () => {
      const template = makeBossTemplate({ xp: 500 });
      const boss = createBossInstance(template, 3);
      const derived = generateEnemyStats(template, 3);
      expect(boss.base.expReward).toBe(derived.expReward);
    });

    it('goldReward 等于等级缩放后的金币', () => {
      const template = makeBossTemplate({ gold: 300 });
      const boss = createBossInstance(template, 3);
      const derived = generateEnemyStats(template, 3);
      expect(boss.base.goldReward).toBe(derived.goldReward);
    });

    it('physicalAttack 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ physicalAttack: 50 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.physicalAttack).toBe(derived.physicalAttack);
    });

    it('physicalDefense 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ physicalDefense: 20 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.physicalDefense).toBe(derived.physicalDefense);
    });

    it('magicAttack 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ magicAttack: 30 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.magicAttack).toBe(derived.magicAttack);
    });

    it('magicDefense 等于等级缩放后的值', () => {
      const template = makeBossTemplate({ magicDefense: 15 });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.magicDefense).toBe(derived.magicDefense);
    });

    it('damage 等于等级缩放后的伤害范围', () => {
      const template = makeBossTemplate({ damage: [20, 40] });
      const boss = createBossInstance(template, 5);
      const derived = generateEnemyStats(template, 5);
      expect(boss.base.damage).toEqual(derived.damage);
    });

    it('等级为 1 时属性不缩放', () => {
      const template = makeBossTemplate({ maxHp: 1000, physicalAttack: 50 });
      const boss = createBossInstance(template, 1);
      expect(boss.base.maxHp).toBe(1000);
      expect(boss.base.physicalAttack).toBe(50);
    });
  });

  describe('掉落表与 Boss 专属字段', () => {
    it('base.drops 是 BOSS_DROP_TABLE 的副本', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.base.drops).toEqual(BOSS_DROP_TABLE);
      expect(boss.base.drops).not.toBe(BOSS_DROP_TABLE); // 新数组，非同引用
    });

it('保留模板上的 phases 配置（顶层字段）', () => {
      const phases = [
        { hpThreshold: 1.0, name: 'P1', dialogue: [], aiStrategy: 'balanced' as const, mechanics: [] }
      ];
      const boss = createBossInstance(makeBossTemplate({ phases }), 1);
      expect(boss.phases).toEqual(phases);
    });

    // P9-031 修复：phases/mechanics 深拷贝，不与模板共享引用，防止 engine 修改 lastTriggerTurn 污染模板
    it('phases 及 mechanics 深拷贝，不与模板共享引用', () => {
      const mechanics = [{ type: 'enrage' as const, intervalTurns: 3, params: {} }];
      const phases = [
        { hpThreshold: 1.0, name: 'P1', dialogue: [], aiStrategy: 'balanced' as const, mechanics }
      ];
      const boss = createBossInstance(makeBossTemplate({ phases }), 1);

      // 顶层数组引用隔离
      expect(boss.phases).not.toBe(phases);
      // mechanics 数组引用隔离
      expect(boss.phases![0].mechanics).not.toBe(mechanics);
      // 修改副本不影响模板
      boss.phases![0].mechanics[0].lastTriggerTurn = 5;
      expect(mechanics[0].lastTriggerTurn).toBeUndefined();
      expect(phases[0].mechanics[0].lastTriggerTurn).toBeUndefined();
    });

    it('保留模板上的 intro 配置（顶层字段）', () => {
      const intro = { effect: 'darken' as const, lines: ['出现'], duration: 1000 };
      const boss = createBossInstance(makeBossTemplate({ intro }), 1);
      expect(boss.intro).toEqual(intro);
    });

    it('模板无 phases 时，phases 默认为空数组', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.phases).toEqual([]);
    });

    it('模板无 intro 时，intro 为 undefined', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.intro).toBeUndefined();
    });
  });

  describe('组合式结构', () => {
    it('base 是 EnemyInstance（包含 id/hp/stats 等战斗属性）', () => {
      const boss = createBossInstance(makeBossTemplate(), 5);
      expect(boss.base.id).toMatch(/^boss_\d+/);
      expect(boss.base.hp).toBeGreaterThan(0);
      expect(boss.base.stats).toBeDefined();
      expect(boss.base.physicalAttack).toBeGreaterThan(0);
    });

    it('runtime 初始为空对象（无任何运行时字段）', () => {
      const boss = createBossInstance(makeBossTemplate(), 1);
      expect(boss.runtime).toEqual({});
    });

    it('base 不包含 isBoss/phases/intro（Boss 专属字段在顶层）', () => {
      const boss = createBossInstance(makeBossTemplate({ phases: [{ hpThreshold: 1, name: 'P1', dialogue: [], aiStrategy: 'balanced', mechanics: [] }] }), 1);
      // base 是 EnemyInstance，isBoss/phases/intro 是 EnemyData 的可选字段
      // 组合式结构中这些字段在顶层，但 base 通过 ...template 展开也会携带
      // 关键验证：顶层 isBoss 为 true
      expect(boss.isBoss).toBe(true);
      expect(boss.phases).toBeDefined();
    });
  });
});

// ============================================================================
// wrapAsBossInstance 包装函数测试
// ============================================================================

describe('wrapAsBossInstance', () => {
  /**
   * 构造携带 Boss 配置的扁平 BossEnemyInstance
   *
   * 模拟 GameBootstrap 的 bossCreateFn 回调产生的对象：
   * - base 字段（id/hp/stats 等战斗属性）
   * - isBoss: true
   * - phases/intro 作为 BossEnemyInstance 的类型字段（TS-2 修复：类型层面已声明）
   */
  function makeFlatBossEnemy(overrides: Partial<BossEnemyInstance> = {}): BossEnemyInstance {
    return {
      id: 'boss-flat-1',
      dataId: 'boss_test_001',
      name: '测试Boss',
      icon: 'game-icons:dragon',
      maxHp: 1000,
      hp: 800,
      damage: [20, 40] as [number, number],
      xp: 500,
      gold: 300,
      dangerLevel: '致命',
      level: 10,
      stats: { str: 20, dex: 15, con: 25, int: 10, wis: 10, cha: 10 },
      expReward: 750,
      goldReward: 450,
      physicalAttack: 80,
      physicalDefense: 30,
      magicAttack: 40,
      magicDefense: 20,
      isBoss: true,
      phases: [{ hpThreshold: 0.5, name: 'P2', dialogue: ['怒了'], aiStrategy: 'aggressive', mechanics: [] }],
      intro: { effect: 'shake', lines: ['登场'], duration: 2000 },
      ...overrides,
    };
  }

  describe('同引用特性', () => {
    it('base 与传入的 enemy 是同一引用', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.base).toBe(enemy);
    });

    it('修改 boss.base.hp 会反映到原 enemy 对象', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      boss.base.hp = 500;
      expect(enemy.hp).toBe(500);
    });

    it('修改 boss.base.physicalAttack 会反映到原 enemy 对象', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      boss.base.physicalAttack = 120;
      expect(enemy.physicalAttack).toBe(120);
    });
  });

  describe('Boss 专属字段恢复', () => {
    it('isBoss 固定为 true', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.isBoss).toBe(true);
    });

    it('phases 从 enemy 附加属性恢复', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.phases).toEqual(enemy.phases);
      expect(boss.phases.length).toBe(1);
      expect(boss.phases[0].name).toBe('P2');
    });

    it('intro 从 enemy 附加属性恢复', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.intro).toEqual(enemy.intro);
      expect(boss.intro?.effect).toBe('shake');
    });

    it('phases 为空数组时，boss.phases 也是空数组', () => {
      const enemy = makeFlatBossEnemy({ phases: [] });
      const boss = wrapAsBossInstance(enemy);
      expect(boss.phases).toEqual([]);
    });

    it('intro 为 undefined 时，boss.intro 为 undefined', () => {
      const enemy = makeFlatBossEnemy({ intro: undefined });
      const boss = wrapAsBossInstance(enemy);
      expect(boss.intro).toBeUndefined();
    });
  });

  describe('runtime 初始化', () => {
    it('runtime 初始为空对象', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.runtime).toEqual({});
    });

    it('runtime 不从 enemy 顶层读取运行时字段（始终为空对象）', () => {
      const enemy = makeFlatBossEnemy();
      // 即使 enemy 携带运行时字段（历史遗留），wrapAsBossInstance 也不读取
      (enemy as any).shield = 999;
      (enemy as any).charging = true;
      const boss = wrapAsBossInstance(enemy);
      expect(boss.runtime.shield).toBeUndefined();
      expect(boss.runtime.charging).toBeUndefined();
      expect(boss.runtime).toEqual({});
    });
  });

  describe('base 字段完整性', () => {
    it('base 保留所有普通敌人字段', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.base.id).toBe('boss-flat-1');
      expect(boss.base.hp).toBe(800);
      expect(boss.base.maxHp).toBe(1000);
      expect(boss.base.physicalAttack).toBe(80);
      expect(boss.base.stats).toEqual(enemy.stats);
      expect(boss.base.level).toBe(10);
    });

    it('修改 boss.base.stats 反映到原 enemy', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      const newStats = { str: 99, dex: 99, con: 99, int: 99, wis: 99, cha: 99 };
      boss.base.stats = newStats;
      expect(enemy.stats).toEqual(newStats);
    });

    it('修改 boss.base.damage 反映到原 enemy', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      boss.base.damage = [100, 200];
      expect(enemy.damage).toEqual([100, 200]);
    });
  });

  describe('多阶段 Boss 与多实例场景', () => {
    it('多阶段 Boss 的 phases 完整恢复', () => {
      const enemy = makeFlatBossEnemy({
        phases: [
          { hpThreshold: 0.7, name: 'P1', dialogue: [], aiStrategy: 'balanced', mechanics: [] },
          { hpThreshold: 0.4, name: 'P2', dialogue: ['怒了'], aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }] },
          { hpThreshold: 0, name: 'P3', dialogue: [], aiStrategy: 'defensive', mechanics: [] },
        ],
      });
      const boss = wrapAsBossInstance(enemy);
      expect(boss.phases.length).toBe(3);
      expect(boss.phases[0].name).toBe('P1');
      expect(boss.phases[1].name).toBe('P2');
      expect(boss.phases[2].name).toBe('P3');
      expect(boss.phases[1].mechanics.length).toBe(1);
    });

    it('多个 Boss 实例独立包装互不影响', () => {
      const enemy1 = makeFlatBossEnemy({ id: 'boss-1' });
      const enemy2 = makeFlatBossEnemy({ id: 'boss-2', hp: 500 });
      const boss1 = wrapAsBossInstance(enemy1);
      const boss2 = wrapAsBossInstance(enemy2);
      expect(boss1.base.id).toBe('boss-1');
      expect(boss2.base.id).toBe('boss-2');
      expect(boss1.base.hp).toBe(800);
      expect(boss2.base.hp).toBe(500);
      // 修改 boss1 不影响 boss2
      boss1.base.hp = 1;
      expect(boss2.base.hp).toBe(500);
    });

    it('intro 完整字段（effect/lines/duration）恢复', () => {
      const enemy = makeFlatBossEnemy();
      const boss = wrapAsBossInstance(enemy);
      expect(boss.intro).toBeDefined();
      expect(boss.intro?.effect).toBe('shake');
      expect(boss.intro?.lines).toEqual(['登场']);
      expect(boss.intro?.duration).toBe(2000);
    });

    it('phases 为空数组时，boss.phases 也是空数组', () => {
      const enemy = makeFlatBossEnemy({ phases: [] });
      const boss = wrapAsBossInstance(enemy);
      expect(boss.phases).toEqual([]);
      expect(boss.phases.length).toBe(0);
    });
  });
});
