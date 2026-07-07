/**
 * @fileoverview 职业被动技能数据（Phase 5.2）
 * @description 为 13 个职业各定义 3 个专属被动技能，共 39 个。
 *              被动技能在战斗开始时由 usePassiveSkills 加载并按触发时机执行。
 *              数据结构与 PassiveSkill 接口严格对齐。
 * @module data
 */
import type { PassiveSkill } from '@/modules/character/types';

/**
 * 全职业被动技能列表
 *
 * 设计原则：
 * 1. 每个职业 3 个被动，覆盖不同触发时机（战斗开始/攻击/受伤/低血量/被动）
 * 2. 效果类型多样化（属性修正/资源生成/减伤/治疗）
 * 3. 数值遵循 WoW 风格：百分比用小数（0.2 = 20%）
 */
export const CLASS_PASSIVES: PassiveSkill[] = [
  // ==================== 战士 ====================
  {
    id: 'warrior_iron_will',
    name: '钢铁意志',
    description: '生命低于 30% 时，受到伤害减少 20%',
    icon: 'game-icons:shield',
    classId: 'warrior',
    trigger: 'on_low_hp',
    effect: {
      type: 'damage_reduction',
      target: 'self',
      value: 0.2,
      condition: 'hp < 0.3',
    },
  },
  {
    id: 'warrior_rage_mastery',
    name: '怒气掌控',
    description: '战斗开始时获得 30 怒气',
    icon: 'game-icons:flame',
    classId: 'warrior',
    trigger: 'on_combat_start',
    effect: {
      type: 'resource_gen',
      target: 'self',
      stat: 'rage',
      value: 30,
    },
  },
  {
    id: 'warrior_bloodlust',
    name: '嗜血',
    description: '攻击命中时恢复造成伤害 5% 的生命',
    icon: 'game-icons:droplet',
    classId: 'warrior',
    trigger: 'on_attack',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.05,
    },
  },

  // ==================== 法师 ====================
  {
    id: 'mage_arcane_mastery',
    name: '奥术精通',
    description: '魔法攻击力 +10%',
    icon: 'game-icons:magic-palm',
    classId: 'mage',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'magic_attack_multiplier',
      value: 0.1,
    },
  },
  {
    id: 'mage_mana_surge',
    name: '法力涌动',
    description: '回合开始时恢复 5% 最大法力',
    icon: 'game-icons:emerald',
    classId: 'mage',
    trigger: 'on_turn_start',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'mana_regen_percent',
      value: 0.05,
    },
  },
  {
    id: 'mage_spell_critical',
    name: '法术致命',
    description: '暴击率 +5%',
    icon: 'game-icons:sparkles',
    classId: 'mage',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'crit_chance',
      value: 0.05,
    },
  },

  // ==================== 圣骑士 ====================
  {
    id: 'paladin_divine_shield',
    name: '圣光护盾',
    description: '生命低于 30% 时，受到伤害减少 25%',
    icon: 'game-icons:shield-reflect',
    classId: 'paladin',
    trigger: 'on_low_hp',
    effect: {
      type: 'damage_reduction',
      target: 'self',
      value: 0.25,
      condition: 'hp < 0.3',
    },
  },
  {
    id: 'paladin_righteousness',
    name: '正义之力',
    description: '攻击命中时恢复造成伤害 3% 的生命',
    icon: 'game-icons:holly',
    classId: 'paladin',
    trigger: 'on_attack',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.03,
    },
  },
  {
    id: 'paladin_divine_judgment',
    name: '神圣审判',
    description: '物理攻击力 +8%',
    icon: 'game-icons:warhammer',
    classId: 'paladin',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'physical_attack_multiplier',
      value: 0.08,
    },
  },

  // ==================== 猎人 ====================
  {
    id: 'hunter_precision',
    name: '精准射击',
    description: '暴击率 +8%',
    icon: 'game-icons:archery-target',
    classId: 'hunter',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'crit_chance',
      value: 0.08,
    },
  },
  {
    id: 'hunter_eagle_eye',
    name: '鹰眼',
    description: '攻击命中时额外造成 5% 物理攻击力的伤害',
    icon: 'game-icons:eye-target',
    classId: 'hunter',
    trigger: 'on_attack',
    effect: {
      type: 'stat_modifier',
      target: 'enemy',
      stat: 'bonus_physical_damage_percent',
      value: 0.05,
    },
  },
  {
    id: 'hunter_survival_instinct',
    name: '生存本能',
    description: '生命低于 30% 时闪避率 +15%',
    icon: 'game-icons:run',
    classId: 'hunter',
    trigger: 'on_low_hp',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'dodge_chance',
      value: 0.15,
      condition: 'hp < 0.3',
    },
  },

  // ==================== 潜行者 ====================
  {
    id: 'rogue_lethal_strike',
    name: '致命一击',
    description: '暴击伤害 +50%',
    icon: 'game-icons:archery-target',
    classId: 'rogue',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'crit_damage_multiplier',
      value: 0.5,
    },
  },
  {
    id: 'rogue_shadowstep',
    name: '影遁',
    description: '战斗开始时获得 2 连击点',
    icon: 'game-icons:ninja-mask',
    classId: 'rogue',
    trigger: 'on_combat_start',
    effect: {
      type: 'resource_gen',
      target: 'self',
      stat: 'combo_point',
      value: 2,
    },
  },
  {
    id: 'rogue_evasion',
    name: '闪避大师',
    description: '闪避率 +10%',
    icon: 'game-icons:dodging',
    classId: 'rogue',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'dodge_chance',
      value: 0.1,
    },
  },

  // ==================== 术士 ====================
  {
    id: 'warlock_soul_siphon',
    name: '灵魂虹吸',
    description: '击杀敌人时额外获得 1 灵魂碎片',
    icon: 'game-icons:soul',
    classId: 'warlock',
    trigger: 'on_kill',
    effect: {
      type: 'resource_gen',
      target: 'self',
      stat: 'soul_shard',
      value: 1,
    },
  },
  {
    id: 'warlock_demonic_pact',
    name: '恶魔契约',
    description: '魔法攻击力 +12%，但每回合损失 2% 最大生命',
    icon: 'game-icons:demon-claw',
    classId: 'warlock',
    trigger: 'on_turn_start',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'magic_attack_multiplier',
      value: 0.12,
    },
  },
  {
    id: 'warlock_corruption',
    name: '腐蚀术',
    description: '攻击命中时对敌人附加持续伤害效果',
    icon: 'game-icons:slime',
    classId: 'warlock',
    trigger: 'on_attack',
    effect: {
      type: 'buff',
      target: 'enemy',
      stat: 'corruption_dot',
      value: 0.05,
    },
  },

  // ==================== 德鲁伊 ====================
  {
    id: 'druid_natural_healing',
    name: '自然治愈',
    description: '回合开始时恢复 3% 最大生命',
    icon: 'game-icons:leaf-skeleton',
    classId: 'druid',
    trigger: 'on_turn_start',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.03,
    },
  },
  {
    id: 'druid_thick_hide',
    name: '厚皮',
    description: '物理防御力 +15%',
    icon: 'game-icons:crocodile',
    classId: 'druid',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'physical_defense_multiplier',
      value: 0.15,
    },
  },
  {
    id: 'druid_wild_instinct',
    name: '野性本能',
    description: '攻击命中时恢复造成伤害 4% 的生命',
    icon: 'game-icons:paw-front',
    classId: 'druid',
    trigger: 'on_attack',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.04,
    },
  },

  // ==================== 牧师 ====================
  {
    id: 'priest_faith',
    name: '信仰',
    description: '治疗加成 +15%',
    icon: 'game-icons:prayer',
    classId: 'priest',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'heal_bonus_multiplier',
      value: 0.15,
    },
  },
  {
    id: 'priest_holy_meditation',
    name: '神圣冥想',
    description: '回合开始时恢复 5% 最大法力',
    icon: 'game-icons:meditation',
    classId: 'priest',
    trigger: 'on_turn_start',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'mana_regen_percent',
      value: 0.05,
    },
  },
  {
    id: 'priest_shadow_protection',
    name: '暗影防护',
    description: '魔法防御力 +15%',
    icon: 'game-icons:shield-reflect',
    classId: 'priest',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'magic_defense_multiplier',
      value: 0.15,
    },
  },

  // ==================== 萨满 ====================
  {
    id: 'shaman_elemental_mastery',
    name: '元素掌控',
    description: '魔法攻击力 +10%',
    icon: 'game-icons:elements',
    classId: 'shaman',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'magic_attack_multiplier',
      value: 0.1,
    },
  },
  {
    id: 'shaman_ancestral_knowledge',
    name: '先祖智慧',
    description: '最大法力 +10%',
    icon: 'game-icons:spirit',
    classId: 'shaman',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'max_mana_multiplier',
      value: 0.1,
    },
  },
  {
    id: 'shaman_healing_wave',
    name: '治疗波',
    description: '回合开始时恢复 2% 最大生命',
    icon: 'game-icons:wave-crest',
    classId: 'shaman',
    trigger: 'on_turn_start',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.02,
    },
  },

  // ==================== 亡灵骑士 ====================
  {
    id: 'death_knight_undead_fortitude',
    name: '亡灵韧性',
    description: '生命低于 30% 时，受到伤害减少 25%',
    icon: 'game-icons:bone',
    classId: 'death_knight',
    trigger: 'on_low_hp',
    effect: {
      type: 'damage_reduction',
      target: 'self',
      value: 0.25,
      condition: 'hp < 0.3',
    },
  },
  {
    id: 'death_knight_blood_strike',
    name: '鲜血打击',
    description: '攻击命中时恢复造成伤害 6% 的生命',
    icon: 'game-icons:bleeding-heart',
    classId: 'death_knight',
    trigger: 'on_attack',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.06,
    },
  },
  {
    id: 'death_knight_frost_armor',
    name: '冰霜护甲',
    description: '物理防御力 +12%',
    icon: 'game-icons:ice-shield',
    classId: 'death_knight',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'physical_defense_multiplier',
      value: 0.12,
    },
  },

  // ==================== 武僧 ====================
  {
    id: 'monk_drunken_mastery',
    name: '醉拳大师',
    description: '闪避率 +12%',
    icon: 'game-icons:bottle-vapors',
    classId: 'monk',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'dodge_chance',
      value: 0.12,
    },
  },
  {
    id: 'monk_chi_flow',
    name: '真气流',
    description: '战斗开始时获得 2 真气',
    icon: 'game-icons:fist',
    classId: 'monk',
    trigger: 'on_combat_start',
    effect: {
      type: 'resource_gen',
      target: 'self',
      stat: 'chi',
      value: 2,
    },
  },
  {
    id: 'monk_relaxation',
    name: '松弛',
    description: '回合开始时恢复 3% 最大生命',
    icon: 'game-icons:meditation',
    classId: 'monk',
    trigger: 'on_turn_start',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.03,
    },
  },

  // ==================== 影刃猎手 ====================
  {
    id: 'demon_hunter_demonic_sight',
    name: '恶魔之眼',
    description: '暴击率 +10%',
    icon: 'game-icons:eye-of-horus',
    classId: 'demon_hunter',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'crit_chance',
      value: 0.1,
    },
  },
  {
    id: 'demon_hunter_vengeance',
    name: '复仇',
    description: '受到伤害时恢复 5% 最大生命',
    icon: 'game-icons:reticule',
    classId: 'demon_hunter',
    trigger: 'on_damaged',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.05,
    },
  },
  {
    id: 'demon_hunter_illidari_resolve',
    name: '伊利达雷决心',
    description: '生命低于 30% 时物理攻击力 +20%',
    icon: 'game-icons:demon-claw',
    classId: 'demon_hunter',
    trigger: 'on_low_hp',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'physical_attack_multiplier',
      value: 0.2,
      condition: 'hp < 0.3',
    },
  },

  // ==================== 龙脉术士 ====================
  {
    id: 'evoker_essence_burst',
    name: '精华迸发',
    description: '魔法攻击力 +12%',
    icon: 'game-icons:dragon-head',
    classId: 'evoker',
    trigger: 'passive',
    effect: {
      type: 'stat_modifier',
      target: 'self',
      stat: 'magic_attack_multiplier',
      value: 0.12,
    },
  },
  {
    id: 'evoker_dragons_breath',
    name: '龙息',
    description: '攻击命中时额外造成 8% 魔法攻击力的伤害',
    icon: 'game-icons:fire-breath',
    classId: 'evoker',
    trigger: 'on_attack',
    effect: {
      type: 'stat_modifier',
      target: 'enemy',
      stat: 'bonus_magic_damage_percent',
      value: 0.08,
    },
  },
  {
    id: 'evoker_verdant_embrace',
    name: '翠绿拥抱',
    description: '回合开始时恢复 4% 最大生命',
    icon: 'game-icons:leaf-skeleton',
    classId: 'evoker',
    trigger: 'on_turn_start',
    effect: {
      type: 'heal',
      target: 'self',
      value: 0.04,
    },
  },
];

/**
 * 根据职业 ID 获取其专属被动技能列表
 * @param classId - 职业 ID
 * @returns 该职业的被动技能数组（通常为 3 个）
 */
export function getPassivesByClassId(classId: string): PassiveSkill[] {
  return CLASS_PASSIVES.filter(p => p.classId === classId);
}
