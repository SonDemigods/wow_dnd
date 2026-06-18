/**
 * @fileoverview 种族数据定义文件
 * @description 包含所有可选择的种族信息，包括属性加成、图标和描述
 * @module data/race
 */

import type { RaceData } from '@/modules/character/types';

/**
 * 种族数据定义
 * 包含所有可选择的种族，每个种族有自己的阵营归属、属性加成和描述
 */
export const RACES: RaceData[] = [
  {
    id: 'human',
    name: '人类',
    icon: '🧑',
    factionId: 'alliance',
    bonus: { str: 1, cha: 1 },
    description: '凡间分布最广、数量最多的种族，曾是古王国盟约的核心力量，如今在辉石王国的旗帜下，以坚韧的意志、出色的外交手腕和无与伦比的适应能力守护着王国的荣耀'
  },
  {
    id: 'dwarf',
    name: '矮人',
    icon: 'game-icons:dwarf-helmet',
    factionId: 'alliance',
    bonus: { con: 2, wis: 1 },
    description: '熔炉堡的钢铁之子，矮人一族世代居住在熔炉山脉的雪山深处，以无与伦比的锻造技艺、对矿石与麦酒的狂热挚爱以及坚不可摧的意志闻名于世'
  },
  {
    id: 'gnome',
    name: '侏儒',
    icon: '🤖',
    factionId: 'alliance',
    bonus: { int: 2, dex: 1 },
    description: '来自齿轮之城的侏儒是凡间最聪明的发明家，他们的奇思妙想推动着机械工程与魔法科技的边界，从铁羽陆行鸟到空间传送装置，没有什么是侏儒工程师搞不定的'
  },
  {
    id: 'night_elf',
    name: '暮精灵',
    icon: '🧝',
    factionId: 'alliance',
    bonus: { dex: 2, wis: 1 },
    description: '古老的暮精灵后裔，敏捷且与自然有深厚联系'
  },
  {
    id: 'draenei',
    name: '星裔',
    icon: '✨',
    factionId: 'alliance',
    bonus: { wis: 2, cha: 1 },
    description: '来自破碎之源的高贵流亡者，在圣光之灵的指引下横跨星海追寻圣光之道。星裔人以虔诚的信仰与深邃的智慧著称，他们的蹄声回荡着千年逃亡的悲歌，却从未熄灭眼中燃烧的圣光之火'
  },
  {
    id: 'worgen',
    name: '狼人',
    icon: 'game-icons:werewolf',
    factionId: 'alliance',
    bonus: { dex: 2, str: 1 },
    description: '灰狼王国的子民身负古老狼人诅咒，能在人形与狼形之间自由转换。他们以野兽般的嗅觉追踪敌人，以利爪撕碎一切阻挡者，同时依然保留着维多利亚时代的高贵风骨与不屈斗志'
  },
  {
    id: 'pandaren',
    name: '兽灵族',
    icon: '🐼',
    factionId: 'neutral',
    bonus: { con: 1, wis: 1, dex: 1 },
    description: '古老而神秘的中立种族，传承着古老的武学之道'
  },
  {
    id: 'orc',
    name: '兽人',
    icon: 'game-icons:orc-head',
    factionId: 'horde',
    bonus: { str: 2, con: 1 },
    description: '这些来自破碎世界的绿皮勇士是天生的战斗民族，信奉"不胜利，毋宁死"的信条。兽人拥有钢铁般的肌肉和狂暴的战斗意志，在部族酋长的旗帜下用鲜血与荣耀书写着属于他们的史诗'
  },
  {
    id: 'undead',
    name: '亡者',
    icon: '💀',
    factionId: 'horde',
    bonus: { int: 2, dex: 1 },
    description: '挣脱亡者君主意志的亡者，在亡者之城深处以不死之躯续写自由意志的篇章。亡者女王率领这支亡者军团向亡者军团复仇，用黑暗魔法与炼金药剂涂抹着属于亡者的灰色未来'
  },
  {
    id: 'tauren',
    name: '牛角族',
    icon: 'game-icons:minotaur',
    factionId: 'horde',
    bonus: { con: 2, wis: 1 },
    description: '苍风高地平原上的高岭之子，牛角族世代遵循大地母亲的神圣教义，用图腾与歌谣守护着自然的平衡。他们身躯如山岳般巍峨，却怀抱一颗敬畏生命、崇尚和平的赤诚之心'
  },
  {
    id: 'troll',
    name: '巨魔',
    icon: '🧌',
    factionId: 'horde',
    bonus: { dex: 2, str: 1 },
    description: '来自棘藤谷的暗风氏族丛林巨魔，凭借惊人的再生之躯与神秘的巫毒仪式在危机四伏的丛林中繁衍生息。暗风酋长之子以长矛与暗影猎手的诡计为部族献上最狡黠的忠诚'
  },
  {
    id: 'blood_elves',
    name: '银辉精灵',
    icon: '🧜',
    factionId: 'horde',
    bonus: { int: 2, cha: 1 },
    description: '曾是银辉精灵的遗民，在圣光之泉被亡者军团摧毁后经历了法力饥渴的折磨与屈辱，浴血重生的银辉精灵掌握了从一切源头汲取奥术能量的能力，凭借精湛的魔法技艺和与生俱来的高贵气质重新屹立于银辉圣地'
  },
  {
    id: 'goblin',
    name: '地精',
    icon: 'game-icons:goblin-head',
    factionId: 'horde',
    bonus: { dex: 1, cha: 2 },
    description: '来自蒸汽之岛的绿皮小个子是凡间最狡黠的商人与发明家，地精以"时间就是金钱"为座右铭，用火箭科技和爆破工程征服一切敢于挡路的家伙，在他们的字典里没有什么是金钱搞不定的'
  },
  {
    id: 'void_elf',
    name: '暗影精灵',
    icon: '🌑',
    factionId: 'alliance',
    bonus: { dex: 1, int: 2 },
    description: '一群敢于触碰暗影帷幕的精灵学者，被暗影之力转化后获得了穿梭空间裂缝、召唤暗影触手的能力。暗影精灵在疯狂的边缘徘徊，却成功地驯服了宇宙中最危险的力量为己所用'
  },
  {
    id: 'lightforged_draenei',
    name: '圣光星裔',
    icon: '✨',
    factionId: 'alliance',
    bonus: { con: 1, wis: 2 },
    description: '经过圣光远征军千锤百炼的星裔战士，每一寸躯体都被圣光之灵的圣光所灌注，眼中燃烧着永不熄灭的神圣火焰。他们是深渊军团最畏惧的天敌，也是凡间最坚定的光明守护者'
  },
  {
    id: 'dark_iron_dwarf',
    name: '铁炉矮人',
    icon: 'game-icons:dwarf-king',
    factionId: 'alliance',
    bonus: { str: 1, con: 2, int: 1 },
    description: '黑岩山脉深处熔岩之城的铁炉矮人，将烈焰领主的怒火与秘银砧的技艺熔铸于血脉之中。他们曾臣服于烈焰领主的灼热意志，如今在茉艾拉女王的引领下重拾铁砧，用熔岩深渊锻出不灭的铁卫之魂'
  },
  {
    id: 'kul_tiran',
    name: '海民',
    icon: '⚓',
    factionId: 'alliance',
    bonus: { con: 2, wis: 1 },
    description: '海民，数代人以海洋为家、以舰队为剑，用最坚固的龙骨战舰巡航整片无垠之海。他们体格壮硕如船首像，拥有征服惊涛骇浪的胆魄与航海者的永不言弃'
  },
  {
    id: 'mecha_gnome',
    name: '机关侏儒',
    icon: 'game-icons:gears',
    factionId: 'alliance',
    bonus: { dex: 1, int: 2 },
    description: '为了对抗血肉诅咒而主动将身体替换为机械义体的侏儒，在麦卡贡岛重获新生。机关侏儒将逻辑计算与工程创造发挥到了极致，每一个齿轮与活塞都是他们理性的延伸'
  },
  {
    id: 'nightborne',
    name: '暮光后裔',
    icon: '🌙',
    factionId: 'horde',
    bonus: { int: 2, cha: 1 },
    description: '苏拉玛城的古老居民，依靠暗夜井的魔力在护罩下生活了上万年。暮光后裔兼修优雅的奥术法术与致命的剑舞，他们走出护罩后的每一步，都散发着如星辰般高贵而危险的光芒'
  },
  {
    id: 'highmountain_tauren',
    name: '高岭牛角族',
    icon: '🏔️',
    factionId: 'horde',
    bonus: { con: 2, wis: 1 },
    description: '栖息在破碎群岛至高山巅的牛角族分支，以胡恩·高岭的血脉为荣，头顶雄壮的麋鹿角是大地母亲赐予他们的神圣印记。他们与高山雄鹰为伴，用长矛与图腾守卫着苍穹之下的家园'
  },
  {
    id: 'maghar_orc',
    name: '棕皮兽人',
    icon: '👹',
    factionId: 'horde',
    bonus: { str: 2, con: 1 },
    description: '未被魔能污染的棕皮兽人。棕皮兽人继承了先祖最纯粹的战士血脉，拒绝一切腐化与妥协，用钢铁部族的铁血呐喊向敌人昭示何为真正的荣耀'
  },
  {
    id: 'zandalari',
    name: '远古巨魔',
    icon: 'game-icons:lizardman',
    factionId: 'horde',
    bonus: { str: 1, con: 2, wis: 1 },
    description: '巨魔帝国中最辉煌的黄金巨魔族的精英，他们的黄金之城太阳之城闪烁着远古诸王的光辉。远古巨魔供奉着古灵，身披最华丽的黄金甲胄，誓以巨魔帝国之名重铸往昔的荣光'
  },
  {
    id: 'vulpera',
    name: '狐族',
    icon: '🦊',
    factionId: 'horde',
    bonus: { dex: 2, wis: 1 },
    description: '来自黄沙荒漠的小巧狐族，凭借无比灵敏的身手和狡猾的头脑在严酷环境中世代繁衍。狐族携带着神秘的图腾魔法和精巧的机械装置，是绝佳的寻路者、探险家和生存专家'
  },
  {
    id: 'dracthyr',
    name: '龙裔',
    icon: '🐉',
    factionId: 'neutral',
    bonus: { dex: 1, int: 2 },
    description: '由灭世之龙亲手创造的龙裔战士，结合了五色巨龙之力和凡人的灵活形态。他们是最后的龙裔军团，他们继承了巨龙的元素吐息与翱翔天际的能力，誓以新生之躯守卫龙族古老的誓言'
  },
  {
    id: 'earthen',
    name: '大地之子',
    icon: '🪨',
    factionId: 'neutral',
    bonus: { con: 2, wis: 1 },
    description: '由远古造物者从大地基岩中雕琢而成的人形生物，沉睡于地底深渊之下千万年。大地之子是大地意志的化身，他们的血脉中流淌着最纯净的矿石，每一拳都承载着远古造物者的原始力量'
  },
  {
    id: 'harenei',
    name: '林荫精灵',
    icon: 'game-icons:tree-branch',
    factionId: 'neutral',
    bonus: { dex: 1, int: 1, wis: 1 },
    description: '翠绿梦境中最古老的守护者之一，这些与自然共生的半羊人长角精灵以牧歌般的方式守护着森林的和谐。林荫精灵轻盈灵动，能用自然之力治愈生灵，亦能将荆棘与藤蔓化为致命武器'
  }
];
