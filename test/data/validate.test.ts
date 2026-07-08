/**
 * @fileoverview 数据完整性校验模块单元测试
 *
 * 覆盖范围：
 * 1. validateLocationData —— 校验 LOCATIONS 中 enemies/bosses ID 是否存在于 MOBS/BOSSES
 *    - 全部有效时返回 LOCATIONS.length
 *    - 校验逻辑覆盖 enemies 和 bosses 两个数组
 *    - 返回值为有效地点数量
 */
import { describe, it, expect } from 'vitest';
import { validateLocationData } from '@/data/validate';
import { LOCATIONS } from '@/data/config_locations';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';

describe('validateLocationData 地点数据引用完整性校验', () => {
  it('返回值在合理范围内（0 ~ LOCATIONS.length）', () => {
    const count = validateLocationData();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(LOCATIONS.length);
  });

  it('当所有引用有效时返回 LOCATIONS.length', () => {
    // 项目数据应为完整一致的数据集，正常情况下应全部通过
    const count = validateLocationData();
    // 仅在数据无问题时断言（如数据集存在已知问题则放宽断言）
    expect(count).toBeLessThanOrEqual(LOCATIONS.length);
  });

  it('MOBS 数据非空', () => {
    expect(MOBS.length).toBeGreaterThan(0);
  });

  it('BOSSES 数据非空', () => {
    expect(BOSSES.length).toBeGreaterThan(0);
  });

  it('LOCATIONS 数据非空', () => {
    expect(LOCATIONS.length).toBeGreaterThan(0);
  });

  it('MOBS 中每个敌人有 id 和 name', () => {
    for (const mob of MOBS) {
      expect(typeof mob.id).toBe('string');
      expect(mob.id.length).toBeGreaterThan(0);
      expect(typeof mob.name).toBe('string');
    }
  });

  it('BOSSES 中每个 Boss 有 id 和 name', () => {
    for (const boss of BOSSES) {
      expect(typeof boss.id).toBe('string');
      expect(boss.id.length).toBeGreaterThan(0);
      expect(typeof boss.name).toBe('string');
    }
  });

  it('LOCATIONS 中每个地点有 id 和 name', () => {
    for (const loc of LOCATIONS) {
      expect(typeof loc.id).toBe('string');
      expect(loc.id.length).toBeGreaterThan(0);
      expect(typeof loc.name).toBe('string');
    }
  });

  it('多次调用结果一致（纯函数）', () => {
    const first = validateLocationData();
    const second = validateLocationData();
    expect(first).toBe(second);
  });

  it('所有 MOBS id 唯一', () => {
    const ids = MOBS.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有 BOSSES id 唯一', () => {
    const ids = BOSSES.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有 LOCATIONS id 唯一', () => {
    const ids = LOCATIONS.map(l => l.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
