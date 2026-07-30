/**
 * @fileoverview 战斗上下文接口与工厂（S2 解耦核心 / A2 读写分离）
 *
 * 将 combat 模块对 character / skill / quest / log / enemy / inventory 六个外部
 * Store 的依赖收口为单一接口。combat 内部所有 composable 仅依赖此接口，不再直接
 * import 具体 Store，实现模块间静态解耦与可独立测试。
 *
 * ## A2 读写分离
 *
 * `ICombatContext` 进一步拆分为 `ICombatQuery`（只读）与 `ICombatCommand`（写入）：
 * - `ICombatQuery`：属性读取 + 纯查询方法，供只读消费者使用（如未来战斗回放）
 * - `ICombatCommand`：状态变更方法，供写入消费者使用
 * - `ICombatContext = ICombatQuery & ICombatCommand`：完整上下文，向后兼容
 *
 * composable 可按需声明读/写意图：
 * - 只读 composable 接收 `ICombatQuery`（编译期保证无副作用）
 * - 需要写入的 composable 接收 `ICombatContext` 或 `ICombatCommand`
 *
 * 设计原则：
 * 1. 接口最小化：仅暴露 combat 模块实际使用的方法（已逐文件核对调用点）
 * 2. 保持响应式：Store 计算属性通过 getter 代理，避免值拷贝丢失响应式追踪
 * 3. 集中引用：createCombatContext 是 combat 模块内唯一引用外部 Store 的位置
 *
 * @module combat/combatContext
 */
import { useCharacterStore, type Stats, type Attributes } from '@/modules/character';
import { useSkillStore, type Skill, type SkillUseResult } from '@/modules/skill';
import { useEnemyStore, type EnemyInstance } from '@/modules/enemy';
import { useQuestStore } from '@/modules/quest';
import { useLogStore, type LogEntry } from '@/modules/log';
import { useInventoryStore, type Item } from '@/modules/inventory';

/**
 * 战斗只读查询接口（A2 拆分）
 *
 * 聚合 combat 模块对外部 Store 的只读访问：属性读取 + 纯查询方法。
 * 只读 composable（如未来战斗回放）可仅依赖此接口，编译期保证无副作用。
 *
 * ARCH-6 审计结果（2026-07-30）：
 * - useCombatLog 已收窄为 ICombatQuery（仅读取 character 属性构建 EffectContext）
 * - 其他 composable（useCombatState/usePassiveSkills/useInitiative/useEnemyAction/
 *   usePlayerAction/usePlayerSkill/usePlayerItem/useLootHandler）均同时需要读+写，
 *   保持 ICombatContext；store.ts 作为聚合入口亦保持 ICombatContext
 * - 拆分接口供未来新 composable 或战斗回放系统使用，符合硬约束
 */
export interface ICombatQuery {
  /** 角色域（只读）：来自 useCharacterStore 的属性读取 */
  character: {
    readonly name: string;
    readonly classId: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly mana: number;
    readonly maxMana: number;
    readonly attributes: Attributes;
    readonly effectiveStats: Stats;
  };

  /** 技能域（只读）：来自 useSkillStore 的查询方法 */
  skill: {
    getSkill(skillId: string): Skill | null;
  };

  /** 敌人域（只读）：来自 useEnemyStore 的查询方法 */
  enemy: {
    getEnemyById(id: string): EnemyInstance | null;
    getAvailableSkills(id: string): { id: string; name: string; isHeal?: boolean; isBuff?: boolean }[];
    calculateDamage(enemy: EnemyInstance, defense: number): number;
  };

  /** 背包域（只读）：来自 useInventoryStore 的查询方法 */
  inventory: {
    getItemInfo(itemId: string): Item | null;
  };
}

/**
 * 战斗写入命令接口（A2 拆分）
 *
 * 聚合 combat 模块对外部 Store 的状态变更操作。
 * 需要修改外部状态的 composable 依赖此接口。
 *
 * ARCH-6 审计决策（2026-07-31）：
 * - 当前状态：预留接口，源代码中无实际使用方
 * - 审计结论：8 个需写入的 composable 均同时需要读取（如读 character.name 后写 character.takeDamage），
 *   不存在"纯写入"场景，故所有写入 composable 仍使用 ICombatContext
 * - 保留原因：符合项目硬约束"combat context 必须分为只读 ICombatQuery 和只写 ICombatCommand 接口"，
 *   供未来战斗回放系统、批量命令执行器或纯写入场景使用
 * - 使用方：useCombatLog 已收窄为 ICombatQuery（只读）；ICombatCommand 待未来新 composable 启用
 */
export interface ICombatCommand {
  /** 角色域（写入）：来自 useCharacterStore 的状态变更方法 */
  character: {
    takeDamage(amount: number): Promise<void>;
    gainExp(amount: number): Promise<void>;
    gainGold(amount: number): Promise<void>;
    handleDeath(): Promise<void>;
    receiveHeal(amount: number): Promise<void>;
    changeMp(amount: number): Promise<void>;
  };

  /** 技能域（写入）：来自 useSkillStore 的状态变更方法 */
  skill: {
    castSkill(skillId: string, skipAdventureLog?: boolean): Promise<SkillUseResult>;
    tickCooldowns(): void;
    resetCooldowns(): void;
  };

  /** 敌人域（写入）：来自 useEnemyStore 的状态变更方法 */
  enemy: {
    deleteEnemy(id: string): void;
    takeDamage(id: string, damage: number): boolean;
    createEnemy(dataId: string, level: number): Promise<EnemyInstance | null>;
    useSkill(id: string, skillId: string): {
      success: boolean;
      damage: number;
      isHeal: boolean;
      isBuff?: boolean;
      buffs?: Array<{ type: string; value: number; turns: number }>;
    };
    tickCooldowns(enemyId?: string): void;
  };

  /** 任务域（写入）：来自 useQuestStore */
  quest: {
    onEnemyKilled(enemyId: string): Promise<void>;
  };

  /** 日志域（写入）：来自 useLogStore（冒险日志，区别于 useCombatLog 的战斗日志） */
  log: {
    addLogEntry(entry: LogEntry): Promise<void>;
  };

  /** 背包域（写入）：来自 useInventoryStore 的状态变更方法 */
  inventory: {
    useItem(itemId: string): Promise<boolean>;
    addItem(itemId: string, quantity: number): number;
  };
}

/**
 * 战斗上下文接口（完整 = 只读 + 写入）
 *
 * `ICombatQuery & ICombatCommand` 的交集类型，向后兼容所有现有 composable。
 * combat 内部 composable 通过此接口访问外部数据，不直接 import Store。
 *
 * ARCH-6 审计结论（2026-07-31）：
 * - 当前所有需写入的 composable（8 个）与 store.ts 聚合入口均使用 ICombatContext
 * - 仅 useCombatLog 收窄为 ICombatQuery（纯读取场景）
 * - 新代码建议按需使用 `ICombatQuery`（只读）或 `ICombatCommand`（写入）以显式声明意图
 */
export type ICombatContext = ICombatQuery & ICombatCommand;

/**
 * 创建战斗上下文（完整：只读 + 写入）
 *
 * 在 combat Store 初始化时调用，将六个外部 Store 聚合为 ICombatContext。
 * combat 内部所有 composable 通过此上下文访问外部数据，不再直接 import Store。
 *
 * 注意：Store 计算属性（如 name/hp/attributes）通过 getter 代理，
 * 确保 composable 中使用 computed(() => ctx.character.hp) 时响应式追踪不丢失。
 */
export function createCombatContext(): ICombatContext {
  const characterStore = useCharacterStore();
  const skillStore = useSkillStore();
  const enemyStore = useEnemyStore();
  const questStore = useQuestStore();
  const logStore = useLogStore();
  const inventoryStore = useInventoryStore();

  return {
    character: {
      get name() { return characterStore.name; },
      get classId() { return characterStore.classId; },
      get hp() { return characterStore.hp; },
      get maxHp() { return characterStore.maxHp; },
      get mana() { return characterStore.mana; },
      get maxMana() { return characterStore.maxMana; },
      get attributes() { return characterStore.attributes; },
      get effectiveStats() { return characterStore.effectiveStats; },
      takeDamage: (amount) => characterStore.takeDamage(amount),
      gainExp: (amount) => characterStore.gainExp(amount),
      gainGold: (amount) => characterStore.gainGold(amount),
      handleDeath: () => characterStore.handleDeath(),
      receiveHeal: (amount) => characterStore.receiveHeal(amount),
      changeMp: (amount) => characterStore.changeMp(amount),
    },
    skill: {
      castSkill: (skillId, skipAdventureLog) => skillStore.castSkill(skillId, skipAdventureLog),
      getSkill: (skillId) => skillStore.getSkill(skillId),
      tickCooldowns: () => skillStore.tickCooldowns(),
      resetCooldowns: () => skillStore.resetCooldowns(),
    },
    enemy: {
      getEnemyById: (id) => enemyStore.getEnemyById(id),
      deleteEnemy: (id) => enemyStore.deleteEnemy(id),
      takeDamage: (id, damage) => enemyStore.takeDamage(id, damage),
      createEnemy: (dataId, level) => enemyStore.createEnemy(dataId, level),
      getAvailableSkills: (id) => enemyStore.getAvailableSkills(id),
      useSkill: (id, skillId) => enemyStore.useSkill(id, skillId),
      calculateDamage: (enemy, defense) => enemyStore.calculateDamage(enemy, defense),
      tickCooldowns: (enemyId) => enemyStore.tickCooldowns(enemyId),
    },
    quest: {
      onEnemyKilled: (enemyId) => questStore.onEnemyKilled(enemyId),
    },
    log: {
      addLogEntry: (entry) => logStore.addLogEntry(entry),
    },
    inventory: {
      useItem: (itemId) => inventoryStore.useItem(itemId),
      getItemInfo: (itemId) => inventoryStore.getItemInfo(itemId),
      addItem: (itemId, quantity) => inventoryStore.addItem(itemId, quantity),
    },
  };
}
