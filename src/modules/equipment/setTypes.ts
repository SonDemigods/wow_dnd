/**
 * @fileoverview 套装系统类型定义（新版）
 * @description
 *   物品系统升级（plan.md §3.4）的全新套装类型层。解决旧版套装六类问题：
 *   - S1：`ItemSet` 增加 `parts` 部件清单，取代笼统的 `pieces: number`
 *   - S2：`bonusTiers` 多档奖励，替代旧版单一 2 件套
 *   - S3：`SetBonusEffect` 改为判别联合，`kind:'trigger'` 关联 setBonusRegistry 执行器
 *   - S4：`SetCategory` 区分武器套/护甲套/混合套/饰品套组合规则
 *   - S5：`classRestriction` 单一来源（仅在 ItemSet 声明，部件继承不重复）
 *   - S6：配套 setService 的 `SetProgress` API 供 UI 展示套装进度
 *
 *   阶段定位：P3.3b 已完成迁移。本文件类型已覆盖 equipment/types.ts 的旧 `ItemSet`，
 *   config_set_definitions.ts 已迁移到新版 `ItemSet`（parts + bonusTiers），
 *   service.ts 的旧版 countSetPieces/getActiveSetBonuses 已删除，由 setService 替代。
 *
 * @module equipment
 */
import type { EquipmentSlot, EquipmentSubtype } from '../item/types';
import type { Stats } from '../character/types';

// ============================================================================
// 套装部件清单
// ============================================================================

/**
 * 套装部件规格
 *
 * 声明套装包含的某个部件应装备的槽位与子类型约束。取代旧版仅声明 `pieces: number`
 * 的做法，使套装"知道自己包含哪些装备"，可校验完整性、可在 UI 展示部件清单。
 *
 * 匹配规则（setService.getSetProgress）：
 * - 必须匹配 `slot`：该槽位有装备
 * - `subtype` 可选：若指定，装备子类型必须一致
 * - `itemId` 可选：若指定，装备 ID 必须一致（用于精确套装）
 *
 * @property slot - 部件装备的槽位（helm/chest/.../weapon1/weapon2）
 * @property subtype - 部件子类型约束（可选，未指定则仅按 slot 匹配）
 * @property itemId - 具体装备 ID（可选，用于精确套装）
 */
export interface SetPartSpec {
  slot: EquipmentSlot;
  subtype?: EquipmentSubtype;
  itemId?: string;
}

// ============================================================================
// 套装分类
// ============================================================================

/**
 * 套装分类：按部件组成区分组合规则
 *
 * - `weapon_set`：纯武器套（如主手 + 副手）
 * - `armor_set`：纯护甲套（如头+胸+手+腿+鞋 5 件）
 * - `mixed_set`：混合套（武器 + 护甲）
 * - `accessory_set`：饰品套（后续扩展）
 *
 * `parts` 中的 `slot` 天然适配 5 部位 + 武器单/副/双手槽位体系；
 * 双手武器套装的 `parts` 只列 `weapon1`（因 `weapon2` 被占用）。
 */
export type SetCategory =
  | 'weapon_set'
  | 'armor_set'
  | 'mixed_set'
  | 'accessory_set';

// ============================================================================
// 套装奖励效果（判别联合）
// ============================================================================

/**
 * 套装奖励效果（判别联合）
 *
 * 替代旧版松散的 `SetBonusEffect`（stat?/value?/effect?/description? 全可选字符串）。
 * 新版按效果语义分类为判别联合，编译期约束字段，运行期可安全分派。
 *
 * - `stat`：固定属性加成（如力量 +5）
 * - `percent_stat`：百分比属性加成（如暴击率 +3%）
 * - `resource`：每回合资源恢复（如每回合恢复 2 能量）
 * - `trigger`：触发类效果，关联 setBonusRegistry 的 `triggerId` 执行器
 *   （如攻击时产生怒气、击杀时概率产生灵魂碎片）
 */
export type SetBonusEffect =
  | { kind: 'stat'; stat: keyof Stats; value: number; description: string }
  | { kind: 'percent_stat'; stat: keyof Stats; percent: number; description: string }
  | { kind: 'resource'; resource: string; perTurn: number; description: string }
  | { kind: 'trigger'; triggerId: string; description: string };

/**
 * 套装奖励档位
 *
 * 一档可激活多个效果，支持 2/4/6 件多档递进奖励
 * （如 2 件加属性、4 件触发特效、6 件大招）。
 *
 * @property requiredPieces - 激活所需件数（2/4/6...）
 * @property bonuses - 该档可激活的效果列表
 */
export interface SetBonusTier {
  requiredPieces: number;
  bonuses: SetBonusEffect[];
}

// ============================================================================
// 套装定义
// ============================================================================

/**
 * 套装定义（新版，覆盖旧 `ItemSet`）
 *
 * 与旧版 `ItemSet`（equipment/types.ts）的差异：
 * - `parts` 部件清单取代 `pieces: number`（`pieces` 由 `parts.length` 派生）
 * - `bonusTiers` 多档奖励取代 `setBonuses` 单档
 * - 新增 `category` 分类
 * - `classRestriction` 仍为单一来源（部件的 classRestriction 从套装派生，不重复声明）
 *
 * @property id - 套装唯一标识（如 'warrior_might'）
 * @property name - 套装显示名称
 * @property category - 套装分类
 * @property parts - 部件清单（取代 pieces）
 * @property classRestriction - 套装所属职业（可选，未定义表示无职业限制）
 * @property bonusTiers - 多档奖励，按 requiredPieces 升序
 */
export interface ItemSet {
  id: string;
  name: string;
  category: SetCategory;
  parts: SetPartSpec[];
  classRestriction?: string;
  bonusTiers: SetBonusTier[];
}

/**
 * 套装 ID 引用（用于装备条目 `setId` 字段的语义约束）
 */
export type SetId = string;
