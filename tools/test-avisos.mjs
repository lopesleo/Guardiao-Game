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

// Roda no navegador antes do jogo: o app "nativo" com Firebase Messaging, lembretes e AdMob falsos
function fakeNative(cfg) {
  const F = (window.__fcm = { calls: [], topics: [], token: null, channel: null, perm: cfg.perm ?? "granted", listeners: {} });
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
      LocalNotifications: {
        requestPermissions: async () => ({ display: F.perm }),
        schedule: async () => F.calls.push("schedule"),
        cancel: async () => {},
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
    check(f.calls.includes("perm") && f.topics.join() === "novidades_pt", "religar pede a permissão e volta ao tópico");
  },

  // Recusou a permissão do sistema ao ligar em Opções: fica desligado, sem tópico
  async recusa(t) {
    await t.boot({ perm: "denied", local: SET({}) });
    const r = await t.news("setEnabled", true);
    const f = await t.fcm();
    check(r === false && f.topics.length === 0 && (await t.setting("news")) === false, "sem permissão não se inscreve", JSON.stringify(f.calls));
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
    await t.page.evaluate(() => window.game.scene.getScene("CampScene")._modals.at(-1).body.list.find((o) => o.label?.text === "SIM, AVISE").onClick());
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
