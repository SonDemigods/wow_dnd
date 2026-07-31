/**
 * @fileoverview 游戏全局状态模块统一导出入口
 * @description 导出 GameStore 及相关类型，是全局游戏状态的唯一入口。
 *   其他模块（character/shop/audio）通过本入口访问 GameStore 读写全局状态。
 * @module game
 */

export type { GameSettings, GameRuntimeState } from './types';
export { DEFAULT_GAME_SETTINGS } from './types';
export { useGameStore } from './store';
