/**
 * 敌人模块状态管理
 * 
 * 使用 Pinia 管理敌人状态，响应式更新UI。
 * Store 是敌人数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Enemy } from './types';
import { enemyService } from './service';

/**
 * 敌人状态存储
 */
export const useEnemiesStore = defineStore('enemies', () => {
  /** 当前活跃敌人 ID 列表 */
  const activeEnemyIds = ref<string[]>([]);

  /** 敌人实例缓存（key 为敌人 ID） */
  const enemiesCache = ref<Record<string, Enemy>>({});

  /**
   * 从 Service 同步最新数据
   */
  function syncFromService(): void {
    // enemyService 使用 Map 管理状态，此处按需从 ID 列表刷新
    const cache: Record<string, Enemy> = {};
    for (const id of activeEnemyIds.value) {
      const enemy = enemyService.getEnemyById(id);
      if (enemy) {
        cache[id] = { ...enemy };
      }
    }
    enemiesCache.value = cache;
  }

  /** 所有活跃敌人 */
  const enemies = computed(() => Object.values(enemiesCache.value));

  /** 活跃敌人数量 */
  const enemiesCount = computed(() => activeEnemyIds.value.length);

  /**
   * 根据 ID 获取敌人
   * @param id - 敌人实例 ID
   * @returns 敌人实例，不存在时返回 null
   */
  function getEnemyById(id: string): Enemy | null {
    return enemyService.getEnemyById(id);
  }

  /**
   * 创建敌人实例
   * @param dataId - 敌人数据 ID
   * @param level - 敌人等级
   * @returns 创建的敌人实例，失败返回 null
   */
  async function createEnemy(dataId: string, level?: number): Promise<Enemy | null> {
    try {
      const enemy = await enemyService.createEnemy(dataId, level);
      activeEnemyIds.value.push(enemy.id);
      enemiesCache.value[enemy.id] = { ...enemy };
      return enemy;
    } catch (e) {
      console.error('[EnemiesStore] 创建敌人失败:', e);
      return null;
    }
  }

  /**
   * 对敌人造成伤害
   * @param id - 敌人实例 ID
   * @param damage - 伤害值
   * @returns 敌人是否死亡
   */
  function takeDamage(id: string, damage: number): boolean {
    const isDead = enemyService.takeDamage(id, damage);
    // 刷新缓存
    const enemy = enemyService.getEnemyById(id);
    if (enemy) {
      enemiesCache.value[id] = { ...enemy };
    }
    return isDead;
  }

  /**
   * 获取敌人可用技能
   * @param id - 敌人实例 ID
   * @returns 可用技能列表
   */
  function getAvailableSkills(id: string): { id: string; name: string }[] {
    return enemyService.getAvailableSkills(id);
  }

  /**
   * 敌人使用技能
   * @param id - 敌人实例 ID
   * @param skillId - 技能 ID
   * @returns 技能使用结果，包含是否成功、伤害值和是否为治疗
   */
  function useSkill(id: string, skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    return enemyService.useSkill(id, skillId);
  }

  /**
   * 计算敌人伤害
   * @param enemy - 敌人实例
   * @param defense - 玩家防御值
   * @returns 计算出的伤害值
   */
  function calculateDamage(enemy: Enemy, defense: number): number {
    return enemyService.calculateDamage(enemy, defense);
  }

  /**
   * 删除敌人实例
   * @param id - 敌人实例 ID
   */
  function deleteEnemy(id: string): void {
    enemyService.deleteEnemy(id);
    activeEnemyIds.value = activeEnemyIds.value.filter(eid => eid !== id);
    delete enemiesCache.value[id];
  }

  /** 清除所有敌人 */
  function clearAll(): void {
    for (const id of activeEnemyIds.value) {
      enemyService.deleteEnemy(id);
    }
    activeEnemyIds.value = [];
    enemiesCache.value = {};
  }

  return {
    // 状态
    activeEnemyIds,
    enemiesCache,

    // 计算属性
    enemies,
    enemiesCount,

    // 方法
    syncFromService,
    getEnemyById,
    createEnemy,
    takeDamage,
    getAvailableSkills,
    useSkill,
    calculateDamage,
    deleteEnemy,
    clearAll
  };
});
