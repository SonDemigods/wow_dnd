<template>
  <div class="config-manager">
    <h2 class="page-title">
      {{ store.currentTableMeta?.label || '配置管理' }}
    </h2>

    <AdminTable
      :columns="currentColumns"
      :data="store.tableData"
      :total-count="store.totalCount"
      :current-page="store.currentPage"
      :page-size="store.pageSize"
      :sort-by="store.sortBy"
      :sort-order="store.sortOrder"
      :selectable="true"
      :visible-column-keys="visibleColumnKeys"
      @create="handleCreate"
      @edit="handleEdit"
      @delete="handleDelete"
      @clone="handleClone"
      @refresh="store.loadTableData"
      @search="store.doSearch($event)"
      @sort="store.toggleSort($event)"
      @page-change="store.changePage($event)"
      @page-size-change="store.changePageSize($event)"
      @selection-change="onSelectionChange"
    >
      <!-- 批量操作 -->
      <template #batch-actions="{ selectedIds, clearSelection }">
        <button
          v-if="selectedIds.length > 0"
          class="btn btn-batch-delete"
          @click="handleBatchDelete(selectedIds, clearSelection)"
        >
          批量删除 ({{ selectedIds.length }})
        </button>
      </template>

      <!-- 列设置 + 导出 + 导入 -->
      <template #column-settings>
        <button class="btn btn-secondary btn-column-settings" @click="showColumnSettings = !showColumnSettings">
          列设置
        </button>
        <button class="btn btn-secondary btn-export" @click="handleExport('json')">导出JSON</button>
        <button class="btn btn-secondary btn-export" @click="handleExport('csv')">导出CSV</button>
        <button class="btn btn-secondary btn-import" @click="showImportDialog = true">导入</button>
        <button class="btn btn-secondary btn-reset" @click="showResetConfirm = true">重置默认</button>
        <div v-if="showColumnSettings" class="column-settings-panel">
          <label
            v-for="col in currentColumns"
            :key="col.key"
            class="column-settings-item"
          >
            <input
              type="checkbox"
              :checked="visibleColumnKeys.includes(col.key)"
              @change="toggleColumnVisibility(col.key)"
            />
            {{ col.label }}
          </label>
        </div>
      </template>

      <!-- 行详情 -->
      <template #row-detail="{ row }">
        <div class="detail-grid">
          <div v-for="col in currentColumns" :key="col.key" class="detail-item">
            <span class="detail-label">{{ col.label }}:</span>
            <span class="detail-value">{{ formatDetailValue(row[col.key]) }}</span>
          </div>
        </div>
      </template>
    </AdminTable>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="confirm-overlay" @click.self="showDeleteConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>确认删除</h3>
        </div>
        <div class="confirm-body">
          <p>确定要删除此记录吗？此操作不可撤销。</p>
          <p v-if="referenceWarning" class="reference-warning">{{ referenceWarning }}</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-secondary" @click="showDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 批量删除确认弹窗 -->
    <div v-if="showBatchDeleteConfirm" class="confirm-overlay" @click.self="showBatchDeleteConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>确认批量删除</h3>
        </div>
        <div class="confirm-body">
          <p>确定要删除选中的 {{ batchDeleteIds.length }} 条记录吗？此操作不可撤销。</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-secondary" @click="showBatchDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmBatchDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 重置默认确认弹窗 -->
    <div v-if="showResetConfirm" class="confirm-overlay" @click.self="showResetConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>确认重置默认值</h3>
        </div>
        <div class="confirm-body">
          <p>确定要将 {{ store.currentTableMeta?.label }} 重置为默认值吗？当前表所有数据将被清空并恢复为初始配置，此操作不可撤销。</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-secondary" @click="showResetConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmReset">确认重置</button>
        </div>
      </div>
    </div>

    <!-- 编辑/创建/克隆表单弹窗 -->
    <AdminForm
      :visible="store.formConfig.visible"
      :title="store.formConfig.title"
      :fields="currentFormFields"
      :initial-data="store.editingRecord"
      @submit="handleFormSubmit"
      @cancel="store.closeForm"
    />

    <!-- 导入弹窗 -->
    <ImportDialog
      :visible="showImportDialog"
      :table-name="store.currentTableMeta?.label || ''"
      @import="handleImport"
      @cancel="showImportDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 配置表管理组件
 *
 * 根据当前选中的配置表动态切换表格列定义和表单字段，
 * 实现所有 15 张配置表的统一管理。
 * 支持分页、排序、列显隐、批量删除、行克隆。
 */
import { onMounted, ref, watch } from 'vue';
import { useAdminStore } from '@/modules/admin';
import type { AdminRecord } from '@/modules/admin';
import AdminTable from './AdminTable.vue';
import AdminForm from './AdminForm.vue';
import ImportDialog from './ImportDialog.vue';
import { useConfigTableMeta } from './composables/useConfigTableMeta';
import { useConfigCrud } from './composables/useConfigCrud';
import { useToast } from '@/composables/useToast';
import { exportJSON, exportCSV } from '@/utils/exportData';

const store = useAdminStore();

const { currentColumns, currentFormFields, currentDbTable } = useConfigTableMeta();
const {
  showDeleteConfirm,
  referenceWarning,
  handleCreate,
  handleEdit,
  handleDelete,
  confirmDelete,
  handleFormSubmit,
} = useConfigCrud({ currentDbTable });

// ==================== 列显隐 ====================

const showColumnSettings = ref(false);
const visibleColumnKeys = ref<string[]>([]);

/** 从 localStorage 恢复列显隐配置 */
function loadColumnConfig(tableName: string): string[] {
  try {
    const saved = localStorage.getItem(`admin_columns_${tableName}`);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  // 默认显示前 5 列
  return currentColumns.value.slice(0, 5).map(c => c.key);
}

/** 保存列显隐配置到 localStorage */
function saveColumnConfig(tableName: string, keys: string[]): void {
  try {
    localStorage.setItem(`admin_columns_${tableName}`, JSON.stringify(keys));
  } catch { /* ignore */ }
}

/** 切换列可见性 */
function toggleColumnVisibility(key: string): void {
  const idx = visibleColumnKeys.value.indexOf(key);
  if (idx >= 0) {
    visibleColumnKeys.value.splice(idx, 1);
  } else {
    visibleColumnKeys.value.push(key);
  }
  saveColumnConfig(store.selectedConfigTable, visibleColumnKeys.value);
}

// 切换表时重载列配置
watch(() => store.selectedConfigTable, (tableName) => {
  visibleColumnKeys.value = loadColumnConfig(tableName);
  showColumnSettings.value = false;
}, { immediate: true });

// ==================== 行克隆 ====================

function handleClone(row: AdminRecord): void {
  const cloned = { ...row };
  // 清空 ID 字段，提示用户输入新 ID
  delete (cloned as Record<string, unknown>).id;
  store.openEditForm(cloned, `克隆${store.currentTableMeta?.label || '记录'}`);
  // 修正为 create 模式
  store.formConfig.mode = 'create';
}

// ==================== 批量删除 ====================

const showBatchDeleteConfirm = ref(false);
const batchDeleteIds = ref<string[]>([]);

function onSelectionChange(_ids: string[]): void {
  // 由 AdminTable 内部管理选中状态，这里仅记录用于批量删除
}

function handleBatchDelete(ids: string[], clearSelection: () => void): void {
  batchDeleteIds.value = ids;
  batchClearSelection = clearSelection;
  showBatchDeleteConfirm.value = true;
}

let batchClearSelection: () => void = () => {};

async function confirmBatchDelete(): Promise<void> {
  showBatchDeleteConfirm.value = false;
  const ids = [...batchDeleteIds.value];
  batchDeleteIds.value = [];

  const results = await Promise.allSettled(
    ids.map(id => store.deleteRecord(currentDbTable.value, id)),
  );
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failCount = results.length - successCount;

  if (failCount > 0) {
    useToast().show({
      message: `批量删除完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      type: 'danger',
      duration: 4000,
    });
  } else {
    useToast().show({
      message: `成功删除 ${successCount} 条记录`,
      type: 'success',
      duration: 2000,
    });
  }
  batchClearSelection();
}

// ==================== 行详情格式化 ====================

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

// ==================== 导出/导入 ====================

const showImportDialog = ref(false);
const showResetConfirm = ref(false);

/** 确认重置 */
async function confirmReset(): Promise<void> {
  showResetConfirm.value = false;
  try {
    const success = await store.resetTable();
    if (success) {
      useToast().show({ message: '已重置为默认值', type: 'success', duration: 2000 });
    } else {
      useToast().show({ message: '重置失败，请查看控制台', type: 'danger', duration: 3000 });
    }
  } catch (e) {
    console.error('[ConfigManager] 重置失败:', e);
    useToast().show({ message: '重置失败，请查看控制台', type: 'danger', duration: 3000 });
  }
}

/** 导出当前表数据 */
async function handleExport(format: 'json' | 'csv'): Promise<void> {
  try {
    // 获取全量数据（不分页，通过 adminService.getAll）
    const { adminService } = await import('@/modules/admin');
    const data = await adminService.getAll<Record<string, unknown>>(currentDbTable.value);
    const tableName = store.selectedConfigTable;

    if (format === 'json') {
      exportJSON(data, tableName);
    } else {
      exportCSV(data, currentColumns.value, tableName);
    }
    useToast().show({ message: `已导出 ${data.length} 条记录`, type: 'success', duration: 2000 });
  } catch (e) {
    console.error('[ConfigManager] 导出失败:', e);
    useToast().show({ message: '导出失败，请查看控制台', type: 'danger', duration: 3000 });
  }
}

/** 处理导入 */
async function handleImport(records: Record<string, unknown>[]): Promise<void> {
  showImportDialog.value = false;
  try {
    const result = await store.importRecords(currentDbTable.value, records);
    if (result.fail > 0) {
      useToast().show({
        message: `导入完成：成功 ${result.success} 条，失败 ${result.fail} 条`,
        type: 'danger',
        duration: 4000,
      });
    } else {
      useToast().show({
        message: `成功导入 ${result.success} 条记录`,
        type: 'success',
        duration: 2000,
      });
    }
  } catch (e) {
    console.error('[ConfigManager] 导入失败:', e);
    useToast().show({ message: '导入失败，请查看控制台', type: 'danger', duration: 3000 });
  }
}

// ==================== 初始化 ====================

onMounted(async () => {
  try {
    await store.loadReferenceData();
  } catch (err) {
    console.error('[ConfigManager] loadReferenceData 失败:', err);
  }
});
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.config-manager {
  height: 100%;
  .flex-col();
}

.page-title {
  color: @accent-color;
  font-size: 22px;
  margin: 0 0 20px;
}

.btn {
  .admin-btn-base(@spacing-4xl);

  &-secondary {
    background: transparent;
    color: @text-primary;
  }

  &-danger {
    background: @danger-color;
    color: @popup-text-color;
    border-color: @danger-color;
  }

  &-batch-delete {
    background: rgba(255, 68, 68, 0.15);
    color: @danger-color;
    border-color: @danger-color;
  }

  &-column-settings {
    font-size: @font-sm;
  }

  &-export {
    font-size: @font-sm;
  }

  &-import {
    font-size: @font-sm;
  }

  &-reset {
    font-size: @font-sm;
    color: @warning-color;
    border-color: @warning-color;
  }
}

.confirm-overlay {
  .overlay-mask(@overlay-deep; @z-combat-overlay);
}

.confirm-dialog {
  background: @secondary-bg;
  border: 2px solid @border-color;
  border-radius: @radius-xl;
  width: 400px;
}

.confirm-header {
  padding: @spacing-3xl @spacing-4xl;
  border-bottom: 1px solid @border-color;

  h3 {
    color: @danger-color;
    margin: 0;
  }
}

.confirm-body {
  padding: @spacing-4xl;
  color: @text-primary;
}

.reference-warning {
  color: @warning-color;
  font-size: @font-sm;
  margin-top: @spacing-lg;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: @spacing-lg;
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
}

// 列设置面板
.column-settings-panel {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: @spacing-xs;
  background: @secondary-bg;
  border: 1px solid @border-color;
  border-radius: @radius-md;
  padding: @spacing-lg;
  display: flex;
  flex-direction: column;
  gap: @spacing-sm;
  z-index: @z-dropdown;
  min-width: 160px;
}

.btn-column-settings {
  position: relative;
}

.column-settings-item {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  color: @text-secondary;
  font-size: @font-base;
  cursor: pointer;

  input[type='checkbox'] {
    accent-color: @accent-color;
    width: 14px;
    height: 14px;
  }
}

// 行详情
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
</style>
