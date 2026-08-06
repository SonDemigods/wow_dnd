/**
 * @fileoverview 职业天赋树数据（Phase 6.2 重构版）
 * @description 为 13 个核心职业各定义 1 棵合并天赋树，每棵含 18 个天赋节点（6 行 × 3 列）。
 *              玩家通过分配天赋点数激活属性加成和特殊效果。
 *              天赋效果由 talents/service.ts 计算并应用到角色属性。
 *
 * 重构变更：
 * - 每个职业从 3 系独立天赋树合并为 1 棵 18 节点天赋树（6 行 × 3 列）
 * - maxRank 从 3 改为 2（行 1-5）或 1（行 6 终极天赋）
 * - crit_bonus 转为 stat_bonus（主属性），hp_multiplier 转为 stat_bonus（体质），
 *   resource_bonus(mana_max) 转为 stat_bonus（智力）
 * - resource_bonus 非 mana 类（rage_max/energy_max/soul_shard_max/chi_max）保持不变
 * - damage_multiplier/damage_reduction/healing_multiplier/skill_enhance/unlock_pet 保持不变
 * - 猎人野兽列 T4-T6 保留 unlock_pet 效果（猫/野猪/魔暴龙）
 * @module data
 */
import type { TalentTree } from '@/modules/character/talents/types';

/**
 * 全职业天赋树列表
 *
 * 设计原则：
 * 1. 每个职业 1 棵合并天赋树，包含 3 个分支方向（如战士：武器/狂怒/防护）
 * 2. 每棵树 18 个节点，6 行 × 3 列，需逐行解锁
 * 3. 行 1-5 的 maxRank 为 2，行 6 终极天赋 maxRank 为 1
 * 4. 行 2-3 仅需同列上一行节点；行 4-5 可额外跨列依赖 1 个上一行节点（每列不超过 2 个跨列依赖）
 * 5. 效果涵盖属性加成、伤害倍率、伤害减免、治疗倍率、资源加成、宠物解锁等
 */
export const CLASS_TALENT_TREES: TalentTree[] = [
  {
    id: 'warrior', name: '战士', classId: 'warrior',
    icon: 'game-icons:broadsword', description: '精通武器、狂怒与防护，以力量与怒气为驱动的全能战士',
    talents: [
      {
        id: 'warrior_arms_t1', name: '武器专精', description: '每级提升 5 点力量',
        icon: 'game-icons:muscle-up', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'warrior_fury_t1', name: '怒气掌控', description: '每级提升 15 点怒气上限',
        icon: 'game-icons:fire', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'resource_bonus', stat: 'rage_max', valuePerRank: 15 }]
      },
      {
        id: 'warrior_prot_t1', name: '盾牌专精', description: '每级提升 5 点体质',
        icon: 'game-icons:shield', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }]
      },
      {
        id: 'warrior_arms_t2', name: '重伤', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:bleeding-wound', tier: 2, col: 1, maxRank: 2,
        requires: ['warrior_arms_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08, description: '物理伤害提升' }]
      },
      {
        id: 'warrior_fury_t2', name: '嗜血', description: '每级提升 6% 物理伤害',
        icon: 'game-icons:droplet', tier: 2, col: 2, maxRank: 2,
        requires: ['warrior_fury_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'warrior_prot_t2', name: '坚韧', description: '每级减免 5% 受到的伤害',
        icon: 'game-icons:stone-block', tier: 2, col: 3, maxRank: 2,
        requires: ['warrior_prot_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'warrior_arms_t3', name: '致死打击', description: '每级提升 4 点力量',
        icon: 'game-icons:targeted', tier: 3, col: 1, maxRank: 2,
        requires: ['warrior_arms_t2'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 4 }]
      },
      {
        id: 'warrior_fury_t3', name: '狂暴', description: '每级提升 5 点力量',
        icon: 'game-icons:rage', tier: 3, col: 2, maxRank: 2,
        requires: ['warrior_fury_t2'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'warrior_prot_t3', name: '壁垒', description: '每级提升 4 点体质',
        icon: 'game-icons:castle', tier: 3, col: 3, maxRank: 2,
        requires: ['warrior_prot_t2'],
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 4 }]
      },
      {
        id: 'warrior_arms_t4', name: '剑刃风暴', description: '每级提升 5 点力量和 8% 物理伤害',
        icon: 'game-icons:spinning-sword', tier: 4, col: 1, maxRank: 2,
        requires: ['warrior_arms_t3'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08, description: '物理伤害提升' }]
      },
      {
        id: 'warrior_fury_t4', name: '狂暴之怒', description: '每级提升 15 点怒气上限和 8% 物理伤害',
        icon: 'game-icons:berserk', tier: 4, col: 2, maxRank: 2,
        requires: ['warrior_fury_t3', 'warrior_arms_t3'],
        effects: [{ type: 'resource_bonus', stat: 'rage_max', valuePerRank: 15 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'warrior_prot_t4', name: '盾墙', description: '每级提升 5 点体质，减免 5% 受到的伤害',
        icon: 'game-icons:shield', tier: 4, col: 3, maxRank: 2,
        requires: ['warrior_prot_t3'],
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'warrior_arms_t5', name: '横扫攻击', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:crossed-swords', tier: 5, col: 1, maxRank: 2,
        requires: ['warrior_arms_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'warrior_fury_t5', name: '无尽怒火', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:fire', tier: 5, col: 2, maxRank: 2,
        requires: ['warrior_fury_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'warrior_prot_t5', name: '坚韧不屈', description: '每级减免 6% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 5, col: 3, maxRank: 2,
        requires: ['warrior_prot_t4', 'warrior_fury_t4'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.06 }]
      },
      {
        id: 'warrior_arms_t6', name: '致死打击·终极', description: '提升 15% 物理伤害和 3 点力量',
        icon: 'game-icons:targeted', tier: 6, col: 1, maxRank: 1,
        requires: ['warrior_arms_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }, { type: 'stat_bonus', stat: 'str', valuePerRank: 3 }]
      },
      {
        id: 'warrior_fury_t6', name: '泰坦之怒', description: '提升 15% 物理伤害',
        icon: 'game-icons:berserk', tier: 6, col: 2, maxRank: 1,
        requires: ['warrior_fury_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'warrior_prot_t6', name: '终极壁垒', description: '减免 10% 受到的伤害，提升 3 点体质',
        icon: 'game-icons:castle', tier: 6, col: 3, maxRank: 1,
        requires: ['warrior_prot_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      }
    ]
  },
  {
    id: 'paladin', name: '圣骑士', classId: 'paladin',
    icon: 'game-icons:templar-shield', description: '以圣光之力守护、治愈与审判敌人的圣洁骑士',
    talents: [
      {
        id: 'paladin_holy_t1', name: '圣光祝福', description: '每级提升 5 点感知',
        icon: 'game-icons:prayer', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'paladin_prot_t1', name: '盾牌壁垒', description: '每级提升 5 点体质',
        icon: 'game-icons:shield', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }]
      },
      {
        id: 'paladin_ret_t1', name: '力量祝福', description: '每级提升 5 点力量',
        icon: 'game-icons:muscle-up', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'paladin_holy_t2', name: '神圣治疗', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:health-normal', tier: 2, col: 1, maxRank: 2,
        requires: ['paladin_holy_t1'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'paladin_prot_t2', name: '圣盾术', description: '每级减免 5% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 2, col: 2, maxRank: 2,
        requires: ['paladin_prot_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'paladin_ret_t2', name: '十字军打击', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:cross-flare', tier: 2, col: 3, maxRank: 2,
        requires: ['paladin_ret_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'paladin_holy_t3', name: '圣光闪耀', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:lightning-shadow', tier: 3, col: 1, maxRank: 2,
        requires: ['paladin_holy_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'paladin_prot_t3', name: '正义之盾', description: '每级提升 6% 物理伤害',
        icon: 'game-icons:crossed-swords', tier: 3, col: 2, maxRank: 2,
        requires: ['paladin_prot_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'paladin_ret_t3', name: '复仇之怒', description: '每级提升 5 点魅力',
        icon: 'game-icons:rage', tier: 3, col: 3, maxRank: 2,
        requires: ['paladin_ret_t2'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }]
      },
      {
        id: 'paladin_holy_t4', name: '圣光涌动', description: '每级提升 5 点魅力和 10% 治疗效果',
        icon: 'game-icons:holy-grail', tier: 4, col: 1, maxRank: 2,
        requires: ['paladin_holy_t3'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'paladin_prot_t4', name: '圣盾术·强化', description: '每级提升 5 点体质，减免 5% 受到的伤害',
        icon: 'game-icons:templar-shield', tier: 4, col: 2, maxRank: 2,
        requires: ['paladin_prot_t3', 'paladin_holy_t3'],
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'paladin_ret_t4', name: '十字军之心', description: '每级提升 5 点魅力和 8% 物理伤害',
        icon: 'game-icons:warhammer', tier: 4, col: 3, maxRank: 2,
        requires: ['paladin_ret_t3'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'paladin_holy_t5', name: '神圣光辉', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:lightning-shadow', tier: 5, col: 1, maxRank: 2,
        requires: ['paladin_holy_t4'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'paladin_prot_t5', name: '守护者之光', description: '每级减免 6% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 5, col: 2, maxRank: 2,
        requires: ['paladin_prot_t4'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.06 }]
      },
      {
        id: 'paladin_ret_t5', name: '审判之刃', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:cross-flare', tier: 5, col: 3, maxRank: 2,
        requires: ['paladin_ret_t4', 'paladin_prot_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'paladin_holy_t6', name: '圣光普照', description: '提升 15% 治疗效果和 8% 魔法伤害',
        icon: 'game-icons:holy-grail', tier: 6, col: 1, maxRank: 1,
        requires: ['paladin_holy_t5'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.15, description: '治疗效果提升' }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'paladin_prot_t6', name: '圣盾壁垒', description: '减免 10% 受到的伤害，提升 3 点体质',
        icon: 'game-icons:castle', tier: 6, col: 2, maxRank: 1,
        requires: ['paladin_prot_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'stat_bonus', stat: 'con', valuePerRank: 3 }]
      },
      {
        id: 'paladin_ret_t6', name: '圣裁', description: '提升 15% 物理伤害',
        icon: 'game-icons:warhammer', tier: 6, col: 3, maxRank: 1,
        requires: ['paladin_ret_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      }
    ]
  },
  {
    id: 'hunter', name: '猎人', classId: 'hunter',
    icon: 'game-icons:wolf-head', description: '驯服野兽、精准射击与野外生存的荒野大师',
    talents: [
      {
        id: 'hunter_beast_t1', name: '野兽训练', description: '每级提升 5 点敏捷',
        icon: 'game-icons:paw', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'hunter_marks_t1', name: '精准射击', description: '每级提升 4 点敏捷',
        icon: 'game-icons:targeted', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 4 }]
      },
      {
        id: 'hunter_surv_t1', name: '野外生存', description: '每级提升 5 点体质',
        icon: 'game-icons:health-normal', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }]
      },
      {
        id: 'hunter_beast_t2', name: '野性守护', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:beast-eye', tier: 2, col: 1, maxRank: 2,
        requires: ['hunter_beast_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'hunter_marks_t2', name: '致命射击', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:high-shot', tier: 2, col: 2, maxRank: 2,
        requires: ['hunter_marks_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'hunter_surv_t2', name: '陷阱掌握', description: '每级提升 6% 物理伤害',
        icon: 'game-icons:bear-trap', tier: 2, col: 3, maxRank: 2,
        requires: ['hunter_surv_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'hunter_beast_t3', name: '狂野怒火', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:werewolf', tier: 3, col: 1, maxRank: 2,
        requires: ['hunter_beast_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'hunter_marks_t3', name: '狙击', description: '每级提升 5 点敏捷',
        icon: 'game-icons:crosshair', tier: 3, col: 2, maxRank: 2,
        requires: ['hunter_marks_t2'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'hunter_surv_t3', name: '生存本能', description: '每级减免 5% 受到的伤害',
        icon: 'game-icons:run', tier: 3, col: 3, maxRank: 2,
        requires: ['hunter_surv_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'hunter_beast_t4', name: '驯服猎豹', description: '解锁可召唤的猎豹宠物，速度极快的近战输出',
        icon: 'game-icons:cat', tier: 4, col: 1, maxRank: 1,
        requires: ['hunter_beast_t3'],
        effects: [{ type: 'unlock_pet', petType: 'cat' }]
      },
      {
        id: 'hunter_marks_t4', name: '狙击精通', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:archery-target', tier: 4, col: 2, maxRank: 2,
        requires: ['hunter_marks_t3', 'hunter_beast_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'hunter_surv_t4', name: '荒野本能', description: '每级提升 5 点体质，减免 5% 受到的伤害',
        icon: 'game-icons:camping-tent', tier: 4, col: 3, maxRank: 2,
        requires: ['hunter_surv_t3'],
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'hunter_beast_t5', name: '驯服野猪', description: '解锁可召唤的野猪宠物，擅长冲撞控制敌人',
        icon: 'game-icons:boar-tusk', tier: 5, col: 1, maxRank: 1,
        requires: ['hunter_beast_t4'],
        effects: [{ type: 'unlock_pet', petType: 'boar' }]
      },
      {
        id: 'hunter_marks_t5', name: '穿透射击', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:crosshair', tier: 5, col: 2, maxRank: 2,
        requires: ['hunter_marks_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'hunter_surv_t5', name: '陷阱大师', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:bear-trap', tier: 5, col: 3, maxRank: 2,
        requires: ['hunter_surv_t4', 'hunter_marks_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'hunter_beast_t6', name: '驯服魔暴龙', description: '解锁可召唤的魔暴龙宠物，远古终极掠食者',
        icon: 'game-icons:t-rex-skull', tier: 6, col: 1, maxRank: 1,
        requires: ['hunter_beast_t5'],
        effects: [{ type: 'unlock_pet', petType: 'devilsaur' }]
      },
      {
        id: 'hunter_marks_t6', name: '死亡之箭', description: '提升 15% 物理伤害',
        icon: 'game-icons:high-shot', tier: 6, col: 2, maxRank: 1,
        requires: ['hunter_marks_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'hunter_surv_t6', name: '终极生存', description: '减免 10% 受到的伤害，提升 8% 物理伤害',
        icon: 'game-icons:run', tier: 6, col: 3, maxRank: 1,
        requires: ['hunter_surv_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      }
    ]
  },
  {
    id: 'rogue', name: '潜行者', classId: 'rogue',
    icon: 'game-icons:curved-knife', description: '精通毒药、双持与阴影技艺的致命刺客',
    talents: [
      {
        id: 'rogue_assn_t1', name: '毒药精通', description: '每级提升 5 点敏捷',
        icon: 'game-icons:poison', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'rogue_combat_t1', name: '双武器', description: '每级提升 5 点敏捷',
        icon: 'game-icons:double-quaver', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'rogue_sub_t1', name: '潜行', description: '每级提升 5 点敏捷',
        icon: 'game-icons:shadow', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'rogue_assn_t2', name: '致命毒药', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:droplet', tier: 2, col: 1, maxRank: 2,
        requires: ['rogue_assn_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'rogue_combat_t2', name: '剑刃乱舞', description: '每级提升 6% 物理伤害',
        icon: 'game-icons:spinning-swords', tier: 2, col: 2, maxRank: 2,
        requires: ['rogue_combat_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'rogue_sub_t2', name: '伏击', description: '每级提升 6 点敏捷',
        icon: 'game-icons:backstab', tier: 2, col: 3, maxRank: 2,
        requires: ['rogue_sub_t1'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 6 }]
      },
      {
        id: 'rogue_assn_t3', name: '刺杀', description: '每级提升 5 点敏捷',
        icon: 'game-icons:skull', tier: 3, col: 1, maxRank: 2,
        requires: ['rogue_assn_t2'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'rogue_combat_t3', name: '活力', description: '每级提升 8 点能量上限',
        icon: 'game-icons:lightning', tier: 3, col: 2, maxRank: 2,
        requires: ['rogue_combat_t2'],
        effects: [{ type: 'resource_bonus', stat: 'energy_max', valuePerRank: 8 }]
      },
      {
        id: 'rogue_sub_t3', name: '暗影之舞', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:dance', tier: 3, col: 3, maxRank: 2,
        requires: ['rogue_sub_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'rogue_assn_t4', name: '毒药大师', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:poison', tier: 4, col: 1, maxRank: 2,
        requires: ['rogue_assn_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'rogue_combat_t4', name: '剑刃风暴', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:spinning-swords', tier: 4, col: 2, maxRank: 2,
        requires: ['rogue_combat_t3', 'rogue_assn_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'rogue_sub_t4', name: '暗影大师', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:shadow', tier: 4, col: 3, maxRank: 2,
        requires: ['rogue_sub_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'rogue_assn_t5', name: '封喉', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:curved-knife', tier: 5, col: 1, maxRank: 2,
        requires: ['rogue_assn_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'rogue_combat_t5', name: '冲动', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:double-quaver', tier: 5, col: 2, maxRank: 2,
        requires: ['rogue_combat_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'rogue_sub_t5', name: '暗影步', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:backstab', tier: 5, col: 3, maxRank: 2,
        requires: ['rogue_sub_t4', 'rogue_combat_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'rogue_assn_t6', name: '死亡之吻', description: '提升 15% 物理伤害',
        icon: 'game-icons:skull', tier: 6, col: 1, maxRank: 1,
        requires: ['rogue_assn_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'rogue_combat_t6', name: '杀戮盛怒', description: '提升 15% 物理伤害',
        icon: 'game-icons:crossed-swords', tier: 6, col: 2, maxRank: 1,
        requires: ['rogue_combat_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'rogue_sub_t6', name: '暗影杀戮', description: '提升 15% 物理伤害',
        icon: 'game-icons:ninja-mask', tier: 6, col: 3, maxRank: 1,
        requires: ['rogue_sub_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      }
    ]
  },
  {
    id: 'priest', name: '牧师', classId: 'priest',
    icon: 'game-icons:prayer', description: '汲取圣光与暗影之力，治愈与毁灭的信仰者',
    talents: [
      {
        id: 'priest_holy_t1', name: '神圣之力', description: '每级提升 5 点感知',
        icon: 'game-icons:prayer', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'priest_shadow_t1', name: '暗影形态', description: '每级提升 5 点智力',
        icon: 'game-icons:shadow', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'priest_disc_t1', name: '坚韧', description: '每级提升 5 点体质',
        icon: 'game-icons:stone-block', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }]
      },
      {
        id: 'priest_holy_t2', name: '强化治疗', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:health-normal', tier: 2, col: 1, maxRank: 2,
        requires: ['priest_holy_t1'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'priest_shadow_t2', name: '精神恐慌', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:terror', tier: 2, col: 2, maxRank: 2,
        requires: ['priest_shadow_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'priest_disc_t2', name: '护盾', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:shield', tier: 2, col: 3, maxRank: 2,
        requires: ['priest_disc_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'priest_holy_t3', name: '圣光涌动', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:lightning-shadow', tier: 3, col: 1, maxRank: 2,
        requires: ['priest_holy_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'priest_shadow_t3', name: '暗影之语', description: '每级提升 5 点感知',
        icon: 'game-icons:whirlpool', tier: 3, col: 2, maxRank: 2,
        requires: ['priest_shadow_t2'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'priest_disc_t3', name: '苦修', description: '每级提升 9% 治疗效果',
        icon: 'game-icons:prayer', tier: 3, col: 3, maxRank: 2,
        requires: ['priest_disc_t2'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.09, description: '治疗效果提升' }]
      },
      {
        id: 'priest_holy_t4', name: '神圣之力·强化', description: '每级提升 5 点感知和 10% 治疗效果',
        icon: 'game-icons:prayer', tier: 4, col: 1, maxRank: 2,
        requires: ['priest_holy_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'priest_shadow_t4', name: '暗影之力', description: '每级提升 5 点感知和 8% 魔法伤害',
        icon: 'game-icons:terror', tier: 4, col: 2, maxRank: 2,
        requires: ['priest_shadow_t3', 'priest_holy_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'priest_disc_t4', name: '坚韧之心', description: '每级提升 5 点体质，减免 5% 受到的伤害',
        icon: 'game-icons:stone-block', tier: 4, col: 3, maxRank: 2,
        requires: ['priest_disc_t3'],
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'priest_holy_t5', name: '圣光祈祷', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:health-normal', tier: 5, col: 1, maxRank: 2,
        requires: ['priest_holy_t4'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'priest_shadow_t5', name: '精神控制', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:shadow', tier: 5, col: 2, maxRank: 2,
        requires: ['priest_shadow_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'priest_disc_t5', name: '苦修·强化', description: '每级提升 10% 治疗效果',
        icon: 'game-icons:shield', tier: 5, col: 3, maxRank: 2,
        requires: ['priest_disc_t4', 'priest_shadow_t4'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'priest_holy_t6', name: '神圣化身', description: '提升 15% 治疗效果和 8% 魔法伤害',
        icon: 'game-icons:holy-grail', tier: 6, col: 1, maxRank: 1,
        requires: ['priest_holy_t5'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.15, description: '治疗效果提升' }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'priest_shadow_t6', name: '暗影形态·终极', description: '提升 15% 魔法伤害',
        icon: 'game-icons:whirlpool', tier: 6, col: 2, maxRank: 1,
        requires: ['priest_shadow_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'priest_disc_t6', name: '神圣庇护', description: '减免 10% 受到的伤害，提升 10% 治疗效果',
        icon: 'game-icons:scroll', tier: 6, col: 3, maxRank: 1,
        requires: ['priest_disc_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      }
    ]
  },
  {
    id: 'shaman', name: '萨满', classId: 'shaman',
    icon: 'game-icons:lightning-storm', description: '沟通元素之灵，掌控闪电、图腾与自然之力',
    talents: [
      {
        id: 'shaman_elem_t1', name: '元素掌握', description: '每级提升 5 点感知',
        icon: 'game-icons:lightning', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'shaman_enh_t1', name: '武器增强', description: '每级提升 5 点力量',
        icon: 'game-icons:warhammer', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'shaman_rest_t1', name: '治愈之泉', description: '每级提升 5 点感知',
        icon: 'game-icons:water-drop', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'shaman_elem_t2', name: '闪电链', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:chain-lightning', tier: 2, col: 1, maxRank: 2,
        requires: ['shaman_elem_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'shaman_enh_t2', name: '风暴打击', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:lightning-storm', tier: 2, col: 2, maxRank: 2,
        requires: ['shaman_enh_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'shaman_rest_t2', name: '强效治疗', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:health-normal', tier: 2, col: 3, maxRank: 2,
        requires: ['shaman_rest_t1'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'shaman_elem_t3', name: '元素之怒', description: '每级提升 5 点感知',
        icon: 'game-icons:fire', tier: 3, col: 1, maxRank: 2,
        requires: ['shaman_elem_t2'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'shaman_enh_t3', name: '幽魂之狼', description: '每级提升 4 点感知',
        icon: 'game-icons:wolf-head', tier: 3, col: 2, maxRank: 2,
        requires: ['shaman_enh_t2'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 4 }]
      },
      {
        id: 'shaman_rest_t3', name: '自然守护', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:leaf', tier: 3, col: 3, maxRank: 2,
        requires: ['shaman_rest_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'shaman_elem_t4', name: '元素之怒·强化', description: '每级提升 5 点感知和 8% 魔法伤害',
        icon: 'game-icons:lightning', tier: 4, col: 1, maxRank: 2,
        requires: ['shaman_elem_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'shaman_enh_t4', name: '风暴之拳', description: '每级提升 5 点感知和 8% 物理伤害',
        icon: 'game-icons:warhammer', tier: 4, col: 2, maxRank: 2,
        requires: ['shaman_enh_t3', 'shaman_elem_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'shaman_rest_t4', name: '生命之泉', description: '每级提升 5 点感知和 10% 治疗效果',
        icon: 'game-icons:water-drop', tier: 4, col: 3, maxRank: 2,
        requires: ['shaman_rest_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'shaman_elem_t5', name: '闪电风暴', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:chain-lightning', tier: 5, col: 1, maxRank: 2,
        requires: ['shaman_elem_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'shaman_enh_t5', name: '熔岩猛击', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:hammer', tier: 5, col: 2, maxRank: 2,
        requires: ['shaman_enh_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'shaman_rest_t5', name: '潮汐之力', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:health-normal', tier: 5, col: 3, maxRank: 2,
        requires: ['shaman_rest_t4', 'shaman_enh_t4'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'shaman_elem_t6', name: '元素毁灭', description: '提升 15% 魔法伤害',
        icon: 'game-icons:lightning-storm', tier: 6, col: 1, maxRank: 1,
        requires: ['shaman_elem_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'shaman_enh_t6', name: '末日震击', description: '提升 15% 物理伤害',
        icon: 'game-icons:lightning-storm', tier: 6, col: 2, maxRank: 1,
        requires: ['shaman_enh_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'shaman_rest_t6', name: '自然之愈', description: '提升 15% 治疗效果，减免 5% 受到的伤害',
        icon: 'game-icons:leaf', tier: 6, col: 3, maxRank: 1,
        requires: ['shaman_rest_t5'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.15, description: '治疗效果提升' }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'mage', name: '法师', classId: 'mage',
    icon: 'game-icons:crystal-wand', description: '操控奥术、烈焰与寒冰的毁灭性法术大师',
    talents: [
      {
        id: 'mage_arcane_t1', name: '奥术专注', description: '每级提升 5 点智力',
        icon: 'game-icons:brain', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'mage_fire_t1', name: '点燃', description: '每级提升 6% 火焰伤害',
        icon: 'game-icons:flame', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'mage_frost_t1', name: '寒冰护体', description: '每级提升 5 点智力',
        icon: 'game-icons:ice-shield', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'mage_arcane_t2', name: '法力涌动', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:lightning', tier: 2, col: 1, maxRank: 2,
        requires: ['mage_arcane_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'mage_fire_t2', name: '燃烧', description: '每级提升 4 点智力',
        icon: 'game-icons:fire-zone', tier: 2, col: 2, maxRank: 2,
        requires: ['mage_fire_t1'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 4 }]
      },
      {
        id: 'mage_frost_t2', name: '冰冻', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:snowflake-1', tier: 2, col: 3, maxRank: 2,
        requires: ['mage_frost_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'mage_arcane_t3', name: '奥术强化', description: '每级提升 4 点智力',
        icon: 'game-icons:sparkles', tier: 3, col: 1, maxRank: 2,
        requires: ['mage_arcane_t2'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 4 }]
      },
      {
        id: 'mage_fire_t3', name: '烈焰风暴', description: '每级提升 9% 魔法伤害',
        icon: 'game-icons:meteor', tier: 3, col: 2, maxRank: 2,
        requires: ['mage_fire_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.09 }]
      },
      {
        id: 'mage_frost_t3', name: '冰封寒霜', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:icicles', tier: 3, col: 3, maxRank: 2,
        requires: ['mage_frost_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'mage_arcane_t4', name: '奥术涌动', description: '每级提升 5 点智力和 8% 魔法伤害',
        icon: 'game-icons:sparkles', tier: 4, col: 1, maxRank: 2,
        requires: ['mage_arcane_t3'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'mage_fire_t4', name: '烈焰精通', description: '每级提升 5 点智力和 8% 魔法伤害',
        icon: 'game-icons:flame', tier: 4, col: 2, maxRank: 2,
        requires: ['mage_fire_t3', 'mage_arcane_t3'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'mage_frost_t4', name: '冰霜壁垒', description: '每级提升 5 点智力，减免 5% 受到的伤害',
        icon: 'game-icons:ice-shield', tier: 4, col: 3, maxRank: 2,
        requires: ['mage_frost_t3'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'mage_arcane_t5', name: '法力风暴', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:lightning', tier: 5, col: 1, maxRank: 2,
        requires: ['mage_arcane_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'mage_fire_t5', name: '炎爆术', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:fire-zone', tier: 5, col: 2, maxRank: 2,
        requires: ['mage_fire_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'mage_frost_t5', name: '绝对零度', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:snowflake-1', tier: 5, col: 3, maxRank: 2,
        requires: ['mage_frost_t4', 'mage_fire_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'mage_arcane_t6', name: '奥术飞弹', description: '提升 15% 魔法伤害和 3 点智力',
        icon: 'game-icons:crystal-wand', tier: 6, col: 1, maxRank: 1,
        requires: ['mage_arcane_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }, { type: 'stat_bonus', stat: 'int', valuePerRank: 3 }]
      },
      {
        id: 'mage_fire_t6', name: '陨石坠落', description: '提升 15% 魔法伤害',
        icon: 'game-icons:meteor', tier: 6, col: 2, maxRank: 1,
        requires: ['mage_fire_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'mage_frost_t6', name: '冰封王座', description: '提升 15% 魔法伤害，减免 5% 受到的伤害',
        icon: 'game-icons:icicles', tier: 6, col: 3, maxRank: 1,
        requires: ['mage_frost_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'warlock', name: '术士', classId: 'warlock',
    icon: 'game-icons:tormented', description: '与恶魔订约，施用痛苦诅咒与毁灭法术的黑暗施法者',
    talents: [
      {
        id: 'warlock_aff_t1', name: '诅咒增幅', description: '每级提升 5 点智力',
        icon: 'game-icons:curse', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'warlock_demon_t1', name: '恶魔掌控', description: '每级提升 5 点智力',
        icon: 'game-icons:devil', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'warlock_dest_t1', name: '毁灭打击', description: '每级提升 6% 魔法伤害',
        icon: 'game-icons:meteor', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'warlock_aff_t2', name: '腐蚀', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:slime', tier: 2, col: 1, maxRank: 2,
        requires: ['warlock_aff_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'warlock_demon_t2', name: '恶魔韧性', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:demon-claw', tier: 2, col: 2, maxRank: 2,
        requires: ['warlock_demon_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'warlock_dest_t2', name: '燃烧', description: '每级提升 4 点智力',
        icon: 'game-icons:flame', tier: 2, col: 3, maxRank: 2,
        requires: ['warlock_dest_t1'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 4 }]
      },
      {
        id: 'warlock_aff_t3', name: '痛苦无常', description: '每级提升 2 个灵魂碎片上限',
        icon: 'game-icons:soul', tier: 3, col: 1, maxRank: 2,
        requires: ['warlock_aff_t2'],
        effects: [{ type: 'resource_bonus', stat: 'soul_shard_max', valuePerRank: 2 }]
      },
      {
        id: 'warlock_demon_t3', name: '恶魔变形', description: '每级提升 9% 魔法伤害',
        icon: 'game-icons:transmutation', tier: 3, col: 2, maxRank: 2,
        requires: ['warlock_demon_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.09 }]
      },
      {
        id: 'warlock_dest_t3', name: '混乱之箭', description: '每级提升 9% 魔法伤害',
        icon: 'game-icons:chaos', tier: 3, col: 3, maxRank: 2,
        requires: ['warlock_dest_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.09 }]
      },
      {
        id: 'warlock_aff_t4', name: '诅咒之王', description: '每级提升 5 点智力和 8% 魔法伤害',
        icon: 'game-icons:curse', tier: 4, col: 1, maxRank: 2,
        requires: ['warlock_aff_t3'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'warlock_demon_t4', name: '恶魔之主', description: '每级提升 5 点智力，减免 5% 受到的伤害',
        icon: 'game-icons:devil', tier: 4, col: 2, maxRank: 2,
        requires: ['warlock_demon_t3', 'warlock_aff_t3'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'warlock_dest_t4', name: '毁灭之心', description: '每级提升 5 点智力和 8% 魔法伤害',
        icon: 'game-icons:meteor', tier: 4, col: 3, maxRank: 2,
        requires: ['warlock_dest_t3'],
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'warlock_aff_t5', name: '痛苦诅咒', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:slime', tier: 5, col: 1, maxRank: 2,
        requires: ['warlock_aff_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'warlock_demon_t5', name: '恶魔之心', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:demon', tier: 5, col: 2, maxRank: 2,
        requires: ['warlock_demon_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'warlock_dest_t5', name: '地狱火', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:fire', tier: 5, col: 3, maxRank: 2,
        requires: ['warlock_dest_t4', 'warlock_demon_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'warlock_aff_t6', name: '灵魂吸取', description: '提升 15% 魔法伤害',
        icon: 'game-icons:soul', tier: 6, col: 1, maxRank: 1,
        requires: ['warlock_aff_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'warlock_demon_t6', name: '恶魔变形·终极', description: '提升 15% 魔法伤害，减免 5% 受到的伤害',
        icon: 'game-icons:transmutation', tier: 6, col: 2, maxRank: 1,
        requires: ['warlock_demon_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'warlock_dest_t6', name: '混乱之雨', description: '提升 15% 魔法伤害',
        icon: 'game-icons:chaos', tier: 6, col: 3, maxRank: 1,
        requires: ['warlock_dest_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      }
    ]
  },
  {
    id: 'monk', name: '武僧', classId: 'monk',
    icon: 'game-icons:wind', description: '以酒、拳与迷雾之息淬炼身心的武道宗师',
    talents: [
      {
        id: 'monk_brew_t1', name: '醉拳', description: '每级提升 5 点体质',
        icon: 'game-icons:beer-stein', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }]
      },
      {
        id: 'monk_ww_t1', name: '虎拳', description: '每级提升 5 点敏捷',
        icon: 'game-icons:paw', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'monk_mw_t1', name: '抚慰之雾', description: '每级提升 5 点感知',
        icon: 'game-icons:wind', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'monk_brew_t2', name: '壮胆酒', description: '每级减免 5% 受到的伤害',
        icon: 'game-icons:flagon', tier: 2, col: 1, maxRank: 2,
        requires: ['monk_brew_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'monk_ww_t2', name: '旭日东升', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:sun', tier: 2, col: 2, maxRank: 2,
        requires: ['monk_ww_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'monk_mw_t2', name: '复苏之雾', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:windsock', tier: 2, col: 3, maxRank: 2,
        requires: ['monk_mw_t1'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'monk_brew_t3', name: '酒火', description: '每级提升 6% 物理伤害',
        icon: 'game-icons:fire', tier: 3, col: 1, maxRank: 2,
        requires: ['monk_brew_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'monk_ww_t3', name: '真气爆裂', description: '每级提升 2 点真气上限',
        icon: 'game-icons:spirit', tier: 3, col: 2, maxRank: 2,
        requires: ['monk_ww_t2'],
        effects: [{ type: 'resource_bonus', stat: 'chi_max', valuePerRank: 2 }]
      },
      {
        id: 'monk_mw_t3', name: '真气贯通', description: '每级提升 6% 魔法伤害',
        icon: 'game-icons:spirit', tier: 3, col: 3, maxRank: 2,
        requires: ['monk_mw_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'monk_brew_t4', name: '醉拳大师', description: '每级提升 5 点敏捷，减免 5% 受到的伤害',
        icon: 'game-icons:beer-stein', tier: 4, col: 1, maxRank: 2,
        requires: ['monk_brew_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'monk_ww_t4', name: '风之拳', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:paw', tier: 4, col: 2, maxRank: 2,
        requires: ['monk_ww_t3', 'monk_brew_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'monk_mw_t4', name: '迷雾之息', description: '每级提升 5 点敏捷和 10% 治疗效果',
        icon: 'game-icons:windsock', tier: 4, col: 3, maxRank: 2,
        requires: ['monk_mw_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'monk_brew_t5', name: '壮胆酒·强化', description: '每级减免 6% 受到的伤害',
        icon: 'game-icons:flagon', tier: 5, col: 1, maxRank: 2,
        requires: ['monk_brew_t4'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.06 }]
      },
      {
        id: 'monk_ww_t5', name: '虎鹤双形', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:sun', tier: 5, col: 2, maxRank: 2,
        requires: ['monk_ww_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'monk_mw_t5', name: '复苏之雾·强化', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:wind', tier: 5, col: 3, maxRank: 2,
        requires: ['monk_mw_t4', 'monk_ww_t4'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'monk_brew_t6', name: '醉仙之醉', description: '减免 10% 受到的伤害，提升 8% 物理伤害',
        icon: 'game-icons:fire', tier: 6, col: 1, maxRank: 1,
        requires: ['monk_brew_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'monk_ww_t6', name: '翔龙在天', description: '提升 15% 物理伤害',
        icon: 'game-icons:wind', tier: 6, col: 2, maxRank: 1,
        requires: ['monk_ww_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'monk_mw_t6', name: '生生不息', description: '提升 15% 治疗效果和 8% 魔法伤害',
        icon: 'game-icons:spirit', tier: 6, col: 3, maxRank: 1,
        requires: ['monk_mw_t5'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.15, description: '治疗效果提升' }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      }
    ]
  },
  {
    id: 'druid', name: '德鲁伊', classId: 'druid',
    icon: 'game-icons:moon', description: '借日月星辰与野性之力守护自然的变形大师',
    talents: [
      {
        id: 'druid_bal_t1', name: '星辰之力', description: '每级提升 5 点智力',
        icon: 'game-icons:star', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'druid_feral_t1', name: '野性之力', description: '每级提升 5 点力量',
        icon: 'game-icons:paw', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'druid_rest_t1', name: '自然愈合', description: '每级提升 5 点感知',
        icon: 'game-icons:leaf', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'druid_bal_t2', name: '月火术', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:moon', tier: 2, col: 1, maxRank: 2,
        requires: ['druid_bal_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'druid_feral_t2', name: '撕裂', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:claw', tier: 2, col: 2, maxRank: 2,
        requires: ['druid_feral_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'druid_rest_t2', name: '回春术', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:plant-root', tier: 2, col: 3, maxRank: 2,
        requires: ['druid_rest_t1'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'druid_bal_t3', name: '星辰坠落', description: '每级提升 5 点感知',
        icon: 'game-icons:falling-star', tier: 3, col: 1, maxRank: 2,
        requires: ['druid_bal_t2'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'druid_feral_t3', name: '狂暴', description: '每级提升 4 点感知',
        icon: 'game-icons:rage', tier: 3, col: 2, maxRank: 2,
        requires: ['druid_feral_t2'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 4 }]
      },
      {
        id: 'druid_rest_t3', name: '生命之树', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:tree', tier: 3, col: 3, maxRank: 2,
        requires: ['druid_rest_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'druid_bal_t4', name: '月之降临', description: '每级提升 5 点感知和 8% 魔法伤害',
        icon: 'game-icons:moon', tier: 4, col: 1, maxRank: 2,
        requires: ['druid_bal_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'druid_feral_t4', name: '野性之心', description: '每级提升 5 点感知和 8% 物理伤害',
        icon: 'game-icons:paw', tier: 4, col: 2, maxRank: 2,
        requires: ['druid_feral_t3', 'druid_bal_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'druid_rest_t4', name: '自然之愈', description: '每级提升 5 点感知和 10% 治疗效果',
        icon: 'game-icons:leaf', tier: 4, col: 3, maxRank: 2,
        requires: ['druid_rest_t3'],
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'druid_bal_t5', name: '星辰坠落·强化', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:falling-star', tier: 5, col: 1, maxRank: 2,
        requires: ['druid_bal_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'druid_feral_t5', name: '猛虎之怒', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:claw', tier: 5, col: 2, maxRank: 2,
        requires: ['druid_feral_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'druid_rest_t5', name: '生命绽放', description: '每级提升 12% 治疗效果',
        icon: 'game-icons:plant-root', tier: 5, col: 3, maxRank: 2,
        requires: ['druid_rest_t4', 'druid_feral_t4'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.12, description: '治疗效果提升' }]
      },
      {
        id: 'druid_bal_t6', name: '艾露恩之怒', description: '提升 15% 魔法伤害',
        icon: 'game-icons:star', tier: 6, col: 1, maxRank: 1,
        requires: ['druid_bal_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'druid_feral_t6', name: '狂野撕咬', description: '提升 15% 物理伤害',
        icon: 'game-icons:werewolf', tier: 6, col: 2, maxRank: 1,
        requires: ['druid_feral_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'druid_rest_t6', name: '大自然的守护', description: '提升 15% 治疗效果，减免 5% 受到的伤害',
        icon: 'game-icons:tree', tier: 6, col: 3, maxRank: 1,
        requires: ['druid_rest_t5'],
        effects: [{ type: 'healing_multiplier', valuePerRank: 0.15, description: '治疗效果提升' }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      }
    ]
  },
  {
    id: 'death_knight', name: '死亡骑士', classId: 'death_knight',
    icon: 'game-icons:droplet', description: '驾驭鲜血、冰霜与亡灵之力的黑暗骑士',
    talents: [
      {
        id: 'death_knight_blood_t1', name: '鲜血之力', description: '每级提升 5 点力量',
        icon: 'game-icons:droplet', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'death_knight_frost_t1', name: '冰霜之力', description: '每级提升 5 点力量',
        icon: 'game-icons:snowflake', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'death_knight_unholy_t1', name: '亡灵掌握', description: '每级提升 5 点智力',
        icon: 'game-icons:skull', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'death_knight_blood_t2', name: '吸血', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:veins', tier: 2, col: 1, maxRank: 2,
        requires: ['death_knight_blood_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'death_knight_frost_t2', name: '冰霜打击', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:icicles', tier: 2, col: 2, maxRank: 2,
        requires: ['death_knight_frost_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'death_knight_unholy_t2', name: '疾病', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:plague', tier: 2, col: 3, maxRank: 2,
        requires: ['death_knight_unholy_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'death_knight_blood_t3', name: '血之疫', description: '每级减免 3% 受到的伤害',
        icon: 'game-icons:bleeding-wound', tier: 3, col: 1, maxRank: 2,
        requires: ['death_knight_blood_t2'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.03 }]
      },
      {
        id: 'death_knight_frost_t3', name: '湮没', description: '每级提升 5 点力量',
        icon: 'game-icons:broken-heart', tier: 3, col: 2, maxRank: 2,
        requires: ['death_knight_frost_t2'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'death_knight_unholy_t3', name: '亡灵召唤', description: '每级提升 5 点力量',
        icon: 'game-icons:raise-zombie', tier: 3, col: 3, maxRank: 2,
        requires: ['death_knight_unholy_t2'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'death_knight_blood_t4', name: '鲜血之怒', description: '每级提升 5 点力量和 8% 物理伤害',
        icon: 'game-icons:droplet', tier: 4, col: 1, maxRank: 2,
        requires: ['death_knight_blood_t3'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'death_knight_frost_t4', name: '冰霜之拳', description: '每级提升 5 点力量和 8% 物理伤害',
        icon: 'game-icons:icicles', tier: 4, col: 2, maxRank: 2,
        requires: ['death_knight_frost_t3', 'death_knight_blood_t3'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'death_knight_unholy_t4', name: '亡灵主宰', description: '每级提升 5 点力量和 8% 魔法伤害',
        icon: 'game-icons:skull', tier: 4, col: 3, maxRank: 2,
        requires: ['death_knight_unholy_t3'],
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'death_knight_blood_t5', name: '吸血鬼之血', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:veins', tier: 5, col: 1, maxRank: 2,
        requires: ['death_knight_blood_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'death_knight_frost_t5', name: '凛风冲击', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:snowflake', tier: 5, col: 2, maxRank: 2,
        requires: ['death_knight_frost_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'death_knight_unholy_t5', name: '亡灵召唤·强化', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:raise-zombie', tier: 5, col: 3, maxRank: 2,
        requires: ['death_knight_unholy_t4', 'death_knight_frost_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'death_knight_blood_t6', name: '血之疫·终极', description: '提升 15% 物理伤害，减免 5% 受到的伤害',
        icon: 'game-icons:bleeding-wound', tier: 6, col: 1, maxRank: 1,
        requires: ['death_knight_blood_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'death_knight_frost_t6', name: '冰封废土', description: '提升 15% 物理伤害',
        icon: 'game-icons:ice-shield', tier: 6, col: 2, maxRank: 1,
        requires: ['death_knight_frost_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'death_knight_unholy_t6', name: '天灾', description: '提升 15% 魔法伤害',
        icon: 'game-icons:plague', tier: 6, col: 3, maxRank: 1,
        requires: ['death_knight_unholy_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      }
    ]
  },
  {
    id: 'demon_hunter', name: '恶魔猎手', classId: 'demon_hunter',
    icon: 'game-icons:crossed-swords', description: '燃尽自身拥抱邪能，猎杀恶魔的复仇者',
    talents: [
      {
        id: 'demon_hunter_venge_t1', name: '恶魔韧性', description: '每级提升 5 点体质',
        icon: 'game-icons:stone-block', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 5 }]
      },
      {
        id: 'demon_hunter_havoc_t1', name: '恶魔之牙', description: '每级提升 5 点敏捷',
        icon: 'game-icons:demon-claw', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'demon_hunter_fel_t1', name: '邪能之血', description: '每级提升 5 点力量',
        icon: 'game-icons:fire', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'str', valuePerRank: 5 }]
      },
      {
        id: 'demon_hunter_venge_t2', name: '痛苦', description: '每级减免 5% 受到的伤害',
        icon: 'game-icons:tormented', tier: 2, col: 1, maxRank: 2,
        requires: ['demon_hunter_venge_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'demon_hunter_havoc_t2', name: '混乱打击', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:chaos', tier: 2, col: 2, maxRank: 2,
        requires: ['demon_hunter_havoc_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'demon_hunter_fel_t2', name: '邪能爆发', description: '每级提升 8% 物理伤害',
        icon: 'game-icons:explosion', tier: 2, col: 3, maxRank: 2,
        requires: ['demon_hunter_fel_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'demon_hunter_venge_t3', name: '恶魔变形', description: '每级提升 6% 物理伤害',
        icon: 'game-icons:transmutation', tier: 3, col: 1, maxRank: 2,
        requires: ['demon_hunter_venge_t2'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.06 }]
      },
      {
        id: 'demon_hunter_havoc_t3', name: '眼棱', description: '每级提升 5 点敏捷',
        icon: 'game-icons:eye', tier: 3, col: 2, maxRank: 2,
        requires: ['demon_hunter_havoc_t2'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }]
      },
      {
        id: 'demon_hunter_fel_t3', name: '邪能之刃', description: '每级提升 4 点敏捷',
        icon: 'game-icons:sword-spin', tier: 3, col: 3, maxRank: 2,
        requires: ['demon_hunter_fel_t2'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 4 }]
      },
      {
        id: 'demon_hunter_venge_t4', name: '恶魔之韧', description: '每级提升 5 点敏捷，减免 5% 受到的伤害',
        icon: 'game-icons:stone-block', tier: 4, col: 1, maxRank: 2,
        requires: ['demon_hunter_venge_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'demon_hunter_havoc_t4', name: '混乱之刃', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:chaos', tier: 4, col: 2, maxRank: 2,
        requires: ['demon_hunter_havoc_t3', 'demon_hunter_venge_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'demon_hunter_fel_t4', name: '邪能灌注', description: '每级提升 5 点敏捷和 8% 物理伤害',
        icon: 'game-icons:fire', tier: 4, col: 3, maxRank: 2,
        requires: ['demon_hunter_fel_t3'],
        effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'demon_hunter_venge_t5', name: '灵魂裂劈', description: '每级减免 6% 受到的伤害',
        icon: 'game-icons:tormented', tier: 5, col: 1, maxRank: 2,
        requires: ['demon_hunter_venge_t4'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.06 }]
      },
      {
        id: 'demon_hunter_havoc_t5', name: '刃舞', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:crossed-swords', tier: 5, col: 2, maxRank: 2,
        requires: ['demon_hunter_havoc_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'demon_hunter_fel_t5', name: '邪能风暴', description: '每级提升 10% 物理伤害',
        icon: 'game-icons:explosion', tier: 5, col: 3, maxRank: 2,
        requires: ['demon_hunter_fel_t4', 'demon_hunter_havoc_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'demon_hunter_venge_t6', name: '恶魔变形·终极', description: '减免 10% 受到的伤害，提升 8% 物理伤害',
        icon: 'game-icons:transmutation', tier: 6, col: 1, maxRank: 1,
        requires: ['demon_hunter_venge_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'damage_multiplier', valuePerRank: 0.08 }]
      },
      {
        id: 'demon_hunter_havoc_t6', name: '眼棱·终极', description: '提升 15% 物理伤害',
        icon: 'game-icons:eye', tier: 6, col: 2, maxRank: 1,
        requires: ['demon_hunter_havoc_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'demon_hunter_fel_t6', name: '邪能毁灭', description: '提升 15% 物理伤害',
        icon: 'game-icons:sword-spin', tier: 6, col: 3, maxRank: 1,
        requires: ['demon_hunter_fel_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      }
    ]
  },
  {
    id: 'evoker', name: '唤魔者', classId: 'evoker',
    icon: 'game-icons:dragon-head', description: '驾驭龙族之力，毁灭、护佑与增幅的化身',
    talents: [
      {
        id: 'evoker_dev_t1', name: '龙族智慧', description: '每级提升 5 点智力',
        icon: 'game-icons:brain', tier: 1, col: 1, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'evoker_pres_t1', name: '龙鳞护体', description: '每级提升 5 点感知',
        icon: 'game-icons:dragon-shield', tier: 1, col: 2, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'wis', valuePerRank: 5 }]
      },
      {
        id: 'evoker_aug_t1', name: '奥术共鸣', description: '每级提升 5 点智力',
        icon: 'game-icons:crystal-wand', tier: 1, col: 3, maxRank: 2,
        effects: [{ type: 'stat_bonus', stat: 'int', valuePerRank: 5 }]
      },
      {
        id: 'evoker_dev_t2', name: '毁灭吐息', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:fire-breath', tier: 2, col: 1, maxRank: 2,
        requires: ['evoker_dev_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_pres_t2', name: '巨龙坚韧', description: '每级减免 5% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 2, col: 2, maxRank: 2,
        requires: ['evoker_pres_t1'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'evoker_aug_t2', name: '能量灌注', description: '每级提升 8% 魔法伤害',
        icon: 'game-icons:lightning', tier: 2, col: 3, maxRank: 2,
        requires: ['evoker_aug_t1'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.08, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_dev_t3', name: '永恒之眼', description: '每级提升 4 点魅力',
        icon: 'game-icons:eye', tier: 3, col: 1, maxRank: 2,
        requires: ['evoker_dev_t2'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 4 }]
      },
      {
        id: 'evoker_pres_t3', name: '生命赐福', description: '每级提升 4 点体质',
        icon: 'game-icons:health-normal', tier: 3, col: 2, maxRank: 2,
        requires: ['evoker_pres_t2'],
        effects: [{ type: 'stat_bonus', stat: 'con', valuePerRank: 4 }]
      },
      {
        id: 'evoker_aug_t3', name: '致命共鸣', description: '每级提升 5 点魅力',
        icon: 'game-icons:targeted', tier: 3, col: 3, maxRank: 2,
        requires: ['evoker_aug_t2'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }]
      },
      {
        id: 'evoker_dev_t4', name: '龙息·强化', description: '每级提升 5 点魅力和 8% 魔法伤害',
        icon: 'game-icons:fire-breath', tier: 4, col: 1, maxRank: 2,
        requires: ['evoker_dev_t3'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_pres_t4', name: '龙鳞护体·强化', description: '每级提升 5 点魅力，减免 5% 受到的伤害',
        icon: 'game-icons:dragon-shield', tier: 4, col: 2, maxRank: 2,
        requires: ['evoker_pres_t3', 'evoker_dev_t3'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }, { type: 'damage_reduction', valuePerRank: 0.05 }]
      },
      {
        id: 'evoker_aug_t4', name: '增幅之息', description: '每级提升 5 点魅力和 8% 魔法伤害',
        icon: 'game-icons:sparkles', tier: 4, col: 3, maxRank: 2,
        requires: ['evoker_aug_t3'],
        effects: [{ type: 'stat_bonus', stat: 'cha', valuePerRank: 5 }, { type: 'damage_multiplier', valuePerRank: 0.08, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_dev_t5', name: '毁灭之翼', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:dragon-head', tier: 5, col: 1, maxRank: 2,
        requires: ['evoker_dev_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1 }]
      },
      {
        id: 'evoker_pres_t5', name: '守护之翼', description: '每级减免 6% 受到的伤害',
        icon: 'game-icons:stone-shield', tier: 5, col: 2, maxRank: 2,
        requires: ['evoker_pres_t4'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.06 }]
      },
      {
        id: 'evoker_aug_t5', name: '能量共鸣', description: '每级提升 10% 魔法伤害',
        icon: 'game-icons:lightning', tier: 5, col: 3, maxRank: 2,
        requires: ['evoker_aug_t4', 'evoker_pres_t4'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.1, description: '魔法伤害提升' }]
      },
      {
        id: 'evoker_dev_t6', name: '龙之怒', description: '提升 15% 魔法伤害',
        icon: 'game-icons:meteor', tier: 6, col: 1, maxRank: 1,
        requires: ['evoker_dev_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }]
      },
      {
        id: 'evoker_pres_t6', name: '永恒之盾', description: '减免 10% 受到的伤害，提升 10% 治疗效果',
        icon: 'game-icons:shield', tier: 6, col: 2, maxRank: 1,
        requires: ['evoker_pres_t5'],
        effects: [{ type: 'damage_reduction', valuePerRank: 0.1 }, { type: 'healing_multiplier', valuePerRank: 0.1, description: '治疗效果提升' }]
      },
      {
        id: 'evoker_aug_t6', name: '龙族觉醒', description: '提升 15% 魔法伤害和 8% 治疗效果',
        icon: 'game-icons:crystal-wand', tier: 6, col: 3, maxRank: 1,
        requires: ['evoker_aug_t5'],
        effects: [{ type: 'damage_multiplier', valuePerRank: 0.15 }, { type: 'healing_multiplier', valuePerRank: 0.08, description: '治疗效果提升' }]
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
