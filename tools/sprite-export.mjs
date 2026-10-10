// Exporta quadros avulsos (RGBA, 1 px de arte = 1 px) das tiras geradas por código do jogo.
// Usado por tools/make-icons.py (ícone e splash saem sempre do herói atual).
// Uso: node tools/sprite-export.mjs <saida_dir> chave:quadro[,chave:quadro...]   → <saida_dir>/<chave>_<quadro>.png
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { registerMonsters } = await imp("src/art/Monsters.js");
const { registerHeroes } = await imp("src/art/Hero.js");
const { registerCaatingaMonsters } = await imp("src/art/MonstersCaatinga.js");
const { registerCamp } = await imp("src/art/Camp.js");
const { registerSprites } = await imp("src/art/Sprites.js");
const { registerIcons } = await imp("src/art/Icons.js");
const { registerKitchen } = await imp("src/art/Kitchen.js");
const { registerPond } = await imp("src/art/Pond.js");
const { registerGarden } = await imp("src/art/Garden.js");

const strips = {};
const scene = {
  textures: {
    exists: () => false, remove: () => {},
    createCanvas(key, w, h) {
      const buf = new Uint8ClampedArray(w * h * 4), frames = [];
      strips[key] = { w, h, buf, frames };
      const ctx = {
        createImageData: (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) }),
        createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {},
        putImageData(img, ox, oy) {
          for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
            const si = (y * img.width + x) * 4, di = ((oy + y) * w + ox + x) * 4;
            for (let k = 0; k < 4; k++) buf[di + k] = img.data[si + k];
          }
        },
      };
      return { getContext: () => ctx, add: (n, s, x, y, fw, fh) => frames.push({ x, y, w: fw, h: fh }), refresh: () => {} };
    },
  },
  anims: { exists: () => true, create: () => {}, generateFrameNumbers: () => [] },
};
registerMonsters(scene); registerHeroes(scene); registerCaatingaMonsters(scene); registerCamp(scene); registerSprites(scene); registerIcons(scene);
for (const reg of [registerKitchen, registerPond, registerGarden]) try { reg(scene); } catch (e) { console.log("aviso:", reg.name, e.message); }
for (const st of Object.values(strips)) if (!st.frames.length) st.frames.push({ x: 0, y: 0, w: st.w, h: st.h });

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const [out, list] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const item of list.split(",")) {
  const [key, fi] = item.split(":");
  const st = strips[key];
  if (!st) { console.log("sem tira", key); continue; }
  const f = st.frames[Number(fi ?? 0)];
  if (!f) { console.log("sem quadro", item, "de", st.frames.length); continue; }
  const rgba = new Uint8Array(f.w * f.h * 4);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const si = ((f.y + y) * st.w + f.x + x) * 4, di = (y * f.w + x) * 4;
    for (let k = 0; k < 4; k++) rgba[di + k] = st.buf[si + k];
  }
  fs.writeFileSync(path.join(out, `${key}_${fi ?? 0}.png`), png(f.w, f.h, rgba));
  console.log(key, fi, `${f.w}x${f.h}`, "de", st.frames.length, "quadros");
}
