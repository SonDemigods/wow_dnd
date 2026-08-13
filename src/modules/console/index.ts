/**
 * @fileoverview 控制台命令模块统一导出入口
 * @description
 * 控制台模块（console）提供游戏内开发与调试用的命令行工具，挂载到 window.cmd。
 *
 * 模块架构（拆分自原单文件 console.ts，QA-7）：
 *   framework.ts        —— 框架核心：类型定义、注册表、exec / initConsole、公共辅助
 *   commands/           —— 命令实现子模块，按类别组织：
 *     character.ts        stats/gold/exp/hp/mp/heal/level/resurrect/buff/resetChar
 *     inventory.ts        item/bag/clearBag/equips
 *     combat.ts           spawn/win/flee/kill
 *     skill.ts            skills
 *     exploration.ts      resetExplore/goto/revealAll
 *     quest.ts            quests
 *     system.ts           admin/game/help/shops/log
 *
 * 使用方式：
 *   import { initConsole, exec } from '@/modules/console';
 *   initConsole();          // 挂载到 window.cmd
 *   cmd.gold(100);          // 浏览器 DevTools 调用
 *   await exec('help');     // 字符串形式调用
 *
 * @module console
 */
// 导入 commands/index.ts 触发所有命令的 registerCommand() 调用，
// 必须在导出 exec/initConsole 之前完成，确保 initConsole 调用时所有命令已注册。
import './commands';

// 重导出框架公共 API（保持外部引用兼容，原 console.ts 的导出签名不变）
export { exec, initConsole } from './framework';
export type { CommandResult, CommandDef, CommandCategory } from './framework';
