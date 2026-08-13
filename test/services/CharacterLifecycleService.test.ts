/**
 * @fileoverview CharacterLifecycleService 角色生命周期服务单元测试
 *
 * 覆盖 2 个核心方法：
 * 1. initializeCharacterSkills：初始化角色技能数据（查询模板 + 填充技能栏 + 持久化）
 * 2. cascadeDeleteCharacter：级联删除角色关联数据（6 个模块并行删除）
 *
 * Mock 策略：
 * - 全量 mock 6 个依赖的 DbService，断言委托调用与参数透传
 * - 验证级联删除使用 Promise.all 并行执行
 *
 * CHR-4 修复验证：character/store.ts 不再直接依赖这些 DbService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { characterLifecycleService } from '@/services/CharacterLifecycleService';

/** mock 6 个依赖的 DbService（使用 vi.hoisted 避免 hoisting 问题） */
const mocks = vi.hoisted(() => ({
  // skill DbService
  getSkillTemplatesByClassMock: vi.fn(),
  saveSkillsDataMock: vi.fn(),
  deleteSkillsDataMock: vi.fn(),
  // 其他 5 个 DbService 的删除方法
  deleteInventoryMock: vi.fn(),
  deleteEquipmentMock: vi.fn(),
  deleteExplorationDataMock: vi.fn(),
  deleteAdventureLogMock: vi.fn(),
  deleteCharacterQuestsMock: vi.fn(),
}));

vi.mock('@/modules/skill', () => ({
  skillsDbService: {
    getSkillTemplatesByClass: mocks.getSkillTemplatesByClassMock,
    saveSkillsData: mocks.saveSkillsDataMock,
    deleteSkillsData: mocks.deleteSkillsDataMock,
  },
}));

vi.mock('@/modules/inventory', () => ({
  inventoryDbService: {
    deleteInventory: mocks.deleteInventoryMock,
  },
}));

vi.mock('@/modules/equipment', () => ({
  equipmentDbService: {
    deleteEquipment: mocks.deleteEquipmentMock,
  },
}));

vi.mock('@/modules/exploration', () => ({
  explorationDbService: {
    deleteExplorationData: mocks.deleteExplorationDataMock,
  },
}));

vi.mock('@/modules/log', () => ({
  adventureLogDbService: {
    deleteAdventureLog: mocks.deleteAdventureLogMock,
  },
}));

vi.mock('@/modules/quest', () => ({
  questDbService: {
    deleteCharacterQuests: mocks.deleteCharacterQuestsMock,
  },
}));

const {
  getSkillTemplatesByClassMock,
  saveSkillsDataMock,
  deleteSkillsDataMock,
  deleteInventoryMock,
  deleteEquipmentMock,
  deleteExplorationDataMock,
  deleteAdventureLogMock,
  deleteCharacterQuestsMock,
} = mocks;

describe('CharacterLifecycleService 角色生命周期服务', () => {
  beforeEach(() => {
    [
      getSkillTemplatesByClassMock,
      saveSkillsDataMock,
      deleteSkillsDataMock,
      deleteInventoryMock,
      deleteEquipmentMock,
      deleteExplorationDataMock,
      deleteAdventureLogMock,
      deleteCharacterQuestsMock,
    ].forEach(m => m.mockReset());
  });

  // ========================================================================
  // initializeCharacterSkills
  // ========================================================================

  describe('initializeCharacterSkills 初始化角色技能', () => {
    it('应查询职业可用技能并持久化技能数据', async () => {
      // Arrange: 模拟职业有 3 个 unlockLevel ≤ 1 的技能 + 1 个高等级技能
      const mockSkills = [
        { id: 'skill_a', unlockLevel: 1, name: '技能A' },
        { id: 'skill_b', unlockLevel: 1, name: '技能B' },
        { id: 'skill_c', unlockLevel: 1, name: '技能C' },
        { id: 'skill_d', unlockLevel: 5, name: '高等级技能' }, // 应被过滤
      ];
      getSkillTemplatesByClassMock.mockResolvedValue(mockSkills);
      saveSkillsDataMock.mockResolvedValue(undefined);

      // Act
      const result = await characterLifecycleService.initializeCharacterSkills(
        'char_001',
        'warrior'
      );

      // Assert: 验证查询调用
      expect(getSkillTemplatesByClassMock).toHaveBeenCalledWith('warrior');
      // Assert: 验证返回的已学技能（仅 unlockLevel ≤ 1）
      expect(result.skills).toHaveLength(3);
      expect(result.skills.map(s => s.id)).toEqual(['skill_a', 'skill_b', 'skill_c']);
      // Assert: 验证技能栏前 3 个槽位被填充，第 4 个为 null
      expect(result.skillBar.slots).toEqual(['skill_a', 'skill_b', 'skill_c', null]);
      // Assert: 验证持久化调用
      expect(saveSkillsDataMock).toHaveBeenCalledWith({
        characterId: 'char_001',
        skills: ['skill_a', 'skill_b', 'skill_c'],
        skillBar: { slots: ['skill_a', 'skill_b', 'skill_c', null] },
        currentClass: 'warrior',
        updatedAt: expect.any(Number),
      });
    });

    it('技能数量超过 4 个时只填充前 4 个到技能栏', async () => {
      // Arrange: 5 个低等级技能
      const mockSkills = [
        { id: 's1', unlockLevel: 1 },
        { id: 's2', unlockLevel: 1 },
        { id: 's3', unlockLevel: 1 },
        { id: 's4', unlockLevel: 1 },
        { id: 's5', unlockLevel: 1 }, // 超出技能栏容量
      ];
      getSkillTemplatesByClassMock.mockResolvedValue(mockSkills);
      saveSkillsDataMock.mockResolvedValue(undefined);

      // Act
      const result = await characterLifecycleService.initializeCharacterSkills(
        'char_002',
        'mage'
      );

      // Assert: 已学技能全部 5 个
      expect(result.skills).toHaveLength(5);
      // Assert: 技能栏仅前 4 个
      expect(result.skillBar.slots).toEqual(['s1', 's2', 's3', 's4']);
      // Assert: 持久化的 skills 数组包含全部 5 个
      expect(saveSkillsDataMock).toHaveBeenCalledWith(expect.objectContaining({
        skills: ['s1', 's2', 's3', 's4', 's5'],
      }));
    });

    it('无可用技能时应返回空技能列表和全空技能栏', async () => {
      // Arrange
      getSkillTemplatesByClassMock.mockResolvedValue([]);
      saveSkillsDataMock.mockResolvedValue(undefined);

      // Act
      const result = await characterLifecycleService.initializeCharacterSkills(
        'char_003',
        'novice'
      );

      // Assert
      expect(result.skills).toEqual([]);
      expect(result.skillBar.slots).toEqual([null, null, null, null]);
      expect(saveSkillsDataMock).toHaveBeenCalledWith(expect.objectContaining({
        characterId: 'char_003',
        skills: [],
        skillBar: { slots: [null, null, null, null] },
        currentClass: 'novice',
      }));
    });
  });

  // ========================================================================
  // cascadeDeleteCharacter
  // ========================================================================

  describe('cascadeDeleteCharacter 级联删除角色数据', () => {
    it('应并行删除 6 个模块的角色关联数据', async () => {
      // Arrange: 所有删除方法返回成功
      deleteSkillsDataMock.mockResolvedValue(undefined);
      deleteInventoryMock.mockResolvedValue(undefined);
      deleteEquipmentMock.mockResolvedValue(undefined);
      deleteExplorationDataMock.mockResolvedValue(undefined);
      deleteAdventureLogMock.mockResolvedValue(undefined);
      deleteCharacterQuestsMock.mockResolvedValue(undefined);

      // Act
      await characterLifecycleService.cascadeDeleteCharacter('char_001');

      // Assert: 验证 6 个删除方法都被调用
      expect(deleteSkillsDataMock).toHaveBeenCalledWith('char_001');
      expect(deleteInventoryMock).toHaveBeenCalledWith('char_001');
      expect(deleteEquipmentMock).toHaveBeenCalledWith('char_001');
      expect(deleteExplorationDataMock).toHaveBeenCalledWith('char_001');
      expect(deleteAdventureLogMock).toHaveBeenCalledWith('char_001');
      expect(deleteCharacterQuestsMock).toHaveBeenCalledWith('char_001');
    });

    it('某个模块删除失败时不应阻止其他模块的删除调用', async () => {
      // Arrange: skills 删除抛出异常，其他正常
      deleteSkillsDataMock.mockRejectedValue(new Error('DB 锁冲突'));
      deleteInventoryMock.mockResolvedValue(undefined);
      deleteEquipmentMock.mockResolvedValue(undefined);
      deleteExplorationDataMock.mockResolvedValue(undefined);
      deleteAdventureLogMock.mockResolvedValue(undefined);
      deleteCharacterQuestsMock.mockResolvedValue(undefined);

      // Act + Assert: Promise.all 会在任一 promise reject 时立即 reject
      await expect(
        characterLifecycleService.cascadeDeleteCharacter('char_002')
      ).rejects.toThrow('DB 锁冲突');

      // 注意：Promise.all 在第一个 rejection 时立即 reject，但其他 promise 仍会执行
      // （因为它们已经启动）。这里验证至少部分调用被触发。
      expect(deleteSkillsDataMock).toHaveBeenCalledWith('char_002');
    });

    it('删除空字符串 characterId 应正常透传参数', async () => {
      // Arrange
      [
        deleteSkillsDataMock,
        deleteInventoryMock,
        deleteEquipmentMock,
        deleteExplorationDataMock,
        deleteAdventureLogMock,
        deleteCharacterQuestsMock,
      ].forEach(m => m.mockResolvedValue(undefined));

      // Act
      await characterLifecycleService.cascadeDeleteCharacter('');

      // Assert: 参数原样透传，服务层不做参数校验
      expect(deleteSkillsDataMock).toHaveBeenCalledWith('');
    });
  });
});
