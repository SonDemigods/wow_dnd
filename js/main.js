
/**
 * Game initialization module
 * Handles game startup and initialization flow
 */

/**
 * Initialize game
 */
function initGame() {
  const saved = GameState.load();
  if (saved && GameState.character.race && GameState.character.class) {
    showGameInterface();
    initQuests();
    // 渲染已保存的冒险日志
    if (typeof renderAdventureLog === 'function') {
      renderAdventureLog();
    }
  } else {
    showStartScreen();
  }
  
  console.log('Game initialized');
}

/**
 * Initialize quests
 */
function initQuests() {
  updateSidebarQuests();
}

/**
 * Initialize when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  initGame();
});
