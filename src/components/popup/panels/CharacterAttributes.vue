<template>
  <div class="attributes-section">
    <div class="attr-header">
      <h3>核心属性</h3>
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
        <BaseIcon :name="getAttrIcon(key).name" :gradient="getAttrIcon(key).gradient" :size="14" />
        <div class="core-attr-content">
          <span class="core-attr-name">{{ getAttrName(key) }}</span>
          <span class="core-attr-value">
            {{ value }}
            <span v-if="allocatedStats[key as keyof Stats] > 0" class="alloc-bonus">+{{ allocatedStats[key as keyof Stats] }}</span>
          </span>
        </div>
        <button
          class="alloc-btn"
          :disabled="!canAllocate"
          @click="onAllocate(key as keyof Stats)"
          :title="canAllocate ? `分配 1 点到${getAttrName(key)}` : '无可用点数'"
        >+</button>
        <div v-if="hoveredAttrKey === (key as keyof Stats)" class="attr-breakdown" role="tooltip">
          <div class="breakdown-title">{{ getAttrName(key) }} · 总值 {{ value }}</div>
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
</template>

<script setup lang="ts">
/**
 * @fileoverview 核心属性面板（无 BasePopup 外壳）
 * @description 展示六维核心属性、升级点数分配、七层属性来源 tooltip。供 CharacterInfoPopup 分段复用。
 */
import { ref, computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import type { Stats, StatSource } from '@/modules/character';
import { getStatName } from '@/modules/item/descriptors';
import BaseIcon from '@/components/common/BaseIcon.vue';

const characterStore = useCharacterStore();
const toast = useToast();

const character = computed(() => characterStore.character);
const stats = computed<Stats>(() => characterStore.effectiveStats);
const statsBreakdown = computed<Record<keyof Stats, StatSource[]>>(() => characterStore.statsBreakdown);

const ZERO_STATS: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const allocatedStats = computed<Stats>(() => character.value?.allocatedStats ?? ZERO_STATS);
const unallocatedPoints = computed<number>(() => character.value?.unallocatedPoints ?? 0);

const showAllocationBar = computed<boolean>(() => unallocatedPoints.value > 0 || hasAllocatedStats.value);
const hasAllocatedStats = computed<boolean>(() =>
  (Object.keys(allocatedStats.value) as (keyof Stats)[]).some(k => allocatedStats.value[k] > 0)
);
const canAllocate = computed<boolean>(() => unallocatedPoints.value > 0);
const canResetAllocations = computed<boolean>(() => hasAllocatedStats.value);

async function onAllocate(stat: keyof Stats): Promise<void> {
  if (!canAllocate.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'allocate_stat' });
  try {
    await characterStore.allocateStat(stat);
  } catch (err) {
    console.error('[CharacterAttributes] onAllocate 失败:', err);
    toast.show({ message: '属性分配失败，请重试', type: 'danger' });
  }
}

async function onResetAllocations(): Promise<void> {
  if (!canResetAllocations.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'reset_allocations' });
  try {
    await characterStore.resetAllocatedStats();
  } catch (err) {
    console.error('[CharacterAttributes] onResetAllocations 失败:', err);
    toast.show({ message: '属性重置失败，请重试', type: 'danger' });
  }
}

const hoveredAttrKey = ref<keyof Stats | null>(null);
function onAttrHover(key: keyof Stats): void { hoveredAttrKey.value = key; }
function onAttrHoverEnd(): void { hoveredAttrKey.value = null; }

function formatSourceValue(value: number): string {
  if (value === 0) return '—';
  return value > 0 ? `+${value}` : `${value}`;
}

const attrIcons: Record<string, { name: string; gradient: string }> = {
  str: { name: 'sword-clash', gradient: 'physical' },
  dex: { name: 'dodge', gradient: 'dodge' },
  con: { name: 'health-normal', gradient: 'blood' },
  int: { name: 'brain', gradient: 'magic' },
  wis: { name: 'eye-target', gradient: 'nature' },
  cha: { name: 'charm', gradient: 'gold' }
};

function getAttrIcon(key: string) {
  return attrIcons[key] || { name: 'uncertainty', gradient: 'shadow' };
}
function getAttrName(key: string) {
  return getStatName(key as keyof Stats) || key;
}
</script>

<style lang="less" scoped>
.attributes-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.attr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: @spacing-lg;
}

.attr-header h3 { margin: 0; }

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
  position: relative;
}

.core-attr-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.core-attr-name { font-size: @font-base; color: @accent-color; font-weight: 500; }

.core-attr-value {
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  display: flex;
  align-items: baseline;
  gap: @spacing-xs;
}

.alloc-bonus { font-size: @font-sm; color: @heal-hp; font-weight: @font-weight-bold; }

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
  animation: attr-breakdown-fade-in 0.15s ease-out;
}

@keyframes attr-breakdown-fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
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

.breakdown-label { color: @text-secondary; }
.breakdown-value { font-weight: @font-weight-bold; font-variant-numeric: tabular-nums; }

.breakdown-row.layer-base .breakdown-value { color: @text-secondary; }
.breakdown-row.layer-race .breakdown-value,
.breakdown-row.layer-class .breakdown-value { color: @accent-color; }
.breakdown-row.layer-potion .breakdown-value { color: #b388ff; }
.breakdown-row.layer-allocated .breakdown-value { color: @heal-hp; }
.breakdown-row.layer-bonus .breakdown-value { color: #4fc3f7; }
.breakdown-row.layer-mount .breakdown-value { color: #ffb74d; }

.breakdown-row.zero .breakdown-label,
.breakdown-row.zero .breakdown-value {
  color: @color-dim-gray;
  opacity: 0.6;
}
</style>
