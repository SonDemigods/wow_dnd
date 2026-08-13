/**
 * @fileoverview 战斗类控制台命令（combat category）
 * @description 包含战斗生成与控制命令：
 *   spawn - 生成敌人并进入战斗
 *   win   - 强制结束当前战斗（胜利）
 *   flee  - 强制结束当前战斗（逃跑）
 *   kill  - 使当前敌人立即死亡
 * @module console/commands/combat
 */
import { useEnemyStore } from '@/modules/enemy';
import { useCombatStore } from '@/modules/combat';
import { adminQueryService } from '@/modules/admin';
import { CONSOLE_KILL_DAMAGE } from '@/config/combat'; // P8-301
import {
  registerCommand,
  logTag,
  STYLE,
  type CommandResult
} from '../framework';

// ============================================================
// 战斗生成
// ============================================================

/**
 * 生成敌人并进入战斗
 *
 * 根据敌人 ID 创建敌人实例并立即进入战斗。
 * 无参数时列出所有可用怪物和 Boss 模板。
 *
 * @param {string[]} args - args[0] 为敌人 ID（空则列出可用列表）
 *
 * @see useEnemyStore().createEnemy
 * @see useCombatStore().startCombat
 */
registerCommand({
  name: 'spawn',
  category: 'combat',
  description: '生成敌人并进入战斗',
  usage: 'spawn <敌人ID>',
  async handler(args) {
    if (args.length === 0) {
      // CHR-5 修复：通过 AdminQueryService 收口跨模块 DbService 查询
      const { mobs, bosses } = await adminQueryService.queryAllEnemyTemplates();
      logTag('spawn', '═══ 普通怪物 ═══');
      for (const data of mobs) {
        console.log(`  %c${data.id.padEnd(22)}%c ${data.name} %c(HP:${data.maxHp})`, STYLE.label, STYLE.value, STYLE.hint);
      }
      logTag('spawn', '═══ Boss ═══');
      for (const data of bosses) {
        console.log(`  %c${data.id.padEnd(22)}%c ${data.name} %c(HP:${data.maxHp})`, STYLE.label, STYLE.value, STYLE.hint);
      }
      return { success: true, message: '已在上方列出所有可用怪物和Boss' };
    }

    const enemyId = args[0];
    try {
      const enemy = await useEnemyStore().createEnemy(enemyId);
      if (!enemy) {
        return { success: false, message: `未找到敌人: ${enemyId}，输入 spawn 查看可用列表` };
      }
      await useCombatStore().startCombat([enemy]);
      return { success: true, message: `已生成 ${enemy.name} (HP:${enemy.hp}) 并进入战斗` };
    } catch {
      return { success: false, message: `未找到敌人: ${enemyId}，输入 spawn 查看可用列表` };
    }
  }
});

// ============================================================
// 战斗控制
// ============================================================

/**
 * 强制结束当前战斗辅助函数
 *
 * 检查战斗状态后调用 endCombat() 结束战斗。
 * 供 win 和 flee 命令复用公共逻辑。
 *
 * @param {'victory' | 'fled'} result - 战斗结果类型
 * @param {string} msg - 成功消息
 * @returns {CommandResult} 执行结果
 *
 * @see useCombatStore().endCombat
 * @see win 命令
 * @see flee 命令
 */
function endCombatCmd(result: 'victory' | 'fled', msg: string): CommandResult {
  if (!useCombatStore().isInCombat) {
    return { success: false, message: '当前没有在战斗中' };
  }
  useCombatStore().endCombat(result);
  return { success: true, message: msg };
}

/**
 * 结束当前战斗（强制胜利）
 *
 * 立即以胜利结果结束当前战斗，视为玩家击败了所有敌人。
 */
registerCommand({
  name: 'win',
  category: 'combat',
  description: '强制结束当前战斗（胜利）',
  usage: 'win',
  handler() {
    return endCombatCmd('victory', '战斗已强制胜利');
  }
});

/**
 * 结束当前战斗（逃跑）
 *
 * 立即以逃跑结果结束当前战斗，不获得战利品和经验值。
 */
registerCommand({
  name: 'flee',
  category: 'combat',
  description: '强制结束当前战斗（逃跑）',
  usage: 'flee',
  handler() {
    return endCombatCmd('fled', '已从战斗中逃跑');
  }
});

/**
 * 敌人立即死亡
 *
 * 对当前战斗目标造成致命伤害使其立即死亡。
 * 优先使用 currentTarget（当前选中目标），无目标时返回失败。
 * P8-304 修复：多敌人战斗中仅击杀目标不结束战斗，全部敌人死亡才胜利。
 *
 * @see useCombatStore().currentTarget
 * @see useCombatStore().aliveEnemies
 * @see useEnemyStore().takeDamage
 */
registerCommand({
  name: 'kill',
  category: 'combat',
  description: '使当前敌人立即死亡',
  usage: 'kill',
  async handler() {
    if (!useCombatStore().isInCombat) {
      return { success: false, message: '当前没有在战斗中' };
    }
    const enemy = useCombatStore().currentTarget;
    if (!enemy) {
      return { success: false, message: '没有存活的敌人' };
    }
    // P8-301 修复：await takeDamage 确保伤害结算完成后再判断战斗结果
    await useEnemyStore().takeDamage(enemy.id, CONSOLE_KILL_DAMAGE);
    // P8-304 修复：检查是否仍有存活敌人，多敌人战斗中仅击杀目标不强制胜利
    if (useCombatStore().aliveEnemies.length > 0) {
      return { success: true, message: `${enemy.name} 已被消灭（${enemy.id}），仍有存活敌人` };
    }
    await useCombatStore().endCombat('victory');
    return { success: true, message: `${enemy.name} 已被消灭（${enemy.id}）` };
  }
});

/** 命令模块标记导出，便于汇总注册器识别 */
export const __combatCommandsLoaded = true;
