// Janela "Sem anúncios" (compra única pela Play Store, ver systems/Billing.js). Abre do título e das
// Opções — nunca no meio da partida e nunca sozinha. Diz com honestidade o que a compra faz: os prêmios
// dos anúncios saem na hora, com os mesmos limites; não compra poder nem moedas.
import { Billing } from "../systems/Billing.js";
import { Analytics } from "../systems/Analytics.js";
import { CSS } from "../art/Palette.js";
import { text, Button, haptic, vh } from "./Theme.js";
import { Modal } from "./Widgets.js";
import { cloudToast } from "./CloudSaveUI.js";
import { tr } from "../i18n/i18n.js";

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
