<template>
  <BasePopup
    :visible="visible"
    title="存档管理"
    max-width="480px"
    @close="$emit('close')"
  >
    <div class="archive-body">
      <!-- 操作按钮（垂直排列） -->
      <div class="archive-buttons">
        <button class="action-btn action-btn-export" @click="handleExport">
          <BaseIcon name="cloud-upload" :size="18" /> 导出存档
        </button>
        <button class="action-btn action-btn-import" @click="triggerImport">
          <BaseIcon name="cloud-download" :size="18" /> 导入存档
        </button>
        <button class="action-btn action-btn-repair" @click="triggerRepair">
          <BaseIcon name="toolbox" :size="18" /> 修复基础数据
        </button>
        <button
          v-if="versionMismatch"
          class="action-btn action-btn-migrate"
          @click="triggerMigration"
        >
          <BaseIcon name="arrow-up" :size="18" /> 数据迁移
        </button>
      </div>

      <!-- 隐藏的文件选择输入 -->
      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleFileSelected"
      />
    </div>

    <!-- 导入确认弹窗 -->
    <div v-if="showImportModal" class="confirm-modal-overlay" @click="cancelImport">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon name="cloud-download" gradient="fire" :size="32" /></div>
        <h3>确认导入存档</h3>
        <p>导入存档将覆盖当前所有游戏数据，此操作无法撤销。确定要继续吗？</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="cancelImport">取消</button>
          <button class="confirm-btn-delete" @click="confirmImport">导入</button>
        </div>
      </div>
    </div>

    <!-- 导入结果提示弹窗 -->
    <div v-if="showResultModal" class="confirm-modal-overlay" @click="closeResult">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon :name="importSuccess ? 'check-mark' : 'cancel'" :gradient="importSuccess ? 'heal' : 'debuff'" :size="32" /></div>
        <h3>{{ importSuccess ? '导入成功' : '导入失败' }}</h3>
        <p>{{ importMessage }}</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="closeResult">确定</button>
        </div>
      </div>
    </div>

    <!-- 修复基础数据确认弹窗 -->
    <div v-if="showRepairModal" class="confirm-modal-overlay" @click="cancelRepair">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon name="toolbox" :size="32" /></div>
        <h3>确认修复基础数据</h3>
        <p>此操作将清空所有基础配置数据（阵营、种族、职业、物品、怪物、地点、商店、任务、技能等）并重新导入默认数据。角色数据不受影响。确定要继续吗？</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="cancelRepair">取消</button>
          <button class="confirm-btn-delete" @click="confirmRepair">修复</button>
        </div>
      </div>
    </div>

    <!-- 修复基础数据结果弹窗 -->
    <div v-if="showRepairResultModal" class="confirm-modal-overlay" @click="closeRepairResult">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon :name="repairSuccess ? 'check-mark' : 'cancel'" :gradient="repairSuccess ? 'heal' : 'debuff'" :size="32" /></div>
        <h3>{{ repairSuccess ? '修复成功' : '修复失败' }}</h3>
        <p>{{ repairMessage }}</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="closeRepairResult">确定</button>
        </div>
      </div>
    </div>

    <!-- 数据迁移确认弹窗 -->
    <div v-if="showMigrationModal" class="confirm-modal-overlay" @click="cancelMigration">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon name="arrow-up" gradient="fire" :size="32" /></div>
        <h3>确认数据迁移</h3>
        <p>将把存档从 v{{ currentDataVersion }} 迁移至 v{{ expectedDataVersion }}。建议迁移前先导出存档备份，避免迁移失败导致数据丢失。确定要继续吗？</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="cancelMigration">取消</button>
          <button class="confirm-btn-delete" @click="confirmMigration">迁移</button>
        </div>
      </div>
    </div>

    <!-- 数据迁移结果弹窗 -->
    <div v-if="showMigrationResultModal" class="confirm-modal-overlay" @click="closeMigrationResult">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon :name="migrationSuccess ? 'check-mark' : 'cancel'" :gradient="migrationSuccess ? 'heal' : 'debuff'" :size="32" /></div>
        <h3>{{ migrationSuccess ? '迁移成功' : '迁移失败' }}</h3>
        <p>{{ migrationMessage }}</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="closeMigrationResult">确定</button>
        </div>
      </div>
    </div>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 存档管理弹窗组件
 * @description 承载导出/导入/修复/迁移四个功能按钮及其确认/结果弹窗，
 *   逻辑整体迁自 CharacterSelect.vue，行为保持不变。
 *
 * 迁移成功后 emit('migrated') 通知父组件（CharacterSelect → App.vue）重新初始化各 Store。
 */

import { ref, computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { useGameStore } from '@/modules/game';
import { eventBus, GameEvents } from '@/modules/bus';
import { migrationService } from '@/modules/data';
import type { ImportResult } from '@/modules/data';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

defineProps<{
  visible: boolean;
  /** 版本不匹配标志：true 时显示"数据迁移"按钮 */
  versionMismatch?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  /** 数据迁移成功后通知父组件重新初始化各 Store */
  (e: 'migrated'): void;
}>();

const baseStore = useBaseStore();
const characterStore = useCharacterStore();
const gameStore = useGameStore();

/**
 * 当前存档的数据版本戳（用于迁移确认弹窗显示 v{当前版本}）
 *
 * 从 gameStore 读取（initialize 时镜像自 runtime_gameState.dataVersion）。
 * null 表示尚未初始化完成，此时 versionMismatch 必为 false，不会进入迁移分支。
 */
const currentDataVersion = computed(() => gameStore.getCurrentDataVersion() ?? '?');

/** 当前代码期望的数据版本（用于迁移确认弹窗显示 v{期望版本}） */
const expectedDataVersion = computed(() => gameStore.getExpectedDataVersion());

// 导入相关状态
const fileInputRef = ref<HTMLInputElement | null>(null);
const showImportModal = ref(false);
const selectedFile = ref<File | null>(null);
const showResultModal = ref(false);
const importSuccess = ref(false);
const importMessage = ref('');

// 修复基础数据相关状态
const showRepairModal = ref(false);
const showRepairResultModal = ref(false);
const repairSuccess = ref(false);
const repairMessage = ref('');

// 数据迁移相关状态
const showMigrationModal = ref(false);
const showMigrationResultModal = ref(false);
const migrationSuccess = ref(false);
const migrationMessage = ref('');

/** 刷新基础数据与角色列表（导入/修复后调用，保持与原 CharacterSelect 行为一致） */
async function refreshData() {
  await baseStore.loadAllData();
  await characterStore.loadCharacterList();
}

// ==================== 导出/导入功能 ====================

/**
 * 导出存档：调用 BackupService 导出 JSON 文件
 */
async function handleExport() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'export_archive' });
  try {
    await characterStore.exportBackup();
    eventBus.emit(GameEvents.DATA_EXPORTED, null);
  } catch (error) {
    showResult(false, '导出失败', (error as Error).message || '未知错误');
  }
}

/**
 * 触发导入：打开文件选择对话框
 */
function triggerImport() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'import_btn' });
  fileInputRef.value?.click();
}

/**
 * 文件选择后的回调：先验证备份文件，验证通过则弹出确认弹窗
 */
async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const validation = await characterStore.validateImportBackup(file);
    if (!validation.success) {
      showResult(false, '验证失败', validation.error || '备份文件无效');
      // 重置 input，以便再次选择同一文件时能触发 change 事件
      input.value = '';
      return;
    }
    selectedFile.value = file;
    showImportModal.value = true;
  } catch (error) {
    showResult(false, '验证失败', (error as Error).message || '读取文件失败');
  }

  // 重置 input
  input.value = '';
}

/**
 * 取消导入
 */
function cancelImport() {
  showImportModal.value = false;
  selectedFile.value = null;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'cancel_import' });
}

/**
 * 确认导入：执行数据导入并刷新角色列表
 */
async function confirmImport() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'confirm_import' });
  if (!selectedFile.value) return;
  showImportModal.value = false;

  try {
    const result: ImportResult = await characterStore.importBackup(selectedFile.value);
    if (result.success) {
      eventBus.emit(GameEvents.DATA_IMPORTED, null);
      // 刷新数据和角色列表
      await refreshData();
      showResult(true, '导入成功', `已成功导入 ${result.importedStores.length} 张数据表`);
    } else {
      showResult(false, '导入失败', result.error || '未知错误');
    }
  } catch (error) {
    showResult(false, '导入失败', (error as Error).message || '未知错误');
  }

  selectedFile.value = null;
}

/**
 * 关闭结果弹窗
 */
function closeResult() {
  showResultModal.value = false;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'result_close' });
}

/**
 * 显示结果提示弹窗
 */
function showResult(success: boolean, _title: string, message: string) {
  importSuccess.value = success;
  importMessage.value = message;
  showResultModal.value = true;
}

// ==================== 修复基础数据功能 ====================

/** 触发修复基础数据：弹出确认弹窗 */
function triggerRepair() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'repair_base_data_btn' });
  showRepairModal.value = true;
}

/** 取消修复 */
function cancelRepair() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'cancel_repair' });
  showRepairModal.value = false;
}

/** 确认修复：执行数据修复并刷新 */
async function confirmRepair() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'confirm_repair' });
  showRepairModal.value = false;

  try {
    await characterStore.repairBaseData();
    // 刷新数据和角色列表
    await refreshData();
    repairSuccess.value = true;
    repairMessage.value = '基础数据已成功修复，所有配置表已重置为默认值。';
  } catch (error) {
    repairSuccess.value = false;
    repairMessage.value = (error as Error).message || '修复过程中发生未知错误';
  }
  showRepairResultModal.value = true;
}

/** 关闭修复结果弹窗 */
function closeRepairResult() {
  showRepairResultModal.value = false;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'repair_result_close' });
}

// ==================== 数据迁移功能 ====================

/**
 * 触发数据迁移：弹出确认弹窗
 *
 * 仅在 versionMismatch=true 时按钮可见（模板 v-if 控制）。
 * 迁移流程参照 confirmRepair 模式：确认弹窗 → 执行 → 结果弹窗。
 */
function triggerMigration() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'migration_btn' });
  showMigrationModal.value = true;
}

/** 取消迁移 */
function cancelMigration() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'cancel_migration' });
  showMigrationModal.value = false;
}

/**
 * 确认迁移：调用 MigrationService.runStartupMigration 执行全量迁移
 *
 * 迁移成功后：
 * - emit('migrated') 通知父组件（CharacterSelect → App.vue）重新初始化各 Store，
 *   刷新 gameStore.versionMismatch 状态
 * - 同时刷新本组件的基础数据与角色列表（迁移可能改写角色数据）
 *
 * 迁移失败：显示错误信息，保留 versionMismatch 状态，用户可重试或导出存档后重装。
 */
async function confirmMigration() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'confirm_migration' });
  showMigrationModal.value = false;

  try {
    const result = await migrationService.runStartupMigration();
    if (result.success) {
      migrationSuccess.value = true;
      migrationMessage.value = `存档已从 v${result.fromVersion} 迁移至 v${result.toVersion}`;
      // 通知父组件重新初始化各 Store，刷新 versionMismatch 状态
      emit('migrated');
      // 刷新本组件的基础数据与角色列表（迁移可能改写角色数据）
      await refreshData();
    } else {
      migrationSuccess.value = false;
      migrationMessage.value = result.error || '迁移失败，请尝试导出存档后重新安装';
    }
  } catch (error) {
    migrationSuccess.value = false;
    migrationMessage.value = (error as Error).message || '迁移过程中发生未知错误';
  }
  showMigrationResultModal.value = true;
}

/** 关闭迁移结果弹窗 */
function closeMigrationResult() {
  showMigrationResultModal.value = false;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'migration_result_close' });
}
</script>

<style lang="less" scoped>
.archive-body {
  .flex-col();
  gap: @spacing-3xl;
  padding: @spacing-md @spacing-xs;
}

.archive-buttons {
  .flex-col();
  gap: @spacing-xl;
}

/* 统一的操作按钮基础样式 */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: @spacing-md;
  padding: @spacing-3xl @spacing-2xl;
  border-radius: @radius-lg;
  font-size: @font-lg;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
  border: 2px solid;
  width: 100%;
  box-sizing: border-box;
}

/* 导出存档 - 绿色 */
.action-btn-export {
  background: rgba(0, 200, 100, 0.15);
  border-color: rgba(0, 200, 100, 0.4);
  color: #00c864;
}

.action-btn-export:hover {
  background: rgba(0, 200, 100, 0.25);
  border-color: #00c864;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 200, 100, 0.3);
}

/* 导入存档 - 蓝色 */
.action-btn-import {
  background: rgba(0, 150, 255, 0.15);
  border-color: rgba(0, 150, 255, 0.4);
  color: #0096ff;
}

.action-btn-import:hover {
  background: rgba(0, 150, 255, 0.25);
  border-color: #0096ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 150, 255, 0.3);
}

/* 修复基础数据 - 橙色 */
.action-btn-repair {
  background: rgba(255, 165, 0, 0.15);
  border-color: rgba(255, 165, 0, 0.4);
  color: #ffa500;
}

.action-btn-repair:hover {
  background: rgba(255, 165, 0, 0.25);
  border-color: #ffa500;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);
}

/* 数据迁移 - 红橙警告色（区别于修复按钮的橙色） */
.action-btn-migrate {
  background: rgba(255, 80, 0, 0.2);
  border-color: rgba(255, 80, 0, 0.5);
  color: #ff6b35;
  animation: migrate-btn-pulse 1.5s ease-in-out infinite;
}

.action-btn-migrate:hover {
  background: rgba(255, 80, 0, 0.3);
  border-color: #ff6b35;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 80, 0, 0.4);
}

@keyframes migrate-btn-pulse {
  0%, 100% {
    box-shadow: 0 0 6px rgba(255, 80, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 14px rgba(255, 80, 0, 0.6);
  }
}

/* 确认弹窗 */
.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: @overlay-deep;
  .flex-center();
  z-index: @z-popup;
}

.confirm-modal {
  background: rgba(20, 25, 35, 0.98);
  border: 2px solid @color-delete;
  border-radius: @radius-xl;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  text-align: center;
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: @spacing-3xl;
}

.confirm-modal h3 {
  color: @color-delete;
  font-size: @font-2xl;
  margin-bottom: @spacing-xl;
}

.confirm-modal p {
  color: #b0b0b0;
  font-size: @font-md;
  margin-bottom: 20px;
}

.confirm-buttons {
  display: flex;
  gap: @spacing-xl;
  justify-content: center;
}

.confirm-btn-cancel {
  padding: @spacing-lg 24px;
  background: @white-10;
  border: 1px solid @color-dim-gray;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-normal;
}

.confirm-btn-cancel:hover {
  background: @white-20;
  border-color: @color-dodge;
}

.confirm-btn-delete {
  padding: @spacing-lg 24px;
  background: linear-gradient(135deg, @color-delete, #cc3300);
  border: none;
  border-radius: @radius-md;
  color: @popup-text-color;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
}

.confirm-btn-delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 68, 0, 0.4);
}
</style>
