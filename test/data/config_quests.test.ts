/**
 * @fileoverview 任务配置数据完整性测试（P3-136）
 *
 * 验证：
 * 1. 任务 ID 唯一性
 * 2. 任务类型分布包含 collect 和 explore（非全部 kill）
 * 3. collect 任务的 itemId 在 LOOT_ITEMS 中存在
 * 4. explore 任务结构合法（target > 0、locationId 可选）
 * 5. 每个任务具备必要字段
 */
import { describe, it, expect } from 'vitest';
import { QUESTS } from '@/data/config_quests';
import { LOOT_ITEMS } from '@/data/config_items';
import { EQUIPMENT_ITEMS } from '@/data/config_equipment_items';

/** 所有有效物品 ID 集合（消耗品/材料 + 装备） */
const ALL_ITEM_IDS = new Set<string>([
  ...LOOT_ITEMS.map(i => i.id),
  ...EQUIPMENT_ITEMS.map(i => i.id),
]);

describe('任务配置数据完整性（P3-136）', () => {
  it('所有任务 ID 唯一', () => {
    const ids = QUESTS.map(q => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size, `发现重复 ID: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`).toBe(ids.length);
  });

  it('任务类型分布包含 collect 和 explore（非全部 kill）', () => {
    const types = QUESTS.map(q => q.type);
    const killCount = types.filter(t => t === 'kill').length;
    const collectCount = types.filter(t => t === 'collect').length;
    const exploreCount = types.filter(t => t === 'explore').length;

    expect(collectCount, '应至少有 1 个 collect 任务').toBeGreaterThan(0);
    expect(exploreCount, '应至少有 1 个 explore 任务').toBeGreaterThan(0);
    // kill 仍占多数
    expect(killCount, 'kill 任务应仍存在').toBeGreaterThan(0);
  });

  it('collect 任务的 itemId 在物品配置中存在', () => {
    const collectQuests = QUESTS.filter(q => q.type === 'collect');
    expect(collectQuests.length, '应有多于 5 个 collect 任务').toBeGreaterThan(5);

    for (const quest of collectQuests) {
      for (const obj of quest.objectives) {
        expect(obj.itemId, `任务 ${quest.id} 的 collect 目标缺少 itemId`).toBeDefined();
        expect(ALL_ITEM_IDS.has(obj.itemId!), `任务 ${quest.id} 的 itemId "${obj.itemId}" 在物品配置中不存在`).toBe(true);
      }
    }
  });

  it('explore 任务结构合法', () => {
    const exploreQuests = QUESTS.filter(q => q.type === 'explore');
    expect(exploreQuests.length, '应有多于 5 个 explore 任务').toBeGreaterThan(5);

    for (const quest of exploreQuests) {
      for (const obj of quest.objectives) {
        expect(obj.target, `任务 ${quest.id} 的 explore 目标 target 应 > 0`).toBeGreaterThan(0);
        // locationId 可选，但若存在应为字符串
        if (obj.locationId !== undefined) {
          expect(typeof obj.locationId, `任务 ${quest.id} 的 locationId 应为字符串`).toBe('string');
          expect(obj.locationId.length, `任务 ${quest.id} 的 locationId 不应为空`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('每个任务具备必要字段', () => {
    for (const q of QUESTS) {
      expect(q.id, '任务 id 不应为空').toBeTruthy();
      expect(q.title, `任务 ${q.id} title 不应为空`).toBeTruthy();
      expect(q.description, `任务 ${q.id} description 不应为空`).toBeTruthy();
      expect(q.objectives.length, `任务 ${q.id} 应至少有 1 个目标`).toBeGreaterThan(0);
      expect(q.levelRequirement, `任务 ${q.id} levelRequirement 应 > 0`).toBeGreaterThan(0);
      expect(q.xpReward, `任务 ${q.id} xpReward 应 > 0`).toBeGreaterThan(0);
      expect(q.boardId, `任务 ${q.id} boardId 不应为空`).toBeTruthy();
    }
  });

  it('collect 任务数量 >= 8', () => {
    const collectCount = QUESTS.filter(q => q.type === 'collect').length;
    expect(collectCount, 'collect 任务应不少于 8 个').toBeGreaterThanOrEqual(8);
  });

  it('explore 任务数量 >= 8', () => {
    const exploreCount = QUESTS.filter(q => q.type === 'explore').length;
    expect(exploreCount, 'explore 任务应不少于 8 个').toBeGreaterThanOrEqual(8);
  });
});
