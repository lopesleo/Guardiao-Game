// Teste do "Chame um amigo" (systems/Invite.js + ui/InviteUI.js) num navegador de verdade, com o compartilhar do
// Android FALSO (window.Capacitor.Plugins.Share) e a área de transferência falsa. Confere: o link (página no
// idioma do jogo, utm_source=convite, utm_medium=amigo, utm_campaign = de onde saiu, utm_content = qual texto), o
// texto (sem emoji, com o feito no ranking), a folha do Android chamada uma vez (dois toques não abrem duas),
// fechar sem escolher não avisa nada, erro cai em copiar o link, o navegador usa navigator.share ou copia, o
// evento invite no Analytics, e os três lugares: Clareira (só depois de MIN_RUNS partidas, sem encostar no
// quadro), Créditos e o ranking.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:convite                   (ou: node tools/test-convite.mjs)
//
// Variáveis: ONLY=nome,nome  LAB_URL=… (servidor já rodando)  SHOTS=pasta  LOC=ja-JP TS=2 (idioma e texto)
import { chromium } from "playwright-core";
import { startLabServer } from "./lab-server.mjs";

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SHOTS = process.env.SHOTS || "";
const LOC = process.env.LOC || "pt-BR";
const TS = Number(process.env.TS || 0);
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url;
const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});

// Roda no navegador antes do jogo. cfg.native: app Android (Share falso); cfg.share: o que o Share/navigator.share
// fazem ("ok" | "cancel" | "error" | "slow"); cfg.webShare: o navegador tem navigator.share; cfg.clip: "ok" | "fail"
function fake(cfg) {
  const S = (window.__inv = { shares: [], webShares: [], clip: [] });
  const share = async (o, list) => {
    list.push(o);
    if (cfg.share === "slow") await new Promise((r) => setTimeout(r, 600));
    if (cfg.share === "cancel") throw cfg.native ? new Error("Share canceled") : Object.assign(new Error("Share canceled"), { name: "AbortError" });
    if (cfg.share === "error") throw new Error("Can't share: boom");
    return { activityType: "com.whatsapp" };
  };
  // área de transferência: grava o que o jogo copiou (ou recusa, e o jeito antigo também falha)
  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (s) => (cfg.clip === "fail" ? Promise.reject(new Error("denied")) : (S.clip.push(s), undefined)) },
    });
  } catch {}
  if (cfg.clip === "fail") document.execCommand = () => false;
  // navigator.share: o do aparelho (Windows abriria a folha do sistema e o teste ficaria esperando)
  try {
    Object.defineProperty(Navigator.prototype, "share", { configurable: true, value: cfg.webShare ? (o) => share(o, S.webShares) : undefined });
  } catch {}
  for (const [k, v] of Object.entries(cfg.local || {})) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  if (!cfg.native) return;
  const names = ["Iara_da_Lagoa", "Curupira77", "SaciPererê"];
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    Plugins: {
      AdMob: { requestConsentInfo: async () => ({ status: "NOT_REQUIRED" }), initialize: async () => {}, addListener: async () => ({ remove() {} }), prepareRewardVideoAd: async () => {}, showRewardVideoAd: async () => {} },
      PlayGames: {
        status: async () => ({ configured: true, authenticated: true }),
        signIn: async () => ({ configured: true, authenticated: true }),
        read: async () => ({ data: null, modified: 0 }),
        write: async () => ({ modified: Date.now() }),
        submitScore: async () => {},
        loadScores: async () => ({ scores: names.map((name, i) => ({ rank: i + 1, name, score: 90000 - i * 9000, me: false })), player: { rank: 37, score: 13450 }, total: 512 }),
      },
      Share: { share: (o) => share(o, S.shares) },
    },
  };
}

let failures = 0;
const check = (ok, what, extra = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${what}${extra ? "  " + extra : ""}`);
  return ok;
};
const SET = { guardiao_settings_v1: { music: 0, sfx: 0, textSize: TS, quality: "high" } };
const EMOJI = /\p{Extended_Pictographic}/u;
const params = (u) => Object.fromEntries(new globalThis.URL(u).searchParams);

const tr = (t, s, ...a) => t.page.evaluate(async ({ s, a }) => (await import("/src/i18n/i18n.js")).tr(s, ...a), { s, a });
const lastInvite = (t) => t.page.evaluate(() => window.guardiaoAnalytics.recent().filter((e) => e.name === "invite").at(-1) ?? null);
const invites = (t) => t.page.evaluate(() => window.guardiaoAnalytics.recent().filter((e) => e.name === "invite").length);
const inv = (t) => t.page.evaluate(() => JSON.parse(JSON.stringify(window.__inv)));
// O aviso curto (cloudToast) está na tela com este texto?
const toast = (t, scene, msg) =>
  t.page.evaluate(
    ({ scene, msg }) => {
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      return window.game.scene.getScene(scene).children.list.flatMap(deep).some((o) => o.type === "Text" && o.text === msg && o.visible);
    },
    { scene, msg },
  );
// Espera a promessa do convite (a folha "lenta" leva 600 ms)
const settle = (t, n) => t.page.waitForFunction((n) => window.guardiaoAnalytics.recent().filter((e) => e.name === "invite").length >= n, n, { timeout: 15000 });

async function toCamp(t, runs = 6) {
  await t.page.evaluate(async (runs) => {
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const { pendingReveals } = await import("/src/systems/Reveal.js");
    const { dayKey } = await import("/src/systems/Daily.js");
    const m = new MetaProgression();
    const d = m.data;
    d.runsPlayed = runs;
    d.campIntroSeen = true;
    d.firstDefeatSeen = true;
    for (const r of pendingReveals(d)) d.revealed.push(r.id);
    d.streak = { last: dayKey(), count: 1 };
    m._save();
    const g = window.game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    const c = g.scene.getScene("CampScene");
    c.__ready = false;
    c.events.once("create", () => (c.__ready = true));
    g.scene.start("CampScene", { fromRun: false });
  }, runs);
  await t.page.waitForFunction(() => {
    const c = window.game.scene.getScene("CampScene");
    return c.__ready && c.player && !c._cutscene;
  }, null, { timeout: 60000 });
  await t.page.waitForTimeout(400);
}
const pressCampInvite = (t) => t.page.evaluate(() => void window.game.scene.getScene("CampScene").inviteBtn.onClick());

const SCENARIOS = {
  // O link: a página no idioma do jogo e a origem nos quatro parâmetros
  async link(t) {
    await t.boot();
    const r = await t.page.evaluate(async () => {
      const { inviteUrl } = await import("/src/systems/Invite.js");
      const { LANGS } = await import("/src/i18n/i18n.js");
      const { INVITE } = await import("/src/config.js");
      return { urls: LANGS.map((l) => [l.id, inviteUrl("clareira", "geral", l.id)]), pages: INVITE.PAGE };
    });
    const want = { pt: "/guardiao/", en: "/guardiao/en/", es: "/guardiao/es/", ja: "/guardiao/ja/", zh: "/guardiao/zh/", zht: "/guardiao/zh-hant/" };
    for (const [id, u] of r.urls) {
      const x = new globalThis.URL(u);
      const p = params(u);
      check(x.origin === "https://komedygames.com" && x.pathname === want[id], `${id}: página certa`, u);
      check(p.utm_source === "convite" && p.utm_medium === "amigo" && p.utm_campaign === "clareira" && p.utm_content === "geral", `${id}: utm_source=convite, utm_medium=amigo, campanha e conteúdo`, JSON.stringify(p));
    }
  },

  // O app: a folha do Android, o texto, o link, o evento e o "obrigado"
  async nativo(t) {
    await t.boot({ native: true, share: "ok" });
    await toCamp(t);
    const hud = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("CampScene");
      const b = s.inviteBtn;
      if (!b) return null;
      const others = [s.rankBtn, s.wardrobeBtn, s.noAdsBtn, s.barnBtn].filter((o) => o?.visible).map((o) => o.x);
      return { x: b.x, visible: b.visible, others, titleRight: s.hudTitle.x + s.hudTitle.displayWidth, infoRight: s.hudInfo.x + s.hudInfo.displayWidth };
    });
    check(hud?.visible, "botão de convite na Clareira");
    check(hud && hud.x - 26 > Math.max(hud.titleRight, hud.infoRight) + 10, "o botão não encosta no quadro da Clareira", JSON.stringify(hud));
    check(hud && hud.others.every((x) => Math.abs(x - hud.x) >= 56) && hud.x < Math.min(...hud.others), "na ponta da fileira, sem encostar nos outros botões", JSON.stringify(hud));
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_convite_clareira.png` });
    await pressCampInvite(t);
    await settle(t, 1);
    const s = (await inv(t)).shares;
    check(s.length === 1, "a folha de compartilhar do Android abriu uma vez", s.length);
    const o = s[0] ?? {};
    const p = o.url ? params(o.url) : {};
    check(p.utm_source === "convite" && p.utm_medium === "amigo" && p.utm_campaign === "clareira" && p.utm_content === "geral", "link com a origem da Clareira", o.url);
    const L = { title: await tr(t, "Guardião da Floresta"), dialog: await tr(t, "Chamar um amigo"), text: await tr(t, "Estou protegendo a mata no Guardião da Floresta: o Curupira, a Iara e o Saci contra a Podridão. Vem jogar também, é grátis!"), thanks: await tr(t, "A mata agradece!") };
    check(o.title === L.title && o.dialogTitle === L.dialog, "título e cabeçalho da folha no idioma do jogo", `${o.title} / ${o.dialogTitle}`);
    check(o.text === L.text && !EMOJI.test(o.text) && !o.text.includes("http"), "o texto do convite, sem emoji e sem o link repetido", o.text);
    const ev = await lastInvite(t);
    check(ev && ev.from === "clareira" && ev.result === "shared" && ev.via === "native" && ev.msg === "geral" && ev.app === "com.whatsapp", "evento invite { from, result, via, msg, app }", JSON.stringify(ev));
    check(await toast(t, "CampScene", L.thanks), "aviso curto de obrigado", L.thanks);
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_convite_obrigado.png` });
  },

  // Quem acabou de chegar não vê o botão (só depois de MIN_RUNS partidas)
  async novato(t) {
    await t.boot({ native: true, share: "ok" });
    const min = await t.page.evaluate(async () => (await import("/src/config.js")).INVITE.MIN_RUNS);
    await toCamp(t, min - 1);
    check(!(await t.page.evaluate(() => !!window.game.scene.getScene("CampScene").inviteBtn)), `com ${min - 1} partidas, sem botão na Clareira`);
    await toCamp(t, min);
    check(await t.page.evaluate(() => !!window.game.scene.getScene("CampScene").inviteBtn?.visible), `com ${min} partidas, o botão aparece`);
  },

  // Fechou a folha sem escolher: nada de aviso, nada copiado
  async cancelou(t) {
    await t.boot({ native: true, share: "cancel" });
    await toCamp(t);
    await pressCampInvite(t);
    await settle(t, 1);
    const ev = await lastInvite(t);
    const i = await inv(t);
    check(ev?.result === "cancel", "fechar a folha = cancel", JSON.stringify(ev));
    check(i.clip.length === 0, "não copiou nada");
    const L = [await tr(t, "A mata agradece!"), await tr(t, "Link copiado! Cole numa conversa com seu amigo."), await tr(t, "Não deu para compartilhar agora.")];
    let any = false;
    for (const m of L) any ||= await toast(t, "CampScene", m);
    check(!any, "sem aviso na tela");
  },

  // A folha deu erro: o convite vai para a área de transferência, com aviso
  async erroCopia(t) {
    await t.boot({ native: true, share: "error" });
    await toCamp(t);
    await pressCampInvite(t);
    await settle(t, 1);
    const ev = await lastInvite(t);
    const i = await inv(t);
    check(ev?.result === "copied", "erro na folha: copia o link", JSON.stringify(ev));
    check(i.clip.length === 1 && /utm_source=convite/.test(i.clip[0]) && i.clip[0].startsWith(i.shares[0]?.text ?? "?"), "copiou o texto com o link", i.clip[0]);
    const msg = await tr(t, "Link copiado! Cole numa conversa com seu amigo.");
    check(await toast(t, "CampScene", msg), "aviso de link copiado", msg);
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_convite_copiado.png` });
  },

  // Nem a folha nem a área de transferência: avisa que não deu (e não trava o próximo toque)
  async nadaDeu(t) {
    await t.boot({ native: true, share: "error", clip: "fail" });
    await toCamp(t);
    await pressCampInvite(t);
    await settle(t, 1);
    check((await lastInvite(t))?.result === "fail", "sem folha e sem copiar = fail");
    const msg = await tr(t, "Não deu para compartilhar agora.");
    check(await toast(t, "CampScene", msg), "aviso de que não deu", msg);
    await pressCampInvite(t);
    await settle(t, 2);
    check((await inv(t)).shares.length === 2, "o toque seguinte tenta de novo");
  },

  // Dois toques seguidos com a folha aberta: uma folha só
  async doisToques(t) {
    await t.boot({ native: true, share: "slow" });
    await toCamp(t);
    await pressCampInvite(t);
    await pressCampInvite(t);
    await settle(t, 1);
    await t.page.waitForTimeout(900);
    check((await inv(t)).shares.length === 1, "dois toques abrem uma folha só", (await inv(t)).shares.length);
  },

  // Navegador com navigator.share (celular, Windows): a folha do sistema
  async navegador(t) {
    await t.boot({ webShare: true, share: "ok" });
    await toCamp(t);
    await pressCampInvite(t);
    await settle(t, 1);
    const i = await inv(t);
    const o = i.webShares[0] ?? {};
    check(i.webShares.length === 1 && /utm_campaign=clareira/.test(o.url ?? "") && o.text && o.title, "navigator.share com título, texto e link", JSON.stringify(o).slice(0, 160));
    const ev = await lastInvite(t);
    check(ev?.result === "shared" && ev.via === "web", "evento via web", JSON.stringify(ev));
  },

  // Navegador sem compartilhar (computador): copia o texto com o link e avisa
  async semCompartilhar(t) {
    await t.boot();
    await toCamp(t);
    await pressCampInvite(t);
    await settle(t, 1);
    const i = await inv(t);
    const ev = await lastInvite(t);
    check(ev?.result === "copied" && ev.via === "copy", "sem folha: copia", JSON.stringify(ev));
    check(i.clip.length === 1 && /komedygames\.com\/guardiao\/.*utm_source=convite/.test(i.clip[0]), "copiou o texto com o link", i.clip[0]);
    const msg = await tr(t, "Link copiado! Cole numa conversa com seu amigo.");
    check(await toast(t, "CampScene", msg), "aviso de link copiado");
  },

  // Créditos (tela de título): a linha CHAMAR UM AMIGO
  async creditos(t) {
    await t.boot({ native: true, share: "ok" });
    const name = await tr(t, "CHAMAR UM AMIGO");
    const ok = await t.page.evaluate((name) => {
      const ti = window.game.scene.getScene("TitleScene");
      ti._showCredits();
      const list = ti._modals.at(-1).list;
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      const row = list.rows.find((r) => r.c && deep(r.c).some((o) => o.type === "Text" && o.text === name));
      if (!row?.onTap) return false;
      row.onTap();
      return true;
    }, name);
    check(ok, "a linha CHAMAR UM AMIGO nos Créditos", name);
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_convite_creditos.png` });
    await settle(t, 1);
    const o = (await inv(t)).shares[0] ?? {};
    check(o.url && params(o.url).utm_campaign === "creditos", "link com a origem dos Créditos", o.url);
    check((await lastInvite(t))?.from === "creditos", "evento from=creditos");
  },

  // Ranking: DESAFIAR UM AMIGO leva o feito do jogador (pontos; na aba do Perigo, o maior vencido)
  async ranking(t) {
    await t.boot({ native: true, share: "ok", local: { guardiao_ranking_v1: { best: 13450 } } });
    await t.page.evaluate(async () => {
      const { RANKING } = await import("/src/config.js");
      RANKING.IDS.score = "CgkTESTE_score";
      RANKING.IDS.perigo = "CgkTESTE_perigo";
    });
    await toCamp(t);
    await t.page.evaluate(async () => {
      const s = window.game.scene.getScene("CampScene");
      s.meta.data.winsByDifficulty = { 0: 2, 2: 1 };
      s.meta._save();
      const { Leaderboards } = await import("/src/systems/Leaderboards.js");
      await Leaderboards.install(s.meta);
      (await import("/src/ui/RankingModal.js")).openRanking(s, { board: "score", span: "week", fresh: true });
    });
    await t.page.waitForTimeout(900);
    const label = await tr(t, "DESAFIAR UM AMIGO");
    const press = () =>
      t.page.evaluate((label) => {
        const s = window.game.scene.getScene("CampScene");
        const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
        const b = deep(s._modals.at(-1).root).find((o) => o.label?.text === label);
        if (!b) return null;
        const r = b.getBounds();
        b.onClick();
        return { right: r.right, w: window.game.scene.getScene("CampScene")._modals.at(-1).w };
      }, label);
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_convite_ranking.png` });
    const b = await press();
    check(!!b, "botão DESAFIAR UM AMIGO no ranking", label);
    await settle(t, 1);
    let o = (await inv(t)).shares.at(-1) ?? {};
    const pts = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).fmt(13450));
    check(o.text?.includes(pts) && params(o.url).utm_content === "pontos" && params(o.url).utm_campaign === "ranking", "o texto leva os pontos do jogador", o.text);
    // aba do Perigo: o maior Perigo vencido (Veterano)
    const perigoTab = await tr(t, "MAIOR PERIGO");
    await t.page.evaluate((lab) => {
      const s = window.game.scene.getScene("CampScene");
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      deep(s._modals.at(-1).root).find((o) => o.label?.text === lab).onClick();
    }, perigoTab);
    await t.page.waitForTimeout(700);
    // a tela do fim da partida não tem o save à mão (scene.meta): o botão lê o save na hora
    await t.page.evaluate(() => {
      const s = window.game.scene.getScene("CampScene");
      s.__meta = s.meta;
      s.meta = undefined;
    });
    await press();
    await t.page.evaluate(() => {
      const s = window.game.scene.getScene("CampScene");
      s.meta = s.__meta;
    });
    await settle(t, 2);
    o = (await inv(t)).shares.at(-1) ?? {};
    const vet = await t.page.evaluate(async () => (await import("/src/config.js")).DIFFICULTY[2].name);
    check(o.text?.includes(vet) && params(o.url).utm_content === "perigo", "na aba do Perigo, o maior vencido (lido do save)", o.text);
    // sem pontuação nem vitória: o convite de sempre
    await t.page.evaluate(async () => {
      localStorage.setItem("guardiao_ranking_v1", "{}");
      const s = window.game.scene.getScene("CampScene");
      s.meta.data.winsByDifficulty = {};
      while (s._modals?.length) s._modals.at(-1).close();
      (await import("/src/ui/RankingModal.js")).openRanking(s, { board: "score", span: "week" });
    });
    await t.page.waitForTimeout(700);
    await press();
    await settle(t, 3);
    o = (await inv(t)).shares.at(-1) ?? {};
    check(params(o.url ?? "http://x").utm_content === "geral", "sem feito: o convite de sempre", o.text);
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
      ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, locale: LOC, serviceWorkers: "block", hasTouch: true });
      page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push(e.message));
      await page.addInitScript(fake, { ...cfg, local: { ...SET, ...(cfg.local || {}) } });
      await page.goto(URL);
      await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
      await page.waitForTimeout(800);
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
