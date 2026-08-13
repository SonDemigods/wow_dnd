/**
 * @fileoverview 音频系统配置常量
 * @description 集中管理音频系统的可调参数，避免魔法数字散落在源码中
 */

/** SFX 力度随机抖动幅度（±百分比，0.05 = ±5%） */
export const SFX_VELOCITY_JITTER = 0.05;

/** SFX 同类型节流间隔（毫秒，同一 SfxType 在此间隔内只播放一次） */
export const SFX_TYPE_THROTTLE_MS = 80;

/** 脚步声节流间隔（毫秒，探索移动时脚步声的最小间隔） */
export const STEP_THROTTLE_MS = 200;

/** BGM 场景切换交叉淡变时间（秒） */
export const BGM_CROSSFADE_SEC = 0.6;
