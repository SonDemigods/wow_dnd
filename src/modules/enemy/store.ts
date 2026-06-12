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
 * 敌人通用技能定义（基于敌人属性派生，无需额外数据配置）
 * 每个敌人至少拥有一个基础攻击技能，部分敌人拥有特殊技能
 */
interface EnemySkillDef {
  id: string;
  name: string;
  /** 伤害倍率（相对于敌人物理攻击力） */
  damageMultiplier: number;
  /** 是否为治疗技能 */
  isHeal: boolean;
  /** 使用该技能所需的最低危险等级 */
  minDangerLevel: string;
}

/** 敌人通用技能表 */
const ENEMY_SKILLS: EnemySkillDef[] = [
  { id: 'enemy_slam', name: '猛击', damageMultiplier: 1.5, isHeal: false, minDangerLevel: '普通' },
  { id: 'enemy_sweep', name: '横扫', damageMultiplier: 1.2, isHeal: false, minDangerLevel: '普通' },
  { id: 'enemy_charge', name: '冲锋', damageMultiplier: 1.3, isHeal: false, minDangerLevel: '困难' },
  { id: 'enemy_rend', name: '撕裂', damageMultiplier: 1.4, isHeal: false, minDangerLevel: '困难' },
  { id: 'enemy_crush', name: '粉碎', damageMultiplier: 1.8, isHeal: false, minDangerLevel: '危险' },
  { id: 'enemy_fireball', name: '火球术', damageMultiplier: 1.6, isHeal: false, minDangerLevel: '危险' },
  { id: 'enemy_heal', name: '自我修复', damageMultiplier: 0.5, isHeal: true, minDangerLevel: '困难' },
  { id: 'enemy_boss_slam', name: '毁灭打击', damageMultiplier: 2.5, isHeal: false, minDangerLevel: '极危险' },
];

/** 危险等级权重映射 */
const DANGER_LEVEL_RANK: Record<string, number> = {
  '普通': 1,
  '困难': 2,
  '危险': 3,
  '极危险': 4,
  '致命': 5,
};

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
   * 获取敌人可用技能列表（根据敌人危险等级筛选通用技能表）
   * @param id - 敌人实例 ID
   * @returns 可用技能列表（至少包含一个基础技能）
   */
  function getAvailableSkills(id: string): { id: string; name: string }[] {
    const enemy = enemiesCache.value[id];
    if (!enemy) return [];

    const enemyRank = DANGER_LEVEL_RANK[enemy.dangerLevel] || 0;

    // 筛选出敌人当前危险等级可用的技能
    const available = ENEMY_SKILLS.filter(skill => {
      const skillMinRank = DANGER_LEVEL_RANK[skill.minDangerLevel] || 0;
      return skillMinRank <= enemyRank;
    });

    // 始终返回至少一个基础技能
    if (available.length === 0) {
      return [{ id: 'enemy_slam', name: '猛击' }];
    }

    return available.map(s => ({ id: s.id, name: s.name }));
  }

  /**
   * 敌人使用技能（基于敌人属性计算伤害/治疗量）
   * @param id - 敌人实例 ID
   * @param skillId - 技能 ID
   * @returns 技能使用结果（成功状态、伤害/治疗值、是否为治疗）
   */
  function useSkill(id: string, skillId: string): { success: boolean; damage: number; isHeal: boolean } {
    const enemy = enemiesCache.value[id];
    if (!enemy) {
      return { success: false, damage: 0, isHeal: false };
    }

    // 查找技能定义
    const skillDef = ENEMY_SKILLS.find(s => s.id === skillId);
    if (!skillDef) {
      return { success: false, damage: 0, isHeal: false };
    }

    // 基于敌人物理攻击力 * 技能倍率计算伤害
    const baseDamage = Math.round((enemy.physicalAttack || enemy.stats?.physicalAttack || 10) * skillDef.damageMultiplier);

    if (skillDef.isHeal) {
      // 治疗技能：恢复生命值
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
