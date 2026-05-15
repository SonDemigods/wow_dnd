/**
 * @fileoverview 配置管理器
 * @description 提供模块化的配置系统，支持各模块独立配置
 * @module services/configManager
 */

/** 模块配置接口 */
interface ModuleConfig {
  [key: string]: any;
}

/** 游戏全局配置 */
export interface GameConfig {
  /** 最大等级 */
  maxLevel: number;
  /** 背包容量 */
  inventorySize: number;
  /** 战斗相关配置 */
  combat: {
    /** 闪避基础值 */
    baseDodgeChance: number;
    /** 暴击基础值 */
    baseCritChance: number;
  };
  /** UI相关配置 */
  ui: {
    /** 是否启用响应式布局 */
    responsive: boolean;
    /** 默认设备类型 */
    defaultDevice: 'auto' | 'desktop' | 'mobile';
  };
}

/** 默认游戏配置 */
const defaultConfig: GameConfig = {
  maxLevel: 60,
  inventorySize: 8,
  combat: {
    baseDodgeChance: 5,
    baseCritChance: 5,
  },
  ui: {
    responsive: true,
    defaultDevice: 'auto',
  },
};

/**
 * 配置管理器类
 * 提供统一的配置管理接口，支持模块级配置
 */
class ConfigManager {
  /** 全局配置 */
  private config: GameConfig;
  /** 模块配置 */
  private moduleConfigs: Map<string, ModuleConfig> = new Map();

  constructor() {
    this.config = { ...defaultConfig };
  }

  /**
   * 获取全局配置
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * 更新全局配置
   * @param newConfig 新的配置对象（部分更新）
   */
  updateConfig(newConfig: Partial<GameConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  /**
   * 获取模块配置
   * @param moduleName 模块名称
   * @param defaultConfig 默认配置（可选）
   */
  getModuleConfig<T extends ModuleConfig>(moduleName: string, defaultConfig?: T): T {
    const config = this.moduleConfigs.get(moduleName);
    if (config) {
      return { ...config } as T;
    }
    if (defaultConfig) {
      this.moduleConfigs.set(moduleName, { ...defaultConfig });
      return { ...defaultConfig };
    }
    return {} as T;
  }

  /**
   * 更新模块配置
   * @param moduleName 模块名称
   * @param config 新的配置对象（部分更新）
   */
  updateModuleConfig(moduleName: string, config: ModuleConfig): void {
    const current = this.moduleConfigs.get(moduleName) || {};
    this.moduleConfigs.set(moduleName, { ...current, ...config });
    this.saveConfig();
  }

  /**
   * 保存配置到 localStorage
   */
  private saveConfig(): void {
    try {
      const data = {
        global: this.config,
        modules: Object.fromEntries(this.moduleConfigs),
      };
      localStorage.setItem('game_config', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * 从 localStorage 加载配置
   */
  loadConfig(): void {
    try {
      const saved = localStorage.getItem('game_config');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.global) {
          this.config = { ...defaultConfig, ...data.global };
        }
        if (data.modules) {
          this.moduleConfigs = new Map(Object.entries(data.modules));
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  /**
   * 重置配置为默认值
   */
  resetConfig(): void {
    this.config = { ...defaultConfig };
    this.moduleConfigs.clear();
    localStorage.removeItem('game_config');
  }
}

/** 导出单例实例 */
export const configManager = new ConfigManager();
