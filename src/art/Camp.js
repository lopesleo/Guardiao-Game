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

// ---------------------------------------------------------------------------
// SANTUÁRIO (Bênçãos): degraus de pedra + estela com a semente dourada
// ---------------------------------------------------------------------------
function makeShrine() {
  const p = new Pix(46, 40);
  // Mourões de madeira com guirlanda de folhas entre eles
  plank(p, 3, 10, 4, 28);
  plank(p, 39, 10, 4, 28);
  p.rect(2, 9, 6, 2, PAL.n4);
  p.rect(38, 9, 6, 2, PAL.n4);
  for (let x = 6; x < 40; x++) {
    const y = 11 + Math.round(Math.sin(((x - 6) / 33) * Math.PI) * 5);
    p.set(x, y, PAL.g3);
    if (x % 3 === 0) {
      p.set(x, y + 1, PAL.g5);
      p.set(x + 1, y + 1, PAL.g4);
    }
    if (x % 7 === 3) p.set(x, y + 2, x % 14 === 3 ? PAL.yel3 : PAL.pink); // florzinhas
  }
  // Pedestal baixo e largo
  block(p, 12, 32, 22, 6);
  block(p, 16, 27, 14, 6);
  // Bacia de pedra (altar)
  p.ellipse(23, 26, 11, 4, PAL.s1);
  p.ellipse(23, 25, 10, 3, PAL.s3);
  p.ellipse(23, 24.5, 7.5, 1.8, PAL.t1); // água escura na bacia
  p.set(19, 24, PAL.ice2);
  p.set(26, 25, PAL.ice2);
  // Semente dourada flutuando (brilha no jogo com halo aditivo)
  p.disc(23, 15, 4.5, PAL.yel1);
  p.disc(23, 15, 3.5, PAL.yel2);
  p.disc(22, 14, 2, PAL.yel3);
  p.set(21, 13, PAL.white);
  p.set(23, 10, PAL.g5); // brotinho
  p.set(24, 9, PAL.g6);
  p.set(22, 9, PAL.g6);
  // Musgo na base
  for (let x = 12; x < 34; x++) if ((x * 7) % 5 < 2) p.set(x, 32, bayer(x, 32) < 0.5 ? PAL.g4 : PAL.g3);
  p.outline(K);
  return p;
}

// ---------------------------------------------------------------------------
// FORJA (Arsenal): forno de pedra em cúpula, boca em brasa, chaminé e bigorna
// ---------------------------------------------------------------------------
function makeForge() {
  const p = new Pix(46, 40);
  // Chaminé
  block(p, 25, 2, 7, 16);
  // Cúpula
  const cx = 20,
    cy = 26;
  for (let y = 10; y < 38; y++)
    for (let x = 2; x < 38; x++) {
      const dx = (x + 0.5 - cx) / 18,
        dy = (y + 0.5 - cy) / 16;
      if (dx * dx + dy * dy > 1 || y > 37) continue;
      // Pedras em fiadas
      const row = Math.floor(y / 4);
      const brick = (x + (row % 2) * 3) % 6 === 0 || y % 4 === 0;
      const lit = dx < -0.2 && dy < 0.2;
      p.set(x, y, brick ? PAL.s1 : lit ? PAL.s3 : PAL.s2);
    }
  // Boca do forno (brasa)
  p.ellipse(19, 31, 7, 6, PAL.red0);
  p.ellipse(19, 32, 5.5, 4.5, PAL.org1);
  p.ellipse(19, 33, 4, 3, PAL.org2);
  p.ellipse(19, 34, 2.5, 1.6, PAL.yel3);
  p.rect(10, 36, 19, 2, PAL.s1);
  // Bigorna
  p.rect(36, 30, 9, 3, PAL.s2);
  p.rect(35, 30, 2, 2, PAL.s3);
  p.rect(38, 33, 4, 3, PAL.s1);
  p.rect(36, 36, 8, 2, PAL.s1);
  p.rect(37, 30, 7, 1, PAL.s4);
  p.outline(K);
  return p;
}

// ---------------------------------------------------------------------------
// MURAL (Conquistas / Guia): quadro de madeira com papéis presos e telhadinho
// ---------------------------------------------------------------------------
function makeBoard() {
  const p = new Pix(34, 40);
  // Postes
  plank(p, 4, 8, 3, 32);
  plank(p, 27, 8, 3, 32);
  // Quadro
  for (let y = 12; y < 30; y++) for (let x = 5; x < 29; x++) p.set(x, y, (x + y) % 7 === 0 ? PAL.n1 : PAL.n2);
  p.rect(5, 12, 24, 1, PAL.n3);
  // Papéis
  const papers = [
    [8, 14, 7, 8],
    [17, 15, 9, 6],
    [10, 23, 8, 5],
    [20, 22, 6, 6],
  ];
  papers.forEach(([x, y, w, h], i) => {
    p.rect(x, y, w, h, PAL.cream);
    p.rect(x, y + h - 1, w, 1, 0xd8ccb0);
    for (let l = 2; l < h - 1; l += 2) p.rect(x + 1, y + l, w - 2 - (l % 3), 1, PAL.s3);
    p.set(x + Math.floor(w / 2), y, i % 2 ? PAL.red2 : PAL.ice2); // tachinha
  });
  // Telhado
  for (let i = 0; i < 6; i++) p.rect(2 + i, 8 - i, 30 - i * 2, 1, i % 2 ? PAL.n2 : PAL.n1);
  p.rect(1, 8, 32, 2, PAL.n3);
  p.outline(K);
  return p;
}

// ---------------------------------------------------------------------------
// NINHO DO JOÃO-DE-BARRO: forninho de barro num mourão (a casa do construtor)
// ---------------------------------------------------------------------------
function makeNest() {
  const p = new Pix(22, 34);
  plank(p, 9, 16, 4, 18);
  // Forninho de barro
  const clay = [0x6b3a22, 0x8a5230, 0xa86a3e, 0xc88a5a];
  for (let y = 2; y < 18; y++)
    for (let x = 1; x < 21; x++) {
      const dx = (x + 0.5 - 11) / 10,
        dy = (y + 0.5 - 12) / 10;
      if (dx * dx + dy * dy > 1 || y > 17) continue;
      const lit = dx < -0.1 && dy < 0;
      let c = lit ? clay[3] : clay[2];
      if (dy > 0.3) c = clay[1];
      if ((x * 3 + y * 5) % 13 === 0) c = clay[1];
      p.set(x, y, c);
    }
  p.rect(1, 16, 20, 2, clay[0]);
  // Entrada lateral
  p.ellipse(15, 12, 2.5, 3, PAL.ink);
  p.set(14, 10, clay[0]);
  p.outline(K);
  return p;
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
  makeShrine().register(scene, "camp_shrine");
  makeForge().register(scene, "camp_forge");
  makeBoard().register(scene, "camp_board");
  makeNest().register(scene, "camp_nest");
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
