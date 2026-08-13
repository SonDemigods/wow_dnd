/**
 * @fileoverview 术士灵魂碎片资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 5、整数型）
 * 2. generate 按来源差异化（仅 skill 生成，attack/turn/damaged/kill 不生成）
 * 3. reset 恢复到 0
 * 4. consume 正常工作（召唤消耗）
 * 5. 累加不超过 maxValue=5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SoulShardSystem } from '@/modules/combat/resources/SoulShardSystem';

describe('SoulShardSystem 术士灵魂碎片', () => {
  let shard: SoulShardSystem;

  beforeEach(() => {
    shard = new SoulShardSystem(0);
  });

  it('默认配置：maxValue=5, initialValue=0, isInteger=true', () => {
    expect(shard.type).toBe('soul_shard');
    expect(shard.maxValue).toBe(5);
    expect(shard.currentValue).toBe(0);
    expect(shard.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 5', () => {
      shard.generate(10, 'skill');
      expect(shard.currentValue).toBe(5);
    });

    it('attack 来源不生成', () => {
      shard.generate(10, 'attack');
      expect(shard.currentValue).toBe(0);
    });

    it('turn 来源不生成', () => {
      shard.generate(10, 'turn');
      expect(shard.currentValue).toBe(0);
    });

    it('damaged 来源不生成', () => {
      shard.generate(10, 'damaged');
      expect(shard.currentValue).toBe(0);
    });

    it('kill 来源不生成', () => {
      shard.generate(10, 'kill');
      expect(shard.currentValue).toBe(0);
    });

    it('累加不超过 maxValue=5', () => {
      shard.generate(2, 'skill'); // 2
      shard.generate(2, 'skill'); // 4
      shard.generate(2, 'skill'); // 5（裁剪到上限）
      expect(shard.currentValue).toBe(5);
    });
  });

  it('reset 恢复到 0', () => {
    shard.generate(10, 'skill');
    shard.reset();
    expect(shard.currentValue).toBe(0);
  });

  it('consume 正常工作（召唤消耗）', () => {
    const s = new SoulShardSystem(3);
    expect(s.consume(2)).toBe(true);
    expect(s.currentValue).toBe(1);
  });
});
