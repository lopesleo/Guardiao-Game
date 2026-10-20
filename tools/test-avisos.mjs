// Teste das novidades por notificação (systems/News.js) num navegador de verdade, com um Firebase Messaging
// FALSO (window.Capacitor.Plugins.FirebaseMessaging) que registra o que o app pediu: token, tópicos, canal.
// Confere: só se inscreve quem aceitou; o tópico é o do idioma (e troca quando o idioma muda); desligar em
// Opções sai do tópico e apaga o token; o pedido do baú conta das novidades e inscreve; o toque na notificação
// vira o evento news_open; a aba JOGO de Opções cabe com a linha nova.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:avisos                    (ou: node tools/test-avisos.mjs)
//
// Variáveis: ONLY=nome,nome  LAB_URL=… (servidor já rodando)  SHOTS=pasta (captura da aba JOGO)
import { chromium } from "playwright-core";
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

// Roda no navegador antes do jogo: o app "nativo" com Firebase Messaging, lembretes e AdMob falsos.
// A permissão do Android: perm = "granted" | "prompt" | "prompt-with-rationale" | "denied" (o pedido não aparece
// mais); answer = o que o jogador responde no pedido; dialog: false = o Android responde na hora, sem mostrar
// nada; off = canais desligados no sistema. NotificationSettings.open registra "open:<canal|app>"; o teste
// "volta" ao jogo chamando os ouvintes de "resume" do App
function fakeNative(cfg) {
  const F = (window.__fcm = { calls: [], topics: [], token: null, channel: null, perm: cfg.perm ?? "granted", off: cfg.off ?? [], listeners: {}, app: {} });
  for (const [k, v] of Object.entries(cfg.local || {})) localStorage.setItem(k, JSON.stringify(v));
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
      App: {
        addListener: async (ev, fn) => {
          (F.app[ev] ||= []).push(fn);
          return { remove: () => (F.app[ev] = F.app[ev].filter((f) => f !== fn)) };
        },
        exitApp() {},
      },
      LocalNotifications: {
        checkPermissions: async () => ({ display: F.perm }),
        requestPermissions: async () => {
          F.calls.push("perm");
          if (F.perm === "granted" || F.perm === "denied") return { display: F.perm };
          if (cfg.dialog !== false) await new Promise((r) => setTimeout(r, 900)); // o jogador lendo o pedido
          F.perm = (cfg.answer ?? "granted") === "granted" ? "granted" : cfg.dialog === false ? "denied" : "prompt-with-rationale";
          return { display: F.perm };
        },
        listChannels: async () => ({ channels: ["default", "novidades"].map((id) => ({ id, importance: F.off.includes(id) ? 0 : 3 })) }),
        schedule: async () => F.calls.push("schedule"),
        cancel: async () => {},
      },
      NotificationSettings: {
        open: async (o) => F.calls.push("open:" + (o?.channel ?? "app")),
      },
      FirebaseMessaging: {
        requestPermissions: async () => (F.calls.push("perm"), { receive: F.perm }),
        checkPermissions: async () => ({ receive: F.perm }),
        getToken: async () => (F.calls.push("token"), (F.token = "tok-aparelho"), { token: F.token }),
        deleteToken: async () => (F.calls.push("deleteToken"), (F.token = null)),
        subscribeToTopic: async ({ topic }) => (F.calls.push("sub:" + topic), F.topics.includes(topic) || F.topics.push(topic)),
        unsubscribeFromTopic: async ({ topic }) => (F.calls.push("unsub:" + topic), (F.topics = F.topics.filter((t) => t !== topic))),
        createChannel: async (c) => (F.channel = c),
        addListener: async (ev, fn) => ((F.listeners[ev] = fn), { remove() {} }),
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
const SET = (o) => ({ guardiao_settings_v1: { music: 0, sfx: 0, ...o } });
const BLOCKED = "Notificações desligadas no Android · toque para liberar";
const BLOCKED_ASK = "As notificações do jogo estão desligadas no Android. Ao aceitar, as configurações abrem para você liberar.";

const SCENARIOS = {
  // Quem aceitou os avisos (antes desta versão) passa a receber as novidades do seu idioma
  async inscreve(t) {
    await t.boot({ local: SET({ notify: true, notifyAsked: true }) });
    const f = await t.fcm();
    check(f.topics.join() === "novidades_pt", "inscrito só no tópico do português", JSON.stringify(f.topics));
    check(f.calls.includes("token"), "pediu o token só agora (auto-init desligado)");
    check(f.channel?.id === "novidades" && f.channel?.name === "Novidades", "canal \"Novidades\" com o nome no idioma do jogo", JSON.stringify(f.channel));
    check((await t.setting("newsTopic")) === "novidades_pt", "guardou o tópico (para sair dele depois)");
  },

  // Quem nunca aceitou: nada de token nem tópico
  async semAceite(t) {
    await t.boot({ local: SET({}) });
    const f = await t.fcm();
    check(f.calls.length === 0, "não pediu token nem se inscreveu", JSON.stringify(f.calls));
  },

  // Trocou o idioma (o jogo recarrega): sai do tópico antigo e entra no novo; o canal ganha o nome traduzido
  async idioma(t) {
    await t.boot({ locale: "en-US", local: SET({ notify: true, notifyAsked: true, newsTopic: "novidades_pt" }) });
    const f = await t.fcm();
    check(f.calls.includes("unsub:novidades_pt") && f.topics.join() === "novidades_en", "trocou novidades_pt → novidades_en", JSON.stringify(f.calls));
    check(f.channel?.name === "News", "canal com o nome em inglês", f.channel?.name);
  },

  // Opções → JOGO: a linha "Novidades" desliga (sai do tópico e apaga o token) e religa (pede permissão)
  async opcoes(t) {
    await t.boot({ local: SET({ notify: true, notifyAsked: true }) });
    await t.page.evaluate(async () => (await import("/src/ui/SettingsModal.js")).openSettings(window.game.scene.getScene("TitleScene"), { tab: "jogo" }));
    await t.page.waitForTimeout(600);
    const rows = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("TitleScene");
      const m = s._modals?.at(-1);
      const cam = s.cameras.main;
      const deep = (o) => (o.list ? o.list.flatMap(deep) : [o]);
      const texts = s.children.list.flatMap(deep).filter((o) => o.type === "Text" && o.visible && o.alpha > 0);
      const find = (str) => texts.find((o) => o.text === str);
      const nov = find("Novidades"),
        av = find("Avisos");
      const b = (o) => o && (({ x, y, width, height }) => ({ x, y, bottom: y + height }))(o.getBounds());
      return { nov: b(nov), av: b(av), frame: m ? { top: m.top, h: m.h } : null, H: cam.height };
    });
    check(!!rows.nov && !!rows.av, "as duas linhas aparecem (Avisos e Novidades)");
    check(rows.nov && rows.nov.bottom < rows.H - 10, "a linha Novidades cabe na tela", JSON.stringify(rows.nov));
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/avisos_opcoes.png` });
    await t.news("setEnabled", false);
    let f = await t.fcm();
    check(f.topics.length === 0 && f.calls.includes("deleteToken"), "desligar sai do tópico e apaga o token", JSON.stringify(f.calls));
    check((await t.setting("news")) === false, "a escolha fica guardada");
    await t.news("setEnabled", true);
    f = await t.fcm();
    check(f.topics.join() === "novidades_pt", "religar volta ao tópico (a permissão já estava dada)", JSON.stringify(f.calls));
  },

  // Recusou o pedido do Android ao ligar em Opções: fica desligado, sem tópico, e a chave volta para NÃO
  async recusa(t) {
    await t.boot({ perm: "prompt", answer: "denied", local: SET({}) });
    let o = await t.options();
    check(o.novidades === false, "Novidades começa em NÃO");
    await t.tap("novidades");
    await t.page.waitForTimeout(1500);
    const f = await t.fcm();
    o = await t.modal();
    check(f.calls.includes("perm") && !f.calls.some((c) => c.startsWith("open:")), "mostrou o pedido do Android (sem abrir as configurações)", JSON.stringify(f.calls));
    check(f.topics.length === 0 && (await t.setting("news")) === false, "sem permissão não se inscreve", JSON.stringify(f.calls));
    check(o.novidades === false, "a chave voltou para NÃO depois da recusa", JSON.stringify(o));
  },

  // O caso do celular do Leonardo (20/10/2026): reinstalou, o backup do Android trouxe "avisos ligados" e a
  // permissão não veio. Antes: Novidades em SIM, inscrito no tópico, e o Android jogava fora a notificação
  async perdeuPermissao(t) {
    await t.boot({ perm: "prompt", local: SET({ notify: true, notifyAsked: true, news: true, newsTopic: "novidades_pt" }) });
    let f = await t.fcm();
    check(!f.calls.some((c) => c.startsWith("sub:")) && f.topics.length === 0, "não se inscreve sem a permissão", JSON.stringify(f.calls));
    check(f.calls.includes("unsub:novidades_pt") && f.calls.includes("deleteToken"), "sai do tópico de antes e apaga o token", JSON.stringify(f.calls));
    check((await t.setting("notify")) === false && (await t.setting("notifyAsked")) === false, "volta a perguntar UMA vez (no baú/horta)");
    const ev = await t.page.evaluate(async () => (await import("/src/systems/Analytics.js")).Analytics.recent().filter((e) => e.name === "notify_lost").map((e) => e.perm));
    check(ev.join() === "prompt", "evento notify_lost para medir quantos perderam", JSON.stringify(ev));
    const o = await t.options();
    check(o.avisos === false && o.novidades === false, "Avisos e Novidades em NÃO", JSON.stringify(o));
    check(!o.texts.includes(BLOCKED), "sem a dica de bloqueado (o Android ainda mostra o pedido)");
    const p = await t.camp();
    check(p.title === "QUER UM AVISO?" && !p.texts.includes(BLOCKED_ASK), "o pedido do baú aparece de novo, sem o aviso de bloqueado", JSON.stringify(p));
    await t.page.evaluate(() => window.game.scene.getScene("CampScene")._modals.at(-1).body.list.find((o) => o.label?.text === "SIM, AVISE").onClick() && undefined);
    await t.page.waitForFunction(() => window.__fcm.topics.length > 0, null, { timeout: 5000 }).catch(() => {});
    f = await t.fcm();
    check(f.calls.includes("perm") && f.calls.includes("schedule") && f.topics.join() === "novidades_pt", "aceitou: pedido do Android, lembrete e novidades", JSON.stringify(f.calls));
  },

  // Recusou duas vezes (o Android não mostra mais o pedido): a dica diz, ligar abre as configurações do jogo
  // no Android e, quando o jogador volta com tudo liberado, a aba se refaz em SIM e o aparelho entra no tópico
  async bloqueado(t) {
    await t.boot({ perm: "denied", local: SET({ news: true }) });
    let o = await t.options();
    check(o.novidades === false && o.avisos === false, "as duas chaves em NÃO", JSON.stringify(o));
    check(o.texts.filter((x) => x === BLOCKED).length === 2, "as duas linhas dizem que o Android desligou", JSON.stringify(o.texts));
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/avisos_bloqueado.png` });
    await t.tap("novidades");
    await t.page.waitForTimeout(300);
    let f = await t.fcm();
    check(f.calls.includes("open:app") && !f.calls.includes("perm"), "abriu a tela de notificações do jogo (sem pedido inútil)", JSON.stringify(f.calls));
    await t.page.evaluate(() => (window.__fcm.perm = "granted")); // o jogador liberou lá
    await t.resume();
    await t.page.waitForFunction(() => window.__fcm.topics.length > 0, null, { timeout: 5000 }).catch(() => {});
    await t.page.waitForTimeout(400);
    f = await t.fcm();
    o = await t.modal();
    check(f.topics.join() === "novidades_pt" && (await t.setting("news")) === true, "voltou com a permissão: inscrito", JSON.stringify(f.calls));
    check(o.novidades === true && !o.texts.includes(BLOCKED), "a aba se refez: Novidades em SIM, sem a dica de bloqueado", JSON.stringify(o));
  },

  // Desligou só o canal "Novidades" no Android: Avisos segue em SIM; Novidades em NÃO e abre a tela do canal
  async canalDesligado(t) {
    await t.boot({ off: ["novidades"], local: SET({ notify: true, notifyAsked: true }) });
    let f = await t.fcm();
    check(f.topics.length === 0, "não se inscreve com o canal desligado", JSON.stringify(f.calls));
    check((await t.setting("notify")) === true, "os avisos continuam (o canal deles está ligado)");
    let o = await t.options();
    check(o.avisos === true && o.novidades === false, "Avisos SIM, Novidades NÃO", JSON.stringify(o));
    await t.tap("novidades");
    await t.page.waitForTimeout(300);
    f = await t.fcm();
    check(f.calls.includes("open:novidades"), "abriu a tela do canal Novidades", JSON.stringify(f.calls));
    await t.page.evaluate(() => (window.__fcm.off = []));
    await t.resume();
    await t.page.waitForFunction(() => window.__fcm.topics.length > 0, null, { timeout: 5000 }).catch(() => {});
    f = await t.fcm();
    check(f.topics.join() === "novidades_pt", "religou o canal: inscrito", JSON.stringify(f.calls));
  },

  // O Android responde "negado" na hora, sem mostrar nada (bloqueado de vez, mas o estado guardado dizia que
  // dava para pedir): em vez de um toque morto, abre as configurações
  async respostaNaHora(t) {
    await t.boot({ perm: "prompt", dialog: false, answer: "denied", local: SET({}) });
    const r = t.news("setEnabled", true);
    await t.page.waitForTimeout(400);
    let f = await t.fcm();
    check(f.calls.includes("perm") && f.calls.includes("open:app"), "pediu, o Android não mostrou, abriu as configurações", JSON.stringify(f.calls));
    await t.resume(); // voltou sem liberar
    check((await r) === false && (await t.setting("news")) === false, "voltou sem liberar: segue desligado");
  },

  // Perdeu a permissão e o Android não mostra mais o pedido: o pedido do baú avisa que o SIM abre as configurações
  async pedidoBloqueado(t) {
    await t.boot({ perm: "denied", local: SET({ notify: true, notifyAsked: true }) });
    const p = await t.camp();
    check(p.title === "QUER UM AVISO?" && p.texts.includes(BLOCKED_ASK), "o pedido aparece com o aviso de bloqueado", JSON.stringify(p.texts));
    if (SHOTS) {
      await t.page.waitForTimeout(500);
      await t.page.screenshot({ path: `${SHOTS}/avisos_pedido_bloqueado.png` });
    }
    await t.page.evaluate(() => window.game.scene.getScene("CampScene")._modals.at(-1).body.list.find((o) => o.label?.text === "SIM, AVISE").onClick() && undefined);
    await t.page.waitForTimeout(300);
    let f = await t.fcm();
    check(f.calls.includes("open:app"), "SIM abriu as configurações", JSON.stringify(f.calls));
    await t.page.evaluate(() => (window.__fcm.perm = "granted"));
    await t.resume();
    await t.page.waitForFunction(() => window.__fcm.calls.includes("schedule"), null, { timeout: 5000 }).catch(() => {});
    f = await t.fcm();
    check(f.calls.includes("schedule") && (await t.setting("notify")) === true, "liberou: lembrete agendado", JSON.stringify(f.calls));
  },

  // O pedido do baú (1ª vez) conta das novidades; aceitou → lembrete agendado E inscrito
  async pedidoDoBau(t) {
    await t.boot({ local: SET({}) });
    await t.page.evaluate(() => {
      const ti = window.game.scene.getScene("TitleScene");
      ti.meta.data.campIntroSeen = true;
      ti.meta._save();
      ti.scene.start("CampScene");
    });
    await t.page.waitForFunction(() => window.game.scene.getScene("CampScene")?.player && !window.game.scene.getScene("CampScene")._cutscene, null, { timeout: 60000 });
    await t.page.waitForTimeout(800);
    const shown = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("CampScene");
      while (s._modals?.length) s._modals.at(-1).close();
      s._offerNotify("chest");
      const m = s._modals?.at(-1);
      const all = m ? m.body.list : [];
      return { title: m?.titleText?.text, texts: all.filter((o) => o.type === "Text").map((o) => o.text) };
    });
    check(shown.title === "QUER UM AVISO?", "o pedido abriu", shown.title);
    check(shown.texts.some((x) => /novidades do jogo/.test(x)), "o pedido conta das novidades", JSON.stringify(shown.texts));
    if (SHOTS) {
      await t.page.waitForTimeout(500);
      await t.page.screenshot({ path: `${SHOTS}/avisos_pedido.png` });
    }
    await t.page.evaluate(() => window.game.scene.getScene("CampScene")._modals.at(-1).body.list.find((o) => o.label?.text === "SIM, AVISE").onClick() && undefined);
    await t.page.waitForFunction(() => window.__fcm.topics.length > 0, null, { timeout: 5000 }).catch(() => {});
    const f = await t.fcm();
    check(f.calls.includes("schedule") && f.topics.join() === "novidades_pt", "aceitou: lembrete agendado e inscrito nas novidades", JSON.stringify(f.calls));
  },

  // Tocou na notificação: evento news_open com o id do aviso (para medir quem abre)
  async toque(t) {
    await t.boot({ local: SET({ notify: true, notifyAsked: true }) });
    const ev = await t.page.evaluate(async () => {
      window.__fcm.listeners.notificationActionPerformed?.({ actionId: "tap", notification: { data: { id: "2026-10-31-saci" } } });
      const { Analytics } = await import("/src/systems/Analytics.js");
      return Analytics.recent().filter((e) => e.name === "news_open").map((e) => e.id);
    });
    check(ev.includes("2026-10-31-saci"), "news_open com o id do aviso", JSON.stringify(ev));
  },
};

async function run(name) {
  console.log(`\n== ${name} ==`);
  let ctx = null;
  const errs = [];
  let page;
  const t = {
    get page() {
      return page;
    },
    async boot(cfg = {}) {
      ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, locale: cfg.locale || "pt-BR", serviceWorkers: "block" });
      page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push(e.message));
      await page.addInitScript(fakeNative, cfg);
      await page.goto(URL);
      await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
      await page.waitForTimeout(800);
    },
    fcm: () => page.evaluate(() => JSON.parse(JSON.stringify({ ...window.__fcm, listeners: undefined }))),
    setting: (k) => page.evaluate((k) => JSON.parse(localStorage.getItem("guardiao_settings_v1") || "{}")[k], k),
    news: (fn, ...a) => page.evaluate(async ({ fn, a }) => (await import("/src/systems/News.js")).News[fn](...a), { fn, a }),
    // A janela de Opções do topo: as duas chaves (SIM = true) e os textos
    modal: () =>
      page.evaluate(() => {
        const m = window.game.scene.getScene("TitleScene")._modals?.at(-1);
        const L = m?.body.list ?? [];
        const tg = (n) => L.find((o) => o.name === n)?.on_ ?? null;
        return { avisos: tg("avisos"), novidades: tg("novidades"), texts: L.filter((o) => o.type === "Text").map((o) => o.text) };
      }),
    async options() {
      await page.evaluate(async () => {
        const s = window.game.scene.getScene("TitleScene");
        while (s._modals?.length) s._modals.at(-1).close();
        (await import("/src/ui/SettingsModal.js")).openSettings(s, { tab: "jogo" });
      });
      await page.waitForTimeout(400);
      return t.modal();
    },
    tap: (name) => page.evaluate((n) => window.game.scene.getScene("TitleScene")._modals.at(-1).body.list.find((o) => o.name === n).emit("pointerup"), name),
    // O jogador volta das configurações do Android para o jogo
    resume: () => page.evaluate(() => (window.__fcm.app.resume ?? []).slice().forEach((fn) => fn())),
    // Vai para a Clareira e abre o pedido do baú; devolve o título e os textos do pedido
    async camp() {
      await page.evaluate(() => {
        const ti = window.game.scene.getScene("TitleScene");
        while (ti._modals?.length) ti._modals.at(-1).close();
        ti.meta.data.campIntroSeen = true;
        ti.meta._save();
        ti.scene.start("CampScene");
      });
      await page.waitForFunction(() => window.game.scene.getScene("CampScene")?.player && !window.game.scene.getScene("CampScene")._cutscene, null, { timeout: 60000 });
      await page.waitForTimeout(800);
      return page.evaluate(() => {
        const s = window.game.scene.getScene("CampScene");
        while (s._modals?.length) s._modals.at(-1).close();
        s._offerNotify("chest");
        const m = s._modals?.at(-1);
        return { title: m?.titleText?.text, texts: (m ? m.body.list : []).filter((o) => o.type === "Text").map((o) => o.text) };
      });
    },
  };
  try {
    await SCENARIOS[name](t);
  } catch (e) {
    check(false, "cenário quebrou", e.message.split("\n")[0]);
  }
  check(errs.length === 0, "sem erros no console", errs.slice(0, 2).join(" | "));
  await ctx?.close();
}

for (const name of Object.keys(SCENARIOS)) if (!ONLY || ONLY.includes(name)) await run(name);
await browser.close();
server?.close();
console.log(failures ? `\n${failures} FALHA(S)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
