/**
 * 敌人模块数据层
 * 
 * 封装敌人数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { Enemy, EnemyListItem, EnemyRarity, EnemyType } from './types';

/**
 * 敌人数据存储接口
 */
export interface EnemyDataStorage {
  id: string;
  name: string;
  type: EnemyType;
  rarity: EnemyRarity;
  level: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  maxHp: number;
  maxMp: number;
  attackPower: number;
  defense: number;
  expReward: number;
  goldReward: number;
  isBoss: boolean;
  description: string;
  skills: string;
  drops: string;
  createdAt: number;
}

/**
 * 敌人数据层服务
 */
export class EnemyDbService {
  /**
   * 保存敌人数据到数据库
   * @param enemy - 敌人数据
   */
  async saveEnemy(enemy: Enemy): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.enemies.put({
        id: enemy.id,
        name: enemy.name,
        type: enemy.type,
        rarity: enemy.rarity,
        level: enemy.level,
        str: enemy.stats.str,
        dex: enemy.stats.dex,
        con: enemy.stats.con,
        int: enemy.stats.int,
        wis: enemy.stats.wis,
        cha: enemy.stats.cha,
        maxHp: enemy.maxHp,
        maxMp: enemy.maxMp,
        attackPower: enemy.attackPower,
        defense: enemy.defense,
        expReward: enemy.expReward,
        goldReward: enemy.goldReward,
        isBoss: enemy.isBoss,
        description: enemy.description,
        skills: JSON.stringify(enemy.skills),
        drops: JSON.stringify(enemy.drops),
        createdAt: Date.now()
      });
    });
  }

  /**
   * 获取所有敌人
   * @returns 敌人数组
   */
  async getAllEnemies(): Promise<Enemy[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.enemies.toArray();
      return items.map(item => this.fromStorageFormat(item));
    });
  }

  /**
   * 根据ID获取敌人
   * @param enemyId - 敌人ID
   * @returns 敌人数据或null
   */
  async getEnemyById(enemyId: string): Promise<Enemy | null> {
    return dbService.withRetry(async () => {
      const item = await gameDb.enemies.get(enemyId);
      if (!item) return null;
      return this.fromStorageFormat(item);
    });
  }

  /**
   * 删除敌人
   * @param enemyId - 敌人ID
   */
  async deleteEnemy(enemyId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.enemies.delete(enemyId);
    });
  }

  /**
   * 获取敌人列表项
   * @returns 敌人列表项数组
   */
  async getEnemyListItems(): Promise<EnemyListItem[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.enemies.toArray();
      return items.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        level: item.level,
        maxHp: item.maxHp,
        expReward: item.expReward,
        goldReward: item.goldReward
      }));
    });
  }

  /**
   * 将存储格式转换为敌人对象
   * @param storage - 存储格式数据
   * @returns 敌人对象
   */
  private fromStorageFormat(storage: EnemyDataStorage): Enemy {
    try {
      const skills = JSON.parse(storage.skills);
      const drops = JSON.parse(storage.drops);
      
      return {
        id: storage.id,
        name: storage.name,
        type: storage.type,
        rarity: storage.rarity,
        level: storage.level,
        stats: {
          str: storage.str,
          dex: storage.dex,
          con: storage.con,
          int: storage.int,
          wis: storage.wis,
          cha: storage.cha
        },
        hp: storage.maxHp,
        maxHp: storage.maxHp,
        mp: storage.maxMp,
        maxMp: storage.maxMp,
        attackPower: storage.attackPower,
        defense: storage.defense,
        expReward: storage.expReward,
        goldReward: storage.goldReward,
        skills: skills || [],
        drops: drops || [],
        isBoss: storage.isBoss,
        description: storage.description
      };
    } catch {
      return {
        id: storage.id,
        name: storage.name,
        type: storage.type,
        rarity: storage.rarity,
        level: storage.level,
        stats: {
          str: storage.str,
          dex: storage.dex,
          con: storage.con,
          int: storage.int,
          wis: storage.wis,
          cha: storage.cha
        },
        hp: storage.maxHp,
        maxHp: storage.maxHp,
        mp: storage.maxMp,
        maxMp: storage.maxMp,
        attackPower: storage.attackPower,
        defense: storage.defense,
        expReward: storage.expReward,
        goldReward: storage.goldReward,
        skills: [],
        drops: [],
        isBoss: storage.isBoss,
        description: storage.description
      };
    }
  }
}

/**
 * 敌人数据层实例
 */
export const enemyDbService = new EnemyDbService();