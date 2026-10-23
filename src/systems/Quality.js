// Qualidade gráfica — UM sistema para o jogo todo (QUALITY em config.js). Substitui o QualityWatchdog (que
// desligava a iluminação uma vez por aparelho) e a opção "Iluminação dinâmica".
//
//  · Quality: o degrau em vigor (0 = Alta … 2 = Baixa). Quem desenha lê Quality.get("…") na hora: Lighting
//    (luz, sombras das árvores, cogumelos), Podridão da borda (modo), WeaponFX e cosméticos (densidade),
//    ForestWorld (vaga-lumes, folhas, poeira) e o pó das mortes. Nada de jogabilidade passa por aqui: dano,
//    hitbox, inimigos, números de dano e avisos de golpe dos chefes não leem a qualidade.
//  · Opções → Qualidade gráfica: Automática (padrão) · Alta · Média · Baixa. Escolha fixa = o automático não
//    troca o degrau (só mede, para o perf_run).
//  · QualityAuto (um por partida): mede o intervalo entre quadros (o que o jogador vê) e o trabalho de cada
//    quadro (CPU, do começo do passo ao fim do desenho) em janelas de 2 s; desce quando a queda se sustenta,
//    sobe com histerese (folga sustentada E prevista; a espera dobra quando uma subida erra), desfaz a
//    descida que não rendeu. O alvo é o teto de quadros
//    (GAME.FPS_LIMIT, src/systems/FrameLimit.js); o plano B do chão (ForestWorld.groundGPU) segue sozinho e
//    vai no resumo.
//  · Resumo da partida (evento perf_run, uma vez por partida, em _onGameOver): fps p50 e p5, trabalho do quadro,
//    degraus (início, fim, o mais baixo e por quanto tempo), trocas, aparelho (memória, núcleos, Hz da tela).
import { GAME, QUALITY } from "../config.js";
import { Settings } from "./Settings.js";
import { DEBUG } from "./Platform.js";
import { tr } from "../i18n/i18n.js";

const T = QUALITY.TIERS;
const A = QUALITY.AUTO;
const TOP = T.length - 1;
const MODES = ["auto", ...T.map((t) => t.id)];

export const Quality = {
  MODES,
  tier: null, // degrau em vigor (null = ainda não decidido: startTier na 1ª leitura)

  mode() {
    const m = Settings.get("quality");
    return MODES.includes(m) ? m : "auto";
  },
  auto() {
    return this.mode() === "auto";
  },
  // Degrau da escolha fixa (null = Automática)
  fixedTier() {
    const m = this.mode();
    return m === "auto" ? null : T.findIndex((t) => t.id === m);
  },
  // Degrau com que uma partida começa: o fixo, ou o que o automático aprendeu neste aparelho
  startTier() {
    const f = this.fixedTier();
    if (f != null) return f;
    const a = Settings.get("qualityAuto");
    return Number.isInteger(a) && a >= 0 && a <= TOP ? a : 0;
  },
  // Começo de partida: o degrau volta ao da escolha (ou ao aprendido)
  begin() {
    this.tier = this.startTier();
    return this.tier;
  },
  current() {
    if (this.tier == null) this.tier = this.startTier();
    return this.tier;
  },
  get spec() {
    return T[this.current()];
  },
  get(k) {
    return T[this.current()][k];
  },
  setTier(i) {
    this.tier = Math.max(0, Math.min(TOP, i | 0));
  },
  // Opções: trocar a escolha vale na hora (na partida, pela Pausa). Automática continua do degrau de agora
  setMode(m) {
    if (!MODES.includes(m)) return;
    Settings.set("quality", m);
    const f = this.fixedTier();
    if (f != null) this.setTier(f);
  },
  label(m) {
    return { auto: tr("Automática"), high: tr("Alta"), medium: tr("Média"), low: tr("Baixa") }[m] ?? m;
  },
  tierLabel(i = this.current()) {
    return this.label(T[i].id);
  },
};

// Histograma de tempos (ms) com degraus de BIN ms: percentis da partida inteira sem guardar cada quadro
class Hist {
  constructor(maxMs = 250, bin = 0.25) {
    this.bin = bin;
    this.h = new Uint32Array(Math.ceil(maxMs / bin) + 1);
    this.n = 0;
  }
  add(v) {
    const i = Math.min(this.h.length - 1, Math.max(0, Math.floor(v / this.bin)));
    this.h[i]++;
    this.n++;
  }
  // percentil p (0..1): o meio do degrau em que ele cai
  pct(p) {
    if (!this.n) return 0;
    const want = p * (this.n - 1);
    let acc = 0;
    for (let i = 0; i < this.h.length; i++) {
      acc += this.h[i];
      if (acc > want) return (i + 0.5) * this.bin;
    }
    return (this.h.length - 0.5) * this.bin;
  }
  above(v) {
    let c = 0;
    for (let i = Math.ceil(v / this.bin); i < this.h.length; i++) c += this.h[i];
    return c;
  }
}

// Média sem a fração `trim` dos maiores valores (os trancos isolados)
function trimmedMean(arr, trim) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const n = Math.max(1, Math.round(s.length * (1 - trim)));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += s[i];
  return sum / n;
}
const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
const r1 = (v) => Math.round(v * 10) / 10;

export class QualityAuto {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.sys.game;
    this.target = GAME.FPS_LIMIT || 60;
    this.budget = 1000 / this.target;
    this.startTier = Quality.current();
    // decisão
    this.maxTier = TOP; // o degrau mais leve permitido nesta partida (uma descida sem ganho vira o piso)
    this.upWait = A.UP_WAIT_MS[0];
    this._lastUpAt = -Infinity;
    this.badRun = 0;
    this.awfulRun = 0;
    this.goodMs = 0;
    this.recent = []; // últimas janelas (o "antes" de uma descida)
    this.probe = null; // teste depois de uma troca
    this.cost = []; // custo medido: trabalho no degrau i ÷ no degrau i+1
    // medição
    this._dts = [];
    this._busy = [];
    this._winMs = 0;
    this._last = 0;
    this._t0 = 0;
    this._dt = 0;
    this._warmUntil = 0;
    this._settleUntil = 0;
    // resumo da partida
    this.dt = new Hist();
    this.work = new Hist();
    this.raw = new Hist(100, 0.25);
    this.tierMs = new Float64Array(T.length);
    this.worst = this.startTier;
    this.changes = 0;
    this.log = []; // trocas: { t, from, to, why, fps, busy, wait (espera para subir depois desta troca) }
    this.windows = []; // janelas fechadas: { t, fps, busy, tier } (as últimas 600)
    this.sent = false;

    this._onPre = () => this._pre();
    this._onPost = () => this._post();
    this.game.events.on("prestep", this._onPre);
    this.game.events.on("postrender", this._onPost);
    scene.events.once("shutdown", () => this.destroy());
  }

  destroy() {
    this.game.events.off("prestep", this._onPre);
    this.game.events.off("postrender", this._onPost);
  }

  get tier() {
    return Quality.current();
  }

  // A partida está andando? (pausa das cartas/menu/Reviver, a entrada pela trilha e o fim não contam)
  _running() {
    const s = this.scene;
    return s.sys.isActive() && !s._intro && !s.gameOver && !s._reviveOpen && !!s.player;
  }

  _pre() {
    const now = performance.now();
    if (!this._running()) {
      this._t0 = 0;
      this._last = 0;
      return;
    }
    this._t0 = now;
    const last = this._last;
    this._last = now;
    this._dt = 0;
    if (!this._warmUntil) this._warmUntil = now + A.WARMUP_MS;
    if (!last) {
      // voltou de uma pausa (ou começou): a janela em curso não vale
      this._settle(now);
      return;
    }
    const dt = now - last;
    if (dt > 1000) {
      // app em segundo plano, aba escondida: não é desempenho
      this._settle(now);
      return;
    }
    this._dt = dt;
    const raw = this.game.loop.rawDelta;
    if (raw > 0) this.raw.add(raw);
  }

  _post() {
    if (!this._t0 || !this._dt) return;
    const now = performance.now();
    this._sample(this._dt, now - this._t0, now);
    this._dt = 0;
  }

  _settle(now, ms = A.SETTLE_MS) {
    this._settleUntil = Math.max(this._settleUntil, now + ms);
    this._dts.length = this._busy.length = 0;
    this._winMs = 0;
  }

  _sample(dt, busy, now) {
    if (now < this._warmUntil) return;
    // resumo: todo quadro depois do aquecimento
    this.dt.add(dt);
    this.work.add(busy);
    this.tierMs[this.tier] += dt;
    if (this.tier > this.worst) this.worst = this.tier;
    if (now < this._settleUntil) return;
    this._dts.push(dt);
    this._busy.push(busy);
    this._winMs += dt;
    if (this._winMs >= A.WINDOW_MS) this._closeWindow(now);
  }

  _closeWindow(now) {
    const w = {
      t: r1((this.scene.elapsedMs ?? 0) / 1000),
      ms: this._winMs,
      fps: 1000 / trimmedMean(this._dts, A.TRIM),
      busy: trimmedMean(this._busy, A.TRIM),
      tier: this.tier,
    };
    this._dts.length = this._busy.length = 0;
    this._winMs = 0;
    this.windows.push(w);
    if (this.windows.length > 600) this.windows.shift();
    this._decide(w, now);
  }

  // Coração do automático. Janela ruim / muito ruim / boa pelo alvo; descer exige sequência, subir exige
  // tempo bom E folga prevista; toda troca passa por um teste curto que pode desfazê-la
  _decide(w, now) {
    const bad = w.fps < this.target * A.DOWN;
    const awful = w.fps < this.target * A.DOWN_FAST;
    const good = w.fps >= this.target * A.UP;
    if (!Quality.auto()) {
      this.probe = null;
      this.badRun = this.awfulRun = this.goodMs = 0;
      return;
    }
    const pr = this.probe;
    if (pr) {
      pr.wins.push(w);
      // subida que não aguenta: volta na hora e espera o dobro para tentar de novo
      if (pr.up && bad) {
        this.probe = null;
        this._backoff();
        this._change(pr.from, "subida sem folga", now, w);
        return;
      }
      if (pr.wins.length < A.PROBE_WINDOWS) return;
      this.probe = null;
      if (!pr.up) {
        const fps = mean(pr.wins, (x) => x.fps);
        const busy = mean(pr.wins, (x) => x.busy);
        const still = fps < this.target * A.DOWN;
        // quanto do intervalo entre quadros é trabalho nosso: perto de 1 = o quadro do jogo é o gargalo (descer
        // pouco ainda soma, segue descendo); bem abaixo = a tela, a GPU ou outro app seguram os quadros
        const share = (busy * fps) / 1000;
        if (still && fps - pr.fps < A.GAIN_FPS && share < A.CPU_BOUND) {
          // descer não rendeu e não é o nosso quadro que pesa (tela presa em 30 Hz pela economia de bateria,
          // outro app): o visual volta e este degrau vira o piso da partida
          this.maxTier = pr.from;
          this._change(pr.from, "descida sem ganho", now, w);
          return;
        }
        // custo do degrau de cima, para prever a folga de subir: o medido na descida, com COST de piso (a horda
        // que cresce durante a descida esconde o ganho — medir 1,0 deixaria subir cedo demais)
        if (busy > 0 && pr.busy > 0) this.cost[pr.from] = Math.min(3, Math.max(A.COST[pr.from] ?? 1, pr.busy / busy));
        // as janelas do teste contam para a próxima decisão
        this.badRun = 0;
        for (const x of pr.wins) this.badRun = x.fps < this.target * A.DOWN ? this.badRun + 1 : 0;
        this.awfulRun = 0;
        this.goodMs = 0;
      }
      return;
    }
    this.badRun = bad ? this.badRun + 1 : 0;
    this.awfulRun = awful ? this.awfulRun + 1 : 0;
    this.goodMs = good ? this.goodMs + w.ms : 0;
    this.recent.push(w);
    if (this.recent.length > A.DOWN_WINDOWS) this.recent.shift();

    const tier = this.tier;
    if (tier < this.maxTier && (this.badRun >= A.DOWN_WINDOWS || this.awfulRun >= A.DOWN_FAST_WINDOWS)) {
      const n = this.badRun >= A.DOWN_WINDOWS ? A.DOWN_WINDOWS : A.DOWN_FAST_WINDOWS;
      const before = this.recent.slice(-n);
      // descer logo depois de ter subido = a subida errou (a carga voltou): a próxima tentativa espera o dobro.
      // Descer por carga nova (a horda cresceu) não pune a volta: o aparelho que esfriou sobe no tempo normal
      if (now - this._lastUpAt < A.RECENT_UP_MS) this._backoff();
      this._change(tier + 1, this.awfulRun >= A.DOWN_FAST_WINDOWS ? "queda forte" : "queda sustentada", now, w);
      this.probe = { up: false, from: tier, fps: mean(before, (x) => x.fps), busy: mean(before, (x) => x.busy), wins: [] };
      return;
    }
    if (tier > 0 && this.goodMs >= this.upWait) {
      // folga prevista no degrau de cima: o trabalho de agora × o custo dele (medido na descida, ou o de COST)
      const k = this.cost[tier - 1] ?? A.COST[tier - 1] ?? 1.2;
      if (w.busy * k <= this.budget * A.UP_BUSY) {
        this._lastUpAt = now;
        this._change(tier - 1, "folga", now, w);
        this.probe = { up: true, from: tier, wins: [] };
      }
    }
  }

  _backoff() {
    this.upWait = Math.min(A.UP_WAIT_MS[1], this.upWait * 2);
  }

  _change(to, why, now, w) {
    const from = this.tier;
    if (to === from) return;
    Quality.setTier(to);
    this.changes++;
    this.log.push({ t: w?.t ?? 0, from, to, why, fps: w ? r1(w.fps) : 0, busy: w ? r1(w.busy) : 0, wait: this.upWait });
    this.badRun = this.awfulRun = 0;
    this.goodMs = 0;
    this.recent.length = 0;
    this._settle(now);
    if (Quality.auto()) Settings.set("qualityAuto", to); // a próxima partida começa daqui
    if (DEBUG) console.debug(`[qualidade] ${T[from].id} → ${T[to].id} (${why}; ${w ? r1(w.fps) : "?"} fps, ${w ? r1(w.busy) : "?"} ms)`);
    // Baixa apaga a noite (a mudança que se vê): uma dica, uma vez na vida do save
    if (to === TOP && !T[to].light && to > from)
      this.scene._hint?.("quality", tr("Qualidade gráfica ajustada para o jogo rodar liso.\nDá pra escolher em Opções."));
  }

  // Resumo para o evento perf_run (Analytics → Firebase, se o jogador deixou: Telemetry)
  summary(extra = {}) {
    const s = this.scene;
    const id = (i) => T[i].id;
    const out = {
      ...extra,
      t: Math.floor((s.elapsedMs ?? 0) / 1000),
      biome: s.biomeId,
      difficulty: s.diff?.id ?? 0,
      run_n: s._runN ?? 0,
      frames: this.dt.n,
      q_mode: Quality.mode(), // a escolha no fim (trocar no meio da partida é raro)
      q_start: id(this.startTier),
      q_end: id(this.tier),
      q_min: id(this.worst),
      q_min_s: Math.round(this.tierMs[this.worst] / 1000),
      q_changes: this.changes,
      q_high_s: Math.round(this.tierMs[0] / 1000),
      q_med_s: Math.round(this.tierMs[1] / 1000),
      q_low_s: Math.round(this.tierMs[2] / 1000),
      ground_gpu: s.world?.layers?.length > 0 ? 1 : 0,
    };
    if (this.dt.n >= 30) {
      out.fps_p50 = r1(1000 / this.dt.pct(0.5));
      out.fps_p5 = r1(1000 / this.dt.pct(0.95)); // 5% dos quadros ficaram abaixo disto
      out.busy_p50 = r1(this.work.pct(0.5));
      out.busy_p95 = r1(this.work.pct(0.95));
      out.slow_pct = r1((100 * this.dt.above(this.budget * 1.5)) / this.dt.n); // quadros que se notam (> 25 ms a 60)
    }
    if (this.raw.n >= 30) out.hz = Math.round(Math.min(240, Math.max(20, 1000 / this.raw.pct(0.02))));
    const nav = typeof navigator !== "undefined" ? navigator : {};
    if (nav.deviceMemory > 0) out.dev_mem = nav.deviceMemory;
    if (nav.hardwareConcurrency > 0) out.cpu_cores = nav.hardwareConcurrency;
    out.fps_cap = GAME.FPS_LIMIT || 0;
    return out;
  }
}
