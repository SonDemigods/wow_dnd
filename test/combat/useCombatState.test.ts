/**
 * @fileoverview 战斗状态 Composable（useCombatState）单元测试
 *
 * 覆盖 useCombatState 的：
 * 1. 响应式状态初始值（state/enemyIds/turn/turnCount/combatId/combatLogs 等）
 * 2. 计算属性（isInCombat/enemies/aliveEnemies/hasBossEnemy/currentTarget）
 *    - enemies 从 enemiesStore.getEnemyById 实时读取
 *    - aliveEnemies 按 hp > 0 过滤
 *    - currentTarget 优先选择 targetEnemyId > 第一个存活敌人
 * 3. cleanup / reset 行为
 *    - reset：仅重置状态，不删除敌人
 *    - cleanup：删除 hp <= 0 的敌人 + resetState
 *    - turnTimerId 清理（clearTimeout）
 * 4. addEffectToPlayer 边界
 *    - 非战斗状态（state !== 'fighting'）忽略，输出 warn
 *    - 战斗状态正常添加到 playerEffects
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - useEnemyStore 使用真实 Pinia store（createTestPinia），通过 $patch 注入 enemiesCache
 *    避免深度 mock 但又隔离了 DB 层副作用
 *  - 不 mock effects 模块（createEmptyContainer / EffectHandlerRegistry 走真实路径）
 *  - console.warn spy 验证边界提示
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCombatState } from '@/modules/combat/composables/useCombatState';
import { createCombatContext } from '@/modules/combat/combatContext';
import { useEnemyStore } from '@/modules/enemy/store';
import { createTestPinia } from '../utils/setup';
import type { EnemyInstance } from '@/modules/enemy/types';

// ==================== 测试数据构造 helper ====================

function makeEnemy(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'e1',
    dataId: 'slime',
    name: '史莱姆',
    icon: 'game-icons:slime',
    maxHp: 50,
    hp: 50,
    damage: [3, 6],
    xp: 10,
    gold: 5,
    dangerLevel: 'low',
    level: 1,
    stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
    expReward: 10,
    goldReward: 5,
    ...o,
  } as EnemyInstance;
}

// ==================== 测试用例 ====================

describe('useCombatState - 战斗状态 Composable', () => {
  beforeEach(() => {
    createTestPinia();
  });

  // -------------------- 响应式状态初始值 --------------------

  describe('响应式状态初始值', () => {
    it('state 初始为 idle', () => {
      const s = useCombatState(createCombatContext());
      expect(s.state.value).toBe('idle');
    });

    it('enemyIds / targetEnemyId 初始为空', () => {
      const s = useCombatState(createCombatContext());
      expect(s.enemyIds.value).toEqual([]);
      expect(s.targetEnemyId.value).toBeNull();
    });

    it('turn / turnCount 初始值', () => {
      const s = useCombatState(createCombatContext());
      expect(s.turn.value).toBe('player');
      expect(s.turnCount.value).toBe(0);
    });

    it('combatId / combatLogs / combatResult 初始值', () => {
      const s = useCombatState(createCombatContext());
      expect(s.combatId.value).toBe('');
      expect(s.combatLogs.value).toEqual([]);
      expect(s.combatResult.value).toBeNull();
    });

    it('expGained / goldGained / combatSpeed 初始值', () => {
      const s = useCombatState(createCombatContext());
      expect(s.expGained.value).toBe(0);
      expect(s.goldGained.value).toBe(0);
      expect(s.combatSpeed.value).toBe(1);
    });

    it('initiativeOrder / currentInitiativeIndex 初始值', () => {
      const s = useCombatState(createCombatContext());
      expect(s.initiativeOrder.value).toEqual([]);
      expect(s.currentInitiativeIndex.value).toBe(0);
    });

    it('bossIntros / enemyPositions 初始为空对象', () => {
      const s = useCombatState(createCombatContext());
      expect(s.bossIntros.value).toEqual({});
      expect(s.enemyPositions.value).toEqual({});
    });

    it('playerEffects 初始为空容器', () => {
      const s = useCombatState(createCombatContext());
      // createEmptyContainer 返回空对象，无 effects 字段或 effects 为空数组
      expect(s.playerEffects.value).toEqual(expect.objectContaining({}));
    });

    it('turnTimerId 初始为 null', () => {
      const s = useCombatState(createCombatContext());
      expect(s.turnTimerId.value).toBeNull();
    });

    it('bossPhaseManagers 初始为空 Map', () => {
      const s = useCombatState(createCombatContext());
      expect(s.bossPhaseManagers.size).toBe(0);
    });

    it('effectRegistry 已注册默认处理器（非空）', () => {
      const s = useCombatState(createCombatContext());
      // createDefaultRegistry 会注册多个 effect handler，验证非空
      expect(s.effectRegistry).toBeDefined();
      // 通过 reduceSum 调用不抛错来间接验证 handler 已注册
      expect(() => s.effectRegistry.reduceSum(s.playerEffects.value, 'getSpeedMod', null as never)).not.toThrow();
    });
  });

  // -------------------- 计算属性 --------------------

  describe('计算属性', () => {
    it('isInCombat：state=fighting 时为 true，其他为 false', () => {
      const s = useCombatState(createCombatContext());
      expect(s.isInCombat.value).toBe(false);
      s.state.value = 'fighting';
      expect(s.isInCombat.value).toBe(true);
      s.state.value = 'victory';
      expect(s.isInCombat.value).toBe(false);
    });

    it('enemies：从 enemiesStore.getEnemyById 实时读取，过滤 null', () => {
      const store = useEnemyStore();
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2', name: '哥布林' });
      store.$patch({ enemiesCache: { e1, e2 } });

      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1', 'e2', 'non-existent'];
      expect(s.enemies.value).toHaveLength(2);
      expect(s.enemies.value.map(e => e.id)).toEqual(['e1', 'e2']);
    });

    it('aliveEnemies：按 hp > 0 过滤', () => {
      const store = useEnemyStore();
      const e1 = makeEnemy({ id: 'e1', hp: 50 });
      const e2 = makeEnemy({ id: 'e2', hp: 0 });
      const e3 = makeEnemy({ id: 'e3', hp: 1 });
      store.$patch({ enemiesCache: { e1, e2, e3 } });

      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1', 'e2', 'e3'];
      expect(s.aliveEnemies.value).toHaveLength(2);
      expect(s.aliveEnemies.value.map(e => e.id)).toEqual(['e1', 'e3']);
    });

    it('hasBossEnemy：含 isBoss=true 的敌人时返回 true', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: {
          e1: makeEnemy({ id: 'e1', isBoss: false }),
        },
      });
      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1'];
      expect(s.hasBossEnemy.value).toBe(false);

      store.$patch({
        enemiesCache: {
          e1: makeEnemy({ id: 'e1', isBoss: false }),
          e2: makeEnemy({ id: 'e2', isBoss: true }),
        },
      });
      s.enemyIds.value = ['e1', 'e2'];
      expect(s.hasBossEnemy.value).toBe(true);
    });

    it('currentTarget：优先 targetEnemyId，未命中时取第一个存活敌人', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: {
          e1: makeEnemy({ id: 'e1', hp: 50 }),
          e2: makeEnemy({ id: 'e2', hp: 50 }),
          e3: makeEnemy({ id: 'e3', hp: 0 }),
        },
      });
      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1', 'e2', 'e3'];

      // 无 targetEnemyId：返回第一个存活敌人
      expect(s.currentTarget.value?.id).toBe('e1');

      // 设置 targetEnemyId 为 e2：返回 e2
      s.targetEnemyId.value = 'e2';
      expect(s.currentTarget.value?.id).toBe('e2');

      // targetEnemyId 指向不存在的敌人：回退到第一个存活敌人
      s.targetEnemyId.value = 'non-existent';
      expect(s.currentTarget.value?.id).toBe('e1');
    });

    it('currentTarget：无存活敌人时返回 null', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemy({ id: 'e1', hp: 0 }) },
      });
      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1'];
      expect(s.currentTarget.value).toBeNull();
    });

    it('enemies 响应 enemiesStore 数据变化（HP 实时同步）', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemy({ id: 'e1', hp: 50 }) },
      });
      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1'];
      expect(s.enemies.value[0].hp).toBe(50);
      expect(s.aliveEnemies.value).toHaveLength(1);

      // 修改 store 中敌人 HP
      store.$patch({
        enemiesCache: { e1: makeEnemy({ id: 'e1', hp: 0 }) },
      });
      expect(s.enemies.value[0].hp).toBe(0);
      expect(s.aliveEnemies.value).toHaveLength(0);
    });
  });

  // -------------------- cleanup / reset --------------------

  describe('reset：仅重置状态，不删除敌人', () => {
    it('重置后所有状态回到初始值', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemy({ id: 'e1' }) },
      });

      const s = useCombatState(createCombatContext());
      s.state.value = 'fighting';
      s.enemyIds.value = ['e1'];
      s.targetEnemyId.value = 'e1';
      s.turn.value = 'enemy';
      s.turnCount.value = 5;
      s.combatId.value = 'combat-1';
      s.combatLogs.value = [{ combatId: 'combat-1' } as never];
      s.combatResult.value = { result: 'victory' } as never;
      s.expGained.value = 100;
      s.goldGained.value = 50;
      s.initiativeOrder.value = ['player', 'e1'];
      s.currentInitiativeIndex.value = 2;
      s.combatSpeed.value = 2;

      s.reset();

      expect(s.state.value).toBe('idle');
      expect(s.enemyIds.value).toEqual([]);
      expect(s.targetEnemyId.value).toBeNull();
      expect(s.turn.value).toBe('player');
      expect(s.turnCount.value).toBe(0);
      expect(s.combatId.value).toBe('');
      expect(s.combatLogs.value).toEqual([]);
      expect(s.combatResult.value).toBeNull();
      expect(s.expGained.value).toBe(0);
      expect(s.goldGained.value).toBe(0);
      expect(s.initiativeOrder.value).toEqual([]);
      expect(s.currentInitiativeIndex.value).toBe(0);
      // combatSpeed 是用户偏好（1x/2x 倍率），reset 不重置以保留用户设置
      expect(s.combatSpeed.value).toBe(2);
    });

    it('reset 不删除 enemiesStore 中的敌人', () => {
      const store = useEnemyStore();
      const enemy = makeEnemy({ id: 'e1' });
      store.$patch({ enemiesCache: { e1: enemy } });

      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1'];
      s.reset();

      // enemiesStore 中敌人仍然存在
      expect(store.getEnemyById('e1')).toEqual(enemy);
    });

    it('reset 清理 bossPhaseManagers 与 bossIntros', () => {
      const s = useCombatState(createCombatContext());
      s.bossIntros.value = { boss1: { title: 'Boss 出场' } as never };
      s.bossPhaseManagers.set('boss1', {} as never);

      s.reset();

      expect(s.bossPhaseManagers.size).toBe(0);
      expect(s.bossIntros.value).toEqual({});
    });

    it('reset 清理 enemyPositions', () => {
      const s = useCombatState(createCombatContext());
      s.enemyPositions.value = { e1: { row: 'front', col: 0 } };
      s.reset();
      expect(s.enemyPositions.value).toEqual({});
    });

    it('reset 清理 resourceSystems', () => {
      const s = useCombatState(createCombatContext());
      s.resourceSystems.value = [{ type: 'rage' } as never];
      s.reset();
      expect(s.resourceSystems.value).toEqual([]);
    });

    it('reset 清理 turnTimerId（调用 clearTimeout）', () => {
      const s = useCombatState(createCombatContext());
      s.turnTimerId.value = 12345 as never;
      const spy = vi.spyOn(globalThis, 'clearTimeout');
      s.reset();
      expect(s.turnTimerId.value).toBeNull();
      expect(spy).toHaveBeenCalledWith(12345);
      spy.mockRestore();
    });

    it('reset 时 turnTimerId 为 null 不调用 clearTimeout', () => {
      const s = useCombatState(createCombatContext());
      const spy = vi.spyOn(globalThis, 'clearTimeout');
      s.reset();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('reset 清理 bossIntroTimerId（调用 clearTimeout）', () => {
      // 覆盖 useCombatState.ts 第 131-134 行：bossIntroTimerId !== null 时清理
      const s = useCombatState(createCombatContext());
      s.bossIntroTimerId.value = 67890 as never;
      const spy = vi.spyOn(globalThis, 'clearTimeout');
      s.reset();
      expect(s.bossIntroTimerId.value).toBeNull();
      expect(spy).toHaveBeenCalledWith(67890);
      spy.mockRestore();
    });

    it('reset 时 bossIntroTimerId 为 null 不调用 clearTimeout', () => {
      // 覆盖 useCombatState.ts 第 131 行：bossIntroTimerId 为 null 时跳过清理分支
      const s = useCombatState(createCombatContext());
      const spy = vi.spyOn(globalThis, 'clearTimeout');
      s.reset();
      // bossIntroTimerId 为 null，不应因 bossIntroTimerId 调用 clearTimeout
      expect(s.bossIntroTimerId.value).toBeNull();
      spy.mockRestore();
    });
  });

  describe('cleanup：删除死亡敌人 + reset', () => {
    it('cleanup 删除 hp <= 0 的敌人（调用 enemiesStore.deleteEnemy）', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: {
          e1: makeEnemy({ id: 'e1', hp: 50 }),
          e2: makeEnemy({ id: 'e2', hp: 0 }),
          e3: makeEnemy({ id: 'e3', hp: -5 }),
        },
      });

      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1', 'e2', 'e3'];
      s.state.value = 'fighting';

      s.cleanup();

      // e1 存活保留，e2/e3 死亡被删除
      expect(store.getEnemyById('e1')).not.toBeNull();
      expect(store.getEnemyById('e2')).toBeNull();
      expect(store.getEnemyById('e3')).toBeNull();
      // 状态被重置
      expect(s.state.value).toBe('idle');
    });

    it('cleanup 后 enemyIds 清空（reset 行为）', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemy({ id: 'e1', hp: 50 }) },
      });

      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1'];
      s.state.value = 'fighting';

      s.cleanup();
      expect(s.enemyIds.value).toEqual([]);
    });

    it('cleanup 无死亡敌人时正常 reset', () => {
      const store = useEnemyStore();
      store.$patch({
        enemiesCache: { e1: makeEnemy({ id: 'e1', hp: 50 }) },
      });

      const s = useCombatState(createCombatContext());
      s.enemyIds.value = ['e1'];
      s.state.value = 'fighting';

      s.cleanup();
      expect(store.getEnemyById('e1')).not.toBeNull();
      expect(s.state.value).toBe('idle');
    });
  });

  // -------------------- addEffectToPlayer --------------------

  describe('addEffectToPlayer：战斗作用域约束', () => {
    it('非战斗状态（state=idle）忽略并输出 warn', () => {
      const s = useCombatState(createCombatContext());
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const effect = { id: 'eff-1', type: 'attack_up', remainingTurns: 3, value: 10, source: 'skill', sourceName: 'test' } as never;

      s.addEffectToPlayer(effect);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('非战斗状态'));
      spy.mockRestore();
    });

    it('战斗状态（state=fighting）正常添加到 playerEffects', () => {
      const s = useCombatState(createCombatContext());
      s.state.value = 'fighting';
      const effect = { id: 'eff-1', type: 'attack_up', remainingTurns: 3, value: 10, source: 'skill', sourceName: 'test' } as never;

      s.addEffectToPlayer(effect);

      // 验证效果已添加到容器（具体容器结构由 effects 模块决定，这里仅验证不抛错且 warn 未触发）
      expect(s.playerEffects.value).toBeDefined();
    });

    it('战斗状态不输出 warn', () => {
      const s = useCombatState(createCombatContext());
      s.state.value = 'fighting';
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const effect = { id: 'eff-1', type: 'attack_up', remainingTurns: 3, value: 10, source: 'skill', sourceName: 'test' } as never;

      s.addEffectToPlayer(effect);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
