/**
 * @fileoverview 控制台命令模块
 * @description 提供游戏内控制台命令的注册与执行，方便开发和测试。
 *              调用 initConsole() 后，所有命令挂载到 window.cmd 对象，
 *              可在浏览器 DevTools 中直接使用，例如：
 *                cmd.gold(100)          — 添加100金币
 *                cmd.spawn('goblin')     — 生成敌人并进入战斗
 *                cmd.help()             — 查看所有命令
 * @module console
 */
import { useCharacterStore } from './character';
import type { Character } from './character';
import { useInventoryStore } from './inventory';
import { useEnemyStore } from './enemy';
import { useCombatStore } from './combat';
import { useExplorationStore } from './exploration';
import { useMapStore } from './map';
import { useSkillStore } from './skill';
import { useEquipmentStore } from './equipment';
import { useShopStore } from './shop';
import { useQuestStore } from './quest';
import { useLogStore } from './log';
// CHR-5 修复：控制台命令的数据查询收口到 AdminQueryService，
// 不再直接依赖 enemy/boss/inventory/equipment 的 DbService。
import { adminQueryService } from '@/services/AdminQueryService';
import { MAX_LEVEL } from '../config/character';
import { getExpForLevel } from '../utils/calculations';
import { CONSOLE_STYLE as STYLE } from '../config/console-style';

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
type CommandCategory = 'character' | 'combat' | 'item' | 'exploration' | 'system' | 'skill' | 'quest';

/**
 * 命令类别中文显示映射表
 *
 * 将英文 CommandCategory key 映射为 help 输出中展示的中文标题。
 * 新增类别时需同步在此映射表追加对应中文标签。
 */
const COMMAND_CATEGORY_LABELS: Record<CommandCategory, string> = {
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
 * @property {string} name - 命令名称（全小写），同时作为 window.cmd 的调用键和 usage 的展示名称
 * @property {CommandCategory} category - 命令所属类别，影响 help 输出中的分组
 * @property {string} description - 命令功能简述，在 help 列表和详细帮助中展示
 * @property {string} usage - 命令用法示例，展示在 help 列表中（如 "gold <数量>"）
 * @property {Function} handler - 命令执行函数，接收 args 字符串数组，返回同步或异步的 CommandResult
 *
 * @see registerCommand 命令注册函数
 * @see exec 命令执行入口
 */
interface CommandDef {
  name: string;
  category: CommandCategory;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<CommandResult> | CommandResult;
}

// ============================================================
// 展示辅助
// ============================================================

// STYLE 常量已提取到 src/config/console-style.ts（CONSOLE_STYLE），
// 此处通过 `import { CONSOLE_STYLE as STYLE }` 别名导入，保持现有引用不变。

/**
 * 根据稀有度字符串返回对应的 CSS 颜色样式
 *
 * @param {string} rarity - 稀有度标识（common/uncommon/rare/epic/legendary）
 * @returns {string} 对应稀有度的 CSS 颜色字符串，未匹配时返回默认 STYLE.value
 */
function rarityColorKey(rarity: string): string {
  const map: Record<string, string> = {
    common: STYLE.rarity.common,
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
function logTag(cmd: string, text: string): void {
  console.log(`%c[${cmd}]%c ${text}`, STYLE.tag, STYLE.section);
}

// ============================================================
// 命令注册表
// ============================================================

/**
 * 命令注册表
 *
 * 以 name 为键的 Map，存储所有已注册的 CommandDef。
 * registerCommand() 向此 Map 添加命令，exec() 从此 Map 查找命令。
 *
 * @see registerCommand 注册新命令
 * @see exec 查找并执行命令
 */
const commands = new Map<string, CommandDef>();

/**
 * 注册一个控制台命令
 *
 * 将 CommandDef 以 name 为键存入 commands Map，供 exec() 路由。
 * 模块加载时通过顶层 registerCommand() 调用注册所有内置命令。
 *
 * @param {CommandDef} def - 命令定义对象
 */
function registerCommand(def: CommandDef): void {
  commands.set(def.name, def);
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
function resolveCategory(input: string): CommandCategory | undefined {
  return (Object.keys(COMMAND_CATEGORY_LABELS) as CommandCategory[]).find(
    k => k === input || COMMAND_CATEGORY_LABELS[k] === input
  );
}

/**
 * 获取当前角色数据的辅助函数
 *
 * 消除各命令中重复的 info! 非空断言（CODE-11/CODE-35）。
 * 内部调用 useCharacterStore().getCharacterData() 并做 null 检查，
 * 调用方根据返回值判别后即可获得类型已收窄的 Character。
 *
 * @returns 成功时 { ok: true, character }；角色不存在时 { ok: false, result }
 */
function requireCharacter():
  | { ok: true; character: Character }
  | { ok: false; result: CommandResult } {
  const info = useCharacterStore().getCharacterData();
  if (!info) {
    return { ok: false, result: { success: false, message: '当前没有选中角色' } };
  }
  return { ok: true, character: info };
}

// ============================================================
// 内置命令 —— 系统类
// ============================================================

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
function switchGameState(target: string, msg: string): CommandResult {
  // window.__gameState 类型由 App.vue 的 declare global 声明为 Ref<GameState>，
  // 此处 target 来自命令参数，运行时 switch 命令已校验合法值，通过断言收窄到 GameState 联合类型
  const gs = (window as Window & { __gameState?: { value: 'character-select' | 'game' | 'admin' } }).__gameState;
  if (!gs) {
    return { success: false, message: 'gameState 未初始化，请等待游戏加载完成' };
  }
  gs.value = target as 'character-select' | 'game' | 'admin';
  return { success: true, message: msg };
}

// ---- 系统控制 ----

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

// ---- 帮助与信息 ----

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
    if (args.length > 0) {
      const cmd = commands.get(args[0]);
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
// 内置命令 —— 角色类
// ============================================================

// ---- 属性查看与修改 ----

/**
 * 显示角色属性
 *
 * 输出当前角色的完整属性面板，包括基础信息、战斗属性和金币/经验值。
 * 需确保已选中角色，否则返回失败。
 */
registerCommand({
  name: 'stats',
  category: 'character',
  description: '显示当前角色完整属性',
  usage: 'stats',
  handler() {
    const req = requireCharacter();
    if (!req.ok) return req.result;
    const info = req.character;
    const stats = useCharacterStore().effectiveStats;
    const attrs = useCharacterStore().attributes;

    logTag('stats', `${info.name}  Lv.${info.level}  ${info.factionId}/${info.raceId}/${info.classId}`);
    console.log(`  HP ${info.hp}/${info.maxHp}  |  MP ${info.mana}/${info.maxMana}  |  金币 ${info.gold}`);
    console.log(`  EXP ${info.exp}/${info.expToNextLevel}`);
    console.log(`  ── 基础 ──  力量 ${stats.str}  敏捷 ${stats.dex}  体质 ${stats.con}`);
    console.log(`             智力 ${stats.int}  感知 ${stats.wis}  魅力 ${stats.cha}`);
    console.log(`  ── 战斗 ──  物攻 ${attrs.physicalAttack}  物防 ${attrs.physicalDefense}`);
    console.log(`             魔攻 ${attrs.magicAttack}  魔防 ${attrs.magicDefense}`);
    console.log(`             暴击 ${attrs.critChance}%  闪避 ${attrs.dodgeChance}%`);
    return { success: true, message: '已在上方显示角色完整属性' };
  }
});

/**
 * 添加金币
 *
 * 调用 gainGold() 为当前角色增加指定数量的金币。
 *
 * @param {string[]} args - args[0] 为数量（整数）
 */
registerCommand({
  name: 'gold',
  category: 'character',
  description: '添加金币',
  usage: 'gold <数量>',
  async handler(args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await useCharacterStore().gainGold(amount);
    return { success: true, message: `已添加 ${amount} 金币` };
  }
});

/**
 * 添加经验值
 *
 * 调用 gainExp() 为当前角色增加经验值，自动处理升级逻辑。
 * 如果发生升级，消息中会标注等级变化。
 *
 * @param {string[]} args - args[0] 为经验值数量（正整数）
 *
 * @see useCharacterStore().gainExp
 */
registerCommand({
  name: 'exp',
  category: 'character',
  description: '添加经验值（自动处理升级）',
  usage: 'exp <数量>',
  async handler(args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: '请输入有效的正整数' };
    }
    const oldLevel = useCharacterStore().level;
    await useCharacterStore().gainExp(amount);
    const newLevel = useCharacterStore().level;
    const msg = newLevel > oldLevel
      ? `已添加 ${amount} 经验值，从 ${oldLevel} 级升到 ${newLevel} 级！`
      : `已添加 ${amount} 经验值`;
    return { success: true, message: msg };
  }
});

/**
 * 设置生命值
 *
 * 直接将当前角色的 HP 设置为指定值。
 * 不受 maxHp 上限约束，允许超出最大值。
 *
 * @param {string[]} args - args[0] 为目标生命值
 */
registerCommand({
  name: 'hp',
  category: 'character',
  description: '设置当前生命值',
  usage: 'hp <数值>',
  async handler(args) {
    const value = parseInt(args[0], 10);
    if (isNaN(value)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await useCharacterStore().setHp(value);
    return { success: true, message: `生命值已设置为 ${value}` };
  }
});

/**
 * 设置法力值
 *
 * 直接将当前角色的 MP 设置为指定值。
 *
 * @param {string[]} args - args[0] 为目标法力值
 */
registerCommand({
  name: 'mp',
  category: 'character',
  description: '设置当前法力值',
  usage: 'mp <数值>',
  async handler(args) {
    const value = parseInt(args[0], 10);
    if (isNaN(value)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await useCharacterStore().setMp(value);
    return { success: true, message: `法力值已设置为 ${value}` };
  }
});

// ---- 状态操作 ----

/**
 * 满血满蓝
 *
 * 将当前角色的 HP 恢复至 maxHp，MP 恢复至 maxMana。
 */
registerCommand({
  name: 'heal',
  category: 'character',
  description: '恢复满生命值和法力值',
  usage: 'heal',
  async handler() {
    const req = requireCharacter();
    if (!req.ok) return req.result;
    const info = req.character;
    await useCharacterStore().setHp(info.maxHp);
    await useCharacterStore().setMp(info.maxMana);
    return { success: true, message: `已恢复满 HP(${info.maxHp}) 和 MP(${info.maxMana})` };
  }
});

/**
 * 设置等级
 *
 * 将角色等级调整为指定值（1 至 MAX_LEVEL）。
 * 降低等级时会先 reset() 再逐级加回经验值；升高等级时直接累加差额经验。
 *
 * @param {string[]} args - args[0] 为目标等级（1-MAX_LEVEL）
 *
 * @see useCharacterStore().reset
 * @see getExpForLevel
 */
registerCommand({
  name: 'level',
  category: 'character',
  description: `设置角色等级（1-${MAX_LEVEL}）`,
  usage: 'level <等级>',
  async handler(args) {
    const targetLevel = parseInt(args[0], 10);
    if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > MAX_LEVEL) {
      return { success: false, message: `等级必须在 1-${MAX_LEVEL} 之间` };
    }

    const currentLevel = useCharacterStore().level;
    if (targetLevel === currentLevel) {
      return { success: true, message: `当前已经是 ${targetLevel} 级` };
    }

    if (targetLevel < currentLevel) {
      await useCharacterStore().reset();
      if (targetLevel > 1) {
        let totalExp = 0;
        for (let i = 2; i <= targetLevel; i++) {
          totalExp += getExpForLevel(i);
        }
        await useCharacterStore().gainExp(totalExp);
      }
    } else {
      let totalExp = 0;
      for (let i = currentLevel + 1; i <= targetLevel; i++) {
        totalExp += getExpForLevel(i);
      }
      await useCharacterStore().gainExp(totalExp);
    }

    return { success: true, message: `等级已从 ${currentLevel} 变为 ${targetLevel}` };
  }
});

/**
 * 复活角色
 *
 * 将阵亡角色复活并恢复 50% 的最大生命值和法力值。
 * 需确保已选中角色。
 *
 * @see useCharacterStore().resurrect
 */
registerCommand({
  name: 'resurrect',
  category: 'character',
  description: '复活当前角色（恢复50%生命法力）',
  usage: 'resurrect',
  async handler() {
    if (!useCharacterStore().currentCharacterId) {
      return { success: false, message: '当前没有选中角色' };
    }
    await useCharacterStore().resurrect();
    return { success: true, message: '角色已复活（恢复50% HP/MP）' };
  }
});

/**
 * 属性加成
 *
 * 为当前角色应用临时属性加成（str/dex/con/int/wis/cha），
 * 加成值通过 applyBonus() 写入 store，影响 effectiveStats 计算。
 *
 * @param {string[]} args - args[0] 为属性名（str/dex/con/int/wis/cha），args[1] 为加值
 *
 * @see useCharacterStore().applyBonus
 */
registerCommand({
  name: 'buff',
  category: 'character',
  description: '应用临时属性加成',
  usage: 'buff <属性名> <数值>  (属性: str/dex/con/int/wis/cha)',
  async handler(args) {
    if (args.length < 2) {
      return { success: false, message: '用法: buff <属性名> <数值>，如 buff str 10' };
    }
    const attr = args[0].toLowerCase();
    const value = parseInt(args[1], 10);
    if (isNaN(value)) {
      return { success: false, message: '请输入有效的数值' };
    }
    const validAttrs = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
    if (!validAttrs.includes(attr as typeof validAttrs[number])) {
      return { success: false, message: `无效属性: ${attr}，可选: ${validAttrs.join(', ')}` };
    }
    const bonus: Partial<Record<typeof validAttrs[number], number>> = {};
    bonus[attr as typeof validAttrs[number]] = value;
    await useCharacterStore().applyBonus(bonus);
    return { success: true, message: `已应用加成: ${attr}+${value}` };
  }
});

/**
 * 重置角色
 *
 * 将当前角色重置为初始状态（等级 1、初始属性），所有装备、技能、进度均清空。
 * 此操作不可逆，使用时请谨慎。
 *
 * @see useCharacterStore().reset
 */
registerCommand({
  name: 'resetChar',
  category: 'character',
  description: '重置角色到初始状态（危险操作！）',
  usage: 'resetChar',
  async handler() {
    if (!useCharacterStore().currentCharacterId) {
      return { success: false, message: '当前没有选中角色' };
    }
    await useCharacterStore().reset();
    return { success: true, message: '角色已重置为初始状态' };
  }
});

// ============================================================
// 内置命令 —— 物品类
// ============================================================

/**
 * 添加物品
 *
 * 向当前角色背包添加消耗品或装备。无参数时列出所有可用物品模板。
 * 消耗品可指定数量，装备固定为 1 件。
 *
 * @param {string[]} args - args[0] 为物品 ID（空则列出），args[1] 为数量（消耗品）
 *
 * @see adminQueryService.queryItemTemplate
 * @see adminQueryService.queryAllItemTemplates
 */
registerCommand({
  name: 'item',
  category: 'item',
  description: '添加物品到背包（消耗品和装备）',
  usage: 'item <物品ID> [数量]',
  async handler(args) {
    if (args.length === 0) {
      // CHR-5 修复：通过 AdminQueryService 收口跨模块 DbService 查询
      const { items: lootItems, equipments: equipItems } = await adminQueryService.queryAllItemTemplates();

      logTag('item', '═══ 消耗品 ═══');
      for (const item of lootItems) {
        console.log(`  %c${item.id.padEnd(24)}%c ${item.name}`, STYLE.label, STYLE.value);
      }
      logTag('item', '═══ 装备 ═══');
      for (const item of equipItems) {
        const rc = rarityColorKey(item.rarity || 'common');
        console.log(`  %c${item.id.padEnd(24)}%c ${item.name} %c[${item.type}]`, STYLE.label, rc, STYLE.hint);
      }
      return { success: true, message: '已在上方列出所有可用物品' };
    }

    const itemId = args[0];

    // CHR-5 修复：通过 AdminQueryService 统一查询物品模板（消耗品 + 装备）
    const result = await adminQueryService.queryItemTemplate(itemId);
    if (result) {
      if (result.type === 'item') {
        const count = args[1] ? parseInt(args[1], 10) : 1;
        if (isNaN(count) || count <= 0) {
          return { success: false, message: '数量必须为正整数' };
        }
        const added = useInventoryStore().addItem(result.data.id, count);
        if (added > 0) {
          return { success: true, message: `已添加 ${result.data.name} x${added}` };
        }
        return { success: false, message: '背包已满，无法添加物品' };
      } else {
        // 装备类型固定添加 1 件
        const added = useInventoryStore().addItem(result.data.id, 1);
        if (added > 0) {
          return { success: true, message: `已添加 ${result.data.name} 到背包` };
        }
        return { success: false, message: '背包已满，无法添加物品' };
      }
    }

    return { success: false, message: `未找到物品: ${itemId}，输入 item 查看可用列表` };
  }
});

// ---- 背包管理 ----

/**
 * 显示背包内容
 *
 * 列出当前角色背包中所有物品，含名称和数量。
 */
registerCommand({
  name: 'bag',
  category: 'item',
  description: '显示背包物品',
  usage: 'bag',
  handler() {
    const items = useInventoryStore().inventory;
    if (items.length === 0) {
      return { success: true, message: '背包是空的' };
    }

    logTag('bag', '═══ 背包物品 ═══');
    for (const invItem of items) {
      const info = useInventoryStore().getItemInfo(invItem.itemId);
      const name = info?.name || invItem.itemId;
      console.log(`  %c${invItem.itemId.padEnd(24)}%c ${name} %cx${invItem.count}`, STYLE.label, STYLE.value, STYLE.hint);
    }
    return { success: true, message: `共 ${items.length} 个格子` };
  }
});

/**
 * 清空背包
 *
 * 移除背包中所有物品。此操作不可逆。
 *
 * @see useInventoryStore().resetInventory
 */
registerCommand({
  name: 'clearBag',
  category: 'item',
  description: '清空背包',
  usage: 'clearBag',
  handler() {
    useInventoryStore().resetInventory();
    return { success: true, message: '背包已清空' };
  }
});

/**
 * 查看装备
 *
 * 显示当前角色各槽位的装备信息，含装备名称、稀有度和等级。
 * 未装备的槽位自动跳过不显示。
 */
registerCommand({
  name: 'equips',
  category: 'item',
  description: '查看当前装备状态',
  usage: 'equips',
  handler() {
    const equipment = useEquipmentStore().equipment;
    const slots = Object.entries(equipment);
    const occupied = slots.filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] !== null);

    if (occupied.length === 0) {
      return { success: true, message: '当前没有装备任何物品' };
    }

    const slotNames: Record<string, string> = {
      weapon1: '主手武器', weapon2: '副手武器',
      armor1: '头部', armor2: '肩部', armor3: '胸甲', armor4: '腿部'
    };

    logTag('equips', '═══ 当前装备 ═══');
    for (const [slot, entry] of occupied) {
      const item = entry.item;
      const rc = rarityColorKey(item.rarity || 'common');
      console.log(`  %c${(slotNames[slot] || slot).padEnd(10)}%c ${item.name.padEnd(20)}%c Lv.${item.level}`, STYLE.label, rc, STYLE.hint);
    }
    return { success: true, message: `共装备 ${occupied.length} 件物品` };
  }
});

// ============================================================
// 内置命令 —— 战斗类
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

// ---- 战斗控制 ----

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
 * 对当前战斗目标造成 99999 点伤害使其立即死亡，并以胜利结束战斗。
 * 优先使用 currentTarget（当前选中目标），无目标时返回失败。
 *
 * @see useCombatStore().currentTarget
 * @see useEnemyStore().takeDamage
 */
registerCommand({
  name: 'kill',
  category: 'combat',
  description: '使当前敌人立即死亡',
  usage: 'kill',
  handler() {
    if (!useCombatStore().isInCombat) {
      return { success: false, message: '当前没有在战斗中' };
    }
    const enemy = useCombatStore().currentTarget;
    if (!enemy) {
      return { success: false, message: '没有存活的敌人' };
    }
    useEnemyStore().takeDamage(enemy.id, 99999);
    useCombatStore().endCombat('victory');
    return { success: true, message: `${enemy.name} 已被消灭（${enemy.id}）` };
  }
});

// ============================================================
// 内置命令 —— 技能类
// ============================================================

/**
 * 技能管理
 *
 * 无参数：列出技能栏装备状态、已解锁技能和未解锁技能。
 * 有参数：装备指定技能到指定槽位（不指定槽位则自动寻找第一个空槽位）。
 *
 * @param {string[]} args - args[0] 为技能 ID，args[1] 可选为槽位索引 0-3
 *
 * @see useSkillStore().equipSkill
 */
registerCommand({
  name: 'skills',
  category: 'skill',
  description: '查看技能列表或装备技能',
  usage: 'skills [技能ID] [槽位0-3]  (不带参数列出技能，不指定槽位自动装入空位)',
  async handler(args) {
    if (args.length === 0) {
      const allSkills = useSkillStore().skills;
      const bar = useSkillStore().skillBar;

      logTag('skills', '═══ 技能栏 ═══');
      for (let i = 0; i < 4; i++) {
        const sid = bar.slots[i];
        const skill = sid ? allSkills.find(s => s.id === sid) : null;
        console.log(`  %c[${i}]%c ${skill ? skill.name : '(空)'}`, STYLE.label, skill ? STYLE.value : STYLE.hint);
      }

      logTag('skills', '═══ 已解锁技能 ═══');
      const unlocked = useSkillStore().unlockedSkills;
      for (const s of unlocked) {
        const mp = s.mpCost !== undefined ? ` MP:${s.mpCost}` : '';
        console.log(`  %c${s.id.padEnd(24)}%c ${s.name} %c[${s.type}]${mp}`, STYLE.label, STYLE.value, STYLE.hint);
      }

      const locked = useSkillStore().lockedSkills;
      if (locked.length > 0) {
        logTag('skills', '═══ 未解锁技能 ═══');
        for (const s of locked) {
          console.log(`  %c${s.id.padEnd(24)}%c ${s.name} %c(Lv.${s.unlockLevel})`, STYLE.label, STYLE.hint, STYLE.hint);
        }
      }
      return { success: true, message: '已在上方显示技能信息' };
    }

    const skillId = args[0];
    const bar = useSkillStore().skillBar;

    if (args[1] !== undefined) {
      const slotIndex = parseInt(args[1], 10);
      if (![0, 1, 2, 3].includes(slotIndex)) {
        return { success: false, message: '槽位必须在 0-3 之间' };
      }
      const success = await useSkillStore().equipSkill(skillId, slotIndex as 0|1|2|3);
      if (success) {
        return { success: true, message: `技能 ${skillId} 已装备到槽位 ${slotIndex}` };
      }
      return { success: false, message: '装备失败，请检查技能ID和槽位是否可用' };
    }

    // 未指定槽位时，自动寻找第一个空槽位
    const emptySlot = bar.slots.findIndex(s => !s);
    if (emptySlot === -1) {
      return { success: false, message: '所有槽位已满，请指定要覆盖的槽位 (0-3)' };
    }
    const success = await useSkillStore().equipSkill(skillId, emptySlot as 0|1|2|3);
    if (success) {
      return { success: true, message: `技能 ${skillId} 已装备到槽位 ${emptySlot}` };
    }
    return { success: false, message: '装备失败，请检查技能ID和槽位是否可用' };
  }
});

// ============================================================
// 内置命令 —— 探索类
// ============================================================

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
      const allLocations = [
        ...useMapStore().getLocationsByContinent('kalimdor'),
        ...useMapStore().getLocationsByContinent('eastern_kingdoms'),
        ...useMapStore().getLocationsByContinent('northrend')
      ];
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

// ============================================================
// 内置命令 —— 任务类
// ============================================================

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

// ============================================================
// 内置命令 —— 系统类（其他）
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
      const time = new Date(entry.timestamp || '').toLocaleTimeString();
      console.log(`  %c[${time}]%c ${entry.icon || ''} ${entry.message}`, STYLE.hint, STYLE.value);
    }
    return { success: true, message: `共 ${useLogStore().logCount} 条日志` };
  }
});

// ============================================================
// 公共 API
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
 * @see exec 底层命令执行函数
 * @see commands 命令注册表
 */
export function initConsole(): void {
  const cmdObj: Record<string, (...args: unknown[]) => Promise<CommandResult> | CommandResult> = {};

  for (const [name] of commands) {
    cmdObj[name] = (...args: unknown[]) => {
      const strArgs = args.map(a => String(a));
      return exec(`${name} ${strArgs.join(' ')}`.trim());
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
