/**
 * 角色模块状态管理（Store 核心架构）
 * 
 * Store 是角色数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Character, CharacterListItem, Stats, Attributes, FactionType, RaceType, ClassType, FactionData, RaceData, ClassData, CreateCharacterParams, StatSource } from './types';
import { characterDbService } from './db';
import { eventBus, GameEvents } from '@/modules/bus';
import { useBaseStore } from '@/modules/base/store';
import { useGameStore } from '@/modules/game';
// CHR-4 修复：角色创建/删除的跨模块持久化逻辑收口到 CharacterLifecycleService，
// Store 层不再直接依赖其他模块的 DbService，遵循五层架构原则。
import { characterLifecycleService } from '@/services/CharacterLifecycleService';
import {
  generateCharacterId,
  createInitialCharacter,
  computeEffectiveStats,
  computeAttributes,
  applyHpChange,
  applyMpChange,
  applyExpGain,
  applyGoldChange,
  canAffordGold,
  computeBonusChange,
  computeInitialStats,
  recalculateHpMp,
  computeResurrection,
  isClassFactionCompatible,
  isRaceFactionCompatible,
  isClassRaceCompatible,
  // 四层属性纯函数（as 重命名避免与下方 Action 同名冲突）
  allocateStat as allocateStatPure,
  resetAllocatedStats as resetAllocatedStatsPure,
  applyPotionBonus as applyPotionBonusPure,
  // 坐骑配置纯函数
  computeMountBonus,
  isTierUnlocked
} from './service';
import { getMountOptionById, MOUNT_TIERS } from '@/data/config_mounts';
import { getExpForLevel } from '@/utils/calculations';
import { BASE_STAT_VALUE, MAX_STAT } from '@/config/character';
import { errorReporter } from '@/utils/errorReport';
import { backupService, importService, dataInitializer } from '../data';
import type { ImportResult, ValidationResult } from '../data';

export const useCharacterStore = defineStore('character', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================
  // P3-116 修复：currentCharacterId 收敛到 GameStore，characterStore 通过只读 computed 代理访问。
  // 所有修改必须通过 gameStore.setCurrentCharacterId() 完成（触发持久化），
  // 不能直接赋值 currentCharacterId.value（只读 computed 会触发 Vue 警告且不生效）。
  const gameStore = useGameStore();
  const currentCharacterId = computed<string | null>(() => gameStore.currentCharacterId);
  const character = ref<Character | null>(null);
  const characterList = ref<CharacterListItem[]>([]);
  const bonusStats = ref<Partial<Stats>>({});
  const raceBonus = ref<Partial<Stats>>({});
  const classBonus = ref<Partial<Stats>>({});

  // 缓存的基础数据
  const factionsData = ref<Record<string, FactionData>>({});
  const racesData = ref<Record<string, RaceData>>({});
  const classesData = ref<Record<string, ClassData>>({});

  // ==================== 计算属性 ====================
  // 所有百分比均为 [0, 100] 范围整数，用于 UI 进度条展示

  const isLoggedIn = computed(() => currentCharacterId.value !== null);

  const effectiveStats = computed<Stats>(() => {
    if (!character.value) return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    return computeEffectiveStats(
      character.value.stats,
      character.value.potionStats,
      character.value.allocatedStats,
      bonusStats.value
    );
  });

  /**
   * 属性来源明细（plan.md §阶段四）
   *
   * 将每个核心属性按四层模型拆解为来源明细，供 UI 组件 hover tooltip 展示，
   * 提升属性构成透明度，辅助玩家做出分配决策。
   *
   * 各层来源与 effectiveStats 的关系：
   *   effectiveStats[key] = clamp(sum(breakdown[key].value), [1, MAX_STAT])
   *
   * 各层来源说明：
   * - `base`：基础值 BASE_STAT_VALUE（固定 10）
   * - `race`：种族加成（raceBonus，固定）
   * - `class`：职业加成（classBonus，固定）
   * - `potion`：药剂层（potionStats，不可重置）
   * - `allocated`：升级层（allocatedStats，可重置）
   * - `bonus`：装备/天赋层（bonusStats 中扣除坐骑部分，避免与 mount 层重复计算）
   * - `mount`：坐骑层（computeMountBonus(mountChoices) 计算的加成，P1 增强）
   *
   * bonus 与 mount 的拆分说明：
   *   坐骑 bonus 通过 setMountChoice 写入 bonusStats，与装备/天赋 bonus 共享同一存储。
   *   statsBreakdown 中将 bonusStats 拆分为"装备/天赋"（bonusStats - mountBonus）和"坐骑"（mountBonus）两层，
   *   两者之和等于原 bonusStats，保证 effectiveStats 计算不变，同时让玩家能清晰看到坐骑贡献。
   *
   * UI 渲染建议：value 为 0 的层显示为灰色或隐藏；负值（如职业调整 -1）需正确展示。
   *
   * 响应式依赖：character.value（含 stats/potionStats/allocatedStats/mountChoices）、
   *              raceBonus、classBonus、bonusStats 任一变化时自动重算。
   */
  const statsBreakdown = computed<Record<keyof Stats, StatSource[]>>(() => {
    const empty: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const char = character.value;
    const potion = char?.potionStats ?? empty;
    const allocated = char?.allocatedStats ?? empty;
    const bonus = bonusStats.value;
    const race = raceBonus.value;
    const cls = classBonus.value;
    // P1 增强：从 bonusStats 中拆分出坐骑贡献，单独展示为 mount 层
    // 防御 char.mountChoices 缺失（旧存档迁移前或测试 mock 不完整时可能为 undefined）
    const mountBonus = char?.mountChoices ? computeMountBonus(char.mountChoices) : {};

    const keys: (keyof Stats)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const result = {} as Record<keyof Stats, StatSource[]>;
    keys.forEach(key => {
      const mountValue = mountBonus[key] || 0;
      // 装备/天赋层 = bonusStats - 坐骑部分（避免重复计算）
      const equipmentValue = (bonus[key] || 0) - mountValue;
      result[key] = [
        { label: '基础', value: BASE_STAT_VALUE, layer: 'base' },
        { label: '种族', value: race[key] || 0, layer: 'race' },
        { label: '职业', value: cls[key] || 0, layer: 'class' },
        { label: '药剂', value: potion[key], layer: 'potion' },
        { label: '升级', value: allocated[key], layer: 'allocated' },
        { label: '装备/天赋', value: equipmentValue, layer: 'bonus' },
        { label: '坐骑', value: mountValue, layer: 'mount' }
      ];
    });
    return result;
  });

  const attributes = computed<Attributes>(() => {
    const cls = classesData.value[classId.value];
    const primaryStat = cls?.primaryStat ?? 'dex';
    return computeAttributes(effectiveStats.value, primaryStat);
  });

  const level = computed(() => character.value?.level || 1);
  const exp = computed(() => character.value?.exp || 0);
  const expToNextLevel = computed(() => character.value?.expToNextLevel || 100);
  const expPercentage = computed(() => {
    // expToNextLevel 已通过 || 100 兜底保证非 0，无需额外除零防御
    return Math.min(100, Math.round((exp.value / expToNextLevel.value) * 100));
  });

  const hp = computed(() => character.value?.hp || 0);
  const maxHp = computed(() => character.value?.maxHp || 100);
  const hpPercentage = computed(() => {
    // maxHp 已通过 || 100 兜底保证非 0，无需额外除零防御
    return Math.min(100, Math.round((hp.value / maxHp.value) * 100));
  });

  const mana = computed(() => character.value?.mana || 0);
  const maxMana = computed(() => character.value?.maxMana || 50);
  const manaPercentage = computed(() => {
    // maxMana 已通过 || 50 兜底保证非 0，无需额外除零防御
    return Math.min(100, Math.round((mana.value / maxMana.value) * 100));
  });

  const gold = computed(() => character.value?.gold || 0);
  const name = computed(() => character.value?.name || '');
  const factionId = computed<FactionType>(() => character.value?.factionId || 'neutral');
  const raceId = computed<RaceType>(() => character.value?.raceId || 'human');
  const classId = computed<ClassType>(() => character.value?.classId || 'warrior');

  const factionName = computed(() => factionsData.value[factionId.value]?.name || '未知阵营');
  const raceName = computed(() => racesData.value[raceId.value]?.name || '未知种族');
  const className = computed(() => classesData.value[classId.value]?.name || '未知职业');
  const raceIcon = computed(() => racesData.value[raceId.value]?.icon || 'game-icons:person');
  const factionIcon = computed(() => factionsData.value[factionId.value]?.icon || 'game-icons:checked-shield');
  const classIcon = computed(() => classesData.value[classId.value]?.icon || 'game-icons:broadsword');
  const factionColor = computed(() => factionsData.value[factionId.value]?.color || '#9d9d9d');
  const classColor = computed(() => classesData.value[classId.value]?.color || '#9d9d9d');

  // ==================== 持久化辅助方法 ====================

  /** 保存角色数据到数据库（saveCharacterData 已包含列表字段，无需单独更新列表项） */
  async function persistCharacter(): Promise<void> {
    if (!currentCharacterId.value || !character.value) return;
    // P3-108 修复：添加 try-catch，持久化失败时上报错误但不抛出异常（fire-and-forget 模式）
    // 避免 IndexedDB 异常中断业务流程，参考 inventory/store.ts 的 persistInventory 实现
    try {
      const storage = characterDbService.toStorageFormat(currentCharacterId.value, character.value, bonusStats.value);
      await characterDbService.saveCharacterData(storage);
    } catch (err) {
      errorReporter.report(err, 'manual', {
        context: '角色数据持久化失败，UI 与 DB 状态可能不一致',
        characterId: currentCharacterId.value,
      });
    }
  }

  // ==================== Action：初始化 ====================

  async function initialize(): Promise<void> {
    // 从 baseStore 获取基础数据
    const baseStore = useBaseStore();
    factionsData.value = Object.fromEntries(baseStore.factions.map(f => [f.id, f]));
    racesData.value = Object.fromEntries(baseStore.races.map(r => [r.id, r]));
    classesData.value = Object.fromEntries(baseStore.classes.map(c => [c.id, c]));

    // P3-116 修复：从 GameStore 读取 currentCharacterId（GameStore 已在 App.vue 中先初始化）
    const currentId = gameStore.getCurrentCharacterId();
    if (currentId) {
      await selectCharacter(currentId, false);
    }
    await loadCharacterList();
  }

  // ==================== Action：角色列表 ====================

  async function loadCharacterList(): Promise<void> {
    characterList.value = await characterDbService.getAllCharacterListItems();
  }

  // ==================== Action：创建角色 ====================
  // 编排流程：Service 纯函数 → Store 状态更新 → 技能初始化 → DB 持久化 → 事件通知

  async function createCharacter(
    name: string,
    factionIdParam: FactionType,
    raceIdParam: RaceType,
    classIdParam: ClassType
  ): Promise<string> {
    const id = generateCharacterId();
    const race = racesData.value[raceIdParam];
    const cls = classesData.value[classIdParam];

    // P8-014 修复：race/cls 为 undefined 时抛出明确错误，避免跳过兼容性校验
    if (!race) throw new Error('无效的种族');
    if (!cls) throw new Error('无效的职业');

    // 校验职业与阵营兼容性（如 death_knight 不对 neutral 开放、evoker 仅对 neutral 开放）
    if (cls && !isClassFactionCompatible(cls, factionIdParam)) {
      throw new Error(`职业「${cls.name}」不支持阵营「${factionIdParam}」`);
    }
    // P5-009 修复：补齐种族↔阵营、种族↔职业兼容性校验（与 setRace/setClass 对齐）
    if (race && !isRaceFactionCompatible(race, factionIdParam)) {
      throw new Error(`种族「${raceIdParam}」不支持阵营「${factionIdParam}」`);
    }
    if (cls && !isClassRaceCompatible(cls, raceIdParam)) {
      throw new Error(`职业「${cls.name}」不支持种族「${raceIdParam}」`);
    }

    const params: CreateCharacterParams = {
      name,
      factionId: factionIdParam,
      raceId: raceIdParam,
      classId: classIdParam
    };

    // 1. 调用纯函数创建角色数据
    const newChar = createInitialCharacter(params, race, cls);

    // 2. 更新 Store 状态
    character.value = newChar;
    // P3-116 修复：通过 GameStore 设置 currentCharacterId（触发持久化）
    await gameStore.setCurrentCharacterId(id);
    raceBonus.value = race?.bonus || {};
    classBonus.value = cls?.bonus || {};

    // P2-51 修复：调整持久化与技能初始化的顺序
    // 原顺序：先 initializeCharacterSkills（跨模块），再持久化基础数据。
    // 若 initializeCharacterSkills 抛异常，角色已在 store 中但未持久化，重启后丢失。
    // 新顺序：先持久化基础数据，再 initializeCharacterSkills。
    // 若 initializeCharacterSkills 失败，角色已落盘，技能可后续重新初始化（可恢复状态）。

    // 3. 持久化基础数据到数据库（先落盘，确保角色不丢失）
    const listItem: CharacterListItem = {
      id,
      name,
      raceId: raceIdParam,
      classId: classIdParam,
      factionId: factionIdParam,
      level: 1,
      createdTime: Date.now(),
      lastPlayedTime: Date.now()
    };
    await characterDbService.saveCharacterListItem(listItem);
    await persistCharacter();

    // 4. 初始化技能数据（CHR-4 修复：通过 CharacterLifecycleService 收口跨模块持久化）
    await characterLifecycleService.initializeCharacterSkills(id, classIdParam);

    // 5. 通知 UI
    eventBus.emit(GameEvents.CHARACTER_CREATED, { characterId: id, name });
    await loadCharacterList();

    return id;
  }

  // ==================== Action：选择角色 ====================

  /**
   * 选择角色并加载完整数据
   * @param characterId - 角色ID
   * @param emitEvent - 是否发送切换事件，initialize 中调用时传 false 避免无意义的 UI 重绘
   */
  async function selectCharacter(characterId: string, emitEvent: boolean = true): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    const data = await characterDbService.getCharacterData(characterId);

    if (!listItem || !data) return false;

    // 更新最后游玩时间
    // P3-98 修复：浅拷贝 listItem 后修改，避免直接 mutate 持久化层返回的对象引用
    const updatedListItem = { ...listItem, lastPlayedTime: Date.now() };
    await characterDbService.saveCharacterListItem(updatedListItem);

    // P3-116 修复：通过 GameStore 设置并持久化 currentCharacterId
    await gameStore.setCurrentCharacterId(characterId);

    // 通知 UI（角色切换时发送 CHARACTER_LOGOUT 用于清理旧角色的音频等模块状态）
    // 注意：initialize 中直接调用时不发送事件，避免启动时多余的 UI 重绘
    // P7-012 修复：currentCharacterId 已由上方 gameStore.setCurrentCharacterId 更新，
    // LOGOUT 事件触发时 currentCharacterId 已是新值（P3-116 变更后注释过期已修正）
    if (emitEvent) {
      eventBus.emit(GameEvents.CHARACTER_LOGOUT, null); // 先登出旧角色 UI 状态
    }

    // 更新 Store 状态
    // P3-116 修复：currentCharacterId 已由上方 gameStore.setCurrentCharacterId 更新（只读 computed 自动反映），无需再赋值
    character.value = characterDbService.fromStorageFormat(data);
    bonusStats.value = data.bonusStats || {};

    const race = racesData.value[data.raceId];
    const cls = classesData.value[data.classId];
    raceBonus.value = race?.bonus || {};
    classBonus.value = cls?.bonus || {};

    return true;
  }

  // ==================== Action：删除角色 ====================

  /**
   * 删除角色及其所有关联数据
   *
   * P2-52 修复：删除流程采用"主数据先行 + 级联失败不阻断"策略：
   * 1. 先删除角色本模块数据（characterDbService）
   * 2. 再级联删除其他模块数据（CharacterLifecycleService）
   *
   * 级联删除内部使用 Promise.allSettled 确保所有模块删除操作都完成，
   * 任一模块失败时汇总错误上报到 errorReporter，但不抛出异常阻断流程。
   * 这样设计的理由：
   * - 角色主数据已删，若此时回滚（重新保存）会导致角色"复活"但关联数据状态不一致
   * - 残留的孤儿数据可通过后续维护脚本清理，比"角色复活但数据残缺"更可控
   * - 失败信息已上报到 errorReporter，运维可感知并介入
   *
   * @param characterId - 角色 ID
   * @returns 是否删除成功（主数据删除成功即视为 true）
   */
  async function deleteCharacter(characterId: string): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    if (!listItem) return false;

    // 删除角色本模块数据
    await characterDbService.deleteCharacterData(characterId);
    // CHR-4 修复：级联删除其他模块数据收口到 CharacterLifecycleService
    // P2-52 修复：级联失败不阻断主流程，错误上报到 errorReporter
    try {
      await characterLifecycleService.cascadeDeleteCharacter(characterId);
    } catch (err) {
      // 级联删除部分失败：主数据已删，记录错误但继续清理 Store 状态
      // 孤儿数据可通过运维脚本清理，比回滚角色主数据更可控
      errorReporter.report(err, 'manual', {
        context: '角色级联删除部分失败，可能产生孤儿数据',
        characterId,
      });
    }

    // 清理 Store 状态
    if (currentCharacterId.value === characterId) {
      // P3-116 修复：通过 GameStore 清空 currentCharacterId（触发持久化）
      await gameStore.setCurrentCharacterId(null);
      character.value = null;
      bonusStats.value = {};
      raceBonus.value = {};
      classBonus.value = {};
    }

    // 通知 UI
    eventBus.emit(GameEvents.CHARACTER_DELETED, { characterId });
    await loadCharacterList();

    return true;
  }

  // ==================== Action：登出 ====================

  async function logout(): Promise<void> {
    // P3-116 修复：通过 GameStore 清空 currentCharacterId（触发持久化）
    await gameStore.setCurrentCharacterId(null);
    character.value = null;
    bonusStats.value = {};
    raceBonus.value = {};
    classBonus.value = {};
    eventBus.emit(GameEvents.CHARACTER_LOGOUT, null);
  }

  // ==================== Action：生命值变更 ====================

  /** 受到伤害（供其他模块直接调用，BIZ-9：仅扣血，死亡处理由调用方触发） */
  async function takeDamage(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    const updated = applyHpChange(character.value, -amount);
    character.value = updated;
    await persistCharacter();
  }

  /** 获得生命恢复（供其他模块直接调用） */
  async function receiveHeal(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    character.value = applyHpChange(character.value, amount);
    await persistCharacter();
  }

  /** 直接设置生命值 */
  async function setHp(value: number): Promise<void> {
    if (!character.value) return;
    character.value = { ...character.value, hp: Math.min(character.value.maxHp, Math.max(0, value)) };
    await persistCharacter();
  }

  // ==================== Action：法力值变更 ====================

  /** 获得/消耗法力值（供其他模块直接调用） */
  async function changeMp(amount: number): Promise<void> {
    if (!character.value) return;
    character.value = applyMpChange(character.value, amount);
    await persistCharacter();
  }

  /** 直接设置法力值 */
  async function setMp(value: number): Promise<void> {
    if (!character.value) return;
    character.value = { ...character.value, mana: Math.min(character.value.maxMana, Math.max(0, value)) };
    await persistCharacter();
  }

  // ==================== Action：经验值变更 ====================

  /** 获得经验值（供其他模块直接调用） */
  async function gainExp(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;

    const { character: updated, leveledUp } = applyExpGain(character.value, amount);
    const oldLevel = character.value.level;
    character.value = updated;
    await persistCharacter();

    if (leveledUp) {
      eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, { oldLevel, newLevel: updated.level });
    }
  }

  // ==================== Action：金币变更 ====================

  /** 获得金币（供其他模块直接调用） */
  async function gainGold(amount: number): Promise<void> {
    if (!character.value || amount <= 0) return;
    character.value = applyGoldChange(character.value, amount);
    await persistCharacter();
  }

  /** 花费金币 */
  async function spendGold(amount: number): Promise<boolean> {
    if (!character.value || !canAffordGold(character.value, amount)) return false;
    character.value = applyGoldChange(character.value, -amount);
    await persistCharacter();
    return true;
  }

  // ==================== Action：属性加成 ====================

  /** 应用属性加成（装备等，供其他模块直接调用） */
  async function applyBonus(delta: Partial<Stats>): Promise<void> {
    if (!character.value) return;
    bonusStats.value = computeBonusChange(bonusStats.value, delta, true);
    // P3-6：仅当影响 HP/MP 的属性（体质/智力/感知）变化时才重算（HP←con，MP←int/wis，cha 不影响）
    if (delta.con || delta.int || delta.wis) {
      const effStats = computeEffectiveStats(
        character.value.stats,
        character.value.potionStats,
        character.value.allocatedStats,
        bonusStats.value
      );
      character.value = recalculateHpMp(character.value, effStats);
    }
    await persistCharacter();
  }

  /** 移除属性加成（装备卸下等，供其他模块直接调用） */
  async function removeBonus(delta: Partial<Stats>): Promise<void> {
    if (!character.value) return;
    bonusStats.value = computeBonusChange(bonusStats.value, delta, false);
    // P3-6：与 applyBonus 保持对称，仅当影响 HP/MP 的属性（体质/智力/感知）变化时才重算
    if (delta.con || delta.int || delta.wis) {
      const effStats = computeEffectiveStats(
        character.value.stats,
        character.value.potionStats,
        character.value.allocatedStats,
        bonusStats.value
      );
      character.value = recalculateHpMp(character.value, effStats);
    }
    await persistCharacter();
  }

  // ==================== Action：四层属性（药剂层 / 升级层） ====================
  // 三个 Action 均委托 service.ts 中的纯函数（已 as 重命名为 *Pure）。
  // HP/MP 上限变更统一由本段 Action 调用 recalculateHpMp 处理，
  // 遵循"纯函数只更新对应层级字段，Store 统一重算"的分层约定（见 service.ts §四层属性注释）。

  /**
   * 永久叠加药剂属性到药剂层（不可重置）
   *
   * 四层属性模型（见 plan.md §3.5）：
   * - 属性药剂的 `bonus` 通过 inventory.useItem 识别后调用本 Action
   * - 永久叠加到 `potionStats`，不提供对应的 remove 接口（不可逆设计）
   * - 与升级层 `allocatedStats` 隔离，`resetAllocatedStats` 不影响药剂层
   *
   * HP/MP 重算规则：当 `delta` 含 con/int/wis 时触发（HP←con，MP←int/wis）。
   * 当前 HP/MP 不超新上限；上限提升时不自动回满（避免"喝药剂=免费回血"的 exploit）。
   *
   * @param delta - 药剂提供的属性加成（如 { str: 1 }）
   */
  async function applyPotionBonus(delta: Partial<Stats>): Promise<void> {
    if (!character.value) return;
    character.value = applyPotionBonusPure(character.value, delta);
    // P3-6：与 applyBonus 保持一致，仅当影响 HP/MP 的属性（体质/智力/感知）变化时才重算
    if (delta.con || delta.int || delta.wis) {
      const effStats = computeEffectiveStats(
        character.value.stats,
        character.value.potionStats,
        character.value.allocatedStats,
        bonusStats.value
      );
      character.value = recalculateHpMp(character.value, effStats);
    }
    await persistCharacter();
  }

  /**
   * 分配 1 点升级点数到指定属性
   *
   * 四层属性模型（见 plan.md §3.6）：
   * - `unallocatedPoints > 0` 时 `allocatedStats[stat]++`，`unallocatedPoints--`
   * - 影响 con/int/wis 时重算 HP/MP 上限
   * - 当前 HP/MP 不自动回满：分配 con 增加 maxHp 时当前 hp 不变（避免 exploit）
   *
   * @param stat - 目标属性键（str/dex/con/int/wis/cha）
   * @returns 是否分配成功（点数不足或未登录返回 false）
   */
  async function allocateStat(stat: keyof Stats): Promise<boolean> {
    if (!character.value || character.value.unallocatedPoints <= 0) return false;
    // P4-003 修复：属性已达 MAX_STAT 时拒绝分配，避免白耗点数
    // P6-057 修复：上限判定基于 effectiveStats（含 potionStats/bonusStats 的聚合值），
    // 避免属性已通过药剂/装备达到上限但仍消耗升级点
    if (effectiveStats.value[stat] >= MAX_STAT) return false;
    const newChar = allocateStatPure(character.value, stat);
    // P3-6：仅 con/int/wis 影响 HP/MP 上限（HP←con，MP←int/wis，str/dex/cha 不影响）
    const needsRecalc = stat === 'con' || stat === 'int' || stat === 'wis';
    character.value = needsRecalc
      ? recalculateHpMp(
          newChar,
          computeEffectiveStats(newChar.stats, newChar.potionStats, newChar.allocatedStats, bonusStats.value)
        )
      : newChar;
    await persistCharacter();
    return true;
  }

  /**
   * 重置升级层已分配点数（完全免费）
   *
   * 四层属性模型（见 plan.md §3.6）：
   * - 将 `allocatedStats` 全部归零，已分配总量回收至 `unallocatedPoints`
   * - 不影响药剂层 `potionStats`（不可重置）
   * - 统一重算 HP/MP：玩家可能已分配 con/int/wis，重置后这些属性归零，maxHp/maxMana 可能降低
   *   当前 HP/MP 按原 `recalculateHpMp` 规则截断到新上限
   */
  async function resetAllocatedStats(): Promise<void> {
    if (!character.value) return;
    const newChar = resetAllocatedStatsPure(character.value);
    // 重置必然可能影响 con/int/wis（玩家可能点了这些属性），统一重算
    character.value = recalculateHpMp(
      newChar,
      computeEffectiveStats(newChar.stats, newChar.potionStats, newChar.allocatedStats, bonusStats.value)
    );
    await persistCharacter();
  }

  // ==================== Action：种族/职业变更 ====================
  // setRace/setClass 共用模式：校验兼容性 → 更新内部 bonus → 重算基础属性 → 重算衍生属性 → 持久化
  // P3-100 修复：与 createCharacter 中已有的 isClassFactionCompatible 校验对齐，
  //              补全 setRace/setClass 缺失的兼容性校验，防止绕过 UI 直接调用 store 导致非法组合。

  /** 设置种族 */
  async function setRace(race: RaceType): Promise<void> {
    if (!character.value) return;
    const raceData = racesData.value[race];
    if (!raceData) return;
    // P3-100 修复：校验种族与当前角色阵营兼容（如 alliance 角色不可切到 horde 种族 orc）
    if (!isRaceFactionCompatible(raceData, character.value.factionId)) {
      throw new Error(`种族「${raceData.name}」不支持阵营「${character.value.factionId}」`);
    }
    raceBonus.value = raceData?.bonus || {};
    character.value = {
      ...character.value,
      raceId: race,
      stats: computeInitialStats(raceBonus.value, classBonus.value)
    };
    const effStats = computeEffectiveStats(
      character.value.stats,
      character.value.potionStats,
      character.value.allocatedStats,
      bonusStats.value
    );
    character.value = recalculateHpMp(character.value, effStats);
    await persistCharacter();
  }

  /** 设置职业 */
  async function setClass(classIdParam: ClassType): Promise<void> {
    if (!character.value) return;
    const classData = classesData.value[classIdParam];
    if (!classData) return;
    // P3-100 修复：校验职业与当前角色阵营和种族均兼容
    if (!isClassFactionCompatible(classData, character.value.factionId)) {
      throw new Error(`职业「${classData.name}」不支持阵营「${character.value.factionId}」`);
    }
    if (!isClassRaceCompatible(classData, character.value.raceId)) {
      throw new Error(`职业「${classData.name}」不支持种族「${character.value.raceId}」`);
    }
    classBonus.value = classData?.bonus || {};
    character.value = {
      ...character.value,
      classId: classIdParam,
      stats: computeInitialStats(raceBonus.value, classBonus.value)
    };
    const effStats = computeEffectiveStats(
      character.value.stats,
      character.value.potionStats,
      character.value.allocatedStats,
      bonusStats.value
    );
    character.value = recalculateHpMp(character.value, effStats);
    await persistCharacter();
  }

  /** 设置角色名称 */
  async function setName(nameStr: string): Promise<void> {
    if (!character.value) return;
    const id = currentCharacterId.value;
    if (!id) return;
    character.value = { ...character.value, name: nameStr };
    // 通过主键精确更新角色列表项（浅拷贝 DB 返回对象，避免直接 mutate 持久化层引用）
    const item = await characterDbService.getCharacterListItem(id);
    if (item) {
      const updatedItem = { ...item, name: nameStr };
      await characterDbService.saveCharacterListItem(updatedItem);
    }
    await persistCharacter();
    // P1-22 修复：刷新 characterList，确保 UI 显示最新名称
    await loadCharacterList();
  }

  /** 重置角色 */
  async function reset(): Promise<void> {
    if (!character.value) return;
    // plan §5.3：reset 一并清空 mountChoices，需先从 bonusStats 扣除当前坐骑 bonus
    // 直接操作 bonusStats 避免多次 recalculateHpMp/persist，最终由本 Action 统一 recalc + persist
    const oldMountBonus = computeMountBonus(character.value.mountChoices);
    if (Object.keys(oldMountBonus).length > 0) {
      bonusStats.value = computeBonusChange(bonusStats.value, oldMountBonus, false);
    }

    const race = racesData.value[character.value.raceId];
    const cls = classesData.value[character.value.classId];
    raceBonus.value = race?.bonus || {};
    classBonus.value = cls?.bonus || {};
    character.value = {
      ...character.value,
      level: 1,
      exp: 0,
      expToNextLevel: getExpForLevel(2),
      stats: computeInitialStats(raceBonus.value, classBonus.value),
      // 四层属性：重置到 1 级角色状态（药剂层保留，因不可重置；升级层清零）
      // 注：potionStats 不清零，遵循"药剂层不可重置"设计原则
      allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      unallocatedPoints: 0,
      // 坐骑配置：一并清空（plan §5.3）；bonus 已在上方扣除
      mountChoices: [null, null, null, null, null],
    };
    const effStats = computeEffectiveStats(
      character.value.stats,
      character.value.potionStats,
      character.value.allocatedStats,
      bonusStats.value
    );
    character.value = recalculateHpMp(character.value, effStats);
    // 重置后回满 HP/MP（更新 maxHp/maxMpa 后同步当前值到上限）
    character.value = { ...character.value, hp: character.value.maxHp, mana: character.value.maxMana };
    await persistCharacter();
  }

  // ==================== Action：坐骑配置 ====================
  // plan §5.1/§5.2：setMountChoice/resetMountChoices 通过 applyBonus/removeBonus 机制应用坐骑 bonus。
  // 战斗中校验已省略：CharacterInfoPopup 在战斗界面不展示，UI 层天然无法修改坐骑（用户确认）。
  // 优化：直接操作 bonusStats.value 并统一 recalculateHpMp + persistCharacter，
  //       避免调用 applyBonus/removeBonus 触发两次 persist。

  /**
   * 设置某档坐骑方向
   *
   * 流程：
   * 1. 校验档位索引合法性、档位解锁、optionId 合法性、tier 匹配
   * 2. 计算旧总 bonus 并从 bonusStats 扣除
   * 3. 更新 mountChoices[tierIndex]
   * 4. 计算新总 bonus 并叠加到 bonusStats
   * 5. 重算 HP/MP（坐骑 bonus 可能含 con/int/wis）并持久化
   *
   * @param tierIndex - 档位索引（0-4，对应 common/uncommon/rare/epic/legendary）
   * @param optionId - 方向 ID（如 `common_str`），传 null 表示取消该档选择
   * @throws 档位索引越界、档位未解锁、optionId 无效、tier 不匹配时抛错
   */
  async function setMountChoice(tierIndex: number, optionId: string | null): Promise<void> {
    if (!character.value) return;

    // 校验档位索引合法性
    if (tierIndex < 0 || tierIndex >= MOUNT_TIERS.length) {
      throw new Error(`无效档位索引: ${tierIndex}`);
    }
    const tierMeta = MOUNT_TIERS[tierIndex];

    // 校验档位解锁
    if (!isTierUnlocked(tierIndex, character.value.level)) {
      throw new Error(`档位 ${tierMeta.label} 未解锁（需 ${tierMeta.unlockLevel} 级）`);
    }

    // 校验方向合法性（optionId 为 null 表示取消选择，跳过此校验）
    if (optionId !== null) {
      const option = getMountOptionById(optionId);
      if (!option) {
        throw new Error(`无效坐骑方向: ${optionId}`);
      }
      if (option.tier !== tierMeta.tier) {
        throw new Error(`方向 ${option.name}（${optionId}）不属于档位 ${tierMeta.label}`);
      }
    }

    // 计算旧总 bonus 并扣除
    const oldBonus = computeMountBonus(character.value.mountChoices);
    if (Object.keys(oldBonus).length > 0) {
      bonusStats.value = computeBonusChange(bonusStats.value, oldBonus, false);
    }

    // 更新选择
    const newChoices = [...character.value.mountChoices];
    // 长度兜底：旧存档迁移或异常数据可能导致 mountChoices 长度不足 5
    while (newChoices.length < MOUNT_TIERS.length) newChoices.push(null);
    newChoices[tierIndex] = optionId;
    character.value = { ...character.value, mountChoices: newChoices };

    // 计算新总 bonus 并叠加
    const newBonus = computeMountBonus(newChoices);
    if (Object.keys(newBonus).length > 0) {
      bonusStats.value = computeBonusChange(bonusStats.value, newBonus, true);
    }

    // 重算 HP/MP（坐骑 bonus 可能含 con/int/wis）
    const effStats = computeEffectiveStats(
      character.value.stats,
      character.value.potionStats,
      character.value.allocatedStats,
      bonusStats.value
    );
    character.value = recalculateHpMp(character.value, effStats);

    await persistCharacter();
  }

  /**
   * 重置所有坐骑选择
   *
   * 非战斗中随时可调用，无需消耗资源（plan §5.3）。
   * 流程：扣除当前总 bonus → 清空 mountChoices → 重算 HP/MP → 持久化。
   */
  async function resetMountChoices(): Promise<void> {
    if (!character.value) return;

    // 扣除当前总 bonus
    const oldBonus = computeMountBonus(character.value.mountChoices);
    if (Object.keys(oldBonus).length > 0) {
      bonusStats.value = computeBonusChange(bonusStats.value, oldBonus, false);
    }

    // 清空选择
    character.value = {
      ...character.value,
      mountChoices: [null, null, null, null, null],
    };

    // 重算 HP/MP
    const effStats = computeEffectiveStats(
      character.value.stats,
      character.value.potionStats,
      character.value.allocatedStats,
      bonusStats.value
    );
    character.value = recalculateHpMp(character.value, effStats);

    await persistCharacter();
  }

  // ==================== Action：死亡与复活 ====================

  /**
   * 处理角色死亡
   *
   * P2-57 设计说明：角色死亡后自动复活（由 computeResurrection 统一处理经验惩罚等状态重置）。
   * 这是有意设计：死亡惩罚为损失部分本级经验 + 半血复活，而非永久死亡。
   * 若未来需要"永久死亡"模式，可在 config 中添加配置项控制此行为。
   */
  async function handleDeath(): Promise<void> {
    if (!character.value) return;

    eventBus.emit(GameEvents.CHARACTER_DEATH, { cause: 'death' });
    await persistCharacter();

    // 自动复活（由 computeResurrection 统一处理经验清零等状态重置）
    await resurrect();
  }

  /** 复活角色 */
  async function resurrect(): Promise<void> {
    if (!character.value) return;
    character.value = computeResurrection(character.value);
    eventBus.emit(GameEvents.CHARACTER_RESURRECTED, {
      newHp: character.value.hp,
      newMp: character.value.mana
    });
    await persistCharacter();
  }

  // ==================== Action：获取数据 ====================

  function getCharacterId(): string | null {
    return currentCharacterId.value;
  }

  function getCharacterData(): Character | null {
    return character.value;
  }

  // ==================== Action：导出/导入存档 ====================
  // 这些方法仅为薄委托，将调用转发给 data 模块的专业 Service
  // 放在 character store 中是为了方便 UI 组件通过单一 Store 入口访问

  /** 导出存档：委托给 BackupService 导出 JSON 文件 */
  async function exportBackup(): Promise<void> {
    await backupService.exportBackup();
  }

  /** 验证导入存档文件：委托给 ImportService */
  async function validateImportBackup(file: File): Promise<ValidationResult> {
    return importService.validateBackup(file);
  }

  /** 导入存档：委托给 ImportService 执行数据导入 */
  async function importBackup(file: File): Promise<ImportResult> {
    return importService.importBackup(file);
  }

  /** 修复基础数据：清空所有 config 表并重新导入默认数据 */
  async function repairBaseData(): Promise<void> {
    await dataInitializer.reinitializeData();
  }

  return {
    // 状态
    currentCharacterId,
    character,
    characterList,
    bonusStats,
    raceBonus,
    classBonus,
    factionsData,
    racesData,
    classesData,

    // 计算属性
    isLoggedIn,
    effectiveStats,
    statsBreakdown,
    attributes,
    level, exp, expToNextLevel, expPercentage,
    hp, maxHp, hpPercentage,
    mana, maxMana, manaPercentage,
    gold, name,
    factionId, raceId, classId,
    factionName, raceName, className,
    raceIcon, factionIcon, classIcon,
    factionColor, classColor,

    // Action
    initialize,
    loadCharacterList,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    logout,
    takeDamage,
    receiveHeal,
    setHp,
    changeMp,
    setMp,
    gainExp,
    gainGold,
    spendGold,
    applyBonus,
    removeBonus,
    // 四层属性 Action
    applyPotionBonus,
    allocateStat,
    resetAllocatedStats,
    // 坐骑配置 Action
    setMountChoice,
    resetMountChoices,
    setRace,
    setClass,
    setName,
    reset,
    handleDeath,
    resurrect,
    getCharacterId,
    getCharacterData,
    exportBackup,
    validateImportBackup,
    importBackup,
    repairBaseData
  };
});
