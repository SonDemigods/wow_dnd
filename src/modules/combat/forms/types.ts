/**
 * @fileoverview 德鲁伊变形系统类型定义（Phase 6.3）
 * @description 定义德鲁伊的 4 种形态：人形、熊、猎豹、枭兽。
 *              不同形态提供不同的属性加成和技能集，形态切换消耗回合并恢复生命。
 * @module combat/forms
 */
import type { Stats } from '@/modules/character/types';

// ============================================================================
// 形态枚举
// ============================================================================

/**
 * 德鲁伊形态类型
 *
 * - `humanoid`：人形形态，平衡的施法形态，可使用治疗和平衡法术
 * - `bear`：熊形态，坦克形态，高生命和防御，可使用撕咬和横扫
 * - `cat`：猎豹形态，近战输出形态，高敏捷和暴击，可使用撕碎和连击
 * - `moonkin`：枭兽形态，远程法术输出形态，高智力和暴击，可使用月火和星火
 */
export type DruidFormType = 'humanoid' | 'bear' | 'cat' | 'moonkin';

// ============================================================================
// 形态定义接口
// ============================================================================

/**
 * 形态属性加成接口
 *
 * 描述形态提供的属性修正（正值为加成，负值为削减）。
 *
 * @property {Partial<Stats>} statModifiers - 基础属性修正
 * @property {number} hpMultiplier - 生命上限倍率（1.0 = 100%，1.3 = +30%）
 * @property {number} damageMultiplier - 伤害倍率（1.0 = 100%）
 * @property {number} defenseMultiplier - 防御倍率（1.0 = 100%）
 * @property {number} speedMultiplier - 速度倍率（1.0 = 100%）
 */
export interface FormStatModifiers {
  statModifiers: Partial<Stats>;
  hpMultiplier: number;
  damageMultiplier: number;
  defenseMultiplier: number;
  speedMultiplier: number;
}

/**
 * 德鲁伊形态定义接口
 *
 * @property {DruidFormType} id - 形态 ID
 * @property {string} name - 形态名称（如 "熊形态"）
 * @property {string} icon - 形态图标（Iconify 格式）
 * @property {string} description - 形态描述
 * @property {FormStatModifiers} modifiers - 属性修正
 * @property {string[]} availableSkills - 该形态可用的技能 ID 列表
 * @property {number} healPercent - 切换到此形态时恢复最大生命的百分比
 */
export interface DruidForm {
  id: DruidFormType;
  name: string;
  icon: string;
  description: string;
  modifiers: FormStatModifiers;
  availableSkills: string[];
  healPercent: number;
}

// ============================================================================
// 形态切换配置
// ============================================================================

/**
 * 形态切换配置常量
 */
export const FORM_SWITCH_CONFIG = {
  // P8-103 修复：移除未使用的 actionPointCost 字段——形态切换不消耗行动点（设计如此），
  // combat 回合切换由 initiative.endPlayerTurn() 控制，无行动点系统
  /** 切换形态恢复的最大生命百分比（计划要求：恢复 10% 生命） */
  defaultHealPercent: 0.10,
  /** 冷却回合数（0 表示无冷却） */
  cooldownTurns: 0,
} as const;

// ============================================================================
// 形态状态接口
// ============================================================================

/**
 * 形态系统状态接口
 *
 * @property {DruidFormType} currentForm - 当前形态
 * @property {DruidFormType[]} availableForms - 已解锁的形态列表
 * @property {number} cooldownRemaining - 冷却剩余回合数
 */
export interface FormState {
  currentForm: DruidFormType;
  availableForms: DruidFormType[];
  cooldownRemaining: number;
}
