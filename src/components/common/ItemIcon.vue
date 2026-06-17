<template>
  <span
    :class="['item-icon-base', `item-icon--${size}`, rarityClass]"
    :style="customSize ? { fontSize: customSize } : undefined"
  >{{ displayIcon }}</span>
</template>

<script setup lang="ts">
/**
 * @fileoverview 统一的物品/装备图标组件
 * @description 用于在背包、商店、角色面板等处展示物品 emoji 图标，保证样式统一且自适应尺寸。
 *              支持预设尺寸（sm/md/lg/xl）、自定义像素值以及稀有度边框/发光特效。
 */

import { computed } from 'vue';
import type { ItemRarity } from '@/modules/inventory/types';

const props = withDefaults(defineProps<{
  /** 图标 emoji 字符串 */
  icon?: string;
  /** 图标为空时的回退 emoji */
  fallback?: string;
  /** 预设尺寸：sm=背包格子, md=装备槽/战斗, lg=商店卡片, xl=详情展示 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 自定义像素尺寸，传入后优先于 size 预设 */
  px?: number;
  /** 物品稀有度，用于显示对应品质的边框和发光特效 */
  rarity?: ItemRarity;
}>(), {
  icon: '',
  fallback: '📦',
  size: 'md'
});

/** 最终展示的图标：icon 有值用 icon，否则用 fallback */
const displayIcon = computed(() => props.icon || props.fallback);

/** 自定义 CSS 像素值 */
const customSize = computed(() => {
  if (props.px) return `${props.px}px`;
  return undefined;
});

/** 稀有度对应的 CSS 类名 */
const rarityClass = computed(() => props.rarity ? `item-icon--${props.rarity}` : '');
</script>

<style scoped>
/* 基础样式：统一 flex 居中 + 正方形 */
.item-icon-base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  aspect-ratio: 1;
  border-radius: 4px;
  border: 2px solid transparent;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

/* 预设尺寸：字体大小 + 内边距 + 边框宽度，各场景差异化 */
.item-icon--sm  { font-size: 22px; padding: 8px; border-width: 2px; }   /* 背包格子 */
.item-icon--md  { font-size: 24px; padding: 10px; border-width: 2px; }  /* 商店卡片 / 战斗 */
.item-icon--lg  { font-size: 26px; padding: 16px; border-width: 2px; }  /* 装备槽 */
.item-icon--xl  { font-size: 28px; padding: 14px; border-width: 2px; }  /* 详情展示 */

/* ===== 稀有度边框颜色 ===== */
.item-icon--common    { border-color: #9d9d9d; }
.item-icon--uncommon  { border-color: #1eff00; }
.item-icon--rare      { border-color: #0070dd; }
.item-icon--epic      { border-color: #a335ee; }

/* 传说品质：橙色边框 + 呼吸发光动画 */
.item-icon--legendary {
  border-color: #ff8000;
  animation: legendary-glow 2s infinite;
}
</style>
