/**
 * @fileoverview 游戏模块统一导出入口
 * @description 导出所有子模块的公共接口，是整个 modules 层的顶层入口
 * @module modules
 *
 * ARCH-6 风险评估（显式命名导出）：
 * 本文件已从 `export *` 改为显式命名导出，消除 `export *` 的「重名静默覆盖/歧义排除」隐患。
 * TypeScript 对 `export *` 的重名处理为：同名导出会变为歧义而不被导出（不报错），
 * 这使重名问题难以被及时发现。改为显式导出后，任何重名都会在编译期直接报错。
 *
 * 各子模块的公共导出命名空间隔离良好：
 *   - types.ts：类型名均带模块前缀（如 BossInstance、EnemyData、EquipmentState、MapState）
 *   - db.ts：类名统一为 `XxxDbService`、实例名统一为 `xxxDbService`
 *   - service.ts：纯函数名带业务语义前缀（如 generateCharacterId、createEnemyInstance）
 *   - store.ts：Pinia store 统一为 `useXxxStore`，且在各子模块 index.ts 中采用命名导出（非 export *）
 *
 * 重名处理说明：
 *   boss 模块独立定义并导出 5 个 Boss 专属类型（BossIntroEffect、BossIntro、
 *   BossMechanicType、BossMechanic、BossPhase），enemy 模块不再导出这些类型。
 *   仅 AiStrategyType 仍由 enemy（权威定义）和 boss（re-export）同时导出，为避免显式
 *   导出产生重复标识符编译错误，保留先出现的 boss 段的导出；enemy 段省略 AiStrategyType。
 *   其余子模块之间无类型/值重名。
 *
 * 维护约定（新增模块须遵守，避免引入重名）：
 *   1. 类型名以模块名/业务实体名为前缀（如 Questxxx、Shopxxx）
 *   2. 数据层类名采用 `XxxDbService` + `xxxDbService` 实例的固定命名
 *   3. Store 一律使用 `useXxxStore` 命名并在 index.ts 中命名导出
 *   4. 通用工具型类型（如 Result/State/Storage）必须加模块前缀，禁止裸名导出
 */

// ===== admin =====
export type {
  AdminView,
  ConfigTableName,
  ConfigTableMeta,
  AdminOperationResult,
  ReferenceOption,
  AdminRecord,
  FormMode,
  FormConfig
} from './admin';
export { useAdminStore, adminService, adminDbService, CONFIG_TABLES } from './admin';

// ===== animation =====
export type { FloatingType, ParticleConfig } from './animation';
export {
  animateShake,
  animateCritShake,
  animateMagicPulse,
  animateGlow,
  animateHealGlow,
  animateManaGlow,
  animateCritBorderFlash,
  animateDodgeBlink,
  animateFloating,
  animateScreenFlash,
  animateVsFlash,
  createParticleBurst,
  animateBossIntro,
  animatePhaseTransition,
  animateResultPopup
} from './animation';

// ===== audio =====
export type {
  SfxType,
  SfxRoute,
  BgmScene,
  AudioSettings,
  IAudioService,
  OrganPreset
} from './audio';
export {
  SFX_ROUTE_MAP,
  DEFAULT_AUDIO_SETTINGS,
  audioDbService,
  audioService,
  useAudioStore
} from './audio';

// ===== base =====
export type {
  FactionCreateUpdateData,
  RaceCreateUpdateData,
  ClassCreateUpdateData
} from './base';
export { baseDbService, arrayToRecord, useBaseStore } from './base';

// ===== boss =====
export type {
  AiStrategyType,
  BossIntroEffect,
  BossIntro,
  BossMechanicType,
  BossMechanic,
  BossPhase,
  BossStorage,
  BossTemplate,
  BossRuntimeState,
  BossInstance
} from './boss';
export {
  BossDbService,
  bossDbService,
  createBossInstance,
  wrapAsBossInstance,
  executeBossMechanic,
  processBossPhaseMechanics,
  applyPhaseStats,
  BossPhaseManager
} from './boss';

// ===== bus =====
export type {
  EventCallback,
  GameEventPayloadMap,
  IEventBus,
  EventListeners,
  GroupListeners
} from './bus';
export { GameEvents, EventBus, eventBus } from './bus';

// ===== character =====
export type {
  FactionType,
  RaceType,
  ClassType,
  FactionData,
  RaceData,
  ClassData,
  Stats,
  Attributes,
  Character,
  CharacterListItem,
  CreateCharacterParams,
  ExpGainResult,
  PassiveTrigger,
  PassiveEffectType,
  PassiveEffect,
  PassiveSkill,
  FactionStorage,
  RaceStorage,
  ClassStorage,
  CharacterDataStorage
} from './character';
export {
  CharacterDbService,
  characterDbService,
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
  computeResurrection,
  useCharacterStore
} from './character';

// ===== combat =====
export type {
  CombatState,
  CombatResult,
  CombatActionType,
  CombatEventType,
  CombatAction,
  AoeHitInfo,
  CombatActionResult,
  CombatLog,
  CombatLogStorage,
  ICombatContext,
  ICombatQuery,
  ICombatCommand
} from './combat';
export {
  CombatDbService,
  combatDbService,
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
  generateCombatId,
  generateBattleLogId,
  isBossCombat,
  useCombatStore,
  createCombatContext
} from './combat';

// ===== data =====
export type {
  OperationResult,
  PaginatedResult,
  BackupFile,
  BackupData,
  ValidationResult,
  ImportResult,
  CompatibilityResult,
  DatabaseConfig,
  DBServiceConfig,
  BackupConfig,
  InitData,
  IBackupService,
  IImportService,
  GameStateStorage,
  GameDatabaseSchema
} from './data';
export {
  GameDatabase,
  db,
  getTable,
  DBService,
  dbService,
  DataInitializer,
  BackupService,
  ImportService,
  dataInitializer,
  backupService,
  importService,
  getGameState,
  saveGameState
} from './data';

// ===== enemy =====
// Boss 专属类型（BossIntroEffect/BossIntro/BossMechanicType/BossMechanic/BossPhase）
// 由 boss 模块独立导出，enemy 模块不再导出这些类型。
// AiStrategyType 权威定义在 enemy/types.ts，但 boss 模块也 re-export 了此类型
// （boss/types.ts L24）。为避免显式导出重复标识符错误，此处保留 boss 段的导出
// （boss 在本文件中先出现），enemy 段省略 AiStrategyType。
export type {
  DangerLevel,
  EnemyData,
  EnemyDrop,
  EnemyInstance,
  EnemyStorage
} from './enemy';
export {
  EnemyDbService,
  fromStorageBase,
  enemyDbService,
  generateEnemyStats,
  calculateEnemyDamage,
  createEnemyInstance,
  setBossCreateFn,
  useEnemyStore
} from './enemy';

// ===== equipment =====
export type {
  EquipmentSlot,
  EquipmentType,
  EquipmentItem,
  SetBonus,
  SetBonusEffect,
  ItemSet,
  EquippedItem,
  EquipmentState,
  EquipmentDataStorage,
  EquipmentTemplateStorage,
  EquipmentStorage
} from './equipment';
export {
  EquipmentDbService,
  equipmentDbService,
  useEquipmentStore,
  setInventoryCallbacks,
  clearInventoryCallbacks
} from './equipment';

// ===== exploration =====
export type {
  CellType,
  GridEventType,
  RandomEventEffectType,
  ExplorationCell,
  ExplorationState,
  GridEventProbability,
  AreaConfig,
  RandomEventResult,
  EventChoice,
  MultiOptionEventResult,
  GridGenerationConfig,
  ExplorationUICallbacks,
  ExplorationStorage
} from './exploration';
export {
  ExplorationDbService,
  explorationDbService,
  EVENT_TO_CELL_TYPE,
  pickRandomFromArray,
  computeEventProbability,
  buildItemPool,
  determineCellEvent,
  generateTrapDamage,
  generateCampHeal,
  generateItemForCell,
  generateEnemyForCell,
  generateRandomEvent,
  generateMultiOptionEvent,
  generateGrid,
  findStartPosition,
  updateAccessibleCells,
  GRID_SIZE,
  useExplorationStore
} from './exploration';

// ===== inventory =====
export type {
  ItemType,
  ItemRarity,
  ItemTypeData,
  RarityConfig,
  ItemEffectType,
  ItemEffect,
  Item,
  InventoryItem,
  SortField,
  SortOrder,
  ItemFilters,
  InventoryDataStorage,
  ItemDataStorage,
  ItemStorage,
  InventoryStorage
} from './inventory';
export {
  InventoryDbService,
  inventoryDbService,
  INVENTORY_SIZE,
  MAX_STACK,
  ITEM_TYPE_NAMES,
  RARITY_ORDER,
  canStackItem,
  computeStackResult,
  findItemIndex,
  sortItems,
  filterItems,
  sortAndFilterInventory,
  computeUseEffect,
  useInventoryStore
} from './inventory';

// ===== log =====
export type { LogType, LogEntry, AdventureLogData } from './log';
export {
  AdventureLogDbService,
  adventureLogDbService,
  generateLogId,
  LOG_TYPE_ICONS,
  useLogStore
} from './log';

// ===== map =====
export type {
  ContinentData,
  MapView,
  MapState,
  LocationData,
  ZoneStatus,
  ZoneRewards,
  MapZone,
  MapStateStorage,
  LocationStorage
} from './map';
export { mapDbService, useMapStore } from './map';

// ===== quest =====
export type {
  QuestStatus,
  QuestType,
  QuestObjective,
  QuestObjectiveProgress,
  QuestDefinition,
  QuestInstance,
  QuestInstanceStorage,
  QuestDefinitionStorage,
  CharQuestStorage
} from './quest';
export {
  QuestDbService,
  questDbService,
  checkQuestProgress,
  calculateQuestRewards,
  checkPrerequisiteQuests,
  canAcceptQuest,
  generateQuestInstance,
  getDefaultQuests,
  getObjectiveText,
  getEnemyName,
  useQuestStore
} from './quest';

// ===== shop =====
export type {
  ShopConfig,
  ShopItem,
  ShopDisplayItem,
  SoldItemEntry,
  ShopItemsStorage,
  ShopSoldItemsStorage
} from './shop';
export { shopDbService, useShopStore } from './shop';

// ===== skill =====
export type {
  SkillType,
  SkillSlotIndex,
  SkillEffect,
  SkillBuffEffect,
  Skill,
  AppliedEffectInfo,
  SkillUseResult,
  SkillBar,
  SkillsData,
  SkillTemplateStorage
} from './skill';
export {
  skillsDbService,
  calculateSkillDamage,
  getSkillCoefficient,
  calculateBuffValue,
  canLearnSkill,
  validateSkillBarSlot,
  isSkillEquipped,
  canCastSkill,
  useSkillStore
} from './skill';
