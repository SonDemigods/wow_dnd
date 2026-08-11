<template>
  <BasePopup :visible="visible" title="构筑" max-width="640px" @close="$emit('close')">
    <template #default>
      <div class="build-tabs">
        <button
          :class="['build-tab', { active: activeTab === 'skills' }]"
          @click="activeTab = 'skills'"
        >
          <BaseIcon name="sword-spin" gradient="gold" :size="16" /> 技能
          <MenuBadge v-if="talentStore.availablePoints > 0" :count="0" variant="info" />
        </button>
        <button
          :class="['build-tab', { active: activeTab === 'talents' }]"
          @click="activeTab = 'talents'"
        >
          <BaseIcon name="star" gradient="gold" :size="16" /> 天赋
          <MenuBadge :count="talentStore.availablePoints" variant="danger" />
        </button>
      </div>
      <div class="build-panel-body">
        <SkillsPanel v-show="activeTab === 'skills'" />
        <TalentsPanel v-show="activeTab === 'talents'" />
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 构筑弹窗（技能 + 天赋 合并）
 * @description 分段容器：[技能] [天赋] 标签切换，复用 SkillsPanel/TalentsPanel 内容组件。
 *              默认进入天赋段当有未分配天赋点，否则进入技能段。
 */
import { ref, watch } from 'vue';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import MenuBadge from '../common/MenuBadge.vue';
import SkillsPanel from './panels/SkillsPanel.vue';
import TalentsPanel from './panels/TalentsPanel.vue';
import { useTalentStore } from '@/modules/character/talents';

const props = defineProps<{
  visible: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const talentStore = useTalentStore();
const activeTab = ref<'skills' | 'talents'>('skills');

// 打开时若有未分配天赋点，默认切到天赋段
watch(() => props.visible, (val) => {
  if (val && talentStore.availablePoints > 0) {
    activeTab.value = 'talents';
  } else if (val) {
    activeTab.value = 'skills';
  }
});
</script>

<style lang="less" scoped>
.build-tabs {
  display: flex;
  gap: @spacing-md;
  margin: -@spacing-3xl -@spacing-3xl @spacing-2xl;
  padding: @spacing-sm @spacing-3xl 0 @spacing-3xl;
  border-bottom: @border-sm;
  position: sticky;
  top: -@spacing-3xl;
  z-index: 1;
  background: @popup-bg;
}

.build-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: @spacing-md @spacing-xl;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: @text-secondary;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
  white-space: nowrap;
  flex-shrink: 0;
}

.build-tab:hover {
  color: @text-primary;
}

.build-tab.active {
  color: @accent-color;
  border-bottom-color: @accent-color;
}

.build-panel-body {
  min-height: 300px;
  padding-top: @spacing-2xl;
}
</style>
