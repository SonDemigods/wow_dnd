const FACTIONS = {
  alliance: {
    name: '联盟',
    icon: '🛡️',
    color: '#0078ff',
    description: '人类、矮人、侏儒、夜精灵和德莱尼组成的古老同盟'
  },
  horde: {
    name: '部落',
    icon: '⚔️',
    color: '#ff4400',
    description: '兽人、牛头人、巨魔、血精灵和被遗忘者建立的松散联盟'
  }
};

const RACES = {
  human: {
    name: '人类',
    icon: '🧑',
    faction: 'alliance',
    bonus: { str: 1, cha: 1 },
    description: '艾泽拉斯最常见的种族，适应性强，擅长外交'
  },
  dwarf: {
    name: '矮人',
    icon: '🧔',
    faction: 'alliance',
    bonus: { con: 2, wis: 1 },
    description: '坚韧的工匠种族，擅长挖矿和锻造'
  },
  gnome: {
    name: '侏儒',
    icon: '🤖',
    faction: 'alliance',
    bonus: { int: 2, dex: 1 },
    description: '天才的发明家，掌控着最前沿的机械和魔法技术'
  },
  nightelf: {
    name: '夜精灵',
    icon: '🧝',
    faction: 'alliance',
    bonus: { dex: 2, wis: 1 },
    description: '古老的暗夜精灵后裔，敏捷且与自然有深厚联系'
  },
  draenei: {
    name: '德莱尼',
    icon: '✨',
    faction: 'alliance',
    bonus: { wis: 2, cha: 1 },
    description: '来自外域的流亡者，拥有圣光的力量'
  },
  worgen: {
    name: '狼人',
    icon: '🐺',
    faction: 'alliance',
    bonus: { dex: 2, str: 1 },
    description: '被诅咒的吉尔尼斯人，月圆之夜会化为凶猛的狼人'
  },
  pandaren: {
    name: '熊猫人',
    icon: '🐼',
    faction: 'neutral',
    bonus: { con: 1, wis: 1, dex: 1 },
    description: '古老而神秘的中立种族，传承着古老的武学之道'
  },
  orc: {
    name: '兽人',
    icon: '👹',
    faction: 'horde',
    bonus: { str: 2, con: 1 },
    description: '来自德拉诺的战士种族，拥有超凡的力量和韧性'
  },
  undead: {
    name: '被遗忘者',
    icon: '💀',
    faction: 'horde',
    bonus: { int: 2, dex: 1 },
    description: '希尔瓦娜斯率领的亡灵，渴望自由和复仇'
  },
  tauren: {
    name: '牛头人',
    icon: '🐂',
    faction: 'horde',
    bonus: { con: 2, wis: 1 },
    description: '与大地母亲和谐的游牧民族，敬畏自然'
  },
  troll: {
    name: '巨魔',
    icon: '🧌',
    faction: 'horde',
    bonus: { dex: 2, str: 1 },
    description: '古老的丛林巨魔，拥有强大的再生能力'
  },
  bloodelves: {
    name: '血精灵',
    icon: '🧜',
    faction: 'horde',
    bonus: { int: 2, cha: 1 },
    description: '渴望魔力的高贵种族，精通奥术能量'
  },
  goblin: {
    name: '地精',
    icon: '👺',
    faction: 'horde',
    bonus: { dex: 1, cha: 2 },
    description: '精明的商人种族，掌控着艾泽拉斯的商业命脉'
  }
};
