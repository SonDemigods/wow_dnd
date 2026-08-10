/**
 * 探索模块配置常量
 *
 * 集中定义探索模块使用的所有数值常量，避免在 service.ts / store.ts 中硬编码魔法数字。
 * 修改游戏平衡性参数时只需调整本文件，无需改动业务逻辑。
 *
 * 涵盖：网格尺寸、事件概率分布、营地恢复、陷阱伤害、随机事件效果、
 * 物品池构建、多选项事件触发、隐藏房间数量、兜底奖励等。
 */

// ==================== 网格生成 ====================

/** 网格默认尺寸（10×10 的二维网格） */
export const GRID_SIZE = 10;

// ==================== 迷宫生成（generateMazeWalls） ====================
// 迷宫化：在网格上生成墙结构，将"格子集合"转化为"迷宫通道"。
// 算法：DFS 完美迷宫骨架（封全部非树边，最多死路）+ 按密度额外开通捷径（环路）。
//
// 密度语义说明（与计划文档 §5 注释方向相反，经核对确认）：
//   - MAZE_WALL_DENSITY 表示"在完美迷宫骨架上额外开通捷径的比例"。
//   - 0 = 完美迷宫（最多死路、无环路）；值越大捷径越多、死路越少；1 = 全开放。
//   - 计划文档 §5 原注释"高值生成更多死路"与"封墙概率"描述，和 §4 步骤A"完美迷宫"
//     在数学上冲突（完美迷宫封树边必断连）。本实现采用"骨架+捷径"等价正确语义，
//     使默认值 0.15 能产出真实迷宫感（约 85% 非树边保持封墙）。
//   - 若需恢复"高值=更多死路"方向，可将默认值改为 0.85 并以 (1 - density) 计算。

/** 完美迷宫骨架上额外开通捷径的比例（0=完美迷宫最多死路，1=全开放） */
export const MAZE_WALL_DENSITY = 0.15;
/** 迷宫生成迭代尝试次数上限（防御性兜底，DFS 树保证连通，实际极少触发） */
export const MAZE_MAX_RETRY = 200;

// ==================== 视线（computeVision / applyVision） ====================
// 阶段三：视线与分层揭示。玩家移动后从当前位置向 4 正方向发射直线射线，
// 扫到的格子标记为 discovered（模糊可见），墙后格子不可见。
// discovered 只增不减（曾发现的格保持可见），explored 恒蕴含 discovered。

/** 视线最大距离（格数）。10×10 网格下约覆盖 25% 视野，保留足够探索余量 */
export const VISION_RANGE = 3;

// ==================== Boss 封印（阶段四） ====================
// Boss 格初始 sealed=true，触发战斗前检查解锁条件。
// 解锁前点击 Boss 格不触发战斗，UI 显示锁形图标 + 红色警告色（"看得见打不到"的目标感）。
// 解锁条件A：visitedCells >= BOSS_SEAL_REQUIRED_CELLS（约 1/3 网格，强制充分探索）。
// 解锁条件B（选配）：已击败守卫怪数量 >= GUARD_MONSTER_COUNT；0 表示不启用守卫怪方案。

/** Boss 封印解除所需已探索格数（建议 30，约 10×10 网格的 1/3） */
export const BOSS_SEAL_REQUIRED_CELLS = 30;
/** 区域守卫怪数量（Boss 封印解锁条件B，0 表示不启用守卫怪方案） */
export const GUARD_MONSTER_COUNT = 0;

// ==================== 陷阱视觉线索（阶段四） ====================
// 生成时按 TRAP_HINT_PROBABILITY 给 trap 格打 hint=true。
// discovered 层：hint 格显示"可疑地面"暗色裂纹图标（弱提示，不明确揭示"陷阱"）；
// 非 hint 陷阱格完全无提示。落入陷阱的伤害结算逻辑不变（generateTrapDamage 不区分 hint）。
// 设计意图：给读图玩家"技巧空间"，但保留 (1-概率) 的未知风险，避免陷阱退化为纯信息题。

/** 陷阱格带视觉线索的概率（0~1，0.4 表示 40% 陷阱格有弱提示） */
export const TRAP_HINT_PROBABILITY = 0.4;

// ==================== 怪物索敌警告（阶段四，可选） ====================
// monster 格 discovered 后，若玩家与怪物曼哈顿距离 ≤ ENEMY_ALERT_RANGE 且路径可通行，
// UI 显示红色跳动警告框（由 ExplorationView.vue 计算，不进入 store，保持纯展示）。
// 玩家可据此选择绕路还是硬刚，强化"探索路径选择"。

/** 怪物索敌警告触发距离（曼哈顿距离，格数） */
export const ENEMY_ALERT_RANGE = 2;

// ==================== 区域专属事件（阶段四） ====================
// 事件格触发时按 AREA_EVENT_MIX_PROBABILITY 从区域专属事件池选取，否则走通用事件。
// 区域专属事件以 RandomEventResult 形态存储于 src/data/config_area_events.ts，
// 复用 effectHandlers 注册表结算，不新增效果类型。让"这个区域"有专属事件记忆点。

/** 事件格触发时从区域专属事件池选取的概率（0~1，0.5 表示 50% 走区域事件） */
export const AREA_EVENT_MIX_PROBABILITY = 0.5;

// ==================== 事件概率分布（computeEventProbability） ====================
// 各事件类型在网格生成时的出现概率（百分比），由区域等级动态计算。
// 归一化后五项之和恒为 100。

/** 怪物事件概率基础值（最终概率 = min(MAX, BASE + LEVEL_COEFF × avgLevel)） */
export const MONSTER_PROBABILITY_BASE = 20;
/** 怪物事件概率随等级提升系数（每级增加的百分比） */
export const MONSTER_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 怪物事件概率上限（百分比） */
export const MONSTER_PROBABILITY_MAX = 25;

/** 物品事件概率基础值（最终概率 = max(MIN, BASE - LEVEL_COEFF × avgLevel)） */
export const ITEM_PROBABILITY_BASE = 25;
/** 物品事件概率随等级下降系数（每级减少的百分比） */
export const ITEM_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 物品事件概率下限（百分比） */
export const ITEM_PROBABILITY_MIN = 15;

/** 陷阱事件概率基础值 */
export const TRAP_PROBABILITY_BASE = 12;
/** 陷阱事件概率随等级提升系数 */
export const TRAP_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 陷阱事件概率上限（百分比） */
export const TRAP_PROBABILITY_MAX = 18;

/** 随机事件固定概率（百分比，不随等级变化） */
export const EVENT_PROBABILITY = 15;

/** 空事件概率基础值（P3-133 修复：原值 30 导致五项基础值之和为 102，调整为 28 使总和等于归一化基数 100） */
export const EMPTY_PROBABILITY_BASE = 28;
/** 空事件概率随等级下降系数 */
export const EMPTY_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 空事件概率下限（百分比） */
export const EMPTY_PROBABILITY_MIN = 15;

/** 概率归一化基数（各项百分比之和的目标值） */
export const PROBABILITY_NORMALIZATION_BASE = 100;

// P3-133 修复：开发期聚合校验概率常量合法性
if (import.meta.env.DEV) {
  const _probBaseSum =
    MONSTER_PROBABILITY_BASE +
    ITEM_PROBABILITY_BASE +
    TRAP_PROBABILITY_BASE +
    EVENT_PROBABILITY +
    EMPTY_PROBABILITY_BASE;
  if (_probBaseSum !== PROBABILITY_NORMALIZATION_BASE) {
    console.warn(
      `[exploration config] 概率基础值之和 (${_probBaseSum}) 不等于归一化基数 (${PROBABILITY_NORMALIZATION_BASE})，` +
      `可能导致归一化后概率分布异常`
    );
  }
}

// ==================== 营地恢复（generateCampHeal） ====================

// P3-132 修复：原值 9999 为魔法数字，改用 Number.MAX_SAFE_INTEGER 表示"完全恢复"，
// 由角色上限（maxHp / maxMana）自然裁剪，避免硬编码上限被未来数值突破。
/** 营地恢复 HP（标记为完全恢复的大数值，由角色上限裁剪） */
export const CAMP_HEAL_HP = Number.MAX_SAFE_INTEGER;
/** 营地恢复 MP（标记为完全恢复的大数值，由角色上限裁剪） */
export const CAMP_HEAL_MANA = Number.MAX_SAFE_INTEGER;

// ==================== 陷阱伤害（generateTrapDamage） ====================

/** 陷阱基础伤害系数（baseDamage = areaLevel × 此值） */
export const TRAP_DAMAGE_BASE = 5;
/** 陷阱伤害波动范围（伤害在 ±variance/2 之间随机） */
export const TRAP_DAMAGE_VARIANCE = 10;
/** 陷阱伤害最小值（最终伤害不低于此值） */
export const TRAP_DAMAGE_MIN = 1;

// ==================== 随机事件概率阈值（generateRandomEvent） ====================
// 采用累进概率区间分布：每个分支检查 [0, 1) 中的特定区间，区间大小即为该事件的触发概率。
// 分支按概率从高到低排列，最后一个分支作为兜底。

/** 随机事件恢复生命概率上限（[0, 0.3) → 30% 概率） */
export const RANDOM_EVENT_HEAL_THRESHOLD = 0.3;
/** 随机事件恢复法力概率上限（[0.3, 0.5) → 20% 概率） */
export const RANDOM_EVENT_MANA_THRESHOLD = 0.5;
/** 随机事件获得经验概率上限（[0.5, 0.65) → 15% 概率） */
export const RANDOM_EVENT_EXP_THRESHOLD = 0.65;
/** 随机事件受伤概率上限（[0.65, 0.8) → 15% 概率） */
export const RANDOM_EVENT_DAMAGE_THRESHOLD = 0.8;
/** 随机事件损失法力概率上限（[0.8, 0.9) → 10% 概率） */
export const RANDOM_EVENT_MP_LOSS_THRESHOLD = 0.9;
// 金币事件为兜底分支 [0.9, 1.0) → 10% 概率

// ==================== 随机事件效果数值（generateRandomEvent） ====================

/** 随机事件恢复生命：等级系数（amount = areaLevel × 此值 + random(0, MAX)） */
export const HEAL_AMOUNT_LEVEL_COEFFICIENT = 3;
/** 随机事件恢复生命：随机加成上限 */
export const HEAL_AMOUNT_RANDOM_MAX = 10;

/** 随机事件恢复法力：等级系数 */
export const MANA_AMOUNT_LEVEL_COEFFICIENT = 2;
/** 随机事件恢复法力：随机加成上限 */
export const MANA_AMOUNT_RANDOM_MAX = 8;

/** 随机事件经验奖励：等级系数 */
export const EXP_AMOUNT_LEVEL_COEFFICIENT = 10;
/** 随机事件经验奖励：随机加成上限 */
export const EXP_AMOUNT_RANDOM_MAX = 20;

/** 随机事件伤害：等级系数 */
export const DAMAGE_AMOUNT_LEVEL_COEFFICIENT = 2;
/** 随机事件伤害：随机加成上限 */
export const DAMAGE_AMOUNT_RANDOM_MAX = 5;

/** 随机事件法力损失：等级系数 */
export const MP_LOSS_LEVEL_COEFFICIENT = 1.5;
/** 随机事件法力损失：随机加成上限 */
export const MP_LOSS_RANDOM_MAX = 5;

/** 随机事件金币奖励：等级系数 */
export const GOLD_AMOUNT_LEVEL_COEFFICIENT = 5;
/** 随机事件金币奖励：随机加成上限 */
export const GOLD_AMOUNT_RANDOM_MAX = 15;

// ==================== 多选项事件触发概率（handleRandomEventTriggered） ====================

/** 多选项事件触发概率（30% 概率生成多选项事件，否则生成普通随机事件） */
export const MULTI_OPTION_EVENT_PROBABILITY = 0.3;

// ==================== 物品池构建（buildItemPool） ====================

/** 物品池默认最大数量 */
export const ITEM_POOL_DEFAULT_MAX_SIZE = 5;
/** 物品池为空时的兜底物品 ID */
export const ITEM_POOL_FALLBACK_ID = 'small_health_potion';

/** 稀有度等级映射（用于推算物品等级） */
export const RARITY_LEVEL_MAP: Record<string, number> = {
  common: 1,
  uncommon: 3,
  rare: 5,
  epic: 7
};

// ==================== 隐藏房间（markHiddenRooms） ====================

/** 隐藏房间数量下限 */
export const HIDDEN_ROOM_MIN_COUNT = 2;
/** 隐藏房间数量上限 */
export const HIDDEN_ROOM_MAX_COUNT = 3;

// ==================== 兜底奖励（grantFallbackReward） ====================

/** 兜底金币最小值（结果 = random(0, MAX) + MIN） */
export const FALLBACK_GOLD_MIN = 5;
/** 兜底金币随机范围上限 */
export const FALLBACK_GOLD_RANDOM_RANGE = 30;
/** 兜底经验最小值 */
export const FALLBACK_EXP_MIN = 3;
/** 兜底经验随机范围上限 */
export const FALLBACK_EXP_RANDOM_RANGE = 15;
