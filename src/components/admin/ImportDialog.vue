<template>
  <div v-if="visible" class="import-overlay" @click.self="$emit('cancel')">
    <div class="import-dialog">
      <div class="import-header">
        <h3>导入数据 — {{ tableName }}</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      <div class="import-body">
        <!-- 文件选择 -->
        <div v-if="!parsedData" class="file-select-area">
          <input
            ref="fileInput"
            type="file"
            accept=".json,.csv"
            class="file-input"
            @change="onFileChange"
          />
          <p class="file-hint">支持 JSON / CSV 格式，JSON 需为数组结构，CSV 第一行为表头</p>
          <p v-if="parseError" class="parse-error">{{ parseError }}</p>
        </div>

        <!-- 预览 -->
        <div v-else class="preview-area">
          <div class="preview-summary">
            将导入 <strong>{{ parsedData.length }}</strong> 条记录
          </div>
          <div class="preview-table-wrapper">
            <table class="preview-table">
              <thead>
                <tr>
                  <th v-for="key in previewKeys" :key="key">{{ key }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in parsedData.slice(0, 5)" :key="idx">
                  <td v-for="key in previewKeys" :key="key">{{ formatValue(row[key]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="parsedData.length > 5" class="more-rows">... 还有 {{ parsedData.length - 5 }} 条</p>
        </div>
      </div>
      <div class="import-footer">
        <button class="btn btn-secondary" @click="$emit('cancel')">取消</button>
        <button
          v-if="parsedData"
          class="btn btn-primary"
          @click="handleImport"
        >
          确认导入
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 数据导入预览弹窗
 *
 * 用户选择文件后解析并预览前 5 条记录，确认后触发 import 事件。
 */
import { ref, computed } from 'vue';
import { readFileAsText, parseJSON, parseCSV } from '@/utils/importData';

const props = defineProps<{
  visible: boolean;
  tableName: string;
}>();

// tableName 通过模板使用，无需在 script 中显式引用 props
void props;

const emit = defineEmits<{
  import: [data: Record<string, unknown>[]];
  cancel: [];
}>();

const parsedData = ref<Record<string, unknown>[] | null>(null);
const parseError = ref('');

/** 预览表头（取前 5 列） */
const previewKeys = computed(() => {
  if (!parsedData.value || parsedData.value.length === 0) return [];
  const keys = Object.keys(parsedData.value[0]);
  return keys.slice(0, 5);
});

async function onFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  parseError.value = '';
  parsedData.value = null;

  try {
    const text = await readFileAsText(file);
    const isJSON = file.name.endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{');
    const result = isJSON ? parseJSON(text) : parseCSV(text);

    if (result.error) {
      parseError.value = result.error;
      return;
    }
    if (result.data.length === 0) {
      parseError.value = '文件中没有数据';
      return;
    }
    parsedData.value = result.data;
  } catch (e) {
    parseError.value = `文件读取失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function handleImport(): void {
  if (parsedData.value) {
    emit('import', parsedData.value);
    parsedData.value = null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 50);
  return String(value).slice(0, 50);
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.import-overlay {
  .overlay-mask(@overlay-heavy; @z-combat-overlay);
}

.import-dialog {
  background: #0d1117;
  border: 2px solid @border-color;
  border-radius: @radius-xl;
  width: 600px;
  max-height: 80vh;
  .flex-col();
}

.import-header {
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

    &:hover { background: @white-20; }
  }
}

.import-body {
  padding: @spacing-4xl;
  overflow-y: auto;
  flex: 1;
}

.file-select-area {
  .flex-col();
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-5xl;
}

.file-input {
  color: @text-primary;
}

.file-hint {
  font-size: @font-sm;
  color: @text-secondary;
  text-align: center;
  margin: 0;
}

.parse-error {
  color: @danger-color;
  font-size: @font-sm;
  margin: 0;
}

.preview-summary {
  color: @text-primary;
  font-size: @font-md;
  margin-bottom: @spacing-lg;
}

.preview-table-wrapper {
  overflow-x: auto;
  border: 1px solid @border-color;
  border-radius: @radius-md;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: @spacing-md @spacing-xl;
    text-align: left;
    border-bottom: 1px solid @border-color;
    color: @text-primary;
    font-size: @font-sm;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th {
    background: @secondary-bg;
    color: @text-secondary;
  }
}

.more-rows {
  color: @text-secondary;
  font-size: @font-sm;
  text-align: center;
  margin-top: @spacing-lg;
}

.import-footer {
  display: flex;
  justify-content: flex-end;
  gap: @spacing-lg;
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
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
