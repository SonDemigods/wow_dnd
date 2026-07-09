/**
 * @fileoverview 战斗颜色常量单元测试
 * @description 验证 @/config/combat-colors 中所有颜色值为合法 CSS 颜色字符串
 * （#rrggbb hex 或 rgba?() 格式），且包含所有预期键。
 *
 * 该常量与 styles/variables.less 手动同步，格式错误会导致战斗演出动画渲染异常。
 */
import { describe, it, expect } from 'vitest';
import { CombatColors } from '@/config/combat-colors';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const RGBA_RE = /^rgba?\(\s*\d+/;

describe('CombatColors 战斗颜色常量', () => {
  it('包含所有预期颜色键', () => {
    const expected = [
      'damagePhysical', 'damagePhysicalBg',
      'damageMagic', 'damageMagicBg',
      'damageCrit', 'healHp', 'healMp', 'dodge',
      'flashCrit', 'flashCritFade', 'flashDodge', 'flashDodgeFade',
    ];
    for (const k of expected) {
      expect(CombatColors).toHaveProperty(k);
    }
  });

  it('所有值为非空合法颜色字符串（hex 或 rgba）', () => {
    for (const value of Object.values(CombatColors)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(HEX_RE.test(value) || RGBA_RE.test(value)).toBe(true);
    }
  });
});
