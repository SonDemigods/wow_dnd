/**
 * @fileoverview 宠物系统模块入口（Phase 6.4 + P3-156 扩展）
 * @description 集中导出术士召唤物和猎人野兽宠物的类型、数据、服务函数和 Store。
 * @module combat/pets
 */

// 类型
export type {
  WarlockPetType,
  HunterPetType,
  PetOwner,
  PetType,
  PetAIBehavior,
  PetBaseAttributes,
  PetSkill,
  WarlockPet,
  HunterPet,
  Pet,
  PetInstance,
  PetSystemState,
} from './types';

// 常量
export { PET_SUMMON_CONFIG, PET_AI_TARGET_PRIORITY } from './types';

// 术士宠物数据
export {
  WARLOCK_PETS,
  DEFAULT_UNLOCKED_PETS,
  getPetByType,
  getAllPets,
  getSummonablePets,
} from './warlockPets';

// 猎人宠物数据（P3-156 扩展）
export {
  HUNTER_PETS,
  DEFAULT_UNLOCKED_HUNTER_PETS,
  getHunterPetByType,
  getAllHunterPets,
  getSummonableHunterPets,
} from './hunterPets';

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
  // P3-156 扩展：通用宠物查询辅助
  getPetDefinition,
  getPetResourceCost,
  getDefaultUnlockedPets,
} from './service';

// Store
export { usePetStore } from './store';
