/**
 * @fileoverview 统一配置缓存层
 * @description
 *   缓存从 IndexedDB 加载的配置数据（天赋树/被动技能/套装定义），
 *   提供 DB-backed + 内存缓存的同步查询接口。
 *
 *   解决「配置数据双源歧义」问题：原 17 个文件直接 import @/data 静态常量，
 *   绕过 DB 层导致 Admin 后台编辑后运行时仍读取旧数据。
 *   本缓存统一从 DB 加载，消除静态 import 依赖。
 *
 *   采用懒加载 + Promise 去重策略（与 UnifiedItemTemplateCache 一致），
 *   避免并发重复 DB 查询。
 *
 *   不包含：
 *   - config_mounts（A 层编译期固定配置，程序化生成，不进 DB）
 *   - config_area_events（含函数模板，不可序列化到 DB）
 *
 * @module config
 */
import { db } from '@/modules/data';
import type { TalentTree } from '@/modules/character/talents/types';
import type { PassiveSkill } from '@/modules/character/types';
import type { ItemSet } from '@/modules/equipment/setTypes';

/**
 * 统一配置缓存服务
 *
 * 内部维护三类配置数据的内存索引，对外提供同步 get 方法 + 异步 load 方法。
 *
 * 生命周期：
 * 1. GameBootstrap.initialize 之前可由各 Store initialize 调用 ensureLoaded
 * 2. Admin 后台编辑配置后调用 invalidate 触发重新加载
 * 3. 缓存未加载时 get 方法返回空数组兜底（不阻塞 UI）
 */
class ConfigCacheService {
  // ==================== 天赋树 ====================

  /** 全量天赋树列表（null 表示未加载） */
  private _talentTrees: TalentTree[] | null = null;

  /** classId → TalentTree[] 索引 */
  private _talentTreesByClass: Map<string, TalentTree[]> = new Map();

  /** talentId → { talent, tree } 索引 */
  private _talentById: Map<string, { talent: TalentTree['talents'][number]; tree: TalentTree }> = new Map();

  /** 天赋树加载中 Promise（防止并发重复加载） */
  private _talentLoadingPromise: Promise<TalentTree[]> | null = null;

  // ==================== 被动技能 ====================

  /** 全量被动技能列表（null 表示未加载） */
  private _passives: PassiveSkill[] | null = null;

  /** classId → PassiveSkill[] 索引 */
  private _passivesByClass: Map<string, PassiveSkill[]> = new Map();

  /** 被动技能加载中 Promise */
  private _passiveLoadingPromise: Promise<PassiveSkill[]> | null = null;

  // ==================== 套装定义 ====================

  /** 全量套装定义列表（null 表示未加载） */
  private _setDefinitions: ItemSet[] | null = null;

  /** 套装定义加载中 Promise */
  private _setLoadingPromise: Promise<ItemSet[]> | null = null;

  // ==================== 天赋树方法 ====================

  /**
   * 从 DB 加载天赋树数据并构建索引
   *
   * 采用 Promise 去重策略，并发调用时复用同一个 loadingPromise。
   */
  async loadTalentTrees(): Promise<TalentTree[]> {
    if (this._talentTrees) return this._talentTrees;
    if (this._talentLoadingPromise) return this._talentLoadingPromise;

    this._talentLoadingPromise = this._doLoadTalentTrees();
    return this._talentLoadingPromise;
  }

  private async _doLoadTalentTrees(): Promise<TalentTree[]> {
    try {
      const trees = await db.config_class_talents.toArray();
      this._talentTrees = trees;
      this._talentTreesByClass.clear();
      this._talentById.clear();
      for (const tree of trees) {
        // 按 classId 分组
        const existing = this._talentTreesByClass.get(tree.classId) ?? [];
        existing.push(tree);
        this._talentTreesByClass.set(tree.classId, existing);
        // 按 talentId 索引
        for (const talent of tree.talents) {
          this._talentById.set(talent.id, { talent, tree });
        }
      }
      return trees;
    } finally {
      this._talentLoadingPromise = null;
    }
  }

  /**
   * 同步获取指定职业的天赋树列表
   *
   * 缓存未加载时返回空数组兜底。调用方应在 Store initialize 中先 await loadTalentTrees()。
   */
  getTalentTreesByClassId(classId: string): TalentTree[] {
    return this._talentTreesByClass.get(classId) ?? [];
  }

  /**
   * 同步获取指定天赋 ID 的天赋定义及其所属树
   */
  getTalentById(talentId: string): { talent: TalentTree['talents'][number]; tree: TalentTree } | undefined {
    return this._talentById.get(talentId);
  }

  // ==================== 被动技能方法 ====================

  /**
   * 从 DB 加载被动技能数据并构建索引
   */
  async loadPassives(): Promise<PassiveSkill[]> {
    if (this._passives) return this._passives;
    if (this._passiveLoadingPromise) return this._passiveLoadingPromise;

    this._passiveLoadingPromise = this._doLoadPassives();
    return this._passiveLoadingPromise;
  }

  private async _doLoadPassives(): Promise<PassiveSkill[]> {
    try {
      const passives = await db.config_class_passives.toArray();
      this._passives = passives;
      this._passivesByClass.clear();
      for (const p of passives) {
        const existing = this._passivesByClass.get(p.classId) ?? [];
        existing.push(p);
        this._passivesByClass.set(p.classId, existing);
      }
      return passives;
    } finally {
      this._passiveLoadingPromise = null;
    }
  }

  /**
   * 同步获取指定职业的被动技能列表
   */
  getPassivesByClassId(classId: string): PassiveSkill[] {
    return this._passivesByClass.get(classId) ?? [];
  }

  // ==================== 套装定义方法 ====================

  /**
   * 从 DB 加载套装定义数据
   */
  async loadSetDefinitions(): Promise<ItemSet[]> {
    if (this._setDefinitions) return this._setDefinitions;
    if (this._setLoadingPromise) return this._setLoadingPromise;

    this._setLoadingPromise = this._doLoadSetDefinitions();
    return this._setLoadingPromise;
  }

  private async _doLoadSetDefinitions(): Promise<ItemSet[]> {
    try {
      const sets = await db.config_set_definitions.toArray();
      this._setDefinitions = sets;
      return sets;
    } finally {
      this._setLoadingPromise = null;
    }
  }

  /**
   * 同步获取全量套装定义
   */
  getSetDefinitions(): ItemSet[] {
    return this._setDefinitions ?? [];
  }

  // ==================== 通用方法 ====================

  /**
   * 并行加载所有配置数据
   *
   * 供 GameBootstrap 在 Store initialize 之前调用，确保缓存就绪。
   */
  async loadAll(): Promise<void> {
    await Promise.all([
      this.loadTalentTrees(),
      this.loadPassives(),
      this.loadSetDefinitions(),
    ]);
  }

  /**
   * 使指定类型的缓存失效
   *
   * Admin 后台编辑配置后调用，下次查询将重新从 DB 加载。
   */
  invalidate(type?: 'talents' | 'passives' | 'sets'): void {
    if (!type || type === 'talents') {
      this._talentTrees = null;
      this._talentTreesByClass.clear();
      this._talentById.clear();
    }
    if (!type || type === 'passives') {
      this._passives = null;
      this._passivesByClass.clear();
    }
    if (!type || type === 'sets') {
      this._setDefinitions = null;
    }
  }
}

/** 统一配置缓存单例 */
export const configCache = new ConfigCacheService();
