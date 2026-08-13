/**
 * @fileoverview AdminForm 表单校验引擎
 *
 * 提供基于 FormField 定义的客户端校验：
 * - required：非空校验
 * - pattern：正则校验
 * - min/max：数值范围校验
 * - minLength/maxLength：文本长度校验
 * - json：JSON 格式校验
 *
 * 使用方式：
 * ```ts
 * const { errors, validate, validateField } = useFormValidation(fields, formData);
 * if (validate()) { // 提交 }
 * ```
 */
import { reactive } from 'vue';
import type { FormField, FormFieldValue } from '@/components/admin/fields/types';

/** 字段错误信息映射 */
export type FieldErrors = Record<string, string>;

/**
 * 表单校验 composable
 *
 * @param fields - 表单字段定义列表
 * @param formData - 表单数据（reactive 对象）
 * @returns errors 响应式错误映射 + validate 全量校验 + validateField 单字段校验
 */
export function useFormValidation(
  fields: FormField[],
  formData: Record<string, FormFieldValue>,
) {
  /** 响应式错误信息 */
  const errors = reactive<FieldErrors>({});

  /**
   * 校验单个字段
   * @param field - 字段定义
   * @returns 错误信息（空字符串表示通过）
   */
  function validateField(field: FormField): string {
    const value = formData[field.key];

    // required 校验
    if (field.required) {
      if (value === null || value === undefined || value === '') {
        return '此字段为必填';
      }
      if (Array.isArray(value) && value.length === 0) {
        return '此字段为必填';
      }
    }

    // 非必填字段且值为空时跳过后续校验
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty && !field.required) return '';

    // pattern 校验（仅对 text/textarea 类型）
    if (field.pattern && (field.type === 'text' || field.type === 'textarea')) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(String(value))) {
        return field.patternMessage || '格式不正确';
      }
    }

    // min/max 校验（仅对 number 类型）
    if (field.type === 'number') {
      const numValue = typeof value === 'string' ? Number(value) : Number(value);
      if (!isNaN(numValue)) {
        if (field.min !== undefined && numValue < field.min) {
          return `不能小于 ${field.min}`;
        }
        if (field.max !== undefined && numValue > field.max) {
          return `不能大于 ${field.max}`;
        }
      }
    }

    // minLength/maxLength 校验（仅对 text/textarea 类型）
    if (field.minLength !== undefined || field.maxLength !== undefined) {
      const strValue = String(value);
      if (field.minLength !== undefined && strValue.length < field.minLength) {
        return `至少 ${field.minLength} 个字符`;
      }
      if (field.maxLength !== undefined && strValue.length > field.maxLength) {
        return `最多 ${field.maxLength} 个字符`;
      }
    }

    // json 校验
    if (field.type === 'json' && typeof value === 'string' && value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        return 'JSON 格式不正确';
      }
    }

    return '';
  }

  /**
   * 校验单个字段并更新 errors
   * @param fieldKey - 字段 key
   */
  function validateFieldAndUpdate(fieldKey: string): void {
    const field = fields.find(f => f.key === fieldKey);
    if (!field) return;
    const error = validateField(field);
    if (error) {
      errors[fieldKey] = error;
    } else {
      delete errors[fieldKey];
    }
  }

  /**
   * 全量校验
   * @returns true 表示全部通过
   */
  function validate(): boolean {
    let hasError = false;
    for (const field of fields) {
      const error = validateField(field);
      if (error) {
        errors[field.key] = error;
        hasError = true;
      } else {
        delete errors[field.key];
      }
    }
    return !hasError;
  }

  /** 清空所有错误 */
  function clearErrors(): void {
    Object.keys(errors).forEach(key => delete errors[key]);
  }

  return {
    errors,
    validate,
    validateField: validateFieldAndUpdate,
    clearErrors,
  };
}
