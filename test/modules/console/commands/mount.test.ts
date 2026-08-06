/**
 * @fileoverview 坐骑类控制台命令单元测试
 *
 * 覆盖 mount 命令子模块的 4 个子命令：
 *   query / list / set / reset
 *
 * Mock 策略：
 *  - 全量 mock useCharacterStore（setMountChoice/resetMountChoices/getCharacterData）
 *  - 使用真实 config_mounts 数据和 character/service 纯函数（computeMountBonus/isTierUnlocked），
 *    确保命令与真实配置兼容
 *  - 通过 @/modules/console/commands/mount 触发命令注册
 *  - 直接调用 exec() 验证命令行为，不依赖 window.cmd 挂载
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock ====================

const characterMock = {
  getCharacterData: vi.fn(),
  setMountChoice: vi.fn().mockResolvedValue(undefined),
  resetMountChoices: vi.fn().mockResolvedValue(undefined),
  level: 12,
  currentCharacterId: 'c1',
};

vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => characterMock,
}));

// 触发 mount 命令注册（使用真实 config_mounts 和 service 纯函数）
import '@/modules/console/commands/mount';
import { exec, getCommands } from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/commands/mount - 坐骑类命令', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.level = 12;
    characterMock.currentCharacterId = 'c1';
    // 默认角色：12 级，已选 common_str 和 rare_int
    characterMock.getCharacterData.mockReturnValue({
      name: 'TestHero',
      level: 12,
      mountChoices: ['common_str', null, 'rare_int', null, null],
    });
  });

  // -------------------- 命令注册验证 --------------------
  describe('命令注册验证', () => {
    it('mount 命令已注册', () => {
      expect(getCommands().has('mount')).toBe(true);
    });

    it('命令定义包含正确的元数据', () => {
      const cmd = getCommands().get('mount');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('character');
      expect(cmd!.description).toContain('坐骑');
      expect(cmd!.usage).toContain('query');
      expect(cmd!.usage).toContain('set');
    });
  });

  // -------------------- query --------------------
  describe('query - 查询坐骑配置', () => {
    it('无角色时返回失败', async () => {
      characterMock.getCharacterData.mockReturnValue(null);
      const result = await exec('mount query');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('无参数等同 query', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已在上方显示坐骑配置');
      logSpy.mockRestore();
    });

    it('有角色时输出坐骑配置', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount query');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已在上方显示坐骑配置');
      // 验证输出了多行（5 档 + 总加成）
      expect(logSpy.mock.calls.length).toBeGreaterThan(5);
      logSpy.mockRestore();
    });

    it('显示已选方向和总加成', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await exec('mount query');
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      // 已选方向 common_str
      expect(allOutput).toContain('common_str');
      expect(allOutput).toContain('初阶力量专精');
      // 已选方向 rare_int
      expect(allOutput).toContain('rare_int');
      expect(allOutput).toContain('稀有智力专精');
      // 总加成
      expect(allOutput).toContain('+2 力');
      expect(allOutput).toContain('+6 智');
      logSpy.mockRestore();
    });

    it('未解锁档位显示未解锁', async () => {
      characterMock.getCharacterData.mockReturnValue({
        name: 'LowHero',
        level: 3,
        mountChoices: [null, null, null, null, null],
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await exec('mount query');
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      // 1 级解锁 common，3 级时 uncommon(5级) 未解锁
      expect(allOutput).toContain('未解锁');
      logSpy.mockRestore();
    });

    it('无选择时显示暂无坐骑加成', async () => {
      characterMock.getCharacterData.mockReturnValue({
        name: 'NewHero',
        level: 1,
        mountChoices: [null, null, null, null, null],
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount query');
      expect(result.success).toBe(true);
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allOutput).toContain('暂无坐骑加成');
      logSpy.mockRestore();
    });

    it('输出中包含角色等级', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await exec('mount query');
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allOutput).toContain('Lv.12');
      logSpy.mockRestore();
    });
  });

  // -------------------- list --------------------
  describe('list - 列出坐骑方向', () => {
    it('无参数列出全部档位', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount list');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已在上方列出全部坐骑方向');
      // 5 档 × (1 标题 + 6~9 方向) = 大量输出
      expect(logSpy.mock.calls.length).toBeGreaterThan(30);
      logSpy.mockRestore();
    });

    it('按数字索引指定档位', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount list 0');
      expect(result.success).toBe(true);
      expect(result.message).toContain('普通');
      // common 档有 6 个单属性方向
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allOutput).toContain('common_str');
      expect(allOutput).toContain('common_dex');
      logSpy.mockRestore();
    });

    it('按英文名指定档位', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount list legendary');
      expect(result.success).toBe(true);
      expect(result.message).toContain('传说');
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allOutput).toContain('legendary_str_con');
      logSpy.mockRestore();
    });

    it('按中文名指定档位', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount list 史诗');
      expect(result.success).toBe(true);
      expect(result.message).toContain('史诗');
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allOutput).toContain('epic_str_con');
      logSpy.mockRestore();
    });

    it('双属性档列出 9 个方向', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await exec('mount list epic');
      const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      // epic 档有 9 个双属性方向
      expect(allOutput).toContain('epic_str_con');
      expect(allOutput).toContain('epic_int_wis');
      expect(allOutput).toContain('epic_dex_wis');
      expect(allOutput).toContain('双属性');
      logSpy.mockRestore();
    });

    it('无效档位返回失败', async () => {
      const result = await exec('mount list invalid');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无效档位: invalid');
      expect(result.message).toContain('0-4');
    });

    it('档位索引越界返回失败', async () => {
      const result = await exec('mount list 9');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无效档位');
    });
  });

  // -------------------- set --------------------
  describe('set - 设置坐骑方向', () => {
    it('缺少参数返回用法提示', async () => {
      const result = await exec('mount set');
      expect(result.success).toBe(false);
      expect(result.message).toContain('用法: mount set');
    });

    it('仅提供档位缺少方向返回用法提示', async () => {
      const result = await exec('mount set 0');
      expect(result.success).toBe(false);
      expect(result.message).toContain('用法: mount set');
    });

    it('无角色时返回失败', async () => {
      characterMock.getCharacterData.mockReturnValue(null);
      const result = await exec('mount set 0 common_str');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('无效档位返回失败', async () => {
      const result = await exec('mount set invalid common_str');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无效档位: invalid');
    });

    it('无效方向ID返回失败', async () => {
      const result = await exec('mount set 0 not_exist');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无效坐骑方向: not_exist');
      expect(characterMock.setMountChoice).not.toHaveBeenCalled();
    });

    it('方向不属于该档位返回失败', async () => {
      const result = await exec('mount set 0 rare_int');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不属于普通档');
      expect(characterMock.setMountChoice).not.toHaveBeenCalled();
    });

    it('成功设置方向', async () => {
      const result = await exec('mount set 0 common_str');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已设置普通档为 初阶力量专精');
      expect(result.message).toContain('common_str');
      expect(characterMock.setMountChoice).toHaveBeenCalledWith(0, 'common_str');
    });

    it('成功设置双属性方向', async () => {
      const result = await exec('mount set 4 legendary_str_con');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已设置传说档为 传说蛮力体魄');
      expect(characterMock.setMountChoice).toHaveBeenCalledWith(4, 'legendary_str_con');
    });

    it('按英文名指定档位设置', async () => {
      const result = await exec('mount set uncommon uncommon_dex');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已设置优秀档');
      expect(characterMock.setMountChoice).toHaveBeenCalledWith(1, 'uncommon_dex');
    });

    it('按中文名指定档位设置', async () => {
      const result = await exec('mount set 稀有 rare_wis');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已设置稀有档');
      expect(characterMock.setMountChoice).toHaveBeenCalledWith(2, 'rare_wis');
    });

    it('clear 清除选择', async () => {
      const result = await exec('mount set 0 clear');
      expect(result.success).toBe(true);
      expect(result.message).toContain('已清除普通档的坐骑选择');
      expect(characterMock.setMountChoice).toHaveBeenCalledWith(0, null);
    });

    it('CLEAR 大写也识别为清除', async () => {
      const result = await exec('mount set 0 CLEAR');
      expect(result.success).toBe(true);
      expect(characterMock.setMountChoice).toHaveBeenCalledWith(0, null);
    });

    it('setMountChoice 抛错时返回失败', async () => {
      characterMock.setMountChoice.mockRejectedValueOnce(
        new Error('档位 传说 未解锁（需 20 级）')
      );
      const result = await exec('mount set 4 legendary_str_con');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未解锁');
    });
  });

  // -------------------- reset --------------------
  describe('reset - 重置坐骑选择', () => {
    it('无角色时返回失败', async () => {
      characterMock.getCharacterData.mockReturnValue(null);
      const result = await exec('mount reset');
      expect(result).toEqual({ success: false, message: '当前没有选中角色' });
    });

    it('成功重置所有坐骑选择', async () => {
      const result = await exec('mount reset');
      expect(result).toEqual({ success: true, message: '已重置所有坐骑选择' });
      expect(characterMock.resetMountChoices).toHaveBeenCalled();
    });
  });

  // -------------------- 子命令路由 --------------------
  describe('子命令路由', () => {
    it('无效子命令返回失败', async () => {
      const result = await exec('mount unknown');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未知子命令: unknown');
      expect(result.message).toContain('query');
      expect(result.message).toContain('reset');
    });

    it('子命令大小写不敏感', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('mount QUERY');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已在上方显示坐骑配置');
      logSpy.mockRestore();
    });
  });
});
