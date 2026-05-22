import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';

export type ZoneId = 'stormwind' | 'orgrimmar' | 'darnassus' | 'undercity' | 'ironforge' | 'thunderbluff' | 'exodar' | 'silvermoon';

export type ZoneStatus = 'locked' | 'unlocked' | 'completed';

export interface MapZone {
  id: ZoneId;
  name: string;
  description: string;
  icon: string;
  status: ZoneStatus;
  requiredLevel: number;
  requiredGold: number;
  rewards: ZoneRewards;
  enemies: EnemyReference[];
  quests: QuestReference[];
  coordinates: { x: number; y: number };
}

export interface ZoneRewards {
  gold: number;
  exp: number;
  reputation: number;
}

export interface EnemyReference {
  enemyId: string;
  levelRange: [number, number];
  spawnRate: number;
}

export interface QuestReference {
  questId: string;
  required: boolean;
}

export interface MapState {
  zones: MapZone[];
  selectedZone: ZoneId | null;
  viewMode: MapViewMode;
  zoomLevel: number;
  playerPosition: { x: number; y: number };
}

export type MapViewMode = 'world' | 'zone' | 'exploration';

export interface ZoneUnlockedEvent {
  zoneId: ZoneId;
  zone: MapZone;
}

export interface ZoneEnteredEvent {
  zoneId: ZoneId;
  zone: MapZone;
}

export interface IMapService {
  getZones(): MapZone[];
  getZoneById(zoneId: ZoneId): MapZone | undefined;
  unlockZone(zoneId: ZoneId): boolean;
  completeZone(zoneId: ZoneId): void;
  selectZone(zoneId: ZoneId | null): void;
  getSelectedZone(): ZoneId | null;
  getViewMode(): MapViewMode;
  setViewMode(mode: MapViewMode): void;
  enterZone(zoneId: ZoneId): boolean;
  canEnterZone(zoneId: ZoneId): boolean;
  getState(): MapState;
}

const INITIAL_ZONES: MapZone[] = [
  {
    id: 'stormwind',
    name: '暴风城',
    description: '人类的主城，宏伟的城堡耸立在艾尔文森林中。',
    icon: 'castle',
    status: 'unlocked',
    requiredLevel: 1,
    requiredGold: 0,
    rewards: { gold: 100, exp: 50, reputation: 10 },
    enemies: [
      { enemyId: 'goblin', levelRange: [1, 5], spawnRate: 0.3 },
      { enemyId: 'skeleton', levelRange: [2, 6], spawnRate: 0.25 },
      { enemyId: 'wolf', levelRange: [1, 4], spawnRate: 0.45 }
    ],
    quests: [{ questId: 'q_stormwind_intro', required: true }],
    coordinates: { x: 35, y: 40 }
  },
  {
    id: 'orgrimmar',
    name: '奥格瑞玛',
    description: '兽人部落的主城，充满力量与荣耀的城市。',
    icon: 'fortress',
    status: 'locked',
    requiredLevel: 10,
    requiredGold: 50,
    rewards: { gold: 200, exp: 100, reputation: 20 },
    enemies: [
      { enemyId: 'orc', levelRange: [8, 12], spawnRate: 0.3 },
      { enemyId: 'troll', levelRange: [9, 13], spawnRate: 0.25 },
      { enemyId: 'dragon', levelRange: [10, 15], spawnRate: 0.45 }
    ],
    quests: [{ questId: 'q_orgrimmar_intro', required: true }],
    coordinates: { x: 65, y: 55 }
  },
  {
    id: 'darnassus',
    name: '达纳苏斯',
    description: '暗夜精灵的家园，漂浮在泰达希尔的世界之树上。',
    icon: 'tree',
    status: 'locked',
    requiredLevel: 15,
    requiredGold: 100,
    rewards: { gold: 300, exp: 150, reputation: 30 },
    enemies: [
      { enemyId: 'nightelf', levelRange: [12, 18], spawnRate: 0.3 },
      { enemyId: 'treant', levelRange: [14, 20], spawnRate: 0.35 },
      { enemyId: 'demon', levelRange: [15, 22], spawnRate: 0.35 }
    ],
    quests: [{ questId: 'q_darnassus_intro', required: true }],
    coordinates: { x: 25, y: 25 }
  },
  {
    id: 'undercity',
    name: '幽暗城',
    description: '被遗忘者的地下王国，充满黑暗与神秘。',
    icon: 'skull',
    status: 'locked',
    requiredLevel: 20,
    requiredGold: 200,
    rewards: { gold: 400, exp: 200, reputation: 40 },
    enemies: [
      { enemyId: 'undead', levelRange: [18, 24], spawnRate: 0.4 },
      { enemyId: 'lich', levelRange: [20, 26], spawnRate: 0.3 },
      { enemyId: 'ghoul', levelRange: [17, 23], spawnRate: 0.3 }
    ],
    quests: [{ questId: 'q_undercity_intro', required: true }],
    coordinates: { x: 75, y: 30 }
  },
  {
    id: 'ironforge',
    name: '铁炉堡',
    description: '矮人的坚固堡垒，坐落于丹莫罗的山脉之中。',
    icon: 'anvil',
    status: 'locked',
    requiredLevel: 25,
    requiredGold: 300,
    rewards: { gold: 500, exp: 250, reputation: 50 },
    enemies: [
      { enemyId: 'dwarf', levelRange: [22, 28], spawnRate: 0.35 },
      { enemyId: 'golem', levelRange: [24, 30], spawnRate: 0.3 },
      { enemyId: 'giant', levelRange: [25, 32], spawnRate: 0.35 }
    ],
    quests: [{ questId: 'q_ironforge_intro', required: true }],
    coordinates: { x: 30, y: 65 }
  },
  {
    id: 'thunderbluff',
    name: '雷霆崖',
    description: '牛头人的神圣高地，俯瞰着莫高雷平原。',
    icon: 'totem',
    status: 'locked',
    requiredLevel: 30,
    requiredGold: 400,
    rewards: { gold: 600, exp: 300, reputation: 60 },
    enemies: [
      { enemyId: 'tauren', levelRange: [28, 34], spawnRate: 0.3 },
      { enemyId: 'elemental', levelRange: [30, 36], spawnRate: 0.35 },
      { enemyId: 'beast', levelRange: [29, 35], spawnRate: 0.35 }
    ],
    quests: [{ questId: 'q_thunderbluff_intro', required: true }],
    coordinates: { x: 70, y: 70 }
  },
  {
    id: 'exodar',
    name: '埃索达',
    description: '德莱尼人的飞船，坠落在艾泽拉斯的水晶之歌森林。',
    icon: 'ship',
    status: 'locked',
    requiredLevel: 35,
    requiredGold: 500,
    rewards: { gold: 700, exp: 350, reputation: 70 },
    enemies: [
      { enemyId: 'draenei', levelRange: [33, 39], spawnRate: 0.3 },
      { enemyId: 'void', levelRange: [35, 41], spawnRate: 0.35 },
      { enemyId: 'naaru', levelRange: [36, 42], spawnRate: 0.35 }
    ],
    quests: [{ questId: 'q_exodar_intro', required: true }],
    coordinates: { x: 15, y: 50 }
  },
  {
    id: 'silvermoon',
    name: '银月城',
    description: '血精灵的华丽城市，充满魔法与优雅。',
    icon: 'moon',
    status: 'locked',
    requiredLevel: 40,
    requiredGold: 600,
    rewards: { gold: 800, exp: 400, reputation: 80 },
    enemies: [
      { enemyId: 'bloodelf', levelRange: [38, 44], spawnRate: 0.3 },
      { enemyId: 'demon', levelRange: [40, 46], spawnRate: 0.35 },
      { enemyId: 'mage', levelRange: [39, 45], spawnRate: 0.35 }
    ],
    quests: [{ questId: 'q_silvermoon_intro', required: true }],
    coordinates: { x: 85, y: 45 }
  }
];

export const useMapStore = defineStore('map', () => {
  const zones = ref<MapZone[]>(JSON.parse(JSON.stringify(INITIAL_ZONES)));
  const selectedZone = ref<ZoneId | null>(null);
  const viewMode = ref<MapViewMode>('world');
  const zoomLevel = ref(1);
  const playerPosition = ref({ x: 35, y: 40 });

  const state = computed<MapState>(() => ({
    zones: zones.value,
    selectedZone: selectedZone.value,
    viewMode: viewMode.value,
    zoomLevel: zoomLevel.value,
    playerPosition: playerPosition.value
  }));

  function getZones(): MapZone[] {
    return zones.value;
  }

  function getZoneById(zoneId: ZoneId): MapZone | undefined {
    return zones.value.find(zone => zone.id === zoneId);
  }

  function unlockZone(zoneId: ZoneId): boolean {
    const zone = getZoneById(zoneId);
    if (!zone) return false;
    if (zone.status !== 'locked') return false;

    const playerLevel = characterService.getLevel();
    const playerGold = characterService.getGold();

    if (playerLevel < zone.requiredLevel) {
      return false;
    }

    if (playerGold < zone.requiredGold) {
      return false;
    }

    characterService.addGold(-zone.requiredGold);
    zone.status = 'unlocked';

    eventBus.emit(GameEvents.ZONE_UNLOCKED, { zoneId, zone });
    return true;
  }

  function completeZone(zoneId: ZoneId): void {
    const zone = getZoneById(zoneId);
    if (!zone) return;
    if (zone.status !== 'unlocked') return;

    zone.status = 'completed';

    characterService.addGold(zone.rewards.gold);
    characterService.addExp(zone.rewards.exp);

    eventBus.emit(GameEvents.ZONE_COMPLETED, { zoneId, zone });
  }

  function selectZone(zoneId: ZoneId | null): void {
    selectedZone.value = zoneId;
  }

  function getSelectedZone(): ZoneId | null {
    return selectedZone.value;
  }

  function getViewMode(): MapViewMode {
    return viewMode.value;
  }

  function setViewMode(mode: MapViewMode): void {
    viewMode.value = mode;
  }

  function enterZone(zoneId: ZoneId): boolean {
    if (!canEnterZone(zoneId)) {
      return false;
    }

    const zone = getZoneById(zoneId);
    if (!zone) return false;

    playerPosition.value = { ...zone.coordinates };
    selectedZone.value = zoneId;
    viewMode.value = 'exploration';

    eventBus.emit(GameEvents.ZONE_ENTERED, { zoneId, zone });
    return true;
  }

  function canEnterZone(zoneId: ZoneId): boolean {
    const zone = getZoneById(zoneId);
    if (!zone) return false;

    if (zone.status === 'locked') {
      return false;
    }

    const playerLevel = characterService.getLevel();
    return playerLevel >= zone.requiredLevel;
  }

  function getState(): MapState {
    return state.value;
  }

  function updateZoneStatus(zoneId: ZoneId, status: ZoneStatus): void {
    const zone = getZoneById(zoneId);
    if (zone) {
      zone.status = status;
    }
  }

  function resetZones(): void {
    zones.value = JSON.parse(JSON.stringify(INITIAL_ZONES));
    selectedZone.value = null;
    viewMode.value = 'world';
    zoomLevel.value = 1;
    playerPosition.value = { x: 35, y: 40 };
  }

  return {
    zones,
    selectedZone,
    viewMode,
    zoomLevel,
    playerPosition,
    state,
    getZones,
    getZoneById,
    unlockZone,
    completeZone,
    selectZone,
    getSelectedZone,
    getViewMode,
    setViewMode,
    enterZone,
    canEnterZone,
    getState,
    updateZoneStatus,
    resetZones
  };
});

export const mapService: IMapService = {
  getZones: () => useMapStore().getZones(),
  getZoneById: (zoneId: ZoneId) => useMapStore().getZoneById(zoneId),
  unlockZone: (zoneId: ZoneId) => useMapStore().unlockZone(zoneId),
  completeZone: (zoneId: ZoneId) => useMapStore().completeZone(zoneId),
  selectZone: (zoneId: ZoneId | null) => useMapStore().selectZone(zoneId),
  getSelectedZone: () => useMapStore().getSelectedZone(),
  getViewMode: () => useMapStore().getViewMode(),
  setViewMode: (mode: MapViewMode) => useMapStore().setViewMode(mode),
  enterZone: (zoneId: ZoneId) => useMapStore().enterZone(zoneId),
  canEnterZone: (zoneId: ZoneId) => useMapStore().canEnterZone(zoneId),
  getState: () => useMapStore().getState()
};
