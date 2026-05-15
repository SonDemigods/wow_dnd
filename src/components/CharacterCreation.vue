<template>
  <div class="character-creation">
    <div class="creation-header">
      <h2 class="creation-title">创建你的角色</h2>
      <div class="steps-indicator">
        <div 
          v-for="step in 4" 
          :key="step"
          :class="['step', { 
            active: currentStep === step, 
            completed: currentStep > step 
          }]"
        >
          <span class="step-number">{{ step }}</span>
          <span class="step-label">{{ getStepLabel(step) }}</span>
        </div>
      </div>
    </div>

    <div class="creation-content">
      <div v-if="currentStep === 1" class="create-step active">
        <div class="faction-grid">
          <div 
            v-for="(faction, key) in FACTIONS" 
            :key="key"
            class="faction-card"
            :class="{ selected: selectedFaction === key }"
            :style="{
              '--faction-color': faction.color,
              '--faction-bg': `${faction.color}10`,
              '--faction-hover': `${faction.color}30`,
              '--faction-selected': `${faction.color}60`
            }"
            @click="selectFaction(key as 'alliance' | 'horde')"
          >
            <div class="faction-icon">{{ faction.icon }}</div>
            <div class="faction-name">{{ faction.name }}</div>
            <div class="faction-desc">{{ faction.description }}</div>
          </div>
        </div>
      </div>

      <div v-if="currentStep === 2" class="create-step active">
        <div class="race-grid">
          <div 
            v-for="(race, key) in availableRaces" 
            :key="key"
            class="race-card"
            :class="{ selected: selectedRace === key }"
            :style="{
              '--faction-color': FACTIONS[race.faction]?.color || '#666',
              '--faction-bg': `${FACTIONS[race.faction]?.color || '#666'}10`,
              '--faction-hover': `${FACTIONS[race.faction]?.color || '#666'}30`,
              '--faction-selected': `${FACTIONS[race.faction]?.color || '#666'}60`
            }"
            @click="selectRace(key)"
          >
            <div class="race-icon">{{ race.icon }}</div>
            <div class="race-name">{{ race.name }}</div>
            <div class="race-desc">{{ race.description }}</div>
            <div class="race-bonus">{{ formatBonus(race.bonus) }}</div>
          </div>
        </div>
      </div>

      <div v-if="currentStep === 3" class="create-step active">
        <div class="class-grid">
          <div 
            v-for="(cls, key) in availableClasses" 
            :key="key"
            class="class-card"
            :class="{ selected: selectedClass === key }"
            :style="{
              '--class-color': cls.color,
              '--class-bg': `${cls.color}10`,
              '--class-hover': `${cls.color}30`,
              '--class-selected': `${cls.color}60`
            }"
            @click="selectClass(key)"
          >
            <div class="class-icon">{{ cls.icon }}</div>
            <div class="class-name">{{ cls.name }}</div>
            <div class="class-desc">{{ cls.description }}</div>
          </div>
        </div>
      </div>

      <div v-if="currentStep === 4" class="create-step active">
        <div class="name-input-section">
          <div class="selected-summary" v-if="selectedRace && selectedClass">
            <div class="summary-item">
              <span class="summary-icon">{{ FACTIONS[selectedFaction]?.icon }}</span>
              <span class="summary-text">{{ FACTIONS[selectedFaction]?.name }}</span>
            </div>
            <span class="summary-separator">·</span>
            <div class="summary-item">
              <span class="summary-icon">{{ RACES[selectedRace]?.icon }}</span>
              <span class="summary-text">{{ RACES[selectedRace]?.name }}</span>
            </div>
            <span class="summary-separator">·</span>
            <div class="summary-item">
              <span class="summary-icon">{{ CLASSES[selectedClass]?.icon }}</span>
              <span class="summary-text">{{ CLASSES[selectedClass]?.name }}</span>
            </div>
          </div>
          
          <input 
            ref="nameInput"
            v-model="characterName"
            type="text"
            class="name-input"
            placeholder="输入你的角色名..."
            maxlength="20"
            @keyup.enter="createCharacter"
          />
          
          <div class="stats-preview" v-if="selectedRace && selectedClass">
            <h4 class="preview-title">属性预览</h4>
            <div class="preview-stats">
              <div v-for="(value, stat) in previewStats" :key="stat" class="preview-stat">
                <span class="stat-label">{{ STAT_NAMES[stat as keyof typeof STAT_NAMES] }}</span>
                <span class="stat-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="creation-footer">
      <div class="footer-button-wrapper">
        <button 
          v-if="currentStep > 1"
          class="btn btn-secondary"
          @click="prevStep"
        >
          上一步
        </button>
        <div 
          v-else
          class="btn btn-secondary"
          style="visibility: hidden; pointer-events: none;"
        >
          上一步
        </div>
      </div>
      <div class="footer-button-wrapper">
        <button 
          class="btn btn-primary"
          @click="nextStep"
          :disabled="!canProceed"
        >
          {{ currentStep === 4 ? '创建角色' : '下一步' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useGameStore } from '@/stores/game'
import { FACTIONS, RACES, CLASSES } from '@/data'
import { STAT_NAMES } from '@/data/constants'

const gameStore = useGameStore()

const currentStep = ref(1)
const selectedFaction = ref<'alliance' | 'horde' | null>(null)
const selectedRace = ref<string | null>(null)
const selectedClass = ref<string | null>(null)
const characterName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

const availableRaces = computed(() => {
  if (!selectedFaction.value) return {}
  return Object.fromEntries(
    Object.entries(RACES).filter(([_, race]) => 
      race.faction === selectedFaction.value || race.faction === 'neutral'
    )
  )
})

const availableClasses = computed(() => {
  if (!selectedRace.value) return {}
  const race = RACES[selectedRace.value]
  if (!race) return {}
  
  return Object.fromEntries(
    Object.entries(CLASSES).filter(([_, cls]) => 
      cls.factions.includes(race.faction)
    )
  )
})

const previewStats = computed(() => {
  const baseStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  if (selectedRace.value && RACES[selectedRace.value]) {
    const race = RACES[selectedRace.value]
    for (const [stat, bonus] of Object.entries(race.bonus)) {
      if (stat in baseStats) {
        baseStats[stat as keyof typeof baseStats] += bonus
      }
    }
  }
  return baseStats
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return selectedFaction.value !== null
    case 2:
      return selectedRace.value !== null
    case 3:
      return selectedClass.value !== null
    case 4:
      return characterName.value.trim().length > 0
    default:
      return false
  }
})

const getStepLabel = (step: number) => {
  const labels = ['阵营', '种族', '职业', '名字']
  return labels[step - 1]
}

const formatBonus = (bonus: Record<string, number>) => {
  return Object.entries(bonus).map(([stat, val]) => {
    const names = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }
    return `+${val} ${names[stat as keyof typeof names]}`
  }).join(' / ')
}

const selectFaction = (faction: 'alliance' | 'horde') => {
  selectedFaction.value = faction
  selectedRace.value = null
  selectedClass.value = null
}

const selectRace = (race: string) => {
  selectedRace.value = race
}

const selectClass = (cls: string) => {
  selectedClass.value = cls
}

const nextStep = () => {
  if (!canProceed.value) return

  if (currentStep.value === 4) {
    createCharacter()
  } else {
    currentStep.value++
    if (currentStep.value === 4) {
      nextTick(() => {
        nameInput.value?.focus()
      })
    }
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const createCharacter = () => {
  if (!selectedFaction.value || !selectedRace.value || !selectedClass.value) return
  if (!characterName.value.trim()) return

  gameStore.setCharacterName(characterName.value.trim())
  gameStore.selectFaction(selectedFaction.value)
  gameStore.selectRace(selectedRace.value)
  gameStore.selectClass(selectedClass.value)
  gameStore.finishCharacterCreation()
}

onMounted(() => {
  if (gameStore.character.faction) {
    selectedFaction.value = gameStore.character.faction as 'alliance' | 'horde'
  }
  if (gameStore.character.race) {
    selectedRace.value = gameStore.character.race
  }
  if (gameStore.character.class) {
    selectedClass.value = gameStore.character.class
  }
})
</script>

<style scoped lang="less">
@import '@/styles/variables.less';

.btn {
  font-family: @font-display;
  font-size: 1rem;
  font-weight: 600;
  padding: 14px 32px;
  border: 2px solid @border-light;
  border-radius: @radius-md;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  position: relative;
  overflow: hidden;
  min-height: 48px;
}

.btn-primary {
  background: linear-gradient(180deg, @gold-dark 0%, #5a4a2a 100%);
  color: @bg-darkest;
  border-color: @gold-primary;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, @gold-primary 0%, @gold-dark 100%);
  box-shadow: @shadow-glow;
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: @bg-panel;
  color: @text-secondary;
  border-color: @border-dark;
}

.btn-secondary:hover:not(:disabled) {
  background: @bg-panel-hover;
  border-color: @border-light;
  color: @text-primary;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.character-creation {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, @bg-darkest 0%, @bg-dark 50%, @bg-panel 100%);
  overflow: hidden;
}

.creation-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  text-align: center;
  padding: 16px 20px;
  background: rgba(10, 10, 15, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(74, 74, 90, 0.5);
}

.creation-title {
  font-family: @font-display;
  font-size: 1.5rem;
  color: @text-primary;
  margin-bottom: 16px;
}

.steps-indicator {
  display: flex;
  justify-content: center;
  gap: 32px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0.3;
  transition: all 0.3s;
  filter: grayscale(50%);
}

.step.active {
  opacity: 1;
  filter: grayscale(0%);
}

.step.completed {
  opacity: 0.8;
  filter: grayscale(0%);
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: @bg-panel;
  border: 2px solid @border-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: @font-display;
  font-weight: 700;
  color: @text-muted;
  transition: all 0.3s;
}

.step.active .step-number,
.step.completed .step-number {
  background: @gold-primary;
  border-color: @gold-primary;
  color: @bg-darkest;
  box-shadow: 0 0 15px rgba(201, 162, 39, 0.4);
}

.step-label {
  font-size: 0.8rem;
  color: @text-muted;
}

.step.active .step-label {
  color: @text-primary;
}

.creation-content {
  flex: 1;
  overflow-y: auto;
  padding: 140px 20px 120px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.create-step {
  display: none;
}

.create-step.active {
  display: block;
  animation: fadeIn 0.3s ease;
  padding-top: 40px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.faction-grid,
.race-grid,
.class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.faction-card,
.race-card,
.class-card {
  background: rgba(255, 255, 255, 0.02);
  border: 2px solid rgba(58, 58, 74, 0.5);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  position: relative;
  opacity: 0.6;
  filter: brightness(0.8);
}

.faction-card:hover,
.race-card:hover,
.class-card:hover {
  transform: translateY(-3px);
  opacity: 0.9;
  filter: brightness(1);
}

.faction-card {
  border-color: color-mix(in srgb, var(--faction-color, #666), transparent 60%);
  background: var(--faction-bg, rgba(255, 255, 255, 0.02));
}

.faction-card:hover {
  border-color: color-mix(in srgb, var(--faction-color, #666), transparent 30%);
  background: var(--faction-hover, rgba(255, 255, 255, 0.05));
}

.faction-card.selected {
  border: 3px solid var(--faction-color, #666);
  background: var(--faction-selected, rgba(255, 255, 255, 0.1));
  box-shadow: 0 0 30px color-mix(in srgb, var(--faction-color, #666), transparent 50%),
              inset 0 0 20px color-mix(in srgb, var(--faction-color, #666), transparent 80%);
}

.race-card {
  border-color: color-mix(in srgb, var(--faction-color, #666), transparent 60%);
  background: var(--faction-bg, rgba(255, 255, 255, 0.02));
}

.race-card:hover {
  border-color: color-mix(in srgb, var(--faction-color, #666), transparent 30%);
  background: var(--faction-hover, rgba(255, 255, 255, 0.05));
}

.race-card.selected {
  border: 3px solid var(--faction-color, #666);
  background: var(--faction-selected, rgba(255, 255, 255, 0.1));
  box-shadow: 0 0 30px color-mix(in srgb, var(--faction-color, #666), transparent 50%),
              inset 0 0 20px color-mix(in srgb, var(--faction-color, #666), transparent 80%);
}

.class-card {
  border-color: color-mix(in srgb, var(--class-color, #666), transparent 60%);
  background: var(--class-bg, rgba(255, 255, 255, 0.02));
}

.class-card:hover {
  border-color: color-mix(in srgb, var(--class-color, #666), transparent 30%);
  background: var(--class-hover, rgba(255, 255, 255, 0.05));
}

.class-card.selected {
  border: 3px solid var(--class-color, #666);
  background: var(--class-selected, rgba(255, 255, 255, 0.1));
  box-shadow: 0 0 30px color-mix(in srgb, var(--class-color, #666), transparent 50%),
              inset 0 0 20px color-mix(in srgb, var(--class-color, #666), transparent 80%);
}

.faction-card:hover,
.race-card:hover,
.class-card:hover {
  transform: translateY(-3px);
  opacity: 0.9;
  filter: brightness(1);
}

.faction-card.selected,
.race-card.selected,
.class-card.selected {
  opacity: 1;
  filter: brightness(1.1);
  transform: translateY(-4px) scale(1.02);
  position: relative;
  z-index: 10;
}

.faction-icon,
.race-icon,
.class-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  transition: transform 0.3s;
}

.faction-card:hover .faction-icon,
.race-card:hover .race-icon,
.class-card:hover .class-icon {
  transform: scale(1.1);
}

.faction-card.selected .faction-icon,
.race-card.selected .race-icon,
.class-card.selected .class-icon {
  transform: scale(1.15);
  filter: drop-shadow(0 0 8px currentColor);
}

.faction-name,
.race-name,
.class-name {
  font-family: @font-display;
  font-size: 1.2rem;
  color: @text-primary;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.faction-card.selected .faction-name,
.race-card.selected .race-name,
.class-card.selected .class-name {
  font-weight: 700;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.faction-desc,
.race-desc,
.class-desc {
  font-size: 0.9rem;
  color: @text-muted;
  margin-bottom: 12px;
  transition: color 0.3s;
}

.faction-card.selected .faction-desc,
.race-card.selected .race-desc,
.class-card.selected .class-desc {
  color: @text-secondary;
}

.race-bonus {
  font-size: 0.85rem;
  color: @gold-light;
  transition: all 0.3s;
}

.race-card.selected .race-bonus {
  color: #fff;
  text-shadow: 0 0 5px rgba(201, 162, 39, 0.5);
  font-weight: 600;
}

.name-input-section {
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
}

.selected-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-icon {
  font-size: 1.5rem;
}

.summary-text {
  font-family: @font-display;
  color: @text-primary;
  font-weight: 600;
}

.summary-separator {
  color: @text-muted;
}

.name-input {
  width: 100%;
  padding: 16px 20px;
  font-size: 1.2rem;
  background: @bg-input;
  border: 2px solid @border-dark;
  border-radius: 8px;
  color: @text-primary;
  font-family: @font-display;
  text-align: center;
  margin-bottom: 32px;
  transition: border-color 0.3s;
}

.name-input:focus {
  outline: none;
  border-color: @gold-primary;
}

.name-input::placeholder {
  color: @text-muted;
}

.stats-preview {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 20px;
}

.preview-title {
  font-family: @font-display;
  font-size: 1.1rem;
  color: @text-primary;
  margin-bottom: 16px;
}

.preview-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.preview-stat {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.stat-label {
  font-size: 0.9rem;
  color: @text-muted;
}

.stat-value {
  font-family: @font-display;
  font-weight: 700;
  color: @gold-light;
}

.creation-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(10, 10, 15, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(74, 74, 90, 0.5);
}

.creation-footer .btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.footer-button-wrapper {
  flex: 1;
  display: flex;
}

.footer-button-wrapper .btn {
  width: 100%;
}

@media (max-width: 768px) {
  .creation-header {
    padding: 12px 16px;
  }

  .creation-title {
    font-size: 1.2rem;
    margin-bottom: 12px;
  }

  .steps-indicator {
    gap: 16px;
  }

  .step-number {
    width: 30px;
    height: 30px;
    font-size: 0.85rem;
  }

  .step-label {
    font-size: 0.7rem;
  }

  .creation-content {
    padding: 120px 16px 100px;
  }

  .create-step.active {
    padding-top: 30px;
  }

  .faction-grid,
  .race-grid,
  .class-grid {
    grid-template-columns: 1fr;
  }

  .preview-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .creation-footer {
    padding: 12px 16px;
  }

  .btn {
    padding: 12px 24px;
    font-size: 0.9rem;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .steps-indicator {
    gap: 24px;
  }
}
</style>
