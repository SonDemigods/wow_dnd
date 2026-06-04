<template>
  <div id="app" class="app-container">
    <div v-if="gameState === 'character-select'" class="character-select-screen">
      <div class="screen-header">
        <h1>魔兽世界：地下城</h1>
        <p class="subtitle">World of Warcraft: Dungeons & Dragons</p>
      </div>
      <CharacterSelect 
        ref="characterSelectRef"
        @select="handleCharacterSelect" 
        @create="showCreateModal = true"
      />
    </div>

    <div v-else-if="gameState === 'game'" class="game-screen">
      <GameMain ref="gameMainRef" @exit="handleExit" />
    </div>

    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal-content">
        <button class="modal-close" @click="showCreateModal = false">×</button>
        <CharacterCreate @created="handleCharacterCreated" />
      </div>
    </div>

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
import { ref, onMounted } from 'vue';
import CharacterSelect from './components/CharacterSelect.vue';
import CharacterCreate from './components/CharacterCreate.vue';
import GameMain from './components/GameMain.vue';
import ConfirmPopup from './components/common/ConfirmPopup.vue';
import Toast from './components/common/Toast.vue';
import { useCharacterStore } from './modules/character';
import { useToast } from './composables/useToast';

type GameState = 'character-select' | 'game';

const gameState = ref<GameState>('character-select');
const showCreateModal = ref(false);
const showExitConfirm = ref(false);
const characterSelectRef = ref<InstanceType<typeof CharacterSelect>>();

const characterStore = useCharacterStore();
const toast = useToast();

onMounted(async () => {
  // 初始化角色服务，从数据库加载数据
  await characterStore.initialize();
  // 检查是否有当前角色
  const currentCharacterId = characterStore.getCurrentCharacterId();
  if (currentCharacterId) {
    // 如果有当前角色ID，直接进入游戏
    gameState.value = 'game';
  }
});

async function handleCharacterSelect(characterId: string) {
  console.log('Selected character:', characterId);
  await characterStore.selectCharacter(characterId);
  gameState.value = 'game';
}

function handleCharacterCreated() {
  showCreateModal.value = false;
  if (characterSelectRef.value?.refreshData) {
    characterSelectRef.value.refreshData();
  }
}

function handleExit() {
  showExitConfirm.value = true;
}

async function confirmExit() {
  showExitConfirm.value = false;
  await characterStore.logout();
  gameState.value = 'character-select';
}

function cancelExit() {
  showExitConfirm.value = false;
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
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
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 8px;
}

.subtitle {
  color: #888;
  font-size: 14px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: rgba(0, 0, 0, 0.95);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
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
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.popup-content {
  background: rgba(13, 17, 23, 0.98);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.game-screen {
  min-height: 100vh;
  position: relative;
}

.exit-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 100;
}

.exit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #ffd700;
}
</style>