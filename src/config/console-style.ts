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
 *              rarity: 稀有度配色（与 WoW 装备稀有度保持一致）
 */
export const CONSOLE_STYLE = {
  tag: 'color: #111; background: #f59e0b; padding: 1px 5px; border-radius: 3px; font-weight: bold',
  ok: 'color: #4ade80',
  err: 'color: #ef4444',
  label: 'color: #a78bfa',
  value: 'color: #e2e8f0',
  hint: 'color: #94a3b8; font-style: italic',
  section: 'color: #f59e0b; font-weight: bold',
  rarity: {
    common: 'color: #9d9d9d',
    uncommon: 'color: #1eff00',
    rare: 'color: #0070dd',
    epic: 'color: #a335ee',
    legendary: 'color: #ff8000'
  }
} as const;
