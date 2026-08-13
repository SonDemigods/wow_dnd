/**
 * @fileoverview 控制台样式常量
 * @description 控制台模块的 CSS 内联样式字符串，配合 console.log 的 %c 占位符实现彩色输出。
 *              从 src/modules/console.ts 提取，便于统一管理与未来与主题配置同步。
 *
 *              tag:    橙色标签 [cmd]
 *              ok:     绿色成功
 *              err:    红色失败
 *              label:  紫色字段名
 *              value:  浅灰白色值
 *              hint:   灰色斜体提示
 *              section:橙色分组标题
 *              rarity: 稀有度配色（P2-73 修复：直接引用 RARITY_CONFIG 作为唯一颜色源，
 *                      避免与 src/config/inventory.ts 重复定义产生同步风险）
 */
import { RARITY_CONFIG } from './inventory';
import type { ItemRarity } from '@/modules/inventory/types';

/**
 * 根据 RARITY_CONFIG 动态生成控制台稀有度样式
 *
 * P2-73 修复：以 RARITY_CONFIG 为唯一颜色源，控制台样式跟随其变化，
 * 消除两处重复定义的同步风险。
 */
function buildRarityConsoleStyle(): Record<ItemRarity, string> {
  const style = {} as Record<ItemRarity, string>;
  // P3 TS-17 审计决策（2026-07-31）：Object.keys 返回 string[]，TS 语言限制无法静态推断为 ItemRarity[]。
  // RARITY_CONFIG 的键已由类型保证为 ItemRarity，断言是合理 workaround。
  (Object.keys(RARITY_CONFIG) as ItemRarity[]).forEach(rarity => {
    style[rarity] = `color: ${RARITY_CONFIG[rarity].color}`;
  });
  return style;
}

export const CONSOLE_STYLE = {
  tag: 'color: #111; background: #f59e0b; padding: 1px 5px; border-radius: 3px; font-weight: bold',
  ok: 'color: #4ade80',
  err: 'color: #ef4444',
  label: 'color: #a78bfa',
  value: 'color: #e2e8f0',
  hint: 'color: #94a3b8; font-style: italic',
  section: 'color: #f59e0b; font-weight: bold',
  rarity: buildRarityConsoleStyle()
} as const;
