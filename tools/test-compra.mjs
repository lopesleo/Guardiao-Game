// Teste das compras (systems/Billing.js: "Sem anúncios", kits e pacotes) num navegador de verdade, com uma Play Store
// FALSA (window.Capacitor.Plugins.NativePurchases) que dá para mandar: aprovar, deixar pendente,
// estornar, falhar o reconhecimento, falhar a consulta. Nasceu do teste de 18/10/2026: a compra foi
// aceita e reconhecida, depois estornada, e o jogo tirou o "sem anúncios" sem avisar o jogador.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:compra                    (ou: node tools/test-compra.mjs)
//
// Variáveis: ONLY=nome,nome (só esses cenários)  LAB_URL=… (servidor já rodando)  SHOTS=pasta
// Leva ~2 min: dois cenários esperam o relógio de verdade do jogo (pendente conferido a cada 20 s,
// nova tentativa do reconhecimento em 15 s). Sai com código 1 se algo falhar.
// Armadilhas: o Billing só liga com isNativePlatform() verdadeiro; o AdMob falso evita que o
// AdService trave esperando o SDK; a janela de aviso aparece pelo update() do Título.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { startLabServer } from "./lab-server.mjs";
import { COSMETICS } from "../src/config.js";

// Loja de cosméticos ligada no app (COSMETICS.SHOP): o botão do título vira LOJA e a ★ da Clareira só some
// com tudo comprado (Fundador + Sem anúncios); desligada, os dois são só o "Sem anúncios"
const LOJA = COSMETICS.ENABLED && COSMETICS.SHOP;

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SHOTS = process.env.SHOTS || "";
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url;
const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});

// Roda no navegador antes do jogo: a loja falsa. store.list = compras da conta na loja
function fakeStore(cfg) {
  const S = (window.__store = Object.assign({ list: [], buy: "ok", ackFail: 0, queryFail: 0, emptyOnce: 0, calls: [] }, cfg.store));
  for (const [k, v] of Object.entries(cfg.local || {})) localStorage.setItem(k, JSON.stringify(v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Cada produto tem o seu token ("Sem anúncios" = tok-1, kit_ipe = tok-kit_ipe…)
  const tok = (id) => (id === "sem_anuncios" ? "tok-1" : "tok-" + id);
  const P = (state, id = "sem_anuncios") => ({ productIdentifier: id, purchaseState: state, purchaseToken: tok(id), isAcknowledged: false });
  const put = (p) => (S.list = [...S.list.filter((q) => q.productIdentifier !== p.productIdentifier), p]);
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    Plugins: {
      AdMob: {
        requestConsentInfo: async () => ({ status: "NOT_REQUIRED", privacyOptionsRequirementStatus: "NOT_REQUIRED" }),
        initialize: async () => {},
        addListener: async () => ({ remove() {} }),
        prepareRewardVideoAd: async () => {},
        showRewardVideoAd: async () => {},
      },
      // Avaliação da Google Play (Review.js): só conta os pedidos
      InAppReview: {
        requestReview: async () => void S.calls.push("review"),
      },
      NativePurchases: {
        isBillingSupported: async () => ({ isBillingSupported: true }),
        getProduct: async () => ({ product: { identifier: "sem_anuncios", priceString: "R$ 14,90", price: 14.9, currencyCode: "BRL" } }),
        // Kits e pacotes (só os que o cenário "criou no Play Console", em store.kits), com os preços
        // planejados (docs/COSMETICOS.md): kit R$ 4,90, Fundador R$ 19,90, Fundador sem o Sem anúncios R$ 9,90
        getProducts: async (o) => {
          S.calls.push("products");
          const PRICE = { pacote_fundador: 19.9, pacote_fundador_kits: 9.9, pacote_apoiador: 24.9 };
          const brl = (v) => "R$ " + v.toFixed(2).replace(".", ",");
          return { products: (o.productIdentifiers || []).filter((id) => (S.kits ?? []).includes(id)).map((id) => ({ identifier: id, priceString: brl(PRICE[id] ?? 4.9), price: PRICE[id] ?? 4.9, currencyCode: "BRL" })) };
        },
        getPurchases: async () => {
          S.calls.push("query");
          await wait(40);
          if (S.queryFail > 0) {
            S.queryFail--;
            throw Object.assign(new Error("Failed to query purchases"), { code: "QUERY_PURCHASES_FAILED" });
          }
          if (S.emptyOnce > 0) {
            S.emptyOnce--;
            return { purchases: [] };
          }
          return { purchases: S.list.map((p) => ({ ...p })) };
        },
        purchaseProduct: async (o) => {
          S.calls.push("buy:" + (o.autoAcknowledgePurchases === false ? "manual" : "auto") + (o.productIdentifier === "sem_anuncios" ? "" : ":" + o.productIdentifier));
          await wait(80);
          if (S.buy === "pending") {
            put(P("2", o.productIdentifier));
            throw new Error("Purchase is pending");
          }
          if (S.buy === "cancel") throw Object.assign(new Error("Purchase is not purchased"), { code: "USER_CANCELED" });
          put(P("1", o.productIdentifier));
          return P("1", o.productIdentifier);
        },
        acknowledgePurchase: async (o) => {
          S.calls.push("ack:" + o.purchaseToken);
          await wait(40);
          if (S.ackFail > 0) {
            S.ackFail--;
            throw new Error("Failed to acknowledge purchase: SERVICE_UNAVAILABLE");
          }
          S.list = S.list.map((p) => (p.purchaseToken === o.purchaseToken ? { ...p, isAcknowledged: true } : p));
        },
      },
    },
  };
}

let failures = 0;
const check = (ok, what, extra = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${what}${extra ? "  " + extra : ""}`);
  return ok;
};

const OLD = Date.now() - 86400000; // liberado ontem (fora da carência logo depois da compra)
const OWNED = { guardiao_store_v1: { owned: true, acked: true, grantedAt: OLD }, guardiao_ads_v1: { noAds: true } };
const PAID = { productIdentifier: "sem_anuncios", purchaseState: "1", purchaseToken: "tok-1", isAcknowledged: true };
// Tudo "criado no Play Console" (kits e pacotes)
const ALL = ["kit_ipe", "kit_paineira", "kit_coruja", "kit_junina", "pacote_fundador", "pacote_fundador_kits", "pacote_apoiador"];
const PACK_OWNED = { pacote_fundador: { owned: true, acked: true, grantedAt: OLD } };

// Volta à Clareira (o.fromRun = como depois de uma partida) com a chegada calma: sem revelação, fala de abertura
// (o.say liga a fala) nem presente do dia. Espera passar a hora da oferta do Sem anúncios (2,6 s do relógio do
// jogo) e devolve o título da janela aberta, ou null
async function camp(t, o = {}) {
  await t.page.evaluate(async (o) => {
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const { pendingReveals } = await import("/src/systems/Reveal.js");
    const { dayKey } = await import("/src/systems/Daily.js");
    const m = new MetaProgression();
    const d = m.data;
    d.runsPlayed = Math.max(d.runsPlayed || 0, 3);
    d.campIntroSeen = !o.say;
    for (const r of pendingReveals(d)) d.revealed.push(r.id);
    for (const id of o.reveal || []) if (!d.revealed.includes(id)) d.revealed.push(id);
    d.streak = { last: dayKey(), count: 1 };
    m._save();
    const g = window.game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    // a instância da cena é reaproveitada: conta o tempo DESTA visita (o "create" sobrevive ao stop). Soma os
    // passos do jogo, não o relógio: no navegador lento cada passo é cortado em 200 ms e os timers atrasam
    const c = g.scene.getScene("CampScene");
    c.__el = null;
    c.events.once("create", () => {
      c.__el = 0;
      const tick = (_, dt) => (c.__el += dt);
      c.events.on("update", tick);
      c.events.once("shutdown", () => c.events.off("update", tick));
    });
    g.scene.start("CampScene", { fromRun: !!o.fromRun });
  }, o);
  await t.page.waitForFunction(() => {
    const c = window.game.scene.getScene("CampScene");
    return c.__el != null && c.sys.isActive() && c.__el > 3000;
  }, null, { timeout: 120000, polling: 200 });
  return t.page.evaluate(() => window.game.scene.getScene("CampScene")._modals.at(-1)?.titleText?.text ?? null);
}
const adsState = (t) => t.page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_ads_v1") || "{}"));
const nudgeEvents = (t) => t.page.evaluate(() => window.guardiaoAnalytics.recent().filter((e) => e.name === "noads_nudge").map((e) => e.action));
const tapModal = (t, label) => t.page.evaluate((label) => void window.game.scene.getScene("CampScene")._modals.at(-1).body.list.find((o) => o.label?.text === label).onClick(), label);

const SCENARIOS = {
  // Compra normal: libera na hora e reconhece à mão (o automático do plugin pode ser cortado)
  async compra(t) {
    await t.billing("buy");
    const s = await t.state();
    check(s.noAds && s.saved.owned, "comprou → sem anúncios ativo", JSON.stringify(s.saved));
    check(s.calls.includes("buy:manual"), "pede a compra com o reconhecimento automático desligado", s.calls.join(" "));
    check(s.calls.includes("ack:tok-1") && s.saved.acked, "reconhece a compra (sem isso o Google estorna)");
    check(!s.notice, "sem aviso extra (a própria janela da compra agradece)");
  },
  // O reconhecimento falha na hora: tenta de novo sozinho, sem o jogador fazer nada
  async reconhecimento(t) {
    await t.set({ ackFail: 1 });
    await t.billing("buy");
    check((await t.state()).noAds, "libera mesmo com o reconhecimento falhando");
    await t.page.waitForFunction(() => window.__store.list[0]?.isAcknowledged, null, { timeout: 30000 }).catch(() => {});
    const s = await t.state();
    check(s.calls.filter((c) => c.startsWith("ack")).length >= 2 && s.saved.acked, "tenta reconhecer de novo sozinho e consegue", s.calls.join(" "));
  },
  // Pendente que o Google aprova com o jogo ABERTO (sem sair e voltar ao app): sem conferir sozinho,
  // a compra ficaria sem reconhecer e o Google estornaria
  async pendente(t) {
    await t.set({ buy: "pending" });
    const r = await t.billing("buy");
    let s = await t.state();
    check(r === "pending" && !s.noAds && s.saved.pending, "pagamento pendente não libera nada ainda", `resultado=${r}`);
    await t.page.evaluate(() => (window.__store.list = [{ productIdentifier: "sem_anuncios", purchaseState: "1", purchaseToken: "tok-1", isAcknowledged: false }]));
    await t.page.waitForFunction(() => window.__store.list[0]?.isAcknowledged, null, { timeout: 30000 }).catch(() => {});
    s = await t.state();
    check(s.noAds && s.saved.acked, "aprovado com o app aberto → libera e reconhece em até 20 s", s.calls.join(" "));
    await t.noticeShown(/PAGAMENTO APROVADO/, "pendente");
  },
  // Estorno: tira o que a loja deu e AVISA
  async estorno(t) {
    await t.boot({ local: OWNED, store: { list: [] } });
    await t.page.waitForFunction(() => window.__store.calls.filter((c) => c === "query").length >= 2, null, { timeout: 20000 }).catch(() => {});
    const s = await t.state();
    check(!s.noAds && !s.saved.owned, "compra sumiu da loja → sem anúncios desligado", JSON.stringify(s.saved));
    check(s.calls.filter((c) => c === "query").length >= 2, "confere 2 vezes antes de tirar");
    await t.noticeShown(/COMPRA ESTORNADA/, "estorno");
    const rotulo = LOJA ? "LOJA" : "SEM ANÚNCIOS";
    const btn = await t.page.evaluate((r) => window.game.scene.isActive("TitleScene") && !!window.game.scene.getScene("TitleScene").children.list.find((o) => o.label?.text === r), rotulo);
    check(btn, `o botão ${rotulo} está no título depois do aviso`);
    check(!(await t.state()).notice, "o aviso aparece uma vez só");
  },
  // O caso de 18/10: compra ACEITA e reconhecida; minutos depois, estorno (Pedidos no Play Console ou
  // pedido do cliente); o jogador sai e volta ao app → o jogo tem de tirar E avisar
  async aceitaEstornada(t) {
    await t.billing("buy");
    let s = await t.state();
    check(s.noAds && s.saved.acked, "compra aceita e reconhecida");
    await t.page.evaluate(() => (window.__store.list = []));
    // 5 min depois (passa a carência e o intervalo da volta ao app) e a volta ao app de verdade
    await t.page.evaluate(() => {
      const real = Date.now;
      Date.now = () => real() + 5 * 60000;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await t.page.waitForFunction(() => window.__store.calls.filter((c) => c === "query").length >= 3, null, { timeout: 15000 }).catch(() => {});
    await t.page.waitForTimeout(500);
    s = await t.state();
    check(!s.noAds && !s.saved.owned, "a volta ao app percebe o estorno e tira o sem anúncios", s.calls.join(" "));
    await t.noticeShown(/COMPRA ESTORNADA/, "aceita_estornada");
  },
  // Estorno visto na Clareira: o aviso aparece lá e a estrela da loja volta
  async clareira(t) {
    await t.boot({ local: { ...OWNED, guardiao_store_v1: { owned: true, acked: true, grantedAt: OLD } }, store: { list: [PAID] } });
    await t.page.evaluate(() => {
      const ts = window.game.scene.getScene("TitleScene");
      ts.meta.data.runsPlayed = 3;
      ts.scene.start("CampScene");
    });
    await t.page.waitForFunction(() => window.game.scene.isActive("CampScene") && window.game.scene.getScene("CampScene").player && !window.game.scene.getScene("CampScene")._cutscene, null, { timeout: 60000 });
    const estrela = await t.page.evaluate(() => window.game.scene.getScene("CampScene").noAdsBtn?.visible);
    if (LOJA) check(estrela, "com só o Sem anúncios, a ★ continua (ainda há kits e pacotes na Loja)");
    else check(!estrela, "com a compra, a estrela da loja fica escondida");
    await t.page.evaluate(() => (window.__store.list = []));
    await t.billing("sync");
    await t.noticeShown(/COMPRA ESTORNADA/, "clareira", "CampScene");
    await t.page.waitForTimeout(300);
    check(await t.page.evaluate(() => window.game.scene.getScene("CampScene").noAdsBtn?.visible), "a estrela da loja volta na Clareira");
  },
  // Lista vazia por um instante (cache da loja): não tira nada de quem pagou
  async falsoAlarme(t) {
    await t.boot({ local: OWNED, store: { list: [PAID], emptyOnce: 1 } });
    await t.page.waitForTimeout(4000);
    const s = await t.state();
    check(s.noAds && s.saved.owned && !s.notice, "uma resposta vazia isolada não tira a compra", s.calls.join(" "));
  },
  // A consulta falha (sem rede): não é "não comprou"
  async semRede(t) {
    await t.boot({ local: OWNED, store: { list: [], queryFail: 99 } });
    await t.page.waitForTimeout(3000);
    const s = await t.state();
    check(s.noAds && s.saved.owned && !s.notice, "consulta falhando não tira a compra");
  },
  // ------------------------------------------------ kits de cosméticos (cada kit = um produto único)
  // Compra de kit: preço da loja, libera as peças do Guarda-roupa e reconhece; não mexe no "Sem anúncios"
  async kitCompra(t) {
    let s = await t.state();
    check(s.kits.ipe.price === "R$ 4,90" && s.kits.paina.price === "", "preço do kit vem da loja (kit não criado = sem preço → Em breve)", JSON.stringify(s.kits));
    const r = await t.page.evaluate(async () => (await import("/src/systems/Billing.js")).Billing.buyKit("ipe"));
    s = await t.state();
    check(r === "ok" && s.kits.ipe.owns && s.kits.ipe.piece, "comprou o kit → as peças do kit ficam suas", `resultado=${r}`);
    check(s.calls.includes("buy:manual:kit_ipe") && s.calls.includes("ack:tok-kit_ipe"), "pede o kit certo e reconhece a compra dele", s.calls.join(" "));
    check(!s.noAds && !s.kits.paina.owns, "comprar um kit não libera o Sem anúncios nem outro kit");
  },
  // Estorno de KIT (o caso de 18/10, agora num kit): tira só o kit, avisa, e o Sem anúncios continua
  async kitEstorno(t) {
    await t.boot({ local: { ...OWNED, guardiao_store_v1: { owned: true, acked: true, grantedAt: OLD, kits: { kit_ipe: { owned: true, acked: true, grantedAt: OLD } } } }, store: { list: [PAID], kits: ["kit_ipe"] } });
    await t.page.waitForFunction(() => window.__store.calls.filter((c) => c === "query").length >= 2, null, { timeout: 20000 }).catch(() => {});
    const s = await t.state();
    check(!s.kits.ipe.owns && !s.kits.ipe.piece, "kit sumiu da loja → as peças dele saem do Guarda-roupa", JSON.stringify(s.saved.kits));
    check(s.noAds && s.saved.owned, "o Sem anúncios (ainda pago) continua");
    await t.noticeShown(/COMPRA ESTORNADA/, "kit_estorno");
  },
  // Kit pendente aprovado com o jogo ABERTO: libera, reconhece e avisa
  async kitPendente(t) {
    await t.set({ buy: "pending" });
    const r = await t.page.evaluate(async () => (await import("/src/systems/Billing.js")).Billing.buyKit("paina"));
    let s = await t.state();
    check(r === "pending" && s.kits.paina.pending && !s.kits.paina.owns, "kit pendente não libera nada ainda", `resultado=${r}`);
    await t.page.evaluate(() => (window.__store.list = [{ productIdentifier: "kit_paineira", purchaseState: "1", purchaseToken: "tok-kit_paineira", isAcknowledged: false }]));
    await t.page.waitForFunction(() => window.__store.list[0]?.isAcknowledged, null, { timeout: 30000 }).catch(() => {});
    s = await t.state();
    check(s.kits.paina.owns, "aprovado com o app aberto → kit liberado e reconhecido em até 20 s", s.calls.join(" "));
    await t.noticeShown(/PAGAMENTO APROVADO/, "kit_aprovado");
  },
  // ------------------------------------------------ pacotes (Fundador = Sem anúncios + 4 kits + exclusivos)
  // Compra do pacote: tudo de uma vez e reconhece o pacote; preço, "separado sai por" e economia da loja
  async pacoteCompra(t) {
    let s = await t.state();
    check(s.pack.price === "R$ 19,90" && Math.abs((s.pack.parts?.value ?? 0) - 34.5) < 0.01 && s.pack.pct === 42, "preço do pacote, soma das partes (R$ 34,50) e economia (42%) vêm da loja", JSON.stringify(s.pack));
    const r = await t.page.evaluate(async () => (await import("/src/systems/Billing.js")).Billing.buyPack("fundador"));
    s = await t.state();
    check(r === "ok" && s.noAds && s.pack.allKits && s.pack.founder, "comprou o pacote → Sem anúncios, os 4 kits e o Fundador", `resultado=${r}`);
    check(s.calls.includes("buy:manual:pacote_fundador") && s.calls.includes("ack:tok-pacote_fundador"), "pede o pacote certo e reconhece a compra dele", s.calls.join(" "));
    check(!s.saved.owned, "o Sem anúncios avulso continua não comprado (quem dá é o pacote)");
    await t.billing("sync");
    s = await t.state();
    check(s.noAds && s.pack.founder && !s.notice && !s.kitNotice, "a conferência seguinte não tira nada (o Sem anúncios vem do pacote)");
  },
  // Quem já tem o Sem anúncios vê o pacote sem ele: só os kits e os exclusivos
  async pacoteLite(t) {
    const r = await t.page.evaluate(async () => (await import("/src/systems/Billing.js")).Billing.buyPack("fundador_lite"));
    const s = await t.state();
    check(r === "ok" && s.pack.allKits && s.pack.founder && !s.noAds, "pacote sem o Sem anúncios → kits e Fundador; os anúncios continuam", `resultado=${r}`);
  },
  // Estorno do pacote: tira tudo o que ele deu e avisa
  async pacoteEstorno(t) {
    await t.boot({ local: { guardiao_ads_v1: { noAds: true }, guardiao_store_v1: { kits: PACK_OWNED } }, store: { list: [], kits: ALL } });
    await t.page.waitForFunction(() => window.__store.calls.filter((c) => c === "query").length >= 2, null, { timeout: 20000 }).catch(() => {});
    const s = await t.state();
    check(!s.noAds && !s.pack.founder && !s.pack.anyKit, "pacote sumiu da loja → saem o Sem anúncios, os kits e o Fundador", JSON.stringify(s.saved));
    await t.noticeShown(/COMPRA ESTORNADA/, "pacote_estorno");
  },
  // Estorno do pacote de quem TAMBÉM pagou o Sem anúncios avulso: esse continua
  async pacoteEstornoSemAnuncios(t) {
    await t.boot({ local: { guardiao_ads_v1: { noAds: true }, guardiao_store_v1: { owned: true, acked: true, grantedAt: OLD, kits: PACK_OWNED } }, store: { list: [PAID], kits: ALL } });
    await t.page.waitForFunction(() => window.__store.calls.filter((c) => c === "query").length >= 2, null, { timeout: 20000 }).catch(() => {});
    const s = await t.state();
    check(s.noAds && s.saved.owned && !s.pack.founder && !s.pack.anyKit, "só o pacote sai; o Sem anúncios pago à parte continua", JSON.stringify(s.saved));
    await t.noticeShown(/COMPRA ESTORNADA/, "pacote_estorno_sem_anuncios");
  },
  // ------------------------------------------------ oferta do "Sem anúncios" na volta à Clareira (ADS.NUDGE_AT)
  // 8 anúncios assistidos → aparece; CONHECER abre a Loja; na marca de 25 de novo; depois nunca mais
  async oferta(t) {
    await t.boot({ local: { guardiao_ads_v1: { watched: 8 } } });
    let tit = await camp(t, { fromRun: true });
    check(tit === "SEM ANÚNCIOS", "8 anúncios assistidos → a oferta aparece na volta de uma partida", tit ?? "(não apareceu)");
    if (SHOTS && tit) await t.page.screenshot({ path: `${SHOTS}/compra_oferta.png` });
    await tapModal(t, "CONHECER");
    await t.page.waitForTimeout(600);
    const loja = await t.page.evaluate(() => window.game.scene.getScene("CampScene")._modals.at(-1)?.titleText?.text ?? null);
    check(loja === (LOJA ? "LOJA" : "SEM ANÚNCIOS"), `CONHECER abre ${LOJA ? "a Loja" : "o Sem anúncios"}`, loja ?? "(nada)");
    const from = await t.page.evaluate(() => window.guardiaoAnalytics.recent().find((e) => e.name === "shop_view" || e.name === "iap_view")?.from);
    check((await nudgeEvents(t)).join() === "show,open" && from === "nudge", "registra mostrar → abrir, e a loja sabe que veio da oferta", `${(await nudgeEvents(t)).join()} · from=${from}`);
    tit = await camp(t, { fromRun: true });
    check(tit == null, "na volta seguinte, antes da marca de 25: não repete", tit ?? "");
    const st = await adsState(t);
    await t.page.close();
    await t.boot({ local: { guardiao_ads_v1: { ...st, watched: 25 } } });
    tit = await camp(t, { fromRun: true });
    check(tit === "SEM ANÚNCIOS", "25 anúncios → a segunda (e última) oferta", tit ?? "(não apareceu)");
    if (tit) await tapModal(t, "AGORA NÃO");
    await t.page.waitForTimeout(500);
    check((await nudgeEvents(t)).join() === "show,later", "AGORA NÃO fica registrado", (await nudgeEvents(t)).join());
    const st2 = await adsState(t);
    await t.page.close();
    await t.boot({ local: { guardiao_ads_v1: { ...st2, watched: 80 } } });
    tit = await camp(t, { fromRun: true });
    check(tit == null && st2.nudges === 2, "depois das duas, nunca mais", `${tit ?? ""} nudges=${st2.nudges}`);
  },
  // Só na chegada calma de uma partida; passou das duas marcas de uma vez → uma oferta só
  async ofertaRegras(t) {
    await t.boot({ local: { guardiao_ads_v1: { watched: 30 } } });
    let tit = await camp(t, { fromRun: false });
    check(tit == null, "entrando pelo título (sem partida): nada");
    tit = await camp(t, { fromRun: true, say: true });
    check(tit == null, "com a fala da Anciã na tela: espera a próxima volta");
    tit = await camp(t, { fromRun: true });
    const st = await adsState(t);
    check(tit === "SEM ANÚNCIOS" && st.nudges === 2, "passou das duas marcas de uma vez → uma oferta só", `${tit ?? "(não apareceu)"} nudges=${st.nudges}`);
  },
  // Quem já tem o Sem anúncios nunca vê a oferta
  async ofertaComprado(t) {
    await t.boot({ local: { ...OWNED, guardiao_ads_v1: { noAds: true, watched: 30 } }, store: { list: [PAID] } });
    const tit = await camp(t, { fromRun: true });
    check(tit == null, "com o Sem anúncios: nenhuma oferta", tit ?? "");
  },
  // Baú do dia: depois do grátis, o botão diz que o segundo é com anúncio (e a oferta conta uma vez por visita)
  async bauAnuncio(t) {
    await t.boot();
    await camp(t, { reveal: ["board", "chest"] });
    const r = await t.page.evaluate(() => {
      const c = window.game.scene.getScene("CampScene");
      const antes = c._chestVerb();
      c._openDailyChest();
      const depois = [c._chestVerb(), c._chestVerb()];
      const shows = window.guardiaoAnalytics.recent().filter((e) => e.name === "ad_offer_show" && e.placement === "daily_chest").length;
      return { antes, depois, shows };
    });
    check(r.antes === "ABRIR", "com o baú grátis: ABRIR", r.antes);
    check(r.depois[0] === "MAIS UM · ANÚNCIO", "depois dele: o botão avisa que é com anúncio", r.depois[0]);
    check(r.shows === 1, "a oferta do baú conta uma vez por visita", `shows=${r.shows}`);
  },
  // ------------------------------------------------ pedido de avaliação da Google Play (REVIEW)
  // Volta de uma vitória: pede a avaliação e NÃO mostra a oferta do Sem anúncios na mesma chegada; na volta
  // seguinte (sem vitória nova) a oferta aparece; vitória nova antes de 60 dias: não pede de novo
  async avaliacao(t) {
    await t.boot({ local: { guardiao_review_v1: { lastWon: true }, guardiao_ads_v1: { watched: 8 } } });
    let tit = await camp(t, { fromRun: true });
    let s = await t.state();
    const ask = await t.page.evaluate(() => window.guardiaoAnalytics.recent().find((e) => e.name === "review_ask"));
    check(s.calls.includes("review") && ask?.n === 1, "volta de uma vitória → pede a avaliação da Google Play", s.calls.filter((c) => c === "review").join() || "(não pediu)");
    check(tit == null, "e a oferta do Sem anúncios espera (uma coisa por chegada)", tit ?? "");
    tit = await camp(t, { fromRun: true });
    s = await t.state();
    check(s.calls.filter((c) => c === "review").length === 1 && tit === "SEM ANÚNCIOS", "na volta seguinte sem vitória: não pede de novo; a oferta aparece", `${s.calls.filter((c) => c === "review").length} pedidos · ${tit ?? "(sem oferta)"}`);
    await t.page.evaluate(async () => (await import("/src/systems/Review.js")).Review.noteRun(true));
    await camp(t, { fromRun: true });
    s = await t.state();
    check(s.calls.filter((c) => c === "review").length === 1, "vitória nova antes de 60 dias: não pede de novo");
  },
  // Volta de uma derrota, ou com poucas partidas jogadas: nunca pede
  async avaliacaoDerrota(t) {
    await t.boot({ local: { guardiao_review_v1: { lastWon: false } } });
    await camp(t, { fromRun: true });
    check(!(await t.state()).calls.includes("review"), "volta de uma derrota: não pede a avaliação");
    await t.page.evaluate(async () => (await import("/src/systems/Review.js")).Review.noteRun(true));
    await camp(t, { fromRun: false });
    check(!(await t.state()).calls.includes("review"), "entrando pelo título (sem partida): não pede");
  },
  // Créditos: o atalho "Avaliar no Google Play" abre a página do jogo na loja
  async avaliacaoCreditos(t) {
    await t.page.evaluate(() => void window.game.scene.getScene("TitleScene")._showCredits());
    await t.page.waitForTimeout(500);
    const has = await t.page.evaluate(() => {
      const deep = (o) => [o, ...(o.list ?? []).flatMap(deep)];
      const m = window.game.scene.getScene("TitleScene")._modals.at(-1);
      return [m.root, m.list?.content].filter(Boolean).flatMap(deep).some((o) => o.text === "AVALIAR NO GOOGLE PLAY"); // as linhas moram na lista
    });
    check(has, "Créditos têm o atalho AVALIAR NO GOOGLE PLAY");
    // a página da loja é de fora: o teste só vê o pedido sair (e corta, para a página do jogo ficar)
    await t.page.route(/play\.google\.com/, (r) => r.abort());
    const req = t.page.waitForRequest(/play\.google\.com\/store\/apps\/details\?id=com\.lopesleo\.guardiao/, { timeout: 8000 }).catch(() => null);
    await t.page.evaluate(async () => (await import("/src/systems/Review.js")).Review.openStore("credits"));
    check(!!(await req), "o atalho abre a página do jogo na Google Play");
  },
  // Logo depois de comprar, a loja pode ainda não listar a compra: carência de 2 min
  async carencia(t) {
    await t.billing("buy");
    await t.page.evaluate(() => (window.__store.list = []));
    await t.billing("sync");
    const s = await t.state();
    check(s.noAds && !s.notice, "lista vazia logo depois da compra não tira nada");
  },
};

async function run(name) {
  console.log(`\n== ${name} ==`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, locale: "pt-BR", serviceWorkers: "block" });
  const errs = [];
  let page;
  const t = {
    get page() {
      return page;
    },
    async boot(cfg = {}) {
      page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push(e.message));
      await page.addInitScript(fakeStore, { store: {}, local: {}, ...cfg, local: { guardiao_settings_v1: { music: 0, sfx: 0 }, ...(cfg.local || {}) } });
      await page.goto(URL);
      await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
      await page.waitForTimeout(800);
    },
    set: (o) => page.evaluate((o) => Object.assign(window.__store, o), o),
    billing: (fn) => page.evaluate(async (fn) => (await import("/src/systems/Billing.js")).Billing[fn](), fn),
    state: () =>
      page.evaluate(async () => {
        const { Billing } = await import("/src/systems/Billing.js");
        const { AdService } = await import("/src/systems/AdService.js");
        const { Wardrobe } = await import("/src/systems/Cosmetics.js");
        const kits = Object.fromEntries(["ipe", "paina"].map((k) => [k, { owns: Billing.ownsKit(k), pending: Billing.kitPending(k), price: Billing.kitPrice(k), piece: Wardrobe.owns(k + "_kill") }]));
        const four = ["ipe", "paina", "coruja", "junina"].map((k) => Billing.ownsKit(k));
        const pack = { price: Billing.packPrice("fundador"), parts: Billing.packPartsValue("fundador"), pct: Billing.packSavePct("fundador"), founder: Billing.isFounder, allKits: four.every(Boolean), anyKit: four.some(Boolean) };
        return { noAds: AdService.noAds, saved: JSON.parse(localStorage.getItem("guardiao_store_v1") || "{}"), notice: Billing.notice, kitNotice: Billing.kitNotice, kits, pack, calls: window.__store.calls };
      }),
    // A janela de aviso abre sozinha na tela de menu; fecha e confere que fechou
    async noticeShown(re, shot, scene = "TitleScene") {
      const title = await page
        .waitForFunction(
          ({ src, scene }) => {
            const s = window.game.scene.getScene(scene);
            const t = s?._modals?.at(-1)?.titleText?.text;
            return t && new RegExp(src).test(t) ? t : null;
          },
          { src: re.source, scene },
          { timeout: 15000 },
        )
        .then((h) => h.jsonValue())
        .catch(() => null);
      check(!!title, `mostra o aviso "${re.source}" na tela`, title ? "" : "(não apareceu)");
      if (SHOTS && title) {
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SHOTS}/compra_${shot}.png` });
      }
      await page.evaluate((scene) => void window.game.scene.getScene(scene)._modals?.at(-1)?.close(), scene);
      await page.waitForTimeout(1200);
    },
  };
  try {
    // cada cenário que não sobe o jogo sozinho começa numa conta nova
    const kitsUp = name.startsWith("kit") ? ["kit_ipe", "kit_paineira"].slice(0, name === "kitCompra" ? 1 : 2) : name.startsWith("pacote") ? ALL : null;
    const ownBoot = ["estorno", "clareira", "falsoAlarme", "semRede", "kitEstorno", "pacoteEstorno", "pacoteEstornoSemAnuncios", "oferta", "ofertaRegras", "ofertaComprado", "bauAnuncio", "avaliacao", "avaliacaoDerrota"];
    if (!ownBoot.includes(name)) await t.boot(kitsUp ? { store: { kits: kitsUp } } : {});
    await SCENARIOS[name](t);
  } catch (e) {
    check(false, "o roteiro chegou ao fim", String(e.message || e).split("\n")[0]);
  }
  check(errs.length === 0, "sem erros no console", errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
for (const name of Object.keys(SCENARIOS)) if (!ONLY || ONLY.includes(name)) await run(name);
await browser.close();
server?.close();
console.log(failures ? `\n${failures} FALHA(S)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
