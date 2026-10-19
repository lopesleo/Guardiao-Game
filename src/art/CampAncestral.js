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

// Tucano-toco pousado, de perfil para a esquerda. Quadros: 0 parado, 1 piscando, 2 bico para o alto, 3 bico para
// baixo (alisando a pena do peito), 4 respirando (peito um pouco mais cheio, cabeça meio pixel abaixo)
function makeToucan(f) {
  const p = new Pix(18, 16);
  const tilt = f === 2 ? 1 : f === 3 ? -1 : 0;
  const breath = f === 4 ? 1 : 0;
  const hy = 4 + (f === 3 ? 1 : 0) + breath * 0.5; // a cabeça desce ao alisar e ao respirar
  // corpo preto (cinza-escuro: o preto puro é do contorno), peito mais cheio ao respirar, e a cauda
  p.ellipse(11, 9, 3.6 + breath * 0.4, 4.6 + breath * 0.3, PAL.s0);
  p.ellipse(10.4, 8, 1.4, 2.4, PAL.inkSoft); // brilho da asa
  for (let y = 12; y < 16; y++) p.set(13, y, PAL.s0);
  p.set(14, 14, PAL.s0);
  p.set(14, 15, PAL.s0);
  // cabeça
  p.ellipse(9, hy, 2.6, 2.4, PAL.s0);
  // garganta branca com a franja amarela
  p.ellipse(8.4, hy + 2.8, 1.6, 1.8, PAL.cream);
  p.set(8, Math.round(hy + 4.4), PAL.yel3);
  p.set(9, Math.round(hy + 4.4), PAL.yel2);
  // bico enorme: laranja com a quilha clara em cima, a base escura e a ponta preta; inclina com o quadro
  for (let x = 0; x <= 7; x++) {
    const yTop = Math.round(hy - 1 - tilt * ((7 - x) / 3));
    const h = x < 2 ? 1 : x < 5 ? 2 : 3;
    for (let y = yTop; y < yTop + h; y++) p.set(x, y, x < 2 ? PAL.s0 : y === yTop ? PAL.org3 : PAL.org2);
    if (x >= 2) p.set(x, yTop + h - 1, PAL.org1);
  }
  // olho com o anel azul (fechado no quadro 1)
  const ey = Math.round(hy - 1);
  if (f === 1) {
    p.set(9, ey, PAL.ice1);
    p.set(10, ey, PAL.ice1);
  } else {
    p.set(9, ey, PAL.ice2);
    p.set(10, ey, PAL.white);
    p.set(10, ey + 1, PAL.ice1);
  }
  // pés no poleiro e o crisso vermelho sob a cauda
  p.set(10, 14, PAL.ice1);
  p.set(12, 14, PAL.ice1);
  p.set(12, 13, PAL.red2);
  return p.outline(K);
}

// Desenho por mapa de letras (como os ícones): cada letra uma cor da paleta, "." vazio
function fromMap(rows, legend) {
  const p = new Pix(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => legend[ch] != null && p.set(x, y, legend[ch])));
  return p;
}

// Borboleta-azul (morfo), vista de cima, batendo as asas. 0 abertas (o azul faísca, borda azul-escura, pintas
// brancas), 1 a ¾ e 2 a meio caminho (a asa encurta em perspectiva e escurece), 3 quase de pé (aparece a borda do
// avesso marrom), 4 fechadas para cima (só o avesso, com os olhos). Voando: 0-1-2-3-4-3-2-1; pousada: 4, abrindo
// devagar até 2 de vez em quando
const MORPHO = { d: PAL.ice0, b: PAL.ice1, B: PAL.ice2, C: PAL.ice3, s: PAL.s0, w: PAL.cream, n: PAL.n3, N: PAL.n2, y: PAL.straw3 };
const MORPHO_FRAMES = [
  ["dd...........dd", "dCdd.......ddCd", "dCBBd.....dBBCd", "dBCBBd.s.dBBCBd", ".dBBBbdsdbBBBd.", "..dbbbbsbbbbd..", "..dBBbdsdbBBd..", ".dBBBBd.dBBBBd.", ".dBBBd...dBBBd.", "..dwd.....dwd..", "..............."],
  [".dd.........dd.", ".dCd.......dCd.", ".dCBd.....dBCd.", ".dBBBd.s.dBBBd.", "..dBBbdsdbBBd..", "...dbbbsbbbd...", "...dBbdsdbBd...", "..dBBBd.dBBBd..", "..dBBd...dBBd..", "...dw.....wd...", "..............."],
  ["...............", "...dd.....dd...", "...dBd...dBd...", "...dbBdsdBbd...", "....dbbsbbd....", "....dbbsbbd....", "....dBdsdBd....", "...dbBd.dBbd...", "...dbd...dbd...", "...............", "..............."],
  ["...............", "...............", ".....dd.dd.....", ".....dnsnd.....", ".....dbsbd.....", ".....dnsnd.....", ".....dbsbd.....", ".....dnsnd.....", ".....dd.dd.....", "...............", "..............."],
  ["...............", "...............", "......d.d......", "......nsn......", ".....nNsNn.....", ".....nysyn.....", ".....nNsNn.....", ".....nysyn.....", "......nsn......", "......d.d......", "..............."],
];
export const MORPHO_FLAP = [0, 1, 2, 3, 4, 3, 2, 1];
function makeMorpho(f) {
  return fromMap(MORPHO_FRAMES[f], MORPHO).outline(K);
}

// Estandarte dos Fundadores: haste com ponta de cobre e travessa, pano barro de borda creme com o medalhão (anel
// dourado com a copa) e a ponta em V com borlas de palha. 6 quadros de uma onda que corre de cima para baixo: o
// pano preso na travessa mexe pouco em cima e mais na ponta solta
function makeBanner(f) {
  const p = new Pix(18, 40);
  for (let y = 2; y < 40; y++) {
    p.set(2, y, PAL.n3);
    p.set(3, y, PAL.n2);
  }
  p.set(2, 0, PAL.straw3);
  p.rect(1, 1, 4, 2, PAL.clay2);
  for (let x = 2; x < 15; x++) p.set(x, 4, PAL.n2); // travessa
  p.set(14, 3, PAL.clay2);
  // o pano sem onda (x 5..13, y 5..31), depois cada linha desloca pela onda
  const cloth = [];
  for (let y = 5; y < 32; y++) {
    const row = [];
    for (let x = 5; x < 14; x++) {
      let c = null;
      if (y < 27) {
        const edge = x === 5 || x === 13 || y === 5;
        c = edge ? PAL.cream : y % 6 === 0 ? PAL.clay2 : PAL.clay1;
        const d = Math.hypot(x - 9, y - 13);
        if (d <= 3.8) c = d > 2.7 ? (x + y < 22 ? PAL.yel3 : PAL.yel1) : y < 13 ? PAL.g5 : y < 15 ? PAL.g3 : PAL.n3;
      } else if (y < 27 + (4 - Math.abs(x - 9))) c = PAL.clay1; // ponta em V
      if ((y === 27 && (x === 5 || x === 13)) || (y === 31 && x === 9)) c = PAL.straw2; // borlas
      row.push(c);
    }
    cloth.push(row);
  }
  const ph = (f / 6) * Math.PI * 2;
  cloth.forEach((row, i) => {
    const k = i / (cloth.length - 1); // 0 na travessa, 1 na ponta
    const off = Math.round(Math.sin(i * 0.38 - ph) * (0.4 + k * 1.6));
    row.forEach((c, j) => c != null && p.set(5 + j + off, 5 + i, c));
  });
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// HORTA ANCESTRAL: a cerca, o portal e o espantalho da horta na mesma madeira entalhada com cobre e no mesmo pano
// tecido da rede e do estandarte
// ---------------------------------------------------------------------------

// Cerca (ladrilho de 40, período 8): estacas entalhadas com ponteira de cobre na frente de duas travessas, um
// trançado de palha em sarja entre elas e amarras de barro nos cruzamentos. Com w = 6 vira o mourão das laterais.
function makeFenceAnc(w) {
  const p = new Pix(w, 14);
  for (let x = 0; x < w; x++) {
    p.set(x, 3, PAL.n3);
    p.set(x, 4, PAL.n1);
    for (let y = 5; y <= 8; y++) {
      const t = (x + y) % 4;
      p.set(x, y, t < 2 ? PAL.straw3 : t === 2 ? PAL.straw2 : PAL.straw1); // sarja: diagonal da trama
    }
    p.set(x, 9, PAL.n3);
    p.set(x, 10, PAL.n1);
  }
  for (let x0 = 1; x0 < w - 1; x0 += 8) {
    for (let y = 2; y < 14; y++) {
      p.set(x0, y, PAL.n4);
      p.set(x0 + 1, y, PAL.n3);
      p.set(x0 + 2, y, PAL.n2);
    }
    // sulco talhado e um ponto de cobre
    for (let x = x0; x <= x0 + 2; x++) p.set(x, 12, PAL.n1);
    p.set(x0 + 1, 7, PAL.n1);
    p.set(x0 + 1, 6, PAL.clay2);
    // ponteira de cobre
    p.set(x0, 1, PAL.clay3);
    p.set(x0 + 1, 1, PAL.clay2);
    p.set(x0 + 2, 1, PAL.clay1);
    p.set(x0 + 1, 0, PAL.straw3);
    p.set(x0, 2, PAL.clay2);
    p.set(x0 + 1, 2, PAL.clay1);
    p.set(x0 + 2, 2, PAL.clay0);
    // amarras de barro onde a estaca cruza as travessas
    for (const y of [3, 9]) {
      if (x0 > 0) p.set(x0 - 1, y + 1, PAL.clay1);
      if (x0 + 3 < w) p.set(x0 + 3, y, PAL.clay1);
    }
  }
  // capim no pé, entre as estacas
  for (const [x, y, c] of [[5, 13, PAL.g4], [6, 12, PAL.g5], [6, 13, PAL.g3], [21, 13, PAL.g4], [22, 12, PAL.g5], [30, 13, PAL.g3], [37, 13, PAL.g4], [38, 12, PAL.g5]])
    if (x < w) p.set(x, y, c);
  return p.outline(K);
}

// Portal da horta (38×44; o vão fica do tamanho do de sempre): dois esteios entalhados com ponteira de cobre
// atravessando a viga, viga talhada em ziguezague com tachas de cobre, sanefa de palha franjada e os ganchos das
// pontas, de onde a cena pendura duas lamparinas. A placa do broto é outra peça (balança ao vento).
export const ARCH_ANC = { w: 38, h: 44, hookY: 15, hooks: [2, 35], plaqueY: 14 };
function makeGardenArchAnc() {
  const { w: W, h: H } = ARCH_ANC;
  const p = new Pix(W, H);
  const wood = (u) => (u === 0 ? PAL.n4 : u < 3 ? PAL.n3 : PAL.n2);
  for (const x0 of [6, 28]) {
    for (let y = 9; y < H - 2; y++) for (let u = 0; u < 4; u++) p.set(x0 + u, y, wood(u));
    // faixas talhadas com incrustação
    for (const by of [19, 31]) {
      for (let u = 0; u < 4; u++) {
        p.set(x0 + u, by, PAL.n1);
        p.set(x0 + u, by + 1, u < 2 ? PAL.straw2 : PAL.n4);
        p.set(x0 + u, by + 2, PAL.n1);
      }
      p.set(x0 + 1, by + 1, PAL.straw3);
      p.set(x0 + 2, by + 1, PAL.clay2);
    }
    // ziguezague talhado entre as faixas
    for (const [y0, y1] of [[22, 31], [34, 41]])
      for (let y = y0; y < y1; y++) p.set(x0 + 1 + (Math.floor((y - y0) / 2) % 2) + ((y - y0) % 2), y, PAL.n1);
    // pé alargado com musgo
    for (let x = x0 - 1; x <= x0 + 4; x++) {
      p.set(x, H - 2, x <= x0 ? PAL.n3 : PAL.n2);
      p.set(x, H - 1, PAL.n1);
      if (bayer(x, H - 3) < 0.5) p.set(x, H - 3, PAL.g4);
    }
    // ponteira de cobre em cima da viga
    for (let y = 3; y < 9; y++) {
      const half = y < 5 ? 1 : 2;
      for (let x = x0 + 2 - half; x < x0 + 2 + half; x++) {
        const u = x - (x0 + 2 - half);
        p.set(x, y, y === 8 ? PAL.clay1 : u === 0 ? PAL.clay3 : u === half * 2 - 1 ? PAL.clay1 : PAL.clay2);
      }
    }
    p.set(x0 + 1, 2, PAL.clay2);
    p.set(x0 + 2, 2, PAL.clay1);
    p.set(x0 + 1, 1, PAL.straw3);
    p.set(x0 + 1, 5, PAL.straw3); // brilho do cobre
  }
  // viga: topo claro, ziguezague talhado, sombra embaixo; colar de cobre onde o esteio atravessa
  for (let x = 1; x < W - 1; x++) {
    if ((x >= 6 && x <= 9) || (x >= 28 && x <= 31)) {
      p.set(x, 9, PAL.clay1);
      for (let y = 10; y <= 12; y++) p.set(x, y, wood(x >= 28 ? x - 28 : x - 6));
      p.set(x, 13, PAL.n1);
      continue;
    }
    p.set(x, 9, PAL.n4);
    p.set(x, 10, PAL.n3);
    p.set(x, 11, PAL.n3);
    p.set(x, 12, PAL.n2);
    p.set(x, 13, PAL.n1);
    p.set(x, x % 4 < 2 ? 10 : 11, PAL.n1);
  }
  for (const x of [1, W - 2]) {
    p.set(x, 9, PAL.n3);
    p.set(x, 13, PAL.n1);
  }
  for (const x of [4, 14, 23, 33]) p.set(x, 12, PAL.clay2); // tachas
  // sanefa de palha franjada entre os esteios
  for (let x = 10; x < 28; x++) {
    p.set(x, 14, PAL.straw2);
    if (x % 3 !== 1) p.set(x, 15, x % 3 ? PAL.straw3 : PAL.straw1);
    if (x % 3 === 0) p.set(x, 16, PAL.straw1);
  }
  // ganchos das lamparinas
  for (const hx of ARCH_ANC.hooks) {
    p.set(hx, 14, PAL.n2);
    p.set(hx, 15, PAL.n2);
  }
  return p.outline(K);
}

// Placa do broto, pendurada por dois cordões na viga: tábua com moldura de cobre e o broto pintado
function makeGardenPlaqueAnc() {
  const p = new Pix(14, 13);
  for (let y = 0; y < 3; y++) {
    p.set(3, y, PAL.straw1);
    p.set(10, y, PAL.straw1);
  }
  for (let y = 3; y < 13; y++)
    for (let x = 1; x < 13; x++) {
      if ((x === 1 || x === 12) && (y === 3 || y === 12)) continue; // cantos arredondados
      const edge = x === 1 || x === 12 || y === 3 || y === 12;
      p.set(x, y, edge ? (x === 1 || y === 3 ? PAL.clay3 : PAL.clay1) : y < 5 ? PAL.n4 : PAL.n3);
    }
  // broto: terra, caule e duas folhas
  p.rect(5, 10, 4, 1, PAL.n1);
  p.rect(6, 7, 2, 3, PAL.g4);
  p.set(6, 7, PAL.g5);
  p.set(5, 6, PAL.g5);
  p.set(4, 5, PAL.g6);
  p.set(5, 5, PAL.g5);
  p.set(8, 6, PAL.g4);
  p.set(9, 5, PAL.g5);
  p.set(9, 4, PAL.g6);
  p.set(3, 4, PAL.straw3); // brilho da moldura
  return p.outline(K);
}

// Espantalho da horta (26×40, 6 quadros de vento): poncho tecido com faixa de palha, ziguezague de barro e
// losangos azuis, franja longa; cabeça de saco com olhos de botão e sorriso cosido, chapéu largo com fita de
// cobre e uma pena de borboleta-azul, broche de cobre na gola. O vento corre em onda pela franja, pelos punhos
// e pela pena. A lamparina do braço é outra peça (a cena pendura em SCARECROW_ANC.hook).
export const SCARECROW_ANC = { w: 26, h: 40, hook: { x: 23.5, y: 20 } };
function makeScarecrowAnc(f) {
  const { w: W, h: H } = SCARECROW_ANC;
  const p = new Pix(W, H);
  const ph = (f / 6) * Math.PI * 2;
  const wave = (x, a) => Math.round(Math.sin(x * 0.55 - ph) * a);
  // estaca entalhada e o braço
  for (let y = 17; y < H - 1; y++) {
    p.set(12, y, PAL.n3);
    p.set(13, y, PAL.n2);
  }
  p.set(12, 32, PAL.n1);
  p.set(13, 32, PAL.n1);
  p.set(12, 33, PAL.clay2);
  p.set(13, 33, PAL.n4);
  p.set(12, 34, PAL.n1);
  p.set(13, 34, PAL.n1);
  for (let x = 10; x <= 15; x++) {
    p.set(x, H - 1, x <= 12 ? PAL.n3 : PAL.n2);
    if (bayer(x, H - 2) < 0.5 && (x < 12 || x > 13)) p.set(x, H - 2, PAL.g4);
  }
  for (let x = 2; x <= 23; x++) {
    p.set(x, 18, PAL.n3);
    p.set(x, 19, PAL.n2);
  }
  // poncho: trapézio dos ombros (y 16) à barra (y 26), trama em faixas; sombra na coluna da direita
  const top = 16,
    hem = 26;
  const halfAt = (y) => 4 + Math.round((y - top) * 0.36);
  for (let y = top; y <= hem; y++) {
    const dy = y - top,
      half = halfAt(y);
    for (let x = 13 - half; x <= 12 + half; x++) {
      let c = PAL.cream;
      if (dy === 2) c = PAL.straw2;
      if ((dy === 4 && (x + 1) % 4 < 2) || (dy === 5 && (x + 1) % 4 >= 2)) c = PAL.clay2;
      if (x % 4 === 1 && dy >= 7 && dy <= 9) c = dy === 8 ? PAL.ice2 : PAL.ice1; // losangos azuis (a cor das borboletas)
      if ((x % 4 === 0 || x % 4 === 2) && dy === 8) c = PAL.ice1;
      if (y === hem) c = PAL.clay1;
      if (x === 12 + half) c = c === PAL.cream ? PAL.straw3 : c === PAL.clay2 ? PAL.clay1 : c === PAL.straw2 ? PAL.straw1 : c === PAL.ice2 ? PAL.ice1 : c === PAL.ice1 ? PAL.ice0 : c;
      p.set(x, y, c);
    }
  }
  // mangas finas no braço, punho que bate ao vento e palha saindo
  for (const side of [-1, 1]) {
    const inner = side < 0 ? 13 - halfAt(18) - 1 : 12 + halfAt(18) + 1,
      cuff = side < 0 ? 4 : 21;
    for (let x = Math.min(inner, cuff); x <= Math.max(inner, cuff); x++) {
      p.set(x, 18, (x + 1) % 4 < 2 ? PAL.clay2 : PAL.cream);
      p.set(x, 19, PAL.straw2);
    }
    const d = wave(cuff, 0.9);
    p.set(cuff, 18, PAL.clay1);
    p.set(cuff, 19, PAL.clay1);
    p.set(cuff, 20 + (d > 0 ? 1 : 0), PAL.clay1);
    p.set(cuff - side, 20, PAL.clay1);
    p.set(cuff + side, 18, PAL.straw3);
    p.set(cuff + side * 2, 19 + (d !== 0 ? 1 : 0), PAL.straw2);
    p.set(cuff + side, 20, PAL.straw3);
  }
  // franja longa: a onda corre da esquerda para a direita e o fio de baixo mexe mais
  const fh = halfAt(hem);
  for (let x = 13 - fh; x <= 12 + fh; x++) {
    const c = x % 2 ? PAL.cream : PAL.clay2;
    p.set(x + wave(x, 0.5), hem + 1, c);
    p.set(x + wave(x, 1.1), hem + 2, c);
    if ((x * 7) % 3 === 0) p.set(x + wave(x, 1.5), hem + 3, c);
  }
  // gola com broche de cobre
  for (let x = 11; x <= 14; x++) p.set(x, 16, PAL.clay1);
  p.set(12, 17, PAL.clay2);
  p.set(13, 17, PAL.clay2);
  p.set(12, 16, PAL.straw3);
  p.set(13, 16, PAL.clay2);
  // cabeça de saco: trama, olhos de botão, bochechas e sorriso cosido; amarra no pescoço
  p.disc(12.5, 11, 4.3, PAL.straw3);
  for (let y = 6; y <= 16; y++)
    for (let x = 7; x <= 18; x++) {
      if (p.alpha(x, y) === 0) continue;
      if (Math.hypot(x - 14, y - 12.5) > 3.6 && x + y > 22) p.set(x, y, PAL.straw2);
      else if (bayer(x, y) < 0.12) p.set(x, y, PAL.straw2);
    }
  for (const [x, y] of [[10, 10], [10, 11], [15, 10], [15, 11]]) p.set(x, y, K); // olhos de botão
  p.set(9, 12, PAL.clay3);
  p.set(16, 12, PAL.clay3);
  for (const [x, y] of [[10, 13], [11, 14], [13, 14], [15, 13]]) p.set(x, y, K); // sorriso cosido, ponto a ponto
  p.set(12, 14, PAL.n1);
  p.set(14, 14, PAL.n1);
  for (let x = 10; x <= 15; x++) p.set(x, 15, x % 2 ? PAL.straw1 : PAL.clay1);
  // chapéu de aba larga com trama e fita de cobre
  for (let x = 3; x <= 22; x++) {
    p.set(x, 7, x < 6 || x > 19 ? PAL.straw2 : PAL.straw3);
    p.set(x, 8, PAL.straw1);
  }
  for (let x = 5; x <= 20; x++) p.set(x, 6, PAL.straw3);
  for (let y = 1; y <= 5; y++) {
    const half = y === 1 ? 3 : y === 2 ? 4 : 5;
    for (let x = 13 - half; x < 13 + half; x++) p.set(x, y, x < 11 ? PAL.straw3 : (x + y) % 3 === 0 ? PAL.straw1 : PAL.straw2);
  }
  for (let x = 8; x < 18; x++) p.set(x, 5, x === 10 ? PAL.straw3 : PAL.clay2);
  // pena de borboleta-azul na fita (a ponta acompanha o vento)
  const tip = wave(30, 0.8);
  p.line(17, 5, 19, 2, PAL.ice1);
  p.set(18, 3, PAL.ice2);
  p.set(19, 3, PAL.ice2);
  p.set(20 + tip, 1, PAL.ice2);
  p.set(20 + tip, 0, PAL.ice3);
  p.set(19, 1, PAL.ice0);
  return p.outline(K);
}

export function registerCampAncestral(scene) {
  makePost().register(scene, "camp_anc_post");
  registerStrip(scene, "camp_anc_lamp", [makeLamp(false), makeLamp(true)]);
  makeBench().register(scene, "camp_anc_bench");
  makeHammockAnc().register(scene, "camp_anc_hammock");
  registerStrip(scene, "camp_anc_shrooms", [makeShrooms(11), makeShrooms(29), makeShrooms(47)]);
  registerStrip(scene, "camp_anc_leaves", [makeLeafCarpet(3), makeLeafCarpet(8), makeLeafCarpet(15)]);
  registerStrip(scene, "camp_anc_toucan", [0, 1, 2, 3, 4].map(makeToucan));
  registerStrip(scene, "camp_anc_morpho", [0, 1, 2, 3, 4].map(makeMorpho));
  registerStrip(scene, "camp_anc_banner", [0, 1, 2, 3, 4, 5].map(makeBanner));
  makeFenceAnc(40).register(scene, "garden_anc_fence");
  makeFenceAnc(6).register(scene, "garden_anc_fence_post");
  makeGardenArchAnc().register(scene, "garden_anc_arch");
  makeGardenPlaqueAnc().register(scene, "garden_anc_plaque");
  registerStrip(scene, "camp_anc_scarecrow", [0, 1, 2, 3, 4, 5].map(makeScarecrowAnc));
}

// Voo da borboleta-azul (a Clareira e a prévia do Guarda-roupa usam o mesmo): passeia em volta de um ponto em
// curvas suaves (vira devagar, nunca em ângulo), o corpo sobe na descida das asas, plana de asas abertas de vez
// em quando e pousa nos pontos de pouso (asas fechadas, abrindo devagar) antes de seguir. A sombra fica no chão e
// encolhe e clareia com a altura. Devolve update(agora em ms): chamar a cada quadro.
//   o = { sprite, shadow, home: {x, y}, radius, scale (pixel da arte), perches: [{x, y}], depth: (y, alt) => n }
export function morphoFlight(o) {
  const k = o.scale / 3; // tudo foi pensado no tamanho do mundo (pixel de arte = 3)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const st = { x: o.home.x + rnd(-20, 20), y: o.home.y + rnd(-20, 20), alt: 26 * k, head: rnd(0, Math.PI * 2), turn: 0, mode: "fly", until: 0, last: 0, t0: rnd(0, 2000), perch: null, face: 1 };
  let nextTurn = 0,
    nextGlide = 0;
  return (now) => {
    const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016);
    st.last = now;
    const spr = o.sprite;
    if (!spr.active) return;
    let frame;
    if (st.mode === "perched") {
      // pousada: asas fechadas, abrindo devagar até a metade de vez em quando (4-3-2-3-4)
      st.alt = Math.max(0, st.alt - 60 * k * dt);
      const c = (now - st.t0) % 2400;
      frame = c < 1500 ? 4 : [3, 2, 2, 3][Math.floor((c - 1500) / 225)] ?? 4;
      if (now > st.until) {
        st.mode = "fly";
        st.until = now + rnd(2500, 5000);
        st.head = rnd(0, Math.PI * 2);
      }
    } else {
      // rumo: curva suave para um alvo que muda; perto da borda, volta para casa; às vezes vai pousar
      if (now > nextTurn) {
        nextTurn = now + rnd(700, 1600);
        st.turn = rnd(-1.6, 1.6);
        if (o.perches?.length && st.mode === "fly" && Math.random() < 0.09) {
          st.perch = o.perches[Math.floor(Math.random() * o.perches.length)];
          st.mode = "land";
        }
      }
      const tx = st.mode === "land" ? st.perch.x : o.home.x,
        ty = st.mode === "land" ? st.perch.y : o.home.y;
      const far = Math.hypot(st.x - o.home.x, st.y - o.home.y) > o.radius;
      if (far || st.mode === "land") {
        const want = Math.atan2(ty - st.y, tx - st.x);
        let d = want - st.head;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        st.turn = Math.max(-2.4, Math.min(2.4, d * 2.2));
      }
      st.head += st.turn * dt;
      const gliding = st.mode === "fly" && now < nextGlide + 700 && now > nextGlide;
      if (now > nextGlide + 700) nextGlide = now + rnd(2500, 6000);
      const speed = (gliding ? 34 : 46) * k;
      st.x += Math.cos(st.head) * speed * dt;
      st.y += Math.sin(st.head) * speed * dt * 0.8;
      // batida: a altura acompanha (sobe na descida das asas); planando, desce devagar
      const i = Math.floor((now + st.t0) / 42) % 8;
      frame = gliding ? 0 : [0, 1, 2, 3, 4, 3, 2, 1][i];
      const lift = Math.sin(((now + st.t0) / 336) * Math.PI * 2) * 3 * k;
      const target = st.mode === "land" ? Math.max(4 * k, 26 * k * Math.min(1, Math.hypot(tx - st.x, ty - st.y) / (60 * k))) : 26 * k;
      st.alt += (target + lift - st.alt) * Math.min(1, dt * (gliding ? 1.2 : 4));
      if (st.mode === "land" && Math.hypot(tx - st.x, ty - st.y) < 4 * k) {
        st.mode = "perched";
        st.x = tx;
        st.y = ty;
        st.until = now + rnd(1800, 3600);
        st.t0 = now;
      }
      // vira o desenho só quando o rumo de lado é claro (sem tremer em voo reto para cima/baixo)
      const vx = Math.cos(st.head);
      if (vx > 0.3) st.face = 1;
      else if (vx < -0.3) st.face = -1;
    }
    spr.setFrame(frame).setFlipX(st.face < 0);
    spr.setPosition(Math.round(st.x / k) * k, Math.round((st.y - st.alt) / k) * k);
    if (o.shadow) {
      const h = Math.min(1, st.alt / (30 * k));
      // a sombra tem a envergadura da borboleta no chão e encolhe/clareia com a altura
      o.shadow.setPosition(Math.round(st.x), Math.round(st.y + 2 * k)).setScale((3.2 - h * 1.2) * k, (2 - h * 0.6) * k).setAlpha(1 - h * 0.35);
      if (o.depth) o.shadow.setDepth(st.y - 1);
    }
    if (o.depth) spr.setDepth(o.depth(st.y, st.alt));
  };
}
