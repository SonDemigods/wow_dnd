/**
 * @fileoverview 天赋类控制台命令（character category）
 * @description 包含天赋查看与分配命令：
 *   talent          - 查看天赋面板（剩余点数、各系投入、已学节点）
 *   talent learn    - 学习一级天赋
 *   talent unlearn  - 取消一级天赋
 *   talent reset    - 重置所有天赋分配
 * @module console/commands/talent
 */
import { useTalentStore } from '@/modules/character/talents';
import { registerCommand, requireCharacter, logTag, STYLE } from '../framework';

/**
 * 天赋管理
 *
 * 无参数：列出天赋面板（剩余点数、各系投入、已学节点列表）。
 * learn <id>：学习一级指定天赋。
 * unlearn <id>：取消一级指定天赋。
 * reset：重置所有天赋分配（免费）。
 *
 * @param {string[]} args - 子命令与参数
 */
registerCommand({
  name: 'talent',
  category: 'character',
  description: '查看/学习/取消/重置天赋',
  usage: 'talent [learn|unlearn|reset] [天赋ID]',
  async handler(args) {
    const req = requireCharacter();
    if (!req.ok) return req.result;

    const talentStore = useTalentStore();
    const sub = args[0];

    // ---- 子命令：learn <id> ----
    if (sub === 'learn') {
      const talentId = args[1];
      if (!talentId) {
        return { success: false, message: '用法：talent learn <天赋ID>' };
      }
      const ok = talentStore.learn(talentId);
      if (ok) {
        return { success: true, message: `已学习天赋 ${talentId}（当前等级 ${talentStore.getTalentRank(talentId)}）` };
      }
      return { success: false, message: `无法学习天赋 ${talentId}（点数不足/未解锁/前置未学/已达上限）` };
    }

    // ---- 子命令：unlearn <id> ----
    if (sub === 'unlearn') {
      const talentId = args[1];
      if (!talentId) {
        return { success: false, message: '用法：talent unlearn <天赋ID>' };
      }
      const ok = talentStore.unlearn(talentId);
      if (ok) {
        return { success: true, message: `已取消天赋 ${talentId}（当前等级 ${talentStore.getTalentRank(talentId)}）` };
      }
      return { success: false, message: `无法取消天赋 ${talentId}（未学习或等级为 0）` };
    }

    // ---- 子命令：reset ----
    if (sub === 'reset') {
      talentStore.resetAllAllocations();
      return { success: true, message: '已重置所有天赋分配，点数已全额返还' };
    }

    // ---- 默认：显示天赋面板 ----
    logTag('talent', `剩余 ${talentStore.availablePoints}/${talentStore.totalPoints} 点  已投入 ${talentStore.spentPoints} 点`);

    const trees = talentStore.talentTrees;
    if (trees.length === 0) {
      return { success: false, message: '未找到当前职业的天赋树数据' };
    }

    for (const tree of trees) {
      logTag('talent', `═══ ${tree.name} ═══`);
      for (let tier = 1; tier <= 6; tier++) {
        const tierNodes = tree.talents.filter(t => t.tier === tier);
        if (tierNodes.length === 0) continue;
        for (const node of tierNodes) {
          const rank = talentStore.getTalentRank(node.id);
          const colLabel = node.col ? `[${node.col}]` : '';
          const rankStr = rank > 0
            ? `%c${rank}/${node.maxRank}%c`
            : `%c0/${node.maxRank}%c`;
          const style = rank > 0 ? STYLE.value : STYLE.hint;
          console.log(
            `  T${tier}${colLabel} %c${node.id.padEnd(28)}%c ${node.name} ${rankStr}`,
            STYLE.label, style, style, STYLE.hint
          );
        }
      }
    }

    return { success: true, message: '已在上方显示天赋面板' };
  }
});

/** 命令模块标记导出，便于汇总注册器识别 */
export const __talentCommandsLoaded = true;
