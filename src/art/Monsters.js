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

// Elipse girada (ang em rad), mesma luz de cima-esquerda — poses de chefe
function rell(p, cx, cy, rx, ry, ang, ramp, jitter = 0.2) {
  const R = Math.max(rx, ry) + 1;
  const c = Math.cos(ang),
    sn = Math.sin(ang);
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const X = x + 0.5 - cx,
        Y = y + 0.5 - cy;
      const u = (X * c + Y * sn) / rx,
        v = (-X * sn + Y * c) / ry;
      if (u * u + v * v > 1) continue;
      let t = (-(X / R) * 0.55 - (Y / R) * 0.75 + 0.9) / 1.8;
      t += (bayer(x, y) - 0.5) * jitter;
      p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))]);
    }
}

// ---------------------------------------------------------------------------
// LOBO SOMBRIO (24×16) — corrida em 4 quadros
// ---------------------------------------------------------------------------
function wolf(f, ramp = FUR, eye = ROT.glow, crack = ROT.hot) {
  const p = new Pix(27, 18);
  // GALOPE em 6 tempos: as patas de trás empurram juntas, as da frente alcançam juntas
  // (meia volta depois); o corpo ondula, a cauda chicoteia e as orelhas deitam no salto
  const k = f % 6;
  const ph = (k / 6) * Math.PI * 2;
  const bob = [0, 1, 1, 0, 0, 1][k];
  const [c0, c1, c2, c3] = ramp;
  // pata: a canela vai à frente/atrás (dx) e sobe (lift) quando está no ar
  const legAt = (phase) => {
    const c = Math.cos(ph - phase);
    return { dx: Math.round(c * 2), lift: Math.sin(ph - phase) > 0.35 ? 1 : 0 };
  };
  const leg = (x, st, near) => {
    const col = near ? c1 : c0;
    for (let y = 11; y <= 16 - st.lift; y++) {
      p.set(x + (y > 13 ? st.dx : 0), y, col);
      if (y < 14) p.set(x + 1, y, col);
    }
    p.set(x + st.dx + 1, 16 - st.lift, col);
  };
  // Patas de trás (longe/perto um tico defasadas)
  leg(6, legAt(0), false);
  leg(16, legAt(Math.PI), false);
  // Cauda felpuda: chicoteia para cima e para baixo
  const ty = [0, -1, -1, 0, 1, 1][k];
  ell(p, 3.2, 6 + bob + ty, 2.8, 1.8, ramp);
  px(p, [[1, 4 + bob + ty * 2], [0, 3 + bob + ty * 2]], c2);
  // Corpo + peito fundo
  ell(p, 11, 9 + bob, 7.5, 3.8, ramp);
  ell(p, 16.5, 9 + bob - (k === 2 ? 1 : 0), 3.6, 4.2, ramp);
  // Cabeça erguida (acena com o galope)
  const hb = bob + (k === 3 ? 1 : 0);
  ell(p, 20.5, 5.5 + hb, 3.6, 3, ramp);
  // Focinho longo
  px(p, [[23, 5], [24, 5], [23, 6], [24, 6], [25, 6], [26, 6], [23, 7], [24, 7], [25, 7]].map(([x, y]) => [x, y + hb]), c2);
  p.set(26, 6 + hb, PAL.ink); // nariz
  p.set(24, 8 + hb, PAL.white); // presa
  px(p, [[25, 8 + hb], [23, 8 + hb]], c0); // mandíbula
  // Orelhas em pé; no salto a ponta deita 1 px para trás (deitar inteira deformava a cabeça)
  const back = k === 1 || k === 2 ? 1 : 0;
  px(p, [[18 - back, 1], [18, 2], [19, 2], [18, 3], [19, 3]].map(([x, y]) => [x, y + hb]), c2);
  px(p, [[20 - back, 0], [20, 1], [21, 1], [20, 2], [21, 2]].map(([x, y]) => [x, y + hb]), c3);
  // Olho
  p.set(22, 4 + hb, eye);
  // Espinha de cristais corrompidos + rachaduras
  px(p, [[8, 5 + bob], [11, 5 + bob], [14, 5 + bob]], crack);
  px(p, [[8, 4 + bob], [11, 4 + bob]], eye);
  px(p, [[10, 10 + bob], [11, 11 + bob]], crack);
  // Barriga clara
  for (let x = 8; x <= 15; x++) p.over(x, 12 + bob, c2);
  // Patas da frente (perto)
  leg(9, legAt(0.5), true);
  leg(18, legAt(Math.PI + 0.5), true);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CORVO CARNICEIRO (20×16) — bater de asas em 2 quadros
// ---------------------------------------------------------------------------
function crow(f) {
  const p = new Pix(20, 16);
  const [c0, c1, c2, c3] = FEATHER;
  // 4 tempos: asa em cima, aberta (descendo), embaixo, aberta (subindo). O corpo sobe na
  // batida (empurrou o ar) e desce no recolher; o rabo abana junto
  const wing = ["up", "mid", "down", "mid"][f % 4];
  const dy = [1, 0, -1, 0][f % 4];
  const sh = (list) => list.map(([x, y]) => [x, y + dy]);
  // Asa de trás
  if (wing === "up") px(p, sh([[8, 2], [9, 2], [9, 3], [10, 3], [10, 4], [11, 4], [11, 5], [8, 3], [8, 4], [9, 4], [9, 5], [10, 5]]), c0);
  else if (wing === "down") px(p, sh([[8, 11], [9, 11], [9, 12], [10, 12], [10, 13], [8, 12], [9, 13], [11, 11], [11, 12]]), c0);
  else px(p, sh([[4, 2], [5, 2], [6, 2], [7, 2], [8, 3], [9, 3], [10, 3], [6, 3], [7, 3], [3, 2]]), c0); // aberta: acima das costas
  // Corpo, cauda (abana), cabeça
  ell(p, 9, 8 + dy, 5.5, 3.4, FEATHER);
  const tail = wing === "down" ? 1 : wing === "up" ? -1 : 0;
  px(p, sh([[3, 8], [2, 7 + tail], [2, 9], [1, 8 + tail], [3, 9], [1, 10 + tail]]), c1);
  ell(p, 15, 6 + dy, 2.9, 2.6, FEATHER);
  // Bico
  px(p, sh([[18, 6], [17, 6], [18, 7], [19, 7]]), PAL.yel1);
  p.set(18, 6 + dy, PAL.yel2);
  p.set(16, 5 + dy, ROT.glow);
  // Asa da frente
  if (wing === "up") px(p, sh([[6, 1], [7, 1], [7, 2], [8, 5], [6, 2], [6, 3], [7, 3], [7, 4], [8, 6], [5, 2], [6, 4], [7, 5], [9, 6]]), c2);
  else if (wing === "down") px(p, sh([[6, 10], [7, 10], [7, 11], [7, 12], [8, 13], [6, 11], [6, 12], [5, 11], [8, 14], [9, 14]]), c2);
  else px(p, sh([[1, 4], [2, 4], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 4], [9, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [10, 5]]), c2);
  const tip = wing === "up" ? [5, 1] : wing === "down" ? [5, 12] : [0, 4];
  p.set(tip[0], tip[1] + dy, c3);
  // Garras recolhidas
  px(p, sh([[8, 12], [10, 12]]), PAL.yel1);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// DUENDE ATIRADOR (16×18) — lança espinhos
// ---------------------------------------------------------------------------
function goblin(f) {
  const p = new Pix(18, 19);
  // 4 tempos: contato (perna da frente adiante), passa, contato (a outra), passa.
  // Corpo desce no contato; orelhas e braço chegam um tempo depois (arrasto)
  const k = f % 4;
  const bob = k % 2 === 0 ? 1 : 0;
  const lag = k % 2 === 1 ? 1 : 0; // o que pende ainda está embaixo quando o corpo sobe
  const fwd = [1, 0, -1, 0][k]; // perna da frente: adiante / junto / atrás
  const legX = (x0, dx, lift) => {
    for (let y = 15; y <= 17 - lift; y++) p.set(x0 + dx, y, PAL.n1);
  };
  legX(6, -fwd, k === 3 ? 1 : 0); // de trás
  legX(10, fwd, k === 1 ? 1 : 0); // da frente
  // Corpo (trapo roxo)
  ell(p, 8.5, 12 + bob, 4, 3.4, RAG);
  // Cabeça grande
  ell(p, 8.5, 6.5 + bob, 5, 4.3, GOB);
  // Orelhas pontudas (a ponta pende com atraso)
  px(p, [[13, 5 + bob], [14, 5 + bob], [15, 4 + bob + lag], [14, 4 + bob]], GOB[2]);
  px(p, [[3, 5 + bob], [2, 4 + bob + lag], [3, 4 + bob]], GOB[1]);
  // Capuz de trapo
  px(p, [[5, 2 + bob], [6, 2 + bob], [7, 2 + bob], [8, 2 + bob], [9, 2 + bob], [10, 2 + bob], [6, 1 + bob], [7, 1 + bob], [8, 1 + bob], [9, 3 + bob], [11, 3 + bob]], RAG[2]);
  // Olhos e sorriso de dentes
  p.set(9, 6 + bob, ROT.glow);
  p.set(12, 6 + bob, ROT.glow);
  px(p, [[10, 9 + bob], [12, 9 + bob]], PAL.white);
  px(p, [[9, 9 + bob], [11, 9 + bob], [13, 9 + bob]], PAL.ink);
  // Braço com espinho (balança com o passo)
  const ay = 11 + bob + lag;
  px(p, [[12, ay], [13, ay], [14, ay]], GOB[2]);
  px(p, [[15, ay - 1], [16, ay - 2], [16, ay - 1]], ROT.hot);
  p.set(17, ay - 2, k === 0 ? PAL.white : ROT.glow); // a ponta pisca
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// BRUXA DO BREJO (20×24) — chapéu torto, orbe corrompido
// ---------------------------------------------------------------------------
function witch(f) {
  const p = new Pix(21, 25);
  // 4 tempos: flutua (sobe e desce devagar), a barra do manto ondula, o chapéu e o orbe
  // chegam com atraso e o orbe pulsa
  const k = f % 4;
  const bob = [0, 0, 1, 1][k];
  const lag = [1, 0, 0, 1][k];
  const [r0, r1, r2, r3] = RAG;
  // Manto (sino)
  for (let y = 11; y <= 22; y++) {
    const t = (y - 11) / 11;
    const wave = y > 18 ? [0, 1, 0, -1][(k + y) % 4] * (t > 0.85 ? 1 : 0) : 0;
    const xl = Math.round(7 - t * 3) + wave,
      xr = Math.round(13 + t * 3) + wave;
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / (xr - xl);
      p.set(x, y + (y > 12 ? bob : 0), u < 0.25 ? r2 : u < 0.7 ? r1 : r0);
    }
  }
  // Barra esfarrapada (as pontas mudam de lugar: o pano ondula)
  for (let x = 4 + (k % 2); x <= 16; x += 2) p.set(x, 23 + bob, r1);
  // Rosto
  ell(p, 10.5, 9 + bob, 3.2, 2.8, [0x3e5a3a, 0x5a7a4a, 0x7a9a5a, 0x9aba6a]);
  p.set(11, 9 + bob, ROT.glow);
  p.set(13, 9 + bob, ROT.glow);
  px(p, [[13, 10 + bob], [14, 11 + bob]], 0x7a9a5a); // nariz
  // Chapéu pontudo torto (a ponta balança com atraso)
  for (let y = 0; y <= 7; y++) {
    const w = Math.round((y / 7) * 5);
    const cx = 9 + Math.round((7 - y) * 0.5) - (y < 3 ? lag : 0);
    for (let x = cx - w; x <= cx + w; x++) p.set(x, y + bob, x < cx ? r3 : r2);
  }
  for (let x = 3; x <= 17; x++) p.set(x, 7 + bob, r1); // aba
  px(p, [[7, 6 + bob], [8, 6 + bob], [9, 6 + bob], [10, 6 + bob], [11, 6 + bob], [12, 6 + bob]], ROT.hot); // faixa
  // Cajado torto com orbe que PULSA (o brilho anda em volta)
  const sy = bob + lag - 1;
  for (let y = 8 + sy; y <= 23 + bob; y++) p.set(17 + (y > 16 ? 1 : 0), y, PAL.n2);
  p.disc(17.5, 6 + sy, [2.2, 2.5, 2.2, 1.9][k], ROT.hot);
  p.set(17, 5 + sy, ROT.glow);
  const spark = [[16, 4], [19, 5], [18, 8], [15, 7]][k];
  p.set(spark[0], spark[1] + sy, PAL.white);
  px(p, [[15, 14 + bob], [16, 14 + bob]], 0x7a9a5a); // mão
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// TROLL DO MUSGO (28×28) — tanque com clava (também Ogro Ancião em pedra)
// ---------------------------------------------------------------------------
function troll(f, skin = TROLL, eye = ROT.glow) {
  const p = new Pix(30, 29);
  // 4 tempos de PISADA PESADA: pé adiante (corpo afunda), passa (sobe), o outro pé,
  // passa. A barriga e o braço chegam com atraso; a clava balança ao contrário do braço
  const k = f % 4;
  const bob = k % 2 === 0 ? 1 : 0;
  const lag = k % 2 === 1 ? 1 : 0;
  const step = [1, 0, -1, 0][k];
  const [s0, s1, s2, s3] = skin;
  // Pernas curtas e grossas (a que passa sobe 1 px)
  for (let y = 22; y <= 27; y++) {
    if (!(k === 3 && y === 27)) for (let x = 8; x <= 11; x++) p.set(x + step, y, s1);
    if (!(k === 1 && y === 27)) for (let x = 16; x <= 19; x++) p.set(x - step, y, s0);
  }
  // Braço de trás (balança)
  ell(p, 7 - step * 0.5, 16 + bob + lag, 3, 5, skin);
  // Corpão
  ell(p, 14, 15 + bob, 9.5, 8.5, skin);
  // Barriga (balança um tempo depois)
  ell(p, 15, 18 + bob + lag * 0.5, 5, 4, [s1, s2, s2, s3], 0.1);
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
  // Braço da frente + clava (sobe quando o braço vai à frente)
  ell(p, 23 + step * 0.5, 16 + bob + lag, 3.2, 5, skin);
  const cy = bob - step;
  for (let y = 9; y <= 22; y++) {
    const w = y < 13 ? 2 : 1;
    for (let x = 26; x < 26 + w; x++) p.set(x, y + cy, y < 13 ? PAL.n3 : PAL.n2);
  }
  px(p, [[27, 9 + cy], [25, 10 + cy]], PAL.s3); // pregos
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// VESPA (13×11) — asas vibrando
// ---------------------------------------------------------------------------
function bee(f) {
  const p = new Pix(14, 12);
  // 4 tempos: as asas sobem, abrem, descem, abrem; o corpo boia
  const k = f % 4;
  const wy = [0, 1, 2, 1][k];
  const dy = [0, 0, 1, 1][k];
  const wide = k % 2 === 1;
  // Asas (translúcidas: tom de gelo)
  const wing = wide
    ? [[4, wy + 1], [5, wy], [6, wy], [7, wy], [8, wy], [5, wy + 1], [6, wy + 1], [7, wy + 1], [8, wy + 1], [9, wy + 1], [6, wy + 2], [7, wy + 2]]
    : [[5, wy], [6, wy], [7, wy], [5, wy + 1], [6, wy + 1], [7, wy + 1], [8, wy + 1], [6, wy + 2], [7, wy + 2]];
  px(p, wing, PAL.ice3);
  p.set(6, wy + (wide ? 0 : 1), PAL.white);
  // Abdômen listrado
  for (let x = 2; x <= 8; x++)
    for (let y = 5; y <= 9; y++) {
      const dx = (x - 5) / 3.6,
        ddy = (y - 7) / 2.4;
      if (dx * dx + ddy * ddy > 1) continue;
      p.set(x, y + dy, x % 3 === 0 ? PAL.ink : y < 7 ? PAL.yel3 : PAL.yel2);
    }
  p.set(1, 7 + dy + (k === 2 ? 1 : 0), PAL.ink); // ferrão mexe
  p.set(0, 7 + dy + (k === 2 ? 1 : 0), ROT.hot);
  // Cabeça
  ell(p, 10, 6 + dy, 2.2, 2, [PAL.ink, 0x2a2a30, 0x3a3a44, 0x4a4a55]);
  p.set(11, 5 + dy, ROT.glow);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// COGUMELO VENENOSO (16×17) — chapéu roxo com pintas
// ---------------------------------------------------------------------------
function shroom(f) {
  const p = new Pix(17, 18);
  // 6 tempos de PULO: em pé, agacha (chapéu achata e alarga), estica, no ar (perninhas
  // recolhidas), cai achatado, assenta. Solta esporos ao cair.
  const k = f % 6;
  const b = [1, 2, 0, 0, 2, 1][k]; // corpo desce
  const sq = [0, 1, -1, 0, 1, 0][k]; // achata (+) / estica (−)
  const air = k === 2 || k === 3;
  // Perninhas (no ar ficam recolhidas)
  const lx = air ? 0 : k === 1 || k === 4 ? 1 : 0;
  const legs = air ? [[6, 15], [10, 15]] : [[6 - lx, 15], [6 - lx, 16], [10 + lx, 15], [10 + lx, 16]];
  px(p, legs, PAL.n2);
  // Talo com carinha (encolhe quando agacha)
  for (let y = 8 + b + Math.max(0, sq); y <= 14; y++) for (let x = 5; x <= 11; x++) p.set(x, y, x < 7 ? PAL.cream : x < 10 ? 0xd8c8a8 : 0xb0a080);
  const fy = Math.min(10 + b, 12);
  p.set(8, fy, PAL.ink);
  p.set(10, fy, PAL.ink);
  px(p, [[8, fy + 2], [9, fy + 2], [10, fy + 2]], ROT.dark);
  // Chapéu (alarga achatado, afina esticado)
  const rx = 8 + sq,
    ry = 7 - sq;
  for (let y = 0; y <= 8; y++)
    for (let x = 0; x <= 16; x++) {
      const dx = (x - 8) / rx,
        dy = (y - 8) / ry;
      if (dx * dx + dy * dy > 1 || y > 8) continue;
      const light = -dx * 0.6 - dy * 0.5;
      p.set(x, y + b, light > 0.55 ? ROT.glow : light > 0.1 ? ROT.hot : light > -0.3 ? ROT.mid : ROT.dark);
    }
  // Pintas
  px(p, [[5, 3 + b + sq], [6, 3 + b + sq], [10, 2 + b + sq], [12, 5 + b], [3, 6 + b], [8, 5 + b]], PAL.cream);
  // Esporos soltando ao cair
  if (k === 4) px(p, [[14, 1], [1, 2], [15, 5]], PAL.g5);
  if (k === 5) px(p, [[15, 0], [0, 1]], PAL.g4);
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
    // MÍMICO: a mordida em 4 tempos (quadros 3-6): aberta, escancarada com a língua para
    // fora, FECHADA (dentes se encontram), entreaberta. Os olhos sobem com a tampa.
    const lift = { 3: 0, 4: 1, 5: 2, 6: -2 }[state]; // quanto a tampa subiu
    const shut = lift < 0;
    const top = shut ? 7 : 5 - lift; // céu da boca
    for (let x = 2; x <= 15; x++) for (let y = top; y <= 8; y++) p.set(x, y, ROT.dark);
    if (!shut) p.set(8, top + 1, ROT.hot); // garganta acesa
    for (let x = 3; x <= 14; x += 2) {
      p.set(x, 8, PAL.white); // dentes de baixo
      p.set(x + (shut ? 0 : 1), shut ? 7 : top, PAL.white); // de cima (fechado: encaixam)
    }
    // Língua: lambe para fora quando escancara, recolhe quando morde
    if (lift === 2) px(p, [[8, 9], [9, 9], [9, 10], [10, 10], [10, 11], [11, 11], [11, 12], [12, 12]], PAL.red2);
    else if (lift >= 0) px(p, [[8, 9], [9, 9], [9, 10], [10, 10], [10, 11]], PAL.red2);
    else px(p, [[9, 9], [10, 9]], PAL.red1);
    // Tampa
    const l0 = shut ? 2 : 0 - lift;
    for (let y = l0; y <= l0 + 4; y++) for (let x = 1; x <= 16; x++) if (y >= 0) p.set(x, y, y === l0 ? W[3] : W[2]);
    for (let y = Math.max(0, l0); y <= l0 + 4; y++) {
      p.set(4, y, PAL.yel2);
      p.set(13, y, PAL.yel2);
    }
    // Olhos de Podridão na tampa (piscam mais forte na mordida)
    const ey = Math.max(0, l0 + 2);
    p.set(6, ey, shut ? PAL.white : ROT.glow);
    p.set(11, ey, shut ? PAL.white : ROT.glow);
    if (shut) for (const [x, y] of [[0, 4], [17, 5], [1, 1]]) p.set(x, y, PAL.yel3); // estalo da mordida
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
// MULA SEM CABEÇA (32×22) — minichefe veloz: mula escura galopando, FOGO no
// lugar da cabeça, crina em chamas e faíscas nas ferraduras (4 quadros)
// ---------------------------------------------------------------------------
const MULA = [0x120a0c, 0x24161a, 0x3a2622, 0x56382c];
function mula(f) {
  const p = new Pix(32, 22);
  // GALOPE em 6 tempos (era só 2 posições de pata): pares de trás e da frente defasados
  // meia volta; a pata no ar sobe 1 px; o corpo sobe e desce com o salto
  const k = f % 6;
  const ph = (k / 6) * Math.PI * 2;
  const bob = [0, 1, 1, 0, 0, 1][k];
  const gait = (phase) => {
    const c = Math.cos(ph - phase);
    return { sw: Math.round(c * 2.2), lift: Math.sin(ph - phase) > 0.45 ? 1 : 0 };
  };
  const legs = [
    [8, gait(0)],
    [11, gait(0.6)],
    [19, gait(Math.PI)],
    [22, gait(Math.PI + 0.6)],
  ];
  for (const [x0, { sw, lift }] of legs) {
    for (let y = 13 + bob; y <= 19 - lift; y++) {
      const x = x0 + Math.round(((y - 13) / 6) * sw * 0.9);
      p.set(x, y, MULA[1]);
      p.set(x + 1, y, MULA[0]);
    }
    const hx = x0 + Math.round(sw * 0.9);
    p.set(hx, 20 - lift, PAL.s3); // ferradura
    p.set(hx + 1, 20 - lift, PAL.s2);
    if (!lift && (k + x0) % 3 === 0) p.set(hx + 2, 21, PAL.yel3); // faísca do casco no chão
  }
  // Corpo
  ell(p, 15, 10 + bob, 10, 4.6, MULA, 0.25);
  // Rabo (pelo escuro com ponta em brasa)
  px(p, [[4, 8 + bob], [3, 9 + bob], [3, 10 + bob], [2, 11 + bob]], MULA[1]);
  p.set(2, 12 + bob, PAL.org1);
  // Pescoço subindo à frente — e SEM cabeça
  for (let i = 0; i < 6; i++) {
    const x = 23 + Math.round(i * 0.6),
      y = 8 + bob - i;
    p.set(x, y, MULA[2]);
    p.set(x + 1, y, MULA[1]);
    p.set(x + 2, y, MULA[0]);
  }
  // Fogo saindo do pescoço (tremula entre quadros)
  const fl = [PAL.red1, PAL.org1, PAL.org2, PAL.yel3];
  // Labareda grande: a marca da lenda (base larga, pontas tremulando)
  for (let y = 0; y <= 4; y++)
    for (let x = 23; x <= 30; x++) {
      const cx = 26.5 + (f % 2 ? 0.5 : -0.5);
      const w = 1 + y * 0.65; // fina no alto, larga no pescoço
      if (Math.abs(x - cx) > w) continue;
      const hot = Math.abs(x - cx) < w * 0.5;
      p.set(x, y + bob, y < 2 ? PAL.yel3 : hot ? PAL.yel3 : y === 4 ? PAL.red1 : PAL.org2);
    }
  // Línguas de fogo soltas nas laterais (tremulam)
  const tips = f % 2 ? [[24, 1], [29, 2]] : [[23, 2], [30, 1]];
  for (const [x0, top] of tips) p.set(x0, top + bob, PAL.org2);
  // Crina em chamas ao longo do pescoço
  for (let i = 0; i < 5; i++) p.set(22 + Math.round(i * 0.6), 7 + bob - i, i % 2 ? PAL.org2 : PAL.red1);
  // Rachaduras da Podridão
  px(p, [[12, 9 + bob], [13, 10 + bob], [17, 8 + bob]], ROT.hot);
  p.outline(PAL.ink);
  return p;
}

// Quadros de golpe da Mula (32×28; os de galope são colados 6px abaixo):
// 4 = EMPINADA (aviso do galope e da chuva de brasas: patas da frente no ar,
//     labareda alta); 5 = COICE (traseiro no alto, cascos estendidos para trás)
const MULA_H = 28;
function mulaTall(f) {
  const p = new Pix(32, MULA_H);
  p.blit(mula(f), 0, MULA_H - 22);
  return p;
}
function mulaFlame(p, cx, top, h, f) {
  for (let y = 0; y <= h; y++)
    for (let x = cx - 5; x <= cx + 5; x++) {
      const w = 1 + y * (4.5 / h);
      const ccx = cx + (f % 2 ? 0.5 : -0.5) * (1 - y / h);
      if (Math.abs(x - ccx) > w) continue;
      const hot = Math.abs(x - ccx) < w * 0.45;
      p.set(x, top + y, y < h * 0.35 || hot ? PAL.yel3 : y === h ? PAL.red1 : PAL.org2);
    }
  p.set(cx - 3, top + 1, PAL.org2);
  p.set(cx + 3, top + 2, PAL.org2);
}
function mulaRear(f = 0) {
  const p = new Pix(32, MULA_H);
  // patas de trás firmes no chão
  for (const x0 of [8, 11]) {
    for (let y = 19; y <= 25; y++) {
      p.set(x0 + (y > 22 ? -1 : 0), y, MULA[1]);
      p.set(x0 + 1 + (y > 22 ? -1 : 0), y, MULA[0]);
    }
    p.set(x0 - 1, 26, PAL.s3);
    p.set(x0, 26, PAL.s2);
  }
  // corpo inclinado: traseiro embaixo, peito no alto
  rell(p, 14, 17, 10, 4.6, -0.6, MULA, 0.25);
  // rabo baixo, chicoteando
  px(p, [[5, 21], [4, 22], [3, 23], [3, 24]], MULA[1]);
  p.set(2, 25, PAL.org1);
  // patas da frente dobradas no ar (casco brilhando)
  for (const [x0, y0, d] of [[18, 15, 1], [21, 13, 0]]) {
    // coxa para a frente e para cima, canela pendendo, casco aceso
    const c = MULA[2 - d];
    p.line(x0, y0, x0 + 4, y0 - 3, c);
    p.line(x0, y0 + 1, x0 + 4, y0 - 2, MULA[0]);
    p.line(x0 + 5, y0 - 3, x0 + 6, y0 + 1, c);
    p.line(x0 + 6, y0 - 3, x0 + 7, y0 + 1, MULA[0]);
    p.set(x0 + 6, y0 + 2, PAL.s3);
    p.set(x0 + 7, y0 + 2, PAL.s4);
    p.set(x0 + 8, y0 + 3, PAL.yel3);
  }
  // pescoço erguido e a labareda ALTA (o golpe vem dela)
  for (let i = 0; i < 6; i++) {
    const x = 20 + Math.round(i * 0.45),
      y = 11 - i;
    p.set(x, y, MULA[2]);
    p.set(x + 1, y, MULA[1]);
    p.set(x + 2, y, MULA[0]);
  }
  mulaFlame(p, 23, 0, 6, f);
  px(p, [[12, 15], [13, 16], [16, 13]], ROT.hot);
  p.outline(PAL.ink);
  return p;
}
function mulaKick() {
  const p = new Pix(32, MULA_H);
  // patas da frente fincadas
  for (const x0 of [19, 22]) {
    for (let y = 19; y <= 25; y++) {
      p.set(x0, y, MULA[1]);
      p.set(x0 + 1, y, MULA[0]);
    }
    p.set(x0, 26, PAL.s3);
    p.set(x0 + 1, 26, PAL.s2);
  }
  // corpo inclinado para a frente: traseiro no alto
  rell(p, 16, 16, 10, 4.6, 0.38, MULA, 0.25);
  // patas de trás estendidas para trás e para cima — o coice
  for (const [y0, k] of [[13, 0], [15, 1]]) {
    for (let i = 0; i < 7; i++) {
      p.set(8 - i, y0 - Math.round(i * 0.45), MULA[2 - k]);
      p.set(8 - i, y0 + 1 - Math.round(i * 0.45), MULA[0]);
    }
    p.set(1, y0 - 3, PAL.s3);
    p.set(0, y0 - 3, PAL.s4);
  }
  // faíscas dos cascos
  px(p, [[0, 7], [2, 6], [1, 13]], PAL.yel3);
  // rabo erguido em brasa
  px(p, [[6, 9], [5, 8], [5, 7]], MULA[1]);
  p.set(4, 6, PAL.org1);
  // pescoço baixo, labareda curta para a frente
  for (let i = 0; i < 4; i++) {
    p.set(24 + i, 15 + Math.round(i * 0.3), MULA[2]);
    p.set(24 + i, 16 + Math.round(i * 0.3), MULA[0]);
  }
  mulaFlame(p, 28, 9, 6, 1);
  px(p, [[13, 15], [14, 16], [18, 14]], ROT.hot);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CORPO-SECO (26×32) — minichefe lento e resistente: figura ressecada que a
// própria terra rejeitou (lenda), curvada, costelas à mostra, trapos,
// braços longos com garras e olhos ocos com o brilho da Podridão
// ---------------------------------------------------------------------------
const SECO = [0x241e1a, 0x3e342c, 0x5a4c3e, 0x7a6a56];
function corpoSeco(f, cast = false, step = 0) {
  const p = new Pix(26, 32);
  const sw = cast ? 0 : f % 2;
  // step: cambaleio — uma perna adiante, o braço do outro lado balança (−1 / 0 / 1)
  // Pernas finas
  for (const [x0, d] of [[10, -step], [15, step]]) for (let y = 22; y <= 30; y++) {
    const o = (y > 27 && sw ? 1 : 0) + (y > 25 ? d : 0);
    p.set(x0 + o, y, SECO[1]);
    p.set(x0 + 1 + o, y, SECO[0]);
  }
  // Trapos pendurados na cintura
  for (let x = 8; x <= 18; x++) for (let y = 19; y <= 23 + ((x * 3) % 3); y++) p.set(x, y, RAG[(x + y) % 3 === 0 ? 2 : 1]);
  // Tronco magro e curvado, costelas
  ell(p, 13, 13 + sw * 0.5, 5.5, 7, SECO, 0.2);
  for (let y = 10; y <= 16; y += 2) for (let x = 10; x <= 15; x++) if (x !== 12) p.set(x, y + sw, SECO[0]);
  // Braços compridos até os joelhos, garras
  const arm = (x0, dir, swing = 0) => {
    for (let y = 9; y <= 25 - sw; y++) {
      const x = x0 + dir * Math.round((y - 9) * 0.18) + Math.round(((y - 9) / 16) * swing * 2);
      p.set(x, y, SECO[2]);
      p.set(x + dir, y, SECO[1]);
    }
    const hx = x0 + dir * 3 + swing * 2,
      hy = 26 - sw;
    px(p, [[hx, hy], [hx + dir, hy + 1], [hx - dir, hy + 1]], PAL.s4);
  };
  // Braços erguidos (A Seca, os Cipós, a volta da terra): garras acesas de Podridão
  const armUp = (x0, dir) => {
    for (let y = 10; y >= 1; y--) {
      const x = x0 + dir * Math.round((10 - y) * 0.45);
      p.set(x, y, SECO[2]);
      p.set(x + dir, y, SECO[1]);
    }
    const hx = x0 + dir * 4;
    px(p, [[hx, 0], [hx + dir, 0], [hx + dir * 2, 1], [hx - dir, 1]], PAL.s4);
    px(p, [[hx, 1], [hx + dir, 2]], ROT.glow);
  };
  if (cast) {
    armUp(7, -1);
    armUp(19, 1);
  } else {
    arm(7, -1, step);
    arm(19, 1, -step);
  }
  // Cabeça caída para a frente, cabelo ralo, olhos ocos brilhando
  ell(p, 15, 5 + sw * 0.5, 4, 4, SECO.slice(1), 0.2);
  for (let x = 11; x <= 17; x += 2) p.set(x, 1, SECO[0]);
  px(p, [[11, 2], [12, 3], [10, 4], [18, 3]], SECO[0]);
  p.set(15, 5, PAL.ink);
  p.set(17, 5, PAL.ink);
  p.set(15, 4, ROT.glow);
  p.set(17, 4, ROT.glow);
  px(p, [[15, 7], [16, 7], [17, 7]], PAL.ink); // boca seca
  // Cipós da Podridão enroscados
  px(p, [[8, 12], [9, 13], [17, 17], [18, 18], [12, 20]], ROT.hot);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// MAPINGUARI CORROMPIDO (50×56) — gigante peludo da mata (lenda amazônica):
// UM olho na testa, a BOCA NA BARRIGA, braços longos com garras. A Podridão
// o tomou (rachaduras magenta); na fase 2 as rachaduras viram brasa.
// Vencer = libertá-lo da Podridão (ver GameScene._onBossDeath).
// ---------------------------------------------------------------------------
const MAPI_FUR = [0x1e120c, 0x352014, 0x52321f, 0x74492c, 0x93603a];
// pose: null | "maw" (Bocarra: boca enorme, braços abertos) | "scream" (Grito/Olhar:
// braços erguidos, olho em brasa)
function mapinguari(f, fury, freed = false, pose = null, swing = [0, 0]) {
  const p = new Pix(50, 56);
  const sw = pose ? 0 : f === 1 ? 1 : 0; // respiração: ombros sobem 1px
  const crack = fury ? [PAL.org1, PAL.org2, PAL.yel3] : [ROT.mid, ROT.hot, ROT.glow];
  // Meia-largura do corpo por linha: ombros largos → cintura → quadril
  const half = (y) => (y < 14 ? 0 : y < 20 ? 9 + (y - 14) * 1.4 : y < 38 ? 17 - (y - 20) * 0.06 : 16 - (y - 38) * 0.45);
  // Pernas curtas e grossas + pés com garras para trás
  for (const x0 of [17, 30]) {
    for (let y = 44; y <= 52; y++) for (let x = x0; x <= x0 + 5; x++) p.set(x, y, MAPI_FUR[x === x0 ? 3 : x === x0 + 5 ? 0 : 1]);
    for (let x = x0 - 2; x <= x0 + 6; x++) p.set(x, 53, MAPI_FUR[1]);
    px(p, [[x0 - 3, 53], [x0 - 4, 53], [x0 - 3, 52]], PAL.s4); // garras viradas para trás
  }
  // Corpo peludo: fios verticais, borda desgrenhada, luz à esquerda
  for (let y = 14 - sw; y <= 47; y++) {
    const yy = y + sw;
    const w = Math.round(half(yy) + (((yy * 7) % 5) === 0 ? 1 : 0));
    for (let x = 25 - w; x <= 25 + w; x++) {
      const u = (x - (25 - w)) / (2 * w + 1);
      let k = u < 0.18 ? 4 : u < 0.45 ? 3 : u < 0.75 ? 2 : 1;
      if ((x * 3 + Math.floor(y / 2)) % 5 === 0) k = Math.max(0, k - 1); // fios
      p.set(x, y, MAPI_FUR[k]);
    }
  }
  // Franja de pelo na barra (pontas)
  for (let x = 10; x <= 40; x += 2) p.set(x, 48 + (x % 4 === 0 ? 1 : 0), MAPI_FUR[1]);
  // Braços grossos pendendo até o chão, garras grandes
  const arm = (x0, dir, lift) => {
    for (let y = 18 - sw; y <= 47 - lift; y++) {
      const x = x0 + dir * Math.round((y - 18) * 0.12);
      for (let k = 0; k < 4; k++) p.set(x + dir * k, y, MAPI_FUR[k === 0 ? (dir < 0 ? 4 : 2) : k === 3 ? 0 : 2]);
    }
    const hx = x0 + dir * 4,
      hy = 48 - lift;
    for (let k = 0; k < 4; k++) p.set(hx + dir * k, hy, MAPI_FUR[1]);
    px(p, [[hx, hy + 1], [hx + dir * 2, hy + 2], [hx + dir * 4, hy + 1], [hx + dir * 1, hy + 2]], PAL.s4);
  };
  // Braços erguidos (grito): sobem dos ombros até acima da cabeça
  const armUp = (x0, dir) => {
    for (let y = 19; y >= 3; y--) {
      const x = x0 + dir * Math.round((19 - y) * 0.28);
      for (let k = 0; k < 4; k++) p.set(x + dir * k, y, MAPI_FUR[k === 0 ? (dir < 0 ? 4 : 2) : k === 3 ? 0 : 2]);
    }
    const hx = x0 + dir * 5;
    px(p, [[hx, 1], [hx + dir, 0], [hx + dir * 2, 1], [hx + dir * 3, 0], [hx + dir * 4, 2]], PAL.s4);
  };
  if (pose === "scream") {
    armUp(8, -1);
    armUp(39, 1);
  } else if (pose === "maw") {
    arm(6, -1, 5); // abertos e erguidos: "venha"
    arm(44, 1, 5);
  } else {
    arm(8, -1, sw + swing[0]);
    arm(42, 1, 1 - sw + swing[1]);
  }
  // Cabeça afundada nos ombros, com UM olho grande na testa
  ell(p, 25, 11 - sw, 7.5, 6.5, MAPI_FUR.slice(1), 0.35);
  for (let x = 19; x <= 31; x++) p.set(x, 7 - sw, MAPI_FUR[1]); // sobrancelha pesada
  p.disc(25, 10 - sw, 3.2, PAL.ink);
  p.disc(25, 10 - sw, 2.4, freed ? PAL.g4 : fury ? PAL.red1 : PAL.yel1);
  p.disc(25, 10 - sw, 1.4, freed ? PAL.g6 : fury ? PAL.red3 : PAL.yel3);
  p.set(24, 9 - sw, PAL.white);
  if (pose === "scream") {
    // olho em brasa: miolo branco e raios
    p.disc(25, 10, 1.6, PAL.white);
    const ray = fury ? PAL.red3 : PAL.yel3;
    px(p, [[25, 4], [20, 10], [30, 10], [21, 6], [29, 6], [21, 14], [29, 14]], ray);
  }
  // BOCA NA BARRIGA (a marca da lenda): grande, aberta, gengiva e dentes
  const my = pose === "maw" ? 31 : 32,
    mrx = pose === "maw" ? 12 : pose === "scream" ? 8.5 : 9.5,
    mry = pose === "maw" ? 9.5 : pose === "scream" ? 7.5 : 6.5;
  for (let y = Math.floor(my - mry); y <= Math.ceil(my + mry); y++)
    for (let x = Math.floor(25 - mrx); x <= Math.ceil(25 + mrx); x++) {
      const dx = (x + 0.5 - 25) / mrx,
        dy = (y + 0.5 - my) / mry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      p.set(x, y, d > 0.72 ? PAL.red1 : d > 0.35 ? 0x2a0a10 : PAL.ink); // gengiva → garganta
    }
  const ty = Math.round(mry) - 1; // dentes acompanham a abertura da boca
  for (let x = 25 - Math.round(mrx) + 2; x <= 25 + Math.round(mrx) - 2; x++) {
    if (x % 2) p.set(x, my - ty, PAL.cream); // dentes de cima
    if (x % 2 === 0) p.set(x, my + ty, PAL.cream); // de baixo
  }
  const fx = Math.round(mrx) - 2;
  px(p, [[25 - fx, my - ty + 1], [25 + fx, my - ty + 1], [25 - fx + 1, my + ty - 1], [25 + fx - 1, my + ty - 1]], PAL.cream); // presas
  if (pose === "maw") {
    // garganta acesa: o ponto fraco à vista
    p.disc(25, my, 3.4, ROT.hot);
    p.disc(25, my, 2, ROT.glow);
    p.set(25, my, PAL.white);
  } else {
    p.disc(25, my + 1.5, 2.2, PAL.red2); // língua
    if (!freed) p.set(25, my - 1, crack[2]); // brilho da Podridão na garganta
  }
  // Rachaduras/cipós da Podridão (magenta; brasa na fúria)
  const cracks = [
    [12, 20], [13, 21], [13, 22], [14, 23], [14, 24],
    [37, 19], [36, 20], [36, 21], [35, 22],
    [15, 40], [16, 41], [17, 42], [34, 40], [33, 41],
    [5, 30], [45, 32], [6, 38], [44, 26],
  ];
  // Libertado: sem rachaduras (a Podridão saiu dele)
  // over(): só sobre o pelo (nos quadros de pose os braços saem do lugar)
  if (!freed) cracks.forEach(([x, y], i) => p.over(x, y - (y < 30 ? sw : 0), crack[i % 4 === 3 ? 2 : 1]));
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
  const six = [0, 1, 2, 3, 4, 5];
  strip("mon_wolf", six.map((f) => wolf(f)));
  // minichefe: Mula sem Cabeça (0-3 e 6-7 = galope de 6 tempos; 4 = empinada, 5 = coice — índices dos golpes)
  strip("mon_alpha", [...four.map((f) => mulaTall(f)), mulaRear(0), mulaKick(), mulaTall(4), mulaTall(5)]);
  strip("mon_crow", four.map((f) => crow(f)));
  strip("mon_goblin", four.map((f) => goblin(f)));
  strip("mon_mage", four.map((f) => witch(f)));
  strip("mon_brute", four.map((f) => troll(f)));
  // minichefe: Corpo-Seco (2 = braços erguidos; 3-4 = cambaleio, no FIM para não mudar o 2)
  strip("mon_elder", [corpoSeco(0), corpoSeco(1), corpoSeco(0, true), corpoSeco(0, false, 1), corpoSeco(1, false, -1)]);
  strip("mon_bee", four.map((f) => bee(f)));
  strip("mon_shroom", six.map((f) => shroom(f)));
  // 0-1 parado · 2-3 fúria · 4 libertado · 5 bocarra · 6 grito · 7 bocarra (fúria) · 8 grito (fúria)
  strip("mon_boss", [
    mapinguari(0, false), mapinguari(1, false), mapinguari(0, true), mapinguari(1, true), mapinguari(0, false, true),
    mapinguari(0, false, false, "maw"), mapinguari(0, false, false, "scream"),
    mapinguari(0, true, false, "maw"), mapinguari(0, true, false, "scream"),
    // 9-12: respiração em 4 tempos (braços sobem alternados) — parado e fúria
    mapinguari(0, false, false, null, [2, 0]), mapinguari(1, false, false, null, [0, 2]),
    mapinguari(0, true, false, null, [2, 0]), mapinguari(1, true, false, null, [0, 2]),
  ]);
  // 0 fechado · 1 entreaberto · 2 aberto · 3-6 MÍMICO mordendo (aberta, mais, escancarada, fechada)
  strip("obj_chest", [chest(0), chest(1), chest(2), chest(3), chest(4), chest(5), chest(6)]);
  strip("px_fireball", [fireball(0), fireball(1), fireball(2)]);

  anim("wolf_move", "mon_wolf", six, 14);
  anim("alpha_move", "mon_alpha", [0, 1, 2, 3, 6, 7], 13);
  anim("crow_move", "mon_crow", four, 12);
  anim("goblin_move", "mon_goblin", four, 8);
  anim("mage_move", "mon_mage", four, 5);
  anim("brute_move", "mon_brute", four, 6);
  anim("elder_move", "mon_elder", [3, 1, 4, 0], 4);
  anim("bee_move", "mon_bee", four, 24);
  anim("shroom_move", "mon_shroom", six, 9);
  anim("boss_idle", "mon_boss", [0, 9, 1, 10], 3);
  anim("boss_fury", "mon_boss", [2, 11, 3, 12], 6);
  anim("mimic_bite", "obj_chest", [3, 4, 5, 4, 3, 6], 10);
  anim("fireball_fly", "px_fireball", [0, 1, 2], 14);
}
