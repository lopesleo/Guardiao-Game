// Serviço de anúncios — ponto ÚNICO por onde o jogo pede um anúncio premiado.
// Modelo "free-for-real": anúncio só quando o jogador escolhe, nunca na ação.
//
//   const ok = await AdService.rewarded("revive");  // true = recompensa liberada
//
// Provedores:
//  · "web" (navegador/site): não há anúncio — a recompensa é liberada direto
//    (vira um bônus gratuito na versão web). Com ?debug=1 simula uma espera.
//  · "admob" (app Android): AdMobBridge registra o provider quando o SDK fica pronto.
// A compra "Remover anúncios" (noAds) também libera direto, sem assistir.
// O jogador sempre sabe o que aconteceu: "carregando" enquanto o anúncio vem e, se não vier
// ou for fechado antes do fim, um aviso (AdFeedback). O motivo fica em AdService.lastResult.
// Teste no navegador: ?debug=1&adsim=fail (sem anúncio) ou ?debug=1&adsim=cancel (fechou antes).
import { Analytics } from "./Analytics.js";
import { DEBUG, isNative } from "./Platform.js";
import { ADS } from "../config.js";
import { Clock } from "./Clock.js";
import { tr } from "../i18n/i18n.js";
import { AdFeedback } from "../ui/AdFeedback.js";

const KEY = "guardiao_ads_v1";

// Limites por ponto de anúncio: por partida e por dia (evita abuso e cansaço)
export const PLACEMENTS = {
  revive: { perRun: 1, perDay: 99, label: tr("Reviver") },
  extra_card: { perRun: 1, perDay: 20, label: tr("Mais uma carta") },
  build_speed: { perRun: 99, perDay: 3, label: tr("Adiantar obra") },
  double_coins: { perRun: 1, perDay: 20, label: tr("Dobrar moedas") },
  extra_reroll: { perRun: 1, perDay: 20, label: tr("Troca extra") },
  daily_chest: { perRun: 99, perDay: 1, label: tr("Baú diário") },
  extra_banish: { perRun: 1, perDay: 20, label: tr("Banir extra") },
};

const today = () => Clock.date().toISOString().slice(0, 10);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (s.day !== today()) s.day = today(), (s.daily = {});
    s.daily ||= {};
    return s;
  } catch {
    return { day: today(), daily: {} };
  }
}

let state = loadState();
let runCounts = {};
let provider = null; // AdMobBridge: { show(placement) → Promise<"ok" | "cancelled" | "unavailable" | "busy"> }

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export const AdService = {
  // Chave geral: desligado, nenhuma oferta aparece (ver ADS.ENABLED)
  get enabled() {
    return ADS.ENABLED || /[?&]ads=1(&|$)/.test(globalThis.location?.search ?? "");
  },
  get noAds() {
    return !!state.noAds;
  },
  setNoAds(v) {
    state.noAds = !!v;
    save();
  },
  // Ícone dos botões de prêmio: ▶ (vai abrir um anúncio) ou ★ (com "Sem anúncios", sai na hora)
  get icon() {
    return state.noAds ? "ico_star" : "ico_play";
  },
  // Como terminou o último pedido: "ok" | "cancelled" (fechou antes do fim) | "unavailable" | "busy"
  lastResult: null,
  // Registrado pelo AdMobBridge quando o SDK fica pronto
  setProvider(p) {
    provider = p;
  },
  // Chamar no início de cada partida (zera os limites por partida)
  newRun() {
    runCounts = {};
  },
  canShow(placement) {
    const cfg = PLACEMENTS[placement];
    if (!cfg || !this.enabled) return false;
    // No app, sem AdMob pronto (consentimento negado, sem rede, SDK falhou) NÃO há oferta nem bônus grátis
    if (isNative() && !provider && !state.noAds) return false;
    if (state.day !== today()) state = loadState();
    const run = runCounts[placement] || 0;
    const day = state.daily[placement] || 0;
    return run < cfg.perRun && day < cfg.perDay;
  },
  // true = pode dar a recompensa; false = cancelado/indisponível (motivo em lastResult)
  async rewarded(placement) {
    if (!this.canShow(placement)) {
      this.lastResult = "unavailable";
      return false;
    }
    Analytics.track("ad_offer_accept", { placement });
    let result = "ok";
    if (!state.noAds && (provider || DEBUG)) {
      AdFeedback.loading(true);
      try {
        result = provider ? await provider.show(placement) : await simulate();
      } catch {
        result = "unavailable";
      }
      AdFeedback.loading(false);
    }
    this.lastResult = result;
    if (result === "unavailable") AdFeedback.notice(tr("Anúncio indisponível agora. Tente mais tarde."));
    else if (result === "cancelled") AdFeedback.notice(tr("Assista até o fim para ganhar a recompensa."));
    if (result !== "ok") {
      Analytics.track("ad_fail", { placement, result });
      return false;
    }
    runCounts[placement] = (runCounts[placement] || 0) + 1;
    state.daily[placement] = (state.daily[placement] || 0) + 1;
    save();
    Analytics.track("ad_reward", { placement, noAds: !!state.noAds, provider: provider ? "admob" : "web" });
    return true;
  },
};

// Navegador com ?debug=1: finge a espera do anúncio (e, com ?adsim=, a falha ou o cancelamento)
async function simulate() {
  await new Promise((r) => setTimeout(r, 900));
  const sim = /[?&]adsim=(fail|cancel)/.exec(globalThis.location?.search ?? "")?.[1];
  return sim === "fail" ? "unavailable" : sim === "cancel" ? "cancelled" : "ok";
}
