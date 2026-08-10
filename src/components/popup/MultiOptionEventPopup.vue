<template>
  <BasePopup :visible="visible" title="事件" :show-footer-close="false" max-width="480px" @close="$emit('close')">
    <template #default>
      <div v-if="event" class="event-content">
        <div class="event-icon"><BaseIcon :name="event.icon" :size="32" /></div>
        <p class="event-message">{{ event.message }}</p>
        <div class="event-choices">
          <button
            v-for="(choice, idx) in event.choices"
            :key="idx"
            class="event-choice-btn"
            @click="$emit('select', choice)"
          >
            <BaseIcon v-if="choice.icon" :name="choice.icon" :size="16" />
            <span>{{ choice.label }}</span>
          </button>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 多选项事件弹窗
 * @description 探索中触发多选项事件时弹出，供玩家选择选项后应用对应效果
 */
import BasePopup from '@/components/common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { MultiOptionEventResult, EventChoice } from '@/modules/exploration';

defineProps<{
  visible: boolean;
  event: MultiOptionEventResult | null;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'select', choice: EventChoice): void;
}>();
</script>

<style lang="less" scoped>
.event-content {
  .flex-col();
  align-items: center;
  gap: @spacing-xl;
  padding: @spacing-lg 0;
}

.event-icon {
  .flex-center();
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: @gold-bg;
  border: 2px solid rgba(255, 215, 0, 0.3);
}

.event-message {
  font-size: @font-md;
  color: @text-primary;
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.event-choices {
  .flex-col();
  gap: @spacing-md;
  width: 100%;
}

.event-choice-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: @spacing-sm;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border: @border-card;
  border-radius: @radius-md;
  color: @popup-text-color;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-quick;

  &:hover {
    border-color: @accent-color;
    background: @gold-bg;
    color: @accent-color;
  }

  &:active {
    transform: scale(0.98);
  }
}
</style>
