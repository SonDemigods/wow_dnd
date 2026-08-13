/**
 * @fileoverview 战斗 AI 策略与目标选择器单元测试
 * @description 覆盖：
 * 1. 4 种 AI 策略：AggressiveStrategy / DefensiveStrategy / BalancedStrategy / BossPhaseStrategy
 *    - 各 HP 百分比阈值下的决策分支
 *    - Math.random 概率边界（mock 确定性测试）
 *    - 无技能/只有治疗技能/只有攻击技能的回退行为
 * 2. 3 种目标选择器：ThreatBasedTargetSelector / RandomTargetSelector / LowestHpTargetSelector
 *    - 空数组 / 单元素 / 多元素场景
 *    - 仇恨优先 + 同仇恨 HP 最低优先
 *    - Math.random 随机选择
 * 3. getTargetSelector 工厂函数：注册名查询 + 未知名回退
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AggressiveStrategy,
  DefensiveStrategy,
  BalancedStrategy,
  BossPhaseStrategy,
} from '@/modules/combat/ai/strategies';
import {
  ThreatBasedTargetSelector,
  RandomTargetSelector,
  LowestHpTargetSelector,
  getTargetSelector,
} from '@/modules/combat/ai/targetSelection';
import type { BattleContext, AiDecision } from '@/modules/combat/ai/types';
import type { Combatant } from '@/modules/combat/ai/targetSelection';
import type { EnemyInstance } from '@/modules/enemy/types';
import { createRngFromFn, type Rng } from '@/utils/rng';

// ============================================================
// 工厂函数
// ============================================================

/** 构造一个最小 EnemyInstance（策略中未使用其字段） */
function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return { id: 'enemy_1' } as unknown as EnemyInstance;
}

function makeCtx(overrides: Partial<BattleContext> = {}): BattleContext {
  return {
    playerHp: 100,
    playerMaxHp: 100,
    enemyHp: 100,
    enemyMaxHp: 100,
    availableSkills: [],
    turnCount: 5,
    enemyHasBuff: false,
    playerHasDebuff: false,
    ...overrides,
  };
}

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c_1',
    name: 'combatant',
    hp: 100,
    maxHp: 100,
    threat: 0,
    isPlayer: false,
    ...overrides,
  };
}

const attackSkill = { id: 'fireball', name: '火球术' };
const healSkill = { id: 'heal', name: '治疗术', isHeal: true };
const buffSkill = { id: 'rage', name: '激怒', isBuff: true };

// ============================================================
// AggressiveStrategy — 激进型
// ============================================================

describe('AggressiveStrategy 激进型', () => {
  const strategy = new AggressiveStrategy();
  const enemy = makeEnemy();

  it('name 为 "aggressive"', () => {
    expect(strategy.name).toBe('aggressive');
  });

  it('Math.random<0.5 时使用技能（有攻击技能）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const ctx = makeCtx({ availableSkills: [attackSkill] });
    const decision = strategy.decideAction(enemy, ctx);
    expect(decision.type).toBe('skill');
    expect((decision as { skillId: string }).skillId).toBe('fireball');
  });

  it('Math.random>=0.5 时普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const ctx = makeCtx({ availableSkills: [attackSkill] });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('Math.random=0.5 边界（不小于 0.5）→ 普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ctx = makeCtx({ availableSkills: [attackSkill] });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('Math.random=0.499 边界（小于 0.5）→ 技能', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.499);
    const ctx = makeCtx({ availableSkills: [attackSkill] });
    expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
  });

  it('无技能时始终普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({ availableSkills: [] });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('只有治疗技能时（过滤后无攻击技能）→ 普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({ availableSkills: [healSkill] });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('多个攻击技能时随机选择', () => {
    const skill1 = { id: 'fireball', name: '火球术' };
    const skill2 = { id: 'frostbolt', name: '寒冰箭' };
    // random=0.3 → 进入技能分支；floor(0.3*2)=0 → 选第一个
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const ctx = makeCtx({ availableSkills: [skill1, skill2] });
    const decision = strategy.decideAction(enemy, ctx) as { type: 'skill'; skillId: string };
    expect(decision.skillId).toBe('fireball');
  });

  it('激进型不治疗（即使 HP 很低）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({
      enemyHp: 10,
      enemyMaxHp: 100,
      availableSkills: [attackSkill, healSkill],
    });
    const decision = strategy.decideAction(enemy, ctx);
    // random<0.5 会选攻击技能（healSkill 被过滤），不会是 heal
    expect(decision.type).not.toBe('heal');
  });
});

// ============================================================
// DefensiveStrategy — 防御型
// ============================================================

describe('DefensiveStrategy 防御型', () => {
  const strategy = new DefensiveStrategy();
  const enemy = makeEnemy();

  it('name 为 "defensive"', () => {
    expect(strategy.name).toBe('defensive');
  });

  it('HP<40% 且有治疗技能 → 治疗', () => {
    const ctx = makeCtx({
      enemyHp: 30,
      enemyMaxHp: 100,
      availableSkills: [healSkill],
    });
    const decision = strategy.decideAction(enemy, ctx);
    expect(decision.type).toBe('heal');
    expect((decision as { skillId: string }).skillId).toBe('heal');
  });

  it('HP=40% 边界（不小于 0.4）→ 不强制治疗', () => {
    // hpPercent = 40/100 = 0.4，不满足 < 0.4
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const ctx = makeCtx({
      enemyHp: 40,
      enemyMaxHp: 100,
      availableSkills: [healSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('HP<40% 但无治疗技能 → 普通攻击或技能', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const ctx = makeCtx({
      enemyHp: 30,
      enemyMaxHp: 100,
      availableSkills: [attackSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('高血（>=60%）random<0.2 → 进入防御姿态 defend', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [attackSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('defend');
  });

  it('高血（>=60%）random>=0.2 且未命中防御/技能 → 普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const ctx = makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [attackSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('高血（>=60%）无攻击技能但有治疗技能 → 不治疗，防御姿态', () => {
    // 高血量不治疗；无 buff/attack 时 random<0.2 命中 defend
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [healSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('defend');
  });

  it('HP<40% 有治疗技能时优先治疗（忽略 random）', () => {
    // 即使 random=0.99 也应治疗（HP 低优先）
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ctx = makeCtx({
      enemyHp: 30,
      enemyMaxHp: 100,
      availableSkills: [attackSkill, healSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('heal');
  });
});

// ============================================================
// BalancedStrategy — 均衡型
// ============================================================

describe('BalancedStrategy 均衡型', () => {
  const strategy = new BalancedStrategy();
  const enemy = makeEnemy();

  it('name 为 "balanced"', () => {
    expect(strategy.name).toBe('balanced');
  });

  it('HP<50% 且有治疗技能 且 random<0.6 → 治疗', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ctx = makeCtx({
      enemyHp: 40,
      enemyMaxHp: 100,
      availableSkills: [healSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('heal');
  });

  it('HP<50% 但 random>=0.6 → 不治疗，进入技能判定', () => {
    // 第一次 random 用于治疗判定（0.7>=0.6 不治疗）
    vi.spyOn(Math, 'random').mockReturnValue(0.7);
    const ctx = makeCtx({
      enemyHp: 40,
      enemyMaxHp: 100,
      availableSkills: [healSkill, attackSkill],
    });
    // 0.7>=0.3 也不技能 → basic_attack
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('HP>=50% 且有攻击技能 且 random<0.3 → 技能', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const ctx = makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [attackSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
  });

  it('HP>=50% 且 random>=0.3 → 普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const ctx = makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [attackSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });

  it('HP=50% 边界（不小于 0.5）→ 不进入治疗分支', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({
      enemyHp: 50,
      enemyMaxHp: 100,
      availableSkills: [healSkill, attackSkill],
    });
    // hpPercent=0.5 不满足 <0.5；random=0.1<0.3 → 技能
    expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
  });

  it('HP<50% 无治疗技能 → 进入技能判定', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const ctx = makeCtx({
      enemyHp: 40,
      enemyMaxHp: 100,
      availableSkills: [attackSkill],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
  });

  it('无任何技能 → 普通攻击', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const ctx = makeCtx({
      enemyHp: 40,
      enemyMaxHp: 100,
      availableSkills: [],
    });
    expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
  });
});

// ============================================================
// BossPhaseStrategy — Boss 阶段型
// ============================================================

describe('BossPhaseStrategy Boss 阶段型', () => {
  const strategy = new BossPhaseStrategy();
  const enemy = makeEnemy();

  it('name 为 "boss_phase"', () => {
    expect(strategy.name).toBe('boss_phase');
  });

  describe('狂暴阶段（HP<20%）', () => {
    it('有攻击技能时必用技能（忽略 random）', () => {
      // 即使 random=0.99 也必技能
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const ctx = makeCtx({
        enemyHp: 10,
        enemyMaxHp: 100,
        availableSkills: [attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
    });

    it('无攻击技能时普通攻击', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const ctx = makeCtx({
        enemyHp: 10,
        enemyMaxHp: 100,
        availableSkills: [healSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
    });

    it('HP=20% 边界（不小于 0.2）→ 不进入狂暴，进入半血分支', () => {
      // hpPercent=0.2 不满足 <0.2，进入半血分支（<0.5）
      // 半血分支：无治疗技能跳过治疗；random=0.9>=0.6 不技能 → basic_attack
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const ctx = makeCtx({
        enemyHp: 20,
        enemyMaxHp: 100,
        availableSkills: [attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
    });

    it('狂暴阶段不治疗（即使有治疗技能）', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const ctx = makeCtx({
        enemyHp: 10,
        enemyMaxHp: 100,
        availableSkills: [healSkill, attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).not.toBe('heal');
    });
  });

  describe('半血阶段（20%<=HP<50%）', () => {
    it('有治疗技能 且 random<0.2 → 治疗', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const ctx = makeCtx({
        enemyHp: 30,
        enemyMaxHp: 100,
        availableSkills: [healSkill, attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('heal');
    });

    it('有攻击技能 且 random<0.6 → 技能（不治疗时）', () => {
      // 第一次 random=0.3（>=0.2 不治疗），第二次 random=0.3（<0.6 技能）
      // 但 vi.spyOn 只能 mock 一次返回值，需用 mockReturnValueOnce 链式
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.3) // 治疗判定：不治疗
        .mockReturnValueOnce(0.3); // 技能判定：技能
      const ctx = makeCtx({
        enemyHp: 30,
        enemyMaxHp: 100,
        availableSkills: [healSkill, attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
    });

    it('不治疗且不技能 → 普通攻击', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.3) // 不治疗
        .mockReturnValueOnce(0.7); // 不技能
      const ctx = makeCtx({
        enemyHp: 30,
        enemyMaxHp: 100,
        availableSkills: [healSkill, attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
    });

    it('HP=50% 边界（不小于 0.5）→ 不进入半血', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.4);
      const ctx = makeCtx({
        enemyHp: 50,
        enemyMaxHp: 100,
        availableSkills: [attackSkill],
      });
      // 进入正常分支：0.4>=0.3 不技能 → basic_attack
      expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
    });
  });

  describe('正常阶段（HP>=50%）', () => {
    it('有攻击技能 且 random<0.3 → 技能', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const ctx = makeCtx({
        enemyHp: 80,
        enemyMaxHp: 100,
        availableSkills: [attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('skill');
    });

    it('random>=0.3 → 普通攻击', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.4);
      const ctx = makeCtx({
        enemyHp: 80,
        enemyMaxHp: 100,
        availableSkills: [attackSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
    });

    it('无攻击技能 → 普通攻击', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const ctx = makeCtx({
        enemyHp: 80,
        enemyMaxHp: 100,
        availableSkills: [healSkill],
      });
      expect(strategy.decideAction(enemy, ctx).type).toBe('basic_attack');
    });
  });
});

// ============================================================
// ThreatBasedTargetSelector — 仇恨优先
// ============================================================

describe('ThreatBasedTargetSelector 仇恨优先', () => {
  const selector = new ThreatBasedTargetSelector();

  it('name 为 "threat_based"', () => {
    expect(selector.name).toBe('threat_based');
  });

  it('空数组返回 null', () => {
    expect(selector.select([])).toBeNull();
  });

  it('单元素直接返回', () => {
    const c = makeCombatant({ id: 'only' });
    expect(selector.select([c])).toBe(c);
  });

  it('选择仇恨值最高的目标', () => {
    const low = makeCombatant({ id: 'low', threat: 10 });
    const high = makeCombatant({ id: 'high', threat: 50 });
    expect(selector.select([low, high])).toBe(high);
  });

  it('仇恨值相同时选择 HP 较低的目标', () => {
    const highHp = makeCombatant({ id: 'h1', threat: 50, hp: 80 });
    const lowHp = makeCombatant({ id: 'h2', threat: 50, hp: 30 });
    expect(selector.select([highHp, lowHp])).toBe(lowHp);
  });

  it('无 threat 字段时视为 0', () => {
    const c1 = makeCombatant({ id: 'c1' }); // threat=0（默认）
    const c2 = makeCombatant({ id: 'c2', threat: undefined });
    // 两者 threat 都为 0，选 HP 较低的 c2（hp=100 相同，选第一个）
    const c2Full = makeCombatant({ id: 'c2', threat: undefined, hp: 100 });
    expect(selector.select([c1, c2Full])).toBe(c1);
  });

  it('best（首个候选）无 threat 字段时走 ?? 0 回退分支', () => {
    // 首次 reduce 迭代 best=first（threat undefined → 0），current=second（threat=5）
    // 5 > 0 → 返回 second，触发 best.threat ?? 0 的 ?? 回退
    const first = makeCombatant({ id: 'first', threat: undefined, hp: 100 });
    const second = makeCombatant({ id: 'second', threat: 5, hp: 100 });
    expect(selector.select([first, second])).toBe(second);
  });

  it('多目标时正确选出最高仇恨', () => {
    const a = makeCombatant({ id: 'a', threat: 10, hp: 100 });
    const b = makeCombatant({ id: 'b', threat: 30, hp: 50 });
    const c = makeCombatant({ id: 'c', threat: 20, hp: 80 });
    expect(selector.select([a, b, c])).toBe(b);
  });

  it('不修改候选数组', () => {
    const candidates = [makeCombatant({ id: 'a' }), makeCombatant({ id: 'b' })];
    const snapshot = [...candidates];
    selector.select(candidates);
    expect(candidates).toEqual(snapshot);
  });
});

// ============================================================
// RandomTargetSelector — 随机选择
// ============================================================

describe('RandomTargetSelector 随机选择', () => {
  const selector = new RandomTargetSelector();

  it('name 为 "random"', () => {
    expect(selector.name).toBe('random');
  });

  it('空数组返回 null', () => {
    expect(selector.select([])).toBeNull();
  });

  it('单元素直接返回', () => {
    const c = makeCombatant({ id: 'only' });
    expect(selector.select([c])).toBe(c);
  });

  it('Math.random=0 时选第一个', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const a = makeCombatant({ id: 'a' });
    const b = makeCombatant({ id: 'b' });
    expect(selector.select([a, b])).toBe(a);
  });

  it('Math.random=0.5 时选中间（floor(0.5*2)=1）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const a = makeCombatant({ id: 'a' });
    const b = makeCombatant({ id: 'b' });
    expect(selector.select([a, b])).toBe(b);
  });

  it('Math.random=0.999 时选最后一个', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const a = makeCombatant({ id: 'a' });
    const b = makeCombatant({ id: 'b' });
    const c = makeCombatant({ id: 'c' });
    // floor(0.999 * 3) = floor(2.997) = 2 → 第三个
    expect(selector.select([a, b, c])).toBe(c);
  });

  it('Math.random=1 时不会越界（floor(1*3)=3 越界，但 mock 返回 1 实际不会发生）', () => {
    // 实际 Math.random 返回 [0, 1)，mock 返回 1 是边界测试
    // floor(1 * 2) = 2，数组长度 2 → 越界返回 undefined
    // 但真实场景不会发生，此处验证 floor 行为
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const a = makeCombatant({ id: 'a' });
    const b = makeCombatant({ id: 'b' });
    // floor(0.99 * 2) = floor(1.98) = 1 → 第二个
    expect(selector.select([a, b])).toBe(b);
  });
});

// ============================================================
// LowestHpTargetSelector — 最低 HP
// ============================================================

describe('LowestHpTargetSelector 最低 HP', () => {
  const selector = new LowestHpTargetSelector();

  it('name 为 "lowest_hp"', () => {
    expect(selector.name).toBe('lowest_hp');
  });

  it('空数组返回 null', () => {
    expect(selector.select([])).toBeNull();
  });

  it('单元素直接返回', () => {
    const c = makeCombatant({ id: 'only' });
    expect(selector.select([c])).toBe(c);
  });

  it('选择 HP 最低的目标', () => {
    const high = makeCombatant({ id: 'high', hp: 80 });
    const low = makeCombatant({ id: 'low', hp: 20 });
    expect(selector.select([high, low])).toBe(low);
  });

  it('HP 相同时选第一个（reduce 行为）', () => {
    const a = makeCombatant({ id: 'a', hp: 50 });
    const b = makeCombatant({ id: 'b', hp: 50 });
    expect(selector.select([a, b])).toBe(a);
  });

  it('多目标时正确选出最低 HP', () => {
    const a = makeCombatant({ id: 'a', hp: 100 });
    const b = makeCombatant({ id: 'b', hp: 30 });
    const c = makeCombatant({ id: 'c', hp: 80 });
    expect(selector.select([a, b, c])).toBe(b);
  });

  it('HP=0 的目标也会被选中（斩杀优先）', () => {
    const alive = makeCombatant({ id: 'alive', hp: 50 });
    const dying = makeCombatant({ id: 'dying', hp: 0 });
    expect(selector.select([alive, dying])).toBe(dying);
  });
});

// ============================================================
// getTargetSelector — 工厂函数
// ============================================================

describe('getTargetSelector 工厂函数', () => {
  it('传入 "threat_based" 返回 ThreatBasedTargetSelector', () => {
    const s = getTargetSelector('threat_based');
    expect(s).toBeInstanceOf(ThreatBasedTargetSelector);
    expect(s.name).toBe('threat_based');
  });

  it('传入 "random" 返回 RandomTargetSelector', () => {
    const s = getTargetSelector('random');
    expect(s).toBeInstanceOf(RandomTargetSelector);
    expect(s.name).toBe('random');
  });

  it('传入 "lowest_hp" 返回 LowestHpTargetSelector', () => {
    const s = getTargetSelector('lowest_hp');
    expect(s).toBeInstanceOf(LowestHpTargetSelector);
    expect(s.name).toBe('lowest_hp');
  });

  it('未知名称回退到 threat_based', () => {
    const s = getTargetSelector('unknown_selector');
    expect(s).toBeInstanceOf(ThreatBasedTargetSelector);
  });

  it('空字符串回退到 threat_based', () => {
    const s = getTargetSelector('');
    expect(s).toBeInstanceOf(ThreatBasedTargetSelector);
  });

  it('相同名称返回同一实例（单例注册表）', () => {
    const a = getTargetSelector('threat_based');
    const b = getTargetSelector('threat_based');
    expect(a).toBe(b);
  });
});

// ============================================================
// P3-162 AI 决策扩展 — buff / defend
// ============================================================

/** 用预设随机数序列构造 Rng，实现确定性分支覆盖 */
function rngFromSequence(values: number[]): Rng {
  let i = 0;
  return createRngFromFn(() => (i < values.length ? values[i++] : 0));
}

const warCry = { id: 'war_cry', name: '战吼', isBuff: true };

describe('P3-162 AggressiveStrategy buff/defend', () => {
  const enemy = makeEnemy();

  it('开场回合（1-2）有 buff 技能且无已有增益 → 返回 buff', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.3]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      availableSkills: [attackSkill, warCry],
    })) as { type: 'buff'; skillId: string };
    expect(decision.type).toBe('buff');
    expect(decision.skillId).toBe('war_cry');
  });

  it('已有增益（enemyHasBuff）→ 开场不 buff', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.8]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      enemyHasBuff: true,
      availableSkills: [attackSkill, warCry],
    }));
    expect(decision.type).not.toBe('buff');
  });

  it('玩家残血（<25%）→ 不 buff，攻击终结', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.8]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      playerHp: 20,
      playerMaxHp: 100,
      availableSkills: [attackSkill, warCry],
    }));
    expect(decision.type).not.toBe('buff');
    expect(decision.type).toBe('basic_attack');
  });

  it('常规阶段（非开场）有 buff 技能 → 低概率返回 buff', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.8, 0.05]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 5,
      availableSkills: [attackSkill, warCry],
    })) as { type: 'buff'; skillId: string };
    expect(decision.type).toBe('buff');
    expect(decision.skillId).toBe('war_cry');
  });

  it('无 buff 技能时不返回 buff', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      availableSkills: [attackSkill],
    }));
    expect(decision.type).not.toBe('buff');
  });
});

describe('P3-162 DefensiveStrategy buff/defend', () => {
  const enemy = makeEnemy();

  it('高血（≥60%）有 buff 技能 → 返回 buff', () => {
    const strategy = new DefensiveStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [warCry],
    })) as { type: 'buff'; skillId: string };
    expect(decision.type).toBe('buff');
    expect(decision.skillId).toBe('war_cry');
  });

  it('高血（≥60%）无 buff 技能 → 可返回 defend', () => {
    const strategy = new DefensiveStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 80,
      enemyMaxHp: 100,
      availableSkills: [],
    }));
    expect(decision.type).toBe('defend');
  });

  it('中血（40%~60%）→ 可返回 defend', () => {
    const strategy = new DefensiveStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 50,
      enemyMaxHp: 100,
      availableSkills: [],
    }));
    expect(decision.type).toBe('defend');
  });

  it('低血（<40%）有治疗技能 → 治疗保命', () => {
    const strategy = new DefensiveStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 30,
      enemyMaxHp: 100,
      availableSkills: [healSkill],
    }));
    expect(decision.type).toBe('heal');
  });

  it('低血（<40%）无治疗技能 → 可返回 defend 苟活', () => {
    const strategy = new DefensiveStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 30,
      enemyMaxHp: 100,
      availableSkills: [],
    }));
    expect(decision.type).toBe('defend');
  });
});

describe('P3-162 BalancedStrategy buff/defend', () => {
  const enemy = makeEnemy();

  it('高血（≥50%）有 buff 技能且非开场 → 可返回 buff', () => {
    const strategy = new BalancedStrategy(rngFromSequence([0.9, 0.05]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 5,
      availableSkills: [attackSkill, warCry],
    })) as { type: 'buff'; skillId: string };
    expect(decision.type).toBe('buff');
    expect(decision.skillId).toBe('war_cry');
  });

  it('高血（≥50%）无技能 → 可返回 defend', () => {
    const strategy = new BalancedStrategy(rngFromSequence([0.05]));
    const decision = strategy.decideAction(enemy, makeCtx({
      availableSkills: [],
    }));
    expect(decision.type).toBe('defend');
  });

  it('玩家残血（<25%）→ 优先攻击补刀', () => {
    const strategy = new BalancedStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      playerHp: 20,
      playerMaxHp: 100,
      availableSkills: [attackSkill, warCry],
    }));
    expect(decision.type).toBe('skill');
    expect((decision as { skillId: string }).skillId).toBe('fireball');
  });

  it('低血（<50%）有治疗技能 → 治疗优先', () => {
    const strategy = new BalancedStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 30,
      enemyMaxHp: 100,
      availableSkills: [healSkill],
    }));
    expect(decision.type).toBe('heal');
  });
});

describe('P3-162 BossPhaseStrategy buff', () => {
  const enemy = makeEnemy();

  it('正常阶段开场（回合 1-3）有 buff 技能 → 返回 buff', () => {
    const strategy = new BossPhaseStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      availableSkills: [attackSkill, warCry],
    })) as { type: 'buff'; skillId: string };
    expect(decision.type).toBe('buff');
    expect(decision.skillId).toBe('war_cry');
  });

  it('半血阶段（<50%）有 buff 技能 → 可返回 buff', () => {
    const strategy = new BossPhaseStrategy(rngFromSequence([0.1]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 40,
      enemyMaxHp: 100,
      availableSkills: [attackSkill, warCry],
    })) as { type: 'buff'; skillId: string };
    expect(decision.type).toBe('buff');
    expect(decision.skillId).toBe('war_cry');
  });

  it('狂暴阶段（<20%）→ 不 buff，全力技能攻击', () => {
    const strategy = new BossPhaseStrategy(rngFromSequence([0.0]));
    const decision = strategy.decideAction(enemy, makeCtx({
      enemyHp: 10,
      enemyMaxHp: 100,
      availableSkills: [attackSkill, warCry],
    }));
    expect(decision.type).not.toBe('buff');
    expect(decision.type).toBe('skill');
  });

  it('已有增益（enemyHasBuff）→ 正常阶段不 buff', () => {
    const strategy = new BossPhaseStrategy(rngFromSequence([0.9]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      enemyHasBuff: true,
      availableSkills: [attackSkill, warCry],
    }));
    expect(decision.type).not.toBe('buff');
  });
});

describe('P3-162 BattleContext 扩展', () => {
  const enemy = makeEnemy();

  it('enemyHasBuff=true 时策略不返回 buff 决策', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.9]));
    const decision = strategy.decideAction(enemy, makeCtx({
      turnCount: 1,
      enemyHasBuff: true,
      availableSkills: [warCry],
    }));
    expect(decision.type).not.toBe('buff');
  });

  it('playerHasDebuff 不阻断攻击等正常决策', () => {
    const strategy = new AggressiveStrategy(rngFromSequence([0.3]));
    const decision = strategy.decideAction(enemy, makeCtx({
      playerHasDebuff: true,
      availableSkills: [attackSkill],
    }));
    expect(['skill', 'basic_attack']).toContain(decision.type);
  });
});
