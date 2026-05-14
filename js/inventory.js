/**
 * Inventory System Module
 * Handles item management and display
 */

function addItemToInventory(item) {
  if (!item || typeof ITEM_TYPES === 'undefined') return false;

  const itemType = ITEM_TYPES[item.type];
  if (!itemType) return false;

  if (item.type === 'gold') {
    GameState.character.gold += item.quantity || 1;
    if (typeof updateGoldDisplay === 'function') updateGoldDisplay();
    GameState.save();
    return true;
  }

  if (itemType.stackable && itemType.maxStack) {
    const existingIndex = GameState.inventory.findIndex(
      (i) => i.name === item.name && i.type === item.type && (i.quantity || 1) < itemType.maxStack
    );

    if (existingIndex !== -1) {
      const existing = GameState.inventory[existingIndex];
      const addQuantity = item.quantity || 1;
      const maxAdd = itemType.maxStack - (existing.quantity || 1);
      const actualAdd = Math.min(addQuantity, maxAdd);
      existing.quantity = (existing.quantity || 1) + actualAdd;
      if (typeof renderSidebarInventory === 'function') renderSidebarInventory();
      if (typeof updateGoldDisplay === 'function') updateGoldDisplay();
      GameState.save();
      return true;
    }
  }

  if (GameState.inventory.length >= 8) {
    return false;
  }

  const newItem = { ...item };
  if (itemType.stackable && !newItem.quantity) {
    newItem.quantity = 1;
  }

  GameState.inventory.push(newItem);
  if (typeof renderSidebarInventory === 'function') renderSidebarInventory();
  if (typeof updateGoldDisplay === 'function') updateGoldDisplay();
  GameState.save();
  return true;
}

function renderSidebarInventory() {
  const container = document.getElementById('backpack-list');
  if (!container) return;
  
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(4, 1fr)';
  container.style.gap = '6px';
  
  let html = '';
  for (let i = 0; i < 8; i++) {
    const item = GameState.inventory[i];
    if (item) {
      const itemType = ITEM_TYPES[item.type];
      const isUsable = itemType?.usable;
      const quantity = item.quantity || 1;
      
      html += `
        <div class="inventory-slot filled" data-index="${i}" onclick="showItemPopup(${i}, event)" 
             style="display: flex; align-items: center; justify-content: center; font-size: 1.5rem; position: relative; cursor: pointer;">
          ${item.icon}
          ${quantity > 1 ? `<span class="inventory-slot-quantity">${quantity}</span>` : ''}
        </div>
      `;
    } else {
      html += `
        <div class="inventory-slot" style="display: flex; align-items: center; justify-content: center;"></div>
      `;
    }
  }
  container.innerHTML = html;
}

function showItemPopup(index, event) {
  event.stopPropagation();
  
  const existingPopup = document.getElementById('item-popup');
  if (existingPopup) existingPopup.remove();
  
  const item = GameState.inventory[index];
  if (!item) return;

  const itemType = ITEM_TYPES[item.type];
  const isUsable = itemType?.usable;
  
  let effectDisplay = '';
  if (item.healing) {
    effectDisplay += `<div class="popup-effect heal">❤️ 治疗: +${item.healing} HP</div>`;
  }
  if (item.manaRestore) {
    effectDisplay += `<div class="popup-effect mana">💧 法力: +${item.manaRestore} MP</div>`;
  }
  if (item.damage) {
    effectDisplay += `<div class="popup-effect damage">⚔️ 伤害: ${item.damage[0]}-${item.damage[1]}</div>`;
  }
  if (item.shield) {
    effectDisplay += `<div class="popup-effect shield">🛡️ 护盾: ${item.shield}</div>`;
  }
  if (item.statBonus) {
    const bonusText = Object.entries(item.statBonus).map(([stat, value]) => {
      const statNames = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
      return `${statNames[stat] || stat} +${value}`;
    }).join(', ');
    effectDisplay += `<div class="popup-effect bonus">📈 ${bonusText}</div>`;
  }

  const rarityColors = {
    common: '#9e9e9e',
    uncommon: '#4caf50',
    rare: '#2196f3',
    epic: '#9c27b0',
    legendary: '#ff9800'
  };

  const popup = document.createElement('div');
  popup.id = 'item-popup';
  popup.className = 'item-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    background: var(--bg-panel);
    border: 2px solid ${rarityColors[item.rarity] || '#9e9e9e'};
    border-radius: 12px;
    padding: 20px;
    min-width: 280px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5);
  `;
  
  popup.innerHTML = `
    <div class="popup-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-dark);">
      <span style="font-size: 3rem;">${item.icon}</span>
      <div>
        <div class="popup-name" style="font-family: var(--font-display); font-size: 1.2rem; color: ${rarityColors[item.rarity] || '#9e9e9e'}; font-weight: 700;">${item.name}</div>
        <div class="popup-type" style="font-size: 0.85rem; color: var(--text-muted);">${itemType?.name || '物品'}</div>
      </div>
    </div>
    <div class="popup-body" style="margin-bottom: 16px;">
      <div class="popup-desc" style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px;">${item.description || ''}</div>
      ${effectDisplay ? `<div class="popup-effects" style="display: flex; flex-direction: column; gap: 6px;">${effectDisplay}</div>` : ''}
    </div>
    <div class="popup-actions" style="display: flex; gap: 10px;">
      ${isUsable ? `<button class="popup-btn use-btn" onclick="useItem(${index})">使用</button>` : ''}
      <button class="popup-btn discard-btn" onclick="discardItem(${index})">丢弃</button>
      <button class="popup-btn close-btn" onclick="closeItemPopup()">关闭</button>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.id = 'item-popup-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 9999;
  `;
  overlay.onclick = closeItemPopup;
  
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

function closeItemPopup() {
  const popup = document.getElementById('item-popup');
  const overlay = document.getElementById('item-popup-overlay');
  if (popup) popup.remove();
  if (overlay) overlay.remove();
}

function discardItem(index) {
  const item = GameState.inventory[index];
  if (!item) return;
  
  const itemName = item.name;
  if (item.quantity && item.quantity > 1) {
    item.quantity--;
  } else {
    GameState.inventory.splice(index, 1);
  }
  
  showNotification(`已丢弃 ${item.icon} ${itemName}`);
  closeItemPopup();
  renderSidebarInventory();
  GameState.save();
}

function useItem(index) {
  const item = GameState.inventory[index];
  if (!item) return;

  const itemType = ITEM_TYPES[item.type];
  if (!itemType?.usable) {
    showNotification('该物品无法使用');
    closeItemPopup();
    return;
  }

  const player = GameState.character;
  let message = '';

  if (item.healing) {
    const healAmount = Math.min(item.healing, player.maxHp - player.hp);
    player.hp += healAmount;
    message = `${item.icon} 使用${item.name}，恢复了 ${healAmount} 点生命值！`;
  }

  if (item.manaRestore) {
    const manaAmount = Math.min(item.manaRestore, player.maxMana - player.mana);
    player.mana += manaAmount;
    message = `${item.icon} 使用${item.name}，恢复了 ${manaAmount} 点法力值！`;
  }

  if (item.statBonus) {
    const bonusTexts = [];
    for (const [stat, value] of Object.entries(item.statBonus)) {
      player.stats[stat] = (player.stats[stat] || 10) + value;
      const statNames = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
      bonusTexts.push(`${statNames[stat] || stat}+${value}`);
    }
    
    const attrs = calculateAllAttributes(player.stats);
    player.maxHp = attrs.maxHp;
    player.maxMana = attrs.maxMana;
    
    if (player.hp > player.maxHp) player.hp = player.maxHp;
    if (player.mana > player.maxMana) player.mana = player.maxMana;
    
    message = `${item.icon} 使用${item.name}，${bonusTexts.join(', ')}！`;
  }

  if (item.effect === 'heal' && item.healing) {
    const healAmount = Math.min(item.healing, player.maxHp - player.hp);
    player.hp += healAmount;
    message = `${item.icon} 使用${item.name}，恢复了 ${healAmount} 点生命值！`;
  }

  if (item.effect === 'damage' && item.damage && combatState.active) {
    const damage = rollDice(item.damage[0], item.damage[1]);
    combatState.enemyHp -= damage;
    message = `${item.icon} 使用${item.name}，对敌人造成 ${damage} 点伤害！`;
    
    if (combatState.enemyHp <= 0) {
      combatState.enemyHp = 0;
      combatUpdateUI();
      combatEndCombat('victory');
    }
  }

  if (item.effect === 'shield' && item.shield && combatState.active) {
    combatState.shieldActive = true;
    combatState.shieldAmount = item.shield;
    message = `${item.icon} 使用${item.name}，获得 ${item.shield} 点护盾！`;
  }

  if (item.quantity && item.quantity > 1) {
    item.quantity--;
  } else {
    GameState.inventory.splice(index, 1);
  }

  showNotification(message || `使用了 ${item.name}`);
  
  closeItemPopup();
  updatePlayerStatsDisplay();
  renderSidebarInventory();
  GameState.save();
}