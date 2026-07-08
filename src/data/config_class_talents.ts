/**
 * @fileoverview 职业天赋树数据（Phase 6.2）
 * @description 为 13 个核心职业各定义 3 系天赋树，每系含 3 层天赋节点。
 *              玩家通过分配天赋点数激活属性加成和特殊效果。
 *              天赋效果由 talents/service.ts 计算并应用到角色属性。
 * @module data
 */
import type { TalentTree } from '@/modules/character/talents/types';

/**
 * 全职业天赋树列表
 *
 * 设计原则：
 * 1. 每个职业 3 系天赋，对应不同的玩法方向（如战士：武器/狂怒/防护）
 * 2. 每系天赋 3 层，需逐层解锁（tier2 需该系投入 3 点，tier3 需 6 点）
 * 3. 每个天赋 maxRank 为 3，单系最多投入 9 点
 * 4. 效果涵盖属性加成、伤害倍率、暴击、资源加成等
 */
export const CLASS_TALENT_TREES: TalentTree[] = [
  // ============================================================
  // 战士：武器 / 狂怒 / 防护
  // ============================================================
  {
    id: 'warrior_arms',
    name: '武器',
    classId: 'warrior',
    icon: 'game-icons:broadsword',
    description: '精通各类武器，以致命一击终结敌人',
    talents: [
      {
        id: 'warrior_arms_t1', name: '武器专精', description: '每级提升 3 点力量',
        icon: 'game-icons:muscle-up', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'warrior_arms_t2', name: '重伤', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:bleeding-wound', tier: 2, maxRank: 3,
        requires: ['warrior_arms_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05, description: '物理伤害提升' }]
      },
      {
        id: 'warrior_arms_t3', name: '致死打击', description: '每级提升 3% 暴击率',
        icon: 'game-icons:targeted', tier: 3, maxRank: 3,
        requires: ['warrior_arms_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03, description: '暴击率提升' }]
      }
    ]
  },
  {
    id: 'warrior_fury',
    name: '狂怒',
    classId: 'warrior',
    icon: 'game-icons:berserk',
    description: '以怒气驱动狂暴攻击，越战越勇',
    talents: [
      {
        id: 'warrior_fury_t1', name: '怒气掌控', description: '每级提升 10 点怒气上限',
        icon: 'game-icons:fire', tier: 1, maxRank: 3,
        effects: [{ type: 'resource_bonus', stat: 'rage_max', valuePerRank: 10 }]
      },
      {
        id: 'warrior_fury_t2', name: '嗜血', description: '每级提升 4% 物理伤害',
        icon: 'game-icons:droplet', tier: 2, maxRank: 3,
        requires: ['warrior_fury_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      },
      {
        id: 'warrior_fury_t3', name: '狂暴', description: '每级提升 5% 暴击伤害',
        icon: 'game-icons:rage', tier: 3, maxRank: 3,
        requires: ['warrior_fury_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.05, description: '暴击伤害提升' }]
      }
    ]
  },
  {
    id: 'warrior_protection',
    name: '防护',
    classId: 'warrior',
    icon: 'game-icons:shield',
    description: '坚不可摧的防御者，守护盟友',
    talents: [
      {
        id: 'warrior_prot_t1', name: '盾牌 mastery', description: '每级提升 3 点体质',
        icon: 'game-icons:shield', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'warrior_prot_t2', name: '坚韧', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:stone-block', tier: 2, maxRank: 3,
        requires: ['warrior_prot_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'warrior_prot_t3', name: '壁垒', description: '每级提升 5% 生命上限',
        icon: 'game-icons:castle', tier: 3, maxRank: 3,
        requires: ['warrior_prot_t2'],
        effects: [{ type: 'stat_bonus', stat: 'hp_max', valuePerRank: 0.05 }]
      }
    ]
  },

  // ============================================================
  // 法师：奥术 / 火焰 / 冰霜
  // ============================================================
  {
    id: 'mage_arcane',
    name: '奥术',
    classId: 'mage',
    icon: 'game-icons:crystal-wand',
    description: '掌控奥术能量，施展毁灭性法术',
    talents: [
      {
        id: 'mage_arcane_t1', name: '奥术专注', description: '每级提升 3 点智力',
        icon: 'game-icons:brain', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'mage_arcane_t2', name: '法力涌动', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:lightning', tier: 2, maxRank: 3,
        requires: ['mage_arcane_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'mage_arcane_t3', name: '奥术强化', description: '每级提升 10% 法力上限',
        icon: 'game-icons:sparkles', tier: 3, maxRank: 3,
        requires: ['mage_arcane_t2'],
        effects: [{ type: 'resource_bonus', stat: 'mana_max', valuePerRank: 0.10 }]
      }
    ]
  },
  {
    id: 'mage_fire',
    name: '火焰',
    classId: 'mage',
    icon: 'game-icons:fire',
    description: '召唤烈焰焚烧一切敌人',
    talents: [
      {
        id: 'mage_fire_t1', name: '点燃', description: '每级提升 4% 火焰伤害',
        icon: 'game-icons:flame', tier: 1, maxRank: 3,
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      },
      {
        id: 'mage_fire_t2', name: '燃烧', description: '每级提升 3% 暴击率',
        icon: 'game-icons:fire-zone', tier: 2, maxRank: 3,
        requires: ['mage_fire_t1'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03 }]
      },
      {
        id: 'mage_fire_t3', name: '烈焰风暴', description: '每级提升 6% 魔法伤害',
        icon: 'game-icons:meteor', tier: 3, maxRank: 3,
        requires: ['mage_fire_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      }
    ]
  },
  {
    id: 'mage_frost',
    name: '冰霜',
    classId: 'mage',
    icon: 'game-icons:snowflake',
    description: '操控寒冰冻结并减速敌人',
    talents: [
      {
        id: 'mage_frost_t1', name: '寒冰护体', description: '每级提升 3 点智力',
        icon: 'game-icons:ice-shield', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'mage_frost_t2', name: '冰冻', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:snowflake-1', tier: 2, maxRank: 3,
        requires: ['mage_frost_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      },
      {
        id: 'mage_frost_t3', name: '冰封寒odian', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:icicles', tier: 3, maxRank: 3,
        requires: ['mage_frost_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      }
    ]
  },

  // ============================================================
  // 圣骑士：神圣 / 防护 / 惩戒
  // ============================================================
  {
    id: 'paladin_holy',
    name: '神圣',
    classId: 'paladin',
    icon: 'game-icons:holy-grail',
    description: '以圣光之力治愈盟友、驱逐邪恶',
    talents: [
      {
        id: 'paladin_holy_t1', name: '圣光祝福', description: '每级提升 3 点智慧',
        icon: 'game-icons:prayer', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'paladin_holy_t2', name: '神圣治疗', description: '每级提升 8% 治疗效果',
        icon: 'game-icons:health-normal', tier: 2, maxRank: 3,
        requires: ['paladin_holy_t1'],
        effects: [{ type: 'special', valuePerRank: 0.08, description: '治疗效果提升' }]
      },
      {
        id: 'paladin_holy_t3', name: '圣光闪耀', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:lightning-shadow', tier: 3, maxRank: 3,
        requires: ['paladin_holy_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'paladin_protection',
    name: '防护',
    classId: 'paladin',
    icon: 'game-icons:templar-shield',
    description: '圣盾守护，坚不可摧的防御者',
    talents: [
      {
        id: 'paladin_prot_t1', name: '盾牌壁垒', description: '每级提升 3 点体质',
        icon: 'game-icons:shield', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'paladin_prot_t2', name: '圣盾术', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 2, maxRank: 3,
        requires: ['paladin_prot_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'paladin_prot_t3', name: '正义之盾', description: '每级提升 4% 物理伤害',
        icon: 'game-icons:crossed-swords', tier: 3, maxRank: 3,
        requires: ['paladin_prot_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'paladin_retribution',
    name: '惩戒',
    classId: 'paladin',
    icon: 'game-icons:warhammer',
    description: '以圣光之名审判邪恶',
    talents: [
      {
        id: 'paladin_ret_t1', name: '力量祝福', description: '每级提升 3 点力量',
        icon: 'game-icons:muscle-up', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'paladin_ret_t2', name: '十字军打击', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:cross-flare', tier: 2, maxRank: 3,
        requires: ['paladin_ret_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'paladin_ret_t3', name: '复仇之怒', description: '每级提升 4% 暴击伤害',
        icon: 'game-icons:rage', tier: 3, maxRank: 3,
        requires: ['paladin_ret_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },

  // ============================================================
  // 猎人：野兽掌握 / 射击 / 生存
  // ============================================================
  {
    id: 'hunter_beast',
    name: '野兽掌握',
    classId: 'hunter',
    icon: 'game-icons:wolf-head',
    description: '与野兽为伴，驯服荒野之王',
    talents: [
      {
        id: 'hunter_beast_t1', name: '野兽训练', description: '每级提升 3 点敏捷',
        icon: 'game-icons:paw', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 3 }]
      },
      {
        id: 'hunter_beast_t2', name: '野性守护', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:beast-eye', tier: 2, maxRank: 3,
        requires: ['hunter_beast_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      },
      {
        id: 'hunter_beast_t3', name: '狂野怒火', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:werewolf', tier: 3, maxRank: 3,
        requires: ['hunter_beast_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'hunter_marksmanship',
    name: '射击',
    classId: 'hunter',
    icon: 'game-icons:archery-target',
    description: '精准的远程射手，箭无虚发',
    talents: [
      {
        id: 'hunter_marks_t1', name: '精准射击', description: '每级提升 3% 暴击率',
        icon: 'game-icons:targeted', tier: 1, maxRank: 3,
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03 }]
      },
      {
        id: 'hunter_marks_t2', name: '致命射击', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:high-shot', tier: 2, maxRank: 3,
        requires: ['hunter_marks_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'hunter_marks_t3', name: '狙击', description: '每级提升 5% 暴击伤害',
        icon: 'game-icons:crosshair', tier: 3, maxRank: 3,
        requires: ['hunter_marks_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.05, description: '暴击伤害提升' }]
      }
    ]
  },
  {
    id: 'hunter_survival',
    name: '生存',
    classId: 'hunter',
    icon: 'game-icons:camping-tent',
    description: '荒野求生专家，近战与陷阱大师',
    talents: [
      {
        id: 'hunter_surv_t1', name: '野外生存', description: '每级提升 3 点体质',
        icon: 'game-icons:health-normal', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'hunter_surv_t2', name: '陷阱掌握', description: '每级提升 4% 物理伤害',
        icon: 'game-icons:bear-trap', tier: 2, maxRank: 3,
        requires: ['hunter_surv_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      },
      {
        id: 'hunter_surv_t3', name: '生存本能', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:run', tier: 3, maxRank: 3,
        requires: ['hunter_surv_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      }
    ]
  },

  // ============================================================
  // 潜行者：刺杀 / 战斗 / 敏锐
  // ============================================================
  {
    id: 'rogue_assassination',
    name: '刺杀',
    classId: 'rogue',
    icon: 'game-icons:curved-knife',
    description: '致命毒药与精准刺杀',
    talents: [
      {
        id: 'rogue_assn_t1', name: '毒药精通', description: '每级提升 3 点敏捷',
        icon: 'game-icons:poison', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 3 }]
      },
      {
        id: 'rogue_assn_t2', name: '致命毒药', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:droplet', tier: 2, maxRank: 3,
        requires: ['rogue_assn_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'rogue_assn_t3', name: ' assassination', description: '每级提升 4% 暴击率',
        icon: 'game-icons:skull', tier: 3, maxRank: 3,
        requires: ['rogue_assn_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'rogue_combat',
    name: '战斗',
    classId: 'rogue',
    icon: 'game-icons:crossed-swords',
    description: '双持武器的近战大师',
    talents: [
      {
        id: 'rogue_combat_t1', name: '双武器', description: '每级提升 3 点敏捷',
        icon: 'game-icons:double-quaver', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 3 }]
      },
      {
        id: 'rogue_combat_t2', name: '剑刃乱舞', description: '每级提升 4% 物理伤害',
        icon: 'game-icons:spinning-swords', tier: 2, maxRank: 3,
        requires: ['rogue_combat_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      },
      {
        id: 'rogue_combat_t3', name: '活力', description: '每级提升 5 点能量上限',
        icon: 'game-icons:lightning', tier: 3, maxRank: 3,
        requires: ['rogue_combat_t2'],
        effects: [{ type: 'resource_bonus', stat: 'energy_max', valuePerRank: 5 }]
      }
    ]
  },
  {
    id: 'rogue_subtlety',
    name: '敏锐',
    classId: 'rogue',
    icon: 'game-icons:ninja-mask',
    description: '阴影中的刺客，一击必杀',
    talents: [
      {
        id: 'rogue_sub_t1', name: '潜行', description: '每级提升 4% 暴击率',
        icon: 'game-icons:shadow', tier: 1, maxRank: 3,
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      },
      {
        id: 'rogue_sub_t2', name: '伏击', description: '每级提升 6% 暴击伤害',
        icon: 'game-icons:backstab', tier: 2, maxRank: 3,
        requires: ['rogue_sub_t1'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.06, description: '暴击伤害提升' }]
      },
      {
        id: 'rogue_sub_t3', name: '暗影之舞', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:dance', tier: 3, maxRank: 3,
        requires: ['rogue_sub_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      }
    ]
  },

  // ============================================================
  // 术士：痛苦 / 恶魔 / 毁灭
  // ============================================================
  {
    id: 'warlock_affliction',
    name: '痛苦',
    classId: 'warlock',
    icon: 'game-icons:tormented',
    description: '持续伤害与诅咒大师',
    talents: [
      {
        id: 'warlock_aff_t1', name: '诅咒增幅', description: '每级提升 3 点智力',
        icon: 'game-icons:curse', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'warlock_aff_t2', name: '腐蚀', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:slime', tier: 2, maxRank: 3,
        requires: ['warlock_aff_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'warlock_aff_t3', name: '痛苦无常', description: '每级提升 1 个灵魂碎片上限',
        icon: 'game-icons:soul', tier: 3, maxRank: 3,
        requires: ['warlock_aff_t2'],
        effects: [{ type: 'resource_bonus', stat: 'soul_shard_max', valuePerRank: 1 }]
      }
    ]
  },
  {
    id: 'warlock_demonology',
    name: '恶魔',
    classId: 'warlock',
    icon: 'game-icons:demon',
    description: '召唤并掌控恶魔力量',
    talents: [
      {
        id: 'warlock_demon_t1', name: '恶魔掌控', description: '每级提升 3 点智力',
        icon: 'game-icons:devil', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'warlock_demon_t2', name: '恶魔韧性', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:demon-claw', tier: 2, maxRank: 3,
        requires: ['warlock_demon_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      },
      {
        id: 'warlock_demon_t3', name: '恶魔变形', description: '每级提升 6% 魔法伤害',
        icon: 'game-icons:transmutation', tier: 3, maxRank: 3,
        requires: ['warlock_demon_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      }
    ]
  },
  {
    id: 'warlock_destruction',
    name: '毁灭',
    classId: 'warlock',
    icon: 'game-icons:fire',
    description: '毁灭性的火焰与混乱法术',
    talents: [
      {
        id: 'warlock_dest_t1', name: '毁灭打击', description: '每级提升 4% 魔法伤害',
        icon: 'game-icons:meteor', tier: 1, maxRank: 3,
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      },
      {
        id: 'warlock_dest_t2', name: '燃烧', description: '每级提升 3% 暴击率',
        icon: 'game-icons:flame', tier: 2, maxRank: 3,
        requires: ['warlock_dest_t1'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03 }]
      },
      {
        id: 'warlock_dest_t3', name: '混乱之箭', description: '每级提升 6% 魔法伤害',
        icon: 'game-icons:chaos', tier: 3, maxRank: 3,
        requires: ['warlock_dest_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      }
    ]
  },

  // ============================================================
  // 牧师：神圣 / 暗影 / 戒律
  // ============================================================
  {
    id: 'priest_holy',
    name: '神圣',
    classId: 'priest',
    icon: 'game-icons:holy-grail',
    description: '圣光的治愈者',
    talents: [
      {
        id: 'priest_holy_t1', name: '神圣之力', description: '每级提升 3 点智慧',
        icon: 'game-icons:prayer', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'priest_holy_t2', name: '强化治疗', description: '每级提升 8% 治疗效果',
        icon: 'game-icons:health-normal', tier: 2, maxRank: 3,
        requires: ['priest_holy_t1'],
        effects: [{ type: 'special', valuePerRank: 0.08, description: '治疗效果提升' }]
      },
      {
        id: 'priest_holy_t3', name: '圣光涌动', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:lightning-shadow', tier: 3, maxRank: 3,
        requires: ['priest_holy_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'priest_shadow',
    name: '暗影',
    classId: 'priest',
    icon: 'game-icons:shadow',
    description: '暗影力量的使用者',
    talents: [
      {
        id: 'priest_shadow_t1', name: '暗影形态', description: '每级提升 3 点智力',
        icon: 'game-icons:shadow', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'priest_shadow_t2', name: '精神恐慌', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:terror', tier: 2, maxRank: 3,
        requires: ['priest_shadow_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'priest_shadow_t3', name: '暗影之语', description: '每级提升 4% 暴击率',
        icon: 'game-icons:whirlpool', tier: 3, maxRank: 3,
        requires: ['priest_shadow_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'priest_discipline',
    name: '戒律',
    classId: 'priest',
    icon: 'game-icons:scroll',
    description: '苦修与盾的践行者',
    talents: [
      {
        id: 'priest_disc_t1', name: '坚韧', description: '每级提升 3 点体质',
        icon: 'game-icons:stone-block', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'priest_disc_t2', name: '护盾', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:shield', tier: 2, maxRank: 3,
        requires: ['priest_disc_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      },
      {
        id: 'priest_disc_t3', name: '苦修', description: '每级提升 6% 治疗效果',
        icon: 'game-icons:prayer', tier: 3, maxRank: 3,
        requires: ['priest_disc_t2'],
        effects: [{ type: 'special', valuePerRank: 0.06, description: '治疗效果提升' }]
      }
    ]
  },

  // ============================================================
  // 萨满：元素 / 增强 / 恢复
  // ============================================================
  {
    id: 'shaman_elemental',
    name: '元素',
    classId: 'shaman',
    icon: 'game-icons:lightning-storm',
    description: '元素之力的掌控者',
    talents: [
      {
        id: 'shaman_elem_t1', name: '元素掌握', description: '每级提升 3 点智慧',
        icon: 'game-icons:lightning', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'shaman_elem_t2', name: '闪电链', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:chain-lightning', tier: 2, maxRank: 3,
        requires: ['shaman_elem_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'shaman_elem_t3', name: '元素之怒', description: '每级提升 4% 暴击率',
        icon: 'game-icons:fire', tier: 3, maxRank: 3,
        requires: ['shaman_elem_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'shaman_enhancement',
    name: '增强',
    classId: 'shaman',
    icon: 'game-icons:hammer',
    description: '近战与图腾的强化者',
    talents: [
      {
        id: 'shaman_enh_t1', name: '武器增强', description: '每级提升 3 点力量',
        icon: 'game-icons:warhammer', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'shaman_enh_t2', name: '风暴打击', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:lightning-storm', tier: 2, maxRank: 3,
        requires: ['shaman_enh_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'shaman_enh_t3', name: '幽魂之狼', description: '每级提升 3% 暴击率',
        icon: 'game-icons:wolf-head', tier: 3, maxRank: 3,
        requires: ['shaman_enh_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03 }]
      }
    ]
  },
  {
    id: 'shaman_restoration',
    name: '恢复',
    classId: 'shaman',
    icon: 'game-icons:health-normal',
    description: '自然之力的治愈者',
    talents: [
      {
        id: 'shaman_rest_t1', name: '治愈之泉', description: '每级提升 3 点智慧',
        icon: 'game-icons:water-drop', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'shaman_rest_t2', name: '强效治疗', description: '每级提升 8% 治疗效果',
        icon: 'game-icons:health-normal', tier: 2, maxRank: 3,
        requires: ['shaman_rest_t1'],
        effects: [{ type: 'special', valuePerRank: 0.08, description: '治疗效果提升' }]
      },
      {
        id: 'shaman_rest_t3', name: '自然守护', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:leaf', tier: 3, maxRank: 3,
        requires: ['shaman_rest_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      }
    ]
  },

  // ============================================================
  // 德鲁伊：平衡 / 野性 / 恢复
  // ============================================================
  {
    id: 'druid_balance',
    name: '平衡',
    classId: 'druid',
    icon: 'game-icons:moon',
    description: '月亮与星辰之力',
    talents: [
      {
        id: 'druid_bal_t1', name: '星辰之力', description: '每级提升 3 点智力',
        icon: 'game-icons:star', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'druid_bal_t2', name: '月火术', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:moon', tier: 2, maxRank: 3,
        requires: ['druid_bal_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'druid_bal_t3', name: '星辰坠落', description: '每级提升 4% 暴击率',
        icon: 'game-icons:falling-star', tier: 3, maxRank: 3,
        requires: ['druid_bal_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'druid_feral',
    name: '野性',
    classId: 'druid',
    icon: 'game-icons:werewolf',
    description: '野兽形态的近战大师',
    talents: [
      {
        id: 'druid_feral_t1', name: '野性之力', description: '每级提升 3 点力量',
        icon: 'game-icons:paw', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'druid_feral_t2', name: '撕裂', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:claw', tier: 2, maxRank: 3,
        requires: ['druid_feral_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'druid_feral_t3', name: '狂暴', description: '每级提升 3% 暴击率',
        icon: 'game-icons:rage', tier: 3, maxRank: 3,
        requires: ['druid_feral_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03 }]
      }
    ]
  },
  {
    id: 'druid_restoration',
    name: '恢复',
    classId: 'druid',
    icon: 'game-icons:leaf',
    description: '自然的治愈者',
    talents: [
      {
        id: 'druid_rest_t1', name: '自然愈合', description: '每级提升 3 点智慧',
        icon: 'game-icons:leaf', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'druid_rest_t2', name: '回春术', description: '每级提升 8% 治疗效果',
        icon: 'game-icons:plant-root', tier: 2, maxRank: 3,
        requires: ['druid_rest_t1'],
        effects: [{ type: 'special', valuePerRank: 0.08, description: '治疗效果提升' }]
      },
      {
        id: 'druid_rest_t3', name: '生命之树', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:tree', tier: 3, maxRank: 3,
        requires: ['druid_rest_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      }
    ]
  },

  // ============================================================
  // 亡灵骑士：鲜血 / 冰霜 / 邪恶
  // ============================================================
  {
    id: 'dk_blood',
    name: '鲜血',
    classId: 'death_knight',
    icon: 'game-icons:droplet',
    description: '鲜血之力驱动的死亡骑士',
    talents: [
      {
        id: 'dk_blood_t1', name: '鲜血之力', description: '每级提升 3 点力量',
        icon: 'game-icons:droplet', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'dk_blood_t2', name: '吸血', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:veins', tier: 2, maxRank: 3,
        requires: ['dk_blood_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'dk_blood_t3', name: '血之疫', description: '每级减免 2% 受到的伤害',
        icon: 'game-icons:bleeding-wound', tier: 3, maxRank: 3,
        requires: ['dk_blood_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.02 }]
      }
    ]
  },
  {
    id: 'dk_frost',
    name: '冰霜',
    classId: 'death_knight',
    icon: 'game-icons:snowflake',
    description: '寒冰之力的死亡骑士',
    talents: [
      {
        id: 'dk_frost_t1', name: '冰霜之力', description: '每级提升 3 点力量',
        icon: 'game-icons:snowflake', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'dk_frost_t2', name: '冰霜打击', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:icicles', tier: 2, maxRank: 3,
        requires: ['dk_frost_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'dk_frost_t3', name: '湮没', description: '每级提升 4% 暴击率',
        icon: 'game-icons:broken-heart', tier: 3, maxRank: 3,
        requires: ['dk_frost_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'dk_unholy',
    name: '邪恶',
    classId: 'death_knight',
    icon: 'game-icons:skull',
    description: '亡灵与疾病的掌控者',
    talents: [
      {
        id: 'dk_unholy_t1', name: '亡灵掌握', description: '每级提升 3 点智力',
        icon: 'game-icons:skull', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'dk_unholy_t2', name: '疾病', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:plague', tier: 2, maxRank: 3,
        requires: ['dk_unholy_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'dk_unholy_t3', name: '亡灵召唤', description: '每级提升 4% 暴击率',
        icon: 'game-icons: Raise-zombie', tier: 3, maxRank: 3,
        requires: ['dk_unholy_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },

  // ============================================================
  // 武僧：酒仙 / 踏风 / 织雾
  // ============================================================
  {
    id: 'monk_brewmaster',
    name: '酒仙',
    classId: 'monk',
    icon: 'game-icons:beer Stein',
    description: '以酒为力的坦克',
    talents: [
      {
        id: 'monk_brew_t1', name: '醉拳', description: '每级提升 3 点体质',
        icon: 'game-icons:beer-stein', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'monk_brew_t2', name: '壮胆酒', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:flagon', tier: 2, maxRank: 3,
        requires: ['monk_brew_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'monk_brew_t3', name: '酒火', description: '每级提升 4% 物理伤害',
        icon: 'game-icons:fire', tier: 3, maxRank: 3,
        requires: ['monk_brew_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'monk_windwalker',
    name: '踏风',
    classId: 'monk',
    icon: 'game-icons:wind',
    description: '风之武僧，近战输出',
    talents: [
      {
        id: 'monk_ww_t1', name: '虎拳', description: '每级提升 3 点敏捷',
        icon: 'game-icons:paw', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 3 }]
      },
      {
        id: 'monk_ww_t2', name: '旭日东升', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:sun', tier: 2, maxRank: 3,
        requires: ['monk_ww_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'monk_ww_t3', name: '真气爆裂', description: '每级提升 1 点真气上限',
        icon: 'game-icons:spirit', tier: 3, maxRank: 3,
        requires: ['monk_ww_t2'],
        effects: [{ type: 'resource_bonus', stat: 'chi_max', valuePerRank: 1 }]
      }
    ]
  },
  {
    id: 'monk_mistweaver',
    name: '织雾',
    classId: 'monk',
    icon: 'game-icons:windsock',
    description: '迷雾之武僧，治疗者',
    talents: [
      {
        id: 'monk_mw_t1', name: '抚慰之雾', description: '每级提升 3 点智慧',
        icon: 'game-icons:wind', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'monk_mw_t2', name: '复苏之雾', description: '每级提升 8% 治疗效果',
        icon: 'game-icons:windsock', tier: 2, maxRank: 3,
        requires: ['monk_mw_t1'],
        effects: [{ type: 'special', valuePerRank: 0.08, description: '治疗效果提升' }]
      },
      {
        id: 'monk_mw_t3', name: '真气贯通', description: '每级提升 4% 魔法伤害',
        icon: 'game-icons:spirit', tier: 3, maxRank: 3,
        requires: ['monk_mw_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      }
    ]
  },

  // ============================================================
  // 恶魔猎手：复仇 / 浩劫
  // ============================================================
  {
    id: 'dh_vengeance',
    name: '复仇',
    classId: 'demon_hunter',
    icon: 'game-icons:shield',
    description: '恶魔之力的坦克',
    talents: [
      {
        id: 'dh_venge_t1', name: '恶魔韧性', description: '每级提升 3 点体质',
        icon: 'game-icons:stone-block', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'dh_venge_t2', name: '痛苦', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:tormented', tier: 2, maxRank: 3,
        requires: ['dh_venge_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'dh_venge_t3', name: '恶魔变形', description: '每级提升 4% 物理伤害',
        icon: 'game-icons:transmutation', tier: 3, maxRank: 3,
        requires: ['dh_venge_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.04 }]
      }
    ]
  },
  {
    id: 'dh_havoc',
    name: '浩劫',
    classId: 'demon_hunter',
    icon: 'game-icons:crossed-swords',
    description: '恶魔之力的输出',
    talents: [
      {
        id: 'dh_havoc_t1', name: '恶魔之牙', description: '每级提升 3 点敏捷',
        icon: 'game-icons:demon-claw', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 3 }]
      },
      {
        id: 'dh_havoc_t2', name: '混乱打击', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:chaos', tier: 2, maxRank: 3,
        requires: ['dh_havoc_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'dh_havoc_t3', name: '眼棱', description: '每级提升 4% 暴击率',
        icon: 'game-icons:eye', tier: 3, maxRank: 3,
        requires: ['dh_havoc_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.04 }]
      }
    ]
  },
  // 项目自定义：恶魔猎手第三系为通用补充系，非 WoW 正式服设定
  // （WoW 正式服恶魔猎手仅有 Havoc/Vengeance 两系，此处补充第三系以保证天赋树结构统一）
  {
    id: 'dh_fel',
    name: '邪能',
    classId: 'demon_hunter',
    icon: 'game-icons:fire',
    description: '邪能之力强化',
    talents: [
      {
        id: 'dh_fel_t1', name: '邪能之血', description: '每级提升 3 点力量',
        icon: 'game-icons:fire', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'dh_fel_t2', name: '邪能爆发', description: '每级提升 5% 物理伤害',
        icon: 'game-icons:explosion', tier: 2, maxRank: 3,
        requires: ['dh_fel_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05 }]
      },
      {
        id: 'dh_fel_t3', name: '邪能之刃', description: '每级提升 3% 暴击率',
        icon: 'game-icons:sword-spin', tier: 3, maxRank: 3,
        requires: ['dh_fel_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03 }]
      }
    ]
  },

  // ============================================================
  // 唤魔者：毁灭 / 护佑 / 增辉
  // ============================================================
  {
    id: 'evoker_devastation',
    name: '毁灭',
    classId: 'evoker',
    icon: 'game-icons:dragon-head',
    description: '驾驭龙族之力，释放毁灭性魔法',
    talents: [
      {
        id: 'evoker_dev_t1', name: '龙族智慧', description: '每级提升 3 点智力',
        icon: 'game-icons:brain', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'evoker_dev_t2', name: '毁灭吐息', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:fire-breath', tier: 2, maxRank: 3,
        requires: ['evoker_dev_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_dev_t3', name: '永恒之眼', description: '每级提升 3% 暴击率',
        icon: 'game-icons:eye', tier: 3, maxRank: 3,
        requires: ['evoker_dev_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.03, description: '暴击率提升' }]
      }
    ]
  },
  {
    id: 'evoker_preservation',
    name: '护佑',
    classId: 'evoker',
    icon: 'game-icons:shield',
    description: '守护盟友，以龙族生命力为盾',
    talents: [
      {
        id: 'evoker_pres_t1', name: '龙鳞护体', description: '每级提升 3 点感知',
        icon: 'game-icons:dragon-shield', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 3 }]
      },
      {
        id: 'evoker_pres_t2', name: '巨龙坚韧', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 2, maxRank: 3,
        requires: ['evoker_pres_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'evoker_pres_t3', name: '生命赐福', description: '每级提升 5% 生命上限',
        icon: 'game-icons:health-normal', tier: 3, maxRank: 3,
        requires: ['evoker_pres_t2'],
        effects: [{ type: 'stat_bonus', stat: 'hp_max', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'evoker_augmentation',
    name: '增辉',
    classId: 'evoker',
    icon: 'game-icons:sparkles',
    description: '增幅盟友之力，强化团队战力',
    talents: [
      {
        id: 'evoker_aug_t1', name: '奥术共鸣', description: '每级提升 3 点智力',
        icon: 'game-icons:crystal-wand', tier: 1, maxRank: 3,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'evoker_aug_t2', name: '能量灌注', description: '每级提升 5% 魔法伤害',
        icon: 'game-icons:lightning', tier: 2, maxRank: 3,
        requires: ['evoker_aug_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.05, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_aug_t3', name: '致命共鸣', description: '每级提升 5% 暴击伤害',
        icon: 'game-icons:targeted', tier: 3, maxRank: 3,
        requires: ['evoker_aug_t2'],
        effects: [{ type: 'crit_bonus', valuePerRank: 0.05, description: '暴击伤害提升' }]
      }
    ]
  }
];

/**
 * 根据职业 ID 获取该职业的所有天赋树
 * @param classId - 职业 ID
 * @returns 该职业的天赋树数组
 */
export function getTalentTreesByClassId(classId: string): TalentTree[] {
  return CLASS_TALENT_TREES.filter(tree => tree.classId === classId);
}

/**
 * 根据天赋树 ID 获取天赋树
 * @param treeId - 天赋树 ID
 * @returns 天赋树定义，未找到返回 undefined
 */
export function getTalentTreeById(treeId: string): TalentTree | undefined {
  return CLASS_TALENT_TREES.find(tree => tree.id === treeId);
}

/**
 * 根据天赋 ID 获取天赋节点
 * @param talentId - 天赋 ID
 * @returns 天赋节点定义，未找到返回 undefined
 */
export function getTalentById(talentId: string): { talent: import('@/modules/character/talents/types').Talent; tree: TalentTree } | undefined {
  for (const tree of CLASS_TALENT_TREES) {
    const talent = tree.talents.find(t => t.id === talentId);
    if (talent) {
      return { talent, tree };
    }
  }
  return undefined;
}
