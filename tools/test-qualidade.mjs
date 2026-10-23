// Teste da QUALIDADE AUTOMÁTICA (src/systems/Quality.js) e do evento perf_run num navegador de verdade.
// A carga é SINTÉTICA e por degrau (uma espera ocupada antes do desenho, window.__load[degrau] ms por quadro):
// o mesmo resultado em qualquer PC, e dá para montar cada caso — degrau pesado e o de baixo leve (a descida
// rende), carga igual em todos (a descida não rende: tela presa em 30 Hz), um tranco isolado, folga para subir.
// Os parâmetros são os de QUALITY.AUTO; só a espera para subir é encurtada nos casos de subida (o teste não
// precisaria de minutos), e a lógica é a mesma.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:qualidade                 (ou: node tools/test-qualidade.mjs)
//
// Casos: desce (queda sustentada desce um degrau, guarda o aprendido e não volta a subir sem folga) · pico (um
// tranco isolado e uma rajada curta não descem) · sobe (folga sustentada sobe um degrau por vez, com histerese)
// · vaivem (se a previsão de folga erra, cada tentativa de subir que falha volta na hora e a espera dobra) ·
// cpu (o quadro do jogo é o gargalo e a Média rende pouco: segue até a Baixa) · semganho (os quadros demoram
// por fora do jogo — carga num outro retorno do requestAnimationFrame, como a tela presa em 30 Hz: descer
// não rende, volta e vira o piso) · manual (Alta/Média/Baixa fixas: o automático só mede;
// trocar nas Opções da Pausa vale na hora) · perf (perf_run uma vez por partida, campos e tipos, o que chega ao
// Firebase e nada com "Dados de uso" desligado) · ouvintes que não somam ao jogar de novo · sem erros no console.
//
// Variáveis: ONLY=desce,pico,…  LAB_URL=… (servidor já rodando)  SHOTS=pasta (capturas dos 3 degraus: noite,
// horda e aviso de golpe do chefe)  PROVA=1 (aparelho fraco de verdade: CPU RATE× mais lenta pelo CDP numa
// partida carregada; mostra o automático descendo, voltando e parado, quadro a quadro)  MEDIR=1 (custo de cada
// degrau: a mesma partida pesada com relógio virtual, CPU RATE× mais lenta, REPS repetições de SECS s)
// Armadilhas: page.evaluate não pode devolver objetos do Phaser (serializar estoura a memória) — por isso os
// "void"; o relógio aqui é o real (performance.now): o automático mede tempo de verdade, não o da cena.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { startLabServer } from "./lab-server.mjs";

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SHOTS = process.env.SHOTS || "";
const PROVA = !!process.env.PROVA;
const MEDIR = !!process.env.MEDIR;
const RATE = Number(process.env.RATE || (MEDIR ? 4 : 6));
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url;
const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});

let failures = 0;
const check = (ok, what, extra = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${what}${extra ? "  " + extra : ""}`);
  return ok;
};
const want = (name) => !ONLY || ONLY.includes(name);
const IDS = ["high", "medium", "low"];

// ---------------------------------------------------------------- página e partida
async function openPage({ viewport = { width: 1280, height: 600 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: "pt-BR", serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push("console: " + m.text()));
  await page.addInitScript(() => localStorage.setItem("guardiao_settings_v1", JSON.stringify({ music: 0, sfx: 0 })));
  await page.goto(URL + "?debug=1");
  await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
  // save de quem já jogou (a partida termina na tela de resultado, sem a história da 1ª queda) e a carga sintética
  await page.evaluate(async () => {
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const m = new MetaProgression();
    m.data.firstDefeatSeen = true;
    m.data.runsPlayed = Math.max(5, m.data.runsPlayed || 0);
    m.data.hintsSeen = ["move", "chest", "reaction", "wood", "awaken"];
    m._save();
    const { Quality } = await import("/src/systems/Quality.js");
    window.__load = [0, 0, 0];
    window.__spikes = [];
    window.game.events.on("prerender", () => {
      const gs = window.game.scene.getScene("GameScene");
      if (!gs?.sys.isActive() || gs._intro) return;
      const ms = window.__spikes.length ? window.__spikes.shift() : window.__load[Quality.current()];
      if (ms > 0) {
        const t = performance.now();
        while (performance.now() - t < ms);
      }
    });
    // carga FORA do quadro do jogo (outro retorno de requestAnimationFrame): os quadros demoram e o trabalho do
    // jogo não — como a tela presa em 30 Hz pela economia de bateria, ou outro app pesando
    window.__ext = [0, 0, 0];
    const ext = () => {
      const gs = window.game.scene.getScene("GameScene");
      const ms = gs?.sys.isActive() && !gs._intro ? window.__ext[Quality.current()] : 0;
      if (ms > 0) {
        const t = performance.now();
        while (performance.now() - t < ms);
      }
      requestAnimationFrame(ext);
    };
    requestAnimationFrame(ext);
    const { QUALITY } = await import("/src/config.js");
    window.__autoBase = JSON.parse(JSON.stringify(QUALITY.AUTO));
  });
  const until = (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  // ouvintes do laço do jogo com uma partida andando (o automático escuta prestep/postrender, que sobrevivem às cenas)
  const listeners = () => page.evaluate(() => ["prestep", "postrender"].map((k) => `${k}:${window.game.events.listenerCount(k)}`).join(" "));
  const counts = [];
  const env = { fps: 60 }; // ritmo de quadros deste navegador sem carga (calibra o alvo: ver casos())
  // Partida nova: escolha de qualidade, degrau aprendido e parâmetros do automático (o resto, os de config.js)
  const startRun = async ({ quality = "auto", learned = null, auto = {}, load = [0, 0, 0], ext = [0, 0, 0] } = {}) => {
    await page.evaluate(
      async ({ quality, learned, auto, load, ext }) => {
        const { Settings } = await import("/src/systems/Settings.js");
        Settings.set("quality", quality);
        Settings.set("qualityAuto", learned);
        const { QUALITY } = await import("/src/config.js");
        Object.assign(QUALITY.AUTO, JSON.parse(JSON.stringify(window.__autoBase)), auto);
        window.__load = load;
        window.__ext = ext;
        window.__spikes = [];
        const g = window.game;
        for (const s of g.scene.getScenes(true)) if (s.scene.key !== "GameScene") g.scene.stop(s.scene.key);
        g.scene.start("GameScene");
      },
      { quality, learned, auto, load, ext },
    );
    await until(() => { const g = window.game.scene.getScene("GameScene"); return g?.sys.isActive() && g.player && !g._intro && g.quality && g.elapsedMs > 0; });
    // partida previsível: herói imune, sem cartas (XP) e sem baú (o dourado dá carta extra)
    // alvo = o ritmo que este navegador entrega sem carga (no celular é o teto de 60; no headless de uma máquina
    // ocupada sai 55–58 e "boa" (≥ 95% de 60) nunca chegaria): só a régua muda, a lógica é a mesma
    await page.evaluate((fps) => {
      const g = window.game.scene.getScene("GameScene");
      g._god = true;
      g.player.gainXp = () => {};
      g._openChest = () => {};
      g.quality.target = fps;
      g.quality.budget = 1000 / fps;
    }, env.fps);
    counts.push(await listeners());
  };
  const setLoad = (load) => page.evaluate((l) => (window.__load = l), load);
  // Estado do automático (números simples: nada do Phaser sai da página)
  const q = () =>
    page.evaluate(() => {
      const g = window.game.scene.getScene("GameScene");
      const a = g.quality;
      return {
        tier: a.tier,
        changes: a.changes,
        log: a.log.slice(),
        windows: a.windows.map((w) => ({ t: w.t, fps: Math.round(w.fps * 10) / 10, busy: Math.round(w.busy * 10) / 10, tier: w.tier })),
        upWait: a.upWait,
        maxTier: a.maxTier,
        probe: !!a.probe,
        cost: a.cost.slice(),
        light: g.lighting.enabled,
        lightK: g.lighting._k,
        rot: g.world.podridao.mode,
        fx: g.fx.q,
        t: g.elapsedMs / 1000,
      };
    });
  const tl = (s) => s.windows.map((w) => `${w.t.toFixed(0)}s ${w.fps.toFixed(0)}fps ${w.busy.toFixed(1)}ms ${IDS[w.tier][0].toUpperCase()}`).join(" | ");
  return { ctx, page, errs, until, startRun, setLoad, q, counts, tl, env };
}

// ---------------------------------------------------------------- casos
async function casos() {
  const T = await openPage();
  const { page, until, startRun, setLoad, q, tl } = T;
  // Calibração: o ritmo deste navegador sem carga nenhuma (mediana de 3 janelas), até 60
  await startRun({ quality: "high", load: [0, 0, 0] });
  await until(() => window.game.scene.getScene("GameScene").quality.windows.length >= 3, null, 40000);
  const idle = (await q()).windows.map((w) => w.fps).sort((a, b) => a - b)[1];
  T.env.fps = Math.min(60, idle);
  console.log(`
(calibração: ${idle.toFixed(1)} fps sem carga neste navegador → alvo ${T.env.fps.toFixed(1)})`);
  check(idle > 40, "o navegador do teste entrega quadros suficientes para medir", `${idle.toFixed(1)} fps`);

  if (want("desce")) {
    console.log("\n== queda sustentada: desce um degrau e fica ==");
    // Alta pesada (30 ms de trabalho a mais: ~30 fps), Média leve — a descida rende
    await startRun({ quality: "auto", load: [30, 6, 3] });
    let s = await q();
    check(s.tier === 0 && s.light && s.rot === "full" && s.fx === 1, "a partida começa na Alta (nada aprendido ainda)", `degrau=${IDS[s.tier]}`);
    await until(() => window.game.scene.getScene("GameScene").quality.changes >= 1, null, 40000);
    s = await q();
    const first = s.log[0];
    const badBefore = s.windows.filter((w) => w.tier === 0 && w.fps < T.env.fps * 0.85).length;
    check(first.from === 0 && first.to === 1, "desce da Alta para a Média", `${first.why}, ${first.fps} fps`);
    check(badBefore >= 2, "só depois de janelas ruins seguidas (não na 1ª)", `janelas ruins antes=${badBefore}`);
    // o teste depois da troca (2 janelas) aceita: rendeu e resolveu
    await until(() => { const a = window.game.scene.getScene("GameScene").quality; return !a.probe && a.windows.filter((w) => w.tier === 1).length >= 3; }, null, 30000);
    s = await q();
    check(s.tier === 1 && s.changes === 1, "a descida fica (rendeu e resolveu)", `degrau=${IDS[s.tier]} trocas=${s.changes}`);
    check(s.cost[0] > 1.5, "mede o custo da Alta sobre a Média na descida", `custo=${s.cost[0]?.toFixed(2)}`);
    check(s.light && s.rot === "full" && Math.abs(s.fx - 0.7) < 1e-9, "Média: luz e Podridão com tentáculos seguem; partículas a 70%", `luz=${s.light} podridão=${s.rot} fx=${s.fx}`);
    const learned = await page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_settings_v1")).qualityAuto);
    check(learned === 1, "o degrau aprendido fica guardado para a próxima partida", `qualityAuto=${learned}`);
    // Não oscila: a Alta continua pesada e a Média folgada; a previsão (trabalho de agora × custo medido) não
    // deixa tentar subir. 24 s = mais que a espera para subir (20 s depois da 1ª descida dobra para 40 s)
    const t0 = s.t;
    await page.waitForTimeout(24000);
    s = await q();
    check(s.changes === 1 && s.tier === 1, "não oscila: 24 s folgado na Média sem tentar a Alta pesada", `trocas=${s.changes} (${(s.t - t0).toFixed(0)} s)`);
    console.log("     linha do tempo:", tl(s));
  }

  if (want("pico")) {
    console.log("\n== picos isolados: não desce ==");
    await startRun({ quality: "auto", load: [0, 0, 0] });
    await until(() => window.game.scene.getScene("GameScene").quality.windows.length >= 1, null, 30000);
    // um tranco de 400 ms a cada ~2,5 s (coleta de lixo, shader novo) e uma rajada de 3 quadros de 150 ms
    for (let i = 0; i < 6; i++) {
      await page.evaluate((burst) => window.__spikes.push(...(burst ? [150, 150, 150] : [400])), i === 3);
      await page.waitForTimeout(2500);
    }
    const s = await q();
    check(s.changes === 0 && s.tier === 0, "trancos isolados e uma rajada curta não descem", `trocas=${s.changes} janelas=${s.windows.length}`);
    check(s.windows.every((w) => w.fps >= T.env.fps * 0.85), "nenhuma janela vira 'ruim' por um tranco (tira os 10% mais longos)", tl(s));
  }

  if (want("sobe")) {
    console.log("\n== folga sustentada: sobe um degrau por vez, com histerese ==");
    // aprendido = Baixa; tudo leve. Espera para subir encurtada para 8 s (o normal é 20 s)
    await startRun({ quality: "auto", learned: 2, auto: { UP_WAIT_MS: [8000, 64000] }, load: [2, 1, 0] });
    let s = await q();
    check(s.tier === 2 && !s.light && s.rot === "lite" && s.fx === 0.5, "começa no degrau aprendido (Baixa: sem luz, Podridão leve, metade das partículas)", `degrau=${IDS[s.tier]}`);
    await until(() => window.game.scene.getScene("GameScene").quality.changes >= 1, null, 40000);
    s = await q();
    const up = s.log[0];
    const goodBefore = s.windows.filter((w) => w.tier === 2 && w.fps >= T.env.fps * 0.95).length;
    check(up.from === 2 && up.to === 1 && up.why === "folga", "sobe da Baixa para a Média", up.why);
    check(goodBefore >= 4, "só depois de 8 s de janelas boas seguidas (histerese)", `janelas boas antes=${goodBefore}`);
    await until(() => window.game.scene.getScene("GameScene").quality.changes >= 2, null, 40000);
    s = await q();
    const up2 = s.log[1];
    check(up2.to === 0 && up2.t - up.t >= 8, "depois sobe para a Alta, de novo só com folga sustentada", `${(up2.t - up.t).toFixed(1)} s depois`);
    await until(() => window.game.scene.getScene("GameScene").lighting._k >= 1, null, 10000);
    s = await q();
    check(s.light && s.lightK >= 1 && s.rot === "full" && s.fx === 1, "a luz volta escurecendo até a noite inteira; Podridão e partículas também", `luz=${s.light} k=${s.lightK}`);
    const learned = await page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_settings_v1")).qualityAuto);
    check(learned === 0, "o aprendido sobe junto", `qualityAuto=${learned}`);
  }

  if (want("vaivem")) {
    console.log("\n== previsão de folga errada: tentativas que falham voltam na hora e a espera dobra ==");
    // UP_BUSY alto = a previsão sempre "vê folga" (o pior caso); Alta pesada, Média leve
    await startRun({ quality: "auto", auto: { UP_WAIT_MS: [4000, 32000], UP_BUSY: 99 }, load: [26, 4, 2] });
    await until(() => window.game.scene.getScene("GameScene").quality.changes >= 5, null, 90000).catch(() => {});
    const s = await q();
    const ups = s.log.filter((l) => l.to < l.from);
    const fails = s.log.filter((l) => l.why === "subida sem folga");
    check(ups.length >= 2 && fails.length >= 2, "cada subida que não aguenta volta na hora", s.log.map((l) => `${l.t.toFixed(0)}s ${IDS[l.from][0]}→${IDS[l.to][0]} ${l.why}`).join(" · "));
    // tempo de cada tentativa na Alta: a 1ª janela ruim já desfaz (até ~3,5 s com a acomodação)
    const stay = fails.map((f) => f.t - ups.find((u) => u.t <= f.t && u.t > f.t - 10)?.t);
    check(stay.every((x) => x > 0 && x <= 4.5), "a tentativa dura no máximo uma janela", stay.map((x) => x.toFixed(1) + " s").join(", "));
    // a 1ª descida (carga nova) não pune; cada subida que errou dobra a espera (4 → 8 → 16 s…): nunca um vaivém
    const first = s.log[0];
    const waits = fails.map((l) => l.wait / 1000);
    check(first.wait === 4000, "descer por carga nova não aumenta a espera para subir", `${first.wait / 1000} s`);
    check(waits.length >= 2 && waits.every((w, i) => w === (i ? waits[i - 1] : 4) * 2), "cada subida que errou dobra a espera", waits.map((w) => w + " s").join(" → "));
    // e o intervalo real entre o fim de uma tentativa e a próxima acompanha a espera
    const gaps = [];
    for (let i = 1; i < ups.length; i++) gaps.push(ups[i].t - fails.filter((f) => f.t <= ups[i].t).at(-1).t);
    check(gaps.length >= 1 && gaps.every((g, i) => g >= waits[i] && g <= waits[i] + 6), "a próxima tentativa só vem depois da espera dobrada", gaps.map((g, i) => `${g.toFixed(0)} s (espera ${waits[i]} s)`).join(" → "));
  }

  if (want("cpu")) {
    console.log("\n== o quadro do jogo é o gargalo e a Média rende pouco: segue descendo até a Baixa ==");
    // como na CPU de um celular fraco (MEDIR: a Média rende ~3%, a Baixa ~8%): Alta e Média quase iguais
    await startRun({ quality: "auto", load: [34, 32, 8] });
    await until(() => window.game.scene.getScene("GameScene").quality.tier === 2, null, 50000).catch(() => {});
    await page.waitForTimeout(6000);
    const s = await q();
    check(s.tier === 2 && !s.log.some((l) => l.why === "descida sem ganho"), "a descida pequena não volta: chega à Baixa e fica", s.log.map((l) => `${l.t.toFixed(0)}s ${IDS[l.from][0]}→${IDS[l.to][0]} ${l.why}`).join(" · "));
    check(s.windows.slice(-2).every((w) => w.tier === 2 && w.fps >= T.env.fps * 0.85), "e lá o quadro volta a ficar bom", tl({ windows: s.windows.slice(-3) }));
  }

  if (want("semganho")) {
    console.log("\n== os quadros demoram mas não pelo jogo (tela presa em 30 Hz): descer não rende, volta e vira o piso ==");
    await startRun({ quality: "auto", ext: [30, 30, 30] });
    await until(() => window.game.scene.getScene("GameScene").quality.changes >= 2, null, 40000).catch(() => {});
    await page.waitForTimeout(8000);
    const s = await q();
    check(s.log[0]?.to === 1 && s.log[1]?.why === "descida sem ganho" && s.log[1]?.to === 0, "desce, vê que não rendeu e volta à Alta", s.log.map((l) => `${IDS[l.from][0]}→${IDS[l.to][0]} ${l.why}`).join(" · "));
    check(s.changes === 2 && s.tier === 0 && s.maxTier === 0, "a Alta vira o piso da partida: não tenta descer de novo", `trocas=${s.changes} piso=${IDS[s.maxTier]} · ${tl({ windows: s.windows.slice(-2) })}`);
  }

  if (want("manual")) {
    console.log("\n== escolha manual: o automático só mede ==");
    await startRun({ quality: "medium", learned: 2, load: [40, 40, 40] });
    let s = await q();
    check(s.tier === 1, "Média fixa começa na Média (ignora o aprendido)", `degrau=${IDS[s.tier]}`);
    await page.waitForTimeout(12000);
    s = await q();
    check(s.changes === 0 && s.tier === 1, "com o quadro muito ruim, a Média fixa não muda", `trocas=${s.changes}`);
    check(s.windows.length >= 3 && s.windows.every((w) => w.fps < T.env.fps * 0.6), "mas mede (para o perf_run)", tl(s));
    // Opções pela Pausa, tocando como o jogador: trocar vale na hora
    await setLoad([0, 0, 0]);
    await page.evaluate(() => void window.game.scene.getScene("GameScene").pauseGame());
    await until(() => window.game.scene.isActive("PauseScene"));
    await page.waitForTimeout(600);
    // tudo o que a Pausa tem na tela (containers abertos), para achar botões e textos pelo conteúdo
    const scan = (re) =>
      page.evaluate((src) => {
        const re = new RegExp(src);
        const ps = window.game.scene.getScene("PauseScene");
        const all = [];
        const walk = (o) => { all.push(o); (o.list || []).forEach(walk); };
        ps.children.list.forEach(walk);
        const c = window.game.canvas.getBoundingClientRect(), k = c.width / window.game.scale.width;
        const btn = all.filter((o) => o.label && re.test(o.label.text) && o.visible).at(-1);
        const b = btn?.getBounds();
        return {
          label: btn?.label.text,
          at: b ? { x: c.left + (b.x + b.width / 2) * k, y: c.top + (b.y + b.height / 2) * k } : null,
          row: all.some((o) => o.type === "Text" && o.text === "Qualidade gráfica"),
          hint: all.find((o) => o.type === "Text" && /Ajusta sozinha|celular esquentar/.test(o.text))?.text,
        };
      }, re.source);
    const click = async (re) => {
      const f = await scan(re);
      if (!f.at) throw new Error(`não achei ${re} na Pausa`);
      await page.mouse.click(f.at.x, f.at.y);
      await page.waitForTimeout(350);
    };
    const QBTN = /^(Automática|Alta|Média|Baixa)$/;
    await click(/^OPÇÕES$/);
    let ui = await scan(QBTN);
    check(ui.row && ui.label === "Média", "Opções → Áudio e tela mostra 'Qualidade gráfica: Média'", `${ui.label} · "${ui.hint}"`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "qualidade_opcoes_media.png") });
    await click(QBTN); // Média → Baixa
    ui = await scan(QBTN);
    s = await q();
    check(ui.label === "Baixa" && s.tier === 2, "tocar troca para Baixa e vale na hora na partida", `${ui.label}, degrau=${IDS[s.tier]}`);
    await click(QBTN); // Baixa → Automática
    ui = await scan(QBTN);
    const mode = await page.evaluate(() => JSON.parse(localStorage.getItem("guardiao_settings_v1")).quality);
    s = await q();
    check(ui.label === "Automática" && mode === "auto" && s.tier === 2 && /agora: Baixa/.test(ui.hint || ""), "Baixa → Automática continua do degrau de agora (a dica diz qual)", `${ui.label} · "${ui.hint}"`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "qualidade_opcoes_auto.png") });
    await page.evaluate(() => {
      const ps = window.game.scene.getScene("PauseScene");
      while (ps._modals?.length) ps._modals.at(-1).close();
      ps._resume();
    });
    await until(() => !window.game.scene.isActive("PauseScene") && window.game.scene.getScene("GameScene").sys.isActive(), null, 10000).catch(() => {});
  }

  if (want("perf")) {
    console.log("\n== perf_run: uma vez por partida, com os campos certos ==");
    // Firebase falso com o caminho de verdade (Telemetry.install + cleanParams): o que chega lá
    await page.evaluate(async () => {
      window.__fb = [];
      window.Capacitor = { Plugins: { FirebaseAnalytics: { setEnabled: async () => {}, logEvent: async (e) => window.__fb.push(e) }, FirebaseCrashlytics: { setEnabled: async () => {}, recordException: async () => {} } } };
      const { Telemetry } = await import("/src/systems/Telemetry.js");
      Telemetry.available = () => true;
      Telemetry.install();
      Telemetry.setEnabled(true);
    });
    await startRun({ quality: "auto", load: [0, 0, 0] });
    await page.waitForTimeout(9000);
    const end = () => page.evaluate(() => void window.game.scene.getScene("GameScene")._onGameOver(true, false, true));
    const count = () => page.evaluate(() => window.guardiaoAnalytics.recent().filter((e) => e.name === "perf_run").length);
    const n0 = await count();
    await end();
    await end(); // o fim chamado duas vezes (golpes no mesmo quadro) não manda dois
    await until(() => window.game.scene.isActive("GameOverScene"), null, 20000);
    const ev = await page.evaluate(() => window.guardiaoAnalytics.recent().filter((e) => e.name === "perf_run").at(-1));
    check((await count()) - n0 === 1, "um perf_run por partida (fim chamado duas vezes)", `${(await count()) - n0}`);
    const NUM = ["t", "difficulty", "run_n", "frames", "q_min_s", "q_changes", "q_high_s", "q_med_s", "q_low_s", "ground_gpu", "fps_p50", "fps_p5", "busy_p50", "busy_p95", "slow_pct", "hz", "cpu_cores", "fps_cap"];
    const STR = ["biome", "q_mode", "q_start", "q_end", "q_min"];
    const miss = [...NUM.filter((k) => typeof ev[k] !== "number" || !Number.isFinite(ev[k])), ...STR.filter((k) => typeof ev[k] !== "string")];
    check(!miss.length, "campos: fps p50/p5, trabalho do quadro, degraus e tempos, aparelho, duração, bioma", miss.length ? `faltam/errados: ${miss}` : "");
    check(ev.fps_p5 <= ev.fps_p50 && ev.busy_p50 <= ev.busy_p95 && ev.fps_p50 > 20 && ev.frames > 200, "números coerentes", `fps p50 ${ev.fps_p50} p5 ${ev.fps_p5} · trabalho ${ev.busy_p50}/${ev.busy_p95} ms · ${ev.frames} quadros · ${ev.hz} Hz`);
    check(IDS.includes(ev.q_start) && IDS.includes(ev.q_end) && IDS.includes(ev.q_min) && ev.q_mode === "auto" && ev.biome === "amazonia", "degraus e escolha com os nomes certos", `${ev.q_mode} ${ev.q_start}→${ev.q_end} (pior ${ev.q_min} ${ev.q_min_s} s)`);
    const tierS = ev.q_high_s + ev.q_med_s + ev.q_low_s;
    check(tierS <= ev.t && tierS >= ev.t - 8, "tempo nos degraus soma a partida medida (sem a entrada e o aquecimento)", `${tierS} s de ${ev.t} s`);
    check(ev.dev_mem === undefined || ev.dev_mem > 0, "memória do aparelho quando o navegador diz", `dev_mem=${ev.dev_mem} núcleos=${ev.cpu_cores}`);
    const fb = await page.evaluate(() => window.__fb.filter((e) => e.name === "perf_run"));
    const keys = Object.keys(fb.at(-1)?.params || {});
    check(fb.length === 1 && keys.length <= 25 && keys.every((k) => /^[A-Za-z0-9_]{1,40}$/.test(k)), "chega ao Firebase uma vez, com até 25 parâmetros de nome válido", `${keys.length} parâmetros`);
    // "Dados de uso e erros" desligado: o evento continua no registro local, mas nada vai ao Firebase
    await page.evaluate(async () => (await import("/src/systems/Telemetry.js")).Telemetry.setEnabled(false));
    await startRun({ quality: "auto", load: [0, 0, 0] });
    await page.waitForTimeout(6000);
    await page.evaluate(() => void window.game.scene.getScene("GameScene")._onGameOver(false, true)); // desistiu pela Pausa
    await until(() => window.game.scene.isActive("GameOverScene"), null, 20000);
    const fb2 = await page.evaluate(() => window.__fb.filter((e) => e.name === "perf_run").length);
    check((await count()) - n0 === 2 && fb2 === 1, "desistir também manda; com os dados de uso desligados, nada sai para o Firebase", `local=${(await count()) - n0} firebase=${fb2}`);
    await page.evaluate(async () => (await import("/src/systems/Telemetry.js")).Telemetry.setEnabled(true));
    console.log("     perf_run:", JSON.stringify(ev));
  }

  // o automático sai do laço do jogo junto com a partida: o número de ouvintes é o mesmo em toda partida nova
  check(T.counts.length > 0 && T.counts.every((c) => c === T.counts[0]), "ouvintes do laço do jogo não somam a cada partida (Jogar de novo)", [...new Set(T.counts)].join(" / "));
  check(T.errs.length === 0, "sem erros no console", T.errs.slice(0, 3).join(" | "));
  await T.ctx.close();
}

// ---------------------------------------------------------------- capturas (SHOTS): os 3 degraus
async function capturas() {
  console.log("\n== capturas dos degraus (noite, horda, aviso de golpe do chefe) ==");
  fs.mkdirSync(SHOTS, { recursive: true });
  const T = await openPage({ viewport: { width: 1560, height: 720 } });
  const { page, until, startRun } = T;
  await startRun({ quality: "high" });
  // horda e noite: fim da partida no Perigo de sempre, armas evoluídas
  await page.evaluate(async () => {
    const gs = window.game.scene.getScene("GameScene");
    const { WEAPON_CLASSES } = await import("/src/entities/Weapons.js");
    for (const w of gs.player.weapons) w.dispose?.();
    gs.player.weapons.length = 0;
    for (const k of ["VAPOR_STORM", "OVERLOAD_X"]) {
      const w = new WEAPON_CLASSES[k](gs);
      w.level = 5;
      gs.player.addWeapon(w);
    }
    gs.hud.refreshWeapons();
    gs.elapsedMs = (gs.runDurationS - 40) * 1000;
    gs.spawnDirector.elapsedMs = gs.elapsedMs * gs.pace;
    gs.bossWarned = true;
  });
  await page.waitForTimeout(9000);
  const setTier = async (t) => {
    await page.evaluate(async (t) => (await import("/src/systems/Quality.js")).Quality.setMode(["high", "medium", "low"][t]), t);
    await page.waitForTimeout(2200); // transições (QUALITY.FADE_MS)
  };
  for (const t of [0, 1, 2]) {
    await setTier(t);
    await page.screenshot({ path: path.join(SHOTS, `degrau_${t}_${IDS[t]}_horda_noite.png`) });
  }
  // chefe: espera um aviso de golpe à mostra em cada degrau
  await page.evaluate(() => { const gs = window.game.scene.getScene("GameScene"); gs.elapsedMs = gs.runDurationS * 1000; gs._spawnBoss(); });
  await until(() => { const b = window.game.scene.getScene("GameScene").boss; return b?.active && !b._emerging; }, null, 30000);
  for (const t of [0, 1, 2]) {
    await setTier(t);
    try {
      await until(() => window.game.scene.getScene("GameScene")._teleLive > 0, null, 25000);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(SHOTS, `degrau_${t}_${IDS[t]}_aviso_chefe.png`) });
      console.log(`  captura: degrau ${IDS[t]} com aviso de golpe`);
    } catch {
      console.log(`  (sem aviso de golpe a tempo no degrau ${IDS[t]})`);
    }
  }
  check(T.errs.length === 0, "capturas sem erros no console", T.errs.slice(0, 3).join(" | "));
  await T.ctx.close();
}

// ---------------------------------------------------------------- partida pesada (PROVA e MEDIR)
// Pesadelo, onda 11, 4 evoluções, herói imortal andando em círculo, sem cartas e sem baú
async function heavy(page) {
  await page.evaluate(async () => {
    const gs = window.game.scene.getScene("GameScene");
    const { WEAPON_CLASSES } = await import("/src/entities/Weapons.js");
    const pl = gs.player;
    for (const w of pl.weapons) w.dispose?.();
    pl.weapons.length = 0;
    for (const k of ["VAPOR_STORM", "WINTER_HEART", "OVERLOAD_X", "PHOENIX"]) {
      const w = new WEAPON_CLASSES[k](gs);
      w.level = 5; w.dmgMult = 2.2; w.cdMult = 0.8; w.extraProj = 1;
      pl.addWeapon(w);
    }
    pl.extraProj = 1;
    pl.areaMult = 1.3;
    gs.hud.refreshWeapons();
    gs.spawnDirector.elapsedMs = 330000;
    gs.elapsedMs = 330000 / gs.pace;
    gs.runEvents.idx = 6;
    gs.bossWarned = true;
    gs.runDurationS = 99999;
    const R = 350;
    gs.inputMgr.update = function () { const a = (performance.now() / 1000) * (pl.speed / R); this.move.x = -Math.sin(a); this.move.y = Math.cos(a); };
    // noite do fim da partida no mapa de luz (cogumelos acesos), sem chefe
    const lu = gs.lighting.update;
    gs.lighting.update = function (t) { const r = gs.runDurationS; gs.runDurationS = gs.elapsedMs / 950; try { return lu.call(this, t); } finally { gs.runDurationS = r; } };
  });
}

async function prova() {
  console.log(`\n== PROVA: aparelho fraco (CPU ${RATE}× mais lenta pelo CDP), partida carregada ==`);
  const T = await openPage();
  const { page, ctx, startRun, q } = T;
  await page.evaluate(async () => {
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const m = new MetaProgression();
    m.data.selectedDifficulty = 4;
    m.data.maxDifficultyCleared = 4;
    m._save();
  });
  await startRun({ quality: "auto" });
  await heavy(page);
  const cdp = await ctx.newCDPSession(page);
  const t0 = Date.now();
  const phase = async (rate, secs, label) => {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    console.log(`  -- ${label}: CPU ${rate}× por ${secs} s`);
    const end = Date.now() + secs * 1000;
    let seen = 0;
    while (Date.now() < end) {
      await page.waitForTimeout(2000);
      const s = await q();
      for (const w of s.windows.slice(seen)) console.log(`     ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  janela ${w.fps.toFixed(1).padStart(5)} fps  trabalho ${w.busy.toFixed(1).padStart(5)} ms  ${IDS[w.tier]}`);
      seen = s.windows.length;
      for (const l of s.log.slice(phase.logged || 0)) console.log(`     >>> ${IDS[l.from]} → ${IDS[l.to]} (${l.why}; ${l.fps} fps, ${l.busy} ms)`);
      phase.logged = s.log.length;
    }
  };
  await phase(RATE, 60, "aparelho fraco");
  await phase(1, 70, "aparelho folgado (a mesma partida)");
  await phase(Number(process.env.RATE_MID || 3), 90, "meio-termo");
  const s = await q();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  console.log(`  trocas: ${s.changes} · ${s.log.map((l) => `${l.t.toFixed(0)}s ${IDS[l.from]}→${IDS[l.to]} (${l.why})`).join(" · ")}`);
  console.log(`  custo medido: ${s.cost.map((c, i) => `${IDS[i]}/${IDS[i + 1]} ${c?.toFixed(2)}`).join(" · ")}`);
  const ev = await page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); return g.quality.summary(); });
  console.log("  perf_run (resumo até aqui):", JSON.stringify(ev));
  check(T.errs.length === 0, "sem erros no console", T.errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// Custo de cada degrau, INTERCALADO: uma partida pesada só por repetição (mesma semente, relógio virtual, CPU RATE×
// mais lenta) e os 3 degraus em rodízio a cada BLOCK quadros (os 30 primeiros de cada bloco ficam de fora: a troca).
// A carga da partida muda devagar e é a mesma para todos — rodar uma partida por degrau dava ±10% de ruído entre
// páginas, maior que o próprio ganho. Transições instantâneas aqui (QUALITY.FADE_MS = 1): mede o degrau, não o fade
async function medir() {
  const SECS = Number(process.env.SECS || 120), REPS = Number(process.env.REPS || 3), BLOCK = Number(process.env.BLOCK || 180);
  console.log(`
== MEDIR: custo de cada degrau (Pesadelo carregado, noite, CPU ${RATE}×, ${REPS}× ${SECS} s intercalados) ==`);
  const all = { 0: [], 1: [], 2: [] };
  const upd = { 0: [], 1: [], 2: [] };
  for (let r = 0; r < REPS; r++) {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 600 }, serviceWorkers: "block", locale: "pt-BR" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.addInitScript((seed) => {
      localStorage.setItem("guardiao_settings_v1", JSON.stringify({ quality: "high", music: 0, sfx: 0 }));
      let s = seed;
      Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }, 12345 + r);
    await page.goto(URL + "?debug=1");
    await page.waitForFunction(() => window.game?.isBooted && window.game.scene.getScenes(true).length, null, { timeout: 120000 });
    await page.waitForTimeout(2000);
    await page.evaluate(async () => {
      const g = window.game;
      const { QUALITY } = await import("/src/config.js");
      QUALITY.FADE_MS = 1;
      QUALITY.ROT_XFADE_MS = 1;
      const { MetaProgression } = await import("/src/systems/MetaProgression.js");
      const m = new MetaProgression();
      Object.assign(m.data, { selectedDifficulty: 4, maxDifficultyCleared: 4, runsPlayed: 30, firstDefeatSeen: true, hintsSeen: ["move", "chest", "reaction", "wood", "awaken", "quality"] });
      m._save();
      const realNow = performance.now.bind(performance);
      window.__realNow = realNow;
      g.loop.sleep();
      window.__vt = Date.UTC(2026, 9, 14, 12);
      const vt0 = window.__vt, p0 = realNow();
      Date.now = () => window.__vt;
      performance.now = () => p0 + (window.__vt - vt0);
      for (const sc of g.scene.getScenes(true)) g.scene.stop(sc.scene.key);
      g.scene.start("GameScene");
      for (let i = 0; i < 400; i++) {
        window.__vt += 16.667;
        g.step(window.__vt, 16.667);
        const gs = g.scene.getScene("GameScene");
        if (gs?.sys.isActive() && gs.player && !gs._intro) break;
        if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      const gs = g.scene.getScene("GameScene");
      gs._god = true;
      gs.player.gainXp = () => {};
      gs._openChest = () => {};
      const su = g.scene.update.bind(g.scene);
      window.__upd = 0;
      g.scene.update = (...a) => { const t = realNow(); try { return su(...a); } finally { window.__upd = realNow() - t; } };
    });
    await heavy(page);
    // aquece 10 s (a horda chega) antes de medir
    await page.evaluate(async () => { const g = window.game; for (let i = 0; i < 600; i++) { window.__vt += 16.667; g.step(window.__vt, 16.667); if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0)); } });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
    const res = await page.evaluate(async ({ FR, BLOCK }) => {
      const g = window.game, now = window.__realNow;
      const { Quality } = await import("/src/systems/Quality.js");
      const f = { 0: [], 1: [], 2: [] }, u = { 0: [], 1: [], 2: [] };
      let tier = 0;
      Quality.setTier(0);
      for (let i = 0; i < FR; i++) {
        const b = i % BLOCK;
        if (b === 0 && i) Quality.setTier((tier = (tier + 1) % 3));
        window.__vt += 16.667;
        const t = now();
        g.step(window.__vt, 16.667);
        if (b >= 30) {
          f[tier].push(now() - t);
          u[tier].push(window.__upd);
        }
        if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
      }
      return { f, u, kills: g.scene.getScene("GameScene").hud.kills };
    }, { FR: SECS * 60, BLOCK });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    for (const t of [0, 1, 2]) {
      all[t].push(...res.f[t]);
      upd[t].push(...res.u[t]);
    }
    console.log(`  rep${r}: ${[0, 1, 2].map((t) => `${IDS[t]} ${mean(res.f[t]).toFixed(2)} ms`).join(" · ")} · abates ${res.kills}${errs.length ? " · ERROS " + errs[0] : ""}`);
    await ctx.close();
  }
  const st = (a) => { const s = a.slice().sort((x, y) => x - y); return { mean: a.reduce((x, y) => x + y, 0) / a.length, p50: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)] }; };
  const m = [0, 1, 2].map((t) => ({ ...st(all[t]), upd: st(upd[t]).mean }));
  for (const t of [0, 1, 2])
    console.log(
      `  ${IDS[t].padEnd(7)} quadro ${m[t].mean.toFixed(2)} ms${t ? ` (${((m[t].mean / m[0].mean - 1) * 100).toFixed(1)}%)` : ""} · p50 ${m[t].p50.toFixed(2)} · p95 ${m[t].p95.toFixed(2)}${t ? ` (${((m[t].p95 / m[0].p95 - 1) * 100).toFixed(1)}%)` : ""} · lógica ${m[t].upd.toFixed(2)} · desenho ${(m[t].mean - m[t].upd).toFixed(2)}${t ? ` · custo ${IDS[t - 1]}/${IDS[t]} ${(m[t - 1].mean / m[t].mean).toFixed(2)}` : ""}`,
    );
}

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
if (MEDIR) await medir();
else if (PROVA) await prova();
else {
  await casos();
  if (SHOTS) await capturas();
}
await browser.close();
server?.close();
console.log(failures ? `\n${failures} FALHA(S)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
