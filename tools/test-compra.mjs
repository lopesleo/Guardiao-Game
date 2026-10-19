// Teste da compra "Sem anúncios" (systems/Billing.js) num navegador de verdade, com uma Play Store
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
  const P = (state) => ({ productIdentifier: "sem_anuncios", purchaseState: state, purchaseToken: "tok-1", isAcknowledged: false });
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
      NativePurchases: {
        isBillingSupported: async () => ({ isBillingSupported: true }),
        getProduct: async () => ({ product: { identifier: "sem_anuncios", priceString: "R$ 14,90" } }),
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
          S.calls.push("buy:" + (o.autoAcknowledgePurchases === false ? "manual" : "auto"));
          await wait(80);
          if (S.buy === "pending") {
            S.list = [P("2")];
            throw new Error("Purchase is pending");
          }
          if (S.buy === "cancel") throw Object.assign(new Error("Purchase is not purchased"), { code: "USER_CANCELED" });
          S.list = [P("1")];
          return P("1");
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
    const btn = await t.page.evaluate(() => window.game.scene.isActive("TitleScene") && !!window.game.scene.getScene("TitleScene").children.list.find((o) => o.label?.text === "SEM ANÚNCIOS"));
    check(btn, "o botão SEM ANÚNCIOS volta ao título depois do aviso");
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
    check(!(await t.page.evaluate(() => window.game.scene.getScene("CampScene").noAdsBtn?.visible)), "com a compra, a estrela da loja fica escondida");
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
        return { noAds: AdService.noAds, saved: JSON.parse(localStorage.getItem("guardiao_store_v1") || "{}"), notice: Billing.notice, calls: window.__store.calls };
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
    if (name !== "estorno" && name !== "clareira" && name !== "falsoAlarme" && name !== "semRede") await t.boot();
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
