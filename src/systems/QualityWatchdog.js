// Qualidade gráfica automática: se o aparelho não sustenta a taxa de quadros
// no começo da partida, desliga a iluminação dinâmica (o efeito mais caro).
// Decide UMA vez por aparelho — depois disso a escolha fica com o jogador
// (Opções → Iluminação), e o watchdog nunca mais mexe.
import { Settings } from "./Settings.js";
import { Analytics } from "./Analytics.js";

const WARMUP_MS = 4000; // ignora o começo (compilação de shaders, GC)
const WINDOW_MS = 8000; // janela de medição
const MIN_FPS = 42; // média abaixo disso = aparelho fraco

export class QualityWatchdog {
  constructor(scene, onDowngrade) {
    this.scene = scene;
    this.onDowngrade = onDowngrade;
    this.active = !Settings.get("qualityChecked") && Settings.get("lighting") !== false;
    this.elapsed = 0;
    this.frames = 0;
    this.measured = 0;
  }

  // dt real em ms (não o escalado pela câmera lenta)
  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed < WARMUP_MS) return;
    this.frames++;
    this.measured += dt;
    if (this.measured < WINDOW_MS) return;
    this.active = false;
    const fps = (this.frames * 1000) / this.measured;
    Settings.set("qualityChecked", true);
    const low = fps < MIN_FPS;
    Analytics.track("quality_auto", { fps: Math.round(fps), low });
    if (low) {
      Settings.set("lighting", false);
      this.onDowngrade?.(fps);
    }
  }

  // Pausas/menus param a medição (o loop fica ocioso e distorceria a média)
  reset() {
    this.frames = 0;
    this.measured = 0;
  }
}
