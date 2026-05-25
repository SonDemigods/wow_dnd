/**
 * 敌人模块类型定义
 */

/**
 * 敌人稀有度类型
 */
export type EnemyRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * 敌人类型
 */
export type EnemyType = 'monster' | 'boss' | 'elite';

/**
 * 敌人属性
 */
export interface EnemyStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

/**
 * 敌人数据接口
 */
export interface Enemy {
  id: string;
  name: string;
  type: EnemyType;
  rarity: EnemyRarity;
  level: number;
  stats: EnemyStats;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attackPower: number;
  defense: number;
  expReward: number;
  goldReward: number;
  skills: EnemySkill[];
  drops: EnemyDrop[];
  isBoss: boolean;
  description: string;
}

/**
 * 敌人技能
 */
export interface EnemySkill {
  id: string;
  name: string;
  description: string;
  damage: number;
  manaCost: number;
  cooldown: number;
  currentCooldown: number;
  isAoE: boolean;
  isHeal: boolean;
}

/**
 * 敌人掉落物品
 */
export interface EnemyDrop {
  itemId: string;
  dropRate: number;
  minAmount: number;
  maxAmount: number;
}

/**
 * 敌人列表项（用于显示）
 */
export interface EnemyListItem {
  id: string;
  name: string;
  type: EnemyType;
  rarity: EnemyRarity;
  level: number;
  maxHp: number;
  expReward: number;
  goldReward: number;
}

/**
 * 敌人服务接口
 */
export interface IEnemyService {
  generateEnemy(level: number, rarity?: EnemyRarity, isBoss?: boolean): Enemy;
  getEnemyById(enemyId: string): Enemy | null;
  getAllEnemies(): Enemy[];
  createEnemy(enemy: Omit<Enemy, 'id'>): string;
  updateEnemy(enemy: Enemy): void;
  deleteEnemy(enemyId: string): boolean;
  calculateDamage(enemy: Enemy, targetDefense: number): number;
  takeDamage(enemyId: string, damage: number): boolean;
  useSkill(enemyId: string, skillId: string): { success: boolean; damage: number };
  resetEnemy(enemyId: string): void;
}

/**
 * 敌人稀有度配置
 */
export const ENEMY_RARITY_CONFIG: Record<EnemyRarity, { multiplier: number; color: string; name: string }> = {
  common: { multiplier: 1.0, color: '#9d9d9d', name: '普通' },
  uncommon: { multiplier: 1.5, color: '#1eff00', name: '优秀' },
  rare: { multiplier: 2.0, color: '#0070dd', name: '稀有' },
  epic: { multiplier: 3.0, color: '#a335ee', name: '史诗' },
  legendary: { multiplier: 5.0, color: '#ff8000', name: '传说' }
};

/**
 * 敌人类型配置
 */
export const ENEMY_TYPE_CONFIG: Record<EnemyType, { name: string; icon: string }> = {
  monster: { name: '怪物', icon: '👹' },
  boss: { name: 'Boss', icon: '👿' },
  elite: { name: '精英', icon: '⚔️' }
};