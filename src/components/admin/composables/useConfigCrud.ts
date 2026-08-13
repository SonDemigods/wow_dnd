/**
 * @fileoverview ConfigManager CRUD 操作 composable
 *
 * 封装配置表的创建、编辑、删除、表单提交等交互逻辑：
 * - handleCreate / handleEdit：调用 store 打开对应模式的表单
 * - handleDelete / confirmDelete：删除确认弹窗 + 关联完整性检查
 * - handleFormSubmit：表单提交后写入数据库
 */
import { ref } from 'vue';
import { useAdminStore } from '@/modules/admin';
import type { AdminRecord } from '@/modules/admin';
import type { ComputedRef } from 'vue';
import { useToast } from '@/composables/useToast';
import { checkReferences, formatReferenceWarning } from '@/modules/admin/referenceGraph';

/** useConfigCrud 依赖的元信息（来自 useConfigTableMeta） */
export interface UseConfigCrudDeps {
  /** 当前表对应的 Dexie 表名 */
  currentDbTable: ComputedRef<string>;
}

/** useConfigCrud 返回值结构 */
export interface UseConfigCrudReturn {
  /** 是否显示删除确认弹窗 */
  showDeleteConfirm: ReturnType<typeof ref<boolean>>;
  /** 引用完整性警告文本（删除确认弹窗中展示） */
  referenceWarning: ReturnType<typeof ref<string>>;
  /** 打开创建表单 */
  handleCreate: () => void;
  /** 打开编辑表单 */
  handleEdit: (row: AdminRecord) => void;
  /** 打开删除确认弹窗（含关联检查） */
  handleDelete: (row: AdminRecord) => void;
  /** 确认删除（执行 store.deleteRecord 并关闭弹窗） */
  confirmDelete: () => Promise<void>;
  /** 提交表单（执行 store.saveRecord） */
  handleFormSubmit: (data: AdminRecord) => Promise<void>;
}

/**
 * ConfigManager CRUD 操作 composable
 */
export function useConfigCrud(deps: UseConfigCrudDeps): UseConfigCrudReturn {
  const store = useAdminStore();

  /** 是否显示删除确认 */
  const showDeleteConfirm = ref(false);
  /** 待删除的记录 */
  const pendingDeleteRecord = ref<AdminRecord | null>(null);
  /** 引用完整性警告文本 */
  const referenceWarning = ref('');

  /** 打开创建表单 */
  function handleCreate(): void {
    store.openCreateForm(`新增${store.currentTableMeta?.label || '记录'}`);
  }

  /** 打开编辑表单 */
  function handleEdit(row: AdminRecord): void {
    store.openEditForm(row, `编辑${store.currentTableMeta?.label || '记录'}`);
  }

  /** 打开删除确认（含关联检查） */
  async function handleDelete(row: AdminRecord): Promise<void> {
    pendingDeleteRecord.value = row;
    referenceWarning.value = '';

    // 关联完整性检查
    const id = row.id ?? row.characterId;
    if (id) {
      try {
        const result = await checkReferences(deps.currentDbTable.value, String(id));
        if (result.hasReferences) {
          referenceWarning.value = formatReferenceWarning(result);
        }
      } catch {
        // 检查失败不阻塞删除流程
      }
    }

    showDeleteConfirm.value = true;
  }

  /** 确认删除 */
  async function confirmDelete(): Promise<void> {
    if (!pendingDeleteRecord.value) return;
    const record = pendingDeleteRecord.value;
    const id = record.id ?? record.characterId;
    if (!id || (typeof id === 'string' && id.trim() === '')) {
      useToast().show({ message: '记录主键为空，无法删除', type: 'danger', duration: 3000 });
      showDeleteConfirm.value = false;
      pendingDeleteRecord.value = null;
      return;
    }
    try {
      const success = await store.deleteRecord(deps.currentDbTable.value, String(id));
      if (!success) {
        useToast().show({ message: '删除失败，请查看控制台', type: 'danger', duration: 3000 });
      }
    } catch (e) {
      console.error('[useConfigCrud] 删除记录失败:', e);
      useToast().show({ message: '删除失败，请查看控制台', type: 'danger', duration: 3000 });
    } finally {
      showDeleteConfirm.value = false;
      pendingDeleteRecord.value = null;
      referenceWarning.value = '';
    }
  }

  /** 提交表单 */
  async function handleFormSubmit(data: AdminRecord): Promise<void> {
    try {
      const success = await store.saveRecord(deps.currentDbTable.value, data);
      if (!success) {
        useToast().show({ message: '保存失败，请检查数据', type: 'danger', duration: 3000 });
      }
    } catch (e) {
      console.error('[useConfigCrud] 保存记录失败:', e);
      useToast().show({ message: '保存失败，请查看控制台', type: 'danger', duration: 3000 });
    }
  }

  return {
    showDeleteConfirm,
    referenceWarning,
    handleCreate,
    handleEdit,
    handleDelete,
    confirmDelete,
    handleFormSubmit,
  };
}
