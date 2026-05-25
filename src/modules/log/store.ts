import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LogEntry, LogType } from './types';
import { logService } from './service';

export const useLogStore = defineStore('log', () => {
  const logs = ref<LogEntry[]>([]);
  const currentCharacterId = ref<string | null>(null);

  const logCount = computed(() => logs.value.length);

  async function init(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;
    await logService.init(characterId);
    logs.value = logService.getLogs();
  }

  function addLog(entry: LogEntry): void {
    logService.addLog(entry);
    logs.value = logService.getLogs();
  }

  function addLogWithType(message: string, type: LogType): void {
    const entry: LogEntry = {
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type,
      message
    };
    addLog(entry);
  }

  function getLogs(): LogEntry[] {
    return logService.getLogs();
  }

  function getLogsByType(type: LogType): LogEntry[] {
    return logService.getLogsByType(type);
  }

  function clearLogs(): void {
    logService.clearLogs();
    logs.value = [];
  }

  function getLogCount(): number {
    return logService.getLogCount();
  }

  return {
    logs,
    logCount,
    init,
    addLog,
    addLogWithType,
    getLogs,
    getLogsByType,
    clearLogs,
    getLogCount
  };
});