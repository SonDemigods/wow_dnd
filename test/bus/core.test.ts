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

    it('listeners[event] 已被删除时 clearGroup 跳过 splice（防御性分支）', () => {
      const cb = vi.fn();
      bus.onGroup('g1', GameEvents.UI_CLICK, cb);
      // 直接删除 listeners[event]，模拟 removeEvent 已清理事件但 group 残留的防御性场景
      delete (bus as unknown as { listeners: Record<string, unknown[]> }).listeners[GameEvents.UI_CLICK];
      expect(() => bus.clearGroup('g1')).not.toThrow();
      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });
      expect(cb).not.toHaveBeenCalled();
    });

    it('callback 已被 off 移除但 group 残留时 clearGroup 跳过 splice（idx === -1）', () => {
      const cb = vi.fn();
      bus.onGroup('g1', GameEvents.UI_CLICK, cb);
      // off 移除 callback，但 group 记录仍保留，indexOf 返回 -1
      bus.off(GameEvents.UI_CLICK, cb);
      expect(() => bus.clearGroup('g1')).not.toThrow();
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

    it('removeEvent 后分组仍保留其他事件的记录（length > 0 不删除分组）', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      bus.onGroup('g1', GameEvents.UI_CLICK, cb1);
      bus.onGroup('g1', GameEvents.UI_PANEL_OPENED, cb2);

      // 移除 ui_click 事件，g1 仍保留 ui_panel_opened 的记录
      bus.removeEvent(GameEvents.UI_CLICK);

      // g1 仍有 ui_panel_opened 的监听器，应正常触发
      bus.emit(GameEvents.UI_PANEL_OPENED, { panel: 'bag' });
      expect(cb2).toHaveBeenCalledTimes(1);
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

    it('once 回调抛错时监听器仍被正确移除（P0 修复：try/finally 保证注销）', () => {
      const cb = vi.fn(() => {
        throw new Error('boom');
      });
      bus.once(GameEvents.UI_CLICK, cb);
      // 第一次 emit：回调抛错，但 finally 块确保 off 被执行
      expect(() => bus.emit(GameEvents.UI_CLICK, { source: 'btn' })).not.toThrow();
      // 第二次 emit：监听器已被移除，回调不应再次触发
      bus.emit(GameEvents.UI_CLICK, { source: 'btn' });

      // 修复后：即使回调抛错，once 语义仍然成立——只触发一次
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
