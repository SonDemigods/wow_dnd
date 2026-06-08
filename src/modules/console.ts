/**
 * 控制台命令模块
 *
 * 提供游戏内控制台命令的注册与执行，方便开发和测试。
 * 调用 initConsole() 后，所有命令挂载到 window.cmd 对象，
 * 可在浏览器 DevTools 中直接使用，例如：
 *   cmd.gold(100)       — 添加100金币
 *   cmd.spawn('goblin') — 生成敌人并进入战斗
 *   cmd.help()          — 查看所有命令
 */
import { characterService } from './character/service';
import { inventoryService } from './inventory/service';
import { enemyService } from './enemy/service';
import { combatService } from './combat/service';
import { explorationService } from './exploration/service';
import { mapService } from './map/service';
import { enemyDbService } from './enemy/db';
import { inventoryDbService } from './inventory/db';
import { equipmentDbService } from './equipment/db';
import { MAX_LEVEL } from '../config/character';
import { getExpForLevel } from '../utils/calculations';

// ============================================================
// 类型定义
// ============================================================

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  message: string;
}

/** 命令定义 */
interface CommandDef {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<CommandResult> | CommandResult;
}

// ============================================================
// 命令注册表
// ============================================================

const commands = new Map<string, CommandDef>();

/** 注册命令 */
function registerCommand(def: CommandDef): void {
  commands.set(def.name, def);
}

// ============================================================
// 内置命令
// ============================================================

/** 帮助命令 */
registerCommand({
  name: 'help',
  description: '显示所有可用命令',
  usage: 'help [命令名]',
  handler(args) {
    if (args.length > 0) {
      const cmd = commands.get(args[0]);
      if (!cmd) {
        return { success: false, message: `未知命令: ${args[0]}` };
      }
      return {
        success: true,
        message: `${cmd.name} - ${cmd.description}\n用法: ${cmd.usage}`
      };
    }

    const lines = ['═══ 控制台命令列表 ═══'];
    for (const cmd of commands.values()) {
      lines.push(`  ${cmd.usage.padEnd(28)} ${cmd.description}`);
    }
    lines.push('═══════════════════════════');
    lines.push('提示: 输入 help <命令名> 查看详细用法');
    return { success: true, message: lines.join('\n') };
  }
});

/** 显示角色属性 */
registerCommand({
  name: 'stats',
  description: '显示当前角色属性',
  usage: 'stats',
  handler() {
    if (!characterService.getCurrentCharacterId()) {
      return { success: false, message: '当前没有选中角色' };
    }

    const info = characterService.getCharacterInfo();
    const stats = characterService.getStats();
    const attrs = characterService.getAttributes();

    const lines = [
      `═══ ${info.name} 的属性 ═══`,
      `等级: ${info.level}  阵营: ${info.factionId}  种族: ${info.raceId}  职业: ${info.classId}`,
      `HP: ${info.hp}/${info.maxHp}  MP: ${info.mana}/${info.maxMana}  金币: ${info.gold}`,
      `EXP: ${info.exp}/${info.expToNextLevel}`,
      `─── 基础属性 ───`,
      `力量: ${stats.str}  敏捷: ${stats.dex}  体质: ${stats.con}`,
      `智力: ${stats.int}  感知: ${stats.wis}  魅力: ${stats.cha}`,
      `─── 战斗属性 ───`,
      `物攻: ${attrs.physicalAttack}  物防: ${attrs.physicalDefense}`,
      `魔攻: ${attrs.magicAttack}  魔防: ${attrs.magicDefense}`,
      `暴击: ${attrs.critChance}%  闪避: ${attrs.dodgeChance}%`,
      `═══════════════════════`
    ];
    return { success: true, message: lines.join('\n') };
  }
});

/** 添加金币 */
registerCommand({
  name: 'gold',
  description: '添加金币',
  usage: 'gold <数量>',
  async handler(args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await characterService.addGold(amount);
    return { success: true, message: `已添加 ${amount} 金币` };
  }
});

/** 添加经验值 */
registerCommand({
  name: 'exp',
  description: '添加经验值',
  usage: 'exp <数量>',
  async handler(args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: '请输入有效的正整数' };
    }
    const oldLevel = characterService.getLevel();
    await characterService.addExp(amount);
    const newLevel = characterService.getLevel();
    const msg = newLevel > oldLevel
      ? `已添加 ${amount} 经验值，从 ${oldLevel} 级升到 ${newLevel} 级！`
      : `已添加 ${amount} 经验值`;
    return { success: true, message: msg };
  }
});

/** 设置生命值 */
registerCommand({
  name: 'hp',
  description: '设置当前生命值',
  usage: 'hp <数值>',
  async handler(args) {
    const value = parseInt(args[0], 10);
    if (isNaN(value)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await characterService.setHp(value);
    return { success: true, message: `生命值已设置为 ${value}` };
  }
});

/** 设置法力值 */
registerCommand({
  name: 'mp',
  description: '设置当前法力值',
  usage: 'mp <数值>',
  async handler(args) {
    const value = parseInt(args[0], 10);
    if (isNaN(value)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await characterService.setMp(value);
    return { success: true, message: `法力值已设置为 ${value}` };
  }
});

/** 满血满蓝 */
registerCommand({
  name: 'heal',
  description: '恢复满生命值和法力值',
  usage: 'heal',
  async handler() {
    const info = characterService.getCharacterInfo();
    await characterService.setHp(info.maxHp);
    await characterService.setMp(info.maxMana);
    return { success: true, message: `已恢复满 HP(${info.maxHp}) 和 MP(${info.maxMana})` };
  }
});

/** 设置等级 */
registerCommand({
  name: 'level',
  description: '设置角色等级',
  usage: 'level <等级>',
  async handler(args) {
    const targetLevel = parseInt(args[0], 10);
    if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > MAX_LEVEL) {
      return { success: false, message: `等级必须在 1-${MAX_LEVEL} 之间` };
    }

    const currentLevel = characterService.getLevel();
    if (targetLevel === currentLevel) {
      return { success: true, message: `当前已经是 ${targetLevel} 级` };
    }

    if (targetLevel < currentLevel) {
      // 降级：重置后再加经验
      await characterService.reset();
      if (targetLevel > 1) {
        let totalExp = 0;
        for (let i = 2; i <= targetLevel; i++) {
          totalExp += getExpForLevel(i);
        }
        await characterService.addExp(totalExp);
      }
    } else {
      // 升级：补经验
      let totalExp = 0;
      for (let i = currentLevel + 1; i <= targetLevel; i++) {
        totalExp += getExpForLevel(i);
      }
      await characterService.addExp(totalExp);
    }

    return { success: true, message: `等级已从 ${currentLevel} 变为 ${targetLevel}` };
  }
});

/** 添加物品 */
registerCommand({
  name: 'item',
  description: '添加物品到背包（消耗品和装备）',
  usage: 'item <物品ID> [数量]',
  async handler(args) {
    if (args.length === 0) {
      const lines = ['═══ 消耗品 ═══'];
      const lootItems = await inventoryDbService.getAllItemTemplates();
      for (const item of lootItems) {
        lines.push(`  ${item.id.padEnd(22)} ${item.name}`);
      }
      lines.push('═══ 装备 ═══');
      const equipItems = await equipmentDbService.getAllEquipmentTemplates();
      for (const item of equipItems) {
        lines.push(`  ${item.id.padEnd(22)} ${item.name} [${item.type}]`);
      }
      lines.push('═══════════════════');
      return { success: true, message: lines.join('\n') };
    }

    const itemId = args[0];

    // 先查找消耗品
    const lootItem = await inventoryDbService.getItemTemplate(itemId);
    if (lootItem) {
      const count = args[1] ? parseInt(args[1], 10) : 1;
      if (isNaN(count) || count <= 0) {
        return { success: false, message: '数量必须为正整数' };
      }
      const added = inventoryService.addItems(lootItem, count);
      if (added > 0) {
        return { success: true, message: `已添加 ${lootItem.name} x${added}` };
      }
      return { success: false, message: '背包已满，无法添加物品' };
    }

    // 再查找装备
    const equipItem = await equipmentDbService.getEquipmentTemplate(itemId);
    if (equipItem) {
      const added = inventoryService.addItems(equipItem, 1);
      if (added > 0) {
        return { success: true, message: `已添加 ${equipItem.name} 到背包` };
      }
      return { success: false, message: '背包已满，无法添加物品' };
    }

    return { success: false, message: `未找到物品: ${itemId}，输入 item 查看可用列表` };
  }
});

/** 生成敌人并进入战斗 */
registerCommand({
  name: 'spawn',
  description: '生成敌人并进入战斗',
  usage: 'spawn <敌人ID>',
  async handler(args) {
    if (args.length === 0) {
      const lines = ['═══ 可用敌人ID ═══'];
      const enemies = await enemyDbService.getAllEnemyTemplates();
      for (const data of enemies) {
        lines.push(`  ${data.id.padEnd(22)} ${data.name} (HP:${data.maxHp})`);
      }
      lines.push('═══════════════════');
      return { success: true, message: lines.join('\n') };
    }

    const enemyId = args[0];
    try {
      const enemy = await enemyService.createEnemy(enemyId);
      combatService.startCombat(enemy);
      return { success: true, message: `已生成 ${enemy.name} (HP:${enemy.hp}) 并进入战斗` };
    } catch {
      return { success: false, message: `未找到敌人: ${enemyId}，输入 spawn 查看可用列表` };
    }
  }
});

/** 重置探索 */
registerCommand({
  name: 'resetExplore',
  description: '重置当前区域的探索状态',
  usage: 'resetExplore',
  handler() {
    explorationService.reset();
    return { success: true, message: '探索状态已重置' };
  }
});

/** 显示背包内容 */
registerCommand({
  name: 'bag',
  description: '显示背包物品',
  usage: 'bag',
  handler() {
    const items = inventoryService.getInventory();
    if (items.length === 0) {
      return { success: true, message: '背包是空的' };
    }

    const lines = ['═══ 背包物品 ═══'];
    for (const invItem of items) {
      const info = inventoryService.getItemInfo(invItem.itemId);
      const name = info?.name || invItem.itemId;
      lines.push(`  ${invItem.itemId.padEnd(22)} ${name} x${invItem.count}`);
    }
    lines.push('═══════════════════');
    return { success: true, message: lines.join('\n') };
  }
});

/** 清空背包 */
registerCommand({
  name: 'clearBag',
  description: '清空背包',
  usage: 'clearBag',
  handler() {
    inventoryService.reset();
    return { success: true, message: '背包已清空' };
  }
});

/** 切换到指定地点 */
registerCommand({
  name: 'goto',
  description: '传送到指定地点',
  usage: 'goto <地点ID>',
  handler(args) {
    if (args.length === 0) {
      const allLocations = [
        ...mapService.getLocationsByContinent('kalimdor'),
        ...mapService.getLocationsByContinent('eastern_kingdoms'),
        ...mapService.getLocationsByContinent('northrend')
      ];
      const lines = ['═══ 可用地点 ═══'];
      for (const loc of allLocations) {
        lines.push(`  ${loc.id.padEnd(22)} ${loc.displayName}`);
      }
      lines.push('═══════════════════');
      return { success: true, message: lines.join('\n') };
    }

    const locationId = args[0];
    const success = mapService.enterLocation(locationId);
    if (success) {
      return { success: true, message: `已传送到 ${locationId}` };
    }
    return { success: false, message: `未找到地点: ${locationId}，输入 goto 查看可用列表` };
  }
});

/** 结束当前战斗（强制胜利） */
registerCommand({
  name: 'win',
  description: '强制结束当前战斗（胜利）',
  usage: 'win',
  handler() {
    if (!combatService.isInCombat()) {
      return { success: false, message: '当前没有在战斗中' };
    }
    combatService.endCombat('victory');
    return { success: true, message: '战斗已强制胜利' };
  }
});

/** 结束当前战斗（逃跑） */
registerCommand({
  name: 'flee',
  description: '强制结束当前战斗（逃跑）',
  usage: 'flee',
  handler() {
    if (!combatService.isInCombat()) {
      return { success: false, message: '当前没有在战斗中' };
    }
    combatService.endCombat('fled');
    return { success: true, message: '已从战斗中逃跑' };
  }
});

/** 敌人立即死亡 */
registerCommand({
  name: 'kill',
  description: '使当前敌人立即死亡',
  usage: 'kill',
  handler() {
    if (!combatService.isInCombat()) {
      return { success: false, message: '当前没有在战斗中' };
    }
    const enemy = combatService.getEnemy();
    if (!enemy) {
      return { success: false, message: '没有敌人' };
    }
    // 直接对敌人造成大量伤害
    enemyService.takeDamage(enemy.id, 99999);
    combatService.endCombat('victory');
    return { success: true, message: `${enemy.name} 已被消灭` };
  }
});

// ============================================================
// 公共 API
// ============================================================

/** 命令历史记录 */
const commandHistory: string[] = [];

/**
 * 执行控制台命令（字符串形式）
 * @param input - 命令字符串，如 "gold 100"
 * @returns 命令执行结果
 */
export async function exec(input: string): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, message: '请输入命令' };
  }

  commandHistory.push(trimmed);

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
      console.log(`%c${result.message}`, 'color: #4ade80');
    } else {
      console.warn(result.message);
    }
    return result;
  } catch (e) {
    const msg = `命令执行出错: ${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    return { success: false, message: msg };
  }
}

/**
 * 初始化控制台命令，挂载到 window.cmd 全局对象
 *
 * 使用方式（在浏览器 DevTools 中）：
 *   cmd.help()          — 显示所有命令
 *   cmd.stats()         — 查看角色属性
 *   cmd.gold(100)       — 添加100金币
 *   cmd.hp(999)         — 设置生命值
 *   cmd.heal()          — 满血满蓝
 *   cmd.item('smallHealthPotion', 5)  — 添加物品
 *   cmd.spawn('goblin') — 生成敌人
 *   cmd.exec('gold 100')— 字符串方式执行
 */
export function initConsole(): void {
  // 构建 cmd 对象，每个命令注册为一个方法
  const cmdObj: Record<string, (...args: any[]) => Promise<CommandResult> | CommandResult> = {};

  for (const [name] of commands) {
    cmdObj[name] = (...args: any[]) => {
      // 将参数转为字符串数组
      const strArgs = args.map(a => String(a));
      return exec(`${name} ${strArgs.join(' ')}`.trim());
    };
  }

  // 额外暴露 exec 方法，支持字符串形式调用
  cmdObj.exec = (input: string) => exec(input);

  (window as any).cmd = cmdObj;

  console.log(
    '%c[控制台命令已加载] 输入 cmd.help() 查看所有可用命令',
    'color: #ffd700; font-weight: bold; font-size: 14px'
  );
}