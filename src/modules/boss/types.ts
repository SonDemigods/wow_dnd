/**
 * @fileoverview Boss 模块类型定义
 * @description Boss 专属的数据结构，包括模板、阶段、机制、台词等
 */

import type { EnemyData, EnemyInstance, AiStrategyType } from '../enemy/types';

/**
 * Boss 存储格式（IndexedDB config_bosses 表）
 */
export interface BossStorage {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: string;
  isBoss?: number;
  physicalAttack?: number | null;
  physicalDefense?: number | null;
  magicAttack?: number | null;
  magicDefense?: number | null;
  critChance?: number | null;
  dodgeChance?: number | null;
  /** JSON 序列化的技能池 */
  skillPool?: string;
  /** AI 策略类型 */
  aiStrategy?: string;
  /** JSON 序列化的阶段配置 */
  phases?: string;
  /** JSON 序列化的出场演出 */
  intro?: string;
  /** JSON 序列化的台词 */
  dialogues?: string;
}

/**
 * Boss 模板（继承 EnemyData，后续阶段扩展阶段/机制/台词等）
 */
export interface BossTemplate extends EnemyData {
  isBoss: true;
}

/**
 * Boss 实例（继承 EnemyInstance，后续阶段扩展阶段管理器/机制执行器等）
 */
export interface BossInstance extends EnemyInstance {
  isBoss: true;
  /** Boss 阶段管理器（由 createBossInstance 注入） */
  phaseManager?: any;
}

/** Boss 出场特效类型 */
export type BossIntroEffect = 'darken' | 'shake' | 'flame' | 'freeze' | 'lightning';

/** Boss 出场配置 */
export interface BossIntro {
  effect: BossIntroEffect;
  /** 出场台词 */
  lines: string[];
  /** 动画持续 ms */
  duration: number;
}

/** Boss 机制类型 */
export type BossMechanicType =
  | 'summon_minions' | 'summon_elite'
  | 'damage_shield' | 'invulnerable' | 'reflect_damage'
  | 'enrage' | 'aoe_attack' | 'charge_attack'
  | 'stun_player' | 'silence_player' | 'debuff_aura'
  | 'arena_hazard' | 'healing_zone'
  | 'split' | 'revive' | 'steal_buff' | 'counter_stance';

/** Boss 机制配置 */
export interface BossMechanic {
  type: BossMechanicType;
  /** 触发间隔（回合数） */
  intervalTurns: number;
  /** 上次触发回合 */
  lastTriggerTurn?: number;
  /** 机制参数 */
  params?: Record<string, number>;
}

/** Boss 阶段 */
export interface BossPhase {
  /** 触发该阶段的 HP 百分比阈值 */
  hpThreshold: number;
  /** 阶段名称 */
  name: string;
  /** 阶段切换台词 */
  dialogue: string[];
  /** 阶段切换特效 */
  transitionEffect?: BossIntroEffect;
  /** 该阶段的 AI 策略 */
  aiStrategy: AiStrategyType;
  /** 该阶段的机制列表 */
  mechanics: BossMechanic[];
  /** 属性调整（乘数） */
  statMultipliers?: {
    physicalAttack?: number;
    magicAttack?: number;
    physicalDefense?: number;
    magicDefense?: number;
  };
}

/** Boss 台词 */
export interface BossDialogue {
  turn: number;
  message: string;
}

/** Boss 完整模板 */
export interface BossFullTemplate extends BossTemplate {
  intro: BossIntro;
  phases: BossPhase[];
  dialogues?: BossDialogue[];
}
