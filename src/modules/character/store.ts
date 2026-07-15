/**
 * 角色模块状态管理（Store 核心架构）
 * 
 * Store 是角色数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Character, CharacterListItem, Stats, Attributes, FactionType, RaceType, ClassType, FactionData, RaceData, ClassData, CreateCharacterParams } from './types';
import { characterDbService } from './db';
import { eventBus, GameEvents } from '../bus';
import { useBaseStore } from '../base/store';
// CHR-4 修复：角色创建/删除的跨模块持久化逻辑收口到 CharacterLifecycleService，
// Store 层不再直接依赖其他模块的 DbService，遵循五层架构原则。
import { characterLifecycleService } from '@/services/CharacterLifecycleService';
import {
  generateCharacterId,
  createInitialCharacter,
  computeEffectiveStats,
  computeAttributes,
  applyHpChange,
  applyMpChange,
  applyExpGain,
  applyGoldChange,
  canAffordGold,
  computeBonusChange,
  computeInitialStats,
  recalculateHpMp,
  computeResurrection,
  isClassFactionCompatible
} from './service';
import { getExpForLevel } from '@/utils/calculations';
import { backupService, importService, dataInitializer } from '../data';
import type { ImportResult, ValidationResult } from '../data';

export const useCharacterStore = defineStore('character', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================
  const currentCharacterId = ref<string | null>(null);
  const character = ref<Character | null>(null);
  const characterList = ref<CharacterListItem[]>([]);
  const bonusStats = ref<Partial<Stats>>({});
  const raceBonus = ref<Partial<Stats>>({});
  const classBonus = ref<Partial<Stats>>({});

  // 缓存的基础数据
  const factionsData = ref<Record<string, FactionData>>({});
  const racesData = ref<Record<string, RaceData>>({});
  const classesData = ref<Record<string, ClassData>>({});

  // ==================== 计算属性 ====================
  // 所有百分比均为 [0, 100] 范围整数，用于 UI 进度条展示

  const isLoggedIn = computed(() => currentCharacterId.value !== null);

  const effectiveStats = computed<Stats>(() => {
    if (!character.value) return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    return computeEffectiveStats(character.value.stats, bonusStats.value);
  });

  const attributes = computed<Attributes>(() => computeAttributes(effectiveStats.value));

  const level = computed(() => character.value?.level || 1);
  const exp = computed(() => character.value?.exp || 0);
  const expToNextLevel = computed(() => character.value?.expToNextLevel || 100);
  const expPercentage = computed(() => {
    if (expToNextLevel.value === 0) return 100;
    return Math.min(100, Math.round((exp.value / expToNextLevel.value) * 100));
  });

  const hp = computed(() => character.value?.hp || 0);
  const maxHp = computed(() => character.value?.maxHp || 100);
  const hpPercentage = computed(() => {
    if (maxHp.value === 0) return 0;
    return Math.min(100, Math.round((hp.value / maxHp.value) * 100));
  });

  const mana = computed(() => character.value?.mana || 0);
  const maxMana = computed(() => character.value?.maxMana || 50);
  const manaPercentage = computed(() => {
    if (maxMana.value === 0) return 0;
    return Math.min(100, Math.round((mana.value / maxMana.value) * 100));
  });

  const gold = computed(() => character.value?.gold || 0);
  const name = computed(() => character.value?.name || '');
  const factionId = computed<FactionType>(() => character.value?.factionId || 'neutral');
  const raceId = computed<RaceType>(() => character.value?.raceId || 'human');
  const classId = computed<ClassType>(() => character.value?.classId || 'warrior');

  const factionName = computed(() => factionsData.value[factionId.value]?.name || '未知阵营');
  const raceName = computed(() => racesData.value[raceId.value]?.name || '未知种族');
  const className = computed(() => classesData.value[classId.value]?.name || '未知职业');
  const raceIcon = computed(() => racesData.value[raceId.value]?.icon || 'game-icons:person');
  const factionIcon = computed(() => factionsData.value[factionId.value]?.icon || 'game-icons:checked-shield');
  const classIcon = computed(() => classesData.value[classId.value]?.icon || 'game-icons:broadsword');
  const factionColor = computed(() => factionsData.value[factionId.value]?.color || '#9d9d9d');
  const classColor = computed(() => classesData.value[classId.value]?.color || '#9d9d9d');

  // ==================== 持久化辅助方法 ====================

  /** 保存角色数据到数据库（saveCharacterData 已包含列表字段，无需单独更新列表项） */
  async function persistCharacter(): Promise<void> {
    if (!currentCharacterId.value || !character.value) return;
    const storage = characterDbService.toStorageFormat(currentCharacterId.value, character.value, bonusStats.value);
    await characterDbService.saveCharacterData(storage);
  }

  // ==================== Action：初始化 ====================

  async function initialize(): Promise<void> {
    // 从 baseStore 获取基础数据
    const baseStore = useBaseStore();
    factionsData.value = Object.fromEntries(baseStore.factions.map(f => [f.id, f]));
    racesData.value = Object.fromEntries(baseStore.races.map(r => [r.id, r]));
    classesData.value = Object.fromEntries(baseStore.classes.map(c => [c.id, c]));

    // 从数据库恢复上次登录的角色
    const gameState = await characterDbService.getGameState();
    if (gameState?.currentCharacterId) {
      await selectCharacter(gameState.currentCharacterId, false);
    }
    await loadCharacterList();
  }

  // ==================== Action：角色列表 ====================

  async function loadCharacterList(): Promise<void> {
    characterList.value = await characterDbService.getAllCharacterListItems();
  }

  // ==================== Action：创建角色 ====================
  // 编排流程：Service 纯函数 → Store 状态更新 → 技能初始化 → DB 持久化 → 事件通知

  async function createCharacter(
    name: string,
    factionIdParam: FactionType,
    raceIdParam: RaceType,
    classIdParam: ClassType
  ): Promise<string> {
    const id = generateCharacterId();
    const race = racesData.value[raceIdParam];
    const cls = classesData.value[classIdParam];

    // 校验职业与阵营兼容性（如 death_knight 不对 neutral 开放、evoker 仅对 neutral 开放）
    if (cls && !isClassFactionCompatible(cls, factionIdParam)) {
      throw new Error(`职业「${cls.name}」不支持阵营「${factionIdParam}」`);
    }

    const params: CreateCharacterParams = {
      name,
      factionId: factionIdParam,
      raceId: raceIdParam,
      classId: classIdParam
    };

    // 1. 调用纯函数创建角色数据
    const newChar = createInitialCharacter(params, race, cls);

    // 2. 更新 Store 状态
    character.value = newChar;
    currentCharacterId.value = id;
    raceBonus.value = race?.bonus || {};
    classBonus.value = cls?.bonus || {};

    // 3. 初始化技能数据（CHR-4 修复：通过 CharacterLifecycleService 收口跨模块持久化）
    await characterLifecycleService.initializeCharacterSkills(id, classIdParam);

    // 4. 持久化到数据库
    const listItem: CharacterListItem = {
      id,
      name,
      raceId: raceIdParam,
      classId: classIdParam,
      factionId: factionIdParam,
      level: 1,
      createdTime: Date.now(),
      lastPlayedTime: Date.now()
    };
    await characterDbService.saveCharacterListItem(listItem);
    await persistCharacter();

    // 5. 通知 UI
    eventBus.emit(GameEvents.CHARACTER_CREATED, { characterId: id, name });
    await loadCharacterList();

    return id;
  }

  // ==================== Action：选择角色 ====================

  /**
   * 选择角色并加载完整数据
   * @param characterId - 角色ID
   * @param emitEvent - 是否发送切换事件，initialize 中调用时传 false 避免无意义的 UI 重绘
   */
  async function selectCharacter(characterId: string, emitEvent: boolean = true): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    const data = await characterDbService.getCharacterData(characterId);

    if (!listItem || !data) return false;

    // 更新最后游玩时间
    listItem.lastPlayedTime = Date.now();
    await characterDbService.saveCharacterListItem(listItem);

    // 更新 Store 状态
    character.value = characterDbService.fromStorageFormat(data);
    currentCharacterId.value = characterId;
    bonusStats.value = data.bonusStats || {};

    const race = racesData.value[data.raceId];
    const cls = classesData.value[data.classId];
    raceBonus.value = race?.bonus || {};
    classBonus.value = cls?.bonus || {};

    // 持久化游戏状态
    await characterDbService.saveGameState(characterId);

    // 通知 UI（角色切换时发送 CHARACTER_LOGOUT 用于清理旧角色的音频等模块状态）
    // 注意：initialize 中直接调用时不发送事件，避免启动时多余的 UI 重绘
    if (emitEvent) {
      eventBus.emit(GameEvents.CHARACTER_LOGOUT, null); // 先登出旧角色 UI 状态
    }

    return true;
  }

  // ==================== Action：删除角色 ====================

  async function deleteCharacter(characterId: string): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    if (!listItem) return false;

    // 删除角色本模块数据
    await characterDbService.deleteCharacterData(characterId);
    // CHR-4 修复：级联删除其他模块数据收口到 CharacterLifecycleService
    await characterLifecycleService.cascadeDeleteCharacter(characterId);

    // 清理 Store 状态
    if (currentCharacterId.value === characterId) {
      currentCharacterId.value = null;
      character.value = null;
      bonusStats.value = {};
      raceBonus.value = {};
      classBonus.value = {};
      await characterDbService.saveGameState(null);
    }

    // 通知 UI
    eventBus.emit(GameEvents.CHARACTER_DELETED, { characterId });
    await loadCharacterList();

    return true;
  }

  // ==================== Action：登出 ====================

  async function logout(): Promise<void> {
    currentCharacterId.value = null;
    character.value = null;
    bonusStats.value = {};
    raceBonus.value = {};
    classBonus.value = {};
    await characterDbService.saveGameState(null);
    eventBus.emit(GameEvents.CHARACTER_LOGOUT, null);
  }

  // ==================== Action：生命值变更 ====================

  /** 受到伤害（供其他模块直接调用，BIZ-9：仅扣血，死亡处理由调用方触发） */
  async function takeDamage(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    const updated = applyHpChange(character.value, -amount);
    character.value = updated;
    await persistCharacter();
  }

  /** 获得生命恢复（供其他模块直接调用） */
  async function receiveHeal(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    character.value = applyHpChange(character.value, amount);
    await persistCharacter();
  }

  /** 直接设置生命值 */
  async function setHp(value: number): Promise<void> {
    if (!character.value) return;
    character.value = { ...character.value, hp: Math.min(character.value.maxHp, Math.max(0, value)) };
    await persistCharacter();
  }

  // ==================== Action：法力值变更 ====================

  /** 获得/消耗法力值（供其他模块直接调用） */
  async function changeMp(amount: number): Promise<void> {
    if (!character.value) return;
    character.value = applyMpChange(character.value, amount);
    await persistCharacter();
  }

  /** 直接设置法力值 */
  async function setMp(value: number): Promise<void> {
    if (!character.value) return;
    character.value = { ...character.value, mana: Math.min(character.value.maxMana, Math.max(0, value)) };
    await persistCharacter();
  }

  // ==================== Action：经验值变更 ====================

  /** 获得经验值（供其他模块直接调用） */
  async function gainExp(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;

    const { character: updated, leveledUp } = applyExpGain(character.value, amount);
    const oldLevel = character.value.level;
    character.value = updated;
    await persistCharacter();

    if (leveledUp) {
      eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, { oldLevel, newLevel: updated.level });
    }
  }

  // ==================== Action：金币变更 ====================

  /** 获得金币（供其他模块直接调用） */
  async function gainGold(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    character.value = applyGoldChange(character.value, amount);
    await persistCharacter();
  }

  /** 花费金币 */
  async function spendGold(amount: number): Promise<boolean> {
    if (!character.value || !canAffordGold(character.value, amount)) return false;
    character.value = applyGoldChange(character.value, -amount);
    await persistCharacter();
    return true;
  }

  // ==================== Action：属性加成 ====================

  /** 应用属性加成（装备等，供其他模块直接调用） */
  async function applyBonus(delta: Partial<Stats>): Promise<void> {
    if (!character.value) return;
    bonusStats.value = computeBonusChange(bonusStats.value, delta, true);
    // P3-6：仅当影响 HP/MP 的属性（体质/智力/感知）变化时才重算（HP←con，MP←int/wis，cha 不影响）
    if (delta.con || delta.int || delta.wis) {
      const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
      character.value = recalculateHpMp(character.value, effStats);
    }
    await persistCharacter();
  }

  /** 移除属性加成（装备卸下等，供其他模块直接调用） */
  async function removeBonus(delta: Partial<Stats>): Promise<void> {
    if (!character.value) return;
    bonusStats.value = computeBonusChange(bonusStats.value, delta, false);
    // P3-6：与 applyBonus 保持对称，仅当影响 HP/MP 的属性（体质/智力/感知）变化时才重算
    if (delta.con || delta.int || delta.wis) {
      const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
      character.value = recalculateHpMp(character.value, effStats);
    }
    await persistCharacter();
  }

  // ==================== Action：种族/职业变更 ====================
  // setRace/setClass 共用模式：更新内部 bonus → 重算基础属性 → 重算衍生属性 → 持久化

  /** 设置种族 */
  async function setRace(race: RaceType): Promise<void> {
    if (!character.value) return;
    const raceData = racesData.value[race];
    raceBonus.value = raceData?.bonus || {};
    character.value = {
      ...character.value,
      raceId: race,
      stats: computeInitialStats(raceBonus.value, classBonus.value)
    };
    const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
    character.value = recalculateHpMp(character.value, effStats);
    await persistCharacter();
  }

  /** 设置职业 */
  async function setClass(classIdParam: ClassType): Promise<void> {
    if (!character.value) return;
    const classData = classesData.value[classIdParam];
    classBonus.value = classData?.bonus || {};
    character.value = {
      ...character.value,
      classId: classIdParam,
      stats: computeInitialStats(raceBonus.value, classBonus.value)
    };
    const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
    character.value = recalculateHpMp(character.value, effStats);
    await persistCharacter();
  }

  /** 设置角色名称 */
  async function setName(nameStr: string): Promise<void> {
    if (!character.value) return;
    const id = currentCharacterId.value;
    if (!id) return;
    character.value = { ...character.value, name: nameStr };
    // 通过主键精确更新角色列表项（浅拷贝 DB 返回对象，避免直接 mutate 持久化层引用）
    const item = await characterDbService.getCharacterListItem(id);
    if (item) {
      const updatedItem = { ...item, name: nameStr };
      await characterDbService.saveCharacterListItem(updatedItem);
    }
    await persistCharacter();
  }

  /** 重置角色 */
  async function reset(): Promise<void> {
    if (!character.value) return;
    const race = racesData.value[character.value.raceId];
    const cls = classesData.value[character.value.classId];
    raceBonus.value = race?.bonus || {};
    classBonus.value = cls?.bonus || {};
    character.value = {
      ...character.value,
      level: 1,
      exp: 0,
      expToNextLevel: getExpForLevel(2),
      stats: computeInitialStats(raceBonus.value, classBonus.value),
    };
    const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
    character.value = recalculateHpMp(character.value, effStats);
    // 重置后回满 HP/MP（更新 maxHp/maxMpa 后同步当前值到上限）
    character.value = { ...character.value, hp: character.value.maxHp, mana: character.value.maxMana };
    await persistCharacter();
  }

  // ==================== Action：死亡与复活 ====================

  /** 处理角色死亡 */
  async function handleDeath(): Promise<void> {
    if (!character.value) return;

    eventBus.emit(GameEvents.CHARACTER_DEATH, { cause: 'death' });
    await persistCharacter();

    // 自动复活（由 computeResurrection 统一处理经验清零等状态重置）
    await resurrect();
  }

  /** 复活角色 */
  async function resurrect(): Promise<void> {
    if (!character.value) return;
    character.value = computeResurrection(character.value);
    eventBus.emit(GameEvents.CHARACTER_RESURRECTED, {
      newHp: character.value.hp,
      newMp: character.value.mana
    });
    await persistCharacter();
  }

  // ==================== Action：获取数据 ====================

  function getCharacterId(): string | null {
    return currentCharacterId.value;
  }

  function getCharacterData(): Character | null {
    return character.value;
  }

  // ==================== Action：导出/导入存档 ====================
  // 这些方法仅为薄委托，将调用转发给 data 模块的专业 Service
  // 放在 character store 中是为了方便 UI 组件通过单一 Store 入口访问

  /** 导出存档：委托给 BackupService 导出 JSON 文件 */
  async function exportBackup(): Promise<void> {
    await backupService.exportBackup();
  }

  /** 验证导入存档文件：委托给 ImportService */
  async function validateImportBackup(file: File): Promise<ValidationResult> {
    return importService.validateBackup(file);
  }

  /** 导入存档：委托给 ImportService 执行数据导入 */
  async function importBackup(file: File): Promise<ImportResult> {
    return importService.importBackup(file);
  }

  /** 修复基础数据：清空所有 config 表并重新导入默认数据 */
  async function repairBaseData(): Promise<void> {
    await dataInitializer.reinitializeData();
  }

  return {
    // 状态
    currentCharacterId,
    character,
    characterList,
    bonusStats,
    raceBonus,
    classBonus,
    factionsData,
    racesData,
    classesData,

    // 计算属性
    isLoggedIn,
    effectiveStats,
    attributes,
    level, exp, expToNextLevel, expPercentage,
    hp, maxHp, hpPercentage,
    mana, maxMana, manaPercentage,
    gold, name,
    factionId, raceId, classId,
    factionName, raceName, className,
    raceIcon, factionIcon, classIcon,
    factionColor, classColor,

    // Action
    initialize,
    loadCharacterList,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    logout,
    takeDamage,
    receiveHeal,
    setHp,
    changeMp,
    setMp,
    gainExp,
    gainGold,
    spendGold,
    applyBonus,
    removeBonus,
    setRace,
    setClass,
    setName,
    reset,
    handleDeath,
    resurrect,
    getCharacterId,
    getCharacterData,
    exportBackup,
    validateImportBackup,
    importBackup,
    repairBaseData
  };
});
