/**
 * @fileoverview 战斗动画模块单元测试
 * @description 覆盖 src/modules/animation/service.ts 的所有导出函数：
 * 1. scaleDuration 通过各 animate* 函数的 duration 参数间接验证（正常 speed、默认 speed、0/负值兜底）
 * 2. 震动/脉冲/光晕/暴击/闪避/浮动数字/屏幕闪白/VS 闪动/粒子爆发/Boss 出场/阶段转换/结果弹窗
 * 3. 所有 onComplete 回调执行（清理 inline style）
 * 4. createParticleBurst 4 种形状分支（circle/slash/star/spark）+ Math.random mock
 *
 * Mock 策略：
 * - animejs 的 animate / createTimeline 替换为 vi.fn，捕获调用参数
 * - 不依赖真实 anime.js 渲染，仅验证「调用了正确的函数」及参数正确性（符合 code_rule 第二章第 4 条）
 * - createElement / appendChild / removeChild 由 jsdom 提供
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================
// Mock animejs 模块 —— 必须在 import service 之前
// ============================================================
const animateMock = vi.hoisted(() => vi.fn());
const createTimelineMock = vi.hoisted(() => vi.fn(() => ({
  add: vi.fn(),
})));

vi.mock('animejs', () => ({
  animate: animateMock,
  createTimeline: createTimelineMock,
}));

// ============================================================
// 导入被测函数（在 mock 生效后）
// ============================================================
import {
  animateShake,
  animateCritShake,
  animateMagicPulse,
  animateGlow,
  animateHealGlow,
  animateManaGlow,
  animateCritBorderFlash,
  animateDodgeBlink,
  animateFloating,
  animateScreenFlash,
  animateVsFlash,
  createParticleBurst,
  animateBossIntro,
  animatePhaseTransition,
  animateResultPopup,
} from '@/modules/animation/service';
import { CombatColors } from '@/config/combat-colors';
import type { FloatingType, ParticleConfig } from '@/modules/animation/types';

// ============================================================
// 辅助：创建 DOM 元素
// ============================================================
function createElement(): HTMLElement {
  return document.createElement('div');
}

describe('animation/service 战斗动画模块', () => {
  beforeEach(() => {
    animateMock.mockReset();
    createTimelineMock.mockReset();
    createTimelineMock.mockImplementation(() => ({ add: vi.fn() }));
    // Math.random 默认不 mock，需要时在各 it 中覆盖
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // scaleDuration 间接验证 —— 通过各函数的 duration 参数
  // ============================================================
  describe('scaleDuration 速度倍率缩放', () => {
    it('speed=1 时 duration 不缩放', () => {
      const target = createElement();
      animateShake(target, 1);
      expect(animateMock).toHaveBeenCalledTimes(1);
      const args = animateMock.mock.calls[0][1];
      // 总 duration = scaleDuration(600, 1) = 600
      expect(args.duration).toBe(600);
    });

    it('speed=2 时 duration 减半', () => {
      const target = createElement();
      animateShake(target, 2);
      const args = animateMock.mock.calls[0][1];
      expect(args.duration).toBe(300);
    });

    it('默认 speed=1（缺省参数）', () => {
      const target = createElement();
      animateShake(target);
      const args = animateMock.mock.calls[0][1];
      expect(args.duration).toBe(600);
    });

    it('speed=0 时兜底为 MIN_SPEED=0.1（duration 放大 10 倍）', () => {
      const target = createElement();
      animateShake(target, 0);
      const args = animateMock.mock.calls[0][1];
      // 600 / max(0.1, 0) = 6000
      expect(args.duration).toBe(6000);
    });

    it('speed 为负值时兜底为 MIN_SPEED=0.1', () => {
      const target = createElement();
      animateShake(target, -5);
      const args = animateMock.mock.calls[0][1];
      expect(args.duration).toBe(6000);
    });
  });

  // ============================================================
  // 震动效果
  // ============================================================
  describe('震动效果', () => {
    it('animateShake 调用 animate 并配置 translateX 关键帧', () => {
      const target = createElement();
      animateShake(target, 1);
      expect(animateMock).toHaveBeenCalledTimes(1);
      const args = animateMock.mock.calls[0][1];
      expect(args.translateX).toHaveLength(5);
      expect(args.ease).toBe('easeInOutSine');
    });

    it('animateCritShake 配置更强的震动和缩放关键帧', () => {
      const target = createElement();
      animateCritShake(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.translateX).toHaveLength(6);
      expect(args.scale).toHaveLength(6);
      expect(args.duration).toBe(900);
    });
  });

  // ============================================================
  // 受击身体特效
  // ============================================================
  describe('受击身体特效', () => {
    it('animateMagicPulse 配置缩放与 boxShadow 关键帧', () => {
      const target = createElement();
      animateMagicPulse(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.scale).toHaveLength(3);
      expect(args.boxShadow).toHaveLength(2);
      expect(args.boxShadow[0].to).toContain(CombatColors.damageMagicBg);
    });

    it('animateGlow 配置带颜色的 boxShadow 关键帧', () => {
      const target = createElement();
      const color = '#ff0000';
      animateGlow(target, color, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.boxShadow[0].to).toContain(color);
      expect(args.boxShadow[0].to).toContain('88'); // 透明度后缀
    });

    it('animateHealGlow 使用 healHp 颜色', () => {
      const target = createElement();
      animateHealGlow(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.boxShadow[0].to).toContain(CombatColors.healHp);
    });

    it('animateManaGlow 使用 healMp 颜色', () => {
      const target = createElement();
      animateManaGlow(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.boxShadow[0].to).toContain(CombatColors.healMp);
    });

    it('animateHealGlow 默认 speed=1', () => {
      const target = createElement();
      animateHealGlow(target);
      expect(animateMock).toHaveBeenCalledTimes(1);
    });

    it('animateManaGlow 默认 speed=1', () => {
      const target = createElement();
      animateManaGlow(target);
      expect(animateMock).toHaveBeenCalledTimes(1);
    });

    it('animateCritBorderFlash 配置 borderColor 和 boxShadow，并清理 borderColor', () => {
      const target = createElement();
      animateCritBorderFlash(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.borderColor).toHaveLength(3);
      expect(args.boxShadow).toHaveLength(2);
      expect(args.boxShadow[0].to).toContain(CombatColors.flashCrit);
      // 执行 onComplete 应清空 borderColor
      args.onComplete();
      expect(target.style.borderColor).toBe('');
    });
  });

  // ============================================================
  // 闪避闪烁
  // ============================================================
  describe('闪避闪烁', () => {
    it('animateDodgeBlink 配置 opacity 关键帧', () => {
      const target = createElement();
      animateDodgeBlink(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.opacity).toHaveLength(4);
      expect(args.duration).toBe(800);
    });
  });

  // ============================================================
  // 浮动伤害数字
  // ============================================================
  describe('animateFloating 浮动数字', () => {
    const types: FloatingType[] = ['physical', 'magic', 'heal-hp', 'heal-mp', 'crit', 'dodge'];

    types.forEach((type) => {
      it(`type=${type} 调用 animate 并配置关键帧`, () => {
        const target = createElement();
        animateFloating(target, type, 1);
        expect(animateMock).toHaveBeenCalledTimes(1);
        const args = animateMock.mock.calls[0][1];
        expect(args.translateY).toBeDefined();
        expect(args.scale).toBeDefined();
        expect(args.opacity).toBeDefined();
        expect(args.ease).toBeDefined();
      });
    });

    it('type=physical 不生成 translateX 和 rotate（swayX=0, rotate=0）', () => {
      const target = createElement();
      animateFloating(target, 'physical', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.translateX).toBeUndefined();
      expect(args.rotate).toBeUndefined();
    });

    it('type=magic 生成正弦波 translateX（swayX=3，但不 >5）', () => {
      const target = createElement();
      animateFloating(target, 'magic', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.translateX).toBeDefined();
      expect(args.translateX).toHaveLength(3);
      expect(args.rotate).toBeUndefined();
    });

    it('type=dodge 生成快速侧移 translateX（swayX=12 >5）', () => {
      const target = createElement();
      animateFloating(target, 'dodge', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.translateX).toBeDefined();
      expect(args.translateX).toHaveLength(3);
    });

    it('type=heal-mp 生成轻微 rotate（rotate=5）', () => {
      const target = createElement();
      animateFloating(target, 'heal-mp', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.rotate).toBeDefined();
      expect(args.rotate).toHaveLength(2);
    });

    it('type=crit 使用 crit 专属关键帧（首帧 -15）', () => {
      const target = createElement();
      animateFloating(target, 'crit', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.translateY[0].to).toBe(-15);
    });

    it('onComplete 清空 opacity 和 transform', () => {
      const target = createElement();
      animateFloating(target, 'physical', 1);
      const args = animateMock.mock.calls[0][1];
      args.onComplete();
      expect(target.style.opacity).toBe('0');
      expect(target.style.transform).toBe('');
    });

    it('默认 speed=1', () => {
      const target = createElement();
      animateFloating(target, 'physical');
      expect(animateMock).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 屏幕闪白
  // ============================================================
  describe('屏幕闪白', () => {
    it('type=crit 使用 3 帧背景色', () => {
      const target = createElement();
      animateScreenFlash(target, 'crit', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.backgroundColor).toHaveLength(3);
      expect(args.backgroundColor[0].to).toBe(CombatColors.flashCrit);
      args.onComplete();
      expect(target.style.backgroundColor).toBe('transparent');
    });

    it('type=dodge 使用 2 帧背景色', () => {
      const target = createElement();
      animateScreenFlash(target, 'dodge', 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.backgroundColor).toHaveLength(2);
      expect(args.backgroundColor[0].to).toBe(CombatColors.flashDodge);
    });

    it('默认 speed=1', () => {
      const target = createElement();
      animateScreenFlash(target, 'crit');
      expect(animateMock).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // VS 分隔闪动
  // ============================================================
  describe('VS 分隔闪动', () => {
    it('animateVsFlash 配置 scale 和 color 关键帧', () => {
      const target = createElement();
      animateVsFlash(target, 1);
      const args = animateMock.mock.calls[0][1];
      expect(args.scale).toHaveLength(2);
      expect(args.color).toHaveLength(2);
      expect(args.color[1].to).toBe(CombatColors.damageCrit);
    });

    it('默认 speed=1', () => {
      const target = createElement();
      animateVsFlash(target);
      expect(animateMock).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 粒子爆发
  // ============================================================
  describe('createParticleBurst 粒子爆发', () => {
    const baseConfig: ParticleConfig = {
      count: 4,
      colors: ['#ff0000', '#00ff00'],
      shape: 'circle',
      radius: 50,
      sizeRange: [2, 6],
      duration: 500,
    };

    const baseRect = { left: 100, top: 100, width: 40, height: 40 };

    beforeEach(() => {
      // 固定 Math.random 以确定性测试
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('shape=circle 创建圆形粒子并 appendChild', () => {
      const container = createElement();
      const appendSpy = vi.spyOn(container, 'appendChild');
      createParticleBurst(container, baseRect, { ...baseConfig, shape: 'circle' }, 1);
      // count=4 → 创建 4 个粒子
      expect(appendSpy).toHaveBeenCalledTimes(4);
      // 每个粒子调用一次 animate
      expect(animateMock).toHaveBeenCalledTimes(4);
      // 验证圆形样式
      const firstParticle = appendSpy.mock.calls[0][0] as HTMLElement;
      expect(firstParticle.style.borderRadius).toBe('50%');
    });

    it('shape=slash 创建斜线粒子（width 放大 3 倍）', () => {
      const container = createElement();
      const appendSpy = vi.spyOn(container, 'appendChild');
      createParticleBurst(container, baseRect, { ...baseConfig, shape: 'slash' }, 1);
      const firstParticle = appendSpy.mock.calls[0][0] as HTMLElement;
      // size = 2 + 0.5 * (6-2) = 4; slash width = size * 3 = 12
      expect(firstParticle.style.width).toBe('12px');
      expect(firstParticle.style.height).toBe('1.6px'); // size * 0.4 = 1.6
    });

    it('shape=star 创建星形粒子（textContent=✦）', () => {
      const container = createElement();
      const appendSpy = vi.spyOn(container, 'appendChild');
      createParticleBurst(container, baseRect, { ...baseConfig, shape: 'star' }, 1);
      const firstParticle = appendSpy.mock.calls[0][0] as HTMLElement;
      expect(firstParticle.textContent).toBe('✦');
    });

    it('shape=spark 创建火花粒子（textContent=+，加粗）', () => {
      const container = createElement();
      const appendSpy = vi.spyOn(container, 'appendChild');
      createParticleBurst(container, baseRect, { ...baseConfig, shape: 'spark' }, 1);
      const firstParticle = appendSpy.mock.calls[0][0] as HTMLElement;
      expect(firstParticle.textContent).toBe('+');
      expect(firstParticle.style.fontWeight).toBe('bold');
    });

    it('默认 speed=1', () => {
      const container = createElement();
      createParticleBurst(container, baseRect, baseConfig);
      expect(animateMock).toHaveBeenCalledTimes(4);
    });

    it('onComplete 调用 particle.remove()', () => {
      const container = createElement();
      const appendSpy = vi.spyOn(container, 'appendChild');
      const removeSpy = vi.fn();
      createParticleBurst(container, baseRect, { ...baseConfig, shape: 'circle' }, 1);
      const args = animateMock.mock.calls[0][1];
      // 模拟 particle.remove 被调用
      const firstParticle = appendSpy.mock.calls[0][0] as HTMLElement;
      vi.spyOn(firstParticle, 'remove').mockImplementation(removeSpy);
      args.onComplete();
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // Boss 出场演出
  // ============================================================
  describe('animateBossIntro Boss 出场演出', () => {
    it('调用 createTimeline 并按序添加 overlay/icon/name/lines 动画', () => {
      const overlay = createElement();
      const icon = createElement();
      const name = createElement();
      const lines = [createElement(), createElement(), createElement()];
      const tlAdd = vi.fn();
      createTimelineMock.mockImplementationOnce(() => ({ add: tlAdd }));

      animateBossIntro(overlay, icon, name, lines, 5000, 1);

      expect(createTimelineMock).toHaveBeenCalledTimes(1);
      expect(createTimelineMock).toHaveBeenCalledWith({ defaults: { ease: 'easeOutCubic' } });
      // overlay(1) + icon(1) + name(1) + lines(3) = 6 次 tl.add
      expect(tlAdd).toHaveBeenCalledTimes(6);
      // 第一次添加 overlay
      expect(tlAdd.mock.calls[0][0]).toBe(overlay);
      // 第二次添加 icon
      expect(tlAdd.mock.calls[1][0]).toBe(icon);
    });

    it('空 lines 数组时不调用 lines 相关的 tl.add', () => {
      const overlay = createElement();
      const icon = createElement();
      const name = createElement();
      const tlAdd = vi.fn();
      createTimelineMock.mockImplementationOnce(() => ({ add: tlAdd }));

      animateBossIntro(overlay, icon, name, [], 5000, 1);
      // overlay + icon + name = 3 次
      expect(tlAdd).toHaveBeenCalledTimes(3);
    });

    it('通过 setTimeout 触发遮罩淡出动画', () => {
      vi.useFakeTimers();
      const overlay = createElement();
      const icon = createElement();
      const name = createElement();
      const lines = [createElement()];

      animateBossIntro(overlay, icon, name, lines, 1000, 1);
      // 在 setTimeout 触发前 animate 只被调用 0 次（仅 tl.add 调用）
      expect(animateMock).toHaveBeenCalledTimes(0);
      // 推进定时器
      vi.advanceTimersByTime(5000);
      // setTimeout 触发后调用 animate（遮罩淡出）
      expect(animateMock).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('actualDuration 不小于 minDuration', () => {
      vi.useFakeTimers();
      const overlay = createElement();
      const icon = createElement();
      const name = createElement();
      const lines = [createElement(), createElement()];
      // duration 极小，应被 minDuration 替代
      animateBossIntro(overlay, icon, name, lines, 100, 1);
      // minDuration = 1000 + 2 * 900 = 2800
      vi.advanceTimersByTime(2799);
      expect(animateMock).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(10);
      expect(animateMock).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  // ============================================================
  // Boss 阶段转换
  // ============================================================
  describe('animatePhaseTransition Boss 阶段转换', () => {
    it('调用 createTimeline 并按序添加 4 个步骤', () => {
      const backdrop = createElement();
      const content = createElement();
      const tlAdd = vi.fn();
      createTimelineMock.mockImplementationOnce(() => ({ add: tlAdd }));

      animatePhaseTransition(backdrop, content, 1);

      expect(createTimelineMock).toHaveBeenCalledTimes(1);
      // 遮罩闪现 + 内容缩放 + 保持 + 淡出 = 4 次
      expect(tlAdd).toHaveBeenCalledTimes(4);
      expect(tlAdd.mock.calls[0][0]).toBe(backdrop);
      expect(tlAdd.mock.calls[1][0]).toBe(content);
      // 第 3 次是数组 [backdrop, content]
      expect(tlAdd.mock.calls[2][0]).toEqual([backdrop, content]);
    });

    it('默认 speed=1', () => {
      const backdrop = createElement();
      const content = createElement();
      createTimelineMock.mockImplementationOnce(() => ({ add: vi.fn() }));
      animatePhaseTransition(backdrop, content);
      expect(createTimelineMock).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 结果弹窗
  // ============================================================
  describe('animateResultPopup 战斗结果弹窗', () => {
    it('调用 createTimeline 并添加 popup/icon/resultText/rewards 动画', () => {
      const popup = createElement();
      const icon = createElement();
      const resultText = createElement();
      const rewards = [createElement(), createElement()];
      const tlAdd = vi.fn();
      createTimelineMock.mockImplementationOnce(() => ({ add: tlAdd }));

      animateResultPopup(popup, icon, resultText, rewards, 1);

      expect(createTimelineMock).toHaveBeenCalledTimes(1);
      // popup + icon + resultText + 2 rewards = 5 次
      expect(tlAdd).toHaveBeenCalledTimes(5);
      expect(tlAdd.mock.calls[0][0]).toBe(popup);
      expect(tlAdd.mock.calls[1][0]).toBe(icon);
      expect(tlAdd.mock.calls[2][0]).toBe(resultText);
      expect(tlAdd.mock.calls[3][0]).toBe(rewards[0]);
      expect(tlAdd.mock.calls[4][0]).toBe(rewards[1]);
    });

    it('空 rewards 数组时不调用 rewards 相关的 tl.add', () => {
      const popup = createElement();
      const icon = createElement();
      const resultText = createElement();
      const tlAdd = vi.fn();
      createTimelineMock.mockImplementationOnce(() => ({ add: tlAdd }));

      animateResultPopup(popup, icon, resultText, [], 1);
      // popup + icon + resultText = 3 次
      expect(tlAdd).toHaveBeenCalledTimes(3);
    });

    it('默认 speed=1', () => {
      const popup = createElement();
      const icon = createElement();
      const resultText = createElement();
      createTimelineMock.mockImplementationOnce(() => ({ add: vi.fn() }));
      animateResultPopup(popup, icon, resultText, []);
      expect(createTimelineMock).toHaveBeenCalledTimes(1);
    });
  });
});
