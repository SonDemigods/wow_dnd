/**
 * 角色模块数据层
 *
 * 封装角色数据的 IndexedDB 操作，提供数据持久化能力
 *
 * P3-116 修复：GameState 操作（getGameState/saveGameState）已迁移到 GameStore，
 * 本模块不再直接访问 runtime_gameState 表。
 */
import { db as gameDb, dbService } from '@/modules/data';
import type { CharacterDataStorage } from './types';
import type { Character, CharacterListItem, Stats, RaceType, ClassType, FactionType } from './types';
import { toRawData } from '../../utils';
import { POINTS_PER_LEVEL } from '@/config/character';
import { computeEffectiveStats, recalculateHpMp } from './service';

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
      // P3-107 修复：显式构造对象，逐字段从 existing 中提取需要保留的字段，
      // 避免 `{ ...existing, ...data }` spread 合并可能保留 existing 中的脏字段
      // （如历史遗留字段或意外写入的临时字段）。
      // 新建场景下 existing 不存在，使用合理默认值占位（随后 persistCharacter 会写入完整数据覆盖）。
      const defaultStats: Stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      const defaultZeroStats: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
      await gameDb.char_data.put({
        characterId: character.id,
        name: character.name,
        factionId: character.factionId,
        raceId: character.raceId,
        classId: character.classId,
        level: character.level,
        // 以下字段来自 existing，保留以避免覆盖完整角色数据
        exp: existing?.exp ?? 0,
        expToNextLevel: existing?.expToNextLevel ?? 100,
        gold: existing?.gold ?? 0,
        baseStats: existing?.baseStats ?? defaultStats,
        // 四层属性新字段：existing 存在则保留，否则初始化为 0（新角色或旧存档由 fromStorageFormat 迁移）
        potionStats: existing?.potionStats ?? defaultZeroStats,
        allocatedStats: existing?.allocatedStats ?? defaultZeroStats,
        unallocatedPoints: existing?.unallocatedPoints ?? 0,
        currentHp: existing?.currentHp ?? 100,
        maxHp: existing?.maxHp ?? 100,
        currentMp: existing?.currentMp ?? 50,
        maxMp: existing?.maxMp ?? 50,
        bonusStats: existing?.bonusStats ?? {},
        // 坐骑配置：existing 存在则保留，否则初始化为全 null（旧存档由 fromStorageFormat 迁移）
        mountChoices: existing?.mountChoices ?? [null, null, null, null, null],
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
      // 四层属性：药剂层、升级层、未分配点数
      potionStats: character.potionStats,
      allocatedStats: character.allocatedStats,
      unallocatedPoints: character.unallocatedPoints,
      currentHp: character.hp,
      maxHp: character.maxHp,
      currentMp: character.mana,
      maxMp: character.maxMana,
      bonusStats,
      // 坐骑配置：直接写入（Character.mountChoices 必有值，由 createInitialCharacter/fromStorageFormat 保证）
      mountChoices: character.mountChoices,
      createdTime: character.createdTime ?? Date.now(), // 兜底：createdTime 为可选字段
      lastPlayedTime: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * 将存储格式转换为角色数据
   * 字段名映射：currentHp→hp、currentMp→mana、baseStats→stats（IndexedDB 命名 → UI 命名）
   *
   * 旧存档迁移（见 plan.md §7.1）：
   * 当 storage.potionStats 缺失时判定为旧存档，执行一次性迁移：
   * - baseStats：反推剥离等级加成 newBaseStats[key] = clamp(oldBaseStats[key] - (level - 1), 1)
   *   （旧 applyLevelUp 每级全属性 +1，等级 N 时已加 N-1 次）
   * - potionStats/allocatedStats：初始化全 0（旧存档未使用过药剂/升级分配）
   * - unallocatedPoints：补发 (level - 1) * POINTS_PER_LEVEL（玩家可重新分配）
   *
   * 迁移说明：
   * - 反推规则基于"每级全属性 +1"历史。若旧角色曾通过 setRace/setClass 重置 baseStats，
   *   反推会过度扣减，但补发的 unallocatedPoints 可由玩家重新分配修正（plan §8 风险对策）。
   * - 迁移后 effectiveStats 可能与旧存档不同（玩家可重新分配），这是预期行为。
   * - 新存档（含 potionStats）不做反推，直接使用存储值。
   *
   * @param storage - 存储格式数据
   * @returns 角色数据
   */
  fromStorageFormat(storage: CharacterDataStorage): Character {
    const defaultZeroStats: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const isOldSave = storage.potionStats === undefined;

    // 旧存档反推 baseStats：剥离 (level - 1) 的等级加成
    const levelBonus = storage.level - 1;
    const migratedBaseStats: Stats = isOldSave
      ? {
          str: Math.max(1, storage.baseStats.str - levelBonus),
          dex: Math.max(1, storage.baseStats.dex - levelBonus),
          con: Math.max(1, storage.baseStats.con - levelBonus),
          int: Math.max(1, storage.baseStats.int - levelBonus),
          wis: Math.max(1, storage.baseStats.wis - levelBonus),
          cha: Math.max(1, storage.baseStats.cha - levelBonus)
        }
      : storage.baseStats;

    const character: Character = {
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
      stats: migratedBaseStats,
      // 四层属性：旧存档迁移为默认值，新存档直接使用
      potionStats: storage.potionStats ?? defaultZeroStats,
      allocatedStats: storage.allocatedStats ?? defaultZeroStats,
      unallocatedPoints: storage.unallocatedPoints ?? levelBonus * POINTS_PER_LEVEL,
      gold: storage.gold,
      // 坐骑配置：旧存档缺失时迁移为全 null（5 档未选）；新存档直接使用
      // 旧存档即使有 mountChoices 也无需重算 bonus（store 加载时由 selectCharacter 重建 bonusStats）
      mountChoices: storage.mountChoices ?? [null, null, null, null, null],
      // P1-16 修复：保留 createdTime，避免重新加载角色时被 Date.now() 覆盖
      createdTime: storage.createdTime
    };

    // 旧存档迁移后 baseStats 变化，存储的 maxHp/maxMana 基于旧 con/int 已失效，需重算
    // 重算后当前 HP/MP 按原 recalculateHpMp 规则截断到新上限（plan §7.2）
    if (isOldSave) {
      const effStats = computeEffectiveStats(
        character.stats,
        character.potionStats,
        character.allocatedStats,
        storage.bonusStats
      );
      return recalculateHpMp(character, effStats);
    }

    return character;
  }
}

/**
 * 角色数据层实例
 */
export const characterDbService = new CharacterDbService();
