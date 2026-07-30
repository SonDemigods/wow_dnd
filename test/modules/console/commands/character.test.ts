/**
 * @fileoverview 角色类控制台命令单元测试（QA-1）
 *
 * 覆盖 character 命令子模块的 10 个命令：
 *   stats / gold / exp / hp / mp / heal / level / resurrect / buff / resetChar
 *
 * Mock 策略：
 *  - 全量 mock useCharacterStore（gainGold/setHp/setMp/gainExp/reset/applyBonus/resurrect 等）
 *  - 通过 @/modules/console/commands/character 触发命令注册
 *  - 直接调用 exec() 验证命令行为，不依赖 window.cmd 挂载
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock ====================

const characterMock = {
  getCharacterData: vi.fn(),
  gainGold: vi.fn().mockResolvedValue(undefined),
  gainExp: vi.fn().mockResolvedValue(undefined),
  setHp: vi.fn().mockResolvedValue(undefined),
  setMp: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn().mockResolvedValue(undefined),
  resurrect: vi.fn().mockResolvedValue(undefined),
  applyBonus: vi.fn().mockResolvedValue(undefined),
  level: 1,
  currentCharacterId: 'c1',
  effectiveStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  attributes: {
    physicalAttack: 5, physicalDefense: 5,
    magicAttack: 5, magicDefense: 5,
    critChance: 5, dodgeChance: 5,
  },
};

vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => characterMock,
}));

// 触发 character 命令注册
import '@/modules/console/commands/character';
import { exec, getCommands } from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/commands/character - 角色类命令', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 character mock 的 level 默认值
    characterMock.level = 1;
    characterMock.currentCharacterId = 'c1';
    characterMock.getCharacterData.mockReturnValue({
      id: 'c1', name: 'Hero', level: 5,
      hp: 50, maxHp: 100, mana: 30, maxMana: 60,
      gold: 200, exp: 100, expToNextLevel: 500,
      factionId: 'alliance', raceId: 'human', classId: 'warrior',
    });
  });

  // -------------------- stats --------------------
  describe('stats - 显示角色属性', () => {
    it('无角色时返回失败', async () => {
      characterMock.getCharacterData.mockReturnValue(null);
      const result = await exec('stats');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('有角色时输出属性面板', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('stats');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已在上方显示角色完整属性');
      // 验证调用了多次 console.log（属性面板多行输出）
      expect(logSpy.mock.calls.length).toBeGreaterThan(5);
      logSpy.mockRestore();
    });
  });

  // -------------------- gold --------------------
  describe('gold - 添加金币', () => {
    it('有效数量时调用 gainGold', async () => {
      const result = await exec('gold 100');
      expect(result).toEqual({ success: true, message: '已添加 100 金币' });
      expect(characterMock.gainGold).toHaveBeenCalledWith(100);
    });

    it('负数也接受（gainGold 内部处理）', async () => {
      const result = await exec('gold -50');
      expect(result.success).toBe(true);
      expect(characterMock.gainGold).toHaveBeenCalledWith(-50);
    });

    it('非数字参数返回失败', async () => {
      const result = await exec('gold abc');
      expect(result).toEqual({ success: false, message: '请输入有效的数字' });
      expect(characterMock.gainGold).not.toHaveBeenCalled();
    });

    it('缺少参数时 parseInt 返回 NaN 失败', async () => {
      const result = await exec('gold');
      expect(result.success).toBe(false);
      expect(result.message).toBe('请输入有效的数字');
    });
  });

  // -------------------- exp --------------------
  describe('exp - 添加经验值', () => {
    it('有效正整数时调用 gainExp', async () => {
      const result = await exec('exp 500');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已添加 500 经验值');
      expect(characterMock.gainExp).toHaveBeenCalledWith(500);
    });

    it('0 经验值返回失败（必须为正整数）', async () => {
      const result = await exec('exp 0');
      expect(result).toEqual({ success: false, message: '请输入有效的正整数' });
      expect(characterMock.gainExp).not.toHaveBeenCalled();
    });

    it('负数经验值返回失败', async () => {
      const result = await exec('exp -100');
      expect(result).toEqual({ success: false, message: '请输入有效的正整数' });
    });

    it('非数字参数返回失败', async () => {
      const result = await exec('exp abc');
      expect(result).toEqual({ success: false, message: '请输入有效的正整数' });
    });

    it('升级时消息包含等级变化', async () => {
      characterMock.level = 5;
      // 模拟 gainExp 后 level 变为 7
      characterMock.gainExp.mockImplementationOnce(async () => {
        characterMock.level = 7;
      });
      const result = await exec('exp 1000');
      expect(result.success).toBe(true);
      expect(result.message).toContain('从 5 级升到 7 级');
    });
  });

  // -------------------- hp --------------------
  describe('hp - 设置生命值', () => {
    it('有效数值时调用 setHp', async () => {
      const result = await exec('hp 80');
      expect(result).toEqual({ success: true, message: '生命值已设置为 80' });
      expect(characterMock.setHp).toHaveBeenCalledWith(80);
    });

    it('非数字参数返回失败', async () => {
      const result = await exec('hp xyz');
      expect(result).toEqual({ success: false, message: '请输入有效的数字' });
    });
  });

  // -------------------- mp --------------------
  describe('mp - 设置法力值', () => {
    it('有效数值时调用 setMp', async () => {
      const result = await exec('mp 50');
      expect(result).toEqual({ success: true, message: '法力值已设置为 50' });
      expect(characterMock.setMp).toHaveBeenCalledWith(50);
    });

    it('非数字参数返回失败', async () => {
      const result = await exec('mp foo');
      expect(result).toEqual({ success: false, message: '请输入有效的数字' });
    });
  });

  // -------------------- heal --------------------
  describe('heal - 满血满蓝', () => {
    it('无角色时返回失败', async () => {
      characterMock.getCharacterData.mockReturnValue(null);
      const result = await exec('heal');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('有角色时恢复至 maxHp/maxMana', async () => {
      const result = await exec('heal');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已恢复满 HP(100) 和 MP(60)');
      expect(characterMock.setHp).toHaveBeenCalledWith(100);
      expect(characterMock.setMp).toHaveBeenCalledWith(60);
    });
  });

  // -------------------- level --------------------
  describe('level - 设置等级', () => {
    it('非数字返回失败', async () => {
      const result = await exec('level abc');
      expect(result.success).toBe(false);
      expect(result.message).toContain('等级必须在 1');
    });

    it('等级 < 1 返回失败', async () => {
      const result = await exec('level 0');
      expect(result.success).toBe(false);
    });

    it('等级 > MAX_LEVEL 返回失败', async () => {
      const result = await exec('level 999');
      expect(result.success).toBe(false);
    });

    it('目标等级等于当前等级时直接返回成功', async () => {
      characterMock.level = 5;
      const result = await exec('level 5');
      expect(result).toEqual({ success: true, message: '当前已经是 5 级' });
      expect(characterMock.reset).not.toHaveBeenCalled();
      expect(characterMock.gainExp).not.toHaveBeenCalled();
    });

    it('降低等级时先 reset 再加回经验', async () => {
      characterMock.level = 10;
      // reset 后 level 应被 game logic 设为 1，此处不模拟，仅断言调用
      const result = await exec('level 3');
      expect(result.success).toBe(true);
      expect(characterMock.reset).toHaveBeenCalled();
      expect(characterMock.gainExp).toHaveBeenCalled();
    });

    it('升高等级时直接累加差额经验', async () => {
      characterMock.level = 5;
      const result = await exec('level 8');
      expect(result.success).toBe(true);
      expect(characterMock.reset).not.toHaveBeenCalled();
      expect(characterMock.gainExp).toHaveBeenCalled();
    });
  });

  // -------------------- resurrect --------------------
  describe('resurrect - 复活角色', () => {
    it('无选中角色时返回失败', async () => {
      characterMock.currentCharacterId = '';
      const result = await exec('resurrect');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('有选中角色时调用 resurrect', async () => {
      const result = await exec('resurrect');
      expect(result.success).toBe(true);
      expect(result.message).toContain('角色已复活');
      expect(characterMock.resurrect).toHaveBeenCalled();
    });
  });

  // -------------------- buff --------------------
  describe('buff - 属性加成', () => {
    it('缺少参数时返回用法提示', async () => {
      const result = await exec('buff str');
      expect(result.success).toBe(false);
      expect(result.message).toContain('用法: buff <属性名> <数值>');
    });

    it('无效属性返回失败', async () => {
      const result = await exec('buff unknown 10');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无效属性: unknown');
    });

    it('非数值返回失败', async () => {
      const result = await exec('buff str abc');
      expect(result.success).toBe(false);
      expect(result.message).toBe('请输入有效的数值');
    });

    it('有效属性与数值时调用 applyBonus', async () => {
      const result = await exec('buff str 10');
      expect(result).toEqual({ success: true, message: '已应用加成: str+10' });
      expect(characterMock.applyBonus).toHaveBeenCalledWith({ str: 10 });
    });

    it('支持全部 6 种基础属性', async () => {
      const attrs = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const attr of attrs) {
        const result = await exec(`buff ${attr} 5`);
        expect(result.success).toBe(true);
      }
    });

    it('属性名大小写不敏感', async () => {
      const result = await exec('buff STR 10');
      expect(result.success).toBe(true);
      expect(characterMock.applyBonus).toHaveBeenCalledWith({ str: 10 });
    });
  });

  // -------------------- resetChar --------------------
  describe('resetChar - 重置角色', () => {
    it('无选中角色时返回失败', async () => {
      characterMock.currentCharacterId = '';
      const result = await exec('resetChar');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('有选中角色时调用 reset', async () => {
      const result = await exec('resetChar');
      expect(result).toEqual({ success: true, message: '角色已重置为初始状态' });
      expect(characterMock.reset).toHaveBeenCalled();
    });
  });

  // -------------------- 注册验证 --------------------
  describe('命令注册验证', () => {
    it('character 类命令全部已注册', () => {
      const expected = ['stats', 'gold', 'exp', 'hp', 'mp', 'heal', 'level', 'resurrect', 'buff', 'resetchar'];
      for (const name of expected) {
        expect(getCommands().has(name)).toBe(true);
      }
    });
  });
});
