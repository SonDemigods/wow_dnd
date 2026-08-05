/**
 * @fileoverview 统一物品描述器
 * @description
 *   物品系统升级（plan.md §3.6）的 UI 描述层单一来源。收口旧版散落在 InventoryPopup /
 *   ShopPopup / CombatPopup 三处的 `getEffectText` / `getEffectValueText` / `getEffectToast` /
 *   `rarityNames` / `typeNames` / `getStatName`，统一为 `describeItem` / `describeEffect` /
 *   `describeSetProgress`（plan.md U1/U3 一次性消除）。
 *
 *   新增效果类型只需在 `EFFECT_DESCRIBERS` 追加一行，无需改任何弹窗（开闭原则）。
 *
 *   阶段定位：P1（纯新增）。本文件不修改旧弹窗；P2 切换 UI 到本描述器后删除旧映射。
 *
 * @module item
 */
import type { Stats } from '../character/types';
import type { ItemRarity, ItemEffect } from '../inventory/types';
import type { Item, WeaponGrip } from './types';
import { getItemDisplayName } from './typeRegistry';
import { SLOT_CONFIG } from '../equipment/slotRegistry';
import type { SetBonusEffect } from '../equipment/setTypes';
import type { SetProgress } from '../equipment/setService';

// ============================================================================
// 名称映射表
// ============================================================================

/** 六大核心属性中文名 */
const STAT_NAMES: Record<keyof Stats, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
};

/** 属性展示顺序（固定，避免 Object.keys 顺序依赖） */
const STAT_KEYS: (keyof Stats)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** 稀有度中文名 */
const RARITY_NAMES: Record<ItemRarity, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

/** 武器握持方式中文名 */
const GRIP_NAMES: Record<WeaponGrip, string> = {
  one_handed: '单手',
  off_hand: '副手',
  two_handed: '双手'
};

// ============================================================================
// 属性加成格式化
// ============================================================================

/**
 * 格式化属性加成为多行文本
 *
 * 仅展示非零属性，按固定顺序输出。正数带 `+` 前缀，负数直接显示 `-`。
 *
 * @example formatStatBonus({ str: 5, con: -2 }) → ['力量 +5', '体质 -2']
 */
export function formatStatBonus(bonus: Partial<Stats>): string[] {
  return STAT_KEYS
    .filter(k => bonus[k] !== undefined && bonus[k] !== 0)
    .map(k => {
      const v = bonus[k] as number;
      return `${STAT_NAMES[k]} ${v > 0 ? '+' : ''}${v}`;
    });
}

/** formatStatBonus 的别名（plan.md §3.6 使用 formatBonus 命名） */
export const formatBonus = formatStatBonus;

// ============================================================================
// 效果描述注册表
// ============================================================================

/**
 * 效果描述注册表：新增效果类型只需在此追加一行
 *
 * key 为 `ItemEffectType`（physical_damage / magic_damage / health_restore /
 * mana_restore / buff / debuff / stat）。
 */
const EFFECT_DESCRIBERS: Record<string, (value: number | Partial<Stats>) => string> = {
  health_restore: v => `恢复 ${v} 点生命值`,
  mana_restore: v => `恢复 ${v} 点法力值`,
  physical_damage: v => `造成 ${v} 点物理伤害`,
  magic_damage: v => `造成 ${v} 点法术伤害`,
  stat: v => (typeof v === 'number' ? '' : formatStatBonus(v).join('，')),
  buff: v => `增益效果（${v}）`,
  debuff: v => `减益效果（${v}）`
  // 新增效果类型在此追加一行
};

/**
 * 描述单个物品效果
 *
 * 未注册的效果类型降级为 `${type}: ${value}`，保证永远有输出。
 */
export function describeEffect(effect: ItemEffect): string {
  const fn = EFFECT_DESCRIBERS[effect.type];
  return fn ? fn(effect.value) : `${effect.type}: ${String(effect.value)}`;
}

// ============================================================================
// 物品描述
// ============================================================================

/**
 * 描述物品为多行文本（供物品详情面板一次性获得全部展示行）
 *
 * 输出内容：
 * - 首行：`稀有度 · 类型名`
 * - 装备：握持方式 / 占用槽位提示 / 可装备槽位 / 职业限制 / 所属套装 / 属性加成
 * - 消耗品：各使用效果
 *
 * 装备专有字段（slots/职业限制/套装）天然可见，解决旧版 U2（拿不到装备专有字段）。
 */
export function describeItem(item: Item): string[] {
  const lines: string[] = [];
  lines.push(`${RARITY_NAMES[item.rarity]} · ${getItemDisplayName(item)}`);

  if (item.kind === 'equipment') {
    // 武器展示握持方式与占用槽位
    if (item.grip) {
      lines.push(`${GRIP_NAMES[item.grip]}武器`);
      if (item.grip === 'two_handed') {
        lines.push('占用：主手 + 副手（双槽）');
      }
    }
    lines.push(`可装备槽位：${item.slots.map(s => SLOT_CONFIG[s].name).join('、')}`);
    if (item.classRestriction?.length) {
      lines.push(`职业限制：${item.classRestriction.join('、')}`);
    }
    if (item.setId) {
      lines.push(`所属套装：${item.setId}`);
    }
    lines.push(...formatStatBonus(item.bonus));
  }

  if (item.kind === 'consumable') {
    lines.push(...item.effects.map(describeEffect));
  }

  return lines;
}

// ============================================================================
// 套装进度描述
// ============================================================================

/**
 * 物品 ID → 名称解析器（describeSetProgress 用）
 *
 * P1 阶段尚无统一物品模板 Map（P3 构建），故由调用方注入名称解析器。
 * 未提供时，部件行仅展示槽位名。
 */
export type ItemNameResolver = (itemId: string) => string | undefined;

/**
 * 描述单个套装奖励效果
 *
 * `SetBonusEffect` 各变体均含 `description` 字段，直接使用；无 description 时降级为 kind 标识。
 */
export function describeSetBonusEffect(bonus: SetBonusEffect): string {
  return bonus.description ?? `效果：${bonus.kind}`;
}

/**
 * 描述套装进度为多行文本（供装备面板"套装"分区展示）
 *
 * 输出内容：
 * - 首行：`套装名（已穿/总件 件）`
 * - 各部件：`✓/○ 槽位名：装备名`（未提供名称解析器时仅展示槽位名）
 * - 已激活档位：`[已激活 N件] 效果描述`
 * - 下一档：`[还需 M 件] 效果描述`
 */
export function describeSetProgress(
  progress: SetProgress,
  resolveName?: ItemNameResolver
): string[] {
  const lines: string[] = [];
  lines.push(`${progress.setName}（${progress.equippedPieces}/${progress.totalPieces} 件）`);

  progress.partsStatus.forEach(p => {
    const slotName = SLOT_CONFIG[p.spec.slot].name;
    const itemName = p.itemId && resolveName ? (resolveName(p.itemId) ?? p.itemId) : null;
    lines.push(`  ${p.equipped ? '✓' : '○'} ${slotName}${itemName ? '：' + itemName : ''}`);
  });

  progress.activeTiers.forEach(tier => {
    tier.bonuses.forEach(b => {
      lines.push(`  [已激活 ${tier.requiredPieces}件] ${describeSetBonusEffect(b)}`);
    });
  });

  if (progress.nextTier) {
    const remain = progress.nextTier.requiredPieces - progress.equippedPieces;
    progress.nextTier.bonuses.forEach(b => {
      lines.push(`  [还需 ${remain} 件] ${describeSetBonusEffect(b)}`);
    });
  }

  return lines;
}

// ============================================================================
// 稀有度名称（导出供 UI 直接使用）
// ============================================================================

/**
 * 获取稀有度中文名
 */
export function getRarityName(rarity: ItemRarity): string {
  return RARITY_NAMES[rarity];
}

/**
 * 获取属性中文名
 */
export function getStatName(stat: keyof Stats): string {
  return STAT_NAMES[stat];
}
