
/**
 * Exploration System Module
 * Handles map exploration, event generation, and adventure log
 */

function addAdventureLog(message, type = 'system') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  GameState.adventureLog.unshift({ message, type, timestamp });
  if (GameState.adventureLog.length > 50) GameState.adventureLog.pop();
  renderAdventureLog();
  GameState.save();
}

function renderAdventureLog() {
  const logContainer = document.getElementById('adventure-log');
  if (!logContainer) return;

  if (GameState.adventureLog.length === 0) {
    logContainer.innerHTML = '<div class="log-placeholder">开始你的冒险吧！</div>';
    return;
  }

  logContainer.innerHTML = GameState.adventureLog.map(log => `
    <div class="log-entry ${log.type}">
      <span class="log-time">${log.timestamp}</span>
      <span class="log-message">${log.message}</span>
    </div>
  `).join('');
}

function getOrCreateMapState(locationName) {
  if (!GameState.mapStates) {
    GameState.mapStates = {};
  }
  if (!GameState.mapStates[locationName]) {
    GameState.mapStates[locationName] = {
      grid: [],
      revealedCount: 0,
      steps: 0
    };
    for (let i = 0; i < 25; i++) {
      GameState.mapStates[locationName].grid.push({
        revealed: false,
        type: null,
        data: null,
        completed: false
      });
    }
  }
  return GameState.mapStates[locationName];
}

function generateCellContent(location) {
  const roll = Math.random() * 100;
  const playerLevel = GameState.character.level;

  if (roll < 40) {
    const enemyKey = location.enemies[Math.floor(Math.random() * location.enemies.length)];
    return { type: 'enemy', data: { key: enemyKey } };
  } 
  else if (roll < 60) {
    const lootItems = LOOT_ITEMS.filter(item => item.type !== 'quest');
    const item = lootItems[Math.floor(Math.random() * lootItems.length)];
    return { type: 'item', data: item };
  } 
  else if (roll < 75) {
    const encounters = [
      { icon: '💰', name: '金币堆', description: '你发现了一堆闪闪发光的金币！', gold: rollDice(10, 50 + playerLevel * 5) },
      { icon: '🏺', name: '古老遗迹', description: '这里有远古文明的遗迹...', exp: rollDice(10, 30 + playerLevel * 10) },
      { icon: '⛺', name: '休息营地', description: '你发现了一个可以休息的地方，生命值完全恢复！', heal: true },
      { icon: '🎁', name: '神秘宝箱', description: '一个被遗忘的宝箱静静地躺在那里...', exp: rollDice(20, 50 + playerLevel * 15) }
    ];
    return { type: 'encounter', data: encounters[Math.floor(Math.random() * encounters.length)] };
  } 
  else if (roll < 85) {
    const trapTypes = [
      { icon: '🕳️', name: '陷阱', description: '你踩中了一个隐藏的陷阱！', damage: rollDice(5, 15 + playerLevel * 3) },
      { icon: '🌿', name: '毒雾', description: '一阵有毒的气体向你袭来...', damage: rollDice(3, 10 + playerLevel * 2) }
    ];
    return { type: 'trap', data: trapTypes[Math.floor(Math.random() * trapTypes.length)] };
  } 
  else {
    return { type: 'empty', data: { icon: '🌱', name: '空地', description: '这里什么都没有...' } };
  }
}

function initExplorationGrid() {
  const grid = document.getElementById('exploration-grid');
  if (!grid) return;

  const location = LOCATIONS[GameState.location];
  if (!location) return;

  const mapState = getOrCreateMapState(location.name);
  console.log('Init exploration grid for location:', location.name, 'mapState:', mapState);

  grid.innerHTML = '';
  
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'exploration-cell';
    cell.dataset.index = i;

    const cellData = mapState.grid[i];
    if (cellData && cellData.revealed) {
      console.log('Render revealed cell', i, cellData);
      renderRevealedCell(cell, cellData, i);
    } else {
      cell.innerHTML = '<span class="fog-icon">🌫️</span>';
      cell.onclick = function() {
        console.log('Click on cell', i);
        revealCell(i);
      };
    }

    grid.appendChild(cell);
  }
}

function renderRevealedCell(cell, cellData, index) {
  console.log('renderRevealedCell called for index', index, 'with data:', cellData);
  
  cell.classList.remove('enemy', 'item', 'encounter', 'trap', 'completed');
  cell.innerHTML = '';
  cell.classList.add('revealed');

  if (cellData.completed) {
    cell.classList.add('completed');
    const emptyCell = cellData.data || {};
    const icon = emptyCell.icon || '🌿';
    console.log('Setting completed cell icon:', icon);
    cell.innerHTML = `
      <div class="cell-content" style="opacity: 0.4;">${icon}</div>
    `;
    cell.style.opacity = '0.4';
    return;
  }

  let icon = '🌿';
  let tooltipName = '';
  let tooltipInfo = '';
  let dangerClass = '';
  
  switch (cellData.type) {
    case 'enemy':
      const enemy = ENEMIES[cellData.data.key];
      console.log('Rendering enemy:', enemy);
      icon = enemy.icon;
      tooltipName = enemy.name;
      tooltipInfo = `Lv.${enemy.level || 1} · ${enemy.dangerLevel || '危险'}`;
      dangerClass = 'danger-text';
      cell.classList.add('enemy');
      cell.onclick = () => {
        if (!cellData.completed) {
          startCombatFromMap(cellData.data.key, index);
        }
      };
      break;
    case 'item':
      const item = cellData.data;
      console.log('Rendering item:', item);
      icon = item.icon;
      tooltipName = item.name;
      tooltipInfo = item.type ? ITEM_TYPES[item.type]?.name || '物品' : '物品';
      cell.classList.add('item');
      cell.onclick = () => pickupItem(cellData.data, cell, index);
      break;
    case 'encounter':
      const encounter = cellData.data;
      console.log('Rendering encounter:', encounter);
      icon = encounter.icon;
      tooltipName = encounter.name;
      tooltipInfo = encounter.description || '事件';
      cell.classList.add('encounter');
      cell.onclick = () => handleEncounter(cellData.data, cell, index);
      break;
    case 'trap':
      const trap = cellData.data;
      console.log('Rendering trap:', trap);
      icon = trap.icon;
      tooltipName = trap.name;
      tooltipInfo = trap.description || '陷阱';
      dangerClass = 'danger-text';
      cell.classList.add('trap');
      cell.onclick = () => handleTrap(cellData.data, cell, index);
      break;
    default:
      const emptyCell = cellData.data || {};
      icon = emptyCell.icon || '🌿';
      tooltipName = '空地';
      tooltipInfo = emptyCell.description || '这里很安全';
      console.log('Rendering empty cell icon:', icon);
  }
  
  // 构建包含tooltip的HTML结构
  cell.innerHTML = `
    <div class="cell-content">${icon}</div>
    <div class="cell-tooltip">
      <div class="tooltip-name ${dangerClass}">${tooltipName}</div>
      ${tooltipInfo ? `<div class="tooltip-info">${tooltipInfo}</div>` : ''}
    </div>
  `;
}

function revealCell(index) {
  console.log('Revealing cell', index);
  
  const location = LOCATIONS[GameState.location];
  if (!location) {
    console.error('No location found!');
    return;
  }

  const mapState = getOrCreateMapState(location.name);
  const cell = document.querySelector(`[data-index="${index}"]`);
  console.log('Found cell:', cell);
  
  if (!cell) {
    console.error('Cell not found!');
    return;
  }
  
  if (mapState.grid[index].revealed) {
    console.log('Cell already revealed');
    return;
  }

  console.log('Generating cell content...');
  const content = generateCellContent(location);
  console.log('Content generated:', content);
  
  mapState.grid[index] = {
    revealed: true,
    type: content.type,
    data: content.data,
    completed: false
  };
  mapState.revealedCount++;
  mapState.steps++;

  console.log('Rendering revealed cell...');
  // 先显示图标让用户看到
  renderRevealedCell(cell, mapState.grid[index], index);
  console.log('Cell rendered, innerHTML:', cell.innerHTML);

  const stepsEl = document.getElementById('exploration-steps');
  const revealedEl = document.getElementById('exploration-revealed');
  if (stepsEl) stepsEl.textContent = mapState.steps;
  if (revealedEl) revealedEl.textContent = mapState.revealedCount;

  const locationName = LOCATIONS[GameState.location]?.displayName || '未知区域';
  addAdventureLog(`📍 探索 ${locationName} 第 ${mapState.steps} 格`, 'system');
  
  GameState.save();

  // 延迟触发事件，让用户看到一下图标
  console.log('Waiting 600ms before triggering event...');
  setTimeout(() => {
    console.log('Triggering event for type:', content.type);
    autoTriggerCell(content.type, mapState.grid[index], cell, index);
  }, 600);
}

function autoTriggerCell(type, cellData, cell, index) {
  switch (type) {
    case 'enemy':
      const enemy = ENEMIES[cellData.data.key];
      addAdventureLog(`⚔️ ${enemy.icon} ${enemy.name} 发起攻击！`, 'damage');
      setTimeout(() => startCombatFromMap(cellData.data.key, index), 500);
      break;
    case 'item':
      pickupItem(cellData.data, cell, index);
      break;
    case 'encounter':
      handleEncounter(cellData.data, cell, index);
      break;
    case 'trap':
      handleTrap(cellData.data, cell, index);
      break;
    case 'empty':
      addAdventureLog(`${cellData.data?.icon || '🌱'} ${cellData.data?.description || '安全区域'}`, 'system');
      markCellCompleted(index);
      break;
  }
}

function markCellCompleted(index) {
  const location = LOCATIONS[GameState.location];
  if (!location) return;
  
  const mapState = getOrCreateMapState(location.name);
  mapState.grid[index].completed = true;
  
  const cell = document.querySelector(`[data-index="${index}"]`);
  if (cell) {
    cell.classList.remove('enemy', 'item', 'encounter', 'trap');
    cell.classList.add('completed');
    cell.onclick = null;
    cell.style.opacity = '0.4';
    // 不修改内容，保持原有图标，只降低透明度
  }
  
  GameState.save();
}

function showCellInfo(cellData) {
  const infoPanel = document.getElementById('exploration-info');
  if (!infoPanel) return;

  let html = '';

  switch (cellData.type) {
    case 'enemy':
      const enemy = ENEMIES[cellData.data.key];
      html = `
        <div class="info-header">
          <span class="info-icon">${enemy.icon}</span>
          <div>
            <div class="info-title">${enemy.name}</div>
            <div class="info-subtitle">危险等级: ${enemy.dangerLevel}</div>
          </div>
        </div>
        <div class="info-details">
          <div class="info-detail-row">
            <span class="info-detail-label">生命值</span>
            <span class="info-detail-value">${enemy.hp}</span>
          </div>
          <div class="info-detail-row">
            <span class="info-detail-label">伤害</span>
            <span class="info-detail-value">${enemy.damage[0]}-${enemy.damage[1]}</span>
          </div>
          <div class="info-detail-row">
            <span class="info-detail-label">经验/金币</span>
            <span class="info-detail-value">${enemy.xp} / ${enemy.gold}</span>
          </div>
        </div>
        <button class="btn btn-danger" onclick="startCombatFromMap('${cellData.data.key}')">⚔️ 发起战斗</button>
      `;
      break;
    case 'item':
      const item = cellData.data;
      html = `
        <div class="info-header">
          <span class="info-icon">${item.icon}</span>
          <div>
            <div class="info-title">${item.name}</div>
            <div class="info-subtitle">${ITEM_TYPES[item.type]?.name || item.type}</div>
          </div>
        </div>
        <div class="info-details">
          <div class="info-detail-row">
            <span class="info-detail-label">描述</span>
            <span class="info-detail-value">${item.description}</span>
          </div>
        </div>
      `;
      break;
    case 'encounter':
      const encounter = cellData.data;
      html = `
        <div class="info-header">
          <span class="info-icon">${encounter.icon}</span>
          <div>
            <div class="info-title">${encounter.name}</div>
          </div>
        </div>
        <div class="info-details">
          <div class="info-detail-row">
            <span class="info-detail-value">${encounter.description}</span>
          </div>
        </div>
      `;
      break;
    case 'trap':
      const trap = cellData.data;
      html = `
        <div class="info-header">
          <span class="info-icon">${trap.icon}</span>
          <div>
            <div class="info-title">${trap.name}</div>
          </div>
        </div>
        <div class="info-details">
          <div class="info-detail-row">
            <span class="info-detail-value" style="color: var(--blood-glow);">${trap.description}</span>
          </div>
        </div>
      `;
      break;
    default:
      html = `<p style="color: var(--text-muted); text-align: center;">${cellData.data?.description || '这里什么都没有...'}</p>`;
  }

  infoPanel.innerHTML = html;
}

function pickupItem(item, cell, index) {
  if (typeof addItemToInventory !== 'function') return;
  
  const added = addItemToInventory(item);
  if (added) {
    addAdventureLog(`拾取了: ${item.icon} ${item.name}`, 'loot');
    showNotification(`${item.icon} ${item.name} 已添加到背包！`);
    if (typeof renderSidebarInventory === 'function') renderSidebarInventory();
    
    markCellCompleted(index);
    GameState.save();
  } else {
    showNotification('背包已满，无法拾取！');
  }
}

function handleEncounter(encounter, cell, index) {
  const player = GameState.character;
  let message = '';

  if (encounter.gold) {
    player.gold += encounter.gold;
    message = `💰 获得 ${encounter.gold} 金币！`;
    addAdventureLog(message, 'loot');
  } else if (encounter.exp) {
    player.exp += encounter.exp;
    message = `你获得 ${encounter.exp} 经验值！`;
    addAdventureLog(message, 'quest');
    checkLevelUp();
  } else if (encounter.heal) {
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    message = `⛺ 休息完成！生命值和法力值已完全恢复！`;
    addAdventureLog(message, 'heal');
    addAdventureLog(`❤️ ${player.hp}/${player.maxHp} HP  💧 ${player.mana}/${player.maxMana} MP`, 'heal');
  }

  if (message) showNotification(message);
  
  markCellCompleted(index);
  updatePlayerStats();
  GameState.save();
}

function handleTrap(trap, cell, index) {
  const player = GameState.character;
  
  if (trap.damage) {
    player.hp -= trap.damage;
    addAdventureLog(`${trap.icon} ${trap.description} 受到 ${trap.damage} 点伤害！`, 'damage');
    showNotification(`${trap.icon} ${trap.name}！受到 ${trap.damage} 点伤害！`);

    if (player.hp <= 0) {
      player.hp = 0;
      addAdventureLog('💀 你倒在了冒险的路上...', 'damage');
      updatePlayerStats();
      showGameOver();
      return;
    }
  }

  showNotification(`💀 ${trap.name}！`);
  
  markCellCompleted(index);
  updatePlayerStats();
  GameState.save();
}

function showGameOver() {
  showNotification('💀 你倒下了！');
}