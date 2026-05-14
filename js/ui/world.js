/**
 * World Map UI Module
 * Handles world map rendering and interaction
 */

function renderWorldLocations() {
  const container = document.getElementById('location-list');
  if (!container) return;

  const playerLevel = GameState.character.level;
  const currentLocation = GameState.location;

  const continentLocations = {};
  Object.entries(LOCATIONS).forEach(([key, location]) => {
    if (!continentLocations[location.continent]) {
      continentLocations[location.continent] = [];
    }
    continentLocations[location.continent].push({ key, ...location });
  });

  let html = `
    <div class="world-map-container">
      <div class="azeroth-map-bg"></div>
      <div class="map-overlay">
  `;

  Object.entries(continentLocations).forEach(([continentKey, locations]) => {
    const continent = CONTINENTS[continentKey];
    
    locations.forEach(loc => {
      const isAvailable = playerLevel >= loc.levelRange[0];
      const isCurrent = loc.key === currentLocation;
      const isRecommended = playerLevel >= loc.levelRange[0] && playerLevel <= loc.levelRange[1];

      let statusClass = '';
      if (isCurrent) {
        statusClass = 'current';
      } else if (!isAvailable) {
        statusClass = 'locked';
      } else if (isRecommended) {
        statusClass = 'recommended';
      }

      html += `
        <div 
          class="map-location ${statusClass}" 
          style="left: ${loc.mapX}%; top: ${loc.mapY}%;"
          onclick="${isAvailable || isCurrent ? `selectLocation('${loc.key}')` : ''}"
          data-location="${loc.key}"
          data-continent="${continentKey}"
        >
          <div class="location-icon">${loc.icon}</div>
          <div class="location-tooltip">
            <div class="tooltip-title">${loc.displayName}</div>
            <div class="tooltip-level">等级 ${loc.levelRange[0]} - ${loc.levelRange[1]}</div>
            ${isCurrent ? '<div class="tooltip-status current">当前</div>' : ''}
          </div>
        </div>
      `;
    });
  });

  html += `
      </div>
      <div class="map-legend">
        <div class="legend-item">
          <span class="legend-dot current"></span>
          <span>当前</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot available"></span>
          <span>可探索</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot locked"></span>
          <span>未解锁</span>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function selectLocation(locationKey) {
  const location = LOCATIONS[locationKey];
  if (!location) return;

  console.log('切换到区域:', locationKey);
  GameState.location = locationKey;
  
  // 清空冒险日志
  GameState.adventureLog = [];
  GameState.save();
  
  // 更新日志显示
  if (typeof renderAdventureLog === 'function') {
    renderAdventureLog();
  }

  // 直接添加任务，避免函数调用问题
  const availableQuests = Object.values(QUESTS).filter(q => q.locationKey === locationKey);
  console.log('为该区域找到任务:', availableQuests.length);
  
  availableQuests.forEach(questData => {
    if (!GameState.quests.find(q => q.key === questData.key)) {
      GameState.quests.push({
        key: questData.key,
        completed: false,
        objectives: questData.objectives.map(obj => ({
          ...obj,
          progress: 0
        }))
      });
      showNotification(`📜 接受任务: ${questData.name}`);
    }
  });
  
  if (availableQuests.length > 0) {
    GameState.save();
    if (typeof updateSidebarQuests === 'function') {
      updateSidebarQuests();
    }
  }

  showNotification(`📍 已前往 ${location.displayName}`);

  if (typeof switchMainTab === 'function') {
    switchMainTab('zone');
  }
}
