// Arte da tela de título: a clareira à noite em camadas (céu, serra, duas matas com luar na borda, chão da
// clareira), as árvores que emolduram a cena — enraizadas fora da tela, com as copas por cima dos cantos —,
// samambaias à frente, fogueira de pedras, lua, nuvens, folhas e o ornamento do título. Tudo em pixel de
// arte (1 px = 3 px na tela, como o resto do cenário) e só com a paleta (Palette.js).
import { PAL } from "./Palette.js";
import { Pix, rng, bayer } from "./PixelArt.js";

export const TITLE_PX = 3; // escala de todas as camadas

// Rampa em faixas: t ∈ [0, 1] ao longo dos tons; só o fim de cada faixa é pontilhado (soft = a parte da faixa
// que mistura com a próxima), o meio fica liso
function ramp(colors, t, x, y, soft = 0.35) {
  const s = Math.max(0, Math.min(0.9999, t)) * (colors.length - 1);
  const i = Math.floor(s);
  const th = (s - i - (1 - soft)) / soft;
  return th > 0 && bayer(x, y) < th ? colors[i + 1] : colors[i];
}

// Cor interpolada ao longo de uma rampa de tons da paleta (para degradê liso, sem pontilhado)
function mixRamp(colors, t) {
  const s = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(s)),
    f = s - i;
  const a = colors[i],
    b = colors[i + 1];
  const ch = (sh) => Math.round(((a >> sh) & 255) * (1 - f) + ((b >> sh) & 255) * f) << sh;
  return ch(16) | ch(8) | ch(0);
}

// Ruído suave de valor (soma de senos) para manchas grandes
const blot = (x, y, k, ph) => 0.5 + 0.25 * Math.sin(x * 0.07 * k + ph) * Math.cos(y * 0.11 * k - ph * 0.7) + 0.25 * Math.sin((x + y * 1.7) * 0.031 * k + ph * 1.3);

// Céu: rampa do alto à névoa do horizonte e uma faixa leve da Via Láctea na diagonal. o.tones troca a rampa (o
// amanhecer da vitória, ResultArt.js) e o.milky: false tira a Via Láctea
export function makeSky(w, h, horizon, seed = 11, o = {}) {
  const r = rng(seed);
  const p = new Pix(w, h);
  // degradê liso entre os tons da noite (uma cor por linha de arte): pontilhado aqui virava listras
  const tones = o.tones ?? [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4];
  for (let y = 0; y < h; y++) {
    const c = mixRamp(tones, Math.pow(Math.min(1, y / horizon), o.curve ?? 1.35));
    for (let x = 0; x < w; x++) p.set(x, y, c);
  }
  if (o.milky === false) return p;
  // Via Láctea: faixa diagonal com poeira de estrelas bem fraca
  for (let y = 0; y < horizon * 0.8; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.abs(y - (h * 0.05 + x * 0.22 - w * 0.02)) / (h * 0.11);
      if (d > 1) continue;
      if (r() < (1 - d) * 0.035) p.set(x, y, r() < 0.25 ? PAL.night3 : PAL.night2);
    }
  return p;
}

// Lua cheia com crateras e o lado de baixo à direita na sombra
export function makeMoon() {
  const R = 11.5;
  const p = new Pix(25, 25);
  const c = 12.5;
  for (let y = 0; y < 25; y++)
    for (let x = 0; x < 25; x++) {
      const dx = x + 0.5 - c,
        dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const lit = (-dx - dy) / (R * 1.4) + 0.55 - (d / R) * 0.25;
      p.set(x, y, ramp([PAL.moon0, PAL.moon1, PAL.moon2], lit, x, y));
    }
  const crater = (cx, cy, rx, ry) => {
    p.ellipse(cx, cy, rx, ry, PAL.moon0);
    for (let x = Math.floor(cx - rx); x < cx; x++) p.over(x, Math.floor(cy - ry), PAL.moon2); // borda acesa
  };
  crater(9, 8, 2.5, 2);
  crater(15.5, 13, 3.2, 2.6);
  crater(8.5, 16, 1.8, 1.5);
  crater(16, 6.5, 1.4, 1.2);
  return p;
}

// Nuvem comprida e fina: corpo escuro, luar na borda de cima, fiapos embaixo. o.colors = [corpo, borda];
// o.under: a luz vem de baixo (sol no horizonte, ResultArt.js) e acende a barriga em vez do topo
export function makeCloud(seed, w, h, o = {}) {
  const r = rng(seed);
  const p = new Pix(w, h);
  const [body, lit] = o.colors ?? [PAL.cloud0, PAL.cloud1];
  // base achatada e comprida; por cima, gomos redondos — mais altos no meio, menores nas pontas
  p.ellipse(w / 2, h * 0.72, w * 0.46, h * 0.22, body);
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const mid = Math.sin(u * Math.PI); // 0 nas pontas, 1 no meio
    const rr = h * (0.18 + mid * 0.3 + r() * 0.08);
    p.ellipse(w * (0.12 + u * 0.76) + (r() - 0.5) * 4, h * 0.72 - rr * 0.55, rr * (1.3 + r() * 0.4), rr, body);
  }
  const dy = o.under ? 1 : -1;
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++) {
      if (!p.get(x, y)) continue;
      if (!p.get(x, y + dy)) p.set(x, y, lit); // luar (ou sol) na borda
      else if (!p.get(x, y + 2 * dy) && !p.get(x - 1, y + dy)) p.set(x, y, lit);
    }
  return p;
}

// Serra ao fundo: linha de cumes suave, luar na crista (mais forte perto da lua). colors = [serra, crista]
export function makeRidge(w, h, base, amp, seed, moonX, colors = [PAL.ridge0, PAL.ridge1]) {
  const r = rng(seed);
  const p = new Pix(w, h);
  const ph = [r() * 7, r() * 7, r() * 7];
  for (let x = 0; x < w; x++) {
    const n = 0.5 * Math.sin(x * 0.011 + ph[0]) + 0.3 * Math.sin(x * 0.029 + ph[1]) + 0.2 * Math.sin(x * 0.071 + ph[2]);
    const top = Math.round(base - amp * (0.55 + 0.45 * n));
    for (let y = Math.max(0, top); y < h; y++) p.set(x, y, colors[0]);
    const near = 1 - Math.min(1, Math.abs(x - moonX) / (w * 0.45));
    if (top >= 0 && near > 0.15) p.set(x, top, colors[1]); // crista contínua, só do lado da lua
  }
  return p;
}

// Mata em silhueta: pinheiros (cones em degraus) e copas redondas lado a lado, cheias até embaixo (nada boia).
// O topo de cada coluna leva o luar; o lado virado para a lua, um pixel a mais
export function makeTreeline(w, h, base, o) {
  const r = rng(o.seed);
  const top = new Float32Array(w).fill(h);
  const lift = (x, y) => {
    x = Math.round(x);
    if (x >= 0 && x < w && y < top[x]) top[x] = y;
  };
  let x = -12;
  while (x < w + 12) {
    const hh = o.minH + r() * (o.maxH - o.minH);
    const y0 = base + (r() - 0.5) * o.jitter;
    if (r() < o.pines) {
      const hw = hh * (0.2 + r() * 0.07);
      for (let xx = Math.floor(x - hw); xx <= Math.ceil(x + hw); xx++) {
        const d = Math.abs(xx - x) / hw;
        const tier = Math.floor(d * 4); // galhos em degraus
        lift(xx, y0 - hh * (1 - d) + tier * 1.5 + (xx % 2 ? 1 : 0));
      }
      x += hw * (1.1 + r() * 0.6);
    } else {
      const rw = hh * (0.42 + r() * 0.18);
      const bumps = 3 + Math.floor(r() * 3);
      for (let b = 0; b < bumps; b++) {
        const bx = x + (b / (bumps - 1) - 0.5) * rw * 1.2;
        const rx = rw * (0.35 + r() * 0.2),
          ry = hh * (0.3 + r() * 0.15);
        const by = y0 - hh + ry + (b % 2 ? ry * 0.35 : 0) + r() * 2;
        for (let xx = Math.floor(bx - rx); xx <= Math.ceil(bx + rx); xx++) {
          const u = (xx - bx) / rx;
          if (Math.abs(u) <= 1) lift(xx, by - ry * Math.sqrt(1 - u * u));
        }
      }
      x += rw * (1.0 + r() * 0.5);
    }
  }
  const p = new Pix(w, h);
  for (let xx = 0; xx < w; xx++) {
    const t = Math.max(0, Math.floor(top[xx]));
    for (let y = t; y < h; y++) p.set(xx, y, o.fill);
    if (t >= h) continue;
    p.set(xx, t, o.rim);
    const facing = o.moonX > xx ? top[xx + 1] > top[xx] + 0.5 : top[xx - 1] > top[xx] + 0.5;
    if (facing) p.set(xx, t + 1, o.rim);
    // folhagem: pontos do tom de luar logo abaixo da borda (a mata da frente)
    if (o.leafy) for (let y = t + 2; y < t + 7; y++) if (bayer(xx * 3, y * 5) < 0.08 * (t + 7 - y)) p.set(xx, y, o.rim);
  }
  return p;
}

// Chão da clareira: escuro e enevoado longe, mais verde perto, com o terreiro batido em volta da fogueira.
// o.tones = rampa do gramado e o.blades = [folha, folha perto, ponta] (o chão seco do sertão, ResultArt)
export function makeGround(w, h, fx, fy, seed = 5, o = {}) {
  const r = rng(seed);
  const p = new Pix(w, h);
  const tones = o.tones ?? [PAL.woodsNear0, PAL.g0, PAL.g1, PAL.g2];
  const [bl0, bl1, bl2] = o.blades ?? [PAL.g2, PAL.g3, PAL.g4];
  const ph = r() * 6;
  const clear = (x, y) => {
    const dx = (x - fx) / (h * 0.95),
      dy = (y - fy) / (h * 0.24);
    return Math.sqrt(dx * dx + dy * dy) + (blot(x, y, 2.2, ph) - 0.5) * 0.35;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = y / h;
      // gramado em manchas grandes (mais escuro longe), terreiro batido em volta da fogueira
      let c = ramp(tones, Math.pow(near, 0.75) * 0.8 + (blot(x, y, 1, ph) - 0.5) * 0.35, x, y, 0.3);
      const dd = clear(x, y);
      if (dd < 1) c = ramp([PAL.n1, PAL.n0, c], Math.max(0, (dd - 0.25) / 0.75), x, y, 0.45);
      p.set(x, y, c);
    }
  // grama: touceiras de folhas de 2–3 px, mais altas e claras perto
  const n = Math.round(w * h * 0.0035);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w),
      y = Math.floor(2 + r() * (h - 2));
    if (clear(x, y) < 1.1) continue;
    const near = y / h;
    const blades = 2 + Math.floor(r() * 3);
    const hgt = 1 + Math.round(near * 2);
    for (let b = 0; b < blades; b++) {
      const bx = x + b - (blades >> 1);
      for (let k = 0; k <= hgt - (b % 2); k++) p.set(bx, y - k, k === hgt - (b % 2) ? (near > 0.55 ? bl2 : bl1) : near > 0.5 ? bl1 : bl0);
    }
  }
  // pedrinhas no terreiro
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2,
      d = 0.35 + r() * 0.55;
    const x = Math.round(fx + Math.cos(a) * h * 0.95 * d),
      y = Math.round(fy + Math.sin(a) * h * 0.24 * d);
    p.set(x, y, PAL.s1);
    p.set(x + 1, y, PAL.s2);
  }
  return p;
}

// Árvore da moldura (lado esquerdo; a da direita é a mesma espelhada): tronco grosso da base da tela até o alto,
// raízes abertas embaixo, casca com veios, luar frio na borda de dentro em cima e o calor da fogueira embaixo
export function makeFrameTrunk(h, tw, seed) {
  const r = rng(seed);
  const W = tw + 26;
  const p = new Pix(W, h);
  const bend = r() * 6.28;
  for (let y = 0; y < h; y++) {
    const fl = Math.max(0, y - (h - 16)); // raízes
    const cx = 4 + tw / 2 + Math.sin(y * 0.018 + bend) * 2.5;
    const hw = tw / 2 + fl * 0.9;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let c = u < 0.18 ? PAL.ink : u < 0.62 ? PAL.n0 : PAL.n1;
      if ((x * 5 + Math.floor(y / 3) * 7) % 13 === 0 || (x + y * 3) % 17 === 0) c = PAL.ink; // veios
      if (u > 0.84) c = y < h * 0.55 ? (bayer(x, y) < 0.6 ? PAL.moonRim : PAL.n1) : bayer(x, y) < (y / h - 0.45) * 1.6 ? PAL.n3 : PAL.n2;
      p.set(x, y, c);
    }
  }
  // galho saindo para dentro, no alto
  const by = Math.floor(h * 0.16);
  for (let i = 0; i < 26; i++) {
    const x = tw + 2 + i,
      y = by - Math.floor(i * 0.45);
    const th = Math.max(1, 4 - Math.floor(i / 7));
    for (let k = 0; k < th; k++) p.set(x, y + k, k === 0 ? PAL.n1 : PAL.n0);
  }
  p.outline(PAL.ink);
  return p;
}

// Cacho de folhas das copas da moldura: bolhas escuras, folhas claras viradas para a lua, cipós pendurados
export function makeCanopy(seed, w, h, vines = 2) {
  const r = rng(seed);
  const p = new Pix(w, h + 18);
  const n = 7 + Math.floor(r() * 4);
  const blobs = [];
  for (let i = 0; i < n; i++) blobs.push({ x: w * (0.1 + r() * 0.8), y: h * (0.25 + r() * 0.5), rx: w * (0.14 + r() * 0.12), ry: h * (0.2 + r() * 0.14) });
  blobs.sort((a, b) => a.y - b.y);
  // cada bolha: corpo escuro, metade de cima um tom acima (volume), e a de trás fica por baixo da da frente
  for (const b of blobs) {
    p.ellipse(b.x, b.y, b.rx, b.ry, PAL.t0);
    p.ellipse(b.x - b.rx * 0.12, b.y - b.ry * 0.28, b.rx * 0.78, b.ry * 0.62, PAL.t1);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!p.get(x, y)) continue;
      if (!p.get(x, y + 1) || !p.get(x, y + 2)) p.set(x, y, PAL.woodsNear0); // barriga na sombra
    }
  // cachinhos de folhas acesos na borda de cima (3 px em "v"), não um chuvisco
  for (let y = 1; y < h; y++)
    for (let x = 1; x < w - 1; x++) {
      if (!p.get(x, y) || p.get(x, y - 1) || r() > 0.45) continue;
      p.set(x, y, PAL.t2);
      p.set(x - 1, y + 1, PAL.t2);
      p.set(x + 1, y + 1, PAL.t2);
      p.set(x, y + 1, PAL.t1);
      if (r() < 0.35) p.set(x, y, PAL.g2);
    }
  for (let v = 0; v < vines; v++) {
    const x = Math.floor(w * (0.25 + r() * 0.55));
    let y = Math.floor(h * 0.6);
    while (y < h - 1 && p.get(x, y)) y++;
    const len = 8 + Math.floor(r() * 10);
    for (let k = 0; k < len; k++) {
      const xx = x + Math.round(Math.sin(k * 0.5) * 0.8);
      p.set(xx, y + k, PAL.t1);
      if (k % 4 === 2) p.set(xx + (k % 8 === 2 ? 1 : -1), y + k, PAL.g2);
    }
  }
  p.outline(PAL.ink);
  return p;
}

// Samambaia em primeiro plano: frondes curvas com folíolos, quase em silhueta
export function makeFern(seed, w = 46, h = 30, flip = false) {
  const r = rng(seed);
  const p = new Pix(w, h);
  const bx = flip ? w - 8 : 8;
  const fronds = 6;
  for (let f = 0; f < fronds; f++) {
    const ang = (flip ? -1 : 1) * (0.25 + (f / (fronds - 1)) * 1.15) - (flip ? -0.15 : 0.15);
    const len = h * (0.75 + r() * 0.3);
    for (let s = 0; s < len; s++) {
      const t = s / len;
      const a = ang + t * t * (flip ? -0.9 : 0.9); // a ponta cai
      const x = bx + Math.sin(a) * s,
        y = h - 1 - Math.cos(a) * s * 0.95;
      p.set(x, y, PAL.t0);
      const leaf = Math.round((1 - t) * 3.5);
      for (let k = 1; k <= leaf; k++) {
        if (s % 2) continue;
        p.set(x - Math.cos(a) * k, y - Math.sin(a) * k * 0.6, k === leaf ? PAL.t1 : PAL.t0);
        p.set(x + Math.cos(a) * k, y + Math.sin(a) * k * 0.6, PAL.woodsNear0);
      }
    }
  }
  p.outline(PAL.ink);
  return p;
}

// Fogueira: anel de pedras, duas toras cruzadas e o braseiro
export function makeCampfire() {
  const p = new Pix(30, 15);
  const cx = 15,
    cy = 9;
  // braseiro
  p.ellipse(cx, cy + 1, 8, 3, PAL.red0);
  p.ellipse(cx, cy + 1, 5, 2, PAL.org1);
  p.set(cx - 2, cy + 1, PAL.yel2);
  p.set(cx + 2, cy, PAL.org3);
  // toras cruzadas
  const log = (x0, y0, x1, y1) => {
    for (let k = 0; k <= 1; k++) p.line(x0, y0 + k, x1, y1 + k, k ? PAL.n1 : PAL.n2);
    p.set(x0, y0, PAL.n4);
    p.set(x1, y1, PAL.n4);
  };
  log(cx - 9, cy + 2, cx + 6, cy - 2);
  log(cx - 6, cy - 2, cx + 9, cy + 2);
  // pedras em volta
  const stones = [
    [-12, 1], [-9, 4], [-4, 5], [1, 5], [6, 5], [10, 3], [12, 0], [-10, -2], [9, -2],
  ];
  for (const [sx, sy] of stones) {
    const x = cx + sx,
      y = cy + sy;
    p.rect(x - 1, y - 1, 3, 2, PAL.s2);
    p.set(x - 1, y - 1, PAL.s3);
    p.set(x + 1, y, PAL.s1);
  }
  p.outline(PAL.ink);
  return p;
}

// Folhas que caem das copas (verde e uma amarelada)
export function makeLeaf(warm) {
  const p = new Pix(5, 4);
  const a = warm ? PAL.yel1 : PAL.g3,
    b = warm ? PAL.org3 : PAL.g5;
  p.set(1, 0, b);
  p.rect(0, 1, 4, 1, a);
  p.rect(1, 2, 3, 1, a);
  p.set(1, 1, b);
  p.set(4, 3, PAL.n2); // cabinho
  return p;
}

// Estrela cadente: cabeça branca, rabo que some
export function makeStreak() {
  const p = new Pix(22, 2);
  for (let x = 0; x < 22; x++) {
    const a = Math.round(255 * Math.pow(x / 21, 1.6));
    p.set(x, 0, x > 18 ? PAL.white : PAL.ice3, a);
    if (x > 14) p.set(x, 1, PAL.ice3, Math.round(a * 0.4));
  }
  return p;
}

// Ornamento do título: cipó dourado com folhas e um losango no meio
export function makeVine(w = 71) {
  const p = new Pix(w, 9);
  const c = Math.floor(w / 2);
  for (let x = 2; x < w - 2; x++) {
    if (Math.abs(x - c) < 4) continue;
    const y = 4 + Math.round(Math.sin((x - c) * 0.32) * 1.2);
    p.set(x, y, Math.abs(x - c) > w * 0.36 ? PAL.yel1 : PAL.yel2);
    if ((x - c) % 7 === 0) {
      const s = x < c ? -1 : 1;
      p.set(x + s, y - 1, PAL.g5);
      p.set(x + s, y - 2, PAL.g4);
      p.set(x + 2 * s, y - 2, PAL.g5);
    }
  }
  // losango central
  for (let k = 0; k <= 3; k++) {
    for (let j = -k; j <= k; j++) {
      p.set(c + j, 1 + k, PAL.yel2);
      p.set(c + j, 7 - k, PAL.yel2);
    }
  }
  p.set(c, 4, PAL.yel3);
  p.set(c - 1, 3, PAL.yel3);
  p.outline(PAL.ink);
  return p;
}
