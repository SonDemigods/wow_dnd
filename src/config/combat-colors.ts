/**
 * @fileoverview 战斗颜色常量
 * @description 与 src/styles/variables.less 中的战斗颜色 Less 变量保持同步。
 * 由于 TS 无法直接引用 Less 变量，此处手动维护一份副本。
 */

/** 战斗颜色常量（与 variables.less 中的 Less 变量保持同步） */
export const CombatColors = {
  /** 物理伤害 - 红色 */
  damagePhysical: '#ff6b6b',
  /** 物理伤害背景 */
  damagePhysicalBg: 'rgba(255, 107, 107, 0.2)',
  /** 法术伤害 - 紫色 */
  damageMagic: '#a855f7',
  /** 法术伤害背景 */
  damageMagicBg: 'rgba(168, 85, 247, 0.2)',
  /** 暴击伤害 - 金色 */
  damageCrit: '#ffd700',
  /** 生命恢复 - 翠绿 */
  healHp: '#4CAF50',
  /** 法力恢复 - 蓝色 */
  healMp: '#6e9bff',
  /** 闪避 - 灰色 */
  dodge: '#888888',
  /** 暴击屏幕闪白 */
  flashCrit: 'rgba(255, 215, 0, 0.4)',
  /** 暴击闪白淡出 */
  flashCritFade: 'rgba(255, 215, 0, 0.15)',
  /** 闪避屏幕闪白 */
  flashDodge: 'rgba(255, 255, 255, 0.2)',
  /** 闪避闪白淡出 */
  flashDodgeFade: 'rgba(255, 255, 255, 0.05)',
} as const;
