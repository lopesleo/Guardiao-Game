// Santuários da Floresta: totem de pedra com musgo e uma gema no meio (a gema é uma
// textura à parte, em tons neutros, para ser tingida pela cor de cada tipo de santuário).
import { PAL } from "./Palette.js";
import { Pix } from "./PixelArt.js";

const K = PAL.ink;

function totem() {
  const p = new Pix(16, 24);
  // Base larga
  p.rect(1, 20, 14, 4, K);
  p.rect(2, 20, 12, 3, PAL.s2);
  p.rect(2, 20, 12, 1, PAL.s3);
  p.rect(2, 22, 12, 1, PAL.s1);
  // Coluna
  p.rect(4, 6, 8, 15, K);
  p.rect(5, 6, 6, 14, PAL.s2);
  p.rect(5, 6, 2, 14, PAL.s3);
  p.rect(10, 6, 1, 14, PAL.s1);
  // Capitel
  p.rect(2, 2, 12, 5, K);
  p.rect(3, 3, 10, 3, PAL.s3);
  p.rect(3, 3, 10, 1, PAL.s4);
  p.rect(3, 5, 10, 1, PAL.s2);
  // Encaixe da gema
  p.rect(6, 9, 4, 6, K);
  p.rect(7, 10, 2, 4, PAL.s0);
  // Rachaduras e musgo
  p.set(5, 16, PAL.s1);
  p.set(6, 17, PAL.s1);
  p.set(10, 12, PAL.s1);
  for (const [x, y] of [[5, 19], [6, 19], [4, 20], [11, 19], [3, 21], [4, 21], [12, 21], [8, 5], [9, 5], [4, 3]]) p.set(x, y, PAL.g4);
  for (const [x, y] of [[5, 20], [11, 20], [3, 22]]) p.set(x, y, PAL.g5);
  return p;
}

// Gema em tons de cinza claro: o tint do Phaser a colore
function gem() {
  const rows = [
    "...k...",
    "..kwk..",
    ".kwcck.",
    "kwccbck",
    ".kcbbk.",
    "..kbk..",
    "...k...",
  ];
  return Pix.fromMap(rows, { k: K, w: PAL.white, c: 0xe6e6e6, b: 0xb8b8b8 });
}

export function registerShrines(scene) {
  totem().register(scene, "px_shrine");
  gem().register(scene, "px_shrine_gem");
}
