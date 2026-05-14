
/**
 * Utility functions
 */

/**
 * Roll D20 dice
 * @returns {number} Random 1-20
 */
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Roll dice with range
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {number} Random between min-max
 */
function rollDice(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate combat attributes from base stats
 * @param {Object} stats - Base stats {str, dex, con, int, wis, cha}
 * @returns {Object} Calculated attributes
 */
function calculateAllAttributes(stats) {
  const str = stats.str || 10;
  const dex = stats.dex || 10;
  const con = stats.con || 10;
  const int = stats.int || 10;
  const wis = stats.wis || 10;
  const cha = stats.cha || 10;

  const strMod = Math.floor((str - 10) / 2);
  const dexMod = Math.floor((dex - 10) / 2);
  const conMod = Math.floor((con - 10) / 2);
  const intMod = Math.floor((int - 10) / 2);
  const wisMod = Math.floor((wis - 10) / 2);
  const chaMod = Math.floor((cha - 10) / 2);

  return {
    maxHp: 50 + con * 3 + conMod * 5,
    maxMana: 20 + int * 2 + intMod * 5,
    physicalAttack: strMod + 2,
    physicalDefense: dexMod + 2,
    magicAttack: intMod + 2,
    magicDefense: wisMod + 2,
    healBonus: wisMod + 2,
    critChance: Math.max(5, 5 + dexMod * 2),
    dodgeChance: Math.max(5, 5 + dexMod * 3),
    initiative: dexMod
  };
}

/**
 * Get class abilities
 * @returns {Array} Abilities list
 */
function getClassAbilities() {
  const playerClass = GameState.character.class;
  if (playerClass && CLASS_ABILITIES[playerClass]) {
    return CLASS_ABILITIES[playerClass];
  }
  return CLASS_ABILITIES.mage;
}
