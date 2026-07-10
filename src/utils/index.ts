/**
 * @fileoverview 工具函数统一导出入口
 * @description 汇集本项目的通用工具函数，包括属性计算等
 * @module utils/index
 */

export {
  calculateMaxHp,
  calculateMaxMana,
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateHpBonus,
  calculateMpBonus,
  calculateHealBonus,
  calculateAllAttributes,
  getExpForLevel,
} from './calculations';

export {
  toRawData,
  generateId,
  BaseDbService,
} from './db-helpers';

export { downloadBlob } from './fileDownload';

export {
  errorReporter,
  type ErrorRecord,
  type ErrorSource,
  type ErrorReportAdapter,
  type ErrorReporterConfig,
} from './errorReport';
