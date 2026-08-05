/**
 * @fileoverview 套装效果执行器注册表
 * @description
 *   物品系统升级（plan.md §3.4 §2）的套装触发效果执行层。把旧版松散的魔法字符串
 *   （`rage_gen_on_hit_1` 等）映射到实际执行逻辑，解决"套装效果是否在战斗中真正生效存疑"
 *   的问题（plan.md S3）。
 *
 *   设计：执行器不直接修改战斗状态，而是通过 `ctx.emit(intent)` 下发"效果意图"
 *   （`SetBonusIntent`）。战斗模块在 P5 接入时，提供 `emit` 回调将意图实际应用到角色/敌人。
 *   这样 P1 阶段可脱离战斗系统独立测试执行器分派逻辑（注入 mock emit 收集意图）。
 *
 *   新增触发效果类型：在 `SET_BONUS_EXECUTORS` 注册一行 `{ executor, sources }` 即可，
 *   无需改战斗逻辑（开闭原则）。
 *
 *   阶段定位：P1（纯新增）。本文件不接入战斗模块；P5 在 on_hit/on_kill/on_turn_start 等时机
 *   遍历已激活套装触发效果并调用 `executeSetBonus`。
 *
 * @module equipment
 */

// ============================================================================
// 触发时机
// ============================================================================

/**
 * 套装触发效果的作用时机
 *
 * 与战斗流程的各环节对应。每个执行器声明其在哪些时机生效（`sources`），
 * `executeSetBonus` 会在 `ctx.source` 不匹配时跳过执行。
 */
export type SetBonusSource = 'on_hit' | 'on_kill' | 'on_turn_start' | 'on_crit' | 'passive';

// ============================================================================
// 效果意图（执行器 → 战斗模块的输出契约）
// ============================================================================

/**
 * 套装效果意图（判别联合）
 *
 * 执行器通过 `ctx.emit` 下发的效果描述。战斗模块（P5）按 `kind` 分派实际应用：
 * - `resource`：立即生成固定数量资源（如 +1 怒气）
 * - `percent_regen`：按上限百分比恢复资源（如每回合恢复 5% 最大法力）
 * - `modifier`：施加百分比修正（如治疗 +10%、暴击 +3%）。`value` 为加性小数（0.10 = +10%）
 * - `chance_grant`：按概率生成资源（如击杀时 20% 概率产生 1 灵魂碎片）
 *
 * 注意：plan.md 原始伪代码中 `applyModifier(ctx, 'heal', 1.10)` 与 `applyModifier(ctx, 'crit', 0.03)`
 * 数值口径不一致（1.10 vs 0.03）。本实现统一为"加性小数"（heal=0.10、crit=0.03），
 * 语义更清晰，由战斗模块按 `value` 叠加到对应修正系数。
 */
export type SetBonusIntent =
  | { kind: 'resource'; resource: string; amount: number }
  | { kind: 'percent_regen'; resource: string; percent: number }
  | { kind: 'modifier'; modifier: string; value: number }
  | { kind: 'chance_grant'; resource: string; chance: number; amount: number };

// ============================================================================
// 执行上下文
// ============================================================================

/**
 * 套装效果执行上下文
 *
 * 执行器从此上下文读取触发信息，通过 `emit` 下发效果意图。
 *
 * @property characterId - 触发套装效果的角色 ID
 * @property piecesEquipped - 当前该套装穿戴件数（供执行器按件数缩放效果，可选）
 * @property source - 触发时机（必须与执行器声明的 `sources` 匹配才会执行）
 * @property emit - 效果意图下发回调（由战斗模块在 P5 接入时提供实际实现）
 */
export interface SetBonusContext {
  characterId: string;
  piecesEquipped: number;
  source: SetBonusSource;
  emit: (intent: SetBonusIntent) => void;
}

/**
 * 套装效果执行器：读取上下文，通过 `ctx.emit` 下发一个或多个效果意图
 */
export type SetBonusExecutor = (ctx: SetBonusContext) => void;

/** 注册项：执行器 + 其生效的作用时机列表 */
export interface SetBonusExecutorEntry {
  executor: SetBonusExecutor;
  sources: SetBonusSource[];
}

// ============================================================================
// 内部辅助函数（语义化封装效果意图下发）
// ============================================================================

/** 立即生成固定数量资源 */
function grantResource(ctx: SetBonusContext, resource: string, amount: number): void {
  ctx.emit({ kind: 'resource', resource, amount });
}

/** 按上限百分比恢复资源 */
function regenPercent(ctx: SetBonusContext, resource: string, percent: number): void {
  ctx.emit({ kind: 'percent_regen', resource, percent });
}

/** 施加百分比修正（value 为加性小数，0.10 = +10%） */
function applyModifier(ctx: SetBonusContext, modifier: string, value: number): void {
  ctx.emit({ kind: 'modifier', modifier, value });
}

/** 按概率生成资源（默认数量 1） */
function maybeGrant(
  ctx: SetBonusContext,
  resource: string,
  chance: number,
  amount = 1
): void {
  ctx.emit({ kind: 'chance_grant', resource, chance, amount });
}

// ============================================================================
// 触发器注册表
// ============================================================================

/**
 * 触发器注册表：triggerId → { executor, sources }
 *
 * triggerId 与 `SetBonusEffect`（kind: 'trigger'）的 `triggerId` 字段对应。
 * 新增触发效果在此注册一行即可。
 *
 * 当前注册项覆盖 config_item_sets.ts 旧版 6 个套装的 effect 字符串：
 * - `rage_gen_on_hit_1`：攻击时 +1 怒气（战士力量套）
 * - `mp_regen_5_percent`：每回合恢复 5% 最大法力（法师奥术套）
 * - `heal_bonus_10_percent`：治疗效果 +10%（圣骑士正义套，持续生效）
 * - `crit_bonus_3_percent`：暴击率 +3%（猎人捕食者套，持续生效）
 * - `energy_regen_2`：每回合 +2 能量（潜行者暗影套）
 * - `soul_shard_on_kill_20_percent`：击杀时 20% 概率 +1 灵魂碎片（术士恶魔套）
 */
export const SET_BONUS_EXECUTORS: Record<string, SetBonusExecutorEntry> = {
  rage_gen_on_hit_1: {
    executor: ctx => grantResource(ctx, 'rage', 1),
    sources: ['on_hit']
  },
  mp_regen_5_percent: {
    executor: ctx => regenPercent(ctx, 'mp', 0.05),
    sources: ['on_turn_start']
  },
  heal_bonus_10_percent: {
    executor: ctx => applyModifier(ctx, 'heal', 0.10),
    sources: ['passive']
  },
  crit_bonus_3_percent: {
    executor: ctx => applyModifier(ctx, 'crit', 0.03),
    sources: ['passive']
  },
  energy_regen_2: {
    executor: ctx => grantResource(ctx, 'energy', 2),
    sources: ['on_turn_start']
  },
  soul_shard_on_kill_20_percent: {
    executor: ctx => maybeGrant(ctx, 'soul_shard', 0.2),
    sources: ['on_kill']
  }
  // 新增触发效果在此注册一行
};

// ============================================================================
// 分派函数
// ============================================================================

/**
 * 执行指定触发效果
 *
 * 查找 `triggerId` 对应的执行器，若 `ctx.source` 在执行器声明的 `sources` 中则调用执行器。
 * 未知 `triggerId` 或时机不匹配时为 no-op（安全降级）。
 *
 * @param triggerId - 触发效果标识（对应 `SetBonusEffect` 的 `triggerId`）
 * @param ctx - 执行上下文（含 `emit` 回调）
 */
export function executeSetBonus(triggerId: string, ctx: SetBonusContext): void {
  const entry = SET_BONUS_EXECUTORS[triggerId];
  if (!entry || !entry.sources.includes(ctx.source)) return;
  entry.executor(ctx);
}

/**
 * 判断触发效果是否已注册
 */
export function isTriggerRegistered(triggerId: string): boolean {
  return triggerId in SET_BONUS_EXECUTORS;
}

/**
 * 获取触发效果的生效时机列表（未注册返回空数组）
 */
export function getTriggerSources(triggerId: string): SetBonusSource[] {
  return SET_BONUS_EXECUTORS[triggerId]?.sources ?? [];
}

/**
 * 注册新的触发效果（运行时扩展点）
 *
 * 供测试或插件化场景动态注册执行器。生产配置应直接写入 `SET_BONUS_EXECUTORS`。
 */
export function registerSetBonusExecutor(
  triggerId: string,
  entry: SetBonusExecutorEntry
): void {
  SET_BONUS_EXECUTORS[triggerId] = entry;
}
