<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useGameStore } from './stores/game'
import StartScreen from './components/StartScreen.vue'
import CharacterCreation from './components/CharacterCreation.vue'
import GameInterface from './components/GameInterface.vue'
import Notification from './components/Notification.vue'

const gameStore = useGameStore()

// Check for saved game on mount
onMounted(() => {
  const hasSavedGame = localStorage.getItem('wowGameState')
  if (hasSavedGame) {
    gameStore.loadGame()
    if (gameStore.character.race && gameStore.character.class) {
      gameStore.setGameState('playing')
    }
  }
})
</script>

<template>
  <div id="app">
    <StartScreen v-if="gameStore.gameState === 'start'" />
    <CharacterCreation v-else-if="gameStore.gameState === 'creation'" />
    <GameInterface v-else-if="gameStore.gameState === 'playing'" />
    <Notification />
  </div>
</template>

<style scoped lang="less">
#app {
  min-height: 100vh;
}
</style>
