/**
 * @fileoverview 敌人模块 Pinia Store 单元测试
 *
 * 覆盖 useEnemyStore 的：
 * 1. State 初始值（activeEnemyIds/enemiesCache 为空、enemies/enemiesCount 派生为空/0）
 * 2. Actions：
 *    - createEnemy（普通表命中 / 回退 Boss 表 / 均未命中返回 null）
 *    - takeDamage（扣血 / 致死 / 不存在敌人 / hp 下限 clamp 0）
 *    - getEnemyById（命中 / 未命中）
 *    - tickCooldowns（指定敌人递减 / 全量递减 / 归零移除）
 *    - getCooldownRemaining / getAvailableSkills / useSkill / calculateDamage / deleteEnemy / clearAll
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - enemyDbService / bossDbService 全量 mock，避免触碰真实 IndexedDB。
 *  - enemy/service 的 createEnemyInstance / calculateEnemyDamage 与 boss/service 的 createBossInstance 全量 mock。
 *  - skillsStore 通过 vi.hoisted 共享 getSkill spy（store 内部 useSkillStore() 获取实例）。
 *  - skillCooldowns 为 store 内部状态未导出，通过 useSkill 写入 + getCooldownRemaining 读取间接验证。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import type { EnemyInstance, EnemyData } from '@/modules/enemy/types';
import type { Skill } from '@/modules/skill/types';
import type { Stats } from '@/modules/character/types';

/** mock 普通怪物 DB 层 */
vi.mock('@/modules/enemy/db', () => ({
  enemyDbService: {
    getEnemyTemplate: vi.fn(),
  },
}));

/** mock Boss DB 层（createEnemy 回退查找） */
vi.mock('@/modules/boss/db', () => ({
  bossDbService: {
    getBossTemplate: vi.fn(),
  },
}));

/** mock enemy service 纯函数 */
vi.mock('@/modules/enemy/service', () => ({
  createEnemyInstance: vi.fn(),
  calculateEnemyDamage: vi.fn(),
}));

/** mock boss service 的 createBossInstance */
vi.mock('@/modules/boss/service', () => ({
  createBossInstance: vi.fn(),
}));

/** 通过 vi.hoisted 共享 skillsStore.getSkill spy */
const skillStoreMocks = vi.hoisted(() => ({
  getSkill: vi.fn(),
}));
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: vi.fn(() => ({ getSkill: skillStoreMocks.getSkill })),
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { enemyDbService } from '@/modules/enemy/db';
import { bossDbService } from '@/modules/boss/db';
import { createEnemyInstance, calculateEnemyDamage } from '@/modules/enemy/service';
import { createBossInstance } from '@/modules/boss/service';
import { useEnemyStore } from '@/modules/enemy/store';

// ==================== 测试数据构造 helper ====================

function makeStats(o: Partial<Stats> = {}): Stats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...o };
}

function makeEnemyInstance(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'enemy-1',
    dataId: 'mob-1',
    name: '哥布林',
    icon: 'game-icons:goblin',
    maxHp: 100,
    hp: 100,
    damage: [5, 10],
    xp: 20,
    gold: 10,
    dangerLevel: '普通',
    level: 1,
    stats: makeStats(),
    expReward: 20,
    goldReward: 10,
    physicalAttack: 12,
    physicalDefense: 4,
    magicAttack: 5,
    magicDefense: 3,
    ...o,
  } as EnemyInstance;
}

function makeEnemyTemplate(o: Partial<EnemyData> = {}): EnemyData {
  return {
    id: 'mob-1',
    name: '哥布林',
    icon: 'game-icons:goblin',
    maxHp: 100,
    damage: [5, 10],
    xp: 20,
    gold: 10,
    dangerLevel: '普通',
    ...o,
  } as EnemyData;
}

function makeSkill(o: Partial<Skill> = {}): Skill {
  return {
    id: 'sk-1',
    name: '猛击',
    icon: 'i',
    description: 'd',
    mpCost: 0,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 5, coefficient: 1 },
    unlockLevel: 1,
    ...o,
  } as Skill;
}

// ==================== 测试用例 ====================

describe('useEnemyStore - 敌人 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('activeEnemyIds 初始为空数组', () => {
      const store = useEnemyStore();
      expect(store.activeEnemyIds).toEqual([]);
    });

    it('enemiesCache 初始为空对象', () => {
      const store = useEnemyStore();
      expect(store.enemiesCache).toEqual({});
    });

    it('enemies/enemiesCount 初始为空数组/0', () => {
      const store = useEnemyStore();
      expect(store.enemies).toEqual([]);
      expect(store.enemiesCount).toBe(0);
    });
  });

  // -------------------- Action: createEnemy --------------------
  describe('Action: createEnemy', () => {
    it('普通怪物表命中：调用 createEnemyInstance、加入缓存与活跃列表、返回实例', async () => {
      const template = makeEnemyTemplate();
      const enemy = makeEnemyInstance({ id: 'enemy-x' });
      vi.mocked(enemyDbService.getEnemyTemplate).mockResolvedValueOnce(template);
      vi.mocked(createEnemyInstance).mockReturnValueOnce(enemy);

      const store = useEnemyStore();
      const result = await store.createEnemy('mob-1', 3);

      expect(enemyDbService.getEnemyTemplate).toHaveBeenCalledWith('mob-1');
      expect(createEnemyInstance).toHaveBeenCalledWith(template, 3);
      expect(bossDbService.getBossTemplate).not.toHaveBeenCalled();
      expect(result).toEqual(enemy);
      expect(store.activeEnemyIds).toContain('enemy-x');
      expect(store.enemiesCache['enemy-x']).toEqual(enemy);
    });

    it('普通表未命中时回退 Boss 表：调用 createBossInstance 并加入缓存', async () => {
      vi.mocked(enemyDbService.getEnemyTemplate).mockResolvedValueOnce(null);
      const bossTemplate = { ...makeEnemyTemplate(), isBoss: true as const };
      vi.mocked(bossDbService.getBossTemplate).mockResolvedValueOnce(bossTemplate);
      const boss = makeEnemyInstance({ id: 'boss-x', isBoss: true });
      vi.mocked(createBossInstance).mockReturnValueOnce(boss);

      const store = useEnemyStore();
      const result = await store.createEnemy('boss-1', 5);

      expect(bossDbService.getBossTemplate).toHaveBeenCalledWith('boss-1');
      expect(createBossInstance).toHaveBeenCalledWith(bossTemplate, 5);
      expect(result).toEqual(boss);
      expect(store.enemiesCache['boss-x']).toEqual(boss);
    });

    it('普通表与 Boss 表均未命中时返回 null 且不写入缓存', async () => {
      vi.mocked(enemyDbService.getEnemyTemplate).mockResolvedValueOnce(null);
      vi.mocked(bossDbService.getBossTemplate).mockResolvedValueOnce(null);

      const store = useEnemyStore();
      const result = await store.createEnemy('not-exist', 1);

      expect(result).toBeNull();
      expect(store.activeEnemyIds).toEqual([]);
      expect(store.enemiesCache).toEqual({});
    });
  });

  // -------------------- Action: takeDamage --------------------
  describe('Action: takeDamage', () => {
    it('不存在的敌人返回 false', () => {
      const store = useEnemyStore();
      expect(store.takeDamage('no-id', 10)).toBe(false);
    });

    it('扣血未致死返回 false 并更新 hp', () => {
      const store = useEnemyStore();
      store.$patch({ enemiesCache: { 'e1': makeEnemyInstance({ id: 'e1', hp: 100 }) } });
      expect(store.takeDamage('e1', 30)).toBe(false);
      expect(store.enemiesCache['e1'].hp).toBe(70);
    });

    it('扣血致死返回 true 且 hp 为 0', () => {
      const store = useEnemyStore();
      store.$patch({ enemiesCache: { 'e1': makeEnemyInstance({ id: 'e1', hp: 20 }) } });
      expect(store.takeDamage('e1', 20)).toBe(true);
      expect(store.enemiesCache['e1'].hp).toBe(0);
    });

    it('伤害超过当前 hp 时 clamp 到 0 并返回 true', () => {
      const store = useEnemyStore();
      store.$patch({ enemiesCache: { 'e1': makeEnemyInstance({ id: 'e1', hp: 10 }) } });
      expect(store.takeDamage('e1', 999)).toBe(true);
      expect(store.enemiesCache['e1'].hp).toBe(0);
    });
  });

  // -------------------- Action: getEnemyById --------------------
  describe('Action: getEnemyById', () => {
    it('命中返回敌人实例', () => {
      const store = useEnemyStore();
      const enemy = makeEnemyInstance({ id: 'e1' });
      store.$patch({ enemiesCache: { e1: enemy } });
      expect(store.getEnemyById('e1')).toEqual(enemy);
    });

    it('未命中返回 null', () => {
      const store = useEnemyStore();
      expect(store.getEnemyById('no-id')).toBeNull();
    });
  });

  // -------------------- Action: tickCooldowns / getCooldownRemaining --------------------
  describe('Action: tickCooldowns / getCooldownRemaining', () => {
    it('无冷却时 getCooldownRemaining 返回 0', () => {
      const store = useEnemyStore();
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(0);
    });

    it('通过 useSkill 写入冷却后递减，归零后移除', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemyInstance({ id: 'e1', skillPool: ['sk-1'] }) },
      });
      skillStoreMocks.getSkill.mockReturnValue(makeSkill({ id: 'sk-1', cooldown: 2 }));

      store.useSkill('e1', 'sk-1');
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(2);

      store.tickCooldowns('e1');
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(1);

      store.tickCooldowns('e1');
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(0);
    });

    it('不传 enemyId 时推进所有敌人冷却', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: {
          e1: makeEnemyInstance({ id: 'e1', skillPool: ['sk-1'] }),
          e2: makeEnemyInstance({ id: 'e2', skillPool: ['sk-2'] }),
        },
      });
      skillStoreMocks.getSkill.mockImplementation((sid: string) => makeSkill({ id: sid, cooldown: 1 }));

      store.useSkill('e1', 'sk-1');
      store.useSkill('e2', 'sk-2');
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(1);
      expect(store.getCooldownRemaining('e2', 'sk-2')).toBe(1);

      store.tickCooldowns();
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(0);
      expect(store.getCooldownRemaining('e2', 'sk-2')).toBe(0);
    });
  });

  // -------------------- Action: useSkill --------------------
  describe('Action: useSkill', () => {
    it('敌人不存在时返回失败', () => {
      const store = useEnemyStore();
      const result = store.useSkill('no-id', 'sk-1');
      expect(result).toEqual({ success: false, damage: 0, isHeal: false });
    });

    it('技能不存在时返回失败', () => {
      const store = useEnemyStore();
      store.$patch({ enemiesCache: { e1: makeEnemyInstance({ id: 'e1' }) } });
      skillStoreMocks.getSkill.mockReturnValue(null);
      const result = store.useSkill('e1', 'sk-1');
      expect(result.success).toBe(false);
      expect(result.damage).toBe(0);
    });

    it('攻击技能：返回正伤害并记录冷却', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemyInstance({ id: 'e1', physicalAttack: 20, skillPool: ['sk-1'] }) },
      });
      skillStoreMocks.getSkill.mockReturnValue(
        makeSkill({ id: 'sk-1', type: 'physical_damage', cooldown: 2, effect: { type: 'physical_damage', value: 5, coefficient: 1 } })
      );

      const result = store.useSkill('e1', 'sk-1');
      expect(result.success).toBe(true);
      expect(result.isHeal).toBe(false);
      // baseDamage = round(20 * 1 + 5) = 25
      expect(result.damage).toBe(25);
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(2);
    });

    it('治疗技能：恢复 hp，damage 为负值', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemyInstance({ id: 'e1', hp: 30, maxHp: 100, magicAttack: 10, skillPool: ['sk-1'] }) },
      });
      skillStoreMocks.getSkill.mockReturnValue(
        makeSkill({ id: 'sk-1', type: 'health_restore', cooldown: 1, effect: { type: 'health_restore', value: 20, coefficient: 1 } })
      );

      const result = store.useSkill('e1', 'sk-1');
      expect(result.success).toBe(true);
      expect(result.isHeal).toBe(true);
      expect(result.damage).toBeLessThanOrEqual(0);
      expect(store.enemiesCache['e1'].hp).toBeGreaterThan(30);
    });

    it('buff 技能：返回 buffs 列表', () => {
      const store = useEnemyStore();
      store.$patch({ enemiesCache: { e1: makeEnemyInstance({ id: 'e1', skillPool: ['sk-1'] }) } });
      skillStoreMocks.getSkill.mockReturnValue(
        makeSkill({
          id: 'sk-1', type: 'buff', cooldown: 1,
          buffs: [{ type: 'attack_up' as never, value: 10, turns: 3 }],
        })
      );

      const result = store.useSkill('e1', 'sk-1');
      expect(result.success).toBe(true);
      expect(result.isBuff).toBe(true);
      expect(result.damage).toBe(0);
      expect(result.buffs).toEqual([{ type: 'attack_up', value: 10, turns: 3 }]);
    });
  });

  // -------------------- Action: getAvailableSkills --------------------
  describe('Action: getAvailableSkills', () => {
    it('无敌人或无 skillPool 时返回空数组', () => {
      const store = useEnemyStore();
      expect(store.getAvailableSkills('no-id')).toEqual([]);
      store.$patch({ enemiesCache: { e1: makeEnemyInstance({ id: 'e1', skillPool: [] }) } });
      expect(store.getAvailableSkills('e1')).toEqual([]);
    });

    it('过滤冷却中的技能并映射为简化结构', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemyInstance({ id: 'e1', skillPool: ['sk-1', 'sk-2'] }) },
      });
      skillStoreMocks.getSkill.mockImplementation((sid: string) => {
        if (sid === 'sk-1') return makeSkill({ id: 'sk-1', name: '攻击', type: 'physical_damage' });
        return makeSkill({ id: 'sk-2', name: '治疗', type: 'health_restore' });
      });
      // 先让 sk-1 进入冷却
      skillStoreMocks.getSkill.mockReturnValueOnce(makeSkill({ id: 'sk-1', name: '攻击', type: 'physical_damage', cooldown: 2 }));
      store.useSkill('e1', 'sk-1');

      const available = store.getAvailableSkills('e1');
      // sk-1 在冷却中应被过滤，仅剩 sk-2
      expect(available).toEqual([{ id: 'sk-2', name: '治疗', isHeal: true, isBuff: false }]);
    });
  });

  // -------------------- Action: calculateDamage --------------------
  describe('Action: calculateDamage', () => {
    it('委托 calculateEnemyDamage 纯函数', () => {
      vi.mocked(calculateEnemyDamage).mockReturnValue(42);
      const store = useEnemyStore();
      const enemy = makeEnemyInstance();
      expect(store.calculateDamage(enemy, 10)).toBe(42);
      expect(calculateEnemyDamage).toHaveBeenCalledWith(enemy, 10);
    });
  });

  // -------------------- Action: deleteEnemy --------------------
  describe('Action: deleteEnemy', () => {
    it('从活跃列表、缓存、冷却记录中移除敌人', () => {
      const store = useEnemyStore();
      store.$patch({
        activeEnemyIds: ['e1', 'e2'],
        enemiesCache: { e1: makeEnemyInstance({ id: 'e1' }), e2: makeEnemyInstance({ id: 'e2' }) },
      });
      // 给 e1 写入冷却
      skillStoreMocks.getSkill.mockReturnValue(makeSkill({ id: 'sk-1', cooldown: 2 }));
      store.$patch({ enemiesCache: { e1: makeEnemyInstance({ id: 'e1', skillPool: ['sk-1'] }), e2: makeEnemyInstance({ id: 'e2' }) } });
      store.useSkill('e1', 'sk-1');
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(2);

      store.deleteEnemy('e1');

      expect(store.activeEnemyIds).toEqual(['e2']);
      expect(store.getEnemyById('e1')).toBeNull();
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(0);
    });
  });

  // -------------------- Action: clearAll --------------------
  describe('Action: clearAll', () => {
    it('清空活跃列表、缓存与冷却记录', () => {
      const store = useEnemyStore();
      store.$patch({
        activeEnemyIds: ['e1', 'e2'],
        enemiesCache: {
          e1: makeEnemyInstance({ id: 'e1', skillPool: ['sk-1'] }),
          e2: makeEnemyInstance({ id: 'e2' }),
        },
      });
      skillStoreMocks.getSkill.mockReturnValue(makeSkill({ id: 'sk-1', cooldown: 3 }));
      store.useSkill('e1', 'sk-1');
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(3);

      store.clearAll();

      expect(store.activeEnemyIds).toEqual([]);
      expect(store.enemiesCache).toEqual({});
      expect(store.enemies).toEqual([]);
      expect(store.enemiesCount).toBe(0);
      expect(store.getCooldownRemaining('e1', 'sk-1')).toBe(0);
    });
  });
});
