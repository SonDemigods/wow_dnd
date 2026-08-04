/**
 * @fileoverview 鸣谢与项目信息统一源
 * @description 供 AboutPopup 读取，避免作者/参与人等信息硬编码在组件内
 *
 * 版本号不在此定义，统一复用 version.ts 的 APP_VERSION / DATA_VERSION / DB_SCHEMA_VERSION。
 */
export interface Credits {
  /** 主要作者名单 */
  authors: string[];
  /** 参与人/贡献者名单 */
  contributors: string[];
  /** 一句话项目简介 */
  description: string;
  /** 仓库地址（为空字符串时 AboutPopup 不显示该行） */
  repoUrl: string;
}

/** 鸣谢数据（当前为占位符，待人工填写） */
export const CREDITS: Credits = {
  authors: ['陨落的半神'],
  contributors: [],
  description: '一款基于西方魔幻世界观的单人地下城冒险策略 Web 游戏。扮演冒险者深入地下城，在回合制战斗中运用技能与策略击败敌人，探索未知区域，完成任务，收集装备，书写属于你的冒险传奇。',
  repoUrl: 'https://github.com/SonDemigods/wow_dnd',
};
