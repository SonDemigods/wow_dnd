<template>
  <div class="combat-view">
    <div v-if="!isInCombat" class="not-in-combat">
      <div class="no-combat-icon">⚔️</div>
      <p>当前没有战斗</p>
      <p class="hint">探索地图或遭遇敌人时会进入战斗</p>
    </div>

    <div v-else class="combat-arena">
      <div class="combat-header">
        <h2>战斗</h2>
        <div class="turn-indicator" :class="turn">
          {{ turn === 'player' ? '你的回合' : '敌人回合' }}
        </div>
      </div>

      <div class="battlefield">
        <div class="combat-side enemy-side">
          <div class="character-card" v-if="enemy">
            <div class="char-icon">👹</div>
            <div class="char-info">
              <div class="char-name">{{ enemy.name }}</div>
              <div class="char-level">Lv.{{ enemy.level }}</div>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar">
                <div class="hp-fill" :style="{ width: enemyHpPercent + '%' }"></div>
              </div>
              <div class="hp-text">{{ enemy.hp }} / {{ enemy.maxHp }}</div>
            </div>
          </div>
        </div>

        <div class="vs-text">VS</div>

        <div class="combat-side player-side">
          <div class="character-card player-card">
            <div class="char-icon">{{ getRaceIcon(character.race || 'human') }}</div>
            <div class="char-info">
              <div class="char-name">{{ character.name }}</div>
              <div class="char-level">Lv.{{ character.level }}</div>
            </div>
            <div class="resource-bars">
              <div class="hp-bar-container">
                <div class="hp-bar">
                  <div class="hp-fill" :style="{ width: playerHpPercent + '%' }"></div>
                </div>
                <div class="hp-text">{{ currentHp }} / {{ maxHp }}</div>
              </div>
              <div class="mp-bar-container">
                <div class="mp-bar">
                  <div class="mp-fill" :style="{ width: playerMpPercent + '%' }"></div>
                </div>
                <div class="mp-text">{{ currentMp }} / {{ maxMp }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="combat-log">
        <div class="log-header">战斗日志</div>
        <div class="log-content">
          <div 
            v-for="(log, index) in combatLog" 
            :key="index"
            :class="['log-item', log.actorType]"
          >
            {{ log.message }}
          </div>
        </div>
      </div>

      <div class="action-panel">
        <div class="action-row">
          <button 
            class="action-btn attack"
            :disabled="turn !== 'player'"
            @click="attack"
          >
            ⚔️ 普通攻�?          </button>
          <button 
            class="action-btn item"
            :disabled="turn !== 'player' || !hasConsumables"
            @click="useItem"
          >
            💊 使用物品
          </button>
          <button 
            class="action-btn flee"
            :disabled="turn !== 'player'"
            @click="flee"
          >
            🏃 逃跑
          </button>
        </div>
        <div class="skills-row">
          <button 
            v-for="skill in availableSkills" 
            :key="skill.id"
            class="skill-btn"
            :class="{ disabled: turn !== 'player' || currentMp < skill.mpCost }"
            :disabled="turn !== 'player' || currentMp < skill.mpCost"
            @click="castSkill(skill.id)"
          >
            <div class="skill-icon">{{ getSkillIcon(skill.type) }}</div>
            <div class="skill-name">{{ skill.name }}</div>
            <div class="skill-cost">{{ skill.mpCost }} MP</div>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showItemModal" class="item-modal">
      <div class="item-modal-content">
        <h3>选择物品</h3>
        <div class="item-list">
          <button 
            v-for="item in consumables" 
            :key="item.itemId"
            class="item-btn"
            @click="selectItem(item.itemId)"
          >
            <span class="item-icon">📦</span>
            <span class="item-name">{{ item.name }}</span>
            <span class="item-count">x{{ item.count }}</span>
          </button>
        </div>
        <button class="close-modal-btn" @click="showItemModal = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { combatService } from '@/modules/combat';
import { characterService } from '@/modules/character';
import { inventoryService } from '@/modules/inventory';
import { skillsService } from '@/modules/skill';
import type { CombatLog } from '@/modules/combat';

const isInCombat = ref(false);
const turn = ref<'player' | 'enemy'>('player');
const enemy = ref<any>(null);
const combatLog = ref<CombatLog[]>([]);
const showItemModal = ref(false);

const character = computed(() => characterService.getCharacterInfo());
const attributes = computed(() => characterService.getAttributes());
const currentHp = computed(() => character.value.currentHp || attributes.value.maxHp);
const maxHp = computed(() => attributes.value.maxHp);
const currentMp = computed(() => character.value.currentMp || attributes.value.maxMana);
const maxMp = computed(() => attributes.value.maxMana);

const playerHpPercent = computed(() => Math.round((currentHp.value / maxHp.value) * 100));
const playerMpPercent = computed(() => Math.round((currentMp.value / maxMp.value) * 100));

const enemyHpPercent = computed(() => {
  if (!enemy.value) return 0;
  return Math.round((enemy.value.hp / enemy.value.maxHp) * 100);
});

const consumables = computed(() => {
  const items = inventoryService.getInventory();
  return items.filter(item => item.category === 'consumable');
});

const hasConsumables = computed(() => consumables.value.length > 0);

const availableSkills = computed(() => {
  return skillsService.getLearnedSkills();
});

const raceIcons: Record<string, string> = {
  human: '👨', dwarf: '🧔', gnome: '👦', nightelf: '🌙', draenei: '👼',
  orc: '👹', undead: '💀', tauren: '🐂', troll: '👺', bloodelves: '🧝'
};

function getRaceIcon(race: string) {
  return raceIcons[race] || '👤';
}

const skillIcons: Record<string, string> = {
  physical_damage: '⚔️',
  magic_damage: '🔮',
  heal: '💚',
  buff: '🛡️',
  debuff: '🌀'
};

function getSkillIcon(type: string) {
  return skillIcons[type] || '⭐';
}

function loadCombatState() {
  isInCombat.value = combatService.isInCombat();
  turn.value = combatService.getTurn();
  enemy.value = combatService.getEnemy();
  combatLog.value = combatService.getCombatLog();
}

function attack() {
  const result = combatService.playerAction({ type: 'attack' });
  if (result.message) {
    alert(result.message);
  }
  loadCombatState();
}

function useItem() {
  if (consumables.value.length === 0) {
    alert('没有可用的消耗品');
    return;
  }
  showItemModal.value = true;
}

function selectItem(itemId: string) {
  const result = combatService.playerAction({ type: 'item', itemId });
  if (result.message) {
    alert(result.message);
  }
  showItemModal.value = false;
  loadCombatState();
}

function flee() {
  const result = combatService.playerAction({ type: 'flee' });
  if (result.message) {
    alert(result.message);
  }
  loadCombatState();
}

function castSkill(skillId: string) {
  const result = combatService.playerAction({ type: 'skill', skillId });
  if (result.message) {
    alert(result.message);
  }
  loadCombatState();
}

onMounted(() => {
  loadCombatState();
});
</script>

<style scoped>
.combat-view {
  max-width: 800px;
  margin: 0 auto;
}

.not-in-combat {
  text-align: center;
  padding: 60px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  border: 2px dashed #4a4a4a;
}

.no-combat-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.not-in-combat p {
  color: #888;
  font-size: 16px;
  margin-bottom: 8px;
}

.not-in-combat .hint {
  font-size: 14px;
  color: #666;
}

.combat-arena {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  padding: 24px;
  border: 2px solid #4a4a4a;
}

.combat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.combat-header h2 {
  font-size: 24px;
  color: #ff4444;
}

.turn-indicator {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
}

.turn-indicator.player {
  background: #4CAF50;
  color: #fff;
}

.turn-indicator.enemy {
  background: #ff4444;
  color: #fff;
}

.battlefield {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 24px;
}

.combat-side {
  flex: 1;
}

.character-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 2px solid #4a4a4a;
}

.player-card {
  border-color: #0078ff;
}

.char-icon {
  font-size: 48px;
}

.char-info {
  flex: 1;
}

.char-name {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 4px;
}

.char-level {
  font-size: 14px;
  color: #ffd700;
}

.resource-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hp-bar-container, .mp-bar-container {
  width: 150px;
}

.hp-bar, .mp-bar {
  height: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff4444, #ff0000);
  transition: width 0.3s;
}

.mp-fill {
  height: 100%;
  background: linear-gradient(90deg, #4444ff, #0000ff);
  transition: width 0.3s;
}

.hp-text, .mp-text {
  font-size: 12px;
  color: #fff;
  text-align: right;
  margin-top: 4px;
}

.vs-text {
  font-size: 32px;
  font-weight: bold;
  color: #ffd700;
}

.combat-log {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 24px;
}

.log-header {
  font-size: 14px;
  color: #888;
  margin-bottom: 8px;
}

.log-content {
  max-height: 100px;
  overflow-y: auto;
}

.log-item {
  font-size: 13px;
  padding: 4px 0;
}

.log-item.player {
  color: #4CAF50;
}

.log-item.enemy {
  color: #ff4444;
}

.log-item.system {
  color: #ffd700;
}

.action-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-row {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 16px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn.attack {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  color: #fff;
}

.action-btn.item {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.action-btn.flee {
  background: linear-gradient(135deg, #888, #666);
  color: #fff;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skills-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.skill-btn {
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.skill-btn:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: #0099ff;
}

.skill-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.skill-icon {
  font-size: 24px;
}

.skill-name {
  font-size: 12px;
  color: #fff;
}

.skill-cost {
  font-size: 11px;
  color: #4444ff;
}

.item-modal {
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

.item-modal-content {
  background: rgba(0, 0, 0, 0.9);
  padding: 24px;
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  max-width: 400px;
  width: 90%;
}

.item-modal-content h3 {
  font-size: 20px;
  color: #ffd700;
  margin-bottom: 16px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.item-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.item-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.item-icon {
  font-size: 20px;
}

.item-name {
  flex: 1;
  color: #fff;
}

.item-count {
  color: #888;
}

.close-modal-btn {
  margin-top: 16px;
  width: 100%;
  padding: 12px;
  background: #666;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
</style>