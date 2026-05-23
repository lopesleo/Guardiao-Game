// Balanceamento central. Tweak aqui, sem caçar números no código.
// Fórmulas paramétricas decididas no design (D16).

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE: 16,
  PIXEL_SCALE: 3,        // sprite 16x16 renderizado como 48x48
  WORLD_RADIUS: 1600,    // arena circular
  MAX_ENEMIES_ALIVE: 80, // cap de pooling (D18)
  RUN_DURATION_S: 420,   // 7 min até boss spawnar
};

export const PLAYER = {
  HP_BASE: 100,
  SPEED_BASE: 160,
  XP_PER_LEVEL: lvl => Math.floor(10 + lvl * 8 + lvl * lvl * 1.5),
  PICKUP_RADIUS: 36,
  INVULN_MS: 600,
};

export const ENEMY = {
  // wave = floor(t / 30); a cada 30s sobe a wave
  HP:   wave => 8 + 2.5 * wave,
  DMG:  wave => 1 + 0.3 * wave,
  SPEED_WOLF: 90,    // Morcego: rápido e errático (era "lobo")
  SPEED_CROW: 130,
  SPEED_GOBLIN: 55,
  // Curva mais suave: 0.5/s no início, ~3/s aos 5min, ~5/s aos 7min
  SPAWN_RATE: t => 0.5 + t / 90,
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
export const ELEMENT = { FIRE: 'fire', ICE: 'ice', BOLT: 'bolt' };

export const STATUS = {
  FIRE:  { duration: 4000, tickMs: 500, dmgPerTick: 1 },
  ICE:   { duration: 3000, slowFactor: 0.5, damageAmp: 1.35 },
  BOLT:  { duration: 2000, tickMs: 125, dmgPerTick: 0.5 },
};

export const REACTION = {
  // FIRE + ICE => Vapor: nuvem que lentifica área
  VAPOR:     { color: 0xb8d4ff, radius: 80, duration: 3000, slowFactor: 0.5, label: 'VAPOR!' },
  // ICE + BOLT => Cristal Estilhaçado: explosão em anel
  CRYSTAL:   { color: 0x5cc8ff, radius: 100, dmg: 25, label: 'CRISTAL!' },
  // FIRE + BOLT => Sobrecarga: corrente entre N inimigos
  OVERLOAD:  { color: 0xd98cff, jumps: 4, dmgPerJump: 12, label: 'SOBRECARGA!' },
};

// Armas base + evoluções (D14)
export const WEAPONS = {
  STAFF:    { name: 'Cajado',           element: 'fire', baseDmg: 8,  cooldown: 800,  range: 280, projSpeed: 320 },
  AURA:     { name: 'Aura Gélida',      element: 'ice',  baseDmg: 3,  cooldown: 600,  range: 120 },
  BOOMER:   { name: 'Bumerangue',       element: 'fire', baseDmg: 6,  cooldown: 1400, range: 240, projSpeed: 280 },
  CHAIN:    { name: 'Raio Encadeado',   element: 'bolt', baseDmg: 7,  cooldown: 1200, range: 220, jumps: 3 },
  // evoluções (D12)
  VAPOR_STORM: { name: 'Tempestade de Vapor', evolvesFrom: ['STAFF','AURA'],   baseDmg: 14, cooldown: 700 },
  OVERLOAD_X:  { name: 'Sobrecarga Eterna',   evolvesFrom: ['STAFF','CHAIN'],  baseDmg: 16, cooldown: 900 },
};

export const WEAPON_LEVEL_DMG = (base, lvl) => base * (1 + 0.25 * (lvl - 1));
export const MAX_WEAPON_LEVEL = 5;

// Upgrades passivos (D8 final)
export const PASSIVES = [
  { id: 'hp',       name: '+20% HP Máximo',         apply: p => p.maxHp *= 1.20 },
  { id: 'speed',    name: '+15% Velocidade',         apply: p => p.speed  *= 1.15 },
  { id: 'cooldown', name: '-15% Recarga de armas',   apply: p => p.cdMult *= 0.85 },
  { id: 'area',     name: '+20% Área de efeito',     apply: p => p.areaMult *= 1.20 },
  { id: 'proj',     name: '+1 Projétil',             apply: p => p.extraProj += 1 },
];

// Meta-progressão (D5 reduzido)
export const META = {
  STORAGE_KEY: 'guardiao_save_v1',
  COIN_VALUE: 1,           // moedas por inimigo (chance)
  COIN_BOSS_WIN: 50,
  COIN_BOSS_LOSS: 0,
  WEAPON_UNLOCK_COST: { BOOMER: 30, CHAIN: 60, AURA: 100 },
  // STAFF começa desbloqueada
};

export const COLORS = {
  FIRE:  0xff7a3c,
  ICE:   0x5cc8ff,
  BOLT:  0xd98cff,
  GOLD:  0xd9b25c,
  INK:   0xe8f0e6,
  BG:    0x0a0e0a,
  DANGER: 0xff5a6e,
  XP:     0x6fcf6f,
};
