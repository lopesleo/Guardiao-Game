// Arte procedural do Lago: um igarapé de contorno orgânico (nada de elipse),
// com faixas de profundidade, margem de areia molhada, capim debruçado,
// pedras com musgo, uma bica d'água caindo das pedras, juncos e taboas,
// vitórias-régias, trapiche com lamparina e uma canoa amarrada.
// O formato (máscara + distância até a margem) é exportado: a cena usa para
// colisão, para onde a boia cai e onde nascem bolhas e reflexos.
import { PAL } from "./Palette.js";
import { Pix, registerStrip, bayer, rng } from "./PixelArt.js";

const K = PAL.ink;
export const POND_AW = 118,
  POND_AH = 72; // tamanho da arte (×3 no mapa)

// Tons da água (raso → fundo) e da margem
const SHALLOW = 0x3f8a78;
const MID = PAL.t3;
const DEEP = PAL.t2;
const ABYSS = PAL.t1;
const NIGHT = 0x0c1c1c;
const SAND = [0x7a5a3a, 0x9c7a4e, 0xc8a070, 0xe0c090];

// ---------------------------------------------------------------------------
// FORMATO: contorno em coordenadas polares com várias ondulações + uma
// enseada ao nordeste (onde a bica cai) e uma prainha a sudoeste (trapiche)
// ---------------------------------------------------------------------------
export const ISLE = { x: 74, y: 40, rx: 9, ry: 5.5 };
let _shape = null;
export function pondShape() {
  if (_shape) return _shape;
  const W = POND_AW,
    H = POND_AH;
  const cx = W * 0.47,
    cy = H * 0.52;
  const rx = W * 0.39,
    ry = H * 0.36;
  const edge = (a) => {
    let r = 1 + 0.1 * Math.sin(2 * a + 0.6) + 0.08 * Math.sin(3 * a + 2.1) + 0.06 * Math.sin(5 * a + 0.3) + 0.035 * Math.sin(7 * a + 2.6) + 0.02 * Math.sin(11 * a + 1.7);
    // baía rasa ao norte (quebra a margem reta de cima)
    const n = Math.atan2(Math.sin(a + 1.9), Math.cos(a + 1.9));
    r -= 0.1 * Math.exp(-(n * n) / 0.04);
    // enseada da bica (nordeste)
    const ne = Math.atan2(Math.sin(a + 0.75), Math.cos(a + 0.75));
    r += 0.26 * Math.exp(-(ne * ne) / 0.06);
    // braço raso a sudeste
    const se = Math.atan2(Math.sin(a - 0.55), Math.cos(a - 0.55));
    r += 0.05 * Math.exp(-(se * se) / 0.05);
    return r;
  };
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      const a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) <= edge(a)) mask[y * W + x] = 1;
      // Ilhota com um açaizeiro (quebra a água funda do meio)
      const ix = (x + 0.5 - ISLE.x) / ISLE.rx,
        iy = (y + 0.5 - ISLE.y) / ISLE.ry;
      if (ix * ix + iy * iy <= 1 + 0.15 * Math.sin(Math.atan2(iy, ix) * 3)) mask[y * W + x] = 0;
    }
  // Distância (em px de arte) até a margem — chanfro 3-4 em duas passadas
  const INF = 9999;
  const dist = new Uint16Array(W * H).fill(INF);
  for (let i = 0; i < W * H; i++) if (!mask[i]) dist[i] = 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : dist[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = dist[i] / 3;
  _shape = { w: W, h: H, mask, dist: d, inside: (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[(y | 0) * W + (x | 0)] === 1, depth: (x, y) => d[(y | 0) * W + (x | 0)] || 0 };
  return _shape;
}

// ---------------------------------------------------------------------------
// BASE: margem + água em faixas + detalhes fixos
// ---------------------------------------------------------------------------
function makeBase() {
  const sh = pondShape();
  const W = sh.w,
    H = sh.h;
  let p = new Pix(W, H);
  const r = rng(2024);
  // Distância para FORA (margem): quão perto da água está cada pixel de terra
  const near = (x, y, R) => {
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= R * R && sh.inside(x + i, y + j)) return true;
    return false;
  };
  // Margem: areia molhada colada na água, areia seca, e capim irregular
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (sh.inside(x, y)) continue;
      const wob = Math.sin(x * 0.7) + Math.sin(y * 1.1 + x * 0.3);
      if (near(x, y, 1)) p.set(x, y, SAND[0]);
      else if (near(x, y, 2)) p.set(x, y, bayer(x, y) < 0.5 ? SAND[1] : SAND[0]);
      else if (near(x, y, 3 + (wob > 0.6 ? 1 : 0))) p.set(x, y, bayer(x, y) < 0.3 ? SAND[3] : SAND[2]);
      else if (near(x, y, 5 + (wob > 0 ? 1 : 0))) p.set(x, y, bayer(x, y) < 0.5 ? PAL.g3 : PAL.g2); // capim debruçado
      else if (near(x, y, 7) && bayer(x, y) < 0.3) p.set(x, y, PAL.g2); // e se desfaz no chão
    }
  // Ilhota: capim por cima, só a beirinha de areia molhada
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ix = (x + 0.5 - ISLE.x) / (ISLE.rx + 1),
        iy = (y + 0.5 - ISLE.y) / (ISLE.ry + 1);
      if (ix * ix + iy * iy > 1.1 || sh.inside(x, y) || near(x, y, 1)) continue;
      p.set(x, y, bayer(x, y) < 0.4 ? PAL.g4 : PAL.g3);
    }
  // Seixos na areia
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * H);
    const c = p.rgb(x, y);
    if (p.get(x, y) && (c === SAND[2] || c === SAND[3] || c === SAND[1])) {
      p.set(x, y, r() < 0.5 ? PAL.s3 : PAL.s2);
      if (r() < 0.4) p.set(x + 1, y, PAL.s1);
    }
  }
  // Água em faixas de profundidade, com dithering nas passagens
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!sh.inside(x, y)) continue;
      const d = sh.depth(x, y) + Math.sin(x * 0.35 + y * 0.2) * 0.6;
      const b = bayer(x, y);
      let c;
      if (d < 1.2) c = SHALLOW;
      else if (d < 3) c = b < (3 - d) / 1.8 ? SHALLOW : MID;
      else if (d < 6) c = b < (6 - d) / 3 ? MID : DEEP;
      else if (d < 10) c = b < (10 - d) / 4 ? DEEP : ABYSS;
      else c = b < (16 - d) / 5 ? ABYSS : NIGHT;
      p.set(x, y, c);
    }
  // Fundo visível no raso: areia e pedrinhas sob a água
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * H);
    if (!sh.inside(x, y)) continue;
    const d = sh.depth(x, y);
    if (d > 1 && d < 3.2 && r() < 0.6) p.set(x, y, 0x5a8a6a);
    else if (d >= 3.2 && d < 5 && r() < 0.3) p.set(x, y, 0x2a5a4e);
  }
  // Espuma fininha colada na margem (lado da luz)
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!sh.inside(x, y) || sh.depth(x, y) > 1.1) continue;
      if (!sh.inside(x, y - 1) && (x + y) % 3 !== 0) p.set(x, y, 0x8fd0c0);
    }
  // Detalhes (pedras, juncos, flores) numa camada própria, contornada à parte:
  // a margem de capim não ganha contorno e se desfaz no chão
  const ground = p;
  p = new Pix(W, H);
  // Pedras grandes com musgo na enseada da bica (nordeste) e uma a sudoeste
  const boulder = (bx, by, br, moss) => {
    p.ellipse(bx, by, br, br * 0.72, PAL.s1);
    p.ellipse(bx - br * 0.2, by - br * 0.18, br * 0.78, br * 0.52, PAL.s2);
    p.ellipse(bx - br * 0.35, by - br * 0.3, br * 0.4, br * 0.26, PAL.s3);
    p.set(Math.round(bx - br * 0.45), Math.round(by - br * 0.4), PAL.s4);
    if (moss)
      for (let i = -br; i <= br; i++) {
        const x = Math.round(bx + i),
          yTop = Math.round(by - br * 0.72 * Math.sqrt(Math.max(0, 1 - (i / br) ** 2)));
        if (bayer(x, yTop) < 0.7) p.set(x, yTop, PAL.g4);
        if (bayer(x, yTop + 1) < 0.35) p.set(x, yTop + 1, PAL.g3);
      }
  };
  // Afloramento de pedra de onde a bica jorra (nordeste): massa de pedras com
  // musgo, uma boca escura no meio e o lábio molhado embaixo. A água (sprite
  // pond_fall) sai da boca e escorre pela pedra até o lago.
  boulder(83, 8, 5, true);
  boulder(98, 8, 5, true);
  boulder(90, 4, 8, true);
  boulder(90, 10, 5, false);
  p.rect(88, 3, 5, 4, PAL.ink); // boca da bica
  p.rect(89, 4, 3, 2, PAL.s1);
  p.rect(87, 7, 7, 1, PAL.s4); // lábio de pedra molhado
  p.rect(88, 8, 5, 1, PAL.ice1);
  boulder(106, 15, 5, true);
  boulder(12, 52, 4, true);
  boulder(104, 50, 3, false);
  // Juncos e taboas em touceiras (oeste, sul e leste)
  const clump = (x0, y0, n, spread) => {
    for (let k = 0; k < n; k++) {
      const x = Math.round(x0 + (r() - 0.5) * spread),
        base = Math.round(y0 + (r() - 0.5) * 3);
      const h = 5 + Math.floor(r() * 7);
      const lean = r() < 0.5 ? -1 : 1;
      for (let j = 0; j < h; j++) p.set(x + (j > h * 0.6 ? lean : 0), base - j, j > h - 3 ? PAL.g5 : j < 2 ? PAL.g2 : PAL.g3);
      if (r() < 0.45) {
        p.rect(x + lean, base - h - 2, 1, 3, PAL.n2); // taboa
        p.set(x + lean, base - h - 3, PAL.n3);
      }
    }
  };
  // pedrinha e capim na ilhota
  p.ellipse(ISLE.x + 4, ISLE.y + 1, 2, 1.3, PAL.s2);
  p.set(ISLE.x + 3, ISLE.y, PAL.s3);
  clump(8, 30, 9, 8);
  clump(30, 66, 7, 12);
  clump(70, 69, 6, 10);
  clump(113, 32, 6, 5);
  clump(52, 10, 5, 10);
  // Flores do brejo
  for (const [x, y, c] of [[6, 36, PAL.pink], [34, 67, PAL.yel3], [76, 68, PAL.pink], [112, 38, PAL.cream], [55, 8, PAL.yel3]]) {
    p.set(x, y, c);
    p.set(x + 1, y + 1, PAL.g5);
  }
  p.outline(K);
  ground.blit(p, 0, 0);
  return ground;
}

// Açaizeiro (sprite próprio, em pé na ilhota): estipe curva com anéis, cacho
// roxo e coroa de palmas em arco; a luz da lua pega nas bordas de cima
function makePalm() {
  const p = new Pix(40, 40);
  const bx = 18,
    by = 39;
  for (let k = 0; k < 26; k++) {
    const x = Math.round(bx + Math.sin(k / 12) * 5),
      y = by - k;
    p.set(x, y, k % 4 === 0 ? PAL.n4 : PAL.n3);
    p.set(x + 1, y, PAL.n2);
    if (k % 4 === 0) p.set(x - 1, y, PAL.n4);
  }
  const top = { x: Math.round(bx + Math.sin(26 / 12) * 5) + 1, y: by - 26 };
  const fronds = [[-3.05, 14], [-2.7, 15], [-2.3, 13], [-1.95, 11], [-1.6, 10], [-1.25, 11], [-0.85, 13], [-0.45, 15], [-0.1, 14], [0.3, 12], [0.75, 9], [2.45, 10], [2.85, 12]];
  for (const [ang, len] of fronds) {
    for (let r = 1; r <= len; r++) {
      const droop = (r * r) / (len * 2.6);
      const x = Math.round(top.x + Math.cos(ang) * r),
        y = Math.round(top.y + Math.sin(ang) * r * 0.62 + droop);
      p.set(x, y, r > len - 3 ? PAL.g5 : PAL.g4);
      if (r > 2 && r % 2 === 0) p.set(x, y + 1, PAL.g3); // folíolos pendurados
      if (r > 5 && r % 4 === 0) p.set(x, y + 2, PAL.t3);
      if (ang < -0.6 && ang > -2.6 && r > 2) p.set(x, y - 1, r % 2 ? PAL.ice3 : PAL.g6); // luz da lua
    }
  }
  p.disc(top.x, top.y + 1, 2.2, PAL.g3); // palmito
  p.disc(top.x + 3, top.y + 4, 2.2, PAL.pur1); // cacho de açaí
  p.set(top.x + 2, top.y + 3, PAL.pur2);
  p.set(top.x + 4, top.y + 5, PAL.pur0);
  return p.outline(K);
}

// Brilhos que correm na superfície (4 quadros; desenhados com ADD)
function makeGlints() {
  const sh = pondShape();
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const p = new Pix(sh.w, sh.h);
    const r = rng(77 + f);
    for (let y = 0; y < sh.h; y++)
      for (let x = 0; x < sh.w; x++) {
        if (!sh.inside(x, y) || sh.depth(x, y) < 2) continue;
        const wave = Math.sin(x * 0.42 + y * 1.7 + f * 1.57) + Math.sin(x * 0.13 - y * 0.9 - f * 0.8);
        const mx = (x - 56) / 22,
          my = (y - 28) / 10;
        const nearMoon = Math.exp(-(mx * mx + my * my));
        if (wave > 1.8 && r() < 0.08 + nearMoon * 0.7) {
          p.set(x, y, nearMoon > 0.4 ? PAL.ice3 : PAL.ice1);
          if (nearMoon > 0.25 && sh.inside(x + 1, y)) p.set(x + 1, y, PAL.ice2);
        }
      }
    frames.push(p);
  }
  return frames;
}

// Bica d'água caindo das pedras (3 quadros)
function makeFall() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const p = new Pix(11, 18);
    for (let y = 0; y < 14; y++) {
      const half = 1.5 + y * 0.12; // abre um pouco ao cair
      for (let x = 0; x < 11; x++) {
        if (Math.abs(x + 0.5 - 5.5) > half) continue;
        const s = (y * 2 - f * 3 + x * 5 + 99) % 7;
        p.set(x, y, s === 0 ? PAL.white : s < 3 ? PAL.ice3 : s < 5 ? PAL.ice2 : PAL.ice1);
      }
    }
    // espuma e borrifos
    for (let x = 1; x < 10; x++) {
      const fy = 14 + ((x + f) % 3 === 0 ? -1 : 0);
      p.set(x, fy, (x + f) % 2 ? PAL.white : PAL.ice3);
      if ((x * 3 + f) % 4 === 0) p.set(x, fy + 1, PAL.ice3);
    }
    p.set((f * 4 + 1) % 11, 16, PAL.ice3);
    p.set((f * 4 + 6) % 11, 12, PAL.white);
    frames.push(p);
  }
  return frames;
}

// Vitória-régia (folha grande com borda levantada) e folhinha comum
function makeVictoria() {
  const p = new Pix(18, 10);
  p.ellipse(9, 5, 8.5, 4.5, PAL.g3);
  p.ellipse(9, 5, 7.2, 3.4, PAL.g4);
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    p.line(9, 5, Math.round(9 + Math.cos(ang) * 6.5), Math.round(5 + Math.sin(ang) * 3), PAL.g3);
  }
  // borda levantada (luz em cima)
  for (let x = 1; x < 17; x++) {
    const t = (x - 9) / 8.5;
    const y = Math.round(5 - 4.5 * Math.sqrt(Math.max(0, 1 - t * t)));
    p.set(x, y, PAL.g5);
    p.set(x, 10 - y, PAL.g2);
  }
  // flor
  p.disc(12, 4, 1.8, PAL.pink);
  p.set(12, 3, PAL.cream);
  p.set(11, 4, PAL.white);
  return p.outline(K);
}
function makePad() {
  const p = new Pix(9, 6);
  p.ellipse(4.5, 3, 4.3, 2.7, PAL.g4);
  p.line(4, 3, 8, 3, PAL.t2); // o corte da folha
  p.set(2, 2, PAL.g5);
  p.set(3, 1, PAL.g5);
  return p.outline(K);
}

// Trapiche de tábuas envelhecidas, com mourões, corda e lamparina na ponta
function makePier() {
  const p = new Pix(40, 22);
  for (let x = 0; x < 36; x++)
    for (let y = 8; y < 15; y++) {
      const i = x % 6;
      if (i === 5) continue; // fresta entre as tábuas
      let c = y === 8 ? PAL.n4 : y === 14 ? PAL.n1 : PAL.n3;
      if ((x * 7 + y * 3) % 13 === 0) c = PAL.n2;
      p.set(x, y, c);
    }
  for (const x of [1, 17, 33]) {
    p.rect(x, 5, 3, 15, PAL.n2);
    p.rect(x, 5, 1, 15, PAL.n3);
    p.set(x + 1, 5, PAL.n4);
  }
  // corda entre os mourões
  for (let x = 3; x < 33; x++) p.set(x, 7 + Math.round(Math.sin(((x - 3) / 14) * Math.PI) * 1.2) * (x < 17 ? 1 : 1), (x & 1) ? 0xd8b070 : 0xb08850);
  // lamparina no último mourão
  p.rect(36, 0, 1, 8, PAL.n2);
  p.rect(35, 0, 3, 1, PAL.n2);
  p.rect(34, 1, 4, 4, PAL.s1);
  p.rect(35, 2, 2, 2, PAL.yel3);
  p.rect(37, 8, 1, 12, PAL.n2);
  return p.outline(K);
}

// Canoa escavada, com o remo atravessado
function makeCanoe() {
  const p = new Pix(30, 10);
  for (let x = 0; x < 30; x++) {
    const t = (x - 14.5) / 15;
    const half = 3.8 * Math.sqrt(Math.max(0, 1 - t ** 4));
    if (half < 0.6) continue;
    for (let y = Math.round(5 - half); y <= Math.round(5 + half); y++) {
      let c = PAL.n3;
      if (y <= Math.round(5 - half)) c = PAL.n4; // borda iluminada
      else if (y >= Math.round(5 + half)) c = PAL.n1;
      else if (half > 2 && y > 5 - half + 1 && y < 5 + half - 1) c = PAL.n1; // o oco
      p.set(x, y, c);
    }
  }
  for (const x of [10, 19]) p.rect(x, 3, 2, 5, PAL.n4); // bancos
  p.line(5, 8, 24, 2, PAL.cream); // remo
  p.ellipse(24, 2, 2.2, 1.1, 0xd8ccb0);
  return p.outline(K);
}

// Boia de pesca (vermelha e branca)
function makeBobber() {
  const p = new Pix(6, 7);
  p.rect(2, 0, 1, 2, PAL.ink);
  p.disc(3, 4, 2.4, PAL.red2);
  p.rect(1, 2, 4, 2, PAL.white);
  return p.outline(K);
}

// Ondinha de pixel (anel achatado de 1 px)
function makeRipple() {
  const p = new Pix(15, 7);
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    p.set(Math.round(7 + Math.cos(ang) * 7), Math.round(3 + Math.sin(ang) * 3), PAL.white);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Peixes (ícone de lado, virado para a esquerda)
// ---------------------------------------------------------------------------
const FISH_ART = {
  lambari: { body: [PAL.s2, PAL.s3, PAL.s4], belly: PAL.white, tail: PAL.yel2, len: 13, ht: 2.4 },
  cara: { body: [PAL.t2, PAL.t3, PAL.g5], belly: PAL.g6, tail: PAL.t3, len: 12, ht: 3.2, bars: PAL.t1 },
  tilapia: { body: [PAL.s1, PAL.s2, PAL.s3], belly: PAL.s4, tail: PAL.red1, len: 14, ht: 3.2, bars: PAL.s1 },
  traira: { body: [PAL.n0, PAL.n1, PAL.n2], belly: PAL.n3, tail: PAL.n1, len: 16, ht: 2.6, spots: PAL.g3 },
  pacu: { body: [PAL.s0, PAL.s1, PAL.s2], belly: PAL.org2, tail: PAL.s1, len: 13, ht: 4.4 },
  tucunare: { body: [PAL.g3, PAL.g5, PAL.yel2], belly: PAL.yel3, tail: PAL.org2, len: 16, ht: 3, bars: PAL.ink, eyespot: true },
  dourado: { body: [PAL.yel1, PAL.yel2, PAL.yel3], belly: PAL.cream, tail: PAL.org2, len: 16, ht: 3, shine: true },
};

function fishIcon(a) {
  const W = a.len + 5,
    H = Math.ceil(a.ht * 2) + 5;
  const p = new Pix(W, H);
  const cx = 1 + a.len / 2,
    cy = H / 2;
  p.ellipse(cx, cy, a.len / 2, a.ht, a.body[1]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.get(x, y)) continue;
      if (y < cy - a.ht * 0.35) p.set(x, y, a.body[2]);
      else if (y > cy + a.ht * 0.3) p.set(x, y, a.belly);
    }
  if (a.bars) for (let x = Math.floor(cx - a.len / 4); x < cx + a.len / 3; x += 3) for (let y = 0; y < cy; y++) p.over(x, y, a.bars);
  if (a.spots) for (let x = Math.floor(cx - a.len / 3); x < cx + a.len / 3; x += 2) p.over(x, Math.floor(cy - 1 + (x % 3)), a.spots);
  if (a.shine) for (let x = Math.floor(cx - a.len / 3); x < cx + a.len / 3; x += 2) p.over(x, Math.floor(cy - 1), PAL.white);
  const tx = Math.round(cx + a.len / 2);
  for (let k = 0; k < 4; k++) {
    p.set(tx + k, Math.floor(cy) - k / 1.3 - 0.5, a.tail);
    p.set(tx + k, Math.floor(cy) + k / 1.3, a.tail);
    p.set(tx + k, Math.floor(cy), k < 2 ? a.body[0] : 0);
  }
  if (a.eyespot) p.set(tx - 1, Math.floor(cy) - 1, PAL.org2);
  p.set(Math.round(cx), Math.floor(cy - a.ht), a.body[0]);
  p.set(Math.round(cx) + 1, Math.floor(cy - a.ht), a.body[0]);
  p.set(Math.round(cx - a.len / 2 + 2), Math.floor(cy) - 1, K);
  p.set(Math.round(cx - a.len / 2 + 1), Math.floor(cy) + 1, a.body[0]);
  return p.outline(K);
}

export function registerPond(scene) {
  makeBase().register(scene, "pond_base");
  registerStrip(scene, "pond_glint", makeGlints());
  registerStrip(scene, "pond_fall", makeFall());
  makeVictoria().register(scene, "pond_victoria");
  makePalm().register(scene, "pond_palm");
  makePad().register(scene, "pond_pad");
  makePier().register(scene, "camp_pier");
  makeCanoe().register(scene, "pond_canoe");
  makeBobber().register(scene, "px_bobber");
  makeRipple().register(scene, "px_ripple");
  for (const [id, a] of Object.entries(FISH_ART)) fishIcon(a).register(scene, `ico_${id}`);
  const anim = (key, tex, rate, frames) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat: -1 });
  };
  anim("pond_glint", "pond_glint", 3, [0, 1, 2, 3]);
  anim("pond_fall", "pond_fall", 9, [0, 1, 2]);
}
