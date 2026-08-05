/**
 * @fileoverview equipment/setBonusRegistry 单元测试
 *
 * 覆盖：
 * 1. executeSetBonus 分派：注册的 triggerId 在匹配 source 时下发意图，否则 no-op
 * 2. 6 个内置执行器的效果意图正确性（注入 mock emit 收集意图）
 * 3. isTriggerRegistered / getTriggerSources 查询
 * 4. registerSetBonusExecutor 运行时注册
 */
import { describe, it, expect, vi } from 'vitest';
import {
  executeSetBonus,
  isTriggerRegistered,
  getTriggerSources,
  registerSetBonusExecutor,
  SET_BONUS_EXECUTORS,
  type SetBonusContext,
  type SetBonusIntent
} from '@/modules/equipment/setBonusRegistry';

// ==================== 测试数据 helper ====================

/** 构造上下文，emit 为 mock 函数，返回收集到的意图 */
function makeCtx(
  source: SetBonusContext['source'],
  piecesEquipped = 2
): { ctx: SetBonusContext; intents: SetBonusIntent[] } {
  const intents: SetBonusIntent[] = [];
  const ctx: SetBonusContext = {
    characterId: 'char_1',
    piecesEquipped,
    source,
    emit: vi.fn((intent: SetBonusIntent) => { intents.push(intent); }),
  };
  return { ctx, intents };
}

// ==================== executeSetBonus 分派 ====================

describe('executeSetBonus 分派逻辑', () => {
  it('rage_gen_on_hit_1 在 on_hit 时下发 +1 怒气', () => {
    const { ctx, intents } = makeCtx('on_hit');
    executeSetBonus('rage_gen_on_hit_1', ctx);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'rage', amount: 1 });
  });

  it('rage_gen_on_hit_1 在 on_turn_start 时不触发（source 不匹配）', () => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus('rage_gen_on_hit_1', ctx);
    expect(intents).toHaveLength(0);
  });

  it('未知 triggerId 为 no-op', () => {
    const { ctx, intents } = makeCtx('on_hit');
    executeSetBonus('not_a_real_trigger', ctx);
    expect(intents).toHaveLength(0);
  });

  it('emit 回调被调用', () => {
    const { ctx } = makeCtx('on_hit');
    executeSetBonus('rage_gen_on_hit_1', ctx);
    expect(ctx.emit).toHaveBeenCalledTimes(1);
  });
});

// ==================== 33 个内置执行器 ====================

describe('内置执行器效果意图', () => {
  it('mp_regen_5_percent 在 on_turn_start 下发 5% 法力恢复', () => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus('mp_regen_5_percent', ctx);
    expect(intents[0]).toEqual({ kind: 'percent_regen', resource: 'mp', percent: 0.05 });
  });

  it('heal_bonus_10_percent 在 passive 下发治疗 +10% 修正', () => {
    const { ctx, intents } = makeCtx('passive');
    executeSetBonus('heal_bonus_10_percent', ctx);
    expect(intents[0]).toEqual({ kind: 'modifier', modifier: 'heal', value: 0.10 });
  });

  it('crit_bonus_3_percent 在 passive 下发暴击 +3% 修正', () => {
    const { ctx, intents } = makeCtx('passive');
    executeSetBonus('crit_bonus_3_percent', ctx);
    expect(intents[0]).toEqual({ kind: 'modifier', modifier: 'crit', value: 0.03 });
  });

  it('energy_regen_2 在 on_turn_start 下发 +2 能量', () => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus('energy_regen_2', ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'energy', amount: 2 });
  });

  it('soul_shard_on_kill_20_percent 在 on_kill 下发 20% 概率 +1 灵魂碎片', () => {
    const { ctx, intents } = makeCtx('on_kill');
    executeSetBonus('soul_shard_on_kill_20_percent', ctx);
    expect(intents[0]).toEqual({
      kind: 'chance_grant',
      resource: 'soul_shard',
      chance: 0.2,
      amount: 1
    });
  });

  it('soul_shard_on_kill_20_percent 在 on_hit 时不触发', () => {
    const { ctx, intents } = makeCtx('on_hit');
    executeSetBonus('soul_shard_on_kill_20_percent', ctx);
    expect(intents).toHaveLength(0);
  });

  // ==================== P3 新增触发器（T2/T3 级别 + 7 个新职业） ====================

  it.each([
    ['rage_gen_on_hit_2', 2],
    ['rage_gen_on_hit_3', 3],
  ] as const)('战士 %s 在 on_hit 下发 +%d 怒气', (triggerId, amount) => {
    const { ctx, intents } = makeCtx('on_hit');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'rage', amount });
  });

  it.each([
    ['fury_gen_on_hit_1', 1],
    ['fury_gen_on_hit_2', 2],
    ['fury_gen_on_hit_3', 3],
  ] as const)('恶魔猎手 %s 在 on_hit 下发 +%d 怒气', (triggerId, amount) => {
    const { ctx, intents } = makeCtx('on_hit');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'fury', amount });
  });

  it.each([
    ['energy_regen_3', 3],
    ['energy_regen_4', 4],
  ] as const)('潜行者 %s 在 on_turn_start 下发 +%d 能量', (triggerId, amount) => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'energy', amount });
  });

  it.each([
    ['chi_regen_1', 1],
    ['chi_regen_2', 2],
    ['chi_regen_3', 3],
  ] as const)('武僧 %s 在 on_turn_start 下发 +%d 真气', (triggerId, amount) => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'chi', amount });
  });

  it.each([
    ['rune_regen_1', 1],
    ['rune_regen_2', 2],
    ['rune_regen_3', 3],
  ] as const)('死亡骑士 %s 在 on_turn_start 下发 +%d 符文', (triggerId, amount) => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'rune', amount });
  });

  it.each([
    ['essence_regen_1', 1],
    ['essence_regen_2', 2],
    ['essence_regen_3', 3],
  ] as const)('唤魔者 %s 在 on_turn_start 下发 +%d 精华', (triggerId, amount) => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'resource', resource: 'essence', amount });
  });

  it.each([
    ['mp_regen_7_percent', 0.07],
    ['mp_regen_10_percent', 0.10],
  ] as const)('法师/牧师 %s 在 on_turn_start 下发 %d 法力恢复', (triggerId, percent) => {
    const { ctx, intents } = makeCtx('on_turn_start');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'percent_regen', resource: 'mp', percent });
  });

  it.each([
    ['heal_bonus_15_percent', 0.15],
    ['heal_bonus_20_percent', 0.20],
  ] as const)('圣骑士/德鲁伊 %s 在 passive 下发治疗修正 %d', (triggerId, value) => {
    const { ctx, intents } = makeCtx('passive');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'modifier', modifier: 'heal', value });
  });

  it.each([
    ['crit_bonus_5_percent', 0.05],
    ['crit_bonus_7_percent', 0.07],
  ] as const)('猎人 %s 在 passive 下发暴击修正 %d', (triggerId, value) => {
    const { ctx, intents } = makeCtx('passive');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'modifier', modifier: 'crit', value });
  });

  it.each([
    ['elemental_damage_5_percent', 0.05],
    ['elemental_damage_8_percent', 0.08],
    ['elemental_damage_12_percent', 0.12],
  ] as const)('萨满 %s 在 passive 下发元素伤害修正 %d', (triggerId, value) => {
    const { ctx, intents } = makeCtx('passive');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'modifier', modifier: 'elemental_damage', value });
  });

  it.each([
    ['soul_shard_on_kill_30_percent', 0.3],
    ['soul_shard_on_kill_40_percent', 0.4],
  ] as const)('术士 %s 在 on_kill 下发概率 %d +1 灵魂碎片', (triggerId, chance) => {
    const { ctx, intents } = makeCtx('on_kill');
    executeSetBonus(triggerId, ctx);
    expect(intents[0]).toEqual({ kind: 'chance_grant', resource: 'soul_shard', chance, amount: 1 });
  });
});

// ==================== 查询函数 ====================

describe('isTriggerRegistered / getTriggerSources', () => {
  it('已注册的 triggerId 返回 true', () => {
    expect(isTriggerRegistered('rage_gen_on_hit_1')).toBe(true);
    expect(isTriggerRegistered('mp_regen_5_percent')).toBe(true);
    expect(isTriggerRegistered('soul_shard_on_kill_20_percent')).toBe(true);
  });

  it('未注册的 triggerId 返回 false', () => {
    expect(isTriggerRegistered('unknown')).toBe(false);
  });

  it('getTriggerSources 返回执行器声明的时机列表', () => {
    expect(getTriggerSources('rage_gen_on_hit_1')).toEqual(['on_hit']);
    expect(getTriggerSources('mp_regen_5_percent')).toEqual(['on_turn_start']);
    expect(getTriggerSources('heal_bonus_10_percent')).toEqual(['passive']);
  });

  it('getTriggerSources 未注册时返回空数组', () => {
    expect(getTriggerSources('unknown')).toEqual([]);
  });

  it('注册表覆盖全部 33 个触发器（6 个旧版 T1 + 27 个 P3 新增）', () => {
    expect(Object.keys(SET_BONUS_EXECUTORS)).toHaveLength(33);
    // 旧版 6 个 T1 触发器
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('rage_gen_on_hit_1');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('mp_regen_5_percent');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('heal_bonus_10_percent');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('crit_bonus_3_percent');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('energy_regen_2');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('soul_shard_on_kill_20_percent');
    // P3 新增触发器示例
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('fury_gen_on_hit_1');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('chi_regen_1');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('rune_regen_1');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('essence_regen_1');
    expect(Object.keys(SET_BONUS_EXECUTORS)).toContain('elemental_damage_5_percent');
  });
});

// ==================== 运行时注册 ====================

describe('registerSetBonusExecutor 运行时注册', () => {
  it('注册新触发器后可被 executeSetBonus 分派', () => {
    const executor = vi.fn();
    registerSetBonusExecutor('test_custom_trigger', {
      executor,
      sources: ['on_crit']
    });

    expect(isTriggerRegistered('test_custom_trigger')).toBe(true);
    expect(getTriggerSources('test_custom_trigger')).toEqual(['on_crit']);

    const { ctx } = makeCtx('on_crit');
    executeSetBonus('test_custom_trigger', ctx);
    expect(executor).toHaveBeenCalledTimes(1);

    // 清理：恢复注册表（避免影响其他测试）
    delete (SET_BONUS_EXECUTORS as Record<string, unknown>).test_custom_trigger;
  });

  it('注册后在非声明时机不触发', () => {
    const executor = vi.fn();
    registerSetBonusExecutor('test_passive_only', {
      executor,
      sources: ['passive']
    });

    const { ctx } = makeCtx('on_hit');
    executeSetBonus('test_passive_only', ctx);
    expect(executor).not.toHaveBeenCalled();

    delete (SET_BONUS_EXECUTORS as Record<string, unknown>).test_passive_only;
  });
});
