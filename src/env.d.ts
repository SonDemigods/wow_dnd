/// <reference types="vite/client" />

/**
 * @fileoverview TypeScript 环境类型声明
 * @description 为 Vue 单文件组件(.vue)、图片资源(.jpg/.png/.svg/.gif/.webp)提供模块类型声明，确保 TypeScript 能正确识别这些文件的导入
 */

/** 声明 Vue 单文件组件模块类型 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/** 声明 JPG 图片资源模块类型 */
declare module '*.jpg' {
  const src: string
  export default src
}

/** 声明 PNG 图片资源模块类型 */
declare module '*.png' {
  const src: string
  export default src
}

/** 声明 SVG 图片资源模块类型 */
declare module '*.svg' {
  const src: string
  export default src
}

/** 声明 GIF 图片资源模块类型 */
declare module '*.gif' {
  const src: string
  export default src
}

/** 声明 WebP 图片资源模块类型 */
declare module '*.webp' {
  const src: string
  export default src
}

/**
 * vue-virtual-scroller@2.0.0-beta 类型声明
 * beta 版未内置 .d.ts，此处提供最小可用声明
 */
declare module 'vue-virtual-scroller' {
  import type { Plugin, DefineComponent } from 'vue'
  const VueVirtualScroller: Plugin
  // P3 TS-7 修复：使用 DefineComponent 替代 any，提供最小类型声明
  // vue-virtual-scroller@2.0.0-beta 未内置 .d.ts，此处提供最小可用声明
  export const RecycleScroller: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export const DynamicScroller: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export const DynamicScrollerItem: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default VueVirtualScroller
}

/**
 * P3 TS-12 修复：将原 App.vue 中的 Window 扩展移至 env.d.ts，
 * 确保 tsc（非仅 vue-tsc）也能识别 Window.__gameState 类型。
 * env.d.ts 为脚本文件，直接声明 interface Window 即可全局扩展。
 */
interface Window {
  /** 游戏界面状态响应式引用（由 App.vue 初始化，控制台 switch 命令写入） */
  __gameState: import('vue').Ref<'character-select' | 'game' | 'admin'>;
}
