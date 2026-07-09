/**
 * @fileoverview 战斗上下文接口与工厂（S2 解耦核心）
 *
 * 将 combat 模块对 character / skill / quest / log / enemy / inventory 六个外部
 * Store 的依赖收口为单一 ICombatContext 接口。combat 内部所有 composable 仅
 * 依赖此接口，不再直接 import 具体 Store，实现模块间静态解耦与可独立测试。
 *
 * 设计原则：
 * 1. 接口最小化：仅暴露 combat 模块实际使用的方法（已逐文件核对调用点）
 * 2. 保持响应式：Store 计算属性通过 getter 代理，避免值拷贝丢失响应式追踪
 * 3. 集中引用：createCombatContext 是 combat 模块内唯一引用外部 Store 的位置
 *
 * @module combat/combatContext
 */
import type { Stats, Attributes } from '../character/types';
import type { Skill, SkillUseResult } from '../skill/types';
import type { EnemyInstance } from '../enemy/types';
import type { Item } from '../inventory/types';
import type { LogEntry } from '../log/types';

import { useCharacterStore } from '../character/store';
import { useSkillStore } from '../skill/store';
import { useEnemyStore } from '../enemy/store';
import { useQuestStore } from '../quest/store';
import { useLogStore } from '../log/store';
import { useInventoryStore } from '../inventory/store';

/**
 * 战斗上下文接口
 *
 * 聚合 combat 模块对六个外部 Store 的依赖，按来源 Store 分域组织。
 * combat 内部 composable 通过此接口访问外部数据，不直接 import Store。
 */
export interface ICombatContext {
  /** 角色域：来自 useCharacterStore */
  character: {
    // 属性读取（通过 getter 代理保持响应式）
    readonly name: string;
    readonly classId: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly attributes: Attributes;
    readonly effectiveStats: Stats;
    // 状态变更
    takeDamage(amount: number): Promise<void>;
    gainExp(amount: number): Promise<void>;
    gainGold(amount: number): Promise<void>;
    handleDeath(): Promise<void>;
    receiveHeal(amount: number): Promise<void>;
    changeMp(amount: number): Promise<void>;
  };

  /** 技能域：来自 useSkillStore */
  skill: {
    castSkill(skillId: string, skipAdventureLog?: boolean): Promise<SkillUseResult>;
    getSkill(skillId: string): Skill | null;
    tickCooldowns(): void;
    resetCooldowns(): void;
  };

  /** 敌人域：来自 useEnemyStore */
  enemy: {
    getEnemyById(id: string): EnemyInstance | null;
    deleteEnemy(id: string): void;
    takeDamage(id: string, damage: number): boolean;
    createEnemy(dataId: string, level: number): Promise<EnemyInstance | null>;
    getAvailableSkills(id: string): { id: string; name: string; isHeal?: boolean; isBuff?: boolean }[];
    useSkill(id: string, skillId: string): {
      success: boolean;
      damage: number;
      isHeal: boolean;
      isBuff?: boolean;
      buffs?: Array<{ type: string; value: number; turns: number }>;
    };
    calculateDamage(enemy: EnemyInstance, defense: number): number;
    tickCooldowns(enemyId?: string): void;
  };

  /** 任务域：来自 useQuestStore */
  quest: {
    onEnemyKilled(enemyId: string): Promise<void>;
  };

  /** 日志域：来自 useLogStore（冒险日志，区别于 useCombatLog 的战斗日志） */
  log: {
    addLogEntry(entry: LogEntry): Promise<void>;
  };

  /** 背包域：来自 useInventoryStore */
  inventory: {
    useItem(itemId: string): Promise<boolean>;
    getItemInfo(itemId: string): Item | null;
    addItem(itemId: string, quantity: number): number;
  };
}

/**
 * 创建战斗上下文
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
