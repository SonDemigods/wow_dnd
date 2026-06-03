<template>
  <div v-if="visible" class="combat-overlay">
    <div class="combat-container">
      <!-- 标题 -->
      <div class="combat-header">
        <span class="combat-title">{{ isBossFight ? 'BOSS 战斗！' : '遭遇战斗！' }}</span>
        <span class="combat-turn">第 {{ turnCount }} 回合</span>
      </div>

      <!-- 战斗区域：敌人 + 玩家 -->
      <div class="combat-arena">
        <!-- 敌人区域 -->
        <div class="combatant enemy-side">
          <div class="combatant-avatar">{{ enemy?.icon || '👹' }}</div>
          <div class="combatant-info">
            <div class="combatant-name">{{ enemy?.name || '未知敌人' }}</div>
            <div class="combatant-level">Lv.{{ enemy?.level || 1 }}</div>
          </div>
          <div class="combatant-bars">
            <div class="bar-row">
              <span class="bar-label">HP</span>
              <div class="bar-track hp-track">
                <div class="bar-fill hp-fill" :style="{ width: enemyHpPercent + '%' }"></div>
              </div>
              <span class="bar-text">{{ enemyHp }}/{{ enemyMaxHp }}</span>
            </div>
          </div>
        </div>

        <!-- VS 分隔 -->
        <div class="vs-divider">⚔️</div>

        <!-- 玩家区域 -->
        <div class="combatant player-side">
          <div class="combatant-avatar">{{ playerIcon }}</div>
          <div class="combatant-info">
            <div class="combatant-name">{{ playerName }}</div>
            <div class="combatant-level">Lv.{{ playerLevel }}</div>
          </div>
          <div class="combatant-bars">
            <div class="bar-row">
              <span class="bar-label">HP</span>
              <div class="bar-track hp-track">
                <div class="bar-fill hp-fill" :style="{ width: playerHpPercent + '%' }"></div>
              </div>
              <span class="bar-text">{{ playerHp }}/{{ playerMaxHp }}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">MP</span>
              <div class="bar-track mp-track">
                <div class="bar-fill mp-fill" :style="{ width: playerMpPercent + '%' }"></div>
              </div>
              <span class="bar-text">{{ playerMp }}/{{ playerMaxMp }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 战斗日志 -->
      <div class="combat-log" ref="logRef">
        <div v-for="(log, i) in logs" :key="i" :class="['log-entry', 'log-' + log.actorType]">
          <span class="log-turn">[{{ log.turn }}]</span>
          <span class="log-msg">{{ log.message }}</span>
          <span v-if="log.damage && log.damage > 0" class="log-damage">-{{ log.damage }}</span>
          <span v-if="log.heal && log.heal > 0" class="log-heal">+{{ log.heal }}</span>
          <span v-if="log.isCrit" class="log-crit">暴击！</span>
          <span v-if="log.isDodge" class="log-dodge">闪避！</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">战斗即将开始...</div>
      </div>

      <!-- 行动按钮区域 -->
      <div class="combat-actions" v-if="isPlayerTurn && isFighting">
        <!-- 第一行：普通攻击 | 物品 | 跳过 | 逃跑 -->
        <div class="action-row primary-actions">
          <button class="action-btn attack-btn" @click="doAction('attack')" :disabled="isAnimating">
            ⚔️ 普通攻击
          </button>
          <button class="action-btn item-btn" @click="openItemModal" :disabled="isAnimating || !hasConsumables">
            💊 物品
          </button>
          <button class="action-btn skip-btn" @click="doSkip" :disabled="isAnimating">
            ⏭️ 跳过
          </button>
          <button class="action-btn flee-btn" @click="doAction('flee')" :disabled="isAnimating || isBossFight">
            🏃 逃跑
          </button>
        </div>
        <!-- 第二行：技能 -->
        <div class="action-row skill-actions" v-if="equippedSkills.length > 0">
          <button
            v-for="skill in equippedSkills"
            :key="skill.id"
            class="action-btn skill-btn"
            :class="{ 'no-mp': playerMp < skill.mpCost }"
            @click="doSkill(skill.id)"
            :disabled="isAnimating || playerMp < skill.mpCost"
          >
            <span class="skill-icon">{{ getSkillTypeIcon(skill.type) }}</span>
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-effect">{{ getSkillEffectText(skill) }}</span>
            <span class="skill-cost">{{ skill.mpCost }} MP</span>
          </button>
        </div>
      </div>

      <!-- 等待敌人回合 -->
      <div class="combat-actions waiting" v-if="!isPlayerTurn && isFighting">
        <span class="waiting-text">敌人行动中...</span>
      </div>

      <!-- 战斗结束 -->
      <div class="combat-result" v-if="combatResult">
        <div :class="['result-text', 'result-' + combatResult]">
          {{ resultText }}
        </div>
        <div class="result-rewards" v-if="combatResult === 'victory'">
          <span v-if="expGained > 0">⭐ +{{ expGained }} 经验</span>
          <span v-if="goldGained > 0">💰 +{{ goldGained }} 金币</span>
        </div>
        <div class="result-countdown" v-if="autoCloseCountdown > 0">
          {{ autoCloseCountdown }} 秒后自动关闭
        </div>
      </div>
    </div>

    <!-- 物品选择弹窗 -->
    <div v-if="showItemModal" class="item-modal-overlay" @click.self="showItemModal = false">
      <div class="item-modal">
        <div class="item-modal-header">
          <span>选择物品</span>
          <button class="item-modal-close" @click="showItemModal = false">✕</button>
        </div>
        <div class="item-modal-body">
          <div
            v-for="item in consumableItems"
            :key="item.itemId"
            class="item-option"
            @click="useItem(item.itemId, item.index)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-desc">{{ item.description }}</span>
            </div>
            <span class="item-count">x{{ item.count }}</span>
          </div>
          <div v-if="consumableItems.length === 0" class="item-empty">没有可用的物品</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { combatService } from '@/modules/combat/service';
import { characterService } from '@/modules/character/service';
import { skillsService } from '@/modules/skill/service';
import { inventoryService } from '@/modules/inventory/service';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { CombatLog, CombatResult, CombatActionType, CombatEndEvent } from '@/modules/combat/types';
import type { Enemy } from '@/modules/enemy/types';
import type { Skill } from '@/modules/skill/types';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close', result?: CombatResult): void;
}>();

const logRef = ref<HTMLElement | null>(null);
const isAnimating = ref(false);
const combatResult = ref<CombatResult | null>(null);
const expGained = ref(0);
const goldGained = ref(0);
const showItemModal = ref(false);
const autoCloseCountdown = ref(0);
let autoCloseTimer: ReturnType<typeof setInterval> | null = null;
let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

// 战斗状态
const turn = ref<'player' | 'enemy'>('player');
const turnCount = ref(1);
const enemy = ref<Enemy | null>(null);
const logs = ref<CombatLog[]>([]);

// 玩家数据
const playerName = computed(() => characterService.getName());
const playerLevel = computed(() => characterService.getCharacterInfo().level || 1);
const playerIcon = computed(() => '🧑');
const playerHp = computed(() => characterService.getCharacterInfo().hp || 0);
const playerMaxHp = computed(() => characterService.getCharacterInfo().maxHp || 1);
const playerMp = computed(() => characterService.getCharacterInfo().mana || 0);
const playerMaxMp = computed(() => characterService.getCharacterInfo().maxMana || 1);
const playerHpPercent = computed(() => Math.max(0, Math.min(100, (playerHp.value / playerMaxHp.value) * 100)));
const playerMpPercent = computed(() => Math.max(0, Math.min(100, (playerMp.value / playerMaxMp.value) * 100)));

// 敌人数据
const enemyHp = computed(() => enemy.value?.hp || 0);
const enemyMaxHp = computed(() => enemy.value?.maxHp || 1);
const enemyHpPercent = computed(() => Math.max(0, Math.min(100, (enemyHp.value / enemyMaxHp.value) * 100)));
const isBossFight = computed(() => enemy.value?.isBoss || false);

// 状态
const isPlayerTurn = computed(() => turn.value === 'player');
const isFighting = computed(() => !combatResult.value);

// 可用技能：优先装备的，没有则显示已解锁的
const equippedSkills = computed<Skill[]>(() => {
  try {
    const equipped = skillsService.getEquippedSkills();
    if (equipped && equipped.length > 0) return equipped;
    // 没有装备技能时，回退到已解锁技能
    const unlocked = skillsService.getUnlockedSkills();
    return (unlocked || []).slice(0, 4);
  } catch {
    return [];
  }
});

// 消耗品物品
const consumableItems = computed(() => {
  try {
    const inventory = inventoryService.getInventory();
    return inventory
      .map((invItem, index) => {
        const info = inventoryService.getItemInfo(invItem.itemId);
        if (!info || !info.consumable) return null;
        return {
          index,
          itemId: invItem.itemId,
          count: invItem.count,
          name: info.name,
          icon: info.icon || '📦',
          description: buildItemDescription(info)
        };
      })
      .filter(Boolean) as { index: number; itemId: string; count: number; name: string; icon: string; description: string }[];
  } catch {
    return [];
  }
});

const hasConsumables = computed(() => consumableItems.value.length > 0);

function buildItemDescription(info: { hpRestore?: number; mpRestore?: number; description?: string }): string {
  const parts: string[] = [];
  if (info.hpRestore && info.hpRestore > 0) parts.push(`HP+${info.hpRestore}`);
  if (info.mpRestore && info.mpRestore > 0) parts.push(`MP+${info.mpRestore}`);
  return parts.length > 0 ? parts.join(' ') : (info.description || '');
}

const skillTypeIcons: Record<string, string> = {
  physical_damage: '⚔️',
  magic_damage: '🔮',
  heal: '💚'
};

function getSkillTypeIcon(type: string): string {
  return skillTypeIcons[type] || '✨';
}

function getSkillEffectText(skill: Skill): string {
  const effect = skill.effect;
  if (!effect) return '';
  const value = effect.value || 0;
  const coeff = effect.coefficient ? `x${effect.coefficient}` : '';
  switch (effect.type) {
    case 'physical_damage': return `物伤${value}${coeff}`;
    case 'magic_damage': return `魔伤${value}${coeff}`;
    case 'heal': return `治疗${value}${coeff}`;
    default: return '';
  }
}

const resultText = computed(() => {
  switch (combatResult.value) {
    case 'victory': return '战斗胜利！';
    case 'defeat': return '战斗失败...';
    case 'fled': return '成功逃跑！';
    default: return '';
  }
});

function updateState() {
  turn.value = combatService.getTurn();
  turnCount.value = combatService.getTurnCount();
  enemy.value = combatService.getEnemy();
  logs.value = [...combatService.getCombatLog()];
  nextTick(() => scrollToBottom());
}

function scrollToBottom() {
  if (logRef.value) {
    logRef.value.scrollTop = logRef.value.scrollHeight;
  }
}

// 执行玩家动作后进入敌人回合
function doAction(type: CombatActionType) {
  if (isAnimating.value || combatResult.value) return;
  isAnimating.value = true;

  combatService.playerAction({ type });
  updateState();

  if (!combatResult.value) {
    runEnemyTurn();
  } else {
    isAnimating.value = false;
  }
}

// 使用技能
function doSkill(skillId: string) {
  if (isAnimating.value || combatResult.value) return;
  isAnimating.value = true;

  combatService.playerAction({ type: 'skill', skillId });
  updateState();

  if (!combatResult.value) {
    runEnemyTurn();
  } else {
    isAnimating.value = false;
  }
}

// 跳过回合
function doSkip() {
  if (isAnimating.value || combatResult.value) return;
  isAnimating.value = true;

  runEnemyTurn();
}

// 使用物品
function openItemModal() {
  if (hasConsumables.value) {
    showItemModal.value = true;
  }
}

function useItem(_itemId: string, _index: number) {
  if (isAnimating.value || combatResult.value) return;
  showItemModal.value = false;
  isAnimating.value = true;

  combatService.playerAction({ type: 'item', itemId: _itemId });
  updateState();

  if (!combatResult.value) {
    runEnemyTurn();
  } else {
    isAnimating.value = false;
  }
}

// 执行敌人回合
function runEnemyTurn() {
  setTimeout(() => {
    turn.value = 'enemy';
    updateState();

    setTimeout(() => {
      combatService.enemyTurn();
      updateState();
      turn.value = combatService.getTurn();
      isAnimating.value = false;
    }, 800);
  }, 500);
}

// 监听战斗结束事件（在 cleanup 之前由战斗服务发出）
function onCombatEnd(data: CombatEndEvent) {
  combatResult.value = data.result;
  expGained.value = data.expGained || 0;
  goldGained.value = data.enemy?.goldReward || 0;
  isAnimating.value = false;
  updateState();
  scheduleAutoClose();
}

// 战斗结束后延迟自动关闭
function scheduleAutoClose() {
  clearAutoClose();
  const delay = combatResult.value === 'victory' ? 3 : 2;
  autoCloseCountdown.value = delay;

  autoCloseTimer = setInterval(() => {
    autoCloseCountdown.value--;
    if (autoCloseCountdown.value <= 0) {
      // 只清除 interval，timeout 会自动触发 handleClose
      if (autoCloseTimer) {
        clearInterval(autoCloseTimer);
        autoCloseTimer = null;
      }
    }
  }, 1000);

  autoCloseTimeout = setTimeout(() => {
    clearAutoClose();
    handleClose();
  }, delay * 1000);
}

function clearAutoClose() {
  if (autoCloseTimer) {
    clearInterval(autoCloseTimer);
    autoCloseTimer = null;
  }
  if (autoCloseTimeout) {
    clearTimeout(autoCloseTimeout);
    autoCloseTimeout = null;
  }
  autoCloseCountdown.value = 0;
}

function handleClose() {
  clearAutoClose();
  emit('close', combatResult.value || undefined);
}

// 监听玩家回合事件
function onCombatPlayerTurn() {
  turn.value = 'player';
  updateState();
}

onMounted(() => {
  eventBus.on(GameEvents.COMBAT_PLAYER_TURN, onCombatPlayerTurn);
  eventBus.on(GameEvents.COMBAT_END, onCombatEnd);
});

onUnmounted(() => {
  eventBus.off(GameEvents.COMBAT_PLAYER_TURN, onCombatPlayerTurn);
  eventBus.off(GameEvents.COMBAT_END, onCombatEnd);
  clearAutoClose();
});

watch(() => props.visible, (val) => {
  if (val) {
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;
    isAnimating.value = false;
    showItemModal.value = false;
    autoCloseCountdown.value = 0;
    clearAutoClose();
    updateState();
  } else {
    clearAutoClose();
  }
});
</script>

<style scoped>
.combat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.92);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.combat-container {
  width: 95%;
  max-width: 700px;
  max-height: 95vh;
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid #4a4a4a;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

/* 标题 */
.combat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid #333;
}

.combat-title {
  font-size: 18px;
  font-weight: 700;
  color: #e94560;
}

.combat-turn {
  font-size: 13px;
  color: #888;
}

/* 战斗区域 */
.combat-arena {
  display: flex;
  align-items: stretch;
  padding: 16px;
  gap: 12px;
}

.combatant {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #333;
}

.enemy-side { border-color: #e94560; }
.player-side { border-color: #00d2d3; }

.combatant-avatar {
  font-size: 36px;
  text-align: center;
}

.combatant-info { text-align: center; }

.combatant-name {
  font-size: 16px;
  font-weight: 700;
  color: #f0f0f0;
}

.combatant-level {
  font-size: 12px;
  color: #ffd700;
  margin-top: 2px;
}

.combatant-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-label {
  font-size: 11px;
  color: #888;
  width: 22px;
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 14px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 7px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 7px;
  transition: width 0.4s ease;
}

.hp-fill { background: linear-gradient(90deg, #e94560, #ff6b6b); }
.mp-fill { background: linear-gradient(90deg, #3b82f6, #60a5fa); }

.bar-text {
  font-size: 11px;
  color: #aaa;
  min-width: 55px;
  text-align: left;
}

.vs-divider {
  display: flex;
  align-items: center;
  font-size: 24px;
  color: #ffd700;
}

/* 战斗日志 */
.combat-log {
  flex: 1;
  min-height: 100px;
  max-height: 160px;
  margin: 0 16px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  overflow-y: auto;
  border: 1px solid #2a2a3e;
}

.log-entry {
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.5;
  color: #ccc;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.log-player .log-msg { color: #60a5fa; }
.log-enemy .log-msg { color: #f87171; }
.log-system .log-msg { color: #fbbf24; }

.log-turn {
  color: #666;
  font-size: 11px;
}

.log-damage {
  color: #ff4444;
  font-weight: 700;
  font-size: 14px;
  animation: popIn 0.3s ease;
}

.log-heal {
  color: #4CAF50;
  font-weight: 700;
  font-size: 14px;
  animation: popIn 0.3s ease;
}

.log-crit {
  color: #ffd700;
  font-weight: 700;
  font-size: 12px;
  animation: popIn 0.3s ease;
}

.log-dodge {
  color: #888;
  font-weight: 700;
  font-size: 12px;
}

.log-empty {
  color: #555;
  text-align: center;
  padding: 20px 0;
  font-style: italic;
}

/* 行动按钮 */
.combat-actions {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.action-btn {
  padding: 10px 8px;
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: #666;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.attack-btn:hover:not(:disabled) {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.15);
}

.item-btn:hover:not(:disabled) {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.15);
}

.skip-btn:hover:not(:disabled) {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
}

.flee-btn:hover:not(:disabled) {
  border-color: #888;
  background: rgba(136, 136, 136, 0.15);
}

.skill-btn {
  border-color: #8b5cf6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
}

.skill-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.15);
  border-color: #a78bfa;
}

.skill-btn.no-mp {
  border-color: #555;
}

.skill-icon { font-size: 18px; }
.skill-name { font-size: 12px; font-weight: 600; }
.skill-effect {
  font-size: 10px;
  color: #fbbf24;
}
.skill-cost {
  font-size: 10px;
  color: #60a5fa;
}

.continue-btn {
  margin-top: 12px;
  background: rgba(255, 215, 0, 0.15);
  border-color: #ffd700;
  color: #ffd700;
  grid-column: 1 / -1;
}

.continue-btn:hover {
  background: rgba(255, 215, 0, 0.25);
}

.waiting { justify-content: center; }

.waiting-text {
  color: #888;
  font-size: 14px;
  animation: pulse 1.5s infinite;
}

/* 战斗结果 */
.combat-result {
  padding: 20px;
  text-align: center;
}

.result-text {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
}

.result-victory { color: #ffd700; }
.result-defeat { color: #e94560; }
.result-fled { color: #888; }

.result-rewards {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 16px;
  font-size: 16px;
  color: #ffd700;
}

.result-countdown {
  font-size: 13px;
  color: #888;
  margin-top: 8px;
}

/* 物品选择弹窗 */
.item-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-modal {
  width: 90%;
  max-width: 400px;
  max-height: 60vh;
  background: linear-gradient(145deg, #1a1a2e, #16213e);
  border: 2px solid #4a4a4a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.item-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid #333;
  font-size: 16px;
  font-weight: 700;
  color: #ffd700;
}

.item-modal-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}

.item-modal-close:hover { color: #fff; }

.item-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.item-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.item-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.item-option .item-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.item-option .item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-option .item-name {
  font-size: 14px;
  color: #f0f0f0;
  font-weight: 600;
}

.item-option .item-desc {
  font-size: 11px;
  color: #888;
}

.item-option .item-count {
  font-size: 13px;
  color: #aaa;
  flex-shrink: 0;
}

.item-empty {
  text-align: center;
  padding: 24px;
  color: #555;
  font-style: italic;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes popIn {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* 移动端 */
@media (max-width: 600px) {
  .combat-arena {
    flex-direction: column;
    padding: 10px;
    gap: 8px;
  }

  .vs-divider { display: none; }

  .combatant-avatar { font-size: 28px; }

  .combat-log {
    min-height: 80px;
    max-height: 120px;
  }

  .action-row {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .action-btn {
    font-size: 11px;
    padding: 8px 4px;
  }

  .skill-btn { padding: 6px 4px; }
  .skill-icon { font-size: 16px; }
  .skill-name { font-size: 10px; }
  .skill-effect { font-size: 9px; }
  .skill-cost { font-size: 9px; }
}
</style>
