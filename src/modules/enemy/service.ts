/**
 * 敌人模块服务层
 * 
 * 提供敌人管理的核心业务逻辑
 */
import type { Enemy, EnemyRarity, EnemyType, EnemySkill, EnemyDrop, EnemyStats } from './types';
import { enemyDbService } from './db';
import { ENEMY_RARITY_CONFIG } from './types';

/**
 * 敌人名称模板
 */
const ENEMY_NAMES: Record<EnemyRarity, string[]> = {
  common: ['哥布林', '骷髅兵', '史莱姆', '蝙蝠', '蜘蛛', '狼人', '哥布林战士', '骷髅弓箭手', '巨型甲虫', '野猪'],
  uncommon: ['精英骷髅', '暗影刺客', '火焰法师', '冰霜巨人', '毒蝎', '石像鬼', '亡灵巫师', '食人魔', '毒蛇', '狼人首领'],
  rare: ['恶魔领主', '巨龙幼崽', '远古树人', '幽灵骑士', '地狱火', '冰霜女王', '暗影领主', '风暴元素', '死亡骑士', '深渊恶魔'],
  epic: ['远古巨龙', '死亡天使', '混沌领主', '虚空行者', '泰坦巨人', '巫妖之王', '火焰魔王', '冰霜巨龙', '暗影大帝', '天界守卫'],
  legendary: ['世界吞噬者', '虚空领主', '创世之神', '毁灭巨龙', '时间行者', '深渊主宰', '圣光天使', '黑暗泰坦', '永恒守护者', '神秘先知']
};

/**
 * 敌人技能模板
 */
const SKILL_TEMPLATES: EnemySkill[] = [
  { id: 'skill_1', name: '普通攻击', description: '基础攻击', damage: 10, manaCost: 0, cooldown: 0, currentCooldown: 0, isAoE: false, isHeal: false },
  { id: 'skill_2', name: '重击', description: '强力一击', damage: 25, manaCost: 10, cooldown: 2, currentCooldown: 0, isAoE: false, isHeal: false },
  { id: 'skill_3', name: '旋风斩', description: '旋转武器攻击周围敌人', damage: 15, manaCost: 15, cooldown: 3, currentCooldown: 0, isAoE: true, isHeal: false },
  { id: 'skill_4', name: '火球术', description: '发射火球造成伤害', damage: 30, manaCost: 20, cooldown: 3, currentCooldown: 0, isAoE: false, isHeal: false },
  { id: 'skill_5', name: '冰霜新星', description: '释放冰霜能量攻击所有敌人', damage: 20, manaCost: 25, cooldown: 4, currentCooldown: 0, isAoE: true, isHeal: false },
  { id: 'skill_6', name: '暗影打击', description: '释放暗影能量', damage: 35, manaCost: 25, cooldown: 4, currentCooldown: 0, isAoE: false, isHeal: false },
  { id: 'skill_7', name: '自我治疗', description: '恢复生命值', damage: -20, manaCost: 30, cooldown: 5, currentCooldown: 0, isAoE: false, isHeal: true },
  { id: 'skill_8', name: '狂暴', description: '进入狂暴状态，攻击力提升', damage: 40, manaCost: 30, cooldown: 5, currentCooldown: 0, isAoE: false, isHeal: false },
  { id: 'skill_9', name: '地震', description: '引发地震攻击所有敌人', damage: 25, manaCost: 40, cooldown: 6, currentCooldown: 0, isAoE: true, isHeal: false },
  { id: 'skill_10', name: '死亡凝视', description: '释放致命的凝视', damage: 50, manaCost: 50, cooldown: 8, currentCooldown: 0, isAoE: false, isHeal: false }
];

/**
 * 敌人服务实现类
 */
export class EnemyService {
  /** 当前战斗中的敌人 */
  private currentEnemies: Map<string, Enemy> = new Map();

  /**
   * 生成唯一敌人ID
   * @returns 敌人ID
   */
  private generateId(): string {
    return `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成随机属性
   * @param level - 等级
   * @param multiplier - 稀有度倍数
   * @returns 属性对象
   */
  private generateStats(level: number, multiplier: number): EnemyStats {
    const base = 8 + level;
    return {
      str: Math.floor((base + Math.floor(Math.random() * 4)) * multiplier),
      dex: Math.floor((base + Math.floor(Math.random() * 4)) * multiplier),
      con: Math.floor((base + Math.floor(Math.random() * 4)) * multiplier),
      int: Math.floor((base + Math.floor(Math.random() * 4)) * multiplier),
      wis: Math.floor((base + Math.floor(Math.random() * 4)) * multiplier),
      cha: Math.floor((base + Math.floor(Math.random() * 4)) * multiplier)
    };
  }

  /**
   * 生成敌人技能
   * @param rarity - 稀有度
   * @returns 技能数组
   */
  private generateSkills(rarity: EnemyRarity): EnemySkill[] {
    const skillCount = rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
    const availableSkills = SKILL_TEMPLATES.slice();
    const selectedSkills: EnemySkill[] = [];
    
    for (let i = 0; i < skillCount; i++) {
      const randomIndex = Math.floor(Math.random() * availableSkills.length);
      const skill = { ...availableSkills[randomIndex], id: `${availableSkills[randomIndex].id}_${Date.now()}` };
      selectedSkills.push(skill);
      availableSkills.splice(randomIndex, 1);
    }
    
    return selectedSkills;
  }

  /**
   * 生成敌人掉落
   * @param rarity - 稀有度
   * @param level - 等级
   * @returns 掉落物品数组
   */
  private generateDrops(rarity: EnemyRarity, level: number): EnemyDrop[] {
    const drops: EnemyDrop[] = [];
    const multiplier = ENEMY_RARITY_CONFIG[rarity].multiplier;
    
    // 基础金币掉落
    drops.push({
      itemId: 'gold',
      dropRate: 1.0,
      minAmount: Math.floor(10 * level * multiplier),
      maxAmount: Math.floor(30 * level * multiplier)
    });
    
    // 随机装备掉落
    if (rarity !== 'common') {
      drops.push({
        itemId: `equipment_${rarity}_${level}`,
        dropRate: rarity === 'legendary' ? 0.3 : rarity === 'epic' ? 0.2 : 0.1,
        minAmount: 1,
        maxAmount: 1
      });
    }
    
    // 药水掉落
    drops.push({
      itemId: 'potion_health_small',
      dropRate: 0.3 * multiplier,
      minAmount: 1,
      maxAmount: 2
    });
    
    return drops;
  }

  /**
   * 生成敌人
   * @param level - 等级
   * @param rarity - 稀有度（可选）
   * @param isBoss - 是否Boss（可选）
   * @returns 敌人对象
   */
  generateEnemy(level: number, rarity?: EnemyRarity, isBoss?: boolean): Enemy {
    // 如果没有指定稀有度，随机选择
    const randomRarity: EnemyRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const selectedRarity = rarity || randomRarity[Math.floor(Math.random() * randomRarity.length)];
    
    const multiplier = ENEMY_RARITY_CONFIG[selectedRarity].multiplier;
    const names = ENEMY_NAMES[selectedRarity];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const stats = this.generateStats(level, multiplier);
    const skills = this.generateSkills(selectedRarity);
    const drops = this.generateDrops(selectedRarity, level);
    
    // Boss加成
    const bossMultiplier = isBoss ? 2 : 1;
    
    const maxHp = Math.floor((50 + stats.con * 5 + level * 10) * multiplier * bossMultiplier);
    const maxMp = Math.floor((20 + stats.int * 3 + level * 5) * multiplier);
    const attackPower = Math.floor((5 + stats.str * 2 + level * 2) * multiplier);
    const defense = Math.floor((2 + stats.dex + level) * multiplier);
    const expReward = Math.floor((100 + level * 20) * multiplier * bossMultiplier);
    const goldReward = Math.floor((20 + level * 10) * multiplier * bossMultiplier);
    
    const enemy: Enemy = {
      id: this.generateId(),
      name: isBoss ? `Boss - ${name}` : name,
      type: isBoss ? 'boss' : 'monster',
      rarity: selectedRarity,
      level,
      stats,
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
      attackPower,
      defense,
      expReward,
      goldReward,
      skills,
      drops,
      isBoss: !!isBoss,
      description: `Lv.${level} ${ENEMY_RARITY_CONFIG[selectedRarity].name}怪物`
    };
    
    // 添加到当前战斗敌人列表
    this.currentEnemies.set(enemy.id, enemy);
    
    return enemy;
  }

  /**
   * 根据ID获取敌人
   * @param enemyId - 敌人ID
   * @returns 敌人对象或null
   */
  getEnemyById(enemyId: string): Enemy | null {
    // 先从战斗缓存中查找
    const cached = this.currentEnemies.get(enemyId);
    if (cached) return cached;
    
    // 从数据库查找
    return null;
  }

  /**
   * 获取所有敌人
   * @returns 敌人数组
   */
  getAllEnemies(): Enemy[] {
    return Array.from(this.currentEnemies.values());
  }

  /**
   * 创建敌人（保存到数据库）
   * @param enemy - 敌人数据（不含ID）
   * @returns 敌人ID
   */
  createEnemy(enemy: Omit<Enemy, 'id'>): string {
    const id = this.generateId();
    const newEnemy: Enemy = { ...enemy, id, hp: enemy.maxHp, mp: enemy.maxMp };
    
    // 添加到缓存
    this.currentEnemies.set(id, newEnemy);
    
    // 保存到数据库
    enemyDbService.saveEnemy(newEnemy);
    
    return id;
  }

  /**
   * 更新敌人
   * @param enemy - 敌人数据
   */
  updateEnemy(enemy: Enemy): void {
    this.currentEnemies.set(enemy.id, enemy);
    enemyDbService.saveEnemy(enemy);
  }

  /**
   * 删除敌人
   * @param enemyId - 敌人ID
   * @returns 是否成功删除
   */
  deleteEnemy(enemyId: string): boolean {
    if (!this.currentEnemies.has(enemyId)) {
      return false;
    }
    
    this.currentEnemies.delete(enemyId);
    enemyDbService.deleteEnemy(enemyId);
    
    return true;
  }

  /**
   * 计算伤害
   * @param enemy - 敌人
   * @param targetDefense - 目标防御
   * @returns 伤害值
   */
  calculateDamage(enemy: Enemy, targetDefense: number): number {
    const baseDamage = enemy.attackPower;
    const defenseReduction = Math.max(0, targetDefense * 0.5);
    const damage = Math.max(1, baseDamage - defenseReduction);
    
    // 暴击判定
    const critChance = enemy.stats.dex * 0.01;
    const isCrit = Math.random() < critChance;
    
    return isCrit ? Math.floor(damage * 1.5) : damage;
  }

  /**
   * 敌人受到伤害
   * @param enemyId - 敌人ID
   * @param damage - 伤害值
   * @returns 是否死亡
   */
  takeDamage(enemyId: string, damage: number): boolean {
    const enemy = this.currentEnemies.get(enemyId);
    if (!enemy) return false;
    
    enemy.hp = Math.max(0, enemy.hp - damage);
    
    // 更新技能冷却
    enemy.skills.forEach(skill => {
      if (skill.currentCooldown > 0) {
        skill.currentCooldown--;
      }
    });
    
    // 如果死亡，从缓存移除
    if (enemy.hp <= 0) {
      this.currentEnemies.delete(enemyId);
      return true;
    }
    
    return false;
  }

  /**
   * 敌人使用技能
   * @param enemyId - 敌人ID
   * @param skillId - 技能ID
   * @returns 结果对象
   */
  useSkill(enemyId: string, skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    const enemy = this.currentEnemies.get(enemyId);
    if (!enemy) {
      return { success: false, damage: 0, isHeal: false };
    }
    
    const skill = enemy.skills.find(s => s.id === skillId);
    if (!skill) {
      return { success: false, damage: 0, isHeal: false };
    }
    
    // 检查冷却和法力值
    if (skill.currentCooldown > 0 || enemy.mp < skill.manaCost) {
      return { success: false, damage: 0, isHeal: skill.isHeal };
    }
    
    // 消耗法力值
    enemy.mp -= skill.manaCost;
    
    // 设置冷却
    skill.currentCooldown = skill.cooldown;
    
    // 如果是治疗技能
    if (skill.isHeal) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp - skill.damage);
      return { success: true, damage: skill.damage, isHeal: true };
    }
    
    // 返回伤害值（应用敌人攻击力加成）
    const finalDamage = Math.floor(skill.damage * (1 + enemy.stats.str * 0.02));
    return { success: true, damage: finalDamage, isHeal: false };
  }

  /**
   * 重置敌人状态
   * @param enemyId - 敌人ID
   */
  resetEnemy(enemyId: string): void {
    const enemy = this.currentEnemies.get(enemyId);
    if (!enemy) return;
    
    enemy.hp = enemy.maxHp;
    enemy.mp = enemy.maxMp;
    enemy.skills.forEach(skill => {
      skill.currentCooldown = 0;
    });
  }

  /**
   * 从数据库加载敌人数据
   */
  async loadEnemiesFromDb(): Promise<void> {
    const enemies = await enemyDbService.getAllEnemies();
    enemies.forEach(enemy => {
      this.currentEnemies.set(enemy.id, enemy);
    });
  }

  /**
   * 获取随机可用技能
   * @param enemyId - 敌人ID
   * @returns 可用技能数组
   */
  getAvailableSkills(enemyId: string): EnemySkill[] {
    const enemy = this.currentEnemies.get(enemyId);
    if (!enemy) return [];
    
    return enemy.skills.filter(skill => skill.currentCooldown === 0 && enemy.mp >= skill.manaCost);
  }

  /**
   * 清理所有战斗中的敌人
   */
  clearAllEnemies(): void {
    this.currentEnemies.clear();
  }
}

/**
 * 敌人服务实例
 */
export const enemyService = new EnemyService();