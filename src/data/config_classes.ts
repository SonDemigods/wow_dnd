/**
 * @fileoverview 地下城职业数据模块
 * @description 包含所有可选职业的基础信息和技能详情
 * @module data/class
 */

import type { ClassData } from '../modules/character/types';

/**
 * 所有可选职业的完整数据集
 * @type {ClassData[]}
 */
export const CLASSES: ClassData[] = [
  {
    id: 'warrior',
    name: '战士',
    icon: '⚔️',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '身披重甲屹立于最前线的无畏勇士，无论是雄狮之王的断剑还是战刃将军的战斧都曾以战士之名铭刻传奇。他们精通所有武器与护甲，凭借怒气驱动英勇飞跃与旋风一击，是战场上永不倒下的中流砥柱',
    color: '#C79C6E',
    bonus: { str: 2, con: 1, int: -1, wis: -1 }
  },
  {
    id: 'paladin',
    name: '圣骑士',
    icon: '🔨',
    primaryStat: 'cha',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'draenei', 'lightforged_draenei', 'dark_iron_dwarf', 'tauren', 'blood_elves', 'zandalari', 'earthen'],
    description: '以圣光之名挥动战锤的正义守护者，集神圣祝福、无敌护盾与惩戒之力于一身。圣骑士既能用圣光治愈盟友的创伤，也能以复仇之怒粉碎一切邪恶，是战场上最可靠的坚盾与利剑',
    color: '#F58CBA',
    bonus: { str: 1, con: 1, dex: -1, int: -1, cha: 2 }
  },
  {
    id: 'hunter',
    name: '猎人',
    icon: '🏹',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '与野兽为伴的荒野主宰，荒野猎手与他的忠诚战熊便是猎人的象征。他们精通远程射击与陷阱布置，能从荒野中驯服最凶猛的野兽作为忠实战友，以精确的瞄准射击和狩猎指令终结猎物',
    color: '#ABD473',
    bonus: { dex: 2, con: 1, int: -1, wis: 1, cha: -1 }
  },
  {
    id: 'rogue',
    name: '潜行者',
    icon: '🗡️',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '潜行于阴影之中的致命杀手，如同影子般神出鬼没。潜行者依靠连击点与能量系统发动毁灭性的伏击、刺背和透骨，擅长用毒药削弱敌人并在最意想不到的时机给予致命一击',
    color: '#FFF569',
    bonus: { dex: 3, str: -1, con: -1, int: -1 }
  },
  {
    id: 'priest',
    name: '牧师',
    icon: '✝️',
    primaryStat: 'wis',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '圣光在人间的代言者，圣光先知与暗影主教都曾影响整个时代的信仰。牧师既能以愈合祷言与圣光护盾守护队友，也能化身为暗影形态以精神震爆和暗影之触吞噬敌人的意志',
    color: '#FFFFFF',
    bonus: { int: 1, wis: 3, str: -1, dex: -1, con: -1, cha: -1 }
  },
  {
    id: 'shaman',
    name: '萨满祭司',
    icon: '⚡',
    primaryStat: 'wis',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['dwarf', 'draenei', 'dark_iron_dwarf', 'kul_tiran', 'orc', 'tauren', 'troll', 'goblin', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'earthen', 'harenei'],
    description: '与火、水、风、土四大元素缔结契约的灵魂行者，伟大的元素先知便是在自然之环中领悟了元素之怒的真正力量。萨满祭司召唤熔岩爆发焚毁强敌、以连锁雷击贯穿整片战场，还能插下图腾为盟友降下元素祝福，是铁血盟约与光辉盟约中最受崇敬的自然之怒化身',
    color: '#0070DE',
    bonus: { con: 1, int: 1, wis: 2, dex: -1, cha: -1 }
  },
  {
    id: 'mage',
    name: '法师',
    icon: '🧙',
    primaryStat: 'int',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '在奥法学院奥术殿堂中钻研奥术的学者，奥术大师和冰霜女巫是法师的传奇典范。他们以奥术智慧驾驭冰霜宝珠、烈焰爆和空间传送，能在转瞬间改变战局或跨越整个大陆',
    color: '#69CCF0',
    bonus: { int: 3, str: -1, con: -1, cha: -1 }
  },
  {
    id: 'warlock',
    name: '术士',
    icon: '💜',
    primaryStat: 'int',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'dracthyr', 'earthen', 'harenei'],
    description: '与深渊军团签订暗影契约的禁忌施法者，暗影术士之主便是术士之道的极端化身。他们以生命值和灵魂碎片为代价，召唤混沌陨石、施放混乱之箭并释放折磨诅咒，在毁灭与痛苦之间行走于刀锋之上',
    color: '#9482C9',
    bonus: { int: 2, str: -1, con: -1, wis: -1, cha: 2 }
  },
  {
    id: 'monk',
    name: '武僧',
    icon: '🥋',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren', 'earthen', 'harenei'],
    description: '从远方的神秘禅院中出师的拳法大师，将酿酒之道与拳术融会贯通名扬天下。武僧以真气运转拳法、以醉拳化解伤害，施以猛虎掌、旭日踢和真气波在近身缠斗中优雅制敌',
    color: '#00FF96',
    bonus: { dex: 2, con: 1, wis: 1, str: -1, cha: -1 }
  },
  {
    id: 'druid',
    name: '德鲁伊',
    icon: '🌿',
    primaryStat: 'wis',
    factionsIds: ['alliance', 'horde', 'neutral'],
    raceIds: ['night_elf', 'worgen', 'kul_tiran', 'tauren', 'troll', 'highmountain_tauren', 'zandalari', 'harenei'],
    description: '自然守护者的弟子。他们在熊、猎豹、月兽等形态之间自由切换，借助自然的星辰之怒和愈合术守护翠绿梦境与整个世界的生态平衡',
    color: '#FF7D0A',
    bonus: { dex: 1, int: 1, wis: 2, str: -1, cha: -1 }
  },
  {
    id: 'death_knight',
    name: '亡灵骑士',
    icon: '💀',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['human', 'dwarf', 'gnome', 'night_elf', 'draenei', 'worgen', 'void_elf', 'lightforged_draenei', 'dark_iron_dwarf', 'kul_tiran', 'mecha_gnome', 'orc', 'undead', 'tauren', 'troll', 'blood_elves', 'goblin', 'nightborne', 'highmountain_tauren', 'maghar_orc', 'zandalari', 'vulpera', 'pandaren'],
    description: '从堕落之王的腐地复生的黑暗骑士，亡灵骑士以咒文剑和腐烂凋零扭曲战场。他们既是冰霜的暴君，也是鲜血的屠夫，用灵魂收割和亡者军团将敌人拖入永恒的寒冬',
    color: '#C41F3B',
    bonus: { str: 2, con: 1, dex: -1, int: -1, wis: -1, cha: 1 }
  },
  {
    id: 'demon_hunter',
    name: '影刃猎手',
    icon: '👿',
    primaryStat: 'dex',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['night_elf', 'blood_elves'],
    description: '拥有魔能之血和牺牲的双眸，暗影行者是所有影刃猎手中最传奇的存在。他们以战刃为武器、以魔能变形释放体内恶魔之力，在刀刃与火焰中猎杀每一个胆敢踏入凡间的深渊造物',
    color: '#A330C9',
    bonus: { dex: 3, int: 1, con: -1, wis: -1 }
  },
  {
    id: 'evoker',
    name: '龙脉术士',
    icon: '🐉',
    primaryStat: 'int',
    factionsIds: ['neutral'],
    raceIds: ['dracthyr'],
    description: '龙裔一族专属的龙裔施法者，继承了远古龙王的遗产与远古龙族议会的神圣使命。龙脉术士以龙翼翱翔战场，从口中喷吐毁灭性的火焰吐息，亦能反转时光以翡翠之花治愈盟友',
    color: '#33937F',
    bonus: { int: 3, con: -1 }
  }
];
