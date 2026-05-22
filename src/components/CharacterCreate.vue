<template>
  <div class="character-create">
    <div class="create-header">
      <h2>创建角色</h2>
    </div>
    
    <div class="create-form">
      <div class="form-group">
        <label>角色名称</label>
        <input 
          v-model="name" 
          type="text" 
          placeholder="请输入角色名称"
          maxlength="20"
        />
      </div>

      <div class="form-group">
        <label>选择阵营</label>
        <div class="faction-selector">
          <button 
            v-for="faction in factions" 
            :key="faction.id"
            :class="['faction-btn', { active: selectedFaction === faction.id }]"
            @click="selectedFaction = faction.id"
          >
            <div class="faction-icon">{{ faction.icon }}</div>
            <div class="faction-name">{{ faction.name }}</div>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>选择种族</label>
        <div class="race-grid">
          <button 
            v-for="race in availableRaces" 
            :key="race.id"
            :class="['race-btn', { active: selectedRace === race.id }]"
            @click="selectedRace = race.id"
          >
            <div class="race-icon">{{ race.icon }}</div>
            <div class="race-name">{{ race.name }}</div>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>选择职业</label>
        <div class="class-grid">
          <button 
            v-for="cls in availableClasses" 
            :key="cls.id"
            :class="['class-btn', { active: selectedClass === cls.id }]"
            @click="selectedClass = cls.id"
          >
            <div class="class-icon">{{ cls.icon }}</div>
            <div class="class-name">{{ cls.name }}</div>
          </button>
        </div>
      </div>

      <div class="preview-section">
        <h3>角色预览</h3>
        <div class="preview-card">
          <div class="preview-icon">👤</div>
          <div class="preview-info">
            <div class="preview-name">{{ name || '未命名' }}</div>
            <div class="preview-details">
              <span>{{ getFactionName(selectedFaction) }}</span>
              <span>{{ getRaceName(selectedRace) }}</span>
              <span>{{ getClassName(selectedClass) }}</span>
            </div>
          </div>
        </div>
        <div class="attribute-preview">
          <div class="attr-item">力量: {{ previewAttributes.str }}</div>
          <div class="attr-item">敏捷: {{ previewAttributes.dex }}</div>
          <div class="attr-item">智力: {{ previewAttributes.int }}</div>
          <div class="attr-item">耐力: {{ previewAttributes.con }}</div>
          <div class="attr-item">精神: {{ previewAttributes.wis }}</div>
          <div class="attr-item">魅力: {{ previewAttributes.cha }}</div>
        </div>
      </div>

      <button 
        class="create-btn"
        :disabled="!canCreate"
        @click="createCharacter"
      >
        创建角色
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { characterService } from '@/modules/character.module';

const name = ref('');
const selectedFaction = ref('alliance');
const selectedRace = ref('human');
const selectedClass = ref('warrior');

const emit = defineEmits<{
  (e: 'created'): void;
}>();

const factions = [
  { id: 'alliance', name: '联盟', icon: '⚖️' },
  { id: 'horde', name: '部落', icon: '⚔️' }
];

const races: Record<string, { id: string; name: string; icon: string; faction: string }[]> = {
  alliance: [
    { id: 'human', name: '人类', icon: '👨', faction: 'alliance' },
    { id: 'dwarf', name: '矮人', icon: '🧔', faction: 'alliance' },
    { id: 'gnome', name: '侏儒', icon: '👦', faction: 'alliance' },
    { id: 'nightelf', name: '暗夜精灵', icon: '🌙', faction: 'alliance' },
    { id: 'draenei', name: '德莱尼', icon: '✨', faction: 'alliance' }
  ],
  horde: [
    { id: 'orc', name: '兽人', icon: '👹', faction: 'horde' },
    { id: 'undead', name: '亡灵', icon: '💀', faction: 'horde' },
    { id: 'tauren', name: '牛头人', icon: '🐂', faction: 'horde' },
    { id: 'troll', name: '巨魔', icon: '👺', faction: 'horde' },
    { id: 'bloodelves', name: '血精灵', icon: '🧝', faction: 'horde' }
  ]
};

const classes = [
  { id: 'warrior', name: '战士', icon: '⚔️' },
  { id: 'mage', name: '法师', icon: '🔮' },
  { id: 'priest', name: '牧师', icon: '📿' },
  { id: 'rogue', name: '盗贼', icon: '🗡️' },
  { id: 'hunter', name: '猎人', icon: '🏹' },
  { id: 'shaman', name: '萨满', icon: '⚡' },
  { id: 'paladin', name: '圣骑士', icon: '🛡️' },
  { id: 'warlock', name: '术士', icon: '☠️' },
  { id: 'druid', name: '德鲁伊', icon: '🌿' }
];

const availableRaces = computed(() => races[selectedFaction.value]);
const availableClasses = computed(() => classes);

const canCreate = computed(() => {
  return name.value.trim() && selectedRace.value && selectedClass.value;
});

const previewAttributes = computed(() => {
  const baseAttrs = { str: 10, dex: 10, int: 10, con: 10, wis: 10, cha: 10 };
  
  const raceBonuses: Record<string, Record<string, number>> = {
    human: { str: 1, cha: 1 },
    dwarf: { con: 2, wis: 1 },
    gnome: { int: 2, dex: 1 },
    nightelf: { dex: 2, wis: 1 },
    draenei: { int: 1, wis: 2 },
    orc: { str: 2, con: 1 },
    undead: { int: 2, cha: 1 },
    tauren: { str: 1, con: 2 },
    troll: { str: 1, dex: 2 },
    bloodelves: { int: 2, cha: 1 }
  };

  const classBonuses: Record<string, Record<string, number>> = {
    warrior: { str: 2, con: 1, int: -1 },
    mage: { int: 3, con: -1, str: -1, cha: -1 },
    priest: { wis: 3, str: -1, con: -1 },
    rogue: { dex: 3, con: -1, str: -1 },
    hunter: { dex: 2, con: 1, int: -1 },
    shaman: { str: 1, int: 1, wis: 1, con: -1 },
    paladin: { str: 1, con: 1, wis: 1, int: -1 },
    warlock: { int: 2, cha: 1, con: -1 },
    druid: { wis: 2, dex: 1, str: -1 }
  };

  const result = { ...baseAttrs };
  const raceBonus = raceBonuses[selectedRace.value] || {};
  const classBonus = classBonuses[selectedClass.value] || {};

  for (const key of Object.keys(result)) {
    result[key as keyof typeof result] += (raceBonus[key] || 0) + (classBonus[key] || 0);
  }

  return result;
});

function getFactionName(id: string) {
  return factions.find(f => f.id === id)?.name || '';
}

function getRaceName(id: string) {
  return races.alliance.find(r => r.id === id)?.name || races.horde.find(r => r.id === id)?.name || '';
}

function getClassName(id: string) {
  return classes.find(c => c.id === id)?.name || '';
}

function createCharacter() {
  if (!canCreate.value) return;

  characterService.createCharacter(
    name.value,
    selectedFaction.value as any,
    selectedRace.value as any,
    selectedClass.value as any
  );

  emit('created');
}
</script>

<style scoped>
.character-create {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.create-header {
  text-align: center;
  margin-bottom: 30px;
}

.create-header h2 {
  font-size: 28px;
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.create-form {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  padding: 24px;
  border: 2px solid #4a4a4a;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 12px;
  color: #fff;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 16px;
  box-sizing: border-box;
}

.form-group input::placeholder {
  color: #888;
}

.faction-selector {
  display: flex;
  gap: 16px;
}

.faction-btn {
  flex: 1;
  padding: 16px;
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s;
}

.faction-btn:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.faction-btn.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
}

.faction-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.faction-name {
  color: #fff;
  font-size: 14px;
}

.race-grid, .class-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.race-btn, .class-btn {
  padding: 12px 8px;
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s;
}

.race-btn:hover, .class-btn:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.race-btn.active, .class-btn.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
}

.race-icon, .class-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.race-name, .class-name {
  color: #fff;
  font-size: 12px;
}

.preview-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #4a4a4a;
}

.preview-section h3 {
  color: #ffd700;
  margin-bottom: 16px;
}

.preview-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.preview-icon {
  font-size: 48px;
}

.preview-info {
  flex: 1;
}

.preview-name {
  font-size: 20px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 8px;
}

.preview-details {
  display: flex;
  gap: 12px;
  color: #aaa;
  font-size: 14px;
}

.preview-details span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.attribute-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.attr-item {
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  color: #ccc;
  font-size: 14px;
  text-align: center;
}

.create-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.create-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.create-btn:disabled {
  background: #666;
  cursor: not-allowed;
  color: #999;
}
</style>