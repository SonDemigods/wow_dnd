/**
 * @fileoverview ESLint flat config（S4 修复）
 * @description 模块边界强制规则，防止跨层 import 违规。
 *              初始以 warn 模式运行，收集误报后逐步切换为 error。
 */
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

/** 共享规则：模块边界 + TypeScript 严格性 */
const sharedRules = {
  // 禁止显式 any（warn 模式，逐步收紧）
  '@typescript-eslint/no-explicit-any': 'warn',
  // 使用 TS 版本的 no-unused-vars，支持 argsIgnorePattern
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  // 模块边界强制：禁止直接 import 其他模块的 db.ts
  'no-restricted-imports': ['warn', {
    patterns: [
      {
        group: ['@/modules/*/db'],
        message: '禁止直接 import 其他模块的 db.ts，请通过 index.ts 公共入口或 services 层访问',
        allowTypeImports: true,
      },
    ],
  }],
  // ARCH-5/A3：禁止 export *（无名 re-export），强制显式命名导出
  // 仅匹配 `export * from './xxx'`，不匹配 `export * as foo from './xxx'`（命名 re-export 允许）
  'no-restricted-syntax': ['error', {
    selector: 'ExportAllDeclaration[exported=null]',
    message: '禁止使用 export *，请使用显式命名导出（export { Foo, Bar } from "./xxx" 或 export type { Type1 } from "./xxx"）',
  }],
};

/**
 * ARCH-3/4 严格规则：services/、components/、main.ts 必须通过 @/modules/* 公共入口导入
 *
 * 禁止这三类位置穿透到 modules 的内部文件（store/types/service/core/db），
 * 强制走 index.ts 公共入口，从而：
 * - 保持模块封装，内部重构不会波及 services/components
 * - 让 modules/xxx/index.ts 的公共 API 形成单一事实来源
 *
 * 注意：
 * - 子模块入口（如 @/modules/combat/resources、@/modules/character/talents）是合法的公共入口，
 *   不在禁止之列
 * - 测试文件另行豁免（test/** 直接 import db.ts 进行 CRUD 验证）
 */
const strictModuleBoundaryRules = {
  'no-restricted-imports': ['warn', {
    patterns: [
      // 原有规则保留
      {
        group: ['@/modules/*/db'],
        message: '禁止直接 import 其他模块的 db.ts，请通过 index.ts 公共入口或 services 层访问',
        allowTypeImports: true,
      },
      // ARCH-3/4 新增：禁止穿透到内部文件
      {
        group: [
          '@/modules/*/store',
          '@/modules/*/types',
          '@/modules/*/service',
          '@/modules/*/core',
        ],
        message: 'services/components/main.ts 层必须通过 @/modules/* 公共入口导入，禁止穿透到内部 store/types/service/core 文件',
        allowTypeImports: false,
      },
    ],
  }],
};

export default [
  // 全局忽略
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.config.ts', '*.config.js'],
  },
  // JS 基础规则
  js.configs.recommended,
  // TypeScript 文件
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: sharedRules,
  },
  // Vue SFC 文件（使用 vue-eslint-parser 包装 TS parser）
  {
    files: ['src/**/*.vue', 'test/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: sharedRules,
  },
  // ARCH-3/4：services/、components/、main.ts 严格模块边界
  // 覆盖 sharedRules 中的 no-restricted-imports，禁止穿透到 modules 内部文件
  {
    files: [
      'src/services/**/*.ts',
      'src/components/**/*.ts',
      'src/components/**/*.vue',
      'src/main.ts',
    ],
    rules: strictModuleBoundaryRules,
  },
  // 测试文件豁免：DB 层测试需直接 import db.ts 进行 CRUD 验证（fake-indexeddb）
  {
    files: ['test/**/*.ts', 'test/**/*.vue'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
