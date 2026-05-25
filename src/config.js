// Balanceamento central. Tweak aqui, sem caçar números no código.
// Fórmulas paramétricas decididas no design (D16).

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE: 16,
  PIXEL_SCALE: 3, // sprite 16x16 renderizado como 48x48
  WORLD_RADIUS: 2400, // arena circular (era 1600)
  MAX_ENEMIES_ALIVE: 80, // cap de pooling (D18)
  RUN_DURATION_S: 420, // 7 min até boss spawnar
};

export const PLAYER = {
  HP_BASE: 100,
  SPEED_BASE: 160,
  // Curva mais suave: evoluir não pode demorar tanto (feedback dos testers)
  XP_PER_LEVEL: (lvl) => Math.floor(5 + lvl * 4 + lvl * lvl * 0.8),
  PICKUP_RADIUS: 36,
  INVULN_MS: 350, // i-frames pós-dano — menor = tick de dano de contato mais rápido
  // Despertar (★ DIFERENCIAL) — max escala com level pra evitar spam em late game
  AWAKEN_METER_MAX: (lvl) => 100 + (lvl - 1) * 25,
  AWAKEN_GAIN_REACTION: 12, // por reação elemental disparada (era 25)
  AWAKEN_GAIN_KILL: 1, // por inimigo morto
  AWAKEN_DURATION_MS: 6000,
  AWAKEN_CD_AFTER_MS: 1500, // pequeno alongamento pra evitar back-to-back
  AWAKEN_CD_MULT: 0.4,
  AWAKEN_SPEED_MULT: 1.4,
  // Dash
  DASH_SPEED_MULT: 4.5,
  DASH_DURATION_MS: 180,
  DASH_INVULN_MS: 280,
  DASH_CD_MS: 4000,
};

export const ENEMY = {
  // wave = floor(t / 30); a cada 30s sobe a wave
  // Curva: começo mais suave, late-game duro (mas o dano de contato SOMA, então cuidado)
  HP: (wave) => 12 + 6 * wave,
  DMG: (wave) => 2 + 0.9 * wave,
  SPEED_WOLF: 95,
  SPEED_CROW: 140,
  SPEED_GOBLIN: 60,
  SPAWN_RATE: (t) => 0.6 + t / 75,
  XP_VALUE: 1,
  COIN_DROP_CHANCE: 0.05,
};

export const BOSS = {
  HP: 2000,
  PHASE2_AT_HP_PCT: 0.5,
  DMG_MELEE: 12,
  DMG_PROJECTILE: 8,
  SPEED: 60,
  ROAR_DURATION_MS: 1500,
};

// Elementos & reações (D11, D21)
export const ELEMENT = { FIRE: "fire", ICE: "ice", BOLT: "bolt" };

export const STATUS = {
  FIRE: { duration: 4000, tickMs: 500, dmgPerTick: 1 },
  ICE: { duration: 3000, slowFactor: 0.5, damageAmp: 1.35 },
  BOLT: { duration: 2000, tickMs: 125, dmgPerTick: 0.5 },
};

export const REACTION = {
  // FIRE + ICE => Vapor: nuvem ESCALDANTE que causa dano contínuo na área (não dá mais slow)
  VAPOR: {
    color: 0xffc8a0,
    radius: 80,
    duration: 3000,
    dmgPerTick: 5,
    tickMs: 300,
    label: "VAPOR!",
  },
  // CONGELADO + BOLT => Cristal: o inimigo congelado ESTILHAÇA em lascas curtas (dano BAIXO)
  CRYSTAL: {
    color: 0x9fe8ff,
    radius: 70,
    dmg: 6,
    selfDmg: 14,
    shards: 8,
    label: "CRISTAL!",
  },
  // FIRE + BOLT => Sobrecarga: a recompensa em ÁREA — corrente forte entre muitos inimigos
  OVERLOAD: {
    color: 0xffe24c,
    jumps: 6,
    dmgPerJump: 16,
    jumpRange: 220,
    label: "SOBRECARGA!",
  },
};

// Armas base + evoluções (D14)
export const WEAPONS = {
  STAFF: {
    name: "Cajado",
    element: ELEMENT.FIRE,
    baseDmg: 7,
    cooldown: 1100,
    range: 280,
    projSpeed: 300,
  },
  // Aura Gélida: campo de CONTROLE. Dano de chip + slow; quem fica 1s dentro CONGELA.
  AURA: {
    name: "Aura Gélida",
    element: ELEMENT.ICE,
    baseDmg: 2,
    cooldown: 1200,
    range: 120,
    freezeAfterMs: 900,
    freezeMs: 1300,
    freezeImmuneMs: 3000,
  },
  BOOMER: {
    name: "Bumerangue",
    element: ELEMENT.FIRE,
    baseDmg: 4,
    cooldown: 1600,
    range: 240,
    projSpeed: 280,
  },
  // Raio: dano ALTO focado em 1 alvo. (A "corrente" agora é a reação Sobrecarga: fogo+raio.)
  CHAIN: {
    name: "Raio Concentrado",
    element: ELEMENT.BOLT,
    baseDmg: 15,
    cooldown: 1800,
    range: 190,
  },
  // evoluções (D12)
  VAPOR_STORM: {
    name: "Tempestade de Vapor",
    evolvesFrom: ["STAFF", "AURA"],
    baseDmg: 12,
    cooldown: 700,
  },
  OVERLOAD_X: {
    name: "Sobrecarga Eterna",
    evolvesFrom: ["STAFF", "CHAIN"],
    baseDmg: 25,
    cooldown: 900,
  },
};

export const WEAPON_LEVEL_DMG = (base, lvl) => base * (1 + 0.25 * (lvl - 1));
export const MAX_WEAPON_LEVEL = 5;

// Upgrades passivos (level-up). roll() retorna { name, apply } com valor aleatório.
const r = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const rf = (min, max) => +(min + Math.random() * (max - min)).toFixed(2);

export const PASSIVES = [
  {
    id: "hp",
    roll: () => {
      const v = r(10, 25);
      return {
        name: `+${v}% HP Máximo`,
        apply: (p) => {
          const gain = p.maxHp * (v / 100); // HP máximo ganho
          p.maxHp += gain;
          p.hp = Math.min(p.maxHp, p.hp + gain); // o bônus já chega PREENCHIDO
        },
      };
    },
  },
  {
    id: "speed",
    roll: () => {
      const v = r(8, 18);
      return {
        name: `+${v}% Velocidade`,
        apply: (p) => {
          p.speed *= 1 + v / 100;
        },
      };
    },
  },
  {
    id: "cooldown",
    roll: () => {
      const v = r(8, 20);
      return {
        name: `-${v}% Recarga`,
        apply: (p) => {
          p.cdMult *= 1 - v / 100;
        },
      };
    },
  },
  {
    id: "area",
    roll: () => {
      const v = r(10, 30);
      return {
        name: `+${v}% Área`,
        apply: (p) => {
          p.areaMult *= 1 + v / 100;
        },
      };
    },
  },
  {
    id: "proj",
    roll: () => ({
      name: "+1 Projétil (Cajado/Raio)",
      apply: (p) => {
        p.extraProj += 1;
      },
    }),
  },
  {
    id: "lifesteal",
    roll: () => {
      const v = r(3, 8);
      return {
        name: `+${v}% Roubo de Vida`,
        apply: (p) => {
          p.lifestealPct += v / 100;
        },
      };
    },
  },
  {
    id: "regen",
    roll: () => {
      const v = rf(0.5, 2.0);
      return {
        name: `+${v} HP/s`,
        apply: (p) => {
          p.regenPerSec += v;
        },
      };
    },
  },
  {
    id: "crit",
    roll: () => {
      const v = r(5, 12);
      return {
        name: `+${v}% Chance Crítica`,
        apply: (p) => {
          p.critChance += v / 100;
        },
      };
    },
  },
];

// Drops aleatórios no chão (chance por kill)
export const DROPS = {
  COIN_CHANCE: 0.25, //25% de chance de dropar moeda
  HEART_CHANCE: 0.05,
  AWAKEN_CHANCE: 0.018,
  HEART_HEAL: 20,
  AWAKEN_REFILL: 25,
};

// Baús (lootboxes) — animação real entre frames + mecânica mimic
export const CHEST = {
  SPRITE_TEXTURE: "dungeon_tiles",
  SPRITE_FRAME_CLOSED: 89, // baú fechado
  SPRITE_FRAME_HALF: 90, // semi-aberto (frame intermediário)
  SPRITE_FRAME_OPEN: 91, // totalmente aberto
  SPRITE_FRAME_MIMIC: 92, // baú-mímico (com língua)
  INTERACT_RADIUS: 50,
  STARTING_COUNT: 5,
  KILL_DROP_EVERY: 50,
  // chances de tipo de loot (somam até 100%, resto = normal)
  TRAP_CHANCE: 0.12, // 12% — 4 inimigos elite
  GOLDEN_CHANCE: 0.06, // 6% — jackpot
  MIMIC_CHANCE: 0.07, // 7% — 1 mímico super forte
  // base loot (sempre)
  GEMS_MIN: 4,
  GEMS_MAX: 8,
  COINS_MIN: 2,
  COINS_MAX: 8,
  HEART_CHANCE_OPEN: 0.3,
  AWAKEN_CHANCE_OPEN: 0.3,
  // golden bonus
  GOLDEN_EXTRA_COINS: 40,
  // trap
  TRAP_ENEMY_COUNT: 6,
};

// Inimigos elite (spawnam da armadilha de baú)
export const ELITE = {
  HP_MULT: 2.0,
  SCALE_MULT: 1.6,
  CONTACT_RADIUS: 38,
  TINT: 0xff6666,
};

// Mímico (chest com língua) — inimigo único super forte
export const MIMIC = {
  HP_MULT: 9.0, // muito mais tanque
  HP_FLOOR: 380, // piso de HP: nunca trivial, mesmo spawnando cedo
  SCALE_MULT: 1.8,
  DMG_MULT: 3.0,
  SPEED: 115, // mais rápido que o lobo (95): persegue de verdade
  CONTACT_RADIUS: 52, // hitbox de contato maior (sprite gigante)
  TINT: 0xff3333,
};

// Meta-progressão
export const META = {
  STORAGE_KEY: "guardiao_save_v1",
  COIN_VALUE: 1,
  COIN_BOSS_WIN: 80,
  COIN_BOSS_LOSS: 10,
  WEAPON_UNLOCK_COST: { BOOMER: 30, CHAIN: 60, AURA: 100 },
  ABILITY_UNLOCK_COST: { DASH: 50, AWAKEN: 80 },
};

// Bênçãos persistentes — compradas no menu com moedas, aplicadas em toda run futura.
// `apply(player)` é chamado uma vez no início da GameScene.
export const BLESSINGS = [
  {
    id: "hp1",
    name: "Vigor da Mata",
    desc: "+20 HP máximo",
    cost: 40,
    apply: (p) => {
      p.maxHp += 20;
      p.hp = p.maxHp;
    },
  },
  {
    id: "spd1",
    name: "Pés Ligeiros",
    desc: "+10% velocidade",
    cost: 60,
    apply: (p) => {
      p.speed *= 1.1;
    },
  },
  {
    id: "dmg1",
    name: "Cólera Antiga",
    desc: "Armas começam com +15% dano",
    cost: 90,
    apply: (p) => {
      p._blessingDmgMult = (p._blessingDmgMult || 1) * 1.15;
    },
  },
  {
    id: "pickup",
    name: "Olhar de Coruja",
    desc: "+50% raio de coleta",
    cost: 50,
    apply: (p) => {
      p.pickupRadius *= 1.5;
    },
  },
  {
    id: "awaken1",
    name: "Eco do Despertar",
    desc: "Despertar enche 30% mais rápido",
    cost: 80,
    apply: (p) => {
      p._awakenGainMult = (p._awakenGainMult || 1) * 1.3;
    },
  },
  {
    id: "dash1",
    name: "Sopro do Vento",
    desc: "Dash recarrega 30% mais rápido",
    cost: 70,
    apply: (p) => {
      p._dashCdMult = (p._dashCdMult || 1) * 0.7;
    },
  },
  {
    id: "xp1",
    name: "Sabedoria",
    desc: "+20% XP de inimigos",
    cost: 100,
    apply: (p) => {
      p._xpMult = (p._xpMult || 1) * 1.2;
    },
  },
  {
    id: "crit1",
    name: "Olhar do Caçador",
    desc: "+12% chance de crítico",
    cost: 90,
    apply: (p) => {
      p.critChance += 0.12;
    },
  },
];

export const COLORS = {
  FIRE: 0xff7a3c,
  ICE: 0x5cc8ff,
  BOLT: 0xd98cff,
  GOLD: 0xd9b25c,
  INK: 0xe8f0e6,
  BG: 0x0a0e0a,
  DANGER: 0xff5a6e,
  XP: 0x6fcf6f,
};
