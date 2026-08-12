/**
 * 后台管理模块状态管理
 *
 * 使用 Pinia 管理后台视图状态、当前选中表、CRUD 操作状态
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { adminService } from './service';
import type { AdminView, ConfigTableName, FormConfig, ReferenceOption } from './types';
import { CONFIG_TABLES } from './types';
import { configCache } from '@/modules/config';

/**
 * 后台管理状态存储
 */
export const useAdminStore = defineStore('admin', () => {
  // ==================== 状态 ====================

  /** 当前视图 */
  const currentView = ref<AdminView>('dashboard');

  /** 当前选中的配置表 */
  const selectedConfigTable = ref<ConfigTableName>('mobs');

  /** 表格数据缓存 */
  const tableData = ref<Record<string, unknown>[]>([]);

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 仪表盘统计数据 */
  const dashboardStats = ref<{
    tableCounts: Record<string, number>;
  }>({ tableCounts: {} });

  /** 表单配置 */
  const formConfig = ref<FormConfig>({
    mode: 'create',
    visible: false,
    title: '',
  });

  /** 当前编辑的记录 */
  const editingRecord = ref<Record<string, unknown> | null>(null);

  /** 搜索关键词 */
  const searchKeyword = ref('');

  /** 参考数据：阵营下拉选项 */
  const referenceFactions = ref<ReferenceOption[]>([]);
  /** 参考数据：种族下拉选项 */
  const referenceRaces = ref<ReferenceOption[]>([]);
  /** 参考数据：职业下拉选项 */
  const referenceClasses = ref<ReferenceOption[]>([]);
  /** 参考数据：地点下拉选项 */
  const referenceLocations = ref<ReferenceOption[]>([]);
  /** 参考数据：大陆下拉选项（从 locations 中筛选 type='continent'） */
  const referenceContinents = ref<ReferenceOption[]>([]);

  // ==================== 计算属性 ====================

  /** 当前选中表的元信息 */
  const currentTableMeta = computed(() => {
    return CONFIG_TABLES.find(t => t.key === selectedConfigTable.value);
  });

  // ==================== 方法 ====================

  /**
   * 切换视图
   */
  function switchView(view: AdminView) {
    currentView.value = view;
    if (view === 'dashboard') {
      loadDashboardStats();
    }
  }

  /**
   * 选择配置表
   */
  function selectConfigTable(table: ConfigTableName) {
    selectedConfigTable.value = table;
    searchKeyword.value = '';
    loadTableData();
  }

  /**
   * 加载仪表盘统计
   */
  async function loadDashboardStats() {
    isLoading.value = true;
    try {
      dashboardStats.value = await adminService.getDashboardStats();
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 加载当前选中表的数据
   */
  async function loadTableData() {
    const meta = currentTableMeta.value;
    if (!meta) return;

    isLoading.value = true;
    try {
      if (searchKeyword.value) {
        tableData.value = await adminService.searchTable(meta.dbTable, searchKeyword.value);
      } else {
        tableData.value = await adminService.getAll(meta.dbTable);
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 打开创建表单
   */
  function openCreateForm(title: string) {
    editingRecord.value = null;
    formConfig.value = { mode: 'create', visible: true, title };
  }

  /**
   * 打开编辑表单
   */
  function openEditForm(record: Record<string, unknown>, title: string) {
    editingRecord.value = { ...record };
    formConfig.value = { mode: 'edit', visible: true, title };
  }

  /**
   * 关闭表单
   */
  function closeForm() {
    formConfig.value.visible = false;
    editingRecord.value = null;
  }

  /**
   * 保存记录（创建或更新）
   */
  async function saveRecord(tableName: string, data: Record<string, unknown>): Promise<boolean> {
    const isEdit = formConfig.value.mode === 'edit';
    let result: { success: boolean; error?: string };

    if (isEdit) {
      // P7-023 修复：运行时校验 id 非空非空字符串，避免误写
      const id = editingRecord.value?.id as string | undefined;
      if (!id || (typeof id === 'string' && id.trim() === '')) {
        return false;
      }
      result = await adminService.update(tableName, id, data);
    } else {
      result = await adminService.add(tableName, data);
    }

    if (result.success) {
      // P11-501 修复：按表名精准失效 ConfigCache 对应缓存
      if (tableName === 'config_class_talents') {
        configCache.invalidate('talents');
      } else if (tableName === 'config_class_passives') {
        configCache.invalidate('passives');
      } else if (tableName === 'config_set_definitions') {
        configCache.invalidate('sets');
      }
      closeForm();
      await loadTableData();
      return true;
    }
    return false;
  }

  /**
   * 删除记录
   */
  async function deleteRecord(tableName: string, id: string): Promise<boolean> {
    const result = await adminService.delete(tableName, id);
    if (result.success) {
      // P11-501 修复：按表名精准失效 ConfigCache 对应缓存
      if (tableName === 'config_class_talents') {
        configCache.invalidate('talents');
      } else if (tableName === 'config_class_passives') {
        configCache.invalidate('passives');
      } else if (tableName === 'config_set_definitions') {
        configCache.invalidate('sets');
      }
      await loadTableData();
      return true;
    }
    return false;
  }

  /** 执行搜索并重新加载数据 */
  async function doSearch(keyword: string) {
    searchKeyword.value = keyword;
    await loadTableData();
  }

  /**
   * 加载参考数据（阵营、种族、职业、地点列表）
   * 用于配置管理页面中的下拉选项
   */
  async function loadReferenceData(): Promise<void> {
    const [factions, races, classes, locations] = await Promise.all([
      adminService.getAll<Record<string, unknown>>('config_factions'),
      adminService.getAll<Record<string, unknown>>('config_races'),
      adminService.getAll<Record<string, unknown>>('config_classes'),
      adminService.getAll<Record<string, unknown>>('config_locations'),
    ]);
    referenceFactions.value = factions.map((f) => ({ value: f.id as string, label: f.name as string }));
    referenceRaces.value = races.map((r) => ({ value: r.id as string, label: r.name as string }));
    referenceClasses.value = classes.map((c) => ({ value: c.id as string, label: c.name as string }));
    referenceLocations.value = locations.map((l) => ({ value: l.id as string, label: l.name as string }));
    referenceContinents.value = locations
      .filter((l) => l.type === 'continent')
      .map((l) => ({ value: l.id as string, label: l.name as string }));
  }

  return {
    // 状态
    currentView,
    selectedConfigTable,
    tableData,
    isLoading,
    dashboardStats,
    formConfig,
    editingRecord,
    searchKeyword,
    referenceFactions,
    referenceRaces,
    referenceClasses,
    referenceLocations,
    referenceContinents,

    // 计算属性
    currentTableMeta,

    // 方法
    switchView,
    selectConfigTable,
    loadDashboardStats,
    loadTableData,
    doSearch,
    openCreateForm,
    openEditForm,
    closeForm,
    saveRecord,
    deleteRecord,
    loadReferenceData,
  };
});
