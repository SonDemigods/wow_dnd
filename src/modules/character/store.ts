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
import { eventBus, GameEvents } from '../bus/core';
import { useGameDataStore } from '../gameData/store';
import { skillsDbService } from '../skill/db';
import { inventoryDbService } from '../inventory/db';
import { equipmentDbService } from '../equipment/db';
import { explorationDbService } from '../exploration/db';
import { adventureLogDbService } from '../log/db';
import { questDbService } from '../quest/db';
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
  recalculateBaseStats,
  recalculateHpMp,
  computeResurrection,
  isDead
} from './service';
import { getExpForLevel } from '@/utils/calculations';
import { backupService, importService } from '../data';
import type { ImportResult, ValidationResult } from '../data';
import type { Skill, SkillBar } from '../skill/types';

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
  const raceIcon = computed(() => racesData.value[raceId.value]?.icon || '👤');
  const factionIcon = computed(() => factionsData.value[factionId.value]?.icon || '🏳️');
  const classIcon = computed(() => classesData.value[classId.value]?.icon || '⚔️');
  const factionColor = computed(() => factionsData.value[factionId.value]?.color || '#9d9d9d');
  const classColor = computed(() => classesData.value[classId.value]?.color || '#9d9d9d');

  // ==================== 持久化辅助方法 ====================

  /** 保存角色数据到数据库 */
  async function persistCharacter(): Promise<void> {
    if (!currentCharacterId.value || !character.value) return;
    const storage = characterDbService.toStorageFormat(currentCharacterId.value, character.value, bonusStats.value);
    await characterDbService.saveCharacterData(storage);

    // 同步更新角色列表项
    const item = await characterDbService.getCharacterListItem(currentCharacterId.value);
    if (item) {
      item.level = character.value.level;
      item.name = character.value.name;
      item.lastPlayedTime = Date.now();
      await characterDbService.saveCharacterListItem(item);
    }
  }

  // ==================== Action：初始化 ====================

  async function initialize(): Promise<void> {
    // 从 gameDataStore 获取基础数据
    const gameDataStore = useGameDataStore();
    factionsData.value = Object.fromEntries(gameDataStore.factions.map(f => [f.id, f]));
    racesData.value = Object.fromEntries(gameDataStore.races.map(r => [r.id, r]));
    classesData.value = Object.fromEntries(gameDataStore.classes.map(c => [c.id, c]));

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

  async function createCharacter(
    name: string,
    factionIdParam: FactionType,
    raceIdParam: RaceType,
    classIdParam: ClassType
  ): Promise<string> {
    const id = generateCharacterId();
    const race = racesData.value[raceIdParam];
    const cls = classesData.value[classIdParam];

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

    // 3. 初始化技能数据
    const classAbilities = await skillsDbService.getSkillTemplatesByClass(classIdParam);
    const skills: Skill[] = classAbilities
      .filter(skill => skill.unlockLevel <= 1)
      .map(skill => ({ ...skill }));
    const skillBar: SkillBar = { slots: [null, null, null, null] };
    skills.forEach((skill, index) => {
      if (index < 4) skillBar.slots[index] = skill.id;
    });

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
    await skillsDbService.saveSkillsData({
      characterId: id,
      skills,
      skillBar,
      currentClass: classIdParam,
      updatedAt: Date.now()
    });

    // 5. 通知 UI
    eventBus.emit(GameEvents.CHARACTER_CREATED, { characterId: id, name });
    await loadCharacterList();

    return id;
  }

  // ==================== Action：选择角色 ====================

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

    // 通知 UI（角色切换时发送，直接 selectCharacter 内部调用时不发送）
    if (emitEvent) {
      eventBus.emit(GameEvents.CHARACTER_LOGOUT, null); // 先登出旧角色 UI 状态
    }

    return true;
  }

  // ==================== Action：删除角色 ====================

  async function deleteCharacter(characterId: string): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    if (!listItem) return false;

    // 删除所有相关数据
    await characterDbService.deleteCharacterListItem(characterId);
    await characterDbService.deleteCharacterData(characterId);
    await skillsDbService.deleteSkillsData(characterId);
    await inventoryDbService.deleteInventory(characterId);
    await equipmentDbService.deleteEquipment(characterId);
    await explorationDbService.deleteExplorationData(characterId);
    await adventureLogDbService.deleteAdventureLog(characterId);
    await questDbService.deleteCharacterQuests(characterId);

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

  /** 受到伤害（供其他模块直接调用） */
  async function takeDamage(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    const updated = applyHpChange(character.value, -amount);
    character.value = updated;
    await persistCharacter();

    if (isDead(updated)) {
      await handleDeath();
    }
  }

  /** 获得治疗（供其他模块直接调用） */
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
    if (!character.value || amount === 0) return;
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
    // 如果体质/智力/感知/魅力变化，重新计算 HP/MP 上限
    if (delta.con || delta.int || delta.wis || delta.cha) {
      const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
      character.value = recalculateHpMp(character.value, effStats);
    }
    await persistCharacter();
  }

  /** 移除属性加成（装备卸下等，供其他模块直接调用） */
  async function removeBonus(delta: Partial<Stats>): Promise<void> {
    if (!character.value) return;
    bonusStats.value = computeBonusChange(bonusStats.value, delta, false);
    const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
    character.value = recalculateHpMp(character.value, effStats);
    await persistCharacter();
  }

  // ==================== Action：种族/职业变更 ====================

  /** 设置种族 */
  async function setRace(race: RaceType): Promise<void> {
    if (!character.value) return;
    const raceData = racesData.value[race];
    raceBonus.value = raceData?.bonus || {};
    character.value = {
      ...character.value,
      raceId: race,
      stats: recalculateBaseStats(raceBonus.value, classBonus.value)
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
      stats: recalculateBaseStats(raceBonus.value, classBonus.value)
    };
    const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
    character.value = recalculateHpMp(character.value, effStats);
    await persistCharacter();
  }

  /** 设置角色名称 */
  async function setName(nameStr: string): Promise<void> {
    if (!character.value) return;
    character.value = { ...character.value, name: nameStr };
    // 更新角色列表项
    const items = await characterDbService.getAllCharacterListItems();
    const item = items.find(i => i.id === currentCharacterId.value);
    if (item) {
      item.name = nameStr;
      await characterDbService.saveCharacterListItem(item);
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
      stats: recalculateBaseStats(raceBonus.value, classBonus.value),
    };
    const effStats = computeEffectiveStats(character.value.stats, bonusStats.value);
    character.value = recalculateHpMp(character.value, effStats);
    character.value = { ...character.value, hp: character.value.maxHp, mana: character.value.maxMana };
    await persistCharacter();
  }

  // ==================== Action：死亡与复活 ====================

  /** 处理角色死亡 */
  async function handleDeath(): Promise<void> {
    if (!character.value) return;

    // 损失本级经验
    character.value = { ...character.value, exp: 0 };
    eventBus.emit(GameEvents.CHARACTER_DEATH, { cause: 'death' });
    await persistCharacter();

    // 自动复活
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

  // ==================== 跨模块事件监听（仅保留 UI/音效事件） ====================

  function setupCrossModuleListeners(): void {
    // 在新架构下，Store 之间通过直接调用 Action 通信，
    // 不再通过 EventBus 监听数据变更事件。
    // 此方法保留用于未来需要监听外部 UI 事件时使用。
  }

  function dispose(): void {
    eventBus.clearGroup('characterStore');
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

    // 生命周期
    setupCrossModuleListeners,
    dispose
  };
});
