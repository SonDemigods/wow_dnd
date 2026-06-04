import { ref } from 'vue';

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
