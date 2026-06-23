/**
 * @fileoverview 任务模块 —— 状态管理（Pinia Store）
 *
 * Store 是任务数据的**唯一持有者**，所有响应式状态集中管理。
 *
 * ## 架构分层与数据流
 *
 *   外部事件（战斗/收集）
 *        │
 *        ▼
 *   ┌─────────────┐
 *   │  Store Action │  编排层：接收外部事件，调用 service 纯函数，更新状态，触发持久化
 *   └──────┬──────┘
 *          │
 *     ┌────┴────┐
 *     ▼         ▼
 *   service    db.ts
 *   (纯计算)   (持久化)
 *     │         │
 *     └────┬────┘
 *          ▼
 *   ┌─────────────┐
 *   │   状态更新    │  更新 questInstances / questDefinitions（响应式）
 *   └──────┬──────┘
 *          ▼
 *   ┌─────────────┐
 *   │  通知/日志   │  eventBus.emit() → UI 刷新；useLogStore() → 冒险日志
 *   └─────────────┘
 *
 * ## 关键设计决策
 *
 * 1. **奖励在完成时自动发放**：
 *    _handleQuestCompletion() 在标记 completed 的同时调用 _grantQuestRewards()，
 *    claimReward() 仅做状态转换（completed → turned_in），不重复发奖。
 *
 * 2. **Progress 检查与完成逻辑分离**：
 *    _processQuestProgress() 负责"进度计算 + 是否完成判定"，
 *    _handleQuestCompletion() 负责"完成后的收尾"（发奖/通知/日志），
 *    两者独立，便于 completeQuest（手动完成）复用 _handleQuestCompletion。
 *
 * 3. **Map 作为核心数据结构**：
 *    questDefinitions / questInstances 使用 Map<string, T> 存储，查询 O(1)。
 *    每次更新都创建新的 Map 实例以触发 Vue 响应式更新。
 *
 * @module quest/store
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
 *
 * 使用 Pinia Composition API（defineStore + setup 函数）实现。
 * 导出为组合函数 useQuestStore，在组件中通过 useQuestStore() 获取实例。
 */
export const useQuestStore = defineStore('quest', () => {

  // ==================== 响应式状态 ====================

  /**
   * 任务定义缓存
   *
   * key: questId（如 "teldrassil_defense"）
   * 在 initialize() 时从 config_quests 表一次性加载，
   * 全局共享（所有角色看到同一份任务定义）。
   */
  const questDefinitions = ref<Map<string, QuestDefinition>>(new Map());

  /**
   * 任务实例缓存
   *
   * key: questId
   * 在 initialize() 时从 char_quests 表按当前角色加载，
   * 每个角色独立（切换角色时重新加载）。
   */
  const questInstances = ref<Map<string, QuestInstance>>(new Map());

  /**
   * 当前选中的角色ID
   *
   * 由 initialize(characterId) 设置，用于数据隔离。
   */
  const currentCharacterId = ref<string | null>(null);

  // ==================== 计算属性 ====================

  /** 所有任务实例的数组视图（便于 filter/map 操作） */
  const instanceList = computed<QuestInstance[]>(() =>
    Array.from(questInstances.value.values())
  );

  /** 所有任务定义的数组视图 */
  const definitionList = computed<QuestDefinition[]>(() =>
    Array.from(questDefinitions.value.values())
  );

  /** 进行中的任务（status === in_progress） */
  const activeQuests = computed<QuestInstance[]>(() =>
    instanceList.value.filter(i => i.status === 'in_progress')
  );

  /** 已完成待提交的任务（status === completed） */
  const completedQuests = computed<QuestInstance[]>(() =>
    instanceList.value.filter(i => i.status === 'completed')
  );

  /** 已提交终态的任务（status === turned_in） */
  const turnedInQuests = computed<QuestInstance[]>(() =>
    instanceList.value.filter(i => i.status === 'turned_in')
  );

  /**
   * 当前可接取的任务定义
   *
   * 筛选条件：等级满足 + 不存在活跃实例（或上次已放弃）。
   * 由 canAcceptQuest() 纯函数计算。
   */
  const availableQuests = computed<QuestDefinition[]>(() => {
    const characterLevel = _getCharacterLevel();
    return definitionList.value.filter(def =>
      canAcceptQuest(def, characterLevel, instanceList.value)
    );
  });

  /**
   * 进行中任务的组合视图（定义 + 进度）
   *
   * 将 QuestDefinition 和 QuestInstance.progress 合并，
   * 便于 UI 层一次性获取任务标题、目标列表和当前进度。
   */
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
   * 从 characterStore 获取当前角色等级
   *
   * characterStore 是 Pinia 全局单例，无需注入。
   * 没有角色时回退为 1（防止 canAcceptQuest 因 level=0 全部拒绝）。
   */
  function _getCharacterLevel(): number {
    return useCharacterStore().level || 1;
  }

  /**
   * 从 characterStore 获取当前角色ID
   *
   * @returns 角色ID，无角色时返回 null
   */
  function _getCharacterId(): string | null {
    return useCharacterStore().getCharacterId();
  }

  /**
   * 持久化单个任务实例到数据库
   *
   * 从 currentCharacterId 或 characterStore 获取角色ID，
   * 调用 questDbService.saveQuestInstance() 写入 char_quests 表。
   *
   * @param instance - 需要持久化的任务实例
   */
  async function _persistInstance(instance: QuestInstance): Promise<void> {
    const cid = currentCharacterId.value || _getCharacterId();
    if (cid) {
      await questDbService.saveQuestInstance(instance, cid);
    }
  }

  /**
   * 更新内存中的任务实例并持久化
   *
   * 创建新 Map → set → 赋值给 ref 以触发 Vue 响应式更新，
   * 然后调用 _persistInstance 写入数据库。
   *
   * @param questId  - 任务ID
   * @param instance - 更新后的任务实例
   */
  async function _updateAndPersistInstance(questId: string, instance: QuestInstance): Promise<void> {
    // 创建新 Map 实例触发 ref 的响应式替换
    const newInstances = new Map(questInstances.value);
    newInstances.set(questId, instance);
    questInstances.value = newInstances;
    await _persistInstance(instance);
  }

  /**
   * 初始化任务定义
   *
   * 优先从 DB 加载已有数据，DB 为空时使用 getDefaultQuests() 写入默认模板。
   * 默认模板仅在首次启动或数据库被清空时生效。
   */
  async function _initDefaultQuestDefinitions(): Promise<void> {
    const existingDefs = await questDbService.getAllQuestDefinitions();
    if (existingDefs.length > 0) {
      // DB 中已有数据，直接加载
      const defMap = new Map<string, QuestDefinition>();
      existingDefs.forEach(def => defMap.set(def.id, def));
      questDefinitions.value = defMap;
      return;
    }

    // DB 中没有任务定义（首次启动或数据重置），写入默认模板
    const defaults = getDefaultQuests();
    const defMap = new Map<string, QuestDefinition>();
    for (const quest of defaults) {
      await questDbService.saveQuestDefinition(quest);
      defMap.set(quest.id, quest);
    }
    questDefinitions.value = defMap;
  }

  /**
   * 处理任务完成后的公共逻辑
   *
   * 执行以下步骤（按顺序）：
   * 1. 构建 updatedInstance（status → completed, completedAt → 当前时间）
   * 2. 发放奖励（_grantQuestRewards）
   * 3. 更新内存 + 持久化（_updateAndPersistInstance）
   * 4. 触发 QUEST_COMPLETED 事件
   * 5. 记录冒险日志
   *
   * 被 _processQuestProgress（自动完成）和 completeQuest（手动完成）共用。
   *
   * @param questId    - 任务ID
   * @param instance   - 当前任务实例（进度已更新至完成状态）
   * @param definition - 任务定义（用于奖励计算和日志文本）
   * @returns 更新后的任务实例（status = completed）
   */
  async function _handleQuestCompletion(
    questId: string,
    instance: QuestInstance,
    definition: QuestDefinition
  ): Promise<QuestInstance> {
    const updatedInstance: QuestInstance = {
      ...instance,
      status: 'completed',
      completedAt: Date.now()
    };

    // 先发奖再持久化：若发奖失败（如角色被删除），异常上抛阻止状态更新
    await _grantQuestRewards(definition);
    await _updateAndPersistInstance(questId, updatedInstance);

    // 通知 UI 刷新（如任务面板、进度条）
    eventBus.emit(GameEvents.QUEST_COMPLETED, { questId, definition });

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'quest',
      message: `完成了任务：${definition.title}！`,
      icon: 'game-icons:check-mark'
    });

    return updatedInstance;
  }

  /**
   * 处理单个任务的进度更新（公共逻辑）
   *
   * 被 onEnemyKilled 和 onItemCollected 共用。
   * 调用 checkQuestProgress() 纯函数计算新进度，
   * 若目标未全部完成则仅更新进度，若全部完成则委托给 _handleQuestCompletion。
   *
   * @param questId      - 任务ID
   * @param instance     - 当前任务实例
   * @param definition   - 任务定义
   * @param relevantData - 触发进度检查的事件数据
   * @param relevantData.enemyId - 被击杀的敌人ID
   * @param relevantData.itemId  - 被收集的物品ID
   * @param relevantData.amount  - 数量（默认 1）
   * @returns 是否触发了任务完成（供调用方判断是否需要额外 UI 响应）
   */
  async function _processQuestProgress(
    questId: string,
    instance: QuestInstance,
    definition: QuestDefinition,
    relevantData: { enemyId?: string; itemId?: string; amount?: number }
  ): Promise<boolean> {
    const result = checkQuestProgress(instance, definition, relevantData);
    // 无匹配目标，事件与任务无关
    if (!result) return false;

    const updatedInstance: QuestInstance = {
      ...instance,
      progress: result.progress
    };

    // 所有目标全部达成 → 完成
    if (result.isComplete) {
      await _handleQuestCompletion(questId, updatedInstance, definition);
      return true;
    }

    // 仅更新进度，任务未完成
    await _updateAndPersistInstance(questId, updatedInstance);
    return false;
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化任务模块
   *
   * 从数据库加载任务定义（全局）和指定角色的任务实例。
   * 应在角色登录/切换时调用。
   *
   * 加载顺序：
   * 1. 加载任务定义（_initDefaultQuestDefinitions）
   * 2. 加载当前角色的任务实例
   *
   * @param characterId - 要加载的角色ID
   */
  async function initialize(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;

    // 加载任务定义 —— 全局数据，所有角色共享
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
   * 无参初始化（兼容旧接口）
   *
   * 自动从 characterStore 获取当前角色ID。
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
   * 执行步骤：
   * 1. 校验任务定义存在
   * 2. 校验角色存在
   * 3. 调用 canAcceptQuest() 检查是否可接取
   * 4. 调用 generateQuestInstance() 创建实例
   * 5. 更新 Store 状态 + 持久化到 DB
   * 6. 触发 QUEST_ACCEPTED 事件 + 记录日志
   *
   * @param questId - 要接受的任务ID
   * @returns 是否成功接受（false = 校验失败）
   */
  async function acceptQuest(questId: string): Promise<boolean> {
    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    const cid = currentCharacterId.value || _getCharacterId();
    if (!cid) return false;

    // 检查等级和重复接取限制
    const characterLevel = _getCharacterLevel();
    if (!canAcceptQuest(definition, characterLevel, instanceList.value)) return false;

    // 创建新任务实例（status = in_progress, 所有 progress.current = 0）
    const instance = generateQuestInstance(definition);

    // 更新内存状态
    const newInstances = new Map(questInstances.value);
    newInstances.set(questId, instance);
    questInstances.value = newInstances;

    // 持久化到 IndexedDB
    await _persistInstance(instance);

    // 通知 UI + 记录日志
    eventBus.emit(GameEvents.QUEST_ACCEPTED, { questId, definition });
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'quest',
      message: `接受了任务：${definition.title}`,
      icon: 'game-icons:notebook'
    });

    return true;
  }

  // ==================== Action：进度事件处理 ====================

  /**
   * 处理敌人击杀事件
   *
   * 遍历所有进行中的任务，调用 _processQuestProgress 检查是否有匹配的击杀目标。
   * 由 combat/store.ts 在战斗结束时调用。
   *
   * 性能说明：当前实现为 O(n * m)，n = 任务数，m = 每个任务的目标数。
   * 对于当前规模（数十个任务，每个 1-2 个目标）无性能瓶颈。
   *
   * @param enemyId - 被击杀的敌人ID
   */
  async function onEnemyKilled(enemyId: string): Promise<void> {
    for (const [questId, instance] of questInstances.value) {
      // 仅检查进行中的任务
      if (instance.status !== 'in_progress') continue;

      const definition = questDefinitions.value.get(questId);
      if (!definition) continue;

      // 委托给公共进度处理函数
      await _processQuestProgress(questId, instance, definition, { enemyId });
    }
  }

  /**
   * 处理物品收集事件
   *
   * 遍历所有进行中的任务，检查是否有匹配的收集目标。
   *
   * @param itemId - 收集的物品ID
   * @param amount - 收集数量（默认 1，批量收集时可传入具体数量）
   */
  async function onItemCollected(itemId: string, amount: number = 1): Promise<void> {
    for (const [questId, instance] of questInstances.value) {
      if (instance.status !== 'in_progress') continue;

      const definition = questDefinitions.value.get(questId);
      if (!definition) continue;

      await _processQuestProgress(questId, instance, definition, { itemId, amount });
    }
  }

  // ==================== Action：完成任务（手动触发） ====================

  /**
   * 手动完成任务
   *
   * 与 _processQuestProgress 不同，不走 checkQuestProgress() 进度计算，
   * 而是直接检查所有 progress.current >= target 后调用 _handleQuestCompletion。
   *
   * 适用场景：任务目标已通过进度条显示达成，玩家手动点击"完成"按钮。
   *
   * @param questId - 任务ID
   * @returns 是否成功完成（false = 实例不存在 / 状态非 in_progress / 目标未全部达成）
   */
  async function completeQuest(questId: string): Promise<boolean> {
    const instance = questInstances.value.get(questId);
    if (!instance || instance.status !== 'in_progress') return false;

    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    // 手动确认所有目标均已达成
    const allComplete = instance.progress.every(p => p.current >= p.target);
    if (!allComplete) return false;

    await _handleQuestCompletion(questId, instance, definition);
    return true;
  }

  // ==================== Action：领取奖励（提交任务） ====================

  /**
   * 领取任务奖励（提交任务）
   *
   * 注意：奖励已在完成时通过 _handleQuestCompletion → _grantQuestRewards 自动发放，
   * 此方法仅将状态从 completed 转换为 turned_in（终态）。
   *
   * @param questId - 任务ID
   * @returns 是否成功领取（false = 实例不存在 / 状态非 completed）
   */
  async function claimReward(questId: string): Promise<boolean> {
    const instance = questInstances.value.get(questId);
    if (!instance || instance.status !== 'completed') return false;

    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    // 标记为已提交（终态）
    const updatedInstance: QuestInstance = {
      ...instance,
      status: 'turned_in'
    };
    await _updateAndPersistInstance(questId, updatedInstance);

    // 通知 UI
    eventBus.emit(GameEvents.QUEST_REWARDED, { questId, definition });

    // 记录冒险日志（显示奖励详情）
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
   * 将状态标记为 abandoned，后续可通过 acceptQuest 重新接取。
   *
   * @param questId - 任务ID
   * @returns 是否成功放弃（false = 实例不存在 / 状态非 in_progress）
   */
  async function abandonQuest(questId: string): Promise<boolean> {
    const instance = questInstances.value.get(questId);
    if (!instance || instance.status !== 'in_progress') return false;

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
   * 向角色发放任务奖励
   *
   * 调用 calculateQuestRewards() 纯函数计算奖励，
   * 然后分别调用 characterStore 和 inventoryStore 的 Action 发放。
   *
   * 注意：物品奖励通过 inventoryStore.addItem 同步调用（非 async），
   * 这是 Pinia Store 内部 Action 调用的典型模式。
   *
   * @param definition - 任务定义（含奖励字段）
   */
  async function _grantQuestRewards(definition: QuestDefinition): Promise<void> {
    const rewards = calculateQuestRewards(definition);

    // 经验奖励 → characterStore
    if (rewards.exp > 0) {
      await useCharacterStore().gainExp(rewards.exp);
    }

    // 金币奖励 → characterStore
    if (rewards.gold > 0) {
      await useCharacterStore().gainGold(rewards.gold);
    }

    // 物品奖励 → inventoryStore
    for (const item of rewards.items) {
      useInventoryStore().addItem(item.itemId, item.count);
    }
  }

  // ==================== Action：查询 ====================

  /**
   * 获取任务定义（同步查询，O(1)）
   *
   * @param questId - 任务ID
   * @returns 任务定义，不存在时返回 null
   */
  function getQuestDefinition(questId: string): QuestDefinition | null {
    return questDefinitions.value.get(questId) || null;
  }

  /**
   * 获取任务实例（同步查询，O(1)）
   *
   * @param questId - 任务ID
   * @returns 任务实例，不存在时返回 null
   */
  function getQuestInstance(questId: string): QuestInstance | null {
    return questInstances.value.get(questId) || null;
  }

  /**
   * 检查任务是否可接取
   *
   * @param questId - 任务ID
   * @returns 是否可接取（false = 定义不存在 / 等级不足 / 已有活跃实例）
   */
  function isQuestAvailable(questId: string): boolean {
    const definition = questDefinitions.value.get(questId);
    if (!definition) return false;

    const characterLevel = _getCharacterLevel();
    return canAcceptQuest(definition, characterLevel, instanceList.value);
  }

  /**
   * 获取指定任务板上的所有任务定义
   *
   * @param boardId - 任务板ID（如 "teldrassil"、"elwynn"）
   * @returns 该任务板上的任务定义列表
   */
  function getQuestsFromBoard(boardId: string): QuestDefinition[] {
    return definitionList.value.filter(def => def.boardId === boardId);
  }

  /**
   * 获取指定任务板上可提交（已完成）的任务定义
   *
   * 遍历 questInstances，筛选 status='completed' 且 definition.boardId 匹配的任务。
   *
   * @param boardId - 任务板ID
   * @returns 可提交的任务定义列表
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
   * 从指定任务板接受任务（带 boardId 校验）
   *
   * @param boardId - 任务板ID
   * @param questId - 任务ID
   * @returns 是否成功接受
   */
  async function acceptQuestFromBoard(boardId: string, questId: string): Promise<boolean> {
    const definition = questDefinitions.value.get(questId);
    if (!definition || definition.boardId !== boardId) return false;
    return acceptQuest(questId);
  }

  /**
   * 在指定任务板提交任务（领取奖励）
   *
   * @param boardId - 任务板ID
   * @param questId - 任务ID
   * @returns 是否成功提交
   */
  async function turnInQuestToBoard(boardId: string, questId: string): Promise<boolean> {
    const definition = questDefinitions.value.get(questId);
    if (!definition || definition.boardId !== boardId) return false;
    return claimReward(questId);
  }

  // ==================== Action：重置 ====================

  /**
   * 重置任务数据
   *
   * 清空内存中的任务实例 + 清除数据库中所有 char_quests 行。
   * 注意：任务定义（config_quests）不受影响。
   */
  async function reset(): Promise<void> {
    questInstances.value = new Map();
    await questDbService.clearAllQuestInstances();
  }

  /**
   * 销毁 Store，清理事件监听
   *
   * 在模块卸载时调用，防止事件总线内存泄漏。
   */
  function dispose(): void {
    eventBus.clearGroup('questStore');
  }

  // ==================== 导出 ====================

  return {
    // —— 状态 ——
    questDefinitions,
    questInstances,
    currentCharacterId,

    // —— 计算属性 ——
    definitionList,
    instanceList,
    activeQuests,
    completedQuests,
    turnedInQuests,
    availableQuests,
    inProgressQuests,

    // —— Action：初始化 ——
    initialize,
    init,

    // —— Action：核心操作 ——
    acceptQuest,
    onEnemyKilled,
    onItemCollected,
    completeQuest,
    claimReward,
    abandonQuest,

    // —— Action：查询 ——
    getQuestDefinition,
    getQuestInstance,
    isQuestAvailable,
    getQuestsFromBoard,
    getQuestsToTurnIn,

    // —— Action：任务板操作 ——
    acceptQuestFromBoard,
    turnInQuestToBoard,

    // —— Action：重置 ——
    reset,

    // —— 生命周期 ——
    dispose
  };
});
