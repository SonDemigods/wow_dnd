<template>
  <BasePopup :visible="visible" title="进度" max-width="640px" @close="$emit('close')">
    <template #default>
      <div class="progress-tabs">
        <button
          :class="['progress-tab', { active: activeTab === 'quests' }]"
          @click="activeTab = 'quests'"
        >
          <BaseIcon :name="COMMON_ICONS.notebook" gradient="gold" :size="16" /> 任务
          <MenuBadge :count="questStore.activeCount" variant="info" />
        </button>
        <button
          :class="['progress-tab', { active: activeTab === 'log' }]"
          @click="activeTab = 'log'"
        >
          <BaseIcon name="scroll-unfurled" gradient="nature" :size="16" /> 日志
          <MenuBadge :count="logStore.unreadCount" variant="danger" />
        </button>
      </div>
      <div class="progress-panel-body">
        <QuestPanel v-show="activeTab === 'quests'" :visible="visible && activeTab === 'quests'" />
        <LogPanel v-show="activeTab === 'log'" :visible="visible && activeTab === 'log'" :current-area="currentArea" />
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 进度弹窗（任务 + 日志 合并）
 * @description 分段容器：[任务] [日志] 标签切换，复用 QuestPanel/LogPanel 内容组件。
 */
import { ref, watch } from 'vue';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { COMMON_ICONS } from '@/config/icons';
import MenuBadge from '../common/MenuBadge.vue';
import QuestPanel from './panels/QuestPanel.vue';
import LogPanel from './panels/LogPanel.vue';
import { useQuestStore } from '@/modules/quest';
import { useLogStore } from '@/modules/log';

const props = defineProps<{
  visible: boolean;
  currentArea?: string;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const questStore = useQuestStore();
const logStore = useLogStore();
const activeTab = ref<'quests' | 'log'>('quests');

// 打开时若日志有未读，默认切到日志段；否则任务段
watch(() => props.visible, (val) => {
  if (val) {
    activeTab.value = logStore.unreadCount > 0 ? 'log' : 'quests';
  }
});
</script>

<style lang="less" scoped>
.progress-tabs {
  .segment-tabs();
}

.progress-tab {
  .segment-tab();
}

.progress-panel-body {
  .segment-panel-body();
}
</style>
