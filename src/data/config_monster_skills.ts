/**
 * @fileoverview 怪物/首领技能数据模块
 * @description 定义所有怪物和首领使用的技能，独立于玩家职业技能
 * @module data/monster_skills
 */

import type { Skill } from '../modules/skill/types';

/**
 * 怪物/首领技能数据集
 * 这些技能仅供敌人 AI 使用，不会被玩家学习
 */
export const MONSTER_SKILLS: Skill[] = [
  // ========== 幼龙 ==========
  {
    id: 'dragon_breath',
    name: '龙息',
    icon: '🔥',
    description: '喷吐灼热的龙息，熔化前方的一切',
    mpCost: 0,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 25, coefficient: 1.2 },
    unlockLevel: 1,
    cooldown: 3,
    targetType: 'all_enemies'
  },
  {
    id: 'tail_swipe',
    name: '尾击',
    icon: '💥',
    description: '挥动巨大的尾巴横扫对手',
    mpCost: 0,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 22 },
    unlockLevel: 1,
    cooldown: 1,
    targetType: 'single'
  },

  // ========== 深渊卫士 ==========
  {
    id: 'demon_fire',
    name: '恶魔之火',
    icon: '🔥',
    description: '从深渊召唤不灭的魔焰',
    mpCost: 0,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 30, coefficient: 1.1 },
    unlockLevel: 1,
    cooldown: 3,
    targetType: 'single'
  },
  {
    id: 'cleave',
    name: '顺劈斩',
    icon: '🪓',
    description: '猛力挥砍，伤害面前的所有敌人',
    mpCost: 0,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 20 },
    unlockLevel: 1,
    cooldown: 2,
    targetType: 'all_enemies'
  },

  // ========== 冰霜巨龙 ==========
  {
    id: 'frost_breath',
    name: '冰霜吐息',
    icon: '❄️',
    description: '喷吐刺骨的寒冰气息，冻结一切生机',
    mpCost: 0,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 28, coefficient: 1.2 },
    unlockLevel: 1,
    cooldown: 3,
    targetType: 'all_enemies'
  },
  {
    id: 'blizzard',
    name: '暴风雪',
    icon: '🌨️',
    description: '召唤毁灭性的暴风雪覆盖战场',
    mpCost: 0,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 24, coefficient: 1.1 },
    unlockLevel: 1,
    cooldown: 3,
    targetType: 'all_enemies'
  },
  {
    id: 'ice_shield',
    name: '冰霜护盾',
    icon: '🧊',
    description: '凝聚寒冰形成厚重的防护屏障',
    mpCost: 0,
    type: 'buff',
    effect: { type: 'buff', value: 0 },
    unlockLevel: 1,
    cooldown: 4,
    targetType: 'self',
    buffs: [{ type: 'shield', value: 30, turns: 3 }]
  },

  // ========== 亡灵骑士 ==========
  {
    id: 'death_grip',
    name: '死亡之握',
    icon: '🖐️',
    description: '用死亡能量拖拽目标的灵魂',
    mpCost: 0,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 22 },
    unlockLevel: 1,
    cooldown: 2,
    targetType: 'single'
  },
  {
    id: 'soul_drain',
    name: '灵魂汲取',
    icon: '💀',
    description: '吸取目标生命力并转化为自身生命',
    mpCost: 0,
    type: 'health_restore',
    effect: { type: 'health_restore', value: 25 },
    unlockLevel: 1,
    cooldown: 3,
    targetType: 'single'
  },

  // ========== 亡灵大法师 ==========
  {
    id: 'shadow_bolt',
    name: '暗影弹',
    icon: '🟣',
    description: '发射高密度的暗影能量弹',
    mpCost: 0,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 30, coefficient: 1.3 },
    unlockLevel: 1,
    cooldown: 2,
    targetType: 'single'
  },
  {
    id: 'curse',
    name: '诅咒',
    icon: '☠️',
    description: '对目标施加恶毒的诅咒，降低其攻击力',
    mpCost: 0,
    type: 'debuff',
    effect: { type: 'debuff', value: 0 },
    unlockLevel: 1,
    cooldown: 4,
    targetType: 'single',
    buffs: [{ type: 'attack_down', value: 15, turns: 3 }]
  },

  // ========== 冰霜巨人 ==========
  {
    id: 'giant_stomp',
    name: '巨人之踏',
    icon: '👣',
    description: '猛踏地面引发冲击波，震击全场',
    mpCost: 0,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 35 },
    unlockLevel: 1,
    cooldown: 4,
    targetType: 'all_enemies'
  }
];
