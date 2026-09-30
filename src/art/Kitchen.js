// Arte procedural da Cozinha: fogão a lenha de barro com panela, e os ícones
// dos pratos (tigela de barro com a comida de cada receita).
import { PAL } from "./Palette.js";
import { Pix, bayer } from "./PixelArt.js";

const K = PAL.ink;
const CLAY = [0x6b3a22, 0x8a5230, 0xa86a3e, 0xc88a5a];

// ---------------------------------------------------------------------------
// FOGÃO A LENHA de barro (a Cozinha): corpo baixo, boca com brasa, panela de
// barro em cima, chaminé e um jirau de madeira com cuia pendurada
// ---------------------------------------------------------------------------
function makeStove() {
  const p = new Pix(44, 36);
  // Jirau (prateleira de varas) atrás, à direita
  for (const x of [33, 42]) for (let y = 12; y < 36; y++) p.set(x, y, y % 5 ? PAL.n3 : PAL.n2);
  for (let x = 33; x <= 42; x++) {
    p.set(x, 18, PAL.n4);
    p.set(x, 26, PAL.n3);
  }
  p.ellipse(37.5, 16, 3, 2, PAL.yel1); // cuia
  p.set(36, 15, PAL.yel2);
  p.rect(35, 23, 2, 3, PAL.org2); // cenoura pendurada
  p.rect(39, 22, 2, 4, PAL.yel2); // espiga
  // Chaminé
  for (let y = 2; y < 18; y++) for (let x = 25; x < 30; x++) p.set(x, y, x === 25 ? CLAY[3] : x === 29 ? CLAY[1] : CLAY[2]);
  p.rect(24, 1, 7, 2, CLAY[1]);
  // Corpo do fogão (barro, cantos arredondados)
  for (let y = 16; y < 35; y++)
    for (let x = 2; x < 32; x++) {
      if ((x === 2 || x === 31) && (y === 16 || y === 34)) continue;
      let c = CLAY[2];
      if (x < 5 || y < 18) c = CLAY[3];
      if (y > 31 || x > 29) c = CLAY[1];
      if ((x * 5 + y * 3) % 17 === 0) c = CLAY[1];
      p.set(x, y, c);
    }
  // Chapa de cima
  p.rect(2, 15, 30, 2, PAL.s1);
  p.rect(2, 15, 30, 1, PAL.s2);
  // Boca com lenha e brasa
  p.ellipse(12, 29, 6, 4, PAL.ink);
  p.ellipse(12, 30, 4.5, 2.6, PAL.org1);
  p.ellipse(12, 30.5, 3, 1.6, PAL.org2);
  p.rect(9, 32, 7, 1, PAL.yel3);
  p.rect(5, 33, 3, 1, PAL.n2);
  p.rect(16, 33, 4, 1, PAL.n2);
  // Panela de barro
  p.ellipse(15, 10, 8, 5, CLAY[1]);
  p.ellipse(15, 9, 8, 4, CLAY[2]);
  for (let y = 5; y < 15; y++) for (let x = 7; x < 12; x++) if (p.get(x, y) && bayer(x, y) < 0.5) p.set(x, y, CLAY[3]);
  p.ellipse(15, 6, 7, 2, CLAY[0]);
  p.ellipse(15, 6, 5.5, 1.3, PAL.org3); // caldo
  p.set(13, 6, PAL.cream);
  p.rect(6, 8, 2, 2, CLAY[1]); // alças
  p.rect(23, 8, 2, 2, CLAY[1]);
  p.outline(K);
  return p;
}

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
  makeStove().register(scene, "camp_kitchen");
  for (const [id, d] of Object.entries(DISH)) dishIcon(d).register(scene, `ico_dish_${id}`);
}

export const dishIconKey = (id) => `ico_dish_${id}`;
