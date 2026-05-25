/**
 * 事件总线模块
 * 
 * 提供游戏内事件的发布/订阅机制，用于组件间的解耦通信。
 * 使用单例模式，通过 eventBus 实例对外提供服务。
 */

/**
 * 事件回调函数类型
 * @param args - 事件参数
 */
type EventCallback = (...args: any[]) => void;

/**
 * 事件监听器映射接口
 * key: 事件名称
 * value: 该事件的回调函数数组
 */
interface EventListeners {
  [event: string]: EventCallback[];
}

/**
 * 事件总线类
 * 
 * 实现了发布/订阅模式，支持事件的注册、取消注册、触发等操作。
 * 支持一次性事件监听（once）和批量清除（clearAll）。
 */
export class EventBus {
  /** 事件监听器映射表 */
  private listeners: EventListeners = {};

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
   * @param args - 传递给回调函数的参数
   */
  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(...args));
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
   * 清除所有事件监听器
   */
  clearAll(): void {
    this.listeners = {};
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
 * 9. 游戏状态事件（GAME_*）
 */
export enum GameEvents {
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
  
  /** 战斗开始 */
  COMBAT_START = 'combat_start',
  /** 战斗结束 */
  COMBAT_END = 'combat_end',
  /** 战斗回合切换 */
  COMBAT_TURN_CHANGE = 'combat_turn_change',
  /** 战斗日志 */
  COMBAT_LOG = 'combat_log',
  
  /** 探索开始 */
  EXPLORATION_START = 'exploration_start',
  /** 探索结束 */
  EXPLORATION_END = 'exploration_end',
  /** 探索移动 */
  EXPLORATION_MOVE = 'exploration_move',
  /** 探索事件触发 */
  EXPLORATION_EVENT = 'exploration_event',
  /** 探索完成 */
  EXPLORATION_COMPLETE = 'exploration_complete',
  
  /** 区域解锁 */
  ZONE_UNLOCKED = 'zone_unlocked',
  /** 区域完成 */
  ZONE_COMPLETED = 'zone_completed',
  /** 进入区域 */
  ZONE_ENTERED = 'zone_entered',
  
  /** 商店交易 */
  SHOP_TRANSACTION = 'shop_transaction',
  /** 商店刷新 */
  SHOP_REFRESHED = 'shop_refreshed',
  /** 商店打开 */
  SHOP_OPENED = 'shop_opened',
  /** 商店关闭 */
  SHOP_CLOSED = 'shop_closed',
  
  /** 任务接受 */
  QUEST_ACCEPTED = 'quest_accepted',
  /** 任务进度更新 */
  QUEST_PROGRESS = 'quest_progress',
  /** 任务完成 */
  QUEST_COMPLETED = 'quest_completed',
  /** 任务奖励可用 */
  QUEST_REWARDED = 'quest_rewarded',
  /** 任务奖励已领取 */
  QUEST_REWARD_CLAIMED = 'quest_reward_claimed',
  
  /** 背包变化 */
  INVENTORY_CHANGE = 'inventory_change',
  /** 装备装备 */
  INVENTORY_EQUIP = 'inventory_equip',
  /** 卸下装备 */
  INVENTORY_UNEQUIP = 'inventory_unequip',
  /** 背包整理 */
  INVENTORY_ORGANIZED = 'inventory_organized',
  /** 背包更新 */
  INVENTORY_UPDATE = 'inventory_update',
  /** 装备变化 */
  EQUIPMENT_CHANGE = 'equipment_change',
  
  /** 技能学习 */
  SKILL_LEARNED = 'skill_learned',
  /** 技能升级 */
  SKILL_UPGRADED = 'skill_upgraded',
  /** 技能施放 */
  SKILL_CAST = 'skill_cast',
  /** 技能栏更新 */
  SKILL_BAR_UPDATE = 'skill_bar_update',
  
  /** 游戏保存 */
  GAME_SAVE = 'game_save',
  /** 游戏加载 */
  GAME_LOAD = 'game_load'
}

/**
 * 事件总线实例
 * 
 * 游戏全局唯一的事件总线，用于组件间通信
 */
export const eventBus = new EventBus();