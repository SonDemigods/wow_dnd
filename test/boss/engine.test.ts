/**
 * @fileoverview Boss 战斗引擎单元测试
 * @description 测试机制执行器注册表、阶段机制处理、属性乘数应用等行为
 */
import { describe, it, expect } from 'vitest';
import { executeBossMechanic, processBossPhaseMechanics, applyPhaseStats } from '@/modules/boss/engine';
import type { BossMechanic, BossPhase } from '@/modules/boss/types';
import type { EnemyInstance } from '@/modules/enemy/types';

/** 创建测试用 Boss 运行时实例 */
function makeBoss(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'boss_001',
    dataId: 'boss_001',
    name: '测试Boss',
    icon: 'game-icons:dragon',
    level: 10,
    hp: 1000,
    maxHp: 1000,
    damage: [20, 40],
    xp: 500,
    gold: 300,
    dangerLevel: '致命',
    isBoss: true,
    physicalAttack: 50,
    physicalDefense: 20,
    magicAttack: 30,
    magicDefense: 15,
    stats: { str: 40, dex: 8, con: 300, int: 24, wis: 18, cha: 5 },
    expReward: 500,
    goldReward: 300,
    ...overrides
  };
}

/** 创建测试用机制配置 */
function makeMechanic(overrides: Partial<BossMechanic> = {}): BossMechanic {
  return {
    type: 'enrage',
    intervalTurns: 1,
    ...overrides
  };
}

describe('executeBossMechanic', () => {
  describe('触发间隔判断', () => {
    it('未到触发间隔时返回 false', () => {
      const boss = makeBoss();
      const mechanic = makeMechanic({ intervalTurns: 3, lastTriggerTurn: 1 });
      expect(executeBossMechanic(boss, mechanic, 2)).toBe(false);
      expect(mechanic.lastTriggerTurn).toBe(1); // 未更新
    });

    it('到达触发间隔时返回 true', () => {
      const boss = makeBoss();
      const mechanic = makeMechanic({ intervalTurns: 3, lastTriggerTurn: 1 });
      expect(executeBossMechanic(boss, mechanic, 4)).toBe(true);
      expect(mechanic.lastTriggerTurn).toBe(4);
    });

    it('首次触发（无 lastTriggerTurn）时返回 true', () => {
      const boss = makeBoss();
      const mechanic = makeMechanic({ intervalTurns: 2 });
      expect(executeBossMechanic(boss, mechanic, 1)).toBe(true);
      expect(mechanic.lastTriggerTurn).toBe(1);
    });

    it('间隔为 1 时每回合都可触发', () => {
      const boss = makeBoss();
      const mechanic = makeMechanic({ intervalTurns: 1, lastTriggerTurn: 5 });
      expect(executeBossMechanic(boss, mechanic, 6)).toBe(true);
    });
  });

  // ---- 属性与防御类执行器 ----
  describe('enrage 狂暴', () => {
    it('按默认 1.5 倍率提升物理攻击力', () => {
      const boss = makeBoss({ physicalAttack: 100 });
      executeBossMechanic(boss, makeMechanic({ type: 'enrage' }), 1);
      expect(boss.physicalAttack).toBe(150);
    });

    it('按 attackMultiplier 参数提升物理攻击力', () => {
      const boss = makeBoss({ physicalAttack: 100 });
      executeBossMechanic(boss, makeMechanic({
        type: 'enrage',
        params: { attackMultiplier: 2 }
      }), 1);
      expect(boss.physicalAttack).toBe(200);
    });

    it('physicalAttack 为 undefined 时使用默认值 10', () => {
      const boss = makeBoss({ physicalAttack: undefined });
      executeBossMechanic(boss, makeMechanic({ type: 'enrage' }), 1);
      expect(boss.physicalAttack).toBe(15); // round(10 * 1.5)
    });
  });

  describe('damage_shield 伤害护盾', () => {
    it('按默认值 30 添加护盾', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'damage_shield' }), 1);
      expect((boss as any).shield).toBe(30);
    });

    it('按 shieldAmount 参数添加护盾', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({
        type: 'damage_shield',
        params: { shieldAmount: 50 }
      }), 1);
      expect((boss as any).shield).toBe(50);
    });

    it('多次施放叠加护盾值', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'damage_shield', params: { shieldAmount: 30 } }), 1);
      executeBossMechanic(boss, makeMechanic({ type: 'damage_shield', params: { shieldAmount: 20 } }), 2);
      expect((boss as any).shield).toBe(50);
    });
  });

  describe('reflect_damage 反弹伤害', () => {
    it('按默认值 0.2 设置反弹比例', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'reflect_damage' }), 1);
      expect((boss as any).reflectDamage).toBe(0.2);
    });

    it('按 reflectPercent 参数设置反弹比例', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({
        type: 'reflect_damage',
        params: { reflectPercent: 0.5 }
      }), 1);
      expect((boss as any).reflectDamage).toBe(0.5);
    });
  });

  describe('标记类防御机制', () => {
    it('invulnerable 设置 invulnerable 标记为 true', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'invulnerable' }), 1);
      expect((boss as any).invulnerable).toBe(true);
    });

    it('revive 设置 canRevive 标记为 true', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'revive' }), 1);
      expect((boss as any).canRevive).toBe(true);
    });

    it('counter_stance 设置 counterStance 标记为 true', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'counter_stance' }), 1);
      expect((boss as any).counterStance).toBe(true);
    });
  });

  // ---- 召唤与攻击类执行器 ----
  describe('summon_minions 召唤小怪', () => {
    it('按默认值 1 累加待召唤数量', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'summon_minions' }), 1);
      expect(boss.pendingSummons).toBe(1);
    });

    it('按 count 参数累加待召唤数量', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({
        type: 'summon_minions',
        params: { count: 3 }
      }), 1);
      expect(boss.pendingSummons).toBe(3);
    });

    it('多次施放累加数量', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'summon_minions', params: { count: 2 } }), 1);
      executeBossMechanic(boss, makeMechanic({ type: 'summon_minions', params: { count: 3 } }), 2);
      expect(boss.pendingSummons).toBe(5);
    });
  });

  describe('召唤与攻击标记机制', () => {
    it('summon_elite 设置 pendingEliteSummons 标记为 true', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'summon_elite' }), 1);
      expect((boss as any).pendingEliteSummons).toBe(true);
    });

    it('aoe_attack 设置 aoeNextAttack 标记为 true', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'aoe_attack' }), 1);
      expect(boss.aoeNextAttack).toBe(true);
    });

    it('charge_attack 设置 charging 标记为 true', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'charge_attack' }), 1);
      expect((boss as any).charging).toBe(true);
    });
  });

  // ---- 玩家效果与场景类执行器 ----
  describe('debuff_aura 减益光环', () => {
    it('使用默认类型 attack_down', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'debuff_aura' }), 1);
      expect((boss as any).debuffAura).toBe('attack_down');
    });

    it('按 debuffType 参数设置光环类型', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({
        type: 'debuff_aura',
        params: { debuffType: 'defense_down' }
      }), 1);
      expect((boss as any).debuffAura).toBe('defense_down');
    });
  });

  describe('healing_zone 治疗区域', () => {
    it('按默认值 5 设置每回合回复量', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({ type: 'healing_zone' }), 1);
      expect((boss as any).healingZone).toBe(5);
    });

    it('按 healPerTurn 参数设置回复量', () => {
      const boss = makeBoss();
      executeBossMechanic(boss, makeMechanic({
        type: 'healing_zone',
        params: { healPerTurn: 20 }
      }), 1);
      expect((boss as any).healingZone).toBe(20);
    });
  });

  describe('无副作用标记机制', () => {
    it('stun_player 触发并返回 true', () => {
      const boss = makeBoss();
      expect(executeBossMechanic(boss, makeMechanic({ type: 'stun_player' }), 1)).toBe(true);
    });

    it('silence_player 触发并返回 true', () => {
      const boss = makeBoss();
      expect(executeBossMechanic(boss, makeMechanic({ type: 'silence_player' }), 1)).toBe(true);
    });

    it('arena_hazard 触发并返回 true', () => {
      const boss = makeBoss();
      expect(executeBossMechanic(boss, makeMechanic({ type: 'arena_hazard' }), 1)).toBe(true);
    });

    it('split 触发并返回 true', () => {
      const boss = makeBoss();
      expect(executeBossMechanic(boss, makeMechanic({ type: 'split' }), 1)).toBe(true);
    });

    it('steal_buff 触发并返回 true', () => {
      const boss = makeBoss();
      expect(executeBossMechanic(boss, makeMechanic({ type: 'steal_buff' }), 1)).toBe(true);
    });
  });
});

describe('processBossPhaseMechanics', () => {
  it('遍历阶段所有机制并返回触发的类型列表', () => {
    const boss = makeBoss();
    const phase: BossPhase = {
      hpThreshold: 1.0,
      name: '阶段1',
      dialogue: [],
      aiStrategy: 'balanced',
      mechanics: [
        { type: 'enrage', intervalTurns: 1 },
        { type: 'damage_shield', intervalTurns: 1 }
      ]
    };
    const triggered = processBossPhaseMechanics(boss, phase, 1);
    expect(triggered).toEqual(['enrage', 'damage_shield']);
  });

  it('未到间隔的机制不触发', () => {
    const boss = makeBoss();
    const phase: BossPhase = {
      hpThreshold: 1.0,
      name: '阶段1',
      dialogue: [],
      aiStrategy: 'balanced',
      mechanics: [
        { type: 'enrage', intervalTurns: 3, lastTriggerTurn: 1 }
      ]
    };
    const triggered = processBossPhaseMechanics(boss, phase, 2);
    expect(triggered).toEqual([]);
  });

  it('部分机制触发时只返回触发的类型', () => {
    const boss = makeBoss();
    const phase: BossPhase = {
      hpThreshold: 1.0,
      name: '阶段1',
      dialogue: [],
      aiStrategy: 'balanced',
      mechanics: [
        { type: 'enrage', intervalTurns: 1 },
        { type: 'damage_shield', intervalTurns: 5, lastTriggerTurn: 1 }
      ]
    };
    const triggered = processBossPhaseMechanics(boss, phase, 2);
    expect(triggered).toEqual(['enrage']);
  });

  it('空机制列表返回空数组', () => {
    const boss = makeBoss();
    const phase: BossPhase = {
      hpThreshold: 1.0,
      name: '阶段1',
      dialogue: [],
      aiStrategy: 'balanced',
      mechanics: []
    };
    expect(processBossPhaseMechanics(boss, phase, 1)).toEqual([]);
  });

  it('实际执行机制并修改 Boss 状态', () => {
    const boss = makeBoss({ physicalAttack: 100 });
    const phase: BossPhase = {
      hpThreshold: 1.0,
      name: '阶段1',
      dialogue: [],
      aiStrategy: 'balanced',
      mechanics: [{ type: 'enrage', intervalTurns: 1 }]
    };
    processBossPhaseMechanics(boss, phase, 1);
    expect(boss.physicalAttack).toBe(150); // 100 * 1.5
  });
});

describe('applyPhaseStats', () => {
  it('未配置 statMultipliers 时不修改属性', () => {
    const boss = makeBoss({ physicalAttack: 100 });
    const phase: BossPhase = {
      hpThreshold: 1.0, name: 'P1', dialogue: [], aiStrategy: 'balanced', mechanics: []
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalAttack).toBe(100);
  });

  it('应用 physicalAttack 乘数', () => {
    const boss = makeBoss({ physicalAttack: 100 });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { physicalAttack: 1.5 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalAttack).toBe(150);
  });

  it('应用 magicAttack 乘数', () => {
    const boss = makeBoss({ magicAttack: 50 });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { magicAttack: 2 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.magicAttack).toBe(100);
  });

  it('应用 physicalDefense 乘数', () => {
    const boss = makeBoss({ physicalDefense: 40 });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { physicalDefense: 1.5 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalDefense).toBe(60);
  });

  it('应用 magicDefense 乘数（已配置时）', () => {
    const boss = makeBoss({ magicDefense: 20 });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { magicDefense: 2 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.magicDefense).toBe(40);
  });

  it('magicDefense 为 undefined 时不修改', () => {
    const boss = makeBoss({ magicDefense: undefined });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { magicDefense: 2 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.magicDefense).toBeUndefined();
  });

  it('physicalAttack 为 undefined 时使用默认值 10', () => {
    const boss = makeBoss({ physicalAttack: undefined });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { physicalAttack: 2 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalAttack).toBe(20); // round(10 * 2)
  });

  it('physicalDefense 为 undefined 时使用默认值 5', () => {
    const boss = makeBoss({ physicalDefense: undefined });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { physicalDefense: 3 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalDefense).toBe(15); // round(5 * 3)
  });

  it('magicAttack 为 undefined 时使用默认值 10', () => {
    const boss = makeBoss({ magicAttack: undefined });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { magicAttack: 2 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.magicAttack).toBe(20); // round(10 * 2)
  });

  it('应用多个乘数', () => {
    const boss = makeBoss({ physicalAttack: 100, physicalDefense: 40 });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { physicalAttack: 1.5, physicalDefense: 2 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalAttack).toBe(150);
    expect(boss.physicalDefense).toBe(80);
  });

  it('结果使用 Math.round 取整', () => {
    const boss = makeBoss({ physicalAttack: 101 });
    const phase: BossPhase = {
      hpThreshold: 0.5, name: 'P2', dialogue: [], aiStrategy: 'aggressive', mechanics: [],
      statMultipliers: { physicalAttack: 1.5 }
    };
    applyPhaseStats(boss, phase);
    expect(boss.physicalAttack).toBe(152); // round(101 * 1.5) = round(151.5) = 152
  });
});
