// Pedido de avaliação da Google Play (In-App Review, plugin @capacitor-community/in-app-review): o cartão
// nativo do Google, sem sair do jogo, no momento bom — de volta à Clareira logo depois de uma VITÓRIA, com a
// chegada calma (CampScene._arrivalOffer). Regras do Google que o jogo segue: nada de pergunta antes
// ("gostou do jogo?"), nada de prêmio pela nota, e quem decide se o cartão aparece é o Google (cota por
// pessoa): o jogo só pede, poucas vezes (REVIEW). Quem quiser avaliar quando quiser tem o atalho dos
// Créditos, que abre a página do jogo na loja.
import { REVIEW } from "../config.js";
import { Analytics } from "./Analytics.js";
import { isNative } from "./Platform.js";

const KEY = "guardiao_review_v1";
const DAY = 86400000;
const plugin = () => window.Capacitor?.Plugins?.InAppReview;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    s.asks = Array.isArray(s.asks) ? s.asks : [];
    return s;
  } catch {
    return { asks: [] };
  }
}
let state = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
};

export const Review = {
  available: () => isNative() && !!plugin(),
  // Fim de partida: só a volta de uma vitória pode pedir (depois de uma derrota, nunca)
  noteRun(won) {
    state.lastWon = !!won;
    save();
  },
  // Chegou a vez? Vitória na partida que acabou de terminar, jogo já conhecido, poucos pedidos e espaçados
  due(meta) {
    if (!this.available() || !state.lastWon) return false;
    if ((meta?.data?.runsPlayed ?? 0) < REVIEW.MIN_RUNS || state.asks.length >= REVIEW.MAX_ASKS) return false;
    const last = state.asks.at(-1) ?? 0;
    return Date.now() - last >= REVIEW.GAP_DAYS * DAY;
  },
  async ask(meta) {
    state.lastWon = false;
    state.asks.push(Date.now());
    save();
    const d = meta?.data ?? {};
    const wins = Object.values(d.winsByDifficulty || {}).reduce((a, b) => a + b, 0);
    Analytics.track("review_ask", { n: state.asks.length, runs: d.runsPlayed ?? 0, wins });
    try {
      await plugin().requestReview();
    } catch (e) {
      Analytics.track("review_fail", { msg: String(e?.message ?? e).slice(0, 80) });
    }
  },
  // Atalho pedido pelo jogador (Créditos): a página do jogo na loja. No app, o Capacitor entrega o endereço
  // externo ao Android, que abre a Google Play; no navegador, abre numa aba nova
  openStore(from = "?") {
    Analytics.track("review_store", { from });
    if (isNative()) window.location.href = REVIEW.STORE_URL;
    else window.open(REVIEW.STORE_URL, "_blank", "noopener");
  },
};
