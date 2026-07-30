/**
 * @fileoverview 战斗视觉特效 Composable
 * @description
 *   从 CombatPopup.vue 抽离的全部战斗动画逻辑（QA-5 阶段四）。
 *
 *   职责：
 *   - 战斗动画状态（震动/闪避/浮动数字/屏幕闪白/VS 闪光/Boss 阶段转换）
 *   - 11 个 trigger* 触发函数（封装 anime.js 调用与 DOM 查询）
 *   - 5 种粒子配置常量（物理/法术/治疗/法力/暴击）
 *   - applyCombatDamageEffects：多目标/单体伤害视觉特效编排
 *   - 4 个事件处理函数：onCritHit / onEnemyDealDamage / onDodge / onBossPhase
 *
 *   设计原则：
 *   - composable 不持有 onMounted/onUnmounted，由组件统一注册
 *   - 依赖通过 options 注入：getCombatSpeed / setAnimTimer / isUnmounted
 *   - DOM 查询通过 data-* 属性精确定位（兼容多敌人场景）
 *   - 粒子容器固定为 .combat-container，确保粒子正确叠加
 *
 * @module combat/composables/useCombatAnimations
 */
import { ref, nextTick, type Ref } from 'vue';
import {
  animateShake,
  animateCritShake,
  animateDodgeBlink,
  animateFloating,
  animateScreenFlash,
  animateVsFlash,
  animateMagicPulse,
  animateHealGlow,
  animateManaGlow,
  animateCritBorderFlash,
  createParticleBurst,
  animatePhaseTransition,
} from '@/modules/animation';
import type { FloatingType, ParticleConfig } from '@/modules/animation';

/**
 * 战斗视觉特效选项
 */
export interface UseCombatAnimationsOptions {
  /** 获取当前战斗速度（1 或 2），用于缩放动画时长 */
  getCombatSpeed: () => number;
  /** 注册动画定时器（由组件统一管理清理） */
  setAnimTimer: (fn: () => void, delay: number) => ReturnType<typeof setTimeout>;
  /** 组件是否已卸载（防止异步回调在卸载后修改状态） */
  isUnmounted: Ref<boolean>;
  /** 获取当前目标敌人 ID（用于 applyCombatDamageEffects 单体伤害定位） */
  getCurrentTargetId: () => string | undefined;
}

/**
 * 战斗视觉特效
 *
 * @param options - 注入依赖
 * @returns 动画状态、模板 refs、触发函数、事件处理、dispose 清理方法
 */
export function useCombatAnimations(options: UseCombatAnimationsOptions) {
  // ==================== 动画状态（按敌人 ID 索引） ====================
  const enemyShakes = ref<Record<string, boolean>>({});
  const enemyCritShakes = ref<Record<string, boolean>>({});
  const enemyDodgeBlinks = ref<Record<string, boolean>>({});
  const enemyFloatings = ref<Record<string, { text: string; type: FloatingType } | null>>({});

  // ==================== 全局动画状态 ====================
  const playerShake = ref(false);
  const playerCritShake = ref(false);
  const playerDodgeBlink = ref(false);
  const vsFlash = ref(false);
  const playerFloating = ref<{ text: string; type: FloatingType } | null>(null);
  const screenFlash = ref(false);
  const screenFlashType = ref<'crit' | 'dodge'>('crit');

  // ==================== Boss 阶段转换特效状态 ====================
  const showPhaseTransition = ref(false);
  const phaseTransitionEffect = ref('');
  const phaseTransitionName = ref('');

  // ==================== 模板 refs（供 anime.js 直接操作 DOM） ====================
  const screenFlashRef = ref<HTMLElement | null>(null);
  const phaseBackdropRef = ref<HTMLElement | null>(null);
  const phaseContentRef = ref<HTMLElement | null>(null);
  const vsDividerRef = ref<HTMLElement | null>(null);

  // ==================== 粒子配置常量 ====================
  /** 物理伤害粒子配置 */
  const PHYSICAL_PARTICLES: ParticleConfig = {
    count: 7,
    colors: ['#ff6b6b', '#ff4444', '#ff8c00', '#ff9999'],
    shape: 'slash',
    radius: 40,
    sizeRange: [3, 6],
    duration: 800,
  };

  /** 法术伤害粒子配置 */
  const MAGIC_PARTICLES: ParticleConfig = {
    count: 11,
    colors: ['#a855f7', '#c084fc', '#9333ea', '#d8b4fe'],
    shape: 'circle',
    radius: 50,
    sizeRange: [4, 8],
    duration: 900,
  };

  /** 生命恢复粒子配置 */
  const HEAL_PARTICLES: ParticleConfig = {
    count: 9,
    colors: ['#4CAF50', '#81c784', '#a5d6a7', '#66bb6a'],
    shape: 'spark',
    radius: 35,
    sizeRange: [4, 7],
    duration: 1000,
  };

  /** 法力恢复粒子配置 */
  const MANA_PARTICLES: ParticleConfig = {
    count: 9,
    colors: ['#6e9bff', '#93acff', '#4d7cff', '#b3c8ff'],
    shape: 'star',
    radius: 35,
    sizeRange: [4, 7],
    duration: 1000,
  };

  /** 暴击粒子配置 */
  const CRIT_PARTICLES: ParticleConfig = {
    count: 16,
    colors: ['#ffd700', '#ffec8b', '#ffa500', '#ffe4b5', '#ffb90f'],
    shape: 'slash',
    radius: 60,
    sizeRange: [4, 9],
    duration: 1000,
  };

  // ==================== 触发函数 ====================

  /** 浮动伤害/恢复数字 */
  function showFloating(target: 'enemy' | 'player', text: string, type: FloatingType, enemyId?: string): void {
    if (target === 'enemy' && enemyId) {
      enemyFloatings.value[enemyId] = { text, type };
      nextTick(() => {
        const el = document.querySelector(`[data-enemy-float="${enemyId}"]`) as HTMLElement;
        if (el) animateFloating(el, type, options.getCombatSpeed());
      });
      options.setAnimTimer(() => {
        if (enemyFloatings.value[enemyId]) enemyFloatings.value[enemyId] = null;
      }, 2200);
    } else {
      playerFloating.value = { text, type };
      nextTick(() => {
        const el = document.querySelector('.player-side .floating-damage') as HTMLElement;
        if (el) animateFloating(el, type, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { playerFloating.value = null; }, 2200);
    }
  }

  /** 普通攻击震动 */
  function triggerShake(target: 'enemy' | 'player', enemyId?: string): void {
    if (target === 'enemy' && enemyId) {
      enemyShakes.value[enemyId] = true;
      nextTick(() => {
        const el = document.querySelector(`[data-enemy-shake="${enemyId}"]`) as HTMLElement;
        if (el) animateShake(el, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { enemyShakes.value[enemyId] = false; }, 600);
    } else {
      playerShake.value = true;
      nextTick(() => {
        const el = document.querySelector('.player-side') as HTMLElement;
        if (el) animateShake(el, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { playerShake.value = false; }, 600);
    }
  }

  /** 暴击震动（更强、更持久） */
  function triggerCritShake(target: 'enemy' | 'player', enemyId?: string): void {
    if (target === 'enemy' && enemyId) {
      enemyCritShakes.value[enemyId] = true;
      nextTick(() => {
        const el = document.querySelector(`[data-enemy-shake="${enemyId}"]`) as HTMLElement;
        if (el) animateCritShake(el, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { enemyCritShakes.value[enemyId] = false; }, 900);
    } else {
      playerCritShake.value = true;
      nextTick(() => {
        const el = document.querySelector('.player-side') as HTMLElement;
        if (el) animateCritShake(el, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { playerCritShake.value = false; }, 900);
    }
  }

  /** 闪避闪烁 */
  function triggerDodgeBlink(target: 'enemy' | 'player', enemyId?: string): void {
    if (target === 'enemy' && enemyId) {
      enemyDodgeBlinks.value[enemyId] = true;
      nextTick(() => {
        const el = document.querySelector(`[data-enemy-shake="${enemyId}"]`) as HTMLElement;
        if (el) animateDodgeBlink(el, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { enemyDodgeBlinks.value[enemyId] = false; }, 800);
    } else {
      playerDodgeBlink.value = true;
      nextTick(() => {
        const el = document.querySelector('.player-side') as HTMLElement;
        if (el) animateDodgeBlink(el, options.getCombatSpeed());
      });
      options.setAnimTimer(() => { playerDodgeBlink.value = false; }, 800);
    }
  }

  /** 屏幕闪白特效 */
  function triggerScreenFlash(type: 'crit' | 'dodge'): void {
    screenFlashType.value = type;
    screenFlash.value = true;
    nextTick(() => {
      if (screenFlashRef.value) {
        animateScreenFlash(screenFlashRef.value, type, options.getCombatSpeed());
      }
    });
    options.setAnimTimer(() => { screenFlash.value = false; }, 600);
  }

  /** 法术伤害缩放脉冲 */
  function triggerMagicPulse(target: 'enemy' | 'player', enemyId?: string): void {
    nextTick(() => {
      const selector = target === 'enemy' && enemyId
        ? `[data-enemy-shake="${enemyId}"]`
        : '.player-side';
      const el = document.querySelector(selector) as HTMLElement;
      if (el) animateMagicPulse(el, options.getCombatSpeed());
    });
  }

  /** 生命恢复绿色光晕 */
  function triggerHealGlow(): void {
    nextTick(() => {
      const el = document.querySelector('.player-side') as HTMLElement;
      if (el) animateHealGlow(el, options.getCombatSpeed());
    });
  }

  /** 法力恢复蓝色光晕 */
  function triggerManaGlow(): void {
    nextTick(() => {
      const el = document.querySelector('.player-side') as HTMLElement;
      if (el) animateManaGlow(el, options.getCombatSpeed());
    });
  }

  /** 暴击金色边框爆闪 */
  function triggerCritBorderFlash(target: 'enemy' | 'player', enemyId?: string): void {
    nextTick(() => {
      const selector = target === 'enemy' && enemyId
        ? `[data-enemy-shake="${enemyId}"]`
        : '.player-side';
      const el = document.querySelector(selector) as HTMLElement;
      if (el) animateCritBorderFlash(el, options.getCombatSpeed());
    });
  }

  /** 粒子爆发 */
  function triggerParticles(target: 'enemy' | 'player', config: ParticleConfig, enemyId?: string): void {
    nextTick(() => {
      const selector = target === 'enemy' && enemyId
        ? `[data-enemy-shake="${enemyId}"]`
        : '.player-side';
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const container = document.querySelector('.combat-container') as HTMLElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      createParticleBurst(container, {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      }, config, options.getCombatSpeed());
    });
  }

  /** VS 分隔线闪光（doAction / doSkill 共用） */
  function triggerVsFlash(): void {
    vsFlash.value = true;
    nextTick(() => {
      if (vsDividerRef.value) animateVsFlash(vsDividerRef.value, options.getCombatSpeed());
    });
    options.setAnimTimer(() => { vsFlash.value = false; }, 450);
  }

  /**
   * 应用战斗伤害视觉特效（多目标 / 单体），doAction / doSkill 共用
   *
   * @param result - 玩家动作结果（aoeHits 数组或 damage 单值）
   * @param damageType - 伤害类型（物理 / 法术），决定粒子样式
   */
  function applyCombatDamageEffects(
    result: { aoeHits?: { enemyId: string; damage: number }[]; damage?: number; isCrit?: boolean },
    damageType: 'physical' | 'magic' = 'physical',
  ): void {
    if (result.aoeHits && result.aoeHits.length > 0) {
      for (const hit of result.aoeHits) {
        triggerShake('enemy', hit.enemyId);
        showFloating('enemy', `-${hit.damage}`, damageType, hit.enemyId);
        triggerParticles('enemy', damageType === 'magic' ? MAGIC_PARTICLES : PHYSICAL_PARTICLES, hit.enemyId);
      }
    } else if (result.damage && result.damage > 0) {
      const targetId = options.getCurrentTargetId();
      const type: FloatingType = result.isCrit ? 'crit' : damageType;
      if (result.isCrit) {
        triggerCritShake('enemy', targetId);
        triggerCritBorderFlash('enemy', targetId);
      } else {
        triggerShake('enemy', targetId);
        if (damageType === 'magic') {
          triggerMagicPulse('enemy', targetId);
        }
      }
      showFloating('enemy', `-${result.damage}`, type, targetId);
      triggerParticles(
        'enemy',
        result.isCrit ? CRIT_PARTICLES : (damageType === 'magic' ? MAGIC_PARTICLES : PHYSICAL_PARTICLES),
        targetId,
      );
    }
  }

  // ==================== 事件处理 ====================

  /** 暴击事件处理 */
  function onCritHit(data: {
    amount: number;
    damageType: string;
    targetName: string;
    actorType: 'player' | 'enemy';
    enemyId?: string;
  }): void {
    if (options.isUnmounted.value) return;
    // 震动目标：玩家暴击震敌人，敌人暴击震玩家
    const shakeTarget = data.actorType === 'player' ? 'enemy' : 'player';
    triggerCritShake(shakeTarget, data.enemyId);
    triggerScreenFlash('crit');
    // 玩家暴击时浮动文字由 applyCombatDamageEffects 处理，此处仅处理敌人暴击
    if (data.actorType === 'enemy') {
      showFloating(shakeTarget, `暴击! -${data.amount}`, 'crit', data.enemyId);
    }
  }

  /** 敌人造成伤害事件处理（敌人攻击玩家时的视觉反馈） */
  function onEnemyDealDamage(data: {
    amount: number;
    damageType: string;
    targetName: string;
    actorType?: 'player' | 'enemy';
  }): void {
    if (options.isUnmounted.value) return;
    if (data.actorType !== 'enemy') return;
    triggerShake('player');
    showFloating('player', `-${data.amount}`, 'physical');
  }

  /** 闪避事件处理 */
  function onDodge(data: {
    attackerName: string;
    dodgerName: string;
    dodgerType: 'player' | 'enemy';
    enemyId?: string;
  }): void {
    if (options.isUnmounted.value) return;
    triggerDodgeBlink(data.dodgerType, data.enemyId);
    showFloating(data.dodgerType, '闪避!', 'dodge', data.enemyId);
    triggerScreenFlash('dodge');
  }

  /** Boss 阶段转换事件处理 */
  function onBossPhase(data: {
    enemyId: string;
    enemyName: string;
    phaseName: string;
    effect: string;
  }): void {
    if (options.isUnmounted.value) return;
    phaseTransitionEffect.value = data.effect;
    phaseTransitionName.value = `${data.enemyName} 进入 "${data.phaseName}" 阶段！`;
    showPhaseTransition.value = true;

    nextTick(() => {
      if (phaseBackdropRef.value && phaseContentRef.value) {
        animatePhaseTransition(phaseBackdropRef.value, phaseContentRef.value, options.getCombatSpeed());
      }
    });

    // 2.5 秒后自动关闭（匹配动画时长）
    options.setAnimTimer(() => {
      showPhaseTransition.value = false;
    }, 2500);
  }

  /**
   * 清理资源（占位，当前无内部定时器需清理）
   *
   * 所有动画定时器通过 setAnimTimer 注册，由组件统一清理；
   * 此方法保留以符合 Disposable 模式，便于未来扩展。
   */
  function dispose(): void {
    // 当前无内部资源需清理
  }

  return {
    // 动画状态
    enemyShakes,
    enemyCritShakes,
    enemyDodgeBlinks,
    enemyFloatings,
    playerShake,
    playerCritShake,
    playerDodgeBlink,
    vsFlash,
    playerFloating,
    screenFlash,
    screenFlashType,
    // Boss 阶段转换状态
    showPhaseTransition,
    phaseTransitionEffect,
    phaseTransitionName,
    // 模板 refs
    screenFlashRef,
    phaseBackdropRef,
    phaseContentRef,
    vsDividerRef,
    // 粒子配置（供 doSkill / useItem 使用）
    PHYSICAL_PARTICLES,
    MAGIC_PARTICLES,
    HEAL_PARTICLES,
    MANA_PARTICLES,
    CRIT_PARTICLES,
    // 触发函数
    showFloating,
    triggerShake,
    triggerCritShake,
    triggerDodgeBlink,
    triggerScreenFlash,
    triggerMagicPulse,
    triggerHealGlow,
    triggerManaGlow,
    triggerCritBorderFlash,
    triggerParticles,
    triggerVsFlash,
    // 编排函数
    applyCombatDamageEffects,
    // 事件处理
    onCritHit,
    onEnemyDealDamage,
    onDodge,
    onBossPhase,
    // 资源清理
    dispose,
  };
}
