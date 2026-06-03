/**
 * 敌人模块服务层
 *
 * 提供敌人管理的核心业务逻辑，包括创建、查找、伤害计算等
 */
import type { Enemy, EnemyInstance, EnemyStats, EnemyDrop } from './types';
import { ENEMIES } from '../../data/enemy.data';

/**
 * 敌人服务实现类
 */
export class EnemyService {
  /** 活跃的敌人实例映射表 */
  private enemies: Map<string, Enemy> = new Map();

  /**
   * 创建敌人实例
   * @param dataId - 敌人数据ID（对应 ENEMIES 中的 key）
   * @param level - 敌人等级，默认为 1
   * @returns 创建的敌人实例
   */
  createEnemy(dataId: string, level: number = 1): Enemy {
    const data = ENEMIES[dataId];
    if (!data) {
      throw new Error(`Enemy data not found: ${dataId}`);
    }

    const id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 根据基础数据推导属性
    const stats: EnemyStats = {
      str: Math.floor((data.physicalAttack || 10) * 0.8),
      dex: Math.floor((data.dodgeChance || 5) * 1.5),
      con: Math.floor(data.maxHp * 0.3),
      int: Math.floor((data.magicAttack || 5) * 0.8),
      wis: Math.floor((data.magicDefense || 5) * 1.2),
      cha: 5
    };

    // 根据等级缩放属性
    const levelScale = 1 + (level - 1) * 0.1;
    const scaledHp = Math.floor(data.maxHp * levelScale);

    const expReward = Math.floor(data.xp * levelScale);
    const goldReward = Math.floor(data.gold * levelScale);

    // 默认掉落配置
    const drops: EnemyDrop[] = [
      { itemId: 'gold', minAmount: Math.floor(data.gold * 0.5), maxAmount: data.gold, dropRate: 1.0 }
    ];

    const enemy: EnemyInstance = {
      ...data,
      id,
      level,
      hp: scaledHp,
      maxHp: scaledHp,
      loot: [],
      stats,
      expReward,
      goldReward,
      drops
    };

    this.enemies.set(id, enemy);
    return enemy;
  }

  /**
   * 根据ID获取敌人实例
   * @param id - 敌人实例ID
   * @returns 敌人实例，如果不存在返回 null
   */
  getEnemyById(id: string): Enemy | null {
    return this.enemies.get(id) || null;
  }

  /**
   * 对敌人造成伤害
   * @param id - 敌人实例ID
   * @param damage - 伤害值
   * @returns 敌人是否死亡（hp <= 0）
   */
  takeDamage(id: string, damage: number): boolean {
    const enemy = this.enemies.get(id);
    if (!enemy) return false;

    enemy.hp = Math.max(0, enemy.hp - damage);
    return enemy.hp <= 0;
  }

  /**
   * 获取敌人可用技能列表
   * @param id - 敌人实例ID
   * @returns 可用技能列表
   */
  getAvailableSkills(id: string): { id: string; name: string }[] {
    const enemy = this.enemies.get(id);
    if (!enemy) return [];

    // 基于敌人类型返回技能，暂返回空数组
    return [];
  }

  /**
   * 敌人使用技能
   * @param id - 敌人实例ID
   * @param skillId - 技能ID
   * @returns 技能使用结果
   */
  useSkill(id: string, _skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    const enemy = this.enemies.get(id);
    if (!enemy) {
      return { success: false, damage: 0, isHeal: false };
    }

    // 默认技能实现
    return { success: true, damage: 0, isHeal: false };
  }

  /**
   * 计算敌人对玩家造成的伤害
   * @param enemy - 敌人实例
   * @param defense - 玩家防御值
   * @returns 计算后的伤害值
   */
  calculateDamage(enemy: Enemy, defense: number): number {
    const baseDamage = enemy.physicalAttack || enemy.stats.str;
    const damageRange = enemy.damage;
    const randomFactor = damageRange[0] + Math.random() * (damageRange[1] - damageRange[0]);
    const rawDamage = (baseDamage + randomFactor) * 0.5;
    const mitigated = Math.max(1, rawDamage - defense * 0.3);
    return Math.floor(mitigated);
  }

  /**
   * 删除敌人实例
   * @param id - 敌人实例ID
   */
  deleteEnemy(id: string): void {
    this.enemies.delete(id);
  }
}

/**
 * 敌人服务单例
 */
export const enemyService = new EnemyService();
