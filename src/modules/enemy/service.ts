/**
 * 敌人模块纯逻辑函数
 *
 * 提供敌人属性推导、伤害计算、实例创建等纯函数，不含状态和副作用
 */
import type { Enemy, EnemyInstance, EnemyDrop } from './types';
import type { Stats } from '../character/types';
import type { EnemyData } from './types';

/**
 * 根据模板和等级推导敌人属性统计
 * @param template - 敌人模板数据
 * @param level - 敌人等级
 * @returns 推导的属性统计与缩放后的生命值、奖励
 */
export function generateEnemyStats(
  template: EnemyData,
  level: number
): { stats: Stats; hp: number; maxHp: number; expReward: number; goldReward: number } {
  const stats: Stats = {
    str: Math.floor((template.physicalAttack || 10) * 0.8),
    dex: Math.floor((template.dodgeChance || 5) * 1.5),
    con: Math.floor(template.maxHp * 0.3),
    int: Math.floor((template.magicAttack || 5) * 0.8),
    wis: Math.floor((template.magicDefense || 5) * 1.2),
    cha: 5
  };

  const levelScale = 1 + (level - 1) * 0.1;
  const scaledHp = Math.floor(template.maxHp * levelScale);
  const expReward = Math.floor(template.xp * levelScale);
  const goldReward = Math.floor(template.gold * levelScale);

  return { stats, hp: scaledHp, maxHp: scaledHp, expReward, goldReward };
}

/**
 * 计算敌人对玩家造成的伤害
 * @param enemy - 敌人实例
 * @param playerDefense - 玩家防御值
 * @returns 计算后的伤害值
 */
export function calculateEnemyDamage(enemy: Enemy, playerDefense: number): number {
  const baseDamage = enemy.physicalAttack || enemy.stats.str;
  const damageRange = enemy.damage;
  const randomFactor = damageRange[0] + Math.random() * (damageRange[1] - damageRange[0]);
  const rawDamage = (baseDamage + randomFactor) * 0.5;
  const mitigated = Math.max(1, rawDamage - playerDefense * 0.3);
  return Math.floor(mitigated);
}

/**
 * 创建完整的敌人实例（纯函数，不涉及 DB 和状态存储）
 * @param template - 敌人模板数据
 * @param level - 敌人等级
 * @returns 完整的敌人实例
 */
export function createEnemyInstance(template: EnemyData, level: number): Enemy {
  const id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const derived = generateEnemyStats(template, level);

  const drops: EnemyDrop[] = [];

  // Boss 额外掉落物品
  if (template.isBoss) {
    const bossDrops: EnemyDrop[] = [
      { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.6 },
      { itemId: 'large_mana_potion', minAmount: 1, maxAmount: 1, dropRate: 0.4 },
      { itemId: 'strength_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'agility_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'constitution_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'intelligence_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'wisdom_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'charisma_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 }
    ];
    drops.push(...bossDrops);
  }

  const enemy: EnemyInstance = {
    ...template,
    id,
    dataId: template.id,
    level,
    hp: derived.hp,
    maxHp: derived.maxHp,
    loot: [],
    stats: derived.stats,
    expReward: derived.expReward,
    goldReward: derived.goldReward,
    drops
  };

  return enemy;
}
