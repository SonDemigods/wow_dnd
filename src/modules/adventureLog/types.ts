/**
 * 日志条目类型
 */
export type LogType = 'info' | 'combat' | 'quest' | 'item' | 'level'

/**
 * 日志条目接口
 */
export interface LogEntry {
  id: string
  timestamp: number
  type: LogType
  message: string
  icon: string
}

/**
 * 冒险日志服务接口
 */
export interface IAdventureLogService {
  getLogs: () => LogEntry[]
  addLog: (message: string, type?: LogType) => void
  clearLogs: () => void
  reset: () => void
}