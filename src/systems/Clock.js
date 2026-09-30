// Relógio CONFIÁVEL do jogo — tudo que depende de tempo real (horta, obras,
// lago, missões do dia, baú, dias seguidos) lê a hora daqui, nunca de
// Date.now() direto. O tempo do jogo só AVANÇA pelo que dá para confirmar:
//
//  · Com o jogo aberto: relógio monotônico (performance.now) — mexer na hora
//    do aparelho durante a sessão não tem efeito nenhum.
//  · Entre sessões (ou voltando do segundo plano):
//      1) com internet, a hora do servidor manda (para frente e para trás):
//         no app, cabeçalho Date do Google (sem enviar dados); na web, o
//         cabeçalho Date do próprio site;
//      2) sem internet, no app Android: o tempo desde que o aparelho ligou
//         (plugin ElapsedClock — o jogador não consegue alterar) diz quanto
//         passou DE VERDADE; a hora do aparelho é ignorada;
//      3) sem nenhuma confirmação (celular reiniciado offline, web offline):
//         o avanço vai para uma COTA NÃO CONFIRMADA de no máximo 12 h no TOTAL
//         (não por sessão). Quando a internet volta, a verdade aparece: o que
//         passou da hora real fica congelado até o relógio real alcançar.
//  · O tempo do jogo nunca volta.
// O estado mora também dentro do save assinado: apagar dados não renova a cota.
import { Analytics } from "./Analytics.js";
import { META } from "../config.js";

const KEY = "guardiao_clock_v2";
const UNVERIFIED_MAX_MS = 12 * 3600000; // cota de avanço sem confirmação
const TOL_MS = 2 * 60000; // diferença que já conta ao conferir com a internet
const TIME_URL = "https://clients3.google.com/generate_204";

// last: último instante de jogo visto · wallAt: hora do aparelho nesse instante
// elapsedAt/boot: relógio desde que ligou nesse instante · unverified: cota usada
// pending: avanço que o aparelho alegou e não foi aceito (espera confirmação)
const EMPTY = { last: 0, wallAt: 0, elapsedAt: null, boot: null, unverified: 0, pending: 0, rollbacks: 0 };
let state = null;
let base = null; // { perf0, t0, floor }
let elapsedRef = null; // { elapsed, boot, perf } — última leitura do plugin
const native = () => !!window.Capacitor?.isNativePlatform?.();
const plugin = () => (native() ? window.Capacitor?.Plugins?.ElapsedClock : null);

function load() {
  let a = { ...EMPTY },
    b = null;
  try {
    a = { ...a, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {}
  try {
    const save = JSON.parse(localStorage.getItem(META.STORAGE_KEY) || "{}");
    if (save.clock) b = { ...EMPTY, ...save.clock };
    else if (save.clockLast) b = { ...EMPTY, last: save.clockLast };
  } catch {}
  if (!b) return a;
  // o mais "avançado" vale, e a cota usada nunca diminui por apagar uma cópia
  const s = b.last > a.last ? b : a;
  s.unverified = Math.max(a.unverified || 0, b.unverified || 0);
  return s;
}

function elapsedNow() {
  return elapsedRef ? { elapsed: elapsedRef.elapsed + (performance.now() - elapsedRef.perf), boot: elapsedRef.boot } : null;
}

function persist() {
  if (!state || !base) return;
  state.last = Math.max(state.last, Clock.now());
  state.wallAt = Date.now();
  const e = elapsedNow();
  if (e) {
    state.elapsedAt = e.elapsed;
    state.boot = e.boot;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

// Reancora o tempo do jogo a partir do último instante visto, aceitando só o
// avanço que dá para confirmar
function anchor(e = null) {
  const wall = Date.now();
  const first = !state.last;
  let accepted = 0;
  if (first) {
    state.last = wall; // primeira vez: não há como saber, começa na hora do aparelho
  } else if (e && state.elapsedAt != null && e.boot === state.boot && e.elapsed >= state.elapsedAt) {
    // tempo real medido pelo aparelho ligado. Android < 7 não informa a contagem
    // de boots (-1): aí só "o relógio desde que ligou diminuiu" denuncia um
    // reinício — no pior caso o jogo dá MENOS tempo do que passou, nunca mais.
    accepted = e.elapsed - state.elapsedAt;
    state.pending = 0;
  } else {
    const claim = wall - (state.wallAt || wall);
    if (claim < -TOL_MS) {
      state.rollbacks++;
      Analytics.track("clock_rollback", { min: Math.round(-claim / 60000) });
    }
    const budget = Math.max(0, UNVERIFIED_MAX_MS - state.unverified);
    accepted = Math.max(0, Math.min(claim, budget));
    state.unverified += accepted;
    state.pending = Math.max(0, claim - accepted) + (state.pending || 0);
  }
  base = { perf0: performance.now(), t0: state.last + accepted, floor: state.last };
  persist();
}

// Hora confirmada pela internet: vira a verdade (zera a cota). Se o jogo
// estava adiantado, ele espera parado até o relógio real alcançar.
function anchorNet(net) {
  const cur = Clock.now();
  if (net + TOL_MS < cur) Analytics.track("clock_ahead", { min: Math.round((cur - net) / 60000) });
  base = { perf0: performance.now(), t0: net, floor: Math.max(cur, state.last) };
  state.unverified = 0;
  state.pending = 0;
  state.verifiedAt = net;
  persist();
}

export const Clock = {
  // Chamado 1x no boot (main.js); seguro chamar de novo
  init() {
    if (base) return;
    state = load();
    const p = plugin();
    if (p) {
      // no app: começa parado no último instante e reancora quando o plugin
      // responder (milissegundos) com o tempo real que passou
      base = { perf0: performance.now(), t0: state.last || Date.now(), floor: state.last || 0 };
      if (!state.last) state.last = Date.now();
      this._readElapsed().then((e) => anchor(e));
    } else anchor();
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) return persist();
      anchor(await this._readElapsed());
      this.checkNetwork();
    });
    window.addEventListener("pagehide", persist);
    setInterval(persist, 15000);
    this.checkNetwork();
  },

  async _readElapsed() {
    const p = plugin();
    if (!p) return null;
    try {
      const r = await p.now();
      elapsedRef = { elapsed: r.elapsed, boot: r.boot, perf: performance.now() };
      return { elapsed: r.elapsed, boot: r.boot };
    } catch {
      return null;
    }
  },

  // Agora, em ms (use no lugar de Date.now())
  now() {
    if (!base) this.init();
    return Math.max(base.floor, base.t0 + (performance.now() - base.perf0));
  },
  // Agora como Date (hora/dia locais para "missões do dia", céu etc.)
  date() {
    return new Date(this.now());
  },
  // Quanto o jogo está parado esperando o relógio real alcançar (ms)
  frozenMs() {
    if (!base) return 0;
    return Math.max(0, base.floor - (base.t0 + (performance.now() - base.perf0)));
  },
  // Avanço que o aparelho alegou mas ninguém confirmou (espera internet)
  pendingMs() {
    return state?.pending || 0;
  },
  get rollbacks() {
    return state?.rollbacks || 0;
  },
  // Cópia do estado para morar dentro do save assinado
  snapshot() {
    if (!state) return null;
    persist();
    return { ...state };
  },

  // Hora da internet. App: HTTP nativo lê o Date do Google (sem CORS).
  // Web: HEAD no próprio site (mesma origem; o service worker não intercepta).
  async checkNetwork() {
    if (this._checking) return;
    this._checking = true;
    try {
      const t0 = Date.now();
      let dateHdr = null;
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000));
      const http = native() && window.Capacitor?.Plugins?.CapacitorHttp;
      if (http) {
        const res = await Promise.race([http.request({ url: TIME_URL, method: "GET" }), timeout]);
        dateHdr = res?.headers?.Date || res?.headers?.date;
      } else if (!native() && /^https?:$/.test(location.protocol)) {
        const res = await Promise.race([fetch(`${location.pathname}?t=${t0}`, { method: "HEAD", cache: "no-store" }), timeout]);
        dateHdr = res.headers.get("Date");
      }
      const server = Date.parse(dateHdr);
      if (!isNaN(server)) anchorNet(server + (Date.now() - t0) / 2);
    } catch {
      // sem internet: segue com o relógio do aparelho ligado ou com a cota
    } finally {
      this._checking = false;
    }
  },
};
