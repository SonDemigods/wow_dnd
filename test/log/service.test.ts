/**
 * @fileoverview 冒险日志模块服务函数单元测试
 * @description 测试日志 ID 生成、消息格式化、默认图标补全等纯函数
 */
import { describe, it, expect } from 'vitest';
import { LOG_TYPE_ICONS, generateLogId, formatLogMessage } from '@/modules/log/service';
import type { LogEntry, LogType } from '@/modules/log/types';

/** 创建测试用日志条目 */
function makeLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log_001',
    timestamp: Date.now(),
    type: 'info',
    message: '测试日志',
    ...overrides
  };
}

describe('LOG_TYPE_ICONS', () => {
  it('包含所有日志类型的图标映射', () => {
    const expectedTypes: LogType[] = [
      'info', 'combat', 'quest', 'item', 'level', 'death',
      'resurrect', 'shop', 'skill', 'exploration', 'zone'
    ];
    for (const type of expectedTypes) {
      expect(LOG_TYPE_ICONS[type]).toBeTruthy();
      expect(typeof LOG_TYPE_ICONS[type]).toBe('string');
    }
  });

  it('info 类型映射为 game-icons:info', () => {
    expect(LOG_TYPE_ICONS.info).toBe('game-icons:info');
  });

  it('combat 类型映射为 game-icons:crossed-swords', () => {
    expect(LOG_TYPE_ICONS.combat).toBe('game-icons:crossed-swords');
  });

  it('death 类型映射为 game-icons:death-skull', () => {
    expect(LOG_TYPE_ICONS.death).toBe('game-icons:death-skull');
  });

  it('shop 类型映射为 game-icons:shopping-cart', () => {
    expect(LOG_TYPE_ICONS.shop).toBe('game-icons:shopping-cart');
  });

  it('level 类型映射为 game-icons:upgrade', () => {
    expect(LOG_TYPE_ICONS.level).toBe('game-icons:upgrade');
  });

  it('zone 类型映射为 game-icons:entry-door', () => {
    expect(LOG_TYPE_ICONS.zone).toBe('game-icons:entry-door');
  });
});

describe('generateLogId', () => {
  it('生成的 ID 以 log_ 开头', () => {
    const id = generateLogId();
    expect(id.startsWith('log_')).toBe(true);
  });

  it('每次调用生成不同的 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      ids.add(generateLogId());
    }
    expect(ids.size).toBe(10);
  });

  it('ID 格式为 log_时间戳_随机串', () => {
    const id = generateLogId();
    expect(id).toMatch(/^log_\d+_[a-z0-9]+$/);
  });
});

describe('formatLogMessage', () => {
  it('已有图标时保留原图标', () => {
    const entry = makeLogEntry({ icon: 'custom-icon' });
    const result = formatLogMessage(entry);
    expect(result.icon).toBe('custom-icon');
  });

  it('无图标时按类型补全默认图标', () => {
    const entry = makeLogEntry({ type: 'combat', icon: undefined });
    const result = formatLogMessage(entry);
    expect(result.icon).toBe(LOG_TYPE_ICONS.combat);
  });

  it('空字符串图标时补全默认图标', () => {
    const entry = makeLogEntry({ type: 'info', icon: '' });
    const result = formatLogMessage(entry);
    expect(result.icon).toBe(LOG_TYPE_ICONS.info);
  });

  it('不修改原对象', () => {
    const entry = makeLogEntry({ icon: undefined });
    const result = formatLogMessage(entry);
    expect(entry.icon).toBeUndefined();
    expect(result.icon).toBeTruthy();
  });

  it('保留其他字段不变', () => {
    const entry = makeLogEntry({
      id: 'log_123',
      timestamp: 1234567890,
      type: 'level',
      message: '升级了'
    });
    const result = formatLogMessage(entry);
    expect(result.id).toBe('log_123');
    expect(result.timestamp).toBe(1234567890);
    expect(result.type).toBe('level');
    expect(result.message).toBe('升级了');
  });

  it('为每种日志类型补全对应图标', () => {
    const types: LogType[] = [
      'info', 'combat', 'quest', 'item', 'level', 'death',
      'resurrect', 'shop', 'skill', 'exploration', 'zone'
    ];
    for (const type of types) {
      const entry = makeLogEntry({ type, icon: undefined });
      const result = formatLogMessage(entry);
      expect(result.icon).toBe(LOG_TYPE_ICONS[type]);
    }
  });

  it('返回新对象（非原对象引用）', () => {
    const entry = makeLogEntry({ icon: 'custom' });
    const result = formatLogMessage(entry);
    expect(result).not.toBe(entry);
  });
});
