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
  // Som: suspende o áudio inteiro em segundo plano e retoma ao voltar
  // (a WebView do Android nem sempre dispara o blur que o Phaser escuta)
  const audioCtx = () => game.sound?.context;
  const setBackground = (bg) => {
    if (bg) pauseRun();
    const ctx = audioCtx();
    if (!ctx) return game.sound?.[bg ? "pauseAll" : "resumeAll"]?.();
    if (bg && ctx.state === "running") ctx.suspend().catch(() => {});
    if (!bg && ctx.state === "suspended" && !game.sound.locked) ctx.resume().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => setBackground(document.hidden));
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
    App.addListener("appStateChange", ({ isActive }) => setBackground(!isActive));
    App.addListener("backButton", () => {
      if (!back()) App.exitApp?.();
    });
  }
  // App nativo: tela cheia imersiva e sem barra de status
  window.Capacitor?.Plugins?.StatusBar?.hide?.().catch?.(() => {});
}
