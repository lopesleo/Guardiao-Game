// Notificações locais OPCIONAIS (só no app Android, via Capacitor). O jogo só
// pede permissão no momento em que faz sentido (abriu o baú do dia, plantou algo
// demorado) e nunca na 1ª abertura. No máximo 2 avisos agendados: o baú de
// amanhã e a colheita mais demorada. No navegador, tudo aqui é inofensivo.
import { Settings } from "./Settings.js";
import { isNative } from "./Platform.js";
import { News } from "./News.js";
import { NotifyAccess, CHANNEL } from "./NotifyAccess.js";
import { Analytics } from "./Analytics.js";

const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;
export const NOTIFY_ID = { chest: 1, crop: 2 };

export const Notify = {
  available: () => isNative() && !!plugin(),
  // Ligado de verdade: o jogador aceitou E o Android deixa mostrar (NotifyAccess)
  enabled: () => Settings.get("notify") === true && NotifyAccess.allowed(CHANNEL.reminders) !== false,
  asked: () => Settings.get("notifyAsked") === true,
  blocked: () => NotifyAccess.blocked(CHANNEL.reminders),

  // Chamar 1x no boot, antes do News.install: confere o que o Android deixa. Quem tinha aceitado e perdeu a
  // permissão (reinstalou e o backup do Android trouxe a escolha sem ela; o Android tira de app parado há
  // meses) volta a ver o pedido UMA vez, no próximo momento que faz sentido (baú, horta). Canal desligado no
  // sistema foi escolha do jogador: esse não pergunta de novo.
  async install() {
    if (!this.available()) return;
    await NotifyAccess.install();
    const perm = NotifyAccess.state?.perm;
    if (Settings.get("notify") === true && perm && perm !== "granted") {
      Settings.set("notify", false);
      Settings.set("notifyAsked", false);
      Analytics.track("notify_lost", { perm });
    }
  },

  // Pede a permissão do sistema (ou abre as configurações, se o Android não mostra mais o pedido); guarda que
  // já perguntamos (não insiste)
  async enable() {
    Settings.set("notifyAsked", true);
    if (!plugin()) return false;
    const ok = await NotifyAccess.request(CHANNEL.reminders);
    Settings.set("notify", ok);
    if (ok) News.sync(); // o pedido também conta das novidades (sem escolha própria, elas seguem os avisos)
    return ok;
  },
  disable() {
    Settings.set("notify", false);
    plugin()?.cancel?.({ notifications: Object.values(NOTIFY_ID).map((id) => ({ id })) }).catch?.(() => {});
    return News.sync(); // sem escolha própria, as novidades seguem os avisos e desligam junto
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
