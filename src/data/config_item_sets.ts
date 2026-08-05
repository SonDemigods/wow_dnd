/**
 * @fileoverview 套装定义数据（Phase 5.3，P3.3b 升级到新版类型）
 * @description 定义 6 个核心职业的专属套装，每个套装含 2 件装备，穿戴 2 件激活套装奖励。
 *              套装 ID 与 config_class_items.ts 中装备的 setId 字段对应。
 *              套装进度与激活效果由 equipment/setService.ts 的 getSetProgress / getAllSetProgresses 计算。
 *
 *              P3.3b 升级：从旧版 ItemSet（pieces + setBonuses 单档松散效果）迁移到
 *              新版 ItemSet（parts 部件清单 + bonusTiers 多档判别联合效果）。
 *              旧版 effect 字符串（rage_gen_on_hit_1 等）迁移为 kind:'trigger' + triggerId，
 *              由 setBonusRegistry 的执行器映射到实际效果意图。
 * @module data
 */
import type { ItemSet } from '@/modules/equipment/setTypes';

/**
 * 全部套装定义列表
 *
 * 设计原则：
 * 1. 每个套装绑定一个职业，classRestriction 与装备的 classRestriction 一致
 * 2. parts 列出套装包含的具体部件（slot + itemId），与 config_class_items.ts 对应
 * 3. bonusTiers 按 requiredPieces 升序排列，2 件套为一档
 * 4. 每档可含多个 SetBonusEffect（如同时给属性加成 + 触发效果）
 * 5. category 为 'armor_set'（6 个职业套装均为头部 + 胸部两件护甲）
 */
export const ITEM_SETS: ItemSet[] = [
  // ==================== 战士：力量套装 ====================
  {
    id: 'warrior_might',
    name: '力量套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warrior_helm_rage' },
      { slot: 'chest', itemId: 'warrior_chest_might' }
    ],
    classRestriction: 'warrior',
    bonusTiers: [
      {
        requiredPieces: 2,
        bonuses: [
          { kind: 'stat', stat: 'str', value: 5, description: '力量 +5' },
          { kind: 'trigger', triggerId: 'rage_gen_on_hit_1', description: '攻击时额外产生 1 点怒气' }
        ]
      }
    ]
  },

  // ==================== 法师：奥术套装 ====================
  {
    id: 'mage_arcane',
    name: '奥术套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'mage_hat_arcane' },
      { slot: 'chest', itemId: 'mage_robe_mystic' }
    ],
    classRestriction: 'mage',
    bonusTiers: [
      {
        requiredPieces: 2,
        bonuses: [
          { kind: 'stat', stat: 'int', value: 6, description: '智力 +6' },
          { kind: 'trigger', triggerId: 'mp_regen_5_percent', description: '每回合额外恢复 5% 最大法力' }
        ]
      }
    ]
  },

  // ==================== 圣骑士：正义套装 ====================
  {
    id: 'paladin_righteous',
    name: '正义套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'paladin_helm_holy' },
      { slot: 'chest', itemId: 'paladin_chest_guardian' }
    ],
    classRestriction: 'paladin',
    bonusTiers: [
      {
        requiredPieces: 2,
        bonuses: [
          { kind: 'stat', stat: 'wis', value: 5, description: '智慧 +5' },
          { kind: 'trigger', triggerId: 'heal_bonus_10_percent', description: '治疗效果提升 10%' }
        ]
      }
    ]
  },

  // ==================== 猎人：捕食者套装 ====================
  {
    id: 'hunter_predator',
    name: '捕食者套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'hunter_cap_tracker' },
      { slot: 'chest', itemId: 'hunter_tunic_swift' }
    ],
    classRestriction: 'hunter',
    bonusTiers: [
      {
        requiredPieces: 2,
        bonuses: [
          { kind: 'stat', stat: 'dex', value: 5, description: '敏捷 +5' },
          { kind: 'trigger', triggerId: 'crit_bonus_3_percent', description: '暴击率 +3%' }
        ]
      }
    ]
  },

  // ==================== 潜行者：暗影套装 ====================
  {
    id: 'rogue_shadow',
    name: '暗影套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'rogue_mask_shadow' },
      { slot: 'chest', itemId: 'rogue_tunic_silent' }
    ],
    classRestriction: 'rogue',
    bonusTiers: [
      {
        requiredPieces: 2,
        bonuses: [
          { kind: 'stat', stat: 'dex', value: 6, description: '敏捷 +6' },
          { kind: 'trigger', triggerId: 'energy_regen_2', description: '每回合额外恢复 2 点能量' }
        ]
      }
    ]
  },

  // ==================== 术士：恶魔套装 ====================
  {
    id: 'warlock_demonic',
    name: '恶魔套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warlock_hood_demon' },
      { slot: 'chest', itemId: 'warlock_robe_corrupt' }
    ],
    classRestriction: 'warlock',
    bonusTiers: [
      {
        requiredPieces: 2,
        bonuses: [
          { kind: 'stat', stat: 'int', value: 5, description: '智力 +5' },
          { kind: 'trigger', triggerId: 'soul_shard_on_kill_20_percent', description: '击杀敌人时 20% 概率额外产生 1 个灵魂碎片' }
        ]
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
