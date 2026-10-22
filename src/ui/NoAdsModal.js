// Janela "Sem anúncios" (compra única pela Play Store, ver systems/Billing.js). Abre do título e das
// Opções — nunca no meio da partida; sozinha, só a oferta curta da volta à Clareira (maybeNoAdsNudge). Diz com honestidade o que a compra faz: os prêmios
// dos anúncios saem na hora, com os mesmos limites; não compra poder nem moedas.
import { Billing } from "../systems/Billing.js";
import { Analytics } from "../systems/Analytics.js";
import { CSS } from "../art/Palette.js";
import { text, Button, haptic, vh } from "./Theme.js";
import { Modal } from "./Widgets.js";
import { cloudToast } from "./CloudSaveUI.js";
import { tr } from "../i18n/i18n.js";
import { COSM_KITS, cosmeticsOn, Wardrobe } from "../systems/Cosmetics.js";
import { AdService } from "../systems/AdService.js";
import { STORE } from "../config.js";
import { DEBUG } from "../systems/Platform.js";
import { openWardrobe } from "./WardrobeModal.js";

// Aviso da loja (Billing.notice): pagamento pendente que o Google aprovou, ou compra estornada. Só nas
// telas de menu (Título e Clareira chamam no update, sem janela aberta), nunca no meio da partida;
// aparece uma vez. Antes o estorno tirava o "sem anúncios" calado e o jogador achava que perdeu o item.
export function showStoreNotice(scene, o = {}) {
  const kind = Billing.notice;
  if (!kind) return showKitNotice(scene, o);
  Billing.clearNotice();
  Analytics.track("iap_notice", { kind });
  const revoked = kind === "revoked";
  let toShop = false;
  const m = new Modal(scene, { title: revoked ? tr("COMPRA ESTORNADA") : tr("PAGAMENTO APROVADO"), w: 640, h: vh(scene), onClose: () => !toShop && o.onClose?.() });
  let y = m.top + 16;
  const note = (str, size, color, gap) => {
    const t = m.add(text(scene, 0, y, str, { size, color, origin: [0.5, 0], align: "center", wrap: m.w - 100 }));
    y += t.height + gap;
  };
  if (revoked) {
    note(tr("A Play Store estornou a compra “Sem anúncios” e devolveu o pagamento."), 20, CSS.txt, 16);
    note(tr("Os prêmios voltam a pedir um anúncio. O seu progresso continua igual."), 18, CSS.muted, 10);
    note(tr("Se foi engano, dá para comprar de novo."), 18, CSS.muted, 24);
    const by = y + 28;
    m.add(new Button(scene, -140, by, 250, 56, tr("SEM ANÚNCIOS"), () => {
      toShop = true;
      m.close();
      openNoAds(scene, { from: "notice", onClose: o.onClose });
    }, { size: 20, style: "dark", color: CSS.goldHi }));
    m.add(new Button(scene, 140, by, 250, 56, tr("FECHAR"), () => m.close(), { size: 20 }));
    y = by + 28 + 16;
  } else {
    scene.sound.play("sfx_coin", { volume: 0.6 });
    note(tr("O Google confirmou o pagamento. “Sem anúncios” está ativo nesta conta."), 20, CSS.goldHi, 16);
    note(tr("Os prêmios dos anúncios saem na hora, sem assistir nada."), 18, CSS.txt, 10);
    note(tr("Obrigado por apoiar um jogo independente feito no Brasil!"), 18, CSS.muted, 24);
    m.add(new Button(scene, 0, y + 28, 300, 56, tr("FECHAR"), () => m.close(), { size: 20, style: "primary", color: CSS.goldHi }));
    y += 56 + 16;
  }
  m.fitContent(y + 14);
  return m;
}

// Aviso de KIT de cosméticos (estornado ou pagamento aprovado), com atalho para o Guarda-roupa
function showKitNotice(scene, o) {
  const n = Billing.kitNotice;
  if (!n) return null;
  Billing.clearKitNotice();
  Analytics.track("iap_notice", { kind: n.kind, kit: n.kit });
  const kitName = n.pack ? (STORE.PACKS[n.pack]?.founder ? tr("Pacote Fundador") : tr("Pacote Apoiador")) : tr("Kit {0}", COSM_KITS[n.kit]?.name ?? n.kit);
  const revoked = n.kind === "revoked";
  let toWardrobe = false;
  const m = new Modal(scene, { title: revoked ? tr("COMPRA ESTORNADA") : tr("PAGAMENTO APROVADO"), w: 640, h: vh(scene), onClose: () => !toWardrobe && o.onClose?.() });
  let y = m.top + 16;
  const note = (str, size, color, gap) => {
    const t = m.add(text(scene, 0, y, str, { size, color, origin: [0.5, 0], align: "center", wrap: m.w - 100 }));
    y += t.height + gap;
  };
  const P = n.pack ? STORE.PACKS[n.pack] : null;
  if (revoked) {
    note(tr("A Play Store estornou a compra do {0} e devolveu o pagamento.", kitName), 20, CSS.txt, 16);
    if (!P) note(tr("As peças do kit voltam ao padrão. O seu progresso continua igual."), 18, CSS.muted, 24);
    else {
      // o que o pacote levava sai junto (os anúncios só voltam se nenhuma outra compra ainda os tira)
      note(P.founder ? tr("Os kits, a Clareira Ancestral e a insígnia de Fundador saem.") : tr("Os kits do pacote saem."), 18, CSS.muted, 6);
      if (P.noAds && !AdService.noAds) note(tr("Os anúncios opcionais voltam."), 18, CSS.muted, 6);
      note(tr("O seu progresso continua igual."), 18, CSS.muted, 24);
    }
  } else {
    // pacote do Fundador aprovado depois (pagamento pendente): a Clareira já vira a Ancestral, como na compra direta
    if (P?.founder && cosmeticsOn()) Wardrobe.equip("camp", "ancestral");
    scene.sound.play("sfx_coin", { volume: 0.6 });
    note(tr("O Google confirmou o pagamento. O {0} já está no Guarda-roupa.", kitName), 20, CSS.goldHi, 24);
  }
  const by = y + 28;
  if (cosmeticsOn()) {
    m.add(new Button(scene, -140, by, 250, 56, tr("GUARDA-ROUPA"), () => {
      toWardrobe = true;
      m.close();
      openWardrobe(scene, { from: "notice", onClose: o.onClose });
    }, { size: 20, style: revoked ? "dark" : "primary", color: CSS.goldHi }));
    m.add(new Button(scene, 140, by, 250, 56, tr("FECHAR"), () => m.close(), { size: 20 }));
  } else m.add(new Button(scene, 0, by, 300, 56, tr("FECHAR"), () => m.close(), { size: 20 }));
  y = by + 28 + 16;
  m.fitContent(y + 14);
  return m;
}

// Oferta curta do "Sem anúncios" no momento em que ela vale: o jogador voltou de uma partida e já assistiu a
// vários anúncios (ADS.NUDGE_AT). Uma vez em cada marca, no máximo duas, e só quando dá para comprar de fato.
// Quem chama garante a Clareira livre (sem outra janela, cena ou fala). o.open(from) abre a Loja ou o
// "Sem anúncios", conforme a loja de cosméticos
export function maybeNoAdsNudge(scene, o = {}) {
  if (!AdService.enabled || !AdService.nudgeDue() || Billing.owned) return null;
  if (!(Billing.available() ? Billing.ready && !Billing.pending : DEBUG)) return null;
  const watched = AdService.watched;
  AdService.nudgeShown();
  Analytics.track("noads_nudge", { action: "show", watched });
  let toStore = false;
  const m = new Modal(scene, {
    title: tr("SEM ANÚNCIOS"),
    w: 640,
    h: vh(scene),
    onClose: () => {
      if (toStore) return;
      Analytics.track("noads_nudge", { action: "later", watched });
      o.onClose?.();
    },
  });
  let y = m.top + 14;
  m.add(scene.add.image(0, y + 26, "ico_star").setScale(5));
  y += 66;
  const note = (str, size, color, gap) => {
    const t = m.add(text(scene, 0, y, str, { size, color, origin: [0.5, 0], align: "center", wrap: m.w - 100 }));
    y += t.height + gap;
  };
  note(tr("Você já assistiu a {0} anúncios. Obrigado por apoiar o jogo!", watched), 20, CSS.txt, 10);
  note(tr("Os prêmios dos anúncios saem na hora, sem assistir nada."), 18, CSS.muted, 24);
  const by = y + 28;
  m.add(new Button(scene, -140, by, 250, 56, tr("CONHECER"), () => {
    toStore = true;
    Analytics.track("noads_nudge", { action: "open", watched });
    m.close();
    o.open?.("nudge");
  }, { size: 20, style: "primary", color: CSS.goldHi }));
  m.add(new Button(scene, 140, by, 250, 56, tr("AGORA NÃO"), () => m.close(), { size: 20, style: "dark" }));
  m.fitContent(by + 28 + 16);
  return m;
}

export function openNoAds(scene, o = {}) {
  if (!o.again) Analytics.track("iap_view", { from: o.from ?? "?", owned: Billing.owned, ready: Billing.ready });
  // onClose do chamador só quando o jogador fecha de vez (refazer a janela com o estado novo não conta)
  let reopening = false;
  // Montada de cima para baixo e depois encolhida até o fim do conteúdo (fitContent): a altura muda com o
  // idioma e com o tamanho do texto ("Muito grande" em japonês quebra em bem mais linhas)
  const m = new Modal(scene, { title: tr("SEM ANÚNCIOS"), w: 680, h: vh(scene), onClose: () => !reopening && o.onClose?.() });
  const reopen = () => {
    if (m._closed) return;
    reopening = true;
    m.close();
    openNoAds(scene, { ...o, again: true });
  };
  const L = -m.w / 2 + 60;
  const wrap = m.w - 140;
  let y = m.top + 16;
  // Benefício: ícone alinhado à 1ª linha do texto
  const line = (icon, str, color = CSS.txt) => {
    const t = m.add(text(scene, L + 50, y, str, { size: 19, color, origin: [0, 0], wrap }));
    const first = t.height / Math.max(1, t.getWrappedText().length);
    m.add(scene.add.image(L + 14, y + first / 2, icon).setScale(3));
    y += Math.max(40, t.height + 24);
  };
  // Texto centralizado que quebra se não couber
  const note = (str, size, color, gap = 14) => {
    const t = m.add(text(scene, 0, y, str, { size, color, origin: [0.5, 0], align: "center", wrap: m.w - 80 }));
    y += t.height + gap;
    return t;
  };
  const button = (w, h, label, fn, opts) => {
    const b = m.add(new Button(scene, 0, y + h / 2, w, h, label, fn, opts));
    y += h + 16;
    return b;
  };
  const done = () => {
    m.fitContent(y + 14);
    return m;
  };

  if (Billing.owned) {
    line("ico_check", tr("Ativo nesta conta Google."), CSS.goldHi);
    line("ico_star", tr("Os prêmios dos anúncios saem na hora, sem assistir nada."));
    line("ico_heart", tr("Obrigado por apoiar um jogo independente feito no Brasil!"));
    y += 6;
    button(300, 56, tr("FECHAR"), () => m.close(), { size: 20, style: "dark" });
    return done();
  }

  line("ico_star", tr("Reviver, mais uma carta, dobrar moedas, baú do dia: o prêmio sai na hora, sem assistir anúncio."));
  line("ico_heart", tr("Apoia um jogo independente feito no Brasil."));
  line("ico_check", tr("Compra única. Vale para sempre nesta conta Google, também se reinstalar."));
  note(tr("Os limites de cada prêmio continuam os mesmos."), 15, CSS.muted, 18);

  if (Billing.pending || !Billing.ready) {
    const pending = Billing.pending;
    note(pending ? tr("Pagamento pendente: libera assim que o Google confirmar.") : tr("Loja indisponível agora. Precisa de internet."), 17, pending ? CSS.goldHi : CSS.redHi);
    const b = button(320, 56, pending ? tr("CONFERIR AGORA") : tr("TENTAR DE NOVO"), async () => {
      b.setEnabled(false);
      await (pending ? Billing.sync() : Billing.retry());
      if (b.active) reopen();
    }, { size: 20, style: "button" });
    return done();
  }

  const buy = button(360, 64, tr("COMPRAR · {0}", Billing.price), async () => {
    buy.setEnabled(false);
    haptic(20);
    const r = await Billing.buy();
    if (!buy.active) return;
    if (r === "ok") {
      scene.sound.play("sfx_coin", { volume: 0.6 });
      cloudToast(scene, tr("Obrigado! Prêmios liberados sem anúncio."));
      reopen();
    } else if (r === "pending") reopen();
    else {
      buy.setEnabled(true);
      if (r === "unavailable") cloudToast(scene, tr("Não foi possível concluir a compra."));
    }
  }, { size: 24, style: "primary", color: CSS.goldHi });
  // Restaurar: reinstalar já recupera sozinho; o botão serve para quem trocou de conta ou estava sem rede
  const rest = note(tr("Restaurar compra"), 16, CSS.muted, 4);
  rest.setInteractive({ useHandCursor: true }).on("pointerup", async () => {
    rest.setText(tr("Conferindo…"));
    const ok = await Billing.sync();
    if (!rest.active) return;
    if (Billing.owned || Billing.pending) return reopen();
    rest.setText(ok ? tr("Nenhuma compra nesta conta Google") : tr("Sem conexão com a loja"));
  });
  return done();
}
