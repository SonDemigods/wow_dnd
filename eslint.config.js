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
  // 测试文件豁免：DB 层测试需直接 import db.ts 进行 CRUD 验证（fake-indexeddb）
  {
    files: ['test/**/*.ts', 'test/**/*.vue'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
