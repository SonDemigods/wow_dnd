/**
 * @fileoverview 术士召唤系统单元测试
 * @description 覆盖：
 * 1. warlockPets 数据：5 种召唤物定义、getPetByType、getAllPets、getSummonablePets
 * 2. pets/service 纯函数：
 *    - calculatePetAttributes（等级加成计算）
 *    - createPetInstance（实例创建）
 *    - canSummonPet / canDismissPet（校验）
 *    - summonPet / dismissPet（状态更新）
 *    - calculatePetSkillDamage / damagePet / healPet / isPetDead
 *    - isSkillReady / getReadySkills / setSkillCooldown / tickSkillCooldowns
 *    - selectPetAction（AI 行动选择）
 *    - createInitialPetState / unlockPet / tickPetTurn
 * 3. PET_SUMMON_CONFIG 常量
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  WARLOCK_PETS,
  DEFAULT_UNLOCKED_PETS,
  getPetByType,
  getAllPets,
  getSummonablePets,
} from '@/modules/combat/pets/warlockPets';
import {
  generatePetInstanceId,
  calculatePetAttributes,
  createPetInstance,
  canSummonPet,
  canDismissPet,
  summonPet,
  dismissPet,
  calculatePetSkillDamage,
  damagePet,
  healPet,
  isPetDead,
  isSkillReady,
  getReadySkills,
  setSkillCooldown,
  tickSkillCooldowns,
  selectPetAction,
  createInitialPetState,
  unlockPet,
  tickPetTurn,
  getActivePetDefinition,
  getActivePetSoulShardCost,
} from '@/modules/combat/pets/service';
import { PET_SUMMON_CONFIG } from '@/modules/combat/pets/types';
import type {
  PetInstance,
  PetSystemState,
  WarlockPetType,
  PetSkill,
} from '@/modules/combat/pets/types';

// ============================================================
// PET_SUMMON_CONFIG 常量
// ============================================================

describe('PET_SUMMON_CONFIG 常量', () => {
  it('hpGrowthPerLevel 为 0.05（每级 +5%）', () => {
    expect(PET_SUMMON_CONFIG.hpGrowthPerLevel).toBe(0.05);
  });

  it('damageGrowthPerLevel 为 0.03（每级 +3%）', () => {
    expect(PET_SUMMON_CONFIG.damageGrowthPerLevel).toBe(0.03);
  });

  it('defenseGrowthPerLevel 为 0.03（每级 +3%）', () => {
    expect(PET_SUMMON_CONFIG.defenseGrowthPerLevel).toBe(0.03);
  });

  it('statGrowthPerLevel 为 1（每级 +1 全属性）', () => {
    expect(PET_SUMMON_CONFIG.statGrowthPerLevel).toBe(1);
  });

  it('instanceIdPrefix 为 "pet_"', () => {
    expect(PET_SUMMON_CONFIG.instanceIdPrefix).toBe('pet_');
  });
});

// ============================================================
// WARLOCK_PETS 数据
// ============================================================

describe('WARLOCK_PETS 召唤物数据', () => {
  it('包含 5 种召唤物', () => {
    expect(Object.keys(WARLOCK_PETS)).toHaveLength(5);
    expect(Object.keys(WARLOCK_PETS)).toEqual(
      expect.arrayContaining(['imp', 'voidwalker', 'succubus', 'felhunter', 'doomguard'])
    );
  });

  describe('imp 小鬼', () => {
    const pet = WARLOCK_PETS.imp;

    it('消耗 1 灵魂碎片', () => {
      expect(pet.soulShardCost).toBe(1);
    });

    it('永久存在（duration=0）', () => {
      expect(pet.duration).toBe(0);
    });

    it('AI 行为为 caster', () => {
      expect(pet.aiBehavior).toBe('caster');
    });

    it('有 3 个技能', () => {
      expect(pet.skills).toHaveLength(3);
    });

    it('火球术 damageMultiplier=1.0', () => {
      const firebolt = pet.skills.find(s => s.id === 'firebolt');
      expect(firebolt?.damageMultiplier).toBe(1.0);
    });
  });

  describe('voidwalker 虚空行者', () => {
    const pet = WARLOCK_PETS.voidwalker;

    it('消耗 1 灵魂碎片', () => {
      expect(pet.soulShardCost).toBe(1);
    });

    it('AI 行为为 defensive（坦克）', () => {
      expect(pet.aiBehavior).toBe('defensive');
    });

    it('高生命高防御', () => {
      expect(pet.attributes.baseHp).toBe(80);
      expect(pet.attributes.baseDefense).toBe(10);
    });
  });

  describe('succubus 魅魔', () => {
    const pet = WARLOCK_PETS.succubus;

    it('消耗 2 灵魂碎片', () => {
      expect(pet.soulShardCost).toBe(2);
    });

    it('AI 行为为 controller', () => {
      expect(pet.aiBehavior).toBe('controller');
    });

    it('有魅惑控制技能', () => {
      expect(pet.skills.some(s => s.id === 'seduction')).toBe(true);
    });
  });

  describe('felhunter 地狱犬', () => {
    const pet = WARLOCK_PETS.felhunter;

    it('消耗 2 灵魂碎片', () => {
      expect(pet.soulShardCost).toBe(2);
    });

    it('AI 行为为 support', () => {
      expect(pet.aiBehavior).toBe('support');
    });

    it('有法术封锁技能（沉默）', () => {
      expect(pet.skills.some(s => s.id === 'spell_lock')).toBe(true);
    });
  });

  describe('doomguard 末日守卫', () => {
    const pet = WARLOCK_PETS.doomguard;

    it('消耗 3 灵魂碎片（最贵）', () => {
      expect(pet.soulShardCost).toBe(3);
    });

    it('限时 10 回合', () => {
      expect(pet.duration).toBe(10);
    });

    it('AI 行为为 aggressive', () => {
      expect(pet.aiBehavior).toBe('aggressive');
    });

    it('最强属性（baseDamage=25）', () => {
      expect(pet.attributes.baseDamage).toBe(25);
    });

    it('有火焰之雨（范围伤害，倍率 1.5）', () => {
      const rain = pet.skills.find(s => s.id === 'rain_of_fire');
      expect(rain?.damageMultiplier).toBe(1.5);
    });
  });
});

describe('DEFAULT_UNLOCKED_PETS', () => {
  it('默认解锁 imp 和 voidwalker', () => {
    expect(DEFAULT_UNLOCKED_PETS).toEqual(['imp', 'voidwalker']);
  });
});

describe('getPetByType', () => {
  it('返回指定召唤物定义', () => {
    expect(getPetByType('imp')).toBe(WARLOCK_PETS.imp);
    expect(getPetByType('doomguard')).toBe(WARLOCK_PETS.doomguard);
  });
});

describe('getAllPets', () => {
  it('返回全部 5 种召唤物数组', () => {
    const all = getAllPets();
    expect(all).toHaveLength(5);
  });
});

describe('getSummonablePets', () => {
  it('soulShards=0 时返回空数组', () => {
    expect(getSummonablePets(0)).toEqual([]);
  });

  it('soulShards=1 时返回 1 碎片的召唤物（imp, voidwalker）', () => {
    const pets = getSummonablePets(1);
    expect(pets.map(p => p.id)).toEqual(expect.arrayContaining(['imp', 'voidwalker']));
    expect(pets).toHaveLength(2);
  });

  it('soulShards=2 时返回 4 种召唤物', () => {
    const pets = getSummonablePets(2);
    expect(pets.map(p => p.id)).toEqual(
      expect.arrayContaining(['imp', 'voidwalker', 'succubus', 'felhunter'])
    );
    expect(pets).toHaveLength(4);
  });

  it('soulShards=3 时返回全部 5 种', () => {
    const pets = getSummonablePets(3);
    expect(pets).toHaveLength(5);
  });

  it('soulShards>=3 时仍返回 5 种（不会超过）', () => {
    expect(getSummonablePets(10)).toHaveLength(5);
  });
});

// ============================================================
// generatePetInstanceId
// ============================================================

describe('generatePetInstanceId', () => {
  it('返回以 "pet_" 开头的 ID', () => {
    const id = generatePetInstanceId();
    expect(id.startsWith('pet_')).toBe(true);
  });

  it('每次调用返回不同 ID', () => {
    const id1 = generatePetInstanceId();
    const id2 = generatePetInstanceId();
    expect(id1).not.toBe(id2);
  });
});

// ============================================================
// calculatePetAttributes — 等级加成计算
// ============================================================

describe('calculatePetAttributes 等级加成', () => {
  it('level=1 时无加成（levelBonus=0）', () => {
    const attrs = calculatePetAttributes('imp', 1);
    const base = WARLOCK_PETS.imp.attributes;
    expect(attrs.maxHp).toBe(base.baseHp);
    expect(attrs.damage).toBe(base.baseDamage);
    expect(attrs.defense).toBe(base.baseDefense);
    expect(attrs.speed).toBe(base.baseSpeed);
  });

  it('level=2 时 life +5%（levelBonus=1）', () => {
    const attrs = calculatePetAttributes('imp', 2);
    const base = WARLOCK_PETS.imp.attributes;
    // maxHp = floor(30 * (1 + 0.05 * 1)) = floor(31.5) = 31
    expect(attrs.maxHp).toBe(Math.floor(base.baseHp * 1.05));
  });

  it('level=10 时 damage +27%（levelBonus=9）', () => {
    const attrs = calculatePetAttributes('imp', 10);
    const base = WARLOCK_PETS.imp.attributes;
    // damage = floor(15 * (1 + 0.03 * 9)) = floor(15 * 1.27) = floor(19.05) = 19
    expect(attrs.damage).toBe(Math.floor(base.baseDamage * (1 + 0.03 * 9)));
  });

  it('speed 不随等级变化', () => {
    const attrs1 = calculatePetAttributes('imp', 1);
    const attrs10 = calculatePetAttributes('imp', 10);
    expect(attrs10.speed).toBe(attrs1.speed);
  });

  it('六维属性按 statGrowthPerLevel 增长', () => {
    const attrs = calculatePetAttributes('imp', 3);
    const base = WARLOCK_PETS.imp.attributes;
    // levelBonus=2, statGrowth=1 → 每项 +2
    expect(attrs.stats.str).toBe(base.baseStats.str + 2);
    expect(attrs.stats.int).toBe(base.baseStats.int + 2);
  });

  it('level=0 时按 level=1 处理（max(0, -1)=0）', () => {
    const attrs = calculatePetAttributes('imp', 0);
    const base = WARLOCK_PETS.imp.attributes;
    expect(attrs.maxHp).toBe(base.baseHp);
  });

  it('不同召唤物的基础属性不同', () => {
    const imp = calculatePetAttributes('imp', 1);
    const voidwalker = calculatePetAttributes('voidwalker', 1);
    expect(voidwalker.maxHp).toBeGreaterThan(imp.maxHp);
    expect(imp.damage).toBeGreaterThan(voidwalker.damage);
  });
});

// ============================================================
// createPetInstance — 实例创建
// ============================================================

describe('createPetInstance 实例创建', () => {
  it('返回完整 PetInstance 对象', () => {
    const instance = createPetInstance('imp', 1);
    expect(instance).toHaveProperty('instanceId');
    expect(instance).toHaveProperty('petId', 'imp');
    expect(instance).toHaveProperty('name', '小鬼');
    expect(instance).toHaveProperty('level', 1);
    expect(instance).toHaveProperty('hp');
    expect(instance).toHaveProperty('maxHp');
    expect(instance).toHaveProperty('skillCooldowns');
  });

  it('hp 初始等于 maxHp（满血）', () => {
    const instance = createPetInstance('imp', 5);
    expect(instance.hp).toBe(instance.maxHp);
  });

  it('技能冷却映射初始化为 0', () => {
    const instance = createPetInstance('imp', 1);
    for (const skill of instance.skills) {
      expect(instance.skillCooldowns[skill.id]).toBe(0);
    }
  });

  it('durationRemaining 等于定义的 duration', () => {
    const imp = createPetInstance('imp', 1);
    expect(imp.durationRemaining).toBe(0); // imp 永久

    const doomguard = createPetInstance('doomguard', 1);
    expect(doomguard.durationRemaining).toBe(10); // 末日守卫 10 回合
  });

  it('aiBehavior 来自召唤物定义', () => {
    expect(createPetInstance('imp', 1).aiBehavior).toBe('caster');
    expect(createPetInstance('voidwalker', 1).aiBehavior).toBe('defensive');
    expect(createPetInstance('doomguard', 1).aiBehavior).toBe('aggressive');
  });

  it('skills 是定义技能的副本（不共享引用）', () => {
    const instance = createPetInstance('imp', 1);
    expect(instance.skills).not.toBe(WARLOCK_PETS.imp.skills);
    expect(instance.skills).toEqual(WARLOCK_PETS.imp.skills);
  });

  it('instanceId 唯一', () => {
    const a = createPetInstance('imp', 1);
    const b = createPetInstance('imp', 1);
    expect(a.instanceId).not.toBe(b.instanceId);
  });
});

// ============================================================
// canSummonPet / canDismissPet — 校验
// ============================================================

describe('canSummonPet 召唤校验', () => {
  it('已解锁 + 碎片足够 + 无激活 → 可召唤', () => {
    const state = createInitialPetState();
    const result = canSummonPet('imp', state, 1);
    expect(result.canSummon).toBe(true);
    expect(result.reason).toBe('');
  });

  it('未解锁的召唤物不可召唤', () => {
    const state = createInitialPetState(); // 默认仅 imp, voidwalker
    const result = canSummonPet('succubus', state, 5);
    expect(result.canSummon).toBe(false);
    expect(result.reason).toContain('尚未解锁');
  });

  it('灵魂碎片不足不可召唤', () => {
    const state = createInitialPetState();
    const result = canSummonPet('imp', state, 0); // imp 需要 1 碎片
    expect(result.canSummon).toBe(false);
    expect(result.reason).toContain('灵魂碎片不足');
    expect(result.reason).toContain('1');
  });

  it('已有激活召唤物不可召唤', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('imp', 1),
      unlockedPets: ['imp', 'voidwalker'],
    };
    const result = canSummonPet('voidwalker', state, 5);
    expect(result.canSummon).toBe(false);
    expect(result.reason).toContain('已有激活');
  });

  it('doomguard 需要 3 碎片', () => {
    const state: PetSystemState = {
      activePet: null,
      unlockedPets: ['imp', 'voidwalker', 'succubus', 'felhunter', 'doomguard'],
    };
    expect(canSummonPet('doomguard', state, 2).canSummon).toBe(false);
    expect(canSummonPet('doomguard', state, 3).canSummon).toBe(true);
  });
});

describe('canDismissPet 解散校验', () => {
  it('有激活召唤物时可解散', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('imp', 1),
      unlockedPets: ['imp'],
    };
    expect(canDismissPet(state).canDismiss).toBe(true);
  });

  it('无激活召唤物时不可解散', () => {
    const state = createInitialPetState();
    const result = canDismissPet(state);
    expect(result.canDismiss).toBe(false);
    expect(result.reason).toContain('没有激活');
  });
});

// ============================================================
// summonPet / dismissPet — 状态更新
// ============================================================

describe('summonPet 召唤', () => {
  it('返回新状态，activePet 为新实例', () => {
    const state = createInitialPetState();
    const newState = summonPet(state, 'imp', 5);
    expect(newState.activePet).not.toBeNull();
    expect(newState.activePet?.petId).toBe('imp');
    expect(newState.activePet?.level).toBe(5);
  });

  it('不修改原状态', () => {
    const state = createInitialPetState();
    summonPet(state, 'imp', 1);
    expect(state.activePet).toBeNull();
  });

  it('保留 unlockedPets', () => {
    const state = createInitialPetState();
    const newState = summonPet(state, 'imp', 1);
    expect(newState.unlockedPets).toEqual(['imp', 'voidwalker']);
  });
});

describe('dismissPet 解散', () => {
  it('返回新状态，activePet 为 null', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('imp', 1),
      unlockedPets: ['imp'],
    };
    const newState = dismissPet(state);
    expect(newState.activePet).toBeNull();
  });

  it('不修改原状态', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('imp', 1),
      unlockedPets: ['imp'],
    };
    dismissPet(state);
    expect(state.activePet).not.toBeNull();
  });
});

// ============================================================
// 战斗逻辑
// ============================================================

describe('calculatePetSkillDamage 技能伤害', () => {
  it('返回 floor(pet.damage × skill.damageMultiplier)', () => {
    const pet = createPetInstance('imp', 1);
    const skill = WARLOCK_PETS.imp.skills[0]; // firebolt, 1.0
    expect(calculatePetSkillDamage(pet, skill)).toBe(Math.floor(pet.damage * 1.0));
  });

  it('damageMultiplier=1.5 时正确计算', () => {
    const pet = createPetInstance('doomguard', 1);
    const skill = WARLOCK_PETS.doomguard.skills[0]; // rain_of_fire, 1.5
    expect(calculatePetSkillDamage(pet, skill)).toBe(Math.floor(pet.damage * 1.5));
  });

  it('damageMultiplier=0 时返回 0', () => {
    const pet = createPetInstance('imp', 1);
    const buffSkill = WARLOCK_PETS.imp.skills.find(s => s.damageMultiplier === 0)!;
    expect(calculatePetSkillDamage(pet, buffSkill)).toBe(0);
  });
});

describe('damagePet 受伤', () => {
  it('扣减 HP', () => {
    const pet = createPetInstance('imp', 1);
    const damaged = damagePet(pet, 10);
    expect(damaged.hp).toBe(pet.maxHp - 10);
  });

  it('HP 不会低于 0', () => {
    const pet = createPetInstance('imp', 1);
    const damaged = damagePet(pet, 9999);
    expect(damaged.hp).toBe(0);
  });

  it('负伤害不治疗（max(0, damage)）', () => {
    const pet = createPetInstance('imp', 1);
    const damaged = damagePet(pet, -10);
    expect(damaged.hp).toBe(pet.maxHp);
  });

  it('不修改原实例', () => {
    const pet = createPetInstance('imp', 1);
    damagePet(pet, 10);
    expect(pet.hp).toBe(pet.maxHp);
  });
});

describe('healPet 治疗', () => {
  it('恢复 HP', () => {
    const pet = createPetInstance('imp', 1);
    const damaged = damagePet(pet, 20);
    const healed = healPet(damaged, 10);
    expect(healed.hp).toBe(damaged.hp + 10);
  });

  it('HP 不会超过 maxHp', () => {
    const pet = createPetInstance('imp', 1);
    const damaged = damagePet(pet, 5);
    const healed = healPet(damaged, 9999);
    expect(healed.hp).toBe(pet.maxHp);
  });

  it('满血时治疗无效', () => {
    const pet = createPetInstance('imp', 1);
    const healed = healPet(pet, 10);
    expect(healed.hp).toBe(pet.maxHp);
  });
});

describe('isPetDead 死亡判定', () => {
  it('HP>0 时返回 false', () => {
    const pet = createPetInstance('imp', 1);
    expect(isPetDead(pet)).toBe(false);
  });

  it('HP=0 时返回 true', () => {
    const pet = createPetInstance('imp', 1);
    const dead = damagePet(pet, 9999);
    expect(isPetDead(dead)).toBe(true);
  });

  it('HP<0 时返回 true（异常情况）', () => {
    const pet: PetInstance = { ...createPetInstance('imp', 1), hp: -5 };
    expect(isPetDead(pet)).toBe(true);
  });
});

// ============================================================
// 技能冷却管理
// ============================================================

describe('isSkillReady 技能可用', () => {
  it('冷却为 0 时可用', () => {
    const pet = createPetInstance('imp', 1);
    expect(isSkillReady(pet, 'firebolt')).toBe(true);
  });

  it('冷却 >0 时不可用', () => {
    const pet = createPetInstance('imp', 1);
    // firebolt 的 cooldown=0 无法触发冷却，改用 fire_shield（cooldown=3）
    const onCooldown = setSkillCooldown(pet, 'fire_shield');
    expect(isSkillReady(onCooldown, 'fire_shield')).toBe(false);
  });

  it('未知技能 ID 返回 true（冷却 0）', () => {
    const pet = createPetInstance('imp', 1);
    expect(isSkillReady(pet, 'unknown_skill')).toBe(true);
  });
});

describe('getReadySkills 可用技能', () => {
  it('初始状态下所有技能可用', () => {
    const pet = createPetInstance('imp', 1);
    expect(getReadySkills(pet)).toHaveLength(pet.skills.length);
  });

  it('设置冷却后该技能被过滤', () => {
    const pet = createPetInstance('imp', 1);
    // firebolt cooldown=0 无法触发冷却，改用 fire_shield（cooldown=3）
    const onCooldown = setSkillCooldown(pet, 'fire_shield');
    const ready = getReadySkills(onCooldown);
    expect(ready).toHaveLength(pet.skills.length - 1);
    expect(ready.some(s => s.id === 'fire_shield')).toBe(false);
  });
});

describe('setSkillCooldown 设置冷却', () => {
  it('设置技能冷却为 skill.cooldown', () => {
    const pet = createPetInstance('imp', 1);
    const fireShield = WARLOCK_PETS.imp.skills.find(s => s.id === 'fire_shield')!;
    const result = setSkillCooldown(pet, 'fire_shield');
    expect(result.skillCooldowns['fire_shield']).toBe(fireShield.cooldown);
  });

  it('不修改原实例', () => {
    const pet = createPetInstance('imp', 1);
    setSkillCooldown(pet, 'firebolt');
    expect(pet.skillCooldowns['firebolt']).toBe(0);
  });

  it('未知技能 ID 返回原实例', () => {
    const pet = createPetInstance('imp', 1);
    const result = setSkillCooldown(pet, 'unknown_skill');
    expect(result).toBe(pet);
  });

  it('冷却 0 的技能设置后仍为 0', () => {
    const pet = createPetInstance('imp', 1);
    const result = setSkillCooldown(pet, 'firebolt'); // firebolt cooldown=0
    expect(result.skillCooldowns['firebolt']).toBe(0);
  });
});

describe('tickSkillCooldowns 冷却推进', () => {
  it('所有冷却 -1', () => {
    const pet = createPetInstance('imp', 1);
    let state = setSkillCooldown(pet, 'fire_shield'); // cooldown=3
    state = setSkillCooldown(state, 'blood_pact'); // cooldown=5
    state = tickSkillCooldowns(state);
    expect(state.skillCooldowns['fire_shield']).toBe(2);
    expect(state.skillCooldowns['blood_pact']).toBe(4);
  });

  it('冷却不会低于 0', () => {
    const pet = createPetInstance('imp', 1);
    let state = setSkillCooldown(pet, 'firebolt'); // cooldown=0
    state = tickSkillCooldowns(state);
    expect(state.skillCooldowns['firebolt']).toBe(0);
  });

  it('不修改原实例', () => {
    const pet = createPetInstance('imp', 1);
    const state = setSkillCooldown(pet, 'fire_shield');
    tickSkillCooldowns(state);
    expect(state.skillCooldowns['fire_shield']).toBe(3);
  });
});

// ============================================================
// selectPetAction — AI 行动选择
// ============================================================

describe('selectPetAction AI 行动选择', () => {
  it('无可用技能时返回默认攻击', () => {
    // 使用 doomguard：所有技能 cooldown>0（rain_of_fire=3, doom_bolt=2, cripple=4）
    const pet = createPetInstance('doomguard', 1);
    let cooledDown = pet;
    for (const skill of pet.skills) {
      cooledDown = setSkillCooldown(cooledDown, skill.id);
    }
    const action = selectPetAction(cooledDown);
    expect(action.id).toBe('basic_attack');
    expect(action.damageMultiplier).toBe(1.0);
    expect(action.priority).toBe(0);
  });

  it('有可用技能时选优先级最高的', () => {
    const pet = createPetInstance('imp', 1);
    // imp 技能优先级：firebolt=10, fire_shield=5, blood_pact=3
    const action = selectPetAction(pet);
    expect(action.id).toBe('firebolt'); // priority=10 最高
  });

  it('选择优先级最高的技能（doomguard）', () => {
    const pet = createPetInstance('doomguard', 1);
    // doomguard: rain_of_fire=10, doom_bolt=9, cripple=7
    const action = selectPetAction(pet);
    expect(action.id).toBe('rain_of_fire');
  });

  it('部分技能冷却时选可用中优先级最高的', () => {
    // 使用 doomguard：rain_of_fire=10, doom_bolt=9, cripple=7
    const pet = createPetInstance('doomguard', 1);
    // 将 rain_of_fire（priority=10）设为冷却
    const cooled = setSkillCooldown(pet, 'rain_of_fire');
    const action = selectPetAction(cooled);
    // 剩余：doom_bolt=9, cripple=7 → 选 doom_bolt
    expect(action.id).toBe('doom_bolt');
  });
});

// ============================================================
// 状态管理
// ============================================================

describe('createInitialPetState 初始状态', () => {
  it('无激活召唤物', () => {
    const state = createInitialPetState();
    expect(state.activePet).toBeNull();
  });

  it('默认解锁 imp 和 voidwalker', () => {
    const state = createInitialPetState();
    expect(state.unlockedPets).toEqual(['imp', 'voidwalker']);
  });

  it('返回新对象（不共享引用）', () => {
    const a = createInitialPetState();
    const b = createInitialPetState();
    expect(a).not.toBe(b);
    expect(a.unlockedPets).not.toBe(b.unlockedPets);
  });
});

describe('unlockPet 解锁召唤物', () => {
  it('解锁新召唤物', () => {
    const state = createInitialPetState();
    const newState = unlockPet(state, 'succubus');
    expect(newState.unlockedPets).toContain('succubus');
    expect(newState.unlockedPets).toHaveLength(3);
  });

  it('已解锁的召唤物不重复添加', () => {
    const state = createInitialPetState();
    const newState = unlockPet(state, 'imp'); // 已解锁
    expect(newState.unlockedPets).toEqual(state.unlockedPets);
    expect(newState).toBe(state); // 返回原状态
  });

  it('不修改原状态', () => {
    const state = createInitialPetState();
    unlockPet(state, 'succubus');
    expect(state.unlockedPets).toHaveLength(2);
  });

  it('连续解锁多个', () => {
    let state = createInitialPetState();
    state = unlockPet(state, 'succubus');
    state = unlockPet(state, 'felhunter');
    state = unlockPet(state, 'doomguard');
    expect(state.unlockedPets).toHaveLength(5);
  });
});

describe('tickPetTurn 回合推进', () => {
  it('无激活召唤物时返回原状态', () => {
    const state = createInitialPetState();
    const result = tickPetTurn(state);
    expect(result).toBe(state);
  });

  it('召唤物死亡时清空 activePet', () => {
    const pet = createPetInstance('imp', 1);
    const deadPet = damagePet(pet, 9999);
    const state: PetSystemState = {
      activePet: deadPet,
      unlockedPets: ['imp'],
    };
    const result = tickPetTurn(state);
    expect(result.activePet).toBeNull();
  });

  it('减少技能冷却', () => {
    const pet = createPetInstance('imp', 1);
    const onCooldown = setSkillCooldown(pet, 'fire_shield'); // cooldown=3
    const state: PetSystemState = {
      activePet: onCooldown,
      unlockedPets: ['imp'],
    };
    const result = tickPetTurn(state);
    expect(result.activePet?.skillCooldowns['fire_shield']).toBe(2);
  });

  it('永久召唤物（duration=0）不减少持续时间', () => {
    const pet = createPetInstance('imp', 1); // duration=0
    const state: PetSystemState = {
      activePet: pet,
      unlockedPets: ['imp'],
    };
    const result = tickPetTurn(state);
    expect(result.activePet?.durationRemaining).toBe(0);
  });

  it('限时召唤物减少持续时间', () => {
    const pet = createPetInstance('doomguard', 1); // duration=10
    const state: PetSystemState = {
      activePet: pet,
      unlockedPets: ['doomguard'],
    };
    const result = tickPetTurn(state);
    expect(result.activePet?.durationRemaining).toBe(9);
  });

  it('持续时间到期时清空 activePet', () => {
    const pet = createPetInstance('doomguard', 1);
    // 手动设置 durationRemaining=1
    const almostExpired: PetInstance = { ...pet, durationRemaining: 1 };
    const state: PetSystemState = {
      activePet: almostExpired,
      unlockedPets: ['doomguard'],
    };
    const result = tickPetTurn(state);
    expect(result.activePet).toBeNull();
  });

  it('不修改原状态', () => {
    const pet = createPetInstance('doomguard', 1);
    const state: PetSystemState = {
      activePet: pet,
      unlockedPets: ['doomguard'],
    };
    tickPetTurn(state);
    expect(state.activePet?.durationRemaining).toBe(10);
  });
});

// ============================================================
// 辅助查询函数
// ============================================================

describe('getActivePetDefinition', () => {
  it('无激活召唤物时返回 null', () => {
    const state = createInitialPetState();
    expect(getActivePetDefinition(state)).toBeNull();
  });

  it('有激活召唤物时返回定义', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('imp', 1),
      unlockedPets: ['imp'],
    };
    expect(getActivePetDefinition(state)).toBe(WARLOCK_PETS.imp);
  });
});

describe('getActivePetSoulShardCost', () => {
  it('无激活召唤物时返回 0', () => {
    const state = createInitialPetState();
    expect(getActivePetSoulShardCost(state)).toBe(0);
  });

  it('返回激活召唤物的碎片消耗', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('imp', 1),
      unlockedPets: ['imp'],
    };
    expect(getActivePetSoulShardCost(state)).toBe(1);
  });

  it('doomguard 返回 3', () => {
    const state: PetSystemState = {
      activePet: createPetInstance('doomguard', 1),
      unlockedPets: ['doomguard'],
    };
    expect(getActivePetSoulShardCost(state)).toBe(3);
  });
});
