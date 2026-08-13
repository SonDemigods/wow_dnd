/**
 * @fileoverview Admin 表单字段类型定义
 * @description 从 AdminForm.vue 中提取的字段类型接口，供各字段子组件和 composable 共享。
 * @module admin/fields
 */

/** 字段类型枚举 */
export type FormFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'switch'
  | 'color'
  | 'json';

/** 表单字段定义 */
export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** 是否禁用（只读展示） */
  disabled?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 正则校验（对 text/textarea 类型生效） */
  pattern?: string;
  /** 正则校验失败提示 */
  patternMessage?: string;
  /** number 类型最小值 */
  min?: number;
  /** number 类型最大值 */
  max?: number;
  /** 文本最小长度 */
  minLength?: number;
  /** 文本最大长度 */
  maxLength?: number;
}

/**
 * 表单字段值类型
 *
 * 动态表单的值类型因 field.type 而异：
 * - text/textarea/select/color/json(文本模式): string
 * - number: number
 * - switch: boolean
 * - multiselect: string[]
 * - json(对象模式): object
 */
export type FormFieldValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | null;
