/**
 * @fileoverview 系统类控制台命令单元测试（QA-1）
 *
 * 覆盖 system 命令子模块的 5 个命令：
 *   admin / game / help / shops / log
 *
 * Mock 策略：
 *  - mock useShopStore（init / shops）
 *  - mock useLogStore（getLogs / getLogsByType / logCount）
 *  - help 命令直接读取 commands Map，需触发全量命令注册以验证类别分组
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock ====================

const shopMock = {
  init: vi.fn().mockResolvedValue(undefined),
  shops: [] as Array<{ id: string; name: string; type: string }>,
};

vi.mock('@/modules/shop/store', () => ({
  useShopStore: () => shopMock,
}));

const logMock = {
  getLogs: vi.fn(),
  getLogsByType: vi.fn(),
  logCount: 0,
};

vi.mock('@/modules/log/store', () => ({
  useLogStore: () => logMock,
}));

// 触发 system 命令注册（admin/game/help/shops/log）
import '@/modules/console/commands/system';
import { exec, getCommands, registerCommand } from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/commands/system - 系统类命令', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopMock.shops = [];
    logMock.logCount = 0;
    logMock.getLogs.mockReturnValue([]);
    logMock.getLogsByType.mockReturnValue([]);
    // 重置 window.__gameState
    (window as unknown as { __gameState?: unknown }).__gameState = undefined;
  });

  // -------------------- admin --------------------
  describe('admin - 进入后台管理', () => {
    it('gameState 未初始化时返回失败', async () => {
      const result = await exec('admin');
      expect(result).toEqual({ success: false, message: 'gameState 未初始化，请等待游戏加载完成' });
    });

    it('gameState 已初始化时切换到 admin', async () => {
      const gs = { value: 'game' };
      (window as unknown as { __gameState?: { value: string } }).__gameState = gs;
      const result = await exec('admin');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已进入后台管理系统');
      expect(gs.value).toBe('admin');
    });
  });

  // -------------------- game --------------------
  describe('game - 返回游戏界面', () => {
    it('gameState 未初始化时返回失败', async () => {
      const result = await exec('game');
      expect(result).toEqual({ success: false, message: 'gameState 未初始化，请等待游戏加载完成' });
    });

    it('gameState 已初始化时切换到 character-select', async () => {
      const gs = { value: 'admin' };
      (window as unknown as { __gameState?: { value: string } }).__gameState = gs;
      const result = await exec('game');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已返回游戏界面');
      expect(gs.value).toBe('character-select');
    });
  });

  // -------------------- help --------------------
  describe('help - 帮助命令', () => {
    it('无参数时按类别分组列出所有命令', async () => {
      // 为确保 help 有内容，注册一个测试命令
      registerCommand({
        name: 'helptest',
        category: 'system',
        description: '帮助测试命令',
        usage: 'helptest',
        handler: () => ({ success: true, message: 'ok' }),
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('help');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已在上方按类别分组显示');
      expect(logSpy.mock.calls.length).toBeGreaterThan(0);
      logSpy.mockRestore();
    });

    it('传入命令名时显示该命令详细用法', async () => {
      registerCommand({
        name: 'detailcmd',
        category: 'system',
        description: '详细用法测试',
        usage: 'detailcmd <arg>',
        handler: () => ({ success: true, message: 'ok' }),
      });
      const result = await exec('help detailcmd');
      expect(result.success).toBe(true);
      expect(result.message).toContain('detailcmd');
      expect(result.message).toContain('详细用法测试');
      expect(result.message).toContain('用法: detailcmd <arg>');
    });

    it('传入英文类别名时筛选该类别命令', async () => {
      registerCommand({
        name: 'catfilter',
        category: 'combat',
        description: '类别筛选测试',
        usage: 'catfilter',
        handler: () => ({ success: true, message: 'ok' }),
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('help combat');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已在上方列出「战斗」类别命令');
      logSpy.mockRestore();
    });

    it('传入中文类别名时筛选该类别命令', async () => {
      registerCommand({
        name: 'cncat',
        category: 'skill',
        description: '中文类别测试',
        usage: 'cncat',
        handler: () => ({ success: true, message: 'ok' }),
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('help 技能');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已在上方列出「技能」类别命令');
      logSpy.mockRestore();
    });

    it('未知命令或类别时返回失败', async () => {
      const result = await exec('help unknownxxx');
      expect(result).toEqual({ success: false, message: '未知命令或类别: unknownxxx' });
    });
  });

  // -------------------- shops --------------------
  describe('shops - 商店列表', () => {
    it('空商店列表返回提示', async () => {
      shopMock.shops = [];
      const result = await exec('shops');
      expect(result).toEqual({ success: true, message: '没有可用商店' });
      expect(shopMock.init).toHaveBeenCalled();
    });

    it('有商店时列出商店信息', async () => {
      shopMock.shops = [
        { id: 'shop_ironforge', name: '铁炉堡商店', type: 'general' },
        { id: 'shop_stormwind', name: '暴风城商店', type: 'weapon' },
      ];
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('shops');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已在上方列出所有商店');
      expect(logSpy.mock.calls.length).toBeGreaterThan(2);
      logSpy.mockRestore();
    });
  });

  // -------------------- log --------------------
  describe('log - 冒险日志', () => {
    it('空日志返回提示', async () => {
      logMock.getLogs.mockReturnValue([]);
      const result = await exec('log');
      expect(result).toEqual({ success: true, message: '冒险日志为空' });
    });

    it('默认显示 10 条日志', async () => {
      const logs = Array.from({ length: 15 }, (_, i) => ({
        timestamp: 1000 + i,
        message: `日志${i}`,
        icon: 'i',
      }));
      logMock.getLogs.mockReturnValue(logs);
      logMock.logCount = 15;
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('log');
      expect(result.success).toBe(true);
      expect(result.message).toBe('共 15 条日志');
      // 应输出 10 条日志 + 标题行(logTag) + exec 成功回显 1 行
      expect(logSpy.mock.calls.length).toBe(12);
      logSpy.mockRestore();
    });

    it('指定数量时显示对应条数', async () => {
      const logs = Array.from({ length: 20 }, (_, i) => ({
        timestamp: 1000 + i,
        message: `日志${i}`,
        icon: '',
      }));
      logMock.getLogs.mockReturnValue(logs);
      logMock.logCount = 20;
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('log 5');
      expect(result.success).toBe(true);
      // 5 条日志 + 1 标题行(logTag) + exec 成功回显 1 行
      expect(logSpy.mock.calls.length).toBe(7);
      logSpy.mockRestore();
    });

    it('数量为 0 返回失败', async () => {
      const result = await exec('log 0');
      expect(result).toEqual({ success: false, message: '数量必须为正整数' });
    });

    it('数量为负数返回失败', async () => {
      const result = await exec('log -5');
      expect(result).toEqual({ success: false, message: '数量必须为正整数' });
    });

    it('非数字数量返回失败', async () => {
      const result = await exec('log abc');
      expect(result).toEqual({ success: false, message: '数量必须为正整数' });
    });

    it('按类型筛选时调用 getLogsByType', async () => {
      logMock.getLogsByType.mockReturnValue([
        { timestamp: 1000, message: '战斗日志', icon: 'i' },
      ]);
      logMock.logCount = 1;
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('log 10 combat');
      expect(result.success).toBe(true);
      expect(logMock.getLogsByType).toHaveBeenCalledWith('combat');
      logSpy.mockRestore();
    });

    it('无效类型时忽略筛选，显示全部', async () => {
      logMock.getLogs.mockReturnValue([]);
      await exec('log 10 unknown');
      // 无效类型应被忽略，调用 getLogs 而非 getLogsByType
      expect(logMock.getLogs).toHaveBeenCalled();
      expect(logMock.getLogsByType).not.toHaveBeenCalled();
    });

    it('按类型筛选无匹配日志时返回提示', async () => {
      logMock.getLogsByType.mockReturnValue([]);
      const result = await exec('log 10 quest');
      expect(result).toEqual({ success: true, message: '没有 "quest" 类型的日志' });
    });
  });

  // -------------------- 注册验证 --------------------
  describe('命令注册验证', () => {
    it('system 类命令全部已注册', () => {
      const expected = ['admin', 'game', 'help', 'shops', 'log'];
      for (const name of expected) {
        expect(getCommands().has(name)).toBe(true);
      }
    });
  });
});
