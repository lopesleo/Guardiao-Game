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
      decline: false, // o jogador fecha a entrada do Play Games
      signInError: false, // a entrada falha (rede, credencial ainda ativando)
      submitDelay: 0, // ms até o Play Games confirmar o envio (no aparelho, a rede)
      submitError: null, // código do Play Games: o envio falha com ele (com rede e login)
      signIns: 0,
      reads: 0, // conferências da nuvem (CloudSave)
      sent: [],
      loads: [],
      log: [], // envios e listas na ordem em que aconteceram
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
        signIn: async () => {
          G.signIns++;
          if (G.signInError) return { configured: G.configured, authenticated: false, error: true };
          if (G.decline) return { configured: G.configured, authenticated: false, error: false };
          G.signedIn = true;
          return { configured: G.configured, authenticated: true, error: false };
        },
        read: async () => (G.reads++, { data: null, modified: 0 }),
        write: async () => ({ modified: Date.now() }),
        submitScore: async ({ leaderboardId, score }) => {
          if (!G.online || !G.signedIn) throw new Error("submit_failed");
          if (G.submitError) throw Object.assign(new Error("submit_failed"), { code: G.submitError });
          if (G.submitDelay) await new Promise((r) => setTimeout(r, G.submitDelay));
          G.sent.push([idOf(leaderboardId), score]);
          G.log.push(["envio", idOf(leaderboardId), score]);
        },
        loadScores: async ({ leaderboardId, span, max }) => {
          G.loads.push([idOf(leaderboardId), span, max]);
          G.log.push(["lista", idOf(leaderboardId), span]);
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

  // Sem login no Play Games (o pedido da 1ª abertura já foi recusado): o ranking pede para entrar; entrando, a
  // lista aparece
  async login(t) {
    await t.boot({ pg: { signedIn: false }, local: { guardiao_pg_asked: "1" } });
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

  // 1ª abertura sem login automático: o jogo pede uma vez; entrou, a nuvem confere e os rankings ligam. Na
  // abertura seguinte não pede de novo
  async pedeUmaVez(t) {
    await t.boot({ pg: { signedIn: false } });
    await t.page.waitForTimeout(1200);
    let g = await t.pg();
    check(g.signIns === 1 && g.signedIn, "pediu a entrada uma vez e entrou", JSON.stringify({ signIns: g.signIns }));
    check(g.reads >= 1, "entrou: a nuvem conferiu o progresso", `leituras: ${g.reads}`);
    check(await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.signedIn), "os rankings sabem do login");
    await t.reload({ pg: { signedIn: false } });
    g = await t.pg();
    check(g.signIns === 0, "na abertura seguinte não pede de novo", JSON.stringify({ signIns: g.signIns }));
  },

  // Recusou o pedido: não insiste (fica para Opções ou o ranking)
  async recusou(t) {
    await t.boot({ pg: { signedIn: false, decline: true } });
    await t.page.waitForTimeout(1200);
    let g = await t.pg();
    check(g.signIns === 1 && !g.signedIn && g.reads === 0, "pediu uma vez; recusou, nada da nuvem", JSON.stringify({ signIns: g.signIns, reads: g.reads }));
    await t.reload({ pg: { signedIn: false, decline: true } });
    g = await t.pg();
    check(g.signIns === 0, "recusou: não pede de novo na abertura seguinte", JSON.stringify({ signIns: g.signIns }));
  },

  // A entrada falhou por erro (credencial ainda ativando, sem rede): pede de novo na próxima abertura
  async erroNoLogin(t) {
    await t.boot({ pg: { signedIn: false, signInError: true } });
    await t.page.waitForTimeout(1200);
    check((await t.pg()).signIns === 1, "pediu a entrada");
    await t.reload({ pg: { signedIn: false } });
    const g = await t.pg();
    check(g.signIns === 1 && g.signedIn, "deu erro: pede de novo na abertura seguinte e entra", JSON.stringify({ signIns: g.signIns }));
  },

  // O caso do aparelho (1.0.11): perdeu sem login, entrou pelo ranking. A partida sobe ANTES de a lista carregar,
  // e a nuvem também fica sabendo do login
  async entrouPeloRanking(t) {
    await t.boot({ pg: { signedIn: false, submitDelay: 500 }, local: { guardiao_pg_asked: "1" } });
    await enable(t);
    const r = await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.submitRun({ kills: 321, won: false, difficulty: 2 }));
    await t.page.waitForTimeout(300);
    check((await t.pg()).sent.length === 0, "sem login a derrota espera na fila", JSON.stringify(r));
    await toCamp(t);
    await campReady(t);
    await t.page.evaluate(() => window.game.scene.getScene("CampScene").rankBtn.onClick());
    await t.page.waitForTimeout(800);
    const label = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).tr("ENTRAR NO PLAY GAMES"));
    await pressInModal(t, "CampScene", label);
    await t.page.waitForTimeout(1200);
    const g = await t.pg();
    const iSent = g.log.findIndex(([k, b, v]) => k === "envio" && b === "score" && v === r.score);
    const iList = g.log.findIndex(([k, b], i) => k === "lista" && b === "score" && i > 0);
    check(iSent >= 0, `a derrota subiu ao entrar (${r.score} pontos)`, JSON.stringify(g.log));
    check(iSent >= 0 && iList > iSent, "a lista carregou depois do envio (a partida aparece)", JSON.stringify(g.log));
    check(g.reads >= 1, "a nuvem conferiu depois do login pelo ranking", `leituras: ${g.reads}`);
    const q = await t.page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_ranking_v1")).queue);
    check(!q?.score, "a fila ficou vazia", JSON.stringify(q));
  },

  // O caso do aparelho (1.0.12): perdeu, abriu o ranking e a lista veio vazia. Se o envio falhou no Play Games, a
  // janela diz que a partida não chegou (com o código) em vez de "ninguém pontuou"; tentar de novo manda e mostra
  async envioFalhou(t) {
    await t.boot({ pg: { submitError: "26507" } });
    await enable(t);
    await t.page.evaluate(() => (window.__pg.lists.score = { scores: [], player: null, total: 0 }));
    const r = await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.submitRun({ kills: 14, won: false, difficulty: 1 }));
    await t.page.waitForTimeout(300);
    let q = await t.page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_ranking_v1")).queue);
    check(r.score === 182 && q?.score === 182 && (await t.pg()).sent.length === 0, "o envio falhou: 182 pontos esperam na fila", JSON.stringify({ r, q }));
    await toCamp(t);
    await campReady(t);
    await t.page.evaluate(() => window.game.scene.getScene("CampScene").rankBtn.onClick());
    await t.page.waitForTimeout(900);
    const L = await t.page.evaluate(async () => {
      const { tr } = await import("/src/i18n/i18n.js");
      return {
        stuck: tr("Sua última partida ainda não chegou ao Play Games (erro {0}).", "26507"),
        empty: tr("Ninguém pontuou nesta semana ainda. Que tal ser o primeiro?"),
        retry: tr("TENTAR DE NOVO"),
        me: tr("{0} (você)", "Leo"),
      };
    });
    let mt = await modalTexts(t, "CampScene");
    check(mt && mt.texts.includes(L.stuck) && !mt.texts.includes(L.empty), "a janela diz que a partida não chegou, com o código", JSON.stringify(mt?.texts.slice(0, 8)));
    check(mt && mt.texts.includes(L.retry), "e oferece TENTAR DE NOVO");
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_falhou.png` });
    await t.page.evaluate(() => {
      window.__pg.submitError = null;
      window.__pg.lists.score = { scores: [{ rank: 1, name: "Leo", score: 182, me: true }], player: { rank: 1, score: 182 }, total: 1 };
    });
    await pressInModal(t, "CampScene", L.retry);
    await t.page.waitForTimeout(900);
    const g = await t.pg();
    mt = await modalTexts(t, "CampScene");
    q = await t.page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_ranking_v1")).queue);
    check(g.sent.some(([b, v]) => b === "score" && v === 182) && !q?.score, "tentar de novo manda e esvazia a fila", JSON.stringify(g.sent));
    check(mt && mt.texts.includes(L.me) && !mt.texts.includes(L.stuck), "a partida aparece na lista e o aviso some", JSON.stringify(mt?.texts.slice(0, 8)));
  },

  // Lista cheia e a partida do jogador presa na fila: o aviso vai na linha de baixo da lista e cabe nela
  async avisoNaLista(t) {
    await t.boot({ pg: { submitError: "26502" } });
    await enable(t);
    await t.page.evaluate(async () => (await import("/src/systems/Leaderboards.js")).Leaderboards.submitRun({ kills: 500, won: false, difficulty: 0 }));
    await t.page.waitForTimeout(300);
    await toCamp(t);
    await campReady(t);
    await t.page.evaluate(() => window.game.scene.getScene("CampScene").rankBtn.onClick());
    await t.page.waitForTimeout(900);
    const stuck = await t.page.evaluate(async () => (await import("/src/i18n/i18n.js")).tr("Sua última partida ainda não chegou ao Play Games (erro {0}).", "26502"));
    const fit = await t.page.evaluate((stuck) => {
      const m = window.game.scene.getScene("CampScene")._modals.at(-1);
      const deep = (o) => (o.list ? o.list.flatMap(deep) : [o]);
      const n = deep(m.root).find((o) => o.type === "Text" && o.text === stuck);
      const names = deep(m.root).filter((o) => o.type === "Text" && /Iara_da_Lagoa/.test(o.text)).length;
      return n ? { w: n.displayWidth, room: m.w - 80, names } : { names };
    }, stuck);
    check(fit.w > 0 && fit.w <= fit.room, "o aviso aparece embaixo da lista e cabe", JSON.stringify(fit));
    check(fit.names > 0, "a lista continua lá");
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_aviso.png` });
  },

  // A lista pública veio vazia mas o Play Games tem a pontuação do jogador (sem posição): a linha "Você" no
  // topo, em vez de "ninguém pontuou"
  async soAPropria(t) {
    await t.boot();
    await enable(t);
    await t.page.evaluate(() => (window.__pg.lists.score = { scores: [], player: { rank: -1, score: 182 }, total: 0 }));
    await toCamp(t);
    await campReady(t);
    await t.page.evaluate(() => window.game.scene.getScene("CampScene").rankBtn.onClick());
    await t.page.waitForTimeout(900);
    const L = await t.page.evaluate(async () => {
      const { tr } = await import("/src/i18n/i18n.js");
      return { you: tr("Você"), empty: tr("Ninguém pontuou nesta semana ainda. Que tal ser o primeiro?") };
    });
    const mt = await modalTexts(t, "CampScene");
    check(mt && mt.texts.includes(L.you) && mt.texts.includes("182") && mt.texts.includes("—"), "a linha do jogador aparece (posição —, 182)", JSON.stringify(mt?.texts.slice(0, 8)));
    check(mt && !mt.texts.includes(L.empty), "não diz que ninguém pontuou");
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/${LOC}_${TS}_rank_so_eu.png` });
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
    // reabre o app no mesmo aparelho (o localStorage fica; o Play Games falso nasce de novo com cfg)
    async reload(cfg = {}) {
      // roda depois do fakeNative (que remonta o falso com o cfg do boot): zera os contadores e aplica este cfg
      await page.addInitScript(
        (pg) => Object.assign(window.__pg, { signIns: 0, reads: 0, sent: [], loads: [], log: [], decline: false, signInError: false, submitError: null, signedIn: true }, pg),
        cfg.pg || {},
      );
      await page.reload();
      await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
      await page.waitForTimeout(1200);
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
