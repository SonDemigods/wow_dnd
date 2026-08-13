/**
 * @fileoverview useConfigTableMeta composable 单元测试
 *
 * 覆盖：
 * 1. currentTable / currentDbTable：按 store.selectedConfigTable 正确映射到 Dexie 表名
 * 2. currentColumns：各配置表分发对应列定义；字典字段注入翻译 format
 * 3. currentFormFields：各配置表分发对应字段定义；参考数据填充时注入下拉选项
 *
 * 使用 createTestPinia（真实 store，action 不 stub），通过修改 store state 验证计算属性。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestPinia } from '../../../utils/setup';
import { useAdminStore } from '@/modules/admin';
import { useConfigTableMeta } from '@/components/admin/composables/useConfigTableMeta';
import type { ConfigTableName } from '@/modules/admin';

describe('useConfigTableMeta 配置表元信息 composable', () => {
  beforeEach(() => {
    createTestPinia();
  });

  describe('currentTable 与 currentDbTable 映射', () => {
    it('初始默认 selectedConfigTable 为 mobs', () => {
      const { currentTable, currentDbTable } = useConfigTableMeta();
      expect(currentTable.value).toBe('mobs');
      expect(currentDbTable.value).toBe('config_mobs');
    });

    it('切换 selectedConfigTable 后 currentDbTable 同步更新', () => {
      const store = useAdminStore();
      const { currentTable, currentDbTable } = useConfigTableMeta();

      const cases: Array<{ table: ConfigTableName; dbTable: string }> = [
        { table: 'factions', dbTable: 'config_factions' },
        { table: 'races', dbTable: 'config_races' },
        { table: 'classes', dbTable: 'config_classes' },
        { table: 'items', dbTable: 'config_items' },
        { table: 'equipmentItems', dbTable: 'config_equipment_items' },
        { table: 'bosses', dbTable: 'config_bosses' },
        { table: 'quests', dbTable: 'config_quests' },
        { table: 'skills', dbTable: 'config_skills' },
        { table: 'locations', dbTable: 'config_locations' },
        { table: 'shops', dbTable: 'config_shops' },
      ];

      for (const { table, dbTable } of cases) {
        store.selectedConfigTable = table;
        expect(currentTable.value).toBe(table);
        expect(currentDbTable.value).toBe(dbTable);
      }
    });
  });

  describe('currentColumns 列定义分发', () => {
    it('factions 表分发 4 列（id/name/icon/color）', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'factions';
      const { currentColumns } = useConfigTableMeta();

      const keys = currentColumns.value.map(c => c.key);
      expect(keys).toEqual(['id', 'name', 'icon', 'color']);
    });

    it('mobs 表分发 6 列（id/name/dangerLevel/maxHp/damage/xp）', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'mobs';
      const { currentColumns } = useConfigTableMeta();

      const keys = currentColumns.value.map(c => c.key);
      expect(keys).toEqual(['id', 'name', 'dangerLevel', 'maxHp', 'damage', 'xp']);
    });

    it('skills 表分发 6 列含 classRestriction', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'skills';
      const { currentColumns } = useConfigTableMeta();

      const keys = currentColumns.value.map(c => c.key);
      expect(keys).toContain('classRestriction');
      expect(keys).toContain('mpCost');
      expect(keys).toContain('unlockLevel');
    });

    it('color 列保留原 format 函数（v==null 返回空串）', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'factions';
      const { currentColumns } = useConfigTableMeta();

      const colorCol = currentColumns.value.find(c => c.key === 'color');
      expect(colorCol?.format).toBeDefined();
      expect(colorCol!.format!(null as never, {} as never)).toBe('');
      expect(colorCol!.format!('red' as never, {} as never)).toBe('red');
    });

    it('rarity 列注入 RARITY_NAMES 翻译 format', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'items';
      const { currentColumns } = useConfigTableMeta();

      const rarityCol = currentColumns.value.find(c => c.key === 'rarity');
      expect(rarityCol?.format).toBeDefined();
      expect(rarityCol!.format!('common' as never, {} as never)).toBe('普通');
      expect(rarityCol!.format!('legendary' as never, {} as never)).toBe('传说');
    });

    it('primaryStat 列注入 STAT_NAMES 翻译 format', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'classes';
      const { currentColumns } = useConfigTableMeta();

      const statCol = currentColumns.value.find(c => c.key === 'primaryStat');
      expect(statCol?.format).toBeDefined();
      expect(statCol!.format!('str' as never, {} as never)).toBe('力量');
      expect(statCol!.format!('cha' as never, {} as never)).toBe('魅力');
    });

    it('damage 数组列注入区间 format', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'mobs';
      const { currentColumns } = useConfigTableMeta();

      const damageCol = currentColumns.value.find(c => c.key === 'damage');
      expect(damageCol?.format).toBeDefined();
      expect(damageCol!.format!([5, 15] as never, {} as never)).toBe('5 ~ 15');
      expect(damageCol!.format!(null as never, {} as never)).toBe('-');
    });

    it('subtype 列翻译：items → ITEM_TYPE_NAMES', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'items';
      const { currentColumns } = useConfigTableMeta();

      const subtypeCol = currentColumns.value.find(c => c.key === 'subtype');
      expect(subtypeCol?.format).toBeDefined();
      expect(subtypeCol!.format!('potion' as never, {} as never)).toBe('药水');
    });

    it('type 列按表名区分翻译：equipmentItems → EQUIP_TYPE_NAMES', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'equipmentItems';
      const { currentColumns } = useConfigTableMeta();

      const typeCol = currentColumns.value.find(c => c.key === 'type');
      expect(typeCol?.format).toBeDefined();
      expect(typeCol!.format!('weapon' as never, {} as never)).toBe('武器');
    });

    it('type 列按表名区分翻译：shops → SHOP_TYPE_NAMES', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'shops';
      const { currentColumns } = useConfigTableMeta();

      const typeCol = currentColumns.value.find(c => c.key === 'type');
      expect(typeCol?.format).toBeDefined();
      expect(typeCol!.format!('potion' as never, {} as never)).toBe('药水');
    });

    it('classRestriction 列：classOptions 为空时返回"无限制"或原值', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'skills';
      // classOptions 默认为空数组
      const { currentColumns } = useConfigTableMeta();

      const col = currentColumns.value.find(c => c.key === 'classRestriction');
      expect(col?.format).toBeDefined();
      expect(col!.format!('' as never, {} as never)).toBe('无限制');
      expect(col!.format!('warrior' as never, {} as never)).toBe('warrior');
    });

    it('classRestriction 列：classOptions 有值时返回中文名', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'skills';
      store.referenceClasses = [{ value: 'warrior', label: '战士' }];
      const { currentColumns } = useConfigTableMeta();

      const col = currentColumns.value.find(c => c.key === 'classRestriction');
      expect(col!.format!('warrior' as never, {} as never)).toBe('战士');
      expect(col!.format!('' as never, {} as never)).toBe('无限制');
    });

    it('factionId 列：factionOptions 有值时注入 FACTION_NAMES 翻译', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'races';
      store.referenceFactions = [{ value: 'alliance', label: '光辉盟约' }];
      const { currentColumns } = useConfigTableMeta();

      const col = currentColumns.value.find(c => c.key === 'factionId');
      expect(col?.format).toBeDefined();
      expect(col!.format!('alliance' as never, {} as never)).toBe('光辉盟约');
      expect(col!.format!('horde' as never, {} as never)).toBe('铁血盟约');
    });
  });

  describe('currentFormFields 表单字段分发', () => {
    it('factions 表分发 5 个字段', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'factions';
      const { currentFormFields } = useConfigTableMeta();

      const keys = currentFormFields.value.map(f => f.key);
      expect(keys).toEqual(['id', 'name', 'icon', 'color', 'description']);
      expect(currentFormFields.value.find(f => f.key === 'color')!.type).toBe('color');
    });

    it('bosses 表包含 phases/intro/skillPool/aiStrategy 字段', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'bosses';
      const { currentFormFields } = useConfigTableMeta();

      const keys = currentFormFields.value.map(f => f.key);
      expect(keys).toContain('phases');
      expect(keys).toContain('intro');
      expect(keys).toContain('skillPool');
      expect(keys).toContain('aiStrategy');
      expect(currentFormFields.value.find(f => f.key === 'phases')!.type).toBe('json');
    });

    it('slots 字段注入装备槽位 multiselect 选项', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'equipmentItems';
      const { currentFormFields } = useConfigTableMeta();

      const slotsField = currentFormFields.value.find(f => f.key === 'slots');
      expect(slotsField?.type).toBe('multiselect');
      expect(slotsField?.options).toBeDefined();
      // P3.1：7 槽（weapon1/weapon2/helm/chest/gloves/legs/boots）
      expect(slotsField!.options!.map(o => o.value)).toEqual(
        expect.arrayContaining(['weapon1', 'helm', 'boots'])
      );
    });

    it('rarity 字段注入 5 档稀有度下拉', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'items';
      const { currentFormFields } = useConfigTableMeta();

      const rarityField = currentFormFields.value.find(f => f.key === 'rarity');
      expect(rarityField?.type).toBe('select');
      expect(rarityField?.options).toBeDefined();
      expect(rarityField!.options!.length).toBe(5);
      expect(rarityField!.options!.map(o => o.value)).toEqual(
        ['common', 'uncommon', 'rare', 'epic', 'legendary']
      );
    });

    it('dangerLevel 字段注入 5 档危险等级下拉', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'mobs';
      const { currentFormFields } = useConfigTableMeta();

      const dangerField = currentFormFields.value.find(f => f.key === 'dangerLevel');
      expect(dangerField?.type).toBe('select');
      expect(dangerField?.options?.length).toBe(5);
      expect(dangerField!.options!.map(o => o.value)).toEqual(
        ['普通', '困难', '危险', '极危险', '致命']
      );
    });

    it('factionId 字段：factionOptions 有值时升级为 select 并注入选项', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'races';
      store.referenceFactions = [
        { value: 'alliance', label: '光辉盟约' },
        { value: 'horde', label: '铁血盟约' },
      ];
      const { currentFormFields } = useConfigTableMeta();

      const field = currentFormFields.value.find(f => f.key === 'factionId');
      expect(field?.type).toBe('select');
      expect(field?.options?.length).toBe(2);
    });

    it('classRestriction 字段：classOptions 有值时注入"无限制"+职业选项', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'skills';
      store.referenceClasses = [{ value: 'warrior', label: '战士' }];
      const { currentFormFields } = useConfigTableMeta();

      const field = currentFormFields.value.find(f => f.key === 'classRestriction');
      expect(field?.type).toBe('select');
      expect(field?.options?.[0]).toEqual({ value: '', label: '无限制' });
      expect(field!.options!.length).toBe(2);
    });

    it('continent 字段：continentOptions 有值时升级为 select', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'locations';
      store.referenceContinents = [{ value: 'kalimdor', label: '卡利姆多' }];
      const { currentFormFields } = useConfigTableMeta();

      const field = currentFormFields.value.find(f => f.key === 'continent');
      expect(field?.type).toBe('select');
      expect(field?.options?.length).toBe(1);
    });

    it('boardId 字段：locationOptions 有值时升级为 select', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'quests';
      store.referenceLocations = [{ value: 'loc_1', label: '艾尔文森林' }];
      const { currentFormFields } = useConfigTableMeta();

      const field = currentFormFields.value.find(f => f.key === 'boardId');
      expect(field?.type).toBe('select');
      expect(field?.options?.length).toBe(1);
    });

    it('factionsIds 字段：factionOptions 有值时升级为 multiselect', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'classes';
      store.referenceFactions = [{ value: 'alliance', label: '光辉盟约' }];
      const { currentFormFields } = useConfigTableMeta();

      const field = currentFormFields.value.find(f => f.key === 'factionsIds');
      expect(field?.type).toBe('multiselect');
    });
  });
});
