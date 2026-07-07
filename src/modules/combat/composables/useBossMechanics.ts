/**
 * Boss 机制 Composable
 * 
 * 从 combat store 提取的 Boss 专属机制函数。
 * 负责初始化 Boss 阶段管理器、缩放效果值，以及将阶段机制效果应用到玩家或敌人。
 */
import type { EnemyInstance } from '../../enemy/types';
import type { BossIntro, BossPhase, BossMechanicType } from '../../boss/types';
import { BossPhaseManager } from '../../boss/phase-manager';
import { useCharacterStore } from '../../character/store';
import { useEnemyStore } from '../../enemy/store';
import {
  generateEffectId,
  addEffectToContainer,
  type Effect,
  type EffectType,
} from '../effects';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';

export function useBossMechanics(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
) {
  /**
   * 先攻顺序重建回调
   *
   * 由 combat store 在 initiative 就位后通过 setInitiativeCallback 注入，
   * 避免构造期循环依赖（useInitiative 依赖 useBossMechanics，反之亦然）。
   * 仅在 summon_minions 召唤小怪后用于重建先攻顺序。
   */
  let initiativeCallback: ((characterStore: ReturnType<typeof useCharacterStore>) => void) | null = null;

  /**
   * 注入先攻顺序重建回调（CMB-1 修复：替代 orderBuilder 延迟绑定 hack）
   * @param cb - buildInitiativeOrder 函数
   */
  function setInitiativeCallback(cb: (characterStore: ReturnType<typeof useCharacterStore>) => void): void {
    initiativeCallback = cb;
  }

  /**
   * 初始化 Boss 专属功能（阶段管理器、出场演出）
   */
  function initBossFeatures(enemiesData: EnemyInstance[]): void {
    state.bossPhaseManagers.clear();
    const intros: Record<string, BossIntro> = {};
    for (const e of enemiesData) {
      if (e.isBoss && e.phases && e.phases.length > 0) {
        state.bossPhaseManagers.set(e.id, new BossPhaseManager());
      }
      if (e.isBoss && e.intro) {
        intros[e.id] = e.intro;
      }
    }
    state.bossIntros.value = intros;
  }

  /**
   * 按 Boss 等级缩放效果值（线性增长，公式：baseValue × (1 + (level-1) × 0.08)）
   * @param baseValue - 配置中的基础效果值
   * @param bossLevel - Boss 等级
   * @returns 缩放后的效果值
   */
  function scaleBossEffectValue(baseValue: number, bossLevel: number): number {
    return Math.floor(baseValue * (1 + (bossLevel - 1) * 0.08));
  }

  /**
   * 应用 Boss 机制的实际效果到玩家或敌人
   * @param e - Boss 敌人
   * @param mechType - 机制类型
   * @param phase - 当前阶段（用于获取参数）
   */
  function applyMechanicEffect(e: EnemyInstance, mechType: BossMechanicType, phase: BossPhase): void {
    const characterStore = useCharacterStore();
    const mechanic = phase.mechanics.find(m => m.type === mechType);
    const params = mechanic?.params || {};

    switch (mechType) {
      case 'stun_player': {
        const turns = Number(params?.turns) || 1;
        const stunEffect: Effect = {
          id: generateEffectId(),
          type: 'stun',
          remainingTurns: turns,
          value: 1,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(state.playerEffects.value, stunEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: false,
          message: `${characterStore.name} 被 ${e.name} 眩晕了 ${stunEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'silence_player': {
        const turns = Number(params?.turns) || 2;
        const silenceEffect: Effect = {
          id: generateEffectId(),
          type: 'silence',
          remainingTurns: turns,
          value: 1,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(state.playerEffects.value, silenceEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: false,
          message: `${characterStore.name} 被 ${e.name} 沉默了 ${silenceEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'debuff_aura': {
        const debuffType = String(params?.debuffType || 'attack_down');
        const baseValue = Number(params?.value) || 10;
        const turns = Number(params?.turns) || 3;
        const scaledValue = scaleBossEffectValue(baseValue, e.level);
        const debuffEffect: Effect = {
          id: generateEffectId(),
          type: debuffType as EffectType,
          remainingTurns: turns,
          value: scaledValue,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(state.playerEffects.value, debuffEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: false,
          message: `${characterStore.name} 受到 ${e.name} 的减益光环影响！`
        });
        break;
      }
      case 'aoe_attack': {
        // aoe_attack 标记已由 engine 设置，在 enemyAction 中通过 e.aoeNextAttack 读取
        // 这里记录日志即可
        break;
      }
      case 'summon_minions': {
        // summon_minions 标记已由 engine 设置，需要实际创建小怪
        const enemiesStore = useEnemyStore();
        const count = e.pendingSummons || 0;
        if (count > 0) {
          // 异步批量创建小怪，一次性重建先攻顺序
          (async () => {
            const newMinions: { id: string; name: string }[] = [];
            try {
              for (let i = 0; i < count; i++) {
                const minion = await enemiesStore.createEnemy('slime', e.level);
                if (minion) {
                  // 分配前排位置
                  const existingPos = Object.values(state.enemyPositions.value);
                  const usedCols = existingPos.filter(p => p.row === 'front').map(p => p.col);
                  const availableCol = [0, 1, 2].find(c => !usedCols.includes(c)) ?? 0;
                  state.enemyPositions.value = {
                    ...state.enemyPositions.value,
                    [minion.id]: { row: 'front', col: availableCol }
                  };
                  state.enemyIds.value.push(minion.id);
                  newMinions.push({ id: minion.id, name: minion.name });
                }
              }
              // 所有小怪创建完成后，一次性重建先攻顺序
              if (newMinions.length > 0) {
                if (initiativeCallback) {
                  initiativeCallback(characterStore);
                }
                for (const m of newMinions) {
                  log.addCombatLog({
                    actorType: 'system', actorId: 'system', actorName: '系统',
                    eventType: 'combat_event', targetType: 'enemy', targetId: m.id,
                    targetName: m.name, isCrit: false, isDodge: false,
                    message: `${e.name} 召唤了 ${m.name}！`
                  });
                }
              }
            } catch {
              console.warn(`[BossMechanics] ${e.name} 召唤小怪失败`);
            } finally {
              e.pendingSummons = 0;
            }
          })();
        }
        break;
      }
      case 'healing_zone': {
        const healAmount = Number(params?.healPerTurn) || 5;
        e.hp = Math.min(e.maxHp, e.hp + healAmount);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_heal', targetType: 'enemy', targetId: e.id,
          targetName: e.name, isCrit: false, isDodge: false,
          message: `${e.name} 从生命恢复区域恢复了 ${healAmount} 点生命值！`
        });
        break;
      }
      default:
        // 其他机制（enrage, damage_shield, reflect_damage 等）已在 engine 中处理
        break;
    }
  }

  return { initBossFeatures, applyMechanicEffect, scaleBossEffectValue, setInitiativeCallback };
}
