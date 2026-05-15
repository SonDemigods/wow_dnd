<template>
  <div class="start-screen">
    <div class="start-content">
      <div class="logo-section">
        <div class="logo-icon">🗡️</div>
        <h1 class="logo-title">艾泽拉斯冒险</h1>
        <p class="logo-subtitle">魔兽世界 D&D Web 游戏</p>
      </div>

      <div class="action-buttons">
        <button class="btn btn-primary btn-large" @click="handleNewGame">
          <span class="btn-icon">✨</span>
          <span>开始新游戏</span>
        </button>
        <button 
          v-if="hasSavedGame" 
          class="btn btn-secondary btn-large" 
          @click="handleContinue"
        >
          <span class="btn-icon">📂</span>
          <span>继续游戏</span>
        </button>
      </div>

      <div class="game-info">
        <div class="info-card">
          <div class="info-icon">🎭</div>
          <div class="info-title">创建角色</div>
          <div class="info-desc">选择你的阵营、种族和职业</div>
        </div>
        <div class="info-card">
          <div class="info-icon">⚔️</div>
          <div class="info-title">探索冒险</div>
          <div class="info-desc">在艾泽拉斯世界中冒险</div>
        </div>
        <div class="info-card">
          <div class="info-icon">🏆</div>
          <div class="info-title">成长变强</div>
          <div class="info-desc">升级角色，挑战更强敌人</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()

const hasSavedGame = computed(() => {
  try {
    const saved = localStorage.getItem('wowGameState')
    if (!saved) return false
    const data = JSON.parse(saved)
    return data.character?.race && data.character?.class
  } catch {
    return false
  }
})

const handleNewGame = () => {
  gameStore.startNewGame()
}

const handleContinue = () => {
  gameStore.continueGame()
}
</script>

<style scoped lang="less">
@import '@/styles/variables.less';

.start-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, @bg-darkest 0%, @bg-dark 50%, @bg-panel 100%);
  padding: 20px;
}

.start-content {
  text-align: center;
  max-width: 800px;
  width: 100%;
}

.logo-section {
  margin-bottom: 60px;
}

.logo-icon {
  font-size: 5rem;
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.logo-title {
  font-family: @font-display;
  font-size: 3.5rem;
  background: linear-gradient(135deg, @gold-light 0%, @gold-primary 50%, @gold-dark 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
  text-shadow: 0 0 40px rgba(@gold-primary, 0.3);
}

.logo-subtitle {
  font-size: 1.2rem;
  color: @text-muted;
  letter-spacing: 2px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 60px;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.btn-large {
  padding: 16px 40px;
  font-size: 1.1rem;
  gap: 12px;
}

.game-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.info-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  transition: transform 0.3s, border-color 0.3s;
}

.info-card:hover {
  transform: translateY(-4px);
  border-color: rgba(@gold-primary, 0.4);
}

.info-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.info-title {
  font-family: @font-display;
  font-size: 1.1rem;
  color: @text-primary;
  margin-bottom: 8px;
}

.info-desc {
  font-size: 0.9rem;
  color: @text-muted;
}

@media (max-width: 768px) {
  .logo-title {
    font-size: 2.5rem;
  }

  .logo-icon {
    font-size: 4rem;
  }

  .game-info {
    grid-template-columns: 1fr;
  }
}
</style>
