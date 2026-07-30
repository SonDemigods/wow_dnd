/**
 * @fileoverview 职业被动技能 Composable（usePassiveSkills）单元测试
 *
 * 覆盖 usePassiveSkills 的：
 * 1. loadPassives：从 getPassivesByClassId 加载当前职业被动
 * 2. onCombatStart / onTurnStart / onAttack / onDamaged / onKill：
 *    按 trigger 过滤并执行对应被动
 * 3. checkLowHpPassives：hp/maxHp < 0.3 时触发 on_low_hp 被动
 * 4. applyHeal：
 *    - on_attack 触发：按 damage × value 吸血
 *    - 其他触发：按 maxHp × value 百分比治疗
 * 5. applyResourceGen：调用 resourceSystems 中匹配类型系统的 generate
 * 6. getDamageReduction：多个 damage_reduction 取最大值，condition 过滤
 * 7. getStatModifiers：返回满足条件的 stat_modifier 列表
 * 8. evaluateCondition：支持 hp < 0.3 等条件表达式
 *
 * Mock 策略：
 *  - useCharacterStore mock 模块（classId/hp/maxHp/name/receiveHeal）
 *  - getPassivesByClassId mock 模块（返回测试被动列表）
 *  - state / log 构造 minimal mock
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { usePassiveSkills } from '@/modules/combat/composables/usePassiveSkills';
import type { PassiveSkill, PassiveEffect } from '@/modules/character/types';
import type { ICombatContext } from '@/modules/combat/combatContext';

// mock characterStore
const characterMock = {
  classId: 'warrior' as never,
  name: '英雄',
  hp: 100,
  maxHp: 100,
  receiveHeal: vi.fn(),
};
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: vi.fn(() => characterMock),
}));

// mock getPassivesByClassId
const getPassivesByClassIdMock = vi.fn<(classId: string) => PassiveSkill[]>();
vi.mock('@/data/config_class_passives', () => ({
  getPassivesByClassId: (classId: string) => getPassivesByClassIdMock(classId),
}));

// ==================== 测试数据构造 helper ====================

function makePassive(o: Partial<PassiveSkill> & { effect?: Partial<PassiveEffect> } = {}): PassiveSkill {
  const { effect: effectOverride, ...rest } = o;
  return {
    id: 'p1',
    name: '被动1',
    description: '描述',
    icon: 'icon',
    classId: 'warrior' as never,
    trigger: 'on_combat_start',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'crit_damage_multiplier',
      value: 0.2,
      ...effectOverride,
    },
    ...rest,
  } as PassiveSkill;
}

function makeStateMock() {
  return {
    resourceSystems: ref<unknown[]>([]),
    bossInstances: new Map(),
  } as never;
}

function makeLogMock() {
  return {
    addCombatLog: vi.fn(),
  } as never;
}

/**
 * 构造 ICombatContext mock
 *
 * character 域的 name/classId/hp/maxHp 通过 getter 动态读取 characterMock，
 * 保证测试中修改 characterMock.hp/classId 后 ctx.character 能实时反映；
 * receiveHeal 指向 characterMock.receiveHeal 同一实例，便于断言调用。
 */
function makeMockCtx(overrides: Partial<ICombatContext> = {}): ICombatContext {
  return {
    character: {
      get name() { return characterMock.name; },
      get classId() { return characterMock.classId; },
      get hp() { return characterMock.hp; },
      get maxHp() { return characterMock.maxHp; },
      receiveHeal: characterMock.receiveHeal,
      attributes: {} as never,
      effectiveStats: {} as never,
      takeDamage: vi.fn(),
      gainExp: vi.fn(),
      gainGold: vi.fn(),
      handleDeath: vi.fn(),
      changeMp: vi.fn(),
    },
    skill: {
      castSkill: vi.fn(),
      getSkill: vi.fn(),
      tickCooldowns: vi.fn(),
      resetCooldowns: vi.fn(),
    },
    enemy: {
      getEnemyById: vi.fn(),
      deleteEnemy: vi.fn(),
      takeDamage: vi.fn(),
      createEnemy: vi.fn(),
      getAvailableSkills: vi.fn(),
      useSkill: vi.fn(),
      calculateDamage: vi.fn(),
      tickCooldowns: vi.fn(),
    },
    quest: { onEnemyKilled: vi.fn() },
    log: { addLogEntry: vi.fn() },
    inventory: { useItem: vi.fn(), getItemInfo: vi.fn(), addItem: vi.fn() },
    ...overrides,
  } as unknown as ICombatContext;
}

// ==================== 测试用例 ====================

describe('usePassiveSkills - 职业被动技能 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.hp = 100;
    characterMock.maxHp = 100;
    characterMock.classId = 'warrior' as never;
    getPassivesByClassIdMock.mockReturnValue([]);
  });

  // -------------------- loadPassives --------------------

  describe('loadPassives：加载当前职业被动', () => {
    it('调用 getPassivesByClassId 传入 characterStore.classId', () => {
      const passives = [makePassive({ id: 'p1' })];
      getPassivesByClassIdMock.mockReturnValue(passives);

      const passive = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      passive.loadPassives();

      expect(getPassivesByClassIdMock).toHaveBeenCalledWith('warrior');
      expect(passive.getPassives()).toEqual(passives);
    });

    it('未调用 loadPassives 时 getPassives 返回空数组', () => {
      const passive = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      expect(passive.getPassives()).toEqual([]);
    });

    it('不同职业加载不同被动', () => {
      const warriorPassives = [makePassive({ id: 'w1', classId: 'warrior' as never })];
      const magePassives = [makePassive({ id: 'm1', classId: 'mage' as never })];
      getPassivesByClassIdMock.mockReturnValueOnce(warriorPassives).mockReturnValueOnce(magePassives);

      const passive = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      characterMock.classId = 'warrior' as never;
      passive.loadPassives();
      expect(passive.getPassives()).toEqual(warriorPassives);

      characterMock.classId = 'mage' as never;
      passive.loadPassives();
      expect(passive.getPassives()).toEqual(magePassives);
    });
  });

  // -------------------- 触发时机 --------------------

  describe('onCombatStart：战斗开始触发', () => {
    it('仅执行 trigger=on_combat_start 的被动', () => {
      const combatPassive = makePassive({ id: 'cs', name: '战斗开始被动', trigger: 'on_combat_start' });
      const turnPassive = makePassive({ id: 'ts', name: '回合开始被动', trigger: 'on_turn_start' });
      getPassivesByClassIdMock.mockReturnValue([combatPassive, turnPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      passive.onCombatStart();

      // 仅 combatPassive 触发，记录 1 条 passive_trigger 日志
      const triggerLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_trigger');
      expect(triggerLogs).toHaveLength(1);
      expect(triggerLogs[0][0].message).toContain('战斗开始被动');
    });

    it('无对应 trigger 被动时不记录日志', () => {
      getPassivesByClassIdMock.mockReturnValue([makePassive({ trigger: 'on_turn_start' })]);
      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();

      passive.onCombatStart();
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });
  });

  describe('onTurnStart：回合开始触发', () => {
    it('执行 trigger=on_turn_start 的被动，并检查 on_low_hp', () => {
      const turnPassive = makePassive({ id: 'ts', name: '回合被动', trigger: 'on_turn_start' });
      const lowHpPassive = makePassive({
        id: 'lhp',
        name: '低血被动',
        trigger: 'on_low_hp',
        effect: { type: 'heal', target: 'self', value: 0.1 },
      });
      getPassivesByClassIdMock.mockReturnValue([turnPassive, lowHpPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();

      // hp=100/100，不触发 lowHp
      characterMock.hp = 100;
      characterMock.maxHp = 100;
      log.addCombatLog.mockClear();
      passive.onTurnStart();

      // 仅 turnPassive 触发
      const triggerLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_trigger');
      expect(triggerLogs).toHaveLength(1);
      expect(triggerLogs[0][0].message).toContain('回合被动');
    });

    it('hp < 30% 时触发 on_low_hp 被动', () => {
      const lowHpPassive = makePassive({
        id: 'lhp',
        name: '低血被动',
        trigger: 'on_low_hp',
        effect: { type: 'heal', target: 'self', value: 0.1 },
      });
      getPassivesByClassIdMock.mockReturnValue([lowHpPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();

      characterMock.hp = 20;
      characterMock.maxHp = 100;
      log.addCombatLog.mockClear();
      passive.onTurnStart();

      // lowHpPassive 触发：1 条 passive_trigger + 1 条 combat_heal（治疗 10 点）
      const triggerLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_trigger');
      expect(triggerLogs).toHaveLength(1);
      expect(triggerLogs[0][0].message).toContain('低血被动');
    });
  });

  describe('onAttack：玩家攻击命中触发', () => {
    it('执行 trigger=on_attack 的被动，传入 damage 用于吸血计算', () => {
      const attackPassive = makePassive({
        id: 'ap',
        name: '吸血',
        trigger: 'on_attack',
        effect: { type: 'heal', target: 'self', value: 0.2 }, // 20% 吸血
      });
      getPassivesByClassIdMock.mockReturnValue([attackPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      passive.onAttack(50);

      // 吸血量 = floor(50 × 0.2) = 10
      expect(characterMock.receiveHeal).toHaveBeenCalledWith(10);
      const healLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'combat_heal');
      expect(healLogs).toHaveLength(1);
      expect(healLogs[0][0].heal).toBe(10);
    });

    it('damage=0 时进入 else 分支按 maxHp 百分比治疗（源码当前行为，非 bug 修复范围）', () => {
      const attackPassive = makePassive({
        id: 'ap',
        trigger: 'on_attack',
        effect: { type: 'heal', target: 'self', value: 0.2 },
      });
      getPassivesByClassIdMock.mockReturnValue([attackPassive]);

      const passive = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      passive.loadPassives();

      characterMock.maxHp = 100;
      passive.onAttack(0);
      // 源码 applyHeal：context.damage=0 时走 else 分支，按 maxHp × value 治疗
      // floor(100 × 0.2) = 20
      expect(characterMock.receiveHeal).toHaveBeenCalledWith(20);
    });
  });

  describe('onDamaged：玩家受伤触发', () => {
    it('执行 trigger=on_damaged 的被动，并检查 on_low_hp', () => {
      const damagedPassive = makePassive({
        id: 'dp',
        name: '受伤被动',
        trigger: 'on_damaged',
        effect: { type: 'damage_reduction', target: 'self', value: 0.2 },
      });
      getPassivesByClassIdMock.mockReturnValue([damagedPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      characterMock.hp = 100;
      characterMock.maxHp = 100;
      passive.onDamaged(30);

      // 仅 damagedPassive 触发（hp=70/100 仍 ≥ 30%，lowHp 不触发）
      const triggerLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_trigger');
      expect(triggerLogs).toHaveLength(1);
      expect(triggerLogs[0][0].message).toContain('受伤被动');
    });

    it('受伤后 hp < 30% 时额外触发 on_low_hp', () => {
      const damagedPassive = makePassive({
        id: 'dp',
        name: '受伤被动',
        trigger: 'on_damaged',
        effect: { type: 'damage_reduction', target: 'self', value: 0.2 },
      });
      const lowHpPassive = makePassive({
        id: 'lhp',
        name: '低血被动',
        trigger: 'on_low_hp',
        effect: { type: 'heal', target: 'self', value: 0.1 },
      });
      getPassivesByClassIdMock.mockReturnValue([damagedPassive, lowHpPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      characterMock.hp = 20;
      characterMock.maxHp = 100;
      passive.onDamaged(10);

      // damagedPassive + lowHpPassive 均触发
      const triggerLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_trigger');
      expect(triggerLogs).toHaveLength(2);
    });
  });

  describe('onKill：击杀敌人触发', () => {
    it('执行 trigger=on_kill 的被动', () => {
      const killPassive = makePassive({ id: 'kp', name: '击杀被动', trigger: 'on_kill' });
      getPassivesByClassIdMock.mockReturnValue([killPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      passive.onKill();

      const triggerLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_trigger');
      expect(triggerLogs).toHaveLength(1);
      expect(triggerLogs[0][0].message).toContain('击杀被动');
    });
  });

  // -------------------- applyHeal --------------------

  describe('applyHeal：治疗效果', () => {
    it('on_attack 触发：按 damage × value 吸血（向下取整）', () => {
      const passive = makePassive({
        trigger: 'on_attack',
        effect: { type: 'heal', target: 'self', value: 0.15 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      p.onAttack(33);
      // floor(33 × 0.15) = floor(4.95) = 4
      expect(characterMock.receiveHeal).toHaveBeenCalledWith(4);
    });

    it('on_turn_start 触发：按 maxHp × value 百分比治疗', () => {
      const passive = makePassive({
        trigger: 'on_turn_start',
        effect: { type: 'heal', target: 'self', value: 0.05 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      characterMock.hp = 50;
      characterMock.maxHp = 200;
      p.onTurnStart();
      // floor(200 × 0.05) = 10
      expect(characterMock.receiveHeal).toHaveBeenCalledWith(10);
    });

    it('value=0 时不治疗', () => {
      const passive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'heal', target: 'self', value: 0 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      p.onCombatStart();
      expect(characterMock.receiveHeal).not.toHaveBeenCalled();
    });
  });

  // -------------------- applyResourceGen --------------------

  describe('applyResourceGen：资源生成', () => {
    it('匹配资源类型时调用 generate', () => {
      const generate = vi.fn();
      const state = makeStateMock();
      state.resourceSystems.value = [{ type: 'rage', generate } as never];

      const passive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'resource_gen', target: 'self', stat: 'rage', value: 30 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(state, makeLogMock(), makeMockCtx());
      p.loadPassives();

      p.onCombatStart();
      // P2-43 修复：被动资源生成使用 'passive' 来源，不受 skill 上限限制
      expect(generate).toHaveBeenCalledWith(30, 'passive');
    });

    it('resourceType 缺失时不调用 generate', () => {
      const generate = vi.fn();
      const state = makeStateMock();
      state.resourceSystems.value = [{ type: 'rage', generate } as never];

      const passive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'resource_gen', target: 'self', stat: undefined, value: 30 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(state, makeLogMock(), makeMockCtx());
      p.loadPassives();

      p.onCombatStart();
      expect(generate).not.toHaveBeenCalled();
    });

    it('amount <= 0 时不调用 generate', () => {
      const generate = vi.fn();
      const state = makeStateMock();
      state.resourceSystems.value = [{ type: 'rage', generate } as never];

      const passive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'resource_gen', target: 'self', stat: 'rage', value: 0 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(state, makeLogMock(), makeMockCtx());
      p.loadPassives();

      p.onCombatStart();
      expect(generate).not.toHaveBeenCalled();
    });

    it('无匹配资源类型系统时不调用 generate', () => {
      const generate = vi.fn();
      const state = makeStateMock();
      state.resourceSystems.value = [{ type: 'mana', generate } as never];

      const passive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'resource_gen', target: 'self', stat: 'rage', value: 30 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(state, makeLogMock(), makeMockCtx());
      p.loadPassives();

      p.onCombatStart();
      expect(generate).not.toHaveBeenCalled();
    });
  });

  // -------------------- getDamageReduction --------------------

  describe('applyBuff：附加效果（仅记录日志）', () => {
    it('buff 效果触发时记录 passive_effect 日志', () => {
      const buffPassive = makePassive({
        id: 'bp',
        name: '附加效果被动',
        trigger: 'on_combat_start',
        effect: { type: 'buff', target: 'self', stat: 'poison', value: 0.3 },
      });
      getPassivesByClassIdMock.mockReturnValue([buffPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      passive.onCombatStart();

      const effectLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_effect');
      expect(effectLogs).toHaveLength(1);
      expect(effectLogs[0][0].message).toContain('附加效果');
      expect(effectLogs[0][0].message).toContain('poison');
    });

    it('buff 效果 stat 缺失时日志显示未知', () => {
      const buffPassive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'buff', target: 'self', stat: undefined, value: 0.3 },
      });
      getPassivesByClassIdMock.mockReturnValue([buffPassive]);

      const log = makeLogMock();
      const passive = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      passive.loadPassives();
      log.addCombatLog.mockClear();

      passive.onCombatStart();

      const effectLogs = log.addCombatLog.mock.calls.filter(c => c[0].eventType === 'passive_effect');
      expect(effectLogs).toHaveLength(1);
      expect(effectLogs[0][0].message).toContain('未知');
    });
  });

  describe('getDamageReduction：减伤比例（取最大值）', () => {
    it('无 damage_reduction 被动时返回 0', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({ effect: { type: 'stat_modifier', target: 'self', value: 0.2 } }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      expect(p.getDamageReduction()).toBe(0);
    });

    it('单个 damage_reduction 被动返回其 value', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({ effect: { type: 'damage_reduction', target: 'self', value: 0.2 } }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      expect(p.getDamageReduction()).toBe(0.2);
    });

    it('多个 damage_reduction 被动取最大值（不叠加）', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({ id: 'd1', effect: { type: 'damage_reduction', target: 'self', value: 0.15 } }),
        makePassive({ id: 'd2', effect: { type: 'damage_reduction', target: 'self', value: 0.3 } }),
        makePassive({ id: 'd3', effect: { type: 'damage_reduction', target: 'self', value: 0.1 } }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      expect(p.getDamageReduction()).toBe(0.3);
    });

    it('condition 不满足时跳过该被动', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp < 0.3' },
        }),
        makePassive({
          id: 'd2',
          effect: { type: 'damage_reduction', target: 'self', value: 0.1 },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // hp=100/100，d1 的 condition 不满足，仅 d2 生效
      characterMock.hp = 100;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.1);

      // hp=20/100，d1 的 condition 满足，取 max(0.3, 0.1) = 0.3
      characterMock.hp = 20;
      expect(p.getDamageReduction()).toBe(0.3);
    });
  });

  // -------------------- getStatModifiers --------------------

  describe('getStatModifiers：属性修正列表', () => {
    it('无 stat_modifier 被动时返回空数组', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({ effect: { type: 'damage_reduction', target: 'self', value: 0.2 } }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      expect(p.getStatModifiers()).toEqual([]);
    });

    it('返回所有满足条件的 stat_modifier 被动', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({ id: 's1', effect: { type: 'stat_modifier', target: 'self', stat: 'crit_damage', value: 0.5 } }),
        makePassive({ id: 's2', effect: { type: 'stat_modifier', target: 'self', stat: 'crit_chance', value: 0.1 } }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      const mods = p.getStatModifiers();
      expect(mods).toHaveLength(2);
      expect(mods).toContainEqual({ stat: 'crit_damage', value: 0.5 });
      expect(mods).toContainEqual({ stat: 'crit_chance', value: 0.1 });
    });

    it('condition 不满足时跳过该被动', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 's1',
          effect: { type: 'stat_modifier', target: 'self', stat: 'crit_damage', value: 0.5, condition: 'hp < 0.3' },
        }),
        makePassive({
          id: 's2',
          effect: { type: 'stat_modifier', target: 'self', stat: 'crit_chance', value: 0.1 },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      characterMock.hp = 100;
      characterMock.maxHp = 100;
      const modsHigh = p.getStatModifiers();
      expect(modsHigh).toHaveLength(1);
      expect(modsHigh[0].stat).toBe('crit_chance');

      characterMock.hp = 20;
      const modsLow = p.getStatModifiers();
      expect(modsLow).toHaveLength(2);
    });

    it('stat 缺失的被动不加入结果', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 's1',
          effect: { type: 'stat_modifier', target: 'self', stat: undefined, value: 0.5 },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      expect(p.getStatModifiers()).toEqual([]);
    });
  });

  // -------------------- evaluateCondition（通过 getDamageReduction 间接测试） --------------------

  describe('evaluateCondition：条件表达式运算符', () => {
    it('`<=` 运算符：hpRatio <= 阈值时满足', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp <= 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // hp=30/100=0.3，0.3 <= 0.3 为 true → 减伤 0.3
      characterMock.hp = 30;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);

      // hp=50/100=0.5，0.5 <= 0.3 为 false → 减伤 0
      characterMock.hp = 50;
      expect(p.getDamageReduction()).toBe(0);
    });

    it('`>` 运算符：hpRatio > 阈值时满足', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp > 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // hp=50/100=0.5，0.5 > 0.3 为 true → 减伤 0.3
      characterMock.hp = 50;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);

      // hp=20/100=0.2，0.2 > 0.3 为 false → 减伤 0
      characterMock.hp = 20;
      expect(p.getDamageReduction()).toBe(0);
    });

    it('`>=` 运算符：hpRatio >= 阈值时满足', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp >= 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // hp=30/100=0.3，0.3 >= 0.3 为 true → 减伤 0.3
      characterMock.hp = 30;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);

      // hp=20/100=0.2，0.2 >= 0.3 为 false → 减伤 0
      characterMock.hp = 20;
      expect(p.getDamageReduction()).toBe(0);
    });

    it('`==` 运算符：hpRatio == 阈值时满足', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp == 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // hp=30/100=0.3，0.3 == 0.3 为 true → 减伤 0.3
      characterMock.hp = 30;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);

      // hp=50/100=0.5，0.5 == 0.3 为 false → 减伤 0
      characterMock.hp = 50;
      expect(p.getDamageReduction()).toBe(0);
    });

    it('`!=` 运算符：hpRatio != 阈值时满足', () => {
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp != 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // hp=50/100=0.5，0.5 != 0.3 为 true → 减伤 0.3
      characterMock.hp = 50;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);

      // hp=30/100=0.3，0.3 != 0.3 为 false → 减伤 0
      characterMock.hp = 30;
      expect(p.getDamageReduction()).toBe(0);
    });

    it('未知运算符走 default 分支返回 true（条件恒满足）', () => {
      // `<>` 匹配正则的 ([<>=!]+) 但不在 switch 已知 case 中
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'hp <> 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // default 返回 true，无论 hp 如何均满足
      characterMock.hp = 100;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);

      characterMock.hp = 20;
      expect(p.getDamageReduction()).toBe(0.3);
    });

    it('条件不匹配正则时返回 true（条件恒满足）', () => {
      // 无运算符的纯文本条件，不匹配 /(\w+)\s*([<>=!]+)\s*([\d.]+)/
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'always' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      characterMock.hp = 100;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);
    });

    it('非 hp 的 stat 名时 currentValue 保持 0', () => {
      // stat='mp' 不匹配 'hp'，currentValue 保持 0
      getPassivesByClassIdMock.mockReturnValue([
        makePassive({
          id: 'd1',
          effect: { type: 'damage_reduction', target: 'self', value: 0.3, condition: 'mp < 0.3' },
        }),
      ]);
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // currentValue=0, 0 < 0.3 为 true → 减伤 0.3
      characterMock.hp = 100;
      characterMock.maxHp = 100;
      expect(p.getDamageReduction()).toBe(0.3);
    });
  });

  // -------------------- 边界分支补充：healAmount=0 与 stat 缺失 --------------------

  describe('边界分支补充：applyHeal 与 applyStatModifier falsy 路径', () => {
    it('on_attack 吸血计算结果为 0 时不治疗', () => {
      // 覆盖 usePassiveSkills.ts 第 193 行：if (healAmount > 0) falsy 分支
      // damage × value 向下取整为 0
      const passive = makePassive({
        trigger: 'on_attack',
        effect: { type: 'heal', target: 'self', value: 0.1 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      // damage=5, value=0.1 → floor(0.5)=0，不治疗
      p.onAttack(5);
      expect(characterMock.receiveHeal).not.toHaveBeenCalled();
    });

    it('on_turn_start 百分比治疗计算结果为 0 时不治疗', () => {
      // 覆盖 usePassiveSkills.ts 第 193 行：if (healAmount > 0) falsy 分支（else 路径）
      const passive = makePassive({
        trigger: 'on_turn_start',
        effect: { type: 'heal', target: 'self', value: 0.001 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      p.loadPassives();

      characterMock.hp = 50;
      characterMock.maxHp = 50;
      // maxHp × value = 50 × 0.001 = 0.05 → floor=0，不治疗
      p.onTurnStart();
      expect(characterMock.receiveHeal).not.toHaveBeenCalled();
    });

    it('stat_modifier 被动 stat 缺失时不记录日志', () => {
      // 覆盖 usePassiveSkills.ts 第 215 行：if (effect.stat) falsy 分支
      const passive = makePassive({
        trigger: 'on_combat_start',
        effect: { type: 'stat_modifier', target: 'self', stat: undefined, value: 0.2 },
      });
      getPassivesByClassIdMock.mockReturnValue([passive]);

      const log = makeLogMock();
      const p = usePassiveSkills(makeStateMock(), log, makeMockCtx());
      p.loadPassives();

      p.onCombatStart();

      // stat 缺失，不记录 passive_effect 日志
      const statModCalls = vi.mocked(log.addCombatLog).mock.calls.filter(
        call => call[0] && typeof call[0] === 'object' && 'eventType' in call[0] && (call[0] as { eventType: string }).eventType === 'passive_effect' && typeof (call[0] as { message: string }).message === 'string' && (call[0] as { message: string }).message.startsWith('属性修正')
      );
      expect(statModCalls.length).toBe(0);
    });
  });

  // -------------------- 返回值结构 --------------------

  describe('返回值结构', () => {
    it('返回包含 9 个方法的对象', () => {
      const p = usePassiveSkills(makeStateMock(), makeLogMock(), makeMockCtx());
      expect(typeof p.loadPassives).toBe('function');
      expect(typeof p.onCombatStart).toBe('function');
      expect(typeof p.onTurnStart).toBe('function');
      expect(typeof p.onAttack).toBe('function');
      expect(typeof p.onDamaged).toBe('function');
      expect(typeof p.onKill).toBe('function');
      expect(typeof p.getPassives).toBe('function');
      expect(typeof p.getDamageReduction).toBe('function');
      expect(typeof p.getStatModifiers).toBe('function');
    });
  });
});
