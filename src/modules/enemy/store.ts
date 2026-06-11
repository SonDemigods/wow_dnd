/**
 * 敌人模块状态管理（Store 核心架构）
 *
 * Store 是敌人数据的唯一持有者，Action 负责编排：
 *   调纯函数 → 更新 Store 状态 →（敌人仅内存，不调 DB）
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Enemy } from './types';
import { createEnemyInstance, calculateEnemyDamage } from './service';
import { enemyDbService } from './db';

/**
 * 敌人状态存储
 */
export const useEnemiesStore = defineStore('enemies', () => {
  // ==================== 状态 ====================
  /** 当前活跃敌人 ID 列表 */
  const activeEnemyIds = ref<string[]>([]);

  /** 敌人实例缓存（key 为敌人 ID） */
  const enemiesCache = ref<Record<string, Enemy>>({});

  // ==================== 计算属性 ====================
  /** 所有活跃敌人 */
  const enemies = computed(() => Object.values(enemiesCache.value));

  /** 活跃敌人数量 */
  const enemiesCount = computed(() => activeEnemyIds.value.length);

  // ==================== 动作 ====================

  /**
   * 创建敌人实例
   * @param dataId - 敌人数据 ID
   * @param level - 敌人等级，默认 1
   * @returns 创建的敌人实例
   */
  async function createEnemy(dataId: string, level: number = 1): Promise<Enemy | null> {
    try {
      const template = await enemyDbService.getEnemyTemplate(dataId);
      if (!template) {
        throw new Error(`Enemy data not found: ${dataId}`);
      }
      const enemy = createEnemyInstance(template, level);
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
   * @returns 敌人是否死亡（hp <= 0）
   */
  function takeDamage(id: string, damage: number): boolean {
    const enemy = enemiesCache.value[id];
    if (!enemy) return false;

    enemy.hp = Math.max(0, enemy.hp - damage);
    enemiesCache.value[id] = { ...enemy };
    return enemy.hp <= 0;
  }

  /**
   * 根据 ID 获取敌人
   */
  function getEnemyById(id: string): Enemy | null {
    return enemiesCache.value[id] || null;
  }

  /**
   * 获取敌人可用技能列表
   */
  function getAvailableSkills(_id: string): { id: string; name: string }[] {
    // 基于敌人类型返回技能，暂返回空数组
    return [];
  }

  /**
   * 敌人使用技能
   * @returns 技能使用结果
   */
  function useSkill(id: string, _skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    const enemy = enemiesCache.value[id];
    if (!enemy) {
      return { success: false, damage: 0, isHeal: false };
    }
    return { success: true, damage: 0, isHeal: false };
  }

  /**
   * 计算敌人对玩家造成的伤害（委托纯函数）
   * @param enemy - 敌人实例
   * @param defense - 玩家防御值
   * @returns 计算后的伤害值
   */
  function calculateDamage(enemy: Enemy, defense: number): number {
    return calculateEnemyDamage(enemy, defense);
  }

  /**
   * 删除敌人实例
   */
  function deleteEnemy(id: string): void {
    activeEnemyIds.value = activeEnemyIds.value.filter(eid => eid !== id);
    delete enemiesCache.value[id];
  }

  /** 清除所有敌人 */
  function clearAll(): void {
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

    // 动作
    createEnemy,
    takeDamage,
    getEnemyById,
    getAvailableSkills,
    useSkill,
    calculateDamage,
    deleteEnemy,
    clearAll
  };
});
