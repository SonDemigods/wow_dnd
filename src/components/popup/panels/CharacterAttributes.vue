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
      >
        <div class="attr-main">
          <BaseIcon :name="getAttrIcon(key).name" :gradient="getAttrIcon(key).gradient" :size="14" />
          <div class="core-attr-content">
            <span class="core-attr-name">{{ getAttrName(key) }}</span>
            <span class="core-attr-value">{{ value }}</span>
          </div>
          <button
            class="alloc-btn"
            :disabled="!canAllocate"
            @click="onAllocate(key as keyof Stats)"
            :title="canAllocate ? `分配 1 点到${getAttrName(key)}` : '无可用点数'"
          >+</button>
        </div>
        <div class="attr-breakdown-inline">
          <span
            v-for="src in statsBreakdown[key as keyof Stats]"
            :key="src.layer"
            class="breakdown-chip"
            :class="[
              'layer-' + src.layer,
              src.value > 0 ? 'pos' : (src.value < 0 ? 'neg' : 'zero')
            ]"
          >
            <span class="chip-label">{{ src.label }}</span>
            <span class="chip-value">{{ formatSourceValue(src.value) }}</span>
          </span>
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
import { computed } from 'vue';
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
  display: flex;
  flex-direction: column;
  gap: @spacing-md;
}

.core-attr-item {
  display: flex;
  flex-direction: column;
  gap: @spacing-xs;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border-radius: @radius-md;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.attr-main {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
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

.attr-breakdown-inline {
  display: flex;
  flex-wrap: wrap;
  gap: @spacing-sm;
  padding-left: 22px;
}

.breakdown-chip {
  display: inline-flex;
  align-items: center;
  gap: @spacing-xs;
  font-size: @font-sm;
  padding: @spacing-xs @spacing-md;
  border-radius: @radius-sm;
  background: @white-05;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.chip-label { color: @text-secondary; }
.chip-value { font-weight: @font-weight-bold; }

.breakdown-chip.pos .chip-value { color: @heal-hp; }
.breakdown-chip.neg .chip-value { color: @danger-color; }
.breakdown-chip.zero .chip-value { color: @color-dim-gray; }
</style>
