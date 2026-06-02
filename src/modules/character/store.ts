/**
 * 角色模块状态管理
 * 
 * 使用 Pinia 管理角色状态，响应式更新UI
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Character, CharacterListItem, Stats, Attributes, FactionType, RaceType, ClassType, FactionData, RaceData, ClassData } from './types';
import { characterService } from './service';
import { eventBus, GameEvents } from '../bus/core';
import { gameDataService } from '../gameData/service';
import {
  calculateMaxHp,
  calculateMaxMana,
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateHpBonus,
  calculateMpBonus,
  calculateHealBonus
} from '@/utils/calculations';

/**
 * 角色状态存储
 */
export const useCharacterStore = defineStore('character', () => {
  // 状态
  const currentCharacterId = ref<string | null>(null);
  const character = ref<Character | null>(null);
  const characterList = ref<CharacterListItem[]>([]);
  
  // 缓存的基础数据（从数据库加载）
  const factionsData = ref<Record<string, FactionData>>({});
  const racesData = ref<Record<string, RaceData>>({});
  const classesData = ref<Record<string, ClassData>>({});

  // 计算属性
  const isLoggedIn = computed(() => currentCharacterId.value !== null);
  
  const stats = computed<Stats>(() => {
    return characterService.getStats();
  });

  const attributes = computed<Attributes>(() => {
    const s = stats.value;
    return {
      maxHp: character.value?.maxHp || calculateMaxHp(s),
      maxMana: character.value?.maxMana || calculateMaxMana(s),
      physicalAttack: calculatePhysicalAttack(s),
      physicalDefense: calculatePhysicalDefense(s),
      magicAttack: calculateMagicAttack(s),
      magicDefense: calculateMagicDefense(s),
      critChance: calculateCritChance(s),
      dodgeChance: calculateDodgeChance(s),
      hpBonus: calculateHpBonus(s),
      mpBonus: calculateMpBonus(s),
      healBonus: calculateHealBonus(s)
    };
  });

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

  const factionName = computed(() => {
    const faction = factionsData.value[factionId.value];
    return faction?.name || '未知阵营';
  });
  const raceName = computed(() => {
    const race = racesData.value[raceId.value];
    return race?.name || '未知种族';
  });
  const className = computed(() => {
    const cls = classesData.value[classId.value];
    return cls?.name || '未知职业';
  });

  const raceBonus = computed(() => {
    const race = racesData.value[raceId.value];
    return race?.bonus || {};
  });
  const classBonus = computed(() => {
    const cls = classesData.value[classId.value];
    return cls?.bonus || {};
  });

  // 方法
  async function loadCharacterList(): Promise<void> {
    characterList.value = await characterService.getAllCharacters();
  }

  async function createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): Promise<string> {
    const id = await characterService.createCharacter(name, factionId, raceId, classId);
    character.value = characterService.getCharacterInfo();
    await loadCharacterList();
    return id;
  }

  async function selectCharacter(characterId: string): Promise<boolean> {
    const success = await characterService.selectCharacter(characterId);
    if (success) {
      currentCharacterId.value = characterId;
      character.value = characterService.getCharacterInfo();
    }
    return success;
  }

  async function deleteCharacter(characterId: string): Promise<boolean> {
    const success = await characterService.deleteCharacter(characterId);
    if (success) {
      if (currentCharacterId.value === characterId) {
        currentCharacterId.value = null;
        character.value = null;
      }
      await loadCharacterList();
    }
    return success;
  }

  async function logout(): Promise<void> {
    await characterService.logout();
    currentCharacterId.value = null;
    character.value = null;
  }

  function addExp(amount: number): void {
    characterService.addExp(amount);
    character.value = characterService.getCharacterInfo();
  }

  function addHp(amount: number): void {
    characterService.addHp(amount);
    character.value = characterService.getCharacterInfo();
  }

  function addMp(amount: number): void {
    characterService.addMp(amount);
    character.value = characterService.getCharacterInfo();
  }

  function setHp(value: number): void {
    characterService.setHp(value);
    character.value = characterService.getCharacterInfo();
  }

  function setMp(value: number): void {
    characterService.setMp(value);
    character.value = characterService.getCharacterInfo();
  }

  function applyBonus(bonus: Partial<Stats>): void {
    characterService.applyBonus(bonus);
    character.value = characterService.getCharacterInfo();
  }

  function removeBonus(bonus: Partial<Stats>): void {
    characterService.removeBonus(bonus);
    character.value = characterService.getCharacterInfo();
  }

  function addGold(amount: number): void {
    characterService.addGold(amount);
    character.value = characterService.getCharacterInfo();
  }

  function spendGold(amount: number): boolean {
    const success = characterService.spendGold(amount);
    if (success) {
      character.value = characterService.getCharacterInfo();
    }
    return success;
  }

  function setName(name: string): void {
    characterService.setName(name);
    character.value = characterService.getCharacterInfo();
    loadCharacterList();
  }

  function getCurrentCharacterId(): string | null {
    return characterService.getCurrentCharacterId();
  }

  async function initialize(): Promise<void> {
    // 从数据库加载阵营、种族、职业数据到缓存
    factionsData.value = await gameDataService.getFactions();
    racesData.value = await gameDataService.getRaces();
    classesData.value = await gameDataService.getClasses();
    
    await characterService.initialize();
    currentCharacterId.value = characterService.getCurrentCharacterId();
    if (currentCharacterId.value) {
      character.value = characterService.getCharacterInfo();
    }
    await loadCharacterList();
  }

  // 事件监听
  function setupEventListeners(): void {
    eventBus.on(GameEvents.CHARACTER_CREATED, () => {
      character.value = characterService.getCharacterInfo();
      loadCharacterList();
    });

    eventBus.on(GameEvents.CHARACTER_SELECTED, () => {
      currentCharacterId.value = characterService.getCurrentCharacterId();
      character.value = characterService.getCharacterInfo();
    });

    eventBus.on(GameEvents.CHARACTER_DELETED, () => {
      loadCharacterList();
    });

    eventBus.on(GameEvents.CHARACTER_LEVEL_UP, () => {
      character.value = characterService.getCharacterInfo();
    });

    eventBus.on(GameEvents.CHARACTER_HP_CHANGE, () => {
      character.value = characterService.getCharacterInfo();
    });

    eventBus.on(GameEvents.CHARACTER_MP_CHANGE, () => {
      character.value = characterService.getCharacterInfo();
    });

    eventBus.on(GameEvents.CHARACTER_STATS_CHANGE, () => {
      character.value = characterService.getCharacterInfo();
    });

    eventBus.on(GameEvents.CHARACTER_LOGOUT, () => {
      currentCharacterId.value = null;
      character.value = null;
    });

    eventBus.on(GameEvents.CHARACTER_DEATH, () => {
      character.value = characterService.getCharacterInfo();
    });

    eventBus.on(GameEvents.CHARACTER_RESURRECTED, () => {
      character.value = characterService.getCharacterInfo();
    });
  }

  return {
    // 状态
    currentCharacterId,
    character,
    characterList,
    
    // 计算属性
    isLoggedIn,
    stats,
    attributes,
    level,
    exp,
    expToNextLevel,
    expPercentage,
    hp,
    maxHp,
    hpPercentage,
    mana,
    maxMana,
    manaPercentage,
    gold,
    name,
    factionId,
    raceId,
    classId,
    factionName,
    raceName,
    className,
    raceBonus,
    classBonus,
    
    // 方法
    loadCharacterList,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    logout,
    getCurrentCharacterId,
    addExp,
    addHp,
    addMp,
    setHp,
    setMp,
    applyBonus,
    removeBonus,
    addGold,
    spendGold,
    setName,
    initialize,
    setupEventListeners
  };
});
