/**
 * 任务模块状态管理（Store 核心架构）
 * 
 * Store 是任务数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { QuestDefinition, QuestInstance } from './types';
import { questDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { useCharacterStore } from '../character/store';
import { useInventoryStore } from '../inventory/store';
import {
  checkQuestProgress,
  calculateQuestRewards,
  canAcceptQuest,
  generateQuestInstance,
  getDefaultQuests
} from './service';

/**
 * 任务状态存储
 */
export const useQuestStore = defineStore('quest', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

  /** 任务定义缓存（key: questId） */
  const questDefinitions = ref<Map<string, QuestDefinition>>(new Map());

  /** 任务实例缓存（key: questId） */
  const questInstances = ref<Map<string, QuestInstance>>(new Map());

  /** 当前选中的角色ID */
  const currentCharacterId = ref<string | null>(null);

  // ==================== 计算属性 ====================

  /** 所有任务实例列表 */
  const instanceList = computed<QuestInstance[]>(() =>
    Array.from(questInstances.value.values())
  );

  /** 所有任务定义列表 */
  const definitionList = computed<QuestDefinition[]>(() =>
    Array.from(questDefinitions.value.values())
  );

  /** 进行中的任务 */
  const activeQuests = computed<QuestInstance[]>(() =>
    instanceList.value.filter(i => i.status === 'in_progress')
  );

  /** 已完成（待提交）的任务 */
  const completedQuests = computed<QuestInstance[]>(() =>
    instanceList.value.filter(i => i.status === 'completed')
  );

  /** 已提交（奖励已领取）的任务 */
  const turnedInQuests = computed<QuestInstance[]>(() =>
    instanceList.value.filter(i => i.status === 'turned_in')
  );

  /** 可用任务定义（未被接取或可重新接取的） */
  const availableQuests = computed<QuestDefinition[]>(() => {
    const characterLevel = _getCharacterLevel();
    return definitionList.value.filter(def =>
      canAcceptQuest(def, characterLevel, instanceList.value)
    );
  });

  /** 进行中的任务（包含定义和进度的组合视图） */
  const inProgressQuests = computed<(QuestDefinition & { progress: QuestInstance['progress'] })[]>(() => {
    const result: (QuestDefinition & { progress: QuestInstance['progress'] })[] = [];
    for (const instance of activeQuests.value) {
      const definition = questDefinitions.value.get(instance.questId);
      if (definition) {
        result.push({ ...definition, progress: instance.progress });
      }
    }
    return result;
  });

  // ==================== 私有辅助 ====================

  /**
   * 获取当前角色等级（从 characterStore 读取）
   */
  function _getCharacterLevel(): number {
    return useCharacterStore().level || 1;
  }

  /**
   * 获取当前角色ID（从 characterStore 读取）
   */
  function _getCharacterId(): string | null {
    return useCharacterStore().getCharacterId();
  }

  /**
   * 持久化单个任务实例到数据库
   */
  async function _persistInstance(instance: QuestInstance): Promise<void> {
    const cid = currentCharacterId.value || _getCharacterId();
    if (cid) {
      await questDbService.saveQuestInstance(instance, cid);
    }
  }

  /**
   * 更新内存中的任务实例并持久化
   */
  async function _updateAndPersistInstance(questId: string, instance: QuestInstance): Promise<void> {
    const newInstances = new Map(questInstances.value);
    newInstances.set(questId, instance);
    questInstances.value = newInstances;
    await _persistInstance(instance);
  }

  /**
   * 初始化默认任务定义（DB为空时的回退）
   */
  async function _initDefaultQuestDefinitions(): Promise<void> {
    const existingDefs = await questDbService.getAllQuestDefinitions();
    if (existingDefs.length > 0) {
      const defMap = new Map<string, QuestDefinition>();
      existingDefs.forEach(def => defMap.set(def.id, def));
      questDefinitions.value = defMap;
      return;
    }

    // DB 中没有任务定义，写入默认模板
    const defaults = getDefaultQuests();
    const defMap = new Map<string, QuestDefinition>();
    for (const quest of defaults) {
      await questDbService.saveQuestDefinition(quest);
      defMap.set(quest.id, quest);
    }
    questDefinitions.value = defMap;
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化任务模块
   * 从数据库加载任务定义和当前角色的任务实例
   * 
   * @param characterId - 角色ID
   */
  async function initialize(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;

    // 加载任务定义（全局数据）
    await _initDefaultQuestDefinitions();

    // 加载当前角色的任务实例
    if (characterId) {
      const instances = await questDbService.getAllQuestInstances(characterId);
      const instMap = new Map<string, QuestInstance>();
      instances.forEach(inst => instMap.set(inst.questId, inst));
      questInstances.value = instMap;
    } else {
      questInstances.value = new Map();
    }
  }

  /**
   * 兼容旧接口的无参初始化
   * 自动从 characterStore 获取角色ID
   */
  async function init(): Promise<void> {
    const cid = _getCharacterId();
    if (cid) {
      await initialize(cid);
    }
  }

  // ==================== Action：接受任务 ====================

  /**
   * 接受任务
   * 
   * @param questId - 任务ID
   * @returns 是否成功接受
   */
  async function acceptQuest(questId: string): Promise<boolean> {
    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    const cid = currentCharacterId.value || _getCharacterId();
    if (!cid) return false;

    // 检查是否可以接受
    const characterLevel = _getCharacterLevel();
    if (!canAcceptQuest(definition, characterLevel, instanceList.value)) return false;

    // 生成任务实例
    const instance = generateQuestInstance(definition, cid);

    // 更新 Store 状态
    const newInstances = new Map(questInstances.value);
    newInstances.set(questId, instance);
    questInstances.value = newInstances;

    // 持久化到数据库
    await _persistInstance(instance);

    // 通知 UI
    eventBus.emit(GameEvents.QUEST_ACCEPTED, { questId, definition });

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'quest',
      message: `接受了任务：${definition.title}`,
      icon: 'game-icons:notebook'
    });

    return true;
  }

  // ==================== Action：敌人击杀处理 ====================

  /**
   * 处理敌人击杀事件
   * 遍历所有进行中的击杀任务，更新进度；若全部目标完成则自动发放奖励
   * 
   * @param enemyId - 被击杀的敌人ID
   */
  async function onEnemyKilled(enemyId: string): Promise<void> {
    for (const [questId, instance] of questInstances.value) {
      if (instance.status !== 'in_progress') continue;

      const definition = questDefinitions.value.get(questId);
      if (!definition) continue;

      const result = checkQuestProgress(instance, definition, { enemyId });
      if (!result) continue;

      // 更新进度
      const updatedInstance: QuestInstance = {
        ...instance,
        progress: result.progress
      };

      if (result.isComplete) {
        // 任务完成 → 自动发放奖励
        updatedInstance.status = 'completed';
        updatedInstance.completedAt = Date.now();

        // 发放奖励
        await _grantQuestRewards(definition);

        // 更新 Store 并持久化
        await _updateAndPersistInstance(questId, updatedInstance);

        // 通知 UI
        eventBus.emit(GameEvents.QUEST_COMPLETED, { questId, definition });

        // 记录冒险日志
        useLogStore().addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'quest',
          message: `完成了任务：${definition.title}！`,
          icon: 'game-icons:check-mark'
        });
      } else {
        // 仅更新进度
        await _updateAndPersistInstance(questId, updatedInstance);
      }
    }
  }

  /**
   * 处理物品收集事件
   * 遍历所有进行中的收集任务，更新进度
   * 
   * @param itemId - 收集的物品ID
   * @param amount - 收集数量，默认为1
   */
  async function onItemCollected(itemId: string, amount: number = 1): Promise<void> {
    for (const [questId, instance] of questInstances.value) {
      if (instance.status !== 'in_progress') continue;

      const definition = questDefinitions.value.get(questId);
      if (!definition) continue;

      const result = checkQuestProgress(instance, definition, { itemId, amount });
      if (!result) continue;

      const updatedInstance: QuestInstance = {
        ...instance,
        progress: result.progress
      };

      if (result.isComplete) {
        updatedInstance.status = 'completed';
        updatedInstance.completedAt = Date.now();

        await _grantQuestRewards(definition);
        await _updateAndPersistInstance(questId, updatedInstance);

        eventBus.emit(GameEvents.QUEST_COMPLETED, { questId, definition });

        useLogStore().addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'quest',
          message: `完成了任务：${definition.title}！`,
          icon: 'game-icons:check-mark'
        });
      } else {
        await _updateAndPersistInstance(questId, updatedInstance);
      }
    }
  }

  // ==================== Action：完成任务（手动触发） ====================

  /**
   * 手动完成任务（在不是自动检测进度的情况下使用）
   * 计算奖励 → 发放至角色/背包 → 更新状态 → 持久化
   * 
   * @param questId - 任务ID
   * @returns 是否成功完成
   */
  async function completeQuest(questId: string): Promise<boolean> {
    const instance = questInstances.value.get(questId);
    if (!instance || instance.status !== 'in_progress') return false;

    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    // 检查所有目标是否达成
    const allComplete = instance.progress.every(p => p.current >= p.target);
    if (!allComplete) return false;

    // 发放奖励
    await _grantQuestRewards(definition);

    // 更新状态
    const updatedInstance: QuestInstance = {
      ...instance,
      status: 'completed',
      completedAt: Date.now()
    };
    await _updateAndPersistInstance(questId, updatedInstance);

    // 通知 UI
    eventBus.emit(GameEvents.QUEST_COMPLETED, { questId, definition });

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'quest',
      message: `完成了任务：${definition.title}！`,
      icon: 'game-icons:check-mark'
    });

    return true;
  }

  // ==================== Action：领取奖励 ====================

  /**
   * 领取任务奖励（将任务标记为"已提交"）
   * 注意：奖励已在完成时自动发放，此方法仅做状态转换
   * 
   * @param questId - 任务ID
   * @returns 是否成功领取
   */
  async function claimReward(questId: string): Promise<boolean> {
    const instance = questInstances.value.get(questId);
    if (!instance || instance.status !== 'completed') return false;

    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    // 更新状态为"已提交"
    const updatedInstance: QuestInstance = {
      ...instance,
      status: 'turned_in'
    };
    await _updateAndPersistInstance(questId, updatedInstance);

    // 通知 UI
    eventBus.emit(GameEvents.QUEST_REWARDED, { questId, definition });

    // 记录冒险日志
    const rewardParts: string[] = [];
    if (definition.xpReward > 0) rewardParts.push(`${definition.xpReward} 经验`);
    if (definition.goldReward > 0) rewardParts.push(`${definition.goldReward} 金币`);
    const rewardText = rewardParts.length > 0 ? `，获得奖励：${rewardParts.join('、')}` : '';
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'quest',
      message: `提交了任务：${definition.title}${rewardText}`,
      icon: 'game-icons:laurel-crown'
    });

    return true;
  }

  // ==================== Action：放弃任务 ====================

  /**
   * 放弃任务
   * 
   * @param questId - 任务ID
   * @returns 是否成功放弃
   */
  async function abandonQuest(questId: string): Promise<boolean> {
    const instance = questInstances.value.get(questId);
    if (!instance || instance.status !== 'in_progress') return false;

    // 更新状态
    const updatedInstance: QuestInstance = {
      ...instance,
      status: 'abandoned'
    };
    await _updateAndPersistInstance(questId, updatedInstance);

    // 记录冒险日志
    const definition = questDefinitions.value.get(questId);
    if (definition) {
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'quest',
        message: `放弃了任务：${definition.title}`,
        icon: 'game-icons:cancel'
      });
    }

    return true;
  }

  // ==================== 私有：发放任务奖励 ====================

  /**
   * 向角色发放任务奖励（经验、金币、物品）
   * 直接调用 characterStore 和 inventoryStore 的 Action
   */
  async function _grantQuestRewards(definition: QuestDefinition): Promise<void> {
    const rewards = calculateQuestRewards(definition);

    // 发放经验奖励
    if (rewards.exp > 0) {
      await useCharacterStore().gainExp(rewards.exp);
    }

    // 发放金币奖励
    if (rewards.gold > 0) {
      await useCharacterStore().gainGold(rewards.gold);
    }

    // 发放物品奖励
    for (const item of rewards.items) {
      useInventoryStore().addItem(item.itemId, item.count);
    }
  }

  // ==================== Action：查询 ====================

  /**
   * 获取任务定义
   */
  function getQuestDefinition(questId: string): QuestDefinition | null {
    return questDefinitions.value.get(questId) || null;
  }

  /**
   * 获取任务实例
   */
  function getQuestInstance(questId: string): QuestInstance | null {
    return questInstances.value.get(questId) || null;
  }

  /**
   * 检查任务是否可用（可接取）
   */
  function isQuestAvailable(questId: string): boolean {
    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    const characterLevel = _getCharacterLevel();
    return canAcceptQuest(definition, characterLevel, instanceList.value);
  }

  /**
   * 获取指定任务板上的任务定义
   */
  function getQuestsFromBoard(boardId: string): QuestDefinition[] {
    return definitionList.value.filter(def => def.boardId === boardId);
  }

  /**
   * 获取指定任务板上可提交的任务定义
   */
  function getQuestsToTurnIn(boardId: string): QuestDefinition[] {
    const result: QuestDefinition[] = [];
    for (const [questId, instance] of questInstances.value) {
      if (instance.status === 'completed') {
        const definition = questDefinitions.value.get(questId);
        if (definition && definition.boardId === boardId) {
          result.push(definition);
        }
      }
    }
    return result;
  }

  /**
   * 从任务板接受任务
   */
  async function acceptQuestFromBoard(boardId: string, questId: string): Promise<boolean> {
    const definition = questDefinitions.value.get(questId);
    if (!definition || definition.boardId !== boardId) return false;
    return acceptQuest(questId);
  }

  /**
   * 在任务板提交任务（领取奖励）
   */
  async function turnInQuestToBoard(boardId: string, questId: string): Promise<boolean> {
    const definition = questDefinitions.value.get(questId);
    if (!definition || definition.boardId !== boardId) return false;
    return claimReward(questId);
  }

  /**
   * 提交任务（兼容旧接口，等同于 claimReward）
   */
  async function turnInQuest(questId: string): Promise<boolean> {
    return claimReward(questId);
  }

  // ==================== Action：重置 ====================

  /**
   * 重置当前角色的任务数据（清空内存状态，不删除数据库）
   */
  function reset(): void {
    questInstances.value = new Map();
  }

  /**
   * 清理资源
   */
  function dispose(): void {
    eventBus.clearGroup('questStore');
  }

  // ==================== 导出 ====================

  return {
    // 状态
    questDefinitions,
    questInstances,
    currentCharacterId,

    // 计算属性
    definitionList,
    instanceList,
    activeQuests,
    completedQuests,
    turnedInQuests,
    availableQuests,
    inProgressQuests,

    // Action：初始化
    initialize,
    init,

    // Action：核心操作
    acceptQuest,
    onEnemyKilled,
    onItemCollected,
    completeQuest,
    claimReward,
    abandonQuest,

    // Action：查询
    getQuestDefinition,
    getQuestInstance,
    isQuestAvailable,
    getQuestsFromBoard,
    getQuestsToTurnIn,

    // Action：任务板操作
    acceptQuestFromBoard,
    turnInQuestToBoard,

    // Action：兼容旧接口
    turnInQuest,
    reset,

    // 生命周期
    dispose
  };
});
