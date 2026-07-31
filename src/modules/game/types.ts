/**
 * @fileoverview 游戏全局状态模块类型定义
 * @description 定义 GameStore 持有的全局状态类型。
 *   GameSettings 收敛原 GameStateStorage.settings（未使用）与 audio_settings 键的音频设置，
 *   统一作为 GameStore 的 gameSettings 字段持久化到 runtime_gameState 表。
 * @module game
 */

/**
 * 游戏设置（含音频设置）
 *
 * 合并原 `GameStateStorage.settings`（soundEnabled/musicEnabled/autoSave/difficulty，
 * 历史上未实际使用）与 `audio_settings` 键的 AudioSettings。
 * 迁移后：
 * - 音频相关字段（masterVolume/sfxVolume/bgmVolume/muted/sfxEnabled/bgmEnabled）来自原 audio_settings
 * - autoSave/difficulty 保留为可选字段，供未来功能使用
 * - soundEnabled/musicEnabled 废弃（已被 sfxEnabled/bgmEnabled 替代），迁移时不写入
 */
export interface GameSettings {
  // 音频设置（原 audio_settings 键）
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  muted: boolean;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  // 游戏设置（原 GameStateStorage.settings，保留供未来使用）
  autoSave?: boolean;
  difficulty?: string;
}

/**
 * GameStore 运行时状态结构
 *
 * 对应 runtime_gameState 表 id='gameState' 的记录，
 * 但 gameSettings 字段合并了原 audio_settings 键的数据。
 */
export interface GameRuntimeState {
  currentCharacterId: string | null;
  currentShopId: string | null;
  lastPlayedAt: string;
  initializedAt: string;
  gameSettings: GameSettings;
}

/**
 * 默认游戏设置
 *
 * 音频默认值与原 DEFAULT_AUDIO_SETTINGS 保持一致，确保迁移前后行为一致。
 */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  bgmVolume: 0.5,
  muted: false,
  sfxEnabled: true,
  bgmEnabled: true,
  autoSave: true,
  difficulty: 'normal',
};
