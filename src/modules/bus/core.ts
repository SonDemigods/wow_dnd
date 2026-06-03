/**
 * 事件总线模块
 * 
 * 提供游戏内事件的发布/订阅机制，用于组件间的解耦通信。
 * 使用单例模式，通过 eventBus 实例对外提供服务。
 * 支持事件分组管理，便于模块级的批量注册与清理。
 */

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
  // 角色
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
  // 战斗
  [GameEvents.COMBAT_START]: { enemy: import('../enemy/types').Enemy };
  [GameEvents.COMBAT_END]: { result: string; enemy: import('../enemy/types').Enemy | null; expGained: number };
  [GameEvents.COMBAT_PLAYER_TURN]: null;
  [GameEvents.COMBAT_ENEMY_TURN]: null;
  // 探索
  [GameEvents.EXPLORATION_START]: { characterId: string | null; areaId?: string };
  [GameEvents.EXPLORATION_END]: { characterId: string | null };
  [GameEvents.EXPLORATION_CELL_EXPLORED]: { characterId: string | null; x: number; y: number; cellType?: string; interactionId?: string };
  [GameEvents.EXPLORATION_BATTLE_TRIGGERED]: { characterId: string | null; eventData: { monsterId: string } };
  [GameEvents.EXPLORATION_CAMP_USED]: { characterId: string | null };
  // 区域
  [GameEvents.ZONE_ENTERED]: { locationId: string; location: import('../map/types').LocationData };
  // 商店
  [GameEvents.SHOP_OPENED]: { characterId?: string; shopId: string };
  [GameEvents.SHOP_REFRESHED]: { shopId: string };
  [GameEvents.SHOP_TRANSACTION]: { shopId?: string; itemId: string; quantity?: number; totalPrice?: number; sellPrice?: number };
  // 任务
  [GameEvents.QUEST_BOARD_OPENED]: { characterId?: string; boardId: string };
  [GameEvents.QUEST_ACCEPTED]: { questId: string; definition: any };
  [GameEvents.QUEST_PROGRESS]: { questId: string };
  [GameEvents.QUEST_COMPLETED]: { questId: string; definition: any };
  [GameEvents.QUEST_REWARDED]: { questId: string; definition: any };
  // 背包/装备
  [GameEvents.INVENTORY_CHANGE]: { characterId?: string; itemId: string; count?: number };
  [GameEvents.EQUIPMENT_CHANGE]: { slot: string; item: any };
  // 技能
  [GameEvents.SKILL_LEARNED]: { skill: any };
  [GameEvents.SKILL_CAST]: { skill: any; success: boolean };
  [GameEvents.SKILL_BAR_UPDATE]: { skillId?: string; slotIndex?: number; slots?: any[] };
  // 游戏数据
  [GameEvents.GAME_DATA_UPDATED]: { type: string; action: string; id: string };
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
  /** 角色创建成功 */
  CHARACTER_CREATED = 'character_created',
  /** 角色被选中 */
  CHARACTER_SELECTED = 'character_selected',
  /** 角色被删除 */
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

  // ==================== 战斗 ====================
  /** 战斗开始 */
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

  // ==================== 区域 ====================
  /** 进入区域 */
  ZONE_ENTERED = 'zone_entered',

  // ==================== 商店 ====================
  /** 商店打开 */
  SHOP_OPENED = 'shop_opened',
  /** 商店交易 */
  SHOP_TRANSACTION = 'shop_transaction',
  /** 商店刷新 */
  SHOP_REFRESHED = 'shop_refreshed',

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

  // ==================== 背包/装备 ====================
  /** 背包变化 */
  INVENTORY_CHANGE = 'inventory_change',
  /** 装备变化 */
  EQUIPMENT_CHANGE = 'equipment_change',

  // ==================== 技能 ====================
  /** 技能学习 */
  SKILL_LEARNED = 'skill_learned',
  /** 技能施放 */
  SKILL_CAST = 'skill_cast',
  /** 技能栏更新 */
  SKILL_BAR_UPDATE = 'skill_bar_update',

  // ==================== 游戏数据 ====================
  /** 游戏数据更新（阵营/种族/职业配置变更） */
  GAME_DATA_UPDATED = 'game_data_updated'
}

/**
 * 事件总线实例
 * 
 * 游戏全局唯一的事件总线，用于组件间通信
 */
export const eventBus = new EventBus();