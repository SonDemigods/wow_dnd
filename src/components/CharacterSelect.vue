<template>
  <div class="character-select">
    <div v-if="showConfirmModal" class="confirm-modal-overlay" @click="cancelDelete">
      <div class="confirm-modal" @click.stop>
        <div class="confirm-icon">⚠️</div>
        <h3>确认删除</h3>
        <p>确定要删除这个角色吗？此操作无法撤销。</p>
        <div class="confirm-buttons">
          <button class="confirm-btn-cancel" @click="cancelDelete">取消</button>
          <button class="confirm-btn-delete" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>

    <div class="character-list">
      <div 
        v-for="char in characters" 
        :key="char.id"
        class="character-card"
        :class="{ selected: selectedId === char.id }"
        :style="{ '--class-color': gameDataStore.getClassColor(char.classId), '--faction-color': gameDataStore.getFactionColor(char.factionId) }"
        @click="selectCharacter(char.id)"
      >
        <div class="char-icon">{{ gameDataStore.getRaceIcon(char.raceId) }}</div>
        <div class="char-info">
          <div class="char-header">
            <span class="char-name">{{ char.name }}</span>
            <span class="char-level">Lv.{{ char.level }}</span>
          </div>
          <div class="char-details">
            <Tag type="faction" :text="gameDataStore.getFactionName(char.factionId)" :color="gameDataStore.getFactionColor(char.factionId)" />
            <Tag type="race" :text="gameDataStore.getRaceName(char.raceId)" />
            <Tag type="class" :text="gameDataStore.getClassName(char.classId)" :color="gameDataStore.getClassColor(char.classId)" />
          </div>
        </div>
        <div class="char-delete" @click.stop="deleteCharacter(char.id)">🗑️</div>
      </div>

      <button v-if="characters.length < 10" class="add-character" @click="$emit('create')">
        <div class="add-icon">+</div>
        <div class="add-text">创建角色</div>
      </button>
    </div>

    <div class="action-bar">
      <button 
        class="confirm-btn" 
        :disabled="!selectedId"
        @click="confirmSelect"
      >
        进入游戏
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色选择组件
 * @description 展示已有角色列表，支持选择角色进入游戏、创建新角色和删除角色（带二次确认）
 */

import { ref, onMounted } from 'vue';
import { characterService } from '@/modules/character';
import Tag from './common/Tag.vue';
import { useGameDataStore } from '@/modules/gameData';
import type { CharacterListItem } from '@/modules/character';

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'create'): void;
}>();

const gameDataStore = useGameDataStore();

const characters = ref<CharacterListItem[]>([]);
const selectedId = ref<string | null>(null);
const showConfirmModal = ref(false);
const deletingCharacterId = ref<string | null>(null);

async function loadData() {
  await gameDataStore.loadAllData();
}

async function loadCharacters() {
  characters.value = await characterService.getAllCharacters();
  if (characters.value.length > 0 && !selectedId.value) {
    selectedId.value = characters.value[0].id;
  }
}

function selectCharacter(id: string) {
  selectedId.value = id;
}

function deleteCharacter(id: string) {
  deletingCharacterId.value = id;
  showConfirmModal.value = true;
}

function cancelDelete() {
  showConfirmModal.value = false;
  deletingCharacterId.value = null;
}

async function confirmDelete() {
  if (deletingCharacterId.value) {
    await characterService.deleteCharacter(deletingCharacterId.value);
    await loadCharacters();
    if (selectedId.value === deletingCharacterId.value) {
      selectedId.value = characters.value.length > 0 ? characters.value[0].id : null;
    }
  }
  showConfirmModal.value = false;
  deletingCharacterId.value = null;
}

async function confirmSelect() {
  if (selectedId.value) {
    await characterService.selectCharacter(selectedId.value);
    emit('select', selectedId.value);
  }
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

<style scoped>
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
  padding: 14px 10px;
  background: rgba(13, 17, 23, 0.95);
  border: 2px solid #666666;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  overflow: hidden;
}

.character-card:hover {
  border-color: #888888;
  transform: translateY(-2px);
}

.character-card.selected {
  border-color: var(--class-color);
  background: rgba(255, 215, 0, 0.1);
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
  gap: 8px;
  margin-bottom: 4px;
}

.char-name {
  font-size: 14px;
  color: #f0f0f0;
  font-weight: bold;
}

.char-level {
  padding: 1px 6px;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  font-size: 11px;
  color: #ffd700;
  font-weight: bold;
}

.char-details {
  display: flex;
  gap: 4px;
  font-size: 11px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 68, 0, 0.2);
  border: 1px solid rgba(255, 68, 0, 0.3);
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.3s;
  font-size: 12px;
}

.char-delete:hover {
  opacity: 1;
  background: rgba(255, 68, 0, 0.4);
  border-color: #ff4400;
  transform: scale(1.1);
}

.add-character {
  width: 100%;
  min-width: 130px;
  height: 140px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 2px dashed #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.add-character:hover {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  transform: translateY(-2px);
}

.add-icon {
  font-size: 32px;
  color: #ffd700;
}

.add-text {
  color: #f0f0f0;
  font-size: 14px;
}

.action-bar {
  margin-top: 24px;
  text-align: center;
}

.confirm-btn {
  padding: 16px 64px;
  background: linear-gradient(135deg, #ffd700, #daa520);
  border: 2px solid #ffd700;
  border-radius: 8px;
  color: #1a1a2e;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
}

.confirm-btn:disabled {
  background: #4a4a4a;
  cursor: not-allowed;
  opacity: 0.5;
}

/* 确认弹窗 */
.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-modal {
  background: rgba(20, 25, 35, 0.98);
  border: 2px solid #ff4400;
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  text-align: center;
  animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.confirm-modal h3 {
  color: #ff4400;
  font-size: 20px;
  margin-bottom: 12px;
}

.confirm-modal p {
  color: #b0b0b0;
  font-size: 14px;
  margin-bottom: 20px;
}

.confirm-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.confirm-btn-cancel {
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #666;
  border-radius: 6px;
  color: #f0f0f0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.confirm-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #888;
}

.confirm-btn-delete {
  padding: 10px 24px;
  background: linear-gradient(135deg, #ff4400, #cc3300);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.confirm-btn-delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 68, 0, 0.4);
}
</style>