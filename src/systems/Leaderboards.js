// Rankings do Google Play Games (só no app Android, com o ID do Play Games; ver PlayGamesPlugin.java e
// docs/PLAY_STORE.md, "Rankings"). Só partidas SOLO. Dois rankings, cada um com a semana e o de sempre (o Play
// Games mantém os períodos sozinho):
//  · score  — a pontuação da partida (runScore, conta em RANKING no config.js);
//  · perigo — o maior Perigo vencido (1 = Aprendiz … 5 = Pesadelo).
// Sem internet ou sem login, o envio espera numa fila (no aparelho) e sai quando o jogador entra no Play Games ou na
// próxima abertura; o recorde de
// pontuação também fica guardado no aparelho, para a tela do fim mostrar "novo recorde" mesmo sem rede.
import { RANKING, DIFFICULTY } from "../config.js";
import { isNative } from "./Platform.js";
import { Analytics } from "./Analytics.js";
import { PlayGamesAuth } from "./PlayGamesAuth.js";

const KEY = "guardiao_ranking_v1"; // { best, queue: { [board]: valor }, perigoSent }
const CACHE_MS = 60000; // a lista aberta de novo em menos de 1 min não recarrega
const plugin = () => (isNative() ? window.Capacitor?.Plugins?.PlayGames : null);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function save(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {}
}

// Pontos de uma partida: (abates × KILL + VICTORY se venceu) × multiplicador do Perigo
export function runScore({ kills = 0, won = false, difficulty = 0 }) {
  const mult = RANKING.PERIGO_MULT[difficulty] ?? 1;
  return Math.min(RANKING.SCORE_MAX, Math.round((Math.max(0, kills) * RANKING.KILL + (won ? RANKING.VICTORY : 0)) * mult));
}

// Maior Perigo vencido do save (1..5), ou 0 sem vitória
export function bestPerigo(data) {
  const won = Object.entries(data?.winsByDifficulty || {}).filter(([, n]) => n > 0).map(([k]) => Number(k));
  return won.length ? Math.max(...won) + 1 : 0;
}
export const perigoName = (v) => DIFFICULTY[v - 1]?.name ?? "";

export const Leaderboards = {
  configured: false, // o plugin respondeu que há ID do Play Games
  signedIn: false,
  _cache: {},
  _flushing: null, // o envio em andamento: quem chama de novo espera o mesmo (a lista só carrega depois)

  // Há o que mostrar: app + ID do Play Games + o ranking criado
  available() {
    return !!plugin() && this.configured && Object.values(RANKING.IDS).some(Boolean);
  },
  has: (board) => !!RANKING.IDS[board],
  best: () => load().best ?? 0,

  // Chamar 1x no boot (e de novo quando o login acontecer): manda o que ficou na fila e, uma vez, o maior Perigo
  // já vencido antes de existirem os rankings
  async install(meta) {
    const p = plugin();
    if (!p) return;
    try {
      const s = await p.status();
      this.configured = !!s.configured;
      this.signedIn = !!s.authenticated;
    } catch {}
    if (!this.available()) return;
    // compara com o que já subiu (e não com uma marca de "já fiz"): o save que volta da nuvem depois de
    // reinstalar chega com as vitórias e entra na abertura seguinte
    const v = meta ? bestPerigo(meta.data) : 0;
    if (v > (load().perigoSent ?? 0)) this._queue("perigo", v);
    await this.flush();
  },

  // Fim de partida: calcula os pontos, guarda o recorde e manda (ou põe na fila). Volta { score, record } na
  // hora; o envio segue sozinho. mode: só "solo" entra (o coop terá ranking próprio)
  submitRun({ kills, won, difficulty, mode = "solo" }) {
    const score = runScore({ kills, won, difficulty });
    if (mode !== "solo") return { score, record: false };
    const d = load();
    const record = score > (d.best ?? 0);
    if (record) {
      d.best = score;
      save(d);
    }
    if (!this.available()) return { score, record };
    if (score > 0) this._queue("score", score);
    if (won) this._queue("perigo", difficulty + 1);
    this.flush();
    Analytics.track("rank_submit", { score, perigo: difficulty, won });
    return { score, record };
  },

  // A fila guarda o maior valor ainda não enviado de cada ranking (o Play Games só fica com o melhor mesmo)
  _queue(board, value) {
    if (!this.has(board)) return;
    const d = load();
    const q = (d.queue ||= {});
    q[board] = Math.max(q[board] ?? 0, value);
    save(d);
  },

  // Resolve quando a fila subiu. Um envio já em andamento pode ter lido a fila antes de um valor novo: o
  // próximo vai na sequência dele, e quem espera (a lista do ranking) espera os dois
  flush() {
    const p = plugin();
    if (!p || !this.available()) return Promise.resolve();
    const mine = (this._flushing || Promise.resolve())
      .then(() => this._send(p))
      .finally(() => {
        if (this._flushing === mine) this._flushing = null;
      });
    return (this._flushing = mine);
  },

  async _send(p) {
    const q = { ...(load().queue || {}) };
    for (const [board, value] of Object.entries(q)) {
      try {
        await p.submitScore({ leaderboardId: RANKING.IDS[board], score: value });
        const d = load();
        if (d.queue?.[board] === value) delete d.queue[board]; // um valor maior pode ter chegado no meio
        if (board === "perigo") d.perigoSent = Math.max(d.perigoSent ?? 0, value);
        save(d);
        delete this._cache[`${board}:week`];
        delete this._cache[`${board}:all`];
      } catch {
        break; // sem rede ou sem login: tenta na próxima vez
      }
    }
  },

  // Lista do ranking: { scores: [{ rank, name, score, me }], player, total }. Falha com e.reason = "signin" (não
  // entrou no Play Games) ou "offline"
  async scores(board, span = "week", { fresh = false } = {}) {
    const p = plugin();
    const key = `${board}:${span}`;
    const c = this._cache[key];
    if (!fresh && c && Date.now() - c.at < CACHE_MS) return c.data;
    if (!p || !this.has(board)) throw Object.assign(new Error("off"), { reason: "offline" });
    try {
      const s = await p.status();
      this.signedIn = !!s.authenticated;
    } catch {}
    if (!this.signedIn) throw Object.assign(new Error("signin"), { reason: "signin" });
    await this.flush(); // o que está na fila entra antes de mostrar
    try {
      const data = await p.loadScores({ leaderboardId: RANKING.IDS[board], span, max: RANKING.TOP });
      this._cache[key] = { at: Date.now(), data };
      return data;
    } catch {
      throw Object.assign(new Error("offline"), { reason: "offline" });
    }
  },

  // Entrada manual no Play Games (quando a automática não aconteceu). Resolve depois de a fila subir (aviso de
  // login, no fim do arquivo): a lista que abre em seguida já tem a partida que estava esperando
  async signIn() {
    return PlayGamesAuth.signIn();
  },
};

// Entrou no Play Games por qualquer caminho (Opções, ranking, pedido da 1ª abertura): manda a fila na hora
PlayGamesAuth.onSignIn(() => {
  Leaderboards.signedIn = true;
  return Leaderboards.flush();
});
