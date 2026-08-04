/**
 * @fileoverview 探索模块事件处理器注册表（ARCH-11 修复）
 * @description 集中定义探索事件的效果处理器与格子事件处理器，采用注册表模式
 *              （参考 boss/engine.ts 的 mechanicExecutors）。
 *
 *              设计意图：将事件类型与处理函数的映射关系从 store.ts 中解耦，
 *              新增事件类型时只需在此文件注册处理器，无需修改 store.ts。
 *              store.ts 通过 applyEventEffect / dispatchCellEvent 分发调用。
 *
 *              两层注册表：
 *              1. effectHandlers  —— RandomEventEffectType → 角色状态变更
 *                 处理"效果应用"维度（heal/mana/exp/damage/mpLoss/gold）
 *              2. cellEventHandlers —— CellType → 格子事件结算
 *                 处理"格子交互"维度（treasure/trap/event/rest）
 *
 *              未注册的 cell 类型（monster/boss/shop/board/start/empty）走 store.ts
 *              的专用路径，不进入此注册表分发。
 * @module exploration
 */
import type {
  CellType,
  ExplorationCell,
  AreaConfig,
  RandomEventEffectType,
  ExplorationUICallbacks
} from './types';
import type { useCharacterStore } from '@/modules/character/store';
import type { useInventoryStore } from '@/modules/inventory/store';
import {
  generateTrapDamage,
  generateRandomEvent,
  generateMultiOptionEvent,
  generateCampHeal,
  generateItemForCell
} from './service';
import { eventBus, GameEvents } from '@/modules/bus';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { defaultRng, type Rng } from '@/utils/rng';
import {
  MULTI_OPTION_EVENT_PROBABILITY,
  FALLBACK_GOLD_MIN,
  FALLBACK_GOLD_RANDOM_RANGE,
  FALLBACK_EXP_MIN,
  FALLBACK_EXP_RANDOM_RANGE
} from '@/config/exploration';

// ============================================================================
// 处理器上下文与结果接口
// ============================================================================

/**
 * 事件处理器共享上下文
 *
 * 封装处理器所需的全部外部依赖（Store 实例、区域配置、UI 回调等），
 * 避免处理器与 store.ts 内部状态直接耦合，便于独立测试与扩展。
 */
export interface ExplorationContext {
  /** 角色 Store 实例（用于修改角色状态：HP/MP/经验/金币等） */
  characterStore: ReturnType<typeof useCharacterStore>;
  /** 背包 Store 实例（用于添加/查询物品） */
  inventoryStore: ReturnType<typeof useInventoryStore>;
  /** 当前区域配置（含物品池、等级、怪物池等） */
  areaConfig: AreaConfig;
  /** 已注册的 UI 回调集（可能为 null，处理器需做可选链保护） */
  uiCallbacks: ExplorationUICallbacks | null;
  /** 当前角色 ID（用于 eventBus 事件载荷） */
  characterId: string | null;
  /**
   * 可选的随机数生成器，用于确定性回放与测试注入。
   * 未提供时使用基于 Math.random 的 defaultRng，保持与原行为完全一致。
   */
  rng?: Rng;
}

/**
 * 格子事件处理器扩展上下文（在 ExplorationContext 基础上携带格子对象）
 */
export interface CellEventContext extends ExplorationContext {
  /** 当前触发的格子对象（处理器可读取其类型/状态） */
  cell: ExplorationCell;
  /** 营地是否已被使用（rest 类型据此判断是否跳过恢复，避免重复使用） */
  campUsed?: boolean;
}

/**
 * 格子事件处理结果
 *
 * store.ts 根据此结果决定后续状态变更（标记 completed、设置 campUsed、触发死亡处理）。
 */
export interface CellEventResult {
  /** 是否需要将格子标记为已完成（completed=true，UI 褪色显示） */
  completed: boolean;
  /** 是否需要将营地标记为已使用（仅 rest 类型返回 true） */
  campUsed?: boolean;
  /** 角色是否已死亡，需调用方触发 handleDeath */
  shouldHandleDeath?: boolean;
}

// ============================================================================
// 效果处理器注册表（RandomEventEffectType → 处理函数）
// ============================================================================

/**
 * 效果处理器类型
 *
 * @param ctx - 处理器上下文（提供 characterStore 等依赖）
 * @param amount - 效果数值（正数表示恢复/奖励，负数由调用方处理符号）
 * @returns 是否需要触发死亡处理（true 表示角色 HP 已归零）
 */
export type EffectHandler = (ctx: ExplorationContext, amount: number) => Promise<boolean>;

/**
 * 效果处理器注册表
 *
 * 将每种 RandomEventEffectType 映射到对应的角色状态变更函数。
 * 新增效果类型时在此注册即可，无需修改 store.ts 的 switch 语句。
 *
 * 注意：damage 处理器返回死亡标记，由调用方决定是否触发 handleDeath，
 * 避免在处理器内部直接调用 handleDeath（保持处理器纯粹性）。
 */
export const effectHandlers: Record<RandomEventEffectType, EffectHandler> = {
  /** 生命恢复：调用 receiveHeal，不会导致死亡 */
  heal: async (ctx, amount) => {
    await ctx.characterStore.receiveHeal(amount);
    return false;
  },
  /** 法力恢复：调用 changeMp（正值） */
  mana: async (ctx, amount) => {
    await ctx.characterStore.changeMp(amount);
    return false;
  },
  /** 经验奖励：调用 gainExp */
  exp: async (ctx, amount) => {
    await ctx.characterStore.gainExp(amount);
    return false;
  },
  /** 伤害：调用 takeDamage，检查死亡 */
  damage: async (ctx, amount) => {
    await ctx.characterStore.takeDamage(amount);
    return ctx.characterStore.hp <= 0;
  },
  /** 法力损失：调用 changeMp（负值） */
  mpLoss: async (ctx, amount) => {
    await ctx.characterStore.changeMp(-amount);
    return false;
  },
  /** 金币奖励：调用 gainGold */
  gold: async (ctx, amount) => {
    await ctx.characterStore.gainGold(amount);
    return false;
  },
};

/**
 * 通过注册表分发应用事件效果
 *
 * @param effectType - 效果类型（heal/mana/exp/damage/mpLoss/gold）
 * @param ctx - 处理器上下文
 * @param amount - 效果数值
 * @returns 是否需要触发死亡处理（true 表示角色 HP 已归零）
 */
export async function applyEventEffect(
  effectType: RandomEventEffectType,
  ctx: ExplorationContext,
  amount: number
): Promise<boolean> {
  const handler = effectHandlers[effectType];
  if (!handler) {
    console.warn(`[探索] 未注册的事件效果类型: ${effectType}`);
    return false;
  }
  return handler(ctx, amount);
}

// ============================================================================
// 格子事件处理器注册表（CellType → 处理函数）
// ============================================================================

/**
 * 格子事件处理器类型
 *
 * @param ctx - 格子事件上下文（含 cell 对象和所有依赖）
 * @returns 处理结果（completed/campUsed/shouldHandleDeath）
 */
export type CellEventHandler = (ctx: CellEventContext) => Promise<CellEventResult>;

/** 空结果（用于未知 cell 类型，store.ts 不做任何状态变更） */
const EMPTY_RESULT: CellEventResult = { completed: false };

/**
 * 格子事件处理器注册表
 *
 * 仅注册需要立即结算的格子类型（treasure/trap/event/rest）。
 * monster/boss/shop/board 等类型在 store.ts 的 revealGrid 中走专用路径
 * （触发战斗或打开交互面板），不进入此注册表分发。
 *
 * 新增可立即结算的格子类型时，在此处注册处理器即可，
 * store.ts 的 revealGrid 路径 3 无需修改。
 */
export const cellEventHandlers: Partial<Record<CellType, CellEventHandler>> = {
  /**
   * 宝箱：从物品池随机选取物品发放。
   * 物品模板不存在时，发放金币和经验作为兜底奖励。
   */
  treasure: async (ctx) => {
    const randomItemId = generateItemForCell(ctx.areaConfig.itemPool);
    if (!randomItemId) {
      return { completed: true };
    }

    const item = ctx.inventoryStore.getItemInfo(randomItemId);
    if (item) {
      // BIZ-10：先入包再记录日志/发射事件，避免背包满时"日志显示发现物品但实际丢失"
      const actualAmount = ctx.inventoryStore.addItem(randomItemId, 1);
      if (actualAmount === 0) {
        // 背包已满，走兜底奖励（转换为金币 + 经验），避免宝箱物品静默丢失
        await grantFallbackReward(ctx, randomItemId, 'inventory_full');
        return { completed: true };
      }

      // 正常路径：物品已入包 → 日志 + 事件通知
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `发现物品: ${item.name}`,
        icon: 'game-icons:chest'
      });

      eventBus.emit(GameEvents.EXPLORATION_ITEM_FOUND, {
        characterId: ctx.characterId,
        itemId: randomItemId,
        count: actualAmount,
        itemName: item.name
      });

      ctx.uiCallbacks?.onItemFound?.({ itemId: randomItemId, count: actualAmount, itemName: item.name });
    } else {
      // 兜底路径：物品模板不存在，转换为金币 + 经验
      await grantFallbackReward(ctx, randomItemId, 'template_missing');
    }
    return { completed: true };
  },

  /**
   * 陷阱：根据区域等级计算伤害并扣除 HP。
   * 角色死亡时不发射事件/日志（由调用方触发 handleDeath 后统一处理）。
   */
  trap: async (ctx) => {
    const rng = ctx.rng ?? defaultRng;
    const damage = generateTrapDamage(ctx.areaConfig.level, rng);
    await ctx.characterStore.takeDamage(damage);
    const shouldHandleDeath = ctx.characterStore.hp <= 0;

    if (!shouldHandleDeath) {
      eventBus.emit(GameEvents.EXPLORATION_TRAP_TRIGGERED, {
        characterId: ctx.characterId,
        damage,
        trapType: '普通陷阱'
      });

      ctx.uiCallbacks?.onTrapTriggered?.({ damage, trapType: '普通陷阱' });

      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'combat',
        message: `触发陷阱，受到 ${damage} 点伤害`,
        icon: 'game-icons:caltrops'
      });
    }
    return { completed: true, shouldHandleDeath };
  },

  /**
   * 随机事件：30% 概率生成多选项事件（需玩家选择），70% 概率生成普通随机事件（即时生效）。
   * 普通事件通过 applyEventEffect 分发到 effectHandlers 处理。
   */
  event: async (ctx) => {
    const rng = ctx.rng ?? defaultRng;
    // 多选项事件：仅通知 UI 展示弹窗，效果由 applyEventChoice 在玩家选择后应用
    if (rng.bool(MULTI_OPTION_EVENT_PROBABILITY)) {
      const multiEvent = generateMultiOptionEvent(ctx.areaConfig.level, rng);
      ctx.uiCallbacks?.onMultiOptionEvent?.(multiEvent);

      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'info',
        message: multiEvent.message,
        icon: multiEvent.icon
      });
      return { completed: true };
    }

    // 普通随机事件：生成效果 → 通过注册表分发应用
    // 阶段四：传入区域专属事件池，generateRandomEvent 按 AREA_EVENT_MIX_PROBABILITY 混合
    const eventResult = generateRandomEvent(ctx.areaConfig.level, rng, ctx.areaConfig.areaEvents ?? []);
    const shouldHandleDeath = await applyEventEffect(
      eventResult.effect.type,
      ctx,
      eventResult.effect.amount
    );

    if (shouldHandleDeath) {
      // 死亡时不发射事件/日志，由调用方触发 handleDeath
      return { completed: true, shouldHandleDeath: true };
    }

    eventBus.emit(GameEvents.EXPLORATION_RANDOM_EVENT, {
      characterId: ctx.characterId,
      message: eventResult.message,
      icon: eventResult.icon
    });

    ctx.uiCallbacks?.onRandomEvent?.({ message: eventResult.message, icon: eventResult.icon });

    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'info',
      message: eventResult.message,
      icon: eventResult.icon
    });
    return { completed: true };
  },

  /**
   * 营地：完全恢复 HP 和 MP（每次探索仅可使用一次）。
   * 若营地已被使用（ctx.campUsed === true），直接返回不执行恢复。
   * 营地使用标记（campUsed）由 store.ts 根据返回结果设置，
   * 持久化也由 store.ts 统一处理。
   */
  rest: async (ctx) => {
    // 营地只能使用一次：已使用则直接返回，仅标记格子已完成
    if (ctx.campUsed) {
      return { completed: true };
    }

    const heal = generateCampHeal(ctx.areaConfig.level);
    await ctx.characterStore.receiveHeal(heal.hp);
    await ctx.characterStore.changeMp(heal.mana);

    eventBus.emit(GameEvents.EXPLORATION_CAMP_USED, {
      characterId: ctx.characterId
    });

    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'exploration',
      message: '在营地休息，恢复了全部生命值和法力值',
      icon: 'game-icons:campfire'
    });
    return { completed: true, campUsed: true };
  },
};

/**
 * 通过注册表分发格子事件
 *
 * store.ts 的 revealGrid 路径 3 调用此函数，
 * 根据格子类型查找对应处理器并执行。
 *
 * @param cellType - 格子类型（treasure/trap/event/rest 等）
 * @param ctx - 格子事件上下文
 * @returns 处理结果（未知类型返回空结果，不做任何状态变更）
 */
export async function dispatchCellEvent(
  cellType: CellType,
  ctx: CellEventContext
): Promise<CellEventResult> {
  const handler = cellEventHandlers[cellType];
  if (!handler) {
    return EMPTY_RESULT;
  }
  return handler(ctx);
}

// ============================================================================
// 内部辅助：兜底奖励
// ============================================================================

/**
 * 兜底奖励：将宝箱转换为金币 + 经验奖励
 *
 * 触发场景：
 * - `template_missing`：物品模板不存在（配置缺失）
 * - `inventory_full`：背包已满，物品无法入包（BIZ-10）
 *
 * 避免玩家探索收益为零。金币/经验数值由 config/exploration.ts 配置。
 *
 * @param ctx - 处理器上下文
 * @param itemId - 物品 ID（用于日志和事件载荷）
 * @param reason - 触发兜底的原因（`template_missing` | `inventory_full`）
 */
async function grantFallbackReward(
  ctx: ExplorationContext,
  itemId: string,
  reason: 'template_missing' | 'inventory_full' = 'template_missing'
): Promise<void> {
  if (reason === 'template_missing') {
    console.warn(`[探索] 物品模板 "${itemId}" 不存在，发放兜底奖励`);
  }

  const rng = ctx.rng ?? defaultRng;
  const gold = Math.floor(rng.next() * FALLBACK_GOLD_RANDOM_RANGE) + FALLBACK_GOLD_MIN;
  const exp = Math.floor(rng.next() * FALLBACK_EXP_RANDOM_RANGE) + FALLBACK_EXP_MIN;

  await ctx.characterStore.gainGold(gold);
  await ctx.characterStore.gainExp(exp);

  const logMessage = reason === 'inventory_full'
    ? `背包已满，宝箱物品已转换为 ${gold} 金币、${exp} 经验`
    : `发现宝箱，获得 ${gold} 金币、${exp} 经验`;

  useLogStore().addLogEntry({
    id: generateLogId(),
    timestamp: Date.now(),
    type: 'item',
    message: logMessage,
    icon: 'game-icons:chest'
  });

  const convertedName = reason === 'inventory_full'
    ? `物品已满（转换为 ${gold} 金币 + ${exp} 经验）`
    : `未知物品（已转换为 ${gold} 金币 + ${exp} 经验）`;

  eventBus.emit(GameEvents.EXPLORATION_ITEM_FOUND, {
    characterId: ctx.characterId,
    itemId,
    count: 0,
    itemName: convertedName
  });

  ctx.uiCallbacks?.onItemFound?.({
    itemId,
    count: 0,
    itemName: convertedName
  });
}
