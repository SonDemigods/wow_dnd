<template>
  <div class="class-resource-bar-wrapper">
    <BaseIcon :name="resourceConfig.icon" :gradient="resourceConfig.gradient" :size="16" />
    <div class="resource-track">
      <!-- 填充层 -->
      <div class="resource-fill" :class="resourceSystem.type" :style="{ width: percent + '%' }">
        <div class="wave-layer wave-slow" :class="resourceSystem.type"></div>
        <div class="wave-layer wave-fast" :class="resourceSystem.type"></div>
      </div>
      <!-- 文字层 -->
      <div class="resource-text">
        <span class="resource-label">{{ resourceConfig.name }}</span>
        <span class="resource-value">{{ Math.floor(resourceSystem.currentValue) }}/{{ resourceSystem.maxValue }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 职业专属资源条组件
 * @description 在战斗界面显示职业专属资源（怒气/能量/连击点/灵魂碎片/真气等）。
 *              与通用 ResourceBar 的区别：支持整数型资源显示，内置各资源类型的颜色配置。
 */
import { computed } from 'vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { RESOURCE_ICONS } from '@/config/icons';
import type { ResourceSystem, ResourceType } from '@/modules/combat/resources';

const props = defineProps<{
  resourceSystem: ResourceSystem;
}>();

/** 资源类型对应的显示配置 */
const RESOURCE_DISPLAY_CONFIG: Record<ResourceType, { name: string; icon: string; gradient: string }> = {
  rage: { name: '怒气', icon: RESOURCE_ICONS.rage, gradient: 'physical' },
  energy: { name: '能量', icon: RESOURCE_ICONS.energy, gradient: 'gold' },
  combo_point: { name: '连击', icon: RESOURCE_ICONS.combo_point, gradient: 'gold' },
  soul_shard: { name: '碎片', icon: RESOURCE_ICONS.soul_shard, gradient: 'debuff' },
  chi: { name: '真气', icon: RESOURCE_ICONS.chi, gradient: 'heal' },
  focus: { name: '集中', icon: RESOURCE_ICONS.focus, gradient: 'physical' },
  holy_power: { name: '神圣', icon: RESOURCE_ICONS.holy_power, gradient: 'holy' },
  runic_power: { name: '符能', icon: RESOURCE_ICONS.runic_power, gradient: 'blood' },
  rune: { name: '符文', icon: RESOURCE_ICONS.rune, gradient: 'blood' },
  fury: { name: '怒火', icon: RESOURCE_ICONS.fury, gradient: 'debuff' },
  soul: { name: '灵魂', icon: RESOURCE_ICONS.soul, gradient: 'debuff' },
  essence: { name: '精华', icon: RESOURCE_ICONS.essence, gradient: 'mana' },
  mana: { name: '法力', icon: RESOURCE_ICONS.mana, gradient: 'mana' },
};

const resourceConfig = computed(() => {
  return RESOURCE_DISPLAY_CONFIG[props.resourceSystem.type] || RESOURCE_DISPLAY_CONFIG.mana;
});

const percent = computed(() => {
  const max = props.resourceSystem.maxValue;
  if (max === 0) return 0;
  return Math.max(0, Math.min(100, (props.resourceSystem.currentValue / max) * 100));
});
</script>

<style lang="less" scoped>
.class-resource-bar-wrapper {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  width: 100%;
}

/* ===== 共享结构（Mixin 生成，参数差异化） ===== */
.resource-bar-base(
  @track-height: 18px;
  @fill-transition: 0.4s;
  @wave-height: 8px;
  @wave-fast-height: 5px;
  @wave-fast-opacity: 0.2;
  @wave-anim: wave-drift-alt;
);

/* ===== 填充条颜色变体 ===== */
.resource-fill.rage {
  background: linear-gradient(90deg, #ff4500, #cc3700);
  box-shadow: 0 0 8px rgba(255, 69, 0, 0.3);
}

.resource-fill.energy {
  background: linear-gradient(90deg, #ffd700, #ffaa00);
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.resource-fill.combo_point {
  background: linear-gradient(90deg, #ff8c00, #ff6500);
  box-shadow: 0 0 8px rgba(255, 140, 0, 0.3);
}

.resource-fill.soul_shard {
  background: linear-gradient(90deg, #9370db, #7b1fa2);
  box-shadow: 0 0 8px rgba(147, 112, 219, 0.3);
}

.resource-fill.chi {
  background: linear-gradient(90deg, #00ff96, #00b870);
  box-shadow: 0 0 8px rgba(0, 255, 150, 0.3);
}

.resource-fill.focus {
  background: linear-gradient(90deg, #66bb6a, #43a047);
  box-shadow: 0 0 8px rgba(102, 187, 106, 0.3);
}

.resource-fill.holy_power {
  background: linear-gradient(90deg, #ffd700, #ffec80);
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.resource-fill.runic_power {
  background: linear-gradient(90deg, #4a90d9, #7bb3f0);
  box-shadow: 0 0 8px rgba(74, 144, 217, 0.3);
}

.resource-fill.rune {
  background: linear-gradient(90deg, #2a4d8f, #4a6fb5);
  box-shadow: 0 0 8px rgba(42, 77, 143, 0.3);
}

.resource-fill.fury {
  background: linear-gradient(90deg, #33cc33, #66ff66);
  box-shadow: 0 0 8px rgba(51, 204, 51, 0.3);
}

.resource-fill.soul {
  background: linear-gradient(90deg, #9933cc, #cc66ff);
  box-shadow: 0 0 8px rgba(153, 51, 204, 0.3);
}

.resource-fill.essence {
  background: linear-gradient(90deg, #00ccff, #66e6ff);
  box-shadow: 0 0 8px rgba(0, 204, 255, 0.3);
}

.resource-fill.mana {
  background: linear-gradient(90deg, #448aff, #2962ff);
  box-shadow: 0 0 8px rgba(68, 138, 255, 0.25);
}

/* ===== 波浪颜色变体 ===== */
.wave-slow.rage { background: rgba(255, 200, 200, 0.5); }
.wave-slow.energy { background: rgba(255, 240, 200, 0.5); }
.wave-slow.combo_point { background: rgba(255, 220, 180, 0.5); }
.wave-slow.soul_shard { background: rgba(220, 200, 255, 0.5); }
.wave-slow.chi { background: rgba(200, 255, 230, 0.5); }
.wave-slow.focus { background: rgba(200, 255, 200, 0.5); }
.wave-slow.holy_power { background: rgba(255, 240, 180, 0.5); }
.wave-slow.runic_power { background: rgba(200, 220, 255, 0.5); }
.wave-slow.rune { background: rgba(190, 210, 255, 0.5); }
.wave-slow.fury { background: rgba(200, 255, 200, 0.5); }
.wave-slow.soul { background: rgba(220, 200, 255, 0.5); }
.wave-slow.essence { background: rgba(200, 240, 255, 0.5); }
.wave-slow.mana { background: rgba(200, 220, 255, 0.5); }
</style>
