/**
 * @fileoverview 角色创建业务 Composable（P3-163 拆分自 CharacterCreate.vue）
 * @description 封装角色创建流程的状态管理和业务逻辑，包括分步选择、属性预览、名称校验和创建执行。
 * @module composables
 */
import { ref, computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { eventBus, GameEvents } from '@/modules/bus';
import type { FactionType, RaceType, ClassType } from '@/modules/character';
import { STAT_NAMES } from '@/config/character';
import {
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateMaxHp,
  calculateMaxMana
} from '@/utils/calculations';

export function useCharacterCreation(onCreated: () => void) {
  const characterStore = useCharacterStore();
  const baseStore = useBaseStore();

  const currentStep = ref(1);
  const name = ref('');
  const selectedFaction = ref<FactionType | null>(null);
  const selectedRace = ref<RaceType | null>(null);
  const selectedClass = ref<ClassType | null>(null);

  const showModal = ref(false);
  const modalType = ref<'error' | 'confirm'>('error');
  const modalIcon = ref<{ name: string; gradient: string }>({ name: '', gradient: '' });
  const modalTitle = ref('');
  const modalMessage = ref('');
  const modalConfirmText = ref('');

  const currentStepTitle = computed(() => {
    switch (currentStep.value) {
      case 1: return '请选择阵营';
      case 2: return `请选择种族 (${baseStore.getFactionName(selectedFaction.value || '')})`;
      case 3: return '请选择职业';
      case 4: return '请输入角色名';
      default: return '';
    }
  });

  const displayFactions = computed(() => baseStore.factions.filter((f) => f.id !== 'neutral'));
  const neutralFaction = computed(() => baseStore.factions.find((f) => f.id === 'neutral'));

  const availableRaces = computed(() => {
    if (!selectedFaction.value) return [];
    return baseStore.races.filter((r) => r.factionId === selectedFaction.value);
  });

  const availableClasses = computed(() => {
    const raceId = selectedRace.value;
    const factionId = selectedFaction.value;
    if (!raceId || !factionId) return [];
    return baseStore.classes.filter(
      (c) => c.raceIds.includes(raceId) && c.factionsIds.includes(factionId)
    );
  });

  const currentAttributes = computed(() => {
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    if (selectedRace.value) {
      const raceData = baseStore.races.find((r) => r.id === selectedRace.value);
      if (raceData?.bonus) {
        for (const [stat, value] of Object.entries(raceData.bonus)) {
          if (stat in base) base[stat as keyof typeof base] += value;
        }
      }
    }
    if (selectedClass.value) {
      const classData = baseStore.classes.find((c) => c.id === selectedClass.value);
      if (classData?.bonus) {
        for (const [stat, value] of Object.entries(classData.bonus)) {
          if (stat in base) base[stat as keyof typeof base] += value;
        }
      }
    }
    return base;
  });

  const derivedAttributes = computed(() => {
    const classData = baseStore.classes.find((c) => c.id === selectedClass.value);
    const primaryStat = classData?.primaryStat ?? 'dex';
    return {
      physicalAttack: calculatePhysicalAttack(currentAttributes.value),
      physicalDefense: calculatePhysicalDefense(currentAttributes.value),
      magicAttack: calculateMagicAttack(currentAttributes.value),
      magicDefense: calculateMagicDefense(currentAttributes.value),
      critChance: calculateCritChance(currentAttributes.value, primaryStat),
      dodgeChance: calculateDodgeChance(currentAttributes.value),
      maxHp: calculateMaxHp(currentAttributes.value),
      maxMana: calculateMaxMana(currentAttributes.value)
    };
  });

  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1: return selectedFaction.value !== null;
      case 2: return selectedRace.value !== null;
      case 3: return selectedClass.value !== null;
      default: return true;
    }
  });

  const canCreate = computed(() => {
    return name.value.trim().length > 0 && selectedFaction.value && selectedRace.value && selectedClass.value;
  });

  async function loadData() {
    await baseStore.loadAllData();
  }

  function selectFaction(id: FactionType) {
    selectedFaction.value = id;
    selectedRace.value = null;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'select_faction' });
  }

  function selectRace(id: RaceType) {
    selectedRace.value = id;
    // P7-028 修复：切换种族时清除非法职业选择，新种族可能无法使用原职业
    selectedClass.value = null;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'select_race' });
  }

  function selectClass(id: ClassType) {
    selectedClass.value = id;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'select_class' });
  }

  function getFactionRaceNames(factionId: string) {
    return baseStore.races.filter((r) => r.factionId === factionId).map((r) => r.name).join(' · ');
  }

  function getStatName(stat: string) {
    return STAT_NAMES[stat as keyof typeof STAT_NAMES] || stat;
  }

  function getStatIcon(stat: string): { name: string; gradient: string } {
    const icons: Record<string, { name: string; gradient: string }> = {
      str: { name: 'biceps', gradient: 'physical' },
      dex: { name: 'boot-kick', gradient: 'lightning' },
      con: { name: 'heart-organ', gradient: 'blood' },
      int: { name: 'brain', gradient: 'magic' },
      wis: { name: 'eye-target', gradient: 'nature' },
      cha: { name: 'charm', gradient: 'gold' }
    };
    return icons[stat] || { name: 'uncertainty', gradient: 'shadow' };
  }

  function nextStep() {
    if (currentStep.value < 4) {
      currentStep.value++;
      eventBus.emit(GameEvents.UI_CLICK, { source: 'create_next' });
    }
  }

  function prevStep() {
    if (currentStep.value > 1) {
      currentStep.value--;
      eventBus.emit(GameEvents.UI_CLICK, { source: 'create_prev' });
    }
  }

  function calcNameLength(str: string): number {
    let len = 0;
    for (const ch of str) {
      len += /[\u4e00-\u9fff]/.test(ch) ? 2 : 1;
    }
    return len;
  }

  function validateName(input: string): string | null {
    const trimmed = input.trim();
    if (trimmed.length === 0) return '角色名不能为空';
    if (!/^[\u4e00-\u9fffa-zA-Z0-9]+$/.test(trimmed)) return '角色名只能包含中文、英文和数字，不允许特殊符号';
    if (calcNameLength(trimmed) > 16) return '角色名过长，最多8个汉字或16个英文字母';
    return null;
  }

  function showErrorModal(msg: string) {
    modalType.value = 'error';
    modalIcon.value = { name: 'caltrops', gradient: 'warning' };
    modalTitle.value = '角色名不符合要求';
    modalMessage.value = msg;
    modalConfirmText.value = '返回修改';
    showModal.value = true;
  }

  function showConfirmModal() {
    modalType.value = 'confirm';
    modalIcon.value = { name: 'check-mark', gradient: 'heal' };
    modalTitle.value = '确认创建角色';
    modalMessage.value = `确认创建角色「${name.value.trim()}」吗？`;
    modalConfirmText.value = '确认创建';
    showModal.value = true;
  }

  function cancelModal() {
    showModal.value = false;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'create_cancel_modal' });
  }

  function onModalConfirm() {
    showModal.value = false;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'create_confirm_modal' });
    if (modalType.value === 'confirm') {
      doCreate();
    }
  }

  async function doCreate() {
    // P7-027 修复：运行时校验三个值非 null，防止 confirm 弹窗后选择被清空的竞态
    const faction = selectedFaction.value;
    const race = selectedRace.value;
    const cls = selectedClass.value;
    if (!faction || !race || !cls) {
      showErrorModal('请先完成阵营、种族和职业的选择');
      return;
    }
    // P8-027 修复：createCharacter 失败时提示用户并保持弹窗
    try {
      await characterStore.createCharacter(name.value.trim(), faction, race, cls);
      onCreated();
    } catch (e) {
      showErrorModal(`创建角色失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  }

  async function createCharacter() {
    if (!canCreate.value) return;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'create_btn' });
    const error = validateName(name.value);
    if (error) {
      showErrorModal(error);
      return;
    }
    showConfirmModal();
  }

  return {
    // 状态
    currentStep, name, selectedFaction, selectedRace, selectedClass,
    showModal, modalType, modalIcon, modalTitle, modalMessage, modalConfirmText,
    // 计算属性
    currentStepTitle, displayFactions, neutralFaction,
    availableRaces, availableClasses, currentAttributes, derivedAttributes,
    canProceed, canCreate,
    // Actions
    loadData, selectFaction, selectRace, selectClass,
    getFactionRaceNames, getStatName, getStatIcon,
    nextStep, prevStep, cancelModal, onModalConfirm, createCharacter,
    // baseStore helpers (template 直接引用)
    getRaceIcon: (id: string) => baseStore.getRaceIcon(id),
    getFactionName: (id: string) => baseStore.getFactionName(id),
    getFactionColor: (id: string) => baseStore.getFactionColor(id),
    getRaceName: (id: string) => baseStore.getRaceName(id),
    getClassName: (id: string) => baseStore.getClassName(id),
    getClassColor: (id: string) => baseStore.getClassColor(id),
  };
}
