<template>
  <div id="app" class="app-container">
    <template v-if="!loading">
      <Transition :name="transitionName" mode="out-in">
        <div v-if="gameState === 'character-select'" key="select" class="character-select-screen">
          <div class="screen-header">
            <h1>战争艺术：地下城</h1>
            <p class="subtitle">Art of War: Dungeons</p>
          </div>
          <CharacterSelect 
            ref="characterSelectRef"
            @select="handleCharacterSelect" 
            @create="showCreateModal = true"
          />
        </div>

        <div v-else-if="gameState === 'game'" key="game" class="game-screen">
          <GameMain ref="gameMainRef" @exit="handleExit" />
        </div>

        <div v-else-if="gameState === 'admin'" key="admin" class="admin-screen">
          <AdminLayout @exit="handleAdminExit" />
        </div>
      </Transition>
    </template>

    <Transition name="modal">
      <div v-if="showCreateModal && !loading" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" @click="showCreateModal = false">×</button>
          <CharacterCreate @created="handleCharacterCreated" />
        </div>
      </div>
    </Transition>

    <ConfirmPopup 
      :visible="showExitConfirm"
      title="退出游戏"
      message="确定要退出游戏吗？"
      type="danger"
      @confirm="confirmExit"
      @cancel="cancelExit"
    />

    <Toast
      :visible="toast.visible.value"
      :message="toast.message.value"
      :type="toast.type.value"
      :icon="toast.icon.value"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 应用根组件
 * @description 管理游戏主界面状态（角色选择/游戏中），协调子组件间的交互，处理角色选择、创建和退出逻辑
 */

import { ref, onMounted } from 'vue';
import CharacterSelect from './components/CharacterSelect.vue';
import CharacterCreate from './components/CharacterCreate.vue';
import GameMain from './components/GameMain.vue';
import AdminLayout from './components/admin/AdminLayout.vue';
import ConfirmPopup from './components/common/ConfirmPopup.vue';
import Toast from './components/common/Toast.vue';
import { useCharacterStore } from './modules/character';
import { useBaseStore } from './modules/base';
import { useToast } from './composables/useToast';

/** 游戏界面状态：角色选择 | 游戏中 | 后台管理 */
type GameState = 'character-select' | 'game' | 'admin';

/** 当前游戏界面状态 */
const gameState = ref<GameState>('character-select');
/** 是否正在初始化，初始化完成前不渲染任何视图，避免页面闪烁 */
const loading = ref(true);
/** 是否显示角色创建弹窗 */
const showCreateModal = ref(false);
/** 是否显示退出确认弹窗 */
const showExitConfirm = ref(false);
/** 页面切换动画方向：进入游戏用 'view-forward'，退出用 'view-back' */
const transitionName = ref('view-forward');
/** 角色选择组件引用 */
const characterSelectRef = ref<InstanceType<typeof CharacterSelect>>();

const characterStore = useCharacterStore();
const baseStore = useBaseStore();
const toast = useToast();

onMounted(async () => {
  // 暴露 gameState 到全局，供控制台命令切换视图
  (window as any).__gameState = gameState;

  // 先初始化基础数据（阵营、种族、职业），再初始化角色模块
  await baseStore.initialize();
  await characterStore.initialize();
  // 检查是否有当前角色
  const currentCharacterId = characterStore.getCharacterId();
  if (currentCharacterId) {
    // 如果有当前角色ID，直接进入游戏
    gameState.value = 'game';
  }
  // 初始化完成，解除加载状态
  loading.value = false;
});

/**
 * 选择角色并进入游戏
 * @param {string} characterId - 选中的角色ID
 */
async function handleCharacterSelect(characterId: string) {
  console.log('选择角色:', characterId);
  transitionName.value = 'view-forward';
  await characterStore.selectCharacter(characterId);
  gameState.value = 'game';
}

/** 角色创建完成后关闭弹窗并刷新列表 */
function handleCharacterCreated() {
  showCreateModal.value = false;
  if (characterSelectRef.value?.refreshData) {
    characterSelectRef.value.refreshData();
  }
}

/** 点击退出按钮，显示确认弹窗 */
function handleExit() {
  showExitConfirm.value = true;
}

/** 确认退出，登出并返回角色选择界面 */
async function confirmExit() {
  showExitConfirm.value = false;
  transitionName.value = 'view-back';
  await characterStore.logout();
  gameState.value = 'character-select';
}

/** 取消退出操作 */
function cancelExit() {
  showExitConfirm.value = false;
}

/** 退出后台管理，返回角色选择界面 */
function handleAdminExit() {
  transitionName.value = 'view-back';
  gameState.value = 'character-select';
}
</script>

<style lang="less" scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, @primary-bg 0%, #16213e 50%, #0f3460 100%);
}

.character-select-screen {
  padding: 40px 20px;
  min-height: 100vh;
}

.screen-header {
  text-align: center;
  margin-bottom: 40px;
}

.screen-header h1 {
  font-size: 36px;
  color: @accent-color;
  text-shadow: @text-shadow-title;
  margin-bottom: @spacing-md;
}

.subtitle {
  color: @color-dodge;
  font-size: @font-md;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: @overlay-heavy;
  .flex-center();
  z-index: @z-popup;
}

.modal-content {
  background: rgba(0, 0, 0, 0.95);
  border-radius: @radius-xl;
  border: @border-card;
  max-width: 600px;
  width: 90%;
  height: 90vh;
  max-height: 90vh;
  overflow: hidden;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: @white-10;
  border: none;
  border-radius: 50%;
  color: @popup-text-color;
  font-size: @font-4xl;
  cursor: pointer;
  .flex-center();
}

.modal-close:hover {
  background: @white-20;
}

.game-screen {
  min-height: 100vh;
  position: relative;
}

.exit-btn {
  position: fixed;
  bottom: @spacing-4xl;
  right: @spacing-4xl;
  padding: @spacing-xl @spacing-5xl;
  background: @white-10;
  border: @border-card;
  border-radius: @radius-lg;
  color: @popup-text-color;
  font-size: @font-lg;
  cursor: pointer;
  transition: all @transition-normal;
  z-index: @z-overlay;
}

.exit-btn:hover {
  background: @white-20;
  border-color: @accent-color;
}

/* ===== 角色创建弹窗进出场动画 ===== */
.modal-enter-active {
  animation: fadeIn 0.2s ease;
}
.modal-enter-active .modal-content {
  animation: scaleIn 0.25s ease;
}
.modal-leave-active {
  animation: fadeIn 0.15s ease reverse;
}

/* ===== 页面切换动画 ===== */
.view-forward-enter-active {
  animation: view-enter 0.3s ease;
}
.view-forward-leave-active {
  animation: view-leave 0.25s ease;
}
.view-back-enter-active {
  animation: view-enter 0.3s ease;
}
.view-back-leave-active {
  animation: view-leave 0.25s ease;
}

.admin-screen {
  min-height: 100vh;
}
</style>