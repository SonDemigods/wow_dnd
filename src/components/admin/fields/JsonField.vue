<template>
  <div class="form-group">
    <div class="json-editor">
      <div class="json-toolbar">
        <span class="json-label">{{ field.label }}<span v-if="field.required" class="required-mark">*</span></span>
        <button type="button" class="btn-json-mode" @click="toggleJsonMode">
          {{ jsonMode ? '键值对' : '文本' }}
        </button>
      </div>

      <!-- 文本模式 -->
      <textarea
        v-if="!jsonMode"
        :id="'field-' + field.key"
        :value="modelValue as string"
        :placeholder="field.placeholder"
        :disabled="field.disabled"
        class="form-input form-textarea form-json"
        rows="5"
        @input="$emit('update:modelValue', getTextValue($event))"
      />

      <!-- 键值对模式 -->
      <div v-else class="json-kv-editor">
        <div v-for="(item, idx) in jsonEntries" :key="idx" class="json-kv-row">
          <input
            v-model="item.key"
            type="text"
            class="form-input json-kv-key"
            placeholder="键"
            @input="syncJsonKv"
          />
          <input
            v-model="item.value"
            type="text"
            class="form-input json-kv-value"
            placeholder="值"
            @input="syncJsonKv"
          />
          <button type="button" class="btn-kv-remove" @click="removeJsonEntry(idx)">×</button>
        </div>
        <button type="button" class="btn-kv-add" @click="addJsonEntry">+ 添加属性</button>
      </div>

      <!-- JSON 解析错误提示（文本/键值对模式通用） -->
      <p v-if="parseError || submitError" class="json-error">JSON 解析失败，请检查格式</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * JSON 字段编辑器组件
 *
 * 支持两种编辑模式：
 * - 文本模式：直接编辑 JSON 字符串
 * - 键值对模式：通过 key-value 输入对编辑简单对象
 *
 * 内部管理 jsonMode / jsonEntries / parseError 状态。
 * submitError 由父组件（AdminForm）在提交时设置。
 */
import { ref, watch } from 'vue';
import type { FormField, FormFieldValue } from './types';

const props = defineProps<{
  field: FormField;
  modelValue: FormFieldValue;
  /** 提交时解析失败的标记（由 AdminForm 设置） */
  submitError?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

/** JSON 编辑器模式（true=键值对, false=文本） */
const jsonMode = ref(false);
/** JSON 解析错误标记（切换模式时解析失败） */
const parseError = ref(false);
/** JSON 键值对缓存 */
const jsonEntries = ref<Array<{ key: string; value: string }>>([]);

/** 从输入事件中安全提取文本值 */
function getTextValue(e: Event): string {
  const target = e.target;
  if (target instanceof HTMLTextAreaElement) return target.value;
  return '';
}

/** 切换 JSON 编辑模式 */
function toggleJsonMode(): void {
  if (jsonMode.value) {
    // 键值对 → 文本
    jsonMode.value = false;
    const obj: Record<string, string> = {};
    jsonEntries.value.forEach(e => { if (e.key) obj[e.key] = e.value; });
    emit('update:modelValue', JSON.stringify(obj, null, 2));
  } else {
    // 文本 → 键值对
    try {
      const raw = props.modelValue;
      if (raw && typeof raw === 'string' && raw.trim()) {
        const obj = JSON.parse(raw);
        if (typeof obj === 'object' && !Array.isArray(obj)) {
          jsonEntries.value = Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }));
          parseError.value = false;
          jsonMode.value = true;
          return;
        }
      }
      parseError.value = true;
    } catch (e) {
      console.error(e);
      parseError.value = true;
    }
  }
}

/** 同步键值对到 modelValue */
function syncJsonKv(): void {
  const obj: Record<string, string> = {};
  jsonEntries.value.forEach(e => { if (e.key) obj[e.key] = e.value; });
  emit('update:modelValue', JSON.stringify(obj, null, 2));
  parseError.value = false;
}

/** 添加键值对条目 */
function addJsonEntry(): void {
  jsonEntries.value.push({ key: '', value: '' });
}

/** 删除键值对条目 */
function removeJsonEntry(index: number): void {
  jsonEntries.value.splice(index, 1);
  syncJsonKv();
}

// 当 modelValue 变化（切换记录时），重置内部状态
watch(
  () => props.modelValue,
  () => {
    jsonMode.value = false;
    parseError.value = false;
    jsonEntries.value = [];
  }
);
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.form-group {
  margin-bottom: 16px;
}

.json-editor {
  .json-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
      .json-label { color: @text-secondary; font-size: @font-base; }
    }

    .required-mark {
      color: @danger-color;
      margin-left: 2px;
    }
  .btn-json-mode {
    font-size: @font-xs;
    padding: 2px 8px;
    background: @white-08;
    border: 1px solid @border-color;
    border-radius: @radius-sm;
    color: @text-secondary;
    cursor: pointer;
    &:hover { background: @white-15; }
  }
}

.form-textarea {
  width: 100%;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-md;
  outline: none;
  box-sizing: border-box;
  resize: vertical;

  &:focus {
    border-color: @accent-color;
  }

  &:disabled {
    opacity: @opacity-dimmed;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.02);
  }
}

.form-json {
  font-family: 'Courier New', monospace;
  font-size: @font-sm;
}

.json-kv-editor {
  display: flex;
  flex-direction: column;
  gap: @spacing-sm;
}

.json-kv-row {
  display: flex;
  gap: @spacing-sm;
  align-items: center;
}

.json-kv-key {
  flex: 1;
  width: 40% !important;
}

.json-kv-value {
  flex: 1;
  width: 40% !important;
}

.form-input {
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
}

.btn-kv-remove {
  width: 24px;
  height: 24px;
  background: rgba(255, 68, 68, 0.2);
  border: none;
  border-radius: @radius-sm;
  color: @danger-color;
  cursor: pointer;
  font-size: @font-md;
  line-height: 1;
  &:hover { background: rgba(255, 68, 68, 0.4); }
}

.btn-kv-add {
  font-size: @font-sm;
  padding: @spacing-xs @spacing-xl;
  background: @white-05;
  border: 1px dashed @border-color;
  border-radius: @radius-sm;
  color: @text-secondary;
  cursor: pointer;
  &:hover { background: @white-10; }
}

.json-error {
  color: @danger-color;
  font-size: @font-sm;
  margin: 4px 0 0;
}
</style>
