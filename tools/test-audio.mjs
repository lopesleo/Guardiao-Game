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
//   · os nós de áudio não crescem sem parar numa partida longa (SOAK_S segundos, padrão 40).
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:audio                     (ou: node tools/test-audio.mjs)
//
// Variáveis: SOAK_S=120 (partida longa)  LAB_URL=… (servidor já rodando)
// Armadilhas: page.evaluate não devolve objetos do Phaser (estoura a memória ao serializar); o renderizador
// headless roda a poucos quadros por segundo (esperar por condição, não por tempo); o AudioParam.value só
// atualiza a cada bloco do áudio (ler depois de esperar um pouco).
import { chromium } from "playwright-core";
import { startLabServer } from "./lab-server.mjs";

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

// Roda no navegador antes do jogo: o grampo na saída e a contagem de nós
function tap() {
  const A = (window.__aud = { peak: 0, blocks: [], live: new Set(), plays: {} });
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

async function open(settings) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, locale: "pt-BR", serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.addInitScript(tap);
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
  await page.evaluate(() => {
    const p = window.game.scene.getScene("GameScene").player;
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
  check((await mix()).danger, "33% de vida: continua em perigo (histerese, não pisca)");
  await page.evaluate(() => {
    const p = window.game.scene.getScene("GameScene").player;
    p.hp = p.maxHp * 0.6;
  });
  await waitAudio(2);
  m = await mix();
  check(!m.danger && m.mLP > m.open * 0.9, "curou: o perigo desliga e a música abre", `${m.mLP.toFixed(0)} Hz`);

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
    const left = await page.evaluate((END) => window.game.sound.sounds.filter((s) => END.includes(s.key)).length, END);
    check(left === 0, "saindo da tela de fim, vinheta e fogueira são destruídas", `${left} sobrando`);
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
