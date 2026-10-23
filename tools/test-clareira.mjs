// Teste da CLAREIRA DA CAATINGA (skin grátis do acampamento, docs/COSMETICOS.md) num navegador de verdade, sem o modo
// de teste (?debug=1 liberaria a Ancestral pela loja simulada): o jogo como o jogador recebe.
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:clareira                  (ou: node tools/test-clareira.mjs)
//
// Variáveis: ONLY=nome,nome (só esses cenários)  LAB_URL=… (servidor já rodando)  SHOTS=pasta (os textos conferidos são os do português)
// Cobre: bloqueada no começo (e o Guarda-roupa diz como liberar) · só o Pesadelo NA Caatinga libera · uma partida de
// verdade vencida no Pesadelo na Caatinga dá a conquista "Mandacaru em Flor" e a Clareira nova na tela do fim · a
// cena da Anciã com a flor do mandacaru e o selo "!" do Guarda-roupa (abre direto na Clareira nova) · USAR troca o
// visual (a cena recomeça no sertão) · horta, obras, pesca, cozinha e fogueira funcionando no sertão, em toda hora do
// dia · recarregar mantém (a conquista mora no save, que vai para a nuvem) · a Ancestral continua exigindo a compra ·
// nenhum erro no console. Sai com código 1 se algo falhar.
// Armadilhas: no headless cada passo do jogo é cortado em 200 ms e os timers andam mais devagar que o relógio — as
// esperas somam o dt da cena; scene.start(key) sem dados mantém os da visita anterior (passe sempre os dados);
// page.evaluate não pode devolver objetos do Phaser (use void).
import { chromium } from "playwright-core";
import fs from "node:fs";
import { startLabServer } from "./lab-server.mjs";

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SHOTS = process.env.SHOTS || "";
const LOC = "pt-BR";
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url;
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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 640 }, locale: LOC, serviceWorkers: "block" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => {
  // só na 1ª carga: o recarregamento do cenário "persistencia" tem de manter o que o jogo gravou
  if (sessionStorage.getItem("__clareira_boot")) return;
  sessionStorage.setItem("__clareira_boot", "1");
  localStorage.clear();
  localStorage.setItem("guardiao_settings_v1", JSON.stringify({ music: 0, sfx: 0 }));
});

const boot = async () => {
  await page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
  await page.waitForTimeout(600);
};
// Mexe no save com o próprio MetaProgression (assina e grava como o jogo)
const meta = (fn, arg) =>
  page.evaluate(
    async ({ src, arg }) => {
      const { MetaProgression } = await import("/src/systems/MetaProgression.js");
      const m = new MetaProgression();
      const r = new Function("m", "d", "arg", src)(m, m.data, arg);
      m._save();
      return r ?? null;
    },
    { src: fn, arg },
  );
// Estado da Clareira e do Guarda-roupa
const st = () =>
  page.evaluate(async () => {
    const { Wardrobe } = await import("/src/systems/Cosmetics.js");
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const d = new MetaProgression().data;
    const c = window.game.scene.getScene("CampScene");
    return {
      owns: Wardrobe.ownsCamp("caatinga"),
      anc: Wardrobe.ownsCamp("ancestral"),
      active: Wardrobe.activeCamp(),
      ach: d.achievements.includes("mandacaru_flor"),
      best: d.bestDiffByBiome?.caatinga ?? null,
      sertao: c?.sys.isActive() ? !!c._sertao : null,
      ancestral: c?.sys.isActive() ? !!c._ancestral : null,
    };
  });
// Vai à Clareira e espera `ms` do relógio DO JOGO (soma o dt da cena: no navegador lento os timers atrasam)
async function camp(o = {}, ms = 2500) {
  await page.evaluate((o) => {
    const g = window.game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    const c = g.scene.getScene("CampScene");
    c.__el = null;
    c.events.once("create", () => {
      c.__el = 0;
      const tick = (_, dt) => (c.__el += dt);
      c.events.on("update", tick);
      c.events.once("shutdown", () => c.events.off("update", tick));
    });
    g.scene.start("CampScene", { fromRun: !!o.fromRun });
  }, o);
  await elapse(ms);
}
const elapse = (ms) =>
  page.waitForFunction(
    (ms) => {
      const c = window.game.scene.getScene("CampScene");
      return c.__el != null && c.sys.isActive() && c.__el > ms;
    },
    ms,
    { timeout: 120000, polling: 200 },
  );
// Espera a cena da Clareira recomeçar (o Guarda-roupa troca a skin e a cena reinicia)
async function campRestart(trigger) {
  await page.evaluate(() => {
    const c = window.game.scene.getScene("CampScene");
    c.__el = null;
    c.events.once("create", () => {
      c.__el = 0;
      const tick = (_, dt) => (c.__el += dt);
      c.events.on("update", tick);
      c.events.once("shutdown", () => c.events.off("update", tick));
    });
  });
  await trigger();
  await elapse(1500);
}
// Textos visíveis da janela aberta (inclui os de dentro dos botões e contêineres)
const modalTexts = () =>
  page.evaluate(() => {
    const m = window.game.scene.getScene("CampScene")._modals.at(-1);
    if (!m) return [];
    const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
    return [m.root, m.body, m.list?.content].filter(Boolean).flatMap(deep).filter((o) => o.type === "Text" && o.visible).map((o) => o.text);
  });
const tapModal = (label) =>
  page.evaluate((label) => {
    const m = window.game.scene.getScene("CampScene")._modals.at(-1);
    const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
    const b = [m.root, m.body].filter(Boolean).flatMap(deep).find((o) => o.label?.text === label && o.onClick);
    if (!b) return false;
    b.onClick();
    return true;
  }, label);
const closeModals = () => page.evaluate(() => { const c = window.game.scene.getScene("CampScene"); while (c._modals.length) c._modals.at(-1).close(); });
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/clareira_${name}.png` });

const SCENARIOS = {
  // Começo do jogo: trancada, e o Guarda-roupa diz o que fazer (e não oferece compra)
  async bloqueada() {
    let s = await st();
    check(!s.owns && !s.ach, "num jogo novo a Clareira da Caatinga está trancada (sem a conquista)", JSON.stringify(s));
    // equipar à força (save editado) não liga: só vale o que o jogador tem
    await page.evaluate(async () => (await import("/src/systems/Cosmetics.js")).Wardrobe.equip("camp", "caatinga"));
    await meta("d.runsPlayed = 3; d.campIntroSeen = true; d.firstDefeatSeen = true;");
    await camp({ fromRun: false });
    s = await st();
    check(s.active === null && s.sertao === false, "equipada sem a conquista, a Clareira continua a de sempre", JSON.stringify(s));
    await page.evaluate(async () => {
      const { openWardrobe } = await import("/src/ui/WardrobeModal.js");
      openWardrobe(window.game.scene.getScene("CampScene"), { tab: "camp", sel: "caatinga" });
    });
    await elapse(3000);
    const tx = await modalTexts();
    const lock = await page.evaluate(() => {
      const m = window.game.scene.getScene("CampScene")._modals.at(-1);
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      const b = [m.root, m.body].filter(Boolean).flatMap(deep).find((o) => o.label?.text && o.onClick && o.enabled === false && o.label.text === "BLOQUEADA");
      return !!b;
    });
    check(tx.some((t) => /Vença no Perigo Pesadelo na Caatinga/.test(t)), "o Guarda-roupa mostra a condição para liberar", tx.filter((t) => /Grátis|Vença/.test(t)).join(" | "));
    check(tx.some((t) => /ainda não venceu na Caatinga|melhor na Caatinga|Vitórias na Caatinga|abra a Trilha do Sertão/.test(t)), "e quanto falta (progresso na Caatinga, ou a trilha a abrir)", tx.filter((t) => /Caatinga|Trilha/.test(t)).slice(0, 4).join(" | "));
    check(lock, "botão BLOQUEADA, desligado (nada de compra: ela é grátis)");
    check(!tx.some((t) => /PACOTE FUNDADOR/.test(t)), "a Clareira da Caatinga não leva à Loja");
    await shot("bloqueada");
    await closeModals();
    // volta ao normal (o jogador não consegue equipar a trancada pelo Guarda-roupa)
    await page.evaluate(async () => (await import("/src/systems/Cosmetics.js")).Wardrobe.equip("camp", null));
  },

  // Só o Pesadelo NA Caatinga libera (as regras, direto no save)
  async regras() {
    const r = await page.evaluate(async () => {
      const { MetaProgression } = await import("/src/systems/MetaProgression.js");
      const out = {};
      const m = new MetaProgression();
      m.registerRun(600, true, 3, "caatinga");
      out.implacavel = m.checkAchievements().map((a) => a.id).includes("mandacaru_flor");
      m.registerRun(600, true, 4, "amazonia");
      out.amazonia = m.checkAchievements().map((a) => a.id).includes("mandacaru_flor");
      m.registerRun(400, false, 4, "caatinga");
      out.derrota = m.checkAchievements().map((a) => a.id).includes("mandacaru_flor");
      out.best = m.data.bestDiffByBiome;
      // desfaz (o cenário da partida faz de verdade)
      m.data.bestDiffByBiome = {};
      m.data.winsByBiome = {};
      m.data.wins = 0;
      m.data.winsByDifficulty = {};
      m.data.achievements = m.data.achievements.filter((a) => a !== "mandacaru_flor");
      m._save();
      return out;
    });
    check(!r.implacavel, "vencer no Implacável na Caatinga não libera");
    check(!r.amazonia, "vencer no Pesadelo na Amazônia não libera");
    check(!r.derrota, "cair no Pesadelo na Caatinga não libera");
    check(r.best?.caatinga === 3 && r.best?.amazonia === 4, "o save guarda o maior Perigo vencido em cada mapa", JSON.stringify(r.best));
  },

  // Uma partida de verdade: Pesadelo na Caatinga, vitória → conquista + Clareira nova na tela do fim
  async partida() {
    await meta(
      `d.runsPlayed = 6; d.firstDefeatSeen = true; d.campIntroSeen = true; d.wins = 4; d.maxDifficultyCleared = 3;
       d.winsByDifficulty = { 0: 1, 1: 1, 2: 1, 3: 1 }; d.winsByBiome = { amazonia: 3, caatinga: 1 };
       d.builds = { ...(d.builds || {}), trail: { level: 2 } }; d.selectedBiome = "caatinga"; d.selectedDifficulty = 4;
       d.revealed = ["shrine", "forge", "nest", "garden", "kitchen", "pond", "board", "chest", "trail", "riverfish"];`,
    );
    await page.evaluate(() => {
      const g = window.game;
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
      g.scene.start("GameScene");
    });
    await page.waitForFunction(() => window.game.scene.getScene("GameScene")?.player && !window.game.scene.getScene("GameScene")._intro, null, { timeout: 60000 });
    const g = await page.evaluate(() => { const g = window.game.scene.getScene("GameScene"); return { biome: g.biomeId, diff: g.diff.id }; });
    check(g.biome === "caatinga" && g.diff === 4, "a partida é no Pesadelo, na Caatinga", JSON.stringify(g));
    await page.evaluate(() => {
      const g = window.game.scene.getScene("GameScene");
      g.hud.kills = 900;
      g._onGameOver(true, false, true);
    });
    await page.waitForFunction(() => window.game.scene.isActive("GameOverScene"), null, { timeout: 30000 });
    const un = await page.evaluate(() => window.game.scene.getScene("GameOverScene").d.newUnlocks);
    check(un.includes("Mandacaru em Flor"), "a vitória dá a conquista Mandacaru em Flor", un.join(" | "));
    check(/^Nova Clareira no Guarda-roupa: Clareira da Caatinga$/.test(un[0] || ""), "e a Clareira nova vem primeiro na lista do fim", un[0]);
    const s = await st();
    check(s.ach && s.owns && s.best === 4, "a conquista fica no save e a Clareira passa a ser do jogador", JSON.stringify(s));
    await page.waitForTimeout(2500);
    await shot("fim_da_partida");
  },

  // Volta à Clareira: a cena da Anciã (a flor do mandacaru abre) e o selo "!" no Guarda-roupa, que abre direto nela
  async aviso() {
    await camp({ fromRun: true }, 1200);
    const pend = await page.evaluate(() => window.game.scene.getScene("CampScene")._pending.map((r) => r.id));
    check(pend[0] === "sertao", "a novidade da visita é a Clareira da Caatinga (uma por vez)", pend.join(","));
    // durante a cena: a flor abre no mandacaru da trilha
    await page.waitForFunction(() => window.game.scene.getScene("CampScene")._cutscene === true, null, { timeout: 30000 }).catch(() => {});
    await elapse(3800);
    await shot("cena_da_flor");
    const flower = await page.evaluate(() => window.game.scene.getScene("CampScene").children.list.filter((o) => o.texture?.key === "camp_sertao_flower").map((o) => o.frame.name));
    check(flower.length >= 1 && flower.includes(4), "a flor do mandacaru da trilha abriu (quadro a quadro, até aberta)", JSON.stringify(flower));
    await page.waitForFunction(() => { const c = window.game.scene.getScene("CampScene"); return !c._cutscene && c.meta.data.revealed.includes("sertao"); }, null, { timeout: 90000, polling: 250 });
    await elapse((await page.evaluate(() => window.game.scene.getScene("CampScene").__el)) + 800);
    let dot = await page.evaluate(() => !!window.game.scene.getScene("CampScene").wardrobeDot?.visible);
    check(dot, "depois da fala, o Guarda-roupa ganha o selo \"!\"");
    await shot("selo_guarda_roupa");
    await page.evaluate(() => window.game.scene.getScene("CampScene").wardrobeBtn.onClick());
    await elapse((await page.evaluate(() => window.game.scene.getScene("CampScene").__el)) + 2500);
    const tx = await modalTexts();
    check(tx.includes("GUARDA-ROUPA") || tx.some((t) => /GUARDA-ROUPA/.test(t)), "o selo abre o Guarda-roupa");
    check(tx.some((t) => t === "Clareira da Caatinga") && tx.some((t) => t === "USAR"), "direto na Clareira da Caatinga, com USAR", tx.filter((t) => /Caatinga|USAR/.test(t)).join(" | "));
    dot = await page.evaluate(() => ({ v: !!window.game.scene.getScene("CampScene").wardrobeDot?.visible, seen: window.game.scene.getScene("CampScene").meta.data.campSeen }));
    check(!dot.v && (dot.seen || []).includes("caatinga"), "o selo some (vista) e fica guardado", JSON.stringify(dot));
    await shot("guarda_roupa");
  },

  // USAR troca o visual: a cena recomeça no sertão (chão, horta, açude, horizonte, bichos)
  async usar() {
    await campRestart(async () => {
      check(await tapModal("USAR"), "toca USAR na Clareira da Caatinga");
      await page.waitForTimeout(400);
      await closeModals();
    });
    const v = await page.evaluate(() => {
      const c = window.game.scene.getScene("CampScene");
      const keys = new Set(c.children.list.map((o) => o.texture?.key));
      return { sertao: c._sertao, chao: keys.has("camp_sertao_ground"), cerca: keys.has("garden_sertao_fence"), acude: keys.has("pond_sertao_base"), juazeiro: keys.has("camp_sertao_juazeiro"), ceu: !!c.band, bichos: (c._lizards || []).length, kapok: keys.has("camp_kapok") };
    });
    check(v.sertao && v.chao && v.cerca && v.acude && v.juazeiro && v.ceu && v.bichos >= 2 && !v.kapok, "a Clareira virou sertão (chão, cerca, açude, juazeiro, horizonte, calangos)", JSON.stringify(v));
    await shot("sertao");
  },

  // Tudo continua funcionando no sertão: horta, obras, pesca, cozinha, fogueira, em toda hora do dia
  async funcoes() {
    await meta(`d.revealed = Array.from(new Set([...(d.revealed || []), "shrine", "forge", "nest", "garden", "kitchen", "pond", "board", "chest", "trail", "riverfish", "sertao"]));
      d.totalCoins = 5000; d.wood = 40; d.stats.harvests = 2;`);
    await camp({ fromRun: false }, 2500);
    const r = await page.evaluate(async () => {
      const c = window.game.scene.getScene("CampScene");
      const out = { sertao: c._sertao };
      const opened = (fn) => {
        const n = c._modals.length;
        fn();
        const ok = c._modals.length > n;
        while (c._modals.length) c._modals.at(-1).close();
        return ok;
      };
      out.obras = opened(() => c._showWorks());
      out.cozinha = opened(() => c._showKitchen());
      out.fogueira = opened(() => c._showCharacters());
      out.trilha = opened(() => c._showDifficulty());
      out.celeiro = opened(() => c._showBarn());
      // horta: o canteiro vazio abre a fileira de sementes; plantar ocupa o canteiro
      const empty = c.garden.plots.findIndex((p, i) => i < c.garden.open && !p);
      out.canteiro = empty;
      if (empty >= 0 && c.garden.available().length) {
        c._plotAction(empty);
        out.fileira = c._modals.length > 0;
        while (c._modals.length) c._modals.at(-1).close();
        c._plantFromBar(empty, c.garden.available()[0], false);
        out.plantou = !!c.garden.plots[empty];
      }
      // pesca: lança a linha no trapiche
      c._startFishing();
      out.pesca = !!c._fishing;
      c._fishing?.close?.();
      // interações do mapa: cada lugar tem quem responda
      out.lugares = c.interactables.filter((it) => !it.plot).map((it) => it.name).filter(Boolean).length;
      return out;
    });
    check(r.sertao, "na Clareira da Caatinga");
    check(r.obras && r.cozinha && r.fogueira && r.trilha && r.celeiro, "Obras, Cozinha, Fogueira, Trilha e Celeiro abrem", JSON.stringify(r));
    check(r.canteiro < 0 || (r.fileira && r.plantou), "a horta planta (fileira de sementes → canteiro ocupado)", JSON.stringify(r));
    check(r.pesca, "a pesca começa no trapiche do açude");
    await elapse((await page.evaluate(() => window.game.scene.getScene("CampScene").__el)) + 2500);
    // o dia inteiro: amanhecer, dia, fim de tarde, noite — sem erro; as flores abrem à noite e fecham de dia
    for (const h of [6.3, 12, 18, 22]) {
      await page.evaluate((h) => { const c = window.game.scene.getScene("CampScene"); c._hourOverride = h; c._applyTimeOfDay(); }, h);
      await elapse((await page.evaluate(() => window.game.scene.getScene("CampScene").__el)) + 2500);
      // cada flor abre (ou fecha) no seu tempo, quadro a quadro: espera todas chegarem ao fim
      if (h === 22 || h === 12)
        await page.waitForFunction((h) => window.game.scene.getScene("CampScene")._flowers.every((fl) => (h === 22 ? fl.s.frame.name >= 4 : fl.s.frame.name === 0)), h, { timeout: 60000, polling: 300 }).catch(() => {});
      const f = await page.evaluate(() => {
        const c = window.game.scene.getScene("CampScene");
        return { flores: c._flowers.map((fl) => fl.s.frame.name), lua: c.band.moon.visible, sol: c.band.sun.visible };
      });
      if (h === 22) check(f.flores.length >= 4 && f.flores.every((n) => n >= 4) && f.lua, "às 22 h a lua está no céu e as flores do mandacaru abriram", JSON.stringify(f));
      if (h === 12) check(f.flores.every((n) => n === 0) && !f.lua, "ao meio-dia as flores estão fechadas e não há lua", JSON.stringify(f));
      if (h === 6.3) check(f.sol, "no amanhecer o sol nasce no horizonte", JSON.stringify({ sol: f.sol }));
      await shot(`hora_${h}`);
    }
  },

  // Recarregar o jogo mantém tudo (a conquista mora no save do jogo — o que vai para a nuvem — e a escolha no Guarda-roupa)
  async persistencia() {
    await page.reload();
    await boot();
    const raw = await page.evaluate(async () => localStorage.getItem((await import("/src/config.js")).META.STORAGE_KEY));
    check(!!raw && raw.includes("mandacaru_flor") && raw.includes('"bestDiffByBiome"'), "o save do jogo (o que sobe para a nuvem) leva a conquista e o recorde por mapa");
    await camp({ fromRun: false });
    const s = await st();
    check(s.owns && s.active === "caatinga" && s.sertao, "depois de recarregar, a Clareira continua a da Caatinga", JSON.stringify(s));
  },

  // A Ancestral continua do Pacote Fundador: sem a compra, não liga nem com a Caatinga liberada
  async ancestral() {
    await page.evaluate(async () => (await import("/src/systems/Cosmetics.js")).Wardrobe.equip("camp", "ancestral"));
    await camp({ fromRun: false });
    const s = await st();
    check(!s.anc && s.active === null && !s.ancestral && !s.sertao, "sem o Pacote Fundador a Ancestral não liga (volta a de sempre)", JSON.stringify(s));
    await page.evaluate(async () => {
      const { openWardrobe } = await import("/src/ui/WardrobeModal.js");
      openWardrobe(window.game.scene.getScene("CampScene"), { tab: "camp", sel: "ancestral" });
    });
    await elapse((await page.evaluate(() => window.game.scene.getScene("CampScene").__el)) + 2500);
    const tx = await modalTexts();
    check(tx.some((t) => /Exclusiva do Pacote Fundador/.test(t)) && !tx.includes("USAR"), "no Guarda-roupa a Ancestral segue exclusiva do Fundador (sem USAR)", tx.filter((t) => /Fundador|USAR|BREVE|PACOTE/.test(t)).join(" | "));
    await closeModals();
    await page.evaluate(async () => (await import("/src/systems/Cosmetics.js")).Wardrobe.equip("camp", "caatinga"));
  },
};

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
await page.goto(URL);
await boot();
for (const name of Object.keys(SCENARIOS)) {
  if (ONLY && !ONLY.includes(name)) continue;
  console.log(`\n== ${name} ==`);
  try {
    await SCENARIOS[name]();
  } catch (e) {
    check(false, "o roteiro chegou ao fim", String(e.message || e).split("\n")[0]);
    await shot(`erro_${name}`).catch(() => {});
  }
}
check(errs.length === 0, "sem erros no console", errs.slice(0, 3).join(" | "));
await browser.close();
server?.close();
console.log(failures ? `\n${failures} FALHA(S)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
