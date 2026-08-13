/**
 * @fileoverview 坐骑配置 Composable
 * @description
 *   封装 CharacterInfoPopup 坐骑页签的响应式状态与交互逻辑：
 *   - 档位视图构建（含解锁状态、当前选择）
 *   - 当前总加成计算
 *   - 选择/取消/重置交互（调用 characterStore.setMountChoice/resetMountChoices）
 *
 *   设计原则：Composable 仅管理状态与调用 Store Action，不直接操作 DOM。
 *   错误通过 useToast 提示，不向上抛出（与 CharacterInfoPopup.unequipItem 风格一致）。
 */
import { computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { computeMountBonus, isTierUnlocked } from '@/modules/character';
import { MOUNT_TIERS, getMountOptionsByTier } from '@/data/config_mounts';
import type { MountOption, MountTierMeta } from '@/data/config_mounts';
import type { Stats } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';

/** 空加成（无任何选择时），P5-027 修复：冻结防止外部意外修改 */
const EMPTY_BONUS: Readonly<Partial<Stats>> = Object.freeze({});

/** 档位视图（供 UI 渲染） */
export interface MountTierView {
  /** 档位元数据（tier/index/unlockLevel/label/directionType/bonusTotal） */
  meta: MountTierMeta;
  /** 该档全部方向（单属性档 6 个，双属性档 9 个） */
  options: MountOption[];
  /** 当前选择的方向 ID（null 表示未选） */
  selectedId: string | null;
  /** 是否已解锁（基于角色等级） */
  unlocked: boolean;
}

/**
 * 坐骑配置 Composable
 *
 * 响应式依赖：characterStore.character.level / characterStore.character.mountChoices
 * 任一变化时，tiers / currentBonus / hasAnyChoice 自动重算。
 */
export function useCharacterMounts() {
  const characterStore = useCharacterStore();
  const toast = useToast();

  /** 当前角色等级 */
  const level = computed<number>(() => characterStore.character?.level ?? 1);

  /** 当前坐骑配置（5 档选择），缺失时兜底为全 null */
  const mountChoices = computed<(string | null)[]>(() =>
    characterStore.character?.mountChoices ?? [null, null, null, null, null]
  );

  /** 当前总加成（5 档选择叠加后的 Partial<Stats>） */
  const currentBonus = computed<Partial<Stats>>(() => {
    const bonus = computeMountBonus(mountChoices.value);
    return Object.keys(bonus).length > 0 ? bonus : EMPTY_BONUS;
  });

  /** 档位视图（按 MOUNT_TIERS 顺序：common → legendary） */
  const tiers = computed<MountTierView[]>(() =>
    MOUNT_TIERS.map(meta => {
      const options = getMountOptionsByTier(meta.tier);
      const selectedId = mountChoices.value[meta.index] ?? null;
      const unlocked = isTierUnlocked(meta.index, level.value);
      return { meta, options, selectedId, unlocked };
    })
  );

  /** 是否有任何选择（控制重置按钮可用性） */
  const hasAnyChoice = computed<boolean>(() =>
    mountChoices.value.some(c => c !== null)
  );

  /**
   * 选择/取消某档方向
   *
   * 交互规则（plan §6.2）：
   * - 未选中方向 → 点击选中（高亮），立即应用加成
   * - 已选中方向 → 点击取消选择（变为 null）
   * - 未解锁档位 → 不可点击（UI 层 disabled，本函数双重校验）
   *
   * @param tierIndex - 档位索引（0-4）
   * @param optionId - 方向 ID
   */
  async function setChoice(tierIndex: number, optionId: string): Promise<void> {
    const tier = tiers.value[tierIndex];
    if (!tier || !tier.unlocked) return;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'mount_select' });
    // 已选则取消（传 null），否则选中新方向
    const newId = tier.selectedId === optionId ? null : optionId;
    try {
      await characterStore.setMountChoice(tierIndex, newId);
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : '修改坐骑配置失败',
        type: 'danger',
        duration: 3000,
      });
    }
  }

  /**
   * 重置所有坐骑选择
   *
   * plan §5.3：非战斗中随时可调用，无需消耗资源。
   * 无任何选择时直接返回（避免无意义调用）。
   */
  async function resetAll(): Promise<void> {
    if (!hasAnyChoice.value) return;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'mount_reset' });
    try {
      await characterStore.resetMountChoices();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : '重置坐骑配置失败',
        type: 'danger',
        duration: 3000,
      });
    }
  }

  return {
    level,
    mountChoices,
    currentBonus,
    tiers,
    hasAnyChoice,
    setChoice,
    resetAll,
  };
}
