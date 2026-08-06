/**
 * @fileoverview 角色模块类型定义
 * @description 包含角色创建、属性计算、数据持久化所需的全部类型定义。
 *              本文件是 character 模块的类型基石，所有接口和类型别名均在此集中定义。
 *              类型按职责划分为四层：枚举与配置数据、核心属性与角色、运行时计算结果、IndexedDB 存储格式。
 * @module character
 */

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 阵营类型枚举
 *
 * 决定角色所属的政治势力，影响对话选项、商店可用物品和任务线分支。
 * - `alliance`：光辉盟约（人类、矮人、侏儒、暮精灵、星裔、狼人等）
 * - `horde`：铁血盟约（兽人、亡者、牛角族、巨魔、银辉精灵、地精等）
 * - `neutral`：中立阵营（兽灵族、龙裔、大地之子、林荫精灵等）
 *
 * @see RaceData.factionId 每个种族指定唯一阵营归属
 * @see createCharacter 创建角色时通过阵营筛选可选种族
 */
export type FactionType = 'alliance' | 'horde' | 'neutral';

/**
 * 种族类型枚举
 *
 * 每个种族具有唯一阵营归属（通过 `RaceData.factionId` 指定）和独立的属性加成（`RaceData.bonus`）。
 * 种族一经选定不可更改（除非调用 `setRace`），是角色的核心身份标识之一。
 *
 * 联盟种族（alliance）：
 * - `human`：人类
 * - `dwarf`：矮人
 * - `gnome`：侏儒
 * - `night_elf`：暮精灵
 * - `draenei`：星裔
 * - `worgen`：狼人
 * - `void_elf`：暗影精灵
 * - `lightforged_draenei`：圣光星裔
 * - `dark_iron_dwarf`：铁炉矮人
 * - `kul_tiran`：海民
 * - `mecha_gnome`：机关侏儒
 *
 * 部落种族（horde）：
 * - `orc`：兽人
 * - `undead`：亡者
 * - `tauren`：牛角族
 * - `troll`：巨魔
 * - `blood_elves`：银辉精灵
 * - `goblin`：地精
 * - `nightborne`：暮光后裔
 * - `highmountain_tauren`：高岭牛角族
 * - `maghar_orc`：棕皮兽人
 * - `zandalari`：远古巨魔
 * - `vulpera`：狐族
 *
 * 中立种族（neutral）：
 * - `pandaren`：兽灵族
 * - `dracthyr`：龙裔
 * - `earthen`：大地之子
 * - `harenei`：林荫精灵
 *
 * @see RaceData 种族完整配置（名称、图标、属性加成）
 * @see computeInitialStats 种族加成通过此函数参与初始属性计算
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
 * 职业类型枚举
 *
 * 决定角色的战斗风格、可用技能树和主属性（`primaryStat`）。
 * 每个职业有不同的属性加成（`ClassData.bonus`），影响 `computeInitialStats` 的初始属性计算。
 *
 * 职业列表：
 * - `warrior`：战士（主属性：力量）
 * - `mage`：法师（主属性：智力）
 * - `paladin`：圣骑士（主属性：力量）
 * - `hunter`：猎人（主属性：敏捷）
 * - `rogue`：潜行者（主属性：敏捷）
 * - `warlock`：术士（主属性：智力）
 * - `druid`：德鲁伊（主属性：感知）
 * - `priest`：牧师（主属性：感知）
 * - `shaman`：萨满（主属性：智力）
 * - `death_knight`：亡灵骑士（主属性：力量）
 * - `monk`：武僧（主属性：敏捷）
 * - `demon_hunter`：影刃猎手（主属性：敏捷）
 * - `evoker`：龙脉术士（主属性：智力）
 *
 * @see ClassData 职业完整配置（主属性、可选种族、属性加成）
 * @see createCharacter 创建角色时通过 `classId` 初始化技能栏
 * @see skillsDbService.getSkillTemplatesByClass 根据职业获取可用技能模板
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

// ============================================================================
// 配置数据接口
// ============================================================================

/**
 * 阵营数据接口
 *
 * 阵营的完整配置信息，存储在 IndexedDB 的 `config_factions` 表中，
 * 通过 `useBaseStore` 加载到内存，角色创建和登录时使用。
 *
 * 数据来源流程：
 * 1. `data/initializer` 从默认 JSON 导入至 `config_factions` 表
 * 2. `store.ts` 的 `initialize()` 通过 `baseStore.factions` 读取
 * 3. `factionsData` ref 缓存为 `Record<string, FactionData>` 供快速查询
 *
 * @property {FactionType} id - 阵营唯一标识
 * @property {string} name - 阵营显示名称
 * @property {string} icon - 阵营图标（Iconify 格式，如 `game-icons:checked-shield`）
 * @property {string} color - 阵营主色调（CSS 颜色值，用于 UI 主题）
 * @property {string} description - 阵营描述文本
 *
 * @see FactionStorage 对应的 IndexedDB 存储格式
 */
export interface FactionData {
  id: FactionType;
  name: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * 种族数据接口
 *
 * 种族的完整配置信息，存储在 IndexedDB 的 `config_races` 表中。
 * `bonus` 字段为六大核心属性的调整值，在 `computeInitialStats` 中与基础值（10）叠加。
 *
 * 设计原则：
 * - 种族 bonus 不直接修改 Stats，而是通过 `computeInitialStats` 参与计算
 * - 切换种族时（`setRace`）会重新计算基础属性，HP/MP 随之上限变化
 *
 * @property {RaceType} id - 种族唯一标识
 * @property {string} name - 种族显示名称
 * @property {string} icon - 种族图标（Iconify 格式）
 * @property {FactionType} factionId - 所属阵营 ID（决定阵营归属）
 * @property {Partial<Stats>} [bonus] - 六大属性加成值（可选，未提供时视为全 0）
 * @property {string} description - 种族描述文本
 *
 * @see computeInitialStats bonus 作为种族加成参数参与初始属性计算
 * @see RaceStorage 对应的 IndexedDB 存储格式
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
 * 职业数据接口
 *
 * 职业的完整配置信息，存储在 IndexedDB 的 `config_classes` 表中。
 * `primaryStat` 指示伤害/治疗计算的主加成属性，`bonus` 为初始属性调整值。
 *
 * 数据关系：
 * - `factionsIds` 限制可选阵营（部分职业仅对特定阵营开放）
 * - `raceIds` 限制可选种族（部分职业有种族限制）
 * - `bonus` 在 `computeInitialStats` 中与种族 bonus 叠加
 *
 * @property {ClassType} id - 职业唯一标识
 * @property {string} name - 职业显示名称
 * @property {string} icon - 职业图标（Iconify 格式）
 * @property {keyof Stats} primaryStat - 主属性键（决定伤害/治疗加成来源）
 * @property {FactionType[]} factionsIds - 可选阵营 ID 列表（空数组 = 无限制）
 * @property {RaceType[]} raceIds - 可选种族 ID 列表（空数组 = 无限制）
 * @property {string} description - 职业描述文本
 * @property {string} color - 职业主色调（CSS 颜色值，用于 UI 主题）
 * @property {Partial<Stats>} [bonus] - 职业属性调整值（可选，叠加到初始属性）
 *
 * @see computeInitialStats bonus 作为职业加成参数参与初始属性计算
 * @see ClassStorage 对应的 IndexedDB 存储格式
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

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 六大核心属性接口（D&D 风格）
 *
 * 所有属性计算的基础单元，`setRace`、`setClass`、`applyLevelUp` 均以此接口为操作对象。
 * 属性值范围为 [1, MAX_STAT]，通过 `clampStat` / `clampBonus` 实施边界约束。
 *
 * 属性含义：
 * @property {number} str - 力量（Strength）：影响物理攻击伤害计算 `calculatePhysicalAttack`
 * @property {number} dex - 敏捷（Dexterity）：影响闪避率 `calculateDodgeChance` 和暴击率 `calculateCritChance`
 * @property {number} con - 体质（Constitution）：影响生命值上限 `calculateMaxHp` 和韧性
 * @property {number} int - 智力（Intelligence）：影响魔法攻击伤害 `calculateMagicAttack` 和法力值上限 `calculateMaxMana`
 * @property {number} wis - 感知（Wisdom）：影响生命恢复效果 `calculateHealBonus` 和 buff 效果强度
 * @property {number} cha - 魅力（Charisma）：影响交易折扣和部分对话选项
 *
 * @see computeInitialStats 根据种族/职业加成计算初始 Stats
 * @see computeEffectiveStats 合并 baseStats + bonusStats 得到有效 Stats
 * @see clampStat 属性值上/下界约束函数
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
 * 属性来源明细项
 *
 * 用于角色面板"属性来源展示"功能（plan.md §阶段四），描述单个核心属性
 * （如 str）的某一层贡献来源，供 UI 组件以 tooltip 形式展示属性构成明细。
 *
 * 四层属性模型分层（见 plan.md §3.1）：
 * - `base`：基础值 10（固定，不可改）
 * - `race`：种族加成（raceBonus，固定）
 * - `class`：职业加成（classBonus，固定）
 * - `potion`：药剂层（potionStats，不可重置）
 * - `allocated`：升级层（allocatedStats，可重置）
 * - `bonus`：装备/天赋层（bonusStats 中扣除坐骑部分，避免与 mount 层重复计算）
 * - `mount`：坐骑层（mountChoices 经 computeMountBonus 计算的加成，P1 增强）
 *
 * 注：`bonus` 与 `mount` 均来自 bonusStats（坐骑 bonus 通过 setMountChoice 写入 bonusStats）。
 * statsBreakdown 中将 bonusStats 拆分为"装备/天赋"（bonusStats - mountBonus）和"坐骑"（mountBonus）两层，
 * 两者之和等于原 bonusStats，保证 effectiveStats 计算不变。
 *
 * @property label - 来源显示名称（如 "基础"、"种族"、"职业"、"药剂"、"升级"、"装备/天赋"、"坐骑"）
 * @property value - 该层对该属性的贡献值（可为负，如职业调整的 -1）
 * @property layer - 层级标识，用于 UI 着色或筛选零值层
 *
 * @see useCharacterStore.statsBreakdown 暴露给 UI 的属性来源明细
 */
export interface StatSource {
  label: string;
  value: number;
  layer: 'base' | 'race' | 'class' | 'potion' | 'allocated' | 'bonus' | 'mount';
}

/**
 * 角色衍生属性接口
 *
 * 基于核心 `Stats` 计算得出的战斗和生存属性。每次 Stats 变化时通过 `computeAttributes`
 * 重新计算，结果缓存在 Store 的 `attributes` computed 中供 UI 和其他模块使用。
 *
 * 注意：此接口中的所有值均为派生值，不应直接修改。
 * 修改角色属性应通过 `applyBonus`/`removeBonus`/`setRace`/`setClass` 等 Action，
 * 由 Store 自动触发 `computeAttributes` 重新计算。
 *
 * @property {number} maxHp - 最大生命值（由 `calculateMaxHp` 根据体质计算）
 * @property {number} maxMana - 最大法力值（由 `calculateMaxMana` 根据智力计算）
 * @property {number} physicalAttack - 物理攻击力（由 `calculatePhysicalAttack` 根据力量计算）
 * @property {number} physicalDefense - 物理防御力（由 `calculatePhysicalDefense` 根据体质计算）
 * @property {number} magicAttack - 魔法攻击力（由 `calculateMagicAttack` 根据智力计算）
 * @property {number} magicDefense - 魔法防御力（由 `calculateMagicDefense` 根据感知计算）
 * @property {number} critChance - 暴击率，百分比整数（由 `calculateCritChance` 根据敏捷计算）
 * @property {number} dodgeChance - 闪避率，百分比整数（由 `calculateDodgeChance` 根据敏捷计算）
 * @property {number} mpBonus - 法力值加成系数（由 `calculateMpBonus` 根据智力计算）
 * @property {number} healBonus - 治疗加成系数（由 `calculateHealBonus` 根据感知计算）
 *
 * @see computeAttributes 从 Stats 计算 Attributes 的纯函数
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
  mpBonus: number;
  healBonus: number;
}

/**
 * 玩家角色数据接口
 *
 * 角色的完整运行时数据，是 Store 中 `character` ref 的类型。
 * 与 `CharacterDataStorage` 通过 `toStorageFormat` / `fromStorageFormat` 互相转换。
 *
 * 数据来源流程：
 * 1. 创建角色：`createInitialCharacter(params, raceData, classData)` → Character
 * 2. 读取角色：`fromStorageFormat(getCharacterData(id))` → Character
 * 3. 持久化角色：`toStorageFormat(id, character, bonusStats)` → CharacterDataStorage → IndexedDB
 *
 * @property {string} name - 角色名称（可修改，通过 `setName` 更新）
 * @property {FactionType} factionId - 所属阵营 ID
 * @property {RaceType} raceId - 种族 ID
 * @property {ClassType} classId - 职业 ID
 * @property {number} level - 当前等级（范围 [1, MAX_LEVEL]）
 * @property {number} exp - 当前经验值
 * @property {number} expToNextLevel - 升级所需经验值（由 `getExpForLevel(level + 1)` 计算）
 * @property {number} hp - 当前生命值（范围 [0, maxHp]）
 * @property {number} maxHp - 最大生命值（由 `calculateMaxHp(effectiveStats)` 计算）
 * @property {number} mana - 当前法力值（范围 [0, maxMana]）
 * @property {number} maxMana - 最大法力值（由 `calculateMaxMana(effectiveStats)` 计算）
 * @property {Stats} stats - 核心六维属性（10 基础 + 种族 + 职业；不再含等级加成）
 * @property {Stats} potionStats - 药剂层累加属性（不可重置），初始全 0；使用 ATTRIBUTE_POTIONS 后永久叠加
 * @property {Stats} allocatedStats - 升级层已分配属性（可重置），初始全 0；由 allocateStat 分配
 * @property {number} unallocatedPoints - 升级层未分配点数池，初始 0，升级时 += POINTS_PER_LEVEL
 * @property {number} gold - 金币数量（无下限，花费时不能为负）
 * @property {(string|null)[]} mountChoices - 坐骑配置：5 档选择的方向 ID，null 表示未选；由 setMountChoice 维护
 *
 * @see CharacterListItem 角色列表项（仅展示用，不含完整数据）
 * @see CharacterDataStorage IndexedDB 持久化格式
 * @see toStorageFormat 运行时 → 存储格式转换
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
  /** 药剂层累加属性（不可重置），使用属性药剂后永久叠加 */
  potionStats: Stats;
  /** 升级层已分配属性（可重置），由 allocateStat 分配 */
  allocatedStats: Stats;
  /** 升级层未分配点数池，升级时累加 POINTS_PER_LEVEL */
  unallocatedPoints: number;
  gold: number;
  /**
   * 坐骑配置：5 档选择的方向 ID（长度固定 5，对应 common/uncommon/rare/epic/legendary）
   *
   * 元素为 MountOption.id（如 `common_str`、`epic_str_con`）或 null（未选）。
   * 最终坐骑 bonus = 5 档选择叠加，由 computeMountBonus 计算，通过 applyBonus/removeBonus 应用。
   * 仅记录选择 ID，方向定义集中在 data/config_mounts.ts，避免角色数据与配置耦合。
   *
   * @see computeMountBonus 计算总加成
   * @see setMountChoice 修改单档选择
   */
  mountChoices: (string | null)[];
  /** 角色创建时间戳（毫秒），持久化用，不在 UI 中展示 */
  createdTime?: number;
}

/**
 * 角色列表项接口
 *
 * 角色选择界面的轻量数据结构，仅包含展示所需的字段。
 * 与 `Character` 的区别：不含 stats、hp、mana、exp 等详情，仅用于列表渲染。
 *
 * 数据来源：从 `char_data` 表中按需提取字段，
 * 通过 `characterDbService.getAllCharacterListItems()` 获取全量列表。
 *
 * @property {string} id - 角色唯一标识（格式：`char_时间戳_随机串`）
 * @property {string} name - 角色名称
 * @property {RaceType} raceId - 种族 ID
 * @property {ClassType} classId - 职业 ID
 * @property {FactionType} factionId - 阵营 ID
 * @property {number} level - 等级
 * @property {number} createdTime - 创建时间戳（毫秒）
 * @property {number} lastPlayedTime - 最后游玩时间戳（毫秒，用于排序）
 *
 * @see Character 完整角色数据
 * @see characterDbService.getAllCharacterListItems 获取全量列表
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
 *
 * 创建角色时从 UI 组件传递的输入参数。由 `createCharacter` Action 解构后
 * 传递给 `createInitialCharacter` 纯函数生成初始角色数据。
 *
 * @property {string} name - 角色名称（用户输入，需 UI 层校验非空）
 * @property {FactionType} factionId - 所选阵营 ID
 * @property {RaceType} raceId - 所选种族 ID
 * @property {ClassType} classId - 所选职业 ID
 *
 * @see createInitialCharacter 根据参数创建 Character 对象
 */
export interface CreateCharacterParams {
  name: string;
  factionId: FactionType;
  raceId: RaceType;
  classId: ClassType;
}

// ============================================================================
// 运行时结果接口
// ============================================================================

/**
 * 经验值增益结果接口
 *
 * `applyExpGain` 的返回值，描述经验值增加后的角色状态变化。
 * 一次经验值增加可能触发多级升级（`levelsGained > 1`），
 * Store 根据 `leveledUp` 决定是否发送 `CHARACTER_LEVEL_UP` 事件。
 *
 * @property {Character} character - 增益后的角色数据（stats 可能因升级而变化）
 * @property {boolean} leveledUp - 是否发生了升级（true 时 UI 需展示升级动画）
 * @property {number} levelsGained - 升级级数（可能 >1，表示连升多级）
 * @property {number} newLevel - 增益后的最终等级
 *
 * @see applyExpGain 纯函数，计算经验增益后的角色状态
 */
export interface ExpGainResult {
  character: Character;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

// ============================================================================
// 职业被动技能接口（Phase 5.2 新增）
// ============================================================================

/**
 * 被动技能触发时机枚举
 *
 * 决定被动技能在战斗的哪个环节生效，由 `usePassiveSkills` 在对应时机调用。
 * - `on_combat_start`：战斗开始时触发（如战士怒气掌控获得初始怒气）
 * - `on_turn_start`：玩家回合开始时触发
 * - `on_attack`：玩家攻击命中后触发（如战士嗜血吸血）
 * - `on_damaged`：玩家受伤后触发
 * - `on_low_hp`：玩家生命值低于 30% 时触发（如战士钢铁意志减伤）
 * - `on_kill`：击杀敌人后触发
 * - `passive`：持续生效的属性修正（如潜行者暴击伤害+50%）
 *
 * @see PassiveSkill.trigger 被动技能的触发时机字段
 */
export type PassiveTrigger =
  | 'on_combat_start'
  | 'on_turn_start'
  | 'on_attack'
  | 'on_damaged'
  | 'on_low_hp'
  | 'on_kill'
  | 'passive';

/**
 * 被动技能效果类型枚举
 *
 * 描述被动技能对角色产生的具体效果分类，由 `applyPassive` 内部 switch 分发处理。
 * - `stat_modifier`：属性修正（如暴击伤害+50%、闪避率+10%）
 * - `resource_gen`：资源生成（如战斗开始获得 30 怒气）
 * - `damage_reduction`：减伤（如生命低于 30% 时受伤减少 20%）
 * - `heal`：治疗（如攻击吸血 5%）
 * - `buff`：附加 buff 效果
 *
 * @see PassiveSkill.effect.type 被动技能效果类型字段
 */
export type PassiveEffectType =
  | 'stat_modifier'
  | 'resource_gen'
  | 'damage_reduction'
  | 'heal'
  | 'buff';

/**
 * 被动技能效果接口
 *
 * @property {PassiveEffectType} type - 效果类型（决定 applyPassive 的处理分支）
 * @property {'self' | 'enemy'} target - 效果作用目标
 * @property {string} [stat] - 受影响的属性键（stat_modifier/resource_gen 使用，如 'crit_damage_multiplier'、'rage'）
 * @property {number} value - 效果数值，单位随 type 不同（P2-74 约定）：
 *   - `resource_gen`：绝对数值（如 value: 30 = 生成 30 怒气，value: 2 = 生成 2 连击点）
 *   - `heal`：百分比小数。分母随触发时机变化：on_attack 时按造成伤害计算（如 value: 0.05 = 吸血造成伤害的 5%），
 *     on_turn_start/on_damaged/on_low_hp 时按最大生命计算（如 value: 0.03 = 恢复 3% 最大生命）
 *   - `stat_modifier`：百分比小数（如 value: 0.1 = 属性提升 10%）
 *   - `damage_reduction`：百分比小数（如 value: 0.2 = 减伤 20%）
 *   - `buff`：百分比小数（如 value: 0.08 = 8% 增益）
 * @property {string} [condition] - 触发条件表达式（如 'hp < 0.3' 自身生命百分比、'target_hp < 0.2' 目标敌人生命百分比）
 * @property {number} [probability] - 触发概率（0-1，如 0.3 = 30% 概率触发）。
 *   仅对即时触发型效果（resource_gen/heal/buff）生效，在 applyPassive 入口校验；
 *   stat_modifier/damage_reduction 通过 getStatModifiers/getDamageReduction 实时评估，不受此字段影响
 */
export interface PassiveEffect {
  type: PassiveEffectType;
  target: 'self' | 'enemy';
  stat?: string;
  value: number;
  condition?: string;
  probability?: number;
}

/**
 * 职业被动技能接口
 *
 * 每个职业拥有 3 个专属被动技能，存储在 `src/data/class_passives.ts`，
 * 战斗开始时由 `usePassiveSkills` 加载并按触发时机执行。
 *
 * @property {string} id - 被动技能唯一标识（如 'warrior_iron_will'）
 * @property {string} name - 显示名称
 * @property {string} description - 描述文本（UI 展示）
 * @property {string} icon - 图标（Iconify 格式）
 * @property {ClassType} classId - 所属职业 ID
 * @property {PassiveTrigger} trigger - 触发时机
 * @property {PassiveEffect} effect - 效果配置
 */
export interface PassiveSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  classId: ClassType;
  trigger: PassiveTrigger;
  effect: PassiveEffect;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 阵营存储格式
 *
 * 阵营数据在 IndexedDB `config_factions` 表中的存储格式。
 * 与 `FactionData` 的区别：`id` 为 `string` 而非 `FactionType`，
 * 以兼容 IndexedDB 的 JSON 序列化（不支持联合类型字面量）。
 *
 * 注意：此接口及 RaceStorage、ClassStorage 定义于 character 模块
 * 是为了统一导出给 data 模块使用（`data/service.ts` 中 import）。
 *
 * @property {string} id - 阵营 ID（存储为 string，读取后 as FactionType 转换）
 * @property {string} name - 阵营名称
 * @property {string} icon - 阵营图标
 * @property {string} color - 阵营主色调
 * @property {string} description - 阵营描述
 *
 * @see FactionData 运行时阵营数据类型
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
 *
 * 种族数据在 IndexedDB `config_races` 表中的存储格式。
 * `factionId` 和 `id` 使用 `string` 以兼容 JSON 序列化，
 * `bonus` 使用 `Record<string, number>` 而非 `Stats`（IndexedDB 不支持强类型 interface key）。
 *
 * @property {string} id - 种族 ID（存储为 string）
 * @property {string} name - 种族名称
 * @property {string} icon - 种族图标
 * @property {string} factionId - 所属阵营 ID（存储为 string）
 * @property {Partial<Record<string,number>>} [bonus] - 属性加成（IndexedDB 通用格式）
 * @property {string} description - 种族描述
 *
 * @see RaceData 运行时种族数据类型（通过 as 断言转换）
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
 *
 * 职业数据在 IndexedDB `config_classes` 表中的存储格式。
 * 所有复合类型字段（`primaryStat`、`factionsIds`、`raceIds`）退化为 `string` / `string[]`，
 * `bonus` 使用 `Record<string, number>` 格式。
 *
 * @property {string} id - 职业 ID（存储为 string）
 * @property {string} name - 职业名称
 * @property {string} icon - 职业图标
 * @property {string} primaryStat - 主属性键（存储为 string，如 `"str"`）
 * @property {string[]} factionsIds - 可选阵营 ID 列表
 * @property {string[]} raceIds - 可选种族 ID 列表
 * @property {string} description - 职业描述
 * @property {string} color - 职业主色调
 * @property {Partial<Record<string,number>>} [bonus] - 属性加成
 *
 * @see ClassData 运行时职业数据类型（通过 as 断言转换）
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
 *
 * 角色完整数据在 IndexedDB `char_data` 表中的存储格式。
 * 与 `Character` 的区别：
 * - 字段名映射：`stats` → `baseStats`，`hp` → `currentHp`，`mana` → `currentMp`
 * - 增加持久化专属字段：`bonusStats`、`createdTime`、`lastPlayedTime`、`updatedAt`
 * - `factionId`/`raceId`/`classId` 使用 `string` 以兼容 IndexedDB 序列化
 *
 * 类型设计说明：
 * - `baseStats` 和 `bonusStats` 使用 `Stats` / `Partial<Stats>` 强类型，
 *   因为 `toStorageFormat` 在存储前已完成转换，无需在存储层再做 `Record<string,number>` 桥接
 * - 其他存储接口（FactionStorage 等）使用 `Record<string,number>` 是因为来自 IndexedDB 原始数据，未经转换
 *
 * @property {string} characterId - 角色 ID（主键）
 * @property {string} name - 角色名称
 * @property {string} factionId - 阵营 ID
 * @property {string} raceId - 种族 ID
 * @property {string} classId - 职业 ID
 * @property {number} level - 等级
 * @property {number} exp - 当前经验值
 * @property {number} expToNextLevel - 升级所需经验值
 * @property {number} gold - 金币数量
 * @property {Stats} baseStats - 基础核心属性（10 + 种族 + 职业；不含等级加成）
 * @property {Stats} [potionStats] - 药剂层累加属性（可选，旧存档缺失时由 fromStorageFormat 迁移为全 0）
 * @property {Stats} [allocatedStats] - 升级层已分配属性（可选，旧存档缺失时迁移为全 0）
 * @property {number} [unallocatedPoints] - 升级层未分配点数（可选，旧存档缺失时按 (level-1)*POINTS_PER_LEVEL 补发）
 * @property {number} currentHp - 当前生命值（对应 Character.hp）
 * @property {number} maxHp - 最大生命值（对应 Character.maxHp）
 * @property {number} currentMp - 当前法力值（对应 Character.mana）
 * @property {number} maxMp - 最大法力值（对应 Character.maxMana）
 * @property {Partial<Stats>} bonusStats - 装备/buff 提供的属性加成
 * @property {(string|null)[]} [mountChoices] - 坐骑配置（可选，旧存档缺失时迁移为全 null）
 * @property {number} createdTime - 角色创建时间戳（毫秒）
 * @property {number} lastPlayedTime - 最后游玩时间戳（毫秒）
 * @property {number} updatedAt - 数据最后更新时间戳（毫秒）
 *
 * @see toStorageFormat Character → CharacterDataStorage 转换
 * @see fromStorageFormat CharacterDataStorage → Character 转换
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
  baseStats: Stats;
  /** 药剂层累加属性（可选，旧存档缺失时迁移为全 0） */
  potionStats?: Stats;
  /** 升级层已分配属性（可选，旧存档缺失时迁移为全 0） */
  allocatedStats?: Stats;
  /** 升级层未分配点数（可选，旧存档缺失时按 (level-1)*POINTS_PER_LEVEL 补发） */
  unallocatedPoints?: number;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  bonusStats: Partial<Stats>;
  /** 坐骑配置（可选，旧存档缺失时迁移为 [null,null,null,null,null]） */
  mountChoices?: (string | null)[];
  createdTime: number;
  lastPlayedTime: number;
  updatedAt: number;
}
