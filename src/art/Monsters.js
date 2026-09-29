// Bestiário próprio — criaturas da floresta CORROMPIDA. Todas compartilham:
// contorno tinta, luz de cima-esquerda, rampas de 4 tons e olhos/rachaduras
// magenta (a "Podridão"), em contraste com os heróis verdes e naturais.
// Cada criatura vira uma tira de quadros "mon_<id>" + animação "<id>_move".
import { PAL } from "./Palette.js";
import { Pix, registerStrip, bayer } from "./PixelArt.js";

// Corrupção (brilho mágico dos inimigos)
export const ROT = { dark: 0x2a1030, mid: 0x5a1a5e, hot: 0xb0308a, glow: 0xff5ec8 };

const FUR = [0x262130, 0x3a3550, 0x5c5676, 0x847ea2]; // lobo (claro o bastante p/ ler no chão escuro)
const FUR_ALPHA = [0x140c10, 0x2a1a1c, 0x4a2c26, 0x6e4430]; // lobo alfa (castanho)
const FEATHER = [0x100e16, 0x1e1b2a, 0x302c44, 0x4a4566];
const GOB = [0x24301a, 0x3e4d22, 0x5e6e2e, 0x829444];
const TROLL = [0x1e2a24, 0x34463a, 0x4f6a52, 0x72907a];
const STONE = [0x22222c, 0x3a3a48, 0x5a5a6c, 0x848496];
const BARK = [0x24160f, 0x3d2616, 0x5c3a20, 0x80552e];
const RAG = [0x1a1020, 0x2e1c3a, 0x46285a, 0x603a78];

// Elipse sombreada (luz de cima-esquerda) com rampa escuro→claro
function ell(p, cx, cy, rx, ry, ramp, jitter = 0.18) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      let t = (-dx * 0.55 - dy * 0.75 + 0.9) / 1.8;
      t += (bayer(x, y) - 0.5) * jitter;
      p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))]);
    }
}
const px = (p, list, c) => list.forEach(([x, y]) => p.set(x, y, c));

// ---------------------------------------------------------------------------
// LOBO SOMBRIO (24×16) — corrida em 4 quadros
// ---------------------------------------------------------------------------
function wolf(f, ramp = FUR, eye = ROT.glow, crack = ROT.hot) {
  const p = new Pix(27, 18);
  const bob = f % 2;
  const [c0, c1, c2, c3] = ramp;
  // Patas: pares alternam avanço
  const swing = [
    [1, -1],
    [0, 0],
    [-1, 1],
    [0, 0],
  ][f];
  const leg = (x, dx, near) => {
    const col = near ? c1 : c0;
    for (let y = 11; y <= 16; y++) {
      p.set(x + (y > 13 ? dx : 0), y, col);
      if (y < 14) p.set(x + 1, y, col);
    }
    p.set(x + dx + 1, 16, col);
  };
  // Patas de trás
  leg(6, swing[0], false);
  leg(16, swing[1], false);
  // Cauda felpuda erguida
  ell(p, 3.2, 6 + bob, 2.8, 1.8, ramp);
  px(p, [[1, 4 + bob], [0, 3 + bob]], c2);
  // Corpo + peito fundo
  ell(p, 11, 9 + bob, 7.5, 3.8, ramp);
  ell(p, 16.5, 9 + bob, 3.6, 4.2, ramp);
  // Cabeça erguida
  ell(p, 20.5, 5.5 + bob, 3.6, 3, ramp);
  // Focinho longo
  px(p, [[23, 5], [24, 5], [23, 6], [24, 6], [25, 6], [26, 6], [23, 7], [24, 7], [25, 7]].map(([x, y]) => [x, y + bob]), c2);
  p.set(26, 6 + bob, PAL.ink); // nariz
  p.set(24, 8 + bob, PAL.white); // presa
  px(p, [[25, 8 + bob], [23, 8 + bob]], c0); // mandíbula
  // Orelhas grandes e pontudas
  px(p, [[18, 1], [18, 2], [19, 2], [18, 3], [19, 3]].map(([x, y]) => [x, y + bob]), c2);
  px(p, [[20, 0], [20, 1], [21, 1], [20, 2], [21, 2]].map(([x, y]) => [x, y + bob]), c3);
  // Olho
  p.set(22, 4 + bob, eye);
  // Espinha de cristais corrompidos + rachaduras
  px(p, [[8, 5 + bob], [11, 5 + bob], [14, 5 + bob]], crack);
  px(p, [[8, 4 + bob], [11, 4 + bob]], eye);
  px(p, [[10, 10 + bob], [11, 11 + bob]], crack);
  // Barriga clara
  for (let x = 8; x <= 15; x++) p.over(x, 12 + bob, c2);
  // Patas da frente
  leg(9, swing[1], true);
  leg(18, swing[0], true);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CORVO CARNICEIRO (20×16) — bater de asas em 2 quadros
// ---------------------------------------------------------------------------
function crow(f) {
  const p = new Pix(20, 16);
  const [c0, c1, c2, c3] = FEATHER;
  const up = f === 0;
  // Asa de trás
  if (up) px(p, [[8, 2], [9, 2], [9, 3], [10, 3], [10, 4], [11, 4], [11, 5], [8, 3], [8, 4], [9, 4], [9, 5], [10, 5]], c0);
  else px(p, [[8, 11], [9, 11], [9, 12], [10, 12], [10, 13], [8, 12], [9, 13], [11, 11], [11, 12]], c0);
  // Corpo, cauda, cabeça
  ell(p, 9, 8, 5.5, 3.4, FEATHER);
  px(p, [[3, 8], [2, 7], [2, 9], [1, 8], [3, 9], [1, 10]], c1);
  ell(p, 15, 6, 2.9, 2.6, FEATHER);
  // Bico
  px(p, [[18, 6], [17, 6], [18, 7], [19, 7]], PAL.yel1);
  p.set(18, 6, PAL.yel2);
  p.set(16, 5, ROT.glow);
  // Asa da frente
  if (up) px(p, [[6, 1], [7, 1], [7, 2], [8, 5], [6, 2], [6, 3], [7, 3], [7, 4], [8, 6], [5, 2], [6, 4], [7, 5], [9, 6]], c2);
  else px(p, [[6, 10], [7, 10], [7, 11], [7, 12], [8, 13], [6, 11], [6, 12], [5, 11], [8, 14], [9, 14]], c2);
  px(p, [[up ? 5 : 5, up ? 1 : 12]], c3);
  // Garras
  px(p, [[8, 12], [10, 12]], PAL.yel1);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// DUENDE ATIRADOR (16×18) — lança espinhos
// ---------------------------------------------------------------------------
function goblin(f) {
  const p = new Pix(18, 19);
  const bob = f % 2;
  // Pernas
  px(p, [[6, 15], [6, 16], [6, 17], [10, 15], [10, 16], [10, 17]].map(([x, y], i) => [x + (f === 1 ? (i < 3 ? 1 : -1) : 0), y]), PAL.n1);
  // Corpo (trapo roxo)
  ell(p, 8.5, 12 + bob, 4, 3.4, RAG);
  // Cabeça grande
  ell(p, 8.5, 6.5 + bob, 5, 4.3, GOB);
  // Orelhas pontudas
  px(p, [[13, 5 + bob], [14, 5 + bob], [15, 4 + bob], [14, 4 + bob]], GOB[2]);
  px(p, [[3, 5 + bob], [2, 4 + bob], [3, 4 + bob]], GOB[1]);
  // Capuz de trapo
  px(p, [[5, 2 + bob], [6, 2 + bob], [7, 2 + bob], [8, 2 + bob], [9, 2 + bob], [10, 2 + bob], [6, 1 + bob], [7, 1 + bob], [8, 1 + bob], [9, 3 + bob], [11, 3 + bob]], RAG[2]);
  // Olhos e sorriso de dentes
  p.set(9, 6 + bob, ROT.glow);
  p.set(12, 6 + bob, ROT.glow);
  px(p, [[10, 9 + bob], [12, 9 + bob]], PAL.white);
  px(p, [[9, 9 + bob], [11, 9 + bob], [13, 9 + bob]], PAL.ink);
  // Braço com espinho
  px(p, [[12, 11 + bob], [13, 11 + bob], [14, 11 + bob]], GOB[2]);
  px(p, [[15, 10 + bob], [16, 9 + bob], [16, 10 + bob]], ROT.hot);
  p.set(17, 9 + bob, ROT.glow);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// BRUXA DO BREJO (20×24) — chapéu torto, orbe corrompido
// ---------------------------------------------------------------------------
function witch(f) {
  const p = new Pix(21, 25);
  const bob = f % 2;
  const [r0, r1, r2, r3] = RAG;
  // Manto (sino)
  for (let y = 11; y <= 22; y++) {
    const t = (y - 11) / 11;
    const xl = Math.round(7 - t * 3),
      xr = Math.round(13 + t * 3);
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / (xr - xl);
      p.set(x, y + (y > 12 ? bob : 0), u < 0.25 ? r2 : u < 0.7 ? r1 : r0);
    }
  }
  // Barra esfarrapada
  for (let x = 4; x <= 16; x += 2) p.set(x, 23 + bob, r1);
  // Rosto
  ell(p, 10.5, 9 + bob, 3.2, 2.8, [0x3e5a3a, 0x5a7a4a, 0x7a9a5a, 0x9aba6a]);
  p.set(11, 9 + bob, ROT.glow);
  p.set(13, 9 + bob, ROT.glow);
  px(p, [[13, 10 + bob], [14, 11 + bob]], 0x7a9a5a); // nariz
  // Chapéu pontudo torto
  for (let y = 0; y <= 7; y++) {
    const w = Math.round((y / 7) * 5);
    const cx = 9 + Math.round((7 - y) * 0.5);
    for (let x = cx - w; x <= cx + w; x++) p.set(x, y + bob, x < cx ? r3 : r2);
  }
  for (let x = 3; x <= 17; x++) p.set(x, 7 + bob, r1); // aba
  px(p, [[7, 6 + bob], [8, 6 + bob], [9, 6 + bob], [10, 6 + bob], [11, 6 + bob], [12, 6 + bob]], ROT.hot); // faixa
  // Cajado torto com orbe (quadro 1 = ergue)
  const sy = f === 1 ? -2 : 0;
  for (let y = 8 + sy; y <= 23; y++) p.set(17 + (y > 16 ? 1 : 0), y + bob, PAL.n2);
  p.disc(17.5, 6 + sy + bob, 2.2, ROT.hot);
  p.set(17, 5 + sy + bob, ROT.glow);
  p.set(16, 5 + sy + bob, PAL.white);
  px(p, [[15, 14 + bob], [16, 14 + bob]], 0x7a9a5a); // mão
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// TROLL DO MUSGO (28×28) — tanque com clava (também Ogro Ancião em pedra)
// ---------------------------------------------------------------------------
function troll(f, skin = TROLL, eye = ROT.glow) {
  const p = new Pix(30, 29);
  const bob = f % 2;
  const [s0, s1, s2, s3] = skin;
  // Pernas curtas e grossas
  const lx = f === 1 ? 1 : 0;
  for (let y = 22; y <= 27; y++) {
    for (let x = 8; x <= 11; x++) p.set(x + lx, y, s1);
    for (let x = 16; x <= 19; x++) p.set(x - lx, y, s0);
  }
  // Braço de trás
  ell(p, 7, 16 + bob, 3, 5, skin);
  // Corpão
  ell(p, 14, 15 + bob, 9.5, 8.5, skin);
  // Barriga
  ell(p, 15, 18 + bob, 5, 4, [s1, s2, s2, s3], 0.1);
  // Cabeça pequena afundada nos ombros
  ell(p, 17, 7 + bob, 5, 4, skin);
  p.set(18, 6 + bob, eye);
  p.set(21, 6 + bob, eye);
  px(p, [[17, 5 + bob], [18, 5 + bob], [19, 5 + bob], [20, 5 + bob], [21, 5 + bob], [22, 5 + bob]], s0); // sobrancelha
  px(p, [[20, 7 + bob], [20, 8 + bob]], s3); // nariz
  px(p, [[18, 10 + bob], [21, 10 + bob]], PAL.cream); // presas
  px(p, [[18, 9 + bob], [19, 9 + bob], [20, 9 + bob], [21, 9 + bob]], PAL.ink);
  // Musgo nos ombros e rachaduras
  px(p, [[8, 8 + bob], [9, 7 + bob], [10, 7 + bob], [11, 8 + bob], [12, 7 + bob], [22, 9 + bob], [23, 10 + bob]], PAL.g4);
  px(p, [[9, 8 + bob], [11, 7 + bob]], PAL.g5);
  px(p, [[12, 14 + bob], [13, 15 + bob], [12, 16 + bob], [19, 13 + bob]], ROT.hot);
  // Braço da frente + clava
  ell(p, 23, 16 + bob, 3.2, 5, skin);
  for (let y = 9; y <= 22; y++) {
    const w = y < 13 ? 2 : 1;
    for (let x = 26; x < 26 + w; x++) p.set(x, y + bob - (f === 1 ? 1 : 0), y < 13 ? PAL.n3 : PAL.n2);
  }
  px(p, [[27, 9 + bob], [25, 10 + bob]], PAL.s3); // pregos
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// VESPA (13×11) — asas vibrando
// ---------------------------------------------------------------------------
function bee(f) {
  const p = new Pix(14, 12);
  // Asas
  const wy = f === 0 ? 1 : 2;
  px(p, [[5, wy], [6, wy], [7, wy], [5, wy + 1], [6, wy + 1], [7, wy + 1], [8, wy + 1], [6, wy + 2], [7, wy + 2]], PAL.ice3);
  // Abdômen listrado
  for (let x = 2; x <= 8; x++)
    for (let y = 5; y <= 9; y++) {
      const dx = (x - 5) / 3.6,
        dy = (y - 7) / 2.4;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, x % 3 === 0 ? PAL.ink : y < 7 ? PAL.yel3 : PAL.yel2);
    }
  p.set(1, 7, PAL.ink); // ferrão
  p.set(0, 7, ROT.hot);
  // Cabeça
  ell(p, 10, 6, 2.2, 2, [PAL.ink, 0x2a2a30, 0x3a3a44, 0x4a4a55]);
  p.set(11, 5, ROT.glow);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// COGUMELO VENENOSO (16×17) — chapéu roxo com pintas
// ---------------------------------------------------------------------------
function shroom(f) {
  const p = new Pix(17, 18);
  const bob = f % 2;
  // Perninhas
  px(p, [[6, 15], [6, 16], [10, 15], [10, 16]].map(([x, y], i) => [x + (f === 1 ? (i < 2 ? -1 : 1) : 0), y]), PAL.n2);
  // Talo com carinha
  for (let y = 8; y <= 14; y++) for (let x = 5; x <= 11; x++) p.set(x, y + bob, x < 7 ? PAL.cream : x < 10 ? 0xd8c8a8 : 0xb0a080);
  p.set(8, 10 + bob, PAL.ink);
  p.set(10, 10 + bob, PAL.ink);
  px(p, [[8, 12 + bob], [9, 12 + bob], [10, 12 + bob]], ROT.dark);
  // Chapéu
  for (let y = 1; y <= 8; y++)
    for (let x = 0; x <= 16; x++) {
      const dx = (x - 8) / 8,
        dy = (y - 8) / 7;
      if (dx * dx + dy * dy > 1 || y > 8) continue;
      const light = -dx * 0.6 - dy * 0.5;
      p.set(x, y + bob, light > 0.55 ? ROT.glow : light > 0.1 ? ROT.hot : light > -0.3 ? ROT.mid : ROT.dark);
    }
  // Pintas
  px(p, [[5, 3 + bob], [6, 3 + bob], [10, 2 + bob], [12, 5 + bob], [3, 6 + bob], [8, 5 + bob]], PAL.cream);
  // Esporos soltando
  if (f === 1) px(p, [[14, 1], [1, 2]], PAL.g5);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// BAÚ (16×15): fechado, entreaberto, aberto, MÍMICO (2 quadros mordendo)
// ---------------------------------------------------------------------------
function chest(state) {
  const p = new Pix(18, 17);
  const W = [PAL.n1, PAL.n2, PAL.n3, PAL.n4];
  const lidOpen = state === 1 ? 2 : state >= 2 ? 5 : 0;
  // Caixa
  for (let y = 8; y <= 15; y++)
    for (let x = 1; x <= 16; x++) p.set(x, y, x < 3 ? W[3] : x > 14 ? W[0] : y % 3 === 0 ? W[1] : W[2]);
  for (let x = 1; x <= 16; x++) p.set(x, 15, W[0]);
  // Cintas douradas
  for (let y = 8; y <= 15; y++) {
    p.set(4, y, PAL.yel1);
    p.set(13, y, PAL.yel1);
  }
  if (state >= 3) {
    // MÍMICO: bocarra com dentes e língua
    const bite = state === 4 ? 1 : 0;
    for (let x = 2; x <= 15; x++) for (let y = 5 - bite; y <= 8; y++) p.set(x, y, ROT.dark);
    for (let x = 3; x <= 14; x += 2) {
      p.set(x, 8, PAL.white);
      p.set(x + 1, 5 - bite, PAL.white);
    }
    px(p, [[8, 9], [9, 9], [9, 10], [10, 10], [10, 11]], PAL.red2);
    // Tampa levantada
    for (let y = 0 - bite; y <= 4 - bite; y++) for (let x = 1; x <= 16; x++) p.set(x, Math.max(0, y), y === 0 - bite ? W[3] : W[2]);
    p.set(6, 2, ROT.glow);
    p.set(11, 2, ROT.glow);
    p.outline(PAL.ink);
    return p;
  }
  // Tampa (sobe conforme abre)
  const ly = 3 - lidOpen;
  for (let y = ly; y <= ly + 4; y++)
    for (let x = 1; x <= 16; x++) {
      if (y < 0) continue;
      const round = (x === 1 || x === 16) && y === ly;
      if (round) continue;
      p.set(x, y, y === ly ? W[3] : y === ly + 4 ? W[1] : W[2]);
    }
  for (let y = Math.max(0, ly); y <= ly + 4; y++) {
    p.set(4, y, PAL.yel2);
    p.set(13, y, PAL.yel2);
  }
  if (lidOpen) {
    // Interior brilhando
    for (let x = 2; x <= 15; x++) for (let y = ly + 5; y <= 8; y++) p.set(x, y, state === 2 ? PAL.yel3 : PAL.yel1);
  }
  // Fechadura
  if (!lidOpen) {
    px(p, [[8, 7], [9, 7], [8, 8], [9, 8], [8, 9], [9, 9]], PAL.yel2);
    p.set(8, 8, PAL.ink);
  }
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// O ANCIÃO (48×54) — árvore corrompida; fase 2 = ressecado e em brasa
// ---------------------------------------------------------------------------
function elder(f, fury) {
  const p = new Pix(50, 56);
  const sway = f === 1 ? 1 : 0;
  const leaves = fury ? [0x3a1206, PAL.org1, PAL.org2, PAL.yel2] : [PAL.t0, 0x3a1a44, ROT.mid, 0x7a3a8a];
  const eye = fury ? PAL.red3 : PAL.yel3;
  // Raízes-pés
  const root = (x0, dir) => {
    for (let i = 0; i < 7; i++) p.set(x0 + i * dir, 50 + Math.floor(i / 3), BARK[1 + (i % 2)]);
    for (let i = 0; i < 4; i++) p.set(x0 + dir * (i + 2), 52 + Math.floor(i / 2), BARK[1]);
  };
  root(19, -1);
  root(30, 1);
  root(24, 0);
  // Tronco (corpo)
  for (let y = 22; y <= 52; y++) {
    const w = 8 + Math.round(((y - 22) / 30) * 4);
    for (let x = 25 - w; x <= 25 + w; x++) {
      const u = (x - (25 - w)) / (2 * w);
      let c = u < 0.2 ? BARK[3] : u < 0.55 ? BARK[2] : u < 0.85 ? BARK[1] : BARK[0];
      if (x % 4 === 1 && (y * 5 + x) % 9 > 1) c = BARK[0]; // veios verticais
      p.set(x + (y < 30 ? sway : 0), y, c);
    }
  }
  // Braços-galho
  const arm = (x0, y0, dir, up) => {
    for (let i = 0; i < 12; i++) {
      const x = x0 + i * dir,
        y = y0 - Math.round(i * up);
      p.set(x, y, BARK[2]);
      p.set(x, y + 1, BARK[1]);
    }
    const tx = x0 + 12 * dir,
      ty = y0 - Math.round(12 * up);
    px(p, [[tx + dir, ty - 1], [tx + dir * 2, ty - 2], [tx, ty - 2], [tx + dir, ty + 1]], BARK[2]);
  };
  arm(16, 32 - sway, -1, 0.6 + sway * 0.1);
  arm(34, 32 + sway, 1, 0.5);
  // Copa (cachos de folhas corrompidas)
  const blobs = [
    [25, 12, 13, 10],
    [14, 16, 8, 6.5],
    [36, 15, 8, 6.5],
    [19, 7, 7, 5.5],
    [31, 6, 7, 5.5],
  ];
  for (const [cx, cy, rx, ry] of blobs) ell(p, cx + sway, cy, rx, ry, leaves, 0.3);
  // Frutos/brasas
  px(p, [[18, 12], [30, 9], [37, 16], [13, 18], [25, 4]], fury ? PAL.yel3 : ROT.glow);
  // Rosto no tronco
  const fy = 34;
  px(p, [[20, fy], [21, fy], [22, fy + 1], [28, fy + 1], [29, fy], [30, fy]], BARK[0]); // sobrancelhas
  px(p, [[21, fy + 2], [22, fy + 2], [28, fy + 2], [29, fy + 2]], eye);
  px(p, [[21, fy + 3], [29, fy + 3]], fury ? PAL.org2 : PAL.yel2);
  // Boca rachada com brilho
  for (let x = 21; x <= 29; x++) p.set(x, fy + 7 + (x % 2), PAL.ink);
  for (let x = 22; x <= 28; x += 2) p.set(x, fy + 8, fury ? PAL.org2 : ROT.hot);
  // Musgo
  px(p, [[17, 24], [18, 23], [33, 26], [32, 25], [20, 46], [31, 44]], fury ? PAL.n3 : PAL.g4);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// BOLA DE FOGO do Cajado (18×11, 3 quadros de chama tremulando)
// ---------------------------------------------------------------------------
function fireball(f) {
  const p = new Pix(18, 11);
  const flick = [0, 1, -1][f];
  // Cauda em chamas (afina pra trás)
  for (let x = 0; x <= 11; x++) {
    const h = Math.round((x / 11) * 3.2) + (x % 3 === f ? 1 : 0);
    for (let y = 5 - h; y <= 5 + h; y++) {
      const edge = Math.abs(y - 5) === h;
      p.set(x, y + (x < 5 ? flick : 0), edge ? PAL.org1 : x > 7 ? PAL.org3 : PAL.org2);
    }
  }
  // Núcleo
  p.disc(12.5, 5.5, 4.2, PAL.org2);
  p.disc(13, 5.3, 3, PAL.yel2);
  p.disc(13.5, 5, 1.8, PAL.yel3);
  p.set(14, 4, PAL.white);
  return p;
}

// Registra todas as tiras + animações
export function registerMonsters(scene) {
  const strip = (key, frames) => registerStrip(scene, key, frames);
  const anim = (key, tex, frames, rate) => {
    if (!scene.anims.exists(key))
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat: -1 });
  };
  const four = [0, 1, 2, 3];
  strip("mon_wolf", four.map((f) => wolf(f)));
  strip("mon_alpha", four.map((f) => wolf(f, FUR_ALPHA, PAL.yel3, PAL.org2)));
  strip("mon_crow", [crow(0), crow(1)]);
  strip("mon_goblin", [goblin(0), goblin(1)]);
  strip("mon_mage", [witch(0), witch(1)]);
  strip("mon_brute", [troll(0), troll(1)]);
  strip("mon_elder", [troll(0, STONE, PAL.ice2), troll(1, STONE, PAL.ice2)]);
  strip("mon_bee", [bee(0), bee(1)]);
  strip("mon_shroom", [shroom(0), shroom(1)]);
  strip("mon_boss", [elder(0, false), elder(1, false), elder(0, true), elder(1, true)]);
  strip("obj_chest", [chest(0), chest(1), chest(2), chest(3), chest(4)]);
  strip("px_fireball", [fireball(0), fireball(1), fireball(2)]);

  anim("wolf_move", "mon_wolf", four, 12);
  anim("alpha_move", "mon_alpha", four, 10);
  anim("crow_move", "mon_crow", [0, 1], 8);
  anim("goblin_move", "mon_goblin", [0, 1], 6);
  anim("mage_move", "mon_mage", [0, 0, 1, 0], 4);
  anim("brute_move", "mon_brute", [0, 1], 4);
  anim("elder_move", "mon_elder", [0, 1], 3);
  anim("bee_move", "mon_bee", [0, 1], 20);
  anim("shroom_move", "mon_shroom", [0, 1], 5);
  anim("boss_idle", "mon_boss", [0, 1], 2);
  anim("boss_fury", "mon_boss", [2, 3], 4);
  anim("mimic_bite", "obj_chest", [3, 4], 6);
  anim("fireball_fly", "px_fireball", [0, 1, 2], 14);
}
