/**
 * 角色模块数据层
 * 
 * 封装角色数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { CharacterDataStorage } from './types';
import { getGameState, saveGameState } from '../data/gameStateHelper';
import type { Character, CharacterListItem, Stats, RaceType, ClassType, FactionType } from './types';
import { toRawData } from '../../utils';

/**
 * 角色数据层服务
 */
export class CharacterDbService {
  /**
   * 保存角色列表项（写入 char_data，仅更新列表字段）
   * 注：因 char_data 表同时存储完整角色数据，需要先读出已有数据以避免覆盖非列表字段
   * @param character - 角色列表项
   */
  async saveCharacterListItem(character: CharacterListItem): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.char_data.get(character.id) as Partial<CharacterDataStorage> | undefined;
      await gameDb.char_data.put({
        ...existing,
        characterId: character.id,
        name: character.name,
        factionId: character.factionId,
        raceId: character.raceId,
        classId: character.classId,
        level: character.level,
        createdTime: character.createdTime,
        lastPlayedTime: character.lastPlayedTime,
        updatedAt: Date.now()
      } as CharacterDataStorage);
    });
  }

  /**
   * 获取所有角色列表项
   * 从 char_data 全表中提取列表展示字段，按需做类型转换（IndexedDB 存储为 string）
   * @returns 角色列表项数组
   */
  async getAllCharacterListItems(): Promise<CharacterListItem[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.char_data.toArray() as CharacterDataStorage[];
      return items.map(item => ({
        id: item.characterId,
        name: item.name,
        raceId: item.raceId as RaceType,
        classId: item.classId as ClassType,
        factionId: item.factionId as FactionType,
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
      const item = await gameDb.char_data.get(characterId) as CharacterDataStorage | undefined;
      if (!item) return null;
      return {
        id: item.characterId,
        name: item.name,
        raceId: item.raceId as RaceType,
        classId: item.classId as ClassType,
        factionId: item.factionId as FactionType,
        level: item.level,
        createdTime: item.createdTime,
        lastPlayedTime: item.lastPlayedTime
      };
    });
  }

  /**
   * 保存角色详细数据
   * @param data - 角色详细数据
   */
  async saveCharacterData(data: CharacterDataStorage): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData(data);
      await gameDb.char_data.put(cleanData);
    });
  }

  /**
   * 获取角色详细数据
   * 返回 IndexedDB 原始存储格式，由调用方（store）通过 fromStorageFormat 转换为 Character
   * @param characterId - 角色ID
   * @returns 角色详细数据或null
   */
  async getCharacterData(characterId: string): Promise<CharacterDataStorage | null> {
    return dbService.withRetry(async () => {
      return await gameDb.char_data.get(characterId) as CharacterDataStorage | null;
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
    const state = await getGameState();
    if (!state) return null;
    return { currentCharacterId: state.currentCharacterId ?? null };
  }

  /**
   * 保存游戏状态（当前选中角色ID）
   * @param currentCharacterId - 当前角色ID
   */
  async saveGameState(currentCharacterId: string | null): Promise<void> {
    await saveGameState({ currentCharacterId, lastPlayedAt: new Date().toISOString() });
  }

  /**
   * 将角色数据转换为存储格式
   * createdTime 在首次创建时可能为空（Character.createdTime 为可选），兜底使用当前时间
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
      createdTime: character.createdTime ?? Date.now(), // 兜底：createdTime 为可选字段
      lastPlayedTime: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * 将存储格式转换为角色数据
   * 字段名映射：currentHp→hp、currentMp→mana、baseStats→stats（IndexedDB 命名 → UI 命名）
   * @param storage - 存储格式数据
   * @returns 角色数据
   */
  fromStorageFormat(storage: CharacterDataStorage): Character {
    return {
      name: storage.name,
      factionId: storage.factionId as FactionType,
      raceId: storage.raceId as RaceType,
      classId: storage.classId as ClassType,
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
