import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Character, Stats, InventoryItem, LogEntry, QuestData, Ability, LootItemData } from '@/types'
import { FACTIONS, RACES, CLASSES, CLASS_ABILITIES, ITEM_TYPES, LOOT_ITEMS, ENEMIES, WORLD_LOCATIONS, QUESTS } from '@/data'
import { calculateAllAttributes, getExpForLevel, MAX_LEVEL } from '@/data/constants'
import { rollDice, rollD20 } from '@/utils'

export const useGameStore = defineStore('game', () => {
  // Game State
  const gameState = ref<'start' | 'creation' | 'playing'>('start')
  const notification = ref<string | null>(null)
  
  // Character
  const character = ref<Character>({
    name: '冒险者',
    faction: null,
    race: null,
    class: null,
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    stats: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },
    gold: 50
  })
  
  // Inventory
  const inventory = ref<(LootItemData & { quantity: number })[]>([])
  
  // Quests
  const quests = ref<{ [key: string]: { active: boolean; progress: { [enemyKey: string]: number } } }>({})
  const currentQuest = ref<string | null>(null)
  
  // Location
  const currentLocation = ref('stormwind')
  const mapStates = ref<{ [key: string]: any }>({})
  
  // Adventure Log
  const adventureLog = ref<LogEntry[]>([])
  
  // Combat State
  const combatActive = ref(false)
  const currentEnemy = ref<string | null>(null)
  const enemyHp = ref(0)
  const enemyMaxHp = ref(0)
  const playerTurn = ref(true)
  const combatEnded = ref(false)
  const shieldActive = ref(false)
  const shieldAmount = ref(0)
  const combatLog = ref<{ message: string; type: string }[]>([])
  const currentCellIndex = ref<number | null>(null)
  
  // Computed
  const attributes = computed(() => calculateAllAttributes(character.value.stats))
  
  const classAbilities = computed((): Ability[] => {
    if (character.value.class && CLASS_ABILITIES[character.value.class]) {
      return CLASS_ABILITIES[character.value.class]
    }
    return CLASS_ABILITIES.mage
  })
  
  const currentLocationData = computed(() => WORLD_LOCATIONS[currentLocation.value])
  
  const currentQuestData = computed(() => {
    if (currentQuest.value) {
      return QUESTS[currentQuest.value]
    }
    return null
  })
  
  // Actions
  function setGameState(state: 'start' | 'creation' | 'playing') {
    gameState.value = state
  }
  
  function showNotification(message: string) {
    notification.value = message
    setTimeout(() => {
      notification.value = null
    }, 3000)
  }
  
  // Character Actions
  function setCharacterName(name: string) {
    character.value.name = name
  }
  
  function selectFaction(faction: 'alliance' | 'horde') {
    character.value.faction = faction
    character.value.race = null
    character.value.class = null
  }
  
  function selectRace(race: string) {
    const raceData = RACES[race]
    if (!raceData) return
    
    character.value.race = race
    
    // Apply race bonuses
    const baseStats: Stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    if (raceData.bonus) {
      Object.entries(raceData.bonus).forEach(([stat, value]) => {
        if (stat in baseStats && value !== undefined) {
          baseStats[stat as keyof Stats] += value
        }
      })
    }
    character.value.stats = baseStats
    updateDerivedAttributes()
  }
  
  function selectClass(className: string) {
    const classData = CLASSES[className]
    if (!classData) return
    
    character.value.class = className
    updateDerivedAttributes()
  }
  
  function updateDerivedAttributes() {
    const attrs = attributes.value
    character.value.maxHp = attrs.maxHp
    character.value.maxMana = attrs.maxMana
    character.value.hp = Math.min(character.value.hp, character.value.maxHp)
    character.value.mana = Math.min(character.value.mana, character.value.maxMana)
  }
  
  function checkLevelUp() {
    while (character.value.exp >= getExpForLevel(character.value.level + 1) && character.value.level < MAX_LEVEL) {
      character.value.exp -= getExpForLevel(character.value.level)
      character.value.level++
      character.value.expToNextLevel = getExpForLevel(character.value.level + 1)
      
      // Stat increases
      character.value.stats.str += 1
      character.value.stats.dex += 1
      character.value.stats.int += 1
      
      updateDerivedAttributes()
      character.value.hp = character.value.maxHp
      character.value.mana = character.value.maxMana
      
      showNotification(`⬆️ 升级了！现在等级 ${character.value.level}！`)
      addToAdventureLog(`升级到 ${character.value.level} 级！`, 'level')
    }
    
    if (character.value.level >= MAX_LEVEL) {
      character.value.exp = Math.min(character.value.exp, getExpForLevel(MAX_LEVEL))
    }
  }
  
  // Inventory Actions
  function addItemToInventory(item: LootItemData, quantity: number = 1): boolean {
    if (!item) return false
    
    const itemType = ITEM_TYPES[item.type]
    if (!itemType) return false
    
    if (item.type === 'gold') {
      character.value.gold += quantity
      saveGame()
      return true
    }
    
    // Try to stack
    if (itemType.stackable && itemType.maxStack) {
      const existing = inventory.value.find(
        (i) => i.name === item.name && i.type === item.type && (i.quantity || 1) < itemType.maxStack
      )
      
      if (existing) {
        const maxAdd = itemType.maxStack - (existing.quantity || 1)
        const actualAdd = Math.min(quantity, maxAdd)
        existing.quantity = (existing.quantity || 1) + actualAdd
        saveGame()
        return true
      }
    }
    
    if (inventory.value.length >= 8) {
      return false
    }
    
    const newItem = { ...item, quantity: itemType.stackable ? quantity : 1 }
    inventory.value.push(newItem)
    saveGame()
    return true
  }
  
  function useItem(index: number) {
    const item = inventory.value[index]
    if (!item) return
    
    const itemType = ITEM_TYPES[item.type]
    if (!itemType?.usable) {
      showNotification('该物品无法使用')
      return
    }
    
    let message = ''
    
    if (item.healing) {
      const healAmount = Math.min(item.healing, character.value.maxHp - character.value.hp)
      character.value.hp += healAmount
      message = `${item.icon} 使用${item.name}，恢复了 ${healAmount} 点生命值！`
    }
    
    if (item.manaRestore) {
      const manaAmount = Math.min(item.manaRestore, character.value.maxMana - character.value.mana)
      character.value.mana += manaAmount
      message = `${item.icon} 使用${item.name}，恢复了 ${manaAmount} 点法力值！`
    }
    
    if (item.statBonus) {
      const bonusTexts: string[] = []
      for (const [stat, value] of Object.entries(item.statBonus)) {
        if (stat in character.value.stats && value !== undefined) {
          character.value.stats[stat as keyof Stats] += value
          const statNames: { [key: string]: string } = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }
          bonusTexts.push(`${statNames[stat] || stat}+${value}`)
        }
      }
      
      updateDerivedAttributes()
      message = `${item.icon} 使用${item.name}，${bonusTexts.join(', ')}！`
    }
    
    if (item.effect === 'damage' && item.damage && combatActive.value) {
      const damage = rollDice(item.damage[0], item.damage[1])
      enemyHp.value -= damage
      message = `${item.icon} 使用${item.name}，对敌人造成 ${damage} 点伤害！`
      
      if (enemyHp.value <= 0) {
        enemyHp.value = 0
        endCombat('victory')
      }
    }
    
    if (item.effect === 'shield' && item.shield && combatActive.value) {
      shieldActive.value = true
      shieldAmount.value = item.shield
      message = `${item.icon} 使用${item.name}，获得 ${item.shield} 点护盾！`
    }
    
    // Consume item
    if (item.quantity && item.quantity > 1) {
      item.quantity--
    } else {
      inventory.value.splice(index, 1)
    }
    
    showNotification(message || `使用了 ${item.name}`)
    saveGame()
  }
  
  function discardItem(index: number) {
    const item = inventory.value[index]
    if (!item) return
    
    const itemName = item.name
    if (item.quantity && item.quantity > 1) {
      item.quantity--
    } else {
      inventory.value.splice(index, 1)
    }
    
    showNotification(`已丢弃 ${item.icon} ${itemName}`)
    saveGame()
  }
  
  // Combat Actions
  function startCombat(enemyKey: string, cellIndex?: number) {
    const enemyData = ENEMIES[enemyKey]
    if (!enemyData) return
    
    currentCellIndex.value = cellIndex ?? null
    combatActive.value = true
    currentEnemy.value = enemyKey
    enemyHp.value = enemyData.hp
    enemyMaxHp.value = enemyData.hp
    playerTurn.value = true
    combatEnded.value = false
    shieldActive.value = false
    shieldAmount.value = 0
    combatLog.value = []
    
    addCombatLog(`${enemyData.icon} ${enemyData.name} 出现了！`, 'system')
    addCombatLog(`它有 ${enemyData.hp} 点生命值，准备战斗！`, 'system')
  }
  
  function addCombatLog(message: string, type: string = 'system') {
    combatLog.value.push({ message, type })
  }
  
  function clearCombatLog() {
    combatLog.value = []
  }
  
  function playerAttack() {
    if (!combatActive.value || !playerTurn.value || combatEnded.value) return
    
    playerTurn.value = false
    const attrs = attributes.value
    const attackRoll = rollD20()
    const totalAttack = attackRoll + attrs.physicalAttack
    
    const enemyData = currentEnemy.value ? ENEMIES[currentEnemy.value] : null
    if (!enemyData) return
    
    const enemyAC = 10 + Math.floor(enemyData.xp / 20)
    addCombatLog(`你投掷: ${attackRoll} + ${attrs.physicalAttack}(物攻) = ${totalAttack}`, 'system')
    
    if (totalAttack >= enemyAC) {
      let baseDamage = rollDice(1, 6) + attrs.physicalAttack
      let isCrit = Math.random() * 100 < attrs.critChance
      
      if (isCrit) {
        baseDamage = Math.floor(baseDamage * 1.5)
        addCombatLog(`💥 暴击！`, 'system')
      }
      
      const damage = Math.max(1, baseDamage)
      enemyHp.value -= damage
      addCombatLog(`${enemyData.icon} ${enemyData.name} 受到 ${damage} 点物理伤害！`, 'damage')
      
      if (enemyHp.value <= 0) {
        enemyHp.value = 0
        endCombat('victory')
        return
      }
    } else {
      addCombatLog(`你的攻击被 ${enemyData.name} 躲开了！`, 'system')
    }
    
    setTimeout(() => {
      if (combatActive.value && !combatEnded.value) {
        enemyTurn()
      }
    }, 800)
  }
  
  function useAbility(index: number) {
    if (!combatActive.value || !playerTurn.value || combatEnded.value) return
    
    const ability = classAbilities.value[index]
    if (!ability || character.value.mana < ability.manaCost) return
    
    character.value.mana -= ability.manaCost
    playerTurn.value = false
    
    const enemyData = currentEnemy.value ? ENEMIES[currentEnemy.value] : null
    if (!enemyData) return
    
    switch (ability.type) {
      case 'damage':
        let damage = rollDice(ability.damage![0], ability.damage![1]) + attributes.value.magicAttack
        let isCrit = Math.random() * 100 < attributes.value.critChance
        
        if (isCrit) {
          damage = Math.floor(damage * 1.5)
          addCombatLog(`💥 暴击！`, 'system')
        }
        
        enemyHp.value -= damage
        addCombatLog(`${ability.icon} ${ability.name} 对 ${enemyData.name} 造成 ${damage} 点魔法伤害！`, 'magic')
        
        if (enemyHp.value <= 0) {
          enemyHp.value = 0
          endCombat('victory')
          return
        }
        break
        
      case 'heal':
        const healAmount = rollDice(ability.healing![0], ability.healing![1]) + attributes.value.healBonus
        const actualHeal = Math.min(healAmount, character.value.maxHp - character.value.hp)
        character.value.hp += actualHeal
        addCombatLog(`${ability.icon} ${ability.name} 恢复了 ${actualHeal} 点生命值！`, 'heal')
        break
        
      case 'shield':
        shieldActive.value = true
        shieldAmount.value = ability.shield || 30
        addCombatLog(`${ability.icon} ${ability.name} 生效，获得 ${shieldAmount.value} 点护盾！`, 'magic')
        break
    }
    
    setTimeout(() => {
      if (combatActive.value && !combatEnded.value) {
        enemyTurn()
      }
    }, 800)
  }
  
  function enemyTurn() {
    if (!combatActive.value || combatEnded.value) return
    
    const attrs = attributes.value
    const enemyData = currentEnemy.value ? ENEMIES[currentEnemy.value] : null
    if (!enemyData) return
    
    const attackRoll = rollD20()
    const enemyBonus = Math.floor(enemyData.xp / 30)
    const totalAttack = attackRoll + enemyBonus
    
    const playerAC = 10 + attrs.physicalDefense
    addCombatLog(`${enemyData.icon} ${enemyData.name} 发起攻击...`, 'system')
    
    const dodgeChance = attrs.dodgeChance / 100
    if (Math.random() < dodgeChance) {
      addCombatLog(`👻 你灵巧地闪避了攻击！`, 'system')
    } else if (totalAttack >= playerAC) {
      let damage = rollDice(enemyData.damage[0], enemyData.damage[1])
      
      if (shieldActive.value) {
        if (damage <= shieldAmount.value) {
          shieldActive.value = false
          addCombatLog(`🛡️ 护盾吸收了全部 ${damage} 点伤害！`, 'magic')
          damage = 0
        } else {
          damage -= shieldAmount.value
          shieldActive.value = false
          addCombatLog(`🛡️ 护盾吸收了 ${shieldAmount.value} 点伤害！`, 'magic')
        }
      }
      
      if (damage > 0) {
        damage = Math.max(1, damage - attrs.physicalDefense)
        character.value.hp -= damage
        addCombatLog(`${enemyData.icon} ${enemyData.name} 对你造成 ${damage} 点伤害！`, 'damage')
        
        if (character.value.hp <= 0) {
          character.value.hp = 0
          endCombat('defeat')
          return
        }
      }
    } else {
      addCombatLog(`你躲开了 ${enemyData.name} 的攻击！`, 'system')
    }
    
    playerTurn.value = true
  }
  
  function tryFlee() {
    if (!combatActive.value || !playerTurn.value || combatEnded.value) return
    
    const fleeChance = 0.4 + (character.value.stats.dex - 10) * 0.02
    addCombatLog('你试图逃跑...', 'system')
    
    if (Math.random() < fleeChance) {
      addCombatLog('🏃 成功逃脱了战斗！', 'system')
      endCombat('fled')
    } else {
      addCombatLog('🏃 逃跑失败了！', 'system')
      playerTurn.value = false
      setTimeout(() => {
        if (combatActive.value && !combatEnded.value) {
          enemyTurn()
        }
      }, 800)
    }
  }
  
  function endCombat(result: 'victory' | 'defeat' | 'fled') {
    combatEnded.value = true
    combatActive.value = false
    
    const enemyData = currentEnemy.value ? ENEMIES[currentEnemy.value] : null
    
    if (result === 'victory' && enemyData) {
      character.value.exp += enemyData.xp
      character.value.gold += enemyData.gold
      
      addCombatLog(`🎉 你击败了 ${enemyData.name}！`, 'system')
      addCombatLog(`获得 ${enemyData.xp} 点经验值`, 'system')
      addCombatLog(`💰 获得 ${enemyData.gold} 金币`, 'system')
      
      if (Math.random() < 0.3) {
        const loot = { ...LOOT_ITEMS[Math.floor(Math.random() * LOOT_ITEMS.length)] }
        if (addItemToInventory(loot)) {
          addCombatLog(`📦 战利品: ${loot.icon} ${loot.name} 已添加到背包`, 'system')
        }
      }
      
      updateQuestProgress(currentEnemy.value)
      checkLevelUp()
      
      if (currentCellIndex.value !== null) {
        // Mark cell completed - will be handled in UI
      }
      
      addToAdventureLog(`击败了 ${enemyData.name}`, 'combat')
      
    } else if (result === 'defeat' && enemyData) {
      addCombatLog('💀 你被击败了...', 'damage')
      
      const lostExp = character.value.exp
      character.value.exp = 0
      character.value.hp = Math.floor(character.value.maxHp * 0.5)
      character.value.mana = Math.floor(character.value.maxMana * 0.5)
      
      if (lostExp > 0) {
        addCombatLog(`💔 损失了 ${lostExp} 点经验值！`, 'damage')
      }
      addCombatLog('你休息后恢复了部分生命值和法力值', 'heal')
      
      addToAdventureLog(`被 ${enemyData.name} 击败`, 'combat')
      
    } else if (result === 'fled') {
      addCombatLog('🏃 怪物仍然守在那里...', 'system')
    }
    
    saveGame()
  }
  
  // Quest Actions
  function updateQuestProgress(enemyKey: string) {
    const locationData = currentLocationData.value
    if (!locationData) return
    
    Object.entries(QUESTS).forEach(([questKey, quest]) => {
      if (quest.locationKey === currentLocation.value) {
        if (!quests.value[questKey]) {
          quests.value[questKey] = { active: true, progress: {} }
        }
        
        const questState = quests.value[questKey]
        quest.objectives.forEach((obj) => {
          if (obj.type === 'kill' && obj.enemyKey === enemyKey) {
            if (!questState.progress[obj.enemyKey]) {
              questState.progress[obj.enemyKey] = 0
            }
            questState.progress[obj.enemyKey]++
            
            if (questState.progress[obj.enemyKey] >= obj.target) {
              // Quest objective completed
              showNotification(`任务目标完成：${obj.target}x ${ENEMIES[obj.enemyKey].name}`)
            }
          }
        })
      }
    })
    
    saveGame()
  }
  
  function acceptQuest(questKey: string) {
    if (!quests.value[questKey]) {
      quests.value[questKey] = { active: true, progress: {} }
      currentQuest.value = questKey
      showNotification(`接受任务：${QUESTS[questKey].name}`)
      saveGame()
    }
  }
  
  // Location Actions
  function setLocation(locationKey: string) {
    currentLocation.value = locationKey
    saveGame()
  }
  
  // Adventure Log
  function addToAdventureLog(message: string, type: LogEntry['type'] = 'info') {
    adventureLog.value.push({
      id: Date.now().toString(),
      timestamp: Date.now(),
      type,
      message,
      icon: getLogIcon(type)
    })
  }
  
  function getLogIcon(type: LogEntry['type']): string {
    const icons: { [key: string]: string } = {
      info: '📜',
      combat: '⚔️',
      quest: '📋',
      item: '📦',
      level: '⬆️'
    }
    return icons[type] || '📜'
  }
  
  // Save/Load
  function saveGame() {
    const saveData = {
      character: character.value,
      inventory: inventory.value,
      quests: quests.value,
      currentQuest: currentQuest.value,
      currentLocation: currentLocation.value,
      mapStates: mapStates.value,
      adventureLog: adventureLog.value
    }
    localStorage.setItem('wowGameState', JSON.stringify(saveData))
  }
  
  function loadGame(): boolean {
    const saved = localStorage.getItem('wowGameState')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        character.value = data.character
        inventory.value = data.inventory || []
        quests.value = data.quests || {}
        currentQuest.value = data.currentQuest
        currentLocation.value = data.currentLocation || 'stormwind'
        mapStates.value = data.mapStates || {}
        adventureLog.value = data.adventureLog || []
        return true
      } catch (e) {
        console.error('Failed to load game:', e)
      }
    }
    return false
  }
  
  function resetGame() {
    character.value = {
      name: '冒险者',
      faction: null,
      race: null,
      class: null,
      level: 1,
      exp: 0,
      expToNextLevel: 100,
      hp: 100,
      maxHp: 100,
      mana: 50,
      maxMana: 50,
      stats: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
      },
      gold: 50
    }
    inventory.value = []
    quests.value = {}
    currentQuest.value = null
    currentLocation.value = 'stormwind'
    mapStates.value = {}
    adventureLog.value = []
    localStorage.removeItem('wowGameState')
    gameState.value = 'start'
  }
  
  function startNewGame() {
    resetGame()
    gameState.value = 'creation'
  }
  
  function continueGame() {
    if (loadGame() && character.value.race && character.value.class) {
      gameState.value = 'playing'
      return true
    }
    return false
  }
  
  function finishCharacterCreation() {
    if (!character.value.race || !character.value.class) return
    gameState.value = 'playing'
    saveGame()
    addToAdventureLog('冒险开始！', 'info')
  }
  
  return {
    // State
    gameState,
    notification,
    character,
    inventory,
    quests,
    currentQuest,
    currentLocation,
    mapStates,
    adventureLog,
    combatActive,
    currentEnemy,
    enemyHp,
    enemyMaxHp,
    playerTurn,
    combatEnded,
    shieldActive,
    shieldAmount,
    combatLog,
    currentCellIndex,
    
    // Computed
    attributes,
    classAbilities,
    currentLocationData,
    currentQuestData,
    
    // Actions
    setGameState,
    showNotification,
    setCharacterName,
    selectFaction,
    selectRace,
    selectClass,
    checkLevelUp,
    addItemToInventory,
    useItem,
    discardItem,
    startCombat,
    addCombatLog,
    clearCombatLog,
    playerAttack,
    useAbility,
    tryFlee,
    endCombat,
    updateQuestProgress,
    acceptQuest,
    setLocation,
    addToAdventureLog,
    saveGame,
    loadGame,
    resetGame,
    startNewGame,
    continueGame,
    finishCharacterCreation
  }
})
