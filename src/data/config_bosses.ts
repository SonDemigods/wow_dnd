/**
 * @fileoverview Boss 怪物数据模块
 * @description 对应 config_bosses 表，包含所有 Boss 级怪物的属性、阶段和技能信息
 * @module data/bosses
 */

import type { BossTemplate } from '../modules/boss/types';

/**
 * Boss 怪物数据集（含阶段机制、AI 策略、出场演出）
 *
 * 阶段四升级：类型从 EnemyData[] 改为 BossTemplate[]。
 * EnemyData 已移除 phases/intro 字段，Boss 专属配置由 BossTemplate 独立声明。
 *
 * @type {BossTemplate[]}
 */
export const BOSSES: BossTemplate[] = [
  {
    id: 'boss_dragon_whelp',
    name: '幼龙',
    icon: 'game-icons:wyvern',
    maxHp: 180,
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
    intro: { effect: 'flame', lines: ['幼龙拦住了去路！', '它的双翼遮蔽了天空...'], duration: 2000 },
    drops: [
      { itemId: 'dragon_scale', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'mithril_sword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.5 },
    ]
  },
  {
    id: 'boss_abyss_guard',
    name: '深渊卫士',
    icon: 'game-icons:daemon-skull',
    maxHp: 200,
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
    skillPool: ['demon_fire', 'cleave', 'war_cry'],
    phases: [
      { hpThreshold: 0.3, name: '狂暴', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 50 } }], statMultipliers: { physicalAttack: 1.5, magicAttack: 1.3 }, transitionEffect: 'flame', dialogue: ['恶魔的力量开始失控！', '它的眼中闪烁着癫狂的光...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'aggressive', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['深渊卫士撕裂了空间！', '黑暗能量在你周围涌动...'], duration: 2500 },
    drops: [
      { itemId: 'void_crystal', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'berserker_axe', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.5 },
    ]
  },
  {
    id: 'boss_frost_wyrm',
    name: '冰霜巨龙',
    icon: 'game-icons:frozen-orb',
    maxHp: 200,
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
    intro: { effect: 'freeze', lines: ['冰霜巨龙从风雪中现身！', '它的吐息冻结了一切...'], duration: 2500 },
    drops: [
      { itemId: 'primal_water', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'mithril_greatsword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_mana_potion', minAmount: 1, maxAmount: 2, dropRate: 0.5 },
    ]
  },
  {
    id: 'boss_undead_knight',
    name: '亡灵骑士',
    icon: 'game-icons:black-knight-helm',
    maxHp: 140,
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
    skillPool: ['death_grip', 'soul_drain', 'fear_roar'],
    phases: [
      { hpThreshold: 0.4, name: '亡者军团', aiStrategy: 'aggressive', mechanics: [{ type: 'summon_minions', intervalTurns: 3, params: { count: 2 } }], statMultipliers: { physicalAttack: 1.2 }, transitionEffect: 'darken', dialogue: ['亡灵骑士高举咒文剑！', '亡者从地底爬出...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['亡灵骑士缓缓拔出咒文剑...', '冰冷的死亡气息笼罩了战场'], duration: 2200 },
    drops: [
      { itemId: 'primal_earth', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'rune_carved_sword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.5 },
    ]
  },
  {
    id: 'boss_lich',
    name: '亡灵大法师',
    icon: 'game-icons:skull-mask',
    maxHp: 190,
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
    attackType: 'magical',
    skillPool: ['shadow_bolt', 'curse', 'soul_drain'],
    phases: [
      { hpThreshold: 0.5, name: '暗影帷幕', aiStrategy: 'defensive', mechanics: [{ type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 40 } }, { type: 'debuff_aura', intervalTurns: 4, params: { debuffType: 'attack_down' } }], statMultipliers: { magicDefense: 1.3 }, transitionEffect: 'darken', dialogue: ['亡灵大法师释放了暗影帷幕！', '你的力量被削弱了...'] },
      { hpThreshold: 0.25, name: '濒死挣扎', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 2 }], statMultipliers: { magicAttack: 1.5 }, transitionEffect: 'lightning', dialogue: ['亡灵大法师发出凄厉的嚎叫！', '暗影能量爆裂开来！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'lightning', lines: ['亡灵大法师从暗影中现身...', '你的灵魂被它的目光穿透！'], duration: 2500 },
    drops: [
      { itemId: 'dream_fragment', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'rune_greatsword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_mana_potion', minAmount: 1, maxAmount: 2, dropRate: 0.5 },
    ]
  },
  {
    id: 'boss_frost_giant',
    name: '冰霜巨人',
    icon: 'game-icons:giant',
    maxHp: 220,
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
    skillPool: ['giant_stomp', 'frost_breath', 'stone_skin'],
    phases: [
      { hpThreshold: 0.4, name: '狂怒', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 3 }, { type: 'stun_player', intervalTurns: 4 }], statMultipliers: { physicalAttack: 1.4 }, transitionEffect: 'shake', dialogue: ['冰霜巨人彻底暴怒了！', '整个大地都在颤抖！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'aggressive', mechanics: [{ type: 'aoe_attack', intervalTurns: 5 }], dialogue: [] }
    ],
    intro: { effect: 'shake', lines: ['冰霜巨人踏碎了雪原！', '它的每一步都撼动大地...'], duration: 2200 },
    drops: [
      { itemId: 'primal_water', minAmount: 2, maxAmount: 3, dropRate: 1.0 },
      { itemId: 'dragonbone_greatsword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_health_potion', minAmount: 2, maxAmount: 3, dropRate: 0.6 },
    ]
  },
  // ========== P3-167 新增：Lv1-5 区间 ==========
  {
    id: 'boss_hogger',
    name: '兽王',
    icon: 'game-icons:orc-head',
    maxHp: 100,
    damage: [8, 16],
    xp: 50,
    gold: 25,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 20,
    physicalDefense: 10,
    magicAttack: 8,
    magicDefense: 6,
    critChance: 8,
    dodgeChance: 4,
    aiStrategy: 'boss_phase',
    skillPool: ['cleave', 'war_stomp', 'war_cry'],
    phases: [
      { hpThreshold: 0.5, name: '暴怒', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }], statMultipliers: { physicalAttack: 1.3 }, transitionEffect: 'shake', dialogue: ['兽王发出野蛮的咆哮！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'shake', lines: ['兽王挡在了去路前方！', '它挥舞着粗大的骨棒...'], duration: 1800 },
    drops: [
      { itemId: 'magic_dust', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'iron_axe', minAmount: 1, maxAmount: 1, dropRate: 0.10 },
      { itemId: 'small_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  {
    id: 'boss_murloc_chieftain',
    name: '蛙人酋长',
    icon: 'game-icons:fish-monster',
    maxHp: 110,
    damage: [9, 17],
    xp: 55,
    gold: 28,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 22,
    physicalDefense: 10,
    magicAttack: 12,
    magicDefense: 8,
    critChance: 6,
    dodgeChance: 5,
    aiStrategy: 'boss_phase',
    skillPool: ['tidal_wave', 'cleave'],
    phases: [
      { hpThreshold: 0.4, name: '召唤潮汐', aiStrategy: 'balanced', mechanics: [{ type: 'summon_minions', intervalTurns: 3, params: { count: 2 } }], statMultipliers: { magicAttack: 1.2 }, transitionEffect: 'darken', dialogue: ['蛙人酋长吹响了海螺！', '蛙人战士从泥沼中涌出...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['蛙人酋长从泥沼中站起！', '它举起了锈蚀的三叉戟...'], duration: 1800 },
    drops: [
      { itemId: 'magic_dust', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'iron_sword', minAmount: 1, maxAmount: 1, dropRate: 0.10 },
      { itemId: 'small_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  // ========== P3-167 新增：Lv6-10 区间 ==========
  {
    id: 'boss_troll_warlord',
    name: '巨魔战王',
    icon: 'game-icons:troll',
    maxHp: 140,
    damage: [12, 22],
    xp: 75,
    gold: 40,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 28,
    physicalDefense: 14,
    magicAttack: 10,
    magicDefense: 8,
    critChance: 10,
    dodgeChance: 6,
    aiStrategy: 'boss_phase',
    skillPool: ['cleave', 'regenerate', 'war_cry'],
    phases: [
      { hpThreshold: 0.4, name: '嗜血', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 40 } }], statMultipliers: { physicalAttack: 1.3 }, transitionEffect: 'darken', dialogue: ['巨魔战王的伤口开始愈合...', '它进入嗜血状态！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['巨魔战王从废墟中现身...', '它的伤口在眼前愈合！'], duration: 2000 },
    drops: [
      { itemId: 'magic_dust', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'bronze_shortsword', minAmount: 1, maxAmount: 1, dropRate: 0.12 },
      { itemId: 'medium_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  {
    id: 'boss_naga_seawitch',
    name: '海妖女巫',
    icon: 'game-icons:mermaid',
    maxHp: 145,
    damage: [13, 23],
    xp: 80,
    gold: 42,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 16,
    physicalDefense: 10,
    magicAttack: 30,
    magicDefense: 16,
    critChance: 12,
    dodgeChance: 8,
    aiStrategy: 'boss_phase',
    skillPool: ['shadow_bolt', 'hex', 'ice_shield'],
    attackType: 'magical',
    phases: [
      { hpThreshold: 0.5, name: '深海之怒', aiStrategy: 'aggressive', mechanics: [{ type: 'debuff_aura', intervalTurns: 4, params: { debuffType: 'attack_down' } }], statMultipliers: { magicAttack: 1.3 }, transitionEffect: 'freeze', dialogue: ['海妖女巫咏唱深海咒语！', '你的力量被削弱了...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [{ type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 30 } }], dialogue: [] }
    ],
    intro: { effect: 'freeze', lines: ['海妖女巫从深海浮出...', '海水在她周围凝结成冰！'], duration: 2200 },
    drops: [
      { itemId: 'primal_water', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'steel_sword', minAmount: 1, maxAmount: 1, dropRate: 0.12 },
      { itemId: 'medium_mana_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  {
    id: 'boss_centaur_khan',
    name: '半人马可汗',
    icon: 'game-icons:centaur',
    maxHp: 150,
    damage: [14, 24],
    xp: 82,
    gold: 45,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 30,
    physicalDefense: 16,
    magicAttack: 8,
    magicDefense: 8,
    critChance: 10,
    dodgeChance: 6,
    aiStrategy: 'aggressive',
    skillPool: ['war_stomp', 'cleave', 'giant_stomp', 'fear_roar'],
    phases: [
      { hpThreshold: 0.35, name: '冲锋', aiStrategy: 'aggressive', mechanics: [{ type: 'aoe_attack', intervalTurns: 3 }, { type: 'stun_player', intervalTurns: 4 }], statMultipliers: { physicalAttack: 1.4 }, transitionEffect: 'shake', dialogue: ['半人马可汗扬起尘烟...', '铁蹄如雷鸣般践踏！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'aggressive', mechanics: [{ type: 'aoe_attack', intervalTurns: 5 }], dialogue: [] }
    ],
    intro: { effect: 'shake', lines: ['半人马可汗扬起尘烟...', '铁蹄如雷鸣般逼近！'], duration: 2000 },
    drops: [
      { itemId: 'magic_dust', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'iron_axe', minAmount: 1, maxAmount: 1, dropRate: 0.12 },
      { itemId: 'medium_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  // ========== P3-167 新增：Lv11-15 区间 ==========
  {
    id: 'boss_demon_lord',
    name: '恶魔领主',
    icon: 'game-icons:daemon-skull',
    maxHp: 190,
    damage: [15, 28],
    xp: 100,
    gold: 55,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 35,
    physicalDefense: 18,
    magicAttack: 28,
    magicDefense: 16,
    critChance: 12,
    dodgeChance: 6,
    aiStrategy: 'boss_phase',
    skillPool: ['demon_fire', 'inferno', 'cleave', 'war_cry'],
    phases: [
      { hpThreshold: 0.5, name: '地狱之门', aiStrategy: 'aggressive', mechanics: [{ type: 'summon_minions', intervalTurns: 4, params: { count: 2 } }], statMultipliers: { physicalAttack: 1.2, magicAttack: 1.2 }, transitionEffect: 'flame', dialogue: ['恶魔领主撕开了地狱之门！', '低级恶魔蜂拥而出...'] },
      { hpThreshold: 0.25, name: '燃烧之血', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 2 }], statMultipliers: { physicalAttack: 1.4 }, transitionEffect: 'flame', dialogue: ['恶魔领主血液沸腾！', '地狱之火在它身后燃烧！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'flame', lines: ['恶魔领主撕裂了现实...', '地狱之火在它身后燃烧！'], duration: 2500 },
    drops: [
      { itemId: 'primal_fire', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'mithril_axe', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  {
    id: 'boss_rock_lord',
    name: '岩石之王',
    icon: 'game-icons:mountains',
    maxHp: 200,
    damage: [14, 26],
    xp: 98,
    gold: 52,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 32,
    physicalDefense: 25,
    magicAttack: 16,
    magicDefense: 14,
    critChance: 8,
    dodgeChance: 3,
    aiStrategy: 'boss_phase',
    skillPool: ['rock_barrage', 'giant_stomp', 'stone_skin'],
    phases: [
      { hpThreshold: 0.4, name: '山崩', aiStrategy: 'defensive', mechanics: [{ type: 'damage_shield', intervalTurns: 2, params: { shieldAmount: 80 } }, { type: 'stun_player', intervalTurns: 4 }], statMultipliers: { physicalDefense: 1.5, magicDefense: 1.3 }, transitionEffect: 'shake', dialogue: ['岩石之王硬化了外壳！', '大地在它脚下龟裂...'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [{ type: 'aoe_attack', intervalTurns: 4 }], dialogue: [] }
    ],
    intro: { effect: 'shake', lines: ['大地颤抖...', '岩石之王从山腹中剥离而出！'], duration: 2500 },
    drops: [
      { itemId: 'primal_earth', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'knight_longsword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_health_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  {
    id: 'boss_shadow_assassin',
    name: '暗影刺客',
    icon: 'game-icons:hooded-assassin',
    maxHp: 170,
    damage: [16, 30],
    xp: 95,
    gold: 55,
    dangerLevel: '极危险',
    isBoss: true,
    physicalAttack: 38,
    physicalDefense: 12,
    magicAttack: 22,
    magicDefense: 14,
    critChance: 20,
    dodgeChance: 15,
    aiStrategy: 'boss_phase',
    skillPool: ['shadow_strike', 'shadow_bolt', 'curse'],
    phases: [
      { hpThreshold: 0.5, name: '隐匿', aiStrategy: 'defensive', mechanics: [{ type: 'damage_shield', intervalTurns: 2, params: { shieldAmount: 30 } }], statMultipliers: { magicDefense: 1.3 }, transitionEffect: 'darken', dialogue: ['暗影刺客融入阴影...', '你无法锁定它的位置！'] },
      { hpThreshold: 0.2, name: '绝杀', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 2 }], statMultipliers: { physicalAttack: 1.5 }, transitionEffect: 'darken', dialogue: ['暗影刺客现身绝杀！', '匕首闪烁着寒光！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['一道暗影从你身后闪过...', '暗影刺客的匕首已抵咽喉！'], duration: 2200 },
    drops: [
      { itemId: 'dream_fragment', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'shadow_dagger', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'large_mana_potion', minAmount: 1, maxAmount: 2, dropRate: 0.50 },
    ]
  },
  // ========== P3-167 新增：Lv16-20 区间 ==========
  {
    id: 'boss_death_lord',
    name: '亡者领主',
    icon: 'game-icons:skull-mask',
    maxHp: 290,
    damage: [20, 38],
    xp: 170,
    gold: 90,
    dangerLevel: '致命',
    isBoss: true,
    physicalAttack: 48,
    physicalDefense: 24,
    magicAttack: 38,
    magicDefense: 22,
    critChance: 12,
    dodgeChance: 6,
    aiStrategy: 'boss_phase',
    skillPool: ['death_grip', 'plague_cloud', 'soul_drain', 'shadow_bolt', 'fear_roar'],
    phases: [
      { hpThreshold: 0.6, name: '亡者大军', aiStrategy: 'aggressive', mechanics: [{ type: 'summon_minions', intervalTurns: 3, params: { count: 3 } }], statMultipliers: { physicalAttack: 1.2 }, transitionEffect: 'darken', dialogue: ['亡者领主召唤亡者大军！', '骷髅从地底爬出...'] },
      { hpThreshold: 0.3, name: '瘟疫降临', aiStrategy: 'defensive', mechanics: [{ type: 'debuff_aura', intervalTurns: 3, params: { debuffType: 'attack_down' } }, { type: 'aoe_attack', intervalTurns: 3 }], statMultipliers: { magicAttack: 1.3 }, transitionEffect: 'darken', dialogue: ['瘟疫弥漫战场...', '你的力量被腐蚀了！'] },
      { hpThreshold: 0.1, name: '死亡挣扎', aiStrategy: 'aggressive', mechanics: [{ type: 'enrage', intervalTurns: 1 }, { type: 'aoe_attack', intervalTurns: 2 }, { type: 'stun_player', intervalTurns: 3 }], statMultipliers: { physicalAttack: 1.5, magicAttack: 1.5 }, transitionEffect: 'lightning', dialogue: ['亡者领主发出最后的咆哮！', '死亡能量爆裂开来！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [], dialogue: [] }
    ],
    intro: { effect: 'lightning', lines: ['亡者领主端坐于枯骨王座...', '它的目光穿透了你的灵魂！'], duration: 2800 },
    drops: [
      { itemId: 'void_crystal', minAmount: 1, maxAmount: 2, dropRate: 1.0 },
      { itemId: 'rune_carved_sword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'super_health_potion', minAmount: 2, maxAmount: 3, dropRate: 0.60 },
    ]
  },
  {
    id: 'boss_void_lord',
    name: '虚空领主',
    icon: 'game-icons:floating-tentacles',
    maxHp: 310,
    damage: [22, 40],
    xp: 180,
    gold: 95,
    dangerLevel: '致命',
    isBoss: true,
    physicalAttack: 40,
    physicalDefense: 22,
    magicAttack: 50,
    magicDefense: 30,
    critChance: 15,
    dodgeChance: 8,
    aiStrategy: 'boss_phase',
    skillPool: ['void_blast', 'shadow_bolt', 'curse', 'soul_drain', 'weaken'],
    attackType: 'magical',
    phases: [
      { hpThreshold: 0.5, name: '虚空护盾', aiStrategy: 'defensive', mechanics: [{ type: 'damage_shield', intervalTurns: 3, params: { shieldAmount: 100 } }, { type: 'debuff_aura', intervalTurns: 4, params: { debuffType: 'attack_down' } }], statMultipliers: { magicDefense: 1.5 }, transitionEffect: 'darken', dialogue: ['虚空领主展开了护盾！', '现实在它身边扭曲...'] },
      { hpThreshold: 0.25, name: '空间裂变', aiStrategy: 'aggressive', mechanics: [{ type: 'summon_minions', intervalTurns: 3, params: { count: 2 } }, { type: 'aoe_attack', intervalTurns: 2 }, { type: 'enrage', intervalTurns: 1 }], statMultipliers: { magicAttack: 1.4 }, transitionEffect: 'lightning', dialogue: ['空间在虚空领主身边裂变！', '虚空能量爆裂开来！'] },
      { hpThreshold: 0, name: '正常', aiStrategy: 'balanced', mechanics: [{ type: 'aoe_attack', intervalTurns: 4 }], dialogue: [] }
    ],
    intro: { effect: 'darken', lines: ['空间在你面前撕裂...', '虚空领主从裂隙中走出，现实在它身边扭曲！'], duration: 3000 },
    drops: [
      { itemId: 'void_crystal', minAmount: 2, maxAmount: 3, dropRate: 1.0 },
      { itemId: 'void_greatsword', minAmount: 1, maxAmount: 1, dropRate: 0.15 },
      { itemId: 'super_mana_potion', minAmount: 2, maxAmount: 3, dropRate: 0.60 },
    ]
  }
];
