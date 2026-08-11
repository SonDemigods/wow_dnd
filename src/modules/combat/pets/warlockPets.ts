/**
 * @fileoverview 术士召唤物数据定义（Phase 6.4）
 * @description 定义 5 种术士可召唤的恶魔：小鬼、虚空行者、魅魔、地狱犬、末日守卫。
 *              每种召唤物有独特的定位、属性、技能和灵魂碎片消耗。
 * @module combat/pets
 */
import type { WarlockPet, WarlockPetType } from './types';

/**
 * 全部术士召唤物定义
 *
 * 设计原则：
 * 1. 5 种召唤物覆盖 5 种定位：远程输出、坦克、近战控制、反制、终极输出
 * 2. 灵魂碎片消耗与召唤物强度成正比（1-3 碎片）
 * 3. 持续时间差异化：常规召唤物永久，末日守卫限时
 * 4. AI 行为与定位匹配（如坦克用 defensive，输出用 aggressive）
 */
export const WARLOCK_PETS: Record<WarlockPetType, WarlockPet> = {
  // ============================================================
  // 小鬼：远程法术输出，低生命高伤害
  // ============================================================
  imp: {
    id: 'imp',
    name: '小鬼',
    icon: 'game-icons:imp',
    description: '弱小但狡猾的恶魔，从远处投掷火球造成魔法伤害',
    aiBehavior: 'caster',
    attributes: {
      baseStats: { str: 3, dex: 8, con: 4, int: 12, wis: 8, cha: 6 },
      baseHp: 30,
      baseDamage: 15,
      baseDefense: 2,
      baseSpeed: 12
    },
    skills: [
      {
        id: 'firebolt',
        name: '火球术',
        description: '投掷火球对单个敌人造成魔法伤害',
        category: 'attack',
        damageMultiplier: 1.0,
        cooldown: 0,
        priority: 10
      },
      {
        id: 'fire_shield',
        name: '火焰护盾',
        description: '为主人提供火焰护盾，减少受到的伤害',
        category: 'buff',
        damageMultiplier: 0,
        cooldown: 3,
        priority: 5
      },
      {
        id: 'blood_pact',
        name: '血之契约',
        description: '提升主人的生命值上限',
        category: 'buff',
        damageMultiplier: 0,
        cooldown: 5,
        priority: 3
      }
    ],
    soulShardCost: 1,
    duration: 0,
    owner: 'warlock',
    resourceType: 'soul_shard'
  },

  // ============================================================
  // 虚空行者：坦克型，高生命高防御，可嘲讽
  // ============================================================
  voidwalker: {
    id: 'voidwalker',
    name: '虚空行者',
    icon: 'game-icons:falling-ovoid',
    description: '由虚空能量构成的坚韧恶魔，能吸引敌人攻击保护主人',
    aiBehavior: 'defensive',
    attributes: {
      baseStats: { str: 8, dex: 5, con: 14, int: 4, wis: 6, cha: 4 },
      baseHp: 80,
      baseDamage: 8,
      baseDefense: 10,
      baseSpeed: 6
    },
    skills: [
      {
        id: 'torment',
        name: '折磨',
        description: '嘲讽目标敌人，强制其攻击虚空行者',
        category: 'debuff',
        damageMultiplier: 0.5,
        cooldown: 2,
        priority: 10
      },
      {
        id: 'suffering',
        name: '苦难',
        description: '对攻击主人的敌人造成伤害并降低其攻击力',
        category: 'attack',
        damageMultiplier: 0.8,
        cooldown: 1,
        priority: 8
      },
      {
        id: 'shadow_bulwark',
        name: '暗影壁垒',
        description: '生成暗影护盾，大幅提升自身防御',
        category: 'buff',
        damageMultiplier: 0,
        cooldown: 4,
        priority: 6
      }
    ],
    soulShardCost: 1,
    duration: 0,
    owner: 'warlock',
    resourceType: 'soul_shard'
  },

  // ============================================================
  // 魅魔：近战输出，可魅惑控制敌人
  // ============================================================
  succubus: {
    id: 'succubus',
    name: '魅魔',
    icon: 'game-icons:charm',
    description: '以魅力迷惑敌人的恶魔，擅长近战输出和控制',
    aiBehavior: 'controller',
    attributes: {
      baseStats: { str: 10, dex: 12, con: 8, int: 6, wis: 6, cha: 14 },
      baseHp: 50,
      baseDamage: 18,
      baseDefense: 5,
      baseSpeed: 14
    },
    skills: [
      {
        id: 'lash_of_pain',
        name: '痛苦之鞭',
        description: '用暗影鞭子攻击敌人造成物理伤害',
        category: 'attack',
        damageMultiplier: 1.2,
        cooldown: 0,
        priority: 10
      },
      {
        id: 'seduction',
        name: '魅惑',
        description: '魅惑一个敌人，使其无法行动数回合',
        category: 'control',
        damageMultiplier: 0,
        cooldown: 4,
        priority: 9
      },
      {
        id: 'whiplash',
        name: '鞭击',
        description: '击退敌人并降低其速度',
        category: 'debuff',
        damageMultiplier: 0.6,
        cooldown: 2,
        priority: 6
      }
    ],
    soulShardCost: 2,
    duration: 0,
    owner: 'warlock',
    resourceType: 'soul_shard'
  },

  // ============================================================
  // 地狱犬：反制型，可驱散和沉默敌人
  // ============================================================
  felhunter: {
    id: 'felhunter',
    name: '地狱犬',
    icon: 'game-icons:dog-house',
    description: '嗅觉敏锐的恶魔猎犬，能反制施法者并驱散增益效果',
    aiBehavior: 'support',
    attributes: {
      baseStats: { str: 9, dex: 14, con: 10, int: 6, wis: 8, cha: 4 },
      baseHp: 55,
      baseDamage: 14,
      baseDefense: 6,
      baseSpeed: 15
    },
    skills: [
      {
        id: 'bite',
        name: '撕咬',
        description: '撕咬敌人造成物理伤害',
        category: 'attack',
        damageMultiplier: 1.0,
        cooldown: 0,
        priority: 8
      },
      {
        id: 'spell_lock',
        name: '法术封锁',
        description: '沉默目标敌人，使其无法施法数回合',
        category: 'control',
        damageMultiplier: 0,
        cooldown: 3,
        priority: 10
      },
      {
        id: 'devour_magic',
        name: '吞噬魔法',
        description: '驱散敌人身上的增益效果并恢复自身生命',
        category: 'debuff',
        damageMultiplier: 0,
        cooldown: 2,
        priority: 9
      }
    ],
    soulShardCost: 2,
    duration: 0,
    owner: 'warlock',
    resourceType: 'soul_shard'
  },

  // ============================================================
  // 末日守卫：终极召唤，强力范围伤害
  // ============================================================
  doomguard: {
    id: 'doomguard',
    name: '末日守卫',
    icon: 'game-icons:evil-minion',
    description: '强大的恶魔战士，仅在有足够灵魂碎片时方可召唤，造成毁灭性范围伤害',
    aiBehavior: 'aggressive',
    attributes: {
      baseStats: { str: 16, dex: 10, con: 14, int: 8, wis: 8, cha: 8 },
      baseHp: 100,
      baseDamage: 25,
      baseDefense: 8,
      baseSpeed: 10
    },
    skills: [
      {
        id: 'rain_of_fire',
        name: '火焰之雨',
        description: '召唤火焰之雨对所有敌人造成范围伤害',
        category: 'attack',
        damageMultiplier: 1.5,
        cooldown: 3,
        priority: 10
      },
      {
        id: 'doom_bolt',
        name: '末日之矢',
        description: '投掷暗能量箭对单个敌人造成巨额伤害',
        category: 'attack',
        damageMultiplier: 2.0,
        cooldown: 2,
        priority: 9
      },
      {
        id: 'cripple',
        name: '残废',
        description: '降低目标敌人的全属性',
        category: 'debuff',
        damageMultiplier: 0,
        cooldown: 4,
        priority: 7
      }
    ],
    soulShardCost: 3,
    duration: 10,
    owner: 'warlock',
    resourceType: 'soul_shard'
  }
};

/**
 * 默认可解锁的召唤物列表（按解锁顺序）
 */
export const DEFAULT_UNLOCKED_PETS: WarlockPetType[] = ['imp', 'voidwalker'];

/**
 * 根据召唤物 ID 获取定义
 * @param petType - 召唤物 ID
 * @returns 召唤物定义
 */
export function getPetByType(petType: WarlockPetType): WarlockPet {
  return WARLOCK_PETS[petType];
}

/**
 * 获取所有召唤物定义列表
 * @returns 全部召唤物数组
 */
export function getAllPets(): WarlockPet[] {
  return Object.values(WARLOCK_PETS);
}

/**
 * 根据灵魂碎片数量筛选可召唤的召唤物
 * @param soulShards - 当前灵魂碎片数量
 * @returns 可召唤的召唤物列表
 */
export function getSummonablePets(soulShards: number): WarlockPet[] {
  return Object.values(WARLOCK_PETS).filter(pet => pet.soulShardCost <= soulShards);
}
