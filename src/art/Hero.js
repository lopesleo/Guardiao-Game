// Os quatro guardiões são LENDAS DA MATA (ver docs/TEMA_FOLCLORE.md):
//   guardian → Curupira (cabelo de fogo, pés virados para trás, cajado)
//   huntress → Caipora (cabeleira de folhas, protetora dos bichos, vara encantada)
//   druid    → Iara (senhora das águas, cabelo longo, vestido de escamas)
//   shaman   → Saci (uma perna só, gorro vermelho, redemoinho de vento)
//   fulozinha → Comadre Fulozinha (cabelo negro comprido, vestido branco, urtiga)
//   maedoouro → Mãe-do-Ouro (cabelo dourado, vestido de seda, bola de fogo de ouro)
//   anhanga  → Anhangá (veado branco de olhos de fogo, galhada com pelo)
// Retratos respeitosos: heróis espertos e poderosos, sem caricatura; Saci sem
// cachimbo; Caipora sem peles de animal (ela protege os bichos).
//
// Desenho por primitivas, virados para a DIREITA. Cada quadro é DESENHADO numa pose
// (nada de girar/esticar o sprite): pernas com joelho, braço de trás que balança,
// cabelo e roupa que chegam um quadro atrasados (arrasto), tronco que inclina para a
// frente ao andar e olhos que piscam. Quadros (HERO_FRAMES): 0-3 respiração, 4 piscada,
// 5-12 caminhada (8 tempos: contato, desce, passa, sobe — duas vezes), 13 dash,
// 14 golpe sofrido. O quadro 0 é o retrato (ícones e menus). Os ids internos não mudam.
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";

export const HERO_W = 24;
export const HERO_H = 28;
const FEET = HERO_H - 2;

const SKIN = { base: 0x9a6a4a, shade: 0x7a4e36, light: 0xb8805a, deep: PAL.n2 };
// Pele marrom com luz e sombra reais (nunca silhueta escura com olho/dente
// branco em destaque — isso é caricatura; ver docs/TEMA_FOLCLORE.md)
const SKIN_DARK = { base: 0x7a4a32, shade: 0x5e3826, light: 0x9a6446, deep: PAL.n1 };

// ---------------------------------------------------------------------------
// Poses. Campos: b = corpo desce (respiração/passo); hb = cabelo, roupa e arma com um
// quadro de atraso; lean = tronco e cabeça à frente; near/far = pé da perna da frente /
// de trás {dx, lift}; arm = braço de trás (−1 atrás … 1 à frente); trail = cabelo
// esvoaçando para trás; eyes: open | closed | focus; mouth: calm | open; f = nº do quadro
// (tremulações); move = andando.
// ---------------------------------------------------------------------------
const STAND = { b: 0, hb: 0, lean: 0, near: { dx: 1, lift: 0 }, far: { dx: -1, lift: 0 }, arm: 0, trail: 0, eyes: "open", mouth: "calm", f: 0, ph: 0, move: false };
const pose = (o) => ({ ...STAND, ...o });

// Respiração: desce, o cabelo chega depois, sobe, o cabelo chega depois
const IDLE = [pose({ f: 0 }), pose({ b: 1, f: 1, ph: 0.25 }), pose({ b: 1, hb: 1, f: 2, ph: 0.5 }), pose({ hb: 1, f: 3, ph: 0.75 })];
const BLINK = pose({ eyes: "closed" });

// Caminhada em 8 tempos. Pé da frente: contato à frente → apoio passando para trás →
// sobe dobrando o joelho → volta à frente. A outra perna vai meio ciclo atrás.
const STRIDE = [[2, 0], [1, 0], [0, 0], [-1, 0], [-2, 0], [-1, 1], [0, 2], [1, 1]];
const STEP_B = [0, 1, 0, 0, 0, 1, 0, 0]; // o corpo afunda logo depois de cada contato
const leg = (i) => ({ dx: STRIDE[i & 7][0], lift: STRIDE[i & 7][1] });
const WALK = STRIDE.map((_, i) =>
  pose({ b: STEP_B[i], hb: STEP_B[(i + 7) & 7], lean: 1, near: leg(i), far: leg(i + 4), arm: STRIDE[i][0] / 2, trail: 1, f: i, ph: i / 8, move: true }),
);
const DASH = pose({ lean: 2, near: { dx: 3, lift: 1 }, far: { dx: -3, lift: 0 }, arm: -1, hb: -1, trail: 2, eyes: "focus", f: 1, move: true });
const HURT = pose({ lean: -1, near: { dx: 1, lift: 0 }, far: { dx: -1, lift: 1 }, arm: 1, hb: -1, eyes: "closed", mouth: "open", f: 2 });

// Lendas que flutuam (Iara, Mãe-do-Ouro): deslizam subindo e descendo devagar
const FLOAT_B = [0, 0, 0, 1, 1, 1, 1, 0];
const GLIDE = FLOAT_B.map((b, i) => pose({ b, hb: FLOAT_B[(i + 7) & 7], lean: 1, arm: Math.round(Math.sin((i / 8) * Math.PI * 2)), trail: 1, f: i, ph: i / 8, move: true }));

// Saci não anda: pula numa perna só (agacha, impulsiona, voa, cai, amortece)
const HOP_B = [2, 0, -1, -2, -2, -1, 0, 1];
const HOP_LIFT = [0, 0, 1, 2, 2, 1, 0, 0];
const HOP = HOP_B.map((b, i) => pose({ b, hb: HOP_B[(i + 7) & 7], lean: 1, near: { dx: 0, lift: HOP_LIFT[i], bend: b > 0 ? b : 0 }, arm: -b / 2, trail: b < 0 ? 2 : 1, f: i, ph: i / 8, move: true }));
const SACI_DASH = pose({ ...DASH, b: -1, near: { dx: 1, lift: 1 } });

// Ordem dos quadros na tira (o Player e as cenas usam estes índices)
export const HERO_FRAMES = { idle: [0, 1, 2, 3], blink: 4, walk: [5, 6, 7, 8, 9, 10, 11, 12], dash: 13, hurt: 14 };

// Olhos virados para a direita: branco + pupila (fechado = risco; foco = sobrancelha)
function eye(p, x, y, q, sk) {
  if (q.eyes === "closed") {
    p.set(x, y, PAL.ink);
    p.set(x + 1, y, PAL.ink);
    return;
  }
  p.set(x, y, PAL.white);
  p.set(x + 1, y, PAL.ink);
  if (q.eyes === "focus") p.set(x + 1, y - 1, sk.shade);
}
function mouth(p, x, y, q, sk) {
  if (q.mouth === "open") {
    p.set(x - 1, y, PAL.ink);
    p.set(x, y, PAL.ink);
  } else p.set(x, y, sk.shade);
}

// Cabeça oval sombreada (luz vinda da esquerda/cima)
function head(p, cx, cy, rx, ry, sk) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, -dx * 0.5 - dy * 0.4 > 0.35 ? sk.light : dx > 0.55 || dy > 0.6 ? sk.shade : sk.base);
    }
}

// Tronco em trapézio com rampa de 3 cores (claro à esquerda). lean inclina o topo
// para a frente mantendo a base; hem empurra as duas últimas linhas para trás
// (barra da roupa arrastando quando anda).
function torso(p, top, bot, xl0, xr0, spreadL, spreadR, ramp, lean = 0, hem = 0) {
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / Math.max(1, bot - top);
    const k = y >= bot - 1 ? hem : 0;
    const xl = Math.round(xl0 + lean - t * (spreadL + lean)) - k,
      xr = Math.round(xr0 + lean + t * (spreadR - lean)) - k;
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / Math.max(1, xr - xl);
      p.set(x, y, x === xl ? ramp[2] : u < 0.35 ? ramp[1] : ramp[0]);
    }
  }
}

// Perna de 2 px do quadril (hx, top) até o pé (hx+dx, FEET−lift). Erguida, o joelho
// vai à frente e a canela pende (dobra de verdade, não só encurta); bend dobra o
// joelho com o pé no chão (agachar). Devolve o pé.
function legPx(p, hx, top, st, col, dark) {
  const fy = FEET - st.lift;
  const fx = hx + st.dx;
  const ky = Math.round((top + fy) / 2);
  const kx = hx + Math.round(st.dx / 2) + (st.lift ? 1 : 0) + (st.bend ?? 0);
  const seg = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      const x = x0 + Math.round(((x1 - x0) * (y - y0)) / Math.max(1, y1 - y0));
      p.set(x, y, col);
      p.set(x + 1, y, dark);
    }
  };
  seg(hx, top, kx, ky);
  seg(kx, ky, fx, fy);
  return [fx, fy];
}
// Pé apontando para a frente (só no chão: no ar a ponta cai)
function toe(p, [x, y], lift, col) {
  if (!lift) p.set(x + 2, y, col);
}
// Par de pernas: a de trás mais escura (profundidade), depois a da frente
function legs(p, top, q, sk, hxFar = 10, hxNear = 12) {
  const far = legPx(p, hxFar, top, q.far, sk.shade, sk.deep);
  toe(p, far, q.far.lift, sk.deep);
  const near = legPx(p, hxNear, top, q.near, sk.base, sk.shade);
  toe(p, near, q.near.lift, sk.shade);
}

// Braço de trás (atrás do tronco): só aparece quando balança para trás
function backArm(p, sx, sy, swing, col) {
  for (let k = 0; k <= 3; k++) p.set(sx + Math.round(swing * k * 0.7), sy + k, col);
}

// Arma vertical presa na mão, com balanço: topo (x, y0) → pé (x+dx, y1)
function pole(p, x, y0, y1, dx, colFn) {
  for (let y = y0; y <= y1; y++) p.set(x + Math.round((dx * (y - y0)) / Math.max(1, y1 - y0)), y, colFn(y));
}

// ---------------------------------------------------------------------------
// CURUPIRA — menino guardião da mata: cabelo em chamas, tanga de folhas, pés
// virados para TRÁS (apontam para a esquerda enquanto ele olha para a direita)
// ---------------------------------------------------------------------------
function drawCurupira(q) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, lean: L, f, trail } = q;
  const sk = SKIN;
  // Pernas + pés virados para trás (o rastro que engana os caçadores)
  const backFoot = ([x, y], col, heel) => {
    p.set(x - 1, y, col);
    p.set(x - 2, y, col);
    p.set(x - 1, y - 1, heel);
  };
  backFoot(legPx(p, 10, 19, q.far, sk.shade, sk.deep), sk.deep, sk.shade);
  backArm(p, 10 + L, 13 + b, q.arm, sk.shade);
  backFoot(legPx(p, 12, 19, q.near, sk.base, sk.shade), sk.shade, sk.base);
  // Corpo (pele) e tanga de folhas com barra serrilhada que tremula
  torso(p, 12 + b, 17, 9, 14, 0, 0, [sk.shade, sk.base, sk.light], L);
  for (let y = 16; y <= 20; y++)
    for (let x = 8; x <= 15; x++) {
      if (y === 20 && (x + f) % 2) continue;
      const xx = x - (y >= 19 ? Math.min(trail, 1) : 0);
      p.set(xx, y, y === 16 ? PAL.g3 : x < 10 ? PAL.g6 : x % 3 ? PAL.g5 : PAL.g4);
    }
  // Colar de sementes
  for (let x = 10; x <= 14; x++) p.set(x + L, 13 + b, x % 2 ? PAL.red2 : PAL.yel2);
  // Cajado com orbe de fogo (a arma dele): balança com o passo, o fogo tremula
  const sx = 19 + L,
    sy = 6 + hb;
  pole(p, sx, sy, FEET, -Math.round(q.arm), (y) => ((y - sy) % 4 ? PAL.n3 : PAL.n2));
  p.disc(sx + 0.5, sy - 2.5, f % 2 ? 2.6 : 2.3, PAL.org1);
  p.disc(sx + 0.2, sy - 2.8, 1.9, PAL.org2);
  p.set(sx - Math.min(trail, 1) + (f % 3 === 1 ? 1 : 0), sy - 4 - (f % 2), PAL.yel3);
  if (f % 4 === 2) p.set(sx - 1 - trail, sy - 5, PAL.org2); // fagulha que se solta
  // Braço segurando o cajado
  for (let x = 15; x <= 18; x++) p.set(x + L, 14 + b, sk.base);
  p.set(18 + L, 15 + b, sk.shade);
  // Cabeça
  head(p, 11.5 + L, 8.5 + b, 4, 3.8, sk);
  eye(p, 13 + L, 8 + b, q, sk);
  mouth(p, 14 + L, 10 + b, q, sk);
  // Cabelo em CHAMAS: cada ponta tremula num tempo; andando, as pontas dobram para trás
  const flame = [PAL.red1, PAL.org1, PAL.org2, PAL.yel3];
  const spikes = [
    [7, 3],
    [9, 1],
    [11, 0],
    [13, 1],
    [15, 3],
    [6, 6],
  ];
  for (const [x0, top] of spikes) {
    const t = top + ((f + x0) % 3 === 0 ? 1 : 0) + b;
    for (let y = t; y <= 7 + b; y++) {
      const k = Math.min(3, Math.floor((y - t) / 2));
      const x = x0 + L - Math.max(0, trail - (y - t));
      p.set(x, y, flame[3 - k]);
      p.set(x + 1, y, flame[Math.max(0, 2 - k)]);
    }
  }
  for (let x = 7; x <= 15; x++) p.set(x + L, 6 + b, x < 10 ? PAL.org2 : PAL.org1);
  p.set(7 + L, 7 + b, PAL.org1);
  p.set(7 + L, 8 + b, PAL.red1);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CAIPORA — protetora dos bichos: cabeleira longa de folhas e cipós, túnica de
// fibra trançada, colar de urucum, vara encantada (forquilha com folhas, brasa do fumo)
// ---------------------------------------------------------------------------
function drawCaipora(q) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, lean: L, f, trail } = q;
  const sk = SKIN_DARK;
  legs(p, 20, q, sk);
  backArm(p, 10 + L, 13 + b, q.arm, sk.shade);
  // Cabeleira de folhas descendo pelas costas: a ponta chega atrasada e voa para trás;
  // andando, as folhas farfalham (o padrão corre)
  const rustle = q.move ? f : 0;
  for (let y = 5 + b; y <= 20 + Math.max(0, hb - b); y++)
    for (let x = 5; x <= 9; x++) {
      if (x === 5 && y < 9 + b) continue;
      if (y > 17 && x > 7) continue;
      const dx = y < 12 + b ? L : L - trail - (y > 17 && trail > 1 ? 1 : 0);
      p.set(x + dx, y, (x + y + rustle) % 3 === 0 ? PAL.g6 : (x + y + rustle) % 3 === 1 ? PAL.g5 : PAL.g3);
    }
  // Túnica de fibra trançada (xadrez de palha)
  torso(p, 12 + b, 21, 9, 14, 1, 1, [PAL.n3, PAL.n4, PAL.yel1], L, Math.min(trail, 1));
  for (let y = 13 + b; y <= 21; y++)
    for (let x = 7; x <= 16; x++) if (p.get(x, y) && (x + y) % 4 === 0 && p.rgb(x, y) !== PAL.g3) p.set(x, y, PAL.n2);
  // Colar de urucum
  for (let x = 10; x <= 14; x++) p.set(x + L, 12 + b, x % 2 ? PAL.red2 : PAL.red1);
  // Vara encantada na mão: forquilha com folhas no alto, brasa do fumo no pé
  for (let x = 16; x <= 18; x++) p.set(x + L, 14 + b, sk.base);
  const v = hb,
    vx = 19 + L;
  for (let i = 0; i <= 11; i++) p.set(vx + Math.round(i * 0.18), 20 + v - i, i % 3 ? PAL.n3 : PAL.n4);
  p.set(vx + 1, 8 + v, PAL.n2); // forquilha
  p.set(vx + 3, 8 + v, PAL.n2);
  p.set(vx + 2, 7 + v - (f % 2), PAL.g5); // folhas que balançam
  p.set(vx, 7 + v, PAL.g6);
  p.set(vx + 3, 7 + v, PAL.g5);
  p.set(vx, 21 + v, f % 2 ? PAL.yel3 : PAL.org2); // brasa que pulsa
  p.set(vx, 22 + v, f % 2 ? PAL.org2 : PAL.yel3);
  // Cabeça
  head(p, 11.5 + L, 8.5 + b, 4, 3.8, sk);
  eye(p, 13 + L, 8 + b, q, sk);
  if (q.mouth === "open") mouth(p, 14 + L, 10 + b, q, sk);
  // Coroa de folhas por cima (a florzinha balança com atraso)
  for (let x = 7; x <= 15; x++) p.set(x + L, 4 + b, x % 2 ? PAL.g5 : PAL.g6);
  for (let x = 8; x <= 14; x += 2) p.set(x + L, 3 + b, PAL.g6);
  p.set(15 + L, 5 + b, PAL.g4);
  p.set(16 + L, 5 + hb, PAL.pink);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// IARA — senhora das águas: cabelo longo negro-azulado, concha, vestido de
// escamas que termina numa barra em forma de nadadeira (flutua: sem pés)
// ---------------------------------------------------------------------------
function drawIara(q) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, lean: L, f, trail } = q;
  const ph = q.ph * Math.PI * 2;
  // Cabelo longo atrás (até a cintura): ondula como debaixo d'água
  for (let y = 5 + b; y <= 18 + Math.max(0, hb - b); y++)
    for (let x = 6; x <= 10; x++) {
      if (x === 6 && y < 8 + b) continue;
      const low = y >= 12 + b;
      const dx = low ? L - trail + Math.round(Math.sin(y * 0.7 - ph) * 0.6) : L;
      p.set(x + dx, y, x === 7 && y % 3 === 0 ? PAL.ice1 : y % 4 === 1 ? PAL.pur0 : PAL.ice0);
    }
  // Vestido de escamas (turquesa → azul) abrindo em nadadeira; as escamas cintilam
  torso(p, 12 + b, 23, 9, 14, 2, 2, [PAL.ice1, PAL.ice2, PAL.ice3], L, Math.min(trail, 1));
  const shim = q.move ? f : f >> 1;
  for (let y = 13 + b; y <= 23; y++)
    for (let x = 6; x <= 17; x++) if (p.get(x, y) && (x + (y % 2) + shim) % 3 === 0) p.set(x, y, 0x4a8fd0);
  // Nadadeira: as duas pontas batem alternadas
  const flap = q.move ? (f >> 1) % 2 : (f >> 1) % 2;
  const fin = (x0, dir, up) => {
    for (let k = 0; k < 3; k++) {
      p.set(x0 + dir * k, 24 + (k === 2 && !up ? 1 : 0) - (k === 2 && up ? 1 : 0), k === 2 ? PAL.ice3 : PAL.ice2);
      p.set(x0 + dir * k, 25, k ? PAL.ice1 : PAL.ice2);
    }
  };
  fin(10 - Math.min(trail, 1), -1, flap === 0);
  fin(13 - Math.min(trail, 1), 1, flap === 1);
  // Gotinhas que sobem em volta dela
  p.set(3 - trail, 18 - ((f * 2) % 6), PAL.ice3);
  p.set(19, 22 - (f % 4), PAL.ice3);
  // Braço estendido com a aura de gelo girando na mão
  for (let x = 15; x <= 18; x++) p.set(x + L, 14 + b, SKIN.base);
  const ax = 20 + L,
    ay = 14 + hb;
  const ring = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const cols = [PAL.ice3, PAL.white, PAL.ice2];
  for (let k = 0; k < 3; k++) {
    const [ox, oy] = ring[(k + f) % 4];
    p.set(ax + ox, ay + oy, cols[k]);
  }
  // Cabeça
  head(p, 11.5 + L, 8.5 + b, 4, 3.8, SKIN);
  eye(p, 13 + L, 8 + b, q, SKIN);
  mouth(p, 13 + L, 10 + b, q, SKIN);
  // Franja e topo do cabelo
  for (let x = 8; x <= 15; x++) p.set(x + L, 4 + b, x > 13 ? PAL.ice0 : PAL.pur0);
  for (let x = 8; x <= 12; x++) p.set(x + L, 5 + b, PAL.ice0);
  p.set(15 + L, 5 + b, PAL.ice0);
  // Concha no cabelo
  p.set(9 + L, 4 + b, PAL.pink);
  p.set(10 + L, 4 + b, PAL.cream);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// SACI — uma perna só, gorro vermelho, bermuda vermelha; pula em vez de andar;
// um redemoinho de vento gira em volta do pé. Sorriso confiante, sem cachimbo.
// ---------------------------------------------------------------------------
function drawSaci(q) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, lean: L, f, trail } = q;
  const sk = SKIN_DARK;
  // Redemoinho de VENTO no chão (gira; fica embaixo enquanto ele pula)
  const whirl = [PAL.wnd1, PAL.wnd2, PAL.wnd3];
  const air = q.near.lift;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + f * 0.9;
    const x = Math.round(12 + Math.cos(a) * (5 + air * 0.5)),
      y = Math.round(24 + Math.sin(a) * 1.6);
    p.set(x, y, whirl[k % 3]);
  }
  // Uma perna só: agachado o joelho vai à frente; no ar ela estica
  const foot = legPx(p, 11, 19 + b, q.near, sk.base, sk.shade);
  p.set(foot[0] + 2, foot[1], sk.base); // pé
  // Bermuda vermelha
  for (let y = 16 + b; y <= 19 + b; y++) for (let x = 9; x <= 14; x++) p.set(x, y, x === 9 ? PAL.red3 : x < 12 ? PAL.red2 : PAL.red1);
  // Braço de trás e tronco (pele) magro
  backArm(p, 10 + L, 12 + b, q.arm, sk.shade);
  torso(p, 11 + b, 15 + b, 9, 14, 0, 0, [sk.shade, sk.base, sk.light], L);
  // Braço erguido soltando uma lufada que sai em espiral
  p.set(15 + L, 12 + b, sk.base);
  p.set(16 + L, 11 + b, sk.base);
  p.set(17 + L, 10 + b, sk.base);
  const g = f % 3;
  p.set(18 + L + (g > 1 ? 1 : 0), 9 + b - g, PAL.wnd3);
  p.set(19 + L + g, 8 + b - (g >> 1), PAL.white);
  p.set(18 + L, 7 + b - g, PAL.wnd2);
  // Cabeça
  head(p, 11.5 + L, 7.5 + b, 3.8, 3.6, sk);
  eye(p, 13 + L, 7 + b, q, sk);
  if (q.mouth === "open") mouth(p, 14 + L, 9 + b, q, sk);
  else {
    p.set(14 + L, 9 + b, sk.shade); // sorriso de canto, discreto como nos outros
    p.set(13 + L, 9 + b, sk.light);
  }
  // Gorro vermelho; a ponta chega atrasada e voa para trás nos pulos
  const cap = [PAL.red1, PAL.red2, PAL.red3];
  for (let x = 8; x <= 15; x++) p.set(x + L, 4 + b, x < 10 ? cap[2] : cap[1]);
  for (let x = 8; x <= 14; x++) p.set(x + L, 3 + b, cap[1]);
  for (let x = 7; x <= 12; x++) p.set(x + L, 2 + b, x < 9 ? cap[2] : cap[1]);
  const lag = Math.max(-1, Math.min(1, hb - b));
  const tail =
    trail > 1
      ? [[6, 2], [5, 2], [4, 2 + lag], [3, 3 + lag]] // esvoaçando
      : trail
        ? [[6, 2], [5, 3], [4, 3 + lag], [3, 4 + lag]]
        : [[6, 2], [5, 3], [4, 4 + lag], [4, 5 + lag]]; // caído
  tail.forEach(([x, y], i) => p.set(x + L, y + b, i < 2 ? cap[1] : cap[0]));
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// COMADRE FULOZINHA — cabocla miúda do Nordeste: cabelo negro comprido até o
// chão, vestido branco, flor no cabelo e um ramo de urtiga na mão
// ---------------------------------------------------------------------------
const HAIR_BLACK = [0x1c1824, 0x2c2638, 0x3e3650];
function drawFulozinha(q) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, lean: L, f, trail } = q;
  // Cabelo comprido atrás, quase até os pés: a ponta esvoaça e balança com o passo
  const sway = q.move ? trail + ((f >> 1) % 2) : Math.max(0, hb - b);
  for (let y = 5 + b; y <= 25; y++)
    for (let x = 5; x <= 10; x++) {
      if (x === 5 && y < 9 + b) continue;
      if (y > 21 && x === 10) continue;
      const dx = y < 12 + b ? L : y > 18 ? L - sway : L - Math.min(trail, 1);
      p.set(x + dx, y, x === 7 && y % 3 === 0 ? HAIR_BLACK[2] : y % 4 === 1 ? HAIR_BLACK[1] : HAIR_BLACK[0]);
    }
  // Pés descalços aparecendo sob o vestido
  legs(p, 23, q, SKIN);
  backArm(p, 10 + L, 13 + b, q.arm, SKIN.shade);
  // Vestido branco (rodado, barra rendada que balança)
  torso(p, 12 + b, 22, 9, 14, 2, 2, [PAL.cream, PAL.white, PAL.white], L, Math.min(trail, 1));
  for (let x = 5; x <= 17; x++) if (p.get(x, 22) && p.rgb(x, 22) !== HAIR_BLACK[0] && (x + (q.move ? f >> 1 : 0)) % 2) p.set(x, 22, PAL.s3);
  for (let y = 15 + b; y <= 21; y += 3) p.set(12 + (y < 18 ? L : 0), y, PAL.s4); // dobras
  // Braço com o ramo de urtiga (folhas serrilhadas e florzinhas brancas)
  for (let x = 15; x <= 18; x++) p.set(x + L, 14 + b, SKIN.base);
  const rx = 19 + L,
    ry = hb;
  for (let y = 6 + ry; y <= 19 + b; y++) p.set(rx, y, PAL.g3);
  for (let i = 0; i < 5; i++) {
    const y = Math.round(7 + ry + i * 2.5);
    const w = q.move && (i + f) % 2 ? 1 : 0; // folhas tremem ao andar
    p.set(rx + 1, y - w, PAL.g5);
    p.set(rx + 2, y + 1, PAL.g4);
    p.set(rx - 1, y + 1 - w, PAL.g5);
  }
  p.set(rx + 1, 5 + ry, PAL.cream);
  p.set(rx - 1, 8 + ry, PAL.cream);
  // Cabeça
  head(p, 11.5 + L, 8.5 + b, 4, 3.8, SKIN);
  eye(p, 13 + L, 8 + b, q, SKIN);
  mouth(p, 13 + L, 10 + b, q, SKIN);
  // Cabelo por cima (franja) + flor
  for (let x = 8; x <= 15; x++) p.set(x + L, 4 + b, x > 13 ? HAIR_BLACK[1] : HAIR_BLACK[0]);
  for (let x = 8; x <= 12; x++) p.set(x + L, 5 + b, HAIR_BLACK[0]);
  p.set(15 + L, 5 + b, HAIR_BLACK[0]);
  p.set(9 + L, 3 + b, PAL.pink);
  p.set(10 + L, 3 + b, PAL.yel3);
  p.set(11 + L, 3 + b, PAL.pink);
  p.set(10 + L, 2 + b, PAL.pink);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// MÃE-DO-OURO — guardiã das serras: cabelo dourado longo, vestido de seda
// branca; flutua (luz dourada sob a barra) com a bola de fogo de ouro na mão
// ---------------------------------------------------------------------------
const GOLD_HAIR = [PAL.yel1, PAL.yel2, PAL.yel3];
function drawMaeDoOuro(q) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, lean: L, f, trail } = q;
  const ph = q.ph * Math.PI * 2;
  // Cabelo dourado longo atrás, em ondas que correm para baixo
  for (let y = 5 + b; y <= 21 + Math.max(0, hb - b); y++)
    for (let x = 5; x <= 10; x++) {
      if (x === 5 && y < 9 + b) continue;
      const w = Math.round(Math.sin(y * 0.7 - ph) * 0.6);
      const dx = y < 12 + b ? L : L - trail + w;
      p.set(x + dx, y, (x + y) % 4 === 0 ? GOLD_HAIR[2] : x < 8 ? GOLD_HAIR[1] : GOLD_HAIR[0]);
    }
  // Vestido de seda até o chão (flutua: sem pés)
  torso(p, 12 + b, 24, 9, 14, 2, 3, [PAL.cream, PAL.white, PAL.white], L, Math.min(trail, 1));
  for (let y = 15 + b; y <= 24; y++) if (p.get(15, y)) p.set(15, y, PAL.s4); // sombra da seda
  for (let y = 14 + b; y <= 24; y++) if (y % 3 === 0) p.set(11 + (y < 18 ? L : 0), y, PAL.white);
  for (let x = 6; x <= 17; x++) if (p.get(x, 24) && (x + f) % 2) p.set(x, 24, PAL.yel3); // barra de ouro que cintila
  // Luz dourada sob a barra (ela não pisa no chão): pisca em três tempos
  const fl = f % 3;
  p.set(10 - (q.move ? 1 : 0), 26, fl === 0 ? PAL.yel3 : PAL.yel2);
  p.set(12, 27 - (fl === 1 ? 1 : 0), PAL.yel3);
  p.set(14, 26, fl === 2 ? PAL.yel3 : PAL.yel2);
  // Braço estendido com a bola de fogo de ouro (pulsa; fagulhas sobem)
  for (let x = 15; x <= 18; x++) p.set(x + L, 14 + b, SKIN.base);
  const bx = 20 + L,
    by = 12 + hb;
  p.disc(bx, by, 2.6, PAL.org2);
  p.disc(bx - (f % 2) * 0.3, by - (f % 2) * 0.3, f % 2 ? 1.5 : 1.9, PAL.yel2);
  p.set(bx, by, PAL.white);
  p.set(bx - 1 + (f % 2), by - 3 - (f % 3 === 2 ? 1 : 0), PAL.yel3);
  p.set(bx + 1 - (f % 2) - trail, by - 4 - (f % 3 === 0 ? 1 : 0), PAL.org2);
  // Cabeça
  head(p, 11.5 + L, 8.5 + b, 4, 3.8, SKIN);
  eye(p, 13 + L, 8 + b, q, SKIN);
  mouth(p, 13 + L, 10 + b, q, SKIN);
  // Topo do cabelo dourado + diadema
  for (let x = 8; x <= 15; x++) p.set(x + L, 4 + b, x > 13 ? GOLD_HAIR[0] : GOLD_HAIR[1]);
  for (let x = 8; x <= 12; x++) p.set(x + L, 5 + b, GOLD_HAIR[0]);
  p.set(15 + L, 5 + b, GOLD_HAIR[0]);
  p.set(11 + L, 3 + b, PAL.white);
  p.set(12 + L, 3 + b, PAL.yel3);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// ANHANGÁ — o veado branco protetor da caça: pelo branco, galhada coberta de
// pelo, olhos de fogo. Quadrúpede (anda de lado, virado para a direita); a
// caminhada é a dos veados: cada pata num tempo (trás, frente, trás, frente).
// ---------------------------------------------------------------------------
const DEER = [PAL.s3, PAL.s4, PAL.cream, PAL.white]; // sombra → luz
function drawAnhanga(q, kind) {
  const p = new Pix(HERO_W, HERO_H);
  const { b, hb, f } = q;
  const L = Math.max(0, q.lean - 1); // só estica o pescoço no dash
  const ell = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx,
          dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const l = -dx * 0.35 - dy * 0.85;
        p.set(x, y, l > 0.45 ? DEER[3] : l > -0.15 ? DEER[2] : l > -0.6 ? DEER[1] : DEER[0]);
      }
  };
  // Patas finas. Traseiras com jarrete (dobram para trás); dianteiras retas. A canela
  // vai à frente/atrás (dx) e o casco sobe (lift) na pata que está no ar.
  const hind = (x, st, near) => {
    const c = near ? DEER[2] : DEER[0];
    for (let y = 17; y <= 21; y++) p.set(x + (y > 19 ? -1 : 0), y, c);
    const fy = FEET - st.lift;
    for (let y = 22; y <= fy; y++) p.set(x - 1 + Math.round((st.dx * (y - 21)) / Math.max(1, fy - 21)), y, c);
    p.set(x - 1 + st.dx, fy, PAL.n2);
  };
  const fore = (x, st, near) => {
    const c = near ? DEER[2] : DEER[0];
    const fy = FEET - st.lift;
    for (let y = 17; y <= fy; y++) p.set(x + (y > 20 ? Math.round((st.dx * (y - 20)) / Math.max(1, fy - 20)) : 0), y, c);
    p.set(x + st.dx, fy, PAL.n2);
  };
  const g = q.gait; // [traseira longe, dianteira longe, traseira perto, dianteira perto]
  hind(6, g[0], false);
  fore(17, g[1], false);
  hind(8, g[2], true);
  fore(15, g[3], true);
  // Corpo + peito mais fundo na frente (respira devagar)
  ell(11, 15 + b * 0.5, 7.2, 3.2);
  ell(15.5, 15 + b * 0.5, 3, 3.6);
  // Rabinho branco erguido (abana na "piscada")
  const wag = q.eyes === "closed" ? -1 : 0;
  p.set(4, 13 + hb + wag, DEER[3]);
  p.set(3 + (wag ? 1 : 0), 12 + hb + wag, DEER[3]);
  // Pescoço curto, inclinado para a frente; a cabeça acena com o passo
  const hy = b + (q.move ? hb : 0);
  for (let i = 0; i < 4; i++) {
    const x = 16 + i + (i > 1 ? L : 0),
      y = 13 + b - i + (i > 2 ? hy - b : 0);
    p.set(x, y, DEER[3]);
    if (L) p.set(x - 1, y, DEER[3]); // pescoço esticado sem degrau solto
    p.set(x + 1, y, DEER[2]);
    p.set(x + 1, y + 1, DEER[1]);
  }
  // Cabeça com focinho
  ell(20 + L, 8 + hy, 2.4, 1.9);
  for (const [x, y] of [[22, 8], [23, 8], [22, 9], [23, 9]]) p.set(x + L, y + hy, DEER[1]);
  p.set(23 + L, 8 + hy, PAL.s2); // focinho
  // Olho de FOGO (tremula)
  p.set(20 + L, 7 + hy, kind === "hurt" ? PAL.white : f % 2 ? PAL.yel3 : PAL.org2);
  // Orelha para trás (mexe na "piscada")
  p.set(18 + L, 6 + hy - (wag ? 1 : 0), DEER[2]);
  p.set(17 + L, 6 + hy - (wag ? 1 : 0), DEER[1]);
  // Galhada coberta de pelo, ramificada e varrendo para trás (pontas claras)
  // (pixels encostados em escada: sem diagonais soltas, o contorno não vira xadrez)
  const ant = [
    [19, 5], [19, 4], [18, 4], [18, 3], [17, 3], [17, 2], [16, 2], [16, 1], // haste de trás
    [18, 2], [18, 1], // galho
    [21, 5], [21, 4], [22, 4], [22, 3], [22, 2], [23, 2], // haste da frente
    [21, 2], [21, 1], // galho
  ];
  for (const [x, y] of ant) p.set(x + L, y + hy, y <= 2 ? DEER[3] : DEER[2]);
  // Fiapos de névoa (é um espírito)
  const wisp = (f * 3) % 6;
  p.set(1 + (wisp % 3), 17 - (wisp >> 1), PAL.ice3);
  p.set(21, 17 + (f % 3), PAL.ice3);
  p.outline(PAL.ink);
  return p;
}
// Patas do veado em cada pose (andar de quatro tempos: cada pata 1/4 de ciclo depois)
const STILL = { dx: 0, lift: 0 };
function deerGait(q, kind) {
  if (kind === "walk") return [0, 2, 4, 6].map((o) => leg(q.f + o + 4)).map((s) => ({ dx: s.dx > 0 ? Math.min(s.dx, 1) : s.dx, lift: Math.min(s.lift, 1) }));
  if (kind === "dash") return [{ dx: -2, lift: 1 }, { dx: 2, lift: 1 }, { dx: -1, lift: 0 }, { dx: 2, lift: 2 }];
  if (kind === "hurt") return [{ dx: 1, lift: 0 }, { dx: -1, lift: 0 }, STILL, { dx: -1, lift: 1 }];
  return [{ dx: -1, lift: 0 }, STILL, { dx: 1, lift: 0 }, STILL];
}

// Um desenho por guardião (id = CHARACTERS[].id). O verificador confere que todo
// guardião da config tem desenho aqui e poses em HeroRig.js. `walk`/`dash` trocam o
// ciclo de quem não anda com dois pés.
const DRAW = {
  guardian: { draw: drawCurupira },
  huntress: { draw: drawCaipora },
  druid: { draw: drawIara, walk: GLIDE },
  shaman: { draw: drawSaci, walk: HOP, dash: SACI_DASH },
  fulozinha: { draw: drawFulozinha },
  maedoouro: { draw: drawMaeDoOuro, walk: GLIDE },
  anhanga: { draw: (q, kind) => drawAnhanga({ ...q, gait: deerGait(q, kind) }, kind) },
};
export const HERO_IDS = Object.keys(DRAW);

// Os 15 quadros de um guardião, na ordem de HERO_FRAMES (também usado pelas
// ferramentas de folha de contato)
export function heroFrames(id) {
  const d = DRAW[id];
  const seq = [
    ...IDLE.map((q) => [q, "idle"]),
    [BLINK, "idle"],
    ...(d.walk ?? WALK).map((q) => [q, "walk"]),
    [d.dash ?? DASH, "dash"],
    [HURT, "hurt"],
  ];
  return seq.map(([q, kind]) => d.draw(q, kind));
}

// Pisadas: quadros da caminhada em que o pé (ou o pulo) toca o chão e o que sobe dali
// (poeira; quem flutua solta gotas/brilho). O Player solta o efeito nesses quadros.
const W0 = HERO_FRAMES.walk[0];
export const HERO_STEPS = {
  guardian: { frames: [W0, W0 + 4], kind: "dust", back: true }, // pés virados: a poeira vai para a frente
  huntress: { frames: [W0, W0 + 4], kind: "dust" },
  druid: { frames: [W0 + 3], kind: "drop" },
  shaman: { frames: [W0 + 7], kind: "land" },
  fulozinha: { frames: [W0, W0 + 4], kind: "dust" },
  maedoouro: { frames: [W0 + 3], kind: "glint" },
  anhanga: { frames: [W0, W0 + 4], kind: "dust" },
};

// Registra hero_<id> (15 quadros) + animações <id>_idle / _walk / _dash / _hurt.
// A respiração tem tempos próprios por quadro e uma piscada a cada ~4 s.
export function registerHeroes(scene) {
  const [A, B, C, D] = HERO_FRAMES.idle;
  const breath = [[A, 520], [B, 200], [C, 520], [D, 200]];
  const idleSeq = [...breath, ...breath, [A, 300], [HERO_FRAMES.blink, 110], [A, 200], [B, 200], [C, 520], [D, 200], ...breath];
  for (const id of HERO_IDS) {
    const tex = `hero_${id}`;
    registerStrip(scene, tex, heroFrames(id));
    const mk = (key, cfg) => {
      if (!scene.anims.exists(key)) scene.anims.create({ key, repeat: -1, ...cfg });
    };
    mk(`${id}_idle`, { frames: idleSeq.map(([frame, duration]) => ({ key: tex, frame, duration })), frameRate: 5 });
    const hop = DRAW[id].walk === HOP,
      glide = DRAW[id].walk === GLIDE;
    mk(`${id}_walk`, { frames: scene.anims.generateFrameNumbers(tex, { frames: HERO_FRAMES.walk }), frameRate: glide ? 9 : hop ? 13 : 12 });
    mk(`${id}_dash`, { frames: [{ key: tex, frame: HERO_FRAMES.dash }], frameRate: 1 });
    mk(`${id}_hurt`, { frames: [{ key: tex, frame: HERO_FRAMES.hurt }], frameRate: 1 });
  }
}
