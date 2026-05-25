/**
 * 敌人模块状态管理
 * 
 * 使用 Pinia 管理敌人状态，响应式更新UI
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Enemy, EnemyRarity } from './types';
import { enemyService } from './service';
import { ENEMY_RARITY_CONFIG } from './types';

/**
 * 敌人状态存储
 */
export const useEnemyStore = defineStore('enemy', () => {
  // 状态
  const enemies = ref<Enemy[]>([]);
  const currentEnemyId = ref<string | null>(null);
  const isLoading = ref(false);

  // 计算属性
  const currentEnemy = computed(() => {
    if (!currentEnemyId.value) return null;
    return enemies.value.find(e => e.id === currentEnemyId.value) || null;
  });

  const enemyList = computed(() => {
    return enemies.value.map(enemy => ({
      id: enemy.id,
      name: enemy.name,
      type: enemy.type,
      rarity: enemy.rarity,
      level: enemy.level,
      maxHp: enemy.maxHp,
      expReward: enemy.expReward,
      goldReward: enemy.goldReward,
      rarityColor: ENEMY_RARITY_CONFIG[enemy.rarity].color,
      rarityName: ENEMY_RARITY_CONFIG[enemy.rarity].name
    }));
  });

  const aliveEnemies = computed(() => {
    return enemies.value.filter(e => e.hp > 0);
  });

  const defeatedCount = computed(() => {
    return enemies.value.filter(e => e.hp <= 0).length;
  });

  // 方法
  async function loadEnemies(): Promise<void> {
    isLoading.value = true;
    await enemyService.loadEnemiesFromDb();
    enemies.value = enemyService.getAllEnemies();
    isLoading.value = false;
  }

  function generateEnemy(level: number, rarity?: EnemyRarity, isBoss?: boolean): Enemy {
    const enemy = enemyService.generateEnemy(level, rarity, isBoss);
    enemies.value.push(enemy);
    return enemy;
  }

  function selectEnemy(enemyId: string): void {
    currentEnemyId.value = enemyId;
  }

  function takeDamage(enemyId: string, damage: number): boolean {
    const enemy = enemies.value.find(e => e.id === enemyId);
    if (!enemy) return false;
    
    const isDead = enemyService.takeDamage(enemyId, damage);
    
    // 更新本地状态
    const index = enemies.value.findIndex(e => e.id === enemyId);
    if (index !== -1) {
      if (isDead) {
        enemies.value.splice(index, 1);
        if (currentEnemyId.value === enemyId) {
          currentEnemyId.value = null;
        }
      } else {
        enemies.value[index] = { ...enemyService.getEnemyById(enemyId)! };
      }
    }
    
    return isDead;
  }

  function useSkill(enemyId: string, skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    const result = enemyService.useSkill(enemyId, skillId);
    
    // 更新本地状态
    const index = enemies.value.findIndex(e => e.id === enemyId);
    if (index !== -1 && result.success) {
      enemies.value[index] = { ...enemyService.getEnemyById(enemyId)! };
    }
    
    return result;
  }

  function resetEnemy(enemyId: string): void {
    enemyService.resetEnemy(enemyId);
    const index = enemies.value.findIndex(e => e.id === enemyId);
    if (index !== -1) {
      enemies.value[index] = { ...enemyService.getEnemyById(enemyId)! };
    }
  }

  function clearAllEnemies(): void {
    enemyService.clearAllEnemies();
    enemies.value = [];
    currentEnemyId.value = null;
  }

  function removeEnemy(enemyId: string): boolean {
    const success = enemyService.deleteEnemy(enemyId);
    if (success) {
      const index = enemies.value.findIndex(e => e.id === enemyId);
      if (index !== -1) {
        enemies.value.splice(index, 1);
      }
      if (currentEnemyId.value === enemyId) {
        currentEnemyId.value = null;
      }
    }
    return success;
  }

  return {
    // 状态
    enemies,
    currentEnemyId,
    isLoading,
    
    // 计算属性
    currentEnemy,
    enemyList,
    aliveEnemies,
    defeatedCount,
    
    // 方法
    loadEnemies,
    generateEnemy,
    selectEnemy,
    takeDamage,
    useSkill,
    resetEnemy,
    clearAllEnemies,
    removeEnemy
  };
});