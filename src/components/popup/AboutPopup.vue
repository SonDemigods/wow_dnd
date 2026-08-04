<template>
  <BasePopup
    :visible="visible"
    title="关于"
    max-width="420px"
    @close="$emit('close')"
  >
    <div class="about-body">
      <!-- 项目名称 -->
      <div class="about-project">
        <h3 class="about-project-name">战争艺术：地下城</h3>
        <p class="about-project-en">Art of War: Dungeons</p>
      </div>

      <!-- 简介 -->
      <div class="about-section">
        <div class="about-section-title">简介</div>
        <p class="about-section-text">{{ descriptionText }}</p>
      </div>

      <!-- 鸣谢 -->
      <div class="about-section">
        <div class="about-row">
          <span class="about-label">作者</span>
          <span class="about-value">{{ authorsText }}</span>
        </div>
        <div class="about-row">
          <span class="about-label">参与人</span>
          <span class="about-value">{{ contributorsText }}</span>
        </div>
      </div>

      <!-- 版本号 -->
      <div class="about-section">
        <div class="about-row">
          <span class="about-label">应用版本</span>
          <span class="about-value">v{{ APP_VERSION }}</span>
        </div>
        <div class="about-row">
          <span class="about-label">数据版本</span>
          <span class="about-value">v{{ DATA_VERSION }}</span>
        </div>
        <div class="about-row">
          <span class="about-label">数据库版本</span>
          <span class="about-value">v{{ DB_SCHEMA_VERSION }}</span>
        </div>
      </div>

      <!-- 仓库地址（仅 repoUrl 非空时渲染） -->
      <div v-if="CREDITS.repoUrl" class="about-section">
        <div class="about-row about-row-repo">
          <span class="about-label">仓库地址</span>
          <span class="about-value about-repo">{{ CREDITS.repoUrl }}</span>
        </div>
      </div>
    </div>

  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 关于弹窗组件
 * @description 展示项目信息与鸣谢：项目名/简介/作者/参与人/三层版本号/仓库地址
 *
 * 数据来源：credits.ts（作者/参与人/简介/仓库地址）+ version.ts（三层版本号）。
 * 对空值做容错：authors/contributors/description 为空时显示"暂无"，repoUrl 为空时不渲染该行。
 * 不展示技术栈（按产品需求）。
 */

import { computed } from 'vue';
import { eventBus, GameEvents } from '@/modules/bus';
import BasePopup from '../common/BasePopup.vue';
import { CREDITS } from '@/config/credits';
import { APP_VERSION, DATA_VERSION, DB_SCHEMA_VERSION } from '@/config/version';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

/** 作者名单（空数组时显示"暂无"） */
const authorsText = computed(() =>
  CREDITS.authors.length > 0 ? CREDITS.authors.join('、') : '暂无'
);

/** 参与人名单（空数组时显示"暂无"） */
const contributorsText = computed(() =>
  CREDITS.contributors.length > 0 ? CREDITS.contributors.join('、') : '暂无'
);

/** 项目简介（空字符串时显示"暂无"） */
const descriptionText = computed(() =>
  CREDITS.description || '暂无'
);

</script>

<style lang="less" scoped>
.about-body {
  .flex-col();
  gap: @spacing-3xl;
  padding: @spacing-md @spacing-xs;
}

/* 项目名称 */
.about-project {
  text-align: center;
  padding-bottom: @spacing-xl;
  border-bottom: 1px solid rgba(255, 215, 0, 0.15);
}

.about-project-name {
  font-size: @font-2xl;
  color: @accent-color;
  font-weight: @font-weight-bold;
  margin-bottom: @spacing-sm;
  text-shadow: @text-shadow-title;
}

.about-project-en {
  color: @color-dodge;
  font-size: @font-sm;
  letter-spacing: 1px;
}

/* 信息分区 */
.about-section {
  .flex-col();
  gap: @spacing-md;
}

.about-section-title {
  color: @color-dodge;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  letter-spacing: 1px;
  padding-bottom: @spacing-xs;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.about-section-text {
  color: #b0b0b0;
  font-size: @font-sm;
  line-height: 1.6;
}

/* 信息行 */
.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: @font-sm;
  gap: @spacing-lg;
}

.about-row-repo {
  align-items: flex-start;
}

.about-label {
  color: #888;
  flex-shrink: 0;
}

.about-value {
  color: @text-primary;
  font-weight: @font-weight-bold;
  text-align: right;
  word-break: break-all;
}

.about-repo {
  color: @accent-color;
  font-family: monospace;
  font-size: @font-xs;
}
</style>
