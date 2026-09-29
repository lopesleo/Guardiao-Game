// Integração com a plataforma (navegador / app Android via Capacitor):
//   · pausa a partida quando o app vai pro fundo (ligação, trocar de app)
//   · botão VOLTAR do Android: cada cena pode definir onBack() → true se tratou
//   · debug só com ?debug=1 na URL (nunca no build da loja)
import { installSettingsHooks } from "./Settings.js";

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const DEBUG = /[?&]debug=1\b/.test(location.search);

export function setupPlatform(game) {
  installSettingsHooks(game);

  const pauseRun = () => {
    const gs = game.scene.getScene("GameScene");
    if (gs && game.scene.isActive("GameScene") && !gs.gameOver) gs.pauseGame?.();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseRun();
  });
  window.addEventListener("blur", pauseRun);

  // Voltar: a cena ativa mais ao topo decide (modal aberto fecha, jogo pausa…)
  const back = () => {
    const scenes = game.scene.getScenes(true).slice().reverse();
    for (const s of scenes) if (s.onBack?.()) return true;
    return false;
  };
  window.guardiaoBack = back;
  const App = window.Capacitor?.Plugins?.App;
  if (App?.addListener) {
    App.addListener("backButton", () => {
      if (!back()) App.exitApp?.();
    });
  }
  // App nativo: tela cheia imersiva e sem barra de status
  window.Capacitor?.Plugins?.StatusBar?.hide?.().catch?.(() => {});
}
