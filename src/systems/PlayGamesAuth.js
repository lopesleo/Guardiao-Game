// Login no Google Play Games num lugar só (só no app Android; ver PlayGamesPlugin.java). A nuvem (CloudSave.js) e
// os rankings (Leaderboards.js) ouvem daqui: entrou por qualquer caminho (Opções, ranking ou o pedido da 1ª
// abertura), os dois ficam sabendo na hora — a nuvem confere o progresso e os rankings mandam a fila.
//
// O Play Games tenta entrar sozinho ao abrir o app. Quando não consegue (1ª vez neste jogo, entrada automática
// desligada), o jogo pede UMA vez. Se o jogador recusar, não insiste: dá para entrar depois em Opções ou no
// ranking. Se a entrada falhar por erro (sem rede, credencial ainda ativando no Google), pede de novo na próxima
// abertura.
import { isNative } from "./Platform.js";

const ASKED = "guardiao_pg_asked";
const plugin = () => (isNative() ? window.Capacitor?.Plugins?.PlayGames : null);
const listeners = [];

export const PlayGamesAuth = {
  // fn é chamada (e esperada) a cada entrada que deu certo
  onSignIn(fn) {
    listeners.push(fn);
  },

  // Abre a entrada do Play Games; resolve quando a nuvem e os rankings já reagiram
  async signIn() {
    return (await this._signIn()).ok;
  },

  async _signIn() {
    const p = plugin();
    if (!p) return { ok: false, error: true };
    let r = null;
    try {
      r = await p.signIn();
    } catch {}
    const ok = !!r?.authenticated;
    if (ok) await Promise.allSettled(listeners.map((fn) => fn()));
    return { ok, error: !r || !!r.error };
  },

  // 1ª abertura sem login: pede uma vez (entrando ou recusando, não pede mais)
  async askOnce() {
    try {
      if (localStorage.getItem(ASKED)) return false;
    } catch {
      return false;
    }
    const { ok, error } = await this._signIn();
    if (!error) {
      try {
        localStorage.setItem(ASKED, "1");
      } catch {}
    }
    return ok;
  },
};
