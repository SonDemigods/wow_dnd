/**
 * @fileoverview 任务模块 —— 数据持久化层
 *
 * 封装所有任务数据的 IndexedDB 操作，提供带重试机制的 CRUD 能力。
 *
 * ## 职责边界
 *
 * - **输入**  : 领域模型（QuestDefinition / QuestInstance）
 * - **输出**  : 领域模型（同上）
 * - **内部**  : 通过 _mapToDefinition() / _mapStorageObjectives() 在存储格式与领域模型间转换
 * - **不负责**: 业务逻辑校验、状态转换、事件通知（由 Store 层负责）
 *
 * ## 数据库表映射
 *
 *   config_quests  ←→  QuestDefinitionStorage  ←→  QuestDefinition
 *   char_quests    ←→  QuestInstanceStorage    ←→  QuestInstance
 *
 * ## 注意
 *
 * - 所有 Dexie 操作通过 dbService.withRetry() 包装，自动处理 IndexedDB 连接异常
 * - Dexie 表声明为 Table<any, string>，因此查询结果需要 `as unknown as XxxStorage` 桥接
 * - saveQuestInstance 使用 toRawData() 剥离 Vue/Proxy 包装，避免 DataCloneError
 *
 * @module quest/db
 */

import { db as gameDb, dbService } from '../data/core';
import type { QuestInstance, QuestDefinition, QuestInstanceStorage, QuestDefinitionStorage } from './types';
import { toRawData } from '../../utils';

// ==================== 私有：存储格式 → 领域模型映射 ====================

/**
 * 将存储格式的 objectives 转换为 QuestObjective[]
 *
 * 之所以需要手动映射而非直接 as，是因为 QuestDefinitionStorage.objectives
 * 使用内联类型定义（与 QuestObjective 独立），TypeScript 无法自动推演兼容性。
 *
 * @param objectives - 数据库返回的 objectives 行数据
 * @returns 领域模型的 objectives 数组
 */
function _mapStorageObjectives(
  objectives: QuestDefinitionStorage['objectives']
): QuestDefinition['objectives'] {
  return objectives.map(obj => ({
    key: obj.key,
    type: obj.type,
    target: obj.target,
    itemId: obj.itemId,
    enemyId: obj.enemyId,
    locationId: obj.locationId
  }));
}

/**
 * 将存储格式的 QuestDefinitionStorage 转换为领域模型 QuestDefinition
 *
 * 集中处理 config_quests 表 → 领域模型的字段映射，被所有查询方法复用。
 * 包括 objectives 的内联转换和 itemRewards 的格式统一。
 *
 * @param storage - 数据库返回的原始行
 * @returns 领域模型的 QuestDefinition
 */
function _mapToDefinition(storage: QuestDefinitionStorage): QuestDefinition {
  return {
    id: storage.id,
    title: storage.title,
    description: storage.description,
    type: storage.type,
    objectives: _mapStorageObjectives(storage.objectives),
    levelRequirement: storage.levelRequirement,
    xpReward: storage.xpReward,
    goldReward: storage.goldReward,
    // itemRewards 在存储层为 { itemId, count }，与领域模型 InventoryItem 兼容
    itemRewards: storage.itemRewards?.map(r => ({ itemId: r.itemId, count: r.count })),
    boardId: storage.boardId
  };
}

// ==================== 任务数据层服务 ====================

/**
 * 任务数据层服务
 *
 * 封装所有任务相关 IndexedDB 操作。
 * 设计为单例模式（模块级 questDbService 常量），
 * 所有方法通过 dbService.withRetry() 包装以提供自动重试能力。
 *
 * 方法分为两组：
 * - **config_quests 操作** : saveQuestDefinition / getQuestDefinition / getAllQuestDefinitions / getQuestDefinitionsByBoard
 * - **char_quests 操作**   : saveQuestInstance / getQuestInstance / getAllQuestInstances / clearAllQuestInstances
 */
export class QuestDbService {

  // ==================== 任务实例（char_quests 表） ====================

  /**
   * 保存任务实例（写入 char_quests 表）
   *
   * 使用 toRawData() 剥离 Vue 响应式 Proxy 包装，避免 IndexedDB 抛出 DataCloneError。
   * 采用 put() 语义（存在则覆盖，不存在则新增）。
   *
   * @param instance    - 任务实例（领域模型）
   * @param characterId - 角色ID，作为复合主键的一部分
   */
  async saveQuestInstance(instance: QuestInstance, characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      const cleanData = toRawData({
        questId: instance.questId,
        characterId,
        status: instance.status,
        progress: instance.progress,
        acceptedAt: instance.acceptedAt,
        completedAt: instance.completedAt
      });
      await gameDb.char_quests.put(cleanData);
    });
  }

  /**
   * 获取单个任务实例
   *
   * 使用复合主键 [characterId, questId] 精确查询。
   *
   * @param characterId - 角色ID
   * @param questId     - 任务ID
   * @returns 任务实例，不存在时返回 null
   */
  async getQuestInstance(characterId: string, questId: string): Promise<QuestInstance | null> {
    return dbService.withRetry(async () => {
      // Dexie 表声明为 Table<any, string>，查询结果需显式断言
      const result = await gameDb.char_quests.get([characterId, questId]) as unknown as QuestInstanceStorage | undefined;
      if (!result) return null;
      return {
        questId: result.questId,
        status: result.status,
        progress: result.progress,
        acceptedAt: result.acceptedAt,
        completedAt: result.completedAt
      };
    });
  }

  /**
   * 获取角色的全部任务实例
   *
   * 遍历 char_quests 表中所有 characterId 匹配的行。
   *
   * @param characterId - 角色ID
   * @returns 任务实例列表（可能为空数组）
   */
  async getAllQuestInstances(characterId: string): Promise<QuestInstance[]> {
    return dbService.withRetry(async () => {
      // where().equals().toArray() 返回 any[]，需桥接为 QuestInstanceStorage[]
      const results = await gameDb.char_quests.where('characterId').equals(characterId).toArray() as unknown as QuestInstanceStorage[];
      return results.map(result => ({
        questId: result.questId,
        status: result.status,
        progress: result.progress,
        acceptedAt: result.acceptedAt,
        completedAt: result.completedAt
      }));
    });
  }

  /**
   * 删除单个任务实例
   *
   * @param characterId - 角色ID
   * @param questId     - 任务ID
   */
  async deleteQuestInstance(characterId: string, questId: string): Promise<void> {
    await dbService.withRetry(async () => {
      // Dexie 复合主键 delete 需元组，TS 类型要求 string 但实际接受元组
      await gameDb.char_quests.delete([characterId, questId] as unknown as string);
    });
  }

  /**
   * 清空所有任务实例（char_quests 表全部行）
   *
   * 用于角色重置场景。
   */
  async clearAllQuestInstances(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_quests.clear();
    });
  }

  /**
   * 删除指定角色的全部任务实例
   *
   * 先按 characterId 筛选，再逐行删除（Dexie 不支持批量条件删除）。
   *
   * @param characterId - 要清理的角色ID
   */
  async deleteCharacterQuests(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      const instances = await gameDb.char_quests.where('characterId').equals(characterId).toArray() as unknown as QuestInstanceStorage[];
      for (const instance of instances) {
        await gameDb.char_quests.delete([characterId, instance.questId] as unknown as string);
      }
    });
  }

  // ==================== 任务定义（config_quests 表） ====================

  /**
   * 保存任务定义（写入 config_quests 表）
   *
   * 使用显式字段映射将 QuestDefinition 转换为内联存储格式写入。
   * 采用 put() 语义（存在则覆盖）。
   *
   * @param definition - 任务定义（领域模型）
   */
  async saveQuestDefinition(definition: QuestDefinition): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_quests.put({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        type: definition.type,
        // 将 QuestObjective[] 显式映射为存储层的 objectives 内联格式
        objectives: definition.objectives.map(obj => ({
          key: obj.key,
          type: obj.type,
          target: obj.target,
          itemId: obj.itemId,
          enemyId: obj.enemyId,
          locationId: obj.locationId
        })),
        levelRequirement: definition.levelRequirement,
        xpReward: definition.xpReward,
        goldReward: definition.goldReward,
        itemRewards: definition.itemRewards,
        boardId: definition.boardId
      });
    });
  }

  /**
   * 获取单个任务定义
   *
   * @param questId - 任务ID
   * @returns 任务定义，不存在时返回 null
   */
  async getQuestDefinition(questId: string): Promise<QuestDefinition | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_quests.get(questId) as unknown as QuestDefinitionStorage | undefined;
      if (!result) return null;
      // 通过 _mapToDefinition 集中转换，确保 objectives 等字段完整
      return _mapToDefinition(result);
    });
  }

  /**
   * 获取所有任务定义
   *
   * 用于初始化时批量加载所有任务定义到内存。
   *
   * @returns 任务定义列表
   */
  async getAllQuestDefinitions(): Promise<QuestDefinition[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_quests.toArray() as unknown as QuestDefinitionStorage[];
      return results.map(_mapToDefinition);
    });
  }

  /**
   * 获取指定任务板上的所有任务定义
   *
   * 按 boardId 索引筛选，用于探索时加载特定区域的任务列表。
   *
   * @param boardId - 任务板ID
   * @returns 该任务板上的任务定义列表
   */
  async getQuestDefinitionsByBoard(boardId: string): Promise<QuestDefinition[]> {
    return dbService.withRetry(async () => {
      // config_quests 表在 boardId 上建立了索引
      const results = await gameDb.config_quests.where('boardId').equals(boardId).toArray() as unknown as QuestDefinitionStorage[];
      return results.map(_mapToDefinition);
    });
  }

  /**
   * 删除单个任务定义
   *
   * @param questId - 任务ID
   */
  async deleteQuestDefinition(questId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_quests.delete(questId);
    });
  }

  /**
   * 清空所有任务定义（config_quests 表全部行）
   *
   * 用于数据重置或导入前清理。
   */
  async clearAllQuestDefinitions(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_quests.clear();
    });
  }
}

/**
 * 任务数据层单例
 *
 * 模块级常量，确保整个应用共享同一份数据库连接和缓存。
 */
export const questDbService = new QuestDbService();
