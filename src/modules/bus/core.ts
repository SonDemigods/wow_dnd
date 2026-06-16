/**
 * 事件总线模块
 * 
 * 提供游戏内事件的发布/订阅机制，用于组件间的解耦通信。
 * 使用单例模式，通过 eventBus 实例对外提供服务。
 * 支持事件分组管理，便于模块级的批量注册与清理。
 */

import type { EventCallback, GameEventPayloadMap, EventListeners, GroupListeners } from './types';
export { GameEvents } from './types';

/**
 * 事件总线类
 * 
 * 实现了发布/订阅模式，支持事件的注册、取消注册、触发等操作。
 * 支持一次性事件监听（once）、分组管理（onGroup/clearGroup）和批量清除（clearAll）。
 */
export class EventBus {
  /** 事件监听器映射表 */
  private listeners: EventListeners = {};

  /** 分组监听器记录 */
  private groups: GroupListeners = {};

  /**
   * 注册事件监听器
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * 取消事件监听器
   * @param event - 事件名称
   * @param callback - 要取消的回调函数
   */
  off(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * 触发事件
   * @param event - 事件名称
   * @param data - 事件载荷
   */
  emit<K extends keyof GameEventPayloadMap>(event: K, data: GameEventPayloadMap[K]): void {
    if (!this.listeners[event]) return;
    for (const callback of this.listeners[event]) {
      try {
        callback(data);
      } catch (e) {
        console.error(`[EventBus] Error in listener for "${event}":`, e);
      }
    }
  }

  /**
   * 注册一次性事件监听器
   * 
   * 事件触发一次后自动取消注册
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  /**
   * 按分组注册事件监听器
   * 
   * 便于模块级批量管理，可通过 clearGroup 一次性清除整个分组的监听器。
   * @param groupName - 分组名称（如 store 名称）
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  onGroup(groupName: string, event: string, callback: EventCallback): void {
    if (!this.groups[groupName]) {
      this.groups[groupName] = [];
    }
    this.groups[groupName].push({ event, callback });
    this.on(event, callback);
  }

  /**
   * 清除指定分组的所有事件监听器
   * @param groupName - 分组名称
   */
  clearGroup(groupName: string): void {
    const groupListeners = this.groups[groupName];
    if (!groupListeners) return;

    for (const { event, callback } of groupListeners) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        if (this.listeners[event].length === 0) {
          delete this.listeners[event];
        }
      }
    }
    delete this.groups[groupName];
  }

  /**
   * 清除所有事件监听器
   */
  clearAll(): void {
    this.listeners = {};
    this.groups = {};
  }

  /**
   * 移除指定事件的所有监听器
   * @param event - 事件名称
   */
  removeEvent(event: string): void {
    delete this.listeners[event];
  }
}

/**
 * 事件总线实例
 * 
 * 游戏全局唯一的事件总线，用于组件间通信
 */
export const eventBus = new EventBus();