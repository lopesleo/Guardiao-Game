// Teste do TOQUE (joystick virtual) num navegador de verdade, com toques simulados como os do
// celular: o joystick tem de andar antes e DEPOIS de tudo que pausa a partida. Nasceu do bug de
// 18/10/2026 (1.0.4): um off("resume") geral apagava o ouvinte que religava o joystick e, depois da
// 1ª carta de nível, não dava mais para andar no celular — nenhum teste no PC pegava, porque o
// teclado não passa pelo joystick.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:toque                     (ou: node tools/test-toque.mjs)
//
// Variáveis: MODES=dynamic,static  SIDES=left,right  LAB_URL=… (servidor já rodando)  SHOTS=pasta
// Cada combinação (flutuante/fixo × destro/canhoto) passa por: andar → carta de nível com o dedo no
// joystick → duas cartas seguidas → pausa ⏸ e CONTINUAR → reviver (cena pausada por outra) →
// "Jogar de novo" (a cena é reaproveitada: ouvintes não podem somar) → andar na Clareira depois de
// abrir e fechar uma janela. Sai com código 1 se algo falhar.
// Armadilhas: page.evaluate não pode devolver objetos do Phaser (o ScenePlugin é enorme e circular:
// o Node estoura a memória ao serializar) — por isso os "void". O renderizador do headless roda a poucos quadros por segundo (esperar por condição,
// não por tempo); o toque vai pelo CDP (Input.dispatchTouchEvent), que gera touch + pointer events
// como o WebView do Android.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { startLabServer } from "./lab-server.mjs";

const MODES = (process.env.MODES || "dynamic,static").split(",");
const SIDES = (process.env.SIDES || "left,right").split(",");
const SHOTS = process.env.SHOTS || "";
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url;
const W = 1280,
  H = 600;

const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});

let failures = 0;
const check = (ok, what, extra = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${what}${extra ? "  " + extra : ""}`);
  return ok;
};

async function runCombo(mode, side) {
  console.log(`\n== joystick ${mode === "static" ? "fixo" : "flutuante"}, lado ${side === "right" ? "direito (canhoto)" : "esquerdo"} ==`);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, locale: "pt-BR", serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(
    ({ mode, side }) => localStorage.setItem("guardiao_settings_v1", JSON.stringify({ joyMode: mode, joySide: side, music: 0, sfx: 0 })),
    { mode, side },
  );
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts = []) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const tap = async (p, id = 9) => {
    await touch("touchStart", [{ x: p.x, y: p.y, id }]);
    await page.waitForTimeout(60);
    await touch("touchEnd");
  };
  const until = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms });
  const active = (k) => page.evaluate((k) => window.game.scene.isActive(k), k);

  // Onde o polegar encosta: no centro do fixo, ou no meio da metade de baixo do lado escolhido
  const thumb = () =>
    page.evaluate(
      ({ side, W, H }) => {
        const r = document.querySelector(".nipple .back")?.getBoundingClientRect();
        if (r && r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        return { x: side === "right" ? W - 220 : 220, y: H - 140 };
      },
      { side, W, H },
    );
  // Encosta e arrasta. Devolve o vetor do joystick com o dedo ainda no lugar
  const press = async (id, scene) => {
    const b = await thumb();
    await touch("touchStart", [{ x: b.x, y: b.y, id }]);
    for (let k = 1; k <= 6; k++) await touch("touchMove", [{ x: b.x + k * 9, y: b.y - k * 5, id }]);
    await page.waitForTimeout(120);
    return page.evaluate((s) => ({ ...window.game.scene.getScene(s).inputMgr.joystickVec }), scene);
  };
  // Anda de verdade: o vetor sobe e o herói sai do lugar
  const walks = async (what, scene = "GameScene") => {
    const pos = () => page.evaluate((s) => { const p = window.game.scene.getScene(s).player; return { x: p.x, y: p.y }; }, scene);
    const a = await pos();
    const v = await press(41, scene);
    await page.waitForTimeout(700);
    const b = await pos();
    await touch("touchEnd");
    await page.waitForTimeout(150);
    const zone = await page.evaluate((s) => window.game.scene.getScene(s).joystick?.zone?.style.pointerEvents, scene);
    const ok = Math.hypot(v.x, v.y) > 0.3 && Math.hypot(b.x - a.x, b.y - a.y) > 4;
    // Na falha, o estado da partida (morte = fim de jogo de propósito, não bug do joystick)
    const why = ok ? "" : await page.evaluate((s) => { const g = window.game.scene.getScene(s); return ` fimDeJogo=${!!g.gameOver} vida=${Math.round(g.player?.hp ?? -1)} cenas=${window.game.scene.getScenes(true).map((x) => x.scene.key).join(",")}`; }, scene);
    return check(ok, what, `vetor=${Math.hypot(v.x, v.y).toFixed(2)} andou=${Math.hypot(b.x - a.x, b.y - a.y).toFixed(0)}px zona=${zone}${why}`);
  };
  // Toca um texto visível de uma cena (botões do kit), pelo conteúdo
  const tapText = async (scene, re) => {
    const p = await page.evaluate(
      ({ scene, src }) => {
        const re = new RegExp(src),
          found = [];
        const walk = (o) => {
          if (o.type === "Text" && re.test(o.text) && o.visible) found.push(o);
          (o.list || []).forEach(walk);
        };
        window.game.scene.getScene(scene).children.list.forEach(walk);
        const t = found.at(-1);
        if (!t) return null;
        const b = t.getBounds(),
          c = window.game.canvas.getBoundingClientRect(),
          k = c.width / window.game.scale.width;
        return { x: c.left + (b.x + b.width / 2) * k, y: c.top + (b.y + b.height / 2) * k };
      },
      { scene, src: re.source },
    );
    if (!p) throw new Error(`não achei ${re} em ${scene}`);
    await tap(p);
  };
  // Escolhe a 1ª carta tocando nela, como o jogador
  const pickCard = async () => {
    await until(() => window.game.scene.isActive("LevelUpScene") && window.game.scene.getScene("LevelUpScene")._cardObjs?.[0]?.alpha > 0.95);
    const off = await page.evaluate(() => window.game.scene.getScene("GameScene").joystick?.zone?.style.pointerEvents);
    check(off === "none", "com as cartas abertas, o joystick não come o toque", `zona=${off}`);
    const p = await page.evaluate(() => {
      const b = window.game.scene.getScene("LevelUpScene")._cardObjs[0].getBounds(),
        c = window.game.canvas.getBoundingClientRect(),
        k = c.width / window.game.scale.width;
      return { x: c.left + (b.x + b.width / 2) * k, y: c.top + (b.y + b.height / 2) * k };
    });
    await tap(p);
    await until(() => !window.game.scene.isActive("LevelUpScene") || window.game.scene.getScene("LevelUpScene")._locked, null, 10000);
  };
  const gameRunning = () => until(() => window.game.scene.isActive("GameScene") && !window.game.scene.isPaused("GameScene") && !window.game.scene.isActive("LevelUpScene"), null, 30000);
  // Partida previsível: herói imune e sem subir de nível sozinho (as armas automáticas matam, e as gemas
  // podiam abrir cartas no meio de um arrasto — o joystick sai de cena com as cartas, como deve; o teste
  // é que ficava instável, 19/10/2026). As cartas do teste vêm só de _openNextLevelUp/player:levelup
  const calm = () => page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); g._god = true; g.player.gainXp = () => {}; });
  const listeners = () => page.evaluate(() => { const e = window.game.scene.getScene("GameScene").events; return ["pause", "resume", "player:levelup", "shutdown"].map((k) => `${k}:${e.listenerCount(k)}`).join(" "); });

  try {
    await page.goto(URL);
    await until(() => window.game?.scene?.isActive("TitleScene"), null, 120000);
    await page.evaluate(() => void window.game.scene.getScene("TitleScene").scene.start("GameScene"));
    await until(() => window.game.scene.getScene("GameScene")?.player && !window.game.scene.getScene("GameScene")._intro, null, 60000);
    await calm();
    await page.waitForTimeout(500);
    await walks("anda no começo da partida");
    const before = await listeners();

    // 1) Sobe de nível COM o dedo no joystick (o normal: quem joga nunca solta o polegar)
    await press(1, "GameScene");
    await page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); g._pendingLevelUps++; g._openNextLevelUp(); });
    await touch("touchMove", [{ ...(await thumb()), id: 1 }]);
    await touch("touchEnd");
    await pickCard();
    await gameRunning();
    await walks("anda depois de escolher a carta (dedo estava no joystick)");

    // 2) Duas cartas em fila (XP alto, baú dourado)
    await page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); g._pendingLevelUps += 2; g._openNextLevelUp(); });
    await pickCard();
    await until(() => window.game.scene.isActive("LevelUpScene") && !window.game.scene.getScene("LevelUpScene")._locked, null, 15000);
    await pickCard();
    await gameRunning();
    await walks("anda depois de duas cartas seguidas");

    // 3) Pausa pelo botão ⏸ e CONTINUAR, tocando como no celular
    await page.evaluate(() => void window.game.scene.getScene("GameScene").pauseGame());
    await until(() => window.game.scene.isActive("PauseScene"));
    await page.waitForTimeout(600);
    await tapText("PauseScene", /^CONTINUAR$/);
    await gameRunning();
    await walks("anda depois de pausar e continuar");

    // 4) Outra cena por cima pausando a partida (o mesmo caminho do reviver e do modo infinito)
    await page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); g.scene.pause(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => void window.game.scene.getScene("GameScene").scene.resume());
    await gameRunning();
    await walks("anda depois de pausa/volta de outra cena");

    check((await listeners()) === before, "ouvintes da cena não somaram durante a partida", await listeners());

    // 5) "Jogar de novo": a cena é reaproveitada — ouvintes não podem somar, e as cartas abrem 1×
    await page.evaluate(() => void window.game.scene.getScene("GameScene").scene.restart());
    await until(() => window.game.scene.getScene("GameScene")?.player && !window.game.scene.getScene("GameScene")._intro && window.game.scene.getScene("GameScene").elapsedMs > 0, null, 60000);
    await calm();
    check((await listeners()) === before, "ouvintes iguais depois de Jogar de novo", `${await listeners()} (antes ${before})`);
    await walks("anda na partida nova");
    await page.evaluate(() => void window.game.scene.getScene("GameScene").events.emit("player:levelup"));
    await until(() => window.game.scene.isActive("LevelUpScene"));
    const opened = await page.evaluate(() => window.game.scene.getScene("GameScene")._pendingLevelUps);
    check(opened === 0, "uma subida de nível abre UMA tela de cartas", `pendentes=${opened}`);
    await pickCard();
    await gameRunning();
    await walks("anda depois da carta na partida nova");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/toque_${mode}_${side}_partida.png` });

    // 6) Clareira: abrir e fechar uma janela não pode deixar o joystick desligado
    await page.evaluate(() => {
      const g = window.game.scene.getScene("GameScene");
      g.meta.data.runsPlayed = Math.max(3, g.meta.data.runsPlayed || 0);
      g.scene.start("CampScene");
    });
    await until(() => window.game.scene.isActive("CampScene") && window.game.scene.getScene("CampScene").player && !window.game.scene.getScene("CampScene")._cutscene, null, 60000);
    await page.waitForTimeout(800);
    await walks("anda na Clareira", "CampScene");
    await page.evaluate(() => void window.game.scene.getScene("CampScene")._showSettings());
    await until(() => window.game.scene.getScene("CampScene")._modals.length > 0);
    await page.waitForTimeout(300);
    const campOff = await page.evaluate(() => window.game.scene.getScene("CampScene").joystick?.zone?.style.pointerEvents);
    check(campOff === "none", "com janela aberta na Clareira, o joystick sai de cena", `zona=${campOff}`);
    await page.evaluate(() => void window.game.scene.getScene("CampScene")._modals.at(-1).close());
    await until(() => window.game.scene.getScene("CampScene")._modals.length === 0, null, 10000);
    await page.waitForTimeout(300);
    await walks("anda na Clareira depois de fechar a janela", "CampScene");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/toque_${mode}_${side}_clareira.png` });
  } catch (e) {
    check(false, "o roteiro chegou ao fim", String(e.message || e).split("\n")[0]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/toque_${mode}_${side}_erro.png` }).catch(() => {});
  }
  check(errs.length === 0, "sem erros no console", errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
for (const mode of MODES) for (const side of SIDES) await runCombo(mode, side);
await browser.close();
server?.close();
console.log(failures ? `\n${failures} FALHA(S)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
