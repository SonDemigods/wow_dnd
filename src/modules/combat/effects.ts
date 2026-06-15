/**
 * @fileoverview Buff/Debuff 状态效果系统
 * @description 纯函数式设计，支持持续回合、衰减、堆叠等机制
 */

/** 效果类型 */
export type EffectType =
  | 'poison'       // 中毒：每回合扣血
  | 'burn'         // 灼烧：每回合扣血（比毒强）
  | 'stun'         // 眩晕：跳过回合
  | 'freeze'       // 冰冻：跳过回合+减速
  | 'silence'      // 沉默：无法使用技能
  | 'shield'       // 护盾：吸收伤害
  | 'attack_up'    // 攻击上升
  | 'attack_down'  // 攻击下降
  | 'defense_up'   // 防御上升
  | 'defense_down' // 防御下降
  | 'speed_up'     // 速度上升
  | 'speed_down'   // 速度下降
  | 'regen'        // 恢复：每回合回血
  | 'thorn'        // 荆棘：受到攻击时反弹伤害
  | 'vulnerable';  // 易伤：受到的伤害增加

/** 单个效果实例 */
export interface Effect {
  id: string;
  type: EffectType;
  /** 剩余持续回合数 */
  remainingTurns: number;
  /** 效果数值（伤害/护盾量/属性变化值） */
  value: number;
  /** 来源类型 */
  source: 'skill' | 'item' | 'enemy' | 'passive';
  /** 来源名称 */
  sourceName: string;
}

/** 效果容器（每个单位可拥有多个效果） */
export interface EffectContainer {
  effects: Effect[];
}

/** 属性修改器 */
export interface StatModifiers {
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
  speed: number;
  critChance: number;
  dodgeChance: number;
  damageMultiplier: number;
  healingMultiplier: number;
}

/**
 * 创建空属性修改器
 */
export function createEmptyModifiers(): StatModifiers {
  return {
    physicalAttack: 0,
    physicalDefense: 0,
    magicAttack: 0,
    magicDefense: 0,
    speed: 0,
    critChance: 0,
    dodgeChance: 0,
    damageMultiplier: 1,
    healingMultiplier: 1,
  };
}

/**
 * 为容器添加效果
 */
export function addEffect(container: EffectContainer, effect: Effect): void {
  const existing = container.effects.find(e => e.type === effect.type);
  if (existing) {
    // 刷新持续时间和数值（取最大值）
    existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
    existing.value = Math.max(existing.value, effect.value);
  } else {
    container.effects.push({ ...effect });
  }
}

/**
 * 推进所有效果（回合结束时调用），返回过期的效果ID列表和持续伤害总量
 */
export function tickEffects(container: EffectContainer): { expiredIds: string[]; dotDamage: number; regenAmount: number } {
  const expiredIds: string[] = [];
  let dotDamage = 0;
  let regenAmount = 0;

  for (const effect of container.effects) {
    effect.remainingTurns--;

    // 持续伤害效果
    if (effect.type === 'poison') {
      dotDamage += effect.value;
    } else if (effect.type === 'burn') {
      dotDamage += Math.round(effect.value * 1.5);
    }

    // 恢复效果
    if (effect.type === 'regen') {
      regenAmount += effect.value;
    }

    if (effect.remainingTurns <= 0) {
      expiredIds.push(effect.id);
    }
  }

  // 清理过期效果
  container.effects = container.effects.filter(e => e.remainingTurns > 0);

  return { expiredIds, dotDamage, regenAmount };
}

/**
 * 计算效果带来的伤害减免（护盾吸收）
 */
export function applyShield(container: EffectContainer, incomingDamage: number): { actualDamage: number; absorbed: number } {
  let absorbed = 0;
  let remainingDamage = incomingDamage;
  for (const effect of container.effects) {
    if (effect.type === 'shield' && effect.value > 0) {
      const absorb = Math.min(remainingDamage, effect.value);
      absorbed += absorb;
      remainingDamage -= absorb;
      effect.value -= absorb;
    }
  }
  return { actualDamage: remainingDamage, absorbed };
}

/**
 * 计算属性修正（叠加所有效果）
 */
export function getStatModifiers(container: EffectContainer): StatModifiers {
  const mods = createEmptyModifiers();
  for (const effect of container.effects) {
    switch (effect.type) {
      case 'attack_up': mods.physicalAttack += effect.value; mods.magicAttack += effect.value; break;
      case 'attack_down': mods.physicalAttack -= effect.value; mods.magicAttack -= effect.value; break;
      case 'defense_up': mods.physicalDefense += effect.value; mods.magicDefense += effect.value; break;
      case 'defense_down': mods.physicalDefense -= effect.value; mods.magicDefense -= effect.value; break;
      case 'speed_up': mods.speed += effect.value; break;
      case 'speed_down': mods.speed -= effect.value; break;
      case 'vulnerable': mods.damageMultiplier += effect.value * 0.01; break;
    }
  }
  return mods;
}

/**
 * 检查是否被控制（眩晕/冰冻）
 */
export function isDisabled(container: EffectContainer): { skipTurn: boolean; types: ('attack' | 'skill' | 'flee')[] } {
  const types: ('attack' | 'skill' | 'flee')[] = [];
  for (const effect of container.effects) {
    if (effect.type === 'stun' || effect.type === 'freeze') {
      return { skipTurn: true, types: ['attack', 'skill', 'flee'] };
    }
    if (effect.type === 'silence') {
      types.push('skill');
    }
  }
  return { skipTurn: false, types };
}

/**
 * 计算荆棘反伤
 */
export function getThornDamage(container: EffectContainer, incomingDamage: number): number {
  let thorns = 0;
  for (const effect of container.effects) {
    if (effect.type === 'thorn') {
      thorns += Math.round(incomingDamage * effect.value);
    }
  }
  return thorns;
}

/**
 * 生成唯一效果 ID
 */
let effectIdCounter = 0;
export function generateEffectId(): string {
  return `effect_${Date.now()}_${++effectIdCounter}`;
}
