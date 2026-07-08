/**
 * @fileoverview 任务目标 UI 文本工具单元测试
 *
 * 覆盖范围：
 * 1. getObjectiveText —— 根据目标类型生成中文描述
 *    - kill 目标：从 MOBS + BOSSES 合并表查找敌人名
 *    - collect 目标：通过 itemNameProvider 解析物品名，失败回退 itemId
 *    - 未知类型/缺失 ID 的防御性回退
 * 2. getEnemyName —— 按 enemyId 查询敌人中文名
 *    - 命中 MOBS / 命中 BOSSES / 未命中回退原 ID
 *    - MOBS 与 BOSSES 同 ID 时普通怪优先
 */
import { describe, it, expect } from 'vitest';
import { getObjectiveText, getEnemyName } from '@/modules/quest/objective_utils';
import type { QuestObjective } from '@/modules/quest/types';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';

/** 构造测试用任务目标 */
function makeObjective(overrides: Partial<QuestObjective> = {}): QuestObjective {
  return {
    key: 'obj_1',
    type: 'kill',
    target: 1,
    enemyId: 'spider',
    ...overrides,
  };
}

describe('getObjectiveText 生成目标描述文本', () => {
  describe('kill 目标', () => {
    it('MOBS 中存在的敌人 → "消灭{敌人名}"', () => {
      const firstMob = MOBS[0];
      const obj = makeObjective({ type: 'kill', enemyId: firstMob.id });
      expect(getObjectiveText(obj)).toBe(`消灭${firstMob.name}`);
    });

    it('仅在 BOSSES 中存在的敌人 → "消灭{Boss名}"', () => {
      // 找一个不在 MOBS 中的 boss
      const mobIds = new Set(MOBS.map(m => m.id));
      const bossOnly = BOSSES.find(b => !mobIds.has(b.id));
      if (bossOnly) {
        const obj = makeObjective({ type: 'kill', enemyId: bossOnly.id });
        expect(getObjectiveText(obj)).toBe(`消灭${bossOnly.name}`);
      }
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
  it('MOBS 中存在的 ID → 返回怪物名', () => {
    const firstMob = MOBS[0];
    expect(getEnemyName(firstMob.id)).toBe(firstMob.name);
  });

  it('BOSSES 中存在但 MOBS 中不存在的 ID → 返回 Boss 名', () => {
    const mobIds = new Set(MOBS.map(m => m.id));
    const bossOnly = BOSSES.find(b => !mobIds.has(b.id));
    if (bossOnly) {
      expect(getEnemyName(bossOnly.id)).toBe(bossOnly.name);
    }
  });

  it('MOBS 与 BOSSES 同 ID 时返回 MOBS 的名称（普通怪优先）', () => {
    const mobIds = new Set(MOBS.map(m => m.id));
    const bossIds = new Set(BOSSES.map(b => b.id));
    // 找同时存在于两者的 ID
    const overlapId = MOBS.find(m => bossIds.has(m.id))?.id;
    if (overlapId) {
      const mobName = MOBS.find(m => m.id === overlapId)!.name;
      expect(getEnemyName(overlapId)).toBe(mobName);
    }
  });

  it('未知 enemyId → 回退为原 ID', () => {
    expect(getEnemyName('unknown_enemy_xyz')).toBe('unknown_enemy_xyz');
  });

  it('空字符串 ID → 回退为空字符串', () => {
    expect(getEnemyName('')).toBe('');
  });
});
