<template>
  <div class="mount-section">
    <div class="mount-header">
      <h3>坐骑配置</h3>
      <button
        class="mount-reset-btn"
        :disabled="!hasMountChoice"
        @click="onMountReset"
        title="重置所有坐骑选择（非战斗中免费）"
      >
        重置
      </button>
    </div>

    <div class="mount-bonus-summary">
      <span class="bonus-label">当前总加成：</span>
      <template v-if="Object.keys(mountBonus).length > 0">
        <span v-for="(value, key) in mountBonus" :key="key" class="bonus-tag">
          +{{ value }} {{ getStatName(key as keyof Stats) }}
        </span>
      </template>
      <span v-else class="bonus-empty">未配置坐骑加成</span>
    </div>

    <div
      v-for="tier in mountTiers"
      :key="tier.meta.tier"
      class="mount-tier"
      :class="['tier-' + tier.meta.tier, { locked: !tier.unlocked }]"
    >
      <div class="tier-header">
        <span class="tier-label">{{ tier.meta.label }}</span>
        <span class="tier-info">
          <template v-if="tier.unlocked">
            {{ tier.meta.directionType === 'single' ? '单属性' : '双属性' }} · 总 +{{ tier.meta.bonusTotal }}
          </template>
          <template v-else>
            需 {{ tier.meta.unlockLevel }} 级解锁
          </template>
        </span>
      </div>
      <div class="tier-options">
        <button
          v-for="opt in tier.options"
          :key="opt.id"
          class="mount-option"
          :class="['rarity-' + tier.meta.tier, { selected: tier.selectedId === opt.id }]"
          :disabled="!tier.unlocked"
          @click="onMountSelect(tier.meta.index, opt.id)"
          :title="opt.description"
        >
          <span class="option-title">
            <BaseIcon :name="opt.icon" :size="16" />
            <span class="option-name">{{ opt.name }}</span>
          </span>
          <span class="option-bonus">
            <span v-for="(line, i) in mountBonusLines(opt.bonus)" :key="i" class="option-bonus-line">
              +{{ line.value }} {{ line.short }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 坐骑配置面板（无 BasePopup 外壳）
 * @description 展示 5 档坐骑配置（common→legendary）、当前总加成、选择/重置交互。供 CharacterInfoPopup 分段复用。
 */
import { useCharacterMounts } from '@/composables/useCharacterMounts';
import type { Stats } from '@/modules/character';
import { getStatName } from '@/modules/item/descriptors';
import BaseIcon from '@/components/common/BaseIcon.vue';

const { tiers: mountTiers, currentBonus: mountBonus, hasAnyChoice: hasMountChoice, setChoice: onMountSelect, resetAll: onMountReset } = useCharacterMounts();

const STAT_SHORT: Record<keyof Stats, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
};

function mountBonusLines(bonus: Partial<Stats>): { value: number; short: string }[] {
  return (Object.keys(bonus) as (keyof Stats)[]).map(k => ({ value: bonus[k]!, short: STAT_SHORT[k] }));
}
</script>

<style lang="less" scoped>
.mount-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.mount-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: @spacing-lg;
}

.mount-header h3 { margin: 0; }

.mount-reset-btn {
  padding: @spacing-2xs @spacing-md;
  border: 1px solid rgba(255, 100, 100, 0.4);
  border-radius: @radius-sm;
  background: rgba(255, 100, 100, 0.1);
  color: #ff8888;
  font-size: @font-xs;
  cursor: pointer;
  transition: all @transition-quick;
}

.mount-reset-btn:hover:not(:disabled) {
  background: rgba(255, 100, 100, 0.25);
  border-color: rgba(255, 100, 100, 0.7);
}

.mount-reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mount-bonus-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: @spacing-xs;
  padding: @spacing-md @spacing-lg;
  background: @white-05;
  border-radius: @radius-md;
  margin-bottom: @spacing-xl;
}

.bonus-label { font-size: @font-sm; color: @text-secondary; }

.bonus-tag {
  font-size: @font-sm;
  color: @heal-hp;
  font-weight: @font-weight-bold;
  padding: @spacing-2xs @spacing-sm;
  background: @green-bg;
  border-radius: @radius-sm;
}

.bonus-empty { font-size: @font-sm; color: @color-dim-gray; font-style: italic; }

.mount-tier {
  padding: @spacing-md @spacing-lg;
  background: @white-05;
  border-radius: @radius-md;
  margin-bottom: @spacing-md;
  border-left: 3px solid transparent;
}

.mount-tier.tier-common { border-left-color: #9d9d9d; }
.mount-tier.tier-uncommon { border-left-color: #1eff00; }
.mount-tier.tier-rare { border-left-color: #0070dd; }
.mount-tier.tier-epic { border-left-color: #a335ee; }
.mount-tier.tier-legendary { border-left-color: #ff8000; }

.mount-tier.locked { opacity: 0.55; }

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: @spacing-md;
}

.tier-label { font-size: @font-base; color: @accent-color; font-weight: @font-weight-bold; }
.tier-info { font-size: @font-xs; color: @text-secondary; }

.tier-options { display: flex; flex-wrap: wrap; gap: @spacing-sm; }

.mount-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: @spacing-2xs;
  padding: @spacing-xs @spacing-md;
  background: @white-05;
  border: 1px solid @white-10;
  border-radius: @radius-sm;
  cursor: pointer;
  transition: all @transition-quick;
  color: @text-primary;
  font-size: @font-xs;
}

.mount-option:hover:not(:disabled) {
  background: @white-10;
  border-color: rgba(255, 215, 0, 0.4);
}

.mount-option:disabled { cursor: not-allowed; opacity: 0.5; }

.mount-option.selected {
  background: @gold-bg-strong;
  border-color: @accent-color;
  box-shadow: 0 0 0 1px @accent-color;
}

.mount-option.rarity-common { border-color: rgba(157, 157, 157, 0.4); }
.mount-option.rarity-uncommon { border-color: rgba(30, 255, 0, 0.4); }
.mount-option.rarity-rare { border-color: rgba(0, 112, 221, 0.5); }
.mount-option.rarity-epic { border-color: rgba(163, 51, 238, 0.5); }
.mount-option.rarity-legendary { border-color: rgba(255, 128, 0, 0.5); }

.option-title { display: flex; align-items: center; gap: @spacing-xs; }
.option-name { font-weight: 500; white-space: nowrap; }
.option-bonus { display: flex; flex-direction: column; }
.option-bonus-line { color: @text-secondary; font-variant-numeric: tabular-nums; line-height: 1.4; }
.mount-option.selected .option-bonus-line { color: @heal-hp; }
</style>
