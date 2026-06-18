<template>
  <div class="admin-layout">
    <!-- 侧边导航 -->
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <h2>后台管理</h2>
      </div>

      <nav class="sidebar-nav">
        <!-- 仪表盘 -->
        <a
          class="nav-item"
          :class="{ active: store.currentView === 'dashboard' }"
          @click="store.switchView('dashboard')"
        >
          <span class="nav-label">仪表盘</span>
        </a>

        <!-- 配置管理分组 -->
        <div class="nav-group-title">配置管理</div>
        <a
          v-for="table in configTables"
          :key="table.key"
          class="nav-item nav-sub-item"
          :class="{
            active: store.currentView === 'config' && store.selectedConfigTable === table.key
          }"
          @click="navigateToConfig(table.key)"
        >
          <span class="nav-label">{{ table.label }}</span>
          <span class="nav-desc">{{ table.description }}</span>
        </a>
      </nav>

      <!-- 退出按钮 -->
      <div class="sidebar-footer">
        <button class="exit-btn" @click="$emit('exit')">返回游戏</button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="admin-main">
      <!-- 仪表盘 -->
      <div v-if="store.currentView === 'dashboard'" class="dashboard-view">
        <h2 class="page-title">仪表盘</h2>
        <div class="stats-grid">
          <div
            v-for="table in configTables"
            :key="table.key"
            class="stat-card stat-card-small"
            @click="navigateToConfig(table.key)"
          >
            <div class="stat-value">
              {{ store.dashboardStats.tableCounts[table.dbTable] || 0 }}
            </div>
            <div class="stat-label">{{ table.label }}</div>
          </div>
        </div>
      </div>

      <!-- 配置管理 -->
      <div v-if="store.currentView === 'config'" class="config-view">
        <ConfigManager />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * 后台管理布局组件
 *
 * 左侧导航 + 右侧内容区的经典后台布局，
 * 支持仪表盘和10个配置表的管理视图切换
 */
import { onMounted } from 'vue';
import { useAdminStore } from '@/modules/admin';
import { CONFIG_TABLES } from '@/modules/admin/types';
import type { ConfigTableName } from '@/modules/admin/types';
import ConfigManager from './ConfigManager.vue';

const store = useAdminStore();
const configTables = CONFIG_TABLES;

defineEmits<{
  exit: [];
}>();

onMounted(() => {
  store.loadDashboardStats();
});

/** 导航到指定配置表 */
function navigateToConfig(tableName: ConfigTableName) {
  store.switchView('config');
  store.selectConfigTable(tableName);
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.admin-layout {
  display: flex;
  height: 100vh;
  background: @primary-bg;
  overflow: hidden;
}

// ==================== 侧边栏 ====================
.admin-sidebar {
  width: 260px;
  min-width: 260px;
  background: @secondary-bg;
  border-right: 1px solid @border-color;
  .flex-col();
  overflow-y: auto;
}

.sidebar-header {
  padding: @spacing-4xl;
  border-bottom: 1px solid @border-color;

  h2 {
    color: @accent-color;
    font-size: @font-2xl;
    margin: 0;
  }
}

.sidebar-nav {
  flex: 1;
  padding: @spacing-lg 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: @spacing-lg @spacing-4xl;
  cursor: pointer;
  color: @text-secondary;
  transition: all @transition-quick;

  &:hover {
    background: @white-05;
    color: @text-primary;
  }

  &.active {
    background: @gold-bg;
    color: @accent-color;
    border-right: 3px solid @accent-color;
  }
}

.nav-sub-item {
  padding-left: 36px;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;

  .nav-desc {
    font-size: @font-xs;
    color: @text-secondary;
    opacity: 0.7;
  }
}

.nav-group-title {
  padding: @spacing-3xl @spacing-4xl @spacing-sm;
  font-size: @font-xs;
  color: @text-secondary;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sidebar-footer {
  padding: @spacing-3xl @spacing-4xl;
  border-top: 1px solid @border-color;
}

.exit-btn {
  width: 100%;
  padding: @spacing-lg;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid @border-color;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-md;
  cursor: pointer;

  &:hover {
    background: @white-15;
  }
}

// ==================== 主内容区 ====================
.admin-main {
  flex: 1;
  overflow: hidden;
  .flex-col();
  padding: 24px;
}

.page-title {
  color: @accent-color;
  font-size: @font-4xl;
  margin: 0 0 24px;
}

// ==================== 仪表盘 ====================
.dashboard-view {
  flex: 1;
  overflow-y: auto;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.stat-card {
  background: @secondary-bg;
  border: 1px solid @border-color;
  border-radius: @radius-lg;
  padding: @spacing-4xl;
  text-align: center;
  cursor: default;

  .stat-value {
    font-size: @font-6xl;
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

    .stat-value {
      font-size: @font-4xl;
    }

    &:hover {
      border-color: @accent-color;
    }
  }
}

// ==================== 管理视图 ====================
.config-view {
  flex: 1;
  overflow: hidden;
  .flex-col();
}
</style>
