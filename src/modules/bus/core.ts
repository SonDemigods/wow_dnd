/**
 * 事件总线模块
 * 
 * 提供游戏内事件的发布/订阅机制，用于组件间的解耦通信。
 * 使用单例模式，通过 eventBus 实例对外提供服务。
 * 支持事件分组管理，便于模块级的批量注册与清理。
 */

import type { Enemy } from '../enemy/types';
import type { LocationData } from '../map/types';
import type { QuestDefinition } from '../quest/types';
import type { Skill } from '../skill/types';

// ============================================================
// 事件参数类型定义
// ============================================================

/**
 * 事件回调函数类型
 */
type EventCallback = (...args: any[]) => void;

/**
 * 事件参数类型映射
 * 
 * 为每个 GameEvent 定义对应的 payload 类型，确保 emit/on 的类型安全。
 */
export interface GameEventPayloadMap {
  // ==================== 角色（仅保留 UI/音效事件，数据变更事件已迁移到 Store Action） ====================
  [GameEvents.CHARACTER_CREATED]: { characterId: string; name: string };
  [GameEvents.CHARACTER_DELETED]: { characterId: string };
  [GameEvents.CHARACTER_LOGOUT]: null;
  [GameEvents.CHARACTER_LEVEL_UP]: { oldLevel: number; newLevel: number };
  [GameEvents.CHARACTER_DEATH]: { cause: string };
  [GameEvents.CHARACTER_RESURRECTED]: { newHp: number; newMp: number };
  // ==================== 战斗 ====================
  [GameEvents.COMBAT_START]: { enemy: Enemy };
  [GameEvents.COMBAT_END]: { result: string; enemy: Enemy | null; expGained: number; goldGained?: number };
  [GameEvents.COMBAT_PLAYER_TURN]: null;
  [GameEvents.COMBAT_ENEMY_TURN]: null;
  // ==================== 战斗——伤害/治疗类型（仅保留 UI/音效事件） ====================
  /** 造成伤害事件（携带伤害类型，物伤/魔伤，用于音效） */
  [GameEvents.COMBAT_DEAL_DAMAGE]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType?: 'player' | 'enemy' };
  /** 施放治疗事件（携带治疗类型，生命/法力，用于音效） */
  [GameEvents.COMBAT_CAST_HEAL]: { amount: number; healType: 'health' | 'mana'; targetName: string };
  /** 暴击事件（用于触发暴击视觉特效和音效） */
  [GameEvents.COMBAT_CRITICAL_HIT]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType: 'player' | 'enemy' };
  /** 闪避事件（用于触发闪避视觉特效和音效） */
  [GameEvents.COMBAT_DODGE]: { attackerName: string; dodgerName: string; dodgerType: 'player' | 'enemy' };
  // ==================== 探索 ====================
  [GameEvents.EXPLORATION_START]: { characterId: string | null; areaId?: string };
  [GameEvents.EXPLORATION_END]: { characterId: string | null };
  [GameEvents.EXPLORATION_CELL_EXPLORED]: { characterId: string | null; x: number; y: number; cellType?: string; interactionId?: string };
  [GameEvents.EXPLORATION_BATTLE_TRIGGERED]: { characterId: string | null; eventData: { monsterId: string } };
  [GameEvents.EXPLORATION_CAMP_USED]: { characterId: string | null };
  [GameEvents.EXPLORATION_ITEM_FOUND]: { characterId: string | null; itemId: string; count: number; itemName?: string };
  [GameEvents.EXPLORATION_TRAP_TRIGGERED]: { characterId: string | null; damage: number; trapType?: string };
  [GameEvents.EXPLORATION_RANDOM_EVENT]: { characterId: string | null; message: string; icon: string };
  // ==================== 区域 ====================
  [GameEvents.ZONE_ENTERED]: { locationId: string; location: LocationData };
  // ==================== 商店 ====================
  [GameEvents.SHOP_OPENED]: { characterId?: string; shopId: string };
  [GameEvents.SHOP_CLOSED]: { shopId?: string };
  [GameEvents.SHOP_TRANSACTION]: { shopId?: string; itemId: string; quantity?: number; totalPrice?: number; sellPrice?: number };
  // ==================== 任务（仅保留 UI 通知事件） ====================
  [GameEvents.QUEST_BOARD_OPENED]: { characterId?: string; boardId: string };
  [GameEvents.QUEST_ACCEPTED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_COMPLETED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_REWARDED]: { questId: string; definition: QuestDefinition };
  // ==================== 技能（仅保留 UI/音效事件） ====================
  [GameEvents.SKILL_LEARNED]: { skill: Skill };
  [GameEvents.SKILL_CAST]: { skill: Skill; success: boolean };
  // ==================== 游戏数据 ====================
  [GameEvents.GAME_DATA_UPDATED]: { type: string; action: string; id: string };
  // ==================== 日志 ====================
  [GameEvents.LOG_ENTRY_ADDED]: { type: string; message: string; icon?: string };
  // ==================== UI ====================
  [GameEvents.UI_PANEL_OPENED]: { panel: string };
  [GameEvents.UI_PANEL_CLOSED]: { panel: string };
  [GameEvents.CONFIRM_CONFIRMED]: { action: string };
  [GameEvents.CONFIRM_CANCELED]: { action: string };
  [GameEvents.ITEM_DROPPED]: { itemId: string };
  [GameEvents.COMBAT_SKIP_TURN]: null;
  [GameEvents.DATA_EXPORTED]: null;
  [GameEvents.DATA_IMPORTED]: null;
  [GameEvents.UI_CLICK]: { source: string };
}

/**
 * 事件监听器映射接口
 * key: 事件名称
 * value: 该事件的回调函数数组
 */
interface EventListeners {
  [event: string]: EventCallback[];
}

/**
 * 事件监听器分组记录
 * key: 分组名称
 * value: { event, callback } 数组
 */
interface GroupListeners {
  [groupName: string]: Array<{ event: string; callback: EventCallback }>;
}

/**
 * 事件总线类
 * 
 * 实现了发布/订阅模式，支持事件的注册、取消注册、触发等操作。
 * 支持一次性事件监听（once）、分组管理（onGroup/clearGroup）和批量清除（clearAll）。
 */
export class EventBus {
  /** 事件监听器映射表 */
  private listeners: EventListeners = {};

  /** 分组监听器记录 */
  private groups: GroupListeners = {};

  /**
   * 注册事件监听器
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * 取消事件监听器
   * @param event - 事件名称
   * @param callback - 要取消的回调函数
   */
  off(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * 触发事件
   * @param event - 事件名称
   * @param data - 事件载荷
   */
  emit<K extends keyof GameEventPayloadMap>(event: K, data: GameEventPayloadMap[K]): void {
    if (!this.listeners[event]) return;
    for (const callback of this.listeners[event]) {
      try {
        callback(data);
      } catch (e) {
        console.error(`[EventBus] Error in listener for "${event}":`, e);
      }
    }
  }

  /**
   * 注册一次性事件监听器
   * 
   * 事件触发一次后自动取消注册
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  /**
   * 按分组注册事件监听器
   * 
   * 便于模块级批量管理，可通过 clearGroup 一次性清除整个分组的监听器。
   * @param groupName - 分组名称（如 store 名称）
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  onGroup(groupName: string, event: string, callback: EventCallback): void {
    if (!this.groups[groupName]) {
      this.groups[groupName] = [];
    }
    this.groups[groupName].push({ event, callback });
    this.on(event, callback);
  }

  /**
   * 清除指定分组的所有事件监听器
   * @param groupName - 分组名称
   */
  clearGroup(groupName: string): void {
    const groupListeners = this.groups[groupName];
    if (!groupListeners) return;

    for (const { event, callback } of groupListeners) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        if (this.listeners[event].length === 0) {
          delete this.listeners[event];
        }
      }
    }
    delete this.groups[groupName];
  }

  /**
   * 清除所有事件监听器
   */
  clearAll(): void {
    this.listeners = {};
    this.groups = {};
  }

  /**
   * 移除指定事件的所有监听器
   * @param event - 事件名称
   */
  removeEvent(event: string): void {
    delete this.listeners[event];
  }
}

/**
 * 游戏事件枚举
 * 
 * 定义游戏中所有事件类型，分为以下几类：
 * 1. 角色相关事件（CHARACTER_*）
 * 2. 战斗相关事件（COMBAT_*）
 * 3. 探索相关事件（EXPLORATION_*）
 * 4. 区域相关事件（ZONE_*）
 * 5. 商店相关事件（SHOP_*）
 * 6. 任务相关事件（QUEST_*）
 * 7. 背包/装备相关事件（INVENTORY_*, EQUIPMENT_*）
 * 8. 技能相关事件（SKILL_*）
 * 9. 游戏数据事件（GAME_DATA_*）
 */
export enum GameEvents {
  // ==================== 角色（仅保留 UI/音效事件） ====================
  /** 角色创建成功（UI 刷新角色列表） */
  CHARACTER_CREATED = 'character_created',
  /** 角色被删除（UI 刷新角色列表） */
  CHARACTER_DELETED = 'character_deleted',
  /** 角色登出 */
  CHARACTER_LOGOUT = 'character_logout',
  /** 角色升级（UI 动画 + 音效） */
  CHARACTER_LEVEL_UP = 'character_level_up',
  /** 角色死亡（UI 死亡画面 + 音效） */
  CHARACTER_DEATH = 'character_death',
  /** 角色复活（UI 动画 + 音效） */
  CHARACTER_RESURRECTED = 'character_resurrected',

  // ==================== 战斗 ====================
  /** 战斗开始（UI 进入战斗界面 + 音效） */
  COMBAT_START = 'combat_start',
  /** 战斗结束 */
  COMBAT_END = 'combat_end',
  /** 玩家回合开始 */
  COMBAT_PLAYER_TURN = 'combat_player_turn',
  /** 敌人回合开始 */
  COMBAT_ENEMY_TURN = 'combat_enemy_turn',

  // ==================== 战斗——伤害/治疗类型（用于音效和动画） ====================
  /** 造成伤害（用于区分物伤/魔伤音效） */
  COMBAT_DEAL_DAMAGE = 'combat_deal_damage',
  /** 施放治疗（用于区分血量/法力回复音效） */
  COMBAT_CAST_HEAL = 'combat_cast_heal',
  /** 暴击（用于触发视觉特效和音效） */
  COMBAT_CRITICAL_HIT = 'combat_critical_hit',
  /** 闪避（用于触发闪避文字和音效） */
  COMBAT_DODGE = 'combat_dodge',

  // ==================== 探索 ====================
  /** 探索开始 */
  EXPLORATION_START = 'exploration_start',
  /** 探索结束 */
  EXPLORATION_END = 'exploration_end',
  /** 探索：格子被探索 */
  EXPLORATION_CELL_EXPLORED = 'exploration_cell_explored',
  /** 探索：触发战斗 */
  EXPLORATION_BATTLE_TRIGGERED = 'exploration_battle_triggered',
  /** 探索：使用营地 */
  EXPLORATION_CAMP_USED = 'exploration_camp_used',
  /** 探索：发现物品 */
  EXPLORATION_ITEM_FOUND = 'exploration_item_found',
  /** 探索：触发陷阱 */
  EXPLORATION_TRAP_TRIGGERED = 'exploration_trap_triggered',
  /** 探索：随机事件 */
  EXPLORATION_RANDOM_EVENT = 'exploration_random_event',

  // ==================== 区域 ====================
  /** 进入区域 */
  ZONE_ENTERED = 'zone_entered',

  // ==================== 商店 ====================
  /** 商店打开 */
  SHOP_OPENED = 'shop_opened',
  /** 商店交易 */
  SHOP_TRANSACTION = 'shop_transaction',
  /** 商店关闭 */
  SHOP_CLOSED = 'shop_closed',

  // ==================== 任务（仅保留 UI 通知事件） ====================
  /** 任务公告板打开 */
  QUEST_BOARD_OPENED = 'quest_board_opened',
  /** 任务接取 */
  QUEST_ACCEPTED = 'quest_accepted',
  /** 任务完成 */
  QUEST_COMPLETED = 'quest_completed',
  /** 任务奖励可用 */
  QUEST_REWARDED = 'quest_rewarded',

  // ==================== 技能（仅保留 UI/音效事件） ====================
  /** 技能学习 */
  SKILL_LEARNED = 'skill_learned',
  /** 技能施放 */
  SKILL_CAST = 'skill_cast',

  // ==================== 游戏数据 ====================
  /** 游戏数据更新（阵营/种族/职业配置变更） */
  GAME_DATA_UPDATED = 'game_data_updated',
  
  // ==================== 日志 ====================
  /** 日志条目添加 */
  LOG_ENTRY_ADDED = 'log_entry_added',

  // ==================== UI ====================
  /** UI 面板打开 */
  UI_PANEL_OPENED = 'ui_panel_opened',
  /** UI 面板关闭 */
  UI_PANEL_CLOSED = 'ui_panel_closed',
  /** UI 通用点击 */
  UI_CLICK = 'ui_click',
  /** 确认弹窗 - 确认 */
  CONFIRM_CONFIRMED = 'confirm_confirmed',
  /** 确认弹窗 - 取消 */
  CONFIRM_CANCELED = 'confirm_canceled',

  // ==================== 物品 ====================
  /** 物品被丢弃 */
  ITEM_DROPPED = 'item_dropped',

  // ==================== 战斗补充 ====================
  /** 跳过回合 */
  COMBAT_SKIP_TURN = 'combat_skip_turn',

  // ==================== 存档 ====================
  /** 存档导出 */
  DATA_EXPORTED = 'data_exported',
  /** 存档导入 */
  DATA_IMPORTED = 'data_imported'
}

/**
 * 事件总线实例
 * 
 * 游戏全局唯一的事件总线，用于组件间通信
 */
export const eventBus = new EventBus();