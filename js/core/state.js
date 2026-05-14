
/**
 * Game State Management Module
 * Manages core game state, save/load functionality
 */

const GameState = {
  character: {
    name: '冒险者',
    race: null,
    class: null,
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    stats: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },
    gold: 50
  },
  inventory: [],
  quests: [],
  currentQuest: null,
  location: 'stormwind',
  mapStates: {},
  adventureLog: [],

  save() {
    const saveData = {
      character: this.character,
      inventory: this.inventory,
      quests: this.quests,
      currentQuest: this.currentQuest,
      location: this.location,
      mapStates: this.mapStates,
      adventureLog: this.adventureLog
    };
    localStorage.setItem('wowGameState', JSON.stringify(saveData));
  },

  load() {
    const saved = localStorage.getItem('wowGameState');
    if (saved) {
      const data = JSON.parse(saved);
      this.character = data.character;
      this.inventory = data.inventory;
      this.quests = data.quests;
      this.currentQuest = data.currentQuest;
      this.location = data.location;
      this.mapStates = data.mapStates || {};
      this.adventureLog = data.adventureLog || [];
      return true;
    }
    return false;
  },

  reset() {
    this.character = {
      name: '冒险者',
      race: null,
      class: null,
      level: 1,
      exp: 0,
      expToNextLevel: 100,
      hp: 100,
      maxHp: 100,
      mana: 50,
      maxMana: 50,
      stats: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
      },
      gold: 50
    };
    this.inventory = [];
    this.quests = [];
    this.currentQuest = null;
    this.location = 'stormwind';
    this.mapStates = {};
    this.adventureLog = [];
    localStorage.removeItem('wowGameState');
  }
};

const combatState = {
  active: false,
  enemy: null,
  enemyHp: 0,
  enemyMaxHp: 0,
  playerTurn: true,
  combatEnded: false,
  shieldActive: false
};

let selectedInventorySlot = null;
