/**
 * @fileoverview 游戏类型定义
 * @description 包含魔兽世界风格RPG游戏的所有核心类型定义
 * @module types
 */

/**
 * 角色核心属性
 * 力量、敏捷、体质、智力、感知、魅力 - D&D风格的六大核心属性
 */
export interface Stats {
  /** 力量 - 影响物理攻击和负重 */
  str: number
  /** 敏捷 - 影响闪避、暴击和先攻 */
  dex: number
  /** 体质 - 影响生命值和物理防御 */
  con: number
  /** 智力 - 影响魔法攻击和法力值 */
  int: number
  /** 感知 - 影响魔法防御和治疗加成 */
  wis: number
  /** 魅力 - 影响对话和特定职业能力 */
  cha: number
}

/**
 * 角色衍生属性
 * 基于核心 Stats 计算得出的战斗和生存属性
 */
export interface Attributes {
  /** 最大生命值 */
  maxHp: number
  /** 最大法力值 */
  maxMana: number
  /** 物理攻击力 */
  physicalAttack: number
  /** 物理防御力 */
  physicalDefense: number
  /** 魔法攻击力 */
  magicAttack: number
  /** 魔法防御力 */
  magicDefense: number
  /** 暴击几率(%) */
  critChance: number
  /** 闪避几率(%) */
  dodgeChance: number
  /** 每级HP加成 */
  hpBonus: number
  /** 每级MP加成 */
  mpBonus: number
  /** 治疗加成 */
  healBonus: number
}

/**
 * 玩家角色数据
 * 包含角色的所有核心信息和状态
 */
export interface Character {
  /** 角色名称 */
  name: string
  /** 阵营 - 联盟或部落 */
  faction: 'alliance' | 'horde' | null
  /** 种族 */
  race: string | null
  /** 职业 */
  class: string | null
  /** 角色等级 */
  level: number
  /** 当前经验值 */
  exp: number
  /** 升级所需经验值 */
  expToNextLevel: number
  /** 当前生命值 */
  hp: number
  /** 最大生命值 */
  maxHp: number
  /** 当前法力值 */
  mana: number
  /** 最大法力值 */
  maxMana: number
  /** 核心属性 */
  stats: Stats
  /** 持有金币数量 */
  gold: number
}

/**
 * 物品基础类型
 */
export interface Item {
  /** 物品唯一ID */
  id: string
  /** 物品名称 */
  name: string
  /** 物品类型 */
  type: string
  /** 稀有度 */
  rarity: string
  /** 图标 */
  icon: string
  /** 物品描述 */
  description: string
  /** 提供的属性加成(可选) */
  stats?: Partial<Stats>
  /** 物品价值(金币) */
  value: number
  /** 是否可堆叠 */
  stackable: boolean
}

/**
 * 背包物品
 * 表示玩家背包中的单个物品
 */
export interface InventoryItem extends Item {
  /** 当前堆叠数量 */
  count: number
}

/**
 * 任务
 */
export interface Quest {
  /** 任务ID */
  id: string
  /** 任务标题 */
  title: string
  /** 任务描述 */
  description: string
  /** 任务目标列表 */
  objectives: QuestObjective[]
  /** 任务奖励列表 */
  rewards: QuestReward[]
  /** 任务状态 - 可接、进行中、已完成 */
  status: 'available' | 'active' | 'completed'
  /** 建议等级 */
  level: number
}

/**
 * 任务目标
 * 单个任务的具体完成条件
 */
export interface QuestObjective {
  /** 目标ID */
  id: string
  /** 目标类型 */
  type: string
  /** 目标标识(如敌人名称) */
  target: string
  /** 需要完成的数量 */
  count: number
  /** 当前完成数量 */
  current: number
  /** 目标描述 */
  description: string
}

/**
 * 任务奖励
 */
export interface QuestReward {
  /** 奖励类型 */
  type: 'gold' | 'exp' | 'item'
  /** 奖励数量(金币或经验) */
  amount?: number
  /** 奖励物品(如果是物品类型) */
  item?: InventoryItem
}

/**
 * 敌人
 */
export interface Enemy {
  /** 敌人ID */
  id: string
  /** 敌人名称 */
  name: string
  /** 敌人类型 */
  type: string
  /** 敌人等级 */
  level: number
  /** 当前生命值 */
  hp: number
  /** 最大生命值 */
  maxHp: number
  /** 攻击力 */
  attack: number
  /** 防御力 */
  defense: number
  /** 击杀经验奖励 */
  expReward: number
  /** 击杀金币奖励 */
  goldReward: number
  /** 敌人图标 */
  icon: string
  /** 可能掉落的物品列表 */
  loot: InventoryItem[]
}

/**
 * 地图位置
 */
export interface Location {
  /** 位置ID */
  id: string
  /** 位置名称 */
  name: string
  /** 位置描述 */
  description: string
  /** 位置图标 */
  icon: string
  /** 所属阵营 */
  faction: 'alliance' | 'horde' | 'neutral'
  /** 该区域的敌人列表 */
  enemies: string[]
  /** 该区域的任务列表 */
  quests: string[]
  /** 地图大小 */
  mapSize: number
}

/**
 * 地图瓦片
 * 用于生成探索地图
 */
export interface MapTile {
  /** X坐标 */
  x: number
  /** Y坐标 */
  y: number
  /** 瓦片类型 */
  type: 'empty' | 'wall' | 'enemy' | 'item' | 'exit' | 'npc'
  /** 是否已探索 */
  discovered: boolean
  /** 附加数据(可选) */
  data?: any
}

/**
 * 游戏日志条目
 * 用于记录游戏中的重要事件
 */
export interface LogEntry {
  /** 日志ID */
  id: string
  /** 时间戳 */
  timestamp: number
  /** 日志类型 */
  type: 'info' | 'combat' | 'quest' | 'item' | 'level'
  /** 日志消息内容 */
  message: string
  /** 日志图标(可选) */
  icon?: string
}

/**
 * 阵营类型
 */
export type FactionType = 'alliance' | 'horde' | 'neutral'

/**
 * 阵营数据
 */
export interface FactionData {
  /** 阵营名称 */
  name: string
  /** 阵营图标 */
  icon: string
  /** 阵营主题色 */
  color: string
  /** 阵营描述 */
  description: string
}

/**
 * 种族数据
 */
export interface RaceData {
  /** 种族名称 */
  name: string
  /** 种族图标 */
  icon: string
  /** 所属阵营 */
  faction: FactionType
  /** 种族属性加成 */
  bonus: Partial<Stats>
  /** 种族描述 */
  description: string
}

/**
 * 职业数据
 */
export interface ClassData {
  /** 职业名称 */
  name: string
  /** 职业图标 */
  icon: string
  /** 生命骰面数(决定升级时的生命值增长) */
  hitDie: number
  /** 主属性 */
  primaryStat: keyof Stats
  /** 可选阵营列表 */
  factions: FactionType[]
  /** 职业描述 */
  description: string
  /** 职业主题色 */
  color: string
}

/**
 * 技能类型
 */
export type SkillType = 'physical_damage' | 'magic_damage' | 'heal'

/**
 * 技能效果
 */
export interface SkillEffect {
  type: SkillType
  value: number
  coefficient?: number
}

/**
 * 技能/能力数据
 */
export interface Ability {
  /** 技能名称 */
  name: string
  /** 技能图标 */
  icon: string
  /** 伤害范围(最小,最大) - 伤害型技能 */
  damage?: [number, number]
  /** 治疗范围(最小,最大) - 治疗型技能 */
  healing?: [number, number]
  /** 法力消耗 */
  manaCost: number
  /** 技能类型 */
  type: SkillType
}

/**
 * 技能数据（带解锁状态）
 */
export interface Skill {
  id: string
  name: string
  icon: string
  description: string
  mpCost: number
  type: SkillType
  effect: SkillEffect
  unlockLevel: number
  isUnlocked: boolean
}

/**
 * 技能使用结果
 */
export interface SkillUseResult {
  success: boolean
  skillId: string
  type: SkillType
  damage?: number
  heal?: number
  defense?: number
  message: string
}

/**
 * 技能栏
 */
export interface SkillBar {
  slots: (string | null)[]
}

/**
 * 物品类型数据
 */
export interface ItemTypeData {
  /** 类型名称 */
  name: string
  /** 是否可堆叠 */
  stackable: boolean
  /** 最大堆叠数 */
  maxStack: number
  /** 是否可使用 */
  usable?: boolean
}

/**
 * 掉落物品数据
 */
export interface LootItemData {
  /** 物品名称 */
  name: string
  /** 物品图标 */
  icon: string
  /** 物品类型 */
  type: string
  /** 恢复生命值(消耗品) */
  healing?: number
  /** 恢复法力值(消耗品) */
  manaRestore?: number
  /** 永久属性加成 */
  statBonus?: Partial<Stats>
  /** 使用效果类型 */
  effect?: 'damage' | 'heal'
  /** 伤害范围(卷轴类物品) */
  damage?: [number, number]
  /** 稀有度 */
  rarity: string
  /** 物品描述 */
  description: string
  /** 物品模板标识 */
  template: string
}

/**
 * 敌人数据
 */
export interface EnemyData {
  /** 敌人名称 */
  name: string
  /** 敌人图标 */
  icon: string
  /** 生命值 */
  hp: number
  /** 伤害范围(最小,最大) */
  damage: [number, number]
  /** 击杀经验奖励 */
  xp: number
  /** 击杀金币奖励 */
  gold: number
  /** 危险等级 */
  dangerLevel: string
  /** 是否为BOSS */
  isBoss?: boolean
}

/**
 * 大陆数据
 */
export interface ContinentData {
  /** 大陆名称 */
  name: string
  /** 大陆图标 */
  icon: string
  /** 大陆描述 */
  description: string
  /** 大陆在地图上的位置 */
  position: string
  /** 大陆主题色 */
  color: string
}

/**
 * 地点数据
 */
export interface LocationData {
  /** 地点标识 */
  name: string
  /** 显示名称 */
  displayName: string
  /** 地点图标 */
  icon: string
  /** 地点描述 */
  description: string
  /** 所属大陆 */
  continent: string
  /** 区域位置 */
  region: string
  /** 该地点出现的敌人列表 */
  enemies: string[]
  /** 建议等级范围(最小,最大) */
  levelRange: [number, number]
  /** 地点主题色 */
  color: string
  /** 地图X坐标 */
  mapX: number
  /** 地图Y坐标 */
  mapY: number
}

/**
 * 任务数据
 */
export interface QuestData {
  /** 任务唯一标识 */
  key: string
  /** 所在地点标识 */
  locationKey: string
  /** 任务名称 */
  name: string
  /** 任务描述 */
  description: string
  /** 任务目标列表 */
  objectives: {
    /** 目标类型 */
    type: 'kill'
    /** 需要击杀的敌人标识 */
    enemyKey: string
    /** 需要击杀的数量 */
    target: number
  }[]
  /** 任务奖励 */
  reward: {
    /** 经验奖励 */
    xp: number
    /** 金币奖励 */
    gold: number
  }
}
