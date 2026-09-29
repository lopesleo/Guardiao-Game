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

export function registerLanterns(scene) {
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
