<template>
  <div class="form-group">
    <label>{{ field.label }}<span v-if="field.required" class="required-mark">*</span></label>
    <div class="multiselect-group">
      <label
        v-for="opt in field.options"
        :key="opt.value"
        class="multiselect-item"
        :class="{ checked: isSelected(opt.value) }"
      >
        <input
          type="checkbox"
          :value="opt.value"
          :checked="isSelected(opt.value)"
          :disabled="field.disabled"
          @change="toggleValue(opt.value)"
        />
        {{ opt.label }}
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 多选字段组件 */
import type { FormField, FormFieldValue } from './types';

const props = defineProps<{
  field: FormField;
  modelValue: FormFieldValue;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  blur: [];
}>();

/** 判断是否选中 */
function isSelected(value: string): boolean {
  const arr = props.modelValue;
  return Array.isArray(arr) && arr.includes(value);
}

/** 切换选中状态 */
function toggleValue(value: string): void {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const idx = current.indexOf(value);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(value);
  }
  emit('update:modelValue', current);
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

.multiselect-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-sm;
  max-height: 240px;
  overflow-y: auto;
  padding: @spacing-md;
  background: @white-03;
  border: 1px solid @border-color;
  border-radius: @radius-md;
}

.multiselect-item {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  color: @text-secondary;
  font-size: @font-base;
  cursor: pointer;
  padding: @spacing-xs @spacing-sm;
  border-radius: @radius-sm;
  transition: background 0.15s;

  &:hover {
    background: @white-05;
  }

  &.checked {
    color: @accent-color;
    background: rgba(0, 200, 150, 0.08);
  }

  input[type='checkbox'] {
    accent-color: @accent-color;
    width: 14px;
    height: 14px;
    margin: 0;
    cursor: pointer;
  }
}
</style>
