<template>
  <div class="combat-overlay">
    <div class="combat-container">
      <!-- 屏幕闪白遮罩（暴击特效） -->
      <div ref="screenFlashRef" v-show="screenFlash" :class="['screen-flash', screenFlashType]"></div>

      <!-- Boss 出场演出遮罩（统一风格） -->
      <div v-if="showBossIntro" ref="bossIntroOverlayRef" class="boss-intro-overlay">
        <div class="boss-intro-content">
          <div ref="bossIntroIconRef" class="boss-intro-icon">{{ bossIntroIcon }}</div>
          <div ref="bossIntroNameRef" class="boss-intro-name">{{ bossIntroName }}</div>
          <div v-for="(line, i) in bossIntroLines" :key="i" :ref="(el) => { if (el) bossIntroLineRefs[i] = el as HTMLElement }" :class="['boss-intro-line', 'line-' + i]">
            {{ line }}
          </div>
        </div>
      </div>

      <!-- Boss 阶段转换特效 -->
      <div v-if="showPhaseTransition" :class="['phase-transition', 'phase-transition-' + phaseTransitionEffect]">
        <div ref="phaseBackdropRef" class="phase-transition-backdrop"></div>
        <div ref="phaseContentRef" class="phase-transition-content">
          <div class="phase-transition-label">阶段转换</div>
          <div class="phase-transition-text">{{ phaseTransitionName }}</div>
        </div>
      </div>

      <!-- 标题 -->
      <div class="combat-header">
        <span class="combat-title">{{ combatStore.hasBossEnemy ? '首领战斗！' : '遭遇战斗！' }}</span>
        <button class="speed-toggle" @click="toggleSpeed" :title="combatSpeed === 1 ? '切换2倍速' : '切换1倍速'">
          {{ combatSpeed === 1 ? '⚡1x' : '⚡⚡2x' }}
        </button>
        <span class="combat-turn">第 {{ turnCount }} 回合</span>
      </div>

      <!-- 战斗区域：敌人 + 玩家 -->
      <div class="combat-arena">
        <!-- 敌人区域（3×2 网格，程序区分前后排） -->
        <div class="enemy-grid">
          <div v-for="row in (['back', 'front'] as const)" :key="row" class="enemy-row">
            <div
              v-for="col in 3"
              :key="`${row}-${col}`"
              class="enemy-slot"
            >
              <template v-for="e in getEnemiesInSlot(row, col - 1)" :key="e.id">
                <div
                  :class="['combatant', 'enemy-side', {
                    'shake': enemyShakes[e.id],
                    'crit-shake': enemyCritShakes[e.id],
                    'dodge-blink': enemyDodgeBlinks[e.id],
                    'defeated': e.hp <= 0,
                    'targeted': combatStore.targetEnemyId === e.id && e.hp > 0
                  }]"
                  :data-enemy-shake="e.id"
                  @click="selectTarget(e.id)"
                >
                  <div class="combatant-avatar">{{ e.icon || '👹' }}</div>
                  <div class="combatant-info">
                    <div class="combatant-name">{{ e.name }}</div>
                    <div class="combatant-level">Lv.{{ e.level || 1 }}</div>
                    <div v-if="e.isBoss" class="boss-badge">👑 首领</div>
                  </div>
                  <div class="combatant-bars">
                    <ResourceBar icon="❤️" name="HP" :current="e.hp" :max="e.maxHp" :percent="getHpPercent(e)" type="hp" />
                  </div>
                  <!-- Buff/Debuff 效果指示器 -->
                  <div v-if="getEnemyEffectCount(e.id) > 0" class="effects-indicator enemy-effects">
                    <span v-for="eff in getEnemyEffects(e.id)" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type, isBuffEffect(eff.type) ? 'effect-buff' : 'effect-debuff']">
                      {{ getEffectIcon(eff.type) }} {{ effectLabels[eff.type] || eff.type }} {{ formatEffectValue(eff.type, eff.value) }} {{ eff.remainingTurns }}回合
                    </span>
                  </div>
                  <!-- 浮动伤害数字（每个敌人独立） -->
                  <div v-show="enemyFloatings[e.id]" :data-enemy-float="e.id" :class="['floating-damage', enemyFloatings[e.id]?.type || '']">
                    {{ enemyFloatings[e.id]?.text || '' }}
                  </div>
                </div>
              </template>
              <!-- 空槽位占位符 -->
              <div v-if="getEnemiesInSlot(row, col - 1).length === 0" class="combatant enemy-side enemy-empty">
                <div class="empty-avatar">⬛</div>
                <div class="empty-text">空位</div>
              </div>
            </div>
          </div>
        </div>

        <!-- VS 分隔 -->
        <div ref="vsDividerRef" class="vs-divider" :class="{ 'flash': vsFlash }">⚔️</div>

        <!-- 玩家区域 -->
        <div class="combatant player-side" :class="{ 'shake': playerShake, 'crit-shake': playerCritShake, 'dodge-blink': playerDodgeBlink }">
          <div class="combatant-avatar">{{ playerIcon }}</div>
          <div class="combatant-info">
            <div class="combatant-name">{{ playerName }}</div>
            <div class="combatant-level">Lv.{{ playerLevel }}</div>
          </div>
          <div class="combatant-bars">
            <ResourceBar icon="❤️" name="HP" :current="playerHp" :max="playerMaxHp" :percent="playerHpPercent" type="hp" />
            <ResourceBar icon="💧" name="MP" :current="playerMp" :max="playerMaxMp" :percent="playerMpPercent" type="mp" />
            <!-- Buff/Debuff 效果指示器 -->
            <template v-if="combatStore.playerEffects.effects.length > 0">
              <div class="effects-indicator">
                <span v-for="eff in combatStore.playerEffects.effects" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type, isBuffEffect(eff.type) ? 'effect-buff' : 'effect-debuff']">
                  {{ getEffectIcon(eff.type) }} {{ effectLabels[eff.type] || eff.type }} {{ formatEffectValue(eff.type, eff.value) }} {{ eff.remainingTurns }}回合
                </span>
              </div>
            </template>
          </div>
          <!-- 浮动伤害数字 -->
          <div v-show="playerFloating" :class="['floating-damage', playerFloating?.type || '']">
            {{ playerFloating?.text || '' }}
          </div>
        </div>
      </div>

      <!-- 战斗日志 -->
      <div class="combat-log" ref="logRef">
        <div v-for="(log, i) in logsReversed" :key="i" :class="['log-entry', 'log-' + log.actorType]">
          <span class="log-turn">[{{ log.turn }}]</span>
          <span class="log-msg">{{ log.message }}</span>
          <span v-if="log.damage && log.damage > 0" :class="['log-damage', getDamageTypeClass(log)]">
            {{ getDamageTypeIcon(log) }} -{{ log.damage }}
          </span>
          <span v-if="log.heal && log.heal > 0" class="log-heal">💚 +{{ log.heal }}</span>
          <span v-if="log.isCrit" class="log-crit">暴击！</span>
          <span v-if="log.isDodge" class="log-dodge">闪避！</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">战斗即将开始...</div>
      </div>

      <!-- 行动按钮区域 -->
      <div class="combat-actions">
        <div class="action-row primary-actions">
          <button class="action-btn attack-btn" @click="doAction('attack')" :disabled="!canAct">
            ⚔️ 普通攻击
          </button>
          <button class="action-btn item-btn" @click="openItemModal" :disabled="!canAct || !hasConsumables">
            💊 物品
          </button>
          <button class="action-btn skip-btn" @click="doSkip" :disabled="!canAct">
            ⏭️ 跳过
          </button>
          <button class="action-btn flee-btn" @click="doAction('flee')" :disabled="!canAct || combatStore.hasBossEnemy">
            🏃 逃跑
          </button>
        </div>
        <div class="action-row skill-actions" v-if="equippedSkills.length > 0">
          <button
            v-for="skill in equippedSkills"
            :key="skill.id"
            class="action-btn skill-btn"
            :class="{ 'no-mp': playerMp < skill.mpCost, 'on-cooldown': skillsStore.isOnCooldown(skill.id) }"
            @click="doSkill(skill.id)"
            :disabled="!canAct || playerMp < skill.mpCost || skillsStore.isOnCooldown(skill.id)"
          >
            <span class="skill-icon">{{ skill.icon }}</span>
            <span class="skill-name">{{ skill.name }}</span>
            <span :class="['skill-effect', `skill-effect-${skill.type}`]">{{ getSkillEffectText(skill) }}</span>
            <span class="skill-cost">{{ skill.mpCost }} MP</span>
            <span v-if="getTargetTypeText(skill.targetType)" class="skill-target">{{ getTargetTypeText(skill.targetType) }}</span>
            <span v-if="skillsStore.isOnCooldown(skill.id)" class="skill-cooldown">
              冷却 {{ skillsStore.getCooldownRemaining(skill.id) }}
            </span>
          </button>
        </div>
        <!-- 敌人回合遮罩 -->
        <div v-if="!isPlayerTurn && isFighting" class="enemy-turn-overlay">
          <span class="enemy-turn-text">⏳ 敌人行动中...</span>
        </div>
      </div>
    </div>

    <!-- 战斗结果弹窗 -->
    <div v-if="combatStore.combatResult" class="result-overlay">
      <div ref="resultPopupRef" class="result-popup">
        <div ref="resultIconRef" class="result-icon">{{ combatStore.combatResult === 'victory' ? '🏆' : combatStore.combatResult === 'defeat' ? '💀' : '🏃' }}</div>
        <div ref="resultTextRef" :class="['result-text', 'result-' + combatStore.combatResult]">
          {{ resultText }}
        </div>
        <div class="result-rewards" v-if="combatStore.combatResult === 'victory'">
          <div v-if="combatStore.expGained > 0" class="reward-item">⭐ +{{ combatStore.expGained }} 经验</div>
          <div v-if="combatStore.goldGained > 0" class="reward-item">💰 +{{ combatStore.goldGained }} 金币</div>
        </div>
        <div class="result-countdown" v-if="autoCloseCountdown > 0">
          {{ autoCloseCountdown }} 秒后自动关闭
        </div>
        <button class="result-close-btn" @click="handleClose">确定</button>
      </div>
    </div>

    <!-- 物品选择弹窗 -->
    <div v-if="showItemModal" class="item-modal-overlay" @click.self="showItemModal = false">
      <div class="item-modal">
        <div class="item-modal-header">
          <span>选择物品</span>
          <button class="item-modal-close" @click="showItemModal = false; eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_item_modal_close' })">✕</button>
        </div>
        <div class="item-modal-body">
          <div
            v-for="item in consumableItems"
            :key="item.itemId"
            class="item-option"
            @click="useItem(item.itemId, item.index)"
          >
            <ItemIcon :icon="item.icon" size="md" />
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
/**
 * @fileoverview 战斗弹窗组件
 * @description 回合制战斗界面，支持普通攻击、技能释放、物品使用和逃跑等行动，包含回合日志、伤害浮动数字和战斗结果展示
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useCombatStore } from '@/modules/combat/store';
import { useCharacterStore } from '@/modules/character';
import { useSkillsStore } from '@/modules/skill/store';
import { useInventoryStore } from '@/modules/inventory/store';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { CombatLog, CombatResult, CombatActionType } from '@/modules/combat/types';
import type { Skill } from '@/modules/skill/types';
import ResourceBar from '@/components/common/ResourceBar.vue';
import ItemIcon from '@/components/common/ItemIcon.vue';
import {
  animateShake,
  animateCritShake,
  animateDodgeBlink,
  animateFloating,
  animateScreenFlash,
  animateVsFlash,
  animateBossIntro,
  animatePhaseTransition,
  animateResultPopup,
} from '@/modules/animation/combat-effects';

const emit = defineEmits<{
  (e: 'close', result?: CombatResult): void;
}>();

/** 组件是否已卸载，防止异步回调在卸载后修改状态触发 Vue DOM 错误 */
const isUnmounted = ref(false);

const characterStore = useCharacterStore();
const skillsStore = useSkillsStore();
const inventoryStore = useInventoryStore();
const combatStore = useCombatStore();
const logRef = ref<HTMLElement | null>(null);
const isAnimating = ref(false);
const showItemModal = ref(false);
const autoCloseCountdown = ref(0);

// 战斗速度（从 Store 读取）
const combatSpeed = computed(() => combatStore.combatSpeed);

function toggleSpeed() {
  combatStore.toggleCombatSpeed();
  eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_speed_toggle' });
}

let autoCloseTimer: ReturnType<typeof setInterval> | null = null;
let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

// 战斗状态 - 直接从 Combat Store 响应式数据派生
const turn = computed(() => combatStore.turn);
const turnCount = computed(() => combatStore.turnCount);
const logs = computed(() => combatStore.combatLogs);

/** 战斗日志倒序（最新在最上面） */
const logsReversed = computed(() => [...logs.value].reverse());

// 动画状态（按敌人 ID 索引）
const enemyShakes = ref<Record<string, boolean>>({});
const enemyCritShakes = ref<Record<string, boolean>>({});
const enemyDodgeBlinks = ref<Record<string, boolean>>({});
const enemyFloatings = ref<Record<string, { text: string; type: string } | null>>({});
// 保留这些全局动画
const playerShake = ref(false);
const playerCritShake = ref(false);
const playerDodgeBlink = ref(false);
const vsFlash = ref(false);
const playerFloating = ref<{ text: string; type: string } | null>(null);
const screenFlash = ref(false);
const screenFlashType = ref<'crit' | 'dodge'>('crit');

// Boss 出场演出状态
const showBossIntro = ref(false);
const bossIntroIcon = ref('');
const bossIntroName = ref('');
const bossIntroLines = ref<string[]>([]);

// Boss 阶段转换特效状态
const showPhaseTransition = ref(false);
const phaseTransitionEffect = ref('');
const phaseTransitionName = ref('');

// 模板 refs（用于 anime.js 直接操作 DOM）
const screenFlashRef = ref<HTMLElement | null>(null);
const bossIntroOverlayRef = ref<HTMLElement | null>(null);
const bossIntroIconRef = ref<HTMLElement | null>(null);
const bossIntroNameRef = ref<HTMLElement | null>(null);
const bossIntroLineRefs = ref<Record<number, HTMLElement>>({});
const phaseBackdropRef = ref<HTMLElement | null>(null);
const phaseContentRef = ref<HTMLElement | null>(null);
const vsDividerRef = ref<HTMLElement | null>(null);
const resultPopupRef = ref<HTMLElement | null>(null);
const resultIconRef = ref<HTMLElement | null>(null);
const resultTextRef = ref<HTMLElement | null>(null);

// 玩家数据（从 characterStore 读取，与主界面一致）
const playerName = computed(() => characterStore.name);
const playerLevel = computed(() => characterStore.level);
const playerIcon = computed(() => '🧑');
const playerHp = computed(() => characterStore.hp);
const playerMaxHp = computed(() => characterStore.maxHp);
const playerMp = computed(() => characterStore.mana);
const playerMaxMp = computed(() => characterStore.maxMana);
const playerHpPercent = computed(() => Math.max(0, Math.min(100, (playerHp.value / playerMaxHp.value) * 100)));
const playerMpPercent = computed(() => Math.max(0, Math.min(100, (playerMp.value / playerMaxMp.value) * 100)));

// 敌人数据（当前目标）
const currentTarget = computed(() => combatStore.currentTarget);

function getHpPercent(e: { hp: number; maxHp: number }): number {
  return Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
}

/** 获取指定位置（前后排 + 列）上的敌人列表 */
function getEnemiesInSlot(row: 'front' | 'back', col: number) {
  const positions = combatStore.enemyPositions;
  return combatStore.enemies.filter(e => {
    const pos = positions[e.id];
    return pos && pos.row === row && pos.col === col;
  });
}

/** 获取指定敌人的效果列表 */
function getEnemyEffects(enemyId: string) {
  return combatStore.enemyEffects.get(enemyId)?.effects || [];
}

/** 获取指定敌人的效果数量 */
function getEnemyEffectCount(enemyId: string): number {
  return getEnemyEffects(enemyId).length;
}

// 状态
const isPlayerTurn = computed(() => turn.value === 'player');
const isFighting = computed(() => !combatStore.combatResult);
const canAct = computed(() => isPlayerTurn.value && isFighting.value && !isAnimating.value);

// 可用技能：使用 skillsStore 响应式数据，确保角色切换后自动更新
const equippedSkills = computed<Skill[]>(() => {
  try {
    const equipped = skillsStore.equippedSkills;
    if (equipped && equipped.length > 0) return equipped.filter((s): s is Skill => s !== null).slice(0, 4);
    const unlocked = skillsStore.unlockedSkills;
    return (unlocked || []).slice(0, 4);
  } catch {
    return [];
  }
});

// 消耗品物品：使用 inventoryStore 响应式数据
const consumableItems = computed(() => {
  try {
    const inventory = inventoryStore.inventory;
    return inventory
      .map((invItem, index) => {
        const info = inventoryStore.getItemInfo(invItem.itemId);
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

function buildItemDescription(info: { effect?: { type: string; value: unknown }; description?: string }): string {
  const { effect, description } = info;
  if (!effect || typeof effect.value !== 'number') return description || '';
  const parts: string[] = [];
  if (effect.type === 'health_restore' && effect.value > 0) parts.push(`HP+${effect.value}`);
  if (effect.type === 'mana_restore' && effect.value > 0) parts.push(`MP+${effect.value}`);
  return parts.length > 0 ? parts.join(' ') : (description || '');
}

const { getSkillEffectBrief, getTargetTypeName } = useSkillDisplay();

function getSkillEffectText(skill: Skill): string {
  return getSkillEffectBrief(skill);
}

/** 获取技能目标类型文本 */
function getTargetTypeText(targetType?: string): string {
  if (!targetType || targetType === 'single') return '';
  return getTargetTypeName(targetType);
}

// 根据日志事件类型获取伤害类型样式类
function getDamageTypeClass(log: CombatLog): string {
  if (log.eventType === 'combat_skill_cast') return 'magic-damage';
  if (log.eventType === 'combat_critical') return 'crit-damage';
  return 'physical-damage';
}

// 根据日志事件类型获取伤害类型图标
function getDamageTypeIcon(log: CombatLog): string {
  if (log.eventType === 'combat_skill_cast') return '🔮';
  if (log.eventType === 'combat_critical') return '⚔️';
  return '🗡️';
}

/** 效果图标映射 */
const effectIcons: Record<string, string> = {
  poison: '☠️', burn: '🔥', stun: '💫', freeze: '❄️', silence: '🔇',
  shield: '🛡️', attack_up: '⚔️', attack_down: '⚔️', defense_up: '🛡️',
  defense_down: '🛡️', speed_up: '💨', speed_down: '🐢', regen: '💚',
  thorn: '🌵', vulnerable: '💔',
};

/** 效果类型标签 */
const effectLabels: Record<string, string> = {
  poison: '中毒', burn: '灼烧', stun: '眩晕', freeze: '冰冻', silence: '沉默',
  shield: '护盾', attack_up: '攻击↑', attack_down: '攻击↓', defense_up: '防御↑',
  defense_down: '防御↓', speed_up: '速度↑', speed_down: '速度↓', regen: '恢复',
  thorn: '反伤', vulnerable: '易伤',
};

/** 效果是否为增益 */
function isBuffEffect(type: string): boolean {
  return ['shield', 'attack_up', 'defense_up', 'speed_up', 'regen', 'thorn'].includes(type);
}

/** 效果是否为减益 */
function isDebuffEffect(type: string): boolean {
  return ['poison', 'burn', 'stun', 'freeze', 'silence', 'attack_down', 'defense_down', 'speed_down', 'vulnerable'].includes(type);
}

/** 效果数值格式化（增益正数，减益取绝对值） */
function formatEffectValue(type: string, value: number): string {
  if (isBuffEffect(type)) return `+${value}`;
  if (isDebuffEffect(type)) return `+${value}`;
  return `${value}`;
}

/** 获取效果对应的图标 */
function getEffectIcon(type: string): string {
  return effectIcons[type] || '✨';
}

const resultText = computed(() => {
  switch (combatStore.combatResult) {
    case 'victory': return '战斗胜利！';
    case 'defeat': return '战斗失败...';
    case 'fled': return '成功逃跑！';
    default: return '';
  }
});

/** 战斗日志变化时自动滚动到顶部（倒序显示，最新在最上面） */
watch(logs, () => {
  nextTick(() => scrollToTop());
});

function scrollToTop() {
  if (logRef.value) {
    logRef.value.scrollTop = 0;
  }
}

// 浮动伤害/生命恢复数字
function showFloating(target: 'enemy' | 'player', text: string, type: string, enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyFloatings.value[enemyId] = { text, type };
    nextTick(() => {
      const el = document.querySelector(`[data-enemy-float="${enemyId}"]`) as HTMLElement;
      if (el) animateFloating(el, type as 'damage' | 'crit' | 'heal' | 'dodge', combatSpeed.value);
    });
    setTimeout(() => { if (enemyFloatings.value[enemyId]) enemyFloatings.value[enemyId] = null; }, 1800);
  } else {
    playerFloating.value = { text, type };
    nextTick(() => {
      const el = document.querySelector('.player-side .floating-damage') as HTMLElement;
      if (el) animateFloating(el, type as 'damage' | 'crit' | 'heal' | 'dodge', combatSpeed.value);
    });
    setTimeout(() => { playerFloating.value = null; }, 1800);
  }
}

// 震动效果（普通攻击）
function triggerShake(target: 'enemy' | 'player', enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyShakes.value[enemyId] = true;
    nextTick(() => {
      const el = document.querySelector(`[data-enemy-shake="${enemyId}"]`) as HTMLElement;
      if (el) animateShake(el, combatSpeed.value);
    });
    setTimeout(() => { enemyShakes.value[enemyId] = false; }, 600);
  } else {
    playerShake.value = true;
    nextTick(() => {
      const el = document.querySelector('.player-side') as HTMLElement;
      if (el) animateShake(el, combatSpeed.value);
    });
    setTimeout(() => { playerShake.value = false; }, 600);
  }
}

// 暴击震动效果（更强、更持久）
function triggerCritShake(target: 'enemy' | 'player', enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyCritShakes.value[enemyId] = true;
    nextTick(() => {
      const el = document.querySelector(`[data-enemy-shake="${enemyId}"]`) as HTMLElement;
      if (el) animateCritShake(el, combatSpeed.value);
    });
    setTimeout(() => { enemyCritShakes.value[enemyId] = false; }, 900);
  } else {
    playerCritShake.value = true;
    nextTick(() => {
      const el = document.querySelector('.player-side') as HTMLElement;
      if (el) animateCritShake(el, combatSpeed.value);
    });
    setTimeout(() => { playerCritShake.value = false; }, 900);
  }
}

// 闪避闪烁效果
function triggerDodgeBlink(target: 'enemy' | 'player', enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyDodgeBlinks.value[enemyId] = true;
    nextTick(() => {
      const el = document.querySelector(`[data-enemy-shake="${enemyId}"]`) as HTMLElement;
      if (el) animateDodgeBlink(el, combatSpeed.value);
    });
    setTimeout(() => { enemyDodgeBlinks.value[enemyId] = false; }, 800);
  } else {
    playerDodgeBlink.value = true;
    nextTick(() => {
      const el = document.querySelector('.player-side') as HTMLElement;
      if (el) animateDodgeBlink(el, combatSpeed.value);
    });
    setTimeout(() => { playerDodgeBlink.value = false; }, 800);
  }
}

// 屏幕闪白特效
function triggerScreenFlash(type: 'crit' | 'dodge') {
  screenFlashType.value = type;
  screenFlash.value = true;
  nextTick(() => {
    if (screenFlashRef.value) {
      animateScreenFlash(screenFlashRef.value, type, combatSpeed.value);
    }
  });
  setTimeout(() => { screenFlash.value = false; }, 600);
}

// 暴击事件处理
function onCritHit(data: { amount: number; damageType: string; targetName: string; actorType: 'player' | 'enemy'; enemyId?: string }) {
  if (isUnmounted.value) return;
  // 震动目标：玩家暴击震敌人，敌人暴击震玩家
  const shakeTarget = data.actorType === 'player' ? 'enemy' : 'player';
  // 暴击震动 + 屏幕闪白
  triggerCritShake(shakeTarget, data.enemyId);
  triggerScreenFlash('crit');
  // 玩家暴击时浮动文字由 applyCombatDamageEffects 处理，此处仅处理敌人暴击
  if (data.actorType === 'enemy') {
    showFloating(shakeTarget, `暴击! -${data.amount}`, 'crit', data.enemyId);
  }
}

// 敌人造成伤害事件处理（敌人攻击玩家时的视觉反馈）
function onEnemyDealDamage(data: { amount: number; damageType: string; targetName: string; actorType?: 'player' | 'enemy' }) {
  if (isUnmounted.value) return;
  // 仅处理敌人对玩家造成的伤害
  if (data.actorType !== 'enemy') return;
  // 玩家受击震动
  triggerShake('player');
  // 玩家受击浮动伤害文字
  showFloating('player', `-${data.amount}`, 'damage');
}

// 闪避事件处理
function onDodge(data: { attackerName: string; dodgerName: string; dodgerType: 'player' | 'enemy'; enemyId?: string }) {
  if (isUnmounted.value) return;
  // 闪避者闪烁
  triggerDodgeBlink(data.dodgerType, data.enemyId);
  // 闪避浮动文字
  showFloating(data.dodgerType, '闪避!', 'dodge', data.enemyId);
  // 屏幕轻闪
  triggerScreenFlash('dodge');
}

// Boss 出场演出事件处理
function onBossIntro(data: { enemyId: string; enemyName: string; icon: string; effect: string; lines: string[]; duration: number }) {
  if (isUnmounted.value) return;
  bossIntroIcon.value = data.icon;
  bossIntroName.value = data.enemyName;
  bossIntroLines.value = data.lines;
  showBossIntro.value = true;

  // 使用 anime.js 时间线播放演出
  nextTick(() => {
    if (bossIntroOverlayRef.value && bossIntroIconRef.value && bossIntroNameRef.value) {
      const lineEls = Object.values(bossIntroLineRefs.value);
      animateBossIntro(
        bossIntroOverlayRef.value,
        bossIntroIconRef.value,
        bossIntroNameRef.value,
        lineEls,
        data.duration,
        combatSpeed.value
      );
    }
  });

  // 演出结束后自动关闭
  const minDuration = 1000 + data.lines.length * 900;
  const actualDuration = Math.max(data.duration, minDuration);
  setTimeout(() => {
    showBossIntro.value = false;
  }, actualDuration + 300); // +300 给淡出动画留时间
}

// Boss 阶段转换事件处理
function onBossPhase(data: { enemyId: string; enemyName: string; phaseName: string; effect: string }) {
  if (isUnmounted.value) return;
  phaseTransitionEffect.value = data.effect;
  phaseTransitionName.value = `${data.enemyName} 进入 "${data.phaseName}" 阶段！`;
  showPhaseTransition.value = true;

  // 使用 anime.js 播放阶段转换
  nextTick(() => {
    if (phaseBackdropRef.value && phaseContentRef.value) {
      animatePhaseTransition(phaseBackdropRef.value, phaseContentRef.value, combatSpeed.value);
    }
  });

  // 2.5 秒后自动关闭（匹配动画时长）
  setTimeout(() => {
    showPhaseTransition.value = false;
  }, 2500);
}

// VS 分隔线闪光动画（doAction / doSkill 共用）
function triggerVsFlash() {
  vsFlash.value = true;
  nextTick(() => {
    if (vsDividerRef.value) animateVsFlash(vsDividerRef.value, combatSpeed.value);
  });
  setTimeout(() => { vsFlash.value = false; }, 450);
}

/** 应用战斗伤害视觉特效（多目标伤害 / 单体伤害），doAction / doSkill 共用 */
function applyCombatDamageEffects(result: { aoeHits?: { enemyId: string; damage: number }[]; damage?: number; isCrit?: boolean }) {
  if (result.aoeHits && result.aoeHits.length > 0) {
    for (const hit of result.aoeHits) {
      triggerShake('enemy', hit.enemyId);
      showFloating('enemy', `-${hit.damage}`, 'damage', hit.enemyId);
    }
  } else if (result.damage && result.damage > 0) {
    triggerShake('enemy', currentTarget.value?.id);
    showFloating('enemy', `-${result.damage}`, result.isCrit ? 'crit' : 'damage', currentTarget.value?.id);
  }
}

// 选择攻击目标
function selectTarget(enemyId: string) {
  if (!canAct.value) return;
  const e = combatStore.enemies.find(en => en.id === enemyId);
  if (e && e.hp > 0) {
    combatStore.targetEnemyId = enemyId;
  }
}

// 执行玩家动作（普通攻击/逃跑）
async function doAction(type: CombatActionType) {
  if (!canAct.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: `combat_${type}` });
  isAnimating.value = true;
  triggerVsFlash();

  const result = await combatStore.playerAction({ type });

  if (isUnmounted.value) return;

  if (!result.success) {
    isAnimating.value = false;
    return;
  }

  // 视觉特效：伤害效果提取为 applyCombatDamageEffects
  // 暴击特效（critShake / screenFlash）由 COMBAT_CRITICAL_HIT EventBus 事件驱动，避免双重触发
  // 闪避特效由 COMBAT_DODGE EventBus 事件驱动
  applyCombatDamageEffects(result);

  if (combatStore.combatResult) {
    // 战斗结束（击败/逃跑失败等）
    isAnimating.value = false;
  }
  // 否则 isAnimating 由 watch(turn) 在敌人回合结束后恢复
}

// 使用技能
async function doSkill(skillId: string) {
  if (!canAct.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_skill' });
  isAnimating.value = true;
  triggerVsFlash();

  const result = await combatStore.playerAction({ type: 'skill', skillId });

  if (isUnmounted.value) return;

  if (!result.success) {
    isAnimating.value = false;
    return;
  }

  // 视觉特效：伤害效果使用公共函数
  applyCombatDamageEffects(result);
  if (result.heal && result.heal > 0) {
    showFloating('player', `+${result.heal}`, 'heal');
  }

  if (combatStore.combatResult) {
    isAnimating.value = false;
  }
}

// 跳过回合
function doSkip() {
  if (!canAct.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_skip' });
  isAnimating.value = true;
  // skipTurn 内部调用 endPlayerTurn → 自动调度敌人回合
  combatStore.skipTurn();
  // isAnimating 由 watch(turn) 在敌人回合结束后恢复
}

// 使用物品
function openItemModal() {
  if (hasConsumables.value) {
    showItemModal.value = true;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_item_btn' });
  }
}

async function useItem(_itemId: string, _index: number) {
  if (!canAct.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_use_item' });
  showItemModal.value = false;
  isAnimating.value = true;

  const prevPlayerHp = playerHp.value;
  const prevPlayerMp = playerMp.value;

  await combatStore.playerAction({ type: 'item', itemId: _itemId });

  if (isUnmounted.value) return;

  if (!combatStore.combatResult) {
    // 物品恢复效果（通过 HP/MP 差值计算，因为 useItem action 不返回 heal 值）
    const hpHeal = playerHp.value - prevPlayerHp;
    if (hpHeal > 0) {
      showFloating('player', `+${hpHeal}`, 'heal');
    }
    const mpHeal = playerMp.value - prevPlayerMp;
    if (mpHeal > 0) {
      showFloating('player', `MP+${mpHeal}`, 'heal');
    }
  }
  // isAnimating 由 watch(turn) 在敌人回合结束后恢复
}

// ========== 敌人回合动画监听（替代 runEnemyTurn 编排） ==========

// 监听 turn 切换：玩家回合恢复后可操作
watch(() => combatStore.turn, (newTurn, oldTurn) => {
  // 仅在战斗中、结果未出、且回合从 enemy 切回 player 时，恢复操作
  if (newTurn === 'player' && oldTurn === 'enemy' && !combatStore.combatResult) {
    isAnimating.value = false;
  }
});

// 监听 combatResult：战斗结束时显示结果弹窗
watch(() => combatStore.combatResult, (result) => {
  if (result) {
    isAnimating.value = false;
    scheduleAutoClose();
    // 使用 anime.js 播放结果弹窗动画
    nextTick(() => {
      if (resultPopupRef.value && resultIconRef.value && resultTextRef.value) {
        const rewardEls = Array.from(
          resultPopupRef.value.querySelectorAll('.reward-item')
        ) as HTMLElement[];
        animateResultPopup(resultPopupRef.value, resultIconRef.value, resultTextRef.value, rewardEls, combatSpeed.value);
      }
    });
  }
});

function scheduleAutoClose() {
  clearAutoClose();
  const delay = combatStore.combatResult === 'victory' ? 3 : 2;
  autoCloseCountdown.value = delay;

  autoCloseTimer = setInterval(() => {
    autoCloseCountdown.value--;
    if (autoCloseCountdown.value <= 0) {
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
  eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_result_close' });
  clearAutoClose();
  emit('close', combatStore.combatResult || undefined);
}

onMounted(() => {
  // 确保技能 Store 已初始化
  skillsStore.initialize();
  eventBus.on(GameEvents.COMBAT_CRITICAL_HIT, onCritHit);
  eventBus.on(GameEvents.COMBAT_DEAL_DAMAGE, onEnemyDealDamage);
  eventBus.on(GameEvents.COMBAT_DODGE, onDodge);
  eventBus.on(GameEvents.COMBAT_BOSS_INTRO, onBossIntro);
  eventBus.on(GameEvents.COMBAT_BOSS_PHASE, onBossPhase);
});

onUnmounted(() => {
  isUnmounted.value = true;
  eventBus.off(GameEvents.COMBAT_CRITICAL_HIT, onCritHit);
  eventBus.off(GameEvents.COMBAT_DEAL_DAMAGE, onEnemyDealDamage);
  eventBus.off(GameEvents.COMBAT_DODGE, onDodge);
  eventBus.off(GameEvents.COMBAT_BOSS_INTRO, onBossIntro);
  eventBus.off(GameEvents.COMBAT_BOSS_PHASE, onBossPhase);
  clearAutoClose();
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
  position: relative;
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
  position: relative;
}

/* 屏幕闪白遮罩 */
.screen-flash {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  pointer-events: none;
  border-radius: 14px;
  background: transparent;
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

.combat-title { font-size: 18px; font-weight: 700; color: #e94560; }
.combat-turn { font-size: 13px; color: #888; }

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
  position: relative;
  transition: transform 0.1s;
}

.enemy-side { border-color: #e94560; }
.player-side { border-color: #00d2d3; }

/* 敌人 3×2 网格容器 */
.enemy-grid {
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.enemy-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

/* 敌人槽位 */
.enemy-slot {
  min-height: 100px;
  display: flex;
  align-items: stretch;
}

.enemy-slot .combatant {
  flex: 1;
  min-width: 100px;
  padding: 10px;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.1s;
}

.enemy-slot .combatant:hover {
  border-color: #ff6b6b;
}

/* 空槽位占位符 */
.enemy-slot .combatant.enemy-empty {
  cursor: default;
  opacity: 0.3;
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.enemy-slot .combatant.enemy-empty:hover {
  border-color: rgba(255, 255, 255, 0.18);
}

.enemy-slot .combatant.enemy-empty .empty-avatar {
  font-size: 32px;
  opacity: 0.6;
}

.enemy-slot .combatant.enemy-empty .empty-text {
  font-size: 13px;
  opacity: 0.6;
  color: rgba(255, 255, 255, 0.5);
}

/* 选中目标高亮 */
.combatant.targeted {
  border-color: #ffd700 !important;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.enemy-slot .combatant.targeted:hover {
  border-color: #ffd700 !important;
}

/* Boss 徽章 */
.boss-badge {
  font-size: 11px;
  color: #ff6b5a;
  margin-top: 2px;
  font-weight: 700;
}

.combatant.defeated {
  opacity: 0.4;
  filter: grayscale(0.8);
}

/* 浮动伤害数字 */
.floating-damage {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 22px;
  font-weight: 900;
  pointer-events: none;
  z-index: 10;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  /* 动画由 anime.js animateFloating 处理 */
}

.floating-damage.damage { color: #ff4444; }
.floating-damage.heal { color: #4CAF50; }
.floating-damage.crit {
  color: #ffd700;
  font-size: 30px;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6);
}
.floating-damage.dodge {
  color: #888;
  font-size: 22px;
  font-style: italic;
}

.combatant-avatar { font-size: 36px; text-align: center; }
.combatant-info { text-align: center; }
.combatant-name { font-size: 16px; font-weight: 700; color: #f0f0f0; }
.combatant-level { font-size: 12px; color: #ffd700; margin-top: 2px; }

.combatant-bars { display: flex; flex-direction: column; gap: 8px; }

.vs-divider {
  display: flex;
  align-items: center;
  font-size: 24px;
  color: #ffd700;
  transition: transform 0.2s;
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

.log-turn { color: #666; font-size: 11px; }
.log-damage { font-weight: 700; font-size: 14px; }
.log-damage.physical-damage { color: #ff8c00; }
.log-damage.magic-damage { color: #a855f7; }
.log-damage.crit-damage { color: #ffd700; }
.log-heal { color: #4CAF50; font-weight: 700; font-size: 14px; }
.log-crit { color: #ffd700; font-weight: 700; font-size: 12px; }
.log-dodge { color: #888; font-weight: 700; font-size: 12px; }
.log-empty { color: #555; text-align: center; padding: 20px 0; font-style: italic; }

/* 行动按钮区域 */
.combat-actions {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
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

.action-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); border-color: #666; }
.action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.attack-btn:hover:not(:disabled) { border-color: #e94560; background: rgba(233, 69, 96, 0.15); }
.item-btn:hover:not(:disabled) { border-color: #4CAF50; background: rgba(76, 175, 80, 0.15); }
.skip-btn:hover:not(:disabled) { border-color: #fbbf24; background: rgba(251, 191, 36, 0.15); }
.flee-btn:hover:not(:disabled) { border-color: #888; background: rgba(136, 136, 136, 0.15); }

.skill-btn {
  border-color: #8b5cf6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
}

.skill-btn:hover:not(:disabled) { background: rgba(139, 92, 246, 0.15); border-color: #a78bfa; }
.skill-btn.no-mp { border-color: #555; }
.skill-icon { font-size: 18px; }
.skill-name { font-size: 12px; font-weight: 600; }
.skill-effect { font-size: 10px; }
.skill-effect-physical_damage { color: #ff6b6b; }
.skill-effect-magic_damage { color: #a29bfe; }
.skill-effect-health_restore,
.skill-effect-mana_restore { color: #4ecdc4; }
.skill-effect-buff { color: #4CAF50; }
.skill-effect-debuff { color: #ff9800; }
.skill-cost {
  font-size: 10px;
  color: #6e9bff;
  background: rgba(110, 155, 255, 0.15);
  border-radius: 3px;
  padding: 0 4px;
}
.skill-target {
  font-size: 10px;
  color: #a064ff;
  background: rgba(160, 100, 255, 0.15);
  border-radius: 3px;
  padding: 0 4px;
}

/* 敌人回合遮罩 */
.enemy-turn-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  animation: fadeIn 0.3s ease;
}

.enemy-turn-text {
  color: #fbbf24;
  font-size: 18px;
  font-weight: 700;
  animation: pulse 1.2s infinite;
}

/* 战斗结果弹窗 */
.result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2200;
  animation: fadeIn 0.3s ease;
}

.result-popup {
  background: linear-gradient(145deg, #1a1a2e, #16213e);
  border: 2px solid #4a4a4a;
  border-radius: 20px;
  padding: 40px 50px;
  text-align: center;
  min-width: 300px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  /* 入场动画由 anime.js animateResultPopup 处理 */
}

.result-icon {
  font-size: 64px;
  margin-bottom: 16px;
  /* 弹跳动画由 anime.js animateResultPopup 处理 */
}

.result-text { font-size: 28px; font-weight: 700; margin-bottom: 16px; /* 动画初始状态：隐藏 + 下移 16px，由 anime.js animateResultPopup 驱动 */ opacity: 0; transform: translateY(16px); }
.result-victory { color: #ffd700; text-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
.result-defeat { color: #e94560; text-shadow: 0 0 20px rgba(233, 69, 96, 0.3); }
.result-fled { color: #888; }

.result-rewards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.reward-item {
  font-size: 18px;
  color: #ffd700;
  /* 滑入动画由 anime.js animateResultPopup 处理 */
}

.result-countdown { font-size: 13px; color: #888; margin-bottom: 16px; }

.result-close-btn {
  padding: 10px 36px;
  background: rgba(255, 215, 0, 0.15);
  border: 2px solid #ffd700;
  border-radius: 8px;
  color: #ffd700;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.result-close-btn:hover {
  background: rgba(255, 215, 0, 0.25);
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

.item-modal-close { background: none; border: none; color: #888; font-size: 18px; cursor: pointer; padding: 4px 8px; }
.item-modal-close:hover { color: #fff; }

.item-modal-body { flex: 1; overflow-y: auto; padding: 8px; }

.item-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.item-option:hover { background: rgba(255, 255, 255, 0.08); }
.item-option .item-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.item-option .item-name { font-size: 14px; color: #f0f0f0; font-weight: 600; }
.item-option .item-desc { font-size: 11px; color: #888; }
.item-option .item-count { font-size: 13px; color: #aaa; flex-shrink: 0; }
.item-empty { text-align: center; padding: 24px; color: #555; font-style: italic; }

/* 动画 —— 战斗动画已迁移至 @/modules/animation/combat-effects.ts (anime.js) */

/* 移动端 */
@media (max-width: 600px) {
  .combat-arena { flex-direction: column; padding: 10px; gap: 8px; }
  .vs-divider { display: none; }
  .enemy-grid { flex: 1; }
  .enemy-row { grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .enemy-slot { min-height: 80px; }
  .enemy-slot .combatant { padding: 6px; min-width: 60px; }
  .combatant-avatar { font-size: 28px; }
  .combat-log { min-height: 80px; max-height: 120px; }
  .action-row { grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .action-btn { font-size: 11px; padding: 8px 4px; }
  .skill-btn { padding: 6px 4px; }
  .skill-icon { font-size: 16px; }
  .skill-name { font-size: 10px; }
  .skill-effect { font-size: 9px; }
  .skill-cost { font-size: 9px; }
  .floating-damage { font-size: 18px; }
  .floating-damage.crit { font-size: 24px; }
  .floating-damage.dodge { font-size: 18px; }
}

/* 技能冷却 */
.skill-btn.on-cooldown {
  opacity: 0.5;
  position: relative;
}
.skill-cooldown {
  font-size: 10px;
  color: #ffa500;
  background: rgba(255, 165, 0, 0.15);
  border-radius: 3px;
  padding: 0 4px;
  display: inline-block;
  margin-top: 2px;
}

/* 速度切换按钮 */
.speed-toggle {
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid #ffd700;
  color: #ffd700;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.speed-toggle:hover {
  background: rgba(255, 215, 0, 0.3);
}

/* Buff/Debuff 效果指示器 */
.effects-indicator {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
  padding: 4px 0;
}

.effect-badge {
  font-size: 11px;
  font-weight: 600;
  border-radius: 5px;
  padding: 2px 8px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 3px;
}

/* 增益（Buff）- 绿色系 */
.effect-badge.effect-shield,
.effect-badge.effect-attack_up,
.effect-badge.effect-defense_up,
.effect-badge.effect-speed_up,
.effect-badge.effect-regen,
.effect-badge.effect-thorn {
  background: rgba(39, 174, 96, 0.18);
  border: 1px solid rgba(39, 174, 96, 0.5);
  color: #2ecc71;
}

/* 减益（Debuff）- 红色系 */
.effect-badge.effect-poison,
.effect-badge.effect-burn,
.effect-badge.effect-stun,
.effect-badge.effect-freeze,
.effect-badge.effect-silence,
.effect-badge.effect-attack_down,
.effect-badge.effect-defense_down,
.effect-badge.effect-speed_down,
.effect-badge.effect-vulnerable {
  background: rgba(231, 76, 60, 0.18);
  border: 1px solid rgba(231, 76, 60, 0.5);
  color: #e74c3c;
}

/* 各效果细分配色（保持辨识度） */
.effect-badge.effect-poison { background: rgba(139, 195, 74, 0.18); border-color: rgba(139, 195, 74, 0.5); color: #8bc34a; }
.effect-badge.effect-burn { background: rgba(255, 152, 0, 0.18); border-color: rgba(255, 152, 0, 0.5); color: #ff9800; }
.effect-badge.effect-stun { background: rgba(255, 235, 59, 0.15); border-color: rgba(255, 235, 59, 0.5); color: #ffeb3b; }
.effect-badge.effect-freeze { background: rgba(0, 188, 212, 0.18); border-color: rgba(0, 188, 212, 0.5); color: #00bcd4; }
.effect-badge.effect-silence { background: rgba(156, 39, 176, 0.18); border-color: rgba(156, 39, 176, 0.5); color: #ce93d8; }
.effect-badge.effect-vulnerable { background: rgba(255, 87, 34, 0.18); border-color: rgba(255, 87, 34, 0.5); color: #ff5722; }

/* ========== Boss 出场演出遮罩 ========== */
.boss-intro-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  /* 统一暗色遮罩 + 虚化底层 */
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(4px);
  /* 动画初始状态：完全透明，由 anime.js 驱动淡入 */
  opacity: 0;
}

.boss-intro-content {
  text-align: center;
  z-index: 2;
  /* 半透明暗色背景增强文字对比度 */
  background: rgba(0, 0, 0, 0.5);
  padding: 32px 48px;
  border-radius: 12px;
}

.boss-intro-icon {
  font-size: 72px;
  /* 图标发光增强辨识度 */
  filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.5));
  /* 动画初始状态：隐藏 + 缩放为 0，由 anime.js 驱动弹入 */
  opacity: 0;
  transform: scale(0);
}

.boss-intro-name {
  font-size: 28px;
  font-weight: 900;
  color: #ffd700;
  margin-top: 12px;
  text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 215, 0, 0.6);
  /* 动画初始状态：隐藏 + 下移 20px，由 anime.js 驱动滑入 */
  opacity: 0;
  transform: translateY(20px);
}

.boss-intro-line {
  font-size: 16px;
  color: #fff;
  margin-top: 8px;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.5);
  /* 动画初始状态：隐藏 + 下移 10px，由 anime.js 驱动滑入 */
  opacity: 0;
  transform: translateY(10px);
}

/* ========== Boss 阶段转换特效 ========== */
.phase-transition {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 55;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  overflow: hidden;
}

/* 全屏闪过遮罩 */
.phase-transition-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* 动画初始状态：完全透明，由 anime.js 驱动闪现 */
  opacity: 0;
}

/* 默认暗色遮罩 */
.phase-transition-darken .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.85) 80%);
}
.phase-transition-flame .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(80, 0, 0, 0.5) 0%, rgba(40, 0, 0, 0.9) 80%);
}
.phase-transition-freeze .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(0, 40, 80, 0.5) 0%, rgba(0, 0, 30, 0.9) 80%);
}
.phase-transition-lightning .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(30, 0, 60, 0.5) 0%, rgba(0, 0, 20, 0.9) 80%);
}
.phase-transition-shake .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(60, 20, 0, 0.5) 0%, rgba(20, 0, 0, 0.9) 80%);
}

/* 阶段转换文字内容 */
.phase-transition-content {
  position: relative;
  z-index: 2;
  text-align: center;
  /* 动画初始状态：隐藏 + 缩小，由 anime.js 驱动缩放进入 */
  opacity: 0;
  transform: scale(0.7);
}

.phase-transition-label {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-bottom: 6px;
}

.phase-transition-text {
  font-size: 32px;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 215, 0, 0.6), 0 0 64px rgba(255, 100, 0, 0.4);
  white-space: nowrap;
}

/* 各特效的文字颜色 */
.phase-transition-darken .phase-transition-text { color: #ffd700; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 215, 0, 0.6); }
.phase-transition-flame .phase-transition-text { color: #ff4500; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 69, 0, 0.7), 0 0 64px rgba(255, 0, 0, 0.5); }
.phase-transition-freeze .phase-transition-text { color: #00bcd4; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(0, 188, 212, 0.7), 0 0 64px rgba(0, 255, 255, 0.4); }
.phase-transition-lightning .phase-transition-text { color: #a855f7; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(168, 85, 247, 0.7), 0 0 64px rgba(200, 100, 255, 0.5); }
.phase-transition-shake .phase-transition-text { color: #ff6347; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 99, 71, 0.7), 0 0 64px rgba(255, 50, 0, 0.5); }

/* Boss 出场和阶段转换动画已迁移至 @/modules/animation/combat-effects.ts (anime.js) */

</style>
