import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { getExpForLevel, calculateAllAttributes, RACES, CLASSES, MAX_LEVEL } from '@/data';
import type { Stats, Attributes, RaceData, ClassData } from '@/types';

export type FactionType = 'alliance' | 'horde' | 'neutral';

export type RaceType = 
  | 'human' | 'dwarf' | 'gnome' | 'nightelf' | 'draenei' | 'worgen'
  | 'voidelf' | 'lightforgeddraenei' | 'darkirondwarf' | 'kul_tiran' | 'mechagnome'
  | 'pandaren' | 'orc' | 'undead' | 'tauren' | 'troll' | 'bloodelves' | 'goblin'
  | 'nightborne' | 'highmountaintauren' | 'magharorc' | 'zandalari' | 'vulpera'
  | 'dracthyr' | 'earthen' | 'harenei';

export type ClassType = 
  | 'warrior' | 'mage' | 'paladin' | 'hunter' | 'rogue' | 'warlock'
  | 'druid' | 'priest' | 'shaman' | 'deathknight' | 'monk' | 'demonhunter' | 'evoker';

export interface CharacterInfo {
  name: string;
  race: RaceType | null;
  class: ClassType | null;
  faction: FactionType | null;
  level?: number;
  currentHp?: number;
  currentMp?: number;
}

export interface CharacterListItem {
  id: string;
  name: string;
  raceId: RaceType;
  classId: ClassType;
  factionId: FactionType;
  level: number;
  createdTime: number;
  lastPlayedTime: number;
}

export interface CharacterStatsChangeEvent {
  oldStats: Stats;
  newStats: Stats;
}

export interface CharacterHpChangeEvent {
  oldHp: number;
  newHp: number;
  maxHp: number;
}

export interface CharacterMpChangeEvent {
  oldMp: number;
  newMp: number;
  maxMp: number;
}

export interface CharacterLevelUpEvent {
  oldLevel: number;
  newLevel: number;
}

export interface CharacterCreatedEvent {
  characterId: string;
  name: string;
}

export interface CharacterSelectedEvent {
  characterId: string;
}

export interface CharacterDeletedEvent {
  characterId: string;
}

export interface RaceBonus {
  raceId: RaceType;
  factionId: FactionType;
  bonus: Partial<Stats>;
}

export interface ClassBonus {
  classId: ClassType;
  bonus: Partial<Stats>;
}

export interface ICharacterService {
  createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): string;
  selectCharacter(characterId: string): boolean;
  deleteCharacter(characterId: string): boolean;
  getAllCharacters(): CharacterListItem[];
  getCurrentCharacterId(): string | null;
  logout(): void;
  
  getStats(): Stats;
  getAttributes(): Attributes;
  getLevel(): number;
  getExp(): number;
  getExpToNextLevel(): number;
  getName(): string;
  getFaction(): FactionType;
  getRace(): RaceType;
  getClass(): ClassType;
  getGold(): number;
  getCharacterInfo(): CharacterInfo;
  
  addExp(amount: number): void;
  addHp(amount: number): void;
  addMp(amount: number): void;
  setHp(value: number): void;
  setMp(value: number): void;
  applyBonus(bonus: Partial<Stats>): void;
  removeBonus(bonus: Partial<Stats>): void;
  addGold(amount: number): void;
  spendGold(amount: number): boolean;
  
  setName(name: string): void;
  setFactionId(factionId: FactionType): void;
  setRace(race: RaceType): void;
  setClass(classId: ClassType): void;
  
  reset(): void;
  
  handleDeath(): void;
  resurrect(): void;
}

const MAX_CHARACTERS = 10;

export const useCharacterStore = defineStore('character', () => {
  const characters = ref<CharacterListItem[]>([]);
  const currentCharacterId = ref<string | null>(null);
  
  const name = ref('冒险者');
  const faction = ref<FactionType | null>(null);
  const race = ref<RaceType | null>(null);
  const charClass = ref<ClassType | null>(null);
  const gold = ref(50);
  const level = ref(1);
  const exp = ref(0);
  const baseStats = ref<Stats>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const currentHp = ref(100);
  const maxHp = ref(100);
  const currentMp = ref(50);
  const maxMp = ref(50);
  const bonusStats = ref<Partial<Stats>>({});

  const stats = computed((): Stats => {
    const result: Stats = { ...baseStats.value };
    for (const key of Object.keys(bonusStats.value) as Array<keyof Stats>) {
      if (bonusStats.value[key]) {
        result[key] += bonusStats.value[key]!;
      }
    }
    return result;
  });

  const attributes = computed((): Attributes => {
    return calculateAllAttributes(stats.value);
  });

  const expToNextLevel = computed((): number => {
    return getExpForLevel(level.value + 1);
  });

  function generateId(): string {
    return 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async function loadFromStorage() {
    try {
      const charsData = localStorage.getItem('wow_characters');
      if (charsData) {
        characters.value = JSON.parse(charsData);
      }
    } catch (e) {
      console.error('Failed to load characters:', e);
    }

    try {
      const currentId = localStorage.getItem('wow_current_character');
      if (currentId) {
        currentCharacterId.value = currentId;
      }
    } catch (e) {
      console.error('Failed to load current character:', e);
    }

    if (currentCharacterId.value) {
      await loadCharacterData(currentCharacterId.value);
    }
  }

  async function loadCharacterData(charId: string) {
    try {
      const data = localStorage.getItem(`wow_character_${charId}`);
      if (data) {
        const saved = JSON.parse(data);
        name.value = saved.name ?? '冒险者';
        faction.value = saved.faction ?? null;
        race.value = saved.race ?? null;
        charClass.value = saved.charClass ?? null;
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
      console.error('Failed to load character data:', e);
    }
  }

  async function saveToStorage() {
    try {
      localStorage.setItem('wow_characters', JSON.stringify(characters.value));
    } catch (e) {
      console.error('Failed to save characters:', e);
    }

    if (currentCharacterId.value) {
      try {
        const data = {
          name: name.value,
          faction: faction.value,
          race: race.value,
          charClass: charClass.value,
          level: level.value,
          exp: exp.value,
          gold: gold.value,
          baseStats: baseStats.value,
          currentHp: currentHp.value,
          maxHp: maxHp.value,
          currentMp: currentMp.value,
          maxMp: maxMp.value,
          bonusStats: bonusStats.value
        };
        localStorage.setItem(`wow_character_${currentCharacterId.value}`, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to save character data:', e);
      }
    }

    try {
      localStorage.setItem('wow_current_character', currentCharacterId.value ?? '');
    } catch (e) {
      console.error('Failed to save current character:', e);
    }
  }

  function createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): string {
    if (characters.value.length >= MAX_CHARACTERS) {
      throw new Error('已达到最大角色数量限制');
    }

    const id = generateId();
    const newCharacter: CharacterListItem = {
      id,
      name,
      raceId,
      classId,
      factionId,
      level: 1,
      createdTime: Date.now(),
      lastPlayedTime: Date.now()
    };

    characters.value.push(newCharacter);
    
    const base: Stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const raceData: RaceData = RACES[raceId];
    const classData: ClassData = CLASSES[classId];
    const raceBonus = raceData?.bonus || {};
    const classBonus = classData?.bonus || {};

    for (const key of Object.keys(base) as Array<keyof Stats>) {
      base[key] += (raceBonus[key] || 0);
      if (classBonus[key] !== undefined) {
        base[key] += classBonus[key] || 0;
      }
    }

    const attrs = calculateAllAttributes(base);
    
    try {
      const data = {
        name,
        faction: factionId,
        race: raceId,
        charClass: classId,
        level: 1,
        exp: 0,
        gold: 50,
        baseStats: base,
        currentHp: attrs.maxHp,
        maxHp: attrs.maxHp,
        currentMp: attrs.maxMana,
        maxMp: attrs.maxMana,
        bonusStats: {}
      };
      localStorage.setItem(`wow_character_${id}`, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save new character:', e);
    }

    eventBus.emit(GameEvents.CHARACTER_CREATED, { characterId: id, name });
    saveToStorage();
    
    return id;
  }

  function selectCharacter(characterId: string): boolean {
    const char = characters.value.find(c => c.id === characterId);
    if (!char) return false;

    currentCharacterId.value = characterId;
    char.lastPlayedTime = Date.now();
    loadCharacterData(characterId);
    saveToStorage();

    eventBus.emit(GameEvents.CHARACTER_SELECTED, { characterId });
    return true;
  }

  function deleteCharacter(characterId: string): boolean {
    const index = characters.value.findIndex(c => c.id === characterId);
    if (index === -1) return false;

    characters.value.splice(index, 1);
    
    try {
      localStorage.removeItem(`wow_character_${characterId}`);
    } catch (e) {
      console.error('Failed to delete character data:', e);
    }

    if (currentCharacterId.value === characterId) {
      currentCharacterId.value = null;
      name.value = '冒险者';
      faction.value = null;
      race.value = null;
      charClass.value = null;
      level.value = 1;
      exp.value = 0;
      gold.value = 50;
      baseStats.value = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      currentHp.value = 100;
      maxHp.value = 100;
      currentMp.value = 50;
      maxMp.value = 50;
      bonusStats.value = {};
    }

    eventBus.emit(GameEvents.CHARACTER_DELETED, { characterId });
    saveToStorage();
    return true;
  }

  function getAllCharacters(): CharacterListItem[] {
    return characters.value;
  }

  function getCurrentCharacterId(): string | null {
    return currentCharacterId.value;
  }

  function logout(): void {
    currentCharacterId.value = null;
    saveToStorage();
    eventBus.emit(GameEvents.CHARACTER_LOGOUT);
  }

  const getCharacterInfo = (): CharacterInfo => {
    return {
      name: name.value,
      race: race.value,
      class: charClass.value,
      faction: faction.value,
      level: level.value,
      currentHp: currentHp.value,
      currentMp: currentMp.value
    };
  };

  const setName = (newName: string) => {
    name.value = newName;
    saveToStorage();
  };

  const setFaction = (newFaction: FactionType) => {
    faction.value = newFaction;
    race.value = null;
    charClass.value = null;
    saveToStorage();
  };

  const setRace = (newRace: RaceType) => {
    race.value = newRace;
    saveToStorage();
  };

  const setClass = (newClass: ClassType) => {
    charClass.value = newClass;
    saveToStorage();
  };

  const addGold = (amount: number) => {
    gold.value += amount;
    saveToStorage();
  };

  const spendGold = (amount: number): boolean => {
    if (gold.value >= amount) {
      gold.value -= amount;
      saveToStorage();
      return true;
    }
    return false;
  };

  const checkLevelUp = () => {
    if (level.value >= MAX_LEVEL) return;

    const required = expToNextLevel.value;
    if (exp.value >= required) {
      const oldLevel = level.value;
      level.value++;
      exp.value -= required;

      baseStats.value.str += 1;
      baseStats.value.con += 1;
      maxHp.value += attributes.value.hpBonus;
      maxMp.value += attributes.value.mpBonus;
      
      currentHp.value = maxHp.value;
      currentMp.value = maxMp.value;

      const event: CharacterLevelUpEvent = { oldLevel, newLevel: level.value };
      eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, event);

      checkLevelUp();
    }
  };

  const addExp = (amount: number) => {
    if (amount <= 0 || level.value >= MAX_LEVEL) return;
    exp.value += amount;
    checkLevelUp();
    saveToStorage();
  };

  const addHp = (amount: number) => {
    const oldHp = currentHp.value;
    currentHp.value = Math.min(Math.max(0, currentHp.value + amount), maxHp.value);

    const event: CharacterHpChangeEvent = {
      oldHp,
      newHp: currentHp.value,
      maxHp: maxHp.value
    };
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, event);
    saveToStorage();
  };

  const addMp = (amount: number) => {
    const oldMp = currentMp.value;
    currentMp.value = Math.min(Math.max(0, currentMp.value + amount), maxMp.value);

    const event: CharacterMpChangeEvent = {
      oldMp,
      newMp: currentMp.value,
      maxMp: maxMp.value
    };
    eventBus.emit(GameEvents.CHARACTER_MP_CHANGE, event);
    saveToStorage();
  };

  const setHp = (value: number) => {
    const oldHp = currentHp.value;
    currentHp.value = Math.min(Math.max(0, value), maxHp.value);

    const event: CharacterHpChangeEvent = {
      oldHp,
      newHp: currentHp.value,
      maxHp: maxHp.value
    };
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, event);
    saveToStorage();
  };

  const setMp = (value: number) => {
    const oldMp = currentMp.value;
    currentMp.value = Math.min(Math.max(0, value), maxMp.value);

    const event: CharacterMpChangeEvent = {
      oldMp,
      newMp: currentMp.value,
      maxMp: maxMp.value
    };
    eventBus.emit(GameEvents.CHARACTER_MP_CHANGE, event);
    saveToStorage();
  };

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

  const handleDeath = () => {
    exp.value = 0;
    
    const event = { cause: 'combat' };
    eventBus.emit(GameEvents.CHARACTER_DEATH, event);
    
    resurrect();
  };

  const resurrect = () => {
    currentHp.value = Math.floor(maxHp.value * 0.5);
    currentMp.value = Math.floor(maxMp.value * 0.5);
    
    const event = { newHp: currentHp.value, newMp: currentMp.value };
    eventBus.emit(GameEvents.CHARACTER_RESURRECTED, event);
    saveToStorage();
  };

  const reset = () => {
    name.value = '冒险者';
    faction.value = null;
    race.value = null;
    charClass.value = null;
    gold.value = 50;
    level.value = 1;
    exp.value = 0;
    baseStats.value = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    maxHp.value = 100;
    maxMp.value = 50;
    currentHp.value = maxHp.value;
    currentMp.value = maxMp.value;
    bonusStats.value = {};
    characters.value = [];
    currentCharacterId.value = null;
    
    try {
      localStorage.removeItem('wow_characters');
      localStorage.removeItem('wow_current_character');
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
  };

  loadFromStorage();

  return {
    characters,
    currentCharacterId,
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
    createCharacter,
    selectCharacter,
    deleteCharacter,
    getAllCharacters,
    getCurrentCharacterId,
    logout,
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
    handleDeath,
    resurrect,
    reset
  };
});

export const characterService: ICharacterService = {
  createCharacter: (name: string, factionId: FactionType, raceId: RaceType, classId: ClassType) => 
    useCharacterStore().createCharacter(name, factionId, raceId, classId),
  selectCharacter: (characterId: string) => useCharacterStore().selectCharacter(characterId),
  deleteCharacter: (characterId: string) => useCharacterStore().deleteCharacter(characterId),
  getAllCharacters: () => useCharacterStore().getAllCharacters(),
  getCurrentCharacterId: () => useCharacterStore().getCurrentCharacterId(),
  logout: () => useCharacterStore().logout(),
  getStats: () => useCharacterStore().stats,
  getAttributes: () => useCharacterStore().attributes,
  getLevel: () => useCharacterStore().level,
  getExp: () => useCharacterStore().exp,
  getExpToNextLevel: () => useCharacterStore().expToNextLevel,
  getName: () => useCharacterStore().name,
  getFaction: () => useCharacterStore().faction!,
  getRace: () => useCharacterStore().race!,
  getClass: () => useCharacterStore().charClass!,
  getGold: () => useCharacterStore().gold,
  getCharacterInfo: () => useCharacterStore().getCharacterInfo(),
  addExp: (amount: number) => useCharacterStore().addExp(amount),
  addHp: (amount: number) => useCharacterStore().addHp(amount),
  addMp: (amount: number) => useCharacterStore().addMp(amount),
  setHp: (value: number) => useCharacterStore().setHp(value),
  setMp: (value: number) => useCharacterStore().setMp(value),
  applyBonus: (bonus: Partial<Stats>) => useCharacterStore().applyBonus(bonus),
  removeBonus: (bonus: Partial<Stats>) => useCharacterStore().removeBonus(bonus),
  addGold: (amount: number) => useCharacterStore().addGold(amount),
  spendGold: (amount: number) => useCharacterStore().spendGold(amount),
  setName: (name: string) => useCharacterStore().setName(name),
  setFactionId: (factionId: FactionType) => useCharacterStore().setFaction(factionId),
  setRace: (race: RaceType) => useCharacterStore().setRace(race),
  setClass: (classId: ClassType) => useCharacterStore().setClass(classId),
  reset: () => useCharacterStore().reset(),
  handleDeath: () => useCharacterStore().handleDeath(),
  resurrect: () => useCharacterStore().resurrect()
};
