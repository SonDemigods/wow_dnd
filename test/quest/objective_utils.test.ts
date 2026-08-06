/**
 * @fileoverview 任务目标 UI 文本工具单元测试
 *
 * 覆盖范围：
 * 1. getObjectiveText —— 根据目标类型生成中文描述
 *    - kill 目标：从 DB 加载的敌人名（config_mobs + config_bosses 合并）查找
 *    - collect 目标：通过 itemNameProvider 解析物品名，失败回退 itemId
 *    - 未知类型/缺失 ID 的防御性回退
 * 2. getEnemyName —— 按 enemyId 查询敌人中文名
 *    - 命中 mobs / 命中 bosses / 未命中回退原 ID
 *    - mob 与 boss 同 ID 时普通怪优先
 *
 * mock 策略：mock @/modules/data 的 db（config_mobs / config_bosses），
 * 通过 initEnemyNameMap() 填充 ENEMY_NAME_MAP 后再断言。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getObjectiveText, getEnemyName, initEnemyNameMap } from '@/modules/quest/objective_utils';
import type { QuestObjective } from '@/modules/quest/types';

/** mock db 数据源 */
const mobsMock = [
  { id: '_mob_shared', name: '普通怪名称' },
  { id: '_mob_spider', name: '剧毒蜘蛛' },
];
const bossesMock = [
  { id: '_mob_shared', name: 'Boss名称' },
  { id: '_boss_dragon', name: '烈焰巨龙' },
];
vi.mock('@/modules/data', () => ({
  db: {
    config_mobs: { toArray: vi.fn(() => Promise.resolve(mobsMock)) },
    config_bosses: { toArray: vi.fn(() => Promise.resolve(bossesMock)) },
  },
}));

/** 构造测试用任务目标 */
function makeObjective(overrides: Partial<QuestObjective> = {}): QuestObjective {
  return {
    key: 'obj_1',
    type: 'kill',
    target: 1,
    enemyId: '_mob_spider',
    ...overrides,
  };
}

describe('getObjectiveText 生成目标描述文本', () => {
  beforeEach(async () => {
    await initEnemyNameMap();
  });

  describe('kill 目标', () => {
    it('mob 中存在的敌人 → "消灭{敌人名}"', () => {
      const obj = makeObjective({ type: 'kill', enemyId: '_mob_spider' });
      expect(getObjectiveText(obj)).toBe('消灭剧毒蜘蛛');
    });

    it('仅在 boss 中存在的敌人 → "消灭{Boss名}"', () => {
      const obj = makeObjective({ type: 'kill', enemyId: '_boss_dragon' });
      expect(getObjectiveText(obj)).toBe('消灭烈焰巨龙');
    });

    it('未知 enemyId → 回退为 "消灭{enemyId}"', () => {
      const obj = makeObjective({ type: 'kill', enemyId: 'nonexistent_enemy_xyz' });
      expect(getObjectiveText(obj)).toBe('消灭nonexistent_enemy_xyz');
    });

    it('kill 类型但未提供 enemyId → 回退为 "未知目标: {key}"', () => {
      const obj = makeObjective({ type: 'kill', enemyId: undefined, key: 'kill_unknown' });
      expect(getObjectiveText(obj)).toBe('未知目标: kill_unknown');
    });
  });

  describe('collect 目标', () => {
    it('提供 itemNameProvider 且命中 → "收集{物品名}"', () => {
      const obj = makeObjective({ type: 'collect', itemId: 'potion_hp', key: 'col_1' });
      const result = getObjectiveText(obj, (id) => id === 'potion_hp' ? '生命药水' : null);
      expect(result).toBe('收集生命药水');
    });

    it('提供 itemNameProvider 但返回 null → 回退为 "收集{itemId}"', () => {
      const obj = makeObjective({ type: 'collect', itemId: 'unknown_item', key: 'col_2' });
      const result = getObjectiveText(obj, () => null);
      expect(result).toBe('收集unknown_item');
    });

    it('未提供 itemNameProvider → 回退为 "收集{itemId}"', () => {
      const obj = makeObjective({ type: 'collect', itemId: 'herb_gather', key: 'col_3' });
      expect(getObjectiveText(obj)).toBe('收集herb_gather');
    });

    it('collect 类型但未提供 itemId → 回退为 "未知目标: {key}"', () => {
      const obj = makeObjective({ type: 'collect', itemId: undefined, key: 'collect_no_item' });
      expect(getObjectiveText(obj)).toBe('未知目标: collect_no_item');
    });
  });

  describe('防御性回退', () => {
    it('未知 type → 回退为 "未知目标: {key}"', () => {
      const obj = makeObjective({ type: 'kill' as QuestObjective['type'], key: 'unknown_type' });
      // 强制改为未知类型测试回退
      (obj as { type: string }).type = 'explore';
      expect(getObjectiveText(obj)).toBe('未知目标: unknown_type');
    });
  });
});

describe('getEnemyName 敌人名称查询', () => {
  beforeEach(async () => {
    await initEnemyNameMap();
  });

  it('mob 中存在的 ID → 返回怪物名', () => {
    expect(getEnemyName('_mob_spider')).toBe('剧毒蜘蛛');
  });

  it('boss 中存在但 mob 中不存在的 ID → 返回 boss 名', () => {
    expect(getEnemyName('_boss_dragon')).toBe('烈焰巨龙');
  });

  it('mob 与 boss 同 ID 时返回 mob 的名称（普通怪优先）', () => {
    expect(getEnemyName('_mob_shared')).toBe('普通怪名称');
  });

  it('未知 enemyId → 回退为原 ID', () => {
    expect(getEnemyName('unknown_enemy_xyz')).toBe('unknown_enemy_xyz');
  });

  it('空字符串 ID → 回退为空字符串', () => {
    expect(getEnemyName('')).toBe('');
  });
});
