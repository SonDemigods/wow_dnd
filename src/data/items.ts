import type { ItemTypeData, LootItemData } from '../types'

export const ITEM_TYPES: Record<string, ItemTypeData> = {
  gold: { name: '货币', stackable: true, maxStack: 999999 },
  potion: { name: '药水', stackable: true, maxStack: 20, usable: true },
  scroll: { name: '卷轴', stackable: true, maxStack: 10, usable: true },
  food: { name: '食物', stackable: true, maxStack: 20, usable: true },
  material: { name: '材料', stackable: true, maxStack: 99 },
  quest: { name: '任务物品', stackable: true, maxStack: 1 }
}

export const LOOT_ITEMS: LootItemData[] = [
  {
    name: '小型生命药水',
    icon: '❤️',
    type: 'potion',
    healing: 30,
    rarity: 'common',
    description: '恢复30点生命值',
    template: 'smallHealthPotion'
  },
  {
    name: '中型生命药水',
    icon: '💗',
    type: 'potion',
    healing: 60,
    rarity: 'uncommon',
    description: '恢复60点生命值',
    template: 'mediumHealthPotion'
  },
  {
    name: '大型生命药水',
    icon: '💖',
    type: 'potion',
    healing: 100,
    rarity: 'rare',
    description: '恢复100点生命值',
    template: 'largeHealthPotion'
  },
  {
    name: '小型法力药水',
    icon: '💙',
    type: 'potion',
    manaRestore: 30,
    rarity: 'common',
    description: '恢复30点法力值',
    template: 'smallManaPotion'
  },
  {
    name: '中型法力药水',
    icon: '💎',
    type: 'potion',
    manaRestore: 60,
    rarity: 'uncommon',
    description: '恢复60点法力值',
    template: 'mediumManaPotion'
  },
  {
    name: '大型法力药水',
    icon: '🔮',
    type: 'potion',
    manaRestore: 100,
    rarity: 'rare',
    description: '恢复100点法力值',
    template: 'largeManaPotion'
  },
  {
    name: '力量药水',
    icon: '💪',
    type: 'potion',
    statBonus: { str: 1 },
    rarity: 'uncommon',
    description: '永久增加1点力量',
    template: 'strengthPotion'
  },
  {
    name: '敏捷药水',
    icon: '🦶',
    type: 'potion',
    statBonus: { dex: 1 },
    rarity: 'uncommon',
    description: '永久增加1点敏捷',
    template: 'agilityPotion'
  },
  {
    name: '体质药水',
    icon: '🏋️',
    type: 'potion',
    statBonus: { con: 1 },
    rarity: 'uncommon',
    description: '永久增加1点体质',
    template: 'constitutionPotion'
  },
  {
    name: '智力药水',
    icon: '🧠',
    type: 'potion',
    statBonus: { int: 1 },
    rarity: 'uncommon',
    description: '永久增加1点智力',
    template: 'intelligencePotion'
  },
  {
    name: '感知药水',
    icon: '👁️',
    type: 'potion',
    statBonus: { wis: 1 },
    rarity: 'uncommon',
    description: '永久增加1点感知',
    template: 'wisdomPotion'
  },
  {
    name: '魅力药水',
    icon: '💃',
    type: 'potion',
    statBonus: { cha: 1 },
    rarity: 'uncommon',
    description: '永久增加1点魅力',
    template: 'charismaPotion'
  },
  {
    name: '面包',
    icon: '🍞',
    type: 'food',
    healing: 20,
    rarity: 'common',
    description: '恢复20点生命值',
    template: 'bread'
  },
  {
    name: '烤肉',
    icon: '🍖',
    type: 'food',
    healing: 40,
    rarity: 'uncommon',
    description: '恢复40点生命值',
    template: 'roastedMeat'
  },
  {
    name: '魔法面包',
    icon: '✨',
    type: 'food',
    healing: 60,
    rarity: 'rare',
    description: '恢复60点生命值',
    template: 'magicBread'
  },
  {
    name: '火球术卷轴',
    icon: '📜',
    type: 'scroll',
    effect: 'damage',
    damage: [25, 40],
    rarity: 'uncommon',
    description: '对敌人造成25-40点伤害',
    template: 'scrollFireball'
  },
  {
    name: '治愈卷轴',
    icon: '📜',
    type: 'scroll',
    effect: 'heal',
    healing: 50,
    rarity: 'uncommon',
    description: '恢复50点生命值',
    template: 'scrollHeal'
  },
  {
    name: '护盾卷轴',
    icon: '📜',
    type: 'scroll',
    effect: 'shield',
    shield: 40,
    rarity: 'uncommon',
    description: '获得40点护盾',
    template: 'scrollShield'
  },
  {
    name: '古老的钥匙',
    icon: '🗝️',
    type: 'quest',
    rarity: 'rare',
    description: '据说能打开某扇神秘的门...',
    template: 'ancientKey'
  },
  {
    name: '龙鳞碎片',
    icon: '🐉',
    type: 'material',
    rarity: 'rare',
    description: '巨龙的鳞片碎片',
    template: 'dragonScale'
  },
  {
    name: '魔法粉尘',
    icon: '✨',
    type: 'material',
    rarity: 'common',
    description: '蕴含魔力的粉末',
    template: 'magicDust'
  },
  {
    name: '治疗水晶',
    icon: '💎',
    type: 'potion',
    healing: 80,
    rarity: 'rare',
    description: '恢复80点生命值',
    template: 'healingCrystal'
  },
  {
    name: '符文石',
    icon: '🔮',
    type: 'material',
    rarity: 'uncommon',
    description: '刻有古老符文的石头',
    template: 'runeStone'
  }
]
