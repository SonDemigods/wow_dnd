<template>
  <div id="app">
    <StartScreen v-if="gameStore.gameState === 'start'" />
    <CharacterCreation v-else-if="gameStore.gameState === 'creation'" />
    <GameInterface v-else-if="gameStore.gameState === 'playing'" />
    <Notification />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 游戏应用根组件
 * @description 魔兽世界风格RPG游戏的主应用入口，管理游戏状态的切换和主要页面渲染
 * @module App
 */

import { onMounted, computed } from 'vue'
import { useGameStore } from './stores/game'
import StartScreen from './components/StartScreen.vue'
import CharacterCreation from './components/CharacterCreation.vue'
import GameInterface from './components/GameInterface.vue'
import Notification from './components/Notification.vue'

/** 游戏状态管理Store实例 */
const gameStore = useGameStore()

/**
 * 组件挂载时检查是否有保存的游戏进度
 * 如果有有效存档且已创建角色，直接进入游戏
 */
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

<style scoped lang="less">
#app {
  min-height: 100vh;
}
</style>
