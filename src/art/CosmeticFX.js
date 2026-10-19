// Texturas dos cosméticos (protótipo, ver docs/COSMETICOS.md). Rosa = PAL.pink, cor que nenhum
// elemento, aviso ou gema usa (só flores de decoração): nunca se confunde com o combate. Sombra em
// pur1 (roxo escuro) e luz em creme — nada de vermelho, que é a cor dos avisos de perigo.
import { PAL } from "./Palette.js";
import { Pix } from "./PixelArt.js";
import { registerAuraVariant } from "./AuraFX.js";

export function registerCosmeticFX(scene) {
  if (scene.textures.exists("cos_petal")) return;
  // Pétala de ipê (7×5): ponta arredondada clara, corpo rosa, base afinando em sombra
  Pix.fromMap([".wwp...", "wpppp..", "pppppd.", ".pppdd.", "..dd..."], { w: PAL.cream, p: PAL.pink, d: PAL.pur1 }).register(
    scene,
    "cos_petal",
  );
  // Flor de ipê vista de cima (13×13): 5 lobos franzidos, borda escura para destacar da grama,
  // miolo amarelo pequeno (a garganta da flor)
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
  f.register(scene, "cos_bloom");
  // Aura do Despertar em rosa: mesma chama, fagulhas creme no lugar das verdes de vaga-lume
  registerAuraVariant(scene, "fx_awaken_aura_ipe", { core: PAL.white, hi: PAL.pinkHi, mid: PAL.pink, low: PAL.pur1, fleck: PAL.cream, faint: PAL.pink });
}
