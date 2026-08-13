/**
 * @fileoverview 天赋系统模块导出（Phase 6.2）
 * @description 集中导出天赋系统的类型、服务函数和 Store
 * @module character/talents
 */
export type {
  TalentEffectType,
  TalentEffect,
  Talent,
  TalentTree,
  TalentAllocation,
  TalentState
} from './types';

export { TALENT_POINT_RULES, calculateTotalTalentPoints } from './types';

export {
  meetsRequirements,
  getTreeSpentPoints,
  isTierUnlocked,
  canLearnTalent,
  createEmptyEffectSummary,
  calculateTalentEffects,
  getTalentStatBonuses,
  calculateSpentPoints,
  calculateAvailablePoints,
  learnTalent,
  resetAllocations,
  createInitialTalentState,
  type TalentEffectSummary
} from './service';

export { useTalentStore } from './store';
