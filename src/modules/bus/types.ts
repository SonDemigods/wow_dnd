/**
 * 事件总线模块类型定义
 * 
 * 定义游戏事件系统的所有类型、接口和枚举
 */
import type { Enemy } from '../enemy/types';
import type { LocationData } from '../map/types';
import type { QuestDefinition } from '../quest/types';
import type { Skill } from '../skill/types';

/** 事件回调函数类型 */
export type EventCallback = (...args: any[]) => void;

/**
 * 游戏事件枚举
 * 
 * 定义所有游戏事件名称常量，按功能模块分组管理。
 */
export enum GameEvents {
  // ==================== 角色 ====================
  CHARACTER_CREATED = 'character_created',
  CHARACTER_DELETED = 'character_deleted',
  CHARACTER_LOGOUT = 'character_logout',
  CHARACTER_LEVEL_UP = 'character_level_up',
  CHARACTER_DEATH = 'character_death',
  CHARACTER_RESURRECTED = 'character_resurrected',

  // ==================== 战斗 ====================
  COMBAT_START = 'combat_start',
  COMBAT_END = 'combat_end',
  COMBAT_PLAYER_TURN = 'combat_player_turn',
  COMBAT_ENEMY_TURN = 'combat_enemy_turn',
  COMBAT_DEAL_DAMAGE = 'combat_deal_damage',
  COMBAT_CAST_HEAL = 'combat_cast_heal',
  COMBAT_CRITICAL_HIT = 'combat_critical_hit',
  COMBAT_DODGE = 'combat_dodge',

  // ==================== 探索 ====================
  EXPLORATION_START = 'exploration_start',
  EXPLORATION_END = 'exploration_end',
  EXPLORATION_CELL_EXPLORED = 'exploration_cell_explored',
  EXPLORATION_BATTLE_TRIGGERED = 'exploration_battle_triggered',
  EXPLORATION_CAMP_USED = 'exploration_camp_used',
  EXPLORATION_ITEM_FOUND = 'exploration_item_found',
  EXPLORATION_TRAP_TRIGGERED = 'exploration_trap_triggered',
  EXPLORATION_RANDOM_EVENT = 'exploration_random_event',

  // ==================== 区域 ====================
  ZONE_ENTERED = 'zone_entered',

  // ==================== 商店 ====================
  SHOP_OPENED = 'shop_opened',
  SHOP_TRANSACTION = 'shop_transaction',
  SHOP_CLOSED = 'shop_closed',

  // ==================== 任务 ====================
  QUEST_BOARD_OPENED = 'quest_board_opened',
  QUEST_ACCEPTED = 'quest_accepted',
  QUEST_COMPLETED = 'quest_completed',
  QUEST_REWARDED = 'quest_rewarded',

  // ==================== 技能 ====================
  SKILL_LEARNED = 'skill_learned',
  SKILL_CAST = 'skill_cast',

  // ==================== 游戏数据 ====================
  GAME_DATA_UPDATED = 'game_data_updated',

  // ==================== 日志 ====================
  LOG_ENTRY_ADDED = 'log_entry_added',

  // ==================== UI ====================
  UI_PANEL_OPENED = 'ui_panel_opened',
  UI_PANEL_CLOSED = 'ui_panel_closed',
  UI_CLICK = 'ui_click',
  CONFIRM_CONFIRMED = 'confirm_confirmed',
  CONFIRM_CANCELED = 'confirm_canceled',

  // ==================== 物品 ====================
  ITEM_DROPPED = 'item_dropped',

  // ==================== 战斗补充 ====================
  COMBAT_SKIP_TURN = 'combat_skip_turn',
  COMBAT_BOSS_INTRO = 'combat_boss_intro',
  COMBAT_BOSS_PHASE = 'combat_boss_phase',

  // ==================== 存档 ====================
  DATA_EXPORTED = 'data_exported',
  DATA_IMPORTED = 'data_imported'
}

/**
 * 事件参数类型映射
 * 
 * 为每个 GameEvent 定义对应的 payload 类型，确保 emit/on 的类型安全。
 */
export interface GameEventPayloadMap {
  [GameEvents.CHARACTER_CREATED]: { characterId: string; name: string };
  [GameEvents.CHARACTER_DELETED]: { characterId: string };
  [GameEvents.CHARACTER_LOGOUT]: null;
  [GameEvents.CHARACTER_LEVEL_UP]: { oldLevel: number; newLevel: number };
  [GameEvents.CHARACTER_DEATH]: { cause: string };
  [GameEvents.CHARACTER_RESURRECTED]: { newHp: number; newMp: number };
  [GameEvents.COMBAT_START]: { enemy: Enemy };
  [GameEvents.COMBAT_END]: { result: string; enemy: Enemy | null; expGained: number; goldGained?: number };
  [GameEvents.COMBAT_PLAYER_TURN]: null;
  [GameEvents.COMBAT_ENEMY_TURN]: null;
  [GameEvents.COMBAT_DEAL_DAMAGE]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType?: 'player' | 'enemy' };
  [GameEvents.COMBAT_CAST_HEAL]: { amount: number; healType: 'health' | 'mana' | 'buff' | 'debuff'; targetName: string };
  [GameEvents.COMBAT_CRITICAL_HIT]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType: 'player' | 'enemy' };
  [GameEvents.COMBAT_DODGE]: { attackerName: string; dodgerName: string; dodgerType: 'player' | 'enemy' };
  [GameEvents.EXPLORATION_START]: { characterId: string | null; areaId?: string };
  [GameEvents.EXPLORATION_END]: { characterId: string | null };
  [GameEvents.EXPLORATION_CELL_EXPLORED]: { characterId: string | null; x: number; y: number; cellType?: string; interactionId?: string };
  [GameEvents.EXPLORATION_BATTLE_TRIGGERED]: { characterId: string | null; eventData: { monsterId: string; areaLevel: number } };
  [GameEvents.EXPLORATION_CAMP_USED]: { characterId: string | null };
  [GameEvents.EXPLORATION_ITEM_FOUND]: { characterId: string | null; itemId: string; count: number; itemName?: string };
  [GameEvents.EXPLORATION_TRAP_TRIGGERED]: { characterId: string | null; damage: number; trapType?: string };
  [GameEvents.EXPLORATION_RANDOM_EVENT]: { characterId: string | null; message: string; icon: string };
  [GameEvents.ZONE_ENTERED]: { locationId: string; location: LocationData };
  [GameEvents.SHOP_OPENED]: { characterId?: string; shopId: string };
  [GameEvents.SHOP_CLOSED]: { shopId?: string };
  [GameEvents.SHOP_TRANSACTION]: { shopId?: string; itemId: string; quantity?: number; totalPrice?: number; sellPrice?: number };
  [GameEvents.QUEST_BOARD_OPENED]: { characterId?: string; boardId: string };
  [GameEvents.QUEST_ACCEPTED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_COMPLETED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_REWARDED]: { questId: string; definition: QuestDefinition };
  [GameEvents.SKILL_LEARNED]: { skill: Skill };
  [GameEvents.SKILL_CAST]: { skill: Skill; success: boolean };
  [GameEvents.GAME_DATA_UPDATED]: { type: string; action: string; id: string };
  [GameEvents.LOG_ENTRY_ADDED]: { type: string; message: string; icon?: string };
  [GameEvents.UI_PANEL_OPENED]: { panel: string };
  [GameEvents.UI_PANEL_CLOSED]: { panel: string };
  [GameEvents.CONFIRM_CONFIRMED]: { action: string };
  [GameEvents.CONFIRM_CANCELED]: { action: string };
  [GameEvents.ITEM_DROPPED]: { itemId: string };
  [GameEvents.COMBAT_SKIP_TURN]: null;
  [GameEvents.COMBAT_BOSS_INTRO]: { enemyId: string; enemyName: string; icon: string; effect: string; lines: string[]; duration: number };
  [GameEvents.COMBAT_BOSS_PHASE]: { enemyId: string; enemyName: string; phaseName: string; effect: string };
  [GameEvents.DATA_EXPORTED]: null;
  [GameEvents.DATA_IMPORTED]: null;
  [GameEvents.UI_CLICK]: { source: string };
}

/**
 * 事件监听器映射接口
 */
export interface EventListeners {
  [event: string]: EventCallback[];
}

/**
 * 事件监听器分组记录接口
 */
export interface GroupListeners {
  [groupName: string]: Array<{ event: string; callback: EventCallback }>;
}
