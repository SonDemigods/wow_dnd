/**
 * @fileoverview 德鲁伊变形系统模块导出（Phase 6.3）
 * @description 集中导出形态系统的类型、数据、服务函数和 Store
 * @module combat/forms
 */
export type {
  DruidFormType,
  FormStatModifiers,
  DruidForm,
  FormState
} from './types';

export { FORM_SWITCH_CONFIG } from './types';

export {
  DRUID_FORMS,
  DEFAULT_FORM,
  getFormByType,
  getAllForms,
  getSwitchableForms
} from './druidForms';

export {
  canSwitchForm,
  getFormStatModifiers,
  getFormHpMultiplier,
  getFormDamageMultiplier,
  getFormDefenseMultiplier,
  calculateFormSwitchHeal,
  getAvailableSkills,
  isSkillAvailableInForm,
  filterSkillsByForm,
  createInitialFormState,
  switchForm,
  tickCooldown,
  getCurrentForm,
  calculateFormStatDifference
} from './service';

export { useFormStore } from './store';
