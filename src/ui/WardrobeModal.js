// Guarda-roupa (PROTÓTIPO dos cosméticos, docs/COSMETICOS.md): cada peça do kit se equipa à parte e a
// quantidade de pétalas é do jogador. Só aparece no modo de teste (botão na Clareira com ?debug=1).
// Vale na próxima partida (os efeitos nascem com a cena da partida).
import { CSS } from "../art/Palette.js";
import { text, Button, vh } from "./Theme.js";
import { Modal } from "./Widgets.js";
import { COSM_SLOTS, COSM_KITS, COSM_AMOUNTS, Wardrobe } from "../systems/Cosmetics.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { tr } from "../i18n/i18n.js";

export function openWardrobe(scene, o = {}) {
  registerCosmeticFX(scene);
  // Sem subtítulo: o do Modal tem posição fixa e encostava no título com texto grande em japonês
  const m = new Modal(scene, { title: tr("GUARDA-ROUPA"), w: 760, h: vh(scene), onClose: o.onClose });
  const L = -m.w / 2 + 56;
  const R = m.w / 2 - 56;
  let y = m.top + 10;
  // Kit: flor de ipê + nome
  m.add(scene.add.image(L + 18, y + 18, "cos_bloom").setScale(3));
  m.add(text(scene, L + 48, y + 18, COSM_KITS.ipe.name, { size: 24, color: CSS.goldHi, origin: [0, 0.5] }));
  y += 52;
  const row = (label, hint, keys, show, get, set) => {
    const lab = m.add(text(scene, L, y, label, { size: 22, origin: [0, 0] }));
    const hn = hint ? m.add(text(scene, L, y + lab.height + 2, hint, { size: 14, color: CSS.muted, origin: [0, 0], wrap: m.w - 112 - 240 })) : null;
    const h = lab.height + (hn ? hn.height + 2 : 0);
    const b = m.add(new Button(scene, R - 110, y + h / 2, 220, 44, show(get()), () => {
      const v = keys[(keys.indexOf(get()) + 1) % keys.length];
      set(v);
      b.setLabel(show(v));
    }, { size: 20, style: "button" }));
    y += Math.max(56, h + 18);
  };
  for (const s of COSM_SLOTS)
    row(s.name, s.hint, [null, "ipe"], (v) => (v ? COSM_KITS[v].name : s.none), () => Wardrobe.get(s.id), (v) => Wardrobe.set(s.id, v));
  row(tr("Quantidade de pétalas"), tr("Discreta deixa a tela mais limpa"), COSM_AMOUNTS.map((_, i) => i), (i) => COSM_AMOUNTS[i].name, () => Wardrobe.amount, (i) => Wardrobe.set("amount", i));
  y += 4;
  for (const note of [tr("Vale a partir da próxima partida."), tr("Protótipo · só no modo de teste")]) {
    const t = m.add(text(scene, 0, y, note, { size: 15, color: CSS.muted, origin: [0.5, 0], align: "center", wrap: m.w - 100 }));
    y += t.height + 6;
  }
  y += 14;
  m.add(new Button(scene, 0, y + 28, 300, 56, tr("FECHAR"), () => m.close(), { size: 20, style: "primary", color: CSS.goldHi }));
  y += 56 + 16;
  m.fitContent(y + 14);
  return m;
}
