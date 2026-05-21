/**
 * @fileoverview 魔兽世界职业数据模块
 * @description 包含所有可选职业的基础信息和技能详情
 * @module data/classes
 */

import type { ClassData, Stats, Ability } from '../types'

export interface ClassDataWithStats extends ClassData {
  stats?: Partial<Stats>
}

export type SkillData = Ability & {
  description?: string
}

/**
 * 所有可用职业的完整数据集
 * 注意：技能数据单独存储在 CLASS_ABILITIES 中，通过职业ID关联
 * @type {Record<string, ClassDataWithStats>}
 */
export const CLASSES: Record<string, ClassDataWithStats> = {
  warrior: {
    name: '战士',
    icon: '⚔️',
    hitDie: 12,
    primaryStat: 'str',
    factions: ['alliance', 'horde', 'neutral'],
    description: '精通所有武器和护甲，是战场上的中坚力量',
    color: '#C79C6E',
    stats: { str: 2, con: 1, int: -1, wis: -1 }
  },
  mage: {
    name: '法师',
    icon: '🧙',
    hitDie: 6,
    primaryStat: 'int',
    factions: ['alliance', 'horde', 'neutral'],
    description: '操控奥术、冰霜和火焰魔法的施法者',
    color: '#69CCF0',
    stats: { int: 3, str: -1, con: -1, cha: -1 }
  },
  paladin: {
    name: '圣骑士',
    icon: '🔨',
    hitDie: 10,
    primaryStat: 'cha',
    factions: ['alliance', 'horde'],
    description: '神圣的战士，使用圣光之力治疗和保护',
    color: '#F58CBA',
    stats: { str: 1, con: 1, dex: -1, int: -1, cha: 2 }
  },
  hunter: {
    name: '猎人',
    icon: '🏹',
    hitDie: 10,
    primaryStat: 'dex',
    factions: ['alliance', 'horde', 'neutral'],
    description: '远程武器和野兽控制专家',
    color: '#ABD473',
    stats: { dex: 2, con: 1, int: -1, wis: 1, cha: -1 }
  },
  rogue: {
    name: '潜行者',
    icon: '🗡️',
    hitDie: 8,
    primaryStat: 'dex',
    factions: ['alliance', 'horde', 'neutral'],
    description: '擅长偷袭和暗杀的敏捷杀手',
    color: '#FFF569',
    stats: { dex: 3, str: -1, con: -1, int: -1 }
  },
  warlock: {
    name: '术士',
    icon: '💜',
    hitDie: 8,
    primaryStat: 'int',
    factions: ['alliance', 'horde', 'neutral'],
    description: '使用暗影魔法的危险施法者',
    color: '#9482C9',
    stats: { int: 2, str: -1, con: -1, wis: -1, cha: 2 }
  },
  druid: {
    name: '德鲁伊',
    icon: '🌿',
    hitDie: 8,
    primaryStat: 'wis',
    factions: ['alliance', 'horde', 'neutral'],
    description: '自然的守护者，可变身为多种形态',
    color: '#FF7D0A',
    stats: { dex: 1, int: 1, wis: 2, str: -1, cha: -1 }
  },
  priest: {
    name: '牧师',
    icon: '✝️',
    hitDie: 8,
    primaryStat: 'wis',
    factions: ['alliance', 'horde', 'neutral'],
    description: '圣光的仆从，擅长治疗和驱散',
    color: '#FFFFFF',
    stats: { int: 1, wis: 3, str: -1, dex: -1, con: -1, cha: -1 }
  },
  shaman: {
    name: '萨满',
    icon: '⚡',
    hitDie: 8,
    primaryStat: 'wis',
    factions: ['alliance', 'horde', 'neutral'],
    description: '与元素之灵沟通的通灵者',
    color: '#0070DE',
    stats: { con: 1, int: 1, wis: 2, dex: -1, cha: -1 }
  },
  deathknight: {
    name: '死亡骑士',
    icon: '💀',
    hitDie: 12,
    primaryStat: 'str',
    factions: ['alliance', 'horde'],
    description: '由死亡中苏醒的骑士，掌控着冰霜与暗影之力',
    color: '#C41F3B',
    stats: { str: 2, con: 1, dex: -1, int: -1, wis: -1, cha: 1 }
  },
  monk: {
    name: '武僧',
    icon: '🥋',
    hitDie: 8,
    primaryStat: 'dex',
    factions: ['alliance', 'horde', 'neutral'],
    description: '掌握着古老武学之道的修行者',
    color: '#00FF96',
    stats: { dex: 2, con: 1, wis: 1, str: -1, cha: -1 }
  },
  demonhunter: {
    name: '恶魔猎手',
    icon: '👿',
    hitDie: 10,
    primaryStat: 'dex',
    factions: ['alliance', 'horde'],
    description: '为对抗燃烧军团而生的暗影猎人',
    color: '#A330C9',
    stats: { dex: 3, int: 1, con: -1, wis: -1 }
  }
}

/**
 * 各职业详细技能数据
 * 每个职业严格配置10个技能，包含伤害与治疗技能的合理搭配
 * 法力值消耗根据技能强度和职业定位设定
 * @type {Record<string, SkillData[]>}
 */
export const CLASS_ABILITIES: Record<string, SkillData[]> = {
  warrior: [
    { name: '英雄打击', icon: '⚔️', damage: [18, 28], manaCost: 8, type: 'physical_damage', description: '一次强力的近战攻击' },
    { name: '雷霆一击', icon: '⚡', damage: [15, 22], manaCost: 10, type: 'physical_damage', description: '对周围敌人造成伤害' },
    { name: '盾击', icon: '🛡️', damage: [12, 18], manaCost: 8, type: 'physical_damage', description: '用盾牌猛击敌人' },
    { name: '斩杀', icon: '💀', damage: [25, 40], manaCost: 12, type: 'physical_damage', description: '对低血量敌人造成致命伤害' },
    { name: '横扫攻击', icon: '💫', damage: [14, 20], manaCost: 9, type: 'physical_damage', description: '攻击周围所有敌人' },
    { name: '旋风斩', icon: '🌀', damage: [20, 32], manaCost: 15, type: 'physical_damage', description: '挥舞武器旋转攻击' },
    { name: '猛击', icon: '🔨', damage: [22, 36], manaCost: 14, type: 'physical_damage', description: '强力的重击' },
    { name: '冲锋', icon: '💨', damage: [16, 24], manaCost: 10, type: 'physical_damage', description: '快速冲向敌人并造成伤害' },
    { name: '压制', icon: '⚔️', damage: [18, 28], manaCost: 12, type: 'physical_damage', description: '压制敌人的攻击' },
    { name: '剑刃风暴', icon: '⚔️', damage: [35, 55], manaCost: 25, type: 'physical_damage', description: '终极技能，造成大量伤害' }
  ],
  mage: [
    { name: '火球术', icon: '🔥', damage: [20, 30], manaCost: 10, type: 'magic_damage', description: '投掷一颗火球' },
    { name: '冰霜新星', icon: '❄️', damage: [16, 24], manaCost: 12, type: 'magic_damage', description: '释放冰霜能量' },
    { name: '奥术飞弹', icon: '✨', damage: [10, 16], manaCost: 6, type: 'magic_damage', description: '发射多个奥术飞弹' },
    { name: '寒冰箭', icon: '❄️', damage: [18, 28], manaCost: 10, type: 'magic_damage', description: '发射寒冰箭矢' },
    { name: '烈焰风暴', icon: '🌋', damage: [25, 38], manaCost: 18, type: 'magic_damage', description: '召唤火焰风暴' },
    { name: '冰锥术', icon: '❄️', damage: [18, 28], manaCost: 14, type: 'magic_damage', description: '释放锥形冰霜伤害' },
    { name: '奥术冲击', icon: '💫', damage: [15, 25], manaCost: 8, type: 'magic_damage', description: '奥术能量冲击' },
    { name: '镜像', icon: '🪞', damage: [8, 12], manaCost: 15, type: 'magic_damage', description: '召唤镜像攻击' },
    { name: '暴风雪', icon: '🌨️', damage: [30, 45], manaCost: 22, type: 'magic_damage', description: '召唤暴风雪攻击区域' },
    { name: '炎爆术', icon: '💥', damage: [45, 65], manaCost: 30, type: 'magic_damage', description: '终极技能，造成大量火焰伤害' }
  ],
  paladin: [
    { name: '圣光术', icon: '☀️', healing: [25, 38], manaCost: 12, type: 'heal', description: '治疗一个友方目标' },
    { name: '神圣制裁', icon: '⚡', damage: [16, 26], manaCost: 10, type: 'magic_damage', description: '对敌人造成神圣伤害' },
    { name: '复仇者之盾', icon: '🛡️', damage: [14, 22], manaCost: 12, type: 'magic_damage', description: '投掷盾牌攻击多个敌人' },
    { name: '圣光闪现', icon: '✨', healing: [15, 22], manaCost: 8, type: 'heal', description: '快速治疗一个目标' },
    { name: '奉献', icon: '🔥', damage: [12, 18], manaCost: 10, type: 'magic_damage', description: '神圣之火灼烧敌人' },
    { name: '神圣打击', icon: '⚔️', damage: [18, 28], manaCost: 12, type: 'physical_damage', description: '神圣加持的近战攻击' },
    { name: '神圣震击', icon: '💫', damage: [18, 28], manaCost: 14, type: 'magic_damage', description: '释放神圣能量' },
    { name: '神圣之光', icon: '🌟', healing: [35, 50], manaCost: 20, type: 'heal', description: '强力治疗术' },
    { name: '审判', icon: '⚔️', damage: [22, 36], manaCost: 16, type: 'magic_damage', description: '神圣审判' },
    { name: '神圣风暴', icon: '⚡', damage: [35, 52], manaCost: 28, type: 'magic_damage', description: '终极技能，造成范围神圣伤害' }
  ],
  hunter: [
    { name: '稳固射击', icon: '🏹', damage: [16, 24], manaCost: 8, type: 'physical_damage', description: '一次稳定的射击' },
    { name: '奥术射击', icon: '✨', damage: [14, 22], manaCost: 10, type: 'magic_damage', description: '附魔的箭矢攻击' },
    { name: '多重射击', icon: '🎯', damage: [18, 28], manaCost: 14, type: 'physical_damage', description: '同时射击多个目标' },
    { name: '毒蛇钉刺', icon: '🐍', damage: [12, 18], manaCost: 8, type: 'physical_damage', description: '射出毒箭' },
    { name: '乱射', icon: '🎯', damage: [15, 24], manaCost: 12, type: 'physical_damage', description: '向周围发射箭矢' },
    { name: '陷阱', icon: '🪤', damage: [15, 24], manaCost: 10, type: 'physical_damage', description: '放置陷阱' },
    { name: '震荡射击', icon: '💥', damage: [18, 28], manaCost: 10, type: 'physical_damage', description: '造成冲击伤害' },
    { name: '瞄准射击', icon: '🎯', damage: [25, 38], manaCost: 16, type: 'physical_damage', description: '精准瞄准射击' },
    { name: '奇美拉射击', icon: '🦅', damage: [22, 34], manaCost: 18, type: 'magic_damage', description: '释放魔法箭矢' },
    { name: '杀戮命令', icon: '🐺', damage: [38, 58], manaCost: 25, type: 'physical_damage', description: '终极技能，命令宠物致命攻击' }
  ],
  rogue: [
    { name: '影袭', icon: '🗡️', damage: [16, 24], manaCost: 8, type: 'physical_damage', description: '快速的暗影攻击' },
    { name: '背刺', icon: '🗡️', damage: [24, 36], manaCost: 12, type: 'physical_damage', description: '从背后发起致命攻击' },
    { name: '凿击', icon: '💢', damage: [14, 20], manaCost: 10, type: 'physical_damage', description: '快速打击敌人' },
    { name: '毁伤', icon: '💀', damage: [22, 34], manaCost: 14, type: 'physical_damage', description: '使用两把武器同时攻击' },
    { name: '毒刃', icon: '☠️', damage: [16, 24], manaCost: 10, type: 'physical_damage', description: '涂毒的武器攻击' },
    { name: '切割', icon: '⚔️', damage: [18, 28], manaCost: 10, type: 'physical_damage', description: '快速切割' },
    { name: '刺骨', icon: '❄️', damage: [20, 32], manaCost: 12, type: 'physical_damage', description: '终结技' },
    { name: '出血', icon: '🩸', damage: [18, 26], manaCost: 10, type: 'physical_damage', description: '造成流血伤害' },
    { name: '要害打击', icon: '🎯', damage: [22, 34], manaCost: 14, type: 'physical_damage', description: '攻击要害' },
    { name: '伏击', icon: '🗡️', damage: [40, 60], manaCost: 22, type: 'physical_damage', description: '终极技能，致命伏击' }
  ],
  warlock: [
    { name: '暗影箭', icon: '💜', damage: [18, 28], manaCost: 10, type: 'magic_damage', description: '发射暗影能量' },
    { name: '腐化', icon: '🖤', damage: [14, 20], manaCost: 8, type: 'magic_damage', description: '暗影伤害' },
    { name: '痛苦打击', icon: '😈', damage: [12, 18], manaCost: 10, type: 'magic_damage', description: '痛苦魔法攻击' },
    { name: '献祭', icon: '🔥', damage: [16, 24], manaCost: 12, type: 'magic_damage', description: '点燃敌人' },
    { name: '暗影灼烧', icon: '🖤', damage: [20, 32], manaCost: 14, type: 'magic_damage', description: '暗影火焰' },
    { name: '腐蚀之种', icon: '🌱', damage: [22, 34], manaCost: 18, type: 'magic_damage', description: '种下腐蚀种子' },
    { name: '生命吸取', icon: '💚', healing: [12, 18], manaCost: 10, type: 'heal', description: '吸取敌人生命' },
    { name: '灵魂之火', icon: '🔥', damage: [28, 42], manaCost: 20, type: 'magic_damage', description: '强力火焰攻击' },
    { name: '恶魔箭', icon: '🐕', damage: [20, 32], manaCost: 16, type: 'magic_damage', description: '恶魔能量攻击' },
    { name: '混乱之箭', icon: '💥', damage: [45, 65], manaCost: 30, type: 'magic_damage', description: '终极技能，混沌伤害' }
  ],
  druid: [
    { name: '星火术', icon: '⭐', damage: [18, 26], manaCost: 10, type: 'magic_damage', description: '释放星界能量' },
    { name: '愤怒', icon: '🔥', damage: [14, 20], manaCost: 8, type: 'magic_damage', description: '快速的自然攻击' },
    { name: '月火术', icon: '🌙', damage: [16, 24], manaCost: 10, type: 'magic_damage', description: '月神祝福的攻击' },
    { name: '愈合', icon: '🌿', healing: [20, 32], manaCost: 14, type: 'heal', description: '治疗一个目标' },
    { name: '回春术', icon: '🌸', healing: [12, 18], manaCost: 10, type: 'heal', description: '治疗效果' },
    { name: '荆棘打击', icon: '🌵', damage: [10, 14], manaCost: 8, type: 'magic_damage', description: '荆棘攻击' },
    { name: '野性冲锋', icon: '🐾', damage: [18, 28], manaCost: 12, type: 'physical_damage', description: '野性形态的冲锋攻击' },
    { name: '狂暴回复', icon: '❤️', healing: [25, 38], manaCost: 16, type: 'heal', description: '强力治疗技能' },
    { name: '撕碎', icon: '🐾', damage: [20, 32], manaCost: 14, type: 'physical_damage', description: '利爪攻击' },
    { name: '星辰坠落', icon: '✨', damage: [42, 62], manaCost: 28, type: 'magic_damage', description: '终极技能，召唤星雨攻击' }
  ],
  priest: [
    { name: '治疗术', icon: '💚', healing: [22, 34], manaCost: 12, type: 'heal', description: '基础治疗技能' },
    { name: '快速治疗', icon: '⚡', healing: [18, 26], manaCost: 10, type: 'heal', description: '快速治疗一个目标' },
    { name: '惩击', icon: '✝️', damage: [16, 24], manaCost: 10, type: 'magic_damage', description: '神圣伤害攻击' },
    { name: '神圣之火', icon: '🔥', damage: [18, 28], manaCost: 12, type: 'magic_damage', description: '神圣火焰攻击' },
    { name: '光明之泉', icon: '🛡️', healing: [15, 22], manaCost: 14, type: 'heal', description: '召唤光明之泉' },
    { name: '恢复', icon: '💚', healing: [10, 16], manaCost: 8, type: 'heal', description: '持续治疗' },
    { name: '精神鞭笞', icon: '💫', damage: [14, 22], manaCost: 10, type: 'magic_damage', description: '精神能量攻击' },
    { name: '治疗祷言', icon: '🙏', healing: [28, 42], manaCost: 18, type: 'heal', description: '群体治疗' },
    { name: '神圣新星', icon: '✨', damage: [18, 28], manaCost: 16, type: 'magic_damage', description: '神圣能量爆发' },
    { name: '神圣赞美诗', icon: '🎵', healing: [45, 65], manaCost: 32, type: 'heal', description: '终极技能，强力群体治疗' }
  ],
  shaman: [
    { name: '闪电箭', icon: '⚡', damage: [18, 28], manaCost: 10, type: 'magic_damage', description: '闪电攻击' },
    { name: '熔岩爆裂', icon: '🌋', damage: [22, 34], manaCost: 14, type: 'magic_damage', description: '爆发性火焰伤害' },
    { name: '治疗波', icon: '🌊', healing: [24, 36], manaCost: 14, type: 'heal', description: '治疗一个目标' },
    { name: '治疗链', icon: '⚓', healing: [20, 30], manaCost: 16, type: 'heal', description: '治疗多个目标' },
    { name: '烈焰震击', icon: '🔥', damage: [16, 24], manaCost: 10, type: 'magic_damage', description: '火焰震击' },
    { name: '冰霜震击', icon: '❄️', damage: [14, 22], manaCost: 10, type: 'magic_damage', description: '冰霜震击' },
    { name: '闪电链', icon: '⚡', damage: [20, 30], manaCost: 16, type: 'magic_damage', description: '闪电跳跃攻击多个目标' },
    { name: '风怒打击', icon: '🌀', damage: [20, 32], manaCost: 14, type: 'physical_damage', description: '风怒攻击' },
    { name: '元素打击', icon: '🔥', damage: [22, 34], manaCost: 16, type: 'magic_damage', description: '元素攻击' },
    { name: '地震术', icon: '🌍', damage: [40, 60], manaCost: 28, type: 'magic_damage', description: '终极技能，引发地震' }
  ],
  deathknight: [
    { name: '冰冷触摸', icon: '❄️', damage: [16, 24], manaCost: 10, type: 'magic_damage', description: '冰霜能量攻击' },
    { name: '暗影打击', icon: '🖤', damage: [18, 28], manaCost: 12, type: 'physical_damage', description: '暗影攻击' },
    { name: '死亡之握', icon: '💀', damage: [14, 22], manaCost: 12, type: 'physical_damage', description: '将敌人拉到身边' },
    { name: '心脏打击', icon: '❤️', damage: [20, 32], manaCost: 14, type: 'physical_damage', description: '强力攻击' },
    { name: '灵界打击', icon: '👻', damage: [18, 28], manaCost: 12, type: 'physical_damage', description: '攻击并治疗自己' },
    { name: '冰霜打击', icon: '🧊', damage: [20, 32], manaCost: 14, type: 'magic_damage', description: '冰霜攻击' },
    { name: '死亡凋零', icon: '💀', damage: [22, 34], manaCost: 18, type: 'magic_damage', description: '区域伤害' },
    { name: '符文刃舞', icon: '⚔️', damage: [24, 36], manaCost: 20, type: 'physical_damage', description: '召唤符文武器' },
    { name: '天灾打击', icon: '💀', damage: [26, 40], manaCost: 18, type: 'magic_damage', description: '天灾力量攻击' },
    { name: '辛达苟萨之息', icon: '🐉', damage: [45, 65], manaCost: 30, type: 'magic_damage', description: '终极技能，冰霜巨龙的吐息' }
  ],
  monk: [
    { name: '贯日击', icon: '☀️', damage: [16, 24], manaCost: 8, type: 'physical_damage', description: '基础攻击' },
    { name: '猛虎掌', icon: '🐯', damage: [18, 28], manaCost: 10, type: 'physical_damage', description: '虎形拳攻击' },
    { name: '旭日东升踢', icon: '🌅', damage: [22, 34], manaCost: 14, type: 'physical_damage', description: '强力踢击' },
    { name: '神鹤引项踢', icon: '🦢', damage: [20, 30], manaCost: 12, type: 'physical_damage', description: '鹤形踢击' },
    { name: '禅意珠', icon: '🔮', healing: [14, 22], manaCost: 10, type: 'heal', description: '放置治疗珠' },
    { name: '幻灭踢', icon: '💫', damage: [18, 28], manaCost: 10, type: 'physical_damage', description: '快速攻击' },
    { name: '扫堂腿', icon: '🦶', damage: [14, 22], manaCost: 8, type: 'physical_damage', description: '扫击敌人' },
    { name: '移花接木', icon: '🌺', healing: [22, 34], manaCost: 14, type: 'heal', description: '治疗技能' },
    { name: '铁山靠', icon: '🧱', damage: [22, 34], manaCost: 16, type: 'physical_damage', description: '强力撞击' },
    { name: '怒雷破', icon: '⚡', damage: [42, 62], manaCost: 26, type: 'physical_damage', description: '终极技能，释放雷电之力' }
  ],
  demonhunter: [
    { name: '混乱打击', icon: '🔥', damage: [18, 28], manaCost: 10, type: 'magic_damage', description: '混乱能量攻击' },
    { name: '刃舞', icon: '⚔️', damage: [16, 24], manaCost: 8, type: 'physical_damage', description: '挥舞双刃攻击' },
    { name: '邪能冲锋', icon: '💨', damage: [20, 32], manaCost: 14, type: 'magic_damage', description: '冲锋并造成伤害' },
    { name: '邪能打击', icon: '✨', damage: [18, 28], manaCost: 12, type: 'magic_damage', description: '邪能攻击' },
    { name: '投掷利刃', icon: '🗡️', damage: [18, 26], manaCost: 10, type: 'physical_damage', description: '投掷利刃' },
    { name: '眼棱', icon: '👁️', damage: [28, 42], manaCost: 18, type: 'magic_damage', description: '眼睛发射邪能射线' },
    { name: '毁灭打击', icon: '😈', damage: [24, 36], manaCost: 16, type: 'magic_damage', description: '毁灭攻击' },
    { name: '献祭光环', icon: '🔥', damage: [14, 20], manaCost: 12, type: 'magic_damage', description: '灼烧周围敌人' },
    { name: '幽魂锁链', icon: '🔗', damage: [22, 32], manaCost: 16, type: 'magic_damage', description: '灵魂锁链攻击' },
    { name: '浩劫', icon: '💥', damage: [48, 70], manaCost: 32, type: 'magic_damage', description: '终极技能，毁灭性的邪能爆发' }
  ]
}

/**
 * 默认技能数据（法师技能）
 * @type {SkillData[]}
 */
export const ABILITIES = CLASS_ABILITIES.mage

/**
 * 数据验证逻辑
 * 确保每个职业严格配置10个技能，防止技能数据错误关联
 */
export function validateClassData(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // 验证每个职业的技能数量
  for (const [classId, classData] of Object.entries(CLASSES)) {
    const abilities = CLASS_ABILITIES[classId]
    
    if (!abilities) {
      errors.push(`职业 ${classData.name} (${classId}) 缺少技能数据`)
      continue
    }
    
    if (abilities.length !== 10) {
      errors.push(`职业 ${classData.name} (${classId}) 的技能数量为 ${abilities.length}，应为 10`)
    }
    
    // 验证每个技能的完整性
    abilities.forEach((ability, index) => {
      if (!ability.name || !ability.icon) {
        errors.push(`职业 ${classData.name} 的第 ${index + 1} 个技能缺少名称或图标`)
      }
      
      if (ability.manaCost === undefined || ability.manaCost < 0) {
        errors.push(`职业 ${classData.name} 的技能 "${ability.name}" 法力值消耗无效`)
      }
      
      if (!ability.type) {
        errors.push(`职业 ${classData.name} 的技能 "${ability.name}" 缺少技能类型`)
      }
    })
  }
  
  // 验证所有技能数据对应的职业是否存在
  for (const [classId] of Object.entries(CLASS_ABILITIES)) {
    if (!CLASSES[classId]) {
      errors.push(`技能数据中存在无效的职业ID: ${classId}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 获取指定职业的技能
 * @param classId 职业ID
 * @returns 技能数组
 */
export function getClassAbilities(classId: string): SkillData[] {
  if (!CLASSES[classId]) {
    throw new Error(`无效的职业ID: ${classId}`)
  }
  
  const abilities = CLASS_ABILITIES[classId]
  if (!abilities || abilities.length !== 10) {
    throw new Error(`职业 ${classId} 的技能数据配置不正确`)
  }
  
  return [...abilities] // 返回副本防止意外修改
}
