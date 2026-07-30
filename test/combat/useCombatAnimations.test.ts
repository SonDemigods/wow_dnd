/**
 * @fileoverview 战斗视觉特效 Composable（useCombatAnimations）单元测试
 *
 * 覆盖：
 * 1. 粒子配置常量（5 种）值正确
 * 2. trigger* 触发函数（11 个）调用正确的 animation 函数
 *    - showFloating / triggerShake / triggerCritShake / triggerDodgeBlink
 *    - triggerScreenFlash / triggerMagicPulse / triggerHealGlow / triggerManaGlow
 *    - triggerCritBorderFlash / triggerParticles / triggerVsFlash
 * 3. applyCombatDamageEffects：多目标 / 单体 / 暴击 / 法术伤害编排
 * 4. 事件处理：onCritHit / onEnemyDealDamage / onDodge / onBossPhase
 * 5. isUnmounted 守卫
 *
 * Mock 策略：
 *  - mock 全部 animation 函数（animateShake / animateCritShake / ... / createParticleBurst）
 *  - mock document.querySelector 返回模拟 DOM 元素
 *  - 使用注入的 setAnimTimer mock 记录回调
 *  - 使用 flushPromises 等待 nextTick
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';

// ==================== Mock（使用 vi.hoisted 确保提升时已初始化） ====================

const { animationMocks } = vi.hoisted(() => ({
  animationMocks: {
    animateShake: vi.fn(),
    animateCritShake: vi.fn(),
    animateDodgeBlink: vi.fn(),
    animateFloating: vi.fn(),
    animateScreenFlash: vi.fn(),
    animateVsFlash: vi.fn(),
    animateMagicPulse: vi.fn(),
    animateHealGlow: vi.fn(),
    animateManaGlow: vi.fn(),
    animateCritBorderFlash: vi.fn(),
    createParticleBurst: vi.fn(),
    animatePhaseTransition: vi.fn(),
  },
}));

vi.mock('@/modules/animation', () => animationMocks);

// ==================== DOM Mock ====================

/** 构造模拟 DOM 元素（带 getBoundingClientRect） */
function makeElement(id?: string): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      left: 100,
      top: 200,
      width: 50,
      height: 50,
      right: 150,
      bottom: 250,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;
}

/** querySelector mock 实现 */
function mockQuerySelector(selector: string): HTMLElement | null {
  if (selector === '.combat-container') return makeElement('container');
  if (selector.startsWith('[data-enemy-')) return makeElement(selector);
  if (selector === '.player-side' || selector.startsWith('.player-side')) return makeElement('player');
  return null;
}

// ==================== 导入被测模块 ====================

import { useCombatAnimations } from '@/modules/combat/composables/useCombatAnimations';

// ==================== 测试用例 ====================

describe('useCombatAnimations 战斗视觉特效', () => {
  let isUnmounted: ReturnType<typeof ref<boolean>>;
  let animTimerCallbacks: Array<() => void>;
  let setAnimTimerMock: ReturnType<typeof vi.fn>;
  let querySelectorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    isUnmounted = ref(false);
    animTimerCallbacks = [];
    setAnimTimerMock = vi.fn((fn: () => void, _delay: number) => {
      animTimerCallbacks.push(fn);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
    querySelectorSpy = vi.spyOn(document, 'querySelector').mockImplementation(mockQuerySelector as never);
  });

  /** 构造 composable */
  function makeAnimations(currentTargetId?: string) {
    return useCombatAnimations({
      getCombatSpeed: () => 1,
      setAnimTimer: setAnimTimerMock,
      isUnmounted,
      getCurrentTargetId: () => currentTargetId,
    });
  }

  /** 触发所有已注册的动画定时器回调 */
  function flushAnimTimers() {
    const callbacks = [...animTimerCallbacks];
    animTimerCallbacks.length = 0;
    for (const cb of callbacks) cb();
  }

  // -------------------- 粒子配置常量 --------------------

  describe('粒子配置常量', () => {
    it('PHYSICAL_PARTICLES 物理伤害粒子配置', () => {
      const { PHYSICAL_PARTICLES } = makeAnimations();
      expect(PHYSICAL_PARTICLES.count).toBe(7);
      expect(PHYSICAL_PARTICLES.shape).toBe('slash');
      expect(PHYSICAL_PARTICLES.colors).toHaveLength(4);
    });

    it('MAGIC_PARTICLES 法术伤害粒子配置', () => {
      const { MAGIC_PARTICLES } = makeAnimations();
      expect(MAGIC_PARTICLES.count).toBe(11);
      expect(MAGIC_PARTICLES.shape).toBe('circle');
    });

    it('HEAL_PARTICLES 生命恢复粒子配置', () => {
      const { HEAL_PARTICLES } = makeAnimations();
      expect(HEAL_PARTICLES.count).toBe(9);
      expect(HEAL_PARTICLES.shape).toBe('spark');
    });

    it('MANA_PARTICLES 法力恢复粒子配置', () => {
      const { MANA_PARTICLES } = makeAnimations();
      expect(MANA_PARTICLES.count).toBe(9);
      expect(MANA_PARTICLES.shape).toBe('star');
    });

    it('CRIT_PARTICLES 暴击粒子配置', () => {
      const { CRIT_PARTICLES } = makeAnimations();
      expect(CRIT_PARTICLES.count).toBe(16);
      expect(CRIT_PARTICLES.shape).toBe('slash');
    });
  });

  // -------------------- 初始状态 --------------------

  describe('初始状态', () => {
    it('动画状态初始为空/false', () => {
      const a = makeAnimations();
      expect(a.enemyShakes.value).toEqual({});
      expect(a.playerShake.value).toBe(false);
      expect(a.vsFlash.value).toBe(false);
      expect(a.screenFlash.value).toBe(false);
      expect(a.showPhaseTransition.value).toBe(false);
    });
  });

  // -------------------- showFloating --------------------

  describe('showFloating 浮动数字', () => {
    it('敌人浮动数字：设置 enemyFloatings 并调用 animateFloating', async () => {
      const { showFloating, enemyFloatings } = makeAnimations();
      showFloating('enemy', '-50', 'physical', 'enemy-1');
      expect(enemyFloatings.value['enemy-1']).toEqual({ text: '-50', type: 'physical' });
      await flushPromises();
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('玩家浮动数字：设置 playerFloating 并调用 animateFloating', async () => {
      const { showFloating, playerFloating } = makeAnimations();
      showFloating('player', '-30', 'physical');
      expect(playerFloating.value).toEqual({ text: '-30', type: 'physical' });
      await flushPromises();
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('定时器回调后清除浮动数字', async () => {
      const { showFloating, playerFloating } = makeAnimations();
      showFloating('player', '-30', 'physical');
      flushAnimTimers();
      expect(playerFloating.value).toBeNull();
    });
  });

  // -------------------- triggerShake --------------------

  describe('triggerShake 震动', () => {
    it('敌人震动：设置 enemyShakes 并调用 animateShake', async () => {
      const { triggerShake, enemyShakes } = makeAnimations();
      triggerShake('enemy', 'enemy-1');
      expect(enemyShakes.value['enemy-1']).toBe(true);
      await flushPromises();
      expect(animationMocks.animateShake).toHaveBeenCalledTimes(1);
    });

    it('玩家震动：设置 playerShake 并调用 animateShake', async () => {
      const { triggerShake, playerShake } = makeAnimations();
      triggerShake('player');
      expect(playerShake.value).toBe(true);
      await flushPromises();
      expect(animationMocks.animateShake).toHaveBeenCalledTimes(1);
    });

    it('定时器回调后重置震动状态', () => {
      const { triggerShake, playerShake } = makeAnimations();
      triggerShake('player');
      flushAnimTimers();
      expect(playerShake.value).toBe(false);
    });
  });

  // -------------------- triggerCritShake --------------------

  describe('triggerCritShake 暴击震动', () => {
    it('敌人暴击震动：设置 enemyCritShakes 并调用 animateCritShake', async () => {
      const { triggerCritShake, enemyCritShakes } = makeAnimations();
      triggerCritShake('enemy', 'enemy-1');
      expect(enemyCritShakes.value['enemy-1']).toBe(true);
      await flushPromises();
      expect(animationMocks.animateCritShake).toHaveBeenCalledTimes(1);
    });

    it('玩家暴击震动：设置 playerCritShake', async () => {
      const { triggerCritShake, playerCritShake } = makeAnimations();
      triggerCritShake('player');
      expect(playerCritShake.value).toBe(true);
      await flushPromises();
      expect(animationMocks.animateCritShake).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- triggerDodgeBlink --------------------

  describe('triggerDodgeBlink 闪避闪烁', () => {
    it('敌人闪避：设置 enemyDodgeBlinks 并调用 animateDodgeBlink', async () => {
      const { triggerDodgeBlink, enemyDodgeBlinks } = makeAnimations();
      triggerDodgeBlink('enemy', 'enemy-1');
      expect(enemyDodgeBlinks.value['enemy-1']).toBe(true);
      await flushPromises();
      expect(animationMocks.animateDodgeBlink).toHaveBeenCalledTimes(1);
    });

    it('玩家闪避：设置 playerDodgeBlink', async () => {
      const { triggerDodgeBlink, playerDodgeBlink } = makeAnimations();
      triggerDodgeBlink('player');
      expect(playerDodgeBlink.value).toBe(true);
    });
  });

  // -------------------- triggerScreenFlash --------------------

  describe('triggerScreenFlash 屏幕闪白', () => {
    it('设置 screenFlashType 和 screenFlash', async () => {
      const { triggerScreenFlash, screenFlash, screenFlashType } = makeAnimations();
      triggerScreenFlash('crit');
      expect(screenFlashType.value).toBe('crit');
      expect(screenFlash.value).toBe(true);
    });

    it('调用 animateScreenFlash（screenFlashRef 就绪时）', async () => {
      const a = makeAnimations();
      a.screenFlashRef.value = makeElement();
      a.triggerScreenFlash('dodge');
      await flushPromises();
      expect(animationMocks.animateScreenFlash).toHaveBeenCalledWith(expect.anything(), 'dodge', 1);
    });

    it('screenFlashRef 为 null 时不调用 animateScreenFlash', async () => {
      const { triggerScreenFlash } = makeAnimations();
      triggerScreenFlash('crit');
      await flushPromises();
      expect(animationMocks.animateScreenFlash).not.toHaveBeenCalled();
    });
  });

  // -------------------- triggerMagicPulse / triggerHealGlow / triggerManaGlow / triggerCritBorderFlash --------------------

  describe('triggerMagicPulse 法术脉冲', () => {
    it('敌人目标调用 animateMagicPulse', async () => {
      const { triggerMagicPulse } = makeAnimations();
      triggerMagicPulse('enemy', 'enemy-1');
      await flushPromises();
      expect(animationMocks.animateMagicPulse).toHaveBeenCalledTimes(1);
    });

    it('玩家目标调用 animateMagicPulse', async () => {
      const { triggerMagicPulse } = makeAnimations();
      triggerMagicPulse('player');
      await flushPromises();
      expect(animationMocks.animateMagicPulse).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerHealGlow 治疗光晕', () => {
    it('调用 animateHealGlow', async () => {
      const { triggerHealGlow } = makeAnimations();
      triggerHealGlow();
      await flushPromises();
      expect(animationMocks.animateHealGlow).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerManaGlow 法力光晕', () => {
    it('调用 animateManaGlow', async () => {
      const { triggerManaGlow } = makeAnimations();
      triggerManaGlow();
      await flushPromises();
      expect(animationMocks.animateManaGlow).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerCritBorderFlash 暴击边框', () => {
    it('敌人目标调用 animateCritBorderFlash', async () => {
      const { triggerCritBorderFlash } = makeAnimations();
      triggerCritBorderFlash('enemy', 'enemy-1');
      await flushPromises();
      expect(animationMocks.animateCritBorderFlash).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- triggerParticles --------------------

  describe('triggerParticles 粒子爆发', () => {
    it('敌人目标调用 createParticleBurst', async () => {
      const { triggerParticles, PHYSICAL_PARTICLES } = makeAnimations();
      triggerParticles('enemy', PHYSICAL_PARTICLES, 'enemy-1');
      await flushPromises();
      expect(animationMocks.createParticleBurst).toHaveBeenCalledTimes(1);
    });

    it('玩家目标调用 createParticleBurst', async () => {
      const { triggerParticles, HEAL_PARTICLES } = makeAnimations();
      triggerParticles('player', HEAL_PARTICLES);
      await flushPromises();
      expect(animationMocks.createParticleBurst).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- triggerVsFlash --------------------

  describe('triggerVsFlash VS 闪光', () => {
    it('设置 vsFlash 为 true', () => {
      const { triggerVsFlash, vsFlash } = makeAnimations();
      triggerVsFlash();
      expect(vsFlash.value).toBe(true);
    });

    it('vsDividerRef 就绪时调用 animateVsFlash', async () => {
      const a = makeAnimations();
      a.vsDividerRef.value = makeElement();
      a.triggerVsFlash();
      await flushPromises();
      expect(animationMocks.animateVsFlash).toHaveBeenCalledTimes(1);
    });

    it('定时器回调后重置 vsFlash', () => {
      const { triggerVsFlash, vsFlash } = makeAnimations();
      triggerVsFlash();
      flushAnimTimers();
      expect(vsFlash.value).toBe(false);
    });
  });

  // -------------------- applyCombatDamageEffects --------------------

  describe('applyCombatDamageEffects 伤害特效编排', () => {
    it('AOE 伤害：每个目标触发 shake + floating + particles', async () => {
      const { applyCombatDamageEffects } = makeAnimations();
      applyCombatDamageEffects({
        aoeHits: [
          { enemyId: 'e1', damage: 30 },
          { enemyId: 'e2', damage: 50 },
        ],
      });
      await flushPromises();
      // 每个 hit 触发 1 次 shake + 1 次 floating + 1 次 particles
      expect(animationMocks.animateShake).toHaveBeenCalledTimes(2);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(2);
      expect(animationMocks.createParticleBurst).toHaveBeenCalledTimes(2);
    });

    it('单体物理伤害：触发 shake + floating + particles', async () => {
      const { applyCombatDamageEffects } = makeAnimations('enemy-1');
      applyCombatDamageEffects({ damage: 40 });
      await flushPromises();
      expect(animationMocks.animateShake).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
      expect(animationMocks.createParticleBurst).toHaveBeenCalledTimes(1);
    });

    it('单体法术伤害：触发 shake + magicPulse + floating + particles', async () => {
      const { applyCombatDamageEffects } = makeAnimations('enemy-1');
      applyCombatDamageEffects({ damage: 40 }, 'magic');
      await flushPromises();
      expect(animationMocks.animateShake).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateMagicPulse).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('暴击伤害：触发 critShake + critBorderFlash + floating + particles', async () => {
      const { applyCombatDamageEffects } = makeAnimations('enemy-1');
      applyCombatDamageEffects({ damage: 80, isCrit: true });
      await flushPromises();
      expect(animationMocks.animateCritShake).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateCritBorderFlash).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('damage 为 0 时不触发特效', async () => {
      const { applyCombatDamageEffects } = makeAnimations('enemy-1');
      applyCombatDamageEffects({ damage: 0 });
      await flushPromises();
      expect(animationMocks.animateShake).not.toHaveBeenCalled();
    });

    it('无 aoeHits 且无 damage 时不触发特效', async () => {
      const { applyCombatDamageEffects } = makeAnimations('enemy-1');
      applyCombatDamageEffects({});
      await flushPromises();
      expect(animationMocks.animateShake).not.toHaveBeenCalled();
    });
  });

  // -------------------- 事件处理 --------------------

  describe('onCritHit 暴击事件', () => {
    it('玩家暴击：震敌人 + 屏幕闪白', () => {
      const { onCritHit } = makeAnimations();
      onCritHit({
        amount: 80,
        damageType: 'physical',
        targetName: 'goblin',
        actorType: 'player',
        enemyId: 'enemy-1',
      });
      // 玩家暴击震敌人，不显示浮动文字（由 applyCombatDamageEffects 处理）
      expect(animationMocks.animateCritShake).not.toHaveBeenCalled(); // nextTick 未 flush
    });

    it('敌人暴击：震玩家 + 屏幕闪白 + 浮动文字', async () => {
      const { onCritHit } = makeAnimations();
      onCritHit({
        amount: 50,
        damageType: 'physical',
        targetName: 'player',
        actorType: 'enemy',
      });
      await flushPromises();
      expect(animationMocks.animateCritShake).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('isUnmounted 时不处理', () => {
      isUnmounted.value = true;
      const { onCritHit } = makeAnimations();
      onCritHit({ amount: 50, damageType: 'physical', targetName: '', actorType: 'player' });
      expect(animationMocks.animateCritShake).not.toHaveBeenCalled();
    });
  });

  describe('onEnemyDealDamage 敌人伤害事件', () => {
    it('敌人对玩家造成伤害：震玩家 + 浮动文字', async () => {
      const { onEnemyDealDamage } = makeAnimations();
      onEnemyDealDamage({ amount: 30, damageType: 'physical', targetName: 'player', actorType: 'enemy' });
      await flushPromises();
      expect(animationMocks.animateShake).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('actorType 非 enemy 时不处理', () => {
      const { onEnemyDealDamage } = makeAnimations();
      onEnemyDealDamage({ amount: 30, damageType: 'physical', targetName: '', actorType: 'player' });
      expect(animationMocks.animateShake).not.toHaveBeenCalled();
    });

    it('isUnmounted 时不处理', () => {
      isUnmounted.value = true;
      const { onEnemyDealDamage } = makeAnimations();
      onEnemyDealDamage({ amount: 30, damageType: 'physical', targetName: '', actorType: 'enemy' });
      expect(animationMocks.animateShake).not.toHaveBeenCalled();
    });
  });

  describe('onDodge 闪避事件', () => {
    it('玩家闪避：闪烁 + 浮动文字 + 屏幕闪白', async () => {
      const { onDodge } = makeAnimations();
      onDodge({ attackerName: 'goblin', dodgerName: 'player', dodgerType: 'player' });
      await flushPromises();
      expect(animationMocks.animateDodgeBlink).toHaveBeenCalledTimes(1);
      expect(animationMocks.animateFloating).toHaveBeenCalledTimes(1);
    });

    it('敌人闪避：闪烁 + 浮动文字 + 屏幕闪白', async () => {
      const { onDodge } = makeAnimations();
      onDodge({ attackerName: 'player', dodgerName: 'goblin', dodgerType: 'enemy', enemyId: 'e1' });
      await flushPromises();
      expect(animationMocks.animateDodgeBlink).toHaveBeenCalledTimes(1);
    });

    it('isUnmounted 时不处理', () => {
      isUnmounted.value = true;
      const { onDodge } = makeAnimations();
      onDodge({ attackerName: '', dodgerName: '', dodgerType: 'player' });
      expect(animationMocks.animateDodgeBlink).not.toHaveBeenCalled();
    });
  });

  describe('onBossPhase Boss 阶段转换', () => {
    it('设置阶段转换状态并调用 animatePhaseTransition', async () => {
      const a = makeAnimations();
      a.phaseBackdropRef.value = makeElement();
      a.phaseContentRef.value = makeElement();
      a.onBossPhase({ enemyId: 'boss-1', enemyName: '黑暗领主', phaseName: '狂暴', effect: 'flame' });
      expect(a.showPhaseTransition.value).toBe(true);
      expect(a.phaseTransitionEffect.value).toBe('flame');
      expect(a.phaseTransitionName.value).toContain('黑暗领主');
      expect(a.phaseTransitionName.value).toContain('狂暴');
      await flushPromises();
      expect(animationMocks.animatePhaseTransition).toHaveBeenCalledTimes(1);
    });

    it('定时器回调后关闭阶段转换', () => {
      const a = makeAnimations();
      a.onBossPhase({ enemyId: 'boss-1', enemyName: '', phaseName: '', effect: '' });
      flushAnimTimers();
      expect(a.showPhaseTransition.value).toBe(false);
    });

    it('isUnmounted 时不处理', () => {
      isUnmounted.value = true;
      const { onBossPhase, showPhaseTransition } = makeAnimations();
      onBossPhase({ enemyId: '', enemyName: '', phaseName: '', effect: '' });
      expect(showPhaseTransition.value).toBe(false);
    });
  });
});
