/**
 * @fileoverview GameStore 单元测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 事务操作，覆盖：
 *  - initialize：首次初始化（默认设置 + 写入 DB）、恢复已有状态、迁移 audio_settings 旧键
 *  - setCurrentCharacterId：设置/清空角色 ID 并持久化
 *  - setCurrentShopId：设置/清空商店 ID 并持久化
 *  - updateGameSettings：部分更新设置并持久化
 *  - flushPersist：强制写入 DB
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 runtime_gameState 表，避免用例间污染
 *  - 不 mock db，确保 transaction/put/get 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStore } from '@/modules/game/store';
import { DEFAULT_GAME_SETTINGS } from '@/modules/game/types';
import { db } from '@/modules/data';
import { CURRENT_DATA_VERSION } from '@/config/version';

describe('useGameStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    // 清空 runtime_gameState 表，避免测试间状态泄漏
    await db.runtime_gameState.clear();
  });

  describe('initialize', () => {
    it('首次初始化应使用默认设置并写入 DB', async () => {
      const store = useGameStore();
      await store.initialize();

      expect(store.currentCharacterId).toBeNull();
      expect(store.currentShopId).toBeNull();
      expect(store.gameSettings).toEqual(DEFAULT_GAME_SETTINGS);
      expect(store.lastPlayedAt).toBeTruthy();
      expect(store.initializedAt).toBeTruthy();

      // 验证已持久化
      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted).toBeTruthy();
      expect(persisted!.currentCharacterId).toBeNull();
    });

    it('DB 已有数据时应恢复状态', async () => {
      // 预置 DB 数据
      await db.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId: 'char_123',
        currentShopId: 'shop_456',
        lastPlayedAt: '2026-01-01T00:00:00.000Z',
        initializedAt: '2026-01-01T00:00:00.000Z',
        gameSettings: {
          masterVolume: 0.5,
          sfxVolume: 0.6,
          bgmVolume: 0.4,
          muted: true,
          sfxEnabled: false,
          bgmEnabled: true,
        },
      });

      const store = useGameStore();
      await store.initialize();

      expect(store.currentCharacterId).toBe('char_123');
      expect(store.currentShopId).toBe('shop_456');
      expect(store.gameSettings.masterVolume).toBe(0.5);
      expect(store.gameSettings.muted).toBe(true);
    });

    it('DB 有 audio_settings 旧键时应迁移合并到 gameSettings', async () => {
      // 预置旧格式数据（audio_settings 独立键 + gameState 无 gameSettings）
      await db.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId: null,
        lastPlayedAt: '2026-01-01T00:00:00.000Z',
      });
      await db.runtime_gameState.put({
        id: 'audio_settings',
        masterVolume: 0.3,
        sfxVolume: 0.4,
        bgmVolume: 0.2,
        muted: true,
        sfxEnabled: false,
        bgmEnabled: false,
      });

      const store = useGameStore();
      await store.initialize();

      // 迁移后 gameSettings 应来自 audio_settings
      expect(store.gameSettings.masterVolume).toBe(0.3);
      expect(store.gameSettings.sfxEnabled).toBe(false);

      // 迁移后 audio_settings 键应被删除
      const oldKey = await db.runtime_gameState.get('audio_settings');
      expect(oldKey).toBeUndefined();

      // gameState 键应包含 gameSettings
      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted!.gameSettings).toBeTruthy();
      expect(persisted!.gameSettings!.masterVolume).toBe(0.3);
    });

    it('已迁移过的 DB 再次初始化不应重复迁移', async () => {
      // 预置已迁移数据（gameState 已有 gameSettings，且无 audio_settings 键）
      await db.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId: null,
        lastPlayedAt: '2026-01-01T00:00:00.000Z',
        gameSettings: {
          masterVolume: 0.9,
          sfxVolume: 0.1,
          bgmVolume: 0.2,
          muted: false,
          sfxEnabled: true,
          bgmEnabled: false,
        },
      });

      const store = useGameStore();
      await store.initialize();

      // 应直接读取已存在的 gameSettings，不覆盖为默认值
      expect(store.gameSettings.masterVolume).toBe(0.9);
      expect(store.gameSettings.sfxVolume).toBe(0.1);
    });
  });

  describe('setCurrentCharacterId', () => {
    it('应更新状态并持久化', async () => {
      const store = useGameStore();
      await store.initialize();

      await store.setCurrentCharacterId('char_abc');

      expect(store.currentCharacterId).toBe('char_abc');
      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted!.currentCharacterId).toBe('char_abc');
    });

    it('传入 null 应清空当前角色', async () => {
      const store = useGameStore();
      await store.initialize();
      await store.setCurrentCharacterId('char_abc');

      await store.setCurrentCharacterId(null);

      expect(store.currentCharacterId).toBeNull();
      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted!.currentCharacterId).toBeNull();
    });
  });

  describe('setCurrentShopId', () => {
    it('应更新状态并持久化', async () => {
      const store = useGameStore();
      await store.initialize();

      await store.setCurrentShopId('shop_1');

      expect(store.currentShopId).toBe('shop_1');
      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted!.currentShopId).toBe('shop_1');
    });
  });

  describe('updateGameSettings', () => {
    it('应部分更新设置并持久化', async () => {
      const store = useGameStore();
      await store.initialize();

      await store.updateGameSettings({ muted: true, masterVolume: 0.1 });

      expect(store.gameSettings.muted).toBe(true);
      expect(store.gameSettings.masterVolume).toBe(0.1);
      expect(store.gameSettings.sfxVolume).toBe(DEFAULT_GAME_SETTINGS.sfxVolume);

      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted!.gameSettings!.muted).toBe(true);
      expect(persisted!.gameSettings!.masterVolume).toBe(0.1);
    });
  });

  describe('flushPersist', () => {
    it('应强制将当前状态写入 DB', async () => {
      const store = useGameStore();
      await store.initialize();

      // 直接修改内部状态后调用 flushPersist
      await store.flushPersist();

      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted).toBeTruthy();
    });
  });

  describe('查询辅助方法', () => {
    it('getCurrentCharacterId / getCurrentShopId / getGameSettings 应返回当前快照', async () => {
      const store = useGameStore();
      await store.initialize();
      await store.setCurrentCharacterId('char_x');
      await store.setCurrentShopId('shop_y');

      expect(store.getCurrentCharacterId()).toBe('char_x');
      expect(store.getCurrentShopId()).toBe('shop_y');
      const settings = store.getGameSettings();
      expect(settings.masterVolume).toBe(DEFAULT_GAME_SETTINGS.masterVolume);
      // 验证返回的是副本
      settings.masterVolume = 0.01;
      expect(store.gameSettings.masterVolume).toBe(DEFAULT_GAME_SETTINGS.masterVolume);
    });
  });

  describe('版本检测（versionMismatch / getCurrentDataVersion / getExpectedDataVersion）', () => {
    it('首次初始化后 versionMismatch 为 false（dataVersion = CURRENT_DATA_VERSION）', async () => {
      const store = useGameStore();
      await store.initialize();

      expect(store.versionMismatch).toBe(false);
      expect(store.getCurrentDataVersion()).toBe(CURRENT_DATA_VERSION);
    });

    it('DB 中 dataVersion 与 CURRENT_DATA_VERSION 不匹配时 versionMismatch 为 true', async () => {
      // 预置旧版本存档（dataVersion = 0，低于 CURRENT_DATA_VERSION）
      await db.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId: 'char_old',
        lastPlayedAt: '2026-01-01T00:00:00.000Z',
        dataVersion: 0,
      });

      const store = useGameStore();
      await store.initialize();

      expect(store.versionMismatch).toBe(true);
      expect(store.getCurrentDataVersion()).toBe(0);
    });

    it('DB 中 dataVersion 缺失时 versionMismatch 为 true（旧存档无版本戳）', async () => {
      // 预置无 dataVersion 字段的存档（模拟旧基线存档）
      await db.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId: 'char_legacy',
        lastPlayedAt: '2026-01-01T00:00:00.000Z',
      });

      const store = useGameStore();
      await store.initialize();

      expect(store.versionMismatch).toBe(true);
      expect(store.getCurrentDataVersion()).toBeNull();
    });

    it('getExpectedDataVersion 返回 CURRENT_DATA_VERSION', async () => {
      const store = useGameStore();
      await store.initialize();

      expect(store.getExpectedDataVersion()).toBe(CURRENT_DATA_VERSION);
    });

    it('未初始化时 versionMismatch 为 false（避免 loading 期间误判）', async () => {
      const store = useGameStore();
      // 不调用 initialize，直接读取 versionMismatch
      expect(store.versionMismatch).toBe(false);
    });

    it('initialize 后 persist 写入的存档包含 appVersion 和 dataVersion 字段', async () => {
      const store = useGameStore();
      await store.initialize();

      const persisted = await db.runtime_gameState.get('gameState');
      expect(persisted!.appVersion).toBeTruthy();
      expect(persisted!.dataVersion).toBe(CURRENT_DATA_VERSION);
    });
  });
});
