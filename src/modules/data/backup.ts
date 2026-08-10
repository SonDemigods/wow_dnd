/**
 * @fileoverview 数据备份服务
 *
 * 提供游戏数据的备份功能，包括：
 * - 创建备份
 * - 导出备份文件
 *
 * 从 service.ts 拆分而来（QA-11）。版本基线重构后移除了自动备份管理功能，
 * 仅保留手动导出/导入；collectAllData 改为 public 供 MigrationService 复用。
 */
import type { Table } from 'dexie';
import { db, getTable } from './core';
import type { GameStateStorage, GameDatabaseSchema } from './core';
import type { FactionStorage, RaceStorage, ClassStorage, PassiveSkill } from '../character/types';
import type { TalentTree } from '../character/talents/types';
import type { ItemStorage } from '../inventory/types';
import type { EquipmentTemplateStorage, EquipmentItem } from '../equipment/types';
import type { ItemSet } from '../equipment/setTypes';
import type { EnemyStorage } from '../enemy/types';
import type { BossStorage } from '../boss/types';
import type { LocationData, MapStateStorage } from '../map/types';
import type { ShopConfig, ShopItemsStorage } from '../shop/types';
import type { SkillTemplateStorage } from '../skill/types';
import type { CombatLogStorage } from '../combat/types';
import type { LogEntry } from '../log/types';
import type { QuestDefinitionStorage } from '../quest/types';
import { BACKUP_CONFIG } from '@/config/database';
import { APP_VERSION } from '@/config/version';
import { downloadBlob } from '@/utils/fileDownload';

import type {
  BackupFile,
  BackupData,
  IBackupService
} from './types';

/**
 * 需要备份的数组形状表配置
 *
 * 定义备份中"直接以数组形式存储"的表（配置表 + map/shop）。
 * collectAllData 读取与 importData 写入均基于此配置驱动，避免重复的 if/else
 * 和散落的类型断言（CODE-34/CODE-38）。
 *
 * 注意：getTable<T> 内部收敛了 Table 类型断言（CODE-5），调用方无需再断言。
 */
/** 数组形状备份字段名集合（用于类型安全的字段访问） */
type ArrayBackupField =
  | 'map'
  | 'shop'
  | 'factions'
  | 'races'
  | 'classes'
  | 'items'
  | 'equipmentItems'
  | 'mobs'
  | 'bosses'
  | 'skillTemplates'
  // P6-200 修复：补齐遗漏的配置表
  | 'questDefinitions'
  | 'classEquipment'
  | 'classPassives'
  | 'classTalents'
  | 'setDefinitions';

const TABLES_TO_BACKUP: ReadonlyArray<{
  /** BackupData 中对应的字段名 */
  field: ArrayBackupField;
  /** GameDatabase 中对应的表名 */
  table: keyof GameDatabaseSchema;
  /** 导入结果中记录的存储表名 */
  storeName: string;
}> = [
  { field: 'map', table: 'config_locations', storeName: 'config_locations' },
  { field: 'shop', table: 'config_shops', storeName: 'config_shops' },
  { field: 'factions', table: 'config_factions', storeName: 'config_factions' },
  { field: 'races', table: 'config_races', storeName: 'config_races' },
  { field: 'classes', table: 'config_classes', storeName: 'config_classes' },
  { field: 'items', table: 'config_items', storeName: 'config_items' },
  { field: 'equipmentItems', table: 'config_equipment_items', storeName: 'config_equipment_items' },
  { field: 'mobs', table: 'config_mobs', storeName: 'config_mobs' },
  { field: 'bosses', table: 'config_bosses', storeName: 'config_bosses' },
  { field: 'skillTemplates', table: 'config_skills', storeName: 'config_skills' },
  // P6-200 修复：补齐遗漏的配置表，避免备份/导入丢失任务与职业数据
  { field: 'questDefinitions', table: 'config_quests', storeName: 'config_quests' },
  { field: 'classEquipment', table: 'config_class_equipment', storeName: 'config_class_equipment' },
  { field: 'classPassives', table: 'config_class_passives', storeName: 'config_class_passives' },
  { field: 'classTalents', table: 'config_class_talents', storeName: 'config_class_talents' },
  { field: 'setDefinitions', table: 'config_set_definitions', storeName: 'config_set_definitions' },
];

// TABLES_TO_BACKUP 在 backup.ts 与 importer.ts 间共享：通过下方 export 暴露给 importer 使用。
export { TABLES_TO_BACKUP };
export type { ArrayBackupField };

/**
 * 计算数据的校验和（SHA-256）
 *
 * 用于验证备份文件的完整性。采用 Web Crypto API 的 SHA-256 算法，
 * 替代原基于 `(hash << 5) - hash` 的 32 位 DJB2 变种哈希。
 *
 * P3-113 迁移原因：
 * - 原算法为 32 位非加密哈希，碰撞概率较高（约 2^-32），备份文件若发生
 *   局部比特翻转且恰好使哈希值不变，校验会误判为"未损坏"。
 * - SHA-256 输出 256 位摘要，碰撞概率可忽略（约 2^-128），且为业界标准。
 *
 * 异步化原因：
 * - Web Crypto API 的 `crypto.subtle.digest` 为异步接口。
 * - 调用方（`BackupService.createBackup` / `ImportService.validateBackup`）
 *   均为 async 函数，await 即可；不影响外部 API 形状。
 *
 * 兼容性：
 * - 浏览器：所有现代浏览器（Chrome 60+/Firefox 75+/Safari 11+）原生支持。
 * - 测试环境（Node）：Node 16+ 通过 `globalThis.crypto.subtle` 暴露 Web Crypto API。
 *
 * @param data - 要计算校验和的数据
 * @returns 64 字符的 SHA-256 十六进制字符串
 */
export async function calculateChecksum(data: unknown): Promise<string> {
  const str = JSON.stringify(data);
  // TextEncoder 将字符串编码为 Uint8Array（UTF-8），digest 接受 BufferSource
  const buffer = new TextEncoder().encode(str);
  const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
  // 将 ArrayBuffer 转换为十六进制字符串
  const bytes = new Uint8Array(digestBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * 备份服务类
 *
 * 提供游戏数据的备份功能，包括：
 * - 创建备份
 * - 导出备份文件
 *
 * 版本基线重构后移除了基于 localStorage 的自动备份管理（getAutoBackups /
 * deleteBackup / clearAutoBackups / createAutoBackup），仅保留手动导出/导入。
 */
export class BackupService implements IBackupService {
  /** 备份版本号 */
  private readonly BACKUP_VERSION = BACKUP_CONFIG.backupVersion;

  /**
   * 创建备份
   *
   * 收集所有游戏数据并生成备份对象
   * @returns BackupFile - 备份文件对象
   */
  async createBackup(): Promise<BackupFile> {
    const timestamp = Date.now();
    const data = await this.collectAllData();
    // P3-113：calculateChecksum 改为异步（SHA-256 via Web Crypto API），需 await
    const checksum = await calculateChecksum(data);

    return {
      version: this.BACKUP_VERSION,
      timestamp,
      checksum,
      // 从 APP_VERSION 注入，避免硬编码字符串与 package.json 脱节
      gameVersion: APP_VERSION,
      data
    };
  }

  /**
   * 导出备份文件
   *
   * 将备份数据导出为 JSON 文件供用户下载
   */
  async exportBackup(): Promise<void> {
    const backup = await this.createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(blob, `wow_dnd_backup_${dateStr}.json`);
  }

  /**
   * 收集所有游戏数据
   *
   * 从数据库中读取所有需要备份的数据表，包括运行时数据和完整配置表。
   *
   * 性能与实现说明：
   * - PERF-2：所有互不依赖的表通过 Promise.all 并行读取，避免串行阻塞主线程。
   * - CODE-38：配置表清单与 TABLES_TO_BACKUP 保持一致，importData 写入时
   *   通过该配置驱动遍历，避免读取/写入两侧表名散落。
   * - CODE-5：配置表的 Table 类型断言收敛在 getTable<T> 内部，调用方无需
   *   `as unknown as XXX` 双重断言。
   *
   * 可见性说明：原为 private，版本号基线重构后改为 public，
   * 供 MigrationService.runStartupMigration 复用（收集全量数据做迁移）。
   *
   * @returns BackupData - 备份数据对象
   */
  async collectAllData(): Promise<BackupData> {
    // PERF-2：互不依赖的表用 Promise.all 并行读取，避免串行阻塞主线程
    const [
      characterRecords, inventoryRecords, questsRecords, equipmentRecords,
      skillsRecords, explorationRecords, combatRecords, adventureLogRecords,
      gameStateRecords, mapStateRecords, shopItemsRecords,
      mapRecords, shopRecords, factionsRecords, racesRecords, classesRecords,
      itemsRecords, equipmentItemsRecords, mobsRecords, bossesRecords, skillTemplatesRecords,
      // P6-200 修复：补齐遗漏的配置表读取
      questDefinitionsRecords, classEquipmentRecords, classPassivesRecords,
      classTalentsRecords, setDefinitionsRecords
    ] = await Promise.all([
      // 角色表（Record 形状，以 characterId 为键）
      db.char_data.toArray(),
      db.char_inventory.toArray(),
      db.char_quests.toArray(),
      db.char_equipment.toArray(),
      db.char_skills.toArray(),
      db.char_exploration.toArray(),
      // 运行时表
      db.runtime_combatLogs.toArray(),
      db.runtime_adventureLogs.toArray(),
      db.runtime_gameState.toArray(),
      db.runtime_mapState.toArray(),
      db.runtime_shopItems.toArray(),
      // 配置表（数组形状）：通过 getTable<具体类型> 收敛 Table 类型断言（CODE-5）
      // 表清单与 TABLES_TO_BACKUP 配置保持一致
      getTable<LocationData>(db, 'config_locations').toArray(),
      getTable<ShopConfig>(db, 'config_shops').toArray(),
      getTable<FactionStorage>(db, 'config_factions').toArray(),
      getTable<RaceStorage>(db, 'config_races').toArray(),
      getTable<ClassStorage>(db, 'config_classes').toArray(),
      getTable<ItemStorage>(db, 'config_items').toArray(),
      getTable<EquipmentTemplateStorage>(db, 'config_equipment_items').toArray(),
      getTable<EnemyStorage>(db, 'config_mobs').toArray(),
      getTable<BossStorage>(db, 'config_bosses').toArray(),
      getTable<SkillTemplateStorage>(db, 'config_skills').toArray(),
      // P6-200 修复：补齐遗漏的配置表
      getTable<QuestDefinitionStorage>(db, 'config_quests').toArray(),
      getTable<EquipmentItem>(db, 'config_class_equipment').toArray(),
      getTable<PassiveSkill>(db, 'config_class_passives').toArray(),
      getTable<TalentTree>(db, 'config_class_talents').toArray(),
      getTable<ItemSet>(db, 'config_set_definitions').toArray(),
    ]);

    // 构建角色数据 Record（以 characterId 为键）
    const characters = this.toCharacterRecord(characterRecords);
    const inventory = this.toCharacterRecord(inventoryRecords);
    const quests = this.toCharacterRecord(questsRecords);
    const equipment = this.toCharacterRecord(equipmentRecords);
    const skills = this.toCharacterRecord(skillsRecords);
    const exploration = this.toCharacterRecord(explorationRecords);

    // combat 使用特殊键名（battleLogId 优先，缺失时降级为 combatId+timestamp 组合）
    const combat: Record<string, CombatLogStorage> = {};
    combatRecords.forEach((item) => {
      const key = item.battleLogId || `${item.combatId}_${item.timestamp}`;
      combat[key] = item;
    });

    // adventureLog 按 characterId 分组
    const adventureLog: Record<string, LogEntry[]> = {};
    adventureLogRecords.forEach((item) => {
      adventureLog[item.characterId] = item.entries || [];
    });

    // id-keyed Record
    const gameState: Record<string, GameStateStorage> = {};
    gameStateRecords.forEach((item) => { gameState[item.id] = item; });

    const mapState: Record<string, MapStateStorage> = {};
    mapStateRecords.forEach((item) => { mapState[item.id] = item; });

    const shopItems: Record<string, ShopItemsStorage> = {};
    shopItemsRecords.forEach((item) => { shopItems[item.shopId] = item; });

    return {
      characters,
      inventory,
      quests,
      equipment,
      skills,
      exploration,
      combat,
      adventureLog,
      map: mapRecords,
      shop: shopRecords,
      gameState,
      shopItems,
      mapState,
      factions: factionsRecords,
      races: racesRecords,
      classes: classesRecords,
      items: itemsRecords,
      equipmentItems: equipmentItemsRecords,
      mobs: mobsRecords,
      bosses: bossesRecords,
      skillTemplates: skillTemplatesRecords,
      // P6-200 修复：补齐遗漏的配置表数据
      questDefinitions: questDefinitionsRecords,
      classEquipment: classEquipmentRecords,
      classPassives: classPassivesRecords,
      classTalents: classTalentsRecords,
      setDefinitions: setDefinitionsRecords,
    };
  }

  /**
   * 将数组转换为以 characterId 为键的 Record
   */
  private toCharacterRecord<T extends { characterId: string }>(items: T[]): Record<string, T> {
    const record: Record<string, T> = {};
    for (const item of items) {
      record[item.characterId] = item;
    }
    return record;
  }
}

/** Table 类型导出，便于 importer.ts 复用辅助函数 */
export type { Table };
