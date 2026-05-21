/**
 * @fileoverview 角色模块类型定义
 * @description 包含角色核心属性、衍生属性、角色数据、种族和职业相关的类型定义
 */

/**
 * 阵营类型枚举
 * - alliance: 联盟
 * - horde: 部落
 * - neutral: 中立
 */
export type FactionType = 'alliance' | 'horde' | 'neutral'

/**
 * 六大核心属性接口（D&D风格）
 * @property {number} str - 力量：影响物理攻击伤害
 * @property {number} dex - 敏捷：影响闪避率和暴击率
 * @property {number} con - 体质：影响生命值上限和韧性
 * @property {number} int - 智力：影响魔法攻击伤害和法力值
 * @property {number} wis - 感知：影响治疗效果和察觉能力
 * @property {number} cha - 魅力：影响对话选项和交易折扣
 */
export interface Stats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

/**
 * 角色衍生属性接口
 * 基于核心Stats计算得出的战斗和生存属性
 * @property {number} maxHp - 最大生命值
 * @property {number} maxMana - 最大法力值
 * @property {number} physicalAttack - 物理攻击力
 * @property {number} physicalDefense - 物理防御力
 * @property {number} magicAttack - 魔法攻击力
 * @property {number} magicDefense - 魔法防御力
 * @property {number} critChance - 暴击率（百分比）
 * @property {number} dodgeChance - 闪避率（百分比）
 * @property {number} hpBonus - 生命值加成
 * @property {number} mpBonus - 法力值加成
 * @property {number} healBonus - 治疗加成
 * @property {number} [attackBonus] - 攻击加成
 * @property {number} [critBonus] - 暴击加成
 * @property {number} [dodgeBonus] - 闪避加成
 * @property {number} [armor] - 护甲值
 * @property {number} [initiative] - 先手值
 */
export interface Attributes {
  maxHp: number
  maxMana: number
  physicalAttack: number
  physicalDefense: number
  magicAttack: number
  magicDefense: number
  critChance: number
  dodgeChance: number
  hpBonus: number
  mpBonus: number
  healBonus: number
  attackBonus?: number
  critBonus?: number
  dodgeBonus?: number
  armor?: number
  initiative?: number
}

/**
 * 玩家角色数据接口
 * 存储角色的基本信息和当前状态
 * @property {string} name - 角色名称
 * @property {FactionType} faction - 所属阵营
 * @property {string | null} race - 种族
 * @property {string | null} class - 职业
 * @property {number} level - 等级
 * @property {number} exp - 当前经验值
 * @property {number} expToNextLevel - 升级所需经验值
 * @property {number} hp - 当前生命值
 * @property {number} maxHp - 最大生命值
 * @property {number} mana - 当前法力值
 * @property {number} maxMana - 最大法力值
 * @property {Stats} stats - 核心属性
 * @property {number} gold - 金币数量
 */
export interface Character {
  name: string
  faction: FactionType
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

/**
 * 阵营数据接口
 * @property {string} name - 阵营名称
 * @property {string} icon - 阵营图标
 * @property {string} color - 阵营主色调
 * @property {string} description - 阵营描述
 */
export interface FactionData {
  name: string
  icon: string
  color: string
  description: string
}

/**
 * 种族数据接口
 * @property {string} name - 种族名称
 * @property {string} icon - 种族图标
 * @property {FactionType} faction - 所属阵营
 * @property {Partial<Stats>} bonus - 属性加成
 * @property {string} description - 种族描述
 */
export interface RaceData {
  name: string
  icon: string
  faction: FactionType
  bonus?: Partial<Stats>
  description: string
}

/**
 * 职业数据接口
 * @property {string} name - 职业名称
 * @property {string} icon - 职业图标
 * @property {keyof Stats} primaryStat - 主属性
 * @property {FactionType[]} factions - 可选阵营
 * @property {string} description - 职业描述
 * @property {string} color - 职业主色调
 * @property {Partial<Stats>} [bonus] - 职业属性调整值
 */
export interface ClassData {
  name: string
  icon: string
  primaryStat: keyof Stats
  factions: FactionType[]
  description: string
  color: string
  bonus?: Partial<Stats>
}

/**
 * 角色列表项接口
 * 用于角色选择界面显示
 * @property {string} id - 角色ID
 * @property {string} name - 角色名称
 * @property {string} race - 种族
 * @property {string} charClass - 职业
 * @property {FactionType} faction - 阵营
 * @property {number} level - 等级
 * @property {number} createdTime - 创建时间戳
 * @property {number} lastPlayedTime - 最后游玩时间戳
 */
export interface CharacterListItem {
  id: string
  name: string
  race: string
  charClass: string
  faction: FactionType
  level: number
  createdTime: number
  lastPlayedTime: number
}

/**
 * 种族属性调整值接口
 * @property {string} race - 种族名称
 * @property {FactionType} faction - 阵营
 * @property {Partial<Stats>} stats - 属性调整值
 */
export interface RaceBonus {
  race: string
  faction: FactionType
  bonus: Partial<Stats>
}

/**
 * 职业属性调整值接口
 * @property {string} className - 职业名称
 * @property {Partial<Stats>} bonus - 属性调整值
 */
export interface ClassBonus {
  className: string
  bonus: Partial<Stats>
}

/**
 * 角色服务接口
 * 提供角色管理的核心功能
 */
export interface ICharacterService {
  /**
   * 创建新角色
   * @param {string} name - 角色名称
   * @param {FactionType} faction - 阵营
   * @param {string} race - 种族
   * @param {string} charClass - 职业
   * @returns {string} 角色ID
   */
  createCharacter(name: string, faction: FactionType, race: string, charClass: string): string

  /**
   * 选择角色
   * @param {string} characterId - 角色ID
   * @returns {boolean} 是否成功选择
   */
  selectCharacter(characterId: string): boolean

  /**
   * 删除角色
   * @param {string} characterId - 角色ID
   * @returns {boolean} 是否成功删除
   */
  deleteCharacter(characterId: string): boolean

  /**
   * 获取所有角色列表
   * @returns {CharacterListItem[]} 角色列表
   */
  getAllCharacters(): CharacterListItem[]

  /**
   * 获取当前选中的角色ID
   * @returns {string | null} 当前角色ID
   */
  getCurrentCharacterId(): string | null

  /** 登出当前角色 */
  logout(): void

  /**
   * 获取核心属性
   * @returns {Stats} 核心属性
   */
  getStats(): Stats

  /**
   * 获取衍生属性
   * @returns {Attributes} 衍生属性
   */
  getAttributes(): Attributes

  /**
   * 获取等级
   * @returns {number} 当前等级
   */
  getLevel(): number

  /**
   * 获取当前经验值
   * @returns {number} 当前经验值
   */
  getExp(): number

  /**
   * 获取升级所需经验值
   * @returns {number} 升级所需经验值
   */
  getExpToNextLevel(): number

  /**
   * 获取角色名称
   * @returns {string} 角色名称
   */
  getName(): string

  /**
   * 获取阵营
   * @returns {FactionType} 阵营
   */
  getFaction(): FactionType

  /**
   * 获取种族
   * @returns {string | null} 种族
   */
  getRace(): string | null

  /**
   * 获取职业
   * @returns {string | null} 职业
   */
  getClass(): string | null

  /**
   * 获取金币数量
   * @returns {number} 金币数量
   */
  getGold(): number

  /**
   * 获取角色信息
   * @returns {Character} 角色信息
   */
  getCharacterInfo(): Character

  /**
   * 添加经验值
   * @param {number} amount - 经验值数量
   */
  addExp(amount: number): void

  /**
   * 添加生命值
   * @param {number} amount - 生命值数量
   */
  addHp(amount: number): void

  /**
   * 添加法力值
   * @param {number} amount - 法力值数量
   */
  addMp(amount: number): void

  /**
   * 设置生命值
   * @param {number} value - 生命值数值
   */
  setHp(value: number): void

  /**
   * 设置法力值
   * @param {number} value - 法力值数值
   */
  setMp(value: number): void

  /**
   * 应用属性加成
   * @param {Partial<Stats>} bonus - 属性加成
   */
  applyBonus(bonus: Partial<Stats>): void

  /**
   * 移除属性加成
   * @param {Partial<Stats>} bonus - 属性加成
   */
  removeBonus(bonus: Partial<Stats>): void

  /**
   * 添加金币
   * @param {number} amount - 金币数量
   */
  addGold(amount: number): void

  /**
   * 花费金币
   * @param {number} amount - 金币数量
   * @returns {boolean} 是否成功花费
   */
  spendGold(amount: number): boolean

  /**
   * 设置角色名称
   * @param {string} name - 角色名称
   */
  setName(name: string): void

  /**
   * 设置阵营
   * @param {FactionType} faction - 阵营
   */
  setFaction(faction: FactionType): void

  /**
   * 设置种族
   * @param {string} race - 种族
   */
  setRace(race: string): void

  /**
   * 设置职业
   * @param {string} charClass - 职业
   */
  setClass(charClass: string): void

  /** 重置角色数据 */
  reset(): void

  /** 处理角色死亡 */
  handleDeath(): void

  /** 复活角色 */
  resurrect(): void
}
