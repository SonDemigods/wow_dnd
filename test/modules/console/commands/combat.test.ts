/**
 * @fileoverview 战斗类控制台命令单元测试（QA-1）
 *
 * 覆盖 combat 命令子模块的 4 个命令：
 *   spawn / win / flee / kill
 *
 * Mock 策略：
 *  - mock useCombatStore（isInCombat / startCombat / endCombat / currentTarget）
 *  - mock useEnemyStore（createEnemy / takeDamage）
 *  - mock adminQueryService（queryAllEnemyTemplates）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock ====================
// vi.hoisted 保证 mock 变量在 vi.mock 工厂提升到文件顶部时已初始化，
// 避免 TDZ（Temporal Dead Zone）错误。adminQueryService 是直接导出的对象（非工厂函数），
// 工厂被调用时立即访问 adminQueryMock，必须用 vi.hoisted。

const { combatMock, enemyMock, adminQueryMock } = vi.hoisted(() => ({
  combatMock: {
    isInCombat: false,
    currentTarget: null as { id: string; name: string } | null,
    startCombat: vi.fn().mockResolvedValue(undefined),
    endCombat: vi.fn(),
  },
  enemyMock: {
    createEnemy: vi.fn(),
    takeDamage: vi.fn(),
  },
  adminQueryMock: {
    queryAllEnemyTemplates: vi.fn(),
  },
}));

vi.mock('@/modules/combat/store', () => ({
  useCombatStore: () => combatMock,
}));

vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: () => enemyMock,
}));

vi.mock('@/services/AdminQueryService', () => ({
  adminQueryService: adminQueryMock,
}));

// 触发 combat 命令注册
import '@/modules/console/commands/combat';
import { exec, getCommands } from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/commands/combat - 战斗类命令', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    combatMock.isInCombat = false;
    combatMock.currentTarget = null;
  });

  // -------------------- spawn --------------------
  describe('spawn - 生成敌人并进入战斗', () => {
    it('无参数时列出可用敌人列表', async () => {
      adminQueryMock.queryAllEnemyTemplates.mockResolvedValue({
        mobs: [
          { id: 'goblin', name: '哥布林', maxHp: 50 },
          { id: 'wolf', name: '野狼', maxHp: 80 },
        ],
        bosses: [
          { id: 'dragon', name: '巨龙', maxHp: 5000 },
        ],
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('spawn');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已在上方列出所有可用怪物和Boss');
      expect(adminQueryMock.queryAllEnemyTemplates).toHaveBeenCalled();
      expect(logSpy.mock.calls.length).toBeGreaterThan(3);
      logSpy.mockRestore();
    });

    it('空敌人列表时仍返回成功', async () => {
      adminQueryMock.queryAllEnemyTemplates.mockResolvedValue({ mobs: [], bosses: [] });
      const result = await exec('spawn');
      expect(result.success).toBe(true);
    });

    it('有效敌人 ID 时生成并进入战斗', async () => {
      const enemy = { id: 'goblin', name: '哥布林', hp: 50 };
      enemyMock.createEnemy.mockResolvedValue(enemy);
      const result = await exec('spawn goblin');
      expect(result).toEqual({ success: true, message: '已生成 哥布林 (HP:50) 并进入战斗' });
      expect(enemyMock.createEnemy).toHaveBeenCalledWith('goblin');
      expect(combatMock.startCombat).toHaveBeenCalledWith([enemy]);
    });

    it('createEnemy 返回 null 时返回失败', async () => {
      enemyMock.createEnemy.mockResolvedValue(null);
      const result = await exec('spawn unknown');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未找到敌人: unknown');
    });

    it('createEnemy 抛错时返回失败（catch 分支）', async () => {
      enemyMock.createEnemy.mockRejectedValue(new Error('DB error'));
      const result = await exec('spawn broken');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未找到敌人: broken');
    });
  });

  // -------------------- win --------------------
  describe('win - 强制胜利', () => {
    it('未在战斗中时返回失败', async () => {
      combatMock.isInCombat = false;
      const result = await exec('win');
      expect(result).toEqual({ success: false, message: '当前没有在战斗中' });
      expect(combatMock.endCombat).not.toHaveBeenCalled();
    });

    it('在战斗中时以 victory 结束战斗', async () => {
      combatMock.isInCombat = true;
      const result = await exec('win');
      expect(result).toEqual({ success: true, message: '战斗已强制胜利' });
      expect(combatMock.endCombat).toHaveBeenCalledWith('victory');
    });
  });

  // -------------------- flee --------------------
  describe('flee - 强制逃跑', () => {
    it('未在战斗中时返回失败', async () => {
      combatMock.isInCombat = false;
      const result = await exec('flee');
      expect(result).toEqual({ success: false, message: '当前没有在战斗中' });
    });

    it('在战斗中时以 fled 结束战斗', async () => {
      combatMock.isInCombat = true;
      const result = await exec('flee');
      expect(result).toEqual({ success: true, message: '已从战斗中逃跑' });
      expect(combatMock.endCombat).toHaveBeenCalledWith('fled');
    });
  });

  // -------------------- kill --------------------
  describe('kill - 敌人立即死亡', () => {
    it('未在战斗中时返回失败', async () => {
      combatMock.isInCombat = false;
      const result = await exec('kill');
      expect(result).toEqual({ success: false, message: '当前没有在战斗中' });
    });

    it('无 currentTarget 时返回失败', async () => {
      combatMock.isInCombat = true;
      combatMock.currentTarget = null;
      const result = await exec('kill');
      expect(result).toEqual({ success: false, message: '没有存活的敌人' });
    });

    it('有目标时造成 99999 伤害并以胜利结束', async () => {
      combatMock.isInCombat = true;
      combatMock.currentTarget = { id: 'goblin1', name: '哥布林' };
      const result = await exec('kill');
      expect(result.success).toBe(true);
      expect(result.message).toContain('哥布林 已被消灭');
      expect(enemyMock.takeDamage).toHaveBeenCalledWith('goblin1', 99999);
      expect(combatMock.endCombat).toHaveBeenCalledWith('victory');
    });
  });

  // -------------------- 注册验证 --------------------
  describe('命令注册验证', () => {
    it('combat 类命令全部已注册', () => {
      const expected = ['spawn', 'win', 'flee', 'kill'];
      for (const name of expected) {
        expect(getCommands().has(name)).toBe(true);
      }
    });
  });
});
