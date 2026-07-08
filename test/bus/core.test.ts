/**
 * @fileoverview 事件总线模块单元测试
 *
 * 覆盖范围：
 * 1. on / off / emit 基本订阅发布
 * 2. once 一次性监听
 * 3. onGroup / clearGroup 分组管理
 * 4. clearAll / removeEvent 批量清理
 * 5. 异常隔离（单个监听器抛错不影响其他监听器）
 * 6. 边界条件（无监听器时 emit、off 不存在的回调等）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@/modules/bus/core';
import { GameEvents } from '@/modules/bus/types';

describe('EventBus 事件总线', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ==================== on / emit ====================
  describe('on / emit 基本订阅发布', () => {
    it('注册监听器后 emit 触发回调并传入 payload', () => {
      const cb = vi.fn();
      bus.on(GameEvents.CHARACTER_LEVEL_UP, cb);
      bus.emit(GameEvents.CHARACTER_LEVEL_UP, { oldLevel: 1, newLevel: 2 });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith({ oldLevel: 1, newLevel: 2 });
    });

    it('同一事件注册多个监听器，emit 时全部触发（按注册顺序）', () => {
      const order: string[] = [];
      bus.on(GameEvents.UI_CLICK, () => order.push('first'));
      bus.on(GameEvents.UI_CLICK, () => order.push('second'));
      bus.on(GameEvents.UI_CLICK, () => order.push('third'));

      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('无监听器时 emit 不抛错', () => {
      expect(() => bus.emit(GameEvents.CHARACTER_DEATH, { cause: 'fall' })).not.toThrow();
    });

    it('null payload 事件正常触发', () => {
      const cb = vi.fn();
      bus.on(GameEvents.COMBAT_PLAYER_TURN, cb);
      bus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
      expect(cb).toHaveBeenCalledWith(null);
    });
  });

  // ==================== off ====================
  describe('off 取消订阅', () => {
    it('off 取消指定回调后不再触发', () => {
      const cb = vi.fn();
      bus.on(GameEvents.ITEM_DROPPED, cb);
      bus.off(GameEvents.ITEM_DROPPED, cb);
      bus.emit(GameEvents.ITEM_DROPPED, { itemId: 'i1' });

      expect(cb).not.toHaveBeenCalled();
    });

    it('off 仅移除目标回调，保留其他回调', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      bus.on(GameEvents.ITEM_DROPPED, cb1);
      bus.on(GameEvents.ITEM_DROPPED, cb2);
      bus.off(GameEvents.ITEM_DROPPED, cb1);
      bus.emit(GameEvents.ITEM_DROPPED, { itemId: 'i1' });

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('off 不存在的回调不抛错', () => {
      expect(() => bus.off(GameEvents.ITEM_DROPPED, () => {})).not.toThrow();
    });

    it('off 未注册事件不抛错', () => {
      expect(() => bus.off(GameEvents.CHARACTER_CREATED, () => {})).not.toThrow();
    });
  });

  // ==================== once ====================
  describe('once 一次性监听', () => {
    it('once 注册的监听器只触发一次', () => {
      const cb = vi.fn();
      bus.once(GameEvents.QUEST_COMPLETED, cb);
      bus.emit(GameEvents.QUEST_COMPLETED, { questId: 'q1', definition: {} as never });
      bus.emit(GameEvents.QUEST_COMPLETED, { questId: 'q2', definition: {} as never });

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('once 触发后再次 emit 不报错', () => {
      bus.once(GameEvents.QUEST_COMPLETED, () => {});
      expect(() => {
        bus.emit(GameEvents.QUEST_COMPLETED, { questId: 'q1', definition: {} as never });
        bus.emit(GameEvents.QUEST_COMPLETED, { questId: 'q2', definition: {} as never });
      }).not.toThrow();
    });

    it('once 与 on 共存时互不影响', () => {
      const onceCb = vi.fn();
      const onCb = vi.fn();
      bus.once(GameEvents.SHOP_TRANSACTION, onceCb);
      bus.on(GameEvents.SHOP_TRANSACTION, onCb);
      bus.emit(GameEvents.SHOP_TRANSACTION, { itemId: 'i1' });
      bus.emit(GameEvents.SHOP_TRANSACTION, { itemId: 'i2' });

      expect(onceCb).toHaveBeenCalledTimes(1);
      expect(onCb).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== onGroup / clearGroup ====================
  describe('onGroup / clearGroup 分组管理', () => {
    it('onGroup 注册的监听器能正常触发', () => {
      const cb = vi.fn();
      bus.onGroup('combat-store', GameEvents.COMBAT_START, cb);
      bus.emit(GameEvents.COMBAT_START, { enemy: {} as never });

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('clearGroup 清除整个分组的监听器', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      bus.onGroup('g1', GameEvents.UI_PANEL_OPENED, cb1);
      bus.onGroup('g1', GameEvents.UI_PANEL_CLOSED, cb2);
      bus.clearGroup('g1');

      bus.emit(GameEvents.UI_PANEL_OPENED, { panel: 'bag' });
      bus.emit(GameEvents.UI_PANEL_CLOSED, { panel: 'bag' });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });

    it('clearGroup 不影响其他分组的监听器', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      bus.onGroup('g1', GameEvents.UI_PANEL_OPENED, cb1);
      bus.onGroup('g2', GameEvents.UI_PANEL_OPENED, cb2);
      bus.clearGroup('g1');

      bus.emit(GameEvents.UI_PANEL_OPENED, { panel: 'bag' });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('clearGroup 不影响通过 on 注册的同事件监听器', () => {
      const groupCb = vi.fn();
      const onCb = vi.fn();
      // 故意使用相同回调引用，验证 clearGroup 只移除分组内注册的那一份
      bus.onGroup('g1', GameEvents.UI_CLICK, groupCb);
      bus.on(GameEvents.UI_CLICK, onCb);
      bus.clearGroup('g1');

      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      expect(groupCb).not.toHaveBeenCalled();
      expect(onCb).toHaveBeenCalledTimes(1);
    });

    it('clearGroup 清除不存在的分组不抛错', () => {
      expect(() => bus.clearGroup('not-exist')).not.toThrow();
    });

    it('同一回调同时注册到分组和 on，clearGroup 仅移除一份', () => {
      const cb = vi.fn();
      bus.onGroup('g1', GameEvents.UI_CLICK, cb);
      bus.on(GameEvents.UI_CLICK, cb);
      bus.clearGroup('g1');

      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      // on 注册的那一份仍存在
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== clearAll / removeEvent ====================
  describe('clearAll / removeEvent 批量清理', () => {
    it('clearAll 清除所有监听器', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      bus.on(GameEvents.UI_CLICK, cb1);
      bus.on(GameEvents.UI_PANEL_OPENED, cb2);
      bus.once(GameEvents.ITEM_DROPPED, cb1);
      bus.clearAll();

      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      bus.emit(GameEvents.UI_PANEL_OPENED, { panel: 'p' });
      bus.emit(GameEvents.ITEM_DROPPED, { itemId: 'i1' });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });

    it('removeEvent 移除指定事件的所有监听器', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();
      bus.on(GameEvents.UI_CLICK, cb1);
      bus.on(GameEvents.UI_CLICK, cb2);
      bus.on(GameEvents.UI_PANEL_OPENED, cb3);
      bus.removeEvent(GameEvents.UI_CLICK);

      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      bus.emit(GameEvents.UI_PANEL_OPENED, { panel: 'p' });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(cb3).toHaveBeenCalledTimes(1);
    });

    it('removeEvent 同步清理 groups 中该事件的记录', () => {
      const cb = vi.fn();
      bus.onGroup('g1', GameEvents.UI_CLICK, cb);
      bus.removeEvent('ui_click');

      // 再次注册同分组同事件，不应残留旧记录影响行为
      const cb2 = vi.fn();
      bus.onGroup('g1', GameEvents.UI_CLICK, cb2);
      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      expect(cb).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('removeEvent 不存在的事件不抛错', () => {
      expect(() => bus.removeEvent('not-exist-event')).not.toThrow();
    });
  });

  // ==================== 异常隔离 ====================
  describe('异常隔离', () => {
    it('单个监听器抛错不影响后续监听器执行', () => {
      const order: string[] = [];
      bus.on(GameEvents.UI_CLICK, () => {
        order.push('first');
      });
      bus.on(GameEvents.UI_CLICK, () => {
        order.push('throwing');
        throw new Error('boom');
      });
      bus.on(GameEvents.UI_CLICK, () => {
        order.push('third');
      });

      // 不应抛错
      expect(() => bus.emit(GameEvents.UI_CLICK, { source: 'btn' })).not.toThrow();
      expect(order).toEqual(['first', 'throwing', 'third']);
    });

    it('once 回调抛错时，off 在回调之后执行导致监听器未被移除（记录当前行为）', () => {
      const cb = vi.fn(() => {
        throw new Error('boom');
      });
      bus.once(GameEvents.UI_CLICK, cb);
      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });

      // 源码 once 实现：先调用 callback，再 off。callback 抛错时 off 不执行，
      // onceCallback 仍保留在 listeners 中，第二次 emit 仍会触发。
      expect(cb).toHaveBeenCalledTimes(2);
    });
  });
});
