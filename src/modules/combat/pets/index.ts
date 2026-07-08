/**
 * @fileoverview 术士召唤系统模块入口（Phase 6.4）
 * @description 集中导出召唤物系统的类型、数据、服务函数和 Store。
 * @module combat/pets
 */

// 类型
export type {
  WarlockPetType,
  PetAIBehavior,
  PetBaseAttributes,
  PetSkill,
  WarlockPet,
  PetInstance,
  PetSystemState,
} from './types';

// 常量
export { PET_SUMMON_CONFIG, PET_AI_TARGET_PRIORITY } from './types';

// 数据
export {
  WARLOCK_PETS,
  DEFAULT_UNLOCKED_PETS,
  getPetByType,
  getAllPets,
  getSummonablePets,
} from './warlockPets';

// 服务层纯函数
export {
  generatePetInstanceId,
  calculatePetAttributes,
  createPetInstance,
  canSummonPet,
  canDismissPet,
  summonPet,
  dismissPet,
  calculatePetSkillDamage,
  damagePet,
  healPet,
  isPetDead,
  isSkillReady,
  getReadySkills,
  setSkillCooldown,
  tickSkillCooldowns,
  selectPetAction,
  createInitialPetState,
  unlockPet,
  tickPetTurn,
  getActivePetDefinition,
  getActivePetSoulShardCost,
} from './service';

// Store
export { usePetStore } from './store';
