/**
 * @fileoverview NPC模块类型定义
 * @description NPC交互相关的类型和接口
 * @module modules/npc/types
 */

/**
 * NPC类型
 */
export enum NPCType {
  QUEST_GIVER = 'quest_giver',
  VENDOR = 'vendor',
  TRAINER = 'trainer',
  REPAIR = 'repair',
  MISCELLANEOUS = 'miscellaneous',
}

/**
 * NPC数据
 */
export interface NPCData {
  id: string;
  name: string;
  icon: string;
  type: NPCType;
  locationKey: string;
  questKeys?: string[];
  vendorItems?: string[];
  dialogue?: string[];
}

/**
 * NPC交互状态
 */
export interface NPCInteractionState {
  currentNPCId: string | null;
  interactionStep: number;
  availableQuests: string[];
}

/**
 * NPC对话事件
 */
export interface NPCDialogueEvent {
  npcId: string;
  npcName: string;
  message: string;
}

/**
 * NPC交易事件
 */
export interface NPCTradeEvent {
  npcId: string;
  npcName: string;
  itemId: string;
  isBuying: boolean;
}

/**
 * NPC服务接口
 */
export interface INPCService {
  interactWithNPC(npcId: string): boolean;
  endInteraction(): void;
  getNPC(npcId: string): NPCData | null;
  getNPCsAtLocation(locationKey: string): NPCData[];
  getCurrentInteraction(): NPCInteractionState;
  talkToNPC(): void;
  acceptQuestFromNPC(questKey: string): boolean;
  turnInQuestToNPC(questKey: string): boolean;
  reset(): void;
}
