# 角色模块设计文档

## 文档信息

| 项目   | 内容                  |
| ---- | ------------------- |
| 标题   | 角色模块设计文档            |
| 版本   | v4.1                |
| 生成日期 | 2026年6月17日          |
| 所属模块 | `modules/character` |
| 更新说明 | 逐文件比对修正：存储结构表名 `game_state` 修正为 `runtime_gameState` |

***

## 模块概述与定位

### 模块定位

角色模块是游戏的核心数据模块，负责管理玩家角色的所有属性、状态和成长数据。作为游戏的基础模块，它为战斗、任务、商店等其他模块提供角色数据支撑。

### 核心职责

| 职责     | 描述                                        |
| ------ | ----------------------------------------- |
| 角色创建   | 管理角色名称、阵营、种族、职业的选择与存储                     |
| 多角色管理  | 支持创建、选择、删除多个独立角色                          |
| 核心属性管理 | 维护六大核心属性（力量、敏捷、体质、智力、感知、魅力），仅允许修改核心属性     |
| 次级属性计算 | 根据核心属性自动计算衍生属性（物理攻击、物理防御、魔法攻击、魔法防御、暴击、闪避、HP加成、MP加成、治疗加成） |
| 成长系统   | 处理等级提升、经验积累、属性增长                          |
| 状态管理   | 管理生命值、魔法值的恢复与消耗                           |
| 金币管理   | 处理金币的获取与消耗                                |
| 属性加成   | 处理装备的属性加成                                 |
| 数据持久化  | 实现角色数据的本地存储与加载                            |

### 模块边界

**角色模块**与以下模块交互：

- 装备模块：应用/移除装备属性加成
- 战斗模块：消耗HP/MP
- 商店模块：消耗金币
- 技能模块：消耗MP
- 任务模块：获取经验和金币奖励
- 背包模块：物品使用效果触发角色属性变更

### 跨模块通信机制

**角色模块**的跨模块通信遵循"直接 Store Action 调用"模式：

- **其他模块 → 角色模块**：其他模块直接调用 `useCharacterStore()` 的 Action（如 `takeDamage`、`receiveHeal`、`changeMp`、`gainExp`、`gainGold`、`applyBonus`、`removeBonus` 等）
- **角色模块 → 其他模块**：角色模块仅通过 `eventBus.emit()` 发布角色生命周期事件（`CHARACTER_LEVEL_UP`、`CHARACTER_DEATH`、`CHARACTER_RESURRECTED`、`CHARACTER_CREATED`、`CHARACTER_DELETED`、`CHARACTER_LOGOUT`）供 UI 组件监听动画/音效

***

## 功能需求

### 功能需求列表

| 需求编号        | 需求描述                                           | 来源      |
| ----------- | ---------------------------------------------- | ------- |
| FR-CHAR-001 | 支持角色名称设置                                       | 角色创建流程  |
| FR-CHAR-002 | 支持阵营选择（光辉盟约/铁血盟约）                                  | 角色创建流程  |
| FR-CHAR-003 | 支持种族选择（根据阵营）                                   | 角色创建流程  |
| FR-CHAR-004 | 支持职业选择（根据种族）                                   | 角色创建流程  |
| FR-CHAR-005 | 经验值累加与升级检测                                     | 战斗/任务奖励 |
| FR-CHAR-006 | 等级提升时自动增加属性（每级全属性+1）                          | 成长系统    |
| FR-CHAR-007 | 生命值增减与边界控制                                     | 战斗/药水   |
| FR-CHAR-008 | 魔法值增减与边界控制                                     | 战斗/技能   |
| FR-CHAR-009 | 金币增减与边界控制                                      | 任务奖励/商店 |
| FR-CHAR-010 | 属性加成的应用与移除                                     | 装备系统    |
| FR-CHAR-011 | 数据持久化存储                                        | 存档系统    |
| FR-CHAR-012 | 数据加载恢复                                         | 读档系统    |
| FR-CHAR-013 | 玩家死亡后损失本级所有经验值（exp 归零）                        | 死亡惩罚    |
| FR-CHAR-014 | 玩家死亡后复活，生命法力恢复至最大值的 50%                       | 复活机制    |
| FR-CHAR-015 | 等级上限为 MAX_LEVEL（配置常量），达到上限后经验值不再累加             | 成长系统    |
| FR-CHAR-016 | 种族选择后应用对应的属性调整值                                | 角色创建    |
| FR-CHAR-017 | 职业选择后应用对应的属性调整值                                | 角色创建    |
| FR-CHAR-018 | 属性加成按优先级顺序计算，优先级从高到低：基础属性 < 种族调整 < 职业调整 < 装备加成 | 属性系统    |
| FR-CHAR-019 | 支持创建多个独立角色，每个角色拥有唯一ID                          | 多角色系统   |
| FR-CHAR-020 | 支持从角色列表中选择角色进入游戏                               | 多角色系统   |
| FR-CHAR-021 | 支持删除已创建的角色（需二次确认）                              | 多角色系统   |
| FR-CHAR-022 | 每个角色数据完全独立，包括属性、进度、物品、任务等                      | 多角色系统   |
| FR-CHAR-023 | 支持退出当前角色返回角色选择界面                               | 多角色系统   |
| FR-CHAR-024 | 支持 characterList 缓存所有角色概要信息                     | 多角色系统   |

### 非功能需求

| 需求编号         | 需求描述            | 优先级 |
| ------------ | --------------- | --- |
| NFR-CHAR-001 | 操作失败时回滚数据       | 高   |
| NFR-CHAR-002 | 单次操作响应时间 < 10ms | 高   |
| NFR-CHAR-003 | 支持并发操作          | 中   |
| NFR-CHAR-004 | 数据存储占用 < 1KB    | 中   |

***

## 接口定义

### 服务接口 ICharacterService

```typescript
export interface ICharacterService {
  // === 多角色管理 ===
  createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): Promise<string>;
  selectCharacter(characterId: string): Promise<boolean>;
  deleteCharacter(characterId: string): Promise<boolean>;
  getAllCharacters(): Promise<CharacterListItem[]>;
  getCurrentCharacterId(): string | null;
  logout(): Promise<void>;
  
  // === 状态查询 ===
  getStats(): Stats;
  getAttributes(): Attributes;
  getLevel(): number;
  getExp(): number;
  getExpToNextLevel(): number;
  getName(): string;
  getFaction(): FactionType;
  getRace(): RaceType;
  getClass(): ClassType;
  getGold(): number;
  getCharacterInfo(): Character;
  
  // === 数据修改 ===
  addExp(amount: number): Promise<void>;
  addHp(amount: number): Promise<void>;
  addMp(amount: number): Promise<void>;
  setHp(value: number): Promise<void>;
  setMp(value: number): Promise<void>;
  applyBonus(bonus: Partial<Stats>): Promise<void>;
  removeBonus(bonus: Partial<Stats>): Promise<void>;
  addGold(amount: number): Promise<void>;
  spendGold(amount: number): Promise<boolean>;
  
  // === 角色信息设置 ===
  setName(name: string): Promise<void>;
  setRace(race: RaceType): Promise<void>;
  setClass(classId: ClassType): Promise<void>;
  setFactionId(factionId: FactionType): Promise<void>;
  
  // === 系统操作 ===
  reset(): Promise<void>;
  
  // === 死亡处理 ===
  handleDeath(): Promise<void>;
  resurrect(): Promise<void>;
}
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

/** 种族属性调整值 */
export interface RaceBonus {
  raceId: RaceType;
  factionId: FactionType;
  bonus: Partial<Stats>;
}

/** 职业属性调整值 */
export interface ClassBonus {
  classId: ClassType;
  bonus: Partial<Stats>;
}

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
| MP 加成   | `calculateMpBonus(stats)`                         | 智力       |
| 治疗加成    | `calculateHealBonus(stats)`                       | 感知       |

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
| `CHARACTER_LOGOUT`       | 角色退出时     | -                                                 |

***

## 业务逻辑流程

### 角色创建流程

1. 调用 `generateCharacterId()` 生成唯一角色 ID
2. 调用 `createInitialCharacter(params, raceData, classData)` 纯函数创建角色数据（计算基础属性、HP/MP 上限等）
3. 更新 Store 状态（`character`、`currentCharacterId`、`raceBonus`、`classBonus`）
4. 初始化技能数据：从 `skillsDbService.getSkillTemplatesByClass()` 获取 1 级可用技能，自动装备前 4 个到技能栏
5. 持久化：保存 `CharacterListItem`、`CharacterDataStorage`、`SkillsData` 到 IndexedDB
6. 触发 `CHARACTER_CREATED` 事件（UI 动画）
7. 刷新 `characterList`

### 经验值添加与升级流程

1. 调用 `gainExp(amount)` 方法添加经验值
2. 调用 `applyExpGain(character, amount)` 纯函数计算经验值和升级
3. 升级逻辑（`applyLevelUp`）：每级全属性 +1（受 `MAX_STAT` 上限约束），HP/MP 重新计算并回满，`expToNextLevel` 从 `getExpForLevel(newLevel + 1)` 获取
4. 等级上限由 `MAX_LEVEL`（`@/config/character`）控制
5. 触发 `CHARACTER_LEVEL_UP` 事件
6. 升级经验表从 `src/utils/calculations.ts` 的 `getExpForLevel` 函数获取

### 属性加成应用流程

1. 其他模块调用 `applyBonus(delta)` 应用属性加成
2. 调用 `computeBonusChange()` 纯函数计算新的 bonusStats
3. 如果体质/智力/感知/魅力变化，自动重新计算 HP/MP 上限（`recalculateHpMp`）
4. `effectiveStats` 通过 `computed` 缓存：`computeEffectiveStats(baseStats, bonusStats)`
5. 持久化到 IndexedDB

### 装备属性同步

装备模块调用 `applyBonus(delta)` 和 `removeBonus(delta)` 来同步装备属性变化，角色模块通过 `bonusStats` 累积所有装备加成。

### 死亡处理流程

1. 外部模块（如战斗模块）检测到 HP <= 0 后调用 `handleDeath()`
2. 将当前级经验值清零（`exp = 0`）
3. 触发 `CHARACTER_DEATH` 事件
4. 自动调用 `resurrect()`

### 复活流程

1. 调用 `resurrect()` 方法
2. 调用 `computeResurrection(character)` 纯函数：`exp = 0`，`hp = floor(maxHp * 0.5)`，`mana = floor(maxMana * 0.5)`
3. 触发 `CHARACTER_RESURRECTED` 事件
4. 持久化数据

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key           | 数据结构                 | 说明              |
| ----------- | ------------- | -------------------- | --------------- |
| char_data   | `characterId` | CharacterDataStorage | 角色完整数据（列表项 + 详细属性统一存储） |
| runtime_gameState  | `id` | GameStateStorage | 当前选中角色ID（通过 `characterDbService.getGameState()` 读写） |

### CharacterDataStorage 存储内容

| 字段               | 类型                            | 默认值        | 说明       |
| ---------------- | ----------------------------- | ---------- | -------- |
| `characterId`    | string                        | -          | 角色唯一标识   |
| `name`           | string                        | '冒险者'      | 角色名称     |
| `factionId`      | string                        | null       | 阵营       |
| `raceId`         | string                        | null       | 种族       |
| `classId`        | string                        | null       | 职业       |
| `level`          | number                        | 1          | 当前等级     |
| `exp`            | number                        | 0          | 当前经验值    |
| `expToNextLevel` | number                        | 100        | 升级所需经验值  |
| `gold`           | number                        | 50         | 金币数量     |
| `baseStats`      | Record<string, number>        | 见下方        | 基础属性     |
| `currentHp`      | number                        | 100        | 当前生命值    |
| `maxHp`          | number                        | 100        | 最大生命值    |
| `currentMp`      | number                        | 50         | 当前魔法值    |
| `maxMp`          | number                        | 50         | 最大魔法值    |
| `bonusStats`     | Partial<Record<string, number>> | {}         | 属性加成     |
| `createdTime`    | number                        | Date.now() | 创建时间戳    |
| `lastPlayedTime` | number                        | Date.now() | 最后游玩时间   |
| `updatedAt`      | number                        | Date.now() | 最后更新时间   |

**基础属性默认值：**

```typescript
baseStats: {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
}
```

### 多角色支持说明

角色数据通过以下机制实现多角色隔离：

1. **角色列表缓存**：Store 中 `characterList` (reactive) 缓存所有角色的 `CharacterListItem`，支持快速列出所有角色。
2. **角色详细数据存储**：每个角色的详细属性和状态数据以 `characterId` 为主键存储在 `char_data` 表中。
3. **数据加载流程**：
   - 选择角色时，通过 `characterDbService.getCharacterListItem()` 和 `getCharacterData()` 加载数据
   - Store 中通过 `fromStorageFormat()` 将存储格式转为 `Character` 接口
   - 切换角色时先发送 `CHARACTER_LOGOUT` 事件，再更新 Store 状态
   - 删除角色时，级联删除：角色数据、技能数据、背包数据、装备数据、探索数据、冒险日志、任务数据
4. **角色数据隔离**：每个角色拥有独立的属性、背包、任务进度、装备配置、技能状态、探索进度等数据，完全隔离。

### 同步机制

| 同步类型 | 触发条件         | 延迟       |
| ---- | ------------ | -------- |
| 自动同步 | Action 完成后     | 即时持久化    |
| 页面卸载 | beforeunload | 即时       |

### Service 层纯函数

| 函数名                     | 功能                       |
| ------------------------- | -------------------------- |
| `generateCharacterId()`   | 生成唯一角色ID               |
| `createInitialCharacter()` | 创建初始角色数据（纯函数）      |
| `computeEffectiveStats()` | 计算含装备加成的有效属性        |
| `computeAttributes()`     | 计算衍生属性（委托给 calculations 函数） |
| `applyHpChange()`         | 计算 HP 变更               |
| `applyMpChange()`         | 计算 MP 变更               |
| `isDead()`                | 判断角色是否死亡              |
| `applyExpGain()`          | 计算经验值增益（含升级判定）     |
| `applyLevelUp()`          | 计算升级后角色数据            |
| `applyGoldChange()`       | 计算金币变更                |
| `canAffordGold()`         | 检查金币是否足够              |
| `computeBonusChange()`    | 计算加成变更                |
| `recalculateBaseStats()`  | 重新计算基础属性              |
| `recalculateHpMp()`       | 重新计算 HP/MP 上限并修正     |
| `computeResurrection()`   | 计算复活后角色数据            |

***

## 与其他模块的交互关系

### 依赖关系

- **事件总线 (eventBus)**：发布角色生命周期事件（升级、死亡、复活等），供 UI 组件监听
- **常量配置 (`@/config/character`)**：`MAX_LEVEL`、`MAX_STAT`
- **工具函数 (`@/utils/calculations`)**：提供 `getExpForLevel`、`calculateMaxHp`、`calculateMaxMana` 等所有属性计算公式

### 交互模块

| 模块   | 交互方式     | 说明                                                 |
| ---- | -------- | -------------------------------------------------- |
| 装备模块 | 直接 Action 调用 | 装备存储调用 `applyBonus`/`removeBonus` 同步装备属性        |
| 战斗模块 | 直接 Action 调用 | 战斗中调用 `takeDamage`、`receiveHeal`、`changeMp`、`gainExp` |
| 技能模块 | 直接 Action 调用 | 技能使用时调用 `changeMp(-cost)`、`receiveHeal(amount)`    |
| 背包模块 | 直接 Action 调用 | 物品使用时调用 `receiveHeal`、`changeMp`、`applyBonus`     |
| 任务模块 | 直接 Action 调用 | 任务完成时调用 `gainGold`、`gainExp`                     |
| 商店模块 | 直接 Action 调用 | 购买时调用 `spendGold`，出售时调用 `gainGold`               |
| 探索模块 | 直接 Action 调用 | 玩家死亡时调用 `handleDeath()`                           |

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
| 负数值输入  | `gainExp` 传入负数      | 忽略操作        | 无提示        |
| 金币不足   | `spendGold` 金额超过余额 | 返回 false    | UI提示"金币不足" |
| HP溢出   | 超出最大HP             | 自动截断到最大值    | 无提示        |
| MP溢出   | 超出最大MP             | 自动截断到最大值    | 无提示        |

***

## 性能与安全考量

### 性能优化

| 优化点    | 实现方式                                    | 预期效果   |
| ------ | --------------------------------------- | ------ |
| 计算属性缓存 | 使用 `computed` 缓存 `effectiveStats`、`attributes` | 避免重复计算 |
| 批量存储   | 仅在数据变更时异步持久化                            | 减少IO操作 |
| 懒加载    | Store 初始化时才加载基础数据和角色数据                   | 加快启动速度 |

### 数据安全

| 安全措施 | 实现方式               | 说明     |
| ---- | ------------------ | ------ |
| 输入验证 | 所有数值操作进行边界检查       | 防止非法数据 |
| 数据隔离 | `char_data` 按 characterId 隔离 | 避免数据污染 |
| 异常捕获 | 数据库 IO 通过 `dbService.withRetry` 包裹，含重试机制 | 防止程序崩溃 |
| 数据清理 | 使用 `toRawData()` 去除 Vue Proxy 包装 | 避免 DataCloneError |

### 边界情况处理

| 边界情况   | 处理方式                |
| ------ | ------------------- |
| HP降到0  | 战斗模块检测后调用 `handleDeath()` |
| 等级达到上限 | 经验值不再累加（`MAX_LEVEL` 控制） |
| 金币数量过大 | 使用 number 类型（支持极大值） |
| 存储被清空  | 使用默认值初始化            |

***

## 模块文件结构

```
src/modules/character/
  - index.ts          # 模块入口，统一导出接口
  - types.ts          # 类型定义（Character, Stats, Attributes, FactionType, RaceType, ClassType 等）
  - db.ts             # 数据库操作层（CharacterDbService）
  - store.ts          # Pinia Store 状态管理（useCharacterStore）
  - service.ts        # 纯逻辑函数（无状态、无副作用）
```

### 文件职责说明

| 文件           | 职责                                  |
| ------------- | ----------------------------------- |
| `index.ts`    | 模块入口，统一导出 types、db、service 和 useCharacterStore |
| `types.ts`    | TypeScript 类型定义、接口定义、事件类型定义         |
| `db.ts`       | IndexedDB 数据库操作层，封装 `char_data` 表读写（CharacterDbService 类） |
| `store.ts`    | Pinia Store 状态管理，响应式数据维护，通过 `characterDbService` 做 CRUD，通过 `eventBus.emit()` 发布角色事件 |
| `service.ts`  | 纯函数服务层，包含所有角色属性计算逻辑（委托给 `@/utils/calculations`） |

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

***

**文档结束**
