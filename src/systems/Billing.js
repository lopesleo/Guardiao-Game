// Compras pela Play Store (Play Billing): o "Sem anúncios" (libera os prêmios dos anúncios sem assistir;
// ver AdService.noAds), os KITS de cosméticos (cada um libera 3 peças do Guarda-roupa; ver
// systems/Cosmetics.js) e os PACOTES (uma compra libera várias coisas: STORE.PACKS). Todos são produtos
// únicos (não consumíveis). Só no app Android. O que o jogador TEM sai da soma: o "sem anúncios" vem do
// produto dele OU de um pacote que o inclui; um estorno só tira o que nenhuma outra compra ainda dá.
//
//   Billing.install()      → no boot: lê os preços e confere o que a conta já comprou (reinstalar recupera)
//   Billing.buy()          → compra o "Sem anúncios": "ok" | "pending" | "cancelled" | "unavailable"
//   Billing.buyKit(kit)    → compra um kit (mesmos resultados)
//   Billing.buyPack(pack)  → compra um pacote (mesmos resultados)
//   Billing.sync()         → confere de novo na loja (botão "Restaurar compra" e a volta ao app)
//   Billing.notice         → aviso do "Sem anúncios": "approved" | "revoked" | null
//   Billing.kitNotice      → aviso de kit ou pacote: { kind: "approved" | "revoked", kit | pack } | null
//   (Título e Clareira mostram os avisos e chamam clearNotice/clearKitNotice; nunca no meio da partida)
//
// Sem servidor: a loja é a fonte da verdade e o jogo confere a cada abertura. Regras do Google seguidas,
// POR PRODUTO:
//  · RECONHECER a compra em até 3 dias (testador de licença: 3 a 5 MINUTOS), senão o Google estorna. O
//    jogo reconhece ele mesmo (autoAcknowledge do plugin desligado) e espera a resposta: o plugin fecha
//    a conexão com a loja a cada chamada e um reconhecimento "solto" podia ser cortado no meio. Se falhar,
//    tenta de novo sozinho (o sync() reconhece toda compra paga que ainda não foi reconhecida).
//  · Pagamento PENDENTE (boleto, Pix em análise, cartão de teste lento) não libera nada até virar
//    comprado. O plugin não avisa quando vira: com o app aberto, o jogo confere a loja a cada 20 s
//    enquanto houver pendente (antes só conferia na volta ao app: um pendente aprovado com o jogo
//    aberto ficaria sem reconhecer e o Google estornaria em minutos no teste de licença).
//  · Estorno/reembolso: a compra some da lista da loja → o jogo confere uma 2ª vez, tira só o que a
//    própria loja tinha dado e AVISA o jogador na próxima tela de menu. Até 18/10/2026 tirava calado: no
//    teste, a compra aceita e reconhecida foi estornada e o jogador só viu o item sumir.
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

const NO_ADS = STORE.NO_ADS;
const KIT_IDS = Object.values(STORE.KITS);
const PACK_IDS = Object.values(STORE.PACKS).map((p) => p.product);
const PRODUCTS = [NO_ADS, ...KIT_IDS, ...PACK_IDS];
const kitOf = Object.fromEntries(Object.entries(STORE.KITS).map(([kit, id]) => [id, kit]));
const packOf = Object.fromEntries(Object.entries(STORE.PACKS).map(([key, p]) => [p.product, { key, ...p }]));

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
// "Sem anúncios" no nível de cima (formato de antes, quem já comprou não perde nada):
//   { owned: veio da loja, pending: pagamento pendente, acked: a loja confirmou o reconhecimento,
//     grantedAt: quando liberou, notice: aviso ainda não mostrado ("approved"/"revoked") }
// kits: { <produto>: { owned, pending, acked, grantedAt } } · kitNotices: [{ kind, kit }]
let saved = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
}
const rec = (id) => (id === NO_ADS ? saved : ((saved.kits ??= {})[id] ??= {}));
// O que o produto liga está ativo? (o "sem anúncios" também pode vir de fora da loja)
const has = (id) => (id === NO_ADS ? AdService.noAds : !!rec(id).owned);
const packsOwned = () => Object.values(STORE.PACKS).filter((p) => rec(p.product).owned);
// "Sem anúncios" que a LOJA dá hoje: o produto dele ou um pacote que o inclui
const noAdsFromStore = () => !!rec(NO_ADS).owned || packsOwned().some((p) => p.noAds);

let state = { step: "idle", price: "", error: "", busy: false };
let kitPrices = {};
// Preço em número e moeda (para somar "separado sai por" no pacote): { produto: { value, currency } }
let priceNums = {};
let lastSync = 0,
  hooked = false,
  ackTries = 0,
  ackTimer = null;
let queue = Promise.resolve();
const call = (fn) => (queue = queue.then(fn, fn));

// O plugin rejeita com o motivo ora no code, ora na mensagem
const reason = (e) => `${e?.code ?? ""} ${e?.message ?? e ?? ""}`;
const paidOf = (list, id) => list.find((p) => p.productIdentifier === id && String(p.purchaseState) === PURCHASED);

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
  // ---- kits de cosméticos (kit = chave de STORE.KITS: "ipe", "paina"…)
  ownsKit: (kit) => !!STORE.KITS[kit] && (has(STORE.KITS[kit]) || packsOwned().some((p) => p.kits.includes(kit))),
  kitPending: (kit) => !!STORE.KITS[kit] && !!rec(STORE.KITS[kit]).pending && !has(STORE.KITS[kit]),
  // Preço que a loja devolveu ("R$ 9,90"); "" = produto ainda não criado no Play Console ou sem rede
  kitPrice: (kit) => kitPrices[STORE.KITS[kit]] ?? "",
  // ---- pacotes (pack = chave de STORE.PACKS: "fundador", "fundador_lite", "apoiador")
  ownsPack: (pack) => !!STORE.PACKS[pack] && has(STORE.PACKS[pack].product),
  packPending: (pack) => !!STORE.PACKS[pack] && !!rec(STORE.PACKS[pack].product).pending && !has(STORE.PACKS[pack].product),
  packPrice: (pack) => kitPrices[STORE.PACKS[pack]?.product] ?? "",
  // Quanto sairia comprar SEPARADO o que o pacote traz (null = a loja não deu os números ou moedas
  // diferentes) → { value, currency }, para a âncora de preço da Loja
  packPartsValue(pack) {
    const p = STORE.PACKS[pack];
    if (!p) return null;
    const ids = [...(p.noAds ? [NO_ADS] : []), ...p.kits.map((k) => STORE.KITS[k])];
    const parts = ids.map((id) => priceNums[id]);
    if (parts.some((x) => !x) || new Set(parts.map((x) => x.currency)).size !== 1) return null;
    return { value: parts.reduce((a, x) => a + x.value, 0), currency: parts[0].currency };
  },
  // "Você economiza N%": quanto o pacote sai abaixo da soma das partes (arredonda para baixo: nunca exagera)
  packSavePct(pack) {
    const parts = this.packPartsValue(pack),
      own = priceNums[STORE.PACKS[pack]?.product];
    if (!parts || !own || own.currency !== parts.currency || !(parts.value > own.value)) return null;
    return Math.floor((1 - own.value / parts.value) * 100);
  },
  // Fundador: comprou um pacote do Fundador (insígnia e a Clareira Ancestral)
  get isFounder() {
    return packsOwned().some((p) => p.founder);
  },
  buyPack(pack) {
    return STORE.PACKS[pack] ? this._buy(STORE.PACKS[pack].product) : Promise.resolve("unavailable");
  },
  get kitNotice() {
    return saved.kitNotices?.[0] ?? null;
  },
  clearKitNotice() {
    if (!saved.kitNotices?.length) return;
    saved.kitNotices.shift();
    save();
  },
  // Algum aviso esperando a próxima tela de menu
  get hasNotice() {
    return !!(saved.notice || saved.kitNotices?.length);
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
      const { product } = await call(() => NP.getProduct({ productIdentifier: NO_ADS, productType: "inapp" }));
      state.price = product?.priceString ?? "";
      if (product?.price != null) priceNums[NO_ADS] = { value: Number(product.price), currency: product.currencyCode };
      state.step = "ready";
    } catch (e) {
      // Sem rede ou produto ainda não criado no Play Console: a compra fica indisponível, mas a
      // conferência abaixo ainda recupera quem já comprou
      state.step = "error";
      state.error = reason(e).trim().slice(0, 80);
    }
    await this._kitPrices();
    await this.sync();
    if (hooked) return;
    hooked = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || Date.now() - lastSync < RESUME_MS) return;
      if (state.step === "error") this.retry();
      else this.sync();
    });
    setInterval(() => {
      const waiting = PRODUCTS.some((id) => rec(id).pending && !has(id));
      if (waiting && !document.hidden && !state.busy && Date.now() - lastSync >= PENDING_POLL_MS - 500) this.sync();
    }, PENDING_POLL_MS);
  },

  // Preços dos kits e pacotes (falha = sem preço → "Em breve"; não atrapalha o "Sem anúncios"). Produto
  // desativado no Play Console (fim da janela do Fundador) some daqui e a loja deixa de oferecer
  async _kitPrices() {
    try {
      const { products = [] } = await call(() => plugin().getProducts({ productIdentifiers: [...KIT_IDS, ...PACK_IDS], productType: "inapp" }));
      kitPrices = Object.fromEntries(products.filter((p) => p?.identifier).map((p) => [p.identifier, p.priceString ?? ""]));
      for (const p of products) if (p?.identifier && p.price != null) priceNums[p.identifier] = { value: Number(p.price), currency: p.currencyCode };
    } catch {
      kitPrices = {};
    }
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
    let all = await this._query();
    if (!all) return false; // falha na consulta NÃO é "não comprou": não tira nada de quem pagou
    // Sumiu uma compra que a loja tinha dado (fora da carência): confere de novo antes de tirar
    // (resposta velha do cache da loja logo depois de comprar, ou consulta pela metade)
    const vanished = PRODUCTS.some((id) => rec(id).owned && !paidOf(all, id) && Date.now() - (rec(id).grantedAt ?? 0) >= GRANT_GRACE_MS);
    if (vanished) {
      await wait(1500);
      all = await this._query();
      if (!all) return false;
    }
    for (const id of PRODUCTS) await this._reconcile(id, all);
    return true;
  },

  // Um produto: libera o que está pago, marca o pendente e tira (avisando) o que foi estornado
  async _reconcile(id, all) {
    const r = rec(id);
    const bought = paidOf(all, id);
    if (!bought && r.owned && Date.now() - (r.grantedAt ?? 0) < GRANT_GRACE_MS) return; // carência
    if (bought) {
      // Pendente que virou pago (boleto compensado, cartão de teste lento): avisa o jogador
      if (r.pending && !has(id)) this._notify(id, "approved");
      await this._grant(id, bought, "restore");
      return;
    }
    const wasPending = !!r.pending;
    r.pending = all.some((p) => p.productIdentifier === id && String(p.purchaseState) === PENDING);
    // Estornada/reembolsada (sumiu da loja): tira só o que a própria loja tinha dado, e avisa
    if (!r.pending && r.owned) {
      Analytics.track("iap_revoked", { product: id, acked: !!r.acked });
      r.owned = false;
      r.acked = false;
      this._notify(id, "revoked");
      // o "sem anúncios" só sai se NENHUMA outra compra ainda o dá (ex.: estornou o pacote, tem o produto)
      if ((id === NO_ADS || packOf[id]?.noAds) && !noAdsFromStore()) AdService.setNoAds(false);
    }
    if (wasPending && !r.pending) Analytics.track("iap_pending_end", { product: id });
    save();
  },

  _notify(id, kind) {
    if (id === NO_ADS) saved.notice = kind;
    else (saved.kitNotices ??= []).push(packOf[id] ? { kind, pack: packOf[id].key } : { kind, kit: kitOf[id] });
  },

  // Compras desta conta na loja (só as nossas); null = a consulta falhou
  async _query() {
    try {
      const { purchases = [] } = await call(() => plugin().getPurchases({ productType: "inapp" }));
      return purchases.filter((p) => PRODUCTS.includes(p.productIdentifier));
    } catch {
      return null;
    }
  },

  buy() {
    return this._buy(NO_ADS);
  },
  buyKit(kit) {
    return STORE.KITS[kit] ? this._buy(STORE.KITS[kit]) : Promise.resolve("unavailable");
  },

  async _buy(id) {
    if (!this.available() || state.busy) return "unavailable";
    if (has(id)) return "ok";
    state.busy = true;
    Analytics.track("iap_start", { product: id });
    let result;
    try {
      const p = await call(() => plugin().purchaseProduct({ productIdentifier: id, productType: "inapp", quantity: 1, autoAcknowledgePurchases: false }));
      result = String(p?.purchaseState) === PENDING ? "pending" : "ok";
      if (result === "ok") await this._grant(id, p, "buy");
    } catch (e) {
      const why = reason(e);
      if (/USER_CANCEL/i.test(why)) result = "cancelled";
      else if (/pending/i.test(why)) result = "pending";
      else if (/ALREADY_OWNED/i.test(why)) result = (await this.sync()) && has(id) ? "ok" : "unavailable";
      else {
        result = "unavailable";
        state.error = why.trim().slice(0, 80);
      }
    }
    if (result === "pending") {
      rec(id).pending = true;
      save();
    }
    state.busy = false;
    Analytics.track("iap_result", { product: id, result });
    return result;
  },

  // Libera e reconhece (sem reconhecer, o Google estorna: 3 dias, ou 3–5 min no teste de licença). Se
  // falhar, um sync() daqui a 15 s tenta de novo — a compra continua na lista como não reconhecida
  async _grant(id, p, how) {
    const r = rec(id);
    const first = !has(id);
    if (first || !r.owned) r.grantedAt = Date.now();
    r.owned = true;
    r.pending = false;
    if (p?.isAcknowledged) r.acked = true;
    save();
    if (id === NO_ADS || packOf[id]?.noAds) AdService.setNoAds(true);
    if (first) Analytics.track("iap_grant", { product: id, how });
    if (p?.isAcknowledged || !p?.purchaseToken) return;
    try {
      await call(() => plugin().acknowledgePurchase({ purchaseToken: p.purchaseToken }));
      r.acked = true;
      save();
      ackTries = 0;
    } catch (e) {
      Analytics.track("iap_ack_fail", { msg: reason(e).trim().slice(0, 80), try: ackTries + 1, product: id });
      if (ackTries++ < ACK_RETRIES && !ackTimer)
        ackTimer = setTimeout(() => {
          ackTimer = null;
          this.sync();
        }, ACK_RETRY_MS);
    }
  },
};
