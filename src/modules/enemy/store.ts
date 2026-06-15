/**
 * 敌人模块状态管理（Store 核心架构）
 *
 * Store 是敌人数据的唯一持有者，Action 负责编排：
 *   调纯函数 → 更新 Store 状态 →（敌人仅内存，不调 DB）
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Enemy } from './types';
import type { Skill } from '../skill/types';
import { createEnemyInstance, calculateEnemyDamage } from './service';
import { enemyDbService } from './db';
import { bossDbService } from '../boss/db';
import { createBossInstance } from '../boss/service';
import { useSkillsStore } from '../skill/store';

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
      // 优先从普通怪物表查找
      let template = await enemyDbService.getEnemyTemplate(dataId);
      if (template) {
        const enemy = createEnemyInstance(template, level);
        activeEnemyIds.value.push(enemy.id);
        enemiesCache.value[enemy.id] = { ...enemy };
        return enemy;
      }

      // 回退到 Boss 表查找
      const bossTemplate = await bossDbService.getBossTemplate(dataId);
      if (bossTemplate) {
        const boss = createBossInstance(bossTemplate, level);
        activeEnemyIds.value.push(boss.id);
        enemiesCache.value[boss.id] = { ...boss };
        return boss;
      }

      throw new Error(`Enemy data not found: ${dataId}`);
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
   * 获取敌人可用技能列表（从 skillPool 读取技能ID，通过 skillsStore 获取真实技能数据）
   * @param id - 敌人实例 ID
   * @returns 可用技能列表
   */
  function getAvailableSkills(id: string): { id: string; name: string; isHeal?: boolean; damageMultiplier?: number }[] {
    const enemy = enemiesCache.value[id];
    if (!enemy || !enemy.skillPool || enemy.skillPool.length === 0) return [];

    const skillsStore = useSkillsStore();

    return enemy.skillPool
      .map(skillId => skillsStore.getSkill(skillId))
      .filter((s): s is Skill => s !== null)
      .map(s => ({
        id: s.id,
        name: s.name,
        isHeal: s.type === 'health_restore' || s.type === 'mana_restore',
        damageMultiplier: s.effect.coefficient || 1
      }));
  }

  /**
   * 敌人使用技能（通过 skillsStore 获取真实技能数据，基于敌人属性计算伤害/治疗量）
   * @param id - 敌人实例 ID
   * @param skillId - 技能 ID
   * @returns 技能使用结果（成功状态、伤害/治疗值、是否为治疗）
   */
  function useSkill(id: string, skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    const enemy = enemiesCache.value[id];
    if (!enemy) {
      return { success: false, damage: 0, isHeal: false };
    }

    // 通过 skillsStore 获取真实技能数据
    const skillsStore = useSkillsStore();
    const skill = skillsStore.getSkill(skillId);
    if (!skill) {
      return { success: false, damage: 0, isHeal: false };
    }

    const isHeal = skill.type === 'health_restore' || skill.type === 'mana_restore';

    // 基于技能 effect 数据和敌人攻击属性计算实际效果
    const attackStat = (enemy.physicalAttack || (enemy.stats as any)?.physicalAttack || 10);
    const coefficient = skill.effect.coefficient || 1;
    const baseDamage = Math.round(attackStat * coefficient + skill.effect.value);

    if (isHeal) {
      // 治疗技能：恢复敌人生命值
      const healAmount = Math.min(baseDamage, enemy.maxHp - enemy.hp);
      enemy.hp += healAmount;
      enemiesCache.value[id] = { ...enemy };
      return { success: true, damage: -healAmount, isHeal: true };
    }

    // 攻击技能：对玩家造成伤害（伤害值由 combat 模块的防御计算进一步处理）
    return { success: true, damage: baseDamage, isHeal: false };
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
