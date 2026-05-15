/**
 * @fileoverview 角色模块类型定义
 * @description 角色属性、属性变化事件等类型定义
 * @module modules/character/types
 */

import type { Stats, Attributes } from '@/types';

/**
 * 角色种族
 */
export type CharacterRace = 'human' | 'orc' | 'dwarf' | 'troll' | 'night_elf' | 'undead' | 'gnome' | 'blood_elf';

/**
 * 角色职业
 */
export type CharacterClass = 'warrior' | 'mage' | 'priest' | 'rogue' | 'hunter' | 'shaman' | 'paladin' | 'warlock';

/**
 * 角色阵营
 */
export type CharacterFaction = 'alliance' | 'horde';

/**
 * 角色信息
 */
export interface CharacterInfo {
  name: string;
  race: CharacterRace | null;
  class: CharacterClass | null;
  faction: CharacterFaction | null;
}

/**
 * 属性变化事件
 */
export interface CharacterStatsChangeEvent {
  oldStats: Stats;
  newStats: Stats;
}

/**
 * 生命值变化事件
 */
export interface CharacterHpChangeEvent {
  oldHp: number;
  newHp: number;
  maxHp: number;
}

/**
 * 魔法值变化事件
 */
export interface CharacterMpChangeEvent {
  oldMp: number;
  newMp: number;
  maxMp: number;
}

/**
 * 升级事件
 */
export interface CharacterLevelUpEvent {
  oldLevel: number;
  newLevel: number;
}

/**
 * 角色服务接口
 */
export interface ICharacterService {
  getStats: () => Stats;
  getAttributes: () => Attributes;
  getLevel: () => number;
  getExp: () => number;
  getExpToNextLevel: () => number;
  addExp: (amount: number) => void;
  addHp: (amount: number) => void;
  addMp: (amount: number) => void;
  setHp: (value: number) => void;
  setMp: (value: number) => void;
  applyBonus: (bonus: Partial<Stats>) => void;
  removeBonus: (bonus: Partial<Stats>) => void;
  reset: () => void;
  getName: () => string;
  getFaction: () => 'alliance' | 'horde' | null;
  getRace: () => string | null;
  getClass: () => string | null;
  getGold: () => number;
  getCharacterInfo: () => CharacterInfo;
  setName: (name: string) => void;
  setFaction: (faction: 'alliance' | 'horde') => void;
  setRace: (race: string) => void;
  setClass: (charClass: string) => void;
  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
}