/**
 * @fileoverview Boss 出场演出引擎
 * @description 根据 Boss 出场配置（BossIntro）生成 UI 特效参数。
 *              当前为预留功能，暂未被 combat store 调用，待 UI 系统接入后启用。
 */

import type { BossIntro } from './types';

/**
 * 特效类型 → CSS class 的映射表
 *
 * 将 BossIntroEffect 枚举值映射为前端 CSS class 名称，
 * 供 UI 层通过动态 class 切换实现特效渲染。
 */
const EFFECT_CLASS_MAP: Record<string, string> = {
  darken: 'intro-darken',
  shake: 'intro-shake',
  flame: 'intro-flame',
  freeze: 'intro-freeze',
  lightning: 'intro-lightning',
};

/**
 * 创建 Boss 出场演出参数
 *
 * 根据 BossIntro 配置生成 UI 层所需的特效参数：
 * - effectClass：对应的 CSS class 名称
 * - title：以特效类型作为标题（预留后续扩展为独立的 title 字段）
 * - lines：出场台词列表
 * - duration：动画持续时长（毫秒）
 *
 * @param intro - Boss 出场配置
 * @returns 演出参数对象
 */
export function createBossIntro(intro: BossIntro): {
  /** CSS class 名称 */
  effectClass: string;
  /** 演出标题 */
  title: string;
  /** 台词列表 */
  lines: string[];
  /** 动画持续时长（毫秒） */
  duration: number;
} {
  return {
    effectClass: EFFECT_CLASS_MAP[intro.effect] || 'intro-darken',
    // 以特效类型作为标题回退值（预留后续扩展为独立的 title 字段）
    title: intro.effect,
    lines: intro.lines,
    duration: intro.duration,
  };
}
