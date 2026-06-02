<template>
  <BasePopup :visible="visible" title="冒险日志" @close="$emit('close')">
    <template #default>
      <div class="log-header" v-if="currentArea">
        {{ currentArea }} - 冒险记录
      </div>

      <div class="log-container" ref="logContainer">
        <div
          v-for="(log, index) in logs"
          :key="log.id"
          class="log-entry"
          :class="`log-type-${log.type}`"
        >
          <span class="log-number">[{{ index + 1 }}]</span>
          <span class="log-icon">{{ log.icon || getDefaultIcon(log.type) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>

        <div v-if="logs.length === 0" class="empty-logs">
          暂无冒险记录
        </div>
      </div>
    </template>

    <template #footer>
      <button class="popup-footer-btn warn" @click="clearLogs">清空日志</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useLogStore } from '../modules/log';
import BasePopup from './BasePopup.vue';

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

const logs = computed(() => logStore.getLogs());
const currentArea = computed(() => props.currentArea || '未知区域');

const getDefaultIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    'info': '📜',
    'combat': '⚔️',
    'quest': '📋',
    'item': '📦',
    'level': '⬆️'
  };
  return iconMap[type] || '📜';
};

const clearLogs = () => {
  if (confirm('确定要清空所有冒险日志吗？')) {
    logStore.clearLogs();
  }
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

.log-number {
  color: #6a6a8a;
  font-family: monospace;
  min-width: 28px;
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
  
  .log-number {
    min-width: 24px;
  }
}
</style>