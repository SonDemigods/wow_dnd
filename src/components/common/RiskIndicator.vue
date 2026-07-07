<!--
  风险等级可视化组件
  根据格子类型和区域等级显示对应的风险等级标识（颜色+文案）。
  用于探索网格中辅助玩家评估当前格子的危险程度。
-->
<template>
  <span v-if="riskLevel" :class="['risk-indicator', `risk-${riskLevel}`]" :title="riskText">
    <BaseIcon :name="riskIcon" :size="10" />
    <span class="risk-label">{{ riskText }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { CellType } from '@/modules/exploration/types';

const props = defineProps<{
  cellType: CellType;
  areaLevel: number;
}>();

type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'extreme';

const riskLevel = computed<RiskLevel | null>(() => {
  switch (props.cellType) {
    case 'empty':
    case 'start':
    case 'rest':
    case 'shop':
    case 'board':
      return 'safe';
    case 'treasure':
    case 'event':
      return 'low';
    case 'trap':
      return props.areaLevel >= 10 ? 'high' : 'medium';
    case 'monster':
      return props.areaLevel >= 15 ? 'extreme' : props.areaLevel >= 8 ? 'high' : 'medium';
    case 'boss':
      return 'extreme';
    default:
      return null;
  }
});

const riskText = computed(() => {
  switch (riskLevel.value) {
    case 'safe': return '安全';
    case 'low': return '低风险';
    case 'medium': return '中风险';
    case 'high': return '高风险';
    case 'extreme': return '极危';
    default: return '';
  }
});

const riskIcon = computed(() => {
  switch (riskLevel.value) {
    case 'safe': return 'game-icons:shield';
    case 'low': return 'game-icons:checked-shield';
    case 'medium': return 'game-icons:exclamation-orb';
    case 'high': return 'game-icons:skull-crack';
    case 'extreme': return 'game-icons:death-skull';
    default: return 'game-icons:question-mark';
  }
});
</script>

<style scoped>
.risk-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.risk-label {
  font-size: 9px;
}

.risk-safe { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
.risk-low { background: rgba(33, 150, 243, 0.2); color: #2196f3; }
.risk-medium { background: rgba(255, 152, 0, 0.2); color: #ff9800; }
.risk-high { background: rgba(244, 67, 54, 0.2); color: #f44336; }
.risk-extreme { background: rgba(156, 39, 176, 0.3); color: #ce93d8; }
</style>
