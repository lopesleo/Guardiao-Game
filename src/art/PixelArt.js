// Mini-motor de pixel-art procedural: desenha em buffer ARGB, contorna e
// registra como textura do Phaser. Toda arte gerada aqui usa a PAL, então
// cenário, pickups, ícones e FX conversam com os sprites dos packs.
import { PAL } from "./Palette.js";

// PRNG determinístico (mulberry32) — mesma arte em toda execução
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bayer 4x4 — dithering ordenado (a "textura" clássica de pixel-art)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.c = new Uint32Array(w * h); // 0 = transparente; senão 0xAARRGGBB
  }
  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, rgb, a = 255) {
    x |= 0;
    y |= 0;
    if (!this.inb(x, y)) return;
    this.c[y * this.w + x] = ((a & 255) << 24) | (rgb & 0xffffff);
  }
  // Pinta só onde já há pixel opaco (sombreamento sobre forma pronta)
  over(x, y, rgb) {
    if (this.get(x, y)) this.set(x, y, rgb);
  }
  get(x, y) {
    if (!this.inb(x, y)) return 0;
    return this.c[y * this.w + x];
  }
  rgb(x, y) {
    return this.get(x, y) & 0xffffff;
  }
  alpha(x, y) {
    return this.get(x, y) >>> 24;
  }
  rect(x, y, w, h, rgb, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, rgb, a);
  }
  disc(cx, cy, r, rgb, a = 255) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, rgb, a);
      }
  }
  ellipse(cx, cy, rx, ry, rgb, a = 255) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx,
          dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, rgb, a);
      }
  }
  line(x0, y0, x1, y1, rgb) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, rgb);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  // Contorno de 1px (4-vizinhos) em volta de tudo que é opaco
  outline(rgb = PAL.ink, diagonal = false) {
    const src = this.c.slice();
    const opaque = (x, y) =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && src[y * this.w + x] >>> 24 > 128;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (opaque(x, y)) continue;
        let n = opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1);
        if (!n && diagonal)
          n = opaque(x - 1, y - 1) || opaque(x + 1, y - 1) || opaque(x - 1, y + 1) || opaque(x + 1, y + 1);
        if (n) this.c[y * this.w + x] = 0xff000000 | rgb;
      }
    return this;
  }
  // Cola outro Pix (respeita transparência)
  blit(src, ox, oy, flipX = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const v = src.c[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (v >>> 24) this.c[(oy + y) * this.w + ox + x] = v;
      }
  }
  // Desenha a partir de um mapa ASCII (uma string por linha) + legenda
  static fromMap(rows, legend) {
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const p = new Pix(w, h);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        const col = legend[ch];
        if (col != null) p.set(x, y, col);
      }
    });
    return p;
  }
  toImageData(ctx, flipX = false) {
    const img = ctx.createImageData(this.w, this.h);
    const d = img.data;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.c[y * this.w + (flipX ? this.w - 1 - x : x)];
        const i = (y * this.w + x) * 4;
        d[i] = (v >> 16) & 255;
        d[i + 1] = (v >> 8) & 255;
        d[i + 2] = v & 255;
        d[i + 3] = v >>> 24;
      }
    return img;
  }
  // Registra como textura (sobrescreve se já existir)
  register(scene, key) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, this.w, this.h);
    tex.getContext().putImageData(this.toImageData(tex.getContext()), 0, 0);
    tex.refresh();
    return tex;
  }
}

// Registra uma TIRA de frames (mesmo tamanho) como spritesheet: frames 0..n-1
export function registerStrip(scene, key, frames) {
  const w = frames[0].w,
    h = frames[0].h;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * frames.length, h);
  const ctx = tex.getContext();
  frames.forEach((f, i) => ctx.putImageData(f.toImageData(ctx), i * w, 0));
  frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
  tex.refresh();
  return tex;
}

// Ruído de valor 2D periódico (tileável) — base do chão sem emenda
export function tileNoise(w, h, cell, seed) {
  const r = rng(seed);
  const gw = Math.ceil(w / cell),
    gh = Math.ceil(h / cell);
  const grid = [];
  for (let i = 0; i < gw * gh; i++) grid.push(r());
  const g = (x, y) => grid[((y + gh) % gh) * gw + ((x + gw) % gw)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell,
      fy = y / cell;
    const x0 = Math.floor(fx),
      y0 = Math.floor(fy);
    const tx = smooth(fx - x0),
      ty = smooth(fy - y0);
    const a = g(x0, y0),
      b = g(x0 + 1, y0),
      c = g(x0, y0 + 1),
      d = g(x0 + 1, y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
