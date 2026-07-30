/**
 * @fileoverview 游戏初始化编排服务
 * @description 按正确顺序统一编排各模块 Store 的初始化与清理，消除探索模块隐式初始化其他 Store
 *              的跨层调用问题（EXP-5 修复）。各模块 init 仅负责自身状态加载，假设依赖已由本服务预先初始化。
 * @module services
 */
import { useLogStore } from '@/modules/log';
import { useInventoryStore, setInventoryExternalCallbacks, clearInventoryExternalCallbacks } from '@/modules/inventory';
import { useEquipmentStore, setInventoryCallbacks, clearInventoryCallbacks } from '@/modules/equipment';
import { useSkillStore } from '@/modules/skill';
import { useMapStore } from '@/modules/map';
import { useExplorationStore } from '@/modules/exploration';
import { useQuestStore, setQuestExternalCallbacks, clearQuestExternalCallbacks } from '@/modules/quest';
import { useCombatStore } from '@/modules/combat';
import { useAudioStore } from '@/modules/audio';
import { setBossCreateFn } from '@/modules/enemy';
import { bossDbService, createBossInstance } from '@/modules/boss';
import type { BossEnemyInstance } from '@/modules/boss';

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
   * ARCH-2 修复：在 inventory 初始化后、quest 初始化前，双向注入回调以切断 inventory ↔ quest 循环依赖：
   * - 注入 quest.onItemCollected 到 inventory（addItem 时通知任务进度）
   * - 注入 inventory.getItemCount / addItem 到 quest（acceptQuest 初始进度 / _grantQuestRewards 发奖）
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
    // DB-1/DB-2 修复：同时注入 flushPersist，供装备 persist 失败回滚时等待背包持久化完成
    setInventoryCallbacks(inventoryStore.addItem, inventoryStore.removeItem, inventoryStore.flushPersist);

    // 2.55 ARCH-2 修复：注入 inventory ↔ quest 双向回调以切断循环依赖
    // - quest 模块在 acceptQuest（计算 collect 初始进度）和 _grantQuestRewards（发放物品奖励）时
    //   需要查询/操作背包数据，原直接 import useInventoryStore 形成循环依赖
    // - inventory 模块在 addItem 成功时需要通知 quest 推进 collect 任务进度
    // 通过回调注入由 GameBootstrap 统一编排，保持同步语义且消除静态依赖
    const questStore = useQuestStore();
    setInventoryExternalCallbacks({ onItemCollected: questStore.onItemCollected });
    setQuestExternalCallbacks({
      getInventoryItemCount: (itemId) => {
        return inventoryStore.inventory
          .filter(slot => slot.itemId === itemId)
          .reduce((sum, slot) => sum + slot.count, 0);
      },
      addItemToInventory: (itemId, quantity) => inventoryStore.addItem(itemId, quantity),
    });

    // 2.6 注入 Boss 创建回调到敌人模块（回调注入替代 enemy → boss 静态依赖）
    // TS-2 修复：createBossInstance 返回组合式 BossInstance，此处展开 base 并附加
    // phases/intro 构造扁平 BossEnemyInstance（类型层面完整声明，无需 as 断言）
    // enemy store 接收时 widened 为 EnemyInstance，wrapAsBossInstance 通过
    // isBossEnemyInstance 类型守卫收窄后读取 phases/intro
    setBossCreateFn(async (dataId, level): Promise<BossEnemyInstance | null> => {
      const template = await bossDbService.getBossTemplate(dataId);
      if (!template) return null;
      const boss = createBossInstance(template, level);
      return {
        ...boss.base,
        isBoss: true,
        phases: boss.phases,
        intro: boss.intro,
      };
    });

    // 3. 装备模块（依赖背包回调）
    await useEquipmentStore().initialize(characterId);

    // 4. 技能模块（依赖角色）
    await useSkillStore().initialize(characterId);

    // 5. 地图模块（被探索依赖）
    await useMapStore().initialize(characterId);

    // 6. 探索模块（依赖上述所有，仅加载自身状态，不再隐式初始化其他 Store）
    await useExplorationStore().init(characterId);

    // 7. 任务模块（依赖角色、探索）
    await questStore.initialize(characterId);
  }

  /**
   * 清理所有模块（角色切换或退出时）
   *
   * 仅清理显式实现了 Disposable 接口的 Store，按初始化的逆序释放资源。
   *
   * P2-71 修复说明：initialize 初始化 7 个 Store（log/inventory/equipment/skill/map/exploration/quest），
   * 但并非所有 Store 都需要 dispose。只有持有需要显式释放的资源（EventBus 监听器、定时器、回调引用）
   * 的 Store 才实现 Disposable 接口并加入下方列表：
   *
   * 当前实现 dispose 的 Store：
   * - combatStore：清理战斗定时器（turnTimerId / bossIntroTimerId）
   * - explorationStore：清理 EventBus 监听器与 UI 回调
   * - audioStore：清理 saveTimer 去抖定时器
   *
   * 以下 initialize 的 Store 经核查无 EventBus 监听器、定时器或订阅需要清理，故不实现 dispose：
   * - logStore / inventoryStore / equipmentStore / skillStore / mapStore / questStore
   * 若未来这些 Store 新增了需释放的资源，应实现 Disposable 接口并加入 disposables 列表。
   *
   * 新增可释放 Store 时，将其加入下方 disposables 列表即可——
   * TypeScript 会在编译期校验其 dispose 方法签名。
   *（ARCH-8/CODE-50 修复：以类型安全的 Disposable 接口替代 as unknown as 断言）
   *
   * 同时清除 equipment 模块的背包回调引用（A1/G1 修复：避免回调泄漏）。
   */
  dispose(): void {
    // 按初始化逆序收集需清理的 Store
    // combat 最先清理，避免后续 dispose 触发战斗回调
    const disposables: Disposable[] = [
      useCombatStore(),
      useExplorationStore(),
      useAudioStore(),
    ];
    for (const disposable of disposables) {
      disposable.dispose();
    }

    // 清除装备模块的背包回调引用（A1/G1 修复：避免角色切换后回调指向旧 Store 实例）
    clearInventoryCallbacks();

    // 清除 inventory ↔ quest 双向回调引用（ARCH-2 修复：避免角色切换后回调指向旧 Store 实例）
    clearInventoryExternalCallbacks();
    clearQuestExternalCallbacks();

    // 清除敌人模块的 Boss 创建回调引用（阶段四：避免角色切换后回调指向旧闭包）
    setBossCreateFn(null);
  }
}

/** 游戏初始化编排服务单例 */
export const gameBootstrap = new GameBootstrapService();
