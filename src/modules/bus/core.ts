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
import type { EquippedItem } from '../equipment/types';

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
  // ==================== 角色 ====================
  [GameEvents.CHARACTER_CREATED]: { characterId: string; name: string };
  [GameEvents.CHARACTER_SELECTED]: { characterId: string };
  [GameEvents.CHARACTER_DELETED]: { characterId: string };
  [GameEvents.CHARACTER_LOGOUT]: null;
  [GameEvents.CHARACTER_LEVEL_UP]: { oldLevel: number; newLevel: number };
  [GameEvents.CHARACTER_HP_CHANGE]: { oldHp: number; newHp: number; maxHp: number };
  [GameEvents.CHARACTER_MP_CHANGE]: { oldMp: number; newMp: number; maxMp: number };
  [GameEvents.CHARACTER_STATS_CHANGE]: { oldStats: Record<string, number>; newStats: Record<string, number> };
  [GameEvents.CHARACTER_DEATH]: { cause: string };
  [GameEvents.CHARACTER_RESURRECTED]: { newHp: number; newMp: number };
  // 角色——外部请求类事件（其他模块通知角色模块执行数据变更）
  [GameEvents.CHARACTER_TAKE_DAMAGE]: { amount: number; source: string };
  [GameEvents.CHARACTER_RECEIVE_HEAL]: { amount: number; source: string };
  [GameEvents.CHARACTER_RECEIVE_MP]: { amount: number; source: string };
  [GameEvents.CHARACTER_GAIN_EXP]: { amount: number; source: string };
  [GameEvents.CHARACTER_GAIN_GOLD]: { amount: number; source: string };
  [GameEvents.CHARACTER_APPLY_BONUS]: { bonus: Partial<{ str: number; dex: number; int: number; vit: number }> };
  [GameEvents.CHARACTER_REMOVE_BONUS]: { bonus: Partial<{ str: number; dex: number; int: number; vit: number }> };
  // ==================== 战斗 ====================
  [GameEvents.COMBAT_START]: { enemy: Enemy };
  [GameEvents.COMBAT_END]: { result: string; enemy: Enemy | null; expGained: number; goldGained?: number };
  [GameEvents.COMBAT_PLAYER_TURN]: null;
  [GameEvents.COMBAT_ENEMY_TURN]: null;
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
  [GameEvents.SHOP_REFRESHED]: { shopId: string };
  [GameEvents.SHOP_CLOSED]: { shopId?: string };
  [GameEvents.SHOP_TRANSACTION]: { shopId?: string; itemId: string; quantity?: number; totalPrice?: number; sellPrice?: number };
  // ==================== 任务 ====================
  [GameEvents.QUEST_BOARD_OPENED]: { characterId?: string; boardId: string };
  [GameEvents.QUEST_ACCEPTED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_PROGRESS]: { questId: string };
  [GameEvents.QUEST_COMPLETED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_REWARDED]: { questId: string; definition: QuestDefinition };
  // 任务——外部请求类事件
  [GameEvents.QUEST_ENEMY_KILLED]: { enemyId: string };
  // ==================== 背包/装备 ====================
  [GameEvents.INVENTORY_CHANGE]: { characterId?: string; itemId: string; count?: number };
  [GameEvents.EQUIPMENT_CHANGE]: { slot: string; item: EquippedItem };
  // 背包——外部请求类事件
  [GameEvents.INVENTORY_ADD_ITEM]: { itemId: string; quantity: number };
  [GameEvents.INVENTORY_USE_ITEM]: { itemId: string };
  // ==================== 技能 ====================
  [GameEvents.SKILL_LEARNED]: { skill: Skill };
  [GameEvents.SKILL_CAST]: { skill: Skill; success: boolean };
  [GameEvents.SKILL_BAR_UPDATE]: { skillId?: string; slotIndex?: number; slots?: (string | null)[] };
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
  [GameEvents.QUEST_ABANDONED]: { questId: string };
  [GameEvents.SKILL_MEMORIZED]: { skillId: string };
  [GameEvents.SKILL_FORGOTTEN]: { skillId: string };
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
  // ==================== 角色 ====================
  /** 角色创建成功（供 UI 组件监听，刷新角色列表） */
  CHARACTER_CREATED = 'character_created',
  /** 角色被选中（供 UI 和各模块 store 监听以加载角色数据） */
  CHARACTER_SELECTED = 'character_selected',
  /** 角色被删除（供 UI 组件监听，刷新角色列表） */
  CHARACTER_DELETED = 'character_deleted',
  /** 角色登出 */
  CHARACTER_LOGOUT = 'character_logout',
  /** 角色升级 */
  CHARACTER_LEVEL_UP = 'character_level_up',
  /** 角色生命值变化 */
  CHARACTER_HP_CHANGE = 'character_hp_change',
  /** 角色魔法值变化 */
  CHARACTER_MP_CHANGE = 'character_mp_change',
  /** 角色属性变化 */
  CHARACTER_STATS_CHANGE = 'character_stats_change',
  /** 角色死亡 */
  CHARACTER_DEATH = 'character_death',
  /** 角色复活 */
  CHARACTER_RESURRECTED = 'character_resurrected',
  // 角色——外部请求类（其他模块请求角色模块变更数据）
  /** 角色受到伤害 */
  CHARACTER_TAKE_DAMAGE = 'character_take_damage',
  /** 角色获得治疗 */
  CHARACTER_RECEIVE_HEAL = 'character_receive_heal',
  /** 角色魔力变化 */
  CHARACTER_RECEIVE_MP = 'character_receive_mp',
  /** 角色获得经验 */
  CHARACTER_GAIN_EXP = 'character_gain_exp',
  /** 角色获得金币 */
  CHARACTER_GAIN_GOLD = 'character_gain_gold',
  /** 角色应用属性加成 */
  CHARACTER_APPLY_BONUS = 'character_apply_bonus',
  /** 角色移除属性加成 */
  CHARACTER_REMOVE_BONUS = 'character_remove_bonus',

  // ==================== 战斗 ====================
  /** 战斗开始（供 UI 组件监听，进入战斗界面） */
  COMBAT_START = 'combat_start',
  /** 战斗结束 */
  COMBAT_END = 'combat_end',
  /** 玩家回合开始 */
  COMBAT_PLAYER_TURN = 'combat_player_turn',
  /** 敌人回合开始 */
  COMBAT_ENEMY_TURN = 'combat_enemy_turn',

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
  /** 商店刷新（供 UI 组件监听，刷新商品列表） */
  SHOP_REFRESHED = 'shop_refreshed',
  /** 商店关闭 */
  SHOP_CLOSED = 'shop_closed',

  // ==================== 任务 ====================
  /** 任务公告板打开（探索中与公告板交互） */
  QUEST_BOARD_OPENED = 'quest_board_opened',
  /** 任务接取（玩家确认接取任务） */
  QUEST_ACCEPTED = 'quest_accepted',
  /** 任务进度更新 */
  QUEST_PROGRESS = 'quest_progress',
  /** 任务完成 */
  QUEST_COMPLETED = 'quest_completed',
  /** 任务奖励可用 */
  QUEST_REWARDED = 'quest_rewarded',
  // 任务——外部请求类
  /** 敌人被击杀通知任务模块 */
  QUEST_ENEMY_KILLED = 'quest_enemy_killed',

  // ==================== 背包/装备 ====================
  /** 背包变化 */
  INVENTORY_CHANGE = 'inventory_change',
  /** 装备变化（供 UI 组件监听，更新装备显示） */
  EQUIPMENT_CHANGE = 'equipment_change',
  // 背包——外部请求类
  /** 添加物品到背包 */
  INVENTORY_ADD_ITEM = 'inventory_add_item',
  /** 在战斗中使用物品 */
  INVENTORY_USE_ITEM = 'inventory_use_item',

  // ==================== 技能 ====================
  /** 技能学习 */
  SKILL_LEARNED = 'skill_learned',
  /** 技能施放 */
  SKILL_CAST = 'skill_cast',
  /** 技能栏更新 */
  SKILL_BAR_UPDATE = 'skill_bar_update',

  // ==================== 游戏数据 ====================
  /** 游戏数据更新（阵营/种族/职业配置变更） */
  GAME_DATA_UPDATED = 'game_data_updated',
  
  // ==================== 日志 ====================
  /** 日志条目添加（其他模块可通过此事件通知日志模块记录） */
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

  // ==================== 任务补充 ====================
  /** 放弃任务 */
  QUEST_ABANDONED = 'quest_abandoned',

  // ==================== 技能补充 ====================
  /** 技能记忆到技能栏 */
  SKILL_MEMORIZED = 'skill_memorized',
  /** 技能从技能栏遗忘 */
  SKILL_FORGOTTEN = 'skill_forgotten',

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