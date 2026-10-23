// Guarda-roupa (docs/COSMETICOS.md): onde o jogador escolhe e compra os cosméticos. Abre pela camiseta
// no menu de cima da Clareira. Estrutura (revista em 19/10/2026, regras de UX em COSMETICOS.md):
//   abas  Libertação · Rastro · Despertar (equipar, uma parte por vez) · Clareira (skin do acampamento;
//         a Ancestral é exclusiva do Pacote Fundador; a da Caatinga é grátis, da conquista "Mandacaru em Flor" — trancada,
//         mostra o que fazer e o quanto falta) · Kits (comprar; 1 kit = 3 peças)
//   esquerda  PRÉVIA AO VIVO do que está selecionado — também do que o jogador ainda não tem; na aba Kits
//             o kit inteiro toca em sequência (Rastro → Libertação → Despertar)
//   direita   cartões. Três sinais diferentes, nunca só cor: moldura dourada = o que está na prévia;
//             selo ✓ = em uso; cadeado = falta comprar o kit. Preço SÓ no kit (nas peças, preço por peça
//             fazia parecer que cada uma custava R$ 9,90)
//   rodapé    quantidade de efeitos (as 3 opções à vista)
// Tocar no cartão já selecionado usa a peça (atalho). Compra pela Play Store (Billing.buyKit) com
// COSMETICS.SHOP ligado no app; no modo de teste sem a loja de verdade, uma loja simulada (nada é cobrado).
import { CSS } from "../art/Palette.js";
import { text, Button, vw, vh, drawFrame, haptic, uiSfx } from "./Theme.js";
import { Modal, fitTo } from "./Widgets.js";
import { cloudToast } from "./CloudSaveUI.js";
import { CosmeticStage } from "./CosmeticStage.js";
import { COSM_SLOTS, COSM_KITS, COSM_PIECES, COSM_AMOUNTS, COSM_CAMP, Wardrobe, piecesOf, kitPieces } from "../systems/Cosmetics.js";
import { openShop, shopOn } from "./ShopModal.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { registerAuraFX } from "../art/AuraFX.js";
import { COSMETICS, ACHIEVEMENTS, DIFFICULTY, BUILDINGS } from "../config.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { ensureCampSertao } from "../art/CampSertao.js";
import { DEBUG } from "../systems/Platform.js";
import { Analytics } from "../systems/Analytics.js";
import { Billing } from "../systems/Billing.js";
import { tr } from "../i18n/i18n.js";

const NONE_DESC = { kill: tr("O efeito de sempre."), trail: tr("Sem rastro."), awaken: tr("O Despertar dourado de sempre.") };
const slotOf = (id) => COSM_SLOTS.find((s) => s.id === id);

// Loja de verdade ligada? (COSMETICS.SHOP no app com Play Billing)
const realShop = () => COSMETICS.SHOP && Billing.available();
// Preço do kit: o da Play Store ou o da loja simulada do modo de teste; null = sem loja ("Em breve")
function kitPrice(kit) {
  if (realShop()) return Billing.kitPrice(kit) || null;
  return DEBUG ? "R$ 4,90" : null; // loja simulada = preço planejado do Play Console
}

// Ícone encaixado numa caixa (cada textura tem um tamanho)
function iconInBox(scene, key, frame, maxW, maxH, tint) {
  const img = scene.add.image(0, 0, key, frame ?? 0);
  // escala inteira (pixel nítido); só encolhe abaixo de 1 o que não cabe na caixa (a aura do Despertar)
  const k = Math.min(maxW / img.width, maxH / img.height, 9);
  const s = k >= 1 ? Math.floor(k) : k;
  img.setScale(s);
  if (tint != null) img.setTint(tint);
  return img;
}

// Arte do cartão de cada Clareira (a árvore-marco; na Caatinga, o mandacaru em flor)
const CAMP_ART = { ancestral: "camp_jequitiba", caatinga: "camp_sertao_card" };

// Quanto falta para a Clareira grátis (earn): a Trilha do Sertão, o melhor Perigo vencido na Caatinga
function earnProgress(skin) {
  if (skin.earn !== "mandacaru_flor") return null;
  const meta = new MetaProgression();
  if (!meta.biomeOpen("caatinga")) return tr("Primeiro, abra a {0} com o João-de-barro.", BUILDINGS.trail.name);
  const best = meta.data.bestDiffByBiome?.caatinga;
  if (best != null) return tr("Seu melhor na Caatinga: Perigo {0}", DIFFICULTY[best].name);
  const wins = meta.biomeWins().caatinga || 0;
  return wins ? tr("Vitórias na Caatinga: {0}", wins) : tr("Você ainda não venceu na Caatinga.");
}

export function openWardrobe(scene, o = {}) {
  registerCosmeticFX(scene);
  registerAuraFX(scene);
  ensureCampSertao(scene); // cartão e prévia da Clareira da Caatinga
  if (!o.again) Analytics.track("wardrobe_view", { from: o.from ?? "?" });
  const tab = o.tab ?? "kill";
  const isKits = tab === "kits";
  const isCamp = tab === "camp";
  const inUse = isKits ? null : isCamp ? Wardrobe.activeCamp() : Wardrobe.get(tab);
  const sel = isKits ? o.kit ?? Object.keys(COSM_KITS)[0] : o.sel !== undefined ? o.sel : inUse; // na prévia
  let reopening = false;
  const m = new Modal(scene, { title: tr("GUARDA-ROUPA"), w: Math.min(1180, vw(scene) - 40), h: vh(scene), onClose: () => !reopening && (stage.destroy(), o.onClose?.()) });
  // Refaz a janela com o estado novo, sem a animação de entrada (memo do Modal) e sem piscar
  const reopen = (patch) => {
    if (m._closed) return;
    reopening = true;
    stage.destroy();
    m.close();
    scene._modalMemo = { title: tr("GUARDA-ROUPA"), scroll: 0, at: Date.now() };
    openWardrobe(scene, { ...o, tab, sel: isKits ? undefined : sel, kit: isKits ? sel : o.kit, pop: null, ...patch, again: true });
  };
  const equipFx = () => {
    uiSfx(scene, "sfx_ui_click", { volume: 0.5, rate: 1.25 });
    haptic(15);
  };

  // ---------------------------------------------------------- abas + "em uso"
  const tabs = [...COSM_SLOTS.map((s) => [s.id, s.name]), ["camp", tr("Clareira")], ["kits", tr("Kits")]];
  const tabW = Math.min(214, (m.w - 80) / tabs.length - 12);
  tabs.forEach(([id, label], i) => {
    const x = (i - (tabs.length - 1) / 2) * (tabW + 14);
    m.add(new Button(scene, x, m.top + 22, tabW, 46, label, () => id !== tab && reopen({ tab: id, sel: id === "kits" ? undefined : Wardrobe.get(id) }), { size: 17, style: id === tab ? "gold" : "dark", color: id === tab ? CSS.goldHi : CSS.muted }));
  });
  const usingName = (slot) => (Wardrobe.get(slot) ? COSM_PIECES[Wardrobe.get(slot)].name : slotOf(slot).none);
  const campName = (id) => (id ? COSM_CAMP[id].name : tr("Clareira de sempre"));
  const subStr = isKits
    ? tr("Cada kit traz 3 peças, só de aparência.")
    : isCamp
      ? `${tr("O visual do acampamento")}  ·  ${tr("Em uso: {0}", campName(inUse))}`
      : `${slotOf(tab).hint}  ·  ${tr("Em uso: {0}", usingName(tab))}`;
  const sub = m.add(text(scene, 0, m.top + 56, subStr, { size: 14, color: CSS.muted, origin: [0.5, 0] }));
  fitTo(sub, m.w - 80);
  const top = Math.max(m.top + 84, sub.y + sub.displayHeight + 14); // texto grande (ja/zh) empurra para baixo
  const L = -m.w / 2 + 40;
  const R = m.w / 2 - 40;

  // ---------------------------------------------------------- prévia
  const SW = 400,
    SH = 250;
  const frame = scene.add.graphics();
  drawFrame(frame, L - 6, top - 6, SW + 12, SH + 12, "gold");
  m.add(frame);
  const stage = new CosmeticStage(scene, SW, SH, scene.heroId ?? "guardian");
  stage.rt.setOrigin(0).setPosition(L, top);
  m.add(stage.rt);
  // legenda do momento (modo kit) no canto da prévia
  const cap = m.add(text(scene, L + 10, top + 8, "", { size: 14, color: CSS.goldHi, origin: [0, 0], stroke: true }));
  if (isKits) {
    const eq = Object.fromEntries(kitPieces(sel).map((p) => [p.slot, p.id]));
    stage.showKit(eq, (slot) => cap.active && cap.setText(slotOf(slot).name));
  } else if (isCamp) stage.showCamp(sel);
  else stage.show(tab, sel);

  // ---------------------------------------------------------- detalhe + ação
  let y = top + SH + 16;
  const BW = 320,
    BX = L + BW / 2;
  const addLine = (str, size, color, gap = 4, wrap = SW, icon = null) => {
    let x = L;
    if (icon) {
      m.add(scene.add.image(L + 10, y + size * 0.55, icon).setScale(2));
      x += 26;
    }
    const t = m.add(text(scene, x, y, str, { size, color, origin: [0, 0], ...(wrap ? { wrap: wrap - (x - L) } : {}) }));
    if (!wrap) fitTo(t, SW);
    y += t.height + gap;
    return t;
  };
  let action;
  if (isKits) {
    const kit = COSM_KITS[sel];
    const owned = Wardrobe.ownsKit(sel);
    addLine(tr("Kit {0}", kit.name), 22, CSS.goldHi, 8, 0);
    for (const p of kitPieces(sel)) {
      const ic = iconInBox(scene, p.icon, p.frame, 34, 26, p.tint);
      ic.setPosition(L + 17, y + 13);
      m.add(ic);
      m.add(text(scene, L + 44, y + 1, slotOf(p.slot).name, { size: 13, color: CSS.muted, origin: [0, 0] }));
      const nm = m.add(text(scene, L + 150, y + 13, p.name, { size: 16, origin: [0, 0.5] }));
      fitTo(nm, SW - 150);
      y += 30;
    }
    y += 2;
    addLine(tr("Só aparência: não muda dano, vida nem moedas."), 13, CSS.muted, 10);
    const price = owned ? null : kitPrice(sel);
    if (owned && Wardrobe.wearingKit(sel)) action = new Button(scene, BX, y + 28, BW, 56, tr("EM USO"), () => {}, { size: 20, style: "dark", color: CSS.goldHi, enabled: false });
    else if (owned)
      action = new Button(scene, BX, y + 28, BW, 56, tr("USAR O KIT INTEIRO"), () => {
        Wardrobe.equipKit(sel);
        Analytics.track("cosm_equip_kit", { kit: sel });
        equipFx();
        reopen({});
      }, { size: 20, style: "primary", color: CSS.goldHi });
    else if (Billing.kitPending(sel)) action = new Button(scene, BX, y + 28, BW, 56, tr("PENDENTE"), () => {}, { size: 20, style: "dark", enabled: false });
    else if (price) action = new Button(scene, BX, y + 28, BW, 56, tr("COMPRAR · {0}", price), () => buyKit(scene, sel, action, () => reopen({})), { size: 22, style: "primary", color: CSS.goldHi });
    else action = new Button(scene, BX, y + 28, BW, 56, tr("EM BREVE"), () => {}, { size: 20, style: "dark", enabled: false });
  } else if (isCamp) {
    const skin = sel ? COSM_CAMP[sel] : null;
    const owned = !skin || Wardrobe.ownsCamp(sel);
    addLine(campName(sel), 22, CSS.goldHi, 4, 0);
    if (skin?.founder) addLine(tr("Exclusiva do Pacote Fundador"), 15, owned ? CSS.muted : CSS.goldHi, 6, SW, owned ? "ico_fundador" : "ico_lock");
    else if (skin?.earn) {
      // grátis: a conquista libera; trancada, diz o que fazer e o quanto falta
      const ach = ACHIEVEMENTS.find((a) => a.id === skin.earn);
      if (owned) addLine(tr("Grátis · conquista {0}", ach?.name ?? ""), 15, CSS.muted, 6, SW, "ico_trophy");
      else {
        addLine(tr("Grátis: {0}", skin.how), 15, CSS.goldHi, 4, SW, "ico_lock");
        const prog = earnProgress(skin);
        if (prog) addLine(prog, 14, CSS.muted, 6, SW);
      }
    } else if (skin) addLine(tr("Peça grátis"), 15, CSS.muted, 6, SW);
    addLine(skin ? skin.desc : tr("A samaúma, a mata e o céu pela hora do dia."), 16, CSS.txt, 12);
    if (owned && sel === inUse) action = new Button(scene, BX, y + 28, BW, 56, tr("EM USO"), () => {}, { size: 20, style: "dark", color: CSS.goldHi, enabled: false });
    else if (owned)
      action = new Button(scene, BX, y + 28, BW, 56, tr("USAR"), () => {
        Wardrobe.equip("camp", sel);
        Analytics.track("cosm_equip", { slot: "camp", piece: sel ?? "none" });
        equipFx();
        reopen({ pop: sel ?? "none" });
      }, { size: 22, style: "primary", color: CSS.goldHi });
    else if (skin?.earn) action = new Button(scene, BX, y + 28, BW, 56, tr("BLOQUEADA"), () => {}, { size: 20, style: "dark", enabled: false });
    else if (shopOn()) action = new Button(scene, BX, y + 28, BW, 56, tr("VER PACOTE FUNDADOR"), () => {
      reopening = true;
      stage.destroy();
      m.close();
      openShop(scene, { from: "wardrobe", onClose: o.onClose });
    }, { size: 18, style: "gold", color: CSS.goldHi });
    else action = new Button(scene, BX, y + 28, BW, 56, tr("EM BREVE"), () => {}, { size: 20, style: "dark", enabled: false });
  } else {
    const piece = sel ? COSM_PIECES[sel] : null;
    const owned = !piece || Wardrobe.owns(piece.id);
    const kit = piece?.kit ? COSM_KITS[piece.kit] : null;
    addLine(piece ? piece.name : slotOf(tab).none, 22, CSS.goldHi, 4, 0);
    if (piece) addLine(kit ? tr("Vem no {0}", tr("Kit {0}", kit.name)) : tr("Peça grátis"), 15, kit && !owned ? CSS.goldHi : CSS.muted, 6, SW, kit && !owned ? "ico_lock" : null);
    addLine(piece ? piece.desc : NONE_DESC[tab], 16, CSS.txt, 12);
    const price = kit && !owned ? kitPrice(piece.kit) : null;
    if (owned && sel === inUse) action = new Button(scene, BX, y + 28, BW, 56, tr("EM USO"), () => {}, { size: 20, style: "dark", color: CSS.goldHi, enabled: false });
    else if (owned)
      action = new Button(scene, BX, y + 28, BW, 56, tr("USAR"), () => {
        Wardrobe.equip(tab, sel);
        Analytics.track("cosm_equip", { slot: tab, piece: sel ?? "none" });
        equipFx();
        reopen({ pop: sel ?? "none" });
      }, { size: 22, style: "primary", color: CSS.goldHi });
    else if (Billing.kitPending(piece.kit)) action = new Button(scene, BX, y + 28, BW, 56, tr("PENDENTE"), () => {}, { size: 20, style: "dark", enabled: false });
    else if (price) action = new Button(scene, BX, y + 28, BW, 56, tr("VER KIT · {0}", price), () => reopen({ tab: "kits", kit: piece.kit }), { size: 19, style: "gold", color: CSS.goldHi });
    else action = new Button(scene, BX, y + 28, BW, 56, tr("EM BREVE"), () => {}, { size: 20, style: "dark", enabled: false });
  }
  m.add(action);
  const leftBottom = y + 56;

  // ---------------------------------------------------------- cartões
  const GX = L + SW + 36,
    GW = R - GX;
  let gy = top;
  if (isKits) {
    const CW = Math.floor((GW - 14) / 2),
      CH = 150;
    Object.values(COSM_KITS).forEach((kit, i) => {
      const cx = GX + (i % 2) * (CW + 14) + CW / 2,
        cy = top + Math.floor(i / 2) * (CH + 14) + CH / 2;
      const owned = Wardrobe.ownsKit(kit.id);
      const card = new Button(scene, cx, cy, CW, CH, null, () => kit.id !== sel && reopen({ kit: kit.id }), { style: kit.id === sel ? "gold" : "dark" });
      // as 3 peças lado a lado
      kitPieces(kit.id).forEach((p, k) => {
        const ic = iconInBox(scene, p.icon, p.frame, 56, 44, p.tint);
        ic.setPosition((k - 1) * 70, -28);
        card.add(ic);
      });
      const nm = text(scene, 0, 20, kit.name, { size: 17, origin: 0.5 });
      fitTo(nm, CW - 20);
      const st = owned ? tr("COMPRADO") : Billing.kitPending(kit.id) ? tr("PENDENTE") : kitPrice(kit.id) ?? tr("EM BREVE");
      const tag = text(scene, 0, 48, st, { size: 15, color: owned ? CSS.muted : CSS.goldHi, origin: 0.5 });
      card.add([nm, tag]);
      card.add(scene.add.image(CW / 2 - 18, -CH / 2 + 18, owned ? "ico_check" : "ico_lock").setScale(2).setAlpha(owned ? 1 : 0.85));
      m.add(card);
    });
    gy = top + 2 * (CH + 14);
    // tudo de uma vez: chamada para o pacote (a Loja), se ainda há o que comprar
    if (shopOn() && !Wardrobe.isFounder()) {
      m.add(new Button(scene, GX + GW / 2, gy + 22, GW, 44, tr("PACOTE FUNDADOR: TUDO DE UMA VEZ ›"), () => {
        reopening = true;
        stage.destroy();
        m.close();
        openShop(scene, { from: "wardrobe_kits", onClose: o.onClose });
      }, { size: 16, style: "gold", color: CSS.goldHi }));
      gy += 56;
    }
  } else if (isCamp) {
    const ids = [null, ...Object.keys(COSM_CAMP)];
    const CW = Math.floor((GW - 12 * (ids.length - 1)) / ids.length),
      CH = 170;
    ids.forEach((id, i) => {
      const skin = id ? COSM_CAMP[id] : null;
      const cx = GX + i * (CW + 12) + CW / 2,
        cy = top + CH / 2;
      const mine = !skin || Wardrobe.ownsCamp(id);
      const card = new Button(scene, cx, cy, CW, CH, null, () => {
        if (id !== sel) return reopen({ sel: id });
        if (mine && id !== inUse) {
          Wardrobe.equip("camp", id);
          equipFx();
          reopen({ pop: id ?? "none" });
        }
      }, { style: id === sel ? "gold" : "dark" });
      // de baixo para cima (o texto cresce com o idioma e o tamanho): etiqueta, nome e a árvore no que sobra;
      // a etiqueta reserva a mesma altura nos dois cartões para os nomes ficarem alinhados
      const tagStr = id === inUse ? tr("EM USO") : !skin ? "" : skin.earn ? (mine ? tr("CONQUISTADA") : tr("GRÁTIS")) : mine ? tr("COMPRADA") : tr("EXCLUSIVA");
      const tag = text(scene, 0, CH / 2 - 10, tr("EM USO"), { size: 13, color: id === inUse || !mine ? CSS.goldHi : CSS.muted, origin: [0.5, 1] });
      // nome em até duas linhas (três cartões lado a lado; em japonês e chinês o nome é curto)
      const nm = fitTo(text(scene, 0, tag.y - tag.displayHeight - 2, campName(id), { size: 15, origin: [0.5, 1], align: "center", wrap: CW - 16 }), CW - 12);
      tag.setText(tagStr);
      const foot = nm.y - nm.displayHeight - 6;
      const tree = scene.add.image(0, foot, CAMP_ART[id] ?? "camp_kapok").setOrigin(0.5, 1);
      tree.setScale(Math.min(id === "caatinga" ? 1.35 : id ? 0.75 : 0.85, (foot + CH / 2 - 10) / tree.height));
      if (!mine) tree.setAlpha(0.8);
      card.add([tree, nm, tag]);
      const badge = id === inUse ? "ico_check" : skin && !mine ? "ico_lock" : null;
      if (badge) card.add(scene.add.image(CW / 2 - 16, -CH / 2 + 16, badge).setScale(2));
      m.add(card);
    });
    gy = top + CH + 12;
  } else {
    const cols = 3;
    const CW = Math.floor((GW - (cols - 1) * 12) / cols),
      CH = 106;
    const list = [null, ...piecesOf(tab).map((p) => p.id)];
    list.forEach((id, i) => {
      const p = id ? COSM_PIECES[id] : null;
      const cx = GX + (i % cols) * (CW + 12) + CW / 2,
        cy = top + Math.floor(i / cols) * (CH + 12) + CH / 2;
      const mine = !p || Wardrobe.owns(id);
      // toque: seleciona (prévia); tocar de novo na selecionada usa (se for sua)
      const card = new Button(scene, cx, cy, CW, CH, null, () => {
        if (id !== sel) return reopen({ sel: id });
        if (mine && id !== inUse) {
          Wardrobe.equip(tab, id);
          Analytics.track("cosm_equip", { slot: tab, piece: id ?? "none", via: "card" });
          equipFx();
          reopen({ pop: id ?? "none" });
        }
      }, { style: id === sel ? "gold" : "dark" });
      const ic = p ? iconInBox(scene, p.icon, p.frame, CW - 50, 44, p.tint) : text(scene, 0, 0, "—", { size: 30, color: CSS.muted, origin: 0.5 });
      if (p && !mine) ic.setAlpha(0.75);
      const nm = text(scene, 0, 0, p ? p.name : slotOf(tab).none, { size: 15, origin: 0.5 });
      fitTo(nm, CW - 16);
      const tagStr = id === inUse ? tr("EM USO") : !p ? "" : !p.kit ? tr("GRÁTIS") : mine ? tr("COMPRADA") : Billing.kitPending(p.kit) ? tr("PENDENTE") : COSM_KITS[p.kit].name;
      const tag = text(scene, 0, 0, tagStr, { size: 13, color: id === inUse ? CSS.goldHi : CSS.muted, origin: 0.5 });
      fitTo(tag, CW - 16);
      // de baixo para cima pelas alturas reais (texto grande em japonês/chinês encostava no ícone)
      tag.setY(CH / 2 - 10 - tag.displayHeight / 2);
      nm.setY(tag.y - tag.displayHeight / 2 - 2 - nm.displayHeight / 2);
      ic.setPosition(0, (-CH / 2 + 8 + (nm.y - nm.displayHeight / 2)) / 2);
      card.add([ic, nm, tag]);
      // selo: ✓ em uso · cadeado falta comprar (não só a cor diz o estado)
      const badge = id === inUse ? "ico_check" : p?.kit && !mine ? "ico_lock" : null;
      if (badge) {
        const b = scene.add.image(CW / 2 - 16, -CH / 2 + 16, badge).setScale(2);
        card.add(b);
        if (o.pop === (id ?? "none") && id === inUse) {
          b.setScale(0);
          scene.tweens.add({ targets: b, scale: 2, duration: 260, ease: "Back.easeOut" });
        }
      }
      m.add(card);
    });
    gy = top + Math.ceil(list.length / cols) * (CH + 12);
  }

  // ---------------------------------------------------------- rodapé: quantidade de efeitos (não vale para a Clareira)
  gy += 4;
  if (!isCamp) {
    const amt = m.add(text(scene, GX, gy, tr("Quantidade de efeitos"), { size: 16, origin: [0, 0] }));
    const segW = 104;
    COSM_AMOUNTS.forEach((a, i) => {
      const on = Wardrobe.amount === i;
      m.add(new Button(scene, R - (COSM_AMOUNTS.length - i - 0.5) * (segW + 6), gy + amt.height / 2 + 2, segW, 40, a.name, () => {
        if (on) return;
        Wardrobe.setAmount(i);
        reopen({});
      }, { size: 15, style: on ? "gold" : "dark", color: on ? CSS.goldHi : CSS.muted }));
    });
    gy += Math.max(44, amt.height + 8);
    const hint = m.add(text(scene, GX, gy, tr("Pouca deixa a tela mais limpa"), { size: 13, color: CSS.muted, origin: [0, 0], wrap: GW }));
    gy += hint.height + 2;
    const note = m.add(text(scene, GX, gy, tr("Vale a partir da próxima partida."), { size: 13, color: CSS.muted, origin: [0, 0], wrap: GW }));
    gy += note.height + 2;
  }
  if (isKits && DEBUG && !realShop()) {
    const t = m.add(text(scene, GX, gy, tr("Loja simulada (modo de teste): nada é cobrado."), { size: 13, color: CSS.muted, origin: [0, 0], wrap: GW }));
    gy += t.height;
  }
  // altura igual em todas as abas (a janela "pulava" de tamanho ao trocar de aba); esse piso nunca passa da
  // janela — só o conteúdo de verdade, se não couber, faz o fitContent encolher tudo
  m.fitContent(Math.max(leftBottom, gy, Math.min(top + SH + 330, m.h / 2 - 20)) + 20);
  return m;
}

// Compra do kit (a Play Store mostra a própria confirmação; no modo de teste, loja simulada)
async function buyKit(scene, kitId, btn, done) {
  btn.setEnabled(false);
  const unlocked = () => {
    scene.sound.play("sfx_coin", { volume: 0.6 });
    haptic(25);
    cloudToast(scene, tr("Kit liberado! Agora é só usar as peças."));
    done?.();
  };
  if (!realShop()) {
    Wardrobe.devBuy(kitId);
    Analytics.track("kit_buy_test", { kit: kitId });
    return unlocked();
  }
  const r = await Billing.buyKit(kitId);
  if (!btn.active) return;
  if (r === "ok") return unlocked();
  if (r === "pending") {
    cloudToast(scene, tr("Pagamento pendente: libera assim que o Google confirmar."));
    return done?.();
  }
  btn.setEnabled(true);
  if (r === "unavailable") cloudToast(scene, tr("Não foi possível concluir a compra."));
}
