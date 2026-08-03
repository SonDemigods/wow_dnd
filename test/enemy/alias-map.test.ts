/**
 * @fileoverview 怪物 ID 别名映射层单元测试（P3-137）
 *
 * 覆盖 alias-map.ts 的：
 * 1. resolveEnemyId：旧 ID → 新 ID 转换（全映射覆盖）
 * 2. resolveEnemyId：新 ID / 未知 ID 原样返回
 * 3. isLegacyEnemyId：旧 ID 判定为 true，新 ID / 未知 ID 为 false
 * 4. 映射表完整性：所有旧 ID 均有映射，新 ID 不在 key 中（无双向映射）
 */
import { describe, it, expect } from 'vitest';
import { ENEMY_ID_ALIAS, resolveEnemyId, isLegacyEnemyId } from '@/modules/enemy/alias-map';

describe('enemy/alias-map - 怪物 ID 别名映射层', () => {
  describe('resolveEnemyId - 旧 ID 转换为新 ID', () => {
    it('阶段 1：冲突类 ID 正确映射', () => {
      expect(resolveEnemyId('orc')).toBe('mob_orc_grunt');
      expect(resolveEnemyId('undead')).toBe('mob_undead');
      expect(resolveEnemyId('troll')).toBe('mob_jungle_troll');
      expect(resolveEnemyId('dark_iron_dwarf')).toBe('mob_dark_iron_dwarf');
    });

    it('阶段 2：歧义类 ID 正确映射', () => {
      expect(resolveEnemyId('spider')).toBe('mob_poison_spider');
      expect(resolveEnemyId('bandit')).toBe('mob_shadow_bandit');
      expect(resolveEnemyId('wolf')).toBe('mob_gray_wolf');
      expect(resolveEnemyId('bear')).toBe('mob_brown_bear');
      expect(resolveEnemyId('dragon')).toBe('mob_young_dragon');
      expect(resolveEnemyId('demon')).toBe('boss_abyss_guard');
    });

    it('阶段 3：规范化类普通怪 ID 正确映射', () => {
      expect(resolveEnemyId('gnoll')).toBe('mob_gnoll');
      expect(resolveEnemyId('kobold')).toBe('mob_kobold');
      expect(resolveEnemyId('murloc')).toBe('mob_murloc');
      expect(resolveEnemyId('skeleton')).toBe('mob_skeleton');
      expect(resolveEnemyId('ghoul')).toBe('mob_ghoul');
      expect(resolveEnemyId('iron_dwarf')).toBe('mob_iron_dwarf');
      expect(resolveEnemyId('elemental')).toBe('mob_elemental');
      expect(resolveEnemyId('nerubian')).toBe('mob_nerubian');
      expect(resolveEnemyId('vrykul')).toBe('mob_vrykul');
      expect(resolveEnemyId('boar')).toBe('mob_boar');
      expect(resolveEnemyId('centaur')).toBe('mob_centaur');
      expect(resolveEnemyId('harpy')).toBe('mob_harpy');
      expect(resolveEnemyId('naga')).toBe('mob_naga');
      expect(resolveEnemyId('ogre')).toBe('mob_ogre');
      expect(resolveEnemyId('quilboar')).toBe('mob_quilboar');
      expect(resolveEnemyId('scorpid')).toBe('mob_scorpid');
      expect(resolveEnemyId('silithid')).toBe('mob_silithid');
      expect(resolveEnemyId('tiger')).toBe('mob_tiger');
      expect(resolveEnemyId('imp')).toBe('mob_imp');
    });

    it('阶段 3：规范化类 Boss ID 正确映射', () => {
      expect(resolveEnemyId('dragon_whelp')).toBe('boss_dragon_whelp');
      expect(resolveEnemyId('frost_wyrm')).toBe('boss_frost_wyrm');
      expect(resolveEnemyId('undead_knight')).toBe('boss_undead_knight');
      expect(resolveEnemyId('lich')).toBe('boss_lich');
      expect(resolveEnemyId('frost_giant')).toBe('boss_frost_giant');
    });
  });

  describe('resolveEnemyId - 新 ID / 未知 ID 原样返回', () => {
    it('新 ID（已含 mob_ 前缀）原样返回', () => {
      expect(resolveEnemyId('mob_gnoll')).toBe('mob_gnoll');
      expect(resolveEnemyId('mob_orc_grunt')).toBe('mob_orc_grunt');
      expect(resolveEnemyId('mob_young_dragon')).toBe('mob_young_dragon');
    });

    it('新 ID（已含 boss_ 前缀）原样返回', () => {
      expect(resolveEnemyId('boss_dragon_whelp')).toBe('boss_dragon_whelp');
      expect(resolveEnemyId('boss_abyss_guard')).toBe('boss_abyss_guard');
      expect(resolveEnemyId('boss_lich')).toBe('boss_lich');
    });

    it('未知 ID 原样返回', () => {
      expect(resolveEnemyId('unknown_enemy')).toBe('unknown_enemy');
      expect(resolveEnemyId('')).toBe('');
    });
  });

  describe('isLegacyEnemyId - 旧 ID 判定', () => {
    it('旧 ID 返回 true', () => {
      expect(isLegacyEnemyId('orc')).toBe(true);
      expect(isLegacyEnemyId('dragon')).toBe(true);
      expect(isLegacyEnemyId('gnoll')).toBe(true);
      expect(isLegacyEnemyId('demon')).toBe(true);
      expect(isLegacyEnemyId('lich')).toBe(true);
    });

    it('新 ID 返回 false', () => {
      expect(isLegacyEnemyId('mob_gnoll')).toBe(false);
      expect(isLegacyEnemyId('boss_lich')).toBe(false);
      expect(isLegacyEnemyId('mob_orc_grunt')).toBe(false);
    });

    it('未知 ID 返回 false', () => {
      expect(isLegacyEnemyId('unknown_enemy')).toBe(false);
    });
  });

  describe('映射表完整性', () => {
    it('所有映射值（新 ID）均不含在 key 集合中（无双向映射）', () => {
      const keys = new Set(Object.keys(ENEMY_ID_ALIAS));
      const values = Object.values(ENEMY_ID_ALIAS);
      for (const v of values) {
        expect(keys.has(v)).toBe(false);
      }
    });

    it('所有映射值均以 mob_ 或 boss_ 前缀开头', () => {
      const values = Object.values(ENEMY_ID_ALIAS);
      for (const v of values) {
        expect(v.startsWith('mob_') || v.startsWith('boss_')).toBe(true);
      }
    });

    it('映射表条目数覆盖全部旧 ID（35 个）', () => {
      // 29 个普通怪物 - 1 个孤儿(gnoll_raider) + 6 个 Boss = 34
      // gnoll_raider 已删除，不参与映射
      expect(Object.keys(ENEMY_ID_ALIAS).length).toBe(34);
    });
  });
});
