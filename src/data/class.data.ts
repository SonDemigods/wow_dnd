/**
 * @fileoverview 魔兽世界职业数据模块
 * @description 包含所有可选职业的基础信息和技能详情
 * @module data/class
 */

import type { ClassData } from '../modules/character/types';
import type { Skill } from '../modules/skill/types';

/**
 * 所有可选职业的完整数据集
 * @type {ClassData[]}
 */
export const CLASSES: ClassData[] = [
  {
    id: 'warrior',
    name: '战士',
    icon: '⚔️',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '精通所有武器和护甲，是战场上的中坚力量',
    color: '#C79C6E',
    bonus: { str: 2, con: 1, int: -1, wis: -1 }
  },
  {
    id: 'paladin',
    name: '圣骑士',
    icon: '🔨',
    primaryStat: 'cha',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'draenei', 'lightforged_draenei', 'dark_iron_dwarf', 'tauren', 'blood_elves', 'zandalari', 'earthen'],
    description: '神圣的战士，使用圣光之力治疗和保护',
    color: '#F58CBA',
    bonus: { str: 1, con: 1, dex: -1, int: -1, cha: 2 }
  },
  {
    id: 'hunter',
    name: '猎人',
    icon: '🏹',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '远程武器和野兽控制专家',
    color: '#ABD473',
    bonus: { dex: 2, con: 1, int: -1, wis: 1, cha: -1 }
  },
  {
    id: 'rogue',
    name: '潜行者',
    icon: '🗡️',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '擅长偷袭和暗杀的敏捷杀手',
    color: '#FFF569',
    bonus: { dex: 3, str: -1, con: -1, int: -1 }
  },
  {
    id: 'priest',
    name: '牧师',
    icon: '✝️',
    primaryStat: 'wis',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '圣光的仆从，擅长治疗和驱散',
    color: '#FFFFFF',
    bonus: { int: 1, wis: 3, str: -1, dex: -1, con: -1, cha: -1 }
  },
  {
    id: 'shaman',
    name: '萨满祭司',
    icon: '⚡',
    primaryStat: 'wis',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['dwarf', 'draenei', 'dark_iron_dwarf', 'kul_tiran', 'orc', 'tauren', 'troll', 'goblin', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'earthen', 'harenei'],
    description: '与元素之灵沟通的通灵者',
    color: '#0070DE',
    bonus: { con: 1, int: 1, wis: 2, dex: -1, cha: -1 }
  },
  {
    id: 'mage',
    name: '法师',
    icon: '🧙',
    primaryStat: 'int',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '操控奥术、冰霜和火焰魔法的施法者',
    color: '#69CCF0',
    bonus: { int: 3, str: -1, con: -1, cha: -1 }
  },
  {
    id: 'warlock',
    name: '术士',
    icon: '💜',
    primaryStat: 'int',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '使用暗影魔法的危险施法者',
    color: '#9482C9',
    bonus: { int: 2, str: -1, con: -1, wis: -1, cha: 2 }
  },
  {
    id: 'monk',
    name: '武僧',
    icon: '🥋',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'earthen', 'harenei'],
    description: '掌握着古老武学之道的修行者',
    color: '#00FF96',
    bonus: { dex: 2, con: 1, wis: 1, str: -1, cha: -1 }
  },
  {
    id: 'druid',
    name: '德鲁伊',
    icon: '🌿',
    primaryStat: 'wis',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['night_elf', 'worgen', 'kul_tiran', 'tauren', 'troll', 'highmountain_tauren', 'zandalari', 'harenei'],
    description: '自然的守护者，可变身为多种形态',
    color: '#FF7D0A',
    bonus: { dex: 1, int: 1, wis: 2, str: -1, cha: -1 }
  },
  {
    id: 'death_knight',
    name: '死亡骑士',
    icon: '💀',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren'],
    description: '由死亡中苏醒的骑士，掌控着冰霜与暗影之力',
    color: '#C41F3B',
    bonus: { str: 2, con: 1, dex: -1, int: -1, wis: -1, cha: 1 }
  },
  {
    id: 'demon_hunter',
    name: '恶魔猎手',
    icon: '👿',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['night_elf', 'blood_elves'],
    description: '为对抗燃烧军团而生的暗影猎人',
    color: '#A330C9',
    bonus: { dex: 3, int: 1, con: -1, wis: -1 }
  },
  {
    id: 'evoker',
    name: '唤魔师',
    icon: '🐉',
    primaryStat: 'int',
    factionsIds: ['neutral'],
    raceIds: ['dracthyr'],
    description: '驾驭虚空之力的龙裔法师',
    color: '#33937F',
    bonus: { int: 3, con: -1 }
  }
];

/**
 * 所有职业的技能数据
 * 按职业分组，每个职业包含多个可解锁技能
 * @type {{ class_id: string; skills: Skill[] }[]}
 */
export const CLASS_ABILITIES: { class_id: string; skills: Skill[] }[] = [
  {
    class_id: 'warrior',
    skills: [
    {
      id: 'warrior_heroic_strike',
      name: '英雄打击',
      icon: '⚔️',
      description: '一次强力的近战攻击',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 1
    },
    {
      id: 'warrior_thunder_clap',
      name: '雷霆一击',
      icon: '⚡',
      description: '对周围敌人造成伤害',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 18 },
      unlockLevel: 1
    },
    {
      id: 'warrior_shield_bash',
      name: '盾击',
      icon: '🛡️',
      description: '用盾牌猛击敌人',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 15 },
      unlockLevel: 2
    },
    {
      id: 'warrior_execute',
      name: '斩杀',
      icon: '💀',
      description: '对低血量敌人造成致命伤害',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 32 },
      unlockLevel: 3
    },
    {
      id: 'warrior_sweeping_strike',
      name: '横扫攻击',
      icon: '💫',
      description: '攻击周围所有敌人',
      mpCost: 9,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 17 },
      unlockLevel: 4
    },
    {
      id: 'warrior_whirlwind',
      name: '旋风斩',
      icon: '🌀',
      description: '挥舞武器旋转攻击',
      mpCost: 15,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 26 },
      unlockLevel: 5
    },
    {
      id: 'warrior_mighty_blow',
      name: '猛击',
      icon: '🔨',
      description: '强力的重击',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 29 },
      unlockLevel: 6
    },
    {
      id: 'warrior_charge',
      name: '冲锋',
      icon: '💨',
      description: '快速冲向敌人并造成伤害',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 20 },
      unlockLevel: 7
    },
    {
      id: 'warrior_overpower',
      name: '压制',
      icon: '⚔️',
      description: '压制敌人的攻击',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 8
    },
    {
      id: 'warrior_blade_storm',
      name: '剑刃风暴',
      icon: '⚔️',
      description: '终极技能，造成大量伤害',
      mpCost: 25,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 45 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'mage',
    skills: [
    {
      id: 'mage_fireball',
      name: '火球术',
      icon: '🔥',
      description: '投掷一颗火球',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 25 },
      unlockLevel: 1
    },
    {
      id: 'mage_frost_nova',
      name: '冰霜新星',
      icon: '❄️',
      description: '释放冰霜能量',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 1
    },
    {
      id: 'mage_arcane_missiles',
      name: '奥术飞弹',
      icon: '✨',
      description: '发射多个奥术飞弹',
      mpCost: 6,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 13 },
      unlockLevel: 2
    },
    {
      id: 'mage_frost_bolt',
      name: '寒冰箭',
      icon: '❄️',
      description: '发射寒冰箭矢',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 3
    },
    {
      id: 'mage_fire_storm',
      name: '烈焰风暴',
      icon: '🌋',
      description: '召唤火焰风暴',
      mpCost: 18,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 31 },
      unlockLevel: 4
    },
    {
      id: 'mage_cone_of_cold',
      name: '冰锥术',
      icon: '❄️',
      description: '释放锥形冰霜伤害',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 5
    },
    {
      id: 'mage_arcane_blast',
      name: '奥术冲击',
      icon: '💫',
      description: '奥术能量冲击',
      mpCost: 8,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 6
    },
    {
      id: 'mage_mirror_image',
      name: '镜像',
      icon: '🪞',
      description: '召唤镜像攻击',
      mpCost: 15,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 10 },
      unlockLevel: 7
    },
    {
      id: 'mage_blizzard',
      name: '暴风雪',
      icon: '🌨️',
      description: '召唤暴风雪攻击区域',
      mpCost: 22,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 37 },
      unlockLevel: 8
    },
    {
      id: 'mage_pyroblast',
      name: '炎爆术',
      icon: '💥',
      description: '终极技能，造成大量火焰伤害',
      mpCost: 30,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 55 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'paladin',
    skills: [
    {
      id: 'paladin_holy_light',
      name: '圣光术',
      icon: '☀️',
      description: '治疗一个友方目标',
      mpCost: 12,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 31 },
      unlockLevel: 1
    },
    {
      id: 'paladin_divine_judgment',
      name: '神圣制裁',
      icon: '⚡',
      description: '对敌人造成神圣伤害',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 21 },
      unlockLevel: 1
    },
    {
      id: 'paladin_avengers_shield',
      name: '复仇者之盾',
      icon: '🛡️',
      description: '投掷盾牌攻击多个敌人',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 18 },
      unlockLevel: 2
    },
    {
      id: 'paladin_flash_of_light',
      name: '圣光闪现',
      icon: '✨',
      description: '快速治疗一个目标',
      mpCost: 8,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 18 },
      unlockLevel: 3
    },
    {
      id: 'paladin_consecration',
      name: '奉献',
      icon: '🔥',
      description: '神圣之火灼烧敌人',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 15 },
      unlockLevel: 4
    },
    {
      id: 'paladin_divine_strike',
      name: '神圣打击',
      icon: '⚔️',
      description: '神圣加持的近战攻击',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 5
    },
    {
      id: 'paladin_divine_shock',
      name: '神圣震击',
      icon: '💫',
      description: '释放神圣能量',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 6
    },
    {
      id: 'paladin_greater_heal',
      name: '神圣之光',
      icon: '🌟',
      description: '强力治疗技能',
      mpCost: 20,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 42 },
      unlockLevel: 7
    },
    {
      id: 'paladin_judgment',
      name: '审判',
      icon: '⚔️',
      description: '神圣审判',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 29 },
      unlockLevel: 8
    },
    {
      id: 'paladin_divine_storm',
      name: '神圣风暴',
      icon: '⚡',
      description: '终极技能，造成范围神圣伤害',
      mpCost: 28,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 43 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'hunter',
    skills: [
    {
      id: 'hunter_steady_shot',
      name: '稳固射击',
      icon: '🏹',
      description: '一次稳定的射击',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 20 },
      unlockLevel: 1
    },
    {
      id: 'hunter_arcane_shot',
      name: '奥术射击',
      icon: '✨',
      description: '附魔的箭矢攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 18 },
      unlockLevel: 1
    },
    {
      id: 'hunter_multi_shot',
      name: '多重射击',
      icon: '🎯',
      description: '同时射击多个目标',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 2
    },
    {
      id: 'hunter_serpent_sting',
      name: '毒蛇钉刺',
      icon: '🐍',
      description: '射出毒箭',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 15 },
      unlockLevel: 3
    },
    {
      id: 'hunter_volley',
      name: '乱射',
      icon: '🎯',
      description: '向周围发射箭矢',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 19 },
      unlockLevel: 4
    },
    {
      id: 'hunter_trap',
      name: '陷阱',
      icon: '🪤',
      description: '放置陷阱',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 19 },
      unlockLevel: 5
    },
    {
      id: 'hunter_concussive_shot',
      name: '震荡射击',
      icon: '💥',
      description: '造成冲击伤害',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 6
    },
    {
      id: 'hunter_aimed_shot',
      name: '瞄准射击',
      icon: '🎯',
      description: '精准瞄准射击',
      mpCost: 16,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 31 },
      unlockLevel: 7
    },
    {
      id: 'hunter_chimera_shot',
      name: '奇美拉射击',
      icon: '🦅',
      description: '释放魔法箭矢',
      mpCost: 18,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 28 },
      unlockLevel: 8
    },
    {
      id: 'hunter_kill_command',
      name: '杀戮命令',
      icon: '🐺',
      description: '终极技能，命令宠物致命攻击',
      mpCost: 25,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 48 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'rogue',
    skills: [
    {
      id: 'rogue_shadow_strike',
      name: '影袭',
      icon: '🗡️',
      description: '快速的暗影攻击',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 20 },
      unlockLevel: 1
    },
    {
      id: 'rogue_backstab',
      name: '背刺',
      icon: '🗡️',
      description: '从背后发起致命攻击',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 30 },
      unlockLevel: 1
    },
    {
      id: 'rogue_gouge',
      name: '凿击',
      icon: '💢',
      description: '快速打击敌人',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 17 },
      unlockLevel: 2
    },
    {
      id: 'rogue_mutilate',
      name: '毁伤',
      icon: '💀',
      description: '使用两把武器同时攻击',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 28 },
      unlockLevel: 3
    },
    {
      id: 'rogue_poisoned_strike',
      name: '毒刃',
      icon: '☠️',
      description: '涂毒的武器攻击',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 20 },
      unlockLevel: 4
    },
    {
      id: 'rogue_slice',
      name: '切割',
      icon: '⚔️',
      description: '快速切割',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 5
    },
    {
      id: 'rogue_eviscerate',
      name: '刺骨',
      icon: '❄️',
      description: '终结技',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 26 },
      unlockLevel: 6
    },
    {
      id: 'rogue_rupture',
      name: '出血',
      icon: '🩸',
      description: '造成流血伤害',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 22 },
      unlockLevel: 7
    },
    {
      id: 'rogue_vital_strike',
      name: '要害打击',
      icon: '🎯',
      description: '攻击要害',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 28 },
      unlockLevel: 8
    },
    {
      id: 'rogue_ambush',
      name: '伏击',
      icon: '🗡️',
      description: '终极技能，致命伏击',
      mpCost: 22,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 50 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'warlock',
    skills: [
    {
      id: 'warlock_shadow_bolt',
      name: '暗影箭',
      icon: '💜',
      description: '发射暗影能量',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 1
    },
    {
      id: 'warlock_corruption',
      name: '腐化',
      icon: '🖤',
      description: '暗影伤害',
      mpCost: 8,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 17 },
      unlockLevel: 1
    },
    {
      id: 'warlock_agony',
      name: '痛苦打击',
      icon: '😈',
      description: '痛苦魔法攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 15 },
      unlockLevel: 2
    },
    {
      id: 'warlock_immolate',
      name: '献祭',
      icon: '🔥',
      description: '点燃敌人',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 3
    },
    {
      id: 'warlock_shadow_burn',
      name: '暗影灼烧',
      icon: '🖤',
      description: '暗影火焰',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 26 },
      unlockLevel: 4
    },
    {
      id: 'warlock_seed_of_corruption',
      name: '腐蚀之种',
      icon: '🌱',
      description: '种下腐蚀种子',
      mpCost: 18,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 28 },
      unlockLevel: 5
    },
    {
      id: 'warlock_life_drain',
      name: '生命吸取',
      icon: '💚',
      description: '吸取敌人生命',
      mpCost: 10,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 15 },
      unlockLevel: 6
    },
    {
      id: 'warlock_soul_fire',
      name: '灵魂之火',
      icon: '🔥',
      description: '强力火焰攻击',
      mpCost: 20,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 35 },
      unlockLevel: 7
    },
    {
      id: 'warlock_demon_bolt',
      name: '恶魔箭',
      icon: '🐕',
      description: '恶魔能量攻击',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 26 },
      unlockLevel: 8
    },
    {
      id: 'warlock_chaos_bolt',
      name: '混乱之箭',
      icon: '💥',
      description: '终极技能，混沌伤害',
      mpCost: 30,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 55 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'druid',
    skills: [
    {
      id: 'druid_starfire',
      name: '星火术',
      icon: '⭐',
      description: '释放星界能量',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 22 },
      unlockLevel: 1
    },
    {
      id: 'druid_wrath',
      name: '愤怒',
      icon: '🔥',
      description: '快速的自然攻击',
      mpCost: 8,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 17 },
      unlockLevel: 1
    },
    {
      id: 'druid_moonfire',
      name: '月火术',
      icon: '🌙',
      description: '月神祝福的攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 2
    },
    {
      id: 'druid_rejuvenation',
      name: '愈合',
      icon: '🌿',
      description: '治疗一个目标',
      mpCost: 14,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 26 },
      unlockLevel: 3
    },
    {
      id: 'druid_regrowth',
      name: '回春术',
      icon: '🌸',
      description: '治疗效果',
      mpCost: 10,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 15 },
      unlockLevel: 4
    },
    {
      id: 'druid_thorns',
      name: '荆棘打击',
      icon: '🌵',
      description: '荆棘攻击',
      mpCost: 8,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 12 },
      unlockLevel: 5
    },
    {
      id: 'druid_feral_charge',
      name: '野性冲锋',
      icon: '🐾',
      description: '野性形态的冲锋攻击',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 6
    },
    {
      id: 'druid_berserking_regeneration',
      name: '狂暴回复',
      icon: '❤️',
      description: '强力治疗技能',
      mpCost: 16,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 31 },
      unlockLevel: 7
    },
    {
      id: 'druid_shred',
      name: '撕碎',
      icon: '🐾',
      description: '利爪攻击',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 26 },
      unlockLevel: 8
    },
    {
      id: 'druid_stars_fall',
      name: '星辰坠落',
      icon: '✨',
      description: '终极技能，召唤星雨攻击',
      mpCost: 28,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 52 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'priest',
    skills: [
    {
      id: 'priest_heal',
      name: '治疗术',
      icon: '💚',
      description: '基础治疗技能',
      mpCost: 12,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 28 },
      unlockLevel: 1
    },
    {
      id: 'priest_fast_heal',
      name: '快速治疗',
      icon: '⚡',
      description: '快速治疗一个目标',
      mpCost: 10,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 22 },
      unlockLevel: 1
    },
    {
      id: 'priest_smite',
      name: '惩击',
      icon: '✝️',
      description: '神圣伤害攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 2
    },
    {
      id: 'priest_holy_fire',
      name: '神圣之火',
      icon: '🔥',
      description: '神圣火焰攻击',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 3
    },
    {
      id: 'priest_lightwell',
      name: '光明之泉',
      icon: '🛡️',
      description: '召唤光明之泉',
      mpCost: 14,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 18 },
      unlockLevel: 4
    },
    {
      id: 'priest_renew',
      name: '恢复',
      icon: '💚',
      description: '持续治疗',
      mpCost: 8,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 13 },
      unlockLevel: 5
    },
    {
      id: 'priest_mind_flay',
      name: '精神鞭笞',
      icon: '💫',
      description: '精神能量攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 18 },
      unlockLevel: 6
    },
    {
      id: 'priest_prayer_of_healing',
      name: '治疗祷言',
      icon: '🙏',
      description: '群体治疗',
      mpCost: 18,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 35 },
      unlockLevel: 7
    },
    {
      id: 'priest_holy_nova',
      name: '神圣新星',
      icon: '✨',
      description: '神圣能量爆发',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 8
    },
    {
      id: 'priest_divine_hymn',
      name: '神圣赞美诗',
      icon: '🎵',
      description: '终极技能，强力群体治疗',
      mpCost: 32,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 55 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'shaman',
    skills: [
    {
      id: 'shaman_lightning_bolt',
      name: '闪电箭',
      icon: '⚡',
      description: '闪电攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 1
    },
    {
      id: 'shaman_lava_burst',
      name: '熔岩爆裂',
      icon: '🌋',
      description: '爆发性火焰伤害',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 28 },
      unlockLevel: 1
    },
    {
      id: 'shaman_healing_wave',
      name: '治疗波',
      icon: '🌊',
      description: '治疗一个目标',
      mpCost: 14,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 30 },
      unlockLevel: 2
    },
    {
      id: 'shaman_chain_heal',
      name: '治疗链',
      icon: '⚓',
      description: '治疗多个目标',
      mpCost: 16,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 25 },
      unlockLevel: 3
    },
    {
      id: 'shaman_flame_shock',
      name: '烈焰震击',
      icon: '🔥',
      description: '火焰震击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 4
    },
    {
      id: 'shaman_frost_shock',
      name: '冰霜震击',
      icon: '❄️',
      description: '冰霜震击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 18 },
      unlockLevel: 5
    },
    {
      id: 'shaman_chain_lightning',
      name: '闪电链',
      icon: '⚡',
      description: '闪电跳跃攻击多个目标',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 25 },
      unlockLevel: 6
    },
    {
      id: 'shaman_windfury',
      name: '风怒打击',
      icon: '🌀',
      description: '风怒攻击',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 26 },
      unlockLevel: 7
    },
    {
      id: 'shaman_elemental_strike',
      name: '元素打击',
      icon: '🔥',
      description: '元素攻击',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 28 },
      unlockLevel: 8
    },
    {
      id: 'shaman_earthquake',
      name: '地震术',
      icon: '🌍',
      description: '终极技能，引发地震',
      mpCost: 28,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 50 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'death_knight',
    skills: [
    {
      id: 'death_knight_frost_touch',
      name: '冰冷触摸',
      icon: '❄️',
      description: '冰霜能量攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 1
    },
    {
      id: 'death_knight_shadow_strike',
      name: '暗影打击',
      icon: '🖤',
      description: '暗影攻击',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 1
    },
    {
      id: 'death_knight_death_grip',
      name: '死亡之握',
      icon: '💀',
      description: '将敌人拉到身边',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 18 },
      unlockLevel: 2
    },
    {
      id: 'death_knight_heart_strike',
      name: '心脏打击',
      icon: '❤️',
      description: '强力攻击',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 26 },
      unlockLevel: 3
    },
    {
      id: 'death_knight_death_strike',
      name: '灵界打击',
      icon: '👻',
      description: '攻击并治疗自己',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 4
    },
    {
      id: 'death_knight_frost_strike',
      name: '冰霜打击',
      icon: '🧊',
      description: '冰霜攻击',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 26 },
      unlockLevel: 5
    },
    {
      id: 'death_knight_death_and_decay',
      name: '死亡凋零',
      icon: '💀',
      description: '区域伤害',
      mpCost: 18,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 28 },
      unlockLevel: 6
    },
    {
      id: 'death_knight_rune_blade_waltz',
      name: '符文刃舞',
      icon: '⚔️',
      description: '召唤符文武器',
      mpCost: 20,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 30 },
      unlockLevel: 7
    },
    {
      id: 'death_knight_scourge_strike',
      name: '天灾打击',
      icon: '💀',
      description: '天灾力量攻击',
      mpCost: 18,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 33 },
      unlockLevel: 8
    },
    {
      id: 'death_knight_sindragosas_breath',
      name: '辛达苟萨之息',
      icon: '🐉',
      description: '终极技能，冰霜巨龙的吐息',
      mpCost: 30,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 55 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'monk',
    skills: [
    {
      id: 'monk_sun_strike',
      name: '贯日击',
      icon: '☀️',
      description: '基础攻击',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 20 },
      unlockLevel: 1
    },
    {
      id: 'monk_tiger_palm',
      name: '猛虎掌',
      icon: '🐯',
      description: '虎形拳攻击',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 1
    },
    {
      id: 'monk_rise_of_the_sun',
      name: '旭日东升踢',
      icon: '🌅',
      description: '强力踢击',
      mpCost: 14,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 28 },
      unlockLevel: 2
    },
    {
      id: 'monk_crane_kick',
      name: '神鹤引项踢',
      icon: '🦢',
      description: '鹤形踢击',
      mpCost: 12,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 25 },
      unlockLevel: 3
    },
    {
      id: 'monk_tranquility_orb',
      name: '禅意珠',
      icon: '🔮',
      description: '放置治疗珠',
      mpCost: 10,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 18 },
      unlockLevel: 4
    },
    {
      id: 'monk_fists_of_fury',
      name: '幻灭踢',
      icon: '💫',
      description: '快速攻击',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 23 },
      unlockLevel: 5
    },
    {
      id: 'monk_sweep',
      name: '扫堂腿',
      icon: '🦶',
      description: '扫击敌人',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 18 },
      unlockLevel: 6
    },
    {
      id: 'monk_transference',
      name: '移花接木',
      icon: '🌺',
      description: '治疗技能',
      mpCost: 14,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 28 },
      unlockLevel: 7
    },
    {
      id: 'monk_iron_mountain',
      name: '铁山靠',
      icon: '🧱',
      description: '强力撞击',
      mpCost: 16,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 28 },
      unlockLevel: 8
    },
    {
      id: 'monk_thunder_fist',
      name: '怒雷破',
      icon: '⚡',
      description: '终极技能，释放雷电之力',
      mpCost: 26,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 52 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'demon_hunter',
    skills: [
    {
      id: 'demon_hunter_chaos_strike',
      name: '混乱打击',
      icon: '🔥',
      description: '混乱能量攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 1
    },
    {
      id: 'demon_hunter_blade_dance',
      name: '刃舞',
      icon: '⚔️',
      description: '挥舞双刃攻击',
      mpCost: 8,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 20 },
      unlockLevel: 1
    },
    {
      id: 'demon_hunter_fel_rush',
      name: '邪能冲锋',
      icon: '💨',
      description: '冲锋并造成伤害',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 26 },
      unlockLevel: 2
    },
    {
      id: 'demon_hunter_fel_strike',
      name: '邪能打击',
      icon: '✨',
      description: '邪能攻击',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 23 },
      unlockLevel: 3
    },
    {
      id: 'demon_hunter_throw_glaive',
      name: '投掷利刃',
      icon: '🗡️',
      description: '投掷利刃',
      mpCost: 10,
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 22 },
      unlockLevel: 4
    },
    {
      id: 'demon_hunter_eye_beam',
      name: '眼棱',
      icon: '👁️',
      description: '眼睛发射邪能射线',
      mpCost: 18,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 35 },
      unlockLevel: 5
    },
    {
      id: 'demon_hunter_metamorphosis',
      name: '毁灭打击',
      icon: '😈',
      description: '毁灭攻击',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 30 },
      unlockLevel: 6
    },
    {
      id: 'demon_hunter_immolation_aura',
      name: '献祭光环',
      icon: '🔥',
      description: '灼烧周围敌人',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 17 },
      unlockLevel: 7
    },
    {
      id: 'demon_hunter_chaos_nova',
      name: '幽魂锁链',
      icon: '🔗',
      description: '灵魂锁链攻击',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 27 },
      unlockLevel: 8
    },
    {
      id: 'demon_hunter_cataclysm',
      name: '浩劫',
      icon: '💥',
      description: '终极技能，毁灭性的邪能爆发',
      mpCost: 32,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 59 },
      unlockLevel: 10
    }
    ]
  },
  {
    class_id: 'evoker',
    skills: [
    {
      id: 'evoker_dragon_breath',
      name: '龙息',
      icon: '🐉',
      description: '释放龙息攻击',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 22 },
      unlockLevel: 1
    },
    {
      id: 'evoker_emerald_blossom',
      name: '翡翠 Blossom',
      icon: '💚',
      description: '治疗技能',
      mpCost: 12,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 26 },
      unlockLevel: 1
    },
    {
      id: 'evoker_disintegrate',
      name: '瓦解',
      icon: '✨',
      description: '瓦解敌人',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 28 },
      unlockLevel: 2
    },
    {
      id: 'evoker_essence_burst',
      name: '精华爆发',
      icon: '💫',
      description: '精华能量爆发',
      mpCost: 10,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 20 },
      unlockLevel: 3
    },
    {
      id: 'evoker_shifting_embers',
      name: '涌动余烬',
      icon: '🔥',
      description: '火焰攻击',
      mpCost: 12,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 24 },
      unlockLevel: 4
    },
    {
      id: 'evoker_sleep_walk',
      name: '梦游',
      icon: '😴',
      description: '控制技能',
      mpCost: 16,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 22 },
      unlockLevel: 5
    },
    {
      id: 'evoker_azure_strike',
      name: '碧蓝打击',
      icon: '💎',
      description: '冰霜攻击',
      mpCost: 14,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 26 },
      unlockLevel: 6
    },
    {
      id: 'evoker_emerald_winds',
      name: '翡翠之风',
      icon: '🌪️',
      description: '范围治疗',
      mpCost: 18,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 32 },
      unlockLevel: 7
    },
    {
      id: 'evoker_spiritbloom',
      name: '灵魂绽放',
      icon: '🌸',
      description: '强力治疗',
      mpCost: 20,
      type: 'health_restore',
      effect: { type: 'health_restore', value: 38 },
      unlockLevel: 8
    },
    {
      id: 'evoker_emerald_destruction',
      name: '翡翠毁灭',
      icon: '💥',
      description: '终极技能，龙裔毁灭之力',
      mpCost: 32,
      type: 'magic_damage',
      effect: { type: 'magic_damage', value: 58 },
      unlockLevel: 10
    }
    ]
  }
];
