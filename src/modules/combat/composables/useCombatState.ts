/**
 * 战斗状态 Composable
 * 
 * 从 combat store 提取的响应式状态、计算属性和基础状态操作函数。
 * 作为战斗模块的单一状态持有者，供其他 composable 和 store 使用。
 */
import { ref, computed, shallowRef } from 'vue';
import type { CombatState, CombatResult, CombatLog } from '../types';
import type { EnemyInstance } from '@/modules/enemy';
import type { BossIntro, BossInstance } from '@/modules/boss';
import type { Effect, EffectContainer } from '../effects';
import type { ResourceSystem } from '../resources';
import type { ICombatContext } from '../combatContext';
import { isBossCombat } from '../service';
import {
  createEmptyContainer,
  createDefaultRegistry,
  EffectHandlerRegistry,
  addEffectToContainer
} from '../effects';
import { BossPhaseManager } from '@/modules/boss';

// ARCH-6：需完整上下文（读 enemy.getEnemyById；写 enemy.deleteEnemy）
export function useCombatState(ctx: ICombatContext) {
  // ==================== 响应式状态 ====================

  /** 当前战斗状态 */
  const state = ref<CombatState>('idle');

  /** 当前敌人 ID 列表（数据存在 enemiesStore 缓存中） */
  const enemyIds = ref<string[]>([]);

  /** 当前目标敌人 ID */
  const targetEnemyId = ref<string | null>(null);

  /** Boss 阶段管理器（按敌人 ID 索引） */
  const bossPhaseManagers = new Map<string, BossPhaseManager>();
  /**
   * Boss 实例映射（按敌人 ID 索引，阶段三 3.5 新增）
   *
   * 收口 Boss 运行时状态（shield/invulnerable/reflectDamage 等 12 个字段）。
   * combat 模块通过此 Map 获取 BossInstance，访问 runtime 状态，
   * 替代原先散落在 EnemyInstance 顶层的运行时字段。
   */
  const bossInstances = new Map<string, BossInstance>();
  /** Boss 出场演出数据（按敌人 ID 索引，战斗开始后立即清空） */
  const bossIntros = ref<Record<string, BossIntro>>({});
  /** 敌人位置映射（enemyId -> { row: 'front'|'back', col: 0-2 }），3×2 网格布局 */
  const enemyPositions = ref<Record<string, { row: 'front' | 'back'; col: number }>>({});

  /** 当前回合（'pet' 为召唤物回合，玩家不可操作） */
  const turn = ref<'player' | 'enemy' | 'pet'>('player');

  /** 当前回合数 */
  const turnCount = ref(0);

  /** 当前战斗 ID */
  const combatId = ref('');

  /** 战斗日志 */
  const combatLogs = ref<CombatLog[]>([]);

  /** 战斗结果（供 UI 结果弹窗展示） */
  const combatResult = ref<CombatResult | null>(null);

  /** 获得经验值（供 UI 结果弹窗展示） */
  const expGained = ref(0);

  /** 获得金币（供 UI 结果弹窗展示） */
  const goldGained = ref(0);

  /** 行动顺序（按速度排序的单位ID列表） */
  const initiativeOrder = ref<string[]>([]);

  /** 当前行动序号索引 */
  const currentInitiativeIndex = ref(0);

  /** 战斗速度倍率 */
  const combatSpeed = ref<1 | 2>(1);

  /** 玩家当前效果容器（Buff/Debuff） */
  const playerEffects = ref<EffectContainer>(createEmptyContainer());

  /** 敌人效果容器映射（敌人ID -> 效果容器，用于护盾等临时效果） */
  const enemyEffects = ref<Record<string, EffectContainer>>({});

  /** 效果系统注册表（单例，注册全部 14 种处理器） */
  const effectRegistry = new EffectHandlerRegistry();
  createDefaultRegistry(effectRegistry);

  /** 敌人回合延迟定时器 ID（ref，确保 resetState 和 useInitiative 操作同一引用） */
  const turnTimerId = ref<number | null>(null);

  /**
   * Boss 介绍延迟定时器 ID（ref，确保 startCombat 和 resetState/endCombat 操作同一引用）
   *
   * startCombat 中通过 setTimeout 延迟 300ms 触发 COMBAT_BOSS_INTRO 事件，
   * 若战斗在 300ms 内结束（如玩家立即逃跑），需在 resetState 中清理该定时器，
   * 否则会向已结束的战斗 UI 推送 Boss 介绍数据。
   */
  const bossIntroTimerId = ref<number | null>(null);

  /**
   * 玩家资源系统列表（按职业创建，空数组表示使用默认 MP 系统）
   * 使用 shallowRef 避免对 ResourceSystem 实例做深度响应式追踪
   */
  const resourceSystems = shallowRef<ResourceSystem[]>([]);

  // ==================== 计算属性 ====================

  /** 是否正在战斗中 */
  const isInCombat = computed(() => state.value === 'fighting');

  /**
   * 敌人列表（从 enemiesStore 缓存实时读取，自动响应 HP 变化）
   * 不再维护本地副本，数据源唯一
   */
  const enemies = computed<EnemyInstance[]>(() =>
    enemyIds.value.map(id => ctx.enemy.getEnemyById(id)).filter((e): e is EnemyInstance => e !== null && e !== undefined)
  );

  /** 存活敌人列表 */
  const aliveEnemies = computed(() => enemies.value.filter(e => e.hp > 0));

  /** 是否存在 Boss 敌人 */
  const hasBossEnemy = computed(() => enemies.value.some(e => isBossCombat(e)));

  /** 当前攻击目标（优先选择的目标 > 第一个存活敌人） */
  const currentTarget = computed(() => enemies.value.find(e => e.id === targetEnemyId.value) || aliveEnemies.value[0] || null);

  // ==================== 内部：重置核心状态 ====================

  /**
   * 重置所有战斗状态到初始值（公共底层逻辑，供 cleanup() 和 reset() 复用）
   */
  function resetState(): void {
    if (turnTimerId.value !== null) {
      clearTimeout(turnTimerId.value);
      turnTimerId.value = null;
    }
    if (bossIntroTimerId.value !== null) {
      clearTimeout(bossIntroTimerId.value);
      bossIntroTimerId.value = null;
    }

    state.value = 'idle';
    enemyIds.value = [];
    targetEnemyId.value = null;
    turn.value = 'player';
    turnCount.value = 0;
    combatId.value = '';
    combatLogs.value = [];
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;
    // 重置先攻顺序与索引（修复：原 resetState 漏重置，导致 cleanup 后残留旧行动顺序）
    initiativeOrder.value = [];
    currentInitiativeIndex.value = 0;
    playerEffects.value = createEmptyContainer();
    enemyEffects.value = {};
    bossPhaseManagers.clear();
    bossInstances.clear();
    bossIntros.value = {};
    enemyPositions.value = {};
    // 清理资源系统（释放引用，便于 GC）
    resourceSystems.value = [];
    // P2 BIZ-1 修复：重置战斗速度，避免上一场 2x 速度残留到新战斗
    combatSpeed.value = 1;
  }

  // ==================== Action：清理 & 重置 ====================

  /**
   * 清理战斗状态（含删除已死亡敌人）
   */
  function cleanup(): void {
    // 删除已死亡敌人
    for (const e of enemies.value) {
      if (e.hp <= 0) {
        ctx.enemy.deleteEnemy(e.id);
      }
    }
    resetState();
  }

  /**
   * 重置战斗状态（公开方法，不删除敌人数据）
   */
  function reset(): void {
    resetState();
  }

  // ==================== Action：效果操作 ====================

  /**
   * 为玩家添加效果（供外部模块直接调用）
   * @param effect - 效果实例
   */
  function addEffectToPlayer(effect: Effect): void {
    // 战斗作用域约束：效果仅在战斗期间生效
    if (state.value !== 'fighting') {
      console.warn('[Combat] 非战斗状态，忽略效果施加');
      return;
    }
    // P9-039 修复：传入 effectRegistry 使 addEffectToContainer 能调用旧 effect 的 onRemove 回调
    addEffectToContainer(playerEffects.value, effect, effectRegistry);
  }

  return {
    // 响应式状态
    state,
    enemyIds,
    targetEnemyId,
    bossIntros,
    enemyPositions,
    turn,
    turnCount,
    combatId,
    combatLogs,
    combatResult,
    expGained,
    goldGained,
    initiativeOrder,
    currentInitiativeIndex,
    combatSpeed,
    playerEffects,
    enemyEffects,
    resourceSystems,

    // 普通变量
    bossPhaseManagers,
    bossInstances,
    effectRegistry,
    turnTimerId,
    bossIntroTimerId,

    // 计算属性
    isInCombat,
    enemies,
    aliveEnemies,
    hasBossEnemy,
    currentTarget,

    // 函数
    cleanup,
    reset,
    addEffectToPlayer,
  };
}
