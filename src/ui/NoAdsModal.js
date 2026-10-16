// Janela "Sem anúncios" (compra única pela Play Store, ver systems/Billing.js). Abre do título e das
// Opções — nunca no meio da partida e nunca sozinha. Diz com honestidade o que a compra faz: os prêmios
// dos anúncios saem na hora, com os mesmos limites; não compra poder nem moedas.
import { Billing } from "../systems/Billing.js";
import { Analytics } from "../systems/Analytics.js";
import { CSS } from "../art/Palette.js";
import { text, Button, haptic } from "./Theme.js";
import { Modal } from "./Widgets.js";
import { cloudToast } from "./CloudSaveUI.js";
import { tr } from "../i18n/i18n.js";

export function openNoAds(scene, o = {}) {
  if (!o.again) Analytics.track("iap_view", { from: o.from ?? "?", owned: Billing.owned, ready: Billing.ready });
  // onClose do chamador só quando o jogador fecha de vez (refazer a janela com o estado novo não conta)
  let reopening = false;
  const m = new Modal(scene, { title: tr("SEM ANÚNCIOS"), w: 680, h: Billing.owned ? 380 : 470, onClose: () => !reopening && o.onClose?.() });
  const reopen = () => {
    if (m._closed) return;
    reopening = true;
    m.close();
    openNoAds(scene, { ...o, again: true });
  };
  const L = -m.w / 2 + 60;
  const wrap = m.w - 140;
  let y = m.top + 34;
  const line = (icon, str, color = CSS.txt) => {
    m.add(scene.add.image(L + 14, y, icon).setScale(3));
    const t = m.add(text(scene, L + 50, y, str, { size: 19, color, origin: [0, 0.5], wrap }));
    y += Math.max(58, t.height + 22);
  };
  // rodapé preso à borda de baixo: aviso · estado · botão · restaurar
  const bottom = m.h / 2;

  if (Billing.owned) {
    line("ico_check", tr("Ativo nesta conta Google."), CSS.goldHi);
    line("ico_star", tr("Os prêmios dos anúncios saem na hora, sem assistir nada."));
    line("ico_heart", tr("Obrigado por apoiar um jogo independente feito no Brasil!"));
    m.add(new Button(scene, 0, bottom - 60, 300, 56, tr("FECHAR"), () => m.close(), { size: 20, style: "dark" }));
    return m;
  }

  line("ico_star", tr("Reviver, mais uma carta, dobrar moedas, baú do dia: o prêmio sai na hora, sem assistir anúncio."));
  line("ico_heart", tr("Apoia um jogo independente feito no Brasil."));
  line("ico_check", tr("Compra única. Vale para sempre nesta conta Google, também se reinstalar."));
  m.add(text(scene, 0, bottom - 150, tr("Os limites de cada prêmio continuam os mesmos."), { size: 15, color: CSS.muted, origin: 0.5 }));

  if (Billing.pending) {
    m.add(text(scene, 0, bottom - 116, tr("Pagamento pendente: libera assim que o Google confirmar."), { size: 17, color: CSS.goldHi, origin: 0.5 }));
    const b = new Button(scene, 0, bottom - 62, 320, 56, tr("CONFERIR AGORA"), async () => {
      b.setEnabled(false);
      await Billing.sync();
      if (b.active) reopen();
    }, { size: 20, style: "button" });
    m.add(b);
    return m;
  }

  if (!Billing.ready) {
    m.add(text(scene, 0, bottom - 116, tr("Loja indisponível agora. Precisa de internet."), { size: 17, color: CSS.redHi, origin: 0.5 }));
    const b = new Button(scene, 0, bottom - 62, 320, 56, tr("TENTAR DE NOVO"), async () => {
      b.setEnabled(false);
      await Billing.retry();
      if (b.active) reopen();
    }, { size: 20, style: "button" });
    m.add(b);
    return m;
  }

  const buy = new Button(scene, 0, bottom - 96, 360, 64, tr("COMPRAR · {0}", Billing.price), async () => {
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
  m.add(buy);
  // Restaurar: reinstalar já recupera sozinho; o botão serve para quem trocou de conta ou estava sem rede
  const rest = m.add(text(scene, 0, bottom - 38, tr("Restaurar compra"), { size: 16, color: CSS.muted, origin: 0.5 }));
  rest.setInteractive({ useHandCursor: true }).on("pointerup", async () => {
    rest.setText(tr("Conferindo…"));
    const ok = await Billing.sync();
    if (!rest.active) return;
    if (Billing.owned || Billing.pending) return reopen();
    rest.setText(ok ? tr("Nenhuma compra nesta conta Google") : tr("Sem conexão com a loja"));
  });
  return m;
}
