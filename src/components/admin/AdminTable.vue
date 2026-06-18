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
          @input="$emit('search', searchValue)"
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
                {{ formatCellValue(row[col.key], col) }}
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

<script setup lang="ts">
/**
 * 通用数据表格组件
 *
 * 提供搜索、数据展示、操作按钮的通用表格，通过插槽支持自定义单元格渲染
 */
import { ref } from 'vue';

/** 列定义 */
export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  format?: (value: any, row: any) => string;
}

defineProps<{
  /** 列定义 */
  columns: TableColumn[];
  /** 表格数据 */
  data: any[];
  /** 总记录数 */
  totalCount?: number;
  /** 隐藏新增按钮 */
  hideCreate?: boolean;
  /** 隐藏编辑按钮 */
  hideEdit?: boolean;
}>();

defineEmits<{
  create: [];
  edit: [row: any];
  delete: [row: any];
  refresh: [];
  search: [keyword: string];
}>();

const searchValue = ref('');

/** 获取行的唯一 key */
function getRowKey(row: any, index: number): string {
  return row.id ?? row.characterId ?? `row-${index}`;
}

/** 格式化单元格值 */
function formatCellValue(value: any, col: TableColumn): string {
  if (col.format) return col.format(value, {});
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
  padding: @spacing-md @spacing-3xl;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  cursor: pointer;
  font-size: @font-md;
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

  &:hover {
    opacity: 0.85;
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
