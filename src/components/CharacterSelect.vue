<template>
  <div class="character-select">
    <div class="select-header">
      <h2>选择角色</h2>
    </div>

    <div v-if="characters.length === 0" class="empty-state">
      <div class="empty-icon">👤</div>
      <p>暂无角色</p>
      <button class="create-btn" @click="$emit('create')">创建角色</button>
    </div>

    <div v-else class="character-list">
      <div 
        v-for="char in characters" 
        :key="char.id"
        :class="['character-card', { selected: selectedId === char.id }]"
        @click="selectCharacter(char.id)"
      >
        <div class="char-icon">{{ getRaceIcon(char.raceId) }}</div>
        <div class="char-info">
          <div class="char-name">{{ char.name }}</div>
          <div class="char-details">
            <span>{{ getFactionName(char.factionId) }}</span>
            <span>{{ getRaceName(char.raceId) }}</span>
            <span>{{ getClassName(char.classId) }}</span>
          </div>
          <div class="char-level">Lv.{{ char.level }}</div>
        </div>
        <div class="char-delete" @click.stop="deleteCharacter(char.id)">🗑️</div>
      </div>

      <button class="add-character" @click="$emit('create')">
        <div class="add-icon">+</div>
        <div class="add-text">创建角色</div>
      </button>
    </div>

    <div v-if="selectedId" class="action-bar">
      <button class="confirm-btn" @click="confirmSelect">进入游戏</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { characterService } from '@/modules/character.module';
import type { CharacterListItem } from '@/modules/character.module';

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'create'): void;
}>();

const characters = ref<CharacterListItem[]>([]);
const selectedId = ref<string | null>(null);

const factions = [
  { id: 'alliance', name: '联盟', icon: '⚖️' },
  { id: 'horde', name: '部落', icon: '⚔️' }
];

const races: Record<string, { id: string; name: string; icon: string }> = {
  human: { id: 'human', name: '人类', icon: '👨' },
  dwarf: { id: 'dwarf', name: '矮人', icon: '🧔' },
  gnome: { id: 'gnome', name: '侏儒', icon: '👦' },
  nightelf: { id: 'nightelf', name: '暗夜精灵', icon: '🌙' },
  draenei: { id: 'draenei', name: '德莱尼', icon: '✨' },
  orc: { id: 'orc', name: '兽人', icon: '👹' },
  undead: { id: 'undead', name: '亡灵', icon: '💀' },
  tauren: { id: 'tauren', name: '牛头人', icon: '🐂' },
  troll: { id: 'troll', name: '巨魔', icon: '👺' },
  bloodelves: { id: 'bloodelves', name: '血精灵', icon: '🧝' }
};

const classes: Record<string, { id: string; name: string }> = {
  warrior: { id: 'warrior', name: '战士' },
  mage: { id: 'mage', name: '法师' },
  priest: { id: 'priest', name: '牧师' },
  rogue: { id: 'rogue', name: '盗贼' },
  hunter: { id: 'hunter', name: '猎人' },
  shaman: { id: 'shaman', name: '萨满' },
  paladin: { id: 'paladin', name: '圣骑士' },
  warlock: { id: 'warlock', name: '术士' },
  druid: { id: 'druid', name: '德鲁伊' }
};

function getFactionName(id: string) {
  return factions.find(f => f.id === id)?.name || '';
}

function getRaceName(id: string) {
  return races[id]?.name || '';
}

function getRaceIcon(id: string) {
  return races[id]?.icon || '👤';
}

function getClassName(id: string) {
  return classes[id]?.name || '';
}

function loadCharacters() {
  characters.value = characterService.getAllCharacters();
  if (characters.value.length > 0 && !selectedId.value) {
    selectedId.value = characters.value[0].id;
  }
}

function selectCharacter(id: string) {
  selectedId.value = id;
}

function deleteCharacter(id: string) {
  if (confirm('确定删除该角色吗？')) {
    characterService.deleteCharacter(id);
    loadCharacters();
  }
}

function confirmSelect() {
  if (selectedId.value) {
    characterService.selectCharacter(selectedId.value);
    emit('select', selectedId.value);
  }
}

onMounted(() => {
  loadCharacters();
});
</script>

<style scoped>
.character-select {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.select-header {
  text-align: center;
  margin-bottom: 30px;
}

.select-header h2 {
  font-size: 28px;
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.empty-state {
  text-align: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state p {
  color: #888;
  font-size: 16px;
  margin-bottom: 20px;
}

.empty-state .create-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.character-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.character-card:hover {
  border-color: #666;
}

.character-card.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.char-icon {
  font-size: 48px;
}

.char-info {
  flex: 1;
}

.char-name {
  font-size: 20px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 8px;
}

.char-details {
  display: flex;
  gap: 8px;
  color: #aaa;
  font-size: 12px;
  margin-bottom: 4px;
}

.char-details span {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.char-level {
  color: #ffd700;
  font-size: 14px;
}

.char-delete {
  font-size: 20px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.char-delete:hover {
  opacity: 1;
}

.add-character {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px dashed #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.add-character:hover {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.add-icon {
  font-size: 32px;
  color: #ffd700;
}

.add-text {
  color: #fff;
  font-size: 16px;
}

.action-bar {
  margin-top: 20px;
  text-align: center;
}

.confirm-btn {
  padding: 16px 64px;
  background: linear-gradient(135deg, #4CAF50, #45a049);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.confirm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}
</style>