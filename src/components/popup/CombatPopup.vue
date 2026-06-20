<template>
  <div class="combat-overlay">
    <div class="combat-container">
      <!-- 屏幕闪白遮罩（暴击特效） -->
      <div ref="screenFlashRef" v-show="screenFlash" :class="['screen-flash', screenFlashType]"></div>

      <!-- Boss 出场演出遮罩（统一风格） -->
      <div v-if="showBossIntro" ref="bossIntroOverlayRef" class="boss-intro-overlay">
        <div class="boss-intro-content">
          <div ref="bossIntroIconRef" class="boss-intro-icon"><BaseIcon :name="bossIntroIcon" gradient="dragon" :size="48" /></div>
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
          <BaseIcon :name="combatSpeed === 1 ? 'single-arrow' : 'double-arrow'" gradient="lightning" :size="16" />
          {{ combatSpeed === 1 ? '1x' : '2x' }}
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
                  <div class="combatant-avatar"><BaseIcon :name="e.icon || 'dragon-head'" :size="28" /></div>
                  <div class="combatant-info">
                    <div class="combatant-name">{{ e.name }}</div>
                    <div class="combatant-level">Lv.{{ e.level || 1 }}</div>
                    <div v-if="e.isBoss" class="boss-badge"><BaseIcon name="crowned-skull" gradient="gold" :size="12" /> 首领</div>
                  </div>
                  <div class="combatant-bars">
                    <ResourceBar icon="health-normal" iconGradient="blood" name="HP" :current="e.hp" :max="e.maxHp" :percent="getHpPercent(e)" type="hp" />
                  </div>
                  <!-- Buff/Debuff 效果指示器 -->
                  <div v-if="getEnemyEffectCount(e.id) > 0" class="effects-indicator enemy-effects">
                    <span v-for="eff in getEnemyEffects(e.id)" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type, isBuffEffect(eff.type) ? 'effect-buff' : 'effect-debuff']">
                      <BaseIcon :name="getEffectIcon(eff.type)" :gradient="isBuffEffect(eff.type) ? 'buff' : 'debuff'" :size="12" /> {{ effectLabels[eff.type] || eff.type }} {{ formatEffectValue(eff.type, eff.value) }} {{ eff.remainingTurns }}回合
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
        <div ref="vsDividerRef" class="vs-divider" :class="{ 'flash': vsFlash }"><BaseIcon name="crossed-swords" gradient="physical" :size="20" /></div>

        <!-- 玩家区域 -->
        <div class="combatant player-side" :class="{ 'shake': playerShake, 'crit-shake': playerCritShake, 'dodge-blink': playerDodgeBlink }">
          <div class="combatant-avatar">{{ playerIcon }}</div>
          <div class="combatant-info">
            <div class="combatant-name">{{ playerName }}</div>
            <div class="combatant-level">Lv.{{ playerLevel }}</div>
          </div>
          <div class="combatant-bars">
            <ResourceBar icon="health-normal" iconGradient="blood" name="HP" :current="playerHp" :max="playerMaxHp" :percent="playerHpPercent" type="hp" />
            <ResourceBar icon="magic-palm" iconGradient="mana" name="MP" :current="playerMp" :max="playerMaxMp" :percent="playerMpPercent" type="mp" />
            <!-- Buff/Debuff 效果指示器 -->
            <template v-if="combatStore.playerEffects.effects.length > 0">
              <div class="effects-indicator">
                <span v-for="eff in combatStore.playerEffects.effects" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type, isBuffEffect(eff.type) ? 'effect-buff' : 'effect-debuff']">
                  <BaseIcon :name="getEffectIcon(eff.type)" :gradient="isBuffEffect(eff.type) ? 'buff' : 'debuff'" :size="12" /> {{ effectLabels[eff.type] || eff.type }} {{ formatEffectValue(eff.type, eff.value) }} {{ eff.remainingTurns }}回合
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
          <span v-if="log.heal && log.heal > 0" class="log-heal"><BaseIcon name="health-increase" gradient="heal" :size="12" /> +{{ log.heal }}</span>
          <span v-if="log.isCrit" class="log-crit">暴击！</span>
          <span v-if="log.isDodge" class="log-dodge">闪避！</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">战斗即将开始...</div>
      </div>

      <!-- 行动按钮区域 -->
      <div class="combat-actions">
        <div class="action-row primary-actions">
          <button class="action-btn attack-btn" @click="doAction('attack')" :disabled="!canAct">
            <BaseIcon name="sword-clash" gradient="physical" :size="16" /> 普通攻击
          </button>
          <button class="action-btn item-btn" @click="openItemModal" :disabled="!canAct || !hasConsumables">
            <BaseIcon name="potion-ball" gradient="heal" :size="16" /> 物品
          </button>
          <button class="action-btn skip-btn" @click="doSkip" :disabled="!canAct">
            <BaseIcon name="next-button" gradient="metal" :size="16" /> 跳过
          </button>
          <button class="action-btn flee-btn" @click="doAction('flee')" :disabled="!canAct || combatStore.hasBossEnemy">
            <BaseIcon name="run" gradient="dodge" :size="16" /> 逃跑
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
            <span class="skill-icon"><BaseIcon :name="skill.icon" :size="14" /></span>
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
          <span class="enemy-turn-text"><BaseIcon name="uncertainty" gradient="shadow" :size="16" /> 敌人行动中...</span>
        </div>
      </div>
    </div>

    <!-- 战斗结果弹窗 -->
    <div v-if="combatStore.combatResult" class="result-overlay">
      <div ref="resultPopupRef" class="result-popup">
        <div ref="resultIconRef" class="result-icon"><BaseIcon :name="resultIconName" :gradient="resultIconGradient" :size="24" /></div>
        <div ref="resultTextRef" :class="['result-text', 'result-' + combatStore.combatResult]">
          {{ resultText }}
        </div>
        <div class="result-rewards" v-if="combatStore.combatResult === 'victory'">
          <div v-if="combatStore.expGained > 0" class="reward-item"><BaseIcon name="star-formation" gradient="gold" :size="14" /> +{{ combatStore.expGained }} 经验</div>
          <div v-if="combatStore.goldGained > 0" class="reward-item"><BaseIcon name="coins" gradient="gold" :size="14" /> +{{ combatStore.goldGained }} 金币</div>
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
          <button class="item-modal-close" @click="showItemModal = false; eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_item_modal_close' })"><BaseIcon name="cancel" :size="16" /></button>
        </div>
        <div class="item-modal-body">
          <div
            v-for="item in consumableItems"
            :key="item.itemId"
            class="item-option"
            @click="useItem(item.itemId, item.index)"
          >
            <ItemIcon :icon="item.icon" :rarity="item.rarity" size="md" />
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
import type { ItemRarity } from '@/modules/inventory/types';
import ResourceBar from '@/components/common/ResourceBar.vue';
import ItemIcon from '@/components/common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
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
  animateMagicPulse,
  animateHealGlow,
  animateManaGlow,
  animateCritBorderFlash,
  createParticleBurst,
} from '@/modules/animation/combat-effects';
import type { FloatingType, ParticleConfig } from '@/modules/animation/combat-effects';

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
const enemyFloatings = ref<Record<string, { text: string; type: FloatingType } | null>>({});
// 保留这些全局动画
const playerShake = ref(false);
const playerCritShake = ref(false);
const playerDodgeBlink = ref(false);
const vsFlash = ref(false);
const playerFloating = ref<{ text: string; type: FloatingType } | null>(null);
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
const playerIcon = computed(() => characterStore.raceIcon || 'person');
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
          icon: info.icon || 'backpack',
          description: buildItemDescription(info),
          rarity: info.rarity
        };
      })
      .filter(Boolean) as { index: number; itemId: string; count: number; name: string; icon: string; description: string; rarity: ItemRarity }[];
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
  if (effect.type === 'physical_damage' && effect.value > 0) parts.push(`物理伤害 ${effect.value}`);
  if (effect.type === 'magic_damage' && effect.value > 0) parts.push(`法术伤害 ${effect.value}`);
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
  if (log.eventType === 'combat_skill_cast') return 'magic-swirl';
  if (log.eventType === 'combat_critical') return 'sword-clash';
  return 'pointy-sword';
}

/** 效果图标映射 */
const effectIcons: Record<string, string> = {
  poison: 'skull-poison', burn: 'flame', stun: 'stun-glow', freeze: 'snowflake', silence: 'silenced',
  shield: 'shield', attack_up: 'sword-clash', attack_down: 'sword-clash', defense_up: 'shield',
  defense_down: 'shield', speed_up: 'dodge', speed_down: 'turtle', regen: 'regeneration',
  thorn: 'cactus', vulnerable: 'heart-organ',
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
  return effectIcons[type] || 'game-icons:sparkles';
}

const resultText = computed(() => {
  switch (combatStore.combatResult) {
    case 'victory': return '战斗胜利！';
    case 'defeat': return '战斗失败...';
    case 'fled': return '成功逃跑！';
    default: return '';
  }
});

/** 战斗结果图标名称 */
const resultIconName = computed(() => {
  if (combatStore.combatResult === 'victory') return 'laurel-crown';
  if (combatStore.combatResult === 'defeat') return 'death-skull';
  return 'run';
});

/** 战斗结果图标渐变 */
const resultIconGradient = computed(() => {
  if (combatStore.combatResult === 'victory') return 'gold';
  if (combatStore.combatResult === 'defeat') return 'debuff';
  return 'dodge';
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
function showFloating(target: 'enemy' | 'player', text: string, type: FloatingType, enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyFloatings.value[enemyId] = { text, type };
    nextTick(() => {
      const el = document.querySelector(`[data-enemy-float="${enemyId}"]`) as HTMLElement;
      if (el) animateFloating(el, type, combatSpeed.value);
    });
    setTimeout(() => { if (enemyFloatings.value[enemyId]) enemyFloatings.value[enemyId] = null; }, 2200);
  } else {
    playerFloating.value = { text, type };
    nextTick(() => {
      const el = document.querySelector('.player-side .floating-damage') as HTMLElement;
      if (el) animateFloating(el, type, combatSpeed.value);
    });
    setTimeout(() => { playerFloating.value = null; }, 2200);
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

// 法术伤害：缩放脉冲（T1 新增）
function triggerMagicPulse(target: 'enemy' | 'player', enemyId?: string) {
  nextTick(() => {
    const selector = target === 'enemy' && enemyId
      ? `[data-enemy-shake="${enemyId}"]`
      : '.player-side';
    const el = document.querySelector(selector) as HTMLElement;
    if (el) animateMagicPulse(el, combatSpeed.value);
  });
}

// 生命恢复：绿色光晕（T1 新增）
function triggerHealGlow() {
  nextTick(() => {
    const el = document.querySelector('.player-side') as HTMLElement;
    if (el) animateHealGlow(el, combatSpeed.value);
  });
}

// 法力恢复：蓝色光晕（T1 新增）
function triggerManaGlow() {
  nextTick(() => {
    const el = document.querySelector('.player-side') as HTMLElement;
    if (el) animateManaGlow(el, combatSpeed.value);
  });
}

// 暴击：金色边框爆闪（T1 新增）
function triggerCritBorderFlash(target: 'enemy' | 'player', enemyId?: string) {
  nextTick(() => {
    const selector = target === 'enemy' && enemyId
      ? `[data-enemy-shake="${enemyId}"]`
      : '.player-side';
    const el = document.querySelector(selector) as HTMLElement;
    if (el) animateCritBorderFlash(el, combatSpeed.value);
  });
}

// 粒子爆发（T2 新增）
function triggerParticles(target: 'enemy' | 'player', config: ParticleConfig, enemyId?: string) {
  nextTick(() => {
    const selector = target === 'enemy' && enemyId
      ? `[data-enemy-shake="${enemyId}"]`
      : '.player-side';
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    // 使用 combat-container 作为容器，确保粒子正确叠加在战斗界面上
    const container = document.querySelector('.combat-container') as HTMLElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    createParticleBurst(container, {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    }, config, combatSpeed.value);
  });
}

/** 物理伤害粒子配置 */
const PHYSICAL_PARTICLES: ParticleConfig = {
  count: 7,
  colors: ['#ff6b6b', '#ff4444', '#ff8c00', '#ff9999'],
  shape: 'slash',
  radius: 40,
  sizeRange: [3, 6],
  duration: 800,
};

/** 法术伤害粒子配置 */
const MAGIC_PARTICLES: ParticleConfig = {
  count: 11,
  colors: ['#a855f7', '#c084fc', '#9333ea', '#d8b4fe'],
  shape: 'circle',
  radius: 50,
  sizeRange: [4, 8],
  duration: 900,
};

/** 生命恢复粒子配置 */
const HEAL_PARTICLES: ParticleConfig = {
  count: 9,
  colors: ['#4CAF50', '#81c784', '#a5d6a7', '#66bb6a'],
  shape: 'spark',
  radius: 35,
  sizeRange: [4, 7],
  duration: 1000,
};

/** 法力恢复粒子配置 */
const MANA_PARTICLES: ParticleConfig = {
  count: 9,
  colors: ['#6e9bff', '#93acff', '#4d7cff', '#b3c8ff'],
  shape: 'star',
  radius: 35,
  sizeRange: [4, 7],
  duration: 1000,
};

/** 暴击粒子配置 */
const CRIT_PARTICLES: ParticleConfig = {
  count: 16,
  colors: ['#ffd700', '#ffec8b', '#ffa500', '#ffe4b5', '#ffb90f'],
  shape: 'slash',
  radius: 60,
  sizeRange: [4, 9],
  duration: 1000,
};

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
  showFloating('player', `-${data.amount}`, 'physical');
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
function applyCombatDamageEffects(result: { aoeHits?: { enemyId: string; damage: number }[]; damage?: number; isCrit?: boolean }, damageType: 'physical' | 'magic' = 'physical') {
  if (result.aoeHits && result.aoeHits.length > 0) {
    for (const hit of result.aoeHits) {
      triggerShake('enemy', hit.enemyId);
      showFloating('enemy', `-${hit.damage}`, damageType, hit.enemyId);
      triggerParticles('enemy', damageType === 'magic' ? MAGIC_PARTICLES : PHYSICAL_PARTICLES, hit.enemyId);
    }
  } else if (result.damage && result.damage > 0) {
    const type: FloatingType = result.isCrit ? 'crit' : damageType;
    if (result.isCrit) {
      triggerCritShake('enemy', currentTarget.value?.id);
      triggerCritBorderFlash('enemy', currentTarget.value?.id);
    } else {
      triggerShake('enemy', currentTarget.value?.id);
      if (damageType === 'magic') {
        triggerMagicPulse('enemy', currentTarget.value?.id);
      }
    }
    showFloating('enemy', `-${result.damage}`, type, currentTarget.value?.id);
    triggerParticles('enemy', result.isCrit ? CRIT_PARTICLES : (damageType === 'magic' ? MAGIC_PARTICLES : PHYSICAL_PARTICLES), currentTarget.value?.id);
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

  // 根据技能类型判断伤害类型
  const unlockeds = skillsStore.unlockedSkills;
  const equippeds = skillsStore.equippedSkills;
  const allSkills = [...(unlockeds ?? []), ...((equippeds ?? []).filter(s => s != null) as NonNullable<typeof unlockeds>)];
  const skill = allSkills.find(s => s.id === skillId);
  const skillType = skill?.type || 'physical_damage';
  const dmgType: 'physical' | 'magic' = skillType === 'magic_damage' ? 'magic' : 'physical';

  // 视觉特效：伤害效果使用公共函数
  applyCombatDamageEffects(result, dmgType);
  if (result.heal && result.heal > 0) {
    showFloating('player', `+${result.heal}`, 'heal-hp');
    triggerHealGlow();
    triggerParticles('player', HEAL_PARTICLES);
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

  const result = await combatStore.playerAction({ type: 'item', itemId: _itemId });

  if (isUnmounted.value) return;

  if (!combatStore.combatResult) {
    // 伤害型物品的视觉特效（卷轴等）
    if (result.damage && result.damage > 0) {
      triggerVsFlash();
      if (result.isCrit) {
        triggerCritShake('enemy', currentTarget.value?.id);
        triggerCritBorderFlash('enemy', currentTarget.value?.id);
      } else {
        triggerShake('enemy', currentTarget.value?.id);
      }
      showFloating('enemy', `-${result.damage}`, result.isCrit ? 'crit' : 'physical', currentTarget.value?.id);
      triggerParticles('enemy', result.isCrit ? CRIT_PARTICLES : PHYSICAL_PARTICLES, currentTarget.value?.id);
    }

    // 物品恢复效果（通过 HP/MP 差值计算）
    const hpHeal = playerHp.value - prevPlayerHp;
    if (hpHeal > 0) {
      showFloating('player', `+${hpHeal}`, 'heal-hp');
      triggerHealGlow();
      triggerParticles('player', HEAL_PARTICLES);
    }
    const mpHeal = playerMp.value - prevPlayerMp;
    if (mpHeal > 0) {
      showFloating('player', `MP+${mpHeal}`, 'heal-mp');
      triggerManaGlow();
      triggerParticles('player', MANA_PARTICLES);
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

<style lang="less" scoped>
.combat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.92);
  z-index: @z-combat-overlay;
  .flex-center();
  animation: fadeIn 0.3s ease;
}

.combat-container {
  position: relative;
  width: 95%;
  max-width: 700px;
  max-height: 95vh;
  background: @gradient-panel;
  border: @border-card;
  border-radius: 16px;
  .flex-col();
  overflow: hidden;
  box-shadow: 0 8px 32px @overlay-dark;
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
  .flex-between();
  padding: 14px 20px;
  background: @overlay-dim;
  border-bottom: 1px solid @color-dark-line;
}

.combat-title { font-size: @font-xl; font-weight: @font-weight-bold; color: @color-danger-accent; }
.combat-turn { font-size: 13px; color: @color-dodge; }

/* 战斗区域 */
.combat-arena {
  display: flex;
  align-items: stretch;
  padding: 16px;
  gap: @spacing-xl;
}

.combatant {
  flex: 1;
  background: @overlay-light;
  border-radius: @radius-xl;
  padding: 14px;
  .flex-col();
  gap: @spacing-lg;
  border: 1px solid @color-dark-line;
  position: relative;
  transition: transform 0.1s;
}

.enemy-side { border-color: @color-danger-accent; }
.player-side { border-color: @color-ally; }

/* 敌人 3×2 网格容器 */
.enemy-grid {
  flex: 1.5;
  .flex-col();
  gap: @spacing-sm;
}

.enemy-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: @spacing-sm;
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
  padding: @spacing-lg;
  gap: @spacing-sm;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.1s;
}

.enemy-slot .combatant:hover {
  border-color: @damage-physical;
}

/* 空槽位占位符 */
.enemy-slot .combatant.enemy-empty {
  cursor: default;
  opacity: @opacity-disabled;
  border-style: dashed;
  border-color: @white-18;
  background: @white-03;
  .flex-col-center();
  justify-content: center;
  gap: @spacing-xs;
}

.enemy-slot .combatant.enemy-empty:hover {
  border-color: @white-18;
}

.enemy-slot .combatant.enemy-empty .empty-avatar {
  font-size: @font-6xl;
  opacity: @opacity-subtle;
}

.enemy-slot .combatant.enemy-empty .empty-text {
  font-size: 13px;
  opacity: @opacity-subtle;
  color: rgba(255, 255, 255, 0.5);
}

/* 选中目标高亮 */
.combatant.targeted {
  border-color: @accent-color !important;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.enemy-slot .combatant.targeted:hover {
  border-color: @accent-color !important;
}

/* Boss 徽章 */
.boss-badge {
  font-size: @font-xs;
  color: #ff6b5a;
  margin-top: 2px;
  font-weight: @font-weight-bold;
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
  font-size: @font-3xl;
  font-weight: @font-weight-heavy;
  pointer-events: none;
  z-index: 10;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  /* 动画由 anime.js animateFloating 处理 */
}

.floating-damage.physical { color: @damage-physical; }
.floating-damage.magic { color: @damage-magic; }
.floating-damage.heal-hp { color: @heal-hp; }
.floating-damage.heal-mp { color: @heal-mp; }
.floating-damage.crit {
  color: @damage-crit;
  font-size: 30px;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6);
}
.floating-damage.dodge {
  color: @color-dodge;
  font-size: @font-3xl;
  font-style: italic;
}

.combatant-avatar { font-size: 36px; text-align: center; }
.combatant-info { text-align: center; }
.combatant-name { font-size: @font-lg; font-weight: @font-weight-bold; color: @text-primary; }
.combatant-level { font-size: @font-sm; color: @accent-color; margin-top: 2px; }

.combatant-bars { .flex-col(); gap: @spacing-md; }

.vs-divider {
  display: flex;
  align-items: center;
  font-size: @font-4xl;
  color: @accent-color;
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
  border-radius: @radius-lg;
  overflow-y: auto;
  border: 1px solid @bg-mid-dark;
}

.log-entry {
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.5;
  color: #ccc;
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  flex-wrap: wrap;
}

.log-player .log-msg { color: @log-player; }
.log-enemy .log-msg { color: @log-enemy; }
.log-system .log-msg { color: @log-system; }

.log-turn { color: @color-dim-gray; font-size: @font-xs; }
.log-damage { font-weight: @font-weight-bold; font-size: @font-md; }
.log-damage.physical-damage { color: @damage-physical; }
.log-damage.magic-damage { color: @damage-magic; }
.log-damage.crit-damage { color: @damage-crit; }
.log-heal { color: @heal-hp; font-weight: @font-weight-bold; font-size: @font-md; }
.log-crit { color: @damage-crit; font-weight: @font-weight-bold; font-size: @font-sm; }
.log-dodge { color: @color-dodge; font-weight: @font-weight-bold; font-size: @font-sm; }
.log-empty { color: @color-mid-gray; text-align: center; padding: @spacing-4xl 0; font-style: italic; }

/* 行动按钮区域 */
.combat-actions {
  padding: 14px 16px;
  .flex-col();
  gap: @spacing-md;
  position: relative;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: @spacing-md;
}

.action-btn {
  padding: @spacing-lg @spacing-md;
  border: @border-card;
  border-radius: @radius-lg;
  background: @white-05;
  color: @popup-text-color;
  font-size: 13px;
  font-weight: @font-weight-semibold;
  cursor: pointer;
  transition: all @transition-quick;
  text-align: center;
}

.action-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); border-color: @color-dim-gray; }
.action-btn:disabled { opacity: @opacity-disabled; cursor: not-allowed; }
.attack-btn:hover:not(:disabled) { border-color: @color-danger-accent; background: rgba(233, 69, 96, 0.15); }
.item-btn:hover:not(:disabled) { border-color: @heal-hp; background: rgba(76, 175, 80, 0.15); }
.skip-btn:hover:not(:disabled) { border-color: @log-system; background: rgba(251, 191, 36, 0.15); }
.flee-btn:hover:not(:disabled) { border-color: @color-dodge; background: rgba(136, 136, 136, 0.15); }

.skill-btn {
  border-color: @skill-purple;
  .flex-col-center();
  gap: 2px;
  padding: 8px 6px;
}

.skill-btn:hover:not(:disabled) { background: rgba(139, 92, 246, 0.15); border-color: #a78bfa; }
.skill-btn.no-mp { border-color: @color-mid-gray; }
.skill-icon { font-size: @font-xl; }
.skill-name { font-size: @font-sm; font-weight: @font-weight-semibold; }
.skill-effect { font-size: @font-2xs; }
.skill-effect-physical_damage { color: @damage-physical; }
.skill-effect-magic_damage { color: @damage-magic; }
.skill-effect-health_restore { color: @heal-hp; }
.skill-effect-mana_restore { color: @heal-mp; }
.skill-effect-buff { color: @buff-color; }
.skill-effect-debuff { color: @debuff-color; }
.skill-cost {
  font-size: @font-2xs;
  color: @heal-mp;
  background: rgba(110, 155, 255, 0.15);
  border-radius: @radius-xs;
  padding: 0 4px;
}
.skill-target {
  font-size: @font-2xs;
  color: #a064ff;
  background: rgba(160, 100, 255, 0.15);
  border-radius: @radius-xs;
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
  border-radius: @radius-lg;
  .flex-center();
  z-index: 5;
  animation: fadeIn 0.3s ease;
}

.enemy-turn-text {
  color: @log-system;
  font-size: @font-xl;
  font-weight: @font-weight-bold;
  animation: pulse 1.2s infinite;
}

/* 战斗结果弹窗 */
.result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: @overlay-heavy;
  .flex-center();
  z-index: @z-item-modal;
  animation: fadeIn 0.3s ease;
}

.result-popup {
  background: @gradient-panel;
  border: @border-card;
  border-radius: 20px;
  padding: 40px 50px;
  text-align: center;
  min-width: 300px;
  box-shadow: 0 12px 40px @overlay-dark;
  /* 入场动画由 anime.js animateResultPopup 处理 */
}

.result-icon {
  font-size: 64px;
  margin-bottom: 16px;
  /* 弹跳动画由 anime.js animateResultPopup 处理 */
}

.result-text { font-size: @font-5xl; font-weight: @font-weight-bold; margin-bottom: 16px; /* 动画初始状态：隐藏 + 下移 16px，由 anime.js animateResultPopup 驱动 */ opacity: 0; transform: translateY(16px); }
.result-victory { color: @accent-color; text-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
.result-defeat { color: @color-danger-accent; text-shadow: 0 0 20px rgba(233, 69, 96, 0.3); }
.result-fled { color: @color-dodge; }

.result-rewards {
  .flex-col();
  gap: @spacing-md;
  margin-bottom: 20px;
}

.reward-item {
  font-size: @font-xl;
  color: @accent-color;
  /* 滑入动画由 anime.js animateResultPopup 处理 */
}

.result-countdown { font-size: 13px; color: @color-dodge; margin-bottom: 16px; }

.result-close-btn {
  padding: 10px 36px;
  background: @gold-bg-hover;
  border: 2px solid @accent-color;
  border-radius: @radius-lg;
  color: @accent-color;
  font-size: 15px;
  font-weight: @font-weight-semibold;
  cursor: pointer;
  transition: all @transition-quick;
}

.result-close-btn:hover {
  background: @gold-bg-strong;
}

/* 物品选择弹窗 */
.item-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: @overlay-deep;
  z-index: @z-combat-result;
  .flex-center();
}

.item-modal {
  width: 90%;
  max-width: 400px;
  max-height: 60vh;
  background: @gradient-panel;
  border: @border-card;
  border-radius: @radius-xl;
  .flex-col();
  overflow: hidden;
}

.item-modal-header {
  .flex-between();
  padding: 14px 16px;
  background: @overlay-dim;
  border-bottom: 1px solid @color-dark-line;
  font-size: @font-lg;
  font-weight: @font-weight-bold;
  color: @accent-color;
}

.item-modal-close { background: none; border: none; color: @color-dodge; font-size: @font-xl; cursor: pointer; padding: @spacing-xs @spacing-md; }
.item-modal-close:hover { color: @popup-text-color; }

.item-modal-body { flex: 1; overflow-y: auto; padding: 8px; .flex-col(); gap: @spacing-md; }

.item-option {
  display: flex;
  align-items: center;
  gap: @spacing-xl;
  padding: 10px 14px;
  background: @white-05;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-quick;
}

.item-option:hover { background: @white-10; }
.item-option .item-info { flex: 1; min-width: 0; .flex-col(); gap: 2px; }
.item-option .item-name { font-size: @font-md; color: @popup-text-color; font-weight: @font-weight-bold; }
.item-option .item-desc { font-size: @font-sm; color: @color-dodge; }
.item-option .item-count { font-size: 13px; color: @accent-color; font-weight: @font-weight-bold; flex-shrink: 0; }
.item-empty { text-align: center; padding: 24px; color: @color-mid-gray; font-style: italic; }

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
  opacity: @opacity-dimmed;
  position: relative;
}
.skill-cooldown {
  font-size: @font-2xs;
  color: #ffa500;
  background: rgba(255, 165, 0, 0.15);
  border-radius: @radius-xs;
  padding: 0 4px;
  display: inline-block;
  margin-top: 2px;
}

/* 速度切换按钮 */
.speed-toggle {
  background: @gold-bg-hover;
  border: 1px solid @accent-color;
  color: @accent-color;
  border-radius: @radius-md;
  padding: 2px 10px;
  font-size: @font-sm;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
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
  font-size: @font-xs;
  font-weight: @font-weight-semibold;
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
  background: @buff-bg;
  border: 1px solid @buff-border;
  color: @buff-color;
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
  background: @debuff-bg;
  border: 1px solid @debuff-border;
  color: @debuff-color;
}

/* 各效果细分配色（保持辨识度） */
.effect-badge.effect-poison { background: @poison-bg; border-color: @poison-border; color: @poison-color; }
.effect-badge.effect-burn { background: @burn-bg; border-color: @burn-border; color: @burn-color; }
.effect-badge.effect-stun { background: @stun-bg; border-color: @stun-border; color: @stun-color; }
.effect-badge.effect-freeze { background: @freeze-bg; border-color: @freeze-border; color: @freeze-color; }
.effect-badge.effect-silence { background: @silence-bg; border-color: @silence-border; color: @silence-color; }
.effect-badge.effect-vulnerable { background: @vulnerable-bg; border-color: @vulnerable-border; color: @vulnerable-color; }

/* ========== Boss 出场演出遮罩 ========== */
.boss-intro-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  .flex-center();
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
  background: @overlay-mid;
  padding: 32px 48px;
  border-radius: @radius-xl;
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
  font-size: @font-5xl;
  font-weight: @font-weight-heavy;
  color: @accent-color;
  margin-top: 12px;
  text-shadow: @text-glow-gold, 0 0 24px rgba(255, 215, 0, 0.6);
  /* 动画初始状态：隐藏 + 下移 20px，由 anime.js 驱动滑入 */
  opacity: 0;
  transform: translateY(20px);
}

.boss-intro-line {
  font-size: @font-lg;
  color: @popup-text-color;
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
  .flex-center();
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
  font-size: @font-md;
  font-weight: @font-weight-semibold;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-bottom: 6px;
}

.phase-transition-text {
  font-size: @font-6xl;
  font-weight: @font-weight-heavy;
  color: @accent-color;
  text-shadow: @text-glow-gold, 0 0 64px rgba(255, 100, 0, 0.4);
  white-space: nowrap;
}

/* 各特效的文字颜色 */
.phase-transition-darken .phase-transition-text { color: @accent-color; text-shadow: @text-glow-gold; }
.phase-transition-flame .phase-transition-text { color: #ff4500; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 69, 0, 0.7), 0 0 64px rgba(255, 0, 0, 0.5); }
.phase-transition-freeze .phase-transition-text { color: #00bcd4; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(0, 188, 212, 0.7), 0 0 64px rgba(0, 255, 255, 0.4); }
.phase-transition-lightning .phase-transition-text { color: @damage-magic; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(168, 85, 247, 0.7), 0 0 64px rgba(200, 100, 255, 0.5); }
.phase-transition-shake .phase-transition-text { color: #ff6347; text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 99, 71, 0.7), 0 0 64px rgba(255, 50, 0, 0.5); }

/* Boss 出场和阶段转换动画已迁移至 @/modules/animation/combat-effects.ts (anime.js) */

</style>
