<template>
  <div class="character-overview" v-if="character">
    <div class="character-basic">
      <div class="char-row">
        <div class="char-avatar">
          <BaseIcon :name="getRaceIcon(character.raceId)" :size="28" />
        </div>
        <div class="char-main-info">
          <div class="char-name">{{ character.name }}</div>
          <div class="char-level">Lv.{{ character.level }}</div>
        </div>
      </div>
      <div class="char-details">
        <Tag type="faction" :text="getFactionName(character.factionId)" :color="getFactionColor(character.factionId)" />
        <Tag type="race" :text="getRaceName(character.raceId)" />
        <Tag type="class" :text="getClassName(character.classId)" :color="getClassColor(character.classId)" />
      </div>
    </div>

    <!-- 次级属性 -->
    <div class="secondary-section">
      <h3>次级属性</h3>
      <div class="secondary-grid">
        <div class="secondary-item attack">
          <BaseIcon name="sword-clash" gradient="physical" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">物理强度</div>
            <div class="secondary-value">{{ attributes.physicalAttack }}</div>
          </div>
        </div>
        <div class="secondary-item defense">
          <BaseIcon name="shield" gradient="earth" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">物理韧性</div>
            <div class="secondary-value">{{ attributes.physicalDefense }}</div>
          </div>
        </div>
        <div class="secondary-item magic-attack">
          <BaseIcon name="magic-swirl" gradient="magic" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">魔法强度</div>
            <div class="secondary-value">{{ attributes.magicAttack }}</div>
          </div>
        </div>
        <div class="secondary-item magic-defense">
          <BaseIcon name="magic-shield" gradient="magic" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">魔法韧性</div>
            <div class="secondary-value">{{ attributes.magicDefense }}</div>
          </div>
        </div>
        <div class="secondary-item crit">
          <BaseIcon name="explosion-rays" gradient="crit" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">暴击率</div>
            <div class="secondary-value">{{ attributes.critChance }}%</div>
          </div>
        </div>
        <div class="secondary-item dodge">
          <BaseIcon name="dodge" gradient="dodge" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">闪避率</div>
            <div class="secondary-value">{{ attributes.dodgeChance }}%</div>
          </div>
        </div>
        <div class="secondary-item heal">
          <BaseIcon name="healing" gradient="heal" :size="14" />
          <div class="secondary-info">
            <div class="secondary-label">治疗强度</div>
            <div class="secondary-value">{{ attributes.healBonus }}</div>
          </div>
        </div>
      </div>
      <div class="resource-stats">
        <div class="resource-item">
          <BaseIcon name="health-normal" gradient="blood" :size="16" />
          <span class="resource-label">最大生命</span>
          <span class="resource-value">{{ attributes.maxHp }}</span>
        </div>
        <div v-if="showManaBar" class="resource-item">
          <BaseIcon name="magic-palm" gradient="mana" :size="16" />
          <span class="resource-label">最大法力</span>
          <span class="resource-value">{{ attributes.maxMana }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色概览面板（无 BasePopup 外壳）
 * @description 展示角色基本信息（头像/名/等级/阵营种族职业 Tag）与次级属性网格。
 *              资源条（HP/MP/经验）已删除——与 GameMain 顶部 HUD 重复。
 */
import { computed, onMounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { ResourceSystemFactory } from '@/modules/combat/resources';
import { errorHandler } from '@/services/ErrorHandler';
import { useToast } from '@/composables/useToast';
import type { Attributes } from '@/modules/character';
import Tag from '../../common/Tag.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

const characterStore = useCharacterStore();
const baseStore = useBaseStore();
const toast = useToast();

const character = computed(() => characterStore.character);
const attributes = computed<Attributes>(() => characterStore.attributes);
const showManaBar = computed(() => !ResourceSystemFactory.replacesMana(character.value?.classId || ''));

const factions = computed(() => baseStore.factions);
const races = computed(() => baseStore.races);
const classes = computed(() => baseStore.classes);

function getRaceIcon(raceId: string) {
  return races.value.find(r => r.id === raceId)?.icon || 'person';
}
function getRaceName(raceId: string) {
  return races.value.find(r => r.id === raceId)?.name || '';
}
function getFactionName(factionId: string) {
  return factions.value.find(f => f.id === factionId)?.name || '';
}
function getFactionColor(factionId: string) {
  return factions.value.find(f => f.id === factionId)?.color || '#9d9d9d';
}
function getClassName(classId: string) {
  return classes.value.find(c => c.id === classId)?.name || '';
}
function getClassColor(classId: string) {
  return classes.value.find(c => c.id === classId)?.color || '#9d9d9d';
}

async function loadData() {
  try {
    await baseStore.loadAllData();
  } catch (e) {
    console.error('[CharacterOverview] loadData 失败:', e);
    errorHandler.report(e);
    toast.show({ message: '加载角色数据失败，请重试', type: 'danger' });
  }
}

onMounted(async () => {
  await loadData();
});
</script>

<style lang="less" scoped>
.character-overview {
  display: flex;
  flex-direction: column;
  gap: @spacing-xl;
}

.character-basic {
  display: flex;
  flex-direction: column;
  gap: @spacing-lg;
  padding: @spacing-xl;
  background: @white-05;
  border-radius: @radius-lg;
}

.char-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.char-avatar {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: @gold-bg-hover;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.char-main-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.char-name {
  font-size: 22px;
  color: @text-primary;
  font-weight: @font-weight-bold;
  line-height: 1.2;
}

.char-level {
  font-size: @font-md;
  color: @accent-color;
  font-weight: @font-weight-bold;
  background: @gold-bg;
  padding: @spacing-2xs @spacing-md;
  border-radius: @radius-sm;
  display: inline-block;
  width: fit-content;
}

.char-details {
  display: flex;
  gap: @spacing-xs;
  flex-wrap: wrap;
}

.secondary-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-md;
  margin-bottom: @spacing-xl;
}

.secondary-item {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-lg @spacing-xl;
  background: @white-05;
  border-radius: @radius-md;
  border-left: 3px solid transparent;
}

.secondary-item.attack { border-left-color: @damage-physical; }
.secondary-item.defense { border-left-color: #4ecdc4; }
.secondary-item.magic-attack { border-left-color: #a29bfe; }
.secondary-item.magic-defense { border-left-color: #fd79a8; }
.secondary-item.crit { border-left-color: #fdcb6e; }
.secondary-item.dodge { border-left-color: #74b9ff; }
.secondary-item.heal { border-left-color: #2ecc71; }

.secondary-info { flex: 1; }
.secondary-label { font-size: @font-sm; color: @text-secondary; margin-bottom: 2px; }
.secondary-value { font-size: @font-md; color: @text-primary; font-weight: @font-weight-bold; }

.resource-stats {
  display: flex;
  gap: @spacing-md;
}

.resource-stats .resource-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: @spacing-sm @spacing-lg;
  background: @white-05;
  border-radius: @radius-md;
}

.resource-stats .resource-label { font-size: @font-xs; color: @text-secondary; flex: 1; }
.resource-stats .resource-value { font-size: @font-sm; color: @text-primary; font-weight: @font-weight-bold; }
</style>
