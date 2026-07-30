/**
 * Boss 模块纯逻辑函数
 *
 * 提供 Boss 实例创建等纯函数，不含 DB 操作和副作用。
 * 复用 enemy/service.ts 的等级缩放（generateEnemyStats）和通用掉落表（BOSS_DROP_TABLE）。
 *
 * BossInstance 扁平化到 EnemyInstance 的逻辑由 GameBootstrap 的 bossCreateFn 回调内联处理，
 * combat state 通过 wrapAsBossInstance 包装回组合式 BossInstance（保持 base 同引用）。
 */
import type { BossInstance, BossTemplate, BossRuntimeState, BossPhase, BossIntro } from './types';
import type { EnemyInstance, EnemyDrop } from '@/modules/enemy/types';
import { generateEnemyStats, BOSS_DROP_TABLE } from '@/modules/enemy/service';
import { generateId } from '@/utils/db-helpers';
import { defaultRng, type Rng } from '@/utils/rng';

/**
 * 创建完整的 Boss 实例（纯函数，不涉及 DB 和状态存储）
 *
 * 创建流程：
 * 1. 生成唯一 ID（时间戳 + 随机数，复用 generateId 工具函数）
 * 2. 调用 generateEnemyStats 进行等级缩放，获取战斗属性（hp/stats/攻击/防御/奖励）
 * 3. 注入 BOSS_DROP_TABLE 通用掉落（8 种药水，概率 15%-60%）
 * 4. 构造组合式 BossInstance：base（EnemyInstance）+ runtime（空）+ phases + intro
 *
 * @param template - Boss 模板数据
 * @param level - Boss 等级（影响属性缩放和奖励计算）
 * @param rng - 随机数生成器，默认 `defaultRng`。传入 `createSeededRng(seed)` 可生成确定性 ID
 * @returns 组合式 Boss 实例（base + runtime + phases + intro）
 */
export function createBossInstance(template: BossTemplate, level: number, rng: Rng = defaultRng): BossInstance {
  // 生成唯一实例 ID（阶段十二：收敛到 generateId，支持注入确定性 RNG）
  const id = generateId('boss', rng);
  // 等级缩放：计算当前等级下的 HP、战斗属性、经验/金币奖励
  const derived = generateEnemyStats(template, level);

  // Boss 通用掉落表（来自 enemy/service.ts 的共享常量）
  const drops: EnemyDrop[] = [...BOSS_DROP_TABLE];

  // 组合式 base：EnemyInstance（扁平战斗属性）
  const base: EnemyInstance = {
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
  };

  // 组合式 runtime：初始为空对象，由 engine 执行器在战斗中注入
  const runtime: BossRuntimeState = {};

  return {
    base,
    isBoss: true,
    phases: template.phases ?? [],
    intro: template.intro,
    runtime,
  };
}

// ============================================================================
// 组合式 BossInstance 包装函数
// ============================================================================

/**
 * 将扁平 EnemyInstance 包装为组合式 BossInstance（保持 base 同引用）
 *
 * 用途：combat state 的 initBossFeatures 在战斗开始时，对 enemy store 中的 Boss
 * 敌人包装为组合式 BossInstance，存入 state.bossInstances Map。
 *
 * 同引用的意义：
 * - engine 修改 `boss.base.physicalAttack` 会立即反映到 `enemy.physicalAttack`
 * - combat 层持有 EnemyInstance，无需感知 BossInstance 即可读到 engine 写入的战斗属性
 *
 * phases/intro 配置的传递：
 * - enemy store 持有 Boss 的扁平数据（EnemyInstance），运行时附加 phases/intro 属性
 * - 这些附加属性由 GameBootstrap 的 bossCreateFn 回调在创建时附加
 * - 此处通过类型断言读取，恢复 BossInstance 所需的 phases/intro 配置
 * - 类型层面不体现这些属性，避免 enemy/types.ts 反向依赖 boss 类型
 *
 * 阶段五升级：
 *   - 保留 wrapAsBossInstance：它是 combat state 包装 enemy store 数据的必要函数
 *
 * 使用场景：
 * - combat state 的 bossInstances Map 初始化时包装 EnemyInstance
 * - boss/store.ts 的 initBossCombat 接受 EnemyInstance 时内部包装
 *
 * @param enemy - 扁平 EnemyInstance（必须 isBoss=true，运行时携带 phases/intro 附加属性）
 * @returns 组合式 BossInstance（base 与 enemy 同引用，runtime 初始为空）
 */
export function wrapAsBossInstance(enemy: EnemyInstance): BossInstance {
  // 通过类型断言读取 enemy 上的 phases/intro 运行时附加属性
  // （由 GameBootstrap 的 bossCreateFn 回调附加，类型层面不体现）
  const bossEnemy = enemy as EnemyInstance & { phases?: BossPhase[]; intro?: BossIntro };
  return {
    base: enemy,
    isBoss: true,
    phases: bossEnemy.phases ?? [],
    intro: bossEnemy.intro,
    runtime: {},
  };
}
