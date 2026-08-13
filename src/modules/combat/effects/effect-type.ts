/**
 * @fileoverview EffectType 独立类型定义
 * @description 从 effects/types.ts 拆出，供 skill 等外部模块引用，
 *              消除 skill ↔ combat 模块间类型循环依赖（P3-164）。
 *              本文件无任何 import，不产生模块间依赖。
 */

/** 效果类型 */
export type EffectType =
  | 'poison'       // 中毒：每回合扣血
  | 'burn'         // 灼烧：每回合扣血（比毒强）
  | 'stun'         // 眩晕：跳过回合
  | 'freeze'       // 冰冻：跳过回合+减速
  | 'silence'      // 沉默：无法使用技能
  | 'shield'       // 护盾：吸收伤害
  | 'attack_up'    // 攻击上升
  | 'attack_down'  // 攻击下降
  | 'defense_up'   // 防御上升
  | 'defense_down' // 防御下降
  | 'speed_up'     // 速度上升
  | 'speed_down'   // 速度下降
  | 'regen'        // 恢复：每回合回血
  | 'vulnerable'   // 易伤：受到的伤害增加
  | 'thorn';       // 反伤：反弹受到的伤害

/** P4-022 修复：EffectType 值集合，供运行时校验使用 */
const EFFECT_TYPE_VALUES: ReadonlySet<string> = new Set([
  'poison', 'burn', 'stun', 'freeze', 'silence', 'shield',
  'attack_up', 'attack_down', 'defense_up', 'defense_down',
  'speed_up', 'speed_down', 'regen', 'vulnerable', 'thorn',
]);

/**
 * 类型守卫：验证字符串是否为合法的 EffectType
 * 替代裸 `as EffectType` 断言，提供运行时安全保障。
 */
export function isEffectType(value: string): value is EffectType {
  return EFFECT_TYPE_VALUES.has(value);
}
