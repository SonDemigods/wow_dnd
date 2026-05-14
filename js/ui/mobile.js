/**
 * Mobile UI Module
 * Handles mobile-specific interactions and UI updates
 */

let currentMobilePanel = null;

function showMobilePanel(panelName) {
  const overlay = document.getElementById('mobile-panel-overlay');
  const panel = document.getElementById(`mobile-${panelName}-panel`);
  
  if (!overlay || !panel) return;
  
  closeMobilePanel();
  
  currentMobilePanel = panelName;
  
  overlay.classList.add('active');
  panel.classList.add('active');
  
  document.body.classList.add('mobile-panel-scrolling');
  
  updateMobileNavActive(panelName);
  
  switch (panelName) {
    case 'character':
      updateMobileCharacterPanel();
      break;
    case 'world':
      updateMobileLocationList();
      break;
    case 'inventory':
      updateMobileInventory();
      break;
    case 'quests':
      updateMobileQuests();
      break;
    case 'explore':
      updateMobileExploration();
      break;
  }
}

function closeMobilePanel() {
  const overlay = document.getElementById('mobile-panel-overlay');
  const activePanel = document.querySelector('.mobile-panel.active');
  
  if (overlay) overlay.classList.remove('active');
  if (activePanel) activePanel.classList.remove('active');
  
  document.body.classList.remove('mobile-panel-scrolling');
  
  currentMobilePanel = null;
}

function updateMobileNavActive(panelName) {
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeItem = document.querySelector(`.mobile-nav-item[data-nav="${panelName}"]`);
  if (activeItem) activeItem.classList.add('active');
}

function updateMobileCharacterPanel() {
  const player = GameState.character;
  
  const avatar = document.getElementById('mobile-avatar');
  const name = document.getElementById('mobile-name');
  const cls = document.getElementById('mobile-class');
  
  if (avatar) avatar.textContent = player.classIcon || player.raceIcon || '🧙';
  if (name) name.textContent = player.name || '冒险者';
  if (cls) cls.textContent = `${player.raceName} ${player.className} · Lv${player.level}`;
  
  updateMobilePlayerStatsDisplay();
}

function updateMobilePlayerStatsDisplay() {
  const player = GameState.character;
  
  const hpText = document.getElementById('mobile-hp-text');
  const hpBar = document.getElementById('mobile-hp-bar');
  const manaText = document.getElementById('mobile-mana-text');
  const manaBar = document.getElementById('mobile-mana-bar');
  const expText = document.getElementById('mobile-exp-text');
  const expBar = document.getElementById('mobile-exp-bar');
  
  if (hpText) hpText.textContent = `${player.hp}/${player.maxHp}`;
  if (hpBar) hpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  if (manaText) manaText.textContent = `${player.mana}/${player.maxMana}`;
  if (manaBar) manaBar.style.width = `${(player.mana / player.maxMana) * 100}%`;
  if (expText) expText.textContent = `${player.exp}/${player.expToNextLevel}`;
  if (expBar) expBar.style.width = `${(player.exp / player.expToNextLevel) * 100}%`;
  
  const str = document.getElementById('mobile-str');
  const dex = document.getElementById('mobile-dex');
  const con = document.getElementById('mobile-con');
  const int = document.getElementById('mobile-int');
  const wis = document.getElementById('mobile-wis');
  const cha = document.getElementById('mobile-cha');
  
  if (str) str.textContent = player.stats.str;
  if (dex) dex.textContent = player.stats.dex;
  if (con) con.textContent = player.stats.con;
  if (int) int.textContent = player.stats.int;
  if (wis) wis.textContent = player.stats.wis;
  if (cha) cha.textContent = player.stats.cha;
  
  updateMobileCharacterAttributes();
}

function updateMobileCharacterAttributes() {
  const player = GameState.character;
  const attrs = calculateAllAttributes(player.stats);
  
  const physAtk = document.getElementById('mobile-phys-atk');
  const physDef = document.getElementById('mobile-phys-def');
  const magicAtk = document.getElementById('mobile-magic-atk');
  const magicDef = document.getElementById('mobile-magic-def');
  const crit = document.getElementById('mobile-crit');
  const dodge = document.getElementById('mobile-dodge');
  
  if (physAtk) physAtk.textContent = attrs.physicalAttack;
  if (physDef) physDef.textContent = attrs.physicalDefense;
  if (magicAtk) magicAtk.textContent = attrs.magicAttack;
  if (magicDef) magicDef.textContent = attrs.magicDefense;
  if (crit) crit.textContent = attrs.critChance + '%';
  if (dodge) dodge.textContent = attrs.dodgeChance + '%';
}

function updateMobileLocationList() {
  const container = document.getElementById('mobile-location-list');
  if (!container) return;
  
  container.innerHTML = renderLocationCards();
}

function updateMobileInventory() {
  const goldElement = document.getElementById('mobile-gold');
  if (goldElement) goldElement.textContent = GameState.character.gold;
  
  updateMobileBackpackList();
  updateMobileSpellsList();
}

function updateMobileBackpackList() {
  const container = document.getElementById('mobile-backpack-list');
  if (!container) return;
  
  if (typeof renderInventoryGrid === 'function') {
    const html = renderInventoryGrid('mobile-backpack-list', 'mobile');
    container.innerHTML = html;
  } else {
    const inventory = GameState.character.inventory || [];
    container.innerHTML = renderMobileInventorySlots(inventory);
  }
}

function updateMobileSpellsList() {
  const container = document.getElementById('mobile-spells-list');
  if (!container) return;
  
  const abilities = getClassAbilities();
  
  if (abilities.length === 0) {
    container.innerHTML = `
      <div class="empty-list-message">
        <span style="font-size: 2rem;">✨</span>
        <span>无法术</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = abilities.map((ability, index) => {
    let effectText = '';
    let effectType = '';
    if (ability.damage) {
      effectText = `⚔️ ${ability.damage[0]}-${ability.damage[1]}`;
      effectType = 'damage';
    } else if (ability.healing) {
      effectText = `💚 ${ability.healing[0]}-${ability.healing[1]}`;
      effectType = 'heal';
    } else if (ability.shield) {
      effectText = `🛡️ ${ability.shield}`;
      effectType = 'shield';
    }
    
    return `
      <div class="spell-grid-item" onclick="showSpellPopup(${index})" style="cursor: pointer;">
        <div class="spell-grid-icon">${ability.icon}</div>
        <div class="spell-grid-info">
          <div class="spell-grid-name">${ability.name}</div>
          <div class="spell-grid-effect ${effectType}">${effectText}</div>
        </div>
        <div class="spell-grid-cost">💧 ${ability.manaCost}</div>
      </div>
    `;
  }).join('');
}

function renderMobileInventorySlots(inventory) {
  const maxSlots = 16;
  let html = '';
  
  for (let i = 0; i < maxSlots; i++) {
    const item = inventory[i];
    if (item) {
      html += `
        <div class="inventory-slot filled" onclick="showItemPopup(${i})" style="display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
          ${item.icon || '📦'}
          ${item.quantity > 1 ? `<span class="inventory-slot-quantity">${item.quantity}</span>` : ''}
        </div>
      `;
    } else {
      html += `<div class="inventory-slot"></div>`;
    }
  }
  
  return html;
}

function switchMobileInventoryTab(tabName) {
  const tabs = document.querySelectorAll('#mobile-inventory-panel .panel-tab');
  tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.textContent.includes(tabName === 'backpack' ? '背包' : '法术')) {
      tab.classList.add('active');
    }
  });
  
  const backpackList = document.getElementById('mobile-backpack-list');
  const spellsList = document.getElementById('mobile-spells-list');
  
  if (backpackList) backpackList.style.display = tabName === 'backpack' ? 'grid' : 'none';
  if (spellsList) spellsList.style.display = tabName === 'spells' ? 'grid' : 'none';
}

function updateMobileQuests() {
  const container = document.getElementById('mobile-quests-list');
  if (!container) return;
  
  if (typeof renderQuestList === 'function') {
    const html = renderQuestList('mobile');
    container.innerHTML = html;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 10px;">📜</p>
        <p>暂无任务</p>
      </div>
    `;
  }
}

function updateMobileExploration() {
  const location = LOCATIONS[GameState.location];
  const hasLocation = !!location;
  
  const zoneContainer = document.getElementById('mobile-zone-container');
  const zoneEmpty = document.getElementById('mobile-zone-empty');
  
  if (zoneContainer) zoneContainer.style.display = hasLocation ? 'block' : 'none';
  if (zoneEmpty) zoneEmpty.style.display = hasLocation ? 'none' : 'block';
  
  if (hasLocation) {
    const zoneIcon = document.getElementById('mobile-zone-icon');
    const zoneName = document.getElementById('mobile-zone-name');
    const steps = document.getElementById('mobile-exploration-steps');
    const revealed = document.getElementById('mobile-exploration-revealed');
    
    if (zoneIcon) zoneIcon.textContent = location.icon;
    if (zoneName) zoneName.textContent = location.displayName;
    if (steps) steps.textContent = GameState.exploration.steps || 0;
    if (revealed) revealed.textContent = GameState.exploration.revealed?.length || 0;
  }
}

function syncMobileUI() {
  if (currentMobilePanel) {
    switch (currentMobilePanel) {
      case 'character':
        updateMobileCharacterPanel();
        break;
      case 'inventory':
        updateMobileInventory();
        break;
      case 'quests':
        updateMobileQuests();
        break;
      case 'explore':
        updateMobileExploration();
        break;
    }
  }
}

function initMobileUI() {
  if (typeof updateAllUI === 'function') {
    const originalUpdateAllUI = updateAllUI;
    updateAllUI = function() {
      originalUpdateAllUI();
      syncMobileUI();
    };
  }
  
  if (typeof updatePlayerStatsDisplay === 'function') {
    const originalUpdatePlayerStatsDisplay = updatePlayerStatsDisplay;
    updatePlayerStatsDisplay = function() {
      originalUpdatePlayerStatsDisplay();
      updateMobilePlayerStatsDisplay();
    };
  }
  
  if (typeof updateCharacterPanel === 'function') {
    const originalUpdateCharacterPanel = updateCharacterPanel;
    updateCharacterPanel = function() {
      originalUpdateCharacterPanel();
      updateMobileCharacterPanel();
    };
  }
  
  if (typeof updateGoldDisplay === 'function') {
    const originalUpdateGoldDisplay = updateGoldDisplay;
    updateGoldDisplay = function() {
      originalUpdateGoldDisplay();
      const mobileGold = document.getElementById('mobile-gold');
      if (mobileGold) mobileGold.textContent = GameState.character.gold;
    };
  }
  
  if (typeof switchMainTab === 'function') {
    const originalSwitchMainTab = switchMainTab;
    switchMainTab = function(tab) {
      originalSwitchMainTab(tab);
      closeMobilePanel();
    };
  }
  
  if (typeof selectLocationKey === 'function') {
    const originalSelectLocationKey = selectLocationKey;
    selectLocationKey = function(locationKey) {
      originalSelectLocationKey(locationKey);
      updateMobileExploration();
    };
  }
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeMobilePanel();
    }
  });
  
  const overlay = document.getElementById('mobile-panel-overlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeMobilePanel();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileUI);
} else {
  initMobileUI();
}
