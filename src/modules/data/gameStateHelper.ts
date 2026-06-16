/**
 * 游戏状态辅助模块
 * 
 * 统一管理 runtime_gameState 表的读写操作。
 * 所有需要读写 runtime_gameState 的模块（character、shop、audio 等）
 * 都应通过此模块操作，确保事务安全和数据一致性。
 */
import { db, type GameStateStorage } from './core';

/**
 * 获取指定键的游戏状态记录
 * @param key - 状态键名，默认为 'gameState'
 * @returns 游戏状态对象，不存在时返回 null
 */
export async function getGameState(key: string = 'gameState'): Promise<GameStateStorage | null> {
  const state = await db.runtime_gameState.get(key) as GameStateStorage | undefined;
  return state ?? null;
}

/**
 * 更新游戏状态（部分字段，使用事务确保原子性读-改-写）
 * 
 * 避免与 character/shop/audio 等模块并发写入时丢失数据。
 * @param patch - 需要更新的字段（合并到现有状态中）
 * @param key - 状态键名，默认为 'gameState'
 */
export async function saveGameState(patch: Partial<GameStateStorage>, key: string = 'gameState'): Promise<void> {
  await db.transaction('rw', db.runtime_gameState, async () => {
    const existing = await db.runtime_gameState.get(key);
    await db.runtime_gameState.put({
      ...existing,
      id: key,
      ...patch,
    } as GameStateStorage);
  });
}
