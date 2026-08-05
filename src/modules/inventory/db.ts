/**
 * 背包模块数据层
 *
 * 封装背包数据的 IndexedDB 操作，提供数据持久化能力。
 *
 * ## 双表设计
 * - char_inventory：角色背包数据（以角色 ID 为键，存储物品槽位列表）
 * - config_items：物品模板数据（以物品 ID 为键，存储物品定义）
 *
 * ## 数据格式
 * 背包数据以原生数组存储于 IndexedDB，无需 JSON 序列化/反序列化。
 * Dexie 的类型推断有限，因此从 DB 读取时需要用 as unknown as 进行类型断言，
 * 再通过 mapToItem() 将宽松的存储类型转换为精确的 Item 类型。
 *
 * ## P3.3 类型映射
 * DB 旧表（config_items）仍使用扁平 `type`/`effect`/`bonus` 字段（向后兼容），
 * 运行时已切换为判别联合 `Item`（kind/subtype/effects）。本层负责两种格式互转：
 * - 读取：mapToItem 按 `type` 推导 `kind`+`subtype`，旧 `effect`+`bonus` 合并为 `effects[]`
 * - 写入：saveItemTemplate 从 `kind`+`subtype` 反推旧 `type`，`effects[]` 拆为 `effect`+`bonus`
 */
import { db as gameDb, dbService } from '@/modules/data';
import type { Item, InventoryItem, ItemEffect, InventoryDataStorage, ItemDataStorage } from './types';
import type { Stats } from '../character/types';
import { toRawData } from '../../utils';
import { isWeaponSubtype } from '../equipment/slotRegistry';

/**
 * 背包数据层服务
 *
 * 所有公开方法都通过 dbService.withRetry() 包裹，确保 IndexedDB
 * 事务冲突时自动重试。私有方法 mapToItem() 负责 DB 格式到业务类型的转换。
 */
export class InventoryDbService {
  /**
   * 保存背包数据到数据库（原生存储，不做 JSON 序列化）
   *
   * 写入前通过 toRawData() 去除 undefined 值，确保所有数据可被
   * IndexedDB 的结构化克隆算法正确处理。
   *
   * @param characterId - 角色 ID
   * @param items - 背包物品列表
   */
  async saveInventory(characterId: string, items: InventoryItem[]): Promise<void> {
    await dbService.withRetry(async () => {
      const clean = toRawData(items);
      await gameDb.char_inventory.put({
        characterId,
        items: clean,
        updatedAt: Date.now()
      });
    });
  }

  /**
   * 获取背包数据
   *
   * 从 char_inventory 表读取指定角色的背包。
   * 数据以原生数组存储，直接返回即可。
   *
   * @param characterId - 角色 ID
   * @returns 背包物品列表，角色无背包数据时返回空数组
   */
  async getInventory(characterId: string): Promise<InventoryItem[]> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_inventory.get(characterId) as unknown as InventoryDataStorage | undefined;
      if (!data) return [];
      return Array.isArray(data.items) ? data.items : [];
    });
  }

  /**
   * 删除背包数据
   *
   * 删除指定角色的全部背包记录（通常用于角色删除或重置场景）。
   *
   * @param characterId - 角色 ID
   */
  async deleteInventory(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_inventory.delete(characterId);
    });
  }

  // ============================================================================
  // P3.3：新 Item 判别联合 ↔ 旧 DB 扁平格式 互转辅助
  // ============================================================================

  /**
   * 由新 Item 的 kind+subtype 反推旧 DB 的 `type` 字符串
   *
   * DB 旧表（config_items）仍保留扁平 `type` 列（potion/scroll/food/material/...），
   * 写入时需从判别联合反推，保持旧存档与读取链路兼容。
   *
   * @param item - 新 Item 实例
   * @returns 旧 DB type 字符串
   */
  private itemToOldType(item: Item): string {
    switch (item.kind) {
      case 'currency':
        return item.subtype === 'gold' ? 'gold' : 'misc';
      case 'consumable':
        return item.subtype; // potion / food / scroll
      case 'material':
        return 'material';
      case 'quest':
        return 'quest';
      case 'equipment':
        // 装备通常不在 config_items 表（在 config_equipmentItems），此处兜底
        return isWeaponSubtype(item.subtype) ? 'weapon' : 'armor';
      default:
        return 'misc';
    }
  }

  /**
   * 从新 Item 的 effects[] 拆出旧 DB 的 `effect`（首个非 stat 效果）与 `bonus`（stat 效果）
   *
   * 旧 DB 的 `effect` 字段为单效果（health_restore/mana_restore/...），
   * `bonus` 字段为属性加成（Partial<Stats>）。
   * 新模型将两者统一为 `effects: ItemEffect[]`，其中 `type:'stat'` 表达属性加成（plan.md T5/T6）。
   *
   * @param item - 新 Item 实例
   * @returns 旧 DB 兼容的 effect 与 bonus
   */
  private extractLegacyEffectBonus(item: Item): {
    effect: ItemEffect | null;
    bonus: Partial<Stats>;
  } {
    // 仅消耗品有 effects 数组；其他类型无使用效果
    if (item.kind !== 'consumable') {
      return { effect: null, bonus: {} };
    }

    let effect: ItemEffect | null = null;
    const bonus: Partial<Stats> = {};

    for (const e of item.effects) {
      if (e.type === 'stat' && typeof e.value === 'object') {
        // stat 效果 → bonus（属性加成）
        Object.assign(bonus, e.value as Partial<Stats>);
      } else if (!effect) {
        // 首个非 stat 效果 → effect（旧 DB 单效果字段）
        effect = e;
      }
    }

    return { effect, bonus };
  }

  /**
   * 保存物品模板到数据库
   *
   * 将新 Item 判别联合转换为旧 DB 的 ItemStorage 格式写入 config_items 表。
   * P3.3 映射策略：
   * - `type`：由 kind+subtype 反推（{@link itemToOldType}）
   * - `effect`/`bonus`：由 effects[] 拆分（{@link extractLegacyEffectBonus}）
   * - `consumable`：kind === 'consumable'
   * - `stackable`：直接取 item.stackable 字面量
   *
   * @param item - 物品数据（新判别联合格式）
   */
  async saveItemTemplate(item: Item): Promise<void> {
    const oldType = this.itemToOldType(item);
    const { effect, bonus } = this.extractLegacyEffectBonus(item);

    await dbService.withRetry(async () => {
      await gameDb.config_items.put({
        id: item.id,
        name: item.name,
        type: oldType,
        rarity: item.rarity,
        level: item.level,
        icon: item.icon,
        description: item.description,
        bonus: Object.keys(bonus).length > 0 ? bonus : {},
        // P2-59 修复：显式构造 effect 存储对象，避免 as unknown as 双重断言
        effect: effect
          ? { type: effect.type, value: effect.value }
          : null,
        value: item.value,
        stackable: item.stackable,
        consumable: item.kind === 'consumable',
        template: item.template || null,
        // 用 ?? 而非 ||，0 是合法的等级要求（mapToItem 读取端亦用 ??）
        levelRequirement: item.levelRequirement ?? null,
        // plan.md §3.4：能力标签集合落库（必填字段，配置层显式声明）
        capabilities: item.capabilities
      });
    });
  }

  /**
   * 将 ItemDataStorage 转换为 Item 判别联合
   *
   * DB 读取的数据（ItemDataStorage）使用扁平 `type`/`effect`/`bonus` 字段，
   * 需转换为判别联合 `Item`（kind/subtype/effects）。
   *
   * P3.3 转换要点：
   * - `type` → `kind`+`subtype`（potion/scroll/food → consumable+subtype；material → material；...）
   * - `effect`+`bonus` → `effects[]`（旧单 effect 包装为数组首元素，旧 bonus 转为 stat 效果）
   * - `consumable`/`stackable`：由 kind/type 推导为字面量
   * - 装备（weapon/armor）不应出现在 config_items 表（在 config_equipmentItems），兜底为 material
   *
   * @param data - DB 读取的原始数据
   * @returns 转换后的 Item 实例（判别联合）
   */
  private mapToItem(data: ItemDataStorage): Item {
    // 共享基础字段（ItemBase）
    const base = {
      id: data.id,
      name: data.name,
      rarity: data.rarity as Item['rarity'],
      level: data.level,
      icon: data.icon,
      description: data.description,
      value: data.value,
      levelRequirement: data.levelRequirement ?? undefined,
      template: data.template || undefined,
      // plan.md §3.4：能力标签集合透传（配置层显式声明，无派生兜底）
      capabilities: data.capabilities,
    };

    // 旧 effect + bonus → 新 effects[]（plan.md T5/T6：统一为多效果数组）
    const effects: ItemEffect[] = [];
    if (data.effect) {
      effects.push(data.effect as unknown as ItemEffect);
    }
    if (data.bonus && Object.keys(data.bonus).length > 0) {
      // 旧 bonus（属性加成）→ stat 类型效果
      effects.push({ type: 'stat', value: data.bonus });
    }

    switch (data.type) {
      case 'potion':
      case 'food':
      case 'scroll':
        return {
          ...base,
          kind: 'consumable',
          subtype: data.type,
          stackable: true,
          consumable: true,
          effects,
          useMode: 'instant',
        };
      case 'material':
        return {
          ...base,
          kind: 'material',
          stackable: true,
          consumable: false,
          effects: [],
        };
      case 'quest':
        return {
          ...base,
          kind: 'quest',
          stackable: false,
          consumable: false,
          effects: [],
        };
      case 'gold':
        return {
          ...base,
          kind: 'currency',
          subtype: 'gold',
          stackable: false,
          consumable: false,
        };
      case 'weapon':
      case 'armor':
        // 装备通常不在 config_items 表，兜底按 material 处理（避免运行时崩溃）
        // 装备模板的权威来源是 config_equipmentItems 表（equipment/db.ts）
        return {
          ...base,
          kind: 'material',
          stackable: true as const,
          consumable: false as const,
          effects: [] as [],
        };
      default:
        // misc 及未知类型兜底为 material
        return {
          ...base,
          kind: 'material',
          stackable: true as const,
          consumable: false as const,
          effects: [] as [],
        };
    }
  }

  /**
   * 获取单个物品模板
   *
   * 通过物品 ID 查询物品定义，用于 UI 显示、效果计算等场景。
   *
   * @param itemId - 物品 ID
   * @returns 物品数据，不存在时返回 null
   */
  async getItemTemplate(itemId: string): Promise<Item | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_items.get(itemId) as unknown as ItemDataStorage | undefined;
      if (!data) return null;
      return this.mapToItem(data);
    });
  }

  /**
   * 获取所有物品模板
   *
   * 全量加载 config_items 表中的所有物品定义，
   * 用于模块初始化时构建 itemTemplates Map。
   *
   * @returns 物品模板列表（按 DB 顺序）
   */
  async getAllItemTemplates(): Promise<Item[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_items.toArray() as unknown as ItemDataStorage[];
      return items.map(data => this.mapToItem(data));
    });
  }

  /**
   * 删除物品模板
   *
   * 从 config_items 表中删除指定物品的模板定义。
   *
   * @param itemId - 物品 ID
   */
  async deleteItemTemplate(itemId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_items.delete(itemId);
    });
  }
}

/**
 * 背包数据层单例实例
 *
 * 全局唯一实例，模块内所有 DB 操作通过此实例完成。
 */
export const inventoryDbService = new InventoryDbService();
