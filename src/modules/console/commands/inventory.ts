/**
 * @fileoverview 物品类控制台命令（item category）
 * @description 包含物品添加、背包管理、装备查看命令：
 *   item     - 添加物品到背包（消耗品和装备）
 *   bag      - 显示背包物品
 *   clearBag - 清空背包
 *   equips   - 查看当前装备状态
 * @module console/commands/inventory
 */
import { useInventoryStore } from '@/modules/inventory';
import { useEquipmentStore } from '@/modules/equipment';
import { adminQueryService } from '@/services/AdminQueryService';
import {
  registerCommand,
  rarityColorKey,
  logTag,
  STYLE
} from '../framework';

// ============================================================
// 物品操作
// ============================================================

/**
 * 添加物品
 *
 * 向当前角色背包添加消耗品或装备。无参数时列出所有可用物品模板。
 * 消耗品可指定数量，装备固定为 1 件。
 *
 * @param {string[]} args - args[0] 为物品 ID（空则列出），args[1] 为数量（消耗品）
 *
 * @see adminQueryService.queryItemTemplate
 * @see adminQueryService.queryAllItemTemplates
 */
registerCommand({
  name: 'item',
  category: 'item',
  description: '添加物品到背包（消耗品和装备）',
  usage: 'item <物品ID> [数量]',
  async handler(args) {
    if (args.length === 0) {
      // CHR-5 修复：通过 AdminQueryService 收口跨模块 DbService 查询
      const { items: lootItems, equipments: equipItems } = await adminQueryService.queryAllItemTemplates();

      logTag('item', '═══ 消耗品 ═══');
      for (const item of lootItems) {
        console.log(`  %c${item.id.padEnd(24)}%c ${item.name}`, STYLE.label, STYLE.value);
      }
      logTag('item', '═══ 装备 ═══');
      for (const item of equipItems) {
        const rc = rarityColorKey(item.rarity || 'common');
        console.log(`  %c${item.id.padEnd(24)}%c ${item.name} %c[${item.type}]`, STYLE.label, rc, STYLE.hint);
      }
      return { success: true, message: '已在上方列出所有可用物品' };
    }

    const itemId = args[0];

    // CHR-5 修复：通过 AdminQueryService 统一查询物品模板（消耗品 + 装备）
    const result = await adminQueryService.queryItemTemplate(itemId);
    if (result) {
      if (result.type === 'item') {
        const count = args[1] ? parseInt(args[1], 10) : 1;
        if (isNaN(count) || count <= 0) {
          return { success: false, message: '数量必须为正整数' };
        }
        const added = useInventoryStore().addItem(result.data.id, count);
        if (added > 0) {
          return { success: true, message: `已添加 ${result.data.name} x${added}` };
        }
        return { success: false, message: '背包已满，无法添加物品' };
      } else {
        // 装备类型固定添加 1 件
        const added = useInventoryStore().addItem(result.data.id, 1);
        if (added > 0) {
          return { success: true, message: `已添加 ${result.data.name} 到背包` };
        }
        return { success: false, message: '背包已满，无法添加物品' };
      }
    }

    return { success: false, message: `未找到物品: ${itemId}，输入 item 查看可用列表` };
  }
});

// ============================================================
// 背包管理
// ============================================================

/**
 * 显示背包内容
 *
 * 列出当前角色背包中所有物品，含名称和数量。
 */
registerCommand({
  name: 'bag',
  category: 'item',
  description: '显示背包物品',
  usage: 'bag',
  handler() {
    const items = useInventoryStore().inventory;
    if (items.length === 0) {
      return { success: true, message: '背包是空的' };
    }

    logTag('bag', '═══ 背包物品 ═══');
    for (const invItem of items) {
      const info = useInventoryStore().getItemInfo(invItem.itemId);
      const name = info?.name || invItem.itemId;
      console.log(`  %c${invItem.itemId.padEnd(24)}%c ${name} %cx${invItem.count}`, STYLE.label, STYLE.value, STYLE.hint);
    }
    return { success: true, message: `共 ${items.length} 个格子` };
  }
});

/**
 * 清空背包
 *
 * 移除背包中所有物品。此操作不可逆。
 *
 * @see useInventoryStore().resetInventory
 */
registerCommand({
  name: 'clearBag',
  category: 'item',
  description: '清空背包',
  usage: 'clearBag',
  handler() {
    useInventoryStore().resetInventory();
    return { success: true, message: '背包已清空' };
  }
});

/**
 * 查看装备
 *
 * 显示当前角色各槽位的装备信息，含装备名称、稀有度和等级。
 * 未装备的槽位自动跳过不显示。
 */
registerCommand({
  name: 'equips',
  category: 'item',
  description: '查看当前装备状态',
  usage: 'equips',
  handler() {
    const equipment = useEquipmentStore().equipment;
    const slots = Object.entries(equipment);
    const occupied = slots.filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] !== null);

    if (occupied.length === 0) {
      return { success: true, message: '当前没有装备任何物品' };
    }

    const slotNames: Record<string, string> = {
      weapon1: '主手武器', weapon2: '副手武器',
      armor1: '头部', armor2: '肩部', armor3: '胸甲', armor4: '腿部'
    };

    logTag('equips', '═══ 当前装备 ═══');
    for (const [slot, entry] of occupied) {
      const item = entry.item;
      const rc = rarityColorKey(item.rarity || 'common');
      console.log(`  %c${(slotNames[slot] || slot).padEnd(10)}%c ${item.name.padEnd(20)}%c Lv.${item.level}`, STYLE.label, rc, STYLE.hint);
    }
    return { success: true, message: `共装备 ${occupied.length} 件物品` };
  }
});

/** 命令模块标记导出，便于汇总注册器识别 */
export const __inventoryCommandsLoaded = true;
