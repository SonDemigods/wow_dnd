/**
 * @fileoverview 宠物行动 Composable（P3-156 修复）
 * @description 战斗循环与宠物 Store 的唯一桥接点。
 *              负责宠物回合行动（AI 选择技能 → 计算伤害 → 选取目标 → 造成伤害 → 写日志）、
 *              宠物受伤、回合推进、召唤资源消耗闭环与解散。
 *
 * 设计原则：
 * 1. 参照 useEnemyAction 的依赖注入签名（state/log/ctx），不直接 import 战斗 Store
 * 2. 持有 usePetStore 引用，作为战斗与宠物 Store 的唯一桥接点
 * 3. 宠物伤害走 processDamagePipeline，受敌人 debuff（易伤/护盾）影响，但不享受玩家 buff
 * 4. 阶段 1（P3-156）敌人不攻击宠物，嘲讽机制留待阶段 3 引入
 * @module combat/composables
 */
import type { CombatLog } from '../types';
import type { EnemyInstance } from '@/modules/enemy';
import type { ICombatContext } from '../combatContext';
import { rollDodge } from '../service';
import {
  processDamagePipeline,
  createEmptyContainer,
  type EffectContext,
} from '../effects';
import { usePetStore, calculatePetSkillDamage, getPetDefinition, getPetResourceCost } from '../pets';
import type { PetInstance, PetType } from '../pets';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useBossMechanics } from './useBossMechanics';

/** 召唤资源消耗结果（供 UI 层展示提示） */
export interface PetSummonResult {
  success: boolean;
  message: string;
}

export function usePetAction(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 enemy.getEnemyById；写 enemy.takeDamage）
  ctx: ICombatContext,
  // P3-182：注入 Boss 机制层，使宠物攻击接入 Boss 防御/反击机制
  boss: ReturnType<typeof useBossMechanics>,
) {
  const petStore = usePetStore();
  const { addCombatLog, createEnemyEffectContext } = log;
  const { aliveEnemies, currentTarget, enemyEffects, effectRegistry } = state;

  // ============================================================
  // 内部辅助
  // ============================================================

  /**
   * 构建宠物效果上下文
   *
   * 宠物作为友方单位，ownerType 使用 'player'，使 effect 系统正确识别其为攻击方。
   * baseStats 用宠物属性填充，供 pipeline 的 stat_modifier 与效果计算使用。
   */
  function createPetEffectContext(pet: PetInstance): EffectContext {
    return {
      ownerId: pet.instanceId,
      ownerType: 'player',
      baseStats: {
        physicalAttack: pet.damage,
        physicalDefense: pet.defense,
        // 宠物无魔攻/魔防区分，统一用 damage/defense
        magicAttack: pet.damage,
        magicDefense: pet.defense,
        speed: pet.speed,
      },
      currentHp: pet.hp,
      maxHp: pet.maxHp,
    };
  }

  /**
   * 选择宠物攻击目标
   *
   * 策略：优先攻击玩家当前目标（协同玩家），否则攻击第一个存活敌人。
   * 复杂的 AI 目标选择（lowest_hp/caster_enemy 等）留待后续增强。
   */
  function selectPetTarget(): EnemyInstance | null {
    const playerTarget = currentTarget.value;
    if (playerTarget && playerTarget.hp > 0) return playerTarget;
    return aliveEnemies.value[0] ?? null;
  }

  /**
   * 输出宠物行动日志（统一 actorType='pet'，便于 UI 区分颜色）
   */
  function addPetLog(partial: Omit<CombatLog, 'combatId' | 'battleLogId' | 'timestamp' | 'turn' | 'actorType' | 'actorId' | 'actorName'>, pet: PetInstance): void {
    addCombatLog({
      actorType: 'pet',
      actorId: pet.instanceId,
      actorName: pet.name,
      ...partial,
    });
  }

  // ============================================================
  // 宠物回合行动
  // ============================================================

  /**
   * 宠物执行一回合行动
   *
   * 流程：
   * 1. 校验宠物存活与目标存在
   * 2. 调用 petStore.petTakeAction() 获取 AI 选择的技能（自动设置冷却）
   * 3. 检查敌人闪避
   * 4. 走伤害管线计算最终伤害（受敌人 debuff/护盾影响）
   * 5. 应用伤害、写日志
   *
   * 注意：本方法不检查战斗结束（由 singlePetTurn 在调用后检查 aliveEnemies）
   */
  function petTakeTurn(): void {
    if (!petStore.hasActivePet) return;
    const pet = petStore.activePet;
    if (!pet) return;

    const target = selectPetTarget();
    if (!target) {
      addPetLog({
        eventType: 'combat_event',
        isCrit: false,
        isDodge: false,
        message: `${pet.name} 找不到攻击目标`,
      }, pet);
      return;
    }

    // 获取 AI 选择的技能（内部已设置冷却）
    const skill = petStore.petTakeAction();
    if (!skill) return;

    // 检查敌人闪避（dodgeChance 是百分比，如 3 表示 3%）
    const enemyDodgeChance = (target.dodgeChance || 0) / 100;
    const isDodge = rollDodge(enemyDodgeChance);

    if (isDodge) {
      addPetLog({
        eventType: 'combat_miss',
        targetType: 'enemy',
        targetId: target.id,
        targetName: target.name,
        skillId: skill.id,
        skillName: skill.name,
        isCrit: false,
        isDodge: true,
        message: `${pet.name} 的 ${skill.name} 被 ${target.name} 闪避了！`,
      }, pet);
      return;
    }

    // 仅 damageMultiplier > 0 的技能造成伤害（attack 类技能）
    if (skill.damageMultiplier <= 0) {
      // buff/control/heal 类技能：阶段 1 仅写日志，效果留待后续
      addPetLog({
        eventType: 'combat_skill_cast',
        skillId: skill.id,
        skillName: skill.name,
        isCrit: false,
        isDodge: false,
        message: `${pet.name} 使用了 ${skill.name}`,
      }, pet);
      return;
    }

    // 计算基础伤害（宠物伤害 = pet.damage × skill.damageMultiplier）
    const baseDamage = calculatePetSkillDamage(pet, skill);

    // 走伤害管线：受敌人 debuff（易伤/防御降低）和护盾影响，但不享受玩家 buff
    const pipeResult = processDamagePipeline(
      effectRegistry,
      createEmptyContainer(), // 宠物无攻击者效果容器
      enemyEffects.value[target.id] || createEmptyContainer(),
      createPetEffectContext(pet),
      createEnemyEffectContext(target),
      'physical',
      baseDamage,
      undefined,
      undefined,
    );

    // 天赋 damage_multiplier 加成
    const talentDmgMult = ctx.talent.damageMultiplier;
    const finalDamage = talentDmgMult > 0
      ? Math.floor(pipeResult.finalDamage * (1 + talentDmgMult))
      : pipeResult.finalDamage;

    if (finalDamage > 0) {
      // P3-182：接入 Boss 防御机制（无敌/护盾）
      const { damage: actualPetDamage } = boss.applyBossDefenseMechanics(target, finalDamage);
      if (actualPetDamage > 0) {
        const petKill = ctx.enemy.takeDamage(target.id, actualPetDamage);
        // P9-003 修复：宠物击杀 Boss 时检查复活机制
        if (petKill) {
          boss.checkBossRevive(target);
        }
      }
      // P3-182：接入 Boss 反击机制（反弹/反击）
      boss.applyBossCounterMechanics(target, actualPetDamage);

      addPetLog({
        eventType: 'combat_damage',
        targetType: 'enemy',
        targetId: target.id,
        targetName: target.name,
        skillId: skill.id,
        skillName: skill.name,
        // P3-178：日志 damage 统一为防御后实际伤害
        damage: actualPetDamage,
        isCrit: false,
        isDodge: false,
        message: `${pet.name} 使用 ${skill.name} 对 ${target.name} 造成 ${actualPetDamage} 点伤害！`,
      }, pet);
    } else {
      // 伤害被完全吸收（护盾）
      addPetLog({
        eventType: 'combat_skill_cast',
        targetType: 'enemy',
        targetId: target.id,
        targetName: target.name,
        skillId: skill.id,
        skillName: skill.name,
        damage: 0,
        isCrit: false,
        isDodge: false,
        message: `${pet.name} 的 ${skill.name} 被 ${target.name} 的护盾完全吸收！`,
      }, pet);
    }
  }

  /**
   * 宠物受到伤害（包装 petStore.takeDamage，供敌人攻击/嘲讽机制调用）
   * @param damage - 原始伤害值（已扣除防御）
   */
  function petTakeDamage(damage: number): void {
    petStore.takeDamage(damage);
  }

  /**
   * 推进宠物回合状态（冷却、持续时间、死亡清理）
   *
   * 在每轮开始时调用（与 tickAllEffects 同时机），推进宠物技能冷却和持续时间。
   */
  function petTickTurn(): void {
    petStore.tickTurn();
  }

  // ============================================================
  // 召唤与解散（资源消耗闭环）
  // ============================================================

  /**
   * 召唤宠物（消耗灵魂碎片或集中值）
   *
   * 流程：
   * 1. 获取宠物定义，确定资源类型（soul_shard / focus）
   * 2. 查找对应的资源系统实例
   * 3. 校验资源是否足够（canSummon，用消耗前的数量校验）
   * 4. 调用 petStore.summon 创建实例（内部用消耗前数量二次校验，不消耗资源）
   * 5. 召唤成功后消耗资源
   *
   * 顺序说明：必须先 summon 再 consume。因为 petStore.summon 内部 canSummonPet
   * 会校验传入的 resourceAmount >= cost，若先 consume 则传入的是扣减后的值，可能 < cost 导致误判。
   *
   * 注意：本方法不重建先攻顺序，调用方（combatStore.summonPet）负责调用
   * initiative.buildInitiativeOrder() 让宠物加入先攻。
   *
   * @param petType - 目标宠物（术士或猎人）
   */
  function summon(petType: PetType): PetSummonResult {
    const petDef = getPetDefinition(petType);
    const resourceSys = state.resourceSystems.value.find(sys => sys.type === petDef.resourceType);

    if (!resourceSys) {
      const resourceName = petDef.resourceType === 'soul_shard' ? '灵魂碎片系统' : '集中值系统';
      return { success: false, message: `${resourceName}未初始化` };
    }

    const cost = getPetResourceCost(petDef);
    const currentAmount = resourceSys.currentValue;

    // 校验可召唤性（解锁、资源、已有激活）
    const check = petStore.canSummon(petType, currentAmount);
    if (!check.canSummon) {
      return { success: false, message: check.reason };
    }

    // 先召唤（petStore.summon 内部用 currentAmount 校验，不消耗资源）
    const ok = petStore.summon(petType, currentAmount);
    if (!ok) {
      return { success: false, message: '召唤失败' };
    }

    // 召唤成功后消耗资源
    resourceSys.consume(cost);

    return { success: true, message: `召唤了 ${petDef.name}` };
  }

  /**
   * 解散当前宠物
   */
  function dismiss(): PetSummonResult {
    if (!petStore.activePet) {
      return { success: false, message: '当前没有激活的召唤物' };
    }
    petStore.dismiss();
    return { success: true, message: '已解散召唤物' };
  }

  return {
    /** 暴露 petStore 引用，供 useInitiative 检查 hasActivePet / activePet.speed */
    petStore,
    petTakeTurn,
    petTakeDamage,
    petTickTurn,
    summon,
    dismiss,
    selectPetTarget,
    createPetEffectContext,
  };
}

