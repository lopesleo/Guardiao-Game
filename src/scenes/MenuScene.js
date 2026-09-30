// A Clareira do Guardião — o acampamento que substitui o menu (e é a "vitrine"
// dos screenshots da loja). Noite, floresta em camadas, fogueira no centro com o
// herói e a Anciã. As construções no chão são os menus: Santuário (Bênçãos),
// Forja (Arsenal), Mural (Conquistas). A trilha à direita é o JOGAR.
import {
  META,
  BLESSINGS,
  DIFFICULTY,
  MAX_BLESSING_RANK,
  ACHIEVEMENTS,
  CHARACTERS,
  WEAPONS,
} from "../config.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Settings } from "../systems/Settings.js";
import { DEBUG, isNative } from "../systems/Platform.js";
import { formatTime } from "../utils.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { WEAPON_DESC } from "../systems/UpgradeSystem.js";
import { text, drawFrame, panel, Button, P, vw, vh, haptic, fitCamera } from "../ui/Theme.js";
import { Modal, ScrollList, closeTopModal } from "../ui/Widgets.js";
import { openSettings } from "../ui/SettingsModal.js";

const BLESSING_ICON = {
  hp1: "ico_heart",
  spd1: "ico_dash_green",
  dmg1: "ico_sword",
  pickup: "ico_magnet",
  awaken1: "ico_star",
  dash1: "ico_dash",
  xp1: "ico_gem",
  crit1: "ico_crit",
};

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    fitCamera(this);
    this.meta = new MetaProgression();
    this.sound.volume = 1; // volumes por canal vêm de Settings (ganchos globais)
    this.W = vw(this);
    this.H = vh(this);
    this._modals = [];

    this._backdrop();
    this._camp();
    this._heroArea();
    this._title();
    this._playPanel();
    this._topBar();
    this._refreshAll();

    // Música do menu (desbloqueia áudio no 1º toque, exigência dos navegadores)
    if (this.cache.audio.exists("music_menu")) {
      this.menuMusic = this.sound.add("music_menu", { loop: true, volume: 0.35 });
      const start = () => {
        if (this.menuMusic && !this.menuMusic.isPlaying) this.menuMusic.play();
      };
      if (!this.sound.locked) start();
      else this.sound.once("unlocked", start);
    }
    this.events.once("shutdown", () => {
      this.menuMusic?.stop();
      this.menuMusic?.destroy();
      this.menuMusic = null;
    });

    this.input.keyboard.on("keydown-ESC", () => closeTopModal(this));
    this.input.keyboard.on("keydown-ENTER", () => !this._modals.length && this._play());
    this.cameras.main.fadeIn(350, 10, 14, 10);
  }

  // Botão VOLTAR do Android: fecha modal; sem modal, deixa o app sair
  onBack() {
    return closeTopModal(this);
  }

  // =========================================================================
  // CENÁRIO
  // =========================================================================
  _backdrop() {
    const W = this.W,
      H = this.H;
    const horizon = Math.round(H * 0.56);
    // Céu em gradiente (gerado por tamanho de tela)
    const key = `menu_sky_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W, H);
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, "#070b14");
      g.addColorStop(0.55, "#10202a");
      g.addColorStop(1, "#1d3a33");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      c.refresh();
    }
    this.add.image(0, 0, key).setOrigin(0);

    // Estrelas piscando
    for (let i = 0; i < 60; i++) {
      const s = this.add
        .image(Math.random() * W, Math.random() * horizon * 0.8, i % 5 ? "px_dot1" : "px_dot2")
        .setScale(3)
        .setAlpha(0.2 + Math.random() * 0.6)
        .setTint(i % 7 ? 0xffffff : 0xffe58f);
      this.tweens.add({ targets: s, alpha: 0.1, duration: 800 + Math.random() * 2000, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
    // Lua
    const mx = W * 0.62,
      my = H * 0.17;
    this.add.image(mx, my, "fx_glow").setScale(5).setTint(0xbfe0ff).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    const moon = this.add.graphics();
    const pr = 10;
    for (let y = -pr; y <= pr; y++)
      for (let x = -pr; x <= pr; x++) {
        const d = x * x + y * y;
        if (d > pr * pr) continue;
        const shade = x + y > 6 ? 0xc9d6e0 : (x * 7 + y * 3) % 11 === 0 ? 0xd8e2ea : 0xeef4f8;
        moon.fillStyle(shade, 1).fillRect(mx + x * 3, my + y * 3, 3, 3);
      }

    const env = this.registry.get("envKeys");
    const trees = [...env.pines, ...env.trees.slice(0, 5)];
    // Camadas de floresta: silhuetas escuras ao fundo → cor real na frente
    const layer = (baseY, scale, tint, step, alpha = 1) => {
      const imgs = [];
      for (let x = -40; x < W + 60; x += step + Math.random() * step * 0.5) {
        const f = trees[Math.floor(Math.random() * trees.length)];
        const im = this.add
          .image(x, baseY + Math.random() * 16, "env", f)
          .setOrigin(0.5, 1)
          .setScale(scale)
          .setTint(tint)
          .setAlpha(alpha);
        imgs.push(im);
      }
      return imgs;
    };
    layer(horizon - 30, 2, 0x0d1c1b, 34);
    // Névoa entre camadas
    this.fog = [];
    for (let i = 0; i < 4; i++) {
      const f = this.add
        .image(W * (i / 3), horizon - 20, "fx_glow")
        .setScale(9, 1.6)
        .setTint(0x9fc8c0)
        .setAlpha(0.07)
        .setBlendMode(Phaser.BlendModes.ADD);
      f._v = 6 + Math.random() * 8;
      this.fog.push(f);
    }
    layer(horizon + 10, 3, 0x142a24, 52);

    // Chão da clareira
    this.add
      .tileSprite(0, horizon, W, H - horizon, "env_ground")
      .setOrigin(0)
      .setTileScale(3)
      .setTint(0xb8c8c0);
    const shade = this.add.graphics();
    shade.fillStyle(0x070b10, 0.5).fillRect(0, horizon, W, 18);
    shade.fillStyle(0x070b10, 0.25).fillRect(0, horizon + 18, W, 18);

    // Detalhes no chão
    for (let i = 0; i < 26; i++) {
      const list = i % 3 ? env.tufts : env.flowers;
      this.add
        .image(Math.random() * W, horizon + 30 + Math.random() * (H - horizon - 40), "env", list[i % list.length])
        .setOrigin(0.5, 1)
        .setScale(3);
    }
    // Árvores grandes emoldurando as bordas (cor real)
    const frame = (x, y, f, flip) => {
      this.add.image(x, y, "px_shadow").setScale(9, 4).setAlpha(0.6);
      this.add.image(x, y, "env", f).setOrigin(0.5, 1).setScale(5).setFlipX(flip);
    };
    frame(-30, H + 40, "tree_big", false);
    frame(W + 20, H + 30, "pine2", true);
    frame(W * 0.015, horizon + 90, "pine1", false);

    // Vaga-lumes
    this.flies = [];
    for (let i = 0; i < 18; i++) {
      const g = this.add.image(Math.random() * W, horizon + Math.random() * (H - horizon), "fx_glow").setScale(0.3).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD);
      const c = this.add.image(g.x, g.y, "px_dot2").setScale(2).setTint(0xfff5b8);
      this.flies.push({ g, c, ph: Math.random() * 7, vx: (Math.random() - 0.5) * 0.3, vy: -0.1 - Math.random() * 0.25 });
    }
    // Vinheta
    const vk = `vignette_${W}x${H}`;
    if (!this.textures.exists(vk)) {
      const c = this.textures.createCanvas(vk, W, H);
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(10,6,16,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      c.refresh();
    }
    this.add.image(0, 0, vk).setOrigin(0).setDepth(900);
  }

  update(time, dt) {
    const W = this.W,
      H = this.H;
    for (const f of this.flies || []) {
      f.g.x += f.vx + Math.sin(time / 700 + f.ph) * 0.25;
      f.g.y += f.vy;
      if (f.g.y < H * 0.5) {
        f.g.y = H + 10;
        f.g.x = Math.random() * W;
      }
      const a = 0.3 + Math.abs(Math.sin(time / 400 + f.ph)) * 0.6;
      f.g.setAlpha(a * 0.6);
      f.c.setPosition(f.g.x, f.g.y).setAlpha(a);
    }
    for (const f of this.fog || []) {
      f.x += (f._v * dt) / 1000;
      if (f.x > W + 300) f.x = -300;
    }
    // Fogueira: chamas pulsando
    if (this.fire) {
      this.fire.glow.setAlpha(0.45 + Math.sin(time / 90) * 0.08 + Math.random() * 0.05);
      this.heroLight?.setAlpha(0.16 + Math.sin(time / 90) * 0.03);
    }
  }

  // =========================================================================
  // HERÓI + FOGUEIRA + SELETOR DE PERSONAGEM
  // =========================================================================
  _heroArea() {
    const W = this.W,
      H = this.H;
    const hx = Math.round(W * 0.42),
      hy = Math.round(H * 0.8);
    this.heroX = hx;
    this.heroY = hy;

    // Fogueira (pedras + lenha + chamas de partículas)
    const fx = hx + 150,
      fy = hy - 6;
    this.add.image(fx, fy + 6, "px_shadow").setScale(6, 3);
    const glow = this.add.image(fx, fy - 10, "fx_glow").setScale(4.5).setTint(0xff9a4c).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
    const wood = this.add.graphics();
    wood.fillStyle(PAL.ink, 1).fillRect(fx - 24, fy - 6, 48, 12);
    wood.fillStyle(PAL.n2, 1).fillRect(fx - 21, fy - 3, 42, 6);
    wood.fillStyle(PAL.n3, 1).fillRect(fx - 21, fy - 3, 42, 3);
    for (let i = -3; i <= 3; i++) {
      wood.fillStyle(PAL.ink, 1).fillRect(fx + i * 9 - 5, fy + 3, 10, 8);
      wood.fillStyle(i % 2 ? PAL.s2 : PAL.s3, 1).fillRect(fx + i * 9 - 3, fy + 5, 6, 4);
    }
    this.fire = { glow };
    this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        const f = this.add
          .image(fx + (Math.random() - 0.5) * 22, fy - 4, "px_puff")
          .setScale(2.2 + Math.random())
          .setTint([0xffe58f, 0xffb36b, 0xff7a3c][Math.floor(Math.random() * 3)])
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: f,
          y: fy - 40 - Math.random() * 30,
          x: f.x + (Math.random() - 0.5) * 14,
          scale: 0.4,
          alpha: 0,
          duration: 520 + Math.random() * 260,
          onComplete: () => f.destroy(),
        });
        if (Math.random() < 0.25) {
          const e = this.add.image(fx, fy - 20, "px_dot1").setScale(3).setTint(0xffe58f);
          this.tweens.add({ targets: e, y: fy - 120 - Math.random() * 60, x: fx + (Math.random() - 0.5) * 60, alpha: 0, duration: 1400, onComplete: () => e.destroy() });
        }
      },
    });

    // Anciã da Fogueira (guia) do outro lado do fogo, virada para ele
    this.add.image(fx + 96, fy + 8, "px_shadow").setScale(4, 3);
    this.elder = this.add.sprite(fx + 96, fy + 10, "camp_elder", 0).setOrigin(0.5, 1).setScale(6).setFlipX(true).play("elder_idle");

    this.heroLight = this.add.image(hx, hy - 20, "fx_glow").setScale(4, 3).setTint(0xffc07a).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(hx, hy + 4, "px_shadow").setScale(6, 4);
    this.hero = this.add.sprite(hx, hy + 6, "hero_guardian", 0).setOrigin(0.5, 1).setScale(6);

    // Plaquinha do personagem + setas
    const py = hy + 50;
    this.charPanel = this.add.container(hx, py);
    this.charG = this.add.graphics();
    this.charName = text(this, 0, -20, "", { size: 24, color: CSS.goldHi, origin: 0.5, stroke: true });
    this.charPerk = text(this, 0, 4, "", { size: 15, color: CSS.muted, origin: 0.5 });
    this.charMods = text(this, 0, 24, "", { size: 15, color: CSS.green, origin: 0.5 });
    this.charPanel.add([this.charG, this.charName, this.charPerk, this.charMods]);
    const arrowL = new Button(this, hx - 200, py, 48, 48, null, () => this._cycleChar(-1), { icon: "ico_arrow_left", style: "dark" });
    const arrowR = new Button(this, hx + 200, py, 48, 48, null, () => this._cycleChar(1), { icon: "ico_arrow", style: "dark" });
    this.charBuy = new Button(this, hx, hy - 150, 280, 50, "", () => this._buyChar(), { size: 18, style: "primary", color: CSS.goldHi });
    this.charIdx = Math.max(0, CHARACTERS.findIndex((c) => c.id === this.meta.selectedCharacter));
    this._refreshChar();
    this.input.keyboard.on("keydown-LEFT", () => !this._modals.length && this._cycleChar(-1));
    this.input.keyboard.on("keydown-RIGHT", () => !this._modals.length && this._cycleChar(1));
  }

  _cycleChar(d) {
    this.charIdx = (this.charIdx + d + CHARACTERS.length) % CHARACTERS.length;
    const c = CHARACTERS[this.charIdx];
    if (this.meta.hasCharacter(c.id)) this.meta.setSelectedCharacter(c.id);
    this.tweens.add({ targets: this.hero, x: { from: this.heroX + d * 30, to: this.heroX }, alpha: { from: 0, to: 1 }, duration: 180 });
    this._refreshChar();
  }

  _refreshChar() {
    const c = CHARACTERS[this.charIdx];
    const owned = this.meta.hasCharacter(c.id);
    this.hero.setTexture(`hero_${c.id}`, 0).play(`${c.id}_idle`);
    if (owned) this.hero.clearTint();
    else this.hero.setTint(0x28303a);
    this.charName.setText(c.name);
    const wname = WEAPONS[c.weapon].name;
    this.charPerk.setText(`${c.title} · começa com ${wname}`);
    this.charMods.setText(c.perk);
    const w = Math.max(this.charName.width, this.charPerk.width, this.charMods.width, 300) + 48;
    this.charG.clear();
    drawFrame(this.charG, -w / 2, -42, w, 84, owned ? "glass" : "dark");
    if (owned) {
      this.charBuy.setVisible(false);
    } else {
      this.charBuy.setVisible(true);
      this.charBuy.setLabel(`LIBERAR · ${c.cost} moedas`);
      this.charBuy.setEnabled(this.meta.coins >= c.cost);
    }
    this.playBtn?.setEnabled(owned);
    this.playBtn?.setLabel(owned ? "JOGAR" : "BLOQUEADO");
  }

  _buyChar() {
    const c = CHARACTERS[this.charIdx];
    if (!this.meta.unlockCharacter(c.id, c.cost)) return;
    this.sound.play("sfx_chest_jackpot", { volume: 0.5 });
    haptic(40);
    this.cameras.main.flash(250, 242, 193, 78);
    this._refreshAll();
  }

  // =========================================================================
  // TÍTULO
  // =========================================================================
  _title() {
    const x = Math.round(Math.min(this.W * 0.3, 380));
    const glow = this.add.image(x, 110, "fx_glow").setScale(8, 2.5).setTint(0xf2c14e).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.24, duration: 1800, yoyo: true, repeat: -1 });
    const t1 = text(this, x, 96, "GUARDIÃO", { size: 84, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 10, shadowY: 6 });
    const t2 = text(this, x, 160, "DA FLORESTA", { size: 34, color: hex(PAL.g6), origin: 0.5, stroke: true, strokeW: 6 });
    text(this, x, 202, "Sobreviva à horda. Desperte a mata.", { size: 18, color: CSS.muted, origin: 0.5 });
    [t1, t2].forEach((t, i) => {
      t.setAlpha(0).y -= 20;
      this.tweens.add({ targets: t, alpha: 1, y: t.y + 20, delay: 150 + i * 120, duration: 500, ease: "Back.easeOut" });
    });
  }

  // =========================================================================
  // PAINEL DE AÇÕES (direita)
  // =========================================================================
  // Trilha da floresta (canto inferior direito): Perigo + JOGAR
  _playPanel() {
    const W = this.W,
      H = this.H;
    const pw = 380;
    const cx = Math.round(W - pw / 2 - 28);
    // Placa da trilha apontando para a mata
    this.add.image(cx + 120, H - 206, "px_shadow").setScale(5, 3).setAlpha(0.6);
    this.add.image(cx + 120, H - 200, "camp_trail").setOrigin(0.5, 1).setScale(4);
    this._difficultySelector(cx, H - 150, pw);
    this.playBtn = new Button(this, cx, H - 58, pw, 78, "JOGAR", () => this._play(), { size: 38, style: "primary", color: CSS.goldHi });
    this.tweens.add({ targets: this.playBtn, scale: 1.03, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  // =========================================================================
  // ACAMPAMENTO: construções no chão = menus
  // =========================================================================
  _camp() {
    const W = this.W,
      H = this.H;
    this.buildings = {};
    const defs = [
      { id: "shrine", tex: "camp_shrine", name: "SANTUÁRIO", x: W * 0.13, y: H * 0.7, glow: [0, -25, 0xffe58f], onTap: () => this._showBlessings() },
      { id: "board", tex: "camp_board", name: "MURAL", x: W * 0.28, y: H * 0.61, onTap: () => this._showAchievements() },
      { id: "forge", tex: "camp_forge", name: "FORJA", x: W * 0.74, y: H * 0.63, glow: [-3, -6, 0xff8a3c], onTap: () => this._showArsenal() },
    ];
    for (const d of defs) this.buildings[d.id] = this._building(d);
  }

  _building(d) {
    const x = Math.round(d.x),
      y = Math.round(d.y);
    const S = 3;
    this.add.image(x, y + 2, "px_shadow").setScale(9, 4).setAlpha(0.55);
    let glow = null;
    if (d.glow) {
      const [gx, gy, col] = d.glow;
      glow = this.add.image(x + gx * S, y + gy * S, "fx_glow").setScale(2.4).setTint(col).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.25, scale: 2.8, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const img = this.add.image(x, y, d.tex).setOrigin(0.5, 1).setScale(S);
    // Plaquinha com o nome
    const label = this.add.container(x, y + 22);
    const t = text(this, 0, 0, d.name, { size: 16, color: CSS.goldHi, origin: 0.5, stroke: true });
    const lg = this.add.graphics();
    drawFrame(lg, -t.width / 2 - 12, -14, t.width + 24, 28, "dark", { noRivets: true, alpha: 0.9 });
    label.add([lg, t]);
    const dot = this._notifyDot(x + img.displayWidth / 2 - 8, y - img.displayHeight + 8).setVisible(false);
    // Toque: área generosa (construção + plaquinha)
    const zone = this.add.zone(x, y - img.displayHeight / 2 + 12, img.displayWidth + 20, img.displayHeight + 40).setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => {
      img.setTint(0xfff0d0);
      this.tweens.add({ targets: label, scale: 1.1, duration: 120 });
    });
    zone.on("pointerout", () => {
      img.clearTint();
      this.tweens.add({ targets: label, scale: 1, duration: 120 });
    });
    zone.on("pointerup", () => {
      if (this._modals.length) return;
      this.sound.play("sfx_ui_click", { volume: 0.4 });
      haptic(12);
      this.tweens.add({ targets: img, scaleY: S * 0.94, scaleX: S * 1.04, duration: 80, yoyo: true });
      d.onTap();
    });
    return { img, label, dot, zone, glow };
  }

  _notifyDot(x, y) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(PAL.ink, 1).fillCircle(0, 0, 13);
    g.fillStyle(PAL.red2, 1).fillCircle(0, 0, 10);
    c.add([g, text(this, 0, -1, "!", { size: 16, origin: 0.5, shadow: false })]);
    this.tweens.add({ targets: c, scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
    return c;
  }

  _difficultySelector(x, y, w) {
    const last = DIFFICULTY.length - 1;
    const maxSel = this.meta.maxSelectableDifficulty(last);
    let cur = Math.min(this.meta.selectedDifficulty, maxSel);
    if (cur !== this.meta.selectedDifficulty) this.meta.setSelectedDifficulty(cur);
    const g = this.add.graphics();
    drawFrame(g, x - w / 2, y - 38, w, 78, "dark");
    text(this, x, y - 24, "PERIGO", { size: 13, color: CSS.muted, origin: 0.5 });
    const name = text(this, x, y - 1, "", { size: 24, origin: 0.5, stroke: true });
    const sub = text(this, x, y + 24, "", { size: 13, color: CSS.gold, origin: 0.5 });
    const skulls = this.add.container(x, y - 2);
    const left = new Button(this, x - w / 2 + 34, y, 44, 48, null, () => change(-1), { icon: "ico_arrow_left", style: "dark" });
    const right = new Button(this, x + w / 2 - 34, y, 44, 48, null, () => change(1), { icon: "ico_arrow", style: "dark" });
    const colors = [CSS.green, CSS.txt, CSS.goldHi, hex(PAL.org2), CSS.redHi];
    const refresh = () => {
      const d = DIFFICULTY[cur];
      name.setText(d.name.toUpperCase()).setColor(colors[cur] ?? CSS.txt);
      const locked = cur >= maxSel && maxSel < last;
      sub.setText(`Recompensa ×${d.rewardMult}` + (locked ? "  ·  vença p/ liberar" : ""));
      left.setEnabled(cur > 0);
      right.setEnabled(cur < maxSel);
      skulls.removeAll(true);
      for (let i = 0; i < cur; i++) skulls.add(this.add.image((i - (cur - 1) / 2) * 20, -38, "ico_skull").setScale(1.6));
    };
    const change = (dd) => {
      const n = Phaser.Math.Clamp(cur + dd, 0, maxSel);
      if (n === cur) return;
      cur = n;
      this.meta.setSelectedDifficulty(cur);
      this.tweens.add({ targets: name, scale: { from: 1.2, to: 1 }, duration: 140 });
      refresh();
    };
    refresh();
  }

  _topBar() {
    const W = this.W;
    // Moedas
    const g = this.add.graphics();
    drawFrame(g, W - 204, 14, 186, 52, "dark");
    this.add.image(W - 180, 40, "ico_coin").setScale(3);
    this.coinText = text(this, W - 34, 40, "", { size: 26, color: CSS.goldHi, origin: [1, 0.5], stroke: true });
    if (DEBUG) {
      new Button(this, W - 430, 40, 150, 44, "+500 (dev)", () => {
        this.meta.addCoins(500);
        this._refreshAll();
      }, { size: 14, style: "green" });
    }
    if (!this.meta.available) {
      text(this, 20, this.H - 20, "Modo privado: o progresso não será salvo", { size: 14, color: CSS.redHi, origin: [0, 1] });
    }
    // Tela cheia (só navegador)
    if (!isNative()) {
      new Button(this, 44, 40, 52, 52, null, () => this.scale.toggleFullscreen(), { icon: "ico_fullscreen", style: "dark", iconScale: 2.5 });
    }
    this.bestText = text(this, Math.round(Math.min(this.W * 0.3, 380)), 232, "", { size: 16, color: CSS.muted, origin: 0.5 });
    // Guia e opções (ícones discretos ao lado das moedas); créditos no rodapé
    new Button(this, W - 244, 40, 52, 52, "?", () => !this._modals.length && this._showGuide(), { size: 26, style: "dark" });
    new Button(this, W - 304, 40, 52, 52, null, () => !this._modals.length && this._showSettings(), { icon: "ico_gear", style: "dark", iconScale: 2.5 });
    const cr = text(this, 12, this.H - 8, "Créditos", { size: 14, color: CSS.dim, origin: [0, 1], shadow: false }).setInteractive({ useHandCursor: true });
    cr.on("pointerup", () => !this._modals.length && this._showCredits());
    text(this, W - 12, this.H - 8, "v1.0", { size: 12, color: CSS.dim, origin: [1, 1], shadow: false });
  }

  // Tudo que depende de moedas/compras (sem reiniciar a cena)
  _refreshAll() {
    this.meta.checkAchievements();
    this.coinText.setText(String(this.meta.coins));
    const best = this.meta.data.highScoreSeconds;
    const night = this.meta.data.bestEndlessSeconds || 0;
    this.bestText.setText(
      best > 0
        ? `Recorde ${formatTime(best * 1000)}  ·  Vitórias ${this.meta.data.wins || 0}` + (night > 0 ? `  ·  Noite Eterna ${formatTime(night * 1000)}` : "")
        : "Primeira vez? Siga a trilha: JOGAR!",
    );
    const coins = this.meta.coins;
    const canBless =
      BLESSINGS.some((b) => {
        const c = this.meta.blessingNextCost(b);
        return c != null && coins >= c;
      }) || coins >= this.meta.ancestralCost();
    const canArsenal =
      META.WEAPON_UNLOCK_ORDER.some((k) => !this.meta.isUnlocked(k) && coins >= META.WEAPON_UNLOCK_COST[k]) ||
      Object.entries(META.ABILITY_UNLOCK_COST).some(([k, c]) => !this.meta.hasAbility(k) && coins >= c);
    this.buildings.shrine.dot.setVisible(canBless);
    this.buildings.forge.dot.setVisible(canArsenal);
    this._refreshChar();
  }

  _play() {
    const c = CHARACTERS[this.charIdx];
    if (!this.meta.hasCharacter(c.id)) return;
    this.meta.setSelectedCharacter(c.id);
    haptic(30);
    this.cameras.main.fadeOut(300, 5, 8, 6);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("GameScene"));
  }

  // =========================================================================
  // MODAIS
  // =========================================================================
  // Lista rolável padrão dentro de um modal
  _modalList(m, rowsTop = null) {
    const W = this.W,
      H = this.H;
    const x = W / 2 - m.w / 2 + 30;
    const y = H / 2 + (rowsTop ?? m.top) + 6;
    const list = new ScrollList(this, x, y, m.w - 76, H / 2 + m.h / 2 - 24 - y, m.root.depth + 3);
    m.list = list;
    return list;
  }

  // Linha de loja genérica: ícone, nome, descrição, direita (preço/estado)
  _shopRow(o) {
    const scene = this;
    return {
      h: o.h ?? 74,
      onTap: o.onTap,
      build(c, w) {
        const g = scene.add.graphics();
        const draw = (hover) => {
          g.clear();
          drawFrame(g, 0, 0, w, o.h ?? 74, hover && o.onTap ? { ...(o.styleObj ?? {}), border: PAL.uiGoldHi, body: PAL.uiPanel2, hi: 0x2b463a, lo: PAL.uiLine } : o.style ?? "dark", { noRivets: true });
        };
        draw(false);
        this.hover = draw;
        c.add(g);
        const hh = (o.h ?? 74) / 2;
        if (o.icon) c.add(scene.add.image(38, hh, o.icon).setScale(3).setAlpha(o.dim ? 0.45 : 1));
        c.add(text(scene, 74, hh - 13, o.name, { size: 20, color: o.nameColor ?? CSS.txt, origin: [0, 0.5] }));
        c.add(text(scene, 74, hh + 13, o.desc, { size: 14, color: CSS.muted, origin: [0, 0.5], shadow: false, wrap: w - 300 }));
        if (o.pips != null) {
          for (let i = 0; i < o.pipsMax; i++)
            c.add(scene.add.rectangle(w - 250 + i * 18, hh, 12, 12, i < o.pips ? PAL.yel2 : PAL.inkSoft).setStrokeStyle(3, PAL.ink));
        }
        if (o.right) {
          const rc = scene.add.container(w - 20, hh);
          const rt = text(scene, 0, 0, o.right, { size: 20, color: o.rightColor ?? CSS.goldHi, origin: [1, 0.5], stroke: true });
          rc.add(rt);
          if (o.rightIcon) rc.add(scene.add.image(-rt.width - 18, 0, o.rightIcon).setScale(2.5));
          c.add(rc);
        }
      },
    };
  }

  _buyFx() {
    this.sound.play("sfx_coin_cascade", { volume: 0.5 });
    haptic(30);
  }

  _showBlessings() {
    const m = new Modal(this, { title: "BÊNÇÃOS", subtitle: "Poderes permanentes — valem para todos os personagens", w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showBlessings();
    };
    for (const b of BLESSINGS) {
      const rank = this.meta.blessingRank(b.id);
      const cost = this.meta.blessingNextCost(b);
      const can = cost != null && this.meta.coins >= cost;
      list.addRow(
        this._shopRow({
          icon: BLESSING_ICON[b.id],
          name: b.name,
          desc: b.desc,
          pips: rank,
          pipsMax: MAX_BLESSING_RANK,
          right: cost == null ? "MÁX" : String(cost),
          rightIcon: cost == null ? null : "ico_coin",
          rightColor: cost == null ? CSS.green : can ? CSS.goldHi : CSS.dim,
          style: cost == null ? "green" : can ? "button" : "dark",
          onTap: can
            ? () => {
                if (this.meta.rankUpBlessing(b)) {
                  this._buyFx();
                  reopen();
                }
              }
            : null,
        }),
      );
    }
    const ac = this.meta.ancestralCost();
    const acan = this.meta.coins >= ac;
    list.addRow(
      this._shopRow({
        icon: "ico_trophy",
        name: "Tesouro Ancestral",
        desc: `+2% de dano geral por nível · Nível ${this.meta.ancestralLevel} (sem limite)`,
        right: String(ac),
        rightIcon: "ico_coin",
        rightColor: acan ? CSS.goldHi : CSS.dim,
        nameColor: CSS.goldHi,
        style: acan ? "gold" : "dark",
        onTap: acan
          ? () => {
              if (this.meta.buyAncestral()) {
                this._buyFx();
                reopen();
              }
            }
          : null,
      }),
    );
  }

  _showArsenal() {
    const m = new Modal(this, { title: "ARSENAL", subtitle: "Armas liberadas aparecem nas cartas de nível", w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showArsenal();
    };
    const elName = { fire: "Fogo", ice: "Gelo", bolt: "Raio" };
    const rows = [
      { kind: "weapon", key: "STAFF", cost: 0 },
      { kind: "weapon", key: "AURA", cost: 0 },
      ...META.WEAPON_UNLOCK_ORDER.map((k) => ({ kind: "weapon", key: k, cost: META.WEAPON_UNLOCK_COST[k] })),
      { kind: "ability", key: "DASH", cost: META.ABILITY_UNLOCK_COST.DASH, name: "Dash", icon: "ico_dash", desc: "Esquiva rápida e invulnerável (SHIFT / botão)" },
      { kind: "ability", key: "AWAKEN", cost: META.ABILITY_UNLOCK_COST.AWAKEN, name: "Despertar", icon: "ico_star", desc: "Modo fúria: armas disparam 2,5× mais rápido" },
    ];
    for (const r of rows) {
      const has = r.kind === "weapon" ? r.cost === 0 || this.meta.isUnlocked(r.key) : this.meta.hasAbility(r.key);
      const can = !has && this.meta.coins >= r.cost;
      const def = WEAPONS[r.key];
      list.addRow(
        this._shopRow({
          icon: r.icon ?? WEAPON_ICON[r.key],
          name: r.name ?? `${def.name}  ·  ${elName[def.element]}`,
          desc: r.desc ?? WEAPON_DESC[r.key],
          right: has ? "LIBERADA" : String(r.cost),
          rightIcon: has ? null : "ico_coin",
          rightColor: has ? CSS.green : can ? CSS.goldHi : CSS.dim,
          style: has ? "green" : can ? "button" : "dark",
          onTap: can
            ? () => {
                const ok = r.kind === "weapon" ? this.meta.unlock(r.key) : this.meta.unlockAbility(r.key, r.cost);
                if (ok) {
                  this._buyFx();
                  reopen();
                }
              }
            : null,
        }),
      );
    }
    // Evoluções: receitas visíveis (descoberta guiada)
    list.addRow({
      h: 40,
      build: (c, w) => c.add(text(this, w / 2, 24, "RECEITAS DE EVOLUÇÃO", { size: 18, color: hex(PAL.pur3), origin: 0.5 })),
    });
    for (const [k, d] of Object.entries(WEAPONS)) {
      if (!d.evolvesFrom) continue;
      list.addRow(
        this._shopRow({
          h: 62,
          icon: WEAPON_ICON[k],
          name: d.name,
          desc: `${WEAPONS[d.evolvesFrom].name} nível 5 + ${WEAPONS[d.partner].name}`,
          style: "purple",
        }),
      );
    }
  }

  _showAchievements() {
    const done = this.meta.data.achievements;
    const m = new Modal(this, { title: "CONQUISTAS", subtitle: `${done.length} de ${ACHIEVEMENTS.length} desbloqueadas`, w: 860, h: 640 });
    const list = this._modalList(m);
    const ctx = this.meta.buildAchievementCtx();
    // Desbloqueadas por último → mostra primeiro o que falta
    const sorted = ACHIEVEMENTS.slice().sort((a, b) => done.includes(a.id) - done.includes(b.id));
    for (const a of sorted) {
      const has = done.includes(a.id);
      let right = has ? "OK" : "";
      if (!has && a.prog) {
        const [cur, goal] = a.prog(ctx);
        right = `${Math.min(cur, goal)}/${goal}`;
      }
      list.addRow(
        this._shopRow({
          h: 64,
          icon: has ? "ico_trophy" : "ico_lock",
          name: a.name,
          nameColor: has ? CSS.goldHi : CSS.txt,
          desc: a.desc,
          right,
          rightColor: has ? CSS.green : CSS.gold,
          style: has ? "gold" : "dark",
        }),
      );
    }
  }

  _showGuide() {
    const m = new Modal(this, { title: "GUIA DA FLORESTA", w: 880, h: 640 });
    const list = this._modalList(m);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const sections = [
      ["ico_dash", "Movimento", touch ? "Arraste o polegar na metade esquerda da tela para andar. O ataque é automático." : "WASD ou setas para andar. O ataque é automático — posicione-se."],
      ["ico_gem", "Nível", "Colete gemas verdes para subir de nível e escolher 1 de 3 cartas: novas armas, melhorias ou passivas."],
      ["ico_staff", "Elementos", "Cada arma aplica um elemento: Fogo, Gelo ou Raio. Dois elementos no mesmo inimigo disparam uma REAÇÃO."],
      ["ico_cloud", "Vapor (Fogo + Gelo)", "Nuvem escaldante que causa dano contínuo na área."],
      ["ico_aura", "Cristal (Congelado + Raio)", "O inimigo congelado estilhaça e fere quem está perto."],
      ["ico_bolt_gold", "Sobrecarga (Fogo + Raio)", "Corrente elétrica que salta entre vários inimigos."],
      ["ico_star", "Despertar", "Reações enchem a barra dourada. Ative para disparar tudo muito mais rápido por alguns segundos."],
      ["ico_chest", "Baús", "Encoste num baú para abri-lo: tesouro, jackpot dourado… ou uma armadilha (e o temido mímico)."],
      ["ico_heart_ice", "Evoluções", "Arma no nível 5 + a arma parceira na mesma partida = carta de EVOLUÇÃO garantida. Veja as receitas no Arsenal."],
      ["ico_skull", "O Ancião", "Aos 7:00 o chefe desperta. Derrote-o para vencer e liberar o próximo nível de Perigo."],
      ["ico_coin", "Entre partidas", "Moedas compram Bênçãos permanentes, armas, habilidades e novos personagens."],
    ];
    for (const [icon, name, desc] of sections) {
      list.addRow({
        h: 84,
        build: (c, w) => {
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, 84, "dark", { noRivets: true });
          c.add(g);
          c.add(this.add.image(40, 42, icon).setScale(3));
          c.add(text(this, 80, 20, name, { size: 20, color: CSS.goldHi, origin: [0, 0.5] }));
          c.add(text(this, 80, 38, desc, { size: 15, color: CSS.muted, origin: [0, 0], wrap: w - 100, shadow: false }));
        },
      });
    }
  }

  _showSettings() {
    openSettings(this, { onReset: () => this._confirmReset() });
  }

  _confirmReset() {
    const m = new Modal(this, { title: "APAGAR TUDO?", style: "danger", w: 560, h: 330 });
    m.add(text(this, 0, -30, "Moedas, bênçãos, armas, personagens,\nconquistas e recordes serão perdidos.", { size: 18, align: "center", origin: 0.5, color: CSS.txt }));
    m.add(
      new Button(this, -125, 90, 220, 54, "APAGAR", () => {
        this.meta.reset();
        this.scene.restart();
      }, { style: "danger", color: CSS.redHi, size: 20 }),
    );
    m.add(new Button(this, 125, 90, 220, 54, "CANCELAR", () => m.close(), { size: 20 }));
  }

  _showCredits() {
    const m = new Modal(this, { title: "CRÉDITOS", w: 820, h: 620 });
    const list = this._modalList(m);
    const lines = [
      ["Design, código e arte procedural", "Leonardo Lopes"],
      ["Arte", "Heróis, criaturas, cenário, ícones e efeitos: arte própria, gerada por código"],
      ["Fonte", "Jersey 15 — The Soft Type Project Authors (OFL 1.1)"],
      ["Música e efeitos sonoros", "Compostos e sintetizados por código para este jogo"],
      ["Motor", "Phaser 3 (MIT) · nipplejs (MIT)"],
    ];
    for (const [a, b] of lines) {
      list.addRow({
        h: 70,
        build: (c, w) => {
          c.add(text(this, 0, 12, a, { size: 18, color: CSS.goldHi }));
          c.add(text(this, 0, 38, b, { size: 15, color: CSS.muted, wrap: w - 10, shadow: false }));
        },
      });
    }
  }
}
