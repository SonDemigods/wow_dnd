/**
 * @fileoverview P3-167 怪物/Boss 扩展数据校验测试
 *
 * 验证新增的 20 个普通怪物和 10 个 Boss 的数据完整性：
 * - ID 唯一性与无冲突
 * - Boss phases hpThreshold 降序
 * - drops itemId 存在于 LOOT_ITEMS 或 EQUIPMENT_ITEMS
 * - skillPool 中的 skillId 存在于 MONSTER_ABILITIES
 * - dangerLevel 合法性
 * - 新增怪物技能 ID 无冲突
 * - validateLocationData 全部地点 enemies/bosses 引用有效
 */
import { describe, it, expect } from 'vitest';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';
import { MONSTER_ABILITIES } from '@/data/config_skills';
import { LOOT_ITEMS } from '@/data/config_items';
import { EQUIPMENT_ITEMS } from '@/data/config_equipment_items';
import { LOCATIONS } from '@/data/config_locations';
import { validateLocationData, validateBossPhasesOrder } from '@/data/validate';

// P3-167 新增的怪物 ID
const NEW_MOB_IDS = [
  'mob_strider', 'mob_defias',
  'mob_raptor', 'mob_worgen', 'mob_makrura', 'mob_wraith',
  'mob_faceless', 'mob_dire_bear', 'mob_satyr', 'mob_wyrmkin', 'mob_basilisk', 'mob_void_walker',
  'mob_demon_guard', 'mob_ice_troll', 'mob_plaguebearer', 'mob_dark_caster',
  'mob_frost_serpent', 'mob_infernal', 'mob_death_knight_mob', 'mob_ancient_protector',
];

// P3-167 新增的 Boss ID
const NEW_BOSS_IDS = [
  'boss_hogger', 'boss_murloc_chieftain',
  'boss_troll_warlord', 'boss_naga_seawitch', 'boss_centaur_khan',
  'boss_demon_lord', 'boss_rock_lord', 'boss_shadow_assassin',
  'boss_death_lord', 'boss_void_lord',
];

// P3-167 新增的怪物技能 ID
const NEW_SKILL_IDS = [
  'war_stomp', 'tidal_wave', 'regenerate', 'hex', 'shadow_strike',
  'inferno', 'rock_barrage', 'plague_cloud', 'void_blast',
];

// 原有的怪物 ID（用于冲突检测）
const ORIGINAL_MOB_IDS = MOBS.filter(m => !NEW_MOB_IDS.includes(m.id)).map(m => m.id);
const ORIGINAL_BOSS_IDS = BOSSES.filter(b => !NEW_BOSS_IDS.includes(b.id)).map(b => b.id);
const ORIGINAL_SKILL_IDS = MONSTER_ABILITIES.filter(s => !NEW_SKILL_IDS.includes(s.id)).map(s => s.id);

// 所有合法的 itemId 集合（消耗品 + 装备）
const ALL_ITEM_IDS = new Set([
  ...LOOT_ITEMS.map(i => i.id),
  ...EQUIPMENT_ITEMS.map(i => i.id),
]);

// 所有怪物技能 ID 集合
const ALL_MONSTER_SKILL_IDS = new Set(MONSTER_ABILITIES.map(s => s.id));

// 合法的 dangerLevel 值
const VALID_DANGER_LEVELS = new Set(['普通', '困难', '危险', '极危险', '致命']);

// 合法的 BossMechanicType 值
const VALID_MECHANIC_TYPES = new Set([
  'summon_minions', 'summon_elite', 'damage_shield', 'invulnerable', 'reflect_damage',
  'enrage', 'aoe_attack', 'charge_attack', 'stun_player', 'silence_player',
  'debuff_aura', 'arena_hazard', 'healing_zone', 'split', 'revive',
  'steal_buff', 'counter_stance',
]);

// 合法的 BossIntroEffect 值
const VALID_INTRO_EFFECTS = new Set(['darken', 'shake', 'flame', 'freeze', 'lightning']);

// 合法的 AiStrategyType 值
const VALID_AI_STRATEGIES = new Set(['aggressive', 'defensive', 'balanced', 'boss_phase']);

// 合法的 targetType 值
const VALID_TARGET_TYPES = new Set(['single', 'all_enemies', 'self', 'all_allies']);


describe('P3-167 怪物/Boss 扩展 — ID 唯一性', () => {
  it('新增怪物 ID 全部存在于 MOBS 数组中', () => {
    const mobIds = new Set(MOBS.map(m => m.id));
    for (const id of NEW_MOB_IDS) {
      expect(mobIds.has(id), `MOBS 缺少新增 ID: ${id}`).toBe(true);
    }
  });

  it('新增 Boss ID 全部存在于 BOSSES 数组中', () => {
    const bossIds = new Set(BOSSES.map(b => b.id));
    for (const id of NEW_BOSS_IDS) {
      expect(bossIds.has(id), `BOSSES 缺少新增 ID: ${id}`).toBe(true);
    }
  });

  it('新增怪物 ID 与原有 ID 无冲突', () => {
    const newSet = new Set(NEW_MOB_IDS);
    for (const origId of ORIGINAL_MOB_IDS) {
      expect(newSet.has(origId), `原有 ID "${origId}" 与新增 ID 冲突`).toBe(false);
    }
  });

  it('新增 Boss ID 与原有 ID 无冲突', () => {
    const newSet = new Set(NEW_BOSS_IDS);
    for (const origId of ORIGINAL_BOSS_IDS) {
      expect(newSet.has(origId), `原有 ID "${origId}" 与新增 ID 冲突`).toBe(false);
    }
  });

  it('所有 MOBS ID 全局唯一', () => {
    const ids = MOBS.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有 BOSSES ID 全局唯一', () => {
    const ids = BOSSES.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('MOBS 和 BOSSES 之间 ID 无交叉', () => {
    const mobIds = new Set(MOBS.map(m => m.id));
    for (const boss of BOSSES) {
      expect(mobIds.has(boss.id), `Boss ID "${boss.id}" 与 MOBS ID 冲突`).toBe(false);
    }
  });

  it('新增怪物技能 ID 与原有技能 ID 无冲突', () => {
    const newSet = new Set(NEW_SKILL_IDS);
    for (const origId of ORIGINAL_SKILL_IDS) {
      expect(newSet.has(origId), `原有技能 ID "${origId}" 与新增技能 ID 冲突`).toBe(false);
    }
  });

  it('所有怪物技能 ID 全局唯一', () => {
    const ids = MONSTER_ABILITIES.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});


describe('P3-167 怪物/Boss 扩展 — 数据合法性', () => {
  it('所有新增怪物的 dangerLevel 合法', () => {
    const newMobs = MOBS.filter(m => NEW_MOB_IDS.includes(m.id));
    for (const mob of newMobs) {
      expect(VALID_DANGER_LEVELS.has(mob.dangerLevel), `${mob.id} dangerLevel 非法: ${mob.dangerLevel}`).toBe(true);
    }
  });

  it('所有新增 Boss 的 dangerLevel 合法', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      expect(VALID_DANGER_LEVELS.has(boss.dangerLevel), `${boss.id} dangerLevel 非法: ${boss.dangerLevel}`).toBe(true);
    }
  });

  it('所有新增 Boss 的 isBoss 为 true', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      expect(boss.isBoss, `${boss.id} isBoss 应为 true`).toBe(true);
    }
  });

  it('所有新增 Boss 的 aiStrategy 合法', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (boss.aiStrategy) {
        expect(VALID_AI_STRATEGIES.has(boss.aiStrategy), `${boss.id} aiStrategy 非法: ${boss.aiStrategy}`).toBe(true);
      }
    }
  });

  it('所有新增 Boss 的 intro effect 合法', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (boss.intro) {
        expect(VALID_INTRO_EFFECTS.has(boss.intro.effect), `${boss.id} intro.effect 非法: ${boss.intro.effect}`).toBe(true);
      }
    }
  });

  it('所有新增 Boss 的 phases hpThreshold 降序', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (!boss.phases || boss.phases.length === 0) continue;
      let prev = Infinity;
      for (const phase of boss.phases) {
        expect(phase.hpThreshold, `${boss.id} hpThreshold 未降序`).toBeLessThanOrEqual(prev);
        prev = phase.hpThreshold;
      }
    }
  });

  it('所有新增 Boss 的 phase transitionEffect 合法', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (!boss.phases) continue;
      for (const phase of boss.phases) {
        if (phase.transitionEffect) {
          expect(VALID_INTRO_EFFECTS.has(phase.transitionEffect), `${boss.id} phase transitionEffect 非法: ${phase.transitionEffect}`).toBe(true);
        }
        if (phase.aiStrategy) {
          expect(VALID_AI_STRATEGIES.has(phase.aiStrategy), `${boss.id} phase aiStrategy 非法: ${phase.aiStrategy}`).toBe(true);
        }
      }
    }
  });

  it('所有新增 Boss 的 mechanic type 合法', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (!boss.phases) continue;
      for (const phase of boss.phases) {
        for (const mech of phase.mechanics) {
          expect(VALID_MECHANIC_TYPES.has(mech.type), `${boss.id} mechanic type 非法: ${mech.type}`).toBe(true);
        }
      }
    }
  });
});


describe('P3-167 怪物/Boss 扩展 — 掉落引用完整性', () => {
  it('所有新增怪物的 drops itemId 存在于物品数据', () => {
    const newMobs = MOBS.filter(m => NEW_MOB_IDS.includes(m.id));
    for (const mob of newMobs) {
      if (!mob.drops) continue;
      for (const drop of mob.drops) {
        expect(ALL_ITEM_IDS.has(drop.itemId), `${mob.id} drops 引用不存在的 itemId: ${drop.itemId}`).toBe(true);
      }
    }
  });

  it('所有新增 Boss 的 drops itemId 存在于物品数据', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (!boss.drops) continue;
      for (const drop of boss.drops) {
        expect(ALL_ITEM_IDS.has(drop.itemId), `${boss.id} drops 引用不存在的 itemId: ${drop.itemId}`).toBe(true);
      }
    }
  });

  it('所有新增怪物的 drops dropRate 在 0-1 范围', () => {
    const newMobs = MOBS.filter(m => NEW_MOB_IDS.includes(m.id));
    for (const mob of newMobs) {
      if (!mob.drops) continue;
      for (const drop of mob.drops) {
        expect(drop.dropRate, `${mob.id} dropRate 超出范围: ${drop.dropRate}`).toBeGreaterThanOrEqual(0);
        expect(drop.dropRate, `${mob.id} dropRate 超出范围: ${drop.dropRate}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('所有新增 Boss 的 drops dropRate 在 0-1 范围', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (!boss.drops) continue;
      for (const drop of boss.drops) {
        expect(drop.dropRate, `${boss.id} dropRate 超出范围: ${drop.dropRate}`).toBeGreaterThanOrEqual(0);
        expect(drop.dropRate, `${boss.id} dropRate 超出范围: ${drop.dropRate}`).toBeLessThanOrEqual(1);
      }
    }
  });
});


describe('P3-167 怪物/Boss 扩展 — 技能引用完整性', () => {
  it('所有新增 Boss 的 skillPool skillId 存在于 MONSTER_ABILITIES', () => {
    const newBosses = BOSSES.filter(b => NEW_BOSS_IDS.includes(b.id));
    for (const boss of newBosses) {
      if (!boss.skillPool) continue;
      for (const skillId of boss.skillPool) {
        expect(ALL_MONSTER_SKILL_IDS.has(skillId), `${boss.id} skillPool 引用不存在的 skillId: ${skillId}`).toBe(true);
      }
    }
  });

  it('所有新增怪物技能的 type 合法', () => {
    const validSkillTypes = new Set([
      'physical_damage', 'magic_damage', 'health_restore', 'buff', 'debuff',
    ]);
    const newSkills = MONSTER_ABILITIES.filter(s => NEW_SKILL_IDS.includes(s.id));
    for (const skill of newSkills) {
      expect(validSkillTypes.has(skill.type), `${skill.id} type 非法: ${skill.type}`).toBe(true);
    }
  });

  it('所有新增怪物技能的 targetType 合法', () => {
    const newSkills = MONSTER_ABILITIES.filter(s => NEW_SKILL_IDS.includes(s.id));
    for (const skill of newSkills) {
      expect(VALID_TARGET_TYPES.has(skill.targetType), `${skill.id} targetType 非法: ${skill.targetType}`).toBe(true);
    }
  });

  it('所有新增怪物技能的 usableBy 为 enemy', () => {
    const newSkills = MONSTER_ABILITIES.filter(s => NEW_SKILL_IDS.includes(s.id));
    for (const skill of newSkills) {
      expect(skill.usableBy, `${skill.id} usableBy 应为 enemy`).toBe('enemy');
    }
  });

  it('所有新增怪物技能的 cooldown 大于 0', () => {
    const newSkills = MONSTER_ABILITIES.filter(s => NEW_SKILL_IDS.includes(s.id));
    for (const skill of newSkills) {
      expect(skill.cooldown, `${skill.id} cooldown 应大于 0`).toBeGreaterThan(0);
    }
  });
});


describe('P3-167 怪物/Boss 扩展 — 地点引用完整性', () => {
  it('validateLocationData 所有地点 enemies/bosses 引用有效', () => {
    const count = validateLocationData();
    expect(count, `地点数据校验失败，仅 ${count}/${LOCATIONS.length} 个地点通过`).toBe(LOCATIONS.length);
  });

  it('validateBossPhasesOrder 所有 Boss phases 降序', () => {
    const count = validateBossPhasesOrder();
    expect(count, `Boss 阶段校验失败，仅 ${count}/${BOSSES.length} 个 Boss 通过`).toBe(BOSSES.length);
  });
});


describe('P3-167 怪物/Boss 扩展 — 数量统计', () => {
  it('怪物总数 ≥ 40', () => {
    expect(MOBS.length).toBeGreaterThanOrEqual(40);
  });

  it('Boss 总数 ≥ 14', () => {
    expect(BOSSES.length).toBeGreaterThanOrEqual(14);
  });

  it('怪物技能总数 ≥ 21', () => {
    expect(MONSTER_ABILITIES.length).toBeGreaterThanOrEqual(21);
  });

  it('每个等级区间至少有对应的怪物分布', () => {
    const normalCount = MOBS.filter(m => m.dangerLevel === '普通').length;
    const hardCount = MOBS.filter(m => m.dangerLevel === '困难').length;
    const dangerCount = MOBS.filter(m => m.dangerLevel === '危险').length;
    expect(normalCount, '普通难度怪物至少 10 种').toBeGreaterThanOrEqual(10);
    expect(hardCount, '困难难度怪物至少 10 种').toBeGreaterThanOrEqual(10);
    expect(dangerCount, '危险难度怪物至少 10 种').toBeGreaterThanOrEqual(10);
  });

  it('每个等级区间至少有对应的 Boss 分布', () => {
    const extremeCount = BOSSES.filter(b => b.dangerLevel === '极危险').length;
    const lethalCount = BOSSES.filter(b => b.dangerLevel === '致命').length;
    expect(extremeCount, '极危险 Boss 至少 8 个').toBeGreaterThanOrEqual(8);
    expect(lethalCount, '致命 Boss 至少 4 个').toBeGreaterThanOrEqual(4);
  });
});
