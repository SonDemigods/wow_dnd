export interface Stats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface Attributes {
  maxHp: number
  maxMana: number
  physicalAttack: number
  physicalDefense: number
  magicAttack: number
  magicDefense: number
  healBonus: number
  critChance: number
  dodgeChance: number
  initiative: number
}

export interface Character {
  name: string
  faction: 'alliance' | 'horde' | null
  race: string | null
  class: string | null
  level: number
  exp: number
  expToNextLevel: number
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  stats: Stats
  gold: number
}

export interface InventoryItem {
  id: string
  name: string
  type: string
  rarity: string
  icon: string
  description: string
  stats?: Partial<Stats>
  value: number
  stackable: boolean
  count: number
}

export interface Quest {
  id: string
  title: string
  description: string
  objectives: QuestObjective[]
  rewards: QuestReward[]
  status: 'available' | 'active' | 'completed'
  level: number
}

export interface QuestObjective {
  id: string
  type: string
  target: string
  count: number
  current: number
  description: string
}

export interface QuestReward {
  type: 'gold' | 'exp' | 'item'
  amount?: number
  item?: InventoryItem
}

export interface Enemy {
  id: string
  name: string
  type: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  expReward: number
  goldReward: number
  icon: string
  loot: InventoryItem[]
}

export interface Location {
  id: string
  name: string
  description: string
  icon: string
  faction: 'alliance' | 'horde' | 'neutral'
  enemies: string[]
  quests: string[]
  mapSize: number
}

export interface MapTile {
  x: number
  y: number
  type: 'empty' | 'wall' | 'enemy' | 'item' | 'exit' | 'npc'
  discovered: boolean
  data?: any
}

export interface LogEntry {
  id: string
  timestamp: number
  type: 'info' | 'combat' | 'quest' | 'item' | 'level'
  message: string
  icon?: string
}

// 新增类型定义
export type FactionType = 'alliance' | 'horde' | 'neutral'

export interface FactionData {
  name: string
  icon: string
  color: string
  description: string
}

export interface RaceData {
  name: string
  icon: string
  faction: FactionType
  bonus: Partial<Stats>
  description: string
}

export interface ClassData {
  name: string
  icon: string
  hitDie: number
  primaryStat: keyof Stats
  factions: FactionType[]
  abilities: string[]
  description: string
  color: string
}

export interface Ability {
  name: string
  icon: string
  damage?: [number, number]
  healing?: [number, number]
  shield?: number
  manaCost: number
  type: 'damage' | 'heal' | 'shield'
}

export interface ItemTypeData {
  name: string
  stackable: boolean
  maxStack: number
  usable?: boolean
}

export interface LootItemData {
  name: string
  icon: string
  type: string
  healing?: number
  manaRestore?: number
  statBonus?: Partial<Stats>
  effect?: 'damage' | 'heal' | 'shield'
  damage?: [number, number]
  rarity: string
  description: string
  template: string
}

export interface EnemyData {
  name: string
  icon: string
  hp: number
  damage: [number, number]
  xp: number
  gold: number
  dangerLevel: string
}

export interface ContinentData {
  name: string
  icon: string
  description: string
  position: string
  color: string
}

export interface LocationData {
  name: string
  displayName: string
  icon: string
  description: string
  continent: string
  region: string
  enemies: string[]
  levelRange: [number, number]
  color: string
  mapX: number
  mapY: number
}

export interface QuestData {
  key: string
  locationKey: string
  name: string
  description: string
  objectives: {
    type: 'kill'
    enemyKey: string
    target: number
  }[]
  reward: {
    xp: number
    gold: number
  }
}
