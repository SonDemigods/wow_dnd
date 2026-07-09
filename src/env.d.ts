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
  import type { Plugin } from 'vue'
  const VueVirtualScroller: Plugin
  // 使用 any 绕过 vue-tsc 对第三方组件 slot props 的类型检查
  export const RecycleScroller: any
  export const DynamicScroller: any
  export const DynamicScrollerItem: any
  export default VueVirtualScroller
}
