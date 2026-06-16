/**
 * Boss 模块数据层
 * 
 * 封装 Boss 模板数据的 IndexedDB 操作，提供数据持久化能力。
 * 所有数据以原生对象/数组存储，无需 JSON 序列化/反序列化。
 */
import { db as gameDb, dbService } from '../data/core';
import type { BossStorage, BossTemplate } from './types';
import type { AiStrategyType, DangerLevel } from '../enemy/types';

/**
 * Boss 数据层服务
 */
export class BossDbService {
  /**
   * 保存 Boss 模板到数据库（原生存储，不做 JSON 序列化）
   * @param boss - Boss 数据
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
        isBoss: boss.isBoss ? 1 : 0,
        physicalAttack: boss.physicalAttack ?? null,
        physicalDefense: boss.physicalDefense ?? null,
        magicAttack: boss.magicAttack ?? null,
        magicDefense: boss.magicDefense ?? null,
        critChance: boss.critChance ?? null,
        dodgeChance: boss.dodgeChance ?? null,
        skillPool: boss.skillPool || undefined,
        aiStrategy: boss.aiStrategy || undefined,
        phases: boss.phases || undefined,
        intro: boss.intro || undefined,
        dialogues: boss.dialogues || undefined
      });
    });
  }

  /**
   * 获取 Boss 模板
   * @param bossId - Boss ID
   * @returns Boss 数据或 null
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
   * @returns Boss 模板列表
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
   * 将数据库存储格式转换为 BossTemplate（原生读取，不做 JSON 反序列化）
   */
  private fromStorage(data: BossStorage): BossTemplate {
    const rawDamage = data.damage;
    const damage: [number, number] = (Array.isArray(rawDamage) && rawDamage.length >= 2)
      ? [Number(rawDamage[0]), Number(rawDamage[1])]
      : [1, 3];

    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      maxHp: Number(data.maxHp) || 10,
      damage,
      xp: Number(data.xp) || 0,
      gold: Number(data.gold) || 0,
      dangerLevel: (data.dangerLevel as DangerLevel) || '普通',
      isBoss: true,
      physicalAttack: data.physicalAttack != null ? Number(data.physicalAttack) : undefined,
      physicalDefense: data.physicalDefense != null ? Number(data.physicalDefense) : undefined,
      magicAttack: data.magicAttack != null ? Number(data.magicAttack) : undefined,
      magicDefense: data.magicDefense != null ? Number(data.magicDefense) : undefined,
      critChance: data.critChance != null ? Number(data.critChance) : undefined,
      dodgeChance: data.dodgeChance != null ? Number(data.dodgeChance) : undefined,
      skillPool: data.skillPool || undefined,
      aiStrategy: (data.aiStrategy as AiStrategyType) || undefined,
      phases: data.phases || undefined,
      intro: data.intro || undefined,
      dialogues: data.dialogues || undefined
    };
  }
}

/**
 * Boss 数据层实例
 */
export const bossDbService = new BossDbService();
