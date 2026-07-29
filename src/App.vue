<template>
  <div id="app" class="app-container">
    <div v-if="loading" class="app-loading-screen">
      <div class="loading-text">加载中...</div>
    </div>
    <template v-else>
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

import { ref, defineAsyncComponent, h, onMounted, onUnmounted, type Ref } from 'vue';
import ConfirmPopup from './components/common/ConfirmPopup.vue';
import Toast from './components/common/Toast.vue';
import { useCharacterStore } from './modules/character';
import { useBaseStore } from './modules/base';
import { useToast } from './composables/useToast';
import { eventBus, GameEvents } from './modules/bus';
// P3-127 修复：移除 dataInitializer 导入，数据初始化统一由 main.ts 在 App 挂载前完成

/**
 * 异步组件加载占位（B1/B2：首屏 bundle 优化）
 *
 * 大型视图组件（CharacterSelect/GameMain/AdminLayout/CharacterCreate）改为按需懒加载，
 * 首屏仅包含角色选择所需代码，进入游戏/管理后再动态加载对应 chunk。
 */
const AsyncLoading = () => h('div', { class: 'async-loading-placeholder' }, '加载中...');
const AsyncError = () => h('div', { class: 'async-loading-placeholder async-error' }, '加载失败，请刷新页面');

const CharacterSelect = defineAsyncComponent({
  loader: () => import('./components/CharacterSelect.vue'),
  loadingComponent: AsyncLoading,
  errorComponent: AsyncError,
  delay: 200,
  timeout: 10000,
});
const CharacterCreate = defineAsyncComponent({
  loader: () => import('./components/CharacterCreate.vue'),
  loadingComponent: AsyncLoading,
  errorComponent: AsyncError,
  delay: 200,
  timeout: 10000,
});
const GameMain = defineAsyncComponent({
  loader: () => import('./components/GameMain.vue'),
  loadingComponent: AsyncLoading,
  errorComponent: AsyncError,
  delay: 200,
  timeout: 10000,
});
const AdminLayout = defineAsyncComponent({
  loader: () => import('./components/admin/AdminLayout.vue'),
  loadingComponent: AsyncLoading,
  errorComponent: AsyncError,
  delay: 200,
  timeout: 10000,
});

/** 游戏界面状态：角色选择 | 游戏中 | 后台管理 */
type GameState = 'character-select' | 'game' | 'admin';

// 扩展 Window 接口，供控制台命令访问 gameState（DEV 调试用）
declare global {
  interface Window {
    __gameState: Ref<GameState>;
  }
}

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
  // P2-70 修复：仅在开发环境暴露 gameState 到全局，供控制台命令切换视图
  if (import.meta.env.DEV) {
    window.__gameState = gameState;
  }

  // P3-127 修复：移除对 dataInitializer.initializeData 的重复调用，
  // 数据初始化已由 main.ts 在 App 挂载前完成，此处直接初始化各模块 Store。

  // 先初始化基础数据（阵营、种族、职业），再初始化角色模块
  // 注意：characterStore.initialize 依赖 baseStore 的 factions/races/classes 数据，必须串行
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

// P2-42 修复：监听 INVENTORY_FULL 事件，统一显示背包已满 toast 提示
// 替代 usePlayerAction 等 Composable 中直接调用 useToast 的副作用
const onInventoryFull = (payload: { itemName: string; actualAmount: number; expectedAmount: number }) => {
  toast.show({
    message: `背包已满，${payload.itemName} 仅获得 ${payload.actualAmount}/${payload.expectedAmount}`,
    type: 'warning',
    duration: 3000
  });
};
eventBus.on(GameEvents.INVENTORY_FULL, onInventoryFull);

onUnmounted(() => {
  eventBus.off(GameEvents.INVENTORY_FULL, onInventoryFull);
});

/**
 * 选择角色并进入游戏
 * @param {string} characterId - 选中的角色ID
 */
async function handleCharacterSelect(characterId: string) {
  if (import.meta.env.DEV) console.log('选择角色:', characterId);
  transitionName.value = 'view-forward';
  // P1-26 修复：检查 selectCharacter 返回值，失败时提示用户并保持在角色选择界面
  const success = await characterStore.selectCharacter(characterId);
  if (!success) {
    toast.show({
      message: '角色加载失败，请重试',
      type: 'danger',
      duration: 3000
    });
    return;
  }
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

.app-loading-screen {
  min-height: 100vh;
  .flex-center();
  color: @accent-color;
}

.loading-text {
  font-size: @font-xl;
  letter-spacing: 2px;
  animation: fadeIn 1s ease infinite alternate;
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

.async-loading-placeholder {
  min-height: 100vh;
  .flex-center();
  color: @accent-color;
  font-size: @font-xl;
  letter-spacing: 2px;
}

.async-loading-placeholder.async-error {
  color: #ff6b6b;
}
</style>