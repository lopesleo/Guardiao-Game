// Arte procedural da Horta: canteiros, plantas em 5 estágios (semente, broto,
// muda, florindo, pronta) e ícones de colheita, sementes e cuidados.
// Mesma paleta e mesmo estilo do resto (contorno tinta, luz vindo da esquerda).
import { PAL } from "./Palette.js";
import { Pix, registerStrip, bayer, rng } from "./PixelArt.js";

const K = PAL.ink;
const PW = 16,
  PH = 22; // quadro de planta; a base (y = PH-1) fica no chão do canteiro

// ---------------------------------------------------------------------------
// Pincéis
// ---------------------------------------------------------------------------
function stem(p, x, y0, y1, c) {
  for (let y = y1; y <= y0; y++) p.set(x, y, c);
}
// Folha em diagonal a partir de (x, y), para a direita (dir 1) ou esquerda
function leaf(p, x, y, dir, len, [dk, md, lt]) {
  for (let i = 1; i <= len; i++) {
    const lx = x + i * dir,
      ly = y - Math.round(i * 0.6);
    p.set(lx, ly, i === len ? lt : md);
    if (i > 1 && i < len) p.set(lx, ly + 1, dk);
    if (i === 2) p.set(lx, ly - 1, lt);
  }
}
// Folhagem arredondada (moita)
function bush(p, cx, cy, rx, ry, [dk, md, lt]) {
  p.ellipse(cx, cy, rx, ry, md);
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!p.get(x, y)) continue;
      const dx = x - cx,
        dy = y - cy;
      if (dx + dy > rx * 0.5 && bayer(x, y) < 0.6) p.set(x, y, dk);
      else if (dx + dy < -rx * 0.6 && bayer(x, y) < 0.5) p.set(x, y, lt);
    }
}
function mound(p) {
  p.rect(5, PH - 2, 6, 2, PAL.n2);
  p.rect(6, PH - 3, 4, 1, PAL.n3);
}

const LEAF = [PAL.g3, PAL.g4, PAL.g6];
const LEAF_DARK = [PAL.t2, PAL.t3, PAL.g5];

// ---------------------------------------------------------------------------
// Plantas: estágios 0–3 genéricos (com a folha/flor de cada uma) + a madura
// ---------------------------------------------------------------------------
const CROP_ART = {
  carrot: {
    leaf: LEAF,
    flower: PAL.cream,
    ripe(p) {
      // ombro laranja aparecendo na terra + rama cheia
      p.ellipse(8, PH - 3, 3, 2, PAL.org2);
      p.set(7, PH - 4, PAL.org3);
      for (const [dx, h] of [[-3, 7], [-1, 10], [1, 11], [3, 8], [0, 9]]) {
        stem(p, 8 + dx, PH - 5, PH - 5 - h, PAL.g4);
        p.set(8 + dx - 1, PH - 5 - h, PAL.g6);
        p.set(8 + dx + 1, PH - 4 - h, PAL.g5);
        p.set(8 + dx - 1, PH - 1 - h, PAL.g5);
      }
    },
  },
  corn: {
    leaf: LEAF,
    flower: PAL.yel3,
    ripe(p) {
      stem(p, 8, PH - 1, 2, PAL.g4);
      stem(p, 9, PH - 1, 4, PAL.g3);
      leaf(p, 8, PH - 4, -1, 6, LEAF);
      leaf(p, 9, PH - 8, 1, 6, LEAF);
      leaf(p, 8, PH - 13, -1, 5, LEAF);
      // espiga com palha
      p.ellipse(11.5, PH - 11, 2, 4, PAL.yel2);
      p.set(11, PH - 13, PAL.yel3);
      p.set(11, PH - 11, PAL.yel3);
      p.set(12, PH - 9, PAL.yel1);
      p.set(10, PH - 8, PAL.g5);
      p.set(13, PH - 8, PAL.g4);
      // pendão no topo
      p.set(7, 1, PAL.yel3);
      p.set(9, 1, PAL.yel3);
      p.set(8, 0, PAL.yel2);
    },
  },
  cassava: {
    leaf: LEAF_DARK,
    flower: null,
    ripe(p) {
      // raízes aparecendo na terra + caules finos com folhas em mão no alto
      p.ellipse(5, PH - 2, 3, 1.5, PAL.n3);
      p.ellipse(11, PH - 2, 3, 1.5, PAL.n3);
      p.set(4, PH - 3, PAL.n4);
      p.set(10, PH - 3, PAL.n4);
      p.line(8, PH - 3, 5, 6, PAL.n3);
      p.line(8, PH - 3, 11, 4, PAL.n2);
      p.line(8, PH - 3, 8, 10, PAL.n3);
      bush(p, 5, 5, 3.5, 2.5, LEAF_DARK);
      bush(p, 11, 3.5, 3.5, 2.5, LEAF_DARK);
      bush(p, 8, 9, 3, 2, LEAF_DARK);
    },
  },
  bean: {
    leaf: LEAF,
    flower: PAL.pink,
    ripe(p) {
      // rama subindo na estaca, vagens penduradas
      stem(p, 11, PH - 1, 2, PAL.n3);
      p.set(11, 1, PAL.n4);
      for (let y = PH - 2; y > 3; y--) p.set(10 + (Math.floor(y / 3) % 2 ? 0 : -1), y, PAL.g4);
      bush(p, 8, 7, 3, 2, LEAF);
      bush(p, 7, 12, 3, 2, LEAF);
      bush(p, 9, 16, 3, 2, LEAF);
      for (const [x, y] of [[5, 9], [12, 11], [5, 15], [12, 16]]) {
        p.rect(x, y, 1, 4, PAL.g6);
        p.set(x, y + 1, PAL.g5);
      }
    },
  },
  pumpkin: {
    leaf: LEAF,
    flower: PAL.yel2,
    ripe(p) {
      leaf(p, 5, PH - 7, -1, 4, LEAF);
      leaf(p, 11, PH - 8, 1, 4, LEAF);
      p.ellipse(8, PH - 5, 6, 4.5, PAL.org2);
      for (const x of [5, 8, 11]) for (let y = PH - 8; y < PH - 1; y++) p.over(x, y, PAL.org1);
      p.set(5, PH - 7, PAL.org3);
      p.set(6, PH - 8, PAL.org3);
      p.rect(8, PH - 11, 1, 2, PAL.g3);
      p.set(9, PH - 11, PAL.g5);
    },
  },
  pepper: {
    leaf: LEAF,
    flower: PAL.cream,
    ripe(p) {
      stem(p, 8, PH - 1, PH - 6, PAL.g3);
      bush(p, 8, PH - 10, 5, 4, LEAF);
      for (const [x, y] of [[5, PH - 8], [10, PH - 7], [7, PH - 12], [12, PH - 11]]) {
        p.rect(x, y, 1, 3, PAL.red2);
        p.set(x, y - 1, PAL.g5);
        p.set(x + 1, y + 1, PAL.red1);
      }
    },
  },
  frost: {
    leaf: [PAL.t2, PAL.t3, PAL.ice3],
    flower: PAL.ice3,
    ripe(p) {
      stem(p, 8, PH - 1, 7, PAL.t3);
      leaf(p, 8, PH - 4, -1, 4, [PAL.t2, PAL.t3, PAL.ice3]);
      leaf(p, 8, PH - 7, 1, 4, [PAL.t2, PAL.t3, PAL.ice3]);
      // flor de cristal
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        for (let r = 1; r <= 3; r++) p.set(Math.round(8 + Math.cos(ang) * r), Math.round(5 + Math.sin(ang) * r), r === 3 ? PAL.ice3 : PAL.ice2);
      }
      p.set(8, 5, PAL.white);
    },
  },
  thunder: {
    leaf: [PAL.pur0, PAL.pur1, PAL.pur2],
    flower: PAL.pur3,
    ripe(p) {
      // folhas em zigue-zague com faíscas
      for (const [x0, dir] of [[7, -1], [9, 1], [8, -1]]) {
        let x = x0;
        for (let y = PH - 1; y > 4 + (x0 === 8 ? 0 : 3); y--) {
          p.set(x, y, y % 4 < 2 ? PAL.pur2 : PAL.pur1);
          if (y % 3 === 0) x += dir;
          if (y % 6 === 0) x -= dir * 2;
        }
      }
      for (const [x, y] of [[4, 6], [12, 5], [8, 2], [13, 11]]) p.set(x, y, PAL.yel3);
    },
  },
};

function cropFrames(id) {
  const a = CROP_ART[id];
  const frames = [];
  // 0 semente: montinho de terra com o grão
  let p = new Pix(PW, PH);
  mound(p);
  p.set(8, PH - 4, id === "pepper" || id === "frost" || id === "thunder" ? PAL.yel3 : PAL.n4);
  frames.push(p.outline(K));
  // 1 broto
  p = new Pix(PW, PH);
  mound(p);
  stem(p, 8, PH - 3, PH - 6, a.leaf[1]);
  p.set(7, PH - 7, a.leaf[2]);
  p.set(6, PH - 7, a.leaf[1]);
  p.set(9, PH - 7, a.leaf[2]);
  p.set(10, PH - 8, a.leaf[1]);
  frames.push(p.outline(K));
  // 2 muda
  p = new Pix(PW, PH);
  mound(p);
  stem(p, 8, PH - 3, PH - 11, a.leaf[1]);
  leaf(p, 8, PH - 5, -1, 4, a.leaf);
  leaf(p, 8, PH - 7, 1, 4, a.leaf);
  leaf(p, 8, PH - 10, -1, 3, a.leaf);
  p.set(8, PH - 12, a.leaf[2]);
  frames.push(p.outline(K));
  // 3 florindo (crescida, com flor)
  p = new Pix(PW, PH);
  mound(p);
  stem(p, 8, PH - 3, PH - 15, a.leaf[1]);
  leaf(p, 8, PH - 5, -1, 5, a.leaf);
  leaf(p, 8, PH - 8, 1, 5, a.leaf);
  leaf(p, 8, PH - 11, -1, 4, a.leaf);
  leaf(p, 8, PH - 13, 1, 3, a.leaf);
  if (a.flower != null) {
    p.disc(8.5, PH - 16.5, 1.6, a.flower);
    p.set(8, PH - 17, PAL.yel2);
  } else bush(p, 8, PH - 15, 3, 2, a.leaf);
  frames.push(p.outline(K));
  // 4 pronta
  p = new Pix(PW, PH);
  a.ripe(p);
  frames.push(p.outline(K));
  return frames;
}

// ---------------------------------------------------------------------------
// Canteiro (terra arada) e canteiro fechado (mato, pedra)
// ---------------------------------------------------------------------------
const BW = 24,
  BH = 16; // canteiro (tamanho de arte; ×3 no mapa)

function plotTile() {
  const p = new Pix(BW, BH);
  const r = rng(77);
  // Leira de terra fofa: cantos arredondados, camalhões com sulcos entre eles
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      if ((x === 0 || x === BW - 1) && (y === 0 || y === BH - 1)) continue;
      p.set(x, y, PAL.n1);
    }
  for (const ry of [2, 6, 10]) {
    for (let x = 1; x < BW - 1; x++) {
      const w = r() < 0.2 ? 1 : 0; // camalhão levemente irregular
      p.set(x, ry - w, PAL.n3);
      p.set(x, ry + 1, PAL.n2);
      p.set(x, ry + 2, PAL.n2);
      if (r() < 0.18) p.set(x, ry + 1, PAL.n4); // torrão iluminado
    }
  }
  for (let x = 1; x < BW - 1; x++) p.set(x, 14, PAL.n2);
  for (let i = 0; i < 7; i++) p.set(1 + Math.floor(r() * (BW - 2)), 1 + Math.floor(r() * (BH - 2)), PAL.n0);
  return p.outline(K);
}

function plotLocked() {
  const p = new Pix(BW, BH);
  p.ellipse(12, 9, 11, 6, PAL.g2);
  for (let y = 3; y < BH; y++)
    for (let x = 1; x < BW - 1; x++) if (p.get(x, y) && bayer(x, y) < 0.35) p.set(x, y, PAL.g3);
  // tufos de mato
  for (const x of [3, 8, 13, 18, 21]) {
    p.set(x, 5, PAL.g4);
    p.set(x + 1, 4, PAL.g5);
    p.set(x - 1, 6, PAL.g4);
  }
  // pedra
  p.ellipse(15, 10, 3, 2, PAL.s2);
  p.set(14, 9, PAL.s3);
  p.set(13, 10, PAL.s3);
  // toco
  p.rect(5, 9, 3, 3, PAL.n3);
  p.rect(5, 9, 3, 1, PAL.n4);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// CELEIRO: paiol de madeira sobre pés de pedra, telhado de palha, porta aberta
// com sacas e cestos à mostra
// ---------------------------------------------------------------------------
function makeBarn() {
  const p = new Pix(40, 40);
  // Pés de pedra
  for (const x of [6, 18, 30]) {
    p.rect(x, 34, 5, 5, PAL.s2);
    p.rect(x, 34, 5, 1, PAL.s3);
  }
  // Corpo de tábuas
  for (let y = 16; y < 35; y++)
    for (let x = 4; x < 37; x++) {
      const i = (x - 4) % 5;
      let c = i === 0 ? PAL.n4 : i === 4 ? PAL.n1 : PAL.n3;
      if ((x * 3 + y * 7) % 19 === 0 && i > 0 && i < 4) c = PAL.n2;
      p.set(x, y, c);
    }
  p.rect(4, 26, 33, 1, PAL.n1); // travessa
  // Porta aberta com a colheita dentro
  p.rect(15, 21, 11, 14, PAL.n0);
  p.ellipse(18, 32, 3, 2.5, PAL.cream); // saca
  p.set(17, 30, PAL.n4);
  p.ellipse(23, 33, 2.5, 1.8, PAL.org2); // cesto de cenoura/abóbora
  p.set(22, 32, PAL.g5);
  p.rect(20, 25, 2, 4, PAL.yel2); // espiga pendurada
  p.rect(14, 21, 1, 14, PAL.n4);
  p.rect(26, 21, 1, 14, PAL.n1);
  // Telhado de palha
  for (let i = 0; i < 14; i++) {
    const y = 2 + i;
    for (let x = 20 - i * 1.5 - 2; x < 20 + i * 1.5 + 2; x++) {
      const c = (Math.floor(x) + y * 2) % 5 === 0 ? PAL.yel1 : y % 3 === 0 ? PAL.n4 : 0xc49a52; // palha
      p.set(x, y, c);
    }
  }
  for (let x = 0; x < 40; x++) p.set(x, 16, (x % 3 ? 0xa07a3e : PAL.n3));
  p.outline(K);
  return p;
}

// ---------------------------------------------------------------------------
// Ícones (colheita, sementes e cuidados)
// ---------------------------------------------------------------------------
function thick(p, x0, y0, x1, y1, r0, r1, col) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    p.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, col);
  }
}

const ICONS = {
  carrot() {
    const p = new Pix(13, 13);
    thick(p, 8, 4, 2.5, 11, 2.4, 0.7, PAL.org2);
    p.set(6, 5, PAL.org3);
    p.set(5, 6, PAL.org3);
    for (const [x, y] of [[6, 7], [4, 9]]) p.set(x, y, PAL.org1);
    p.line(8, 4, 10, 0, PAL.g5);
    p.line(9, 4, 12, 2, PAL.g4);
    p.line(8, 3, 7, 0, PAL.g6);
    return p.outline(K);
  },
  corn() {
    const p = new Pix(12, 14);
    p.ellipse(6, 6, 3, 5.5, PAL.yel2);
    for (let y = 2; y < 12; y++) for (let x = 3; x < 10; x++) if (p.get(x, y) && (x + y) % 2 === 0) p.set(x, y, PAL.yel3);
    for (let y = 2; y < 12; y++) p.over(8, y, PAL.yel1);
    thick(p, 2, 13, 5, 7, 1.2, 0.5, PAL.g4);
    thick(p, 10, 13, 8, 7, 1.2, 0.5, PAL.g5);
    return p.outline(K);
  },
  cassava() {
    const p = new Pix(14, 12);
    thick(p, 2, 9, 11, 3, 1.6, 2.4, PAL.n3);
    p.line(3, 8, 9, 3, PAL.n4);
    p.disc(11.5, 3, 1.8, PAL.cream);
    p.set(11, 3, PAL.yel3);
    return p.outline(K);
  },
  bean() {
    const p = new Pix(13, 10);
    thick(p, 1.5, 7, 11, 3, 1.8, 1.8, PAL.g4);
    for (const [x, y] of [[3.5, 6.2], [6.5, 5], [9.5, 3.8]]) p.disc(x, y, 1.6, PAL.g5);
    p.line(2, 6, 10, 2, PAL.g6);
    return p.outline(K);
  },
  pumpkin() {
    const p = new Pix(14, 12);
    p.ellipse(7, 7, 6, 4.5, PAL.org2);
    for (const x of [4, 7, 10]) for (let y = 3; y < 12; y++) p.over(x, y, PAL.org1);
    p.set(3, 5, PAL.org3);
    p.set(4, 4, PAL.org3);
    p.rect(7, 0, 1, 3, PAL.g3);
    p.set(8, 1, PAL.g5);
    return p.outline(K);
  },
  pepper() {
    const p = new Pix(12, 13);
    thick(p, 7, 3, 3, 11, 2.2, 0.8, PAL.red2);
    p.set(6, 4, PAL.red3);
    p.set(5, 6, PAL.red3);
    p.rect(6, 1, 3, 2, PAL.g4);
    p.set(8, 0, PAL.g5);
    return p.outline(K);
  },
  frost() {
    const p = new Pix(13, 13);
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2 + 0.3;
      thick(p, 6.5, 6.5, 6.5 + Math.cos(ang) * 5, 6.5 + Math.sin(ang) * 5, 1.3, 0.6, PAL.ice2);
    }
    p.disc(6.5, 6.5, 1.8, PAL.ice3);
    p.set(6, 6, PAL.white);
    return p.outline(K);
  },
  thunder() {
    const p = new Pix(12, 14);
    p.ellipse(6, 7, 4, 6, PAL.pur1);
    p.line(6, 1, 6, 13, PAL.pur2);
    const z = [[7, 3], [5, 5], [7, 7], [5, 9], [7, 11]];
    for (const [x, y] of z) p.set(x, y, PAL.yel3);
    return p.outline(K);
  },
  // semente rara (brilha no HUD da partida e no celeiro)
  seed() {
    const p = new Pix(10, 12);
    p.ellipse(5, 7, 3.5, 4.5, PAL.yel1);
    p.ellipse(4.5, 6.5, 2.5, 3.5, PAL.yel2);
    p.set(3, 5, PAL.yel3);
    p.set(4, 4, PAL.white);
    p.set(5, 1, PAL.g5);
    p.set(6, 0, PAL.g6);
    p.set(4, 0, PAL.g6);
    return p.outline(K);
  },
  sprout() {
    const p = new Pix(12, 12);
    p.rect(2, 9, 8, 3, PAL.n2);
    p.rect(3, 9, 6, 1, PAL.n3);
    stem(p, 6, 8, 4, PAL.g4);
    leaf(p, 6, 5, -1, 4, LEAF);
    leaf(p, 6, 4, 1, 4, LEAF);
    return p.outline(K);
  },
  basket() {
    const p = new Pix(14, 12);
    // cesto de palha com cenoura e espiga
    p.rect(8, 1, 2, 5, PAL.yel2);
    p.set(9, 0, PAL.g5);
    thick(p, 4, 5, 6, 1, 1.4, 0.6, PAL.org2);
    p.line(6, 1, 7, 0, PAL.g5);
    for (let y = 5; y < 12; y++)
      for (let x = 1; x < 13; x++) {
        const inset = Math.max(0, y - 9);
        if (x < 1 + inset || x > 12 - inset) continue;
        p.set(x, y, (x + y) % 2 ? 0xc49a52 : PAL.yel1);
      }
    p.rect(1, 5, 12, 1, PAL.n3);
    return p.outline(K);
  },
  water() {
    const p = new Pix(10, 12);
    for (let y = 1; y < 11; y++) {
      const r = y < 5 ? y * 0.7 : Math.sqrt(Math.max(0, 16 - (y - 7) * (y - 7)));
      for (let x = 0; x < 10; x++) if (Math.abs(x + 0.5 - 5) <= r) p.set(x, y, PAL.ice2);
    }
    for (let y = 7; y < 11; y++) p.over(7, y, PAL.ice1);
    p.set(3, 6, PAL.ice3);
    p.set(3, 7, PAL.white);
    return p.outline(K);
  },
  weed() {
    const p = new Pix(12, 12);
    // tufo de capim-carrapicho: folhas finas em leque + uma florzinha
    for (let a = 0; a < 7; a++) {
      const ang = -Math.PI / 2 + (a - 3) * 0.33;
      const len = 7 + (a % 2) * 2;
      for (let r = 0; r <= len; r++) p.set(Math.round(6 + Math.cos(ang) * r), Math.round(11 + Math.sin(ang) * r), r > len - 2 ? PAL.g5 : a % 2 ? PAL.g3 : PAL.g4);
    }
    p.disc(3, 4, 1.2, PAL.yel2);
    return p.outline(K);
  },
  pest() {
    const p = new Pix(14, 9);
    for (let i = 0; i < 5; i++) p.disc(3 + i * 2.2, 5 + (i % 2 ? -0.6 : 0), 2, i % 2 ? PAL.g5 : PAL.g4);
    p.disc(12, 4, 2.2, PAL.g6);
    p.set(12, 3, K);
    p.set(13, 1, PAL.n2);
    p.set(11, 1, PAL.n2);
    for (let i = 0; i < 5; i++) p.set(3 + i * 2, 7, PAL.g3);
    return p.outline(K);
  },
};

export function registerGarden(scene) {
  for (const id of Object.keys(CROP_ART)) registerStrip(scene, `crop_${id}`, cropFrames(id));
  plotTile().register(scene, "garden_plot");
  plotLocked().register(scene, "garden_locked");
  makeBarn().register(scene, "camp_barn");
  for (const [k, fn] of Object.entries(ICONS)) fn().register(scene, `ico_${k}`);
}

// Ícone de colheita por planta (chave de GARDEN.CROPS)
export const cropIcon = (id) => `ico_${id}`;
