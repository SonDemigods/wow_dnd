/**
 * @fileoverview 探索类控制台命令（exploration category）
 * @description 包含探索状态与传送命令：
 *   resetExplore - 重置当前区域的探索状态
 *   goto        - 传送到指定地点
 *   revealAll   - 揭示当前探索区域的所有格子
 * @module console/commands/exploration
 */
import { useExplorationStore } from '@/modules/exploration';
import { useMapStore } from '@/modules/map';
import { CONTINENTS } from '@/data/config_locations';
import { registerCommand, logTag, STYLE } from '../framework';

/**
 * 重置探索
 *
 * 重置当前区域的探索状态，所有已揭示的格子恢复为未探索。
 *
 * @see useExplorationStore().reset
 */
registerCommand({
  name: 'resetExplore',
  category: 'exploration',
  description: '重置当前区域的探索状态',
  usage: 'resetExplore',
  handler() {
    useExplorationStore().reset();
    return { success: true, message: '探索状态已重置' };
  }
});

/**
 * 传送到指定地点
 *
 * 将角色传送到指定地点 ID，跨大陆传送。
 * 无参数时列出所有可用地点。
 *
 * @param {string[]} args - args[0] 为地点 ID（空则列出可用列表）
 *
 * @see useMapStore().enterZone
 */
registerCommand({
  name: 'goto',
  category: 'exploration',
  description: '传送到指定地点',
  usage: 'goto <地点ID>',
  handler(args) {
    if (args.length === 0) {
      // P3-117 修复：动态遍历所有大陆获取地点，不再硬编码 'kalimdor'/'eastern_kingdoms'/'northrend'
      const mapStore = useMapStore();
      const allLocations = CONTINENTS.flatMap(
        continent => mapStore.getLocationsByContinent(continent.id)
      );
      logTag('goto', '═══ 可用地点 ═══');
      for (const loc of allLocations) {
        console.log(`  %c${loc.id.padEnd(24)}%c ${loc.name}`, STYLE.label, STYLE.value);
      }
      return { success: true, message: '已在上方列出所有可用地点' };
    }

    const locationId = args[0];
    const success = useMapStore().enterZone(locationId);
    if (success) {
      return { success: true, message: `已传送到 ${locationId}` };
    }
    return { success: false, message: `未找到地点: ${locationId}，输入 goto 查看可用列表` };
  }
});

/**
 * 揭示当前探索区域所有格子
 *
 * 将当前探索区域的所有格子标记为已揭示状态。
 * 需确保当前处于探索中（isExploring 为 true）。
 *
 * @see useExplorationStore().revealAllCells
 */
registerCommand({
  name: 'revealAll',
  category: 'exploration',
  description: '揭示当前探索区域的所有格子',
  usage: 'revealAll',
  async handler() {
    if (!useExplorationStore().isExploring) {
      return { success: false, message: '当前没有在探索中' };
    }
    await useExplorationStore().revealAllCells();
    return { success: true, message: '所有探索格子已揭示' };
  }
});

/** 命令模块标记导出，便于汇总注册器识别 */
export const __explorationCommandsLoaded = true;
