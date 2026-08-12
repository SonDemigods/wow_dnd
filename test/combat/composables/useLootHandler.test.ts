/**
 * @fileoverview useLootHandler Composable 单元测试（QA-9）
 *
 * 直接测试 useLootHandler（不通过 usePlayerAction 编排），覆盖：
 *   - 无 drops 时无操作
 *   - drops 成功掉落时调用 addItem 并记录冒险日志
 *   - dropRate=0 时不触发掉落
 *   - amount<=0 时跳过
 *   - addItem 返回值小于 amount 时发射 INVENTORY_FULL 事件
 *   - getItemInfo 返回 null 时不调用 addItem
 *   - 多个 drops 逐个处理
 *   - DB-4：注入确定性 RNG 可复现掉落结果
 *   - itemInfo.name 为空时回退到 itemId
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLootHandler } from '@/modules/combat/composables/useLootHandler';
import type { ICombatContext } from '@/modules/combat/combatContext';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { Rng } from '@/utils/rng';

// ==================== Mock 模块 ====================

const characterMock = {
  name: '英雄', hp: 100, maxHp: 100,
  attributes: { critChance: 0, dodgeChance: 0 } as never,
  effectiveStats: { dex: 10 } as never,
  takeDamage: vi.fn(),
  gainExp: vi.fn(), gainGold: vi.fn(), handleDeath: vi.fn(),
  receiveHeal: vi.fn(), changeMp: vi.fn(),
};
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: vi.fn(() => characterMock),
}));

const enemyStoreMock = {
  getEnemyById: vi.fn(() => null),
  takeDamage: vi.fn(() => false),
};
vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: vi.fn(() => enemyStoreMock),
}));

const inventoryStoreMock = {
  getItemInfo: vi.fn(() => null),
  useItem: vi.fn().mockResolvedValue(undefined),
  addItem: vi.fn(),
};
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: vi.fn(() => inventoryStoreMock),
}));

const logStoreMock = { addLogEntry: vi.fn() };
vi.mock('@/modules/log/store', () => ({
  useLogStore: vi.fn(() => logStoreMock),
}));

vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log-id'),
}));

// mock eventBus（vi.hoisted 避免 vi.mock 提升导致的 ReferenceError）
const eventBusEmitMock = vi.hoisted(() => vi.fn());
vi.mock('@/modules/bus', () => ({
  eventBus: { emit: eventBusEmitMock },
  GameEvents: {
    COMBAT_DEAL_DAMAGE: 'combat:deal-damage',
    COMBAT_CRITICAL_HIT: 'combat:critical-hit',
    COMBAT_DODGE: 'combat:dodge',
    COMBAT_CAST_HEAL: 'combat:cast-heal',
    INVENTORY_FULL: 'inventory_full',
  },
}));

// ==================== 测试数据构造 helper ====================

function makeEnemy(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'e1',
    dataId: 'slime',
    name: '史莱姆',
    icon: 'icon',
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

function makeLogMock() {
  return {
    addCombatLog: vi.fn(),
    saveLogs: vi.fn().mockResolvedValue(undefined),
    createPlayerEffectContext: vi.fn(),
    createEnemyEffectContext: vi.fn(),
  } as never;
}

function makeMockCtx(): ICombatContext {
  return {
    character: {
      get name() { return characterMock.name; },
      get classId() { return 'warrior' as never; },
      get hp() { return characterMock.hp; },
      get maxHp() { return characterMock.maxHp; },
      get attributes() { return characterMock.attributes; },
      get effectiveStats() { return characterMock.effectiveStats; },
      takeDamage: characterMock.takeDamage,
      gainExp: characterMock.gainExp,
      gainGold: characterMock.gainGold,
      handleDeath: characterMock.handleDeath,
      receiveHeal: characterMock.receiveHeal,
      changeMp: characterMock.changeMp,
    },
    skill: {
      getSkill: vi.fn(), castSkill: vi.fn(),
      tickCooldowns: vi.fn(), resetCooldowns: vi.fn(),
    },
    enemy: {
      getEnemyById: enemyStoreMock.getEnemyById,
      takeDamage: enemyStoreMock.takeDamage,
      deleteEnemy: vi.fn(), createEnemy: vi.fn(),
      getAvailableSkills: vi.fn(), useSkill: vi.fn(),
      calculateDamage: vi.fn(), tickCooldowns: vi.fn(),
    },
    quest: { onEnemyKilled: vi.fn() },
    log: { addLogEntry: logStoreMock.addLogEntry },
    inventory: {
      getItemInfo: inventoryStoreMock.getItemInfo,
      useItem: inventoryStoreMock.useItem,
      addItem: inventoryStoreMock.addItem,
    },
    talent: { damageMultiplier: 0, damageReduction: 0, resourceBonuses: {}, skillEnhancements: [], unlockedPets: [] },
    form: { damageMultiplier: 1, defenseMultiplier: 1, speedMultiplier: 1 },
  } as unknown as ICombatContext;
}

/** 构造确定性 Rng mock */
function makeRngMock(opts: { boolResult?: boolean; intResult?: number } = {}): Rng {
  return {
    bool: vi.fn(() => opts.boolResult ?? true),
    int: vi.fn(() => opts.intResult ?? 1),
    float: vi.fn(() => 0),
    pick: vi.fn(),
  } as unknown as Rng;
}

// ==================== 测试用例 ====================

describe('useLootHandler - 战利品处理 Composable（QA-9）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inventoryStoreMock.getItemInfo.mockReturnValue(null);
    inventoryStoreMock.addItem.mockReturnValue(0);
  });

  it('返回包含 handleLoot 方法的对象', () => {
    const loot = useLootHandler(makeLogMock(), makeMockCtx());
    expect(typeof loot.handleLoot).toBe('function');
  });

  describe('掉落判定', () => {
    it('无 drops 时无操作', () => {
      const enemy = makeEnemy();
      // 不设置 drops

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
      expect(logStoreMock.addLogEntry).not.toHaveBeenCalled();
    });

    it('drops 成功掉落时调用 addItem 并记录冒险日志', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 2, maxAmount: 2 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '药水' });
      inventoryStoreMock.addItem.mockReturnValue(2);

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy);

      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item1', 2);
      expect(logStoreMock.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: expect.stringContaining('药水'),
      }));
    });

    it('dropRate=0 时不触发掉落', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 0, minAmount: 2, maxAmount: 2 }],
      } as Partial<EnemyInstance>);
      const rng = makeRngMock({ boolResult: false });

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy, rng);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
    });

    it('amount<=0 时跳过不掉落', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 0, maxAmount: 0 }],
      } as Partial<EnemyInstance>);
      const rng = makeRngMock({ boolResult: true, intResult: 0 });

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy, rng);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
    });

    it('getItemInfo 返回 null 时不调用 addItem', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 2, maxAmount: 2 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue(null);

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
    });
  });

  describe('背包满与多掉落', () => {
    it('addItem 返回值小于 amount 时发射 INVENTORY_FULL 事件', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 5, maxAmount: 5 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '材料' });
      inventoryStoreMock.addItem.mockReturnValue(3);

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy);

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'inventory_full',
        expect.objectContaining({
          itemName: '材料',
          actualAmount: 3,
          expectedAmount: 5,
        }),
      );
    });

    it('多个 drops 逐个处理', () => {
      const enemy = makeEnemy({
        drops: [
          { itemId: 'item1', dropRate: 1, minAmount: 1, maxAmount: 1 },
          { itemId: 'item2', dropRate: 1, minAmount: 2, maxAmount: 2 },
        ],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '物品' });
      inventoryStoreMock.addItem.mockReturnValue(99);

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy);

      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item1', 1);
      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item2', 2);
    });
  });

  describe('名称回退', () => {
    it('itemInfo.name 为空时冒险日志回退到 itemId', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'mat1', dropRate: 1, minAmount: 1, maxAmount: 1 }],
      } as Partial<EnemyInstance>);
      // itemInfo 存在但 name 为空字符串（falsy）
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '' });
      inventoryStoreMock.addItem.mockReturnValue(1);

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy);

      expect(logStoreMock.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: expect.stringContaining('mat1'),
      }));
    });
  });

  describe('DB-4：RNG 注入', () => {
    it('未注入 RNG 时使用 defaultRng（不抛错）', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 1, maxAmount: 1 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '物品' });
      inventoryStoreMock.addItem.mockReturnValue(1);

      // 不传 rng 参数，应使用默认 defaultRng
      expect(() => useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy)).not.toThrow();
    });

    it('注入确定性 RNG 可控制掉落判定结果', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 0.5, minAmount: 2, maxAmount: 5 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '物品' });
      inventoryStoreMock.addItem.mockReturnValue(99);

      // RNG 返回 true（掉落）+ 固定 int=3（minAmount=2, span=3, int(2,5) 返回 3）
      const rng = makeRngMock({ boolResult: true, intResult: 3 });

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy, rng);

      // rng.bool 被调用，入参为 dropRate=0.5
      expect(rng.bool).toHaveBeenCalledWith(0.5);
      // rng.int 被调用，入参为 (minAmount, minAmount + span) = (2, 5)
      expect(rng.int).toHaveBeenCalledWith(2, 5);
      // addItem 入参为 intResult=3
      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item1', 3);
    });

    it('注入 RNG 返回 false 时不掉落', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 0.5, minAmount: 1, maxAmount: 1 }],
      } as Partial<EnemyInstance>);
      const rng = makeRngMock({ boolResult: false });

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy, rng);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
      expect(rng.int).not.toHaveBeenCalled();
    });

    it('maxAmount < minAmount 时 span 归零防止负数掉落（P2-4）', () => {
      const enemy = makeEnemy({
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 5, maxAmount: 3 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '物品' });
      inventoryStoreMock.addItem.mockReturnValue(99);
      const rng = makeRngMock({ boolResult: true, intResult: 5 });

      useLootHandler(makeLogMock(), makeMockCtx()).handleLoot(enemy, rng);

      // span = max(0, 3-5) = 0，int 入参为 (5, 5+0) = (5, 5)
      expect(rng.int).toHaveBeenCalledWith(5, 5);
    });
  });
});
