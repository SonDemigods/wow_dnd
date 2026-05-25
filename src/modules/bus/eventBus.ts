type EventCallback = (...args: any[]) => void;

interface EventListeners {
  [event: string]: EventCallback[];
}

export class EventBus {
  private listeners: EventListeners = {};

  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(...args));
  }

  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  clearAll(): void {
    this.listeners = {};
  }

  removeEvent(event: string): void {
    delete this.listeners[event];
  }
}

export enum GameEvents {
  CHARACTER_CREATED = 'character_created',
  CHARACTER_SELECTED = 'character_selected',
  CHARACTER_DELETED = 'character_deleted',
  CHARACTER_LOGOUT = 'character_logout',
  CHARACTER_LEVEL_UP = 'character_level_up',
  CHARACTER_HP_CHANGE = 'character_hp_change',
  CHARACTER_MP_CHANGE = 'character_mp_change',
  CHARACTER_STATS_CHANGE = 'character_stats_change',
  CHARACTER_DEATH = 'character_death',
  CHARACTER_RESURRECTED = 'character_resurrected',
  
  COMBAT_START = 'combat_start',
  COMBAT_END = 'combat_end',
  COMBAT_TURN_CHANGE = 'combat_turn_change',
  COMBAT_LOG = 'combat_log',
  
  EXPLORATION_START = 'exploration_start',
  EXPLORATION_END = 'exploration_end',
  EXPLORATION_MOVE = 'exploration_move',
  EXPLORATION_EVENT = 'exploration_event',
  EXPLORATION_COMPLETE = 'exploration_complete',
  
  ZONE_UNLOCKED = 'zone_unlocked',
  ZONE_COMPLETED = 'zone_completed',
  ZONE_ENTERED = 'zone_entered',
  
  SHOP_TRANSACTION = 'shop_transaction',
  SHOP_REFRESHED = 'shop_refreshed',
  SHOP_OPENED = 'shop_opened',
  SHOP_CLOSED = 'shop_closed',
  
  QUEST_ACCEPTED = 'quest_accepted',
  QUEST_PROGRESS = 'quest_progress',
  QUEST_COMPLETED = 'quest_completed',
  QUEST_REWARDED = 'quest_rewarded',
  QUEST_REWARD_CLAIMED = 'quest_reward_claimed',
  
  INVENTORY_CHANGE = 'inventory_change',
  INVENTORY_EQUIP = 'inventory_equip',
  INVENTORY_UNEQUIP = 'inventory_unequip',
  INVENTORY_ORGANIZED = 'inventory_organized',
  INVENTORY_UPDATE = 'inventory_update',
  EQUIPMENT_CHANGE = 'equipment_change',
  
  SKILL_LEARNED = 'skill_learned',
  SKILL_UPGRADED = 'skill_upgraded',
  SKILL_CAST = 'skill_cast',
  SKILL_BAR_UPDATE = 'skill_bar_update',
  
  GAME_SAVE = 'game_save',
  GAME_LOAD = 'game_load'
}

export const eventBus = new EventBus();
