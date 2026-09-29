// Herói próprio (substitui o mago genérico do Tiny Dungeon): o Guardião é um
// espírito da mata — capuz de folhas, galhada, rosto na sombra com olhos que
// brilham, manto com barra de folhas e cajado com orbe elemental.
// Desenhado por primitivas no motor de pixel-art; 4 variantes de cor = os 4
// personagens. Quadros: 0-1 respiração (parado), 2-5 caminhada.
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";

export const HERO_W = 24;
export const HERO_H = 28;

export const HERO_VARIANTS = {
  guardian: {
    // Capuz de musgo CLARO + manto de casca: contrasta com o chão verde-escuro
    hood: [PAL.g3, PAL.g4, PAL.g5, PAL.g6], // escuro → claro
    cloak: [PAL.n1, PAL.n2, PAL.n3, PAL.n4],
    trim: [PAL.g5, PAL.yel2],
    horn: [PAL.n3, PAL.n4, PAL.cream],
    eye: PAL.yel3,
    orb: [PAL.org1, PAL.org2, PAL.yel3],
    hand: PAL.n4,
  },
  huntress: {
    hood: [PAL.n1, PAL.n2, PAL.n3, PAL.n4],
    cloak: [PAL.red0, PAL.red1, 0xb8403e, PAL.red2],
    trim: [PAL.yel2, PAL.org3],
    horn: [PAL.red1, PAL.red2, PAL.red3], // penas
    eye: PAL.org3,
    orb: [PAL.org1, PAL.org2, PAL.yel3],
    hand: PAL.n4,
  },
  druid: {
    hood: [PAL.s2, PAL.s3, 0xc9d6e0, PAL.white],
    cloak: [PAL.ice0, PAL.ice1, 0x4a8fd0, PAL.ice2],
    trim: [PAL.ice3, PAL.white],
    horn: [PAL.ice1, PAL.ice2, PAL.ice3], // cristais de gelo
    eye: PAL.ice2,
    orb: [PAL.ice1, PAL.ice2, PAL.white],
    hand: 0xc9d6e0,
  },
  shaman: {
    hood: [PAL.pur0, PAL.pur1, 0x8f58c8, PAL.pur2],
    cloak: [0x24163a, PAL.pur0, PAL.pur1, 0x8f58c8],
    trim: [PAL.yel2, PAL.yel3],
    horn: [PAL.yel1, PAL.yel2, PAL.yel3], // chifres de raio
    eye: PAL.pur3,
    orb: [PAL.pur1, PAL.pur2, PAL.white],
    hand: PAL.n4,
  },
};

// pose: { bob: 0|1 (corpo desce 1px), step: -1|0|1 (perna à frente) }
function drawHero(v, pose) {
  const p = new Pix(HERO_W, HERO_H);
  const b = pose.bob; // deslocamento vertical do corpo
  const feet = HERO_H - 2;

  // ---- Pernas / botas ----
  const leg = (x, lift) => {
    const top = 22;
    const bot = feet - lift;
    for (let y = top; y <= bot; y++) {
      const boot = y >= bot - 1;
      p.set(x, y, boot ? PAL.n0 : PAL.n1);
      p.set(x + 1, y, boot ? PAL.n0 : 0x2b1b17);
    }
  };
  leg(9 - (pose.step > 0 ? 1 : 0), pose.step < 0 ? 1 : 0);
  leg(12 + (pose.step < 0 ? 1 : 0), pose.step > 0 ? 1 : 0);

  // ---- Manto (trapézio que abre pra baixo) ----
  const [c0, c1, c2, c3] = v.cloak;
  const cTop = 12 + b,
    cBot = 22;
  for (let y = cTop; y <= cBot; y++) {
    const t = (y - cTop) / (cBot - cTop);
    const xl = Math.round(8 - t * 3),
      xr = Math.round(15 + t * 2);
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / Math.max(1, xr - xl);
      let col = u < 0.2 ? c2 : u < 0.7 ? c1 : c0;
      if (x === xl) col = c3; // luz na borda esquerda
      p.set(x, y, col);
    }
    // Barra de folhas (alterna cores = recorte serrilhado)
    if (y === cBot) for (let x = xl; x <= xr; x++) p.set(x, y, (x + (pose.step & 1)) % 2 ? v.trim[0] : c0);
  }
  // Cinto com fivela
  for (let x = 7; x <= 16; x++) if (p.get(x, 17 + b)) p.set(x, 17 + b, PAL.n2);
  p.set(12, 17 + b, PAL.yel2);

  // ---- Cajado (atrás da mão, à frente do manto) ----
  const sx = 19;
  for (let y = 6 + b; y <= feet; y++) {
    p.set(sx, y, PAL.n3);
    if (y % 4 === 0) p.set(sx, y, PAL.n2); // nós da madeira
  }
  // Galhinhos segurando o orbe
  p.set(sx - 1, 5 + b, PAL.n3);
  p.set(sx + 1, 5 + b, PAL.n3);
  // Orbe elemental
  const [o0, o1, o2] = v.orb;
  p.disc(sx + 0.5, 3.5 + b, 2.6, o0);
  p.disc(sx + 0.2, 3.2 + b, 1.9, o1);
  p.set(sx - 1, 2 + b, o2);
  p.set(sx, 2 + b, PAL.white);

  // ---- Braço + mão no cajado ----
  for (let x = 15; x <= 17; x++) {
    p.set(x, 14 + b, c2);
    p.set(x, 15 + b, c1);
  }
  p.set(18, 14 + b, v.hand);
  p.set(18, 15 + b, v.hand);
  p.set(20, 14 + b, v.hand);

  // ---- Manto de folhas no pescoço ----
  for (let x = 7; x <= 16; x++) {
    p.set(x, 12 + b, x % 2 ? v.trim[0] : c2);
    if (x % 3 === 0) p.set(x, 13 + b, v.trim[0]);
  }

  // ---- Capuz (elipse sombreada) ----
  const [h0, h1, h2, h3] = v.hood;
  const hx = 11.5,
    hy = 7.5 + b,
    rx = 5.6,
    ry = 5.2;
  for (let y = Math.floor(hy - ry); y <= Math.ceil(hy + ry); y++)
    for (let x = Math.floor(hx - rx); x <= Math.ceil(hx + rx); x++) {
      const dx = (x + 0.5 - hx) / rx,
        dy = (y + 0.5 - hy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const light = -dx * 0.6 - dy * 0.8;
      p.set(x, y, light > 0.55 ? h3 : light > 0.05 ? h2 : light > -0.5 ? h1 : h0);
    }
  // Ponta do capuz caindo pra trás
  p.set(5, 9 + b, h1);
  p.set(5, 10 + b, h1);
  p.set(4, 11 + b, h0);
  p.set(6, 11 + b, h1);

  // Rosto na sombra + olhos brilhando (virado pra direita)
  const fx = 13.2,
    fy = 8.6 + b;
  for (let y = Math.floor(fy - 2.6); y <= Math.ceil(fy + 2.6); y++)
    for (let x = Math.floor(fx - 2.4); x <= Math.ceil(fx + 2.6); x++) {
      const dx = (x + 0.5 - fx) / 2.5,
        dy = (y + 0.5 - fy) / 2.6;
      if (dx * dx + dy * dy <= 1) p.set(x, y, PAL.t0);
    }
  p.set(12, 8 + b, v.eye);
  p.set(14, 8 + b, v.eye);
  p.set(12, 9 + b, 0x2a4a38);
  p.set(14, 9 + b, 0x2a4a38);

  // ---- Galhada / penas / cristais ----
  const [a0, a1, a2] = v.horn;
  // Galhada em "Y" com ponta externa (3px de altura acima do capuz)
  const horn = (x0, dir) => {
    p.set(x0, 3 + b, a0);
    p.set(x0, 2 + b, a1);
    p.set(x0, 1 + b, a1);
    p.set(x0, 0 + b, a2);
    p.set(x0 + dir, 2 + b, a1);
    p.set(x0 + 2 * dir, 1 + b, a1);
    p.set(x0 + 2 * dir, 0 + b, a2);
  };
  horn(9, -1);
  horn(14, 1);
  // Brotinho entre as galhadas
  p.set(11, 2 + b, PAL.g5);
  p.set(12, 1 + b, PAL.g6);

  p.outline(PAL.ink);
  return p;
}

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
  for (const [id, v] of Object.entries(HERO_VARIANTS)) {
    registerStrip(scene, `hero_${id}`, poses.map((pose) => drawHero(v, pose)));
    const mk = (key, frames, rate) => {
      if (!scene.anims.exists(key))
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(`hero_${id}`, { frames }), frameRate: rate, repeat: -1 });
    };
    mk(`${id}_idle`, [0, 0, 1, 1], 3);
    mk(`${id}_walk`, [2, 3, 4, 5], 9);
  }
}
