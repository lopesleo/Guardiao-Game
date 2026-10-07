// Folha de contato das tiras de criaturas e heróis (quadros de golpe dos chefes inclusos),
// sem navegador: registerMonsters() roda contra uma "cena" falsa que só guarda os pixels.
// Uso: node tools/monster-sheet.mjs <saída.png> [chave1,chave2,...] [escala]
//   ex.: node tools/monster-sheet.mjs chefes.png mon_alpha,mon_elder,mon_boss 5
import fs from "node:fs";
import zlib from "node:zlib";
import { registerMonsters } from "../src/art/Monsters.js";
import { registerHeroes } from "../src/art/Hero.js";
import { registerCaatingaMonsters } from "../src/art/MonstersCaatinga.js";
import { registerCaatinga } from "../src/art/EnvCaatinga.js";
import { registerGarden } from "../src/art/Garden.js";
import { registerPond } from "../src/art/Pond.js";
import { registerKitchen } from "../src/art/Kitchen.js";
import { registerLanterns } from "../src/art/Lanterns.js";
import { registerFireFX } from "../src/art/FireFX.js";
import { registerIcons } from "../src/art/Icons.js";

const [out = "monster-sheet.png", keysArg = "mon_alpha,mon_elder,mon_boss", scaleArg = "5"] = process.argv.slice(2);
const S = Number(scaleArg);
const wanted = keysArg.split(",");

// Cena falsa: cada createCanvas vira um buffer RGBA; tex.add guarda o recorte do quadro
const strips = {};
const scene = {
  textures: {
    exists: () => false,
    remove: () => {},
    createCanvas(key, w, h) {
      const buf = new Uint8ClampedArray(w * h * 4);
      const frames = [];
      strips[key] = { w, h, buf, frames };
      const ctx = {
        createImageData: (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) }),
        putImageData(img, ox, oy) {
          for (let y = 0; y < img.height; y++)
            for (let x = 0; x < img.width; x++) {
              const si = (y * img.width + x) * 4,
                di = ((oy + y) * w + ox + x) * 4;
              for (let k = 0; k < 4; k++) buf[di + k] = img.data[si + k];
            }
        },
      };
      return { getContext: () => ctx, add: (name, src, x, y, fw, fh) => frames.push({ x, y, w: fw, h: fh }), refresh: () => {} };
    },
  },
  anims: { exists: () => true, create: () => {}, generateFrameNumbers: () => [] },
};
registerMonsters(scene);
registerHeroes(scene); // hero_<id>: 0-3 respiração, 4 piscada, 5-12 andando, 13 dash, 14 golpe
registerCaatingaMonsters(scene); // mon_calango, mon_carcara, mon_frade, mon_caboclo, obj_carranca
registerGarden(scene); // crop_<id> (5 estágios) + ico_<id>
registerPond(scene); // ico_<peixe>
registerKitchen(scene); // ico_dish_<id>
registerLanterns(scene); // px_lantern, px_candeeiro
registerFireFX(scene); // fx_whirl, fx_ignite, fx_wisp (reação Labareda)
registerIcons(scene); // ico_* (inclui os selos de elemento ico_el_*)
registerCaatinga(scene); // cenário: atlas "env_caatinga" (quadros de tamanhos diferentes)

// Imagem solta (Pix.register, sem quadros): a imagem inteira é um quadro
for (const st of Object.values(strips)) if (!st.frames.length) st.frames.push({ x: 0, y: 0, w: st.w, h: st.h });
// Uma linha por tira; quadros lado a lado sobre fundo noturno com chão
const rows = wanted.map((k) => strips[k]).filter(Boolean);
const PAD = 4;
const cellW = Math.max(...rows.flatMap((r) => r.frames.map((f) => f.w))) + PAD * 2;
const cellH = (r) => Math.max(...r.frames.map((f) => f.h)) + PAD * 2;
const W = Math.max(...rows.map((r) => r.frames.length)) * cellW * S;
const H = rows.reduce((a, r) => a + cellH(r) * S, 0);
const img = new Uint8Array(W * H * 4);
const put = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = 255;
};
let oy = 0;
for (const r of rows) {
  const ch = cellH(r);
  for (let y = 0; y < ch * S; y++)
    for (let x = 0; x < W; x++) {
      const ground = y > (ch - PAD) * S;
      const edge = x % (cellW * S) === 0 || y === 0;
      put(x, oy + y, edge ? 70 : ground ? 30 : 22, edge ? 90 : ground ? 52 : 36, edge ? 100 : ground ? 44 : 58);
    }
  r.frames.forEach((f, i) => {
    const ox = i * cellW * S + PAD * S;
    const top = cellH(r) - PAD * 2 - f.h; // pés no chão
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const si = ((f.y + y) * r.w + f.x + x) * 4;
        if (!r.buf[si + 3]) continue;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(ox + x * S + dx, oy + (PAD + top + y) * S + dy, r.buf[si], r.buf[si + 1], r.buf[si + 2]);
      }
  });
  oy += ch * S;
}

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
console.log(`${out}: ${rows.map((r, i) => `${wanted[i]}×${r.frames.length}`).join(", ")}`);
