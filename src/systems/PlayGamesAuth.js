// Login no Google Play Games num lugar só (só no app Android; ver PlayGamesPlugin.java). A nuvem (CloudSave.js) e
// os rankings (Leaderboards.js) ouvem daqui: entrou por qualquer caminho (Opções, ranking ou o pedido da 1ª
// abertura), os dois ficam sabendo na hora — a nuvem confere o progresso e os rankings mandam a fila.
//
// O Play Games tenta entrar sozinho ao abrir o app. Quando não consegue (1ª vez neste jogo, entrada automática
// desligada), o jogo pede UMA vez. Se o jogador recusar, não insiste: dá para entrar depois em Opções ou no
// ranking. Se a entrada falhar por erro (sem rede, credencial ainda ativando no Google), pede de novo na próxima
// abertura.
//
// Quem já entrou e abre o jogo sem a entrada automática (achado no aparelho em 20/10: a nuvem ficava em
// "Conectar" a cada abertura) entra de novo na abertura — para quem já deu permissão, o Play Games só mostra o
// logo, sem pergunta. Quem já tinha respondido antes desta regra (sem a marca IN) é tentado uma vez.
import { isNative } from "./Platform.js";

const ASKED = "guardiao_pg_asked";
const IN = "guardiao_pg_in"; // já entrou neste aparelho (e não recusou depois)
const V2 = "guardiao_pg_v2"; // a regra de "entrar de novo" já valeu uma vez neste aparelho
const plugin = () => (isNative() ? window.Capacitor?.Plugins?.PlayGames : null);
const listeners = [];
const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k, v) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {}
};

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
    if (ok) {
      put(IN, "1");
      await Promise.allSettled(listeners.map((fn) => fn()));
    }
    return { ok, error: !r || !!r.error };
  },

  // A entrada automática funcionou: marca que este aparelho já entrou (se um dia ela falhar, entra de novo)
  noteSignedIn() {
    put(IN, "1");
  },

  // Abertura sem login automático: pede na 1ª vez, entra de novo quem já entrou; recusou, não pede mais
  async atLaunch() {
    if (!plugin()) return false;
    const asked = get(ASKED);
    const migrating = asked && !get(V2) && !get(IN);
    put(V2, "1");
    if (asked && !get(IN) && !migrating) return false;
    const { ok, error } = await this._signIn();
    if (!error) put(ASKED, "1");
    if (!ok && !error) put(IN, null); // fechou a entrada: na próxima abertura não insiste
    return ok;
  },
};
