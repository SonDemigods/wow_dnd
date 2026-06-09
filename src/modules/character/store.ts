/**
 * 角色模块状态管理
 * 
 * 使用 Pinia 管理角色状态，响应式更新UI。
 * Store 是角色数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Character, CharacterListItem, Stats, Attributes, FactionType, RaceType, ClassType, FactionData, RaceData, ClassData } from './types';
import { characterService } from './service';
import { eventBus, GameEvents } from '../bus/core';
import { useGameDataStore } from '../gameData/store';
import { useInventoryStore } from '../inventory/store';
import { useEquipmentStore } from '../equipment/store';
import { useSkillsStore } from '../skill/store';
import { useQuestStore } from '../quest/store';
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
    // 通过 character.value 建立响应式依赖，确保角色切换后重新计算
    // character.value 由 syncCharacterFromService() 更新，是 characterService 数据的快照
    if (!character.value) {
      return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    }
    // 从 characterService 获取含装备加成和 bonusStats 的最终属性值
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

  // 图标和颜色计算属性（避免各组件重复实现 getRaceIcon / getFactionColor 等逻辑）
  const raceIcon = computed(() => {
    return racesData.value[raceId.value]?.icon || '👤';
  });
  const factionIcon = computed(() => {
    return factionsData.value[factionId.value]?.icon || '🏳️';
  });
  const classIcon = computed(() => {
    return classesData.value[classId.value]?.icon || '⚔️';
  });
  const factionColor = computed(() => {
    return factionsData.value[factionId.value]?.color || '#9d9d9d';
  });
  const classColor = computed(() => {
    return classesData.value[classId.value]?.color || '#9d9d9d';
  });

  // ==================== 内部辅助方法 ====================

  /** 从 Service 同步最新角色数据到 Store（创建新对象以触发 Vue 响应式更新） */
  function syncCharacterFromService(): void {
    const info = characterService.getCharacterInfo();
    character.value = { ...info };
  }

  // ==================== 方法 ====================

  async function loadCharacterList(): Promise<void> {
    characterList.value = await characterService.getAllCharacters();
  }

  async function createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): Promise<string> {
    const id = await characterService.createCharacter(name, factionId, raceId, classId);
    syncCharacterFromService();
    await loadCharacterList();
    return id;
  }

  async function selectCharacter(characterId: string): Promise<boolean> {
    const success = await characterService.selectCharacter(characterId);
    if (success) {
      currentCharacterId.value = characterId;
      syncCharacterFromService();
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

  async function addExp(amount: number): Promise<void> {
    await characterService.addExp(amount);
    syncCharacterFromService();
  }

  async function addHp(amount: number): Promise<void> {
    await characterService.addHp(amount);
    syncCharacterFromService();
  }

  async function addMp(amount: number): Promise<void> {
    await characterService.addMp(amount);
    syncCharacterFromService();
  }

  async function setHp(value: number): Promise<void> {
    await characterService.setHp(value);
    syncCharacterFromService();
  }

  async function setMp(value: number): Promise<void> {
    await characterService.setMp(value);
    syncCharacterFromService();
  }

  async function applyBonus(bonus: Partial<Stats>): Promise<void> {
    await characterService.applyBonus(bonus);
    syncCharacterFromService();
  }

  async function removeBonus(bonus: Partial<Stats>): Promise<void> {
    await characterService.removeBonus(bonus);
    syncCharacterFromService();
  }

  async function addGold(amount: number): Promise<void> {
    await characterService.addGold(amount);
    syncCharacterFromService();
  }

  async function spendGold(amount: number): Promise<boolean> {
    const success = await characterService.spendGold(amount);
    if (success) {
      syncCharacterFromService();
    }
    return success;
  }

  async function setName(name: string): Promise<void> {
    await characterService.setName(name);
    syncCharacterFromService();
    await loadCharacterList();
  }

  function getCurrentCharacterId(): string | null {
    return characterService.getCurrentCharacterId();
  }

  async function initialize(): Promise<void> {
    // 从 gameDataStore 获取已加载的基础数据（避免重复查询数据库）
    const gameDataStore = useGameDataStore();
    // 等待 gameDataStore 初始化完成（由 main.ts 中的初始化顺序保证）
    factionsData.value = Object.fromEntries(
      gameDataStore.factions.map(f => [f.id, f])
    );
    racesData.value = Object.fromEntries(
      gameDataStore.races.map(r => [r.id, r])
    );
    classesData.value = Object.fromEntries(
      gameDataStore.classes.map(c => [c.id, c])
    );
    
    await characterService.initialize();
    currentCharacterId.value = characterService.getCurrentCharacterId();
    if (currentCharacterId.value) {
      syncCharacterFromService();
    }
    await loadCharacterList();
    
    // 仅设置跨模块事件监听（不监听角色模块自身发出的事件）
    setupCrossModuleListeners();

    // 注册所有子模块的跨模块事件监听器（确保角色切换时各模块数据正确切换）
    // 这些监听器需要在应用启动时就注册，而不是等到用户打开对应面板时才注册
    useInventoryStore().setupCrossModuleListeners();
    useEquipmentStore().setupCrossModuleListeners();
    useSkillsStore().setupCrossModuleListeners();
    useQuestStore().setupCrossModuleListeners();
  }

  /**
   * 跨模块事件监听
   * 
   * 仅监听来自其他模块的事件，用于同步角色数据。
   * 优先使用 payload 中的增量数据进行局部更新，避免全量 reload。
   * 角色模块自身发出的状态变更由 Store Action 直接处理，不再通过事件总线回环。
   */
  function setupCrossModuleListeners(): void {
    // 战斗结束后刷新角色数据（经验值、金币等变化由战斗模块触发，涉及复合变更需要全量同步）
    eventBus.onGroup('characterStore', GameEvents.COMBAT_END, () => {
      syncCharacterFromService();
    });

    // HP 实时变化时增量更新（战斗中受伤治疗、探索陷阱/事件等）
    eventBus.onGroup('characterStore', GameEvents.CHARACTER_HP_CHANGE, (payload: { oldHp: number; newHp: number; maxHp: number }) => {
      if (character.value) {
        character.value = {
          ...character.value,
          hp: payload.newHp,
          maxHp: payload.maxHp
        };
      }
    });

    // MP 实时变化时增量更新
    eventBus.onGroup('characterStore', GameEvents.CHARACTER_MP_CHANGE, (payload: { oldMp: number; newMp: number; maxMp: number }) => {
      if (character.value) {
        character.value = {
          ...character.value,
          mana: payload.newMp,
          maxMana: payload.maxMp
        };
      }
    });

    // 属性变化时增量更新（使用属性药剂、装备加成等）
    eventBus.onGroup('characterStore', GameEvents.CHARACTER_STATS_CHANGE, (payload: { oldStats: Record<string, number>; newStats: Record<string, number> }) => {
      if (character.value) {
        character.value = {
          ...character.value,
          stats: { ...character.value.stats, ...payload.newStats }
        };
      }
    });

    // 商店交易后同步金币（涉及 gold + 可能的装备变化，需全量同步）
    eventBus.onGroup('characterStore', GameEvents.SHOP_TRANSACTION, () => {
      syncCharacterFromService();
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('characterStore');
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
    raceIcon,
    factionIcon,
    classIcon,
    factionColor,
    classColor,
    
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
    setupCrossModuleListeners,
    dispose
  };
});
