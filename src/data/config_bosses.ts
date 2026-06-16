/**
 * @fileoverview Boss 怪物数据模块
 * @description 对应 config_bosses 表，包含所有 Boss 级怪物的属性、阶段和技能信息
 * @module data/bosses
 */

import type { EnemyData } from '../modules/enemy/types';

/**
 * Boss 怪物数据集（含阶段机制、AI 策略、出场演出）
 * @type {EnemyData[]}
 */
export const BOSSES: EnemyData[] = [
  {
    id: 'dragon_whelp',
    name: '幼龙',
    icon: '🐉',
    maxHp: 120,
    damage: [15, 30],
    xp: 100,
    gold: 50,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 35,
    physicalDefense: 18,
    magicAttack: 25,
    magicDefense: 15,
    critChance: 12,
    dodgeChance: 6,
    aiStrategy: 'boss_phase',
    skillPool: ['dragon_breath', 'tail_swipe'],
    phases: [
      { hpThreshold: 0.5, name: '暴怒', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }], statMultipliers: { physicalAttack: 1.3 }, transitionEffect: 'flame', dialogue: ['幼龙发出愤怒的咆哮！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'flame', lines: ['幼龙拦住了去路！', '它的双翼遮蔽了天空...'], duration: 2000 }
  },
  {
    id: 'demon',
    name: '深渊卫士',
    icon: '👿',
    maxHp: 150,
    damage: [20, 35],
    xp: 150,
    gold: 75,
    dangerLevel: '致命',
    isBoss: true,
    physicalAttack: 45,
    physicalDefense: 22,
    magicAttack: 35,
    magicDefense: 20,
    critChance: 15,
    dodgeChance: 8,
    aiStrategy: 'aggressive',
    skillPool: ['demon_fire', 'cleave'],
    phases: [
      { hpThreshold: 0.3, name: '狂暴', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 50 } }], statMultipliers: { physicalAttack: 1.5, magicAttack: 1.3 }, transitionEffect: 'flame', dialogue: ['恶魔的力量开始失控！', '它的眼中闪烁着癫狂的光...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'aggressive', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['深渊卫士撕裂了空间！', '黑暗能量在你周围涌动...'], duration: 2500 }
  },
  {
    id: 'frost_wyrm',
    name: '冰霜巨龙',
    icon: '🐲',
    maxHp: 130,
    damage: [16, 32],
    xp: 110,
    gold: 55,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 40,
    physicalDefense: 20,
    magicAttack: 32,
    magicDefense: 18,
    critChance: 14,
    dodgeChance: 5,
    aiStrategy: 'boss_phase',
    skillPool: ['frost_breath', 'blizzard', 'ice_shield'],
    phases: [
      { hpThreshold: 0.5, name: '冰霜护盾', aiStrategy: 'defensive', mechanics: [{ type: 'damage_shield', intervalTurns: 2, params: { shieldAmount: 60 } }, { type: 'aoe_attack', intervalTurns: 4 }], statMultipliers: { magicDefense: 1.5 }, transitionEffect: 'freeze', dialogue: ['冰霜巨龙展开了玄冰屏障！', '寒气刺骨...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [{ type: 'aoe_attack', intervalTurns: 5 }], dialogue: [] }
    ],
    intro: { effect: 'freeze', lines: ['冰霜巨龙从风雪中现身！', '它的吐息冻结了一切...'], duration: 2500 }
  },
  {
    id: 'undead_knight',
    name: '亡灵骑士',
    icon: '⚔️',
    maxHp: 110,
    damage: [14, 26],
    xp: 90,
    gold: 50,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 32,
    physicalDefense: 18,
    magicAttack: 20,
    magicDefense: 15,
    critChance: 12,
    dodgeChance: 6,
    aiStrategy: 'balanced',
    skillPool: ['death_grip', 'soul_drain'],
    phases: [
      { hpThreshold: 0.4, name: '亡者军团', aiStrategy: 'aggressive', mechanics: [{ type: 'summon_minions', intervalTurns: 3, params: { count: 2 } }], statMultipliers: { physicalAttack: 1.2 }, transitionEffect: 'darken', dialogue: ['亡灵骑士高举咒文剑！', '亡者从地底爬出...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['亡灵骑士缓缓拔出咒文剑...', '冰冷的死亡气息笼罩了战场'], duration: 2200 }
  },
  {
    id: 'lich',
    name: '亡灵大法师',
    icon: '💀',
    maxHp: 140,
    damage: [18, 32],
    xp: 120,
    gold: 65,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 20,
    physicalDefense: 10,
    magicAttack: 45,
    magicDefense: 28,
    critChance: 15,
    dodgeChance: 8,
    aiStrategy: 'boss_phase',
    skillPool: ['shadow_bolt', 'curse', 'soul_drain'],
    phases: [
      { hpThreshold: 0.5, name: '暗影帷幕', aiStrategy: 'defensive', mechanics: [{ type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 40 } }, { type: 'debuff_aura', intervalTurns: 4, params: { debuffType: 'attack_down' } }], statMultipliers: { magicDefense: 1.3 }, transitionEffect: 'darken', dialogue: ['亡灵大法师释放了暗影帷幕！', '你的力量被削弱了...'] },
      { hpThreshold: 0.25, name: '濒死挣扎', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 2 }], statMultipliers: { magicAttack: 1.5 }, transitionEffect: 'lightning', dialogue: ['亡灵大法师发出凄厉的嚎叫！', '暗影能量爆裂开来！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'lightning', lines: ['亡灵大法师从暗影中现身...', '你的灵魂被它的目光穿透！'], duration: 2500 }
  },
  {
    id: 'frost_giant',
    name: '冰霜巨人',
    icon: '🧊',
    maxHp: 160,
    damage: [20, 38],
    xp: 160,
    gold: 80,
    dangerLevel: '致命',
    isBoss: true,
    physicalAttack: 50,
    physicalDefense: 28,
    magicAttack: 30,
    magicDefense: 20,
    critChance: 12,
    dodgeChance: 4,
    aiStrategy: 'aggressive',
    skillPool: ['giant_stomp', 'frost_breath'],
    phases: [
      { hpThreshold: 0.4, name: '狂怒', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 3 }, { type: 'stun_player', intervalTurns: 4 }], statMultipliers: { physicalAttack: 1.4 }, transitionEffect: 'shake', dialogue: ['冰霜巨人彻底暴怒了！', '整个大地都在颤抖！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'aggressive', mechanics: [{ type: 'aoe_attack', intervalTurns: 5 }], dialogue: [] }
    ],
    intro: { effect: 'shake', lines: ['冰霜巨人踏碎了雪原！', '它的每一步都撼动大地...'], duration: 2200 }
  }
];
