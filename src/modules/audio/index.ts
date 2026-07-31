/**
 * @fileoverview 音频模块统一导出入口
 * @description 导出音频模块的所有类型定义、服务层和状态管理
 *
 *   P3-116 修复：移除 audioDbService 导出。音频设置的持久化已迁移到 GameStore，
 *   本模块不再直接访问 IndexedDB。
 *
 * @module audio
 */
export type {
  SfxType,
  SfxRoute,
  BgmScene,
  AudioSettings,
  IAudioService
} from './types';

export { SFX_ROUTE_MAP, DEFAULT_AUDIO_SETTINGS } from './types';

export { audioService } from './service';

export type { OrganPreset, OrganStopConfig } from './organVoice';
export { OrganVoice } from './organVoice';
export { useAudioStore } from './store';
