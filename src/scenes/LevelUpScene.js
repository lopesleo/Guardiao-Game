// Level-up: pausa a GameScene e oferece 3 cartas (clique/toque ou teclas 1-2-3).
// Troca de cartas (R) 1× por level-up. D24: ESC desabilitado aqui.
import { createCard } from "../ui/Cards.js";
import { text, dim, Button, vw, vh, fitCamera } from "../ui/Theme.js";
import { CSS } from "../art/Palette.js";

export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super("LevelUpScene");
  }

  create(data) {
    fitCamera(this);
    this.cards = data.cards;
    this.player = data.player;
    this.gameScene = data.gameScene;
    this._cardObjs = [];
    this.rerollsLeft = 1;
    this._locked = false;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const W = vw(this),
      H = vh(this);

    const bg = dim(this, 0.0);
    this.tweens.add({ targets: bg, fillAlpha: 0.72, duration: 200 });

    // Título com raios de luz girando atrás
    const rays = this.add.image(W / 2, 64, "fx_glow").setScale(6, 2).setTint(0xf2c14e).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: rays, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
    const title = text(this, W / 2, 58, `NÍVEL ${this.player.level}!`, { size: 44, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 7 });
    title.setScale(0.5);
    this.tweens.add({ targets: title, scale: 1, duration: 260, ease: "Back.easeOut" });
    text(this, W / 2, 102, "Escolha uma bênção da floresta", { size: 18, color: CSS.muted, origin: 0.5 });

    this._renderCards(true);
    this._buildReroll();

    this.input.keyboard.on("keydown-ONE", () => this._pick(0));
    this.input.keyboard.on("keydown-TWO", () => this._pick(1));
    this.input.keyboard.on("keydown-THREE", () => this._pick(2));
    this.input.keyboard.on("keydown-R", () => this._reroll());
  }

  _renderCards(animate) {
    this._cardObjs.forEach((c) => c.destroy());
    this._cardObjs = [];
    const W = vw(this),
      H = vh(this);
    const n = this.cards.length;
    const gap = 24;
    const cw = Math.min(300, Math.floor((W - 80 - gap * (n - 1)) / n));
    const ch = 450;
    const totalW = cw * n + gap * (n - 1);
    const startX = (W - totalW) / 2 + cw / 2;
    const y = H / 2 + 38;
    for (let i = 0; i < n; i++) {
      const x = startX + i * (cw + gap);
      const obj = createCard(this, x, y, cw, ch, this.cards[i], (card, cont) => this._choose(card, cont), i, !this.isTouch);
      if (animate) {
        obj.y = y + 60;
        obj.setAlpha(0);
        this.tweens.add({ targets: obj, y, alpha: 1, delay: 80 + i * 90, duration: 280, ease: "Back.easeOut" });
      }
      this._cardObjs.push(obj);
    }
  }

  _buildReroll() {
    const W = vw(this),
      H = vh(this);
    this.rerollBtn = new Button(this, W / 2, H - 34, 280, 44, "", () => this._reroll(), { size: 17, style: "ice" });
    this._refreshReroll();
  }

  _refreshReroll() {
    const left = this.rerollsLeft || 0;
    const key = this.isTouch ? "" : " [R]";
    if (left > 0) this.rerollBtn.setLabel(`TROCAR CARTAS${key}`).setEnabled(true);
    else this.rerollBtn.setLabel("Sem trocas").setEnabled(false);
  }

  _reroll() {
    if (this._locked || (this.rerollsLeft || 0) <= 0) return;
    this.rerollsLeft -= 1;
    this.cards = this.gameScene.upgrades.generateCards(this.player);
    this._renderCards(true);
    this._refreshReroll();
  }

  _pick(i) {
    if (i < this.cards.length) this._choose(this.cards[i], this._cardObjs[i]);
  }

  // Confirma: carta escolhida pulsa, as outras somem, e a cena volta
  _choose(card, cont) {
    if (this._locked) return;
    this._locked = true;
    this.sound.play("sfx_ui_click", { volume: 0.5 });
    this._cardObjs.forEach((c) => {
      if (c === cont) this.tweens.add({ targets: c, scale: 1.08, duration: 120, yoyo: true });
      else this.tweens.add({ targets: c, alpha: 0, y: c.y + 30, duration: 160 });
    });
    this.time.delayedCall(260, () => {
      this.gameScene.upgrades.apply(card, this.player);
      this.scene.resume("GameScene");
      this.scene.stop();
    });
  }
}
