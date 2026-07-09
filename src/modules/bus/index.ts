/**
 * @fileoverview 事件总线模块统一导出入口
 * @description 导出事件总线模块的所有核心类型、枚举和实例
 * @module bus
 */

export type {
  EventCallback,
  GameEventPayloadMap,
  IEventBus,
  EventListeners,
  GroupListeners
} from './types';

export { GameEvents } from './types';

export { EventBus, eventBus } from './core';
