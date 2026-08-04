<template>
  <div class="pet-summon-overlay" @click.self="handleClose">
    <div class="pet-summon-modal">
      <div class="pet-summon-header">
        <span class="pet-summon-title">召唤宠物</span>
        <button class="pet-summon-close" @click="handleClose">
          <BaseIcon name="cancel" :size="16" />
        </button>
      </div>
      <div class="pet-summon-body">
        <div class="pet-resource-info">
          <span class="resource-label">{{ resourceName }}</span>
          <span class="resource-value">{{ currentResource }} / {{ maxResource }}</span>
        </div>
        <div
          v-for="pet in unlockedPets"
          :key="pet.id"
          :class="['pet-option', {
            'disabled': !canSummon(pet),
            'active': isActivePet(pet.id),
          }]"
          @click="selectPet(pet)"
        >
          <div class="pet-option-icon"><BaseIcon :name="pet.icon" :size="28" /></div>
          <div class="pet-option-info">
            <div class="pet-option-name">{{ pet.name }}</div>
            <div class="pet-option-desc">{{ pet.description }}</div>
            <div class="pet-option-stats">
              <span class="stat-item">HP {{ pet.attributes.baseHp }}</span>
              <span class="stat-item">攻击 {{ pet.attributes.baseDamage }}</span>
              <span class="stat-item">防御 {{ pet.attributes.baseDefense }}</span>
              <span class="stat-item">速度 {{ pet.attributes.baseSpeed }}</span>
            </div>
            <div class="pet-option-skills">
              <span v-for="skill in pet.skills" :key="skill.id" class="skill-tag">{{ skill.name }}</span>
            </div>
          </div>
          <div class="pet-option-cost">
            <span :class="['cost-badge', { 'insufficient': !hasEnoughResource(pet) }]">
              {{ getCostText(pet) }}
            </span>
          </div>
        </div>
        <div v-if="unlockedPets.length === 0" class="pet-empty">暂无已解锁的宠物</div>
      </div>
      <div v-if="hasActivePet" class="pet-summon-footer">
        <button class="dismiss-btn" @click="handleDismiss">
          <BaseIcon name="cancel" :size="14" /> 解散当前宠物
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 宠物召唤选择弹窗（P3-156）
 * @description 展示已解锁宠物列表，允许玩家选择召唤。
 *              标灰不可召唤的宠物（资源不足/已有激活宠物）。
 *              术士/猎人共用，根据资源类型切换显示。
 */
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { Pet, PetType } from '@/modules/combat/pets';

const props = defineProps<{
  /** 已解锁的宠物列表（术士或猎人通用） */
  unlockedPets: Pet[];
  /** 当前资源数量 */
  currentResource: number;
  /** 资源上限 */
  maxResource: number;
  /** 资源名称（如"灵魂碎片"/"集中值"） */
  resourceName: string;
  /** 当前是否有激活的宠物 */
  hasActivePet: boolean;
  /** 当前激活宠物的类型 ID（用于标记 active 状态） */
  activePetId?: PetType | null;
}>();

const emit = defineEmits<{
  (e: 'summon', petType: PetType): void;
  (e: 'dismiss'): void;
  (e: 'close'): void;
}>();

/** 获取宠物的资源消耗量（通用，支持术士和猎人） */
function getPetCost(pet: Pet): number {
  return pet.resourceType === 'soul_shard' ? pet.soulShardCost : pet.focusCost;
}

/** 获取宠物召唤消耗文本 */
function getCostText(pet: Pet): string {
  return `${getPetCost(pet)} ${props.resourceName}`;
}

/** 检查资源是否足够 */
function hasEnoughResource(pet: Pet): boolean {
  return props.currentResource >= getPetCost(pet);
}

/** 检查宠物是否可召唤（资源足够且当前无激活宠物） */
function canSummon(pet: Pet): boolean {
  return hasEnoughResource(pet) && !props.hasActivePet;
}

/** 检查是否为当前激活的宠物 */
function isActivePet(petId: PetType): boolean {
  return props.activePetId === petId;
}

/** 选择宠物召唤 */
function selectPet(pet: Pet): void {
  if (!canSummon(pet)) return;
  emit('summon', pet.id);
}

/** 解散当前宠物 */
function handleDismiss(): void {
  emit('dismiss');
}

/** 关闭弹窗 */
function handleClose(): void {
  emit('close');
}
</script>

<style lang="less" scoped>
.pet-summon-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  z-index: @z-modal-overlay;
  .flex-center();
  animation: fadeIn 0.2s ease;
}

.pet-summon-modal {
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  background: linear-gradient(135deg, rgba(30, 30, 45, 0.98), rgba(20, 20, 30, 0.98));
  border-radius: @radius-md;
  border: 1px solid rgba(74, 222, 128, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(74, 222, 128, 0.1);
  .flex-col();
  overflow: hidden;
}

.pet-summon-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.pet-summon-title {
  font-size: @font-base;
  font-weight: @font-weight-bold;
  color: #4ade80;
}

.pet-summon-close {
  background: none;
  border: none;
  color: @color-mid-gray;
  cursor: pointer;
  padding: 4px;
  .flex-center();
  transition: color 0.2s ease;

  &:hover {
    color: #fff;
  }
}

.pet-summon-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.pet-resource-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  margin-bottom: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: @radius-sm;
  border: 1px solid rgba(255, 255, 255, 0.06);

  .resource-label {
    font-size: @font-sm;
    color: @color-mid-gray;
  }

  .resource-value {
    font-size: @font-sm;
    color: #4ade80;
    font-weight: @font-weight-bold;
  }
}

.pet-option {
  display: flex;
  align-items: flex-start;
  gap: @spacing-md;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: @radius-sm;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.disabled) {
    background: rgba(74, 222, 128, 0.08);
    border-color: rgba(74, 222, 128, 0.3);
  }

  &.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.active {
    border-color: rgba(74, 222, 128, 0.5);
    background: rgba(74, 222, 128, 0.06);
  }
}

.pet-option-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  .flex-center();
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border-radius: @radius-sm;
}

.pet-option-info {
  flex: 1;
  min-width: 0;
}

.pet-option-name {
  font-size: @font-sm;
  font-weight: @font-weight-bold;
  color: #e0e0e0;
  margin-bottom: 2px;
}

.pet-option-desc {
  font-size: @font-xs;
  color: @color-mid-gray;
  margin-bottom: 4px;
  line-height: 1.4;
}

.pet-option-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;

  .stat-item {
    font-size: 10px;
    color: @color-dim-gray;
    background: rgba(0, 0, 0, 0.3);
    padding: 1px 6px;
    border-radius: @radius-xs;
  }
}

.pet-option-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  .skill-tag {
    font-size: 10px;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
    padding: 1px 6px;
    border-radius: @radius-xs;
    border: 1px solid rgba(167, 139, 250, 0.15);
  }
}

.pet-option-cost {
  flex-shrink: 0;
  .flex-center();
}

.cost-badge {
  font-size: @font-xs;
  font-weight: @font-weight-bold;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 4px 10px;
  border-radius: @radius-sm;
  border: 1px solid rgba(74, 222, 128, 0.2);

  &.insufficient {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
    border-color: rgba(248, 113, 113, 0.2);
  }
}

.pet-empty {
  text-align: center;
  color: @color-mid-gray;
  padding: @spacing-3xl 0;
  font-style: italic;
}

.pet-summon-footer {
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  .flex-center();
}

.dismiss-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: @radius-sm;
  color: #f87171;
  font-size: @font-sm;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(248, 113, 113, 0.2);
  }
}
</style>
