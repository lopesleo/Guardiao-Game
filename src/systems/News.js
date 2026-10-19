// Novidades do jogo por notificação (Firebase Cloud Messaging; só no app Android): versão nova, evento (Dia do
// Saci), algo novo na Clareira. Opcional e à parte dos lembretes (Notify.js): chave própria em Opções e canal
// próprio no Android ("Novidades"), que o jogador também desliga pelo sistema. O aparelho só se inscreve no tópico
// do seu idioma (novidades_pt, novidades_en…) e só depois que o jogador aceitou; sem isso nem pede o token
// (firebase_messaging_auto_init_enabled = false no AndroidManifest). Quem envia é o tools/play-aviso.mjs, poucas
// vezes por mês; com o jogo aberto a notificação não aparece (nunca no meio da partida).
import { Settings } from "./Settings.js";
import { isNative } from "./Platform.js";
import { Analytics } from "./Analytics.js";
import { lang, tr } from "../i18n/i18n.js";

const plugin = () => window.Capacitor?.Plugins?.FirebaseMessaging;
export const NEWS_CHANNEL = "novidades";
export const newsTopic = (id = lang) => `novidades_${id}`;

export const News = {
  available: () => isNative() && !!plugin(),
  // Sem escolha feita, segue os avisos (o pedido de avisos já conta das novidades)
  enabled: () => Settings.get("news") ?? Settings.get("notify") === true,

  // Chave em Opções: ligar pede a permissão do sistema (se ainda não houver)
  async setEnabled(on) {
    if (on) {
      try {
        const r = await plugin()?.requestPermissions?.();
        if (r?.receive !== "granted") on = false;
      } catch {
        on = false;
      }
    }
    Settings.set("news", !!on);
    await this.sync();
    return !!on;
  },

  // Chamar 1x no boot: canal com o nome no idioma do jogo, o toque na notificação e o tópico certo (trocar de
  // idioma recarrega o jogo, então o boot também troca o tópico)
  async install() {
    if (!this.available()) return;
    const p = plugin();
    p.createChannel?.({ id: NEWS_CHANNEL, name: tr("Novidades"), description: tr("Versões novas e eventos do jogo"), importance: 3 })?.catch?.(() => {});
    p.addListener?.("notificationActionPerformed", (e) => Analytics.track("news_open", { id: String(e?.notification?.data?.id ?? "") }))?.catch?.(() => {});
    await this.sync();
  },

  // Deixa o aparelho inscrito só no tópico do idioma atual, ou em nenhum (e sem token) se estiver desligado
  async sync() {
    const p = plugin();
    if (!p) return;
    const want = this.enabled() ? newsTopic() : null,
      had = Settings.get("newsTopic");
    try {
      if (had && had !== want) await p.unsubscribeFromTopic({ topic: had });
      if (want) {
        await p.getToken();
        await p.subscribeToTopic({ topic: want }); // idempotente: refaz a cada abertura
      } else if (had) await p.deleteToken();
      Settings.set("newsTopic", want);
    } catch {}
  },
};
