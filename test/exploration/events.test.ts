/**
 * @fileoverview 探索模块事件处理器注册表单元测试
 *
 * 覆盖 src/modules/exploration/events.ts 中的：
 * 1. effectHandlers —— RandomEventEffectType → 角色状态变更（heal/mana/exp/damage/mpLoss/gold）
 * 2. cellEventHandlers —— CellType → 格子事件结算（treasure/trap/event/rest）
 * 3. applyEventEffect —— 效果处理器分发函数
 * 4. dispatchCellEvent —— 格子事件处理器分发函数
 * 5. grantFallbackReward —— 物品模板不存在时的兜底奖励（通过 treasure 间接测试）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - exploration service 的 generate* 纯函数全量 mock，返回可控测试数据。
 *  - character/inventory/log store stub；generateLogId mock。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 断言 emit，beforeEach 调用 clearAll。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus, GameEvents } from '@/modules/bus';
import type {
  ExplorationCell,
  AreaConfig,
  RandomEventEffectType,
} from '@/modules/exploration/types';

// ==================== vi.hoisted：跨 store stub 持有对象 ====================
const mocks = vi.hoisted(() => ({
  characterStore: {
    receiveHeal: vi.fn<(amount: number) => Promise<void>>().mockResolvedValue(undefined),
    takeDamage: vi.fn<(amount: number) => Promise<void>>().mockResolvedValue(undefined),
    changeMp: vi.fn<(amount: number) => Promise<void>>().mockResolvedValue(undefined),
    gainExp: vi.fn<(amount: number) => Promise<void>>().mockResolvedValue(undefined),
    gainGold: vi.fn<(amount: number) => Promise<void>>().mockResolvedValue(undefined),
    hp: 100,
  },
  inventoryStore: {
    getItemInfo: vi.fn<(itemId: string) => { id: string; name: string } | null>().mockReturnValue(null),
    addItem: vi.fn<(itemId: string, quantity: number) => number>().mockReturnValue(1),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
}));

// ==================== Mock：exploration service 纯函数 ====================
vi.mock('@/modules/exploration/service', () => ({
  generateTrapDamage: vi.fn().mockReturnValue(25),
  generateRandomEvent: vi.fn().mockReturnValue({
    message: '发现神秘泉水',
    icon: 'game-icons:water-drop',
    effect: { type: 'heal', amount: 15 },
  }),
  generateMultiOptionEvent: vi.fn().mockReturnValue({
    message: '发现一座古老祭坛',
    icon: 'game-icons:altar',
    choices: [
      { label: '触碰祭坛', effect: { type: 'exp', amount: 30 } },
      { label: '安全离开', effect: { type: 'heal', amount: 5 } },
    ],
  }),
  generateCampHeal: vi.fn().mockReturnValue({ hp: 9999, mana: 9999 }),
  generateItemForCell: vi.fn().mockReturnValue(''),
}));

// ==================== Mock：log service ====================
vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log_test_1'),
}));

// ==================== Mock：跨 store 依赖 ====================
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => mocks.characterStore,
}));
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: () => mocks.inventoryStore,
}));
vi.mock('@/modules/log/store', () => ({
  useLogStore: () => mocks.logStore,
}));

// ==================== 取出 spy 引用 ====================
import {
  generateTrapDamage,
  generateRandomEvent,
  generateMultiOptionEvent,
  generateCampHeal,
  generateItemForCell,
} from '@/modules/exploration/service';
import {
  effectHandlers,
  cellEventHandlers,
  applyEventEffect,
  dispatchCellEvent,
  type ExplorationContext,
  type CellEventContext,
} from '@/modules/exploration/events';

// ==================== 测试数据构造 helper ====================

/** 构造测试用区域配置 */
function makeAreaConfig(overrides: Partial<AreaConfig> = {}): AreaConfig {
  return {
    areaId: 'forest',
    name: '森林',
    level: 5,
    eventProbability: { monster: 20, item: 25, trap: 15, event: 15, empty: 25 },
    monsterPool: ['goblin'],
    bossPool: ['dragon'],
    itemPool: ['small_health_potion'],
    ...overrides,
  };
}

/** 构造测试用格子对象 */
function makeCell(overrides: Partial<ExplorationCell> = {}): ExplorationCell {
  return {
    x: 0,
    y: 0,
    type: 'empty',
    explored: false,
    accessible: false,
    visited: false,
    completed: false,
    ...overrides,
  };
}

/** 构造效果处理器上下文 */
function makeContext(overrides: Partial<ExplorationContext> = {}): ExplorationContext {
  return {
    characterStore: mocks.characterStore,
    inventoryStore: mocks.inventoryStore,
    areaConfig: makeAreaConfig(),
    uiCallbacks: null,
    characterId: 'char_1',
    ...overrides,
  };
}

/** 构造格子事件上下文 */
function makeCellContext(overrides: Partial<CellEventContext> = {}): CellEventContext {
  return {
    ...makeContext(),
    cell: makeCell(),
    ...overrides,
  };
}

// ==================== 测试用例 ====================

describe('exploration/events - 事件处理器注册表', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clearAll();
    // 重置 characterStore hp 为存活状态
    mocks.characterStore.hp = 100;
    // 重置默认 mock 返回值（clearAllMocks 不清除实现，但显式重置确保隔离）
    mocks.characterStore.receiveHeal.mockResolvedValue(undefined);
    mocks.characterStore.takeDamage.mockResolvedValue(undefined);
    mocks.characterStore.changeMp.mockResolvedValue(undefined);
    mocks.characterStore.gainExp.mockResolvedValue(undefined);
    mocks.characterStore.gainGold.mockResolvedValue(undefined);
    mocks.inventoryStore.getItemInfo.mockReturnValue(null);
    mocks.inventoryStore.addItem.mockReturnValue(1);
    vi.mocked(generateItemForCell).mockReturnValue('');
    vi.mocked(generateTrapDamage).mockReturnValue(25);
    vi.mocked(generateCampHeal).mockReturnValue({ hp: 9999, mana: 9999 });
    vi.mocked(generateRandomEvent).mockReturnValue({
      message: '发现神秘泉水',
      icon: 'game-icons:water-drop',
      effect: { type: 'heal', amount: 15 },
    });
    vi.mocked(generateMultiOptionEvent).mockReturnValue({
      message: '发现一座古老祭坛',
      icon: 'game-icons:altar',
      choices: [
        { label: '触碰祭坛', effect: { type: 'exp', amount: 30 } },
        { label: '安全离开', effect: { type: 'heal', amount: 5 } },
      ],
    });
  });

  afterEach(() => {
    // 恢复 vi.spyOn 创建的 spy（如 Math.random），不影响 vi.mock 的模块替换
    vi.restoreAllMocks();
  });

  // ==================== effectHandlers ====================
  describe('effectHandlers - 效果处理器', () => {
    describe('heal - 生命恢复', () => {
      it('调用 characterStore.receiveHeal 恢复生命，返回 false（不死亡）', async () => {
        // Arrange
        const ctx = makeContext();
        const amount = 30;

        // Act
        const result = await effectHandlers.heal(ctx, amount);

        // Assert
        expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(amount);
        expect(result).toBe(false);
      });
    });

    describe('mana - 法力恢复', () => {
      it('调用 characterStore.changeMp 正值恢复法力，返回 false', async () => {
        // Arrange
        const ctx = makeContext();
        const amount = 20;

        // Act
        const result = await effectHandlers.mana(ctx, amount);

        // Assert
        expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(amount);
        expect(result).toBe(false);
      });
    });

    describe('exp - 经验奖励', () => {
      it('调用 characterStore.gainExp 增加经验，返回 false', async () => {
        // Arrange
        const ctx = makeContext();
        const amount = 50;

        // Act
        const result = await effectHandlers.exp(ctx, amount);

        // Assert
        expect(mocks.characterStore.gainExp).toHaveBeenCalledWith(amount);
        expect(result).toBe(false);
      });
    });

    describe('damage - 伤害', () => {
      it('存活：调用 takeDamage，hp > 0 时返回 false', async () => {
        // Arrange
        mocks.characterStore.hp = 50;
        const ctx = makeContext();
        const amount = 20;

        // Act
        const result = await effectHandlers.damage(ctx, amount);

        // Assert
        expect(mocks.characterStore.takeDamage).toHaveBeenCalledWith(amount);
        expect(result).toBe(false);
      });

      it('死亡：hp <= 0 时返回 true（需触发死亡处理）', async () => {
        // Arrange
        mocks.characterStore.hp = 0;
        const ctx = makeContext();
        const amount = 100;

        // Act
        const result = await effectHandlers.damage(ctx, amount);

        // Assert
        expect(mocks.characterStore.takeDamage).toHaveBeenCalledWith(amount);
        expect(result).toBe(true);
      });
    });

    describe('mpLoss - 法力损失', () => {
      it('调用 characterStore.changeMp 负值减少法力，返回 false', async () => {
        // Arrange
        const ctx = makeContext();
        const amount = 15;

        // Act
        const result = await effectHandlers.mpLoss(ctx, amount);

        // Assert
        // 源码中 mpLoss 使用 -amount 调用 changeMp
        expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(-amount);
        expect(result).toBe(false);
      });
    });

    describe('gold - 金币奖励', () => {
      it('调用 characterStore.gainGold 增加金币，返回 false', async () => {
        // Arrange
        const ctx = makeContext();
        const amount = 100;

        // Act
        const result = await effectHandlers.gold(ctx, amount);

        // Assert
        expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(amount);
        expect(result).toBe(false);
      });
    });
  });

  // ==================== applyEventEffect 分发 ====================
  describe('applyEventEffect - 效果分发函数', () => {
    it('根据 effectType 分发到对应处理器', async () => {
      // Arrange
      const ctx = makeContext();
      const amount = 10;

      // Act
      await applyEventEffect('heal', ctx, amount);

      // Assert
      expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(amount);
    });

    it('damage 效果返回死亡标记', async () => {
      // Arrange
      mocks.characterStore.hp = 0;
      const ctx = makeContext();

      // Act
      const result = await applyEventEffect('damage', ctx, 50);

      // Assert
      expect(result).toBe(true);
    });

    it('mpLoss 效果使用负值调用 changeMp', async () => {
      // Arrange
      const ctx = makeContext();
      const amount = 12;

      // Act
      await applyEventEffect('mpLoss', ctx, amount);

      // Assert
      expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(-amount);
    });

    it('未注册的效果类型返回 false 并 console.warn', async () => {
      // Arrange
      const ctx = makeContext();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // 使用双重断言绕过 TS 类型检查，模拟运行时传入未注册的类型
      const unknownType = 'unknown_effect' as unknown as RandomEventEffectType;

      // Act
      const result = await applyEventEffect(unknownType, ctx, 10);

      // Assert
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('未注册的事件效果类型'));
    });
  });

  // ==================== cellEventHandlers ====================
  describe('cellEventHandlers - 格子事件处理器', () => {
    // -------------------- treasure --------------------
    describe('treasure - 宝箱', () => {
      it('正常路径：生成物品入包、记录日志、emit 事件、通知 UI', async () => {
        // Arrange
        vi.mocked(generateItemForCell).mockReturnValue('potion_1');
        mocks.inventoryStore.getItemInfo.mockReturnValue({ id: 'potion_1', name: '生命药水' });
        const itemSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_ITEM_FOUND, itemSpy);
        const onItemFound = vi.fn();
        const ctx = makeCellContext({
          cell: makeCell({ type: 'treasure' }),
          uiCallbacks: { onItemFound },
        });

        // Act
        const result = await cellEventHandlers.treasure!(ctx);

        // Assert
        expect(generateItemForCell).toHaveBeenCalledWith(ctx.areaConfig.itemPool);
        expect(mocks.inventoryStore.addItem).toHaveBeenCalledWith('potion_1', 1);
        expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'item', message: expect.stringContaining('生命药水') })
        );
        expect(itemSpy).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'potion_1', count: 1, itemName: '生命药水' })
        );
        expect(onItemFound).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'potion_1', count: 1, itemName: '生命药水' })
        );
        expect(result).toEqual({ completed: true });
      });

      it('generateItemForCell 返回空字符串时直接返回 completed，不调用 addItem', async () => {
        // Arrange
        vi.mocked(generateItemForCell).mockReturnValue('');
        const ctx = makeCellContext({
          cell: makeCell({ type: 'treasure' }),
        });

        // Act
        const result = await cellEventHandlers.treasure!(ctx);

        // Assert
        expect(mocks.inventoryStore.addItem).not.toHaveBeenCalled();
        expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
        expect(result).toEqual({ completed: true });
      });

      it('兜底路径：物品模板不存在时发放金币和经验作为补偿', async () => {
        // Arrange
        vi.mocked(generateItemForCell).mockReturnValue('unknown_item');
        mocks.inventoryStore.getItemInfo.mockReturnValue(null);
        const itemSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_ITEM_FOUND, itemSpy);
        const onItemFound = vi.fn();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const ctx = makeCellContext({
          cell: makeCell({ type: 'treasure' }),
          uiCallbacks: { onItemFound },
        });

        // Act
        const result = await cellEventHandlers.treasure!(ctx);

        // Assert
        expect(mocks.inventoryStore.addItem).not.toHaveBeenCalled();
        // 兜底奖励调用 gainGold 和 gainExp
        expect(mocks.characterStore.gainGold).toHaveBeenCalled();
        expect(mocks.characterStore.gainExp).toHaveBeenCalled();
        expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'item', message: expect.stringContaining('金币') })
        );
        expect(itemSpy).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'unknown_item', count: 0 })
        );
        expect(onItemFound).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'unknown_item', count: 0 })
        );
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('物品模板'));
        expect(result).toEqual({ completed: true });
      });
    });

    // -------------------- trap --------------------
    describe('trap - 陷阱', () => {
      it('存活：计算伤害并扣除 HP、emit 事件、记录日志、通知 UI', async () => {
        // Arrange
        mocks.characterStore.hp = 50;
        vi.mocked(generateTrapDamage).mockReturnValue(25);
        const trapSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_TRAP_TRIGGERED, trapSpy);
        const onTrapTriggered = vi.fn();
        const ctx = makeCellContext({
          cell: makeCell({ type: 'trap' }),
          uiCallbacks: { onTrapTriggered },
        });

        // Act
        const result = await cellEventHandlers.trap!(ctx);

        // Assert
        expect(generateTrapDamage).toHaveBeenCalledWith(ctx.areaConfig.level);
        expect(mocks.characterStore.takeDamage).toHaveBeenCalledWith(25);
        expect(trapSpy).toHaveBeenCalledWith(
          expect.objectContaining({ damage: 25, trapType: '普通陷阱' })
        );
        expect(onTrapTriggered).toHaveBeenCalledWith({ damage: 25, trapType: '普通陷阱' });
        expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'combat', message: expect.stringContaining('25') })
        );
        expect(result).toEqual({ completed: true, shouldHandleDeath: false });
      });

      it('死亡：hp <= 0 时返回 shouldHandleDeath=true，不 emit 事件、不记录日志', async () => {
        // Arrange
        mocks.characterStore.hp = 0;
        vi.mocked(generateTrapDamage).mockReturnValue(100);
        const trapSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_TRAP_TRIGGERED, trapSpy);
        const ctx = makeCellContext({
          cell: makeCell({ type: 'trap' }),
        });

        // Act
        const result = await cellEventHandlers.trap!(ctx);

        // Assert
        expect(mocks.characterStore.takeDamage).toHaveBeenCalledWith(100);
        expect(trapSpy).not.toHaveBeenCalled();
        expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
        expect(result).toEqual({ completed: true, shouldHandleDeath: true });
      });
    });

    // -------------------- event --------------------
    describe('event - 随机事件', () => {
      it('普通随机事件：生成效果并应用、emit 事件、记录日志、通知 UI', async () => {
        // Arrange
        // Math.random >= MULTI_OPTION_EVENT_PROBABILITY(0.3) → 走普通事件分支
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        vi.mocked(generateRandomEvent).mockReturnValue({
          message: '发现神秘泉水',
          icon: 'game-icons:water-drop',
          effect: { type: 'heal', amount: 15 },
        });
        const eventSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_RANDOM_EVENT, eventSpy);
        const onRandomEvent = vi.fn();
        const ctx = makeCellContext({
          cell: makeCell({ type: 'event' }),
          uiCallbacks: { onRandomEvent },
        });

        // Act
        const result = await cellEventHandlers.event!(ctx);

        // Assert
        expect(generateRandomEvent).toHaveBeenCalledWith(ctx.areaConfig.level);
        expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(15);
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ message: '发现神秘泉水', icon: 'game-icons:water-drop' })
        );
        expect(onRandomEvent).toHaveBeenCalledWith({
          message: '发现神秘泉水',
          icon: 'game-icons:water-drop',
        });
        expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({ message: '发现神秘泉水' })
        );
        expect(result).toEqual({ completed: true });
      });

      it('普通随机事件死亡：返回 shouldHandleDeath=true，不 emit、不记录日志', async () => {
        // Arrange
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        vi.mocked(generateRandomEvent).mockReturnValue({
          message: '触发爆炸陷阱',
          icon: 'game-icons:explosion',
          effect: { type: 'damage', amount: 999 },
        });
        mocks.characterStore.hp = 0;
        const eventSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_RANDOM_EVENT, eventSpy);
        const ctx = makeCellContext({
          cell: makeCell({ type: 'event' }),
        });

        // Act
        const result = await cellEventHandlers.event!(ctx);

        // Assert
        expect(mocks.characterStore.takeDamage).toHaveBeenCalledWith(999);
        expect(eventSpy).not.toHaveBeenCalled();
        expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
        expect(result).toEqual({ completed: true, shouldHandleDeath: true });
      });

      it('多选项事件：通知 UI 展示弹窗、记录日志，不直接应用效果', async () => {
        // Arrange
        // Math.random < MULTI_OPTION_EVENT_PROBABILITY(0.3) → 走多选项分支
        vi.spyOn(Math, 'random').mockReturnValue(0.1);
        vi.mocked(generateMultiOptionEvent).mockReturnValue({
          message: '发现一座古老祭坛',
          icon: 'game-icons:altar',
          choices: [
            { label: '触碰祭坛', effect: { type: 'exp', amount: 30 } },
            { label: '安全离开', effect: { type: 'heal', amount: 5 } },
          ],
        });
        const onMultiOptionEvent = vi.fn();
        const ctx = makeCellContext({
          cell: makeCell({ type: 'event' }),
          uiCallbacks: { onMultiOptionEvent },
        });

        // Act
        const result = await cellEventHandlers.event!(ctx);

        // Assert
        expect(generateMultiOptionEvent).toHaveBeenCalledWith(ctx.areaConfig.level);
        expect(onMultiOptionEvent).toHaveBeenCalledWith(
          expect.objectContaining({ message: '发现一座古老祭坛' })
        );
        expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({ message: '发现一座古老祭坛' })
        );
        // 多选项事件不应直接应用效果（效果由玩家选择后应用）
        expect(mocks.characterStore.gainExp).not.toHaveBeenCalled();
        expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
        expect(result).toEqual({ completed: true });
      });
    });

    // -------------------- rest --------------------
    describe('rest - 营地', () => {
      it('campUsed=false：恢复 HP/MP、emit 事件、记录日志、返回 campUsed=true', async () => {
        // Arrange
        vi.mocked(generateCampHeal).mockReturnValue({ hp: 9999, mana: 9999 });
        const campSpy = vi.fn();
        eventBus.on(GameEvents.EXPLORATION_CAMP_USED, campSpy);
        const ctx = makeCellContext({
          cell: makeCell({ type: 'rest' }),
          campUsed: false,
        });

        // Act
        const result = await cellEventHandlers.rest!(ctx);

        // Assert
        expect(generateCampHeal).toHaveBeenCalledWith(ctx.areaConfig.level);
        expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(9999);
        expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(9999);
        expect(campSpy).toHaveBeenCalledWith({ characterId: 'char_1' });
        expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'exploration', message: expect.stringContaining('营地') })
        );
        expect(result).toEqual({ completed: true, campUsed: true });
      });

      it('campUsed=true：直接返回，不恢复 HP/MP', async () => {
        // Arrange
        const ctx = makeCellContext({
          cell: makeCell({ type: 'rest' }),
          campUsed: true,
        });

        // Act
        const result = await cellEventHandlers.rest!(ctx);

        // Assert
        expect(generateCampHeal).not.toHaveBeenCalled();
        expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
        expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
        expect(result).toEqual({ completed: true });
      });
    });
  });

  // ==================== dispatchCellEvent 分发 ====================
  describe('dispatchCellEvent - 格子事件分发函数', () => {
    it('根据 cellType 分发到对应处理器', async () => {
      // Arrange
      mocks.characterStore.hp = 50;
      vi.mocked(generateTrapDamage).mockReturnValue(10);
      const ctx = makeCellContext({
        cell: makeCell({ type: 'trap' }),
      });

      // Act
      const result = await dispatchCellEvent('trap', ctx);

      // Assert
      expect(generateTrapDamage).toHaveBeenCalled();
      expect(result.completed).toBe(true);
    });

    it('未注册的 cell 类型（monster）返回空结果，不调用任何处理器', async () => {
      // Arrange
      const ctx = makeCellContext({
        cell: makeCell({ type: 'monster' }),
      });

      // Act
      const result = await dispatchCellEvent('monster', ctx);

      // Assert
      expect(result).toEqual({ completed: false });
      expect(mocks.characterStore.takeDamage).not.toHaveBeenCalled();
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
      expect(mocks.inventoryStore.addItem).not.toHaveBeenCalled();
    });

    it('empty 类型不进入此分发', async () => {
      // Arrange
      const ctx = makeCellContext({
        cell: makeCell({ type: 'empty' }),
      });

      // Act
      const result = await dispatchCellEvent('empty', ctx);

      // Assert
      expect(result).toEqual({ completed: false });
    });

    it('start 类型不进入此分发', async () => {
      // Arrange
      const ctx = makeCellContext({
        cell: makeCell({ type: 'start' }),
      });

      // Act
      const result = await dispatchCellEvent('start', ctx);

      // Assert
      expect(result).toEqual({ completed: false });
    });

    it('boss 类型不进入此分发', async () => {
      // Arrange
      const ctx = makeCellContext({
        cell: makeCell({ type: 'boss' }),
      });

      // Act
      const result = await dispatchCellEvent('boss', ctx);

      // Assert
      expect(result).toEqual({ completed: false });
    });
  });

  // ==================== 边界情况 ====================
  describe('边界情况', () => {
    it('uiCallbacks 为 null 时，treasure 正常路径仍能完成（可选链保护）', async () => {
      // Arrange
      vi.mocked(generateItemForCell).mockReturnValue('potion_1');
      mocks.inventoryStore.getItemInfo.mockReturnValue({ id: 'potion_1', name: '生命药水' });
      const ctx = makeCellContext({
        cell: makeCell({ type: 'treasure' }),
        uiCallbacks: null,
      });

      // Act
      const result = await cellEventHandlers.treasure!(ctx);

      // Assert
      expect(mocks.inventoryStore.addItem).toHaveBeenCalledWith('potion_1', 1);
      expect(result).toEqual({ completed: true });
    });

    it('characterStore.receiveHeal 抛出异常时，处理器向上传播异常（源码无内部容错）', async () => {
      // Arrange
      const error = new Error('store 调用失败');
      mocks.characterStore.receiveHeal.mockRejectedValueOnce(error);
      const ctx = makeContext();

      // Act & Assert
      await expect(effectHandlers.heal(ctx, 10)).rejects.toThrow('store 调用失败');
    });

    it('事件日志记录：treasure 正常路径调用 addLogEntry 一次', async () => {
      // Arrange
      vi.mocked(generateItemForCell).mockReturnValue('potion_1');
      mocks.inventoryStore.getItemInfo.mockReturnValue({ id: 'potion_1', name: '生命药水' });
      const ctx = makeCellContext({
        cell: makeCell({ type: 'treasure' }),
      });

      // Act
      await cellEventHandlers.treasure!(ctx);

      // Assert
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledTimes(1);
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log_test_1',
          timestamp: expect.any(Number),
          type: 'item',
        })
      );
    });

    it('事件日志记录：trap 死亡时不记录日志', async () => {
      // Arrange
      mocks.characterStore.hp = 0;
      vi.mocked(generateTrapDamage).mockReturnValue(100);
      const ctx = makeCellContext({
        cell: makeCell({ type: 'trap' }),
      });

      // Act
      await cellEventHandlers.trap!(ctx);

      // Assert
      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
    });

    it('事件日志记录：rest 营地使用时记录日志', async () => {
      // Arrange
      vi.mocked(generateCampHeal).mockReturnValue({ hp: 100, mana: 100 });
      const ctx = makeCellContext({
        cell: makeCell({ type: 'rest' }),
        campUsed: false,
      });

      // Act
      await cellEventHandlers.rest!(ctx);

      // Assert
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledTimes(1);
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'exploration' })
      );
    });
  });
});
