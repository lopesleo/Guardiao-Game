// Level-up: pausa a GameScene e oferece 3 cartas (clique/toque ou teclas 1-2-3).
// Troca de cartas (R) 1× por level-up. D24: ESC desabilitado aqui.
// "Mais uma carta" (anúncio premiado, 1× por partida) revela uma 4ª opção.
import { createCard } from "../ui/Cards.js";
import { text, dim, Button, vw, vh, fitCamera } from "../ui/Theme.js";
import { CSS } from "../art/Palette.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";

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
    this._banishMode = false;
    this._locked = false;
    this._extraBusy = false;
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
    this.input.keyboard.on("keydown-FOUR", () => this._pick(3));
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
    const offer = AdService.canShow("extra_card");
    // 2 botões (trocar, banir) ou 3 (com "mais uma carta" por anúncio), centralizados
    this._btnXs = offer ? [W / 2 - 320, W / 2, W / 2 + 320] : [W / 2 - 150, W / 2 + 150];
    this.rerollBtn = new Button(this, this._btnXs[0], H - 34, 280, 44, "", () => this._reroll(), { size: 17, style: "ice" });
    this._refreshReroll();
    this.banishBtn = new Button(this, this._btnXs[1], H - 34, 280, 44, "", () => this._toggleBanish(), { size: 17, style: "danger" });
    this.banishHint = text(this, W / 2, H - 78, "", { size: 18, color: CSS.redHi, origin: 0.5, stroke: true });
    this._refreshBanish();
    this.input.keyboard.on("keydown-B", () => this._toggleBanish());
    if (offer) {
      Analytics.track("ad_offer_show", { placement: "extra_card" });
      this.extraBtn = new Button(this, this._btnXs[2], H - 34, 280, 44, "MAIS UMA CARTA", () => this._extraCard(), {
        size: 17,
        style: "primary",
        color: CSS.goldHi,
        icon: "ico_play",
        iconScale: 2,
      });
    }
  }

  // Anúncio premiado → revela uma 4ª carta (as 3 atuais continuam)
  async _extraCard() {
    if (this._locked || this._extraBusy || this.cards.length >= 4) return;
    this._extraBusy = true;
    this.extraBtn.setEnabled(false);
    const ok = await AdService.rewarded("extra_card");
    this._extraBusy = false;
    if (!ok || this._locked) {
      this.extraBtn?.setEnabled(!this._locked && AdService.canShow("extra_card"));
      return;
    }
    const c = this.gameScene.upgrades.extraCard(this.player, this.cards);
    this.extraBtn.destroy();
    this.extraBtn = null;
    this._btnXs = [vw(this) / 2 - 150, vw(this) / 2 + 150];
    this.rerollBtn.x = this._btnXs[0];
    this.banishBtn.x = this._btnXs[1];
    if (!c) return;
    this.cards = [...this.cards, c];
    this._renderCards(false);
    const last = this._cardObjs[3];
    last.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: last, scale: 1, alpha: 1, duration: 320, ease: "Back.easeOut" });
    this.sound.play("sfx_chest_jackpot", { volume: 0.5 });
  }

  _refreshReroll() {
    const left = this.rerollsLeft || 0;
    const key = this.isTouch ? "" : " [R]";
    if (left > 0) this.rerollBtn.setLabel(`TROCAR CARTAS${key}`).setEnabled(true);
    else this.rerollBtn.setLabel("Sem trocas").setEnabled(false);
  }

  _refreshBanish() {
    const left = this.gameScene.upgrades.banishLeft;
    const key = this.isTouch ? "" : " [B]";
    if (this._banishMode) this.banishBtn.setLabel("CANCELAR").setEnabled(true);
    else if (left > 0) this.banishBtn.setLabel(`BANIR (${left})${key}`).setEnabled(true);
    else this.banishBtn.setLabel("Sem banimentos").setEnabled(false);
    this.banishHint.setText(this._banishMode ? "Toque na carta que NÃO quer mais ver nesta partida" : "");
  }

  _toggleBanish() {
    if (this._locked || (!this._banishMode && this.gameScene.upgrades.banishLeft <= 0)) return;
    this._banishMode = !this._banishMode;
    this.sound.play("sfx_ui_click", { volume: 0.4 });
    // Cartas balançam no modo banir: o que vai acontecer fica evidente
    this._cardObjs.forEach((c) => {
      this.tweens.killTweensOf(c);
      c.angle = 0;
      if (this._banishMode) this.tweens.add({ targets: c, angle: { from: -1.2, to: 1.2 }, duration: 110, yoyo: true, repeat: -1 });
    });
    this._refreshBanish();
  }

  // Banir: a carta some e uma nova ocupa o lugar. Sai do modo ao concluir.
  _banish(card, cont) {
    const up = this.gameScene.upgrades;
    if (!up.banish(card)) return;
    Analytics.track("card_banish", { id: up.cardId(card), level: this.player.level });
    this._banishMode = false;
    const i = this._cardObjs.indexOf(cont);
    const fresh = up.replacement(this.player, this.cards);
    this.sound.play("sfx_death", { volume: 0.4, rate: 0.8 });
    const next = fresh ? this.cards.map((c, k) => (k === i ? fresh : c)) : this.cards.filter((_, k) => k !== i);
    if (next.length) this.cards = next; // mesa nunca fica vazia
    this._renderCards(true);
    this._refreshBanish();
    this._refreshReroll();
  }

  _reroll() {
    if (this._locked || (this.rerollsLeft || 0) <= 0) return;
    this.rerollsLeft -= 1;
    this._banishMode = false;
    this._refreshBanish();
    const extra = this.cards.length > 3; // a 4ª carta paga continua valendo na troca
    this.cards = this.gameScene.upgrades.generateCards(this.player);
    if (extra) {
      const c = this.gameScene.upgrades.extraCard(this.player, this.cards);
      if (c) this.cards.push(c);
    }
    this._renderCards(true);
    this._refreshReroll();
  }

  _pick(i) {
    if (i < this.cards.length) this._choose(this.cards[i], this._cardObjs[i]);
  }

  // Confirma: carta escolhida pulsa, as outras somem, e a cena volta
  _choose(card, cont) {
    if (this._locked) return;
    if (this._banishMode) return this._banish(card, cont);
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
