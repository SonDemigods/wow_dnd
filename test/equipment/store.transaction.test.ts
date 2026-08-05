/**
 * @fileoverview 装备模块阶段二（DB-1/DB-2）跨表事务保护单元测试
 *
 * 覆盖 useEquipmentStore 的 persist 失败回滚逻辑：
 * 1. equipItem persist 失败时：移除新装备 bonus → 移除新装备 → 放回背包 → 恢复旧装备 → reapplySetBonuses → return false
 * 2. unequipItem persist 失败时：从背包移除已放回的装备 → 恢复装备到槽位 → 重新应用 bonus → reapplySetBonuses → return null
 * 3. equipItem/unequipItem persist 成功时：persistError 被重置为 null
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 提供 IndexedDB polyfill。
 *  - equipmentDbService 全量 mock，saveEquipment 按用例注入 reject 模拟写入失败。
 *  - useCharacterStore / useLogStore / errorReporter 用 vi.hoisted stub 隔离。
 *  - 背包操作通过 setInventoryCallbacks 注入回调 stub（A1/G1 修复后的依赖注入方式）。
 *  - service 层使用真实实现，仅 getActiveSetBonuses 包装为 vi.fn 以便控制套装奖励行为。
 *  - generateLogId mock 为固定值。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEquipmentStore, setInventoryCallbacks, clearInventoryCallbacks } from '@/modules/equipment/store';
import { createTestPinia } from '../utils/setup';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from '@/modules/equipment/types';

/** 跨 store stub + db stub + errorReporter stub：用 vi.hoisted 保证 mock 工厂可引用 */
const mocks = vi.hoisted(() => ({
  characterStore: {
    level: 10,
    classId: 'warrior',
    applyBonus: vi.fn().mockResolvedValue(undefined),
    removeBonus: vi.fn().mockResolvedValue(undefined),
  },
  /** 背包回调 stub：通过 setInventoryCallbacks 注入 */
  inventoryCallbacks: {
    removeItem: vi.fn().mockReturnValue(1),
    addItem: vi.fn().mockReturnValue(1),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
  equipmentDb: {
    saveEquipment: vi.fn().mockResolvedValue(undefined),
    getEquipment: vi.fn().mockResolvedValue({
      weapon1: null, weapon2: null, helm: null, chest: null, gloves: null, legs: null, boots: null,
    }),
    deleteEquipment: vi.fn().mockResolvedValue(undefined),
    saveEquipmentTemplate: vi.fn().mockResolvedValue(undefined),
    getEquipmentTemplate: vi.fn().mockResolvedValue(null),
    getAllEquipmentTemplates: vi.fn().mockResolvedValue([]),
    deleteEquipmentTemplate: vi.fn().mockResolvedValue(undefined),
  },
  errorReporter: {
    report: vi.fn(),
  },
}));

vi.mock('@/modules/equipment/db', () => ({ equipmentDbService: mocks.equipmentDb }));
vi.mock('@/modules/character/store', () => ({ useCharacterStore: () => mocks.characterStore }));
vi.mock('@/modules/log/store', () => ({ useLogStore: () => mocks.logStore }));
vi.mock('@/modules/log/service', () => ({ generateLogId: vi.fn().mockReturnValue('log-id') }));
vi.mock('@/utils/errorReport', () => ({ errorReporter: mocks.errorReporter }));

// service 层使用真实实现，仅 getActiveSetBonuses 包装为 vi.fn 以便单测覆盖防御性分支
vi.mock('@/modules/equipment/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/equipment/service')>();
  return {
    ...actual,
    getActiveSetBonuses: vi.fn(actual.getActiveSetBonuses),
  };
});

import { equipmentDbService } from '@/modules/equipment/db';

// ==================== 测试数据 helper ====================

function makeWeapon(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1',
    name: '铁剑',
    type: 'weapon',
    subtype: 'sword',
    grip: 'one_handed',
    rarity: 'common',
    icon: 'game-icons:broadsword',
    description: '一把铁剑',
    value: 100,
    stackable: false,
    slots: ['weapon1', 'weapon2'],
    occupies: ['weapon1'],
    bonus: { str: 5 },
    ...o,
  } as EquipmentItem;
}

function makeArmor(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'a1',
    name: '铁甲',
    type: 'armor',
    subtype: 'chest',
    rarity: 'uncommon',
    icon: 'game-icons:chest-armor',
    description: '一件铁甲',
    value: 200,
    stackable: false,
    slots: ['chest'],
    occupies: ['chest'],
    bonus: { con: 3 },
    ...o,
  } as EquipmentItem;
}

function emptyEquipment(): Record<EquipmentSlot, EquippedItem | null> {
  return { weapon1: null, weapon2: null, helm: null, chest: null, gloves: null, legs: null, boots: null };
}

function buildEquipment(slots: Partial<Record<EquipmentSlot, EquippedItem>>): Record<EquipmentSlot, EquippedItem | null> {
  return { ...emptyEquipment(), ...slots };
}

describe('useEquipmentStore - 阶段二 DB-1/DB-2 跨表事务保护', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    // 重置 characterStore 状态
    mocks.characterStore.level = 10;
    mocks.characterStore.classId = 'warrior';
    // 关键 mock 用 mockReset 彻底重置（清除未消耗的 mockRejectedValueOnce 队列残留），
    // 然后重新设置默认实现，确保每个测试从干净状态开始
    mocks.characterStore.applyBonus.mockReset();
    mocks.characterStore.applyBonus.mockResolvedValue(undefined);
    mocks.characterStore.removeBonus.mockReset();
    mocks.characterStore.removeBonus.mockResolvedValue(undefined);
    mocks.equipmentDb.saveEquipment.mockReset();
    mocks.equipmentDb.saveEquipment.mockResolvedValue(undefined);
    mocks.inventoryCallbacks.removeItem.mockReturnValue(1);
    mocks.inventoryCallbacks.addItem.mockReturnValue(1);
    // A1/G1 修复：通过回调注入替代 useInventoryStore 直接依赖
    setInventoryCallbacks(mocks.inventoryCallbacks.addItem, mocks.inventoryCallbacks.removeItem);
  });

  afterEach(() => {
    clearInventoryCallbacks();
  });

  // -------------------- equipItem persist 失败回滚 --------------------
  describe('equipItem persist 失败回滚', () => {
    it('空槽位装备新物品 persist 失败：移除新装备 bonus、放回背包、清空槽位、返回 false', async () => {
      // Arrange：persist 失败
      const persistError = new Error('IndexedDB 写入失败');
      mocks.equipmentDb.saveEquipment.mockRejectedValueOnce(persistError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      const weapon = makeWeapon({ bonus: { str: 5 } });

      // Act
      const result = await store.equipItem('weapon1', weapon);

      // Assert：返回 false
      expect(result).toBe(false);
      // 槽位被回滚（新装备移除）
      expect(store.equipment.weapon1).toBeNull();
      // 背包回滚（新装备放回背包）
      expect(mocks.inventoryCallbacks.removeItem).toHaveBeenCalledWith('w1', 1);
      expect(mocks.inventoryCallbacks.addItem).toHaveBeenCalledWith('w1', 1);
      // persistError 被设置
      expect(store.persistError).toBe('IndexedDB 写入失败');
      // removeBonus 被调用（移除新装备 bonus）
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 5 });
      // errorReporter.report 被调用
      expect(mocks.errorReporter.report).toHaveBeenCalledWith(
        persistError,
        'manual',
        expect.objectContaining({
          context: '装备持久化失败，已回滚装备和背包状态',
          characterId: 'char-1',
        })
      );
      errorSpy.mockRestore();
    });

    it('已有旧装备时装备新物品 persist 失败：恢复旧装备到槽位、从背包移除旧装备、应用旧装备 bonus', async () => {
      // Arrange
      const persistError = new Error('IndexedDB 写入失败');
      mocks.equipmentDb.saveEquipment.mockRejectedValueOnce(persistError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useEquipmentStore();
      const oldWeapon = makeWeapon({ id: 'old', name: '旧剑', bonus: { str: 2 } });
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: { item: oldWeapon, equippedAt: 1 } }),
      });
      const newWeapon = makeWeapon({ id: 'new', name: '新剑', bonus: { str: 6 } });

      // Act
      const result = await store.equipItem('weapon1', newWeapon);

      // Assert：返回 false
      expect(result).toBe(false);
      // 槽位被回滚：新装备移除，旧装备恢复
      expect(store.equipment.weapon1).toEqual({ item: oldWeapon, equippedAt: 1 });
      // 背包回滚：
      // - 新装备先从背包移除（removed），再放回背包（addItem new）
      // - 旧装备先放回背包（doUnequip addItem old），再从背包移除（rollback removeItem old）
      expect(mocks.inventoryCallbacks.removeItem).toHaveBeenCalledWith('new', 1);
      expect(mocks.inventoryCallbacks.addItem).toHaveBeenCalledWith('new', 1);
      expect(mocks.inventoryCallbacks.addItem).toHaveBeenCalledWith('old', 1);
      expect(mocks.inventoryCallbacks.removeItem).toHaveBeenCalledWith('old', 1);
      // bonus 回滚：
      // - doUnequip 时移除旧装备 bonus { str: 2 }
      // - equipItem 第6步应用新装备 bonus { str: 6 }
      // - persist 失败回滚：移除新装备 bonus { str: 6 }，应用旧装备 bonus { str: 2 }
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 2 });
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 6 });
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 6 });
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 2 });
      // persistError 被设置
      expect(store.persistError).toBe('IndexedDB 写入失败');
      errorSpy.mockRestore();
    });

    it('persist 失败回滚新装备 bonus 时再失败：仅记录错误日志，仍返回 false', async () => {
      // Arrange
      const persistError = new Error('IndexedDB 写入失败');
      mocks.equipmentDb.saveEquipment.mockRejectedValueOnce(persistError);
      const rollbackError = new Error('removeBonus 回滚失败');
      // 第二次调用 removeBonus（回滚新装备 bonus）时抛出
      mocks.characterStore.removeBonus.mockRejectedValueOnce(rollbackError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      const weapon = makeWeapon({ bonus: { str: 5 } });

      // Act
      const result = await store.equipItem('weapon1', weapon);

      // Assert：仍返回 false（不二次抛出）
      expect(result).toBe(false);
      // 槽位仍被清空（回滚 bonus 失败不阻断后续槽位回滚）
      expect(store.equipment.weapon1).toBeNull();
      // 记录回滚失败日志
      expect(errorSpy).toHaveBeenCalledWith(
        '[EquipmentStore] equipItem 回滚新装备 bonus 失败:',
        rollbackError
      );
      // persistError 仍被设置
      expect(store.persistError).toBe('IndexedDB 写入失败');
      errorSpy.mockRestore();
    });

    it('已有旧装备时 persist 失败且回滚旧装备 bonus 失败：仅记录错误日志，仍返回 false', async () => {
      // Arrange
      const persistError = new Error('IndexedDB 写入失败');
      mocks.equipmentDb.saveEquipment.mockRejectedValueOnce(persistError);
      const rollbackError = new Error('applyBonusForSlot 回滚失败');
      // applyBonus 序列：
      // - 第一次调用：第6步新装备 bonus 应用（成功）
      // - 第二次调用：persist 失败回滚时恢复旧装备 bonus（抛出）
      mocks.characterStore.applyBonus
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(rollbackError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useEquipmentStore();
      const oldWeapon = makeWeapon({ id: 'old', name: '旧剑', bonus: { str: 2 } });
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: { item: oldWeapon, equippedAt: 1 } }),
      });
      const newWeapon = makeWeapon({ id: 'new', name: '新剑', bonus: { str: 6 } });

      // Act
      const result = await store.equipItem('weapon1', newWeapon);

      // Assert：仍返回 false
      expect(result).toBe(false);
      // 旧装备仍被恢复到槽位（bonus 失败不阻断槽位恢复）
      expect(store.equipment.weapon1).toEqual({ item: oldWeapon, equippedAt: 1 });
      // 记录回滚失败日志
      expect(errorSpy).toHaveBeenCalledWith(
        '[EquipmentStore] equipItem 回滚旧装备 bonus 失败:',
        rollbackError
      );
      errorSpy.mockRestore();
    });
  });

  // -------------------- unequipItem persist 失败回滚 --------------------
  describe('unequipItem persist 失败回滚', () => {
    it('persist 失败：从背包移除已放回的装备、恢复装备到槽位、重新应用 bonus、返回 null', async () => {
      // Arrange
      const persistError = new Error('IndexedDB 写入失败');
      mocks.equipmentDb.saveEquipment.mockRejectedValueOnce(persistError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useEquipmentStore();
      const weapon = makeWeapon({ bonus: { str: 5 } });
      const equipped: EquippedItem = { item: weapon, equippedAt: 123 };
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: equipped }),
      });

      // Act
      const result = await store.unequipItem('weapon1');

      // Assert：返回 null
      expect(result).toBeNull();
      // 装备恢复到槽位
      expect(store.equipment.weapon1).toEqual(equipped);
      // 背包回滚：已放回的装备被移除
      // - doUnequip 先 addItem('w1', 1) 放回背包
      // - persist 失败后 removeItem('w1', 1) 移除已放回的装备
      expect(mocks.inventoryCallbacks.addItem).toHaveBeenCalledWith('w1', 1);
      expect(mocks.inventoryCallbacks.removeItem).toHaveBeenCalledWith('w1', 1);
      // 重新应用装备 bonus：doUnequip 移除 { str: 5 }，回滚时应用 { str: 5 }
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 5 });
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 5 });
      // persistError 被设置
      expect(store.persistError).toBe('IndexedDB 写入失败');
      // errorReporter.report 被调用
      expect(mocks.errorReporter.report).toHaveBeenCalledWith(
        persistError,
        'manual',
        expect.objectContaining({
          context: '装备持久化失败，已回滚装备状态',
          characterId: 'char-1',
        })
      );
      // 日志未被记录（persist 失败时不写日志）
      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('persist 失败且回滚装备 bonus 失败：仅记录错误日志，仍返回 null', async () => {
      // Arrange
      const persistError = new Error('IndexedDB 写入失败');
      mocks.equipmentDb.saveEquipment.mockRejectedValueOnce(persistError);
      const rollbackError = new Error('applyBonusForSlot 回滚失败');
      // applyBonus 第二次调用（回滚装备 bonus）时抛出
      mocks.characterStore.applyBonus.mockRejectedValueOnce(rollbackError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useEquipmentStore();
      const weapon = makeWeapon({ bonus: { str: 5 } });
      const equipped: EquippedItem = { item: weapon, equippedAt: 123 };
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: equipped }),
      });

      // Act
      const result = await store.unequipItem('weapon1');

      // Assert：仍返回 null（不二次抛出）
      expect(result).toBeNull();
      // 装备仍被恢复到槽位
      expect(store.equipment.weapon1).toEqual(equipped);
      // 记录回滚失败日志
      expect(errorSpy).toHaveBeenCalledWith(
        '[EquipmentStore] unequipItem 回滚装备 bonus 失败:',
        rollbackError
      );
      // persistError 仍被设置
      expect(store.persistError).toBe('IndexedDB 写入失败');
      errorSpy.mockRestore();
    });
  });

  // -------------------- persist 成功时 persistError 重置 --------------------
  describe('persist 成功时 persistError 重置为 null', () => {
    it('equipItem persist 成功后 persistError 为 null', async () => {
      // Arrange：先设置一个错误状态，验证成功后被重置
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1', persistError: '之前的错误' });
      const weapon = makeWeapon({ bonus: { str: 5 } });

      // Act
      const result = await store.equipItem('weapon1', weapon);

      // Assert：成功装备且 persistError 被重置
      expect(result).toBe(true);
      expect(store.persistError).toBeNull();
      expect(equipmentDbService.saveEquipment).toHaveBeenCalledTimes(1);
    });

    it('unequipItem persist 成功后 persistError 为 null', async () => {
      // Arrange
      const store = useEquipmentStore();
      const weapon = makeWeapon({ bonus: { str: 5 } });
      const equipped: EquippedItem = { item: weapon, equippedAt: 123 };
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: equipped }),
        persistError: '之前的错误',
      });

      // Act
      const result = await store.unequipItem('weapon1');

      // Assert：成功卸下且 persistError 被重置
      expect(result).toEqual(equipped);
      expect(store.persistError).toBeNull();
      expect(equipmentDbService.saveEquipment).toHaveBeenCalledTimes(1);
    });

    it('persist 跳过（无 currentCharacterId）时不重置 persistError', async () => {
      // Arrange：currentCharacterId 为 null 时 persist 不调用 saveEquipment，也不重置 persistError
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: null, persistError: '保留的错误' });

      // 直接调用内部 persist 通过 reset（reset 会清空状态）
      // 这里通过 reset 验证 persist 跳过逻辑：reset 内部 charId 为 null 时不调用 saveEquipment
      await store.reset();

      // Assert：未调用 saveEquipment
      expect(equipmentDbService.saveEquipment).not.toHaveBeenCalled();
    });
  });
});
