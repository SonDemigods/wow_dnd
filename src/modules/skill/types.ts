/**
 * @fileoverview 技能模块类型定义
 * @description 包含技能类型、技能数据、技能栏、技能服务等相关类型定义。
 *              本文件是 skill 模块的类型基石，所有接口和类型别名均在此集中定义。
 * @module skill
 */

import type { EffectType } from '../combat/effects';

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 技能类型枚举
 *
 * 决定技能的核心行为语义和伤害计算公式。
 * - `physical_damage`：物理伤害技能（受力量 STR 加成，系数见 `getSkillCoefficient`）
 * - `magic_damage`：魔法伤害技能（受智力 INT 加成，系数见 `getSkillCoefficient`）
 * - `health_restore`：生命恢复技能（受智慧 WIS 加成，系数见 `getSkillCoefficient`）
 * - `mana_restore`：法力恢复技能（受智力 INT 加成，系数见 `getSkillCoefficient`）
 * - `buff`：增益技能（对自身/友方施加正面效果，效果通过 `buffs` 字段定义）
 * - `debuff`：减益技能（对敌人施加负面效果，效果通过 `buffs` 字段定义）
 *
 * @see calculateSkillDamage 根据此类型选择不同的伤害计算公式
 * @see Skill.buffs buff/debuff 类型的技能使用 `buffs` 字段而非 `effect.type`
 */
export type SkillType =
  | 'physical_damage'
  | 'magic_damage'
  | 'health_restore'
  | 'mana_restore'
  | 'buff'
  | 'debuff';

/**
 * 技能槽位索引类型
 *
 * 技能栏中 4 个槽位的索引范围（0-3）。
 * 使用字面量联合类型而非 `number`，提供编译时越界检查。
 *
 * @see SkillBar 技能栏固定 4 个槽位
 * @see equipSkill 使用此类型校验槽位索引
 */
export type SkillSlotIndex = 0 | 1 | 2 | 3;

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 技能效果接口
 *
 * 描述技能的直接效果参数（伤害/恢复），与 `buffs` 互补。
 * 注意：对于 `buff`/`debuff` 类型技能，实际的 buff 效果存储在 `Skill.buffs` 字段中，
 * `effect` 仅用于计算额外的数值型效果。
 *
 * @property {SkillType} type - 技能效果类型（实际使用中通常为数值型：damage/heal 系列）
 * @property {number} value - 基础效果值（受属性加成前的原始数值）
 * @property {number} [coefficient] - 自定义属性加成系数。如未提供，使用 `getSkillCoefficient` 按等级自动计算
 *
 * @see calculateSkillDamage 使用此接口计算实际伤害/恢复值
 */
export interface SkillEffect {
  type: SkillType;
  value: number;
  coefficient?: number;
}

/**
 * 技能 Buff/Debuff 效果配置
 *
 * 定义单个 Buff/Debuff 的具体参数，每个技能可包含多个 Buff 效果。
 * 效果类型引用自 `combat/effects` 模块的 `EffectType`，确保与战斗系统一致。
 *
 * @property {EffectType} type - 效果类型（attack_up / poison / shield / stun 等）
 * @property {number} value - 效果基础值（含义因 type 不同而异：攻击/防御变化量、护盾量、DoT 伤害等）
 * @property {number} turns - 持续回合数（控制效果何时自然消除，详见 combat 模块的回合系统）
 *
 * @see calculateBuffValue 根据 `stats.wis`（智慧）或 `stats.dex`（敏捷）对 value 进行属性加成
 */
export interface SkillBuffEffect {
  type: EffectType;
  value: number;
  turns: number;
}

/**
 * 技能数据接口
 *
 * 完整的技能运行时对象，包含静态配置属性和动态运行时状态。
 * 玩家已学技能列表 `skills` 中的每个元素均为此接口。
 *
 * 数据来源流程：
 * 1. 技能模板（`SkillTemplateStorage`）存储在 `config_skills` 表中
 * 2. `toSkill()` 将模板转换为 `Skill` 对象
 * 3. 玩家学习技能后，`Skill` 对象加入 `useSkillsStore().skills` 列表
 * 4. 装备到技能栏后，通过 `skillBar.slots` 中的 ID 索引对应的 `Skill` 对象
 *
 * @property {string} id - 技能唯一标识（格式：`{classId}_skill_{序号}`）
 * @property {string} name - 技能显示名称
 * @property {string} icon - 技能图标（Iconify 格式，如 `game-icons:sword-brandish`）
 * @property {string} description - 技能描述文本
 * @property {number} mpCost - 法力消耗值
 * @property {SkillType} type - 技能类型（决定伤害计算公式和 UI 展示）
 * @property {SkillEffect} effect - 技能直接效果（伤害/恢复）
 * @property {number} unlockLevel - 解锁所需等级（角色等级 >= 此值才可使用）
 * @property {number} [cooldown] - 冷却回合数（0 = 无冷却，每回合结束时 tickCooldowns 减 1）
 * @property {'player'|'enemy'|'both'} [usableBy] - 可用角色类型限制（默认仅玩家）
 * @property {'single'|'all_enemies'|'self'|'ally'} [targetType] - 目标选择策略
 * @property {SkillBuffEffect[]} [buffs] - Buff/Debuff 效果列表（仅 buff/debuff 类型技能有意义）
 *
 * @see SkillTemplateStorage 数据库模板对应的存储类型
 * @see toSkill 模板 → 运行时对象的转换逻辑
 */
export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: SkillEffect;
  unlockLevel: number;
  cooldown?: number;
  usableBy?: 'player' | 'enemy' | 'both';
  targetType?: 'single' | 'all_enemies' | 'self' | 'ally';
  buffs?: SkillBuffEffect[];
}

// ============================================================================
// 运行时结果接口
// ============================================================================

/**
 * 技能施放应用的效果记录
 *
 * 在一次技能施放中实际应用到目标的单个效果快照，
 * 携带经过属性加成计算后的最终数值。
 *
 * @property {EffectType} type - 效果类型
 * @property {number} value - 经过属性加成后的最终效果数值
 * @property {number} turns - 效果持续回合数
 *
 * @see castSkill buff/debuff 类型技能通过此接口将效果传回调用方（combatStore）
 */
export interface AppliedEffectInfo {
  type: EffectType;
  value: number;
  turns: number;
}

/**
 * 技能使用结果接口
 *
 * 一次技能施放操作的完整返回结果，由 `castSkill` 返回，
 * 调用方（combatStore / enemy AI）根据此结果执行后续逻辑。
 *
 * @property {boolean} success - 是否施放成功（false 时仅 message 有效）
 * @property {string} skillId - 施放的技能 ID
 * @property {SkillType} type - 技能类型（用于 UI 决定展示样式）
 * @property {number} [damage] - 造成的伤害值（仅在 physical/magic 类型时存在）
 * @property {number} [heal] - 生命恢复量（仅在 health_restore 类型时存在）
 * @property {string} message - 结果描述（成功时为技能名，失败时为错误原因）
 * @property {AppliedEffectInfo[]} [appliedEffects] - 施加的 buff/debuff 效果列表
 */
export interface SkillUseResult {
  success: boolean;
  skillId: string;
  type: SkillType;
  damage?: number;
  heal?: number;
  message: string;
  appliedEffects?: AppliedEffectInfo[];
}

// ============================================================================
// 技能栏接口
// ============================================================================

/**
 * 技能栏配置接口
 *
 * 管理玩家当前装备的 4 个技能槽位。每个槽位存储一个技能 ID 或 null（空槽）。
 * 固定长度为 4 的元组类型，确保不会越界访问。
 *
 * 数据持久化：技能栏数据随 `SkillsData` 一起存入 `char_skills` 表的 `skillBar` 字段。
 *
 * @property {[4]string|null} slots - 固定 4 槽位的技能 ID 数组，null 表示空槽
 *
 * @see equipSkill 装备技能到指定槽位
 * @see unequipSkill 卸下指定技能（按 ID 查找槽位）
 * @see swapSkills 交换两个槽位的技能
 */
export interface SkillBar {
  slots: [string | null, string | null, string | null, string | null];
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 技能模块存储数据接口
 *
 * 角色技能数据的持久化格式，存入 IndexedDB 的 `char_skills` 表。
 * skills 字段仅存储技能 ID 数组而非完整 Skill 对象，
 * 完整技能数据从 `config_skills`（技能模板表）按 ID 索引获取。
 *
 * 设计原则（数据规范化）：
 * - 避免数据冗余：同一技能的配置信息仅在 `config_skills` 表中存储一份
 * - 兼容性：模板更新后，所有玩家的技能效果自动同步
 * - 存储效率：减少 IndexedDB 存储空间
 *
 * @property {string} characterId - 角色 ID（主键）
 * @property {string[]} skills - 已学技能 ID 列表（仅存 ID，完整数据从 config_skills 模板获取）
 * @property {SkillBar} skillBar - 技能栏装备配置
 * @property {string|null} currentClass - 当前职业 ID
 * @property {number} updatedAt - 最后更新时间戳（毫秒）
 *
 * @see skillsDbService.saveSkillsData 写入数据库
 * @see skillsDbService.getSkillsData 从数据库读取并恢复为运行时状态
 */
export interface SkillsData {
  characterId: string;
  skills: string[];
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

/**
 * 技能模板存储接口
 *
 * 技能配置数据的持久化格式，存入 IndexedDB 的 `config_skills` 表。
 * 与 `Skill` 接口的区别：
 * - `SkillTemplateStorage`：数据库存储层，`targetType` 为 `string` 便于存储
 * - `Skill`：运行时对象，`targetType` 为字面量联合类型，提供更好的智能提示
 *
 * 通过 `toSkill()` 方法将存储格式转换为运行时 `Skill` 对象。
 *
 * @property {string} id - 技能唯一标识
 * @property {string} name - 技能名称
 * @property {string} icon - 技能图标（Iconify 格式）
 * @property {string} description - 技能描述文本
 * @property {number} mpCost - 法力消耗值
 * @property {SkillType} type - 技能类型
 * @property {object} effect - 技能效果（type 语义上应为数值型，不含 buff/debuff）
 * @property {number} unlockLevel - 解锁所需等级
 * @property {string|null} classRestriction - 职业限制（null = 所有职业可用）
 * @property {string} [targetType] - 目标类型（存储为 string，运行时通过 toSkill 收窄为字面量类型）
 * @property {'player'|'enemy'|'both'} [usableBy] - 可用角色类型（默认仅玩家）
 * @property {number} [cooldown] - 冷却回合数
 * @property {SkillBuffEffect[]} [buffs] - Buff/Debuff 效果列表
 *
 * @see toSkill 存储类型 → 运行时类型的转换逻辑
 */
export interface SkillTemplateStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: { type: SkillType; value: number; coefficient?: number };
  unlockLevel: number;
  classRestriction: string | null;
  targetType?: string;
  usableBy?: 'player' | 'enemy' | 'both';
  cooldown?: number;
  buffs?: SkillBuffEffect[];
}
