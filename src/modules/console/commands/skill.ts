/**
 * @fileoverview 技能类控制台命令（skill category）
 * @description 包含技能查看与装备命令：
 *   skills - 查看技能列表或装备技能
 * @module console/commands/skill
 */
import { useSkillStore } from '@/modules/skill';
import { registerCommand, logTag, STYLE } from '../framework';

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

/** 命令模块标记导出，便于汇总注册器识别 */
export const __skillCommandsLoaded = true;
