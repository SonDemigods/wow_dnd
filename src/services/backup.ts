export interface BackupFile {
  version: string;
  timestamp: number;
  checksum: string;
  gameVersion: string;
  data: {
    characters: CharacterListItem[];
    characterData: Record<string, CharacterData>;
    inventory: Record<string, InventoryData>;
    quests: Record<string, QuestData>;
    equipment: Record<string, EquipmentData>;
    skills: Record<string, SkillsData>;
    exploration: Record<string, ExplorationData>;
    combat: Record<string, CombatData>;
    adventureLog: Record<string, AdventureLogData>;
    map: MapConfigData;
    shop: ShopConfigData;
    gameState: GameStateData;
  };
}

export interface CharacterListItem {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  factionId: string;
  level: number;
  createdTime: number;
  lastPlayedTime: number;
}

export interface CharacterData {
  characterId: string;
  name: string;
  faction: 'alliance' | 'horde' | 'neutral' | null;
  race: string | null;
  class: string | null;
  level: number;
  exp: number;
  gold: number;
  baseStats: Stats;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  bonusStats: Partial<Stats>;
  updatedAt: number;
}

export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface InventoryData {
  characterId: string;
  inventorySize: number;
  items: InventoryItem[];
  updatedAt: number;
}

export interface InventoryItem {
  itemId: string;
  count: number;
}

export interface QuestData {
  characterId: string;
  questStates: Record<string, QuestState>;
  updatedAt: number;
}

export interface QuestState {
  status: QuestStatus;
  progress: QuestObjectiveProgress[];
  acceptedAt: number;
  completedAt?: number;
}

export type QuestStatus = 'not_available' | 'available' | 'in_progress' | 'completed' | 'turned_in' | 'abandoned';

export interface QuestObjectiveProgress {
  objectiveKey: string;
  current: number;
  target: number;
}

export interface EquipmentData {
  characterId: string;
  equipment: Record<string, string>;
  updatedAt: number;
}

export interface SkillsData {
  characterId: string;
  skills: Skill[];
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: SkillEffect;
  unlockLevel: number;
}

export type SkillType = 'physical_damage' | 'magic_damage' | 'heal';

export interface SkillEffect {
  type: SkillType;
  value: number;
  coefficient?: number;
}

export interface SkillBar {
  slots: [string | null, string | null, string | null, string | null];
}

export interface ExplorationData {
  characterId: string;
  currentAreaId: string | null;
  grid: GridCell[][];
  campUsed: boolean;
  updatedAt: number;
}

export interface GridCell {
  x: number;
  y: number;
  status: GridStatus;
  eventType?: GridEventType;
  eventData?: {
    shopId?: string;
    boardId?: string;
    monsterId?: string;
    itemId?: string;
    trapId?: string;
  };
}

export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'board' | 'boss';
export type GridEventType = 'monster' | 'item' | 'trap' | 'empty' | 'camp' | 'shop' | 'board' | 'boss';

export interface CombatData {
  characterId: string;
  combatHistory: CombatLogEntry[];
  updatedAt: number;
}

export interface CombatLogEntry {
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: 'player' | 'enemy' | 'system';
  actorId: string;
  actorName: string;
  eventType: string;
  targetType?: 'player' | 'enemy';
  targetId?: string;
  targetName?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  heal?: number;
  isCrit: boolean;
  isDodge: boolean;
  message: string;
}

export interface AdventureLogData {
  characterId: string;
  logs: LogEntry[];
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: string;
  message: string;
}

export interface MapConfigData {
  id: string;
  updatedAt: number;
}

export interface ShopConfigData {
  id: string;
  shopItems: Record<string, ShopItem[]>;
  lastRefresh: Record<string, number>;
  updatedAt: number;
}

export interface ShopItem {
  itemId: string;
  price: number;
  stock: number;
  maxStock: number;
}

export interface GameStateData {
  id: string;
  currentCharacterId: string | null;
  updatedAt: number;
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

export interface IBackupService {
  createBackup(): Promise<BackupFile>;
  exportBackup(): Promise<void>;
  getAutoBackups(): Promise<BackupFile[]>;
  deleteBackup(timestamp: number): Promise<void>;
  clearAutoBackups(): Promise<void>;
}

export interface IImportService {
  validateBackup(file: File): Promise<ValidationResult>;
  importBackup(file: File): Promise<ImportResult>;
  checkVersionCompatibility(backupVersion: string): CompatibilityResult;
}

export class BackupService implements IBackupService {
  private readonly AUTO_BACKUP_KEY = 'wow_dnd_auto_backups';
  private readonly MAX_AUTO_BACKUPS = 5;
  private readonly BACKUP_VERSION = 'v1.1';

  async createBackup(): Promise<BackupFile> {
    const timestamp = Date.now();
    const data = await this.collectAllData();
    const checksum = this.calculateChecksum(data);

    return {
      version: this.BACKUP_VERSION,
      timestamp,
      checksum,
      gameVersion: '1.0.0',
      data
    };
  }

  async exportBackup(): Promise<void> {
    const backup = await this.createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `wow_dnd_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getAutoBackups(): Promise<BackupFile[]> {
    try {
      const stored = localStorage.getItem(this.AUTO_BACKUP_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load auto backups:', error);
    }
    return [];
  }

  async deleteBackup(timestamp: number): Promise<void> {
    const backups = await this.getAutoBackups();
    const filtered = backups.filter(b => b.timestamp !== timestamp);
    localStorage.setItem(this.AUTO_BACKUP_KEY, JSON.stringify(filtered));
  }

  async clearAutoBackups(): Promise<void> {
    localStorage.removeItem(this.AUTO_BACKUP_KEY);
  }

  async createAutoBackup(): Promise<void> {
    const backup = await this.createBackup();
    const backups = await this.getAutoBackups();
    backups.unshift(backup);
    
    if (backups.length > this.MAX_AUTO_BACKUPS) {
      backups.pop();
    }
    
    localStorage.setItem(this.AUTO_BACKUP_KEY, JSON.stringify(backups));
  }

  private async collectAllData(): Promise<BackupFile['data']> {
    return {
      characters: [],
      characterData: {},
      inventory: {},
      quests: {},
      equipment: {},
      skills: {},
      exploration: {},
      combat: {},
      adventureLog: {},
      map: { id: 'map', updatedAt: Date.now() },
      shop: { id: 'shop', shopItems: {}, lastRefresh: {}, updatedAt: Date.now() },
      gameState: { id: 'gameState', currentCharacterId: null, updatedAt: Date.now() }
    };
  }

  private calculateChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export class ImportService implements IImportService {
  private readonly SUPPORTED_VERSIONS = ['v1.0', 'v1.1'];

  async validateBackup(file: File): Promise<ValidationResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content);
          
          if (!backup.version) {
            resolve({ success: false, error: '备份文件格式错误' });
            return;
          }
          
          const checksum = this.calculateChecksum(backup.data);
          if (checksum !== backup.checksum) {
            resolve({ success: false, error: '备份文件已损坏' });
            return;
          }
          
          const compatibility = this.checkVersionCompatibility(backup.version);
          if (!compatibility.compatible) {
            resolve({ success: false, error: compatibility.message });
            return;
          }
          
          resolve({
            success: true,
            version: backup.version,
            timestamp: backup.timestamp,
            gameVersion: backup.gameVersion
          });
        } catch (error) {
          resolve({ success: false, error: '备份文件格式错误' });
        }
      };
      
      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };
      
      reader.readAsText(file);
    });
  }

  async importBackup(file: File): Promise<ImportResult> {
    const validation = await this.validateBackup(file);
    if (!validation.success) {
      return { success: false, error: validation.error, importedStores: [], skippedStores: [] };
    }

    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content) as BackupFile;
          
          await this.importData(backup.data);
          resolve({ success: true, importedStores: Object.keys(backup.data), skippedStores: [] });
        } catch (error) {
          resolve({ success: false, error: '导入失败', importedStores: [], skippedStores: [] });
        }
      };
      
      reader.readAsText(file);
    });
  }

  checkVersionCompatibility(backupVersion: string): CompatibilityResult {
    if (this.SUPPORTED_VERSIONS.includes(backupVersion)) {
      return {
        compatible: true,
        message: '版本兼容',
        requiresMigration: backupVersion !== 'v1.1'
      };
    }
    return {
      compatible: false,
      message: '备份文件版本过旧，请更新游戏',
      requiresMigration: false
    };
  }

  private async importData(_data: BackupFile['data']): Promise<void> {
    localStorage.clear();
  }

  private calculateChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export const backupService = new BackupService();
export const importService = new ImportService();