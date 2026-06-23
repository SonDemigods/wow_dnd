/**
 * @fileoverview 任务模块 —— 纯函数层
 *
 * 本文件仅包含纯计算函数，遵循以下原则：
 * - **不持有状态**：无 ref、reactive、全局变量
 * - **不调用 DB**：无任何 IndexedDB / Dexie 操作
 * - **不触发事件**：无 eventBus.emit() 调用
 * - **无副作用**：相同输入永远返回相同输出
 *
 * 所有函数由 Store 层调用，在 Action 中编排业务逻辑：
 *
 *   Store Action
 *     ├── 调用 service 纯函数（计算、校验）
 *     ├── 更新 Store 响应式状态
 *     ├── 调用 db 持久化
 *     └── 触发事件 / 记录日志
 *
 * @module quest/service
 */

import type { 
  QuestDefinition, 
  QuestInstance,
  QuestObjectiveProgress
} from './types';

/**
 * 检查任务进度
 *
 * 根据外部事件（击杀敌人或收集物品）判断哪些任务目标需要更新，计算新进度。
 * 纯计算函数 —— 不修改传入的对象，返回新的进度数组。
 *
 * **匹配逻辑**：
 * - 传入 enemyId → 查找 type='kill' 且 enemyId 匹配的目标
 * - 传入 itemId  → 查找 type='collect' 且 itemId 匹配的目标
 * - 两侧同时传入时，分别匹配各自类型的目标
 *
 * **边界情况**：
 * - 没有任何目标匹配 → 返回 null（调用方应忽略此次事件）
 * - 进度已满 → current 不会超过 target（由 Math.min 保证）
 * - 所有目标 current >= target → isComplete = true
 *
 * @param quest       - 任务实例（用于读取当前进度）
 * @param definition  - 任务定义（用于读取目标列表）
 * @param relevantData - 触发本次检查的事件数据
 * @param relevantData.enemyId - 被击杀的敌人ID
 * @param relevantData.itemId  - 被收集的物品ID
 * @param relevantData.amount  - 数量（默认 1）
 * @returns 新进度 + 是否全部完成；无匹配目标时返回 null
 */
export function checkQuestProgress(
  quest: QuestInstance,
  definition: QuestDefinition,
  relevantData: { enemyId?: string; itemId?: string; amount?: number }
): { isComplete: boolean; progress: QuestObjectiveProgress[] } | null {
  // 未显式提供数量时，每次击杀/收集计 1
  const amount = relevantData.amount ?? 1;

  // 深拷贝进度数组，确保纯函数不修改入参
  const newProgress: QuestObjectiveProgress[] = quest.progress.map(p => ({ ...p }));
  let matched = false;

  // 遍历任务定义中的所有目标，检查是否匹配当前事件
  for (const objective of definition.objectives) {
    const isKillMatch = relevantData.enemyId && objective.type === 'kill' && objective.enemyId === relevantData.enemyId;
    const isCollectMatch = relevantData.itemId && objective.type === 'collect' && objective.itemId === relevantData.itemId;

    if (isKillMatch || isCollectMatch) {
      // 在进度数组中查找对应的进度条目
      const idx = newProgress.findIndex(p => p.objectiveKey === objective.key);
      if (idx !== -1) {
        newProgress[idx] = {
          ...newProgress[idx],
          // 累加进度，上限为目标值
          current: Math.min(newProgress[idx].current + amount, newProgress[idx].target)
        };
        matched = true;
      }
    }
  }

  // 没有任何目标被匹配，说明此事件与当前任务无关
  if (!matched) return null;

  // 检查所有目标是否均已达成
  const isComplete = newProgress.every(p => p.current >= p.target);
  return { isComplete, progress: newProgress };
}

/**
 * 计算任务奖励
 *
 * 从任务定义中提取奖励信息并转换为统一格式。
 * 实际发放由 Store._grantQuestRewards() 调用 characterStore / inventoryStore 执行。
 *
 * @param definition - 任务定义
 * @returns 奖励对象（经验值、金币、物品列表）
 */
export function calculateQuestRewards(definition: QuestDefinition): {
  exp: number;
  gold: number;
  items: { itemId: string; count: number }[];
} {
  return {
    exp: definition.xpReward,
    gold: definition.goldReward,
    // 确保 itemRewards 为空时返回空数组，避免 undefined
    items: (definition.itemRewards || []).map(r => ({ itemId: r.itemId, count: r.count }))
  };
}

/**
 * 检查是否可以接受任务
 *
 * 判定条件：
 * 1. 角色等级 ≥ 任务等级要求
 * 2. 该任务不存在活跃实例（in_progress / completed / turned_in）
 * 3. 例外：已放弃的任务可以重新接取
 *
 * @param definition    - 任务定义
 * @param characterLevel - 当前角色等级
 * @param activeQuests  - 当前角色的所有任务实例
 * @returns 是否可以接受该任务
 */
export function canAcceptQuest(
  definition: QuestDefinition,
  characterLevel: number,
  activeQuests: QuestInstance[]
): boolean {
  // 等级不足
  if (characterLevel < definition.levelRequirement) return false;

  // 检查是否已存在实例
  const existing = activeQuests.find(i => i.questId === definition.id);
  if (existing) {
    // 只有已放弃的任务可以重新接取
    if (existing.status === 'abandoned') return true;
    return false;
  }

  return true;
}

/**
 * 生成任务实例
 *
 * 从任务定义创建一个全新的 QuestInstance，状态为 in_progress。
 * 初始化所有目标的进度为 0。
 *
 * @param definition - 任务定义
 * @returns 新创建的任务实例（status = in_progress, 所有 progress.current = 0）
 */
export function generateQuestInstance(
  definition: QuestDefinition
): QuestInstance {
  return {
    questId: definition.id,
    status: 'in_progress',
    // 按 objective 顺序初始化进度条目
    progress: definition.objectives.map(obj => ({
      objectiveKey: obj.key,
      current: 0,
      target: obj.target
    })),
    acceptedAt: Date.now()
  };
}

/**
 * 获取默认任务模板
 *
 * **仅在数据库为空时作为回退使用。**
 * 正常流程：data/service.ts 在初始化时将 QUESTS 常量写入 config_quests 表，
 * 此后本函数永不被调用。
 *
 * 提供 4 个涵盖击杀和收集类型的演示任务，便于开发和测试。
 *
 * @returns 默认任务定义列表（4 个模板任务）
 */
export function getDefaultQuests(): QuestDefinition[] {
  return [
    {
      id: 'quest_kill_goblin',
      title: '消灭哥布林',
      description: '村庄附近出现了一群哥布林，村民们非常害怕。请你前往东边的森林，消灭10只哥布林。',
      type: 'kill',
      objectives: [
        { key: 'kill_goblin', type: 'kill', target: 10, enemyId: 'goblin' }
      ],
      levelRequirement: 1,
      xpReward: 100,
      goldReward: 50,
      boardId: 'village'
    },
    {
      id: 'quest_collect_herbs',
      title: '采集草药',
      description: '药剂师需要一些草药来制作生命药水。请前往草药田采集15株草药。',
      type: 'collect',
      objectives: [
        { key: 'collect_herb', type: 'collect', target: 15, itemId: 'item_herb' }
      ],
      levelRequirement: 1,
      xpReward: 80,
      goldReward: 30,
      boardId: 'village'
    },
    {
      id: 'quest_kill_wolf',
      title: '狼群威胁',
      description: '最近有狼群在村庄周边活动，已经造成了一些损失。请消灭5只狼。',
      type: 'kill',
      objectives: [
        { key: 'kill_wolf', type: 'kill', target: 5, enemyId: 'wolf' }
      ],
      levelRequirement: 2,
      xpReward: 150,
      goldReward: 80,
      boardId: 'village'
    },
    {
      id: 'quest_kill_boss_orc',
      title: '兽人首领',
      description: '一个强大的兽人首领带领着他的部下占领了矿山。请你前去击败他，夺回矿山！',
      type: 'kill',
      objectives: [
        { key: 'kill_orc_minion', type: 'kill', target: 3, enemyId: 'orc' },
        { key: 'kill_orc_boss', type: 'kill', target: 1, enemyId: 'ogre' }
      ],
      levelRequirement: 5,
      xpReward: 500,
      goldReward: 300,
      boardId: 'village'
    }
  ];
}
