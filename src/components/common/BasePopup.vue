<template>
  <div v-if="visible" class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content" :style="contentStyle">
      <div class="popup-header">
        <h2 class="popup-title">{{ title }}</h2>
        <slot name="header-extra" />
        <button v-if="showClose" class="popup-close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="popup-body" :class="bodyClass">
        <slot />
      </div>

      <div v-if="$slots.footer || showFooterClose" class="popup-footer">
        <slot name="footer" />
        <button v-if="showFooterClose" class="popup-footer-btn" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 基础弹窗组件
 * @description 通用的弹出层容器组件，提供标题栏、内容区、底部操作栏的插槽布局，支持自定义最大宽度和关闭按钮显隐
 */

import { computed } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  maxWidth?: string;
  showClose?: boolean;
  showFooterClose?: boolean;
  bodyClass?: string;
}>(), {
  title: '',
  maxWidth: '600px',
  showClose: true,
  showFooterClose: true,
  bodyClass: ''
});

defineEmits<{
  (e: 'close'): void;
}>();

const contentStyle = computed(() => ({
  maxWidth: props.maxWidth
}));
</script>
