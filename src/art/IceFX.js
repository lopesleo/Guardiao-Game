// Gelo desenhado para a Aura Gélida e o Coração do Inverno — na MESMA escala de pixel
// do jogo (o quadro é pintado a 1/3 e mostrado ×3; o anel antigo usava pontos de 2 px
// e destoava de todo o resto).
//   fx_frost_rim_<r>_<s>  — borda do campo: faixa de gelo com cristais espetados para fora
//   fx_frost_disk_<r>     — chão gelado dentro do campo (geada rala, pontilhada)
//   fx_icespike           — espinho de gelo que brota do chão, brilha, racha e estilhaça
import { PAL } from "./Palette.js";
import { Pix, registerStrip, bayer, rng } from "./PixelArt.js";

export const ICE_PX = 3;

// Borda do campo, raio `r` em pixels do quadro (o jogo mostra ×3). strong = Coração do
// Inverno: mais cristais, maiores, e seis flocos marcando o anel.
export function frostRimTexture(scene, r, strong) {
  const key = `fx_frost_rim_${r}_${strong ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const S = (r + 7) * 2 + 1,
    c = S / 2;
  const p = new Pix(S, S);
  const at = (a, rr) => [Math.floor(c + Math.cos(a) * rr), Math.floor(c + Math.sin(a) * rr)];
  // faixa: geada pontilhada por dentro, linha clara, aro escuro por fora
  for (let a = 0; a < Math.PI * 2; a += 0.35 / r) {
    const [x0, y0] = at(a, r + 1);
    p.set(x0, y0, PAL.ice0);
    const [x1, y1] = at(a, r);
    p.set(x1, y1, PAL.ice2);
    const [x2, y2] = at(a, r - 1);
    if (bayer(x2, y2) < 0.6) p.set(x2, y2, PAL.ice1);
    const [x3, y3] = at(a, r - 2);
    if (bayer(x3, y3) < 0.25) p.set(x3, y3, PAL.ice1);
  }
  // cristais espetados para fora: base larga escura, face clara, ponta branca
  const n = strong ? 20 : 14;
  const len = strong ? 7 : 6;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (k % 2) * 0.05;
    const L = len - (k % 3 === 1 ? 2 : 0); // alterna cristal grande e pequeno
    for (let i = 0; i <= L; i++) {
      const w = Math.round(1.6 * (1 - i / (L + 0.5))); // triângulo: 3–4 px na base, 1 na ponta
      for (let j = -w; j <= w; j++) {
        const [x, y] = at(a + (j * 0.9) / (r + i), r + i);
        const lit = j < 0 || (w === 0 && i < L);
        p.set(x, y, i === L ? PAL.white : lit ? PAL.ice3 : PAL.ice1);
      }
    }
  }
  // Coração do Inverno: seis flocos no anel (marca de que é a forma evoluída)
  if (strong)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 12;
      const [x, y] = at(a, r);
      [[0, 0, PAL.white], [-1, 0, PAL.ice3], [1, 0, PAL.ice3], [0, -1, PAL.ice3], [0, 1, PAL.ice3], [-2, 0, PAL.ice2], [2, 0, PAL.ice2], [0, -2, PAL.ice2], [0, 2, PAL.ice2], [-1, -1, PAL.ice1], [1, 1, PAL.ice1], [1, -1, PAL.ice1], [-1, 1, PAL.ice1]].forEach(([dx, dy, col]) => p.set(x + dx, y + dy, col));
    }
  p.outline(PAL.ink);
  p.register(scene, key);
  return key;
}

// Chão gelado dentro do campo: cristais de geada espalhados, mais densos perto da borda
export function frostDiskTexture(scene, r) {
  const key = `fx_frost_disk_${r}`;
  if (scene.textures.exists(key)) return key;
  const S = r * 2 + 1,
    c = S / 2;
  const p = new Pix(S, S);
  const rnd = rng(1700 + r);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / r;
      if (d > 0.96) continue;
      // densidade cresce para a borda; Bayer deixa o pontilhado "desenhado", não ruído
      const dens = 0.04 + Math.pow(d, 3) * 0.32;
      if (bayer(x, y) < dens && rnd() < 0.7) p.set(x, y, d > 0.8 && rnd() < 0.5 ? PAL.ice2 : PAL.ice1);
    }
  // cristaizinhos em cruz (geada) espalhados
  for (let i = 0; i < Math.round(r * 0.5); i++) {
    const a = rnd() * Math.PI * 2,
      d = Math.sqrt(rnd()) * (r - 3);
    const x = Math.round(c + Math.cos(a) * d),
      y = Math.round(c + Math.sin(a) * d);
    p.set(x, y, PAL.ice3);
    if (rnd() < 0.5) {
      p.set(x - 1, y, PAL.ice1);
      p.set(x + 1, y, PAL.ice1);
      p.set(x, y - 1, PAL.ice1);
      p.set(x, y + 1, PAL.ice1);
    }
  }
  p.register(scene, key);
  return key;
}

// Espinho de gelo (13×20, 8 quadros): racha o chão, brota, brilha, racha e estilhaça
export const SPIKE_W = 13,
  SPIKE_H = 20;
const SPIKE_GROW = [0, 0.35, 0.8, 1, 1, 1, 0.9, 0];
function iceSpike(f) {
  const p = new Pix(SPIKE_W, SPIKE_H);
  const G = SPIKE_H - 3,
    cx = 6;
  // rachadura no chão (todos os quadros até estilhaçar)
  if (f < 7) for (const [dx, dy] of [[-3, 1], [-2, 1], [-1, 0], [1, 0], [2, 1], [3, 1], [4, 2], [-4, 2]]) p.set(cx + dx, G + dy, f < 1 ? PAL.ice2 : PAL.ice1);
  const h = Math.round(SPIKE_GROW[f] * 14);
  if (h > 0) {
    // espinho principal + um menor ao lado (cristal facetado: face clara à esquerda)
    const spike = (x0, H, w0) => {
      for (let i = 0; i <= H; i++) {
        const w = Math.max(0, Math.round(w0 * (1 - i / (H + 1))));
        for (let j = -w; j <= w; j++) {
          const col = i === H ? PAL.white : j < 0 ? PAL.ice3 : j === 0 ? PAL.ice2 : PAL.ice1;
          p.set(x0 + j, G - i, col);
        }
      }
    };
    spike(cx + 3, Math.round(h * 0.55), 1);
    spike(cx, h, 2);
    if (f === 4) for (const [dx, dy] of [[-1, -h + 1], [0, -h - 1], [1, -h + 1], [0, -h + 2]]) p.set(cx + dx, G + dy, PAL.white); // brilho
    if (f >= 5) for (let i = 2; i < h; i += 3) p.set(cx + (i % 2 ? 1 : -1), G - i, PAL.ice0); // rachaduras
  }
  if (f === 7) {
    // estilhaços caindo
    const r = rng(77);
    for (let i = 0; i < 9; i++) p.set(Math.round(1 + r() * 11), Math.round(G - 2 - r() * 10), r() < 0.5 ? PAL.ice3 : PAL.white);
  }
  return f === 7 ? p : p.outline(PAL.ink); // estilhaços soltos sem contorno (viravam bolinhas pretas)
}

export function registerIceFX(scene) {
  if (scene.textures.exists("fx_icespike")) return;
  registerStrip(scene, "fx_icespike", SPIKE_GROW.map((_, f) => iceSpike(f)));
  if (!scene.anims.exists("fx_icespike"))
    scene.anims.create({ key: "fx_icespike", frames: scene.anims.generateFrameNumbers("fx_icespike", {}), frameRate: 16, repeat: 0 });
}
