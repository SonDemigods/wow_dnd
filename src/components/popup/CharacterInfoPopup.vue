<template>
  <BasePopup :visible="visible" title="角色信息" max-width="640px" @close="$emit('close')">
    <template #default>
      <div v-if="character" class="char-info-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['char-info-tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <BaseIcon :name="tab.icon" gradient="gold" :size="14" />
          {{ tab.label }}
          <MenuBadge v-if="tab.badge" :count="tab.badge" variant="danger" />
        </button>
      </div>
      <div class="char-info-body">
        <CharacterOverview v-show="activeTab === 'overview'" />
        <CharacterAttributes v-show="activeTab === 'attributes'" />
        <CharacterEquipment v-show="activeTab === 'equipment'" />
        <CharacterMounts v-show="activeTab === 'mounts'" />
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色信息弹窗（分段容器）
 * @description 将原 1552 行单体弹窗拆为 4 段：概览/属性/装备/坐骑。
 *              概览段删除了与 GameMain HUD 重复的资源条。
 *              装备段改为只读+卸下+跳背包，装备主入口收敛到 InventoryPopup。
 */
import { ref, computed, watch } from 'vue';
import { useCharacterStore } from '@/modules/character';
import BasePopup from '../common/BasePopup.vue';
import MenuBadge from '../common/MenuBadge.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import CharacterOverview from './panels/CharacterOverview.vue';
import CharacterAttributes from './panels/CharacterAttributes.vue';
import CharacterEquipment from './panels/CharacterEquipment.vue';
import CharacterMounts from './panels/CharacterMounts.vue';

const props = defineProps<{
  visible: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();
const character = computed(() => characterStore.character);
const unallocatedPoints = computed(() => character.value?.unallocatedPoints ?? 0);

type TabId = 'overview' | 'attributes' | 'equipment' | 'mounts';
const activeTab = ref<TabId>('overview');

const tabs = computed(() => [
  { id: 'overview' as const, label: '概览', icon: 'person', badge: 0 },
  { id: 'attributes' as const, label: '属性', icon: 'sword-clash', badge: unallocatedPoints.value },
  { id: 'equipment' as const, label: '装备', icon: 'shield', badge: 0 },
  { id: 'mounts' as const, label: '坐骑', icon: 'horse-head', badge: 0 },
]);

// 打开时有未分配点数 → 默认进入属性段
watch(() => props.visible, (val) => {
  if (val) {
    activeTab.value = unallocatedPoints.value > 0 ? 'attributes' : 'overview';
  }
});
</script>

<style lang="less" scoped>
.char-info-tabs {
  .segment-tabs();
}

.char-info-tab {
  .segment-tab();
}

.char-info-body {
  .segment-panel-body();
}
</style>
