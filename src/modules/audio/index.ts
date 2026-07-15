/**
 * @fileoverview 音频模块统一导出入口
 * @description 导出音频模块的所有类型定义、数据层、服务层和状态管理
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

export { audioDbService } from './db';

export { audioService } from './service';

export type { OrganPreset, OrganStopConfig } from './organVoice';
export { OrganVoice } from './organVoice';
export { useAudioStore } from './store';
