// Teste do SOM (src/audio/Mixer.js) num navegador de verdade: no Edge headless o AudioContext roda de
// verdade, e tudo que sai dele passa por um "grampo" (ScriptProcessor) que mede pico, volume e agudo de
// cada bloco. Os nós de áudio criados são contados até serem desligados. Confere:
//   · Música 0 + Efeitos 0 = silêncio em tudo (partida, chefe, a cena da 1ª queda, que furava a opção, e a
//     tela de fim de partida na vitória e na derrota);
//   · na tela de fim, a vinheta toca no canal da música e a fogueira no dos efeitos, e saindo os dois somem;
//   · mexer no volume vale na hora; 60 abates no mesmo quadro não estouram (e criam no máximo 4 vozes);
//   · Pausa, cartas de nível e Reviver abafam a partida e ela volta ao retomar;
//   · vida baixa bate o coração (com intervalo) e desliga ao curar;
//   · o chefe troca a trilha no compasso (a nova entra num tempo forte, depois do rugido);
//   · a morte para a fita (a música desacelera e fecha) e a cena seguinte começa limpa;
//   · os nós de áudio não crescem sem parar numa partida longa (SOAK_S segundos, padrão 40);
//   · CARGA: a síntese roda em Web Workers e a thread principal não gasta mais que LOAD_MAX_MS seguidos
//     com áudio; sem Worker (plano B, em fatias) e com o Worker quebrado também carrega tudo, sem travar;
//   · CAMADAS (no Node e no jogo): a música da partida sobe e desce de camada com a intensidade, cada
//     camada entra no tempo forte da grade dela, chega inteira e sai; intensidade em volta de um limite
//     não faz a música piscar (histerese);
//   · AMBIÊNCIA da Clareira: muda com a hora (noite ≠ dia, bichos da hora), a troca é suave, segue a
//     barra de Efeitos (muda com Efeitos 0) e não deixa nós de áudio para trás entre visitas.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:audio                     (ou: node tools/test-audio.mjs)
//
// Variáveis: SOAK_S=120 (partida longa)  LAB_URL=… (servidor já rodando)
// Armadilhas: page.evaluate não devolve objetos do Phaser (estoura a memória ao serializar); o renderizador
// headless roda a poucos quadros por segundo (esperar por condição, não por tempo: o relógio do JOGO anda
// mais devagar que o do áudio); o AudioParam.value só atualiza a cada bloco do áudio (ler depois de
// esperar um pouco); scene.start(key) sem dados mantém os dados antigos.
import { chromium } from "playwright-core";
import { startLabServer } from "./lab-server.mjs";
import { MusicIntensity, intensityOf } from "../src/audio/MusicLayers.js";
import { AUDIO } from "../src/config.js";

const LOAD_MAX_MS = 50; // o maior pedaço de trabalho de áudio na thread principal (uma "long task" começa em 50)

const SOAK_S = Number(process.env.SOAK_S || 40);
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
const dB = (x) => (x > 0 ? `${(20 * Math.log10(x)).toFixed(1)} dBFS` : "silêncio");

// Roda no navegador antes do jogo: o grampo na saída, a contagem de nós e as tarefas longas (> 50 ms)
function tap() {
  const A = (window.__aud = { peak: 0, blocks: [], live: new Set(), plays: {}, lt: [] });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) A.lt.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // sem a API: o teste da carga usa só o que o AudioBank mede
  }
  const P = BaseAudioContext.prototype;
  for (const m of ["createGain", "createBufferSource", "createPanner", "createStereoPanner", "createBiquadFilter", "createDynamicsCompressor"]) {
    const f = P[m];
    P[m] = function (...a) {
      const n = f.apply(this, a);
      A.live.add(n);
      return n;
    };
  }
  const disc = AudioNode.prototype.disconnect;
  AudioNode.prototype.disconnect = function (...a) {
    if (!a.length) A.live.delete(this);
    return disc.apply(this, a);
  };
  const conn = AudioNode.prototype.connect;
  const taps = new WeakMap();
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (!(dest instanceof AudioDestinationNode) || this.__tap) return conn.call(this, dest, ...rest);
    let t = taps.get(dest.context);
    if (!t) {
      t = dest.context.createScriptProcessor(1024, 2, 2);
      t.__tap = true;
      t.onaudioprocess = (e) => {
        const a = e.inputBuffer.getChannelData(0),
          b = e.inputBuffer.getChannelData(1);
        let pk = 0,
          ss = 0,
          hf = 0,
          prev = a[0];
        for (let i = 0; i < a.length; i++) {
          const m = Math.max(Math.abs(a[i]), Math.abs(b[i]));
          if (m > pk) pk = m;
          ss += a[i] * a[i];
          hf += (a[i] - prev) * (a[i] - prev); // diferença entre amostras: só o agudo sobra
          prev = a[i];
        }
        e.outputBuffer.getChannelData(0).set(a);
        e.outputBuffer.getChannelData(1).set(b);
        A.peak = Math.max(A.peak, pk);
        A.blocks.push([dest.context.currentTime, pk, ss, hf]);
        if (A.blocks.length > 20000) A.blocks.splice(0, 5000);
      };
      conn.call(t, dest);
      taps.set(dest.context, t);
    }
    return conn.call(this, t, ...rest);
  };
}

async function open(settings, init = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, locale: "pt-BR", serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.addInitScript(tap);
  if (init) await page.addInitScript(init);
  await page.addInitScript((s) => localStorage.setItem("guardiao_settings_v1", JSON.stringify(s)), settings);
  await page.goto(URL);
  const until = (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms });
  await until(() => window.game?.scene?.isActive("TitleScene"), null, 120000);
  // Medidas do grampo entre dois instantes do relógio do áudio
  const now = () => page.evaluate(() => window.game.sound.context.currentTime);
  const meter = (t0, t1) =>
    page.evaluate(
      ({ t0, t1 }) => {
        let pk = 0,
          ss = 0,
          hf = 0;
        for (const [t, p, s, h] of window.__aud.blocks)
          if (t >= t0 && t <= t1) {
            pk = Math.max(pk, p);
            ss += s;
            hf += h;
          }
        return { pk, ss, hf, bright: ss > 0 ? hf / ss : 0 };
      },
      { t0, t1 },
    );
  // espera em segundos do relógio do áudio (o do jogo anda devagar no headless)
  const waitAudio = async (s) => {
    const t = await now();
    await until((t) => window.game.sound.context.currentTime >= t, t + s, s * 1000 + 30000);
  };
  // Herói imune. calm = sem XP (as cartas abrem só quando o teste pede: uma carta no meio da medição
  // do coração abafaria tudo e o teste acusaria o que é certo)
  const startRun = async (calm = true) => {
    await page.evaluate(() => void window.game.scene.getScenes(true)[0].scene.start("GameScene"));
    await until(() => window.game.scene.getScene("GameScene")?.player && !window.game.scene.getScene("GameScene")._intro && window.game.scene.isActive("GameScene"));
    await page.evaluate((calm) => {
      const g = window.game.scene.getScene("GameScene");
      g._god = true;
      if (calm) g.player.gainXp = () => {};
    }, calm);
  };
  const mix = () =>
    page.evaluate(async () => {
      const { Mixer } = await import("/src/audio/Mixer.js");
      const b = Mixer.buses;
      return { ...Mixer.state, mLP: b.music.lp.frequency.value, sLP: b.sfx.lp.frequency.value, mDuck: b.music.duck.gain.value, open: b.open };
    });
  return { ctx, page, errs, until, now, meter, waitAudio, startRun, mix };
}

try {
  // ----------------------------------------------------------------------------------------------
  console.log("\n== Camadas: intensidade → nível (lógica, no Node) ==");
  {
    const C = AUDIO.LAYERS;
    const run = (d, raw, s, tick = C.TICK_MS) => {
      let n = 0;
      for (let t = 0; t < s * 1000; t += tick) n = d.update(typeof raw === "function" ? raw(t) : raw, tick);
      return n;
    };
    const calm = intensityOf({ near: 0, elites: 0, mini: false, danger: false, time: 0 });
    const horde = intensityOf({ near: 30, elites: 1, mini: false, danger: false, time: 0.6 });
    check(calm < C.UP[0] && horde >= C.UP[2], "sem ninguém perto = calmo; horda com elite no meio da partida = intensidade máxima", `${calm.toFixed(2)} · ${horde.toFixed(2)}`);
    const one = intensityOf({ near: 1, elites: 0, mini: false, danger: false, time: 0.02 });
    check(one >= C.UP[0] && one < C.UP[1], "o primeiro bicho chegando já traz a bateria (e só ela)", one.toFixed(2));
    const late = intensityOf({ near: 0, elites: 0, mini: false, danger: false, time: 1 });
    check(late >= C.UP[1] && late < C.UP[2], "fim da partida sem ninguém perto: bateria e baixo, sem a melodia", late.toFixed(2));
    const d = new MusicIntensity();
    const up = run(d, horde, 2);
    check(up === C.UP.length, "a horda chega: todas as camadas em menos de 2 s", `nível ${up}`);
    const early = run(d, 0, (C.HOLD_DOWN_MS - d.sinceMs - 300) / 1000); // até pouco antes de vencer a espera
    check(early === up, `a luta acaba: segura o nível por ${C.HOLD_DOWN_MS / 1000} s antes de descer`, `nível ${early}`);
    const down = run(d, 0, 30);
    check(down === 0, "e depois volta à base", `nível ${down}`);
    // intensidade passeando em volta do limite de cada nível (ruído de ±0,05)
    let r = 7;
    const noise = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5) * 0.1;
    for (let k = 0; k < C.UP.length; k++) {
      const e = new MusicIntensity();
      run(e, C.UP[k] + 0.03, 10); // chega no nível
      const c0 = e.changes;
      run(e, () => C.UP[k] + noise(), 60);
      check(e.changes - c0 <= 1, `em volta do limite ${C.UP[k]} por 60 s: a música não pisca`, `${e.changes - c0} troca(s)`);
    }
  }

  // ----------------------------------------------------------------------------------------------
  console.log("\n== Carga: o som é feito fora da thread principal ==");
  const loadRun = async (label, init, want) => {
    const L = await open({ music: 0.92, sfx: 0.95, volCurve: 1 }, init);
    const st = await L.page.evaluate(async () => {
      const { AudioBank } = await import("/src/audio/AudioBank.js");
      return { ...AudioBank.stats, lt: window.__aud.lt, title: Math.round(performance.now()), stems: !!window.game.cache.audio.exists("music_gameplay@lead"), amb: !!window.game.cache.audio.exists("amb_bed_night") };
    });
    const maxLT = Math.max(0, ...st.lt.map(([, d]) => d));
    check(want(st.mode) && st.installed === st.jobs && st.stems && st.amb, `${label}: todos os ${st.jobs} sons no cache`, `modo ${st.mode}${st.reason ? ` (${st.reason})` : ""}, ${st.workers} worker(s), título em ${(st.title / 1000).toFixed(1)} s`);
    check(st.maxTaskMs <= LOAD_MAX_MS, `${label}: a thread principal nunca gasta mais de ${LOAD_MAX_MS} ms seguidos com áudio`, `maior pedaço ${st.maxTaskMs.toFixed(1)} ms, total ${st.mainMs.toFixed(0)} ms em ${st.slices || "—"} fatia(s); maior tarefa longa da carga (arte inclusa) ${maxLT} ms`);
    const errs = L.errs.filter((e) => !/nao-existe|404/.test(e)); // o Worker quebrado de propósito avisa no console
    check(!errs.length, `${label}: sem erro no console`, errs.slice(0, 2).join(" | "));
    await L.ctx.close();
  };
  await loadRun("com Worker", null, (m) => m === "worker");
  await loadRun("sem Worker (plano B)", () => (window.Worker = undefined), (m) => m === "main");
  // Worker que não carrega (arquivo inexistente): cai no plano B para o que faltou
  await loadRun(
    "Worker quebrado",
    () => {
      const W = window.Worker;
      window.Worker = class extends W {
        constructor(u, o) {
          super(new URL("/src/audio/nao-existe.js", location.href), o);
        }
      };
    },
    (m) => m === "worker+main" || m === "main",
  );

  // ----------------------------------------------------------------------------------------------
  console.log("\n== Música 0 e Efeitos 0: silêncio em tudo ==");
  {
    const T = await open({ music: 0, sfx: 0, volCurve: 1 });
    const t0 = await T.now();
    await T.startRun();
    await T.waitAudio(3);
    await T.page.evaluate(() => void window.game.scene.getScene("GameScene")._spawnBoss());
    await T.waitAudio(3);
    await T.page.evaluate(() => void window.game.scene.getScene("GameScene")._onGameOver(false, false, true));
    await T.until(() => window.game.scene.isActive("FirstDefeatScene"));
    await T.waitAudio(14); // a fogueira e a música da Clareira entram por fade
    const m = await T.meter(t0, await T.now());
    check(m.pk === 0, "título, partida, chefe e a cena da 1ª queda ficam mudos", dB(m.pk));
    // Tela de fim de partida: derrota (a 2ª queda é a curta e vai para os resultados) e vitória
    await T.page.evaluate(() => void window.game.scene.getScene("FirstDefeatScene")._finish(true));
    await T.until(() => !window.game.scene.isActive("FirstDefeatScene"), null, 20000);
    for (const won of [false, true]) {
      await T.startRun();
      const a = await T.now();
      await T.page.evaluate((won) => void window.game.scene.getScene("GameScene")._onGameOver(won, false, true), won);
      await T.until(() => window.game.scene.isActive("GameOverScene"), null, 30000);
      await T.waitAudio(6); // vinheta, fogueira, fichas das recompensas
      const r = await T.meter(a, await T.now());
      check(r.pk === 0, `fim de partida (${won ? "vitória" : "derrota"}) fica mudo`, dB(r.pk));
    }
    // a Clareira: a música e a ambiência da hora (canal dos Efeitos) também
    await T.page.evaluate(() => void window.game.scene.getScenes(true)[0].scene.start("CampScene"));
    await T.until(() => window.game.scene.isActive("CampScene") && !!window.game.scene.getScene("CampScene").ambience);
    const c0 = await T.now();
    await T.waitAudio(5);
    const cm = await T.meter(c0, await T.now());
    const amb = await T.page.evaluate(() => window.game.scene.getScene("CampScene").ambience.state);
    check(cm.pk === 0 && amb.ok, "a Clareira (música e ambiência) fica muda", `${dB(cm.pk)} · ambiência ligada, hora ${amb.hour?.toFixed(1)}`);
    check(!T.errs.length, "sem erro no console", T.errs.slice(0, 3).join(" | "));
    await T.ctx.close();
  }

  // ----------------------------------------------------------------------------------------------
  console.log("\n== Volume padrão: momentos da partida ==");
  const T = await open({ music: 0.92, sfx: 0.95, volCurve: 1 });
  const { page, until, now, meter, waitAudio, mix } = T;
  await page.evaluate(() => {
    const play = window.game.sound.play;
    window.game.sound.play = function (k, c) {
      window.__aud.plays[k] = (window.__aud.plays[k] || 0) + 1;
      return play.call(this, k, c);
    };
  });
  await T.startRun();
  await waitAudio(1.5);

  // Volume na hora: zera os dois canais no meio da partida
  await page.evaluate(async () => {
    const { Settings } = await import("/src/systems/Settings.js");
    Settings.set("music", 0);
    Settings.set("sfx", 0);
  });
  await waitAudio(0.3);
  let t = await now();
  await waitAudio(1);
  check((await meter(t, await now())).pk === 0, "Música e Efeitos em 0 no meio da partida calam na hora");
  await page.evaluate(async () => {
    const { Settings } = await import("/src/systems/Settings.js");
    Settings.set("music", 0.92);
    Settings.set("sfx", 0.95);
  });
  await waitAudio(0.5);

  // Mudo geral (tecla M no PC) e segundo plano (o app vai para o fundo: o áudio inteiro suspende)
  await page.evaluate(() => (window.game.sound.mute = true));
  await waitAudio(0.2);
  t = await now();
  await waitAudio(0.8);
  check((await meter(t, await now())).pk === 0, "mudo geral cala tudo");
  await page.evaluate(() => (window.game.sound.mute = false));
  const bg = async (hidden) => {
    await page.evaluate((h) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
    await page.waitForTimeout(400);
    return page.evaluate(() => window.game.sound.context.state);
  };
  const off = await bg(true);
  const on = await bg(false);
  check(off === "suspended" && on === "running", "segundo plano suspende o áudio e a volta retoma", `${off} → ${on}`);
  await page.evaluate(() => {
    window.game.scene.stop("PauseScene"); // a ida para o fundo pausa a partida
    window.game.scene.getScene("GameScene").scene.resume();
  });
  await waitAudio(0.5);

  // A horda caindo de uma vez: 60 abates no mesmo quadro
  t = await now();
  const voices = await page.evaluate(() => {
    const n0 = window.game.sound.sounds.length;
    for (let i = 0; i < 60; i++) window.game.sound.play("sfx_death", { volume: 0.15 });
    return window.game.sound.sounds.length - n0;
  });
  await waitAudio(0.5);
  const horde = await meter(t, await now());
  check(voices <= 4, "60 abates no mesmo quadro criam no máximo 4 vozes", `${voices} vozes`);
  check(horde.pk < 0.5, "e a saída não passa de −6 dBFS", dB(horde.pk));

  // Pausa: abafa e volta
  const brightNow = async (s = 1.5) => {
    const a = await now();
    await waitAudio(s);
    return meter(a, await now());
  };
  const before = await brightNow();
  await page.evaluate(() => void window.game.scene.getScene("GameScene").pauseGame());
  await until(() => window.game.scene.isActive("PauseScene"));
  await waitAudio(0.6);
  const paused = await brightNow();
  // sem som passando, o Chrome nem processa o filtro dos efeitos (o .value fica parado): um efeito baixinho acorda
  await page.evaluate(() => window.game.sound.play("sfx_fire_loop", { volume: 0.01 }));
  await waitAudio(0.3);
  let m = await mix();
  check(m.moment === "muffle" && m.mLP < 1000 && m.sLP < 1000, "Pausa: música e efeitos no passa-baixa", `música ${m.mLP.toFixed(0)} Hz, efeitos ${m.sLP.toFixed(0)} Hz, ganho ${m.mDuck.toFixed(2)}`);
  check(paused.bright < before.bright * 0.5, "Pausa: o agudo da saída cai", `agudo/volume ${before.bright.toFixed(4)} → ${paused.bright.toFixed(4)}`);
  await page.evaluate(() => {
    window.game.scene.stop("PauseScene");
    window.game.scene.getScene("GameScene").scene.resume();
  });
  await waitAudio(0.8);
  m = await mix();
  const after = await brightNow();
  check(m.moment === "normal" && m.mLP > m.open * 0.9 && Math.abs(m.mDuck - 1) < 0.02, "Pausa → Continuar: o som volta inteiro", `música ${m.mLP.toFixed(0)} Hz, ganho ${m.mDuck.toFixed(2)}, agudo ${after.bright.toFixed(4)}`);

  // Cartas de nível
  await page.evaluate(() => {
    const g = window.game.scene.getScene("GameScene");
    g._pendingLevelUps++;
    g._openNextLevelUp();
  });
  await until(() => window.game.scene.isActive("LevelUpScene") && window.game.scene.getScene("LevelUpScene")._cardObjs?.[0]?.alpha > 0.95);
  await waitAudio(0.5);
  m = await mix();
  check(m.moment === "muffle" && m.mLP < 1000, "Cartas de nível abafam a partida", `${m.mLP.toFixed(0)} Hz`);
  await page.evaluate(() => void window.game.scene.getScene("LevelUpScene")._pick(0));
  await until(() => !window.game.scene.isActive("LevelUpScene") && !window.game.scene.isPaused("GameScene"), null, 15000);
  await waitAudio(0.8);
  m = await mix();
  check(m.moment === "normal" && m.mLP > m.open * 0.9, "escolheu a carta: volta", `${m.mLP.toFixed(0)} Hz`);

  // Vida baixa: coração com intervalo; curar desliga
  const beats0 = await page.evaluate(() => window.__aud.plays.sfx_heartbeat_run || 0);
  // sem cura durante a medição: um coração que cai de um inimigo (ou a regeneração) passaria dos 36% e
  // o teste acusaria a histerese, que está certa
  await page.evaluate(() => {
    const p = window.game.scene.getScene("GameScene").player;
    p.__heal = p.healHp;
    p.__regen = p.regenPerSec;
    p.healHp = () => {};
    p.regenPerSec = 0;
    p.hp = p.maxHp * 0.2;
  });
  await waitAudio(4);
  m = await mix();
  const beats = (await page.evaluate(() => window.__aud.plays.sfx_heartbeat_run || 0)) - beats0;
  check(beats >= 2 && beats <= 6, "vida baixa: o coração bate com intervalo", `${beats} batidas em 4 s`);
  check(m.danger && m.mLP < 4000 && m.sLP > m.open * 0.9, "vida baixa: só a música escurece (os avisos ficam limpos)", `${m.moment}: música ${m.mLP.toFixed(0)} Hz, efeitos ${m.sLP.toFixed(0)} Hz`);
  await page.evaluate(() => {
    const p = window.game.scene.getScene("GameScene").player;
    p.hp = p.maxHp * 0.33; // entre os limites: continua ligado (histerese)
  });
  await waitAudio(0.6);
  const hp33 = await page.evaluate(() => {
    const p = window.game.scene.getScene("GameScene").player;
    return Math.round((100 * p.hp) / p.maxHp);
  });
  check((await mix()).danger, "33% de vida: continua em perigo (histerese, não pisca)", `vida ${hp33}%`);
  await page.evaluate(() => {
    const p = window.game.scene.getScene("GameScene").player;
    p.healHp = p.__heal;
    p.regenPerSec = p.__regen;
    p.hp = p.maxHp * 0.6;
  });
  await waitAudio(2);
  m = await mix();
  check(!m.danger && m.mLP > m.open * 0.9, "curou: o perigo desliga e a música abre", `${m.mLP.toFixed(0)} Hz`);

  // Camadas da música da partida: a luta (entradas fingidas no lugar de _musicInputs) sobe e desce a trilha
  {
    const lay = () =>
      page.evaluate(() => {
        const g = window.game.scene.getScene("GameScene");
        const m = g.bgMusic;
        return {
          layered: !!m?.layered,
          level: m?.level,
          dir: g.musicDir.level,
          gains: m?.stems?.map((s) => +s.gain.gain.value.toFixed(3)),
          changes: m?.changes ?? [],
          now: m?.ctx.currentTime,
          start: m?.startTime,
          beatS: m?.info.beatS,
          rate: m?.rate,
        };
      });
    const feed = (inp) =>
      page.evaluate((inp) => {
        const g = window.game.scene.getScene("GameScene");
        g._musicInputs = () => inp;
      }, inp);
    await feed({ near: 0, elites: 0, mini: false, danger: false, time: 0 });
    // o que estava tocando sai no próximo tempo forte e some em EXIT_BEATS: espera o fim do que foi marcado
    const fadeEnd = await page.evaluate(async () => {
      const { AUDIO } = await import("/src/config.js");
      const g = window.game.scene.getScene("GameScene");
      g.musicDir.reset();
      g.bgMusic.setLevel(0);
      const m = g.bgMusic;
      const last = Math.max(m.ctx.currentTime, ...m.changes.map((c) => c.at));
      return last + (AUDIO.LAYERS.EXIT_BEATS * m.info.beatS) / m.rate + 0.3;
    });
    await until((t) => window.game.sound.context.currentTime > t, fadeEnd, 60000);
    const sfxVol = (v) =>
      page.evaluate(async (v) => {
        const { Settings } = await import("/src/systems/Settings.js");
        Settings.set("sfx", v);
      }, v);
    await sfxVol(0); // só a música na medida (as armas continuam atirando)
    let s = await lay();
    check(s.layered && s.level === 0 && s.gains[0] > 0.9 && s.gains.slice(1).every((v) => v < 0.01), "partida calma: só a base da trilha", `ganhos ${s.gains.join(" ")}`);
    const quiet = await brightNow(2);
    const ask = (await lay()).now;
    await feed({ near: 30, elites: 1, mini: true, danger: false, time: 0.5 });
    await until(() => window.game.scene.getScene("GameScene").bgMusic.level === 3, null, 60000);
    s = await lay();
    const ons = s.changes.filter((c) => c.on && c.at >= ask);
    const lastAt = Math.max(...ons.map((c) => c.at));
    await until((t) => window.game.sound.context.currentTime > t, lastAt + 0.3, 60000);
    s = await lay();
    const C = AUDIO.LAYERS;
    const onGrid = ons.every((c) => Math.abs(c.beat / (C.QUANT[c.stem] ?? 4) - Math.round(c.beat / (C.QUANT[c.stem] ?? 4))) < 1e-9 && Math.abs(c.at - (s.start + (c.beat * s.beatS) / s.rate)) < 1e-6);
    const loud = await brightNow(2);
    await sfxVol(0.95);
    check(ons.length === 3 && s.gains.every((v) => v > 0.95), "a horda chega: bateria, baixo e melodia entram e chegam inteiras", `${ons.map((c) => `${c.stem}@${c.beat}`).join(" ")} · ganhos ${s.gains.join(" ")}`);
    check(onGrid, "cada camada entra no tempo forte da grade dela (compasso; a melodia na frase)", ons.map((c) => `${c.stem}: tempo ${c.beat} (${(c.beat / (C.QUANT[c.stem] ?? 4)).toFixed(0)}ª ${C.QUANT[c.stem] === 8 ? "frase" : "barra"}) em ${(c.at - ask).toFixed(2)} s`).join(" · "));
    check(loud.ss > quiet.ss * 2, "e a saída fica mais cheia", `energia ×${(loud.ss / Math.max(1e-9, quiet.ss)).toFixed(1)}`);
    // a luta acaba: segura e depois sai camada por camada, sumindo (não corta)
    const calmAt = (await lay()).now;
    await feed({ near: 0, elites: 0, mini: false, danger: false, time: 0 });
    await until(() => window.game.scene.getScene("GameScene").bgMusic.level === 0, null, 120000);
    s = await lay();
    const offs = s.changes.filter((c) => !c.on && c.at >= calmAt);
    const firstOff = Math.min(...offs.map((c) => c.at));
    await until((t) => window.game.sound.context.currentTime > t, Math.max(...offs.map((c) => c.at)) + (C.EXIT_BEATS * s.beatS) / s.rate + 0.3, 60000);
    s = await lay();
    check(firstOff - calmAt > 3 && offs.length === 3 && s.gains.slice(1).every((v) => v < 0.01) && s.gains[0] > 0.9, "a luta acaba: a trilha segura um tempo e volta à base, camada por camada", `1ª saída ${(firstOff - calmAt).toFixed(1)} s depois · ${offs.map((c) => `${c.stem}@${c.beat}`).join(" ")} · ganhos ${s.gains.join(" ")}`);
    await page.evaluate(() => delete window.game.scene.getScene("GameScene")._musicInputs); // volta a ler a luta de verdade
  }

  // Chefe: troca de trilha no compasso
  const sw = await page.evaluate(async () => {
    const { MUSIC_INFO } = await import("/src/audio/Synth.js");
    const { AUDIO } = await import("/src/config.js");
    const g = window.game.scene.getScene("GameScene");
    const old = g.bgMusic;
    const ctx = window.game.sound.context;
    const t0 = ctx.currentTime;
    const info = MUSIC_INFO[old.key];
    const spb = 60 / (info.bpm * (old.totalRate || 1));
    const beats = (old.seek * info.bpm) / 60;
    g._spawnBoss();
    const nu = g.bgMusic;
    window.__old = old;
    let toBar = (4 - (beats % 4)) * spb;
    if (toBar < AUDIO.SWITCH.MIN_FADE_BEATS * spb) toBar += 4 * spb;
    const grid = (nu.startTime - (t0 + toBar)) / (AUDIO.SWITCH.GRID_BEATS * spb);
    return { oldKey: old.key, newKey: nu.key, wait: nu.startTime - t0, toBar, grid, roar: AUDIO.SWITCH.ROAR_S, v0: old.volume };
  });
  await waitAudio(0.3);
  const dip = await page.evaluate(() => window.__old.volumeNode?.gain.value ?? 0);
  check(sw.newKey.includes("boss") && sw.wait >= sw.roar - 0.01, "chefe: a trilha nova só entra depois do rugido", `${sw.oldKey} → ${sw.newKey} em ${sw.wait.toFixed(2)} s`);
  check(Math.abs(sw.grid - Math.round(sw.grid)) < 0.01 && sw.grid > -0.01, "e entra num tempo forte da grade da trilha anterior", `barra em ${sw.toBar.toFixed(2)} s, ${sw.grid.toFixed(3)} × 2 tempos depois`);
  check(dip < sw.v0 * 0.35, "a trilha da partida afunda sob o rugido (sem corte seco)", `volume ${sw.v0} → ${dip.toFixed(3)}`);
  await until(() => !!window.__old.pendingRemove, null, 30000);
  check(true, "e a trilha velha some sozinha (destruída depois da barra)");

  // Reviver (o caminho da oferta de anúncio) e morte: a fita para
  await page.evaluate(() => {
    const g = window.game.scene.getScene("GameScene");
    g._reviveOpen = true;
    g.scene.pause();
    g.scene.launch("ReviveScene");
  });
  await until(() => window.game.scene.isActive("ReviveScene"));
  await waitAudio(0.5);
  m = await mix();
  check(m.moment === "muffle" && m.mLP < 1000, "Reviver: a partida fica abafada atrás da oferta", `${m.mLP.toFixed(0)} Hz`);
  await page.evaluate(() => void window.game.scene.getScene("ReviveScene")._decline());
  await waitAudio(0.55);
  const tape = await page.evaluate(async () => {
    const { Mixer } = await import("/src/audio/Mixer.js");
    const g = window.game.scene.getScene("GameScene");
    return { moment: Mixer.state.moment, rate: g.bgMusic?.source?.playbackRate.value ?? null, lp: Mixer.buses.music.lp.frequency.value };
  });
  check(tape.moment === "death" && tape.rate != null && tape.rate < 0.85 && tape.lp < 2500, "morte: a fita para (a música desacelera e fecha)", `rate ${tape.rate?.toFixed(2)}, ${tape.lp.toFixed(0)} Hz`);
  await until(() => window.game.scene.isActive("FirstDefeatScene"));
  await page.evaluate(() => {
    window.game.sound.play("sfx_fire_loop", { volume: 0.01 }); // acorda os filtros (ver acima)
    (window.__wake = window.game.sound.add("music_menu", { volume: 0.001 })).play();
  });
  await waitAudio(0.4);
  m = await mix();
  await page.evaluate(() => window.__wake.destroy());
  check(m.moment === "normal" && m.mLP > m.open * 0.9 && m.sLP > m.open * 0.9 && !m.danger && m.fading === 0, "a cena seguinte começa com o som limpo", `${m.moment} música ${m.mLP.toFixed(0)} Hz efeitos ${m.sLP.toFixed(0)} Hz trilhas saindo ${m.fading}`);

  // Partida longa: os nós de áudio não crescem sem parar
  await page.evaluate(() => void window.game.scene.getScene("FirstDefeatScene")._finish(true));
  await until(() => !window.game.scene.isActive("FirstDefeatScene"), null, 20000);
  await T.startRun(false); // com XP: as cartas abrem e fecham sozinhas
  const samples = [];
  const t1 = Date.now();
  while (Date.now() - t1 < SOAK_S * 1000) {
    await page.waitForTimeout(Math.min(5000, SOAK_S * 100));
    // cartas abrem sozinhas com o XP: escolhe a primeira (como um jogador apressado)
    await page.evaluate(() => {
      const lu = window.game.scene.getScene("LevelUpScene");
      if (window.game.scene.isActive("LevelUpScene") && lu._cardObjs?.[0]?.alpha > 0.95 && !lu._locked) lu._pick(0);
    });
    samples.push(await page.evaluate(() => ({ live: window.__aud.live.size, sounds: window.game.sound.sounds.length, t: window.game.scene.getScene("GameScene").elapsedMs })));
  }
  const third = Math.max(1, Math.floor(samples.length / 3));
  const head = Math.max(...samples.slice(0, third).map((s) => s.live)),
    tail = Math.max(...samples.slice(-third).map((s) => s.live));
  const plays = await page.evaluate(() => Object.values(window.__aud.plays).reduce((a, b) => a + b, 0));
  check(tail <= head * 1.5 + 40, `partida de ${SOAK_S} s: os nós de áudio vivos não crescem sem parar`, `${samples.map((s) => s.live).join(" ")} (sons ${samples.at(-1).sounds}, ${plays} toques)`);

  // Tela de fim de partida: a vinheta toca no canal da música, a fogueira (derrota) no dos efeitos, e saindo
  // antes do fim os dois somem com o escurecer e são destruídos
  const END = ["music_victory", "music_defeat", "sfx_fire_loop"];
  for (const won of [true, false]) {
    if (!won) await T.startRun();
    await page.evaluate((won) => {
      const lu = window.game.scene.getScene("LevelUpScene");
      if (window.game.scene.isActive("LevelUpScene")) lu.scene.stop();
      const g = window.game.scene.getScene("GameScene");
      if (window.game.scene.isPaused("GameScene")) g.scene.resume();
      g._onGameOver(won, false, true);
    }, won);
    await until(() => window.game.scene.isActive("GameOverScene"), null, 30000);
    const a = await now();
    await waitAudio(2.5);
    const r = await meter(a, await now());
    const on = await page.evaluate((END) => window.game.sound.sounds.filter((s) => END.includes(s.key) && s.isPlaying).map((s) => `${s.key}:${s._channel}`), END);
    const want = won ? ["music_victory:music"] : ["music_defeat:music", "sfx_fire_loop:sfx"];
    check(want.every((w) => on.includes(w)) && r.pk > 0, `fim de partida (${won ? "vitória" : "derrota"}): vinheta${won ? "" : " e fogueira"} no canal certo`, `${on.join(" ")} · ${dB(r.pk)}`);
    await page.evaluate(() => void window.game.scene.getScene("GameOverScene")._go("CampScene"));
    await until(() => window.game.scene.isActive("CampScene"), null, 30000);
    // destruído = pendingRemove: o gerenciador só o tira da lista no próximo quadro que ele rodar (com o
    // teto de fps, o quadro seguinte pode demorar); o que importa é não sobrar som vivo
    const left = await page.evaluate((END) => window.game.sound.sounds.filter((s) => END.includes(s.key) && !s.pendingRemove).length, END);
    check(left === 0, "saindo da tela de fim, vinheta e fogueira são destruídas", `${left} sobrando`);
  }

  // Ambiência da Clareira pela hora (a tela de fim deixou o jogo na Clareira)
  {
    const camp = (fn, arg) => page.evaluate(fn, arg);
    const amb = () => camp(() => window.game.scene.getScene("CampScene").ambience.state);
    const setHour = (h) =>
      camp((h) => {
        const c = window.game.scene.getScene("CampScene");
        c._hourOverride = h;
        c._applyTimeOfDay();
        c.ambience.played = {};
      }, h);
    const vol = (k, v) =>
      camp(
        async ([k, v]) => {
          const { Settings } = await import("/src/systems/Settings.js");
          Settings.set(k, v);
        },
        [k, v],
      );
    await until(() => window.game.scene.getScene("CampScene")?.ambience?.state.hour != null, null, 30000);
    const NIGHT = ["grilo", "ferreiro", "cururu", "urutau", "coruja"],
      DAY = ["cigarra", "bemtevi", "sabia"];
    await camp(() => (window.game.scene.getScene("CampScene").ambience.rateMul = 30)); // cantos 30× mais frequentes
    await setHour(23);
    await waitAudio(6);
    let a = await amb();
    const sp = (p) => Object.keys(p).filter((k) => p[k] > 0);
    check(a.weights.night === 1 && a.beds.night > 0.3 && !a.beds.day, "23h: a cama da noite (grilos) toca, a do dia não", JSON.stringify(a.beds));
    check(sp(a.played).length >= 3 && sp(a.played).every((k) => NIGHT.includes(k)), "23h: só bichos da noite cantam", JSON.stringify(a.played));
    // só a ambiência (Música 0): ela segue a barra de Efeitos
    await vol("music", 0);
    await waitAudio(0.5);
    let t = await now();
    await waitAudio(2);
    const only = await meter(t, await now());
    await vol("sfx", 0);
    await waitAudio(0.5);
    t = await now();
    await waitAudio(1.5);
    const mute = await meter(t, await now());
    check(only.pk > 0 && only.pk < 0.5 && mute.pk === 0, "a mata toca no canal dos Efeitos: com Música 0 ela segue; Efeitos 0 cala", `${dB(only.pk)} → ${dB(mute.pk)}`);
    await vol("sfx", 0.95);
    await vol("music", 0.92);
    // a hora vira: troca suave (as camas se cruzam em AMBIENCE.XFADE_S) e os bichos mudam
    await setHour(12.5);
    await waitAudio(0.6);
    const mid = await amb();
    await waitAudio(AUDIO.AMBIENCE.XFADE_S * 1.3);
    a = await amb();
    check(mid.beds.night > 0.15 && mid.beds.day < a.beds.day * 0.8, "12h30: a noite não corta na hora — as camas se cruzam", `0,6 s depois: noite ${mid.beds.night}, dia ${mid.beds.day}`);
    check(a.weights.day === 1 && a.beds.day > 0.3 && (a.beds.night ?? 0) < 0.03, "e termina no dia", JSON.stringify(a.beds));
    await waitAudio(4);
    a = await amb();
    check(sp(a.played).length >= 2 && sp(a.played).every((k) => DAY.includes(k)), "12h30: cigarras, bem-te-vi e sabiá (nada da noite)", JSON.stringify(a.played));
    // entrar e sair da Clareira não deixa nós de áudio para trás
    const visit = async (to) => {
      await camp((to) => void window.game.scene.getScenes(true)[0].scene.start(to), to);
      await until((to) => window.game.scene.isActive(to), to, 30000);
      await waitAudio(2.5);
      return camp(() => window.__aud.live.size);
    };
    const n1 = await visit("TitleScene");
    await visit("CampScene");
    await visit("TitleScene");
    await visit("CampScene");
    const n2 = await visit("TitleScene");
    check(n2 <= n1 + 4, "entrar e sair da Clareira duas vezes não acumula nós de áudio", `${n1} → ${n2} nós vivos no título`);
  }
  check(!T.errs.length, "sem erro no console", T.errs.slice(0, 3).join(" | "));
} catch (e) {
  failures++;
  console.log("  FALHA (exceção)", e.message.split("\n")[0]);
}

await browser.close();
server?.close();
console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo.");
process.exit(failures ? 1 : 0);
