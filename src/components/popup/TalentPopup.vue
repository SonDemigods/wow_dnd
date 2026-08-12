<template>
  <BasePopup :visible="visible" title="天赋面板" @close="$emit('close')">
    <template #default>
      <div class="talent-content" v-if="talentStore.currentClassId">
        <!-- 头部：点数信息 + 重置按钮 -->
        <div class="talent-header">
          <div class="points-info">
            <span class="points-label">可用点数</span>
            <span class="points-value" :class="{ zero: talentStore.availablePoints === 0 }">
              {{ talentStore.availablePoints }}
            </span>
            <span class="points-sep">/</span>
            <span class="points-total">{{ talentStore.totalPoints }}</span>
          </div>
          <button
            class="reset-btn"
            :disabled="talentStore.spentPoints === 0"
            @click="confirmReset"
          >
            重置天赋
          </button>
        </div>

        <!-- 天赋树网格 -->
        <div class="talent-tree-container">
          <!-- SVG 连线层 -->
          <svg class="connections-layer" :width="gridWidth" :height="gridHeight">
            <line
              v-for="(line, i) in connectionLines"
              :key="i"
              :x1="line.x1" :y1="line.y1"
              :x2="line.x2" :y2="line.y2"
              :class="['conn-line', { active: line.active }]"
            />
          </svg>

          <!-- 节点网格 -->
          <div class="talent-grid" :style="{ width: gridWidth + 'px', height: gridHeight + 'px' }">
            <div
              v-for="node in allNodes"
              :key="node.talent.id"
              :class="['talent-node', nodeStateClass(node)]"
              :style="nodeStyle(node)"
              @click="onNodeClick(node)"
              @contextmenu.prevent="onNodeRightClick(node)"
            >
              <div class="node-col-indicator" :style="{ background: colColor(node.talent.col) }" />
              <BaseIcon
                :name="node.talent.icon || COMMON_ICONS.star"
                :gradient="characterStore.classId"
                :size="28"
              />
              <span class="node-name">{{ node.talent.name }}</span>
              <span class="node-rank" :class="{ maxed: node.rank >= node.talent.maxRank }">
                {{ node.rank }}/{{ node.talent.maxRank }}
              </span>
              <span v-if="node.talent.tier === 6" class="node-ultimate-badge">★</span>
              <span v-if="nodeStateClass(node) === 'locked'" class="node-lock">
                <BaseIcon :name="COMMON_ICONS.padlock" :size="12" />
              </span>
            </div>
          </div>
        </div>

        <!-- 选中节点详情 -->
        <div class="talent-detail" v-if="selectedTalent">
          <div class="detail-header">
            <BaseIcon :name="selectedTalent.icon" :gradient="characterStore.classId" :size="32" />
            <div class="detail-info">
              <h3>{{ selectedTalent.name }}</h3>
              <p class="detail-desc">{{ selectedTalent.description }}</p>
            </div>
          </div>
          <div class="detail-actions">
            <button
              class="action-btn learn-btn"
              :disabled="!talentStore.canLearn(selectedTalent.id)"
              @click="learnSelected"
            >
              学习
            </button>
            <button
              class="action-btn unlearn-btn"
              :disabled="!talentStore.canUnlearn(selectedTalent.id)"
              @click="unlearnSelected"
            >
              取消
            </button>
          </div>
        </div>
        <div class="talent-detail empty" v-else>
          <span>点击天赋节点查看详情，左键学习，右键取消</span>
        </div>

        <!-- Toast 提示 -->
        <Transition name="toast">
          <div v-if="toastMessage" class="talent-toast">{{ toastMessage }}</div>
        </Transition>
      </div>
      <div v-else class="talent-empty">
        <span>请先选择角色</span>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useTalentStore } from '@/modules/character/talents';
import { useCharacterStore } from '@/modules/character';
import type { Talent } from '@/modules/character/talents/types';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { COMMON_ICONS } from '@/config/icons';
import {
  TALENT_NODE_W, TALENT_NODE_H, TALENT_COL_GAP, TALENT_ROW_GAP,
  TALENT_COL1_COLOR, TALENT_COL2_COLOR, TALENT_COL3_COLOR, TALENT_COL_DEFAULT_COLOR,
} from '@/config/talentLayout';

defineProps<{ visible: boolean }>();
defineEmits<{ close: [] }>();

const talentStore = useTalentStore();
const characterStore = useCharacterStore();

const selectedTalent = ref<Talent | null>(null);
const toastMessage = ref('');
// P12-026 修复：移除未使用的 containerRef 死绑定

const tree = computed(() =>
  // P10-037 修复：按 characterStore.classId 匹配天赋树，而非用索引取第一棵树
  talentStore.talentTrees.find(t => t.classId === characterStore.classId) ?? talentStore.talentTrees[0]
);

interface GridNode {
  talent: Talent;
  rank: number;
  x: number;
  y: number;
  col: number;
  tier: number;
}

const allNodes = computed<GridNode[]>(() => {
  if (!tree.value) return [];
  return tree.value.talents.map(t => {
    const col = t.col || 1;
    const tier = t.tier;
    return {
      talent: t,
      rank: talentStore.getTalentRank(t.id),
      x: (col - 1) * (TALENT_NODE_W + TALENT_COL_GAP),
      y: (tier - 1) * (TALENT_NODE_H + TALENT_ROW_GAP),
      col,
      tier,
    };
  });
});

const gridWidth = computed(() => 3 * TALENT_NODE_W + 2 * TALENT_COL_GAP);
const gridHeight = computed(() => 6 * TALENT_NODE_H + 5 * TALENT_ROW_GAP);

interface ConnLine {
  x1: number; y1: number; x2: number; y2: number;
  active: boolean;
}

const connectionLines = computed<ConnLine[]>(() => {
  if (!tree.value) return [];
  const lines: ConnLine[] = [];
  const nodeMap = new Map(allNodes.value.map(n => [n.talent.id, n]));

  for (const node of allNodes.value) {
    if (!node.talent.requires) continue;
    for (const reqId of node.talent.requires) {
      const from = nodeMap.get(reqId);
      if (!from) continue;
      lines.push({
        x1: from.x + TALENT_NODE_W / 2,
        y1: from.y + TALENT_NODE_H,
        x2: node.x + TALENT_NODE_W / 2,
        y2: node.y,
        active: from.rank > 0,
      });
    }
  }
  return lines;
});

function nodeStateClass(node: GridNode): string {
  if (node.rank >= node.talent.maxRank) return 'maxed';
  if (node.rank > 0) return 'learned';
  if (talentStore.canLearn(node.talent.id)) return 'learnable';
  return 'locked';
}

function nodeStyle(node: GridNode): Record<string, string> {
  return {
    left: node.x + 'px',
    top: node.y + 'px',
    width: TALENT_NODE_W + 'px',
    height: TALENT_NODE_H + 'px',
  };
}

function colColor(col?: number): string {
  switch (col) {
    case 1: return TALENT_COL1_COLOR; // 武器/输出系
    case 2: return TALENT_COL2_COLOR; // 狂怒/辅助系
    case 3: return TALENT_COL3_COLOR; // 防护/生存系
    default: return TALENT_COL_DEFAULT_COLOR;
  }
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
// P8-502 修复：跟踪重置确认计时器，组件卸载时清理
let resetConfirmTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string): void {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMessage.value = ''; }, 2500);
}

function onNodeClick(node: GridNode): void {
  selectedTalent.value = node.talent;
  if (talentStore.canLearn(node.talent.id)) {
    // P8-503 修复：检查 learn 返回值，失败时提示
    if (!talentStore.learn(node.talent.id)) {
      showToast('无法学习该天赋');
    }
  } else {
    const result = canLearnReason(node.talent.id);
    if (result) showToast(result);
  }
}

function onNodeRightClick(node: GridNode): void {
  selectedTalent.value = node.talent;
  if (talentStore.canUnlearn(node.talent.id)) {
    // P8-503 修复：检查 unlearn 返回值，失败时提示
    if (!talentStore.unlearn(node.talent.id)) {
      showToast('无法取消该天赋');
    }
  } else {
    showToast('该天赋未学习或等级为 0');
  }
}

function canLearnReason(talentId: string): string | null {
  if (talentStore.availablePoints <= 0) return '没有可用的天赋点数';
  const node = allNodes.value.find(n => n.talent.id === talentId);
  if (!node) return null;
  if (node.rank >= node.talent.maxRank) return '该天赋已达最大等级';
  if (!talentStore.canLearn(talentId)) return '前置天赋未学习或层级未解锁';
  return null;
}

// P8-503 修复：模板按钮包装函数，检查 learn/unlearn 返回值
function learnSelected(): void {
  if (!selectedTalent.value) return;
  if (!talentStore.learn(selectedTalent.value.id)) {
    showToast('无法学习该天赋');
  }
}

function unlearnSelected(): void {
  if (!selectedTalent.value) return;
  if (!talentStore.unlearn(selectedTalent.value.id)) {
    showToast('无法取消该天赋');
  }
}

const showResetConfirm = ref(false);

function confirmReset(): void {
  if (!showResetConfirm.value) {
    showResetConfirm.value = true;
    showToast('再次点击「重置天赋」以确认重置');
    // P8-502 修复：记录计时器引用，组件卸载时清理
    if (resetConfirmTimer) clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(() => { showResetConfirm.value = false; }, 3000);
    return;
  }
  talentStore.resetAllAllocations();
  showResetConfirm.value = false;
  showToast('已重置所有天赋分配');
}

// P8-502 修复：组件卸载时清理未完成的 setTimeout 计时器
onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer);
  if (resetConfirmTimer) clearTimeout(resetConfirmTimer);
});

watch(() => talentStore.allocations, () => {
  // 刷新选中天赋的等级显示
  if (selectedTalent.value) {
    selectedTalent.value = allNodes.value.find(n => n.talent.id === selectedTalent.value!.id)?.talent ?? null;
  }
}, { deep: true });
</script>

<style scoped>
.talent-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 70vh;
  overflow-y: auto;
}

.talent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}

.points-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.points-label {
  font-size: 13px;
  color: #ccc;
}

.points-value {
  font-size: 18px;
  font-weight: bold;
  color: #ffd700;
}

.points-value.zero {
  color: #888;
}

.points-sep, .points-total {
  font-size: 14px;
  color: #888;
}

.reset-btn {
  padding: 4px 12px;
  background: #444;
  color: #ff6b6b;
  border: 1px solid #666;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.reset-btn:hover:not(:disabled) {
  background: #555;
}

.reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.talent-tree-container {
  position: relative;
  display: flex;
  justify-content: center;
  overflow: auto;
  padding: 8px;
}

.connections-layer {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

.conn-line {
  stroke: #555;
  stroke-width: 2;
  opacity: 0.4;
}

.conn-line.active {
  stroke: #ffd700;
  opacity: 0.8;
}

.talent-grid {
  position: relative;
}

.talent-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 2px solid #555;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.talent-node:hover {
  transform: scale(1.05);
  border-color: #888;
}

.talent-node.learned {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.15);
}

.talent-node.learnable {
  border-color: #ffd700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
}

.talent-node.maxed {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.6);
}

.talent-node.locked {
  opacity: 0.45;
  filter: grayscale(0.7);
}

.node-col-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 8px 8px 0 0;
}

.node-name {
  font-size: 10px;
  color: #ddd;
  text-align: center;
  line-height: 1.1;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-rank {
  font-size: 10px;
  color: #888;
}

.node-rank.maxed {
  color: #ffd700;
  font-weight: bold;
}

.node-ultimate-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  color: #ffd700;
}

.node-lock {
  position: absolute;
  top: 2px;
  right: 4px;
  display: flex;
  align-items: center;
}

.talent-detail {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  min-height: 60px;
}

.talent-detail.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 12px;
}

.detail-header {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.detail-info h3 {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

.detail-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #aaa;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.action-btn {
  padding: 4px 16px;
  border: 1px solid #666;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.learn-btn {
  background: rgba(74, 158, 255, 0.2);
  color: #4a9eff;
}

.unlearn-btn {
  background: rgba(255, 107, 107, 0.15);
  color: #ff6b6b;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.talent-toast {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: rgba(0, 0, 0, 0.85);
  color: #ff6b6b;
  border-radius: 4px;
  font-size: 12px;
  z-index: 100;
}

.toast-enter-active, .toast-leave-active {
  transition: opacity 0.3s;
}

.toast-enter-from, .toast-leave-to {
  opacity: 0;
}

.talent-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #888;
}
</style>
