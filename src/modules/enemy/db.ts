/**
 * 普通怪物数据层
 * 
 * 封装普通怪物模板数据的 IndexedDB 操作，提供数据持久化能力
 * （Boss 数据已拆分至 ../boss/db.ts）
 */
import { db as gameDb, dbService } from '../data/core';
import type { EnemyStorage, EnemyData } from './types';

/**
 * 普通怪物数据层服务
 */
export class EnemyDbService {
  /**
   * 保存怪物模板到数据库
   * @param enemy - 怪物数据
   */
  async saveEnemyTemplate(enemy: EnemyData): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_mobs.put({
        id: enemy.id,
        name: enemy.name,
        icon: enemy.icon,
        maxHp: enemy.maxHp,
        damage: enemy.damage,
        xp: enemy.xp,
        gold: enemy.gold,
        dangerLevel: enemy.dangerLevel,
        physicalAttack: enemy.physicalAttack ?? null,
        physicalDefense: enemy.physicalDefense ?? null,
        magicAttack: enemy.magicAttack ?? null,
        magicDefense: enemy.magicDefense ?? null,
        critChance: enemy.critChance ?? null,
        dodgeChance: enemy.dodgeChance ?? null
      });
    });
  }

  /**
   * 获取怪物模板
   * @param enemyId - 怪物 ID
   * @returns 怪物数据或 null
   */
  async getEnemyTemplate(enemyId: string): Promise<EnemyData | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_mobs.get(enemyId);
      if (!data) return null;

      return this.fromStorage(data);
    });
  }

  /**
   * 获取所有怪物模板
   * @returns 怪物模板列表
   */
  async getAllEnemyTemplates(): Promise<EnemyData[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_mobs.toArray();
      return items.map(item => this.fromStorage(item));
    });
  }

  /**
   * 删除怪物模板
   * @param enemyId - 怪物 ID
   */
  async deleteEnemyTemplate(enemyId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_mobs.delete(enemyId);
    });
  }

  /**
   * 将数据库存储格式转换为 EnemyData
   */
  private fromStorage(data: EnemyStorage): EnemyData {
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
      dangerLevel: data.dangerLevel || '普通',
      physicalAttack: data.physicalAttack != null ? Number(data.physicalAttack) : undefined,
      physicalDefense: data.physicalDefense != null ? Number(data.physicalDefense) : undefined,
      magicAttack: data.magicAttack != null ? Number(data.magicAttack) : undefined,
      magicDefense: data.magicDefense != null ? Number(data.magicDefense) : undefined,
      critChance: data.critChance != null ? Number(data.critChance) : undefined,
      dodgeChance: data.dodgeChance != null ? Number(data.dodgeChance) : undefined
    };
  }
}

/**
 * 普通怪物数据层实例
 */
export const enemyDbService = new EnemyDbService();
