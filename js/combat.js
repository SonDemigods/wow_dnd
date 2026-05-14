
/**
 * Combat System Module
 * Handles combat logic, ability usage, and damage calculation
 */

function startCombatFromMap(enemyKey, cellIndex) {
  const enemyData = ENEMIES[enemyKey];
  if (!enemyData) return;
  
  combatState.currentCellIndex = cellIndex;
  showCombatOverlay(enemyKey);
}

function combatRenderAbilityButtons() {
  const abilities = getClassAbilities();
  return abilities.map((ability, index) => {
    let effectText = '';
    if (ability.damage) {
      effectText = `⚔️${ability.damage[0]}-${ability.damage[1]}`;
    } else if (ability.healing) {
      effectText = `💚${ability.healing[0]}-${ability.healing[1]}`;
    } else if (ability.shield) {
      effectText = `🛡️${ability.shield}`;
    }
    
    return `
      <button class="ability-btn" onclick="combatUseAbility(${index})" id="ability-${index}" title="${getAbilityDescription(ability)}">
        <span class="ability-icon">${ability.icon}</span>
        <span class="ability-name">${ability.name}</span>
        <span class="ability-effect">${effectText}</span>
        <span class="ability-cost">💧${ability.manaCost}</span>
      </button>
    `;
  }).join('');
}

function getAbilityDescription(ability) {
  if (ability.damage) {
    return `造成 ${ability.damage[0]}-${ability.damage[1]} 点伤害`;
  } else if (ability.healing) {
    return `恢复 ${ability.healing[0]}-${ability.healing[1]} 点生命`;
  } else if (ability.shield) {
    return `获得 ${ability.shield} 点护盾`;
  }
  return '';
}

function showCombatOverlay(enemyKey) {
  const existingOverlay = document.getElementById('combat-overlay');
  if (existingOverlay) return;

  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) mobileNav.style.display = 'none';

  const bgOverlay = document.createElement('div');
  bgOverlay.id = 'combat-overlay-bg';
  bgOverlay.className = 'combat-overlay-bg';
  document.body.appendChild(bgOverlay);

  const particles = document.createElement('div');
  particles.id = 'combat-particles';
  particles.className = 'combat-particles';
  document.body.appendChild(particles);

  const overlay = document.createElement('div');
  overlay.id = 'combat-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1002;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    overflow-y: auto;
    padding: 20px;
  `;

  overlay.innerHTML = renderCombatContent(enemyKey);
  document.body.appendChild(overlay);
  startCombat(enemyKey);
}

function renderCombatContent(enemyKey) {
  const player = GameState.character;
  const enemy = ENEMIES[enemyKey];

  return `
    <div class="combat-container">
      <div class="combat-main">
        <div class="combat-header">
          <div class="combat-title">⚔️ 战斗 ⚔️</div>
          <div class="combat-enemy-intro">
            <span class="intro-icon">${enemy.icon}</span>
            <span class="intro-text">遭遇 ${enemy.name}</span>
          </div>
        </div>

        <div class="combat-arena">
          <div class="combatant player">
            <div class="combatant-visual">
              <div class="combatant-avatar-large" id="player-combat-icon">${player.classIcon || player.raceIcon || '🧙'}</div>
              <div class="combatant-status" id="player-status"></div>
            </div>
            <div class="combatant-details">
              <div class="combatant-name">${player.name}</div>
              <div class="combatant-level">Lv.${player.level} ${player.className}</div>
            </div>
            <div class="combatant-bars">
              <div class="bar-row">
                <span class="bar-label">❤️ HP</span>
                <div class="bar-container hp-bar">
                  <div class="bar-fill" id="combat-hp-bar" style="width: ${(player.hp / player.maxHp) * 100}%"></div>
                </div>
                <span class="bar-value" id="combat-hp-text">${player.hp}/${player.maxHp}</span>
              </div>
              <div class="bar-row">
                <span class="bar-label">💧 MP</span>
                <div class="bar-container mana-bar">
                  <div class="bar-fill" id="combat-mana-bar" style="width: ${(player.mana / player.maxMana) * 100}%"></div>
                </div>
                <span class="bar-value" id="combat-mana-text">${player.mana}/${player.maxMana}</span>
              </div>
            </div>
          </div>

          <div class="vs-divider">
            <span>VS</span>
          </div>

          <div class="combatant enemy">
            <div class="combatant-visual">
              <div class="combatant-avatar-large enemy-avatar" id="enemy-combat-icon">${enemy.icon}</div>
              <div class="combatant-status enemy-status" id="enemy-status"></div>
            </div>
            <div class="combatant-details">
              <div class="combatant-name enemy-name">${enemy.name}</div>
              <div class="combatant-level danger">${enemy.dangerLevel}</div>
            </div>
            <div class="combatant-bars">
              <div class="bar-row">
                <span class="bar-label">❤️ HP</span>
                <div class="bar-container hp-bar enemy">
                  <div class="bar-fill" id="enemy-hp-bar" style="width: 100%"></div>
                </div>
                <span class="bar-value" id="enemy-hp-text">${enemy.hp}/${enemy.hp}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="combat-abilities">
          <div class="abilities-title">✨ 技能</div>
          <div class="abilities-grid" id="ability-buttons">
            ${combatRenderAbilityButtons()}
          </div>
        </div>

        <div class="combat-actions">
          <button class="action-btn attack-btn" id="btn-attack" onclick="combatPlayerAttack()">
            <span class="btn-icon">⚔️</span>
            <span class="btn-text">普通攻击</span>
          </button>
          <button class="action-btn flee-btn" id="btn-flee" onclick="combatTryFlee()">
            <span class="btn-icon">🏃</span>
            <span class="btn-text">尝试逃跑</span>
          </button>
        </div>

        <div class="combat-result" id="combat-result" style="display: none;"></div>
      </div>

      <div class="combat-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">📜 战斗日志</span>
        </div>
        <div class="combat-log-container">
          <div class="combat-log" id="combat-log">
            <div class="log-entry system">⚔️ 战斗开始！</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function startCombat(enemyKey) {
  const enemyData = ENEMIES[enemyKey];
  if (!enemyData) return;

  combatState.active = true;
  combatState.enemy = enemyKey;
  combatState.enemyHp = enemyData.hp;
  combatState.enemyMaxHp = enemyData.hp;
  combatState.playerTurn = true;
  combatState.combatEnded = false;
  combatState.shieldActive = false;

  combatUpdateUI();
  combatClearLog();
  combatAddLog(`${enemyData.icon} ${enemyData.name} 出现了！`, 'system');
  combatAddLog(`它有 ${enemyData.hp} 点生命值，准备战斗！`, 'system');
  combatUpdateButtons();
}

function combatUpdateUI() {
  const player = GameState.character;

  const combatHpText = document.getElementById('combat-hp-text');
  const combatHpBar = document.getElementById('combat-hp-bar');
  const combatManaText = document.getElementById('combat-mana-text');
  const combatManaBar = document.getElementById('combat-mana-bar');
  const playerCombatLevel = document.getElementById('player-combat-level');

  if (combatHpText) combatHpText.textContent = `${player.hp} / ${player.maxHp}`;
  if (combatHpBar) combatHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  if (combatManaText) combatManaText.textContent = `${player.mana} / ${player.maxMana}`;
  if (combatManaBar) combatManaBar.style.width = `${(player.mana / player.maxMana) * 100}%`;
  if (playerCombatLevel) playerCombatLevel.textContent = `等级 ${player.level}`;

  const enemyData = ENEMIES[combatState.enemy];
  if (enemyData) {
    const enemyHpText = document.getElementById('enemy-hp-text');
    const enemyHpBar = document.getElementById('enemy-hp-bar');
    if (enemyHpText) enemyHpText.textContent = `${combatState.enemyHp} / ${combatState.enemyMaxHp}`;
    if (enemyHpBar) enemyHpBar.style.width = `${(combatState.enemyHp / combatState.enemyMaxHp) * 100}%`;
  }
}

function combatUpdateButtons() {
  const player = GameState.character;
  const abilities = getClassAbilities();
  
  abilities.forEach((ability, index) => {
    const btn = document.getElementById(`ability-${index}`);
    if (btn) {
      btn.disabled = player.mana < ability.manaCost || !combatState.active || !combatState.playerTurn || combatState.combatEnded;
    }
  });

  const btnAttack = document.getElementById('btn-attack');
  const btnFlee = document.getElementById('btn-flee');
  if (btnAttack) btnAttack.disabled = !combatState.active || !combatState.playerTurn || combatState.combatEnded;
  if (btnFlee) btnFlee.disabled = !combatState.active || !combatState.playerTurn || combatState.combatEnded;
}

function combatPlayerAttack() {
  if (!combatState.active || !combatState.playerTurn || combatState.combatEnded) return;

  combatState.playerTurn = false;

  const player = GameState.character;
  const attrs = calculateAllAttributes(player.stats);
  const attackRoll = rollD20();
  const totalAttack = attackRoll + attrs.physicalAttack;

  const enemyData = ENEMIES[combatState.enemy];
  const enemyAC = 10 + Math.floor(enemyData.xp / 20);

  combatAddLog(`你投掷: ${attackRoll} + ${attrs.physicalAttack}(物攻) = ${totalAttack}`, 'system');

  const playerIcon = document.getElementById('player-combat-icon');
  if (playerIcon) {
    playerIcon.style.animation = 'none';
    playerIcon.offsetHeight;
    playerIcon.style.animation = 'attackShake 0.3s ease';
  }

  if (totalAttack >= enemyAC) {
    let baseDamage = rollDice(1, 6) + attrs.physicalAttack;
    let isCrit = Math.random() * 100 < attrs.critChance;
    
    if (isCrit) {
      baseDamage = Math.floor(baseDamage * 1.5);
      combatAddLog(`💥 暴击！`, 'system');
      showCritFlash();
    }
    
    const damage = Math.max(1, baseDamage);

    setTimeout(() => {
      const enemyIcon = document.getElementById('enemy-combat-icon');
      if (enemyIcon) {
        enemyIcon.style.animation = 'none';
        enemyIcon.offsetHeight;
        enemyIcon.style.animation = 'hitRecoil 0.4s ease forwards';
      }
      showDamageNumber(damage, 'enemy', isCrit);
      triggerScreenShake();
    }, 150);

    combatState.enemyHp -= damage;
    combatAddLog(`${enemyData.icon} ${enemyData.name} 受到 ${damage} 点物理伤害！`, 'damage');

    if (combatState.enemyHp <= 0) {
      combatState.enemyHp = 0;
      combatUpdateUI();
      combatEndCombat('victory');
      return;
    }
  } else {
    combatAddLog(`你的攻击被 ${enemyData.name} 躲开了！`, 'system');
  }

  combatUpdateUI();
  combatUpdateButtons();

  setTimeout(() => {
    if (combatState.active && !combatState.combatEnded) {
      combatEnemyTurn();
    }
  }, 800);
}

function combatUseAbility(index) {
  if (!combatState.active || !combatState.playerTurn || combatState.combatEnded) return;

  const abilities = getClassAbilities();
  const ability = abilities[index];
  const player = GameState.character;
  const attrs = calculateAllAttributes(player.stats);
  
  if (!ability || player.mana < ability.manaCost) return;

  player.mana -= ability.manaCost;
  combatState.playerTurn = false;

  const enemyData = ENEMIES[combatState.enemy];

  const playerIcon = document.getElementById('player-combat-icon');
  if (playerIcon) {
    playerIcon.style.animation = 'none';
    playerIcon.offsetHeight;
    playerIcon.style.animation = 'attackShake 0.3s ease';
  }

  switch (ability.type) {
    case 'damage':
      let damage = rollDice(ability.damage[0], ability.damage[1]) + attrs.magicAttack;
      let isCrit = Math.random() * 100 < attrs.critChance;
      
      if (isCrit) {
        damage = Math.floor(damage * 1.5);
        combatAddLog(`💥 暴击！`, 'system');
        showCritFlash();
      }
      
      setTimeout(() => {
        const enemyIcon = document.getElementById('enemy-combat-icon');
        if (enemyIcon) {
          enemyIcon.style.animation = 'none';
          enemyIcon.offsetHeight;
          enemyIcon.style.animation = 'hitRecoil 0.4s ease forwards';
        }
        showDamageNumber(damage, 'enemy', isCrit);
        triggerScreenShake();
      }, 150);

      combatState.enemyHp -= damage;
      combatAddLog(`${ability.icon} ${ability.name} 对 ${enemyData.name} 造成 ${damage} 点魔法伤害！`, 'magic');

      if (combatState.enemyHp <= 0) {
        combatState.enemyHp = 0;
        combatUpdateUI();
        combatEndCombat('victory');
        return;
      }
      break;

    case 'heal':
      const healAmount = rollDice(ability.healing[0], ability.healing[1]) + attrs.healBonus;
      const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
      player.hp += actualHeal;
      
      setTimeout(() => {
        showHealEffect();
        showDamageNumber(actualHeal, 'player', false, true);
      }, 200);
      
      combatAddLog(`${ability.icon} ${ability.name} 恢复了 ${actualHeal} 点生命值！`, 'heal');
      break;

    case 'shield':
      combatState.shieldActive = true;
      combatState.shieldAmount = ability.shield || 30;
      showShieldEffect();
      combatAddLog(`${ability.icon} ${ability.name} 生效，获得 ${combatState.shieldAmount} 点护盾！`, 'magic');
      break;
  }

  combatUpdateUI();
  combatUpdateButtons();

  setTimeout(() => {
    if (combatState.active && !combatState.combatEnded) {
      combatEnemyTurn();
    }
  }, 800);
}

function combatEnemyTurn() {
  if (!combatState.active || combatState.combatEnded) return;

  const player = GameState.character;
  const attrs = calculateAllAttributes(player.stats);
  const enemyData = ENEMIES[combatState.enemy];
  const attackRoll = rollD20();
  const enemyBonus = Math.floor(enemyData.xp / 30);
  const totalAttack = attackRoll + enemyBonus;

  const playerAC = 10 + attrs.physicalDefense;

  combatAddLog(`${enemyData.icon} ${enemyData.name} 发起攻击...`, 'system');

  const enemyIcon = document.getElementById('enemy-combat-icon');
  if (enemyIcon) {
    enemyIcon.style.animation = 'none';
    enemyIcon.offsetHeight;
    enemyIcon.style.animation = 'attackShake 0.3s ease';
  }

  const dodgeChance = attrs.dodgeChance / 100;
  if (Math.random() < dodgeChance) {
    combatAddLog(`👻 你灵巧地闪避了攻击！`, 'system');
  } else if (totalAttack >= playerAC) {
    let damage = rollDice(enemyData.damage[0], enemyData.damage[1]);

    if (combatState.shieldActive) {
      const shieldAmount = combatState.shieldAmount || 30;
      if (damage <= shieldAmount) {
        combatState.shieldActive = false;
        combatAddLog(`🛡️ 护盾吸收了全部 ${damage} 点伤害！`, 'magic');
        damage = 0;
      } else {
        damage -= shieldAmount;
        combatState.shieldActive = false;
        combatAddLog(`🛡️ 护盾吸收了 ${shieldAmount} 点伤害！`, 'magic');
      }
    }

    if (damage > 0) {
      damage = Math.max(1, damage - attrs.physicalDefense);
      
      setTimeout(() => {
        const playerIcon = document.getElementById('player-combat-icon');
        if (playerIcon) {
          playerIcon.style.animation = 'none';
          playerIcon.offsetHeight;
          playerIcon.style.animation = 'hitRecoil 0.4s ease forwards';
        }
        showDamageNumber(damage, 'player', false);
        triggerScreenShake();
      }, 150);

      player.hp -= damage;
      combatAddLog(`${enemyData.icon} ${enemyData.name} 对你造成 ${damage} 点伤害！`, 'damage');

      if (player.hp <= 0) {
        player.hp = 0;
        combatUpdateUI();
        combatEndCombat('defeat');
        return;
      }
    }
  } else {
    combatAddLog(`你躲开了 ${enemyData.name} 的攻击！`, 'system');
  }

  combatState.playerTurn = true;
  combatUpdateUI();
  combatUpdateButtons();
}

function combatTryFlee() {
  if (!combatState.active || !combatState.playerTurn || combatState.combatEnded) return;

  const player = GameState.character;
  const fleeChance = 0.4 + (player.stats.dex - 10) * 0.02;

  combatAddLog('你试图逃跑...', 'system');

  if (Math.random() < fleeChance) {
    combatAddLog('🏃 成功逃脱了战斗！', 'system');
    combatEndCombat('fled');
  } else {
    combatAddLog('🏃 逃跑失败了！', 'system');
    combatState.playerTurn = false;
    setTimeout(() => {
      if (combatState.active && !combatState.combatEnded) {
        combatEnemyTurn();
      }
    }, 800);
  }
}

function combatEndCombat(result) {
  combatState.combatEnded = true;
  combatState.active = false;

  const btnAttack = document.getElementById('btn-attack');
  const btnFlee = document.getElementById('btn-flee');
  if (btnAttack) btnAttack.disabled = true;
  if (btnFlee) btnFlee.disabled = true;
  combatUpdateButtons();

  const resultDiv = document.getElementById('combat-result');
  const player = GameState.character;

  if (resultDiv) {
    resultDiv.style.display = 'block';

    if (result === 'victory') {
      const enemyData = ENEMIES[combatState.enemy];

      player.exp += enemyData.xp;
      player.gold += enemyData.gold;

      combatAddLog(`🎉 你击败了 ${enemyData.name}！`, 'system');
      combatAddLog(`获得 ${enemyData.xp} 点经验值`, 'system');
      combatAddLog(`💰 获得 ${enemyData.gold} 金币`, 'system');

      resultDiv.className = 'combat-result victory';
      resultDiv.innerHTML = `🎉 胜利！<br><small>击败 ${enemyData.name}，获得 ${enemyData.xp} XP 和 ${enemyData.gold} 金币</small>`;

      if (Math.random() < 0.3) {
        const loot = { ...LOOT_ITEMS[Math.floor(Math.random() * LOOT_ITEMS.length)] };
        if (typeof addItemToInventory === 'function' && addItemToInventory(loot)) {
          combatAddLog(`📦 战利品: ${loot.icon} ${loot.name} 已添加到背包`, 'system');
        }
      }

      updateQuestProgress(combatState.enemy);
      checkLevelUp();
      
      const cellIndex = combatState.currentCellIndex;
      if (cellIndex !== undefined && cellIndex !== null) {
        setTimeout(() => {
          markCellCompleted(cellIndex);
        }, 500);
      }

    } else if (result === 'defeat') {
      resultDiv.className = 'combat-result defeat';
      resultDiv.innerHTML = `💀 战败...<br><small>你被 ${ENEMIES[combatState.enemy].name} 击败了</small>`;
      combatAddLog('💀 你被击败了...', 'damage');

      const lostExp = player.exp;
      player.exp = 0;
      player.hp = Math.floor(player.maxHp * 0.5);
      player.mana = Math.floor(player.maxMana * 0.5);
      
      if (lostExp > 0) {
        combatAddLog(`💔 损失了 ${lostExp} 点经验值！`, 'damage');
      }
      combatAddLog('你休息后恢复了部分生命值和法力值', 'heal');
      
      const cellIndex = combatState.currentCellIndex;
      if (cellIndex !== undefined && cellIndex !== null) {
        setTimeout(() => {
          markCellCompleted(cellIndex);
        }, 500);
      }

    } else if (result === 'fled') {
      resultDiv.className = 'combat-result escaped';
      resultDiv.innerHTML = `🏃 成功逃脱<br><small>你可以再次挑战</small>`;
      combatAddLog('🏃 怪物仍然守在那里...', 'system');
    }
  }

  GameState.save();
  updatePlayerStats();

  setTimeout(() => {
    combatAfterCombatReturn();
  }, 3000);
}

function combatAfterCombatReturn() {
  const overlay = document.getElementById('combat-overlay');
  if (overlay) overlay.remove();
  
  const bgOverlay = document.getElementById('combat-overlay-bg');
  if (bgOverlay) bgOverlay.remove();
  
  const particles = document.getElementById('combat-particles');
  if (particles) particles.remove();
  
  combatState.currentCellIndex = null;

  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) {
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    mobileNav.style.display = isMobile ? 'flex' : 'none';
  }
}

function combatAddLog(message, type = 'system') {
  const log = document.getElementById('combat-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function combatClearLog() {
  const log = document.getElementById('combat-log');
  if (log) log.innerHTML = '';
}

function showDamageNumber(value, target, isCrit = false, isHeal = false) {
  const wrapper = document.querySelector('.combat-main');
  if (!wrapper) return;
  
  const damageNum = document.createElement('div');
  damageNum.className = `damage-number ${isHeal ? 'heal' : 'damage'} ${isCrit ? 'crit' : ''}`;
  damageNum.textContent = isHeal ? `+${value}` : `-${value}`;
  
  const targetIcon = target === 'enemy' 
    ? document.getElementById('enemy-combat-icon')
    : document.getElementById('player-combat-icon');
  
  if (targetIcon) {
    const rect = targetIcon.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    
    damageNum.style.left = `${rect.left - wrapperRect.left + rect.width / 2 - 20}px`;
    damageNum.style.top = `${rect.top - wrapperRect.top}px`;
  } else {
    damageNum.style.left = '50%';
    damageNum.style.top = '50%';
  }
  
  wrapper.appendChild(damageNum);
  
  setTimeout(() => {
    if (damageNum.parentNode) {
      damageNum.remove();
    }
  }, 1000);
}

function showCritFlash() {
  const wrapper = document.querySelector('.combat-main');
  if (!wrapper) return;
  
  const flash = document.createElement('div');
  flash.className = 'crit-flash';
  wrapper.appendChild(flash);
  
  setTimeout(() => {
    if (flash.parentNode) {
      flash.remove();
    }
  }, 300);
}

function triggerScreenShake() {
  const wrapper = document.querySelector('.combat-main');
  if (!wrapper) return;
  
  wrapper.classList.add('screen-shake');
  setTimeout(() => {
    wrapper.classList.remove('screen-shake');
  }, 300);
}

function showHealEffect() {
  const playerIcon = document.getElementById('player-combat-icon');
  if (!playerIcon) return;
  
  const healGlow = document.createElement('div');
  healGlow.className = 'heal-glow';
  playerIcon.parentElement.appendChild(healGlow);
  
  setTimeout(() => {
    if (healGlow.parentNode) {
      healGlow.remove();
    }
  }, 800);
}

function showShieldEffect() {
  const playerIcon = document.getElementById('player-combat-icon');
  if (!playerIcon) return;
  
  const status = document.getElementById('player-status');
  if (status) {
    status.textContent = '🛡️';
  }
}