/**
 * 控制台命令模块
 *
 * 提供游戏内控制台命令的注册与执行，方便开发和测试。
 * 调用 initConsole() 后，所有命令挂载到 window.cmd 对象，
 * 可在浏览器 DevTools 中直接使用，例如：
 *   cmd.gold(100)          — 添加100金币
 *   cmd.spawn('goblin')    — 生成敌人并进入战斗
 *   cmd.help()             — 查看所有命令
 */
import { characterService } from './character/service';
import { inventoryService } from './inventory/service';
import { enemyService } from './enemy/service';
import { combatService } from './combat/service';
import { explorationService } from './exploration/service';
import { mapService } from './map/service';
import { skillsService } from './skill/service';
import { equipmentService } from './equipment/service';
import { shopService } from './shop/service';
import { questService } from './quest/service';
import { logService } from './log/service';
import { enemyDbService } from './enemy/db';
import { inventoryDbService } from './inventory/db';
import { equipmentDbService } from './equipment/db';
import { eventBus, GameEvents } from './bus/core';
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

/** 命令类别 */
type CommandCategory = '角色' | '战斗' | '物品' | '探索' | '系统' | '技能' | '任务';

/** 命令定义 */
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

const STYLE = {
  tag: 'color: #111; background: #f59e0b; padding: 1px 5px; border-radius: 3px; font-weight: bold',
  ok: 'color: #4ade80',
  err: 'color: #ef4444',
  label: 'color: #a78bfa',
  value: 'color: #e2e8f0',
  hint: 'color: #94a3b8; font-style: italic',
  section: 'color: #f59e0b; font-weight: bold',
  rarity: {
    common: 'color: #9d9d9d',
    uncommon: 'color: #1eff00',
    rare: 'color: #0070dd',
    epic: 'color: #a335ee',
    legendary: 'color: #ff8000'
  }
};

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

/** 输出带 tag 的标题行 */
function logTag(cmd: string, text: string): void {
  console.log(`%c[${cmd}]%c ${text}`, STYLE.tag, STYLE.section);
}

// ============================================================
// 命令注册表
// ============================================================

const commands = new Map<string, CommandDef>();

function registerCommand(def: CommandDef): void {
  commands.set(def.name, def);
}

// ============================================================
// 内置命令 —— 系统类
// ============================================================

/** 帮助命令 */
registerCommand({
  name: 'help',
  category: '系统',
  description: '显示所有可用命令（可按类别筛选）',
  usage: 'help [类别|命令名]',
  handler(args) {
    if (args.length > 0) {
      const cmd = commands.get(args[0]);
      if (cmd) {
        return {
          success: true,
          message: `${cmd.name} [${cmd.category}] — ${cmd.description}\n用法: ${cmd.usage}`
        };
      }
      // 按类别筛选
      const categoryCmds = [...commands.values()].filter(c => c.category === args[0]);
      if (categoryCmds.length > 0) {
        for (const c of categoryCmds) {
          console.log(`%c[help]%c  %c${c.usage.padEnd(32)}%c ${c.description}`, STYLE.tag, STYLE.label, STYLE.value, STYLE.hint);
        }
        return { success: true, message: '已在上方列出该类别命令' };
      }
      return { success: false, message: `未知命令或类别: ${args[0]}` };
    }

    const categories = new Map<CommandCategory, CommandDef[]>();
    for (const cmd of commands.values()) {
      if (!categories.has(cmd.category)) categories.set(cmd.category, []);
      categories.get(cmd.category)!.push(cmd);
    }

    for (const [cat, cmds] of categories) {
      logTag('help', `═══ ${cat} ═══`);
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

/** 显示角色属性 */
registerCommand({
  name: 'stats',
  category: '角色',
  description: '显示当前角色完整属性',
  usage: 'stats',
  handler() {
    if (!characterService.getCurrentCharacterId()) {
      return { success: false, message: '当前没有选中角色' };
    }

    const info = characterService.getCharacterInfo();
    const stats = characterService.getStats();
    const attrs = characterService.getAttributes();

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

/** 添加金币 */
registerCommand({
  name: 'gold',
  category: '角色',
  description: '添加金币',
  usage: 'gold <数量>',
  async handler(args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount)) {
      return { success: false, message: '请输入有效的数字' };
    }
    await characterService.addGold(amount);
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, { oldStats: {}, newStats: {} });
    return { success: true, message: `已添加 ${amount} 金币` };
  }
});

/** 添加经验值 */
registerCommand({
  name: 'exp',
  category: '角色',
  description: '添加经验值（自动处理升级）',
  usage: 'exp <数量>',
  async handler(args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: '请输入有效的正整数' };
    }
    const oldLevel = characterService.getLevel();
    await characterService.addExp(amount);
    const newLevel = characterService.getLevel();
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, { oldStats: {}, newStats: {} });
    const msg = newLevel > oldLevel
      ? `已添加 ${amount} 经验值，从 ${oldLevel} 级升到 ${newLevel} 级！`
      : `已添加 ${amount} 经验值`;
    return { success: true, message: msg };
  }
});

/** 设置生命值 */
registerCommand({
  name: 'hp',
  category: '角色',
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
  category: '角色',
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
  category: '角色',
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
  category: '角色',
  description: `设置角色等级（1-${MAX_LEVEL}）`,
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
      await characterService.reset();
      if (targetLevel > 1) {
        let totalExp = 0;
        for (let i = 2; i <= targetLevel; i++) {
          totalExp += getExpForLevel(i);
        }
        await characterService.addExp(totalExp);
      }
    } else {
      let totalExp = 0;
      for (let i = currentLevel + 1; i <= targetLevel; i++) {
        totalExp += getExpForLevel(i);
      }
      await characterService.addExp(totalExp);
    }

    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, { oldStats: {}, newStats: {} });
    return { success: true, message: `等级已从 ${currentLevel} 变为 ${targetLevel}` };
  }
});

/** 复活角色 */
registerCommand({
  name: 'resurrect',
  category: '角色',
  description: '复活当前角色（恢复50%生命法力）',
  usage: 'resurrect',
  async handler() {
    if (!characterService.getCurrentCharacterId()) {
      return { success: false, message: '当前没有选中角色' };
    }
    await characterService.resurrect();
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, { oldStats: {}, newStats: {} });
    return { success: true, message: '角色已复活（恢复50% HP/MP）' };
  }
});

/** 属性加成 */
registerCommand({
  name: 'buff',
  category: '角色',
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
    const validAttrs = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    if (!validAttrs.includes(attr)) {
      return { success: false, message: `无效属性: ${attr}，可选: ${validAttrs.join(', ')}` };
    }
    const bonus: Partial<Record<string, number>> = {};
    bonus[attr] = value;
    await characterService.applyBonus(bonus as any);
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, { oldStats: {}, newStats: {} });
    return { success: true, message: `已应用加成: ${attr}+${value}` };
  }
});

/** 重置角色 */
registerCommand({
  name: 'resetChar',
  category: '角色',
  description: '重置角色到初始状态（危险操作！）',
  usage: 'resetChar',
  async handler() {
    if (!characterService.getCurrentCharacterId()) {
      return { success: false, message: '当前没有选中角色' };
    }
    await characterService.reset();
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, { oldStats: {}, newStats: {} });
    return { success: true, message: '角色已重置为初始状态' };
  }
});

// ============================================================
// 内置命令 —— 物品类
// ============================================================

/** 添加物品 */
registerCommand({
  name: 'item',
  category: '物品',
  description: '添加物品到背包（消耗品和装备）',
  usage: 'item <物品ID> [数量]',
  async handler(args) {
    if (args.length === 0) {
      const lootItems = await inventoryDbService.getAllItemTemplates();
      const equipItems = await equipmentDbService.getAllEquipmentTemplates();

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

    const lootItem = await inventoryDbService.getItemTemplate(itemId);
    if (lootItem) {
      const count = args[1] ? parseInt(args[1], 10) : 1;
      if (isNaN(count) || count <= 0) {
        return { success: false, message: '数量必须为正整数' };
      }
      const added = inventoryService.addItems(lootItem, count);
      if (added > 0) {
        eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: lootItem.id, count: added });
        return { success: true, message: `已添加 ${lootItem.name} x${added}` };
      }
      return { success: false, message: '背包已满，无法添加物品' };
    }

    const equipItem = await equipmentDbService.getEquipmentTemplate(itemId);
    if (equipItem) {
      const added = inventoryService.addItems(equipItem, 1);
      if (added > 0) {
        eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: equipItem.id, count: added });
        return { success: true, message: `已添加 ${equipItem.name} 到背包` };
      }
      return { success: false, message: '背包已满，无法添加物品' };
    }

    return { success: false, message: `未找到物品: ${itemId}，输入 item 查看可用列表` };
  }
});

/** 显示背包内容 */
registerCommand({
  name: 'bag',
  category: '物品',
  description: '显示背包物品',
  usage: 'bag',
  handler() {
    const items = inventoryService.getInventory();
    if (items.length === 0) {
      return { success: true, message: '背包是空的' };
    }

    logTag('bag', '═══ 背包物品 ═══');
    for (const invItem of items) {
      const info = inventoryService.getItemInfo(invItem.itemId);
      const name = info?.name || invItem.itemId;
      console.log(`  %c${invItem.itemId.padEnd(24)}%c ${name} %cx${invItem.count}`, STYLE.label, STYLE.value, STYLE.hint);
    }
    return { success: true, message: `共 ${items.length} 个格子` };
  }
});

/** 清空背包 */
registerCommand({
  name: 'clearBag',
  category: '物品',
  description: '清空背包',
  usage: 'clearBag',
  handler() {
    inventoryService.reset();
    eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: '', count: 0 });
    return { success: true, message: '背包已清空' };
  }
});

/** 查看装备 */
registerCommand({
  name: 'equips',
  category: '物品',
  description: '查看当前装备状态',
  usage: 'equips',
  handler() {
    const equipment = equipmentService.getEquipment();
    const slots = Object.entries(equipment) as [string, any][];
    const occupied = slots.filter(([_, item]) => item !== null);

    if (occupied.length === 0) {
      return { success: true, message: '当前没有装备任何物品' };
    }

    const slotNames: Record<string, string> = {
      weapon1: '主手武器', weapon2: '副手武器',
      armor1: '头部', armor2: '肩部', armor3: '胸甲', armor4: '腿部'
    };

    logTag('equips', '═══ 当前装备 ═══');
    for (const [slot, item] of occupied) {
      const rc = rarityColorKey(item.rarity || 'common');
      console.log(`  %c${(slotNames[slot] || slot).padEnd(10)}%c ${item.name.padEnd(20)}%c Lv.${item.level}`, STYLE.label, rc, STYLE.hint);
    }
    return { success: true, message: `共装备 ${occupied.length} 件物品` };
  }
});

// ============================================================
// 内置命令 —— 战斗类
// ============================================================

/** 生成敌人并进入战斗 */
registerCommand({
  name: 'spawn',
  category: '战斗',
  description: '生成敌人并进入战斗',
  usage: 'spawn <敌人ID>',
  async handler(args) {
    if (args.length === 0) {
      const enemies = await enemyDbService.getAllEnemyTemplates();
      logTag('spawn', '═══ 可用敌人ID ═══');
      for (const data of enemies) {
        console.log(`  %c${data.id.padEnd(22)}%c ${data.name} %c(HP:${data.maxHp})`, STYLE.label, STYLE.value, STYLE.hint);
      }
      return { success: true, message: '已在上方列出所有可用敌人' };
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

/** 结束当前战斗（强制胜利） */
registerCommand({
  name: 'win',
  category: '战斗',
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
  category: '战斗',
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
  category: '战斗',
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
    enemyService.takeDamage(enemy.id, 99999);
    combatService.endCombat('victory');
    return { success: true, message: `${enemy.name} 已被消灭` };
  }
});

// ============================================================
// 内置命令 —— 技能类
// ============================================================

/** 技能管理 */
registerCommand({
  name: 'skills',
  category: '技能',
  description: '查看技能列表或装备技能',
  usage: 'skills [技能ID] [槽位0-3]  (不带参数列出技能，带参数装备技能)',
  handler(args) {
    if (args.length === 0) {
      const allSkills = skillsService.getSkills();
      const bar = skillsService.getSkillBar();

      logTag('skills', '═══ 技能栏 ═══');
      for (let i = 0; i < 4; i++) {
        const sid = bar.slots[i];
        const skill = sid ? allSkills.find(s => s.id === sid) : null;
        console.log(`  %c[${i}]%c ${skill ? skill.name : '(空)'}`, STYLE.label, skill ? STYLE.value : STYLE.hint);
      }

      logTag('skills', '═══ 已解锁技能 ═══');
      const unlocked = skillsService.getUnlockedSkills();
      for (const s of unlocked) {
        const mp = s.mpCost !== undefined ? ` MP:${s.mpCost}` : '';
        console.log(`  %c${s.id.padEnd(24)}%c ${s.name} %c[${s.type}]${mp}`, STYLE.label, STYLE.value, STYLE.hint);
      }

      const locked = skillsService.getLockedSkills();
      if (locked.length > 0) {
        logTag('skills', '═══ 未解锁技能 ═══');
        for (const s of locked) {
          console.log(`  %c${s.id.padEnd(24)}%c ${s.name} %c(Lv.${s.unlockLevel})`, STYLE.label, STYLE.hint, STYLE.hint);
        }
      }
      return { success: true, message: '已在上方显示技能信息' };
    }

    const skillId = args[0];
    const slotIndex = args[1] ? parseInt(args[1], 10) as 0|1|2|3 : 0;
    if (![0, 1, 2, 3].includes(slotIndex)) {
      return { success: false, message: '槽位必须在 0-3 之间' };
    }
    const success = skillsService.equipSkill(skillId, slotIndex);
    if (success) {
      eventBus.emit(GameEvents.SKILL_BAR_UPDATE, { skillId, slotIndex });
      return { success: true, message: `技能 ${skillId} 已装备到槽位 ${slotIndex}` };
    }
    return { success: false, message: '装备失败，请检查技能ID和槽位是否可用' };
  }
});

// ============================================================
// 内置命令 —— 探索类
// ============================================================

/** 重置探索 */
registerCommand({
  name: 'resetExplore',
  category: '探索',
  description: '重置当前区域的探索状态',
  usage: 'resetExplore',
  handler() {
    explorationService.reset();
    eventBus.emit(GameEvents.EXPLORATION_END, { characterId: characterService.getCurrentCharacterId() });
    return { success: true, message: '探索状态已重置' };
  }
});

/** 切换到指定地点 */
registerCommand({
  name: 'goto',
  category: '探索',
  description: '传送到指定地点',
  usage: 'goto <地点ID>',
  handler(args) {
    if (args.length === 0) {
      const allLocations = [
        ...mapService.getLocationsByContinent('kalimdor'),
        ...mapService.getLocationsByContinent('eastern_kingdoms'),
        ...mapService.getLocationsByContinent('northrend')
      ];
      logTag('goto', '═══ 可用地点 ═══');
      for (const loc of allLocations) {
        console.log(`  %c${loc.id.padEnd(24)}%c ${loc.displayName}`, STYLE.label, STYLE.value);
      }
      return { success: true, message: '已在上方列出所有可用地点' };
    }

    const locationId = args[0];
    const success = mapService.enterLocation(locationId);
    if (success) {
      return { success: true, message: `已传送到 ${locationId}` };
    }
    return { success: false, message: `未找到地点: ${locationId}，输入 goto 查看可用列表` };
  }
});

// ============================================================
// 内置命令 —— 任务类
// ============================================================

/** 任务管理 */
registerCommand({
  name: 'quests',
  category: '任务',
  description: '查看任务状态或操作任务',
  usage: 'quests [accept|complete|abandon <任务ID>]',
  async handler(args) {
    if (args.length === 0) {
      const available = questService.getAvailableQuests();
      const inProgress = questService.getInProgressQuests();
      const completed = questService.getCompletedQuests();

      if (available.length === 0 && inProgress.length === 0 && completed.length === 0) {
        return { success: true, message: '当前没有任何任务' };
      }

      if (inProgress.length > 0) {
        logTag('quests', '═══ 进行中的任务 ═══');
        for (const id of inProgress) {
          const inst = questService.getQuestInstance(id);
          const def = questService.getQuestDefinition(id);
          console.log(`  %c${id.padEnd(24)}%c ${def?.title || id} %c${inst?.progress || ''}`, STYLE.label, STYLE.value, STYLE.hint);
        }
      }

      if (available.length > 0) {
        logTag('quests', '═══ 可接任务 ═══');
        for (const id of available) {
          const def = questService.getQuestDefinition(id);
          console.log(`  %c${id.padEnd(24)}%c ${def?.title || id}`, STYLE.label, STYLE.value);
        }
      }

      if (completed.length > 0) {
        logTag('quests', '═══ 已完成（可提交）═══');
        for (const id of completed) {
          const def = questService.getQuestDefinition(id);
          console.log(`  %c${id.padEnd(24)}%c ${def?.title || id}`, STYLE.label, STYLE.value);
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
        const ok = questService.acceptQuest(questId);
        if (ok) {
          eventBus.emit(GameEvents.QUEST_ACCEPTED, { questId, definition: questService.getQuestDefinition(questId)! });
          return { success: true, message: `已接受任务: ${questId}` };
        }
        return { success: false, message: `无法接受任务: ${questId}` };
      }
      case 'complete': {
        const ok = questService.turnInQuest(questId);
        if (ok) {
          eventBus.emit(GameEvents.QUEST_REWARDED, { questId, definition: questService.getQuestDefinition(questId)! });
          return { success: true, message: `已提交任务: ${questId}` };
        }
        return { success: false, message: `无法提交任务: ${questId}（可能尚未完成）` };
      }
      case 'abandon': {
        const ok = questService.abandonQuest(questId);
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
// 内置命令 —— 商店类
// ============================================================

/** 商店管理 */
registerCommand({
  name: 'shops',
  category: '系统',
  description: '查看可用商店列表',
  usage: 'shops',
  async handler() {
    await shopService.init();
    const shops = shopService.getAllShops();
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

// ============================================================
// 内置命令 —— 日志类
// ============================================================

/** 查看冒险日志 */
registerCommand({
  name: 'log',
  category: '系统',
  description: '查看最近冒险日志',
  usage: 'log [数量] [类型]  (类型: combat/quest/item/level/info)',
  handler(args) {
    const count = args[0] ? parseInt(args[0], 10) : 10;
    const filterType = args[1] as string | undefined;

    let logs = logService.getLogs();
    if (filterType) {
      logs = logService.getLogsByType(filterType as any);
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
    return { success: true, message: `共 ${logService.getLogCount()} 条日志` };
  }
});

// ============================================================
// 公共 API
// ============================================================

const commandHistory: string[] = [];

/**
 * 执行控制台命令（字符串形式）
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
 */
export function initConsole(): void {
  const cmdObj: Record<string, (...args: any[]) => Promise<CommandResult> | CommandResult> = {};

  for (const [name] of commands) {
    cmdObj[name] = (...args: any[]) => {
      const strArgs = args.map(a => String(a));
      return exec(`${name} ${strArgs.join(' ')}`.trim());
    };
  }

  cmdObj.exec = (input: string) => exec(input);

  (window as any).cmd = cmdObj;

  console.log(
    '%c[cmd]%c 控制台命令已加载，输入 %ccmd.help()%c 查看所有命令',
    STYLE.tag, STYLE.ok,
    'color: #ffd700; font-weight: bold', STYLE.ok
  );
}
