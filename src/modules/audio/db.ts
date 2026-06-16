/**
 * @fileoverview 音频模块数据层
 * @description 封装音频设置相关的 IndexedDB 持久化操作，
 * 将设置存储在 runtime_gameState 表中，以特定键标识
 */

import type { GameStateStorage } from '../data/core';
import { getGameState, saveGameState } from '../data/gameStateHelper';
import type { AudioSettings } from './types';

/** runtime_gameState 中存储音频设置的键名 */
const DB_KEY = 'audio_settings';

/**
 * 音频数据层服务
 * 负责音频设置的持久化读写，与 IndexedDB 交互
 */
class AudioDbService {
  /**
   * 保存音频设置到数据库
   * @param settings - 完整音频设置对象
   */
  async saveSettings(settings: AudioSettings): Promise<void> {
    try {
      await saveGameState(settings as unknown as Partial<GameStateStorage>, DB_KEY);
    } catch (e) {
      console.warn('[AudioDb] 保存音频设置失败:', e);
    }
  }

  /**
   * 从数据库加载音频设置
   * @returns 保存的设置，若不存在则返回 null
   */
  async loadSettings(): Promise<AudioSettings | null> {
    try {
      const saved = await getGameState(DB_KEY);
      if (!saved) return null;

      return {
        masterVolume: ((saved as Record<string, unknown>).masterVolume as number) ?? 0.8,
        sfxVolume: ((saved as Record<string, unknown>).sfxVolume as number) ?? 0.8,
        bgmVolume: ((saved as Record<string, unknown>).bgmVolume as number) ?? 0.8,
        muted: ((saved as Record<string, unknown>).muted as boolean) ?? false,
        sfxEnabled: ((saved as Record<string, unknown>).sfxEnabled as boolean) ?? true,
        bgmEnabled: ((saved as Record<string, unknown>).bgmEnabled as boolean) ?? true,
      };
    } catch (e) {
      console.warn('[AudioDb] 加载音频设置失败:', e);
      return null;
    }
  }
}

/** 音频数据层单例 */
export const audioDbService = new AudioDbService();
