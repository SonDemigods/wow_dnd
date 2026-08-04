/**
 * @fileoverview 猎人野兽宠物数据定义（P3-156 扩展）
 * @description 定义 5 种猎人可召唤的野兽宠物：荒野之狼、战熊、猎豹、野猪、魔暴龙。
 *              每种宠物有独特的定位、属性、技能和集中值消耗。
 *              参照 warlockPets.ts 的结构，但资源消耗为 focus（集中值）。
 * @module combat/pets
 */
import type { HunterPet, HunterPetType } from './types';

/**
 * 全部猎人野兽宠物定义
 *
 * 设计原则：
 * 1. 5 种野兽覆盖 5 种定位：近战输出、坦克、高速输出、控制、终极输出
 * 2. 集中值消耗与宠物强度成正比（30-80 focus）
 * 3. 持续时间差异化：常规宠物永久，魔暴龙限时
 * 4. 默认解锁 2 种（狼/熊），其他通过天赋树解锁
 */
export const HUNTER_PETS: Record<HunterPetType, HunterPet> = {
  // ============================================================
  // 荒野之狼：近战输出，aggressive
  // ============================================================
  wolf: {
    id: 'wolf',
    name: '荒野之狼',
    icon: 'game-icons:wolf-head',
    description: '敏捷的荒野猎手，以利齿撕裂敌人造成物理伤害',
    aiBehavior: 'aggressive',
    attributes: {
      baseStats: { str: 10, dex: 12, con: 8, int: 4, wis: 6, cha: 6 },
      baseHp: 45,
      baseDamage: 14,
      baseDefense: 4,
      baseSpeed: 14
    },
    skills: [
      {
        id: 'claw_strike',
        name: '利爪突袭',
        description: '用利爪撕扯敌人造成物理伤害',
        category: 'attack',
        damageMultiplier: 1.0,
        cooldown: 0,
        priority: 10
      },
      {
        id: 'howl',
        name: '嗥叫',
        description: '发出嗥叫提升主人攻击力',
        category: 'buff',
        damageMultiplier: 0,
        cooldown: 3,
        priority: 6
      },
      {
        id: 'savage_bite',
        name: '野蛮撕咬',
        description: '猛烈撕咬敌人造成额外伤害',
        category: 'attack',
        damageMultiplier: 1.5,
        cooldown: 2,
        priority: 8
      }
    ],
    focusCost: 30,
    duration: 0,
    owner: 'hunter',
    resourceType: 'focus'
  },

  // ============================================================
  // 战熊：坦克型，defensive
  // ============================================================
  bear: {
    id: 'bear',
    name: '战熊',
    icon: 'game-icons:bear-head',
    description: '强壮的战熊，以厚实毛皮承受伤害，保护主人',
    aiBehavior: 'defensive',
    attributes: {
      baseStats: { str: 12, dex: 5, con: 16, int: 3, wis: 6, cha: 5 },
      baseHp: 85,
      baseDamage: 10,
      baseDefense: 12,
      baseSpeed: 6
    },
    skills: [
      {
        id: 'maul',
        name: '熊掌猛击',
        description: '用巨掌拍击敌人造成物理伤害',
        category: 'attack',
        damageMultiplier: 0.8,
        cooldown: 0,
        priority: 8
      },
      {
        id: 'growl',
        name: '低吼',
        description: '嘲讽目标敌人，强制其攻击战熊',
        category: 'debuff',
        damageMultiplier: 0.5,
        cooldown: 2,
        priority: 10
      },
      {
        id: 'thick_hide',
        name: '厚皮',
        description: '大幅提升自身防御力',
        category: 'buff',
        damageMultiplier: 0,
        cooldown: 4,
        priority: 7
      }
    ],
    focusCost: 30,
    duration: 0,
    owner: 'hunter',
    resourceType: 'focus'
  },

  // ============================================================
  // 猎豹：高速输出，aggressive
  // ============================================================
  cat: {
    id: 'cat',
    name: '猎豹',
    icon: 'game-icons:cat',
    description: '速度极快的猎豹，以连续攻击撕裂敌人',
    aiBehavior: 'aggressive',
    attributes: {
      baseStats: { str: 8, dex: 16, con: 6, int: 4, wis: 8, cha: 6 },
      baseHp: 35,
      baseDamage: 16,
      baseDefense: 3,
      baseSpeed: 18
    },
    skills: [
      {
        id: 'rake',
        name: '横扫',
        description: '快速横扫敌人造成物理伤害',
        category: 'attack',
        damageMultiplier: 1.0,
        cooldown: 0,
        priority: 10
      },
      {
        id: 'frenzy',
        name: '狂乱',
        description: '进入狂乱状态，提升攻击速度',
        category: 'buff',
        damageMultiplier: 0,
        cooldown: 3,
        priority: 7
      },
      {
        id: 'rip_and_tear',
        name: '撕裂',
        description: '撕裂敌人造成大量流血伤害',
        category: 'attack',
        damageMultiplier: 1.8,
        cooldown: 2,
        priority: 9
      }
    ],
    focusCost: 40,
    duration: 0,
    owner: 'hunter',
    resourceType: 'focus'
  },

  // ============================================================
  // 野猪：控制型，controller
  // ============================================================
  boar: {
    id: 'boar',
    name: '野猪',
    icon: 'game-icons:boar-tusk',
    description: '凶猛的野猪，以獠牙冲撞击退并控制敌人',
    aiBehavior: 'controller',
    attributes: {
      baseStats: { str: 11, dex: 8, con: 12, int: 3, wis: 6, cha: 4 },
      baseHp: 60,
      baseDamage: 12,
      baseDefense: 8,
      baseSpeed: 10
    },
    skills: [
      {
        id: 'gore',
        name: '獠牙穿刺',
        description: '用獠牙穿刺敌人造成物理伤害',
        category: 'attack',
        damageMultiplier: 1.0,
        cooldown: 0,
        priority: 9
      },
      {
        id: 'charge',
        name: '冲撞',
        description: '冲撞敌人使其眩晕一回合',
        category: 'control',
        damageMultiplier: 0.8,
        cooldown: 3,
        priority: 10
      },
      {
        id: 'intimidating_presence',
        name: '威吓',
        description: '发出威吓降低敌人攻击力',
        category: 'debuff',
        damageMultiplier: 0,
        cooldown: 2,
        priority: 6
      }
    ],
    focusCost: 40,
    duration: 0,
    owner: 'hunter',
    resourceType: 'focus'
  },

  // ============================================================
  // 魔暴龙：终极输出，aggressive（限时）
  // ============================================================
  devilsaur: {
    id: 'devilsaur',
    name: '魔暴龙',
    icon: 'game-icons:t-rex-skull',
    description: '远古掠食者，以毁灭性撕咬碾压一切敌人',
    aiBehavior: 'aggressive',
    attributes: {
      baseStats: { str: 18, dex: 10, con: 14, int: 4, wis: 6, cha: 6 },
      baseHp: 90,
      baseDamage: 22,
      baseDefense: 8,
      baseSpeed: 12
    },
    skills: [
      {
        id: 'devastating_bite',
        name: '毁灭撕咬',
        description: '用巨颚撕裂敌人造成巨额物理伤害',
        category: 'attack',
        damageMultiplier: 1.8,
        cooldown: 0,
        priority: 10
      },
      {
        id: 'primal_ferocity',
        name: '原始凶暴',
        description: '释放原始之力对所有敌人造成范围伤害',
        category: 'attack',
        damageMultiplier: 1.3,
        cooldown: 3,
        priority: 9
      },
      {
        id: 'terrifying_roar',
        name: '恐惧咆哮',
        description: '发出恐惧咆哮降低全体敌人属性',
        category: 'debuff',
        damageMultiplier: 0,
        cooldown: 4,
        priority: 7
      }
    ],
    focusCost: 80,
    duration: 8,
    owner: 'hunter',
    resourceType: 'focus'
  }
};

/**
 * 默认可解锁的猎人宠物列表（按解锁顺序）
 */
export const DEFAULT_UNLOCKED_HUNTER_PETS: HunterPetType[] = ['wolf', 'bear'];

/**
 * 根据猎人宠物 ID 获取定义
 * @param petType - 宠物 ID
 * @returns 宠物定义
 */
export function getHunterPetByType(petType: HunterPetType): HunterPet {
  return HUNTER_PETS[petType];
}

/**
 * 获取所有猎人宠物定义列表
 * @returns 全部猎人宠物数组
 */
export function getAllHunterPets(): HunterPet[] {
  return Object.values(HUNTER_PETS);
}

/**
 * 根据集中值数量筛选可召唤的猎人宠物
 * @param focus - 当前集中值数量
 * @returns 可召唤的猎人宠物列表
 */
export function getSummonableHunterPets(focus: number): HunterPet[] {
  return Object.values(HUNTER_PETS).filter(pet => pet.focusCost <= focus);
}
