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
      @confirm="confirmExit"
      @cancel="cancelExit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CharacterSelect from './components/CharacterSelect.vue';
import CharacterCreate from './components/CharacterCreate.vue';
import GameMain from './components/GameMain.vue';
import ConfirmPopup from './components/ConfirmPopup.vue';
import { useCharacterStore } from './modules/character';

type GameState = 'character-select' | 'game';

const gameState = ref<GameState>('character-select');
const showCreateModal = ref(false);
const showExitConfirm = ref(false);
const characterSelectRef = ref<InstanceType<typeof CharacterSelect>>();

const characterStore = useCharacterStore();

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

function confirmExit() {
  showExitConfirm.value = false;
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