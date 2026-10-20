// Teste dos rankings (systems/Leaderboards.js + ui/RankingModal.js) num navegador de verdade, com um Play Games
// FALSO (window.Capacitor.Plugins.PlayGames) que registra os envios e devolve listas prontas. Confere: sem o
// Play Games nada aparece; com ele, o fim da partida manda a pontuação certa (e o maior Perigo), a fila segura o envio
// sem rede e manda depois, o maior Perigo já vencido sobe uma vez, a janela mostra a lista (com a linha do
// jogador), as abas, os estados sem login, sem rede e vazio, e o botão da Clareira não encosta no quadro.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:rankings                  (ou: node tools/test-rankings.mjs)
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

// Roda no navegador antes do jogo: o app "nativo" com Play Games, AdMob e lembretes falsos
function fakeNative(cfg) {
  const names = ["Iara_da_Lagoa", "Curupira77", "ガーディアン", "守护者小明", "SaciPererê", "Caipora", "Boitatá_BR", "MapinguariSlayer_um_apelido_comprido_demais_para_caber_na_linha_do_ranking_nem_a_pau", "Tucano", "Jequitibá"];
  const top = (n) => Array.from({ length: n }, (_, i) => ({ rank: i + 1, name: names[i % names.length], score: 90000 - i * 7300, me: false }));
  const G = (window.__pg = Object.assign(
    {
      configured: true,
      signedIn: true,
      online: true,
      sent: [],
      loads: [],
      lists: { score: { scores: top(10), player: { rank: 37, score: 13450 }, total: 512 }, perigo: { scores: top(10).map((s, i) => ({ ...s, score: 5 - (i >> 2) })), player: null, total: 120 } },
    },
    cfg.pg,
  ));
  for (const [k, v] of Object.entries(cfg.local || {})) localStorage.setItem(k, JSON.stringify(v));
  // qual ranking: os IDs de teste têm "perigo" no nome; os de verdade vêm do RANKING.IDS
  let perigoId = null;
  import("/src/config.js").then(({ RANKING }) => (perigoId = RANKING.IDS.perigo));
  const idOf = (id) => (id.includes("perigo") || id === perigoId ? "perigo" : "score");
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
      PlayGames: {
        status: async () => ({ configured: G.configured, authenticated: G.configured && G.signedIn }),
        signIn: async () => ((G.signedIn = true), { configured: G.configured, authenticated: true }),
        read: async () => ({ data: null, modified: 0 }),
        write: async () => ({ modified: Date.now() }),
        submitScore: async ({ leaderboardId, score }) => {
          if (!G.online || !G.signedIn) throw new Error("submit_failed");
          G.sent.push([idOf(leaderboardId), score]);
        },
        loadScores: async ({ leaderboardId, span, max }) => {
          G.loads.push([idOf(leaderboardId), span, max]);
          if (!G.online) throw new Error("load_failed");
          return JSON.parse(JSON.stringify(G.lists[idOf(leaderboardId)]));
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
const SET = (o = {}) => ({ guardiao_settings_v1: { music: 0, sfx: 0, textSize: TS, ...o } });

// Liga os rankings como se o `npm run play:rankings -- criar` tivesse gravado os IDs
const enable = (t) =>
  t.page.evaluate(async () => {
    const { RANKING } = await import("/src/config.js");
    RANKING.IDS.score = "CgkTESTE_score";
    RANKING.IDS.perigo = "CgkTESTE_perigo";
    const { Leaderboards } = await import("/src/systems/Leaderboards.js");
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    await Leaderboards.install(new MetaProgression());
    return Leaderboards.available();
  });
const toCamp = (t) =>
  t.page.evaluate(async () => {
    const ti = window.game.scene.getScene("TitleScene");
    ti.meta.data.campIntroSeen = true;
    ti.meta._save();
    ti.scene.start("CampScene");
  });
const campReady = (t) => t.page.waitForFunction(() => window.game.scene.getScene("CampScene")?.player && !window.game.scene.getScene("CampScene")._cutscene, null, { timeout: 60000 });
const modalTexts = (t, scene) =>
  t.page.evaluate((scene) => {
    const s = window.game.scene.getScene(scene);
    const m = s._modals?.at(-1);
    if (!m) return null;
    const deep = (o) => (o.list ? o.list.flatMap(deep) : [o]);
    return { title: m.titleText.text, texts: deep(m.root).filter((o) => o.type === "Text" && o.visible).map((o) => o.text) };
  }, scene);
const pressInModal = (t, scene, label) =>
  t.page.evaluate(
    ({ scene, label }) => {
      const s = window.game.scene.getScene(scene);
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      const b = deep(s._modals.at(-1).root).find((o) => o.label?.text === label);
      if (!b) return false;
      b.onClick();
      return true;
    },
    { scene, label },
  );

const SCENARIOS = {
  // Sem o Play Games no aparelho (o plugin diz que não está configurado): nem botão na Clareira nem pontos no
  // fim; o recorde no aparelho segue
  async desligado(t) {
    await t.boot({ pg: { configured: false } });
    const off = await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.available());
    check(off === false, "sem o Play Games os rankings ficam desligados");
    await toCamp(t);
    await campReady(t);
    check(!(await t.page.evaluate(() => !!window.game.scene.getScene("CampScene").rankBtn)), "sem botão de ranking na Clareira");
    check((await t.pg()).sent.length === 0, "nada enviado ao Play Games");
  },

  // Quem já venceu antes dos rankings: o maior Perigo sobe uma vez (e não de novo na próxima abertura)
  async retroativo(t) {
    await t.boot({ local: { ...SET(), guardiao_ranking_v1: {} } });
    await t.page.evaluate(() => {
      const ti = window.game.scene.getScene("TitleScene");
      ti.meta.data.winsByDifficulty = { 0: 3, 2: 1 };
      ti.meta.data.wins = 4;
      ti.meta._save();
    });
    check(await enable(t), "com os IDs os rankings ligam");
    let g = await t.pg();
    check(JSON.stringify(g.sent) === JSON.stringify([["perigo", 3]]), "subiu o maior Perigo já vencido (Veterano = 3)", JSON.stringify(g.sent));
    await enable(t);
    g = await t.pg();
    check(g.sent.length === 1, "na abertura seguinte não manda de novo", JSON.stringify(g.sent));
  },

  // Fim de uma partida de verdade: pontos certos, maior Perigo, e os pontos na tela do fim (recorde)
  async fimDePartida(t) {
    await t.boot();
    await enable(t);
    // a 1ª partida termina na cena da 1ª derrota (história), não na tela de resultado: parte de quem já jogou
    await t.page.evaluate(() => {
      const ti = window.game.scene.getScene("TitleScene");
      ti.meta.data.runsPlayed = 3;
      ti.meta.data.firstDefeatSeen = true;
      ti.meta._save();
      ti.scene.start("GameScene");
    });
    await t.page.waitForFunction(() => window.game.scene.getScene("GameScene")?.player && !window.game.scene.getScene("GameScene")._intro, null, { timeout: 60000 });
    await t.page.evaluate(() => {
      const g = window.game.scene.getScene("GameScene");
      g.hud.kills = 845;
      g._onGameOver(true, false, true);
    });
    await t.page.waitForFunction(() => window.game.scene.isActive("GameOverScene"), null, { timeout: 20000 }).catch(async (e) => {
      console.log("    cenas ativas:", await t.page.evaluate(() => window.game.scene.getScenes(true).map((s) => s.scene.key).join(","), await t.page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); return JSON.stringify({ over: g.gameOver, paused: g.scene.isPaused(), t: g.time.now }); })));
      throw e;
    });
    await t.page.waitForTimeout(2600);
    const g = await t.pg();
    // Aprendiz (×1): 845 × 10 + 5000
    check(g.sent.some(([b, v]) => b === "score" && v === 13450), "mandou 13.450 pontos (845 abates × 10 + 5.000, ×1)", JSON.stringify(g.sent));
    check(g.sent.some(([b, v]) => b === "perigo" && v === 1), "venceu no Aprendiz: Perigo 1", JSON.stringify(g.sent));
    const pill = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("GameOverScene");
      const b = s.children.list.find((o) => o.label && /pontos|points|puntos|点|分/.test(o.label.text));
      if (!b) return null;
      const r = b.getBounds();
      const head = s.children.list.find((o) => o.type === "Text" && /PERIGO|DANGER|PELIGRO|危/.test(o.text));
      const h = head.getBounds();
      return { label: b.label.text, alpha: b.alpha, x: r.x, right: r.x + r.width, headRight: h.x + h.width * 1 };
    });
    check(pill && /RECORDE|RECORD|RÉCORD|記録|纪录|紀錄/.test(pill.label), "o fim mostra os pontos como recorde", pill?.label);
    check(pill && pill.headRight <= pill.x - 8, "a faixa do Perigo não encosta nos pontos", JSON.stringify(pill));
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_fim.png` });
    await t.page.evaluate(() => {
      const s = window.game.scene.getScene("GameOverScene");
      s.children.list.find((o) => o.label && /pontos|points|puntos|点|分/.test(o.label.text)).onClick();
    });
    await t.page.waitForTimeout(900);
    const mt = await modalTexts(t, "GameOverScene");
    check(mt && mt.texts.some((x) => /Iara_da_Lagoa/.test(x)), "tocar nos pontos abre o ranking", mt?.title);
  },

  // Sem rede: a pontuação espera na fila (no aparelho) e sai quando a rede volta
  async fila(t) {
    await t.boot({ pg: { online: false } });
    await enable(t);
    const r = await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.submitRun({ kills: 1000, won: false, difficulty: 4 }));
    check(r.score === 30000, "Pesadelo ×3: 1.000 abates = 30.000", JSON.stringify(r));
    await t.page.waitForTimeout(300);
    const q = await t.page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_ranking_v1")).queue);
    check(q?.score === 30000 && (await t.pg()).sent.length === 0, "sem rede fica na fila", JSON.stringify(q));
    await t.page.evaluate(async () => {
      window.__pg.online = true;
      await (await import("/src/systems/Leaderboards.js")).Leaderboards.flush();
    });
    const g = await t.pg();
    const q2 = await t.page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_ranking_v1")).queue);
    check(g.sent.some(([b, v]) => b === "score" && v === 30000) && !q2.score, "com rede manda e limpa a fila", JSON.stringify(g.sent));
    const coop = await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.submitRun({ kills: 5000, won: true, difficulty: 4, mode: "coop" }));
    await t.page.waitForTimeout(200);
    check(!coop.record && (await t.pg()).sent.length === g.sent.length, "partida em dupla (coop) não entra no ranking solo");
  },

  // A janela: lista, linha do jogador fora do topo, abas, período, estados
  async janela(t) {
    await t.boot();
    await enable(t);
    await toCamp(t);
    await campReady(t);
    const hud = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("CampScene");
      const b = s.rankBtn;
      if (!b) return null;
      const f = s.hudFrame.getBounds ? null : null;
      return { x: b.x, visible: b.visible, titleRight: s.hudTitle.x + s.hudTitle.displayWidth, infoRight: s.hudInfo.x + s.hudInfo.displayWidth };
    });
    check(hud?.visible, "botão de ranking na Clareira");
    check(hud && hud.x - 26 > Math.max(hud.titleRight, hud.infoRight) + 10, "o botão não encosta no quadro da Clareira", JSON.stringify(hud));
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_clareira.png` });
    await t.page.evaluate(() => window.game.scene.getScene("CampScene").rankBtn.onClick());
    await t.page.waitForTimeout(900);
    let mt = await modalTexts(t, "CampScene");
    check(mt && mt.texts.filter((x) => /Iara_da_Lagoa|Curupira77|Jequitibá/.test(x)).length === 3, "a lista aparece (10 nomes)", mt?.texts.length);
    check(mt && mt.texts.some((x) => /^37/.test(x) || /37/.test(x)), "a posição do jogador fora do topo (37º)");
    check(mt && mt.texts.some((x) => /…$/.test(x)), "nome comprido encurtado com …");
    check(mt && mt.texts.some((x) => /512/.test(x)), "total de jogadores no período");
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_janela.png` });
    const perigoTab = await t.page.evaluate(async () => {
      const { tr } = await import("/src/i18n/i18n.js");
      return tr("MAIOR PERIGO");
    });
    await pressInModal(t, "CampScene", perigoTab);
    await t.page.waitForTimeout(700);
    mt = await modalTexts(t, "CampScene");
    const pesadelo = await t.page.evaluate(async () => (await import("/src/config.js")).DIFFICULTY[4].name);
    check(mt && mt.texts.includes(pesadelo), "aba do maior Perigo mostra o nome do Perigo", pesadelo);
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_perigo.png` });
    const sempre = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).tr("DE SEMPRE"));
    await pressInModal(t, "CampScene", sempre);
    await t.page.waitForTimeout(700);
    check((await t.pg()).loads.some(([b, s]) => b === "perigo" && s === "all"), "\"de sempre\" pede o período todo");
    // vazio
    await t.page.evaluate(() => {
      window.__pg.lists.score = { scores: [], player: null, total: 0 };
      const s = window.game.scene.getScene("CampScene");
      while (s._modals?.length) s._modals.at(-1).close();
    });
    await t.page.evaluate(async () => (await import("/src/ui/RankingModal.js")).openRanking(window.game.scene.getScene("CampScene"), { board: "score", span: "week", fresh: true }));
    await t.page.waitForTimeout(700);
    mt = await modalTexts(t, "CampScene");
    const empty = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).tr("Ninguém pontuou nesta semana ainda. Que tal ser o primeiro?"));
    check(mt && mt.texts.includes(empty), "ranking vazio convida a ser o primeiro");
    // sem rede
    await t.page.evaluate(() => {
      window.__pg.online = false;
      const s = window.game.scene.getScene("CampScene");
      while (s._modals?.length) s._modals.at(-1).close();
    });
    await t.page.evaluate(async () => (await import("/src/ui/RankingModal.js")).openRanking(window.game.scene.getScene("CampScene"), { board: "score", span: "all", fresh: true }));
    await t.page.waitForTimeout(700);
    mt = await modalTexts(t, "CampScene");
    const retry = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).tr("TENTAR DE NOVO"));
    check(mt && mt.texts.includes(retry), "sem rede: aviso e TENTAR DE NOVO");
    await t.page.evaluate(() => (window.__pg.online = true));
    await pressInModal(t, "CampScene", retry);
    await t.page.waitForTimeout(700);
    mt = await modalTexts(t, "CampScene");
    check(mt && !mt.texts.includes(retry), "tentar de novo carrega a lista");
  },

  // Sem login no Play Games: pede para entrar; entrando, a lista aparece
  async login(t) {
    await t.boot({ pg: { signedIn: false } });
    await enable(t);
    await toCamp(t);
    await campReady(t);
    await t.page.evaluate(() => window.game.scene.getScene("CampScene").rankBtn.onClick());
    await t.page.waitForTimeout(800);
    const label = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).tr("ENTRAR NO PLAY GAMES"));
    let mt = await modalTexts(t, "CampScene");
    check(mt && mt.texts.includes(label), "sem login: botão de entrar no Play Games");
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_login.png` });
    await pressInModal(t, "CampScene", label);
    await t.page.waitForTimeout(900);
    mt = await modalTexts(t, "CampScene");
    check(mt && mt.texts.some((x) => /Iara_da_Lagoa/.test(x)), "entrou: a lista aparece");
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
      ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, locale: LOC, serviceWorkers: "block" });
      page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push(e.message));
      await page.addInitScript(fakeNative, { ...cfg, local: { ...SET(), ...(cfg.local || {}) } });
      await page.goto(URL);
      await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
      await page.waitForTimeout(800);
    },
    pg: () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pg))),
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
