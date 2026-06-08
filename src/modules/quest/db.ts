/**
 * 任务模块数据层
 * 
 * 封装任务数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { QuestInstance, QuestDefinition } from './types';

/**
 * 任务实例存储接口
 */
export interface QuestInstanceStorage {
  questId: string;
  status: string;
  progress: { objectiveKey: string; current: number; target: number }[];
  acceptedAt: number;
  completedAt?: number;
}

/**
 * 任务定义存储接口
 */
export interface QuestDefinitionStorage {
  id: string;
  title: string;
  description: string;
  type: string;
  objectives: {
    key: string;
    type: string;
    description: string;
    target: number;
    itemId?: string;
    enemyId?: string;
    locationId?: string;
  }[];
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: { itemId: string; amount: number }[];
  boardId: string;
}

/**
 * 任务数据层服务
 */
export class QuestDbService {
  /**
   * 保存任务实例
   * @param instance - 任务实例
   * @param characterId - 角色ID
   */
  async saveQuestInstance(instance: QuestInstance, characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_quests.put({
        questId: instance.questId,
        characterId,
        status: instance.status,
        progress: instance.progress,
        acceptedAt: instance.acceptedAt,
        completedAt: instance.completedAt
      });
    });
  }

  /**
   * 获取任务实例
   * @param characterId - 角色ID
   * @param questId - 任务ID
   * @returns 任务实例
   */
  async getQuestInstance(characterId: string, questId: string): Promise<QuestInstance | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.char_quests.get([characterId, questId]) as unknown as QuestInstanceStorage | undefined;
      if (!result) return null;
      return {
        questId: result.questId,
        status: result.status as QuestInstance['status'],
        progress: result.progress,
        acceptedAt: result.acceptedAt,
        completedAt: result.completedAt
      };
    });
  }

  /**
   * 获取所有任务实例
   * @param characterId - 角色ID
   * @returns 任务实例列表
   */
  async getAllQuestInstances(characterId: string): Promise<QuestInstance[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.char_quests.where('characterId').equals(characterId).toArray() as unknown as QuestInstanceStorage[];
      return results.map(result => ({
        questId: result.questId,
        status: result.status as QuestInstance['status'],
        progress: result.progress,
        acceptedAt: result.acceptedAt,
        completedAt: result.completedAt
      }));
    });
  }

  /**
   * 删除任务实例
   * @param characterId - 角色ID
   * @param questId - 任务ID
   */
  async deleteQuestInstance(characterId: string, questId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_quests.delete([characterId, questId] as unknown as string);
    });
  }

  /**
   * 清空所有任务实例
   */
  async clearAllQuestInstances(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_quests.clear();
    });
  }

  /**
   * 删除指定角色的任务实例
   * @param characterId - 角色ID
   */
  async deleteCharacterQuests(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      const instances = await gameDb.char_quests.where('characterId').equals(characterId).toArray() as unknown as QuestInstanceStorage[];
      for (const instance of instances) {
        await gameDb.char_quests.delete([characterId, instance.questId] as unknown as string);
      }
    });
  }

  /**
   * 保存任务定义
   * @param definition - 任务定义
   */
  async saveQuestDefinition(definition: QuestDefinition): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_quests.put({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        type: definition.type,
        objectives: definition.objectives,
        levelRequirement: definition.levelRequirement,
        xpReward: definition.xpReward,
        goldReward: definition.goldReward,
        itemRewards: definition.itemRewards,
        boardId: definition.boardId
      });
    });
  }

  /**
   * 获取任务定义
   * @param questId - 任务ID
   * @returns 任务定义
   */
  async getQuestDefinition(questId: string): Promise<QuestDefinition | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_quests.get(questId) as unknown as QuestDefinitionStorage | undefined;
      if (!result) return null;
      return {
        id: result.id,
        title: result.title,
        description: result.description,
        type: result.type as QuestDefinition['type'],
        objectives: result.objectives.map(obj => ({
          key: obj.key,
          type: obj.type as 'kill' | 'collect',
          description: obj.description,
          target: obj.target,
          itemId: obj.itemId,
          enemyId: obj.enemyId,
          locationId: obj.locationId
        })),
        levelRequirement: result.levelRequirement,
        xpReward: result.xpReward,
        goldReward: result.goldReward,
        itemRewards: result.itemRewards?.map(r => ({ itemId: r.itemId, count: r.amount })),
        boardId: result.boardId
      };
    });
  }

  /**
   * 获取所有任务定义
   * @returns 任务定义列表
   */
  async getAllQuestDefinitions(): Promise<QuestDefinition[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_quests.toArray() as unknown as QuestDefinitionStorage[];
      return results.map(result => ({
        id: result.id,
        title: result.title,
        description: result.description,
        type: result.type as QuestDefinition['type'],
        objectives: result.objectives.map(obj => ({
          key: obj.key,
          type: obj.type as 'kill' | 'collect',
          description: obj.description,
          target: obj.target,
          itemId: obj.itemId,
          enemyId: obj.enemyId,
          locationId: obj.locationId
        })),
        levelRequirement: result.levelRequirement,
        xpReward: result.xpReward,
        goldReward: result.goldReward,
        itemRewards: result.itemRewards?.map(r => ({ itemId: r.itemId, count: r.amount })),
        boardId: result.boardId
      }));
    });
  }

  /**
   * 获取指定任务板的任务定义
   * @param boardId - 任务板ID
   * @returns 任务定义列表
   */
  async getQuestDefinitionsByBoard(boardId: string): Promise<QuestDefinition[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_quests.where('boardId').equals(boardId).toArray() as unknown as QuestDefinitionStorage[];
      return results.map(result => ({
        id: result.id,
        title: result.title,
        description: result.description,
        type: result.type as QuestDefinition['type'],
        objectives: result.objectives.map(obj => ({
          key: obj.key,
          type: obj.type as 'kill' | 'collect',
          description: obj.description,
          target: obj.target,
          itemId: obj.itemId,
          enemyId: obj.enemyId,
          locationId: obj.locationId
        })),
        levelRequirement: result.levelRequirement,
        xpReward: result.xpReward,
        goldReward: result.goldReward,
        itemRewards: result.itemRewards?.map(r => ({ itemId: r.itemId, count: r.amount })),
        boardId: result.boardId
      }));
    });
  }

  /**
   * 删除任务定义
   * @param questId - 任务ID
   */
  async deleteQuestDefinition(questId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_quests.delete(questId);
    });
  }

  /**
   * 清空所有任务定义
   */
  async clearAllQuestDefinitions(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_quests.clear();
    });
  }
}

/**
 * 任务数据层实例
 */
export const questDbService = new QuestDbService();
