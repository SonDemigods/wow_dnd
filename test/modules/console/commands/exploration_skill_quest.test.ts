/**
 * @fileoverview 探索、技能、任务类控制台命令单元测试（QA-1）
 *
 * 合并覆盖三个较小命令子模块：
 *   exploration: resetExplore / goto / revealAll
 *   skill:       skills
 *   quest:       quests
 *
 * Mock 策略：
 *  - mock useExplorationStore / useMapStore / useSkillStore / useQuestStore
 *  - mock @/data/config_locations 的 CONTINENTS
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock ====================

const explorationMock = {
  isExploring: false,
  reset: vi.fn(),
  revealAllCells: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/modules/exploration/store', () => ({
  useExplorationStore: () => explorationMock,
}));

const mapMock = {
  getLocationsByContinent: vi.fn(),
  enterZone: vi.fn(),
};

vi.mock('@/modules/map/store', () => ({
  useMapStore: () => mapMock,
}));

vi.mock('@/data/config_locations', () => ({
  CONTINENTS: [
    { id: 'kalimdor', name: '卡利姆多' },
    { id: 'eastern_kingdoms', name: '东部王国' },
  ],
  // validate.ts 在开发环境从 @/data/index 间接加载，会读取 LOCATIONS。
  // 提供空数组避免 "No LOCATIONS export" 错误，本测试不依赖真实地点数据。
  LOCATIONS: [],
}));

const skillMock = {
  skills: [] as Array<{ id: string; name: string; type: string; mpCost?: number; unlockLevel: number }>,
  skillBar: { slots: [null, null, null, null] as Array<string | null> },
  unlockedSkills: [] as Array<{ id: string; name: string; type: string; mpCost?: number }>,
  lockedSkills: [] as Array<{ id: string; name: string; unlockLevel: number }>,
  equipSkill: vi.fn(),
};

vi.mock('@/modules/skill/store', () => ({
  useSkillStore: () => skillMock,
}));

const questMock = {
  availableQuests: [] as Array<{ id: string; title: string }>,
  activeQuests: [] as Array<{ questId: string; progress: Record<string, unknown> }>,
  completedQuests: [] as Array<{ questId: string }>,
  getQuestDefinition: vi.fn(),
  acceptQuest: vi.fn(),
  claimReward: vi.fn(),
  abandonQuest: vi.fn(),
};

vi.mock('@/modules/quest/store', () => ({
  useQuestStore: () => questMock,
}));

// 触发命令注册
import '@/modules/console/commands/exploration';
import '@/modules/console/commands/skill';
import '@/modules/console/commands/quest';
import { exec, getCommands } from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/commands - 探索/技能/任务类命令', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    explorationMock.isExploring = false;
    skillMock.skills = [];
    skillMock.skillBar.slots = [null, null, null, null];
    skillMock.unlockedSkills = [];
    skillMock.lockedSkills = [];
    questMock.availableQuests = [];
    questMock.activeQuests = [];
    questMock.completedQuests = [];
  });

  // -------------------- exploration --------------------
  describe('exploration - 探索类命令', () => {
    describe('resetExplore - 重置探索', () => {
      it('调用 reset 并返回成功', async () => {
        const result = await exec('resetExplore');
        expect(result).toEqual({ success: true, message: '探索状态已重置' });
        expect(explorationMock.reset).toHaveBeenCalled();
      });
    });

    describe('goto - 传送', () => {
      it('无参数时列出可用地点', async () => {
        mapMock.getLocationsByContinent.mockImplementation((continentId: string) => {
          if (continentId === 'kalimdor') return [{ id: 'thunder_bluff', name: '雷霆崖' }];
          if (continentId === 'eastern_kingdoms') return [{ id: 'ironforge', name: '铁炉堡' }];
          return [];
        });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await exec('goto');
        expect(result.success).toBe(true);
        expect(result.message).toContain('已在上方列出所有可用地点');
        // 应遍历两个大陆
        expect(mapMock.getLocationsByContinent).toHaveBeenCalledWith('kalimdor');
        expect(mapMock.getLocationsByContinent).toHaveBeenCalledWith('eastern_kingdoms');
        logSpy.mockRestore();
      });

      it('有效地点 ID 时调用 enterZone', async () => {
        mapMock.enterZone.mockReturnValue(true);
        const result = await exec('goto ironforge');
        expect(result).toEqual({ success: true, message: '已传送到 ironforge' });
        expect(mapMock.enterZone).toHaveBeenCalledWith('ironforge');
      });

      it('enterZone 返回 false 时返回失败', async () => {
        mapMock.enterZone.mockReturnValue(false);
        const result = await exec('goto unknown');
        expect(result.success).toBe(false);
        expect(result.message).toContain('未找到地点: unknown');
      });
    });

    describe('revealAll - 揭示所有格子', () => {
      it('未在探索中时返回失败', async () => {
        explorationMock.isExploring = false;
        const result = await exec('revealAll');
        expect(result).toEqual({ success: false, message: '当前没有在探索中' });
        expect(explorationMock.revealAllCells).not.toHaveBeenCalled();
      });

      it('在探索中时揭示所有格子', async () => {
        explorationMock.isExploring = true;
        const result = await exec('revealAll');
        expect(result).toEqual({ success: true, message: '所有探索格子已揭示' });
        expect(explorationMock.revealAllCells).toHaveBeenCalled();
      });
    });
  });

  // -------------------- skill --------------------
  describe('skill - 技能类命令', () => {
    describe('skills - 技能列表与装备', () => {
      it('无参数时列出技能栏与已解锁/未解锁技能', async () => {
        skillMock.skills = [
          { id: 'fireball', name: '火球术', type: 'magic', mpCost: 20, unlockLevel: 1 },
          { id: 'frostbolt', name: '寒冰箭', type: 'magic', unlockLevel: 5 },
        ];
        skillMock.skillBar.slots = ['fireball', null, null, null];
        skillMock.unlockedSkills = [{ id: 'fireball', name: '火球术', type: 'magic', mpCost: 20 }];
        skillMock.lockedSkills = [{ id: 'frostbolt', name: '寒冰箭', unlockLevel: 5 }];
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await exec('skills');
        expect(result.success).toBe(true);
        expect(result.message).toBe('已在上方显示技能信息');
        expect(logSpy.mock.calls.length).toBeGreaterThan(3);
        logSpy.mockRestore();
      });

      it('指定槽位装备技能成功', async () => {
        skillMock.equipSkill.mockResolvedValue(true);
        const result = await exec('skills fireball 2');
        expect(result).toEqual({ success: true, message: '技能 fireball 已装备到槽位 2' });
        expect(skillMock.equipSkill).toHaveBeenCalledWith('fireball', 2);
      });

      it('指定槽位装备失败', async () => {
        skillMock.equipSkill.mockResolvedValue(false);
        const result = await exec('skills unknown 0');
        expect(result.success).toBe(false);
        expect(result.message).toBe('装备失败，请检查技能ID和槽位是否可用');
      });

      it('槽位超出 0-3 范围返回失败', async () => {
        const result = await exec('skills fireball 5');
        expect(result).toEqual({ success: false, message: '槽位必须在 0-3 之间' });
        expect(skillMock.equipSkill).not.toHaveBeenCalled();
      });

      it('未指定槽位时自动找空槽位装备', async () => {
        skillMock.skillBar.slots = ['fireball', null, null, null];
        skillMock.equipSkill.mockResolvedValue(true);
        const result = await exec('skills frostbolt');
        expect(result.success).toBe(true);
        expect(result.message).toBe('技能 frostbolt 已装备到槽位 1');
        expect(skillMock.equipSkill).toHaveBeenCalledWith('frostbolt', 1);
      });

      it('所有槽位已满时返回失败', async () => {
        skillMock.skillBar.slots = ['a', 'b', 'c', 'd'];
        const result = await exec('skills fireball');
        expect(result).toEqual({ success: false, message: '所有槽位已满，请指定要覆盖的槽位 (0-3)' });
      });
    });
  });

  // -------------------- quest --------------------
  describe('quest - 任务类命令', () => {
    describe('quests - 任务列表与操作', () => {
      it('无任务时返回提示', async () => {
        const result = await exec('quests');
        expect(result).toEqual({ success: true, message: '当前没有任何任务' });
      });

      it('列出进行中、可接、已完成任务', async () => {
        questMock.activeQuests = [{ questId: 'q1', progress: { killed: 2 } }];
        questMock.availableQuests = [{ id: 'q2', title: '新任务' }];
        questMock.completedQuests = [{ questId: 'q3' }];
        questMock.getQuestDefinition.mockImplementation((id: string) => {
          if (id === 'q1') return { title: '杀怪任务' };
          if (id === 'q3') return { title: '完成任务' };
          return undefined;
        });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await exec('quests');
        expect(result.success).toBe(true);
        expect(result.message).toBe('已在上方显示任务列表');
        expect(logSpy.mock.calls.length).toBeGreaterThan(3);
        logSpy.mockRestore();
      });

      it('getQuestDefinition 返回 undefined 时使用 questId 作为标题', async () => {
        questMock.activeQuests = [{ questId: 'q_unknown', progress: {} }];
        questMock.getQuestDefinition.mockReturnValue(undefined);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await exec('quests');
        const loggedText = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
        expect(loggedText).toContain('q_unknown');
        logSpy.mockRestore();
      });

      it('accept 操作成功', async () => {
        questMock.acceptQuest.mockResolvedValue(true);
        const result = await exec('quests accept q1');
        expect(result).toEqual({ success: true, message: '已接受任务: q1' });
        expect(questMock.acceptQuest).toHaveBeenCalledWith('q1');
      });

      it('accept 操作失败', async () => {
        questMock.acceptQuest.mockResolvedValue(false);
        const result = await exec('quests accept q1');
        expect(result).toEqual({ success: false, message: '无法接受任务: q1' });
      });

      it('complete 操作成功', async () => {
        questMock.claimReward.mockResolvedValue(true);
        const result = await exec('quests complete q1');
        expect(result).toEqual({ success: true, message: '已提交任务: q1' });
      });

      it('complete 操作失败', async () => {
        questMock.claimReward.mockResolvedValue(false);
        const result = await exec('quests complete q1');
        expect(result).toEqual({ success: false, message: '无法提交任务: q1（可能尚未完成）' });
      });

      it('abandon 操作成功', async () => {
        questMock.abandonQuest.mockResolvedValue(true);
        const result = await exec('quests abandon q1');
        expect(result).toEqual({ success: true, message: '已放弃任务: q1' });
      });

      it('abandon 操作失败', async () => {
        questMock.abandonQuest.mockResolvedValue(false);
        const result = await exec('quests abandon q1');
        expect(result).toEqual({ success: false, message: '无法放弃任务: q1' });
      });

      it('无效操作返回失败', async () => {
        const result = await exec('quests invalid q1');
        expect(result.success).toBe(false);
        expect(result.message).toContain('无效操作: invalid');
      });

      it('缺少任务 ID 返回失败', async () => {
        const result = await exec('quests accept');
        expect(result).toEqual({ success: false, message: '请指定任务ID' });
      });
    });
  });

  // -------------------- 注册验证 --------------------
  describe('命令注册验证', () => {
    it('exploration 类命令全部已注册', () => {
      const expected = ['resetexplore', 'goto', 'revealall'];
      for (const name of expected) {
        expect(getCommands().has(name)).toBe(true);
      }
    });

    it('skill 类命令已注册', () => {
      expect(getCommands().has('skills')).toBe(true);
    });

    it('quest 类命令已注册', () => {
      expect(getCommands().has('quests')).toBe(true);
    });
  });
});
