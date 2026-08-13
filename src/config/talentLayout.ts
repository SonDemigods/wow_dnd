/**
 * @fileoverview 天赋面板布局配置常量
 * @description 集中管理天赋面板的节点尺寸、间距及列颜色等布局参数，
 *              避免在组件中硬编码魔法数字，便于统一调整与维护。
 *
 * P10-037 修复：从 TalentPopup.vue 提取至独立配置文件。
 */

// ==================== 节点尺寸与间距 ====================

/** 天赋节点宽度（px） */
export const TALENT_NODE_W = 90;

/** 天赋节点高度（px） */
export const TALENT_NODE_H = 70;

/** 天赋列间距（px） */
export const TALENT_COL_GAP = 50;

/** 天赋行间距（px） */
export const TALENT_ROW_GAP = 50;

// ==================== 列颜色 ====================

/** 武器/输出系列颜色（第 1 列） */
export const TALENT_COL1_COLOR = '#C79C6E';

/** 狂怒/辅助系列颜色（第 2 列） */
export const TALENT_COL2_COLOR = '#F58CBA';

/** 防护/生存系列颜色（第 3 列） */
export const TALENT_COL3_COLOR = '#0070DE';

/** 默认列颜色（未匹配列号时使用） */
export const TALENT_COL_DEFAULT_COLOR = '#999';
