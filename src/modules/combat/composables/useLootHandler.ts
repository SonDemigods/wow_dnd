/**
 * @fileoverview 战利品处理 Composable（QA-9 拆分自 usePlayerAction.ts）
 *
 * 承载 handleLoot 函数的掉落判定与背包入袋逻辑：
 *   - DB-4：通过注入 Rng 支持确定性 RNG（用于测试与回放）
 *   - P2-4：校验 maxAmount >= minAmount，防止配置错误产生负数掉落数量
 *   - P2-2：检查 addItem 返回值，背包满时通过 EventBus 发射 INVENTORY_FULL 事件
 *   - BIZ-11：使用物品名称而非 itemId，与冒险日志保持一致
 *
 * 仅依赖 log（战斗日志）与 ctx（背包/冒险日志），无需 state/initiative/endCombat。
 */
import type { EnemyInstance } from '@/modules/enemy';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '@/modules/bus';
import { generateLogId } from '@/modules/log';
import { defaultRng, type Rng } from '@/utils/rng';
import type { useCombatLog } from './useCombatLog';

export function useLootHandler(
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 inventory.getItemInfo；写 inventory.addItem、log.addLogEntry）
  ctx: ICombatContext,
) {
  const { addCombatLog } = log;

  /**
   * 处理掉落（怪物与 Boss 均可配置 drops）
   * @param e - 敌人数据
   * @param rng - 随机数生成器，默认使用 defaultRng（DB-4 修复：支持注入确定性 RNG 用于测试与回放）
   */
  function handleLoot(e: EnemyInstance, rng: Rng = defaultRng): void {
    e.drops?.forEach(drop => {
      if (rng.bool(drop.dropRate)) {
        // P2-4：校验 maxAmount >= minAmount，防止配置错误产生负数掉落数量
        const span = Math.max(0, drop.maxAmount - drop.minAmount);
        const amount = rng.int(drop.minAmount, drop.minAmount + span);
        if (amount <= 0) return;

        // 获取物品模板信息
        const itemInfo = ctx.inventory.getItemInfo(drop.itemId);
        if (itemInfo) {
          // P2-2：检查 addItem 返回值，背包满时提示玩家
          // P2-42 修复：通过 EventBus 发射 INVENTORY_FULL 事件，由 UI 层监听并显示 toast，
          // 避免在 Composable 中直接调用 useToast 引入 UI 副作用
          const actualAmount = ctx.inventory.addItem(drop.itemId, amount);
          if (actualAmount < amount) {
            eventBus.emit(GameEvents.INVENTORY_FULL, {
              itemName: itemInfo.name,
              actualAmount,
              expectedAmount: amount,
            });
          }

          // BIZ-11：使用物品名称而非 itemId，与冒险日志保持一致
          // name 为空时回退到 itemId（防御性处理，正常配置不会出现空名称）
          const itemName = itemInfo.name || drop.itemId;
          addCombatLog({
            actorType: 'system',
            actorId: 'system',
            actorName: '系统',
            eventType: 'combat_item',
            isCrit: false,
            isDodge: false,
            message: `获得物品 ${itemName} x${actualAmount}！`
          });

          // 记录战利品到冒险日志
          ctx.log.addLogEntry({
            id: generateLogId(),
            timestamp: Date.now(),
            type: 'item',
            message: `从 ${e.name} 获得 ${itemName} x${actualAmount}`,
            icon: 'game-icons:backpack'
          });
        } else {
          // P8-104 修复：掉落物品模板缺失时记录告警，避免静默丢弃
          addCombatLog({
            actorType: 'system',
            actorId: 'system',
            actorName: '系统',
            eventType: 'combat_item',
            isCrit: false,
            isDodge: false,
            message: `掉落物品模板缺失：${drop.itemId}`,
          });
        }
      }
    });
  }

  return { handleLoot };
}
