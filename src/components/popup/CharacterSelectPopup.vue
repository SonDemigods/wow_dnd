<template>
  <BasePopup
    :visible="visible"
    title="角色选择"
    max-width="720px"
    @close="$emit('close')"
  >
    <div class="select-body">
      <!-- 角色列表 -->
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
            <BaseIcon :name="baseStore.getRaceIcon(char.raceId)" :size="40" />
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
          <div class="char-delete" @click.stop="deleteCharacter(char.id)"><BaseIcon name="trash-can" :size="18" /></div>
        </div>

        <button v-if="characters.length < 10" class="add-character" @click="onCreateClick">
          <div class="add-icon">+</div>
          <div class="add-text">创建角色</div>
        </button>
      </div>

      <!-- 进入游戏按钮 -->
      <div class="action-bar">
        <button
          class="action-btn action-btn-primary"
          :disabled="!selectedId || versionMismatch"
          @click="confirmSelect"
        >
          进入游戏
        </button>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showConfirmModal" class="confirm-modal-overlay" @click="cancelDelete">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="confirm-modal" @click.stop>
        <div class="confirm-icon"><BaseIcon name="caltrops" gradient="fire" :size="32" /></div>
        <h3>确认删除</h3>
        <p>确定要删除这个角色吗？此操作无法撤销。</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="cancelDelete">取消</button>
          <button class="confirm-btn-delete" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色选择弹窗组件（开始游戏）
 * @description 从 CharacterSelect.vue 抽取的角色列表展示与选择逻辑：
 *   展示角色列表、选择角色、删除角色（带二次确认）、创建角色入口、进入游戏。
 *
 * 数据来源：复用 useCharacterStore / useBaseStore，与原 CharacterSelect 逻辑一致。
 * 角色列表由父组件 CharacterSelect 负责加载，本组件响应式读取 store，列表变更自动刷新。
 */

import { ref, computed, watch } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import Tag from '../common/Tag.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import BasePopup from '../common/BasePopup.vue';
import { useBaseStore } from '@/modules/base';
import { useToast } from '@/composables/useToast';
import { errorHandler } from '@/services/ErrorHandler';

defineProps<{
  visible: boolean;
  /** 版本不匹配标志：true 时禁用"进入游戏"按钮 */
  versionMismatch?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', id: string): void;
  (e: 'create'): void;
}>();

const baseStore = useBaseStore();
const characterStore = useCharacterStore();

/** 直接从 Store 读取的响应式角色列表 */
const characters = computed(() => characterStore.characterList);
/** 当前选中的角色 ID */
const selectedId = ref<string | null>(null);

/**
 * 监听角色列表变化，自动维护选中项：
 * - 列表非空且当前选中无效（null 或已不存在）时，选中第一个
 * - 列表清空时，清除选中
 *
 * 覆盖场景：初次加载、创建角色后列表追加、删除角色后选中项失效、迁移后列表改写。
 */
watch(
  characters,
  (list) => {
    if (list.length > 0) {
      if (!selectedId.value || !list.some(c => c.id === selectedId.value)) {
        selectedId.value = list[0].id;
      }
    } else {
      selectedId.value = null;
    }
  },
  { immediate: true }
);

// 删除确认弹窗
const showConfirmModal = ref(false);
const deletingCharacterId = ref<string | null>(null);

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
  // P8-509 修复：try/catch 包裹删除操作，失败时提示用户
  try {
    if (deletingCharacterId.value) {
      await characterStore.deleteCharacter(deletingCharacterId.value);
      await characterStore.loadCharacterList();
    }
  } catch (e) {
    console.error('[CharacterSelectPopup] 删除角色失败:', e);
    errorHandler.report(e);
    useToast().show({ message: '删除角色失败，请重试', type: 'danger' });
  }
  // watcher 会根据最新列表修正 selectedId
  showConfirmModal.value = false;
  deletingCharacterId.value = null;
}

async function confirmSelect() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'enter_game' });
  // P9-037 修复：不再在此调用 selectCharacter，仅 emit 'select'，
  // 由 App.vue handleCharacterSelect 统一处理选择（含返回值校验与错误提示），避免双重初始化
  if (selectedId.value) {
    emit('select', selectedId.value);
  }
}

function onCreateClick() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'create_character_btn' });
  emit('create');
}
</script>

<style lang="less" scoped>
.select-body {
  .flex-col();
  gap: @spacing-3xl;
  padding: @spacing-md @spacing-xs;
}

.character-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
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
  text-align: center;
}

/* 进入游戏 - 金色 */
.action-btn {
  padding: @spacing-3xl 64px;
  border-radius: @radius-lg;
  font-size: @font-xl;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
  border: 2px solid;
}

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
