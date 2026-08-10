/**
 * @fileoverview 游戏主界面业务 Composable（P3-163 拆分自 GameMain.vue）
 * @description 封装游戏主界面的面板管理、探索回调、战斗触发、升级动画等业务逻辑。
 * @module composables
 */
import { ref, reactive, computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { useShopStore } from '@/modules/shop';
import { useExplorationStore, type MultiOptionEventResult } from '@/modules/exploration';
import { gameBootstrap } from '@/services/GameBootstrap';
import { eventBus, GameEvents } from '@/modules/bus';
import { useEnemyStore } from '@/modules/enemy';
import { useCombatStore } from '@/modules/combat';
import { ResourceSystemFactory } from '@/modules/combat/resources';
import { useToast } from '@/composables/useToast';
import type { CombatResult } from '@/modules/combat';

export function useGameActions(onExit: () => void) {
  const characterStore = useCharacterStore();
  const mapStore = useMapStore();
  const shopStore = useShopStore();
  const toast = useToast();

  const currentContentTab = ref('map');
  const loading = ref(true);
  const showCharacterInfo = ref(false);
  const showInventory = ref(false);
  const showSkills = ref(false);
  const showTalents = ref(false);
  const showQuests = ref(false);
  const showAdventureLog = ref(false);
  const showShop = ref(false);
  const showQuestBoard = ref(false);
  const showCombat = ref(false);
  const showAudioSettings = ref(false);
  const showSystem = ref(false);
  const popupMounted = reactive({
    characterInfo: false, inventory: false, skills: false, talents: false,
    quests: false, adventureLog: false, shop: false, questBoard: false,
    audioSettings: false, system: false,
  });
  const levelUpTriggered = ref(false);
  let levelUpTimerId: ReturnType<typeof setTimeout> | null = null;

  const character = computed(() => characterStore.character || { name: '...', level: 1 });
  const currentHp = computed(() => characterStore.hp);
  const maxHp = computed(() => characterStore.maxHp);
  const currentMp = computed(() => characterStore.mana);
  const maxMp = computed(() => characterStore.maxMana);
  const hpPercent = computed(() => characterStore.hpPercentage);
  const mpPercent = computed(() => characterStore.manaPercentage);
  const showManaBar = computed(() => !ResourceSystemFactory.replacesMana(characterStore.classId));
  const classResourceSystems = computed(() => ResourceSystemFactory.getManaReplacingSystems(characterStore.classId));
  const exp = computed(() => characterStore.exp);
  const expToNext = computed(() => characterStore.expToNextLevel);
  const expPercent = computed(() => characterStore.expPercentage);
  const gold = computed(() => characterStore.gold);
  const currentArea = computed(() => mapStore.getCurrentLocation?.name || '未知区域');
  const hasCurrentLocation = computed(() => !!mapStore.getCurrentLocation);
  const raceIcon = computed(() => characterStore.raceIcon);

  function showNotif(message: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info') {
    toast.show({ message, type });
  }

  function handleExit() { onExit(); }

  function onClickPanel(name: string) {
    eventBus.emit(GameEvents.UI_CLICK, { source: `nav_${name}` });
    onPanelOpen(name);
  }
  function onPanelOpen(name: string) {
    eventBus.emit(GameEvents.UI_PANEL_OPENED, { panel: name });
  }
  function onPanelClose(name: string) {
    eventBus.emit(GameEvents.UI_PANEL_CLOSED, { panel: name });
  }

  function openAudioFromSystem() {
    popupMounted.audioSettings = true;
    showAudioSettings.value = true;
    onPanelOpen('audio_settings');
  }

  function handleMapTabClick() {
    currentContentTab.value = 'map';
    eventBus.emit(GameEvents.UI_CLICK, { source: 'tab_map' });
    mapStore.saveCurrentTab('map');
  }

  function handleExploreTabClick() {
    if (!hasCurrentLocation.value) {
      showNotif('请先在地图上选择一个区域', 'info');
      return;
    }
    currentContentTab.value = 'explore';
    eventBus.emit(GameEvents.UI_CLICK, { source: 'tab_explore' });
    mapStore.saveCurrentTab('explore');
  }

  async function handleCellExplored(data: { cellType?: string; interactionId?: string }) {
    const cellType = data?.cellType;
    if (cellType === 'shop') {
      const shopId = data?.interactionId || '';
      if (!shopId) { console.warn('[GameMain] 商店交互ID为空，无法打开商店'); return; }
      await shopStore.openShop(shopId);
      popupMounted.shop = true;
      showShop.value = true;
      onPanelOpen('shop');
    } else if (cellType === 'board') {
      popupMounted.questBoard = true;
      showQuestBoard.value = true;
      onPanelOpen('quest_board');
    }
  }

  async function handleBattleTriggered(data: { eventData: { monsterId: string; areaLevel: number } }) {
    const { monsterId, areaLevel } = data.eventData;
    const enemy = await useEnemyStore().createEnemy(monsterId, areaLevel);
    if (enemy) {
      await useCombatStore().startCombat([enemy]);
      showCombat.value = true;
    }
  }

  function handleItemFound(data: { itemId: string; count: number; itemName: string }) {
    showNotif(`发现物品: ${data.itemName} x${data.count}`, 'success');
  }
  function handleTrapTriggered(data: { damage: number; trapType: string }) {
    showNotif(`触发${data.trapType}，受到 ${data.damage} 点伤害`, 'danger');
  }
  function handleRandomEvent(data: { message: string; icon: string }) {
    showNotif(data.message, 'info');
  }
  function handleMultiOptionEvent(data: MultiOptionEventResult) {
    showNotif(data.message, 'info');
    const explorationStore = useExplorationStore();
    if (data.choices.length > 0) {
      explorationStore.applyEventChoice(data.choices[0]);
    }
  }

  function handleCombatClose(_result?: CombatResult) {
    showCombat.value = false;
    onPanelClose('combat');
  }
  async function handleShopClose() {
    showShop.value = false;
    onPanelClose('shop');
    await shopStore.closeShop();
  }

  function onLevelUp(): void {
    levelUpTriggered.value = true;
    showNotif('升级了！', 'success');
    if (levelUpTimerId !== null) clearTimeout(levelUpTimerId);
    levelUpTimerId = setTimeout(() => {
      levelUpTimerId = null;
      levelUpTriggered.value = false;
    }, 1500);
  }

  async function init() {
    // P4-025 修复：包裹 try/catch 防止初始化失败导致 loading 卡死
    try {
      const explorationStore = useExplorationStore();
      explorationStore.registerUICallbacks({
        onCellExplored: handleCellExplored,
        onBattleTriggered: handleBattleTriggered,
        onItemFound: handleItemFound,
        onTrapTriggered: handleTrapTriggered,
        onRandomEvent: handleRandomEvent,
        onMultiOptionEvent: handleMultiOptionEvent
      });
      const cid = characterStore.currentCharacterId;
      if (cid) {
        await gameBootstrap.initialize(cid);
        const savedTab = await mapStore.getCurrentTab();
        if (savedTab === 'explore' && hasCurrentLocation.value) {
          currentContentTab.value = 'explore';
        }
      }
      eventBus.on(GameEvents.CHARACTER_LEVEL_UP, onLevelUp);
    } catch (err) {
      console.error('[GameMain] 初始化失败:', err);
      showNotif('游戏初始化失败，请重试', 'danger');
    } finally {
      loading.value = false;
    }
  }

  function cleanup() {
    eventBus.off(GameEvents.CHARACTER_LEVEL_UP, onLevelUp);
    if (levelUpTimerId !== null) { clearTimeout(levelUpTimerId); levelUpTimerId = null; }
    gameBootstrap.dispose();
  }

  return {
    // 状态
    currentContentTab, loading,
    showCharacterInfo, showInventory, showSkills, showTalents, showQuests,
    showAdventureLog, showShop, showQuestBoard, showCombat, showAudioSettings, showSystem,
    popupMounted, levelUpTriggered,
    // 计算属性
    character, currentHp, maxHp, currentMp, maxMp, hpPercent, mpPercent,
    showManaBar, classResourceSystems, exp, expToNext, expPercent, gold,
    currentArea, hasCurrentLocation, raceIcon,
    // Actions
    showNotif, handleExit, onClickPanel, onPanelOpen, onPanelClose,
    openAudioFromSystem, handleMapTabClick, handleExploreTabClick,
    handleCombatClose, handleShopClose,
    // 生命周期
    init, cleanup,
  };
}
