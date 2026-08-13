# 角色模块设计文档

## 文档信息

| 项目   | 内容                  |
| ---- | ------------------- |
| 标题   | 角色模块设计文档            |
| 版本   | v4.4                |
| 生成日期 | 2026年8月3日          |
| 所属模块 | `modules/character` |
| 更新说明 | 反映 P3-116「全局状态收敛与持久化重构」：currentCharacterId 收敛至 GameStore（characterStore 通过只读 computed 代理，修改一律经 gameStore.setCurrentCharacterId() 触发持久化）；db.ts 不再访问 runtime_gameState 表；补全 talents 类型定义（TalentEffect 可辨识联合、healing_multiplier/hp_multiplier、TalentEffectSummary 新字段）；补全 setRace/setClass 兼容性校验（isRaceFactionCompatible/isClassRaceCompatible）；修正死亡处理流程与级联删除（Promise.allSettled）描述 |

***

## 模块概述与定位

### 模块定位

角色模块是游戏的核心数据模块，负责管理玩家角色的所有属性、状态和成长数据。作为游戏的基础模块，它为战斗、任务、商店等其他模块提供角色数据支撑。模块内含 talents（天赋）子系统，负责天赋点数分配与效果计算。

### 核心职责

| 职责     | 描述                                        |
| ------ | ----------------------------------------- |
| 角色创建   | 管理角色名称、阵营、种族、职业的选择与存储，含职业阵营兼容性校验           |
| 多角色管理  | 支持创建、选择、删除多个独立角色，级联清理跨模块数据                  |
| 核心属性管理 | 维护六大核心属性（力量、敏捷、体质、智力、感知、魅力），仅允许修改核心属性     |
| 次级属性计算 | 根据核心属性自动计算衍生属性（物理攻击、物理防御、魔法攻击、魔法防御、暴击、闪避、HP加成、MP加成、治疗加成） |
| 成长系统   | 处理等级提升、经验积累、属性增长（每级全属性+1）                  |
| 状态管理   | 管理生命值、魔法值的恢复与消耗                           |
| 金币管理   | 处理金币的获取与消耗                                |
| 属性加成   | 处理装备/buff 的属性加成（applyBonus/removeBonus）    |
| 天赋系统   | 管理天赋点数分配、天赋树层级解锁、天赋效果聚合计算                  |
| 数据持久化  | 实现角色数据的本地存储与加载                            |
| 存档管理   | 委托 data 模块提供导出/导入/修复基础数据能力                 |

### 模块边界

**角色模块**与以下模块交互：

- 装备模块：应用/移除装备属性加成
- 战斗模块：消耗HP/MP
- 商店模块：消耗金币
- 技能模块：消耗MP、创建角色时初始化技能数据
- 任务模块：获取经验和金币奖励
- 背包模块：物品使用效果触发角色属性变更
- 探索模块：玩家死亡时调用 `handleDeath()`
- 天赋系统（模块内子模块）：天赋属性加成通过 `applyBonus` 应用到角色
- 游戏状态模块（GameStore）：currentCharacterId 的读写（P3-116 收敛）

### 跨模块通信机制

**角色模块**的跨模块通信遵循"直接 Store Action 调用"模式：

- **其他模块 → 角色模块**：其他模块直接调用 `useCharacterStore()` 的 Action（如 `takeDamage`、`receiveHeal`、`changeMp`、`gainExp`、`gainGold`、`applyBonus`、`removeBonus` 等）
- **角色模块 → 其他模块**：
  - 通过 `eventBus.emit()` 发布角色生命周期事件（`CHARACTER_LEVEL_UP`、`CHARACTER_DEATH`、`CHARACTER_RESURRECTED`、`CHARACTER_CREATED`、`CHARACTER_DELETED`、`CHARACTER_LOGOUT`）供 UI 组件监听动画/音效
  - 创建/删除角色时，跨模块持久化逻辑通过 `CharacterLifecycleService`（`@/services/CharacterLifecycleService`）收口，Store 层不直接依赖其他模块 DbService
  - **角色模块 → 游戏状态模块（GameStore）**：P3-116 后 `currentCharacterId` 收敛到 `useGameStore()`，characterStore 通过只读 computed 代理访问，角色创建/选择/登出/删除时一律经 `gameStore.setCurrentCharacterId()` 更新并持久化到 `runtime_gameState` 表

***

## 功能需求

### 功能需求列表

| 需求编号        | 需求描述                                           | 来源      |
| ----------- | ---------------------------------------------- | ------- |
| FR-CHAR-001 | 支持角色名称设置                                       | 角色创建流程  |
| FR-CHAR-002 | 支持阵营选择（光辉盟约/铁血盟约/中立）                            | 角色创建流程  |
| FR-CHAR-003 | 支持种族选择（根据阵营）                                   | 角色创建流程  |
| FR-CHAR-004 | 支持职业选择（根据种族），含职业阵营兼容性校验                       | 角色创建流程  |
| FR-CHAR-005 | 经验值累加与升级检测（支持连升多级）                             | 战斗/任务奖励 |
| FR-CHAR-006 | 等级提升时自动增加属性（每级全属性+1，受 MAX_STAT 上限约束）          | 成长系统    |
| FR-CHAR-007 | 生命值增减与边界控制                                     | 战斗/药水   |
| FR-CHAR-008 | 魔法值增减与边界控制                                     | 战斗/技能   |
| FR-CHAR-009 | 金币增减与边界控制                                      | 任务奖励/商店 |
| FR-CHAR-010 | 属性加成的应用与移除（装备/buff）                           | 装备系统    |
| FR-CHAR-011 | 数据持久化存储                                        | 存档系统    |
| FR-CHAR-012 | 数据加载恢复                                         | 读档系统    |
| FR-CHAR-013 | 玩家死亡后损失本级所有经验值（exp 归零）                        | 死亡惩罚    |
| FR-CHAR-014 | 玩家死亡后复活，生命法力恢复至最大值的 50%                       | 复活机制    |
| FR-CHAR-015 | 等级上限为 MAX_LEVEL（配置常量 20），达到上限后经验值不再累加         | 成长系统    |
| FR-CHAR-016 | 种族选择后应用对应的属性调整值                                | 角色创建    |
| FR-CHAR-017 | 职业选择后应用对应的属性调整值                                | 角色创建    |
| FR-CHAR-018 | 属性加成按优先级顺序计算，优先级从高到低：基础属性 < 种族调整 < 职业调整 < 装备加成 | 属性系统    |
| FR-CHAR-019 | 支持创建多个独立角色，每个角色拥有唯一ID                          | 多角色系统   |
| FR-CHAR-020 | 支持从角色列表中选择角色进入游戏                               | 多角色系统   |
| FR-CHAR-021 | 支持删除已创建的角色（级联清理跨模块数据）                         | 多角色系统   |
| FR-CHAR-022 | 每个角色数据完全独立，包括属性、进度、物品、任务等                      | 多角色系统   |
| FR-CHAR-023 | 支持退出当前角色返回角色选择界面                               | 多角色系统   |
| FR-CHAR-024 | 支持 characterList 缓存所有角色概要信息                    | 多角色系统   |
| FR-CHAR-025 | 天赋点数分配（每 2 级获得 1 点）                           | 天赋系统    |
| FR-CHAR-026 | 天赋树层级解锁（tier2 需 3 点、tier3 需 6 点）              | 天赋系统    |
| FR-CHAR-027 | 天赋效果聚合计算（属性加成/伤害倍率/减伤/暴击/资源/技能增强）             | 天赋系统    |
| FR-CHAR-028 | 导出/导入存档、修复基础数据（委托 data 模块）                    | 存档系统    |

### 非功能需求

| 需求编号         | 需求描述            | 优先级 |
| ------------ | --------------- | --- |
| NFR-CHAR-001 | 操作失败时回滚数据       | 高   |
| NFR-CHAR-002 | 单次操作响应时间 < 10ms | 高   |
| NFR-CHAR-003 | 支持并发操作          | 中   |
| NFR-CHAR-004 | 数据存储占用 < 1KB    | 中   |

***

## 接口定义

### 角色模块入口导出（index.ts）

```typescript
// 类型导出
export type {
  FactionType, RaceType, ClassType,
  FactionData, RaceData, ClassData,
  Stats, Attributes, Character,
  CharacterListItem, CreateCharacterParams, ExpGainResult,
  PassiveTrigger, PassiveEffectType, PassiveEffect, PassiveSkill,
  FactionStorage, RaceStorage, ClassStorage, CharacterDataStorage
} from './types';

// 数据层导出
export { CharacterDbService, characterDbService } from './db';

// 纯函数导出
export {
  generateCharacterId,
  computeInitialStats,
  computeEffectiveStats,
  computeAttributes,
  isClassFactionCompatible,
  createInitialCharacter,
  applyHpChange,
  applyMpChange,
  isDead,
  applyExpGain,
  applyLevelUp,
  applyGoldChange,
  canAffordGold,
  computeBonusChange,
  recalculateHpMp,
  computeResurrection
} from './service';

// Pinia Store 导出
export { useCharacterStore } from './store';
```

### 天赋子模块入口导出（talents/index.ts）

```typescript
// 类型导出
export type {
  TalentEffectType,
  TalentEffect,
  Talent,
  TalentTree,
  TalentAllocation,
  TalentState
} from './types';

// 常量与配置函数导出
export { TALENT_POINT_RULES, calculateTotalTalentPoints } from './types';

// 纯函数导出
export {
  meetsRequirements,
  getTreeSpentPoints,
  isTierUnlocked,
  canLearnTalent,
  createEmptyEffectSummary,
  calculateTalentEffects,
  getTalentStatBonuses,
  calculateSpentPoints,
  calculateAvailablePoints,
  learnTalent,
  resetAllocations,
  createInitialTalentState,
  type TalentEffectSummary
} from './service';

// Pinia Store 导出
export { useTalentStore } from './store';
```

### Store 暴露接口（useCharacterStore）

角色模块不单独定义 Service 接口，所有对外能力通过 Pinia Store 暴露：

```typescript
export const useCharacterStore = defineStore('character', () => {
  // ==================== 响应式状态 ====================
  // P3-116：currentCharacterId 收敛到 GameStore，此处为只读 computed 代理，
  // 所有修改必须通过 gameStore.setCurrentCharacterId() 完成（触发持久化），
  // 不能直接赋值 currentCharacterId.value（只读 computed 会触发 Vue 警告且不生效）
  const currentCharacterId: ComputedRef<string | null>;
  const character: Ref<Character | null>;
  const characterList: Ref<CharacterListItem[]>;
  const bonusStats: Ref<Partial<Stats>>;
  const raceBonus: Ref<Partial<Stats>>;
  const classBonus: Ref<Partial<Stats>>;
  const factionsData: Ref<Record<string, FactionData>>;
  const racesData: Ref<Record<string, RaceData>>;
  const classesData: Ref<Record<string, ClassData>>;

  // ==================== 计算属性 ====================
  const isLoggedIn: ComputedRef<boolean>;
  const effectiveStats: ComputedRef<Stats>;
  const attributes: ComputedRef<Attributes>;
  const level: ComputedRef<number>;
  const exp: ComputedRef<number>;
  const expToNextLevel: ComputedRef<number>;
  const expPercentage: ComputedRef<number>;
  const hp: ComputedRef<number>;
  const maxHp: ComputedRef<number>;
  const hpPercentage: ComputedRef<number>;
  const mana: ComputedRef<number>;
  const maxMana: ComputedRef<number>;
  const manaPercentage: ComputedRef<number>;
  const gold: ComputedRef<number>;
  const name: ComputedRef<string>;
  const factionId: ComputedRef<FactionType>;
  const raceId: ComputedRef<RaceType>;
  const classId: ComputedRef<ClassType>;
  const factionName: ComputedRef<string>;
  const raceName: ComputedRef<string>;
  const className: ComputedRef<string>;
  const raceIcon: ComputedRef<string>;
  const factionIcon: ComputedRef<string>;
  const classIcon: ComputedRef<string>;
  const factionColor: ComputedRef<string>;
  const classColor: ComputedRef<string>;

  // ==================== Action：初始化 ====================
  function initialize(): Promise<void>;
  function loadCharacterList(): Promise<void>;

  // ==================== Action：多角色管理 ====================
  function createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): Promise<string>;
  function selectCharacter(characterId: string, emitEvent?: boolean): Promise<boolean>;
  function deleteCharacter(characterId: string): Promise<boolean>;
  function logout(): Promise<void>;

  // ==================== Action：状态变更 ====================
  function takeDamage(amount: number): Promise<void>;
  function receiveHeal(amount: number): Promise<void>;
  function setHp(value: number): Promise<void>;
  function changeMp(amount: number): Promise<void>;
  function setMp(value: number): Promise<void>;
  function gainExp(amount: number): Promise<void>;
  function gainGold(amount: number): Promise<void>;
  function spendGold(amount: number): Promise<boolean>;

  // ==================== Action：属性加成 ====================
  function applyBonus(delta: Partial<Stats>): Promise<void>;
  function removeBonus(delta: Partial<Stats>): Promise<void>;

  // ==================== Action：种族/职业/名称变更 ====================
  function setRace(race: RaceType): Promise<void>;
  function setClass(classId: ClassType): Promise<void>;
  function setName(name: string): Promise<void>;
  function reset(): Promise<void>;

  // ==================== Action：死亡与复活 ====================
  function handleDeath(): Promise<void>;
  function resurrect(): Promise<void>;

  // ==================== Action：数据查询 ====================
  function getCharacterId(): string | null;
  function getCharacterData(): Character | null;

  // ==================== Action：存档管理（委托 data 模块） ====================
  function exportBackup(): Promise<void>;
  function validateImportBackup(file: File): Promise<ValidationResult>;
  function importBackup(file: File): Promise<ImportResult>;
  function repairBaseData(): Promise<void>;
});
```

### 数据类型定义

```typescript
/** 六大核心属性 - 仅这些属性可直接修改 */
export interface Stats {
  str: number;  // 力量 - 影响物理攻击
  dex: number;  // 敏捷 - 影响闪避和暴击
  con: number;  // 体质 - 影响生命值上限
  int: number;  // 智力 - 影响魔法攻击
  wis: number;  // 感知 - 影响治疗效果
  cha: number;  // 魅力 - 影响对话和交易
}

/** 衍生属性 - 根据核心属性自动计算，不可直接修改 */
export interface Attributes {
  maxHp: number;              // 最大生命值
  maxMana: number;            // 最大魔法值
  physicalAttack: number;     // 物理攻击力
  physicalDefense: number;    // 物理防御力
  magicAttack: number;        // 魔法攻击力
  magicDefense: number;       // 魔法防御力
  critChance: number;         // 暴击率 (%)
  dodgeChance: number;        // 闪避率 (%)
  hpBonus: number;            // 生命值加成
  mpBonus: number;            // 魔法值加成
  healBonus: number;          // 治疗加成
}

/** 阵营数据 */
export interface FactionData {
  id: FactionType;
  name: string;
  icon: string;
  color: string;
  description: string;
}

/** 种族数据 */
export interface RaceData {
  id: RaceType;
  name: string;
  icon: string;
  factionId: FactionType;
  bonus?: Partial<Stats>;
  description: string;
}

/** 职业数据 */
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

/** 角色信息 */
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
  createdTime?: number;  // 角色创建时间戳（毫秒），持久化用
}

/** 阵营类型枚举 */
export type FactionType = 'alliance' | 'horde' | 'neutral';

/** 种族类型枚举 */
export type RaceType =
  | 'human' | 'dwarf' | 'gnome' | 'night_elf' | 'draenei' | 'worgen'
  | 'void_elf' | 'lightforged_draenei' | 'dark_iron_dwarf' | 'kul_tiran' | 'mecha_gnome'
  | 'pandaren' | 'orc' | 'undead' | 'tauren' | 'troll' | 'blood_elves' | 'goblin'
  | 'nightborne' | 'highmountain_tauren' | 'maghar_orc' | 'zandalari' | 'vulpera'
  | 'dracthyr' | 'earthen' | 'harenei';

/** 职业类型枚举 */
export type ClassType =
  | 'warrior' | 'mage' | 'paladin' | 'hunter' | 'rogue' | 'warlock'
  | 'druid' | 'priest' | 'shaman' | 'death_knight' | 'monk' | 'demon_hunter' | 'evoker';

/** 角色列表项 - 用于角色选择界面 */
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

/** 创建角色参数 */
export interface CreateCharacterParams {
  name: string;
  factionId: FactionType;
  raceId: RaceType;
  classId: ClassType;
}

/** 经验值增益结果 */
export interface ExpGainResult {
  character: Character;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

/** 被动技能触发时机枚举 */
export type PassiveTrigger =
  | 'on_combat_start'
  | 'on_turn_start'
  | 'on_attack'
  | 'on_damaged'
  | 'on_low_hp'
  | 'on_kill'
  | 'passive';

/** 被动技能效果类型枚举 */
export type PassiveEffectType =
  | 'stat_modifier'
  | 'resource_gen'
  | 'damage_reduction'
  | 'heal'
  | 'buff';

/** 被动技能效果接口 */
export interface PassiveEffect {
  type: PassiveEffectType;
  target: 'self' | 'enemy';
  stat?: string;
  value: number;
  condition?: string;
}

/** 职业被动技能接口 */
export interface PassiveSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  classId: ClassType;
  trigger: PassiveTrigger;
  effect: PassiveEffect;
}

/** 阵营存储格式（IndexedDB config_factions 表） */
export interface FactionStorage {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

/** 种族存储格式（IndexedDB config_races 表） */
export interface RaceStorage {
  id: string;
  name: string;
  icon: string;
  factionId: string;
  bonus?: Partial<Record<string, number>>;
  description: string;
}

/** 职业存储格式（IndexedDB config_classes 表） */
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

/** 角色数据存储结构（IndexedDB char_data 表） */
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
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  bonusStats: Partial<Stats>;
  createdTime: number;
  lastPlayedTime: number;
  updatedAt: number;
}
```

### 天赋系统类型定义（talents/types.ts）

```typescript
/** 资源上限字段联合类型（resource_bonus 的 stat 字段限定为 `${ResourceType}_max`） */
export type ResourceStatKey = `${ResourceType}_max`;

/** 天赋效果类型枚举 */
export type TalentEffectType =
  | 'stat_bonus'
  | 'damage_multiplier'
  | 'damage_reduction'
  | 'crit_bonus'
  | 'resource_bonus'
  | 'skill_enhance'
  | 'healing_multiplier'
  | 'hp_multiplier'
  | 'special';

/** 基础属性加成效果（stat_bonus，stat 限定为 keyof Stats） */
export interface StatBonusEffect {
  type: 'stat_bonus';
  stat: keyof Stats;
  valuePerRank: number;
}

/** 资源上限加成效果（resource_bonus，stat 限定为 ResourceStatKey） */
export interface ResourceBonusEffect {
  type: 'resource_bonus';
  stat: ResourceStatKey;
  valuePerRank: number;
}

/** 技能增强效果（skill_enhance） */
export interface SkillEnhanceEffect {
  type: 'skill_enhance';
  targetSkill: string;
  valuePerRank: number;
}

/** 特殊效果（special，目前无消费方，仅为兼容保留） */
export interface SpecialEffect {
  type: 'special';
  valuePerRank: number;
  description?: string;
}

/** 无 stat 字段的数值累加效果（damage_multiplier/damage_reduction/crit_bonus/healing_multiplier/hp_multiplier） */
export interface SimpleMultiplierEffect {
  type: 'damage_multiplier' | 'damage_reduction' | 'crit_bonus' | 'healing_multiplier' | 'hp_multiplier';
  valuePerRank: number;
  description?: string;
}

/** 天赋效果可辨识联合类型（P3-139 修复：stat 字段编译期收窄，消除 'hp_max' 等非法属性键） */
export type TalentEffect =
  | StatBonusEffect
  | ResourceBonusEffect
  | SkillEnhanceEffect
  | SpecialEffect
  | SimpleMultiplierEffect;

/** 天赋节点接口 */
export interface Talent {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 1 | 2 | 3;
  maxRank: number;
  requires?: string[];
  effects: TalentEffect[];
}

/** 天赋树接口 */
export interface TalentTree {
  id: string;
  name: string;
  classId: ClassType;
  icon: string;
  description: string;
  talents: Talent[];
}

/** 天赋学习状态（key 为天赋 ID，value 为当前等级） */
export type TalentAllocation = Record<string, number>;

/** 天赋树系统状态接口 */
export interface TalentState {
  allocations: TalentAllocation;
  totalPoints: number;
  availablePoints: number;
}

/** 天赋点数获取规则配置 */
export const TALENT_POINT_RULES = {
  pointsPerLevel: 2,       // 每 2 级获得 1 点天赋点
  basePoints: 0,           // 等级 1 时初始点数
  maxPointsPerTalent: 5,   // 单个天赋最大可分配点数
  tier2Requirement: 3,     // 解锁第 2 层天赋所需该系投入点数
  tier3Requirement: 6,     // 解锁第 3 层天赋所需该系投入点数
} as const;

/** 计算角色在指定等级时应拥有的总天赋点数 */
export function calculateTotalTalentPoints(level: number): number;
```

### 天赋效果聚合类型（talents/service.ts）

```typescript
/** 天赋效果聚合结果（按效果类型分组累加，供战斗系统查询） */
export interface TalentEffectSummary {
  /** 属性加成（stat_bonus），key 为属性键，value 为总加成值 */
  statBonuses: Record<string, number>;
  /** 伤害倍率总和（damage_multiplier） */
  damageMultiplier: number;
  /** 伤害减免总和（damage_reduction） */
  damageReduction: number;
  /** 暴击率加成总和（crit_bonus） */
  critBonus: number;
  /** 资源加成（resource_bonus），key 为资源键，value 为总加成值 */
  resourceBonuses: Record<string, number>;
  /** 治疗倍率总和（healing_multiplier，P2-75 新增），如 0.24 表示治疗量提升 24% */
  healingMultiplier: number;
  /** 生命上限倍率总和（hp_multiplier，P3-139 新增），如 0.15 表示生命上限提升 15% */
  hpMultiplier: number;
  /** 特殊效果列表（special） */
  specialEffects: Array<{ description: string; value: number }>;
  /** 技能增强列表（skill_enhance） */
  skillEnhancements: Array<{ skillId: string; value: number }>;
}
```

### 天赋系统 Store 接口（useTalentStore）

```typescript
export const useTalentStore = defineStore('talent', () => {
  // 响应式状态
  const allocations: Ref<TalentAllocation>;
  const currentClassId: Ref<string>;
  const currentLevel: Ref<number>;

  // 计算属性
  const spentPoints: ComputedRef<number>;
  const totalPoints: ComputedRef<number>;
  const availablePoints: ComputedRef<number>;
  const talentTrees: ComputedRef<TalentTree[]>;
  const effectSummary: ComputedRef<TalentEffectSummary>;
  const statBonuses: ComputedRef<Partial<Stats>>;

  // 生命周期
  function initialize(classId: string, level: number, savedAllocations?: TalentAllocation): void;
  function reset(): void;
  function updateLevel(level: number): void;

  // 操作
  function learn(talentId: string): boolean;
  function resetAllAllocations(): void;

  // 查询
  function canLearn(talentId: string): boolean;
  function getTalentRank(talentId: string): number;
  function getTreeSpentPoints(treeId: string): number;
});
```

### 衍生属性计算公式

| 衍生属性    | 计算函数（来自 `@/utils/calculations`）             | 依赖核心属性   |
| ------- | ----------------------------------------------- | -------- |
| 最大生命值   | `calculateMaxHp(stats)`                          | 体质       |
| 最大魔法值   | `calculateMaxMana(stats)`                        | 智力、感知、魅力 |
| 物理攻击力   | `calculatePhysicalAttack(stats)`                  | 力量、敏捷    |
| 物理防御力   | `calculatePhysicalDefense(stats)`                 | 体质、敏捷    |
| 魔法攻击力   | `calculateMagicAttack(stats)`                     | 智力、感知、魅力 |
| 魔法防御力   | `calculateMagicDefense(stats)`                    | 感知、智力、魅力 |
| 暴击率 (%) | `calculateCritChance(stats)`                      | 敏捷       |
| 闪避率 (%) | `calculateDodgeChance(stats)`                     | 敏捷       |
| HP 加成   | `calculateHpBonus(stats)`                         | 体质       |
| MP 加成   | `calculateMpBonus(stats)`                         | 智力、感知、魅力 |
| 治疗加成    | `calculateHealBonus(stats)`                       | 感知、魅力    |

### 种族属性调整值

光辉盟约阵营种族：

| 种族     | 力量 | 敏捷 | 体质 | 智力 | 感知 | 魅力 | 说明          |
| ------ | -- | -- | -- | -- | -- | -- | ----------- |
| 人类     | +1 | +0 | +0 | +0 | +0 | +1 | 适应性强，擅长外交   |
| 矮人     | +0 | +0 | +2 | +0 | +1 | +0 | 坚韧的工匠种族     |
| 侏儒     | +0 | +1 | +0 | +2 | +0 | +0 | 天才发明家       |
| 暮精灵   | +0 | +2 | +0 | +0 | +1 | +0 | 敏捷且与自然有深厚联系 |
| 星裔    | +0 | +0 | +0 | +0 | +2 | +1 | 拥有圣光的力量     |
| 狼人     | +1 | +2 | +0 | +0 | +0 | +0 | 被诅咒的灰狼王国人   |
| 暗影精灵   | +0 | +1 | +0 | +2 | +0 | +0 | 精通奥术的精灵后裔   |
| 圣光星裔  | +0 | +0 | +1 | +0 | +2 | +0 | 圣光灌注的星裔    |
| 铁炉矮人   | +1 | +0 | +2 | +1 | +0 | +0 | 精通火焰与锻造     |
| 海民 | +0 | +0 | +2 | +0 | +1 | +0 | 海上强国的后裔     |
| 机关侏儒   | +0 | +1 | +0 | +2 | +0 | +0 | 机械改造的侏儒     |

铁血盟约阵营种族：

| 种族     | 力量 | 敏捷 | 体质 | 智力 | 感知 | 魅力 | 说明         |
| ------ | -- | -- | -- | -- | -- | -- | ---------- |
| 兽人     | +2 | +0 | +1 | +0 | +0 | +0 | 超凡的力量和韧性   |
| 亡者   | +0 | +1 | +0 | +2 | +0 | +0 | 亡灵，渴望自由和复仇 |
| 牛角族    | +0 | +0 | +2 | +0 | +1 | +0 | 与大地母亲和谐    |
| 巨魔     | +1 | +2 | +0 | +0 | +0 | +0 | 强大的再生能力    |
| 银辉精灵    | +0 | +0 | +0 | +2 | +0 | +1 | 精通奥术能量     |
| 地精     | +0 | +1 | +0 | +0 | +0 | +2 | 精明的商人种族    |
| 暮光后裔    | +0 | +0 | +0 | +2 | +0 | +1 | 暗夜井的守护者    |
| 高岭牛角族 | +0 | +0 | +2 | +0 | +1 | +0 | 高山的守护者     |
| 棕皮兽人  | +2 | +0 | +1 | +0 | +0 | +0 | 纯净血脉的兽人    |
| 远古巨魔  | +1 | +0 | +2 | +0 | +1 | +0 | 强大的帝国守护者   |
| 狐族     | +0 | +2 | +0 | +0 | +1 | +0 | 敏捷的沙漠行者    |

中立种族：

| 种族   | 力量 | 敏捷 | 体质 | 智力 | 感知 | 魅力 | 说明       |
| ---- | -- | -- | -- | -- | -- | -- | -------- |
| 兽灵族  | +0 | +1 | +1 | +0 | +1 | +0 | 传承古老武学之道 |
| 龙裔  | +0 | +1 | +0 | +2 | +0 | +0 | 龙类血脉的守护者 |
| 大地之子   | +0 | +0 | +2 | +0 | +1 | +0 | 大地的化身    |
| 林荫精灵 | +0 | +1 | +0 | +1 | +1 | +0 | 自然的使者    |

### 职业属性调整值

| 职业   | 力量 | 敏捷 | 体质 | 智力 | 感知 | 魅力 | 主属性 | 说明             |
| ---- | -- | -- | -- | -- | -- | -- | --- | -------------- |
| 战士   | +2 | +0 | +1 | -1 | -1 | +0 | str | 精通武器和护甲的近战战士   |
| 法师   | -1 | +0 | -1 | +3 | +0 | -1 | int | 操控奥术、冰霜和火焰的施法者 |
| 圣骑士  | +1 | -1 | +1 | -1 | +0 | +2 | cha | 神圣的战士，使用圣光之力   |
| 猎人   | +0 | +2 | +1 | -1 | +1 | -1 | dex | 远程武器和野兽控制专家    |
| 潜行者  | -1 | +3 | -1 | -1 | +0 | +0 | dex | 擅长偷袭和暗杀的敏捷杀手   |
| 术士   | -1 | +0 | -1 | +2 | -1 | +2 | int | 使用暗影魔法的危险施法者   |
| 德鲁伊  | -1 | +1 | +0 | +1 | +2 | -1 | wis | 自然的守护者，可变身多种形态 |
| 牧师   | -1 | -1 | -1 | +1 | +3 | -1 | wis | 圣光的仆从，擅长治疗和驱散  |
| 萨满   | +0 | -1 | +1 | +1 | +2 | -1 | wis | 与元素之灵沟通的通灵者    |
| 亡灵骑士 | +2 | -1 | +1 | -1 | -1 | +1 | str | 由死亡中苏醒的黑暗骑士    |
| 武僧   | -1 | +2 | +1 | +0 | +1 | -1 | dex | 掌握古老武学之道的修行者   |
| 影刃猎手 | +0 | +3 | -1 | +1 | -1 | +0 | dex | 对抗深渊军团的暗影猎人    |

### 职业种族对应关系

| 种族     | 阵营 |  战士 | 圣骑士 |  猎人 | 潜行者 |  牧师 | 萨满祭司 |  法师 |  术士 |  武僧 | 德鲁伊 | 亡灵骑士 | 影刃猎手 | 龙脉术士 |
| :----- | :- | :-: | :-: | :-: | :-: | :-: | :--: | :-: | :-: | :-: | :-: | :--: | :--: | :-: |
| 人类     | 光辉盟约 |  是  |  是  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 矮人     | 光辉盟约 |  是  |  是  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 暮精灵   | 光辉盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  是  |   是  |   是  |  否  |
| 侏儒     | 光辉盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 星裔    | 光辉盟约 |  是  |  是  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 狼人     | 光辉盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  是  |   是  |   否  |  否  |
| 暗影精灵   | 光辉盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 圣光星裔  | 光辉盟约 |  是  |  是  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 铁炉矮人   | 光辉盟约 |  是  |  是  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 海民 | 光辉盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  是  |   是  |   否  |  否  |
| 机关侏儒   | 光辉盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 兽人     | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 亡者     | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 牛角族    | 铁血盟约 |  是  |  是  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  是  |   是  |   否  |  否  |
| 巨魔     | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  是  |   是  |   否  |  否  |
| 银辉精灵    | 铁血盟约 |  是  |  是  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   是  |  否  |
| 地精     | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 暮光后裔    | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 高岭牛角族 | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  是  |   是  |   否  |  否  |
| 棕皮兽人  | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 远古巨魔  | 铁血盟约 |  是  |  是  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  是  |   是  |   否  |  否  |
| 狐族     | 铁血盟约 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 兽灵族    | 中立 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   是  |   否  |  否  |
| 龙裔    | 中立 |  是  |  否  |  是  |  是  |  是  |   否  |  是  |  是  |  否  |  否  |   否  |   否  |  是  |
| 大地之子     | 中立 |  是  |  是  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  否  |   否  |   否  |  否  |
| 林荫精灵   | 中立 |  是  |  否  |  是  |  是  |  是  |   是  |  是  |  是  |  是  |  是  |   否  |   否  |  否  |

### 属性加成优先级

属性加成按以下优先级顺序计算（从低到高）：

| 优先级 | 加成类型 | 说明           | 是否可叠加   |
| --- | ---- | ------------ | ------- |
| 1   | 基础属性 | 角色初始属性（每项10） | 否       |
| 2   | 种族调整 | 选择种族后获得的属性加成 | 否（唯一）   |
| 3   | 职业调整 | 选择职业后获得的属性加成 | 否（唯一）   |
| 4   | 装备加成 | 穿戴装备获得的属性加成  | 是（多件叠加） |

**属性计算公式：**

```
最终属性 = computeEffectiveStats(baseStats, bonusStats)
其中 baseStats 已包含基础(10) + 种族调整 + 职业调整
```

### 事件定义

| 事件名称                     | 触发时机      | 事件数据                                              |
| ------------------------ | --------- | ------------------------------------------------- |
| `CHARACTER_LEVEL_UP`     | 角色升级时     | `{ oldLevel: number, newLevel: number }`          |
| `CHARACTER_DEATH`        | 角色死亡时     | `{ cause: string }`                               |
| `CHARACTER_RESURRECTED`  | 角色复活时     | `{ newHp: number, newMp: number }`                |
| `CHARACTER_CREATED`      | 角色创建成功时   | `{ characterId: string, name: string }`           |
| `CHARACTER_DELETED`      | 角色删除成功时   | `{ characterId: string }`                         |
| `CHARACTER_LOGOUT`       | 角色退出时     | `null`                                            |

***

## 业务逻辑流程

### 角色创建流程

1. 调用 `generateCharacterId()` 生成唯一角色 ID（格式：`char_时间戳_随机串`，委托 `@/utils/db-helpers` 的 `generateId('char')`）
2. 校验职业与阵营兼容性：`isClassFactionCompatible(cls, factionIdParam)`，不兼容时抛出 `Error`（错误信息含职业名与阵营 ID）
3. 调用 `createInitialCharacter(params, raceData, classData)` 纯函数创建角色数据（基础属性 10 + 种族/职业加成，HP/MP 上限按 `calculateMaxHp`/`calculateMaxMana` 计算，初始金币 50，等级 1，初始经验 0，`expToNextLevel` 取 `getExpForLevel(2)`=100）
4. 更新 Store 状态：`character` 设为新角色、`raceBonus`/`classBonus` 设为当前种族/职业加成；通过 `gameStore.setCurrentCharacterId(id)` 设置 `currentCharacterId`（P3-116：只读 computed 代理，不可直接赋值，设置即触发持久化）
5. 持久化：保存 `CharacterListItem`（`saveCharacterListItem`，先读出已有数据避免覆盖）和完整 `CharacterDataStorage`（`persistCharacter` 调用 `toStorageFormat` + `saveCharacterData`）到 IndexedDB `char_data` 表（P2-51：先落盘基础数据，确保技能初始化失败时角色不丢失）
6. 初始化技能数据：通过 `characterLifecycleService.initializeCharacterSkills(id, classIdParam)` 收口跨模块持久化（查询 `unlockLevel ≤ 1` 的技能模板，前 4 个自动装备到技能栏 slots，持久化到 `char_skills` 表）
7. 触发 `CHARACTER_CREATED` 事件（携带 characterId、name）
8. 刷新 `characterList`（`loadCharacterList`）

### 经验值添加与升级流程

1. 调用 `gainExp(amount)` 方法添加经验值（amount <= 0 时直接返回）
2. 调用 `applyExpGain(character, amount)` 纯函数计算经验值和升级
3. 升级逻辑（`applyLevelUp`）：逐级消耗经验值（`while` 循环），每级全属性 +1（受 `MAX_STAT` 上限约束），HP/MP 重新计算并回满，`expToNextLevel` 从 `getExpForLevel(newLevel + 1)` 获取
4. 等级上限由 `MAX_LEVEL`（`@/config/character`，值为 20）控制，达到上限后经验值归零不再累加
5. 触发 `CHARACTER_LEVEL_UP` 事件（携带 oldLevel、newLevel）
6. 升级经验表从 `src/utils/calculations.ts` 的 `getExpForLevel` 函数获取（数据源 `LEVEL_EXP_REQUIREMENTS`）

### 属性加成应用流程

1. 其他模块调用 `applyBonus(delta)` 应用属性加成
2. 调用 `computeBonusChange(bonusStats, delta, true)` 纯函数计算新的 bonusStats（isAdd=true 时下界为 1，使用 `clampStat`）
3. 仅当影响 HP/MP 的属性（`con`/`int`/`wis` 任一存在）变化时，自动重新计算 HP/MP 上限（`recalculateHpMp`，当前值不超新上限）
4. `effectiveStats` 通过 `computed` 缓存：`computeEffectiveStats(baseStats, bonusStats)`
5. 持久化到 IndexedDB

### 装备属性同步

装备模块调用 `applyBonus(delta)` 和 `removeBonus(delta)` 来同步装备属性变化，角色模块通过 `bonusStats` 累积所有装备加成。`removeBonus` 与 `applyBonus` 对称（isAdd=false 时下界为 0，使用 `clampBonus`），仅当 `con`/`int`/`wis` 变化时重算 HP/MP。

### 种族/职业变更流程

1. 校验兼容性（P3-100）：`setRace` 调用 `isRaceFactionCompatible` 校验所选种族的阵营必须等于角色当前阵营；`setClass` 调用 `isClassFactionCompatible` 与 `isClassRaceCompatible` 校验职业可选阵营与可选种族，不兼容时抛出 `Error`
2. `setRace` / `setClass` 更新对应的 `raceBonus` / `classBonus`
3. 调用 `computeInitialStats(raceBonus, classBonus)` 重新计算基础属性（基础值 10 + 种族加成 + 职业加成，clamp 到 [1, MAX_STAT]）
4. 调用 `recalculateHpMp` 重新计算 HP/MP 上限（基于 effectiveStats）
5. 持久化到 IndexedDB

### 死亡处理流程

1. 外部模块（如战斗模块、探索模块）检测到 HP <= 0 后调用 `handleDeath()`
2. 触发 `CHARACTER_DEATH` 事件（携带 cause: 'death'）
3. 持久化数据
4. 自动调用 `resurrect()`（经验清零与半血复活由 `computeResurrection` 统一处理，死亡惩罚为经验清零而非永久死亡）

### 复活流程

1. 调用 `resurrect()` 方法
2. 调用 `computeResurrection(character)` 纯函数：`exp = 0`，`hp = max(1, floor(maxHp * 0.5))`，`mana = max(1, floor(maxMana * 0.5))`（P1-23：确保复活后至少 1 HP，避免极端情况下复活为 0 形成无限循环）
3. 触发 `CHARACTER_RESURRECTED` 事件（携带 newHp、newMp）
4. 持久化数据

### 角色重置流程

1. 调用 `reset()` 方法
2. 重置 `raceBonus`/`classBonus` 为当前种族/职业加成
3. 重置 `level = 1`、`exp = 0`、`expToNextLevel = getExpForLevel(2)`
4. 调用 `computeInitialStats` 重算基础属性
5. 调用 `recalculateHpMp` 重算 HP/MP 上限
6. 回满 HP/MP 到新上限
7. 持久化到 IndexedDB

### 天赋学习流程

1. 调用 `useTalentStore.learn(talentId)`
2. 调用 `canLearnTalent(talentId, classId, allocations, availablePoints)` 校验（返回 `{ canLearn: boolean; reason: string }`），依次检查：天赋存在性、职业匹配、可用点数、是否达 maxRank、前置条件（`meetsRequirements`）、层级解锁（`isTierUnlocked`）
3. 校验通过后调用 `learnTalent(allocations, talentId)` 纯函数更新分配状态（对应天赋等级 +1）
4. `effectSummary` 计算属性自动更新（通过 `calculateTalentEffects` 聚合），供战斗系统消费
5. `statBonuses` 计算属性自动更新（通过 `getTalentStatBonuses` 提取 stat_bonus 类型），可通过 `characterStore.applyBonus` 应用到角色
6. 注意：天赋 Store 不直接持久化，由调用方统一持久化

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key           | 数据结构                 | 说明              |
| ----------- | ------------- | -------------------- | --------------- |
| char_data   | `characterId` | CharacterDataStorage | 角色完整数据（列表项 + 详细属性统一存储） |
| runtime_gameState  | `id` | GameStateStorage | 全局游戏状态（currentCharacterId/currentShopId/gameSettings/lastPlayedAt/initializedAt）。P3-116 后由 GameStore 通过 `gameStateHelper`（`getGameState`/`saveGameState`，键名默认 `gameState`）读写，character 模块经 `gameStore.setCurrentCharacterId()` 间接更新，不再直接访问该表 |

### CharacterDataStorage 存储内容

| 字段               | 类型                            | 默认值        | 说明       |
| ---------------- | ----------------------------- | ---------- | -------- |
| `characterId`    | string                        | -          | 角色唯一标识（主键）   |
| `name`           | string                        | 创建时设置      | 角色名称     |
| `factionId`      | string                        | 创建时设置      | 阵营       |
| `raceId`         | string                        | 创建时设置      | 种族       |
| `classId`        | string                        | 创建时设置      | 职业       |
| `level`          | number                        | 1          | 当前等级     |
| `exp`            | number                        | 0          | 当前经验值    |
| `expToNextLevel` | number                        | 100        | 升级所需经验值  |
| `gold`           | number                        | 50         | 金币数量     |
| `baseStats`      | Stats                         | 见下方        | 基础属性     |
| `currentHp`      | number                        | 由 stats 计算 | 当前生命值    |
| `maxHp`          | number                        | 由 stats 计算 | 最大生命值    |
| `currentMp`      | number                        | 由 stats 计算 | 当前魔法值    |
| `maxMp`          | number                        | 由 stats 计算 | 最大魔法值    |
| `bonusStats`     | Partial<Stats>                | {}         | 属性加成     |
| `createdTime`    | number                        | Date.now() | 创建时间戳    |
| `lastPlayedTime` | number                        | Date.now() | 最后游玩时间   |
| `updatedAt`      | number                        | Date.now() | 最后更新时间   |

**基础属性默认值（baseStats，由 `computeInitialStats` 计算）：**

```typescript
baseStats: {
  str: 10 + raceBonus.str + classBonus.str,  // clamp 到 [1, MAX_STAT]
  dex: 10 + raceBonus.dex + classBonus.dex,
  con: 10 + raceBonus.con + classBonus.con,
  int: 10 + raceBonus.int + classBonus.int,
  wis: 10 + raceBonus.wis + classBonus.wis,
  cha: 10 + raceBonus.cha + classBonus.cha
}
```

### 多角色支持说明

角色数据通过以下机制实现多角色隔离：

1. **角色列表缓存**：Store 中 `characterList` (reactive) 缓存所有角色的 `CharacterListItem`，支持快速列出所有角色。
2. **角色详细数据存储**：每个角色的详细属性和状态数据以 `characterId` 为主键存储在 `char_data` 表中。
3. **数据加载流程**：
   - 选择角色时，通过 `characterDbService.getCharacterListItem()` 和 `getCharacterData()` 加载数据，再经 `gameStore.setCurrentCharacterId()` 持久化 `currentCharacterId`（P3-116）
   - Store 中通过 `fromStorageFormat()` 将存储格式转为 `Character` 接口
   - 切换角色时先发送 `CHARACTER_LOGOUT` 事件（`emitEvent=true` 时），再更新 Store 状态；`initialize` 中直接调用时传 `false` 避免无意义 UI 重绘
   - 登出（`logout`）与删除当前角色（`deleteCharacter`）时通过 `gameStore.setCurrentCharacterId(null)` 清空并触发持久化
   - 删除角色时，级联删除通过 `characterLifecycleService.cascadeDeleteCharacter()` 收口，使用 `Promise.allSettled`（P2-69：原 `Promise.all` 会在任一 reject 时立即返回，导致部分删除状态）并行删除 6 个模块数据：技能（`char_skills`）、背包（`char_inventory`）、装备（`char_equipment`）、探索（`char_exploration`）、冒险日志（`runtime_adventureLogs`）、任务（`char_quests`）
4. **角色数据隔离**：每个角色拥有独立的属性、背包、任务进度、装备配置、技能状态、探索进度等数据，完全隔离。

### 同步机制

| 同步类型 | 触发条件         | 延迟       |
| ---- | ------------ | -------- |
| 自动同步 | Action 完成后     | 即时持久化    |
| 页面卸载 | beforeunload | 即时       |

### Service 层纯函数

| 函数名                     | 功能                       |
| ------------------------- | -------------------------- |
| `generateCharacterId()`   | 生成唯一角色ID（委托 `@/utils/db-helpers` 的 `generateId('char')`） |
| `computeInitialStats()`   | 根据种族/职业加成计算初始六大属性（基础值 10 + 加成，clamp 到 [1, MAX_STAT]） |
| `computeEffectiveStats()` | 计算合并 baseStats + bonusStats 后的最终核心属性 |
| `computeAttributes()`     | 计算衍生属性（委托给 calculations 函数） |
| `isClassFactionCompatible()` | 校验职业与阵营兼容性（factionsIds.includes） |
| `isRaceFactionCompatible()` | 校验种族与阵营兼容性（种族的 factionId 必须等于角色阵营，setRace 入口校验） |
| `isClassRaceCompatible()` | 校验职业与种族兼容性（raceIds 为空数组表示无限制，setClass 入口校验） |
| `createInitialCharacter()` | 创建初始角色数据（纯函数，初始金币 50） |
| `applyHpChange()`         | 计算 HP 变更（clamp 到 [0, maxHp]） |
| `applyMpChange()`         | 计算 MP 变更（clamp 到 [0, maxMana]） |
| `isDead()`                | 判断角色是否死亡（hp <= 0） |
| `applyExpGain()`          | 计算经验值增益（含升级判定，支持连升多级，返回 ExpGainResult） |
| `applyLevelUp()`          | 计算升级后角色数据（每级全属性+1，HP/MP 回满） |
| `applyGoldChange()`       | 计算金币变更                |
| `canAffordGold()`         | 检查金币是否足够（amount > 0 且 gold >= amount） |
| `computeBonusChange()`    | 计算加成变更（isAdd 控制增减，true 用 clampStat，false 用 clampBonus） |
| `recalculateHpMp()`       | 重新计算 HP/MP 上限并修正当前值（不超新上限） |
| `computeResurrection()`   | 计算复活后角色数据（exp=0，HP/MP 恢复至 50%，至少为 1） |

### 天赋系统纯函数（talents/service.ts）

| 函数名                     | 功能                       |
| ------------------------- | -------------------------- |
| `meetsRequirements()`     | 检查天赋前置条件是否满足（requires 列表中所有天赋等级 > 0） |
| `getTreeSpentPoints()`    | 计算指定天赋树已投入点数总和 |
| `isTierUnlocked()`        | 检查天赋层级是否已解锁（tier1 始终解锁，tier2 需 3 点，tier3 需 6 点） |
| `canLearnTalent()`        | 综合校验天赋是否可学习（返回 `{canLearn, reason}`） |
| `createEmptyEffectSummary()` | 创建空的天赋效果聚合对象 |
| `calculateTalentEffects()` | 计算指定天赋分配下的所有激活效果（遍历职业所有天赋树） |
| `getTalentStatBonuses()`  | 计算天赋提供的属性加成（仅 stat_bonus 类型，返回 Partial<Stats>） |
| `calculateSpentPoints()`  | 计算当前已使用的总点数 |
| `calculateAvailablePoints()` | 计算剩余可用点数（total - spent，下界 0） |
| `learnTalent()`           | 学习天赋（返回新的分配状态，等级+1） |
| `resetAllocations()`      | 重置天赋分配（清空所有点数，返回 `{}`） |
| `createInitialTalentState()` | 初始化角色的天赋状态（基于等级计算总点数） |

***

## 与其他模块的交互关系

### 依赖关系

- **事件总线 (eventBus)**：发布角色生命周期事件（升级、死亡、复活等），供 UI 组件监听
- **常量配置 (`@/config/character`)**：`MAX_LEVEL`（20）、`MAX_STAT`（999）、`STAT_NAMES`、`LEVEL_EXP_REQUIREMENTS`、衍生属性公式系数（HP_BASE、HP_CON_COEFFICIENT、MP_BASE 等）
- **工具函数 (`@/utils/calculations`)**：提供 `getExpForLevel`、`calculateMaxHp`、`calculateMaxMana`、`calculatePhysicalAttack` 等所有属性计算公式
- **工具函数 (`@/utils/db-helpers`)**：提供 `generateId` 生成唯一 ID
- **工具函数 (`@/utils`)**：提供 `toRawData` 去除 Vue Proxy 包装
- **基础数据 Store (`@/modules/base/store`)**：`useBaseStore` 提供 factions、races、classes 配置数据
- **游戏全局状态模块 (`@/modules/game`)**：`useGameStore` 持有 `currentCharacterId`（P3-116 收敛），characterStore 通过只读 computed 代理访问，所有修改经 `gameStore.setCurrentCharacterId()` 完成并触发持久化；GameStore 需在 characterStore.initialize 之前初始化（App.vue 中先行初始化）
- **数据模块 (`@/modules/data`)**：提供 `dbService.withRetry`、`backupService`、`importService`、`dataInitializer`、`gameStateHelper`（`getGameState`/`saveGameState`，由 GameStore 调用）
- **角色生命周期服务 (`@/services/CharacterLifecycleService`)**：收口角色创建/删除的跨模块持久化逻辑（`initializeCharacterSkills`、`cascadeDeleteCharacter`）
- **天赋配置数据 (`@/data/config_class_talents`)**：提供 `CLASS_TALENT_TREES`、`getTalentById`、`getTalentTreeById`、`getTalentTreesByClassId` 天赋树定义
- **被动技能配置数据 (`@/data/config_class_passives`)**：提供 `CLASS_PASSIVES`、`getPassivesByClassId` 职业被动技能定义

### 交互模块

| 模块   | 交互方式     | 说明                                                 |
| ---- | -------- | -------------------------------------------------- |
| 装备模块 | 直接 Action 调用 | 装备存储调用 `applyBonus`/`removeBonus` 同步装备属性        |
| 战斗模块 | 直接 Action 调用 | 战斗中调用 `takeDamage`、`receiveHeal`、`changeMp`、`gainExp` |
| 技能模块 | 直接 Action 调用 + 生命周期服务 | 技能使用时调用 `changeMp(-cost)`、`receiveHeal(amount)`；创建角色时通过 `CharacterLifecycleService` 初始化技能数据 |
| 背包模块 | 直接 Action 调用 + 生命周期服务 | 物品使用时调用 `receiveHeal`、`changeMp`、`applyBonus`；删除角色时级联清理 |
| 任务模块 | 直接 Action 调用 + 生命周期服务 | 任务完成时调用 `gainGold`、`gainExp`；删除角色时级联清理 |
| 商店模块 | 直接 Action 调用 | 购买时调用 `spendGold`，出售时调用 `gainGold`               |
| 探索模块 | 直接 Action 调用 | 玩家死亡时调用 `handleDeath()`                           |
| 天赋系统 | 模块内子模块 | 天赋 `statBonuses` 通过 `applyBonus` 应用到角色            |
| 游戏状态模块 | Store 状态代理 | currentCharacterId 经 `gameStore.setCurrentCharacterId()` 读写（P3-116） |

### 事件发布清单

| 事件                       | 发布时机         | 受众        |
| ------------------------ | ------------ | --------- |
| `CHARACTER_LEVEL_UP`     | 角色升级时        | UI组件（动画）  |
| `CHARACTER_DEATH`        | 角色死亡时        | UI组件（提示）  |
| `CHARACTER_RESURRECTED`  | 角色复活时        | UI组件（提示）  |
| `CHARACTER_CREATED`      | 角色创建完成时      | UI组件（导航）  |
| `CHARACTER_DELETED`      | 角色删除完成时      | UI组件（刷新）  |
| `CHARACTER_LOGOUT`       | 角色登出时        | UI组件（清屏）  |

***

## 异常处理机制

### 异常类型与处理策略

| 异常类型   | 触发条件               | 处理策略        | 错误提示       |
| ------ | ------------------ | ----------- | ---------- |
| 存储读取失败 | IndexedDB 解析错误      | 使用默认值初始化    | 控制台输出错误日志  |
| 存储写入失败 | IndexedDB 写入异常      | 静默失败，保留内存数据（dbService.withRetry 重试机制） | 控制台输出错误日志  |
| 负数值输入  | `gainExp`/`receiveHeal`/`takeDamage` 传入非正数 | 忽略操作        | 无提示        |
| 金币变更 0 | `gainGold` 传入 0     | 忽略操作        | 无提示        |
| 金币不足   | `spendGold` 金额超过余额或 amount <= 0 | 返回 false    | UI提示"金币不足" |
| HP溢出   | 超出最大HP             | 自动截断到最大值    | 无提示        |
| MP溢出   | 超出最大MP             | 自动截断到最大值    | 无提示        |
| 职业阵营不兼容 | `createCharacter` 时职业不支持所选阵营 | 抛出 Error    | UI提示错误信息   |
| 种族/职业不兼容 | `setRace`/`setClass` 时种族或职业与当前角色不兼容 | 抛出 Error    | UI提示错误信息   |
| 天赋学习失败 | 可学习性校验未通过          | 返回 false    | UI提示原因     |
| 级联删除失败 | `cascadeDeleteCharacter` 部分模块删除失败 | 主数据已删不回滚，错误上报 errorReporter | 控制台输出错误日志  |

***

## 性能与安全考量

### 性能优化

| 优化点    | 实现方式                                    | 预期效果   |
| ------ | --------------------------------------- | ------ |
| 计算属性缓存 | 使用 `computed` 缓存 `effectiveStats`、`attributes`、`effectSummary` | 避免重复计算 |
| 批量存储   | 仅在数据变更时异步持久化                            | 减少IO操作 |
| 懒加载    | Store 初始化时才加载基础数据和角色数据                   | 加快启动速度 |
| 并行级联删除 | `cascadeDeleteCharacter` 使用 `Promise.allSettled` 并行删除 6 个模块数据（任一失败仍等待全部完成并汇总） | 提升删除性能 |

### 数据安全

| 安全措施 | 实现方式               | 说明     |
| ---- | ------------------ | ------ |
| 输入验证 | 所有数值操作进行边界检查       | 防止非法数据 |
| 数据隔离 | `char_data` 按 characterId 隔离 | 避免数据污染 |
| 异常捕获 | 数据库 IO 通过 `dbService.withRetry` 包裹，含重试机制 | 防止程序崩溃 |
| 数据清理 | 使用 `toRawData()` 去除 Vue Proxy 包装 | 避免 DataCloneError |
| 架构收口 | 跨模块持久化通过 `CharacterLifecycleService` 统一收口 | 避免模块间直接依赖 |
| 事务安全 | `runtime_gameState` 读写通过 `gameStateHelper` 的 `db.transaction` 保证原子性（由 GameStore 调用） | 避免并发写入丢数据 |

### 边界情况处理

| 边界情况   | 处理方式                |
| ------ | ------------------- |
| HP降到0  | 外部模块检测后调用 `handleDeath()` |
| 等级达到上限 | 经验值归零不再累加（`MAX_LEVEL=20` 控制） |
| 属性达到上限 | clamp 到 [1, MAX_STAT=999] |
| 金币数量过大 | 使用 number 类型（支持极大值） |
| 存储被清空  | 使用默认值初始化            |
| 升级经验溢出 | 逐级消耗，支持连升多级         |

***

## 模块文件结构

```
src/modules/character/
  - index.ts              # 模块入口，统一导出接口
  - types.ts              # 类型定义（Character, Stats, Attributes, FactionType, RaceType, ClassType, PassiveSkill, 存储类型等）
  - db.ts                 # 数据库操作层（CharacterDbService）
  - store.ts              # Pinia Store 状态管理（useCharacterStore）
  - service.ts            # 纯逻辑函数（无状态、无副作用）
  - talents/              # 天赋系统子模块
    - index.ts            # 天赋模块入口，统一导出
    - types.ts            # 天赋类型定义（Talent, TalentTree, TalentAllocation 等）
    - service.ts          # 天赋纯函数服务层
    - store.ts            # 天赋 Store 状态管理（useTalentStore）
```

### 文件职责说明

| 文件           | 职责                                  |
| ------------- | ----------------------------------- |
| `index.ts`    | 模块入口，统一导出 types、db、service 和 useCharacterStore（不含 talents 子模块导出） |
| `types.ts`    | TypeScript 类型定义，包含枚举（FactionType/RaceType/ClassType）、配置数据接口（FactionData/RaceData/ClassData）、核心数据接口（Stats/Attributes/Character）、运行时结果接口（ExpGainResult）、被动技能接口（PassiveSkill 等）、存储格式接口（FactionStorage/RaceStorage/ClassStorage/CharacterDataStorage） |
| `db.ts`       | IndexedDB 数据库操作层，封装 `char_data` 表读写（CharacterDbService 类），包含 `toStorageFormat`/`fromStorageFormat` 格式转换；P3-116 后不再直接访问 `runtime_gameState` 表（GameState 操作已迁移至 GameStore） |
| `store.ts`    | Pinia Store 状态管理，响应式数据维护，通过 `characterDbService` 做 CRUD，通过 `eventBus.emit()` 发布角色事件，跨模块持久化委托 `CharacterLifecycleService`，存档管理委托 data 模块；`currentCharacterId` 经 GameStore 只读 computed 代理（P3-116） |
| `service.ts`  | 纯函数服务层，包含所有角色属性计算逻辑（委托给 `@/utils/calculations`），含 `clampStat`/`clampBonus` 边界约束 |
| `talents/index.ts` | 天赋子模块入口，导出类型、常量（TALENT_POINT_RULES）、`calculateTotalTalentPoints`、纯函数和 Store |
| `talents/types.ts` | 天赋类型定义，含 TalentEffectType、Talent、TalentTree、TalentAllocation、TalentState、TALENT_POINT_RULES 配置、`calculateTotalTalentPoints` 函数 |
| `talents/service.ts` | 天赋纯函数服务层，含可学习性校验、效果聚合计算（TalentEffectSummary）、点数计算；内部含私有 `accumulateEffect` 累加器 |
| `talents/store.ts` | 天赋 Store 状态管理（useTalentStore，`defineStore('talent')`），管理分配状态，暴露 effectSummary/statBonuses 计算属性供战斗系统消费 |

***

## 版本历史

| 版本   | 日期         | 修改内容                            | 作者     |
| ---- | ---------- | ------------------------------- | ------ |
| v1.0 | 2026-05-15 | 初始版本，包含基础功能                     | System |
| v1.1 | 2026-05-18 | 添加死亡处理功能：损失本级经验值，复活后生命法力恢复至 50%  | System |
| v2.0 | 2026-05-19 | 添加种族和职业属性调整值，添加属性加成优先级设计        | System |
| v2.1 | 2026-05-19 | 添加多角色创建与管理系统，支持多角色独立数据存储        | System |
| v2.2 | 2026-05-19 | 重构存储架构，实现完整的多角色数据隔离机制           | System |
| v2.3 | 2026-05-22 | 根据职业种族对应关系更新种族和职业表格，添加新种族和龙脉术士职业 | System |
| v3.0 | 2026-06-16 | 重构模块文件结构，拆分为 index.ts + types.ts + db.ts + store.ts + service.ts | System |
| v4.0 | 2026-06-16 | 全面更新与代码对齐：跨模块通信改为直接 Store Action 调用；新增 hpBonus/mpBonus/healBonus 衍生属性；char_data 统一存储；新增 characterList 缓存；死亡/复活逻辑修正；补充 CharacterDataStorage 完整字段 | System |
| v4.1 | 2026-06-17 | 逐文件比对修正：IndexedDB 存储表名 `game_state` → `runtime_gameState` | System |
| v4.2 | 2026-07-10 | 严格对齐源码：补全 talents 子模块文件结构与接口；修正 Store Action 清单与命名；修正 Service 纯函数清单；修正 CharacterDataStorage 字段类型；补全 PassiveSkill/存储类型定义；跨模块持久化经由 CharacterLifecycleService 收口 | System |
| v4.3 | 2026-07-10 | 对照源码重写：补全 talents/index.ts 入口导出与 TalentEffectSummary 类型定义；修正 CharacterDataStorage 默认值表（factionId/raceId/classId 为创建时设置）；补全 config_class_talents 导出（getTalentTreeById/CLASS_TALENT_TREES）与 config_class_passives 依赖；修正天赋学习流程（canLearnTalent 返回 {canLearn,reason}）；补全 gainGold amount===0 边界与 reset() 回满 HP/MP 行为 | System |
| v4.4 | 2026-08-03 | 反映 P3-116「全局状态收敛与持久化重构」：currentCharacterId 收敛至 GameStore（characterStore 只读 computed 代理，修改经 gameStore.setCurrentCharacterId 触发持久化，GameStore 先行初始化）；db.ts 不再直接访问 runtime_gameState 表；补全 talents 类型（TalentEffect 可辨识联合、healing_multiplier/hp_multiplier、TalentEffectSummary 新字段）；补全 setRace/setClass 兼容性校验（isRaceFactionCompatible/isClassRaceCompatible）；修正死亡处理流程、创建流程持久化顺序（先落盘再初始化技能）与级联删除（Promise.allSettled）描述 | System |

***

**文档结束**
