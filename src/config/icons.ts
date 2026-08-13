/**
 * 系统级公共图标配置
 *
 * 集中管理全系统共用的图标名称常量，避免在 .vue 组件和 composable 中散落硬编码。
 * BaseIcon.vue 的 FALLBACK_ICON 以及各类 UI 图标映射表均从此导入。
 *
 * 图标来源：@iconify/game-icons 图标集（BaseIcon 自动补齐 `game-icons:` 前缀）
 */

// ==================== 回退图标 ====================

/** 图标不存在或 name 为空时的回退图标（问号） */
export const FALLBACK_ICON = 'game-icons:uncertainty';

// ==================== 导航 / 菜单图标 ====================

/** 底部导航栏与主界面入口图标 */
export const NAV_ICONS = {
  /** 角色 */
  character: 'game-icons:person',
  /** 背包 */
  inventory: 'game-icons:backpack',
  /** 构筑（技能+天赋） */
  build: 'game-icons:sword-spin',
  /** 进度（任务+日志） */
  progress: 'game-icons:notebook',
  /** 系统/设置 */
  settings: 'game-icons:cog',
} as const;

// ==================== 探索格子图标 ====================

/** 探索网格中各格子类型的图标映射 */
export const CELL_ICONS: Record<string, { name: string; gradient: string }> = {
  empty:    { name: 'plain-circle',      gradient: 'metal' },
  monster:  { name: 'sword-clash',        gradient: 'physical' },
  treasure: { name: 'treasure-map',       gradient: 'magic' },
  shop:     { name: 'shop',               gradient: 'gold' },
  rest:     { name: 'campfire',           gradient: 'heal' },
  boss:     { name: 'dragon-head',        gradient: 'dragon' },
  event:    { name: 'perspective-dice-six', gradient: 'gold' },
  trap:     { name: 'caltrops',           gradient: 'debuff' },
  start:    { name: 'entry-door',         gradient: 'heal' },
  board:    { name: 'notebook',           gradient: 'gold' },
};

/** 格子图标回退值 */
export const CELL_ICON_FALLBACK = { name: 'plain-circle', gradient: 'metal' };

// ==================== 战斗效果图标 ====================

/** buff/debuff 效果类型 → 图标名映射 */
export const EFFECT_ICONS: Record<string, string> = {
  poison:      'skull-poison',
  burn:        'flame',
  stun:        'stun-glow',
  freeze:      'snowflake-1',
  silence:     'silenced',
  shield:      'shield',
  attack_up:   'sword-clash',
  attack_down: 'sword-clash',
  defense_up:  'shield',
  defense_down:'shield',
  speed_up:    'dodge',
  speed_down:  'turtle',
  regen:       'regeneration',
  thorn:       'cactus',
  vulnerable:  'heart-organ',
};

/** 效果图标回退值 */
export const EFFECT_ICON_FALLBACK = 'game-icons:sparkles';

// ==================== 任务类型图标 ====================

/** 任务类型 → 图标+渐变色映射（QuestPopup / QuestPanel 共用） */
export const QUEST_ICONS: Record<string, { name: string; gradient: string }> = {
  kill:    { name: 'crossed-swords',  gradient: 'physical' },
  collect: { name: 'chest',           gradient: 'gold' },
  explore: { name: 'compass',        gradient: 'nature' },
};

/** 任务图标回退值 */
export const QUEST_ICON_FALLBACK = { name: 'scroll-unfurled', gradient: 'gold' };

// ==================== 属性图标 ====================

/** 六维属性 → 图标+渐变色映射 */
export const STAT_ICONS: Record<string, { name: string; gradient: string }> = {
  str: { name: 'biceps',     gradient: 'physical' },
  dex: { name: 'boot-kick',  gradient: 'lightning' },
  con: { name: 'heart-organ', gradient: 'blood' },
  int: { name: 'brain',      gradient: 'magic' },
  wis: { name: 'eye-target', gradient: 'nature' },
  cha: { name: 'charm',      gradient: 'gold' },
};

/** 属性图标回退值 */
export const STAT_ICON_FALLBACK = { name: 'uncertainty', gradient: 'shadow' };

// ==================== 资源条图标 ====================

/** 职业资源类型 → 图标名映射（不含 gradient，由调用方指定） */
export const RESOURCE_ICONS: Record<string, string> = {
  rage:        'game-icons:flame',
  energy:      'game-icons:lightning-storm',
  combo_point: 'game-icons:archery-target',
  soul_shard:  'game-icons:soul',
  chi:         'game-icons:fist',
  focus:       'game-icons:targeting',
  holy_power:  'game-icons:spiked-halo',
  runic_power: 'game-icons:rune-sword',
  rune:        'game-icons:rune-stone',
  fury:        'game-icons:claw',
  soul:        'game-icons:soul',
  essence:     'game-icons:dragon-orb',
  mana:        'game-icons:magic-palm',
};

// ==================== 装备槽位图标 ====================

/** 装备槽位 → 图标名映射（与 slotRegistry.ts SLOT_CONFIG 同步） */
export const SLOT_ICONS: Record<string, string> = {
  weapon1: 'game-icons:broadsword',
  weapon2: 'game-icons:checked-shield',
  helm:    'game-icons:visored-helm',
  chest:   'game-icons:chest-armor',
  gloves:  'game-icons:gauntlet',
  legs:    'game-icons:leg-armor',
  boots:   'game-icons:leather-boot',
};

// ==================== 通用 UI 图标 ====================

/** 通用 UI 元素图标（金币、宝箱、营地等高频复用图标） */
export const COMMON_ICONS = {
  gold:         'game-icons:two-coins',
  treasure:     'game-icons:treasure-map',
  campfire:     'game-icons:campfire',
  person:       'game-icons:person',
  backpack:     'game-icons:backpack',
  swordSpin:    'game-icons:sword-spin',
  notebook:     'game-icons:notebook',
  cog:          'game-icons:cog',
  cancel:       'game-icons:cancel',
  checkMark:    'game-icons:check-mark',
  padlock:      'game-icons:padlock',
  uncertainty:  'game-icons:uncertainty',
  crownedSkull: 'game-icons:crowned-skull',
  crossedSwords:'game-icons:crossed-swords',
  chest:        'game-icons:chest',
  star:         'game-icons:flat-star',
} as const;
