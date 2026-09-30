// Relógio CONFIÁVEL do jogo — tudo que depende de tempo real (horta, obras,
// lago, missões do dia, baú, dias seguidos) lê a hora daqui, nunca de
// Date.now() direto. Três camadas contra "mexer na hora do celular":
//
//  1) Com o jogo aberto, o tempo anda pelo relógio MONOTÔNICO (performance.now):
//     mudar a hora do aparelho durante a sessão não tem efeito.
//  2) O tempo do jogo NUNCA anda para trás: o último instante visto fica
//     gravado. Quem adianta a hora, colhe e volta a hora encontra a floresta
//     "esperando" até o tempo real alcançar a hora falsa — a trapaça rende uma
//     vez e depois custa caro. (Voltar poucos minutos — fuso, ajuste — passa.)
//  3) No app, com internet: confere a hora pelo cabeçalho Date de um endereço
//     do Google (o mesmo que o Android usa para testar conexão), sem enviar
//     nenhum dado do jogador. Se o relógio do aparelho estiver errado, o jogo
//     usa a diferença (guardada para as próximas sessões sem internet).
import { Analytics } from "./Analytics.js";
import { META } from "../config.js";

const KEY = "guardiao_clock_v1";
const TOLERANCE_MS = 5 * 60000; // recuos pequenos (fuso, ajuste automático) passam
const NET_TRUST_MS = 2 * 60000; // diferença que já conta como "relógio errado"
const TIME_URL = "https://clients3.google.com/generate_204";

let state = null; // { last, offset, rollbacks }
let base = null; // { perf0, trusted0 }
const listeners = new Set();

function load() {
  let s = { last: 0, offset: 0, rollbacks: 0 };
  try {
    s = { ...s, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {}
  // O último instante também vive no save (assinado): apagar só esta chave
  // não tira o piso anti-recuo
  try {
    const save = JSON.parse(localStorage.getItem(META.STORAGE_KEY) || "{}");
    if (save.clockLast > s.last) s.last = save.clockLast;
  } catch {}
  return s;
}
function persist() {
  if (!state || !base) return;
  state.last = Math.max(state.last, Clock.now());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

// (Re)ancora o relógio: hora do aparelho corrigida pela internet, mas nunca
// antes do último instante já visto
// O tempo do jogo = max(piso, relógio real andando pelo monotônico). O piso é o
// último instante já visto: se voltaram a hora, o jogo fica PARADO nele até o
// relógio real alcançar — o ganho de adiantar a hora é devolvido depois.
function anchor() {
  const wall = Date.now() + (state.offset || 0);
  const floor = state.last || 0;
  if (wall + TOLERANCE_MS < floor) {
    const back = floor - wall;
    state.rollbacks++;
    Analytics.track("clock_rollback", { min: Math.round(back / 60000) });
    listeners.forEach((f) => f({ type: "rollback", ms: back }));
  }
  // recuo pequeno (dentro da tolerância) não congela: o piso só vale acima dela
  base = { perf0: performance.now(), wall0: wall, floor: wall + TOLERANCE_MS < floor ? floor : Math.min(floor, wall) };
  persist();
}

export const Clock = {
  // Chamado 1x no boot (main.js); seguro chamar de novo
  init() {
    if (base) return;
    state = load();
    anchor();
    // Ao voltar do segundo plano o relógio monotônico pode ter parado (celular
    // dormindo): reancora pela hora do aparelho, sempre com o piso anti-recuo
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) persist();
      else {
        anchor();
        this.checkNetwork();
      }
    });
    window.addEventListener("pagehide", persist);
    setInterval(persist, 15000);
    this.checkNetwork();
  },

  // Agora, em ms (use no lugar de Date.now())
  now() {
    if (!base) this.init();
    return Math.max(base.floor, base.wall0 + (performance.now() - base.perf0));
  },
  // Agora como Date (hora/dia locais para "missões do dia", céu etc.)
  date() {
    return new Date(this.now());
  },

  // Quanto o tempo do jogo está "esperando" o relógio real alcançar (ms)
  frozenMs() {
    if (!base) return 0;
    return Math.max(0, base.floor - (base.wall0 + (performance.now() - base.perf0)));
  },
  get rollbacks() {
    return state?.rollbacks || 0;
  },
  onEvent(f) {
    listeners.add(f);
    return () => listeners.delete(f);
  },

  // Hora da internet (só no app: o HTTP nativo lê o cabeçalho Date sem CORS)
  async checkNetwork() {
    const http = window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.CapacitorHttp;
    if (!http || this._checking) return;
    this._checking = true;
    try {
      const t0 = Date.now();
      const res = await Promise.race([http.request({ url: TIME_URL, method: "GET" }), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
      const h = res?.headers || {};
      const dateHdr = h.Date || h.date;
      const server = Date.parse(dateHdr);
      if (!isNaN(server)) {
        const rtt = Date.now() - t0;
        const offset = server + rtt / 2 - Date.now();
        const next = Math.abs(offset) > NET_TRUST_MS ? offset : 0;
        if (Math.abs(next - (state.offset || 0)) > NET_TRUST_MS / 2) {
          if (next) Analytics.track("clock_skew", { min: Math.round(next / 60000) });
          state.offset = next;
          anchor();
        }
      }
    } catch {
      // sem internet: segue com o piso anti-recuo e a última diferença conhecida
    } finally {
      this._checking = false;
    }
  },
};
