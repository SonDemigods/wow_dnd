/**
 * 基础数据管理模块类型定义
 * 
 * 包含阵营、种族、职业等基础数据的类型定义和操作接口
 */

import type { Stats, FactionData, RaceData, ClassData } from '../character/types';

/**
 * 基础数据操作结果接口
 */
export interface GameDataOperationResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * 分页查询结果接口
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 阵营创建/更新数据接口
 */
export interface FactionCreateUpdateData {
  name: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * 种族创建/更新数据接口
 */
export interface RaceCreateUpdateData {
  name: string;
  icon: string;
  factionId: string;
  bonus?: Partial<Stats>;
  description: string;
}

/**
 * 职业创建/更新数据接口
 */
export interface ClassCreateUpdateData {
  name: string;
  icon: string;
  primaryStat: keyof Stats;
  factionsIds: string[];
  raceIds: string[];
  description: string;
  color: string;
  bonus?: Partial<Stats>;
}

/**
 * 基础数据服务接口
 */
export interface IGameDataService {
  // 阵营操作
  getAllFactions(): Promise<FactionData[]>;
  getFactionById(id: string): Promise<FactionData | null>;
  createFaction(data: FactionCreateUpdateData): Promise<GameDataOperationResult<string>>;
  updateFaction(id: string, data: FactionCreateUpdateData): Promise<GameDataOperationResult>;
  deleteFaction(id: string): Promise<GameDataOperationResult>;

  // 种族操作
  getAllRaces(): Promise<RaceData[]>;
  getRaceById(id: string): Promise<RaceData | null>;
  getRacesByFaction(factionId: string): Promise<RaceData[]>;
  createRace(data: RaceCreateUpdateData): Promise<GameDataOperationResult<string>>;
  updateRace(id: string, data: RaceCreateUpdateData): Promise<GameDataOperationResult>;
  deleteRace(id: string): Promise<GameDataOperationResult>;

  // 职业操作
  getAllClasses(): Promise<ClassData[]>;
  getClassById(id: string): Promise<ClassData | null>;
  getClassesByRace(raceId: string): Promise<ClassData[]>;
  getClassesByFaction(factionId: string): Promise<ClassData[]>;
  createClass(data: ClassCreateUpdateData): Promise<GameDataOperationResult<string>>;
  updateClass(id: string, data: ClassCreateUpdateData): Promise<GameDataOperationResult>;
  deleteClass(id: string): Promise<GameDataOperationResult>;
}