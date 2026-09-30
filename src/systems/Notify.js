// Notificações locais OPCIONAIS (só no app Android, via Capacitor). O jogo só
// pede permissão no momento em que faz sentido (abriu o baú do dia, plantou algo
// demorado) e nunca na 1ª abertura. No máximo 2 avisos agendados: o baú de
// amanhã e a colheita mais demorada. No navegador, tudo aqui é inofensivo.
import { Settings } from "./Settings.js";
import { isNative } from "./Platform.js";

const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;
export const NOTIFY_ID = { chest: 1, crop: 2 };

export const Notify = {
  available: () => isNative() && !!plugin(),
  enabled: () => Settings.get("notify") === true,
  asked: () => Settings.get("notifyAsked") === true,

  // Pede a permissão do sistema; guarda que já perguntamos (não insiste)
  async enable() {
    Settings.set("notifyAsked", true);
    const p = plugin();
    if (!p) return false;
    try {
      const r = await p.requestPermissions();
      const ok = r?.display === "granted";
      Settings.set("notify", ok);
      return ok;
    } catch {
      return false;
    }
  },
  disable() {
    Settings.set("notify", false);
    plugin()?.cancel?.({ notifications: Object.values(NOTIFY_ID).map((id) => ({ id })) }).catch?.(() => {});
  },
  decline() {
    Settings.set("notifyAsked", true);
  },

  // Agenda (substitui o anterior com o mesmo id)
  async schedule(id, at, title, body) {
    if (!this.available() || !this.enabled() || !(at > Date.now())) return;
    const p = plugin();
    try {
      await p.cancel({ notifications: [{ id }] });
      await p.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(at), allowWhileIdle: true } }] });
    } catch {}
  },
};

// Próximo horário "educado" para o baú: amanhã às 10h (hora local)
export function tomorrowAt(hour = 10, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, 0, 0).getTime();
}
