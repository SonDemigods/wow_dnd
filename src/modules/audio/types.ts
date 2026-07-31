/**
 * @fileoverview 音频模块类型定义
 * @description 定义音效标识、BGM 场景、音频设置、音频服务接口等相关类型。
 *              本文件是 audio 模块的类型基石，所有类型别名和接口均在此集中定义。
 * @module audio
 */

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 音效类型枚举
 *
 * 覆盖游戏中的全部关键交互事件，共 52 种音效，按场景分类：
 * - 战斗（combat）：攻击命中/未命中/暴击、伤害、治疗、战斗开始/结束/逃跑/跳过
 * - 探索（exploration）：脚步、拾取、陷阱、开门、营地、随机事件
 * - 角色（character）：升级、死亡、金币、治疗、创建、复活、经验
 * - 装备与物品（equip）：装备/卸下、使用、丢弃
 * - UI（ui）：点击、打开/关闭面板、确认/取消
 * - 商店（shop）：打开、购买、出售、刷新
 * - 任务（quest）：接取、完成、放弃、领取奖励
 * - 技能（skill）：记忆、遗忘
 * - 存档（data）：导出、导入
 * - 系统（system）：退出菜单
 *
 * @see SfxType 的具体音效实现在 AudioService.playSfx 中定义
 * @see SFX_ROUTE_MAP 将每种音效映射到对应的效果路由
 */
export type SfxType =
  // 战斗
  | 'attack_hit'      // 玩家攻击命中敌人（物理）
  | 'attack_miss'     // 攻击未命中/闪避
  | 'attack_crit'     // 暴击
  | 'player_hurt'     // 玩家受伤
  | 'enemy_hurt'      // 敌人攻击命中玩家（物理）
  | 'spell_cast'      // 技能/法术施放
  | 'physical_damage' // 物理伤害（通用，无攻击方区分时）
  | 'magic_damage'    // 魔法伤害（通用，无攻击方区分时）
  | 'health_restore'  // 生命恢复（战斗内治疗法术）
  | 'mana_restore'    // 法力恢复（战斗内回蓝法术）
  | 'combat_start'    // 战斗开始
  | 'combat_victory'  // 战斗胜利
  | 'combat_defeat'   // 战斗失败
  | 'combat_flee'     // 逃跑
  | 'combat_skip'     // 跳过回合
  // 探索
  | 'step'            // 移动脚步
  | 'item_pickup'     // 拾取物品
  | 'trap_trigger'    // 触发陷阱
  | 'door_open'       // 开门/进入区域
  | 'camp_rest'       // 营地休息
  | 'random_event'    // 随机事件触发
  // 角色
  | 'level_up'        // 升级
  | 'death'           // 死亡
  | 'coin'            // 获得金币
  | 'heal'            // 生命恢复（非战斗场景：营地休息、物品使用等）
  | 'character_create'// 创建角色
  | 'resurrect'       // 复活
  | 'gain_exp'        // 获得经验
  | 'mana_recover'    // 法力恢复（非战斗场景：营地休息、物品使用等）
  // 装备 & 物品
  | 'equip'           // 装备物品
  | 'unequip'         // 卸下装备
  | 'item_use'        // 使用消耗品
  | 'item_drop'       // 丢弃物品
  // UI
  | 'ui_click'        // 按钮点击
  | 'ui_open'         // 打开面板
  | 'ui_close'        // 关闭面板
  | 'confirm'         // 确认操作
  | 'cancel'          // 取消操作
  // 商店
  | 'shop_open'       // 打开商店
  | 'shop_buy'        // 购买
  | 'shop_sell'       // 出售
  | 'shop_refresh'    // 刷新商品
  // 任务
  | 'quest_accept'    // 接取任务
  | 'quest_complete'  // 完成任务
  | 'quest_abandon'   // 放弃任务
  | 'quest_reward'    // 领取任务奖励
  // 技能
  | 'skill_memorize'  // 记忆技能到技能栏
  | 'skill_forget'    // 从技能栏遗忘
  // 存档
  | 'data_export'     // 导出存档
  | 'data_import'     // 导入存档
  // 系统
  | 'exit_menu';      // 退出到主菜单

/**
 * 音效效果路由分类
 *
 * 决定每种音效走 AudioService 中的哪条效果链处理管线。
 * 每条路由有独立的效果器链，产生不同的听感特征：
 * - `magic`：phaser → cathedralReverb → magicChannel（梦幻魔法感）
 * - `combat`：compressor → combatReverb → combatChannel（冲击力）
 * - `ui`：chorus → sfxReverb → uiChannel（悦耳界面音）
 * - `exploration`：sfxReverb → explorationChannel（空间感）
 * - `character`：chorus → cathedralReverb → characterChannel（神圣感）
 * - `standard`：sfxReverb → standardChannel（通用空间感）
 *
 * @see AudioService.routeSynthTo 根据此类型决定合成器的动态连接
 * @see AudioService.connectEffectChains 在 AudioContext 启动后建立静态效果链
 */
export type SfxRoute =
  | 'magic'
  | 'combat'
  | 'ui'
  | 'exploration'
  | 'character'
  | 'standard';

// ============================================================================
// 映射表
// ============================================================================

/**
 * 音效到效果路由的映射表
 *
 * 将 52 种 SfxType 按听感特征分配到 6 条 SfxRoute 中。
 * 此表是 AudioService.playSfx 中动态路由决策的唯一数据来源，
 * 新增音效类型时必须在此表中添加对应条目。
 *
 * @see AudioService.getRoute 根据此表查询音效对应的路由
 * @see SfxRoute 各路由的效果链结构说明
 */
export const SFX_ROUTE_MAP: Record<SfxType, SfxRoute> = {
  // 魔法类
  spell_cast: 'magic',
  magic_damage: 'magic',
  mana_restore: 'magic',
  mana_recover: 'magic',
  resurrect: 'magic',
  skill_memorize: 'magic',
  skill_forget: 'magic',
  // 战斗类
  attack_hit: 'combat',
  attack_crit: 'combat',
  physical_damage: 'combat',
  player_hurt: 'combat',
  enemy_hurt: 'combat',
  combat_start: 'combat',
  combat_flee: 'combat',
  combat_skip: 'combat',
  // UI 类
  ui_click: 'ui',
  ui_open: 'ui',
  ui_close: 'ui',
  confirm: 'ui',
  cancel: 'ui',
  // 探索类
  step: 'exploration',
  door_open: 'exploration',
  trap_trigger: 'exploration',
  camp_rest: 'exploration',
  random_event: 'exploration',
  // 角色类
  level_up: 'character',
  character_create: 'character',
  death: 'character',
  combat_victory: 'character',
  combat_defeat: 'character',
  quest_complete: 'character',
  quest_reward: 'character',
  // 标准
  attack_miss: 'standard',
  health_restore: 'standard',
  heal: 'standard',
  gain_exp: 'standard',
  coin: 'standard',
  equip: 'standard',
  unequip: 'standard',
  item_pickup: 'standard',
  item_use: 'standard',
  item_drop: 'standard',
  shop_open: 'standard',
  shop_buy: 'standard',
  shop_sell: 'standard',
  shop_refresh: 'standard',
  quest_accept: 'standard',
  quest_abandon: 'standard',
  data_export: 'standard',
  data_import: 'standard',
  exit_menu: 'standard',
};

// ============================================================================
// BGM 场景
// ============================================================================

/**
 * BGM 场景类型
 *
 * 定义游戏中不同场景的背景音乐类型，每种场景有不同的管风琴演奏风格：
 * - `main_menu`：庄严管风琴圣咏，D 多利亚 → C 弗里吉亚交替
 * - `exploration`：神秘管风琴铺底，D 多利亚调式开放五度和弦
 * - `combat`：压迫感管风琴，C 弗里吉亚三全音
 * - `shop`：温暖小管风琴，F 利底亚爵士七和弦
 * - `victory`：管风琴胜利旋律，3 秒后切回探索
 * - `defeat`：管风琴下行旋律，3 秒后切回探索
 *
 * @see AudioService.setBgmScene 根据此类型切换 BGM
 * @see AudioService.playMainMenuBgm 等私有方法实现各场景的具体音乐
 */
export type BgmScene =
  | 'main_menu'
  | 'exploration'
  | 'combat'
  | 'shop'
  | 'victory'
  | 'defeat';

// ============================================================================
// 音频设置
// ============================================================================

/**
 * 音频设置接口
 *
 * 管理玩家的全部音频偏好设置，所有音量值均为 0-1 的线性值。
 * 设置通过 useAudioStore 管理状态（P3-116 后委托 GameStore 持久化到 IndexedDB）。
 *
 * 音量计算链（dB 相加 = 线性相乘）：
 * - 主音量 dB 映射到 masterVolume 节点
 * - BGM 通道额外 dB 映射到 bgmChannel 节点
 * - SFX 各通道额外 dB 映射到 6 个分类通道节点
 * - 最终音量 = masterVolume × bgmVolume（BGM）或 masterVolume × sfxVolume（SFX）
 *
 * @property {number} masterVolume - 主音量 0-1，控制所有音频输出的总线音量
 * @property {number} sfxVolume - 音效音量 0-1，控制所有 SFX 通道的额外衰减
 * @property {number} bgmVolume - 背景音乐音量 0-1，控制 BGM 通道的额外衰减
 * @property {boolean} muted - 是否全局静音（true 时所有通道 effective 音量为 0）
 * @property {boolean} sfxEnabled - 是否启用音效（false 时 effectiveSfxVolume 恒为 0）
 * @property {boolean} bgmEnabled - 是否启用背景音乐（false 时 effectiveBgmVolume 恒为 0）
 *
 * @see useAudioStore 管理此设置的状态（P3-116 后持久化由 GameStore 统一负责）
 * @see AudioService.applyVolume 将设置应用到 Tone.js 各通道
 * @see DEFAULT_AUDIO_SETTINGS 全局唯一的默认值常量
 */
export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  muted: boolean;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
}

/**
 * 默认音频设置常量
 *
 * 全局唯一的默认值来源，GameStore（gameSettings 默认值）和 audio store 均引用此常量。
 * 原因：保证模块内所有默认值一致，避免因多处硬编码导致的配置漂移。
 *
 * @see AudioSettings 接口定义
 * @see useGameStore.initialize 首次初始化时使用此常量填充 gameSettings
 * @see useAudioStore 通过只读 computed 派生自此常量填充的 GameStore.gameSettings
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  bgmVolume: 0.5,
  muted: false,
  sfxEnabled: true,
  bgmEnabled: true,
};

// ============================================================================
// 音频服务接口
// ============================================================================

/**
 * 音频服务接口
 *
 * 定义 AudioService 的完整公共 API，外部模块通过此接口类型引用音频服务，
 * 而非直接依赖 AudioService 实现类，便于单元测试 mock 和未来扩展。
 *
 * 生命周期：
 * 1. init() → 加载 DB 设置 → 绑定事件 → 监听用户交互
 * 2. 用户交互 → AudioContext 启动 → 混响生成 → 效果链连接
 * 3. 运行时 → playSfx() / setBgmScene() / updateSettings() 正常工作
 * 4. destroy() → 停止 BGM → 取消事件订阅 → 清理定时器
 *
 * @property {() => AudioSettings} getSettings - 获取当前设置的快照副本
 * @property {(settings: Partial<AudioSettings>) => void} updateSettings - 更新部分或全部音量设置（自动持久化）
 * @property {(type: SfxType) => void} playSfx - 播放指定音效（未就绪时调用 tryResume 尝试启动 AudioContext）
 * @property {(scene: BgmScene) => void} setBgmScene - 切换到指定的 BGM 场景
 * @property {() => void} stopBgm - 停止 BGM 播放并清理所有资源（Pattern、Loop、振荡器）
 * @property {() => Promise<void>} init - 初始化音频服务（应在用户首次交互前调用）
 * @property {() => boolean} isReady - 检查音频服务是否已完全就绪（AudioContext 运行 + 混响生成 + 效果链连接）
 * @property {() => void} destroy - 销毁音频服务，清理所有资源、取消事件订阅和 Store 订阅
 *
 * @see AudioService 实现类
 */
export interface IAudioService {
  getSettings(): AudioSettings;
  updateSettings(settings: Partial<AudioSettings>): void;
  playSfx(type: SfxType): void;
  setBgmScene(scene: BgmScene): void;
  stopBgm(): void;
  init(): Promise<void>;
  isReady(): boolean;
  destroy(): void;
}
