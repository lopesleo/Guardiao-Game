// Laboratório das reações: partidas REAIS aceleradas (sem desenhar), com um robô que só anda e
// escolhe cartas por build, medindo a fatia das reações no dano minuto a minuto e na luta do chefe.
// Serviu para decidir a escala do dano das reações (docs/BALANCING.md, 13/10/2026).
//
//   (o servidor do jogo sobe sozinho, tools/lab-server.mjs; LAB_URL=… usa outro já rodando)
//   npm i --no-save playwright-core                 (usa o Edge instalado, headless)
//   node tools/rx-lab.mjs saida.json [none|hp] [k] [maestria]
//
// Variáveis: BUILDS=fogo_gelo,prisma…  DIFFS=1,4  SEEDS=11,23  PAR=3  BOOST=1.7 (armas de veterano)
//   curva "hp" = multiplica as reações por (ENEMY.HP(wave)/ENEMY.HP(0))^k; maestria = +X fixo (0.2 = +20%)
// O laboratório troca o player.prism a cada quadro (todas as reações já multiplicam por ele), então
// dá para testar curvas sem mexer no jogo. Armadilhas: relógio virtual (tweens usam Date.now), cartas
// aplicadas sem abrir a tela, ímã de gemas a cada 5 s (o robô sozinho mal sobe de nível).
import { chromium } from "playwright-core";
import fs from "fs";
import { startLabServer } from "./lab-server.mjs";

const OUT = process.argv[2] || "rx-lab.json";
const CURVE = process.argv[3] || "none";
const K = Number(process.argv[4] || 0.8);
const MASTERY = Number(process.argv[5] || 0); // bônus fixo extra das reações (emula a carta)
const BUILDS = (process.env.BUILDS || "fogo_gelo,gelo_raio,fogo_raio,fogo_vento,prisma,aleatoria").split(",");
const DIFFS = (process.env.DIFFS || "1,4").split(",").map(Number);
const SEEDS = (process.env.SEEDS || "11,23").split(",").map(Number);
const PAR = Number(process.env.PAR || 3);
const BOOST = Number(process.env.BOOST || 1); // dano das ARMAS (emula bênçãos/poder permanente)
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url + "?debug=1";

const ELEMS = {
  fogo_gelo: ["fire", "ice"],
  gelo_raio: ["ice", "bolt"],
  fogo_raio: ["fire", "bolt"],
  fogo_vento: ["fire", "wind"],
  prisma: ["fire", "ice", "bolt"],
  aleatoria: null,
};

const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

async function runOne(build, diff, seed) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: "block" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript((seed) => {
    let s = seed >>> 0;
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  await p.goto(URL, { waitUntil: "load" });
  await p.waitForFunction(() => window.game && window.game.isBooted, null, { timeout: 180000 });
  await p.waitForTimeout(2500);
  // save de laboratório: todas as armas, 4 vagas, Perigo escolhido, sem tutorial
  await p.evaluate(async (diff) => {
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const { BASE_WEAPONS } = await import("/src/systems/UpgradeSystem.js");
    const m = new MetaProgression();
    m.data.unlockedWeapons = [...BASE_WEAPONS];
    m.data.builds = { ...(m.data.builds || {}), forge: { level: 4 } };
    m.data.selectedDifficulty = diff;
    m.data.maxDifficultyCleared = 4;
    m.data.runsPlayed = 9;
    m.data.firstDefeatSeen = true;
    m.data.selectedCharacter = "guardian";
    m._save();
    const g = window.game;
    for (const sc of g.scene.getScenes(true)) g.scene.stop(sc.scene.key);
    g.scene.start("GameScene");
  }, diff);
  await p.waitForFunction(() => {
    const gs = window.game.scene.getScene("GameScene");
    return gs && gs.sys.isActive() && gs.player;
  }, null, { timeout: 60000 });

  await p.evaluate(({ elems, curve, k, mastery, boost }) => {
    const g = window.game;
    const gs = g.scene.getScene("GameScene");
    gs._god = true;
    g.loop.sleep();
    // relógio virtual (tweens e timers do Phaser usam o relógio real)
    let vt = Date.now();
    const perf0 = performance.now();
    Date.now = () => vt;
    performance.now = () => perf0 + (vt - window.__vt0);
    window.__vt0 = vt;
    const up = gs.upgrades;
    const elemOf = (c) => c.element;
    const pickCard = (cards) => {
      const ok = cards.filter((c) => c.type !== "pact");
      const pool = ok.length ? ok : cards;
      if (!elems) return pool[Math.floor(Math.random() * pool.length)];
      const evo = pool.find((c) => c.type === "evolution");
      if (evo) return evo;
      const nw = pool.find((c) => c.type === "new" && elems.includes(elemOf(c)));
      if (nw) return nw;
      const upg = pool.filter((c) => c.type === "upgrade").sort((a, b) => (/Dano|Dmg/.test(b.stat) ? 1 : 0) - (/Dano|Dmg/.test(a.stat) ? 1 : 0));
      if (upg.length) return upg[0];
      const pas = pool.find((c) => c.type === "passive");
      return pas || pool[0];
    };
    // cartas sem abrir a tela: escolhe e aplica na hora
    gs._openNextLevelUp = function () {
      while (this._pendingLevelUps > 0 && !this.gameOver) {
        this._pendingLevelUps--;
        let cards = up.generateCards(this.player);
        // build dirigida: se só houver armas novas de outro elemento, troca a mesa (como o reroll)
        for (let i = 0; i < 4 && elems; i++) {
          const good = cards.some((c) => c.type !== "new" || elems.includes(c.element));
          if (good) break;
          cards = up.generateCards(this.player);
        }
        let c = pickCard(cards);
        if (elems && c.type === "new" && !elems.includes(c.element)) c = cards.find((x) => x.type !== "new") || c;
        up.apply(c, this.player);
        (window.__picks ||= []).push(`${Math.floor(this.elapsedMs / 1000)}:${up.cardId(c)}`);
      }
      this.hud?.refreshWeapons?.();
    };
    const HP = (w) => 12 + 6 * w;
    const basePrism = () => {
      const n = ["fire", "ice", "bolt", "wind"].filter((e) => gs.player.weapons.some((w) => (w.element || w.def?.element) === e)).length;
      return n >= 3 ? 1.3 : 1;
    };
    window.__lab = { minutes: [], bossStart: null, bossEnd: null, bossLedger0: null };
    const snap = () => Object.fromEntries(Object.entries(gs._dmgBy).map(([kk, v]) => [kk, Math.round(v)]));
    let nextMin = 60000;
    let ang = 0;
    window.__n = 0;
    window.__step = (n) => {
      for (let i = 0; i < n; i++) {
        if (gs.gameOver) return "over";
        // robô: anda em círculo largo (pega gemas, foge do bolo)
        ang += 0.012;
        if (++window.__n % 150 === 0) gs.xpPool.forEachActive((g) => (g._pulled = true));
        gs.inputMgr.joystickVec = { x: Math.cos(ang), y: Math.sin(ang) };
        if (gs.player.awakenMeter >= gs.player.awakenMax) gs.inputMgr.awakenPressed = true;
        // multiplicador das reações: Prisma × curva × maestria
        let mult = basePrism();
        if (curve === "hp") mult *= Math.pow(HP(gs.waveIndex()) / HP(0), k);
        mult *= 1 + mastery;
        gs.player.prism = mult;
        if (boost !== 1) for (const w of gs.player.weapons) if (!w.__b) { w.dmgMult *= boost; w.__b = 1; }
        vt += 33;
        // cenas por cima (baú, história) pausam a partida: retoma
        if (g.scene.isActive("EndlessChoiceScene")) {
          if (window.__lab.bossEnd == null) window.__lab.bossEnd = gs.elapsedMs;
          window.__lab.bossLedger1 = snap();
          return "over";
        }
        if (!gs.sys.isActive() && !gs.gameOver) {
          for (const sc of g.scene.getScenes(true)) if (sc !== gs && sc.scene.key !== "HUDScene") { (window.__overlays ||= {})[sc.scene.key] = 1; g.scene.stop(sc.scene.key); }
          g.scene.resume("GameScene");
        }
        g.scene.update(vt, 33);
        if (gs.elapsedMs >= nextMin) {
          window.__lab.minutes.push({ t: nextMin / 1000, wave: gs.waveIndex(), lvl: gs.player.level, weapons: gs.player.weapons.map((w) => `${w.key}${w.level}`), by: snap() });
          nextMin += 60000;
        }
        if (gs.boss && window.__lab.bossStart == null) {
          window.__lab.bossStart = gs.elapsedMs;
          window.__lab.bossLedger0 = snap();
        }
      }
      return "ok";
    };
  }, { elems: ELEMS[build], curve: CURVE, k: K, mastery: MASTERY, boost: BOOST });

  const limitS = [420, 420, 480, 540, 600][diff] + 240;
  let st = "ok";
  for (;;) {
    st = await p.evaluate(() => window.__step(300));
    const t = await p.evaluate(() => window.game.scene.getScene("GameScene").elapsedMs / 1000);
    if (st === "over" || t > limitS) break;
  }
  const res = await p.evaluate(() => {
    const gs = window.game.scene.getScene("GameScene");
    const by = Object.fromEntries(Object.entries(gs._dmgBy).map(([k, v]) => [k, Math.round(v)]));
    return { ...window.__lab, end: by, t: gs.elapsedMs / 1000, won: !!gs._won || (window.__lab.bossEnd != null), picks: window.__picks, overlays: window.__overlays, weapons: gs.player.weapons.map((w) => `${w.key}${w.level}`), lvl: gs.player.level };
  });
  await ctx.close();
  return { build, diff, seed, errs: errs.slice(0, 3), ...res };
}

const jobs = [];
for (const b of BUILDS) for (const d of DIFFS) for (const s of SEEDS) jobs.push([b, d, s]);
const results = [];
let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const [b, d, s] = jobs[idx++];
    const t0 = Date.now();
    try {
      const r = await runOne(b, d, s);
      results.push(r);
      console.log(`${b} d${d} s${s}: ${((Date.now() - t0) / 1000).toFixed(0)}s, t=${r.t.toFixed(0)} boss=${r.bossStart != null ? ((r.bossEnd ?? r.t * 1000) - r.bossStart) / 1000 : "-"}s ${r.errs.length ? "ERR " + r.errs[0] : ""}`);
    } catch (e) {
      console.log(`${b} d${d} s${s}: FALHOU ${e.message.split("\n")[0]}`);
    }
    fs.writeFileSync(OUT, JSON.stringify(results));
  }
}
await Promise.all(Array.from({ length: PAR }, worker));
await browser.close();
server?.close();

// ---- resumo: fatia das reações por minuto (média das sementes), nível final, chefe ----
const rs = results;
const key=r=>r.build+" d"+r.diff;
const groups={};for(const r of rs)(groups[key(r)]||=[]).push(r);
const isRx=k=>k.startsWith("rx_");
const share=(d)=>{const tot=Object.values(d).reduce((a,b)=>a+b,0);const rx=Object.entries(d).filter(([k])=>isRx(k)).reduce((a,[,v])=>a+v,0);return tot?rx/tot:NaN;};
const diff=(a,b)=>{const d={};for(const k in b)d[k]=b[k]-((a||{})[k]||0);return d;};
for(const [g,list] of Object.entries(groups).sort()){
  const nMin=Math.max(...list.map(r=>r.minutes.length));
  const cols=[];
  for(let i=0;i<nMin;i++){const v=list.map(r=>r.minutes[i]?share(diff(r.minutes[i-1]?.by,r.minutes[i].by)):NaN).filter(x=>!isNaN(x));cols.push(v.length?Math.round(100*v.reduce((a,b)=>a+b)/v.length):"-");}
  const boss=list.map(r=>r.bossStart!=null?(r.bossEnd!=null?((r.bossEnd-r.bossStart)/1000).toFixed(0)+"s":"vivo"):"-").join("/");
  const bshare=list.map(r=>r.bossLedger1?Math.round(100*share(diff(r.bossLedger0,r.bossLedger1)))+"%":"-").join("/");
  const lv=list.map(r=>r.lvl).join("/");
  console.log(g.padEnd(16),"rx% por min:",cols.map(c=>String(c).padStart(3)).join(" "),"| lv",lv,"| chefe",boss,"rx no chefe",bshare);
}
