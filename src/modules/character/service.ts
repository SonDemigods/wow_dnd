/**
 * 角色模块服务层
 * 
 * 提供角色管理的核心业务逻辑
 */
import type { ICharacterService, Character, CharacterListItem, Stats, Attributes, FactionType, RaceType, ClassType, RaceData, ClassData } from './types';
import { characterDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { 
  calculateMaxHp, 
  calculateMaxMana, 
  calculatePhysicalAttack, 
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateHpBonus,
  calculateMpBonus,
  calculateHealBonus,
  getExpForLevel
} from '@/utils/calculations';
import { MAX_LEVEL } from '@/config/character';
import { gameDataService } from '../gameData/service';
import { skillsDbService } from '../skill/db';
import { inventoryDbService } from '../inventory/db';
import { equipmentDbService } from '../equipment/db';
import { explorationDbService } from '../exploration/db';
import { adventureLogDbService } from '../log/db';
import { questDbService } from '../quest/db';
import type { Skill, SkillBar } from '../skill/types';

/**
 * 角色服务实现类
 */
export class CharacterService implements ICharacterService {
  /** 当前角色ID */
  private currentCharacterId: string | null = null;
  
  /** 角色数据 */
  private character: Character | null = null;
  
  /** 属性加成 */
  private bonusStats: Partial<Stats> = {};
  
  /** 种族属性调整 */
  private raceBonus: Partial<Stats> = {};
  
  /** 职业属性调整 */
  private classBonus: Partial<Stats> = {};
  
  /** 种族数据缓存（从数据库加载） */
  private racesData: Record<string, RaceData> = {};
  
  /** 职业数据缓存（从数据库加载） */
  private classesData: Record<string, ClassData> = {};

  constructor() {
    this.setupCrossModuleListeners();
  }

  /**
   * 注册跨模块事件监听——处理其他模块请求的角色数据变更
   */
  private setupCrossModuleListeners(): void {
    // 受到伤害
    eventBus.on(GameEvents.CHARACTER_TAKE_DAMAGE, (data: { amount: number; source: string }) => {
      this.addHp(-data.amount);
    });
    // 获得治疗
    eventBus.on(GameEvents.CHARACTER_RECEIVE_HEAL, (data: { amount: number; source: string }) => {
      this.addHp(data.amount);
    });
    // 魔力变化
    eventBus.on(GameEvents.CHARACTER_RECEIVE_MP, (data: { amount: number; source: string }) => {
      this.addMp(data.amount);
    });
    // 获得经验
    eventBus.on(GameEvents.CHARACTER_GAIN_EXP, (data: { amount: number; source: string }) => {
      this.addExp(data.amount);
    });
    // 获得金币
    eventBus.on(GameEvents.CHARACTER_GAIN_GOLD, (data: { amount: number; source: string }) => {
      this.addGold(data.amount);
    });
    // 应用属性加成
    eventBus.on(GameEvents.CHARACTER_APPLY_BONUS, (data: { bonus: Partial<Stats> }) => {
      this.applyBonus(data.bonus);
    });
    // 移除属性加成
    eventBus.on(GameEvents.CHARACTER_REMOVE_BONUS, (data: { bonus: Partial<Stats> }) => {
      this.removeBonus(data.bonus);
    });
  }

  /**
   * 生成唯一角色ID
   * @returns 角色ID
   */
  private generateId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 创建新角色
   * @param name - 角色名称
   * @param factionId - 阵营ID
   * @param raceId - 种族ID
   * @param classId - 职业ID
   * @returns 角色ID
   */
  async createCharacter(name: string, factionId: FactionType, raceId: RaceType, classId: ClassType): Promise<string> {
    const characterId = this.generateId();
    
    // 获取种族和职业的属性加成（从缓存数据中获取）
    const race = this.racesData[raceId];
    const classData = this.classesData[classId];
    
    this.raceBonus = race?.bonus || {};
    this.classBonus = classData?.bonus || {};
    
    // 计算基础属性（基础10 + 种族调整 + 职业调整）
    const baseStats: Stats = {
      str: Math.max(1, 10 + (this.raceBonus.str || 0) + (this.classBonus.str || 0)),
      dex: Math.max(1, 10 + (this.raceBonus.dex || 0) + (this.classBonus.dex || 0)),
      con: Math.max(1, 10 + (this.raceBonus.con || 0) + (this.classBonus.con || 0)),
      int: Math.max(1, 10 + (this.raceBonus.int || 0) + (this.classBonus.int || 0)),
      wis: Math.max(1, 10 + (this.raceBonus.wis || 0) + (this.classBonus.wis || 0)),
      cha: Math.max(1, 10 + (this.raceBonus.cha || 0) + (this.classBonus.cha || 0))
    };
    
    // 计算衍生属性
    const maxHp = calculateMaxHp(baseStats);
    const maxMana = calculateMaxMana(baseStats);
    
    // 创建角色数据
    this.character = {
      name,
      factionId,
      raceId,
      classId,
      level: 1,
      exp: 0,
      expToNextLevel: getExpForLevel(2),
      hp: maxHp,
      maxHp,
      mana: maxMana,
      maxMana,
      stats: baseStats,
      gold: 50
    };
    
    // 创建角色列表项
    const listItem: CharacterListItem = {
      id: characterId,
      name,
      raceId,
      classId,
      factionId,
      level: 1,
      createdTime: Date.now(),
      lastPlayedTime: Date.now()
    };
    
    // 初始化技能数据（从数据库获取职业技能模板）
    const classAbilities = await skillsDbService.getSkillTemplatesByClass(classId);
    const skills: Skill[] = classAbilities.filter(skill => skill.unlockLevel <= 1).map(skill => ({ ...skill }));
    const skillBar: SkillBar = { slots: [null, null, null, null] };
    
    // 将已解锁的技能自动装备到技能栏
    skills.forEach((skill, index) => {
      if (index < 4) {
        skillBar.slots[index] = skill.id;
      }
    });
    
    // 保存到数据库
    await characterDbService.saveCharacterListItem(listItem);
    await characterDbService.saveCharacterData(characterDbService.toStorageFormat(characterId, this.character, this.bonusStats));
    await skillsDbService.saveSkillsData({
      characterId,
      skills,
      skillBar,
      currentClass: classId,
      updatedAt: Date.now()
    });
    
    // 触发事件
    eventBus.emit(GameEvents.CHARACTER_CREATED, { characterId, name });
    
    return characterId;
  }

  /**
   * 选择角色
   * @param characterId - 角色ID
   * @returns 是否成功选择
   */
  async selectCharacter(characterId: string): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    const data = await characterDbService.getCharacterData(characterId);
    
    if (!listItem || !data) {
      return false;
    }
    
    // 更新最后游玩时间
    listItem.lastPlayedTime = Date.now();
    await characterDbService.saveCharacterListItem(listItem);
    
    // 加载角色数据
    this.character = characterDbService.fromStorageFormat(data);
    this.currentCharacterId = characterId;
    this.bonusStats = data.bonusStats || {};
    
    // 获取种族和职业加成（从缓存数据中获取）
    const race = this.racesData[data.raceId];
    const classData = this.classesData[data.classId];
    this.raceBonus = race?.bonus || {};
    this.classBonus = classData?.bonus || {};
    
    // 更新游戏状态
    await characterDbService.saveGameState(characterId);
    
    // 触发事件
    eventBus.emit(GameEvents.CHARACTER_SELECTED, { characterId });
    
    return true;
  }

  /**
   * 删除角色
   * @param characterId - 角色ID
   * @returns 是否成功删除
   */
  async deleteCharacter(characterId: string): Promise<boolean> {
    const listItem = await characterDbService.getCharacterListItem(characterId);
    if (!listItem) {
      return false;
    }
    
    // 删除角色基础数据
    await characterDbService.deleteCharacterListItem(characterId);
    await characterDbService.deleteCharacterData(characterId);
    
    // 删除角色相关模块数据
    await skillsDbService.deleteSkillsData(characterId);
    await inventoryDbService.deleteInventory(characterId);
    await equipmentDbService.deleteEquipment(characterId);
    await explorationDbService.deleteExplorationData(characterId);
    await adventureLogDbService.deleteAdventureLog(characterId);
    await questDbService.deleteCharacterQuests(characterId);
    
    // 如果删除的是当前角色，清空当前角色
    if (this.currentCharacterId === characterId) {
      this.currentCharacterId = null;
      this.character = null;
      await characterDbService.saveGameState(null);
    }
    
    // 触发事件
    eventBus.emit(GameEvents.CHARACTER_DELETED, { characterId });
    
    return true;
  }

  /**
   * 获取所有角色列表
   * @returns 角色列表
   */
  async getAllCharacters(): Promise<CharacterListItem[]> {
    return await characterDbService.getAllCharacterListItems();
  }

  /**
   * 获取当前选中的角色ID
   * @returns 当前角色ID
   */
  getCurrentCharacterId(): string | null {
    return this.currentCharacterId;
  }

  /** 登出当前角色 */
  async logout(): Promise<void> {
    this.currentCharacterId = null;
    this.character = null;
    this.bonusStats = {};
    await characterDbService.saveGameState(null);
    eventBus.emit(GameEvents.CHARACTER_LOGOUT, null);
  }

  /**
   * 获取核心属性（基础属性 + 种族 + 职业 + 装备加成）
   * @returns 核心属性
   */
  getStats(): Stats {
    if (!this.character) {
      return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    }
    
    const base = this.character.stats;
    return {
      str: base.str + (this.bonusStats.str || 0),
      dex: base.dex + (this.bonusStats.dex || 0),
      con: base.con + (this.bonusStats.con || 0),
      int: base.int + (this.bonusStats.int || 0),
      wis: base.wis + (this.bonusStats.wis || 0),
      cha: base.cha + (this.bonusStats.cha || 0)
    };
  }

  /**
   * 获取衍生属性
   * @returns 衍生属性
   */
  getAttributes(): Attributes {
    const stats = this.getStats();
    return {
      maxHp: this.character?.maxHp || calculateMaxHp(stats),
      maxMana: this.character?.maxMana || calculateMaxMana(stats),
      physicalAttack: calculatePhysicalAttack(stats),
      physicalDefense: calculatePhysicalDefense(stats),
      magicAttack: calculateMagicAttack(stats),
      magicDefense: calculateMagicDefense(stats),
      critChance: calculateCritChance(stats),
      dodgeChance: calculateDodgeChance(stats),
      hpBonus: calculateHpBonus(stats),
      mpBonus: calculateMpBonus(stats),
      healBonus: calculateHealBonus(stats)
    };
  }

  /**
   * 获取等级
   * @returns 当前等级
   */
  getLevel(): number {
    return this.character?.level || 1;
  }

  /**
   * 获取当前经验值
   * @returns 当前经验值
   */
  getExp(): number {
    return this.character?.exp || 0;
  }

  /**
   * 获取升级所需经验值
   * @returns 升级所需经验值
   */
  getExpToNextLevel(): number {
    return this.character?.expToNextLevel || 100;
  }

  /**
   * 获取角色名称
   * @returns 角色名称
   */
  getName(): string {
    return this.character?.name || '';
  }

  /**
   * 获取阵营
   * @returns 阵营ID
   */
  getFaction(): FactionType {
    return this.character?.factionId || 'neutral';
  }

  /**
   * 获取种族
   * @returns 种族ID
   */
  getRace(): RaceType {
    return this.character?.raceId || 'human';
  }

  /**
   * 获取职业
   * @returns 职业ID
   */
  getClass(): ClassType {
    return this.character?.classId || 'warrior';
  }

  /**
   * 获取金币数量
   * @returns 金币数量
   */
  getGold(): number {
    return this.character?.gold || 0;
  }

  /**
   * 获取角色信息
   * @returns 角色信息
   */
  getCharacterInfo(): Character {
    return this.character || {
      name: '',
      factionId: 'neutral',
      raceId: 'human',
      classId: 'warrior',
      level: 1,
      exp: 0,
      expToNextLevel: 100,
      hp: 100,
      maxHp: 100,
      mana: 50,
      maxMana: 50,
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      gold: 0
    };
  }

  /**
   * 添加经验值
   * @param amount - 经验值数量
   */
  async addExp(amount: number): Promise<void> {
    if (!this.character || amount <= 0) return;
    
    let newExp = this.character.exp + amount;
    let newLevel = this.character.level;
    
    // 检查是否升级
    while (newLevel < MAX_LEVEL && newExp >= this.character.expToNextLevel) {
      newExp -= this.character.expToNextLevel;
      newLevel++;
      
      // 升级处理
      this.handleLevelUp(newLevel);
      
      // 更新升级所需经验
      this.character.expToNextLevel = getExpForLevel(newLevel + 1);
    }
    
    // 如果达到最高等级，经验值不再增加
    if (newLevel >= MAX_LEVEL) {
      newExp = 0;
    }
    
    this.character.exp = newExp;
    this.character.level = newLevel;
    
    await this.save();
  }

  /**
   * 处理升级
   * @param newLevel - 新等级
   */
  private handleLevelUp(newLevel: number): void {
    if (!this.character) return;
    
    // 基础属性增长（每级每项+1）
    this.character.stats.str += 1;
    this.character.stats.dex += 1;
    this.character.stats.con += 1;
    this.character.stats.int += 1;
    this.character.stats.wis += 1;
    this.character.stats.cha += 1;
    
    // 计算新的HP和MP上限
    const stats = this.getStats();
    const hpIncrease = calculateHpBonus(stats);
    const mpIncrease = calculateMpBonus(stats);
    
    this.character.maxHp += hpIncrease;
    this.character.maxMana += mpIncrease;
    
    // 升级后恢复满HP/MP
    this.character.hp = this.character.maxHp;
    this.character.mana = this.character.maxMana;
    
    // 触发升级事件
    eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, {
      oldLevel: newLevel - 1,
      newLevel
    });
  }

  /**
   * 添加生命值
   * @param amount - 生命值数量
   */
  async addHp(amount: number): Promise<void> {
    if (!this.character) return;
    
    const oldHp = this.character.hp;
    this.character.hp = Math.min(this.character.maxHp, Math.max(0, this.character.hp + amount));
    
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, {
      oldHp,
      newHp: this.character.hp,
      maxHp: this.character.maxHp
    });
    
    await this.save();
  }

  /**
   * 添加法力值
   * @param amount - 法力值数量
   */
  async addMp(amount: number): Promise<void> {
    if (!this.character) return;
    
    const oldMp = this.character.mana;
    this.character.mana = Math.min(this.character.maxMana, Math.max(0, this.character.mana + amount));
    
    eventBus.emit(GameEvents.CHARACTER_MP_CHANGE, {
      oldMp,
      newMp: this.character.mana,
      maxMp: this.character.maxMana
    });
    
    await this.save();
  }

  /**
   * 设置生命值
   * @param value - 生命值数值
   */
  async setHp(value: number): Promise<void> {
    if (!this.character) return;
    
    const oldHp = this.character.hp;
    this.character.hp = Math.min(this.character.maxHp, Math.max(0, value));
    
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, {
      oldHp,
      newHp: this.character.hp,
      maxHp: this.character.maxHp
    });
    
    await this.save();
  }

  /**
   * 设置法力值
   * @param value - 法力值数值
   */
  async setMp(value: number): Promise<void> {
    if (!this.character) return;
    
    const oldMp = this.character.mana;
    this.character.mana = Math.min(this.character.maxMana, Math.max(0, value));
    
    eventBus.emit(GameEvents.CHARACTER_MP_CHANGE, {
      oldMp,
      newMp: this.character.mana,
      maxMp: this.character.maxMana
    });
    
    await this.save();
  }

  /**
   * 应用属性加成
   * @param bonus - 属性加成
   */
  async applyBonus(bonus: Partial<Stats>): Promise<void> {
    const oldStats = { ...this.getStats() };
    
    Object.keys(bonus).forEach(key => {
      const statKey = key as keyof Stats;
      this.bonusStats[statKey] = (this.bonusStats[statKey] || 0) + (bonus[statKey] || 0);
    });
    
    // 更新HP/MP上限（如果体质或智力等影响上限的属性变化）
    if (bonus.con || bonus.int || bonus.wis || bonus.cha) {
      const newStats = this.getStats();
      this.character!.maxHp = calculateMaxHp(newStats);
      this.character!.maxMana = calculateMaxMana(newStats);
      // 如果当前HP/MP超过新上限，调整到上限
      this.character!.hp = Math.min(this.character!.hp, this.character!.maxHp);
      this.character!.mana = Math.min(this.character!.mana, this.character!.maxMana);
    }
    
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, {
      oldStats,
      newStats: this.getStats()
    });
    
    await this.save();
  }

  /**
   * 移除属性加成
   * @param bonus - 属性加成
   */
  async removeBonus(bonus: Partial<Stats>): Promise<void> {
    const oldStats = { ...this.getStats() };
    
    Object.keys(bonus).forEach(key => {
      const statKey = key as keyof Stats;
      this.bonusStats[statKey] = Math.max(0, (this.bonusStats[statKey] || 0) - (bonus[statKey] || 0));
    });
    
    // 更新HP/MP上限
    const newStats = this.getStats();
    this.character!.maxHp = calculateMaxHp(newStats);
    this.character!.maxMana = calculateMaxMana(newStats);
    this.character!.hp = Math.min(this.character!.hp, this.character!.maxHp);
    this.character!.mana = Math.min(this.character!.mana, this.character!.maxMana);
    
    eventBus.emit(GameEvents.CHARACTER_STATS_CHANGE, {
      oldStats,
      newStats: this.getStats()
    });
    
    await this.save();
  }

  /**
   * 添加金币
   * @param amount - 金币数量
   */
  async addGold(amount: number): Promise<void> {
    if (!this.character || amount <= 0) return;
    
    this.character.gold += amount;
    await this.save();
  }

  /**
   * 花费金币
   * @param amount - 金币数量
   * @returns 是否成功花费
   */
  async spendGold(amount: number): Promise<boolean> {
    if (!this.character || amount <= 0 || this.character.gold < amount) {
      return false;
    }
    
    this.character.gold -= amount;
    await this.save();
    return true;
  }

  /**
   * 设置角色名称
   * @param name - 角色名称
   */
  async setName(name: string): Promise<void> {
    if (!this.character) return;
    
    this.character.name = name;
    
    // 更新角色列表项
    const items = await characterDbService.getAllCharacterListItems();
    const item = items.find(i => i.id === this.currentCharacterId);
    if (item) {
      item.name = name;
      await characterDbService.saveCharacterListItem(item);
    }
    
    await this.save();
  }

  /**
   * 设置阵营
   * @param factionId - 阵营ID
   */
  async setFactionId(factionId: FactionType): Promise<void> {
    if (!this.character) return;
    this.character.factionId = factionId;
    await this.save();
  }

  /**
   * 设置种族
   * @param race - 种族ID
   */
  async setRace(race: RaceType): Promise<void> {
    if (!this.character) return;
    this.character.raceId = race;
    
    // 更新种族加成（从缓存数据中获取）
    const raceData = this.racesData[race];
    this.raceBonus = raceData?.bonus || {};
    
    // 重新计算属性
    this.recalculateStats();
    
    await this.save();
  }

  /**
   * 设置职业
   * @param classId - 职业ID
   */
  async setClass(classId: ClassType): Promise<void> {
    if (!this.character) return;
    this.character.classId = classId;
    
    // 更新职业加成（从缓存数据中获取）
    const classData = this.classesData[classId];
    this.classBonus = classData?.bonus || {};
    
    // 重新计算属性
    this.recalculateStats();
    
    await this.save();
  }

  /**
   * 重新计算属性
   */
  private recalculateStats(): void {
    if (!this.character) return;
    
    // 重新计算基础属性
    const base: Stats = {
      str: Math.max(1, 10 + (this.raceBonus.str || 0) + (this.classBonus.str || 0)),
      dex: Math.max(1, 10 + (this.raceBonus.dex || 0) + (this.classBonus.dex || 0)),
      con: Math.max(1, 10 + (this.raceBonus.con || 0) + (this.classBonus.con || 0)),
      int: Math.max(1, 10 + (this.raceBonus.int || 0) + (this.classBonus.int || 0)),
      wis: Math.max(1, 10 + (this.raceBonus.wis || 0) + (this.classBonus.wis || 0)),
      cha: Math.max(1, 10 + (this.raceBonus.cha || 0) + (this.classBonus.cha || 0))
    };
    
    this.character.stats = base;
    
    // 重新计算HP/MP上限
    const stats = this.getStats();
    this.character.maxHp = calculateMaxHp(stats);
    this.character.maxMana = calculateMaxMana(stats);
  }

  /** 重置角色数据 */
  async reset(): Promise<void> {
    if (!this.character) return;
    
    // 恢复到初始状态
    this.character.level = 1;
    this.character.exp = 0;
    this.character.expToNextLevel = getExpForLevel(2);
    this.character.hp = this.character.maxHp;
    this.character.mana = this.character.maxMana;
    
    // 重置属性到基础值（从缓存数据中获取）
    const race = this.racesData[this.character.raceId];
    const classData = this.classesData[this.character.classId];
    this.raceBonus = race?.bonus || {};
    this.classBonus = classData?.bonus || {};
    
    this.recalculateStats();
    
    await this.save();
  }

  /** 处理角色死亡 */
  async handleDeath(): Promise<void> {
    if (!this.character) return;
    
    // 损失本级所有经验值
    this.character.exp = 0;
    
    // 触发死亡事件
    eventBus.emit(GameEvents.CHARACTER_DEATH, { cause: 'death' });
    
    // 自动复活
    await this.resurrect();
  }

  /** 复活角色 */
  async resurrect(): Promise<void> {
    if (!this.character) return;
    
    // 恢复50%生命值和魔法值
    this.character.hp = Math.floor(this.character.maxHp * 0.5);
    this.character.mana = Math.floor(this.character.maxMana * 0.5);
    
    // 触发复活事件
    eventBus.emit(GameEvents.CHARACTER_RESURRECTED, {
      newHp: this.character.hp,
      newMp: this.character.mana
    });
    
    await this.save();
  }

  /**
   * 保存角色数据到数据库
   */
  private async save(): Promise<void> {
    if (!this.currentCharacterId || !this.character) return;
    
    // 保存角色详细数据
    await characterDbService.saveCharacterData(
      characterDbService.toStorageFormat(this.currentCharacterId, this.character, this.bonusStats)
    );
    
    // 同步更新角色列表项
    const listItem = await characterDbService.getCharacterListItem(this.currentCharacterId);
    if (listItem) {
      // 更新列表项中的等级和名称
      listItem.level = this.character.level;
      listItem.name = this.character.name;
      listItem.lastPlayedTime = Date.now();
      await characterDbService.saveCharacterListItem(listItem);
    }
  }

  /**
   * 初始化服务（从数据库加载数据）
   */
  async initialize(): Promise<void> {
    // 从数据库加载种族和职业数据到缓存
    this.racesData = await gameDataService.getRaces();
    this.classesData = await gameDataService.getClasses();
    
    const gameState = await characterDbService.getGameState();
    if (gameState?.currentCharacterId) {
      await this.selectCharacter(gameState.currentCharacterId);
    }
  }
}

/**
 * 角色服务实例
 */
export const characterService = new CharacterService();