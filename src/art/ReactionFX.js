// Reações desenhadas quadro a quadro (a Labareda mora em FireFX.js; o Cristal usa o
// espinho de gelo de IceFX.js):
//   fx_steam     — VAPOR: nuvem de vapor que BORBULHA em laço (8 quadros sem emenda):
//                  lóbulos que incham e murcham, topo claro, barriga quente (é fogo + gelo)
//   fx_frostgust — GEADA: lufada de neve em espiral que abre e se desfaz (8 quadros)
import { PAL } from "./Palette.js";
import { Pix, registerStrip, tileNoise, bayer, rng } from "./PixelArt.js";

export const STEAM_W = 46,
  STEAM_H = 34;
// lóbulos da nuvem: [x, y, raio, fase]
const LOBES = [
  [14, 20, 8.5, 0],
  [23, 15, 10, 1.7],
  [32, 20, 8.5, 3.1],
  [19, 24, 7.5, 4.4],
  [28, 25, 7.5, 5.6],
  [23, 22, 8, 2.5],
];
function steam(f) {
  const p = new Pix(STEAM_W, STEAM_H);
  const ph = (f / 8) * Math.PI * 2;
  const n = tileNoise(48, 32, 4, 1201);
  for (let y = 0; y < STEAM_H; y++)
    for (let x = 0; x < STEAM_W; x++) {
      // campo de densidade = soma suave dos lóbulos que respiram
      let d = 0,
        lx = 0,
        ly = 0;
      for (const [cx, cy, r0, f0] of LOBES) {
        const r = r0 + Math.sin(ph + f0) * 1.1;
        const q = 1 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (q > 0) {
          d += q;
          lx += (x + 0.5 - cx) * q;
          ly += (y + 0.5 - cy) * q;
        }
      }
      const nn = n((x + 64) & 47, (y + f * 4) & 31); // o miolo "ferve" subindo
      if (d + (nn - 0.5) * 0.25 < 0.12) continue;
      // luz de cima-esquerda: normal aproximada pela média dos lóbulos
      const L = (-lx * 0.6 - ly * 0.8) / (Math.hypot(lx, ly) + 0.001);
      const belly = y > 24 ? (y - 24) / 10 : 0; // barriga quente (embaixo)
      let col;
      if (d < 0.22) col = bayer(x, y) < 0.55 ? PAL.s4 : null; // borda rala
      else if (L > 0.45 && d > 0.3) col = PAL.white;
      else if (L > -0.1) col = PAL.cream;
      else col = belly > 0.3 && bayer(x, y) < belly ? PAL.org3 : PAL.s4;
      if (col != null) p.set(x, y, col);
    }
  // fiapos subindo do topo (sobem 4 px por quadro e somem)
  for (let k = 0; k < 3; k++) {
    const t = ((f + k * 2.7) % 8) / 8;
    const x = 12 + k * 10 + Math.round(Math.sin(t * 6 + k) * 1.5),
      y = Math.round(6 - t * 6);
    if (y >= 0) {
      p.set(x, y, t < 0.6 ? PAL.white : PAL.s4);
      if (t < 0.4) p.set(x, y + 1, PAL.cream);
    }
  }
  return p;
}

// GEADA: três braços de neve em espiral que abrem a partir do alvo (chão em perspectiva,
// 2:1), cabeça branca, corpo gelo, cauda pontilhada; flocos soltos voando para fora
export const GUST_W = 56,
  GUST_H = 34;
function frostGust(f) {
  const p = new Pix(GUST_W, GUST_H);
  const k = f / 7; // 0 … 1
  const cx = GUST_W / 2,
    cy = GUST_H / 2;
  const R = 5 + k * 21;
  const fade = Math.max(0, (k - 0.55) / 0.45);
  for (let i = 0; i < 3; i++) {
    const a0 = k * 3.2 + (i * Math.PI * 2) / 3;
    const len = 2.2;
    for (let a = a0; a < a0 + len; a += 0.05) {
      const t = (a - a0) / len; // 0 cauda … 1 cabeça
      const r = R * (0.55 + t * 0.45);
      const x = Math.round(cx + Math.cos(a) * r),
        y = Math.round(cy + Math.sin(a) * r * 0.55);
      if (bayer(x, y) < fade * 1.2 + (1 - t) * 0.5 - 0.15) continue;
      p.set(x, y, t > 0.85 ? PAL.white : t > 0.45 ? PAL.ice3 : PAL.ice2);
      // espessura da lufada: 3 px na cabeça, 2 no corpo, 1 na cauda
      if (t > 0.3) p.set(x, y - 1, t > 0.7 ? PAL.ice3 : PAL.ice2);
      if (t > 0.7) p.set(x, y + 1, PAL.wnd3);
    }
  }
  // flocos voando para fora
  const rnd = rng(55);
  for (let j = 0; j < 26; j++) {
    const a = rnd() * Math.PI * 2,
      r = (0.3 + rnd() * 0.7) * R * 1.15;
    const x = Math.round(cx + Math.cos(a) * r),
      y = Math.round(cy + Math.sin(a) * r * 0.55 - k * 3);
    if (rnd() < fade) continue;
    p.set(x, y, rnd() < 0.5 ? PAL.white : PAL.ice3);
    if (j % 4 === 0) {
      // floco em cruz
      p.set(x - 1, y, PAL.ice2);
      p.set(x + 1, y, PAL.ice2);
      p.set(x, y - 1, PAL.ice2);
      p.set(x, y + 1, PAL.ice2);
    }
  }
  return p;
}

export function registerReactionFX(scene) {
  if (scene.textures.exists("fx_steam")) return;
  registerStrip(scene, "fx_steam", Array.from({ length: 8 }, (_, f) => steam(f)));
  registerStrip(scene, "fx_frostgust", Array.from({ length: 8 }, (_, f) => frostGust(f)));
  const mk = (key, rate, repeat) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, {}), frameRate: rate, repeat });
  };
  mk("fx_steam", 9, -1);
  mk("fx_frostgust", 18, 0);
}
