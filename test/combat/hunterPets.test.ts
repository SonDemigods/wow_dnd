/**
 * @fileoverview 猎人野兽宠物系统单元测试（P3-156 扩展）
 *
 * 覆盖：
 * 1. hunterPets 数据：5 种野兽宠物定义完整性、getHunterPetByType、getAllHunterPets、getSummonableHunterPets
 * 2. service 通用函数：
 *    - getPetDefinition（通用查询，术士+猎人）
 *    - getPetResourceCost（通用资源消耗）
 *    - getDefaultUnlockedPets（按 owner 返回默认解锁列表）
 *    - calculatePetAttributes（猎人宠物等级加成）
 *    - createPetInstance（猎人宠物实例创建，含 owner 字段）
 *    - canSummonPet（猎人宠物集中值校验）
 *    - summonPet（猎人宠物召唤）
 * 3. createInitialPetState（owner='hunter' 时返回猎人默认解锁列表）
 * 4. unlockPet（猎人宠物解锁）
 * 5. 类型兼容性：Pet 联合类型、PetInstance.owner 字段
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HUNTER_PETS,
  DEFAULT_UNLOCKED_HUNTER_PETS,
  getHunterPetByType,
  getAllHunterPets,
  getSummonableHunterPets,
} from '@/modules/combat/pets/hunterPets';
import {
  getPetDefinition,
  getPetResourceCost,
  getDefaultUnlockedPets,
  calculatePetAttributes,
  createPetInstance,
  canSummonPet,
  summonPet,
  createInitialPetState,
  unlockPet,
  isPetDead,
  selectPetAction,
} from '@/modules/combat/pets/service';
import type {
  HunterPetType,
  Pet,
  PetSystemState,
} from '@/modules/combat/pets/types';

// ============================================================
// hunterPets 数据完整性
// ============================================================

describe('hunterPets 数据完整性', () => {
  const expectedIds: HunterPetType[] = ['wolf', 'bear', 'cat', 'boar', 'devilsaur'];

  it('HUNTER_PETS 包含 5 种野兽宠物', () => {
    expect(Object.keys(HUNTER_PETS)).toHaveLength(5);
    for (const id of expectedIds) {
      expect(HUNTER_PETS[id]).toBeDefined();
    }
  });

  it('每种宠物都有完整的必填字段', () => {
    for (const pet of Object.values(HUNTER_PETS)) {
      expect(pet.id).toBeTruthy();
      expect(pet.name).toBeTruthy();
      expect(pet.icon).toBeTruthy();
      expect(pet.description).toBeTruthy();
      expect(pet.aiBehavior).toBeTruthy();
      expect(pet.attributes).toBeDefined();
      expect(pet.skills).toBeInstanceOf(Array);
      expect(pet.skills.length).toBeGreaterThanOrEqual(3);
      expect(pet.focusCost).toBeGreaterThan(0);
      expect(pet.duration).toBeGreaterThanOrEqual(0);
      // P3-156 扩展字段
      expect(pet.owner).toBe('hunter');
      expect(pet.resourceType).toBe('focus');
    }
  });

  it('每种宠物有至少 1 个攻击技能', () => {
    for (const pet of Object.values(HUNTER_PETS)) {
      const attackSkills = pet.skills.filter(s => s.category === 'attack');
      expect(attackSkills.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('魔暴龙为限时宠物（duration > 0），其余为永久', () => {
    expect(HUNTER_PETS.devilsaur.duration).toBeGreaterThan(0);
    expect(HUNTER_PETS.wolf.duration).toBe(0);
    expect(HUNTER_PETS.bear.duration).toBe(0);
    expect(HUNTER_PETS.cat.duration).toBe(0);
    expect(HUNTER_PETS.boar.duration).toBe(0);
  });

  it('集中值消耗与宠物强度成正比（魔暴龙最高）', () => {
    expect(HUNTER_PETS.devilsaur.focusCost).toBe(80);
    expect(HUNTER_PETS.devilsaur.focusCost).toBeGreaterThan(HUNTER_PETS.wolf.focusCost);
    expect(HUNTER_PETS.wolf.focusCost).toBe(30);
    expect(HUNTER_PETS.bear.focusCost).toBe(30);
    expect(HUNTER_PETS.cat.focusCost).toBe(40);
    expect(HUNTER_PETS.boar.focusCost).toBe(40);
  });

  it('DEFAULT_UNLOCKED_HUNTER_PETS 默认解锁狼和熊', () => {
    expect(DEFAULT_UNLOCKED_HUNTER_PETS).toEqual(['wolf', 'bear']);
  });
});

// ============================================================
// hunterPets 查询函数
// ============================================================

describe('hunterPets 查询函数', () => {
  it('getHunterPetByType 返回对应宠物定义', () => {
    const wolf = getHunterPetByType('wolf');
    expect(wolf.id).toBe('wolf');
    expect(wolf.name).toBe('荒野之狼');
  });

  it('getAllHunterPets 返回 5 种宠物', () => {
    const all = getAllHunterPets();
    expect(all).toHaveLength(5);
  });

  it('getSummonableHunterPets 按集中值筛选可召唤宠物', () => {
    const affordable30 = getSummonableHunterPets(30);
    // 30 focus 可召唤 wolf(30) 和 bear(30)
    expect(affordable30.map(p => p.id).sort()).toEqual(['bear', 'wolf']);

    const affordable80 = getSummonableHunterPets(80);
    expect(affordable80).toHaveLength(5);

    const affordable0 = getSummonableHunterPets(0);
    expect(affordable0).toHaveLength(0);
  });
});

// ============================================================
// service 通用函数（术士 + 猎人）
// ============================================================

describe('service 通用函数（getPetDefinition / getPetResourceCost）', () => {
  it('getPetDefinition 对术士宠物返回 WarlockPet', () => {
    const pet = getPetDefinition('imp');
    expect(pet.owner).toBe('warlock');
    expect(pet.resourceType).toBe('soul_shard');
    expect(pet.name).toBe('小鬼');
  });

  it('getPetDefinition 对猎人宠物返回 HunterPet', () => {
    const pet = getPetDefinition('wolf');
    expect(pet.owner).toBe('hunter');
    expect(pet.resourceType).toBe('focus');
    expect(pet.name).toBe('荒野之狼');
  });

  it('getPetResourceCost 对术士宠物返回 soulShardCost', () => {
    const pet = getPetDefinition('imp');
    expect(getPetResourceCost(pet)).toBe(1);
  });

  it('getPetResourceCost 对猎人宠物返回 focusCost', () => {
    const pet = getPetDefinition('wolf');
    expect(getPetResourceCost(pet)).toBe(30);
    const devilsaur = getPetDefinition('devilsaur');
    expect(getPetResourceCost(devilsaur)).toBe(80);
  });

  it('getDefaultUnlockedPets 术士返回小鬼+虚空行者', () => {
    const unlocked = getDefaultUnlockedPets('warlock');
    expect(unlocked).toEqual(['imp', 'voidwalker']);
  });

  it('getDefaultUnlockedPets 猎人返回狼+熊', () => {
    const unlocked = getDefaultUnlockedPets('hunter');
    expect(unlocked).toEqual(['wolf', 'bear']);
  });
});

// ============================================================
// 猎人宠物属性计算与实例创建
// ============================================================

describe('猎人宠物属性计算与实例创建', () => {
  it('calculatePetAttributes 对猎人宠物应用等级加成', () => {
    const attrsLv1 = calculatePetAttributes('wolf', 1);
    const attrsLv10 = calculatePetAttributes('wolf', 10);

    // level 1 时无加成
    expect(attrsLv1.maxHp).toBe(HUNTER_PETS.wolf.attributes.baseHp);
    expect(attrsLv1.damage).toBe(HUNTER_PETS.wolf.attributes.baseDamage);

    // level 10 时有加成
    expect(attrsLv10.maxHp).toBeGreaterThan(attrsLv1.maxHp);
    expect(attrsLv10.damage).toBeGreaterThan(attrsLv1.damage);
  });

  it('createPetInstance 创建猎人宠物实例含 owner 字段', () => {
    const instance = createPetInstance('wolf', 5);
    expect(instance.petId).toBe('wolf');
    expect(instance.name).toBe('荒野之狼');
    expect(instance.owner).toBe('hunter');
    expect(instance.hp).toBe(instance.maxHp);
    expect(instance.hp).toBeGreaterThan(0);
    expect(instance.skills).toHaveLength(3);
    expect(instance.skillCooldowns).toBeInstanceOf(Map);
    expect(instance.durationRemaining).toBe(0); // 永久宠物
  });

  it('createPetInstance 魔暴龙实例有持续时间', () => {
    const instance = createPetInstance('devilsaur', 5);
    expect(instance.durationRemaining).toBe(8);
  });

  it('createPetInstance 术士宠物实例 owner 为 warlock', () => {
    const instance = createPetInstance('imp', 5);
    expect(instance.owner).toBe('warlock');
  });
});

// ============================================================
// 猎人宠物召唤校验
// ============================================================

describe('猎人宠物召唤校验（canSummonPet）', () => {
  let state: PetSystemState;

  beforeEach(() => {
    state = createInitialPetState('hunter');
  });

  it('已解锁且集中值足够时可召唤', () => {
    // wolf 默认解锁，focusCost=30
    const result = canSummonPet('wolf', state, 30);
    expect(result.canSummon).toBe(true);
  });

  it('集中值不足时不可召唤', () => {
    const result = canSummonPet('wolf', state, 20);
    expect(result.canSummon).toBe(false);
    expect(result.reason).toContain('集中值不足');
  });

  it('未解锁的宠物不可召唤', () => {
    // cat 默认未解锁
    const result = canSummonPet('cat', state, 100);
    expect(result.canSummon).toBe(false);
    expect(result.reason).toContain('尚未解锁');
  });

  it('已有激活宠物时不可召唤', () => {
    const newState = summonPet(state, 'wolf', 5);
    const result = canSummonPet('bear', newState, 100);
    expect(result.canSummon).toBe(false);
    expect(result.reason).toContain('已有激活');
  });

  it('魔暴龙需要 80 集中值', () => {
    // 先解锁 devilsaur
    const unlocked = unlockPet(state, 'devilsaur');
    expect(canSummonPet('devilsaur', unlocked, 79).canSummon).toBe(false);
    expect(canSummonPet('devilsaur', unlocked, 80).canSummon).toBe(true);
  });
});

// ============================================================
// 猎人宠物状态管理
// ============================================================

describe('猎人宠物状态管理', () => {
  it('createInitialPetState hunter 返回猎人默认解锁列表', () => {
    const state = createInitialPetState('hunter');
    expect(state.activePet).toBeNull();
    expect(state.unlockedPets).toEqual(['wolf', 'bear']);
  });

  it('createInitialPetState warlock 返回术士默认解锁列表', () => {
    const state = createInitialPetState('warlock');
    expect(state.unlockedPets).toEqual(['imp', 'voidwalker']);
  });

  it('createInitialPetState 默认返回术士列表', () => {
    const state = createInitialPetState();
    expect(state.unlockedPets).toEqual(['imp', 'voidwalker']);
  });

  it('unlockPet 解锁猎人宠物', () => {
    let state = createInitialPetState('hunter');
    state = unlockPet(state, 'cat');
    expect(state.unlockedPets).toContain('cat');
    expect(state.unlockedPets).toHaveLength(3);
  });

  it('unlockPet 重复解锁不增加', () => {
    let state = createInitialPetState('hunter');
    state = unlockPet(state, 'wolf'); // wolf 已默认解锁
    expect(state.unlockedPets).toHaveLength(2);
  });

  it('summonPet 创建猎人宠物实例', () => {
    const state = createInitialPetState('hunter');
    const newState = summonPet(state, 'wolf', 5);
    expect(newState.activePet).not.toBeNull();
    expect(newState.activePet!.petId).toBe('wolf');
    expect(newState.activePet!.owner).toBe('hunter');
  });
});

// ============================================================
// 猎人宠物 AI 行动
// ============================================================

describe('猎人宠物 AI 行动', () => {
  it('selectPetAction 返回可用技能', () => {
    const instance = createPetInstance('wolf', 5);
    const skill = selectPetAction(instance);
    expect(skill).toBeDefined();
    expect(skill.category).toBe('attack'); // wolf 最高优先级技能是利爪突袭
  });

  it('猎人宠物受伤后可检测死亡', () => {
    const instance = createPetInstance('cat', 1);
    expect(isPetDead(instance)).toBe(false);
    const damaged = { ...instance, hp: 0 };
    expect(isPetDead(damaged)).toBe(true);
  });
});

// ============================================================
// 类型兼容性
// ============================================================

describe('类型兼容性', () => {
  it('HunterPet 可赋值给 Pet 联合类型', () => {
    const pet: Pet = HUNTER_PETS.wolf;
    expect(pet.owner).toBe('hunter');
  });

  it('WarlockPet 可赋值给 Pet 联合类型', () => {
    const pet: Pet = getPetDefinition('imp');
    expect(pet.owner).toBe('warlock');
  });

  it('PetInstance.owner 正确区分术士和猎人', () => {
    const warlockPet = createPetInstance('imp', 5);
    const hunterPet = createPetInstance('wolf', 5);
    expect(warlockPet.owner).toBe('warlock');
    expect(hunterPet.owner).toBe('hunter');
  });
});
