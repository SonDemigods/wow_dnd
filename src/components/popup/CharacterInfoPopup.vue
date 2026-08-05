<template>
  <BasePopup :visible="visible" title="角色信息" @close="$emit('close')">
    <template #default>
      <div v-if="character" class="character-content">
        <!-- 角色信息和资源条 -->
        <div class="character-overview">
          <div class="character-basic">
            <div class="char-row">
              <div class="char-avatar">
                <BaseIcon
                  :name="getRaceIcon(character.raceId)"
                  :size="28"
                />
              </div>
              <div class="char-main-info">
                <div class="char-name">{{ character.name }}</div>
                <div class="char-level">Lv.{{ character.level }}</div>
              </div>
            </div>
            <div class="char-details">
              <Tag
                type="faction"
                :text="getFactionName(character.factionId)"
                :color="getFactionColor(character.factionId)"
              />
              <Tag type="race" :text="getRaceName(character.raceId)" />
              <Tag
                type="class"
                :text="getClassName(character.classId)"
                :color="getClassColor(character.classId)"
              />
            </div>
          </div>
          <div class="resource-bars">
            <ResourceBar
              icon=""
              iconName="health-normal"
              iconGradient="blood"
              name="生命"
              :current="currentHp"
              :max="maxHp"
              :percent="hpPercent"
              type="hp"
            />
            <ResourceBar
              v-if="showManaBar"
              icon=""
              iconName="magic-palm"
              iconGradient="mana"
              name="法力"
              :current="currentMp"
              :max="maxMp"
              :percent="mpPercent"
              type="mp"
            />
            <ClassResourceBar
              v-for="(sys, idx) in classResourceSystems"
              :key="'class-res-' + idx"
              :resource-system="sys"
            />
            <ResourceBar
              icon=""
              iconName="star-formation"
              iconGradient="gold"
              name="经验"
              :current="currentExp"
              :max="maxExp"
              :percent="expPercent"
              type="exp"
            />
          </div>
        </div>

        <!-- 核心属性 -->
        <div class="attributes-section">
          <div class="attr-header">
            <h3>核心属性</h3>
            <!-- 四层属性：升级点数分配入口（有未分配点数或已分配点数时显示） -->
            <div v-if="showAllocationBar" class="allocation-bar">
              <span class="alloc-points" :class="{ active: unallocatedPoints > 0 }">
                剩余点数：{{ unallocatedPoints }}
              </span>
              <button
                class="reset-alloc-btn"
                :disabled="!canResetAllocations"
                @click="onResetAllocations"
                title="重置已分配的升级点数（不影响药剂层）"
              >
                重置
              </button>
            </div>
          </div>
          <div class="core-attributes">
            <div
              class="core-attr-item"
              v-for="(value, key) in stats"
              :key="key"
              @mouseenter="onAttrHover(key as keyof Stats)"
              @mouseleave="onAttrHoverEnd"
            >
              <BaseIcon
                :name="getAttrIcon(key).name"
                :gradient="getAttrIcon(key).gradient"
                :size="14"
              />
              <div class="core-attr-content">
                <span class="core-attr-name">{{ getAttrName(key) }}</span>
                <span class="core-attr-value">
                  {{ value }}
                  <span
                    v-if="allocatedStats[key as keyof Stats] > 0"
                    class="alloc-bonus"
                  >+{{ allocatedStats[key as keyof Stats] }}</span>
                </span>
              </div>
              <button
                class="alloc-btn"
                :disabled="!canAllocate"
                @click="onAllocate(key as keyof Stats)"
                :title="canAllocate ? `分配 1 点到${getAttrName(key)}` : '无可用点数'"
              >+</button>

              <!-- 阶段四：属性来源明细 tooltip（hover 时显示） -->
              <div
                v-if="hoveredAttrKey === (key as keyof Stats)"
                class="attr-breakdown"
                role="tooltip"
              >
                <div class="breakdown-title">
                  {{ getAttrName(key) }} · 总值 {{ value }}
                </div>
                <div
                  v-for="src in statsBreakdown[key as keyof Stats]"
                  :key="src.layer"
                  class="breakdown-row"
                  :class="['layer-' + src.layer, { zero: src.value === 0 }]"
                >
                  <span class="breakdown-label">{{ src.label }}</span>
                  <span class="breakdown-value">{{ formatSourceValue(src.value) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 次级属性 -->
        <div class="secondary-section">
          <h3>次级属性</h3>
          <div class="secondary-grid">
            <div class="secondary-item attack">
              <BaseIcon name="sword-clash" gradient="physical" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">物理攻击</div>
                <div class="secondary-value">
                  {{ attributes.physicalAttack }}
                </div>
              </div>
            </div>
            <div class="secondary-item defense">
              <BaseIcon name="shield" gradient="earth" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">物理防御</div>
                <div class="secondary-value">
                  {{ attributes.physicalDefense }}
                </div>
              </div>
            </div>
            <div class="secondary-item magic-attack">
              <BaseIcon name="magic-swirl" gradient="magic" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">魔法攻击</div>
                <div class="secondary-value">{{ attributes.magicAttack }}</div>
              </div>
            </div>
            <div class="secondary-item magic-defense">
              <BaseIcon name="magic-shield" gradient="magic" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">魔法防御</div>
                <div class="secondary-value">{{ attributes.magicDefense }}</div>
              </div>
            </div>
            <div class="secondary-item crit">
              <BaseIcon name="explosion-rays" gradient="crit" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">暴击率</div>
                <div class="secondary-value">{{ attributes.critChance }}%</div>
              </div>
            </div>
            <div class="secondary-item dodge">
              <BaseIcon name="dodge" gradient="dodge" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">闪避率</div>
                <div class="secondary-value">{{ attributes.dodgeChance }}%</div>
              </div>
            </div>
          </div>
          <div class="resource-stats">
            <div class="resource-item">
              <BaseIcon name="health-normal" gradient="blood" :size="16" />
              <span class="resource-label">最大生命</span>
              <span class="resource-value">{{ attributes.maxHp }}</span>
            </div>
            <div v-if="showManaBar" class="resource-item">
              <BaseIcon name="magic-palm" gradient="mana" :size="16" />
              <span class="resource-label">最大法力</span>
              <span class="resource-value">{{ attributes.maxMana }}</span>
            </div>
          </div>
        </div>

        <!-- 装备区域 -->
        <div class="equipment-section">
          <h3>装备</h3>

          <div class="equipment-grid">
            <!-- 武器槽 -->
            <div
              v-for="slot in weaponSlots"
              :key="slot.key"
              :data-equip-slot="slot.key"
              :class="[
                'equip-slot',
                {
                  equipped: slot.equipment,
                  selected: selectedSlot?.key === slot.key,
                  locked: slot.locked
                },
                slot.equipment
                  ? 'rarity-' + (slot.equipment?.rarity || 'common')
                  : ''
              ]"
              @click="selectEquipment(slot)"
            >
              <!-- P3.2：双手武器锁定遮罩 -->
              <div v-if="slot.locked" class="slot-lock-overlay" title="被双手武器占用">
                <BaseIcon name="padlock" gradient="metal" :size="20" />
                <span class="lock-text">占用</span>
              </div>
              <template v-else-if="slot.equipment">
                <ItemIcon
                  :icon="slot.equipment?.icon"
                  :rarity="slot.equipment?.rarity"
                  fallback="broadsword"
                  size="lg"
                />
                <!-- <div class="slot-name">{{ slot.equipment.name }}</div> -->
              </template>
              <template v-else>
                <ItemIcon icon="" fallback="broadsword" size="lg" />
                <!-- <div class="slot-name empty">{{ slot.name }}</div> -->
              </template>
            </div>

            <!-- 防具槽 -->
            <div
              v-for="slot in armorSlots"
              :key="slot.key"
              :data-equip-slot="slot.key"
              :class="[
                'equip-slot',
                {
                  equipped: slot.equipment,
                  selected: selectedSlot?.key === slot.key
                },
                slot.equipment
                  ? 'rarity-' + (slot.equipment?.rarity || 'common')
                  : ''
              ]"
              @click="selectEquipment(slot)"
            >
              <template v-if="slot.equipment">
                <ItemIcon
                  :icon="slot.equipment?.icon"
                  :rarity="slot.equipment?.rarity"
                  fallback="checked-shield"
                  size="lg"
                />
                <!-- <div class="slot-name">{{ slot.equipment.name }}</div> -->
              </template>
              <template v-else>
                <ItemIcon icon="" fallback="checked-shield" size="lg" />
                <!-- <div class="slot-name empty">{{ slot.name }}</div> -->
              </template>
            </div>
          </div>

          <!-- 选中装备详情 -->
          <div v-if="selectedSlot" class="equipment-detail">
            <template v-if="selectedSlot.equipment">
              <div class="detail-header">
                <ItemIcon
                  :icon="selectedSlot.equipment.icon"
                  :rarity="selectedSlot.equipment.rarity"
                  size="xl"
                />
                <div class="detail-info">
                  <h4 :class="selectedSlot.equipment.rarity">
                    {{ selectedSlot.equipment.name }}
                  </h4>
                  <span
                    :class="['detail-rarity', selectedSlot.equipment.rarity]"
                    >{{ getRarityName(selectedSlot.equipment.rarity) }}</span
                  >
                </div>
              </div>
              <p class="detail-desc">
                {{ selectedSlot.equipment.description }}
              </p>
              <div v-if="selectedSlot.equipment.bonus" class="detail-stats">
                <div
                  v-for="(value, stat) in selectedSlot.equipment.bonus"
                  :key="stat"
                  class="stat-item"
                >
                  <span class="stat-name">{{ getStatName(stat as keyof Stats) }}</span>
                  <span class="stat-value">+{{ value }}</span>
                </div>
              </div>
              <div
                v-if="selectedSlot.equipment.levelRequirement"
                class="detail-requirement"
              >
                需要等级: {{ selectedSlot.equipment.levelRequirement }}
              </div>
              <div class="detail-actions">
                <button
                  class="action-btn unequip"
                  @click="unequipItem(selectedSlot.key)"
                >
                  卸下
                </button>
              </div>
            </template>
            <template v-else>
              <EmptyState icon="empty-box" gradient="metal" text="槽位为空" />
            </template>
          </div>
          <div v-else class="equipment-detail">
            <EmptyState icon="shield" text="点击装备槽位查看详情" />
          </div>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色信息弹窗组件
 * @description 展示角色的完整属性面板，包括核心属性、次级属性、装备槽位和卸装操作
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useEquipmentStore } from '@/modules/equipment';
import { useBaseStore } from '@/modules/base';
import { ResourceSystemFactory } from '@/modules/combat/resources';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import type { Stats, Attributes, StatSource } from '@/modules/character';
import type { EquipmentSlot, EquipmentItem } from '@/modules/equipment';
import { getRarityName, getStatName } from '@/modules/item/descriptors';
import Tag from '../common/Tag.vue';
import BasePopup from '../common/BasePopup.vue';
import ResourceBar from '../common/ResourceBar.vue';
import ClassResourceBar from '../common/ClassResourceBar.vue';
import ItemIcon from '../common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();
const equipmentStore = useEquipmentStore();

// P2 BIZ-10 修复：跟踪待清理的 animationend 监听器，弹窗卸载时主动移除
const pendingAnimCleanup: Array<{ el: HTMLElement; handler: EventListenerOrEventListenerObject }> = [];

function registerAnimCleanup(el: HTMLElement, handler: () => void): void {
  pendingAnimCleanup.push({ el, handler });
  el.addEventListener('animationend', handler, { once: true });
}
const baseStore = useBaseStore();

const character = computed(() => characterStore.character);
const stats = computed<Stats>(() => characterStore.effectiveStats);
const attributes = computed<Attributes>(() => characterStore.attributes);

// ==================== 四层属性：升级点数分配 UI 状态 ====================
// 升级层：allocatedStats（可重置，完全免费）+ unallocatedPoints（待分配池）
// 药剂层 potionStats 不可重置，UI 不暴露重置入口
const ZERO_STATS: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const allocatedStats = computed<Stats>(() => character.value?.allocatedStats ?? ZERO_STATS);
const unallocatedPoints = computed<number>(() => character.value?.unallocatedPoints ?? 0);

/** 是否显示分配条：有未分配点数或已分配点数时显示（1 级新角色隐藏） */
const showAllocationBar = computed<boolean>(() => unallocatedPoints.value > 0 || hasAllocatedStats.value);
const hasAllocatedStats = computed<boolean>(() =>
  (Object.keys(allocatedStats.value) as (keyof Stats)[]).some(k => allocatedStats.value[k] > 0)
);
/** 是否可分配：有未消耗的点数 */
const canAllocate = computed<boolean>(() => unallocatedPoints.value > 0);
/** 是否可重置：至少已分配过 1 点（无分配时点击无意义） */
const canResetAllocations = computed<boolean>(() => hasAllocatedStats.value);

/** 分配 1 点到指定属性 */
async function onAllocate(stat: keyof Stats): Promise<void> {
  if (!canAllocate.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'allocate_stat' });
  await characterStore.allocateStat(stat);
}

/** 重置升级层已分配点数（完全免费，不影响药剂层） */
async function onResetAllocations(): Promise<void> {
  if (!canResetAllocations.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'reset_allocations' });
  await characterStore.resetAllocatedStats();
}

// ==================== 阶段四：属性来源明细 tooltip ====================
// 鼠标 hover 属性项时显示该属性的各层来源构成（基础/种族/职业/药剂/升级/装备/天赋）
// 数据来源：characterStore.statsBreakdown（见 store.ts §statsBreakdown）
const statsBreakdown = computed<Record<keyof Stats, StatSource[]>>(() => characterStore.statsBreakdown);

/** 当前 hover 的属性键（null 表示无 hover） */
const hoveredAttrKey = ref<keyof Stats | null>(null);

/** 鼠标进入属性项：记录 hover 状态 */
function onAttrHover(key: keyof Stats): void {
  hoveredAttrKey.value = key;
}

/** 鼠标离开属性项：清除 hover 状态 */
function onAttrHoverEnd(): void {
  hoveredAttrKey.value = null;
}

/**
 * 格式化来源数值：正数前缀 "+"，负数前缀 "-"，0 显示 "—"
 * @param value - 该层贡献值
 */
function formatSourceValue(value: number): string {
  if (value === 0) return '—';
  return value > 0 ? `+${value}` : `${value}`;
}

const factions = computed(() => baseStore.factions);
const races = computed(() => baseStore.races);
const classes = computed(() => baseStore.classes);

const currentHp = computed(() => characterStore.hp);
const maxHp = computed(() => characterStore.maxHp);
const currentMp = computed(() => characterStore.mana);
const maxMp = computed(() => characterStore.maxMana);
const currentExp = computed(() => characterStore.exp);
const maxExp = computed(() => characterStore.expToNextLevel);

const hpPercent = computed(() => characterStore.hpPercentage);
const mpPercent = computed(() => characterStore.manaPercentage);
const expPercent = computed(() => characterStore.expPercentage);
/** 是否显示 MP 资源条（战士/盗贼/猎人等替代型资源职业隐藏 MP 条） */
const showManaBar = computed(() => !ResourceSystemFactory.replacesMana(character.value?.classId || ''));
/** 职业专属资源系统（仅替代型：怒气/能量/集中值），非战斗时携带初始值供展示 */
const classResourceSystems = computed(() => ResourceSystemFactory.getManaReplacingSystems(character.value?.classId || ''));

interface SlotInfo {
  key: EquipmentSlot;
  name: string;
  equipment: EquipmentItem | null;
  /** P3.2：是否被双手武器锁定（weapon1 双手时 weapon2 锁定） */
  locked: boolean;
}

const weaponSlots = computed<SlotInfo[]>(() => [
  {
    key: 'weapon1',
    name: '主手武器',
    equipment: equipmentStore.equipment.weapon1?.item || null,
    locked: false
  },
  {
    key: 'weapon2',
    name: '副手武器',
    equipment: equipmentStore.equipment.weapon2?.item || null,
    // P3.2：weapon1 装备双手武器时 weapon2 被锁定
    locked: equipmentStore.isSlotLocked('weapon2')
  }
]);

const armorSlots = computed<SlotInfo[]>(() => [
  {
    key: 'helm',
    name: '头部',
    equipment: equipmentStore.equipment.helm?.item || null,
    locked: false
  },
  {
    key: 'chest',
    name: '胸部',
    equipment: equipmentStore.equipment.chest?.item || null,
    locked: false
  },
  {
    key: 'gloves',
    name: '手套',
    equipment: equipmentStore.equipment.gloves?.item || null,
    locked: false
  },
  {
    key: 'legs',
    name: '腿部',
    equipment: equipmentStore.equipment.legs?.item || null,
    locked: false
  },
  {
    key: 'boots',
    name: '鞋子',
    equipment: equipmentStore.equipment.boots?.item || null,
    locked: false
  }
]);

const selectedSlot = ref<SlotInfo | null>(null);

const attrIcons: Record<string, { name: string; gradient: string }> = {
  str: { name: 'sword-clash', gradient: 'physical' },
  dex: { name: 'dodge', gradient: 'dodge' },
  con: { name: 'health-normal', gradient: 'blood' },
  int: { name: 'brain', gradient: 'magic' },
  wis: { name: 'eye-target', gradient: 'nature' },
  cha: { name: 'charm', gradient: 'gold' }
};

async function loadData() {
  await baseStore.loadAllData();
}

function getRaceIcon(raceId: string) {
  const icon = races.value.find((r) => r.id === raceId)?.icon;
  return icon || 'person';
}

function getRaceName(raceId: string) {
  return races.value.find((r) => r.id === raceId)?.name || '';
}

function getFactionName(factionId: string) {
  return factions.value.find((f) => f.id === factionId)?.name || '';
}

function getFactionColor(factionId: string) {
  return factions.value.find((f) => f.id === factionId)?.color || '#9d9d9d';
}

function getClassName(classId: string) {
  return classes.value.find((c) => c.id === classId)?.name || '';
}

function getClassColor(classId: string) {
  return classes.value.find((c) => c.id === classId)?.color || '#9d9d9d';
}

function getAttrIcon(key: string) {
  return attrIcons[key] || { name: 'uncertainty', gradient: 'shadow' };
}

function getAttrName(key: string) {
  // P3.3b：属性名称统一从 descriptors.getStatName 获取（消除本地 attrNames 映射）
  return getStatName(key as keyof Stats) || key;
}

function selectEquipment(slot: SlotInfo) {
  // P3.2：被双手武器锁定的槽位不可选中
  if (slot.locked) {
    useToast().show({
      message: '该槽位被双手武器占用，无法操作',
      type: 'warning',
      icon: '🔒'
    });
    return;
  }
  selectedSlot.value = slot;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'equip_slot' });
}

async function unequipItem(slotKey: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'unequip_btn' });
  try {
    const result = await equipmentStore.unequipItem(slotKey as EquipmentSlot);
    if (result) {
      // 装备槽卸下动画
      // P3 TS-13 修复：使用 instanceof 守卫收窄 HTMLElement 类型，替代 as 断言
      const slotElRaw = document.querySelector(`[data-equip-slot="${slotKey}"]`);
      if (slotElRaw instanceof HTMLElement) {
        slotElRaw.classList.add('equip-anim-empty');
        // P2 BIZ-10 修复：使用 registerAnimCleanup 跟踪监听器，弹窗卸载时主动清理
        registerAnimCleanup(slotElRaw, () => {
          slotElRaw.classList.remove('equip-anim-empty');
        });
      }
      selectedSlot.value = null;
    }
  } catch (e) {
    useToast().show({
      message: e instanceof Error ? e.message : '卸下装备失败',
      type: 'danger',
      duration: 3000
    });
  }
}

onMounted(async () => {
  await loadData();
  if (characterStore.currentCharacterId) {
    await equipmentStore.initialize(characterStore.currentCharacterId);
  }
});

// P2 BIZ-10 修复：弹窗卸载时主动清理未触发的 animationend 监听器
onUnmounted(() => {
  pendingAnimCleanup.forEach(({ el, handler }) => {
    el.removeEventListener('animationend', handler);
  });
  pendingAnimCleanup.length = 0;
});


</script>

<style lang="less" scoped>
.character-content {
  .flex-col();
  gap: @spacing-3xl;
}

/* 角色信息和资源条概览 */
.character-overview {
  .flex-col();
  gap: @spacing-xl;
  padding: @spacing-xl;
  background: @white-05;
  border-radius: @radius-lg;
}

.character-basic {
  .flex-col();
  gap: @spacing-lg;
}

.char-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.char-avatar {
  font-size: 40px;
  width: 52px;
  height: 52px;
  .flex-center();
  background: @gold-bg-hover;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.char-avatar-text {
  font-size: 40px;
  width: 52px;
  height: 52px;
  .flex-center();
  background: @gold-bg-hover;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.char-main-info {
  .flex-col();
  gap: 2px;
}

.char-name {
  font-size: 22px;
  color: @text-primary;
  font-weight: @font-weight-bold;
  line-height: 1.2;
}

.char-level {
  font-size: @font-md;
  color: @accent-color;
  font-weight: @font-weight-bold;
  background: @gold-bg;
  padding: @spacing-2xs @spacing-md;
  border-radius: @radius-sm;
  display: inline-block;
  width: fit-content;
}

.char-details {
  display: flex;
  gap: @spacing-xs;
  flex-wrap: wrap;
}

.resource-bars {
  .flex-col();
  gap: @spacing-sm;
}

/* 核心属性 */
.attributes-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

/* 四层属性：升级点数分配条 */
.attr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: @spacing-lg;
}

.attr-header h3 {
  margin: 0;
}

.allocation-bar {
  display: flex;
  align-items: center;
  gap: @spacing-md;
}

.alloc-points {
  font-size: @font-sm;
  color: @text-secondary;
  padding: @spacing-2xs @spacing-md;
  background: @white-05;
  border-radius: @radius-sm;
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.alloc-points.active {
  color: @accent-color;
  background: @gold-bg;
  border-color: rgba(255, 215, 0, 0.5);
  font-weight: @font-weight-bold;
}

.reset-alloc-btn {
  padding: @spacing-2xs @spacing-md;
  border: 1px solid rgba(255, 100, 100, 0.4);
  border-radius: @radius-sm;
  background: rgba(255, 100, 100, 0.1);
  color: #ff8888;
  font-size: @font-xs;
  cursor: pointer;
  transition: all @transition-quick;
}

.reset-alloc-btn:hover:not(:disabled) {
  background: rgba(255, 100, 100, 0.25);
  border-color: rgba(255, 100, 100, 0.7);
}

.reset-alloc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.core-attributes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-md;
}

.core-attr-item {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border-radius: @radius-md;
  border: 1px solid rgba(255, 215, 0, 0.3);
  /* 阶段四：作为 .attr-breakdown tooltip 的定位上下文 */
  position: relative;
}

.core-attr-icon {
  font-size: @font-2xl;
}

.core-attr-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.core-attr-name {
  font-size: @font-base;
  color: @accent-color;
  font-weight: 500;
}

.core-attr-value {
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  display: flex;
  align-items: baseline;
  gap: @spacing-xs;
}

/* 升级层已分配点数（绿色 +N 标识） */
.alloc-bonus {
  font-size: @font-sm;
  color: @heal-hp;
  font-weight: @font-weight-bold;
}

/* 分配按钮（"+"） */
.alloc-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 215, 0, 0.5);
  border-radius: @radius-sm;
  background: @gold-bg;
  color: @accent-color;
  font-size: @font-lg;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}

.alloc-btn:hover:not(:disabled) {
  background: @gold-bg-strong;
  transform: scale(1.1);
}

.alloc-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: @white-05;
}

/* ==================== 阶段四：属性来源明细 tooltip ==================== */
/* hover 属性项时浮在上方，展示四层属性各层贡献 */
.attr-breakdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  min-width: 160px;
  padding: @spacing-sm @spacing-md;
  background: @popup-bg;
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: @radius-sm;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  user-select: none;
  /* 入场动画 */
  animation: attr-breakdown-fade-in 0.15s ease-out;
}

@keyframes attr-breakdown-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.breakdown-title {
  font-size: @font-sm;
  color: @accent-color;
  font-weight: @font-weight-bold;
  padding-bottom: @spacing-xs;
  margin-bottom: @spacing-xs;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
  white-space: nowrap;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: @spacing-md;
  padding: 2px 0;
  font-size: @font-xs;
}

.breakdown-label {
  color: @text-secondary;
}

.breakdown-value {
  font-weight: @font-weight-bold;
  font-variant-numeric: tabular-nums;
}

/* 各层颜色区分（与 effectiveStats 各层语义对应） */
.breakdown-row.layer-base .breakdown-value {
  color: @text-secondary;
}

.breakdown-row.layer-race .breakdown-value,
.breakdown-row.layer-class .breakdown-value {
  color: @accent-color;
}

.breakdown-row.layer-potion .breakdown-value {
  color: #b388ff; /* 药剂层：紫色，标识永久不可重置 */
}

.breakdown-row.layer-allocated .breakdown-value {
  color: @heal-hp; /* 升级层：绿色，与 +N alloc-bonus 颜色一致 */
}

.breakdown-row.layer-bonus .breakdown-value {
  color: #4fc3f7; /* 装备/天赋层：蓝色 */
}

/* 零值层灰色弱化（仍保留展示，便于玩家了解全部来源） */
.breakdown-row.zero .breakdown-label,
.breakdown-row.zero .breakdown-value {
  color: @color-dim-gray;
  opacity: 0.6;
}

/* 次级属性 */
.secondary-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-md;
  margin-bottom: @spacing-xl;
}

.secondary-item {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-lg @spacing-xl;
  background: @white-05;
  border-radius: @radius-md;
  border-left: 3px solid transparent;
}

.secondary-item.attack {
  border-left-color: @damage-physical;
}
.secondary-item.defense {
  border-left-color: #4ecdc4;
}
.secondary-item.magic-attack {
  border-left-color: #a29bfe;
}
.secondary-item.magic-defense {
  border-left-color: #fd79a8;
}
.secondary-item.crit {
  border-left-color: #fdcb6e;
}
.secondary-item.dodge {
  border-left-color: #74b9ff;
}

.secondary-icon {
  font-size: @font-xl;
  flex-shrink: 0;
}

.secondary-info {
  flex: 1;
}

.secondary-label {
  font-size: @font-sm;
  color: @text-secondary;
  margin-bottom: 2px;
}

.secondary-value {
  font-size: @font-md;
  color: @text-primary;
  font-weight: @font-weight-bold;
}

.resource-stats {
  display: flex;
  gap: @spacing-md;
}

.resource-stats .resource-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: @spacing-sm @spacing-lg;
  background: @white-05;
  border-radius: @radius-md;
}

.resource-stats .resource-icon {
  font-size: @font-sm;
}

.resource-stats .resource-label {
  font-size: @font-xs;
  color: @text-secondary;
  flex: 1;
}

.resource-stats .resource-value {
  font-size: @font-sm;
  color: @text-primary;
  font-weight: @font-weight-bold;
}

/* 装备区域 */
.equipment-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: @spacing-md;
  margin-bottom: @spacing-xl;
}

.equip-slot {
  .flex-col-center();
  justify-content: center;
  gap: @spacing-xs;
  padding: @spacing-md @spacing-md;
  background: @white-05;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  min-height: 80px;
  aspect-ratio: 1;
}

.equip-slot.equip-anim-fill {
  animation: equip-slot-fill 0.6s ease;
}

.equip-slot.equip-anim-empty {
  animation: equip-slot-empty 0.6s ease;
}

.equip-slot:hover {
  background: @white-10;
}

.equip-slot.selected {
  background: @gold-bg-strong;
}

.equip-slot.equipped {
  background: rgba(255, 255, 255, 0.08);
}

.equip-slot.equipped.selected {
  background: @gold-bg-strong;
}

/* P3.2：双手武器锁定槽位样式 */
.equip-slot.locked {
  background: @overlay-deep;
  border: 1px dashed @color-dim-gray;
  cursor: not-allowed;
  opacity: 0.6;
  position: relative;
}

.equip-slot.locked:hover {
  background: @overlay-deep;
  transform: none;
}

.slot-lock-overlay {
  .flex-col-center();
  gap: @spacing-2xs;
  color: @color-dim-gray;
}

.slot-lock-overlay .lock-text {
  font-size: @font-2xs;
  color: @text-secondary;
  font-weight: @font-weight-bold;
}

.slot-name {
  font-size: @font-2xs;
  color: @text-primary;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.slot-name.empty {
  color: @color-dim-gray;
}

/* 装备详情 */
.equipment-detail {
  background: @overlay-light;
  border: @border-sm;
  border-radius: @radius-lg;
  padding: 14px;
}

.detail-header {
  display: flex;
  gap: @spacing-xl;
  align-items: center;
  margin-bottom: @spacing-lg;
}

.detail-info {
  flex: 1;
}

.detail-info h4 {
  font-size: @font-lg;
  color: @text-primary;
  font-weight: @font-weight-bold;
  margin: 0 0 @spacing-xs 0;
}

.detail-info h4.common {
  color: @popup-text-color;
}
.detail-info h4.uncommon {
  color: #1eff00;
}
.detail-info h4.rare {
  color: #0070dd;
}
.detail-info h4.epic {
  color: #a335ee;
}
.detail-info h4.legendary {
  color: #ff8000;
}

.detail-rarity {
  font-size: @font-sm;
}

.detail-rarity.common {
  color: #9d9d9d;
}
.detail-rarity.uncommon {
  color: #1eff00;
}
.detail-rarity.rare {
  color: #0070dd;
}
.detail-rarity.epic {
  color: #a335ee;
}
.detail-rarity.legendary {
  color: #ff8000;
}

.detail-desc {
  color: #aaa;
  font-size: @font-base;
  margin: @spacing-md 0;
}

.detail-stats {
  .flex-col();
  gap: @spacing-xs;
  margin-bottom: @spacing-lg;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: @spacing-xs @spacing-md;
  background: @green-bg;
  border-radius: @radius-sm;
}

.stat-name {
  color: @text-secondary;
  font-size: @font-base;
}

.stat-value {
  color: @heal-hp;
  font-size: @font-base;
  font-weight: @font-weight-bold;
}

.detail-requirement {
  color: @accent-color;
  font-size: @font-sm;
  margin-bottom: @spacing-lg;
  padding: @spacing-xs @spacing-md;
  background: @gold-bg;
  border-radius: @radius-sm;
  display: inline-block;
}

.detail-actions {
  display: flex;
  gap: @spacing-md;
  margin-top: @spacing-lg;
}

.action-btn {
  padding: @spacing-md @spacing-3xl;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.unequip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: @popup-text-color;
}
</style>
