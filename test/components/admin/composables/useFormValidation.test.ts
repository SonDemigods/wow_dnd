/**
 * @fileoverview useFormValidation 表单校验引擎单元测试
 *
 * 覆盖：
 * 1. required 校验（空字符串/null/undefined/空数组）
 * 2. pattern 校验（正则匹配/不匹配/patternMessage）
 * 3. min/max 数值范围校验
 * 4. minLength/maxLength 文本长度校验
 * 5. json 格式校验
 * 6. validate 全量校验返回 boolean
 * 7. validateField 单字段校验
 * 8. clearErrors 清空错误
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { useFormValidation } from '@/components/admin/composables/useFormValidation';
import type { FormField } from '@/components/admin/fields/types';

describe('useFormValidation 表单校验引擎', () => {
  let formData: Record<string, unknown>;

  beforeEach(() => {
    formData = reactive({});
  });

  describe('required 校验', () => {
    it('必填字段为空字符串时返回错误', () => {
      const fields: FormField[] = [
        { key: 'name', label: '名称', type: 'text', required: true },
      ];
      formData.name = '';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
    });

    it('必填字段为 null 时返回错误', () => {
      const fields: FormField[] = [
        { key: 'name', label: '名称', type: 'text', required: true },
      ];
      formData.name = null;
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
    });

    it('必填 multiselect 为空数组时返回错误', () => {
      const fields: FormField[] = [
        { key: 'tags', label: '标签', type: 'multiselect', required: true },
      ];
      formData.tags = [];
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
    });

    it('必填字段有值时通过', () => {
      const fields: FormField[] = [
        { key: 'name', label: '名称', type: 'text', required: true },
      ];
      formData.name = '战士';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });

    it('非必填字段为空时通过', () => {
      const fields: FormField[] = [
        { key: 'desc', label: '描述', type: 'textarea' },
      ];
      formData.desc = '';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });
  });

  describe('pattern 校验', () => {
    it('正则匹配时通过', () => {
      const fields: FormField[] = [
        { key: 'code', label: '代码', type: 'text', pattern: '^[a-z_]+$' },
      ];
      formData.code = 'warrior_arms';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });

    it('正则不匹配时返回错误', () => {
      const fields: FormField[] = [
        { key: 'code', label: '代码', type: 'text', pattern: '^[a-z_]+$' },
      ];
      formData.code = 'Warrior123';
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.code).toBe('格式不正确');
    });

    it('自定义 patternMessage', () => {
      const fields: FormField[] = [
        { key: 'code', label: '代码', type: 'text', pattern: '^\\d+$', patternMessage: '只能输入数字' },
      ];
      formData.code = 'abc';
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.code).toBe('只能输入数字');
    });
  });

  describe('min/max 数值范围校验', () => {
    it('小于 min 时返回错误', () => {
      const fields: FormField[] = [
        { key: 'hp', label: '生命值', type: 'number', min: 1 },
      ];
      formData.hp = 0;
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.hp).toBe('不能小于 1');
    });

    it('大于 max 时返回错误', () => {
      const fields: FormField[] = [
        { key: 'level', label: '等级', type: 'number', max: 100 },
      ];
      formData.level = 101;
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.level).toBe('不能大于 100');
    });

    it('在 min-max 范围内时通过', () => {
      const fields: FormField[] = [
        { key: 'hp', label: '生命值', type: 'number', min: 1, max: 9999 },
      ];
      formData.hp = 100;
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });

    it('number 字段值为字符串时也能正确校验', () => {
      const fields: FormField[] = [
        { key: 'hp', label: '生命值', type: 'number', min: 1 },
      ];
      formData.hp = '50';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });
  });

  describe('minLength/maxLength 文本长度校验', () => {
    it('文本长度小于 minLength 时返回错误', () => {
      const fields: FormField[] = [
        { key: 'name', label: '名称', type: 'text', minLength: 3 },
      ];
      formData.name = 'ab';
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.name).toBe('至少 3 个字符');
    });

    it('文本长度大于 maxLength 时返回错误', () => {
      const fields: FormField[] = [
        { key: 'name', label: '名称', type: 'text', maxLength: 5 },
      ];
      formData.name = 'abcdefg';
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.name).toBe('最多 5 个字符');
    });
  });

  describe('json 格式校验', () => {
    it('合法 JSON 通过', () => {
      const fields: FormField[] = [
        { key: 'bonus', label: '加成', type: 'json' },
      ];
      formData.bonus = '{"str": 3, "con": 1}';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });

    it('非法 JSON 返回错误', () => {
      const fields: FormField[] = [
        { key: 'bonus', label: '加成', type: 'json' },
      ];
      formData.bonus = '{str: 3}';
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.bonus).toBe('JSON 格式不正确');
    });

    it('空 JSON 字符串跳过校验', () => {
      const fields: FormField[] = [
        { key: 'bonus', label: '加成', type: 'json' },
      ];
      formData.bonus = '';
      const { validate } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
    });
  });

  describe('validate 全量校验', () => {
    it('多字段全部通过时返回 true', () => {
      const fields: FormField[] = [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: '名称', type: 'text', required: true },
        { key: 'hp', label: '生命值', type: 'number', min: 1 },
      ];
      formData.id = 'mob_1';
      formData.name = '哥布林';
      formData.hp = 100;
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(true);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('多字段部分失败时返回 false 并填充 errors', () => {
      const fields: FormField[] = [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: '名称', type: 'text', required: true },
        { key: 'hp', label: '生命值', type: 'number', min: 1 },
      ];
      formData.id = '';
      formData.name = '哥布林';
      formData.hp = 0;
      const { validate, errors } = useFormValidation(fields, formData);
      expect(validate()).toBe(false);
      expect(errors.id).toBe('此字段为必填');
      expect(errors.hp).toBe('不能小于 1');
      expect(errors.name).toBeUndefined();
    });
  });

  describe('validateField 单字段校验', () => {
    it('校验单字段并更新 errors', () => {
      const fields: FormField[] = [
        { key: 'id', label: 'ID', type: 'text', required: true },
      ];
      formData.id = '';
      const { validateField, errors } = useFormValidation(fields, formData);
      validateField('id');
      expect(errors.id).toBe('此字段为必填');

      formData.id = 'valid_id';
      validateField('id');
      expect(errors.id).toBeUndefined();
    });
  });

  describe('clearErrors 清空错误', () => {
    it('清空所有错误信息', () => {
      const fields: FormField[] = [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: '名称', type: 'text', required: true },
      ];
      formData.id = '';
      formData.name = '';
      const { validate, clearErrors, errors } = useFormValidation(fields, formData);
      validate();
      expect(Object.keys(errors).length).toBeGreaterThan(0);

      clearErrors();
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
