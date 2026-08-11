<template>
  <div :class="['pet-hp-bar', { 'pet-dead': isDead }]">
    <div class="pet-avatar">
      <BaseIcon :name="petIcon" :size="18" />
    </div>
    <div class="pet-info">
      <div class="pet-header">
        <span class="pet-name">{{ petName }}</span>
        <span v-if="durationText" class="pet-duration">{{ durationText }}</span>
      </div>
      <div class="pet-hp-track" :class="{ 'hp-flash': flashRed }">
        <div class="pet-hp-fill" :style="{ width: hpPercent + '%' }"></div>
        <div class="pet-hp-text">{{ petHp }}/{{ petMaxHp }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 宠物 HP 条组件（P3-156）
 * @description 战斗 UI 中展示召唤物的紧凑型血条，包含头像、名称、HP 进度条和持续时间。
 *              受伤时闪红动画，死亡时灰化并显示"宠物阵亡"字样。
 */
import { computed, ref, watch, onUnmounted } from 'vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { PetInstance } from '@/modules/combat/pets';

const props = defineProps<{
  pet: PetInstance;
}>();

const petName = computed(() => props.pet.name);
const petIcon = computed(() => {
  // PetInstance 没有 icon 字段，通过 petId 映射到图标
  // 包含术士恶魔和猎人野兽宠物
  const iconMap: Record<string, string> = {
    // 术士宠物
    imp: 'game-icons:imp',
    voidwalker: 'game-icons:void',
    succubus: 'game-icons:succubus',
    felhunter: 'game-icons:dog-house',
    doomguard: 'game-icons:demon',
    // 猎人宠物
    wolf: 'game-icons:wolf-head',
    bear: 'game-icons:bear-head',
    cat: 'game-icons:cat',
    boar: 'game-icons:boar-tusk',
    devilsaur: 'game-icons:t-rex-skull',
  };
  return iconMap[props.pet.petId] || 'game-icons:monster-skull';
});

const petHp = computed(() => Math.max(0, props.pet.hp));
const petMaxHp = computed(() => props.pet.maxHp);
const hpPercent = computed(() => {
  if (petMaxHp.value <= 0) return 0;
  return Math.max(0, Math.min(100, (petHp.value / petMaxHp.value) * 100));
});

const isDead = computed(() => petHp.value <= 0);

const durationText = computed(() => {
  if (props.pet.durationRemaining > 0) {
    return `${props.pet.durationRemaining}回合`;
  }
  return '';
});

// 受伤闪红动画：HP 下降时触发
const flashRed = ref(false);
let prevHp = props.pet.hp;
// P8-510 修复：存储 timer 以便卸载时清理
let flashTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => props.pet.hp, (newHp) => {
  if (newHp < prevHp) {
    flashRed.value = true;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashRed.value = false; }, 400);
  }
  prevHp = newHp;
});
onUnmounted(() => {
  if (flashTimer) clearTimeout(flashTimer);
});
</script>

<style lang="less" scoped>
.pet-hp-bar {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  width: 100%;
  padding: 2px 0;
  transition: opacity 0.3s ease;

  &.pet-dead {
    opacity: 0.4;
    filter: grayscale(1);
  }
}

.pet-avatar {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  .flex-center();
  color: #4ade80;
}

.pet-info {
  flex: 1;
  min-width: 0;
}

.pet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1px;
}

.pet-name {
  font-size: @font-2xs;
  color: #4ade80;
  font-weight: @font-weight-semibold;
  text-shadow: @text-shadow-label;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pet-duration {
  font-size: 10px;
  color: @color-dim-gray;
  flex-shrink: 0;
  margin-left: @spacing-xs;
}

.pet-hp-track {
  position: relative;
  height: 14px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: @radius-xs;
  overflow: hidden;
  border: 1px solid rgba(74, 222, 128, 0.2);
  transition: box-shadow 0.3s ease;

  &.hp-flash {
    animation: hp-flash-anim 0.4s ease;
  }
}

.pet-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.3);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: @radius-xs;
}

.pet-hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #e0e0e0;
  font-weight: @font-weight-semibold;
  text-shadow: @text-shadow-label;
}

@keyframes hp-flash-anim {
  0%, 100% { box-shadow: 0 0 6px rgba(74, 222, 128, 0.3); }
  50% { box-shadow: 0 0 12px rgba(255, 82, 82, 0.6); border-color: rgba(255, 82, 82, 0.6); }
}
</style>
