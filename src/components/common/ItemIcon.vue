<template>
  <BaseIcon :name="displayIcon" :gradient="iconGradient" :size="gameIconSize" />
</template>

<script setup lang="ts">
/**
 * @fileoverview 统一的物品/装备图标组件
 * @description 用于在背包、商店、角色面板等处展示物品图标，保证样式统一且自适应尺寸。
 *              支持预设尺寸（sm/md/lg/xl）、自定义像素值以及稀有度边框/发光特效。
 *              图标找不到时自动回退为问号（GameIcon 内置回退）。
 */

import { computed } from 'vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { ItemRarity } from '@/modules/inventory/types';

const props = withDefaults(defineProps<{
  /** 图标名（game-icons 名称） */
  icon?: string;
  /** 图标为空时的回退 game-icons 名称 */
  fallback?: string;
  /** 预设尺寸：sm=背包格子, md=装备槽/战斗, lg=商店卡片, xl=详情展示 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 自定义像素尺寸，传入后优先于 size 预设 */
  px?: number;
  /** 物品稀有度，用于显示对应品质的边框和发光特效 */
  rarity?: ItemRarity;
  /** BaseIcon 渐变主题 */
  gradient?: string;
}>(), {
  icon: '',
  fallback: 'uncertainty',
  size: 'md'
});

/** 最终展示的图标：icon 有值用 icon，否则用 fallback */
const displayIcon = computed(() => props.icon || props.fallback);

/** 图标渐变（默认 metal） */
const iconGradient = computed(() => props.gradient || 'metal');

/** BaseIcon 尺寸映射 */
const gameIconSize = computed(() => {
  const sizeMap: Record<string, number> = { sm: 20, md: 24, lg: 28, xl: 32 };
  return props.px || sizeMap[props.size] || 24;
});
</script>

<style lang="less" scoped>
/* 基础样式：统一 flex 居中 + 正方形 */
.item-icon-base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  aspect-ratio: 1;
  border-radius: @radius-sm;
  border: 2px solid transparent;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

/* 预设尺寸：字体大小 + 内边距 + 边框宽度，各场景差异化 */
.item-icon--sm  { font-size: @font-3xl; padding: @spacing-md; border-width: 2px; }   /* 背包格子 */
.item-icon--md  { font-size: @font-4xl; padding: @spacing-lg; border-width: 2px; }  /* 商店卡片 / 战斗 */
.item-icon--lg  { font-size: 26px; padding: @spacing-3xl; border-width: 2px; }  /* 装备槽 */
.item-icon--xl  { font-size: @font-5xl; padding: @spacing-2xl; border-width: 2px; }  /* 详情展示 */

/* ===== 稀有度边框颜色 ===== */
.item-icon--common    { border-color: @color-fallback; }
.item-icon--uncommon  { border-color: #1eff00; }
.item-icon--rare      { border-color: #0070dd; }
.item-icon--epic      { border-color: #a335ee; }

/* 传说品质：橙色边框 + 呼吸发光动画 */
.item-icon--legendary {
  border-color: #ff8000;
  animation: legendary-glow 2s infinite;
}
</style>
