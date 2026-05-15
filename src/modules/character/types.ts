/**
 * @fileoverview 角色模块类型定义
 * @description 角色相关的类型和接口定义
 * @module modules/character/types
 */

import type { Stats, Attributes } from '@/types';

/** 角色属性变化事件 */
export interface CharacterStatsChangeEvent {
  oldStats: Stats;
  newStats: Stats;
}

/** 角色生命值变化事件 */
export interface CharacterHpChangeEvent {
  oldHp: number;
  newHp: number;
  maxHp: number;
}

/** 角色魔法值变化事件 */
export interface CharacterMpChangeEvent {
  oldMp: number;
  newMp: number;
  maxMp: number;
}

/** 角色升级事件 */
export interface CharacterLevelUpEvent {
  oldLevel: number;
  newLevel: number;
}

/** 角色服务接口 */
export interface ICharacterService {
  getStats(): Stats;
  getAttributes(): Attributes;
  getLevel(): number;
  getExp(): number;
  getExpToNextLevel(): number;
  addExp(amount: number): void;
  addHp(amount: number): void;
  addMp(amount: number): void;
  setHp(value: number): void;
  setMp(value: number): void;
  applyBonus(bonus: Partial<Stats>): void;
  removeBonus(bonus: Partial<Stats>): void;
  reset(): void;
}
