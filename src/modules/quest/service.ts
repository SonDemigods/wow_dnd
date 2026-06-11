/**
 * 任务模块纯函数层
 * 
 * 不持有任何状态，不调用 DB，不触发事件。所有函数均为纯计算。
 * 由 Store 层调用这些纯函数来编排业务逻辑。
 */
import type { 
  QuestDefinition, 
  QuestInstance,
  QuestObjectiveProgress
} from './types';

/**
 * 检查任务进度
 * 根据相关数据（击杀敌人或收集物品）更新任务实例的目标进度
 * 
 * @param quest - 任务实例
 * @param definition - 任务定义（用于匹配目标类型和 enemyId/itemId）
 * @param relevantData - 触发进度检查的相关数据
 * @returns 更新后的进度和是否完成；如果没有匹配的目标则返回 null
 */
export function checkQuestProgress(
  quest: QuestInstance,
  definition: QuestDefinition,
  relevantData: { enemyId?: string; itemId?: string; amount?: number }
): { isComplete: boolean; progress: QuestObjectiveProgress[] } | null {
  const amount = relevantData.amount ?? 1;
  const newProgress: QuestObjectiveProgress[] = quest.progress.map(p => ({ ...p }));
  let matched = false;

  for (const objective of definition.objectives) {
    const isKillMatch = relevantData.enemyId && objective.type === 'kill' && objective.enemyId === relevantData.enemyId;
    const isCollectMatch = relevantData.itemId && objective.type === 'collect' && objective.itemId === relevantData.itemId;

    if (isKillMatch || isCollectMatch) {
      const idx = newProgress.findIndex(p => p.objectiveKey === objective.key);
      if (idx !== -1) {
        newProgress[idx] = {
          ...newProgress[idx],
          current: Math.min(newProgress[idx].current + amount, newProgress[idx].target)
        };
        matched = true;
      }
    }
  }

  if (!matched) return null;

  const isComplete = newProgress.every(p => p.current >= p.target);
  return { isComplete, progress: newProgress };
}

/**
 * 计算任务奖励
 * 
 * @param definition - 任务定义
 * @returns 包含经验值、金币和物品奖励的对象
 */
export function calculateQuestRewards(definition: QuestDefinition): {
  exp: number;
  gold: number;
  items: { itemId: string; count: number }[];
} {
  return {
    exp: definition.xpReward,
    gold: definition.goldReward,
    items: (definition.itemRewards || []).map(r => ({ itemId: r.itemId, count: r.count }))
  };
}

/**
 * 检查是否可以接受任务
 * 
 * @param definition - 任务定义
 * @param characterLevel - 当前角色等级
 * @param activeQuests - 当前活跃任务实例列表
 * @returns 是否可以接受该任务
 */
export function canAcceptQuest(
  definition: QuestDefinition,
  characterLevel: number,
  activeQuests: QuestInstance[]
): boolean {
  // 检查等级要求
  if (characterLevel < definition.levelRequirement) return false;

  // 检查是否已存在活跃实例（只有已放弃的任务可以重新接取）
  const existing = activeQuests.find(i => i.questId === definition.id);
  if (existing) {
    if (existing.status === 'abandoned') return true;
    return false;
  }

  return true;
}

/**
 * 生成任务实例
 * 创建一个新的、状态为"进行中"的任务实例
 * 
 * @param definition - 任务定义
 * @param characterId - 角色ID（保留参数，供将来扩展使用）
 * @returns 新创建的任务实例
 */
export function generateQuestInstance(
  definition: QuestDefinition,
  _characterId: string
): QuestInstance {
  return {
    questId: definition.id,
    status: 'in_progress',
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
 * 当数据库中没有任务定义时作为回退
 * 
 * @returns 默认任务定义列表
 */
export function getDefaultQuests(): QuestDefinition[] {
  return [
    {
      id: 'quest_kill_goblin',
      title: '消灭哥布林',
      description: '村庄附近出现了一群哥布林，村民们非常害怕。请你前往东边的森林，消灭10只哥布林。',
      type: 'kill',
      objectives: [
        {
          key: 'kill_goblin',
          type: 'kill',
          description: '消灭哥布林',
          target: 10,
          enemyId: 'goblin'
        }
      ],
      levelRequirement: 1,
      xpReward: 100,
      goldReward: 50,
      boardId: 'village'
    },
    {
      id: 'quest_collect_herbs',
      title: '采集草药',
      description: '药剂师需要一些草药来制作治疗药水。请前往草药田采集15株草药。',
      type: 'collect',
      objectives: [
        {
          key: 'collect_herb',
          type: 'collect',
          description: '采集草药',
          target: 15,
          itemId: 'item_herb'
        }
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
        {
          key: 'kill_wolf',
          type: 'kill',
          description: '消灭狼',
          target: 5,
          enemyId: 'wolf'
        }
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
        {
          key: 'kill_orc_minion',
          type: 'kill',
          description: '消灭兽人手下',
          target: 3,
          enemyId: 'orc'
        },
        {
          key: 'kill_orc_boss',
          type: 'kill',
          description: '击败兽人首领',
          target: 1,
          enemyId: 'ogre'
        }
      ],
      levelRequirement: 5,
      xpReward: 500,
      goldReward: 300,
      boardId: 'village'
    }
  ];
}
