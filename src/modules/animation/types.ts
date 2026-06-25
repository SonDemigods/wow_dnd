/**
 * @fileoverview 动画模块类型定义
 * @description 定义战斗动画系统中的浮动数字类型、粒子配置等相关类型。
 *              本文件是 animation 模块的类型基石，所有接口和类型别名均在此集中定义。
 * @module animation
 */

// ============================================================================
// 类型别名
// ============================================================================

/**
 * 浮动数字类型
 *
 * 决定 `animateFloating` 函数的动画行为参数（上升距离、缩放峰值、缓动曲线等）。
 * 每种类型对应一种战斗结果展示：
 * - `physical`：物理伤害数字
 * - `magic`：法术伤害数字
 * - `heal-hp`：生命恢复数字
 * - `heal-mp`：法力恢复数字
 * - `crit`：暴击数字
 * - `dodge`：闪避文字
 *
 * @see FLOATING_PARAMS 各类型对应的动画参数配置
 * @see animateFloating 使用此类型选择对应的关键帧参数
 */
export type FloatingType = 'physical' | 'magic' | 'heal-hp' | 'heal-mp' | 'crit' | 'dodge';

// ============================================================================
// 内部类型
// ============================================================================

/**
 * 粒子形状（模块内部类型）
 *
 * 控制 `createParticleBurst` 生成的粒子视觉效果。
 * 不对外导出，消费者通过 `ParticleConfig.shape` 间接使用。
 *
 * - `circle`：圆形粒子（填充背景色）
 * - `slash`：斜线粒子（细长条，带旋转）
 * - `star`：星形粒子（✦ 字符）
 * - `spark`：火花粒子（+ 字符，加粗）
 *
 * @see ParticleConfig.shape
 */
type ParticleShape = 'circle' | 'slash' | 'star' | 'spark';

// ============================================================================
// 核心配置接口
// ============================================================================

/**
 * 粒子配置接口
 *
 * 描述一次粒子爆发效果的所有视觉参数，由 `createParticleBurst` 消费。
 *
 * @property {number} count - 粒子数量
 * @property {string[]} colors - 粒子颜色列表（随机选取）
 * @property {ParticleShape} shape - 粒子形状
 * @property {number} radius - 飞散半径（px）
 * @property {[number, number]} sizeRange - 粒子大小范围 [min, max]（px）
 * @property {number} duration - 动画持续时间（ms）
 *
 * @see createParticleBurst 使用此接口生成粒子爆发动画
 */
export interface ParticleConfig {
  /** 粒子数量 */
  count: number;
  /** 粒子颜色列表 */
  colors: string[];
  /** 粒子形状 */
  shape: ParticleShape;
  /** 飞散半径（px） */
  radius: number;
  /** 粒子大小范围 [min, max]（px） */
  sizeRange: [number, number];
  /** 动画持续时间（ms） */
  duration: number;
}
