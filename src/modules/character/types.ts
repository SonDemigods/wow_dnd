/**
 * @fileoverview 角色模块类型定义
 * @description 包含角色核心属性、衍生属性、角色数据、种族和职业相关的类型定义
 */

/**
 * 阵营类型枚举
 * - alliance: 光辉盟约
 * - horde: 铁血盟约
 * - neutral: 中立
 */
export type FactionType = 'alliance' | 'horde' | 'neutral';

/**
 * 阵营数据接口
 * @property {string} name - 阵营名称
 * @property {string} icon - 阵营图标
 * @property {string} color - 阵营主色调
 * @property {string} description - 阵营描述
 */
export interface FactionData {
  id: FactionType;
  name: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * 种族类型枚举
 * - human: 人类
 * - dwarf: 矮人
 * - gnome: 侏儒
 * - night_elf: 暮精灵
 * - draenei: 星裔
 * - worgen: 狼人
 * - void_elf: 暗影精灵
 * - lightforged_draenei: 圣光星裔
 * - dark_iron_dwarf: 铁炉矮人
 * - kul_tiran: 海民
 * - mecha_gnome: 机关侏儒
 * - pandaren: 兽灵族
 * - orc: 兽人
 * - undead: 亡者
 * - tauren: 牛角族
 * - troll: 巨魔
 * - blood_elves: 银辉精灵
 * - goblin: 地精
 * - nightborne: 暮光后裔
 * - highmountain_tauren: 高岭牛角族
 * - maghar_orc: 棕皮兽人
 * - zandalari: 远古巨魔
 * - vulpera: 狐族
 * - dracthyr: 龙裔
 * - earthen: 大地之子
 * - harenei: 林荫精灵
 */
export type RaceType =
  | 'human'
  | 'dwarf'
  | 'gnome'
  | 'night_elf'
  | 'draenei'
  | 'worgen'
  | 'void_elf'
  | 'lightforged_draenei'
  | 'dark_iron_dwarf'
  | 'kul_tiran'
  | 'mecha_gnome'
  | 'pandaren'
  | 'orc'
  | 'undead'
  | 'tauren'
  | 'troll'
  | 'blood_elves'
  | 'goblin'
  | 'nightborne'
  | 'highmountain_tauren'
  | 'maghar_orc'
  | 'zandalari'
  | 'vulpera'
  | 'dracthyr'
  | 'earthen'
  | 'harenei';

/**
 * 种族数据接口
 * @property {string} name - 种族名称
 * @property {string} icon - 种族图标
 * @property {string} factionId - 所属阵营ID
 * @property {Partial<Stats>} bonus - 属性加成
 * @property {string} description - 种族描述
 */
export interface RaceData {
  id: RaceType;
  name: string;
  icon: string;
  factionId: FactionType;
  bonus?: Partial<Stats>;
  description: string;
}

/**
 * 种族属性调整值接口
 * @property {string} raceId - 种族ID
 * @property {string} factionId - 阵营ID
 * @property {Partial<Stats>} stats - 属性调整值
 */
export interface RaceBonus {
  raceId: RaceType;
  factionId: FactionType;
  bonus: Partial<Stats>;
}

/**
 * 职业类型枚举
 * - warrior: 战士
 * - mage: 法师
 * - paladin: 圣骑士
 * - hunter: 猎人
 * - rogue: 潜行者
 * - warlock: 术士
 * - druid:  德鲁伊
 * - priest: 牧师
 * - shaman: 萨满
 * - death_knight: 亡灵骑士
 * - monk: 武僧
 * - demon_hunter: 影刃猎手
 * - evoker: 龙脉术士
 */
export type ClassType =
  | 'warrior'
  | 'mage'
  | 'paladin'
  | 'hunter'
  | 'rogue'
  | 'warlock'
  | 'druid'
  | 'priest'
  | 'shaman'
  | 'death_knight'
  | 'monk'
  | 'demon_hunter'
  | 'evoker';

/**
 * 职业数据接口
 * @property {ClassType} id - 职业ID
 * @property {string} name - 职业名称
 * @property {string} icon - 职业图标
 * @property {keyof Stats} primaryStat - 主属性
 * @property {FactionType[]} factionsIds - 可选阵营ID列表
 * @property {RaceType[]} raceIds - 可选种族ID列表
 * @property {string} description - 职业描述
 * @property {string} color - 职业主色调
 * @property {Partial<Stats>} [bonus] - 职业属性调整值
 */
export interface ClassData {
  id: ClassType;
  name: string;
  icon: string;
  primaryStat: keyof Stats;
  factionsIds: FactionType[];
  raceIds: RaceType[];
  description: string;
  color: string;
  bonus?: Partial<Stats>;
}

/**
 * 职业属性调整值接口
 * @property {ClassType} classId - 职业ID
 * @property {Partial<Stats>} bonus - 属性调整值
 */
export interface ClassBonus {
  classId: ClassType;
  bonus: Partial<Stats>;
}

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
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
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
 */
export interface Attributes {
  maxHp: number;
  maxMana: number;
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
  critChance: number;
  dodgeChance: number;
  hpBonus: number;
  mpBonus: number;
  healBonus: number;
}

/**
 * 玩家角色数据接口
 * 存储角色的基本信息和当前状态
 * @property {string} name - 角色名称
 * @property {string} factionId - 所属阵营ID
 * @property {string} raceId - 种族ID
 * @property {string} classId - 职业ID
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
  name: string;
  factionId: FactionType;
  raceId: RaceType;
  classId: ClassType;
  level: number;
  exp: number;
  expToNextLevel: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stats: Stats;
  gold: number;
}

/**
 * 角色列表项接口
 * 用于角色选择界面显示
 * @property {string} id - 角色ID
 * @property {string} name - 角色名称
 * @property {string} raceId - 种族ID
 * @property {string} classId - 职业ID
 * @property {string} factionId - 阵营ID
 * @property {number} level - 等级
 * @property {number} createdTime - 创建时间戳
 * @property {number} lastPlayedTime - 最后游玩时间戳
 */
export interface CharacterListItem {
  id: string;
  name: string;
  raceId: RaceType;
  classId: ClassType;
  factionId: FactionType;
  level: number;
  createdTime: number;
  lastPlayedTime: number;
}

/**
 * 创建角色参数接口
 * @property {string} name - 角色名称
 * @property {FactionType} factionId - 阵营ID
 * @property {RaceType} raceId - 种族ID
 * @property {ClassType} classId - 职业ID
 */
export interface CreateCharacterParams {
  name: string;
  factionId: FactionType;
  raceId: RaceType;
  classId: ClassType;
}

/**
 * 经验值增益结果接口
 * @property {Character} character - 增益后的角色数据
 * @property {boolean} leveledUp - 是否升级了
 * @property {number} levelsGained - 升级了几级
 * @property {number} newLevel - 增益后的等级
 */
export interface ExpGainResult {
  character: Character;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

/**
 * 角色服务接口
 * 提供角色管理的核心功能
 */
export interface ICharacterService {
  /**
   * 创建新角色
   * @param {string} name - 角色名称
   * @param {FactionType} factionId - 阵营ID
   * @param {RaceType} raceId - 种族ID
   * @param {ClassType} classId - 职业ID
   * @returns {Promise<string>} 角色ID
   */
  createCharacter(
    name: string,
    factionId: FactionType,
    raceId: RaceType,
    classId: ClassType
  ): Promise<string>;

  /**
   * 选择角色
   * @param {string} characterId - 角色ID
   * @returns {Promise<boolean>} 是否成功选择
   */
  selectCharacter(characterId: string): Promise<boolean>;

  /**
   * 删除角色
   * @param {string} characterId - 角色ID
   * @returns {Promise<boolean>} 是否成功删除
   */
  deleteCharacter(characterId: string): Promise<boolean>;

  /**
   * 获取所有角色列表
   * @returns {Promise<CharacterListItem[]>} 角色列表
   */
  getAllCharacters(): Promise<CharacterListItem[]>;

  /**
   * 获取当前选中的角色ID
   * @returns {string | null} 当前角色ID
   */
  getCurrentCharacterId(): string | null;

  /** 登出当前角色 */
  logout(): Promise<void>;

  /**
   * 获取核心属性
   * @returns {Stats} 核心属性
   */
  getStats(): Stats;

  /**
   * 获取衍生属性
   * @returns {Attributes} 衍生属性
   */
  getAttributes(): Attributes;

  /**
   * 获取等级
   * @returns {number} 当前等级
   */
  getLevel(): number;

  /**
   * 获取当前经验值
   * @returns {number} 当前经验值
   */
  getExp(): number;

  /**
   * 获取升级所需经验值
   * @returns {number} 升级所需经验值
   */
  getExpToNextLevel(): number;

  /**
   * 获取角色名称
   * @returns {string} 角色名称
   */
  getName(): string;

  /**
   * 获取阵营
   * @returns {FactionType} 阵营ID
   */
  getFaction(): FactionType;

  /**
   * 获取种族
   * @returns {RaceType} 种族ID
   */
  getRace(): RaceType;

  /**
   * 获取职业
   * @returns {ClassType} 职业ID
   */
  getClass(): ClassType;

  /**
   * 获取金币数量
   * @returns {number} 金币数量
   */
  getGold(): number;

  /**
   * 获取角色信息
   * @returns {Character} 角色信息
   */
  getCharacterInfo(): Character;

  /**
   * 添加经验值
   * @param {number} amount - 经验值数量
   */
  addExp(amount: number): Promise<void>;

  /**
   * 添加生命值
   * @param {number} amount - 生命值数量
   */
  addHp(amount: number): Promise<void>;

  /**
   * 添加法力值
   * @param {number} amount - 法力值数量
   */
  addMp(amount: number): Promise<void>;

  /**
   * 设置生命值
   * @param {number} value - 生命值数值
   */
  setHp(value: number): Promise<void>;

  /**
   * 设置法力值
   * @param {number} value - 法力值数值
   */
  setMp(value: number): Promise<void>;

  /**
   * 应用属性加成
   * @param {Partial<Stats>} bonus - 属性加成
   */
  applyBonus(bonus: Partial<Stats>): Promise<void>;

  /**
   * 移除属性加成
   * @param {Partial<Stats>} bonus - 属性加成
   */
  removeBonus(bonus: Partial<Stats>): Promise<void>;

  /**
   * 添加金币
   * @param {number} amount - 金币数量
   */
  addGold(amount: number): Promise<void>;

  /**
   * 花费金币
   * @param {number} amount - 金币数量
   * @returns {Promise<boolean>} 是否成功花费
   */
  spendGold(amount: number): Promise<boolean>;

  /**
   * 设置角色名称
   * @param {string} name - 角色名称
   */
  setName(name: string): Promise<void>;

  /**
   * 设置阵营
   * @param {FactionType} factionId - 阵营ID
   */
  setFactionId(factionId: FactionType): Promise<void>;

  /**
   * 设置种族
   * @param {RaceType} race - 种族ID
   */
  setRace(race: RaceType): Promise<void>;

  /**
   * 设置职业
   * @param {ClassType} classId - 职业ID
   */
  setClass(classId: ClassType): Promise<void>;

  /** 重置角色数据 */
  reset(): Promise<void>;

  /** 处理角色死亡 */
  handleDeath(): Promise<void>;

  /** 复活角色 */
  resurrect(): Promise<void>;
}

/**
 * 阵营存储格式
 */
export interface FactionStorage {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * 种族存储格式
 */
export interface RaceStorage {
  id: string;
  name: string;
  icon: string;
  factionId: string;
  bonus?: Partial<Record<string, number>>;
  description: string;
}

/**
 * 职业存储格式
 */
export interface ClassStorage {
  id: string;
  name: string;
  icon: string;
  primaryStat: string;
  factionsIds: string[];
  raceIds: string[];
  description: string;
  color: string;
  bonus?: Partial<Record<string, number>>;
}

/**
 * 角色数据存储格式
 */
export interface CharacterDataStorage {
  characterId: string;
  name: string;
  factionId: string;
  raceId: string;
  classId: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  baseStats: Record<string, number>;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  bonusStats: Partial<Record<string, number>>;
  createdTime: number;
  lastPlayedTime: number;
  updatedAt: number;
}
