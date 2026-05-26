<template>
  <div v-if="visible" class="popup-overlay">
    <div class="popup-content">
      <div class="skills-view">
        <div class="skills-header">
          <h2>技能</h2>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

    <div class="skill-bar-section">
      <h3>技能栏 (战斗中使用)</h3>
      <div class="skill-bar">
        <div 
          v-for="(skill, index) in activeSkills" 
          :key="index"
          :class="['skill-slot', { empty: !skill }]"
          @click="selectSkillForBar(index)"
        >
          <span v-if="skill" class="slot-icon">{{ getSkillIcon(skill.type) }}</span>
          <span v-if="skill" class="slot-name">{{ skill.name }}</span>
          <span v-if="skill" class="slot-mp">{{ skill.mpCost }} MP</span>
          <span v-if="!skill" class="slot-empty">+</span>
        </div>
      </div>
    </div>

    <div class="skills-list-section">
      <h3>可用技能</h3>
      <div class="skills-list">
        <div 
          v-for="skill in availableSkills" 
          :key="skill.id"
          :class="['skill-card', { learned: skill.learned }]"
          @click="selectSkill(skill)"
        >
          <div class="skill-icon-wrapper">
            <span class="skill-icon">{{ getSkillIcon(skill.type) }}</span>
            <span v-if="!skill.learned" class="lock-icon">🔒</span>
          </div>
          <div class="skill-info">
            <div class="skill-header-row">
              <h4>{{ skill.name }}</h4>
              <span class="skill-level">Lv.{{ skill.currentLevel }}/{{ skill.maxLevel }}</span>
            </div>
            <p class="skill-desc">{{ skill.description }}</p>
            <div class="skill-meta">
              <span class="skill-type">{{ getSkillTypeName(skill.type) }}</span>
              <span class="skill-cost">消耗 {{ skill.mpCost }} MP</span>
            </div>
            <div class="skill-effect">
              <span>效果: {{ getEffectText(skill.effect) }}</span>
            </div>
          </div>
          <div class="skill-actions">
            <button 
              v-if="!skill.learned"
              class="learn-btn"
              @click.stop="learnSkill(skill.id)"
            >
              📖 学习
            </button>
            <button 
              v-else-if="isActive(skill.id)"
              class="remove-btn"
              @click.stop="removeFromBar(skill.id)"
            >
              ✖️ 卸下
            </button>
            <button 
              v-else
              class="add-btn"
              @click.stop="addToBar(skill.id)"
            >
              添加到技能栏
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedSkill" class="skill-detail">
      <div class="detail-header">
        <span class="detail-icon">{{ getSkillIcon(selectedSkill.type) }}</span>
        <h3>{{ selectedSkill.name }}</h3>
      </div>
      <p>{{ selectedSkill.description }}</p>
      <div class="detail-stats">
        <div class="stat-item">
          <span class="stat-label">类型:</span>
          <span class="stat-value">{{ getSkillTypeName(selectedSkill.type) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">魔法消耗</span>
          <span class="stat-value">{{ selectedSkill.mpCost }} MP</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">等级:</span>
          <span class="stat-value">{{ selectedSkill.currentLevel }} / {{ selectedSkill.maxLevel }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">效果:</span>
          <span class="stat-value">{{ getEffectText(selectedSkill.effect) }}</span>
        </div>
      </div>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { skillsService } from '@/modules/skills';
import type { Skill, SkillType } from '@/modules/skills';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedSkill = ref<Skill | null>(null);

const availableSkills = ref<Skill[]>([]);

const activeSkills = computed(() => {
  const bar = skillsService.getSkillBar();
  return bar.slots.map(slotId => slotId ? skillsService.getSkill(slotId) : null);
});

const skillIcons: Record<SkillType, string> = {
  physical_damage: '⚔️',
  magic_damage: '🔮',
  heal: '💚',
  buff: '🛡️',
  debuff: '🌀'
};

const skillTypeNames: Record<SkillType, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  heal: '治疗',
  buff: '增益',
  debuff: '减益'
};

function getSkillIcon(type: SkillType) {
  return skillIcons[type] || '📜';
}

function getSkillTypeName(type: SkillType) {
  return skillTypeNames[type] || type;
}

function getEffectText(effect: any) {
  if (!effect) return '';
  if (effect.type === 'damage') return `造成 ${effect.value} 点伤害`;
  if (effect.type === 'heal') return `恢复 ${effect.value} 点生命值`;
  if (effect.type === 'buff') return `增益效果 ${effect.value}，持续${effect.duration} 回合`;
  return JSON.stringify(effect);
}

function selectSkill(skill: Skill) {
  selectedSkill.value = skill;
}

function selectSkillForBar(index: number) {
  const skill = activeSkills.value[index];
  if (skill) {
    selectedSkill.value = skill;
  }
}

function isActive(skillId: string) {
  return activeSkills.value.some((s: any) => s?.id === skillId);
}

function learnSkill(skillId: string) {
  const result = skillsService.learnSkill(skillId);
  if (result.success) {
    alert(result.message);
    loadSkills();
  } else {
    alert(result.message);
  }
}

function addToBar(skillId: string) {
  const bar = skillsService.getSkillBar();
  const emptySlot = bar.slots.findIndex(slotId => slotId === null);
  if (emptySlot !== -1) {
    const success = skillsService.equipSkill(skillId, emptySlot);
    if (success) {
      alert('已添加到技能栏');
    } else {
      alert('添加失败');
    }
  } else {
    alert('技能栏已满');
  }
}

function removeFromBar(skillId: string) {
  const bar = skillsService.getSkillBar();
  const slotIndex = bar.slots.findIndex(slotId => slotId === skillId);
  if (slotIndex !== -1) {
    const success = skillsService.unequipSkill(slotIndex);
    if (success) {
      alert('已从技能栏移除');
    }
  }
}

function loadSkills() {
  availableSkills.value = skillsService.getSkills();
}

onMounted(() => {
  loadSkills();
});
</script>

<style scoped>
.skills-view {
  max-width: 800px;
  margin: 0 auto;
}

.skills-header {
  margin-bottom: 24px;
}

.skills-header h2 {
  font-size: 24px;
  color: #ffd700;
}

.skill-bar-section {
  margin-bottom: 24px;
}

.skill-bar-section h3 {
  font-size: 18px;
  color: #fff;
  margin-bottom: 12px;
}

.skill-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
  border-radius: 8px;
  border: 2px solid #4a4a4a;
}

.skill-slot {
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.skill-slot:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #666;
}

.skill-slot.empty {
  border-style: dashed;
}

.slot-icon {
  font-size: 28px;
}

.slot-name {
  font-size: 12px;
  color: #fff;
}

.slot-mp {
  font-size: 11px;
  color: #4444ff;
}

.slot-empty {
  font-size: 32px;
  color: #666;
}

.skills-list-section {
  margin-bottom: 24px;
}

.skills-list-section h3 {
  font-size: 18px;
  color: #fff;
  margin-bottom: 12px;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.skill-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.skill-card.learned {
  border-color: #4CAF50;
}

.skill-card:not(.learned) {
  opacity: 0.7;
}

.skill-icon-wrapper {
  position: relative;
}

.skill-icon {
  font-size: 40px;
}

.lock-icon {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
}

.skill-info {
  flex: 1;
}

.skill-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.skill-info h4 {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
}

.skill-level {
  padding: 4px 8px;
  background: rgba(255, 215, 0, 0.2);
  border-radius: 4px;
  color: #ffd700;
  font-size: 12px;
}

.skill-desc {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 8px;
}

.skill-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.skill-type {
  padding: 4px 8px;
  background: rgba(0, 153, 255, 0.2);
  border-radius: 4px;
  color: #0099ff;
  font-size: 12px;
}

.skill-cost {
  padding: 4px 8px;
  background: rgba(128, 0, 128, 0.2);
  border-radius: 4px;
  color: #a335ee;
  font-size: 12px;
}

.skill-effect span {
  color: #4CAF50;
  font-size: 14px;
}

.skill-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.learn-btn, .add-btn, .remove-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.learn-btn {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.add-btn {
  background: linear-gradient(135deg, #0099ff, #0066cc);
  color: #fff;
}

.remove-btn {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  color: #fff;
}

.learn-btn:hover, .add-btn:hover, .remove-btn:hover {
  transform: translateY(-2px);
}

.skill-detail {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 16px;
  border: 2px solid #4a4a4a;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-icon {
  font-size: 32px;
}

.skill-detail h3 {
  font-size: 20px;
  color: #ffd700;
}

.skill-detail p {
  color: #aaa;
  margin-bottom: 16px;
}

.detail-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  gap: 12px;
}

.stat-label {
  color: #888;
  font-size: 14px;
}

.stat-value {
  color: #fff;
  font-size: 14px;
}
</style>