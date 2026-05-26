<template>
  <div class="character-select">
    <div v-if="characters.length === 0" class="empty-state">
      <div class="empty-icon">👤</div>
      <p>暂无角色</p>
      <button class="create-btn" @click="$emit('create')">创建角色</button>
    </div>

    <div v-else class="character-list">
      <div 
        v-for="char in characters" 
        :key="char.id"
        class="character-card"
        :class="{ selected: selectedId === char.id }"
        :style="{ '--class-color': getClassColor(char.classId), '--faction-color': getFactionColor(char.factionId), '--profession-color': getClassColor(char.classId) }"
        @click="selectCharacter(char.id)"
      >
        <div class="char-icon">{{ getRaceIcon(char.raceId) }}</div>
        <div class="char-info">
          <div class="char-name">{{ char.name }}</div>
          <div class="char-details">
            <span class="race-tag">{{ getRaceName(char.raceId) }}</span>
            <span class="class-tag">{{ getClassName(char.classId) }}</span>
            <span class="faction-tag">{{ getFactionName(char.factionId) }}</span>
          </div>
          <div class="char-level">Lv.{{ char.level }}</div>
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
import { ref, onMounted } from 'vue';
import { characterService } from '@/modules/character';
import type { CharacterListItem } from '@/modules/character';

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'create'): void;
}>();

const characters = ref<CharacterListItem[]>([]);
const selectedId = ref<string | null>(null);

const factions: Record<string, { name: string; icon: string; color: string }> = {
  alliance: { name: '联盟', icon: '⚖️', color: '#0078ff' },
  horde: { name: '部落', icon: '⚔️', color: '#ff4400' },
  neutral: { name: '中立', icon: '🐼', color: '#4CAF50' }
};

const races: Record<string, { id: string; name: string; icon: string }> = {
  human: { id: 'human', name: '人类', icon: '👨' },
  dwarf: { id: 'dwarf', name: '矮人', icon: '🧔' },
  gnome: { id: 'gnome', name: '侏儒', icon: '👦' },
  nightelf: { id: 'nightelf', name: '暗夜精灵', icon: '🌙' },
  draenei: { id: 'draenei', name: '德莱尼', icon: '🧙' },
  orc: { id: 'orc', name: '兽人', icon: '👹' },
  undead: { id: 'undead', name: '亡灵', icon: '💀' },
  tauren: { id: 'tauren', name: '牛头人', icon: '🐂' },
  troll: { id: 'troll', name: '巨魔', icon: '👺' },
  bloodelves: { id: 'bloodelves', name: '血精灵', icon: '🧝' },
  pandaren: { id: 'pandaren', name: '熊猫人', icon: '🐼' }
};

const classes: Record<string, { id: string; name: string; color: string }> = {
  warrior: { id: 'warrior', name: '战士', color: '#C79C6E' },
  mage: { id: 'mage', name: '法师', color: '#69CCF0' },
  paladin: { id: 'paladin', name: '圣骑士', color: '#F58CBA' },
  hunter: { id: 'hunter', name: '猎人', color: '#ABD473' },
  rogue: { id: 'rogue', name: '潜行者', color: '#FFF569' },
  warlock: { id: 'warlock', name: '术士', color: '#9482C9' },
  druid: { id: 'druid', name: '德鲁伊', color: '#FF7D0A' },
  priest: { id: 'priest', name: '牧师', color: '#FFFFFF' },
  shaman: { id: 'shaman', name: '萨满', color: '#0070DE' },
  deathknight: { id: 'deathknight', name: '死亡骑士', color: '#C41F3B' },
  monk: { id: 'monk', name: '武僧', color: '#00FF96' },
  demonhunter: { id: 'demonhunter', name: '恶魔猎手', color: '#A330C9' }
};

function getFactionName(id: string) {
  return factions[id]?.name || '';
}

function getFactionColor(id: string) {
  return factions[id]?.color || '#9d9d9d';
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

function getClassColor(id: string) {
  return classes[id]?.color || '#9d9d9d';
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

onMounted(async () => {
  await loadCharacters();
});

defineExpose({
  loadCharacters
});
</script>

<style scoped>
.character-select {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 60px 24px;
  background: rgba(13, 17, 23, 0.95);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
}

.empty-icon {
  font-size: 72px;
  margin-bottom: 20px;
}

.empty-state p {
  color: #8b8b8b;
  font-size: 16px;
  margin-bottom: 24px;
}

.empty-state .create-btn {
  padding: 16px 48px;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.empty-state .create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.character-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.character-card {
  width: 100%;
  height: 120px;
  padding: 12px;
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

.char-name {
  font-size: 14px;
  color: #f0f0f0;
  font-weight: bold;
  margin-bottom: 2px;
}

.char-details {
  display: flex;
  gap: 6px;
  color: #8b8b8b;
  font-size: 12px;
  justify-content: center;
}

.char-details span {
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
}

.race-tag {
  background: rgba(255, 255, 255, 0.2);
}

.class-tag {
  background: var(--profession-color);
}

.faction-tag {
  background: var(--faction-color);
  font-weight: bold;
}

.char-level {
  color: #ffd700;
  font-size: 13px;
  margin-top: 4px;
}

.char-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.char-delete:hover {
  opacity: 1;
}

.add-character {
  width: 150px;
  height: 120px;
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
  font-size: 36px;
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
  background: linear-gradient(135deg, #4CAF50, #45a049);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.confirm-btn:disabled {
  background: #4a4a4a;
  cursor: not-allowed;
  opacity: 0.5;
}
</style>