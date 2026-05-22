import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';
import { inventoryService } from '@/modules/inventory.module';
import { skillsService } from '@/modules/skills.module';

export interface InventoryItem {
  itemId: string;
  count: number;
}

export interface EnemyData {
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: string;
  isBoss?: boolean;
  physicalAttack?: number;
  physicalDefense?: number;
  magicAttack?: number;
  magicDefense?: number;
  critChance?: number;
  dodgeChance?: number;
}

export interface EnemyInstance extends EnemyData {
  id: string;
  level: number;
  hp: number;
  loot: InventoryItem[];
}

export type CombatState = 'idle' | 'preparing' | 'fighting' | 'ended';

export type CombatResult = 'victory' | 'defeat' | 'fled';

export type CombatActionType = 'attack' | 'item' | 'flee' | 'skill';

export interface CombatAction {
  type: CombatActionType;
  itemId?: string;
  skillId?: string;
  target?: 'player' | 'enemy';
}

export interface CombatActionResult {
  success: boolean;
  type: CombatActionType;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  message: string;
}

export interface CombatDamageEvent {
  action: CombatActionType;
  target: 'player' | 'enemy';
  amount: number;
  isCrit: boolean;
  isDodge: boolean;
}

export interface CombatStartEvent {
  enemy: EnemyInstance;
}

export interface CombatEndEvent {
  result: CombatResult;
  enemy: EnemyInstance;
  expGained: number;
  loot?: InventoryItem[];
}

export interface CombatLog {
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: 'player' | 'enemy' | 'system';
  actorId: string;
  actorName: string;
  eventType: CombatEventType;
  targetType?: 'player' | 'enemy';
  targetId?: string;
  targetName?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  heal?: number;
  isCrit: boolean;
  isDodge: boolean;
  isBlocked: boolean;
  message: string;
}

export type CombatEventType = 
  | 'combat_start' | 'combat_end' | 'combat_turn_start' | 'combat_turn_end'
  | 'combat_player_action' | 'combat_enemy_action' | 'combat_damage' | 'combat_heal'
  | 'combat_skill_cast' | 'combat_item' | 'combat_flee' | 'combat_miss'
  | 'combat_critical' | 'combat_death';

export interface SkillCombatEffect {
  skillId: string;
  skillName: string;
  effectType: SkillType;
  targetType: 'self' | 'enemy';
  damage?: {
    base: number;
    minMultiplier: number;
    maxMultiplier: number;
    type: 'physical' | 'magic' | 'true';
  };
  heal?: {
    base: number;
    multiplier: number;
  };
  manaCost: number;
}

export type SkillType = 'physical_damage' | 'magic_damage' | 'heal';

export interface SkillCastResult {
  success: boolean;
  skillId: string;
  skillName: string;
  damage?: number;
  heal?: number;
  message: string;
}

export interface CombatLogStorage {
  id: string;
  combatHistory: CombatLog[];
  maxHistoryCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ICombatService {
  getState(): CombatState;
  getEnemy(): EnemyInstance | null;
  getTurn(): 'player' | 'enemy';
  startCombat(enemy: EnemyInstance): void;
  playerAction(action: CombatAction): CombatActionResult;
  enemyTurn(): void;
  endCombat(result: CombatResult): void;
  isInCombat(): boolean;
  getCombatLog(): CombatLog[];
  castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult;
}

export const useCombatStore = defineStore('combat', () => {
  const state = ref<CombatState>('idle');
  const turn = ref<'player' | 'enemy'>('player');
  const enemy = ref<EnemyInstance | null>(null);
  const combatLog = ref<CombatLog[]>([]);
  const currentTurn = ref(0);
  const combatId = ref<string>('');

  const isInCombatState = computed(() => state.value === 'fighting' || state.value === 'preparing');

  function generateId(): string {
    return 'combat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function addLog(
    actorType: 'player' | 'enemy' | 'system',
    actorId: string,
    actorName: string,
    eventType: CombatEventType,
    data: Partial<CombatLog>
  ) {
    const log: CombatLog = {
      combatId: combatId.value,
      battleLogId: generateId(),
      timestamp: Date.now(),
      turn: currentTurn.value,
      actorType,
      actorId,
      actorName,
      eventType,
      isCrit: false,
      isDodge: false,
      isBlocked: false,
      message: '',
      ...data
    };
    combatLog.value.push(log);
  }

  function startCombat(enemyInstance: EnemyInstance) {
    combatId.value = generateId();
    enemy.value = { ...enemyInstance, hp: enemyInstance.maxHp };
    state.value = 'preparing';
    combatLog.value = [];
    currentTurn.value = 1;
    turn.value = 'player';

    addLog('system', 'system', '系统', 'combat_start', {
      message: `\u6218\u6597\u5F00\u59CB\uFF01\u906D\u9047\u4E86 ${enemy.value.name}！`
    });

    setTimeout(() => {
      state.value = 'fighting';
      eventBus.emit(GameEvents.COMBAT_START, { enemy: enemy.value });
    }, 500);
  }

  function playerAction(action: CombatAction): CombatActionResult {
    if (state.value !== 'fighting' || turn.value !== 'player') {
      return { success: false, type: action.type, message: '不是你的回合！' };
    }

    switch (action.type) {
      case 'attack':
        return playerAttack();
      case 'item':
        return useItem(action.itemId!);
      case 'flee':
        return attemptFlee();
      case 'skill':
        const result = castSkill(action.skillId!, 'enemy');
        if (result.success) {
          endPlayerTurn();
        }
        return {
          success: result.success,
          type: 'skill',
          damage: result.damage,
          heal: result.heal,
          message: result.message
        };
      default:
        return { success: false, type: action.type, message: '未知操作' };
    }
  }

  function playerAttack(): CombatActionResult {
    if (!enemy.value) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }

    const attributes = characterService.getAttributes();
    const baseDamage = attributes.physicalAttack + Math.floor(Math.random() * 11);
    const isCrit = Math.random() * 100 < attributes.critChance;
    let damage = isCrit ? Math.floor(baseDamage * 1.5) : baseDamage;

    const enemyDef = enemy.value.physicalDefense || 0;
    const defenseReduction = Math.min(damage * 0.3, enemyDef);
    damage = Math.max(1, damage - defenseReduction);

    enemy.value.hp -= damage;

    const message = isCrit 
      ? `\u66B4\u51FB\uFF01\u5BF9 ${enemy.value.name} 造成了 ${damage} 点暴击伤害！`
      : `\u5BF9 ${enemy.value.name} 造成了 ${damage} 点伤害！`;

    addLog('player', 'player', characterService.getName(), 'combat_damage', {
      targetType: 'enemy',
      targetId: enemy.value.id,
      targetName: enemy.value.name,
      damage,
      isCrit,
      isDodge: false,
      message
    });

    if (enemy.value.hp <= 0) {
      handleCombatEnd('victory');
      return { success: true, type: 'attack', damage, isCrit, message };
    }

    endPlayerTurn();
    return { success: true, type: 'attack', damage, isCrit, message };
  }

  function useItem(itemId: string): CombatActionResult {
    const items = inventoryService.getInventory();
    const itemIndex = items.findIndex(i => i.itemId === itemId);
    
    if (itemIndex === -1) {
      return { success: false, type: 'item', message: '物品不存在！' };
    }

    const itemData = getItemData(itemId);
    if (!itemData || !itemData.consumable) {
      return { success: false, type: 'item', message: '该物品不可使用！' };
    }

    let healAmount = 0;
    let mpRestore = 0;

    if (itemData.hpRestore) {
      healAmount = itemData.hpRestore;
      characterService.addHp(healAmount);
    }
    if (itemData.mpRestore) {
      mpRestore = itemData.mpRestore;
      characterService.addMp(mpRestore);
    }

    inventoryService.removeItem(itemIndex);

    const message = mpRestore > 0 && healAmount > 0
      ? `\u4F7F\u7528\u4E86 ${itemData.name}\uFF0C\u6062\u590D\u4E86 ${healAmount} HP\u548C ${mpRestore} MP！`
      : healAmount > 0
        ? `\u4F7F\u7528\u4E86 ${itemData.name}\uFF0C\u6062\u590D\u4E86 ${healAmount} HP！`
        : `\u4F7F\u7528\u4E86 ${itemData.name}\uFF0C\u6062\u590D\u4E86 ${mpRestore} MP！`;

    addLog('player', 'player', characterService.getName(), 'combat_item', {
      skillName: itemData.name,
      heal: healAmount || mpRestore,
      isCrit: false,
      isDodge: false,
      message
    });

    endPlayerTurn();
    return { success: true, type: 'item', heal: healAmount || mpRestore, message };
  }

  function attemptFlee(): CombatActionResult {
    const success = Math.random() < 0.5;

    if (success) {
      addLog('player', 'player', characterService.getName(), 'combat_flee', {
        message: '成功逃跑！'
      });
      handleCombatEnd('fled');
      return { success: true, type: 'flee', message: '成功逃跑！' };
    } else {
      addLog('player', 'player', characterService.getName(), 'combat_flee', {
        message: '逃跑失败！'
      });
      endPlayerTurn();
      return { success: true, type: 'flee', message: '逃跑失败！' };
    }
  }

  function castSkill(skillId: string, _targetType: 'self' | 'enemy'): SkillCastResult {
    const skill = skillsService.getSkill(skillId);
    if (!skill) {
      return { success: false, skillId, skillName: '', message: '技能不存在！' };
    }

    const currentMp = characterService.getCharacterInfo().currentMp ?? characterService.getAttributes().maxMana;
    if (currentMp < skill.mpCost) {
      return { success: false, skillId, skillName: skill.name, message: '魔法值不足！' };
    }

    characterService.addMp(-skill.mpCost);

    if (skill.type === 'heal') {
      const healAmount = skill.effect.value;
      characterService.addHp(healAmount);
      
      addLog('player', 'player', characterService.getName(), 'combat_skill_cast', {
        skillId,
        skillName: skill.name,
        heal: healAmount,
        isCrit: false,
        isDodge: false,
        message: `\u91CA\u653E\u3010${skill.name}\u3011\uFF0C\u6062\u590D\u4E86 ${healAmount} HP！`
      });

      return { success: true, skillId, skillName: skill.name, heal: healAmount, message: `\u91CA\u653E\u3010${skill.name}\u3011\uFF0C\u6062\u590D\u4E86 ${healAmount} HP！` };
    }

    if (!enemy.value) {
      return { success: false, skillId, skillName: skill.name, message: '没有敌人！' };
    }

    const attributes = characterService.getAttributes();
    const attack = skill.type === 'physical_damage' ? attributes.physicalAttack : attributes.magicAttack;
    const baseDamage = attack + skill.effect.value + Math.floor(Math.random() * 11);
    const isCrit = Math.random() * 100 < attributes.critChance;
    let damage = isCrit ? Math.floor(baseDamage * 1.5) : baseDamage;

    const enemyDef = skill.type === 'physical_damage' 
      ? (enemy.value.physicalDefense || 0) 
      : (enemy.value.magicDefense || 0);
    const defenseReduction = Math.min(damage * 0.3, enemyDef);
    damage = Math.max(1, damage - defenseReduction);

    enemy.value.hp -= damage;

    const message = isCrit
      ? `\u91CA\u653E\u3010${skill.name}\u3011\uFF01\u5BF9 ${enemy.value.name} 造成了 ${damage} 点暴击伤害！`
      : `\u91CA\u653E\u3010${skill.name}\u3011\uFF0C\u5BF9 ${enemy.value.name} 造成了 ${damage} 点伤害！`;

    addLog('player', 'player', characterService.getName(), 'combat_skill_cast', {
      skillId,
      skillName: skill.name,
      targetType: 'enemy',
      targetId: enemy.value.id,
      targetName: enemy.value.name,
      damage,
      isCrit,
      isDodge: false,
      message
    });

    if (enemy.value.hp <= 0) {
      handleCombatEnd('victory');
    }

    return { success: true, skillId, skillName: skill.name, damage, message };
  }

  function endPlayerTurn() {
    turn.value = 'enemy';
    setTimeout(() => {
      enemyTurn();
    }, 800);
  }

  function enemyTurn() {
    if (state.value !== 'fighting' || !enemy.value) return;

    const attributes = characterService.getAttributes();
    const enemyAtk = enemy.value.physicalAttack || enemy.value.damage[0] + Math.floor(Math.random() * (enemy.value.damage[1] - enemy.value.damage[0] + 1));
    const isCrit = Math.random() * 100 < (enemy.value.critChance || 5);
    let damage = isCrit ? Math.floor(enemyAtk * 1.5) : enemyAtk;

    const playerDef = attributes.physicalDefense;
    const isDodge = Math.random() * 100 < attributes.dodgeChance;

    if (isDodge) {
      damage = 0;
      addLog('enemy', enemy.value.id, enemy.value.name, 'combat_damage', {
        targetType: 'player',
        targetId: 'player',
        targetName: characterService.getName(),
        damage: 0,
        isCrit: false,
        isDodge: true,
        message: `${enemy.value.name} 的攻击被你闪避了！`
      });
    } else {
      const defenseReduction = Math.min(damage * 0.3, playerDef);
      damage = Math.max(1, damage - defenseReduction);
      
      characterService.addHp(-damage);

      const message = isCrit
        ? `${enemy.value.name} 对你造成了 ${damage} 点暴击伤害！`
        : `${enemy.value.name} 对你造成了 ${damage} 点伤害！`;

      addLog('enemy', enemy.value.id, enemy.value.name, 'combat_damage', {
        targetType: 'player',
        targetId: 'player',
        targetName: characterService.getName(),
        damage,
        isCrit,
        isDodge: false,
        message
      });

      if (characterService.getAttributes().maxHp <= 0 || characterService.getCharacterInfo().currentHp === 0) {
        handleCombatEnd('defeat');
        return;
      }
    }

    currentTurn.value++;
    turn.value = 'player';
  }

  function handleCombatEnd(result: CombatResult) {
    state.value = 'ended';

    if (result === 'victory' && enemy.value) {
      const expGained = enemy.value.xp;
      const goldGained = enemy.value.gold;

      characterService.addExp(expGained);
      characterService.addGold(goldGained);

      if (enemy.value.loot && enemy.value.loot.length > 0) {
        for (const loot of enemy.value.loot) {
          inventoryService.addItem({ id: loot.itemId, count: loot.count } as any);
        }
      }

      addLog('system', 'system', '系统', 'combat_end', {
        message: `\u6218\u6597\u80DC\u5229\uFF01\u83B7\u5F97\u4E86 ${expGained} 经验值和 ${goldGained} 金币！`
      });

      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: enemy.value,
        expGained,
        loot: enemy.value.loot
      });
    } else if (result === 'defeat') {
      addLog('system', 'system', '系统', 'combat_end', {
        message: '战斗失败...'
      });
      
      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: enemy.value!,
        expGained: 0
      });
    } else {
      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: enemy.value!,
        expGained: 0
      });
    }
  }

  function endCombat(result: CombatResult) {
    handleCombatEnd(result);
  }

  function getState(): CombatState {
    return state.value;
  }

  function getEnemy(): EnemyInstance | null {
    return enemy.value;
  }

  function getTurn(): 'player' | 'enemy' {
    return turn.value;
  }

  function isInCombat(): boolean {
    return isInCombatState.value;
  }

  function getCombatLog(): CombatLog[] {
    return combatLog.value;
  }

  function reset() {
    state.value = 'idle';
    turn.value = 'player';
    enemy.value = null;
    combatLog.value = [];
    currentTurn.value = 0;
    combatId.value = '';
  }

  function getItemData(_itemId: string): any {
    return null;
  }

  return {
    state,
    turn,
    enemy,
    combatLog,
    currentTurn,
    combatId,
    isInCombatState,
    startCombat,
    playerAction,
    enemyTurn,
    endCombat,
    getState,
    getEnemy,
    getTurn,
    isInCombat,
    getCombatLog,
    castSkill,
    reset
  };
});

export const combatService: ICombatService = {
  getState: () => useCombatStore().getState(),
  getEnemy: () => useCombatStore().getEnemy(),
  getTurn: () => useCombatStore().getTurn(),
  startCombat: (enemy: EnemyInstance) => useCombatStore().startCombat(enemy),
  playerAction: (action: CombatAction) => useCombatStore().playerAction(action),
  enemyTurn: () => useCombatStore().enemyTurn(),
  endCombat: (result: CombatResult) => useCombatStore().endCombat(result),
  isInCombat: () => useCombatStore().isInCombat(),
  getCombatLog: () => useCombatStore().getCombatLog(),
  castSkill: (skillId: string, targetType: 'self' | 'enemy') => useCombatStore().castSkill(skillId, targetType)
};
