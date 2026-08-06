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
 * 用 `AREA_EVENT_TEMPLATES[location.id] ?? []` 查找当前区域的专属事件。
 *
 * 扩展方式：在下方映射中按 areaId 追加事件模板即可，无需改动 service/store 逻辑。
 */
import type { AreaEventTemplate } from '@/modules/exploration/types';

/**
 * 区域专属事件模板映射（按 areaId 索引）
 *
 * key 为区域 ID（与 `config_locations.ts` 的 location.id 对应）；
 * value 为该区域的专属事件模板数组。未命中的 areaId 视为无专属事件（走通用事件）。
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
      icon: 'game-icons:thorned-vine',
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
