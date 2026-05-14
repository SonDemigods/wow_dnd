/**
 * Quest System Module
 * Handles quest management and progress updates
 */

function initQuests() {
  // 初始化时自动添加当前区域任务
  if (GameState.location) {
    addLocationQuests(GameState.location);
  }
  updateSidebarQuests();
}

function addLocationQuests(locationKey) {
  console.log('正在为区域添加任务:', locationKey);
  
  const availableQuests = Object.values(QUESTS).filter(q => q.locationKey === locationKey);
  console.log('找到任务数量:', availableQuests.length);
  
  availableQuests.forEach(quest => {
    addQuest(quest.key);
  });
}

function addQuest(questKey) {
  console.log('尝试添加任务:', questKey);
  if (!QUESTS[questKey]) {
    console.log('任务不存在:', questKey);
    return;
  }
  if (GameState.quests.find(q => q.key === questKey)) {
    console.log('任务已存在:', questKey);
    return;
  }

  GameState.quests.push({
    key: questKey,
    completed: false,
    objectives: QUESTS[questKey].objectives.map(obj => ({
      ...obj,
      progress: 0
    }))
  });
  GameState.save();
  updateSidebarQuests();
  console.log('成功添加任务:', QUESTS[questKey].name);
  showNotification(`📜 接受任务: ${QUESTS[questKey].name}`);
}

function updateQuestProgress(enemyKey) {
  let updated = false;

  GameState.quests.forEach((quest) => {
    if (quest.completed) return;

    quest.objectives.forEach((obj) => {
      if (obj.type === 'kill' && obj.enemyKey === enemyKey) {
        obj.progress++;
        updated = true;
      }
    });

    // 检查任务是否完成
    const questData = QUESTS[quest.key];
    const allComplete = quest.objectives.every(obj => obj.progress >= obj.target);
    if (allComplete && !quest.completed) {
      completeQuest(quest);
    }
  });

  if (updated) {
    updateSidebarQuests();
    GameState.save();
  }
}

function completeQuest(questState) {
  questState.completed = true;
  const questData = QUESTS[questState.key];
  
  // 给予奖励
  GameState.character.exp += questData.reward.xp;
  GameState.character.gold += questData.reward.gold;
  
  showNotification(`🎉 完成任务: ${questData.name}！获得 ${questData.reward.xp} 经验，${questData.reward.gold} 金币！`);
  
  checkLevelUp();
}

function updateSidebarQuests() {
  const container = document.getElementById('sidebar-quests');
  if (!container) return;

  let html = '';
  const activeQuests = GameState.quests.filter(q => !q.completed);

  if (activeQuests.length === 0) {
    html = '<div class="empty-list-message"><span style="font-size: 2rem;">📜</span><span>暂无进行中的任务</span></div>';
  } else {
    activeQuests.forEach(quest => {
      const questData = QUESTS[quest.key];
      if (!questData) return;
      
      // 计算任务总进度
      const totalProgress = quest.objectives.reduce((acc, obj) => acc + obj.progress, 0);
      const totalTarget = quest.objectives.reduce((acc, obj) => acc + obj.target, 0);
      const progressPercent = Math.min(100, Math.round((totalProgress / totalTarget) * 100));

      html += `
        <div class="quest-item">
          <div class="quest-header">
            <div class="quest-title">${questData.name}</div>
            <div class="quest-progress-text">${totalProgress}/${totalTarget}</div>
          </div>
          <div class="quest-description">${questData.description}</div>
          ${quest.objectives.map(obj => {
            const enemy = ENEMIES[obj.enemyKey];
            const objProgress = Math.min(100, Math.round((obj.progress / obj.target) * 100));
            return `
              <div class="quest-objective">
                ${enemy ? enemy.icon : '⚔️'} ${obj.progress}/${obj.target} ${enemy ? enemy.name : obj.enemyKey}
              </div>
              <div class="quest-bar-container">
                <div class="quest-bar">
                  <div class="quest-bar-fill" style="width: ${objProgress}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    });

    // 显示已完成的任务数量
    const completedCount = GameState.quests.filter(q => q.completed).length;
    if (completedCount > 0) {
      html += `
        <div class="quest-completed-count">
          ✓ 已完成 ${completedCount} 个任务
        </div>
      `;
    }
  }

  container.innerHTML = html;
}
