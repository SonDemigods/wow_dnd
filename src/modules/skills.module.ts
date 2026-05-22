import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';
import { CLASS_ABILITIES } from '@/data';

export type SkillType = 'physical_damage' | 'magic_damage' | 'heal' | 'buff' | 'debuff';

export type SkillSchool = 'warrior' | 'mage' | 'priest' | 'rogue' | 'hunter' | 'shaman' | 'paladin' | 'warlock' | 'druid';

export interface SkillEffect {
  type: SkillType;
  value: number;
  duration?: number;
  cooldown: number;
  range?: number;
  areaOfEffect?: number;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  school: SkillSchool;
  type: SkillType;
  effect: SkillEffect;
  mpCost: number;
  level: number;
  maxLevel: number;
  currentLevel: number;
  learned: boolean;
  cooldown: number;
  currentCooldown: number;
  requiredClass?: string[];
}

export interface SkillBarSlot {
  id: string;
  skillId: string | null;
  position: number;
}

export interface SkillState {
  skills: Skill[];
  skillBar: SkillBarSlot[];
  activeBuffs: Buff[];
  activeDebuffs: Debuff[];
}

export interface Buff {
  id: string;
  skillId: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  value: number;
  duration: number;
  remainingDuration: number;
}

export interface Debuff {
  id: string;
  skillId: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  value: number;
  duration: number;
  remainingDuration: number;
}

export interface SkillLearnResult {
  success: boolean;
  message: string;
  skill?: Skill;
}

export interface SkillCastResult {
  success: boolean;
  message: string;
  skill?: Skill;
  damage?: number;
  heal?: number;
}

export interface ISkillsService {
  getSkills(): Skill[];
  getSkill(skillId: string): Skill | undefined;
  getLearnedSkills(): Skill[];
  getAvailableSkills(): Skill[];
  learnSkill(skillId: string): SkillLearnResult;
  upgradeSkill(skillId: string): SkillLearnResult;
  castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult;
  getSkillBar(): SkillBarSlot[];
  setSkillBar(slotIndex: number, skillId: string | null): void;
  getState(): SkillState;
  updateCooldowns(): void;
  updateBuffs(): void;
  addBuff(buff: Buff): void;
  removeBuff(buffId: string): void;
  addDebuff(debuff: Debuff): void;
  removeDebuff(debuffId: string): void;
}

const VALID_SCHOOLS: string[] = ['warrior', 'mage', 'priest', 'rogue', 'hunter', 'shaman', 'paladin', 'warlock', 'druid'];

function convertSkills(): Skill[] {
  const skills: Skill[] = [];
  for (const [classId, classSkills] of Object.entries(CLASS_ABILITIES)) {
    const school = VALID_SCHOOLS.includes(classId) ? classId as Skill['school'] : 'warrior';
    for (const skillData of classSkills) {
      skills.push({
        id: skillData.id,
        name: skillData.name,
        icon: skillData.icon,
        description: skillData.description,
        school,
        type: skillData.type as Skill['type'],
        effect: { type: skillData.type as Skill['type'], value: skillData.effect.value, cooldown: 5 },
        mpCost: skillData.mpCost,
        level: skillData.unlockLevel,
        maxLevel: 5,
        currentLevel: 0,
        learned: false,
        cooldown: 5,
        currentCooldown: 0,
        requiredClass: [classId]
      });
    }
  }
  return skills;
}

const INITIAL_SKILLS: Skill[] = convertSkills();

export const useSkillsStore = defineStore('skills', () => {
  const skills = ref<Skill[]>(JSON.parse(JSON.stringify(INITIAL_SKILLS)));
  const skillBar = ref<SkillBarSlot[]>([
    { id: 'slot_1', skillId: null, position: 1 },
    { id: 'slot_2', skillId: null, position: 2 },
    { id: 'slot_3', skillId: null, position: 3 },
    { id: 'slot_4', skillId: null, position: 4 },
    { id: 'slot_5', skillId: null, position: 5 },
    { id: 'slot_6', skillId: null, position: 6 },
    { id: 'slot_7', skillId: null, position: 7 },
    { id: 'slot_8', skillId: null, position: 8 }
  ]);
  const activeBuffs = ref<Buff[]>([]);
  const activeDebuffs = ref<Debuff[]>([]);

  const state = computed<SkillState>(() => ({
    skills: skills.value,
    skillBar: skillBar.value,
    activeBuffs: activeBuffs.value,
    activeDebuffs: activeDebuffs.value
  }));

  function getSkills(): Skill[] {
    return skills.value;
  }

  function getSkill(skillId: string): Skill | undefined {
    return skills.value.find(skill => skill.id === skillId);
  }

  function getLearnedSkills(): Skill[] {
    return skills.value.filter(skill => skill.learned);
  }

  function getAvailableSkills(): Skill[] {
    const playerLevel = characterService.getLevel();
    const playerClass = characterService.getClass();
    
    return skills.value.filter(skill => {
      const levelRequirement = skill.level <= playerLevel;
      const classRequirement = !skill.requiredClass || skill.requiredClass.includes(playerClass);
      const notLearned = !skill.learned;
      return levelRequirement && classRequirement && notLearned;
    });
  }

  function learnSkill(skillId: string): SkillLearnResult {
    const skill = getSkill(skillId);
    if (!skill) {
      return { success: false, message: '技能不存在！' };
    }

    if (skill.learned) {
      return { success: false, message: '该技能已学习！' };
    }

    const playerLevel = characterService.getLevel();
    if (playerLevel < skill.level) {
      return { success: false, message: `需要等级 ${skill.level} 才能学习！` };
    }

    const playerClass = characterService.getClass();
    if (skill.requiredClass && !skill.requiredClass.includes(playerClass)) {
      return { success: false, message: '该职业无法学习此技能！' };
    }

    skill.learned = true;
    skill.currentLevel = 1;

    eventBus.emit(GameEvents.SKILL_LEARNED, { skill });

    return {
      success: true,
      message: `成功学习技能：${skill.name}`,
      skill
    };
  }

  function upgradeSkill(skillId: string): SkillLearnResult {
    const skill = getSkill(skillId);
    if (!skill) {
      return { success: false, message: '技能不存在！' };
    }

    if (!skill.learned) {
      return { success: false, message: '请先学习该技能！' };
    }

    if (skill.currentLevel >= skill.maxLevel) {
      return { success: false, message: '该技能已达到最高等级！' };
    }

    const playerLevel = characterService.getLevel();
    const nextLevel = skill.currentLevel + 1;
    if (playerLevel < skill.level + (nextLevel - 1) * 2) {
      return { success: false, message: '等级不足，无法升级！' };
    }

    skill.currentLevel = nextLevel;
    skill.effect.value += 5;
    skill.mpCost += 5;

    eventBus.emit(GameEvents.SKILL_UPGRADED, { skill });

    return {
      success: true,
      message: `成功升级技能 ${skill.name} 到 ${skill.currentLevel} 级！`,
      skill
    };
  }

  function castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult {
    const skill = getSkill(skillId);
    if (!skill) {
      return { success: false, message: '技能不存在！' };
    }

    if (!skill.learned) {
      return { success: false, message: '该技能未学习！' };
    }

    if (skill.currentCooldown > 0) {
      return { success: false, message: `技能冷却中，剩余 ${skill.currentCooldown} 回合！` };
    }

    const currentMp = characterService.getCharacterInfo().currentMp ?? characterService.getAttributes().maxMana;
    if (currentMp < skill.mpCost) {
      return { success: false, message: '魔法值不足！' };
    }

    characterService.addMp(-skill.mpCost);
    skill.currentCooldown = skill.cooldown;

    if (skill.type === 'heal') {
      const healAmount = skill.effect.value;
      characterService.addHp(healAmount);

      eventBus.emit(GameEvents.SKILL_CAST, { skill, targetType, healAmount });
      return {
        success: true,
        message: `\u91CA\u653E\u3010${skill.name}\u3011\uFF0C\u6062\u590D\u4E86 ${healAmount} HP！`,
        skill,
        heal: healAmount
      };
    }

    if (skill.type === 'buff') {
      const buff: Buff = {
        id: `buff_${Date.now()}`,
        skillId: skill.id,
        name: skill.name,
        description: skill.description,
        icon: skill.icon,
        type: skill.type,
        value: skill.effect.value,
        duration: skill.effect.duration || 30,
        remainingDuration: skill.effect.duration || 30
      };
      activeBuffs.value.push(buff);

      eventBus.emit(GameEvents.SKILL_CAST, { skill, targetType });
      return {
        success: true,
        message: `\u91CA\u653E\u3010${skill.name}\u3011\uFF0C\u6301\u7EED ${buff.duration} 秒！`,
        skill
      };
    }

    const damage = skill.effect.value;
    eventBus.emit(GameEvents.SKILL_CAST, { skill, targetType, damage });
    return {
      success: true,
      message: `\u91CA\u653E\u3010${skill.name}\u3011\uFF0C\u9020\u6210 ${damage} 点伤害！`,
      skill,
      damage
    };
  }

  function getSkillBar(): SkillBarSlot[] {
    return skillBar.value;
  }

  function setSkillBar(slotIndex: number, skillId: string | null): void {
    if (slotIndex < 0 || slotIndex >= skillBar.value.length) {
      return;
    }

    if (skillId) {
      const skill = getSkill(skillId);
      if (!skill || !skill.learned) {
        return;
      }
    }

    skillBar.value[slotIndex].skillId = skillId;

    eventBus.emit(GameEvents.SKILL_BAR_UPDATE, { slotIndex, skillId });
  }

  function getState(): SkillState {
    return state.value;
  }

  function updateCooldowns(): void {
    for (const skill of skills.value) {
      if (skill.currentCooldown > 0) {
        skill.currentCooldown--;
      }
    }
  }

  function updateBuffs(): void {
    activeBuffs.value = activeBuffs.value.filter(buff => {
      buff.remainingDuration--;
      return buff.remainingDuration > 0;
    });

    activeDebuffs.value = activeDebuffs.value.filter(debuff => {
      debuff.remainingDuration--;
      return debuff.remainingDuration > 0;
    });
  }

  function addBuff(buff: Buff): void {
    activeBuffs.value.push(buff);
  }

  function removeBuff(buffId: string): void {
    activeBuffs.value = activeBuffs.value.filter(b => b.id !== buffId);
  }

  function addDebuff(debuff: Debuff): void {
    activeDebuffs.value.push(debuff);
  }

  function removeDebuff(debuffId: string): void {
    activeDebuffs.value = activeDebuffs.value.filter(d => d.id !== debuffId);
  }

  function resetSkills(): void {
    skills.value = JSON.parse(JSON.stringify(INITIAL_SKILLS));
    skillBar.value = [
      { id: 'slot_1', skillId: null, position: 1 },
      { id: 'slot_2', skillId: null, position: 2 },
      { id: 'slot_3', skillId: null, position: 3 },
      { id: 'slot_4', skillId: null, position: 4 },
      { id: 'slot_5', skillId: null, position: 5 },
      { id: 'slot_6', skillId: null, position: 6 },
      { id: 'slot_7', skillId: null, position: 7 },
      { id: 'slot_8', skillId: null, position: 8 }
    ];
    activeBuffs.value = [];
    activeDebuffs.value = [];
  }

  return {
    skills,
    skillBar,
    activeBuffs,
    activeDebuffs,
    state,
    getSkills,
    getSkill,
    getLearnedSkills,
    getAvailableSkills,
    learnSkill,
    upgradeSkill,
    castSkill,
    getSkillBar,
    setSkillBar,
    getState,
    updateCooldowns,
    updateBuffs,
    addBuff,
    removeBuff,
    addDebuff,
    removeDebuff,
    resetSkills
  };
});

export const skillsService: ISkillsService = {
  getSkills: () => useSkillsStore().getSkills(),
  getSkill: (skillId: string) => useSkillsStore().getSkill(skillId),
  getLearnedSkills: () => useSkillsStore().getLearnedSkills(),
  getAvailableSkills: () => useSkillsStore().getAvailableSkills(),
  learnSkill: (skillId: string) => useSkillsStore().learnSkill(skillId),
  upgradeSkill: (skillId: string) => useSkillsStore().upgradeSkill(skillId),
  castSkill: (skillId: string, targetType: 'self' | 'enemy') => useSkillsStore().castSkill(skillId, targetType),
  getSkillBar: () => useSkillsStore().getSkillBar(),
  setSkillBar: (slotIndex: number, skillId: string | null) => useSkillsStore().setSkillBar(slotIndex, skillId),
  getState: () => useSkillsStore().getState(),
  updateCooldowns: () => useSkillsStore().updateCooldowns(),
  updateBuffs: () => useSkillsStore().updateBuffs(),
  addBuff: (buff: Buff) => useSkillsStore().addBuff(buff),
  removeBuff: (buffId: string) => useSkillsStore().removeBuff(buffId),
  addDebuff: (debuff: Debuff) => useSkillsStore().addDebuff(debuff),
  removeDebuff: (debuffId: string) => useSkillsStore().removeDebuff(debuffId)
};
