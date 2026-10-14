// Robô que aprende a jogar: partidas REAIS aceleradas (sem desenhar e SEM modo deus) com um robô que
// só anda e usa o dash, como o jogador. A ideia veio do ML-Agents da Unity (treinar um agente jogando),
// adaptada ao nosso jogo: em vez de rede neural, o "cérebro" é um campo de forças com 15 pesos
// (fugir do bando, desviar de projéteis, sair dos avisos dos chefes, buscar gemas e corações…)
// e o treino é evolutivo (método da entropia cruzada): cada geração testa variações dos pesos nas
// mesmas partidas e a média se move para as que sobreviveram mais.
//
// Para que serve: um "jogador habilidoso" de laboratório para medir o que o robô do rx-lab (imortal,
// andando em círculo) não mede — taxa de vitória por Perigo e build, minuto e causa das mortes,
// dano recebido por fonte (bando, projétil, golpe de chefe) e estratégias degeneradas (se o robô
// aprender a vencer de um jeito que não é divertido, isso é um furo do jogo, não mérito dele).
//
//   python videos/promo/tools/serve.py 8151        (ou outro servidor estático na raiz; ver LAB_URL)
//   npm i --no-save playwright-core                 (usa o Edge instalado, headless)
//   node tools/bot-lab.mjs treinar [gerações]       → grava tools/bot-lab/cerebro.json (+ histórico)
//   node tools/bot-lab.mjs medir [saida.json]       → resumo por Perigo/build e causas de morte
//   node tools/bot-lab.mjs assistir                 → janela de verdade, em tempo real, com o cérebro
//                                                     mais recente (relê o arquivo a cada partida)
//
// Variáveis: DIFFS=1,4  SEEDS=11,23  BUILDS=jogador,aleatoria,fogo_gelo…  PAR=4  POP=12  BOOST=1
//   CEREBRO=caminho.json (pesos usados no medir; sem arquivo = pesos do meio da faixa)
//   BOOST multiplica o dano das armas (emula bênçãos e poder permanente de um veterano)
// Armadilhas: as mesmas do rx-lab (relógio virtual porque tweens usam Date.now; cartas aplicadas sem
// abrir a tela). A oferta de reviver (anúncio) conta como morte. Resultados variam muito entre
// sementes: sempre ≥2 sementes, e compare cérebros nas MESMAS sementes.
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const MODE = process.argv[2] || "medir";
const DIFFS = (process.env.DIFFS || "1,4").split(",").map(Number);
const SEEDS = (process.env.SEEDS || "11,23").split(",").map(Number);
const BUILDS = (process.env.BUILDS || "jogador").split(",");
const PAR = Number(process.env.PAR || 4);
const POP = Number(process.env.POP || 12);
const BOOST = Number(process.env.BOOST || 1);
const URL = process.env.LAB_URL || "http://127.0.0.1:8151/?debug=1";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "bot-lab");
const CEREBRO = process.env.CEREBRO || path.join(DIR, "cerebro.json");

// Pesos do cérebro: nome → [mínimo, máximo]. O treino trabalha em [0,1] e converte.
const GENES = {
  eR: [80, 320], // raio em que um inimigo já empurra (px)
  eW: [0, 3], // força da fuga do bando
  eP: [0.5, 3], // curva da fuga (alto = só foge de quem está colado)
  orbit: [0, 1.5], // contornar o bando (andar de lado) em vez de fugir reto
  pW: [0, 5], // força do desvio de projéteis
  pT: [150, 1200], // quanto à frente olha a trajetória dos projéteis (ms)
  tW: [0, 6], // força para sair dos avisos de golpe (chefes, mula, corpo-seco, fogo, esporos)
  tM: [0, 80], // folga além da borda do aviso (px)
  gW: [0, 2.5], // atração pelas gemas
  gR: [150, 900], // até onde enxerga gemas (px)
  gSafe: [0, 2], // quanto a coleta cede ao perigo por perto
  lW: [0, 2], // atração por lanternas, itens delas e baús
  hW: [0, 3], // atração por coração quando ferido
  cW: [0, 2], // puxão para longe da muralha
  inertia: [0, 0.9], // suavização da direção (alto = vira devagar)
  dashOn: [0.5, 6], // perigo a partir do qual usa o dash
  dashThreat: [0, 1], // >0,5 = dasha também ao estar dentro de um aviso de golpe
};
const NAMES = Object.keys(GENES);
const decode = (u) => Object.fromEntries(NAMES.map((n, i) => [n, GENES[n][0] + Math.min(1, Math.max(0, u[i])) * (GENES[n][1] - GENES[n][0])]));

const ELEMS = {
  jogador: null, // escolhe como um jogador comum (evolução > arma nova até 3 > dano > passiva)
  aleatoria: null,
  fogo_gelo: ["fire", "ice"],
  gelo_raio: ["ice", "bolt"],
  fogo_raio: ["fire", "bolt"],
  fogo_vento: ["fire", "wind"],
  prisma: ["fire", "ice", "bolt"],
};

// Perfis temporários do Edge (um por partida, com cache) ficam no disco do repositório (_tmp/, fora do
// git), não no TEMP do C:, que enche e aperta a memória virtual do Windows
const TMP = process.env.LAB_TMP || path.join(DIR, "..", "..", "_tmp", "edge");
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = TMP;

const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: MODE !== "assistir",
  args: MODE === "assistir" ? ["--window-size=1300,800", "--autoplay-policy=no-user-gesture-required"] : [],
});

async function runOne(theta, build, diff, seed, live = null) {
  const ctx = live?.ctx || (await browser.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: "block" }));
  const p = live?.page || (await ctx.newPage());
  const errs = [];
  if (!live) p.on("pageerror", (e) => errs.push(e.message));
  if (!live) await p.addInitScript((seed) => {
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
  // save de laboratório: todas as armas, 4 vagas, dash e Despertar, Perigo escolhido, sem tutorial
  await p.evaluate(async (diff) => {
    const { MetaProgression } = await import("/src/systems/MetaProgression.js");
    const { BASE_WEAPONS } = await import("/src/systems/UpgradeSystem.js");
    const m = new MetaProgression();
    m.data.unlockedWeapons = [...BASE_WEAPONS];
    m.data.unlockedAbilities = ["DASH", "AWAKEN"];
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

  await p.evaluate(({ th, elems, random, boost, trace, live, label }) => {
    const g = window.game;
    const gs = g.scene.getScene("GameScene");
    gs._god = false;
    let vt = Date.now();
    if (!live) {
      g.loop.sleep();
      // relógio virtual (tweens e timers do Phaser usam o relógio real)
      const perf0 = performance.now();
      const vt0 = vt;
      Date.now = () => vt;
      performance.now = () => perf0 + (vt - vt0);
    }

    // ---- cartas: escolhidas e aplicadas sem abrir a tela -------------------------------------
    const up = gs.upgrades;
    const dmgFirst = (a, b) => (/Dano|Dmg/.test(b.stat) ? 1 : 0) - (/Dano|Dmg/.test(a.stat) ? 1 : 0);
    const pickCard = (cards) => {
      const ok = cards.filter((c) => c.type !== "pact");
      const pool = ok.length ? ok : cards;
      if (random) return pool[Math.floor(Math.random() * pool.length)];
      const evo = pool.find((c) => c.type === "evolution");
      if (evo) return evo;
      const fits = (c) => !elems || elems.includes(c.element);
      const nw = pool.find((c) => c.type === "new" && fits(c));
      if (nw && (elems || gs.player.weapons.length < 3)) return nw;
      // passivas que um jogador comum pega cedo: ímã (1ª), vida e recarga
      const taken = (id) => gs.player.passivesTaken?.[id] || 0;
      const pasPick = pool.find((c) => c.type === "passive" && c.passiveId === "magnet" && taken("magnet") < 2);
      if (pasPick) return pasPick;
      const upg = pool.filter((c) => c.type === "upgrade").sort(dmgFirst);
      if (upg.length) return upg[0];
      const pas = ["cooldown", "hp", "area", "magnet", "regen"].map((id) => pool.find((c) => c.type === "passive" && c.passiveId === id)).find(Boolean) || pool.find((c) => c.type === "passive");
      return pas || nw || pool[0];
    };
    gs._openNextLevelUp = function () {
      while (this._pendingLevelUps > 0 && !this.gameOver) {
        this._pendingLevelUps--;
        let cards = up.generateCards(this.player);
        for (let i = 0; i < 4 && elems; i++) {
          if (cards.some((c) => c.type !== "new" || elems.includes(c.element))) break;
          cards = up.generateCards(this.player);
        }
        let c = pickCard(cards);
        if (elems && c.type === "new" && !elems.includes(c.element)) c = cards.find((x) => x.type !== "new") || c;
        up.apply(c, this.player);
      }
      this.hud?.refreshWeapons?.();
    };

    // ---- registro de dano recebido, por fonte -----------------------------------------------
    const pl = gs.player;
    const hits = {};
    let lastSrc = null;
    const origTake = pl.takeDamage.bind(pl);
    pl.takeDamage = (dmg) => {
      const hp0 = pl.hp;
      const landed = origTake(dmg);
      if (!landed) return landed;
      const st = new Error().stack || "";
      let src;
      if (/FightLog/.test(st)) {
        const b = gs.boss?.active ? gs.boss : null;
        src = "golpe:" + (b?.brain?.last || "minichefe");
      } else if (/Hazards/.test(st)) src = "fogo no chão";
      else if (/_updateSpores/.test(st)) src = "esporos";
      else {
        let near = null,
          nd = 1e9;
        gs.enemyProjPool.forEachActive((q) => {
          const d = Math.hypot(q.x - pl.x, q.y - pl.y);
          if (d < nd) (nd = d), (near = q);
        });
        if (near && nd < 30) src = "projétil";
        else if (gs.boss?.active && Math.hypot(gs.boss.x - pl.x, gs.boss.y - pl.y) < 70) src = "chefe (encostão)";
        else {
          let ek = "bando";
          let ed = 1e9;
          gs.enemyPool.forEachActive((e) => {
            const d = Math.hypot(e.x - pl.x, e.y - pl.y);
            if (d < ed) (ed = d), (ek = e._elite ? "elite:" + e._elite : "bando:" + (e._kind || "?"));
          });
          src = ek;
        }
      }
      const h = (hits[src] ||= { n: 0, dmg: 0 });
      h.n++;
      h.dmg += Math.max(0, hp0 - pl.hp);
      lastSrc = src;
      return landed;
    };

    // ---- cérebro: campo de forças -----------------------------------------------------------
    const A = gs.physics.world.bounds;
    const cx = A.centerX,
      cy = A.centerY;
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    let dirX = 1,
      dirY = 0,
      stuckT = 0,
      kickUntil = 0,
      kickX = 0,
      kickY = 0,
      sx = pl.x,
      sy = pl.y;
    const threats = () => {
      const out = [];
      if (gs.boss?.active && gs.boss.brain?.threat) out.push(gs.boss.brain.threat);
      gs.enemyPool.forEachActive((e) => e._brain?.threat && out.push(e._brain.threat));
      return out;
    };
    const decide = () => {
      const px = pl.x,
        py = pl.y;
      let fx = 0,
        fy = 0,
        danger = 0,
        inThreat = false;
      // bando
      let mx = 0,
        my = 0,
        mn = 0;
      gs.enemyPool.forEachActive((e) => {
        const dx = px - e.x,
          dy = py - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > th.eR) return;
        const s = Math.pow((th.eR - d) / th.eR, th.eP) * (e._elite ? 2 : 1);
        fx += (dx / d) * s * th.eW;
        fy += (dy / d) * s * th.eW;
        danger += s;
        mx += e.x;
        my += e.y;
        mn++;
      });
      if (gs.boss?.active) {
        const dx = px - gs.boss.x,
          dy = py - gs.boss.y;
        const d = Math.hypot(dx, dy) || 1;
        const R = th.eR * 1.5;
        if (d < R) {
          const s = Math.pow((R - d) / R, th.eP) * 3;
          fx += (dx / d) * s * th.eW;
          fy += (dy / d) * s * th.eW;
          danger += s;
        }
      }
      // contornar: anda de lado em relação ao centro do bando (o "kite" dos survivor-likes)
      if (mn) {
        const dx = px - mx / mn,
          dy = py - my / mn;
        const d = Math.hypot(dx, dy) || 1;
        const side = dirX * (-dy / d) + dirY * (dx / d) >= 0 ? 1 : -1; // mantém o sentido atual
        fx += (-dy / d) * side * th.orbit * Math.min(1, mn / 6);
        fy += (dx / d) * side * th.orbit * Math.min(1, mn / 6);
      }
      // projéteis: desvia de quem vai passar perto nos próximos pT ms
      const T = th.pT / 1000;
      gs.enemyProjPool.forEachActive((q) => {
        const vx = q.body?.velocity?.x || 0,
          vy = q.body?.velocity?.y || 0;
        const v2 = vx * vx + vy * vy;
        if (v2 < 1) return;
        const rx = px - q.x,
          ry = py - q.y;
        const t = (rx * vx + ry * vy) / v2;
        if (t < 0 || t > T) return;
        let ox = rx - vx * t,
          oy = ry - vy * t;
        let od = Math.hypot(ox, oy);
        if (od > 44) return;
        if (od < 1) (ox = -vy), (oy = vx), (od = Math.sqrt(v2));
        const s = (1 - od / 44) * (1 - t / T);
        fx += (ox / od) * s * th.pW;
        fy += (oy / od) * s * th.pW;
        danger += s * 2;
      });
      // avisos de golpe (exatamente o que a tela mostra: brain.threat), fogo no chão e esporos
      const push = (x, y, w) => {
        fx += x * w * th.tW;
        fy += y * w * th.tW;
        inThreat = true;
        danger += w;
      };
      const zone = (zx, zy, r) => {
        const dx = px - zx,
          dy = py - zy;
        const d = Math.hypot(dx, dy) || 1;
        if (d < r + th.tM) push(dx / d, dy / d, 1 + (r + th.tM - d) / (r + th.tM));
      };
      for (const t of threats()) {
        if (t.zones) for (const z of t.zones) zone(z.x, z.y, z.r);
        if (t.lanes)
          for (const l of t.lanes) {
            const ux = Math.cos(l.ang),
              uy = Math.sin(l.ang);
            const along = (px - l.x) * ux + (py - l.y) * uy;
            const perp = -(px - l.x) * uy + (py - l.y) * ux;
            if (along > -th.tM && along < l.len + th.tM && Math.abs(perp) < l.w / 2 + th.tM) {
              const sg = perp >= 0 ? 1 : -1;
              push(-uy * sg, ux * sg, 1.5);
            }
          }
        const tang = (o, sg) => {
          const a = Math.atan2(py - o.y, px - o.x);
          return [-Math.sin(a) * sg, Math.cos(a) * sg, a];
        };
        if (t.cone) {
          const c = t.cone;
          const d = Math.hypot(px - c.x, py - c.y);
          const a = Math.atan2(py - c.y, px - c.x);
          const off = angDiff(a, c.ang);
          if (d < c.range + th.tM && Math.abs(off) < c.half + 0.25) {
            const [tx, ty] = tang(c, off >= 0 ? 1 : -1);
            push(tx, ty, 1.5);
          }
        }
        if (t.gap) {
          const c = t.gap;
          const a = Math.atan2(py - c.y, px - c.x);
          const off = angDiff(c.ang, a);
          if (Math.abs(off) > c.half * 0.5) {
            const [tx, ty] = tang(c, off >= 0 ? 1 : -1);
            push(tx, ty, 1.5);
          }
        }
        if (t.sweep) {
          const c = t.sweep;
          const d = Math.hypot(px - c.x, py - c.y);
          if (d > c.blind && d < c.len + th.tM) {
            const a = Math.atan2(py - c.y, px - c.x);
            const rel = angDiff(a, c.a0) * c.dir;
            if (rel > -0.45) {
              const [tx, ty] = tang(c, -c.dir); // volta para trás da borda de partida
              push(tx, ty, 1.5);
            }
          }
        }
        if (t.chase) zone(t.chase.x, t.chase.y, 140);
      }
      for (const h of gs.hazards?.list || []) zone(h.x, h.y, h.r);
      for (const c of gs._spores || []) zone(c.x, c.y, c.r);
      // coleta: vai para onde há MAIS gemas (soma ponderada pelo valor e pela distância, não só a
      // mais próxima), e cede quando o perigo aperta (gSafe)
      const calm = 1 / (1 + th.gSafe * danger);
      let gx = 0,
        gy = 0;
      gs.xpPool.forEachActive((q) => {
        const dx = q.x - px,
          dy = q.y - py;
        const d = Math.hypot(dx, dy);
        if (d < 1 || d > th.gR) return;
        const w = (q.xpValue || 1) / Math.max(40, d);
        gx += (dx / d) * w;
        gy += (dy / d) * w;
      });
      const gm = Math.hypot(gx, gy);
      if (gm > 0) {
        const s = Math.min(1, gm * 20) * th.gW * calm;
        fx += (gx / gm) * s;
        fy += (gy / gm) * s;
      }
      // lanternas (quebram ao toque e soltam item), itens no chão e baús fechados
      let lx = 0,
        ly = 0,
        ld = 700;
      const near = (x, y) => {
        const d = Math.hypot(x - px, y - py);
        if (d < ld) (ld = d), (lx = x), (ly = y);
      };
      for (const l of gs.lanterns?.list || []) near(l.x, l.y);
      for (const it of gs.lanterns?.items || []) near(it.spr.x, it.spr.y);
      for (const c of gs.chests || []) if (!c.opened) near(c.x, c.y);
      if (ld < 700 && ld > 1) {
        fx += ((lx - px) / ld) * th.lW * calm;
        fy += ((ly - py) / ld) * th.lW * calm;
      }
      const hurt = 1 - pl.hp / pl.maxHp;
      if (hurt > 0.3) {
        let hx = 0,
          hy = 0,
          hd = 900;
        gs.heartPool.forEachActive((q) => {
          const d = Math.hypot(q.x - px, q.y - py);
          if (d < hd) (hd = d), (hx = q.x), (hy = q.y);
        });
        if (hd < 900 && hd > 1) {
          fx += ((hx - px) / hd) * hurt * th.hW;
          fy += ((hy - py) / hd) * hurt * th.hW;
        }
      }
      // muralha: puxa para dentro quando passa de 60% do caminho até a borda
      const ex = (px - cx) / (A.width / 2),
        ey = (py - cy) / (A.height / 2);
      const edge = Math.max(Math.abs(ex), Math.abs(ey));
      if (edge > 0.6) {
        const k = ((edge - 0.6) / 0.4) ** 2 * th.cW * 3;
        fx -= ex * k;
        fy -= ey * k;
      }
      // preso (canto, bando parado em volta): empurrão aleatório por meio segundo
      const now = live ? Date.now() : vt;
      if (now - stuckT > 1500) {
        if (Math.hypot(px - sx, py - sy) < 30) {
          const a = Math.random() * Math.PI * 2;
          (kickX = Math.cos(a)), (kickY = Math.sin(a)), (kickUntil = now + 500);
        }
        (stuckT = now), (sx = px), (sy = py);
      }
      let nx = fx,
        ny = fy;
      if (now < kickUntil) (nx = kickX), (ny = kickY);
      const n = Math.hypot(nx, ny);
      if (n > 0.02) (nx /= n), (ny /= n);
      else (nx = dirX), (ny = dirY); // nada por perto: segue andando (parado é alvo fácil)
      dirX = th.inertia * dirX + (1 - th.inertia) * nx;
      dirY = th.inertia * dirY + (1 - th.inertia) * ny;
      const m = Math.hypot(dirX, dirY) || 1;
      (dirX /= m), (dirY /= m);
      gs.inputMgr.joystickVec = { x: dirX, y: dirY };
      if (pl.dashReady?.() && (danger > th.dashOn || (inThreat && th.dashThreat > 0.5))) gs.inputMgr.dashPressed = true;
      if (pl.awakenMeter >= pl.awakenMax) gs.inputMgr.awakenPressed = true;
    };

    // ---- laço --------------------------------------------------------------------------------
    window.__lab = { hits, minutes: [], bossStart: null, bossEnd: null, end: null };
    let nextMin = 60000;
    let step = 0;
    window.__step = (n) => {
      for (let i = 0; i < n; i++) {
        if (gs.gameOver) return (window.__lab.end ||= pl.isDead() ? "morreu" : "venceu");
        if (g.scene.isActive("EndlessChoiceScene")) {
          window.__lab.bossEnd ??= gs.elapsedMs;
          return (window.__lab.end = "venceu");
        }
        if (g.scene.isActive("ReviveScene") || g.scene.isActive("FirstDefeatScene")) return (window.__lab.end = "morreu");
        if (!gs.sys.isActive()) {
          for (const sc of g.scene.getScenes(true)) if (sc !== gs && sc.scene.key !== "HUDScene") g.scene.stop(sc.scene.key);
          g.scene.resume("GameScene");
        }
        if (step++ % 3 === 0) decide(); // decide a cada ~100 ms (reação humana rápida)
        if (boost !== 1) for (const w of pl.weapons) if (!w.__b) (w.dmgMult *= boost), (w.__b = 1);
        vt += 33;
        g.scene.update(vt, 33);
        if (gs.elapsedMs >= nextMin) {
          window.__lab.minutes.push({ t: nextMin / 1000, lvl: pl.level, hp: Math.round(pl.hp) });
          nextMin += 60000;
        }
        if (gs.boss?.active && window.__lab.bossStart == null) window.__lab.bossStart = gs.elapsedMs;
        if (trace && step % 15 === 0) {
          let nE = 0, nP = 0;
          gs.enemyPool.forEachActive((e) => Math.hypot(e.x - pl.x, e.y - pl.y) < 120 && nE++);
          gs.enemyProjPool.forEachActive((q) => Math.hypot(q.x - pl.x, q.y - pl.y) < 150 && nP++);
          (window.__lab.trace ||= []).push([Math.round(gs.elapsedMs / 100) / 10, Math.round(pl.x), Math.round(pl.y), Math.round(pl.hp), +gs.inputMgr.joystickVec.x.toFixed(2), +gs.inputMgr.joystickVec.y.toFixed(2), nE, nP]);
        }
      }
      return "ok";
    };
    window.__lastSrc = () => lastSrc;
    if (live) {
      // tempo real: o jogo roda normal e o cérebro decide a cada ~100 ms; a legenda mostra quem joga
      let tag = document.getElementById("__bot");
      if (!tag) {
        tag = document.createElement("div");
        tag.id = "__bot";
        tag.style.cssText = "position:fixed;left:8px;top:8px;z-index:99;padding:6px 10px;background:#000a;color:#c8f08c;font:13px monospace;white-space:pre;pointer-events:none";
        document.body.appendChild(tag);
      }
      let last = 0;
      const tick = () => {
        if (window.__lab.end) return;
        if (gs.gameOver) return (window.__lab.end = pl.isDead() ? "morreu" : "venceu");
        if (g.scene.isActive("EndlessChoiceScene")) return (window.__lab.end = "venceu");
        if (g.scene.isActive("ReviveScene") || g.scene.isActive("FirstDefeatScene")) return (window.__lab.end = "morreu");
        if (boost !== 1) for (const w of pl.weapons) if (!w.__b) (w.dmgMult *= boost), (w.__b = 1);
        const now = Date.now();
        if (now - last >= 100) (last = now), decide();
        const s = Math.floor(gs.elapsedMs / 1000);
        tag.textContent = `${label}
${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}  nível ${pl.level}  vida ${Math.round(pl.hp)}/${pl.maxHp}`;
      };
      gs.events.on("update", tick);
      // cenas por cima (baú, santuário, história) pausam a partida: fecha e volta
      setInterval(() => {
        if (window.__lab.end || gs.gameOver || gs.sys.isActive()) return;
        for (const sc of g.scene.getScenes(true)) if (sc !== gs && sc.scene.key !== "HUDScene" && !/Revive|Endless|FirstDefeat|GameOver/.test(sc.scene.key)) g.scene.stop(sc.scene.key);
        if (!g.scene.isActive("ReviveScene")) g.scene.resume("GameScene");
      }, 500);
    }
  }, { th: theta, elems: ELEMS[build], random: build === "aleatoria", boost: BOOST, trace: !!process.env.TRACE, live: !!live, label: live?.label || "" });

  const dur = await p.evaluate(() => window.game.scene.getScene("GameScene").diff.durationS);
  const limitS = dur + 300;
  let st = "ok";
  for (;;) {
    if (live) {
      await p.waitForTimeout(1000);
      st = (await p.evaluate(() => window.__lab.end)) || "ok";
    } else st = await p.evaluate(() => window.__step(300));
    const t = await p.evaluate(() => window.game.scene.getScene("GameScene").elapsedMs / 1000);
    if (st !== "ok" || t > limitS) break;
  }
  const res = await p.evaluate(() => {
    const gs = window.game.scene.getScene("GameScene");
    const b = gs.boss;
    return {
      ...window.__lab,
      t: gs.elapsedMs / 1000,
      killer: window.__lab.end === "morreu" ? window.__lastSrc() : null,
      bossHpLeft: b?.maxHp ? Math.max(0, b.hp) / b.maxHp : null,
      lvl: gs.player.level,
      weapons: gs.player.weapons.map((w) => `${w.key}${w.level}`),
    };
  });
  if (!live) await ctx.close();
  return { build, diff, seed, dur, errs: errs.slice(0, 3), ...res, end: res.end || "tempo" };
}

// Pontuação de treino: fração do tempo até o chefe sobrevivida + vitória + quanto do chefe tirou
function score(r) {
  let s = Math.min(1, r.t / r.dur);
  if (r.bossStart != null && r.bossHpLeft != null) s += 0.5 * (1 - r.bossHpLeft);
  if (r.end === "venceu") s += 1;
  return s;
}

async function pool(jobs, fn) {
  const out = new Array(jobs.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: PAR }, async () => {
      while (i < jobs.length) {
        const k = i++;
        try {
          out[k] = await fn(...jobs[k]);
        } catch (e) {
          console.log(`  falhou: ${e.message.split("\n")[0]}`);
          out[k] = null;
        }
      }
    }),
  );
  return out;
}

const fmtS = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

if (MODE === "treinar") {
  // Entropia cruzada: média e desvio por peso; cada geração sorteia POP cérebros, joga todos nas
  // mesmas partidas (sementes novas a cada geração, para não decorar uma) e recentra nos melhores.
  const GENS = Number(process.argv[3] || 8);
  const ELITE = Math.max(2, Math.round(POP / 4));
  fs.mkdirSync(DIR, { recursive: true });
  const histPath = path.join(DIR, "treino.json");
  let mu = NAMES.map(() => 0.5),
    sd = NAMES.map(() => 0.25);
  let hist = [];
  let gen0 = 0;
  // INICIO=cerebro-antigo.json: parte dos pesos de outro cérebro (genes novos começam no meio da faixa)
  if (process.env.INICIO) {
    const old = JSON.parse(fs.readFileSync(process.env.INICIO, "utf8")).pesos;
    mu = NAMES.map((n) => (old[n] == null ? 0.5 : Math.min(1, Math.max(0, (old[n] - GENES[n][0]) / (GENES[n][1] - GENES[n][0])))));
  }
  // CONTINUAR=1: retoma do cérebro salvo (média, desvio, histórico e contagem de gerações)
  if (fs.existsSync(CEREBRO) && process.env.CONTINUAR) {
    const c = JSON.parse(fs.readFileSync(CEREBRO, "utf8"));
    mu = c.u;
    sd = c.sd.map((v) => Math.max(v, 0.08));
    gen0 = c.treino?.geracoes || 0;
    if (fs.existsSync(histPath)) hist = JSON.parse(fs.readFileSync(histPath, "utf8"));
  }
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  let best = null;
  for (let gen = gen0; gen < gen0 + GENS; gen++) {
    const t0 = Date.now();
    const pop = Array.from({ length: POP }, (_, k) => (k === 0 ? mu.slice() : mu.map((m, i) => Math.min(1, Math.max(0, m + sd[i] * gauss())))));
    const games = DIFFS.flatMap((d) => SEEDS.map((s) => [d, s * 1000 + gen]));
    const jobs = pop.flatMap((u, k) => games.map(([d, s]) => [k, d, s]));
    const res = await pool(jobs, (k, d, s) => runOne(decode(pop[k]), BUILDS[0], d, s));
    const fit = pop.map((_, k) => {
      const rs = res.filter((r, j) => r && jobs[j][0] === k);
      return rs.length ? rs.reduce((a, r) => a + score(r), 0) / rs.length : 0;
    });
    const order = fit.map((f, k) => [f, k]).sort((a, b) => b[0] - a[0]);
    const elite = order.slice(0, ELITE).map(([, k]) => pop[k]);
    mu = NAMES.map((_, i) => elite.reduce((a, u) => a + u[i], 0) / ELITE);
    sd = NAMES.map((_, i) => Math.max(0.04, Math.sqrt(elite.reduce((a, u) => a + (u[i] - mu[i]) ** 2, 0) / ELITE)));
    const wins = res.filter((r) => r?.end === "venceu").length;
    const line = { gen, best: +order[0][0].toFixed(3), media: +(fit.reduce((a, b) => a + b, 0) / POP).toFixed(3), atual: +fit[0].toFixed(3), vitorias: `${wins}/${res.length}`, min: Math.round((Date.now() - t0) / 60000) };
    hist.push({ ...line, mu: decode(mu) });
    console.log(`geração ${gen}: melhor ${line.best} · média ${line.media} · cérebro atual ${line.atual} · vitórias ${line.vitorias} · ${line.min} min`);
    if (!best || order[0][0] > best.fit) best = { fit: order[0][0], u: pop[order[0][1]] };
    fs.writeFileSync(CEREBRO, JSON.stringify({ u: mu, sd, pesos: decode(mu), treino: { geracoes: gen + 1, pop: POP, diffs: DIFFS, sementes: SEEDS, build: BUILDS[0], boost: BOOST } }, null, 1));
    fs.writeFileSync(histPath, JSON.stringify(hist, null, 1));
  }
  console.log("pesos finais:", JSON.stringify(decode(mu)));
} else if (MODE === "assistir") {
  // Vitrine: uma janela só, partida atrás de partida, sempre com o cérebro mais novo do arquivo
  const ctx = await browser.newContext({ viewport: null, serviceWorkers: "block" });
  const page = await ctx.newPage();
  for (let k = 0; ; k++) {
    let c = null;
    try {
      c = JSON.parse(fs.readFileSync(CEREBRO, "utf8"));
    } catch {}
    const theta = c?.pesos || decode(NAMES.map(() => 0.5));
    const d = DIFFS[k % DIFFS.length];
    const label = `robô · ${c ? `cérebro da geração ${c.treino.geracoes}` : "sem treino"} · Perigo ${d} · build ${BUILDS[0]}`;
    console.log(label);
    try {
      const r = await runOne(theta, BUILDS[0], d, 0, { ctx, page, label });
      console.log(`  ${r.end} em ${fmtS(r.t)} · nível ${r.lvl}${r.killer ? " · último golpe: " + r.killer : ""}`);
    } catch (e) {
      if (/closed|Target/.test(e.message)) break; // fechou a janela: acabou
      console.log(`  falhou: ${e.message.split("\n")[0]}`);
    }
    await page.waitForTimeout(2500);
  }
} else {
  const OUT = process.argv[3] || "bot-lab.json";
  const theta = fs.existsSync(CEREBRO) ? JSON.parse(fs.readFileSync(CEREBRO, "utf8")).pesos : decode(NAMES.map(() => 0.5));
  if (!fs.existsSync(CEREBRO)) console.log("(sem cérebro treinado: usando os pesos do meio da faixa)");
  const jobs = [];
  for (const b of BUILDS) for (const d of DIFFS) for (const s of SEEDS) jobs.push([b, d, s]);
  const res = (await pool(jobs, (b, d, s) => runOne(theta, b, d, s))).filter(Boolean);
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log("\nbuild        Perigo  fim     tempo   nível  chefe   matou");
  for (const r of res)
    console.log(
      `${r.build.padEnd(12)} ${String(r.diff).padStart(4)}    ${r.end.padEnd(7)} ${fmtS(r.t).padStart(6)}  ${String(r.lvl).padStart(5)}  ${r.bossHpLeft == null ? "  -   " : (100 - r.bossHpLeft * 100).toFixed(0).padStart(4) + "% "}  ${r.killer || ""}${r.errs.length ? "  ERRO " + r.errs[0] : ""}`,
    );
  // dano recebido por fonte, somado por Perigo
  for (const d of DIFFS) {
    const tot = {};
    for (const r of res.filter((x) => x.diff === d)) for (const [k, v] of Object.entries(r.hits)) (tot[k] ||= { n: 0, dmg: 0 }), (tot[k].n += v.n), (tot[k].dmg += v.dmg);
    const all = Object.values(tot).reduce((a, v) => a + v.dmg, 0) || 1;
    const top = Object.entries(tot).sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 8);
    console.log(`\nPerigo ${d}: dano recebido por fonte`);
    for (const [k, v] of top) console.log(`  ${k.padEnd(24)} ${String(v.n).padStart(4)} golpes  ${((v.dmg / all) * 100).toFixed(0).padStart(3)}%`);
  }
}
await browser.close();
