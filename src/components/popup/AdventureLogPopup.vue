<template>
  <BasePopup :visible="visible" title="冒险日志" @close="$emit('close')">
    <template #default>
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
          <span class="log-icon">{{ log.icon || getDefaultIcon(log.type) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>

        <div v-if="logs.length === 0" class="empty-logs">
          暂无冒险记录
        </div>
      </div>
    </template>

    <template #footer>
      <button class="popup-footer-btn warn" @click="showClearConfirm = true; eventBus.emit(GameEvents.UI_CLICK, { source: 'log_clear_btn' })">清空日志</button>
    </template>
  </BasePopup>

  <ConfirmPopup
    :visible="showClearConfirm"
    title="清空日志"
    message="确定要清空所有冒险日志吗？此操作不可撤销。"
    type="danger"
    @confirm="confirmClear"
    @cancel="showClearConfirm = false"
  />
</template>

<script setup lang="ts">
/**
 * @fileoverview 冒险日志弹窗组件
 * @description 展示冒险记录列表，支持按类型着色和清空日志操作
 */

import { ref, computed, onMounted, nextTick } from 'vue';
import { useLogStore } from '../../modules/log';
import { eventBus, GameEvents } from '@/modules/bus/core';
import BasePopup from '../common/BasePopup.vue';
import ConfirmPopup from '../common/ConfirmPopup.vue';

interface Props {
  visible: boolean;
  currentArea?: string;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const logStore = useLogStore();
const logContainer = ref<HTMLDivElement | null>(null);
const showClearConfirm = ref(false);

// 直接使用 store 的响应式 logs ref，确保每次日志变更都触发界面更新
const logs = computed(() => logStore.logs);
const currentArea = computed(() => props.currentArea || '未知区域');

const getDefaultIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    'info': '📜',
    'combat': '⚔️',
    'quest': '📋',
    'item': '📦',
    'level': '⬆️',
    'death': '💀',
    'resurrect': '✨',
    'shop': '🛒',
    'skill': '✨',
    'exploration': '🗺️',
    'zone': '📍'
  };
  return iconMap[type] || '📜';
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

const confirmClear = () => {
  logStore.clearLogs();
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
</script>

<style scoped>
.log-header {
  color: #a0a0c0;
  font-size: 13px;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: #252540;
  border-radius: 4px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #0f0f1a;
  border: 1px solid #3a3a5a;
  border-radius: 6px;
  padding: 10px;
}

.log-container::-webkit-scrollbar {
  width: 6px;
}

.log-container::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.log-container::-webkit-scrollbar-thumb {
  background: #4a4a6a;
  border-radius: 3px;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  margin-bottom: 3px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.log-time {
  color: #8a8aaa;
  font-family: monospace;
  font-size: 12px;
  min-width: 110px;
  flex-shrink: 0;
}

.log-icon {
  font-size: 14px;
}

.log-message {
  color: #d0d0f0;
  flex: 1;
}

.log-type-info {
  background: rgba(100, 100, 150, 0.1);
}

.log-type-combat {
  background: rgba(200, 80, 80, 0.1);
}

.log-type-quest {
  background: rgba(80, 150, 200, 0.1);
}

.log-type-item {
  background: rgba(150, 80, 200, 0.1);
}

.log-type-level {
  background: rgba(200, 180, 80, 0.1);
}

.log-type-death {
  background: rgba(180, 40, 40, 0.15);
}

.log-type-resurrect {
  background: rgba(80, 200, 180, 0.1);
}

.log-type-shop {
  background: rgba(200, 150, 80, 0.1);
}

.log-type-skill {
  background: rgba(80, 200, 80, 0.1);
}

.log-type-exploration {
  background: rgba(80, 120, 200, 0.1);
}

.log-type-zone {
  background: rgba(150, 100, 200, 0.1);
}

.empty-logs {
  color: #6a6a8a;
  text-align: center;
  padding: 32px;
  font-size: 13px;
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