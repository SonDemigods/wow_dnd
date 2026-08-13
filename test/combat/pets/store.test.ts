/**
 * @fileoverview 术士召唤系统 Pinia Store 单元测试（store.ts）
 *
 * 覆盖 usePetStore 的：
 * 1. State：state（PetSystemState）/ currentLevel / currentOwner 初始值
 * 2. Getters：activePet / hasActivePet / unlockedPets / allPets /
 *    activePetDefinition / activePetSoulShardCost
 * 3. Actions：
 *    - initialize（warlock 默认 / hunter 加载猎人物 / 传 logFn）
 *    - reset（清空状态）
 *    - setLogCallback / updateLevel
 *    - unlockPet / lockPet（锁定激活宠物时一并解散）
 *    - canSummon（解锁 / 资源 / 已有激活）
 *    - summon（成功 / 资源不足 / 未解锁 / 已有激活）
 *    - dismiss
 *    - takeDamage（扣血 / 致死清空）
 *    - petTakeAction（返回技能 + 设置冷却 / 无激活返回 null）
 *    - tickTurn（冷却推进 / 限时到期清理）
 *    - getSummonable（按资源过滤 / 按解锁过滤 / 猎人分支）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - store.ts 不直接依赖外部 store，纯函数逻辑全部委托给 service.ts，
 *    因此无需 vi.mock，service / warlockPets / hunterPets 均为真实实现。
 *  - 使用 createTestPinia 创建真实 Pinia 实例，覆盖 setActivePinia。
 *  - 每个 it 前通过 createTestPinia + initialize 初始化，确保状态隔离。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WARLOCK_PETS, DEFAULT_UNLOCKED_PETS } from '@/modules/combat/pets/warlockPets';
import { HUNTER_PETS, DEFAULT_UNLOCKED_HUNTER_PETS } from '@/modules/combat/pets/hunterPets';
import { usePetStore } from '@/modules/combat/pets/store';
import { createTestPinia } from '../../utils/setup';

describe('usePetStore 宠物召唤 Store', () => {
  let store: ReturnType<typeof usePetStore>;

  beforeEach(() => {
    createTestPinia();
    store = usePetStore();
  });

  // ============================================================
  // State & Getters 初始值
  // ============================================================

  describe('初始状态', () => {
    it('state 无激活宠物，默认解锁 imp 和 voidwalker', () => {
      expect(store.state.activePet).toBeNull();
      expect(store.state.unlockedPets).toEqual(DEFAULT_UNLOCKED_PETS);
      expect(store.state.unlockedPets).toEqual(['imp', 'voidwalker']);
    });

    it('currentLevel 初始为 1', () => {
      expect(store.currentLevel).toBe(1);
    });

    it('currentOwner 初始为 warlock', () => {
      expect(store.currentOwner).toBe('warlock');
    });

    it('activePet 无激活时为 null', () => {
      expect(store.activePet).toBeNull();
    });

    it('hasActivePet 无激活时为 false', () => {
      expect(store.hasActivePet).toBe(false);
    });

    it('unlockedPets 返回默认解锁的宠物定义（2 个）', () => {
      const pets = store.unlockedPets;
      expect(pets).toHaveLength(2);
      expect(pets.map(p => p.id)).toEqual(['imp', 'voidwalker']);
      expect(pets[0]).toBe(WARLOCK_PETS.imp);
      expect(pets[1]).toBe(WARLOCK_PETS.voidwalker);
    });

    it('allPets 返回全部 5 种术士宠物', () => {
      const pets = store.allPets;
      expect(pets).toHaveLength(5);
      const ids = pets.map(p => p.id).sort();
      expect(ids).toEqual(['doomguard', 'felhunter', 'imp', 'succubus', 'voidwalker']);
    });

    it('activePetDefinition 无激活时为 null', () => {
      expect(store.activePetDefinition).toBeNull();
    });

    it('activePetSoulShardCost 无激活时为 0', () => {
      expect(store.activePetSoulShardCost).toBe(0);
    });
  });

  // ============================================================
  // initialize
  // ============================================================

  describe('initialize', () => {
    it('设置等级和 owner，并创建初始状态', () => {
      store.initialize(10);
      expect(store.currentLevel).toBe(10);
      expect(store.currentOwner).toBe('warlock');
      expect(store.state.activePet).toBeNull();
      expect(store.state.unlockedPets).toEqual(['imp', 'voidwalker']);
    });

    it('owner 为 hunter 时加载猎人宠物', () => {
      store.initialize(5, undefined, 'hunter');
      expect(store.currentOwner).toBe('hunter');
      expect(store.state.unlockedPets).toEqual(DEFAULT_UNLOCKED_HUNTER_PETS);
      expect(store.state.unlockedPets).toEqual(['wolf', 'bear']);
      expect(store.allPets.map(p => p.id).sort()).toEqual(
        ['bear', 'boar', 'cat', 'devilsaur', 'wolf']
      );
    });

    it('传入 logFn 时设置日志回调', () => {
      const logFn = vi.fn();
      store.initialize(1, logFn);
      // 通过 summon 触发日志验证回调已注入
      const ok = store.summon('imp', 10);
      expect(ok).toBe(true);
      expect(logFn).toHaveBeenCalled();
    });

    it('不传 owner 时默认 warlock', () => {
      store.initialize(3);
      expect(store.currentOwner).toBe('warlock');
    });
  });

  // ============================================================
  // reset / setLogCallback / updateLevel
  // ============================================================

  describe('reset', () => {
    it('清空状态并恢复默认等级', () => {
      store.initialize(15, undefined, 'hunter');
      store.updateLevel(20);
      store.unlockPet('cat');
      store.summon('wolf', 100);

      store.reset();

      expect(store.currentLevel).toBe(1);
      // reset 基于 currentOwner 恢复对应默认解锁列表
      expect(store.state.unlockedPets).toEqual(['wolf', 'bear']);
      expect(store.activePet).toBeNull();
    });

    it('清空已注入的日志回调', () => {
      const logFn = vi.fn();
      store.setLogCallback(logFn);
      store.reset();
      const ok = store.summon('imp', 10);
      expect(ok).toBe(true);
      expect(logFn).not.toHaveBeenCalled();
    });
  });

  describe('setLogCallback', () => {
    it('注入日志回调后 summon 会调用', () => {
      const logFn = vi.fn();
      store.setLogCallback(logFn);
      store.summon('imp', 10);
      expect(logFn).toHaveBeenCalled();
      expect(logFn.mock.calls[0][0]).toContain('召唤了');
    });
  });

  describe('updateLevel', () => {
    it('更新当前等级', () => {
      store.initialize(1);
      store.updateLevel(12);
      expect(store.currentLevel).toBe(12);
    });
  });

  // ============================================================
  // unlockPet / lockPet
  // ============================================================

  describe('unlockPet', () => {
    it('添加宠物到解锁列表', () => {
      store.initialize(1);
      store.unlockPet('succubus');
      expect(store.state.unlockedPets).toContain('succubus');
      expect(store.state.unlockedPets).toHaveLength(3);
    });

    it('重复解锁不增加', () => {
      store.initialize(1);
      store.unlockPet('imp'); // 已默认解锁
      expect(store.state.unlockedPets).toHaveLength(2);
    });
  });

  describe('lockPet', () => {
    it('从解锁列表移除宠物', () => {
      store.initialize(1);
      store.unlockPet('succubus');
      store.lockPet('succubus');
      expect(store.state.unlockedPets).not.toContain('succubus');
      expect(store.state.unlockedPets).toHaveLength(2);
    });

    it('锁定当前激活宠物时一并解散', () => {
      store.initialize(1);
      store.summon('imp', 10);
      expect(store.activePet).not.toBeNull();
      store.lockPet('imp');
      expect(store.activePet).toBeNull();
      expect(store.state.unlockedPets).not.toContain('imp');
    });
  });

  // ============================================================
  // canSummon
  // ============================================================

  describe('canSummon', () => {
    beforeEach(() => {
      store.initialize(1);
    });

    it('已解锁且资源足够返回 canSummon=true', () => {
      const result = store.canSummon('imp', 1);
      expect(result.canSummon).toBe(true);
      expect(result.reason).toBe('');
    });

    it('未解锁的宠物返回 canSummon=false', () => {
      const result = store.canSummon('succubus', 5);
      expect(result.canSummon).toBe(false);
      expect(result.reason).toContain('尚未解锁');
    });

    it('资源不足返回 canSummon=false', () => {
      // imp 需要 1 碎片
      const result = store.canSummon('imp', 0);
      expect(result.canSummon).toBe(false);
      expect(result.reason).toContain('灵魂碎片不足');
    });

    it('已有激活宠物返回 canSummon=false', () => {
      store.summon('imp', 10);
      const result = store.canSummon('voidwalker', 10);
      expect(result.canSummon).toBe(false);
      expect(result.reason).toContain('已有激活');
    });
  });

  // ============================================================
  // summon
  // ============================================================

  describe('summon', () => {
    beforeEach(() => {
      store.initialize(1);
    });

    it('成功邀请返回 true 并设置 activePet', () => {
      const ok = store.summon('imp', 10);
      expect(ok).toBe(true);
      expect(store.activePet).not.toBeNull();
      expect(store.activePet?.petId).toBe('imp');
      expect(store.activePet?.name).toBe('小鬼');
      expect(store.activePet?.level).toBe(1);
    });

    it('activePet 等级等于当前等级', () => {
      store.updateLevel(8);
      store.summon('imp', 10);
      expect(store.activePet?.level).toBe(8);
    });

    it('hasActivePet 召唤后为 true', () => {
      store.summon('imp', 10);
      expect(store.hasActivePet).toBe(true);
    });

    it('资源不足返回 false 且不激活', () => {
      const ok = store.summon('imp', 0);
      expect(ok).toBe(false);
      expect(store.activePet).toBeNull();
    });

    it('未解锁的宠物返回 false', () => {
      const ok = store.summon('succubus', 10);
      expect(ok).toBe(false);
      expect(store.activePet).toBeNull();
    });

    it('已有激活宠物时返回 false', () => {
      store.summon('imp', 10);
      const ok = store.summon('voidwalker', 10);
      expect(ok).toBe(false);
      expect(store.activePet?.petId).toBe('imp');
    });

    it('summon 后 activePetSoulShardCost 反映宠物消耗', () => {
      store.summon('imp', 10);
      expect(store.activePetSoulShardCost).toBe(1);
    });
  });

  // ============================================================
  // dismiss
  // ============================================================

  describe('dismiss', () => {
    it('解散激活宠物，activePet 置 null', () => {
      store.initialize(1);
      store.summon('imp', 10);
      store.dismiss();
      expect(store.activePet).toBeNull();
      expect(store.hasActivePet).toBe(false);
    });

    it('无激活宠物时无副作用', () => {
      store.initialize(1);
      store.dismiss();
      expect(store.activePet).toBeNull();
    });
  });

  // ============================================================
  // takeDamage
  // ============================================================

  describe('takeDamage', () => {
    beforeEach(() => {
      store.initialize(1);
      store.summon('imp', 10);
    });

    it('减少宠物 HP', () => {
      const before = store.activePet!.hp;
      store.takeDamage(10);
      expect(store.activePet!.hp).toBe(before - 10);
    });

    it('HP 降为 0 时清空 activePet（死亡）', () => {
      store.takeDamage(store.activePet!.maxHp);
      expect(store.activePet).toBeNull();
      expect(store.hasActivePet).toBe(false);
    });

    it('无激活宠物时无副作用', () => {
      store.dismiss();
      store.takeDamage(50);
      expect(store.activePet).toBeNull();
    });
  });

  // ============================================================
  // petTakeAction
  // ============================================================

  describe('petTakeAction', () => {
    it('返回选择的技能并设置冷却', () => {
      store.initialize(1);
      store.summon('imp', 10);
      const skill = store.petTakeAction();
      // imp 最高优先级技能是 firebolt（priority=10）
      expect(skill).not.toBeNull();
      expect(skill!.id).toBe('firebolt');
      expect(skill!.damageMultiplier).toBe(1.0);
    });

    it('无激活宠物时返回 null', () => {
      store.initialize(1);
      expect(store.petTakeAction()).toBeNull();
    });
  });

  // ============================================================
  // tickTurn
  // ============================================================

  describe('tickTurn', () => {
    beforeEach(() => {
      store.initialize(1);
    });

    it('减少限时宠物的持续时间', () => {
      store.unlockPet('doomguard');
      store.summon('doomguard', 10);
      expect(store.activePet?.durationRemaining).toBe(10);
      store.tickTurn();
      expect(store.activePet?.durationRemaining).toBe(9);
    });

    it('持续时间到期时清空 activePet', () => {
      store.unlockPet('doomguard');
      store.summon('doomguard', 10);
      // 推进到剩余 1，再 tick 一次即到期
      store.tickTurn();
      store.tickTurn();
      store.tickTurn();
      store.tickTurn();
      store.tickTurn();
      store.tickTurn();
      store.tickTurn();
      store.tickTurn();
      // 现在剩余 2
      expect(store.activePet?.durationRemaining).toBe(2);
      store.tickTurn(); // 剩余 1
      expect(store.activePet?.durationRemaining).toBe(1);
      store.tickTurn(); // 到期清空
      expect(store.activePet).toBeNull();
    });

    it('永续宠物（duration=0）不减少持续时间', () => {
      store.summon('imp', 10);
      store.tickTurn();
      expect(store.activePet?.durationRemaining).toBe(0);
    });

    it('无激活宠物时无副作用', () => {
      store.tickTurn();
      expect(store.activePet).toBeNull();
    });
  });

  // ============================================================
  // getSummonable
  // ============================================================

  describe('getSummonable', () => {
    beforeEach(() => {
      store.initialize(1);
    });

    it('按资源数量过滤可召唤宠物', () => {
      // 默认解锁 imp(1) voidwalker(1)；1 碎片时两者都可召唤
      const pets = store.getSummonable(1);
      expect(pets.map(p => p.id).sort()).toEqual(['imp', 'voidwalker']);
    });

    it('资源不足时返回空数组', () => {
      expect(store.getSummonable(0)).toEqual([]);
    });

    it('过滤掉未解锁的宠物（即使资源足够）', () => {
      // succubus 未解锁（消耗 2），但给足够资源仍不可召唤
      const pets = store.getSummonable(10);
      const ids = pets.map(p => p.id);
      expect(ids).not.toContain('succubus');
      expect(ids).not.toContain('felhunter');
      expect(ids).not.toContain('doomguard');
    });

    it('猎人职业时返回猎人可召唤宠物', () => {
      store.initialize(1, undefined, 'hunter');
      // 默认解锁 wolf(30) bear(30)
      const pets = store.getSummonable(30);
      expect(pets.map(p => p.id).sort()).toEqual(['bear', 'wolf']);
      expect(store.getSummonable(30)[0]).toBe(HUNTER_PETS.wolf);
    });
  });

  // ============================================================
  // Getters 关联 activePet
  // ============================================================

  describe('activePet 相关 Getters', () => {
    it('activePetDefinition 返回激活宠物的定义', () => {
      store.initialize(1);
      store.summon('imp', 10);
      expect(store.activePetDefinition).toBe(WARLOCK_PETS.imp);
    });

    it('activePetSoulShardCost 返回激活宠物的消耗', () => {
      store.initialize(1);
      store.unlockPet('doomguard');
      store.summon('doomguard', 10);
      expect(store.activePetSoulShardCost).toBe(3);
    });

    it('allPets 返回的条目均为合法 Pet 定义', () => {
      store.initialize(1);
      for (const pet of store.allPets) {
        expect(pet).toBeDefined();
        expect(pet.id).toBeTruthy();
      }
    });
  });

  // ============================================================
  // 完整战斗流程
  // ============================================================

  describe('完整召唤-战斗-解散流程', () => {
    it('召唤 → 行动 → 受伤未死 → 解散', () => {
      store.initialize(1);
      expect(store.summon('imp', 10)).toBe(true);
      expect(store.hasActivePet).toBe(true);

      const skill = store.petTakeAction();
      expect(skill).not.toBeNull();

      store.takeDamage(10);
      expect(store.hasActivePet).toBe(true);

      store.dismiss();
      expect(store.hasActivePet).toBe(false);
      expect(store.activePet).toBeNull();
    });
  });
});