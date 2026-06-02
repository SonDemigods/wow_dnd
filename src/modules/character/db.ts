/**
 * 角色模块数据层
 * 
 * 封装角色数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { Character, CharacterListItem, Stats } from './types';

/**
 * 角色数据存储接口
 */
export interface CharacterDataStorage {
  characterId: string;
  name: string;
  factionId: string;
  raceId: string;
  classId: string;
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
  updatedAt: number;
}

/**
 * 角色数据层服务
 */
export class CharacterDbService {
  /**
   * 保存角色列表项到数据库
   * @param character - 角色列表项
   */
  async saveCharacterListItem(character: CharacterListItem): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_profiles.put({
        id: character.id,
        name: character.name,
        raceId: character.raceId,
        classId: character.classId,
        factionId: character.factionId,
        level: character.level,
        createdTime: character.createdTime,
        lastPlayedTime: character.lastPlayedTime
      });
    });
  }

  /**
   * 获取所有角色列表项
   * @returns 角色列表项数组
   */
  async getAllCharacterListItems(): Promise<CharacterListItem[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.char_profiles.toArray();
      return items.map(item => ({
        id: item.id,
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
      const item = await gameDb.char_profiles.get(characterId);
      if (!item) return null;
      return {
        id: item.id,
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
   * 删除角色列表项
   * @param characterId - 角色ID
   */
  async deleteCharacterListItem(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_profiles.delete(characterId);
    });
  }

  /**
   * 保存角色详细数据
   * @param data - 角色详细数据
   */
  async saveCharacterData(data: CharacterDataStorage): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_data.put(data);
    });
  }

  /**
   * 获取角色详细数据
   * @param characterId - 角色ID
   * @returns 角色详细数据或null
   */
  async getCharacterData(characterId: string): Promise<CharacterDataStorage | null> {
    return dbService.withRetry(async () => {
      return await gameDb.char_data.get(characterId);
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
      return await gameDb.runtime_gameState.get('gameState');
    });
  }

  /**
   * 保存游戏状态（当前选中角色ID）
   * @param currentCharacterId - 当前角色ID
   */
  async saveGameState(currentCharacterId: string | null): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_gameState.put({
        id: 'gameState',
        currentCharacterId,
        lastPlayedAt: new Date().toISOString()
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
