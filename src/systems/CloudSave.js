// Progresso na nuvem pelo Google Play Games (só no app Android; ver PlayGamesPlugin.java).
//
// O jogo continua lendo e gravando o save do APARELHO (localStorage). A nuvem guarda uma
// cópia, ligada à conta Google do jogador, que volta quando ele reinstala ou troca de
// celular. Ninguém compartilha save: só a própria conta lê o próprio espaço.
//
// Regras (a ordem importa):
//  · nada sobe antes da 1ª conferência da sessão (senão um aparelho novo, vazio, apagaria
//    a nuvem);
//  · todo envio leva um CARIMBO novo, e o aparelho lembra o último carimbo que viu. Nuvem
//    com o mesmo carimbo = ninguém mexeu nela desde então: o aparelho é o mais novo e sobe;
//  · carimbo diferente (outro celular jogou, ou é uma instalação nova):
//      - aparelho sem progresso → baixa a nuvem sozinho (o caso "reinstalei o jogo");
//      - os dois com progresso → o JOGADOR escolhe, vendo partidas e moedas de cada um;
//  · baixar = grava no localStorage e recarrega o jogo (todos os sistemas releem o save);
//  · nunca decide no meio de uma partida: espera o jogador voltar ao título/Clareira.
import { META } from "../config.js";
import { isNative } from "./Platform.js";
import { Analytics } from "./Analytics.js";
import { Clock } from "./Clock.js";
import { signSave, serializeSave, addSaveHook, SaveLock } from "./MetaProgression.js";

const SLOT = "guardiao_progresso";
const KEY = "guardiao_cloud_v1"; // { stamp, at } — último carimbo visto na nuvem e quando
const RESTORED = "guardiao_cloud_restored"; // sessionStorage: aviso depois de recarregar
const UPLOAD_DELAY_MS = 20000; // junta várias gravações seguidas num envio só
const RETRY_MS = 2000;

const plugin = () => (isNative() ? window.Capacitor?.Plugins?.PlayGames : null);

function memory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function remember(stamp) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ stamp, at: Clock.now() }));
  } catch {}
}
const newStamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function parseSave(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const hasProgress = (d) => !!d && ((d.runsPlayed || 0) > 0 || (d.stats?.totalCoinsEarned || 0) > 0);
// Resumo mostrado na escolha entre aparelho e nuvem
export const summaryOf = (d) => ({
  runs: d?.runsPlayed || 0,
  wins: d?.wins || 0,
  coins: d?.totalCoins || 0,
  legends: (d?.unlockedCharacters || []).length,
});

export const CloudSave = {
  // off: sem app/sem ID do Play Games · out: não entrou na conta · checking: conferindo
  // ask: esperando o jogador escolher · ready: sincronizado · error: falhou (tenta de novo)
  state: "off",
  lastSync: 0,
  _live: false, // pode enviar (já houve a 1ª conferência)
  _dirty: false,
  _busy: false,
  _timer: null,
  _waiters: [],
  _ui: null, // { ask(choice), toast(msg) } — ligado pela interface (CloudSaveUI.js)
  _game: null,

  available: () => !!plugin(),
  connected() {
    return this.state === "ready" || this.state === "ask" || this.state === "checking";
  },

  // Chamar 1x no boot, depois de criar o jogo
  async install(game) {
    this._game = game;
    if (!plugin()) return;
    addSaveHook(() => this.touch());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.flush();
      else if (this.state === "error" && !this._live) this.sync(); // a 1ª conferência falhou (sem internet)
    });
    let st = null;
    try {
      st = await plugin().status();
    } catch {}
    if (!st?.configured) return this._settle("off");
    if (!st.authenticated) return this._settle("out");
    await this.sync();
  },

  // Entrar na conta pelo botão em Opções
  async signIn() {
    if (!plugin()) return false;
    try {
      const r = await plugin().signIn();
      if (!r?.authenticated) return false;
    } catch {
      return false;
    }
    Analytics.track("cloud_signin", {});
    await this.sync();
    return true;
  },

  // Promessa que resolve quando a 1ª conferência terminar (ou o tempo esgotar).
  // O título espera por ela na 1ª abertura, antes de mandar o jogador à 1ª partida.
  settled(timeoutMs = 8000) {
    if (!plugin() || this._settledOnce) return Promise.resolve(this.state);
    return new Promise((res) => {
      const t = setTimeout(() => res(this.state), timeoutMs);
      this._waiters.push(() => {
        clearTimeout(t);
        res(this.state);
      });
    });
  },
  _settle(state) {
    this.state = state;
    this._settledOnce = true;
    const w = this._waiters.splice(0);
    w.forEach((fn) => fn());
  },

  // Confere a nuvem e decide quem vale
  async sync() {
    if (!plugin() || this._busy) return;
    this.state = "checking";
    this._busy = true;
    let cloud;
    try {
      cloud = await this._read();
    } catch {
      this._busy = false;
      return this._settle("error");
    }
    this._busy = false;
    this._decide(cloud);
  },

  async _read() {
    const r = await plugin().read({ slot: SLOT });
    if (!r?.data) return null;
    const p = JSON.parse(r.data);
    return p && typeof p.save === "string" ? p : null;
  },

  _decide(cloud) {
    // no meio da partida não troca nada: espera voltar ao título ou à Clareira
    if (this._inRun()) {
      setTimeout(() => this._decide(cloud), RETRY_MS);
      return;
    }
    const localRaw = this._localRaw();
    const local = parseSave(localRaw);
    const seen = memory().stamp;
    if (!cloud) {
      // nuvem vazia: o aparelho manda (sobe se houver algo)
      this._goLive();
      if (localRaw) this._upload();
      return;
    }
    if (cloud.stamp === seen || cloud.save === localRaw) {
      // ninguém mexeu na nuvem desde a última vez: o aparelho é o mais novo
      remember(cloud.stamp);
      this._goLive();
      return;
    }
    const remote = parseSave(cloud.save);
    if (!hasProgress(remote)) {
      this._goLive();
      this._upload();
      return;
    }
    if (!hasProgress(local)) return this.restore(cloud, "auto");
    // os dois têm progresso e são diferentes: o jogador escolhe
    this.state = "ask";
    Analytics.track("cloud_conflict", { local_runs: summaryOf(local).runs, cloud_runs: summaryOf(remote).runs });
    const ask = () => {
      if (!this._ui || this._inRun() || !this._ui.ask) return setTimeout(ask, RETRY_MS);
      this._ui.ask({
        local: { ...summaryOf(local), at: local?.clock?.last || 0 },
        cloud: { ...summaryOf(remote), at: cloud.at || 0 },
        useCloud: () => this.restore(cloud, "choice"),
        keepLocal: () => {
          Analytics.track("cloud_keep_local", {});
          this._goLive();
          this._upload();
        },
        // fechou sem escolher: nada sobe nesta sessão (pergunta de novo na próxima)
        later: () => this._settle("ask"),
      });
    };
    ask();
  },

  _goLive() {
    this._live = true;
    this.lastSync = Date.now();
    this._settle("ready");
    if (this._dirty) this.touch();
  },

  // Troca o save do aparelho pelo da nuvem e recarrega o jogo
  restore(cloud, why) {
    const d = parseSave(cloud.save);
    if (!d) return;
    // assinatura conferida ANTES de reassinar (edição manual continua marcada)
    const { _sig, ...rest } = d;
    if (_sig && _sig !== signSave(JSON.stringify(rest))) rest.integrity = { ...(rest.integrity || {}), tampered: ((rest.integrity || {}).tampered || 0) + 1 };
    // o "relógio desde que ligou" pertence ao OUTRO aparelho: aqui não vale nada (ver Clock.js)
    if (rest.clock) rest.clock = { ...rest.clock, elapsedAt: null, boot: null };
    SaveLock.frozen = true;
    try {
      localStorage.setItem(META.STORAGE_KEY, serializeSave(JSON.stringify(rest)));
      remember(cloud.stamp);
      sessionStorage.setItem(RESTORED, "1");
    } catch {
      SaveLock.frozen = false;
      return;
    }
    Analytics.track("cloud_restore", { why, runs: summaryOf(rest).runs });
    setTimeout(() => location.reload(), 50);
  },

  // Aviso "progresso recuperado" (uma vez, depois do recarregamento)
  takeRestoredNotice() {
    try {
      if (!sessionStorage.getItem(RESTORED)) return false;
      sessionStorage.removeItem(RESTORED);
      return true;
    } catch {
      return false;
    }
  },

  // O save mudou: agenda um envio
  touch() {
    this._dirty = true;
    if (!this._live || this._timer) return;
    this._timer = setTimeout(() => this.flush(), UPLOAD_DELAY_MS);
  },

  // Envia já (app indo para o fundo, botão em Opções)
  async flush() {
    clearTimeout(this._timer);
    this._timer = null;
    if (!this._live || !this._dirty || this._busy) return;
    // outro aparelho gravou no meio tempo? volta a decidir em vez de passar por cima
    this._busy = true;
    let cloud;
    try {
      cloud = await this._read();
    } catch {
      this._busy = false;
      this.state = "error";
      return;
    }
    this._busy = false;
    if (cloud && cloud.stamp !== memory().stamp && cloud.save !== this._localRaw()) {
      this._live = false;
      return this._decide(cloud);
    }
    await this._upload();
  },

  async _upload() {
    const raw = this._localRaw();
    if (!raw || this._busy) return;
    this._busy = true;
    this._dirty = false;
    const d = parseSave(raw);
    const s = summaryOf(d);
    const stamp = newStamp();
    try {
      await plugin().write({
        slot: SLOT,
        data: JSON.stringify({ v: 1, stamp, at: Clock.now(), save: raw }),
        // aparece na lista de jogos salvos do Play Games
        description: `${s.runs} · ${s.coins}`,
        progress: s.runs,
      });
      remember(stamp);
      this.lastSync = Date.now();
      this.state = "ready";
    } catch {
      this._dirty = true;
      this.state = "error";
    }
    this._busy = false;
    // gravou de novo enquanto enviava: agenda o próximo
    if (this._dirty) this.touch();
  },

  _localRaw() {
    try {
      return localStorage.getItem(META.STORAGE_KEY);
    } catch {
      return null;
    }
  },
  _inRun() {
    const sm = this._game?.scene;
    return !!sm && (sm.isActive("GameScene") || sm.isActive("FirstDefeatScene"));
  },
};
