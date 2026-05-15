/**
 * @fileoverview 任务模块类型定义
 * @description 包含任务相关的类型和接口
 * @module modules/quests/types
 */

/**
 * 任务状态
 */
export enum QuestStatus {
  NOT_AVAILABLE = 'not_available',
  AVAILABLE = 'available',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  TURNED_IN = 'turned_in',
}

/**
 * 单个目标进度
 */
export interface QuestObjectiveProgress {
  current: number;
  target: number;
}

/**
 * 任务进度
 */
export interface QuestProgress {
  [objectiveKey: string]: QuestObjectiveProgress;
}

/**
 * 任务状态数据
 */
export interface QuestState {
  questKey: string;
  status: QuestStatus;
  progress: QuestProgress;
  acceptedAt: number;
  completedAt?: number;
}

/**
 * 任务接受事件
 */
export interface QuestAcceptedEvent {
  questKey: string;
  questName: string;
}

/**
 * 任务完成事件
 */
export interface QuestCompletedEvent {
  questKey: string;
  questName: string;
  xpReward: number;
  goldReward: number;
}

/**
 * 任务进度更新事件
 */
export interface QuestProgressUpdatedEvent {
  questKey: string;
  objectiveKey: string;
  current: number;
  target: number;
}

/**
 * 任务服务接口
 */
export interface IQuestService {
  acceptQuest(questKey: string): boolean;
  updateQuestProgress(questKey: string, objectiveKey: string, amount?: number): void;
  turnInQuest(questKey: string): boolean;
  isQuestAvailable(questKey: string): boolean;
  isQuestInProgress(questKey: string): boolean;
  isQuestCompleted(questKey: string): boolean;
  getQuestState(questKey: string): QuestState | null;
  getAvailableQuests(): string[];
  getInProgressQuests(): string[];
  getCompletedQuests(): string[];
  reset(): void;
}
