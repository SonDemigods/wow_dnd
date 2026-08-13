/**
 * @fileoverview 区域专属事件模板数据（阶段四：内容丰富与平衡）
 *
 * 【数据分层归属：A 层 · 编译期固定纯配置源】
 * 不进 IndexedDB，admin 后台不可编辑。原因：事件模板为 `AreaEventTemplate` 函数形态
 * （接收 areaLevel 返回 RandomEventResult），含行为逻辑不可序列化，运行时由探索模块直接 import 调用。
 *
 * 为每个区域提供专属的随机事件模板，让"这个区域"有专属事件记忆点。
 * 事件以 `AreaEventTemplate`（接收 areaLevel 返回 `RandomEventResult`）形态存储，
 * 结算时复用 `effectHandlers` 注册表，不新增效果类型（仍为 heal/mana/exp/damage/mpLoss/gold）。
 *
 * 触发逻辑：`generateRandomEvent` 在 `areaEvents` 非空时按 `AREA_EVENT_MIX_PROBABILITY`
 * 从中选取模板并用 areaLevel 构造，否则走通用事件。`store.ts` 的 `buildAreaConfig`
 * 通过 `getAreaEventTemplates(location.id)` 查找当前区域的专属事件。
 *
 * P11-403 修复：原 AREA_EVENT_TEMPLATES 的 key 为主题名（forest/cave/ruins），
 * 但 store.ts 按 location.id 查找，导致区域专属事件永远不触发。
 * 现改为通过 AREA_THEME_MAP 将 location.id 映射到区域主题，再由主题映射到事件模板类别。
 * 同一主题的所有区域共享对应类别的事件模板。
 *
 * 扩展方式：在 AREA_EVENT_TEMPLATES 中按事件类别追加模板，或在 THEME_TO_EVENT_CATEGORY
 * 中增加主题→类别的映射，无需改动 service/store 逻辑。
 */
import { AREA_THEME_MAP } from '@/config/exploration';
import type { AreaEventTemplate } from '@/modules/exploration/types';

/**
 * 区域专属事件模板映射（按事件类别索引）
 *
 * key 为事件类别（forest/cave/ruins）；
 * value 为该类别的事件模板数组。
 *
 * 通过 THEME_TO_EVENT_CATEGORY 将 AREA_THEME_MAP 的主题映射到事件类别，
 * 同一主题的所有 location.id 共享同一组事件模板。
 */
export const AREA_EVENT_TEMPLATES: Record<string, AreaEventTemplate[]> = {
  // 森林：自然主题（恢复为主，偶有毒藤伤害）
  forest: [
    (lv) => ({
      message: `古老的精灵符文在树干上浮现，恢复了你 ${lv * 4 + 8} 点法力`,
      icon: 'game-icons:emerald',
      effect: { type: 'mana', amount: lv * 4 + 8 },
    }),
    (lv) => ({
      message: `毒藤缠绕住你的脚踝，受到 ${lv * 2 + 3} 点伤害，但挣脱后获得了 ${lv * 6 + 5} 点经验`,
      icon: 'game-icons:thorny-vine',
      effect: { type: 'exp', amount: lv * 6 + 5 },
    }),
  ],

  // 洞穴：地下主题（暗河恢复，蝙蝠伤害）
  cave: [
    (lv) => ({
      message: `地下暗河清澈见底，饮水后恢复了 ${lv * 5 + 10} 点生命值`,
      icon: 'game-icons:water-drop',
      effect: { type: 'heal', amount: lv * 5 + 10 },
    }),
    (lv) => ({
      message: `蝙蝠群突然袭来，受到 ${lv * 2 + 4} 点伤害`,
      icon: 'game-icons:bat-wing',
      effect: { type: 'damage', amount: lv * 2 + 4 },
    }),
  ],

  // 遗迹：古代主题（机关损失，失落宝藏）
  ruins: [
    (lv) => ({
      message: `触发了古代机关，损失了 ${lv * 2 + 3} 点法力，但找到了 ${lv * 6 + 12} 金币`,
      icon: 'game-icons:gear-hammer',
      effect: { type: 'gold', amount: lv * 6 + 12 },
    }),
    (lv) => ({
      message: `解读了失落的石碑铭文，获得了 ${lv * 10 + 15} 点经验值`,
      icon: 'game-icons:spell-book',
      effect: { type: 'exp', amount: lv * 10 + 15 },
    }),
  ],
};

/**
 * AREA_THEME_MAP 主题 → 事件类别映射
 *
 * 将探索模块的区域主题（forest/coast/wasteland/mountain/corrupt/plains/jungle/volcanic/frozen/hive）
 * 映射到 AREA_EVENT_TEMPLATES 的事件类别（forest/cave/ruins）。
 * 同一主题的所有 location.id 共享对应类别的事件模板。
 */
const THEME_TO_EVENT_CATEGORY: Record<string, string> = {
  forest: 'forest',     // 森林 → 自然主题事件
  plains: 'forest',     // 平原 → 自然主题事件
  jungle: 'forest',     // 丛林 → 自然主题事件
  coast: 'cave',        // 海岸 → 地下/洞穴事件
  mountain: 'cave',     // 山脉 → 地下/洞穴事件
  volcanic: 'cave',     // 火山 → 地下/洞穴事件
  frozen: 'cave',       // 冰雪 → 地下/洞穴事件
  hive: 'cave',         // 虫巢 → 地下/洞穴事件
  wasteland: 'ruins',   // 荒原 → 古代遗迹事件
  corrupt: 'ruins',     // 腐化 → 古代遗迹事件
};

/**
 * 根据 location.id 获取该区域的专属事件模板
 *
 * 查找流程：location.id → AREA_THEME_MAP 主题 → THEME_TO_EVENT_CATEGORY 事件类别 → AREA_EVENT_TEMPLATES
 * 任一环节未命中则返回空数组（走通用事件）。
 *
 * @param locationId - 区域 ID（与 config_locations.ts 的 location.id 对应）
 * @returns 该区域的专属事件模板数组；未命中时返回空数组
 */
export function getAreaEventTemplates(locationId: string): AreaEventTemplate[] {
  const theme = AREA_THEME_MAP[locationId]?.theme;
  if (!theme) return [];
  const category = THEME_TO_EVENT_CATEGORY[theme];
  if (!category) return [];
  return AREA_EVENT_TEMPLATES[category] ?? [];
}
