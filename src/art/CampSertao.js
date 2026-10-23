// Arte da CLAREIRA DA CAATINGA (skin grátis do acampamento, liberada pela conquista "Mandacaru em Flor": vencer no
// Perigo Pesadelo na Caatinga; ver docs/COSMETICOS.md e docs/CLAREIRA.md). O sertão em casa:
//   chão      terra vermelha com placas de barro rachado, terra batida clara nas trilhas
//   plantas   o juazeiro (o verde que resiste à seca) no lugar da samaúma, com a copa mexendo em onda; mandacarus
//             com a flor branca que abre à noite; coroa-de-frade; xique-xique, macambira e capim seco (EnvCaatinga)
//   feito à mão  cerca de varas, porteira de forquilha com placa e chocalho, espantalho de chapéu de couro e
//             gibão com o lenço ao vento, rede de varanda, toras secas e o pote de barro
//   açude     a margem de barro rachado, lajedos, aguapés e a carnaúba na ilhota (o formato é o do Lago)
//   bichos    calango (flexões, corrida, olhar), asas-brancas (voo de lado e no chão bicando) e o carcará planando
//             (desenhado em 8 rumos, nunca girado)
//   horizonte o céu pela hora (amanhecer, dia de mormaço, poente de fogo, noite de lua com a Via Láctea), a serra e a
//             caatinga em silhueta, a lua grande e o sol
// Pixel de arte = 3 px no mapa, como o resto da Clareira; só cores da paleta (Palette.js, bloco "Sertão") e das
// rampas do sertão da partida (EnvCaatinga.js). Registrada sob demanda: ensureCampSertao(scene).
import { PAL } from "./Palette.js";
import { Pix, rng, bayer, tileNoise, registerStrip } from "./PixelArt.js";
import { shadeBlobs } from "./Environment.js";
import { CACTUS, DRYWOOD, JUAZEIRO, STRAW, LAJEDO } from "./EnvCaatinga.js";
import { makeSky, makeRidge, makeStreak, makeCloud } from "./TitleArt.js";
import { makeCactusline, makeSun } from "./ResultArt.js";
import { pondShape, ISLE } from "./Pond.js";

const K = PAL.ink;
const TERRA = [PAL.terra0, PAL.terra1, PAL.terra2, PAL.terra3, PAL.terra4];
const BATIDA = [PAL.batida0, PAL.batida1, PAL.batida2, PAL.batida3];

// Cores das trilhas e do terreiro (paintGround, src/art/CampDecor.js)
export const SERTAO_PATH = { dirt: [PAL.terra1, PAL.batida1, PAL.batida2, PAL.batida3], fringe: PAL.batida0, stones: [LAJEDO[2], LAJEDO[3], LAJEDO[1]], grass: [STRAW[1], STRAW[2]] };

// ---------------------------------------------------------------------------
// CHÃO: terra vermelha (ladrilho de 96 sem emenda) + placas de barro rachado e manchas de terra clara (decalques)
// ---------------------------------------------------------------------------
function makeGround(seed = 23) {
  const S = 96;
  const p = new Pix(S, S);
  const n1 = tileNoise(S, S, 32, seed),
    n2 = tileNoise(S, S, 12, seed + 1),
    n3 = tileNoise(S, S, 6, seed + 2);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15 + (bayer(x, y) - 0.5) * 0.1;
      p.set(x, y, TERRA[1 + Math.max(0, Math.min(3, Math.floor((v - 0.2) * 5.4)))]);
    }
  const r = rng(seed + 9);
  // rachaduras finas e falhadas que dão a volta no ladrilho
  for (let c = 0; c < 5; c++) {
    let x = Math.floor(r() * S),
      y = Math.floor(r() * S);
    let dir = r() * Math.PI * 2;
    const len = 10 + Math.floor(r() * 14);
    for (let k = 0; k < len; k++) {
      if (k % 6 !== 5) p.set((x + S) % S, (y + S) % S, k % 3 ? PAL.terra0 : PAL.terra1);
      dir += (r() - 0.5) * 1.2;
      x += Math.round(Math.cos(dir));
      y += Math.round(Math.sin(dir));
    }
  }
  // seixos claros com sombra embaixo e grãos de areia
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * S),
      y = Math.floor(r() * S);
    if (r() < 0.55) {
      p.set(x, y, LAJEDO[3]);
      p.set(x, (y + 1) % S, PAL.terra1);
    } else p.set(x, y, PAL.batida3);
  }
  // capim seco: fios de 1–2 px
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(r() * S),
      y = Math.floor(r() * S);
    const h = 1 + Math.floor(r() * 2);
    for (let k = 0; k < h; k++) p.set(x, (y - k + S) % S, k === h - 1 ? STRAW[2] : STRAW[1]);
  }
  return p;
}

// Placa de barro rachado (o "chão rachado" da seca): células de Voronoi dentro de uma mancha de borda irregular,
// placas assadas pelo sol com a borda de cima acesa e a de baixo na sombra (a placa encurva na seca)
function makeCrackPatch(seed) {
  const r = rng(seed);
  const W = 52 + Math.floor(r() * 14),
    H = 26 + Math.floor(r() * 8);
  const p = new Pix(W, H);
  const pts = [];
  for (let i = 0; i < 16; i++) pts.push([r() * W, r() * H]);
  const nz = tileNoise(W, H, 8, seed + 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2),
        dy = (y + 0.5 - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx + dy * dy) + (nz(x, y) - 0.5) * 0.45;
      if (d > 1 || (d > 0.72 && bayer(x, y) < (d - 0.72) / 0.28)) continue;
      let d1 = 1e9,
        d2 = 1e9,
        best = null;
      for (const q of pts) {
        // distância esticada na horizontal (o chão é visto de cima, meio de lado)
        const e = Math.hypot(x + 0.5 - q[0], (y + 0.5 - q[1]) * 1.6);
        if (e < d1) {
          d2 = d1;
          d1 = e;
          best = q;
        } else if (e < d2) d2 = e;
      }
      const edge = d2 - d1;
      let c = (x * 3 + y * 7) % 11 === 0 ? PAL.terra4 : PAL.terra3;
      if (edge < 1.1) c = PAL.terra0;
      else if (edge < 2.4) c = y + 0.5 < best[1] ? PAL.batida1 : PAL.terra2; // borda encurvada: acesa em cima
      p.set(x, y, c);
    }
  return p;
}

// Mancha de terra clara batida pelo vento (areia fina por cima da terra vermelha)
function makeSandPatch(seed) {
  const r = rng(seed);
  const W = 40 + Math.floor(r() * 20),
    H = 18 + Math.floor(r() * 8);
  const p = new Pix(W, H);
  const nz = tileNoise(W, H, 6, seed + 5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2),
        dy = (y + 0.5 - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx + dy * dy) + (nz(x, y) - 0.5) * 0.6;
      if (d > 1 || (d > 0.55 && bayer(x, y) < (d - 0.55) / 0.45)) continue;
      // ondinhas de areia (o vento penteia de oeste para leste)
      const ripple = Math.sin(x * 0.9 + y * 2.3 + nz(x, y) * 4) > 0.7;
      p.set(x, y, ripple ? PAL.batida3 : (x + y) % 5 === 0 ? PAL.batida1 : PAL.batida2);
    }
  return p;
}

// ---------------------------------------------------------------------------
// JUAZEIRO: o marco da Clareira do sertão (verde o ano inteiro). Tronco curto e grosso, cinzento, que abre em três
// galhos; copa larga e baixa de verde escuro brilhante, com juás amarelos. 8 quadros de vento: os cachos da copa
// mexem em ONDA, de oeste para leste (o tronco fica parado)
// ---------------------------------------------------------------------------
const JUA_W = 104,
  JUA_H = 100;
const JBARK = [PAL.n0, PAL.n1, DRYWOOD[0], DRYWOOD[1], DRYWOOD[2]]; // casca escura do juazeiro (escuro → claro)
// Copa: muitos cachos pequenos dentro de um domo largo e baixo (borda recortada pelo ruído), de trás para a frente
function juazeiroBlobs() {
  const r = rng(4242);
  const blobs = [];
  const ecx = 52,
    ecy = 31,
    erx = 47,
    ery = 25;
  for (let gy = 8; gy <= 52; gy += 5)
    for (let gx = 4; gx <= 100; gx += 7) {
      const x = gx + (Math.floor(gy / 5) % 2 ? 3.5 : 0) + (r() - 0.5) * 3,
        y = gy + (r() - 0.5) * 3;
      const dx = (x - ecx) / erx,
        dy = (y - ecy) / (y > ecy ? ery * 0.85 : ery);
      if (dx * dx + dy * dy > 1 + (r() - 0.5) * 0.25) continue;
      blobs.push({ cx: x, cy: y, rx: 6.2 + r() * 2.2, ry: 5 + r() * 1.6 });
    }
  blobs.sort((a, b) => a.cy - b.cy);
  return blobs;
}
function makeJuazeiro(f) {
  const p = new Pix(JUA_W, JUA_H);
  const cx = 52;
  const r = rng(77);
  // raízes rasas abrindo no chão
  for (const [dir, reach, h] of [[-1, 15, 8], [1, 17, 7], [-1, 7, 10], [1, 6, 9]]) {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const x0 = cx + dir * (5 + t * t * reach);
      const top = JUA_H - 3 - h + y;
      for (let x = Math.floor(x0 - 1.5 - t); x <= x0 + 1.5 + t; x++) p.set(x, top, x < x0 ? JBARK[3] : JBARK[1]);
    }
  }
  // tronco curto, grosso e torto (luz da esquerda), com fendas
  for (let y = 58; y < JUA_H - 4; y++) {
    const lean = Math.round(Math.sin((y - 58) * 0.11) * 2);
    const half = 5.5 + Math.max(0, (y - 84) / 3);
    for (let x = Math.floor(cx + lean - half); x <= cx + lean + half; x++) {
      const u = (x - (cx + lean - half)) / (2 * half);
      let c = u < 0.18 ? JBARK[4] : u < 0.45 ? JBARK[3] : u < 0.8 ? JBARK[2] : JBARK[1];
      if ((x * 5 + y * 3) % 13 === 0 && u > 0.2) c = JBARK[0]; // fendas da casca
      p.set(x, y, c);
    }
  }
  // galhos grossos que sobem para a copa (abertos em leque, tortos)
  for (const [x1, y1, w] of [[cx - 34, 38, 4], [cx - 12, 30, 3], [cx + 8, 30, 3], [cx + 32, 36, 4]]) {
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = cx + (x1 - cx) * t + Math.sin(t * 3.4 + x1) * 2,
        y = 60 + (y1 - 60) * t;
      const ww = w * (1 - t * 0.5);
      for (let k = -ww / 2; k <= ww / 2; k++) p.set(Math.round(x + k), Math.round(y), k < 0 ? JBARK[3] : JBARK[1]);
    }
  }
  // copa: cada cacho se desloca pela onda do vento (o de fora mexe mais; a onda corre da esquerda para a direita)
  const ph = (f / 8) * Math.PI * 2;
  const blobs = juazeiroBlobs().map((b) => {
    const outer = Math.min(1, Math.hypot((b.cx - 52) / 47, (b.cy - 31) / 25));
    const w = Math.sin(ph - b.cx * 0.075);
    return { ...b, cx: b.cx + Math.round(w * outer * 1.2), cy: b.cy + Math.round(Math.sin(ph - b.cx * 0.075 - 1) * 0.6 * outer * outer) };
  });
  const owner = shadeBlobs(p, blobs, JUAZEIRO, rng(91), 0.3);
  // vãos escuros entre os cachos, brilho de folha nova do lado do sol e a sombra fria na barra de baixo
  for (let y = 1; y < JUA_H - 1; y++)
    for (let x = 1; x < JUA_W - 1; x++) {
      const o = owner[y * JUA_W + x];
      if (o < 0) continue;
      const c = p.rgb(x, y);
      if (c === JUAZEIRO[4] && (x * 7 + y * 3 + f * 2) % 13 === 0) p.set(x, y, PAL.g6);
      if (owner[(y + 1) * JUA_W + x] < 0 && y > 30 && (x + y) % 2 === 0) p.set(x, y, PAL.t0);
    }
  // juás (frutinhas amarelas) no meio das folhas
  for (let i = 0; i < 34; i++) {
    const x = 6 + Math.floor(r() * (JUA_W - 12)),
      y = 8 + Math.floor(r() * 44);
    if (owner[y * JUA_W + x] < 0 || p.rgb(x, y) === JUAZEIRO[0] || p.rgb(x, y) === PAL.t0) continue;
    p.set(x, y, r() < 0.5 ? PAL.yel2 : PAL.yel1);
  }
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// MANDACARU com a flor: base lenhosa (o tronco velho fica cinzento), colunas com costelas e espinhos, braços em
// L que sobem. Devolve o desenho e as pontas (onde a flor nasce, em px de arte)
// ---------------------------------------------------------------------------
function mandacaru(seed, W, H, arms) {
  const r = rng(seed);
  const p = new Pix(W, H);
  const tips = [];
  const col = (cx, top, bot, half) => {
    for (let y = top; y <= bot; y++)
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const u = (x - (cx - half)) / (2 * half || 1);
        let t = 1.02 - u * 1.05 + (bayer(x, y) - 0.5) * 0.16;
        if ((x - Math.round(cx - half)) % 3 === 2) t -= 0.28; // costelas
        if (y < top + 2) t += 0.12;
        p.set(x, y, CACTUS[Math.max(0, Math.min(4, Math.floor(t * 4.3)))]);
      }
    // ponta arredondada
    p.set(Math.round(cx - half), top, 0);
    p.set(Math.round(cx + half), top, 0);
    tips.push({ x: Math.round(cx), y: top });
  };
  const cx = Math.round(W / 2);
  const woody = Math.round(H * 0.16);
  col(cx, 3, H - woody, 3.6);
  // braços (alternando os lados, de baixo para cima)
  for (const [side, at, out, up] of arms) {
    const y0 = Math.round(H * at),
      ax = cx + side * out;
    for (let x = cx; side > 0 ? x <= ax : x >= ax; x += side) for (let y = y0; y <= y0 + 4; y++) if (!p.get(x, y)) p.set(x, y, CACTUS[side > 0 ? 1 : 3]);
    col(ax, Math.round(H * up), y0 + 4, 2.6);
  }
  // base lenhosa: casca cinzenta de mandacaru velho
  for (let y = H - woody; y < H; y++)
    for (let x = cx - 4; x <= cx + 4; x++) {
      const u = (x - (cx - 4)) / 8;
      p.set(x, y, u < 0.25 ? DRYWOOD[3] : u < 0.6 ? DRYWOOD[2] : DRYWOOD[1]);
      if ((x + y * 2) % 7 === 0) p.set(x, y, DRYWOOD[0]);
    }
  // espinhos: pontinhos claros na borda (os dois lados)
  for (let y = 4; y < H - woody; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!p.get(x, y) || (x * 5 + y * 3) % 4) continue;
      if (!p.get(x - 1, y)) p.set(x - 1, y, PAL.cream);
      else if (!p.get(x + 1, y) && r() < 0.6) p.set(x + 1, y, PAL.cream);
    }
  p.outline(K);
  return { p, tips };
}
// mandacarus da Clareira: [semente, largura, altura, braços [lado, onde sai (fração da altura), quanto sai, topo]]
const MANDACARUS = [
  [911, 40, 78, [[-1, 0.5, 10, 0.2], [1, 0.42, 11, 0.14], [1, 0.68, 7, 0.46]]],
  [917, 32, 60, [[1, 0.48, 9, 0.18], [-1, 0.62, 8, 0.36]]],
  [923, 26, 46, [[-1, 0.52, 8, 0.24]]],
];
export const MANDACARU_TIPS = [];

// Flor do mandacaru (abre à noite e fecha de manhã). 7 quadros: 0 botão fechado (escamas verdes com a ponta
// vermelha), 1 botão inchado com a ponta branca, 2 as pétalas se soltando, 3 meio aberta (taça), 4 aberta (estrela
// branca de miolo creme e estames amarelos), 5 e 6 aberta respirando (as pontas das pétalas mexem)
function makeFlower(f) {
  const p = new Pix(13, 14);
  const cx = 6;
  // tubo do botão (escamas)
  const tube = f === 0 ? 4 : f === 1 ? 5 : 4;
  for (let y = 0; y < tube; y++) {
    const yy = 13 - y;
    p.set(cx - 1, yy, CACTUS[2]);
    p.set(cx, yy, y % 2 ? CACTUS[3] : CACTUS[2]);
    p.set(cx + 1, yy, CACTUS[1]);
    if (y % 2 === 0) p.set(cx + (y % 4 ? 1 : -1), yy, PAL.red1); // escama de ponta avermelhada
  }
  const top = 13 - tube;
  if (f === 0) {
    p.set(cx, top, PAL.red1);
    p.set(cx, top - 1, PAL.red2);
    return p.outline(K);
  }
  if (f === 1) {
    for (let y = top - 3; y <= top; y++) {
      p.set(cx, y, y === top - 3 ? PAL.cream : PAL.white);
      if (y > top - 3) p.set(cx - 1, y, PAL.cream);
    }
    p.set(cx + 1, top, PAL.s4);
    return p.outline(K);
  }
  // pétalas: leque de raios a partir do topo do tubo; abertura cresce com o quadro
  const open = f === 2 ? 0.35 : f === 3 ? 0.7 : 1;
  const breathe = f === 5 ? 1 : f === 6 ? -1 : 0;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * (0.35 + open * 0.95);
    const len = 3 + open * 3 + ((i + breathe + 7) % 3 === 0 ? 0.6 : 0);
    for (let k = 1; k <= len; k++) {
      const x = Math.round(cx + Math.cos(a) * k * (1 + open * 0.2)),
        y = Math.round(top - 1 + Math.sin(a) * k * (0.75 + 0.25 * (1 - open)));
      p.set(x, y, k > len - 1.2 ? PAL.white : k < 2 ? PAL.cream : PAL.white);
    }
  }
  // miolo e estames
  p.set(cx, top - 1, PAL.cream);
  if (open >= 0.7) {
    p.set(cx, top - 2, PAL.yel3);
    p.set(cx - 1, top - 2, PAL.yel2);
    p.set(cx + 1, top - 2, PAL.yel2);
    if (open >= 1) p.set(cx, top - 3, PAL.yel3);
  }
  return p.outline(K);
}
export const FLOWER_OPEN = [0, 1, 2, 3, 4]; // abrindo (fechar = de trás para a frente)
export const FLOWER_BREATH = [4, 5, 4, 6]; // aberta, à noite

// Coroa-de-frade: cacto redondo de gomos, espinhos claros e o "chapéu" vermelho de lã no alto, com frutinhas rosa
function makeFrade(seed) {
  const r = rng(seed);
  const p = new Pix(15, 14);
  p.ellipse(7.5, 9, 6.6, 4.8, CACTUS[2]);
  for (let y = 4; y < 14; y++)
    for (let x = 0; x < 15; x++) {
      if (!p.get(x, y)) continue;
      const u = x / 14;
      let t = 0.95 - u * 0.9 + (y < 7 ? 0.15 : 0);
      if (x % 3 === 1) t -= 0.25; // gomos
      p.set(x, y, CACTUS[Math.max(0, Math.min(4, Math.floor(t * 4.2)))]);
      if (x % 3 === 1 && y % 2 === 0 && r() < 0.7) p.set(x, y, PAL.cream); // espinhos
    }
  // cefálio: lã creme com as cerdas vermelhas por cima
  p.ellipse(7.5, 4.6, 4, 2.2, PAL.cream);
  for (let x = 4; x <= 11; x++) {
    p.set(x, 3 + ((x * 3) % 2), PAL.red2);
    if (x % 2) p.set(x, 4, PAL.red1);
  }
  p.set(6, 2, PAL.pink);
  p.set(9, 2, PAL.pink);
  return p.outline(K);
}

// Folha seca rolando no vento (4 quadros: de frente, virando, de lado, o verso), palha e barro, nervura escura
export const FOLHA_ROLA = [0, 1, 2, 3];
function makeDryLeaf(f, tone) {
  const p = new Pix(9, 9);
  const w = [1, 0.55, 0.12, 0.55][f];
  const back = f === 3;
  const L = tone ? (back ? [PAL.n3, PAL.n4, PAL.n2] : [PAL.straw3, PAL.straw2, PAL.n3]) : back ? [PAL.straw1, PAL.straw2, PAL.straw0] : [PAL.clay3, PAL.clay2, PAL.clay1];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const cx = 1.5 + t * 6,
      cy = 7.5 - t * 6;
    const half = Math.sin(t * Math.PI) * 2.6 * w;
    for (let k = -3; k <= 3; k++) {
      const off = k * 0.5;
      if (Math.abs(off) > half + 0.2) continue;
      // a borda da folha seca é recortada (comida pelo sol): falta um pixel aqui e ali
      if (Math.abs(off) > half - 0.4 && (i + k) % 4 === 0) continue;
      const x = Math.round(cx - off * 0.7),
        y = Math.round(cy - off * 0.7);
      p.set(x, y, Math.abs(off) < 0.3 ? L[2] : off < 0 ? L[0] : L[1]);
    }
  }
  p.set(0, 8, PAL.n2);
  p.set(1, 8, PAL.n2);
  return p.outline(PAL.n1);
}

// ---------------------------------------------------------------------------
// HORTA DO SERTÃO: cerca de varas (ladrilho de 40, período 40), o mourão de forquilha das laterais, a porteira de
// forquilha com a travessa, a placa do broto e o chocalho (peças à parte, balançam no vento) e o canteiro fechado
// de mato seco
// ---------------------------------------------------------------------------
function makeFence(w) {
  const p = new Pix(w, 14);
  const r = rng(w * 7 + 3);
  // duas travessas de vara roliça
  for (const y of [4, 9]) {
    for (let x = 0; x < w; x++) {
      p.set(x, y, (x * 3) % 7 === 0 ? DRYWOOD[3] : DRYWOOD[2]);
      p.set(x, y + 1, DRYWOOD[1]);
    }
  }
  // varas em pé (uma a cada 5 px), de alturas e tortezas diferentes: a cerca feita com o que o mato dá
  for (let x0 = 2; x0 < w - 1; x0 += 5) {
    const top = Math.floor(r() * 3);
    const bend = r() < 0.4 ? (r() < 0.5 ? -1 : 1) : 0;
    const bendAt = 3 + Math.floor(r() * 4);
    const brown = r() < 0.3;
    for (let y = top; y < 14; y++) {
      const x = x0 + (y < bendAt ? bend : 0);
      const lit = brown ? PAL.n4 : DRYWOOD[3],
        mid = brown ? PAL.n3 : DRYWOOD[2],
        dark = brown ? PAL.n2 : DRYWOOD[1];
      p.set(x, y, y === top ? lit : mid);
      if (x + 1 < w) p.set(x + 1, y, dark);
    }
    // amarração de arame onde a vara cruza a travessa
    if (r() < 0.75) p.set(x0 + 1, 4, PAL.s3);
    if (r() < 0.75) p.set(x0 + 1, 9, PAL.s3);
  }
  // capim seco no pé
  for (let x = 1; x < w; x += 3 + Math.floor(r() * 3)) {
    p.set(x, 13, STRAW[1]);
    if (r() < 0.5) p.set(x, 12, STRAW[2]);
  }
  return p.outline(K);
}
function makeForkPost() {
  const p = new Pix(7, 14);
  for (let y = 4; y < 14; y++) {
    p.set(2, y, DRYWOOD[3]);
    p.set(3, y, DRYWOOD[2]);
    p.set(4, y, DRYWOOD[1]);
  }
  // forquilha
  p.set(1, 3, DRYWOOD[3]);
  p.set(1, 2, DRYWOOD[3]);
  p.set(0, 1, DRYWOOD[2]);
  p.set(5, 3, DRYWOOD[2]);
  p.set(5, 2, DRYWOOD[1]);
  p.set(6, 1, DRYWOOD[1]);
  p.set(3, 6, DRYWOOD[0]);
  return p.outline(K);
}
// Porteira: dois mourões de forquilha com a travessa deitada nas forquilhas; a placa pendura no meio e o chocalho
// na ponta direita (posições em px de arte da porteira)
export const ARCH_SERTAO = { w: 36, h: 44, signY: 9, bell: { x: 30, y: 9 } };
function makeArch() {
  const { w: W, h: H } = ARCH_SERTAO;
  const p = new Pix(W, H);
  for (const x0 of [3, 28]) {
    for (let y = 6; y < H - 1; y++) {
      p.set(x0, y, DRYWOOD[3]);
      p.set(x0 + 1, y, DRYWOOD[2]);
      p.set(x0 + 2, y, DRYWOOD[2]);
      p.set(x0 + 3, y, DRYWOOD[1]);
      if ((y * 5 + x0) % 11 === 0) p.set(x0 + 2, y, DRYWOOD[0]); // nó
    }
    // forquilha (os dois dentes seguram a travessa)
    for (let y = 0; y < 6; y++) {
      p.set(x0 - (y < 3 ? 1 : 0), y, DRYWOOD[3]);
      p.set(x0 + 4 + (y < 3 ? 1 : 0), y, DRYWOOD[1]);
    }
    for (let x = x0 - 1; x <= x0 + 5; x++) {
      p.set(x, H - 1, DRYWOOD[1]);
      if (bayer(x, H - 2) < 0.5) p.set(x, H - 2, STRAW[1]);
    }
  }
  // travessa: tronco roliço com as pontas cortadas (anéis)
  for (let x = 0; x < W; x++) {
    p.set(x, 3, DRYWOOD[3]);
    p.set(x, 4, x % 6 === 2 ? DRYWOOD[1] : DRYWOOD[2]);
    p.set(x, 5, DRYWOOD[2]);
    p.set(x, 6, DRYWOOD[1]);
  }
  for (const x of [0, W - 1]) {
    p.set(x, 4, PAL.n4);
    p.set(x, 5, PAL.n3);
  }
  // amarras de couro onde a travessa deita nas forquilhas
  for (const x of [3, 7, 28, 32]) p.set(x, 5, PAL.n2);
  return p.outline(K);
}
function makeSign() {
  const p = new Pix(14, 13);
  for (let y = 0; y < 3; y++) {
    p.set(3, y, STRAW[1]);
    p.set(10, y, STRAW[1]);
  }
  for (let y = 3; y < 12; y++)
    for (let x = 1; x < 13; x++) {
      let c = y === 3 ? DRYWOOD[3] : y === 11 ? DRYWOOD[1] : DRYWOOD[2];
      if (x === 1) c = DRYWOOD[3];
      if (x === 12) c = DRYWOOD[1];
      if ((x * 3 + y) % 9 === 0 && y > 3 && y < 11) c = DRYWOOD[1]; // veio da tábua
      p.set(x, y, c);
    }
  // broto pintado
  p.rect(5, 10, 4, 1, PAL.terra1);
  p.rect(6, 7, 2, 3, PAL.g4);
  p.set(5, 6, PAL.g5);
  p.set(4, 5, PAL.g6);
  p.set(8, 6, PAL.g4);
  p.set(9, 5, PAL.g5);
  return p.outline(K);
}
// Chocalho de bode: sininho de lata com o badalo (o desenho balança inteiro; o som fica na imaginação)
function makeBell() {
  const p = new Pix(5, 8);
  p.set(2, 0, PAL.n2);
  p.set(2, 1, PAL.n2);
  p.rect(1, 2, 3, 1, PAL.s3);
  p.rect(0, 3, 5, 3, PAL.s2);
  p.set(0, 3, PAL.s4);
  p.set(1, 3, PAL.s3);
  p.rect(0, 6, 5, 1, PAL.s1);
  p.set(2, 7, PAL.s0); // badalo
  return p.outline(K);
}
function makeLockedPlot() {
  const p = new Pix(24, 22);
  const r = rng(131);
  p.ellipse(12, 15, 11.5, 5.5, PAL.terra1);
  for (let y = 9; y < 22; y++) for (let x = 0; x < 24; x++) if (p.get(x, y) && bayer(x, y) < 0.35) p.set(x, y, PAL.terra0);
  // pedra (lajedo) e um pedaço de xique-xique
  p.ellipse(17, 16, 3.4, 2.4, LAJEDO[2]);
  p.set(16, 15, LAJEDO[3]);
  p.set(15, 16, LAJEDO[3]);
  for (let k = 0; k < 6; k++) {
    p.set(5 + (k > 2 ? 1 : 0), 15 - k, CACTUS[k % 2 ? 2 : 3]);
    p.set(6 + (k > 2 ? 1 : 0), 15 - k, CACTUS[1]);
  }
  p.set(4, 12, PAL.cream);
  p.set(8, 11, PAL.cream);
  // capim seco desgrenhado, curvando com o vento
  for (let k = 0; k < 16; k++) {
    let x = 1 + Math.floor(r() * 22);
    const base = 13 + Math.floor(r() * 7),
      h = 4 + Math.floor(r() * 6);
    for (let j = 0; j < h; j++) {
      if (j > h * 0.55 && j % 2 === 0) x += 1;
      p.set(x, base - j, j > h - 2 ? STRAW[3] : j < 2 ? STRAW[0] : STRAW[1 + (j % 2)]);
    }
  }
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// ESPANTALHO SERTANEJO (28×42, 6 quadros de vento): chapéu de couro de aba virada com estrelinhas estampadas e o
// barbicacho, cabeça de saco cosida, gibão de couro com pesponto e franja, lenço vermelho no pescoço com a ponta
// ao vento, mãos de palha e uma cabaça pendurada no braço esquerdo. O vento corre em onda pelo lenço, pela franja
// e pela cabaça
// ---------------------------------------------------------------------------
export const SCARECROW_SERTAO = { w: 28, h: 42 };
function makeScarecrow(f) {
  const { w: W, h: H } = SCARECROW_SERTAO;
  const p = new Pix(W, H);
  const ph = (f / 6) * Math.PI * 2;
  const wave = (x, a) => Math.round(Math.sin(x * 0.6 - ph) * a);
  const cx = 14;
  // estaca e o braço
  for (let y = 18; y < H - 1; y++) {
    p.set(cx - 1, y, DRYWOOD[3]);
    p.set(cx, y, DRYWOOD[2]);
  }
  for (let x = cx - 3; x <= cx + 2; x++) {
    p.set(x, H - 1, DRYWOOD[1]);
    if (bayer(x, H - 2) < 0.5 && (x < cx - 1 || x > cx)) p.set(x, H - 2, STRAW[1]);
  }
  for (let x = 2; x <= 25; x++) {
    p.set(x, 19, DRYWOOD[3]);
    p.set(x, 20, DRYWOOD[1]);
  }
  // gibão: do ombro (y 17) à barra (y 28); couro escuro com a gola em V clara e dois pespontos no peito
  const top = 17,
    hem = 28;
  const halfAt = (y) => 4 + Math.round((y - top) * 0.3);
  for (let y = top; y <= hem; y++) {
    const half = halfAt(y);
    for (let x = cx - half; x <= cx - 1 + half; x++) {
      let c = x < cx - half + 2 ? PAL.n3 : x > cx + half - 3 ? PAL.n1 : PAL.n2;
      if (y === top) c = PAL.n3;
      if ((x === cx - 1 || x === cx) && y > top + 2) c = PAL.n0; // abertura
      if (y - top <= 2 && Math.abs(x - (cx - 0.5)) <= 2.5 - (y - top)) c = PAL.clay3; // gola em V
      if (y === top + 5 && (x === cx - 3 || x === cx + 2)) c = PAL.straw3; // pesponto
      if (y === top + 7 && (x === cx - 3 || x === cx + 2)) c = PAL.straw3;
      if (y === hem) c = PAL.n1;
      p.set(x, y, c);
    }
  }
  // franja de couro na barra (a onda corre da esquerda para a direita)
  const fh = halfAt(hem);
  for (let x = cx - fh; x <= cx - 1 + fh; x += 2) {
    p.set(x + wave(x, 0.6), hem + 1, PAL.n2);
    p.set(x + wave(x, 1.2), hem + 2, PAL.n1);
  }
  // mangas no braço e mãos de palha
  for (const side of [-1, 1]) {
    const inner = side < 0 ? cx - halfAt(19) - 1 : cx + halfAt(19);
    const cuff = side < 0 ? 4 : 23;
    for (let x = Math.min(inner, cuff); x <= Math.max(inner, cuff); x++) {
      p.set(x, 19, PAL.clay2);
      p.set(x, 20, PAL.clay1);
    }
    p.set(cuff, 19, PAL.n1);
    p.set(cuff, 20, PAL.n1);
    const d = wave(cuff, 0.9);
    p.set(cuff + side, 19, STRAW[3]);
    p.set(cuff + side * 2, 20 + (d > 0 ? 1 : 0), STRAW[2]);
    p.set(cuff + side, 21, STRAW[3]);
  }
  // cabaça pendurada no braço esquerdo, balançando
  const gx = 6 + Math.round(Math.sin(ph - 0.6) * 1.4);
  p.set(6, 21, STRAW[0]);
  p.set(6 + (gx > 6 ? 1 : gx < 6 ? -1 : 0), 22, STRAW[0]);
  p.ellipse(gx + 0.5, 24.5, 1.3, 1, STRAW[2]);
  p.ellipse(gx + 0.5, 27, 2, 1.8, STRAW[2]);
  p.set(gx - 1, 26, STRAW[3]);
  p.set(gx + 1, 28, STRAW[1]);
  // cabeça de saco: trama, olhos em X cosidos e sorriso ponto a ponto
  p.disc(cx, 12.5, 4.2, PAL.straw3);
  for (let y = 8; y <= 17; y++)
    for (let x = cx - 5; x <= cx + 5; x++) {
      if (p.alpha(x, y) === 0 || y > 16) continue;
      if (x > cx + 1 && y > 12) p.set(x, y, PAL.straw2);
      else if (bayer(x, y) < 0.12) p.set(x, y, PAL.straw2);
    }
  for (const [x, y] of [[cx - 3, 11], [cx - 2, 12], [cx - 2, 11], [cx - 3, 12], [cx + 1, 11], [cx + 2, 12], [cx + 2, 11], [cx + 1, 12]]) if ((x + y) % 2 === 0) p.set(x, y, K);
  for (const [x, y] of [[cx - 3, 14], [cx - 1, 15], [cx + 1, 15], [cx + 2, 14]]) p.set(x, y, K);
  // lenço vermelho amarrado no pescoço, com a ponta voando para leste (onda)
  for (let x = cx - 3; x <= cx + 2; x++) p.set(x, 16, x % 2 ? PAL.red2 : PAL.red1);
  p.set(cx - 1, 17, PAL.red1);
  p.set(cx, 17, PAL.red2);
  for (let k = 1; k <= 4; k++) {
    const y = 16 + Math.round(k * 0.3) + Math.round(Math.sin(ph - k * 0.8) * (0.3 + k * 0.4));
    p.set(cx + 2 + k, y, k === 4 ? PAL.red1 : PAL.red2);
    if (k < 3) p.set(cx + 2 + k, y + 1, PAL.red1);
  }
  // chapéu de couro: copa em cúpula, aba larga dos lados e a aba da frente VIRADA para cima em meia-lua (mais clara,
  // com a borda costurada e uma estrela no meio); barbicacho no queixo
  for (let y = 0; y <= 7; y++) {
    const half = y === 0 ? 2 : y === 1 ? 3 : 4;
    for (let x = cx - half; x < cx + half; x++) p.set(x, y, x < cx - half + 2 ? PAL.n3 : x > cx + half - 2 ? PAL.n1 : PAL.n2);
  }
  for (let x = cx - 10; x < cx + 10; x++) {
    p.set(x, 8, x < cx - 6 ? PAL.n3 : PAL.n2); // aba dos lados
    p.set(x, 9, PAL.n1);
  }
  p.set(cx - 10, 7, PAL.n3); // as pontas da aba sobem um pouco
  p.set(cx + 9, 7, PAL.n2);
  for (let x = cx - 6; x < cx + 6; x++) {
    const d = (x + 0.5 - cx) / 6;
    const yT = Math.round(8 - (1 - d * d) * 3.4); // borda da meia-lua: sobe no meio
    for (let y = yT; y <= 8; y++) p.set(x, y, y === yT ? PAL.n1 : y === yT + 1 ? PAL.clay3 : PAL.n4);
  }
  p.set(cx, 6, PAL.yel3); // estrela estampada
  p.set(cx - 1, 6, PAL.yel2);
  p.set(cx, 7, PAL.yel2);
  p.set(cx - 1, 7, PAL.yel3);
  p.set(cx - 4, 7, PAL.straw3);
  p.set(cx + 3, 7, PAL.straw3);
  p.set(cx - 5, 15, PAL.n1); // barbicacho
  p.set(cx + 4, 15, PAL.n1);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// TERREIRO: rede de varanda (6 quadros: balança e a franja vai atrás), toras secas e o pote de barro
// ---------------------------------------------------------------------------
function makeHammock(f) {
  const p = new Pix(48, 32);
  const ph = (f / 6) * Math.PI * 2;
  // esteios de aroeira (forquilha no alto)
  for (const x of [2, 44]) {
    for (let y = 3; y < 32; y++) {
      p.set(x, y, DRYWOOD[3]);
      p.set(x + 1, y, DRYWOOD[1]);
    }
    p.set(x - 1, 1, DRYWOOD[3]);
    p.set(x - 1, 2, DRYWOOD[3]);
    p.set(x + 2, 1, DRYWOOD[1]);
    p.set(x + 2, 2, DRYWOOD[1]);
  }
  const sway = Math.sin(ph) * 1.6;
  const lag = Math.sin(ph - 0.9) * 2.2;
  p.line(4, 6, 10 + Math.round(sway * 0.3), 12, STRAW[3]);
  p.line(43, 6, 37 + Math.round(sway * 0.3), 12, STRAW[3]);
  const stripes = [PAL.red2, PAL.org2, PAL.yel2, PAL.cream, PAL.red1, PAL.yel3];
  for (let x = 10; x <= 37; x++) {
    const t = (x - 10) / 27;
    const sag = Math.sin(t * Math.PI) * 7;
    const dx = Math.round(sway * Math.sin(t * Math.PI));
    const top = Math.round(11 + sag),
      bot = Math.round(16 + sag * 1.15);
    for (let y = top; y <= bot; y++) p.set(x + dx, y, y === top ? PAL.white : stripes[Math.floor((x - 10) / 3) % stripes.length]);
    // varanda: franja comprida em croché, que balança atrasada
    if ((x - 10) % 2 === 0) {
      const len = 4 + ((x * 7) % 3);
      for (let k = 1; k <= len; k++) p.set(x + dx + Math.round(lag * (k / len) * Math.sin(t * Math.PI)), bot + k, k === len ? PAL.red1 : (x / 2) % 2 ? PAL.cream : PAL.yel2);
    }
  }
  return p.outline(K);
}
function makeLog() {
  const p = new Pix(28, 10);
  for (let x = 3; x < 25; x++)
    for (let y = 2; y < 9; y++) {
      let c = y < 4 ? DRYWOOD[3] : y > 6 ? DRYWOOD[1] : DRYWOOD[2];
      if ((x * 5 + y * 2) % 11 === 0) c = DRYWOOD[1];
      if (y === 5 && x > 8 && x < 16) c = DRYWOOD[0]; // racha da madeira seca
      p.set(x, y, c);
    }
  p.ellipse(3.5, 5.5, 2.6, 3.4, PAL.n4);
  p.ellipse(3.5, 5.5, 1.4, 2, PAL.n3);
  p.set(3, 5, PAL.n2);
  p.set(18, 1, STRAW[2]); // fiapo de capim
  p.set(19, 1, STRAW[3]);
  return p.outline(K);
}
// Pote de barro na forquilha (a água fresca de quem chega), com a tampa de madeira e o caneco pendurado
function makePote() {
  const p = new Pix(17, 24);
  // forquilha de três paus
  for (let y = 8; y < 24; y++) {
    p.set(3 + Math.round((y - 8) * -0.12), y, DRYWOOD[3]);
    p.set(13 + Math.round((y - 8) * 0.12), y, DRYWOOD[1]);
    p.set(8, y, DRYWOOD[2]);
  }
  // pote: barro vermelho, bojo largo, boca estreita
  p.ellipse(8.5, 9, 6.2, 5.6, PAL.clay2);
  for (let y = 3; y < 15; y++)
    for (let x = 1; x < 16; x++) {
      if (!p.get(x, y) || p.rgb(x, y) !== PAL.clay2) continue;
      const u = (x - 2.3) / 12.4;
      p.set(x, y, u < 0.28 ? PAL.clay3 : u > 0.72 ? PAL.clay1 : PAL.clay2);
    }
  for (let x = 5; x <= 11; x++) p.set(x, 7, PAL.clay0); // friso
  p.rect(6, 2, 5, 2, PAL.clay1);
  p.rect(5, 1, 7, 1, PAL.n3); // tampa
  p.set(8, 0, PAL.n2);
  p.set(4, 5, PAL.cream); // brilho úmido
  // caneco de alumínio pendurado
  p.rect(13, 10, 3, 3, PAL.s3);
  p.set(13, 10, PAL.s4);
  p.set(16, 11, PAL.s2);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// BICHOS
// ---------------------------------------------------------------------------
// Calango (de lado, cabeça à esquerda; 22×11). Pardo com pintas claras no dorso, a coleira escura do
// calango-de-lajedo, cabeça avermelhada, barriga creme, patas de cotovelo dobrado e o rabo comprido. Quadros:
// 0 parado (peito erguido), 1 respirando (barriga cheia), 2 flexão embaixo (peito no chão), 3 flexão em cima (patas
// da frente esticadas, cabeça alta), 4-7 corrida (corpo rente, patas alternadas, rabo em onda), 8 olhando para trás
export const CALANGO = { idle: [0, 1], push: [2, 3], run: [4, 5, 6, 7], look: 8 };
function makeCalango(f) {
  const p = new Pix(22, 11);
  const run = f >= 4 && f <= 7;
  const chest = f === 3 ? 2.2 : f === 2 ? -0.4 : run ? -0.2 : 1; // altura do peito acima da linha
  const base = 7.5; // linha da barriga
  // rabo: da base do corpo (x 12) até a ponta (x 21), afinando; na corrida ondula
  for (let x = 12; x <= 21; x++) {
    const t = (x - 12) / 9;
    const y = base - 1.2 + t * 1.6 + (run ? Math.sin(t * 4 + f * 1.7) * 0.9 : Math.sin(t * 2.4) * 0.4);
    const th = 1.8 * (1 - t) + 0.6;
    for (let k = 0; k < th; k++) p.set(x, Math.round(y - k + th / 2), k < th - 1 ? PAL.n3 : PAL.n2);
    if (t > 0.8) p.set(x, Math.round(y), PAL.n2);
  }
  // corpo (o peito sobe com a flexão)
  for (let x = 5; x <= 13; x++) {
    const t = (x - 5) / 8; // 0 no ombro, 1 no quadril
    const lift = (1 - t) * chest;
    const top = base - 2.6 - lift,
      bot = base - lift * 0.5 + (f === 1 && t > 0.3 && t < 0.8 ? 0.6 : 0);
    for (let y = Math.round(top); y <= Math.round(bot); y++) {
      let c = PAL.n3;
      if (y === Math.round(top)) c = (x + f) % 2 ? PAL.straw2 : PAL.n4; // dorso com pintas claras
      if (y >= Math.round(bot)) c = PAL.straw3; // barriga
      p.set(x, y, c);
    }
    if (x % 3 === 1) p.set(x, Math.round(top) + 1, PAL.n2); // faixas escuras do dorso
  }
  // cabeça (cunha) e a coleira escura atrás dela
  const hy = base - 3.3 - chest - (f === 8 ? 0.6 : 0);
  const hx = 1;
  for (let x = hx; x <= hx + 4; x++) {
    const t = (x - hx) / 4;
    const h = 1 + t * 1.6;
    for (let y = Math.round(hy - h * 0.4); y <= Math.round(hy + h * 0.7); y++) p.set(x, y, y > hy ? PAL.clay2 : PAL.clay3);
  }
  p.set(hx, Math.round(hy), PAL.clay1); // focinho
  p.set(hx + (f === 8 ? 3 : 2), Math.round(hy - 0.2), K); // olho (olhando para trás: o olho vai para a nuca)
  for (let y = Math.round(hy - 0.6); y <= Math.round(hy + 1.6); y++) p.set(hx + 5, y, K); // coleira
  // patas (cotovelo para fora): da frente em x≈6, de trás em x≈12
  const leg = (x0, y0, dx, len) => {
    for (let k = 0; k <= len; k++) p.set(Math.round(x0 + dx * k), Math.round(y0 + k), PAL.n2);
    p.set(Math.round(x0 + dx * len) + (dx < 0 ? -1 : 1), Math.round(y0 + len), PAL.n2); // dedos
  };
  const shoulderY = base - chest * 0.85;
  if (run) {
    const a = f % 2 === 0;
    leg(6, shoulderY, a ? -0.8 : 0.6, 2);
    leg(12, base, a ? 0.8 : -0.7, 2);
  } else {
    leg(6, shoulderY, f === 3 ? -0.15 : -0.4, Math.max(1, Math.round(base + 1.6 - shoulderY)));
    leg(12, base, 0.5, 1.6);
  }
  return p.outline(K);
}

// Pássaros vistos de cima, rasterizados em cada rumo (0 = leste, sentido horário), nunca um sprite girado: a forma é
// descrita em coordenadas do pássaro (u para a frente, v para a direita) e o chão é achatado (0,8 na vertical)
export const BIRD_DIRS = 16;
function topBird(N, ang, shape) {
  const p = new Pix(N, N);
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const c0 = N / 2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c0,
        dy = (y + 0.5 - c0) / 0.8;
      const c = shape(dx * ca + dy * sa, -dx * sa + dy * ca);
      if (c != null) p.set(x, y, c);
    }
  return p.outline(K);
}
// Asa-branca em voo, de cima: corpo cinza-azulado, cabeça cor de vinho, a faixa branca na asa que dá o nome, a ponta
// escura e a cauda com a barra escura. 8 quadros de batida: a asa encurta em perspectiva no alto e embaixo (no alto
// fica mais clara, perto do sol; embaixo, mais escura): 0 alto, 2 meio da descida, 4 embaixo, 6 meio da subida
const ASA_SPAN = [0.42, 0.78, 1, 0.78, 0.42, 0.78, 1, 0.78];
const ASA_LIT = [1, 1, 0, -1, -1, -1, 0, 1];
export const ASA_FLAP = [0, 1, 2, 3, 4, 5, 6, 7]; // ciclo da batida
function makeAsaBranca(dir, f) {
  const k = ASA_SPAN[f],
    lit = ASA_LIT[f];
  const span = 1.3 + 8.2 * k;
  return topBird(22, (dir / BIRD_DIRS) * Math.PI * 2, (u, v) => {
    const av = Math.abs(v);
    // corpo e cabeça
    if (u >= -3.6 && u <= 3.4 && av <= 1.7 * Math.sqrt(Math.max(0, 1 - ((u + 0.2) / 3.8) ** 2))) {
      if (u > 3) return PAL.s4; // bico
      if (u > 1.4) return PAL.clay2; // cabeça
      return av < 0.6 && u < 0 ? PAL.s3 : PAL.s2;
    }
    // cauda (leque curto com a barra escura na ponta)
    if (u < -3 && u > -6.6 && av <= 1 + (-3 - u) * 0.28) return u < -5.6 ? PAL.s0 : PAL.s2;
    // asas: a linha do meio curva para trás (asa varrida, de pomba), larga junto ao corpo e afinando até a ponta
    if (av > 0.9 && av <= span) {
      const t = (av - 0.9) / (span - 0.9);
      const mid = 0.1 - 1.6 * t - 1.4 * t * t,
        chord = 3.6 * (1 - Math.pow(t, 1.5)) + 0.5;
      const front = mid + chord / 2,
        back = mid - chord / 2;
      if (u <= front && u >= back) {
        if (t > 0.72) return lit > 0 ? PAL.s1 : PAL.s0; // ponta escura
        if (u > front - 0.9 && t > 0.15 && t < 0.68) return PAL.white; // a faixa branca
        return lit > 0 ? PAL.s3 : lit < 0 ? PAL.s1 : PAL.s2;
      }
    }
    return null;
  });
}
// Carcará de cima, planando (asas largas e retas, a "mão" aberta com a mancha clara, cauda listrada, boné preto e a
// cara vermelha). 3 quadros: 0 planando, 1 pontas sobem, 2 pontas descem (a planada respira; ele quase não bate asa)
export const CARCARA_DIRS = BIRD_DIRS;
function makeCarcara(dir, f) {
  const flex = f === 1 ? 1 : f === 2 ? -1 : 0;
  return topBird(36, (dir / BIRD_DIRS) * Math.PI * 2, (u, v) => {
    const av = Math.abs(v);
    // cabeça: bico claro, boné preto em cima com o rosto creme dos lados, pescoço creme
    if (u > 3.6 && u <= 6.8 && av <= 1.5 * Math.sqrt(Math.max(0, 1 - ((u - 5) / 2) ** 2)) + 0.2) {
      if (u > 6) return u > 6.5 ? PAL.yel2 : PAL.red2;
      if (av < 0.8 && u > 4.4) return PAL.s0;
      return PAL.cream;
    }
    // corpo (dorso pardo-escuro com estrias)
    if (u >= -3.6 && u <= 3.8 && av <= 2.1 * Math.sqrt(Math.max(0, 1 - (u / 3.9) ** 2))) {
      if (u > 2.2) return PAL.cream;
      return Math.floor(u * 1.4 + 9) % 3 === 0 ? PAL.n2 : PAL.n1;
    }
    // cauda em leque: creme com barras finas escuras e a barra larga na ponta
    if (u < -3 && u > -9.4 && av <= 1.3 + (-3 - u) * 0.26) {
      if (u < -8.2) return PAL.s0;
      return Math.floor(-u * 1.5) % 2 ? PAL.cream : PAL.n1;
    }
    // asas: borda de ataque com o "cotovelo" para a frente, a de fuga larga junto ao corpo; a mão afina e abre em
    // dedos (primárias) com a janela clara antes da ponta
    const span = 15.5;
    if (av > 1.4 && av <= span) {
      const t = (av - 1.4) / (span - 1.4);
      const lift = flex * t * t * 1.1; // planada: as pontas sobem/descem (no chão achatado, andam na frente)
      const front = 1.4 + Math.sin(Math.min(1, t * 1.7) * Math.PI) * 0.9 - t * 1.6 + lift,
        back = -3.4 + t * 1.6 + lift - (t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 0.6 : 0);
      const tip = t > 0.88 ? Math.sqrt(Math.max(0, 1 - ((t - 0.88) / 0.12) ** 2)) : 1; // ponta arredondada
      const mid = (front + back) / 2,
        half = ((front - back) / 2) * tip;
      if (u <= mid + half && u >= mid - half) {
        if (t > 0.8 && Math.floor((u - back) * 1.6) % 2 === 1) return null; // dedos das primárias
        if (t > 0.58 && t < 0.8) return u > mid ? PAL.cream : PAL.straw3; // janela clara da mão
        if (t >= 0.8) return PAL.s0;
        return u > mid + half - 1.2 ? PAL.n2 : PAL.n1;
      }
    }
    return null;
  });
}
// Sombras no chão (a mesma forma, só a mancha): carcará planando e asa-branca de asas abertas
function shadowOf(src) {
  const p = new Pix(src.w, src.h);
  for (let i = 0; i < src.c.length; i++) if (src.c[i] >>> 24 && (src.c[i] & 0xffffff) !== K) p.c[i] = 0xff000000 | PAL.ink;
  return p;
}
// No chão (de lado, cabeça à direita): 0 de pé, 1 passo, 2 bicando, 3 cabeça erguida olhando
function makeAsaChao(f) {
  const p = new Pix(14, 11);
  const peck = f === 2;
  p.ellipse(6, 6.5, 4.2, 2.6, PAL.s2);
  p.ellipse(5, 6, 3, 1.6, PAL.s3); // asa dobrada
  for (let x = 3; x <= 7; x++) p.set(x, 5, x === 4 || x === 5 ? PAL.white : PAL.s3); // a faixa branca
  for (let x = 0; x <= 2; x++) p.set(x, 6 + (x < 1 ? 1 : 0), PAL.s1); // cauda
  const hx = peck ? 11 : 10,
    hy = peck ? 8 : f === 3 ? 2 : 3;
  p.set(9, 5, PAL.clay2);
  p.set(9, 4, PAL.clay2);
  p.ellipse(hx, hy + 0.5, 1.6, 1.4, PAL.clay2);
  p.set(hx + 2, hy + 1, PAL.s4); // bico
  p.set(hx, hy, K);
  p.set(8, 8, PAL.clay3); // peito
  // patas (passo: uma à frente)
  p.set(5, 9, PAL.red1);
  p.set(f === 1 ? 8 : 7, 9, PAL.red1);
  p.set(5, 10, PAL.red1);
  p.set(f === 1 ? 9 : 7, 10, PAL.red1);
  return p.outline(K);
}
// Pássaro ao longe no céu (silhueta 7×4): 4 quadros (alto, meio, baixo, meio)
function makeFarBird(f) {
  const p = new Pix(7, 4);
  const c = PAL.inkSoft;
  p.set(3, 2, c);
  p.set(3, 1, c);
  const rows = [
    [[2, 1], [1, 0], [0, 0], [4, 1], [5, 0], [6, 0]],
    [[2, 1], [1, 1], [0, 1], [4, 1], [5, 1], [6, 1]],
    [[2, 2], [1, 3], [4, 2], [5, 3]],
    [[2, 2], [1, 2], [0, 1], [4, 2], [5, 2], [6, 1]],
  ];
  for (const [x, y] of rows[f]) p.set(x, y, c);
  return p;
}
export const FAR_FLAP = [0, 1, 2, 3];

// ---------------------------------------------------------------------------
// AÇUDE: a margem de barro (molhado colado na água, rachado em volta) e de terra vermelha, lajedos, tufos secos e
// verdes na beira; a carnaúba (leque de folhas, base das folhas velhas em xadrez, saia de palha seca) e os aguapés
// ---------------------------------------------------------------------------
const SHALLOW = 0x3f8a78,
  MID = PAL.t3,
  DEEP = PAL.t2,
  ABYSS = PAL.t1,
  NIGHTW = 0x0c1c1c;
function makePondBase() {
  const sh = pondShape();
  const W = sh.w,
    H = sh.h;
  let p = new Pix(W, H);
  const r = rng(2026);
  const near = (x, y, R) => {
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= R * R && sh.inside(x + i, y + j)) return true;
    return false;
  };
  // rachaduras do barro seco em volta da água (Voronoi bem miúdo)
  const pts = [];
  for (let i = 0; i < 90; i++) pts.push([r() * W, r() * H]);
  const crack = (x, y) => {
    let d1 = 1e9,
      d2 = 1e9;
    for (const q of pts) {
      const e = Math.hypot(x + 0.5 - q[0], (y + 0.5 - q[1]) * 1.5);
      if (e < d1) [d2, d1] = [d1, e];
      else if (e < d2) d2 = e;
    }
    return d2 - d1 < 0.9;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (sh.inside(x, y)) continue;
      const wob = Math.sin(x * 0.7) + Math.sin(y * 1.1 + x * 0.3);
      if (near(x, y, 1)) p.set(x, y, PAL.terra0); // barro molhado
      else if (near(x, y, 2)) p.set(x, y, bayer(x, y) < 0.5 ? PAL.terra1 : PAL.terra0);
      else if (near(x, y, 5 + (wob > 0.6 ? 1 : 0))) p.set(x, y, crack(x, y) ? PAL.terra0 : (x + y) % 7 === 0 ? PAL.batida2 : PAL.batida1); // barro rachado
      else if (near(x, y, 7 + (wob > 0 ? 1 : 0)) && bayer(x, y) < 0.5) p.set(x, y, PAL.batida0);
    }
  // ilhota: terra com capim seco
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ix = (x + 0.5 - ISLE.x) / (ISLE.rx + 1),
        iy = (y + 0.5 - ISLE.y) / (ISLE.ry + 1);
      if (ix * ix + iy * iy > 1.1 || sh.inside(x, y) || near(x, y, 1)) continue;
      p.set(x, y, bayer(x, y) < 0.35 ? STRAW[1] : PAL.terra2);
    }
  // água em faixas de profundidade (a mesma do Lago: a pesca se lê igual)
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
      else c = b < (16 - d) / 5 ? ABYSS : NIGHTW;
      p.set(x, y, c);
    }
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * H);
    if (!sh.inside(x, y)) continue;
    const d = sh.depth(x, y);
    if (d > 1 && d < 3.2 && r() < 0.6) p.set(x, y, 0x6a7a52); // fundo de barro no raso
  }
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!sh.inside(x, y) || sh.depth(x, y) > 1.1) continue;
      if (!sh.inside(x, y - 1) && (x + y) % 3 !== 0) p.set(x, y, 0x8fd0c0);
    }
  // detalhes por cima: lajedos (o afloramento da bica no nordeste), tufos e um xique-xique na margem
  const ground = p;
  p = new Pix(W, H);
  const slab = (bx, by, br) => {
    p.ellipse(bx, by, br, br * 0.62, LAJEDO[1]);
    p.ellipse(bx - br * 0.2, by - br * 0.18, br * 0.8, br * 0.45, LAJEDO[2]);
    p.ellipse(bx - br * 0.38, by - br * 0.28, br * 0.42, br * 0.22, LAJEDO[3]);
    p.set(Math.round(bx - br * 0.45), Math.round(by - br * 0.36), LAJEDO[4]);
  };
  slab(83, 8, 5);
  slab(98, 8, 5);
  slab(90, 4, 8);
  slab(90, 10, 5);
  p.rect(88, 3, 5, 4, PAL.ink); // boca da bica (olho-d'água)
  p.rect(89, 4, 3, 2, LAJEDO[0]);
  p.rect(87, 7, 7, 1, LAJEDO[4]);
  p.rect(88, 8, 5, 1, PAL.ice1);
  slab(106, 15, 5);
  slab(12, 52, 4);
  slab(104, 50, 3);
  const clump = (x0, y0, n, spread, green) => {
    for (let k = 0; k < n; k++) {
      const x = Math.round(x0 + (r() - 0.5) * spread),
        base = Math.round(y0 + (r() - 0.5) * 3);
      const h = 3 + Math.floor(r() * 5);
      const lean = r() < 0.5 ? -1 : 1;
      for (let j = 0; j < h; j++) p.set(x + (j > h * 0.6 ? lean : 0), base - j, green ? (j > h - 2 ? CACTUS[4] : CACTUS[2]) : j > h - 2 ? STRAW[3] : STRAW[1]);
    }
  };
  clump(8, 30, 6, 8, true);
  clump(30, 66, 6, 12, false);
  clump(70, 69, 5, 10, true);
  clump(113, 32, 5, 5, false);
  clump(52, 10, 4, 10, false);
  // xique-xique na margem sul
  for (let k = 0; k < 5; k++) {
    p.set(40 + k, 64 - Math.round(k * 0.6), CACTUS[3]);
    p.set(40 + k, 65 - Math.round(k * 0.6), CACTUS[1]);
  }
  p.set(42, 62, PAL.cream);
  p.outline(K);
  ground.blit(p, 0, 0);
  return ground;
}
// Carnaúba (a "árvore da vida" do sertão): estipe reta com a base das folhas velhas em xadrez, saia de folhas secas
// pendurada e a coroa de leques verde-cinza (a cera da folha)
function makeCarnauba() {
  const p = new Pix(46, 52);
  const r = rng(1313);
  const bx = 22,
    by = 51;
  const H = 30;
  for (let k = 0; k < H; k++) {
    const x = Math.round(bx + Math.sin(k / 22) * 2),
      y = by - k;
    const xadrez = k < 20 && (k + (x % 2)) % 3 === 0; // base das folhas velhas, em xadrez
    p.set(x - 1, y, xadrez ? DRYWOOD[1] : DRYWOOD[3]);
    p.set(x, y, xadrez ? DRYWOOD[3] : DRYWOOD[2]);
    p.set(x + 1, y, DRYWOOD[1]);
  }
  const top = { x: Math.round(bx + Math.sin(H / 22) * 2), y: by - H };
  // saia de folhas secas penduradas (as velhas que caem em volta da estipe)
  for (let i = -5; i <= 5; i++) {
    const len = 7 - Math.abs(i) * 0.7 + r() * 2;
    for (let k = 0; k < len; k++) p.set(top.x + i + Math.round(i * k * 0.1), top.y + 2 + k, k > len - 2 ? STRAW[0] : (i + k) % 3 ? STRAW[1] : STRAW[2]);
  }
  // coroa: cada folha é um talo (pecíolo) que termina num LEQUE aberto, de raios que se separam em tiras na ponta;
  // as de cima pegam a cera clara do lado do sol, as de baixo caem na sombra. Os vãos entre os leques deixam o céu passar
  const fronds = [[-3.05, 7], [-2.45, 8], [-1.85, 8], [-1.25, 8], [-0.65, 8], [-0.08, 7], [0.55, 5], [2.55, 5]];
  for (const [ang, pet] of fronds) {
    const down = Math.max(0, Math.sin(ang)); // folha de baixo
    let ex = top.x,
      ey = top.y;
    for (let q = 1; q <= pet; q++) {
      ex = top.x + Math.cos(ang) * q;
      ey = top.y - 1 + Math.sin(ang) * q * 0.72 + (q * q) / 40;
      p.set(Math.round(ex), Math.round(ey), down ? CACTUS[1] : CACTUS[2]);
    }
    const len = 6 + (down ? 0 : 2);
    for (let w = -0.3; w <= 0.3001; w += 0.075) {
      const i = Math.round((w + 0.3) / 0.075);
      const rl = len * (1 - Math.abs(w) * 0.6) - (i % 2 ? 1.4 : 0);
      for (let q = 1; q <= rl; q++) {
        const a = ang + w;
        const x = Math.round(ex + Math.cos(a) * q),
          y = Math.round(ey + Math.sin(a) * q * 0.72 + (q * q) / 30);
        let c = i % 2 ? CACTUS[3] : CACTUS[2];
        if (q > rl - 1.5) c = i % 2 ? PAL.s3 : CACTUS[3]; // a ponta das tiras, cerosa
        if (!down && ang < -1.0 && ang > -2.6 && i % 2 && q > 1) c = PAL.s4; // a cera clareia ao sol
        if (down) c = i % 2 ? CACTUS[2] : CACTUS[1];
        p.set(x, y, c);
      }
    }
  }
  p.disc(top.x, top.y, 2, CACTUS[1]);
  return p.outline(K);
}
// Aguapé (baronesa): folhas redondas brilhantes boiando e a espiga de flor lilás
function makeAguape(big) {
  const p = new Pix(big ? 15 : 9, big ? 11 : 6);
  const leaves = big ? [[4, 7, 3.2, 2.2], [9, 8, 3.4, 2.3], [7, 5, 2.8, 2], [12, 6, 2.2, 1.6]] : [[3, 3.5, 2.6, 1.8], [6, 3, 2.4, 1.7]];
  for (const [x, y, rx, ry] of leaves) {
    p.ellipse(x, y, rx, ry, PAL.g4);
    p.ellipse(x - 0.6, y - 0.5, rx * 0.6, ry * 0.5, PAL.g5);
    p.set(Math.round(x - rx * 0.4), Math.round(y - ry * 0.4), PAL.g6);
  }
  if (big) {
    for (let y = 1; y <= 5; y++) p.set(7, y, PAL.g3);
    for (const [x, y] of [[6, 1], [8, 1], [7, 0], [6, 3], [8, 2], [7, 2]]) p.set(x, y, y < 2 ? PAL.pur3 : PAL.pur2);
    p.set(7, 1, PAL.yel3);
  }
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// HORIZONTE (faixa no norte da Clareira, acima da caatinga da borda): céu de cada fase do dia e a serra + a
// caatinga em silhueta, na mesma fase. A cena mistura duas fases vizinhas pela hora
// ---------------------------------------------------------------------------
export const BAND = { w: 660, h: 112 }; // px de arte (×3 no mapa); o horizonte é a linha de baixo
export const PHASES = ["night", "dawn", "day", "dusk"];
const SKY_TONES = {
  night: { tones: [PAL.luar0, PAL.luar1, PAL.luar2, PAL.luar3, PAL.luar4], curve: 1.25 },
  dawn: { tones: [PAL.dawn0, PAL.dawn1, PAL.dawn2, PAL.dawn3, PAL.dawn4, PAL.dawn5], milky: false, curve: 1.05 },
  day: { tones: [PAL.dia0, PAL.dia1, PAL.dia2, PAL.dia3], milky: false, curve: 0.95 },
  dusk: { tones: [PAL.poente0, PAL.poente1, PAL.poente2, PAL.poente3, PAL.poente4, PAL.poente5], milky: false, curve: 1.15 },
};
// serra [corpo, crista] e caatinga de perto [corpo, borda] em cada fase
export const SILHOUETTE = {
  night: { ridge: [PAL.luar2, PAL.luar4], near: [PAL.luar0, PAL.luar3], lightX: 470 },
  dawn: { ridge: [PAL.dawnRidge0, PAL.dawnRidge1], near: [PAL.dawnNear0, PAL.dawnNear1], lightX: 520 },
  day: { ridge: [PAL.s3, PAL.s4], near: [PAL.straw0, PAL.straw1], lightX: 330 },
  dusk: { ridge: [PAL.poente1, PAL.poente3], near: [PAL.ink, PAL.poente2], lightX: 140 },
};
function makeBandSky(phase) {
  const o = SKY_TONES[phase];
  return makeSky(BAND.w, BAND.h, BAND.h, phase === "night" ? 17 : 11, { tones: o.tones, milky: o.milky, curve: o.curve });
}
function makeBandLand(phase) {
  const s = SILHOUETTE[phase];
  const W = BAND.w,
    H = BAND.h;
  const p = makeRidge(W, H, H - 5, 22, 41, s.lightX, s.ridge);
  p.blit(makeCactusline(W, H, H - 1, { seed: 59, minH: 10, maxH: 22, fill: s.near[0], rim: s.near[1], lightX: s.lightX }), 0, 0);
  return p;
}
// Lua cheia grande (37×37): mares escuras, crateras de borda acesa, o limbo um pouco mais escuro
function makeMoonBig() {
  const R = 17.5,
    N = 37,
    c = N / 2;
  const p = new Pix(N, N);
  // mares escuros ligados em diagonal (como os da lua de verdade: nada de "rosto") com a borda pontilhada
  const maria = [[13, 12, 6, 5], [21, 11.5, 4, 3.5], [25, 17, 4.5, 3.6], [9.5, 19, 4, 7], [19, 23.5, 3.6, 2.6], [28, 22.5, 2.4, 2]];
  const mare = (x, y) => Math.max(0, ...maria.map(([mx, my, rx, ry]) => 1 - Math.hypot((x + 0.5 - mx) / rx, (y + 0.5 - my) / ry)));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c,
        dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy) / R;
      if (d > 1) continue;
      let t = 0.8 - d * d * 0.32 + (-dx - dy) / (R * 6);
      const m = mare(x, y);
      if (m > 0.22 || (m > 0.05 && bayer(x, y) < m * 4)) t -= 0.3;
      t += (bayer(x, y) - 0.5) * 0.08;
      p.set(x, y, t > 0.72 ? PAL.moon2 : t > 0.5 ? PAL.moon1 : t > 0.32 ? PAL.moon0 : PAL.s3);
    }
  // crateras pequenas de borda acesa e a cratera clara com raios (embaixo, como Tycho)
  const crater = (cx, cy, r) => {
    p.ellipse(cx, cy, r, r * 0.85, PAL.moon0);
    for (let x = Math.floor(cx - r); x < cx; x++) p.over(x, Math.floor(cy - r * 0.85), PAL.moon2);
  };
  crater(28, 12, 1.4);
  crater(6, 12, 1.2);
  crater(25, 28, 1.5);
  const tx = 16,
    ty = 30;
  for (const [ax, ay, len] of [[1, 0, 5], [-1, 0.2, 4], [0.3, -1, 6], [-0.6, -0.8, 5], [0.8, -0.6, 4]])
    for (let k = 1; k <= len; k++) p.over(Math.round(tx + ax * k), Math.round(ty + ay * k), k % 2 ? PAL.moon2 : PAL.moon1);
  p.over(tx, ty, PAL.white);
  return p;
}

// ---------------------------------------------------------------------------
// Cartão do Guarda-roupa: o mandacaru em flor numa pontinha de chão vermelho, com a coroa-de-frade
// ---------------------------------------------------------------------------
function makeCard(mand, tips) {
  const p = new Pix(mand.w + 18, mand.h + 6);
  p.ellipse(p.w / 2, p.h - 3, p.w / 2 - 1, 3, PAL.terra2);
  for (let x = 0; x < p.w; x++) for (let y = p.h - 6; y < p.h; y++) if (p.get(x, y) && bayer(x, y) < 0.3) p.set(x, y, PAL.terra1);
  p.blit(mand, 9, 1);
  const fl = makeFlower(4);
  for (const t of tips.slice(0, 3)) p.blit(fl, 9 + t.x - 6, 1 + t.y - 13);
  p.blit(makeFrade(5), 0, p.h - 16);
  return p;
}

// Só a flor do mandacaru (a da trilha, que floresce em qualquer Clareira depois da conquista)
export function ensureSertaoFlower(scene) {
  if (!scene.textures.exists("camp_sertao_flower")) registerStrip(scene, "camp_sertao_flower", [0, 1, 2, 3, 4, 5, 6].map(makeFlower));
}

// Registra tudo (uma vez por jogo; chamado ao montar a Clareira do sertão ou a prévia do Guarda-roupa)
export function ensureCampSertao(scene) {
  if (scene.textures.exists("camp_sertao_ground")) return;
  registerCampSertao(scene);
}
export function registerCampSertao(scene) {
  makeGround().register(scene, "camp_sertao_ground");
  registerStrip(scene, "camp_sertao_crack", [makeCrackPatch(71), makeCrackPatch(83), makeCrackPatch(97)]);
  registerStrip(scene, "camp_sertao_sand", [makeSandPatch(5), makeSandPatch(19)]);
  registerStrip(scene, "camp_sertao_juazeiro", [0, 1, 2, 3, 4, 5, 6, 7].map(makeJuazeiro));
  MANDACARU_TIPS.length = 0;
  MANDACARUS.forEach(([seed, w, h, arms], i) => {
    const { p, tips } = mandacaru(seed, w, h, arms);
    p.register(scene, `camp_sertao_mandacaru${i}`);
    MANDACARU_TIPS.push(tips);
    if (i === 0) makeCard(p, tips).register(scene, "camp_sertao_card");
  });
  ensureSertaoFlower(scene); // pode já existir (a flor da trilha) e estar em uso: nunca registrar por cima
  registerStrip(scene, "camp_sertao_frade", [makeFrade(5), makeFrade(13)]);
  makeFence(40).register(scene, "garden_sertao_fence");
  makeForkPost().register(scene, "garden_sertao_fence_post");
  makeArch().register(scene, "garden_sertao_arch");
  makeSign().register(scene, "garden_sertao_sign");
  makeBell().register(scene, "camp_sertao_bell");
  makeLockedPlot().register(scene, "garden_sertao_locked");
  registerStrip(scene, "camp_sertao_scarecrow", [0, 1, 2, 3, 4, 5].map(makeScarecrow));
  registerStrip(scene, "camp_sertao_hammock", [0, 1, 2, 3, 4, 5].map(makeHammock));
  makeLog().register(scene, "camp_sertao_log");
  registerStrip(scene, "camp_sertao_folha", [0, 1, 2, 3].map((f) => makeDryLeaf(f, 0)));
  registerStrip(scene, "camp_sertao_folha2", [0, 1, 2, 3].map((f) => makeDryLeaf(f, 1)));
  for (const k of ["camp_sertao_folha", "camp_sertao_folha2"])
    if (!scene.anims.exists(k)) scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { frames: FOLHA_ROLA }), frameRate: 10, repeat: -1 });
  makePote().register(scene, "camp_sertao_pote");
  registerStrip(scene, "camp_sertao_calango", [0, 1, 2, 3, 4, 5, 6, 7, 8].map(makeCalango));
  const asa = [];
  for (let d = 0; d < BIRD_DIRS; d++) for (let f = 0; f < 8; f++) asa.push(makeAsaBranca(d, f));
  registerStrip(scene, "camp_sertao_asa", asa);
  registerStrip(scene, "camp_sertao_asa_sombra", Array.from({ length: BIRD_DIRS }, (_, d) => shadowOf(makeAsaBranca(d, 2))));
  registerStrip(scene, "camp_sertao_asa_chao", [0, 1, 2, 3].map(makeAsaChao));
  registerStrip(scene, "camp_sertao_ave", [0, 1, 2, 3].map(makeFarBird));
  const carc = [];
  for (let d = 0; d < CARCARA_DIRS; d++) for (let f = 0; f < 3; f++) carc.push(makeCarcara(d, f));
  registerStrip(scene, "camp_sertao_carcara", carc);
  registerStrip(scene, "camp_sertao_carcara_sombra", Array.from({ length: CARCARA_DIRS }, (_, d) => shadowOf(makeCarcara(d, 0))));
  makePondBase().register(scene, "pond_sertao_base");
  makeCarnauba().register(scene, "pond_sertao_palm");
  makeAguape(true).register(scene, "pond_sertao_aguape");
  makeAguape(false).register(scene, "pond_sertao_aguape_s");
  for (const ph of PHASES) {
    makeBandSky(ph).register(scene, `camp_sertao_sky_${ph}`);
    makeBandLand(ph).register(scene, `camp_sertao_land_${ph}`);
  }
  makeMoonBig().register(scene, "camp_sertao_lua");
  [[61, 96, 9], [67, 70, 8], [73, 120, 10]].forEach(([seed, w, h], i) => makeCloud(seed, w, h, { colors: [PAL.s4, PAL.white] }).register(scene, `camp_sertao_cloud${i}`));
  makeSun(13).register(scene, "camp_sertao_sol");
  if (!scene.textures.exists("camp_sertao_streak")) makeStreak().register(scene, "camp_sertao_streak");
}
