/**
 * @fileoverview 响应式虚拟网格列数计算 composable
 * @description 为 RecycleScroller 的 gridItems 模式提供响应式列数与单元格尺寸，
 *              通过 ResizeObserver 监听容器宽度变化自动重算，使虚拟网格
 *              在不同屏幕尺寸下保持与 CSS auto-fill 网格相近的视觉效果。
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue';

/**
 * 根据容器宽度和最小单元格尺寸计算响应式网格参数
 *
 * @param containerRef - 网格容器元素的 ref
 * @param minItemSize - 单元格最小边长（px），等价于 CSS minmax(Npx, 1fr) 的 N
 * @param gap - 单元格间距（px），等价于 CSS gap
 * @returns gridItems（列数）和 itemSize（单元格实际边长，含 gap）
 */
export function useResponsiveGrid(
  containerRef: Ref<HTMLElement | null>,
  minItemSize: number,
  gap: number
) {
  const gridItems = ref(6);
  const itemSize = ref(minItemSize + gap);

  function update() {
    const el = containerRef.value;
    if (!el) return;
    // clientWidth 含 padding，需减去左右 padding 得到内容区宽度
    const style = getComputedStyle(el);
    const padding =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const width = el.clientWidth - padding;
    if (width <= 0) return;

    const totalSlot = minItemSize + gap;
    const cols = Math.max(1, Math.floor((width + gap) / totalSlot));
    gridItems.value = cols;
    // 单元格实际边长 = 内容区宽度均分（含 gap），保证网格填满容器
    itemSize.value = Math.floor((width + gap) / cols);
  }

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    update();
    if (containerRef.value && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(containerRef.value);
    }
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  return { gridItems, itemSize };
}
