/**
 * 普通怪物数据层
 * 
 * 封装普通怪物模板数据的 IndexedDB 操作，提供数据持久化能力
 * （Boss 数据已拆分至 ../boss/db.ts）
 */
import { db as gameDb, dbService } from '../data/core';
import type { EnemyStorage, EnemyData, AiStrategyType } from './types';

/**
 * 普通怪物数据层服务
 */
export class EnemyDbService {
  /**
   * 保存怪物模板到数据库
   *
   * 可选字段为 `undefined` 时写入 `null`，以适配 IndexedDB 的索引存储要求。
   *
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
        dodgeChance: enemy.dodgeChance ?? null,
        skillPool: enemy.skillPool ?? undefined,
        aiStrategy: enemy.aiStrategy ?? undefined
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
    return fromStorageBase(data);
  }
}

/** 存储格式中 enemy 与 boss 共有的字段 */
interface EnemyStorageBase {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: string;
  physicalAttack?: number | null;
  physicalDefense?: number | null;
  magicAttack?: number | null;
  magicDefense?: number | null;
  critChance?: number | null;
  dodgeChance?: number | null;
  skillPool?: string[];
  aiStrategy?: string;
}

/**
 * 将数据库存储格式转换为 EnemyData 的公共基础逻辑
 *
 * 转换规则：
 * - `null` 还原为 `undefined`（与 EnemyData 的可选字段语义一致）
 * - 数值字段通过 `Number()` 强制转换，转换失败时使用默认值
 * - `damage` 校验数组长度，不合法时回退为 `[1, 3]`
 * - `aiStrategy` 由 `string` 断言为 `AiStrategyType`（数据源受控）
 *
 * @param data - 数据库存储格式（enemy 或 boss 共有字段）
 * @returns 转换后的基础 EnemyData
 */
export function fromStorageBase(data: EnemyStorageBase): EnemyData {
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
    dangerLevel: data.dangerLevel as EnemyData['dangerLevel'] || '普通',
    physicalAttack: data.physicalAttack != null ? Number(data.physicalAttack) : undefined,
    physicalDefense: data.physicalDefense != null ? Number(data.physicalDefense) : undefined,
    magicAttack: data.magicAttack != null ? Number(data.magicAttack) : undefined,
    magicDefense: data.magicDefense != null ? Number(data.magicDefense) : undefined,
    critChance: data.critChance != null ? Number(data.critChance) : undefined,
    dodgeChance: data.dodgeChance != null ? Number(data.dodgeChance) : undefined,
    skillPool: data.skillPool,
    aiStrategy: data.aiStrategy as AiStrategyType | undefined,
  };
}

/**
 * 普通怪物数据层实例
 */
export const enemyDbService = new EnemyDbService();
