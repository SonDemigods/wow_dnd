/**
 * @fileoverview 技能模块数据层（skill/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveSkillsData / getSkillsData / deleteSkillsData：角色技能表 char_skills 的 CRUD
 *    + 防御性校验（skills / skillBar.slots 非数组时回退默认值）
 *  - saveSkillTemplate / getSkillTemplate / getAllSkillTemplates / deleteSkillTemplate：
 *    技能模板表 config_skills 的 CRUD + toSkill 字段映射
 *  - getSkillTemplatesByClass：where('classRestriction').equals() 索引查询
 *  - getMonsterSkillTemplates：where('usableBy').anyOf('enemy','both') 查询
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 char_skills 与 config_skills 两张表，避免用例间污染
 *  - 不 mock db service，确保 put/get/delete/toArray/where 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { skillsDbService } from '@/modules/skill/db';
import { db } from '@/modules/data/core';
import type { Skill, SkillsData, SkillTemplateStorage, SkillBuffEffect } from '@/modules/skill/types';

// ==================== 测试数据构造 helper ====================

function makeSkill(o: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: '猛击',
    icon: 'game-icons:sword-brandish',
    description: '对敌人造成物理伤害',
    mpCost: 5,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 20 },
    unlockLevel: 1,
    ...o,
  } as Skill;
}

function makeSkillsData(o: Partial<SkillsData> = {}): SkillsData {
  return {
    characterId: 'char-1',
    skills: ['skill-1', 'skill-2'],
    skillBar: { slots: ['skill-1', null, null, null] },
    currentClass: 'warrior',
    updatedAt: 1700000000000,
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('SkillsDbService - 技能数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    // 清空两张相关表，确保每个用例从空库开始
    await Promise.all([
      db.char_skills.clear(),
      db.config_skills.clear(),
    ]);
  });

  // -------------------- 角色技能表 char_skills --------------------

  describe('saveSkillsData / getSkillsData：角色技能数据读写', () => {
    it('保存后可读回完整数据', async () => {
      // Arrange
      const data = makeSkillsData();
      // Act
      await skillsDbService.saveSkillsData(data);
      const result = await skillsDbService.getSkillsData('char-1');
      // Assert
      expect(result).toEqual(data);
    });

    it('角色不存在时返回默认空数据（skills=[]、slots 全空、currentClass=null）', async () => {
      // Arrange & Act
      const result = await skillsDbService.getSkillsData('non-existent');
      // Assert
      expect(result.characterId).toBe('non-existent');
      expect(result.skills).toEqual([]);
      expect(result.skillBar.slots).toEqual([null, null, null, null]);
      expect(result.currentClass).toBeNull();
      expect(result.updatedAt).toBeTypeOf('number');
    });
  });

  describe('getSkillsData 防御性校验', () => {
    it('skills 不是数组时回退为 []', async () => {
      // Arrange：直接写入损坏数据，模拟旧版本/数据异常
      await db.char_skills.put({
        characterId: 'char-1',
        skills: 'not-an-array',
        skillBar: { slots: [null, null, null, null] },
        currentClass: null,
        updatedAt: 1700000000000,
      } as unknown as SkillsData);
      // Act
      const result = await skillsDbService.getSkillsData('char-1');
      // Assert
      expect(result.skills).toEqual([]);
    });

    it('skillBar.slots 不是数组时回退为全空槽位', async () => {
      // Arrange：skillBar.slots 字段格式异常
      await db.char_skills.put({
        characterId: 'char-1',
        skills: ['skill-1'],
        skillBar: { slots: 'broken' },
        currentClass: 'warrior',
        updatedAt: 1700000000000,
      } as unknown as SkillsData);
      // Act
      const result = await skillsDbService.getSkillsData('char-1');
      // Assert
      expect(result.skillBar.slots).toEqual([null, null, null, null]);
      expect(result.skills).toEqual(['skill-1']);
    });
  });

  describe('deleteSkillsData：删除角色技能数据', () => {
    it('删除后 getSkillsData 返回默认空数据', async () => {
      // Arrange
      await skillsDbService.saveSkillsData(makeSkillsData());
      expect((await skillsDbService.getSkillsData('char-1')).skills).toHaveLength(2);
      // Act
      await skillsDbService.deleteSkillsData('char-1');
      // Assert
      const result = await skillsDbService.getSkillsData('char-1');
      expect(result.skills).toEqual([]);
      expect(result.skillBar.slots).toEqual([null, null, null, null]);
    });

    it('删除不存在记录不抛错', async () => {
      // Arrange & Act & Assert
      await expect(skillsDbService.deleteSkillsData('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- 技能模板表 config_skills --------------------

  describe('saveSkillTemplate / getSkillTemplate：模板读写与 toSkill 字段转换', () => {
    it('保存后可读回，字段类型被 toSkill 正确转换', async () => {
      // Arrange
      const skill = makeSkill({
        id: 'warrior_skill_1',
        name: '顺劈斩',
        targetType: 'all_enemies',
        usableBy: 'player',
        cooldown: 3,
      });
      await skillsDbService.saveSkillTemplate(skill, 'warrior');
      // Act
      const result = await skillsDbService.getSkillTemplate('warrior_skill_1');
      // Assert
      expect(result).not.toBeNull();
      expect(result!.id).toBe('warrior_skill_1');
      expect(result!.name).toBe('顺劈斩');
      expect(result!.type).toBe('physical_damage');
      expect(result!.effect).toEqual({ type: 'physical_damage', value: 20 });
      expect(result!.targetType).toBe('all_enemies');
      expect(result!.usableBy).toBe('player');
      expect(result!.cooldown).toBe(3);
    });

    it('模板不存在时 getSkillTemplate 返回 null', async () => {
      // Arrange & Act
      const result = await skillsDbService.getSkillTemplate('non-existent');
      // Assert
      expect(result).toBeNull();
    });

    it('effect 缺失时默认为物理伤害回退（value=0）', async () => {
      // Arrange：直接写入缺失 effect 的模板，模拟旧版本数据
      await db.config_skills.put({
        id: 'no-effect',
        name: '无效果技能',
        icon: 'icon',
        description: '',
        mpCost: 0,
        type: 'physical_damage',
        unlockLevel: 1,
        classRestriction: null,
      } as unknown as SkillTemplateStorage);
      // Act
      const result = await skillsDbService.getSkillTemplate('no-effect');
      // Assert
      expect(result).not.toBeNull();
      expect(result!.effect).toEqual({ type: 'physical_damage', value: 0 });
    });

    it('buffs 为 null 时转换为 undefined', async () => {
      // Arrange：直接写入 buffs=null 的模板
      await db.config_skills.put({
        id: 'buff-null',
        name: '增益技能',
        icon: 'icon',
        description: '',
        mpCost: 5,
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        unlockLevel: 1,
        classRestriction: null,
        buffs: null,
      } as unknown as SkillTemplateStorage);
      // Act
      const result = await skillsDbService.getSkillTemplate('buff-null');
      // Assert
      expect(result).not.toBeNull();
      expect(result!.buffs).toBeUndefined();
    });

    it('buffs 正常数组时被浅拷贝返回', async () => {
      // Arrange
      const buffs: SkillBuffEffect[] = [
        { type: 'attack_up', value: 10, turns: 3 },
      ];
      const skill = makeSkill({
        id: 'buff-normal',
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        buffs,
      });
      await skillsDbService.saveSkillTemplate(skill);
      // Act
      const result = await skillsDbService.getSkillTemplate('buff-normal');
      // Assert
      expect(result!.buffs).toEqual([{ type: 'attack_up', value: 10, turns: 3 }]);
    });

    it('cooldown 为 0 时保持 0（用 ?? 而非 ||，避免误判为 falsy）', async () => {
      // Arrange
      const skill = makeSkill({ id: 'zero-cd', cooldown: 0 });
      await skillsDbService.saveSkillTemplate(skill);
      // Act
      const result = await skillsDbService.getSkillTemplate('zero-cd');
      // Assert
      expect(result!.cooldown).toBe(0);
    });

    it('cooldown 未提供时默认为 0', async () => {
      // Arrange：saveSkillTemplate 内部 cooldown ?? 0，未提供则存 0
      const skill = makeSkill({ id: 'default-cd' });
      await skillsDbService.saveSkillTemplate(skill);
      // Act
      const result = await skillsDbService.getSkillTemplate('default-cd');
      // Assert
      expect(result!.cooldown).toBe(0);
    });
  });

  describe('getAllSkillTemplates：批量读取', () => {
    it('空表返回空数组', async () => {
      // Arrange & Act
      const result = await skillsDbService.getAllSkillTemplates();
      // Assert
      expect(result).toEqual([]);
    });

    it('多模板全部返回，且字段被 toSkill 转换', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'a', name: 'A' }));
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'b', name: 'B' }));
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'c', name: 'C' }));
      // Act
      const result = await skillsDbService.getAllSkillTemplates();
      // Assert
      expect(result).toHaveLength(3);
      const ids = result.map(s => s.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getSkillTemplatesByClass：按职业索引查询', () => {
    it('使用 classRestriction 索引，只返回指定职业的技能', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'w-1' }), 'warrior');
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'w-2' }), 'warrior');
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'm-1' }), 'mage');
      // Act
      const result = await skillsDbService.getSkillTemplatesByClass('warrior');
      // Assert
      expect(result).toHaveLength(2);
      const ids = result.map(s => s.id).sort();
      expect(ids).toEqual(['w-1', 'w-2']);
    });

    it('该职业无技能时返回空数组', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'w-1' }), 'warrior');
      // Act
      const result = await skillsDbService.getSkillTemplatesByClass('mage');
      // Assert
      expect(result).toEqual([]);
    });

    it('classRestriction 为 null（无限制）的技能不会被职业查询命中', async () => {
      // Arrange：不传 classRestriction 时存储为 null
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'common-1' }));
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'w-1' }), 'warrior');
      // Act
      const result = await skillsDbService.getSkillTemplatesByClass('warrior');
      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('w-1');
    });
  });

  describe('getMonsterSkillTemplates：怪物技能查询', () => {
    it('返回 usableBy 为 enemy 或 both 的技能', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'p-1', usableBy: 'player' }));
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'e-1', usableBy: 'enemy' }));
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'b-1', usableBy: 'both' }));
      // Act
      const result = await skillsDbService.getMonsterSkillTemplates();
      // Assert
      expect(result).toHaveLength(2);
      const ids = result.map(s => s.id).sort();
      expect(ids).toEqual(['b-1', 'e-1']);
    });

    it('无怪物技能时返回空数组', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'p-1', usableBy: 'player' }));
      // Act
      const result = await skillsDbService.getMonsterSkillTemplates();
      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('deleteSkillTemplate：删除模板', () => {
    it('删除后 getSkillTemplate 返回 null', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'del' }));
      expect(await skillsDbService.getSkillTemplate('del')).not.toBeNull();
      // Act
      await skillsDbService.deleteSkillTemplate('del');
      // Assert
      expect(await skillsDbService.getSkillTemplate('del')).toBeNull();
    });

    it('删除不影响其他模板', async () => {
      // Arrange
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'a' }));
      await skillsDbService.saveSkillTemplate(makeSkill({ id: 'b' }));
      // Act
      await skillsDbService.deleteSkillTemplate('a');
      // Assert
      expect(await skillsDbService.getSkillTemplate('a')).toBeNull();
      expect(await skillsDbService.getSkillTemplate('b')).not.toBeNull();
      expect(await skillsDbService.getAllSkillTemplates()).toHaveLength(1);
    });

    it('删除不存在的模板不抛错', async () => {
      // Arrange & Act & Assert
      await expect(skillsDbService.deleteSkillTemplate('non-existent')).resolves.toBeUndefined();
    });
  });
});
