<template>
  <div class="admin-table-container">
    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <input
          v-model="searchValue"
          type="text"
          class="search-input"
          placeholder="搜索..."
          @input="onSearchInput"
        />
      </div>
      <div class="toolbar-right">
        <!-- 批量操作区域（插槽，由 ConfigManager 注入批量删除按钮） -->
        <slot name="batch-actions" :selected-ids="selectedIds" :clear-selection="clearSelection" />
        <button v-if="!hideCreate" class="btn btn-primary" @click="$emit('create')">
          + 新增
        </button>
        <button class="btn btn-secondary" @click="$emit('refresh')">
          刷新
        </button>
        <!-- 列设置按钮（插槽，由 ConfigManager 注入） -->
        <slot name="column-settings" />
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <!-- 批量选择 checkbox -->
            <th v-if="selectable" class="checkbox-col">
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate.prop="isIndeterminate"
                @change="toggleSelectAll"
              />
            </th>
            <th
              v-for="col in visibleColumns"
              :key="col.key"
              :style="{ width: col.width }"
              :class="{ sortable: !hideSort }"
              @click="!hideSort && $emit('sort', col.key)"
            >
              {{ col.label }}
              <span v-if="!hideSort && sortBy === col.key" class="sort-indicator">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </span>
            </th>
            <th class="actions-col"><div class="actions-col-inner">操作</div></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.length === 0">
            <td :colspan="visibleColumns.length + (selectable ? 2 : 1)" class="empty-cell">暂无数据</td>
          </tr>
          <template v-for="(row, index) in data" :key="getRowKey(row, index)">
            <tr :class="{ 'row-selected': isRowSelected(row) }">
              <!-- 批量选择 checkbox -->
              <td v-if="selectable" class="checkbox-col">
                <input
                  type="checkbox"
                  :checked="isRowSelected(row)"
                  @change="toggleSelectRow(row)"
                />
              </td>
              <td v-for="col in visibleColumns" :key="col.key">
                <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">
                  {{ formatCellValue(row[col.key], col, row) }}
                </slot>
              </td>
              <td class="actions-col">
                <div class="actions-col-inner">
                  <slot name="actions" :row="row">
                    <button v-if="!hideEdit" class="btn btn-small btn-edit" @click="$emit('edit', row)">编辑</button>
                    <button class="btn btn-small btn-clone" @click="$emit('clone', row)">克隆</button>
                    <button class="btn btn-small btn-delete" @click="$emit('delete', row)">删除</button>
                  </slot>
                </div>
              </td>
            </tr>
            <!-- 行详情展开 -->
            <tr v-if="expandedRows.has(getRowKey(row, index))" class="row-detail">
              <td :colspan="visibleColumns.length + (selectable ? 2 : 1)">
                <slot name="row-detail" :row="row">
                  <div class="detail-grid">
                    <div v-for="col in columns" :key="col.key" class="detail-item">
                      <span class="detail-label">{{ col.label }}:</span>
                      <span class="detail-value">{{ formatDetailValue(row[col.key]) }}</span>
                    </div>
                  </div>
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 分页栏 -->
    <div class="table-footer">
      <div class="footer-left">
        <span>共 {{ totalCount }} 条记录</span>
        <span v-if="selectable && selectedIds.size > 0" class="selected-info">
          | 已选 {{ selectedIds.size }} 项
        </span>
      </div>
      <div v-if="(totalCount ?? 0) > 0" class="footer-right">
        <select class="page-size-select" :value="pageSize" @change="onPageSizeChange">
          <option :value="10">10 条/页</option>
          <option :value="20">20 条/页</option>
          <option :value="50">50 条/页</option>
        </select>
        <button class="btn btn-page" :disabled="(currentPage ?? 1) <= 1" @click="$emit('page-change', (currentPage ?? 1) - 1)">上一页</button>
        <span class="page-info">{{ currentPage ?? 1 }} / {{ totalPages }}</span>
        <button class="btn btn-page" :disabled="(currentPage ?? 1) >= totalPages" @click="$emit('page-change', (currentPage ?? 1) + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * 通用数据表格组件
 *
 * 提供搜索、排序、分页、批量选择、行详情展开的通用表格，
 * 通过插槽支持自定义单元格渲染。
 */
import { ref, computed } from 'vue';

/** 单元格值类型 */
export type CellValue = string | number | boolean | null | unknown[];

/** 列定义 */
export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  format?: (value: CellValue, row: T) => string;
  /** 是否默认隐藏（列显隐功能） */
  hidden?: boolean;
}

const props = defineProps<{
  /** 列定义 */
  columns: TableColumn<T>[];
  /** 表格数据（当前页） */
  data: T[];
  /** 总记录数（分页） */
  totalCount?: number;
  /** 隐藏新增按钮 */
  hideCreate?: boolean;
  /** 隐藏编辑按钮 */
  hideEdit?: boolean;
  /** 隐藏排序功能 */
  hideSort?: boolean;
  /** 是否可批量选择 */
  selectable?: boolean;
  /** 当前页码（1-based） */
  currentPage?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 可见列的 key 列表（为空时显示全部列） */
  visibleColumnKeys?: string[];
}>();

const emit = defineEmits<{
  create: [];
  edit: [row: T];
  delete: [row: T];
  clone: [row: T];
  refresh: [];
  search: [keyword: string];
  sort: [columnKey: string];
  'page-change': [page: number];
  'page-size-change': [size: number];
  'selection-change': [ids: string[]];
}>();

const searchValue = ref('');

// P12-029 修复：搜索防抖定时器
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// ==================== 列显隐 ====================

/** 实际显示的列（根据 visibleColumnKeys 过滤） */
const visibleColumns = computed(() => {
  if (!props.visibleColumnKeys || props.visibleColumnKeys.length === 0) {
    return props.columns;
  }
  return props.columns.filter(col => props.visibleColumnKeys!.includes(col.key));
});

// ==================== 批量选择 ====================

const selectedIds = ref<Set<string>>(new Set());

/** 获取行的唯一 key */
function getRowKey(row: T, index: number): string {
  return (row.id ?? row.characterId ?? row.__pk ?? `row-${index}`) as string;
}

/** 全选状态 */
const isAllSelected = computed(() => {
  if (props.data.length === 0) return false;
  return props.data.every(row => selectedIds.value.has(getRowKey(row, 0)));
});

/** 半选状态（部分选中） */
const isIndeterminate = computed(() => {
  if (props.data.length === 0) return false;
  const selectedCount = props.data.filter(row => selectedIds.value.has(getRowKey(row, 0))).length;
  return selectedCount > 0 && selectedCount < props.data.length;
});

/** 判断行是否选中 */
function isRowSelected(row: T): boolean {
  return selectedIds.value.has(getRowKey(row, 0));
}

/** 切换全选 */
function toggleSelectAll(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target.checked) {
    props.data.forEach(row => selectedIds.value.add(getRowKey(row, 0)));
  } else {
    props.data.forEach(row => selectedIds.value.delete(getRowKey(row, 0)));
  }
  emitSelectionChange();
}

/** 切换单行选择 */
function toggleSelectRow(row: T): void {
  const key = getRowKey(row, 0);
  if (selectedIds.value.has(key)) {
    selectedIds.value.delete(key);
  } else {
    selectedIds.value.add(key);
  }
  emitSelectionChange();
}

/** 清空选择 */
function clearSelection(): void {
  selectedIds.value.clear();
  emitSelectionChange();
}

function emitSelectionChange(): void {
  emit('selection-change', [...selectedIds.value]);
}

// ==================== 行详情展开 ====================

const expandedRows = ref<Set<string>>(new Set());

// ==================== 分页 ====================

const totalPages = computed(() => {
  const total = props.totalCount ?? props.data.length;
  const size = props.pageSize ?? 20;
  return Math.max(1, Math.ceil(total / size));
});

// ==================== 事件处理 ====================

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    emit('search', searchValue.value);
  }, 300);
}

function onPageSizeChange(e: Event): void {
  const target = e.target as HTMLSelectElement;
  emit('page-size-change', Number(target.value));
}

// ==================== 格式化 ====================

function formatCellValue(value: unknown, col: TableColumn<T>, row: T): string {
  if (col.format) return col.format(value as CellValue, row);
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 行详情的值格式化（JSON 美化） */
function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

// 暴露方法供父组件调用
defineExpose({
  clearSelection,
  toggleRowDetail: (row: T) => {
    const key = getRowKey(row, 0);
    if (expandedRows.value.has(key)) {
      expandedRows.value.delete(key);
    } else {
      expandedRows.value.add(key);
    }
  },
});
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.admin-table-container {
  .flex-col();
  height: calc(100vh - 100px);
}

.table-toolbar {
  .flex-between();
  padding: @spacing-xl 0;
  gap: @spacing-xl;

  .toolbar-left {
    flex: 1;
    max-width: 300px;
  }

  .toolbar-right {
    display: flex;
    gap: @spacing-md;
    align-items: center;
  }
}

.search-input {
  width: 100%;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-md;
  outline: none;

  &:focus {
    border-color: @accent-color;
  }
}

.btn {
  .admin-btn-base();
  transition: all @transition-quick;

  &-primary {
    background: @accent-color;
    color: @primary-bg;
    border-color: @accent-color;
  }

  &-secondary {
    background: transparent;
    color: @text-primary;
  }

  &-small {
    padding: @spacing-xs @spacing-lg;
    font-size: @font-sm;
  }

  &-edit {
    background: rgba(0, 153, 255, 0.15);
    color: @skill-blue;
    border-color: @skill-blue;
  }

  &-clone {
    background: rgba(255, 215, 0, 0.12);
    color: @accent-color;
    border-color: @gold-border;
  }

  &-delete {
    background: rgba(255, 68, 68, 0.15);
    color: @danger-color;
    border-color: @danger-color;
  }

  &-page {
    padding: @spacing-xs @spacing-lg;
    font-size: @font-sm;
    background: @white-05;
    color: @text-primary;

    &:disabled {
      opacity: @opacity-dimmed;
      cursor: not-allowed;
    }
  }
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  border: 1px solid @border-color;
  border-radius: @radius-lg;
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: @spacing-lg @spacing-xl;
    text-align: left;
    border-bottom: 1px solid @border-color;
    color: @text-primary;
    font-size: @font-base;
    white-space: nowrap;
  }

  th {
    background: @secondary-bg;
    font-weight: @font-weight-semibold;
    color: @text-secondary;
    position: sticky;
    top: 0;
    z-index: 2;

    &.sortable {
      cursor: pointer;
      user-select: none;

      &:hover {
        color: @accent-color;
      }
    }
  }

  .sort-indicator {
    color: @accent-color;
    font-size: @font-sm;
    margin-left: 2px;
  }

  tr:hover td {
    background: @white-03;
  }

  tr.row-selected td {
    background: rgba(255, 215, 0, 0.05);
  }

  .checkbox-col {
    width: 40px;
    text-align: center;

    input[type='checkbox'] {
      width: 14px;
      height: 14px;
      accent-color: @accent-color;
      cursor: pointer;
    }
  }

  .actions-col {
    text-align: center;
    position: sticky;
    right: 0;
    background: inherit;
    z-index: 1;

    .actions-col-inner {
      display: flex;
      gap: @spacing-xs;
      justify-content: center;
    }
  }

  th.actions-col {
    z-index: 3;
    background: @secondary-bg;
  }

  td.actions-col {
    background: @primary-bg;
  }

  tr:hover td.actions-col {
    background: @white-03;
  }

  .empty-cell {
    text-align: center;
    color: @text-secondary;
    padding: 40px;
  }

  .row-detail td {
    background: @secondary-bg;
    padding: @spacing-3xl @spacing-4xl;
  }
}

// ==================== 行详情 ====================
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: @spacing-lg @spacing-4xl;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  color: @text-secondary;
  font-size: @font-sm;
}

.detail-value {
  color: @text-primary;
  font-size: @font-base;
  word-break: break-all;
  white-space: pre-wrap;
}

// ==================== 分页栏 ====================
.table-footer {
  .flex-between();
  padding: @spacing-lg 0;
  color: @text-secondary;
  font-size: @font-base;

  .footer-left {
    display: flex;
    gap: @spacing-md;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: @spacing-lg;
  }

  .selected-info {
    color: @accent-color;
    font-weight: @font-weight-semibold;
  }
}

.page-size-select {
  padding: @spacing-xs @spacing-md;
  background: @white-05;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-sm;
  outline: none;
  cursor: pointer;

  option {
    background: @secondary-bg;
    color: @text-primary;
  }
}

.page-info {
  font-size: @font-sm;
  color: @text-primary;
  min-width: 60px;
  text-align: center;
}
</style>
