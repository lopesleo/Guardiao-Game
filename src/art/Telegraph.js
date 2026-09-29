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
}
