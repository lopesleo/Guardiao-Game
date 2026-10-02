// Arte procedural da ambientação da Clareira: chão com trilhas de terra batida
// e terreiro (pintado numa textura só, sob medida para o mapa), fogueira com
// anel de pedras, troncos de sentar, bandeirinhas de festa junina com
// luzinhas, rede listrada, espantalho, regador e a vinheta da câmera.
import { PAL } from "./Palette.js";
import { Pix, bayer, rng } from "./PixelArt.js";

const K = PAL.ink;
const DIRT = [PAL.n0, PAL.n1, PAL.n2, PAL.n3];

// ---------------------------------------------------------------------------
// CHÃO: trilhas curvas da fogueira até cada lugar + terreiro irregular.
// spec = { x0, y0, w, h (mundo), scale, hub:{x,y,r}, paths:[{x,y,w}] }
// Devolve { onPath(x, y) } para a cena não semear flores em cima da trilha.
// ---------------------------------------------------------------------------
export function paintGround(scene, key, spec) {
  const S = spec.scale;
  const W = Math.ceil(spec.w / S),
    H = Math.ceil(spec.h / S);
  const p = new Pix(W, H);
  const mask = new Uint8Array(W * H);
  const r = rng(1789);
  const toA = (x, y) => [(x - spec.x0) / S, (y - spec.y0) / S];
  // Carimba um disco de terra com a borda "comida" pelo capim
  const stamp = (cx, cy, rad, worn = 1) => {
    const R = Math.ceil(rad + 2);
    for (let y = Math.floor(cy - R); y <= cy + R; y++)
      for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const edge = rad + Math.sin(x * 0.9 + y * 0.4) * 0.8 + Math.sin(y * 1.3 - x * 0.2) * 0.6;
        if (d > edge + 1) continue;
        const i = y * W + x;
        if (d > edge) {
          // franja: terra salpicada no capim
          if (!mask[i] && bayer(x, y) < 0.3) p.set(x, y, PAL.n1);
          continue;
        }
        mask[i] = 1;
      }
  };
  // Terreiro em volta da fogueira (borda ondulada)
  const [hx, hy] = toA(spec.hub.x, spec.hub.y);
  const hr = spec.hub.r / S;
  for (let y = Math.floor(hy - hr); y <= hy + hr; y++)
    for (let x = Math.floor(hx - hr - 3); x <= hx + hr + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - hx,
        dy = (y + 0.5 - hy) / 0.78;
      const a = Math.atan2(dy, dx);
      const rr = hr * (1 + 0.1 * Math.sin(3 * a + 1) + 0.06 * Math.sin(7 * a)) + Math.sin(x * 0.9 + y * 0.4) * 0.8;
      const d = Math.hypot(dx, dy);
      if (d <= rr) mask[y * W + x] = 1;
      else if (d <= rr + 1.5 && bayer(x, y) < 0.3) p.set(x, y, PAL.n1);
    }
  // Trilhas: curvas em S (Bézier cúbica) com a largura mudando devagar.
  // Cada trilha sai do terreiro ou de um ponto de outra trilha (ramos).
  for (const t of spec.paths) {
    const [sx, sy] = t.from ? toA(t.from.x, t.from.y) : [hx, hy];
    const [ax, ay] = toA(t.x, t.y);
    const len = Math.hypot(ax - sx, ay - sy);
    const nx = -(ay - sy) / len,
      ny = (ax - sx) / len;
    const b1 = (t.bend ?? (r() - 0.5) * 0.6) * len,
      b2 = -b1 * (0.4 + r() * 0.6);
    const c1 = [sx + (ax - sx) * 0.33 + nx * b1, sy + (ay - sy) * 0.33 + ny * b1];
    const c2 = [sx + (ax - sx) * 0.66 + nx * b2, sy + (ay - sy) * 0.66 + ny * b2];
    const steps = Math.ceil(len * 1.5);
    const w0 = (t.w ?? 12) / S / 2;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps,
        v = 1 - u;
      const x = v * v * v * sx + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * ax;
      const y = v * v * v * sy + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * ay;
      // afina perto do destino (trilha de pé, não estrada)
      const taper = t.taper === false ? 1 : 1 - 0.35 * u;
      stamp(x, y, w0 * taper * (0.85 + 0.2 * Math.sin(u * 7 + len)));
    }
  }
  // Pinta a terra: batida no meio, sulcos, pedrinhas e capim teimoso
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      let inner = 0;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const X = x + dx,
          Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && mask[Y * W + X]) inner++;
      }
      let c = DIRT[2];
      const n = Math.sin(x * 0.31 + y * 0.17) + Math.sin(x * 0.07 - y * 0.23);
      if (inner < 4) c = bayer(x, y) < 0.5 ? DIRT[1] : DIRT[2]; // borda mais escura
      else if (n > 1.1 && bayer(x, y) < 0.5) c = DIRT[3]; // terra batida clara
      else if (n < -1.2 && bayer(x, y) < 0.4) c = DIRT[1];
      p.set(x, y, c);
    }
  for (let k = 0; k < W * H * 0.004; k++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * H);
    if (!mask[y * W + x]) continue;
    const q = r();
    if (q < 0.45) p.set(x, y, PAL.s2);
    else if (q < 0.6) {
      p.set(x, y, PAL.s3);
      p.set(x + 1, y, PAL.s1);
    } else if (q < 0.8) {
      p.set(x, y, PAL.g3); // capim teimoso
      p.set(x, y - 1, PAL.g4);
    } else p.set(x, y, DIRT[0]);
  }
  p.register(scene, key);
  return {
    onPath(x, y, pad = 0) {
      const [ax, ay] = toA(x, y);
      const R = Math.ceil(pad / S);
      for (let j = -R; j <= R; j++)
        for (let i = -R; i <= R; i++) {
          const X = Math.floor(ax + i),
            Y = Math.floor(ay + j);
          if (X >= 0 && Y >= 0 && X < W && Y < H && mask[Y * W + X]) return true;
        }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// FOGUEIRA: anel de pedras, lenha cruzada, brasas
// ---------------------------------------------------------------------------
function makeFire() {
  const p = new Pix(36, 22);
  // chão chamuscado
  p.ellipse(18, 13, 15, 7.5, PAL.n0);
  p.ellipse(18, 13, 10, 4.5, 0x1f120f);
  // lenha cruzada
  const log = (x0, y0, x1, y1) => {
    for (let t = 0; t <= 1; t += 0.03) {
      const x = x0 + (x1 - x0) * t,
        y = y0 + (y1 - y0) * t;
      p.disc(x, y, 1.6, PAL.n2);
      p.set(Math.round(x), Math.round(y - 1), PAL.n3);
    }
    p.disc(x0, y0, 1.7, PAL.n4); // ponta cortada
    p.set(Math.round(x0), Math.round(y0), PAL.n3);
  };
  log(8, 9, 26, 15);
  log(28, 8, 10, 16);
  log(18, 6, 18, 17);
  // brasas
  for (const [x, y, c] of [[15, 13, PAL.org2], [20, 12, PAL.yel3], [18, 14, PAL.org3], [22, 14, PAL.org1], [14, 11, PAL.org1], [17, 11, PAL.yel2]]) p.set(x, y, c);
  // anel de pedras
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
    const x = 18 + Math.cos(a) * 15,
      y = 13 + Math.sin(a) * 7.5;
    p.ellipse(x, y, 2.6, 2, PAL.s1);
    p.ellipse(x - 0.5, y - 0.6, 1.8, 1.2, a > 0 && a < Math.PI ? PAL.s2 : PAL.s3);
    if (a > Math.PI) p.set(Math.round(x - 1), Math.round(y - 1), PAL.s4);
  }
  return p.outline(K);
}

// Tronco de sentar (deitado), com os anéis do corte à mostra
function makeLogSeat() {
  const p = new Pix(28, 10);
  for (let x = 3; x < 25; x++)
    for (let y = 2; y < 9; y++) {
      let c = y < 4 ? PAL.n3 : y > 6 ? PAL.n1 : PAL.n2;
      if ((x * 5 + y * 2) % 11 === 0) c = PAL.n1; // casca
      p.set(x, y, c);
    }
  p.ellipse(3.5, 5.5, 2.6, 3.4, PAL.n4);
  p.ellipse(3.5, 5.5, 1.4, 2, PAL.n3);
  p.set(3, 5, PAL.n2);
  // musgo e cogumelinho
  for (let x = 8; x < 18; x++) if (bayer(x, 2) < 0.5) p.set(x, 2, PAL.g4);
  p.set(21, 1, PAL.red2);
  p.set(22, 1, PAL.red2);
  p.set(21, 2, PAL.cream);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// BANDEIRINHAS de festa junina (uma textura por cor) e a luzinha
// ---------------------------------------------------------------------------
const FLAG_COLORS = [PAL.red2, PAL.yel2, PAL.ice2, PAL.g5, PAL.pink, PAL.org2, PAL.pur2, PAL.cream];
function makeFlag(c) {
  const p = new Pix(7, 8);
  for (let y = 0; y < 7; y++) {
    const half = 3 - y * 0.45;
    for (let x = 0; x < 7; x++) if (Math.abs(x + 0.5 - 3.5) <= half + 0.5) p.set(x, y, y === 0 ? PAL.white : c);
  }
  // bico recortado (rabo de andorinha)
  p.set(3, 6, 0);
  p.set(3, 5, c);
  return p.outline(K);
}
function makeBulb() {
  const p = new Pix(4, 5);
  p.rect(1, 0, 2, 1, PAL.s1);
  p.disc(2, 3, 1.6, PAL.yel3);
  p.set(1, 2, PAL.white);
  return p;
}

// Poste de madeira do varal
function makePole() {
  const p = new Pix(5, 34);
  for (let y = 2; y < 34; y++) {
    p.set(1, y, PAL.n3);
    p.set(2, y, PAL.n2);
    p.set(3, y, PAL.n1);
  }
  p.rect(0, 0, 5, 3, PAL.n2);
  p.rect(0, 0, 5, 1, PAL.n4);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// REDE listrada entre dois esteios
// ---------------------------------------------------------------------------
function makeHammock() {
  const p = new Pix(46, 28);
  for (const x of [2, 42]) {
    for (let y = 2; y < 28; y++) {
      p.set(x, y, PAL.n3);
      p.set(x + 1, y, PAL.n2);
    }
    p.rect(x - 1, 1, 4, 2, PAL.n2);
  }
  // cordas até o pano
  p.line(4, 6, 9, 12, 0xd8b070);
  p.line(41, 6, 36, 12, 0xd8b070);
  // pano em curva, listrado
  const stripes = [PAL.red2, PAL.yel2, PAL.g5, PAL.ice2, PAL.cream];
  for (let x = 9; x <= 36; x++) {
    const t = (x - 9) / 27;
    const sag = Math.sin(t * Math.PI) * 7;
    const top = Math.round(11 + sag),
      bot = Math.round(15 + sag * 1.15);
    for (let y = top; y <= bot; y++) p.set(x, y, stripes[Math.floor((x - 9) / 3) % stripes.length]);
    p.set(x, top, PAL.white);
    if (x % 3 === 0) p.set(x, bot + 1, stripes[(x / 3) % stripes.length]); // franjas
  }
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// ESPANTALHO de chapéu de palha (guarda a horta) e o REGADOR
// ---------------------------------------------------------------------------
function makeScarecrow() {
  const p = new Pix(22, 34);
  // estaca e braço
  for (let y = 10; y < 34; y++) p.set(11, y, PAL.n2);
  for (let x = 2; x < 20; x++) p.set(x, 15, PAL.n3);
  // camisa xadrez
  for (let y = 13; y < 24; y++)
    for (let x = 6; x < 16; x++) p.set(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? PAL.red1 : PAL.red2);
  for (let x = 3; x < 6; x++) p.set(x, 15, PAL.red2);
  for (let x = 16; x < 19; x++) p.set(x, 15, PAL.red2);
  // palha saindo das mangas e da barra
  for (const [x, y] of [[2, 14], [2, 16], [19, 14], [19, 16], [7, 24], [9, 25], [12, 24], [14, 25]]) p.set(x, y, PAL.yel2);
  // cabeça de saco com rosto de linha
  p.disc(11, 9, 4, 0xd8ccb0);
  p.set(9, 8, K);
  p.set(13, 8, K);
  p.line(9, 11, 13, 11, PAL.n1);
  // chapéu de palha
  p.rect(4, 5, 15, 2, PAL.yel1);
  p.rect(7, 2, 9, 3, PAL.yel2);
  p.rect(7, 4, 9, 1, PAL.red1); // fita
  p.set(8, 2, PAL.yel3);
  return p.outline(K);
}
function makeCan() {
  const p = new Pix(14, 10);
  p.rect(3, 3, 7, 6, PAL.s2);
  p.rect(3, 3, 7, 1, PAL.s4);
  p.rect(3, 8, 7, 1, PAL.s1);
  p.line(10, 6, 13, 2, PAL.s3); // bico
  p.rect(12, 1, 2, 2, PAL.s2);
  p.line(4, 3, 6, 0, PAL.s1); // alça
  p.line(6, 0, 9, 3, PAL.s1);
  return p.outline(K);
}

// ---------------------------------------------------------------------------
// SAMAÚMA: a gigante da mata (marco da Clareira). Sapopemas (raízes em aba)
// abertas no chão, tronco claro e liso, copa larga de guarda-chuva e cipós
// ---------------------------------------------------------------------------
function makeKapok(glow = null) {
  const W = 84,
    H = 104;
  const p = new Pix(W, H);
  const r = rng(515);
  const cx = 42;
  const bark = [PAL.s1, PAL.s2, 0x8a8478, 0xa8a090];
  // Sapopemas: lâminas que descem do tronco e se abrem no chão
  for (const [dir, reach, h] of [[-1, 30, 26], [1, 32, 24], [-1, 18, 30], [1, 16, 28], [0, 0, 12]]) {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const x0 = cx + dir * (4 + t * t * reach);
      const top = H - 4 - h + y;
      const half = 1.5 + t * 1.5;
      for (let x = Math.floor(x0 - half); x <= x0 + half; x++) p.set(x, top, x < x0 ? bark[3] : bark[1]);
    }
  }
  // Tronco (alto e liso, levemente mais largo em baixo)
  for (let y = 36; y < H - 8; y++) {
    const half = 5 + Math.max(0, (y - 70) / 8);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x - (cx - half)) / (2 * half);
      let c = u < 0.25 ? bark[3] : u < 0.6 ? bark[2] : u < 0.85 ? bark[1] : bark[0];
      if ((y * 3 + x) % 17 === 0) c = bark[1]; // marcas da casca
      p.set(x, y, c);
    }
  }
  // Galhos que sobem para a copa
  p.line(cx, 40, cx - 18, 26, bark[2]);
  p.line(cx + 1, 40, cx + 20, 24, bark[1]);
  p.line(cx - 1, 38, cx - 4, 22, bark[2]);
  // Copa em guarda-chuva: tufos sobrepostos de trás para a frente, cada um
  // com borda escura (volume) e luz irregular em cima
  const blob = (bx, by, rx, ry) => {
    for (let y = Math.floor(by - ry - 1); y <= by + ry + 1; y++)
      for (let x = Math.floor(bx - rx - 1); x <= bx + rx + 1; x++) {
        const dx = (x + 0.5 - bx) / rx,
          dy = (y + 0.5 - by) / ry;
        const wob = 0.12 * Math.sin(Math.atan2(dy, dx) * 5 + bx);
        const d = Math.sqrt(dx * dx + dy * dy) - wob;
        if (d > 1.12) continue;
        if (d > 1) {
          if (dy > -0.2) p.set(x, y, PAL.g1); // borda de sombra embaixo
          continue;
        }
        const n = Math.sin(x * 1.7 + y * 0.9) + Math.sin(x * 0.6 - y * 2.1);
        let c = PAL.g3;
        if (dy < -0.2 && dx < 0.4) c = n > 0.2 ? PAL.g5 : PAL.g4;
        if (dy < -0.5 && dx < 0.1 && n > 0.9) c = PAL.g6;
        if (dy > 0.35) c = n > 0.5 ? PAL.g3 : PAL.g2;
        p.set(x, y, c);
      }
  };
  for (const [bx, by, rx, ry] of [
    [42, 10, 14, 7],
    [22, 16, 14, 8],
    [62, 15, 14, 8],
    [10, 25, 10, 6],
    [74, 24, 10, 6],
    [32, 22, 13, 8],
    [52, 22, 13, 8],
    [42, 28, 12, 6],
  ])
    blob(bx, by, rx, ry);
  // Cipós pendurados
  for (let k = 0; k < 7; k++) {
    let x = 8 + Math.floor(r() * 68);
    const len = 8 + Math.floor(r() * 18);
    for (let y = 30; y < 30 + len; y++) {
      p.set(x, y, PAL.t3);
      if (y % 5 === 0) {
        x += r() < 0.5 ? -1 : 1;
        p.set(x + 1, y, PAL.g4); // folhinha
      }
    }
  }
  // Bromélias no tronco
  for (const [x, y] of [[cx - 6, 56], [cx + 6, 66]]) {
    p.set(x, y, PAL.g5);
    p.set(x - 1, y - 1, PAL.g4);
    p.set(x + 1, y - 1, PAL.g4);
    p.set(x, y - 2, PAL.red2);
  }
  if (glow) blessKapok(p, glow, cx, r);
  return p.outline(K);
}

// Samaúma desperta (roleta de bênçãos): flores na copa, contas de luz nos cipós, a
// espiral da mata entalhada no tronco e fitinhas coloridas amarradas (promessa/bênção).
// O que brilha também vai para `glow`, uma camada à parte que a cena faz pulsar.
function blessKapok(p, glow, cx, r) {
  const lit = (x, y, c, g = c) => {
    p.set(x, y, c);
    glow.set(x, y, g);
  };
  // Flores da samaúma (rosa-claro com miolo creme) só onde há folha
  const leafy = new Set([PAL.g2, PAL.g3, PAL.g4, PAL.g5, PAL.g6]);
  let n = 0;
  for (let k = 0; k < 400 && n < 22; k++) {
    const x = 4 + Math.floor(r() * 76),
      y = 4 + Math.floor(r() * 28);
    if (!leafy.has(p.rgb(x, y)) || !leafy.has(p.rgb(x + 1, y + 1))) continue;
    n++;
    const big = n % 3 === 0;
    lit(x, y, PAL.cream, PAL.yel3);
    p.set(x - 1, y, PAL.pink);
    p.set(x + 1, y, PAL.pink);
    if (big) {
      p.set(x, y - 1, PAL.pink);
      p.set(x, y + 1, PAL.pink);
      glow.set(x - 1, y, PAL.pink);
      glow.set(x + 1, y, PAL.pink);
    }
  }
  // Contas de luz nos cipós (a cada poucos pixels da trepadeira)
  for (let y = 31; y < 60; y += 3)
    for (let x = 0; x < p.w; x++) if (p.rgb(x, y) === PAL.t3 && (x + y) % 2 === 0) lit(x, y, PAL.yel3, PAL.yel3);
  // Espiral entalhada no tronco (a "assinatura" da mata), brilho dourado
  const sx = cx,
    sy = 50;
  for (let a = 0; a < Math.PI * 3.2; a += 0.12) {
    const rad = 0.6 + a * 0.55;
    const x = Math.round(sx + Math.cos(a) * rad * 0.8),
      y = Math.round(sy + Math.sin(a) * rad);
    lit(x, y, a > Math.PI * 2.2 ? PAL.yel2 : PAL.yel3);
  }
  // Fitinhas amarradas em volta do tronco, com pontas soltas ao vento
  const RIB = [PAL.red2, PAL.yel2, PAL.ice2, PAL.g6, PAL.pur2, PAL.pink];
  const ty = 76;
  const half = 5 + Math.max(0, (ty - 70) / 8);
  for (let x = Math.floor(cx - half); x <= cx + half; x++) {
    const c = RIB[(x - Math.floor(cx - half)) % RIB.length];
    lit(x, ty, c);
    lit(x, ty + 1, c);
  }
  RIB.forEach((c, i) => {
    const x0 = Math.round(cx - half + 1 + i * ((2 * half - 2) / (RIB.length - 1)));
    const dir = i < RIB.length / 2 ? -1 : 1;
    const len = 6 + ((i * 5) % 5);
    for (let k = 0; k < len; k++) lit(x0 + dir * Math.floor(k / 2.5) + (k > 3 && k % 3 === 0 ? dir : 0), ty + 2 + k, c);
  });
}

// Anel de luz no chão, aos pés da Samaúma (só a camada de brilho; a cena usa blend ADD)
function makeBlessRing() {
  const W = 96,
    H = 30;
  const p = new Pix(W, H);
  const cx = W / 2,
    cy = H / 2;
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const x = cx + Math.cos(a) * 44,
      y = cy + Math.sin(a) * 12;
    const c = k % 4 === 0 ? PAL.yel3 : k % 2 ? PAL.g6 : PAL.yel2;
    p.set(x, y, c);
    if (k % 4 === 0) {
      p.set(x - 1, y, PAL.yel2);
      p.set(x + 1, y, PAL.yel2);
      p.set(x, y - 1, PAL.yel2);
    }
  }
  // segundo anel, mais fechado e pontilhado (dá profundidade sem virar "grade")
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.2;
    p.set(cx + Math.cos(a) * 30, cy + Math.sin(a) * 8, k % 2 ? PAL.g5 : PAL.g6);
  }
  return p;
}

// Helicônia (bananeirinha-do-mato): folhas em remo e brácteas em zigue-zague
function makeHeliconia(tone) {
  const p = new Pix(16, 22);
  // folhas
  const leafAt = (x0, y0, dir) => {
    for (let k = 0; k < 7; k++) {
      const x = x0 + dir * k,
        y = y0 - Math.round(k * 0.9);
      p.set(x, y, PAL.g4);
      p.set(x, y + 1, PAL.g3);
      if (k > 1 && k < 6) p.set(x, y - 1, PAL.g5);
    }
  };
  for (let y = 8; y < 22; y++) p.set(7, y, PAL.g3);
  for (let y = 12; y < 22; y++) p.set(10, y, PAL.g3);
  leafAt(7, 18, -1);
  leafAt(10, 16, 1);
  leafAt(7, 12, 1);
  // brácteas (zigue-zague) com pontas amarelas
  const [c1, c2] = tone ? [PAL.red2, PAL.yel2] : [PAL.org2, PAL.yel3];
  for (let k = 0; k < 5; k++) {
    const x = 7 + (k % 2 ? 2 : -2),
      y = 2 + k * 2;
    p.set(x, y, c1);
    p.set(x + (k % 2 ? 1 : -1), y, c1);
    p.set(x + (k % 2 ? 2 : -2), y - 1, c2);
    p.set(7, y + 1, PAL.g4);
  }
  return p.outline(K);
}

// Pedras com samambaia
function makeRocks() {
  const p = new Pix(34, 18);
  const stone = (x, y, rx, ry) => {
    p.ellipse(x, y, rx, ry, PAL.s1);
    p.ellipse(x - 0.8, y - 0.8, rx * 0.8, ry * 0.7, PAL.s2);
    p.ellipse(x - rx * 0.35, y - ry * 0.4, rx * 0.35, ry * 0.3, PAL.s3);
  };
  stone(12, 11, 8, 6);
  stone(23, 13, 6, 4.5);
  stone(5, 14, 4, 3);
  for (let x = 6; x < 18; x++) if (bayer(x, 5) < 0.6) p.set(x, 5 + ((x * 3) % 2), PAL.g4); // musgo
  // samambaia
  for (const [ang, len] of [[-2.4, 9], [-1.9, 10], [-1.2, 9], [-0.7, 8]]) {
    for (let k = 1; k <= len; k++) {
      const x = Math.round(28 + Math.cos(ang) * k),
        y = Math.round(12 + Math.sin(ang) * k * 0.8 + (k * k) / 24);
      p.set(x, y, PAL.g5);
      if (k % 2 === 0) {
        p.set(x - 1, y + 1, PAL.g4);
        p.set(x + 1, y + 1, PAL.g4);
      }
    }
  }
  return p.outline(K);
}

// Vinheta: escurece as bordas da tela (textura grande, esticada)
function makeVignette(scene) {
  if (scene.textures.exists("fx_vignette")) return;
  const c = scene.textures.createCanvas("fx_vignette", 256, 256);
  const ctx = c.getContext();
  const g = ctx.createRadialGradient(128, 128, 70, 128, 128, 182);
  g.addColorStop(0, "rgba(6,10,16,0)");
  g.addColorStop(1, "rgba(6,10,16,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  c.refresh();
}

export function registerCampDecor(scene) {
  makeFire().register(scene, "camp_fire");
  makeLogSeat().register(scene, "camp_logseat");
  makePole().register(scene, "camp_pole");
  makeHammock().register(scene, "camp_hammock");
  makeScarecrow().register(scene, "camp_scarecrow");
  makeCan().register(scene, "camp_can");
  makeBulb().register(scene, "camp_bulb");
  FLAG_COLORS.forEach((c, i) => makeFlag(c).register(scene, `camp_flag${i}`));
  makeKapok().register(scene, "camp_kapok");
  const glow = new Pix(84, 104);
  makeKapok(glow).register(scene, "camp_kapok_blessed");
  glow.register(scene, "camp_kapok_glow");
  makeBlessRing().register(scene, "camp_blessring");
  makeHeliconia(true).register(scene, "camp_heliconia0");
  makeHeliconia(false).register(scene, "camp_heliconia1");
  makeRocks().register(scene, "camp_rocks");
  makeVignette(scene);
}

export const FLAG_COUNT = FLAG_COLORS.length;
