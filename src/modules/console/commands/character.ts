/**
 * @fileoverview 角色类控制台命令（character category）
 * @description 包含角色属性查看与修改、状态操作命令：
 *   stats    - 显示角色完整属性
 *   gold     - 添加金币
 *   exp      - 添加经验值
 *   hp       - 设置生命值
 *   mp       - 设置法力值
 *   heal     - 满血满蓝
 *   level    - 设置等级
 *   resurrect - 复活角色
 *   buff     - 应用临时属性加成
 *   resetChar - 重置角色
 * @module console/commands/character
 */
import { useCharacterStore } from '@/modules/character';
import { MAX_LEVEL } from '@/config/character';
import { getExpForLevel } from '@/utils/calculations';
import {
  registerCommand,
  requireCharacter,
  logTag
} from '../framework';

// ============================================================
// 属性查看与修改
// ============================================================

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

// ============================================================
// 状态操作
// ============================================================

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

/** 命令模块标记导出，便于汇总注册器识别 */
export const __characterCommandsLoaded = true;
