/**
 * @fileoverview 术士灵魂碎片资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 1、上限 5、整数型）
 * 2. generate 按来源差异化（skill=1/kill=1 生成，attack/turn/damaged 不生成）
 * 3. 事件钩子 onKill 生成 1 碎片
 * 4. reset 恢复到 1
 * 5. consume 正常工作（召唤消耗）
 * 6. 累加不超过 maxValue=5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SoulShardSystem } from '@/modules/combat/resources/SoulShardSystem';

describe('SoulShardSystem 术士灵魂碎片', () => {
  let shard: SoulShardSystem;

  beforeEach(() => {
    shard = new SoulShardSystem(1);
  });

  it('默认配置：maxValue=5, initialValue=1, isInteger=true', () => {
    expect(shard.type).toBe('soul_shard');
    expect(shard.maxValue).toBe(5);
    expect(shard.currentValue).toBe(1);
    expect(shard.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 1', () => {
      shard.generate(10, 'skill');
      expect(shard.currentValue).toBe(2); // 1 + 1
    });

    it('kill 来源上限 1', () => {
      shard.generate(10, 'kill');
      expect(shard.currentValue).toBe(2); // 1 + 1
    });

    it('attack 来源不生成', () => {
      shard.generate(10, 'attack');
      expect(shard.currentValue).toBe(1);
    });

    it('turn 来源不生成', () => {
      shard.generate(10, 'turn');
      expect(shard.currentValue).toBe(1);
    });

    it('damaged 来源不生成', () => {
      shard.generate(10, 'damaged');
      expect(shard.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      shard.generate(10, 'skill'); // 2
      shard.generate(10, 'skill'); // 3
      shard.generate(10, 'skill'); // 4
      shard.generate(10, 'skill'); // 5
      shard.generate(10, 'skill'); // 5（上限）
      expect(shard.currentValue).toBe(5);
    });
  });

  it('onKill 生成 1 碎片', () => {
    shard.onKill();
    expect(shard.currentValue).toBe(2);
  });

  it('reset 恢复到 1', () => {
    shard.generate(10, 'skill');
    shard.reset();
    expect(shard.currentValue).toBe(1);
  });

  it('consume 正常工作（召唤消耗）', () => {
    const s = new SoulShardSystem(3);
    expect(s.consume(2)).toBe(true);
    expect(s.currentValue).toBe(1);
  });
});
