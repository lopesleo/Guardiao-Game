// Guarda-roupa (docs/COSMETICOS.md): vitrine das peças de cosmético, aberta pelo menu de cima da
// Clareira. Abas por parte (Libertação · Rastro · Despertar); à esquerda a PRÉVIA AO VIVO da peça
// escolhida (também das que o jogador ainda não tem — ver antes de comprar); à direita os cartões.
// Peça paga sem a compra mostra o preço e abre a compra do kit ali mesmo (1 kit = as 3 peças).
// Compra pela Play Store (Billing.buyKit) com COSMETICS.SHOP ligado no app; no modo de teste sem a loja de
// verdade há uma loja simulada (nada é cobrado).
import { CSS } from "../art/Palette.js";
import { text, Button, vw, vh, drawFrame } from "./Theme.js";
import { Modal, fitTo } from "./Widgets.js";
import { cloudToast } from "./CloudSaveUI.js";
import { CosmeticStage } from "./CosmeticStage.js";
import { COSM_SLOTS, COSM_KITS, COSM_PIECES, COSM_AMOUNTS, Wardrobe, piecesOf, kitPieces } from "../systems/Cosmetics.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { registerAuraFX } from "../art/AuraFX.js";
import { COSMETICS } from "../config.js";
import { DEBUG } from "../systems/Platform.js";
import { Analytics } from "../systems/Analytics.js";
import { Billing } from "../systems/Billing.js";
import { tr } from "../i18n/i18n.js";

const NONE_DESC = { kill: tr("O efeito de sempre."), trail: tr("Sem rastro."), awaken: tr("O Despertar dourado de sempre.") };

// Loja de verdade ligada? (COSMETICS.SHOP no app com Play Billing)
const realShop = () => COSMETICS.SHOP && Billing.available();
// Preço do kit: o da Play Store ou o da loja simulada do modo de teste; null = sem loja ("Em breve")
function kitPrice(kit) {
  if (realShop()) return Billing.kitPrice(kit) || null;
  return DEBUG ? "R$ 9,90" : null;
}

// Ícone do cartão encaixado numa caixa (cada textura tem um tamanho)
function iconInBox(scene, key, frame, maxW, maxH, tint) {
  const img = scene.add.image(0, 0, key, frame ?? 0);
  const s = Math.max(1, Math.floor(Math.min(maxW / img.width, maxH / img.height, 9))); // sementinha 3×3 também aparece
  img.setScale(s);
  if (tint != null) img.setTint(tint);
  return img;
}

export function openWardrobe(scene, o = {}) {
  registerCosmeticFX(scene);
  registerAuraFX(scene);
  if (!o.again) Analytics.track("wardrobe_view", { from: o.from ?? "?" });
  const slot = o.slot ?? "kill";
  const equipped = Wardrobe.get(slot);
  const sel = o.sel !== undefined ? o.sel : equipped; // peça na prévia (null = o padrão)
  let reopening = false;
  const m = new Modal(scene, { title: tr("GUARDA-ROUPA"), w: Math.min(1180, vw(scene) - 40), h: vh(scene), onClose: () => !reopening && (stage.destroy(), o.onClose?.()) });
  const reopen = (patch) => {
    if (m._closed) return;
    reopening = true;
    stage.destroy();
    m.close();
    openWardrobe(scene, { ...o, slot, sel, ...patch, again: true });
  };

  // Abas
  const tabW = Math.min(240, (m.w - 80) / 3 - 12);
  COSM_SLOTS.forEach((s, i) => {
    const x = (i - 1) * (tabW + 14);
    m.add(new Button(scene, x, m.top + 24, tabW, 46, s.name, () => s.id !== slot && reopen({ slot: s.id, sel: Wardrobe.get(s.id) }), { size: 17, style: s.id === slot ? "gold" : "dark", color: s.id === slot ? CSS.goldHi : CSS.muted }));
  });
  const top = m.top + 70;
  const L = -m.w / 2 + 40;
  const R = m.w / 2 - 40;

  // ---------------------------------------------------------- prévia + detalhe da peça
  const SW = 400,
    SH = 260;
  const frame = scene.add.graphics();
  drawFrame(frame, L - 6, top - 6, SW + 12, SH + 12, "gold");
  m.add(frame);
  const stage = new CosmeticStage(scene, SW, SH, scene.heroId ?? "guardian");
  stage.rt.setOrigin(0).setPosition(L, top);
  m.add(stage.rt);
  stage.show(slot, sel);

  const piece = sel ? COSM_PIECES[sel] : null;
  const owned = !piece || Wardrobe.owns(piece.id);
  const kit = piece?.kit ? COSM_KITS[piece.kit] : null;
  let y = top + SH + 18;
  const title = m.add(text(scene, L, y, piece ? piece.name : COSM_SLOTS.find((s) => s.id === slot).none, { size: 24, color: CSS.goldHi, origin: [0, 0] }));
  fitTo(title, SW);
  y += title.height + 4;
  const sub = kit ? tr("Kit {0}", kit.name) : piece ? tr("GRÁTIS") : "";
  if (sub) {
    const t = m.add(text(scene, L, y, sub, { size: 15, color: CSS.muted, origin: [0, 0] }));
    y += t.height + 6;
  }
  const d = m.add(text(scene, L, y, piece ? piece.desc : NONE_DESC[slot], { size: 16, origin: [0, 0], wrap: SW }));
  y += d.height + 14;
  // Ação
  const isOn = sel === equipped;
  const price = kit && !owned ? kitPrice(piece.kit) : null;
  let action;
  if (owned && isOn) action = new Button(scene, L + 150, y + 28, 300, 56, tr("EQUIPADA"), () => {}, { size: 20, style: "dark", color: CSS.goldHi, enabled: false });
  else if (owned)
    action = new Button(scene, L + 150, y + 28, 300, 56, tr("EQUIPAR"), () => {
      Wardrobe.equip(slot, sel);
      Analytics.track("cosm_equip", { slot, piece: sel ?? "none" });
      reopen({});
    }, { size: 22, style: "primary", color: CSS.goldHi });
  else if (Billing.kitPending(piece.kit)) action = new Button(scene, L + 150, y + 28, 300, 56, tr("PENDENTE"), () => {}, { size: 20, style: "dark", enabled: false });
  else if (price) action = new Button(scene, L + 150, y + 28, 300, 56, tr("COMPRAR KIT · {0}", price), () => openKit(scene, piece.kit, () => reopen({})), { size: 19, style: "gold", color: CSS.goldHi });
  else action = new Button(scene, L + 150, y + 28, 300, 56, tr("EM BREVE"), () => {}, { size: 20, style: "dark", enabled: false });
  m.add(action);
  const leftBottom = y + 56;

  // ---------------------------------------------------------- cartões
  const GX = L + SW + 40,
    GW = R - GX;
  const cols = GW >= 3 * 160 + 28 ? 3 : 2;
  const CW = Math.floor((GW - (cols - 1) * 14) / cols),
    CH = 118;
  const list = [null, ...piecesOf(slot).map((p) => p.id)];
  list.forEach((id, i) => {
    const p = id ? COSM_PIECES[id] : null;
    const cx = GX + (i % cols) * (CW + 14) + CW / 2,
      cy = top + Math.floor(i / cols) * (CH + 14) + CH / 2;
    const mine = !p || Wardrobe.owns(id);
    const card = new Button(scene, cx, cy, CW, CH, null, () => id !== sel && reopen({ sel: id }), { style: id === sel ? "gold" : "dark" });
    const ic = p ? iconInBox(scene, p.icon, p.frame, CW - 40, 46, p.tint) : text(scene, 0, 0, "—", { size: 30, color: CSS.muted, origin: 0.5 });
    if (p && !mine) ic.setAlpha(0.8);
    const nm = text(scene, 0, 0, p ? p.name : COSM_SLOTS.find((s) => s.id === slot).none, { size: 15, origin: 0.5 });
    fitTo(nm, CW - 16);
    const tagStr = id === equipped ? tr("EQUIPADA") : !p ? "" : !p.kit ? tr("GRÁTIS") : mine ? COSM_KITS[p.kit].name : Billing.kitPending(p.kit) ? tr("PENDENTE") : kitPrice(p.kit) ?? tr("EM BREVE");
    const tag = text(scene, 0, 0, tagStr, { size: 13, color: id === equipped ? CSS.goldHi : p?.kit && !mine ? CSS.goldHi : CSS.muted, origin: 0.5 });
    fitTo(tag, CW - 16);
    // de baixo para cima pelas alturas reais (texto grande em japonês/chinês encostava no ícone)
    tag.setY(CH / 2 - 10 - tag.displayHeight / 2);
    nm.setY(tag.y - tag.displayHeight / 2 - 2 - nm.displayHeight / 2);
    ic.setPosition(0, (-CH / 2 + 8 + (nm.y - nm.displayHeight / 2)) / 2);
    card.add([ic, nm, tag]);
    if (id === equipped) card.add(scene.add.image(CW / 2 - 18, -CH / 2 + 18, "ico_check").setScale(2));
    m.add(card);
  });
  const rows = Math.ceil(list.length / cols);
  let gy = top + rows * (CH + 14) + 6;

  // Quantidade de pétalas (vale para todas as peças)
  const amt = m.add(text(scene, GX, gy + 6, tr("Quantidade de pétalas"), { size: 18, origin: [0, 0] }));
  const hint = m.add(text(scene, GX, gy + 8 + amt.height, tr("Discreta deixa a tela mais limpa"), { size: 13, color: CSS.muted, origin: [0, 0], wrap: GW - 240 }));
  const ab = new Button(scene, R - 105, gy + 6 + (amt.height + hint.height) / 2, 210, 44, COSM_AMOUNTS[Wardrobe.amount].name, () => {
    const i = (Wardrobe.amount + 1) % COSM_AMOUNTS.length;
    Wardrobe.setAmount(i);
    ab.setLabel(COSM_AMOUNTS[i].name);
  }, { size: 18, style: "button" });
  m.add(ab);
  gy += Math.max(56, amt.height + hint.height + 18);
  const note = m.add(text(scene, GX, gy, tr("Vale a partir da próxima partida."), { size: 14, color: CSS.muted, origin: [0, 0], wrap: GW }));
  gy += note.height + 8;
  if (DEBUG) {
    const t = m.add(text(scene, GX, gy, tr("Loja de teste (modo de teste): nada é cobrado."), { size: 13, color: CSS.muted, origin: [0, 0], wrap: GW }));
    gy += t.height;
  }
  m.fitContent(Math.max(leftBottom, gy) + 24);
  return m;
}

// Compra do kit: o que vem dentro (as 3 peças), a garantia "só aparência" e o preço
function openKit(scene, kitId, done) {
  const kit = COSM_KITS[kitId];
  const price = kitPrice(kitId);
  Analytics.track("kit_view", { kit: kitId });
  const m = new Modal(scene, { title: tr("Kit {0}", kit.name).toUpperCase(), w: 700, h: vh(scene) });
  const L = -m.w / 2 + 56;
  let y = m.top + 10;
  const head = m.add(text(scene, 0, y, tr("Leva as 3 peças:"), { size: 18, color: CSS.muted, origin: [0.5, 0] }));
  y += head.height + 14;
  for (const p of kitPieces(kitId)) {
    const ic = iconInBox(scene, p.icon, p.frame, 56, 40, p.tint);
    ic.setPosition(L + 30, y + 22);
    m.add(ic);
    const nm = m.add(text(scene, L + 76, y, p.name, { size: 19, color: CSS.goldHi, origin: [0, 0] }));
    const ds = m.add(text(scene, L + 76, y + nm.height + 2, p.desc, { size: 15, origin: [0, 0], wrap: m.w - 76 - 112 }));
    y += Math.max(54, nm.height + ds.height + 14);
  }
  y += 4;
  const fair = m.add(text(scene, 0, y, tr("Só aparência: não muda dano, vida nem moedas."), { size: 15, color: CSS.muted, origin: [0.5, 0], align: "center", wrap: m.w - 80 }));
  y += fair.height + 16;
  const unlocked = () => {
    scene.sound.play("sfx_coin", { volume: 0.6 });
    cloudToast(scene, tr("Kit liberado! Escolha as peças no Guarda-roupa."));
    m.close();
    done?.();
  };
  const buy = m.add(new Button(scene, 0, y + 32, 360, 64, tr("COMPRAR · {0}", price ?? "—"), async () => {
    if (!price) return;
    buy.setEnabled(false);
    if (!realShop()) {
      // loja simulada do modo de teste
      Wardrobe.devBuy(kitId);
      Analytics.track("kit_buy_test", { kit: kitId });
      return unlocked();
    }
    const r = await Billing.buyKit(kitId);
    if (!buy.active) return;
    if (r === "ok") return unlocked();
    if (r === "pending") {
      cloudToast(scene, tr("Pagamento pendente: libera assim que o Google confirmar."));
      m.close();
      return done?.();
    }
    buy.setEnabled(true);
    if (r === "unavailable") cloudToast(scene, tr("Não foi possível concluir a compra."));
  }, { size: 22, style: "primary", color: CSS.goldHi }));
  y += 64 + 16;
  if (!realShop()) {
    const t = m.add(text(scene, 0, y, tr("Loja de teste (modo de teste): nada é cobrado."), { size: 13, color: CSS.muted, origin: [0.5, 0] }));
    y += t.height + 6;
  }
  m.fitContent(y + 14);
  return m;
}
