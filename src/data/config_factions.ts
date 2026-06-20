/**
 * @fileoverview 阵营数据定义文件
 * @description 包含游戏中所有可选择的阵营信息
 * @module data/faction
 */

import type { FactionData } from '@/modules/character/types';

/**
 * 阵营数据定义
 * 包含光辉盟约、铁血盟约和中立三大阵营的基本信息
 */
export const FACTIONS: FactionData[] = [
  {
    id: 'alliance',
    name: '光辉盟约',
    icon: 'game-icons:checked-shield',
    color: '#0078ff',
    description: '由辉石城的人类、熔炉堡的矮人、齿轮之城的侏儒、月歌之都的暮精灵以及星舟废墟的星裔共同缔结的古老盟约，为了凡间世界的和平与秩序并肩作战'
  },
  {
    id: 'horde',
    name: '铁血盟约',
    icon: 'game-icons:crossed-axes',
    color: '#ff4400',
    description: '由铁牙堡的兽人、雷崖的牛角族、暗风氏族、银辉城的银辉精灵以及亡者之城的亡者组成的松散同盟，在暮光大陆和辉石大陆为生存而殊死搏斗'
  },
  {
    id: 'neutral',
    name: '中立',
    icon: 'game-icons:scales',
    color: '#4CAF50',
    description: '超脱于光辉盟约与铁血盟约纷争之外的中立势力，包括来自远方禅院的武僧、强大的龙裔龙脉术士，以及致力于维护凡间平衡的各方独立力量'
  }
];
