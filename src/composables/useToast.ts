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

/**
 * Toast 单例响应式状态（模块级）
 *
 * 设计约束：本模块采用单例 Toast 设计——同一时刻仅展示一个 Toast。
 * visible / message / type / icon 与 timer 均为模块级共享变量，
 * 由所有调用 useToast() 的组件共同引用，因此：
 * - 新 Toast 调用 show() 时会覆盖正在展示的 Toast（先 clearTimeout 旧计时器）
 * - 无法同时显示多个 Toast
 *
 * 这是项目中有意为之的单例模式（常见于全局轻提示场景），
 * 若未来需要多 Toast 并列展示，需将 visible/message 等重构为 Toast 数组。
 *（CODE-19 说明：单例约束为设计意图，非缺陷）
 */
const visible = ref(false);
const message = ref('');
const type = ref<'info' | 'success' | 'warning' | 'danger'>('info');
const icon = ref('');

/** 当前 Toast 的自动关闭计时器（单例，新 Toast 会先清除旧计时器） */
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * 使用 Toast 提示（单例）
 *
 * 多次调用返回的 ref 与方法均指向同一组模块级状态，
 * 因此任意组件调用 show() 都会更新全局唯一的 Toast 视图。
 *
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
