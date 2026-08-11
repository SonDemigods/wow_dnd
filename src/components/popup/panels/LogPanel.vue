<template>
  <div class="log-panel">
    <div class="log-header" v-if="currentArea">
      {{ currentArea }} - 冒险记录
    </div>

    <div class="log-container" ref="logContainer">
      <div
        v-for="log in logs"
        :key="log.id"
        class="log-entry"
        :class="`log-type-${log.type}`"
      >
        <span class="log-time">{{ formatTimestamp(log.timestamp) }}</span>
        <span class="log-icon"><BaseIcon :name="(log.icon || getDefaultIcon(log.type).name)" :gradient="getDefaultIcon(log.type).gradient" :size="16" /></span>
        <span class="log-message">{{ log.message }}</span>
      </div>

      <EmptyState v-if="logs.length === 0" icon="scroll-unfurled" text="暂无冒险记录" />
    </div>

    <div class="log-footer-actions">
      <button class="popup-footer-btn danger" @click="showClearConfirm = true; eventBus.emit(GameEvents.UI_CLICK, { source: 'log_clear_btn' })">清空日志</button>
    </div>

    <ConfirmPopup
      :visible="showClearConfirm"
      title="清空日志"
      message="确定要清空所有冒险日志吗？此操作不可撤销。"
      type="danger"
      @confirm="confirmClear"
      @cancel="showClearConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 冒险日志面板内容组件（无 BasePopup 外壳）
 * @description 展示冒险记录列表，支持按类型着色和清空日志。供 ProgressPopup 分段复用。
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useLogStore } from '@/modules/log';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import BaseIcon from '@/components/common/BaseIcon.vue';
import ConfirmPopup from '../../common/ConfirmPopup.vue';
import EmptyState from '../../common/EmptyState.vue';

const props = defineProps<{
  visible: boolean;
  currentArea?: string;
}>();

const logStore = useLogStore();
const toast = useToast();
const logContainer = ref<HTMLDivElement | null>(null);
const showClearConfirm = ref(false);

const logs = computed(() => logStore.logs);
const currentArea = computed(() => props.currentArea || '未知区域');

const getDefaultIcon = (type: string): { name: string; gradient: string } => {
  const iconMap: Record<string, { name: string; gradient: string }> = {
    'info': { name: 'scroll-unfurled', gradient: 'earth' },
    'combat': { name: 'crossed-swords', gradient: 'physical' },
    'quest': { name: 'notebook', gradient: 'gold' },
    'item': { name: 'chest', gradient: 'gold' },
    'level': { name: 'level-up', gradient: 'gold' },
    'death': { name: 'death-skull', gradient: 'debuff' },
    'resurrect': { name: 'resurrection', gradient: 'gold' },
    'shop': { name: 'shop', gradient: 'gold' },
    'skill': { name: 'resurrection', gradient: 'gold' },
    'exploration': { name: 'treasure-map', gradient: 'nature' },
    'zone': { name: 'uncertainty', gradient: 'shadow' }
  };
  return iconMap[type] || { name: 'scroll-unfurled', gradient: 'earth' };
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const confirmClear = async () => {
  try {
    logStore.clearLogs();
  } catch (e) {
    console.error('[LogPanel] 清空日志失败:', e);
    toast.show({ message: '清空日志失败，请重试', type: 'danger' });
  }
  showClearConfirm.value = false;
};

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
};

onMounted(() => {
  scrollToBottom();
});

watch(logs, () => {
  scrollToBottom();
});

watch(() => props.visible, (val) => {
  if (val) {
    // 打开日志面板时标记已读
    logStore.markAllRead();
    scrollToBottom();
  }
});
</script>

<style lang="less" scoped>
.log-header {
  color: #a0a0c0;
  font-size: @font-base;
  margin-bottom: @spacing-lg;
  padding: @spacing-sm @spacing-lg;
  background: #252540;
  border-radius: @radius-sm;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #0f0f1a;
  border: 1px solid #3a3a5a;
  border-radius: @radius-md;
  padding: @spacing-lg;
  .custom-scrollbar();
}

.log-entry {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: 5px @spacing-md;
  margin-bottom: 3px;
  border-radius: @radius-sm;
  font-size: @font-base;
  line-height: 1.5;
}

.log-time {
  color: #8a8aaa;
  font-family: monospace;
  font-size: @font-sm;
  min-width: 110px;
  flex-shrink: 0;
}

.log-icon {
  display: flex;
  align-items: center;
  font-size: @font-md;
}

.log-message {
  color: #d0d0f0;
  flex: 1;
}

.log-type-info { background: rgba(100, 100, 150, 0.1); }
.log-type-combat { background: rgba(200, 80, 80, 0.1); }
.log-type-quest { background: rgba(80, 150, 200, 0.1); }
.log-type-item { background: rgba(150, 80, 200, 0.1); }
.log-type-level { background: rgba(200, 180, 80, 0.1); }
.log-type-death { background: rgba(180, 40, 40, 0.15); }
.log-type-resurrect { background: rgba(80, 200, 180, 0.1); }
.log-type-shop { background: rgba(200, 150, 80, 0.1); }
.log-type-skill { background: rgba(80, 200, 80, 0.1); }
.log-type-exploration { background: rgba(80, 120, 200, 0.1); }
.log-type-zone { background: rgba(150, 100, 200, 0.1); }

.log-footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: @spacing-lg;
}

@media (max-width: 640px) {
  .log-entry {
    font-size: 12px;
  }

  .log-time {
    min-width: 95px;
    font-size: 11px;
  }
}
</style>