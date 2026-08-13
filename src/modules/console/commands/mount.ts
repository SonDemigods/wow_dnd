/**
 * @fileoverview 坐骑类控制台命令（mount 命令组）
 * @description 提供坐骑配置的查询、列表、设置与重置功能：
 *   mount             - 查询当前坐骑配置（等同 mount query）
 *   mount query       - 查询当前坐骑配置（5 档选择状态 + 总加成）
 *   mount list [档位] - 列出可选方向（全部或指定档位）
 *   mount set <档位> <方向ID|clear> - 设置某档选择（clear 清除该档）
 *   mount reset       - 重置所有坐骑选择
 *
 * 档位参数支持三种格式：数字索引(0-4)、英文档位名(common等)、中文标签(普通等)。
 * @module console/commands/mount
 */
import { useCharacterStore } from '@/modules/character';
import { computeMountBonus, isTierUnlocked } from '@/modules/character/service';
import {
  MOUNT_TIERS,
  STAT_NAME_SHORT, // P8-302：复用 config_mounts 的属性简写，消除重复定义
  getMountOptionById,
  getMountOptionsByTier,
  getMountTierByIndex,
} from '@/data/config_mounts';
import type { Stats } from '@/modules/character/types';
import {
  registerCommand,
  requireCharacter,
  logTag,
  rarityColorKey,
  STYLE,
  type CommandResult,
} from '../framework';

// ============================================================
// 辅助函数
// ============================================================

// P8-302 修复：STAT_SHORT_LABEL 已删除，复用 config_mounts 的 STAT_NAME_SHORT

// P8-303 修复：从 MOUNT_TIERS 动态生成映射，消除硬编码重复
/** 档位中文标签 → 索引映射 */
const TIER_LABEL_TO_INDEX = new Map<string, number>(
  MOUNT_TIERS.map(t => [t.label, t.index])
);

/** 档位英文名 → 索引映射 */
const TIER_NAME_TO_INDEX = new Map<string, number>(
  MOUNT_TIERS.map(t => [t.tier, t.index])
);

/** 档位参数无效时的提示信息 */
const TIER_PARAM_HINT = '可用: 0-4 / common-uncommon-rare-epic-legendary / 普通-优秀-稀有-史诗-传说';

/**
 * 解析档位参数为索引
 *
 * 支持三种格式：
 * - 数字索引（0-4）
 * - 英文档位名（common/uncommon/rare/epic/legendary，大小写不敏感）
 * - 中文标签（普通/优秀/稀有/史诗/传说）
 *
 * @returns 合法索引或 null（非法输入）
 */
function parseTierIndex(input: string): number | null {
  // 数字索引
  const num = parseInt(input, 10);
  if (!isNaN(num) && num >= 0 && num < MOUNT_TIERS.length) {
    return num;
  }
  // 英文名（大小写不敏感）
  const lower = input.toLowerCase();
  // P8-303 修复：使用 Map API 替代 in 运算符
  const nameIndex = TIER_NAME_TO_INDEX.get(lower);
  if (nameIndex !== undefined) {
    return nameIndex;
  }
  // 中文标签
  const labelIndex = TIER_LABEL_TO_INDEX.get(input);
  if (labelIndex !== undefined) {
    return labelIndex;
  }
  return null;
}

/**
 * 将 bonus 对象格式化为可读字符串
 *
 * 如 `{ str: 2 }` → `+2 力`，`{ str: 6, con: 6 }` → `+6 力, +6 体`
 * 空对象返回 `'无加成'`。
 */
function formatBonus(bonus: Partial<Stats>): string {
  // Object.keys 返回 string[]，TS 语言限制无法静态推断为 (keyof Stats)[]。
  // bonus 类型为 Partial<Stats>，键已由类型保证为 keyof Stats，断言是合理 workaround。
  const keys = Object.keys(bonus) as (keyof Stats)[];
  if (keys.length === 0) return '无加成';
  return keys
    .map(k => `+${bonus[k] ?? 0} ${STAT_NAME_SHORT[k]}`) // P8-302：复用 config_mounts 的 STAT_NAME_SHORT
    .join(', ');
}

/**
 * 输出单档坐骑配置行
 *
 * 根据档位解锁状态和已选方向，输出不同样式的行：
 * - 未解锁：灰色提示 `(未解锁)`
 * - 已解锁未选：灰色提示 `(未选择)`
 * - 已选：显示方向 ID、名称和 bonus
 */
function logTierRow(tierIndex: number, level: number, choice: string | null | undefined): void {
  const tierMeta = getMountTierByIndex(tierIndex);
  if (!tierMeta) return;
  const unlocked = isTierUnlocked(tierIndex, level);
  const tierColor = rarityColorKey(tierMeta.tier);
  const tierLabel = `${tierMeta.label}(${tierMeta.unlockLevel}级)`;

  if (!unlocked) {
    console.log(`  %c[${tierIndex}] ${tierLabel}%c (未解锁)`, tierColor, STYLE.hint);
    return;
  }

  if (!choice) {
    console.log(`  %c[${tierIndex}] ${tierLabel}%c (未选择)`, tierColor, STYLE.hint);
    return;
  }

  const option = getMountOptionById(choice);
  if (!option) {
    console.log(`  %c[${tierIndex}] ${tierLabel}%c ${choice} (无效方向)`, tierColor, STYLE.err);
    return;
  }

  console.log(
    `  %c[${tierIndex}] ${tierLabel}%c ${option.id}  ${option.name}  ${formatBonus(option.bonus)}`,
    tierColor, STYLE.value
  );
}

/**
 * 输出指定档位的全部可选方向
 *
 * 展示档位元数据（解锁等级、方向类型、点数包）和该档所有方向的 ID、名称、bonus。
 */
function logTierOptions(tierIndex: number): void {
  const tierMeta = getMountTierByIndex(tierIndex);
  if (!tierMeta) return;
  const tierColor = rarityColorKey(tierMeta.tier);
  const dirType = tierMeta.directionType === 'single' ? '单属性' : '双属性';
  logTag(
    'mount',
    `═══ ${tierMeta.label}档 (${tierMeta.unlockLevel}级解锁, ${dirType}, 点数包 ${tierMeta.bonusTotal}) ═══`
  );
  const options = getMountOptionsByTier(tierMeta.tier);
  for (const opt of options) {
    console.log(
      `  %c${opt.id.padEnd(20)}%c ${opt.name}  ${formatBonus(opt.bonus)}`,
      tierColor, STYLE.value
    );
  }
}

// ============================================================
// 命令注册
// ============================================================

/**
 * 坐骑配置管理命令
 *
 * 通过子命令路由到不同的处理函数：
 * - `query`：查询当前坐骑配置与总加成
 * - `list`：列出可选方向（全部或指定档位）
 * - `set`：设置某档选择
 * - `reset`：重置所有坐骑选择
 *
 * 无参数时默认执行 `query`。
 */
registerCommand({
  name: 'mount',
  category: 'character',
  description: '坐骑配置管理（查询/列表/设置/重置）',
  usage: 'mount <query|list|set|reset> [参数]  (无参数等同 query)',
  async handler(args) {
    const sub = (args[0] || 'query').toLowerCase();

    switch (sub) {
      case 'query':
        return handleQuery();
      case 'list':
        return handleList(args.slice(1));
      case 'set':
        return handleSet(args.slice(1));
      case 'reset':
        return handleReset();
      default:
        return {
          success: false,
          message: `未知子命令: ${sub}，可用: query / list / set / reset`,
        };
    }
  },
});

// ============================================================
// 子命令实现
// ============================================================

/**
 * mount query：查询当前坐骑配置与总加成
 *
 * 输出 5 档的选择状态（未解锁/未选择/已选方向详情）和累加后的总加成。
 * 需确保已选中角色，否则返回失败。
 */
function handleQuery(): CommandResult {
  const req = requireCharacter();
  if (!req.ok) return req.result;
  const char = req.character;

  logTag('mount', `═══ 坐骑配置（Lv.${char.level}）═══`);
  for (let i = 0; i < MOUNT_TIERS.length; i++) {
    logTierRow(i, char.level, char.mountChoices[i]);
  }

  const totalBonus = computeMountBonus(char.mountChoices);
  // Object.keys 返回 string[]，TS 语言限制无法静态推断为 (keyof Stats)[]。
  // totalBonus 类型为 Partial<Stats>，键已由类型保证为 keyof Stats，断言是合理 workaround。
  const bonusKeys = Object.keys(totalBonus) as (keyof Stats)[];
  if (bonusKeys.length > 0) {
    logTag('mount', '═══ 总加成 ═══');
    console.log(`  %c${formatBonus(totalBonus)}`, STYLE.value);
  } else {
    console.log(`  %c(暂无坐骑加成)`, STYLE.hint);
  }

  return { success: true, message: '已在上方显示坐骑配置' };
}

/**
 * mount list [档位]：列出可选方向
 *
 * 无参数时列出全部 5 档的方向；指定档位时仅列出该档方向。
 * 档位参数支持数字索引、英文名、中文标签（见 parseTierIndex）。
 */
function handleList(args: string[]): CommandResult {
  // 无参数：列出全部档位
  if (args.length === 0) {
    for (const tierMeta of MOUNT_TIERS) {
      logTierOptions(tierMeta.index);
    }
    return { success: true, message: '已在上方列出全部坐骑方向' };
  }

  // 指定档位
  const tierIndex = parseTierIndex(args[0]);
  if (tierIndex === null) {
    return { success: false, message: `无效档位: ${args[0]}，${TIER_PARAM_HINT}` };
  }
  logTierOptions(tierIndex);
  const tierMeta = getMountTierByIndex(tierIndex)!;
  return { success: true, message: `已在上方列出${tierMeta.label}档坐骑方向` };
}

/**
 * mount set <档位> <方向ID|clear>：设置某档选择
 *
 * 流程：
 * 1. 校验参数完整性
 * 2. 校验角色存在
 * 3. 解析档位参数
 * 4. 预校验方向合法性（ID 有效、tier 匹配），提供友好错误提示
 * 5. 调用 store.setMountChoice（内部校验档位解锁并应用 bonus）
 * 6. 捕获 store 抛出的错误（如档位未解锁）转为失败结果
 *
 * `clear` 关键字表示清除该档选择（传 null 给 setMountChoice）。
 */
async function handleSet(args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: '用法: mount set <档位> <方向ID|clear>，如 mount set 0 common_str',
    };
  }

  const req = requireCharacter();
  if (!req.ok) return req.result;

  const tierIndex = parseTierIndex(args[0]);
  if (tierIndex === null) {
    return { success: false, message: `无效档位: ${args[0]}，${TIER_PARAM_HINT}` };
  }

  const tierMeta = getMountTierByIndex(tierIndex)!;
  const isClear = args[1].toLowerCase() === 'clear';
  const optionId = isClear ? null : args[1];

  // 预校验方向合法性（不检查档位解锁，由 setMountChoice 内部处理）
  if (optionId !== null) {
    const option = getMountOptionById(optionId);
    if (!option) {
      return { success: false, message: `无效坐骑方向: ${optionId}` };
    }
    if (option.tier !== tierMeta.tier) {
      return {
        success: false,
        message: `方向 ${option.name}（${optionId}）不属于${tierMeta.label}档`,
      };
    }
  }

  try {
    await useCharacterStore().setMountChoice(tierIndex, optionId);
    if (optionId === null) {
      return { success: true, message: `已清除${tierMeta.label}档的坐骑选择` };
    }
    const option = getMountOptionById(optionId)!;
    return {
      success: true,
      message: `已设置${tierMeta.label}档为 ${option.name}（${optionId}）`,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * mount reset：重置所有坐骑选择
 *
 * 调用 store.resetMountChoices 清空全部 5 档选择并扣除对应 bonus。
 * 需确保已选中角色，否则返回失败。
 */
async function handleReset(): Promise<CommandResult> {
  const req = requireCharacter();
  if (!req.ok) return req.result;
  await useCharacterStore().resetMountChoices();
  return { success: true, message: '已重置所有坐骑选择' };
}

/** 命令模块标记导出，便于汇总注册器识别 */
export const __mountCommandsLoaded = true;
