// Segunda chance: overlay sobre a GameScene quando o jogador cai.
// Oferta OPCIONAL (anúncio premiado), 1× por partida, com contagem regressiva —
// sem resposta, a partida termina normalmente. Só aparece se AdService.enabled.
import { ADS } from "../config.js";
import { CSS } from "../art/Palette.js";
import { text, dim, Button, vw, vh, fitCamera, haptic, drawFrame } from "../ui/Theme.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";

export class ReviveScene extends Phaser.Scene {
  constructor() {
    super("ReviveScene");
  }

  create() {
    const W = vw(this),
      H = vh(this);
    fitCamera(this);
    this.gs = this.scene.get("GameScene");
    this._busy = false;
    this._done = false;
    dim(this, 0.78);
    Analytics.track("ad_offer_show", { placement: "revive" });

    const cy = H / 2 - 40;
    const pg = this.add.graphics();
    drawFrame(pg, W / 2 - 300, cy - 206, 600, 486, "danger", { alpha: 0.96 });
    text(this, W / 2, cy - 150, "VOCÊ CAIU…", { size: 64, color: CSS.redHi, origin: 0.5, stroke: true, strokeW: 8 });
    text(this, W / 2, cy - 92, "A floresta ainda precisa de você.", { size: 22, color: CSS.muted, origin: 0.5 });

    this.heart = this.add.image(W / 2, cy - 10, "ico_heart").setScale(6);
    this.tweens.add({ targets: this.heart, scale: 6.6, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.countText = text(this, W / 2, cy + 58, "", { size: 30, color: CSS.goldHi, origin: 0.5, stroke: true });

    this.reviveBtn = new Button(this, W / 2, cy + 130, 420, 72, "REVIVER", () => this._revive(), {
      size: 30,
      style: "primary",
      color: CSS.goldHi,
      icon: "ico_play",
      iconScale: 3,
    });
    text(this, W / 2, cy + 184, `Assista a um anúncio e volte com ${Math.round(ADS.REVIVE_HP_PCT * 100)}% da vida`, {
      size: 17,
      color: CSS.dim,
      origin: 0.5,
    });
    this.giveUpBtn = new Button(this, W / 2, cy + 240, 300, 52, "ENCERRAR PARTIDA", () => this._decline(), { size: 20, style: "dark" });

    this.remaining = ADS.REVIVE_OFFER_S;
    this._tick();
    this.timer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this._tick(true) });
    this.input.keyboard.on("keydown-ENTER", () => this._revive());
    this.input.keyboard.on("keydown-ESC", () => this._decline());
    haptic(60);
  }

  onBack() {
    this._decline();
    return true;
  }

  _tick(dec = false) {
    if (this._busy) return;
    if (dec) this.remaining--;
    if (this.remaining <= 0) return this._decline();
    this.countText.setText(String(this.remaining));
    if (dec) this.sound.play("sfx_ui_hover", { volume: 0.25, rate: 0.8 });
  }

  async _revive() {
    if (this._busy || this._done) return;
    this._busy = true;
    this.reviveBtn.setEnabled(false);
    this.giveUpBtn.setEnabled(false);
    const ok = await AdService.rewarded("revive");
    if (this._done) return;
    if (!ok) {
      // Anúncio indisponível/cancelado: não pune — volta a oferta com o tempo que restava
      this._busy = false;
      this.reviveBtn.setEnabled(AdService.canShow("revive"));
      this.giveUpBtn.setEnabled(true);
      this.countText.setText("Anúncio indisponível agora");
      return;
    }
    this._done = true;
    this.scene.stop();
    this.gs.scene.resume();
    this.gs._revive();
  }

  _decline() {
    if (this._done || this._busy) return;
    this._done = true;
    Analytics.track("ad_offer_decline", { placement: "revive" });
    this.scene.stop();
    this.gs.scene.resume();
    this.gs._onGameOver(false, false, true);
  }
}
