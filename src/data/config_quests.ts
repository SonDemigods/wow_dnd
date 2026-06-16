/**
 * @fileoverview 游戏任务数据模块
 * @description 包含所有可接任务的详细信息，包括任务目标和奖励
 * @module data/quest
 */

import type { QuestDefinition } from '../modules/quest/types';

/**
 * 所有可接任务的完整数据集
 * @type {QuestDefinition[]}
 */
export const QUESTS: QuestDefinition[] = [
  {
    id: 'teldrassil_defense',
    title: '苍穹之冠的守卫',
    description: '暮精灵哨兵传来急报——苍穹之冠脚下的暗影森林中，剧毒蜘蛛巢穴正在疯狂扩张，毒液已污染了数条溪流。如果不加以遏制，整个森林的生态都将崩溃。勇士，拿起武器深入密林，在事态失控之前将它们彻底铲除！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 5,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 1,
    xpReward: 80,
    goldReward: 40,
    boardId: 'teldrassil'
  },
  {
    id: 'teldrassil_gnolls',
    title: '森林强盗',
    description: '连日来，多支商队在森林边缘遭到残忍伏击，货物被洗劫一空，幸存者称袭击者是一群嗜血的豺狼人。它们占据了通往多兰纳尔的要道，若不尽快清除，整条补给线都将被切断。旅行者们人心惶惶，等你挺身而出！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_gnoll',
        type: 'kill',
        target: 4,
        enemyId: 'gnoll'
      }
    ],
    levelRequirement: 1,
    xpReward: 100,
    goldReward: 50,
    boardId: 'teldrassil'
  },
  {
    id: 'azuremyst_spiders',
    title: '蜘蛛入侵',
    description: '星裔定居者惊恐地发现，蓝晶岛西部的洞穴中涌出了前所未有数量的变异蜘蛛，它们的毒液能让成年星裔瞬间麻痹。更糟的是，这些蜘蛛正朝琥珀松小屋的方向蔓延。猎人已发出最高警报——必须立刻行动！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 6,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'azuremyst'
  },
  {
    id: 'azuremyst_gnolls',
    title: '强盗窝点',
    description: '哨兵侦察发现，一群豺狼人已在蓝晶岛东北角搭建了粗陋的营寨，篝火彻夜不熄。它们以此为据点向四周劫掠，附近晶化矿洞的工人已不敢独自出门。趁着它们立足未稳，一举摧毁这个强盗据点！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_gnoll',
        type: 'kill',
        target: 3,
        enemyId: 'gnoll'
      }
    ],
    levelRequirement: 1,
    xpReward: 50,
    goldReward: 25,
    boardId: 'azuremyst'
  },
  {
    id: 'ashenvale_orcs',
    title: '兽人入侵',
    description: '德鲁伊们愤怒了——战吼氏族的兽人在苍翠之谷腹地日夜砍伐古树，巨木倒下的轰鸣声回荡在整片森林。若不加以阻止，这片古老林地将化为焦土，栖息其中的众多生灵也将无家可归。暮精灵需要勇士替他们守护家园！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 5,
    xpReward: 120,
    goldReward: 60,
    boardId: 'ashenvale'
  },
  {
    id: 'ashenvale_spiders',
    title: '毒蛛清剿',
    description: '苍翠之谷深处的森林巨蛛体型已大到足以捕猎成年暗影猎豹，它们的蛛丝遮天蔽日，连飞鸟都无法穿越。最近已有数名哨兵在巡逻时被拖入蛛网，生死未卜。治愈者恳请你深入密林，在更多人遇害前清剿这片毒蛛领地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 5,
    xpReward: 100,
    goldReward: 50,
    boardId: 'ashenvale'
  },
  {
    id: 'elwynn_gnolls',
    title: '豺狼之灾',
    description: '辉石城卫兵焦头烂额——翠叶森林边缘的豺狼人数量激增，它们趁夜色偷袭农场、掠走牲畜，已有三个农场主向军情七处发出求救。秋收在即，若不能平息这场豺狼之灾，辉石城这个冬天将面临粮荒。拿起武器保护我们的粮仓！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_gnoll',
        type: 'kill',
        target: 4,
        enemyId: 'gnoll'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'elwynn'
  },
  {
    id: 'elwynn_bandits',
    title: '打击盗匪',
    description: '翠叶森林边境商路上出现了一伙亡命盗匪，他们打着"自由人"的旗号劫掠过往商人，手段极其残忍。一名幸存的商贩说领头的独眼盗匪扬言要"让辉石城知道谁才是这片森林的主人"。王国的法律不容践踏——去让他们付出代价！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bandit',
        type: 'kill',
        target: 3,
        enemyId: 'bandit'
      }
    ],
    levelRequirement: 1,
    xpReward: 50,
    goldReward: 25,
    boardId: 'elwynn'
  },
  {
    id: 'westfall_bandits',
    title: '西风荒野的强盗',
    description: '暗影公会卷土重来！这个曾经被击溃的神秘组织在西风荒野重新集结，沿途袭扰商队、焚烧谷仓，整个地区的居民生活在恐惧之中。情报显示他们正在招募新兵，必须在其力量壮大之前予以痛击。光辉盟约的荣耀寄托在你身上！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bandit',
        type: 'kill',
        target: 5,
        enemyId: 'bandit'
      }
    ],
    levelRequirement: 3,
    xpReward: 80,
    goldReward: 40,
    boardId: 'westfall'
  },
  {
    id: 'westfall_skeletons',
    title: '闹鬼的农场',
    description: '暗影镇的农民惊恐地报告——废弃的农场中传出了嘎吱作响的骨骼摩擦声，月光下有人看到了行走的骷髅！老人们说这是被遗忘的农夫亡魂，因冤屈无法安息。无论真相如何，这些亡灵已经开始攻击活人。让它们重归尘土吧！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 3,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 3,
    xpReward: 70,
    goldReward: 35,
    boardId: 'westfall'
  },
  {
    id: 'redridge_orcs',
    title: '黑崖兽人的威胁',
    description: '斥候带来了令人不安的消息——黑崖兽人正在赤岩山脉集结兵力，他们的战斗怒吼甚至在湖畔镇都能隐约听见。这些兽人并非流浪散兵，而是有组织的军事力量。一旦他们完成集结，整个赤岩山脉地区都将陷入战火。抢先动手，挫败他们的计划！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 4,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 5,
    xpReward: 100,
    goldReward: 50,
    boardId: 'redridge'
  },
  {
    id: 'redridge_spiders',
    title: '峡谷蜘蛛',
    description: '赤脊峡谷的旅人频遭袭击——伏在岩石阴影中的巨型蜘蛛会突然扑向毫无防备的过路者。一位受伤的矮人猎人警告说，峡谷深处可能有一只体型更为庞大的蛛母正在不断产卵。如果不尽快清除这些埋伏，整条峡谷将无人敢通行！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 3,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 5,
    xpReward: 90,
    goldReward: 45,
    boardId: 'redridge'
  },
  {
    id: 'duskwood_skeletons',
    title: '墓地的亡灵',
    description: '暗夜镇的守夜人已经连续多日没合眼了——镇外的墓园在午夜时分总有无名亡灵破土而出，朝着镇子方向缓慢行进。镇长怀疑有邪恶的亡灵法师在暗中操控这一切，若不揪出幕后黑手并净化亡者，整个小镇将被亡灵淹没！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 6,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 8,
    xpReward: 120,
    goldReward: 60,
    boardId: 'duskwood'
  },
  {
    id: 'duskwood_spiders',
    title: '森林毒蛛',
    description: '暗影森林的毒蛛与其他地方截然不同——它们在黑暗魔法的浸染下变得异常凶猛，毒液能让一头成年马在几步之内倒地抽搐。暗影森林的草药师急需蜘蛛毒腺研制解毒剂，但采集者都一去不返。冒险者，这既是猎杀也是拯救！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 8,
    xpReward: 110,
    goldReward: 55,
    boardId: 'duskwood'
  },
  {
    id: 'silverpine_skeletons',
    title: '亡者的威胁',
    description: '灰松森林弥漫着腐朽的气息——曾经战死在此的古王国士兵在亡灵之力驱使下重新站起，骨骼上还残留着生前未能愈合的箭伤。他们不分敌我地攻击沿途一切生者，亡者的炼金师认为这是药剂失控的结果。在亡灵扩散到灰狼领边境之前，必须阻止它们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 5,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 8,
    xpReward: 130,
    goldReward: 65,
    boardId: 'silverpine'
  },
  {
    id: 'silverpine_wolves',
    title: '疯狼之灾',
    description: '灰松森林的狼群不知染上了什么怪病——它们的嘴角挂着腥臭的涎水，双眼充血通红，攻击一切活动的物体。森林管理员怀疑是亡者的瘟疫实验污染了水源，狼群才变得如此疯狂。在这些疯狼冲出森林威胁村庄之前，必须肃清它们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_wolf',
        type: 'kill',
        target: 4,
        enemyId: 'wolf'
      }
    ],
    levelRequirement: 8,
    xpReward: 120,
    goldReward: 60,
    boardId: 'silverpine'
  },
  {
    id: 'tirisfal_skeletons',
    title: '亡灵的起源',
    description: '亡者的黑暗女士有令——幽冥林地上残留的前朝亡灵正日益躁动，它们是被亡者君主遗弃在此的散兵游勇。这些无主的亡灵在林地间漫无目的地徘徊，却本能地攻击一切活物和意志薄弱的新晋亡灵。净化它们，让这片土地归于秩序！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 4,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 1,
    xpReward: 50,
    goldReward: 25,
    boardId: 'tirisfal'
  },
  {
    id: 'tirisfal_ghouls',
    title: '食尸鬼之患',
    description: '暮钟镇的墓穴守卫惊恐地发现，几只食尸鬼掘开了新的乱葬坑，正用利爪刨食尚未腐烂的尸体。这些怪物繁殖速度惊人——若不加控制，用不了多久它们就会成群结队地涌向暮钟镇。趁它们饱食之后行动迟缓，正是出手的好时机！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_ghoul',
        type: 'kill',
        target: 3,
        enemyId: 'ghoul'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'tirisfal'
  },
  {
    id: 'plaguelands_skeletons',
    title: '亡者军团',
    description: '腐地上空笼罩着不祥的墨绿色雾气——这曾是古王国最肥沃的农田，如今已沦为亡者军团的前进基地。破晓骑士团急报传来，亡灵部队正在集结，目标直指南方的圣光之愿礼拜堂。在敌人发动总攻之前，必须粉碎他们的先头部队！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 5,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 15,
    xpReward: 250,
    goldReward: 120,
    boardId: 'plaguelands'
  },
  {
    id: 'plaguelands_demons',
    title: '深渊军团的先锋',
    description: '破晓远征军的圣骑士在腐地东部发现了深渊军团的身影——这些恶魔术士正在布设一个庞大的召唤法阵，意图将深渊领主传送至凡间！如果法阵完成，后果不堪设想。圣光在上，你必须在月相吻合之前摧毁他们的邪恶仪式！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 3,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 15,
    xpReward: 280,
    goldReward: 140,
    boardId: 'plaguelands'
  },
  {
    id: 'stranglethorn_trolls',
    title: '血顶巨魔',
    description: '棘藤谷的地精商会已停止向北部送货——血棘巨魔部落在不到一周内袭击了六支运输队，掠夺了包括顶级军火在内的大量物资。更令人担忧的是，有传言说他们正用劫掠所得向古林部族的黑暗神灵献祭。阻止他们，就是拯救无数无辜生命！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 10,
    xpReward: 150,
    goldReward: 75,
    boardId: 'stranglethorn'
  },
  {
    id: 'stranglethorn_orcs',
    title: '投机商会',
    description: '黑铁商会——这个以破坏自然而闻名的地精企业——雇佣了一批兽人伐木工与雇佣兵闯入棘藤谷雨林，日以继夜地用伐木机撕碎古老丛林。德鲁伊们愤怒至极，称这是对自然的亵渎。前往丛林深处，打醒这群为钱卖命的家伙！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 3,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 10,
    xpReward: 160,
    goldReward: 80,
    boardId: 'stranglethorn'
  },
  {
    id: 'stonetalon_orcs',
    title: '石脊要塞',
    description: '铁血盟约的萨满从元素之灵那里收到了痛苦的哀嚎——铁刃兽人在石脊山脉深处建立了一座武装要塞，他们的炸药和伐木机正在撕裂山脉的心脏。德鲁伊们说山体内部有远古大地之灵的安息所，一旦被惊扰后果将波及整个暮光大陆。攻破这座要塞，阻止兽人！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 8,
    xpReward: 140,
    goldReward: 70,
    boardId: 'stonetalon'
  },
  {
    id: 'stonetalon_spiders',
    title: '洞穴毒蛛',
    description: '石脊山脉的矿工被困在了矿道深处——一群洞穴毒蛛在主要通道上布下了密不透风的蛛网，将十几名矮人矿工困在矿坑内部。救援队试了三次都无法突破蛛网防线，一名冲进去的战士至今昏迷在解毒药的作用下。打穿蛛网，救出被困的矿工！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 8,
    xpReward: 130,
    goldReward: 65,
    boardId: 'stonetalon'
  },
  {
    id: 'deserts_trolls',
    title: '沙漠巨魔',
    description: '横穿沙海沙漠的商队纷纷消失了——金沙城的贸易港商会调查发现，沙漠巨魔在沙漠商路上布设了致命的陷阱，将劫掠的货物和俘虏都拖进了沙怒废墟。一位逃脱的商队护卫说，巨魔正在筹备一场盛大的血祭。时间不多了！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 12,
    xpReward: 180,
    goldReward: 90,
    boardId: 'deserts'
  },
  {
    id: 'deserts_skeletons',
    title: '沙怒废墟的亡灵',
    description: '沙海的考古学家敲响了警钟——他们从沙怒废墟深处挖出了一块诅咒石板，随后周围巨魔墓穴中的骸骨便活了过来！这些远古亡灵似乎被某种复生魔法唤醒，正朝金沙城方向缓慢移动。破解诅咒需要时间，而你能争取时间——摧毁这些亡灵！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 5,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 12,
    xpReward: 170,
    goldReward: 85,
    boardId: 'deserts'
  },
  {
    id: 'feralas_trolls',
    title: '暗风巨魔',
    description: '月牙要塞的哨兵在幽林深处发现了暗风氏族的踪迹——他们抛弃了与铁血盟约的誓约，转而追随一名自称"血影先知"的叛逆萨满。这些叛逃巨魔在丛林神庙中举行亵渎仪式，威胁着整个幽林的自然平衡。暮精灵需要你清除这股邪恶力量！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 5,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 14,
    xpReward: 200,
    goldReward: 100,
    boardId: 'feralas'
  },
  {
    id: 'feralas_dragons',
    title: '龙的领地',
    description: '幽林的天空不再安全——翠绿龙族的幼龙从梦境中苏醒，幼龙成群地在丛林上空盘旋，向任何胆敢踏入它们领地的生物喷吐毒息。一名半精灵斥候报告说，幼龙正在保护某些古代暮精灵遗迹。击败它们，证明你配得上探索这些秘密！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 2,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 14,
    xpReward: 250,
    goldReward: 125,
    boardId: 'feralas'
  },
  {
    id: 'borean_tundra_trolls',
    title: '冰雪巨魔',
    description: '牦牛村发出了绝望的求援——冰雪巨魔部落趁暴风雪掩护突袭了村庄外围，绑走了数名村民。斥候追踪血迹发现了巨魔的冰窟据点，那里传出诡异的鼓声和颂唱，巨魔萨满似乎在为某种远古邪神举行活祭。趁雪停之前行动，每一秒都关乎人质的生死！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 5,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 18,
    xpReward: 300,
    goldReward: 150,
    boardId: 'borean_tundra'
  },
  {
    id: 'borean_tundra_nerubians',
    title: '虫族入侵',
    description: '北境苔原的冻土下传来了令人毛骨悚然的挖掘声——虫群之王的残余势力——那些虫族战士正在从地底疯狂打通新的隧道网络，企图绕开北伐军的防线直接突袭远征营地。如果这些虫族战士与亡者军团重新合流，寒霜废土的战局将彻底逆转。深入洞穴，在他们钻出地面之前将其镇压！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_nerubian',
        type: 'kill',
        target: 4,
        enemyId: 'nerubian'
      }
    ],
    levelRequirement: 18,
    xpReward: 320,
    goldReward: 160,
    boardId: 'borean_tundra'
  },
  {
    id: 'storm_peaks_dwarves',
    title: '铁矮人的威胁',
    description: '探险者协会的考古队在雷暴山巅挖出了一座被遗忘的铁矮人要塞，随即遭到了主人毫不留情的攻击。这些铁矮人是远古守护者的仆从，正在重建古老的防御工事。更糟的是，他们截获了一封矮人密函，内容暗示铁矮人正在挖掘某件足以改变寒霜废土格局的远古神器。必须阻止他们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dwarf',
        type: 'kill',
        target: 5,
        enemyId: 'iron_dwarf'
      }
    ],
    levelRequirement: 20,
    xpReward: 350,
    goldReward: 175,
    boardId: 'storm_peaks'
  },
  {
    id: 'storm_peaks_elementals',
    title: '元素暴动',
    description: '雷暴山巅的气象学家检测到异常的雷暴活动——这不是普通的暴风雪，而是愤怒的风暴元素在撕裂天空！据观察，这些元素生物正朝远古殿堂废墟方向汇聚，仿佛被某种远古召唤所吸引。探险者协会警告说，若不加以控制，整个雷暴山巅将被闪电之海淹没。平息元素的怒火！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        target: 4,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 20,
    xpReward: 340,
    goldReward: 170,
    boardId: 'storm_peaks'
  },
  {
    id: 'icecrown_demons',
    title: '亡者君主的仆从',
    description: '北伐军的先锋部队在寒冰荒原南部遭遇了意料之外的敌人——大量恶魔术士正在为亡者君主效命，在冰川裂缝深处建造灵魂熔炉！这些恶魔奴役了阵亡勇士的灵魂，将它们锻造成亡者军团的新型武器。必须摧毁灵魂熔炉，解放被囚禁的英雄灵魂！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 6,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 20,
    xpReward: 500,
    goldReward: 250,
    boardId: 'icecrown'
  },
  {
    id: 'icecrown_undead',
    title: '亡者军团的末日',
    description: '决战前夕，北伐军统帅阿瑞斯下令清剿所有外围亡者据点。这些亡灵是亡者君主在寒冰王座之外的最后一层屏障，包括血肉傀儡、瘟疫散布者和亡灵骑士遗弃的随从。铲除这些爪牙，就能为北伐主力扫清进攻道路！凡间世界的命运就在这一战了。',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        target: 5,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 20,
    xpReward: 480,
    goldReward: 240,
    boardId: 'icecrown'
  },
  {
    id: 'darkshore_murlocs',
    title: '蛙人侵扰',
    description: '海风镇的渔民已经连续三天不敢出海了——暗礁海岸潮池中涌入了大批不知从何处迁徙而来的蛙人，它们用珊瑚与沉船残骸搭建了密密麻麻的窝棚，用刺耳的叫声日夜喧嚣。更糟糕的是，它们偷走了渔村的整船鱼获。在蛙人繁殖壮大之前，必须驱散这群讨厌的掠夺者！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_murloc',
        type: 'kill',
        target: 6,
        enemyId: 'murloc'
      }
    ],
    levelRequirement: 2,
    xpReward: 70,
    goldReward: 35,
    boardId: 'darkshore'
  },
  {
    id: 'darkshore_bears',
    title: '狂野之熊',
    description: '暗礁海岸的灰熊变得异常狂躁，连经验丰富的猎人都避之不及。德鲁伊们推测，可能是暮影教会的密教徒在林中投掷了某种刺激野兽发狂的药剂。已有三名伐木工和一名哨兵在遭遇熊袭后重伤，如果你不尽快出手，伤亡名单还会继续增加！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bear',
        type: 'kill',
        target: 4,
        enemyId: 'bear'
      }
    ],
    levelRequirement: 2,
    xpReward: 80,
    goldReward: 40,
    boardId: 'darkshore'
  },
  {
    id: 'darkshore_gnolls',
    title: '豺狼人袭击',
    description: '沿海的瞭望塔在夜间遭到了豺狼人有组织的突袭，守备官怀疑这不是简单的劫掠——袭击者携带了军用级的火油，显然有幕后势力在暗中资助。如果任由豺狼人控制海岸线，暗礁海岸与月歌之都之间的航路将被彻底切断。夺回海岸，粉碎敌人的阴谋！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_gnoll',
        type: 'kill',
        target: 5,
        enemyId: 'gnoll'
      }
    ],
    levelRequirement: 2,
    xpReward: 75,
    goldReward: 38,
    boardId: 'darkshore'
  },
  {
    id: 'bloodmyst_elementals',
    title: '元素暴动',
    description: '红月岛的元素能量突然失控——银辉精灵魔导师推测是坠毁的"圣光飞船残骸"部件泄漏了奥术能量，扰动了此地的元素平衡。愤怒的水元素正掀起巨浪冲击码头，土元素则撕裂了村庄的道路。如果不尽快平息它们的怒火，整个红月岛定居点将被自然灾害夷为平地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 3,
    xpReward: 90,
    goldReward: 45,
    boardId: 'bloodmyst'
  },
  {
    id: 'bloodmyst_demons',
    title: '恶魔踪迹',
    description: '银辉精灵法师在红月岛东部探测到了强烈的魔能波动——这绝非偶然！调查发现一小队恶魔术士在坠毁的飞船残骸旁建立了隐蔽的祭坛，似乎在用飞船核心的能量进行某种召唤仪式。恶魔语铭文暗示他们正在开启传送门。时日无多，必须立刻消灭这些恶魔！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 2,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 3,
    xpReward: 100,
    goldReward: 50,
    boardId: 'bloodmyst'
  },
  {
    id: 'winterspring_elementals',
    title: '寒冰元素',
    description: '冰泉谷的远望镇商人报告——通往暗影裂谷的商路被愤怒的冰霜元素封锁了，它们在暴风雪中以肉眼可见的速度凝聚成形，向任何靠近的生物释放致命的寒冰锥。一位暮精灵学者指出，这些元素的异常暴怒可能与圣山之巅深处某物苏醒有关。身为冒险者，这是你的试炼！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 14,
    xpReward: 200,
    goldReward: 100,
    boardId: 'winterspring'
  },
  {
    id: 'winterspring_demons',
    title: '恶魔威胁',
    description: '冰泉谷的暗影裂谷深处，一小股恶魔术士避开哨兵的眼线潜入了霜脊山脉的洞穴——他们在挖掘古代暮精灵封印，企图放出被囚禁于此的梦魇领主。雪地上的魔能符文肉眼可见，空气中弥漫着硫磺的味道。你必须赶在封印彻底破碎之前阻止他们！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 3,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 14,
    xpReward: 220,
    goldReward: 110,
    boardId: 'winterspring'
  },
  {
    id: 'winterspring_dragons',
    title: '冰蓝幼龙',
    description: '冰蓝龙族的后裔在冰泉谷雪原中出没——这些幼龙虽然尚未掌握成年冰蓝巨龙的奥术之力，却已懂得如何操纵寒冰魔力来保护自己。一名奥法学院法师警告说，如果这些幼龙被放任不管，它们成年后将更加难以对付。勇敢的冒险者，在同辈中证明你的实力！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 2,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 14,
    xpReward: 230,
    goldReward: 115,
    boardId: 'winterspring'
  },
  {
    id: 'hyjal_demons',
    title: '深渊军团残党',
    description: '虽然深渊领主已在世界之树下陨落，但深渊军团的余烬仍在圣山之巅深处阴燃。恶魔残余据守在暗影裂谷的裂缝中，日夜以魔能魔法腐化圣山的根脉。自然议会发出紧急召唤——必须在腐化扩散到世界之树之前，将这些恶魔彻底根除！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 16,
    xpReward: 280,
    goldReward: 140,
    boardId: 'hyjal'
  },
  {
    id: 'hyjal_dragons',
    title: '远古巨龙',
    description: '圣山之巅的上空有远古巨龙的后裔在盘旋——这些时光龙族与赤红幼龙并非邪恶存在，但它们的领地意识极强，已将苍穹之冠脚下的区域视为神圣不可侵犯的禁地。只有与它们战斗并获得认可，你才有资格继续攀登圣山。这是古老的传统，亦是你荣耀之路上的试金石！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 16,
    xpReward: 300,
    goldReward: 150,
    boardId: 'hyjal'
  },
  {
    id: 'felwood_demons',
    title: '恶魔腐化',
    description: '腐林曾是翠绿梦境在人间的倒影，如今却被魔能彻底荼毒。暮精灵哨兵在腐水河沿岸发现了多处恶魔营地，魔能已经渗入土壤，连树木都在滴落恶心的绿色脓液。如果不净化这些恶魔，整个腐林将彻底变成第二片焦黑荒原。勇士，用你的剑刃来替自然复仇！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 12,
    xpReward: 180,
    goldReward: 90,
    boardId: 'felwood'
  },
  {
    id: 'felwood_trolls',
    title: '森林巨魔',
    description: '一群脱离了主流部落的森林巨魔盘踞在腐林的腐败林地中，用魔能浸染过的武器袭击过往行人。他们崇拜恶魔之力，身上满是献祭留下的疤痕。暮精灵哨兵警告说，这群巨魔正在为某个深渊领主收集灵魂——必须在他们完成灵魂配额之前将其一网打尽！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 3,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 12,
    xpReward: 170,
    goldReward: 85,
    boardId: 'felwood'
  },
  {
    id: 'desolace_centaurs',
    title: '半人马冲突',
    description: '荒瘠废土的半人马氏族之间爆发了血腥内斗——玛格拉姆与吉尔吉斯两大部族为争夺幽深洞窟的入口而互相残杀，战火波及到了路过的每一支商队。更令人不安的是，有旅者称在战场上看到了不属于这片土地的深渊触须。深入战场、终结这场疯狂的自相残杀！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_centaur',
        type: 'kill',
        target: 5,
        enemyId: 'centaur'
      }
    ],
    levelRequirement: 10,
    xpReward: 190,
    goldReward: 95,
    boardId: 'desolace'
  },
  {
    id: 'desolace_skeletons',
    title: '亡灵遗迹',
    description: '荒瘠废土的巨角兽坟场出了怪事——埋葬了上百年的巨兽骸骨自行拼合，拖着残缺的骨架在戈壁上行走，惊散了食腐的秃鹫。牛角族的长者说这是大地深处的诅咒被唤醒了，若不及时净化，连那些安眠于土中的先祖也将不得安宁。拿起武器，为灵魂的平静而战！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_skeleton',
        type: 'kill',
        target: 6,
        enemyId: 'skeleton'
      }
    ],
    levelRequirement: 10,
    xpReward: 180,
    goldReward: 90,
    boardId: 'desolace'
  },
  {
    id: 'durotar_boars',
    title: '野猪威胁',
    description: '赤岩谷的农民叫苦不迭——暴怒的野猪成群结队地从试炼谷方向冲进农田，一夜之间拱翻了整片刚刚播种的南瓜田。一名受伤的农夫描述，领头的那只野猪獠牙上还挂着上一个受害者遗落的铠甲碎片。在庄稼被彻底毁掉之前，去把这些畜生赶回荒野！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_boar',
        type: 'kill',
        target: 6,
        enemyId: 'boar'
      }
    ],
    levelRequirement: 1,
    xpReward: 60,
    goldReward: 30,
    boardId: 'durotar'
  },
  {
    id: 'durotar_quilboars',
    title: '猪面人入侵',
    description: '试炼谷的兽人教官面色铁青——猪面人从荆棘岭的荆棘丛中倾巢而出，它们扛着涂满毒液的粗糙长矛，正在焚毁新兵训练营外的哨塔。这是对铁血盟约权威的公然挑衅。酋长传下命令：任何胆敢踏入赤岩谷的敌人都必须被就地正法！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_quilboar',
        type: 'kill',
        target: 4,
        enemyId: 'quilboar'
      }
    ],
    levelRequirement: 1,
    xpReward: 70,
    goldReward: 35,
    boardId: 'durotar'
  },
  {
    id: 'mulgore_wolves',
    title: '狼群威胁',
    description: '石蹄村的放牧人愁眉不展——灰狼群频繁袭击畜栏，已经叼走了六只巨角兽幼崽。追踪狼蹄的猎手说这群狼似乎受到某种血腥味的吸引，正从石牛湖方向不断南下。在狼群咬死更多牲畜之前，拿起你的弓箭与利斧，保护我们的牧群！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_wolf',
        type: 'kill',
        target: 5,
        enemyId: 'wolf'
      }
    ],
    levelRequirement: 1,
    xpReward: 55,
    goldReward: 28,
    boardId: 'mulgore'
  },
  {
    id: 'mulgore_bears',
    title: '熊之领地',
    description: '牛角族的猎人报告——苍风高地的棕熊不再畏惧篝火与号角，它们带着被激怒后的狂暴占据了纳拉其营地南部的重要牧区。一位长者说这是大地之母的警示，但眼下最重要的是恢复草场的安宁。拿上你的武器，将这些过界的野兽驱回它们自己的领地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bear',
        type: 'kill',
        target: 4,
        enemyId: 'bear'
      }
    ],
    levelRequirement: 1,
    xpReward: 65,
    goldReward: 32,
    boardId: 'mulgore'
  },
  {
    id: 'barrens_quilboars',
    title: '猪面人营地',
    description: '十字路的巡逻兵发来急报——猪面人在荒芜平原的荆棘深处用獠牙和泥浆建造了庞大的营地，其规模远超以往。更令人警觉的是，营地外围发现了大量铁矿石和锻造工具，他们正在武装自己。若不摧毁这个营地，整个南荒芜平原的安全都将受到威胁！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_quilboar',
        type: 'kill',
        target: 5,
        enemyId: 'quilboar'
      }
    ],
    levelRequirement: 5,
    xpReward: 90,
    goldReward: 45,
    boardId: 'barrens'
  },
  {
    id: 'barrens_centaurs',
    title: '半人马掠夺',
    description: '贯穿荒芜平原的黄金商路正在淌血——半人马掠夺者从东面的山丘俯冲而下，将满载货物的巨角兽商队截杀于荒野之中，甚至连护卫队的头颅都挂在了路边的枯树上作为警告。商会的悬赏金已经翻了三倍，但这仍不够——需要的是真正的勇士来终结这一切！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_centaur',
        type: 'kill',
        target: 4,
        enemyId: 'centaur'
      }
    ],
    levelRequirement: 5,
    xpReward: 100,
    goldReward: 50,
    boardId: 'barrens'
  },
  {
    id: 'thousand_needles_centaurs',
    title: '尖峰石林的半人马',
    description: '尖峰石林的高地战略位置极其重要，而半人马部落已抢先控制了所有制高点。他们从悬崖上推落滚石与投枪，将任何试图穿越峡谷的队伍阻挡在外。铁血盟约指挥官下令：在敌人彻底封锁此处的交通要道之前，夺回高地控制权！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_centaur',
        type: 'kill',
        target: 5,
        enemyId: 'centaur'
      }
    ],
    levelRequirement: 10,
    xpReward: 160,
    goldReward: 80,
    boardId: 'thousand_needles'
  },
  {
    id: 'thousand_needles_harpies',
    title: '鹰身人巢穴',
    description: '尖峰石林的峡谷之间回荡着刺耳的尖啸——鹰身人在高耸的石柱顶端用枯枝与兽骨搭建了绵延的巢穴群，数量已膨胀到了危险边缘。它们俯冲袭击任何穿过峡谷的人，一位牛角族信使就在前天连人带坐骑被拖上高空、下落不明。清理这些巢穴，让峡谷重归安全！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_harpy',
        type: 'kill',
        target: 4,
        enemyId: 'harpy'
      }
    ],
    levelRequirement: 10,
    xpReward: 150,
    goldReward: 75,
    boardId: 'thousand_needles'
  },
  {
    id: 'silithus_silithids',
    title: '异种虫入侵',
    description: '虫巢荒漠的自然议会在绝望中向所有冒险者发出求援——荒漠虫族的异种虫群正以前所未有的速度从虫巢废墟之门向外扩散，虫巢的触角已延伸至勇士之墓以南。每耽误一天，就有更多土地被虫族粘液覆盖而寸草不生。拔出剑刃，深入沙漠腹地，与虫群决一死战！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_silithid',
        type: 'kill',
        target: 4,
        enemyId: 'silithid'
      }
    ],
    levelRequirement: 18,
    xpReward: 260,
    goldReward: 130,
    boardId: 'silithus'
  },
  {
    id: 'silithus_demons',
    title: '其拉的秘密',
    description: '虫巢荒漠南部虫巢深处，恶魔术士与异种虫正在进行邪恶的交易。恶魔以荒漠虫族的虫卵为媒介，培育新型的魔能变异体。这解释了为何最近异种虫变得如此疯狂好斗。必须在第一批魔能虫族孵化前摧毁这个邪恶联盟！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 3,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 18,
    xpReward: 280,
    goldReward: 140,
    boardId: 'silithus'
  },
  {
    id: 'western_plaguelands_undead',
    title: '死灵学院的亡灵',
    description: '亡语废墟上空的腐鸦遮蔽了日光——死灵学院的亡灵学徒正在向外扩散黑暗魔法，被复生的尸骸漫无目的地朝四风农场方向行进。恐惧的农夫们已经将家人送进地窖躲藏，但食物撑不了多久。破晓骑士团需要你在亡灵潮淹没农场之前挡住这波进攻！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        target: 6,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 12,
    xpReward: 220,
    goldReward: 110,
    boardId: 'western_plaguelands'
  },
  {
    id: 'western_plaguelands_ghouls',
    title: '食尸鬼潮',
    description: '西腐地的守夜人几乎崩溃——亡语废墟乱葬坑的土壤在午夜翻涌不止，成群的食尸鬼从潮湿的泥土中爬出，聚集成了一支小型军队。有人听到它们在咀嚼声中反复低语着"肉"字。若这支食尸鬼群进入有人居住的区域，后果将不可挽回。前去埋葬这些邪恶之物！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_ghoul',
        type: 'kill',
        target: 5,
        enemyId: 'ghoul'
      }
    ],
    levelRequirement: 12,
    xpReward: 210,
    goldReward: 105,
    boardId: 'western_plaguelands'
  },
  {
    id: 'loch_modan_kobolds',
    title: '狗头人矿洞',
    description: '镜湖谷的矿工用浸血的头盔发出了警告——狗头人占据了瑟根石矿洞的深处，用偷来的蜡烛照亮了整条矿道。更糟的是，它们在矿洞内部发现了储量丰富的金矿脉，正疯狂地用简陋工具开采。矮人矿工联合会已悬赏重金，要求夺回矿脉，并在狗头人挖塌矿道之前将它们清出去！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_kobold',
        type: 'kill',
        target: 6,
        enemyId: 'kobold'
      }
    ],
    levelRequirement: 3,
    xpReward: 80,
    goldReward: 40,
    boardId: 'loch_modan'
  },
  {
    id: 'loch_modan_spiders',
    title: '洞穴蜘蛛',
    description: '镜湖谷的洞穴深处传来了微弱的求救——一群巨型蜘蛛在矿工休息区的天花板上编织了厚重的蛛网，将三名矮人矿工裹成了蚕茧。营救队需要先打通被蛛网封锁的通道，而蜘蛛的数量仍在不断增加。争分夺秒，这些矮人的生命经不起太多等待！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 3,
    xpReward: 90,
    goldReward: 45,
    boardId: 'loch_modan'
  },
  {
    id: 'wetlands_murlocs',
    title: '沼泽蛙人',
    description: '沼泽湿地的渔民已经放弃了祖尔法河沿岸的渔场——不计其数的蛙人从沼泽深水区涌出，用淤泥和垃圾筑起了刺鼻的族群巢穴。更可怕的是，它们猎杀一切，连河中的鳄鱼都躲进了深水区。龙吼要塞巡逻队担心，蛙人一旦阻断水路交通，整个沼泽湿地的贸易都将瘫痪！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_murloc',
        type: 'kill',
        target: 6,
        enemyId: 'murloc'
      }
    ],
    levelRequirement: 6,
    xpReward: 110,
    goldReward: 55,
    boardId: 'wetlands'
  },
  {
    id: 'wetlands_trolls',
    title: '沼泽巨魔',
    description: '龙吼要塞的矮人守卫报告——沼泽湿地深处的沼泽巨魔正在挖掘某种远古遗迹，日夜不休的诵唱从西岸传来。考古学者推测它们可能在寻找远古遗物，一旦落入巨魔手中后果不堪设想。在它们挖穿遗迹之前，将这些危险的挖掘者赶出沼泽湿地！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 3,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 6,
    xpReward: 130,
    goldReward: 65,
    boardId: 'wetlands'
  },
  {
    id: 'arathi_orcs',
    title: '铁刃高地兽人',
    description: '古王要塞废墟中传来了战争的鼓声——碎岩氏族的兽人在铁刃高地上建立了新的前哨站，并且正在集结兵力。侦察兵回报说他们已经修复了部分旧城墙，以此为据点向四面八方派出劫掠小队。光辉盟约高层已将此视为直接威胁，必须在兽人站稳脚跟之前将其连根拔起！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 10,
    xpReward: 170,
    goldReward: 85,
    boardId: 'arathi'
  },
  {
    id: 'arathi_trolls',
    title: '巨魔遗迹',
    description: '铁刃高地的古老巨魔遗迹并非死物——古王要塞守卫在巡逻时发现，遗迹中的巨魔雕像在夜间发出了幽绿的光芒，随后便有活的巨魔从地下墓穴中走出。奥术师检测到强大的巫毒能量正在复活沉睡者。在封印被彻底打破之前，摧毁这些复生的巨魔守陵者！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 10,
    xpReward: 180,
    goldReward: 90,
    boardId: 'arathi'
  },
  {
    id: 'hillsbrad_orcs',
    title: '兽人斥候',
    description: '铁血盟约的密探渗透进了翠绿丘陵——这些兽人斥候伪装成流亡者，在丘陵各处的制高点绘制地形图并标记防御薄弱点。一名被俘的斥候在审讯中透露，铁血盟约正在为一次大规模越境行动做准备。找出剩余的斥候，阻止情报继续外泄！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 4,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 6,
    xpReward: 120,
    goldReward: 60,
    boardId: 'hillsbrad'
  },
  {
    id: 'hillsbrad_bandits',
    title: '丘陵强盗',
    description: '翠绿丘陵的农场主们已经组织了民兵团，但仍挡不住这群有组织的强盗——他们熟悉每一处山丘与林间小道，利用地形打了就跑，连辉石城派来的巡逻队都屡次扑空。更令人气愤的是，最新报告显示强盗正在将抢来的物资通过南港镇码头走私出境。必须截断这条犯罪链条！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bandit',
        type: 'kill',
        target: 5,
        enemyId: 'bandit'
      }
    ],
    levelRequirement: 6,
    xpReward: 130,
    goldReward: 65,
    boardId: 'hillsbrad'
  },
  {
    id: 'deadwind_demons',
    title: '观星之塔的恶魔',
    description: '迷踪谷的空气中弥漫着硫磺的味道——观星之塔散发的魔法能量吸引了一批恶魔术士，他们在塔外的废墟中疯狂汲取泄漏的奥术与魔能。如果这些恶魔被观星之塔的力量喂饱，离开迷踪谷后将在王国腹地造成毁灭性打击。必须现在就动手！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 16,
    xpReward: 250,
    goldReward: 125,
    boardId: 'deadwind'
  },
  {
    id: 'deadwind_undead',
    title: '徘徊的亡灵',
    description: '迷踪谷的旅店老板已经关门谢客——每到深夜，观星之塔地窖中便会走出扭曲的亡魂，它们保持着生前最后的姿态：提灯的仆人、持剑的守卫、怀抱婴儿的妇人。驱魔人警告说，这些怨灵正在寻找活人作伴，意图将生者拖入它们的永恒诅咒。让这些不幸的灵魂得到真正的安息！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        target: 5,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 16,
    xpReward: 240,
    goldReward: 120,
    boardId: 'deadwind'
  },
  {
    id: 'burning_steppes_orcs',
    title: '黑崖兽人',
    description: '熔火平原上黑烟滚滚——黑崖兽人从黑岩之塔中倾巢而出，正沿平原向东推进，意图打通与碎石荒野的陆上通道。熔炉兄弟会的矮人斥候看见他们在火山灰中堆放攻城器械的部件。如果让黑崖兽人与碎石荒野的龙吼氏族汇合，光辉盟约将面临两线作战的困境。先发制人！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 5,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 15,
    xpReward: 260,
    goldReward: 130,
    boardId: 'burning_steppes'
  },
  {
    id: 'burning_steppes_dragons',
    title: '赤红幼龙',
    description: '赤红龙族的后裔在熔火平原上空盘旋——这些幼龙被黑岩之塔的黑暗能量所吸引，在火山口附近筑巢啜饮滚烫的岩浆。矮人猎人警告说，受暗黑龙族影响的幼龙正在变得嗜血，如果不加干预，它们成年后将加入灭世之龙麾下。在它们被彻底腐化之前，斩断这黑暗的羁绊！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 15,
    xpReward: 280,
    goldReward: 140,
    boardId: 'burning_steppes'
  },
  {
    id: 'searing_gorge_elementals',
    title: '火焰元素',
    description: '熔炉兄弟会的铁匠敲响了警钟——炎灼峡谷的火山口正在喷涌出前所未有的火焰元素，它们将熔岩带上地表，烧毁了数座矿场和铁匠铺。更糟的是，铁炉矮人似乎在利用这些元素作为炼铁的免费热源，无意中加速了元素的增殖。平息火海，一人一剑！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 12,
    xpReward: 220,
    goldReward: 110,
    boardId: 'searing_gorge'
  },
  {
    id: 'searing_gorge_spiders',
    title: '熔岩蜘蛛',
    description: '炎灼峡谷的高温催生了特殊的生命——熔岩蜘蛛在滚烫的岩石裂缝间织出了耐火的金属色蛛网，它们的毒液竟然能将岩石溶解成泥浆。矿工们说这些蜘蛛已占据了连接南北矿道的主通道，没人敢进去开工了。清理这些火焰之地的八脚怪物，让矿镐重新响起！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 4,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 12,
    xpReward: 210,
    goldReward: 105,
    boardId: 'searing_gorge'
  },
  {
    id: 'badlands_elementals',
    title: '土元素',
    description: '碎石荒野的地面在震颤——先祖殿堂废墟中涌出了苏醒的土元素，它们受远古守护者残余指令驱动，将一切踏入碎石荒野的活物视为入侵者。矮人考古队已经损失了三台挖掘机和多名助手。在元素关闭所有通往先祖殿堂的道路之前，击碎这些无情的石巨人！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 10,
    xpReward: 200,
    goldReward: 100,
    boardId: 'badlands'
  },
  {
    id: 'badlands_ogres',
    title: '食人魔营地',
    description: '探险者协会的考古学家紧急撤退——他们挖掘的遗迹被一群食人魔占领了，这些头脑简单但力量恐怖的双头怪物将帐篷压垮、将文物当作石锤来用。营地周围散落着被折断的鹤嘴锄和被啃过的矮人盾牌。夺回营地，保护珍贵的考古发现！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_ogre',
        type: 'kill',
        target: 3,
        enemyId: 'ogre'
      }
    ],
    levelRequirement: 10,
    xpReward: 210,
    goldReward: 105,
    boardId: 'badlands'
  },
  {
    id: 'swamp_of_sorrows_murlocs',
    title: '沼泽蛙人',
    description: '哀伤沼泽的水域正变得危机四伏——蛙人部落从焦黑荒原方向顺流而下，在沼泽浅滩建立了密密麻麻的巢穴群，水中到处散发着鱼腥与腐臭。沼泽哨站的斥候报告说，蛙人甚至开始袭击补给船队了，一条满载军粮的驳船昨天刚刚沉入沼泽。为了铁血盟约补给线的安全，清理沼泽！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_murloc',
        type: 'kill',
        target: 6,
        enemyId: 'murloc'
      }
    ],
    levelRequirement: 8,
    xpReward: 140,
    goldReward: 70,
    boardId: 'swamp_of_sorrows'
  },
  {
    id: 'swamp_of_sorrows_trolls',
    title: '神庙巨魔',
    description: '失落神庙的阴影中蛰伏着古老的力量——劈颅巨魔部落自古便是这座血腥神庙的守卫者，如今他们再次从密林深处现身，手持祭祀用的骨质武器攻击每位闯入者。考古探险队已被困在神庙外整整一周。在巨魔唤醒沉睡的夺魂者之前，闯入神庙、清除守卫！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 8,
    xpReward: 160,
    goldReward: 80,
    boardId: 'swamp_of_sorrows'
  },
  {
    id: 'blasted_lands_demons',
    title: '世界之门的恶魔',
    description: '世界之门附近的空间裂隙被撕开了——深渊军团的恶魔术士正试图从门的两侧同时施展召唤法术，意图重新打通破碎虚空与凡间之间的通道，让军团援军穿过世界之门。守备官们日夜监视着魔能读数，数字正在疯狂攀升。分秒必争，必须在通道形成之前消灭这些恶魔！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_demon',
        type: 'kill',
        target: 4,
        enemyId: 'demon'
      }
    ],
    levelRequirement: 18,
    xpReward: 300,
    goldReward: 150,
    boardId: 'blasted_lands'
  },
  {
    id: 'blasted_lands_dragons',
    title: '暗黑幼龙',
    description: '焦黑荒原的火山裂隙中孵化了数窝暗黑龙蛋——这些幼崽继承了灭世之龙的狂怒与力量，它们从裂口中汲取地心熔岩的能量，飞快地变得强大。时光龙族特使警告说，如果任其成长，这些暗黑幼龙将在数周内长成足以威胁远古龙族的成年体。时间紧迫，斩草除根！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 18,
    xpReward: 320,
    goldReward: 160,
    boardId: 'blasted_lands'
  },
  {
    id: 'hinterlands_trolls',
    title: '崖顶城巨魔',
    description: '丘陵高地的高山台地上矗立着一座巨魔之城——崖顶城，暗枝部族在此盘踞了数百年，如今他们从高墙后不断派出猎头者，将低地上的矮人农场当作狩猎场。鹰巢矮人已在高空看见了烽火信号——若不攻下这座邪恶城塞，丘陵高地永无宁日！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 5,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 12,
    xpReward: 200,
    goldReward: 100,
    boardId: 'hinterlands'
  },
  {
    id: 'hinterlands_wolves',
    title: '巨狼威胁',
    description: '丘陵高地的矮人猎人已经放弃了在鹰巢山以南的所有陷阱线——巨狼的数量在过去一个月里激增了三倍，它们以猛犸为食并变得体型惊人。鹰巢狮鹫骑士从空中看到，狼群正朝祖尔祭坛方向迁移，那里有尚未被发现的古代宝藏。清除狼群，为探险者打开通路！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_wolf',
        type: 'kill',
        target: 6,
        enemyId: 'wolf'
      }
    ],
    levelRequirement: 12,
    xpReward: 190,
    goldReward: 95,
    boardId: 'hinterlands'
  },
  {
    id: 'zuldrak_vrykul',
    title: '北境蛮族战士',
    description: '北境蛮族远征队占领了亡谷的北部古道——这些来自咆哮湾方向的北境蛮族战士在冰阶上建立了临时兵营，正源源不断地接收来自北境要塞的物资补给。冰霜巨魔已自顾不暇，无法抵挡第二股入侵势力。在北境蛮族完成集结之前，截断他们的补给线，让他们知难而退！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_vrykul',
        type: 'kill',
        target: 5,
        enemyId: 'vrykul'
      }
    ],
    levelRequirement: 18,
    xpReward: 260,
    goldReward: 130,
    boardId: 'zuldrak'
  },
  {
    id: 'zuldrak_undead',
    title: '亡灵灾祸',
    description: '亡谷的冰霜巨魔陷入绝望——亡者军团正在从西面的水晶森林方向涌入，亡灵大军所过之处连巨魔的石像守卫都被碾成了碎屑。冰霜巨魔引以为傲的献祭魔法对亡灵不起作用，亡谷的防线正在崩溃。帮助冰霜巨魔挡住这一波亡灵入侵，否则接下来的就是整个寒霜废土！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        target: 6,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 18,
    xpReward: 270,
    goldReward: 135,
    boardId: 'zuldrak'
  },
  {
    id: 'howling_fjord_vrykul',
    title: '北境蛮族战士',
    description: '北境要塞的号角声震撼了整个咆哮湾——北境蛮族战士从这座远古堡垒中鱼贯而出，他们骑着始祖龙从空中侦察，用巨斧劈开一切踏足峡湾的凡人。先锋军认为这些北境蛮族正在为亡者君主招募新兵，任何被俘者都将被转化成亡者。攻入要塞外围，削弱北境蛮族的兵力！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_vrykul',
        type: 'kill',
        target: 5,
        enemyId: 'vrykul'
      }
    ],
    levelRequirement: 16,
    xpReward: 230,
    goldReward: 115,
    boardId: 'howling_fjord'
  },
  {
    id: 'howling_fjord_trolls',
    title: '冰巨魔',
    description: '咆哮湾的冰窟中传来了神秘的鼓点——冰巨魔部落趁着峡湾的漫天大雾从冰柱森林中涌出，掠走了数名先锋军的工兵。远征军情报显示，这些巨魔被亡者君主许诺永生而成了亡者帮凶，他们在冰窟深处建造献祭平台。咬紧牙关，趁大雾未散发起突袭！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_troll',
        type: 'kill',
        target: 4,
        enemyId: 'troll'
      }
    ],
    levelRequirement: 16,
    xpReward: 240,
    goldReward: 120,
    boardId: 'howling_fjord'
  },
  {
    id: 'dragonblight_dragons',
    title: '龙息神殿',
    description: '龙息神殿的远古巨龙发出了愤怒的咆哮——在暗黑巨龙的暗中操控下，数窝冰蓝幼龙发狂并开始攻击龙息神殿的低层守卫。赤红龙族的特使希望冒险者出手制止这些幼龙，因为它们本身并非邪恶，只是被黑曜石魔法控制。用战斗打醒它们，而不是杀戮！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 18,
    xpReward: 300,
    goldReward: 150,
    boardId: 'dragonblight'
  },
  {
    id: 'dragonblight_undead',
    title: '亡者入侵',
    description: '龙骸荒原的巨龙墓地正在遭受前所未有的亵渎——亡者军团在龙息神殿南面挖掘龙骨、用黑暗魔法将死去的巨龙复活为骸骨巨兽。每多挖出一具龙骨，亡者就多一样终极兵器。赤红龙族恳求所有盟军集结墓地、粉碎这些窃取巨龙遗骸的亡灵盗贼！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_undead',
        type: 'kill',
        target: 6,
        enemyId: 'undead'
      }
    ],
    levelRequirement: 18,
    xpReward: 290,
    goldReward: 145,
    boardId: 'dragonblight'
  },
  {
    id: 'grizzly_hills_bears',
    title: '灰熊之王',
    description: '熊岭的伐木营地被血洗了——一头体型比房屋还大的灰熊在营地中横冲直撞，将原木堆踢翻、将工具棚连根拔起。猎人们追踪血迹发现，这头巨熊的洞穴位于山脉深处，沿途有至少四只成年灰熊在巡逻守护。在为更多伐木工人送葬之前，结束这灰熊之王的统治！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_bear',
        type: 'kill',
        target: 5,
        enemyId: 'bear'
      }
    ],
    levelRequirement: 16,
    xpReward: 240,
    goldReward: 120,
    boardId: 'grizzly_hills'
  },
  {
    id: 'grizzly_hills_orcs',
    title: '兽人斥候',
    description: '熊岭的平静山林中藏匿着不速之客——亡者之城的亡者斥候发现铁血盟约的兽人先遣队正在丘陵中秘密修建前哨营地，他们隐藏在松树林间，距离光辉盟约伐木站仅有半天路程。一旦前哨建成，战争的火种就会在这片宁静土地上点燃。在铁血盟约站稳脚跟之前，摧毁这些斥候！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_orc',
        type: 'kill',
        target: 4,
        enemyId: 'orc'
      }
    ],
    levelRequirement: 16,
    xpReward: 250,
    goldReward: 125,
    boardId: 'grizzly_hills'
  },
  {
    id: 'sholazar_tigers',
    title: '丛林猛虎',
    description: '翡翠盆地的远征狩猎队在扎营第一天就遭遇了惨剧——一对剑齿猛虎在夜色中潜入了营地中心，将两位经验丰富的追踪者重伤。老猎人们说这是对过往过度狩猎的报复，但眼下更重要的是确保其他猎人的安全。追踪虎迹、驱散这群翡翠盆地的顶尖掠食者！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_tiger',
        type: 'kill',
        target: 4,
        enemyId: 'tiger'
      }
    ],
    levelRequirement: 18,
    xpReward: 260,
    goldReward: 130,
    boardId: 'sholazar'
  },
  {
    id: 'sholazar_spiders',
    title: '巨型蜘蛛',
    description: '翡翠盆地丛林的生态平衡正在被打破——来自地下虫巢的巨型蜘蛛在雨林树冠层间筑起巨网，阳光被层层叠叠的蛛丝遮蔽，林下植物开始枯萎。芙蕾雅的仆从认为这是亡者军团暗中投下的腐化种子在发芽。在整片丛林被蛛网窒息之前，撕开这些天空中的陷阱！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_spider',
        type: 'kill',
        target: 5,
        enemyId: 'spider'
      }
    ],
    levelRequirement: 18,
    xpReward: 250,
    goldReward: 125,
    boardId: 'sholazar'
  },
  {
    id: 'crystal_song_elementals',
    title: '水晶元素',
    description: '水晶森林的水晶在悲鸣——被亡者魔法扭曲的元素生物从水晶森林的地底苏醒，它们浑身闪烁着不自然的紫黑色光芒，将途经的法师和冒险者都冻成了冰雕。奥法学院的法师议会发出命令：这些腐化元素若不被净化，水晶森林将变成比寒冰荒原更危险的地狱！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_elemental',
        type: 'kill',
        target: 5,
        enemyId: 'elemental'
      }
    ],
    levelRequirement: 20,
    xpReward: 300,
    goldReward: 150,
    boardId: 'crystal_song'
  },
  {
    id: 'crystal_song_dragons',
    title: '冰蓝龙族',
    description: '冰蓝龙族将水晶森林视为禁地——冰蓝巨龙之王之子在树梢水晶上空盘旋巡逻，喷吐奥术吐息攻击任何胆敢深入森林的探险者。奥法学院的法师们急需采集水晶样本以完成一项对抗亡者君主的关键实验，但冰蓝巨龙将每块水晶都视若己物。击败这些守护者，将水晶带回奥法学院！',
    type: 'kill',
    objectives: [
      {
        key: 'kill_dragon',
        type: 'kill',
        target: 3,
        enemyId: 'dragon_whelp'
      }
    ],
    levelRequirement: 20,
    xpReward: 320,
    goldReward: 160,
    boardId: 'crystal_song'
  }
];
