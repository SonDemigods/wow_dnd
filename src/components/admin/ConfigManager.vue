<template>
  <div class="config-manager">
    <h2 class="page-title">
      {{ store.currentTableMeta?.label || '配置管理' }}
    </h2>

    <AdminTable
      :columns="currentColumns"
      :data="store.tableData"
      :total-count="store.tableData.length"
      @create="handleCreate"
      @edit="handleEdit"
      @delete="handleDelete"
      @refresh="store.loadTableData"
      @search="store.doSearch($event)"
    />

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="confirm-overlay" @click.self="showDeleteConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>确认删除</h3>
        </div>
        <div class="confirm-body">
          <p>确定要删除此记录吗？此操作不可撤销。</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-secondary" @click="showDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 编辑/创建表单弹窗 -->
    <AdminForm
      :visible="store.formConfig.visible"
      :title="store.formConfig.title"
      :fields="currentFormFields"
      :initial-data="store.editingRecord"
      @submit="handleFormSubmit"
      @cancel="store.closeForm"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 配置表管理组件
 *
 * 根据当前选中的配置表动态切换表格列定义和表单字段，
 * 实现所有 11 个配置表（阵营/种族/职业/物品/装备/怪物/Boss/任务/技能/地点/商店）的统一管理。
 *
 * 列定义、表单字段、字典翻译、CRUD 逻辑全部下沉至 composables，
 * 视图层仅保留视图绑定与 composable 编排。
 */
import { onMounted } from 'vue';
import { useAdminStore } from '@/modules/admin';
import AdminTable from './AdminTable.vue';
import AdminForm from './AdminForm.vue';
import { useConfigTableMeta } from './composables/useConfigTableMeta';
import { useConfigCrud } from './composables/useConfigCrud';

const store = useAdminStore();

const { currentColumns, currentFormFields, currentDbTable } = useConfigTableMeta();
const {
  showDeleteConfirm,
  handleCreate,
  handleEdit,
  handleDelete,
  confirmDelete,
  handleFormSubmit,
} = useConfigCrud({ currentDbTable });

onMounted(() => {
  store.loadReferenceData();
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
  padding: @spacing-md @spacing-4xl;
  border-radius: @radius-md;
  cursor: pointer;
  font-size: @font-md;
  border: 1px solid @border-color;

  &-secondary {
    background: transparent;
    color: @text-primary;
  }

  &-danger {
    background: @danger-color;
    color: @popup-text-color;
    border-color: @danger-color;
  }

  &:hover {
    opacity: 0.85;
  }
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: @overlay-deep;
  .flex-center();
  z-index: 2000;
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

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: @spacing-lg;
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
}
</style>
