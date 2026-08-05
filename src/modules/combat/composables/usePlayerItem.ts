/**
 * @fileoverview 玩家物品使用 Composable（QA-9 拆分自 usePlayerAction.ts）
 *
 * 承载 playerUseItem 函数的完整分支逻辑：
 *   - 伤害型物品（physical_damage / magic_damage）：走伤害管线 + Boss 防御/反击/复活
 *   - 恢复型物品（health_restore / mana_restore）：发射 COMBAT_CAST_HEAL 事件
 *   - 通用：调用 inventory.useItem 扣减数量
 *
 * 依赖注入保持与 usePlayerAction 一致。
 * 暴击判定 / 荆棘反伤统一使用 helpers/critCalc.ts（QA-12）。
 */
import type { CombatActionResult, CombatResult } from '../types';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '@/modules/bus';
import {
  processDamagePipeline,
  createEmptyContainer,
  type DamageType,
} from '../effects';
import { rollPlayerCrit, computeThornsDamage } from './helpers/critCalc';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useInitiative } from './useInitiative';
import type { usePassiveSkills } from './usePassiveSkills';
import type { useBossMechanics } from './useBossMechanics';

export function usePlayerItem(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 inventory.getItemInfo、character.name/attributes、enemy.getEnemyById；写 enemy.takeDamage、character.takeDamage、inventory.useItem）
  ctx: ICombatContext,
  initiative: ReturnType<typeof useInitiative>,
  endCombat: (result: CombatResult) => void,
  boss: ReturnType<typeof useBossMechanics>,
  // P3-146：注入被动技能，用于读取 stat_modifier 接入伤害管线与暴击判定
  passive: ReturnType<typeof usePassiveSkills>,
) {
  const { addCombatLog, createPlayerEffectContext, createEnemyEffectContext } = log;
  const { aliveEnemies, currentTarget, playerEffects, enemyEffects, effectRegistry } = state;

  /**
   * 玩家使用物品
   * @param itemId - 物品 ID
   */
  async function playerUseItem(itemId: string): Promise<CombatActionResult> {
    // 先获取物品信息，判断是否为伤害型物品
    const itemInfo = ctx.inventory.getItemInfo(itemId);
    let damageResult: { damage: number; isCrit: boolean } | null = null;
    let itemKilledEnemy = false;

    // P3.3：从 effects[] 提取伤害型和恢复型效果（替代旧 item.effect 单效果）
    // 消耗品 effects 为必填数组，装备 effects 为可选（被动效果），其余类别无效果
    const itemEffects = itemInfo?.kind === 'consumable' ? itemInfo.effects
                      : itemInfo?.kind === 'equipment' ? (itemInfo.effects ?? [])
                      : [];
    const damageEffect = itemEffects.find(e =>
      (e.type === 'magic_damage' || e.type === 'physical_damage') && typeof e.value === 'number' && e.value > 0
    );
    const restoreEffect = itemEffects.find(e =>
      (e.type === 'health_restore' || e.type === 'mana_restore') && typeof e.value === 'number' && e.value > 0
    );

    if (damageEffect) {
      const { type, value } = damageEffect;

      if ((type === 'magic_damage' || type === 'physical_damage') && typeof value === 'number' && value > 0) {
        // 伤害型物品：对当前目标造成伤害
        const target = currentTarget.value;
        if (!target) {
          return { success: false, type: 'item', message: '没有可攻击的目标！' };
        }

        const damageType: DamageType = type === 'magic_damage' ? 'magical' : 'physical';

        // P3-146：读取 stat_modifier 类被动
        const statModifiers = passive.getStatModifiers();

        const pipeResult = processDamagePipeline(
          effectRegistry,
          playerEffects.value,
          enemyEffects.value[target.id] || createEmptyContainer(),
          createPlayerEffectContext(),
          createEnemyEffectContext(target),
          damageType,
          value,  // baseDamageOverride：物品基础伤害直接传入
          undefined,
          statModifiers,
        );

        // 暴击判定
        // P3-146：传入 statModifiers 让 crit_chance / crit_damage_multiplier 生效
        const { isCrit, multiplier: critMultiplier } = rollPlayerCrit(ctx.character.attributes, undefined, statModifiers);
        const finalDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

        // BIZ-2：应用 BOSS 防御机制（无敌/护盾）
        const { damage: actualItemDamage } = boss.applyBossDefenseMechanics(target, finalDamage);
        let isDead = false;
        if (actualItemDamage > 0) {
          isDead = ctx.enemy.takeDamage(target.id, actualItemDamage);
        }
        itemKilledEnemy = isDead;

        damageResult = { damage: finalDamage, isCrit };

        // BIZ-2：应用 BOSS 反击机制（反弹/反击）
        boss.applyBossCounterMechanics(target, actualItemDamage);

        // BIZ-3：荆棘反伤（与 playerAttack 保持一致）
        if (pipeResult.thorns > 0) {
          const thornsDamage = computeThornsDamage(pipeResult.thorns, critMultiplier);
          ctx.character.takeDamage(thornsDamage);
          addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_damage', targetType: 'player', targetId: 'player',
            targetName: ctx.character.name, damage: thornsDamage,
            isCrit: false, isDodge: false,
            message: `荆棘反伤对 ${ctx.character.name} 造成 ${thornsDamage} 点伤害！`
          });
        }

        // 伤害音效事件
        eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
          amount: finalDamage,
          damageType: type === 'magic_damage' ? 'magic' : 'physical',
          targetName: target.name || '敌人',
          actorType: 'player'
        });

        // 暴击事件
        if (isCrit) {
          eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
            amount: finalDamage,
            damageType: type === 'magic_damage' ? 'magic' : 'physical',
            targetName: target.name || '敌人',
            actorType: 'player'
          });
        }
      }
    }

    // 调用 inventoryStore 使用物品（扣减数量 + 应用恢复/属性效果）
    await ctx.inventory.useItem(itemId);

    // 生命/法力恢复音效事件
    if (restoreEffect) {
      const { type, value } = restoreEffect;
      if ((type === 'health_restore' || type === 'mana_restore') && typeof value === 'number' && value > 0) {
        eventBus.emit(GameEvents.COMBAT_CAST_HEAL, {
          amount: value,
          healType: type === 'mana_restore' ? 'mana' : 'health',
          targetName: ctx.character.name
        });
      }
    }

    // 战斗日志
    if (damageResult) {
      const target = currentTarget.value;
      const updatedTarget = target ? ctx.enemy.getEnemyById(target.id) : null;
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: damageResult.isCrit ? 'combat_critical' : 'combat_skill_cast',
        targetType: 'enemy',
        targetId: updatedTarget?.id || '',
        targetName: updatedTarget?.name || '',
        damage: damageResult.damage,
        isCrit: damageResult.isCrit,
        isDodge: false,
        message: damageResult.isCrit
          ? `${ctx.character.name} 使用 ${itemInfo?.name || '卷轴'}，暴击！对 ${updatedTarget?.name} 造成 ${damageResult.damage} 点伤害！`
          : `${ctx.character.name} 使用 ${itemInfo?.name || '卷轴'}，对 ${updatedTarget?.name} 造成 ${damageResult.damage} 点伤害！`
      });
    } else {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_item',
        isCrit: false,
        isDodge: false,
        message: `${ctx.character.name} 使用了 ${itemInfo?.name || '物品'}！`
      });
    }

    // 检查敌人是否全部死亡
    if (damageResult && aliveEnemies.value.length === 0) {
      const target = currentTarget.value;
      // P1-1：检查 BOSS 复活机制（与 playerAttack/playerSkill 保持一致）
      if (itemKilledEnemy && target && boss.checkBossRevive(target)) {
        initiative.endPlayerTurn();
      } else {
        endCombat('victory');
      }
    } else {
      initiative.endPlayerTurn();
    }
    // P2 BIZ-4 修复：移除重复 saveLogs，endPlayerTurn/endCombat 内部已调用

    return {
      success: true,
      type: 'item',
      damage: damageResult?.damage,
      isCrit: damageResult?.isCrit,
      message: damageResult
        ? `使用 ${itemInfo?.name || '卷轴'} 造成 ${damageResult.damage} 点伤害！`
        : '使用了物品！'
    };
  }

  return { playerUseItem };
}
