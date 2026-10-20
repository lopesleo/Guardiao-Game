// O que o Android deixa o jogo mostrar (só no app): a permissão de notificações (Android 13+: POST_NOTIFICATIONS;
// antes: o app não bloqueado nas configurações) e os canais que o jogador desligou no sistema ("default" = baú e
// colheita, Notify.js; "novidades" = News.js). As chaves Avisos e Novidades de Opções só ficam SIM com o que o
// Android deixa: a escolha guardada volta com o backup do Android ao reinstalar e a permissão não (o Android também
// tira a permissão de app parado há meses), e a chave mostrava SIM sem nada chegar (20/10/2026).
import { isNative } from "./Platform.js";

const local = () => window.Capacitor?.Plugins?.LocalNotifications;
const screen = () => window.Capacitor?.Plugins?.NotificationSettings; // plugin local (NotificationSettingsPlugin.java)
const app = () => window.Capacitor?.Plugins?.App;
export const CHANNEL = { reminders: "default", news: "novidades" };
const INSTANT = 700; // ms: resposta mais rápida que isso = o Android nem mostrou o pedido

// { perm: "granted" | "prompt" (dá para pedir) | "denied" (o Android não mostra mais o pedido), off: [canais
// desligados no sistema] }; null = ainda não conferiu
let state = null;
let busy = false; // pedindo a permissão ou com as configurações abertas: quem escuta espera o fim
const subs = new Set();

// Espera o jogador voltar para o jogo (as configurações do Android cobrem a tela inteira)
function backToApp() {
  return new Promise((done) => {
    let handle = null;
    const finish = () => {
      clearTimeout(timer);
      handle?.then?.((h) => h?.remove?.());
      done();
    };
    const timer = setTimeout(finish, 10 * 60000);
    handle = app()?.addListener?.("resume", finish);
    if (!handle) finish();
  });
}

export const NotifyAccess = {
  available: () => isNative() && !!local(),
  get state() {
    return state;
  },
  get busy() {
    return busy;
  },
  // O Android deixa mostrar nesse canal? null enquanto não conferiu (quem pergunta segue a escolha guardada)
  allowed(channel) {
    if (!state) return null;
    return state.perm === "granted" && !state.off.includes(channel);
  },
  // Bloqueado no sistema: o pedido não aparece mais ou o canal foi desligado (só nas configurações do Android)
  blocked(channel) {
    return !!state && (state.perm === "denied" || (state.perm === "granted" && state.off.includes(channel)));
  },

  // Chamar 1x no boot, antes de Notify e News
  async install() {
    if (!this.available()) return;
    // Voltou das configurações do Android (ou de qualquer lugar): confere de novo
    app()?.addListener?.("resume", () => this.refresh())?.catch?.(() => {});
    await this.refresh();
  },

  async refresh() {
    const p = local();
    if (!p) return state;
    let perm = "prompt",
      off = [];
    try {
      const r = await p.checkPermissions();
      perm = r?.display === "granted" ? "granted" : r?.display === "denied" ? "denied" : "prompt";
    } catch {}
    try {
      off = ((await p.listChannels())?.channels ?? []).filter((c) => c.importance === 0).map((c) => c.id);
    } catch {}
    const before = JSON.stringify(state);
    state = { perm, off };
    if (!busy && JSON.stringify(state) !== before) for (const fn of subs) fn(state);
    return state;
  },
  // Avisa quando o Android mudou de ideia (o jogador voltou das configurações); devolve como parar de ouvir
  onChange(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },

  // O jogador pediu para ligar: mostra o pedido do Android ou, quando o Android não mostra mais (recusou duas
  // vezes, ou o canal está desligado), abre a tela de notificações do jogo e confere na volta.
  // true = agora o Android deixa mostrar nesse canal
  async request(channel) {
    if (!local()) return false;
    const before = JSON.stringify(await this.refresh());
    if (this.allowed(channel)) return true;
    busy = true;
    try {
      let s = state;
      if (s.perm === "prompt") {
        const t0 = Date.now();
        try {
          await local().requestPermissions();
        } catch {}
        s = await this.refresh();
        if (this.allowed(channel) || s.perm !== "denied" || Date.now() - t0 > INSTANT) return !!this.allowed(channel);
      }
      // App bloqueado → tela de notificações do jogo; só o canal desligado → a tela daquele canal
      if (!screen()?.open) return false;
      try {
        await screen().open(s.perm === "granted" ? { channel } : {});
      } catch {
        return false;
      }
      await backToApp();
      await this.refresh();
      return !!this.allowed(channel);
    } finally {
      busy = false;
      if (JSON.stringify(state) !== before) for (const fn of subs) fn(state);
    }
  },
};
