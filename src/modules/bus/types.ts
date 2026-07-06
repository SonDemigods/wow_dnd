/**
 * @fileoverview 事件总线模块类型定义
 * @description 定义游戏事件系统的所有类型、接口和枚举。
 *              本文件是 bus 模块的类型基石，GameEvents 枚举和 GameEventPayloadMap 接口
 *              共同构成事件总线的类型安全防线。
 * @module bus
 */

import type { EnemyInstance } from '../enemy/types';
import type { LocationData } from '../map/types';
import type { QuestDefinition } from '../quest/types';
import type { Skill } from '../skill/types';

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 事件回调函数类型
 *
 * 内部存储使用的通用回调签名，采用 `any[]` 以保证异构回调数组的灵活兼容。
 * 公共 API 层（`on` / `off` / `once` 等）通过泛型提供更精确的类型约束，
 * 此处仅作为内部容器的存储单元。
 *
 * @see EventBus.on 注册监听器时使用具体的事件载荷类型
 * @see EventBus.emit 触发事件时通过 GameEventPayloadMap 确保类型匹配
 */
export type EventCallback = (...args: any[]) => void;

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 游戏事件枚举
 *
 * 定义所有游戏事件名称常量，按功能模块分组管理。
 * 每个枚举值均为 `keyof GameEventPayloadMap` 的必要组成部分，
 * 确保 emit/on 双方使用同一套事件名。
 *
 * 分组说明：
 * - 角色：角色创建、删除、登出、升级、死亡、复活
 * - 战斗：战斗起止、回合切换、伤害/治疗/暴击/闪避
 * - 探索：探索启停、格子触发、战斗/营地/物品/陷阱/随机事件
 * - 商店：商店开关、交易记录
 * - 任务：任务面板、接受、完成、奖励
 * - 技能：技能学习、技能施放
 * - UI：面板开关、点击事件、确认弹窗
 * - 物品：物品掉落
 * - 存档：数据导出、数据导入
 *
 * @see GameEventPayloadMap 每个事件的载荷类型定义
 * @see EventBus.emit 触发事件时以此枚举值为 key 索引载荷类型
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

// ============================================================================
// 核心映射接口
// ============================================================================

/**
 * 事件参数类型映射接口
 *
 * 为每个 GameEvents 枚举值定义对应的 payload 类型，是事件总线类型安全的核心。
 * emit/on 双方通过 `K extends keyof GameEventPayloadMap` 泛型约束，
 * 确保事件名与载荷类型在编译期严格匹配。
 *
 * 约定：
 * - 无需载荷的事件使用 `null`（如 COMBAT_PLAYER_TURN）
 * - 复杂对象使用具体接口（如 `EnemyInstance`、`LocationData`）
 * - 可选字段使用 `?` 标记（如 `goldGained?`）
 *
 * @see EventBus.emit 泛型参数 `K` 约束源
 * @see EventBus.on 泛型参数 `K` 约束源
 */
export interface GameEventPayloadMap {
  [GameEvents.CHARACTER_CREATED]: { characterId: string; name: string };
  [GameEvents.CHARACTER_DELETED]: { characterId: string };
  [GameEvents.CHARACTER_LOGOUT]: null;
  [GameEvents.CHARACTER_LEVEL_UP]: { oldLevel: number; newLevel: number };
  [GameEvents.CHARACTER_DEATH]: { cause: string };
  [GameEvents.CHARACTER_RESURRECTED]: { newHp: number; newMp: number };
  [GameEvents.COMBAT_START]: { enemy: EnemyInstance };
  [GameEvents.COMBAT_END]: { result: string; enemy: EnemyInstance | null; expGained: number; goldGained?: number };
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

// ============================================================================
// 事件总线接口
// ============================================================================

/**
 * 事件总线接口
 *
 * 定义了事件总线的完整公共契约，所有订阅/发布操作均通过此接口约束。
 * EventBus 类实现此接口，eventBus 单例以此接口类型对外暴露。
 *
 * 类型安全设计：
 * - 所有事件操作（on / off / emit / once / onGroup）通过 `K extends keyof GameEventPayloadMap`
 *   泛型约束，确保事件名与载荷类型在编译期严格匹配
 * - `clearGroup` / `clearAll` / `removeEvent` 为无泛型的批量操作
 *
 * @see EventBus 实现类
 * @see eventBus 全局单例实例
 */
export interface IEventBus {
  /** 注册事件监听器 */
  on<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 取消事件监听器 */
  off<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 触发事件 */
  emit<K extends keyof GameEventPayloadMap>(event: K, data: GameEventPayloadMap[K]): void;

  /** 注册一次性事件监听器（触发后自动取消） */
  once<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 按分组注册事件监听器 */
  onGroup<K extends keyof GameEventPayloadMap>(groupName: string, event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 清除指定分组的所有事件监听器 */
  clearGroup(groupName: string): void;

  /** 清除所有事件监听器 */
  clearAll(): void;

  /** 移除指定事件的所有监听器 */
  removeEvent(event: string): void;
}

// ============================================================================
// 内部存储接口
// ============================================================================

/**
 * 事件监听器映射接口
 *
 * EventBus 内部存储结构，以事件名为 key 索引回调函数数组。
 * key 为 `string` 而非 `keyof GameEventPayloadMap`，是因为公共 API 层已提供编译期约束，
 * 内部存储使用宽泛类型可保持代码简洁，避免大量类型断言。
 *
 * @property {string} event - 事件名称（对应 GameEvents 枚举值或其字符串形式）
 * @property {EventCallback[]} callbacks - 该事件的所有回调函数数组
 *
 * @see EventBus.listeners 使用此接口存储运行时监听器
 */
export interface EventListeners {
  [event: string]: EventCallback[];
}

/**
 * 事件监听器分组记录接口
 *
 * EventBus 内部分组管理结构，以分组名为 key 索引该组内注册的所有 {事件, 回调} 对。
 * 通过 `onGroup` 注册、`clearGroup` 批量清理，便于模块级的生命周期管理。
 *
 * @property {string} groupName - 分组名称（如 store 名称）
 * @property {Array} entries - 该分组下的所有 {event, callback} 记录
 * @property {string} entries.event - 事件名称
 * @property {EventCallback} entries.callback - 回调函数引用（与 listeners 中的引用一致）
 *
 * @see EventBus.groups 使用此接口存储分组记录
 * @see EventBus.onGroup 向分组注册监听器
 * @see EventBus.clearGroup 批量清除分组监听器
 */
export interface GroupListeners {
  [groupName: string]: Array<{ event: string; callback: EventCallback }>;
}
