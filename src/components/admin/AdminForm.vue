<template>
  <div v-if="visible" class="form-overlay" @click.self="$emit('cancel')">
    <div class="form-dialog">
      <div class="form-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      <div class="form-body">
        <div v-for="field in fields" :key="field.key" class="form-group">
          <!-- JSON 字段自身带标签，其他字段用外部 label -->
          <label v-if="field.type !== 'json'" :for="'field-' + field.key">{{ field.label }}</label>

          <!-- 普通文本输入 -->
          <input
            v-if="field.type === 'text' || field.type === 'number'"
            :id="'field-' + field.key"
            v-model="formData[field.key]"
            :type="field.type"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            class="form-input"
          />

          <!-- 多行文本 -->
          <textarea
            v-else-if="field.type === 'textarea'"
            :id="'field-' + field.key"
            v-model="formData[field.key]"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            class="form-textarea"
            rows="3"
          />

          <!-- 下拉选择 -->
          <select
            v-else-if="field.type === 'select'"
            :id="'field-' + field.key"
            v-model="formData[field.key]"
            :disabled="field.disabled"
            class="form-select"
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

          <!-- 开关 -->
          <div v-else-if="field.type === 'switch'" class="switch-container">
            <label class="switch">
              <input
                type="checkbox"
                :checked="!!formData[field.key]"
                :disabled="field.disabled"
                @change="formData[field.key] = ($event.target as HTMLInputElement).checked"
              />
              <span class="switch-slider" />
            </label>
            <span class="switch-label-text">{{ formData[field.key] ? '是' : '否' }}</span>
          </div>

          <!-- 多选 -->
          <div v-else-if="field.type === 'multiselect'" class="multiselect-group">
            <label
              v-for="opt in field.options"
              :key="opt.value"
              class="multiselect-item"
              :class="{ checked: isSelected(field.key, opt.value) }"
            >
              <input
                type="checkbox"
                :value="opt.value"
                :checked="isSelected(field.key, opt.value)"
                :disabled="field.disabled"
                @change="toggleMultiSelect(field.key, opt.value)"
              />
              {{ opt.label }}
            </label>
          </div>

          <!-- 颜色选择 -->
          <input
            v-else-if="field.type === 'color'"
            :id="'field-' + field.key"
            v-model="formData[field.key]"
            type="color"
            :disabled="field.disabled"
            class="form-color"
          />

          <!-- JSON 键值对编辑器 -->
          <div v-else-if="field.type === 'json'" class="json-editor">
            <div class="json-toolbar">
              <span class="json-label">{{ field.label }}</span>
              <button type="button" class="btn-json-mode" @click="toggleJsonMode(field.key)">
                {{ jsonModes[field.key] ? '键值对' : '文本' }}
              </button>
            </div>

            <!-- 文本模式 -->
            <textarea
              v-if="!jsonModes[field.key]"
              :id="'field-' + field.key"
              v-model="formData[field.key]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              class="form-textarea form-json"
              rows="5"
            />

            <!-- 键值对模式 -->
            <div v-else class="json-kv-editor">
              <div v-for="(item, idx) in getJsonEntries(field.key)" :key="idx" class="json-kv-row">
                <input
                  v-model="item.key"
                  type="text"
                  class="form-input json-kv-key"
                  placeholder="键"
                  @input="syncJsonKv(field.key)"
                />
                <input
                  v-model="item.value"
                  type="text"
                  class="form-input json-kv-value"
                  placeholder="值"
                  @input="syncJsonKv(field.key)"
                />
                <button type="button" class="btn-kv-remove" @click="removeJsonEntry(field.key, idx)">×</button>
              </div>
              <button type="button" class="btn-kv-add" @click="addJsonEntry(field.key)">+ 添加属性</button>
              <p v-if="jsonParseError[field.key]" class="json-error">JSON 解析失败，请检查格式</p>
            </div>
          </div>
        </div>

        <!-- 自定义内容插槽 -->
        <slot name="custom-fields" :formData="formData" />
      </div>
      <div class="form-footer">
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
 * 根据字段配置动态渲染表单，支持 text/number/textarea/select/color/json 等类型
 */
import { reactive, watch } from 'vue';

/** 表单字段定义 */
export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'multiselect' | 'switch' | 'color' | 'json';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** 是否禁用（只读展示） */
  disabled?: boolean;
}

const props = defineProps<{
  /** 是否显示 */
  visible: boolean;
  /** 表单标题 */
  title: string;
  /** 字段定义 */
  fields: FormField[];
  /** 初始数据（编辑模式时传入） */
  initialData?: Record<string, any> | null;
}>();

const emit = defineEmits<{
  submit: [data: Record<string, any>];
  cancel: [];
}>();

/** 表单数据 */
const formData = reactive<Record<string, any>>({});

/** JSON 编辑器模式（true=键值对, false=文本） */
const jsonModes = reactive<Record<string, boolean>>({});
/** JSON 解析错误标记 */
const jsonParseError = reactive<Record<string, boolean>>({});
/** JSON 键值对缓存 */
const jsonEntriesCache = reactive<Record<string, Array<{ key: string; value: string }>>>({});

/** 切换 JSON 编辑模式 */
function toggleJsonMode(fieldKey: string) {
  const current = jsonModes[fieldKey];
  if (current) {
    jsonModes[fieldKey] = false;
    const entries = jsonEntriesCache[fieldKey];
    if (entries) {
      const obj: Record<string, string> = {};
      entries.forEach(e => { if (e.key) obj[e.key] = e.value; });
      formData[fieldKey] = JSON.stringify(obj, null, 2);
    }
  } else {
    try {
      if (formData[fieldKey] && typeof formData[fieldKey] === 'string' && formData[fieldKey].trim()) {
        const obj = JSON.parse(formData[fieldKey]);
        if (typeof obj === 'object' && !Array.isArray(obj)) {
          jsonEntriesCache[fieldKey] = Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }));
          jsonParseError[fieldKey] = false;
          jsonModes[fieldKey] = true;
          return;
        }
      }
      jsonParseError[fieldKey] = true;
    } catch {
      jsonParseError[fieldKey] = true;
    }
  }
}

/** 获取 JSON 键值对条目 */
function getJsonEntries(fieldKey: string): Array<{ key: string; value: string }> {
  if (!jsonEntriesCache[fieldKey]) {
    jsonEntriesCache[fieldKey] = [{ key: '', value: '' }];
  }
  return jsonEntriesCache[fieldKey];
}

/** 同步键值对到 formData */
function syncJsonKv(fieldKey: string) {
  const entries = jsonEntriesCache[fieldKey];
  if (!entries) return;
  const obj: Record<string, string> = {};
  entries.forEach(e => { if (e.key) obj[e.key] = e.value; });
  formData[fieldKey] = JSON.stringify(obj, null, 2);
  jsonParseError[fieldKey] = false;
}

/** 添加键值对条目 */
function addJsonEntry(fieldKey: string) {
  if (!jsonEntriesCache[fieldKey]) jsonEntriesCache[fieldKey] = [];
  jsonEntriesCache[fieldKey].push({ key: '', value: '' });
}

/** 删除键值对条目 */
function removeJsonEntry(fieldKey: string, index: number) {
  jsonEntriesCache[fieldKey]?.splice(index, 1);
  syncJsonKv(fieldKey);
}

/** 多选：判断是否选中 */
function isSelected(fieldKey: string, value: string): boolean {
  const arr = formData[fieldKey];
  return Array.isArray(arr) && arr.includes(value);
}

/** 多选：切换选中状态 */
function toggleMultiSelect(fieldKey: string, value: string) {
  if (!Array.isArray(formData[fieldKey])) {
    formData[fieldKey] = [];
  }
  const idx = formData[fieldKey].indexOf(value);
  if (idx >= 0) {
    formData[fieldKey].splice(idx, 1);
  } else {
    formData[fieldKey].push(value);
  }
}

// 监听 initialData 变化，初始化表单数据
watch(
  () => props.initialData,
  (data) => {
    // 先清空
    Object.keys(formData).forEach(key => delete formData[key]);
    // 重置 JSON 编辑器状态，防止切换记录时残留旧数据
    Object.keys(jsonModes).forEach(key => delete jsonModes[key]);
    Object.keys(jsonEntriesCache).forEach(key => delete jsonEntriesCache[key]);
    Object.keys(jsonParseError).forEach(key => delete jsonParseError[key]);
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
  },
  { immediate: true }
);

/** 提交表单 */
function handleSubmit() {
  // 将 number 类型字段的值转为数字
  const data: Record<string, any> = {};
  props.fields.forEach(field => {
    let value = formData[field.key];
    if (field.type === 'number' && typeof value === 'string') {
      value = Number(value);
    }
    if (field.type === 'json' && typeof value === 'string' && value.trim()) {
      try {
        value = JSON.parse(value);
      } catch {
        // 解析失败则保持字符串
      }
    }
    data[field.key] = value;
  });
  emit('submit', data);
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: @overlay-heavy;
  .flex-center();
  z-index: 2000;
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

.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    color: @text-secondary;
    font-size: @font-base;
    margin-bottom: 5px;
  }
}

.form-input,
.form-textarea,
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
}

.form-select {
  option {
    background: #0d1117;
    color: @text-primary;
  }
}

.form-color {
  width: 50px;
  height: 36px;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  cursor: pointer;
  background: transparent;
}

// ==================== 开关 ====================
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

.form-json {
  font-family: 'Courier New', monospace;
  font-size: @font-sm;
}

// ==================== 多选 ====================
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

.json-editor {
  .json-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    .json-label { color: @text-secondary; font-size: @font-base; }
  }
  .btn-json-mode {
    font-size: @font-xs;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid @border-color;
    border-radius: @radius-sm;
    color: @text-secondary;
    cursor: pointer;
    &:hover { background: @white-15; }
  }
}

.json-kv-editor {
  .flex-col();
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

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: @spacing-lg;
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
}

.btn {
  padding: @spacing-md @spacing-4xl;
  border-radius: @radius-md;
  cursor: pointer;
  font-size: @font-md;
  border: 1px solid @border-color;

  &-primary {
    background: @accent-color;
    color: @primary-bg;
    border-color: @accent-color;
  }

  &-secondary {
    background: transparent;
    color: @text-primary;
  }

  &:hover {
    opacity: 0.85;
  }
}
</style>
