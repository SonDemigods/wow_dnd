/**
 * 世界地图配置常量
 *
 * P7-031 修复：将 MapView.vue 中硬编码的地图宽高比、缩放参数、平移边距提取为配置常量。
 */

/**
 * 世界地图背景图宽高比（原图 1201×800）
 *
 * @see MapView.vue fitMapToContainer
 */
export const MAP_ASPECT_RATIO = 1201 / 800;

/**
 * 缩放步进（每次点击缩放按钮的变化量）
 *
 * @see MapView.vue zoomIn / zoomOut
 */
export const MAP_ZOOM_STEP = 0.2;

/**
 * 最小缩放倍率
 *
 * @see MapView.vue zoomOut
 */
export const MAP_ZOOM_MIN = 0.5;

/**
 * 最大缩放倍率
 *
 * @see MapView.vue zoomIn
 */
export const MAP_ZOOM_MAX = 3;

/**
 * 拖拽平移边距（像素，地图边缘与容器之间保留的可视间距）
 *
 * @see MapView.vue clampPan
 */
export const PAN_BOUND_MARGIN = 40;
