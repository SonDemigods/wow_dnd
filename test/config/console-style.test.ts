/**
 * @fileoverview 控制台样式常量单元测试
 * @description 验证 @/config/console-style 中所有样式字符串非空，
 * 且 rarity 子表覆盖全部稀有度。
 *
 * 空字符串会导致 console.log %c 占位符样式失效（降级为默认颜色）。
 */
import { describe, it, expect } from 'vitest';
import { CONSOLE_STYLE } from '@/config/console-style';

describe('CONSOLE_STYLE 控制台样式常量', () => {
  const EXPECTED_STRING_KEYS = ['tag', 'ok', 'err', 'label', 'value', 'hint', 'section'] as const;
  const EXPECTED_RARITY_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

  it('所有顶层样式键为非空字符串', () => {
    for (const k of EXPECTED_STRING_KEYS) {
      expect(typeof CONSOLE_STYLE[k]).toBe('string');
      expect(CONSOLE_STYLE[k].length).toBeGreaterThan(0);
    }
  });

  it('rarity 包含全部稀有度且为非空字符串', () => {
    for (const k of EXPECTED_RARITY_KEYS) {
      expect(typeof CONSOLE_STYLE.rarity[k]).toBe('string');
      expect(CONSOLE_STYLE.rarity[k].length).toBeGreaterThan(0);
    }
  });
});
