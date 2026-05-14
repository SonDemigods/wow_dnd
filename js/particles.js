
/**
 * Particle System Module
 * Creates and manages particle effects for magic, fire, and ambient effects
 */

const MAGIC_COLORS = {
  fire: {
    primary: '#ff6b35',
    secondary: '#ff8c42',
    glow: 'rgba(255, 107, 53, 0.6)'
  },
  ice: {
    primary: '#4fc3f7',
    secondary: '#81d4fa',
    glow: 'rgba(79, 195, 247, 0.6)'
  },
  shadow: {
    primary: '#5c2d91',
    secondary: '#7b1fa2',
    glow: 'rgba(92, 45, 145, 0.6)'
  },
  lightning: {
    primary: '#ffeb3b',
    secondary: '#fff176',
    glow: 'rgba(255, 235, 59, 0.6)'
  },
  nature: {
    primary: '#4caf50',
    secondary: '#81c784',
    glow: 'rgba(76, 175, 80, 0.6)'
  },
  arcane: {
    primary: '#6b3fa0',
    secondary: '#9b6fd0',
    glow: 'rgba(107, 63, 160, 0.6)'
  }
};

class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.ambientParticles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticle(x, y, color, type = 'default', options = {}) {
    const particle = {
      x,
      y,
      vx: options.vx !== undefined ? options.vx : (Math.random() - 0.5) * 2,
      vy: options.vy !== undefined ? options.vy : (Math.random() - 0.5) * 2 - 1,
      size: options.size || Math.random() * 3 + 1,
      color,
      alpha: 1,
      decay: options.decay || Math.random() * 0.02 + 0.01,
      type,
      life: options.life || 100,
      maxLife: options.life || 100,
      glow: options.glow || false,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1
    };
    this.particles.push(particle);
  }

  createEmber(x, y) {
    const colors = ['#c9aa71', '#e8c872', '#ffd700', '#ff8c42'];
    this.createParticle(
      x, y,
      colors[Math.floor(Math.random() * colors.length)],
      'ember',
      {
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 1.5 - 0.5,
        size: Math.random() * 3 + 1.5,
        decay: Math.random() * 0.008 + 0.003,
        glow: true
      }
    );
  }

  createMagicParticle(x, y, type) {
    const colors = MAGIC_COLORS[type] || MAGIC_COLORS.arcane;
    const colorChoice = Math.random() > 0.5 ? colors.primary : colors.secondary;
    this.createParticle(x, y, colorChoice, type, {
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: Math.random() * 5 + 2,
      decay: Math.random() * 0.03 + 0.01,
      glow: true,
      life: Math.random() * 60 + 40
    });
  }

  createAmbientEmber() {
    const x = Math.random() * this.canvas.width;
    const colors = ['#c9aa71', '#e8c872', '#ffd700', '#ff8c42'];
    const particle = {
      x,
      y: this.canvas.height + 10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 1 - 0.5,
      size: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.4 + 0.2,
      decay: 0.002,
      type: 'ambient-ember',
      glow: true,
      flickerSpeed: Math.random() * 0.05 + 0.02,
      flickerPhase: Math.random() * Math.PI * 2
    };
    this.ambientParticles.push(particle);
  }

  update() {
    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.alpha -= p.decay;
      p.rotation += p.rotationSpeed;

      if (p.type === 'fire') {
        p.vy -= 0.05;
        p.size *= 0.98;
      } else if (p.type === 'ice') {
        p.vy += 0.02;
      }

      return p.alpha > 0 && p.life > 0 && p.size > 0.5;
    });

    this.ambientParticles = this.ambientParticles.filter((p) => {
      p.x += p.vx + Math.sin(Date.now() * 0.001 + p.flickerPhase) * 0.3;
      p.y += p.vy;
      p.flickerPhase += p.flickerSpeed;
      p.alpha = (Math.sin(p.flickerPhase) * 0.3 + 0.5) * 0.6;
      return p.y > -20 && p.alpha > 0.1;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ambientParticles.forEach((p) => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      if (p.glow) {
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = p.color;
      }
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    this.particles.forEach((p) => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);

      if (p.glow) {
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = p.color;
      }

      this.ctx.fillStyle = p.color;

      if (p.type === 'ember' || p.type === 'magic') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    });
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }

  createMagicBurst(x, y, type, particleCount = 30) {
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      const particle = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? MAGIC_COLORS[type].primary : MAGIC_COLORS[type].secondary,
        alpha: 1,
        decay: Math.random() * 0.02 + 0.01,
        type: type,
        life: 60,
        maxLife: 60,
        glow: true,
        rotation: 0,
        rotationSpeed: 0
      };
      this.particles.push(particle);
    }
  }

  createExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = Math.random() * 4 + 1;
      this.createParticle(x, y, color, 'explosion', {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 2,
        decay: 0.025,
        glow: true,
        life: 50
      });
    }
  }
}

function createMagicParticles(type, x, y, ps) {
  if (!ps) return;
  const count = 30;
  const colors = MAGIC_COLORS[type] || MAGIC_COLORS.arcane;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const distance = Math.random() * 100 + 50;
    const targetX = x + Math.cos(angle) * distance;
    const targetY = y + Math.sin(angle) * distance;

    for (let j = 0; j < 3; j++) {
      ps.createMagicParticle(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20,
        type
      );
    }
  }

  ps.createMagicBurst(x, y, type, 40);
}

function initParticles() {
  const particleCanvas = document.getElementById('particle-canvas');
  particleSystem = new ParticleSystem(particleCanvas);
  particleSystem.animate();

  setInterval(() => {
    particleSystem.createAmbientEmber();
  }, 150);

  setInterval(() => {
    if (Math.random() > 0.5) {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight * 0.7;
      const types = ['fire', 'ice', 'shadow', 'lightning', 'nature', 'arcane'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      particleSystem.createMagicParticle(x, y, randomType);
    }
  }, 800);
}
