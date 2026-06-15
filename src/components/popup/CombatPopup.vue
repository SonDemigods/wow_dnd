<template>
  <div v-if="visible" class="combat-overlay">
    <div :class="['combat-container', speedClass]">
      <!-- 屏幕闪白遮罩（暴击特效） -->
      <div v-if="screenFlash" :class="['screen-flash', screenFlashType]"></div>

      <!-- Boss 出场演出遮罩（统一风格） -->
      <div v-if="showBossIntro" class="boss-intro-overlay">
        <div class="boss-intro-content">
          <div class="boss-intro-icon">{{ bossIntroIcon }}</div>
          <div class="boss-intro-name">{{ bossIntroName }}</div>
          <div v-for="(line, i) in bossIntroLines" :key="i" :class="['boss-intro-line', 'line-' + i]">
            {{ line }}
          </div>
        </div>
      </div>

      <!-- Boss 阶段转换特效 -->
      <div v-if="showPhaseTransition" :class="['phase-transition', 'phase-transition-' + phaseTransitionEffect]">
        <div class="phase-transition-backdrop"></div>
        <div class="phase-transition-content">
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
          <div class="enemy-row">
            <div
              v-for="col in 3"
              :key="'back-' + col"
              class="enemy-slot"
            >
              <template v-for="e in getEnemiesInSlot('back', col - 1)" :key="e.id">
                <div
                  :class="['combatant', 'enemy-side', {
                    'shake': enemyShakes[e.id],
                    'crit-shake': enemyCritShakes[e.id],
                    'dodge-blink': enemyDodgeBlinks[e.id],
                    'defeated': e.hp <= 0,
                    'targeted': combatStore.targetEnemyId === e.id && e.hp > 0
                  }]"
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
                    <span v-for="eff in getEnemyEffects(e.id)" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type]">
                      {{ getEffectIcon(eff.type) }} {{ eff.remainingTurns }}回合
                    </span>
                  </div>
                  <!-- 浮动伤害数字（每个敌人独立） -->
                  <div v-if="enemyFloatings[e.id]" :class="['floating-damage', enemyFloatings[e.id]!.type]">
                    {{ enemyFloatings[e.id]!.text }}
                  </div>
                </div>
              </template>
              <!-- 空槽位占位符 -->
              <div v-if="getEnemiesInSlot('back', col - 1).length === 0" class="combatant enemy-side enemy-empty">
                <div class="empty-avatar">⬛</div>
                <div class="empty-text">空位</div>
              </div>
            </div>
          </div>
          <div class="enemy-row">
            <div
              v-for="col in 3"
              :key="'front-' + col"
              class="enemy-slot"
            >
              <template v-for="e in getEnemiesInSlot('front', col - 1)" :key="e.id">
                <div
                  :class="['combatant', 'enemy-side', {
                    'shake': enemyShakes[e.id],
                    'crit-shake': enemyCritShakes[e.id],
                    'dodge-blink': enemyDodgeBlinks[e.id],
                    'defeated': e.hp <= 0,
                    'targeted': combatStore.targetEnemyId === e.id && e.hp > 0
                  }]"
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
                    <span v-for="eff in getEnemyEffects(e.id)" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type]">
                      {{ getEffectIcon(eff.type) }} {{ eff.remainingTurns }}回合
                    </span>
                  </div>
                  <!-- 浮动伤害数字（每个敌人独立） -->
                  <div v-if="enemyFloatings[e.id]" :class="['floating-damage', enemyFloatings[e.id]!.type]">
                    {{ enemyFloatings[e.id]!.text }}
                  </div>
                </div>
              </template>
              <!-- 空槽位占位符 -->
              <div v-if="getEnemiesInSlot('front', col - 1).length === 0" class="combatant enemy-side enemy-empty">
                <div class="empty-avatar">⬛</div>
                <div class="empty-text">空位</div>
              </div>
            </div>
          </div>
        </div>

        <!-- VS 分隔 -->
        <div class="vs-divider" :class="{ 'flash': vsFlash }">⚔️</div>

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
            <div v-if="combatStore.playerEffects.effects.length > 0" class="effects-indicator">
              <span v-for="eff in combatStore.playerEffects.effects" :key="eff.id" :class="['effect-badge', 'effect-' + eff.type]">
                {{ getEffectIcon(eff.type) }} {{ eff.remainingTurns }}回合
              </span>
            </div>
          </div>
          <!-- 浮动伤害数字 -->
          <div v-if="playerFloating" :class="['floating-damage', playerFloating.type]">
            {{ playerFloating.text }}
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
            <span class="skill-icon">{{ getSkillTypeIcon(skill.type) }}</span>
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-effect">{{ getSkillEffectText(skill) }}</span>
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
      <div class="result-popup">
        <div class="result-icon">{{ combatStore.combatResult === 'victory' ? '🏆' : combatStore.combatResult === 'defeat' ? '💀' : '🏃' }}</div>
        <div :class="['result-text', 'result-' + combatStore.combatResult]">
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
/**
 * @fileoverview 战斗弹窗组件
 * @description 回合制战斗界面，支持普通攻击、技能释放、物品使用和逃跑等行动，包含回合日志、伤害浮动数字和战斗结果展示
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useCombatStore } from '@/modules/combat/store';
import { useCharacterStore } from '@/modules/character';
import { useSkillsStore } from '@/modules/skill/store';
import { useInventoryStore } from '@/modules/inventory/store';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { CombatLog, CombatResult, CombatActionType } from '@/modules/combat/types';
import type { Skill } from '@/modules/skill/types';
import ResourceBar from '@/components/common/ResourceBar.vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close', result?: CombatResult): void;
}>();

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

const speedClass = computed(() => combatSpeed.value === 2 ? 'speed-x2' : '');
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

const skillTypeIcons: Record<string, string> = {
  physical_damage: '⚔️',
  magic_damage: '🔮',
  health_restore: '💚',
  mana_restore: '💙',
  buff: '⬆️',
  debuff: '⬇️'
};

function getSkillTypeIcon(type: string): string {
  return skillTypeIcons[type] || '✨';
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

function getSkillEffectText(skill: Skill): string {
  const effect = skill.effect;
  if (!effect) return '';
  const value = effect.value || 0;
  const coeff = effect.coefficient ? `x${effect.coefficient}` : '';
  switch (effect.type) {
    case 'physical_damage': return `物伤${value}${coeff}`;
    case 'magic_damage': return `魔伤${value}${coeff}`;
    case 'health_restore': return `治疗${value}${coeff}`;
    case 'mana_restore': return `回蓝${value}${coeff}`;
    case 'buff': {
      if (skill.buffs && skill.buffs.length > 0) {
        const names = skill.buffs.map(b => getEffectTypeName(b.type));
        return `增益:${names.join('/')}`;
      }
      return '增益';
    }
    case 'debuff': {
      if (skill.buffs && skill.buffs.length > 0) {
        const names = skill.buffs.map(b => getEffectTypeName(b.type));
        return `减益:${names.join('/')}`;
      }
      return '减益';
    }
    default: return '';
  }
}

function getEffectTypeName(type: string): string {
  const names: Record<string, string> = {
    poison: '中毒', burn: '灼烧', stun: '眩晕', freeze: '冰冻',
    silence: '沉默', shield: '护盾', attack_up: '加攻', attack_down: '降攻',
    defense_up: '加防', defense_down: '降防', speed_up: '加速', speed_down: '减速',
    regen: '回复', thorn: '荆棘', vulnerable: '易伤'
  };
  return names[type] || type;
}

/** 获取技能目标类型文本 */
function getTargetTypeText(targetType?: string): string {
  switch (targetType) {
    case 'all_enemies': return 'AOE';
    case 'self': return '自身';
    case 'ally': return '友方';
    default: return '';
  }
}

/** 效果图标映射 */
const effectIcons: Record<string, string> = {
  poison: '☠️', burn: '🔥', stun: '⚡', freeze: '❄️', silence: '🔇',
  shield: '🛡️', attack_up: '⬆️', attack_down: '⬇️', defense_up: '🛡️',
  defense_down: '🔻', speed_up: '💨', speed_down: '🐢', regen: '💚',
  thorn: '🌹', vulnerable: '💔',
};

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

// 浮动伤害/治疗数字
function showFloating(target: 'enemy' | 'player', text: string, type: string, enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyFloatings.value[enemyId] = { text, type };
    setTimeout(() => { if (enemyFloatings.value[enemyId]) enemyFloatings.value[enemyId] = null; }, 1800);
  } else {
    playerFloating.value = { text, type };
    setTimeout(() => { playerFloating.value = null; }, 1800);
  }
}

// 震动效果（普通攻击）
function triggerShake(target: 'enemy' | 'player', enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyShakes.value[enemyId] = true;
    setTimeout(() => { enemyShakes.value[enemyId] = false; }, 600);
  } else {
    playerShake.value = true;
    setTimeout(() => { playerShake.value = false; }, 600);
  }
}

// 暴击震动效果（更强、更持久）
function triggerCritShake(target: 'enemy' | 'player', enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyCritShakes.value[enemyId] = true;
    setTimeout(() => { enemyCritShakes.value[enemyId] = false; }, 900);
  } else {
    playerCritShake.value = true;
    setTimeout(() => { playerCritShake.value = false; }, 900);
  }
}

// 闪避闪烁效果
function triggerDodgeBlink(target: 'enemy' | 'player', enemyId?: string) {
  if (target === 'enemy' && enemyId) {
    enemyDodgeBlinks.value[enemyId] = true;
    setTimeout(() => { enemyDodgeBlinks.value[enemyId] = false; }, 800);
  } else {
    playerDodgeBlink.value = true;
    setTimeout(() => { playerDodgeBlink.value = false; }, 800);
  }
}

// 屏幕闪白特效
function triggerScreenFlash(type: 'crit' | 'dodge') {
  screenFlashType.value = type;
  screenFlash.value = true;
  setTimeout(() => { screenFlash.value = false; }, 600);
}

// 暴击事件处理
function onCritHit(data: { amount: number; damageType: string; targetName: string; actorType: 'player' | 'enemy'; enemyId?: string }) {
  // 暴击震动目标（对敌人暴击震敌人，敌人暴击震玩家）
  const shakeTarget = data.actorType === 'player' ? 'enemy' : 'player';
  triggerCritShake(shakeTarget, data.enemyId);
  // 暴击浮动文字（金色 + "暴击!" 前缀）
  showFloating(shakeTarget, `暴击! -${data.amount}`, 'crit', data.enemyId);
  // 屏幕闪白
  triggerScreenFlash('crit');
}

// 闪避事件处理
function onDodge(data: { attackerName: string; dodgerName: string; dodgerType: 'player' | 'enemy'; enemyId?: string }) {
  // 闪避者闪烁
  triggerDodgeBlink(data.dodgerType, data.enemyId);
  // 闪避浮动文字
  showFloating(data.dodgerType, '闪避!', 'dodge', data.enemyId);
  // 屏幕轻闪
  triggerScreenFlash('dodge');
}

// Boss 出场演出事件处理
function onBossIntro(data: { enemyId: string; enemyName: string; icon: string; effect: string; lines: string[]; duration: number }) {
  bossIntroIcon.value = data.icon;
  bossIntroName.value = data.enemyName;
  bossIntroLines.value = data.lines;
  showBossIntro.value = true;

  // 自动计算最短展示时长：确保每条台词有足够阅读时间
  const minDuration = 1000 + data.lines.length * 900;
  const actualDuration = Math.max(data.duration, minDuration);

  // 演出结束后自动关闭
  setTimeout(() => {
    showBossIntro.value = false;
  }, actualDuration);
}

// Boss 阶段转换事件处理
function onBossPhase(data: { enemyId: string; enemyName: string; phaseName: string; effect: string }) {
  phaseTransitionEffect.value = data.effect;
  phaseTransitionName.value = `${data.enemyName} 进入 "${data.phaseName}" 阶段！`;
  showPhaseTransition.value = true;

  // 2.5 秒后自动关闭（匹配动画时长）
  setTimeout(() => {
    showPhaseTransition.value = false;
  }, 2500);
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
  vsFlash.value = true;
  setTimeout(() => { vsFlash.value = false; }, 450);

  const result = await combatStore.playerAction({ type });

  if (!result.success) {
    isAnimating.value = false;
    return;
  }

  // 视觉特效：基于 ActionResult 播放，不再自行编排流程
  if (result.aoeHits && result.aoeHits.length > 0) {
    // AOE 技能多目标浮动伤害
    for (const hit of result.aoeHits) {
      triggerShake('enemy', hit.enemyId);
      showFloating('enemy', `-${hit.damage}`, 'damage', hit.enemyId);
    }
  } else if (result.damage && result.damage > 0) {
    triggerShake('enemy', currentTarget.value?.id);
    showFloating('enemy', `-${result.damage}`, result.isCrit ? 'crit' : 'damage', currentTarget.value?.id);
  }
  if (result.isCrit) {
    triggerCritShake('enemy', currentTarget.value?.id);
    triggerScreenFlash('crit');
  }
  if (result.isDodge) {
    // 闪避特效由 COMBAT_DODGE EventBus 事件驱动
  }

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
  vsFlash.value = true;
  setTimeout(() => { vsFlash.value = false; }, 450);

  const result = await combatStore.playerAction({ type: 'skill', skillId });

  if (!result.success) {
    isAnimating.value = false;
    return;
  }

  // 视觉特效
  if (result.aoeHits && result.aoeHits.length > 0) {
    // AOE 技能多目标浮动伤害
    for (const hit of result.aoeHits) {
      triggerShake('enemy', hit.enemyId);
      showFloating('enemy', `-${hit.damage}`, 'damage', hit.enemyId);
    }
  } else if (result.damage && result.damage > 0) {
    triggerShake('enemy', currentTarget.value?.id);
    showFloating('enemy', `-${result.damage}`, 'damage', currentTarget.value?.id);
  }
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
  eventBus.on(GameEvents.COMBAT_CRITICAL_HIT, onCritHit);
  eventBus.on(GameEvents.COMBAT_DODGE, onDodge);
  eventBus.on(GameEvents.COMBAT_BOSS_INTRO, onBossIntro);
  eventBus.on(GameEvents.COMBAT_BOSS_PHASE, onBossPhase);
});

onUnmounted(() => {
  eventBus.off(GameEvents.COMBAT_CRITICAL_HIT, onCritHit);
  eventBus.off(GameEvents.COMBAT_DODGE, onDodge);
  eventBus.off(GameEvents.COMBAT_BOSS_INTRO, onBossIntro);
  eventBus.off(GameEvents.COMBAT_BOSS_PHASE, onBossPhase);
  clearAutoClose();
});

watch(() => props.visible, async (val) => {
  if (val) {
    isAnimating.value = false;
    showItemModal.value = false;
    autoCloseCountdown.value = 0;
    enemyShakes.value = {};
    enemyCritShakes.value = {};
    enemyDodgeBlinks.value = {};
    enemyFloatings.value = {};
    playerShake.value = false;
    playerCritShake.value = false;
    playerDodgeBlink.value = false;
    vsFlash.value = false;
    playerFloating.value = null;
    screenFlash.value = false;
    clearAutoClose();
    // 确保技能 Store 已初始化
    await skillsStore.initialize();
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
}

.screen-flash.crit {
  animation: screenFlashCrit 0.6s ease-out;
}

.screen-flash.dodge {
  animation: screenFlashDodge 0.6s ease-out;
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

/* 震动效果 */
.combatant.shake {
  animation: shake 0.6s ease;
}

/* 暴击震动效果（更强） */
.combatant.crit-shake {
  animation: critShake 0.9s ease;
}

/* 闪避闪烁 */
.combatant.dodge-blink {
  animation: dodgeBlink 0.8s ease;
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
  animation: floatUp 1.6s ease forwards;
  z-index: 10;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.floating-damage.damage { color: #ff4444; }
.floating-damage.heal { color: #4CAF50; }
.floating-damage.crit {
  color: #ffd700;
  font-size: 30px;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6);
  animation: floatUpCrit 1.8s ease forwards;
}
.floating-damage.dodge {
  color: #888;
  font-size: 22px;
  font-style: italic;
  animation: floatUp 1.2s ease forwards;
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

.vs-divider.flash {
  animation: vsFlash 0.45s ease;
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
  animation: logSlideIn 0.3s ease;
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
.skill-effect { font-size: 10px; color: #fbbf24; }
.skill-cost { font-size: 10px; color: #60a5fa; }
.skill-target {
  font-size: 10px;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.15);
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
  animation: resultPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.result-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: resultBounce 0.6s ease 0.2s both;
}

.result-text { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
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
  animation: rewardSlideIn 0.4s ease both;
}

.reward-item:nth-child(2) { animation-delay: 0.2s; }

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
.item-option .item-icon { font-size: 24px; flex-shrink: 0; }
.item-option .item-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.item-option .item-name { font-size: 14px; color: #f0f0f0; font-weight: 600; }
.item-option .item-desc { font-size: 11px; color: #888; }
.item-option .item-count { font-size: 13px; color: #aaa; flex-shrink: 0; }
.item-empty { text-align: center; padding: 24px; color: #555; font-style: italic; }

/* 动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@keyframes critShake {
  0%, 100% { transform: translateX(0) scale(1); }
  10% { transform: translateX(-14px) scale(1.05); }
  30% { transform: translateX(14px) scale(0.95); }
  50% { transform: translateX(-10px) scale(1.03); }
  70% { transform: translateX(10px) scale(0.97); }
  85% { transform: translateX(-4px) scale(1.01); }
}

@keyframes dodgeBlink {
  0%, 100% { opacity: 1; filter: brightness(1); }
  25% { opacity: 0.2; filter: brightness(2); }
  50% { opacity: 1; filter: brightness(1); }
  75% { opacity: 0.3; filter: brightness(1.5); }
}

@keyframes floatUp {
  0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  30% { opacity: 1; transform: translateX(-50%) translateY(-20px) scale(1.2); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-50px) scale(0.8); }
}

@keyframes floatUpCrit {
  0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(0.5); }
  20% { opacity: 1; transform: translateX(-50%) translateY(-15px) scale(1.4); }
  40% { opacity: 1; transform: translateX(-50%) translateY(-30px) scale(1.1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-60px) scale(0.7); }
}

@keyframes screenFlashCrit {
  0% { background: rgba(255, 215, 0, 0.4); }
  30% { background: rgba(255, 215, 0, 0.15); }
  70% { background: rgba(255, 255, 255, 0.05); }
  100% { background: transparent; }
}

@keyframes screenFlashDodge {
  0% { background: rgba(255, 255, 255, 0.2); }
  50% { background: rgba(255, 255, 255, 0.05); }
  100% { background: transparent; }
}

@keyframes vsFlash {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); color: #fff; }
  100% { transform: scale(1); }
}

@keyframes logSlideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes resultPopIn {
  0% { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes resultBounce {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes rewardSlideIn {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

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
  color: #ff6b6b;
  display: block;
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

/* 2 倍速模式动画加速 */
.speed-x2 .combatant.shake { animation-duration: 0.3s; }
.speed-x2 .combatant.crit-shake { animation-duration: 0.45s; }
.speed-x2 .combatant.dodge-blink { animation-duration: 0.4s; }
.speed-x2 .floating-damage { animation-duration: 0.9s; }
.speed-x2 .screen-flash.crit { animation-duration: 0.3s; }
.speed-x2 .screen-flash.dodge { animation-duration: 0.3s; }

/* Buff/Debuff 效果指示器 */
.effects-indicator {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.effect-badge {
  font-size: 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #555;
  border-radius: 4px;
  padding: 1px 6px;
  color: #ccc;
  white-space: nowrap;
}

.effect-badge.effect-poison { border-color: #8bc34a; color: #8bc34a; }
.effect-badge.effect-burn { border-color: #ff9800; color: #ff9800; }
.effect-badge.effect-stun { border-color: #ffeb3b; color: #ffeb3b; }
.effect-badge.effect-freeze { border-color: #00bcd4; color: #00bcd4; }
.effect-badge.effect-silence { border-color: #9c27b0; color: #9c27b0; }
.effect-badge.effect-shield { border-color: #2196f3; color: #2196f3; }
.effect-badge.effect-attack_up { border-color: #f44336; color: #f44336; }
.effect-badge.effect-attack_down { border-color: #607d8b; color: #607d8b; }
.effect-badge.effect-defense_up { border-color: #4caf50; color: #4caf50; }
.effect-badge.effect-defense_down { border-color: #795548; color: #795548; }
.effect-badge.effect-speed_up { border-color: #03a9f4; color: #03a9f4; }
.effect-badge.effect-speed_down { border-color: #9e9e9e; color: #9e9e9e; }
.effect-badge.effect-regen { border-color: #4caf50; color: #4caf50; }
.effect-badge.effect-thorn { border-color: #e91e63; color: #e91e63; }
.effect-badge.effect-vulnerable { border-color: #ff5722; color: #ff5722; }

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
  animation: bossIntroIn 0.5s ease-out;
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
  animation: bossIconBounce 0.8s ease 0.2s both;
  /* 图标发光增强辨识度 */
  filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.5));
}

.boss-intro-name {
  font-size: 28px;
  font-weight: 900;
  color: #ffd700;
  margin-top: 12px;
  text-shadow: 0 0 12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 215, 0, 0.6);
  animation: bossNameIn 0.6s ease 0.4s both;
}

.boss-intro-line {
  font-size: 16px;
  color: #fff;
  margin-top: 8px;
  opacity: 0;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.5);
  animation: bossLineIn 0.5s ease forwards;
}

.boss-intro-line.line-0 { animation-delay: 0.8s; }
.boss-intro-line.line-1 { animation-delay: 1.2s; }

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
  animation: phaseBackdropFlash 2.5s ease-out;
}

/* 默认暗色遮罩 */
.phase-transition-darken .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.85) 80%);
}
.phase-transition-flame .phase-transition-backdrop {
  background: radial-gradient(ellipse at center, rgba(80, 0, 0, 0.5) 0%, rgba(40, 0, 0, 0.9) 80%);
  animation: phaseBackdropFlash 2.5s ease-out, phaseFlameFlicker 0.15s ease-in-out 6 0.3s;
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
  animation: phaseContentIn 2s ease-out;
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

/* 遮罩闪光动画 */
@keyframes phaseBackdropFlash {
  0% { opacity: 0; }
  10% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

/* 文字内容动画 */
@keyframes phaseContentIn {
  0% { opacity: 0; transform: scale(0.7); }
  15% { opacity: 1; transform: scale(1.08); }
  25% { opacity: 1; transform: scale(1); }
  80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.02); }
}

/* 火焰闪烁 */
@keyframes phaseFlameFlicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Boss 出场动画 */
@keyframes bossIntroIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bossIconBounce {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes bossNameIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bossLineIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bossFlamePulse {
  0%, 100% { background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.7) 0%, rgba(180, 40, 0, 0.5) 40%, rgba(0, 0, 0, 0.92) 100%); }
  50% { background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.65) 0%, rgba(200, 60, 0, 0.55) 40%, rgba(0, 0, 0, 0.92) 100%); }
}

/* 阶段转换动画 */

</style>
