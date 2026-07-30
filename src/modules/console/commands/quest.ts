/**
 * @fileoverview 任务类控制台命令（quest category）
 * @description 包含任务查看与操作命令：
 *   quests - 查看任务状态或操作任务（accept/complete/abandon）
 * @module console/commands/quest
 */
import { useQuestStore } from '@/modules/quest';
import { registerCommand, logTag, STYLE } from '../framework';

/**
 * 任务管理
 *
 * 无参数：列出进行中、可接、已完成待提交的任务。
 * 有参数：执行 accept（接取）/ complete（提交）/ abandon（放弃）任务操作。
 *
 * @param {string[]} args - args[0] 为操作类型（accept/complete/abandon），args[1] 为任务 ID
 *
 * @see useQuestStore().acceptQuest
 * @see useQuestStore().claimReward
 * @see useQuestStore().abandonQuest
 */
registerCommand({
  name: 'quests',
  category: 'quest',
  description: '查看任务状态或操作任务',
  usage: 'quests [accept|complete|abandon <任务ID>]',
  async handler(args) {
    if (args.length === 0) {
      const available = useQuestStore().availableQuests;
      const inProgress = useQuestStore().activeQuests;
      const completed = useQuestStore().completedQuests;

      if (available.length === 0 && inProgress.length === 0 && completed.length === 0) {
        return { success: true, message: '当前没有任何任务' };
      }

      if (inProgress.length > 0) {
        logTag('quests', '═══ 进行中的任务 ═══');
        for (const instance of inProgress) {
          const def = useQuestStore().getQuestDefinition(instance.questId);
          console.log(`  %c${instance.questId.padEnd(24)}%c ${def?.title || instance.questId} %c${JSON.stringify(instance.progress)}`, STYLE.label, STYLE.value, STYLE.hint);
        }
      }

      if (available.length > 0) {
        logTag('quests', '═══ 可接任务 ═══');
        for (const def of available) {
          console.log(`  %c${def.id.padEnd(24)}%c ${def.title}`, STYLE.label, STYLE.value);
        }
      }

      if (completed.length > 0) {
        logTag('quests', '═══ 已完成（可提交）═══');
        for (const instance of completed) {
          const def = useQuestStore().getQuestDefinition(instance.questId);
          console.log(`  %c${instance.questId.padEnd(24)}%c ${def?.title || instance.questId}`, STYLE.label, STYLE.value);
        }
      }

      return { success: true, message: '已在上方显示任务列表' };
    }

    const action = args[0].toLowerCase();
    const questId = args[1];

    if (!questId) {
      return { success: false, message: '请指定任务ID' };
    }

    switch (action) {
      case 'accept': {
        const ok = await useQuestStore().acceptQuest(questId);
        if (ok) {
          return { success: true, message: `已接受任务: ${questId}` };
        }
        return { success: false, message: `无法接受任务: ${questId}` };
      }
      case 'complete': {
        const ok = await useQuestStore().claimReward(questId);
        if (ok) {
          return { success: true, message: `已提交任务: ${questId}` };
        }
        return { success: false, message: `无法提交任务: ${questId}（可能尚未完成）` };
      }
      case 'abandon': {
        const ok = await useQuestStore().abandonQuest(questId);
        if (ok) {
          return { success: true, message: `已放弃任务: ${questId}` };
        }
        return { success: false, message: `无法放弃任务: ${questId}` };
      }
      default:
        return { success: false, message: `无效操作: ${action}，可选: accept/complete/abandon` };
    }
  }
});

/** 命令模块标记导出，便于汇总注册器识别 */
export const __questCommandsLoaded = true;
