/**
 * @fileoverview 游戏状态辅助模块（gameStateHelper）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 事务操作，覆盖：
 *  - getGameState：读取指定键的状态，不存在时返回 null
 *  - saveGameState：部分字段合并写入（事务保证原子性读-改-写）
 *  - 自定义 key 参数
 *  - 多次合并写入不丢失已有字段
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 runtime_gameState 表，避免用例间污染
 *  - 不 mock db，确保 transaction/put/get 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getGameState, saveGameState } from '@/modules/data/gameStateHelper';
import { db } from '@/modules/data/core';

describe('gameStateHelper 游戏状态辅助模块', () => {
  beforeEach(async () => {
    await db.runtime_gameState.clear();
  });

  // ==================== getGameState ====================

  describe('getGameState：读取游戏状态', () => {
    it('键不存在时返回 null', async () => {
      // Act
      const result = await getGameState();

      // Assert
      expect(result).toBeNull();
    });

    it('可读取已保存的状态', async () => {
      // Arrange
      await saveGameState({ currentCharacterId: 'char-1' });

      // Act
      const result = await getGameState();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.currentCharacterId).toBe('char-1');
    });

    it('支持自定义 key 参数', async () => {
      // Arrange
      await saveGameState({ currentCharacterId: 'char-2' }, 'custom-key');

      // Act
      const result = await getGameState('custom-key');

      // Assert
      expect(result).not.toBeNull();
      expect(result!.currentCharacterId).toBe('char-2');
    });

    it('默认 key 为 "gameState"', async () => {
      // Arrange
      await saveGameState({ currentShopId: 'shop-1' });

      // Act：直接通过 Dexie 验证写入的 key
      const raw = await db.runtime_gameState.get('gameState');

      // Assert
      expect(raw).toBeDefined();
      expect(raw!.id).toBe('gameState');
      expect(raw!.currentShopId).toBe('shop-1');
    });

    it('不同 key 的数据相互隔离', async () => {
      // Arrange
      await saveGameState({ currentCharacterId: 'char-a' }, 'key-a');
      await saveGameState({ currentCharacterId: 'char-b' }, 'key-b');

      // Act
      const a = await getGameState('key-a');
      const b = await getGameState('key-b');

      // Assert
      expect(a!.currentCharacterId).toBe('char-a');
      expect(b!.currentCharacterId).toBe('char-b');
    });
  });

  // ==================== saveGameState ====================

  describe('saveGameState：合并写入游戏状态', () => {
    it('首次保存创建新记录', async () => {
      // Act
      await saveGameState({ currentCharacterId: 'char-1' });

      // Assert
      const result = await getGameState();
      expect(result).not.toBeNull();
      expect(result!.currentCharacterId).toBe('char-1');
    });

    it('多次保存不同字段时合并写入（不丢失已有字段）', async () => {
      // Arrange & Act
      await saveGameState({ currentCharacterId: 'char-1' });
      await saveGameState({ currentShopId: 'shop-1' });
      await saveGameState({ lastPlayedAt: '2026-07-09' });

      // Assert
      const result = await getGameState();
      expect(result).not.toBeNull();
      expect(result!.currentCharacterId).toBe('char-1');
      expect(result!.currentShopId).toBe('shop-1');
      expect(result!.lastPlayedAt).toBe('2026-07-09');
    });

    it('覆盖写入同名字段（更新已有字段值）', async () => {
      // Arrange & Act
      await saveGameState({ currentCharacterId: 'char-old' });
      await saveGameState({ currentCharacterId: 'char-new' });

      // Assert
      const result = await getGameState();
      expect(result!.currentCharacterId).toBe('char-new');
    });

    it('保存空对象不覆盖已有字段', async () => {
      // Arrange
      await saveGameState({ currentCharacterId: 'char-1' });

      // Act
      await saveGameState({});

      // Assert
      const result = await getGameState();
      expect(result!.currentCharacterId).toBe('char-1');
    });

    it('支持复杂嵌套字段（settings 对象）', async () => {
      // Arrange
      const settings = {
        soundEnabled: true,
        musicEnabled: false,
        autoSave: true,
        difficulty: 'normal',
      };

      // Act
      await saveGameState({ settings });

      // Assert
      const result = await getGameState();
      expect(result!.settings).toEqual(settings);
    });

    it('保存后 id 字段始终为 key', async () => {
      // Act
      await saveGameState({ currentCharacterId: 'char-1' });

      // Assert：直接通过 Dexie 验证 id 字段
      const raw = await db.runtime_gameState.get('gameState');
      expect(raw!.id).toBe('gameState');
    });
  });
});
