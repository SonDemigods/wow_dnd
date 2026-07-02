/**
 * Boss 模块纯逻辑函数
 *
 * 提供 Boss 实例创建等纯函数，不含 DB 操作和副作用。
 * 复用 enemy/service.ts 的等级缩放（generateEnemyStats）和通用掉落表（BOSS_DROP_TABLE），
 * 仅在此层追加 Boss 专属的阶段管理器注入。
 */
import type { BossInstance, BossTemplate } from './types';
import type { EnemyDrop } from '../enemy/types';
import { generateEnemyStats, BOSS_DROP_TABLE } from '../enemy/service';
import { BossPhaseManager } from './phase-manager';

/**
 * 创建完整的 Boss 实例（纯函数，不涉及 DB 和状态存储）
 *
 * 创建流程：
 * 1. 生成唯一 ID（时间戳 + 随机数）
 * 2. 调用 generateEnemyStats 进行等级缩放，获取战斗属性（hp/stats/攻击/防御/奖励）
 * 3. 注入 BOSS_DROP_TABLE 通用掉落（8 种药水，概率 15%-60%）
 * 4. 展开模板属性，用等级缩放后的战斗属性覆盖原始值
 * 5. 在对象构造后注入 BossPhaseManager（因自引用限制，无法在对象字面量中直接创建）
 *
 * @param template - Boss 模板数据
 * @param level - Boss 等级（影响属性缩放和奖励计算）
 * @returns 完整的 Boss 运行时实例
 */
export function createBossInstance(template: BossTemplate, level: number): BossInstance {
  // 生成唯一实例 ID
  const id = `boss_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  // 等级缩放：计算当前等级下的 HP、战斗属性、经验/金币奖励
  const derived = generateEnemyStats(template, level);

  // Boss 通用掉落表（来自 enemy/service.ts 的共享常量）
  const drops: EnemyDrop[] = [...BOSS_DROP_TABLE];

  const boss: BossInstance = {
    ...template,
    id,
    dataId: template.id,
    level,
    // 战斗运行时状态
    hp: derived.hp,
    maxHp: derived.maxHp,
    stats: derived.stats,
    // 等级缩放后的奖励
    expReward: derived.expReward,
    goldReward: derived.goldReward,
    // 覆盖模板原始值，使用等级缩放后的战斗属性
    physicalAttack: derived.physicalAttack,
    physicalDefense: derived.physicalDefense,
    magicAttack: derived.magicAttack,
    magicDefense: derived.magicDefense,
    damage: derived.damage,
    drops,
    isBoss: true
  };

  // 注入阶段管理器（必须在对象创建后，因为 phaseManager 是对 boss 自身的引用，
  // 在对象字面量中 boss 尚未完成初始化，无法被引用）
  boss.phaseManager = new BossPhaseManager();

  return boss;
}
