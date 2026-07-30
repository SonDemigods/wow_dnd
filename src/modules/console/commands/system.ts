/**
 * @fileoverview 系统类控制台命令（system category）
 * @description 包含后台管理、帮助、商店、日志命令：
 *   admin - 进入游戏后台管理系统
 *   game  - 从后台返回游戏界面
 *   help  - 显示所有可用命令（可按类别筛选）
 *   shops - 查看可用商店列表
 *   log   - 查看最近冒险日志
 * @module console/commands/system
 */
import { useShopStore } from '@/modules/shop';
import { useLogStore } from '@/modules/log';
import {
  registerCommand,
  switchGameState,
  resolveCategory,
  logTag,
  getCommands,
  COMMAND_CATEGORY_LABELS,
  STYLE,
  type CommandDef,
  type CommandCategory
} from '../framework';

// ============================================================
// 系统控制
// ============================================================

/**
 * 进入后台管理系统
 *
 * 将游戏状态切换至后台管理界面，用户可进行数据管理操作。
 * 输入 cmd.game() 可返回游戏界面。
 */
registerCommand({
  name: 'admin',
  category: 'system',
  description: '进入游戏后台管理系统',
  usage: 'admin',
  handler() {
    return switchGameState('admin', '已进入后台管理系统，输入 cmd.game() 返回游戏');
  }
});

/**
 * 返回游戏界面
 *
 * 从后台管理系统切换回角色选择界面。
 */
registerCommand({
  name: 'game',
  category: 'system',
  description: '从后台返回游戏界面',
  usage: 'game',
  handler() {
    return switchGameState('character-select', '已返回游戏界面');
  }
});

// ============================================================
// 帮助与信息
// ============================================================

/**
 * 帮助命令
 *
 * 无参数时按类别分组列出所有命令；传入类别名则筛选该类别下的命令；
 * 传入命令名则显示该命令的详细用法。
 *
 * @param {string[]} args - 可选参数: [类别名 | 命令名]
 * @returns {CommandResult}
 */
registerCommand({
  name: 'help',
  category: 'system',
  description: '显示所有可用命令（可按类别筛选）',
  usage: 'help [类别|命令名]',
  handler(args) {
    const commands = getCommands();
    if (args.length > 0) {
      const cmd = commands.get(args[0].toLowerCase());
      if (cmd) {
        return {
          success: true,
          message: `${cmd.name} [${COMMAND_CATEGORY_LABELS[cmd.category]}] — ${cmd.description}\n用法: ${cmd.usage}`
        };
      }
      // 按类别筛选：兼容英文 key 和中文 label
      const matchCategory = resolveCategory(args[0]);
      if (matchCategory) {
        const categoryCmds = [...commands.values()].filter(c => c.category === matchCategory);
        for (const c of categoryCmds) {
          console.log(`%c[help]%c  %c${c.usage.padEnd(32)}%c ${c.description}`, STYLE.tag, STYLE.label, STYLE.value, STYLE.hint);
        }
        return { success: true, message: `已在上方列出「${COMMAND_CATEGORY_LABELS[matchCategory]}」类别命令` };
      }
      return { success: false, message: `未知命令或类别: ${args[0]}` };
    }

    const categories = new Map<CommandCategory, CommandDef[]>();
    for (const cmd of commands.values()) {
      let list = categories.get(cmd.category);
      if (!list) {
        list = [];
        categories.set(cmd.category, list);
      }
      list.push(cmd);
    }

    for (const [cat, cmds] of categories) {
      logTag('help', `═══ ${COMMAND_CATEGORY_LABELS[cat]} ═══`);
      for (const cmd of cmds) {
        console.log(`  %c${cmd.usage.padEnd(32)}%c ${cmd.description}`, STYLE.label, STYLE.hint);
      }
    }
    console.log(`%c提示: help <类别> 按类别筛选，help <命令名> 查看详细用法`, STYLE.hint);
    return { success: true, message: '已在上方按类别分组显示' };
  }
});

// ============================================================
// 商店与日志
// ============================================================

/**
 * 商店管理
 *
 * 列出所有可用商店及其 ID、名称和类型。
 *
 * @see useShopStore().init
 */
registerCommand({
  name: 'shops',
  category: 'system',
  description: '查看可用商店列表',
  usage: 'shops',
  async handler() {
    await useShopStore().init();
    const shops = useShopStore().shops;
    if (shops.length === 0) {
      return { success: true, message: '没有可用商店' };
    }
    logTag('shops', '═══ 可用商店 ═══');
    for (const shop of shops) {
      console.log(`  %c${shop.id.padEnd(24)}%c ${shop.name} %c[${shop.type}]`, STYLE.label, STYLE.value, STYLE.hint);
    }
    return { success: true, message: '已在上方列出所有商店' };
  }
});

/**
 * 查看冒险日志
 *
 * 显示最近 N 条冒险日志，可按日志类型筛选。
 * 日志类型包括: info/combat/quest/item/level/death/resurrect/shop/skill/exploration/zone。
 *
 * @param {string[]} args - args[0] 为数量（默认 10），args[1] 为日志类型筛选
 *
 * @see useLogStore().getLogs
 * @see useLogStore().getLogsByType
 */
registerCommand({
  name: 'log',
  category: 'system',
  description: '查看最近冒险日志',
  usage: 'log [数量] [类型]  (类型: combat/quest/item/level/info)',
  handler(args) {
    const count = args[0] ? parseInt(args[0], 10) : 10;
    // P3-118 修复：添加 NaN 校验，避免无效参数导致后续 slice 异常
    if (isNaN(count) || count <= 0) {
      return { success: false, message: '数量必须为正整数' };
    }
    const logTypes = ['info', 'combat', 'quest', 'item', 'level', 'death', 'resurrect', 'shop', 'skill', 'exploration', 'zone'] as const;
    const filterType = logTypes.includes(args[1] as typeof logTypes[number]) ? (args[1] as typeof logTypes[number]) : undefined;

    let logs = useLogStore().getLogs();
    if (filterType) {
      logs = useLogStore().getLogsByType(filterType);
    }
    const recent = logs.slice(0, Math.min(count, logs.length));

    if (recent.length === 0) {
      return { success: true, message: filterType ? `没有 "${filterType}" 类型的日志` : '冒险日志为空' };
    }

    logTag('log', `═══ 冒险日志 (最近${Math.min(count, logs.length)}条) ═══`);
    for (const entry of recent) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      console.log(`  %c[${time}]%c ${entry.icon || ''} ${entry.message}`, STYLE.hint, STYLE.value);
    }
    return { success: true, message: `共 ${useLogStore().logCount} 条日志` };
  }
});

/** 命令模块标记导出，便于汇总注册器识别 */
export const __systemCommandsLoaded = true;
