// Arte procedural do Lago: o lago (água com margem, juncos e vitórias-régias),
// o trapiche de pesca e os ícones dos peixes brasileiros.
import { PAL } from "./Palette.js";
import { Pix, bayer, rng } from "./PixelArt.js";

const K = PAL.ink;

// ---------------------------------------------------------------------------
// LAGO: elipse de água (fundo escuro no meio), margem de areia e pedras,
// juncos atrás e vitórias-régias
// ---------------------------------------------------------------------------
export const POND_W = 84,
  POND_H = 46;

function makePond() {
  const p = new Pix(POND_W, POND_H + 8);
  const r = rng(404);
  const cx = POND_W / 2,
    cy = POND_H / 2 + 6;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < POND_W; x++) {
      const dx = (x + 0.5 - cx) / (POND_W / 2),
        dy = (y + 0.5 - cy) / (POND_H / 2);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c;
      if (d > 0.86) c = bayer(x, y) < 0.5 ? PAL.n4 : 0xc8a070; // margem de areia
      else if (d > 0.74) c = PAL.t3;
      else if (d > 0.45) c = bayer(x, y) < d ? PAL.t2 : PAL.t3;
      else c = bayer(x, y) < 0.5 + d ? PAL.t1 : PAL.t2;
      p.set(x, y, c);
    }
  // Brilhos de luz na água
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(cx - 26 + r() * 52),
      y = Math.floor(cy - 10 + r() * 20);
    if (p.rgb(x, y) === PAL.n4 || p.rgb(x, y) === 0xc8a070) continue;
    p.set(x, y, PAL.ice1);
    p.set(x + 1, y, PAL.ice2);
  }
  // Pedras na margem
  for (const [x, y] of [[8, 34], [71, 18], [76, 32], [22, 46], [60, 48]]) {
    p.ellipse(x, y, 3, 2, PAL.s2);
    p.set(x - 1, y - 1, PAL.s3);
  }
  // Vitórias-régias
  for (const [x, y] of [[54, 22], [60, 34], [28, 38]]) {
    p.disc(x, y, 3, PAL.g4);
    p.set(x + 1, y - 1, PAL.g5);
    p.set(x, y, PAL.g3);
    p.set(x + 3, y, PAL.t2); // cortezinho
  }
  p.set(54, 21, PAL.pink);
  p.set(55, 21, PAL.pink);
  // Juncos na margem de trás
  for (let i = 0; i < 16; i++) {
    const x = 14 + Math.floor(r() * 56);
    const base = Math.round(cy - (POND_H / 2) * Math.sqrt(Math.max(0, 1 - ((x - cx) / (POND_W / 2)) ** 2))) + 2;
    const h = 4 + Math.floor(r() * 6);
    for (let k = 0; k < h; k++) p.set(x, base - k, k > h - 3 ? PAL.g5 : PAL.g3);
    if (r() < 0.4) p.rect(x, base - h - 1, 1, 2, PAL.n2); // taboa
  }
  return p.outline(K);
}

// Trapiche de tábuas (entra na água pela margem esquerda)
function makePier() {
  const p = new Pix(30, 14);
  for (let x = 0; x < 30; x++)
    for (let y = 2; y < 9; y++) {
      const i = x % 5;
      p.set(x, y, y === 2 ? PAL.n4 : i === 4 ? PAL.n1 : y === 8 ? PAL.n2 : PAL.n3);
    }
  for (const x of [3, 14, 26]) {
    p.rect(x, 9, 2, 5, PAL.n2);
    p.rect(x, 0, 2, 3, PAL.n2);
    p.set(x, 0, PAL.n4);
  }
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
  // Corpo (sombra embaixo, luz em cima)
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
  // Cauda (à direita) e nadadeira de cima
  const tx = Math.round(cx + a.len / 2);
  for (let k = 0; k < 4; k++) {
    p.set(tx + k, Math.floor(cy) - k / 1.3 - 0.5, a.tail);
    p.set(tx + k, Math.floor(cy) + k / 1.3, a.tail);
    p.set(tx + k, Math.floor(cy), k < 2 ? a.body[0] : 0);
  }
  if (a.eyespot) p.set(tx - 1, Math.floor(cy) - 1, PAL.org2);
  p.set(Math.round(cx), Math.floor(cy - a.ht) - 1 + 1, a.body[0]);
  p.set(Math.round(cx) + 1, Math.floor(cy - a.ht), a.body[0]);
  // Olho e boca
  p.set(Math.round(cx - a.len / 2 + 2), Math.floor(cy) - 1, K);
  p.set(Math.round(cx - a.len / 2 + 1), Math.floor(cy) + 1, a.body[0]);
  return p.outline(K);
}

export function registerPond(scene) {
  makePond().register(scene, "camp_pond");
  makePier().register(scene, "camp_pier");
  makeBobber().register(scene, "px_bobber");
  for (const [id, a] of Object.entries(FISH_ART)) fishIcon(a).register(scene, `ico_${id}`);
}
