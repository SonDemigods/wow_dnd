/**
 * 敌人模块纯逻辑函数
 *
 * 提供敌人属性推导、伤害计算、实例创建等纯函数，不含状态和副作用
 */
import type { EnemyInstance, EnemyDrop, EnemyData } from './types';
import type { Stats } from '@/modules/character/types';
import { generateId } from '@/utils/db-helpers';
import { defaultRng, type Rng } from '@/utils/rng';

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
  const scaledPhysicalAttack = Math.floor((template.physicalAttack ?? 10) * levelScale);
  const scaledPhysicalDefense = Math.floor((template.physicalDefense ?? 5) * levelScale);
  const scaledMagicAttack = Math.floor((template.magicAttack ?? 5) * levelScale);
  const scaledMagicDefense = Math.floor((template.magicDefense ?? 5) * levelScale);
  const scaledDamage: [number, number] = [
    Math.floor(template.damage[0] * levelScale),
    Math.floor(template.damage[1] * levelScale)
  ];

  // 六维属性由缩放后的战斗属性推导：
  // - str（力量）：物理攻击 × 0.8
  // - dex（敏捷）：闪避率 × 1.5
  // - con（体质）：最大生命 × 等级缩放 × 0.3
  // - int（智力）：魔法攻击 × 0.8
  // - wis（智慧）：魔法防御 × 1.2
  // - cha（魅力）：固定为 5（敌人不使用魅力属性）
  const stats: Stats = {
    str: Math.floor(scaledPhysicalAttack * 0.8),
    dex: Math.floor((template.dodgeChance ?? 5) * 1.5),
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
 *
 * 伤害公式：
 *   rawDamage = (攻击力 + 伤害范围随机值) × 0.5
 *   mitigated = max(1, rawDamage - 玩家防御 × 0.3)
 *   最终伤害 = floor(mitigated)
 *
 * 即攻击力与伤害范围各占 50% 权重，玩家防御按 30% 比例减免，最低造成 1 点伤害。
 *
 * P3-95 修复：根据 `enemy.attackType` 选择使用物理攻击力或魔法攻击力。
 * - `attackType === 'magical'`：使用 `magicAttack`（法系敌人普攻走魔法）
 * - 其他情况（含未配置）：使用 `physicalAttack`（默认物理）
 * 注意：调用方需根据 attackType 传入对应的玩家防御（physicalDefense 或 magicDefense）。
 *
 * @param enemy - 敌人实例
 * @param playerDefense - 玩家防御值（由调用方根据 enemy.attackType 选择物理或魔法防御）
 * @param rng - 随机数生成器，默认 `defaultRng`（基于 Math.random）。
 *   传入 `createSeededRng(seed)` 或 `createRngFromFn(() => 0)` 可注入确定性随机源，
 *   便于测试断言与战斗回放（避免 mock 全局 Math.random 的副作用）。
 *   生产环境调用无需传参，使用默认值即可。
 * @returns 计算后的伤害值（向下取整，最小为 1）
 */
export function calculateEnemyDamage(
  enemy: EnemyInstance,
  playerDefense: number,
  rng: Rng = defaultRng
): number {
  const isMagical = enemy.attackType === 'magical';
  const baseDamage = isMagical
    ? (enemy.magicAttack ?? 5)
    : (enemy.physicalAttack ?? 10);
  const damageRange = enemy.damage;
  const randomFactor = damageRange[0] + rng.next() * (damageRange[1] - damageRange[0]);
  const rawDamage = (baseDamage + randomFactor) * 0.5;
  const mitigated = Math.max(1, rawDamage - playerDefense * 0.3);
  return Math.floor(mitigated);
}

/**
 * 创建完整的敌人实例（纯函数，不涉及 DB 和状态存储）
 * @param template - 敌人模板数据
 * @param level - 敌人等级
 * @param rng - 随机数生成器，默认 `defaultRng`。传入确定性 RNG 可生成可复现的 ID
 * @returns 完整的敌人实例
 */
export function createEnemyInstance(template: EnemyData, level: number, rng: Rng = defaultRng): EnemyInstance {
  const id = generateId('enemy', rng);
  const derived = generateEnemyStats(template, level);

  const enemy: EnemyInstance = {
    ...template,
    id,
    dataId: template.id,
    level,
    hp: derived.hp,
    maxHp: derived.maxHp,
    stats: derived.stats,
    expReward: derived.expReward,
    goldReward: derived.goldReward,
    // 覆盖模板原始值，使用等级缩放后的战斗属性
    physicalAttack: derived.physicalAttack,
    physicalDefense: derived.physicalDefense,
    magicAttack: derived.magicAttack,
    magicDefense: derived.magicDefense,
    damage: derived.damage
  };

  return enemy;
}

/**
 * Boss 通用掉落表（由 boss/service.ts 引用，避免硬编码重复）
 */
export const BOSS_DROP_TABLE: EnemyDrop[] = [
  { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.6 },
  { itemId: 'large_mana_potion', minAmount: 1, maxAmount: 1, dropRate: 0.4 },
  { itemId: 'strength_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
  { itemId: 'agility_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
  { itemId: 'constitution_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
  { itemId: 'intelligence_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
  { itemId: 'wisdom_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
  { itemId: 'charisma_potion', minAmount: 1, maxAmount: 1, dropRate: 0.15 }
];
