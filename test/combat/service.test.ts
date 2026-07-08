/**
 * @fileoverview 战斗模块 service 核心纯函数单元测试
 *
 * 覆盖范围：
 * 1. rollCritical —— 暴击判定（随机数边界）
 * 2. rollDodge —— 闪避判定
 * 3. calculateFleeChance —— 逃跑成功率公式
 * 4. rollFleeSuccess —— 逃跑判定
 * 5. generateCombatId / generateBattleLogId —— ID 生成
 * 6. isBossCombat —— Boss 战判定
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
  generateCombatId,
  generateBattleLogId,
  isBossCombat,
} from '@/modules/combat/service';
import type { EnemyInstance } from '@/modules/enemy/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rollCritical 暴击判定', () => {
  it('Math.random 返回值小于 critChance 时暴击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.04);
    expect(rollCritical(0.05)).toBe(true);
  });

  it('Math.random 返回值大于等于 critChance 时不暴击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
    expect(rollCritical(0.05)).toBe(false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(rollCritical(0.05)).toBe(false);
  });

  it('critChance=0 时永远不暴击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(rollCritical(0)).toBe(false);
  });

  it('critChance=1 时永远暴击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(rollCritical(1)).toBe(true);
  });
});

describe('rollDodge 闪避判定', () => {
  it('Math.random 返回值小于 dodgeChance 时闪避', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.02);
    expect(rollDodge(0.03)).toBe(true);
  });

  it('Math.random 返回值大于等于 dodgeChance 时不闪避', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(rollDodge(0.03)).toBe(false);
  });

  it('dodgeChance=0 时永远不闪避', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(rollDodge(0)).toBe(false);
  });
});

describe('calculateFleeChance 逃跑成功率', () => {
  it('基础公式：0.5 + dex * 0.01', () => {
    expect(calculateFleeChance(0)).toBe(0.5);
    expect(calculateFleeChance(10)).toBe(0.6);
    expect(calculateFleeChance(50)).toBe(1.0);
  });

  it('敏捷越高逃跑成功率越高', () => {
    const low = calculateFleeChance(5);
    const high = calculateFleeChance(30);
    expect(high).toBeGreaterThan(low);
  });
});

describe('rollFleeSuccess 逃跑判定', () => {
  it('Math.random 小于成功率时逃跑成功', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    expect(rollFleeSuccess(0.5)).toBe(true);
  });

  it('Math.random 大于等于成功率时逃跑失败', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    expect(rollFleeSuccess(0.5)).toBe(false);
  });
});

describe('generateCombatId / generateBattleLogId ID 生成', () => {
  it('generateCombatId 以 combat_ 为前缀', () => {
    expect(generateCombatId().startsWith('combat_')).toBe(true);
  });

  it('generateBattleLogId 以 log_ 为前缀', () => {
    expect(generateBattleLogId().startsWith('log_')).toBe(true);
  });

  it('多次生成返回不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(generateCombatId());
    }
    expect(ids.size).toBe(50);
  });
});

describe('isBossCombat Boss 战判定', () => {
  it('enemy.isBoss=true 时返回 true', () => {
    const enemy = { isBoss: true } as EnemyInstance;
    expect(isBossCombat(enemy)).toBe(true);
  });

  it('enemy.isBoss=false 时返回 false', () => {
    const enemy = { isBoss: false } as EnemyInstance;
    expect(isBossCombat(enemy)).toBe(false);
  });

  it('enemy.isBoss 为 undefined 时返回 false（Boolean 兜底）', () => {
    const enemy = { isBoss: undefined } as EnemyInstance;
    expect(isBossCombat(enemy)).toBe(false);
  });

  it('enemy.isBoss 为 truthy 字符串时返回 true', () => {
    const enemy = { isBoss: 'yes' as unknown as boolean } as EnemyInstance;
    expect(isBossCombat(enemy)).toBe(true);
  });
});
