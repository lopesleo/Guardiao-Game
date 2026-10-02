// Avisos de ataque ("telegraphs") em pixel-art: todo golpe perigoso avisa
// ANTES com a mesma linguagem visual — anel tracejado + anel interno que
// cresce até fechar = "saia daqui agora". Substitui círculos/retângulos lisos.
import { PAL } from "./Palette.js";
import { Pix } from "./PixelArt.js";
import { ROT } from "./Monsters.js";

const CELL = 3; // 1 pixel de arte

// Anel de "pixels" (quadrados de 3px) — tracejado opcional
function pixelRing(g, cx, cy, r, color, alpha, dash = 0, rot = 0) {
  const n = Math.max(16, Math.round((2 * Math.PI * r) / (CELL * 2)));
  g.fillStyle(color, alpha);
  for (let i = 0; i < n; i++) {
    if (dash && i % dash === dash - 1) continue;
    const a = rot + (i / n) * Math.PI * 2;
    const x = Math.round((cx + Math.cos(a) * r) / CELL) * CELL;
    const y = Math.round((cy + Math.sin(a) * r) / CELL) * CELL;
    g.fillRect(x - 1, y - 1, CELL, CELL);
  }
}

// Zona circular que "carrega": anel externo tracejado piscando + anel interno
// crescendo de 0 a r em durMs. onDone dispara quando fecha.
export function dangerZone(scene, x, y, r, durMs, color = PAL.red2, onDone) {
  const g = scene.add.graphics().setDepth(55);
  const o = { t: 0 };
  scene.tweens.add({
    targets: o,
    t: 1,
    duration: durMs,
    onUpdate: () => {
      g.clear();
      const blink = Math.floor(scene.time.now / 90) % 2 ? 1 : 0.6;
      // Preenchimento tênue (lê como "área", sem cobrir o chão)
      g.fillStyle(color, 0.1 + o.t * 0.12).fillCircle(x, y, r);
      pixelRing(g, x, y, r, color, blink, 3, scene.time.now / 900);
      pixelRing(g, x, y, Math.max(4, r * o.t), 0xffffff, 0.85);
      pixelRing(g, x, y, Math.max(2, r * o.t - 4), color, 0.9);
    },
    onComplete: () => {
      g.destroy();
      onDone?.();
    },
  });
  return g;
}

// Onda de choque: anel de pixels expandindo + poeira
export function shockwave(scene, x, y, r, color = PAL.org2) {
  scene.lighting?.flash(x, y, r * 1.4, color, 350, 1);
  const g = scene.add.graphics().setDepth(56);
  const o = { t: 0 };
  scene.tweens.add({
    targets: o,
    t: 1,
    duration: 320,
    ease: "Cubic.easeOut",
    onUpdate: () => {
      g.clear();
      pixelRing(g, x, y, r * o.t, 0xffffff, 1 - o.t);
      pixelRing(g, x, y, r * o.t - 6, color, 1 - o.t);
    },
    onComplete: () => g.destroy(),
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const d = scene.add.image(x, y, "px_puff").setScale(2).setTint(i % 2 ? 0x9a8468 : 0xc8b898).setDepth(y + 10002);
    scene.tweens.add({
      targets: d,
      x: x + Math.cos(a) * r * 0.8,
      y: y + Math.sin(a) * r * 0.6 - 10,
      scale: 4,
      alpha: 0,
      duration: 450,
      ease: "Quad.easeOut",
      onComplete: () => d.destroy(),
    });
  }
}

// Linha de investida: setas pixeladas piscando na direção do ataque
export function chargeLine(scene, x, y, ang, len, durMs) {
  const arrows = [];
  const n = Math.floor(len / 42);
  for (let i = 1; i <= n; i++) {
    const a = scene.add
      .image(x + Math.cos(ang) * i * 42, y + Math.sin(ang) * i * 42, "px_chevron")
      .setScale(4)
      .setRotation(ang)
      .setTint(PAL.red3)
      .setDepth(56)
      .setAlpha(0);
    scene.tweens.add({ targets: a, alpha: 1, delay: i * 40, duration: 80, yoyo: true, repeat: Math.ceil(durMs / 160) });
    arrows.push(a);
  }
  scene.time.delayedCall(durMs, () => arrows.forEach((a) => a.destroy()));
}

// Raízes brotando do chão em volta de um ponto (prende o player)
export function rootsBurst(scene, x, y, r, durMs) {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const d = r * (0.25 + Math.random() * 0.4);
    const rx = x + Math.cos(a) * d,
      ry = y + Math.sin(a) * d * 0.7;
    const root = scene.add
      .image(rx, ry, "px_root")
      .setOrigin(0.5, 1)
      .setScale(3, 0)
      .setFlipX(Math.cos(a) < 0)
      .setDepth(ry + 10000);
    scene.tweens.add({ targets: root, scaleY: 3 + Math.random(), duration: 140, delay: i * 20, ease: "Back.easeOut" });
    scene.tweens.add({ targets: root, alpha: 0, scaleY: 0.5, delay: durMs - 200, duration: 200, onComplete: () => root.destroy() });
  }
}

// Pulso de invocação (magenta corrompido)
export function summonPulse(scene, x, y) {
  const g = scene.add.graphics().setDepth(56);
  const o = { t: 0 };
  scene.tweens.add({
    targets: o,
    t: 1,
    duration: 500,
    onUpdate: () => {
      g.clear();
      pixelRing(g, x, y, 30 + 60 * o.t, ROT.glow, 1 - o.t, 2);
      pixelRing(g, x, y, 20 + 40 * o.t, ROT.hot, 1 - o.t);
    },
    onComplete: () => g.destroy(),
  });
}

// ============================================================================
// AVISOS DOS CHEFES — desenhados QUADRO A QUADRO pelo golpe, com o progresso
// t (0..1) do próprio golpe: aviso e acerto andam no mesmo relógio (hit-stop,
// congelamento e pausa param os dois juntos). Ficam ACIMA do mapa de luz: na
// noite do chefe, um aviso fora da luz do herói não pode sumir no escuro.
// Cada forma diz o que fazer: círculo = sair; cone = sair pelos lados ou
// para longe; faixa = passo para o lado; varredura = correr para onde a
// seta começa. A borda branca que cresce é o relógio: fechou, bateu.
// ============================================================================
export const D_TELE = 48540; // acima do mapa de luz (48500), abaixo da Aura (48550)

const snap = (v) => Math.round(v / CELL) * CELL;

// Arco de "pixels" de a0 a a1 (rad), tracejado opcional
function pixelArc(g, cx, cy, r, a0, a1, color, alpha, dash = 0, dense = false) {
  if (r <= 1) return;
  const span = a1 - a0;
  const n = Math.max(4, Math.round((Math.abs(span) * r) / (CELL * (dense ? 1 : 2))));
  g.fillStyle(color, alpha);
  for (let i = 0; i <= n; i++) {
    if (dash && i % dash === dash - 1) continue;
    const a = a0 + (span * i) / n;
    g.fillRect(snap(cx + Math.cos(a) * r) - 1, snap(cy + Math.sin(a) * r) - 1, CELL, CELL);
  }
}

// Linha de "pixels" (tracejada opcional)
function pixelLine(g, x0, y0, x1, y1, color, alpha, dash = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(len / (CELL * 2)));
  g.fillStyle(color, alpha);
  for (let i = 0; i <= n; i++) {
    if (dash && i % dash === dash - 1) continue;
    const k = i / n;
    g.fillRect(snap(x0 + (x1 - x0) * k) - 1, snap(y0 + (y1 - y0) * k) - 1, CELL, CELL);
  }
}

// Setor preenchido (cone/varredura) — polígono com passo de ~6°
function fillSector(g, cx, cy, r0, r1, a0, a1, color, alpha) {
  const steps = Math.max(3, Math.ceil(Math.abs(a1 - a0) / 0.1));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1 });
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0 });
  }
  g.fillStyle(color, alpha).fillPoints(pts, true);
}

const blinkA = (scene, lo = 0.55) => (Math.floor(scene.time.now / 90) % 2 ? 1 : lo);

// Base: um Graphics que o golpe redesenha com draw(t)
class Tele {
  constructor(scene, color) {
    this.scene = scene;
    this.color = color;
    this.g = scene.add.graphics().setDepth(D_TELE);
  }
  destroy() {
    this.g?.destroy();
    this.g = null;
  }
}

// Círculo que carrega (mesma linguagem do dangerZone)
export class ZoneTele extends Tele {
  // fill < 1: círculo centrado no próprio chefe (não cobrir a pose nem o ponto fraco)
  constructor(scene, x, y, r, color = PAL.red2, fill = 1) {
    super(scene, color);
    Object.assign(this, { x, y, r, fill });
  }
  draw(t) {
    const { g, x, y, r, color, scene, fill } = this;
    if (!g) return;
    g.clear();
    g.fillStyle(color, (0.08 + t * 0.14) * fill).fillCircle(x, y, r);
    pixelRing(g, x, y, r, color, blinkA(scene), 3, scene.time.now / 900);
    pixelRing(g, x, y, Math.max(4, r * t), 0xffffff, 0.9);
    pixelRing(g, x, y, Math.max(2, r * t - 4), color, 0.9);
  }
}

// Cone a partir do chefe (coice): sair pelos lados ou para longe
export class ConeTele extends Tele {
  constructor(scene, x, y, ang, range, half, color = PAL.org2) {
    super(scene, color);
    Object.assign(this, { x, y, ang, range, half });
  }
  draw(t) {
    const { g, x, y, ang, range, half, color, scene } = this;
    if (!g) return;
    g.clear();
    const a0 = ang - half,
      a1 = ang + half;
    fillSector(g, x, y, 10, range, a0, a1, color, 0.08 + t * 0.14);
    const b = blinkA(scene);
    pixelArc(g, x, y, range, a0, a1, color, b, 3);
    pixelLine(g, x, y, x + Math.cos(a0) * range, y + Math.sin(a0) * range, color, b, 3);
    pixelLine(g, x, y, x + Math.cos(a1) * range, y + Math.sin(a1) * range, color, b, 3);
    pixelArc(g, x, y, Math.max(6, range * t), a0, a1, 0xffffff, 0.9);
  }
}

// Faixa reta (investida, cipós): o preenchimento corre da origem até a ponta
export class LaneTele extends Tele {
  // from: a faixa começa a esta distância da origem (não pinta por cima do chefe)
  constructor(scene, x, y, ang, len, width, color = PAL.red2, from = 0) {
    super(scene, color);
    Object.assign(this, { x: x + Math.cos(ang) * from, y: y + Math.sin(ang) * from, ang, len: Math.max(10, len - from), width });
  }
  draw(t) {
    const { g, x, y, ang, len, width, color, scene } = this;
    if (!g) return;
    g.clear();
    const c = Math.cos(ang),
      s = Math.sin(ang);
    const nx = -s * (width / 2),
      ny = c * (width / 2);
    const quad = (l0, l1) => [
      { x: x + c * l0 + nx, y: y + s * l0 + ny },
      { x: x + c * l1 + nx, y: y + s * l1 + ny },
      { x: x + c * l1 - nx, y: y + s * l1 - ny },
      { x: x + c * l0 - nx, y: y + s * l0 - ny },
    ];
    g.fillStyle(color, 0.08).fillPoints(quad(0, len), true);
    g.fillStyle(color, 0.1 + t * 0.12).fillPoints(quad(0, len * t), true);
    const b = blinkA(scene);
    pixelLine(g, x + nx, y + ny, x + c * len + nx, y + s * len + ny, color, b, 3);
    pixelLine(g, x - nx, y - ny, x + c * len - nx, y + s * len - ny, color, b, 3);
    pixelLine(g, x + c * len + nx, y + s * len + ny, x + c * len - nx, y + s * len - ny, color, b);
    // frente branca: o relógio do golpe
    const fx = x + c * len * t,
      fy = y + s * len * t;
    pixelLine(g, fx + nx, fy + ny, fx - nx, fy - ny, 0xffffff, 0.95);
    // chevrons correndo no sentido do golpe
    const phase = (scene.time.now / 6) % 42;
    g.fillStyle(0xffffff, 0.5);
    for (let d = phase; d < len - 10; d += 42) {
      for (const k of [-1, 1]) {
        const bx = x + c * d,
          by = y + s * d;
        g.fillRect(snap(bx + c * -6 + nx * 0.4 * k) - 1, snap(by + s * -6 + ny * 0.4 * k) - 1, CELL, CELL);
        g.fillRect(snap(bx + c * -3 + nx * 0.2 * k) - 1, snap(by + s * -3 + ny * 0.2 * k) - 1, CELL, CELL);
      }
      g.fillRect(snap(x + c * d) - 1, snap(y + s * d) - 1, CELL, CELL);
    }
  }
}

// Varredura (olhar): setor que o feixe vai varrer + seta no lado onde ELE COMEÇA
export class SweepTele extends Tele {
  constructor(scene, x, y, a0, arc, dir, len, color = PAL.red2, blind = 30) {
    super(scene, color);
    Object.assign(this, { x, y, a0, arc, dir, len, blind });
  }
  draw(t) {
    const { g, x, y, a0, arc, dir, len, color, scene, blind } = this;
    if (!g) return;
    g.clear();
    const a1 = a0 + dir * arc;
    fillSector(g, x, y, blind, len, Math.min(a0, a1), Math.max(a0, a1), color, 0.07 + t * 0.1);
    // ponto cego aos pés do chefe (também é saída), em verde
    pixelArc(g, x, y, blind, Math.min(a0, a1), Math.max(a0, a1), PAL.g6, 0.8, 2);
    const b = blinkA(scene);
    pixelArc(g, x, y, len, Math.min(a0, a1), Math.max(a0, a1), color, b, 3);
    pixelLine(g, x, y, x + Math.cos(a1) * len, y + Math.sin(a1) * len, color, b, 3);
    // borda de partida: branca e cheia (é dali que o feixe sai)
    pixelLine(g, x, y, x + Math.cos(a0) * len, y + Math.sin(a0) * len, 0xffffff, 0.95);
    // setas ao longo do arco apontando o sentido da varredura
    const n = 3;
    for (let i = 0; i < n; i++) {
      const k = ((i + (scene.time.now / 700) % 1) / n) * 0.9;
      const a = a0 + dir * arc * k;
      const r = len * 0.72;
      const px0 = x + Math.cos(a) * r,
        py0 = y + Math.sin(a) * r;
      const ta = a + dir * Math.PI / 2; // tangente
      for (let j = 0; j < 4; j++) {
        const bx = px0 - Math.cos(ta) * j * 3;
        const by = py0 - Math.sin(ta) * j * 3;
        g.fillStyle(0xffffff, 0.8 - j * 0.15);
        g.fillRect(snap(bx + Math.cos(a) * j * 3) - 1, snap(by + Math.sin(a) * j * 3) - 1, CELL, CELL);
        g.fillRect(snap(bx - Math.cos(a) * j * 3) - 1, snap(by - Math.sin(a) * j * 3) - 1, CELL, CELL);
      }
    }
    // relógio: arco branco no pé do setor
    pixelArc(g, x, y, 34, a0, a0 + dir * arc * t, 0xffffff, 0.9);
  }
}

// Anel do grito com BRECHA (a saída). Desenhado pelo golpe a cada quadro.
export function drawGapRing(g, x, y, r, band, gapAng, gapHalf, color, alpha = 1) {
  const a0 = gapAng + gapHalf,
    a1 = gapAng + Math.PI * 2 - gapHalf;
  // faixa translúcida (lê de longe) + bordas cheias de pixel + miolo branco
  g.lineStyle(band, color, 0.22 * alpha).beginPath().arc(x, y, r, a0, a1).strokePath();
  for (let k = -1; k <= 1; k++) pixelArc(g, x, y, r + k * (band / 3), a0, a1, k === 0 ? 0xffffff : color, alpha * (k === 0 ? 0.95 : 0.85), 0, true);
  // pontas da brecha marcadas (onde passar)
  for (const a of [a0, a1]) pixelLine(g, x + Math.cos(a) * (r - band), y + Math.sin(a) * (r - band), x + Math.cos(a) * (r + band), y + Math.sin(a) * (r + band), PAL.g6, alpha);
}

// Arco guia (prévia da brecha): só a parte segura, em verde, na distância do herói
export function drawSafeArc(g, x, y, r, gapAng, gapHalf, alpha = 1) {
  g.lineStyle(14, PAL.g6, 0.28 * alpha).beginPath().arc(x, y, r, gapAng - gapHalf, gapAng + gapHalf).strokePath();
  pixelArc(g, x, y, r - 6, gapAng - gapHalf, gapAng + gapHalf, PAL.g6, alpha, 0, true);
  pixelArc(g, x, y, r + 6, gapAng - gapHalf, gapAng + gapHalf, PAL.g6, alpha, 0, true);
  pixelArc(g, x, y, r, gapAng - gapHalf * 0.6, gapAng + gapHalf * 0.6, 0xffffff, alpha * 0.8, 2);
}

export { pixelArc, pixelLine, fillSector };

// Texturas usadas acima (registradas 1x no preload)
export function registerTelegraphs(scene) {
  Pix.fromMap(["kk...", "kwk..", ".kwk.", "..kwk", ".kwk.", "kwk..", "kk..."], { k: PAL.ink, w: PAL.white }).register(scene, "px_chevron");
  const root = Pix.fromMap(
    [
      "...h.",
      "...m.",
      "..mn.",
      "..nn.",
      ".mn..",
      ".nN..",
      "..nN.",
      "..nNg",
      ".mnN.",
      "mnNN.",
      "nNNNN",
    ],
    { h: PAL.g5, g: PAL.g4, m: PAL.n4, n: PAL.n3, N: PAL.n2 },
  );
  root.outline(PAL.ink).register(scene, "px_root");

  // Labareda do chão (rastro da Mula, brasas): 2 quadros que tremulam
  const flame = (f) =>
    Pix.fromMap(
      f
        ? ["..y...", "..yo..", ".yoo..", ".oor..", "oorro.", ".rrr.."]
        : ["...y..", "..oy..", "..ooy.", ".roo..", ".orroo", "..rrr."],
      { y: PAL.yel3, o: PAL.org2, r: PAL.red1 },
    ).outline(PAL.red0);
  flame(0).register(scene, "px_flame0");
  flame(1).register(scene, "px_flame1");

  // Cipó da Podridão (Corpo-Seco): espinhoso, magenta por dentro
  Pix.fromMap(
    [
      "..g..",
      ".hm..",
      "..mt.",
      ".mm..",
      "tmn..",
      ".nm..",
      "..nmt",
      ".nn..",
      "tnN..",
      ".nNN.",
      "nNNNN",
    ],
    { g: ROT.glow, h: ROT.hot, m: ROT.mid, t: PAL.s4, n: PAL.n2, N: PAL.n1 },
  )
    .outline(PAL.ink)
    .register(scene, "px_vine");

  // Montinho de terra (Corpo-Seco andando por baixo do chão)
  Pix.fromMap(
    [
      "....aab.....",
      "..aabbbcc...",
      ".abbcgcccd..",
      "abbccccdddd.",
      "bccddddddddd",
    ],
    { a: PAL.n4, b: PAL.n3, c: PAL.n2, d: PAL.n1, g: ROT.glow },
  )
    .outline(PAL.ink)
    .register(scene, "px_mound");

  // Brasa voando (Chuva de Brasas)
  Pix.fromMap([".yo.", "yyoo", "ooor", ".rr."], { y: PAL.yel3, o: PAL.org2, r: PAL.red1 }).outline(PAL.red0).register(scene, "px_ember");
}
