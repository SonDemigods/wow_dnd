<!--
  @组件 BaseIcon
  @描述 通用游戏图标组件，基于 @iconify/vue + game-icons 图标集
         渐变色模式通过 loadIcon 加载 SVG 后注入 SVG linearGradient 实现。
         图标找不到时自动回退为问号图标。
  @使用 <BaseIcon name="sword-clash" gradient="warrior" :size="24" />
-->
<template>
  <svg
    v-if="gradientSvgBody"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 512 512"
    v-html="gradientSvgBody"
  />
  <Icon
    v-else
    :icon="finalIcon"
    :width="size"
    :height="size"
    :color="color"
  />
</template>

<!-- 模块级脚本：全局唯一计数器，不受 <script setup> 实例作用域限制 -->
<script lang="ts">
let globalIdCounter = 0;
export function nextGradId() {
  return `grad-${++globalIdCounter}`;
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon, loadIcon } from '@iconify/vue';

/** 回退图标：问号 */
const FALLBACK_ICON = 'game-icons:uncertainty';

/**
 * 净化 SVG body 字符串，防止 XSS
 *
 * 数据来源为 @iconify/vue（相对可信），但 icon 名理论上可被外部配置控制，
 * 因此对 loadIcon 返回的 SVG body 进行防御性净化后再通过 v-html 渲染：
 * - 移除 script 标签及其内容
 * - 移除 `on*` 事件处理器属性（onclick/onload/onerror/onmouseover 等）
 * - 移除 `javascript:` 协议的 href/xlink:href（防止点击劫持）
 *
 * @param body - loadIcon 返回的 SVG body 字符串
 * @returns 净化后的 body 字符串
 */
function sanitizeSvgBody(body: string): string {
  // 注意：正则以字符串拼接构造，避免源码中出现连续的闭合 script 标签字面量
  // 导致 SFC 解析器误判 script setup 块提前结束（SFC 解析器不解析 JS 注释/字符串）
  const scriptTagPattern = new RegExp('<' + 'script[\\s\\S]*?</' + 'script>', 'gi');
  return body
    // 移除 script 标签（含内容，跨行匹配）
    .replace(scriptTagPattern, '')
    // 移除 on* 事件处理器属性（onclick/onload/onerror/onmouseover 等）
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // 移除 javascript: 协议的 href/xlink:href（防止点击劫持）
    .replace(/(xlink:href|href)\s*=\s*["']\s*javascript:[^"']*["']/gi, '')
    // 移除 CSS behavior / -moz-binding 属性注入（IE/Firefox 遗留 CSS 表达式攻击面）
    .replace(/\bbehavior\s*:/gi, 'x-behavior-disabled:')
    .replace(/\b-moz-binding\s*:/gi, 'x-moz-binding-disabled:');
}

const props = withDefaults(defineProps<{
  /** 图标名（支持 'game-icons:xxx' 全名或 'xxx' 简写），空值自动回退为问号 */
  name?: string;
  /** 图标尺寸（像素） */
  size?: number;
  /** 渐变色键名（对应 SVG grad-xxx linearGradient），不传则使用单色（currentColor） */
  gradient?: string;
  /** 单色模式颜色（仅在无 gradient 时生效） */
  color?: string;
}>(), {
  size: 24,
});

/** 处理图标名：空值回退、自动补齐 game-icons: 前缀 */
const finalIcon = computed(() => {
  if (!props.name) return FALLBACK_ICON;
  if (props.name.includes(':')) return props.name;
  return `game-icons:${props.name}`;
});

/** 每个实例分配全局唯一渐变 ID */
const gradId = nextGradId();

/** 渐变模式缓存的 SVG body */
const gradientSvgBody = ref('');
const lastLoadedKey = ref('');

/** P8-025 修复：加载令牌，防止快速切换 icon 时旧请求覆盖新结果 */
let loadToken = 0;

watch(
  [finalIcon, () => props.gradient],
  async ([icon, grad]) => {
    if (!grad || !icon) {
      gradientSvgBody.value = '';
      lastLoadedKey.value = '';
      return;
    }
    // P7-006 修复：将 gradient 纳入缓存键，gradient 变化时也需重新加载
    const cacheKey = `${icon}:${grad}`;
    if (cacheKey === lastLoadedKey.value && gradientSvgBody.value) return;
    lastLoadedKey.value = cacheKey;

    // P8-025 修复：令牌保护，快速切换 icon 时丢弃过期的异步结果
    const myToken = ++loadToken;

    try {
      const data = await loadIcon(icon);
      // P8-025 修复：检查令牌，若已过期则丢弃本次结果
      if (myToken !== loadToken) return;
      if (!data) {
        gradientSvgBody.value = '';
        return;
      }
      // 使用唯一 gradId 避免多实例 SVG ID 冲突导致渐变被覆盖
      const defs = `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--icon-grad-${grad}-start)"/><stop offset="100%" stop-color="var(--icon-grad-${grad}-end)"/></linearGradient></defs>`;
      // 净化 SVG body 防止 XSS（icon 名可能来自外部配置）
      const body = sanitizeSvgBody(data.body).replace(
        /fill="currentColor"/g,
        `fill="url(#${gradId})"`
      );
      gradientSvgBody.value = defs + body;
    } catch (e) {
      console.warn(`[BaseIcon] loadIcon("${icon}") 失败，降级为单色图标:`, e);
      gradientSvgBody.value = '';
    }
  },
  { immediate: true }
);
</script>
