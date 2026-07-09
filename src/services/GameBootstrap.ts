/**
 * @fileoverview 游戏初始化编排服务
 * @description 按正确顺序统一编排各模块 Store 的初始化与清理，消除探索模块隐式初始化其他 Store
 *              的跨层调用问题（EXP-5 修复）。各模块 init 仅负责自身状态加载，假设依赖已由本服务预先初始化。
 * @module services
 */
import { useLogStore } from '@/modules/log/store';
import { useInventoryStore } from '@/modules/inventory/store';
import { useEquipmentStore, setInventoryCallbacks, clearInventoryCallbacks } from '@/modules/equipment/store';
import { useSkillStore } from '@/modules/skill/store';
import { useMapStore } from '@/modules/map/store';
import { useExplorationStore } from '@/modules/exploration/store';
import { useQuestStore } from '@/modules/quest/store';

/**
 * 可释放资源接口
 *
 * 需要释放资源（如 EventBus 监听器、定时器、回调引用）的 Store 应实现此接口。
 * GameBootstrapService.dispose() 会统一调用实现了此接口的 Store 的 dispose 方法。
 *
 * 显式声明为 Disposable 的 Store 会被加入 dispose 列表，由 TypeScript 在编译期
 * 校验 dispose 方法签名，避免运行时才发现缺失（ARCH-8 修复：替代 as unknown as 断言）。
 *
 * Pinia setup store 通过结构类型实现：只要 Store 的返回对象包含 `dispose(): void` 方法，
 * 即自动满足此接口，无需 class 继承。
 */
export interface Disposable {
  /** 释放 Store 持有的资源（监听器、定时器、回调等） */
  dispose(): void;
}

/**
 * 游戏初始化编排服务
 *
 * 负责按依赖顺序初始化各模块 Store，确保：
 * - 基础模块（日志、背包）先于依赖它们的模块（探索、任务）初始化
 * - 角色切换时按逆序清理，避免状态残留与监听器累积
 */
export class GameBootstrapService {
  /**
   * 初始化指定角色的所有模块
   *
   * 初始化顺序（前者被后者依赖）：
   * log → inventory → equipment → skill → map → exploration → quest
   *
   * 在 inventory 初始化完成后、equipment 初始化前，注入背包回调到装备模块
   * （A1/G1 修复：消除 equipment → inventory 静态依赖，通过回调注入实现装备卸下放回背包）。
   *
   * @param characterId - 角色 ID
   */
  async initialize(characterId: string): Promise<void> {
    // 1. 日志模块（基础数据，被探索/战斗依赖）
    await useLogStore().initialize(characterId);

    // 2. 背包模块（被探索/装备依赖）
    const inventoryStore = useInventoryStore();
    await inventoryStore.initialize(characterId);

    // 2.5 注入背包回调到装备模块（A1/G1 修复：回调注入替代 equipment → inventory 静态依赖）
    setInventoryCallbacks(inventoryStore.addItem, inventoryStore.removeItem);

    // 3. 装备模块（依赖背包回调）
    await useEquipmentStore().initialize(characterId);

    // 4. 技能模块（依赖角色）
    await useSkillStore().initialize(characterId);

    // 5. 地图模块（被探索依赖）
    await useMapStore().initialize(characterId);

    // 6. 探索模块（依赖上述所有，仅加载自身状态，不再隐式初始化其他 Store）
    await useExplorationStore().init(characterId);

    // 7. 任务模块（依赖角色、探索）
    await useQuestStore().initialize(characterId);
  }

  /**
   * 清理所有模块（角色切换或退出时）
   *
   * 仅清理显式实现了 Disposable 接口的 Store，按初始化的逆序释放资源。
   * 当前仅 exploration store 实现了 dispose；未来新增可释放 Store 时，
   * 将其加入下方 disposables 列表即可——TypeScript 会在编译期校验其 dispose 方法签名。
   *（ARCH-8/CODE-50 修复：以类型安全的 Disposable 接口替代 as unknown as 断言）
   *
   * 同时清除 equipment 模块的背包回调引用（A1/G1 修复：避免回调泄漏）。
   */
  dispose(): void {
    // 按初始化逆序收集需清理的 Store（当前仅 exploration 实现了 Disposable）
    // 新增可释放 Store 时，在此按逆序添加即可
    const disposables: Disposable[] = [
      useExplorationStore(), // 唯一实现 dispose 的 Store（清理 EventBus 监听器与 UI 回调）
    ];
    for (const disposable of disposables) {
      disposable.dispose();
    }

    // 清除装备模块的背包回调引用（A1/G1 修复：避免角色切换后回调指向旧 Store 实例）
    clearInventoryCallbacks();
  }
}

/** 游戏初始化编排服务单例 */
export const gameBootstrap = new GameBootstrapService();
