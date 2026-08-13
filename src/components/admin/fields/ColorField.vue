<template>
  <div class="form-group">
    <label :for="'field-' + field.key">
      {{ field.label }}<span v-if="field.required" class="required-mark">*</span>
    </label>
    <input
      :id="'field-' + field.key"
      :value="modelValue as string"
      type="color"
      :disabled="field.disabled"
      class="form-color"
      @input="$emit('update:modelValue', getColorValue($event))"
      @blur="$emit('blur')"
    />
  </div>
</template>

<script setup lang="ts">
/** 颜色选择字段组件 */
import type { FormField, FormFieldValue } from './types';

defineProps<{
  field: FormField;
  modelValue: FormFieldValue;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

/** 从 input 事件中安全提取颜色值 */
function getColorValue(e: Event): string {
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

.form-color {
  width: 50px;
  height: 36px;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  cursor: pointer;
  background: transparent;
}
</style>
