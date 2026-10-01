// Folha de contato das poses de queda/acordar dos guardiões (para revisar a animação).
// Uso: node tools/hero-sheet.mjs <saída.png> [id] [escala]
import fs from "node:fs";
import zlib from "node:zlib";
import { RIG_POSES, RIG_W, RIG_H, GROUND, renderPose } from "../src/art/HeroRig.js";

const [out = "hero-sheet.png", id = "guardian", scaleArg = "6"] = process.argv.slice(2);
const S = Number(scaleArg);
const keys = Object.keys(RIG_POSES);
const COLS = 4;
const rows = Math.ceil(keys.length / COLS);
const W = COLS * RIG_W * S,
  H = rows * RIG_H * S;
const img = new Uint8Array(W * H * 4);

function px(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = 255;
}
// fundo noturno com chão
for (let cy = 0; cy < rows; cy++)
  for (let cx = 0; cx < COLS; cx++)
    for (let y = 0; y < RIG_H * S; y++)
      for (let x = 0; x < RIG_W * S; x++) {
        const gy = (GROUND + 0.5) * S;
        const ground = y > gy;
        const edge = x % (RIG_W * S) === 0 || y % (RIG_H * S) === 0;
        px(cx * RIG_W * S + x, cy * RIG_H * S + y, edge ? 70 : ground ? 30 : 22, edge ? 90 : ground ? 52 : 36, edge ? 100 : ground ? 44 : 58);
      }
keys.forEach((k, i) => {
  const f = renderPose(id, k, i);
  const ox = (i % COLS) * RIG_W * S,
    oy = Math.floor(i / COLS) * RIG_H * S;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      const v = f.c[y * f.w + x];
      if (!(v >>> 24)) continue;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) px(ox + x * S + dx, oy + y * S + dy, (v >> 16) & 255, (v >> 8) & 255, v & 255);
    }
});

// PNG
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`${out}: ${keys.length} poses (${keys.join(", ")})`);
