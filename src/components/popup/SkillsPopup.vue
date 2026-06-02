<template>
  <BasePopup :visible="visible" title="技能面板" @close="$emit('close')">
    <template #default>
      <div class="skill-bar-section">
        <h3>当前激活技能 (战斗中使用)</h3>
        <div class="skill-bar" :key="barRenderKey">
          <div 
            v-for="(slot, index) in skillBarSlots" 
            :key="index"
            :class="['skill-slot', { empty: !slot.skill, selected: selectedSlotIndex === index }]"
            @click="selectBarSlot(index)"
          >
            <span v-if="slot.skill" class="slot-icon">{{ slot.skill.icon }}</span>
            <span v-if="slot.skill" class="slot-name">{{ slot.skill.name }}</span>
            <span v-if="slot.skill" class="slot-cost">{{ slot.skill.mpCost }} MP</span>
            <span v-if="!slot.skill" class="slot-empty">+</span>
            <span v-if="!slot.skill" class="slot-label">空栏位</span>
          </div>
        </div>
      </div>

      <div v-if="selectedSkill" class="selected-skill-section">
        <div class="selected-header">
          <span class="selected-icon">{{ selectedSkill.icon }}</span>
          <div class="selected-info">
            <h4>{{ selectedSkill.name }}</h4>
            <span class="selected-type" :class="selectedSkill.type">{{ getSkillTypeName(selectedSkill.type) }}</span>
          </div>
          <span class="selected-level">Lv.{{ selectedSkill.unlockLevel }}</span>
        </div>
        <p class="selected-desc">{{ selectedSkill.description }}</p>
        <div class="selected-meta">
          <div class="meta-item">
            <span class="meta-label">消耗</span>
            <span class="meta-value mp">{{ selectedSkill.mpCost }} MP</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">效果</span>
            <span class="meta-value effect">{{ getEffectText(selectedSkill) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">解锁等级</span>
            <span class="meta-value">{{ selectedSkill.unlockLevel }}</span>
          </div>
        </div>
        <div class="selected-actions">
          <button 
            v-if="isSkillEquipped(selectedSkill.id)"
            class="action-btn deactivate"
            @click="deactivateSkill(selectedSkill.id)"
          >
            卸下
          </button>
          <button 
            v-else-if="canUnlock(selectedSkill)"
            class="action-btn activate"
            @click="activateSkill(selectedSkill.id)"
          >
            激活到此栏位
          </button>
          <span v-else class="action-locked">
            🔒 需要等级 {{ selectedSkill.unlockLevel }}
          </span>
        </div>
      </div>

      <div class="skills-list-section">
        <h3>可用技能列表</h3>
        <div class="skills-list">
          <div 
            v-for="skill in classSkills" 
            :key="skill.id"
            :class="['skill-card', { equipped: isSkillEquipped(skill.id), locked: !canUnlock(skill) }]"
            @click="selectSkill(skill)"
          >
            <div class="skill-icon-wrapper">
              <span class="skill-icon">{{ skill.icon }}</span>
              <span v-if="!canUnlock(skill)" class="lock-badge">🔒</span>
            </div>
            <div class="skill-info">
              <div class="skill-header-row">
                <h4>{{ skill.name }}</h4>
                <span class="skill-status" :class="{ active: isSkillEquipped(skill.id) }">
                  {{ isSkillEquipped(skill.id) ? '已激活' : canUnlock(skill) ? '未激活' : '未解锁' }}
                </span>
              </div>
              <div class="skill-meta-row">
                <span class="skill-type-tag" :class="skill.type">{{ getSkillTypeName(skill.type) }}</span>
                <span class="skill-cost-tag">{{ skill.mpCost }} MP</span>
                <span class="skill-effect-text">{{ getEffectText(skill) }}</span>
              </div>
            </div>
            <div class="skill-action">
              <button 
                v-if="isSkillEquipped(skill.id)"
                class="mini-btn deactivate"
                @click.stop="deactivateSkill(skill.id)"
              >
                卸下
              </button>
              <button 
                v-else-if="canUnlock(skill)"
                class="mini-btn activate"
                @click.stop="activateSkill(skill.id)"
              >
                激活
              </button>
              <span v-else class="mini-locked">🔒</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSkillsStore } from '@/modules/skill';
import { characterService } from '@/modules/character';
import { CLASS_ABILITIES } from '@/data/class.data';
import type { Skill, SkillSlotIndex } from '@/modules/skill';
import BasePopup from '../common/BasePopup.vue';

defineProps<{
  visible: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const skillsStore = useSkillsStore();

const selectedSkill = ref<Skill | null>(null);
const selectedSlotIndex = ref<number | null>(null);
const classSkills = ref<Skill[]>([]);
const barRenderKey = ref(0);

const allSkillsMap = computed(() => {
  const map = new Map<string, Skill>();
  skillsStore.skills.forEach(s => map.set(s.id, s));
  classSkills.value.forEach(s => {
    if (!map.has(s.id)) map.set(s.id, s);
  });
  return map;
});

const skillBarSlots = computed(() => {
  void barRenderKey.value;
  return skillsStore.skillBar.slots.map((skillId, index) => {
    let skill: Skill | null = null;
    if (skillId) {
      skill = allSkillsMap.value.get(skillId) || null;
    }
    return { index: index as SkillSlotIndex, skillId, skill };
  });
});

const skillTypeNames: Record<string, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  heal: '治疗'
};

function getSkillTypeName(type: string) {
  return skillTypeNames[type] || type;
}

function getEffectText(skill: Skill): string {
  if (!skill.effect) return '';
  const { type, value } = skill.effect;
  if (type === 'physical_damage' || type === 'magic_damage') return `伤害 ${value}`;
  if (type === 'heal') return `治疗 ${value}`;
  return `${value}`;
}

function isSkillEquipped(skillId: string): boolean {
  return skillsStore.skillBar.slots.includes(skillId);
}

function canUnlock(skill: Skill): boolean {
  return skill.unlockLevel <= characterService.getLevel();
}

function selectSkill(skill: Skill) {
  selectedSkill.value = skill;
  selectedSlotIndex.value = null;
}

function selectBarSlot(index: number) {
  selectedSlotIndex.value = index;
  const slot = skillBarSlots.value[index];
  if (slot.skill) {
    selectedSkill.value = slot.skill;
  }
}

function activateSkill(skillId: string) {
  const targetSlot = selectedSlotIndex.value ?? findEmptySlot();
  if (targetSlot === null) {
    skillsStore.unequipSkill(0 as SkillSlotIndex);
    skillsStore.equipSkill(skillId, 0 as SkillSlotIndex);
  } else {
    skillsStore.equipSkill(skillId, targetSlot as SkillSlotIndex);
  }
  selectedSlotIndex.value = null;
  barRenderKey.value++;
}

function deactivateSkill(skillId: string) {
  const slotIndex = skillsStore.skillBar.slots.findIndex(id => id === skillId);
  if (slotIndex !== -1) {
    skillsStore.unequipSkill(slotIndex as SkillSlotIndex);
  }
  if (selectedSkill.value?.id === skillId) {
    selectedSkill.value = null;
  }
  barRenderKey.value++;
}

function findEmptySlot(): number | null {
  const emptyIndex = skillsStore.skillBar.slots.findIndex(slot => slot === null);
  return emptyIndex !== -1 ? emptyIndex : null;
}

async function loadClassSkills() {
  const classId = characterService.getClass();
  if (classId && CLASS_ABILITIES[classId]) {
    classSkills.value = [...CLASS_ABILITIES[classId]].sort((a, b) => a.unlockLevel - b.unlockLevel);
  } else {
    classSkills.value = [];
  }
}

async function loadData() {
  await skillsStore.loadSkills();
  await loadClassSkills();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.skill-bar-section {
  margin-bottom: 16px;
}

.skill-bar-section h3 {
  font-size: 14px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}

.skill-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 8px;
  border: 2px solid #4a4a4a;
}

.skill-slot {
  position: relative;
  padding: 12px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 80px;
  justify-content: center;
  user-select: none;
}

.skill-slot:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: #888;
  transform: translateY(-2px);
}

.skill-slot.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.15);
  box-shadow: 
    0 0 10px rgba(255, 215, 0, 0.4),
    0 0 20px rgba(255, 215, 0, 0.2),
    inset 0 0 10px rgba(255, 215, 0, 0.1);
  transform: translateY(-3px);
}

.skill-slot.selected::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 10px;
  animation: pulse-border 1.5s infinite;
}

@keyframes pulse-border {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.skill-slot.empty {
  border-style: dashed;
  border-color: #555;
}

.skill-slot.empty:hover {
  border-color: #777;
  background: rgba(255, 255, 255, 0.08);
}

.slot-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.slot-name {
  font-size: 11px;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.slot-cost {
  font-size: 10px;
  color: #6e9bff;
  font-weight: 500;
}

.slot-empty {
  font-size: 28px;
  color: #555;
  transition: color 0.2s;
}

.skill-slot.empty:hover .slot-empty {
  color: #888;
}

.slot-label {
  font-size: 10px;
  color: #555;
}

.selected-skill-section {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.selected-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.selected-icon {
  font-size: 32px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.15);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 8px;
  flex-shrink: 0;
}

.selected-info {
  flex: 1;
}

.selected-info h4 {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
  margin: 0 0 4px 0;
}

.selected-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.selected-type.physical_damage {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.selected-type.magic_damage {
  background: rgba(162, 155, 254, 0.2);
  color: #a29bfe;
}

.selected-type.heal {
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
}

.selected-level {
  font-size: 12px;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: bold;
}

.selected-desc {
  color: #aaa;
  font-size: 13px;
  margin: 0 0 10px 0;
  line-height: 1.4;
}

.selected-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-label {
  font-size: 12px;
  color: #888;
}

.meta-value {
  font-size: 13px;
  color: #fff;
  font-weight: bold;
}

.meta-value.mp {
  color: #6e9bff;
}

.meta-value.effect {
  color: #4CAF50;
}

.selected-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.action-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.action-btn:active {
  transform: translateY(0);
  filter: brightness(0.95);
}

.action-btn.activate {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.action-btn.activate:hover {
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}

.action-btn.deactivate {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.action-btn.deactivate:hover {
  box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
}

.action-locked {
  font-size: 13px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
}

.skills-list-section h3 {
  font-size: 14px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.skills-list::-webkit-scrollbar {
  width: 6px;
}

.skills-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.skills-list::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.skills-list::-webkit-scrollbar-thumb:hover {
  background: #777;
}

.skill-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.skill-card:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: #666;
  transform: translateX(4px);
}

.skill-card:active {
  transform: translateX(2px);
  background: rgba(255, 255, 255, 0.15);
}

.skill-card.equipped {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.1);
  border-left: 3px solid #4CAF50;
}

.skill-card.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-card.locked:hover {
  transform: none;
}

.skill-icon-wrapper {
  position: relative;
  flex-shrink: 0;
}

.skill-icon {
  font-size: 28px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.lock-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 12px;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.skill-header-row h4 {
  font-size: 14px;
  color: #fff;
  font-weight: bold;
  margin: 0;
}

.skill-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #888;
  font-weight: bold;
}

.skill-status.active {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

.skill-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-type-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: bold;
}

.skill-type-tag.physical_damage {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.skill-type-tag.magic_damage {
  background: rgba(162, 155, 254, 0.2);
  color: #a29bfe;
}

.skill-type-tag.heal {
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
}

.skill-cost-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(110, 155, 255, 0.15);
  color: #6e9bff;
}

.skill-effect-text {
  font-size: 11px;
  color: #4CAF50;
}

.skill-action {
  flex-shrink: 0;
}

.mini-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.mini-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.mini-btn:active {
  transform: translateY(0);
  filter: brightness(0.95);
}

.mini-btn.activate {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.mini-btn.activate:hover {
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.mini-btn.deactivate {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: #fff;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.mini-btn.deactivate:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

.mini-locked {
  font-size: 16px;
}

@media (max-width: 600px) {
  .skill-bar {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 10px;
  }

  .skill-slot {
    padding: 10px 4px;
    min-height: 70px;
  }

  .slot-icon {
    font-size: 20px;
  }

  .slot-name {
    font-size: 10px;
  }

  .selected-meta {
    flex-direction: column;
    gap: 6px;
  }

  .skills-list {
    max-height: 200px;
  }

  .skill-meta-row {
    flex-wrap: wrap;
  }
}
</style>
