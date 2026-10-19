// Compras pela Play Store (Play Billing) — por enquanto só a "Sem anúncios" (compra única que libera os
// prêmios dos anúncios sem assistir; ver AdService.noAds). Só no app Android; no navegador não existe.
//
//   Billing.install()  → no boot: lê o preço e confere se a conta já comprou (reinstalar = recupera sozinho)
//   Billing.buy()      → "ok" | "pending" | "cancelled" | "unavailable"
//   Billing.sync()     → confere de novo na loja (botão "Restaurar compra" e a volta ao app)
//   Billing.notice     → "approved" | "revoked" | null: aviso para o jogador (Título/Clareira mostram
//                        e chamam Billing.clearNotice(); nunca no meio da partida)
//
// Sem servidor: a loja é a fonte da verdade e o jogo confere a cada abertura. Regras do Google seguidas:
//  · RECONHECER a compra em até 3 dias (testador de licença: 3 a 5 MINUTOS), senão o Google estorna. O
//    jogo reconhece ele mesmo (autoAcknowledge do plugin desligado) e espera a resposta: o plugin fecha
//    a conexão com a loja a cada chamada e um reconhecimento "solto" podia ser cortado no meio. Se falhar,
//    tenta de novo sozinho (o sync() reconhece toda compra paga que ainda não foi reconhecida).
//  · Pagamento PENDENTE (boleto, Pix em análise, cartão de teste lento) não libera nada até virar
//    comprado. O plugin não avisa quando vira: com o app aberto, o jogo confere a loja a cada 20 s
//    enquanto houver pendente (antes só conferia na volta ao app: um pendente aprovado com o jogo
//    aberto ficaria sem reconhecer e o Google estornaria em minutos no teste de licença).
//  · Estorno/reembolso: a compra some da lista da loja → o jogo confere uma 2ª vez, tira o "sem
//    anúncios" (só o que veio da loja) e AVISA o jogador na próxima tela de menu. Até 18/10/2026 tirava
//    calado: no teste, a compra aceita e reconhecida foi estornada e o jogador só viu o item sumir.
// As chamadas ao plugin vão em FILA: cada uma recria o cliente da loja e fecharia a anterior.
import { STORE } from "../config.js";
import { isNative } from "./Platform.js";
import { AdService } from "./AdService.js";
import { Analytics } from "./Analytics.js";

const KEY = "guardiao_store_v1";
const plugin = () => window.Capacitor?.Plugins?.NativePurchases;
// Estados da compra no Play Billing (o plugin devolve como texto)
const PURCHASED = "1",
  PENDING = "2";
// Volta ao app: confere a loja no máximo a cada 30 s (um boleto pago enquanto o jogo estava fechado)
const RESUME_MS = 30000;
// Pendente com o app aberto: confere a loja a cada 20 s (o teste de licença estorna em 3–5 min)
const PENDING_POLL_MS = 20000;
// Reconhecimento que falhou: nova tentativa (via sync) depois de 15 s, até 8 vezes por abertura
const ACK_RETRY_MS = 15000,
  ACK_RETRIES = 8;
// Logo depois de liberar, a lista da loja pode ainda não trazer a compra: não tirar nada nesse meio-tempo
const GRANT_GRACE_MS = 120000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
// { owned: o "sem anúncios" veio da loja, pending: pagamento pendente, acked: a loja confirmou o
//   reconhecimento, grantedAt: quando liberou, notice: aviso ainda não mostrado ("approved"/"revoked") }
let saved = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
}

let state = { step: "idle", price: "", error: "", busy: false };
let lastSync = 0,
  hooked = false,
  ackTries = 0,
  ackTimer = null;
let queue = Promise.resolve();
const call = (fn) => (queue = queue.then(fn, fn));

// O plugin rejeita com o motivo ora no code, ora na mensagem
const reason = (e) => `${e?.code ?? ""} ${e?.message ?? e ?? ""}`;

export const Billing = {
  available: () => isNative() && !!plugin(),
  // A loja respondeu e o produto existe (dá para mostrar o preço e comprar)
  get ready() {
    return state.step === "ready";
  },
  get price() {
    return state.price;
  },
  get owned() {
    return AdService.noAds;
  },
  get pending() {
    return !!saved.pending && !AdService.noAds;
  },
  get busy() {
    return state.busy;
  },
  get notice() {
    return saved.notice ?? null;
  },
  clearNotice() {
    if (!saved.notice) return;
    delete saved.notice;
    save();
  },

  async install() {
    if (!this.available() || state.step !== "idle") return;
    state.step = "loading";
    const NP = plugin();
    try {
      const { isBillingSupported } = await call(() => NP.isBillingSupported());
      if (!isBillingSupported) {
        state.step = "unsupported";
        return;
      }
      const { product } = await call(() => NP.getProduct({ productIdentifier: STORE.NO_ADS, productType: "inapp" }));
      state.price = product?.priceString ?? "";
      state.step = "ready";
    } catch (e) {
      // Sem rede ou produto ainda não criado no Play Console: a compra fica indisponível, mas a
      // conferência abaixo ainda recupera quem já comprou
      state.step = "error";
      state.error = reason(e).trim().slice(0, 80);
    }
    await this.sync();
    if (hooked) return;
    hooked = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || Date.now() - lastSync < RESUME_MS) return;
      if (state.step === "error") this.retry();
      else this.sync();
    });
    setInterval(() => {
      if (saved.pending && !AdService.noAds && !document.hidden && !state.busy && Date.now() - lastSync >= PENDING_POLL_MS - 500) this.sync();
    }, PENDING_POLL_MS);
  },

  // Loja não respondeu (sem rede na abertura): tenta de novo (janela "Sem anúncios", volta ao app)
  async retry() {
    if (state.step === "error" || state.step === "unsupported") state.step = "idle";
    return this.install();
  },

  // Confere na loja o que esta conta Google comprou. false = não deu para conferir (nada muda)
  async sync() {
    if (!this.available()) return false;
    lastSync = Date.now();
    let mine = await this._query();
    if (!mine) return false; // falha na consulta NÃO é "não comprou": não tira nada de quem pagou
    const paid = (list) => list.find((p) => String(p.purchaseState) === PURCHASED);
    // Sumiu uma compra que a loja tinha dado: confere de novo antes de tirar (resposta velha do cache
    // da loja logo depois de comprar, ou consulta pela metade)
    if (!paid(mine) && saved.owned) {
      if (Date.now() - (saved.grantedAt ?? 0) < GRANT_GRACE_MS) return true;
      await wait(1500);
      mine = await this._query();
      if (!mine) return false;
    }
    const bought = paid(mine);
    if (bought) {
      // Pendente que virou pago (boleto compensado, cartão de teste lento): avisa o jogador
      if (saved.pending && !AdService.noAds) saved.notice = "approved";
      await this._grant(bought, "restore");
    } else {
      const wasPending = !!saved.pending;
      saved.pending = mine.some((p) => String(p.purchaseState) === PENDING);
      // Estornada/reembolsada (sumiu da loja): tira só o que a própria loja tinha dado, e avisa
      if (!saved.pending && saved.owned) {
        Analytics.track("iap_revoked", { product: STORE.NO_ADS, acked: !!saved.acked });
        saved.owned = false;
        saved.acked = false;
        saved.notice = "revoked";
        AdService.setNoAds(false);
      }
      if (wasPending && !saved.pending) Analytics.track("iap_pending_end", { product: STORE.NO_ADS });
      save();
    }
    return true;
  },

  // Compras desta conta na loja (só as do "sem anúncios"); null = a consulta falhou
  async _query() {
    try {
      const { purchases = [] } = await call(() => plugin().getPurchases({ productType: "inapp" }));
      return purchases.filter((p) => p.productIdentifier === STORE.NO_ADS);
    } catch {
      return null;
    }
  },

  async buy() {
    if (!this.available() || state.busy) return "unavailable";
    if (AdService.noAds) return "ok";
    state.busy = true;
    Analytics.track("iap_start", { product: STORE.NO_ADS });
    let result;
    try {
      const p = await call(() =>
        plugin().purchaseProduct({ productIdentifier: STORE.NO_ADS, productType: "inapp", quantity: 1, autoAcknowledgePurchases: false }),
      );
      result = String(p?.purchaseState) === PENDING ? "pending" : "ok";
      if (result === "ok") await this._grant(p, "buy");
    } catch (e) {
      const why = reason(e);
      if (/USER_CANCEL/i.test(why)) result = "cancelled";
      else if (/pending/i.test(why)) result = "pending";
      else if (/ALREADY_OWNED/i.test(why)) result = (await this.sync()) && AdService.noAds ? "ok" : "unavailable";
      else {
        result = "unavailable";
        state.error = why.trim().slice(0, 80);
      }
    }
    if (result === "pending") {
      saved.pending = true;
      save();
    }
    state.busy = false;
    Analytics.track("iap_result", { product: STORE.NO_ADS, result });
    return result;
  },

  // Libera e reconhece (sem reconhecer, o Google estorna: 3 dias, ou 3–5 min no teste de licença). Se
  // falhar, um sync() daqui a 15 s tenta de novo — a compra continua na lista como não reconhecida
  async _grant(p, how) {
    const first = !AdService.noAds;
    if (first || !saved.owned) saved.grantedAt = Date.now();
    saved.owned = true;
    saved.pending = false;
    if (p?.isAcknowledged) saved.acked = true;
    save();
    AdService.setNoAds(true);
    if (first) Analytics.track("iap_grant", { product: STORE.NO_ADS, how });
    if (p?.isAcknowledged || !p?.purchaseToken) return;
    try {
      await call(() => plugin().acknowledgePurchase({ purchaseToken: p.purchaseToken }));
      saved.acked = true;
      save();
      ackTries = 0;
    } catch (e) {
      Analytics.track("iap_ack_fail", { msg: reason(e).trim().slice(0, 80), try: ackTries + 1 });
      if (ackTries++ < ACK_RETRIES && !ackTimer)
        ackTimer = setTimeout(() => {
          ackTimer = null;
          this.sync();
        }, ACK_RETRY_MS);
    }
  },
};
