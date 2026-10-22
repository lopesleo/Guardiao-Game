// Cartão da partida para compartilhar (docs/MARKETING.md §9): uma imagem 1080×1350 (4:5 — o maior retrato do
// feed do Instagram, do X e do WhatsApp; nos stories o Instagram completa o fundo) feita só com a arte do jogo, na
// hora em que o jogador pede (nunca antes). Duas camadas:
//   1. a CENA, pintada em pixel de arte (216×270; 1 px de arte = 5 px do cartão) e ampliada sem borrão: o céu do
//      desfecho (amanhecer, noite, aurora), a serra, a mata ou o sertão, a lenda libertada, a fogueira, o guardião
//      da partida (2 px de arte por pixel dele, a mesma proporção da tela de fim de partida) e as luzes;
//   2. o TEXTO e o PAINEL por cima, em resolução cheia: as molduras do jogo (Theme.drawFrame) na mesma grade de
//      5 px, a fonte do jogo (Jersey 15; Fusion Pixel em japonês e chinês, em múltiplos de 12 px) e os ícones em
//      escala inteira.
// renderShareCard é assíncrono e cede a vez entre as camadas: a tela de fim de partida segue animando e o som não
// engasga num celular fraco. Tudo é determinístico (mesma partida = mesmo cartão).
import { PAL, CSS, hex } from "./Palette.js";
import { Pix, rng, bayer } from "./PixelArt.js";
import { makeSky, makeMoon, makeCloud, makeRidge, makeTreeline, makeGround, makeFrameTrunk, makeCanopy, makeCampfire, makeVine } from "./TitleArt.js";
import { makeSun, makeRay, makeAurora, makeCactusline } from "./ResultArt.js";
import { renderPose, RIG_IDS } from "./HeroRig.js";
import { ROT, makeFreedMapinguari } from "./Monsters.js";
import { WEAPON_ICON, ELEMENT_SEAL } from "./Icons.js";
import { registerAuraFX } from "./AuraFX.js";
import { registerCosmeticFX } from "./CosmeticFX.js";
import { WEAPONS, REACTION, SHARE } from "../config.js";
import { drawFrame, FONTS } from "../ui/Theme.js";
import { tr, fmt, isCJK } from "../i18n/i18n.js";

export const CARD_W = SHARE.W,
  CARD_H = SHARE.H;
const S = 5; // 1 pixel de arte = 5 px do cartão (cena, molduras e ícones na mesma grade)
const AW = CARD_W / S,
  AH = CARD_H / S;
const HZ = 104; // horizonte (pixel de arte)
const FEET = 144; // pés do guardião (logo acima da plaquinha com o nome)
const HERO_K = 2; // o guardião em 2 px de arte por pixel dele

// Cada desfecho: céu, quem aparece e a pose do guardião (as mesmas escolhas da tela de fim de partida)
const LOOKS = {
  vitoria: { sky: "dawn", legend: true, pose: "cheer", color: CSS.goldHi, glow: PAL.yel2 },
  eterna: { sky: "aurora", legend: true, pose: "cheer", color: CSS.goldHi, glow: PAL.wnd2 },
  derrota: { sky: "night", rot: true, fire: true, pose: "idle", color: CSS.redHi, glow: PAL.red2 },
  recuo: { sky: "night", fire: true, pose: "idle", color: CSS.txt, glow: PAL.ice3 },
};

// As seis reações (par de elementos), na ordem em que o jogo as apresenta (PauseScene)
const REACTIONS = [
  ["VAPOR", "fire", "ice"],
  ["CRYSTAL", "ice", "bolt"],
  ["OVERLOAD", "fire", "bolt"],
  ["LABAREDA", "fire", "wind"],
  ["GEADA", "ice", "wind"],
  ["TEMPORAL", "bolt", "wind"],
];

const rgba = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const yieldNow = () => new Promise((r) => setTimeout(r, 0));
// "07:00" → "7:00" (no texto corrido e nos números grandes)
export const clock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
const ctx2d = (c) => {
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return x;
};
function pixCanvas(p, flip = false) {
  const c = makeCanvas(p.w, p.h);
  const x = c.getContext("2d");
  x.putImageData(p.toImageData(x, flip), 0, 0);
  return c;
}
// Desenha um Pix (ou canvas) em escala inteira; ox/oy = origem (0..1) dentro da imagem
function put(ctx, src, x, y, { k = 1, ox = 0, oy = 0, alpha = 1, flip = false, add = false } = {}) {
  const c = src instanceof Pix ? pixCanvas(src, flip) : src;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (add) ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(c, Math.round(x - c.width * k * ox), Math.round(y - c.height * k * oy), c.width * k, c.height * k);
  ctx.restore();
}
// Quadro de uma textura do Phaser (ícones, a lenda do sertão, flores do atlas)
function frameOf(scene, key, frame) {
  if (!scene?.textures?.exists(key)) return null;
  const f = scene.textures.getFrame(key, frame);
  return f && f.source?.image ? f : null;
}
function putFrame(ctx, f, x, y, { k = 1, ox = 0.5, oy = 0.5, alpha = 1, flip = false } = {}) {
  if (!f) return;
  const w = f.cutWidth * k,
    h = f.cutHeight * k;
  const dx = Math.round(x - w * ox),
    dy = Math.round(y - h * oy);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, w, h);
  } else ctx.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, dx, dy, w, h);
  ctx.restore();
}
// Luz (o fx_glow do jogo: 1 → 0,45 aos 35% → 0), somada por cima
function glow(ctx, x, y, rx, ry, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// Sombra no chão (elipse escura de bordas pontilhadas)
function shadow(ctx, x, y, rx, ry, alpha) {
  const p = new Pix(Math.ceil(rx * 2) + 2, Math.ceil(ry * 2) + 2);
  const cx = p.w / 2,
    cy = p.h / 2;
  for (let yy = 0; yy < p.h; yy++)
    for (let xx = 0; xx < p.w; xx++) {
      const d = Math.hypot((xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry);
      if (d < 0.75 || (d < 1 && bayer(xx, yy) < (1 - d) * 4)) p.set(xx, yy, PAL.ink);
    }
  put(ctx, p, x, y, { ox: 0.5, oy: 0.5, alpha });
}
// Pontinho de luz (estrela, vaga-lume, mota, esporo); big = cruz com o centro claro
function dot(ctx, x, y, color, alpha, big = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgba(color);
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  if (big) {
    ctx.globalAlpha = alpha * 0.45;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
  }
  ctx.restore();
}

// Chama da fogueira (sem as toras: ficam no desenho da fogueira de TitleArt): gota larga embaixo com línguas no
// alto, centro quase branco e borda vermelha
function makeFlame(w = 15, h = 21, seed = 5) {
  const r = rng(seed);
  const p = new Pix(w, h);
  const cx = w / 2;
  const ph = r() * 6;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (h - 1 - y) / (h - 1); // 0 embaixo … 1 no alto
      const u = (x + 0.5 - cx) / (w / 2);
      const lick = 0.12 * Math.sin(u * 7 + ph) + 0.08 * Math.sin(u * 13 - ph);
      const width = Math.pow(Math.max(0, 1 - t), 0.62) * (0.92 + lick) * (t < 0.15 ? 0.8 + t * 1.3 : 1);
      if (Math.abs(u) > width) continue;
      const I = (1 - Math.abs(u) / Math.max(0.05, width)) * 0.85 + (1 - t) * 0.45 - (bayer(x, y) - 0.5) * 0.18;
      p.set(x, y, I > 1.02 ? PAL.cream : I > 0.8 ? PAL.yel3 : I > 0.6 ? PAL.org3 : I > 0.42 ? PAL.org2 : PAL.org1);
    }
  return p;
}

// ---------------------------------------------------------------------------------------------------------------
// Textos do cartão (no idioma do jogador; nada de frase concatenada)
// ---------------------------------------------------------------------------------------------------------------
export function cardTexts(info) {
  const t = clock(info.elapsedMs);
  const boss = info.bossName;
  const head = info.mode === "eterna" ? tr("NOITE ETERNA") : info.mode === "vitoria" ? tr("VITÓRIA!") : info.mode === "recuo" ? tr("RECUO") : tr("DERROTA");
  const sub =
    info.mode === "eterna" || info.mode === "vitoria"
      ? tr("{0} libertado", boss)
      : info.mode === "recuo"
          ? tr("Recuou aos {0}", t)
          : tr("Caiu aos {0}", t);
  return { head, sub };
}

// Texto da postagem (vai junto da imagem na folha de compartilhar)
export function shareMessage(info) {
  const url = SHARE.URL;
  const t = clock(info.elapsedMs);
  if (info.mode === "eterna") return tr("Libertei o {0} e aguentei +{1} na Noite Eterna do Guardião da Floresta! {2}", info.bossName, clock(info.endlessS * 1000), url);
  if (info.mode === "vitoria") return tr("Libertei o {0} da Podridão no Guardião da Floresta! {1}", info.bossName, url);
  if (info.mode === "recuo") return tr("Enfrentei a Podridão por {0} no Guardião da Floresta. {1}", t, url);
  return tr("Resisti {0} contra a Podridão no Guardião da Floresta. Você aguenta mais? {1}", t, url);
}

// ---------------------------------------------------------------------------------------------------------------
// Texto em canvas no padrão do jogo (Theme.text): contorno tinta e sombra dura embaixo
// ---------------------------------------------------------------------------------------------------------------
// Em japonês e chinês, letras latinas e números saem da Jersey 15 (a fonte da marca, mais encorpada) e só os
// ideogramas da Fusion Pixel — o navegador troca de fonte por caractere
const FAMILY = () => (isCJK ? `"Jersey 15", ${FONTS.pixel.family}` : FONTS.pixel.family);
// a Fusion Pixel tem grade de 12 px: em múltiplos de 12 cada ponto da fonte vira um bloco inteiro
const snap = (s) => (isCJK ? Math.max(24, Math.round(s / 12) * 12) : Math.round(s));
function font(ctx, size) {
  ctx.font = `${snap(size)}px ${FAMILY()}`;
}
function measure(ctx, str, size) {
  font(ctx, size);
  return ctx.measureText(str).width;
}
// o: size, color, align, base, max (largura: o texto encolhe por inteiro), stroke (false = sem), strokeW,
// shadowY (0 = sem). Devolve a largura desenhada
function write(ctx, str, x, y, o = {}) {
  const size = snap(o.size ?? 45);
  ctx.save();
  font(ctx, size);
  const w = ctx.measureText(str).width;
  const k = o.max && w > o.max ? o.max / w : 1;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.base ?? "middle";
  ctx.lineJoin = "round";
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(k, k);
  const sw = o.stroke === false ? 0 : (o.strokeW ?? Math.max(5, Math.round(size / 7)));
  const sy = o.shadowY ?? Math.max(4, Math.round(size / 11));
  const ink = rgba(PAL.ink);
  if (sy) {
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = sw;
    if (sw) ctx.strokeText(str, 0, sy);
    ctx.fillText(str, 0, sy);
  }
  if (sw) {
    ctx.strokeStyle = o.strokeColor ?? ink;
    ctx.lineWidth = sw;
    ctx.strokeText(str, 0, 0);
  }
  ctx.fillStyle = o.color ?? CSS.txt;
  ctx.fillText(str, 0, 0);
  ctx.restore();
  return w * k;
}
// As molduras do jogo (Theme.drawFrame) desenhadas no canvas: o drawFrame só pede fillStyle + fillRect
const frameG = (ctx) => ({
  fillStyle(c, a = 1) {
    ctx.fillStyle = rgba(c, a);
    return this;
  },
  fillRect(x, y, w, h) {
    ctx.fillRect(x, y, w, h);
    return this;
  },
});
const frame = (ctx, x, y, w, h, style, o = {}) => drawFrame(frameG(ctx), x, y, w, h, style, { p: S, ...o });

// Fontes prontas antes de escrever (sem elas o canvas cairia na fonte do sistema)
async function fontsReady(sample) {
  if (!document.fonts?.load) return;
  const wait = new Promise((r) => setTimeout(r, 2500));
  try {
    await Promise.race([Promise.all([document.fonts.load(`48px ${FAMILY()}`, sample), document.fonts.load(`48px "Jersey 15"`, "Ag")]), wait]);
  } catch {}
}

// ---------------------------------------------------------------------------------------------------------------
// A cena (pixel de arte)
// ---------------------------------------------------------------------------------------------------------------
function layout(info) {
  const look = LOOKS[info.mode] ?? LOOKS.derrota;
  return {
    look,
    caat: info.biomeId === "caatinga",
    hx: look.legend ? 70 : 76, // guardião
    fx: 134, // fogueira
    lx: 156, // lenda libertada
    ly: 128,
    sx: 108, // sol
    sy: HZ - 32,
    mx: 168, // lua
    my: 64,
  };
}

async function paintScene(scene, info, L) {
  const c = makeCanvas(AW, AH);
  const a = ctx2d(c);
  const look = L.look;
  const dawn = look.sky === "dawn",
    aurora = look.sky === "aurora";
  const r = rng(info.seed ?? 97);

  // Céu e estrelas
  const skyO = dawn ? { tones: [PAL.dawn0, PAL.dawn1, PAL.dawn2, PAL.dawn3, PAL.dawn4, PAL.dawn5], milky: false, curve: 1.1 } : {};
  put(a, makeSky(AW, AH, HZ, 11, skyO), 0, 0);
  const nStars = dawn ? 30 : aurora ? 96 : 76;
  for (let i = 0; i < nStars; i++) {
    const x = r() * AW,
      y = r() * HZ * (dawn ? 0.34 : 0.78);
    const fade = dawn ? Math.max(0, 1 - y / (HZ * 0.36)) * 0.7 : 1;
    dot(a, x, y, i % 7 ? PAL.white : PAL.yel3, (0.2 + r() * 0.65) * fade, i % 9 === 0);
  }
  if (aurora)
    for (const [i, col, al] of [[0, PAL.wnd2, 1], [1, PAL.pur2, 0.8]]) {
      const au = makeAurora(AW + 40, Math.round(HZ * 0.74), 90 + i * 13, col);
      put(a, au, -20 + i * 14, 2 + i * 10, { alpha: al, add: true });
      put(a, au, -20 + i * 14, 2 + i * 10, { alpha: al * 0.5, add: true }); // duas vezes: a cortina acesa de verdade
    }

  if (dawn) {
    // sol nascendo atrás da serra, raios em leque por trás do título
    glow(a, L.sx, L.sy, 170, 96, PAL.dawn5, 0.34);
    glow(a, L.sx, L.sy, 66, 66, PAL.sun0, 0.45);
    const ray = pixCanvas(makeRay(118, 9));
    for (let i = 0; i < 9; i++) {
      const ang = -1.25 + (i / 8) * 2.5 + (r() - 0.5) * 0.12;
      a.save();
      a.globalCompositeOperation = "lighter";
      a.globalAlpha = 0.16 + r() * 0.16;
      a.translate(L.sx, L.sy);
      a.rotate(Math.PI + ang);
      const kx = 0.8 + r() * 0.5,
        ky = 0.8 + r() * 0.55;
      a.drawImage(ray, Math.round((-ray.width * kx) / 2), 0, Math.round(ray.width * kx), Math.round(ray.height * ky));
      a.restore();
    }
    put(a, makeSun(13), L.sx, L.sy, { ox: 0.5, oy: 0.5 });
  } else {
    glow(a, L.mx, L.my, 75, 75, PAL.ice3, 0.12);
    glow(a, L.mx, L.my, 34, 34, PAL.ice3, 0.16);
    put(a, makeMoon(), L.mx, L.my, { ox: 0.5, oy: 0.5 });
  }
  // nuvens (no amanhecer, a barriga acesa pelo sol)
  const cloudO = dawn ? { colors: [PAL.dawnCloud0, PAL.dawnCloud1], under: true } : {};
  put(a, makeCloud(61, 64, 12, cloudO), 18, HZ * (dawn ? 0.5 : 0.18), { alpha: dawn ? 0.9 : 0.7 });
  put(a, makeCloud(66, 84, 15, cloudO), 128, HZ - 52, { alpha: dawn ? 0.85 : 0.65 });
  put(a, makeCloud(71, 58, 12, cloudO), -14, HZ - 40, { alpha: dawn ? 0.75 : 0.5 });
  await yieldNow();

  // Serra, mata (ou sertão) ao longe, névoa e a mata de perto
  put(a, makeRidge(AW, AH, HZ - 16, 20, 7, dawn ? L.sx : L.mx, dawn ? [PAL.dawnRidge0, PAL.dawnRidge1] : undefined), 0, 0);
  const far = dawn ? [PAL.dawnFar0, PAL.dawnFar1] : look.rot ? [ROT.dark, ROT.mid] : [PAL.woodsFar0, aurora ? PAL.t3 : PAL.woodsFar1];
  const lightX = dawn ? L.sx : L.mx;
  put(
    a,
    L.caat
      ? makeCactusline(AW, AH, HZ - 5, { seed: 21, minH: 9, maxH: 21, fill: far[0], rim: far[1], lightX })
      : makeTreeline(AW, AH, HZ - 6, { seed: 21, minH: 12, maxH: 27, jitter: 4, pines: 0.55, fill: far[0], rim: far[1], moonX: lightX }),
    0,
    0,
  );
  if (look.rot) {
    // a Podridão lá longe, no horizonte: a mata adoecida respira magenta e solta esporos (a Clareira fica sã)
    for (let i = 0; i < 5; i++) glow(a, (AW * i) / 4, HZ - 8, 78, 16, ROT.hot, 0.15 + (i % 2) * 0.05);
    for (let i = 0; i < 22; i++) dot(a, r() * AW, HZ - 8 - r() * 30, i % 3 ? ROT.glow : ROT.hot, 0.35 + r() * 0.5);
  }
  for (let i = 0; i < 4; i++) glow(a, (AW * i) / 3 + r() * 20, HZ - 12, 106, 16, dawn ? PAL.dawn4 : look.rot ? ROT.mid : PAL.night4, dawn ? 0.15 : 0.1);
  const near = dawn ? [PAL.dawnNear0, PAL.dawnNear1] : [PAL.woodsNear0, PAL.woodsNear1];
  put(
    a,
    L.caat
      ? makeCactusline(AW, AH, HZ + 3, { seed: 37, minH: 13, maxH: 30, fill: near[0], rim: near[1], lightX })
      : makeTreeline(AW, AH, HZ + 3, { seed: 37, minH: 19, maxH: 38, jitter: 6, pines: 0.45, fill: near[0], rim: near[1], moonX: lightX, leafy: true }),
    0,
    0,
  );
  await yieldNow();

  // Chão (terreiro batido em volta da fogueira; o sertão é seco)
  const groundO = !L.caat
    ? {}
    : dawn
      ? { tones: [PAL.n0, PAL.clay0, PAL.clay1, PAL.straw0], blades: [PAL.straw0, PAL.straw1, PAL.straw2] }
      : { tones: [PAL.woodsNear0, PAL.n0, PAL.n1, PAL.clay0], blades: [PAL.n2, PAL.straw0, PAL.straw1] };
  // o terreiro em volta da fogueira tem o tamanho da faixa de chão à vista (o resto fica sob o painel)
  put(a, makeGround(AW, AH - HZ, -9999, 0, 5, groundO), 0, HZ);
  put(a, makeGround(AW, 74, look.fire ? L.fx : -9999, FEET - 2 - HZ, 5, groundO), 0, HZ);
  for (let i = 0; i < 5; i++) glow(a, (AW * i) / 4, HZ + 3, 100, 14, dawn ? PAL.dawn5 : PAL.night4, dawn ? 0.12 : 0.14);
  if (dawn) glow(a, L.sx, HZ + 14, 150, 40, PAL.sun0, 0.12); // a luz da manhã no gramado

  // Tufos e flores longe de quem está em cena
  const env = scene?.registry?.get(L.caat ? "envKeysCaatinga" : "envKeys");
  const atlas = L.caat ? "env_caatinga" : "env";
  const busy = [[L.hx, FEET], [L.fx, FEET], [L.lx, L.ly]];
  for (let tries = 0, placed = 0; env && placed < 18 && tries < 200; tries++) {
    const x = 6 + r() * (AW - 12),
      y = HZ + 8 + r() * (AH - HZ - 14);
    if (busy.some(([bx, by]) => Math.abs(x - bx) < 26 && Math.abs(y - by) < 14)) continue;
    const list = placed % 3 ? env.tufts : env.flowers;
    if (!list?.length) continue;
    const k = (y - HZ) / (AH - HZ);
    putFrame(a, frameOf(scene, atlas, list[placed % list.length]), x, y, { ox: 0.5, oy: 1, alpha: 0.55 + k * 0.45 });
    placed++;
  }
  await yieldNow();

  // A lenda libertada na borda da mata: aura, motas de vida subindo e flores aos pés
  if (look.legend) {
    shadow(a, L.lx, L.ly + 1, 19, 4, 0.55);
    glow(a, L.lx, L.ly - 27, 50, 62, L.caat ? PAL.ice2 : PAL.g5, 0.3);
    const lg = L.caat ? frameOf(scene, "mon_caboclo", 4) : null;
    if (lg) putFrame(a, lg, L.lx, L.ly, { ox: 0.5, oy: 1 });
    else put(a, makeFreedMapinguari(), L.lx, L.ly, { ox: 0.5, oy: 1 });
    const fl = env?.flowers ?? [];
    const kill = info.cosmetics?.kill;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.3;
      const x = L.lx + Math.cos(ang) * (21 + (i % 2) * 7),
        y = L.ly + 3 + Math.sin(ang) * 5;
      const cos = kill && cosmeticSprite(scene, kill, i);
      if (cos) putFrame(a, cos.f, x, y, { ox: 0.5, oy: 1, k: cos.k ?? 1 });
      else if (fl.length) putFrame(a, frameOf(scene, atlas, fl[i % fl.length]), x, y, { ox: 0.5, oy: 1 });
    }
    // motas de vida subindo pelos lados da lenda (por cima do corpo viravam sujeira)
    for (let i = 0; i < 14; i++) {
      const life = (i + r() * 0.6) / 14;
      const side = i % 2 ? 1 : -1;
      const x = L.lx + side * (20 + r() * 12 + life * 10),
        y = L.ly - 6 - life * 66;
      const al = Math.sin(life * Math.PI);
      glow(a, x, y, 3.5, 3.5, i % 3 ? PAL.g6 : PAL.yel3, 0.35 * al);
      dot(a, x, y, i % 3 ? PAL.g6 : PAL.yel3, al);
    }
  }

  // A fogueira (derrota e recuo): poça de luz, pedras e toras, a chama e as faíscas
  if (look.fire) {
    const fx = L.fx,
      fy = FEET - 2;
    glow(a, fx, fy + 1, 128, 34, PAL.org3, 0.22);
    shadow(a, fx, fy + 3, 15, 3, 0.6);
    glow(a, fx, fy - 5, 52, 52, PAL.org2, 0.42);
    put(a, makeCampfire(), fx, fy + 4, { ox: 0.5, oy: 1 });
    put(a, makeFlame(13, 19, 5), fx, fy, { ox: 0.5, oy: 1 });
    put(a, makeFlame(7, 11, 9), fx - 6, fy + 1, { ox: 0.5, oy: 1 });
    put(a, makeFlame(7, 12, 13), fx + 6, fy + 1, { ox: 0.5, oy: 1 });
    glow(a, fx, fy - 10, 16, 20, PAL.yel3, 0.35);
    for (let i = 0; i < 12; i++) dot(a, fx + (r() - 0.5) * 30, fy - 20 - r() * 48, i % 3 ? PAL.yel3 : PAL.org3, 0.5 + r() * 0.5);
    glow(a, fx + 14, fy - 58, 16, 24, PAL.s3, 0.06); // fumaça
  }
  await yieldNow();

  // O guardião da partida (HeroRig.js), com a luz do desfecho e o Despertar equipado (vitória)
  const id = RIG_IDS.includes(info.character) ? info.character : "guardian";
  const hx = L.hx;
  shadow(a, hx + 1, FEET + 1, 20, 4.5, 0.7);
  if (look.fire) glow(a, hx + 10, FEET - 12, 40, 34, PAL.org3, 0.2);
  if (dawn) glow(a, hx - 4, FEET - 18, 30, 36, PAL.sun0, 0.14); // contraluz
  // trilha do rastro equipado (pétalas, penas, pegadas…) vindo da esquerda até os pés
  const trail = info.cosmetics?.trail;
  if (trail)
    for (let i = 0; i < 9; i++) {
      const cos = cosmeticSprite(scene, trail, i);
      if (!cos) break;
      const u = i / 8;
      const x = 16 + u * (hx - 30) + (r() - 0.5) * 3,
        y = FEET + 3 + Math.sin(u * 3) * 2 + (i % 2 ? 2 : -1);
      putFrame(a, cos.f, x, y, { ox: 0.5, oy: 0.5, alpha: 0.5 + u * 0.5, flip: i % 2 === 1 });
    }
  if (look.legend) {
    // vitória: o Despertar (dourado, ou o do Guarda-roupa) acende atrás dele — luz e faíscas na cor da peça (a
    // chama inteira em 2× escondia o guardião); as asas da coruja aparecem desenhadas
    const aw = AWAKEN_LOOK[info.cosmetics?.awaken] ?? AWAKEN_LOOK.gold;
    const wings = aw.sprite && frameOf(scene, aw.sprite[0], aw.sprite[1]);
    if (wings) putFrame(a, wings, hx - 1, FEET - 22, { ox: 0.5, oy: 0.5, k: HERO_K });
    glow(a, hx, FEET - 30, 30, 44, aw.glow, 0.32);
    glow(a, hx, FEET - 26, 14, 30, aw.core, 0.22);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const u = r();
      const x = hx + side * (9 + r() * 12),
        y = FEET - 6 - u * 58;
      const al = 0.4 + 0.6 * Math.sin(u * Math.PI);
      glow(a, x, y, 3, 3, aw.spark[i % aw.spark.length], 0.3 * al);
      dot(a, x, y, aw.spark[i % aw.spark.length], al);
    }
  }
  put(a, renderPose(id, look.pose, 3, 12), hx, FEET, { k: HERO_K, ox: 22 / 52, oy: 41 / 44 });
  await yieldNow();

  // Moldura: troncos enraizados nas bordas, copas nos cantos de cima; vaga-lumes no gramado
  const trunk = pixCanvas(makeFrameTrunk(AH + 2, 18, 3));
  put(a, trunk, -9, AH + 1, { oy: 1 });
  put(a, makeFrameTrunk(AH + 2, 18, 3), AW + 9, AH + 1, { ox: 1, oy: 1, flip: true });
  put(a, makeCanopy(71, 90, 48, 1), -40, -18);
  put(a, makeCanopy(85, 58, 34, 1), -30, 22);
  put(a, makeCanopy(71, 90, 48, 1), AW + 40, -18, { ox: 1, flip: true });
  put(a, makeCanopy(85, 58, 34, 1), AW + 30, 22, { ox: 1, flip: true });
  const nFlies = dawn ? 5 : 16;
  for (let i = 0; i < nFlies; i++) {
    const x = 14 + r() * (AW - 28),
      y = HZ + 6 + r() * (FEET - HZ + 6);
    const al = dawn ? 0.35 : 0.55 + r() * 0.45;
    glow(a, x, y, 4, 4, PAL.yel3, 0.4 * al);
    dot(a, x, y, PAL.yel3, al);
  }
  return c;
}

// Peça de cosmético para desenhar no cartão: o quadro e a escala (as que mexem viram um quadro bonito parado)
function cosmeticSprite(scene, id, i) {
  const T = {
    sementes: ["cos_seed", 0],
    pegadas: ["cos_print", 0],
    folhas: ["cos_dryleaf", 0],
    ipe_kill: ["cos_bloom", 0],
    ipe_trail: ["cos_petal", 0],
    paina_kill: ["cos_pod", 2],
    paina_trail: ["cos_paina", 0],
    coruja_kill: ["cos_owl", 1],
    coruja_trail: ["cos_feather", 0],
    junina_kill: ["cos_flag", i % 2],
    junina_trail: ["cos_flag", 1],
  }[id];
  if (!T) return null;
  const f = frameOf(scene, T[0], T[1]);
  return f ? { f, k: /_kill$|^sementes$/.test(id) ? 1 : HERO_K } : null;
}
// O Despertar equipado (ou o dourado do jogo) atrás do guardião vitorioso: as cores de cada peça (CosmeticFX.AURAS)
const AWAKEN_LOOK = {
  gold: { glow: PAL.yel2, core: PAL.yel3, spark: [PAL.yel3, PAL.g6, PAL.yel2] },
  luar: { glow: PAL.s4, core: PAL.white, spark: [PAL.white, PAL.s4] },
  ipe_awaken: { glow: PAL.pink, core: PAL.pinkHi, spark: [PAL.pinkHi, PAL.pink, PAL.cream] },
  paina_awaken: { glow: PAL.cream, core: PAL.white, spark: [PAL.cream, PAL.white] },
  coruja_awaken: { glow: PAL.straw2, core: PAL.cream, spark: [PAL.cream, PAL.straw3], sprite: ["cos_wings", 2] },
  junina_awaken: { glow: PAL.org3, core: PAL.yel3, spark: [PAL.pink, PAL.straw3, PAL.cream, PAL.pinkHi] },
};

// ---------------------------------------------------------------------------------------------------------------
// O cartão inteiro
// ---------------------------------------------------------------------------------------------------------------
export async function renderShareCard(scene, info) {
  // o Despertar e as peças do Guarda-roupa podem não ter sido desenhados ainda nesta sessão (texturas globais)
  if (scene?.textures) {
    registerAuraFX(scene);
    registerCosmeticFX(scene);
  }
  const L = layout(info);
  const T = cardTexts(info);
  await fontsReady(`${T.head}${T.sub}${tr("GUARDIÃO")}${tr("DA FLORESTA")}0123456789`);
  const art = await paintScene(scene, info, L);
  const card = makeCanvas(CARD_W, CARD_H);
  const c = ctx2d(card);
  c.drawImage(art, 0, 0, CARD_W, CARD_H);
  await yieldNow();

  // Vinheta e a sombra embaixo (o painel e a marca assentam no escuro)
  const vg = c.createRadialGradient(CARD_W / 2, 560, 320, CARD_W / 2, 560, 1000);
  vg.addColorStop(0, rgba(PAL.night0, 0));
  vg.addColorStop(1, rgba(PAL.night0, 0.6));
  c.fillStyle = vg;
  c.fillRect(0, 0, CARD_W, CARD_H);
  const sh = c.createLinearGradient(0, 620, 0, CARD_H);
  sh.addColorStop(0, rgba(PAL.night0, 0));
  sh.addColorStop(0.3, rgba(PAL.night0, 0.5));
  sh.addColorStop(0.7, rgba(PAL.night0, 0.86));
  sh.addColorStop(1, rgba(PAL.night0, 0.94));
  c.fillStyle = sh;
  c.fillRect(0, 620, CARD_W, CARD_H - 620);

  headline(c, info, L, T);
  await yieldNow();
  panel(scene, c, info, L);
  await yieldNow();
  footer(c);
  border(c, L.look);
  return card;
}

// Borda do cartão: tinta por fora e um fio dourado (cantos chanfrados, na grade de 5 px), como as molduras do jogo
function border(c, look) {
  const W = CARD_W,
    H = CARD_H,
    p = S;
  const ring = (inset, color, alpha) => {
    c.fillStyle = rgba(color, alpha);
    const x0 = inset,
      y0 = inset,
      w = W - 2 * inset,
      h = H - 2 * inset;
    c.fillRect(x0 + p, y0, w - 2 * p, p);
    c.fillRect(x0 + p, y0 + h - p, w - 2 * p, p);
    c.fillRect(x0, y0 + p, p, h - 2 * p);
    c.fillRect(x0 + w - p, y0 + p, p, h - 2 * p);
  };
  // (nada transparente: o Instagram e o WhatsApp pintam a transparência de preto ou de branco)
  c.fillStyle = rgba(PAL.ink);
  for (const [x, y] of [[0, 0], [W - p, 0], [0, H - p], [W - p, H - p]]) c.fillRect(x, y, p, p);
  ring(0, PAL.ink, 1);
  ring(p, look.legend ? PAL.uiGold : PAL.uiGoldLo, 1);
  ring(2 * p, PAL.ink, 0.6);
}

// ---------------------------------------------------------------------------------------------------------------
// Verso do cartão (a janela mostra o verso enquanto a frente é desenhada e vira o cartão quando ela fica pronta):
// moldura dourada, treliça de losangos na cor da mata, o medalhão da folha com o cipó e o título do jogo.
// w × h = o tamanho da prévia na tela (grade de 3 px da interface)
// ---------------------------------------------------------------------------------------------------------------
export function renderCardBack(w, h) {
  const p = 3;
  const cv = makeCanvas(w, h);
  const c = ctx2d(cv);
  drawFrame(frameG(c), 0, 0, w, h, "gold", { p });
  // treliça: losangos de 24 px, pontos dourados nos cruzamentos
  const x0 = 6 * p,
    y0 = 6 * p,
    x1 = w - 6 * p,
    y1 = h - 6 * p;
  c.save();
  c.beginPath();
  c.rect(x0, y0, x1 - x0, y1 - y0);
  c.clip();
  const cell = 8 * p;
  for (let y = y0 - cell, row = 0; y < y1 + cell; y += cell, row++)
    for (let x = x0 - cell; x < x1 + cell; x += cell) {
      const cx = x + ((row & 1) * cell) / 2;
      c.fillStyle = rgba(PAL.uiPanel2);
      for (let k = 0; k < 4; k++) {
        c.fillRect(cx + k * p, y + (4 - k) * p, p, p);
        c.fillRect(cx - k * p, y + (4 - k) * p, p, p);
        c.fillRect(cx + k * p, y + (4 + k) * p, p, p);
        c.fillRect(cx - k * p, y + (4 + k) * p, p, p);
      }
      c.fillStyle = rgba(PAL.uiGoldLo);
      c.fillRect(cx, y, p, p);
    }
  c.restore();
  // fio dourado de dentro
  const ring = (ins, col) => {
    c.fillStyle = rgba(col);
    c.fillRect(ins + p, ins, w - 2 * ins - 2 * p, p);
    c.fillRect(ins + p, h - ins - p, w - 2 * ins - 2 * p, p);
    c.fillRect(ins, ins + p, p, h - 2 * ins - 2 * p);
    c.fillRect(w - ins - p, ins + p, p, h - 2 * ins - 2 * p);
  };
  ring(9 * p, PAL.uiGoldLo);
  // medalhão: aro dourado e a folha da mata no meio
  const R = 15;
  const md = new Pix(2 * R + 3, 2 * R + 3);
  for (let y = 0; y < md.h; y++)
    for (let x = 0; x < md.w; x++) {
      const dx = x + 0.5 - md.w / 2,
        dy = y + 0.5 - md.h / 2;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      md.set(x, y, d > R - 2 ? (dx + dy < -4 ? PAL.yel3 : PAL.yel1) : d > R - 3 ? PAL.yel2 : PAL.uiBg);
    }
  for (let t = 0; t <= 18; t++) {
    const yy = Math.round(md.h / 2 + 9 - t);
    const half = Math.round(Math.sin((t / 18) * Math.PI) * 6.5);
    const mx = Math.round(md.w / 2 + Math.sin(t * 0.25) * 0.8);
    for (let k = -half; k <= half; k++) md.set(mx + k, yy, k < 0 ? PAL.g4 : PAL.g5);
    md.set(mx, yy, PAL.g6);
  }
  md.outline(PAL.ink);
  const mk = Math.max(2, Math.floor(Math.min(w, h) / 4 / md.w));
  const my = Math.round(h * 0.4);
  glow(c, w / 2, my, w * 0.42, w * 0.42, PAL.yel2, 0.12);
  put(c, md, w / 2, my, { k: mk, ox: 0.5, oy: 0.5 });
  const vk = Math.max(2, Math.floor(w / 71 / 1.6));
  put(c, makeVine(71), w / 2, my + (md.h * mk) / 2 + 9 * vk, { k: vk, ox: 0.5, oy: 0.5 });
  const ty = my + (md.h * mk) / 2 + 26 * vk;
  const t1 = write(c, tr("GUARDIÃO"), w / 2, ty, { size: isCJK ? 36 : Math.round(w / 9.5), color: CSS.goldHi, align: "center", strokeW: 6, shadowY: 4, max: w - 60 });
  write(c, tr("DA FLORESTA"), w / 2, ty + Math.round(w / 11), { size: isCJK ? 24 : Math.round(w / 20), color: hex(PAL.g6), align: "center", strokeW: 4, shadowY: 3, max: Math.max(t1, w * 0.5) });
  return cv;
}

// Faixa de brilho que passa pelo cartão quando ele vira (desenhada inclinada; a janela recorta nas bordas)
export function renderShine(h, band = 70) {
  const skew = Math.round(h * 0.32);
  const cv = makeCanvas(band + skew, h);
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, band, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,248,220,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.setTransform(1, 0, -skew / h, 1, skew, 0);
  c.fillStyle = g;
  c.fillRect(0, 0, band, h);
  return cv;
}

// Prévia do cartão no tamanho da janela (reduzida com suavização, sem serrilhado)
export function scaleCanvas(src, w, h) {
  let cur = src;
  // reduz pela metade até perto do tamanho final (bem mais nítido que de uma vez)
  while (cur.width / 2 >= w * 1.05) {
    const half = makeCanvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
    const hc = half.getContext("2d");
    hc.imageSmoothingQuality = "high";
    hc.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = makeCanvas(w, h);
  const oc = out.getContext("2d");
  oc.imageSmoothingQuality = "high";
  oc.drawImage(cur, 0, 0, w, h);
  return out;
}

// Manchete: o desfecho em letras grandes, o cipó dourado e a frase (a lenda libertada ou a hora da queda)
function headline(c, info, L, T) {
  const look = L.look;
  const cx = CARD_W / 2;
  const hy = 118;
  glow(c, cx, hy + 10, 440, 120, look.glow, 0.22);
  write(c, T.head, cx, hy, { size: isCJK ? 144 : 165, color: look.color, align: "center", max: 880, strokeW: isCJK ? 16 : 22, shadowY: 12 });
  put(c, makeVine(71), cx, hy + 94, { k: S, ox: 0.5, oy: 0.5 });
  write(c, T.sub, cx, hy + 150, { size: isCJK ? 48 : 57, color: CSS.txt, align: "center", max: 900, strokeW: 10, shadowY: 6 });
}

// Painel do resultado (de cima para baixo): a plaquinha do guardião, Perigo e pontos, tempo/abates/nível, as
// reações que mais saíram e o arsenal
const PANEL = { X: 40, Y: 770, W: CARD_W - 80, H: 440, P: 35 };
function panel(scene, c, info, L) {
  const won = info.mode === "vitoria" || info.mode === "eterna";
  const { X, Y, W, H, P } = PANEL;
  const inner = W - 2 * P;
  frame(c, X, Y, W, H, won ? "gold" : "dark", { alpha: 0.95 });

  // Plaquinha com o nome do guardião (e a insígnia de Fundador) na borda de cima, embaixo dos pés dele
  {
    const name = String(info.charName || "").toUpperCase();
    const fz = info.founder ? frameOf(scene, "ico_fundador", 0) : null;
    const icW = fz ? fz.cutWidth * 5 + 15 : 0;
    const pw = Math.min(560, Math.ceil((measure(c, name, 45) + icW + 70) / S) * S);
    const ph = 70;
    const px = Math.max(X + 20, Math.min(X + W - 20 - pw, Math.round((L.hx * S - pw / 2) / S) * S));
    const py = Y - 40;
    frame(c, px, py, pw, ph, won ? "gold" : "button");
    if (fz) putFrame(c, fz, px + 35 + (fz.cutWidth * 5) / 2, py + ph / 2, { k: 5 });
    write(c, name, px + 35 + icW, py + ph / 2 - 2, { size: 45, color: CSS.goldHi, max: pw - 70 - icW, strokeW: 6, shadowY: 4 });
  }

  // 1 · Perigo e bioma (esquerda) · pontos (direita; dourado e com RECORDE quando for)
  let y = Y + 64;
  let used = 0;
  if (info.score > 0) {
    const score = info.scoreRecord ? tr("RECORDE! {0} pontos", fmt(info.score)) : tr("{0} pontos", fmt(info.score));
    const w = write(c, score, X + P + inner, y, { size: 48, color: info.scoreRecord ? CSS.goldHi : CSS.txt, align: "right", max: inner * 0.5, strokeW: 7 });
    putFrame(c, frameOf(scene, "ico_trophy", 0), X + P + inner - w - 38, y, { k: 4 });
    used = w + 80;
  }
  const biome = info.biomeId === "caatinga" ? tr("Caatinga") : tr("Amazônia");
  write(c, tr("PERIGO: {0}  ·  {1}", String(info.diffName).toUpperCase(), biome.toUpperCase()), X + P, y, { size: 42, color: CSS.muted, max: inner - used, strokeW: 6 });
  y += 30;

  // 2 · Tempo (na Noite Eterna, o tempo na escuridão), abates e nível em placas
  const endless = info.mode === "eterna";
  const tiles = [
    endless
      ? { icon: "ico_hourglass", v: `+${clock(info.endlessS * 1000)}`, l: info.endlessRecord ? tr("NOVO RECORDE!") : tr("Na escuridão"), gold: info.endlessRecord }
      : { icon: "ico_hourglass", v: clock(info.elapsedMs), l: tr("Tempo") },
    { icon: "ico_skull", v: fmt(info.kills), l: tr("Abates") },
    { icon: "ico_star", v: String(info.level), l: tr("Nível") },
  ];
  const gap = 20,
    tw = Math.floor((inner - gap * 2) / 3 / S) * S,
    th = 120;
  const tx0 = X + P + Math.floor((inner - (tw * 3 + gap * 2)) / 2);
  tiles.forEach((t, i) => {
    const x0 = tx0 + i * (tw + gap);
    frame(c, x0, y, tw, th, t.gold ? "gold" : "dark", { noRivets: true });
    putFrame(c, frameOf(scene, t.icon, 0), x0 + 50, y + th / 2, { k: 5 });
    write(c, t.v, x0 + 95, y + 46, { size: 84, color: t.gold ? CSS.goldHi : CSS.txt, max: tw - 110, strokeW: 10, shadowY: 6 });
    write(c, t.l, x0 + 97, y + 94, { size: 39, color: t.gold ? CSS.goldHi : CSS.muted, max: tw - 112, strokeW: 5, shadowY: 3 });
  });
  y += th + 16;

  // 3 · Reações: as que mais saíram numa faixa só (par de selos, nome na cor da reação e quantas); se não
  // couber, tudo encolhe junto (nunca um nome menor que o outro)
  const rh = 65;
  frame(c, X + P, y, inner, rh, "dark", { noRivets: true, flat: true });
  const by = info.byType || {};
  const rx = REACTIONS.map(([k, a, b]) => ({ k, a, b, n: by[k] || 0 })).filter((r) => r.n > 0).sort((p, q) => q.n - p.n);
  if (rx.length) reactionStrip(scene, c, rx, X + P, y, inner, rh);
  else {
    // sem reação nesta partida: a primeira lição do jogo, para quem vê o cartão
    const hint = tr("Vapor (Fogo + Gelo)");
    const hw = Math.min(inner - 160, measure(c, hint, 42));
    const hx0 = X + P + Math.round((inner - hw - 86) / 2);
    putFrame(c, frameOf(scene, ELEMENT_SEAL.fire, 0), hx0 + 22, y + rh / 2, { k: 4 });
    putFrame(c, frameOf(scene, ELEMENT_SEAL.ice, 0), hx0 + 52, y + rh / 2, { k: 4 });
    write(c, hint, hx0 + 86, y + rh / 2 - 2, { size: 42, color: CSS.muted, max: inner - 160, strokeW: 6 });
  }
  y += rh + 16;

  // 4 · Arsenal: a arma que mais causou dano em destaque (moldura dourada, nome e a parte do dano) e as outras
  const share = info.dmgShare || {};
  const weapons = [...(info.weapons || [])].sort((p, q) => (share[q.key] ?? 0) - (share[p.key] ?? 0));
  const bh = Math.floor((Y + H - 30 - y) / S) * S;
  if (!weapons.length) return;
  const best = weapons[0];
  const def = WEAPONS[best.key] || {};
  frame(c, X + P, y, bh, bh, def.evolvesFrom ? "purple" : "gold", { noRivets: true });
  putFrame(c, frameOf(scene, WEAPON_ICON[best.key] ?? "ico_staff", 0), X + P + bh / 2, y + bh / 2, { k: 6 });
  levelBadge(c, best.level, X + P + bh - 8, y + 8, def.evolvesFrom);
  const rest = weapons.slice(1);
  const sq = Math.min(85, bh);
  const restW = rest.length ? rest.length * sq + (rest.length - 1) * 12 : 0;
  const nx = X + P + bh + 26;
  const room = inner - bh - 26 - (restW ? restW + 24 : 0);
  write(c, def.name ?? best.key, nx, y + bh * 0.31, { size: 51, color: CSS.goldHi, max: room, strokeW: 7 });
  const pct = share[best.key];
  const sub = pct != null && weapons.length > 1 ? tr("{0}% do dano", Math.round(pct)) : tr("Única arma da partida");
  write(c, sub, nx, y + bh * 0.75, { size: 39, color: CSS.muted, max: room, strokeW: 5 });
  rest.forEach((w, i) => {
    const d2 = WEAPONS[w.key] || {};
    const x0 = X + P + inner - restW + i * (sq + 12);
    const y0 = y + Math.round((bh - sq) / 2);
    frame(c, x0, y0, sq, sq, d2.evolvesFrom ? "purple" : "dark", { noRivets: true });
    putFrame(c, frameOf(scene, WEAPON_ICON[w.key] ?? "ico_staff", 0), x0 + sq / 2, y0 + sq / 2, { k: 4 });
  });
}

// Selo do nível no canto da moldura da arma (o número sozinho: cabe em qualquer idioma)
function levelBadge(c, level, right, top, evolved) {
  const s = 40;
  frame(c, right - s, top, s, s, evolved ? "purple" : "dark", { noRivets: true, flat: true });
  write(c, String(level), right - s / 2, top + s / 2 - 1, { size: 33, color: evolved ? hex(PAL.pur3) : CSS.txt, align: "center", strokeW: 0, shadowY: 0 });
}

function reactionStrip(scene, c, rx, x0, y0, w, h) {
  const items = rx.slice(0, 3).map((r) => ({ ...r, name: String(REACTION[r.k].label).replace(/^[¡]+|[!！]+$/g, ""), cnt: `×${fmt(r.n)}` }));
  const more = rx.length - items.length;
  const SEAL = 44,
    PAIR = SEAL + 30; // dois selos sobrepostos
  const widthAt = (k) =>
    items.reduce((s, it) => s + PAIR + 12 * k + measure(c, it.name, 42 * k) + 10 * k + measure(c, it.cnt, 45 * k), 0) +
    (items.length - 1) * 40 * k +
    (more ? 40 * k + measure(c, `+${more}`, 42 * k) : 0);
  let k = 1;
  const room = w - 50;
  for (let i = 0; i < 12 && widthAt(k) > room; i++) k *= 0.95;
  let x = x0 + Math.round((w - widthAt(k)) / 2);
  const cy = y0 + h / 2;
  items.forEach((it, i) => {
    if (i) {
      // separador: losango dourado pequeno (a grade de 5 px)
      const sx = Math.round((x + 20 * k) / S) * S;
      c.fillStyle = rgba(PAL.uiGoldLo);
      c.fillRect(sx - S, cy - S, 2 * S, 2 * S);
      c.fillStyle = rgba(PAL.uiGold);
      c.fillRect(sx - S, cy - S, S, S);
      x += 40 * k;
    }
    putFrame(c, frameOf(scene, ELEMENT_SEAL[it.a], 0), x + SEAL / 2, cy, { k: 4 });
    putFrame(c, frameOf(scene, ELEMENT_SEAL[it.b], 0), x + SEAL / 2 + 30, cy, { k: 4 });
    x += PAIR + 12 * k;
    x += write(c, it.name, x, cy - 2, { size: 42 * k, color: hex(REACTION[it.k].color), strokeW: 6 });
    x += 10 * k;
    x += write(c, it.cnt, x, cy - 2, { size: 45 * k, color: CSS.goldHi, strokeW: 6 });
  });
  if (more) write(c, `+${more}`, x + 40 * k, cy - 2, { size: 42 * k, color: CSS.muted, strokeW: 6 });
}

// Marca: o título do jogo como na tela de título, o endereço e a frase do jogo
function footer(c) {
  const y0 = 1226;
  c.save();
  c.fillStyle = rgba(PAL.uiGoldLo, 0.85);
  c.fillRect(70, y0, CARD_W - 140, 5);
  c.restore();
  const lx = 72;
  const w1 = write(c, tr("GUARDIÃO"), lx, y0 + 48, { size: isCJK ? 60 : 78, color: CSS.goldHi, strokeW: 11, shadowY: 6, max: 500 });
  write(c, tr("DA FLORESTA"), lx + 2, y0 + 96, { size: isCJK ? 24 : 39, color: hex(PAL.g6), strokeW: 6, shadowY: 4, max: Math.max(w1, 320) });
  write(c, SHARE.SITE, CARD_W - 72, y0 + 48, { size: 45, color: CSS.txt, align: "right", strokeW: 6, max: 460 });
  write(c, tr("Sobreviva à horda. Desperte a mata."), CARD_W - 72, y0 + 94, { size: isCJK ? 24 : 33, color: CSS.muted, align: "right", strokeW: 5, max: 460 });
}
