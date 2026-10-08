// Fogo desenhado quadro a quadro para a reação LABAREDA (fogo + vento). Nada de
// partícula redonda esticada: cada quadro é pintado pixel a pixel a partir de um
// campo de calor (ruído periódico que SOBE entre quadros), com a rampa de fogo da
// paleta (vinho → vermelho → laranja → amarelo → branco no miolo).
//   fx_whirl  — redemoinho de fogo: irrompe do chão, gira (faixas em espiral), o vento
//               o abraça em arcos e ele se desprende do chão e se desfaz no alto
//   fx_ignite — a chama que "pega" no vizinho: lambe para cima e morre
//   fx_wisp   — língua de fogo levada pelo vento (cabeça à direita, cauda tremulando)
import { PAL } from "./Palette.js";
import { Pix, registerStrip, tileNoise, bayer, rng } from "./PixelArt.js";

const smooth = (a, b, t) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
// Calor → cor. O vinho só aparece pontilhado (borda que se desfaz em fumaça quente)
function fireCol(I, x, y) {
  if (I > 1.02) return PAL.white;
  if (I > 0.84) return PAL.yel3;
  if (I > 0.66) return PAL.yel2;
  if (I > 0.48) return PAL.org2;
  if (I > 0.32) return PAL.org1;
  if (I > 0.18) return PAL.red1;
  if (I > 0.08 && bayer(x, y) < 0.5) return PAL.red0;
  return null;
}

export const WHIRL_W = 44,
  WHIRL_H = 64;
const WG = WHIRL_H - 3; // linha do chão dentro do quadro
// Linha do tempo (12 quadros): altura, base solta do chão, calor e largura
const W_GROW = [0.22, 0.5, 0.82, 1, 1, 1, 1, 1, 0.96, 0.88, 0.74, 0.56];
const W_LIFT = [0, 0, 0, 0, 0, 0, 0, 0.04, 0.14, 0.3, 0.48, 0.66];
const W_HEAT = [1.45, 1.3, 1.18, 1.08, 1.02, 1, 1, 0.97, 0.88, 0.76, 0.62, 0.48];
const W_WIDE = [0.75, 0.95, 1.08, 1.02, 1, 1, 1, 0.98, 0.92, 0.84, 0.74, 0.62];

function whirl(f) {
  const p = new Pix(WHIRL_W, WHIRL_H);
  const n1 = tileNoise(WHIRL_W, 64, 8, 31),
    n2 = tileNoise(WHIRL_W, 64, 4, 57);
  const grow = W_GROW[f],
    lift = W_LIFT[f],
    heat = W_HEAT[f],
    wide = W_WIDE[f];
  const H = WHIRL_H * 0.92;
  const scroll = f * 5; // o ruído sobe 5 px por quadro: as línguas correm para cima
  // Centro da coluna em cada altura: um S que gira com o tempo (o "torcido" do redemoinho)
  const cxAt = (h) => WHIRL_W / 2 + Math.sin(h * 6.5 - f * 0.95) * (0.6 + h * 3.2);
  const wAt = (h) => wide * (4.2 + h * 7.5) * (1 - smooth(grow * 0.7, grow, h) * 0.7);
  for (let y = 0; y < WHIRL_H; y++) {
    const h = (WG - y) / H; // 0 no chão, 1 no topo
    if (h < -0.04) continue;
    const cx = cxAt(Math.max(0, h)),
      w = Math.max(1.2, wAt(Math.max(0, h)));
    for (let x = 0; x < WHIRL_W; x++) {
      const n = 0.62 * n1(x, (y + scroll) & 63) + 0.38 * n2(x, (y + scroll * 1.6) & 63);
      // topo e base irregulares (línguas que sobem; a base se solta quando morre)
      const top = grow + (n - 0.5) * 0.28;
      const bot = lift + (n - 0.5) * 0.18;
      if (h > top || h < bot) continue;
      const u = (x + 0.5 - cx) / w; // −1 … 1 de borda a borda
      let I = (1 - Math.pow(Math.abs(u), 1.6)) * heat + (n - 0.5) * 0.85;
      I -= Math.max(0, h - grow * 0.55) * 0.9; // esfria no alto
      I -= Math.max(0, bot + 0.1 - h) * 2.2; // e na base que se desprende
      // Faixas em espiral (o giro): escura e, logo atrás, um fio claro
      const band = (((h * 8.5 - u * 0.95 - f * 0.42) % 1) + 1) % 1;
      if (band < 0.13) I -= 0.26;
      else if (band > 0.5 && band < 0.6) I += 0.14;
      // Saia de fogo rente ao chão nos primeiros quadros (o pé do redemoinho)
      if (h < 0.08 && f < 9) I += (1 - Math.abs((x + 0.5 - WHIRL_W / 2) / (w + 5))) * 0.5 * (1 - h / 0.08);
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  }
  // Vento abraçando a coluna: três arcos que giram (a parte de trás some atrás do fogo)
  if (f >= 1 && f <= 10) {
    const fade = f >= 9 ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const h = (0.22 + k * 0.25) * grow;
      const y0 = WG - h * H;
      const rw = wAt(h) + 4 + k * 0.5,
        ry = rw * 0.32;
      const a0 = f * 0.85 + k * 2.1;
      const len = 2.6 - fade * 1;
      for (let a = a0; a < a0 + len; a += 0.12) {
        const x = Math.round(cxAt(h) + Math.cos(a) * rw),
          y = Math.round(y0 + Math.sin(a) * ry);
        const t = (a - a0) / len; // 0 = cauda, 1 = cabeça
        const front = Math.sin(a) > -0.15;
        if (!front && p.get(x, y)) continue; // atrás da chama
        const c = t > 0.8 ? PAL.white : t > 0.45 ? PAL.wnd3 : t > 0.2 ? PAL.wnd2 : bayer(x, y) < 0.6 ? PAL.wnd1 : null;
        if (c != null) {
          p.set(x, y, c);
          if (t > 0.55 && front) p.set(x, y + 1, t > 0.8 ? PAL.wnd3 : PAL.wnd2); // corpo da lufada
        }
      }
    }
  }
  // Fagulhas soltas acima da chama (sobem e ficam para trás)
  const r = rng(900 + f);
  for (let i = 0; i < 5; i++) {
    const h = grow * (0.7 + r() * 0.45);
    const y = Math.round(WG - h * H - r() * 6);
    const x = Math.round(cxAt(Math.min(1, h)) + (r() - 0.5) * 14);
    if (y > 0 && !p.get(x, y)) p.set(x, y, r() < 0.4 ? PAL.yel3 : PAL.org2);
  }
  return p;
}

// Chama que pega num inimigo (18×26, 8 quadros): lambe para cima e morre
export const IGNITE_W = 22,
  IGNITE_H = 26;
const I_GROW = [0.35, 0.75, 1, 1, 0.92, 0.78, 0.58, 0.36];
const I_HEAT = [1.4, 1.22, 1.08, 1, 0.92, 0.82, 0.7, 0.55];
function ignite(f) {
  const p = new Pix(IGNITE_W, IGNITE_H);
  const n1 = tileNoise(IGNITE_W, 32, 4, 77),
    n2 = tileNoise(IGNITE_W, 32, 2, 13);
  const G = IGNITE_H - 2,
    H = IGNITE_H * 0.9;
  const grow = I_GROW[f],
    heat = I_HEAT[f],
    lift = Math.max(0, (f - 4) * 0.1);
  for (let y = 0; y < IGNITE_H; y++) {
    const h = (G - y) / H;
    if (h < -0.03) continue;
    const cx = IGNITE_W / 2 + Math.sin(h * 5 - f * 1.1) * h * 2;
    const w = (4.6 + h * 2.2) * (1 - smooth(grow * 0.5, grow, h) * 0.8);
    for (let x = 0; x < IGNITE_W; x++) {
      const n = 0.6 * n1(x, (y + f * 4) & 31) + 0.4 * n2(x, (y + f * 6) & 31);
      if (h > grow + (n - 0.5) * 0.35 || h < lift + (n - 0.5) * 0.15) continue;
      let I = (1 - Math.pow(Math.abs((x + 0.5 - cx) / Math.max(1, w)), 1.5)) * heat + (n - 0.5) * 0.9 - Math.max(0, h - grow * 0.5) * 0.9;
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  }
  return p;
}

// Língua de fogo (16×9, 4 quadros): cabeça clara à direita, cauda que ondula
export const WISP_W = 22,
  WISP_H = 11;
function wisp(f) {
  const p = new Pix(WISP_W, WISP_H);
  const n1 = tileNoise(32, 16, 4, 101);
  const hx = WISP_W - 4,
    cy = (WISP_H - 1) / 2;
  for (let y = 0; y < WISP_H; y++)
    for (let x = 0; x < WISP_W; x++) {
      const d = hx - x; // distância atrás da cabeça
      const len = WISP_W - 4;
      const t = Math.max(0, d) / len; // 0 cabeça … 1 ponta
      const r = d < 0 ? 4 + d * 1.1 : 4 * Math.pow(1 - t, 0.7);
      const yc = cy + Math.sin(d * 0.75 - f * 1.6) * t * 1.6;
      const n = n1((x + f * 8) & 31, y);
      let I = (1 - Math.abs(y + 0.5 - yc - 0.5) / Math.max(0.6, r)) * (1.35 - t * 0.7) + (n - 0.5) * 0.7;
      if (t > 0.98) continue;
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  return p;
}

// Jato de fogo do Sopro (60×88, 8 quadros), bocal em (JET_X0, meio) apontando para a
// DIREITA: acende no bocal, estica até o fim do cone, tremula com línguas que correm
// para fora e se solta do bocal esfriando. Desenhado no ângulo do cone do Sopro
// (JET_HALF); o Inferno estica na vertical para o cone dele.
export const JET_W = 60,
  JET_H = 88,
  JET_X0 = 2,
  JET_LEN = 55, // comprimento do cone em pixels do quadro (o jogo escala até o alcance)
  JET_HALF = 0.62;
const J_REACH = [0.22, 0.5, 0.82, 1, 1, 1, 0.96, 0.9];
const J_LIFT = [0, 0, 0, 0, 0, 0.12, 0.34, 0.58];
const J_HEAT = [1.5, 1.35, 1.22, 1.12, 1.06, 1, 0.86, 0.68];
function jet(f) {
  const p = new Pix(JET_W, JET_H);
  const n1 = tileNoise(64, JET_H, 8, 211),
    n2 = tileNoise(64, JET_H, 4, 223);
  const cy = JET_H / 2;
  const tanH = Math.tan(JET_HALF);
  for (let x = 0; x < JET_W; x++) {
    const u = (x - JET_X0) / JET_LEN; // 0 bocal … 1 fim do cone
    if (u < -0.02) continue;
    // o cone incha logo depois do bocal (fogo não é triângulo) e afina na ponta
    const hw = Math.max(1.2, tanH * Math.max(0, x - JET_X0) * (0.62 + 0.38 * Math.sqrt(Math.max(0, u))) * (1 - smooth(0.8, 1.05, u) * 0.55) + 1.4);
    for (let y = 0; y < JET_H; y++) {
      // ruído correndo para FORA (as línguas saem do bocal)
      const n = 0.6 * n1((x - f * 7 + 640) & 63, y) + 0.4 * n2((x - f * 11 + 640) & 63, y);
      const v = (y + 0.5 - cy) / hw;
      if (Math.abs(v) > 1.25) continue;
      // frente e base ARREDONDADAS: o meio do jato vai mais longe que as bordas
      const reach = J_REACH[f] + (n - 0.5) * 0.22 - v * v * 0.3,
        lift = J_LIFT[f] + (n - 0.5) * 0.16 + v * v * 0.22;
      if (u > reach || u < lift) continue;
      let I = (1 - Math.pow(Math.abs(v), 1.5)) * (J_HEAT[f] - u * 0.45) + (n - 0.5) * 0.85;
      if (u > reach - 0.12) I -= (u - reach + 0.12) * 2.5; // a frente do jato esfria
      I -= Math.max(0, lift + 0.12 - u) * 2.4; // e a base que se solta
      // miolo branco perto do bocal nos primeiros quadros (a chama "acende")
      if (u < 0.18 && f < 5) I += (0.18 - u) * 2.2 * (1 - Math.abs(v));
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  }
  // fagulhas soltas à frente do jato
  const r = rng(400 + f);
  for (let i = 0; i < 6; i++) {
    const u = J_REACH[f] * (0.75 + r() * 0.4);
    const x = Math.round(JET_X0 + u * JET_LEN),
      y = Math.round(cy + (r() - 0.5) * tanH * u * JET_LEN * 1.6);
    if (x < JET_W && !p.get(x, y)) p.set(x, y, r() < 0.5 ? PAL.yel3 : PAL.org2);
  }
  return p;
}

// Fogo baixo no chão (18×16, 8 quadros em laço sem emenda: o ruído sobe 2 px por quadro
// num período de 16) — rastro do Boitatá e do Inferno
export const GFIRE_W = 18,
  GFIRE_H = 16;
function groundFire(f) {
  const p = new Pix(GFIRE_W, GFIRE_H);
  const n1 = tileNoise(GFIRE_W + 2, 16, 4, 301),
    n2 = tileNoise(GFIRE_W + 2, 16, 2, 307);
  const G = GFIRE_H - 2;
  for (let y = 0; y < GFIRE_H; y++)
    for (let x = 0; x < GFIRE_W; x++) {
      const u = (x + 0.5 - GFIRE_W / 2) / (GFIRE_W / 2); // −1 … 1
      const h = (G - y) / 12; // 0 no chão … 1 no alto
      if (h < -0.1) continue;
      const n = 0.6 * n1(x, (y + f * 2) & 15) + 0.4 * n2(x, (y + f * 2) & 15);
      // três línguas (cosseno) de alturas diferentes
      const tongue = 0.42 + 0.58 * Math.abs(Math.cos(u * 4.2 + Math.sin(f * 0.785) * 0.35)) * (1 - Math.abs(u) * 0.35);
      const top = tongue * (1 - u * u * 0.6) + (n - 0.5) * 0.45;
      if (h > top) continue;
      const I = (1 - Math.abs(u)) * 1.1 + (n - 0.5) * 0.8 - h * 0.75 + (h < 0.15 ? 0.25 : 0);
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  return p;
}

// BOITATÁ — a cobra de fogo da lenda: cabeça (15×11, 2 quadros) virada para a DIREITA,
// olho de fogo e crista de chamas; gomos do corpo (9×9, 3 quadros) que tremulam
function boitataHead(f) {
  // desenhada à mão (mapa): crista de chamas, testa clara, olho de fogo, mandíbula escura
  const crest = f ? ["..y...y...y.....", "..o..oyo..o....."] : ["...y...y...y....", "...o..oyo..o...."];
  return Pix.fromMap(
    [
      ...crest,
      "..rooorooorr....",
      ".rOOYYYYYOOrr...",
      "rOYYWWYYYYYOOr..",
      "rOYWWYYYYwkYOOr.",
      "rOYYYYYYYYYYYYOr",
      "rOOYYYYYYYYYYOOr",
      ".rOOOOOOOOOOrrr.",
      "..rRRRRRRRRr....",
      "...rrrrrrr......",
    ],
    { y: PAL.yel3, o: PAL.org2, r: PAL.red1, O: PAL.org2, Y: PAL.yel2, W: PAL.yel3, w: PAL.white, k: PAL.ink, R: PAL.red0 },
  ).outline(PAL.red0);
}
function boitataSeg(f) {
  const p = new Pix(9, 9);
  const n = tileNoise(16, 16, 3, 601);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x + 0.5 - 4.5, y + 0.5 - 4.5) / 4.3;
      if (d > 1) continue;
      const I = (1 - d) * 1.3 + (n((x + f * 5) & 15, (y + f * 3) & 15) - 0.5) * 0.8;
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  return p;
}

// FOGUEIRA DE SÃO JOÃO (26×32, 8 quadros em laço sem emenda): toras cruzadas em pé
// (a armação de festa junina), pedras em volta e a chama alta que sobe; fagulhas soltas
export const BONFIRE_W = 26,
  BONFIRE_H = 32;
function bonfire(f) {
  const p = new Pix(BONFIRE_W, BONFIRE_H);
  const G = BONFIRE_H - 3;
  const cx = BONFIRE_W / 2;
  const n1 = tileNoise(BONFIRE_W + 6, 32, 4, 701),
    n2 = tileNoise(BONFIRE_W + 6, 32, 2, 709);
  // chama (atrás das toras da frente): corpo largo embaixo, línguas que sobem
  for (let y = 0; y < BONFIRE_H; y++)
    for (let x = 0; x < BONFIRE_W; x++) {
      const h = (G - 2 - y) / 22; // 0 na base do fogo … 1 no alto
      if (h < -0.05) continue;
      const u = (x + 0.5 - cx) / 8.5;
      const n = 0.6 * n1(x, (y + f * 4) & 31) + 0.4 * n2(x, (y + f * 4) & 31);
      const tongue = 0.55 + 0.45 * Math.abs(Math.cos(u * 3.4 + Math.sin(f * 0.785) * 0.4));
      const top = tongue * (1 - u * u * 0.85) + (n - 0.5) * 0.4;
      if (h > top || Math.abs(u) > 1.05) continue;
      const I = (1 - Math.abs(u)) * 1.2 + (n - 0.5) * 0.85 - h * 0.6 + (h < 0.2 ? 0.25 : 0);
      const c = fireCol(I, x, y);
      if (c != null) p.set(x, y, c);
    }
  // toras em pé cruzadas (armação) e as de baixo deitadas
  const log = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n),
        y = Math.round(y0 + ((y1 - y0) * i) / n);
      p.set(x, y, PAL.n3);
      p.set(x + 1, y, i % 3 ? PAL.n2 : PAL.n1);
    }
  };
  log(5, G, 11, G - 12);
  log(19, G, 13, G - 12);
  for (let x = 4; x <= 21; x++) {
    p.set(x, G, x % 4 ? PAL.n3 : PAL.n4);
    p.set(x, G + 1, PAL.n2);
  }
  // brasas na base
  for (let x = 7; x <= 18; x += 2) p.set(x, G - 1, (x + f) % 4 < 2 ? PAL.yel3 : PAL.org2);
  // pedras em volta
  for (const x of [2, 6, 19, 23]) {
    p.set(x, G + 1, PAL.s3);
    p.set(x + 1, G + 1, PAL.s4);
    p.set(x, G, PAL.s2);
  }
  // fagulhas subindo (andam 4 px por quadro: laço de 8)
  for (let k = 0; k < 4; k++) {
    const t = ((f + k * 2) % 8) / 8;
    const x = Math.round(cx + Math.sin(k * 2.1 + t * 6) * 5),
      y = Math.round(G - 22 - t * 8);
    if (y >= 0 && !p.get(x, y)) p.set(x, y, t < 0.5 ? PAL.yel3 : PAL.org2);
  }
  return p.outline(PAL.ink);
}

export function registerFireFX(scene) {
  if (scene.textures.exists("fx_whirl")) return;
  registerStrip(scene, "fx_whirl", Array.from({ length: W_GROW.length }, (_, f) => whirl(f)));
  registerStrip(scene, "fx_ignite", Array.from({ length: I_GROW.length }, (_, f) => ignite(f)));
  registerStrip(scene, "fx_wisp", [0, 1, 2, 3].map((f) => wisp(f)));
  registerStrip(scene, "fx_jet", Array.from({ length: J_REACH.length }, (_, f) => jet(f)));
  registerStrip(scene, "fx_groundfire", Array.from({ length: 8 }, (_, f) => groundFire(f)));
  registerStrip(scene, "fx_bonfire", Array.from({ length: 8 }, (_, f) => bonfire(f)));
  registerStrip(scene, "px_boitata_head", [0, 1].map((f) => boitataHead(f)));
  registerStrip(scene, "px_boitata_seg", [0, 1, 2].map((f) => boitataSeg(f)));
  const mk = (key, tex, rate, repeat = 0) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, {}), frameRate: rate, repeat });
  };
  mk("fx_whirl", "fx_whirl", 15);
  mk("fx_ignite", "fx_ignite", 16);
  mk("fx_wisp", "fx_wisp", 14, -1);
  mk("fx_jet", "fx_jet", 18);
  mk("fx_groundfire", "fx_groundfire", 12, -1);
  mk("fx_bonfire", "fx_bonfire", 11, -1);
  mk("px_boitata_head", "px_boitata_head", 8, -1);
  mk("px_boitata_seg", "px_boitata_seg", 10, -1);
}
