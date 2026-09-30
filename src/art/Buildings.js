// Construções da Clareira, desenhadas à mão em código: Santuário, Forja, Mural,
// ninho do João-de-barro, Celeiro e Cozinha. Mesma luz para todas (vem do alto
// à esquerda), contorno tinta por fora e materiais com textura de verdade:
// sapê em fiadas, tábuas com veio e prego, pedra assentada com musgo, barro.
import { PAL } from "./Palette.js";
import { Pix, bayer } from "./PixelArt.js";

const K = PAL.ink;
const STRAW = [PAL.straw0, PAL.straw1, PAL.straw2, PAL.straw3];
const WOOD = [PAL.n1, PAL.n2, PAL.n3, PAL.n4];
const STONE = [PAL.s1, PAL.s2, PAL.s3, PAL.s4];
const CLAY = [PAL.clay0, PAL.clay1, PAL.clay2, PAL.clay3];

// Ruído determinístico 0..1 por pixel (textura sem padrão repetido)
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// MATERIAIS
// ---------------------------------------------------------------------------
// Sapê em fiadas de 4 px, desencontradas: cada fiada começa na sombra da de
// cima, tem fios verticais no corpo e termina em pontas claras e irregulares.
// span(y) → [x0, x1] da cobertura naquela linha.
function thatch(p, y0, y1, span) {
  const C = 4;
  for (let y = y0; y <= y1; y++) {
    const [a, b] = span(y);
    for (let x = a; x <= b; x++) {
      const row = Math.floor((y - y0) / C);
      const bundle = Math.floor((x + row * 2) / 3); // feixes de 3 px, desencontrados
      const jag = Math.floor(hash(bundle, row) * 2); // ponta do feixe desce 0–1 px
      const k = (y - y0) % C;
      const u = (x - a) / Math.max(1, b - a); // 0 esquerda (luz) → 1 direita
      let c;
      if (k === 0) c = STRAW[1]; // sombra da fiada de cima
      else if (k === C - 1) c = jag ? STRAW[3] : STRAW[2]; // pontas
      else c = (x + row) % 3 === 0 ? STRAW[1] : STRAW[2]; // fios
      if (k === 0 && hash(bundle, row + 50) < 0.35) c = STRAW[0];
      if (u < 0.25 && c === STRAW[2]) c = STRAW[3];
      if (u > 0.8) c = c === STRAW[3] ? STRAW[2] : c === STRAW[2] ? STRAW[1] : STRAW[0];
      p.set(x, y, c);
    }
  }
  // franja: pontas soltas na beirada
  const [a, b] = span(y1);
  for (let x = a; x <= b; x++) {
    const n = hash(x, 99);
    if (n < 0.6) p.set(x, y1 + 1, n < 0.25 ? STRAW[1] : STRAW[2]);
    if (n < 0.2) p.set(x, y1 + 2, STRAW[1]);
  }
}

// Beiral: faixa de sombra logo abaixo do telhado (o telhado "sai" da parede)
function eaveShadow(p, y, x0, x1, depth = 2) {
  for (let x = x0; x <= x1; x++)
    for (let d = 0; d < depth; d++) {
      const Y = y + d;
      if (!p.get(x, Y)) continue;
      const c = p.rgb(x, Y);
      if ([STRAW[0], STRAW[1], STRAW[2], STRAW[3]].includes(c)) continue;
      p.set(x, Y, d === 0 ? PAL.inkSoft : WOOD[0]);
    }
}

// Pau-a-pique caiado: reboco branco de cal com barrado de terra embaixo e
// buracos onde o reboco caiu, mostrando o barro e a trama de varas
function wattle(p, x0, y0, w, h) {
  const LIME = [0xa89a80, 0xcdbfa2, 0xe6dcc4, PAL.cream];
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const n = hash(x >> 1, y >> 1);
      const u = (x - x0) / w;
      let c = n > 0.7 ? LIME[3] : n > 0.2 ? LIME[2] : LIME[1];
      if (u > 0.75 && c === LIME[3]) c = LIME[2];
      if (y > y0 + h - 6) c = y === y0 + h - 6 ? CLAY[3] : n > 0.5 ? CLAY[1] : CLAY[2]; // barrado
      p.set(x, y, c);
    }
  for (const [cx, cy, r] of [[x0 + w * 0.12, y0 + h * 0.35, 3.2], [x0 + w * 0.86, y0 + h * 0.25, 2.6]]) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2);
        if (d > r) continue;
        if (d > r - 1) {
          p.set(x, y, CLAY[2]); // borda do barro sob a cal
          continue;
        }
        const stick = x % 3 === 0 || y % 3 === 0;
        p.set(x, y, stick ? (x % 3 === 0 ? WOOD[2] : WOOD[3]) : CLAY[0]);
      }
  }
}

// Tábuas (verticais ou deitadas) com veio, nó e prego nas pontas
function planks(p, x0, y0, w, h, o = {}) {
  const board = o.board ?? 4,
    vertical = o.vertical !== false;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const idx = vertical ? i : j,
        along = vertical ? j : i;
      const pos = idx % board,
        plank = Math.floor(idx / board);
      let c = pos === 0 ? WOOD[3] : pos === board - 1 ? WOOD[0] : WOOD[2];
      const g = hash(plank * 7, along);
      if (pos > 0 && pos < board - 1 && g < 0.1) c = WOOD[1]; // veio
      if (o.shade && i > w * 0.7 && c === WOOD[2]) c = WOOD[1];
      p.set(x0 + i, y0 + j, c);
    }
  if (o.nails !== false) {
    const n = vertical ? Math.ceil(w / board) : Math.ceil(h / board);
    for (let k = 0; k < n; k++) {
      const c = k * board + Math.floor(board / 2);
      if (vertical) {
        p.set(x0 + c, y0 + 1, STONE[3]);
        p.set(x0 + c, y0 + h - 2, STONE[3]);
      } else {
        p.set(x0 + 1, y0 + c, STONE[3]);
        p.set(x0 + w - 2, y0 + c, STONE[3]);
      }
    }
  }
}

// Pedra assentada: blocos irregulares com argamassa, luz em cima/esquerda,
// musgo nas beiradas de cima. inside(x,y) opcional recorta a forma.
function masonry(p, x0, y0, w, h, inside = null, mossy = true) {
  let y = y0,
    row = 0;
  while (y < y0 + h) {
    const rh = 3 + Math.floor(hash(row, 5) * 2);
    let x = x0 - Math.floor(hash(row, 9) * 4);
    let si = 0;
    while (x < x0 + w) {
      const sw = 4 + Math.floor(hash(row, si) * 4);
      const tone = hash(si, row) < 0.25 ? 1 : 0; // algumas pedras mais claras
      for (let j = 0; j < rh; j++)
        for (let i = 0; i < sw; i++) {
          const X = x + i,
            Y = y + j;
          if (X < x0 || X >= x0 + w || Y >= y0 + h) continue;
          if (inside && !inside(X, Y)) continue;
          let c = STONE[1 + tone];
          if (j === rh - 1 || i === sw - 1) c = STONE[0]; // argamassa
          else if (j === 0 || i === 0) c = STONE[2 + tone]; // quina iluminada
          if (hash(X, Y) > 0.94) c = STONE[0];
          p.set(X, Y, c);
        }
      x += sw;
      si++;
    }
    y += rh;
    row++;
  }
  if (mossy)
    for (let X = x0; X < x0 + w; X++) {
      for (let Y = y0; Y < y0 + h; Y++) {
        if (!p.get(X, Y)) continue;
        if (hash(X, 41) < 0.55) p.set(X, Y, hash(X, 42) < 0.5 ? PAL.g4 : PAL.g3);
        if (hash(X, 43) < 0.2) p.set(X, Y + 1, PAL.g3);
        break;
      }
    }
}

// Sombra de contato: escurece a faixa de baixo (onde toca o chão)
function groundAO(p, y, x0, x1) {
  for (let x = x0; x <= x1; x++) {
    const c = p.rgb(x, y);
    if (!p.get(x, y)) continue;
    const darker = { [WOOD[2]]: WOOD[1], [WOOD[3]]: WOOD[2], [STONE[2]]: STONE[1], [STONE[1]]: STONE[0], [CLAY[2]]: CLAY[1], [CLAY[1]]: CLAY[0] }[c];
    if (darker) p.set(x, y, darker);
  }
}

// Poste roliço (tronquinho) com luz à esquerda
function post(p, x, y0, y1, w = 3) {
  for (let y = y0; y <= y1; y++)
    for (let i = 0; i < w; i++) {
      let c = i === 0 ? WOOD[3] : i === w - 1 ? WOOD[0] : WOOD[2];
      if (hash(x + i, y) < 0.08) c = WOOD[1];
      p.set(x + i, y, c);
    }
}

// Guirlanda de flores em arco
function garland(p, x0, x1, y, sag) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const yy = Math.round(y + Math.sin(t * Math.PI) * sag);
    p.set(x, yy, PAL.g3);
    if (x % 2 === 0) p.set(x, yy + 1, PAL.g4);
    if (x % 4 === 1) p.set(x, yy + 1, [PAL.pink, PAL.yel3, PAL.cream, PAL.org3][Math.floor(x / 4) % 4]);
  }
}

// ---------------------------------------------------------------------------
// SANTUÁRIO: altar de pedra em degraus, dois esteios entalhados, telhadinho de
// sapê com guirlanda, bacia d'água e a Semente Dourada flutuando. Oferendas.
// ---------------------------------------------------------------------------
function makeShrine() {
  const W = 62,
    H = 58;
  const p = new Pix(W, H);
  // Degraus
  masonry(p, 3, 50, 56, 8);
  masonry(p, 9, 45, 44, 6);
  masonry(p, 15, 40, 32, 6);
  groundAO(p, 57, 3, 58);
  // Esteios entalhados (faixas e losangos de folha)
  for (const x of [6, 51]) {
    post(p, x, 10, 50, 5);
    for (let y = 14; y < 48; y += 7) {
      for (let i = 0; i < 5; i++) {
        p.set(x + i, y, WOOD[0]);
        p.set(x + i, y + 1, WOOD[3]);
      }
      p.set(x + 2, y + 3, PAL.g4); // losango de folha
      p.set(x + 1, y + 4, PAL.g5);
      p.set(x + 3, y + 4, PAL.g4);
      p.set(x + 2, y + 5, PAL.g3);
    }
  }
  // Viga e telhadinho de sapê
  planks(p, 4, 12, 54, 3, { vertical: false, board: 3, nails: false });
  thatch(p, 0, 11, (y) => [12 - y, 49 + y]);
  eaveShadow(p, 13, 4, 57);
  garland(p, 11, 50, 15, 4);
  // Bacia d'água
  p.ellipse(31, 39, 10, 3.5, STONE[0]);
  p.ellipse(31, 38.5, 9, 2.8, STONE[2]);
  p.ellipse(31, 38.5, 7, 1.8, PAL.t1);
  p.set(28, 38, PAL.ice2);
  p.set(33, 39, PAL.ice1);
  p.rect(27, 41, 9, 4, STONE[1]);
  p.rect(27, 41, 9, 1, STONE[3]);
  // Semente Dourada flutuando (o halo é luz na cena) + brotinho
  p.disc(31, 25, 4.6, PAL.yel1);
  p.disc(30.5, 24.5, 3.6, PAL.yel2);
  p.disc(29.5, 23.5, 1.8, PAL.yel3);
  p.set(29, 23, PAL.white);
  p.rect(31, 18, 1, 3, PAL.g4);
  p.set(30, 17, PAL.g6);
  p.set(32, 17, PAL.g5);
  p.set(29, 18, PAL.g5);
  // Oferendas: cuias com frutas e velinhas
  const bowl = (x, y, fruit) => {
    p.ellipse(x, y, 3, 1.6, CLAY[1]);
    p.rect(x - 3, y - 1, 7, 1, CLAY[3]);
    p.set(x - 1, y - 2, fruit);
    p.set(x, y - 2, fruit);
    p.set(x + 1, y - 2, fruit);
    p.set(x, y - 3, fruit);
  };
  bowl(19, 44, PAL.pur1);
  bowl(43, 44, PAL.org2);
  for (const x of [23, 39]) {
    p.rect(x, 38, 1, 3, PAL.cream);
    p.set(x, 37, PAL.yel3);
  }
  // Florzinhas nos degraus
  for (const [x, y, c] of [[6, 49, PAL.pink], [55, 49, PAL.yel3], [12, 44, PAL.cream], [49, 44, PAL.pink]]) {
    p.set(x, y, c);
    p.set(x, y + 1, PAL.g4);
  }
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// FORJA: forno de pedra em cúpula com chaminé, e um telheiro de sapê cobrindo
// a bigorna no toco, o fole de couro, ferramentas penduradas e a tina d'água
// ---------------------------------------------------------------------------
function makeForge() {
  const W = 68,
    H = 56;
  const p = new Pix(W, H);
  // Telheiro (atrás): postes e cobertura inclinada
  post(p, 38, 16, 54, 3);
  post(p, 63, 20, 54, 3);
  thatch(p, 8, 21, (y) => [36 - Math.floor((y - 8) / 3), 67]);
  for (let x = 34; x < 68; x++) {
    const yy = 21 + Math.floor((x - 34) / 9);
    if (p.get(x, yy - 1)) p.set(x, yy, WOOD[0]);
  }
  // Ferramentas penduradas na viga
  p.rect(44, 22, 1, 7, WOOD[2]); // martelo
  p.rect(42, 28, 5, 2, STONE[1]);
  p.rect(42, 28, 5, 1, STONE[3]);
  p.line(54, 22, 52, 30, STONE[2]); // tenaz
  p.line(55, 22, 57, 30, STONE[1]);
  // Chaminé
  masonry(p, 24, 1, 8, 20, null, false);
  p.rect(23, 0, 10, 2, STONE[0]);
  p.rect(24, 0, 8, 1, PAL.inkSoft); // fuligem
  // Cúpula do forno
  const cx = 20,
    cy = 38,
    rx = 19,
    ry = 18;
  const inDome = (x, y) => {
    const dx = (x + 0.5 - cx) / rx,
      dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1 && y <= 54;
  };
  masonry(p, 1, 20, 39, 35, inDome);
  // luz na cúpula (esquerda/alto) e sombra (direita/baixo)
  for (let y = 20; y < 55; y++)
    for (let x = 1; x < 40; x++) {
      if (!inDome(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      const c = p.rgb(x, y);
      if (dx > 0.45 && c === STONE[1]) p.set(x, y, STONE[0]);
      if (dx < -0.5 && dy < 0 && c === STONE[1]) p.set(x, y, STONE[2]);
    }
  // Boca em arco: moldura de pedra, interior escuro, lenha e fogo no pé
  for (let y = 37; y < 54; y++)
    for (let x = 10; x < 31; x++) {
      const dx = (x + 0.5 - 20.5) / 9,
        dy = (y + 0.5 - 46) / 9;
      const inArch = dy >= 0 ? Math.abs(dx) <= 1 : dx * dx + dy * dy <= 1;
      const inOpen = dy >= 0 ? Math.abs(dx) <= 0.72 : dx * dx + (dy * 1.08) ** 2 <= 0.52;
      if (!inArch) continue;
      if (!inOpen) {
        p.set(x, y, (x + y) % 4 === 0 ? STONE[1] : STONE[3]); // aduelas claras do arco
        continue;
      }
      const fire = y - 46; // de baixo para cima
      let c = PAL.red0;
      if (y > 49) c = Math.abs(dx) < 0.35 ? PAL.yel3 : Math.abs(dx) < 0.55 ? PAL.org3 : PAL.org1;
      else if (y > 46 && Math.abs(dx) < 0.3 + fire * 0.05) c = hash(x, y) < 0.5 ? PAL.org2 : PAL.org1;
      else if (y > 43 && Math.abs(dx) < 0.18) c = PAL.org1;
      p.set(x, y, c);
    }
  for (const [x0, x1] of [[14, 22], [19, 27]]) p.line(x0, 53, x1, 51, PAL.n1); // lenha cruzada
  p.set(21, 50, PAL.white);
  for (let x = 10; x < 31; x++) p.set(x, 54, STONE[0]);
  // Fole de couro encostado no forno
  p.ellipse(35, 48, 3.5, 2.5, PAL.n2);
  p.rect(33, 46, 5, 1, PAL.n4);
  p.line(38, 48, 41, 46, WOOD[3]);
  // Bigorna no toco
  p.rect(46, 44, 9, 10, WOOD[2]);
  p.rect(46, 44, 9, 1, WOOD[3]);
  for (let y = 45; y < 54; y += 3) p.set(49 + (y % 2), y, WOOD[1]);
  p.rect(45, 40, 12, 3, STONE[1]);
  p.rect(43, 40, 3, 2, STONE[2]); // chifre
  p.rect(45, 40, 12, 1, STONE[3]);
  p.rect(48, 43, 6, 1, STONE[0]);
  // Tina d'água
  p.rect(58, 45, 8, 9, WOOD[1]);
  for (let x = 58; x < 66; x += 2) p.rect(x, 45, 1, 9, WOOD[2]);
  p.rect(58, 47, 8, 1, STONE[1]); // aro
  p.rect(58, 51, 8, 1, STONE[1]);
  p.rect(59, 45, 6, 1, PAL.t2);
  p.set(60, 45, PAL.ice2);
  groundAO(p, 54, 0, 67);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// MURAL: quadro de avisos coberto de sapê, papéis presos, um mapa com X,
// uma folha, e uma lamparina no esteio
// ---------------------------------------------------------------------------
function makeBoard() {
  const W = 50,
    H = 58;
  const p = new Pix(W, H);
  post(p, 5, 12, 57, 4);
  post(p, 40, 12, 57, 4);
  // fundo de tábuas
  planks(p, 7, 17, 36, 26, { vertical: true, board: 4, shade: true });
  // moldura
  for (let x = 6; x < 44; x++) {
    p.set(x, 16, WOOD[3]);
    p.set(x, 43, WOOD[0]);
  }
  // telhadinho
  thatch(p, 0, 12, (y) => [12 - y, 37 + y]);
  eaveShadow(p, 15, 6, 44, 2);
  // papéis (com sombrinha) e tachinhas
  const paper = (x, y, w, h, tack, lines = true) => {
    p.rect(x + 1, y + 1, w, h, WOOD[0]);
    p.rect(x, y, w, h, PAL.cream);
    p.rect(x, y + h - 1, w, 1, 0xd8ccb0);
    if (lines) for (let l = 2; l < h - 1; l += 2) p.rect(x + 1, y + l, w - 2 - ((l * 3) % 3), 1, STONE[3]);
    p.set(x + Math.floor(w / 2), y, tack);
  };
  paper(10, 19, 9, 11, PAL.red2);
  paper(21, 20, 11, 8, PAL.ice2);
  paper(34, 19, 7, 10, PAL.yel2);
  paper(12, 32, 10, 8, PAL.g5);
  // mapa com trilha e X
  p.rect(25, 31, 13, 9, WOOD[0]);
  p.rect(24, 30, 13, 9, 0xd8ccb0);
  p.line(25, 37, 29, 33, PAL.n2);
  p.line(29, 33, 33, 35, PAL.n2);
  p.set(34, 32, PAL.red2);
  p.set(35, 33, PAL.red2);
  p.set(35, 31, PAL.red2);
  p.set(34, 34, PAL.red2);
  p.set(30, 30, PAL.pur2);
  // folha presa
  p.line(10, 42, 14, 40, PAL.g4);
  p.set(11, 40, PAL.g5);
  p.set(13, 42, PAL.g3);
  // lamparina no esteio direito
  p.rect(45, 22, 3, 1, STONE[1]);
  p.rect(45, 23, 3, 4, STONE[0]);
  p.rect(46, 24, 1, 2, PAL.yel3);
  groundAO(p, 57, 0, 49);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// NINHO DO JOÃO-DE-BARRO: forninho de barro (de verdade: bocas de lado,
// torrões aparentes) no alto de um mourão com um galho seco
// ---------------------------------------------------------------------------
function makeNest() {
  const W = 30,
    H = 46;
  const p = new Pix(W, H);
  post(p, 12, 18, 45, 5);
  for (let y = 22; y < 44; y += 5) p.set(13, y, WOOD[1]);
  // galho com folhinhas
  p.line(16, 26, 25, 20, WOOD[2]);
  p.line(21, 23, 24, 25, WOOD[2]);
  for (const [x, y] of [[26, 19], [25, 18], [24, 26], [27, 20]]) p.set(x, y, PAL.g4);
  p.set(26, 18, PAL.g5);
  // forninho: torrões de barro com relevo (luz em cima de cada torrão)
  const cx = 14.5,
    cy = 12;
  for (let y = 1; y < 21; y++)
    for (let x = 2; x < 28; x++) {
      const dx = (x + 0.5 - cx) / 12,
        dy = (y + 0.5 - cy) / 10.5;
      if (dx * dx + dy * dy > 1 || y > 19) continue;
      const shade = dx * 0.6 + dy * 0.8; // luz do alto à esquerda
      let tone = shade < -0.55 ? 3 : shade < 0 ? 2 : shade < 0.5 ? 1 : 0;
      // torrões: células de 3×2 px, com a borda de baixo mais escura
      const cxl = Math.floor((x + (Math.floor(y / 2) % 2) * 1.5) / 3),
        cyl = Math.floor(y / 2);
      const n = hash(cxl, cyl);
      if ((y % 2 === 1 || (x + (cyl % 2)) % 3 === 0) && tone > 0) tone--;
      if (n > 0.8 && tone < 3) tone++;
      p.set(x, y, CLAY[tone]);
    }
  p.rect(3, 18, 23, 2, CLAY[0]);
  // entrada lateral (boca) com borda
  p.ellipse(20.5, 11, 2.6, 3.4, K);
  p.set(18, 8, CLAY[3]);
  p.set(18, 13, CLAY[0]);
  p.set(22, 14, CLAY[1]);
  // palhinhas presas no barro
  p.set(6, 6, PAL.straw3);
  p.set(7, 5, PAL.straw2);
  p.set(24, 16, PAL.straw2);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// CELEIRO (paiol): sobre pés de pedra com "chapéu" contra ratos, tábuas com
// travessas, porta aberta com sacas e milho, escada e réstia de milho
// ---------------------------------------------------------------------------
function makeBarn() {
  const W = 56,
    H = 58;
  const p = new Pix(W, H);
  // pés + chapéus de pedra
  for (const x of [8, 25, 42]) {
    post(p, x, 44, 57, 4);
    p.rect(x - 2, 46, 8, 2, STONE[1]);
    p.rect(x - 2, 46, 8, 1, STONE[3]);
  }
  // corpo
  planks(p, 5, 24, 45, 20, { vertical: true, board: 5, shade: true });
  for (let x = 5; x < 50; x++) {
    p.set(x, 33, WOOD[1]); // travessa
    p.set(x, 32, WOOD[3]);
    p.set(x, 43, WOOD[0]);
  }
  // porta aberta com a colheita
  p.rect(19, 27, 15, 16, PAL.n0);
  p.rect(19, 27, 15, 1, PAL.inkSoft);
  p.ellipse(23, 40, 3.2, 2.8, PAL.cream); // saca
  p.set(22, 38, 0xd8ccb0);
  p.rect(23, 37, 1, 1, PAL.n3);
  p.ellipse(30, 41, 3, 2, PAL.org2); // cesto de abóbora
  p.set(29, 40, PAL.org3);
  for (let k = 0; k < 4; k++) p.rect(27 + k, 33 - (k % 2), 1, 3, PAL.yel2); // espigas
  // folha da porta aberta
  planks(p, 34, 27, 5, 16, { vertical: true, board: 5, nails: false });
  p.set(35, 35, STONE[3]);
  // telhado de duas águas (sapê) com cumeeira
  thatch(p, 2, 23, (y) => {
    const half = 3 + (y - 2) * 1.25;
    return [Math.round(27.5 - half), Math.round(27.5 + half)];
  });
  for (let x = 25; x <= 30; x++) p.set(x, 1, WOOD[2]); // cumeeira
  for (let x = 1; x < 55; x++) if (p.get(x, 24) && !p.get(x, 25 + 0)) p.set(x, 25, WOOD[0]);
  for (let x = 5; x < 50; x++) p.set(x, 25, WOOD[0]); // sombra do beiral
  // réstia de milho pendurada no beiral
  for (let k = 0; k < 4; k++) {
    p.rect(3, 26 + k * 3, 2, 3, k % 2 ? PAL.yel2 : PAL.yel1);
    p.set(3, 26 + k * 3, PAL.yel3);
  }
  p.set(4, 25, PAL.straw1);
  // escada encostada
  p.line(48, 57, 52, 34, WOOD[3]);
  p.line(53, 57, 55, 36, WOOD[2]);
  for (let y = 38; y < 57; y += 4) p.line(Math.round(48 + (57 - y) * 0.17), y, Math.round(53 + (57 - y) * 0.1), y, WOOD[2]);
  groundAO(p, 57, 0, 55);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// COZINHA: telheiro de sapê em quatro esteios; embaixo, o fogão a lenha de
// barro com chapa e duas panelas, prateleira com potes, alho e pimenta
// pendurados, lenha empilhada
// ---------------------------------------------------------------------------
function makeKitchen() {
  const W = 66,
    H = 56;
  const p = new Pix(W, H);
  // parede de pau-a-pique ao fundo
  wattle(p, 6, 14, 54, 28);
  for (let x = 6; x < 60; x++) p.set(x, 41, CLAY[0]);
  // esteios
  for (const x of [4, 60]) post(p, x, 12, 55, 3);
  // prateleira de tábua ao fundo com potes
  planks(p, 7, 22, 22, 2, { vertical: false, board: 2, nails: false });
  for (const [x, c] of [[9, CLAY[2]], [13, PAL.cream], [17, CLAY[3]], [22, PAL.ice1], [26, CLAY[2]]]) {
    p.rect(x, 18, 3, 4, c);
    p.rect(x, 18, 3, 1, c === PAL.cream ? 0xd8ccb0 : CLAY[1]);
  }
  // réstia de alho e pimentas no esteio
  for (let k = 0; k < 4; k++) {
    p.disc(9 + (k % 2), 27 + k * 3, 1.3, PAL.cream);
    p.set(58, 25 + k * 3, PAL.red2);
    p.set(57, 26 + k * 3, PAL.red1);
  }
  // fogão de barro
  const x0 = 12,
    y0 = 34,
    w = 34,
    h = 19;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if ((x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1)) continue;
      let c = CLAY[2];
      if (x < x0 + 3 || y < y0 + 2) c = CLAY[3];
      if (y > y0 + h - 4 || x > x0 + w - 4) c = CLAY[1];
      const n = hash(x >> 1, y >> 1);
      if (n > 0.86) c = CLAY[1];
      p.set(x, y, c);
    }
  // chapa de ferro e duas bocas
  p.rect(x0, y0 - 2, w, 3, STONE[1]);
  p.rect(x0, y0 - 2, w, 1, STONE[2]);
  // boca de lenha com brasa
  for (let y = y0 + 8; y < y0 + h - 1; y++)
    for (let x = x0 + 6; x < x0 + 17; x++) {
      const dx = (x + 0.5 - (x0 + 11.5)) / 5.5,
        dy = (y + 0.5 - (y0 + h - 1)) / 9;
      if (dx * dx + dy * dy > 1) continue;
      const heat = 1 - Math.hypot(dx, dy * 1.3);
      p.set(x, y, heat > 0.6 ? PAL.yel3 : heat > 0.4 ? PAL.org3 : heat > 0.2 ? PAL.org2 : PAL.red0);
    }
  // panelas de barro em cima: bojo sombreado, boca clara, caldo e vapor
  const pot = (cx, cy, rw, rh, broth) => {
    for (let y = Math.floor(cy - rh); y <= cy + rh; y++)
      for (let x = Math.floor(cx - rw); x <= cx + rw; x++) {
        const dx = (x + 0.5 - cx) / rw,
          dy = (y + 0.5 - cy) / rh;
        if (dx * dx + dy * dy > 1) continue;
        p.set(x, y, dx < -0.35 && dy < 0.2 ? CLAY[3] : dx > 0.45 || dy > 0.5 ? CLAY[1] : CLAY[2]);
      }
    const top = Math.round(cy - rh);
    p.rect(Math.round(cx - rw + 1), top - 1, Math.round(rw * 2 - 1), 2, CLAY[3]); // boca
    p.rect(Math.round(cx - rw + 2), top - 1, Math.round(rw * 2 - 3), 1, broth); // caldo
    p.set(Math.round(cx - rw) - 1, Math.round(cy - 1), CLAY[1]); // alças
    p.set(Math.round(cx + rw) + 1, Math.round(cy - 1), CLAY[1]);
    for (const [dx, dy] of [[-1, -3], [1, -5], [0, -7]]) p.set(Math.round(cx + dx), top + dy, PAL.white); // vapor
  };
  pot(20, 28, 5.5, 3.6, PAL.org3);
  pot(34, 29, 4.5, 3, PAL.cream);
  // lenha empilhada à direita: toras com os anéis do corte
  const log = (cx, cy) => {
    p.disc(cx, cy, 2.2, WOOD[1]);
    p.disc(cx - 0.3, cy - 0.3, 1.6, WOOD[3]);
    p.set(Math.round(cx), Math.round(cy), WOOD[2]);
  };
  for (const [cx, cy] of [[52, 52], [57, 52], [62, 52], [54.5, 48.5], [59.5, 48.5], [57, 45]]) log(cx, cy);
  // chaminé de barro subindo pro telhado
  for (let y = 14; y < 32; y++)
    for (let x = 42; x < 47; x++) p.set(x, y, x === 42 ? CLAY[3] : x === 46 ? CLAY[0] : CLAY[2]);
  // telheiro de sapê
  thatch(p, 0, 13, (y) => [8 - Math.floor(y / 2), 57 + Math.floor(y / 2)]);
  eaveShadow(p, 16, 4, 62, 2);
  for (let x = 44; x < 46; x++) p.set(x, 1, CLAY[1]); // a chaminé fura o sapê
  for (let x = 43; x < 47; x++) p.set(x, 0, CLAY[0]);
  groundAO(p, 55, 0, 65);
  return p.outline(K);
}

export function registerBuildings(scene) {
  makeShrine().register(scene, "camp_shrine");
  makeForge().register(scene, "camp_forge");
  makeBoard().register(scene, "camp_board");
  makeNest().register(scene, "camp_nest");
  makeBarn().register(scene, "camp_barn");
  makeKitchen().register(scene, "camp_kitchen");
}
