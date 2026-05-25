<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <div class="popup-header">
        <h2>角色信息</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="popup-body">
        <!-- 角色基本信息 -->
        <div class="character-basic">
          <div class="char-avatar">{{ getRaceIcon(character.race) }}</div>
          <div class="char-info">
            <div class="char-name">{{ character.name }}</div>
            <div class="char-details">
              <span class="faction-tag" :style="{ '--faction-color': getFactionColor(character.faction) }">
                {{ getFactionName(character.faction) }}
              </span>
              <span>{{ getRaceName(character.race) }}</span>
              <span>{{ getClassName(character.class) }}</span>
            </div>
            <div class="char-level">等级 {{ character.level }}</div>
          </div>
        </div>
        
        <!-- 资源条 -->
        <div class="resource-bars">
          <div class="resource-bar hp-bar">
            <div class="resource-fill" :style="{ width: hpPercent + '%' }"></div>
            <div class="resource-text">HP {{ currentHp }} / {{ maxHp }}</div>
          </div>
          <div class="resource-bar mp-bar">
            <div class="resource-fill" :style="{ width: mpPercent + '%' }"></div>
            <div class="resource-text">MP {{ currentMp }} / {{ maxMp }}</div>
          </div>
          <div class="resource-bar exp-bar">
            <div class="resource-fill" :style="{ width: expPercent + '%' }"></div>
            <div class="resource-text">EXP {{ currentExp }} / {{ maxExp }}</div>
          </div>
        </div>
        
        <!-- 核心属性 -->
        <div class="attributes-section">
          <h3>核心属性</h3>
          <div class="attributes-grid">
            <div class="attr-item" v-for="(value, key) in coreAttributes" :key="key">
              <div class="attr-icon">{{ getAttrIcon(key) }}</div>
              <div class="attr-name">{{ getAttrName(key) }}</div>
              <div class="attr-value">{{ value }}</div>
            </div>
          </div>
        </div>
        
        <!-- 次级属性 -->
        <div class="attributes-section">
          <h3>次级属性</h3>
          <div class="secondary-attributes">
            <div class="sec-attr-item">
              <span>物理攻击</span>
              <strong>{{ secondaryAttributes.physicalAttack }}</strong>
            </div>
            <div class="sec-attr-item">
              <span>物理防御</span>
              <strong>{{ secondaryAttributes.physicalDefense }}</strong>
            </div>
            <div class="sec-attr-item">
              <span>魔法攻击</span>
              <strong>{{ secondaryAttributes.magicalAttack }}</strong>
            </div>
            <div class="sec-attr-item">
              <span>魔法防御</span>
              <strong>{{ secondaryAttributes.magicalDefense }}</strong>
            </div>
            <div class="sec-attr-item">
              <span>暴击率</span>
              <strong>{{ secondaryAttributes.critRate }}%</strong>
            </div>
            <div class="sec-attr-item">
              <span>闪避率</span>
              <strong>{{ secondaryAttributes.dodgeRate }}%</strong>
            </div>
            <div class="sec-attr-item">
              <span>最大HP</span>
              <strong>{{ secondaryAttributes.maxHp }}</strong>
            </div>
            <div class="sec-attr-item">
              <span>最大MP</span>
              <strong>{{ secondaryAttributes.maxMp }}</strong>
            </div>
          </div>
        </div>
        
        <!-- 装备 -->
        <div class="equipment-section">
          <h3>装备</h3>
          <div class="equipment-grid">
            <div 
              v-for="slot in equipmentSlots" 
              :key="slot.key"
              class="equip-slot"
              :class="{ equipped: slot.equipment }"
              @click="selectEquipment(slot)"
            >
              <div class="slot-icon" v-if="slot.equipment">{{ getEquipIcon(slot.equipment.type) }}</div>
              <div class="slot-empty" v-else>{{ slot.name }}</div>
            </div>
          </div>
        </div>
        
        <!-- 选中装备信息 -->
        <div v-if="selectedSlot && selectedSlot.equipment" class="selected-equipment">
          <div class="equip-header">
            <div class="equip-icon">{{ getEquipIcon(selectedSlot.equipment.type) }}</div>
            <div>
              <div class="equip-name">{{ selectedSlot.equipment.name }}</div>
              <div class="equip-quality" :class="selectedSlot.equipment.quality">
                {{ getQualityName(selectedSlot.equipment.quality) }}
              </div>
            </div>
          </div>
          <div class="equip-desc">{{ selectedSlot.equipment.description }}</div>
          <div class="equip-stats">
            <div v-for="(value, stat) in selectedSlot.equipment.attributes" :key="stat">
              {{ getStatName(stat) }} +{{ value }}
            </div>
          </div>
          <div class="equip-actions">
            <button class="action-btn unequip" @click="unequipItem(selectedSlot.key)">卸下</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { equipmentService } from '@/modules/equipment';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();

const character = computed(() => characterStore.getCharacterInfo());
const coreAttributes = computed(() => characterStore.attributes);

const currentHp = computed(() => character.value.currentHp || coreAttributes.value.maxHp);
const maxHp = computed(() => coreAttributes.value.maxHp);
const currentMp = computed(() => character.value.currentMp || coreAttributes.value.maxMp);
const maxMp = computed(() => coreAttributes.value.maxMp);
const currentExp = computed(() => character.value.exp || 0);
const maxExp = computed(() => 1000);

const hpPercent = computed(() => Math.round((currentHp.value / maxHp.value) * 100));
const mpPercent = computed(() => Math.round((currentMp.value / maxMp.value) * 100));
const expPercent = computed(() => Math.min(100, Math.round((currentExp.value / maxExp.value) * 100)));

const secondaryAttributes = computed(() => {
  const attrs = coreAttributes.value;
  return {
    physicalAttack: attrs.str * 2 + 10,
    physicalDefense: attrs.con * 1.5 + 5,
    magicalAttack: attrs.int * 2 + 10,
    magicalDefense: attrs.wis * 1.5 + 5,
    critRate: Math.floor(attrs.dex * 0.5 + 5),
    dodgeRate: Math.floor(attrs.dex * 0.3 + 3),
    maxHp: attrs.maxHp,
    maxMp: attrs.maxMp
  };
});

const equipmentSlots = computed(() => equipmentService.getEquipmentSlots());
const selectedSlot = ref<any>(null);

const factions = {
  alliance: { name: '联盟', color: '#0078ff' },
  horde: { name: '部落', color: '#ff4400' },
  neutral: { name: '中立', color: '#9d9d9d' }
};

const races: Record<string, { name: string; icon: string }> = {
  human: { name: '人类', icon: '👨' },
  dwarf: { name: '矮人', icon: '🧔' },
  gnome: { name: '侏儒', icon: '👦' },
  nightelf: { name: '暗夜精灵', icon: '🌙' },
  draenei: { name: '德莱尼', icon: '⭐' },
  orc: { name: '兽人', icon: '👹' },
  undead: { name: '亡灵', icon: '💀' },
  tauren: { name: '牛头', icon: '🐂' },
  troll: { name: '巨魔', icon: '👺' },
  bloodelves: { name: '血精灵', icon: '🧝' },
  pandaren: { name: '熊猫人', icon: '🐼' }
};

const classes: Record<string, string> = {
  warrior: '战士',
  mage: '法师',
  paladin: '圣骑士',
  hunter: '猎人',
  rogue: '潜行者',
  warlock: '术士',
  druid: '德鲁伊',
  priest: '牧师',
  shaman: '萨满',
  deathknight: '死亡骑士',
  monk: '武僧',
  demonhunter: '恶魔猎手'
};

const attrIcons: Record<string, string> = {
  str: '⚔️',
  dex: '💨',
  con: '❤️',
  int: '🧠',
  wis: '🔍',
  cha: '💫'
};

const attrNames: Record<string, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
};

const equipTypes: Record<string, string> = {
  weapon: '🗡️',
  offhand: '🛡️',
  head: '👑',
  chest: '👕',
  legs: '👖',
  feet: '👢',
  hands: '🧤',
  accessory: '💍'
};

const qualityNames: Record<string, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

function getRaceIcon(race: string) {
  return races[race]?.icon || '👤';
}

function getRaceName(race: string) {
  return races[race]?.name || '';
}

function getFactionName(faction: string) {
  return (factions as any)[faction]?.name || '';
}

function getFactionColor(faction: string) {
  return (factions as any)[faction]?.color || '#9d9d9d';
}

function getClassName(cls: string) {
  return classes[cls] || '';
}

function getAttrIcon(key: string) {
  return attrIcons[key] || '📊';
}

function getAttrName(key: string) {
  return attrNames[key] || key;
}

function getStatName(stat: string) {
  const statMap: Record<string, string> = {
    physicalAttack: '物理攻击',
    physicalDefense: '物理防御',
    magicalAttack: '魔法攻击',
    magicalDefense: '魔法防御',
    maxHp: '最大HP',
    maxMp: '最大MP'
  };
  return statMap[stat] || stat;
}

function getEquipIcon(type: string) {
  return equipTypes[type] || '📦';
}

function getQualityName(quality: string) {
  return qualityNames[quality] || '';
}

function selectEquipment(slot: any) {
  selectedSlot.value = slot;
}

function unequipItem(slotKey: string) {
  equipmentService.unequipItem(slotKey);
  selectedSlot.value = null;
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}

.popup-content {
  background: rgba(13, 17, 23, 0.98);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #4a4a4a;
}

.popup-header h2 {
  font-size: 20px;
  color: #ffd700;
  margin: 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #f0f0f0;
  font-size: 24px;
  cursor: pointer;
  transition: background 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.popup-body {
  padding: 24px;
}

/* 角色基本信息 */
.character-basic {
  display: flex;
  gap: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 20px;
}

.char-avatar {
  font-size: 64px;
}

.char-info {
  flex: 1;
}

.char-name {
  font-size: 24px;
  color: #f0f0f0;
  font-weight: bold;
  margin-bottom: 8px;
}

.char-details {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.char-details span {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #8b8b8b;
  font-size: 13px;
}

.faction-tag {
  color: var(--faction-color);
}

.char-level {
  font-size: 16px;
  color: #ffd700;
  font-weight: bold;
}

/* 资源�?*/
.resource-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.resource-bar {
  position: relative;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
}

.resource-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 14px;
}

.hp-bar .resource-fill {
  background: linear-gradient(90deg, #ff4444, #ff0000);
}

.mp-bar .resource-fill {
  background: linear-gradient(90deg, #4444ff, #0000ff);
}

.exp-bar .resource-fill {
  background: linear-gradient(90deg, #ffd700, #ff8c00);
}

.resource-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #f0f0f0;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

/* 属性区�?*/
.attributes-section {
  margin-bottom: 24px;
}

.attributes-section h3 {
  font-size: 16px;
  color: #ffd700;
  margin-bottom: 12px;
}

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.attr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.attr-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.attr-name {
  font-size: 13px;
  color: #8b8b8b;
  margin-bottom: 4px;
}

.attr-value {
  font-size: 20px;
  color: #f0f0f0;
  font-weight: bold;
}

/* 次级属�?*/
.secondary-attributes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.sec-attr-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.sec-attr-item span {
  color: #8b8b8b;
  font-size: 13px;
}

.sec-attr-item strong {
  color: #f0f0f0;
  font-size: 14px;
}

/* 装备�?*/
.equipment-section {
  margin-bottom: 20px;
}

.equipment-section h3 {
  font-size: 16px;
  color: #ffd700;
  margin-bottom: 12px;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.equip-slot {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.equip-slot:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.equip-slot.equipped {
  border-color: #ffd700;
}

.slot-icon {
  font-size: 32px;
}

.slot-empty {
  color: #8b8b8b;
  font-size: 12px;
  text-align: center;
}

/* 选中装备信息 */
.selected-equipment {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid #4a4a4a;
}

.equip-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.equip-icon {
  font-size: 40px;
}

.equip-name {
  font-size: 18px;
  color: #f0f0f0;
  font-weight: bold;
  margin-bottom: 4px;
}

.equip-quality {
  font-size: 13px;
}

.equip-quality.common { color: #ffffff; }
.equip-quality.uncommon { color: #1eff00; }
.equip-quality.rare { color: #0070dd; }
.equip-quality.epic { color: #a335ee; }
.equip-quality.legendary { color: #ff8000; }

.equip-desc {
  color: #8b8b8b;
  font-size: 14px;
  margin-bottom: 12px;
}

.equip-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.equip-stats div {
  color: #4CAF50;
  font-size: 14px;
}

.equip-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.unequip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
}

.action-btn:hover {
  transform: translateY(-2px);
}
</style>
