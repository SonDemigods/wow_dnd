/**
 * @fileoverview 术士召唤系统 Pinia Store（Phase 6.4）
 * @description 集中管理召唤物状态、灵魂碎片消耗和回合推进。
 *              纯函数逻辑位于 service.ts，本文件只负责状态管理和副作用。
 * @module combat/pets
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { PetInstance, PetSystemState, WarlockPet, WarlockPetType } from './types';
import {
  canDismissPet,
  canSummonPet,
  createInitialPetState,
  damagePet,
  dismissPet,
  getActivePetDefinition,
  getActivePetSoulShardCost,
  isPetDead,
  selectPetAction,
  setSkillCooldown,
  summonPet,
  tickPetTurn,
  unlockPet as unlockPetFn,
} from './service';
import { WARLOCK_PETS, getPetByType, getSummonablePets } from './warlock_pets';

/**
 * 术士召唤系统 Store
 *
 * 使用方式：
 * 1. 战斗开始时调用 `initialize(level)` 初始化状态
 * 2. 玩家召唤时调用 `summon(petType, soulShardSystem)` 并传入灵魂碎片系统
 * 3. 召唤物行动时调用 `petTakeAction()` 获取选择的技能
 * 4. 召唤物受伤时调用 `takeDamage(amount)`
 * 5. 回合结束时调用 `tickTurn()` 推进状态
 * 6. 战斗结束时调用 `reset()`
 */
export const usePetStore = defineStore('warlock-pets', () => {
  // ============================================================
  // 状态
  // ============================================================

  const state = ref<PetSystemState>(createInitialPetState());
  /** 当前术士等级（用于创建召唤物实例） */
  const currentLevel = ref<number>(1);
  /** 战斗日志回调（由战斗 Store 注入） */
  const logCallback = ref<((message: string) => void) | null>(null);

  // ============================================================
  // 计算属性
  // ============================================================

  /** 当前激活的召唤物实例 */
  const activePet = computed<PetInstance | null>(() => state.value.activePet);

  /** 当前召唤物是否存活 */
  const hasActivePet = computed<boolean>(() => {
    const pet = state.value.activePet;
    return pet !== null && !isPetDead(pet);
  });

  /** 已解锁的召唤物列表 */
  const unlockedPets = computed<WarlockPet[]>(() =>
    state.value.unlockedPets.map(id => getPetByType(id))
  );

  /** 全部召唤物定义 */
  const allPets = computed<WarlockPet[]>(() => Object.values(WARLOCK_PETS));

  /** 当前激活召唤物的定义 */
  const activePetDefinition = computed<WarlockPet | null>(() =>
    getActivePetDefinition(state.value)
  );

  /** 当前激活召唤物的灵魂碎片消耗 */
  const activePetSoulShardCost = computed<number>(() =>
    getActivePetSoulShardCost(state.value)
  );

  // ============================================================
  // 内部辅助
  // ============================================================

  /**
   * 输出战斗日志（如果已注入回调）
   */
  function log(message: string): void {
    logCallback.value?.(message);
  }

  /**
   * 直接更新状态（用于不可变更新）
   */
  function updateState(newState: PetSystemState): void {
    state.value = newState;
  }

  /**
   * 直接更新激活的召唤物实例
   */
  function updateActivePet(pet: PetInstance | null): void {
    state.value = { ...state.value, activePet: pet };
  }

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 初始化召唤系统
   *
   * @param level - 术士等级
   * @param logFn - 战斗日志回调（可选）
   */
  function initialize(level: number, logFn?: (message: string) => void): void {
    state.value = createInitialPetState();
    currentLevel.value = level;
    if (logFn) logCallback.value = logFn;
  }

  /**
   * 重置召唤系统（战斗结束时调用）
   */
  function reset(): void {
    state.value = createInitialPetState();
    currentLevel.value = 1;
    logCallback.value = null;
  }

  /**
   * 设置战斗日志回调
   */
  function setLogCallback(logFn: (message: string) => void): void {
    logCallback.value = logFn;
  }

  /**
   * 更新术士等级
   */
  function updateLevel(level: number): void {
    currentLevel.value = level;
  }

  /**
   * 解锁新召唤物
   */
  function unlockPet(petType: WarlockPetType): void {
    updateState(unlockPetFn(state.value, petType));
  }

  /**
   * 检查是否可以召唤
   */
  function canSummon(petType: WarlockPetType, soulShards: number) {
    return canSummonPet(petType, state.value, soulShards);
  }

  /**
   * 召唤恶魔
   *
   * 此方法不直接消耗灵魂碎片，由调用方负责扣除资源。
   * 调用方应先调用 `canSummon` 检查可召唤性。
   *
   * @param petType - 目标召唤物
   * @param soulShards - 当前灵魂碎片数量（用于校验）
   * @returns 是否召唤成功
   */
  function summon(petType: WarlockPetType, soulShards: number): boolean {
    const check = canSummonPet(petType, state.value, soulShards);
    if (!check.canSummon) {
      log(`召唤失败：${check.reason}`);
      return false;
    }

    const petDef = getPetByType(petType);
    const newState = summonPet(state.value, petType, currentLevel.value);
    updateState(newState);

    log(`召唤了 ${petDef.name}！消耗 ${petDef.soulShardCost} 个灵魂碎片`);
    return true;
  }

  /**
   * 解散当前召唤物
   */
  function dismiss(): void {
    const check = canDismissPet(state.value);
    if (!check.canDismiss) {
      log(`解散失败：${check.reason}`);
      return;
    }

    const petName = state.value.activePet?.name ?? '';
    updateState(dismissPet(state.value));
    log(`解散了 ${petName}`);
  }

  /**
   * 召唤物受到伤害
   *
   * @param damage - 原始伤害值
   */
  function takeDamage(damage: number): void {
    if (state.value.activePet === null) return;
    const pet = state.value.activePet;
    const newPet = damagePet(pet, damage);
    updateActivePet(newPet);

    log(`${pet.name} 受到 ${damage} 点伤害`);

    // 检查死亡
    if (isPetDead(newPet)) {
      log(`${pet.name} 死亡！`);
      updateActivePet(null);
    }
  }

  /**
   * 召唤物行动
   *
   * 返回召唤物选择的技能，并自动设置技能冷却。
   * 调用方负责实际应用技能效果（造成伤害、施加减益等）。
   *
   * @returns 选择的技能（包含 id、name、damageMultiplier 等）
   */
  function petTakeAction() {
    if (state.value.activePet === null) return null;
    const pet = state.value.activePet;
    const skill = selectPetAction(pet);

    // 设置技能冷却（如果是真实技能，非默认攻击）
    if (skill.id !== 'basic_attack') {
      updateActivePet(setSkillCooldown(pet, skill.id));
    }

    log(`${pet.name} 使用了 ${skill.name}`);
    return skill;
  }

  /**
   * 回合结束时推进状态
   *
   * 1. 减少技能冷却
   * 2. 减少持续时间
   * 3. 清理死亡或过期的召唤物
   */
  function tickTurn(): void {
    const oldPet = state.value.activePet;
    updateState(tickPetTurn(state.value));

    // 检测召唤物是否因持续到期而被清理
    const newPet = state.value.activePet;
    if (oldPet !== null && newPet === null) {
      // 仅在 tickPetTurn 未触发死亡日志时记录（死亡已在 takeDamage 中记录）
      if (oldPet.hp > 0 && oldPet.durationRemaining <= 1) {
        log(`${oldPet.name} 的召唤时间结束，返回了扭曲虚空`);
      }
    }
  }

  /**
   * 获取可召唤的召唤物列表（根据当前灵魂碎片数量）
   */
  function getSummonable(soulShards: number): WarlockPet[] {
    return getSummonablePets(soulShards).filter(pet =>
      state.value.unlockedPets.includes(pet.id)
    );
  }

  return {
    // 状态
    state,
    currentLevel,
    // 计算属性
    activePet,
    hasActivePet,
    unlockedPets,
    allPets,
    activePetDefinition,
    activePetSoulShardCost,
    // Actions
    initialize,
    reset,
    setLogCallback,
    updateLevel,
    unlockPet,
    canSummon,
    summon,
    dismiss,
    takeDamage,
    petTakeAction,
    tickTurn,
    getSummonable,
  };
});
