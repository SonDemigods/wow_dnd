/**
 * @fileoverview 游戏全局状态管理（Pinia Store）
 * @description GameStore 是全局游戏状态的唯一持有者，收敛原散落在 character/db.ts、
 *   shop/db.ts、audio/db.ts 中的 GameState 操作。所有全局状态（currentCharacterId、
 *   currentShopId、gameSettings、lastPlayedAt、initializedAt）统一由本 Store 管理，
 *   并通过 gameStateHelper 持久化到 runtime_gameState 表（id='gameState'）。
 *
 *   迁移说明（P3-116）：
 *   - 原 `audio_settings` 键的数据在 initialize 时迁移合并到 `gameState` 键的 gameSettings 字段
 *   - 原 GameStateStorage.settings/maxLevel 字段废弃，不再持久化
 *   - runtime_gameState 表结构不变，备份/导入逻辑无需修改
 *
 * @module game
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getGameState, saveGameState, db } from '@/modules/data';
import type { GameStateStorage } from '@/modules/data';
import type { GameSettings } from './types';
import { DEFAULT_GAME_SETTINGS } from './types';
import { errorReporter } from '@/utils/errorReport';
import { toRawData } from '@/utils';

/** runtime_gameState 中存储音频设置的旧键名（迁移用） */
const LEGACY_AUDIO_SETTINGS_KEY = 'audio_settings';

/**
 * 从 GameStateStorage 提取 GameSettings（兼容旧格式与迁移后格式）
 *
 * 迁移后 gameSettings 字段直接存在；旧格式可能只有 settings 子对象或完全没有。
 */
function extractGameSettings(state: GameStateStorage | null): GameSettings {
  if (!state) return { ...DEFAULT_GAME_SETTINGS };

  // 优先读取迁移后的 gameSettings 字段
  const gs = state.gameSettings as Partial<GameSettings> | undefined;
  if (gs && typeof gs.masterVolume === 'number') {
    return {
      masterVolume: gs.masterVolume ?? DEFAULT_GAME_SETTINGS.masterVolume,
      sfxVolume: gs.sfxVolume ?? DEFAULT_GAME_SETTINGS.sfxVolume,
      bgmVolume: gs.bgmVolume ?? DEFAULT_GAME_SETTINGS.bgmVolume,
      muted: gs.muted ?? DEFAULT_GAME_SETTINGS.muted,
      sfxEnabled: gs.sfxEnabled ?? DEFAULT_GAME_SETTINGS.sfxEnabled,
      bgmEnabled: gs.bgmEnabled ?? DEFAULT_GAME_SETTINGS.bgmEnabled,
      autoSave: gs.autoSave ?? DEFAULT_GAME_SETTINGS.autoSave,
      difficulty: gs.difficulty ?? DEFAULT_GAME_SETTINGS.difficulty,
    };
  }

  return { ...DEFAULT_GAME_SETTINGS };
}

export const useGameStore = defineStore('game', () => {
  // ==================== 响应式状态（唯一数据源） ====================
  const currentCharacterId = ref<string | null>(null);
  const currentShopId = ref<string | null>(null);
  const lastPlayedAt = ref<string>('');
  const initializedAt = ref<string>('');
  const gameSettings = ref<GameSettings>({ ...DEFAULT_GAME_SETTINGS });

  /** 是否已初始化 */
  const isInitialized = ref(false);

  // ==================== 持久化辅助 ====================

  /**
   * 将当前状态持久化到 DB
   *
   * 使用 saveGameState 的事务性读-改-写，确保原子性。
   */
  async function persist(): Promise<void> {
    try {
      // toRawData 剥离 Vue 响应式 Proxy 包装，避免 IndexedDB DataCloneError
      await saveGameState({
        currentCharacterId: currentCharacterId.value,
        currentShopId: currentShopId.value,
        lastPlayedAt: lastPlayedAt.value,
        initializedAt: initializedAt.value,
        gameSettings: toRawData(gameSettings.value),
      });
    } catch (err) {
      errorReporter.report(err, 'manual', {
        context: 'GameStore 持久化失败，UI 与 DB 状态可能不一致',
      });
    }
  }

  // ==================== 数据迁移 ====================

  /**
   * 迁移旧 audio_settings 键到 gameState 键的 gameSettings 字段
   *
   * 迁移条件：DB 中存在 id='audio_settings' 记录且 gameState 记录尚无 gameSettings 字段。
   * 迁移完成后删除 audio_settings 键，避免重复迁移。
   */
  async function migrateAudioSettings(): Promise<void> {
    try {
      const legacy = await db.runtime_gameState.get(LEGACY_AUDIO_SETTINGS_KEY);
      if (!legacy) return;

      // 已迁移过的 gameState 记录不再重复迁移
      const current = await getGameState();
      if (current?.gameSettings) {
        await db.runtime_gameState.delete(LEGACY_AUDIO_SETTINGS_KEY);
        return;
      }

      // 将旧音频设置合并到 gameSettings
      const migratedSettings: GameSettings = {
        masterVolume: (legacy.masterVolume as number) ?? DEFAULT_GAME_SETTINGS.masterVolume,
        sfxVolume: (legacy.sfxVolume as number) ?? DEFAULT_GAME_SETTINGS.sfxVolume,
        bgmVolume: (legacy.bgmVolume as number) ?? DEFAULT_GAME_SETTINGS.bgmVolume,
        muted: (legacy.muted as boolean) ?? DEFAULT_GAME_SETTINGS.muted,
        sfxEnabled: (legacy.sfxEnabled as boolean) ?? DEFAULT_GAME_SETTINGS.sfxEnabled,
        bgmEnabled: (legacy.bgmEnabled as boolean) ?? DEFAULT_GAME_SETTINGS.bgmEnabled,
        autoSave: DEFAULT_GAME_SETTINGS.autoSave,
        difficulty: DEFAULT_GAME_SETTINGS.difficulty,
      };

      await saveGameState({ gameSettings: migratedSettings });
      await db.runtime_gameState.delete(LEGACY_AUDIO_SETTINGS_KEY);
    } catch (err) {
      // 迁移失败不阻断启动，使用默认设置
      errorReporter.report(err, 'manual', {
        context: 'audio_settings 迁移失败，将使用默认音频设置',
      });
    }
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化 GameStore
   *
   * 流程：
   * 1. 迁移旧 audio_settings 键（如有）
   * 2. 从 DB 加载 gameState 记录
   * 3. 恢复状态到内存
   *
   * 应在 characterStore.initialize 之前调用，因为 characterStore 依赖 currentCharacterId。
   */
  async function initialize(): Promise<void> {
    // 1. 迁移旧格式数据
    await migrateAudioSettings();

    // 2. 从 DB 加载
    const state = await getGameState();

    // 3. 恢复状态
    if (state) {
      currentCharacterId.value = state.currentCharacterId ?? null;
      currentShopId.value = state.currentShopId ?? null;
      lastPlayedAt.value = state.lastPlayedAt ?? new Date().toISOString();
      initializedAt.value = state.initializedAt ?? new Date().toISOString();
      gameSettings.value = extractGameSettings(state);
    } else {
      // 首次初始化
      const now = new Date().toISOString();
      lastPlayedAt.value = now;
      initializedAt.value = now;
      gameSettings.value = { ...DEFAULT_GAME_SETTINGS };
      await persist();
    }

    isInitialized.value = true;
  }

  // ==================== Action：currentCharacterId ====================

  /**
   * 设置当前角色 ID 并持久化
   * @param id - 角色 ID，null 表示登出
   */
  async function setCurrentCharacterId(id: string | null): Promise<void> {
    currentCharacterId.value = id;
    lastPlayedAt.value = new Date().toISOString();
    await persist();
  }

  // ==================== Action：currentShopId ====================

  /**
   * 设置当前商店 ID 并持久化
   * @param id - 商店 ID，null 表示关闭商店
   */
  async function setCurrentShopId(id: string | null): Promise<void> {
    currentShopId.value = id;
    lastPlayedAt.value = new Date().toISOString();
    await persist();
  }

  // ==================== Action：gameSettings ====================

  /**
   * 部分更新游戏设置并持久化
   * @param patch - 需要更新的字段
   */
  async function updateGameSettings(patch: Partial<GameSettings>): Promise<void> {
    gameSettings.value = { ...gameSettings.value, ...patch };
    await persist();
  }

  // ==================== Action：强制持久化 ====================

  /**
   * 强制将当前状态写入 DB
   *
   * 供 audioStore 等模块在 dispose 前 flush 使用。
   */
  async function flushPersist(): Promise<void> {
    await persist();
  }

  // ==================== 查询辅助 ====================

  /** 获取当前角色 ID（同步） */
  function getCurrentCharacterId(): string | null {
    return currentCharacterId.value;
  }

  /** 获取当前商店 ID（同步） */
  function getCurrentShopId(): string | null {
    return currentShopId.value;
  }

  /** 获取游戏设置快照（同步） */
  function getGameSettings(): GameSettings {
    return { ...gameSettings.value };
  }

  return {
    // 状态
    currentCharacterId,
    currentShopId,
    lastPlayedAt,
    initializedAt,
    gameSettings,
    isInitialized,

    // Action
    initialize,
    setCurrentCharacterId,
    setCurrentShopId,
    updateGameSettings,
    flushPersist,

    // 查询辅助
    getCurrentCharacterId,
    getCurrentShopId,
    getGameSettings,
  };
});
