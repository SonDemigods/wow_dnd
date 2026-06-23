/**
 * @fileoverview 任务模块 —— 统一导出入口
 *
 * 导出本模块的全部公共 API，外部模块通过此文件引用。
 *
 * ## 导出内容
 *
 * - `./types`          : 全部类型定义（QuestDefinition / QuestInstance / QuestStatus 等）
 * - `./db`             : 数据层服务和单例（questDbService）
 * - `./service`        : 纯函数层（checkQuestProgress / canAcceptQuest 等）
 * - `./objective_utils`: UI 文本生成工具（getObjectiveText / getEnemyName）
 * - `./store`          : Pinia Store（useQuestStore）
 *
 * ## 使用方式
 *
 * ```ts
 * import { useQuestStore, questDbService, type QuestDefinition } from '@/modules/quest';
 * ```
 *
 * @module quest
 */
export * from './types';
export * from './db';
export * from './service';
export * from './objective_utils';
export { useQuestStore } from './store';
