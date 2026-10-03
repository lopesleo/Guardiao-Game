// Bestiário da CAATINGA (bioma 2): mesma linguagem de Monsters.js (contorno tinta,
// luz de cima-esquerda, Podridão em magenta), bichos e lendas do sertão:
//  · calango (no lugar do lobo), carcará (do corvo), cabeça-de-frade (do cogumelo);
//  · CABOCLO D'ÁGUA, o chefe — criatura do Rio São Francisco: pele de lama e limo,
//    barbatanas, mãos de membrana. Bicho do rio, não caricatura de gente;
//  · CARRANCA — a figura de proa que os barqueiros usavam para espantá-lo.
import { PAL } from "./Palette.js";
import { Pix, registerStrip, bayer } from "./PixelArt.js";
import { ROT } from "./Monsters.js";

const LIZ = [0x3e3428, 0x6a5a44, 0x9a8462, 0xc8b08a]; // calango: terra e areia
const CARC = [0x1e140e, 0x3a2818, 0x5c4028, 0x86603c]; // carcará: pardo
const CAC = [0x173d33, 0x235a45, 0x357a55, 0x5a9c66]; // cacto
const SKIN = [0x0e211c, 0x183a30, 0x245446, 0x34705a, 0x4c8e6c]; // Caboclo: lama e limo
const BELLY = [0x4e7a5a, 0x6e9670, 0x8eb084, 0xb0c89a];
const FIN = [0x1c4a5a, 0x2e7488, 0x4aa2b0, 0x86d0d4];
const WOOD = [0x3a2416, 0x5c3a22, 0x83552f, 0xa8743f];

function ell(p, cx, cy, rx, ry, ramp, jitter = 0.18) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      let t = (-dx * 0.55 - dy * 0.75 + 0.9) / 1.8;
      t += (bayer(x, y) - 0.5) * jitter;
      p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))]);
    }
}
const px = (p, list, c) => list.forEach(([x, y]) => p.set(x, y, c));

// ---------------------------------------------------------------------------
// CALANGO (28×15) — corre baixinho, rabo comprido, colar escuro; 4 quadros
// ---------------------------------------------------------------------------
function calango(f) {
  const p = new Pix(28, 15);
  const [c0, c1, c2, c3] = LIZ;
  const sway = [0, 1, 0, -1][f]; // o corpo serpenteia
  // Patas abertas para os lados (alternam em diagonal)
  const leg = (x, y, fwd, near) => {
    const col = near ? c2 : c0;
    const dx = fwd ? 1 : -1;
    p.set(x, y, col);
    p.set(x + dx, y + 1, col);
    p.set(x + dx * 2, y + 2, col);
    p.set(x + dx * 2 + 1, y + 2, PAL.ink); // dedinhos
  };
  const A = f % 2 === 0;
  leg(9, 9, !A, false);
  leg(17, 9, A, false);
  // Rabo comprido afinando (serpenteia)
  for (let x = 0; x <= 8; x++) {
    const y = 8 + Math.round(Math.sin((x / 8) * Math.PI + f) * 1) + (x < 4 ? 1 : 0);
    p.set(x, y, x % 3 === 0 ? c0 : c1);
    if (x > 4) p.set(x, y - 1, c1);
  }
  // Corpo
  ell(p, 13.5, 7.5 + sway * 0.3, 6.5, 2.8, LIZ);
  // Faixas escuras nas costas
  for (const x of [10, 13, 16]) px(p, [[x, 5], [x, 6]], c0);
  // Cabeça triangular erguida
  ell(p, 22, 6 + sway * 0.3, 3.6, 2.4, LIZ);
  px(p, [[25, 6], [26, 6], [25, 7], [26, 7]], c2);
  p.set(27, 7, c1);
  p.set(23, 5, ROT.glow); // olho da Podridão
  // Colar preto (o "calango-de-colar" do sertão)
  px(p, [[19, 5], [19, 6], [19, 7], [19, 8]], PAL.ink);
  // Barriga clara e rachadura corrompida
  for (let x = 10; x <= 17; x++) p.over(x, 9 + (x > 13 ? 0 : 0), c3);
  px(p, [[12, 7], [14, 6]], ROT.hot);
  leg(11, 9, A, true);
  leg(19, 9, !A, true);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CARCARÁ (22×17) — gavião do sertão: boné preto, cara vermelha, bico curvo
// ---------------------------------------------------------------------------
function carcara(f) {
  const p = new Pix(22, 17);
  const [c0, c1, c2, c3] = CARC;
  const up = f === 0;
  // Asa de trás
  if (up) px(p, [[8, 1], [9, 1], [9, 2], [10, 2], [10, 3], [11, 3], [11, 4], [8, 2], [8, 3], [9, 3], [9, 4], [10, 4], [12, 4]], c0);
  else px(p, [[8, 12], [9, 12], [9, 13], [10, 13], [10, 14], [8, 13], [9, 14], [11, 12], [11, 13]], c0);
  // Cauda com pontas claras (barrada)
  px(p, [[1, 8], [2, 8], [3, 8], [1, 9], [2, 9], [3, 9], [0, 9], [2, 10]], c2);
  px(p, [[0, 8], [1, 10]], PAL.cream);
  // Corpo pardo e peito barrado
  ell(p, 9, 8, 5.5, 3.6, CARC);
  for (let x = 8; x <= 13; x += 2) p.set(x, 10, PAL.cream);
  for (let x = 9; x <= 13; x += 2) p.set(x, 9, c3);
  // Pescoço/cara creme, cara nua vermelha, boné preto
  ell(p, 15.5, 6, 3, 2.8, [c3, PAL.cream, PAL.cream, PAL.cream], 0.05);
  px(p, [[14, 3], [15, 3], [16, 3], [17, 3], [14, 4], [15, 4], [16, 4], [13, 4]], PAL.ink);
  px(p, [[17, 6], [18, 6], [17, 5]], PAL.org2);
  p.set(16, 5, ROT.glow); // olho
  // Bico grosso e curvo (base laranja, ponta azulada)
  px(p, [[19, 5], [20, 5], [19, 6], [20, 6], [21, 7]], PAL.s4);
  p.set(19, 5, PAL.org3);
  // Asa da frente
  if (up) px(p, [[5, 0], [6, 0], [6, 1], [7, 1], [7, 2], [8, 4], [5, 1], [6, 2], [6, 3], [7, 3], [7, 4], [8, 5], [4, 1], [6, 4], [7, 5], [9, 6]], c2);
  else px(p, [[6, 11], [7, 11], [7, 12], [7, 13], [8, 14], [6, 12], [6, 13], [5, 12], [8, 15], [9, 15], [5, 13]], c2);
  px(p, [[up ? 4 : 4, up ? 0 : 13]], PAL.cream); // pontas das primárias
  // Garras
  px(p, [[8, 12], [10, 12]], PAL.yel1);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CABEÇA-DE-FRADE (17×18) — cacto redondo com o "gorro" vermelho; anda pulando
// ---------------------------------------------------------------------------
function frade(f) {
  const p = new Pix(17, 18);
  const bob = f % 2;
  // Perninhas de raiz
  px(p, [[5, 16], [6, 17], [11, 16], [10, 17]].map(([x, y], i) => [x + (f === 1 ? (i < 2 ? -1 : 1) : 0), y]), PAL.n2);
  // Corpo: gomos verticais
  for (let y = 5; y <= 16; y++)
    for (let x = 1; x <= 15; x++) {
      const dx = (x - 8) / 7.5,
        dy = (y - 11) / 6;
      if (dx * dx + dy * dy > 1) continue;
      let k = dx < -0.3 ? 3 : dx < 0.2 ? 2 : dx < 0.6 ? 1 : 0;
      if ((x + 1) % 3 === 0) k = Math.max(0, k - 1); // costelas
      p.set(x, y + bob - 1, CAC[k]);
    }
  // Espinhos claros nas costelas
  for (let y = 7; y <= 14; y += 3) for (let x = 2; x <= 14; x += 3) if (p.get(x, y + bob)) p.set(x, y + bob, PAL.cream);
  // Gorro vermelho (cefálio) com a Podridão por baixo
  for (let x = 4; x <= 12; x++) for (let y = 1; y <= 5; y++) {
    const dx = (x - 8) / 4.5,
      dy = (y - 4) / 3;
    if (dx * dx + dy * dy <= 1) p.set(x, y + bob, dx < -0.2 ? PAL.red3 : dx < 0.4 ? PAL.red2 : PAL.red1);
  }
  px(p, [[6, 2 + bob], [9, 1 + bob], [11, 3 + bob]], PAL.pink); // florzinhas
  // Carinha (olhos de Podridão)
  p.set(6, 10 + bob, ROT.glow);
  p.set(10, 10 + bob, ROT.glow);
  px(p, [[7, 12 + bob], [8, 12 + bob], [9, 12 + bob]], ROT.dark);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CABOCLO D'ÁGUA (48×54) — o chefe. Atarracado, curvado, braços compridos com
// membranas; crista de barbatana; limo pendurado; olhos grandes de bicho do rio.
// pose: null | "raise" (braços erguidos: chama a água) | "grab" (agachado,
// braços abertos baixos: o arrastão)
// ---------------------------------------------------------------------------
function caboclo(f, fury, freed = false, pose = null) {
  const p = new Pix(48, 54);
  const sw = pose ? 0 : f === 1 ? 1 : 0; // respiração
  const crouch = pose === "grab" ? 3 : 0;
  const crack = fury ? [PAL.org1, PAL.org2, PAL.yel3] : [ROT.mid, ROT.hot, ROT.glow];
  const cx = 24;
  // Pernas curtas de sapo + pés de membrana
  for (const [x0, dir] of [[14, -1], [29, 1]]) {
    for (let y = 42; y <= 50; y++) for (let x = x0; x <= x0 + 4; x++) p.set(x + (y > 47 ? dir : 0), y, SKIN[x === x0 ? 3 : x === x0 + 4 ? 0 : 1]);
    // pé espalmado: três dedos com membrana azulada
    const fx = x0 + 2 + dir * 2;
    for (let k = -3; k <= 3; k++) p.set(fx + k, 51, k % 3 === 0 ? SKIN[2] : FIN[1]);
    px(p, [[fx - 3, 52], [fx, 52], [fx + 3, 52]], PAL.s4); // unhas
  }
  // Tronco curvado (largo nos ombros, barriga para fora)
  const top = 16 + crouch - sw;
  ell(p, cx, 31 + crouch, 15.5, 14 - crouch * 0.4, SKIN, 0.22);
  // Escamas nas costas/ombros (pontinhos em losango)
  for (let y = top + 2; y < 36; y += 3)
    for (let x = 11 + (y % 2) * 2; x < 38; x += 4) if (p.get(x, y) && p.get(x, y) !== SKIN[4]) p.set(x, y, SKIN[Math.max(0, (x < cx ? 3 : 1))]);
  // Barriga clara de peixe
  ell(p, cx + 1, 35 + crouch, 8.5, 8, BELLY, 0.12);
  for (const y of [33 + crouch, 38 + crouch]) for (let x = cx - 4; x <= cx + 6; x++) if ((x + y) % 4) p.over(x, y, BELLY[1]); // dobras
  // Braços: compridos, grossos, membrana entre os dedos, barbatana no antebraço
  const hand = (hx, hy, dir, up = false) => {
    const vy = up ? -1 : 1;
    for (let k = -3; k <= 3; k++) for (let j = 0; j <= 3; j++) p.set(hx + k, hy + j * vy, j === 0 ? SKIN[2] : Math.abs(k) % 3 === 0 ? SKIN[3] : FIN[j > 1 ? 2 : 1]);
    px(p, [[hx - 3, hy + 4 * vy], [hx, hy + 4 * vy], [hx + 3, hy + 4 * vy]], PAL.s4); // garras
  };
  const arm = (x0, dir, lift) => {
    for (let y = top + 4; y <= 44 - lift; y++) {
      const x = x0 + dir * Math.round((y - top - 4) * 0.16);
      for (let k = 0; k < 5; k++) p.set(x + dir * k, y, SKIN[k === 0 ? (dir < 0 ? 4 : 3) : k === 4 ? 0 : k === 1 ? 3 : 2]);
      // barbatana do antebraço (para fora)
      if (y > top + 12 && y < top + 22) for (let j = 5; j <= 6 + ((y + 1) % 3 === 0 ? 1 : 0); j++) p.set(x + dir * j, y, FIN[j === 5 ? 1 : 2 + (y % 2)]);
    }
    hand(x0 + dir * 7, 45 - lift, dir);
  };
  const armUp = (x0, dir) => {
    for (let y = top + 5; y >= 4; y--) {
      const x = x0 + dir * Math.round((top + 5 - y) * 0.32);
      for (let k = 0; k < 5; k++) p.set(x + dir * k, y, SKIN[k === 0 ? (dir < 0 ? 4 : 3) : k === 4 ? 0 : 2]);
      if (y < top - 1 && y > top - 10) for (let j = 5; j <= 6; j++) p.set(x + dir * j, y, FIN[j === 5 ? 1 : 2 + (y % 2)]);
    }
    hand(x0 + dir * Math.round((top + 1) * 0.32) + dir * 2, 3, dir, true);
  };
  const armWide = (x0, dir) => {
    // agachado: braços abertos baixos, mãos para fora (pega tudo no caminho)
    for (let i = 0; i <= 12; i++) {
      const x = x0 + dir * i,
        y = top + 8 + Math.round(i * 0.9);
      for (let k = 0; k < 5; k++) p.set(x, y + k, SKIN[k === 0 ? 4 : k === 4 ? 0 : 2]);
      if (i > 4 && i < 10) p.set(x, y - 1, FIN[2]);
    }
    hand(x0 + dir * 14, top + 21, dir);
  };
  if (pose === "raise") {
    armUp(9, -1);
    armUp(36, 1);
  } else if (pose === "grab") {
    armWide(8, -1);
    armWide(39, 1);
  } else {
    arm(8, -1, sw);
    arm(37, 1, 1 - sw);
  }
  // Cabeça larga, afundada nos ombros (bicho de rio): crista de barbatana no alto
  const hy = top - 3;
  ell(p, cx, hy + 1, 11, 7.5, SKIN.slice(1), 0.25);
  for (let x = cx - 8; x <= cx + 8; x++) {
    const h = 4 - Math.abs(x - cx) * 0.35 + (x % 2 ? 1 : 0);
    for (let k = 1; k <= h; k++) p.set(x, hy - 6 - k + 1 + Math.round(Math.abs(x - cx) * 0.3), k === Math.floor(h) ? FIN[3] : FIN[x % 2 ? 2 : 1]);
  }
  for (let x = cx - 8; x <= cx + 8; x += 4) p.set(x, hy - 6 + Math.round(Math.abs(x - cx) * 0.3), SKIN[0]); // raios da barbatana
  // Olhos grandes e redondos, saltados
  const eye = freed ? FIN[3] : fury ? PAL.org2 : ROT.glow;
  for (const ex of [cx - 5, cx + 5]) {
    p.disc(ex, hy, 3, PAL.ink);
    p.disc(ex, hy, 2.2, freed ? FIN[2] : fury ? PAL.org1 : ROT.hot);
    p.disc(ex, hy, 1.2, eye);
    p.set(ex - 1, hy - 1, PAL.white);
  }
  // Boca larga de bagre, dentinhos; brilho da Podridão por dentro
  const my = hy + 5;
  const open = pose ? 3 : 2;
  for (let x = cx - 9; x <= cx + 9; x++) {
    const curve = Math.round(Math.abs(x - cx) * -0.18);
    const o = Math.abs(x - cx) > 7 ? 1 : open;
    p.set(x, my - 1 + curve, SKIN[0]); // lábio
    for (let k = 0; k < o; k++) p.set(x, my + k + curve, k === 0 ? PAL.ink : 0x3a0e18);
    if (x % 2 === 0 && Math.abs(x - cx) < 8) p.set(x, my + curve, PAL.cream);
  }
  if (!freed && pose) p.set(cx, my + 1, crack[2]);
  // Barbilhões (bigodes de bagre) caindo dos cantos da boca
  for (const dir of [-1, 1]) for (let k = 0; k < 6; k++) p.set(cx + dir * (9 + Math.round(k * 0.4)), my + k, k > 3 ? SKIN[1] : SKIN[2]);
  // Limo do rio pendurado nos ombros e na cabeça
  const weed = [[11, 0], [14, 1], [33, 0], [36, 1], [cx - 9, -4], [cx + 9, -4]];
  for (const [x, dy] of weed) {
    const y0 = (dy < 0 ? hy + 2 : top + 2) + dy;
    for (let k = 0; k < 8; k++) p.set(x + (k > 3 ? (x < cx ? -1 : 1) : 0) + (k > 6 ? (x < cx ? -1 : 1) : 0), y0 + k, k % 3 === 0 ? PAL.g5 : k % 3 === 1 ? PAL.g4 : PAL.g3);
  }
  // Gotas escorrendo
  px(p, [[12, top + 14], [35, top + 18], [cx + 2, hy + 10], [20, 44]], FIN[3]);
  // Rachaduras da Podridão (magenta; brasa na fúria). Libertado: sem rachaduras.
  const cracks = [[13, 25], [14, 26], [14, 27], [15, 28], [34, 24], [33, 25], [33, 26], [17, 38], [31, 37], [30, 38], [cx - 3, hy - 3], [cx + 4, hy - 2]];
  if (!freed) cracks.forEach(([x, y], i) => p.over(x, y + crouch - (y < 30 ? sw : 0), crack[i % 4 === 3 ? 2 : 1]));
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// CARRANCA (20×30) — figura de proa do São Francisco: cara de leão com juba
// pintada, boca aberta de dentes. Fincada num toco. Quadro 1 = rachada.
// ---------------------------------------------------------------------------
function carranca(broken = false) {
  const p = new Pix(20, 30);
  // Toco/estaca
  for (let y = 17; y <= 29; y++) for (let x = 7; x <= 12; x++) p.set(x, y, WOOD[x < 9 ? 3 : x < 11 ? 2 : 1]);
  px(p, [[6, 29], [13, 29], [5, 29], [14, 29]], WOOD[1]);
  // Juba: raios vermelhos e amarelos em volta
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    for (let r = 6; r <= 9; r++) {
      const x = Math.round(10 + Math.cos(ang) * r),
        y = Math.round(10 + Math.sin(ang) * r * 0.95);
      p.set(x, y, a % 2 ? PAL.red2 : r > 8 ? PAL.yel3 : PAL.yel2);
    }
  }
  // Cara de madeira
  ell(p, 10, 10, 6, 6.2, WOOD.slice(1), 0.15);
  // Sobrancelhas pretas grossas, olhos arregalados brancos
  px(p, [[5, 6], [6, 5], [7, 5], [8, 6], [12, 6], [13, 5], [14, 5], [15, 6]], PAL.ink);
  for (const ex of [7, 13]) {
    px(p, [[ex - 1, 7], [ex, 7], [ex + 1, 7], [ex - 1, 8], [ex + 1, 8]], PAL.white);
    p.set(ex, 8, PAL.ink);
  }
  // Nariz largo
  px(p, [[9, 9], [10, 9], [11, 9], [9, 10], [11, 10]], WOOD[0]);
  // Boca aberta com dentes (espanta o Caboclo)
  for (let x = 6; x <= 14; x++) for (let y = 12; y <= 15; y++) {
    const dx = (x - 10) / 4.5,
      dy = (y - 13.5) / 2;
    if (dx * dx + dy * dy <= 1) p.set(x, y, PAL.red1);
  }
  for (let x = 6; x <= 14; x += 2) {
    p.set(x, 12, PAL.cream);
    p.set(x + 1, 15, PAL.cream);
  }
  px(p, [[6, 13], [14, 13]], PAL.white); // presas
  // Detalhes pintados (verde e azul do barco)
  px(p, [[3, 10], [17, 10], [4, 14], [16, 14]], PAL.g5);
  px(p, [[10, 1], [10, 19]], PAL.ice2);
  if (broken) {
    // rachada ao meio e meio tombada
    for (let y = 0; y < 30; y++) {
      const x = 10 + Math.round(Math.sin(y * 0.9) * 1.2);
      p.set(x, y, 0);
      if (y % 3 === 0) p.set(x + 1, y, 0);
    }
  }
  p.outline(PAL.ink);
  return p;
}

// Coluna d'água da Tromba (18×36, 3 quadros girando)
function waterSpout(f) {
  const p = new Pix(18, 36);
  for (let y = 0; y < 36; y++) {
    const w = 3 + (y / 35) * 2 + Math.sin(y * 0.5 + f * 2) * 1.2 + (y < 6 ? (6 - y) * 0.6 : 0);
    const c = 9 + Math.sin(y * 0.3 + f * 1.7) * 2;
    for (let x = Math.floor(c - w); x <= Math.ceil(c + w); x++) {
      const u = (x - (c - w)) / (2 * w);
      const band = (y + f * 3 + Math.round(u * 6)) % 6 < 2;
      p.set(x, y, u < 0.25 ? FIN[3] : band ? PAL.white : u < 0.7 ? FIN[2] : FIN[1]);
    }
  }
  for (let x = 1; x <= 16; x++) if ((x + f) % 3) p.set(x, 35, FIN[3]); // espuma na base
  return p;
}

export function registerCaatingaMonsters(scene) {
  const strip = (key, frames) => registerStrip(scene, key, frames);
  const anim = (key, tex, frames, rate) => {
    if (!scene.anims.exists(key))
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat: -1 });
  };
  const four = [0, 1, 2, 3];
  strip("mon_calango", four.map((f) => calango(f)));
  strip("mon_carcara", [carcara(0), carcara(1)]);
  strip("mon_frade", [frade(0), frade(1)]);
  // 0-1 parado · 2-3 fúria · 4 libertado · 5 chama a água · 6 arrastão · 7 chama (fúria) · 8 arrastão (fúria)
  strip("mon_caboclo", [
    caboclo(0, false), caboclo(1, false), caboclo(0, true), caboclo(1, true), caboclo(0, false, true),
    caboclo(0, false, false, "raise"), caboclo(0, false, false, "grab"),
    caboclo(0, true, false, "raise"), caboclo(0, true, false, "grab"),
  ]);
  strip("obj_carranca", [carranca(false), carranca(true)]);
  strip("px_spout", [waterSpout(0), waterSpout(1), waterSpout(2)]);
  anim("calango_move", "mon_calango", four, 14);
  anim("carcara_move", "mon_carcara", [0, 1], 8);
  anim("frade_move", "mon_frade", [0, 1], 5);
  anim("caboclo_idle", "mon_caboclo", [0, 1], 2);
  anim("caboclo_fury", "mon_caboclo", [2, 3], 4);
  anim("spout_spin", "px_spout", [0, 1, 2], 12);
}
