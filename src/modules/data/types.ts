import type { CharacterListItem } from '../character/types';
import type { InventoryItem } from '../inventory/types';
import type { QuestInstance } from '../quest/types';
import type { EquipmentState } from '../equipment/types';
import type { SkillsData } from '../skills/types';
import type { ExplorationState } from '../exploration/types';
import type { CombatLog } from '../combat/types';
import type { LogEntry } from '../log/types';
import type { LocationData } from '../map/types';
import type { ShopConfig } from '../shop/types';

export interface BackupFile {
  version: string;
  timestamp: number;
  checksum: string;
  gameVersion: string;
  data: BackupData;
}

export interface GameStateData {
  isRunning: boolean;
  isPaused: boolean;
  isEnded: boolean;
}

export interface CharacterData {
  characterId: string;
  level: number;
  exp: number;
  gold: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface BackupData {
  characters: CharacterListItem[];
  characterData: Record<string, CharacterData>;
  inventory: Record<string, InventoryItem>;
  quests: Record<string, QuestInstance>;
  equipment: Record<string, EquipmentState>;
  skills: Record<string, SkillsData>;
  exploration: Record<string, ExplorationState>;
  combat: Record<string, CombatLog>;
  adventureLog: Record<string, LogEntry[]>;
  map: LocationData[];
  shop: ShopConfig[];
  gameState: GameStateData;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  version?: string;
  timestamp?: number;
  gameVersion?: string;
}

export interface ImportResult {
  success: boolean;
  error?: string;
  importedStores: string[];
  skippedStores: string[];
}

export interface CompatibilityResult {
  compatible: boolean;
  message: string;
  requiresMigration: boolean;
}