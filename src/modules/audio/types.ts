/**
 * @fileoverview 音频模块类型定义
 * @description 定义音效标识、BGM 场景、音频设置等相关类型
 */

/** 音效类型枚举 —— 覆盖游戏中的关键交互事件 */
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
  | 'health_restore'  // 生命恢复
  | 'mana_restore'    // 法力恢复
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
  | 'heal'            // 生命恢复
  | 'character_create'// 创建角色
  | 'resurrect'       // 复活
  | 'gain_exp'        // 获得经验
  | 'mana_recover'    // 法力恢复（与 mana_restore 区分使用场景）
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

/** BGM 场景类型 */
export type BgmScene =
  | 'main_menu'       // 主菜单/角色选择
  | 'exploration'     // 探索
  | 'combat'          // 战斗
  | 'shop'            // 商店
  | 'victory'         // 胜利结算
  | 'defeat';         // 失败

/** 音频设置接口 */
export interface AudioSettings {
  /** 主音量 0-1 */
  masterVolume: number;
  /** 音效音量 0-1 */
  sfxVolume: number;
  /** 背景音乐音量 0-1 */
  bgmVolume: number;
  /** 是否静音 */
  muted: boolean;
  /** 是否启用音效 */
  sfxEnabled: boolean;
  /** 是否启用背景音乐 */
  bgmEnabled: boolean;
}

/** 音频服务接口 */
export interface IAudioService {
  /** 获取当前设置 */
  getSettings(): AudioSettings;
  /** 更新设置 */
  updateSettings(settings: Partial<AudioSettings>): void;
  /** 播放指定音效 */
  playSfx(type: SfxType): void;
  /** 切换 BGM 场景 */
  setBgmScene(scene: BgmScene): void;
  /** 停止 BGM */
  stopBgm(): void;
  /** 初始化音频上下文（需在用户交互后调用） */
  init(): Promise<void>;
}
