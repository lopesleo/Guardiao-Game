// Chame um amigo: o convite com o link da página oficial (INVITE no config.js) e a origem em UTM, mandado pela
// folha de compartilhar do aparelho (Share.text: @capacitor/share no app, navigator.share no navegador). A página
// repassa a origem à Play no botão de instalar, então o Play Console (aquisição por campanha) e o Firebase
// (first_open) mostram quantas instalações vieram de convite. Sem folha (computador) ou se ela falhar, o texto com
// o link vai para a área de transferência. Fechar a folha sem escolher = "cancel".
// Sem prêmio por convite: a Play desaconselha instalação incentivada, e sem servidor não dá para saber quem chamou.
import { INVITE } from "../config.js";
import { Analytics } from "./Analytics.js";
import { Share } from "./Share.js";
import { tr, fmt, lang } from "../i18n/i18n.js";

// Link com a origem: from = de onde no jogo saiu (clareira, creditos, ranking); msg = qual texto foi junto
export function inviteUrl(from, msg = "geral", l = lang) {
  const q = new URLSearchParams({ utm_source: INVITE.SOURCE, utm_medium: INVITE.MEDIUM, utm_campaign: from, utm_content: msg });
  return `${INVITE.URL}${INVITE.PAGE[l] ?? ""}?${q}`;
}

// O texto que vai com o link. No ranking leva o feito do jogador (score = pontos; perigo = nome do maior Perigo
// vencido): um desafio chama mais que um convite. msg identifica o texto no utm_content e no Analytics
export function inviteText({ score = 0, perigo = "" } = {}) {
  if (score > 0) return { msg: "pontos", text: tr("Fiz {0} pontos no Guardião da Floresta. Duvido você passar!", fmt(score)) };
  if (perigo) return { msg: "perigo", text: tr("Zerei o Guardião da Floresta no Perigo {0}. Duvido você conseguir!", perigo) };
  return { msg: "geral", text: tr("Estou protegendo a mata no Guardião da Floresta: o Curupira, a Iara e o Saci contra a Podridão. Vem jogar também, é grátis!") };
}

let busy = false; // a folha já está aberta: o 2º toque não abre outra (o Android recusaria)

export const Invite = {
  // O botão da Clareira: só para quem já conhece o jogo
  shown: (data) => (data?.runsPlayed ?? 0) >= INVITE.MIN_RUNS,

  // Abre a folha de compartilhar ou copia o link. Devolve "shared" | "cancel" | "copied" | "fail" | "busy"
  async send(from, brag = {}) {
    if (busy) return "busy";
    busy = true;
    const { msg, text } = inviteText(brag);
    const url = inviteUrl(from, msg);
    const via = Share.textMode();
    let result = "fail",
      app = "";
    try {
      if (via !== "copy") ({ result, app } = await Share.text({ title: tr("Guardião da Floresta"), text, url, dialogTitle: tr("Chamar um amigo") }));
    } catch {
      result = "fail";
    }
    try {
      // computador sem folha de compartilhar, ou a folha deu erro: o convite vai para a área de transferência
      if (result === "fail") result = (await Share.copy(`${text} ${url}`)) ? "copied" : "fail";
    } finally {
      busy = false;
    }
    Analytics.track("invite", { from, result, msg, via, ...(app ? { app } : {}) });
    return result;
  },
};
