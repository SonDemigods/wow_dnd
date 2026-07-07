/**
 * @fileoverview 套装定义数据（Phase 5.3）
 * @description 定义 6 个核心职业的专属套装，每个套装含 2 件装备，穿戴 2 件激活套装奖励。
 *              套装 ID 与 class_items.ts 中装备的 setId 字段对应。
 *              套装奖励由 equipment/service.ts 的 getActiveSetBonuses 计算激活状态。
 * @module data
 */
import type { ItemSet } from '@/modules/equipment/types';

/**
 * 全部套装定义列表
 *
 * 设计原则：
 * 1. 每个套装绑定一个职业，classRestriction 与装备的 classRestriction 一致
 * 2. 套装件数等于该职业专属套装装备的数量（当前为 2 件）
 * 3. 套装奖励按 requiredPieces 升序排列
 * 4. 奖励效果涵盖属性加成和特殊效果两种类型
 */
export const ITEM_SETS: ItemSet[] = [
  // ==================== 战士：力量套装 ====================
  {
    id: 'warrior_might',
    name: '力量套装',
    pieces: 2,
    classRestriction: 'warrior',
    setBonuses: [
      {
        requiredPieces: 2,
        bonus: {
          stat: 'str',
          value: 5,
          effect: 'rage_gen_on_hit_1',
          description: '2 件套：力量 +5，攻击时额外产生 1 点怒气'
        }
      }
    ]
  },

  // ==================== 法师：奥术套装 ====================
  {
    id: 'mage_arcane',
    name: '奥术套装',
    pieces: 2,
    classRestriction: 'mage',
    setBonuses: [
      {
        requiredPieces: 2,
        bonus: {
          stat: 'int',
          value: 6,
          effect: 'mp_regen_5_percent',
          description: '2 件套：智力 +6，每回合额外恢复 5% 最大法力'
        }
      }
    ]
  },

  // ==================== 圣骑士：正义套装 ====================
  {
    id: 'paladin_righteous',
    name: '正义套装',
    pieces: 2,
    classRestriction: 'paladin',
    setBonuses: [
      {
        requiredPieces: 2,
        bonus: {
          stat: 'wis',
          value: 5,
          effect: 'heal_bonus_10_percent',
          description: '2 件套：智慧 +5，治疗效果提升 10%'
        }
      }
    ]
  },

  // ==================== 猎人：捕食者套装 ====================
  {
    id: 'hunter_predator',
    name: '捕食者套装',
    pieces: 2,
    classRestriction: 'hunter',
    setBonuses: [
      {
        requiredPieces: 2,
        bonus: {
          stat: 'dex',
          value: 5,
          effect: 'crit_bonus_3_percent',
          description: '2 件套：敏捷 +5，暴击率 +3%'
        }
      }
    ]
  },

  // ==================== 潜行者：暗影套装 ====================
  {
    id: 'rogue_shadow',
    name: '暗影套装',
    pieces: 2,
    classRestriction: 'rogue',
    setBonuses: [
      {
        requiredPieces: 2,
        bonus: {
          stat: 'dex',
          value: 6,
          effect: 'energy_regen_2',
          description: '2 件套：敏捷 +6，每回合额外恢复 2 点能量'
        }
      }
    ]
  },

  // ==================== 术士：恶魔套装 ====================
  {
    id: 'warlock_demonic',
    name: '恶魔套装',
    pieces: 2,
    classRestriction: 'warlock',
    setBonuses: [
      {
        requiredPieces: 2,
        bonus: {
          stat: 'int',
          value: 5,
          effect: 'soul_shard_on_kill_20_percent',
          description: '2 件套：智力 +5，击杀敌人时 20% 概率额外产生 1 个灵魂碎片'
        }
      }
    ]
  }
];

/**
 * 根据套装 ID 获取套装定义
 * @param setId - 套装 ID
 * @returns 套装定义，未找到返回 undefined
 */
export function getItemSetById(setId: string): ItemSet | undefined {
  return ITEM_SETS.find(set => set.id === setId);
}

/**
 * 根据职业 ID 获取该职业可用的套装列表
 * @param classId - 职业 ID
 * @returns 该职业的套装数组
 */
export function getItemSetsByClassId(classId: string): ItemSet[] {
  return ITEM_SETS.filter(set => set.classRestriction === classId);
}
