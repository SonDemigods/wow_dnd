/**
 * 任务模块服务层
 * 
 * 提供任务管理的核心业务逻辑
 */
import type { 
  IQuestService, 
  QuestDefinition, 
  QuestInstance, 
  QuestStatus,
  QuestObjectiveProgress 
} from './types';
import { questDbService } from './db';
import { characterService } from '../character/service';
import { inventoryService } from '../inventory/service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 任务服务实现类
 */
export class QuestService implements IQuestService {
  /** 任务定义缓存 */
  private questDefinitions: Map<string, QuestDefinition> = new Map();
  
  /** 任务实例缓存 */
  private questInstances: Map<string, QuestInstance> = new Map();
  
  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    await this.loadQuestDefinitions();
    await this.loadQuestInstances();
    await this.initDefaultQuests();
  }
  
  /**
   * 加载任务定义
   */
  private async loadQuestDefinitions(): Promise<void> {
    const definitions = await questDbService.getAllQuestDefinitions();
    definitions.forEach(def => {
      this.questDefinitions.set(def.id, def);
    });
  }
  
  /**
   * 加载任务实例
   */
  private async loadQuestInstances(): Promise<void> {
    const characterId = characterService.getCurrentCharacterId();
    if (!characterId) return;
    const instances = await questDbService.getAllQuestInstances(characterId);
    instances.forEach(instance => {
      this.questInstances.set(instance.questId, instance);
    });
  }
  
  /**
   * 初始化默认任务
   */
  private async initDefaultQuests(): Promise<void> {
    const defaultQuests: QuestDefinition[] = [
      {
        id: 'quest_kill_goblin',
        title: '消灭哥布林',
        description: '村庄附近出现了一群哥布林，村民们非常害怕。请你前往东边的森林，消灭10只哥布林。',
        type: 'kill',
        objectives: [
          {
            key: 'kill_goblin',
            type: 'kill',
            description: '消灭哥布林',
            target: 10,
            enemyId: 'enemy_goblin'
          }
        ],
        levelRequirement: 1,
        xpReward: 100,
        goldReward: 50,
        boardId: 'board_village'
      },
      {
        id: 'quest_collect_herbs',
        title: '采集草药',
        description: '药剂师需要一些草药来制作治疗药水。请前往草药田采集15株草药。',
        type: 'collect',
        objectives: [
          {
            key: 'collect_herb',
            type: 'collect',
            description: '采集草药',
            target: 15,
            itemId: 'item_herb'
          }
        ],
        levelRequirement: 1,
        xpReward: 80,
        goldReward: 30,
        boardId: 'board_village'
      },
      {
        id: 'quest_kill_wolf',
        title: '狼群威胁',
        description: '最近有狼群在村庄周边活动，已经造成了一些损失。请消灭5只狼。',
        type: 'kill',
        objectives: [
          {
            key: 'kill_wolf',
            type: 'kill',
            description: '消灭狼',
            target: 5,
            enemyId: 'enemy_wolf'
          }
        ],
        levelRequirement: 2,
        xpReward: 150,
        goldReward: 80,
        boardId: 'board_village'
      },
      {
        id: 'quest_kill_boss_orc',
        title: '兽人首领',
        description: '一个强大的兽人首领带领着他的部下占领了矿山。请你前去击败他，夺回矿山！',
        type: 'kill',
        objectives: [
          {
            key: 'kill_orc_minion',
            type: 'kill',
            description: '消灭兽人手下',
            target: 3,
            enemyId: 'enemy_orc'
          },
          {
            key: 'kill_orc_boss',
            type: 'kill',
            description: '击败兽人首领',
            target: 1,
            enemyId: 'enemy_orc_boss'
          }
        ],
        levelRequirement: 5,
        xpReward: 500,
        goldReward: 300,
        boardId: 'board_village'
      }
    ];
    
    for (const quest of defaultQuests) {
      if (!this.questDefinitions.has(quest.id)) {
        await questDbService.saveQuestDefinition(quest);
        this.questDefinitions.set(quest.id, quest);
      }
    }
  }
  
  /**
   * 接受任务
   * @param questId - 任务ID
   * @returns 是否成功接受
   */
  acceptQuest(questId: string): boolean {
    // 检查任务定义是否存在
    const definition = this.getQuestDefinition(questId);
    if (!definition) {
      return false;
    }
    
    // 检查任务是否已接取
    if (this.isQuestInProgress(questId)) {
      return false;
    }
    
    // 检查任务是否已完成（已提交）
    if (this.isQuestCompleted(questId)) {
      return false;
    }
    
    // 检查等级要求
    const characterLevel = characterService.getLevel();
    if (characterLevel < definition.levelRequirement) {
      return false;
    }
    
    // 创建任务实例
    const instance: QuestInstance = {
      questId,
      status: 'in_progress',
      progress: definition.objectives.map(obj => ({
        objectiveKey: obj.key,
        current: 0,
        target: obj.target
      })),
      acceptedAt: Date.now()
    };
    
    // 保存任务实例
    this.questInstances.set(questId, instance);
    const characterId = characterService.getCurrentCharacterId();
    if (characterId) {
      questDbService.saveQuestInstance(instance, characterId);
    }
    
    // 触发任务接受事件
    eventBus.emit(GameEvents.QUEST_ACCEPTED, { questId, definition });
    
    return true;
  }
  
  /**
   * 更新任务进度
   * @param questId - 任务ID
   * @param objectiveKey - 目标键
   * @param amount - 增加数量，默认为1
   */
  updateQuestProgress(questId: string, objectiveKey: string, amount: number = 1): void {
    // 获取任务实例
    let instance = this.questInstances.get(questId);
    if (!instance) {
      return;
    }
    
    // 获取任务定义
    const definition = this.getQuestDefinition(questId);
    if (!definition) {
      return;
    }
    
    // 查找目标
    const objective = definition.objectives.find(obj => obj.key === objectiveKey);
    if (!objective) {
      return;
    }
    
    // 更新进度
    const progressIndex = instance.progress.findIndex(p => p.objectiveKey === objectiveKey);
    if (progressIndex !== -1) {
      const current = instance.progress[progressIndex].current;
      const target = instance.progress[progressIndex].target;
      instance.progress[progressIndex].current = Math.min(current + amount, target);
      
      // 检查是否所有目标都完成
      const allCompleted = instance.progress.every(p => p.current >= p.target);
      if (allCompleted && instance.status === 'in_progress') {
        instance.status = 'completed';
        instance.completedAt = Date.now();
        
        // 触发任务完成事件
        eventBus.emit(GameEvents.QUEST_COMPLETED, { questId, definition });
      }
      
      // 保存更新
      this.questInstances.set(questId, instance);
      const cid = characterService.getCurrentCharacterId();
      if (cid) questDbService.saveQuestInstance(instance, cid);
    }
  }
  
  /**
   * 提交任务（领取奖励）
   * @param questId - 任务ID
   * @returns 是否成功提交
   */
  turnInQuest(questId: string): boolean {
    // 获取任务实例
    const instance = this.questInstances.get(questId);
    if (!instance) {
      return false;
    }
    
    // 检查任务是否已完成
    if (instance.status !== 'completed') {
      return false;
    }
    
    // 获取任务定义
    const definition = this.getQuestDefinition(questId);
    if (!definition) {
      return false;
    }
    
    // 发放经验奖励
    characterService.addExp(definition.xpReward);
    
    // 发放金币奖励
    characterService.addGold(definition.goldReward);
    
    // 发放物品奖励
    if (definition.itemRewards) {
      definition.itemRewards.forEach(itemReward => {
        inventoryService.addItem(itemReward.itemId, itemReward.amount);
      });
    }
    
    // 更新任务状态
    instance.status = 'turned_in';
    this.questInstances.set(questId, instance);
    const cid2 = characterService.getCurrentCharacterId();
    if (cid2) questDbService.saveQuestInstance(instance, cid2);
    
    // 触发任务提交事件
    eventBus.emit(GameEvents.QUEST_REWARDED, { questId, definition });
    
    return true;
  }
  
  /**
   * 放弃任务
   * @param questId - 任务ID
   * @returns 是否成功放弃
   */
  abandonQuest(questId: string): boolean {
    // 获取任务实例
    const instance = this.questInstances.get(questId);
    if (!instance) {
      return false;
    }
    
    // 只能放弃进行中的任务
    if (instance.status !== 'in_progress') {
      return false;
    }
    
    // 更新任务状态
    instance.status = 'abandoned';
    this.questInstances.set(questId, instance);
    const cid3 = characterService.getCurrentCharacterId();
    if (cid3) questDbService.saveQuestInstance(instance, cid3);
    
    // 触发任务放弃事件
    eventBus.emit(GameEvents.QUEST_PROGRESS, { questId });
    
    return true;
  }
  
  /**
   * 检查任务是否可用（可接取）
   * @param questId - 任务ID
   * @returns 是否可用
   */
  isQuestAvailable(questId: string): boolean {
    // 检查任务定义是否存在
    const definition = this.getQuestDefinition(questId);
    if (!definition) {
      return false;
    }
    
    // 检查等级要求
    const characterLevel = characterService.getLevel();
    if (characterLevel < definition.levelRequirement) {
      return false;
    }
    
    // 检查是否已接取或已完成
    const instance = this.questInstances.get(questId);
    if (instance) {
      // 如果任务已提交，则不可再次接取
      if (instance.status === 'turned_in') {
        return false;
      }
      // 如果任务已放弃，可以重新接取
      if (instance.status === 'abandoned') {
        return true;
      }
      // 其他状态（进行中、完成）则不可接取
      return false;
    }
    
    // 没有任务实例，说明从未接取过
    return true;
  }
  
  /**
   * 检查任务是否进行中
   * @param questId - 任务ID
   * @returns 是否进行中
   */
  isQuestInProgress(questId: string): boolean {
    const instance = this.questInstances.get(questId);
    return instance?.status === 'in_progress';
  }
  
  /**
   * 检查任务是否完成（可提交）
   * @param questId - 任务ID
   * @returns 是否完成
   */
  isQuestCompleted(questId: string): boolean {
    const instance = this.questInstances.get(questId);
    return instance?.status === 'completed';
  }
  
  /**
   * 获取任务实例（玩家接取的任务状态）
   * @param questId - 任务ID
   * @returns 任务实例，如果不存在返回null
   */
  getQuestInstance(questId: string): QuestInstance | null {
    return this.questInstances.get(questId) || null;
  }
  
  /**
   * 获取任务定义（任务的静态数据）
   * @param questId - 任务ID
   * @returns 任务定义，如果不存在返回null
   */
  getQuestDefinition(questId: string): QuestDefinition | null {
    return this.questDefinitions.get(questId) || null;
  }
  
  /**
   * 获取所有可用任务列表
   * @returns 任务ID列表
   */
  getAvailableQuests(): string[] {
    const available: string[] = [];
    
    this.questDefinitions.forEach((definition, questId) => {
      if (this.isQuestAvailable(questId)) {
        available.push(questId);
      }
    });
    
    return available;
  }
  
  /**
   * 获取所有进行中的任务列表
   * @returns 任务ID列表
   */
  getInProgressQuests(): string[] {
    const inProgress: string[] = [];
    
    this.questInstances.forEach((instance, questId) => {
      if (instance.status === 'in_progress') {
        inProgress.push(questId);
      }
    });
    
    return inProgress;
  }
  
  /**
   * 获取所有已完成的任务列表
   * @returns 任务ID列表
   */
  getCompletedQuests(): string[] {
    const completed: string[] = [];
    
    this.questInstances.forEach((instance, questId) => {
      if (instance.status === 'completed') {
        completed.push(questId);
      }
    });
    
    return completed;
  }
  
  /**
   * 获取指定任务板上的任务
   * @param boardId - 任务板ID
   * @returns 任务定义列表
   */
  getQuestsFromBoard(boardId: string): QuestDefinition[] {
    const quests: QuestDefinition[] = [];
    
    this.questDefinitions.forEach((definition) => {
      if (definition.boardId === boardId) {
        quests.push(definition);
      }
    });
    
    return quests;
  }
  
  /**
   * 获取指定任务板上可提交的任务
   * @param boardId - 任务板ID
   * @returns 任务定义列表
   */
  getQuestsToTurnIn(boardId: string): QuestDefinition[] {
    const quests: QuestDefinition[] = [];
    
    this.questInstances.forEach((instance, questId) => {
      if (instance.status === 'completed') {
        const definition = this.getQuestDefinition(questId);
        if (definition && definition.boardId === boardId) {
          quests.push(definition);
        }
      }
    });
    
    return quests;
  }
  
  /**
   * 从任务板接受任务
   * @param boardId - 任务板ID
   * @param questId - 任务ID
   * @returns 是否成功接受
   */
  acceptQuestFromBoard(boardId: string, questId: string): boolean {
    // 验证任务是否在指定任务板上
    const definition = this.getQuestDefinition(questId);
    if (!definition || definition.boardId !== boardId) {
      return false;
    }
    
    return this.acceptQuest(questId);
  }
  
  /**
   * 在任务板提交任务
   * @param boardId - 任务板ID
   * @param questId - 任务ID
   * @returns 是否成功提交
   */
  turnInQuestToBoard(boardId: string, questId: string): boolean {
    // 验证任务是否在指定任务板上
    const definition = this.getQuestDefinition(questId);
    if (!definition || definition.boardId !== boardId) {
      return false;
    }
    
    return this.turnInQuest(questId);
  }
  
  /**
   * 重置所有任务数据（用于测试或新游戏）
   */
  reset(): void {
    this.questInstances.clear();
    questDbService.clearAllQuestInstances();
  }
  
  /**
   * 处理敌人击杀事件
   * @param enemyId - 敌人ID
   */
  handleEnemyKill(enemyId: string): void {
    // 遍历所有进行中的任务，更新击杀目标进度
    this.questInstances.forEach((instance, questId) => {
      if (instance.status === 'in_progress') {
        const definition = this.getQuestDefinition(questId);
        if (definition) {
          definition.objectives.forEach(objective => {
            if (objective.type === 'kill' && objective.enemyId === enemyId) {
              this.updateQuestProgress(questId, objective.key, 1);
            }
          });
        }
      }
    });
  }
  
  /**
   * 处理物品收集事件
   * @param itemId - 物品ID
   */
  handleItemCollect(itemId: string, amount: number = 1): void {
    // 遍历所有进行中的任务，更新收集目标进度
    this.questInstances.forEach((instance, questId) => {
      if (instance.status === 'in_progress') {
        const definition = this.getQuestDefinition(questId);
        if (definition) {
          definition.objectives.forEach(objective => {
            if (objective.type === 'collect' && objective.itemId === itemId) {
              this.updateQuestProgress(questId, objective.key, amount);
            }
          });
        }
      }
    });
  }
}

/**
 * 任务服务实例
 */
export const questService = new QuestService();