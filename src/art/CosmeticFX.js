// Texturas dos cosméticos (docs/COSMETICOS.md) — pixel art procedural, uma paleta só.
// Cores LIVRES do combate (o resto é linguagem do jogo: fogo, gelo, raio, vento, perigo, gemas):
// rosa, creme, palha, barro, marrons e cinzas. Nada de vermelho (avisos de perigo), verde (gema) etc.
//
//   Grátis  cos_seed (sementes) · cos_print (pegada) · cos_dryleaf (folha seca) · aura "luar"
//   Ipê     cos_petal · cos_bloom · aura rosa
//   Paina   cos_paina · cos_pod (fruto da barriguda abrindo, 3 quadros) · aura creme
//   Coruja  cos_owl (voo, 4 quadros) · cos_feather · cos_wings (asas, 3 quadros) · aura terrosa
//   Junina  cos_flag (bandeirinha BRANCA, tingida por partícula, 2 quadros) · cos_bunting (varal, 2) · aura de chita
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";
import { registerAuraVariant, AURA_W, AURA_H } from "./AuraFX.js";

// Cores da chita (bandeirinhas da Festa Junina) — só tons livres
export const CHITA = [PAL.pink, PAL.straw3, PAL.cream, PAL.clay3, PAL.pinkHi, PAL.straw2];

// Auras do Despertar com a MESMA chama do dourado: só vale para cor que brilha (rosa, prata clara).
// Recolorir a chama com marrom, barro ou cinza vira "chama suja" (visto em 19/10: coruja e arraiá pareciam
// lama) — essas peças têm forma própria: nuvem de algodão (paineira), asas (coruja), arraiá (junina)
export const AURAS = {
  ipe: { core: PAL.white, hi: PAL.pinkHi, mid: PAL.pink, low: PAL.pur1, fleck: PAL.cream, faint: PAL.pink },
  luar: { core: PAL.white, hi: PAL.white, mid: PAL.s4, low: PAL.s3, fleck: PAL.white, faint: null }, // prata limpa, sem pontilhado
};

const anim = (scene, key, tex, frames, frameRate, repeat = -1) => {
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate, repeat });
};

// --------------------------------------------------------------------- grátis
function seed() {
  return Pix.fromMap([".bB", "bBd", "dd."], { b: PAL.n3, B: PAL.n4, d: PAL.n1 });
}
// Pegada de pé descalço apontando para CIMA (a peça gira na direção do passo). CLARA (chão pisado):
// escura sumia na grama e na terra da trilha
function print() {
  return Pix.fromMap([".d.d", "d.d.", ".dd.", "dddd", "dddd", ".dd.", ".dd."], { d: PAL.n4 });
}
function dryLeaf() {
  return Pix.fromMap(["..sSS.", ".sScSs", "sScSs.", "scs...", "n....."], { s: PAL.clay2, S: PAL.straw2, c: PAL.clay1, n: PAL.n2 });
}

// --------------------------------------------------------------------- ipê
function petal() {
  return Pix.fromMap([".wwp...", "wpppp..", "pppppd.", ".pppdd.", "..dd..."], { w: PAL.cream, p: PAL.pink, d: PAL.pur1 });
}
// Flor de ipê vista de cima (13×13): 5 lobos franzidos, contorno escuro para destacar da grama,
// miolo amarelo pequeno (a garganta da flor)
function bloom() {
  const N = 13,
    c = 6;
  const f = new Pix(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x - c,
        dy = y - c,
        r = Math.hypot(dx, dy),
        a = Math.atan2(dy, dx);
      const lobe = 4.3 + 1.8 * Math.cos(5 * (a + 0.3));
      if (r > lobe + 0.5) continue;
      let col = PAL.pink;
      if (r > lobe - 0.5) col = PAL.pur1; // contorno
      else if (r > lobe - 1.4 && dx + dy < -1) col = PAL.cream; // luz no alto/esquerda
      if (r < 1.3) col = PAL.yel2;
      f.set(x, y, col);
    }
  return f;
}

// --------------------------------------------------------------------- paineira
// Paina (9×10): tufo de fios de algodão abrindo em leque PARA CIMA, com a semente escura pendurada
// embaixo (é assim que ela voa) — a partícula gira pouco para o tufo ficar de pé
function paina() {
  const W = 9,
    H = 10;
  const p = new Pix(W, H);
  const sx = 4,
    sy = 8;
  for (let k = 0; k < 9; k++) {
    const a = (-162 + k * 18) * (Math.PI / 180); // leque de 144° para cima
    const len = 5.2 + ((k * 37) % 5) * 0.45; // fios de tamanhos diferentes
    for (let i = 1; i <= len; i++) {
      const curl = Math.sin(i * 0.9 + k) * 0.35; // fio levemente ondulado
      const x = Math.round(sx + Math.cos(a + curl * 0.3) * i),
        y = Math.round(sy + Math.sin(a) * i);
      if (x < 0 || x >= W || y < 0) continue;
      const tipFade = i > len - 1.5;
      p.set(x, y, i < 2 ? PAL.cream : (x + y + k) % 3 ? PAL.white : PAL.cream, tipFade ? 140 : 255);
    }
  }
  p.set(sx, sy, PAL.n1);
  p.set(sx, sy + 1, PAL.n2); // semente
  p.set(sx, sy - 1, PAL.n3);
  return p;
}
// Fruto da barriguda (11×9): fechado → racha → aberto com a paina estufando
function pod(f) {
  const p = new Pix(11, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 11; x++) {
      const u = (x - 5) / 5.2,
        v = (y - 4.5) / 3.6;
      const d = u * u + v * v;
      if (d > 1) continue;
      let col = v < -0.35 ? PAL.n4 : v > 0.45 ? PAL.n2 : PAL.n3;
      if (d > 0.72) col = PAL.n1; // contorno
      if (f === 1 && Math.abs(y - 4.5) < 0.6 && Math.abs(u) < 0.7) col = PAL.cream; // racha
      if (f === 2 && Math.abs(y - 4.5) < 1.6 + Math.abs(u) * 0.4) col = (x + y) % 3 ? PAL.white : PAL.cream; // aberto
      p.set(x, y, col);
    }
  return p;
}

// Aura da paineira: nuvem de algodão (bolotas macias subindo em volta do herói, maiores embaixo), no
// mesmo tamanho e laço da aura (8 quadros, 5 px por quadro num período de 40)
function cottonCloud(f) {
  const p = new Pix(AURA_W, AURA_H);
  const puffs = [];
  // 18 bolotas de tamanhos diferentes, espalhadas (não em fila: em fila pareciam bonecos de neve),
  // subindo em volta do herói e se abrindo para fora conforme sobem
  for (let k = 0; k < 18; k++) {
    const left = k % 2 === 0;
    const rise = (((k * 37) % 40) + f * 5) % 40; // 0 = no chão, 40 = no alto
    const y = AURA_H - 5 - rise;
    const spread = (rise / 40) * 3; // abre para fora ao subir
    const jitter = ((k * 7) % 5) - 2;
    const x = left ? 8 + jitter - spread : AURA_W - 9 + jitter + spread;
    const r = (1.8 + 4 * (1 - rise / 40)) * (0.75 + ((k * 13) % 5) / 8);
    puffs.push({ x, y, r });
  }
  puffs.sort((a, b) => a.y - b.y); // as de baixo por cima (mais perto)
  for (const { x, y, r } of puffs)
    for (let yy = Math.floor(y - r); yy <= y + r; yy++)
      for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        const dx = (xx - x) / r,
          dy = (yy - y) / r;
        const d = dx * dx + dy * dy;
        if (d > 1 || xx < 0 || yy < 0 || xx >= AURA_W || yy >= AURA_H) continue;
        const light = -(dx * 0.7 + dy * 0.7); // luz de cima/esquerda
        p.set(xx, yy, d > 0.82 && light < -0.3 ? PAL.s4 : light > 0.05 ? PAL.white : PAL.cream); // algodão: quase todo branco
      }
  return p;
}
// Arraiá (66×50): mastro atrás do herói com a bandeirinha no topo e 4 cordões de bandeirinhas de chita
// descendo em leque até o chão. Quadro 1: as bandeirinhas balançam
function arraia(f) {
  const W = 66,
    H = 50;
  const p = new Pix(W, H);
  const top = [33, 6];
  const anchors = [[3, 41], [13, 48], [53, 48], [63, 41]];
  anchors.forEach(([ax, ay], s) => {
    const cx = (top[0] + ax) / 2,
      cy = (top[1] + ay) / 2 + 7; // o cordão cede no meio
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      pts.push([Math.round((1 - t) * (1 - t) * top[0] + 2 * (1 - t) * t * cx + t * t * ax), Math.round((1 - t) * (1 - t) * top[1] + 2 * (1 - t) * t * cy + t * t * ay)]);
    }
    for (const [x, y] of pts) p.set(x, y, PAL.n2);
    for (let i = 7, k = 0; i < pts.length - 3; i += 8, k++) {
      const [x, y] = pts[i];
      const col = CHITA[(k + s * 2) % CHITA.length];
      const sway = f && k % 2 ? (s < 2 ? -1 : 1) : 0;
      // bandeirinha pendurada: 3 → 3 → 2 → 1 px, borda direita mais escura
      [[-1, 2], [-1, 2], [0, 1], [0, 1], [0, 0]].forEach(([a, b], r) => {
        for (let dx = a; dx <= b; dx++) p.set(x + dx + (r > 1 ? sway : 0), y + 1 + r, dx === b && r < 2 ? PAL.clay1 : col);
      });
    }
  });
  // mastro (2 px) e a bandeirinha do topo
  for (let y = top[1]; y < H; y++) {
    p.set(32, y, PAL.n3);
    p.set(33, y, PAL.n2);
  }
  for (const [x, y, c] of [[33, 1, PAL.pink], [34, 1, PAL.pink], [35, 1, PAL.pink], [33, 2, PAL.pink], [34, 2, PAL.pinkHi], [33, 3, PAL.straw3], [33, 4, PAL.straw3], [33, 5, PAL.n2]]) p.set(x, y, c);
  return p;
}

// --------------------------------------------------------------------- coruja-buraqueira
// Corujinha voando (13×11): corpo redondo (coruja não tem pescoço), sobrancelha creme, olhos amarelos;
// asas LARGAS saindo do meio do corpo, afinando até a ponta escura, com o barrado creme. Quadros:
// asas em cima, no meio, embaixo, no meio
function owl(f) {
  const p = new Pix(13, 11);
  const tipY = [0, 5, 10, 5][f];
  for (const side of [-1, 1]) {
    const rx = 6 + side * 2,
      ry = 5,
      tx = 6 + side * 6;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const cx = rx + (tx - rx) * t,
        cy = ry + (tipY - ry) * t;
      const th = 2.6 * (1 - t) + 0.6; // larga na raiz, fina na ponta
      for (let d = -th; d <= th; d += 0.5) {
        const x = Math.round(cx),
          y = Math.round(cy + d);
        if (y < 0 || y > 10) continue;
        const col = t > 0.82 ? PAL.n1 : d < -th + 0.6 ? PAL.n2 : i % 3 === 1 ? PAL.cream : PAL.n3;
        p.set(x, y, col);
      }
    }
  }
  // corpo + cabeça num ovo só
  for (let y = 1; y <= 10; y++)
    for (let x = 3; x <= 9; x++) {
      const u = (x - 6) / 2.9,
        v = (y - 5.6) / 4.4;
      const d = u * u + v * v;
      if (d > 1) continue;
      let col = d > 0.62 ? PAL.n2 : PAL.n3;
      if (y >= 6 && (x + y) % 3 === 0) col = PAL.cream; // peito pintado
      p.set(x, y, col);
    }
  p.set(4, 2, PAL.cream);
  p.set(5, 2, PAL.cream);
  p.set(7, 2, PAL.cream);
  p.set(8, 2, PAL.cream); // sobrancelhas
  p.set(5, 3, PAL.yel2);
  p.set(7, 3, PAL.yel2); // olhos
  p.set(6, 4, PAL.straw2); // bico
  return p;
}
function feather() {
  return Pix.fromMap([".cNcNc..", "nnnnnnnc", ".cNcNc.."], { c: PAL.cream, N: PAL.n4, n: PAL.n3 });
}
// Asas abertas atrás do herói (48×26): silhueta de asa de coruja de verdade — borda de ataque curva
// subindo do ombro, cobertas claras pintadas perto do corpo, secundárias com o barrado creme e as
// primárias abertas em "dedos" na ponta. Quadros: aberta, meio, batendo (desce)
function wings(f) {
  const W = 48,
    H = 26;
  const p = new Pix(W, H);
  const raise = [1, 0.72, 0.42][f];
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 21; i++) {
      const t = i / 21;
      const x = 24 + side * (2 + i);
      const yL = 15 - 12 * raise * Math.sin(Math.min(1, t * 1.15) * (Math.PI / 2)) + (f === 2 ? t * 3 : 0); // borda de ataque
      const yT = 18 + 2 * (1 - t) - 7 * raise * t * t + (f === 2 ? t * 4 : 0) + (i % 3 === 0 ? 1 : 0); // borda de fuga recortada
      for (let y = Math.round(yL); y <= Math.round(yT); y++) {
        if (y < 0 || y >= H) continue;
        const rel = (y - yL) / Math.max(1, yT - yL);
        if (t > 0.68 && i % 3 === 0 && rel > 0.25) continue; // vão entre as primárias ("dedos")
        let col;
        // pintas (a coruja-buraqueira é pintada, não listrada: as listras viravam um "pente")
        if (y === Math.round(yL)) col = PAL.n2; // borda de ataque
        else if (t > 0.88) {
          if (rel > 0.45) continue; // ponta arredondada (pendurada até embaixo parecia asa de morcego)
          col = PAL.n2;
        }
        // tons CLAROS (marrom escuro sumia na trilha de terra à noite): cobertas palha, penas marrom-claro
        else if (t < 0.32) col = (x * 3 + y * 2) % 7 === 0 ? PAL.cream : PAL.straw2; // cobertas claras pintadas
        else if (rel > 0.82) col = PAL.n2; // borda de fuga (contorno escuro separa do chão)
        else col = (x * 5 + y * 3) % 11 === 0 ? PAL.cream : (x + y * 2) % 9 === 0 ? PAL.straw1 : PAL.n4;
        p.set(x, y, col);
      }
    }
  }
  return p;
}

// --------------------------------------------------------------------- festa junina
// Bandeirinha em branco/cinza claro: a partícula tinge com a cor da chita (o cinza vira a sombra)
function flag(f) {
  return Pix.fromMap(f ? ["wwwwl", ".wwwl", ".wwl.", "..l.."] : ["wwwww", "wwwwl", ".wwl.", "..l.."], { w: PAL.white, l: PAL.s4 });
}
// Varal de bandeirinhas (41×10) já colorido: barbante caindo em curva com 7 bandeirinhas de chita
function bunting(f) {
  const W = 41,
    H = 10;
  const p = new Pix(W, H);
  const sag = (x) => Math.round(1 + 2.2 * Math.sin((x / (W - 1)) * Math.PI));
  for (let x = 0; x < W; x++) p.set(x, sag(x), PAL.n2);
  for (let k = 0; k < 7; k++) {
    const cx = 3 + k * 6,
      top = sag(cx) + 1;
    const col = CHITA[k % CHITA.length];
    const sway = f && k % 2 ? 1 : 0;
    for (let r = 0; r < 5; r++) {
      const half = Math.max(0, 2 - Math.floor(r / 2));
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx + (r > 2 ? sway : 0);
        if (x >= 0 && x < W && top + r < H) p.set(x, top + r, dx === half ? PAL.n2 : col);
      }
    }
  }
  return p;
}

export function registerCosmeticFX(scene) {
  if (!scene.textures.exists("cos_petal")) {
    seed().register(scene, "cos_seed");
    print().register(scene, "cos_print");
    dryLeaf().register(scene, "cos_dryleaf");
    petal().register(scene, "cos_petal");
    bloom().register(scene, "cos_bloom");
    paina().register(scene, "cos_paina");
    registerStrip(scene, "cos_pod", [0, 1, 2].map((f) => pod(f)));
    registerStrip(scene, "cos_owl", [0, 1, 2, 3].map((f) => owl(f)));
    feather().register(scene, "cos_feather");
    registerStrip(scene, "cos_wings", [0, 1, 2].map((f) => wings(f)));
    registerStrip(scene, "cos_flag", [0, 1].map((f) => flag(f)));
    registerStrip(scene, "cos_bunting", [0, 1].map((f) => bunting(f)));
    registerStrip(scene, "cos_arraia", [0, 1].map((f) => arraia(f)));
  }
  anim(scene, "cos_pod_open", "cos_pod", [0, 1, 2], 14, 0);
  anim(scene, "cos_owl_fly", "cos_owl", [0, 1, 2, 3], 16);
  anim(scene, "cos_wings_beat", "cos_wings", [0, 1, 2, 1], 6);
  anim(scene, "cos_bunting_wave", "cos_bunting", [0, 1], 4);
  anim(scene, "cos_arraia_wave", "cos_arraia", [0, 1], 3);
  for (const [id, C] of Object.entries(AURAS)) registerAuraVariant(scene, `fx_awaken_aura_${id}`, C);
  registerAuraVariant(scene, "fx_awaken_aura_paina", null, cottonCloud); // nuvem de algodão, não chama
}
