import type { ClassData, Ability } from '../types'

export const CLASSES: Record<string, ClassData> = {
  warrior: {
    name: '战士',
    icon: '⚔️',
    hitDie: 12,
    primaryStat: 'str',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['重击', '盾墙', '横扫', '旋风斩'],
    description: '精通所有武器和护甲，是战场上的中坚力量',
    color: '#C79C6E'
  },
  mage: {
    name: '法师',
    icon: '🧙',
    hitDie: 6,
    primaryStat: 'int',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['火球术', '冰霜新星', '奥术飞弹', '暴风雪'],
    description: '操控奥术、冰霜和火焰魔法的施法者',
    color: '#69CCF0'
  },
  paladin: {
    name: '圣骑士',
    icon: '🔨',
    hitDie: 10,
    primaryStat: 'cha',
    factions: ['alliance', 'horde'],
    abilities: ['圣光术', '神圣制裁', '复仇之锤', '神圣护盾'],
    description: '神圣的战士，使用圣光之力治疗和保护',
    color: '#F58CBA'
  },
  hunter: {
    name: '猎人',
    icon: '🏹',
    hitDie: 10,
    primaryStat: 'dex',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['多重射击', '陷阱', '野兽控制', '鹰眼射击'],
    description: '远程武器和野兽控制专家',
    color: '#ABD473'
  },
  rogue: {
    name: '潜行者',
    icon: '🗡️',
    hitDie: 8,
    primaryStat: 'dex',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['背刺', '消失', '毒药', '致命打击'],
    description: '擅长偷袭和暗杀的敏捷杀手',
    color: '#FFF569'
  },
  warlock: {
    name: '术士',
    icon: '💜',
    hitDie: 8,
    primaryStat: 'int',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['暗影箭', '腐化', '恐惧', '地狱火'],
    description: '使用暗影魔法的危险施法者',
    color: '#9482C9'
  },
  druid: {
    name: '德鲁伊',
    icon: '🌿',
    hitDie: 8,
    primaryStat: 'wis',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['星火术', '愈合', '熊形态', '月火术'],
    description: '自然的守护者，可变身为多种形态',
    color: '#FF7D0A'
  },
  priest: {
    name: '牧师',
    icon: '✝️',
    hitDie: 8,
    primaryStat: 'wis',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['治疗术', '真言术', '神圣新星', '心灵尖啸'],
    description: '圣光的仆从，擅长治疗和驱散',
    color: '#FFFFFF'
  },
  shaman: {
    name: '萨满',
    icon: '⚡',
    hitDie: 8,
    primaryStat: 'wis',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['闪电箭', '治疗波', '元素召唤', '大地震击'],
    description: '与元素之灵沟通的通灵者',
    color: '#0070DE'
  },
  deathknight: {
    name: '死亡骑士',
    icon: '💀',
    hitDie: 12,
    primaryStat: 'str',
    factions: ['alliance', 'horde'],
    abilities: ['死亡之握', '冰冷触摸', '暗影打击', '冰霜之柱'],
    description: '由死亡中苏醒的骑士，掌控着冰霜与暗影之力',
    color: '#C41F3B'
  },
  monk: {
    name: '武僧',
    icon: '🥋',
    hitDie: 8,
    primaryStat: 'dex',
    factions: ['alliance', 'horde', 'neutral'],
    abilities: ['猛虎掌', '旭日东升踢', '禅意凝聚', '神鹤引项踢'],
    description: '掌握着古老武学之道的修行者',
    color: '#00FF96'
  },
  demonhunter: {
    name: '恶魔猎手',
    icon: '👿',
    hitDie: 10,
    primaryStat: 'dex',
    factions: ['alliance', 'horde'],
    abilities: ['刃舞', '吞噬魔法', '邪能冲锋', '眼棱'],
    description: '为对抗燃烧军团而生的暗影猎人',
    color: '#A330C9'
  }
}

export const CLASS_ABILITIES: Record<string, Ability[]> = {
  warrior: [
    { name: '重击', icon: '⚔️', damage: [20, 35], manaCost: 10, type: 'damage' },
    { name: '盾墙', icon: '🛡️', shield: 50, manaCost: 15, type: 'shield' },
    { name: '横扫', icon: '💫', damage: [15, 25], manaCost: 8, type: 'damage' },
    { name: '旋风斩', icon: '🌀', damage: [25, 40], manaCost: 12, type: 'damage' }
  ],
  mage: [
    { name: '火球术', icon: '🔥', damage: [25, 40], manaCost: 12, type: 'damage' },
    { name: '冰霜新星', icon: '❄️', damage: [15, 30], manaCost: 10, type: 'damage' },
    { name: '奥术飞弹', icon: '✨', damage: [10, 20], manaCost: 6, type: 'damage' },
    { name: '暴风雪', icon: '🌨️', damage: [30, 50], manaCost: 18, type: 'damage' }
  ],
  paladin: [
    { name: '圣光术', icon: '☀️', healing: [30, 45], manaCost: 12, type: 'heal' },
    { name: '神圣制裁', icon: '⚡', damage: [20, 35], manaCost: 10, type: 'damage' },
    { name: '复仇之锤', icon: '🔨', damage: [25, 40], manaCost: 12, type: 'damage' },
    { name: '神圣护盾', icon: '🛡️', shield: 60, manaCost: 15, type: 'shield' }
  ],
  hunter: [
    { name: '多重射击', icon: '🏹', damage: [18, 30], manaCost: 8, type: 'damage' },
    { name: '陷阱', icon: '🪤', damage: [10, 20], manaCost: 5, type: 'damage' },
    { name: '野兽控制', icon: '🐺', damage: [15, 25], manaCost: 8, type: 'damage' },
    { name: '鹰眼射击', icon: '🎯', damage: [35, 55], manaCost: 15, type: 'damage' }
  ],
  rogue: [
    { name: '背刺', icon: '🗡️', damage: [30, 45], manaCost: 10, type: 'damage' },
    { name: '消失', icon: '👻', shield: 40, manaCost: 12, type: 'shield' },
    { name: '毒药', icon: '☠️', damage: [12, 25], manaCost: 6, type: 'damage' },
    { name: '致命打击', icon: '💀', damage: [35, 55], manaCost: 15, type: 'damage' }
  ],
  warlock: [
    { name: '暗影箭', icon: '💜', damage: [25, 40], manaCost: 12, type: 'damage' },
    { name: '腐化', icon: '🖤', damage: [15, 30], manaCost: 10, type: 'damage' },
    { name: '恐惧', icon: '👹', shield: 35, manaCost: 12, type: 'shield' },
    { name: '地狱火', icon: '🔥', damage: [40, 60], manaCost: 20, type: 'damage' }
  ],
  druid: [
    { name: '星火术', icon: '⭐', damage: [20, 35], manaCost: 10, type: 'damage' },
    { name: '愈合', icon: '🌿', healing: [25, 40], manaCost: 12, type: 'heal' },
    { name: '熊形态', icon: '🐻', shield: 45, manaCost: 12, type: 'shield' },
    { name: '月火术', icon: '🌙', damage: [18, 32], manaCost: 8, type: 'damage' }
  ],
  priest: [
    { name: '治疗术', icon: '💚', healing: [30, 50], manaCost: 12, type: 'heal' },
    { name: '真言术', icon: '✝️', shield: 40, manaCost: 12, type: 'shield' },
    { name: '神圣新星', icon: '🌟', damage: [15, 25], manaCost: 8, type: 'damage' },
    { name: '心灵尖啸', icon: '🎵', damage: [22, 38], manaCost: 10, type: 'damage' }
  ],
  shaman: [
    { name: '闪电箭', icon: '⚡', damage: [22, 38], manaCost: 10, type: 'damage' },
    { name: '治疗波', icon: '🌊', healing: [25, 40], manaCost: 12, type: 'heal' },
    { name: '元素召唤', icon: '🔥', damage: [18, 32], manaCost: 10, type: 'damage' },
    { name: '大地震击', icon: '🌍', damage: [28, 45], manaCost: 14, type: 'damage' }
  ],
  deathknight: [
    { name: '死亡之握', icon: '💀', damage: [22, 35], manaCost: 10, type: 'damage' },
    { name: '冰冷触摸', icon: '❄️', damage: [18, 30], manaCost: 8, type: 'damage' },
    { name: '暗影打击', icon: '🖤', damage: [25, 40], manaCost: 12, type: 'damage' },
    { name: '冰霜之柱', icon: '🧊', damage: [30, 50], manaCost: 15, type: 'damage' }
  ],
  monk: [
    { name: '猛虎掌', icon: '🐯', damage: [20, 32], manaCost: 8, type: 'damage' },
    { name: '旭日东升踢', icon: '🌅', damage: [25, 40], manaCost: 12, type: 'damage' },
    { name: '禅意凝聚', icon: '☯️', healing: [30, 45], manaCost: 14, type: 'heal' },
    { name: '神鹤引项踢', icon: '🦢', damage: [28, 45], manaCost: 12, type: 'damage' }
  ],
  demonhunter: [
    { name: '刃舞', icon: '⚔️', damage: [22, 38], manaCost: 10, type: 'damage' },
    { name: '吞噬魔法', icon: '👁️', shield: 50, manaCost: 12, type: 'shield' },
    { name: '邪能冲锋', icon: '🔥', damage: [28, 45], manaCost: 14, type: 'damage' },
    { name: '眼棱', icon: '💜', damage: [35, 55], manaCost: 18, type: 'damage' }
  ]
}

export const ABILITIES = CLASS_ABILITIES.mage
