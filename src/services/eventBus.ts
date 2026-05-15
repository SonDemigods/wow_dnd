/**
 * @fileoverview 事件总线服务
 * @description 模块间通信的核心机制，实现发布/订阅模式
 * @module services/eventBus
 */

/** 事件回调函数类型 */
type EventCallback = (...args: any[]) => void;

/** 事件监听器对象 */
interface EventListener {
  callback: EventCallback;
  once: boolean;
}

/**
 * 事件总线类
 * 实现发布-订阅模式，用于模块间解耦通信
 */
class EventBus {
  /** 事件监听器映射表 */
  private listeners: Map<string, EventListener[]> = new Map();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param callback 事件回调函数
   * @param once 是否只执行一次
   */
  on(event: string, callback: EventCallback, once: boolean = false): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push({ callback, once });
  }

  /**
   * 订阅一次性事件
   * @param event 事件名称
   * @param callback 事件回调函数
   */
  once(event: string, callback: EventCallback): void {
    this.on(event, callback, true);
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param callback 要取消的回调函数（不传则取消该事件的所有监听）
   */
  off(event: string, callback?: EventCallback): void {
    if (!this.listeners.has(event)) return;

    if (callback) {
      const listeners = this.listeners.get(event)!;
      this.listeners.set(
        event,
        listeners.filter(listener => listener.callback !== callback)
      );
    } else {
      this.listeners.delete(event);
    }
  }

  /**
   * 发布事件
   * @param event 事件名称
   * @param args 事件参数
   */
  emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return;

    const listeners = this.listeners.get(event)!;
    const toRemove: EventListener[] = [];

    for (const listener of listeners) {
      try {
        listener.callback(...args);
        if (listener.once) {
          toRemove.push(listener);
        }
      } catch (error) {
        console.error(`Event callback error for '${event}':`, error);
      }
    }

    // 清理一次性监听器
    if (toRemove.length > 0) {
      this.listeners.set(
        event,
        listeners.filter(listener => !toRemove.includes(listener))
      );
    }
  }

  /**
   * 清空所有事件监听
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 获取某个事件的监听器数量
   * @param event 事件名称
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

/** 游戏事件枚举 */
export const GameEvents = {
  // 角色相关事件
  CHARACTER_LEVEL_UP: 'character:levelUp',
  CHARACTER_STATS_CHANGE: 'character:statsChange',
  CHARACTER_HP_CHANGE: 'character:hpChange',
  CHARACTER_MP_CHANGE: 'character:mpChange',

  // 背包相关事件
  INVENTORY_ITEM_ADDED: 'inventory:itemAdded',
  INVENTORY_ITEM_REMOVED: 'inventory:itemRemoved',
  INVENTORY_ITEM_USED: 'inventory:itemUsed',
  INVENTORY_UPDATED: 'inventory:updated',

  // 战斗相关事件
  COMBAT_START: 'combat:start',
  COMBAT_END: 'combat:end',
  COMBAT_PLAYER_ATTACK: 'combat:playerAttack',
  COMBAT_ENEMY_ATTACK: 'combat:enemyAttack',
  COMBAT_DAMAGE: 'combat:damage',
  COMBAT_HEAL: 'combat:heal',

  // 技能相关事件
  SKILL_CAST: 'skill:cast',
  SKILL_COOLDOWN: 'skill:cooldown',
  SKILL_READY: 'skill:ready',

  // 任务相关事件
  QUEST_ACCEPTED: 'quest:accepted',
  QUEST_COMPLETED: 'quest:completed',
  QUEST_PROGRESS: 'quest:progress',

  // UI相关事件
  NOTIFICATION: 'ui:notification',
  SHOW_DIALOG: 'ui:showDialog',

  // 系统事件
  GAME_SAVE: 'system:save',
  GAME_LOAD: 'system:load',
} as const;

/** 导出单例实例 */
export const eventBus = new EventBus();
