/**
 * @fileoverview 技能模块统一导出入口
 * @description 对外暴露技能模块的类型定义和公共 API。
 *
 * 导出策略（按层组织）：
 * - `types.ts` → 所有类型定义（接口 + 类型别名），外部模块引用 Skill/SkillType 等类型
 * - `db.ts` → 仅导出 `skillsDbService` 实例（内部实现类 `SkillsDbService` 不对外暴露）
 * - `service.ts` → 7 个纯函数（计算 + 校验），无副作用可直接调用
 * - `store.ts` → Pinia Store `useSkillsStore`，技能状态管理的唯一入口
 *
 * 使用示例：
 * ```typescript
 * import { useSkillsStore, type Skill, type SkillType, canCastSkill } from '@/modules/skill';
 *
 * const skillsStore = useSkillsStore();
 * await skillsStore.initialize();
 * ```
 * @module skill
 */

export type {
  SkillType,
  SkillSlotIndex,
  SkillEffect,
  SkillBuffEffect,
  Skill,
  AppliedEffectInfo,
  SkillUseResult,
  SkillBar,
  SkillsData,
  SkillTemplateStorage
} from './types';

export { skillsDbService } from './db';

export {
  calculateSkillDamage,
  getSkillCoefficient,
  calculateBuffValue,
  canLearnSkill,
  validateSkillBarSlot,
  isSkillEquipped,
  canCastSkill
} from './service';

export { useSkillsStore } from './store';
