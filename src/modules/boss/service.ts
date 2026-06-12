/**
 * Boss 模块纯逻辑函数
 *
 * 提供 Boss 实例创建等纯函数，不含状态和副作用
 */
import type { BossInstance, BossTemplate } from './types';
import type { EnemyDrop } from '../enemy/types';
import { generateEnemyStats } from '../enemy/service';
import { BossPhaseManager } from './engine';

/**
 * 创建完整的 Boss 实例（纯函数，不涉及 DB 和状态存储）
 * @param template - Boss 模板数据
 * @param level - Boss 等级
 * @returns 完整的 Boss 实例
 */
export function createBossInstance(template: BossTemplate, level: number): BossInstance {
  const id = `boss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const derived = generateEnemyStats(template, level);

  const drops: EnemyDrop[] = [];

  // Boss 额外掉落物品
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

  const boss: BossInstance = {
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
    drops,
    isBoss: true
  };

  // 注入阶段管理器（需在 boss 对象创建后，避免自引用问题）
  boss.phaseManager = new BossPhaseManager(boss);

  return boss;
}
