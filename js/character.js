
/**
 * Character System Module
 * Handles character creation, leveling, and attribute calculations
 */

function checkLevelUp() {
  const player = GameState.character;
  
  while (player.exp >= getExpForLevel(player.level + 1) && player.level < MAX_LEVEL) {
    player.exp -= getExpForLevel(player.level);
    player.level++;
    player.expToNextLevel = getExpForLevel(player.level + 1);

    player.stats.str += 1;
    player.stats.dex += 1;
    player.stats.int += 1;
    
    const attrs = calculateAllAttributes(player.stats);
    player.maxHp = attrs.maxHp;
    player.hp = player.maxHp;
    player.maxMana = attrs.mana;
    player.mana = player.maxMana;

    showNotification(`⬆️ 升级了！现在等级 ${player.level}！`);
    updatePlayerStats();
  }
  
  if (player.level >= MAX_LEVEL) {
    player.exp = Math.min(player.exp, getExpForLevel(MAX_LEVEL));
  }
}

function getExpForLevel(level) {
  if (level > MAX_LEVEL) return Infinity;
  return LEVEL_EXP_REQUIREMENTS[level] || 0;
}

function updatePlayerStats() {
  updatePlayerStatsDisplay();
}

function showNotification(message) {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
