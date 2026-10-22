// Level-up: pausa a GameScene e oferece 3 cartas (clique/toque ou teclas 1-2-3).
// Troca de cartas (R) 1× por level-up. D24: ESC desabilitado aqui.
// "Mais uma carta" (anúncio premiado, 1× por partida) revela uma 4ª opção.
// Banir: 1 grátis por partida; acabou, o botão oferece +1 por anúncio (1× por partida).
// A mesa NASCE do herói: um estouro de luz no lugar dele (por cima da partida escurecida) e as cartas voam
// dali até os lugares delas; a escolhida volta voando para o herói e a partida acende um anel nele
// (GameFeel.cardLanded). Antecipação → impacto → continuação, ligando o mundo à escolha (FEEL.LEVEL).
import { createCard } from "../ui/Cards.js";
import { text, dim, Button, vw, vh, fitCamera, drawFrame } from "../ui/Theme.js";
import { CSS, PAL } from "../art/Palette.js";
import { Pix, bayer } from "../art/PixelArt.js";
import { FEEL } from "../config.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { tr } from "../i18n/i18n.js";

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const TRAIL_N = 24; // brilhos do rastro das cartas (reaproveitados)

// Texturas do estouro (geradas uma vez, em pixel de arte: desenhadas na escala 3 do jogo)
function levelTextures(scene) {
  if (scene.textures.exists("fx_lvl_ring")) return;
  // Anel fino de raio 50 com brilho pontilhado por dentro
  const R = 50,
    S = R * 2 + 3,
    c = S / 2;
  const rg = new Pix(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d <= R + 0.5 && d >= R - 0.6) rg.set(x, y, PAL.white);
      else if (d < R - 0.6 && d >= R - 3 && bayer(x, y) < 0.55 - (R - 0.6 - d) * 0.18) rg.set(x, y, 0xd8d8d8);
    }
  rg.register(scene, "fx_lvl_ring");
  // Raios de luz: 8 traços finos (longos e curtos alternados) saindo de um miolo
  const RS = 41,
    rc = (RS - 1) / 2;
  const ry = new Pix(RS, RS);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2,
      len = k % 2 ? 11 : 19;
    for (let r = 3; r <= len; r += 0.5) ry.set(rc + Math.cos(a) * r, rc + Math.sin(a) * r, r > len - 4 ? 0xd8d8d8 : PAL.white);
  }
  ry.disc(rc + 0.5, rc + 0.5, 2.6, PAL.white);
  ry.register(scene, "fx_lvl_rays");
}

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
    this._banishMode = false;
    this._locked = false;
    this._extraBusy = false;
    // O Phaser REAPROVEITA a cena a cada nível: os botões da visita anterior (já
    // destruídos) não podem emprestar posição — o BANIR nascia no x antigo (layout de
    // 2 botões) e encavalava no "MAIS UMA CARTA" quando ele aparecia
    this.banishBtn = null;
    this.extraBtn = null;
    this.rerollBtn = null;
    this._banishAd = false;
    this._rerollAd = false;
    this._adBusy = false;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const W = vw(this),
      H = vh(this);

    const bg = dim(this, 0.0);
    this.tweens.add({ targets: bg, fillAlpha: 0.72, duration: 200 });
    // De onde a mesa nasce: o herói (sem ele, o pé da tela)
    this.from = data.from ?? { x: W / 2, y: H * 0.8 };
    levelTextures(this);
    this._trail = [];
    this._burst(this.from.x, this.from.y);

    // Placa do título: fundo próprio sobre o HUD congelado (relógio/chefe atrás)
    const plaque = this.add.graphics();
    drawFrame(plaque, W / 2 - 250, 20, 500, 104, "gold", { alpha: 0.97 });
    plaque.setAlpha(0);
    this.tweens.add({ targets: plaque, alpha: 1, duration: 160 });
    // Título com raios de luz girando atrás
    const rays = this.add.image(W / 2, 64, "fx_glow").setScale(6, 2).setTint(0xf2c14e).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: rays, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
    const title = text(this, W / 2, 60, tr("NÍVEL {0}!", this.player.level), { size: 44, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 7 });
    title.setScale(0.5);
    this.tweens.add({ targets: title, scale: 1, duration: 260, ease: "Back.easeOut" });
    text(this, W / 2, 102, tr("Escolha uma bênção da floresta"), { size: 18, color: CSS.muted, origin: 0.5 });

    this._renderCards("hero");
    this._buildReroll();

    this.input.keyboard.on("keydown-ONE", () => this._pick(0));
    this.input.keyboard.on("keydown-TWO", () => this._pick(1));
    this.input.keyboard.on("keydown-THREE", () => this._pick(2));
    this.input.keyboard.on("keydown-FOUR", () => this._pick(3));
    this.input.keyboard.on("keydown-R", () => this._reroll());
  }

  // Posição das cartas na mesa (n cartas centralizadas)
  _layout(n) {
    const W = vw(this),
      H = vh(this);
    const gap = 24;
    const cw = Math.min(300, Math.floor((W - 80 - gap * (n - 1)) / n));
    const totalW = cw * n + gap * (n - 1);
    const startX = (W - totalW) / 2 + cw / 2;
    return { cw, ch: 450, y: H / 2 + 38, x: (i) => startX + i * (cw + gap) };
  }

  _makeCard(i) {
    const L = this._layout(this.cards.length);
    // acima do rastro dos voos (profundidade 1)
    return createCard(this, L.x(i), L.y, L.cw, L.ch, this.cards[i], (card, cont) => this._choose(card, cont), i, !this.isTouch).setDepth(2);
  }

  // animate: "hero" = as cartas voam do herói (abertura da mesa); true = sobem do pé (troca, banir)
  _renderCards(animate) {
    this._cardObjs.forEach((c) => c.destroy());
    this._cardObjs = [];
    const { y } = this._layout(this.cards.length);
    const n = this.cards.length;
    for (let i = 0; i < n; i++) {
      const obj = this._makeCard(i);
      if (animate === "hero") this._flyIn(obj, i, n);
      else if (animate) {
        obj.y = y + 60;
        obj.setAlpha(0);
        this.tweens.add({ targets: obj, y, alpha: 1, delay: 80 + i * 90, duration: 280, ease: "Back.easeOut" });
      }
      this._cardObjs.push(obj);
    }
  }

  // Voo de uma carta do herói até o lugar dela: posição em ease-out, escala com um leve passar do ponto, giro
  // que se desfaz e um rastro dourado; ao pousar, um toque de som (canal da interface: a partida está abafada)
  _flyIn(obj, i, n) {
    const L = FEEL.LEVEL;
    const x1 = obj.x,
      y1 = obj.y,
      x0 = this.from.x,
      y0 = this.from.y;
    const a0 = (i - (n - 1) / 2) * -16;
    obj.setPosition(x0, y0).setScale(0.12).setAngle(a0).setAlpha(0);
    let lastTrail = 0;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: 70 + i * L.STAGGER_MS,
      duration: L.FLY_MS,
      onUpdate: (tw) => {
        if (!obj.active || this._locked) return; // escolheu no meio do voo: a escolha manda
        const u = tw.getValue();
        const e = easeOutCubic(u);
        obj.setPosition(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e);
        obj.setScale(0.12 + 0.88 * easeOutBack(u));
        obj.setAngle(a0 * (1 - e));
        obj.setAlpha(Math.min(1, u / 0.25));
        if (u < 0.8 && tw.elapsed - lastTrail > 28) {
          lastTrail = tw.elapsed;
          this._spark(obj.x, obj.y + (Math.random() - 0.5) * 40 * obj.scaleY);
        }
      },
      onComplete: () => {
        if (!obj.active || this._locked) return;
        obj.setPosition(x1, y1).setScale(1).setAngle(0).setAlpha(1);
        this.sound.play("sfx_ui_card", { volume: 0.35, rate: 1 + i * 0.07 });
      },
    });
  }

  // Brilho do rastro (imagens reaproveitadas, por cima da mesa e por baixo das cartas)
  _spark(x, y) {
    let s = this._trail.find((o) => !o.visible);
    if (!s) {
      if (this._trail.length >= TRAIL_N) return;
      s = this.add.image(0, 0, "px_dot2").setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      this._trail.push(s);
    }
    s.setPosition(x, y).setScale(3).setAlpha(0.9).setTint(Math.random() < 0.5 ? PAL.yel3 : PAL.white).setVisible(true);
    this.tweens.add({ targets: s, scale: 1, alpha: 0, y: y - 10, duration: 260, ease: "Quad.easeOut", onComplete: () => s.setVisible(false) });
  }

  // Estouro de luz no herói, por cima da partida escurecida: clarão, raios girando, anel que abre e
  // fagulhas. Dura FEEL.LEVEL.BURST_MS e some sozinho
  _burst(x, y) {
    const L = FEEL.LEVEL;
    const ms = L.BURST_MS;
    const ADD = Phaser.BlendModes.ADD;
    const glow = this.add.image(x, y, "fx_glow").setTint(PAL.yel3).setBlendMode(ADD).setScale(0.6).setAlpha(0.95);
    this.tweens.add({ targets: glow, scale: 3.4, alpha: 0, duration: ms, ease: "Cubic.easeOut", onComplete: () => glow.destroy() });
    const disc = this.add.image(x, y, "fx_disc").setTint(PAL.white).setScale(1.4);
    this.tweens.add({ targets: disc, scale: 4.5, alpha: 0, duration: 150, ease: "Quad.easeOut", onComplete: () => disc.destroy() });
    const rays = this.add.image(x, y, "fx_lvl_rays").setTint(PAL.yel3).setScale(1.5).setAlpha(1);
    this.tweens.add({ targets: rays, scale: 5.5, rotation: 0.55, alpha: 0, duration: ms * 0.9, ease: "Cubic.easeOut", onComplete: () => rays.destroy() });
    const ring = this.add.image(x, y, "fx_lvl_ring").setTint(PAL.yel2).setScale(0.5).setAlpha(1);
    this.tweens.add({ targets: ring, scale: (L.RING_R / 50) * 1, alpha: 0, duration: ms, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + Math.random() * 0.3;
      const d = 70 + Math.random() * 90;
      const p = this.add.image(x, y, "px_dot2").setBlendMode(ADD).setTint(k % 3 ? PAL.yel3 : PAL.white).setScale(3.4);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, scale: 0.8, alpha: 0, duration: ms + Math.random() * 160, ease: "Cubic.easeOut", onComplete: () => p.destroy() });
    }
  }

  _buildReroll() {
    const W = vw(this),
      H = vh(this);
    const offer = AdService.canShow("extra_card");
    // 2 botões (trocar, banir) ou 3 (com "mais uma carta" por anúncio), centralizados
    this._btnXs = offer ? [W / 2 - 320, W / 2, W / 2 + 320] : [W / 2 - 150, W / 2 + 150];
    this._makeRerollBtn(false);
    this._refreshReroll();
    this._makeBanishBtn(false);
    this.banishHint = text(this, W / 2, H - 78, "", { size: 18, color: CSS.redHi, origin: 0.5, stroke: true });
    this._refreshBanish();
    this.input.keyboard.on("keydown-B", () => this._toggleBanish());
    if (offer) {
      Analytics.track("ad_offer_show", { placement: "extra_card" });
      this.extraBtn = new Button(this, this._btnXs[2], H - 34, 280, 44, tr("MAIS UMA CARTA"), () => this._extraCard(), {
        size: 17,
        style: "primary",
        color: CSS.goldHi,
        icon: AdService.icon,
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
    this.rerollBtn.x = this.rerollBtn._baseX = this._btnXs[0];
    this.banishBtn.x = this.banishBtn._baseX = this._btnXs[1];
    if (!c) return;
    this.cards = [...this.cards, c];
    this._renderCards(false);
    const last = this._cardObjs[3];
    last.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: last, scale: 1, alpha: 1, duration: 320, ease: "Back.easeOut" });
    this.sound.play("sfx_chest_jackpot", { volume: 0.5, bus: "ui" }); // a partida atrás está abafada; a mesa, não
  }

  // Botão de trocar: saldo da PARTIDA (upgrades.rerollsLeft) ou, sem trocas, "TROCAR +1"
  // por anúncio — o mesmo jeito do banir
  _makeRerollBtn(ad) {
    const x = this.rerollBtn?._baseX ?? this._btnXs[0];
    this.rerollBtn?.destroy();
    this._rerollAd = ad;
    this.rerollBtn = ad
      ? new Button(this, x, vh(this) - 34, 280, 44, tr("TROCAR +1"), () => this._adReroll(), { size: 17, style: "ice", icon: AdService.icon, iconScale: 2 })
      : new Button(this, x, vh(this) - 34, 280, 44, "", () => this._reroll(), { size: 17, style: "ice" });
    this.rerollBtn._baseX = x;
    if (ad) Analytics.track("ad_offer_show", { placement: "extra_reroll" });
  }

  _refreshReroll() {
    const left = this.gameScene.upgrades.rerollsLeft || 0;
    const key = this.isTouch ? "" : " [R]";
    const offerAd = left <= 0 && AdService.canShow("extra_reroll");
    if (offerAd !== !!this._rerollAd) this._makeRerollBtn(offerAd);
    if (offerAd) this.rerollBtn.setEnabled(!this._adBusy && !this._locked);
    else if (left > 0) this.rerollBtn.setLabel(tr("TROCAR ({0}){1}", left, key)).setEnabled(true);
    else this.rerollBtn.setLabel(tr("Sem trocas")).setEnabled(false);
  }

  // Anúncio premiado → +1 troca, e já troca
  async _adReroll() {
    if (this._locked || this._adBusy) return;
    this._adBusy = true;
    this.rerollBtn.setEnabled(false);
    const ok = await AdService.rewarded("extra_reroll");
    this._adBusy = false;
    if (!this.scene.isActive() || this._locked) return;
    if (ok) {
      this.gameScene.upgrades.rerollsLeft += 1;
      this._reroll(true); // troca já (o botão ainda está no modo anúncio)
    } else this._refreshReroll();
  }

  // Botão de banir: normal ou, sem banimentos, "BANIR +1" por anúncio
  _makeBanishBtn(ad) {
    const x = this.banishBtn?._baseX ?? this._btnXs[1];
    this.banishBtn?.destroy();
    this._banishAd = ad;
    this.banishBtn = ad
      ? new Button(this, x, vh(this) - 34, 280, 44, tr("BANIR +1"), () => this._adBanish(), { size: 17, style: "danger", color: CSS.redHi, icon: AdService.icon, iconScale: 2 })
      : new Button(this, x, vh(this) - 34, 280, 44, "", () => this._toggleBanish(), { size: 17, style: "danger" });
    this.banishBtn._baseX = x;
    if (ad) Analytics.track("ad_offer_show", { placement: "extra_banish" });
  }

  _refreshBanish() {
    const left = this.gameScene.upgrades.banishLeft;
    const key = this.isTouch ? "" : " [B]";
    const offerAd = !this._banishMode && left <= 0 && AdService.canShow("extra_banish");
    if (offerAd !== !!this._banishAd) this._makeBanishBtn(offerAd);
    if (offerAd) this.banishBtn.setEnabled(!this._adBusy && !this._locked);
    else if (this._banishMode) this.banishBtn.setLabel(tr("CANCELAR")).setEnabled(true);
    else if (left > 0) this.banishBtn.setLabel(tr("BANIR ({0}){1}", left, key)).setEnabled(true);
    else this.banishBtn.setLabel(tr("Sem banimentos")).setEnabled(false);
    this.banishHint.setText(this._banishMode ? tr("Toque na carta que NÃO quer mais ver nesta partida") : "");
  }

  // Anúncio premiado → +1 banimento e já entra no modo banir
  async _adBanish() {
    if (this._locked || this._adBusy) return;
    this._adBusy = true;
    this.banishBtn.setEnabled(false);
    const ok = await AdService.rewarded("extra_banish");
    this._adBusy = false;
    if (!this.scene.isActive() || this._locked) return;
    if (ok) this.gameScene.upgrades.banishLeft += 1;
    this._refreshBanish();
    if (ok) this._toggleBanish();
  }

  // Cartas balançam no modo banir: o que vai acontecer fica evidente
  _wobble(on) {
    this._cardObjs.forEach((c) => {
      this.tweens.killTweensOf(c);
      c.angle = 0;
      if (on) this.tweens.add({ targets: c, angle: { from: -1.2, to: 1.2 }, duration: 110, yoyo: true, repeat: -1 });
    });
  }

  _toggleBanish() {
    if (this._banishAd) return this._adBanish();
    if (this._locked || (!this._banishMode && this.gameScene.upgrades.banishLeft <= 0)) return;
    this._banishMode = !this._banishMode;
    this.sound.play("sfx_ui_click", { volume: 0.4 });
    this._wobble(this._banishMode);
    this._refreshBanish();
  }

  // Banir: SÓ a carta banida sai (cai e some) e uma nova surge no mesmo lugar; as outras
  // continuam onde estavam. Sai do modo ao concluir.
  _banish(card, cont) {
    const up = this.gameScene.upgrades;
    const i = this._cardObjs.indexOf(cont);
    if (i < 0 || !up.banish(card)) return;
    Analytics.track("card_banish", { id: up.cardId(card), level: this.player.level });
    this._banishMode = false;
    this._wobble(false);
    this.sound.play("sfx_death", { volume: 0.4, rate: 0.8, bus: "ui" });
    const fresh = up.replacement(this.player, this.cards);
    if (!fresh) {
      // nada para repor: tira a carta e reorganiza a mesa (que nunca fica vazia)
      if (this.cards.length > 1) this.cards = this.cards.filter((_, k) => k !== i);
      this._renderCards(true);
    } else {
      this.cards = this.cards.map((c, k) => (k === i ? fresh : c));
      cont.disableInteractive?.();
      cont.list?.forEach((o) => o.disableInteractive?.());
      this.tweens.add({ targets: cont, y: cont.y + 120, angle: 8, alpha: 0, scale: 0.85, duration: 260, ease: "Cubic.easeIn", onComplete: () => cont.destroy() });
      const obj = this._makeCard(i);
      const y = obj.y;
      obj.setScale(0.7).setAlpha(0).setY(y + 30);
      this.tweens.add({ targets: obj, scale: 1, alpha: 1, y, delay: 200, duration: 320, ease: "Back.easeOut" });
      this.time.delayedCall(200, () => this.sound.play("sfx_ui_click", { volume: 0.5, rate: 1.3 }));
      this._cardObjs[i] = obj;
    }
    this._refreshBanish();
    this._refreshReroll();
  }

  _reroll(paid = false) {
    if (this._rerollAd && !paid) return this._adReroll();
    const up = this.gameScene.upgrades;
    if (this._locked || (up.rerollsLeft || 0) <= 0) return;
    up.rerollsLeft -= 1;
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

  // Confirma: a partida volta NO MESMO TOQUE (carta aplicada, joystick religado) e a mesa some por cima
  // dela em ~0,2 s. Antes a partida esperava 260 ms parada pela animação e o joystick só religava no 1º
  // quadro depois: no celular o polegar já tinha encostado e não andava até levantar e encostar de novo
  // (19/10/2026)
  _choose(card, cont) {
    if (this._locked) return;
    if (this._banishMode) return this._banish(card, cont);
    this._locked = true;
    this.sound.play("sfx_ui_click", { volume: 0.5 });
    // Balanceamento: o que foi escolhido e o que estava na mesa (carta ignorada = fraca ou sem graça)
    const up = this.gameScene.upgrades;
    Analytics.track("card_pick", {
      card: up.cardId(card),
      kind: card.type,
      offered: this.cards.map((c) => up.cardId(c)).join("|"),
      n: this.cards.length,
      level: this.player.level,
      t: Math.floor((this.gameScene.elapsedMs || 0) / 1000),
      run_n: this.gameScene._runN,
    });
    this.gameScene.upgrades.apply(card, this.player);
    this.gameScene.joystick?.setActive(true);
    this.scene.resume("GameScene");
    // A escolhida dá um pulinho e volta voando para o herói (acelerando: é absorvida); ao chegar, a partida
    // acende o anel nele (GameFeel.cardLanded). As outras caem e somem
    const L = FEEL.LEVEL;
    const to = this.gameScene.heroOnScreen?.() ?? this.from;
    this.tweens.killTweensOf(cont);
    this._cardObjs.forEach((c) => {
      if (c !== cont) this.tweens.add({ targets: c, alpha: 0, y: c.y + 30, duration: 160 });
    });
    this.tweens.add({ targets: cont, scale: 1.06, duration: 70, ease: "Quad.easeOut" });
    this.tweens.add({
      targets: cont,
      x: to.x,
      y: to.y,
      scale: 0.08,
      angle: cont.x < to.x ? 14 : -14,
      delay: 60,
      duration: L.BACK_MS,
      ease: "Quad.easeIn",
      onComplete: () => {
        cont.setVisible(false);
        this.gameScene.feel?.cardLanded(card.type);
      },
    });
    // a mesa (fundo escuro, placa, botões) some por cima da partida já andando
    this.tweens.add({ targets: this.children.list.filter((o) => !this._cardObjs.includes(o)), alpha: 0, delay: 60, duration: 160 });
    this.time.delayedCall(70 + L.BACK_MS + 40, () => this.scene.stop());
  }
}
