/**
 * @fileoverview 音频模块数据层
 * @description 封装音频设置相关的 IndexedDB 持久化操作，
 * 将设置存储在 runtime_gameState 表中，以特定键标识
 */

import { getGameState, saveGameState } from '@/modules/data';
import type { AudioSettings } from './types';
import { DEFAULT_AUDIO_SETTINGS } from './types';
import { errorReporter } from '@/utils/errorReport';

/** runtime_gameState 中存储音频设置的键名 */
const DB_KEY = 'audio_settings';

/** 音频设置存储结构 —— 与 IndexedDB 交互的字段类型 */
interface AudioSettingsStorage {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  muted: boolean;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  // 索引签名：与 GameStateStorage 的 `[key: string]: unknown` 兼容，
  // 允许通过 saveGameState 写入 runtime_gameState 表
  [key: string]: unknown;
}

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
      await saveGameState(settings as AudioSettingsStorage, DB_KEY);
    } catch (e) {
      // P2 DB-7 修复：上报 errorReporter 便于运维监测，与 inventory/store.ts 模式一致
      console.warn('[AudioDb] 保存音频设置失败:', e);
      errorReporter.report(e, 'manual', { context: '音频设置持久化失败' });
    }
  }

  /**
   * 从数据库加载音频设置
   * @returns 保存的设置，若不存在则返回 null
   */
  async loadSettings(): Promise<AudioSettings | null> {
    try {
      const saved = await getGameState(DB_KEY) as AudioSettingsStorage | null;
      if (!saved) return null;

      return {
        masterVolume: saved.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume,
        sfxVolume: saved.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume,
        bgmVolume: saved.bgmVolume ?? DEFAULT_AUDIO_SETTINGS.bgmVolume,
        muted: saved.muted ?? DEFAULT_AUDIO_SETTINGS.muted,
        sfxEnabled: saved.sfxEnabled ?? DEFAULT_AUDIO_SETTINGS.sfxEnabled,
        bgmEnabled: saved.bgmEnabled ?? DEFAULT_AUDIO_SETTINGS.bgmEnabled,
      };
    } catch (e) {
      // P2 DB-7 修复：上报 errorReporter 便于运维监测
      console.warn('[AudioDb] 加载音频设置失败:', e);
      errorReporter.report(e, 'manual', { context: '音频设置加载失败，将使用默认设置' });
      return null;
    }
  }
}

/** 音频数据层单例 */
export const audioDbService = new AudioDbService();
