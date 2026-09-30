// Os quatro guardiões são LENDAS DA MATA (ver docs/TEMA_FOLCLORE.md):
//   guardian → Curupira (cabelo de fogo, pés virados para trás, cajado)
//   huntress → Caipora (cabeleira de folhas, protetora dos bichos, bumerangue)
//   druid    → Iara (senhora das águas, cabelo longo, vestido de escamas)
//   shaman   → Saci (uma perna só, gorro vermelho, redemoinho elétrico)
// Retratos respeitosos: heróis espertos e poderosos, sem caricatura; Saci sem
// cachimbo; Caipora sem peles de animal (ela protege os bichos).
// Desenho por primitivas, virados para a DIREITA. Quadros: 0-1 parado
// (respiração), 2-5 caminhada. Os ids internos não mudam (save/config).
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";

export const HERO_W = 24;
export const HERO_H = 28;
const FEET = HERO_H - 2;

const SKIN = { base: 0x9a6a4a, shade: 0x7a4e36, light: 0xb8805a };
// Pele marrom com luz e sombra reais (nunca silhueta escura com olho/dente
// branco em destaque — isso é caricatura; ver docs/TEMA_FOLCLORE.md)
const SKIN_DARK = { base: 0x7a4a32, shade: 0x5e3826, light: 0x9a6446 };

// Olho virado para a direita: branco + pupila
function eye(p, x, y) {
  p.set(x, y, PAL.white);
  p.set(x + 1, y, PAL.ink);
}

// Cabeça oval sombreada (luz vinda da esquerda/cima)
function head(p, cx, cy, rx, ry, sk) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, -dx * 0.5 - dy * 0.4 > 0.35 ? sk.light : dx > 0.55 || dy > 0.6 ? sk.shade : sk.base);
    }
}

// Tronco em trapézio com rampa de 3 cores (claro à esquerda)
function torso(p, top, bot, xl0, xr0, spreadL, spreadR, ramp) {
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / Math.max(1, bot - top);
    const xl = Math.round(xl0 - t * spreadL),
      xr = Math.round(xr0 + t * spreadR);
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / Math.max(1, xr - xl);
      p.set(x, y, x === xl ? ramp[2] : u < 0.35 ? ramp[1] : ramp[0]);
    }
  }
}

function leg(p, x, top, lift, col, dark) {
  for (let y = top; y <= FEET - lift; y++) {
    p.set(x, y, col);
    p.set(x + 1, y, dark);
  }
}

// ---------------------------------------------------------------------------
// CURUPIRA — menino guardião da mata: cabelo em chamas, tanga de folhas, pés
// virados para TRÁS (apontam para a esquerda enquanto ele olha para a direita)
// ---------------------------------------------------------------------------
function drawCurupira(pose, flick) {
  const p = new Pix(HERO_W, HERO_H);
  const b = pose.bob;
  // Pernas + pés virados para trás
  const L = (x, lift) => {
    leg(p, x, 19, lift, SKIN.base, SKIN.shade);
    const fy = FEET - lift;
    p.set(x - 1, fy, SKIN.shade);
    p.set(x - 2, fy, SKIN.shade); // dedos para trás!
    p.set(x - 1, fy - 1, SKIN.base);
  };
  L(9 - (pose.step > 0 ? 1 : 0), pose.step < 0 ? 1 : 0);
  L(13 + (pose.step < 0 ? 1 : 0), pose.step > 0 ? 1 : 0);
  // Corpo (pele) e tanga de folhas com barra serrilhada
  torso(p, 12 + b, 17, 9, 14, 0, 0, [SKIN.shade, SKIN.base, SKIN.light]);
  for (let y = 16; y <= 20; y++)
    for (let x = 8; x <= 15; x++) {
      if (y === 20 && (x + pose.step) % 2) continue;
      p.set(x, y, y === 16 ? PAL.g3 : x < 10 ? PAL.g6 : x % 3 ? PAL.g5 : PAL.g4);
    }
  // Colar de sementes
  for (let x = 10; x <= 14; x++) p.set(x, 13 + b, x % 2 ? PAL.red2 : PAL.yel2);
  // Cajado com orbe de fogo (a arma dele)
  const sx = 19;
  for (let y = 6 + b; y <= FEET; y++) p.set(sx, y, y % 4 ? PAL.n3 : PAL.n2);
  p.disc(sx + 0.5, 3.5 + b, 2.6, PAL.org1);
  p.disc(sx + 0.2, 3.2 + b, 1.9, PAL.org2);
  p.set(sx, 2 + b, PAL.yel3);
  // Braço segurando o cajado
  for (let x = 15; x <= 18; x++) p.set(x, 14 + b, SKIN.base);
  p.set(18, 15 + b, SKIN.shade);
  // Cabeça
  head(p, 11.5, 8.5 + b, 4, 3.8, SKIN);
  eye(p, 13, 8 + b);
  p.set(14, 10 + b, SKIN.shade); // sorriso de canto
  // Cabelo em CHAMAS (as pontas tremulam entre quadros)
  const flame = [PAL.red1, PAL.org1, PAL.org2, PAL.yel3];
  const spikes = [
    [7, 3],
    [9, 1],
    [11, 0],
    [13, 1],
    [15, 3],
    [6, 6],
  ];
  for (const [x0, top] of spikes) {
    const t = top + (flick && x0 % 2 ? 1 : 0);
    for (let y = t + b; y <= 7 + b; y++) {
      const k = Math.min(3, Math.floor((y - t - b) / 2));
      p.set(x0, y, flame[3 - k]);
      p.set(x0 + 1, y, flame[Math.max(0, 2 - k)]);
    }
  }
  for (let x = 7; x <= 15; x++) p.set(x, 6 + b, x < 10 ? PAL.org2 : PAL.org1);
  p.set(7, 7 + b, PAL.org1);
  p.set(7, 8 + b, PAL.red1);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CAIPORA — protetora dos bichos: cabeleira longa de folhas e cipós, túnica de
// fibra trançada, colar de urucum, bumerangue de madeira em brasa
// ---------------------------------------------------------------------------
function drawCaipora(pose) {
  const p = new Pix(HERO_W, HERO_H);
  const b = pose.bob;
  leg(p, 9 - (pose.step > 0 ? 1 : 0), 20, pose.step < 0 ? 1 : 0, SKIN_DARK.base, SKIN_DARK.shade);
  leg(p, 13 + (pose.step < 0 ? 1 : 0), 20, pose.step > 0 ? 1 : 0, SKIN_DARK.base, SKIN_DARK.shade);
  // Cabeleira de folhas descendo pelas costas (atrás do corpo)
  for (let y = 5 + b; y <= 20; y++)
    for (let x = 5; x <= 9; x++) {
      if (x === 5 && y < 9 + b) continue;
      if (y > 17 && x > 7) continue;
      p.set(x, y, (x + y) % 3 === 0 ? PAL.g6 : (x + y) % 3 === 1 ? PAL.g5 : PAL.g3);
    }
  // Túnica de fibra trançada (xadrez de palha)
  torso(p, 12 + b, 21, 9, 14, 1, 1, [PAL.n3, PAL.n4, PAL.yel1]);
  for (let y = 13 + b; y <= 21; y++)
    for (let x = 8; x <= 15; x++) if (p.get(x, y) && (x + y) % 4 === 0) p.set(x, y, PAL.n2);
  // Colar de urucum
  for (let x = 10; x <= 14; x++) p.set(x, 12 + b, x % 2 ? PAL.red2 : PAL.red1);
  // Bumerangue em brasa na mão
  for (let x = 16; x <= 18; x++) p.set(x, 14 + b, SKIN_DARK.base);
  const bx = 19,
    by = 11 + b;
  const boom = [
    [0, 0],
    [1, 0],
    [2, 1],
    [2, 2],
    [3, 3],
    [0, 1],
  ];
  for (const [dx, dy] of boom) p.set(bx + dx, by + dy, PAL.n3);
  p.set(bx + 2, by + 1, PAL.org2);
  p.set(bx + 3, by + 3, PAL.org3);
  // Cabeça
  head(p, 11.5, 8.5 + b, 4, 3.8, SKIN_DARK);
  eye(p, 13, 8 + b);
  // Coroa de folhas por cima
  for (let x = 7; x <= 15; x++) p.set(x, 4 + b, x % 2 ? PAL.g5 : PAL.g6);
  for (let x = 8; x <= 14; x += 2) p.set(x, 3 + b, PAL.g6);
  p.set(15, 5 + b, PAL.g4);
  p.set(16, 5 + b, PAL.pink); // florzinha
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// IARA — senhora das águas: cabelo longo negro-azulado, concha, vestido de
// escamas que termina numa barra em forma de nadadeira (flutua: sem pés)
// ---------------------------------------------------------------------------
function drawIara(pose) {
  const p = new Pix(HERO_W, HERO_H);
  const b = pose.bob;
  const wave = pose.step; // a barra ondula ao andar
  // Cabelo longo atrás (até a cintura)
  for (let y = 5 + b; y <= 18; y++)
    for (let x = 6; x <= 10; x++) {
      if (x === 6 && y < 8 + b) continue;
      p.set(x, y, x === 7 && y % 3 === 0 ? PAL.ice1 : y % 4 === 1 ? PAL.pur0 : PAL.ice0);
    }
  // Vestido de escamas (turquesa → azul) abrindo em nadadeira
  torso(p, 12 + b, 23, 9, 14, 2, 2, [PAL.ice1, PAL.ice2, PAL.ice3]);
  for (let y = 13 + b; y <= 23; y++)
    for (let x = 7; x <= 16; x++) if (p.get(x, y) && (x + (y % 2)) % 3 === 0) p.set(x, y, 0x4a8fd0);
  // Nadadeira: duas pontas que ondulam
  const fin = (x0, dir) => {
    for (let k = 0; k < 3; k++) {
      p.set(x0 + dir * k, 24 + (k === 2 ? 1 : 0) + (wave === dir ? 0 : k === 2 ? -1 : 0), k === 2 ? PAL.ice3 : PAL.ice2);
      p.set(x0 + dir * k, 25, k ? PAL.ice1 : PAL.ice2);
    }
  };
  fin(10, -1);
  fin(13, 1);
  // Gotinhas em volta
  p.set(3, 16 - b, PAL.ice3);
  p.set(19, 20 + b, PAL.ice3);
  // Braço estendido (aura de gelo)
  for (let x = 15; x <= 18; x++) p.set(x, 14 + b, SKIN.base);
  p.set(19, 13 + b, PAL.ice3);
  p.set(20, 14 + b, PAL.white);
  p.set(19, 15 + b, PAL.ice2);
  // Cabeça
  head(p, 11.5, 8.5 + b, 4, 3.8, SKIN);
  eye(p, 13, 8 + b);
  p.set(13, 10 + b, SKIN.shade);
  // Franja e topo do cabelo
  for (let x = 8; x <= 15; x++) p.set(x, 4 + b, x > 13 ? PAL.ice0 : PAL.pur0);
  for (let x = 8; x <= 12; x++) p.set(x, 5 + b, PAL.ice0);
  p.set(15, 5 + b, PAL.ice0);
  // Concha no cabelo
  p.set(9, 4 + b, PAL.pink);
  p.set(10, 4 + b, PAL.cream);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// SACI — uma perna só, gorro vermelho, bermuda vermelha; pula em vez de andar;
// um redemoinho de raios gira em volta do pé. Sorriso confiante, sem cachimbo.
// ---------------------------------------------------------------------------
function drawSaci(pose, frame) {
  const p = new Pix(HERO_W, HERO_H);
  // Pulo: sobe nos quadros de passo
  const hop = pose.step !== 0 ? 2 : 0;
  const b = pose.bob - hop;
  // Redemoinho de raios em volta do pé (gira entre quadros)
  const whirl = [PAL.pur1, PAL.pur2, PAL.pur3];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + frame * 0.9;
    const x = Math.round(12 + Math.cos(a) * 5),
      y = Math.round(24 + Math.sin(a) * 1.6);
    p.set(x, y, whirl[k % 3]);
  }
  // Uma perna só (centro)
  for (let y = 19 + b; y <= FEET - hop; y++) {
    p.set(11, y, SKIN_DARK.base);
    p.set(12, y, SKIN_DARK.shade);
  }
  p.set(13, FEET - hop, SKIN_DARK.base); // pé
  // Bermuda vermelha
  for (let y = 16 + b; y <= 19 + b; y++) for (let x = 9; x <= 14; x++) p.set(x, y, x === 9 ? PAL.red3 : x < 12 ? PAL.red2 : PAL.red1);
  // Tronco (pele) magro
  torso(p, 11 + b, 15 + b, 9, 14, 0, 0, [SKIN_DARK.shade, SKIN_DARK.base, SKIN_DARK.light]);
  // Braço erguido soltando faísca
  p.set(15, 12 + b, SKIN_DARK.base);
  p.set(16, 11 + b, SKIN_DARK.base);
  p.set(17, 10 + b, SKIN_DARK.base);
  p.set(18, 9 + b, PAL.pur3);
  p.set(19, 8 + b, PAL.white);
  p.set(18, 7 + b, PAL.pur2);
  // Cabeça
  head(p, 11.5, 7.5 + b, 3.8, 3.6, SKIN_DARK);
  eye(p, 13, 7 + b);
  p.set(14, 9 + b, SKIN_DARK.shade); // sorriso de canto, discreto como nos outros
  p.set(13, 9 + b, SKIN_DARK.light);
  // Gorro vermelho caindo para trás
  const cap = [PAL.red1, PAL.red2, PAL.red3];
  for (let x = 8; x <= 15; x++) p.set(x, 4 + b, x < 10 ? cap[2] : cap[1]);
  for (let x = 8; x <= 14; x++) p.set(x, 3 + b, cap[1]);
  for (let x = 7; x <= 12; x++) p.set(x, 2 + b, x < 9 ? cap[2] : cap[1]);
  p.set(6, 2 + b, cap[1]);
  p.set(5, 3 + b, cap[1]);
  p.set(4, 4 + b, cap[0]);
  p.set(4, 5 + b, cap[0]);
  p.outline(PAL.ink);
  return p;
}

const DRAW = {
  guardian: (pose, i) => drawCurupira(pose, i % 2),
  huntress: (pose) => drawCaipora(pose),
  druid: (pose) => drawIara(pose),
  shaman: (pose, i) => drawSaci(pose, i),
};

// Registra hero_<id> (6 quadros) + animações <id>_idle / <id>_walk
export function registerHeroes(scene) {
  const poses = [
    { bob: 0, step: 0 },
    { bob: 1, step: 0 },
    { bob: 0, step: 1 },
    { bob: 1, step: 0 },
    { bob: 0, step: -1 },
    { bob: 1, step: 0 },
  ];
  for (const [id, draw] of Object.entries(DRAW)) {
    registerStrip(scene, `hero_${id}`, poses.map((pose, i) => draw(pose, i)));
    const mk = (key, frames, rate) => {
      if (!scene.anims.exists(key))
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(`hero_${id}`, { frames }), frameRate: rate, repeat: -1 });
    };
    mk(`${id}_idle`, [0, 0, 1, 1], 3);
    mk(`${id}_walk`, [2, 3, 4, 5], 9);
  }
}
