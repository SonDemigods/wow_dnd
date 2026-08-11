/**
 * @fileoverview 控制台命令框架核心
 * @description 提供命令注册表、解析执行器、初始化器与公共辅助函数。
 *              命令的具体实现按类别拆分到 commands/ 子模块，由 commands/index.ts 统一注册。
 *
 * 框架职责：
 *   1. 类型定义：CommandResult / CommandDef / CommandCategory
 *   2. 注册表：commands Map + registerCommand
 *   3. 解析执行：exec(input) —— 字符串解析 → 命令查找 → handler 调用 → 结果输出
 *   4. 初始化：initConsole() —— 将命令挂载到 window.cmd
 *   5. 公共辅助：requireCharacter / switchGameState / logTag / rarityColorKey / resolveCategory
 *
 * @module console/framework
 */
import { useCharacterStore } from '@/modules/character';
import type { Character } from '@/modules/character';
import { CONSOLE_STYLE as STYLE } from '@/config/console-style';

/**
 * 控制台样式常量（重导出供命令子模块复用）
 *
 * 原始定义在 @/config/console-style，此处以 STYLE 别名暴露，
 * 命令子模块可统一从 framework 导入，避免重复引用配置层。
 */
export { STYLE };

// ============================================================
// 类型定义
// ============================================================

/**
 * 命令执行结果接口
 *
 * 所有控制台命令 handler 的返回值，用于统一展示执行状态和提示信息。
 * exec() 函数根据 success 字段选择 console.log（绿色）或 console.warn（红色）输出。
 *
 * @property {boolean} success - 命令是否执行成功
 * @property {string} message - 执行结果描述，失败时为错误原因
 */
export interface CommandResult {
  success: boolean;
  message: string;
}

/**
 * 命令类别联合类型
 *
 * 用于 help 命令的分类展示和按类别筛选。
 * 内部使用英文 key（更易维护、避免编码问题），UI 显示通过 COMMAND_CATEGORY_LABELS 映射为中文。
 */
export type CommandCategory = 'character' | 'combat' | 'item' | 'exploration' | 'system' | 'skill' | 'quest';

/**
 * 命令类别中文显示映射表
 *
 * 将英文 CommandCategory key 映射为 help 输出中展示的中文标题。
 * 新增类别时需同步在此映射表追加对应中文标签。
 */
export const COMMAND_CATEGORY_LABELS: Record<CommandCategory, string> = {
  character: '角色',
  combat: '战斗',
  item: '物品',
  exploration: '探索',
  system: '系统',
  skill: '技能',
  quest: '任务'
};

/**
 * 命令定义接口
 *
 * 声明式命令注册的数据结构，通过 registerCommand() 注册到 commands Map 中。
 * name 同时作为 window.cmd 对象的属性键和 exec() 的路由键。
 *
 * @property {string} name - 命令名称（注册时统一转小写），同时作为 window.cmd 的调用键和 usage 的展示名称
 * @property {CommandCategory} category - 命令所属类别，影响 help 输出中的分组
 * @property {string} description - 命令功能简述，在 help 列表和详细帮助中展示
 * @property {string} usage - 命令用法示例，展示在 help 列表中（如 "gold <数量>"）
 * @property {Function} handler - 命令执行函数，接收 args 字符串数组，返回同步或异步的 CommandResult
 *
 * @see registerCommand 命令注册函数
 * @see exec 命令执行入口
 */
export interface CommandDef {
  name: string;
  category: CommandCategory;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<CommandResult> | CommandResult;
}

// ============================================================
// 命令注册表
// ============================================================

/**
 * 命令注册表
 *
 * 以 name 的小写形式为键的 Map，存储所有已注册的 CommandDef。
 * registerCommand() 向此 Map 添加命令，exec() 从此 Map 查找命令。
 *
 * @see registerCommand 注册新命令
 * @see exec 查找并执行命令
 */
export const commands = new Map<string, CommandDef>();

/**
 * 注册一个控制台命令
 *
 * 将 CommandDef 以 name 的小写形式为键存入 commands Map，供 exec() 路由。
 * exec() 会将用户输入的命令名转为小写后查找，此处统一以小写为键保证匹配。
 * 命令子模块在加载时通过 registerCommand() 调用注册各类别命令。
 *
 * 注意：window.cmd 上的方法名保留原始 camelCase（见 initConsole），仅注册键使用小写。
 *
 * @param {CommandDef} def - 命令定义对象
 */
export function registerCommand(def: CommandDef): void {
  commands.set(def.name.toLowerCase(), def);
}

/**
 * 获取命令注册表（仅供命令子模块在注册时遍历使用）
 *
 * help 命令与 initConsole 通过此 Map 读取所有命令。
 */
export function getCommands(): Map<string, CommandDef> {
  return commands;
}

// ============================================================
// 展示辅助
// ============================================================

/**
 * 根据稀有度字符串返回对应的 CSS 颜色样式
 *
 * @param {string} rarity - 稀有度标识（common/uncommon/rare/epic/legendary）
 * @returns {string} 对应稀有度的 CSS 颜色字符串，未匹配时返回默认 STYLE.value
 */
export function rarityColorKey(rarity: string): string {
  const map: Record<string, string> = {
    // common: STYLE.rarity.common,
    uncommon: STYLE.rarity.uncommon,
    rare: STYLE.rarity.rare,
    epic: STYLE.rarity.epic,
    legendary: STYLE.rarity.legendary
  };
  return map[rarity] || STYLE.value;
}

/**
 * 输出带橙色标签的标题行
 *
 * 格式: `[cmd] 标题文本`，其中 [cmd] 为橙色标签样式。
 * 用于各命令在控制台输出分组标题。
 *
 * @param {string} cmd - 命令名称，显示在标签中
 * @param {string} text - 标题文本
 */
export function logTag(cmd: string, text: string): void {
  console.log(`%c[${cmd}]%c ${text}`, STYLE.tag, STYLE.section);
}

/**
 * 解析用户输入的类别字符串为 CommandCategory
 *
 * help 命令按类别筛选时使用，兼容英文 key（'character'）和中文 label（'角色'）。
 * 匹配失败时返回 undefined，调用方可据此给出错误提示。
 *
 * @param {string} input - 用户输入字符串
 * @returns {CommandCategory | undefined} 匹配到的类别 key，无匹配时 undefined
 */
export function resolveCategory(input: string): CommandCategory | undefined {
  // P3 TS-17 审计决策（2026-07-31）：Object.keys 返回 string[]，TS 语言限制无法静态推断为 CommandCategory[]。
  // COMMAND_CATEGORY_LABELS 的键已由类型保证为 CommandCategory，断言是合理 workaround。
  return (Object.keys(COMMAND_CATEGORY_LABELS) as CommandCategory[]).find(
    k => k === input || COMMAND_CATEGORY_LABELS[k] === input
  );
}

// ============================================================
// 公共业务辅助
// ============================================================

/**
 * 获取当前角色数据的辅助函数
 *
 * 消除各命令中重复的 info! 非空断言（CODE-11/CODE-35）。
 * 内部调用 useCharacterStore().getCharacterData() 并做 null 检查，
 * 调用方根据返回值判别后即可获得类型已收窄的 Character。
 *
 * @returns 成功时 { ok: true, character }；角色不存在时 { ok: false, result }
 */
export function requireCharacter():
  | { ok: true; character: Character }
  | { ok: false; result: CommandResult } {
  const info = useCharacterStore().getCharacterData();
  if (!info) {
    return { ok: false, result: { success: false, message: '当前没有选中角色' } };
  }
  return { ok: true, character: info };
}

/**
 * 切换游戏状态辅助函数
 *
 * 修改 window.__gameState.value 来切换游戏界面状态。
 * 供 admin 和 game 命令复用公共逻辑。
 *
 * @param {string} target - 目标状态值（'admin' | 'character-select'）
 * @param {string} msg - 成功消息
 * @returns {CommandResult} 执行结果
 *
 * @see admin 命令
 * @see game 命令
 */
export function switchGameState(target: string, msg: string): CommandResult {
  // P3 TS-12 修复：window.__gameState 类型由 App.vue 的 declare global 声明为 Ref<GameState>，
  // 直接访问即可，无需重新断言。target 来自命令参数，运行时 switch 命令已校验合法值。
  const gs = window.__gameState;
  if (!gs) {
    return { success: false, message: 'gameState 未初始化，请等待游戏加载完成' };
  }
  gs.value = target as 'character-select' | 'game' | 'admin';
  return { success: true, message: msg };
}

// ============================================================
// 解析执行器
// ============================================================

/**
 * 执行控制台命令（字符串形式）
 *
 * 解析输入字符串，查找注册的命令并执行其 handler。
 * 执行成功时以绿色标签输出结果，失败时以红色标签输出，异常时以错误标签输出。
 *
 * @param {string} input - 命令字符串（格式: "命令名 参数1 参数2 ..."）
 * @returns {Promise<CommandResult>} 命令执行结果
 *
 * @see initConsole window.cmd 的包装函数最终调用此函数
 */
export async function exec(input: string): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, message: '请输入命令' };
  }

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = commands.get(cmdName);
  if (!cmd) {
    return { success: false, message: `未知命令: ${cmdName}，输入 cmd.help() 查看可用命令` };
  }

  try {
    const result = await cmd.handler(args);
    if (result.success) {
      console.log(`%c[${cmdName}]%c ${result.message}`, STYLE.tag, STYLE.ok);
    } else {
      console.warn(`%c[${cmdName}]%c ${result.message}`, STYLE.tag, STYLE.err);
    }
    return result;
  } catch (e) {
    const msg = `命令执行出错: ${e instanceof Error ? e.message : String(e)}`;
    console.error(`%c[${cmdName}]%c ${msg}`, STYLE.tag, STYLE.err);
    return { success: false, message: msg };
  }
}

/**
 * 初始化控制台命令，挂载到 window.cmd 全局对象
 *
 * 遍历 commands Map，将每个命令包装为一个接收任意参数的函数挂载到 window.cmd 上。
 * 包装函数将参数转为字符串后调用 exec() 执行命令。
 *
 * 挂载后的调用示例:
 *   cmd.gold(100)         → exec("gold 100")
 *   cmd.spawn('goblin')   → exec("spawn goblin")
 *   cmd.exec("help")      → exec("help")
 *
 * 注意：window.cmd 的方法名保留命令定义中的原始 name（camelCase），如 `cmd.revealAll()`；
 * 内部 exec() 路由时统一转小写匹配注册键，因此注册名与调用名大小写均可命中。
 *
 * @see exec 底层命令执行函数
 * @see commands 命令注册表
 */
export function initConsole(): void {
  const cmdObj: Record<string, (...args: unknown[]) => Promise<CommandResult> | CommandResult> = {};

  for (const [, cmd] of commands) {
    // 使用原始名称（驼峰命名）作为 cmdObj 的 key，保持 cmd.revealAll() 的调用方式
    cmdObj[cmd.name] = (...args: unknown[]) => {
      const strArgs = args.map(a => String(a));
      return exec(`${cmd.name} ${strArgs.join(' ')}`.trim());
    };
  }

  (cmdObj as Record<string, unknown>).exec = exec;

  (window as Window & { cmd?: typeof cmdObj }).cmd = cmdObj;

  console.log(
    '%c[cmd]%c 控制台命令已加载，输入 %ccmd.help()%c 查看所有命令',
    STYLE.tag, STYLE.ok,
    'color: #ffd700; font-weight: bold', STYLE.ok
  );
}
