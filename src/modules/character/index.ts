/**
 * @fileoverview 角色服务类
 * @description 提供角色属性管理、成长系统、状态计算等核心功能
 * @module modules/character/CharacterService
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { getExpForLevel, calculateAllAttributes } from '@/data';
import type { Stats, Attributes } from '@/types';
import type {
  CharacterStatsChangeEvent,
  CharacterHpChangeEvent,
  CharacterMpChangeEvent,
  CharacterLevelUpEvent,
  CharacterInfo,
  ICharacterService
} from './types';

/**
 * 本地存储键名
 */
const CHARACTER_STORAGE_KEY = 'wow_character';
const CHARACTER_INFO_STORAGE_KEY = 'wow_character_info';

/**
 * 角色状态管理Store
 */
export const useCharacterStore = defineStore('character', () => {
  /** 角色名称 */
  const name = ref('冒险者');
  /** 角色阵营 */
  const faction = ref<'alliance' | 'horde' | null>(null);
  /** 角色种族 */
  const race = ref<string | null>(null);
  /** 角色职业 */
  const charClass = ref<string | null>(null);
  /** 角色金币 */
  const gold = ref(50);
  /** 角色当前等级 */
  const level = ref(1);
  /** 角色当前经验值 */
  const exp = ref(0);
  /** 角色基础属性 */
  const baseStats = ref<Stats>({
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  });
  /** 角色当前生命值 */
  const currentHp = ref(100);
  /** 角色最大生命值 */
  const maxHp = ref(100);
  /** 角色当前魔法值 */
  const currentMp = ref(50);
  /** 角色最大魔法值 */
  const maxMp = ref(50);
  /** 临时属性加成（来自装备、BUFF等） */
  const bonusStats = ref<Partial<Stats>>({});

  /**
   * 从本地存储加载角色数据
   */
  function loadFromStorage() {
    try {
      const data = localStorage.getItem(CHARACTER_STORAGE_KEY);
      if (data) {
        const saved = JSON.parse(data);
        level.value = saved.level ?? 1;
        exp.value = saved.exp ?? 0;
        gold.value = saved.gold ?? 50;
        baseStats.value = saved.baseStats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        currentHp.value = saved.currentHp ?? 100;
        maxHp.value = saved.maxHp ?? 100;
        currentMp.value = saved.currentMp ?? 50;
        maxMp.value = saved.maxMp ?? 50;
        bonusStats.value = saved.bonusStats ?? {};
      }
    } catch (e) {
      console.error('Failed to load character:', e);
    }

    try {
      const infoData = localStorage.getItem(CHARACTER_INFO_STORAGE_KEY);
      if (infoData) {
        const saved = JSON.parse(infoData);
        name.value = saved.name ?? '冒险者';
        faction.value = saved.faction ?? null;
        race.value = saved.race ?? null;
        charClass.value = saved.charClass ?? null;
      }
    } catch (e) {
      console.error('Failed to load character info:', e);
    }
  }

  /**
   * 保存角色数据到本地存储
   */
  function saveToStorage() {
    try {
      const data = {
        level: level.value,
        exp: exp.value,
        gold: gold.value,
        baseStats: baseStats.value,
        currentHp: currentHp.value,
        maxHp: maxHp.value,
        currentMp: currentMp.value,
        maxMp: maxMp.value,
        bonusStats: bonusStats.value,
      };
      localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save character:', e);
    }

    try {
      const infoData = {
        name: name.value,
        faction: faction.value,
        race: race.value,
        charClass: charClass.value,
      };
      localStorage.setItem(CHARACTER_INFO_STORAGE_KEY, JSON.stringify(infoData));
    } catch (e) {
      console.error('Failed to save character info:', e);
    }
  }

  /**
   * 清除角色本地存储
   */
  function clearStorage() {
    localStorage.removeItem(CHARACTER_STORAGE_KEY);
    localStorage.removeItem(CHARACTER_INFO_STORAGE_KEY);
  }

  /**
   * 获取角色信息
   */
  const getCharacterInfo = (): CharacterInfo => {
    return {
      name: name.value,
      race: race.value as CharacterInfo['race'],
      class: charClass.value as CharacterInfo['class'],
      faction: faction.value,
    };
  };

  /**
   * 设置角色名称
   */
  const setName = (newName: string) => {
    name.value = newName;
    saveToStorage();
  };

  /**
   * 设置角色阵营
   */
  const setFaction = (newFaction: 'alliance' | 'horde') => {
    faction.value = newFaction;
    race.value = null;
    charClass.value = null;
    saveToStorage();
  };

  /**
   * 设置角色种族
   */
  const setRace = (newRace: string) => {
    race.value = newRace;
    saveToStorage();
  };

  /**
   * 设置角色职业
   */
  const setClass = (newClass: string) => {
    charClass.value = newClass;
    saveToStorage();
  };

  /**
   * 添加金币
   */
  const addGold = (amount: number) => {
    gold.value += amount;
    saveToStorage();
  };

  /**
   * 花费金币
   */
  const spendGold = (amount: number): boolean => {
    if (gold.value >= amount) {
      gold.value -= amount;
      saveToStorage();
      return true;
    }
    return false;
  };

  /**
   * 计算综合属性（基础+加成）
   */
  const stats = computed((): Stats => {
    const result: Stats = { ...baseStats.value };
    for (const key of Object.keys(bonusStats.value) as Array<keyof Stats>) {
      if (bonusStats.value[key]) {
        result[key] += bonusStats.value[key]!;
      }
    }
    return result;
  });

  /**
   * 计算属性修正值
   */
  const attributes = computed((): Attributes => {
    return calculateAllAttributes(stats.value);
  });

  /**
   * 升级所需经验
   */
  const expToNextLevel = computed((): number => {
    return getExpForLevel(level.value + 1);
  });

  /**
   * 检查是否满足升级条件
   */
  const checkLevelUp = () => {
    const required = expToNextLevel.value;
    if (exp.value >= required) {
      const oldLevel = level.value;
      level.value++;
      exp.value -= required;

      // 升级时提升属性
      baseStats.value.str += 1;
      baseStats.value.con += 1;
      maxHp.value += attributes.value.hpBonus;
      maxMp.value += attributes.value.mpBonus;
      
      // 恢复生命和魔法
      currentHp.value = maxHp.value;
      currentMp.value = maxMp.value;

      const event: CharacterLevelUpEvent = { oldLevel, newLevel: level.value };
      eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, event);
    }
  };

  /**
   * 添加经验值
   */
  const addExp = (amount: number) => {
    if (amount <= 0) return;
    exp.value += amount;
    checkLevelUp();
    saveToStorage();
  };

  /**
   * 添加生命值
   */
  const addHp = (amount: number) => {
    const oldHp = currentHp.value;
    currentHp.value = Math.min(Math.max(0, currentHp.value + amount), maxHp.value);

    const event: CharacterHpChangeEvent = {
      oldHp,
      newHp: currentHp.value,
      maxHp: maxHp.value,
    };
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, event);
    saveToStorage();
  };

  /**
   * 添加魔法值
   */
  const addMp = (amount: number) => {
    const oldMp = currentMp.value;
    currentMp.value = Math.min(Math.max(0, currentMp.value + amount), maxMp.value);

    const event: CharacterMpChangeEvent = {
      oldMp,
      newMp: currentMp.value,
      maxMp: maxMp.value,
    };
    eventBus.emit(GameEvents.CHARACTER_MP_CHANGE, event);
    saveToStorage();
  };

  /**
   * 设置生命值
   */
  const setHp = (value: number) => {
    const oldHp = currentHp.value;
    currentHp.value = Math.min(Math.max(0, value), maxHp.value);

    const event: CharacterHpChangeEvent = {
      oldHp,
      newHp: currentHp.value,
      maxHp: maxHp.value,
    };
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, event);
    saveToStorage();
  };

  /**
   * 设置魔法值
   */
  const setMp = (value: number) => {
    const oldMp = currentMp.value;
    currentMp.value = Math.min(Math.max(0, value), maxMp.value);

    const event: CharacterMpChangeEvent = {
      oldMp,
      newMp: currentMp.value,
      maxMp: maxMp.value,
    };
    eventBus.emit(GameEvents.CHARACTER_MP_CHANGE, event);
    saveToStorage();
  };

  /**
   * 应用属性加成
   */
  const applyBonus = (bonus: Partial<Stats>) => {
    const oldStats = { ...stats.value };

    for (const key of Object.keys(bonus) as Array<keyof Stats>) {
      if (bonus[key]) {
        bonusStats.value[key] = (bonusStats.value[key] || 0) + bonus[key]!;
      }
    }

    const event: CharacterStatsChangeEvent = { oldStats, newStats: stats.value };
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, event);
    saveToStorage();
  };

  /**
   * 移除属性加成
   */
  const removeBonus = (bonus: Partial<Stats>) => {
    const oldStats = { ...stats.value };

    for (const key of Object.keys(bonus) as Array<keyof Stats>) {
      if (bonus[key] && bonusStats.value[key]) {
        bonusStats.value[key]! -= bonus[key]!;
        if (bonusStats.value[key]! <= 0) {
          delete bonusStats.value[key];
        }
      }
    }

    const event: CharacterStatsChangeEvent = { oldStats, newStats: stats.value };
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, event);
    saveToStorage();
  };

  /**
   * 重置角色状态（用于开始新游戏）
   */
  const reset = () => {
    name.value = '冒险者';
    faction.value = null;
    race.value = null;
    charClass.value = null;
    gold.value = 50;
    level.value = 1;
    exp.value = 0;
    baseStats.value = {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    };
    maxHp.value = 100;
    maxMp.value = 50;
    currentHp.value = maxHp.value;
    currentMp.value = maxMp.value;
    bonusStats.value = {};
    clearStorage();
  };

  // 初始化时加载数据
  loadFromStorage();

  return {
    // 状态
    name,
    faction,
    race,
    charClass,
    gold,
    level,
    exp,
    currentHp,
    maxHp,
    currentMp,
    maxMp,
    stats,
    attributes,
    expToNextLevel,
    // 方法
    getCharacterInfo,
    setName,
    setFaction,
    setRace,
    setClass,
    addGold,
    spendGold,
    addExp,
    addHp,
    addMp,
    setHp,
    setMp,
    applyBonus,
    removeBonus,
    reset,
  };
});

/**
 * 角色服务实现
 */
export const characterService: ICharacterService = {
  getStats: () => useCharacterStore().stats,
  getAttributes: () => useCharacterStore().attributes,
  getLevel: () => useCharacterStore().level,
  getExp: () => useCharacterStore().exp,
  getExpToNextLevel: () => useCharacterStore().expToNextLevel,
  addExp: (amount: number) => useCharacterStore().addExp(amount),
  addHp: (amount: number) => useCharacterStore().addHp(amount),
  addMp: (amount: number) => useCharacterStore().addMp(amount),
  setHp: (value: number) => useCharacterStore().setHp(value),
  setMp: (value: number) => useCharacterStore().setMp(value),
  applyBonus: (bonus: Partial<Stats>) => useCharacterStore().applyBonus(bonus),
  removeBonus: (bonus: Partial<Stats>) => useCharacterStore().removeBonus(bonus),
  reset: () => useCharacterStore().reset(),
  getName: () => useCharacterStore().name,
  getFaction: () => useCharacterStore().faction,
  getRace: () => useCharacterStore().race,
  getClass: () => useCharacterStore().charClass,
  getGold: () => useCharacterStore().gold,
  getCharacterInfo: () => useCharacterStore().getCharacterInfo(),
  setName: (name: string) => useCharacterStore().setName(name),
  setFaction: (faction: 'alliance' | 'horde') => useCharacterStore().setFaction(faction),
  setRace: (race: string) => useCharacterStore().setRace(race),
  setClass: (charClass: string) => useCharacterStore().setClass(charClass),
  addGold: (amount: number) => useCharacterStore().addGold(amount),
  spendGold: (amount: number) => useCharacterStore().spendGold(amount),
};
