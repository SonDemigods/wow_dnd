/**
 * @fileoverview ConfigManager CRUD 操作 composable
 *
 * 封装配置表的创建、编辑、删除、表单提交等交互逻辑：
 * - handleCreate / handleEdit：调用 store 打开对应模式的表单
 * - handleDelete / confirmDelete：删除确认弹窗的状态与执行
 * - handleFormSubmit：表单提交后写入数据库
 *
 * 删除确认弹窗的可见状态由本 composable 内部 ref 管理，组件模板直接绑定。
 */
import { ref } from 'vue';
import { useAdminStore } from '@/modules/admin';
import type { AdminRecord } from '@/modules/admin';
import type { ComputedRef } from 'vue';
import { useToast } from '@/composables/useToast';

/** useConfigCrud 依赖的元信息（来自 useConfigTableMeta） */
export interface UseConfigCrudDeps {
  /** 当前表对应的 Dexie 表名 */
  currentDbTable: ComputedRef<string>;
}

/** useConfigCrud 返回值结构 */
export interface UseConfigCrudReturn {
  /** 是否显示删除确认弹窗 */
  showDeleteConfirm: ReturnType<typeof ref<boolean>>;
  /** 打开创建表单 */
  handleCreate: () => void;
  /** 打开编辑表单 */
  handleEdit: (row: AdminRecord) => void;
  /** 打开删除确认弹窗 */
  handleDelete: (row: AdminRecord) => void;
  /** 确认删除（执行 store.deleteRecord 并关闭弹窗） */
  confirmDelete: () => Promise<void>;
  /** 提交表单（执行 store.saveRecord） */
  handleFormSubmit: (data: AdminRecord) => Promise<void>;
}

/**
 * ConfigManager CRUD 操作 composable
 *
 * @param deps - 依赖注入，提供 currentDbTable 计算属性
 * @returns 包含删除确认状态与各 CRUD 处理函数的对象
 */
export function useConfigCrud(deps: UseConfigCrudDeps): UseConfigCrudReturn {
  const store = useAdminStore();

  /** 是否显示删除确认 */
  const showDeleteConfirm = ref(false);
  /** 待删除的记录 */
  const pendingDeleteRecord = ref<AdminRecord | null>(null);

  /** 打开创建表单 */
  function handleCreate(): void {
    store.openCreateForm(`新增${store.currentTableMeta?.label || '记录'}`);
  }

  /** 打开编辑表单 */
  function handleEdit(row: AdminRecord): void {
    store.openEditForm(row, `编辑${store.currentTableMeta?.label || '记录'}`);
  }

  /** 打开删除确认 */
  function handleDelete(row: AdminRecord): void {
    pendingDeleteRecord.value = row;
    showDeleteConfirm.value = true;
  }

  /** 确认删除 */
  async function confirmDelete(): Promise<void> {
    if (!pendingDeleteRecord.value) return;
    // P7-030 修复：从记录中获取主键，校验非空后才执行删除
    const record = pendingDeleteRecord.value;
    const id = record.id ?? record.characterId;
    if (!id || (typeof id === 'string' && id.trim() === '')) {
      useToast().show({ message: '记录主键为空，无法删除', type: 'danger', duration: 3000 });
      showDeleteConfirm.value = false;
      pendingDeleteRecord.value = null;
      return;
    }
    // P7-029 修复：try/catch 防止 Dexie 操作异常导致 unhandled rejection
    try {
      // P12-028 修复：检查返回值，失败时 toast 提示
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
    }
  }

  /** 提交表单 */
  async function handleFormSubmit(data: AdminRecord): Promise<void> {
    // P7-029 修复：try/catch 防止 Dexie 操作异常导致 unhandled rejection
    try {
      // P12-028 修复：检查返回值，失败时 toast 提示
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
    handleCreate,
    handleEdit,
    handleDelete,
    confirmDelete,
    handleFormSubmit,
  };
}
