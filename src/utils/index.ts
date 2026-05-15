/**
 * 游戏工具函数
 */

/**
 * 投掷 D20 骰子
 * @returns 1-20 之间的随机整数
 */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

/**
 * 投掷指定范围的骰子
 * @param min 最小值（包含）
 * @param max 最大值（包含）
 * @returns 范围内的随机整数
 */
export function rollDice(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 格式化数字为千分位格式
 * @param num 要格式化的数字
 * @returns 格式化后的字符串
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * 将百分比转换为 0-1 的小数
 * @param percent 百分比数值
 * @returns 0-1 之间的小数
 */
export function percentToDecimal(percent: number): number {
  return Math.max(0, Math.min(1, percent / 100))
}

/**
 * 限制数值在指定范围内
 * @param value 要限制的值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的值
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 生成唯一 ID
 * @returns 唯一字符串 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 防抖函数
 * @param func 要执行的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

/**
 * 节流函数
 * @param func 要执行的函数
 * @param limit 时间限制（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 数组随机洗牌
 * @param array 要洗牌的数组
 * @returns 洗牌后的新数组
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

/**
 * 从数组中随机选择一个元素
 * @param array 源数组
 * @returns 随机选择的元素
 */
export function randomChoice<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * 从数组中随机选择多个不重复的元素
 * @param array 源数组
 * @param count 要选择的数量
 * @returns 随机选择的元素数组
 */
export function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array)
  return shuffled.slice(0, count)
}

/**
 * 检查是否在移动设备上
 * @returns 是否为移动设备
 */
export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768
}

/**
 * 检查是否为平板设备
 * @returns 是否为平板设备
 */
export function isTablet(): boolean {
  return window.innerWidth > 768 && window.innerWidth <= 1024
}

/**
 * 检查是否为桌面设备
 * @returns 是否为桌面设备
 */
export function isDesktop(): boolean {
  return window.innerWidth > 1024
}

/**
 * 获取设备类型
 * @returns 设备类型：'mobile' | 'tablet' | 'desktop'
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobile()) return 'mobile'
  if (isTablet()) return 'tablet'
  return 'desktop'
}
