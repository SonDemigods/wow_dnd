/**
 * @fileoverview 效果处理器注册表
 * @description EffectHandler 接口定义 + EffectHandlerRegistry 注册表类
 */

import type { Effect, EffectContainer, EffectContext, EffectType, TickResult } from './types';

/** 效果处理器接口 */
export interface EffectHandler {
  /** 处理的效果类型 */
  type: EffectType;

  // ===== 生命周期钩子 =====

  /** 效果被施加到目标时调用 */
  onApply?(effect: Effect, ctx: EffectContext): void;

  /** 每回合推进时调用，返回持续伤害/治疗 */
  onTick?(effect: Effect, ctx: EffectContext): TickResult;

  /** 效果被移除时调用 */
  onRemove?(effect: Effect, ctx: EffectContext): void;

  // ===== 伤害计算管线 =====

  /**
   * 攻击方修正 — 当拥有此效果的单位发起攻击时调用
   * 返回倍率（如 1.18 表示 +18%，0.85 表示 -15%）
   */
  getAttackerDamageMod?(effect: Effect, ctx: EffectContext): number;

  /**
   * 防御方修正 — 当拥有此效果的单位被攻击时调用
   * 返回倍率（如 1.12 表示承受 +12% 伤害）
   */
  getDefenderDamageMod?(effect: Effect, ctx: EffectContext): number;

  /**
   * 伤害吸收（护盾）— 在防御方修正之后、实际扣血之前调用
   * 返回本次可吸收的伤害量
   */
  getDamageAbsorb?(effect: Effect, incomingDamage: number): number;

  /**
   * 反伤 — 受到攻击后调用
   * 返回反弹给攻击方的伤害量
   */
  getThornDamage?(effect: Effect, incomingDamage: number): number;

  // ===== 控制效果 =====

  /** 返回被禁用的行动类型列表 */
  getDisabledActions?(effect: Effect): ActionType[];

  // ===== 回合速度 =====

  /** 返回速度修正值（正数=加速，负数=减速） */
  getSpeedMod?(effect: Effect): number;
}

/** 被禁用的行动类型 */
export type ActionType = 'attack' | 'skill' | 'flee';

/**
 * 效果处理器注册表
 * 所有 EffectHandler 通过注册表统一管理，替代原有的 switch-case 硬编码
 */
export class EffectHandlerRegistry {
  private handlers = new Map<EffectType, EffectHandler>();

  /** 注册一个效果处理器 */
  register(handler: EffectHandler): void {
    if (this.handlers.has(handler.type)) {
      console.warn(`[EffectRegistry] 覆盖已注册的处理器: ${handler.type}`);
    }
    this.handlers.set(handler.type, handler);
  }

  /** 批量注册 */
  registerAll(handlers: EffectHandler[]): void {
    for (const h of handlers) {
      this.register(h);
    }
  }

  /** 获取指定类型的处理器 */
  get(type: EffectType): EffectHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * 遍历容器中所有效果，调用指定倍率方法，累乘结果（用于伤害修正）
   */
  reduceMultiplier(
    container: EffectContainer,
    method: 'getAttackerDamageMod' | 'getDefenderDamageMod',
    ctx: EffectContext
  ): number {
    let result = 1.0;
    for (const effect of container.effects) {
      const handler = this.handlers.get(effect.type);
      if (!handler) continue;
      const fn = handler[method] as ((e: Effect, c: EffectContext) => number) | undefined;
      if (fn) {
        result *= fn(effect, ctx);
      }
    }
    return result;
  }

  /**
   * 遍历容器中所有效果，调用指定方法，累加结果（用于护盾、反伤、速度）
   */
  reduceSum(
    container: EffectContainer,
    method: 'getDamageAbsorb' | 'getThornDamage' | 'getSpeedMod',
    ctx: EffectContext,
    extra: number = 0
  ): number {
    let result = 0;
    for (const effect of container.effects) {
      const handler = this.handlers.get(effect.type);
      if (!handler) continue;
      const fn = handler[method] as ((e: Effect, ...args: unknown[]) => number) | undefined;
      if (fn) {
        result += fn(effect, extra, ctx);
      }
    }
    return result;
  }

  /**
   * 推进容器中所有效果（每回合结束时调用）
   * 返回过期效果 ID 和持续伤害/治疗总量
   */
  tickAll(container: EffectContainer, ctx: EffectContext): { expiredIds: string[]; dotDamage: number; regenAmount: number } {
    const expiredIds: string[] = [];
    let dotDamage = 0;
    let regenAmount = 0;

    for (const effect of container.effects) {
      effect.remainingTurns--;

      const handler = this.handlers.get(effect.type);
      if (handler?.onTick) {
        const tickResult = handler.onTick(effect, ctx);
        dotDamage += tickResult.dotDamage;
        regenAmount += tickResult.regenAmount;
      }

      if (effect.remainingTurns <= 0) {
        expiredIds.push(effect.id);
        handler?.onRemove?.(effect, ctx);
      }
    }

    // 清理过期效果
    container.effects = container.effects.filter(e => e.remainingTurns > 0);

    return { expiredIds, dotDamage, regenAmount };
  }

  /**
   * 检查容器中的效果是否禁用某些行动
   */
  getDisabledActions(container: EffectContainer): { skipTurn: boolean; types: ActionType[] } {
    const types: ActionType[] = [];
    for (const effect of container.effects) {
      const handler = this.handlers.get(effect.type);
      if (handler?.getDisabledActions) {
        const actions = handler.getDisabledActions(effect);
        for (const a of actions) {
          if (!types.includes(a)) types.push(a);
        }
      }
    }
    // 眩晕/冰冻时强制跳过回合
    const hasStunOrFreeze = container.effects.some(
      e => e.type === 'stun' || e.type === 'freeze'
    );
    return { skipTurn: hasStunOrFreeze, types };
  }

  /** 检查是否注册了所有内置处理器 */
  get registeredCount(): number {
    return this.handlers.size;
  }
}
