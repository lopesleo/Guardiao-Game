// Serviço de anúncios — ponto ÚNICO por onde o jogo pede um anúncio premiado.
// Modelo "free-for-real": anúncio só quando o jogador escolhe, nunca na ação.
//
//   const ok = await AdService.rewarded("revive");  // true = recompensa liberada
//
// Provedores:
//  · "web" (navegador/site): não há anúncio — a recompensa é liberada direto
//    (vira um bônus gratuito na versão web). Com ?debug=1 simula uma espera.
//  · "admob" (app Android): entra no M5 (plugin @capacitor-community/admob).
//    Enquanto não estiver plugado, o app se comporta como "web".
// A compra "Remover anúncios" (noAds) também libera direto, sem assistir.
import { Analytics } from "./Analytics.js";
import { DEBUG } from "./Platform.js";
import { ADS } from "../config.js";

const KEY = "guardiao_ads_v1";

// Limites por ponto de anúncio: por partida e por dia (evita abuso e cansaço)
export const PLACEMENTS = {
  revive: { perRun: 1, perDay: 99, label: "Reviver" },
  double_chest: { perRun: 3, perDay: 20, label: "Dobrar baú" },
  double_coins: { perRun: 1, perDay: 20, label: "Dobrar moedas" },
  extra_reroll: { perRun: 3, perDay: 20, label: "Troca extra" },
  daily_chest: { perRun: 99, perDay: 1, label: "Baú diário" },
};

const today = () => new Date().toISOString().slice(0, 10);

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
let provider = null; // plugado no M5: { show(placement) → Promise<boolean> }

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
  // Plugado no M5 com o AdMob
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
    if (state.day !== today()) state = loadState();
    const run = runCounts[placement] || 0;
    const day = state.daily[placement] || 0;
    return run < cfg.perRun && day < cfg.perDay;
  },
  // true = pode dar a recompensa; false = cancelado/indisponível
  async rewarded(placement) {
    if (!this.canShow(placement)) return false;
    Analytics.track("ad_offer_accept", { placement });
    let ok = true;
    if (!state.noAds && provider) {
      try {
        ok = await provider.show(placement);
      } catch {
        ok = false;
      }
    } else if (DEBUG && !state.noAds) {
      await new Promise((r) => setTimeout(r, 600)); // simula o anúncio
    }
    if (ok) {
      runCounts[placement] = (runCounts[placement] || 0) + 1;
      state.daily[placement] = (state.daily[placement] || 0) + 1;
      save();
      Analytics.track("ad_reward", { placement, noAds: !!state.noAds, provider: provider ? "admob" : "web" });
    }
    return ok;
  },
};
