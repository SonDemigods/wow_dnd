<template>
  <div class="popup-overlay" v-if="visible" @click.self="close">
    <div class="adventure-log-popup">
      <div class="popup-header">
        <h3>冒险日志</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="popup-content">
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
      </div>
      
      <div class="popup-footer">
        <button class="btn btn-secondary" @click="clearLogs">清空日志</button>
        <button class="btn btn-primary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useLogStore } from '../modules/log';

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

const close = () => {
  emit('close');
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
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.adventure-log-popup {
  background: #1a1a2e;
  border: 2px solid #4a4a6a;
  border-radius: 8px;
  width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.popup-header {
  padding: 16px 20px;
  border-bottom: 2px solid #4a4a6a;
  background: linear-gradient(135deg, #2a2a4e 0%, #1a1a2e 100%);
}

.popup-header h3 {
  margin: 0;
  color: #e0e0ff;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
}

.popup-content {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-header {
  color: #a0a0c0;
  font-size: 14px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #252540;
  border-radius: 4px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #0f0f1a;
  border: 1px solid #3a3a5a;
  border-radius: 4px;
  padding: 12px;
}

.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.log-container::-webkit-scrollbar-thumb {
  background: #4a4a6a;
  border-radius: 4px;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
}

.log-number {
  color: #6a6a8a;
  font-family: monospace;
  min-width: 32px;
}

.log-icon {
  font-size: 16px;
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
  padding: 40px;
  font-size: 14px;
}

.popup-footer {
  padding: 12px 20px;
  border-top: 2px solid #4a4a6a;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: #252540;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #4a6fa5 0%, #3a5f95 100%);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #5a7fb5 0%, #4a6fa5 100%);
}

.btn-secondary {
  background: linear-gradient(135deg, #6a5a5a 0%, #5a4a4a 100%);
  color: white;
}

.btn-secondary:hover {
  background: linear-gradient(135deg, #7a6a6a 0%, #6a5a5a 100%);
}

@media (max-width: 640px) {
  .adventure-log-popup {
    width: 95%;
    max-height: 90vh;
  }
  
  .log-entry {
    font-size: 13px;
  }
  
  .log-number {
    min-width: 24px;
  }
}
</style>
