// Carta de level-up: fita de tipo, medalhão com ícone grande, nome, selo de
// elemento, linha de efeito em destaque, descrição e pips de nível.
import { PAL, CSS, hex, ELEMENT_COLOR } from "../art/Palette.js";
import { MAX_WEAPON_LEVEL } from "../config.js";
import { text, drawFrame, P, haptic } from "./Theme.js";

const TYPE = {
  new: { style: "green", ribbon: PAL.g5, label: "NOVA ARMA", stat: CSS.green },
  upgrade: { style: "gold", ribbon: PAL.uiGold, label: "MELHORIA", stat: CSS.goldHi },
  evolution: { style: "purple", ribbon: PAL.pur2, label: "EVOLUÇÃO", stat: hex(PAL.pur3) },
  passive: { style: "ice", ribbon: PAL.ice2, label: "PASSIVA", stat: hex(PAL.ice3) },
};
const ELEMENT_NAME = { fire: "FOGO", ice: "GELO", bolt: "RAIO" };

export function createCard(scene, x, y, w, h, card, onClick, index, showKey = true) {
  const t = TYPE[card.type] || TYPE.passive;
  const c = scene.add.container(Math.round(x), Math.round(y));
  const inner = scene.add.container(0, 0);
  c.add(inner);

  // Moldura
  const g = scene.add.graphics();
  drawFrame(g, -w / 2, -h / 2, w, h, t.style);
  inner.add(g);

  // Fita do tipo
  const rib = scene.add.graphics();
  const rw = w - 12 * P;
  drawFrame(rib, -rw / 2, -h / 2 + 5 * P, rw, 10 * P, { border: PAL.ink, body: t.ribbon, hi: 0xffffff, lo: PAL.ink }, { noRivets: true });
  inner.add(rib);
  inner.add(text(scene, 0, -h / 2 + 10 * P, card.ribbon ?? t.label, { size: 15, color: CSS.ink, origin: 0.5, shadow: false }));

  // Medalhão com ícone
  const my = -h / 2 + 42 * P;
  const med = scene.add.graphics();
  med.fillStyle(PAL.ink, 1).fillCircle(0, my, 44);
  med.fillStyle(t.ribbon, 1).fillCircle(0, my, 40);
  med.fillStyle(PAL.uiBg, 1).fillCircle(0, my, 34);
  if (card.element) {
    med.fillStyle(ELEMENT_COLOR[card.element], 0.18).fillCircle(0, my, 34);
  }
  inner.add(med);
  const ico = scene.add.image(0, my, card.icon ?? "ico_plus").setScale(5);
  inner.add(ico);
  scene.tweens.add({ targets: ico, y: my - 4, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

  // Nome
  let cy = my + 58;
  const title = text(scene, 0, cy, card.title, { size: 24, origin: 0.5, align: "center", wrap: w - 30, stroke: true, strokeW: 4 });
  if (title.width > w - 24) title.setFontSize(20);
  inner.add(title);
  cy += title.height / 2 + 14;

  // Selo de elemento (armas)
  if (card.element) {
    const col = ELEMENT_COLOR[card.element];
    const label = ELEMENT_NAME[card.element];
    const chip = scene.add.graphics();
    const cw = 30 * P;
    drawFrame(chip, -cw / 2, cy - 4 * P, cw, 8 * P, { border: col, body: PAL.uiBg, hi: PAL.uiPanel, lo: PAL.ink }, { noRivets: true });
    inner.add(chip);
    inner.add(text(scene, 0, cy, label, { size: 13, color: hex(col), origin: 0.5, shadow: false }));
    cy += 26;
  }

  // Efeito (o número que importa)
  inner.add(text(scene, 0, cy + 6, card.stat ?? "", { size: 21, color: t.stat, origin: 0.5, align: "center", wrap: w - 28, stroke: true, strokeW: 4 }));
  cy += 34;

  // Descrição
  inner.add(
    text(scene, 0, cy, card.desc ?? "", {
      size: 16,
      color: CSS.muted,
      origin: [0.5, 0],
      align: "center",
      wrap: w - 36,
      lineSpacing: 4,
      shadow: false,
    }),
  );

  // Pips de nível (nova arma: 0→1; melhoria: n→n+1 piscando)
  if (card.type === "upgrade" || card.type === "new") {
    const n = MAX_WEAPON_LEVEL;
    const pw = 7 * P,
      gap = 2 * P;
    const total = n * pw + (n - 1) * gap;
    const py = h / 2 - 16 * P;
    const lv = card.level ?? 0;
    for (let i = 0; i < n; i++) {
      const px = -total / 2 + i * (pw + gap);
      const filled = i < lv;
      const next = i === lv;
      const pip = scene.add.rectangle(px + pw / 2, py, pw, pw, filled ? PAL.yel2 : next ? PAL.yel3 : PAL.inkSoft).setStrokeStyle(P, PAL.ink);
      inner.add(pip);
      if (next) scene.tweens.add({ targets: pip, alpha: 0.25, duration: 380, yoyo: true, repeat: -1 });
    }
  }

  // Atalho de teclado (só desktop)
  if (showKey && index != null) {
    const kx = w / 2 - 12 * P,
      ky = h / 2 - 8 * P;
    const kg = scene.add.graphics();
    drawFrame(kg, kx - 5 * P, ky - 5 * P, 10 * P, 10 * P, "dark", { noRivets: true });
    inner.add(kg);
    inner.add(text(scene, kx, ky, String(index + 1), { size: 16, color: CSS.goldHi, origin: 0.5 }));
  }

  // Interação: hover levanta, clique confirma
  const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  c.add(hit);
  let down = false;
  hit.on("pointerover", () => {
    scene.tweens.add({ targets: inner, y: -10, duration: 120, ease: "Quad.easeOut" });
    scene.sound.play("sfx_ui_hover", { volume: 0.2 });
  });
  hit.on("pointerout", () => {
    down = false;
    scene.tweens.add({ targets: inner, y: 0, duration: 120 });
  });
  hit.on("pointerdown", () => (down = true));
  hit.on("pointerup", () => {
    if (!down) return;
    down = false;
    haptic(18);
    onClick(card, c);
  });
  c.inner = inner;
  return c;
}
