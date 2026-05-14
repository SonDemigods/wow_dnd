
/**
 * Common UI Module
 * Handles UI updates, notifications, and game over
 */

function updateAllUI() {
  updateCharacterPanel();
  updateHeaderUI();
  if (typeof renderSidebarInventory === 'function') renderSidebarInventory();
  renderSidebarAbilities();
  updateQuickAbilityButtons();
}

function updateCharacterPanel() {
  const player = GameState.character;
  
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarName = document.getElementById('sidebar-name');
  const sidebarClass = document.getElementById('sidebar-class');
  
  if (sidebarAvatar) sidebarAvatar.textContent = player.classIcon || player.raceIcon || '🧙';
  if (sidebarName) sidebarName.textContent = player.name || '冒险者';
  if (sidebarClass) sidebarClass.textContent = `${player.raceName} ${player.className} · Lv${player.level}`;
  
  updatePlayerStatsDisplay();
  if (typeof renderSidebarInventory === 'function') renderSidebarInventory();
}

function updateHeaderUI() {
  const location = LOCATIONS[GameState.location];
  const headerZoneIcon = document.getElementById('header-zone-icon');
  const headerZoneName = document.getElementById('header-zone-name');
  const headerZoneType = document.getElementById('header-zone-type');
  const headerGold = document.getElementById('header-gold');
  
  if (headerZoneIcon) headerZoneIcon.textContent = location?.icon || '🏰';
  if (headerZoneName) headerZoneName.textContent = location?.displayName || '暴风城';
  if (headerZoneType) headerZoneType.textContent = location?.type || '区域';
  if (headerGold) headerGold.textContent = GameState.character.gold;
}

function updatePlayerStatsDisplay() {
  const player = GameState.character;
  
  const hpText = document.getElementById('sidebar-hp-text');
  const hpBar = document.getElementById('sidebar-hp-bar');
  const manaText = document.getElementById('sidebar-mana-text');
  const manaBar = document.getElementById('sidebar-mana-bar');
  const expText = document.getElementById('sidebar-exp-text');
  const expBar = document.getElementById('sidebar-exp-bar');
  
  if (hpText) hpText.textContent = `${player.hp}/${player.maxHp}`;
  if (hpBar) hpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  if (manaText) manaText.textContent = `${player.mana}/${player.maxMana}`;
  if (manaBar) manaBar.style.width = `${(player.mana / player.maxMana) * 100}%`;
  if (expText) expText.textContent = `${player.exp}/${player.expToNextLevel}`;
  if (expBar) expBar.style.width = `${(player.exp / player.expToNextLevel) * 100}%`;
  
  const statStr = document.getElementById('stat-str');
  const statDex = document.getElementById('stat-dex');
  const statCon = document.getElementById('stat-con');
  const statInt = document.getElementById('stat-int');
  const statWis = document.getElementById('stat-wis');
  const statCha = document.getElementById('stat-cha');
  
  if (statStr) statStr.textContent = player.stats.str;
  if (statDex) statDex.textContent = player.stats.dex;
  if (statCon) statCon.textContent = player.stats.con;
  if (statInt) statInt.textContent = player.stats.int;
  if (statWis) statWis.textContent = player.stats.wis;
  if (statCha) statCha.textContent = player.stats.cha;
  
  updateCharacterAttributes();
  updateHeaderUI();
  if (typeof renderSidebarInventory === 'function') renderSidebarInventory();
  updateQuickAbilityButtons();
}

function renderSidebarAbilities() {
  const container = document.getElementById('spells-list');
  if (!container) return;
  
  const abilities = getClassAbilities();
  
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(2, 1fr)';
  container.style.gap = '8px';
  
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

function showSpellPopup(index) {
  const abilities = getClassAbilities();
  const ability = abilities[index];
  if (!ability) return;
  
  let effectText = '';
  if (ability.damage) {
    effectText = `⚔️ 伤害: ${ability.damage[0]}-${ability.damage[1]} 点`;
  } else if (ability.healing) {
    effectText = `💚 治疗: ${ability.healing[0]}-${ability.healing[1]} 点`;
  } else if (ability.shield) {
    effectText = `🛡️ 护盾: ${ability.shield} 点`;
  }
  
  const existingPopup = document.getElementById('spell-popup');
  if (existingPopup) existingPopup.remove();
  
  const popup = document.createElement('div');
  popup.id = 'spell-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    background: var(--bg-panel);
    border: 2px solid var(--arcane-purple);
    border-radius: 12px;
    padding: 20px;
    min-width: 280px;
    box-shadow: 0 10px 40px rgba(107, 63, 160, 0.4), 0 0 20px rgba(107, 63, 160, 0.2);
  `;
  
  popup.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-dark);">
      <span style="font-size: 3rem;">${ability.icon}</span>
      <div>
        <div style="font-family: var(--font-display); font-size: 1.2rem; color: var(--arcane-light); font-weight: 700;">${ability.name}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">职业法术</div>
      </div>
    </div>
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px;">${effectText}</div>
      <div style="font-size: 0.85rem; color: var(--mana-blue-light);">💧 法力消耗: ${ability.manaCost}</div>
    </div>
    <div style="display: flex; justify-content: center;">
      <button onclick="closeSpellPopup()" style="padding: 10px 30px; background: var(--arcane-purple); color: white; border: none; border-radius: 6px; cursor: pointer; font-family: var(--font-display); font-size: 0.9rem;">关闭</button>
    </div>
  `;
  
  const overlay = document.createElement('div');
  overlay.id = 'spell-popup-overlay';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999;';
  overlay.onclick = closeSpellPopup;
  
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

function closeSpellPopup() {
  const popup = document.getElementById('spell-popup');
  const overlay = document.getElementById('spell-popup-overlay');
  if (popup) popup.remove();
  if (overlay) overlay.remove();
}

function getEffectIcon(type) {
  switch (type) {
    case 'damage': return '⚔️';
    case 'heal': return '💚';
    case 'shield': return '🛡️';
    default: return '✨';
  }
}

function updateQuickAbilityButtons() {
  
}

function updateGoldDisplay() {
  const sidebarGold = document.getElementById('sidebar-gold');
  if (sidebarGold) sidebarGold.textContent = GameState.character.gold;
}

function updateCharacterAttributes() {
  const player = GameState.character;
  const attrs = calculateAllAttributes(player.stats);

  const physAtk = document.getElementById('attr-phys-atk');
  const physDef = document.getElementById('attr-phys-def');
  const magicAtk = document.getElementById('attr-magic-atk');
  const magicDef = document.getElementById('attr-magic-def');
  const crit = document.getElementById('attr-crit');
  const dodge = document.getElementById('attr-dodge');

  if (physAtk) physAtk.textContent = attrs.physicalAttack;
  if (physDef) physDef.textContent = attrs.physicalDefense;
  if (magicAtk) magicAtk.textContent = attrs.magicAttack;
  if (magicDef) magicDef.textContent = attrs.magicDefense;
  if (crit) crit.textContent = attrs.critChance + '%';
  if (dodge) dodge.textContent = attrs.dodgeChance + '%';

  player.maxHp = attrs.maxHp;
  player.maxMana = attrs.maxMana;

  if (player.hp > player.maxHp) player.hp = player.maxHp;
  if (player.mana > player.maxMana) player.mana = player.maxMana;
}

function showNotification(message) {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 2500);
}

function showGameOver() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;
  overlay.innerHTML = `
    <div style="
      background: var(--bg-panel);
      border: 2px solid var(--blood-red);
      border-radius: 12px;
      padding: 40px;
      text-align: center;
    ">
      <div style="font-family: var(--font-display); font-size: 2.5rem; color: var(--blood-glow); margin-bottom: 24px;">💀 你已阵亡</div>
      <div style="margin-bottom: 32px; color: var(--text-muted);">
        <p>等级: ${GameState.character.level}</p>
      </div>
      <button class="btn btn-primary" onclick="restartGame()">🆕 重新开始</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function restartGame() {
  GameState.reset();
  localStorage.clear();
  location.reload();
}

function quickCastAbility(index) {
  if (!combatState.active) {
    showNotification('需要在战斗中才能使用法术！');
    return;
  }
  if (typeof combatUseAbility === 'function') {
    combatUseAbility(index);
  }
}

function selectLocationKey(locationKey) {
  if (locationKey === GameState.location) {
    switchMainTab('zone');
    return;
  }
  
  GameState.location = locationKey;
  
  // 清空冒险日志
  GameState.adventureLog = [];
  GameState.save();
  
  // 更新日志显示
  if (typeof renderAdventureLog === 'function') {
    renderAdventureLog();
  }
  
  updateHeaderUI();
  renderWorldLocations();
  switchMainTab('zone');
  
  if (particleSystem) {
    particleSystem.createMagicBurst(window.innerWidth / 2, window.innerHeight / 2, 'arcane', 40);
  }
}

function showStartScreen() {
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.classList.remove('hidden');
}

function hideStartScreen() {
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.classList.add('hidden');
}

function showCharacterCreation() {
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.classList.add('hidden');
  
  const createScreen = document.getElementById('character-create-screen');
  if (createScreen) createScreen.classList.remove('hidden');
  
  createState.currentStep = 1;
  createState.selectedFaction = null;
  createState.selectedRace = null;
  createState.selectedClass = null;
  
  updateCreateStepUI();
}

function selectFaction(factionKey) {
  createState.selectedFaction = factionKey;
  
  document.querySelectorAll('.faction-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.querySelector(`.faction-card[data-faction="${factionKey}"]`)?.classList.add('selected');
  
  renderRaceCards();
}

function renderRaceCards() {
  const container = document.getElementById('race-grid');
  if (!container) return;
  
  let html = '';
  const selectedFaction = createState.selectedFaction || 'alliance';
  
  for (const [key, race] of Object.entries(RACES)) {
    if (race.faction !== selectedFaction && race.faction !== 'neutral') continue;
    
    const factionInfo = race.faction === 'neutral' ? '<span style="color: #ffd700;">中立</span>' : '';
    html += `
      <div class="race-card" data-race="${key}" onclick="selectRace('${key}')">
        <div class="race-icon">${race.icon}</div>
        <div class="race-name">${race.name} ${factionInfo}</div>
        <div class="race-desc">${race.description}</div>
        <div class="race-bonus">${formatBonus(race.bonus)}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderClassCards() {
  const container = document.getElementById('class-grid');
  if (!container) return;
  
  let html = '';
  const selectedRace = createState.selectedRace;
  const raceData = RACES[selectedRace];
  const raceFaction = raceData?.faction || 'alliance';
  
  for (const [key, cls] of Object.entries(CLASSES)) {
    if (!cls.factions.includes(raceFaction)) continue;
    
    html += `
      <div class="class-card" data-class="${key}" onclick="selectClass('${key}')">
        <div class="class-icon">${cls.icon}</div>
        <div class="class-name">${cls.name}</div>
        <div class="class-desc">${cls.description}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function formatBonus(bonus) {
  const names = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
  return Object.entries(bonus).map(([stat, val]) => `+${val} ${names[stat]}`).join(' / ');
}

function selectRace(raceKey) {
  createState.selectedRace = raceKey;
  
  document.querySelectorAll('.race-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.querySelector(`.race-card[data-race="${raceKey}"]`)?.classList.add('selected');
  
  updateCreateStepUI();
}

function selectClass(classKey) {
  createState.selectedClass = classKey;
  
  document.querySelectorAll('.class-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.querySelector(`.class-card[data-class="${classKey}"]`)?.classList.add('selected');
  
  updateCreateStepUI();
}

function updateCreateStepUI() {
  const step = createState.currentStep;
  
  document.querySelectorAll('.step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (stepNum < step) s.classList.add('completed');
    if (stepNum === step) s.classList.add('active');
  });
  
  document.querySelectorAll('.create-step').forEach(s => {
    s.classList.remove('active');
  });
  
  const stepIds = ['faction', 'race', 'class', 'name'];
  document.getElementById(`step-${stepIds[step - 1]}`)?.classList.add('active');
  
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  
  if (btnBack) btnBack.style.display = step > 1 ? 'inline-block' : 'none';
  if (btnNext) {
    btnNext.textContent = step === 4 ? '创建角色' : '下一步';
  }
  
  if (step === 4) {
    updateSelectedSummary();
  }
}

function updateSelectedSummary() {
  const container = document.getElementById('selected-summary');
  if (!container) return;
  
  const race = RACES[createState.selectedRace];
  const cls = CLASSES[createState.selectedClass];
  const faction = FACTIONS[createState.selectedFaction];
  
  if (race && cls) {
    container.innerHTML = `
      <div class="summary-faction">
        <span class="summary-icon">${faction?.icon || ''}</span>
        <span class="summary-name">${faction?.name || ''}</span>
      </div>
      <div class="summary-race">
        <span class="summary-icon">${race.icon}</span>
        <span class="summary-name">${race.name}</span>
      </div>
      <span style="color: var(--text-muted);">·</span>
      <div class="summary-class">
        <span class="summary-icon">${cls.icon}</span>
        <span class="summary-name">${cls.name}</span>
      </div>
    `;
  }
}

function nextCreateStep() {
  if (createState.currentStep === 1) {
    if (!createState.selectedFaction) {
      showNotification('请选择一个阵营！');
      return;
    }
    createState.currentStep = 2;
    renderRaceCards();
  } else if (createState.currentStep === 2) {
    if (!createState.selectedRace) {
      showNotification('请选择一个种族！');
      return;
    }
    createState.currentStep = 3;
    renderClassCards();
  } else if (createState.currentStep === 3) {
    if (!createState.selectedClass) {
      showNotification('请选择一个职业！');
      return;
    }
    createState.currentStep = 4;
  } else if (createState.currentStep === 4) {
    const nameInput = document.getElementById('character-name-input');
    const name = nameInput?.value.trim();
    if (!name) {
      showNotification('请输入角色名称！');
      return;
    }
    createCharacter(name);
    return;
  }
  
  updateCreateStepUI();
}

function prevCreateStep() {
  if (createState.currentStep > 1) {
    createState.currentStep--;
    updateCreateStepUI();
  }
}

function createCharacter(name) {
  const race = RACES[createState.selectedRace];
  const cls = CLASSES[createState.selectedClass];
  
  const baseStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  for (const [stat, bonus] of Object.entries(race.bonus)) {
    baseStats[stat] += bonus;
  }
  
  const attrs = calculateAllAttributes(baseStats);
  
  GameState.character = {
    name: name,
    race: createState.selectedRace,
    raceName: race.name,
    raceIcon: race.icon,
    faction: race.faction,
    factionName: FACTIONS[race.faction]?.name || '中立',
    class: createState.selectedClass,
    className: cls.name,
    classIcon: cls.icon,
    level: 1,
    exp: 0,
    expToNextLevel: getExpForLevel ? getExpForLevel(2) : 100,
    hp: attrs.maxHp,
    maxHp: attrs.maxHp,
    mana: attrs.maxMana,
    maxMana: attrs.maxMana,
    stats: baseStats,
    gold: 50,
    inventory: [],
    location: 'stormwind'
  };
  
  GameState.save();
  showGameInterface();
  initQuests();
  showNotification(`欢迎来到艾泽拉斯，${name}！`);
}

const createState = {
  currentStep: 1,
  selectedFaction: null,
  selectedRace: null,
  selectedClass: null
};

function showGameInterface() {
  hideStartScreen();
  const createScreen = document.getElementById('character-create-screen');
  if (createScreen) createScreen.classList.add('hidden');
  updateAllUI();
  switchMainTab('world');
}

function onCharacterCreated() {
  showGameInterface();
  initQuests();
}

function restAction() {
  const player = GameState.character;
  if (player.hp < player.maxHp) {
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    updatePlayerStatsDisplay();
    showNotification('休息完成，生命值和法力值已恢复！');
    GameState.save();
  } else {
    showNotification('你已经完全恢复了！');
  }
}

function combat_updatePlayerStats() {
  updatePlayerStatsDisplay();
}

function combat_updateGoldDisplay() {
  updateGoldDisplay();
}

function combat_showNotification(message) {
  showNotification(message);
}

function combat_onCombatEnd() {
  updatePlayerStatsDisplay();
  updateAllUI();
  updateSidebarQuests();
}

function world_updatePlayerStats() {
  updatePlayerStatsDisplay();
}

function world_updateGoldDisplay() {
  updateGoldDisplay();
}

function world_showNotification(message) {
  showNotification(message);
}

function world_showGameOver() {
  showGameOver();
}

function switchInventoryTab(tabName) {
  // 更新Tab按钮状态
  document.querySelectorAll('.panel-fixed .panel-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.querySelector(`.panel-fixed .panel-tab[data-inventory-tab="${tabName}"]`);
  if (activeTab) activeTab.classList.add('active');

  // 切换内容面板
  const backpackContent = document.getElementById('backpack-content');
  const spellsContent = document.getElementById('spells-content');

  if (backpackContent) backpackContent.classList.add('hidden');
  if (spellsContent) spellsContent.classList.add('hidden');

  if (tabName === 'backpack' && backpackContent) {
    backpackContent.classList.remove('hidden');
  } else if (tabName === 'spells' && spellsContent) {
    spellsContent.classList.remove('hidden');
  }
}

// 任务面板Tab切换
function switchQuestPanelTab(tabName) {
  // 更新Tab按钮状态
  document.querySelectorAll('.sidebar-right .panel-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.querySelector(`.sidebar-right .panel-tab[data-panel-tab="${tabName}"]`);
  if (activeTab) activeTab.classList.add('active');

  // 切换内容面板
  document.querySelectorAll('.sidebar-right .panel-content').forEach(content => {
    content.classList.add('hidden');
  });

  if (tabName === 'quests') {
    const questsContent = document.getElementById('sidebar-quests');
    if (questsContent) questsContent.classList.remove('hidden');
  } else if (tabName === 'log') {
    const logContent = document.getElementById('sidebar-log');
    if (logContent) logContent.classList.remove('hidden');
    renderAdventureLogInPanel();
  }
}

// 在面板中渲染冒险日志
function renderAdventureLogInPanel() {
  const logContainer = document.getElementById('sidebar-log');
  if (!logContainer) return;

  if (GameState.adventureLog.length === 0) {
    logContainer.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 10px;">📖</p>
        <p>开始你的冒险吧！</p>
      </div>
    `;
    return;
  }

  logContainer.innerHTML = GameState.adventureLog.map(log => `
    <div class="log-entry ${log.type}">
      <span class="log-time">${log.timestamp}</span>
      <span class="log-message">${log.message}</span>
    </div>
  `).join('');
}

function confirmExit() {
  showExitConfirmDialog();
}

function showExitConfirmDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'exit-modal';
  overlay.onclick = (e) => {
    if (e.target === overlay) closeExitConfirmDialog();
  };
  
  overlay.innerHTML = `
    <div class="modal-box exit-modal-box">
      <div class="modal-icon">⚠️</div>
      <div class="modal-title">退出游戏</div>
      <div class="modal-message">确定要退出并删除所有进度吗？<br>此操作不可恢复！</div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="closeExitConfirmDialog()">取消</button>
        <button class="btn btn-danger" onclick="exitAndResetGame()">确定退出</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
}

function closeExitConfirmDialog() {
  const overlay = document.getElementById('exit-modal');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

function exitAndResetGame() {
  GameState.reset();
  const createScreen = document.getElementById('character-create-screen');
  if (createScreen) createScreen.classList.add('hidden');
  showStartScreen();
  closeExitConfirmDialog();
}
