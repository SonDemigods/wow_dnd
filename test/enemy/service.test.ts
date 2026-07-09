/**
 * @fileoverview 敌人模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. generateEnemyStats —— 等级缩放属性推导（含默认值兜底）
 * 2. calculateEnemyDamage —— 伤害计算（含随机数与防御减免）
 * 3. createEnemyInstance —— 敌人实例创建
 * 4. BOSS_DROP_TABLE —— Boss 通用掉落表常量
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateEnemyStats,
  calculateEnemyDamage,
  createEnemyInstance,
  BOSS_DROP_TABLE,
} from '@/modules/enemy/service';
import type { EnemyData, EnemyInstance } from '@/modules/enemy/types';

afterEach(() => {
  vi.restoreAllMocks();
});

/** 构造测试用敌人模板 */
function makeTemplate(overrides: Partial<EnemyData> = {}): EnemyData {
  return {
    id: 'goblin',
    name: '哥布林',
    icon: 'game-icons:goblin',
    maxHp: 100,
    damage: [5, 10],
    xp: 50,
    gold: 20,
    dangerLevel: '普通',
    physicalAttack: 20,
    physicalDefense: 5,
    magicAttack: 5,
    magicDefense: 5,
    dodgeChance: 0.05,
    ...overrides,
  };
}

/** 构造测试用敌人实例 */
function makeInstance(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    ...makeTemplate(),
    dataId: 'goblin',
    id: 'enemy_1',
    level: 1,
    hp: 100,
    maxHp: 100,
    stats: { str: 10, dex: 5, con: 30, int: 4, wis: 6, cha: 5 },
    expReward: 50,
    goldReward: 20,
    physicalAttack: 20,
    physicalDefense: 5,
    magicAttack: 5,
    magicDefense: 5,
    damage: [5, 10],
    ...overrides,
  };
}

describe('generateEnemyStats 等级缩放属性推导', () => {
  it('level=1 时缩放系数为 1.0（属性等于模板值）', () => {
    const template = makeTemplate({ physicalAttack: 20 });
    const stats = generateEnemyStats(template, 1);
    expect(stats.physicalAttack).toBe(20); // 20 * 1.0
    expect(stats.maxHp).toBe(100);
    expect(stats.expReward).toBe(50);
    expect(stats.goldReward).toBe(20);
  });

  it('level=10 时缩放系数为 1.9', () => {
    const template = makeTemplate({ physicalAttack: 20 });
    const stats = generateEnemyStats(template, 10);
    expect(stats.physicalAttack).toBe(Math.floor(20 * 1.9)); // 38
    expect(stats.maxHp).toBe(Math.floor(100 * 1.9));
  });

  it('level 越高属性越高', () => {
    const template = makeTemplate();
    const low = generateEnemyStats(template, 1);
    const high = generateEnemyStats(template, 20);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    expect(high.physicalAttack).toBeGreaterThanOrEqual(low.physicalAttack);
    expect(high.expReward).toBeGreaterThan(low.expReward);
  });

  it('未配置 physicalAttack 时使用默认值 10', () => {
    const template = makeTemplate({ physicalAttack: undefined });
    const stats = generateEnemyStats(template, 1);
    expect(stats.physicalAttack).toBe(10);
  });

  it('未配置防御属性时使用默认值（物理防御 5、魔法防御 5）', () => {
    const template = makeTemplate({
      physicalDefense: undefined,
      magicDefense: undefined,
      magicAttack: undefined,
    });
    const stats = generateEnemyStats(template, 1);
    expect(stats.physicalDefense).toBe(5);
    expect(stats.magicDefense).toBe(5);
    expect(stats.magicAttack).toBe(5);
  });

  it('damage 范围随等级缩放', () => {
    const template = makeTemplate({ damage: [10, 20] });
    const stats = generateEnemyStats(template, 10);
    expect(stats.damage[0]).toBe(Math.floor(10 * 1.9));
    expect(stats.damage[1]).toBe(Math.floor(20 * 1.9));
  });

  it('返回的 stats 包含六维属性', () => {
    const stats = generateEnemyStats(makeTemplate(), 1);
    expect(stats.stats).toHaveProperty('str');
    expect(stats.stats).toHaveProperty('dex');
    expect(stats.stats).toHaveProperty('con');
    expect(stats.stats).toHaveProperty('int');
    expect(stats.stats).toHaveProperty('wis');
    expect(stats.stats).toHaveProperty('cha');
  });

  it('敌人 cha 固定为 5', () => {
    const stats = generateEnemyStats(makeTemplate(), 1);
    expect(stats.stats.cha).toBe(5);
  });

  it('hp 与 maxHp 相等', () => {
    const stats = generateEnemyStats(makeTemplate(), 5);
    expect(stats.hp).toBe(stats.maxHp);
  });
});

describe('calculateEnemyDamage 伤害计算', () => {
  it('Math.random=0 时使用最小伤害范围', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // rawDamage = (20 + 5) * 0.5 = 12.5
    // mitigated = max(1, 12.5 - 0 * 0.3) = 12.5
    // floor = 12
    expect(calculateEnemyDamage(enemy, 0)).toBe(12);
  });

  it('Math.random=1 时使用最大伤害范围', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // randomFactor = 5 + 1 * 5 = 10, rawDamage = (20 + 10) * 0.5 = 15
    // mitigated = max(1, 15 - 0) = 15
    expect(calculateEnemyDamage(enemy, 0)).toBe(15);
  });

  it('玩家防御按 30% 比例减免伤害', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // rawDamage = 12.5, mitigated = max(1, 12.5 - 30*0.3) = max(1, 3.5) = 3.5
    expect(calculateEnemyDamage(enemy, 30)).toBe(3);
  });

  it('防御过高时最低造成 1 点伤害', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeInstance({ physicalAttack: 5, damage: [1, 2] });
    // rawDamage = (5 + 1) * 0.5 = 3, mitigated = max(1, 3 - 1000*0.3) = 1
    expect(calculateEnemyDamage(enemy, 1000)).toBe(1);
  });

  it('未配置 physicalAttack 时使用默认值 10', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeInstance({ physicalAttack: undefined, damage: [0, 0] });
    // rawDamage = (10 + 0) * 0.5 = 5
    expect(calculateEnemyDamage(enemy, 0)).toBe(5);
  });
});

describe('calculateEnemyDamage 注入随机源（P3-5）', () => {
  it('注入 randomFn=() => 0 时使用最小伤害范围（无需 mock 全局 Math.random）', () => {
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // randomFactor = 5 + 0 * 5 = 5, rawDamage = (20 + 5) * 0.5 = 12.5, floor = 12
    expect(calculateEnemyDamage(enemy, 0, () => 0)).toBe(12);
  });

  it('注入 randomFn=() => 1 时使用最大伤害范围', () => {
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // randomFactor = 5 + 1 * 5 = 10, rawDamage = (20 + 10) * 0.5 = 15
    expect(calculateEnemyDamage(enemy, 0, () => 1)).toBe(15);
  });

  it('注入 randomFn=() => 0.5 时使用中点伤害', () => {
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // randomFactor = 5 + 0.5 * 5 = 7.5, rawDamage = (20 + 7.5) * 0.5 = 13.75, floor = 13
    expect(calculateEnemyDamage(enemy, 0, () => 0.5)).toBe(13);
  });

  it('注入随机源时防御减免逻辑仍生效', () => {
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // rawDamage = 12.5, mitigated = max(1, 12.5 - 30*0.3) = 3.5, floor = 3
    expect(calculateEnemyDamage(enemy, 30, () => 0)).toBe(3);
  });

  it('注入随机源时高防御下限仍为 1', () => {
    const enemy = makeInstance({ physicalAttack: 5, damage: [1, 2] });
    // rawDamage = (5 + 1) * 0.5 = 3, mitigated = max(1, 3 - 1000*0.3) = 1
    expect(calculateEnemyDamage(enemy, 1000, () => 0)).toBe(1);
  });

  it('不传 randomFn 时回退到默认 Math.random（向后兼容）', () => {
    const enemy = makeInstance({ physicalAttack: 20, damage: [5, 10] });
    // 不传第三参数，使用默认 Math.random，结果应在 [12, 15] 区间内
    const damage = calculateEnemyDamage(enemy, 0);
    expect(damage).toBeGreaterThanOrEqual(12);
    expect(damage).toBeLessThanOrEqual(15);
  });
});

describe('createEnemyInstance 敌人实例创建', () => {
  it('生成以 enemy_ 为前缀的唯一 ID', () => {
    const inst = createEnemyInstance(makeTemplate(), 1);
    expect(inst.id.startsWith('enemy_')).toBe(true);
  });

  it('dataId 指向模板 id', () => {
    const inst = createEnemyInstance(makeTemplate({ id: 'goblin_x' }), 1);
    expect(inst.dataId).toBe('goblin_x');
  });

  it('level 与传入参数一致', () => {
    const inst = createEnemyInstance(makeTemplate(), 5);
    expect(inst.level).toBe(5);
  });

  it('hp 与 maxHp 相等（满血）', () => {
    const inst = createEnemyInstance(makeTemplate(), 1);
    expect(inst.hp).toBe(inst.maxHp);
  });

  it('expReward/goldReward 按等级缩放', () => {
    const inst1 = createEnemyInstance(makeTemplate({ xp: 50, gold: 20 }), 1);
    const inst10 = createEnemyInstance(makeTemplate({ xp: 50, gold: 20 }), 10);
    expect(inst10.expReward).toBeGreaterThan(inst1.expReward);
    expect(inst10.goldReward).toBeGreaterThan(inst1.goldReward);
  });

  it('保留模板的 skillPool 和 dangerLevel', () => {
    const inst = createEnemyInstance(
      makeTemplate({ skillPool: ['skill_a', 'skill_b'], dangerLevel: '危险' }),
      1
    );
    expect(inst.skillPool).toEqual(['skill_a', 'skill_b']);
    expect(inst.dangerLevel).toBe('危险');
  });

  it('多次创建生成不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 30; i++) {
      ids.add(createEnemyInstance(makeTemplate(), 1).id);
    }
    expect(ids.size).toBe(30);
  });
});

describe('BOSS_DROP_TABLE Boss 通用掉落表', () => {
  it('包含多个掉落项', () => {
    expect(BOSS_DROP_TABLE.length).toBeGreaterThan(0);
  });

  it('每个掉落项包含 itemId / minAmount / maxAmount / dropRate', () => {
    for (const drop of BOSS_DROP_TABLE) {
      expect(drop).toHaveProperty('itemId');
      expect(drop).toHaveProperty('minAmount');
      expect(drop).toHaveProperty('maxAmount');
      expect(drop).toHaveProperty('dropRate');
    }
  });

  it('dropRate 在 0-1 范围内', () => {
    for (const drop of BOSS_DROP_TABLE) {
      expect(drop.dropRate).toBeGreaterThanOrEqual(0);
      expect(drop.dropRate).toBeLessThanOrEqual(1);
    }
  });

  it('minAmount 不大于 maxAmount', () => {
    for (const drop of BOSS_DROP_TABLE) {
      expect(drop.minAmount).toBeLessThanOrEqual(drop.maxAmount);
    }
  });
});
