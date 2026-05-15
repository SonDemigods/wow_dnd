<template>
  <div class="game-interface">
    <header class="game-header">
      <div class="header-location">
        <span class="location-icon">{{ currentLocationData?.icon || '🏰' }}</span>
        <div class="location-info">
          <span class="location-name">{{ currentLocationData?.displayName || '未知区域' }}</span>
          <span class="location-level" v-if="currentLocationData">
            等级 {{ currentLocationData.levelRange[0] }} - {{ currentLocationData.levelRange[1] }}
          </span>
        </div>
      </div>
      <div class="header-gold">
        <span class="gold-icon">💰</span>
        <span class="gold-value">{{ character.gold }}</span>
      </div>
    </header>

    <div class="game-main">
      <aside class="sidebar-left">
        <div class="character-card">
          <div class="character-avatar">{{ characterAvatar }}</div>
          <div class="character-info">
            <h3 class="character-name">{{ character.name }}</h3>
            <p class="character-class">{{ characterRace }} {{ characterClass }} · Lv{{ character.level }}</p>
          </div>
          
          <div class="character-bars">
            <div class="bar-container">
              <span class="bar-label">❤️ HP</span>
              <div class="bar hp-bar">
                <div class="bar-fill" :style="{ width: `${(character.hp / character.maxHp) * 100}%` }"></div>
              </div>
              <span class="bar-value">{{ character.hp }} / {{ character.maxHp }}</span>
            </div>
            <div class="bar-container">
              <span class="bar-label">💧 MP</span>
              <div class="bar mana-bar">
                <div class="bar-fill" :style="{ width: `${(character.mana / character.maxMana) * 100}%` }"></div>
              </div>
              <span class="bar-value">{{ character.mana }} / {{ character.maxMana }}</span>
            </div>
            <div class="bar-container">
              <span class="bar-label">✨ EXP</span>
              <div class="bar exp-bar">
                <div class="bar-fill" :style="{ width: `${(character.exp / character.expToNextLevel) * 100}%` }"></div>
              </div>
              <span class="bar-value">{{ character.exp }} / {{ character.expToNextLevel }}</span>
            </div>
          </div>
          
          <div class="character-stats">
            <div v-for="(value, stat) in character.stats" :key="stat" class="stat-item">
              <span class="stat-name">{{ STAT_NAMES[stat as keyof typeof STAT_NAMES] }}</span>
              <span class="stat-value">{{ value }}</span>
            </div>
          </div>

          <div class="character-attributes">
            <div v-for="(value, attr) in attributes" :key="attr" class="attr-item">
              <span class="attr-icon">{{ getAttributeIcon(attr) }}</span>
              <span class="attr-value">{{ getAttributeDisplay(attr, value) }}</span>
            </div>
          </div>

          <button class="btn btn-secondary btn-full" @click="rest" :disabled="character.hp >= character.maxHp && character.mana >= character.maxMana">
            🛏️ 休息恢复
          </button>
        </div>

        <div class="inventory-panel">
          <h3 class="panel-title">🎒 背包</h3>
          <div class="inventory-grid">
            <div 
              v-for="(item, index) in 8" 
              :key="index"
              class="inventory-slot"
              :class="{ filled: inventory[index] }"
              @click="inventory[index] ? showItemDetail(index) : null"
            >
              <span v-if="inventory[index]" class="item-icon">{{ inventory[index].icon }}</span>
              <span v-if="inventory[index]?.quantity > 1" class="item-quantity">{{ inventory[index].quantity }}</span>
            </div>
          </div>
        </div>

        <div class="abilities-panel">
          <h3 class="panel-title">✨ 技能</h3>
          <div class="abilities-grid">
            <div 
              v-for="(ability, index) in classAbilities" 
              :key="index"
              class="ability-slot"
              :class="{ disabled: character.mana < ability.manaCost }"
              @click="useAbilityOutsideCombat(index)"
            >
              <span class="ability-icon">{{ ability.icon }}</span>
              <span class="ability-name">{{ ability.name }}</span>
              <span class="ability-cost">💧{{ ability.manaCost }}</span>
            </div>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <div class="tab-navigation">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            class="tab-button"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <div class="tab-content">
          <div v-if="activeTab === 'world'" class="world-tab">
            <div class="world-map">
              <div 
                v-for="(location, key) in WORLD_LOCATIONS" 
                :key="key"
                class="map-location"
                :class="getLocationClass(key)"
                :style="{ left: `${location.mapX}%`, top: `${location.mapY}%` }"
                @click="selectLocation(key)"
              >
                <span class="loc-icon">{{ location.icon }}</span>
                <div class="location-tooltip">
                  <div class="tooltip-title">{{ location.displayName }}</div>
                  <div class="tooltip-level">等级 {{ location.levelRange[0] }} - {{ location.levelRange[1] }}</div>
                </div>
              </div>
            </div>

            <div class="location-info" v-if="currentLocationData">
              <h3>{{ currentLocationData.displayName }}</h3>
              <p class="location-description">{{ currentLocationData.description }}</p>
              
              <div class="location-enemies">
                <h4>👹 此区域的敌人：</h4>
                <div class="enemy-list">
                  <div 
                    v-for="enemyKey in currentLocationData.enemies" 
                    :key="enemyKey"
                    class="enemy-item"
                    @click="startCombat(enemyKey)"
                  >
                    <span class="enemy-icon">{{ ENEMIES[enemyKey]?.icon }}</span>
                    <span class="enemy-name">{{ ENEMIES[enemyKey]?.name }}</span>
                    <span class="enemy-danger" :class="ENEMIES[enemyKey]?.dangerLevel">
                      {{ ENEMIES[enemyKey]?.dangerLevel }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'quests'" class="quests-tab">
            <div class="quest-list">
              <div 
                v-for="(quest, key) in QUESTS" 
                :key="key"
                v-if="quest.locationKey === currentLocation"
                class="quest-item"
              >
                <div class="quest-header">
                  <h4 class="quest-title">📜 {{ quest.name }}</h4>
                </div>
                <p class="quest-description">{{ quest.description }}</p>
                <div class="quest-objectives">
                  <div v-for="(obj, idx) in quest.objectives" :key="idx" class="objective">
                    <span class="objective-icon">⚔️</span>
                    <span class="objective-text">
                      击杀 {{ ENEMIES[obj.enemyKey]?.name }} 
                      ({{ getQuestProgress(key, obj.enemyKey) }} / {{ obj.target }})
                    </span>
                  </div>
                </div>
                <div class="quest-rewards">
                  <span class="reward-item">💰 {{ quest.reward.gold }} 金币</span>
                  <span class="reward-item">✨ {{ quest.reward.xp }} 经验</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'log'" class="log-tab">
            <div class="adventure-log">
              <div 
                v-for="entry in adventureLog.slice().reverse()" 
                :key="entry.id"
                class="log-entry"
                :class="entry.type"
              >
                <span class="log-icon">{{ entry.icon }}</span>
                <span class="log-text">{{ entry.message }}</span>
              </div>
              <div v-if="adventureLog.length === 0" class="log-empty">
                <p>开始你的冒险吧！</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <div v-if="combatActive" class="combat-overlay">
      <div class="combat-container">
        <div class="combat-header">
          <h2>⚔️ 战斗！</h2>
        </div>
        
        <div class="combat-arena">
          <div class="combatant player">
            <div class="combatant-avatar">{{ characterAvatar }}</div>
            <div class="combatant-name">{{ character.name }}</div>
            <div class="combatant-bars">
              <div class="bar-container small">
                <span class="bar-label">HP</span>
                <div class="bar hp-bar">
                  <div class="bar-fill" :style="{ width: `${(character.hp / character.maxHp) * 100}%` }"></div>
                </div>
                <span class="bar-value">{{ character.hp }}</span>
              </div>
            </div>
          </div>

          <div class="vs-divider">VS</div>

          <div class="combatant enemy" v-if="currentEnemy">
            <div class="combatant-avatar">{{ ENEMIES[currentEnemy]?.icon }}</div>
            <div class="combatant-name">{{ ENEMIES[currentEnemy]?.name }}</div>
            <div class="combatant-bars">
              <div class="bar-container small">
                <span class="bar-label">HP</span>
                <div class="bar hp-bar enemy">
                  <div class="bar-fill" :style="{ width: `${(enemyHp / enemyMaxHp) * 100}%` }"></div>
                </div>
                <span class="bar-value">{{ enemyHp }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="combat-abilities">
          <h3>技能</h3>
          <div class="abilities-grid combat">
            <button 
              v-for="(ability, index) in classAbilities" 
              :key="index"
              class="ability-button"
              :disabled="!playerTurn || combatEnded || character.mana < ability.manaCost"
              @click="useAbilityInCombat(index)"
            >
              <span class="ability-icon">{{ ability.icon }}</span>
              <span class="ability-name">{{ ability.name }}</span>
              <span class="ability-cost">💧{{ ability.manaCost }}</span>
            </button>
          </div>
        </div>

        <div class="combat-actions">
          <button 
            class="btn btn-primary"
            :disabled="!playerTurn || combatEnded"
            @click="playerAttack"
          >
            ⚔️ 普通攻击
          </button>
          <button 
            class="btn btn-secondary"
            :disabled="!playerTurn || combatEnded"
            @click="tryFlee"
          >
            🏃 尝试逃跑
          </button>
        </div>

        <div class="combat-log">
          <h3>📜 战斗记录</h3>
          <div class="log-content">
            <div 
              v-for="(entry, idx) in combatLog" 
              :key="idx"
              class="combat-log-entry"
              :class="entry.type"
            >
              {{ entry.message }}
            </div>
          </div>
        </div>

        <div v-if="combatEnded" class="combat-result">
          <div class="result-content">
            <h3 :class="combatResult">
              {{ combatResult === 'victory' ? '🎉 胜利！' : combatResult === 'defeat' ? '💀 战败...' : '🏃 成功逃跑！' }}
            </h3>
            <p v-if="combatResult === 'victory'">
              获得了 {{ ENEMIES[currentEnemy!]?.xp }} 经验和 {{ ENEMIES[currentEnemy!]?.gold }} 金币！
            </p>
            <button class="btn btn-primary" @click="endCombatManual">继续</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showItemPopup" class="item-popup-overlay" @click="closeItemPopup">
      <div class="item-popup" @click.stop>
        <div class="popup-header">
          <span class="popup-icon">{{ selectedItem?.icon }}</span>
          <div class="popup-info">
            <h4 class="popup-name">{{ selectedItem?.name }}</h4>
            <span class="popup-type">{{ ITEM_TYPES[selectedItem?.type as keyof typeof ITEM_TYPES]?.name }}</span>
          </div>
        </div>
        <p class="popup-description">{{ selectedItem?.description }}</p>
        <div class="popup-effects" v-if="selectedItem">
          <div v-if="selectedItem.healing" class="effect heal">❤️ 恢复 {{ selectedItem.healing }} HP</div>
          <div v-if="selectedItem.manaRestore" class="effect mana">💧 恢复 {{ selectedItem.manaRestore }} MP</div>
        </div>
        <div class="popup-actions">
          <button 
            v-if="selectedItem && ITEM_TYPES[selectedItem.type as keyof typeof ITEM_TYPES]?.usable"
            class="btn btn-primary"
            @click="useSelectedItem"
          >
            使用
          </button>
          <button class="btn btn-danger" @click="discardSelectedItem">丢弃</button>
          <button class="btn btn-secondary" @click="closeItemPopup">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useCharacterStore } from '@/modules/character'
import { useInventoryStore } from '@/modules/inventory'
import { useCombatStore } from '@/modules/combat'
import { useAdventureLogStore } from '@/modules/adventureLog'
import { questService } from '@/modules/quests'
import { WORLD_LOCATIONS, ENEMIES, QUESTS, RACES, CLASSES, ITEM_TYPES } from '@/data'
import { STAT_NAMES } from '@/data/constants'
import type { LootItemData } from '@/types'

const gameStore = useGameStore()
const characterStore = useCharacterStore()
const inventoryStore = useInventoryStore()
const combatStore = useCombatStore()

const character = computed(() => ({
  name: characterStore.name,
  race: characterStore.race,
  class: characterStore.charClass,
  level: characterStore.level,
  exp: characterStore.exp,
  expToNextLevel: characterStore.expToNextLevel,
  hp: characterStore.currentHp,
  maxHp: characterStore.maxHp,
  mana: characterStore.currentMp,
  maxMana: characterStore.maxMp,
  stats: characterStore.stats,
  gold: characterStore.gold
}))

const inventory = computed(() => inventoryStore.items)
const attributes = computed(() => characterStore.attributes)
const classAbilities = computed(() => [
  { name: '猛击', icon: '⚔️', manaCost: 10, type: 'attack' as const, damage: [1, 8], healing: undefined },
  { name: '治疗', icon: '💚', manaCost: 15, type: 'heal' as const, healing: [20, 30], damage: undefined }
])
const currentLocation = ref('stormwind')
const currentLocationData = computed(() => WORLD_LOCATIONS[currentLocation.value])
const adventureLog = computed(() => useAdventureLogStore().logs)
const combatActive = computed(() => combatStore.isInCombat)
const currentEnemy = computed(() => combatStore.currentEnemy)
const enemyHp = computed(() => {
  if (combatStore.currentEnemy) {
    return combatStore.currentEnemy.currentHp || 0
  }
  return 0
})
const enemyMaxHp = computed(() => {
  if (combatStore.currentEnemy) {
    return combatStore.currentEnemy.hp || 0
  }
  return 0
})
const playerTurn = computed(() => combatStore.turn === 'player')
const combatEnded = computed(() => combatStore.state === 'ended')
const combatLog = computed(() => combatStore.combatLog)

const activeTab = ref('world')
const showItemPopup = ref(false)
const selectedItemIndex = ref<number | null>(null)
const selectedItem = ref<LootItemData | null>(null)
const combatResult = ref<'victory' | 'defeat' | 'fled' | null>(null)

const tabs = [
  { id: 'world', icon: '🗺️', label: '世界地图' },
  { id: 'quests', icon: '📜', label: '任务' },
  { id: 'log', icon: '📖', label: '日志' },
]

const characterAvatar = computed(() => {
  if (character.value.class && CLASSES[character.value.class]) {
    return CLASSES[character.value.class].icon
  }
  if (character.value.race && RACES[character.value.race]) {
    return RACES[character.value.race].icon
  }
  return '🧙'
})

const characterRace = computed(() => {
  return character.value.race ? RACES[character.value.race]?.name : ''
})

const characterClass = computed(() => {
  return character.value.class ? CLASSES[character.value.class]?.name : ''
})

const getLocationClass = (key: string) => {
  const location = WORLD_LOCATIONS[key]
  const isCurrent = key === currentLocation.value
  const isAvailable = character.value.level >= location.levelRange[0]
  const isRecommended = character.value.level >= location.levelRange[0] && character.value.level <= location.levelRange[1]

  if (isCurrent) return 'current'
  if (!isAvailable) return 'locked'
  if (isRecommended) return 'recommended'
  return 'available'
}

const getAttributeIcon = (attr: string) => {
  const icons: Record<string, string> = {
    physicalAttack: '⚔️',
    physicalDefense: '🛡️',
    magicAttack: '🔮',
    magicDefense: '✨',
    critChance: '💥',
    dodgeChance: '💨',
  }
  return icons[attr] || '❓'
}

const getAttributeDisplay = (attr: string, value: number) => {
  if (attr === 'critChance' || attr === 'dodgeChance') {
    return `${value}%`
  }
  return value.toString()
}

const getQuestProgress = (questKey: string, enemyKey: string) => {
  const questState = questService.getQuestState(questKey)
  if (questState?.progress?.[enemyKey]) {
    return questState.progress[enemyKey].current
  }
  return 0
}

const selectLocation = (key: string) => {
  const location = WORLD_LOCATIONS[key]
  if (!location) return
  if (character.value.level < location.levelRange[0]) {
    gameStore.showNotification(`等级不足！需要等级 ${location.levelRange[0]} 才能探索此区域。`)
    return
  }
  currentLocation.value = key
  gameStore.addToAdventureLog(`来到了 ${location.displayName}`, 'info')
}

const startCombat = (enemyKey: string) => {
  const enemy = ENEMIES[enemyKey]
  if (!enemy) return
  
  combatResult.value = null
  combatStore.startCombat(enemy)
}

const playerAttack = () => {
  combatStore.playerAttack()
}

const useAbilityInCombat = (index: number) => {
  const ability = classAbilities.value[index]
  if (!ability) return
  
  if (character.value.mana < ability.manaCost) {
    gameStore.showNotification('法力不足！')
    return
  }
  
  characterStore.addMp(-ability.manaCost)
  
  if (ability.type === 'heal' && ability.healing) {
    const healAmount = Math.floor(Math.random() * (ability.healing[1] - ability.healing[0] + 1)) + ability.healing[0]
    characterStore.addHp(healAmount)
    combatStore.addLog(`${ability.icon} ${ability.name} 恢复了 ${healAmount} 点生命值！`, 'heal')
  } else if (ability.type === 'attack' && ability.damage) {
    const damage = Math.floor(Math.random() * (ability.damage[1] - ability.damage[0] + 1)) + ability.damage[0]
    // 攻击逻辑需要在战斗模块中处理
    combatStore.addLog(`${ability.icon} ${ability.name} 造成了 ${damage} 点伤害！`, 'magic')
  }
  
  combatStore.turn = 'enemy'
  setTimeout(() => combatStore.enemyAttack(), 800)
}

const tryFlee = () => {
  combatStore.flee()
}

const endCombatManual = () => {
  combatStore.endCombat('fled')
}

const rest = () => {
  if (character.value.hp >= character.value.maxHp && character.value.mana >= character.value.maxMana) {
    gameStore.showNotification('你已经完全恢复了！')
    return
  }
  
  const attrs = attributes.value
  characterStore.setHp(attrs.maxHp)
  characterStore.setMp(attrs.maxMana)
  gameStore.showNotification('休息完成，生命值和法力值已恢复！')
  gameStore.saveGame()
}

const showItemDetail = (index: number) => {
  selectedItemIndex.value = index
  selectedItem.value = inventory.value[index] || null
  showItemPopup.value = true
}

const closeItemPopup = () => {
  showItemPopup.value = false
  selectedItemIndex.value = null
  selectedItem.value = null
}

const useSelectedItem = () => {
  if (selectedItemIndex.value !== null) {
    inventoryStore.useItem(selectedItemIndex.value)
    closeItemPopup()
  }
}

const discardSelectedItem = () => {
  if (selectedItemIndex.value !== null) {
    inventoryStore.removeItem(selectedItemIndex.value)
    closeItemPopup()
  }
}

const useAbilityOutsideCombat = (index: number) => {
  const ability = classAbilities.value[index]
  if (!ability) return
  
  if (ability.type === 'heal') {
    if (character.value.mana < ability.manaCost) {
      gameStore.showNotification('法力不足！')
      return
    }
    if (character.value.hp >= character.value.maxHp) {
      gameStore.showNotification('生命值已满！')
      return
    }
    
    characterStore.addMp(-ability.manaCost)
    const healAmount = Math.floor(Math.random() * ((ability.healing?.[1] || 0) - (ability.healing?.[0] || 0) + 1)) + (ability.healing?.[0] || 0)
    const actualHeal = Math.min(healAmount + attributes.value.healBonus, character.value.maxHp - character.value.hp)
    characterStore.addHp(actualHeal)
    
    gameStore.showNotification(`${ability.icon} 使用 ${ability.name}，恢复了 ${actualHeal} 点生命值！`)
    gameStore.addToAdventureLog(`使用了 ${ability.name}`, 'info')
    gameStore.saveGame()
  } else {
    gameStore.showNotification('需要在战斗中才能使用此技能！')
  }
}

onMounted(() => {
  gameStore.continueGame()
})
</script>

<style scoped lang="less">
@import '@/styles/variables.less';

.game-interface {
  min-height: 100vh;
  background: @bg-darkest;
  display: flex;
  flex-direction: column;
}

.game-header {
  background: @bg-dark;
  border-bottom: 2px solid @border-dark;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-location {
  display: flex;
  align-items: center;
  gap: 12px;
}

.location-icon {
  font-size: 1.5rem;
}

.location-info {
  display: flex;
  flex-direction: column;
}

.location-name {
  font-family: @font-display;
  font-size: 1.1rem;
  color: @text-primary;
  font-weight: 600;
}

.location-level {
  font-size: 0.85rem;
  color: @text-muted;
}

.header-gold {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: @bg-panel;
  border-radius: 8px;
}

.gold-icon {
  font-size: 1.2rem;
}

.gold-value {
  font-family: @font-display;
  font-weight: 700;
  color: @gold-light;
  font-size: 1.1rem;
}

.game-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar-left {
  width: 320px;
  background: @bg-dark;
  border-right: 2px solid @border-dark;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.character-card,
.inventory-panel,
.abilities-panel {
  background: @bg-panel;
  border-radius: 12px;
  padding: 16px;
}

.character-avatar {
  width: 80px;
  height: 80px;
  font-size: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(@gold-primary, 0.2), rgba(@gold-primary, 0.05));
  border-radius: 50%;
  margin: 0 auto 12px;
}

.character-info {
  text-align: center;
  margin-bottom: 16px;
}

.character-name {
  font-family: @font-display;
  font-size: 1.3rem;
  color: @text-primary;
  margin: 0 0 4px;
}

.character-class {
  font-size: 0.9rem;
  color: @text-muted;
  margin: 0;
}

.character-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.bar-container {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
}

.bar-container.small {
  gap: 6px;
}

.bar-label {
  font-size: 0.85rem;
  color: @text-muted;
  min-width: 40px;
}

.bar {
  height: 20px;
  background: @bg-input;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.hp-bar .bar-fill {
  background: linear-gradient(90deg, #ff4444, #ff6666);
}

.mana-bar .bar-fill {
  background: linear-gradient(90deg, #4444ff, #6666ff);
}

.exp-bar .bar-fill {
  background: linear-gradient(90deg, @gold-dark, @gold-primary);
}

.enemy.hp-bar .bar-fill {
  background: linear-gradient(90deg, #8b0000, #ff0000);
}

.bar-value {
  font-size: 0.85rem;
  color: @text-secondary;
  min-width: 60px;
  text-align: right;
}

.character-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.stat-name {
  font-size: 0.75rem;
  color: @text-muted;
  margin-bottom: 4px;
}

.stat-value {
  font-family: @font-display;
  font-weight: 700;
  color: @text-primary;
  font-size: 1.1rem;
}

.character-attributes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.attr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  gap: 4px;
}

.attr-icon {
  font-size: 1.2rem;
}

.attr-value {
  font-family: @font-display;
  font-weight: 600;
  color: @text-secondary;
  font-size: 0.9rem;
}

.btn-full {
  width: 100%;
}

.panel-title {
  font-family: @font-display;
  font-size: 1rem;
  color: @text-primary;
  margin: 0 0 12px;
}

.inventory-grid,
.abilities-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.abilities-grid.combat {
  grid-template-columns: repeat(2, 1fr);
}

.inventory-slot {
  aspect-ratio: 1;
  background: @bg-input;
  border: 2px solid @border-dark;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: border-color 0.2s;
}

.inventory-slot.filled:hover {
  border-color: @gold-primary;
}

.item-icon {
  font-size: 1.8rem;
}

.item-quantity {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-family: @font-display;
  font-size: 0.75rem;
  color: @text-primary;
  font-weight: 700;
}

.ability-slot {
  background: @bg-input;
  border: 2px solid @border-dark;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.ability-slot:hover:not(.disabled) {
  border-color: @gold-primary;
  background: rgba(@gold-primary, 0.1);
}

.ability-slot.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ability-slot .ability-icon {
  font-size: 1.5rem;
}

.ability-slot .ability-name {
  font-size: 0.75rem;
  color: @text-secondary;
  text-align: center;
}

.ability-slot .ability-cost {
  font-size: 0.7rem;
  color: @text-muted;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-navigation {
  display: flex;
  background: @bg-dark;
  border-bottom: 2px solid @border-dark;
  padding: 0 16px;
  gap: 4px;
}

.tab-button {
  background: transparent;
  border: none;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: @text-muted;
  cursor: pointer;
  font-family: @font-display;
  font-size: 0.95rem;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: @text-secondary;
  background: rgba(255, 255, 255, 0.03);
}

.tab-button.active {
  color: @gold-light;
  border-bottom-color: @gold-primary;
  background: rgba(@gold-primary, 0.05);
}

.tab-icon {
  font-size: 1.2rem;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.world-tab {
  display: flex;
  gap: 24px;
}

.world-map {
  flex: 2;
  position: relative;
  height: 500px;
  background: linear-gradient(135deg, #0a1628, #1a2a4a);
  border-radius: 12px;
  overflow: hidden;
}

.map-location {
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: transform 0.2s;
  z-index: 10;
}

.map-location:hover {
  transform: translate(-50%, -50%) scale(1.2);
}

.map-location .loc-icon {
  font-size: 2rem;
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.map-location.current .loc-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

.map-location.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.map-location.recommended {
  filter: drop-shadow(0 0 10px rgba(100, 255, 100, 0.5));
}

@keyframes pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.15); }
}

.location-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: @bg-panel;
  border: 2px solid @border-dark;
  border-radius: 8px;
  padding: 8px 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  margin-bottom: 8px;
}

.map-location:hover .location-tooltip {
  opacity: 1;
}

.tooltip-title {
  font-family: @font-display;
  color: @text-primary;
  font-weight: 600;
  margin-bottom: 4px;
}

.tooltip-level {
  font-size: 0.8rem;
  color: @text-muted;
}

.location-info {
  flex: 1;
  background: @bg-panel;
  border-radius: 12px;
  padding: 20px;
}

.location-info h3 {
  font-family: @font-display;
  color: @text-primary;
  margin: 0 0 8px;
}

.location-description {
  color: @text-secondary;
  margin: 0 0 20px;
  line-height: 1.5;
}

.location-enemies h4 {
  font-family: @font-display;
  color: @text-primary;
  margin: 0 0 12px;
  font-size: 1rem;
}

.enemy-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.enemy-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.enemy-item:hover {
  background: rgba(@gold-primary, 0.1);
  transform: translateX(4px);
}

.enemy-icon {
  font-size: 1.5rem;
}

.enemy-name {
  flex: 1;
  color: @text-primary;
}

.enemy-danger {
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.enemy-danger.普通 {
  background: rgba(100, 255, 100, 0.2);
  color: #88ff88;
}

.enemy-danger.精英 {
  background: rgba(255, 200, 100, 0.2);
  color: #ffcc66;
}

.enemy-danger.首领 {
  background: rgba(255, 100, 100, 0.2);
  color: #ff8888;
}

.quests-tab,
.log-tab {
  background: @bg-panel;
  border-radius: 12px;
  padding: 24px;
}

.quest-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quest-item {
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid @border-dark;
  border-radius: 12px;
  padding: 16px;
}

.quest-header {
  margin-bottom: 8px;
}

.quest-title {
  font-family: @font-display;
  color: @text-primary;
  margin: 0;
  font-size: 1.1rem;
}

.quest-description {
  color: @text-secondary;
  margin: 0 0 12px;
  line-height: 1.5;
}

.quest-objectives {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.objective {
  display: flex;
  align-items: center;
  gap: 8px;
  color: @text-muted;
  font-size: 0.9rem;
}

.quest-rewards {
  display: flex;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid @border-dark;
}

.reward-item {
  color: @text-secondary;
  font-size: 0.9rem;
}

.adventure-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.log-icon {
  font-size: 1.2rem;
}

.log-text {
  flex: 1;
  color: @text-secondary;
  font-size: 0.95rem;
}

.log-empty {
  text-align: center;
  padding: 40px;
  color: @text-muted;
}

.combat-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.combat-container {
  background: @bg-panel;
  border-radius: 16px;
  padding: 24px;
  max-width: 900px;
  width: 100%;
  position: relative;
}

.combat-header {
  text-align: center;
  margin-bottom: 24px;
}

.combat-header h2 {
  font-family: @font-display;
  color: @text-primary;
  margin: 0;
  font-size: 2rem;
}

.combat-arena {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(100, 0, 0, 0.3), rgba(0, 0, 50, 0.3));
  border-radius: 12px;
}

.combatant {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.combatant-avatar {
  width: 100px;
  height: 100px;
  font-size: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
}

.combatant.player .combatant-avatar {
  border: 3px solid #4488ff;
  box-shadow: 0 0 20px rgba(68, 136, 255, 0.3);
}

.combatant.enemy .combatant-avatar {
  border: 3px solid #ff4444;
  box-shadow: 0 0 20px rgba(255, 68, 68, 0.3);
}

.combatant-name {
  font-family: @font-display;
  color: @text-primary;
  font-size: 1.2rem;
  font-weight: 600;
}

.vs-divider {
  font-family: @font-display;
  font-size: 1.5rem;
  color: @text-muted;
  font-weight: 700;
}

.combat-abilities {
  margin-bottom: 20px;
}

.combat-abilities h3 {
  font-family: @font-display;
  color: @text-primary;
  margin: 0 0 12px;
  font-size: 1rem;
}

.ability-button {
  background: @bg-input;
  border: 2px solid @border-dark;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: inherit;
  font-family: inherit;
}

.ability-button:hover:not(:disabled) {
  border-color: @gold-primary;
  background: rgba(@gold-primary, 0.1);
}

.ability-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.combat-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
}

.combat-log {
  background: @bg-dark;
  border-radius: 8px;
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.combat-log h3 {
  font-family: @font-display;
  color: @text-primary;
  margin: 0 0 12px;
  font-size: 0.95rem;
}

.log-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.combat-log-entry {
  font-size: 0.9rem;
  padding: 4px 0;
}

.combat-log-entry.damage {
  color: #ff8888;
}

.combat-log-entry.heal {
  color: #88ff88;
}

.combat-log-entry.magic {
  color: #8888ff;
}

.combat-log-entry.system {
  color: @text-muted;
}

.combat-result {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
}

.result-content {
  text-align: center;
}

.result-content h3 {
  font-family: @font-display;
  font-size: 2rem;
  margin: 0 0 16px;
}

.result-content h3.victory {
  color: #88ff88;
}

.result-content h3.defeat {
  color: #ff8888;
}

.result-content h3.fled {
  color: #ffcc66;
}

.result-content p {
  color: @text-secondary;
  margin: 0 0 24px;
}

.item-popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  padding: 20px;
}

.item-popup {
  background: @bg-panel;
  border: 2px solid @border-dark;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 100%;
}

.popup-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid @border-dark;
}

.popup-icon {
  font-size: 3rem;
}

.popup-info {
  flex: 1;
}

.popup-name {
  font-family: @font-display;
  color: @text-primary;
  margin: 0 0 4px;
  font-size: 1.2rem;
}

.popup-type {
  font-size: 0.85rem;
  color: @text-muted;
}

.popup-description {
  color: @text-secondary;
  margin: 0 0 16px;
  line-height: 1.5;
}

.popup-effects {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.effect {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.effect.heal {
  background: rgba(100, 255, 100, 0.1);
  color: #88ff88;
}

.effect.mana {
  background: rgba(100, 100, 255, 0.1);
  color: #8888ff;
}

.popup-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 1024px) {
  .sidebar-left {
    width: 280px;
  }
  
  .world-tab {
    flex-direction: column;
  }
  
  .world-map {
    height: 400px;
  }
}

@media (max-width: 768px) {
  .game-header {
    padding: 10px 16px;
  }
  
  .sidebar-left {
    display: none;
  }
  
  .tab-content {
    padding: 16px;
  }
  
  .combat-arena {
    flex-direction: column;
    gap: 24px;
  }
  
  .combat-actions {
    flex-direction: column;
  }
}
</style>
