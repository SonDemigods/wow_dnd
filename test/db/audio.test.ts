/**
 * @fileoverview 音频模块数据层（audio/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveSettings / loadSettings：音频设置在 runtime_gameState 表的读写
 *  - 不存在时 loadSettings 返回 null
 *  - 覆盖保存：相同键再次保存，新设置替换旧设置
 *  - loadSettings 的 ?? 兜底逻辑：缺失字段使用 DEFAULT_AUDIO_SETTINGS 默认值
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 runtime_gameState 表，避免用例间污染
 *  - 不 mock db service，确保 put/get 真实执行
 *  - 音频设置存储在 runtime_gameState 表中，以 'audio_settings' 为键
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { audioDbService } from '@/modules/audio/db';
import { db } from '@/modules/data/core';
import { DEFAULT_AUDIO_SETTINGS } from '@/modules/audio/types';
import type { AudioSettings } from '@/modules/audio/types';

// ==================== 测试数据构造 helper ====================

function makeSettings(o: Partial<AudioSettings> = {}): AudioSettings {
  return {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    bgmVolume: 0.5,
    muted: false,
    sfxEnabled: true,
    bgmEnabled: true,
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('AudioDbService - 音频数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await db.runtime_gameState.clear();
  });

  // -------------------- saveSettings / loadSettings --------------------

  describe('saveSettings / loadSettings：设置读写', () => {
    it('保存设置后可读回完整数据', async () => {
      const settings = makeSettings({
        masterVolume: 0.3,
        sfxVolume: 0.6,
        bgmVolume: 0.4,
        muted: true,
        sfxEnabled: false,
        bgmEnabled: false,
      });
      await audioDbService.saveSettings(settings);

      const result = await audioDbService.loadSettings();
      expect(result).not.toBeNull();
      expect(result!.masterVolume).toBe(0.3);
      expect(result!.sfxVolume).toBe(0.6);
      expect(result!.bgmVolume).toBe(0.4);
      expect(result!.muted).toBe(true);
      expect(result!.sfxEnabled).toBe(false);
      expect(result!.bgmEnabled).toBe(false);
    });

    it('未保存时 loadSettings 返回 null', async () => {
      const result = await audioDbService.loadSettings();
      expect(result).toBeNull();
    });

    it('覆盖保存：相同键再次保存，新设置替换旧设置', async () => {
      await audioDbService.saveSettings(makeSettings({ masterVolume: 0.9, muted: false }));
      await audioDbService.saveSettings(makeSettings({ masterVolume: 0.1, muted: true }));

      const result = await audioDbService.loadSettings();
      expect(result).not.toBeNull();
      expect(result!.masterVolume).toBe(0.1);
      expect(result!.muted).toBe(true);
    });

    it('保存默认设置后读回与 DEFAULT_AUDIO_SETTINGS 一致', async () => {
      await audioDbService.saveSettings(DEFAULT_AUDIO_SETTINGS);

      const result = await audioDbService.loadSettings();
      expect(result).toEqual(DEFAULT_AUDIO_SETTINGS);
    });

    it('直接通过 Dexie 验证写入键为 audio_settings', async () => {
      await audioDbService.saveSettings(makeSettings({ masterVolume: 0.42 }));

      const raw = await db.runtime_gameState.get('audio_settings');
      expect(raw).toBeDefined();
      expect(raw!.id).toBe('audio_settings');
      expect(raw!.masterVolume).toBe(0.42);
    });
  });

  // -------------------- loadSettings 兜底逻辑 --------------------

  describe('loadSettings：缺失字段使用 ?? 兜底默认值', () => {
    it('部分字段缺失时，使用 DEFAULT_AUDIO_SETTINGS 对应字段兜底', async () => {
      // 直接写入部分字段缺失的记录，绕过 saveSettings
      await db.runtime_gameState.put({
        id: 'audio_settings',
        masterVolume: 0.55,
        // sfxVolume / bgmVolume / muted / sfxEnabled / bgmEnabled 缺失
      });

      const result = await audioDbService.loadSettings();
      expect(result).not.toBeNull();
      // 已保存字段保持原值
      expect(result!.masterVolume).toBe(0.55);
      // 缺失字段使用默认值
      expect(result!.sfxVolume).toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume);
      expect(result!.bgmVolume).toBe(DEFAULT_AUDIO_SETTINGS.bgmVolume);
      expect(result!.muted).toBe(DEFAULT_AUDIO_SETTINGS.muted);
      expect(result!.sfxEnabled).toBe(DEFAULT_AUDIO_SETTINGS.sfxEnabled);
      expect(result!.bgmEnabled).toBe(DEFAULT_AUDIO_SETTINGS.bgmEnabled);
    });

    it('全部字段缺失时，全部使用默认值', async () => {
      // 仅写入 id，无任何音频字段
      await db.runtime_gameState.put({ id: 'audio_settings' });

      const result = await audioDbService.loadSettings();
      expect(result).not.toBeNull();
      expect(result).toEqual(DEFAULT_AUDIO_SETTINGS);
    });

    it('masterVolume=0 时保留 0（?? 不会将 0 视为 falsy 而兜底）', async () => {
      await audioDbService.saveSettings(makeSettings({ masterVolume: 0 }));

      const result = await audioDbService.loadSettings();
      expect(result).not.toBeNull();
      // ?? 仅在 null/undefined 时兜底，0 是合法值应保留
      expect(result!.masterVolume).toBe(0);
    });

    it('muted=false 时保留 false（?? 不会将 false 视为 falsy 而兜底）', async () => {
      await audioDbService.saveSettings(makeSettings({ muted: false }));

      const result = await audioDbService.loadSettings();
      expect(result).not.toBeNull();
      expect(result!.muted).toBe(false);
    });
  });

  // -------------------- 与其他 gameState 记录隔离 --------------------

  describe('与其他 gameState 记录隔离', () => {
    it('audio_settings 与 gameState 主记录互不影响', async () => {
      // 写入主游戏状态记录
      await db.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId: 'char-1',
      });
      // 写入音频设置
      await audioDbService.saveSettings(makeSettings({ masterVolume: 0.6 }));

      // 读回音频设置不受影响
      const audio = await audioDbService.loadSettings();
      expect(audio).not.toBeNull();
      expect(audio!.masterVolume).toBe(0.6);

      // 读回主游戏状态不受影响
      const gameState = await db.runtime_gameState.get('gameState');
      expect(gameState).toBeDefined();
      expect(gameState!.currentCharacterId).toBe('char-1');
    });
  });

  // -------------------- 错误处理：catch 分支 --------------------

  describe('错误处理：catch 分支（不抛出，打印警告）', () => {
    it('saveSettings 捕获 saveGameState 异常并打印警告，不抛出', async () => {
      // Arrange：spy db.transaction 使 saveGameState 的事务抛出
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const txSpy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('事务失败'));

      // Act：不应抛出
      await audioDbService.saveSettings(makeSettings({ masterVolume: 0.5 }));

      // Assert
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('[AudioDb]');

      // Cleanup
      txSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('loadSettings 捕获 getGameState 异常并打印警告，返回 null', async () => {
      // Arrange：spy db.runtime_gameState.get 使 getGameState 抛出
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getSpy = vi.spyOn(db.runtime_gameState, 'get').mockRejectedValueOnce(new Error('读取失败'));

      // Act
      const result = await audioDbService.loadSettings();

      // Assert
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('[AudioDb]');

      // Cleanup
      getSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });
});
