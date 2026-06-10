/**
 * @fileoverview 音频模块数据层
 * @description 封装音频设置相关的 IndexedDB 持久化操作，
 * 将设置存储在 runtime_gameState 表中，以特定键标识
 */

import { db } from '../data/core';
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
      await db.runtime_gameState.put({
        id: DB_KEY,
        ...settings,
      } as any);
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
      const saved = await db.runtime_gameState.get(DB_KEY);
      if (!saved) return null;

      return {
        masterVolume: (saved as any).masterVolume ?? undefined,
        sfxVolume: (saved as any).sfxVolume ?? undefined,
        bgmVolume: (saved as any).bgmVolume ?? undefined,
        muted: (saved as any).muted ?? undefined,
        sfxEnabled: (saved as any).sfxEnabled ?? undefined,
        bgmEnabled: (saved as any).bgmEnabled ?? undefined,
      };
    } catch (e) {
      console.warn('[AudioDb] 加载音频设置失败:', e);
      return null;
    }
  }
}

/** 音频数据层单例 */
export const audioDbService = new AudioDbService();
