// Cenário procedural da floresta — tudo gerado em pixel-art com a PAL.
// Substitui os tiles do Tiny Town (sem contorno, cores chapadas) que destoavam
// dos personagens. Arte determinística (seed fixa): o mundo sempre igual.
import { PAL } from "./Palette.js";
import { Pix, rng, bayer, tileNoise } from "./PixelArt.js";

// Rampas de sombreamento (escuro → claro)
const LEAF = [PAL.t1, PAL.g2, PAL.g3, PAL.g4, PAL.g5];
const LEAF_DARK = [PAL.t0, PAL.t1, PAL.t2, PAL.t3, PAL.g4];
const LEAF_WARM = [PAL.n1, PAL.org1, PAL.org2, PAL.org3, PAL.yel3];
const STONE = [PAL.s0, PAL.s1, PAL.s2, PAL.s3, PAL.s4];

// Luz vinda de cima-esquerda (padrão do gênero)
const LX = -0.55,
  LY = -0.7,
  LZ = 0.45;

// Sombreia uma forma feita de "bolhas" (copas, arbustos, pedras).
// Cada pixel pertence à bolha da FRENTE (maior índice) que o contém; a normal
// da bolha dá o tom. Contato entre bolhas escurece → leitura de "cachos".
function shadeBlobs(p, blobs, ramp, r, jitter = 0.22) {
  const owner = new Int16Array(p.w * p.h).fill(-1);
  blobs.forEach((b, i) => {
    for (let y = Math.floor(b.cy - b.ry); y <= Math.ceil(b.cy + b.ry); y++)
      for (let x = Math.floor(b.cx - b.rx); x <= Math.ceil(b.cx + b.rx); x++) {
        if (!p.inb(x, y)) continue;
        const dx = (x + 0.5 - b.cx) / b.rx,
          dy = (y + 0.5 - b.cy) / b.ry;
        if (dx * dx + dy * dy <= 1) owner[y * p.w + x] = i;
      }
  });
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const o = owner[y * p.w + x];
      if (o < 0) continue;
      const b = blobs[o];
      const nx = (x + 0.5 - b.cx) / b.rx,
        ny = (y + 0.5 - b.cy) / b.ry;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let t = (nx * LX + ny * LY + nz * LZ + 0.35) / 1.35;
      t += (bayer(x, y) - 0.5) * jitter + (r() - 0.5) * 0.08;
      // Bolha de trás logo acima de uma da frente: sombra de contato
      const below = y + 1 < p.h ? owner[(y + 1) * p.w + x] : -1;
      if (below > o) t -= 0.35;
      const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)));
      p.set(x, y, ramp[idx]);
    }
  return owner;
}

// ---------------------------------------------------------------------------
// CHÃO — tile 64×64 sem emenda (ruído periódico + dithering + lâminas)
// ---------------------------------------------------------------------------
export function makeGroundTile(seed = 7) {
  const S = 96;
  const p = new Pix(S, S);
  const n1 = tileNoise(S, S, 24, seed);
  const n2 = tileNoise(S, S, 12, seed + 1);
  const n3 = tileNoise(S, S, 6, seed + 2);
  const ramp = [0x1d3926, 0x22432b, 0x274d2f, 0x2c5532];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = n1(x, y) * 0.35 + n2(x, y) * 0.35 + n3(x, y) * 0.3;
      v += (bayer(x, y) - 0.5) * 0.14;
      const i = Math.max(0, Math.min(3, Math.floor((v - 0.25) * 8)));
      p.set(x, y, ramp[i]);
    }
  // Lâminas de grama: ponta clara + pé escuro (textura legível a 3×)
  const r = rng(seed + 99);
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(r() * S),
      y = Math.floor(r() * S);
    const hgt = 1 + Math.floor(r() * 2);
    const tip = r() < 0.25 ? PAL.g4 : 0x326036;
    for (let k = 0; k < hgt; k++) p.set(x, (y - k + S) % S, k === hgt - 1 ? tip : 0x2d5733);
    p.set(x, (y + 1) % S, 0x19331f);
  }
  return p;
}

// Mancha orgânica (decalque no chão): forma por ruído dentro de elipse, borda
// com dithering (transição sem alpha).
export function makePatch(kind, seed) {
  const r = rng(seed);
  const W = 48 + Math.floor(r() * 24),
    H = 30 + Math.floor(r() * 14);
  const p = new Pix(W, H);
  const nz = tileNoise(W, H, 8, seed + 5);
  const nc = tileNoise(W, H, 14, seed + 6);
  const cols =
    kind === "dirt"
      ? [0x3a2a1f, PAL.n1, 0x553425]
      : kind === "moss"
        ? [0x2a5230, 0x305d35, PAL.g3]
        : [0x14281b, 0x183020, 0x1b3624];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2),
        dy = (y + 0.5 - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx + dy * dy) + (nz(x, y) - 0.5) * 0.55;
      if (d > 1) continue;
      // Borda: some por dithering (quanto mais perto da borda, mais furos)
      if (d > 0.7 && bayer(x, y) < (d - 0.7) / 0.3) continue;
      const v = nc(x, y) * 1.2 - 0.1 + (bayer(x, y) - 0.5) * 0.2 - d * 0.35;
      p.set(x, y, cols[Math.max(0, Math.min(2, Math.floor(v * 3)))]);
    }
  if (kind === "dirt") {
    // Pedrinhas
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(r() * W),
        y = Math.floor(r() * H);
      if (p.get(x, y) && p.get(x + 1, y)) {
        p.set(x, y, PAL.s3);
        p.set(x + 1, y, PAL.s2);
        p.set(x, y + 1, PAL.n0);
      }
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// ÁRVORES
// ---------------------------------------------------------------------------
export function makeTree(seed, opts = {}) {
  const r = rng(seed);
  const W = opts.w ?? 44,
    H = opts.h ?? 56;
  const ramp = opts.ramp ?? LEAF;
  const p = new Pix(W, H);
  const cx = W / 2;
  const canopyCy = H * 0.36;
  const R = W * 0.32;

  // Tronco (desenhado antes; a copa cobre o topo)
  const trunkTop = Math.floor(canopyCy + R * 0.4);
  const trunkBot = H - 3;
  const tw = opts.trunkW ?? 6;
  for (let y = trunkTop; y <= trunkBot; y++) {
    const flare = y > trunkBot - 3 ? trunkBot - 3 - y : 0; // raízes abrem
    for (let x = Math.floor(cx - tw / 2 + flare); x < Math.ceil(cx + tw / 2 - flare); x++) {
      const u = (x - (cx - tw / 2 + flare)) / (tw - 2 * flare);
      let col = u < 0.3 ? PAL.n3 : u < 0.7 ? PAL.n2 : PAL.n1;
      if ((x * 7 + y * 3) % 11 === 0) col = PAL.n1; // veio da casca
      p.set(x, y, col);
    }
  }

  // Copa: bolha central + cachos ao redor (ordenados de trás pra frente)
  const blobs = [{ cx, cy: canopyCy, rx: R, ry: R * 0.92 }];
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    const d = R * (0.55 + r() * 0.25);
    const rr = R * (0.45 + r() * 0.2);
    blobs.push({
      cx: cx + Math.cos(a) * d,
      cy: canopyCy + Math.sin(a) * d * 0.8,
      rx: rr,
      ry: rr * 0.9,
    });
  }
  blobs.sort((a, b) => a.cy - b.cy);
  shadeBlobs(p, blobs, ramp, r);

  // Sombra da copa no tronco
  for (let x = 0; x < W; x++)
    for (let y = trunkTop; y < trunkBot; y++) {
      const c = p.rgb(x, y);
      if ((c === PAL.n3 || c === PAL.n2) && ramp.includes(p.rgb(x, y - 1))) {
        p.set(x, y, PAL.n0);
        if (p.rgb(x, y + 1) !== 0) p.set(x, y + 1, PAL.n1);
      }
    }

  // Frutos luminosos (árvores "mágicas" do Guardião)
  if (opts.fruit) {
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2,
        d = r() * R * 0.9;
      const x = Math.floor(cx + Math.cos(a) * d),
        y = Math.floor(canopyCy + Math.sin(a) * d * 0.8);
      if (!p.get(x, y)) continue;
      p.set(x, y, opts.fruit);
      p.set(x, y + 1, PAL.red1);
    }
  }
  p.outline(PAL.ink);
  return p;
}

// Pinheiro: camadas triangulares, lado esquerdo iluminado
export function makePine(seed, opts = {}) {
  const r = rng(seed);
  const W = opts.w ?? 34,
    H = opts.h ?? 58;
  const p = new Pix(W, H);
  const cx = W / 2;
  const ramp = opts.ramp ?? LEAF_DARK;
  // Tronco curto
  for (let y = H - 10; y < H - 2; y++)
    for (let x = cx - 2; x < cx + 2; x++) p.set(x, y, x < cx - 1 ? PAL.n3 : x < cx + 1 ? PAL.n2 : PAL.n1);
  const layers = 4;
  for (let L = 0; L < layers; L++) {
    const top = 2 + L * ((H - 16) / layers) * 0.85;
    const bot = top + (H - 12) / layers + 6;
    const half = (W / 2 - 2) * (0.45 + (L / (layers - 1)) * 0.55);
    for (let y = Math.floor(top); y <= bot; y++) {
      const f = (y - top) / (bot - top);
      const hw = half * f + 1;
      // Borda inferior serrilhada
      const jag = y > bot - 2 ? (Math.floor(r() * 2)) : 0;
      for (let x = Math.floor(cx - hw) + jag; x <= Math.ceil(cx + hw) - jag; x++) {
        const u = (x - (cx - hw)) / (2 * hw); // 0 esquerda → 1 direita
        let t = 1 - u * 0.9 - f * 0.25 + 0.15;
        t += (bayer(x, y) - 0.5) * 0.25;
        if (y > bot - 2) t -= 0.3; // sombra da camada de cima na de baixo
        p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))]);
      }
    }
  }
  if (opts.snow) {
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H - 10; y++)
        if (p.get(x, y) && !p.get(x, y - 1) && r() < 0.8) p.set(x, y, PAL.ice3);
  }
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------------------
// ARBUSTOS, PEDRAS, DETALHES
// ---------------------------------------------------------------------------
export function makeBush(seed, opts = {}) {
  const r = rng(seed);
  const W = opts.w ?? 26,
    H = opts.h ?? 18;
  const p = new Pix(W, H);
  const blobs = [];
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rr = H * (0.3 + r() * 0.15);
    blobs.push({
      cx: 4 + rr * 0.6 + r() * (W - 8 - rr * 1.2),
      cy: H - rr - 1 - r() * 3,
      rx: rr * 1.1,
      ry: rr,
    });
  }
  blobs.sort((a, b) => a.cy - b.cy);
  shadeBlobs(p, blobs, opts.ramp ?? LEAF, r, 0.3);
  if (opts.berries) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(3 + r() * (W - 6)),
        y = Math.floor(3 + r() * (H - 6));
      if (p.get(x, y) && p.get(x + 1, y + 1)) {
        p.set(x, y, opts.berries);
        p.set(x, y + 1, PAL.red0);
      }
    }
  }
  p.outline(PAL.ink);
  return p;
}

export function makeRock(seed, opts = {}) {
  const r = rng(seed);
  const W = opts.w ?? 20,
    H = opts.h ?? 14;
  const p = new Pix(W, H);
  const blobs = [
    { cx: W * 0.45, cy: H * 0.58, rx: W * 0.42, ry: H * 0.42 },
    { cx: W * (0.3 + r() * 0.4), cy: H * 0.45, rx: W * 0.28, ry: H * 0.35 },
  ];
  blobs.sort((a, b) => a.cy - b.cy);
  shadeBlobs(p, blobs, STONE, r, 0.3);
  // Rachadura
  const cx0 = Math.floor(W * 0.4 + r() * W * 0.2);
  for (let k = 0; k < 3; k++) p.over(cx0 + (k % 2), Math.floor(H * 0.35) + k, PAL.s1);
  // Musgo no topo
  if (opts.moss !== false) {
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) {
        if (!p.get(x, y)) continue;
        if (!p.get(x, y - 1) || (!p.get(x, y - 2) && r() < 0.6)) {
          if (r() < 0.75) p.set(x, y, bayer(x, y) < 0.5 ? PAL.g4 : PAL.g3);
        }
      }
  }
  p.outline(PAL.ink);
  return p;
}

export function makeFlowers(seed) {
  const r = rng(seed);
  const p = new Pix(13, 9);
  const colors = [PAL.cream, PAL.pink, PAL.ice3, PAL.yel3, PAL.pur3, PAL.org3];
  const petal = colors[Math.floor(r() * colors.length)];
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(r() * 9),
      y = 1 + Math.floor(r() * 4);
    for (let k = y + 2; k < 9; k++) p.set(x, k, k === 8 ? PAL.g2 : PAL.g3); // caule
    p.set(x - 1, y, petal);
    p.set(x + 1, y, petal);
    p.set(x, y - 1, petal);
    p.set(x, y + 1, petal);
    p.set(x, y, PAL.yel2);
  }
  return p;
}

export function makeTuft(seed) {
  const r = rng(seed);
  const p = new Pix(11, 8);
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(r() * 9);
    const h = 3 + Math.floor(r() * 5);
    const lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < h; k++) {
      const xx = x + (k > h * 0.6 ? lean : 0);
      p.set(xx, 7 - k, k === h - 1 ? PAL.g6 : k < 2 ? PAL.g3 : PAL.g5);
    }
  }
  return p;
}

export function makeMushrooms(seed) {
  const r = rng(seed);
  const p = new Pix(14, 12);
  const caps = [
    [PAL.red1, PAL.red2, PAL.red3],
    [PAL.org1, PAL.org2, PAL.org3],
    [PAL.pur1, PAL.pur2, PAL.pur3],
  ][Math.floor(r() * 3)];
  const shroom = (x, y, s) => {
    for (let k = 0; k < s + 1; k++) p.set(x, y + k, k === s ? PAL.n4 : PAL.cream); // pé
    for (let dx = -s; dx <= s; dx++)
      for (let dy = -Math.ceil(s * 0.7); dy <= 0; dy++) {
        const e = (dx / (s + 0.5)) ** 2 + (dy / (s * 0.7 + 0.5)) ** 2;
        if (e > 1) continue;
        p.set(x + dx, y + dy - 1, dx < 0 && dy < -s * 0.3 ? caps[2] : dy === 0 ? caps[0] : caps[1]);
      }
    p.set(x - 1, y - 2, PAL.white);
    if (s > 2) p.set(x + 1, y - 3, PAL.white);
  };
  shroom(4, 7, 3);
  if (r() < 0.8) shroom(10, 9, 2);
  p.outline(PAL.ink);
  return p;
}

export function makeStump(seed) {
  const r = rng(seed);
  const p = new Pix(18, 14);
  // Lateral
  for (let y = 5; y < 12; y++)
    for (let x = 2; x < 16; x++) {
      const u = (x - 2) / 14;
      p.set(x, y, u < 0.25 ? PAL.n3 : u < 0.7 ? PAL.n2 : PAL.n1);
    }
  // Raízes
  p.rect(0, 11, 4, 2, PAL.n2);
  p.rect(14, 11, 4, 2, PAL.n1);
  // Topo com anéis
  p.ellipse(9, 5, 7, 3, PAL.n4);
  p.ellipse(9, 5, 4.5, 2, 0xc99a6a);
  p.ellipse(9, 5, 2, 1, PAL.n4);
  if (r() < 0.6) {
    p.set(4, 8, PAL.g4);
    p.set(5, 9, PAL.g3);
    p.set(4, 9, PAL.g3);
  }
  p.outline(PAL.ink);
  return p;
}

export function makeLog(seed) {
  const r = rng(seed);
  const p = new Pix(30, 11);
  for (let y = 1; y < 10; y++)
    for (let x = 4; x < 28; x++) {
      const v = (y - 1) / 9;
      let c = v < 0.3 ? PAL.n3 : v < 0.7 ? PAL.n2 : PAL.n1;
      if ((x * 5 + y) % 9 === 0) c = PAL.n1;
      p.set(x, y, c);
    }
  p.ellipse(4, 5.5, 3.5, 4.5, PAL.n4);
  p.ellipse(4, 5.5, 2, 3, 0xc99a6a);
  p.set(4, 5, PAL.n3);
  // Musgo
  for (let x = 8; x < 26; x++) if (r() < 0.55) p.set(x, 1, PAL.g4);
  p.outline(PAL.ink);
  return p;
}

// Registra TODO o cenário num ATLAS único ("env") — um só bind de textura pra
// centenas de árvores/pedras (batching no celular). Retorna os nomes de frame
// por categoria. O chão fica como textura própria (tileSprite repete).
export function registerEnvironment(scene) {
  const keys = { trees: [], pines: [], bushes: [], rocks: [], flowers: [], tufts: [], shrooms: [], stumps: [], logs: [], patches: { dark: [], dirt: [], moss: [] } };
  makeGroundTile().register(scene, "env_ground");
  const items = [];
  const add = (list, name, pix) => {
    items.push({ name, pix });
    list.push(name);
  };
  for (let i = 0; i < 4; i++) add(keys.trees, `tree${i}`, makeTree(100 + i * 17, { fruit: i === 3 ? PAL.yel3 : null }));
  add(keys.trees, "tree_big", makeTree(777, { w: 58, h: 72, trunkW: 8 }));
  add(keys.trees, "tree_autumn", makeTree(555, { ramp: LEAF_WARM }));
  for (let i = 0; i < 3; i++) add(keys.pines, `pine${i}`, makePine(300 + i * 13, { h: 52 + i * 8 }));
  for (let i = 0; i < 4; i++) add(keys.bushes, `bush${i}`, makeBush(400 + i * 11, { berries: i % 2 ? PAL.red2 : null }));
  for (let i = 0; i < 4; i++) add(keys.rocks, `rock${i}`, makeRock(500 + i * 7, { w: 14 + i * 4, h: 10 + i * 2 }));
  for (let i = 0; i < 6; i++) add(keys.flowers, `flower${i}`, makeFlowers(600 + i * 5));
  for (let i = 0; i < 4; i++) add(keys.tufts, `tuft${i}`, makeTuft(700 + i * 3));
  for (let i = 0; i < 3; i++) add(keys.shrooms, `shroom${i}`, makeMushrooms(800 + i * 9));
  for (let i = 0; i < 2; i++) add(keys.stumps, `stump${i}`, makeStump(900 + i));
  add(keys.logs, "log0", makeLog(950));
  for (let i = 0; i < 4; i++) {
    add(keys.patches.dark, `patch_dark${i}`, makePatch("dark", 1000 + i));
    add(keys.patches.dirt, `patch_dirt${i}`, makePatch("dirt", 1100 + i));
    add(keys.patches.moss, `patch_moss${i}`, makePatch("moss", 1200 + i));
  }

  // Empacotamento em prateleiras (1px de respiro contra sangramento)
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
  if (scene.textures.exists("env")) scene.textures.remove("env");
  const tex = scene.textures.createCanvas("env", AW, AH);
  const ctx = tex.getContext();
  for (const it of placed) {
    ctx.putImageData(it.pix.toImageData(ctx), it.x, it.y);
    tex.add(it.name, 0, it.x, it.y, it.pix.w, it.pix.h);
  }
  tex.refresh();
  return keys;
}
