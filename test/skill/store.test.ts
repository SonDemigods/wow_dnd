/**
 * @fileoverview 技能模块 Pinia Store 单元测试
 *
 * 覆盖 useSkillStore 的：
 * 1. State 初始值（skills/skillBar/skillTemplates/monsterSkillTemplates/
 *    currentCharacterId/isLoading/cooldowns 均为初始值）
 * 2. Getters：
 *    - unlockedSkills / lockedSkills（按 characterStore.level 过滤）
 *    - equippedSkills（skillBar.slots → Skill 对象映射，空槽返回 null）
 *    - skillBarSlots（带 index/skillId/skill/isEmpty 详情）
 *    - skillCountByType（按 SkillType 统计，包含全部 6 个键）
 * 3. Actions：
 *    - initialize（charId 空短路 / 加载模板 + 怪物模板 + char_skills / ID 还原 / checkLevelUnlocks(false)）
 *    - learnSkill（模板不存在 / canLearnSkill 失败 / 成功学习自动装备空槽 + persist + emit + 日志）
 *    - castSkill（技能不存在 / 法力不足 / 冷却中 / physical/magic_damage / health_restore /
 *      mana_restore / buff/debuff / emit SKILL_CAST + 日志 / 冷却记录）
 *    - equipSkill（无效槽位 / 模板不存在 / 等级不足 / 已学装备 / 从模板添加并装备）
 *    - unequipSkill（未装备返回 false / 成功置 null）
 *    - swapSkills（相同槽位 / 成功交换）
 *    - 查询方法（getSkill 三级回退 / getAvailableSkills / getSkillsByType / canUseSkill 综合校验）
 *    - loadTemplatesForClass（classId 空短路 / 成功清空旧缓存并填充新 Map）
 *    - loadMonsterSkillTemplates（清空旧缓存并填充新 Map）
 *    - checkLevelUnlocks（shouldAutoEquip=false / true / 无新技能不 persist）
 *    - addSkillTemplate / removeSkillTemplate（同时更新内存缓存和 DB）
 *    - 冷却管理（tickCooldowns 减 1 到 0 删除 / isOnCooldown / getCooldownRemaining）
 *    - reset（清空全部状态 + persist）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - skillsDbService 全量 mock。
 *  - skill service 纯函数（calculateSkillDamage/calculateBuffValue/canLearnSkill/
 *    validateSkillBarSlot/canCastSkill）mock 返回可控结果。
 *  - character/log store stub；generateLogId mock。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 断言 emit，beforeEach 调用 clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { Skill, SkillType, SkillBar, SkillSlotIndex } from '@/modules/skill/types';
import type { Character, Stats } from '@/modules/character/types';

// ==================== vi.hoisted：跨 store stub 持有对象 ====================
const mocks = vi.hoisted(() => ({
  characterStore: {
    level: 1,
    classId: 'warrior' as const,
    effectiveStats: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    } as Stats,
    getCharacterData: vi.fn(() => ({ mana: 100 }) as Partial<Character>),
    getCharacterId: vi.fn(() => 'char_1'),
    changeMp: vi.fn().mockResolvedValue(undefined),
    receiveHeal: vi.fn().mockResolvedValue(undefined),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
}));

// ==================== Mock：skill db ====================
vi.mock('@/modules/skill/db', () => ({
  skillsDbService: {
    saveSkillsData: vi.fn().mockResolvedValue(undefined),
    getSkillsData: vi.fn().mockResolvedValue({
      characterId: 'char_1',
      skills: [],
      skillBar: { slots: [null, null, null, null] },
      currentClass: null,
      updatedAt: 0,
    }),
    deleteSkillsData: vi.fn().mockResolvedValue(undefined),
    saveSkillTemplate: vi.fn().mockResolvedValue(undefined),
    getSkillTemplate: vi.fn().mockResolvedValue(null),
    getAllSkillTemplates: vi.fn().mockResolvedValue([]),
    getSkillTemplatesByClass: vi.fn().mockResolvedValue([]),
    getMonsterSkillTemplates: vi.fn().mockResolvedValue([]),
    deleteSkillTemplate: vi.fn().mockResolvedValue(undefined),
  },
}));

// ==================== Mock：skill service 纯函数 ====================
vi.mock('@/modules/skill/service', () => ({
  calculateSkillDamage: vi.fn(() => 50),
  calculateBuffValue: vi.fn(() => 20),
  canLearnSkill: vi.fn(() => true),
  validateSkillBarSlot: vi.fn((slot: number) => slot >= 0 && slot <= 3),
  canCastSkill: vi.fn(() => ({ canCast: true, reason: '' })),
}));

// ==================== Mock：log service ====================
vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log_test_1'),
}));

// ==================== Mock：跨 store 依赖 ====================
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => mocks.characterStore,
}));
vi.mock('@/modules/log/store', () => ({
  useLogStore: () => mocks.logStore,
}));

// ==================== 取出 spy 引用 ====================
import { skillsDbService } from '@/modules/skill/db';
import {
  calculateSkillDamage,
  calculateBuffValue,
  canLearnSkill,
  validateSkillBarSlot,
  canCastSkill,
} from '@/modules/skill/service';
import { useSkillStore } from '@/modules/skill/store';

// ==================== 测试数据构造 helper ====================

function makeSkill(o: Partial<Skill> = {}): Skill {
  return {
    id: 'skill_001',
    name: '测试技能',
    icon: 'game-icons:sword-brandish',
    description: '测试用技能',
    mpCost: 10,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 30 },
    unlockLevel: 1,
    cooldown: 0,
    ...o,
  };
}

function makeStats(o: Partial<Stats> = {}): Stats {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    ...o,
  };
}

/** 构造一个全空的 SkillBar */
function emptySkillBar(): SkillBar {
  return { slots: [null, null, null, null] };
}

// ==================== 测试用例 ====================

describe('useSkillStore - 技能 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
    // 重置 characterStore stub 默认值
    mocks.characterStore.level = 1;
    mocks.characterStore.classId = 'warrior';
    mocks.characterStore.effectiveStats = makeStats();
    mocks.characterStore.getCharacterData.mockReturnValue({ mana: 100 } as Partial<Character>);
    mocks.characterStore.getCharacterId.mockReturnValue('char_1');
    mocks.characterStore.changeMp.mockResolvedValue(undefined);
    mocks.characterStore.receiveHeal.mockResolvedValue(undefined);
    // 重置 db service 默认返回值（确保 once-mock 不受前次测试残留影响）
    vi.mocked(skillsDbService.saveSkillsData).mockResolvedValue(undefined);
    vi.mocked(skillsDbService.getSkillsData).mockResolvedValue({
      characterId: 'char_1',
      skills: [],
      skillBar: emptySkillBar(),
      currentClass: null,
      updatedAt: 0,
    });
    vi.mocked(skillsDbService.getSkillTemplatesByClass).mockResolvedValue([]);
    vi.mocked(skillsDbService.getMonsterSkillTemplates).mockResolvedValue([]);
    vi.mocked(skillsDbService.saveSkillTemplate).mockResolvedValue(undefined);
    vi.mocked(skillsDbService.deleteSkillTemplate).mockResolvedValue(undefined);
    // 重置 service 纯函数默认返回值
    vi.mocked(calculateSkillDamage).mockReturnValue(50);
    vi.mocked(calculateBuffValue).mockReturnValue(20);
    vi.mocked(canLearnSkill).mockReturnValue(true);
    vi.mocked(validateSkillBarSlot).mockImplementation((slot: number) => slot >= 0 && slot <= 3);
    vi.mocked(canCastSkill).mockReturnValue({ canCast: true, reason: '' });
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('skills 初始为空数组，skillBar.slots 全为 null', () => {
      const store = useSkillStore();
      expect(store.skills).toEqual([]);
      expect(store.skillBar.slots).toEqual([null, null, null, null]);
    });

    it('skillTemplates/monsterSkillTemplates 初始为空 Map，cooldowns 初始为空对象', () => {
      const store = useSkillStore();
      expect(store.skillTemplates.size).toBe(0);
      expect(store.monsterSkillTemplates.size).toBe(0);
      expect(store.cooldowns).toEqual({});
    });

    it('currentCharacterId 初始为 null，isLoading 初始为 false', () => {
      const store = useSkillStore();
      expect(store.currentCharacterId).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('unlockedSkills：返回 unlockLevel <= characterStore.level 的技能', () => {
      const store = useSkillStore();
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const s2 = makeSkill({ id: 's2', unlockLevel: 5 });
      store.$patch({ skills: [s1, s2] });
      mocks.characterStore.level = 3;
      expect(store.unlockedSkills).toEqual([s1]);
    });

    it('lockedSkills：返回 unlockLevel > characterStore.level 的技能', () => {
      const store = useSkillStore();
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const s2 = makeSkill({ id: 's2', unlockLevel: 5 });
      store.$patch({ skills: [s1, s2] });
      mocks.characterStore.level = 3;
      expect(store.lockedSkills).toEqual([s2]);
    });

    it('equippedSkills：通过 skillBar.slots 映射 Skill 对象，空槽返回 null，未找到也返回 null', () => {
      const store = useSkillStore();
      const s1 = makeSkill({ id: 's1' });
      store.$patch({
        skills: [s1],
        skillBar: { slots: ['s1', null, 'unknown', null] },
      });
      expect(store.equippedSkills).toEqual([s1, null, null, null]);
    });

    it('skillBarSlots：返回带 index/skillId/skill/isEmpty 的详情数组', () => {
      const store = useSkillStore();
      const s1 = makeSkill({ id: 's1' });
      store.$patch({
        skills: [s1],
        skillBar: { slots: ['s1', null, null, null] },
      });
      const slots = store.skillBarSlots;
      expect(slots[0]).toEqual({
        index: 0,
        skillId: 's1',
        skill: s1,
        isEmpty: false,
      });
      expect(slots[1]).toEqual({
        index: 1,
        skillId: null,
        skill: null,
        isEmpty: true,
      });
    });

    it('skillCountByType：按类型统计，包含全部 6 个 SkillType 键', () => {
      const store = useSkillStore();
      store.$patch({
        skills: [
          makeSkill({ id: 's1', type: 'physical_damage' }),
          makeSkill({ id: 's2', type: 'physical_damage' }),
          makeSkill({ id: 's3', type: 'health_restore' }),
          makeSkill({ id: 's4', type: 'buff' }),
        ],
      });
      const counts = store.skillCountByType;
      expect(counts.physical_damage).toBe(2);
      expect(counts.magic_damage).toBe(0);
      expect(counts.health_restore).toBe(1);
      expect(counts.mana_restore).toBe(0);
      expect(counts.buff).toBe(1);
      expect(counts.debuff).toBe(0);
    });
  });

  // -------------------- Actions：initialize --------------------
  describe('Actions：initialize', () => {
    it('charId 为空（且 characterStore.getCharacterId 返回 null）时直接返回，不加载', async () => {
      mocks.characterStore.getCharacterId.mockReturnValue(null);
      const store = useSkillStore();
      await store.initialize();
      expect(store.isLoading).toBe(false);
      expect(skillsDbService.getSkillsData).not.toHaveBeenCalled();
    });

    it('成功初始化：加载模板 → 怪物模板 → char_skills → 还原 skills → checkLevelUnlocks(false)', async () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const monsterSkill = makeSkill({ id: 'm1', unlockLevel: 1 });
      vi.mocked(skillsDbService.getSkillTemplatesByClass).mockResolvedValue([s1]);
      vi.mocked(skillsDbService.getMonsterSkillTemplates).mockResolvedValue([monsterSkill]);
      vi.mocked(skillsDbService.getSkillsData).mockResolvedValue({
        characterId: 'char_1',
        skills: ['s1'],
        skillBar: { slots: ['s1', null, null, null] },
        currentClass: 'warrior',
        updatedAt: 100,
      });

      const store = useSkillStore();
      await store.initialize('char_1');

      expect(store.currentCharacterId).toBe('char_1');
      expect(store.skillTemplates.size).toBe(1);
      expect(store.skillTemplates.get('s1')).toEqual(s1);
      expect(store.monsterSkillTemplates.size).toBe(1);
      expect(store.monsterSkillTemplates.get('m1')).toEqual(monsterSkill);
      expect(store.skills).toEqual([s1]);
      expect(store.skillBar.slots).toEqual(['s1', null, null, null]);
      expect(store.isLoading).toBe(false);
    });

    it('data.skills 中未在模板缓存的 ID 被过滤（filter undefined）', async () => {
      const s1 = makeSkill({ id: 's1' });
      vi.mocked(skillsDbService.getSkillTemplatesByClass).mockResolvedValue([s1]);
      vi.mocked(skillsDbService.getSkillsData).mockResolvedValue({
        characterId: 'char_1',
        skills: ['s1', 'unknown_id'],
        skillBar: emptySkillBar(),
        currentClass: 'warrior',
        updatedAt: 0,
      });

      const store = useSkillStore();
      await store.initialize('char_1');

      expect(store.skills).toEqual([s1]);
      expect(store.skills.length).toBe(1);
    });

    it('使用 characterStore.getCharacterId() 作为默认 charId', async () => {
      vi.mocked(skillsDbService.getSkillTemplatesByClass).mockResolvedValue([]);
      vi.mocked(skillsDbService.getMonsterSkillTemplates).mockResolvedValue([]);
      mocks.characterStore.getCharacterId.mockReturnValue('auto_char');

      const store = useSkillStore();
      await store.initialize();

      expect(skillsDbService.getSkillsData).toHaveBeenCalledWith('auto_char');
      expect(store.currentCharacterId).toBe('auto_char');
    });
  });

  // -------------------- Actions：learnSkill --------------------
  describe('Actions：learnSkill', () => {
    it('模板不存在时返回 false，不修改 skills', async () => {
      const store = useSkillStore();
      const result = await store.learnSkill('unknown');
      expect(result).toBe(false);
      expect(store.skills).toEqual([]);
    });

    it('canLearnSkill 返回 false 时返回 false', async () => {
      vi.mocked(canLearnSkill).mockReturnValue(false);
      const store = useSkillStore();
      const s1 = makeSkill({ id: 's1' });
      store.skillTemplates.set('s1', s1);

      const result = await store.learnSkill('s1');

      expect(result).toBe(false);
      expect(store.skills).toEqual([]);
    });

    it('成功学习：添加 skills + 自动装备空槽 + persist + emit SKILL_LEARNED + 日志', async () => {
      const s1 = makeSkill({ id: 's1', name: '挥砍' });
      const spy = vi.fn();
      eventBus.on(GameEvents.SKILL_LEARNED, spy);
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);

      const result = await store.learnSkill('s1');

      expect(result).toBe(true);
      expect(store.skills).toHaveLength(1);
      expect(store.skills[0]).toEqual(s1);
      // 自动装备到第一个空槽位
      expect(store.skillBar.slots[0]).toBe('s1');
      // persist 被调用
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
      // emit SKILL_LEARNED 事件
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ skill: s1 });
      // 记录日志
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledTimes(1);
      const logArg = mocks.logStore.addLogEntry.mock.calls[0][0];
      expect(logArg.message).toContain('挥砍');
      expect(logArg.type).toBe('skill');
    });

    it('技能栏已满时学习成功但不装备', async () => {
      const s1 = makeSkill({ id: 's1' });
      const s2 = makeSkill({ id: 's2' });
      const s3 = makeSkill({ id: 's3' });
      const s4 = makeSkill({ id: 's4' });
      const s5 = makeSkill({ id: 's5' });
      const store = useSkillStore();
      store.$patch({
        skills: [s1, s2, s3, s4],
        skillBar: { slots: ['s1', 's2', 's3', 's4'] },
      });
      store.skillTemplates.set('s5', s5);

      const result = await store.learnSkill('s5');

      expect(result).toBe(true);
      expect(store.skills).toHaveLength(5);
      // 技能栏保持不变（无空槽）
      expect(store.skillBar.slots).toEqual(['s1', 's2', 's3', 's4']);
    });

    it('persist 调用 saveSkillsData 时传入正确的 charId 与 ID 数组', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      // 直接设置 currentCharacterId，避免 initialize 的 checkLevelUnlocks 副作用
      store.$patch({ currentCharacterId: 'char_1' });

      const result = await store.learnSkill('s1');

      expect(result).toBe(true);
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
      const arg = vi.mocked(skillsDbService.saveSkillsData).mock.calls[0][0];
      expect(arg.characterId).toBe('char_1');
      expect(arg.skills).toEqual(['s1']);
    });
  });

  // -------------------- Actions：castSkill --------------------
  describe('Actions：castSkill', () => {
    it('技能不存在时返回失败结果，不消耗资源', async () => {
      const store = useSkillStore();
      const result = await store.castSkill('unknown');
      expect(result.success).toBe(false);
      expect(result.skillId).toBe('unknown');
      expect(result.message).toBe('技能不存在');
      expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
    });

    it('canCastSkill 返回不可施放时返回失败结果', async () => {
      vi.mocked(canCastSkill).mockReturnValue({ canCast: false, reason: '法力不足' });
      const s1 = makeSkill({ id: 's1', mpCost: 50 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('法力不足');
      expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
    });

    it('冷却中返回失败结果，message 包含剩余回合', async () => {
      const s1 = makeSkill({ id: 's1', cooldown: 3 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      // 手动设置冷却
      store.$patch({ cooldowns: { s1: 2 } });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('2');
      expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
    });

    it('physical_damage 成功：返回 damage，调用 changeMp 消耗法力，emit SKILL_CAST', async () => {
      const s1 = makeSkill({ id: 's1', type: 'physical_damage', mpCost: 10, name: '挥砍' });
      vi.mocked(calculateSkillDamage).mockReturnValue(80);
      const spy = vi.fn();
      eventBus.on(GameEvents.SKILL_CAST, spy);
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(true);
      expect(result.damage).toBe(80);
      expect(result.type).toBe('physical_damage');
      expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(-10);
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ skill: s1, success: true });
    });

    it('health_restore 成功：返回 heal，不调用 receiveHeal（由调用方应用 healBonus + 暴击）', async () => {
      const s1 = makeSkill({ id: 's1', type: 'health_restore', mpCost: 5, name: '治疗术' });
      vi.mocked(calculateSkillDamage).mockReturnValue(60);
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(true);
      expect(result.heal).toBe(60);
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
    });

    it('mana_restore 成功：调用 changeMp 两次（消耗 + 恢复）', async () => {
      const s1 = makeSkill({ id: 's1', type: 'mana_restore', mpCost: 5, name: '法力恢复' });
      vi.mocked(calculateSkillDamage).mockReturnValue(40);
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(true);
      expect(mocks.characterStore.changeMp).toHaveBeenCalledTimes(2);
      expect(mocks.characterStore.changeMp).toHaveBeenNthCalledWith(1, -5);
      expect(mocks.characterStore.changeMp).toHaveBeenNthCalledWith(2, 40);
    });

    it('buff 成功：返回 appliedEffects，由 calculateBuffValue 计算效果值', async () => {
      const s1 = makeSkill({
        id: 's1',
        type: 'buff',
        mpCost: 5,
        name: '攻击增益',
        buffs: [
          { type: 'attack_up', value: 10, turns: 3 },
          { type: 'shield', value: 20, turns: 2 },
        ],
      });
      vi.mocked(calculateBuffValue).mockImplementation((_be, stats) => {
        return 10 + stats.wis * 0.3;
      });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(true);
      expect(result.appliedEffects).toHaveLength(2);
      expect(result.appliedEffects![0]).toEqual({
        type: 'attack_up',
        value: 13, // 10 + 10 * 0.3 = 13
        turns: 3,
      });
      expect(calculateBuffValue).toHaveBeenCalledTimes(2);
    });

    it('skipAdventureLog=true 时不记录冒险日志', async () => {
      const s1 = makeSkill({ id: 's1', name: '挥砍' });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      await store.castSkill('s1', true);

      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
    });

    it('技能有冷却时记录冷却回合数', async () => {
      const s1 = makeSkill({ id: 's1', cooldown: 3 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      await store.castSkill('s1');

      expect(store.cooldowns.s1).toBe(3);
    });

    it('技能无冷却（cooldown=0）时不记录冷却', async () => {
      const s1 = makeSkill({ id: 's1', cooldown: 0 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      await store.castSkill('s1');

      expect(store.cooldowns.s1).toBeUndefined();
    });
  });

  // -------------------- Actions：equipSkill / unequipSkill / swapSkills --------------------
  describe('Actions：equipSkill / unequipSkill / swapSkills', () => {
    it('equipSkill：无效槽位返回 false', async () => {
      vi.mocked(validateSkillBarSlot).mockReturnValue(false);
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);

      const result = await store.equipSkill('s1', 5 as SkillSlotIndex);

      expect(result).toBe(false);
    });

    it('equipSkill：模板不存在且未学习返回 false', async () => {
      const store = useSkillStore();
      const result = await store.equipSkill('unknown', 0);
      expect(result).toBe(false);
    });

    it('equipSkill：等级不足返回 false', async () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 10 });
      mocks.characterStore.level = 1;
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);

      const result = await store.equipSkill('s1', 0);

      expect(result).toBe(false);
    });

    it('equipSkill：成功装备已学技能到指定槽位 + persist', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.$patch({ skills: [s1], skillBar: emptySkillBar() });

      const result = await store.equipSkill('s1', 2);

      expect(result).toBe(true);
      expect(store.skillBar.slots[2]).toBe('s1');
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
    });

    it('equipSkill：从模板直接装备时自动添加到 skills 列表', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      // skills 列表为空

      const result = await store.equipSkill('s1', 0);

      expect(result).toBe(true);
      expect(store.skills).toHaveLength(1);
      expect(store.skills[0]).toEqual(s1);
      expect(store.skillBar.slots[0]).toBe('s1');
    });

    it('unequipSkill：未装备返回 false', async () => {
      const store = useSkillStore();
      store.$patch({ skillBar: emptySkillBar() });

      const result = await store.unequipSkill('s1');

      expect(result).toBe(false);
    });

    it('unequipSkill：成功卸下置 null + persist', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.$patch({
        skills: [s1],
        skillBar: { slots: ['s1', null, null, null] },
      });

      const result = await store.unequipSkill('s1');

      expect(result).toBe(true);
      expect(store.skillBar.slots[0]).toBeNull();
      // 已学技能不从列表移除
      expect(store.skills).toEqual([s1]);
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
    });

    it('swapSkills：相同槽位返回 false', async () => {
      const store = useSkillStore();
      const result = await store.swapSkills(1, 1);
      expect(result).toBe(false);
    });

    it('swapSkills：成功交换两个槽位 + persist', async () => {
      const store = useSkillStore();
      store.$patch({
        skillBar: { slots: ['s1', 's2', null, null] },
      });

      const result = await store.swapSkills(0, 1);

      expect(result).toBe(true);
      expect(store.skillBar.slots[0]).toBe('s2');
      expect(store.skillBar.slots[1]).toBe('s1');
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- Actions：查询方法 --------------------
  describe('Actions：查询方法', () => {
    it('getSkill：三级回退（skills → skillTemplates → monsterSkillTemplates）', () => {
      const s1 = makeSkill({ id: 's1' });
      const s2 = makeSkill({ id: 's2' });
      const s3 = makeSkill({ id: 's3' });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      store.skillTemplates.set('s2', s2);
      store.monsterSkillTemplates.set('s3', s3);

      expect(store.getSkill('s1')).toEqual(s1);
      expect(store.getSkill('s2')).toEqual(s2);
      expect(store.getSkill('s3')).toEqual(s3);
      expect(store.getSkill('unknown')).toBeNull();
    });

    it('getAvailableSkills：代理 unlockedSkills 计算属性', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const s2 = makeSkill({ id: 's2', unlockLevel: 10 });
      const store = useSkillStore();
      store.$patch({ skills: [s1, s2] });
      mocks.characterStore.level = 5;

      expect(store.getAvailableSkills()).toEqual([s1]);
    });

    it('getSkillsByType：按 SkillType 过滤', () => {
      const s1 = makeSkill({ id: 's1', type: 'physical_damage' });
      const s2 = makeSkill({ id: 's2', type: 'magic_damage' });
      const s3 = makeSkill({ id: 's3', type: 'physical_damage' });
      const store = useSkillStore();
      store.$patch({ skills: [s1, s2, s3] });

      expect(store.getSkillsByType('physical_damage')).toEqual([s1, s3]);
      expect(store.getSkillsByType('magic_damage')).toEqual([s2]);
      expect(store.getSkillsByType('buff')).toEqual([]);
    });

    it('canUseSkill：技能不存在返回 false', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 5, mpCost: 50 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      expect(store.canUseSkill('unknown')).toBe(false);
    });

    it('canUseSkill：等级不足返回 false', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 5, mpCost: 50 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      mocks.characterStore.level = 1;
      expect(store.canUseSkill('s1')).toBe(false);
    });

    it('canUseSkill：法力不足返回 false', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 5, mpCost: 50 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      mocks.characterStore.level = 5;
      vi.mocked(canCastSkill).mockReturnValue({ canCast: false, reason: '法力不足' });
      expect(store.canUseSkill('s1')).toBe(false);
    });

    it('canUseSkill：冷却中返回 false', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 5, mpCost: 50 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      mocks.characterStore.level = 5;
      vi.mocked(canCastSkill).mockReturnValue({ canCast: true, reason: '' });
      store.$patch({ cooldowns: { s1: 2 } });
      expect(store.canUseSkill('s1')).toBe(false);
    });

    it('canUseSkill：全满足返回 true', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 5, mpCost: 50 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      mocks.characterStore.level = 5;
      // canCastSkill 默认返回 { canCast: true }（beforeEach 设置）
      expect(store.canUseSkill('s1')).toBe(true);
    });
  });

  // -------------------- Actions：loadTemplatesForClass / loadMonsterSkillTemplates --------------------
  describe('Actions：loadTemplatesForClass / loadMonsterSkillTemplates', () => {
    it('loadTemplatesForClass：classId 为空时清空缓存且不查询 DB', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);

      await store.loadTemplatesForClass('');

      expect(store.skillTemplates.size).toBe(0);
      expect(skillsDbService.getSkillTemplatesByClass).not.toHaveBeenCalled();
    });

    it('loadTemplatesForClass：成功清空旧缓存并填充新 Map', async () => {
      const s1 = makeSkill({ id: 's1' });
      const s2 = makeSkill({ id: 's2' });
      vi.mocked(skillsDbService.getSkillTemplatesByClass).mockResolvedValue([s1, s2]);
      const store = useSkillStore();
      store.skillTemplates.set('old', makeSkill({ id: 'old' }));

      await store.loadTemplatesForClass('warrior');

      expect(store.skillTemplates.size).toBe(2);
      expect(store.skillTemplates.get('s1')).toEqual(s1);
      expect(store.skillTemplates.get('s2')).toEqual(s2);
      expect(store.skillTemplates.get('old')).toBeUndefined();
      expect(skillsDbService.getSkillTemplatesByClass).toHaveBeenCalledWith('warrior');
    });

    it('loadMonsterSkillTemplates：成功清空旧缓存并填充新 Map', async () => {
      const m1 = makeSkill({ id: 'm1' });
      vi.mocked(skillsDbService.getMonsterSkillTemplates).mockResolvedValue([m1]);
      const store = useSkillStore();
      store.monsterSkillTemplates.set('old', makeSkill({ id: 'old' }));

      await store.loadMonsterSkillTemplates();

      expect(store.monsterSkillTemplates.size).toBe(1);
      expect(store.monsterSkillTemplates.get('m1')).toEqual(m1);
      expect(store.monsterSkillTemplates.get('old')).toBeUndefined();
      expect(skillsDbService.getMonsterSkillTemplates).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- Actions：checkLevelUnlocks --------------------
  describe('Actions：checkLevelUnlocks', () => {
    it('shouldAutoEquip=false：解锁新技能但不自动装备', async () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      mocks.characterStore.level = 1;
      // skills 初始为空，s1 应被解锁

      await store.checkLevelUnlocks(false);

      expect(store.skills).toEqual([s1]);
      expect(store.skillBar.slots).toEqual([null, null, null, null]);
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
    });

    it('shouldAutoEquip=true：解锁新技能并自动装备到空槽', async () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 1, name: '挥砍' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      mocks.characterStore.level = 1;

      await store.checkLevelUnlocks(true);

      expect(store.skills).toEqual([s1]);
      expect(store.skillBar.slots[0]).toBe('s1');
      // 触发学习事件 + 日志
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledTimes(1);
    });

    it('无新技能解锁时不 persist', async () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      store.skillTemplates.set('s1', s1);
      mocks.characterStore.level = 1;

      await store.checkLevelUnlocks(true);

      expect(skillsDbService.saveSkillsData).not.toHaveBeenCalled();
    });

    it('等级不足的模板不被解锁', async () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 10 });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      mocks.characterStore.level = 5;

      await store.checkLevelUnlocks(true);

      expect(store.skills).toEqual([]);
      expect(skillsDbService.saveSkillsData).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：addSkillTemplate / removeSkillTemplate --------------------
  describe('Actions：addSkillTemplate / removeSkillTemplate', () => {
    it('addSkillTemplate：同时更新内存缓存和 DB', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();

      await store.addSkillTemplate(s1);

      expect(store.skillTemplates.get('s1')).toEqual(s1);
      expect(skillsDbService.saveSkillTemplate).toHaveBeenCalledWith(s1);
    });

    it('removeSkillTemplate：从内存缓存和 DB 同时移除', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);

      await store.removeSkillTemplate('s1');

      expect(store.skillTemplates.get('s1')).toBeUndefined();
      expect(skillsDbService.deleteSkillTemplate).toHaveBeenCalledWith('s1');
    });
  });

  // -------------------- Actions：冷却管理 --------------------
  describe('Actions：冷却管理', () => {
    it('tickCooldowns：所有冷却减 1，到 0 的条目被删除', () => {
      const store = useSkillStore();
      store.$patch({ cooldowns: { s1: 3, s2: 1, s3: 2 } });

      store.tickCooldowns();

      expect(store.cooldowns.s1).toBe(2);
      expect(store.cooldowns.s2).toBeUndefined(); // 减到 0 被删除
      expect(store.cooldowns.s3).toBe(1);
    });

    it('isOnCooldown：返回 true / false', () => {
      const store = useSkillStore();
      store.$patch({ cooldowns: { s1: 2 } });

      expect(store.isOnCooldown('s1')).toBe(true);
      expect(store.isOnCooldown('s2')).toBe(false);
    });

    it('getCooldownRemaining：返回剩余回合数（0 = 无冷却）', () => {
      const store = useSkillStore();
      store.$patch({ cooldowns: { s1: 3 } });

      expect(store.getCooldownRemaining('s1')).toBe(3);
      expect(store.getCooldownRemaining('unknown')).toBe(0);
    });

    it('resetCooldowns：清空所有冷却（战斗开始时调用）', () => {
      const store = useSkillStore();
      store.$patch({ cooldowns: { s1: 3, s2: 1, s3: 2 } });

      store.resetCooldowns();

      expect(store.cooldowns).toEqual({});
    });
  });

  // -------------------- Actions：reset --------------------
  describe('Actions：reset', () => {
    it('reset：清空全部状态并 persist', async () => {
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.$patch({
        skills: [s1],
        skillBar: { slots: ['s1', null, null, null] },
        cooldowns: { s1: 2 },
        currentCharacterId: 'char_1',
      });
      store.skillTemplates.set('s1', s1);
      store.monsterSkillTemplates.set('m1', makeSkill({ id: 'm1' }));

      await store.reset();

      expect(store.skills).toEqual([]);
      expect(store.skillBar.slots).toEqual([null, null, null, null]);
      expect(store.skillTemplates.size).toBe(0);
      expect(store.monsterSkillTemplates.size).toBe(0);
      expect(store.cooldowns).toEqual({});
      expect(store.currentCharacterId).toBeNull();
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- Actions：getSkillTemplatesByClass（直接查询 DB） --------------------
  describe('Actions：getSkillTemplatesByClass（直接 DB 查询）', () => {
    it('直接代理到 skillsDbService.getSkillTemplatesByClass，不修改 Store 状态', async () => {
      const s1 = makeSkill({ id: 's1' });
      vi.mocked(skillsDbService.getSkillTemplatesByClass).mockResolvedValue([s1]);
      const store = useSkillStore();
      store.skillTemplates.set('old', makeSkill({ id: 'old' }));

      const result = await store.getSkillTemplatesByClass('mage');

      expect(result).toEqual([s1]);
      expect(skillsDbService.getSkillTemplatesByClass).toHaveBeenCalledWith('mage');
      // 不修改内存缓存
      expect(store.skillTemplates.size).toBe(1);
      expect(store.skillTemplates.get('old')).toBeDefined();
    });
  });

  // -------------------- 防御性分支补充 --------------------
  describe('防御性分支补充', () => {
    it('persist：currentCharacterId 为空时回退到 characterStore.getCharacterId()（|| 分支 line 189）', async () => {
      // 覆盖 line 189: currentCharacterId.value || characterStore.getCharacterId() 的 || 分支
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      // currentCharacterId 保持为 null（未调用 initialize）
      mocks.characterStore.getCharacterId.mockReturnValue('fallback_char');

      await store.learnSkill('s1');

      // persist 使用 getCharacterId() 的回退值
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 'fallback_char' })
      );
    });

    it('castSkill：charData.mana 为 0 时 canCastSkill 收到 0（|| 分支 line 368）', async () => {
      // 覆盖 line 368: charData?.mana || 0 的 || 分支（mana 为 0 是 falsy）
      const s1 = makeSkill({ id: 's1', type: 'physical_damage', mpCost: 10 });
      mocks.characterStore.getCharacterData.mockReturnValue({ mana: 0 } as Partial<Character>);
      vi.mocked(canCastSkill).mockReturnValue({ canCast: true, reason: '' });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      await store.castSkill('s1');

      // canCastSkill 被调用时 mana 参数为 0
      expect(canCastSkill).toHaveBeenCalledWith(s1, 0);
    });

    it('castSkill：buff 技能无 buffs 数组时 appliedEffects 保持 undefined（FALSE 分支 line 421）', async () => {
      // 覆盖 line 421: skill.buffs && skill.buffs.length > 0 的 FALSE 分支
      const s1 = makeSkill({ id: 's1', type: 'buff', mpCost: 5, name: '空增益' });
      // 不设置 buffs 字段 → skill.buffs 为 undefined
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(true);
      // buffs 为空 → appliedEffects 不被设置
      expect(result.appliedEffects).toBeUndefined();
    });

    it('castSkill：buff 技能 buffs 为空数组时 appliedEffects 保持 undefined', async () => {
      // 覆盖 line 421: skill.buffs.length > 0 的 FALSE 分支（length === 0）
      const s1 = makeSkill({ id: 's1', type: 'debuff', mpCost: 5, name: '空减益', buffs: [] });
      const store = useSkillStore();
      store.$patch({ skills: [s1] });

      const result = await store.castSkill('s1');

      expect(result.success).toBe(true);
      expect(result.appliedEffects).toBeUndefined();
    });

    it('canUseSkill：charData 为 null 时直接返回 false（P1-19 修复：未加载角色不可使用技能）', () => {
      const s1 = makeSkill({ id: 's1', unlockLevel: 1, mpCost: 10 });
      mocks.characterStore.getCharacterData.mockReturnValue(null);
      const store = useSkillStore();
      store.$patch({ skills: [s1] });
      mocks.characterStore.level = 1;

      const result = store.canUseSkill('s1');

      // P1-19 修复：未加载角色时直接返回 false，不再调用 canCastSkill
      expect(result).toBe(false);
      expect(canCastSkill).not.toHaveBeenCalled();
    });

    it('checkLevelUnlocks(true)：技能栏已满时新技能解锁但不自动装备（FALSE 分支 line 722）', async () => {
      // 覆盖 line 722: if (emptySlot !== -1) 的 FALSE 分支
      const s1 = makeSkill({ id: 's1', unlockLevel: 1 });
      const store = useSkillStore();
      // 技能栏 4 个槽位全部占满
      store.$patch({
        skills: [
          makeSkill({ id: 's2' }),
          makeSkill({ id: 's3' }),
          makeSkill({ id: 's4' }),
          makeSkill({ id: 's5' }),
        ],
        skillBar: { slots: ['s2', 's3', 's4', 's5'] },
      });
      store.skillTemplates.set('s1', s1);
      mocks.characterStore.level = 1;

      await store.checkLevelUnlocks(true);

      // s1 被解锁加入 skills，但技能栏已满不自动装备
      expect(store.skills).toHaveLength(5);
      expect(store.skills.some(s => s.id === 's1')).toBe(true);
      expect(store.skillBar.slots).toEqual(['s2', 's3', 's4', 's5']);
    });

    it('tickCooldowns：冷却值为 0 时不递减（FALSE 分支 line 774）', () => {
      // 覆盖 line 774: if (cooldowns.value[key] > 0) 的 FALSE 分支
      const store = useSkillStore();
      // 防御性场景：cooldowns 中存在 0 值（异常状态）
      store.$patch({ cooldowns: { s1: 0, s2: -1 } });

      store.tickCooldowns();

      // 0 和负值不被处理（> 0 判断为 false）
      expect(store.cooldowns.s1).toBe(0);
      expect(store.cooldowns.s2).toBe(-1);
    });

    it('persist：currentCharacterId 与 getCharacterId 均为空时 early return（line 189）', async () => {
      // 覆盖 line 189: if (!charId) return 的 early return 分支
      const s1 = makeSkill({ id: 's1' });
      const store = useSkillStore();
      store.skillTemplates.set('s1', s1);
      // currentCharacterId 保持为 null（未调用 initialize）
      mocks.characterStore.getCharacterId.mockReturnValue(null);

      await store.learnSkill('s1');

      // persist 因 charId 为空提前返回，不调用 saveSkillsData
      expect(skillsDbService.saveSkillsData).not.toHaveBeenCalled();
    });
  });
});
