<template>
  <div class="form-group">
    <label>{{ field.label }}<span v-if="field.required" class="required-mark">*</span></label>
    <div class="switch-container">
      <label class="switch">
        <input
          type="checkbox"
          :checked="!!modelValue"
          :disabled="field.disabled"
          @change="$emit('update:modelValue', getCheckedValue($event))"
        />
        <span class="switch-slider" />
      </label>
      <span class="switch-label-text">{{ modelValue ? '是' : '否' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 开关字段组件 */
import type { FormField, FormFieldValue } from './types';

defineProps<{
  field: FormField;
  modelValue: FormFieldValue;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
  blur: [];
}>();

/** 从 change 事件中安全提取选中状态 */
function getCheckedValue(e: Event): boolean {
  const target = e.target;
  if (target instanceof HTMLInputElement) return target.checked;
  return false;
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.form-group {
  margin-bottom: 16px;

  > label {
    display: block;
    color: @text-secondary;
    font-size: @font-base;
    margin-bottom: 5px;
  }
}

.required-mark {
  color: @danger-color;
  margin-left: 2px;
}

.switch-container {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: @white-10;
  border-radius: 24px;
  transition: 0.2s;
  border: 1px solid @border-color;

  &::before {
    content: '';
    position: absolute;
    height: 18px;
    width: 18px;
    left: 2px;
    bottom: 2px;
    background: @text-secondary;
    border-radius: 50%;
    transition: 0.2s;
  }
}

.switch input:checked + .switch-slider {
  background: @accent-color;
  border-color: @accent-color;

  &::before {
    background: @popup-text-color;
    transform: translateX(20px);
  }
}

.switch input:disabled + .switch-slider {
  opacity: 0.4;
  cursor: not-allowed;
}

.switch-label-text {
  font-size: @font-base;
  color: @text-secondary;
}
</style>
