/**
 * @fileoverview 音频模块统一导出入口
 * @description 导出音频模块的所有类型定义、服务层和状态管理
 *
 *   P3-116 修复：移除 audioDbService 导出。音频设置的持久化已迁移到 GameStore，
 *   本模块不再直接访问 IndexedDB。
 *
 *   P3-141 修复：audioService 不再从此入口导出，避免通过 @/modules/audio 静态引用
 *   useAudioStore 等非 Tone 依赖时，间接拉入 Tone.js（service.ts 顶部 import * as Tone）。
 *   audioService 仅由 main.ts 通过动态 import('@/modules/audio/service') 加载。
 *   需要直接使用 audioService 的代码应使用动态 import。
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

// P3-141：OrganVoice 类的 export 会让 organVoice.ts（顶部 import * as Tone）被静态拉入。
// src 中无外部引用（仅 test/audio/organVoice.test.ts 直接 import 文件路径），
// 因此仅保留 type export，OrganVoice 类需通过 @/modules/audio/organVoice 直接引用。
export type { OrganPreset, OrganStopConfig } from './organVoice';
export { useAudioStore } from './store';
