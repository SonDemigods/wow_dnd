# World of Warcraft D&D Adventure Game Implementation Plan

**Goal:** Create a single-page web-based D&D adventure game set in the World of Warcraft universe with turn-based combat, character progression, and quests.

**Architecture:** Single HTML file with embedded CSS and JavaScript, using localStorage for character persistence. No backend required - all game state managed client-side.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6+), Canvas for visual effects

---

## Design Direction

**Aesthetic:** WoW Classic meets Dark Fantasy Tabletop
- Color palette: Deep midnight blues (#0a1628), rich golds (#c9aa71), blood reds (#8b0000), arcane purples (#6b3fa0)
- UI style: Beveled metallic panels, gem accents, runed borders, parchment textures
- Atmospheric effects: Floating embers, mystical particle glows, dramatic shadows
- Typography: Cinzel (display) + Crimson Text (body) - medieval/fantasy feel

---

## File Structure

All code in single file:
- `index.html` - Complete game (HTML, CSS, JavaScript embedded)

---

## Task Breakdown

### Task 1: HTML Structure & Core CSS Framework

**Create:** `index.html` with complete HTML skeleton

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>艾泽拉斯冒险 - World of Warcraft D&D</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:wght@400;600&display=swap" rel="stylesheet">
    <style>
        /* CSS Variables & Base Styles */
        :root {
            --bg-primary: #0a1628;
            --bg-secondary: #152238;
            --bg-panel: linear-gradient(180deg, #1a3050 0%, #0d1a2a 100%);
            --gold-primary: #c9aa71;
            --gold-bright: #ffd700;
            --gold-dark: #8b7355;
            --red-blood: #8b0000;
            --purple-arcane: #6b3fa0;
            --text-light: #e8dcc4;
            --text-muted: #8a9aaa;
            --border-gold: 2px solid #c9aa71;
            --shadow-glow: 0 0 20px rgba(201, 170, 113, 0.3);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Crimson Text', serif;
            background: var(--bg-primary);
            color: var(--text-light);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        /* Particle Canvas */
        #particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        }
        
        /* Main Container */
        .game-container {
            position: relative;
            z-index: 2;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            min-height: 100vh;
        }
        
        /* Panel Component */
        .panel {
            background: var(--bg-panel);
            border: var(--border-gold);
            border-radius: 8px;
            box-shadow: var(--shadow-glow), inset 0 1px 0 rgba(255,255,255,0.1);
            position: relative;
        }
        
        .panel::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--gold-primary), transparent);
        }
        
        .panel-header {
            font-family: 'Cinzel', serif;
            color: var(--gold-primary);
            font-size: 1.2rem;
            padding: 15px 20px;
            border-bottom: 1px solid rgba(201, 170, 113, 0.3);
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        
        /* Navigation Tabs */
        .nav-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .nav-tab {
            font-family: 'Cinzel', serif;
            background: var(--bg-panel);
            border: var(--border-gold);
            color: var(--gold-primary);
            padding: 12px 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            border-radius: 4px;
        }
        
        .nav-tab:hover, .nav-tab.active {
            background: linear-gradient(180deg, #2a4060 0%, #1a3050 100%);
            box-shadow: var(--shadow-glow);
            transform: translateY(-2px);
        }
        
        .nav-tab.active {
            border-color: var(--gold-bright);
            color: var(--gold-bright);
        }
        
        /* Content Sections */
        .section {
            display: none;
        }
        
        .section.active {
            display: block;
            animation: fadeIn 0.4s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Character Stats */
        .stat-bar {
            height: 24px;
            background: rgba(0,0,0,0.5);
            border: 1px solid var(--gold-dark);
            border-radius: 12px;
            overflow: hidden;
            position: relative;
        }
        
        .stat-fill {
            height: 100%;
            transition: width 0.5s ease;
            border-radius: 12px;
        }
        
        .hp-fill { background: linear-gradient(90deg, #8b0000, #ff4444); }
        .mana-fill { background: linear-gradient(90deg, #1a237e, #448aff); }
        .xp-fill { background: linear-gradient(90deg, #c9aa71, #ffd700); }
        
        /* Combat Area */
        .combat-arena {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin: 20px 0;
        }
        
        .combatant {
            text-align: center;
            padding: 20px;
        }
        
        .combatant-avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 3px solid var(--gold-primary);
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            background: linear-gradient(135deg, #2a4060, #1a3050);
            box-shadow: 0 0 30px rgba(107, 63, 160, 0.4);
        }
        
        /* Buttons */
        .btn {
            font-family: 'Cinzel', serif;
            background: linear-gradient(180deg, #3a5a80 0%, #1a3a5a 100%);
            border: 2px solid var(--gold-primary);
            color: var(--gold-primary);
            padding: 12px 30px;
            cursor: pointer;
            transition: all 0.3s ease;
            border-radius: 4px;
            font-size: 1rem;
        }
        
        .btn:hover {
            background: linear-gradient(180deg, #4a6a90 0%, #2a4a6a 100%);
            box-shadow: var(--shadow-glow);
            transform: scale(1.05);
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-attack {
            background: linear-gradient(180deg, #8b0000 0%, #5a0000 100%);
        }
        
        .btn-magic {
            background: linear-gradient(180deg, #6b3fa0 0%, #3a1f5a 100%);
        }
        
        /* Selection Cards */
        .selection-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        
        .selection-card {
            background: var(--bg-panel);
            border: 2px solid var(--gold-dark);
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .selection-card:hover, .selection-card.selected {
            border-color: var(--gold-bright);
            box-shadow: var(--shadow-glow);
            transform: translateY(-5px);
        }
        
        .selection-card .icon {
            font-size: 3rem;
            margin-bottom: 10px;
        }
        
        .selection-card h3 {
            font-family: 'Cinzel', serif;
            color: var(--gold-primary);
            margin-bottom: 10px;
        }
        
        /* Inventory Grid */
        .inventory-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
            gap: 8px;
            padding: 15px;
        }
        
        .inventory-slot {
            width: 60px;
            height: 60px;
            background: rgba(0,0,0,0.4);
            border: 1px solid var(--gold-dark);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .inventory-slot:hover {
            border-color: var(--gold-primary);
            background: rgba(201, 170, 113, 0.1);
        }
        
        /* Combat Log */
        .combat-log {
            height: 200px;
            overflow-y: auto;
            padding: 15px;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--gold-dark);
            border-radius: 4px;
            font-size: 0.9rem;
        }
        
        .combat-log p {
            margin: 5px 0;
            padding: 5px;
            border-left: 3px solid var(--gold-dark);
        }
        
        .log-damage { border-color: #ff4444; }
        .log-heal { border-color: #44ff44; }
        .log-magic { border-color: #8844ff; }
        .log-system { border-color: var(--gold-primary); }
        
        /* Responsive */
        @media (max-width: 768px) {
            .combat-arena {
                grid-template-columns: 1fr;
            }
            
            .selection-grid {
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            }
            
            .nav-tab {
                padding: 10px 15px;
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <canvas id="particles"></canvas>
    
    <div class="game-container">
        <header class="panel" style="text-align: center; margin-bottom: 20px; padding: 20px;">
            <h1 style="font-family: 'Cinzel', serif; color: var(--gold-primary); font-size: 2.5rem; text-shadow: 0 0 20px rgba(201,170,113,0.5);">
                ⚔️ 艾泽拉斯冒险 ⚔️
            </h1>
            <p style="color: var(--text-muted); font-style: italic;">
                World of Warcraft D&D Adventure
            </p>
        </header>
        
        <!-- Navigation -->
        <nav class="nav-tabs">
            <button class="nav-tab active" data-section="character">角色</button>
            <button class="nav-tab" data-section="combat">战斗</button>
            <button class="nav-tab" data-section="quests">任务</button>
            <button class="nav-tab" data-section="inventory">背包</button>
            <button class="nav-tab" data-section="map">世界</button>
        </nav>
        
        <!-- Character Creation Section -->
        <section id="character" class="section active">
            <!-- Character creation steps will go here -->
        </section>
        
        <!-- Combat Section -->
        <section id="combat" class="section">
            <!-- Combat system will go here -->
        </section>
        
        <!-- Quests Section -->
        <section id="quests" class="section">
            <!-- Quest system will go here -->
        </section>
        
        <!-- Inventory Section -->
        <section id="inventory" class="section">
            <!-- Inventory system will go here -->
        </section>
        
        <!-- Map Section -->
        <section id="map" class="section">
            <!-- World map and locations will go here -->
        </section>
    </div>
    
    <script>
        // Game Logic JavaScript
    </script>
</body>
</html>
```

- [ ] **Step 2: Test HTML loads correctly**

Run: Open `index.html` in browser
Expected: Page displays with navigation tabs and header

- [ ] **Step 3: Verify CSS styling**

Expected: Dark fantasy theme with gold accents visible

---

### Task 2: Particle System & Visual Effects

**Modify:** `index.html` - Add particle canvas animation

Add JavaScript:
```javascript
// Particle System
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticle(type = 'ember') {
        const p = {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height + 10,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -Math.random() * 1.5 - 0.5,
            size: Math.random() * 3 + 1,
            life: 1,
            decay: Math.random() * 0.005 + 0.002,
            type
        };
        this.particles.push(p);
    }
    
    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Ambient embers
        if (Math.random() < 0.1) this.createParticle('ember');
        
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            
            if (p.life > 0) {
                const alpha = p.life * 0.6;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                
                if (p.type === 'ember') {
                    this.ctx.fillStyle = `rgba(201, 170, 113, ${alpha})`;
                } else if (p.type === 'magic') {
                    this.ctx.fillStyle = `rgba(107, 63, 160, ${alpha})`;
                }
                
                this.ctx.fill();
                return true;
            }
            return false;
        });
        
        requestAnimationFrame(() => this.update());
    }
}

// Initialize
const particleCanvas = document.getElementById('particles');
const particles = new ParticleSystem(particleCanvas);
particles.update();
```

- [ ] **Step 1: Add particle system code**

- [ ] **Step 2: Test floating ember particles**

Expected: Golden particles float upward across the screen

---

### Task 3: Game State Management

**Modify:** `index.html` - Add complete game state management

Add JavaScript:
```javascript
// Game State
const GameState = {
    character: null,
    inventory: [],
    quests: [],
    currentQuest: null,
    combatState: null,
    location: 'stormwind',
    
    save() {
        localStorage.setItem('warcraft_dnd_save', JSON.stringify({
            character: this.character,
            inventory: this.inventory,
            quests: this.quests,
            location: this.location
        }));
    },
    
    load() {
        const save = localStorage.getItem('warcraft_dnd_save');
        if (save) {
            const data = JSON.parse(save);
            this.character = data.character;
            this.inventory = data.inventory || [];
            this.quests = data.quests || [];
            this.location = data.location || 'stormwind';
            return true;
        }
        return false;
    },
    
    reset() {
        localStorage.removeItem('warcraft_dnd_save');
        this.character = null;
        this.inventory = [];
        this.quests = [];
        this.combatState = null;
        this.location = 'stormwind';
    }
};

// Races Data
const RACES = {
    human: {
        name: '人类',
        icon: '🧑',
        bonus: { str: 1, cha: 1 },
        description: '艾泽拉斯最多才多艺的种族'
    },
    orc: {
        name: '兽人',
        icon: '👹',
        bonus: { str: 2, con: 1 },
        description: '荣耀与力量的战歌之子'
    },
    nightelf: {
        name: '夜精灵',
        icon: '🧝',
        bonus: { dex: 2, wis: 1 },
        description: '永生的暗夜守望者'
    },
    dwarf: {
        name: '矮人',
        icon: '🧔',
        bonus: { con: 2, wis: 1 },
        description: '山丘之王，锻炉大师'
    },
    undead: {
        name: '亡灵',
        icon: '💀',
        bonus: { int: 2, dex: 1 },
        description: '被遗忘者的复仇者'
    },
    bloodelves: {
        name: '血精灵',
        icon: '🧝‍♀️',
        bonus: { int: 2, cha: 1 },
        description: '魔法与优雅的追寻者'
    }
};

// Classes Data
const CLASSES = {
    warrior: {
        name: '战士',
        icon: '⚔️',
        hitDie: 12,
        primaryStat: 'str',
        abilities: ['重击', '盾墙', '横扫'],
        description: '战场上的钢铁堡垒'
    },
    mage: {
        name: '法师',
        icon: '🔮',
        hitDie: 6,
        primaryStat: 'int',
        abilities: ['火球术', '冰霜新星', '奥术飞弹'],
        description: '掌控元素的神秘大师'
    },
    paladin: {
        name: '圣骑士',
        icon: '🛡️',
        hitDie: 10,
        primaryStat: 'cha',
        abilities: ['圣光术', '神圣制裁', '复仇之锤'],
        description: '圣光与力量的化身'
    },
    hunter: {
        name: '猎人',
        icon: '🏹',
        hitDie: 10,
        primaryStat: 'dex',
        abilities: ['多重射击', '陷阱', '野兽控制'],
        description: '荒野中的致命杀手'
    },
    rogue: {
        name: '潜行者',
        icon: '🗡️',
        hitDie: 8,
        primaryStat: 'dex',
        abilities: ['背刺', '消失', '毒药'],
        description: '阴影中的致命刺客'
    },
    warlock: {
        name: '术士',
        icon: '💜',
        hitDie: 8,
        primaryStat: 'int',
        abilities: ['暗影箭', '腐化', '恐惧'],
        description: '与恶魔签订契约的暗影法师'
    },
    druid: {
        name: '德鲁伊',
        icon: '🌙',
        hitDie: 8,
        primaryStat: 'wis',
        abilities: ['星火术', '愈合', '熊形态'],
        description: '自然的守护者与变形者'
    },
    priest: {
        name: '牧师',
        icon: '✝️',
        hitDie: 8,
        primaryStat: 'wis',
        abilities: ['治疗术', '真言术', '神圣新星'],
        description: '圣光的治愈者与战士'
    },
    shaman: {
        name: '萨满',
        icon: '⚡',
        hitDie: 8,
        primaryStat: 'wis',
        abilities: ['闪电箭', '治疗波', '元素召唤'],
        description: '与元素之灵沟通的先祖'
    }
};
```

- [ ] **Step 1: Add game state and data structures**

- [ ] **Step 2: Test localStorage save/load**

---

### Task 4: Character Creation System

**Modify:** `index.html` - Add character creation UI and logic

Add to `#character` section:
```html
<div id="char-creation" class="panel">
    <div class="panel-header">创建你的冒险者</div>
    
    <div id="step-1-race" class="creation-step">
        <h3 style="text-align: center; color: var(--gold-primary); margin: 20px 0;">
            第一步：选择你的种族
        </h3>
        <div class="selection-grid" id="race-grid"></div>
    </div>
    
    <div id="step-2-class" class="creation-step" style="display: none;">
        <h3 style="text-align: center; color: var(--gold-primary); margin: 20px 0;">
            第二步：选择你的职业
        </h3>
        <div class="selection-grid" id="class-grid"></div>
    </div>
    
    <div id="step-3-name" class="creation-step" style="display: none;">
        <h3 style="text-align: center; color: var(--gold-primary); margin: 20px 0;">
            第三步：为你的英雄命名
        </h3>
        <div style="text-align: center; padding: 20px;">
            <input type="text" id="char-name" placeholder="输入角色名称..." 
                   style="padding: 15px 20px; font-size: 1.2rem; background: rgba(0,0,0,0.4); 
                          border: 2px solid var(--gold-dark); color: var(--text-light);
                          border-radius: 4px; width: 300px; text-align: center;">
            <br><br>
            <button class="btn" onclick="submitCharacter()">创建角色</button>
        </div>
    </div>
    
    <div id="char-display" class="creation-step" style="display: none;">
        <!-- Character display will be populated -->
    </div>
</div>
```

Add JavaScript:
```javascript
let creationState = { race: null, class: null };

function initCharacterCreation() {
    renderRaceSelection();
}

function renderRaceSelection() {
    const grid = document.getElementById('race-grid');
    grid.innerHTML = '';
    
    Object.entries(RACES).forEach(([key, race]) => {
        const card = document.createElement('div');
        card.className = 'selection-card';
        card.innerHTML = `
            <div class="icon">${race.icon}</div>
            <h3>${race.name}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
                ${race.description}
            </p>
            <div style="margin-top: 10px; font-size: 0.85rem;">
                ${Object.entries(race.bonus).map(([stat, val]) => 
                    `${STAT_NAMES[stat]} +${val}`
                ).join(' | ')}
            </div>
        `;
        card.onclick = () => selectRace(key);
        grid.appendChild(card);
    });
}

function selectRace(raceKey) {
    creationState.race = raceKey;
    document.querySelectorAll('#race-grid .selection-card').forEach((card, i) => {
        card.classList.toggle('selected', Object.keys(RACES)[i] === raceKey);
    });
    
    setTimeout(() => {
        document.getElementById('step-1-race').style.display = 'none';
        document.getElementById('step-2-class').style.display = 'block';
        renderClassSelection();
    }, 500);
}

function renderClassSelection() {
    const grid = document.getElementById('class-grid');
    grid.innerHTML = '';
    
    Object.entries(CLASSES).forEach(([key, cls]) => {
        const card = document.createElement('div');
        card.className = 'selection-card';
        card.innerHTML = `
            <div class="icon">${cls.icon}</div>
            <h3>${cls.name}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
                ${cls.description}
            </p>
            <div style="margin-top: 10px; font-size: 0.85rem;">
                生命骰: d${cls.hitDie} | 主属性: ${STAT_NAMES[cls.primaryStat]}
            </div>
        `;
        card.onclick = () => selectClass(key);
        grid.appendChild(card);
    });
}

function selectClass(classKey) {
    creationState.class = classKey;
    document.querySelectorAll('#class-grid .selection-card').forEach((card, i) => {
        card.classList.toggle('selected', Object.keys(CLASSES)[i] === classKey);
    });
    
    setTimeout(() => {
        document.getElementById('step-2-class').style.display = 'none';
        document.getElementById('step-3-name').style.display = 'block';
    }, 500);
}

function submitCharacter() {
    const name = document.getElementById('char-name').value.trim();
    if (!name) {
        alert('请输入角色名称！');
        return;
    }
    
    const raceData = RACES[creationState.race];
    const classData = CLASSES[creationState.class];
    
    GameState.character = {
        name,
        race: creationState.race,
        class: creationState.class,
        level: 1,
        xp: 0,
        xpToLevel: 100,
        hp: classData.hitDie + 4,
        maxHp: classData.hitDie + 4,
        mana: 20,
        maxMana: 20,
        stats: {
            str: 10 + (raceData.bonus.str || 0),
            dex: 10 + (raceData.bonus.dex || 0),
            con: 10 + (raceData.bonus.con || 0),
            int: 10 + (raceData.bonus.int || 0),
            wis: 10 + (raceData.bonus.wis || 0),
            cha: 10 + (raceData.bonus.cha || 0)
        },
        abilities: [...classData.abilities],
        equipment: {}
    };
    
    GameState.save();
    renderCharacterDisplay();
}

function renderCharacterDisplay() {
    const char = GameState.character;
    const display = document.getElementById('char-display');
    
    display.innerHTML = `
        <div style="padding: 30px; text-align: center;">
            <div style="font-size: 5rem; margin-bottom: 20px;">
                ${RACES[char.race].icon} ${CLASSES[char.class].icon}
            </div>
            <h2 style="font-family: 'Cinzel', serif; color: var(--gold-bright); font-size: 2rem;">
                ${char.name}
            </h2>
            <p style="color: var(--text-muted); font-size: 1.1rem;">
                ${RACES[char.race].name} ${CLASSES[char.class].name}
            </p>
            
            <div style="margin: 30px auto; max-width: 500px;">
                <div style="margin: 15px 0;">
                    <span>生命值</span>
                    <div class="stat-bar">
                        <div class="stat-fill hp-fill" style="width: ${(char.hp/char.maxHp)*100}%"></div>
                    </div>
                    <span>${char.hp} / ${char.maxHp}</span>
                </div>
                
                <div style="margin: 15px 0;">
                    <span>法力值</span>
                    <div class="stat-bar">
                        <div class="stat-fill mana-fill" style="width: ${(char.mana/char.maxMana)*100}%"></div>
                    </div>
                    <span>${char.mana} / ${char.maxMana}</span>
                </div>
                
                <div style="margin: 15px 0;">
                    <span>经验值</span>
                    <div class="stat-bar">
                        <div class="stat-fill xp-fill" style="width: ${(char.xp/char.xpToLevel)*100}%"></div>
                    </div>
                    <span>${char.xp} / ${char.xpToLevel}</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; max-width: 600px; margin: 0 auto;">
                <div class="stat-box">
                    <div class="stat-label">力量 STR</div>
                    <div class="stat-value">${char.stats.str}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">敏捷 DEX</div>
                    <div class="stat-value">${char.stats.dex}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">体质 CON</div>
                    <div class="stat-value">${char.stats.con}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">智力 INT</div>
                    <div class="stat-value">${char.stats.int}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">感知 WIS</div>
                    <div class="stat-value">${char.stats.wis}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">魅力 CHA</div>
                    <div class="stat-value">${char.stats.cha}</div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h4 style="color: var(--gold-primary);">技能</h4>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
                    ${char.abilities.map(ability => `
                        <span style="background: var(--purple-arcane); padding: 8px 15px; border-radius: 20px;">
                            ${ability}
                        </span>
                    `).join('')}
                </div>
            </div>
            
            <button class="btn" style="margin-top: 30px;" onclick="resetCharacter()">
                🗡️ 创建新角色
            </button>
        </div>
    `;
    
    document.querySelectorAll('.creation-step').forEach(s => s.style.display = 'none');
    display.style.display = 'block';
}

// Add to CSS
const style = document.createElement('style');
style.textContent = `
    .stat-box {
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--gold-dark);
        padding: 15px;
        border-radius: 4px;
    }
    .stat-label {
        font-size: 0.8rem;
        color: var(--text-muted);
    }
    .stat-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--gold-bright);
    }
`;
document.head.appendChild(style);
```

- [ ] **Step 1: Add character creation HTML and CSS**

- [ ] **Step 2: Add character creation JavaScript**

- [ ] **Step 3: Test race selection flow**

- [ ] **Step 4: Test class selection flow**

- [ ] **Step 5: Test character creation**

---

### Task 5: Combat System

**Modify:** `index.html` - Add turn-based combat system

Add to `#combat` section:
```html
<div class="panel">
    <div class="panel-header">⚔️ 战斗竞技场</div>
    
    <div id="combat-area" style="padding: 20px;">
        <!-- No character warning -->
        <div id="no-character-msg" style="text-align: center; padding: 50px;">
            <p style="font-size: 1.2rem; color: var(--text-muted);">
                请先创建角色开始冒险！
            </p>
            <button class="btn" onclick="switchSection('character')" style="margin-top: 20px;">
                创建角色
            </button>
        </div>
        
        <!-- Combat interface -->
        <div id="combat-interface" style="display: none;">
            <div class="combat-arena">
                <div class="combatant">
                    <h3 style="color: var(--gold-primary);" id="player-name">玩家</h3>
                    <div class="combatant-avatar" id="player-avatar">🧑</div>
                    <div class="stat-bar" style="margin: 10px auto; max-width: 200px;">
                        <div class="stat-fill hp-fill" id="player-hp-bar"></div>
                    </div>
                    <p id="player-hp-text">100 / 100</p>
                    <div class="stat-bar" style="margin: 10px auto; max-width: 200px;">
                        <div class="stat-fill mana-fill" id="player-mana-bar"></div>
                    </div>
                    <p id="player-mana-text">50 / 50</p>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; font-size: 3rem; color: var(--gold-dark);">
                    VS
                </div>
                
                <div class="combatant">
                    <h3 style="color: var(--red-blood);" id="enemy-name">敌人</h3>
                    <div class="combatant-avatar" id="enemy-avatar">👹</div>
                    <div class="stat-bar" style="margin: 10px auto; max-width: 200px;">
                        <div class="stat-fill hp-fill" id="enemy-hp-bar"></div>
                    </div>
                    <p id="enemy-hp-text">80 / 80</p>
                </div>
            </div>
            
            <div class="combat-log" id="combat-log">
                <p class="log-system">⚔️ 战斗开始！</p>
            </div>
            
            <div id="combat-actions" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 20px;">
                <!-- Action buttons populated by JS -->
            </div>
            
            <div id="combat-result" style="display: none; text-align: center; padding: 30px;">
                <!-- Results shown after combat -->
            </div>
        </div>
    </div>
</div>
```

Add combat enemies and combat logic JavaScript:
```javascript
const ENEMIES = {
    goblin: { name: '豺狼人', icon: '👺', hp: 25, damage: [4, 8], xp: 15, gold: 5 },
    skeleton: { name: '骷髅', icon: '💀', hp: 30, damage: [5, 10], xp: 20, gold: 8 },
    orc: { name: '兽人战士', icon: '👹', hp: 45, damage: [8, 15], xp: 35, gold: 15 },
    spider: { name: '剧毒蜘蛛', icon: '🕷️', hp: 35, damage: [6, 12], xp: 25, gold: 10 },
    bandit: { name: '土匪', icon: '🧔', hp: 40, damage: [7, 14], xp: 30, gold: 20 },
    troll: { name: '巨魔', icon: '👹', hp: 80, damage: [12, 20], xp: 60, gold: 30 },
    dragon_whelp: { name: '幼龙', icon: '🐉', hp: 120, damage: [15, 30], xp: 100, gold: 50 },
    demon: { name: '恶魔', icon: '👿', hp: 150, damage: [20, 35], xp: 150, gold: 75 }
};

const ENCOUNTERS = [
    { enemy: 'goblin', zone: '新手区' },
    { enemy: 'skeleton', zone: '墓地' },
    { enemy: 'spider', zone: '森林' },
    { enemy: 'orc', zone: '兽人大本营' },
    { enemy: 'bandit', zone: '强盗营地' },
    { enemy: 'troll', zone: '洞穴' },
    { enemy: 'dragon_whelp', zone: '龙穴' },
    { enemy: 'demon', zone: '扭曲虚空' }
];

let combatState = null;

function initCombat() {
    if (!GameState.character) {
        document.getElementById('no-character-msg').style.display = 'block';
        document.getElementById('combat-interface').style.display = 'none';
        return;
    }
    
    document.getElementById('no-character-msg').style.display = 'none';
    document.getElementById('combat-interface').style.display = 'block';
    
    updateCombatUI();
}

function updateCombatUI() {
    const char = GameState.character;
    
    document.getElementById('player-name').textContent = char.name;
    document.getElementById('player-avatar').textContent = RACES[char.race].icon;
    
    document.getElementById('player-hp-bar').style.width = `${(char.hp/char.maxHp)*100}%`;
    document.getElementById('player-hp-text').textContent = `${char.hp} / ${char.maxHp}`;
    
    document.getElementById('player-mana-bar').style.width = `${(char.mana/char.maxMana)*100}%`;
    document.getElementById('player-mana-text').textContent = `${char.mana} / ${char.maxMana}`;
    
    renderCombatActions();
}

function renderCombatActions() {
    const actions = document.getElementById('combat-actions');
    const char = GameState.character;
    
    actions.innerHTML = `
        <button class="btn btn-attack" onclick="playerAttack()">
            ⚔️ 普通攻击
        </button>
        ${char.abilities.map((ability, i) => `
            <button class="btn btn-magic" onclick="useAbility(${i})">
                ${getAbilityIcon(ability)} ${ability}
            </button>
        `).join('')}
        <button class="btn" onclick="tryFlee()">
            🏃 尝试逃跑
        </button>
    `;
}

function getAbilityIcon(ability) {
    const icons = {
        '重击': '💥', '盾墙': '🛡️', '横扫': '⚔️',
        '火球术': '🔥', '冰霜新星': '❄️', '奥术飞弹': '✨',
        '圣光术': '💛', '神圣制裁': '⚡', '复仇之锤': '🔨',
        '多重射击': '🏹', '陷阱': '🪤', '野兽控制': '🐺',
        '背刺': '🗡️', '消失': '👻', '毒药': '☠️',
        '暗影箭': '💜', '腐化': '🖤', '恐惧': '😱',
        '星火术': '⭐', '愈合': '💚', '熊形态': '🐻',
        '治疗术': '💚', '真言术': '✨', '神圣新星': '💛',
        '闪电箭': '⚡', '治疗波': '🌊', '元素召唤': '🔥'
    };
    return icons[ability] || '✨';
}

function startCombat(enemyKey = null) {
    const char = GameState.character;
    
    if (!enemyKey) {
        const level = char.level;
        const availableEnemies = ENCOUNTERS.filter(e => {
            const enemy = ENEMIES[e.enemy];
            return enemy.xp <= level * 50;
        });
        const encounter = availableEnemies[Math.floor(Math.random() * availableEnemies.length)] || ENCOUNTERS[0];
        enemyKey = encounter.enemy;
    }
    
    const enemyTemplate = ENEMIES[enemyKey];
    
    combatState = {
        enemy: {
            ...enemyTemplate,
            currentHp: enemyTemplate.hp
        },
        turn: 'player',
        log: []
    };
    
    const enemyAvatar = document.getElementById('enemy-avatar');
    enemyAvatar.textContent = enemyTemplate.icon;
    enemyAvatar.style.animation = 'pulse 1s infinite';
    
    document.getElementById('enemy-name').textContent = enemyTemplate.name;
    document.getElementById('enemy-hp-bar').style.width = '100%';
    document.getElementById('enemy-hp-text').textContent = `${enemyTemplate.hp} / ${enemyTemplate.hp}`;
    
    document.getElementById('combat-log').innerHTML = `
        <p class="log-system">⚔️ ${char.name} 遭遇了 ${enemyTemplate.name}！</p>
    `;
    
    document.getElementById('combat-result').style.display = 'none';
    document.getElementById('combat-actions').style.display = 'flex';
    
    document.getElementById('player-avatar').style.animation = 'bounce 0.5s';
    setTimeout(() => {
        document.getElementById('player-avatar').style.animation = '';
    }, 500);
}

function playerAttack() {
    if (!combatState || combatState.turn !== 'player') return;
    
    const char = GameState.character;
    const enemy = combatState.enemy;
    
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const statBonus = Math.floor((char.stats.str - 10) / 2);
    const totalAttack = attackRoll + statBonus + char.level;
    
    if (totalAttack >= 10) {
        const damage = Math.floor(Math.random() * 8) + 1 + statBonus;
        enemy.currentHp -= damage;
        addCombatLog(`${char.name} 的普通攻击命中了！造成了 ${damage} 点伤害！`, 'damage');
        
        animateAttack('player');
    } else {
        addCombatLog(`${char.name} 的普通攻击 MISS！`, 'system');
    }
    
    checkCombatEnd();
}

function useAbility(index) {
    if (!combatState || combatState.turn !== 'player') return;
    
    const char = GameState.character;
    const ability = char.abilities[index];
    const enemy = combatState.enemy;
    
    const manaCost = getAbilityManaCost(ability);
    
    if (char.mana < manaCost) {
        addCombatLog(`法力不足！无法使用 ${ability}`, 'system');
        return;
    }
    
    char.mana -= manaCost;
    
    let damage = 0;
    let heal = 0;
    
    switch(ability) {
        case '重击':
            damage = Math.floor(Math.random() * 12) + 8 + Math.floor((char.stats.str - 10) / 2);
            addCombatLog(`${char.name} 使出重击！造成了 ${damage} 点伤害！`, 'damage');
            break;
        case '横扫':
            damage = Math.floor(Math.random() * 6) + 4 + Math.floor((char.stats.str - 10) / 2);
            addCombatLog(`${char.name} 横扫千军！造成了 ${damage} 点伤害！`, 'damage');
            break;
        case '火球术':
            damage = Math.floor(Math.random() * 20) + 15 + Math.floor((char.stats.int - 10) / 2);
            addCombatLog(`${char.name} 施展火球术！造成了 ${damage} 点火焰伤害！`, 'magic');
            createMagicParticles('fire');
            break;
        case '冰霜新星':
            damage = Math.floor(Math.random() * 12) + 8 + Math.floor((char.stats.int - 10) / 2);
            addCombatLog(`${char.name} 释放冰霜新星！造成了 ${damage} 点冰霜伤害！`, 'magic');
            createMagicParticles('ice');
            break;
        case '圣光术':
            heal = Math.floor(Math.random() * 15) + 10 + Math.floor((char.stats.wis - 10) / 2);
            char.hp = Math.min(char.maxHp, char.hp + heal);
            addCombatLog(`${char.name} 施放圣光术！恢复了 ${heal} 点生命！`, 'heal');
            break;
        case '暗影箭':
            damage = Math.floor(Math.random() * 16) + 12 + Math.floor((char.stats.int - 10) / 2);
            addCombatLog(`${char.name} 发射暗影箭！造成了 ${damage} 点暗影伤害！`, 'magic');
            createMagicParticles('shadow');
            break;
        case '治疗术':
            heal = Math.floor(Math.random() * 20) + 15 + Math.floor((char.stats.wis - 10) / 2);
            char.hp = Math.min(char.maxHp, char.hp + heal);
            addCombatLog(`${char.name} 施展治疗术！恢复了 ${heal} 点生命！`, 'heal');
            break;
        case '闪电箭':
            damage = Math.floor(Math.random() * 14) + 10 + Math.floor((char.stats.wis - 10) / 2);
            addCombatLog(`${char.name} 释放闪电箭！造成了 ${damage} 点自然伤害！`, 'magic');
            createMagicParticles('lightning');
            break;
        case '星火术':
            damage = Math.floor(Math.random() * 18) + 12 + Math.floor((char.stats.wis - 10) / 2);
            addCombatLog(`${char.name} 施放星火术！造成了 ${damage} 点自然伤害！`, 'magic');
            createMagicParticles('nature');
            break;
        case '背刺':
            if (Math.random() > 0.3) {
                damage = Math.floor(Math.random() * 12) + 10 + Math.floor((char.stats.dex - 10) / 2);
                addCombatLog(`${char.name} 背刺成功！造成了 ${damage} 点伤害！`, 'damage');
            } else {
                damage = Math.floor(Math.random() * 6) + 2 + Math.floor((char.stats.dex - 10) / 2);
                addCombatLog(`${char.name} 背刺！造成了 ${damage} 点伤害！`, 'damage');
            }
            break;
        default:
            damage = Math.floor(Math.random() * 10) + 5;
            addCombatLog(`${char.name} 使用 ${ability}！造成了 ${damage} 点伤害！`, 'magic');
    }
    
    enemy.currentHp = Math.max(0, enemy.currentHp - damage);
    
    animateAbility(ability);
    updateCombatUI();
    checkCombatEnd();
}

function getAbilityManaCost(ability) {
    const costs = {
        '重击': 0, '盾墙': 0, '横扫': 0,
        '火球术': 25, '冰霜新星': 20, '奥术飞弹': 15,
        '圣光术': 20, '神圣制裁': 30, '复仇之锤': 25,
        '多重射击': 15, '陷阱': 10, '野兽控制': 20,
        '背刺': 5, '消失': 25, '毒药': 5,
        '暗影箭': 20, '腐化': 15, '恐惧': 20,
        '星火术': 18, '愈合': 15, '熊形态': 25,
        '治疗术': 20, '真言术': 10, '神圣新星': 25,
        '闪电箭': 18, '治疗波': 20, '元素召唤': 30
    };
    return costs[ability] || 10;
}

function enemyTurn() {
    if (!combatState) return;
    
    combatState.turn = 'enemy';
    
    setTimeout(() => {
        const char = GameState.character;
        const enemy = combatState.enemy;
        
        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const defBonus = Math.floor((char.stats.dex - 10) / 2);
        
        if (attackRoll >= 8 - defBonus / 2) {
            const damage = Math.floor(Math.random() * (enemy.damage[1] - enemy.damage[0] + 1)) + enemy.damage[0];
            char.hp -= damage;
            addCombatLog(`${enemy.name} 攻击了 ${char.name}！造成了 ${damage} 点伤害！`, 'damage');
            animateAttack('enemy');
        } else {
            addCombatLog(`${enemy.name} 的攻击 MISS！`, 'system');
        }
        
        updateCombatUI();
        
        if (char.hp <= 0) {
            endCombat('defeat');
        } else {
            combatState.turn = 'player';
        }
    }, 1000);
}

function tryFlee() {
    if (!combatState) return;
    
    if (Math.random() > 0.5) {
        addCombatLog(`${GameState.character.name} 成功逃跑了！`, 'system');
        combatState = null;
        document.getElementById('combat-result').style.display = 'block';
        document.getElementById('combat-result').innerHTML = `
            <h3 style="color: var(--gold-primary);">🏃 逃离战斗</h3>
            <p>你成功逃脱了危险！</p>
            <button class="btn" onclick="startRandomCombat()">继续冒险</button>
        `;
    } else {
        addCombatLog(`${GameState.character.name} 逃跑失败！`, 'system');
        enemyTurn();
    }
}

function checkCombatEnd() {
    const char = GameState.character;
    const enemy = combatState.enemy;
    
    if (enemy.currentHp <= 0) {
        endCombat('victory');
    } else if (char.hp <= 0) {
        endCombat('defeat');
    } else {
        updateCombatUI();
        enemyTurn();
    }
}

function endCombat(result) {
    const char = GameState.character;
    const enemy = combatState.enemy;
    
    document.getElementById('combat-actions').style.display = 'none';
    document.getElementById('combat-result').style.display = 'block';
    
    if (result === 'victory') {
        const xpGain = enemy.xp;
        const goldGain = enemy.gold + Math.floor(Math.random() * 10);
        
        char.xp += xpGain;
        
        addItemToInventory({ type: 'gold', name: '金币', quantity: goldGain });
        
        let leveledUp = false;
        while (char.xp >= char.xpToLevel) {
            char.xp -= char.xpToLevel;
            char.level++;
            char.xpToLevel = Math.floor(char.xpToLevel * 1.5);
            char.maxHp += Math.floor(Math.random() * 6) + 3;
            char.maxMana += Math.floor(Math.random() * 4) + 2;
            char.hp = char.maxHp;
            char.mana = char.maxMana;
            leveledUp = true;
        }
        
        let rewardText = `
            <h3 style="color: #44ff44;">🎉 胜利！</h3>
            <p style="font-size: 1.2rem; margin: 15px 0;">
                击败 ${enemy.name} 获得:
            </p>
            <p style="color: var(--gold-primary);">⚡ 经验值: +${xpGain}</p>
            <p style="color: var(--gold-bright);">💰 金币: +${goldGain}</p>
        `;
        
        if (leveledUp) {
            rewardText += `
                <p style="color: #ff44ff; font-size: 1.5rem; margin-top: 15px;">
                    ⬆️ 升级！现在是 ${char.level} 级！
                </p>
            `;
        }
        
        if (Math.random() < 0.3) {
            const loot = generateLoot(char.level);
            addItemToInventory(loot);
            rewardText += `<p style="color: #8844ff;">🎁 获得物品: ${loot.name}!</p>`;
        }
        
        rewardText += `
            <button class="btn" onclick="startRandomCombat()" style="margin-top: 20px;">
                继续冒险
            </button>
        `;
        
        document.getElementById('combat-result').innerHTML = rewardText;
    } else {
        document.getElementById('combat-result').innerHTML = `
            <h3 style="color: #ff4444;">💀 战败...</h3>
            <p style="margin: 15px 0;">${char.name} 倒下了...</p>
            <p style="color: var(--text-muted);">损失了一些金币...</p>
            <button class="btn" onclick="reviveAndContinue()" style="margin-top: 20px;">
                休息后继续
            </button>
        `;
        
        const goldLoss = Math.floor(char.level * 5);
        removeGold(goldLoss);
    }
    
    GameState.save();
}

function startRandomCombat() {
    startCombat();
    initCombat();
}

function reviveAndContinue() {
    const char = GameState.character;
    char.hp = Math.floor(char.maxHp / 2);
    char.mana = Math.floor(char.maxMana / 2);
    
    GameState.save();
    document.getElementById('combat-result').style.display = 'none';
    startRandomCombat();
}

function addCombatLog(message, type) {
    const log = document.getElementById('combat-log');
    const p = document.createElement('p');
    p.className = `log-${type}`;
    p.textContent = message;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
}

function animateAttack(attacker) {
    const avatar = document.getElementById(attacker === 'player' ? 'player-avatar' : 'enemy-avatar');
    avatar.style.transform = 'scale(1.2)';
    setTimeout(() => avatar.style.transform = '', 200);
}

function animateAbility(ability) {
    const avatar = document.getElementById('player-avatar');
    avatar.style.boxShadow = '0 0 50px #8844ff';
    setTimeout(() => avatar.style.boxShadow = '', 500);
}

function createMagicParticles(type) {
    const colors = {
        fire: 'rgba(255, 100, 0, 0.8)',
        ice: 'rgba(100, 200, 255, 0.8)',
        shadow: 'rgba(100, 50, 150, 0.8)',
        lightning: 'rgba(255, 255, 100, 0.8)',
        nature: 'rgba(100, 255, 100, 0.8)'
    };
    
    for (let i = 0; i < 20; i++) {
        particles.createParticle('magic');
    }
}

function generateLoot(level) {
    const items = [
        { type: 'weapon', name: '锋利的剑', icon: '⚔️', damage: level * 2 },
        { type: 'armor', name: '皮甲护胸', icon: '🛡️', defense: level },
        { type: 'potion', name: '治疗药水', icon: '🧪', healing: level * 10 },
        { type: 'scroll', name: '魔法卷轴', icon: '📜', effect: 'mana_restore' },
        { type: 'ring', name: '魔力戒指', icon: '💍', mana_bonus: level }
    ];
    
    return items[Math.floor(Math.random() * items.length)];
}

function addItemToInventory(item) {
    const existing = GameState.inventory.find(i => i.name === item.name);
    if (existing && item.quantity) {
        existing.quantity += item.quantity;
    } else {
        GameState.inventory.push({ ...item, id: Date.now() });
    }
    GameState.save();
}

function removeGold(amount) {
    const gold = GameState.inventory.find(i => i.type === 'gold');
    if (gold) {
        gold.quantity = Math.max(0, gold.quantity - amount);
    }
}
```

Add combat CSS:
```css
@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}

.combatant-avatar {
    transition: all 0.3s ease;
}
```

- [ ] **Step 1: Add combat HTML structure**

- [ ] **Step 2: Add enemy and combat JavaScript**

- [ ] **Step 3: Add combat CSS animations**

- [ ] **Step 4: Test complete combat flow**

- [ ] **Step 5: Test victory/defeat scenarios**

---

### Task 6: Quest System

**Modify:** `index.html` - Add quest/adventure system

Add to `#quests` section:
```html
<div class="panel">
    <div class="panel-header">📜 任务日志</div>
    <div id="quests-content" style="padding: 20px;">
        <!-- Quest list populated by JS -->
    </div>
</div>
```

Add JavaScript:
```javascript
const QUESTS = [
    {
        id: 1,
        title: '新手村的危机',
        description: '帮助新手村的村民清除周围的威胁',
        objectives: [
            { type: 'kill', enemy: 'goblin', count: 3, progress: 0 }
        ],
        reward: { xp: 50, gold: 30 },
        zone: '新手村'
    },
    {
        id: 2,
        title: '墓地的安宁',
        description: '墓地中涌出了不安分的亡灵，必须让他们安息',
        objectives: [
            { type: 'kill', enemy: 'skeleton', count: 5, progress: 0 }
        ],
        reward: { xp: 100, gold: 50 },
        zone: '墓地'
    },
    {
        id: 3,
        title: '森林的蜘蛛巢穴',
        description: '森林中的蜘蛛开始威胁过往的旅人',
        objectives: [
            { type: 'kill', enemy: 'spider', count: 4, progress: 0 }
        ],
        reward: { xp: 80, gold: 40, item: '解毒药水' },
        zone: '森林'
    },
    {
        id: 4,
        title: '兽人的威胁',
        description: '兽人大军正在集结，必须阻止他们',
        objectives: [
            { type: 'kill', enemy: 'orc', count: 3, progress: 0 }
        ],
        reward: { xp: 150, gold: 100 },
        zone: '兽人大本营'
    },
    {
        id: 5,
        title: '龙的试炼',
        description: '面对幼龙的挑战，证明你的实力',
        objectives: [
            { type: 'kill', enemy: 'dragon_whelp', count: 1, progress: 0 }
        ],
        reward: { xp: 300, gold: 200, item: '龙鳞护甲' },
        zone: '龙穴'
    }
];

function initQuests() {
    if (!GameState.quests.length) {
        GameState.quests = QUESTS.map(q => ({ ...q, objectives: q.objectives.map(o => ({ ...o })) }));
        GameState.save();
    }
    renderQuests();
}

function renderQuests() {
    const container = document.getElementById('quests-content');
    const activeQuests = GameState.quests.filter(q => !q.completed);
    
    if (!activeQuests.length) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <p style="font-size: 3rem;">📜</p>
                <p style="color: var(--text-muted);">暂无任务</p>
                <p style="color: var(--text-muted); font-size: 0.9rem;">继续冒险来获取新任务！</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeQuests.map(quest => `
        <div class="quest-card" style="background: var(--bg-panel); border: 1px solid var(--gold-dark); 
                                      padding: 20px; margin-bottom: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: var(--gold-primary); font-family: 'Cinzel', serif;">
                    ${quest.title}
                </h3>
                <span style="background: var(--bg-primary); padding: 5px 10px; border-radius: 10px; font-size: 0.8rem;">
                    📍 ${quest.zone}
                </span>
            </div>
            <p style="color: var(--text-muted); margin: 10px 0;">${quest.description}</p>
            
            <div style="margin: 15px 0;">
                ${quest.objectives.map(obj => {
                    const enemy = ENEMIES[obj.enemy];
                    const percent = (obj.progress / obj.count) * 100;
                    return `
                        <div style="margin: 8px 0;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                                <span>${enemy.icon} ${enemy.name}: ${obj.progress}/${obj.count}</span>
                                <span>${percent.toFixed(0)}%</span>
                            </div>
                            <div class="stat-bar" style="height: 8px;">
                                <div class="stat-fill xp-fill" style="width: ${percent}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div style="display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-muted);">
                <span>⚡ 经验: ${quest.reward.xp}</span>
                <span>💰 金币: ${quest.reward.gold}</span>
                ${quest.reward.item ? `<span>🎁 物品: ${quest.reward.item}</span>` : ''}
            </div>
            
            ${quest.objectives.every(o => o.progress >= o.count) ? `
                <button class="btn" onclick="completeQuest(${quest.id})" style="margin-top: 15px; width: 100%;">
                    ✅ 完成任务
                </button>
            ` : ''}
        </div>
    `).join('');
}

function updateQuestProgress(enemyKey) {
    GameState.quests.forEach(quest => {
        if (quest.completed) return;
        
        quest.objectives.forEach(obj => {
            if (obj.enemy === enemyKey && obj.progress < obj.count) {
                obj.progress++;
            }
        });
    });
    
    GameState.save();
    renderQuests();
}

function completeQuest(questId) {
    const quest = GameState.quests.find(q => q.id === questId);
    if (!quest) return;
    
    if (!quest.objectives.every(o => o.progress >= o.count)) return;
    
    const char = GameState.character;
    char.xp += quest.reward.xp;
    
    addItemToInventory({ type: 'gold', name: '金币', quantity: quest.reward.gold });
    
    if (quest.reward.item) {
        addItemToInventory({ type: 'quest', name: quest.reward.item, icon: '🎁' });
    }
    
    quest.completed = true;
    
    let leveledUp = false;
    while (char.xp >= char.xpToLevel) {
        char.xp -= char.xpToLevel;
        char.level++;
        char.xpToLevel = Math.floor(char.xpToLevel * 1.5);
        char.maxHp += Math.floor(Math.random() * 6) + 3;
        char.maxMana += Math.floor(Math.random() * 4) + 2;
        leveledUp = true;
    }
    
    alert(`🎉 任务完成！\n获得 ${quest.reward.xp} 经验\n获得 ${quest.reward.gold} 金币\n${leveledUp ? '🎊 升级！' : ''}`);
    
    GameState.save();
    renderQuests();
}
```

- [ ] **Step 1: Add quest HTML structure**

- [ ] **Step 2: Add quest JavaScript logic**

- [ ] **Step 3: Test quest tracking in combat**

---

### Task 7: Inventory System

**Modify:** `index.html` - Add inventory management

Add to `#inventory` section:
```html
<div class="panel">
    <div class="panel-header">🎒 背包</div>
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;">
        <div>
            <h4 style="color: var(--gold-primary); margin-bottom: 15px;">物品栏</h4>
            <div class="inventory-grid" id="inventory-grid">
                <!-- Slots populated by JS -->
            </div>
        </div>
        <div id="item-details" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
            <h4 style="color: var(--gold-primary);">物品详情</h4>
            <p style="color: var(--text-muted);" id="item-detail-text">选择一个物品查看详情</p>
        </div>
    </div>
</div>
```

Add JavaScript:
```javascript
function initInventory() {
    renderInventory();
}

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    const slots = 24;
    
    let html = '';
    for (let i = 0; i < slots; i++) {
        const item = GameState.inventory[i];
        html += `
            <div class="inventory-slot ${item ? 'has-item' : ''}" 
                 onclick="showItemDetails(${i})"
                 title="${item ? item.name : '空'}">
                ${item ? (item.icon || getItemIcon(item.type)) : ''}
                ${item && item.quantity > 1 ? `<span style="position: absolute; bottom: 2px; right: 2px; font-size: 0.7rem;">${item.quantity}</span>` : ''}
            </div>
        `;
    }
    
    grid.innerHTML = html;
}

function getItemIcon(type) {
    const icons = {
        gold: '💰',
        weapon: '⚔️',
        armor: '🛡️',
        potion: '🧪',
        scroll: '📜',
        ring: '💍',
        quest: '🎁',
        misc: '📦'
    };
    return icons[type] || '📦';
}

function showItemDetails(index) {
    const item = GameState.inventory[index];
    const detailPanel = document.getElementById('item-details');
    
    if (!item) {
        document.getElementById('item-detail-text').textContent = '选择一个物品查看详情';
        return;
    }
    
    let details = `
        <div style="text-align: center; margin: 15px 0;">
            <span style="font-size: 3rem;">${item.icon || getItemIcon(item.type)}</span>
        </div>
        <h3 style="color: var(--gold-bright); text-align: center;">${item.name}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">
            类型: ${getItemTypeName(item.type)}
        </p>
    `;
    
    if (item.damage) {
        details += `<p style="color: #ff4444;">⚔️ 伤害: ${item.damage}</p>`;
    }
    if (item.defense) {
        details += `<p style="color: #4488ff;">🛡️ 防御: ${item.defense}</p>`;
    }
    if (item.healing) {
        details += `<p style="color: #44ff44;">💚 治疗: ${item.healing}</p>`;
    }
    if (item.mana_bonus) {
        details += `<p style="color: #8844ff;">💜 法力: +${item.mana_bonus}</p>`;
    }
    if (item.quantity) {
        details += `<p>数量: ${item.quantity}</p>`;
    }
    
    if (item.type === 'potion' || item.type === 'scroll') {
        details += `
            <button class="btn" onclick="useItem(${index})" style="margin-top: 15px; width: 100%;">
                使用
            </button>
        `;
    }
    
    details += `
        <button class="btn" onclick="discardItem(${index})" style="margin-top: 10px; width: 100%; background: linear-gradient(180deg, #8b0000 0%, #5a0000 100%);">
            丢弃
        </button>
    `;
    
    detailPanel.innerHTML = details;
}

function getItemTypeName(type) {
    const names = {
        gold: '货币',
        weapon: '武器',
        armor: '护甲',
        potion: '药水',
        scroll: '卷轴',
        ring: '饰品',
        quest: '任务物品',
        misc: '杂物'
    };
    return names[type] || '未知';
}

function useItem(index) {
    const item = GameState.inventory[index];
    if (!item) return;
    
    const char = GameState.character;
    
    switch(item.type) {
        case 'potion':
            if (item.effect === 'mana_restore') {
                char.mana = Math.min(char.maxMana, char.mana + (item.mana_restore || 20));
                addCombatLog(`${char.name} 使用了 ${item.name}，恢复了 ${item.mana_restore || 20} 点法力！`, 'heal');
            } else {
                char.hp = Math.min(char.maxHp, char.hp + (item.healing || 20));
                addCombatLog(`${char.name} 使用了 ${item.name}，恢复了 ${item.healing || 20} 点生命！`, 'heal');
            }
            break;
        case 'scroll':
            addCombatLog(`${char.name} 阅读了 ${item.name}，获得了增益效果！`, 'magic');
            break;
    }
    
    if (item.quantity > 1) {
        item.quantity--;
    } else {
        GameState.inventory.splice(index, 1);
    }
    
    GameState.save();
    renderInventory();
    updateCombatUI();
}

function discardItem(index) {
    if (confirm('确定要丢弃这个物品吗？')) {
        GameState.inventory.splice(index, 1);
        GameState.save();
        renderInventory();
        document.getElementById('item-detail-text').textContent = '选择一个物品查看详情';
    }
}
```

- [ ] **Step 1: Add inventory HTML structure**

- [ ] **Step 2: Add inventory JavaScript logic**

- [ ] **Step 3: Test item management**

---

### Task 8: World Map & Locations

**Modify:** `index.html` - Add world exploration

Add to `#map` section:
```html
<div class="panel">
    <div class="panel-header">🗺️ 艾泽拉斯世界</div>
    <div style="padding: 20px;">
        <div id="world-map" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <!-- Locations populated by JS -->
        </div>
        
        <div id="location-info" class="panel" style="padding: 20px;">
            <h3 style="color: var(--gold-primary); text-align: center;">
                📍 ${GameState.location || '暴风城'}
            </h3>
            <p style="color: var(--text-muted); text-align: center;">
                选择一个地点开始冒险
            </p>
        </div>
    </div>
</div>
```

Add JavaScript:
```javascript
const LOCATIONS = {
    stormwind: {
        name: '暴风城',
        icon: '🏰',
        description: '人类王国的主城，联盟的中心',
        enemies: ['goblin', 'skeleton'],
        levelRange: [1, 5],
        color: '#4488ff'
    },
    elwynn: {
        name: '艾尔文森林',
        icon: '🌲',
        description: '暴风城周围的富饶森林',
        enemies: ['goblin', 'bandit'],
        levelRange: [1, 4],
        color: '#44ff44'
    },
    westfall: {
        name: '西部荒野',
        icon: '🏜️',
        description: '荒凉的土地，盗贼横行',
        enemies: ['bandit', 'skeleton'],
        levelRange: [3, 7],
        color: '#d4a574'
    },
    deadwind: {
        name: '逆风沼泽',
        icon: '🌫️',
        description: '神秘而危险的黑沼泽',
        enemies: ['spider', 'orc'],
        levelRange: [5, 10],
        color: '#8844aa'
    },
    swamp: {
        name: '悲伤沼泽',
        icon: '🐸',
        description: '充满毒气和怪物的湿地',
        enemies: ['spider', 'troll'],
        levelRange: [6, 12],
        color: '#6b8e23'
    },
    blasted: {
        name: '荒芜之地',
        icon: '🔥',
        description: '被燃烧军团摧毁的区域',
        enemies: ['orc', 'demon'],
        levelRange: [10, 15],
        color: '#ff4444'
    },
    felwood: {
        name: '费伍德森林',
        icon: '💜',
        description: '被腐蚀的森林，恶魔出没',
        enemies: ['troll', 'demon'],
        levelRange: [12, 18],
        color: '#9932cc'
    },
    blackrock: {
        name: '黑石塔',
        icon: '🐉',
        description: '巨龙的巢穴，极度危险',
        enemies: ['dragon_whelp', 'demon'],
        levelRange: [15, 20],
        color: '#2f2f2f'
    }
};

function initMap() {
    renderWorldMap();
}

function renderWorldMap() {
    const map = document.getElementById('world-map');
    
    map.innerHTML = Object.entries(LOCATIONS).map(([key, loc]) => {
        const isCurrent = GameState.location === key;
        const char = GameState.character;
        const level = char ? char.level : 1;
        const inRange = level >= loc.levelRange[0] - 2 && level <= loc.levelRange[1] + 2;
        
        return `
            <div class="location-card ${isCurrent ? 'current' : ''}" 
                 onclick="travelTo('${key}')"
                 style="background: linear-gradient(135deg, ${loc.color}22, transparent);
                        border: 2px solid ${isCurrent ? 'var(--gold-bright)' : 'var(--gold-dark)'};
                        padding: 20px; text-align: center; cursor: pointer;
                        transition: all 0.3s ease; border-radius: 8px;
                        ${isCurrent ? 'box-shadow: var(--shadow-glow);' : ''}">
                <div style="font-size: 2.5rem;">${loc.icon}</div>
                <h4 style="color: var(--gold-primary); margin: 10px 0 5px;">${loc.name}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted);">等级 ${loc.levelRange[0]}-${loc.levelRange[1]}</p>
                ${!inRange ? '<span style="color: #ff4444; font-size: 0.8rem;">⚠️ 等级过低</span>' : ''}
            </div>
        `;
    }).join('');
    
    updateLocationInfo();
}

function travelTo(locationKey) {
    const loc = LOCATIONS[locationKey];
    const char = GameState.character;
    const level = char ? char.level : 1;
    
    if (level < loc.levelRange[0] - 2) {
        alert(`等级不足！需要至少 ${loc.levelRange[0] - 2} 级才能前往 ${loc.name}`);
        return;
    }
    
    GameState.location = locationKey;
    GameState.save();
    
    renderWorldMap();
    updateLocationInfo();
    
    document.getElementById('combat-interface').innerHTML += `
        <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.5); margin-top: 20px; border-radius: 8px;">
            <p>已传送至 ${loc.icon} ${loc.name}</p>
        </div>
    `;
}

function updateLocationInfo() {
    const loc = LOCATIONS[GameState.location];
    const info = document.getElementById('location-info');
    
    info.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 4rem;">${loc.icon}</span>
        </div>
        <h3 style="color: var(--gold-bright); text-align: center; font-size: 1.5rem;">
            ${loc.name}
        </h3>
        <p style="color: var(--text-muted); text-align: center; margin: 10px 0;">
            ${loc.description}
        </p>
        <div style="text-align: center; margin: 15px 0;">
            <span style="background: var(--bg-primary); padding: 8px 15px; border-radius: 20px;">
                ⚔️ 推荐等级: ${loc.levelRange[0]} - ${loc.levelRange[1]}
            </span>
        </div>
        <p style="color: var(--text-muted); text-align: center; font-size: 0.9rem; margin-top: 15px;">
            这里的敌人:
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            ${loc.enemies.map(e => `
                <span style="background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 15px;">
                    ${ENEMIES[e].icon} ${ENEMIES[e].name}
                </span>
            `).join('')}
        </div>
        <button class="btn" onclick="startAdventureInLocation()" style="margin-top: 20px; width: 100%;">
            ⚔️ 开始冒险
        </button>
    `;
}

function startAdventureInLocation() {
    const loc = LOCATIONS[GameState.location];
    const char = GameState.character;
    
    if (char.hp < char.maxHp * 0.3) {
        alert('生命值过低，请先休息恢复！');
        return;
    }
    
    const enemy = loc.enemies[Math.floor(Math.random() * loc.enemies.length)];
    startCombat(enemy);
    initCombat();
}
```

- [ ] **Step 1: Add map HTML structure**

- [ ] **Step 2: Add locations JavaScript**

- [ ] **Step 3: Test world exploration**

---

### Task 9: Navigation & Initialization

**Modify:** `index.html` - Add navigation and game initialization

Add JavaScript:
```javascript
// Navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        switchSection(tab.dataset.section);
    });
});

function switchSection(sectionId) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
    
    document.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
    
    switch(sectionId) {
        case 'character':
            initCharacterCreation();
            break;
        case 'combat':
            initCombat();
            break;
        case 'quests':
            initQuests();
            break;
        case 'inventory':
            initInventory();
            break;
        case 'map':
            initMap();
            break;
    }
}

// Game Initialization
function initGame() {
    if (GameState.load() && GameState.character) {
        showGameInterface();
    } else {
        showStartScreen();
    }
}

function showStartScreen() {
    const startHTML = `
        <div class="panel" style="max-width: 600px; margin: 50px auto; text-align: center; padding: 40px;">
            <h2 style="font-family: 'Cinzel', serif; color: var(--gold-primary); font-size: 2rem; margin-bottom: 20px;">
                欢迎来到艾泽拉斯
            </h2>
            <p style="color: var(--text-muted); margin-bottom: 30px; line-height: 1.8;">
                在这片被战火与魔法洗礼的大陆上，<br>
                你将扮演一名英雄，探索未知，挑战强敌，<br>
                书写属于你的传奇故事。
            </p>
            <div style="font-size: 4rem; margin: 30px 0;">⚔️ 🛡️ 🔮</div>
            <button class="btn" onclick="showCharacterCreation()" style="font-size: 1.2rem; padding: 15px 40px;">
                开始冒险
            </button>
        </div>
    `;
    
    document.querySelector('.game-container').innerHTML = startHTML;
}

function showCharacterCreation() {
    location.reload();
}

function showGameInterface() {
    // Restore game UI structure and load state
    // (Full UI already defined in Task 1)
    
    document.querySelector('.game-container').innerHTML = `
        <header class="panel" style="text-align: center; margin-bottom: 20px; padding: 20px;">
            <h1 style="font-family: 'Cinzel', serif; color: var(--gold-primary); font-size: 2.5rem; text-shadow: 0 0 20px rgba(201,170,113,0.5);">
                ⚔️ 艾泽拉斯冒险 ⚔️
            </h1>
            <p style="color: var(--text-muted); font-style: italic;">
                ${GameState.character.name} - ${RACES[GameState.character.race].name} ${CLASSES[GameState.character.class].name}
            </p>
        </header>
        
        <nav class="nav-tabs">
            <button class="nav-tab active" data-section="character">📊 角色</button>
            <button class="nav-tab" data-section="combat">⚔️ 战斗</button>
            <button class="nav-tab" data-section="quests">📜 任务</button>
            <button class="nav-tab" data-section="inventory">🎒 背包</button>
            <button class="nav-tab" data-section="map">🗺️ 世界</button>
        </nav>
        
        <section id="character" class="section active">
            <div id="char-display" class="panel">
                <div class="panel-header">📊 角色信息</div>
                <div id="char-content"></div>
            </div>
        </section>
        
        <section id="combat" class="section">
            <div class="panel">
                <div class="panel-header">⚔️ 战斗竞技场</div>
                <div id="combat-area" style="padding: 20px;"></div>
            </div>
        </section>
        
        <section id="quests" class="section">
            <div class="panel">
                <div class="panel-header">📜 任务日志</div>
                <div id="quests-content" style="padding: 20px;"></div>
            </div>
        </section>
        
        <section id="inventory" class="section">
            <div class="panel">
                <div class="panel-header">🎒 背包</div>
                <div id="inventory-content" style="padding: 20px;"></div>
            </div>
        </section>
        
        <section id="map" class="section">
            <div class="panel">
                <div class="panel-header">🗺️ 艾泽拉斯世界</div>
                <div id="map-content" style="padding: 20px;"></div>
            </div>
        </section>
    `;
    
    // Add all sections' inner HTML
    document.getElementById('char-content').innerHTML = document.getElementById('character').querySelector('#char-creation')?.outerHTML || '';
    document.getElementById('combat-area').innerHTML = getCombatHTML();
    document.getElementById('quests-content').innerHTML = getQuestsHTML();
    document.getElementById('inventory-content').innerHTML = getInventoryHTML();
    document.getElementById('map-content').innerHTML = getMapHTML();
    
    // Re-attach navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchSection(tab.dataset.section);
        });
    });
    
    // Initialize character display
    renderCharacterDisplay();
}

function getCombatHTML() {
    return `
        <div id="no-character-msg" style="text-align: center; padding: 50px;">
            <p style="font-size: 1.2rem; color: var(--text-muted);">
                请先创建角色开始冒险！
            </p>
            <button class="btn" onclick="switchSection('character')" style="margin-top: 20px;">
                创建角色
            </button>
        </div>
        
        <div id="combat-interface" style="display: none;">
            <div class="combat-arena">
                <div class="combatant">
                    <h3 style="color: var(--gold-primary);" id="player-name">玩家</h3>
                    <div class="combatant-avatar" id="player-avatar">🧑</div>
                    <div class="stat-bar" style="margin: 10px auto; max-width: 200px;">
                        <div class="stat-fill hp-fill" id="player-hp-bar"></div>
                    </div>
                    <p id="player-hp-text">100 / 100</p>
                    <div class="stat-bar" style="margin: 10px auto; max-width: 200px;">
                        <div class="stat-fill mana-fill" id="player-mana-bar"></div>
                    </div>
                    <p id="player-mana-text">50 / 50</p>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; font-size: 3rem; color: var(--gold-dark);">
                    VS
                </div>
                
                <div class="combatant">
                    <h3 style="color: var(--red-blood);" id="enemy-name">敌人</h3>
                    <div class="combatant-avatar" id="enemy-avatar">👹</div>
                    <div class="stat-bar" style="margin: 10px auto; max-width: 200px;">
                        <div class="stat-fill hp-fill" id="enemy-hp-bar"></div>
                    </div>
                    <p id="enemy-hp-text">80 / 80</p>
                </div>
            </div>
            
            <div class="combat-log" id="combat-log">
                <p class="log-system">⚔️ 战斗开始！</p>
            </div>
            
            <div id="combat-actions" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 20px;">
            </div>
            
            <div id="combat-result" style="display: none; text-align: center; padding: 30px;">
            </div>
        </div>
    `;
}

function getQuestsHTML() {
    return `<div id="quests-list"></div>`;
}

function getInventoryHTML() {
    return `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
            <div>
                <h4 style="color: var(--gold-primary); margin-bottom: 15px;">物品栏</h4>
                <div class="inventory-grid" id="inventory-grid"></div>
            </div>
            <div id="item-details" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                <h4 style="color: var(--gold-primary);">物品详情</h4>
                <p style="color: var(--text-muted);" id="item-detail-text">选择一个物品查看详情</p>
            </div>
        </div>
    `;
}

function getMapHTML() {
    return `
        <div id="world-map" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
        </div>
        <div id="location-info" class="panel" style="padding: 20px; background: rgba(0,0,0,0.3);">
            <p style="color: var(--text-muted); text-align: center;">
                选择一个地点开始冒险
            </p>
        </div>
    `;
}

// Add to end of script
document.addEventListener('DOMContentLoaded', () => {
    initGame();
});
```

- [ ] **Step 1: Add navigation JavaScript**

- [ ] **Step 2: Add game initialization**

- [ ] **Step 3: Test complete game flow**

---

### Task 10: Polish & Final Testing

- [ ] **Step 1: Test character creation flow**

- [ ] **Step 2: Test combat with all abilities**

- [ ] **Step 3: Test quest system**

- [ ] **Step 4: Test inventory**

- [ ] **Step 5: Test world map**

- [ ] **Step 6: Test save/load with localStorage**

- [ ] **Step 7: Verify visual effects and animations**

---

## Verification Checklist

- [ ] Character creation with race/class selection works
- [ ] Combat turn-based system functional
- [ ] All 9 character classes have unique abilities
- [ ] Quest tracking updates correctly
- [ ] Inventory system allows item management
- [ ] World map allows location travel
- [ ] Game state persists via localStorage
- [ ] Visual effects (particles, animations) working
- [ ] Responsive design works on mobile
- [ ] No console errors

---

## Next Steps

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch subagents per task, fast iteration
2. **Inline Execution** - Execute tasks sequentially in this session

Which approach would you prefer?
