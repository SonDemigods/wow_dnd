/**
 * @fileoverview 术士召唤系统 Pinia Store（Phase 6.4）
 * @description 集中管理召唤物状态、灵魂碎片消耗和回合推进。
 *              纯函数逻辑位于 service.ts，本文件只负责状态管理和副作用。
 * @module combat/pets
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { PetInstance, PetSkill, PetSystemState, Pet, PetType, PetOwner } from './types';
import {
  canSummonPet,
  canDismissPet,
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
  getPetDefinition,
  getPetResourceCost,
} from './service';
import { WARLOCK_PETS, getSummonablePets } from './warlockPets';
import { HUNTER_PETS, getSummonableHunterPets } from './hunterPets';

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
  /** 当前主人等级（用于创建宠物实例） */
  const currentLevel = ref<number>(1);
  /** 当前所有者职业（决定加载哪套宠物数据） */
  const currentOwner = ref<PetOwner>('warlock');
  /** 战斗日志回调（由战斗 Store 注入） */
  // P1-12 修复：函数引用不需要深度响应式，改用 shallowRef 避免不必要的响应式追踪
  const logCallback = shallowRef<((message: string) => void) | null>(null);

  // ============================================================
  // 计算属性
  // ============================================================

  /** 当前激活的宠物实例 */
  const activePet = computed<PetInstance | null>(() => state.value.activePet);

  /** 当前宠物是否存活 */
  const hasActivePet = computed<boolean>(() => {
    const pet = state.value.activePet;
    return pet !== null && !isPetDead(pet);
  });

  /** 已解锁的宠物列表（通用，术士返回 WarlockPet[]，猎人返回 HunterPet[]） */
  const unlockedPets = computed<Pet[]>(() =>
    state.value.unlockedPets.map(id => getPetDefinition(id))
  );

  /** 全部宠物定义（根据当前所有者职业返回对应数据） */
  const allPets = computed<Pet[]>(() =>
    currentOwner.value === 'warlock' ? Object.values(WARLOCK_PETS) : Object.values(HUNTER_PETS)
  );

  /** 当前激活宠物的定义 */
  const activePetDefinition = computed<Pet | null>(() =>
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
   * 初始化宠物系统
   *
   * 根据主人职业加载对应的宠物数据（术士/猎人）。
   *
   * @param level - 主人等级
   * @param logFn - 战斗日志回调（可选）
   * @param owner - 所有者职业（默认 'warlock'，猎人传 'hunter'）
   */
  function initialize(level: number, logFn?: (message: string) => void, owner: PetOwner = 'warlock'): void {
    currentOwner.value = owner;
    state.value = createInitialPetState(owner);
    currentLevel.value = level;
    if (logFn) logCallback.value = logFn;
  }

  /**
   * 重置宠物系统（战斗结束时调用）
   */
  function reset(): void {
    state.value = createInitialPetState(currentOwner.value);
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
   * 解锁新宠物
   */
  function unlockPet(petType: PetType): void {
    updateState(unlockPetFn(state.value, petType));
  }

  /**
   * 检查是否可以召唤
   */
  function canSummon(petType: PetType, resourceAmount: number) {
    return canSummonPet(petType, state.value, resourceAmount);
  }

  /**
   * 召唤宠物
   *
   * 此方法不直接消耗资源，由调用方负责扣除资源。
   * 调用方应先调用 `canSummon` 检查可召唤性。
   *
   * @param petType - 目标宠物
   * @param resourceAmount - 当前资源数量（灵魂碎片或集中值，用于校验）
   * @returns 是否召唤成功
   */
  function summon(petType: PetType, resourceAmount: number): boolean {
    const check = canSummonPet(petType, state.value, resourceAmount);
    if (!check.canSummon) {
      log(`召唤失败：${check.reason}`);
      return false;
    }

    const petDef = getPetDefinition(petType);
    const newState = summonPet(state.value, petType, currentLevel.value);
    updateState(newState);

    const resourceName = petDef.resourceType === 'soul_shard' ? '灵魂碎片' : '集中值';
    const cost = getPetResourceCost(petDef);
    log(`召唤了 ${petDef.name}！消耗 ${cost} 个${resourceName}`);
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
  function petTakeAction(): PetSkill | null {
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
   * 获取可召唤的宠物列表（根据当前资源数量）
   */
  function getSummonable(resourceAmount: number): Pet[] {
    const summonable = currentOwner.value === 'warlock'
      ? getSummonablePets(resourceAmount)
      : getSummonableHunterPets(resourceAmount);
    return summonable.filter(pet =>
      state.value.unlockedPets.includes(pet.id)
    );
  }

  return {
    // 状态
    state,
    currentLevel,
    currentOwner,
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
