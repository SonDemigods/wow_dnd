/**
 * 战斗模块服务层
 * 
 * 提供战斗管理的核心业务逻辑
 */
import type { 
  ICombatService, 
  CombatState, 
  CombatResult, 
  CombatAction, 
  CombatActionResult, 
  CombatLog,
  CombatEventType,
  SkillCastResult
} from './types';
import type { Enemy } from '../enemy/types';
import { enemyService } from '../enemy/service';
import { characterService } from '../character/service';
import { skillsService } from '../skill/service';
import { inventoryService } from '../inventory/service';
import { combatDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { explorationService } from '../exploration/service';
import { logService } from '../log/service';

/** 战斗服务实现类 */
export class CombatService implements ICombatService {
  /** 当前战斗状态 */
  private state: CombatState = 'idle';
  
  /** 当前敌人 */
  private enemy: Enemy | null = null;
  
  /** 当前回合 */
  private turn: 'player' | 'enemy' = 'player';
  
  /** 当前回合数 */
  private turnCount = 0;
  
  /** 当前战斗ID */
  private combatId = '';
  
  /** 战斗日志 */
  private combatLogs: CombatLog[] = [];

  /** 敌人回合延迟定时器 ID，用于在战斗提前结束时取消 */
  private turnTimerId: ReturnType<typeof setTimeout> | null = null;

  /**
   * 获取战斗状态
   * @returns 战斗状态
   */
  getState(): CombatState {
    return this.state;
  }

  /**
   * 获取敌人
   * @returns 敌人
   */
  getEnemy(): Enemy | null {
    return this.enemy;
  }

  /**
   * 获取当前回合
   * @returns 当前回合
   */
  getTurn(): 'player' | 'enemy' {
    return this.turn;
  }

  /**
   * 获取当前回合数
   * @returns 回合数
   */
  getTurnCount(): number {
    return this.turnCount;
  }

  /**
   * 开始战斗
   * @param enemy - 敌人
   */
  startCombat(enemy: Enemy): void {
    // 创建战斗ID
    this.combatId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 设置战斗状态
    this.state = 'fighting';
    this.enemy = enemy;
    this.turn = 'player';
    this.turnCount = 1;
    this.combatLogs = [];
    
    // 添加战斗开始日志
    this.addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_start',
      message: `战斗开始！你遭遇了 ${enemy.name}！`
    });
    
    // 记录到冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'combat',
      message: `遭遇 ${enemy.name}！`,
      icon: '⚔️'
    });
    
    // 触发战斗开始事件
    eventBus.emit(GameEvents.COMBAT_START, { enemy });
    
    // 保存日志
    this.saveLogs();
  }

  /**
   * 玩家行动
   * @param action - 行动
   * @returns 行动结果
   */
  playerAction(action: CombatAction): CombatActionResult {
    if (this.state !== 'fighting' || this.turn !== 'player') {
      return {
        success: false,
        type: action.type,
        message: '不是你的回合！'
      };
    }
    
    try {
      switch (action.type) {
        case 'attack':
          return this.playerAttack();
        case 'skill':
          if (!action.skillId) {
            return { success: false, type: 'skill', message: '未指定技能！' };
          }
          return this.playerSkill(action.skillId);
        case 'item':
          if (!action.itemId) {
            return { success: false, type: 'item', message: '未指定物品！' };
          }
          return this.playerUseItem(action.itemId);
        case 'flee':
          return this.playerFlee();
        default:
          return { success: false, type: action.type, message: '未知行动类型！' };
      }
    } catch (e) {
      console.error('[CombatService] 玩家行动异常:', e);
      return { success: false, type: action.type, message: '行动执行失败' };
    }
  }

  /**
   * 玩家普通攻击
   * @returns 行动结果
   */
  private playerAttack(): CombatActionResult {
    if (!this.enemy) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }
    
    // 获取角色属性
    const attributes = characterService.getAttributes();
    
    // 检查敌人闪避
    const enemyDodgeChance = (this.enemy.dodgeChance || 0) / 100;
    const isDodge = Math.random() < enemyDodgeChance;
    
    if (isDodge) {
      this.addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterService.getName(),
        eventType: 'combat_miss',
        targetType: 'enemy',
        targetId: this.enemy.id,
        targetName: this.enemy.name,
        isCrit: false,
        isDodge: true,
        message: `${characterService.getName()} 攻击被 ${this.enemy.name} 闪避了！`
      });
      
      this.endPlayerTurn();
      this.saveLogs();
      
      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: `${this.enemy.name} 闪避了你的攻击！`
      };
    }
    
    // 计算伤害（参考设计文档）
    const baseDamage = Math.floor(attributes.physicalAttack * 0.4) + Math.floor(Math.random() * 10);
    const enemyDefense = this.enemy.physicalDefense || 0;
    const defenseReduction = Math.min(Math.floor(baseDamage * 0.3), enemyDefense);
    const rawDamage = Math.max(1, baseDamage - defenseReduction);
    
    // 暴击判定（critChance 是百分比，如 5 表示 5%）
    const critChance = attributes.critChance / 100;
    const isCrit = Math.random() < critChance;
    const critMultiplier = isCrit ? 1.5 : 1;
    const damage = Math.floor(rawDamage * critMultiplier);
    
    // 造成伤害
    const isDead = enemyService.takeDamage(this.enemy.id, damage);
    
    // 更新敌人状态
    this.enemy = enemyService.getEnemyById(this.enemy.id);
    
    // 添加日志
    this.addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterService.getName(),
      eventType: isCrit ? 'combat_critical' : 'combat_damage',
      targetType: 'enemy',
      targetId: this.enemy?.id || '',
      targetName: this.enemy?.name || '',
      damage,
      isCrit,
      isDodge: false,
      message: isCrit 
        ? `${characterService.getName()} 暴击！对 ${this.enemy?.name} 造成 ${damage} 点伤害！`
        : `${characterService.getName()} 对 ${this.enemy?.name} 造成 ${damage} 点伤害！`
    });
    
    // 检查战斗是否结束
    if (isDead || !this.enemy) {
      this.endCombat('victory');
    } else {
      this.endPlayerTurn();
    }
    
    this.saveLogs();
    
    return {
      success: true,
      type: 'attack',
      damage,
      isCrit,
      message: isCrit 
        ? `暴击！造成 ${damage} 点伤害！`
        : `造成 ${damage} 点伤害！`
    };
  }

  /**
   * 玩家使用技能
   * @param skillId - 技能ID
   * @returns 行动结果
   */
  private playerSkill(skillId: string): CombatActionResult {
    const result = skillsService.useSkill(skillId);
    
    if (!result.success) {
      return {
        success: false,
        type: 'skill',
        message: result.message
      };
    }
    
    if (!this.enemy) {
      return { success: false, type: 'skill', message: '没有敌人！' };
    }
    
    // 添加技能施放日志
    const skill = skillsService.getSkill(skillId);
    
    this.addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterService.getName(),
      eventType: 'combat_skill_cast',
      skillId,
      skillName: skill?.name || '',
      isCrit: false,
      isDodge: false,
      message: `${characterService.getName()} 使用了 ${skill?.name || '技能'}！`
    });
    
    // 如果是伤害技能，对敌人造成伤害
    if (result.damage && (result.type === 'physical_damage' || result.type === 'magic_damage')) {
      const isDead = enemyService.takeDamage(this.enemy.id, result.damage);
      this.enemy = enemyService.getEnemyById(this.enemy.id);
      
      this.addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterService.getName(),
        eventType: result.type === 'magic_damage' ? 'combat_skill_cast' : 'combat_damage',
        targetType: 'enemy',
        targetId: this.enemy?.id || '',
        targetName: this.enemy?.name || '',
        skillId,
        skillName: skill?.name || '',
        damage: result.damage,
        isCrit: false,
        isDodge: false,
        message: `${skill?.name || '技能'} 对 ${this.enemy?.name} 造成 ${result.damage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
      });
      
      if (isDead || !this.enemy) {
        this.endCombat('victory');
      } else {
        this.endPlayerTurn();
      }
    } else if (result.heal) {
      // 治疗技能
      this.addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterService.getName(),
        eventType: 'combat_heal',
        skillId,
        skillName: skill?.name || '',
        heal: result.heal,
        isCrit: false,
        isDodge: false,
        message: `${skill?.name || '技能'} 恢复了 ${result.heal} 点生命值！`
      });
      
      this.endPlayerTurn();
    }
    
    this.saveLogs();
    
    return {
      success: true,
      type: 'skill',
      damage: result.damage,
      heal: result.heal,
      message: result.message
    };
  }

  /**
   * 玩家使用物品
   * @param itemId - 物品ID
   * @returns 行动结果
   */
  private playerUseItem(itemId: string): CombatActionResult {
    // 查找物品在背包中的位置
    const inventory = inventoryService.getInventory();
    const itemIndex = inventory.findIndex(item => item.itemId === itemId);
    
    if (itemIndex === -1) {
      return { success: false, type: 'item', message: '物品不在背包中！' };
    }
    
    // 使用物品
    const success = inventoryService.useItem(itemIndex);
    
    if (!success) {
      return { success: false, type: 'item', message: '无法使用该物品！' };
    }
    
    const item = inventoryService.getItemInfo(itemId);
    
    this.addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterService.getName(),
      eventType: 'combat_item',
      isCrit: false,
      isDodge: false,
      message: `${characterService.getName()} 使用了 ${item?.name || '物品'}！`
    });
    
    this.endPlayerTurn();
    this.saveLogs();
    
    return {
      success: true,
      type: 'item',
      message: `使用了 ${item?.name || '物品'}！`
    };
  }

  /**
   * 玩家逃跑
   * @returns 行动结果
   */
  private playerFlee(): CombatActionResult {
    if (!this.enemy || this.enemy.isBoss) {
      return { success: false, type: 'flee', message: '无法从Boss战中逃跑！' };
    }
    
    // 逃跑成功率：基础50% + 敏捷加成
    const stats = characterService.getStats();
    const fleeChance = 0.5 + stats.dex * 0.01;
    const success = Math.random() < fleeChance;
    
    if (success) {
      this.addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterService.getName(),
        eventType: 'combat_flee',
        isCrit: false,
        isDodge: false,
        message: `${characterService.getName()} 成功逃离了战斗！`
      });
      
      this.endCombat('fled');
      this.saveLogs();
      
      return {
        success: true,
        type: 'flee',
        message: '成功逃离了战斗！'
      };
    } else {
      this.addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterService.getName(),
        eventType: 'combat_miss',
        isCrit: false,
        isDodge: false,
        message: `${characterService.getName()} 逃跑失败！`
      });
      
      this.endPlayerTurn();
      this.saveLogs();
      
      return {
        success: false,
        type: 'flee',
        message: '逃跑失败！'
      };
    }
  }

  /**
   * 结束玩家回合
   */
  private endPlayerTurn(): void {
    this.turn = 'enemy';
    
    // 添加回合结束日志
    this.addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_turn_end',
      isCrit: false,
      isDodge: false,
      message: '玩家回合结束'
    });
    
    // 触发敌人回合（保存定时器 ID，用于提前结束时取消）
    this.turnTimerId = setTimeout(() => {
      this.turnTimerId = null;
      this.enemyTurn();
    }, 500);
  }

  /**
   * 跳过玩家回合，切换到敌人回合
   */
  skipTurn(): void {
    if (this.state !== 'fighting' || this.turn !== 'player') {
      return;
    }
    this.turn = 'enemy';

    this.addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterService.getName(),
      eventType: 'combat_turn_end',
      message: `${characterService.getName()} 跳过了回合`
    });
  }

  /**
   * 敌人回合
   */
  enemyTurn(): void {
    if (this.state !== 'fighting' || this.turn !== 'enemy') {
      return;
    }
    
    if (!this.enemy) {
      return;
    }

    try {
      // 触发敌人回合开始事件
      eventBus.emit(GameEvents.COMBAT_ENEMY_TURN, null);

      // 添加回合开始日志
      this.addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_turn_start',
        isCrit: false,
        isDodge: false,
        message: `${this.enemy.name} 的回合`
      });
      
      // 敌人行动
      const actionResult = this.enemyAction();
      
      if (actionResult.success) {
        // 检查玩家是否死亡
        const characterInfo = characterService.getCharacterInfo();
        if (characterInfo.hp <= 0) {
          this.endCombat('defeat');
          this.saveLogs();
          return;
        }
      }
      
      // 结束敌人回合
      this.turn = 'player';
      this.turnCount++;
      
      this.addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_turn_end',
        isCrit: false,
        isDodge: false,
        message: `${this.enemy.name} 的回合结束`
      });
      
      // 触发玩家回合开始事件
      eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
      
      this.saveLogs();
    } catch (e) {
      console.error('[CombatService] 敌人回合异常:', e);
      // 异常时恢复为玩家回合，避免战斗卡死
      this.turn = 'player';
    }
  }

  /**
   * 敌人行动
   */
  private enemyAction(): CombatActionResult {
    if (!this.enemy) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }
    
    // 检查敌人是否有可用技能
    const availableSkills = enemyService.getAvailableSkills(this.enemy.id);
    
    // 决定使用技能还是普通攻击
    const useSkill = availableSkills.length > 0 && Math.random() < 0.3; // 30%几率使用技能
    
    if (useSkill) {
      // 随机选择一个可用技能
      const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
      const result = enemyService.useSkill(this.enemy!.id, skill.id);
      
      if (result.success) {
        if (result.isHeal) {
          // 敌人治疗自己
          this.enemy = enemyService.getEnemyById(this.enemy!.id);
          
          this.addCombatLog({
            actorType: 'enemy',
            actorId: this.enemy.id,
            actorName: this.enemy.name,
            eventType: 'combat_heal',
            skillId: skill.id,
            skillName: skill.name,
            heal: -result.damage, // heal值为负数表示治疗
            isCrit: false,
            isDodge: false,
            message: `${this.enemy.name} 使用 ${skill.name}，恢复了 ${-result.damage} 点生命值！`
          });
          
          return {
            success: true,
            type: 'skill',
            heal: -result.damage,
            message: `${this.enemy.name} 使用了 ${skill.name}！`
          };
        } else {
          // 敌人使用攻击技能
          return this.enemyAttackWithSkill(result.damage, skill);
        }
      }
    }
    
    // 普通攻击
    return this.enemyBasicAttack();
  }

  /**
   * 敌人普通攻击
   */
  private enemyBasicAttack(): CombatActionResult {
    if (!this.enemy) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }
    
    // 计算伤害
    const damage = enemyService.calculateDamage(this.enemy, characterService.getAttributes().physicalDefense);
    
    // 检查玩家闪避（dodgeChance 是百分比，如 3 表示 3%）
    const dodgeChance = characterService.getAttributes().dodgeChance / 100;
    const isDodge = Math.random() < dodgeChance;
    
    if (isDodge) {
      this.addCombatLog({
        actorType: 'enemy',
        actorId: this.enemy.id,
        actorName: this.enemy.name,
        eventType: 'combat_miss',
        targetType: 'player',
        targetId: 'player',
        targetName: characterService.getName(),
        isCrit: false,
        isDodge: true,
        message: `${this.enemy.name} 的攻击被 ${characterService.getName()} 闪避了！`
      });
      
      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: '你闪避了敌人的攻击！'
      };
    }
    
    // 造成伤害
    characterService.addHp(-damage);
    
    const characterInfo = characterService.getCharacterInfo();
    
    this.addCombatLog({
      actorType: 'enemy',
      actorId: this.enemy.id,
      actorName: this.enemy.name,
      eventType: 'combat_damage',
      targetType: 'player',
      targetId: 'player',
      targetName: characterService.getName(),
      damage,
      isCrit: false,
      isDodge: false,
      message: `${this.enemy.name} 对 ${characterService.getName()} 造成 ${damage} 点伤害！`
    });
    
    if (characterInfo.hp <= 0) {
      this.addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_death',
        targetType: 'player',
        targetId: 'player',
        targetName: characterService.getName(),
        isCrit: false,
        isDodge: false,
        message: `${characterService.getName()} 被击败了！`
      });
    }
    
    return {
      success: true,
      type: 'attack',
      damage,
      message: `${this.enemy.name} 对你造成 ${damage} 点伤害！`
    };
  }

  /**
   * 敌人使用技能攻击
   * @param damage - 伤害值
   * @param skill - 技能
   */
  private enemyAttackWithSkill(damage: number, skill: { id: string; name: string }): CombatActionResult {
    if (!this.enemy) {
      return { success: false, type: 'skill', message: '没有敌人！' };
    }
    
    // 检查玩家闪避（dodgeChance 是百分比）
    const dodgeChance = characterService.getAttributes().dodgeChance / 100;
    const isDodge = Math.random() < dodgeChance;
    
    if (isDodge) {
      this.addCombatLog({
        actorType: 'enemy',
        actorId: this.enemy.id,
        actorName: this.enemy.name,
        eventType: 'combat_miss',
        targetType: 'player',
        targetId: 'player',
        targetName: characterService.getName(),
        skillId: skill.id,
        skillName: skill.name,
        isCrit: false,
        isDodge: true,
        message: `${this.enemy.name} 的 ${skill.name} 被 ${characterService.getName()} 闪避了！`
      });
      
      return {
        success: true,
        type: 'skill',
        isDodge: true,
        message: '你闪避了敌人的技能！'
      };
    }
    
    // 造成伤害
    characterService.addHp(-damage);
    
    const characterInfo = characterService.getCharacterInfo();
    
    this.addCombatLog({
      actorType: 'enemy',
      actorId: this.enemy.id,
      actorName: this.enemy.name,
      eventType: 'combat_skill_cast',
      targetType: 'player',
      targetId: 'player',
      targetName: characterService.getName(),
      skillId: skill.id,
      skillName: skill.name,
      damage,
      isCrit: false,
      isDodge: false,
      message: `${this.enemy.name} 使用 ${skill.name}，对 ${characterService.getName()} 造成 ${damage} 点伤害！`
    });
    
    if (characterInfo.hp <= 0) {
      this.addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_death',
        targetType: 'player',
        targetId: 'player',
        targetName: characterService.getName(),
        isCrit: false,
        isDodge: false,
        message: `${characterService.getName()} 被击败了！`
      });
    }
    
    return {
      success: true,
      type: 'skill',
      damage,
      message: `${this.enemy.name} 使用了 ${skill.name}，对你造成 ${damage} 点伤害！`
    };
  }

  /**
   * 结束战斗
   * @param result - 战斗结果
   */
  endCombat(result: CombatResult): void {
    if (!this.enemy) return;
    
    try {
      // 设置战斗状态
      this.state = 'ended';
      
      const expGained = this.enemy.expReward;
      const goldGained = this.enemy.goldReward;
      
      if (result === 'victory') {
        // 胜利：获得经验和金币
        characterService.addExp(expGained);
        characterService.addGold(goldGained);
        
        this.addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: `战斗胜利！获得 ${expGained} 经验值和 ${goldGained} 金币！`
        });
        
        // 记录到冒险日志
        logService.addLog({
          id: logService.generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `击败 ${this.enemy.name}！获得 ${expGained} 经验值和 ${goldGained} 金币`,
          icon: '🏆'
        });
        
        // 处理掉落
        this.handleLoot();
      } else if (result === 'defeat') {
        // 失败：损失经验
        this.addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: '战斗失败！'
        });
        
        // 记录到冒险日志
        logService.addLog({
          id: logService.generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `被 ${this.enemy.name} 击败！`,
          icon: '💀'
        });
        
        // 处理角色死亡
        characterService.handleDeath();
      } else if (result === 'fled') {
        this.addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: '战斗以逃跑结束'
        });
        
        // 记录到冒险日志
        logService.addLog({
          id: logService.generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `从 ${this.enemy.name} 面前逃跑`,
          icon: '🏃'
        });
      }
      
      // 保存日志
      this.saveLogs();
      
      // 通知探索模块战斗结果
      explorationService.onBattleResult(result === 'victory');
      
      // 触发战斗结束事件
      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: this.enemy,
        expGained: result === 'victory' ? expGained : 0
      });
      
      // 清理战斗状态
      this.cleanup();
    } catch (e) {
      console.error('[CombatService] 结束战斗异常:', e);
      // 即使异常也要清理状态，避免卡死
      this.cleanup();
    }
  }

  /**
   * 处理掉落
   */
  private handleLoot(): void {
    if (!this.enemy) return;
    
    // 处理金币掉落
    const goldDrop = this.enemy.drops.find(d => d.itemId === 'gold');
    if (goldDrop) {
      const amount = Math.floor(Math.random() * (goldDrop.maxAmount - goldDrop.minAmount + 1)) + goldDrop.minAmount;
      characterService.addGold(amount);
      
      this.addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_item',
        isCrit: false,
        isDodge: false,
        message: `获得 ${amount} 金币！`
      });
    }
    
    // 处理物品掉落
    this.enemy.drops.forEach(drop => {
      if (drop.itemId !== 'gold' && Math.random() < drop.dropRate) {
        // 从物品模板中获取物品信息
        const itemTemplate = inventoryService.getItemInfo(drop.itemId);
        if (itemTemplate) {
          const amount = Math.floor(Math.random() * (drop.maxAmount - drop.minAmount + 1)) + drop.minAmount;
          const added = inventoryService.addItems(itemTemplate, amount);
          
          if (added > 0) {
            this.addCombatLog({
              actorType: 'system',
              actorId: 'system',
              actorName: '系统',
              eventType: 'combat_item',
              isCrit: false,
              isDodge: false,
              message: `获得 ${itemTemplate.name} x${added}！`
            });
          }
        }
      }
    });
  }

  /**
   * 清理战斗状态
   */
  private cleanup(): void {
    // 取消待执行的敌人回合定时器
    if (this.turnTimerId !== null) {
      clearTimeout(this.turnTimerId);
      this.turnTimerId = null;
    }

    // 清理敌人（如果敌人已死亡）
    if (this.enemy && this.enemy.hp <= 0) {
      enemyService.deleteEnemy(this.enemy.id);
    }
    
    // 重置战斗状态
    this.enemy = null;
    this.turn = 'player';
    this.turnCount = 0;
    this.combatId = '';
    this.combatLogs = [];
  }

  /**
   * 检查是否在战斗中
   * @returns 是否在战斗中
   */
  isInCombat(): boolean {
    return this.state === 'fighting';
  }

  /**
   * 获取战斗日志
   * @returns 战斗日志
   */
  getCombatLog(): CombatLog[] {
    return [...this.combatLogs];
  }

  /**
   * 添加战斗日志
   * @param data - 日志数据
   */
  private addCombatLog(data: Omit<CombatLog, 'combatId' | 'battleLogId' | 'timestamp' | 'turn'>): void {
    const log: CombatLog = {
      combatId: this.combatId,
      battleLogId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      turn: this.turnCount,
      ...data
    };
    
    this.combatLogs.push(log);
  }

  /**
   * 保存战斗日志
   */
  private async saveLogs(): Promise<void> {
    try {
      // 批量写入，减少数据库 IO
      const logsToSave = [...this.combatLogs];
      await Promise.all(logsToSave.map(log => combatDbService.saveCombatLog(log)));
    } catch (e) {
      console.error('[CombatService] 保存战斗日志失败:', e);
    }
  }

  /**
   * 施放技能
   * @param skillId - 技能ID
   * @param targetType - 目标类型
   * @returns 技能施放结果
   */
  castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult {
    const skill = skillsService.getSkill(skillId);
    if (!skill) {
      return {
        success: false,
        skillId,
        skillName: '',
        message: '技能不存在！'
      };
    }
    
    const result = skillsService.useSkill(skillId);
    
    if (!result.success) {
      return {
        success: false,
        skillId,
        skillName: skill.name,
        message: result.message
      };
    }
    
    return {
      success: true,
      skillId,
      skillName: skill.name,
      damage: result.damage,
      heal: result.heal,
      message: result.message
    };
  }

  /**
   * 重置战斗状态
   */
  reset(): void {
    // 取消待执行的敌人回合定时器
    if (this.turnTimerId !== null) {
      clearTimeout(this.turnTimerId);
      this.turnTimerId = null;
    }

    this.state = 'idle';
    this.enemy = null;
    this.turn = 'player';
    this.turnCount = 0;
    this.combatId = '';
    this.combatLogs = [];
  }
}

/**
 * 战斗服务实例
 */
export const combatService = new CombatService();