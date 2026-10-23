// Carta de level-up: fita de tipo, medalhão com ícone grande, nome, selo de
// elemento, linha de efeito em destaque, descrição e pips de nível.
import { PAL, CSS, hex, ELEMENT_COLOR } from "../art/Palette.js";
import { MAX_WEAPON_LEVEL } from "../config.js";
import { text, drawFrame, P, haptic, uiSfx, fromTouch } from "./Theme.js";
import { tr } from "../i18n/i18n.js";

const TYPE = {
  new: { style: "green", ribbon: PAL.g5, label: tr("NOVA ARMA"), stat: CSS.green },
  upgrade: { style: "gold", ribbon: PAL.uiGold, label: tr("MELHORIA"), stat: CSS.goldHi },
  evolution: { style: "purple", ribbon: PAL.pur2, label: tr("EVOLUÇÃO"), stat: hex(PAL.pur3) },
  passive: { style: "ice", ribbon: PAL.ice2, label: tr("PASSIVA"), stat: hex(PAL.ice3) },
  pact: { style: "danger", ribbon: PAL.red2, label: tr("TRATO DA MATA"), stat: CSS.goldHi },
};
const ELEMENT_NAME = { fire: tr("FOGO"), ice: tr("GELO"), bolt: tr("RAIO"), wind: tr("VENTO") };

export function createCard(scene, x, y, w, h, card, onClick, index, showKey = true) {
  const t = TYPE[card.type] || TYPE.passive;
  const c = scene.add.container(Math.round(x), Math.round(y));
  let inner = scene.add.container(0, 0);
  c.add(inner);

  // Moldura
  const g = scene.add.graphics();
  drawFrame(g, -w / 2, -h / 2, w, h, t.style);
  inner.add(g);

  // Fita do tipo
  // A altura da fita acompanha o texto: em tela pequena a fonte é ampliada e estourava a faixa fixa
  const rw = w - 12 * P;
  const label = text(scene, 0, 0, card.ribbon ?? t.label, { size: 15, color: CSS.ink, origin: 0.5, shadow: false });
  if (label.width > rw - 8 * P) label.setScale((rw - 8 * P) / label.width);
  const rh = Math.max(10 * P, Math.ceil((label.displayHeight + 6 * P) / P) * P);
  const rib = scene.add.graphics();
  drawFrame(rib, -rw / 2, -h / 2 + 5 * P, rw, rh, { border: PAL.ink, body: t.ribbon, hi: 0xffffff, lo: PAL.ink }, { noRivets: true });
  inner.add(rib);
  label.setY(-h / 2 + 5 * P + rh / 2);
  inner.add(label);

  // Corpo (medalhão → descrição) num container próprio: no fim, centralizado
  // entre a fita e o rodapé da carta
  const body = scene.add.container(0, 0);
  const outer = inner;
  inner = body; // o que vem abaixo entra no corpo
  const ribBottom = -h / 2 + 5 * P + rh;
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
  // Empilhado pela altura real: nome e efeito podem quebrar em 2 linhas (traduções, texto grande)
  let cy = my + 46;
  const title = text(scene, 0, cy, card.title, { size: 24, origin: [0.5, 0], align: "center", wrap: w - 30, stroke: true, strokeW: 4 });
  // Quebrou em 2 linhas? Tenta caber em uma com fonte menor (em japonês sobrava um
  // caractere sozinho na 2ª linha: "サン・ジョアンの焚き / 火")
  const oneLine = title.height;
  title.setText("x");
  const lineH = title.height;
  title.setText(card.title);
  if (oneLine > lineH * 1.5) title.setFontSize(20);
  inner.add(title);
  cy += title.height + 14;

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
  const statT = text(scene, 0, cy - 6, card.stat ?? "", { size: 21, color: t.stat, origin: [0.5, 0], align: "center", wrap: w - 28, stroke: true, strokeW: 4 });
  inner.add(statT);
  cy += statT.height + 8;

  // Descrição
  const descT = text(scene, 0, cy, card.desc ?? "", {
    size: 16,
    color: CSS.muted,
    origin: [0.5, 0],
    align: "center",
    wrap: w - 36,
    lineSpacing: 4,
    shadow: false,
  });
  inner.add(descT);
  // Encaixe do corpo: ele SEMPRE termina acima do rodapé — pips de nível (armas), custo
  // (trato) ou selo da tecla. Antes só havia ajuste para o trato: descrição longa (dica de
  // Ressonância da arma nova), 4 cartas na mesa (carta estreita) ou tradução maior
  // desciam por cima dos pips. Ordem: fonte da descrição até 13 → o corpo inteiro encolhe.
  inner = outer;
  inner.add(body);
  let costT = null;
  if (card.cost) {
    costT = text(scene, 0, 0, card.cost, { size: 18, color: CSS.redHi, origin: 0.5, align: "center", wrap: w - 70, stroke: true, strokeW: 4 });
    // Acima do selo da tecla (canto inferior) — antes encostava nele
    costT.setY(h / 2 - 12 * P - 14 - costT.height / 2);
    inner.add(costT);
  }
  const hasPips = card.type === "upgrade" || card.type === "new";
  const limit = costT ? costT.y - costT.height / 2 - 8 : hasPips ? h / 2 - 16 * P - 3.5 * P - 10 : h / 2 - 14 * P - 4;
  const top = ribBottom + 6;
  const bodyTop = my - 44;
  const bodyH = () => descT.y + descT.height - bodyTop;
  let fs = parseInt(descT.style.fontSize, 10);
  while (bodyH() > limit - top && fs > 13) {
    fs -= 1;
    descT.setFontSize(fs);
  }
  const k = Math.min(1, (limit - top) / bodyH());
  body.setScale(k);
  const free = limit - top - bodyH() * k;
  body.y = top + free * 0.42 - bodyTop * k;

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
  hit.on("pointerover", (p) => {
    scene.tweens.add({ targets: inner, y: -10, duration: 120, ease: "Quad.easeOut" });
    if (!fromTouch(p)) uiSfx(scene, "sfx_ui_hover", { volume: 0.2 });
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
  c.inner = outer;
  return c;
}
