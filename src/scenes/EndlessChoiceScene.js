// Vitória sobre o Ancião: encerrar com a vitória garantida ou seguir na
// Noite Eterna (Modo Infinito) — inimigos cada vez mais fortes, recorde próprio.
// A vitória já conta nos dois casos; continuar só acrescenta.
import { ENDLESS } from "../config.js";
import { CSS, PAL, hex } from "../art/Palette.js";
import { text, dim, Button, vw, vh, fitCamera, haptic } from "../ui/Theme.js";
import { formatTime } from "../utils.js";
import { Analytics } from "../systems/Analytics.js";

export class EndlessChoiceScene extends Phaser.Scene {
  constructor() {
    super("EndlessChoiceScene");
  }

  create() {
    const W = vw(this),
      H = vh(this);
    fitCamera(this);
    this.gs = this.scene.get("GameScene");
    this._done = false;
    dim(this, 0.8);

    const cy = H / 2 - 30;
    const t = text(this, W / 2, cy - 170, "VITÓRIA!", { size: 80, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 10, shadowY: 6 });
    t.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 420, ease: "Back.easeOut" });
    text(this, W / 2, cy - 108, "O Ancião caiu. Mas a Podridão não dorme…", { size: 24, color: CSS.muted, origin: 0.5 });

    const best = this.gs.meta.data.bestEndlessSeconds || 0;
    const info = [
      `Na Noite Eterna os inimigos ficam ${Math.round(ENDLESS.HP_GROWTH_PER_MIN * 100)}% mais fortes a cada minuto.`,
      `Cada minuto de pé vale +${ENDLESS.COINS_PER_MIN} moedas. A vitória já está garantida.`,
      best > 0 ? `Seu recorde: ${formatTime(best * 1000)}` : "Quanto tempo você aguenta?",
    ];
    text(this, W / 2, cy - 40, info.join("\n"), { size: 19, color: CSS.txt, origin: 0.5, align: "center", lineSpacing: 8, wrap: Math.min(760, W - 60) });

    new Button(this, W / 2, cy + 70, 460, 72, "ENFRENTAR A NOITE ETERNA", () => this._choose(true), {
      size: 26,
      style: "purple",
      color: hex(PAL.pur3),
    });
    new Button(this, W / 2, cy + 156, 380, 60, "ENCERRAR COM A VITÓRIA", () => this._choose(false), {
      size: 22,
      style: "primary",
      color: CSS.goldHi,
    });
    this.input.keyboard.on("keydown-ENTER", () => this._choose(false));
    this.input.keyboard.on("keydown-ESC", () => this._choose(false));
    this.sound.play("sfx_chest_jackpot", { volume: 0.7 });
    haptic(80);
  }

  onBack() {
    this._choose(false);
    return true;
  }

  _choose(endless) {
    if (this._done) return;
    this._done = true;
    Analytics.track("endless_choice", { endless });
    this.scene.stop();
    this.gs.scene.resume();
    if (endless) this.gs._startEndless();
    else this.gs._onGameOver(true);
  }
}
