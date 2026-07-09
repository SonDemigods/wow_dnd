/**
 * @fileoverview 角色模块统一导出入口
 * @description 导出角色模块的所有类型定义、数据层、纯逻辑函数和状态管理
 * @module character
 */

export type {
  FactionType,
  RaceType,
  ClassType,
  FactionData,
  RaceData,
  ClassData,
  Stats,
  Attributes,
  Character,
  CharacterListItem,
  CreateCharacterParams,
  ExpGainResult,
  PassiveTrigger,
  PassiveEffectType,
  PassiveEffect,
  PassiveSkill,
  FactionStorage,
  RaceStorage,
  ClassStorage,
  CharacterDataStorage
} from './types';

export { CharacterDbService, characterDbService } from './db';

export {
  generateCharacterId,
  computeInitialStats,
  computeEffectiveStats,
  computeAttributes,
  isClassFactionCompatible,
  createInitialCharacter,
  applyHpChange,
  applyMpChange,
  isDead,
  applyExpGain,
  applyLevelUp,
  applyGoldChange,
  canAffordGold,
  computeBonusChange,
  recalculateHpMp,
  computeResurrection
} from './service';

/** 导出 Pinia 状态管理 Store（useCharacterStore）
 * 注意：Store 使用命名导出而非通配符导出，因为 Pinia store 函数必须按名称导入
 */
export { useCharacterStore } from './store';
