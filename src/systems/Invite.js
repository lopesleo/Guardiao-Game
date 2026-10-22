// Chame um amigo: o convite com o link da página oficial (INVITE no config.js) e a origem em UTM, mandado pela
// folha de compartilhar do aparelho. A página repassa a origem à Play no botão de instalar, então o Play Console
// (aquisição por campanha) e o Firebase (first_open) mostram quantas instalações vieram de convite.
//   · app Android: @capacitor/share (Intent do Android). Fechar a folha sem escolher = "cancel";
//   · navegador: navigator.share (celular, Edge/Chrome no Windows);
//   · sem nenhum dos dois (ou a folha falhou): o texto com o link vai para a área de transferência.
// Sem prêmio por convite: a Play desaconselha instalação incentivada, e sem servidor não dá para saber quem chamou.
import { INVITE } from "../config.js";
import { Analytics } from "./Analytics.js";
import { isNative } from "./Platform.js";
import { tr, fmt, lang } from "../i18n/i18n.js";

const plugin = () => (isNative() ? window.Capacitor?.Plugins?.Share ?? null : null);
// O Capacitor rejeita com "Share canceled" quando a folha fecha sem escolha; o navegador, com AbortError
const isCancel = (e) => e?.name === "AbortError" || /cancel/i.test(String(e?.message ?? e ?? ""));

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

// Área de transferência: a API nova e, se ela recusar (WebView antiga, sem foco), o jeito antigo
async function copy(s) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let busy = false; // a folha já está aberta: o 2º toque não abre outra (o Android recusaria)

export const Invite = {
  // O botão da Clareira: só para quem já conhece o jogo
  shown: (data) => (data?.runsPlayed ?? 0) >= INVITE.MIN_RUNS,
  // Como este aparelho manda: "native" (folha do Android), "web" (folha do sistema) ou "copy"
  mode: () => (plugin() ? "native" : typeof navigator !== "undefined" && navigator.share ? "web" : "copy"),

  // Abre a folha de compartilhar ou copia o link. Devolve "shared" | "cancel" | "copied" | "fail" | "busy"
  async send(from, brag = {}) {
    if (busy) return "busy";
    busy = true;
    const { msg, text } = inviteText(brag);
    const url = inviteUrl(from, msg);
    const title = tr("Guardião da Floresta");
    const via = this.mode();
    let result = "fail",
      app = "";
    try {
      if (via === "native") {
        try {
          const r = await plugin().share({ title, text, url, dialogTitle: tr("Chamar um amigo") });
          result = "shared";
          app = String(r?.activityType ?? "").slice(0, 60); // o app escolhido (com.whatsapp…), quando o Android diz
        } catch (e) {
          result = isCancel(e) ? "cancel" : "fail";
        }
      } else if (via === "web") {
        try {
          await navigator.share({ title, text, url });
          result = "shared";
        } catch (e) {
          result = isCancel(e) ? "cancel" : "fail";
        }
      }
      // computador sem folha de compartilhar, ou a folha deu erro: o convite vai para a área de transferência
      if (result === "fail") result = (await copy(`${text} ${url}`)) ? "copied" : "fail";
    } finally {
      busy = false;
    }
    Analytics.track("invite", { from, result, msg, via, ...(app ? { app } : {}) });
    return result;
  },
};
