/**
 * @fileoverview 控制台框架核心单元测试（QA-1）
 *
 * 覆盖 framework.ts 的：
 * 1. exec：空输入、未知命令、命令解析（含参数与多空格）、成功/失败/异常三分支
 * 2. registerCommand：注册、小写键匹配、覆盖注册
 * 3. initConsole：挂载 window.cmd、camelCase 方法名保留、exec 包装
 * 4. requireCharacter：角色存在/不存在
 * 5. switchGameState：gameState 未初始化/切换成功
 * 6. resolveCategory：英文 key/中文 label/无匹配
 * 7. rarityColorKey / logTag：辅助函数
 * 8. COMMAND_CATEGORY_LABELS：映射完整性
 *
 * Mock 策略：
 *  - 仅 mock @/modules/character/store（requireCharacter 依赖）
 *  - framework 本身不导入命令子模块，commands Map 在 beforeEach 中清空
 *  - 注册测试专用命令，不依赖真实命令实现
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// mock character store（requireCharacter 依赖）
const getCharacterDataMock = vi.fn();
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => ({
    getCharacterData: getCharacterDataMock,
  }),
}));

import {
  exec,
  initConsole,
  registerCommand,
  getCommands,
  requireCharacter,
  switchGameState,
  resolveCategory,
  rarityColorKey,
  logTag,
  COMMAND_CATEGORY_LABELS,
  STYLE,
  type CommandResult,
  type CommandCategory,
} from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/framework - 控制台框架核心', () => {
  beforeEach(() => {
    // 清空命令注册表，避免测试间污染
    getCommands().clear();
    // 重置 window.cmd
    (window as unknown as { cmd?: unknown }).cmd = undefined;
    // 重置 window.__gameState
    (window as unknown as { __gameState?: unknown }).__gameState = undefined;
    vi.clearAllMocks();
  });

  // -------------------- exec --------------------
  describe('exec - 命令执行入口', () => {
    it('空输入返回失败', async () => {
      const result = await exec('');
      expect(result).toEqual({ success: false, message: '请输入命令' });
    });

    it('仅空格输入返回失败', async () => {
      const result = await exec('   ');
      expect(result).toEqual({ success: false, message: '请输入命令' });
    });

    it('未知命令返回失败', async () => {
      const result = await exec('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未知命令: nonexistent');
    });

    it('成功执行已注册命令并返回结果', async () => {
      registerCommand({
        name: 'testok',
        category: 'system',
        description: '测试成功',
        usage: 'testok',
        handler: () => ({ success: true, message: '执行成功' }),
      });
      const result = await exec('testok');
      expect(result).toEqual({ success: true, message: '执行成功' });
    });

    it('命令名大小写不敏感（自动转小写查找）', async () => {
      registerCommand({
        name: 'caseTest',
        category: 'system',
        description: '大小写测试',
        usage: 'caseTest',
        handler: () => ({ success: true, message: 'ok' }),
      });
      expect((await exec('CASETEST')).success).toBe(true);
      expect((await exec('casetest')).success).toBe(true);
      expect((await exec('CaseTest')).success).toBe(true);
    });

    it('解析参数（多空格分隔）', async () => {
      let receivedArgs: string[] = [];
      registerCommand({
        name: 'argcmd',
        category: 'system',
        description: '参数测试',
        usage: 'argcmd <a> <b>',
        handler: (args) => {
          receivedArgs = args;
          return { success: true, message: 'ok' };
        },
      });
      await exec('argcmd   foo   bar  ');
      expect(receivedArgs).toEqual(['foo', 'bar']);
    });

    it('命令 handler 抛错时返回异常结果', async () => {
      registerCommand({
        name: 'throwcmd',
        category: 'system',
        description: '抛错测试',
        usage: 'throwcmd',
        handler: () => { throw new Error('handler 内部错误'); },
      });
      const result = await exec('throwcmd');
      expect(result.success).toBe(false);
      expect(result.message).toContain('命令执行出错: handler 内部错误');
    });

    it('命令 handler 抛非 Error 对象时返回 String(e)', async () => {
      registerCommand({
        name: 'throwstr',
        category: 'system',
        description: '抛字符串',
        usage: 'throwstr',
        handler: () => { throw '字符串错误'; },
      });
      const result = await exec('throwstr');
      expect(result.success).toBe(false);
      expect(result.message).toContain('字符串错误');
    });

    it('handler 返回失败时通过 console.warn 输出', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerCommand({
        name: 'failcmd',
        category: 'system',
        description: '失败测试',
        usage: 'failcmd',
        handler: () => ({ success: false, message: '执行失败' }),
      });
      await exec('failcmd');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('handler 返回成功时通过 console.log 输出', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      registerCommand({
        name: 'okcmd',
        category: 'system',
        description: '成功测试',
        usage: 'okcmd',
        handler: () => ({ success: true, message: '执行成功' }),
      });
      await exec('okcmd');
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('支持异步 handler', async () => {
      registerCommand({
        name: 'asynccmd',
        category: 'system',
        description: '异步测试',
        usage: 'asynccmd',
        async handler() {
          await new Promise(r => setTimeout(r, 0));
          return { success: true, message: '异步完成' };
        },
      });
      const result = await exec('asynccmd');
      expect(result).toEqual({ success: true, message: '异步完成' });
    });
  });

  // -------------------- registerCommand --------------------
  describe('registerCommand - 命令注册', () => {
    it('注册命令后可通过 getCommands 获取', () => {
      const def = {
        name: 'regtest',
        category: 'system' as CommandCategory,
        description: '注册测试',
        usage: 'regtest',
        handler: () => ({ success: true, message: 'ok' }),
      };
      registerCommand(def);
      expect(getCommands().get('regtest')).toBe(def);
    });

    it('注册时命令名统一转小写为键', () => {
      registerCommand({
        name: 'MixedCase',
        category: 'system',
        description: '混合大小写',
        usage: 'MixedCase',
        handler: () => ({ success: true, message: 'ok' }),
      });
      expect(getCommands().has('mixedcase')).toBe(true);
      expect(getCommands().has('MixedCase')).toBe(false);
    });

    it('重复注册同名命令会覆盖', () => {
      const def1 = { name: 'dup', category: 'system' as CommandCategory, description: 'v1', usage: 'dup', handler: () => ({ success: true, message: 'v1' }) };
      const def2 = { name: 'dup', category: 'system' as CommandCategory, description: 'v2', usage: 'dup', handler: () => ({ success: true, message: 'v2' }) };
      registerCommand(def1);
      registerCommand(def2);
      expect(getCommands().get('dup')?.description).toBe('v2');
    });
  });

  // -------------------- initConsole --------------------
  describe('initConsole - window.cmd 挂载', () => {
    it('将命令挂载到 window.cmd 对象', () => {
      registerCommand({
        name: 'mountTest',
        category: 'system',
        description: '挂载测试',
        usage: 'mountTest',
        handler: () => ({ success: true, message: 'mounted' }),
      });
      initConsole();
      const cmd = (window as unknown as { cmd?: Record<string, unknown> }).cmd;
      expect(cmd).toBeDefined();
      expect(typeof cmd?.mountTest).toBe('function');
    });

    it('挂载的方法名保留原始 camelCase', () => {
      registerCommand({
        name: 'revealAll',
        category: 'system',
        description: 'camelCase',
        usage: 'revealAll',
        handler: () => ({ success: true, message: 'ok' }),
      });
      initConsole();
      const cmd = (window as unknown as { cmd?: Record<string, unknown> }).cmd;
      expect(cmd?.revealAll).toBeDefined();
      expect(cmd?.revealall).toBeUndefined();
    });

    it('挂载的 exec 方法指向框架 exec', () => {
      initConsole();
      const cmd = (window as unknown as { cmd?: { exec?: unknown } }).cmd;
      expect(typeof cmd?.exec).toBe('function');
    });

    it('调用挂载的方法会触发 exec', async () => {
      registerCommand({
        name: 'calltest',
        category: 'system',
        description: '调用测试',
        usage: 'calltest',
        handler: () => ({ success: true, message: 'called' }),
      });
      initConsole();
      const cmd = (window as unknown as { cmd?: { calltest?: (...args: unknown[]) => Promise<CommandResult> } }).cmd;
      const result = await cmd?.calltest?.();
      expect(result).toEqual({ success: true, message: 'called' });
    });

    it('调用方法时参数转为字符串传递', async () => {
      let receivedArgs: string[] = [];
      registerCommand({
        name: 'argpass',
        category: 'system',
        description: '参数传递',
        usage: 'argpass <a> <b>',
        handler: (args) => { receivedArgs = args; return { success: true, message: 'ok' }; },
      });
      initConsole();
      const cmd = (window as unknown as { cmd?: { argpass?: (...args: unknown[]) => Promise<CommandResult> } }).cmd;
      await cmd?.argpass?.(100, 'item');
      // exec 收到的字符串中 args 应为 ['100', 'item']
      expect(receivedArgs).toEqual(['100', 'item']);
    });
  });

  // -------------------- requireCharacter --------------------
  describe('requireCharacter - 角色获取辅助', () => {
    it('角色不存在时返回失败结果', () => {
      getCharacterDataMock.mockReturnValue(null);
      const result = requireCharacter();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.result).toEqual({ success: false, message: '当前没有选中角色' });
      }
    });

    it('角色存在时返回 ok=true 与角色数据', () => {
      const character = { id: 'c1', name: 'Hero', level: 5 };
      getCharacterDataMock.mockReturnValue(character);
      const result = requireCharacter();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.character).toBe(character);
      }
    });
  });

  // -------------------- switchGameState --------------------
  describe('switchGameState - 游戏状态切换', () => {
    it('gameState 未初始化时返回失败', () => {
      const result = switchGameState('admin', '测试消息');
      expect(result).toEqual({ success: false, message: 'gameState 未初始化，请等待游戏加载完成' });
    });

    it('gameState 已初始化时切换并返回成功', () => {
      const gs = { value: 'game' };
      (window as unknown as { __gameState?: { value: string } }).__gameState = gs;
      const result = switchGameState('admin', '已进入后台');
      expect(result).toEqual({ success: true, message: '已进入后台' });
      expect(gs.value).toBe('admin');
    });
  });

  // -------------------- resolveCategory --------------------
  describe('resolveCategory - 类别解析', () => {
    it('英文 key 匹配', () => {
      expect(resolveCategory('character')).toBe('character');
      expect(resolveCategory('combat')).toBe('combat');
      expect(resolveCategory('item')).toBe('item');
      expect(resolveCategory('exploration')).toBe('exploration');
      expect(resolveCategory('system')).toBe('system');
      expect(resolveCategory('skill')).toBe('skill');
      expect(resolveCategory('quest')).toBe('quest');
    });

    it('中文 label 匹配', () => {
      expect(resolveCategory('角色')).toBe('character');
      expect(resolveCategory('战斗')).toBe('combat');
      expect(resolveCategory('物品')).toBe('item');
      expect(resolveCategory('探索')).toBe('exploration');
      expect(resolveCategory('系统')).toBe('system');
      expect(resolveCategory('技能')).toBe('skill');
      expect(resolveCategory('任务')).toBe('quest');
    });

    it('无匹配时返回 undefined', () => {
      expect(resolveCategory('unknown')).toBeUndefined();
      expect(resolveCategory('')).toBeUndefined();
    });
  });

  // -------------------- rarityColorKey --------------------
  describe('rarityColorKey - 稀有度颜色', () => {
    it('已知稀有度返回对应颜色', () => {
      expect(rarityColorKey('common')).toBe(STYLE.rarity.common);
      expect(rarityColorKey('uncommon')).toBe(STYLE.rarity.uncommon);
      expect(rarityColorKey('rare')).toBe(STYLE.rarity.rare);
      expect(rarityColorKey('epic')).toBe(STYLE.rarity.epic);
      expect(rarityColorKey('legendary')).toBe(STYLE.rarity.legendary);
    });

    it('未知稀有度返回默认颜色', () => {
      expect(rarityColorKey('unknown')).toBe(STYLE.value);
      expect(rarityColorKey('')).toBe(STYLE.value);
    });
  });

  // -------------------- logTag --------------------
  describe('logTag - 标签输出', () => {
    it('调用 console.log 输出标签行', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logTag('help', '帮助标题');
      expect(logSpy).toHaveBeenCalled();
      const callArgs = logSpy.mock.calls[0];
      expect(callArgs[0]).toBe('%c[help]%c 帮助标题');
      logSpy.mockRestore();
    });
  });

  // -------------------- COMMAND_CATEGORY_LABELS --------------------
  describe('COMMAND_CATEGORY_LABELS - 类别中文映射', () => {
    it('包含全部 7 个类别的中文标签', () => {
      const keys = Object.keys(COMMAND_CATEGORY_LABELS);
      expect(keys).toHaveLength(7);
      expect(COMMAND_CATEGORY_LABELS.character).toBe('角色');
      expect(COMMAND_CATEGORY_LABELS.combat).toBe('战斗');
      expect(COMMAND_CATEGORY_LABELS.item).toBe('物品');
      expect(COMMAND_CATEGORY_LABELS.exploration).toBe('探索');
      expect(COMMAND_CATEGORY_LABELS.system).toBe('系统');
      expect(COMMAND_CATEGORY_LABELS.skill).toBe('技能');
      expect(COMMAND_CATEGORY_LABELS.quest).toBe('任务');
    });
  });
});
