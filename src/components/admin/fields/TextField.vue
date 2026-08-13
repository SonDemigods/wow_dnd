<template>
  <div class="form-group">
    <label :for="'field-' + field.key">
      {{ field.label }}<span v-if="field.required" class="required-mark">*</span>
    </label>
    <input
      :id="'field-' + field.key"
      :value="modelValue as string | number"
      :type="inputType"
      :placeholder="field.placeholder"
      :disabled="field.disabled"
      class="form-input"
      @input="$emit('update:modelValue', getTextValue($event))"
      @blur="$emit('blur')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 文本/数字字段组件
 *
 * 同时处理 text 和 number 两种输入类型，由 field.type 决定 input 的 type 属性。
 */
import { computed } from 'vue';
import type { FormField, FormFieldValue } from './types';

const props = defineProps<{
  field: FormField;
  modelValue: FormFieldValue;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

const inputType = computed(() => (props.field.type === 'number' ? 'number' : 'text'));

/** 从输入事件中安全提取文本值 */
function getTextValue(e: Event): string {
  const target = e.target;
  if (target instanceof HTMLInputElement) return target.value;
  return '';
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.form-group {
  margin-bottom: 16px;

  label {
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

.form-input {
  width: 100%;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-md;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: @accent-color;
  }

  &:disabled {
    opacity: @opacity-dimmed;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.02);
  }
}
</style>
