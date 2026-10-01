// Firebase Analytics + Crashlytics — só no app Android (plugins do Capacitor).
// Pega o Analytics.track() que o jogo inteiro já usa e repassa ao Firebase; no navegador não faz
// nada. O jogador pode desligar em Opções ("Dados de uso e erros"): a coleta para na hora.
// ANTES DE PUBLICAR: ligar o formulário de consentimento (UMP, do AdMob) para o EEE/Reino Unido/
// Suíça e chamar Telemetry.setEnabled(false) quando o jogador de lá recusar.
import { Analytics } from "./Analytics.js";
import { Settings } from "./Settings.js";
import { isNative } from "./Platform.js";

const analytics = () => window.Capacitor?.Plugins?.FirebaseAnalytics;
const crash = () => window.Capacitor?.Plugins?.FirebaseCrashlytics;

// Nome de evento/parâmetro no Firebase: letras, números e _, até 40 caracteres
const clean = (n) => String(n).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40);

// Só valores simples (número, texto curto, sim/não); "at" é o horário local, o Firebase já tem o dele
function cleanParams(p = {}) {
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (k === "at" || n >= 25) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[clean(k)] = Math.round(v * 100) / 100;
    else if (typeof v === "string") out[clean(k)] = v.slice(0, 100);
    else if (typeof v === "boolean") out[clean(k)] = v ? 1 : 0;
    else continue;
    n++;
  }
  return out;
}

export const Telemetry = {
  available: () => isNative() && !!analytics(),
  enabled: () => Settings.get("telemetry") !== false,

  // Liga/desliga a coleta (jogador em Opções, ou recusa no formulário de consentimento)
  setEnabled(on) {
    Settings.set("telemetry", !!on);
    this._apply();
  },
  _apply() {
    const enabled = this.enabled();
    analytics()?.setEnabled?.({ enabled })?.catch?.(() => {});
    crash()?.setEnabled?.({ enabled })?.catch?.(() => {});
  },

  // Chamar 1x no boot (depois do setupPlatform)
  install() {
    if (!this.available()) return;
    this._apply();
    Analytics.setSink((name, params) => {
      if (!this.enabled()) return;
      analytics()?.logEvent?.({ name: clean(name), params: cleanParams(params) })?.catch?.(() => {});
    });
    // Erros de JavaScript viram "não fatais" no Crashlytics (a WebView esconde do relatório nativo)
    const report = (msg) => {
      if (this.enabled()) crash()?.recordException?.({ message: String(msg).slice(0, 500) })?.catch?.(() => {});
    };
    window.addEventListener("error", (e) => report(`${e.message} @ ${e.filename?.split("/").pop() ?? "?"}:${e.lineno ?? 0}`));
    window.addEventListener("unhandledrejection", (e) => report(`promise: ${e.reason?.message ?? e.reason}`));
  },
};
