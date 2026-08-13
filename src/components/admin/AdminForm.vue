<template>
  <div v-if="visible" class="form-overlay" @click.self="$emit('cancel')">
    <div class="form-dialog" @keydown="onKeydown">
      <div class="form-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      <div class="form-body">
        <div v-for="field in fields" :key="field.key" class="form-field-wrapper">
          <component
            :is="fieldComponentMap[field.type]"
            :field="field"
            v-model="formData[field.key]"
            v-bind="field.type === 'json' ? { submitError: !!jsonSubmitErrors[field.key] } : {}"
            @blur="handleFieldBlur(field.key)"
          />
          <!-- 校验错误提示 -->
          <p v-if="errors[field.key]" class="field-error">{{ errors[field.key] }}</p>
        </div>

        <!-- 自定义内容插槽 -->
        <slot name="custom-fields" :formData="formData" />
      </div>
      <div class="form-footer">
        <span class="shortcut-hint">Esc 取消 · Ctrl+S 保存</span>
        <button class="btn btn-secondary" @click="$emit('cancel')">取消</button>
        <button class="btn btn-primary" @click="handleSubmit">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 通用表单弹窗组件
 *
 * 根据字段配置动态渲染表单，通过 fieldComponentMap 将各字段类型的渲染
 * 委托给独立的字段子组件（fields/ 目录下）。
 * 支持字段类型：text/number/textarea/select/multiselect/switch/color/json
 *
 * Phase 3 新增：字段校验（required/pattern/min-max/minLength-maxLength/json）
 * + 键盘快捷键（Esc 取消 / Ctrl+S 保存）
 */
import { reactive, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Component } from 'vue';
import type { AdminRecord } from '@/modules/admin';
import type { FormField, FormFieldValue, FormFieldType } from './fields/types';
import { useFormValidation } from './composables/useFormValidation';
import TextField from './fields/TextField.vue';
import TextareaField from './fields/TextareaField.vue';
import SelectField from './fields/SelectField.vue';
import MultiselectField from './fields/MultiselectField.vue';
import SwitchField from './fields/SwitchField.vue';
import ColorField from './fields/ColorField.vue';
import JsonField from './fields/JsonField.vue';

// Re-export FormField for backward compatibility
export type { FormField } from './fields/types';

/** 字段类型 → 组件映射 */
const fieldComponentMap: Record<FormFieldType, Component> = {
  text: TextField,
  number: TextField,
  textarea: TextareaField,
  select: SelectField,
  multiselect: MultiselectField,
  switch: SwitchField,
  color: ColorField,
  json: JsonField,
};

const props = defineProps<{
  /** 是否显示 */
  visible: boolean;
  /** 表单标题 */
  title: string;
  /** 字段定义 */
  fields: FormField[];
  /** 初始数据（编辑模式时传入） */
  initialData?: AdminRecord | null;
}>();

const emit = defineEmits<{
  submit: [data: AdminRecord];
  cancel: [];
}>();

/** 表单数据 */
const formData = reactive<Record<string, FormFieldValue>>({});

/** JSON 提交时解析错误标记 */
const jsonSubmitErrors = reactive<Record<string, boolean>>({});

/** 校验引擎 */
const { errors, validate, validateField, clearErrors } = useFormValidation(props.fields, formData);

/** 表单对话框 ref（用于自动 focus） */
let formDialogEl: HTMLElement | null = null;

// 监听 initialData / visible 变化，初始化表单数据
watch(
  [() => props.initialData, () => props.visible],
  ([data, visible]) => {
    if (!visible) return;
    // 先清空
    Object.keys(formData).forEach(key => delete formData[key]);
    // 重置 JSON 提交错误状态
    Object.keys(jsonSubmitErrors).forEach(key => delete jsonSubmitErrors[key]);
    // 清空校验错误
    clearErrors();
    if (data) {
      Object.assign(formData, data);
    }
    // 为所有字段设置默认值
    props.fields.forEach(field => {
      if (!(field.key in formData)) {
        if (field.type === 'multiselect') {
          formData[field.key] = [];
        } else if (field.type === 'number') {
          formData[field.key] = 0;
        } else {
          formData[field.key] = '';
        }
      }
      // JSON 类型字段：将对象/数组序列化为格式化的 JSON 字符串
      if (field.type === 'json' && typeof formData[field.key] === 'object') {
        formData[field.key] = JSON.stringify(formData[field.key], null, 2);
      }
    });
    // 自动 focus 第一个输入框
    nextTick(() => {
      formDialogEl?.querySelector('input, textarea, select')?.focus();
    });
  },
  { immediate: true }
);

/** 字段 blur 时触发单字段校验 */
function handleFieldBlur(fieldKey: string): void {
  validateField(fieldKey);
}

/** 键盘快捷键 */
function onKeydown(e: KeyboardEvent): void {
  // Esc → 取消
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('cancel');
    return;
  }
  // Ctrl+S / Cmd+S → 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    handleSubmit();
  }
}

/** 提交表单 */
function handleSubmit() {
  // 全量校验
  if (!validate()) return;

  // 将 number 类型字段的值转为数字，收集为 AdminRecord
  const data: AdminRecord = {};
  let hasParseError = false;
  props.fields.forEach(field => {
    let value: unknown = formData[field.key];
    if (field.type === 'number' && typeof value === 'string') {
      value = Number(value);
    }
    if (field.type === 'json' && typeof value === 'string' && value.trim()) {
      try {
        value = JSON.parse(value);
        jsonSubmitErrors[field.key] = false;
      } catch (e) {
        console.error(e);
        jsonSubmitErrors[field.key] = true;
        hasParseError = true;
      }
    }
    data[field.key] = value;
  });
  if (hasParseError) return;
  emit('submit', data);
}

onMounted(() => {
  formDialogEl = document.querySelector('.form-dialog');
});
onUnmounted(() => {
  formDialogEl = null;
});
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.form-overlay {
  .overlay-mask(@overlay-heavy; @z-combat-overlay);
}

.form-dialog {
  background: #0d1117;
  border: 2px solid @border-color;
  border-radius: @radius-xl;
  width: 500px;
  max-height: 80vh;
  .flex-col();
}

.form-header {
  .flex-between();
  padding: @spacing-3xl @spacing-4xl;
  border-bottom: 1px solid @border-color;

  h3 {
    color: @accent-color;
    margin: 0;
    font-size: @font-xl;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    background: @white-10;
    border: none;
    border-radius: 50%;
    color: @text-primary;
    font-size: @font-xl;
    cursor: pointer;

    &:hover {
      background: @white-20;
    }
  }
}

.form-body {
  padding: @spacing-4xl;
  overflow-y: auto;
  flex: 1;
}

.form-field-wrapper {
  margin-bottom: 0;
}

.field-error {
  color: @danger-color;
  font-size: @font-sm;
  margin: 2px 0 12px;
  padding-left: 2px;
}

.form-footer {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
}

.shortcut-hint {
  font-size: @font-xs;
  color: @text-secondary;
  opacity: 0.6;
  margin-right: auto;
}

.btn {
  .admin-btn-base(@spacing-4xl);

  &-primary {
    background: @accent-color;
    color: @primary-bg;
    border-color: @accent-color;
  }

  &-secondary {
    background: transparent;
    color: @text-primary;
  }
}
</style>
