/**
 * @fileoverview Boss 出场演出引擎
 * @description 根据 Boss 出场配置生成特效参数
 */

import type { BossIntro } from './types';

/** 出场演出引擎 */
export function createBossIntro(intro: BossIntro): {
  effectClass: string;
  title: string;
  lines: string[];
  duration: number;
} {
  const effectMap: Record<string, string> = {
    darken: 'intro-darken',
    shake: 'intro-shake',
    flame: 'intro-flame',
    freeze: 'intro-freeze',
    lightning: 'intro-lightning',
  };

  return {
    effectClass: effectMap[intro.effect] || 'intro-darken',
    title: '',
    lines: intro.lines,
    duration: intro.duration,
  };
}
