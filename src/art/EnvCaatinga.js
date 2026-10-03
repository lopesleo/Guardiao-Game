// Cenário da CAATINGA (bioma 2 — ver docs/BIOMAS.md): o sertão seco, gerado em
// pixel-art com a PAL, no mesmo estilo de Environment.js (luz de cima-esquerda,
// contorno tinta). Mandacaru, xique-xique, juazeiro (o verde que resiste à seca),
// árvores secas cinzentas, macambira, lajedos e chão rachado.
// Mesmas categorias de Environment.js: o mundo (ForestWorld) usa uma ou outra.
import { PAL } from "./Palette.js";
import { Pix, rng, bayer, tileNoise } from "./PixelArt.js";
import { makeTree, makeRock } from "./Environment.js";

// Rampas do sertão (escuro → claro)
const EARTH = [0x7c5a38, 0x8c6a42, 0x9c7a4e, 0xac8858];
const CACTUS = [0x173d33, 0x235a45, 0x357a55, 0x5a9c66, 0x8cc07a];
const DRYWOOD = [0x4a4038, 0x6a5e52, 0x8c8072, 0xb0a594];
const JUAZEIRO = [PAL.t1, PAL.t2, PAL.g3, PAL.g4, PAL.g5];
const STRAW = [PAL.straw0, PAL.straw1, PAL.straw2, PAL.straw3];
const LAJEDO = [0x5e5a58, 0x7c7672, 0x9c958e, 0xbab2a8, 0xd8d0c4];

// Chão: terra seca com rachaduras e capim queimado
export function makeGroundCaatinga(seed = 11) {
  const S = 96;
  const p = new Pix(S, S);
  const n1 = tileNoise(S, S, 24, seed);
  const n2 = tileNoise(S, S, 8, seed + 1);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = n1(x, y) * 0.6 + n2(x, y) * 0.4 + (bayer(x, y) - 0.5) * 0.14;
      p.set(x, y, EARTH[Math.max(0, Math.min(3, Math.floor((v - 0.2) * 6)))]);
    }
  // Rachaduras: linhas quebradas que dão a volta no tile (sem emenda)
  const r = rng(seed + 7);
  for (let c = 0; c < 3; c++) {
    let x = Math.floor(r() * S),
      y = Math.floor(r() * S);
    const len = 8 + Math.floor(r() * 12);
    let dir = r() * Math.PI * 2;
    for (let k = 0; k < len; k++) {
      p.set((x + S) % S, (y + S) % S, k % 5 === 4 ? EARTH[0] : 0x6a4a30); // rachadura fina e falhada
      if (k % 5 === 4) k++;
      dir += (r() - 0.5) * 1.1;
      x += Math.round(Math.cos(dir));
      y += Math.round(Math.sin(dir));
    }
  }
  // Capim seco espalhado
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * S),
      y = Math.floor(r() * S);
    const h = 1 + Math.floor(r() * 2);
    for (let k = 0; k < h; k++) p.set(x, (y - k + S) % S, k === h - 1 ? STRAW[3] : STRAW[1]);
  }
  return p;
}

// Manchas no chão: barro rachado, areia clara, capim seco
function makePatchCaatinga(kind, seed) {
  const r = rng(seed);
  const W = 48 + Math.floor(r() * 24),
    H = 28 + Math.floor(r() * 14);
  const p = new Pix(W, H);
  const nz = tileNoise(W, H, 8, seed + 5);
  const cols = kind === "cracked" ? [0x6a4a2e, 0x74522f, 0x7c5a36] : kind === "sand" ? [0xb8986a, 0xc8a878, 0xd6b888] : [STRAW[0], STRAW[1], STRAW[2]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2),
        dy = (y + 0.5 - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx + dy * dy) + (nz(x, y) - 0.5) * 0.5;
      if (d > 1) continue;
      if (d > 0.7 && bayer(x, y) < (d - 0.7) / 0.3) continue;
      p.set(x, y, cols[Math.max(0, Math.min(2, Math.floor((nz(x, y) + (bayer(x, y) - 0.5) * 0.3) * 3)))]);
    }
  if (kind === "cracked") {
    // rede de rachaduras (barro de açude seco)
    for (let c = 0; c < 5; c++) {
      let x = Math.floor(r() * W),
        y = Math.floor(r() * H);
      for (let k = 0; k < 14; k++) {
        if (p.get(x, y)) p.set(x, y, 0x3e2a1a);
        x += r() < 0.5 ? 1 : -1;
        y += r() < 0.4 ? 1 : r() < 0.5 ? -1 : 0;
      }
    }
  }
  return p;
}

// Mandacaru: cacto em colunas com braços erguidos (às vezes com a flor branca)
export function makeMandacaru(seed, opts = {}) {
  const r = rng(seed);
  const W = opts.w ?? 32,
    H = opts.h ?? 54;
  const p = new Pix(W, H);
  const col = (cx, top, bot, w) => {
    for (let y = top; y <= bot; y++)
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
        const u = (x - (cx - w)) / (2 * w); // 0 esquerda (luz) → 1 direita
        let t = 1 - u * 1.05 + (bayer(x, y) - 0.5) * 0.2;
        if ((x - Math.round(cx - w)) % 3 === 1) t -= 0.25; // costelas
        if (y < top + 2) t += 0.1;
        p.set(x, y, CACTUS[Math.max(0, Math.min(4, Math.floor(t * 4.2)))]);
      }
  };
  const cx = W / 2;
  col(cx, 2, H - 2, 3.4); // tronco
  // braços: saem do tronco em L e sobem
  const arms = opts.arms ?? 1 + Math.floor(r() * 3);
  for (let i = 0; i < arms; i++) {
    const side = i % 2 ? 1 : -1;
    const y0 = Math.floor(H * (0.42 + r() * 0.22) + i * 3);
    const ax = Math.round(cx + side * (9 + r() * 2));
    // cotovelo em L: sai do tronco na horizontal e sobe (braço separado do tronco)
    for (let x = Math.round(cx); side > 0 ? x <= ax : x >= ax; x += side) col(x, y0, y0 + 3, 0.1);
    col(ax, Math.floor(y0 - 9 - r() * 7), y0 + 3, 2.2);
  }
  // espinhos (pontinhos claros)
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * H);
    if (p.get(x, y) && !p.get(x + 1, y)) p.set(x + 1, y, PAL.cream);
  }
  if (opts.flower) {
    p.set(Math.round(cx), 0, PAL.white);
    p.set(Math.round(cx) - 1, 1, PAL.white);
    p.set(Math.round(cx) + 1, 1, PAL.cream);
  }
  p.outline(PAL.ink);
  return p;
}

// Xique-xique: cacto baixo que se espalha pelo chão em gomos
function makeXiqueXique(seed) {
  const r = rng(seed);
  const p = new Pix(28, 20);
  const segs = 7 + Math.floor(r() * 3);
  for (let i = 0; i < segs; i++) {
    const x0 = 5 + r() * 18,
      y0 = 14 + r() * 5;
    const len = 6 + r() * 7;
    const ang = -Math.PI / 2 + (r() - 0.5) * 1.6;
    for (let k = 0; k < len; k++)
      for (let w = -1; w <= 1; w++) {
        const x = Math.round(x0 + Math.cos(ang) * k + w * Math.sin(ang)),
          y = Math.round(y0 + Math.sin(ang) * k);
        p.set(x, y, CACTUS[w < 0 ? 4 : w === 0 ? 3 : 1]);
      }
  }
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(r() * 28),
      y = Math.floor(r() * 20);
    if (p.get(x, y) && !p.get(x, y - 1)) p.set(x, y - 1, PAL.cream); // espinhos
  }
  p.outline(PAL.ink);
  return p;
}

// Árvore seca da caatinga (na seca as folhas caem): tronco e galhos cinzentos retorcidos
function makeDryTree(seed, opts = {}) {
  const r = rng(seed);
  const W = opts.w ?? 46,
    H = opts.h ?? 54;
  const p = new Pix(W, H);
  const branch = (x, y, ang, len, w) => {
    for (let k = 0; k < len; k++) {
      const xx = x + Math.cos(ang) * k,
        yy = y + Math.sin(ang) * k;
      for (let j = -Math.floor(w / 2); j <= Math.floor(w / 2); j++) {
        const px = Math.round(xx + j * Math.sin(ang) * -1),
          py = Math.round(yy + j * Math.cos(ang));
        p.set(px, py, DRYWOOD[j < 0 ? 3 : j === 0 ? 2 : 1]);
      }
      ang += (r() - 0.5) * 0.25;
    }
    return { x: x + Math.cos(ang) * len, y: y + Math.sin(ang) * len, ang };
  };
  const base = { x: W / 2, y: H - 2 };
  const trunk = branch(base.x, base.y, -Math.PI / 2 + (r() - 0.5) * 0.3, H * 0.42, 4);
  const grow = (from, depth, len, w) => {
    if (depth <= 0 || len < 3) return;
    const n = depth > 2 ? 2 : 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const ang = from.ang + (i - (n - 1) / 2) * (0.7 + r() * 0.3);
      const e = branch(from.x, from.y, ang, len, w);
      grow(e, depth - 1, len * 0.68, Math.max(1, w - 1));
    }
  };
  grow(trunk, 4, H * 0.22, 3);
  // poucas folhas verdes que restam (ou nenhuma)
  if (opts.leaves)
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(r() * W),
        y = Math.floor(r() * H * 0.6);
      if (p.get(x, y)) p.set(x, y - 1, r() < 0.5 ? PAL.g4 : PAL.g3);
    }
  p.outline(PAL.ink);
  return p;
}

// Arbusto seco: emaranhado de gravetos cinzentos
function makeDryBush(seed) {
  const r = rng(seed);
  const p = new Pix(24, 16);
  for (let i = 0; i < 10; i++) {
    let x = 12 + (r() - 0.5) * 6,
      y = 15;
    const ang = -Math.PI / 2 + (r() - 0.5) * 2.2;
    const len = 6 + r() * 8;
    for (let k = 0; k < len; k++) {
      p.set(Math.round(x), Math.round(y), DRYWOOD[k < len / 2 ? 1 : 2]);
      x += Math.cos(ang);
      y += Math.sin(ang);
    }
  }
  p.outline(PAL.ink);
  return p;
}

// Macambira: roseta espinhosa de folhas (bromélia do sertão)
function makeMacambira(seed) {
  const r = rng(seed);
  const p = new Pix(15, 10);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI + (i / (n - 1)) * Math.PI; // leque para cima
    for (let k = 0; k < 6; k++) {
      const x = Math.round(7 + Math.cos(ang) * k * 1.1),
        y = Math.round(9 + Math.sin(ang) * k * 0.9);
      p.set(x, y, k > 4 ? PAL.yel1 : i % 2 ? CACTUS[2] : CACTUS[3]);
    }
  }
  if (r() < 0.5) p.set(7, 4, PAL.red2);
  return p;
}

// Capim seco (tufo)
function makeDryTuft(seed) {
  const r = rng(seed);
  const p = new Pix(11, 8);
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(r() * 9);
    const h = 3 + Math.floor(r() * 5);
    const lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < h; k++) p.set(x + (k > h * 0.6 ? lean : 0), 7 - k, k === h - 1 ? STRAW[3] : k < 2 ? STRAW[0] : STRAW[2]);
  }
  return p;
}

// Pedrinhas soltas
function makePebbles(seed) {
  const r = rng(seed);
  const p = new Pix(14, 8);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(r() * 10),
      y = 3 + Math.floor(r() * 4);
    p.set(x, y, LAJEDO[3]);
    p.set(x + 1, y, LAJEDO[2]);
    p.set(x, y + 1, LAJEDO[1]);
  }
  p.outline(PAL.ink);
  return p;
}

// Toco/galho secos (madeira desbotada pelo sol)
function makeDryStump(seed) {
  const p = new Pix(16, 12);
  for (let y = 4; y < 11; y++) for (let x = 2; x < 14; x++) p.set(x, y, x < 5 ? DRYWOOD[3] : x < 10 ? DRYWOOD[2] : DRYWOOD[1]);
  p.ellipse(8, 4, 6, 2.5, DRYWOOD[3]);
  p.ellipse(8, 4, 3.5, 1.4, DRYWOOD[2]);
  p.outline(PAL.ink);
  return p;
}
function makeDryLog(seed) {
  const p = new Pix(28, 9);
  for (let y = 1; y < 8; y++) for (let x = 3; x < 26; x++) p.set(x, y, y < 3 ? DRYWOOD[3] : y < 6 ? DRYWOOD[2] : DRYWOOD[1]);
  p.ellipse(3, 4.5, 3, 3.6, DRYWOOD[3]);
  p.set(3, 4, DRYWOOD[1]);
  p.outline(PAL.ink);
  return p;
}

// Registra o atlas "env_caatinga" + o chão "env_ground_caatinga". Devolve os nomes
// de frame por categoria (mesmo formato de registerEnvironment) + atlas/ground.
export function registerCaatinga(scene) {
  const keys = { atlas: "env_caatinga", ground: "env_ground_caatinga", trees: [], pines: [], bushes: [], rocks: [], flowers: [], tufts: [], shrooms: [], stumps: [], logs: [], patches: { dark: [], dirt: [], moss: [] } };
  makeGroundCaatinga().register(scene, "env_ground_caatinga");
  const items = [];
  const add = (list, name, pix) => {
    items.push({ name, pix });
    list.push(name);
  };
  // "trees" = juazeiros e árvores secas; "pines" = mandacarus (o ForestWorld mistura os dois)
  add(keys.trees, "juazeiro0", makeTree(2100, { ramp: JUAZEIRO, w: 46, h: 54, trunkW: 6 }));
  add(keys.trees, "juazeiro1", makeTree(2117, { ramp: JUAZEIRO, w: 52, h: 58, trunkW: 7 }));
  for (let i = 0; i < 3; i++) add(keys.trees, `seca${i}`, makeDryTree(2200 + i * 13, { leaves: i === 2, h: 50 + i * 4 }));
  for (let i = 0; i < 3; i++) add(keys.pines, `mandacaru${i}`, makeMandacaru(2300 + i * 7, { h: 46 + i * 8, flower: i === 1, arms: i + 1 }));
  for (let i = 0; i < 2; i++) add(keys.bushes, `xique${i}`, makeXiqueXique(2400 + i));
  for (let i = 0; i < 2; i++) add(keys.bushes, `drybush${i}`, makeDryBush(2450 + i));
  for (let i = 0; i < 4; i++) add(keys.rocks, `lajedo${i}`, makeRock(2500 + i * 7, { w: 16 + i * 5, h: 10 + i * 2, moss: false, ramp: LAJEDO }));
  for (let i = 0; i < 3; i++) add(keys.flowers, `macambira${i}`, makeMacambira(2600 + i));
  for (let i = 0; i < 4; i++) add(keys.tufts, `capim${i}`, makeDryTuft(2700 + i));
  for (let i = 0; i < 3; i++) add(keys.shrooms, `pedras${i}`, makePebbles(2800 + i));
  for (let i = 0; i < 2; i++) add(keys.stumps, `tocoseco${i}`, makeDryStump(2900 + i));
  add(keys.logs, "galhoseco0", makeDryLog(2950));
  for (let i = 0; i < 4; i++) {
    add(keys.patches.dark, `cracked${i}`, makePatchCaatinga("cracked", 3000 + i));
    add(keys.patches.dirt, `sand${i}`, makePatchCaatinga("sand", 3100 + i));
    add(keys.patches.moss, `drygrass${i}`, makePatchCaatinga("dry", 3200 + i));
  }
  // Atlas (mesmo empacotamento em prateleiras de Environment.js)
  const AW = 256;
  let x = 0,
    y = 0,
    rowH = 0;
  const placed = items.map((it) => {
    if (x + it.pix.w + 1 > AW) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    const pos = { ...it, x, y };
    x += it.pix.w + 1;
    rowH = Math.max(rowH, it.pix.h);
    return pos;
  });
  const AH = y + rowH + 1;
  if (scene.textures.exists("env_caatinga")) scene.textures.remove("env_caatinga");
  const tex = scene.textures.createCanvas("env_caatinga", AW, AH);
  const ctx = tex.getContext();
  for (const it of placed) {
    ctx.putImageData(it.pix.toImageData(ctx), it.x, it.y);
    tex.add(it.name, 0, it.x, it.y, it.pix.w, it.pix.h);
  }
  tex.refresh();
  return keys;
}
