<template>
  <div class="dashboard-panel">
    <h2 class="page-title">仪表盘</h2>

    <!-- 统计卡片网格 -->
    <div class="stats-grid">
      <div
        v-for="table in configTables"
        :key="table.key"
        class="stat-card stat-card-small"
        @click="$emit('navigate', table.key)"
      >
        <div class="stat-value">
          {{ store.dashboardStats.tableCounts[table.dbTable] || 0 }}
        </div>
        <div class="stat-label">{{ table.label }}</div>
      </div>
    </div>

    <!-- 数据概览 -->
    <div class="overview-section">
      <h3 class="section-title">数据概览</h3>
      <div class="overview-grid">
        <div class="overview-card">
          <div class="overview-label">总记录数</div>
          <div class="overview-value">{{ totalRecords }}</div>
        </div>
        <div class="overview-card">
          <div class="overview-label">最活跃的表</div>
          <div class="overview-value-small">
            <div v-for="item in topTables" :key="item.key" class="top-table-item">
              <span class="top-table-name">{{ item.label }}</span>
              <span class="top-table-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
        <div class="overview-card" :class="{ 'overview-card-warning': emptyTables.length > 0 }">
          <div class="overview-label">空表</div>
          <div class="overview-value-small">
            <span v-if="emptyTables.length === 0" class="empty-text">无空表</span>
            <span v-for="item in emptyTables" :key="item.key" class="empty-table-item">
              {{ item.label }}
            </span>
          </div>
        </div>
        <div class="overview-card version-card">
          <div class="version-row">
            <span class="overview-label">游戏版本</span>
            <span class="version-value">{{ appVersion }}</span>
          </div>
          <div class="version-row">
            <span class="overview-label">数据库版本</span>
            <span class="version-value">{{ dbVersion }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions-section">
      <h3 class="section-title">快捷操作</h3>
      <div class="quick-actions">
        <button class="btn btn-action" @click="handleExportBackup">
          全局备份
        </button>
        <label class="btn btn-action">
          全局恢复
          <input type="file" accept=".json" class="hidden-file-input" @change="handleImportBackup" />
        </label>
        <button class="btn btn-action btn-danger" @click="showResetAllConfirm = true">
          重置全部配置
        </button>
      </div>
    </div>

    <!-- 重置全部确认弹窗 -->
    <div v-if="showResetAllConfirm" class="confirm-overlay" @click.self="showResetAllConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>确认重置全部配置</h3>
        </div>
        <div class="confirm-body">
          <p>此操作将清空并重置所有 15 张配置表为默认值。<strong>当前所有配置数据将丢失！</strong></p>
          <p class="warning-text">建议先执行"全局备份"。</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-secondary" @click="showResetAllConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmResetAll">确认重置全部</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 仪表盘面板组件
 *
 * 展示：
 * - 各表统计卡片
 * - 数据概览（总记录数 / Top3 / 空表 / 游戏版本 / 数据库版本）
 * - 快捷操作（全局备份 / 恢复 / 重置全部配置）
 */
import { computed, ref } from 'vue';
import { useAdminStore } from '@/modules/admin';
import { CONFIG_TABLES } from '@/modules/admin';
import type { ConfigTableName } from '@/modules/admin';
import { backupService, importService } from '@/modules/data';
import { APP_VERSION } from '@/config/version';
import { BACKUP_CONFIG } from '@/config/database';
import { useToast } from '@/composables/useToast';

const store = useAdminStore();
const configTables = CONFIG_TABLES;
const appVersion = APP_VERSION;
const dbVersion = BACKUP_CONFIG.backupVersion;

defineEmits<{
  navigate: [table: ConfigTableName];
}>();

const showResetAllConfirm = ref(false);

// ==================== 统计数据 ====================

/** 总记录数 */
const totalRecords = computed(() => {
  const counts = store.dashboardStats.tableCounts;
  return configTables.reduce((sum, t) => sum + (counts[t.dbTable] || 0), 0);
});

/** 记录数 Top 3 */
const topTables = computed(() => {
  const counts = store.dashboardStats.tableCounts;
  return configTables
    .map(t => ({ key: t.key, label: t.label, count: counts[t.dbTable] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
});

/** 空表列表 */
const emptyTables = computed(() => {
  const counts = store.dashboardStats.tableCounts;
  return configTables
    .filter(t => (counts[t.dbTable] || 0) === 0)
    .map(t => ({ key: t.key, label: t.label }));
});

// ==================== 快捷操作 ====================

/** 全局备份 */
async function handleExportBackup(): Promise<void> {
  try {
    await backupService.exportBackup();
    useToast().show({ message: '全局备份已下载', type: 'success', duration: 2000 });
  } catch (e) {
    console.error('[DashboardPanel] 全局备份失败:', e);
    useToast().show({ message: '备份失败，请查看控制台', type: 'danger', duration: 3000 });
  }
}

/** 全局恢复 */
async function handleImportBackup(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  target.value = '';

  try {
    const result = await importService.importBackup(file);
    if (result.success) {
      useToast().show({ message: '恢复成功，正在刷新数据...', type: 'success', duration: 2000 });
      await store.loadDashboardStats();
    } else {
      useToast().show({ message: result.error || '恢复失败', type: 'danger', duration: 3000 });
    }
  } catch (e) {
    console.error('[DashboardPanel] 全局恢复失败:', e);
    useToast().show({ message: '恢复失败，请查看控制台', type: 'danger', duration: 3000 });
  }
}

/** 确认重置全部配置 */
async function confirmResetAll(): Promise<void> {
  showResetAllConfirm.value = false;
  let success = 0;
  let fail = 0;

  for (let i = 0; i < configTables.length; i++) {
    try {
      const result = await store.resetTable();
      if (result) success++;
      else fail++;
    } catch {
      fail++;
    }
  }

  if (fail > 0) {
    useToast().show({
      message: `重置完成：成功 ${success} 表，失败 ${fail} 表`,
      type: 'danger',
      duration: 4000,
    });
  } else {
    useToast().show({
      message: `已重置全部 ${success} 张配置表`,
      type: 'success',
      duration: 2000,
    });
  }

  await store.loadDashboardStats();
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.dashboard-panel {
  flex: 1;
  overflow-y: auto;
}

.page-title {
  color: @accent-color;
  font-size: @font-4xl;
  margin: 0 0 24px;
}

// ==================== 统计卡片 ====================
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: @secondary-bg;
  border: 1px solid @border-color;
  border-radius: @radius-lg;
  padding: @spacing-4xl;
  text-align: center;
  cursor: default;

  .stat-value {
    font-size: @font-4xl;
    font-weight: @font-weight-bold;
    color: @accent-color;
  }

  .stat-label {
    font-size: @font-base;
    color: @text-secondary;
    margin-top: 6px;
  }

  &-small {
    cursor: pointer;
    transition: border-color @transition-quick;

    &:hover {
      border-color: @accent-color;
    }
  }
}

// ==================== 数据概览 ====================
.overview-section {
  margin-bottom: 32px;
}

.section-title {
  color: @text-primary;
  font-size: @font-xl;
  margin: 0 0 @spacing-4xl;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.overview-card {
  background: @secondary-bg;
  border: 1px solid @border-color;
  border-radius: @radius-lg;
  padding: @spacing-4xl;

  &-warning {
    border-color: @danger-color;
  }
}

.version-card {
  .flex-col();
  gap: @spacing-lg;
}

.version-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-value {
  font-size: @font-md;
  font-weight: @font-weight-semibold;
  color: @accent-color;
}

.overview-label {
  font-size: @font-sm;
  color: @text-secondary;
  margin-bottom: @spacing-lg;
}

.overview-value {
  font-size: @font-5xl;
  font-weight: @font-weight-bold;
  color: @accent-color;
}

.overview-value-small {
  font-size: @font-md;
  color: @text-primary;
  .flex-col();
  gap: @spacing-sm;
}

.top-table-item {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .top-table-name { color: @text-secondary; }
  .top-table-count { color: @accent-color; font-weight: @font-weight-bold; }
}

.empty-text {
  color: @text-secondary;
  font-size: @font-sm;
}

.empty-table-item {
  color: @danger-color;
  font-size: @font-sm;

  &::after {
    content: '、';
  }

  &:last-child::after {
    content: '';
  }
}

// ==================== 快捷操作 ====================
.quick-actions-section {
  margin-bottom: 32px;
}

.quick-actions {
  display: flex;
  gap: @spacing-lg;
  flex-wrap: wrap;
}

.btn {
  .admin-btn-base(@spacing-4xl);
  position: relative;

  &-action {
    background: @white-05;
    color: @text-primary;

    &:hover {
      background: @white-10;
    }
  }

  &-secondary {
    background: transparent;
    color: @text-primary;
  }

  &-danger {
    background: rgba(255, 68, 68, 0.15);
    color: @danger-color;
    border-color: @danger-color;

    &:hover {
      background: rgba(255, 68, 68, 0.25);
    }
  }
}

.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  cursor: pointer;
}

// ==================== 确认弹窗 ====================
.confirm-overlay {
  .overlay-mask(@overlay-deep; @z-combat-overlay);
}

.confirm-dialog {
  background: @secondary-bg;
  border: 2px solid @border-color;
  border-radius: @radius-xl;
  width: 450px;
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

  .warning-text {
    color: @warning-color;
    font-size: @font-sm;
    margin-top: @spacing-lg;
  }
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: @spacing-lg;
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
}
</style>
