// Compras pela Play Store (Play Billing) — por enquanto só a "Sem anúncios" (compra única que libera os
// prêmios dos anúncios sem assistir; ver AdService.noAds). Só no app Android; no navegador não existe.
//
//   Billing.install()  → no boot: lê o preço e confere se a conta já comprou (reinstalar = recupera sozinho)
//   Billing.buy()      → "ok" | "pending" | "cancelled" | "unavailable"
//   Billing.sync()     → confere de novo na loja (botão "Restaurar compra" e a volta ao app)
//
// Sem servidor: a loja é a fonte da verdade e o jogo confere a cada abertura. Regras do Google seguidas:
//  · RECONHECER a compra em até 3 dias, senão o Google devolve o dinheiro. O jogo reconhece ele mesmo
//    (autoAcknowledge do plugin desligado) e espera a resposta: o plugin fecha a conexão com a loja a
//    cada chamada e um reconhecimento "solto" podia ser cortado no meio.
//  · Pagamento PENDENTE (boleto, Pix em análise, dinheiro em loteria) não libera nada até virar comprado;
//    quando vira, o próximo sync() libera e reconhece.
//  · Reembolso: a compra some da lista da loja → o jogo tira o "sem anúncios" (só o que veio da loja).
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

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
let saved = load(); // { owned: true se o "sem anúncios" veio da loja, pending: true se há pagamento pendente }
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
}

let state = { step: "idle", price: "", error: "", busy: false };
let lastSync = 0,
  hooked = false;
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
    const NP = plugin();
    let purchases;
    try {
      ({ purchases = [] } = await call(() => NP.getPurchases({ productType: "inapp" })));
    } catch {
      return false; // falha na consulta NÃO é "não comprou": não tira nada de quem pagou
    }
    const mine = purchases.filter((p) => p.productIdentifier === STORE.NO_ADS);
    const bought = mine.find((p) => String(p.purchaseState) === PURCHASED);
    if (bought) await this._grant(bought, "restore");
    else {
      const wasPending = !!saved.pending;
      saved.pending = mine.some((p) => String(p.purchaseState) === PENDING);
      // Reembolsada (sumiu da loja): tira só o que a própria loja tinha dado
      if (!saved.pending && saved.owned) {
        saved.owned = false;
        AdService.setNoAds(false);
        Analytics.track("iap_revoked", { product: STORE.NO_ADS });
      }
      if (wasPending && !saved.pending) Analytics.track("iap_pending_end", { product: STORE.NO_ADS });
      save();
    }
    return true;
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

  // Libera e reconhece (sem reconhecer, o Google devolve o dinheiro em 3 dias; se falhar agora, o
  // próximo sync() tenta de novo — a compra continua na lista como não reconhecida)
  async _grant(p, how) {
    const first = !AdService.noAds;
    saved.owned = true;
    saved.pending = false;
    save();
    AdService.setNoAds(true);
    if (first) Analytics.track("iap_grant", { product: STORE.NO_ADS, how });
    if (p?.isAcknowledged || !p?.purchaseToken) return;
    try {
      await call(() => plugin().acknowledgePurchase({ purchaseToken: p.purchaseToken }));
    } catch (e) {
      Analytics.track("iap_ack_fail", { msg: reason(e).trim().slice(0, 80) });
    }
  },
};
