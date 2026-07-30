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
                    <ResourceBar icon="health-normal" iconGradient="blood" name="生命" :current="e.hp" :max="e.maxHp" :percent="getHpPercent(e)" type="hp" />
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
          <div class="combatant-avatar"><BaseIcon :name="playerIcon" :size="28" /></div>
          <div class="combatant-info">
            <div class="combatant-name">{{ playerName }}</div>
            <div class="combatant-level">Lv.{{ playerLevel }}</div>
          </div>
          <div class="combatant-bars">
            <ResourceBar icon="health-normal" iconGradient="blood" name="生命" :current="playerHp" :max="playerMaxHp" :percent="playerHpPercent" type="hp" />
            <ResourceBar v-if="showManaBar" icon="magic-palm" iconGradient="mana" name="法力" :current="playerMp" :max="playerMaxMp" :percent="playerMpPercent" type="mp" />
            <!-- 职业专属资源条（怒气/能量/连击点/灵魂碎片/真气等） -->
            <ClassResourceBar
              v-for="(sys, idx) in combatStore.resourceSystems"
              :key="'class-res-' + idx"
              :resource-system="sys"
            />
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
            :class="{ 'no-mp': !canCastSkill(skill), 'on-cooldown': skillsStore.isOnCooldown(skill.id) }"
            @click="doSkill(skill.id)"
            :disabled="!canAct || !canCastSkill(skill) || skillsStore.isOnCooldown(skill.id)"
          >
            <span class="skill-icon"><BaseIcon :name="skill.icon" :size="18" /></span>
            <span class="skill-name">{{ skill.name }}</span>
            <span :class="['skill-effect', `skill-effect-${skill.type}`]">{{ getSkillEffectText(skill) }}</span>
            <span class="skill-cost">{{ getSkillCostText(skill) }}</span>
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
          <div v-if="combatStore.goldGained > 0" class="reward-item"><BaseIcon name="two-coins" gradient="gold" :size="14" /> +{{ combatStore.goldGained }} 金币</div>
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
import { errorHandler } from '@/services/ErrorHandler';
import { useCombatStore } from '@/modules/combat';
import { ResourceSystemFactory } from '@/modules/combat/resources';
import { useCharacterStore } from '@/modules/character';
import { useSkillStore } from '@/modules/skill';
import { useInventoryStore } from '@/modules/inventory';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import { eventBus, GameEvents } from '@/modules/bus';
import type { CombatLog, CombatResult, CombatActionType } from '@/modules/combat';
import type { Skill } from '@/modules/skill';
import type { ItemRarity } from '@/modules/inventory';
import ResourceBar from '@/components/common/ResourceBar.vue';
import ClassResourceBar from '@/components/common/ClassResourceBar.vue';
import ItemIcon from '@/components/common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { animateResultPopup } from '@/modules/animation';
// QA-5 阶段四：抽离的 4 个 composable（通过 combat 模块公共入口导入，符合 ARCH-4 规范）
import { useCombatSpeed, useCombatAutoClose, useBossIntroOverlay, useCombatAnimations } from '@/modules/combat';

const emit = defineEmits<{
  (e: 'close', result?: CombatResult): void;
}>();

/** 组件是否已卸载，防止异步回调在卸载后修改状态触发 Vue DOM 错误 */
const isUnmounted = ref(false);

/**
 * 动画定时器集合
 *
 * 收集所有短时动画 setTimeout（浮动数字、震动、闪避、屏幕闪白、Boss 介绍等），
 * 在 onUnmounted 中统一清理，防止组件卸载后定时器仍触发并访问已卸载组件的响应式状态
 * （触发 Vue "unmounted component" 警告或状态不一致）。
 */
const animationTimers = new Set<ReturnType<typeof setTimeout>>();

/**
 * 注册动画定时器
 *
 * 包装 setTimeout：定时器执行后自动从集合中移除；
 * 组件卸载时通过 clearAllAnimationTimers 统一清理未触发的定时器。
 */
function setAnimTimer(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => {
    animationTimers.delete(timer);
    fn();
  }, delay);
  animationTimers.add(timer);
  return timer;
}

/** 清理所有未触发的动画定时器（onUnmounted 调用） */
function clearAllAnimationTimers(): void {
  animationTimers.forEach(t => clearTimeout(t));
  animationTimers.clear();
}

const characterStore = useCharacterStore();
const skillsStore = useSkillStore();
const inventoryStore = useInventoryStore();
const combatStore = useCombatStore();
const logRef = ref<HTMLElement | null>(null);
const isAnimating = ref(false);
const showItemModal = ref(false);
// ==================== QA-5 阶段四：Composable 调用 ====================

// 倍速切换（combatSpeed + toggleSpeed）
const { combatSpeed, toggleSpeed } = useCombatSpeed();

// 自动关闭倒计时（autoCloseCountdown + scheduleAutoClose + clearAutoClose）
const {
  autoCloseCountdown,
  scheduleAutoClose,
  clearAutoClose: clearAutoCloseTimer,
  handleClose: handleCloseAutoClose,
} = useCombatAutoClose(() => {
  emit('close', combatStore.combatResult || undefined);
});

// 当前目标敌人 ID（animations 依赖注入需要，提前声明）
const currentTarget = computed(() => combatStore.currentTarget);

// Boss 出场演出（showBossIntro + onBossIntro + dispose）
const {
  showBossIntro,
  bossIntroIcon,
  bossIntroName,
  bossIntroLines,
  bossIntroOverlayRef,
  bossIntroIconRef,
  bossIntroNameRef,
  bossIntroLineRefs,
  onBossIntro,
  dispose: disposeBossIntro,
} = useBossIntroOverlay({
  getCombatSpeed: () => combatSpeed.value,
  setAnimTimer,
  isUnmounted,
});

// 战斗视觉特效（震动/闪避/浮动数字/屏幕闪白/VS 闪光/Boss 阶段转换 + 事件处理）
const {
  enemyShakes,
  enemyCritShakes,
  enemyDodgeBlinks,
  enemyFloatings,
  playerShake,
  playerCritShake,
  playerDodgeBlink,
  vsFlash,
  playerFloating,
  screenFlash,
  screenFlashType,
  showPhaseTransition,
  phaseTransitionEffect,
  phaseTransitionName,
  screenFlashRef,
  phaseBackdropRef,
  phaseContentRef,
  vsDividerRef,
  PHYSICAL_PARTICLES,
  MAGIC_PARTICLES,
  HEAL_PARTICLES,
  MANA_PARTICLES,
  CRIT_PARTICLES,
  showFloating,
  triggerShake,
  triggerCritShake,
  triggerDodgeBlink,
  triggerScreenFlash,
  triggerMagicPulse,
  triggerHealGlow,
  triggerManaGlow,
  triggerCritBorderFlash,
  triggerParticles,
  triggerVsFlash,
  applyCombatDamageEffects,
  onCritHit,
  onEnemyDealDamage,
  onDodge,
  onBossPhase,
} = useCombatAnimations({
  getCombatSpeed: () => combatSpeed.value,
  setAnimTimer,
  isUnmounted,
  getCurrentTargetId: () => currentTarget.value?.id,
});

// 战斗状态 - 直接从 Combat Store 响应式数据派生
const turn = computed(() => combatStore.turn);
const turnCount = computed(() => combatStore.turnCount);
const logs = computed(() => combatStore.combatLogs);

/**
 * 战斗日志倒序（最新在最上面）
 * [性能] 带缓存的 computed：当 logs.value 引用未变时直接返回缓存数组，避免每次访问都创建新副本。
 * 当前战斗日志条数有限（通常 &lt; 100 条），浅拷贝开销可接受。
 * 若未来日志量增大，可改用 shallowRef + 手动控制更新频率。
 */
let cachedLogs: CombatLog[] = [];
let cachedReversed: CombatLog[] = [];
const logsReversed = computed(() => {
  if (logs.value === cachedLogs) return cachedReversed;
  cachedLogs = logs.value;
  cachedReversed = [...logs.value].reverse();
  return cachedReversed;
});

// 动画状态、Boss 出场演出状态、Boss 阶段转换状态、模板 refs 已迁移至 useCombatAnimations / useBossIntroOverlay

// 结果弹窗模板 refs（用于结果弹窗动画，保留在组件中）
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

/** 是否显示 MP 资源条（战士/盗贼/猎人等替代型资源职业隐藏 MP 条） */
const showManaBar = computed(() => !ResourceSystemFactory.replacesMana(characterStore.classId));

/** 资源类型中文名映射 */
const RESOURCE_TYPE_NAMES: Record<string, string> = {
  rage: '怒气', energy: '能量', combo_point: '连击',
  soul_shard: '碎片', chi: '真气', focus: '集中',
  holy_power: '神圣', runic_power: '符能', rune: '符文',
  fury: '怒火', soul: '灵魂', essence: '精华',
  mana: '法力',
};

/** 获取技能消耗文本（专属资源或 MP） */
function getSkillCostText(skill: Skill): string {
  if (skill.resourceType && skill.resourceCost) {
    return `${skill.resourceCost} ${RESOURCE_TYPE_NAMES[skill.resourceType] || ''}`;
  }
  // P2-76：mpCost 可选，undefined 时显示 0 MP
  return `${skill.mpCost ?? 0} MP`;
}

/** 检查技能是否可施放（MP + 专属资源双重检查） */
function canCastSkill(skill: Skill): boolean {
  // P2-76：mpCost 可选，undefined 视为 0
  if (playerMp.value < (skill.mpCost ?? 0)) return false;
  if (skill.resourceType && skill.resourceCost) {
    const sys = combatStore.resourceSystems.find(s => s.type === skill.resourceType);
    if (sys && !sys.hasEnough(skill.resourceCost)) return false;
  }
  return true;
}

// currentTarget 已在 composable 调用前声明（animations 依赖注入需要）

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
  return combatStore.enemyEffects[enemyId]?.effects || [];
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
  } catch (e) {
    console.error(e);
    errorHandler.report(e);
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
  } catch (e) {
    console.error(e);
    errorHandler.report(e);
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

// 视觉特效触发函数（showFloating / triggerShake / triggerCritShake / triggerDodgeBlink /
// triggerScreenFlash / triggerMagicPulse / triggerHealGlow / triggerManaGlow /
// triggerCritBorderFlash / triggerParticles / triggerVsFlash）、粒子配置常量
// （PHYSICAL_PARTICLES / MAGIC_PARTICLES / HEAL_PARTICLES / MANA_PARTICLES / CRIT_PARTICLES）、
// 事件处理（onCritHit / onEnemyDealDamage / onDodge / onBossIntro / onBossPhase）、
// 编排函数（applyCombatDamageEffects）已迁移至 useCombatAnimations / useBossIntroOverlay

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

// scheduleAutoClose / clearAutoClose 已迁移至 useCombatAutoClose
// （解构为 scheduleAutoClose / clearAutoCloseTimer）

/** 用户点击"确定"关闭结果弹窗 */
function handleClose() {
  handleCloseAutoClose();
  emit('close', combatStore.combatResult || undefined);
}

onMounted(() => {
  // 确保技能 Store 已初始化
  const id = characterStore.currentCharacterId;
  if (id) {
    skillsStore.initialize(id);
  }
  // 事件处理函数来自 useCombatAnimations / useBossIntroOverlay
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
  // 清理自动关闭定时器（来自 useCombatAutoClose）
  clearAutoCloseTimer();
  // 清理所有未触发的动画定时器，防止卸载后访问响应式状态
  clearAllAnimationTimers();
  // P2-60 修复：取消 Boss 出场演出动画控制器（来自 useBossIntroOverlay）
  disposeBossIntro();
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: @spacing-lg @spacing-md;
  border: @border-card;
  border-radius: @radius-lg;
  background: @white-05;
  color: @popup-text-color;
  font-size: 13px;
  font-weight: @font-weight-semibold;
  cursor: pointer;
  transition: all @transition-quick;
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
