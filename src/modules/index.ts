/**
 * @fileoverview 游戏模块统一导出入口
 * @description 导出所有子模块的公共接口，是整个 modules 层的顶层入口
 * @module modules
 *
 * ARCH-6 风险评估（export * 重名覆盖）：
 * TypeScript 对 `export *` 的重名处理为「后导出静默覆盖前导出」，不报错。
 * 本文件曾对 17 个子模块全部使用 `export *`，存在潜在重名覆盖风险。
 *
 * 经核查，当前各子模块的公共导出命名空间隔离良好，无实际重名：
 *   - types.ts：类型名均带模块前缀（如 BossInstance、EnemyData、EquipmentState、MapState）
 *   - db.ts：类名统一为 `XxxDbService`、实例名统一为 `xxxDbService`
 *   - service.ts：纯函数名带业务语义前缀（如 generateCharacterId、createEnemyInstance）
 *   - store.ts：Pinia store 统一为 `useXxxStore`，且在各子模块 index.ts 中采用命名导出（非 export *）
 *
 * 维护约定（新增模块须遵守，避免引入重名）：
 *   1. 类型名以模块名/业务实体名为前缀（如 Questxxx、Shopxxx）
 *   2. 数据层类名采用 `XxxDbService` + `xxxDbService` 实例的固定命名
 *   3. Store 一律使用 `useXxxStore` 命名并在 index.ts 中命名导出
 *   4. 通用工具型类型（如 Result/State/Storage）必须加模块前缀，禁止裸名导出
 */
export * from './admin';
export * from './animation';
export * from './audio';
export * from './base';
export * from './boss';
export * from './bus';
export * from './character';
export * from './combat';
export * from './data';
export * from './enemy';
export * from './equipment';
export * from './exploration';
export * from './inventory';
export * from './log';
export * from './map';
export * from './quest';
export * from './shop';
export * from './skill';
