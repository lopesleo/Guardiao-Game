// Robô que aprende a jogar: partidas REAIS aceleradas (sem desenhar e SEM modo deus) com um robô que
// só anda e usa o dash, como o jogador. A ideia veio do ML-Agents da Unity (treinar um agente jogando),
// adaptada ao nosso jogo: em vez de rede neural, o "cérebro" segue as prioridades de um jogador, em
// camadas fixas (1. sobreviver agora, 2. vida baixa, 3. objetivo: baú > item > lanterna > gemas,
// 4. combate: rondar o bando no alcance das armas) e o treino evolutivo (método da entropia cruzada)
// só ajusta os números de cada camada, testando variações nas mesmas partidas e ficando com as que
// PONTUAM mais (nível, abates, baús, lanternas, chefe e vitória — não só durar).
//
// Para que serve: um "jogador habilidoso" de laboratório para medir o que o robô do rx-lab (imortal,
// andando em círculo) não mede — taxa de vitória por Perigo e build, minuto e causa das mortes,
// dano recebido por fonte (bando, projétil, golpe de chefe) e estratégias degeneradas (se o robô
// aprender a vencer de um jeito que não é divertido, isso é um furo do jogo, não mérito dele).
//
//   (o servidor do jogo sobe sozinho, tools/lab-server.mjs; LAB_URL=… usa outro já rodando)
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
import { startLabServer } from "./lab-server.mjs";
import path from "path";
import { fileURLToPath } from "url";

const MODE = process.argv[2] || "medir";
const DIFFS = (process.env.DIFFS || "1,4").split(",").map(Number);
const SEEDS = (process.env.SEEDS || "11,23").split(",").map(Number);
const BUILDS = (process.env.BUILDS || "jogador").split(",");
const PAR = Number(process.env.PAR || 4);
const POP = Number(process.env.POP || 12);
const BOOST = Number(process.env.BOOST || 1);
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url + "?debug=1";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "bot-lab");
const CEREBRO = process.env.CEREBRO || path.join(DIR, "cerebro.json");

// Números do cérebro, por camada: nome → [mínimo, máximo]. O treino trabalha em [0,1] e converte.
// A ORDEM das camadas é fixa (ver "cérebro: prioridades de jogador"); o treino só ajusta estes números.
const GENES = {
  // 1. sobreviver agora
  tW: [1, 6], // força para sair dos avisos de golpe (chefes, mula, corpo-seco, fogo, esporos)
  tM: [0, 80], // folga além da borda do aviso (px)
  pW: [0.5, 5], // força do desvio de projéteis
  pT: [150, 1200], // quanto à frente olha a trajetória dos projéteis (ms)
  cR: [40, 140], // inimigo mais perto que isso está "encostando" (px)
  cW: [0.5, 5], // força para sair de quem está encostando
  mW: [0.5, 3], // força para voltar da muralha
  dashN: [2, 12], // dash quando tantos inimigos estão encostando
  dashP: [0.2, 1], // dash quando um projétil está quase acertando (0–1)
  dashThreat: [0, 1], // >0,5 = dash também dentro de aviso de golpe
  sMix: [0, 0.8], // quanto do resto (objetivo/combate) ainda conta enquanto sobrevive
  // 2. vida baixa
  lowHp: [0.15, 0.6], // abaixo desta fração da vida: coração vira o objetivo e joga na defensiva
  // 3. objetivo (baú > item > lanterna > gemas)
  G: [0.5, 3], // força para ir ao objetivo
  D: [100, 1500], // quanto a distância pesa contra a prioridade (alto = prioridade manda mais)
  bk: [0, 1.5], // quanto o bando no caminho desvaloriza um objetivo
  lD: [300, 1100], // até onde vai atrás de lanterna e item (px); baú: o mapa todo
  gR: [200, 900], // até onde procura aglomerado de gemas (px)
  gRet: [0, 2], // a caminho do objetivo, quanto ainda recua do bando que chega perto
  // 4. combate
  kR: [110, 280], // raio do anel em volta do bando (as armas alcançam 120–280 px)
  kT: [0, 2], // girar em volta do bando
  eliteR: [0, 200], // folga a mais para elite e minichefe (px)
  bR: [90, 380], // distância de combate do chefe (px)
  bW: [0, 3], // força para manter essa distância
  bT: [0, 1.5], // circular em volta do chefe
  inertia: [0, 0.9], // suavização da direção (alto = vira devagar)
};
// Números "de jogador", escolhidos à mão: ponto de partida do treino (INICIO=jogador) e do
// assistir/medir (CEREBRO=jogador)
const JOGADOR = {
  tW: 4, tM: 25, pW: 3.5, pT: 600, cR: 80, cW: 3, mW: 1.5, dashN: 6, dashP: 0.7, dashThreat: 0.8, sMix: 0.3,
  lowHp: 0.35,
  G: 1.5, D: 500, bk: 0.5, lD: 800, gR: 600, gRet: 1,
  kR: 190, kT: 1, eliteR: 80, bR: 210, bW: 2, bT: 0.8, inertia: 0.35,
};
// AJUSTE="kW=0,orbit=1" sobrescreve pesos no medir/assistir (para isolar o efeito de um comportamento)
const AJUSTE = Object.fromEntries((process.env.AJUSTE || "").split(",").filter(Boolean).map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));
const lerPesos = (f) => ({ ...(f === "jogador" ? JOGADOR : JSON.parse(fs.readFileSync(f, "utf8")).pesos), ...(MODE === "treinar" ? {} : AJUSTE) });
const NAMES = Object.keys(GENES);
const decode = (u) => Object.fromEntries(NAMES.map((n, i) => [n, GENES[n][0] + Math.min(1, Math.max(0, u[i])) * (GENES[n][1] - GENES[n][0])]));
// pesos salvos → [0,1]; genes que o cérebro ainda não tinha começam no meio da faixa
const encode = (pesos) => NAMES.map((n) => (pesos?.[n] == null ? 0.5 : Math.min(1, Math.max(0, (pesos[n] - GENES[n][0]) / (GENES[n][1] - GENES[n][0])))));

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

// O Edge acumula memória ao longo de centenas de partidas (e o Windows chegou a ficar sem memória):
// no treino ele é fechado e reaberto a cada geração
const launch = () =>
  chromium.launch({
    executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: MODE !== "assistir",
    args: MODE === "assistir" ? ["--window-size=1300,800", "--autoplay-policy=no-user-gesture-required"] : [],
  });
let browser = await launch();

async function runOne(theta, build, diff, seed, live = null, start = null) {
  const ctx = live?.ctx || (await browser.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: "block" }));
  const p = live?.page || (await ctx.newPage());
  const errs = [];
  if (!live) p.on("pageerror", (e) => errs.push(e.message));
  if (!live) await p.addInitScript((seed) => {
    window.__seed = (seed) => {
      let s = seed >>> 0;
      Math.random = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    window.__seed(seed);
  }, seed);
  await p.goto(URL, { waitUntil: "load" });
  await p.waitForFunction(() => window.game && window.game.isBooted, null, { timeout: 180000 });
  await p.waitForTimeout(2500);
  // save de laboratório: todas as armas, 4 vagas, dash e Despertar, Perigo escolhido, sem tutorial.
  // Partida REPRODUZÍVEL: o laço do jogo dorme ANTES de a partida começar, com relógio virtual e
  // sorteio reiniciado pela semente (antes, quadros em tempo real no começo — em número diferente a
  // cada vez — gastavam sorteios e a mesma semente dava partidas totalmente diferentes)
  await p.evaluate(async ({ diff, live, seed }) => {
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
    if (!live) {
      g.loop.sleep();
      window.__vt0 = window.__vt = Math.floor(Date.now() / 3.6e6) * 3.6e6;
      window.__perf0 = performance.now();
      Date.now = () => window.__vt;
      performance.now = () => window.__perf0 + (window.__vt - window.__vt0);
      window.__seed(seed * 7919 + 1);
    }
    for (const sc of g.scene.getScenes(true)) g.scene.stop(sc.scene.key);
    g.scene.start("GameScene");
    if (!live)
      for (let i = 0; i < 200; i++) {
        const gs = g.scene.getScene("GameScene");
        if (gs?.sys.isActive() && gs.player) break;
        window.__vt += 33;
        g.scene.update(window.__vt, 33);
        await new Promise((r) => setTimeout(r, 0)); // deixa terminar o que a cena carrega sem pressa
      }
  }, { diff, live: !!live, seed });
  await p.waitForFunction(() => {
    const gs = window.game.scene.getScene("GameScene");
    return gs && gs.sys.isActive() && gs.player;
  }, null, { timeout: 60000 });

  await p.evaluate(({ th, elems, random, boost, trace, live, label, start, bossLevel }) => {
    const g = window.game;
    const gs = g.scene.getScene("GameScene");
    gs._god = false;
    let vt = live ? Date.now() : window.__vt;
    if (!live) {
      // relógio virtual (tweens e timers do Phaser usam o relógio real), continuando o do começo
      Date.now = () => vt;
      performance.now = () => window.__perf0 + (vt - window.__vt0);
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
        if (near && nd < 30) {
          src = "projétil";
          // de que distância veio o tiro (vida de 3 s; voa a ~180 px/s): queima-roupa ou de longe?
          const age = 3000 - (near.lifeUntil - gs.time.now);
          const dist = Math.round((age / 1000) * Math.hypot(near.body.velocity.x, near.body.velocity.y));
          const faixa = dist < 60 ? "<60px" : dist < 120 ? "60-120px" : dist < 200 ? "120-200px" : "200px+";
          (window.__lab.tiro ||= {})[faixa] = ((window.__lab.tiro || {})[faixa] || 0) + 1;
          const e = window.__seen?.get(near.lifeUntil);
          if (e && (window.__lab.tiroDbg ||= []).length < 40)
            window.__lab.tiroDbg.push({ vistoHa: (Date.now() - e.at), dist0: e.d, v: e.v, avisos: e.flags, ultimo: e.last, joy: [+gs.inputMgr.joystickVec.x.toFixed(2), +gs.inputMgr.joystickVec.y.toFixed(2)], vel: [Math.round(pl.body.velocity.x), Math.round(pl.body.velocity.y)], pv: [Math.round(near.body.velocity.x), Math.round(near.body.velocity.y)] });
        }
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
      const h = (hits[src] ||= { n: 0, dmg: 0, pensava: {} });
      h.n++;
      h.dmg += Math.max(0, hp0 - pl.hp);
      // o que o robô estava fazendo quando levou o golpe (sem a distância, para agrupar)
      const it = (window.__intent || "?").replace(/ a \d+ px/, "");
      h.pensava[it] = (h.pensava[it] || 0) + 1;
      lastSrc = src;
      return landed;
    };

    // ---- cérebro: prioridades de jogador, em camadas -----------------------------------------
    // Uma camada de cima sempre manda na de baixo; o treino só ajusta os números de cada uma.
    //   1. SOBREVIVER AGORA: aviso de golpe, projétil que vai acertar, inimigo encostando, cercado,
    //      muralha. O dash é só daqui.
    //   2. VIDA BAIXA (abaixo de lowHp): coração vira o objetivo; sem coração, joga na defensiva.
    //   3. OBJETIVO (um por vez, vai até o fim salvo perigo): baú > item no chão > lanterna > gemas.
    //      Valor = prioridade ÷ (distância + D), menor se o bando está no caminho.
    //   4. COMBATE (sem objetivo): ronda o bando no alcance das armas (anel kR), sempre girando para o
    //      mesmo lado; elite e minichefe com mais folga; o chefe na distância de combate bR.
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
      sy = pl.y,
      side = 1, // sentido de giro em volta do bando
      lastFlip = 0,
      stuckBau = 0,
      goal = null, // { kind, ref, since }
      banned = new Map(); // objetivo que não deu para alcançar → ignorado por um tempo
    window.__intent = "";
    const PRIO = { bau: 8, item: 4, lanterna: 2, gemas: 1 };
    const NOME = { bau: "baú", item: "item no chão", lanterna: "lanterna", gemas: "gemas", coracao: "coração" };
    const threats = () => {
      const out = [];
      if (gs.boss?.active && gs.boss.brain?.threat) out.push(gs.boss.brain.threat);
      gs.enemyPool.forEachActive((e) => e._brain?.threat && out.push(e._brain.threat));
      return out;
    };
    const enemies = [];
    // quantos inimigos estão no caminho reto até (x,y): o jogador não atravessa a horda
    const blocked = (px, py, x, y) => {
      const vx = x - px,
        vy = y - py;
      const L2 = vx * vx + vy * vy || 1;
      let n = 0;
      for (const e of enemies) {
        const t = Math.max(0, Math.min(1, ((e.x - px) * vx + (e.y - py) * vy) / L2));
        if (Math.hypot(px + vx * t - e.x, py + vy * t - e.y) < 50) n += e._elite ? 3 : 1;
      }
      return n;
    };
    // onde fica cada objetivo e se ele ainda existe
    const where = (gl) =>
      gl.kind === "item" ? [gl.ref.spr.x, gl.ref.spr.y - 16] : gl.kind === "lanterna" ? [gl.ref.x, gl.ref.y - 28] : gl.kind === "gemas" ? [gl.x, gl.y] : [gl.ref.x, gl.ref.y];
    const exists = (gl) => {
      if (gl.kind === "bau") return !gl.ref.opened && gs.chests.includes(gl.ref);
      if (gl.kind === "lanterna") return !!gs.lanterns?.list.includes(gl.ref);
      if (gl.kind === "item") return !!gs.lanterns?.items.includes(gl.ref);
      if (gl.kind === "coracao") return gl.ref.active;
      return false; // gemas: escolhe de novo a cada decisão (elas voam para o herói com o ímã)
    };
    const decide = () => {
      const px = pl.x,
        py = pl.y;
      const now = live ? Date.now() : vt;
      const hpFrac = pl.hp / pl.maxHp;

      // ---- percepção -------------------------------------------------------------------------
      enemies.length = 0;
      let nd = 1e9,
        nE = null,
        gxs = 0,
        gys = 0,
        gn = 0,
        contact = 0,
        near300 = 0;
      const sectors = new Array(12).fill(0);
      let sX = 0,
        sY = 0; // camada 1
      const why = {}; // o que mais pesou na camada 1 (para a legenda)
      const add1 = (x, y, w, k) => {
        sX += x * w;
        sY += y * w;
        why[k] = (why[k] || 0) + w;
      };
      gs.enemyPool.forEachActive((e) => {
        const dx = px - e.x,
          dy = py - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 900) return;
        enemies.push(e);
        if (d < 300) near300++;
        if (!e.miniBoss && d < nd) (nd = d), (nE = e);
        if (d < 400) (gxs += e.x), (gys += e.y), gn++;
        if (d < 150) sectors[Math.floor(((Math.atan2(-dy, -dx) + Math.PI) / (2 * Math.PI)) * 12) % 12]++;
        // encostando: sai de perto (dano de contato)
        if (d < th.cR) {
          contact++;
          add1(dx / d, dy / d, (1 - d / th.cR) * th.cW * (e._elite ? 2 : 1), "inimigo encostando");
        }
      });

      // ---- camada 1: sobreviver agora --------------------------------------------------------
      let inThreat = false,
        projHot = 0;
      const push = (x, y, w) => {
        add1(x, y, w * th.tW, "aviso de golpe");
        inThreat = true;
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
          return [-Math.sin(a) * sg, Math.cos(a) * sg];
        };
        if (t.cone) {
          const c = t.cone;
          const d = Math.hypot(px - c.x, py - c.y);
          const off = angDiff(Math.atan2(py - c.y, px - c.x), c.ang);
          if (d < c.range + th.tM && Math.abs(off) < c.half + 0.25) {
            const [tx, ty] = tang(c, off >= 0 ? 1 : -1);
            push(tx, ty, 1.5);
          }
        }
        if (t.gap) {
          const c = t.gap;
          const off = angDiff(c.ang, Math.atan2(py - c.y, px - c.x));
          if (Math.abs(off) > c.half * 0.5) {
            const [tx, ty] = tang(c, off >= 0 ? 1 : -1);
            push(tx, ty, 1.5);
          }
        }
        if (t.sweep) {
          const c = t.sweep;
          const d = Math.hypot(px - c.x, py - c.y);
          if (d > c.blind && d < c.len + th.tM && angDiff(Math.atan2(py - c.y, px - c.x), c.a0) * c.dir > -0.45) {
            const [tx, ty] = tang(c, -c.dir); // volta para trás da borda de partida
            push(tx, ty, 1.5);
          }
        }
        if (t.chase) zone(t.chase.x, t.chase.y, 140);
      }
      for (const h of gs.hazards?.list || []) zone(h.x, h.y, h.r);
      for (const c of gs._spores || []) zone(c.x, c.y, c.r);
      // projétil que vai passar perto nos próximos pT ms
      const T = th.pT / 1000;
      gs.enemyProjPool.forEachActive((q) => {
        const vx = q.body?.velocity?.x || 0,
          vy = q.body?.velocity?.y || 0;
        const v2 = vx * vx + vy * vy;
        if (trace) {
          const sn = (window.__seen ||= new Map());
          if (!sn.has(q.lifeUntil)) sn.set(q.lifeUntil, { at: now, d: Math.round(Math.hypot(px - q.x, py - q.y)), v: Math.round(Math.sqrt(v2)), flags: 0 });
        }
        if (v2 < 1) return;
        // SAIR DA LINHA DO TIRO, como um jogador: a trajetória é uma reta fixa no mapa e acerta a 22 px
        // do centro do herói. O tempo até chegar usa a velocidade de aproximação AO LONGO da reta
        // (tiro − herói): fugindo na mesma direção o tiro alcança devagar; indo contra, chega rápido
        const sp = Math.sqrt(v2),
          ux = vx / sp,
          uy = vy / sp;
        const rx = px - q.x,
          ry = py - q.y;
        const along = rx * ux + ry * uy; // quanto o herói está à frente do tiro na reta
        if (along < -10) return; // já passou
        let ox = rx - along * ux,
          oy = ry - along * uy;
        let od = Math.hypot(ox, oy); // distância do herói até a reta
        if (od > 40) return; // fora da linha (acerta a 22 px; 40 dá folga)
        const closing = sp - ((pl.body?.velocity?.x || 0) * ux + (pl.body?.velocity?.y || 0) * uy);
        const t = closing > 5 ? along / closing : 99;
        if (t > T) return;
        // em cima da reta: sai para o lado em que já está indo (ou o do giro)
        if (od < 1) {
          const perp = (pl.body?.velocity?.x || 0) * -uy + (pl.body?.velocity?.y || 0) * ux;
          const sg = perp !== 0 ? Math.sign(perp) : side;
          (ox = -uy * sg), (oy = ux * sg), (od = 1);
        }
        const s = (1 - od / 40) * (0.6 + 0.4 * (1 - t / T)) + 0.3;
        projHot = Math.max(projHot, s);
        if (trace) {
          const e = window.__seen.get(q.lifeUntil);
          e.flags++;
          e.last = { t: +t.toFixed(2), od: Math.round(od), dir: [+(ox / od).toFixed(2), +(oy / od).toFixed(2)] };
        }
        add1(ox / od, oy / od, s * th.pW, "projétil");
      });
      // cercado (inimigos colados em 3/4 das direções): sai pelo maior buraco
      let encircled = false;
      if (sectors.filter((n) => n > 0).length >= 9) {
        let best = -1,
          bestLen = 0;
        for (let i = 0; i < 12; i++) {
          let len = 0;
          while (len < 12 && sectors[(i + len) % 12] === 0) len++;
          if (len > bestLen) (bestLen = len), (best = i);
        }
        if (best >= 0) {
          const a = ((best + bestLen / 2) / 12) * 2 * Math.PI - Math.PI;
          add1(Math.cos(a), Math.sin(a), 4, "cercado");
          encircled = true;
        }
      }
      // muralha: só a menos de 140 px da borda de verdade (antes era "82% do caminho até a borda" —
      // num mapa de 6800 px isso dava ~600 px, e o herói NASCE a 150 px da borda sul: a camada 1
      // ficava ligada e ele travava, sem conseguir chegar nem no baú ao lado)
      const WALL = 140;
      let wx = 0,
        wy = 0;
      const dl = px - A.x,
        dr = A.right - px,
        dt = py - A.y,
        db = A.bottom - py;
      if (dl < WALL) wx += 1 - dl / WALL;
      if (dr < WALL) wx -= 1 - dr / WALL;
      if (dt < WALL) wy += 1 - dt / WALL;
      if (db < WALL) wy -= 1 - db / WALL;
      if (wx || wy) add1(wx, wy, th.mW * 3, "muralha");
      const ex = (px - cx) / (A.width / 2),
        ey = (py - cy) / (A.height / 2);
      const nearWall = Math.min(dl, dr, dt, db) < 300;
      const s1 = Math.hypot(sX, sY);

      // ---- camada 2: vida baixa --------------------------------------------------------------
      const low = hpFrac < th.lowHp;
      if (low && goal?.kind !== "coracao") {
        let hd = 1500,
          h = null;
        gs.heartPool.forEachActive((q) => {
          const d = Math.hypot(q.x - px, q.y - py);
          if (d < hd) (hd = d), (h = q);
        });
        if (h) goal = { kind: "coracao", ref: h, since: now };
      }

      // ---- camada 3: objetivo (um por vez, vai até o fim salvo perigo) ------------------------
      if (goal && (!exists(goal) || now - goal.since > 25000)) {
        if (exists(goal)) banned.set(goal.ref, now + 20000); // não deu para chegar: desiste um tempo
        goal = null;
      }
      if (!goal || goal.kind === "gemas") {
        let best = null,
          bv = 0;
        const consider = (kind, ref, x, y, far) => {
          if (ref && (banned.get(ref) || 0) > now) return;
          const d = Math.hypot(x - px, y - py);
          if (d > far) return;
          const v = PRIO[kind] / (d + th.D) / (1 + th.bk * blocked(px, py, x, y));
          if (v > bv) (bv = v), (best = { kind, ref, x, y, since: now });
        };
        // baús ficam parados: o jogador lembra de todos do mapa
        for (const c of gs.chests || []) if (!c.opened) consider("bau", c, c.x, c.y, 4000);
        for (const it of gs.lanterns?.items || []) consider("item", it, it.spr.x, it.spr.y - 16, th.lD); // pego pelo corpo do herói (16 px abaixo do centro)
        // toque da lanterna: do corpo do herói (16 px abaixo do centro) ao chapéu (12 px acima do pé)
        for (const l of gs.lanterns?.list || []) consider("lanterna", l, l.x, l.y - 28, th.lD);
        // gemas: o melhor aglomerado (grade de 120 px), não a gema mais próxima
        const cells = new Map();
        gs.xpPool.forEachActive((q) => {
          if (Math.abs(q.x - px) > th.gR || Math.abs(q.y - py) > th.gR) return;
          const k = Math.floor(q.x / 120) * 10000 + Math.floor(q.y / 120);
          const c = cells.get(k) || { x: 0, y: 0, n: 0, xp: 0 };
          (c.x += q.x), (c.y += q.y), c.n++, (c.xp += q.xpValue || 1);
          cells.set(k, c);
        });
        const gp = PRIO.gemas;
        for (const c of cells.values()) {
          PRIO.gemas = gp * Math.min(1.5, 0.3 + c.xp / 8); // aglomerado maior vale mais (sem passar a lanterna)
          consider("gemas", null, c.x / c.n, c.y / c.n, th.gR);
        }
        PRIO.gemas = gp;
        if (best) goal = best;
      }
      let oX = 0,
        oY = 0,
        gd = 0,
        holdStill = false;
      if (goal) {
        const [x, y] = where(goal);
        gd = Math.hypot(x - px, y - py) || 1;
        const k = th.G * (low && goal.kind !== "coracao" ? 0.3 : 1); // vida baixa: sem desvios
        oX = ((x - px) / gd) * k;
        oY = ((y - py) / gd) * k;
        // baú só abre depois de ~0,3 s encostado: chegando nele, para em cima
        if (goal.kind === "bau" && gd < 30) holdStill = true;
      }

      // ---- camada 4: combate -----------------------------------------------------------------
      let cX = 0,
        cY = 0,
        combat = "";
      const ring = th.kR + (low ? 80 : 0);
      if (gs.boss?.active) {
        // chefe: luta obrigatória — distância de combate bR, circulando
        const dx = px - gs.boss.x,
          dy = py - gs.boss.y;
        const d = Math.hypot(dx, dy) || 1;
        const err = Math.max(-1.5, Math.min(1.5, (d - th.bR) / 100));
        cX += (-dx / d) * err * th.bW + (-dy / d) * side * th.bT;
        cY += (-dy / d) * err * th.bW + (dx / d) * side * th.bT;
        if (d < 110) (cX += (dx / d) * 4), (cY += (dy / d) * 4);
        combat = "chefe: distância de combate";
      } else if (nE) {
        // anel em volta do bando: longe demais vai buscar, perto demais recua, e gira
        const dx = px - nE.x,
          dy = py - nE.y;
        const err = Math.max(-1.5, Math.min(1.5, (nd - ring) / 100));
        const approach = goal ? Math.min(0, err) : err; // com objetivo, só recua (não vai buscar)
        cX += (-dx / nd) * approach;
        cY += (-dy / nd) * approach;
        if (!goal && gn) {
          const mx = px - gxs / gn,
            my = py - gys / gn;
          const m = Math.hypot(mx, my) || 1;
          cX += (-my / m) * side * th.kT;
          cY += (mx / m) * side * th.kT;
        }
        combat = err > 0.3 && !goal ? "combate: indo buscar o bando" : "combate: rondando o bando";
      }
      // elite e minichefe: mais folga
      for (const e of enemies) {
        if (!e._elite && !e.miniBoss) continue;
        const dx = px - e.x,
          dy = py - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const r = ring + th.eliteR;
        if (d < r) (cX += (dx / d) * (1 - d / r) * 2), (cY += (dy / d) * (1 - d / r) * 2);
      }
      if (goal) (cX *= th.gRet), (cY *= th.gRet);

      // ---- junta as camadas ------------------------------------------------------------------
      let nx = oX + cX,
        ny = oY + cY;
      let intent;
      if (s1 > 0.05) {
        // camada 1 manda: a direção de sobreviver, com um pouco do resto (sMix) para não perder o rumo
        const lm = Math.hypot(nx, ny) || 1;
        nx = sX / s1 + (nx / lm) * th.sMix;
        ny = sY / s1 + (ny / lm) * th.sMix;
        intent = "sobreviver: " + Object.entries(why).sort((a, b) => b[1] - a[1])[0][0];
        holdStill = false;
      } else if (goal) {
        intent = `${low && goal.kind === "coracao" ? "vida baixa" : "objetivo"}: ${NOME[goal.kind]} a ${Math.round(gd)} px`;
      } else intent = combat || "explorando";
      window.__intent = intent;
      // girar sempre para o mesmo lado; troca de lado só se a muralha estiver na frente
      if (nearWall && dirX * -ex + dirY * -ey < -0.3 && now - lastFlip > 2500) (side = -side), (lastFlip = now);
      // diagnóstico (TRACE=1): baú perto que não abre
      if (trace && goal?.kind === "bau" && gd < 100) {
        stuckBau ||= now;
        if (now - stuckBau > 3000 && now - stuckBau < 3200)
          (window.__lab.bau ||= []).push({ t: Math.round(gs.elapsedMs / 100) / 10, px: Math.round(px), py: Math.round(py), bx: Math.round(goal.ref.x), by: Math.round(goal.ref.y), gd: Math.round(gd), s1: +s1.toFixed(2), intent, near: goal.ref.playerNear, ms: goal.ref._nearMs, joy: [+nx.toFixed(2), +ny.toFixed(2)] });
      } else stuckBau = 0;
      // preso (canto, bando parado em volta): empurrão aleatório por meio segundo
      if (now - stuckT > 1500) {
        if (Math.hypot(px - sx, py - sy) < 30 && !holdStill) {
          const a = Math.random() * Math.PI * 2;
          (kickX = Math.cos(a)), (kickY = Math.sin(a)), (kickUntil = now + 500);
        }
        (stuckT = now), (sx = px), (sy = py);
      }
      if (now < kickUntil) (nx = kickX), (ny = kickY);
      const n = Math.hypot(nx, ny);
      if (n > 0.02) (nx /= n), (ny /= n);
      else (nx = (cx - px) / (Math.hypot(cx - px, cy - py) || 1)), (ny = (cy - py) / (Math.hypot(cx - px, cy - py) || 1)); // nada a fazer: vai para o meio
      dirX = th.inertia * dirX + (1 - th.inertia) * nx;
      dirY = th.inertia * dirY + (1 - th.inertia) * ny;
      const m = Math.hypot(dirX, dirY) || 1;
      (dirX /= m), (dirY /= m);
      gs.inputMgr.joystickVec = holdStill ? { x: 0, y: 0 } : { x: dirX, y: dirY };
      // dash só para sobreviver: cercado, aviso de golpe, projétil quase acertando, muitos encostando
      if (pl.dashReady?.() && (encircled || (inThreat && th.dashThreat > 0.5) || projHot > th.dashP || contact >= th.dashN)) gs.inputMgr.dashPressed = true;
      // Despertar: barra cheia e chefe ou bando grande na tela
      if (pl.awakenMeter >= pl.awakenMax && (gs.boss?.active || near300 >= 20)) gs.inputMgr.awakenPressed = true;
    };

    // ---- laço --------------------------------------------------------------------------------
    window.__lab = { hits, minutes: [], bossStart: null, bossEnd: null, end: null, itens: 0 };
    // conta os itens das lanternas que o robô pega (quebrar e não pegar não adianta)
    if (gs.lanterns && !gs.lanterns.__wrapped) {
      const orig = gs.lanterns._collect.bind(gs.lanterns);
      gs.lanterns._collect = (it) => (window.__lab.itens++, orig(it));
      gs.lanterns.__wrapped = true;
    }
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
    // Treino de chefe: começa com o herói no nível em que um jogador chega ao chefe (cartas
    // escolhidas pelo mesmo critério) e o relógio 2 s antes do Mapinguari nascer
    if (start === "chefe") {
      pl.gainXp(1e7);
      while (pl.level < bossLevel) pl.gainXp(0);
      pl.xp = 0;
      gs._openNextLevelUp();
      gs.elapsedMs = gs.runDurationS * 1000 - 2000;
      if (gs.spawnDirector) gs.spawnDirector.elapsedMs = gs.elapsedMs;
      gs.bossWarned = true;
    }
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
${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}  nível ${pl.level}  vida ${Math.round(pl.hp)}/${pl.maxHp}  abates ${gs.hud?.kills || 0}  baús ${gs._runChests || 0}
→ ${window.__intent}`;
      };
      gs.events.on("update", tick);
      // cenas por cima (baú, santuário, história) pausam a partida: fecha e volta
      setInterval(() => {
        if (window.__lab.end || gs.gameOver || gs.sys.isActive()) return;
        for (const sc of g.scene.getScenes(true)) if (sc !== gs && sc.scene.key !== "HUDScene" && !/Revive|Endless|FirstDefeat|GameOver/.test(sc.scene.key)) g.scene.stop(sc.scene.key);
        if (!g.scene.isActive("ReviveScene")) g.scene.resume("GameScene");
      }, 500);
    }
  }, { th: theta, elems: ELEMS[build], random: build === "aleatoria", boost: BOOST, trace: !!process.env.TRACE, live: !!live, label: live?.label || "", start, bossLevel: Number(process.env.CHEFE_NIVEL || 16) });

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
      kills: gs.hud?.kills || 0,
      lanterns: gs._runLanterns || 0,
      chests: gs._runChests || 0,
      weapons: gs.player.weapons.map((w) => `${w.key}${w.level}`),
    };
  });
  if (!live) await ctx.close();
  return { build, diff, seed, dur, start, errs: errs.slice(0, 3), ...res, end: res.end || "tempo" };
}

// Pontuação de treino = PONTUAR como jogador, não só durar. Antes o tempo sobrevivido valia quase
// tudo e o treino aprendeu a fugir com a horda atrás: sobrevivia sem subir de nível nem abrir baú.
// Metas (valem o peso inteiro): nível 16 (o de chegar ao chefe), 1000 abates, 8 baús (~5 no mapa
// + 1 a cada 50 abates), 15 lanternas. No treino de chefe só conta a luta
function score(r) {
  if (r.start === "chefe") return (r.bossHpLeft == null ? 0 : 1 - r.bossHpLeft) + (r.end === "venceu" ? 1 : 0);
  let s = 0.6 * Math.min(1, r.t / r.dur);
  s += 0.6 * Math.min(1, (r.lvl || 1) / 16);
  s += 0.4 * Math.min(1, (r.kills || 0) / 1000);
  s += 0.4 * Math.min(1, (r.chests || 0) / 8);
  s += 0.2 * Math.min(1, (r.itens || 0) / 15); // itens das lanternas PEGOS (quebrar e largar não vale)
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
    mu = encode(lerPesos(process.env.INICIO));
  }
  // CONTINUAR=1: retoma do cérebro salvo (média, desvio, histórico e contagem de gerações)
  if (fs.existsSync(CEREBRO) && process.env.CONTINUAR) {
    const c = JSON.parse(fs.readFileSync(CEREBRO, "utf8"));
    // genes novos desde o último treino: recodifica pelos pesos (os novos começam no meio da faixa)
    const same = c.u?.length === NAMES.length;
    mu = same ? c.u : encode(c.pesos);
    sd = same ? c.sd.map((v) => Math.max(v, 0.08)) : NAMES.map(() => 0.15);
    gen0 = c.treino?.geracoes || 0;
    if (fs.existsSync(histPath)) hist = JSON.parse(fs.readFileSync(histPath, "utf8"));
  }
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  let best = null;
  for (let gen = gen0; gen < gen0 + GENS; gen++) {
    const t0 = Date.now();
    const pop = Array.from({ length: POP }, (_, k) => (k === 0 ? mu.slice() : mu.map((m, i) => Math.min(1, Math.max(0, m + sd[i] * gauss())))));
    // partidas inteiras + (CHEFE=1) uma luta de chefe por Perigo, para ele praticar a luta
    const games = DIFFS.flatMap((d) => SEEDS.map((s) => [d, s * 1000 + gen, null]));
    if (process.env.CHEFE) for (const d of DIFFS) games.push([d, 7000 + gen, "chefe"]);
    const jobs = pop.flatMap((u, k) => games.map(([d, s, st]) => [k, d, s, st]));
    const res = await pool(jobs, (k, d, s, st) => runOne(decode(pop[k]), BUILDS[0], d, s, null, st));
    await browser.close().catch(() => {});
    browser = await launch();
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
      c = CEREBRO === "jogador" ? { pesos: JOGADOR } : JSON.parse(fs.readFileSync(CEREBRO, "utf8"));
    } catch {}
    const theta = decode(encode(c?.pesos));
    const d = DIFFS[k % DIFFS.length];
    const label = `robô · ${c?.treino ? (typeof c.treino.geracoes === "string" ? `cérebro ${c.treino.geracoes.split(" ")[0]}` : `cérebro da geração ${c.treino.geracoes}`) : c ? "pesos de jogador" : "sem treino"} · Perigo ${d} · build ${BUILDS[0]}`;
    console.log(label);
    try {
      const r = await runOne(theta, BUILDS[0], d, 0, { ctx, page, label });
      console.log(`  ${r.end} em ${fmtS(r.t)} · nível ${r.lvl} · ${r.kills} abates · ${r.lanterns} lanternas · ${r.itens} itens · ${r.chests} baús${r.killer ? " · último golpe: " + r.killer : ""}`);
    } catch (e) {
      if (/closed|Target/.test(e.message)) break; // fechou a janela: acabou
      console.log(`  falhou: ${e.message.split("\n")[0]}`);
    }
    await page.waitForTimeout(2500);
  }
} else {
  const OUT = process.argv[3] || "bot-lab.json";
  const theta = CEREBRO === "jogador" || fs.existsSync(CEREBRO) ? decode(encode(lerPesos(CEREBRO))) : decode(encode(null));
  if (CEREBRO !== "jogador" && !fs.existsSync(CEREBRO)) console.log("(sem cérebro treinado: usando os pesos do meio da faixa)");
  const jobs = [];
  for (const b of BUILDS) for (const d of DIFFS) for (const s of SEEDS) jobs.push([b, d, s]);
  const res = (await pool(jobs, (b, d, s) => runOne(theta, b, d, s, null, process.env.CHEFE ? "chefe" : null))).filter(Boolean);
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log("\nbuild        Perigo  fim     tempo   nível  abates  lant.  itens  baús  chefe   matou");
  for (const r of res)
    console.log(
      `${r.build.padEnd(12)} ${String(r.diff).padStart(4)}    ${r.end.padEnd(7)} ${fmtS(r.t).padStart(6)}  ${String(r.lvl).padStart(5)}  ${String(r.kills).padStart(6)}  ${String(r.lanterns).padStart(5)}  ${String(r.itens).padStart(5)}  ${String(r.chests).padStart(4)}  ${r.bossHpLeft == null ? "  -   " : (100 - r.bossHpLeft * 100).toFixed(0).padStart(4) + "% "}  ${r.killer || ""}${r.errs.length ? "  ERRO " + r.errs[0] : ""}`,
    );
  // resumo por Perigo, com a mesma nota do treino
  const avg = (a, f) => a.reduce((q, x) => q + f(x), 0) / (a.length || 1);
  console.log("");
  for (const d of DIFFS) {
    const a = res.filter((x) => x.diff === d);
    console.log(
      `Perigo ${d}: nota ${avg(a, score).toFixed(2)} · ${a.filter((x) => x.end === "venceu").length}/${a.length} vitórias · nível ${avg(a, (x) => x.lvl).toFixed(1)} · ${Math.round(avg(a, (x) => x.kills))} abates · ${avg(a, (x) => x.chests).toFixed(1)} baús · ${avg(a, (x) => x.lanterns).toFixed(1)} lanternas · ${avg(a, (x) => x.itens).toFixed(1)} itens · ${(avg(a, (x) => x.t) / 60).toFixed(1)} min`,
    );
  }
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
server?.close();
