/**
 * @fileoverview 装备模块 Pinia Store 单元测试
 *
 * 覆盖 useEquipmentStore 的：
 * 1. State 初始值（equipment 全空、templates 空 Map、currentCharacterId=null、isLoading=false）
 * 2. Getters：totalStats（累加 bonus）/ equippedCount / slotList / weaponSlots / armorSlots / activeSetBonuses
 * 3. Actions：
 *    - equipItem（成功装备+应用 bonus / 槽位不匹配拒绝 / 等级不足拒绝 / 职业限制拒绝 / 背包无物拒绝）
 *    - unequipItem（成功卸下+放回背包 / 空槽位 / 未初始化）
 *    - canEquip（等级不足 / 职业限制 / 指定槽位校验 / 无槽位时 canEquipItem）
 *    - getEquipment / getEquippedItem / getEquipmentTemplate
 *    - addEquipmentTemplate / removeEquipmentTemplate
 *    - initialize（加载模板 + 解析 ID 映射）
 *    - reset（清空装备 + 持久化 + 清状态）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - equipmentDbService 全量 mock，不触碰真实 IndexedDB。
 *  - useCharacterStore / useInventoryStore / useLogStore 用 vi.hoisted stub 隔离跨 store 调用。
 *  - generateLogId mock 为固定值。
 *  - service 层纯函数（validateSlot / computeEquipBonus / checkClassRestriction 等）使用真实实现，
 *    通过构造合适的测试数据覆盖各分支（与 base/audio 样板“mock db + 真实 service”模式一致）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEquipmentStore } from '@/modules/equipment/store';
import { createTestPinia } from '../utils/setup';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from '@/modules/equipment/types';

/** 跨 store stub + db stub：用 vi.hoisted 保证 mock 工厂可引用 */
const mocks = vi.hoisted(() => ({
  characterStore: {
    level: 10,
    classId: 'warrior',
    applyBonus: vi.fn().mockResolvedValue(undefined),
    removeBonus: vi.fn().mockResolvedValue(undefined),
  },
  inventoryStore: {
    removeItem: vi.fn().mockReturnValue(1),
    addItem: vi.fn(),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
  equipmentDb: {
    saveEquipment: vi.fn().mockResolvedValue(undefined),
    getEquipment: vi.fn().mockResolvedValue({
      weapon1: null, weapon2: null, armor1: null, armor2: null, armor3: null, armor4: null,
    }),
    deleteEquipment: vi.fn().mockResolvedValue(undefined),
    saveEquipmentTemplate: vi.fn().mockResolvedValue(undefined),
    getEquipmentTemplate: vi.fn().mockResolvedValue(null),
    getAllEquipmentTemplates: vi.fn().mockResolvedValue([]),
    deleteEquipmentTemplate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/modules/equipment/db', () => ({ equipmentDbService: mocks.equipmentDb }));
vi.mock('@/modules/character/store', () => ({ useCharacterStore: () => mocks.characterStore }));
vi.mock('@/modules/inventory/store', () => ({ useInventoryStore: () => mocks.inventoryStore }));
vi.mock('@/modules/log/store', () => ({ useLogStore: () => mocks.logStore }));
vi.mock('@/modules/log/service', () => ({ generateLogId: vi.fn().mockReturnValue('log-id') }));

import { equipmentDbService } from '@/modules/equipment/db';

// ==================== 测试数据 helper ====================

function makeWeapon(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1',
    name: '铁剑',
    type: 'weapon',
    rarity: 'common',
    icon: 'game-icons:broadsword',
    description: '一把铁剑',
    value: 100,
    stackable: false,
    slots: ['weapon1'],
    bonus: { str: 5 },
    ...o,
  } as EquipmentItem;
}

function makeArmor(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'a1',
    name: '铁甲',
    type: 'armor',
    rarity: 'uncommon',
    icon: 'game-icons:chest-armor',
    description: '一件铁甲',
    value: 200,
    stackable: false,
    slots: ['armor2'],
    bonus: { con: 3 },
    ...o,
  } as EquipmentItem;
}

function emptyEquipment(): Record<EquipmentSlot, EquippedItem | null> {
  return { weapon1: null, weapon2: null, armor1: null, armor2: null, armor3: null, armor4: null };
}

function buildEquipment(slots: Partial<Record<EquipmentSlot, EquippedItem>>): Record<EquipmentSlot, EquippedItem | null> {
  return { ...emptyEquipment(), ...slots };
}

describe('useEquipmentStore - 装备 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    // 重置 characterStore 状态
    mocks.characterStore.level = 10;
    mocks.characterStore.classId = 'warrior';
    mocks.inventoryStore.removeItem.mockReturnValue(1);
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('equipment 6 个槽位初始全为 null', () => {
      const store = useEquipmentStore();
      expect(store.equipment).toEqual(emptyEquipment());
    });

    it('equipmentTemplates 初始为空 Map', () => {
      const store = useEquipmentStore();
      expect(store.equipmentTemplates.size).toBe(0);
    });

    it('currentCharacterId 初始为 null', () => {
      const store = useEquipmentStore();
      expect(store.currentCharacterId).toBeNull();
    });

    it('isLoading 初始为 false', () => {
      const store = useEquipmentStore();
      expect(store.isLoading).toBe(false);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('totalStats 空装备时全 0', () => {
      const store = useEquipmentStore();
      expect(store.totalStats).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    });

    it('totalStats 累加各槽位装备 bonus', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ bonus: { str: 5 } });
      const armor = makeArmor({ bonus: { con: 3, dex: 2 } });
      store.$patch({
        equipment: buildEquipment({
          weapon1: { item: weapon, equippedAt: 1 },
          armor2: { item: armor, equippedAt: 2 },
        }),
      });
      expect(store.totalStats).toEqual({ str: 5, dex: 2, con: 3, int: 0, wis: 0, cha: 0 });
    });

    it('equippedCount 统计非空槽位数', () => {
      const store = useEquipmentStore();
      store.$patch({
        equipment: buildEquipment({
          weapon1: { item: makeWeapon(), equippedAt: 1 },
        }),
      });
      expect(store.equippedCount).toBe(1);
    });

    it('slotList 返回 6 个槽位且包含 UI 信息', () => {
      const store = useEquipmentStore();
      expect(store.slotList).toHaveLength(6);
      expect(store.slotList[0]).toEqual(expect.objectContaining({ id: 'weapon1', isWeapon: true }));
      expect(store.slotList[2]).toEqual(expect.objectContaining({ id: 'armor1', isWeapon: false }));
    });

    it('weaponSlots 返回 2 个武器槽，armorSlots 返回 4 个护甲槽', () => {
      const store = useEquipmentStore();
      expect(store.weaponSlots).toHaveLength(2);
      expect(store.armorSlots).toHaveLength(4);
    });

    it('activeSetBonuses 无套装装备时返回空数组', () => {
      const store = useEquipmentStore();
      expect(store.activeSetBonuses).toEqual([]);
    });
  });

  // -------------------- Actions: equipItem --------------------
  describe('Actions: equipItem', () => {
    it('未初始化角色时返回 false', async () => {
      const store = useEquipmentStore();
      const result = await store.equipItem('weapon1', makeWeapon());
      expect(result).toBe(false);
    });

    it('槽位不匹配（武器装到护甲槽）返回 false', async () => {
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      const result = await store.equipItem('armor1', makeWeapon());
      expect(result).toBe(false);
      // 未触达背包移除
      expect(mocks.inventoryStore.removeItem).not.toHaveBeenCalled();
    });

    it('等级不足返回 false', async () => {
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      mocks.characterStore.level = 3;
      const weapon = makeWeapon({ levelRequirement: 5 });
      const result = await store.equipItem('weapon1', weapon);
      expect(result).toBe(false);
    });

    it('职业限制不匹配返回 false', async () => {
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      mocks.characterStore.classId = 'warrior';
      const weapon = makeWeapon({ classRestriction: ['mage'] });
      const result = await store.equipItem('weapon1', weapon);
      expect(result).toBe(false);
      expect(mocks.inventoryStore.removeItem).not.toHaveBeenCalled();
    });

    it('背包无该物品（removeItem 返回 0）返回 false', async () => {
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      mocks.inventoryStore.removeItem.mockReturnValue(0);
      const result = await store.equipItem('weapon1', makeWeapon());
      expect(result).toBe(false);
    });

    it('成功装备：写入槽位、应用 bonus、持久化、记录日志、返回 true', async () => {
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      const weapon = makeWeapon({ bonus: { str: 5 } });

      const result = await store.equipItem('weapon1', weapon);

      expect(result).toBe(true);
      // 槽位已写入
      expect(store.equipment.weapon1).toEqual({ item: weapon, equippedAt: expect.any(Number) });
      // 从背包移除 1 件
      expect(mocks.inventoryStore.removeItem).toHaveBeenCalledWith('w1', 1);
      // 应用了属性加成
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 5 });
      // 持久化调用
      expect(equipmentDbService.saveEquipment).toHaveBeenCalledTimes(1);
      // 日志记录
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: '装备了：铁剑',
      }));
    });

    it('成功装备到已有装备的槽位时先卸下旧装备', async () => {
      const store = useEquipmentStore();
      const oldWeapon = makeWeapon({ id: 'old', name: '旧剑', bonus: { str: 2 } });
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: { item: oldWeapon, equippedAt: 1 } }),
      });
      const newWeapon = makeWeapon({ id: 'new', name: '新剑', bonus: { str: 6 } });

      const result = await store.equipItem('weapon1', newWeapon);

      expect(result).toBe(true);
      // 旧装备属性被移除
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 2 });
      // 旧装备放回背包
      expect(mocks.inventoryStore.addItem).toHaveBeenCalledWith('old', 1);
      // 新装备已写入
      expect(store.equipment.weapon1?.item.id).toBe('new');
      // 新装备属性已应用
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 6 });
    });
  });

  // -------------------- Actions: unequipItem --------------------
  describe('Actions: unequipItem', () => {
    it('未初始化角色时返回 null', async () => {
      const store = useEquipmentStore();
      const result = await store.unequipItem('weapon1');
      expect(result).toBeNull();
    });

    it('空槽位返回 null', async () => {
      const store = useEquipmentStore();
      store.$patch({ currentCharacterId: 'char-1' });
      const result = await store.unequipItem('weapon1');
      expect(result).toBeNull();
    });

    it('成功卸下：移除 bonus、放回背包、持久化、记录日志、返回卸下物品', async () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ bonus: { str: 5 } });
      const equipped: EquippedItem = { item: weapon, equippedAt: 123 };
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: equipped }),
      });

      const result = await store.unequipItem('weapon1');

      expect(result).toEqual(equipped);
      expect(store.equipment.weapon1).toBeNull();
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 5 });
      expect(mocks.inventoryStore.addItem).toHaveBeenCalledWith('w1', 1);
      expect(equipmentDbService.saveEquipment).toHaveBeenCalledTimes(1);
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        message: '卸下了：铁剑',
      }));
    });
  });

  // -------------------- Actions: canEquip --------------------
  describe('Actions: canEquip', () => {
    it('等级不足返回 false', () => {
      const store = useEquipmentStore();
      mocks.characterStore.level = 3;
      const weapon = makeWeapon({ levelRequirement: 5 });
      expect(store.canEquip(weapon, 'weapon1')).toBe(false);
    });

    it('职业限制不匹配返回 false', () => {
      const store = useEquipmentStore();
      mocks.characterStore.classId = 'warrior';
      const weapon = makeWeapon({ classRestriction: ['mage'] });
      expect(store.canEquip(weapon, 'weapon1')).toBe(false);
    });

    it('指定槽位不兼容返回 false，兼容返回 true', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ slots: ['weapon1'] });
      // 武器不能装护甲槽
      expect(store.canEquip(weapon, 'armor1')).toBe(false);
      // 武器装主手槽
      expect(store.canEquip(weapon, 'weapon1')).toBe(true);
    });

    it('不指定槽位且有空闲兼容槽位时返回 true', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ slots: ['weapon1', 'weapon2'] });
      expect(store.canEquip(weapon)).toBe(true);
    });

    it('不指定槽位且所有兼容槽位已占用时返回 false', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ slots: ['weapon1'] });
      store.$patch({
        equipment: buildEquipment({ weapon1: { item: makeWeapon({ id: 'old' }), equippedAt: 1 } }),
      });
      expect(store.canEquip(weapon)).toBe(false);
    });
  });

  // -------------------- Actions: 查询 --------------------
  describe('Actions: 查询', () => {
    it('getEquipment 返回浅拷贝，修改不影响内部状态', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon();
      store.$patch({ equipment: buildEquipment({ weapon1: { item: weapon, equippedAt: 1 } }) });
      const eq = store.getEquipment();
      expect(eq.weapon1?.item.id).toBe('w1');
      // 修改返回值不影响内部
      eq.weapon1 = null;
      expect(store.equipment.weapon1).not.toBeNull();
    });

    it('getEquippedItem 命中返回拷贝，未命中返回 null', () => {
      const store = useEquipmentStore();
      store.$patch({ equipment: buildEquipment({ weapon1: { item: makeWeapon(), equippedAt: 1 } }) });
      expect(store.getEquippedItem('weapon1')?.item.id).toBe('w1');
      expect(store.getEquippedItem('weapon2')).toBeNull();
    });

    it('getEquipmentTemplate 从内存缓存查询', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon();
      const map = new Map<string, EquipmentItem>();
      map.set('w1', weapon);
      store.$patch({ equipmentTemplates: map });
      expect(store.getEquipmentTemplate('w1')).toEqual(weapon);
      expect(store.getEquipmentTemplate('nope')).toBeNull();
    });
  });

  // -------------------- Actions: 模板管理 --------------------
  describe('Actions: 模板管理', () => {
    it('addEquipmentTemplate 写入缓存并持久化', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ id: 'new-w' });
      store.addEquipmentTemplate(weapon);
      expect(store.getEquipmentTemplate('new-w')).toEqual(weapon);
      expect(equipmentDbService.saveEquipmentTemplate).toHaveBeenCalledWith(weapon);
    });

    it('removeEquipmentTemplate 从缓存删除并持久化', () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon({ id: 'rm-w' });
      const map = new Map<string, EquipmentItem>();
      map.set('rm-w', weapon);
      store.$patch({ equipmentTemplates: map });

      store.removeEquipmentTemplate('rm-w');

      expect(store.getEquipmentTemplate('rm-w')).toBeNull();
      expect(equipmentDbService.deleteEquipmentTemplate).toHaveBeenCalledWith('rm-w');
    });
  });

  // -------------------- Actions: initialize --------------------
  describe('Actions: initialize', () => {
    it('加载模板并解析角色装备 ID 映射为 EquippedItem', async () => {
      const weapon = makeWeapon({ id: 'w1' });
      const armor = makeArmor({ id: 'a1' });
      vi.mocked(equipmentDbService.getAllEquipmentTemplates).mockResolvedValueOnce([weapon, armor]);
      // 角色已装备 w1，a1 未装备
      vi.mocked(equipmentDbService.getEquipment).mockResolvedValueOnce({
        weapon1: 'w1', weapon2: null, armor1: null, armor2: null, armor3: null, armor4: null,
      });

      const store = useEquipmentStore();
      await store.initialize('char-1');

      expect(store.currentCharacterId).toBe('char-1');
      expect(store.isLoading).toBe(false);
      // 模板已缓存
      expect(store.getEquipmentTemplate('w1')).toEqual(weapon);
      expect(store.getEquipmentTemplate('a1')).toEqual(armor);
      // 装备已解析
      expect(store.equipment.weapon1?.item.id).toBe('w1');
      expect(store.equipment.weapon2).toBeNull();
    });

    it('DB 中不存在的装备 ID 会被忽略', async () => {
      vi.mocked(equipmentDbService.getAllEquipmentTemplates).mockResolvedValueOnce([]);
      vi.mocked(equipmentDbService.getEquipment).mockResolvedValueOnce({
        weapon1: 'missing', weapon2: null, armor1: null, armor2: null, armor3: null, armor4: null,
      });

      const store = useEquipmentStore();
      await store.initialize('char-1');

      // 模板不存在时该槽位保持空
      expect(store.equipment.weapon1).toBeNull();
    });
  });

  // -------------------- Actions: reset --------------------
  describe('Actions: reset', () => {
    it('清空装备、移除所有 bonus、持久化空映射、清状态', async () => {
      const weapon = makeWeapon({ bonus: { str: 5 } });
      const store = useEquipmentStore();
      store.$patch({
        currentCharacterId: 'char-1',
        equipment: buildEquipment({ weapon1: { item: weapon, equippedAt: 1 } }),
        equipmentTemplates: new Map([['w1', weapon]]),
      });

      await store.reset();

      expect(store.equipment).toEqual(emptyEquipment());
      expect(store.currentCharacterId).toBeNull();
      expect(store.equipmentTemplates.size).toBe(0);
      // 卸下时移除了 bonus
      expect(mocks.characterStore.removeBonus).toHaveBeenCalledWith({ str: 5 });
      // 持久化空映射
      expect(equipmentDbService.saveEquipment).toHaveBeenCalledWith(
        'char-1',
        { weapon1: null, weapon2: null, armor1: null, armor2: null, armor3: null, armor4: null }
      );
    });

    it('无角色 ID 时不持久化但清空状态', async () => {
      const store = useEquipmentStore();
      const weapon = makeWeapon();
      store.$patch({
        currentCharacterId: null,
        equipment: buildEquipment({ weapon1: { item: weapon, equippedAt: 1 } }),
      });

      await store.reset();

      expect(store.equipment).toEqual(emptyEquipment());
      expect(equipmentDbService.saveEquipment).not.toHaveBeenCalled();
    });
  });
});
