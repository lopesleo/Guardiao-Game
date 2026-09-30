// Ícones dos pratos da Cozinha (tigela de barro com a comida de cada receita).
// O prédio da Cozinha fica em Buildings.js.
import { PAL } from "./Palette.js";
import { Pix, bayer } from "./PixelArt.js";

const K = PAL.ink;
const CLAY = [0x6b3a22, 0x8a5230, 0xa86a3e, 0xc88a5a];


// ---------------------------------------------------------------------------
// Pratos: tigela de barro + comida (cor e enfeite por receita)
// ---------------------------------------------------------------------------
const DISH = {
  roast_carrot: { food: [PAL.org1, PAL.org2, PAL.org3], bits: PAL.g5, chunky: true },
  pamonha: { food: [PAL.yel1, PAL.yel2, PAL.yel3], bits: PAL.g4, husk: true },
  tapioca: { food: [0xd8ccb0, PAL.cream, PAL.white], bits: PAL.red2, fold: true },
  tropeiro: { food: [PAL.n1, PAL.n2, PAL.n4], bits: PAL.yel3, chunky: true },
  quibebe: { food: [PAL.org1, PAL.org2, PAL.org3], bits: PAL.g6 },
  brasa: { food: [PAL.red0, PAL.red1, PAL.red2], bits: PAL.org3 },
  geada: { food: [PAL.ice1, PAL.ice2, PAL.ice3], bits: PAL.white },
  trovao: { food: [PAL.pur0, PAL.pur1, PAL.pur2], bits: PAL.yel3 },
  // com peixe
  lambari_frito: { food: [PAL.yel1, PAL.org3, PAL.yel3], bits: PAL.g5, chunky: true },
  pirao: { food: [PAL.n4, 0xd8ccb0, PAL.cream], bits: PAL.g5 },
  caldeirada: { food: [PAL.org1, PAL.org2, PAL.yel3], bits: PAL.s4, chunky: true },
  pacu_assado: { food: [PAL.s1, PAL.s2, PAL.s4], bits: PAL.org2, chunky: true },
  moqueca: { food: [PAL.red1, PAL.org2, PAL.yel2], bits: PAL.g6 },
  dourado_brasa: { food: [PAL.yel1, PAL.yel2, PAL.yel3], bits: PAL.red2, chunky: true },
};

function dishIcon(d) {
  const p = new Pix(14, 12);
  // Tigela
  for (let y = 5; y < 12; y++)
    for (let x = 0; x < 14; x++) {
      const dx = (x + 0.5 - 7) / 7,
        dy = (y + 0.5 - 5) / 6.5;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, x < 5 ? CLAY[3] : x > 10 ? CLAY[1] : CLAY[2]);
    }
  p.rect(1, 5, 12, 1, CLAY[1]);
  // Comida
  if (d.husk) {
    // pamonha na palha
    p.ellipse(7, 4, 4.5, 2.6, PAL.g4);
    p.ellipse(7, 3.5, 3, 1.8, d.food[1]);
    p.set(6, 3, d.food[2]);
    p.set(11, 2, PAL.g5);
  } else if (d.fold) {
    // tapioca dobrada com recheio
    p.ellipse(7, 4, 5, 2.4, d.food[1]);
    p.line(3, 4, 11, 3, d.food[0]);
    p.set(6, 5, d.bits);
    p.set(8, 5, d.bits);
    p.set(4, 3, d.food[2]);
  } else {
    p.ellipse(7, 5, 6, 2.2, d.food[1]);
    p.ellipse(6, 4.5, 3.5, 1.2, d.food[2]);
    for (let x = 2; x < 12; x++) if ((x * 3) % 5 === 0) p.set(x, d.chunky ? 3 : 5, d.chunky ? d.food[0] : d.bits);
    p.set(9, 4, d.bits);
    if (d.chunky) p.set(5, 3, d.food[1]);
  }
  return p.outline(K);
}

export function registerKitchen(scene) {
  for (const [id, d] of Object.entries(DISH)) dishIcon(d).register(scene, `ico_dish_${id}`);
}

export const dishIconKey = (id) => `ico_dish_${id}`;
