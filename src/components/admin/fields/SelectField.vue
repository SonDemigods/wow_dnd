<template>
  <div class="form-group">
    <label :for="'field-' + field.key">
      {{ field.label }}<span v-if="field.required" class="required-mark">*</span>
    </label>
    <select
      :id="'field-' + field.key"
      :value="modelValue as string"
      :disabled="field.disabled"
      class="form-input form-select"
      @change="$emit('update:modelValue', getSelectValue($event))"
      @blur="$emit('blur')"
    >
      <option value="">-- 请选择 --</option>
      <option
        v-for="opt in field.options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
/** 下拉选择字段组件 */
import type { FormField, FormFieldValue } from './types';

defineProps<{
  field: FormField;
  modelValue: FormFieldValue;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

/** 从 change 事件中安全提取选中值 */
function getSelectValue(e: Event): string {
  const target = e.target;
  if (target instanceof HTMLSelectElement) return target.value;
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

.form-select {
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

  option {
    background: #0d1117;
    color: @text-primary;
  }
}
</style>
