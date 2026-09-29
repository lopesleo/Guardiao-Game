// Registro de eventos do jogo (partidas, níveis, anúncios, compras…).
// Hoje: guarda os últimos eventos em memória e mostra no console com ?debug=1.
// No M5 (Firebase), só este arquivo muda — o resto do jogo continua chamando
// Analytics.track(nome, dados).
import { DEBUG } from "./Platform.js";

const MAX = 200;
const buffer = [];
let sink = null; // função externa (ex.: Firebase) plugada depois

export const Analytics = {
  track(name, params = {}) {
    const ev = { name, t: Date.now(), ...params };
    buffer.push(ev);
    if (buffer.length > MAX) buffer.shift();
    if (DEBUG) console.debug("[analytics]", name, params);
    try {
      sink?.(name, params);
    } catch {}
  },
  // Plugado no M5: Analytics.setSink((name, params) => FirebaseAnalytics.logEvent(...))
  setSink(fn) {
    sink = fn;
  },
  recent() {
    return buffer.slice();
  },
};

// Acessível no console para inspeção durante testes
window.guardiaoAnalytics = Analytics;
