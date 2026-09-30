// Arte procedural da Clareira do Guardião (acampamento): construções, ruínas
// tomadas pela Podridão, o João-de-barro construtor e a Anciã da Fogueira.
// Mesma paleta e mesmo estilo do cenário (contorno tinta, luz vindo da esquerda).
import { PAL } from "./Palette.js";
import { Pix, registerStrip, bayer, rng } from "./PixelArt.js";

const K = PAL.ink;
const STONE = [PAL.s1, PAL.s2, PAL.s3, PAL.s4];
const WOOD = [PAL.n1, PAL.n2, PAL.n3, PAL.n4];

// Pedra lavrada: bloco com luz à esquerda/topo e borda escura embaixo
function block(p, x, y, w, h, ramp = STONE) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let c = ramp[1];
      if (j === 0 || i === 0) c = ramp[3];
      else if (j === 1 || i === 1) c = ramp[2];
      if (j === h - 1 || i === w - 1) c = ramp[0];
      p.set(x + i, y + j, c);
    }
}

// Tábua de madeira vertical com veios
function plank(p, x, y, w, h) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let c = i === 0 ? PAL.n4 : i === w - 1 ? PAL.n1 : PAL.n3;
      if ((j * 3 + i * 5) % 11 === 0 && i > 0 && i < w - 1) c = PAL.n2;
      p.set(x + i, y + j, c);
    }
}





// João-de-barro (pássaro): 2 quadros (parado / pulinho com asa aberta)
function makeBirdFrames() {
  const legend = { k: K, b: PAL.n3, B: PAL.n2, c: PAL.org3, w: PAL.cream, e: PAL.white, y: PAL.yel2, d: PAL.n1 };
  const a = Pix.fromMap(
    [
      "...kkk....",
      "..kbbbk...",
      ".kbekbbkk.",
      "ykbbbbbBBk",
      ".kwccbBBBk",
      ".kwccbBBk.",
      "..kwwBBk..",
      "...kddk...",
      "...k..k...",
    ],
    legend,
  );
  const b = Pix.fromMap(
    [
      "...kkk..kk",
      "..kbbbkkBk",
      ".kbekbbBBk",
      "ykbbbbbBk.",
      ".kwccbBBk.",
      ".kwccbBk..",
      "..kwwBk...",
      "...kddk...",
      "..........",
    ],
    legend,
  );
  return [a, b];
}

// ---------------------------------------------------------------------------
// RUÍNA tomada pela Podridão: pedras caídas + cipós roxos + plaquinha "?"
// ---------------------------------------------------------------------------
function makeRuin(seed) {
  const r = rng(seed);
  const p = new Pix(40, 34);
  // Pedras
  const stones = [
    [4, 22, 10, 8],
    [13, 18, 12, 12],
    [24, 23, 11, 7],
    [9, 27, 8, 5],
  ];
  for (const [x, y, w, h] of stones) block(p, x, y, w, h);
  // Coluna quebrada
  block(p, 16, 8, 6, 11);
  p.set(16, 8, 0);
  p.set(21, 9, 0);
  // Cipós corrompidos (Podridão)
  const vine = [PAL.pur0, PAL.pur1, 0x8a3fa0];
  for (let v = 0; v < 6; v++) {
    let x = 4 + Math.floor(r() * 32),
      y = 31;
    const len = 10 + Math.floor(r() * 14);
    for (let k = 0; k < len; k++) {
      p.set(x, y, vine[k % 3 === 0 ? 0 : 1]);
      if (k % 4 === 2) p.set(x + 1, y, vine[2]);
      y -= 1;
      x += r() < 0.33 ? -1 : r() < 0.5 ? 1 : 0;
      if (y < 6) break;
    }
  }
  // Esporos brilhando
  for (let i = 0; i < 5; i++) p.set(6 + Math.floor(r() * 28), 10 + Math.floor(r() * 18), PAL.pink);
  // Placa "?"
  plank(p, 33, 12, 2, 12);
  p.rect(29, 7, 10, 7, PAL.n3);
  p.rect(29, 7, 10, 1, PAL.n4);
  const q = [
    [33, 8],
    [34, 8],
    [35, 9],
    [34, 10],
    [34, 12],
  ];
  for (const [x, y] of q) p.set(x, y, PAL.cream);
  p.outline(K);
  return p;
}

// Placa da trilha (JOGAR → floresta)
function makeTrailSign() {
  const p = new Pix(30, 34);
  plank(p, 13, 10, 4, 24);
  // Seta de madeira apontando para a direita
  for (let y = 4; y < 14; y++)
    for (let x = 2; x < 28; x++) {
      const tip = 28 - Math.abs(y - 9) * 1.2;
      if (x > tip) continue;
      p.set(x, y, y === 4 ? PAL.n4 : y === 13 ? PAL.n1 : (x + y) % 9 === 0 ? PAL.n2 : PAL.n3);
    }
  // Folhinhas
  p.set(4, 3, PAL.g5);
  p.set(5, 2, PAL.g4);
  p.set(3, 14, PAL.g4);
  p.outline(K);
  return p;
}

// ---------------------------------------------------------------------------
// ANCIÃ DA FOGUEIRA: senhora de xale, cabelo branco preso, cajado de galho.
// 2 quadros (respirar). Voltada para a direita (para a fogueira).
// ---------------------------------------------------------------------------
function makeElderFrames() {
  const legend = {
    k: K,
    h: PAL.s4, // cabelo
    H: PAL.white,
    s: 0x9a6a4a, // pele
    S: 0x7a4e36,
    e: PAL.ink,
    r: PAL.red1, // xale
    R: PAL.red0,
    o: PAL.org1,
    g: PAL.t3, // vestido
    G: PAL.t2,
    w: PAL.n3, // cajado
    W: PAL.n2,
    l: PAL.g5,
  };
  const rows = [
    "......kkkk..l...",
    ".....kHhhhk.lk..",
    "....kHhhhhhkwk..",
    "....khhssssk.wk.",
    "....khsseses.wk.",
    ".....ksSssSk.wk.",
    "....krrksskrrkwk",
    "...krrorrrrorRkw",
    "...krorrrrrorRsk",
    "...kRrrrorrrRRsk",
    "....kGgggggGGkWk",
    "....kGggggggGkWk",
    "....kGgggggggkWk",
    "...kGggggggggGkW",
    "...kGgggggggggkW",
    "...kGGgggggGGGkW",
    "....kkkkkkkkkk.W",
  ];
  const a = Pix.fromMap(rows, legend);
  // Quadro 2: ombros sobem 1px (respiração)
  const b = new Pix(a.w, a.h);
  b.blit(a, 0, 0);
  for (let y = 6; y <= 9; y++) for (let x = 0; x < a.w; x++) b.c[(y - 1) * a.w + x] = a.c[y * a.w + x] || b.c[(y - 1) * a.w + x];
  return [a, b];
}

export function registerCamp(scene) {
  makeRuin(31).register(scene, "camp_ruin");
  makeTrailSign().register(scene, "camp_trail");
  registerStrip(scene, "camp_bird", makeBirdFrames());
  registerStrip(scene, "camp_elder", makeElderFrames());
  const anim = (key, tex, rate, frames) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat: -1 });
  };
  anim("bird_idle", "camp_bird", 3, [0, 0, 0, 1, 0, 1]);
  anim("elder_idle", "camp_elder", 1.5, [0, 1]);
}
