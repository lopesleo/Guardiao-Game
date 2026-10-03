// Lanternas de cogumelo (bioluminescentes) e os itens que caem delas.
// Tudo em pixel-art procedural com a paleta única.
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";

const K = PAL.ink;

// Touceira de cogumelos luminosos sobre um toco. 2 quadros: o brilho pulsa.
function lanternFrames() {
  const base = [
    "......kkkk........",
    ".....kcwccK.......",
    "....kcwcccbK..kkk.",
    "....kccccbbK.kcwcK",
    "....KKbbbbKK.kccbK",
    ".kkk..Kssk....KbK.",
    "kcwck..ss....kss..",
    "kccbK..ss.....ss..",
    ".KbK...ss....ss...",
    "..ss...ss....ss...",
    "..ss..kmmnnnnnmk..",
    "...s.kmnnnnnnnnmk.",
    "....kmnnNNnnNnnnmk",
    "....kmnNnnnnnNnnmk",
    "....kmnnnnNnnnnnmk",
    "....kmmnnnnnnnnmmk",
    ".....kkmmmmmmmmkk.",
    "......gGgkkkkgGg..",
  ];
  const legend = {
    k: K,
    K: PAL.ice0,
    c: PAL.ice3,
    w: PAL.white,
    b: PAL.ice2,
    s: PAL.cream,
    m: PAL.n2,
    n: PAL.n3,
    N: PAL.n1,
    g: PAL.g4,
    G: PAL.g5,
  };
  const a = Pix.fromMap(base, legend);
  // Quadro 2: chapéus mais claros (pulso de brilho)
  const b = Pix.fromMap(
    base.map((r) => r.replace(/b/g, "c")),
    legend,
  );
  return [a, b];
}

// Toco depois de quebrar (esporos apagados)
function lanternBroken() {
  return Pix.fromMap(
    [
      "..................",
      "..................",
      "..................",
      "..................",
      "..................",
      "..................",
      "..................",
      "..................",
      "..................",
      "......K.....K.....",
      "..K...s..K..s.....",
      "...s.kmmnnnnnmk...",
      "....kmnnNNnnNnmk..",
      "....kmnNnnnnnNnmk.",
      "....kmnnnnNnnnnmk.",
      "....kmmnnnnnnnmmk.",
      ".....kkmmmmmmmkk..",
      "......gGgkkkkgGg..",
    ],
    { k: K, K: PAL.s2, s: PAL.s3, m: PAL.n2, n: PAL.n3, N: PAL.n1, g: PAL.g4, G: PAL.g5 },
  );
}

// Caju (fruta: cura)
function itemFruit() {
  return Pix.fromMap(
    [
      "....kk.....",
      "...kgGk....",
      "...kGk.....",
      "..kyyyk....",
      ".kyzyyyk...",
      ".kzwrrrrk..",
      "krrwrrrrRk.",
      "krrrrrrrRk.",
      "krrrrrrRRk.",
      ".kRrrrRRk..",
      "..kRRRRk...",
      "...kkkk....",
    ],
    { k: K, g: PAL.g5, G: PAL.g3, y: PAL.yel2, z: PAL.yel3, w: PAL.red3, r: PAL.red2, R: PAL.red1 },
  );
}

// Vácuo de Seiva: semente em espiral verde (puxa todas as gemas)
function itemVacuum() {
  return Pix.fromMap(
    [
      "...kkkkk...",
      "..kgGGGgk..",
      ".kGkkkkGgk.",
      "kGk.kkk.Ggk",
      "kGkkwwgk.Gk",
      "kGkwGGkGkGk",
      "kGk.kkGkkGk",
      "kgGk..kkGk.",
      ".kgGGGGGk..",
      "..kkggkk...",
      "....kk.....",
    ],
    { k: K, g: PAL.g6, G: PAL.g4, w: PAL.white },
  );
}

// Relógio da Mata: flor de gelo em forma de relógio (congela inimigos)
function itemClock() {
  return Pix.fromMap(
    [
      "....kkk....",
      "...kcwck...",
      ".kkkcbckkk.",
      "kcwkbbbkcck",
      "kcbbbKbbbbk",
      ".kkbKwKbkk.",
      "kcbbbKbbbbk",
      "kccKbbbkcbk",
      ".kkkcbckkk.",
      "...kcbck...",
      "....kkk....",
    ],
    { k: K, c: PAL.ice3, w: PAL.white, b: PAL.ice2, K: PAL.ice0 },
  );
}

// Sopro Ancestral: pena dourada (limpa a tela)
function itemBreath() {
  return Pix.fromMap(
    [
      "........kk.",
      ".......kzyk",
      "......kzyYk",
      ".....kzwyYk",
      "....kzwyYk.",
      "...kzyyYk..",
      "..kzyyYk...",
      ".kzyYYk....",
      ".kyYkk.....",
      "kYkk.......",
      "kk.........",
    ],
    { k: K, z: PAL.yel3, w: PAL.white, y: PAL.yel2, Y: PAL.yel1 },
  );
}

// CANDEEIRO DE BARRO (Caatinga, BIOMES.caatinga.lantern): pote de barro com
// pavio aceso sobre uma pedra. 2 quadros: a chama tremula.
function candeeiroFrames() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const p = new Pix(16, 22);
    // pedra de apoio
    p.ellipse(8, 20, 7, 1.8, PAL.s2);
    p.ellipse(7, 19.6, 4, 0.8, PAL.s3);
    // lamparina de barro EM PÉ: base larga, corpo de jarro, gargalo estreito
    for (let y = 9; y <= 19; y++) {
      const t = (y - 9) / 10;
      const half = y < 11 ? 2 : 2 + Math.sin(((y - 11) / 8) * Math.PI) * 3.6 + (y > 17 ? 0.5 : 0);
      for (let x = Math.round(8 - half); x <= Math.round(8 + half); x++) {
        const u = (x - (8 - half)) / (2 * half + 0.01);
        p.set(x, y, u < 0.3 ? PAL.clay3 : u < 0.7 ? PAL.clay2 : PAL.clay1);
      }
      if (y === 14) for (let x = 4; x <= 12; x += 2) if (p.get(x, y)) p.set(x, y, PAL.cream); // faixa pintada
      void t;
    }
    // boca e pavio
    p.rect(5, 8, 7, 1, PAL.clay1);
    p.set(8, 7, PAL.n1);
    // chama alta (tremula entre os quadros)
    const sway = f ? 1 : 0;
    const fl = [[8, 6, PAL.org1], [7, 5, PAL.org2], [8, 5, PAL.yel3], [9, 5, PAL.org2], [7 + sway, 4, PAL.yel2], [8, 4, PAL.yel3], [8 + sway, 3, PAL.yel3], [8 + sway, 2, PAL.yel2], [9 - sway, 1, PAL.org2]];
    for (const [x, y, c] of fl) p.set(x, y, c);
    frames.push(p.outline(K));
  }
  return frames;
}
function candeeiroBroken() {
  const p = new Pix(16, 22);
  p.ellipse(8, 20, 7, 1.8, PAL.s2);
  // cacos de barro espalhados e o pavio apagado
  for (const [x, y, w] of [[2, 17, 3], [7, 18, 4], [12, 16, 3], [5, 15, 2]]) {
    p.rect(x, y, w, 2, PAL.clay2);
    p.set(x, y, PAL.clay3);
  }
  p.set(10, 15, PAL.n1);
  p.set(11, 14, PAL.s3);
  return p.outline(K);
}

export function registerLanterns(scene) {
  registerStrip(scene, "px_candeeiro", candeeiroFrames());
  candeeiroBroken().register(scene, "px_candeeiro_broken");
  if (!scene.anims.exists("candeeiro_glow"))
    scene.anims.create({ key: "candeeiro_glow", frames: scene.anims.generateFrameNumbers("px_candeeiro", { frames: [0, 1] }), frameRate: 6, repeat: -1 });
  registerStrip(scene, "px_lantern", lanternFrames());
  lanternBroken().register(scene, "px_lantern_broken");
  itemFruit().register(scene, "px_item_fruit");
  itemVacuum().register(scene, "px_item_vacuum");
  itemClock().register(scene, "px_item_clock");
  itemBreath().register(scene, "px_item_breath");
  if (!scene.anims.exists("lantern_glow"))
    scene.anims.create({
      key: "lantern_glow",
      frames: scene.anims.generateFrameNumbers("px_lantern", { frames: [0, 1] }),
      frameRate: 2,
      repeat: -1,
    });
}
