
/**
 * Layout Control Module
 * Handles tab switching and layout management
 */

let currentTab = 'world';

function switchMainTab(tabId) {
  currentTab = tabId;
  
  document.querySelectorAll('.main-tab').forEach(t => {
    if (t) t.classList.remove('active');
  });
  const targetTab = document.querySelector(`.main-tab[data-main-tab="${tabId}"]`);
  if (targetTab) targetTab.classList.add('active');
  
  document.querySelectorAll('.main-tab-content').forEach(c => {
    if (c) c.classList.remove('active');
  });
  const targetContent = document.getElementById(`${tabId}-tab`);
  if (targetContent) targetContent.classList.add('active');
  
  if (tabId === 'world') {
    renderWorldLocations();
  } else if (tabId === 'zone') {
    initZoneView();
  }
}

function initZoneView() {
  const location = LOCATIONS[GameState.location];
  
  const container = document.getElementById('zone-container');
  const empty = document.getElementById('zone-empty');
  
  if (!location) {
    if (container) container.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }
  
  if (empty) empty.style.display = 'none';
  if (container) container.style.display = 'flex';
  
  const zoneIcon = document.getElementById('zone-icon');
  const zoneName = document.getElementById('zone-name');
  if (zoneIcon) zoneIcon.textContent = location.icon;
  if (zoneName) zoneName.textContent = location.displayName + ' 探索';
  
  const mapState = getOrCreateMapState(location.name);
  const stepsEl = document.getElementById('exploration-steps');
  const revealedEl = document.getElementById('exploration-revealed');
  if (stepsEl) stepsEl.textContent = mapState.steps;
  if (revealedEl) revealedEl.textContent = mapState.revealedCount;
  
  initExplorationGrid();
}
