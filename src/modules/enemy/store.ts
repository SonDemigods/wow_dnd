/**
 * 敌人模块状态管理（Store 核心架构）
 *
 * Store 是敌人数据的唯一持有者，Action 负责编排：
 *   调纯函数 → 更新 Store 状态 →（敌人仅内存，不调 DB）
 *
 * 阶段四升级：切断 enemy → boss 反向依赖
 *   原 createEnemy 直接导入 bossDbService/createBossInstance 实现 Boss 回退，
 *   现改为通过 setBossCreateFn 注入回调，enemy 模块不再静态依赖 boss 模块。
 *   boss 模块在初始化时（GameBootstrap）调用 setBossCreateFn 注入创建函数。
 *   此模式与 inventory 模块的 setInventoryCallbacks 一致。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EnemyInstance, AiStrategyType } from './types';
import type { Skill } from '@/modules/skill/types';
import { createEnemyInstance, calculateEnemyDamage } from './service';
import { enemyDbService } from './db';
import { useSkillStore } from '@/modules/skill/store';
import { errorHandler } from '@/services/ErrorHandler';

// ============================================================================
// Boss 创建回调注入（阶段四：切断 enemy → boss 反向依赖）
// ============================================================================

/**
 * Boss 创建函数类型
 *
 * 由 boss 模块在初始化时注入，enemy store 通过此回调实现 Boss 回退创建，
 * 避免静态依赖 boss 模块。
 */
type BossCreateFn = (dataId: string, level: number) => Promise<EnemyInstance | null>;

/** Boss 创建函数（由 boss 模块注入，未注入时 createEnemy 跳过 Boss 回退） */
let bossCreateFn: BossCreateFn | null = null;

/**
 * 注入 Boss 创建函数（由 boss 模块初始化时调用）
 * @param fn - Boss 创建函数，接收 (dataId, level)，返回 EnemyInstance 或 null
 */
export function setBossCreateFn(fn: BossCreateFn | null): void {
  bossCreateFn = fn;
}

/**
 * 敌人状态存储
 */
export const useEnemyStore = defineStore('enemies', () => {
  // ==================== 状态 ====================
  /** 当前活跃敌人 ID 列表 */
  const activeEnemyIds = ref<string[]>([]);

  /** 敌人实例缓存（key 为敌人 ID） */
  const enemiesCache = ref<Record<string, EnemyInstance>>({});

  /** 敌人技能冷却追踪（enemyId → { skillId: 剩余冷却回合数 }） */
  const skillCooldowns = ref<Record<string, Record<string, number>>>({});

  // ==================== 计算属性 ====================
  /** 所有活跃敌人 */
  const enemies = computed(() => Object.values(enemiesCache.value));

  /** 活跃敌人数量 */
  const enemiesCount = computed(() => activeEnemyIds.value.length);

  // ==================== 动作 ====================

  /**
   * 创建敌人实例
   *
   * 查找顺序：优先从普通怪物表（enemyDbService）查找，未命中时通过注入的
   * bossCreateFn 回退到 Boss 表（阶段四：不再静态依赖 boss 模块）。
   * 命中后将实例存入缓存并加入活跃列表；均未命中或创建失败时返回 null。
   *
   * @param dataId - 敌人数据 ID
   * @param level - 敌人等级，默认 1
   * @returns 创建的敌人实例，失败时返回 null
   */
  async function createEnemy(dataId: string, level: number = 1): Promise<EnemyInstance | null> {
    try {
      // 优先从普通怪物表查找
      let template = await enemyDbService.getEnemyTemplate(dataId);
      if (template) {
        const enemy = createEnemyInstance(template, level);
        activeEnemyIds.value.push(enemy.id);
        enemiesCache.value[enemy.id] = { ...enemy };
        return enemy;
      }

      // 回退到 Boss 表查找（通过注入的回调，避免静态依赖 boss 模块）
      if (bossCreateFn) {
        const boss = await bossCreateFn(dataId, level);
        if (boss) {
          activeEnemyIds.value.push(boss.id);
          enemiesCache.value[boss.id] = { ...boss };
          return boss;
        }
      }

      throw new Error(`Enemy data not found: ${dataId}`);
    } catch (e) {
      errorHandler.report(e, '创建敌人失败');
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

    const newHp = Math.max(0, enemy.hp - damage);
    enemiesCache.value[id] = { ...enemy, hp: newHp };
    return newHp <= 0;
  }

  /**
   * 敌人恢复生命值（P3-184：替代 takeDamage(负值) 实现回血）
   *
   * 语义清晰，避免未来 takeDamage 增加"受伤时触发"逻辑时误触发。
   * @param id - 敌人实例 ID
   * @param amount - 恢复量
   */
  function receiveHeal(id: string, amount: number): void {
    const enemy = enemiesCache.value[id];
    if (!enemy) return;
    const newHp = Math.min(enemy.maxHp, enemy.hp + amount);
    enemiesCache.value[id] = { ...enemy, hp: newHp };
  }

  /**
   * 根据 ID 获取敌人
   * @param id - 敌人实例 ID
   * @returns 敌人实例，不存在时返回 null
   */
  function getEnemyById(id: string): EnemyInstance | null {
    return enemiesCache.value[id] || null;
  }

  /**
   * 获取敌人可用技能列表（从 skillPool 读取技能ID，通过 skillsStore 获取真实技能数据）
   *
   * 过滤掉冷却中的技能，仅返回当前可施放的技能。
   *
   * @param id - 敌人实例 ID
   * @returns 可用技能列表：
   *   - `id`：技能 ID
   *   - `name`：技能名称
   *   - `isHeal`：是否为治疗技能
   *   - `isBuff`：是否为 buff/debuff 技能
   */
  function getAvailableSkills(id: string): { id: string; name: string; isHeal?: boolean; isBuff?: boolean }[] {
    const enemy = enemiesCache.value[id];
    if (!enemy || !enemy.skillPool || enemy.skillPool.length === 0) return [];

    const skillsStore = useSkillStore();
    return enemy.skillPool
      .filter(skillId => !skillCooldowns.value[id]?.[skillId])
      .map(skillId => skillsStore.getSkill(skillId))
      .filter((s): s is Skill => s !== null)
      .map(s => ({
        id: s.id,
        name: s.name,
        isHeal: s.type === 'health_restore' || s.type === 'mana_restore',
        isBuff: s.type === 'buff' || s.type === 'debuff'
      }));
  }

  /**
   * 记录技能冷却（统一冷却逻辑，避免分支遗漏）
   * @param id - 敌人实例 ID
   * @param skillId - 技能 ID
   * @param cooldown - 冷却回合数
   */
  function recordCooldown(id: string, skillId: string, cooldown?: number): void {
    if (cooldown && cooldown > 0) {
      if (!skillCooldowns.value[id]) skillCooldowns.value[id] = {};
      skillCooldowns.value[id][skillId] = cooldown;
    }
  }

  /**
   * 敌人使用技能（通过 skillsStore 获取真实技能数据，基于敌人属性计算伤害/生命恢复量）
   *
   * 根据技能类型分三条分支处理：
   * - buff/debuff：记录冷却，返回 buff 数据供调用方处理
   * - 治疗：记录冷却，恢复敌人 HP，damage 为负值表示恢复量
   * - 攻击：记录冷却，返回伤害值，由 combat 模块进一步计算防御减免
   *
   * @param id - 敌人实例 ID
   * @param skillId - 技能 ID
   * @returns 技能使用结果：
   *   - `success`：是否成功施放
   *   - `damage`：伤害值（正值）或恢复量（负值）
   *   - `isHeal`：是否为治疗技能
   *   - `isBuff`：是否为 buff/debuff 技能
   *   - `buffs`：buff 数据列表（仅 buff 分支返回）
   */
  function useSkill(id: string, skillId: string): { success: boolean; damage: number; isHeal: boolean; isBuff?: boolean; buffs?: Array<{ type: string; value: number; turns: number }> } {
    const enemy = enemiesCache.value[id];
    if (!enemy) {
      return { success: false, damage: 0, isHeal: false };
    }

    // 通过 skillsStore 获取真实技能数据
    const skillsStore = useSkillStore();
    const skill = skillsStore.getSkill(skillId);
    if (!skill) {
      return { success: false, damage: 0, isHeal: false };
    }

    // P8-402 修复：mana_restore 不应治疗敌人 HP（敌人无 MP 概念），仅 health_restore 走治疗分支
    const isHeal = skill.type === 'health_restore';
    const isBuff = skill.type === 'buff' || skill.type === 'debuff';

    // buff/debuff 技能：不造成伤害，将 buff 数据传回调用方处理
    if (isBuff) {
      // 记录技能冷却
      recordCooldown(id, skillId, skill.cooldown);
      if (skill.buffs && skill.buffs.length > 0) {
        return {
          success: true, damage: 0, isHeal: false, isBuff: true,
          buffs: skill.buffs.map(b => ({ type: b.type, value: b.value, turns: b.turns }))
        };
      }
      return { success: true, damage: 0, isHeal: false, isBuff: true, buffs: [] };
    }

    // 根据技能伤害类型选择对应的攻击属性
    const attackStat = (skill.type === 'magic_damage'
      ? enemy.magicAttack
      : enemy.physicalAttack) ?? 10;
    const coefficient = skill.effect.coefficient ?? 1;
    const baseDamage = Math.round(attackStat * coefficient + skill.effect.value);

    if (isHeal) {
      // 生命恢复技能：恢复敌人生命值
      // 记录技能冷却（修复：治疗技能也需要进入冷却）
      recordCooldown(id, skillId, skill.cooldown);
      const healAmount = Math.min(baseDamage, enemy.maxHp - enemy.hp);
      enemiesCache.value[id] = { ...enemy, hp: enemy.hp + healAmount };
      return { success: true, damage: -healAmount, isHeal: true };
    }

    // 攻击技能：对玩家造成伤害（伤害值由 combat 模块的防御计算进一步处理）
    // 记录技能冷却（敌人也需要遵循冷却机制）
    recordCooldown(id, skillId, skill.cooldown);
    return { success: true, damage: baseDamage, isHeal: false };
  }

  /**
   * 推进指定敌人的技能冷却
   *
   * 将该敌人所有技能的剩余冷却回合数减 1，冷却归零后移除记录；
   * 若该敌人无任何冷却中的技能，则清理其冷却记录条目。
   *
   * @param eid - 敌人实例 ID
   */
  function tickSingleEnemyCooldowns(eid: string): void {
    const cd = skillCooldowns.value[eid];
    if (!cd) return;
    for (const sid of Object.keys(cd)) {
      cd[sid]--;
      if (cd[sid] <= 0) delete cd[sid];
    }
    if (Object.keys(cd).length === 0) delete skillCooldowns.value[eid];
  }

  /**
   * 推进敌人技能冷却（每回合调用）
   * @param enemyId - 可选，指定敌人 ID；不传则推进所有敌人的冷却
   */
  function tickCooldowns(enemyId?: string): void {
    if (enemyId) {
      tickSingleEnemyCooldowns(enemyId);
    } else {
      for (const eid of Object.keys(skillCooldowns.value)) {
        tickSingleEnemyCooldowns(eid);
      }
    }
  }

  /**
   * 获取敌人技能剩余冷却回合数
   * @param enemyId - 敌人 ID
   * @param skillId - 技能 ID
   * @returns 剩余冷却回合数
   */
  function getCooldownRemaining(enemyId: string, skillId: string): number {
    return skillCooldowns.value[enemyId]?.[skillId] || 0;
  }

  /**
   * 计算敌人对玩家造成的伤害（委托纯函数 calculateEnemyDamage）
   *
   * 薄封装的目的：避免 combat 层直接依赖 enemy/service.ts，通过 Store 统一对外暴露。
   * P3-169：移除 defense 参数，防御统一由 pipeline 处理，此处仅计算原始伤害。
   *
   * @param enemy - 敌人实例
   * @returns 计算后的原始伤害值
   */
  function calculateDamage(enemy: EnemyInstance): number {
    return calculateEnemyDamage(enemy);
  }

  /**
   * 设置敌人 AI 策略（P3-175：替代直接修改 e.aiStrategy）
   *
   * 通过 Store action 修改 enemy.aiStrategy，确保 Vue 响应式追踪。
   * 用于 Boss 阶段切换时同步 AI 策略。
   *
   * @param enemyId - 敌人 ID
   * @param strategy - 新的 AI 策略
   */
  function setAiStrategy(enemyId: string, strategy: AiStrategyType): void {
    const enemy = enemiesCache.value[enemyId];
    if (enemy) {
      enemiesCache.value[enemyId] = { ...enemy, aiStrategy: strategy };
    }
  }

  /**
   * 删除敌人实例
   *
   * 同时清理活跃 ID 列表、实例缓存和技能冷却记录，避免内存泄漏。
   *
   * @param id - 敌人实例 ID
   */
  function deleteEnemy(id: string): void {
    activeEnemyIds.value = activeEnemyIds.value.filter(eid => eid !== id);
    delete enemiesCache.value[id];
    delete skillCooldowns.value[id];
  }

  /** 清除所有敌人（活跃 ID 列表、实例缓存、技能冷却记录全部重置） */
  function clearAll(): void {
    activeEnemyIds.value = [];
    enemiesCache.value = {};
    skillCooldowns.value = {};
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
    receiveHeal,
    getEnemyById,
    getAvailableSkills,
    useSkill,
    tickCooldowns,
    getCooldownRemaining,
    calculateDamage,
    setAiStrategy,
    deleteEnemy,
    clearAll
  };
});
