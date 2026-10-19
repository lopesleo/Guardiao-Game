// Arte da Clareira Ancestral (skin do acampamento do Pacote Fundador, docs/COSMETICOS.md): além do jequitibá
// e da placa (CampDecor.js), o portal da trilha da floresta com esteios entalhados, lamparinas de cabaça,
// bancos entalhados com almofada, rede de varanda, cogumelos que brilham à noite (a "flor-de-coco" da mata
// atlântica), tapete de folhas de cobre, um tucano-toco, borboletas-azuis (morfo) e o estandarte dos Fundadores.
// Tudo em pixel, na paleta única; o brilho (aditivo) é posto pela cena.
import { PAL } from "./Palette.js";
import { Pix, bayer, rng, registerStrip } from "./PixelArt.js";

const K = PAL.ink;

// Esteio entalhado do portal: tronco com faixas talhadas e incrustação de cobre, ziguezague entre as faixas,
// ponteira de cobre e um gancho para o cordão das lamparinas
function makePost() {
  const p = new Pix(13, 52);
  const wood = (x) => (x <= 4 ? PAL.n4 : x <= 6 ? PAL.n3 : x <= 7 ? PAL.n2 : PAL.n1);
  for (let y = 8; y < 48; y++) for (let x = 4; x <= 8; x++) p.set(x, y, wood(x));
  // faixas talhadas (sulco escuro, borda clara e pontos de cobre)
  for (const by of [15, 28, 41]) {
    for (let x = 4; x <= 8; x++) {
      p.set(x, by, PAL.n1);
      p.set(x, by + 1, x <= 5 ? PAL.straw2 : PAL.n4);
      p.set(x, by + 2, PAL.n1);
    }
    p.set(5, by + 1, PAL.straw3);
    p.set(7, by + 1, PAL.clay2);
  }
  // ziguezague talhado entre as faixas
  for (const [y0, y1] of [[18, 28], [31, 41]])
    for (let y = y0; y < y1; y++) {
      const x = 5 + (Math.floor((y - y0) / 2) % 2 ? 2 : 0) + ((y - y0) % 2);
      if (x <= 8) p.set(x, y, PAL.n1);
    }
  // pé alargado com musgo
  for (let x = 3; x <= 9; x++) {
    p.set(x, 48, x <= 5 ? PAL.n3 : PAL.n2);
    p.set(x, 49, PAL.n1);
  }
  for (let x = 3; x <= 9; x++) if (bayer(x, 47) < 0.45) p.set(x, 47, PAL.g4);
  // ponteira de cobre (capitel) e a ponta
  for (let y = 3; y < 8; y++)
    for (let x = 3; x <= 9; x++) {
      const c = y === 7 ? PAL.clay1 : x <= 4 ? PAL.clay3 : x <= 7 ? PAL.clay2 : PAL.clay1;
      p.set(x, y, c);
    }
  p.set(4, 4, PAL.straw3);
  p.set(5, 4, PAL.straw3);
  p.rect(5, 1, 3, 2, PAL.clay2);
  p.set(5, 1, PAL.straw3);
  p.set(6, 0, PAL.straw2);
  // gancho do cordão (para os dois lados)
  for (const x of [1, 2, 10, 11]) p.set(x, 9, PAL.n2);
  p.set(1, 10, PAL.n2);
  p.set(11, 10, PAL.n2);
  return p.outline(K);
}

// Lamparina de cabaça: cabaça seca pendurada, furinhos por onde a luz escapa (2 quadros: a chama tremula)
function makeLamp(flicker) {
  const p = new Pix(9, 14);
  p.set(4, 0, PAL.n1);
  p.set(4, 1, PAL.n1);
  p.rect(3, 2, 3, 1, PAL.n2);
  // gargalo e corpo
  for (let y = 3; y < 14; y++)
    for (let x = 0; x < 9; x++) {
      const top = Math.hypot((x + 0.5 - 4.5) / 1.9, (y + 0.5 - 4.6) / 1.5) <= 1;
      const body = Math.hypot((x + 0.5 - 4.5) / 3.9, (y + 0.5 - 9.2) / 3.9) <= 1;
      if (!top && !body) continue;
      const u = (x + 0.5) / 9,
        v = (y - 3) / 11;
      let c = u < 0.35 ? PAL.straw3 : u < 0.7 ? PAL.straw2 : PAL.straw1;
      if (v > 0.85) c = PAL.straw1;
      p.set(x, y, c);
    }
  // furinhos com luz (o desenho troca um pouco entre os quadros)
  const holes = flicker ? [[3, 8], [5, 8], [4, 10], [2, 10], [6, 10], [4, 12]] : [[3, 8], [5, 8], [4, 10], [2, 10], [6, 10], [3, 12], [5, 12]];
  for (const [x, y] of holes) p.set(x, y, (x + y + (flicker ? 1 : 0)) % 3 ? PAL.yel3 : PAL.cream);
  return p.outline(K);
}

// Banco entalhado: o tronco de sentar com faixas talhadas e uma almofada de tecido listrado
function makeBench() {
  const p = new Pix(28, 11);
  for (let x = 3; x < 25; x++)
    for (let y = 3; y < 10; y++) {
      let c = y < 5 ? PAL.n3 : y > 7 ? PAL.n1 : PAL.n2;
      if ((x * 5 + y * 2) % 11 === 0) c = PAL.n1;
      p.set(x, y, c);
    }
  p.ellipse(3.5, 6.5, 2.6, 3.4, PAL.n4);
  p.ellipse(3.5, 6.5, 1.4, 2, PAL.n3);
  p.set(3, 6, PAL.n2);
  // faixas talhadas com cobre
  for (const bx of [8, 21]) {
    for (let y = 4; y < 10; y++) p.set(bx, y, PAL.n1);
    for (let y = 5; y < 9; y += 2) p.set(bx + 1, y, PAL.straw2);
  }
  // almofada listrada (creme, barro, palha) com franja nas pontas
  const stripe = [PAL.cream, PAL.clay2, PAL.cream, PAL.straw2];
  for (let x = 10; x < 20; x++) {
    p.set(x, 1, stripe[Math.floor((x - 10) / 2) % 4]);
    p.set(x, 2, stripe[Math.floor((x - 10) / 2) % 4]);
    p.set(x, 3, PAL.clay1);
  }
  p.set(9, 2, PAL.straw2);
  p.set(20, 2, PAL.straw2);
  return p.outline(K);
}

// Rede de varanda: pano tecido em losangos de creme, barro e palha, com a varanda (franja longa) embaixo
function makeHammockAnc() {
  const p = new Pix(46, 32);
  for (const x of [2, 42]) {
    for (let y = 2; y < 32; y++) {
      p.set(x, y, PAL.n3);
      p.set(x + 1, y, PAL.n2);
    }
    p.rect(x - 1, 1, 4, 2, PAL.n2);
    p.set(x, 1, PAL.straw2); // anel de cobre no topo do esteio
  }
  p.line(4, 6, 9, 12, PAL.straw3);
  p.line(41, 6, 36, 12, PAL.straw3);
  for (let x = 9; x <= 36; x++) {
    const t = (x - 9) / 27;
    const sag = Math.sin(t * Math.PI) * 7;
    const top = Math.round(11 + sag),
      bot = Math.round(16 + sag * 1.15);
    // tecido em faixas: barra de palha, ziguezague de barro no meio, barra de barro embaixo
    const zig = (x - 9) % 4;
    for (let y = top; y <= bot; y++) {
      const dy = y - top;
      let c = PAL.cream;
      if (dy === 1) c = PAL.straw2;
      if ((dy === 3 && zig < 2) || (dy === 4 && zig >= 2)) c = PAL.clay2;
      if (y === bot) c = PAL.clay1;
      p.set(x, y, c);
    }
    p.set(x, top, PAL.straw3);
    // varanda: franja longa alternando creme e barro
    const len = 3 + ((x * 7) % 3);
    for (let k = 1; k <= len; k++) if (x % 2 === 0) p.set(x, bot + k, k === len ? PAL.clay1 : x % 4 === 0 ? PAL.cream : PAL.clay3);
  }
  return p.outline(K);
}

// Cogumelos "flor-de-coco" (brilham verde à noite): três chapéus claros num toco de musgo
function makeShrooms(seed) {
  const p = new Pix(12, 9);
  const r = rng(seed);
  // toquinho de musgo
  p.ellipse(6, 7.5, 5.5, 1.6, PAL.g3);
  for (let x = 1; x < 11; x++) if (bayer(x, 7) < 0.4) p.set(x, 7, PAL.g4);
  const caps = [[3 + Math.floor(r() * 2), 5, 2.2], [7, 4, 2.8], [9 + Math.floor(r() * 2), 6, 1.6]];
  for (const [x, y, rad] of caps) {
    for (let yy = y; yy <= 7; yy++) p.set(x, yy, PAL.cream); // pé
    p.ellipse(x, y - 1, rad, rad * 0.75, PAL.wnd3);
    for (let xx = Math.round(x - rad + 1); xx <= Math.round(x + rad - 1); xx++) p.set(xx, y, PAL.wnd1); // lamelas
    p.set(Math.round(x - rad * 0.4), y - 2, PAL.white);
    p.set(Math.round(x + rad * 0.5), y - 1, PAL.wnd2);
  }
  return p.outline(K);
}

// Tapete de folhas de cobre (decalque no chão, sem contorno): três variações
function makeLeafCarpet(seed) {
  const p = new Pix(26, 10);
  const r = rng(seed);
  const cols = [PAL.clay2, PAL.clay3, PAL.straw2, PAL.yel1, PAL.n3, PAL.clay1];
  for (let k = 0; k < 26; k++) {
    // mais folhas no meio, rareando para as pontas
    const u = r(),
      x = Math.round(13 + (u - 0.5) * 24 * (0.5 + r() * 0.5)),
      y = Math.round(5 + (r() - 0.5) * 8 * (1 - Math.abs(u - 0.5)));
    const c = cols[Math.floor(r() * cols.length)];
    p.set(x, y, c);
    if (r() < 0.6) p.set(x + 1, y, c);
    if (r() < 0.25) p.set(x, y - 1, PAL.clay1); // talo/sombra
  }
  return p;
}

// Tucano-toco pousado, de perfil para a esquerda: 0 parado, 1 piscando, 2 bico para o alto
function makeToucan(f) {
  const p = new Pix(18, 15);
  const up = f === 2 ? 1 : 0;
  // corpo preto (cinza-escuro, o preto puro é do contorno) e cauda
  p.ellipse(11, 8.5, 3.6, 4.6, PAL.s0);
  p.ellipse(10.4, 7.6, 1.4, 2.4, PAL.inkSoft);
  for (let y = 11; y < 15; y++) p.set(13, y, PAL.s0);
  p.set(14, 13, PAL.s0);
  // cabeça
  p.ellipse(9, 4 - up * 0.5, 2.6, 2.4, PAL.s0);
  // garganta branca
  p.ellipse(8.4, 6.6, 1.6, 1.8, PAL.cream);
  p.set(8, 8, PAL.yel3);
  // bico enorme laranja, ponta preta (sobe um pouco no quadro 2)
  for (let x = 0; x <= 7; x++) {
    const yTop = 3 - up * Math.round((7 - x) / 3);
    const h = x < 2 ? 1 : x < 5 ? 2 : 3;
    for (let y = yTop; y < yTop + h; y++) p.set(x, y, x < 2 ? PAL.s0 : y === yTop ? PAL.org3 : PAL.org2);
    if (x >= 2) p.set(x, yTop + h - 1, PAL.org1);
  }
  // olho com o anel azul
  if (f === 1) {
    p.set(9, 3 - up, PAL.ice1);
    p.set(10, 3 - up, PAL.ice1);
  } else {
    p.set(9, 3 - up, PAL.ice2);
    p.set(10, 3 - up, PAL.white);
  }
  // pés
  p.set(10, 13, PAL.ice1);
  p.set(12, 13, PAL.ice1);
  // crisso vermelho sob a cauda
  p.set(12, 12, PAL.red2);
  return p.outline(K);
}

// Desenho por mapa de letras (como os ícones): cada letra uma cor da paleta, "." vazio
function fromMap(rows, legend) {
  const p = new Pix(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => legend[ch] != null && p.set(x, y, legend[ch])));
  return p;
}

// Borboleta-azul (morfo): 0 asas abertas (o azul faísca, borda escura com pintas brancas), 1 fechadas (o
// avesso marrom com os olhos)
const MORPHO = { k: K, b: PAL.ice1, B: PAL.ice2, C: PAL.ice3, s: PAL.s0, w: PAL.cream, n: PAL.n3, N: PAL.n2, y: PAL.straw3 };
function makeMorpho(f) {
  const rows =
    f === 0
      ? ["kkk.....kkk", "kBBk...kBBk", "kCBBk.kBBCk", "kCBBbsbBBCk", "kBBBbsbBBBk", ".kBbbsbbBk.", "..kbkskbk..", ".kbBk.kBbk.", ".kwk...kwk."]
      : ["...........", ".....k.....", "....knk....", "...knNnk...", "...kNyNk...", "...knNnk...", "....kNk....", ".....s.....", "..........."];
  return fromMap(rows, MORPHO).outline(K);
}

// Estandarte dos Fundadores: haste com ponta de cobre, pano barro de borda creme, medalhão (anel dourado com a
// copa) e franja; 3 quadros de vento
function makeBanner(f) {
  const p = new Pix(16, 40);
  for (let y = 2; y < 40; y++) {
    p.set(2, y, PAL.n3);
    p.set(3, y, PAL.n2);
  }
  p.set(2, 0, PAL.straw3);
  p.rect(1, 1, 4, 2, PAL.clay2);
  for (let x = 2; x < 15; x++) p.set(x, 4, PAL.n2); // travessa
  p.set(14, 3, PAL.clay2);
  const sway = [0, 1, 0][f],
    tail = [0, 1, 2][f];
  for (let y = 5; y < 27; y++) {
    const off = Math.round(((y - 5) / 22) * sway);
    for (let x = 5; x < 14; x++) {
      const X = x + off;
      const edge = x === 5 || x === 13 || y === 5;
      p.set(X, y, edge ? PAL.cream : y % 6 === 0 ? PAL.clay2 : PAL.clay1);
    }
  }
  // medalhão
  for (let y = 9; y < 18; y++)
    for (let x = 5; x < 14; x++) {
      const d = Math.hypot(x - 9, y - 13);
      if (d > 3.8) continue;
      const X = x + Math.round(((y - 5) / 22) * sway);
      p.set(X, y, d > 2.7 ? (x + y < 22 ? PAL.yel3 : PAL.yel1) : y < 13 ? PAL.g5 : y < 15 ? PAL.g3 : PAL.n3);
    }
  // ponta em V com borlas de palha
  for (let x = 5; x < 14; x++) {
    const depth = 27 + (4 - Math.abs(x - 9));
    for (let y = 27; y < depth; y++) p.set(x + sway + (y > 29 ? tail - 1 : 0), y, PAL.clay1);
  }
  p.set(9 + sway + tail - 1, 31 + 1, PAL.straw2);
  p.set(5 + sway, 27, PAL.straw2);
  p.set(13 + sway, 27, PAL.straw2);
  return p.outline(K);
}

export function registerCampAncestral(scene) {
  makePost().register(scene, "camp_anc_post");
  registerStrip(scene, "camp_anc_lamp", [makeLamp(false), makeLamp(true)]);
  makeBench().register(scene, "camp_anc_bench");
  makeHammockAnc().register(scene, "camp_anc_hammock");
  registerStrip(scene, "camp_anc_shrooms", [makeShrooms(11), makeShrooms(29), makeShrooms(47)]);
  registerStrip(scene, "camp_anc_leaves", [makeLeafCarpet(3), makeLeafCarpet(8), makeLeafCarpet(15)]);
  registerStrip(scene, "camp_anc_toucan", [makeToucan(0), makeToucan(1), makeToucan(2)]);
  registerStrip(scene, "camp_anc_morpho", [makeMorpho(0), makeMorpho(1)]);
  registerStrip(scene, "camp_anc_banner", [makeBanner(0), makeBanner(1), makeBanner(2)]);
}
