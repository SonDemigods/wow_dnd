/**
 * Boss 模块数据层
 *
 * 封装 Boss 模板数据的 IndexedDB 操作，提供数据持久化能力。
 * Boss 使用独立的 config_bosses 表（区别于普通敌人的 config_mobs），
 * 额外存储 phases（阶段配置）和 intro（出场演出）字段。
 * 所有数据以原生对象/数组存储，无需 JSON 序列化/反序列化。
 *
 * @see fromStorageBase 与 enemy/db.ts 共享的存储 → 运行时转换逻辑
 */
import { db as gameDb, dbService } from '@/modules/data/core';
import { fromStorageBase } from '@/modules/enemy/db';
import type { BossStorage, BossTemplate } from './types';

/**
 * Boss 数据层服务
 *
 * 提供 Boss 模板的 CRUD 操作，所有写操作通过 dbService.withRetry 包裹以处理
 * IndexedDB 事务冲突。读取时通过 fromStorage → fromStorageBase 链路将存储格式
 * 转换为运行时 BossTemplate。
 */
export class BossDbService {
  /**
   * 保存 Boss 模板到数据库（原生存储，不做 JSON 序列化）
   *
   * 字段转换规则：
   * - 可选数值字段（physicalAttack 等）：undefined → null（适配 IndexedDB 索引要求）
   * - skillPool / aiStrategy / phases / intro：使用 || undefined 将 falsy 值统一为 undefined
   * - isBoss：硬编码为 1（Boss 表专用，BossTemplate.isBoss 固定为 true）
   *
   * @param boss - Boss 模板数据
   */
  async saveBossTemplate(boss: BossTemplate): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_bosses.put({
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
        attackType: boss.attackType || undefined,
        phases: boss.phases || undefined,
        intro: boss.intro || undefined
      });
    });
  }

  /**
   * 获取 Boss 模板
   * @param bossId - Boss ID
   * @returns Boss 模板数据，不存在时返回 null
   */
  async getBossTemplate(bossId: string): Promise<BossTemplate | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_bosses.get(bossId);
      if (!data) return null;

      return this.fromStorage(data);
    });
  }

  /**
   * 获取所有 Boss 模板
   * @returns Boss 模板列表（空表时返回 []）
   */
  async getAllBossTemplates(): Promise<BossTemplate[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_bosses.toArray();
      return items.map(item => this.fromStorage(item));
    });
  }

  /**
   * 删除 Boss 模板
   * @param bossId - Boss ID
   */
  async deleteBossTemplate(bossId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_bosses.delete(bossId);
    });
  }

  /**
   * 将数据库存储格式转换为 BossTemplate
   *
   * 转换分两步：
   * 1. 调用 fromStorageBase（enemy/db.ts）处理 11 个共有字段（id/name/icon/maxHp/damage/xp/gold/
   *    dangerLevel/6 个可选属性/skillPool/aiStrategy），完成 null → undefined 还原和数值校验
   * 2. 叠加 Boss 独有字段：isBoss 硬编码为 true、追加 phases 和 intro、
   *    skillPool/aiStrategy 二次处理（空数组/空字符串统一为 undefined）
   *
   * @param data - 数据库存储格式的 Boss 数据
   * @returns 转换后的 BossTemplate
   */
  private fromStorage(data: BossStorage): BossTemplate {
    const base = fromStorageBase(data);
    return {
      ...base,
      isBoss: true,
      // 二次清理：fromStorageBase 可能返回空数组/空字符串，
      // 对 Boss 来说这些等同于未配置，统一转为 undefined
      skillPool: base.skillPool || undefined,
      aiStrategy: base.aiStrategy || undefined,
      phases: data.phases || undefined,
      intro: data.intro || undefined,
    };
  }
}

/**
 * Boss 数据层单例实例
 */
export const bossDbService = new BossDbService();
