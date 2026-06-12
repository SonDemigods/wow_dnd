/**
 * @fileoverview 技能模块类型定义
 * @description 包含技能类型、技能数据、技能栏、技能服务等相关类型定义
 */

/**
 * 技能类型枚举
 * - physical_damage: 物理伤害技能
 * - magic_damage: 魔法伤害技能
 * - health_restore: 治疗技能
 * - mana_restore: 法力恢复技能
 */
export type SkillType = 'physical_damage' | 'magic_damage' | 'health_restore' | 'mana_restore';

/**
 * 技能槽位索引类型
 * 技能栏中4个槽位的索引范围（0-3）
 */
export type SkillSlotIndex = 0 | 1 | 2 | 3;

/**
 * 技能效果接口
 * 描述技能效果的详细参数
 * @property {SkillType} type - 技能类型
 * @property {number} value - 基础效果值
 * @property {number} [coefficient] - 系数（用于计算实际效果）
 */
export interface SkillEffect {
  type: SkillType;
  value: number;
  coefficient?: number;
}

/**
 * 技能数据接口
 * 完整的技能信息，包含静态属性和运行时状态
 * @property {string} id - 技能ID
 * @property {string} name - 技能名称
 * @property {string} icon - 技能图标
 * @property {string} description - 技能描述
 * @property {number} mpCost - 法力消耗
 * @property {SkillType} type - 技能类型
 * @property {SkillEffect} effect - 技能效果
 * @property {number} unlockLevel - 解锁等级
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
  /** 冷却回合数，0=无冷却 */
  cooldown?: number;
  /** 可使用此技能的角色类型，默认仅玩家 */
  usableBy?: 'player' | 'enemy' | 'both';
  /** 技能目标类型 */
  targetType?: 'single' | 'all_enemies' | 'self' | 'ally';
}

/**
 * 技能使用结果接口
 * 技能使用后的返回结果
 * @property {boolean} success - 是否成功
 * @property {string} skillId - 技能ID
 * @property {SkillType} type - 技能类型
 * @property {number} [damage] - 造成的伤害
 * @property {number} [heal] - 治疗量
 * @property {string} message - 结果消息
 */
export interface SkillUseResult {
  success: boolean;
  skillId: string;
  type: SkillType;
  damage?: number;
  heal?: number;
  message: string;
}

/**
 * 技能栏配置接口
 * 管理玩家当前装备的4个技能
 * @property {[string | null, string | null, string | null, string | null]} slots - 技能槽位（4个），存储技能ID或null
 */
export interface SkillBar {
  slots: [string | null, string | null, string | null, string | null];
}

/**
 * 技能模块存储数据接口
 * @property {string} characterId - 角色ID
 * @property {Skill[]} skills - 技能列表
 * @property {SkillBar} skillBar - 技能栏配置
 * @property {string | null} currentClass - 当前职业
 * @property {number} updatedAt - 更新时间戳
 */
export interface SkillsData {
  characterId: string;
  skills: Skill[];
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

/**
 * 技能施放事件数据接口
 * @property {Skill} skill - 技能数据
 * @property {boolean} success - 是否成功
 */
export interface SkillCastEventData {
  skill: Skill;
  success: boolean;
}

/**
 * 技能装备事件数据接口
 * @property {string} skillId - 技能ID
 * @property {SkillSlotIndex} slotIndex - 槽位索引
 */
export interface SkillEquippedEventData {
  skillId: string;
  slotIndex: SkillSlotIndex;
}

/**
 * 技能解锁事件数据接口
 * @property {Skill} skill - 技能数据
 */
export interface SkillUnlockedEventData {
  skill: Skill;
}

/**
 * 技能栏变更事件数据接口
 * @property {SkillBar['slots']} slots - 新的槽位配置
 */
export interface SkillBarChangedEventData {
  slots: SkillBar['slots'];
}

/**
 * 技能服务接口
 * 提供技能管理的核心功能
 */
export interface ISkillsService {
  /**
   * 获取所有技能
   * @returns {Skill[]} 技能列表
   */
  getSkills(): Skill[];

  /**
   * 根据ID获取技能
   * @param {string} id - 技能ID
   * @returns {Skill | null} 技能数据
   */
  getSkill(id: string): Skill | null;

  /**
   * 获取已装备的技能
   * @returns {Skill[]} 已装备技能列表
   */
  getEquippedSkills(): Skill[];

  /**
   * 获取已解锁的技能
   * @returns {Skill[]} 已解锁技能列表
   */
  getUnlockedSkills(): Skill[];

  /**
   * 获取未解锁的技能
   * @returns {Skill[]} 未解锁技能列表
   */
  getLockedSkills(): Skill[];

  /**
   * 检查技能是否可以使用
   * @param {string} skillId - 技能ID
   * @returns {boolean} 是否可以使用
   */
  canUseSkill(skillId: string): boolean;

  /**
   * 使用技能
   * @param {string} skillId - 技能ID
   * @returns {SkillUseResult} 使用结果
   */
  useSkill(skillId: string): SkillUseResult;

  /**
   * 装备技能到指定槽位
   * @param {string} skillId - 技能ID
   * @param {SkillSlotIndex} slotIndex - 槽位索引
   * @returns {boolean} 是否成功装备
   */
  equipSkill(skillId: string, slotIndex: SkillSlotIndex): boolean;

  /**
   * 卸下指定槽位的技能
   * @param {SkillSlotIndex} slotIndex - 槽位索引
   * @returns {boolean} 是否成功卸下
   */
  unequipSkill(slotIndex: SkillSlotIndex): boolean;

  /**
   * 交换两个槽位的技能
   * @param {SkillSlotIndex} slotIndex1 - 第一个槽位
   * @param {SkillSlotIndex} slotIndex2 - 第二个槽位
   * @returns {boolean} 是否成功交换
   */
  swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): boolean;

  /**
   * 根据类型获取技能
   * @param {SkillType} type - 技能类型
   * @returns {Skill[]} 技能列表
   */
  getSkillsByType(type: SkillType): Skill[];

  /**
   * 计算技能效果
   * @param {string} skillId - 技能ID
   * @returns {SkillEffect} 技能效果
   */
  calculateSkillEffect(skillId: string): SkillEffect;

  /** 检查等级解锁 */
  checkLevelUnlocks(shouldAutoEquip?: boolean): void;

  /** 重置技能数据 */
  reset(): void;
}

/**
 * 技能查询条件接口
 * 用于过滤技能的条件对象
 * @property {SkillType} [type] - 技能类型
 * @property {boolean} [isUnlocked] - 是否已解锁
 * @property {number} [minUnlockLevel] - 最小解锁等级
 * @property {number} [maxUnlockLevel] - 最大解锁等级
 */
export interface SkillQuery {
  type?: SkillType;
  isUnlocked?: boolean;
  minUnlockLevel?: number;
  maxUnlockLevel?: number;
}

/**
 * 技能施放验证结果接口
 * 检查技能是否可以使用的验证结果
 * @property {boolean} canUse - 是否可以使用
 * @property {'not_in_combat' | 'not_equipped' | 'insufficient_mp' | 'not_unlocked'} [failureReason] - 失败原因
 * @property {number} [currentMp] - 当前法力值
 * @property {number} [requiredMp] - 所需法力值
 */
export interface SkillValidationResult {
  canUse: boolean;
  failureReason?:
    | 'not_in_combat'
    | 'not_equipped'
    | 'insufficient_mp'
    | 'not_unlocked';
  currentMp?: number;
  requiredMp?: number;
}

/**
 * 技能数据存储接口（存储到 char_skills 表的结构）
 */
export interface SkillDataStorage {
  characterId: string;
  /** 已学技能列表（原生数组，非 JSON 字符串） */
  skills: Skill[];
  /** 技能栏装备状态（原生对象，非 JSON 字符串） */
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

/**
 * 技能模板存储接口
 */
export interface SkillTemplateStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: string;
  effect: { type: string; value: number };
  unlockLevel: number;
  classRestriction: string | null;
  targetType?: string;
}

/**
 * 技能模板存储格式
 */
export interface SkillConfigStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: string;
  effect: { type: string; value: number; coefficient?: number };
  unlockLevel: number;
  classRestriction?: string | null;
  targetType?: string;
}

/**
 * 角色技能存储格式
 */
export interface CharSkillsStorage {
  characterId: string;
  skills: Array<{ id: string; name: string; [key: string]: unknown }>;
  skillBar: { slots: [string | null, string | null, string | null, string | null] };
  currentClass: string | null;
  updatedAt: number;
}
