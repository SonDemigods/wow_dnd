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
        <button v-if="!hideCreate" class="btn btn-primary" @click="$emit('create')">
          + 新增
        </button>
        <button class="btn btn-secondary" @click="$emit('refresh')">
          刷新
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
              {{ col.label }}
            </th>
            <th class="actions-col"><div class="actions-col-inner">操作</div></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.length === 0">
            <td :colspan="columns.length + 1" class="empty-cell">暂无数据</td>
          </tr>
          <tr v-for="(row, index) in data" :key="getRowKey(row, index)">
            <td v-for="col in columns" :key="col.key">
              <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">
                {{ formatCellValue(row[col.key], col, row) }}
              </slot>
            </td>
            <td class="actions-col">
              <div class="actions-col-inner">
                <slot name="actions" :row="row">
                  <button v-if="!hideEdit" class="btn btn-small btn-edit" @click="$emit('edit', row)">编辑</button>
                  <button class="btn btn-small btn-delete" @click="$emit('delete', row)">删除</button>
                </slot>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页信息 -->
    <div class="table-footer">
      <span>共 {{ totalCount }} 条记录</span>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * 通用数据表格组件
 *
 * 提供搜索、数据展示、操作按钮的通用表格，通过插槽支持自定义单元格渲染
 */
import { ref } from 'vue';

/** 单元格值类型 */
export type CellValue = string | number | boolean | null | unknown[];

/** 列定义 */
export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  format?: (value: CellValue, row: T) => string;
}

// P12-029 修复：搜索防抖定时器，避免每次按键触发 DB 查询竞态
let searchTimer: ReturnType<typeof setTimeout> | null = null;

defineProps<{
  /** 列定义 */
  columns: TableColumn<T>[];
  /** 表格数据 */
  data: T[];
  /** 总记录数 */
  totalCount?: number;
  /** 隐藏新增按钮 */
  hideCreate?: boolean;
  /** 隐藏编辑按钮 */
  hideEdit?: boolean;
}>();

const emit = defineEmits<{
  create: [];
  edit: [row: T];
  delete: [row: T];
  refresh: [];
  search: [keyword: string];
}>();

const searchValue = ref('');

/** P12-029 修复：搜索防抖，避免每次按键触发 DB 查询竞态 */
function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    emit('search', searchValue.value);
  }, 300);
}

/** 获取行的唯一 key */
function getRowKey(row: T, index: number): string {
  // P10-033 修复：增加 __pk 字段回退，避免无 id/characterId 的表退化为序号
  return (row.id ?? row.characterId ?? row.__pk ?? `row-${index}`) as string;
}

/** 格式化单元格值 */
// P10-032 修复：传入完整 row 对象，使 col.format 回调能访问行数据
function formatCellValue(value: unknown, col: TableColumn<T>, row: T): string {
  if (col.format) return col.format(value as CellValue, row);
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
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

  &-delete {
    background: rgba(255, 68, 68, 0.15);
    color: @danger-color;
    border-color: @danger-color;
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
  }

  tr:hover td {
    background: @white-03;
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
}

.table-footer {
  padding: @spacing-lg 0;
  text-align: right;
  color: @text-secondary;
  font-size: @font-base;
}
</style>
