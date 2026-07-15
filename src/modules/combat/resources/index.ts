/**
 * @fileoverview 战斗资源系统模块入口
 * @description 集中导出资源系统的类型、基类、具体实现和工厂。
 * @module combat/resources
 */
export type { ResourceType, ResourceSource, ResourceSystem, ResourceSystemFactoryMap } from './types';
export { BaseResourceSystem } from './BaseResourceSystem';
export { RageSystem } from './RageSystem';
export { EnergySystem } from './EnergySystem';
export { ComboPointSystem } from './ComboPointSystem';
export { SoulShardSystem } from './SoulShardSystem';
export { ChiSystem } from './ChiSystem';
export { FocusSystem } from './FocusSystem';
export { ResourceSystemFactory } from './ResourceSystemFactory';
