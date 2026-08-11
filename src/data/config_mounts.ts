/**
 * @fileoverview 坐骑方向配置数据
 * @description
 *   【数据分层归属：A 层 · 编译期固定纯配置源】
 *   不进 IndexedDB，admin 后台不可编辑。原因：坐骑选项由程序化生成（5 个品质档的多选一组合），
 *   玩家选择持久化在 `char_data.mountChoices`（C 层），本文件仅提供可选方向定义与点数包规格，
 *   运行时由 character 模块直接 import 调用。
 *
 *   单槽位被动效果载体，通过 5 个品质档的多选一组合提供策略深度。
 *   每个档位提供一组方向供玩家选择其一，最终坐骑 bonus = 5 档选择叠加。
 *
 *   档位结构（plan.md §2.1）：
 *   - common（普通，1 级解锁）：单属性方向，6 选 1，点数包 2
 *   - uncommon（优秀，5 级解锁）：单属性方向，6 选 1，点数包 4
 *   - rare（稀有，10 级解锁）：单属性方向，6 选 1，点数包 6
 *   - epic（史诗，15 级解锁）：双属性方向，9 选 1，点数包 12（+6/+6）
 *   - legendary（传说，20 级解锁）：双属性方向，9 选 1，点数包 16（+8/+8）
 *
 *   满级 5 档点数包总和 = 2 + 4 + 6 + 12 + 16 = 40（plan.md §1.2 约束）
 *
 *   双属性方向约束（plan.md §2.2）：3 主攻（str/dex/int）× 3 次属性（con/wis/cha）= 9 组合，
 *   主攻属性间不可组合（避免力+智等矛盾流派）。
 *
 *   实现说明：36 个 MountOption 由程序化生成（buildMountOptions），避免手写出错；
 *   方向元数据（名称/图标/描述）集中在 DIRECTION_META，便于维护。
 *
 * @module data
 */
import type { Stats } from '@/modules/character/types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 坐骑品质档（参考物品品质命名，见 styles/variables.less）
 * - common(普通) / uncommon(优秀) / rare(稀有) / epic(史诗) / legendary(传说)
 */
export type MountTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * 坐骑方向类型
 * - 单属性方向（前 3 档）：6 个，力/敏/智/体/感/魅各一
 * - 双属性方向（后 2 档）：9 个，3 主攻(力/敏/智) × 3 次属性(体/感/魅)
 *   约束：主攻属性间不可组合
 */
export type MountDirection =
  // 单属性方向（前 3 档）
  | 'str' | 'dex' | 'int' | 'con' | 'wis' | 'cha'
  // 双属性方向（后 2 档）：主攻 + 次属性
  | 'str_con' | 'str_wis' | 'str_cha'
  | 'dex_con' | 'dex_wis' | 'dex_cha'
  | 'int_con' | 'int_wis' | 'int_cha';

/**
 * 坐骑方向定义（单档单方向）
 *
 * @property id - 唯一 ID，格式 `${tier}_${direction}`，如 `common_str`、`epic_str_con`
 * @property tier - 品质档
 * @property direction - 方向
 * @property name - 显示名称（"档位前缀 + 方向名"组成）
 * @property icon - 图标（Iconify 格式）
 * @property description - 描述
 * @property bonus - 属性加成（直接传给 applyBonus/removeBonus）
 */
export interface MountOption {
  id: string;
  tier: MountTier;
  direction: MountDirection;
  name: string;
  icon: string;
  description: string;
  bonus: Partial<Stats>;
}

// ============================================================================
// 档位元数据
// ============================================================================

/**
 * 品质档元数据
 *
 * 前三档为单属性方向，后两档为双属性方向。
 * bonusTotal 为该档点数包总值（单属性方向全加单一属性；双属性方向平分到两属性）。
 */
export interface MountTierMeta {
  tier: MountTier;
  /** 档位索引（0-4，对应 mountChoices 数组下标） */
  index: number;
  /** 解锁等级 */
  unlockLevel: number;
  /** 显示标签 */
  label: string;
  /** 方向类型 */
  directionType: 'single' | 'dual';
  /** 该档点数包总值 */
  bonusTotal: number;
}

export const MOUNT_TIERS: readonly MountTierMeta[] = [
  { tier: 'common',    index: 0, unlockLevel: 1,  label: '普通', directionType: 'single', bonusTotal: 2 },
  { tier: 'uncommon',  index: 1, unlockLevel: 5,  label: '优秀', directionType: 'single', bonusTotal: 4 },
  { tier: 'rare',      index: 2, unlockLevel: 10, label: '稀有', directionType: 'single', bonusTotal: 6 },
  { tier: 'epic',      index: 3, unlockLevel: 15, label: '史诗', directionType: 'dual',   bonusTotal: 12 },
  { tier: 'legendary', index: 4, unlockLevel: 20, label: '传说', directionType: 'dual',   bonusTotal: 16 },
] as const;

/** 单属性方向列表（前 3 档可用） */
export const SINGLE_DIRECTIONS: readonly MountDirection[] = [
  'str', 'dex', 'int', 'con', 'wis', 'cha'
] as const;

/** 双属性方向列表（后 2 档可用） */
export const DUAL_DIRECTIONS: readonly MountDirection[] = [
  'str_con', 'str_wis', 'str_cha',
  'dex_con', 'dex_wis', 'dex_cha',
  'int_con', 'int_wis', 'int_cha'
] as const;

// ============================================================================
// 方向元数据（名称 / 图标 / 描述 / 流派定位）
// ============================================================================

interface DirectionMeta {
  /** 方向名（不含档位前缀，与前缀拼接得到完整显示名） */
  name: string;
  /** 图标（Iconify 格式） */
  icon: string;
  /** 描述（不含数值，数值由档位 bonusTotal 决定） */
  description: string;
}

const DIRECTION_META: Record<MountDirection, DirectionMeta> = {
  // 单属性方向
  str: { name: '力量专精', icon: 'game-icons:muscle-up',      description: '专精力量训练，提升物理攻击向基础属性' },
  dex: { name: '敏捷专精', icon: 'game-icons:dodging',        description: '专精敏捷训练，提升暴击与闪避向基础属性' },
  int: { name: '智力专精', icon: 'game-icons:brain',          description: '专精智力训练，提升法术伤害向基础属性' },
  con: { name: '体质专精', icon: 'game-icons:health-normal',  description: '专精体质训练，提升生命耐力向基础属性' },
  wis: { name: '感知专精', icon: 'game-icons:eye-target',     description: '专精感知训练，提升治疗法力向基础属性' },
  cha: { name: '魅力专精', icon: 'game-icons:charm',          description: '专精魅力训练，提升辅助召唤向基础属性' },
  // 双属性方向（力系）
  str_con: { name: '蛮力体魄', icon: 'game-icons:shield',       description: '近战坦克流派：力量 + 体质，兼顾输出与生存' },
  str_wis: { name: '蛮勇信仰', icon: 'game-icons:prayer',       description: '物理治疗流派：力量 + 感知，混合战士与治疗' },
  str_cha: { name: '蛮力领袖', icon: 'game-icons:convince',   description: '圣印战士流派：力量 + 魅力，圣骑向专精' },
  // 双属性方向（敏系）
  dex_con: { name: '灵巧体魄', icon: 'game-icons:acrobatic',    description: '敏捷坦克流派：敏捷 + 体质，武僧/猎人向' },
  dex_wis: { name: '灵思自然', icon: 'game-icons:leaf-skeleton', description: '敏捷治疗流派：敏捷 + 感知，德鲁伊向专精' },
  dex_cha: { name: '灵巧魅影', icon: 'game-icons:ninja-mask',   description: '敏捷辅助流派：敏捷 + 魅力，潜行者混合向' },
  // 双属性方向（智系）
  int_con: { name: '奥术体魄', icon: 'game-icons:crystal-shine', description: '法术坦克流派：智力 + 体质，术士向专精' },
  int_wis: { name: '奥术信仰', icon: 'game-icons:scroll-unfurled', description: '法术治疗流派：智力 + 感知，双系施法向' },
  int_cha: { name: '奥术领袖', icon: 'game-icons:orb-wand',  description: '法术召唤流派：智力 + 魅力，术士/龙脉向' },
};

// ============================================================================
// 档位前缀与 bonus 数值映射
// ============================================================================

/** 显示名称前缀（与方向名拼接为完整显示名，见 plan.md §7.3） */
const TIER_PREFIX: Record<MountTier, string> = {
  common: '初阶',
  uncommon: '进阶',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

/**
 * 单属性方向各档 bonus 数值
 * 单属性方向点数全加单一属性，bonusTotal 即单属性加成值
 */
const SINGLE_BONUS_VALUE: Record<MountTier, number> = {
  common: 2,
  uncommon: 4,
  rare: 6,
  // epic/legendary 不使用单属性方向
  epic: 0,
  legendary: 0,
};

/**
 * 双属性方向各档单属性 bonus 数值
 * 双属性方向点数平分到两属性，单属性值 = bonusTotal / 2
 */
const DUAL_BONUS_VALUE: Record<MountTier, number> = {
  // common/uncommon/rare 不使用双属性方向
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 6,
  legendary: 8,
};

// ============================================================================
// 程序化生成 36 个 MountOption
// ============================================================================

/** 属性简写（用于描述拼装，与 STAT_NAMES 完整名区分） */
// P8-302 修复：export 供 mount.ts 复用，消除 STAT_SHORT_LABEL 重复定义
export const STAT_NAME_SHORT: Record<keyof Stats, string> = {
  str: '力',
  dex: '敏',
  con: '体',
  int: '智',
  wis: '感',
  cha: '魅',
};

/**
 * 根据方向构造 Partial<Stats> bonus
 * - 单属性方向：全加单一属性
 * - 双属性方向：平分到两属性（str_con → { str, con }）
 */
function buildBonus(direction: MountDirection, singleValue: number, dualValue: number): Partial<Stats> {
  // 单属性方向
  if ((SINGLE_DIRECTIONS as readonly string[]).includes(direction)) {
    return { [direction]: singleValue } as Partial<Stats>;
  }
  // 双属性方向：str_con → ['str', 'con']
  const [a, b] = direction.split('_') as (keyof Stats)[];
  return { [a]: dualValue, [b]: dualValue } as Partial<Stats>;
}

/** 构造描述：在方向描述后追加具体数值 */
function buildDescription(direction: MountDirection, singleValue: number, dualValue: number): string {
  const meta = DIRECTION_META[direction];
  const bonus = buildBonus(direction, singleValue, dualValue);
  const parts = (Object.keys(bonus) as (keyof Stats)[])
    .map(key => `+${bonus[key]} ${STAT_NAME_SHORT[key]}`);
  return `${meta.description}（${parts.join('，')}）`;
}

/**
 * 程序化生成全量 MountOption 列表
 *
 * 生成规则：遍历 5 档，每档按 directionType 取对应方向列表，
 * 用档位 bonusTotal 计算单/双属性 bonus 值，拼装为完整 MountOption。
 */
function buildMountOptions(): MountOption[] {
  const options: MountOption[] = [];
  for (const tierMeta of MOUNT_TIERS) {
    const directions = tierMeta.directionType === 'single' ? SINGLE_DIRECTIONS : DUAL_DIRECTIONS;
    const singleValue = SINGLE_BONUS_VALUE[tierMeta.tier];
    const dualValue = DUAL_BONUS_VALUE[tierMeta.tier];
    for (const direction of directions) {
      const meta = DIRECTION_META[direction];
      options.push({
        id: `${tierMeta.tier}_${direction}`,
        tier: tierMeta.tier,
        direction,
        name: `${TIER_PREFIX[tierMeta.tier]}${meta.name}`,
        icon: meta.icon,
        description: buildDescription(direction, singleValue, dualValue),
        bonus: buildBonus(direction, singleValue, dualValue),
      });
    }
  }
  return options;
}

/**
 * 全量坐骑方向列表（36 个：前 3 档 × 6 单属性 + 后 2 档 × 9 双属性）
 */
export const MOUNT_OPTIONS: readonly MountOption[] = buildMountOptions();

// ============================================================================
// 查询函数
// ============================================================================

/** ID → MountOption 索引（启动时构建一次，O(1) 查询） */
const MOUNT_OPTION_MAP: ReadonlyMap<string, MountOption> = new Map(
  MOUNT_OPTIONS.map(o => [o.id, o])
);

/** 档位 → MountOption 列表 索引（启动时构建一次，O(1) 查询） */
const MOUNT_OPTIONS_BY_TIER: ReadonlyMap<MountTier, MountOption[]> = (() => {
  const map = new Map<MountTier, MountOption[]>();
  for (const tierMeta of MOUNT_TIERS) {
    map.set(tierMeta.tier, MOUNT_OPTIONS.filter(o => o.tier === tierMeta.tier));
  }
  return map;
})();

/**
 * 根据 ID 查询坐骑方向
 * @param id - 方向 ID（如 `common_str`、`epic_str_con`）
 * @returns 对应的 MountOption，不存在时返回 undefined
 */
export function getMountOptionById(id: string): MountOption | undefined {
  return MOUNT_OPTION_MAP.get(id);
}

/**
 * 查询指定档位的全部方向
 * @param tier - 品质档
 * @returns 该档所有方向列表（单属性档 6 个，双属性档 9 个）
 */
export function getMountOptionsByTier(tier: MountTier): MountOption[] {
  return MOUNT_OPTIONS_BY_TIER.get(tier) ?? [];
}

/**
 * 根据档位索引查询档位元数据
 * @param index - 档位索引（0-4）
 * @returns 档位元数据，越界时返回 undefined
 */
export function getMountTierByIndex(index: number): MountTierMeta | undefined {
  return MOUNT_TIERS[index];
}

// ============================================================================
// 开发环境数据完整性校验
// ============================================================================

/**
 * 校验坐骑方向配置完整性
 *
 * 校验项：
 * 1. 数量校验：36 个（3 档 × 6 单属性 + 2 档 × 9 双属性）
 * 2. ID 唯一性
 * 3. bonus 与档位 bonusTotal 一致性（单属性：单值 = bonusTotal；双属性：两值之和 = bonusTotal）
 * 4. 双属性方向的主攻属性不在次属性位（避免 str_str 等退化组合）
 *
 * @returns 校验通过的方向数量；若存在问题，会在控制台输出错误日志
 */
export function validateMountOptions(): number {
  const errors: string[] = [];

  // 1. 数量校验
  const expected = SINGLE_DIRECTIONS.length * 3 + DUAL_DIRECTIONS.length * 2;
  if (MOUNT_OPTIONS.length !== expected) {
    errors.push(`方向数量 ${MOUNT_OPTIONS.length} 与预期 ${expected} 不符`);
  }

  // 2. ID 唯一性
  const seenIds = new Set<string>();
  for (const opt of MOUNT_OPTIONS) {
    if (seenIds.has(opt.id)) {
      errors.push(`方向 ID "${opt.id}" 重复定义`);
    }
    seenIds.add(opt.id);
  }

  // 3. bonus 与档位 bonusTotal 一致性
  for (const opt of MOUNT_OPTIONS) {
    const tierMeta = MOUNT_TIERS.find(t => t.tier === opt.tier);
    if (!tierMeta) {
      errors.push(`方向 ${opt.id} 的 tier "${opt.tier}" 不存在于 MOUNT_TIERS`);
      continue;
    }
    const bonusSum = (Object.values(opt.bonus) as number[]).reduce((a, b) => a + b, 0);
    if (bonusSum !== tierMeta.bonusTotal) {
      errors.push(`方向 ${opt.id} 的 bonus 总和 ${bonusSum} 与档位 ${tierMeta.tier} 的 bonusTotal ${tierMeta.bonusTotal} 不符`);
    }
    // 双属性方向应恰好两个属性键，且两值相等（平分）
    if (tierMeta.directionType === 'dual') {
      const keys = Object.keys(opt.bonus);
      if (keys.length !== 2) {
        errors.push(`方向 ${opt.id} 应为双属性方向，但 bonus 包含 ${keys.length} 个属性键`);
      } else {
        const vals = Object.values(opt.bonus) as number[];
        if (vals[0] !== vals[1]) {
          errors.push(`方向 ${opt.id} 双属性值不相等（${vals[0]} vs ${vals[1]}），违反"平分"约定`);
        }
      }
    }
  }

  // 4. 5 档点数包总和 = 40（plan.md §1.2 约束）
  const totalBonus = MOUNT_TIERS.reduce((sum, t) => sum + t.bonusTotal, 0);
  if (totalBonus !== 40) {
    errors.push(`5 档点数包总和 ${totalBonus} 与约束 40 不符（plan.md §1.2）`);
  }

  if (errors.length > 0) {
    console.error(`[数据校验] 坐骑方向配置存在 ${errors.length} 处问题:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 坐骑方向配置校验通过：${MOUNT_OPTIONS.length} 个方向，5 档点数包总和 ${totalBonus}`);
  }

  return MOUNT_OPTIONS.length - errors.length;
}

// 开发环境自动执行校验（生产环境构建时 import.meta.env.DEV 为 false，整段会被 tree-shaking）
if (import.meta.env.DEV) {
  validateMountOptions();
}
