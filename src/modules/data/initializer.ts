/**
 * @fileoverview 数据初始化服务
 *
 * 负责在游戏首次启动时初始化基础游戏数据，包括：
 * - 阵营、种族、职业数据
 * - 物品、装备、敌人数据
 * - 地图、商店、任务数据
 * - 配置信息
 *
 * 从 service.ts 拆分而来（QA-11），保持原逻辑与公开 API 完全不变。
 */
import type { Table } from 'dexie';
import { db } from './core';
import type { GameStateStorage } from './core';
import { eventBus, GameEvents } from '@/modules/bus';
import type { BossStorage } from '../boss/types';
import type { SkillTemplateStorage } from '../skill/types';
import {
  CONTINENTS,
  LOCATIONS,
  SHOPS,
  QUESTS,
  MOBS,
  BOSSES,
  EQUIPMENT_ITEMS,
  LOOT_ITEMS,
  CLASSES,
  CLASS_ABILITIES,
  MONSTER_ABILITIES,
  RACES,
  FACTIONS,
  CLASS_EQUIPMENT,
  CLASS_PASSIVES,
  CLASS_TALENT_TREES,
  SET_DEFINITIONS,
  SET_PARTS
} from '@/data';

// P8-020 修复：模块级互斥锁，防止并发重复初始化
let initPromise: Promise<void> | null = null;

/**
 * 数据初始化服务类
 *
 * 负责在游戏首次启动时初始化基础游戏数据，包括：
 * - 阵营、种族、职业数据
 * - 物品、装备、敌人数据
 * - 地图、商店、任务数据
 * - 配置信息
 */
export class DataInitializer {
  /** 初始化标志键名 */
  private initFlagKey = 'data_initialized';

  /**
   * 检查数据是否已初始化
   * @returns true 表示已初始化，false 表示未初始化
   */
  async isDataInitialized(): Promise<boolean> {
    const result = await db.runtime_gameState.get(this.initFlagKey);
    return result !== undefined;
  }

  /**
   * 初始化游戏数据
   *
   * 如果数据已初始化则跳过，否则执行完整的初始化流程
   */
  async initializeData(): Promise<void> {
    // P8-020 修复：模块级互斥锁，防止并发重复初始化
    if (initPromise) return initPromise;

    initPromise = (async () => {
    const isInitialized = await this.isDataInitialized();

    if (import.meta.env.DEV) console.log('初始化游戏数据中...');

    try {
      await db.transaction(
        'rw',
        [
          db.config_factions,
          db.config_races,
          db.config_classes,
          db.config_items,
          db.config_equipment_items,
          db.config_mobs,
          db.config_bosses,
          db.config_locations,
          db.config_shops,
          db.config_quests,
          db.config_skills,
          db.config_class_equipment,
          db.config_class_passives,
          db.config_class_talents,
          db.config_set_definitions,
          db.runtime_gameState,
          db.runtime_mapState,
        ],
        async () => {
          if (!isInitialized) {
            // P11-502 修复：地点/大陆数据移入 isInitialized 块内，避免每次启动覆盖
            await this.initLocations();
            await this.initContinents();

            // P9-059 修复：抽取公共 initAllConfigTables 方法，消除与 reinitializeData 的重复初始化逻辑
            await this.initAllConfigTables();

            await db.runtime_gameState.put({
              id: this.initFlagKey,
              initializedAt: new Date().toISOString()
            } as GameStateStorage);
          }
        }
      );

      if (import.meta.env.DEV) console.log('游戏数据初始化完成');

      // BIZ-9：跨模块业务通知例外（参考 code_rule.md §一.5）
      // data 模块不应反向依赖 baseStore，故通过 EventBus 传递最小信号通知重载，
      // 而非直接调用 baseStore.reload()。事件载荷仅含信号，不含业务数据。
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'init', action: 'bulk', id: '*' });
    } catch (error) {
      console.error('初始化游戏数据失败:', error);
      // DBG-3：生产环境仅输出简短信息，避免泄露完整堆栈
      if (error instanceof Error) {
        if (import.meta.env.DEV) {
          console.error('错误名称:', error.name);
          console.error('错误信息:', error.message);
          console.error('错误栈:', error.stack);
        } else {
          console.error('错误:', error.message);
        }
      }
      throw error;
    }
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  }

  /**
   * 通用的表数据初始化方法
   *
   * 将数据数组批量写入指定的数据库表。
   * INIT-1：使用 bulkPut 替代逐条 await put，减少事务往返，加速冷启动。
   *
   * @param table - 目标数据库表
   * @param data - 待写入的数据数组
   */
  private async initTable(table: Table, data: readonly unknown[]): Promise<void> {
    if (data.length > 0) {
      await table.bulkPut(data as unknown[]);
    }
  }

  /**
   * 初始化所有配置表（公共方法）
   *
   * P9-059 修复：抽取 initializeData 与 reinitializeData 中重复的配置表初始化逻辑，
   * 供两者复用。地点/大陆数据（initLocations/initContinents）因调用时机不同不纳入此方法。
   */
  private async initAllConfigTables(): Promise<void> {
    await this.initFactions();
    await this.initRaces();
    await this.initClasses();
    await this.initItems();
    await this.initEquipment();
    await this.initMobs();
    await this.initBosses();
    await this.initShops();
    await this.initQuests();
    await this.initSkillTemplates();
    await this.initGameConstants();
    // DATA-4：职业专属数据持久化（供 admin 后台编辑）
    await this.initClassItems();
    await this.initClassPassives();
    await this.initClassTalents();
    await this.initItemSets();
  }

  /**
   * 初始化阵营数据
   */
  private async initFactions(): Promise<void> {
    await this.initTable(db.config_factions, FACTIONS);
  }

  /**
   * 初始化种族数据
   */
  private async initRaces(): Promise<void> {
    await this.initTable(db.config_races, RACES);
  }

  /**
   * 初始化职业数据
   */
  private async initClasses(): Promise<void> {
    await this.initTable(db.config_classes, CLASSES);
  }

  /**
   * 初始化物品数据
   */
  private async initItems(): Promise<void> {
    await this.initTable(db.config_items, LOOT_ITEMS);
  }

  /**
   * 初始化装备数据
   *
   * P9-017 修复：合并 SET_PARTS（195 件套装部件）到装备表，
   * 确保 unifiedItemTemplateCache 能查询到套装部件。
   */
  private async initEquipment(): Promise<void> {
    await this.initTable(db.config_equipment_items, [...EQUIPMENT_ITEMS, ...SET_PARTS]);
  }

  /**
   * 初始化普通怪物数据
   */
  private async initMobs(): Promise<void> {
    await this.initTable(db.config_mobs, MOBS);
  }

  /**
   * 初始化 Boss 怪物数据
   * ARCH-1 修复：移除对 boss 模块 DbService 的运行时依赖，内联字段转换逻辑，
   * 使用 bulkPut 批量写入（同时优化 PERF-1 的 N+1 写入问题）。
   * 字段转换与 boss/db.ts 的 saveBossTemplate 保持一致。
   */
  private async initBosses(): Promise<void> {
    if (BOSSES.length === 0) return;
    const bossData: BossStorage[] = BOSSES.map(boss => ({
      id: boss.id,
      name: boss.name,
      icon: boss.icon,
      maxHp: boss.maxHp,
      damage: boss.damage,
      xp: boss.xp,
      gold: boss.gold,
      dangerLevel: boss.dangerLevel,
      isBoss: 1,
      // undefined → null：确保 IndexedDB 索引字段存在
      physicalAttack: boss.physicalAttack ?? null,
      physicalDefense: boss.physicalDefense ?? null,
      magicAttack: boss.magicAttack ?? null,
      magicDefense: boss.magicDefense ?? null,
      critChance: boss.critChance ?? null,
      dodgeChance: boss.dodgeChance ?? null,
      // undefined 直接保留（这些字段不参与索引）
      skillPool: boss.skillPool || undefined,
      aiStrategy: boss.aiStrategy || undefined,
      phases: boss.phases || undefined,
      intro: boss.intro || undefined
    }));
    await db.config_bosses.bulkPut(bossData);
  }

  /**
   * 初始化地点数据
   */
  private async initLocations(): Promise<void> {
    await this.initTable(db.config_locations, LOCATIONS);
  }

  /**
   * 初始化大陆数据
   */
  private async initContinents(): Promise<void> {
    await this.initTable(db.config_locations, CONTINENTS);
  }

  /**
   * 初始化商店数据
   */
  private async initShops(): Promise<void> {
    await this.initTable(db.config_shops, SHOPS);
  }

  /**
   * 初始化任务数据
   */
  private async initQuests(): Promise<void> {
    await this.initTable(db.config_quests, QUESTS);
  }

  /**
   * 初始化技能模板数据（含职业技能与怪物技能）
   *
   * P3-143：使用 bulkPut 替代嵌套循环逐条 put，将数百次事务往返压缩为一次批量写入，
   * 与 initTable/initBosses 模式保持一致，加速冷启动。
   *
   * P9-066 修复：@/data 常量已带显式类型注解（CLASS_ABILITIES: { class_id; skills: Skill[] }[]、
   * MONSTER_ABILITIES: Skill[]），spread 后附加 classRestriction/usableBy 与 SkillTemplateStorage
   * 结构兼容，故将原 `as unknown as` 双重断言收敛为单层 `as SkillTemplateStorage`。
   */
  private async initSkillTemplates(): Promise<void> {
    const allSkills: SkillTemplateStorage[] = [];
    // 1. 收集职业技能模板（usableBy 默认为 'player'）
    for (const entry of CLASS_ABILITIES) {
      for (const skill of entry.skills) {
        allSkills.push({
          ...skill,
          classRestriction: entry.class_id,
          usableBy: 'player'
        } as SkillTemplateStorage);
      }
    }
    // 2. 收集怪物/首领技能模板（usableBy = 'enemy'）
    for (const skill of MONSTER_ABILITIES) {
      allSkills.push({
        ...skill,
        classRestriction: null,
        usableBy: 'enemy'
      } as SkillTemplateStorage);
    }
    if (allSkills.length > 0) {
      await db.config_skills.bulkPut(allSkills);
    }
  }

  /**
   * 初始化游戏常量
   */
  private async initGameConstants(): Promise<void> {
    // P9-058 修复：移除已废弃的 maxLevel 字段写入（P3-116 后标记 @deprecated，无代码依赖读取）
    await db.runtime_gameState.put({
      id: 'game_constants',
    } as GameStateStorage);
  }

  /**
   * 初始化职业专属装备数据（DATA-4）
   *
   * 将静态常量 CLASS_EQUIPMENT 写入 config_class_equipment 表，
   * 供 admin 后台编辑。业务模块仍直接 import 静态常量保持同步访问。
   */
  private async initClassItems(): Promise<void> {
    await this.initTable(db.config_class_equipment, CLASS_EQUIPMENT);
  }

  /**
   * 初始化职业被动技能数据（DATA-4）
   */
  private async initClassPassives(): Promise<void> {
    await this.initTable(db.config_class_passives, CLASS_PASSIVES);
  }

  /**
   * 初始化职业天赋树数据（DATA-4）
   */
  private async initClassTalents(): Promise<void> {
    await this.initTable(db.config_class_talents, CLASS_TALENT_TREES);
  }

  /**
   * 初始化套装定义数据（DATA-4）
   */
  private async initItemSets(): Promise<void> {
    await this.initTable(db.config_set_definitions, SET_DEFINITIONS);
  }

  /**
   * 重置数据初始化标志
   *
   * 调用此方法后，下次启动时会重新初始化数据
   */
  async resetData(): Promise<void> {
    await db.runtime_gameState.delete(this.initFlagKey);
    if (import.meta.env.DEV) console.log('数据初始化标志已重置');
  }

  /**
   * 修复基础数据：清空所有 config_ 开头的表，然后重新导入默认数据
   *
   * 用于用户手动触发的基础数据修复操作。
   * 注意：此操作不会影响角色数据（char_* 表）。
   */
  async reinitializeData(): Promise<void> {
    if (import.meta.env.DEV) console.log('开始修复基础数据...');

    try {
      await db.transaction(
        'rw',
        [
          db.config_factions,
          db.config_races,
          db.config_classes,
          db.config_items,
          db.config_equipment_items,
          db.config_mobs,
          db.config_bosses,
          db.config_locations,
          db.config_shops,
          db.config_quests,
          db.config_skills,
          db.config_class_equipment,
          db.config_class_passives,
          db.config_class_talents,
          db.config_set_definitions,
          db.runtime_gameState,
          // P9-063 修复：移除事务中未使用的 runtime_mapState（reinitializeData 不读写该表）
        ],
        async () => {
          // 清空所有 config 表
          await db.config_factions.clear();
          await db.config_races.clear();
          await db.config_classes.clear();
          await db.config_items.clear();
          await db.config_equipment_items.clear();
          await db.config_mobs.clear();
          await db.config_bosses.clear();
          await db.config_locations.clear();
          await db.config_shops.clear();
          await db.config_quests.clear();
          await db.config_skills.clear();
          await db.config_class_equipment.clear();
          await db.config_class_passives.clear();
          await db.config_class_talents.clear();
          await db.config_set_definitions.clear();

          // P9-059 修复：复用公共 initAllConfigTables 方法，消除重复初始化逻辑
          await this.initAllConfigTables();
          await this.initLocations();
          await this.initContinents();

          // 更新初始化标志
          await db.runtime_gameState.put({
            id: this.initFlagKey,
            initializedAt: new Date().toISOString()
          } as GameStateStorage);
        }
      );

      if (import.meta.env.DEV) console.log('基础数据修复完成');

      // BIZ-9：跨模块业务通知例外（参考 code_rule.md §一.5）
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'repair', action: 'bulk', id: '*' });
    } catch (error) {
      console.error('修复基础数据失败:', error);
      throw error;
    }
  }
}
