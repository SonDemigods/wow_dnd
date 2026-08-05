/**
 * @fileoverview 套装定义数据（Phase 5.3，P3.3b 升级到新版类型，P3 套装扩展）
 * @description 定义 39 套职业套装（13 职业 × 3 套，5 件套）。
 *              每套 5 件护甲（helm+chest+gloves+legs+boots），2 件套 stat 奖励 + 4 件套 trigger 奖励。
 *              套装 ID 与 config_class_equipment.ts / config_set_parts.ts 中装备的 setId 字段对应。
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
 * 2. parts 列出套装包含的具体部件（slot + itemId），与 config_class_equipment.ts 对应
 * 3. bonusTiers 按 requiredPieces 升序排列，2 件套为一档
 * 4. 每档可含多个 SetBonusEffect（如同时给属性加成 + 触发效果）
 * 5. category 为 'armor_set'（所有套装均为 5 件护甲）
 */
export const SET_DEFINITIONS: ItemSet[] = [
  // ==========================================================================
  // P3 套装扩展：39 套职业套装（13 职业 × 3 套）
  //
  // 每套 5 件护甲（helm+chest+gloves+legs+boots）：
  // - 2 件套：主属性奖励（T1 +5 / T2 +8 / T3 +12）
  // - 4 件套：触发效果（triggerId 对应 setBonusRegistry.ts 的执行器）
  //
  // 部件 itemId 对应 config_set_parts.ts 的 SET_PART_DRAFTS。
  // ==========================================================================

  // ==================== 战士 T1：铁壁套装 ====================
  {
    id: 'warrior_t1',
    name: '铁壁套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warrior_helm_t1' },
      { slot: 'chest', itemId: 'warrior_chest_t1' },
      { slot: 'gloves', itemId: 'warrior_gloves_t1' },
      { slot: 'legs', itemId: 'warrior_legs_t1' },
      { slot: 'boots', itemId: 'warrior_boots_t1' }
    ],
    classRestriction: 'warrior',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 5, description: '力量 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rage_gen_on_hit_1', description: '攻击时额外产生 1 点怒气' }] }
    ]
  },
  // ==================== 战士 T2：嗜血套装 ====================
  {
    id: 'warrior_t2',
    name: '嗜血套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warrior_helm_t2' },
      { slot: 'chest', itemId: 'warrior_chest_t2' },
      { slot: 'gloves', itemId: 'warrior_gloves_t2' },
      { slot: 'legs', itemId: 'warrior_legs_t2' },
      { slot: 'boots', itemId: 'warrior_boots_t2' }
    ],
    classRestriction: 'warrior',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 8, description: '力量 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rage_gen_on_hit_2', description: '攻击时额外产生 2 点怒气' }] }
    ]
  },
  // ==================== 战士 T3：不朽套装 ====================
  {
    id: 'warrior_t3',
    name: '不朽套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warrior_helm_t3' },
      { slot: 'chest', itemId: 'warrior_chest_t3' },
      { slot: 'gloves', itemId: 'warrior_gloves_t3' },
      { slot: 'legs', itemId: 'warrior_legs_t3' },
      { slot: 'boots', itemId: 'warrior_boots_t3' }
    ],
    classRestriction: 'warrior',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 12, description: '力量 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rage_gen_on_hit_3', description: '攻击时额外产生 3 点怒气' }] }
    ]
  },

  // ==================== 圣骑士 T1：圣盾套装 ====================
  {
    id: 'paladin_t1',
    name: '圣盾套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'paladin_helm_t1' },
      { slot: 'chest', itemId: 'paladin_chest_t1' },
      { slot: 'gloves', itemId: 'paladin_gloves_t1' },
      { slot: 'legs', itemId: 'paladin_legs_t1' },
      { slot: 'boots', itemId: 'paladin_boots_t1' }
    ],
    classRestriction: 'paladin',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'cha', value: 5, description: '魅力 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'heal_bonus_10_percent', description: '治疗效果提升 10%' }] }
    ]
  },
  // ==================== 圣骑士 T2：审判套装 ====================
  {
    id: 'paladin_t2',
    name: '审判套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'paladin_helm_t2' },
      { slot: 'chest', itemId: 'paladin_chest_t2' },
      { slot: 'gloves', itemId: 'paladin_gloves_t2' },
      { slot: 'legs', itemId: 'paladin_legs_t2' },
      { slot: 'boots', itemId: 'paladin_boots_t2' }
    ],
    classRestriction: 'paladin',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'cha', value: 8, description: '魅力 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'heal_bonus_15_percent', description: '治疗效果提升 15%' }] }
    ]
  },
  // ==================== 圣骑士 T3：圣光化身套装 ====================
  {
    id: 'paladin_t3',
    name: '圣光化身套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'paladin_helm_t3' },
      { slot: 'chest', itemId: 'paladin_chest_t3' },
      { slot: 'gloves', itemId: 'paladin_gloves_t3' },
      { slot: 'legs', itemId: 'paladin_legs_t3' },
      { slot: 'boots', itemId: 'paladin_boots_t3' }
    ],
    classRestriction: 'paladin',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'cha', value: 12, description: '魅力 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'heal_bonus_20_percent', description: '治疗效果提升 20%' }] }
    ]
  },

  // ==================== 猎人 T1：追踪者套装 ====================
  {
    id: 'hunter_t1',
    name: '追踪者套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'hunter_helm_t1' },
      { slot: 'chest', itemId: 'hunter_chest_t1' },
      { slot: 'gloves', itemId: 'hunter_gloves_t1' },
      { slot: 'legs', itemId: 'hunter_legs_t1' },
      { slot: 'boots', itemId: 'hunter_boots_t1' }
    ],
    classRestriction: 'hunter',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 5, description: '敏捷 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'crit_bonus_3_percent', description: '暴击率 +3%' }] }
    ]
  },
  // ==================== 猎人 T2：神射手套装 ====================
  {
    id: 'hunter_t2',
    name: '神射手套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'hunter_helm_t2' },
      { slot: 'chest', itemId: 'hunter_chest_t2' },
      { slot: 'gloves', itemId: 'hunter_gloves_t2' },
      { slot: 'legs', itemId: 'hunter_legs_t2' },
      { slot: 'boots', itemId: 'hunter_boots_t2' }
    ],
    classRestriction: 'hunter',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 8, description: '敏捷 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'crit_bonus_5_percent', description: '暴击率 +5%' }] }
    ]
  },
  // ==================== 猎人 T3：鹰眼套装 ====================
  {
    id: 'hunter_t3',
    name: '鹰眼套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'hunter_helm_t3' },
      { slot: 'chest', itemId: 'hunter_chest_t3' },
      { slot: 'gloves', itemId: 'hunter_gloves_t3' },
      { slot: 'legs', itemId: 'hunter_legs_t3' },
      { slot: 'boots', itemId: 'hunter_boots_t3' }
    ],
    classRestriction: 'hunter',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 12, description: '敏捷 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'crit_bonus_7_percent', description: '暴击率 +7%' }] }
    ]
  },

  // ==================== 潜行者 T1：暗影套装 ====================
  {
    id: 'rogue_t1',
    name: '暗影套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'rogue_helm_t1' },
      { slot: 'chest', itemId: 'rogue_chest_t1' },
      { slot: 'gloves', itemId: 'rogue_gloves_t1' },
      { slot: 'legs', itemId: 'rogue_legs_t1' },
      { slot: 'boots', itemId: 'rogue_boots_t1' }
    ],
    classRestriction: 'rogue',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 5, description: '敏捷 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'energy_regen_2', description: '每回合额外恢复 2 点能量' }] }
    ]
  },
  // ==================== 潜行者 T2：刺客套装 ====================
  {
    id: 'rogue_t2',
    name: '刺客套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'rogue_helm_t2' },
      { slot: 'chest', itemId: 'rogue_chest_t2' },
      { slot: 'gloves', itemId: 'rogue_gloves_t2' },
      { slot: 'legs', itemId: 'rogue_legs_t2' },
      { slot: 'boots', itemId: 'rogue_boots_t2' }
    ],
    classRestriction: 'rogue',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 8, description: '敏捷 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'energy_regen_3', description: '每回合额外恢复 3 点能量' }] }
    ]
  },
  // ==================== 潜行者 T3：夜刃套装 ====================
  {
    id: 'rogue_t3',
    name: '夜刃套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'rogue_helm_t3' },
      { slot: 'chest', itemId: 'rogue_chest_t3' },
      { slot: 'gloves', itemId: 'rogue_gloves_t3' },
      { slot: 'legs', itemId: 'rogue_legs_t3' },
      { slot: 'boots', itemId: 'rogue_boots_t3' }
    ],
    classRestriction: 'rogue',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 12, description: '敏捷 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'energy_regen_4', description: '每回合额外恢复 4 点能量' }] }
    ]
  },

  // ==================== 牧师 T1：祈祷者套装 ====================
  {
    id: 'priest_t1',
    name: '祈祷者套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'priest_helm_t1' },
      { slot: 'chest', itemId: 'priest_chest_t1' },
      { slot: 'gloves', itemId: 'priest_gloves_t1' },
      { slot: 'legs', itemId: 'priest_legs_t1' },
      { slot: 'boots', itemId: 'priest_boots_t1' }
    ],
    classRestriction: 'priest',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 5, description: '感知 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'mp_regen_5_percent', description: '每回合额外恢复 5% 最大法力' }] }
    ]
  },
  // ==================== 牧师 T2：圣灵套装 ====================
  {
    id: 'priest_t2',
    name: '圣灵套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'priest_helm_t2' },
      { slot: 'chest', itemId: 'priest_chest_t2' },
      { slot: 'gloves', itemId: 'priest_gloves_t2' },
      { slot: 'legs', itemId: 'priest_legs_t2' },
      { slot: 'boots', itemId: 'priest_boots_t2' }
    ],
    classRestriction: 'priest',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 8, description: '感知 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'mp_regen_7_percent', description: '每回合额外恢复 7% 最大法力' }] }
    ]
  },
  // ==================== 牧师 T3：神谕者套装 ====================
  {
    id: 'priest_t3',
    name: '神谕者套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'priest_helm_t3' },
      { slot: 'chest', itemId: 'priest_chest_t3' },
      { slot: 'gloves', itemId: 'priest_gloves_t3' },
      { slot: 'legs', itemId: 'priest_legs_t3' },
      { slot: 'boots', itemId: 'priest_boots_t3' }
    ],
    classRestriction: 'priest',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 12, description: '感知 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'mp_regen_10_percent', description: '每回合额外恢复 10% 最大法力' }] }
    ]
  },

  // ==================== 萨满 T1：元素使者套装 ====================
  {
    id: 'shaman_t1',
    name: '元素使者套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'shaman_helm_t1' },
      { slot: 'chest', itemId: 'shaman_chest_t1' },
      { slot: 'gloves', itemId: 'shaman_gloves_t1' },
      { slot: 'legs', itemId: 'shaman_legs_t1' },
      { slot: 'boots', itemId: 'shaman_boots_t1' }
    ],
    classRestriction: 'shaman',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 5, description: '感知 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'elemental_damage_5_percent', description: '元素伤害 +5%' }] }
    ]
  },
  // ==================== 萨满 T2：风暴套装 ====================
  {
    id: 'shaman_t2',
    name: '风暴套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'shaman_helm_t2' },
      { slot: 'chest', itemId: 'shaman_chest_t2' },
      { slot: 'gloves', itemId: 'shaman_gloves_t2' },
      { slot: 'legs', itemId: 'shaman_legs_t2' },
      { slot: 'boots', itemId: 'shaman_boots_t2' }
    ],
    classRestriction: 'shaman',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 8, description: '感知 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'elemental_damage_8_percent', description: '元素伤害 +8%' }] }
    ]
  },
  // ==================== 萨满 T3：大地之怒套装 ====================
  {
    id: 'shaman_t3',
    name: '大地之怒套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'shaman_helm_t3' },
      { slot: 'chest', itemId: 'shaman_chest_t3' },
      { slot: 'gloves', itemId: 'shaman_gloves_t3' },
      { slot: 'legs', itemId: 'shaman_legs_t3' },
      { slot: 'boots', itemId: 'shaman_boots_t3' }
    ],
    classRestriction: 'shaman',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 12, description: '感知 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'elemental_damage_12_percent', description: '元素伤害 +12%' }] }
    ]
  },

  // ==================== 法师 T1：奥术学徒套装 ====================
  {
    id: 'mage_t1',
    name: '奥术学徒套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'mage_helm_t1' },
      { slot: 'chest', itemId: 'mage_chest_t1' },
      { slot: 'gloves', itemId: 'mage_gloves_t1' },
      { slot: 'legs', itemId: 'mage_legs_t1' },
      { slot: 'boots', itemId: 'mage_boots_t1' }
    ],
    classRestriction: 'mage',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 5, description: '智力 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'mp_regen_5_percent', description: '每回合额外恢复 5% 最大法力' }] }
    ]
  },
  // ==================== 法师 T2：魔导师套装 ====================
  {
    id: 'mage_t2',
    name: '魔导师套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'mage_helm_t2' },
      { slot: 'chest', itemId: 'mage_chest_t2' },
      { slot: 'gloves', itemId: 'mage_gloves_t2' },
      { slot: 'legs', itemId: 'mage_legs_t2' },
      { slot: 'boots', itemId: 'mage_boots_t2' }
    ],
    classRestriction: 'mage',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 8, description: '智力 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'mp_regen_7_percent', description: '每回合额外恢复 7% 最大法力' }] }
    ]
  },
  // ==================== 法师 T3：星界套装 ====================
  {
    id: 'mage_t3',
    name: '星界套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'mage_helm_t3' },
      { slot: 'chest', itemId: 'mage_chest_t3' },
      { slot: 'gloves', itemId: 'mage_gloves_t3' },
      { slot: 'legs', itemId: 'mage_legs_t3' },
      { slot: 'boots', itemId: 'mage_boots_t3' }
    ],
    classRestriction: 'mage',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 12, description: '智力 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'mp_regen_10_percent', description: '每回合额外恢复 10% 最大法力' }] }
    ]
  },

  // ==================== 术士 T1：暗影契约套装 ====================
  {
    id: 'warlock_t1',
    name: '暗影契约套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warlock_helm_t1' },
      { slot: 'chest', itemId: 'warlock_chest_t1' },
      { slot: 'gloves', itemId: 'warlock_gloves_t1' },
      { slot: 'legs', itemId: 'warlock_legs_t1' },
      { slot: 'boots', itemId: 'warlock_boots_t1' }
    ],
    classRestriction: 'warlock',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 5, description: '智力 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'soul_shard_on_kill_20_percent', description: '击杀敌人时 20% 概率额外产生 1 个灵魂碎片' }] }
    ]
  },
  // ==================== 术士 T2：恶魔之心套装 ====================
  {
    id: 'warlock_t2',
    name: '恶魔之心套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warlock_helm_t2' },
      { slot: 'chest', itemId: 'warlock_chest_t2' },
      { slot: 'gloves', itemId: 'warlock_gloves_t2' },
      { slot: 'legs', itemId: 'warlock_legs_t2' },
      { slot: 'boots', itemId: 'warlock_boots_t2' }
    ],
    classRestriction: 'warlock',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 8, description: '智力 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'soul_shard_on_kill_30_percent', description: '击杀敌人时 30% 概率额外产生 1 个灵魂碎片' }] }
    ]
  },
  // ==================== 术士 T3：深渊领主套装 ====================
  {
    id: 'warlock_t3',
    name: '深渊领主套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'warlock_helm_t3' },
      { slot: 'chest', itemId: 'warlock_chest_t3' },
      { slot: 'gloves', itemId: 'warlock_gloves_t3' },
      { slot: 'legs', itemId: 'warlock_legs_t3' },
      { slot: 'boots', itemId: 'warlock_boots_t3' }
    ],
    classRestriction: 'warlock',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 12, description: '智力 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'soul_shard_on_kill_40_percent', description: '击杀敌人时 40% 概率额外产生 1 个灵魂碎片' }] }
    ]
  },

  // ==================== 武僧 T1：禅意套装 ====================
  {
    id: 'monk_t1',
    name: '禅意套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'monk_helm_t1' },
      { slot: 'chest', itemId: 'monk_chest_t1' },
      { slot: 'gloves', itemId: 'monk_gloves_t1' },
      { slot: 'legs', itemId: 'monk_legs_t1' },
      { slot: 'boots', itemId: 'monk_boots_t1' }
    ],
    classRestriction: 'monk',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 5, description: '敏捷 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'chi_regen_1', description: '每回合额外恢复 1 点真气' }] }
    ]
  },
  // ==================== 武僧 T2：醉拳套装 ====================
  {
    id: 'monk_t2',
    name: '醉拳套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'monk_helm_t2' },
      { slot: 'chest', itemId: 'monk_chest_t2' },
      { slot: 'gloves', itemId: 'monk_gloves_t2' },
      { slot: 'legs', itemId: 'monk_legs_t2' },
      { slot: 'boots', itemId: 'monk_boots_t2' }
    ],
    classRestriction: 'monk',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 8, description: '敏捷 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'chi_regen_2', description: '每回合额外恢复 2 点真气' }] }
    ]
  },
  // ==================== 武僧 T3：真气大师套装 ====================
  {
    id: 'monk_t3',
    name: '真气大师套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'monk_helm_t3' },
      { slot: 'chest', itemId: 'monk_chest_t3' },
      { slot: 'gloves', itemId: 'monk_gloves_t3' },
      { slot: 'legs', itemId: 'monk_legs_t3' },
      { slot: 'boots', itemId: 'monk_boots_t3' }
    ],
    classRestriction: 'monk',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 12, description: '敏捷 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'chi_regen_3', description: '每回合额外恢复 3 点真气' }] }
    ]
  },

  // ==================== 德鲁伊 T1：自然守护者套装 ====================
  {
    id: 'druid_t1',
    name: '自然守护者套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'druid_helm_t1' },
      { slot: 'chest', itemId: 'druid_chest_t1' },
      { slot: 'gloves', itemId: 'druid_gloves_t1' },
      { slot: 'legs', itemId: 'druid_legs_t1' },
      { slot: 'boots', itemId: 'druid_boots_t1' }
    ],
    classRestriction: 'druid',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 5, description: '感知 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'heal_bonus_10_percent', description: '治疗效果提升 10%' }] }
    ]
  },
  // ==================== 德鲁伊 T2：野性化身套装 ====================
  {
    id: 'druid_t2',
    name: '野性化身套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'druid_helm_t2' },
      { slot: 'chest', itemId: 'druid_chest_t2' },
      { slot: 'gloves', itemId: 'druid_gloves_t2' },
      { slot: 'legs', itemId: 'druid_legs_t2' },
      { slot: 'boots', itemId: 'druid_boots_t2' }
    ],
    classRestriction: 'druid',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 8, description: '感知 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'heal_bonus_15_percent', description: '治疗效果提升 15%' }] }
    ]
  },
  // ==================== 德鲁伊 T3：翠绿梦境套装 ====================
  {
    id: 'druid_t3',
    name: '翠绿梦境套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'druid_helm_t3' },
      { slot: 'chest', itemId: 'druid_chest_t3' },
      { slot: 'gloves', itemId: 'druid_gloves_t3' },
      { slot: 'legs', itemId: 'druid_legs_t3' },
      { slot: 'boots', itemId: 'druid_boots_t3' }
    ],
    classRestriction: 'druid',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'wis', value: 12, description: '感知 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'heal_bonus_20_percent', description: '治疗效果提升 20%' }] }
    ]
  },

  // ==================== 死亡骑士 T1：冰霜套装 ====================
  {
    id: 'death_knight_t1',
    name: '冰霜套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'death_knight_helm_t1' },
      { slot: 'chest', itemId: 'death_knight_chest_t1' },
      { slot: 'gloves', itemId: 'death_knight_gloves_t1' },
      { slot: 'legs', itemId: 'death_knight_legs_t1' },
      { slot: 'boots', itemId: 'death_knight_boots_t1' }
    ],
    classRestriction: 'death_knight',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 5, description: '力量 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rune_regen_1', description: '每回合额外恢复 1 点符文' }] }
    ]
  },
  // ==================== 死亡骑士 T2：鲜血套装 ====================
  {
    id: 'death_knight_t2',
    name: '鲜血套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'death_knight_helm_t2' },
      { slot: 'chest', itemId: 'death_knight_chest_t2' },
      { slot: 'gloves', itemId: 'death_knight_gloves_t2' },
      { slot: 'legs', itemId: 'death_knight_legs_t2' },
      { slot: 'boots', itemId: 'death_knight_boots_t2' }
    ],
    classRestriction: 'death_knight',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 8, description: '力量 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rune_regen_2', description: '每回合额外恢复 2 点符文' }] }
    ]
  },
  // ==================== 死亡骑士 T3：天灾套装 ====================
  {
    id: 'death_knight_t3',
    name: '天灾套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'death_knight_helm_t3' },
      { slot: 'chest', itemId: 'death_knight_chest_t3' },
      { slot: 'gloves', itemId: 'death_knight_gloves_t3' },
      { slot: 'legs', itemId: 'death_knight_legs_t3' },
      { slot: 'boots', itemId: 'death_knight_boots_t3' }
    ],
    classRestriction: 'death_knight',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 12, description: '力量 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rune_regen_3', description: '每回合额外恢复 3 点符文' }] }
    ]
  },

  // ==================== 恶魔猎手 T1：影刃套装 ====================
  {
    id: 'demon_hunter_t1',
    name: '影刃套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'demon_hunter_helm_t1' },
      { slot: 'chest', itemId: 'demon_hunter_chest_t1' },
      { slot: 'gloves', itemId: 'demon_hunter_gloves_t1' },
      { slot: 'legs', itemId: 'demon_hunter_legs_t1' },
      { slot: 'boots', itemId: 'demon_hunter_boots_t1' }
    ],
    classRestriction: 'demon_hunter',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 5, description: '敏捷 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'fury_gen_on_hit_1', description: '攻击时额外产生 1 点怒气' }] }
    ]
  },
  // ==================== 恶魔猎手 T2：魔化套装 ====================
  {
    id: 'demon_hunter_t2',
    name: '魔化套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'demon_hunter_helm_t2' },
      { slot: 'chest', itemId: 'demon_hunter_chest_t2' },
      { slot: 'gloves', itemId: 'demon_hunter_gloves_t2' },
      { slot: 'legs', itemId: 'demon_hunter_legs_t2' },
      { slot: 'boots', itemId: 'demon_hunter_boots_t2' }
    ],
    classRestriction: 'demon_hunter',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 8, description: '敏捷 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'fury_gen_on_hit_2', description: '攻击时额外产生 2 点怒气' }] }
    ]
  },
  // ==================== 恶魔猎手 T3：伊利达雷套装 ====================
  {
    id: 'demon_hunter_t3',
    name: '伊利达雷套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'demon_hunter_helm_t3' },
      { slot: 'chest', itemId: 'demon_hunter_chest_t3' },
      { slot: 'gloves', itemId: 'demon_hunter_gloves_t3' },
      { slot: 'legs', itemId: 'demon_hunter_legs_t3' },
      { slot: 'boots', itemId: 'demon_hunter_boots_t3' }
    ],
    classRestriction: 'demon_hunter',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'dex', value: 12, description: '敏捷 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'fury_gen_on_hit_3', description: '攻击时额外产生 3 点怒气' }] }
    ]
  },

  // ==================== 唤魔者 T1：龙血套装 ====================
  {
    id: 'evoker_t1',
    name: '龙血套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'evoker_helm_t1' },
      { slot: 'chest', itemId: 'evoker_chest_t1' },
      { slot: 'gloves', itemId: 'evoker_gloves_t1' },
      { slot: 'legs', itemId: 'evoker_legs_t1' },
      { slot: 'boots', itemId: 'evoker_boots_t1' }
    ],
    classRestriction: 'evoker',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 5, description: '智力 +5' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'essence_regen_1', description: '每回合额外恢复 1 点精华' }] }
    ]
  },
  // ==================== 唤魔者 T2：龙喉套装 ====================
  {
    id: 'evoker_t2',
    name: '龙喉套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'evoker_helm_t2' },
      { slot: 'chest', itemId: 'evoker_chest_t2' },
      { slot: 'gloves', itemId: 'evoker_gloves_t2' },
      { slot: 'legs', itemId: 'evoker_legs_t2' },
      { slot: 'boots', itemId: 'evoker_boots_t2' }
    ],
    classRestriction: 'evoker',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 8, description: '智力 +8' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'essence_regen_2', description: '每回合额外恢复 2 点精华' }] }
    ]
  },
  // ==================== 唤魔者 T3：巨龙之王套装 ====================
  {
    id: 'evoker_t3',
    name: '巨龙之王套装',
    category: 'armor_set',
    parts: [
      { slot: 'helm', itemId: 'evoker_helm_t3' },
      { slot: 'chest', itemId: 'evoker_chest_t3' },
      { slot: 'gloves', itemId: 'evoker_gloves_t3' },
      { slot: 'legs', itemId: 'evoker_legs_t3' },
      { slot: 'boots', itemId: 'evoker_boots_t3' }
    ],
    classRestriction: 'evoker',
    bonusTiers: [
      { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'int', value: 12, description: '智力 +12' }] },
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'essence_regen_3', description: '每回合额外恢复 3 点精华' }] }
    ]
  }
];

/**
 * 根据套装 ID 获取套装定义
 * @param setId - 套装 ID
 * @returns 套装定义，未找到返回 undefined
 */
export function getSetDefinitionById(setId: string): ItemSet | undefined {
  return SET_DEFINITIONS.find(set => set.id === setId);
}

/**
 * 根据职业 ID 获取该职业可用的套装列表
 * @param classId - 职业 ID
 * @returns 该职业的套装数组
 */
export function getSetDefinitionsByClassId(classId: string): ItemSet[] {
  return SET_DEFINITIONS.filter(set => set.classRestriction === classId);
}
