/**
 * @fileoverview 技能模块状态管理（Pinia Store 核心架构）
 * @description Store 是技能数据的唯一持有者，所有响应式状态集中管理。
 *              Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 *
 * 架构设计原则：
 * - **单一数据源**：所有技能状态由本 Store 持有，外部通过 Action 间接修改
 * - **分层职责**：Store（编排） → Service（纯计算） → DB（持久化）
 * - **跨模块通信**：直接调用 `useCharacterStore()` 的 Action，不再通过 EventBus 传递数据变更事件
 * - **事件总线仅用于 UI 通知**：`SKILL_CAST`、`SKILL_LEARNED` 等用于触发动画/音效
 *
 * 数据流示意：
 * ```
 * UI 组件
 *   ↓ 调用 Action
 * Store（this）
 *   ↓ 调用 Service 纯函数校验/计算
 * Service（纯函数）
 *   ↓ 返回结果
 * Store（更新响应式状态）
 *   ↓ persist()
 * DB（IndexedDB 持久化）
 *   ↓ EventBus.emit
 * UI（动画 + 音效提示）
 * ```
 * @module skill
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Skill, SkillBar, SkillType, SkillSlotIndex, SkillUseResult, AppliedEffectInfo } from './types';
import { skillsDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { useCharacterStore } from '../character/store';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import {
  calculateSkillDamage,
  calculateBuffValue,
  canLearnSkill,
  validateSkillBarSlot,
  canCastSkill
} from './service';

/**
 * 技能类型 → 中文名称映射表
 *
 * 用于 UI 展示（如技能列表、技能详情弹窗），将内部枚举值转换为用户可读的中文标签。
 */
const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  health_restore: '生命恢复',
  mana_restore: '法力恢复',
  buff: '增益',
  debuff: '减益'
};

/**
 * 技能状态存储（Pinia Store）
 *
 * 全局单例，通过 `useSkillsStore()` 获取。
 * 持有所有技能相关的响应式状态，并提供编排 Action 供外部调用。
 */
export const useSkillsStore = defineStore('skills', () => {
  // ========================================================================
  // 响应式状态（Store 是唯一数据源，不可直接修改，必须通过 Action）
  // ========================================================================

  /** 已学技能列表（运行时 `Skill` 对象数组，从 DB 加载时由模板 ID 解析） */
  const skills = ref<Skill[]>([]);

  /** 技能栏配置（4 个槽位，存储技能 ID 或 null） */
  const skillBar = ref<SkillBar>({ slots: [null, null, null, null] });

  /** 技能模板缓存（key: skillId → value: Skill，按职业加载，用于还原 skills 列表和装备操作） */
  const skillTemplates = ref<Map<string, Skill>>(new Map());

  /** 怪物/首领技能模板缓存（key: skillId → value: Skill，敌人 AI 专用） */
  const monsterSkillTemplates = ref<Map<string, Skill>>(new Map());

  /** 当前操作的角色 ID（初始化时设置，用于持久化时自动关联） */
  const currentCharacterId = ref<string | null>(null);

  /** 加载状态（初始化时为 true，完成后为 false，UI 可绑定此状态显示加载指示器） */
  const isLoading = ref(false);

  /**
   * 技能冷却状态
   *
   * key = skillId，value = 剩余冷却回合数。
   * 每回合结束时调用 `tickCooldowns()` 减 1，到达 0 后自动删除条目。
   */
  const cooldowns = ref<Record<string, number>>({});

  // ========================================================================
  // 计算属性（派生状态，自动响应依赖变化）
  // ========================================================================

  /**
   * 已解锁技能（角色等级 >= 技能解锁等级）
   *
   * 依赖 `skills` 和 `useCharacterStore().level`，任一变更自动重算。
   */
  const unlockedSkills = computed(() => {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    return skills.value.filter(s => s.unlockLevel <= characterLevel);
  });

  /**
   * 未解锁技能（角色等级 < 技能解锁等级）
   *
   * UI 中通常以灰色样式展示，提示玩家升级后解锁。
   */
  const lockedSkills = computed(() => {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    return skills.value.filter(s => s.unlockLevel > characterLevel);
  });

  /**
   * 已装备技能（技能栏中的完整 Skill 对象数组）
   *
   * 通过 `skillBar.slots` 中的 ID 查找对应的 `Skill` 对象，
   * 空槽位对应 null。UI 层可直接遍历此数组渲染技能栏。
   */
  const equippedSkills = computed(() => {
    return skillBar.value.slots.map(skillId => {
      if (!skillId) return null;
      return skills.value.find(s => s.id === skillId) || null;
    });
  });

  /**
   * 技能栏槽位详细信息
   *
   * 在 `equippedSkills` 基础上附加槽位索引和空状态标识，
   * 方便 UI 组件按槽位渲染（如显示"空槽位"占位符）。
   */
  const skillBarSlots = computed(() => {
    return skillBar.value.slots.map((skillId, index) => {
      const skill = skillId ? skills.value.find(s => s.id === skillId) : null;
      return {
        index: index as SkillSlotIndex,
        skillId,
        skill,
        isEmpty: !skillId
      };
    });
  });

  /**
   * 按类型统计技能数量
   *
   * 用于 UI 展示各类技能的持有数（如"物理伤害: 3 个"）。
   * 返回 Record 包含所有 `SkillType` 键，确保类型安全访问。
   */
  const skillCountByType = computed(() => {
    const counts: Record<SkillType, number> = {
      physical_damage: 0,
      magic_damage: 0,
      health_restore: 0,
      mana_restore: 0,
      buff: 0,
      debuff: 0
    };

    skills.value.forEach(skill => {
      counts[skill.type]++;
    });

    return counts;
  });

  // ========================================================================
  // 内部辅助函数（不对外暴露）
  // ========================================================================

  /**
   * 保存技能数据到数据库
   *
   * 将 Store 中的 `skills`（ID 数组）+ `skillBar` 持久化到 IndexedDB。
   * `skills` 仅存储 ID 数组，完整 Skill 对象从模板缓存还原。
   * 这是每次数据变更后的统一持久化入口。
   */
  async function persist(): Promise<void> {
    const characterStore = useCharacterStore();
    const charId = currentCharacterId.value || characterStore.getCharacterId();
    if (!charId) return;

    await skillsDbService.saveSkillsData({
      characterId: charId,
      // 仅存 ID 数组，完整数据从模板缓存中按 ID 还原
      skills: skills.value.map(s => s.id),
      skillBar: skillBar.value,
      currentClass: characterStore.classId,
      updatedAt: Date.now()
    });
  }

  /**
   * 记录技能学习日志和事件（公共逻辑提取）
   *
   * 在学习新技能和等级解锁技能两个场景中复用，
   * 统一发送 `SKILL_LEARNED` 事件（触发 UI 动画）并写入冒险日志。
   *
   * @param skill - 被学习的技能
   */
  function logSkillLearned(skill: Skill): void {
    // 发送事件 → UI 播放学习动画 + 音效
    eventBus.emit(GameEvents.SKILL_LEARNED, { skill });
    // 写入冒险日志 → 在日志面板中展示
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'skill',
      message: `学会了新技能：${skill.name}！`,
      icon: 'game-icons:spell-book'
    });
  }

  // ========================================================================
  // Action：初始化
  // ========================================================================

  /**
   * 初始化技能模块（标准初始化流程）
   *
   * 按以下顺序执行：
   * 1. 加载职业技能模板到内存缓存（`skillTemplates`）
   * 2. 加载怪物/首领技能模板到内存缓存（`monsterSkillTemplates`）
   * 3. 从 DB 读取角色技能数据（仅 ID 数组 + 技能栏）
   * 4. 用模板缓存将 ID 数组还原为完整 `Skill` 对象
   * 5. 检查等级解锁（不自动装备，避免覆盖用户手动卸下的技能）
   *
   * @param characterId - 角色 ID（可选，不传时自动从 `characterStore` 获取）
   *
   * @remarks `checkLevelUnlocks(false)` 传入 false 表示不自动装备新技能，
   *          仅在初始化时使用此策略，等级提升时单独触发自动装备。
   */
  async function initialize(characterId?: string): Promise<void> {
    isLoading.value = true;

    const characterStore = useCharacterStore();
    const charId = characterId || characterStore.getCharacterId();
    if (!charId) {
      isLoading.value = false;
      return;
    }

    currentCharacterId.value = charId;

    // 1. 先加载技能模板（后续解析 ID 需要）
    await loadTemplatesForClass(characterStore.classId);

    // 2. 加载怪物/首领技能模板（供敌人 AI 使用）
    await loadMonsterSkillTemplates();

    // 3. 从 DB 加载技能数据（skills 为 ID 数组）
    const data = await skillsDbService.getSkillsData(charId);
    skillBar.value = data.skillBar;

    // 4. 从模板解析 ID 为完整 Skill 对象
    skills.value = data.skills
      .map(id => skillTemplates.value.get(id))
      .filter((s): s is Skill => s !== undefined);

    // 5. 初始化时不自动装备新技能（仅添加技能到已学列表），避免覆盖用户手动卸下的技能
    await checkLevelUnlocks(false);

    isLoading.value = false;
  }

  // ========================================================================
  // Action：学习技能
  // ========================================================================

  /**
   * 学习新技能
   *
   * 执行流程：
   * 1. 从模板缓存获取技能模板
   * 2. 调用 `canLearnSkill` 进行条件校验（等级 + 重复学习检查）
   * 3. 添加技能副本到已学列表
   * 4. 自动装备到第一个空槽位（如果有空槽位）
   * 5. 持久化到 DB
   * 6. 发送学习通知（事件 + 日志）
   *
   * @param skillId - 技能模板 ID
   * @returns `true` = 学习成功，`false` = 模板不存在或不满足学习条件
   *
   * @see canLearnSkill 学习条件校验逻辑
   */
  async function learnSkill(skillId: string): Promise<boolean> {
    const template = skillTemplates.value.get(skillId);
    if (!template) return false;

    const characterStore = useCharacterStore();
    if (!canLearnSkill(template, characterStore.level, skills.value)) {
      return false;
    }

    // 添加技能副本（展开运算符防止引用共享）
    skills.value.push({ ...template });

    // 自动装备到第一个空槽位
    const emptySlot = skillBar.value.slots.findIndex(s => s === null);
    if (emptySlot !== -1) {
      skillBar.value.slots[emptySlot] = skillId;
    }

    // 持久化
    await persist();

    // 通知 UI（动画 + 音效）并记录冒险日志
    logSkillLearned(template);

    return true;
  }

  // ========================================================================
  // Action：施放技能
  // ========================================================================

  /**
   * 施放技能（核心战斗操作）
   *
   * 完整的施放流程：
   *
   * ```
 * 1. 查找技能（skills 列表 → 模板缓存回退）
 * 2. 检查法力值（canCastSkill）
 * 3. 检查冷却（isOnCooldown → 冷却中不可施放）
 * 4. 消耗法力值 → characterStore.changeMp
 * 5. 计算效果值（calculateSkillDamage / calculateBuffValue）
 * 6. 按技能类型执行效果（伤害/恢复/buff/debuff）
 * 7. 通知 UI（SKILL_CAST 事件 → 动画 + 音效）
 * 8. 记录冒险日志（非战斗场景）
 * 9. 记录冷却
 * 10. 返回 SkillUseResult
 * ```
   *
   * @param skillId - 技能 ID
   * @param skipAdventureLog - 是否跳过冒险日志记录（战斗场景设为 true，仅记录战斗日志）
   * @returns 技能使用结果（包含成功/失败状态 + 伤害/恢复/效果数据）
   *
   * @see canCastSkill 法力校验
   * @see calculateSkillDamage 伤害/恢复值计算
   * @see calculateBuffValue Buff 效果值计算
   */
  async function castSkill(skillId: string, skipAdventureLog: boolean = false): Promise<SkillUseResult> {
    const characterStore = useCharacterStore();
    const charData = characterStore.getCharacterData();
    // 查找技能：优先已学列表，其次模板缓存（支持模板技能施放）
    const skill = skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId);

    if (!skill) {
      return {
        success: false,
        skillId,
        type: 'physical_damage',
        message: '技能不存在'
      };
    }

    // 1. 校验技能是否可施放（法力值检查）
    const castCheck = canCastSkill(skill, charData?.mana || 0);
    if (!castCheck.canCast) {
      return {
        success: false,
        skillId,
        type: skill.type,
        message: castCheck.reason
      };
    }

    // 1b. 冷却检查（冷却中不可施放）
    if (isOnCooldown(skillId)) {
      return {
        success: false,
        skillId,
        type: skill.type,
        message: `技能冷却中（剩余 ${getCooldownRemaining(skillId)} 回合）`
      };
    }

    // 2. 消耗法力值 → 直接调用 characterStore Action
    await characterStore.changeMp(-skill.mpCost);

    // 3. 计算技能效果值（属性加成后的最终数值）
    const damageValue = calculateSkillDamage(skill, characterStore.effectiveStats);

    // 4. 应用技能效果（按类型执行不同逻辑）
    let damage: number | undefined;
    let heal: number | undefined;
    let appliedEffects: AppliedEffectInfo[] | undefined;

    switch (skill.type) {
      case 'physical_damage':
      case 'magic_damage':
        // 伤害类：返回 damage 值，由调用方（combatStore）应用到目标
        damage = damageValue;
        break;

      case 'health_restore':
        // 生命恢复：返回 heal 值并直接调用 characterStore 恢复 HP
        heal = damageValue;
        await characterStore.receiveHeal(damageValue);
        break;

      case 'mana_restore':
        // 法力恢复：直接调用 characterStore 恢复 MP
        await characterStore.changeMp(damageValue);
        break;

      case 'buff':
      case 'debuff':
        // buff/debuff 效果由 combatStore.playerSkill 实际应用到目标
        // 这里只计算效果值，通过 appliedEffects 传回调用方
        if (skill.buffs && skill.buffs.length > 0) {
          appliedEffects = skill.buffs.map(be => ({
            type: be.type,
            value: calculateBuffValue(be, characterStore.effectiveStats),
            turns: be.turns
          }));
        }
        break;
    }

    // 5. 通知 UI（动画 + 音效）
    eventBus.emit(GameEvents.SKILL_CAST, { skill, success: true });

    // 6. 记录冒险日志（战斗中施放技能由 combatStore 记录，此处跳过避免重复）
    if (!skipAdventureLog) {
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'skill',
        message: `施放了技能：${skill.name}`,
        icon: 'game-icons:lightning-storm'
      });
    }

    // 7. 记录冷却（如果技能有冷却回合数）
    if (skill.cooldown && skill.cooldown > 0) {
      cooldowns.value[skillId] = skill.cooldown;
    }

    return {
      success: true,
      skillId,
      type: skill.type,
      damage,
      heal,
      appliedEffects,
      message: `使用了 ${skill.name}`
    };
  }

  // ========================================================================
  // Action：装备/卸下/交换技能
  // ========================================================================

  /**
   * 装备技能到指定槽位
   *
   * 如果技能尚未学习（不在 `skills` 列表中），会自动添加到列表后装备。
   *
   * @param skillId - 技能 ID
   * @param slotIndex - 目标槽位索引（0-3）
   * @returns `true` = 装备成功，`false` = 槽位无效或技能不存在
   */
  async function equipSkill(skillId: string, slotIndex: SkillSlotIndex): Promise<boolean> {
    // 校验槽位有效性
    if (!validateSkillBarSlot(slotIndex)) {
      return false;
    }

    // 查找技能（已学列表或模板）
    const skill = skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId);
    if (!skill) return false;

    // 检查是否已解锁（等级不足不可装备）
    const characterStore = useCharacterStore();
    if (skill.unlockLevel > characterStore.level) {
      return false;
    }

    // 如果技能不在已学列表中，添加进去（支持从模板直接装备）
    if (!skills.value.some(s => s.id === skillId)) {
      skills.value.push({ ...skill });
    }

    // 直接覆盖槽位（无需先设为 null，React 响应式系统会正确处理）
    skillBar.value.slots[slotIndex] = skillId;

    // 持久化
    await persist();

    return true;
  }

  /**
   * 卸下指定技能（按技能 ID 查找槽位）
   *
   * 遍历 4 个槽位查找目标技能，找到后将其设置为 null。
   * 不删除已学技能，仅从技能栏移除。
   *
   * @param skillId - 要卸下的技能 ID
   * @returns `true` = 卸下成功，`false` = 该技能不在技能栏中
   */
  async function unequipSkill(skillId: string): Promise<boolean> {
    const slotIndex = skillBar.value.slots.findIndex(s => s === skillId);
    if (slotIndex === -1) return false;

    skillBar.value.slots[slotIndex] = null;

    // 持久化
    await persist();

    return true;
  }

  /**
   * 交换两个槽位的技能
   *
   * 使用临时变量进行交换，支持任意两个槽位（包括空槽位）。
   *
   * @param slotIndex1 - 第一个槽位
   * @param slotIndex2 - 第二个槽位
   * @returns `true` = 交换成功，`false` = 两槽位相同（无效操作）
   */
  async function swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): Promise<boolean> {
    // 相同槽位无需交换
    if (slotIndex1 === slotIndex2) return false;

    // 经典三变量交换
    const temp = skillBar.value.slots[slotIndex1];
    skillBar.value.slots[slotIndex1] = skillBar.value.slots[slotIndex2];
    skillBar.value.slots[slotIndex2] = temp;

    // 持久化
    await persist();

    return true;
  }

  // ========================================================================
  // Action：查询技能（纯查询，不产生副作用）
  // ========================================================================

  /**
   * 根据 ID 获取技能数据（纯查询，不产生副作用）
   *
   * 查询优先级：已学技能列表 → 玩家技能模板 → 怪物技能模板
   * 确保在任何上下文中都能找到技能数据。
   *
   * @param skillId - 技能 ID
   * @returns 技能对象或 null（三处缓存均不存在时）
   */
  function getSkill(skillId: string): Skill | null {
    return skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId)
      || monsterSkillTemplates.value.get(skillId)
      || null;
  }

  /**
   * 获取可用技能列表（已解锁的技能，纯查询）
   *
   * 代理到 `unlockedSkills` 计算属性，提供面向调用方的语义化命名。
   *
   * @returns 已解锁技能列表
   */
  function getAvailableSkills(): Skill[] {
    return unlockedSkills.value;
  }

  /**
   * 根据类型获取技能
   *
   * @param type - 技能类型
   * @returns 指定类型的技能列表（可能为空数组）
   */
  function getSkillsByType(type: SkillType): Skill[] {
    return skills.value.filter(s => s.type === type);
  }

  /**
   * 检查技能是否可以使用（综合校验）
   *
   * 校验条件：
   * 1. 技能存在（三处缓存中任意一处）
   * 2. 角色等级 >= 解锁等级
   * 3. 法力值足够
   * 4. 不在冷却中
   *
   * @param skillId - 技能 ID
   * @returns `true` = 满足所有条件可以施放
   */
  function canUseSkill(skillId: string): boolean {
    const skill = getSkill(skillId);
    if (!skill) return false;

    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    if (skill.unlockLevel > characterLevel) return false;

    const charData = characterStore.getCharacterData();
    if (!canCastSkill(skill, charData?.mana || 0).canCast) return false;

    // 冷却检查
    return !isOnCooldown(skillId);
  }

  // ========================================================================
  // Action：加载模板
  // ========================================================================

  /**
   * 通用模板加载器：清空缓存 → 查询 → 填充 Map
   *
   * 封装"加载模板到 Map 缓存"的通用模式，避免 `loadTemplatesForClass` 和
   * `loadMonsterSkillTemplates` 中的代码重复。
   *
   * @param templateMap - 目标模板缓存 Map（skillTemplates 或 monsterSkillTemplates）
   * @param fetcher - 查询函数（从 DB 获取技能数组）
   */
  async function loadTemplatesTo(
    templateMap: typeof skillTemplates,
    fetcher: () => Promise<Skill[]>
  ): Promise<void> {
    // 清空旧缓存（防止残留数据污染新加载结果）
    templateMap.value.clear();
    const templates = await fetcher();
    // 重新填充 Map（O(n) 时间复杂度）
    const newMap = new Map<string, Skill>();
    templates.forEach(skill => newMap.set(skill.id, skill));
    templateMap.value = newMap;
  }

  /**
   * 加载指定职业的技能模板到缓存
   *
   * 仅在职业切换或初始化时调用。如果 `classId` 为空（未选择职业），
   * 清空缓存后直接返回，避免无效的 DB 查询。
   *
   * @param classId - 职业 ID（空字符串时短路清空）
   */
  async function loadTemplatesForClass(classId: string): Promise<void> {
    // classId 为空时短路：只清空缓存，不查询 DB
    if (!classId) {
      skillTemplates.value.clear();
      return;
    }
    await loadTemplatesTo(skillTemplates, () => skillsDbService.getSkillTemplatesByClass(classId));
  }

  /**
   * 加载怪物/首领技能模板到缓存
   *
   * 从数据库查询 `usableBy = 'enemy' | 'both'` 的技能模板，
   * 供敌人 AI 使用，不会被玩家学习或出现在玩家技能列表中。
   */
  async function loadMonsterSkillTemplates(): Promise<void> {
    await loadTemplatesTo(monsterSkillTemplates, () => skillsDbService.getMonsterSkillTemplates());
  }

  // ========================================================================
  // Action：获取职业技能模板（直接查询 DB，不修改 Store 状态）
  // ========================================================================

  /**
   * 获取指定职业的技能模板列表
   *
   * 直接查询 DB，不修改 Store 内部状态。
   * 用于 UI 端预览某职业的所有技能（如技能图鉴）。
   *
   * @param classId - 职业 ID
   * @returns 该职业的所有技能模板
   */
  async function getSkillTemplatesByClass(classId: string): Promise<Skill[]> {
    return await skillsDbService.getSkillTemplatesByClass(classId);
  }

  // ========================================================================
  // Action：等级解锁检查
  // ========================================================================

  /**
   * 检查等级解锁（角色升级时触发）
   *
   * 遍历所有职业技能模板，检查是否有满足解锁条件但尚未学习的技能。
   * 发现新技能后自动添加到 `skills` 列表，并可选地自动装备。
   *
   * @param shouldAutoEquip - 是否自动装备新技能到空槽位
   *   - `true`：升级时自动装备（正常游戏流程）
   *   - `false`：初始化时不自动装备（避免覆盖用户手动卸下的技能）
   *
   * @remarks 只有触发新解锁时才会调用 `persist()` 持久化，
   *          避免每次检查都写入数据库。
   */
  async function checkLevelUnlocks(shouldAutoEquip: boolean = true): Promise<void> {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;

    let hasNewSkills = false;

    // 遍历模板，检查是否有新技能可以解锁
    skillTemplates.value.forEach(template => {
      const exists = skills.value.some(s => s.id === template.id);
      if (!exists && template.unlockLevel <= characterLevel) {
        // 解锁新技能（首次学习时触发）
        skills.value.push({ ...template });
        hasNewSkills = true;

        // 仅在 shouldAutoEquip=true 时（升级场景）自动装备到空槽位
        if (shouldAutoEquip) {
          const emptySlot = skillBar.value.slots.findIndex(s => s === null);
          if (emptySlot !== -1) {
            skillBar.value.slots[emptySlot] = template.id;
          }
        }

        // 通知 UI（动画 + 音效）并记录冒险日志
        logSkillLearned(template);
      }
    });

    // 有新技能解锁时才持久化（避免无效写入）
    if (hasNewSkills) {
      await persist();
    }
  }

  // ========================================================================
  // Action：模板管理（管理后台/编辑器使用）
  // ========================================================================

  /**
   * 添加技能模板（同时更新内存缓存和 DB）
   *
   * @param skill - 完整技能数据
   */
  async function addSkillTemplate(skill: Skill): Promise<void> {
    skillTemplates.value.set(skill.id, skill);
    await skillsDbService.saveSkillTemplate(skill);
  }

  /**
   * 删除技能模板（同时从内存缓存和 DB 移除）
   *
   * @param skillId - 技能 ID
   */
  async function removeSkillTemplate(skillId: string): Promise<void> {
    skillTemplates.value.delete(skillId);
    await skillsDbService.deleteSkillTemplate(skillId);
  }

  // ========================================================================
  // Action：冷却管理
  // ========================================================================

  /**
   * 减少所有冷却回合数（每回合结束时调用）
   *
   * 遍历 `cooldowns` 中所有条目，将剩余回合数减 1。
   * 减到 0 后自动删除该条目（表示冷却完毕）。
   */
  function tickCooldowns(): void {
    for (const key of Object.keys(cooldowns.value)) {
      if (cooldowns.value[key] > 0) {
        cooldowns.value[key]--;
        // 冷却完毕 → 移除条目
        if (cooldowns.value[key] === 0) {
          delete cooldowns.value[key];
        }
      }
    }
  }

  /**
   * 检查技能是否在冷却中
   *
   * @param skillId - 技能 ID
   * @returns `true` = 冷却中不可使用
   */
  function isOnCooldown(skillId: string): boolean {
    return (cooldowns.value[skillId] || 0) > 0;
  }

  /**
   * 获取冷却剩余回合数
   *
   * @param skillId - 技能 ID
   * @returns 剩余冷却回合数（0 = 无冷却或冷却已完成）
   */
  function getCooldownRemaining(skillId: string): number {
    return cooldowns.value[skillId] || 0;
  }

  // ========================================================================
  // Action：重置
  // ========================================================================

  /**
   * 重置技能数据（回到初始状态）
   *
   * 清空所有响应式状态并持久化到 DB。
   * 用于角色重置、切换存档等场景。
   */
  async function reset(): Promise<void> {
    skills.value = [];
    skillBar.value = { slots: [null, null, null, null] };
    skillTemplates.value.clear();
    monsterSkillTemplates.value.clear();
    cooldowns.value = {};
    currentCharacterId.value = null;
    await persist();
  }

  // ========================================================================
  // 导出（对外暴露的响应式状态 + Action）
  // ========================================================================

  return {
    // 响应式状态
    skills,
    skillBar,
    skillTemplates,
    monsterSkillTemplates,
    currentCharacterId,
    isLoading,
    cooldowns,

    // 计算属性
    unlockedSkills,
    lockedSkills,
    equippedSkills,
    skillBarSlots,
    skillCountByType,

    // Action
    initialize,
    learnSkill,
    castSkill,
    equipSkill,
    unequipSkill,
    swapSkills,
    getSkill,
    getAvailableSkills,
    getSkillsByType,
    canUseSkill,
    loadTemplatesForClass,
    loadMonsterSkillTemplates,
    getSkillTemplatesByClass,
    checkLevelUnlocks,
    addSkillTemplate,
    removeSkillTemplate,
    reset,

    // 冷却管理
    tickCooldowns,
    isOnCooldown,
    getCooldownRemaining,

    // 常量
    SKILL_TYPE_NAMES
  };
});
