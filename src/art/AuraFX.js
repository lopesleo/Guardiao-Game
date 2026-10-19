// Aura do DESPERTAR: fogo espiritual da mata (dourado com verde de vaga-lume) que sobe
// atrás do guardião enquanto ele está desperto. 8 quadros em laço sem emenda (o ruído
// sobe 4 px por quadro num período de 32). O herói é desenhado na frente.
// As cores vêm de um conjunto (C): o dourado é o do jogo; os cosméticos registram outras
// (registerAuraVariant) com a MESMA forma — a aura mostra o estado, só o tom muda.
import { PAL } from "./Palette.js";
import { Pix, registerStrip, tileNoise, bayer } from "./PixelArt.js";

export const AURA_W = 34,
  AURA_H = 46;
const GOLD = { core: PAL.white, hi: PAL.yel3, mid: PAL.yel2, low: PAL.yel1, fleck: PAL.g6, faint: PAL.g5 };
function aura(f, C = GOLD) {
  const p = new Pix(AURA_W, AURA_H);
  const n1 = tileNoise(AURA_W + 2, 32, 4, 1501),
    n2 = tileNoise(AURA_W + 2, 32, 2, 1511);
  const G = AURA_H - 3;
  for (let y = 0; y < AURA_H; y++)
    for (let x = 0; x < AURA_W; x++) {
      const h = (G - y) / (G - 2); // 0 nos pés … 1 acima da cabeça
      if (h < -0.06) continue;
      const u = (x + 0.5 - AURA_W / 2) / (AURA_W / 2); // −1 … 1
      const n = 0.6 * n1(x, (y + f * 4) & 31) + 0.4 * n2(x, (y + f * 4) & 31);
      // silhueta de chama: larga no corpo, línguas no alto
      const width = 0.95 - h * 0.35 + (n - 0.5) * 0.3;
      if (Math.abs(u) > width) continue;
      if (h > 0.82 + (n - 0.5) * 0.5) continue;
      // fogo forte na BORDA (emoldura o herói, que fica na frente) e ralo no meio
      const rim = 1 - Math.abs(Math.abs(u) / Math.max(0.2, width) - 0.72) * 2.3;
      const I = Math.max(rim, 0.25) * 1.1 + (n - 0.5) * 0.9 - h * 0.3;
      let c = null;
      if (I > 0.95) c = C.core;
      else if (I > 0.72) c = C.hi;
      else if (I > 0.5) c = C.mid;
      else if (I > 0.32) c = (x + y) % 5 ? C.low : C.fleck; // fagulhas (verdes de vaga-lume, no dourado)
      else if (C.faint != null && I > 0.18 && bayer(x, y) < 0.5) c = C.faint; // pontilhado (só brilha no dourado)
      if (c != null) p.set(x, y, c);
    }
  return p;
}

export function registerAuraFX(scene) {
  registerAuraVariant(scene, "fx_awaken_aura", GOLD);
}

// Mesma aura com outras cores (textura e animação com a mesma chave). frameFn = outro desenho com o mesmo
// tamanho e o mesmo laço de 8 quadros (a nuvem de algodão da paineira)
export function registerAuraVariant(scene, key, C, frameFn = null) {
  if (scene.textures.exists(key)) return;
  registerStrip(scene, key, Array.from({ length: 8 }, (_, f) => (frameFn ? frameFn(f) : aura(f, C))));
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, {}), frameRate: 12, repeat: -1 });
}
