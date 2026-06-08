/**
 * @fileoverview Toast 提示组合函数
 * @description 提供全局 Toast 消息提示功能，支持多种类型和自动关闭
 * @module composables/useToast
 */

import { ref } from 'vue';

/**
 * Toast 提示配置选项
 * @property {string} message - 提示消息文本
 * @property {'info' | 'success' | 'warning' | 'danger'} [type] - 提示类型，默认为 info
 * @property {string} [icon] - 自定义图标类名
 * @property {number} [duration] - 显示时长（毫秒），默认为 2500
 */
export interface ToastOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  icon?: string;
  duration?: number;
}

const visible = ref(false);
const message = ref('');
const type = ref<'info' | 'success' | 'warning' | 'danger'>('info');
const icon = ref('');

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * 使用 Toast 提示
 * @returns {{ visible, message, type, icon, show, close }} Toast 响应式状态与控制方法
 */
export function useToast() {
  function show(options: ToastOptions | string) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (typeof options === 'string') {
      message.value = options;
      type.value = 'info';
      icon.value = '';
    } else {
      message.value = options.message;
      type.value = options.type || 'info';
      icon.value = options.icon || '';
    }

    visible.value = true;

    const duration = typeof options === 'object' ? options.duration ?? 2500 : 2500;
    timer = setTimeout(() => {
      visible.value = false;
      timer = null;
    }, duration);
  }

  function close() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    visible.value = false;
  }

  return {
    visible,
    message,
    type,
    icon,
    show,
    close
  };
}
