/**
 * @fileoverview 冒险日志模块纯逻辑辅助函数
 * @description 提供日志 ID 生成、消息格式化等纯函数，不含状态和副作用
 * @module log
 */
import type { LogEntry, LogType } from './types';

/** 日志类型默认图标映射 */
const LOG_TYPE_ICONS: Record<LogType, string> = {
  info: 'game-icons:info',
  combat: 'game-icons:crossed-swords',
  quest: 'game-icons:notebook',
  item: 'game-icons:chest',
  level: 'game-icons:upgrade',
  death: 'game-icons:death-skull',
  resurrect: 'game-icons:regeneration',
  shop: 'game-icons:shopping-cart',
  skill: 'game-icons:sparkles',
  exploration: 'game-icons:treasure-map',
  zone: 'game-icons:treasure-map'
};

/**
 * 生成唯一的日志ID
 * @returns 基于时间戳和随机字符串的唯一ID
 */
export function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化日志条目 —— 为缺少图标的条目自动分配默认图标
 * @param entry - 原始日志条目
 * @returns 补全图标后的日志条目（新对象，不修改原对象）
 */
export function formatLogMessage(entry: LogEntry): LogEntry {
  return {
    ...entry,
    icon: entry.icon || LOG_TYPE_ICONS[entry.type]
  };
}
