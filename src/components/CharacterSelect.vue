<template>
  <div class="character-select">
    <!-- 删除确认弹窗 -->
    <div v-if="showConfirmModal" class="confirm-modal-overlay" @click="cancelDelete">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon">⚠️</div>
        <h3>确认删除</h3>
        <p>确定要删除这个角色吗？此操作无法撤销。</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="cancelDelete">取消</button>
          <button class="confirm-btn-delete" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>

    <!-- 导入确认弹窗 -->
    <div v-if="showImportModal" class="confirm-modal-overlay" @click="cancelImport">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon">📥</div>
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
        <div class="confirm-icon">{{ importSuccess ? '✅' : '❌' }}</div>
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
        <div class="confirm-icon">🔧</div>
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
        <div class="confirm-icon">{{ repairSuccess ? '✅' : '❌' }}</div>
        <h3>{{ repairSuccess ? '修复成功' : '修复失败' }}</h3>
        <p>{{ repairMessage }}</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="closeRepairResult">确定</button>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件选择输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileSelected"
    />

    <div class="character-list">
      <div 
        v-for="char in characters" 
        :key="char.id"
        class="character-card"
        :class="{ selected: selectedId === char.id }"
        :style="{ '--class-color': baseStore.getClassColor(char.classId), '--faction-color': baseStore.getFactionColor(char.factionId) }"
        @click="selectCharacter(char.id)"
      >
        <div class="char-icon">
          <BaseIcon :name="baseStore.getRaceIcon(char.raceId)" gradient="gold" :size="40" />
        </div>
        <div class="char-info">
          <div class="char-header">
            <span class="char-name">{{ char.name }}</span>
            <span class="char-level">Lv.{{ char.level }}</span>
          </div>
          <div class="char-details">
            <Tag type="faction" :text="baseStore.getFactionName(char.factionId)" :color="baseStore.getFactionColor(char.factionId)" />
            <Tag type="race" :text="baseStore.getRaceName(char.raceId)" />
            <Tag type="class" :text="baseStore.getClassName(char.classId)" :color="baseStore.getClassColor(char.classId)" />
          </div>
        </div>
        <div class="char-delete" @click.stop="deleteCharacter(char.id)">🗑️</div>
      </div>

      <button v-if="characters.length < 10" class="add-character" @click="onCreateClick">
        <div class="add-icon">+</div>
        <div class="add-text">创建角色</div>
      </button>
    </div>

    <div class="action-bar">
      <div class="action-buttons">
        <button 
          class="action-btn action-btn-primary" 
          :disabled="!selectedId"
          @click="confirmSelect"
        >
          进入游戏
        </button>
        <button class="action-btn action-btn-export" @click="handleExport">
          📤 导出存档
        </button>
        <button class="action-btn action-btn-import" @click="triggerImport">
          📥 导入存档
        </button>
        <button class="action-btn action-btn-repair" @click="triggerRepair">
          🔧 修复基础数据
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色选择组件
 * @description 展示已有角色列表，支持选择角色进入游戏、创建新角色、删除角色（带二次确认）以及导出/导入存档
 */

import { ref, computed, onMounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus/core';
import Tag from './common/Tag.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { useBaseStore } from '@/modules/base';
import type { ImportResult } from '@/modules/data';

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'create'): void;
}>();

const baseStore = useBaseStore();
const characterStore = useCharacterStore();

/** 直接从 Store 读取的响应式角色列表 */
const characters = computed(() => characterStore.characterList);
const selectedId = ref<string | null>(null);

// 删除确认弹窗
const showConfirmModal = ref(false);
const deletingCharacterId = ref<string | null>(null);

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

async function loadData() {
  await baseStore.loadAllData();
}

async function loadCharacters() {
  await characterStore.loadCharacterList();
  if (characters.value.length > 0 && !selectedId.value) {
    selectedId.value = characters.value[0].id;
  }
}

function selectCharacter(id: string) {
  selectedId.value = id;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'select_character' });
}

function deleteCharacter(id: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'delete_char_btn' });
  deletingCharacterId.value = id;
  showConfirmModal.value = true;
}

function cancelDelete() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'cancel_delete' });
  showConfirmModal.value = false;
  deletingCharacterId.value = null;
}

async function confirmDelete() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'confirm_delete' });
  if (deletingCharacterId.value) {
    await characterStore.deleteCharacter(deletingCharacterId.value);
    await loadCharacters();
    if (selectedId.value === deletingCharacterId.value) {
      selectedId.value = characters.value.length > 0 ? characters.value[0].id : null;
    }
  }
  showConfirmModal.value = false;
  deletingCharacterId.value = null;
}

async function confirmSelect() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'enter_game' });
  if (selectedId.value) {
    await characterStore.selectCharacter(selectedId.value);
    emit('select', selectedId.value);
  }
}

// 创建角色按钮
function onCreateClick() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'create_character_btn' });
  emit('create');
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
      await loadData();
      await loadCharacters();
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
    await loadData();
    await loadCharacters();
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

onMounted(async () => {
  await loadData();
  await loadCharacters();
});

async function refreshData() {
  await loadData();
  await loadCharacters();
}

defineExpose({
  refreshData
});
</script>

<style lang="less" scoped>
.character-select {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.character-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* 移动端：每行显示一个角色 */
@media (max-width: 480px) {
  .character-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* PC端：卡片尺寸加大 */
@media (min-width: 769px) {
  .character-card {
    height: 180px;
    padding: 20px 14px;
  }
  .char-icon {
    font-size: 52px;
  }
  .char-name {
    font-size: 16px;
  }
  .char-level {
    font-size: 13px;
  }
  .char-details {
    font-size: 12px;
  }
  .add-character {
    height: 180px;
  }
  .add-icon {
    font-size: 40px;
  }
}

.character-card {
  width: 100%;
  height: 140px;
  padding: @spacing-2xl @spacing-lg;
  background: rgba(13, 17, 23, 0.95);
  border: @border-hover;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  position: relative;
  .flex-col-center();
  gap: @spacing-sm;
  box-sizing: border-box;
  overflow: hidden;
}

.character-card:hover {
  border-color: @color-dodge;
  transform: translateY(-2px);
}

.character-card.selected {
  border-color: var(--class-color);
  background: @gold-bg;
  box-shadow: 0 0 20px var(--class-color);
}

.char-icon {
  font-size: 40px;
}

.char-info {
  text-align: center;
}

.char-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: @spacing-md;
  margin-bottom: @spacing-xs;
}

.char-name {
  font-size: @font-md;
  color: @text-primary;
  font-weight: @font-weight-bold;
}

.char-level {
  padding: 1px 6px;
  background: @gold-bg-active;
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: @radius-sm;
  font-size: @font-xs;
  color: @accent-color;
  font-weight: @font-weight-bold;
}

.char-details {
  display: flex;
  gap: @spacing-xs;
  font-size: @font-xs;
  justify-content: center;
  white-space: nowrap;
  width: 100%;
  overflow: hidden;
}

.char-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  .flex-center();
  background: rgba(255, 68, 0, 0.2);
  border: 1px solid rgba(255, 68, 0, 0.3);
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.6;
  transition: all @transition-normal;
  font-size: @font-sm;
}

.char-delete:hover {
  opacity: 1;
  background: rgba(255, 68, 0, 0.4);
  border-color: @color-delete;
  transform: scale(1.1);
}

.add-character {
  width: 100%;
  min-width: 130px;
  height: 140px;
  padding: @spacing-3xl;
  background: rgba(255, 255, 255, 0.03);
  border: @border-dashed;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  .flex-col-center();
  gap: @spacing-md;
}

.add-character:hover {
  border-color: @accent-color;
  background: @gold-bg;
  transform: translateY(-2px);
}

.add-icon {
  font-size: @font-6xl;
  color: @accent-color;
}

.add-text {
  color: @text-primary;
  font-size: @font-md;
}

.action-bar {
  margin-top: 24px;
  text-align: center;
}

.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

/* 移动端：按钮竖向排列 */
@media (max-width: 480px) {
  .action-buttons {
    flex-direction: column;
    gap: 12px;
  }
  .action-btn {
    width: 100%;
  }
}

/* 统一的操作按钮基础样式 */
.action-btn {
  padding: @spacing-3xl 64px;
  border-radius: @radius-lg;
  font-size: @font-xl;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
  border: 2px solid;
}

/* 进入游戏 - 金色 */
.action-btn-primary {
  background: linear-gradient(135deg, @accent-color, #daa520);
  border-color: @accent-color;
  color: @primary-bg;
}

.action-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
}

.action-btn-primary:disabled {
  background: @popup-border-color;
  border-color: @popup-border-color;
  color: @color-dodge;
  cursor: not-allowed;
  opacity: @opacity-dimmed;
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