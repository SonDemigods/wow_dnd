/**
 * 角色模块数据层
 * 
 * 封装角色数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { Character, CharacterListItem, Stats, FactionType, RaceType, ClassType } from './types';

/**
 * 角色数据存储接口（内部使用，与 data/core.ts 的 CharacterDataStorage 对应）
 */
interface CharacterDataStorage {
  characterId: string;
  name: string;
  factionId: FactionType;
  raceId: RaceType;
  classId: ClassType;
  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  baseStats: Stats;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  bonusStats: Partial<Stats>;
  createdTime: number;
  lastPlayedTime: number;
  updatedAt: number;
}

/**
 * 角色数据层服务
 */
export class CharacterDbService {
  /**
   * 保存角色列表项（写入 char_data，仅更新列表字段）
   * @param character - 角色列表项
   */
  async saveCharacterListItem(character: CharacterListItem): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.char_data.get(character.id);
      await gameDb.char_data.put({
        ...(existing || {} as CharacterDataStorage),
        characterId: character.id,
        name: character.name,
        factionId: character.factionId,
        raceId: character.raceId,
        classId: character.classId,
        level: character.level,
        createdTime: character.createdTime,
        lastPlayedTime: character.lastPlayedTime,
        updatedAt: Date.now()
      } as unknown as import('../data/core').CharacterDataStorage);
    });
  }

  /**
   * 获取所有角色列表项
   * @returns 角色列表项数组
   */
  async getAllCharacterListItems(): Promise<CharacterListItem[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.char_data.toArray() as unknown as CharacterDataStorage[];
      return items.map(item => ({
        id: item.characterId,
        name: item.name,
        raceId: item.raceId,
        classId: item.classId,
        factionId: item.factionId,
        level: item.level,
        createdTime: item.createdTime,
        lastPlayedTime: item.lastPlayedTime
      }));
    });
  }

  /**
   * 获取单个角色列表项
   * @param characterId - 角色ID
   * @returns 角色列表项或null
   */
  async getCharacterListItem(characterId: string): Promise<CharacterListItem | null> {
    return dbService.withRetry(async () => {
      const item = await gameDb.char_data.get(characterId) as unknown as CharacterDataStorage | undefined;
      if (!item) return null;
      return {
        id: item.characterId,
        name: item.name,
        raceId: item.raceId,
        classId: item.classId,
        factionId: item.factionId,
        level: item.level,
        createdTime: item.createdTime,
        lastPlayedTime: item.lastPlayedTime
      };
    });
  }

  /**
   * 删除角色列表项（即删除角色数据）
   * @param characterId - 角色ID
   */
  async deleteCharacterListItem(characterId: string): Promise<void> {
    await this.deleteCharacterData(characterId);
  }

  /**
   * 保存角色详细数据
   * @param data - 角色详细数据
   */
  async saveCharacterData(data: CharacterDataStorage): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_data.put(data as unknown as import('../data/core').CharacterDataStorage);
    });
  }

  /**
   * 获取角色详细数据
   * @param characterId - 角色ID
   * @returns 角色详细数据或null
   */
  async getCharacterData(characterId: string): Promise<CharacterDataStorage | null> {
    return dbService.withRetry(async () => {
      return await gameDb.char_data.get(characterId) as unknown as CharacterDataStorage | null;
    });
  }

  /**
   * 删除角色详细数据
   * @param characterId - 角色ID
   */
  async deleteCharacterData(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_data.delete(characterId);
    });
  }

  /**
   * 获取游戏状态（当前选中角色ID）
   * @returns 当前角色ID或null
   */
  async getGameState(): Promise<{ currentCharacterId: string | null } | null> {
    return dbService.withRetry(async () => {
      return await gameDb.runtime_gameState.get('gameState') as unknown as { currentCharacterId: string | null } | null;
    });
  }

  /**
   * 保存游戏状态（当前选中角色ID）
   * 
   * 使用事务确保原子性读-改-写，避免与 shop/map 等模块并发写入时丢失数据。
   * @param currentCharacterId - 当前角色ID
   */
  async saveGameState(currentCharacterId: string | null): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.runtime_gameState, async () => {
        const existing = await gameDb.runtime_gameState.get('gameState');
        await gameDb.runtime_gameState.put({
          ...existing,
          id: 'gameState',
          currentCharacterId,
          lastPlayedAt: new Date().toISOString()
        });
      });
    });
  }

  /**
   * 将角色数据转换为存储格式
   * @param characterId - 角色ID
   * @param character - 角色数据
   * @param bonusStats - 属性加成
   * @returns 存储格式数据
   */
  toStorageFormat(
    characterId: string,
    character: Character,
    bonusStats: Partial<Stats>
  ): CharacterDataStorage {
    return {
      characterId,
      name: character.name,
      factionId: character.factionId,
      raceId: character.raceId,
      classId: character.classId,
      level: character.level,
      exp: character.exp,
      expToNextLevel: character.expToNextLevel,
      gold: character.gold,
      baseStats: character.stats,
      currentHp: character.hp,
      maxHp: character.maxHp,
      currentMp: character.mana,
      maxMp: character.maxMana,
      bonusStats,
      createdTime: (character as any).createdTime ?? Date.now(),
      lastPlayedTime: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * 将存储格式转换为角色数据
   * @param storage - 存储格式数据
   * @returns 角色数据
   */
  fromStorageFormat(storage: CharacterDataStorage): Character {
    return {
      name: storage.name,
      factionId: storage.factionId,
      raceId: storage.raceId,
      classId: storage.classId,
      level: storage.level,
      exp: storage.exp,
      expToNextLevel: storage.expToNextLevel,
      hp: storage.currentHp,
      maxHp: storage.maxHp,
      mana: storage.currentMp,
      maxMana: storage.maxMp,
      stats: storage.baseStats,
      gold: storage.gold
    };
  }
}

/**
 * 角色数据层实例
 */
export const characterDbService = new CharacterDbService();
