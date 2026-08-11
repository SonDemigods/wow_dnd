<template>
  <div class="equipment-section">
    <div class="equipment-header">
      <h3>装备</h3>
      <button class="open-inventory-btn" @click="$emit('open-inventory')" title="打开背包管理装备">
        <BaseIcon name="backpack" gradient="gold" :size="14" /> 背包
      </button>
    </div>

    <div class="equipment-grid">
      <div
        v-for="slot in weaponSlots"
        :key="slot.key"
        :data-equip-slot="slot.key"
        :class="['equip-slot', { equipped: slot.equipment, selected: selectedSlot?.key === slot.key, locked: slot.locked }, slot.equipment ? 'rarity-' + (slot.equipment?.rarity || 'common') : '']"
        @click="selectEquipment(slot)"
      >
        <div v-if="slot.locked" class="slot-lock-overlay" title="被双手武器占用">
          <BaseIcon name="padlock" gradient="metal" :size="20" />
          <span class="lock-text">占用</span>
        </div>
        <template v-else-if="slot.equipment">
          <ItemIcon :icon="slot.equipment?.icon" :rarity="slot.equipment?.rarity" fallback="broadsword" size="lg" />
        </template>
        <template v-else>
          <ItemIcon icon="" fallback="broadsword" size="lg" />
        </template>
      </div>

      <div
        v-for="slot in armorSlots"
        :key="slot.key"
        :data-equip-slot="slot.key"
        :class="['equip-slot', { equipped: slot.equipment, selected: selectedSlot?.key === slot.key }, slot.equipment ? 'rarity-' + (slot.equipment?.rarity || 'common') : '']"
        @click="selectEquipment(slot)"
      >
        <template v-if="slot.equipment">
          <ItemIcon :icon="slot.equipment?.icon" :rarity="slot.equipment?.rarity" fallback="checked-shield" size="lg" />
        </template>
        <template v-else>
          <ItemIcon icon="" fallback="checked-shield" size="lg" />
        </template>
      </div>
    </div>

    <div v-if="selectedSlot" class="equipment-detail">
      <template v-if="selectedSlot.equipment">
        <div class="detail-header">
          <ItemIcon :icon="selectedSlot.equipment.icon" :rarity="selectedSlot.equipment.rarity" size="xl" />
          <div class="detail-info">
            <h4 :class="selectedSlot.equipment.rarity">{{ selectedSlot.equipment.name }}</h4>
            <span :class="['detail-rarity', selectedSlot.equipment.rarity]">{{ getRarityName(selectedSlot.equipment.rarity) }}</span>
          </div>
        </div>
        <p class="detail-desc">{{ selectedSlot.equipment.description }}</p>
        <div v-if="selectedSlot.equipment.bonus" class="detail-stats">
          <div v-for="(value, stat) in selectedSlot.equipment.bonus" :key="stat" class="stat-item">
            <span class="stat-name">{{ getStatName(stat as keyof Stats) }}</span>
            <span class="stat-value">+{{ value }}</span>
          </div>
        </div>
        <div v-if="selectedSlot.equipment.levelRequirement" class="detail-requirement">
          需要等级: {{ selectedSlot.equipment.levelRequirement }}
        </div>
        <div class="detail-actions">
          <button class="action-btn unequip" @click="unequipItem(selectedSlot.key)">卸下</button>
          <button class="action-btn open-bag" @click="$emit('open-inventory')">前往背包装备</button>
        </div>
      </template>
      <EmptyState v-else icon="empty-box" gradient="metal" text="槽位为空" />
    </div>
    <div v-else class="equipment-detail">
      <EmptyState icon="shield" text="点击装备槽位查看详情" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 装备面板（只读展示 + 卸下 + 跳转背包）
 * @description 展示装备槽位网格与选中装备详情。装备/换装主入口在 InventoryPopup；
 *              此处仅支持查看与卸下，提供"前往背包装备"按钮跳转。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useEquipmentStore } from '@/modules/equipment';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import { errorHandler } from '@/services/ErrorHandler';
import type { EquipmentSlot, EquipmentItem } from '@/modules/equipment';
import type { Stats } from '@/modules/character';
import { getRarityName, getStatName } from '@/modules/item/descriptors';
import ItemIcon from '../../common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import EmptyState from '../../common/EmptyState.vue';

defineEmits<{
  (e: 'open-inventory'): void;
}>();

const equipmentStore = useEquipmentStore();
const characterStore = useCharacterStore();
const toast = useToast();

const pendingAnimCleanup: Array<{ el: HTMLElement; handler: EventListenerOrEventListenerObject }> = [];

interface SlotInfo {
  key: EquipmentSlot;
  name: string;
  equipment: EquipmentItem | null;
  locked: boolean;
}

const weaponSlots = computed<SlotInfo[]>(() => [
  { key: 'weapon1', name: '主手武器', equipment: equipmentStore.equipment.weapon1?.item || null, locked: false },
  { key: 'weapon2', name: '副手武器', equipment: equipmentStore.equipment.weapon2?.item || null, locked: equipmentStore.isSlotLocked('weapon2') }
]);

const armorSlots = computed<SlotInfo[]>(() => [
  { key: 'helm', name: '头部', equipment: equipmentStore.equipment.helm?.item || null, locked: false },
  { key: 'chest', name: '胸部', equipment: equipmentStore.equipment.chest?.item || null, locked: false },
  { key: 'gloves', name: '手套', equipment: equipmentStore.equipment.gloves?.item || null, locked: false },
  { key: 'legs', name: '腿部', equipment: equipmentStore.equipment.legs?.item || null, locked: false },
  { key: 'boots', name: '鞋子', equipment: equipmentStore.equipment.boots?.item || null, locked: false }
]);

const selectedSlot = ref<SlotInfo | null>(null);

function selectEquipment(slot: SlotInfo) {
  if (slot.locked) {
    toast.show({ message: '该槽位被双手武器占用，无法操作', type: 'warning', icon: '🔒' });
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
      const slotElRaw = document.querySelector(`[data-equip-slot="${slotKey}"]`);
      if (slotElRaw instanceof HTMLElement) {
        slotElRaw.classList.add('equip-anim-empty');
        const handler = () => slotElRaw.classList.remove('equip-anim-empty');
        pendingAnimCleanup.push({ el: slotElRaw, handler });
        slotElRaw.addEventListener('animationend', handler, { once: true });
      }
      selectedSlot.value = null;
    }
  } catch (e) {
    toast.show({ message: e instanceof Error ? e.message : '卸下装备失败', type: 'danger', duration: 3000 });
  }
}

onMounted(async () => {
  try {
    if (characterStore.currentCharacterId) {
      await equipmentStore.initialize(characterStore.currentCharacterId);
    }
  } catch (e) {
    console.error('[CharacterEquipment] onMounted 失败:', e);
    errorHandler.report(e);
  }
});

onUnmounted(() => {
  pendingAnimCleanup.forEach(({ el, handler }) => el.removeEventListener('animationend', handler));
  pendingAnimCleanup.length = 0;
});
</script>

<style lang="less" scoped>
.equipment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: @spacing-lg;
}

.equipment-header h3 {
  font-size: @font-md;
  color: @accent-color;
  margin: 0;
  font-weight: @font-weight-bold;
}

.open-inventory-btn {
  display: flex;
  align-items: center;
  gap: @spacing-xs;
  padding: @spacing-2xs @spacing-md;
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: @radius-sm;
  background: @gold-bg;
  color: @accent-color;
  font-size: @font-xs;
  cursor: pointer;
  transition: all @transition-quick;
}

.open-inventory-btn:hover {
  background: @gold-bg-hover;
  border-color: @accent-color;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: @spacing-md;
  margin-bottom: @spacing-xl;
}

.equip-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: @spacing-xs;
  padding: @spacing-md;
  background: @white-05;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  min-height: 80px;
  aspect-ratio: 1;
}

.equip-slot.equip-anim-empty { animation: equip-slot-empty 0.6s ease; }
.equip-slot:hover { background: @white-10; }
.equip-slot.selected { background: @gold-bg-strong; }
.equip-slot.equipped { background: rgba(255, 255, 255, 0.08); }
.equip-slot.equipped.selected { background: @gold-bg-strong; }

.equip-slot.locked {
  background: @overlay-deep;
  border: 1px dashed @color-dim-gray;
  cursor: not-allowed;
  opacity: 0.6;
  position: relative;
}

.equip-slot.locked:hover { background: @overlay-deep; transform: none; }

.slot-lock-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: @spacing-2xs;
  color: @color-dim-gray;
}

.slot-lock-overlay .lock-text { font-size: @font-2xs; color: @text-secondary; font-weight: @font-weight-bold; }

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

.detail-info { flex: 1; }
.detail-info h4 { font-size: @font-lg; font-weight: @font-weight-bold; margin: 0 0 @spacing-xs 0; }
.detail-info h4.common { color: @popup-text-color; }
.detail-info h4.uncommon { color: #1eff00; }
.detail-info h4.rare { color: #0070dd; }
.detail-info h4.epic { color: #a335ee; }
.detail-info h4.legendary { color: #ff8000; }

.detail-rarity { font-size: @font-sm; }
.detail-rarity.common { color: #9d9d9d; }
.detail-rarity.uncommon { color: #1eff00; }
.detail-rarity.rare { color: #0070dd; }
.detail-rarity.epic { color: #a335ee; }
.detail-rarity.legendary { color: #ff8000; }

.detail-desc { color: #aaa; font-size: @font-base; margin: @spacing-md 0; }

.detail-stats { display: flex; flex-direction: column; gap: @spacing-xs; margin-bottom: @spacing-lg; }

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: @spacing-xs @spacing-md;
  background: @green-bg;
  border-radius: @radius-sm;
}

.stat-name { color: @text-secondary; font-size: @font-base; }
.stat-value { color: @heal-hp; font-size: @font-base; font-weight: @font-weight-bold; }

.detail-requirement {
  color: @accent-color;
  font-size: @font-sm;
  margin-bottom: @spacing-lg;
  padding: @spacing-xs @spacing-md;
  background: @gold-bg;
  border-radius: @radius-sm;
  display: inline-block;
}

.detail-actions { display: flex; gap: @spacing-md; margin-top: @spacing-lg; }

.action-btn {
  padding: @spacing-md @spacing-3xl;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
}

.action-btn:hover { transform: translateY(-1px); }

.unequip { background: linear-gradient(135deg, #ff9800, #f57c00); color: @popup-text-color; }
.open-bag { background: @white-10; color: @text-primary; border: 1px solid @popup-border-color; }
</style>