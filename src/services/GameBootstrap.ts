/**
 * @fileoverview 游戏初始化编排服务
 * @description 按正确顺序统一编排各模块 Store 的初始化与清理，消除探索模块隐式初始化其他 Store
 *              的跨层调用问题（EXP-5 修复）。各模块 init 仅负责自身状态加载，假设依赖已由本服务预先初始化。
 * @module services
 */
import { useLogStore } from '@/modules/log/store';
import { useInventoryStore } from '@/modules/inventory/store';
import { useEquipmentStore } from '@/modules/equipment/store';
import { useSkillStore } from '@/modules/skill/store';
import { useMapStore } from '@/modules/map/store';
import { useExplorationStore } from '@/modules/exploration/store';
import { useQuestStore } from '@/modules/quest/store';

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
   * @param characterId - 角色 ID
   */
  async initialize(characterId: string): Promise<void> {
    // 1. 日志模块（基础数据，被探索/战斗依赖）
    await useLogStore().initialize(characterId);

    // 2. 背包模块（被探索/装备依赖）
    await useInventoryStore().initialize(characterId);

    // 3. 装备模块（依赖背包）
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
   * 按初始化的逆序清理，各 Store 若未实现 dispose 则跳过（运行时检测）。
   * 注意：Pinia Store 类型未声明 dispose 方法，使用 as unknown as 绕过编译期检查，
   * 仅 exploration store 当前实现了 dispose，其余为预留扩展点。
   */
  dispose(): void {
    const safeDispose = (store: unknown): void => {
      if (typeof (store as { dispose?: () => void }).dispose === 'function') {
        (store as { dispose: () => void }).dispose();
      }
    };
    safeDispose(useQuestStore());
    safeDispose(useExplorationStore());
    safeDispose(useMapStore());
    safeDispose(useSkillStore());
    safeDispose(useEquipmentStore());
    safeDispose(useInventoryStore());
    safeDispose(useLogStore());
  }
}

/** 游戏初始化编排服务单例 */
export const gameBootstrap = new GameBootstrapService();
