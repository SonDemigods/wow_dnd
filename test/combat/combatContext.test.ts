/**
 * @fileoverview combatContext 战斗上下文接口与工厂单元测试（A2 读写分离）
 *
 * 覆盖：
 * 1. createCombatContext 返回值结构：6 个域（character/skill/enemy/quest/log/inventory）均存在
 * 2. 只读属性委托：character.name/hp 等通过 getter 代理到 characterStore
 * 3. 写入方法委托：character.takeDamage/skill.castSkill 等委托到对应 Store
 * 4. ICombatQuery / ICombatCommand / ICombatContext 类型兼容性（编译期保证）
 *
 * Mock 策略：
 * - 6 个外部 Store 全量 mock，断言 createCombatContext 返回值正确委托
 * - 使用 createTestPinia 激活 Pinia（mock 的 store 需要在 Pinia 上下文中）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';

// ==================== 6 个外部 Store mock stub ====================
const characterStub = {
  name: '英雄',
  classId: 'warrior',
  hp: 100,
  maxHp: 200,
  attributes: { str: 10, dex: 8, con: 12, int: 5, wis: 6, cha: 7 },
  effectiveStats: { str: 15, dex: 10, con: 14, int: 5, wis: 6, cha: 7 },
  takeDamage: vi.fn().mockResolvedValue(undefined),
  gainExp: vi.fn().mockResolvedValue(undefined),
  gainGold: vi.fn().mockResolvedValue(undefined),
  handleDeath: vi.fn().mockResolvedValue(undefined),
  receiveHeal: vi.fn().mockResolvedValue(undefined),
  changeMp: vi.fn().mockResolvedValue(undefined),
};

const skillStub = {
  castSkill: vi.fn().mockResolvedValue({ success: true, used: true }),
  getSkill: vi.fn().mockReturnValue(null),
  tickCooldowns: vi.fn(),
  resetCooldowns: vi.fn(),
};

const enemyStub = {
  getEnemyById: vi.fn().mockReturnValue(null),
  deleteEnemy: vi.fn(),
  takeDamage: vi.fn().mockReturnValue(true),
  createEnemy: vi.fn().mockResolvedValue(null),
  getAvailableSkills: vi.fn().mockReturnValue([]),
  useSkill: vi.fn().mockReturnValue({ success: true, damage: 10, isHeal: false }),
  calculateDamage: vi.fn().mockReturnValue(5),
  tickCooldowns: vi.fn(),
};

const questStub = {
  onEnemyKilled: vi.fn().mockResolvedValue(undefined),
};

const logStub = {
  addLogEntry: vi.fn().mockResolvedValue(undefined),
};

const inventoryStub = {
  useItem: vi.fn().mockResolvedValue(true),
  getItemInfo: vi.fn().mockReturnValue(null),
  addItem: vi.fn().mockReturnValue(1),
};

vi.mock('@/modules/character/store', () => ({ useCharacterStore: () => characterStub }));
vi.mock('@/modules/skill/store', () => ({ useSkillStore: () => skillStub }));
vi.mock('@/modules/enemy/store', () => ({ useEnemyStore: () => enemyStub }));
vi.mock('@/modules/quest/store', () => ({ useQuestStore: () => questStub }));
vi.mock('@/modules/log/store', () => ({ useLogStore: () => logStub }));
vi.mock('@/modules/inventory/store', () => ({ useInventoryStore: () => inventoryStub }));

import { createCombatContext } from '@/modules/combat/combatContext';

describe('combatContext - 战斗上下文工厂（A2 读写分离）', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  // -------------------- 结构完整性 --------------------
  describe('createCombatContext 返回值结构', () => {
    it('返回包含 6 个域的对象', () => {
      const ctx = createCombatContext();
      expect(ctx).toHaveProperty('character');
      expect(ctx).toHaveProperty('skill');
      expect(ctx).toHaveProperty('enemy');
      expect(ctx).toHaveProperty('quest');
      expect(ctx).toHaveProperty('log');
      expect(ctx).toHaveProperty('inventory');
    });

    it('character 域包含 6 个只读属性 + 6 个写入方法', () => {
      const ctx = createCombatContext();
      const char = ctx.character;
      // 只读属性
      expect(char.name).toBe('英雄');
      expect(char.classId).toBe('warrior');
      expect(char.hp).toBe(100);
      expect(char.maxHp).toBe(200);
      expect(char.attributes).toEqual(characterStub.attributes);
      expect(char.effectiveStats).toEqual(characterStub.effectiveStats);
      // 写入方法
      expect(typeof char.takeDamage).toBe('function');
      expect(typeof char.gainExp).toBe('function');
      expect(typeof char.gainGold).toBe('function');
      expect(typeof char.handleDeath).toBe('function');
      expect(typeof char.receiveHeal).toBe('function');
      expect(typeof char.changeMp).toBe('function');
    });

    it('skill 域包含 1 个查询 + 3 个写入方法', () => {
      const ctx = createCombatContext();
      expect(typeof ctx.skill.getSkill).toBe('function');
      expect(typeof ctx.skill.castSkill).toBe('function');
      expect(typeof ctx.skill.tickCooldowns).toBe('function');
      expect(typeof ctx.skill.resetCooldowns).toBe('function');
    });

    it('enemy 域包含 3 个查询 + 5 个写入方法', () => {
      const ctx = createCombatContext();
      expect(typeof ctx.enemy.getEnemyById).toBe('function');
      expect(typeof ctx.enemy.getAvailableSkills).toBe('function');
      expect(typeof ctx.enemy.calculateDamage).toBe('function');
      expect(typeof ctx.enemy.deleteEnemy).toBe('function');
      expect(typeof ctx.enemy.takeDamage).toBe('function');
      expect(typeof ctx.enemy.createEnemy).toBe('function');
      expect(typeof ctx.enemy.useSkill).toBe('function');
      expect(typeof ctx.enemy.tickCooldowns).toBe('function');
    });

    it('quest / log / inventory 域各包含预期方法', () => {
      const ctx = createCombatContext();
      expect(typeof ctx.quest.onEnemyKilled).toBe('function');
      expect(typeof ctx.log.addLogEntry).toBe('function');
      expect(typeof ctx.inventory.useItem).toBe('function');
      expect(typeof ctx.inventory.getItemInfo).toBe('function');
      expect(typeof ctx.inventory.addItem).toBe('function');
    });
  });

  // -------------------- 只读属性委托（ICombatQuery） --------------------
  describe('只读属性委托到 characterStore', () => {
    it('character.name 通过 getter 代理到 characterStore.name', () => {
      const ctx = createCombatContext();
      expect(ctx.character.name).toBe(characterStub.name);
    });

    it('character.hp 通过 getter 代理到 characterStore.hp', () => {
      const ctx = createCombatContext();
      expect(ctx.character.hp).toBe(characterStub.hp);
    });

    it('character.attributes 代理到 characterStore.attributes（引用一致）', () => {
      const ctx = createCombatContext();
      expect(ctx.character.attributes).toBe(characterStub.attributes);
    });

    it('character.effectiveStats 代理到 characterStore.effectiveStats（引用一致）', () => {
      const ctx = createCombatContext();
      expect(ctx.character.effectiveStats).toBe(characterStub.effectiveStats);
    });

    it('skill.getSkill 委托到 skillStore.getSkill 并透传参数', () => {
      const ctx = createCombatContext();
      ctx.skill.getSkill('fireball');
      expect(skillStub.getSkill).toHaveBeenCalledWith('fireball');
    });

    it('enemy.getEnemyById 委托到 enemyStore.getEnemyById 并透传参数', () => {
      const ctx = createCombatContext();
      ctx.enemy.getEnemyById('goblin-1');
      expect(enemyStub.getEnemyById).toHaveBeenCalledWith('goblin-1');
    });

    it('enemy.calculateDamage 委托到 enemyStore.calculateDamage 并透传参数', () => {
      const ctx = createCombatContext();
      const enemy = { id: 'e1', name: '哥布林', hp: 50, maxHp: 50, attack: 10, defense: 2, speed: 5, level: 1, isBoss: false, dataId: 'goblin', buffs: [], debuffs: [], skillCooldowns: {} } as never;
      ctx.enemy.calculateDamage(enemy, 10);
      expect(enemyStub.calculateDamage).toHaveBeenCalledWith(enemy, 10);
    });

    it('enemy.getAvailableSkills 委托到 enemyStore.getAvailableSkills 并透传参数', () => {
      // 覆盖 combatContext.ts 第 183 行：getAvailableSkills 代理
      const ctx = createCombatContext();
      ctx.enemy.getAvailableSkills('enemy-1');
      expect(enemyStub.getAvailableSkills).toHaveBeenCalledWith('enemy-1');
    });

    it('inventory.getItemInfo 委托到 inventoryStore.getItemInfo 并透传参数', () => {
      const ctx = createCombatContext();
      ctx.inventory.getItemInfo('potion-1');
      expect(inventoryStub.getItemInfo).toHaveBeenCalledWith('potion-1');
    });
  });

  // -------------------- 写入方法委托（ICombatCommand） --------------------
  describe('写入方法委托到对应 Store', () => {
    it('character.takeDamage 委托到 characterStore.takeDamage', async () => {
      const ctx = createCombatContext();
      await ctx.character.takeDamage(30);
      expect(characterStub.takeDamage).toHaveBeenCalledWith(30);
    });

    it('character.gainExp 委托到 characterStore.gainExp', async () => {
      const ctx = createCombatContext();
      await ctx.character.gainExp(150);
      expect(characterStub.gainExp).toHaveBeenCalledWith(150);
    });

    it('character.receiveHeal 委托到 characterStore.receiveHeal', async () => {
      const ctx = createCombatContext();
      await ctx.character.receiveHeal(20);
      expect(characterStub.receiveHeal).toHaveBeenCalledWith(20);
    });

    it('character.changeMp 委托到 characterStore.changeMp', async () => {
      const ctx = createCombatContext();
      await ctx.character.changeMp(-10);
      expect(characterStub.changeMp).toHaveBeenCalledWith(-10);
    });

    it('skill.castSkill 委托到 skillStore.castSkill 并透传可选参数', async () => {
      const ctx = createCombatContext();
      await ctx.skill.castSkill('fireball', true);
      expect(skillStub.castSkill).toHaveBeenCalledWith('fireball', true, undefined);
    });

    it('skill.tickCooldowns / resetCooldowns 委托到 skillStore', () => {
      const ctx = createCombatContext();
      ctx.skill.tickCooldowns();
      ctx.skill.resetCooldowns();
      expect(skillStub.tickCooldowns).toHaveBeenCalledTimes(1);
      expect(skillStub.resetCooldowns).toHaveBeenCalledTimes(1);
    });

    it('enemy.deleteEnemy / takeDamage 委托到 enemyStore', () => {
      const ctx = createCombatContext();
      ctx.enemy.deleteEnemy('e1');
      ctx.enemy.takeDamage('e1', 50);
      expect(enemyStub.deleteEnemy).toHaveBeenCalledWith('e1');
      expect(enemyStub.takeDamage).toHaveBeenCalledWith('e1', 50);
    });

    it('enemy.createEnemy 委托到 enemyStore.createEnemy 并返回 Promise', async () => {
      const ctx = createCombatContext();
      await ctx.enemy.createEnemy('goblin', 3);
      expect(enemyStub.createEnemy).toHaveBeenCalledWith('goblin', 3);
    });

    it('enemy.useSkill 委托到 enemyStore.useSkill 并透传参数', () => {
      const ctx = createCombatContext();
      ctx.enemy.useSkill('e1', 'bite');
      expect(enemyStub.useSkill).toHaveBeenCalledWith('e1', 'bite');
    });

    it('enemy.tickCooldowns 委托到 enemyStore.tickCooldowns 并透传可选参数', () => {
      const ctx = createCombatContext();
      ctx.enemy.tickCooldowns('e1');
      expect(enemyStub.tickCooldowns).toHaveBeenCalledWith('e1');
      ctx.enemy.tickCooldowns();
      expect(enemyStub.tickCooldowns).toHaveBeenCalledWith(undefined);
    });

    it('quest.onEnemyKilled 委托到 questStore.onEnemyKilled', async () => {
      const ctx = createCombatContext();
      await ctx.quest.onEnemyKilled('boss-1');
      expect(questStub.onEnemyKilled).toHaveBeenCalledWith('boss-1');
    });

    it('log.addLogEntry 委托到 logStore.addLogEntry 并透传 entry', async () => {
      const ctx = createCombatContext();
      const entry = { id: 'log-1', timestamp: Date.now(), type: 'combat', message: '战斗开始', icon: 'sword' } as never;
      await ctx.log.addLogEntry(entry);
      expect(logStub.addLogEntry).toHaveBeenCalledWith(entry);
    });

    it('inventory.useItem 委托到 inventoryStore.useItem', async () => {
      const ctx = createCombatContext();
      await ctx.inventory.useItem('potion-1');
      expect(inventoryStub.useItem).toHaveBeenCalledWith('potion-1');
    });

    it('inventory.addItem 委托到 inventoryStore.addItem 并返回数量', () => {
      const ctx = createCombatContext();
      const result = ctx.inventory.addItem('potion-1', 5);
      expect(inventoryStub.addItem).toHaveBeenCalledWith('potion-1', 5);
      expect(result).toBe(1);
    });
  });
});
