/**
 * 敌人模块纯逻辑函数
 *
 * 提供敌人属性推导、伤害计算、实例创建等纯函数，不含状态和副作用
 */
import type { Enemy, EnemyInstance, EnemyDrop } from './types';
import type { Stats } from '../character/types';
import type { EnemyData } from './types';

/**
 * 根据模板和等级推导敌人属性统计（含等级缩放）
 * @param template - 敌人模板数据
 * @param level - 敌人等级
 * @returns 推导的属性统计与缩放后的生命值、奖励、战斗属性
 */
export function generateEnemyStats(
  template: EnemyData,
  level: number
): {
  stats: Stats;
  hp: number;
  maxHp: number;
  expReward: number;
  goldReward: number;
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
  damage: [number, number];
} {
  // 等级缩放系数：每级 +10%，level=1 时为 1.0，level=50 时为 5.9
  const levelScale = 1 + (level - 1) * 0.1;

  // 战斗属性随等级缩放
  const scaledPhysicalAttack = Math.floor((template.physicalAttack || 10) * levelScale);
  const scaledPhysicalDefense = Math.floor((template.physicalDefense || 5) * levelScale);
  const scaledMagicAttack = Math.floor((template.magicAttack || 5) * levelScale);
  const scaledMagicDefense = Math.floor((template.magicDefense || 5) * levelScale);
  const scaledDamage: [number, number] = [
    Math.floor(template.damage[0] * levelScale),
    Math.floor(template.damage[1] * levelScale)
  ];

  // 六维属性由缩放后的战斗属性推导
  const stats: Stats = {
    str: Math.floor(scaledPhysicalAttack * 0.8),
    dex: Math.floor((template.dodgeChance || 5) * 1.5),
    con: Math.floor(template.maxHp * levelScale * 0.3),
    int: Math.floor(scaledMagicAttack * 0.8),
    wis: Math.floor(scaledMagicDefense * 1.2),
    cha: 5
  };

  const scaledHp = Math.floor(template.maxHp * levelScale);
  const expReward = Math.floor(template.xp * levelScale);
  const goldReward = Math.floor(template.gold * levelScale);

  return {
    stats,
    hp: scaledHp,
    maxHp: scaledHp,
    expReward,
    goldReward,
    physicalAttack: scaledPhysicalAttack,
    physicalDefense: scaledPhysicalDefense,
    magicAttack: scaledMagicAttack,
    magicDefense: scaledMagicDefense,
    damage: scaledDamage
  };
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
    // 覆盖模板原始值，使用等级缩放后的战斗属性
    physicalAttack: derived.physicalAttack,
    physicalDefense: derived.physicalDefense,
    magicAttack: derived.magicAttack,
    magicDefense: derived.magicDefense,
    damage: derived.damage,
    drops
  };

  return enemy;
}
