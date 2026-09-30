// Tela de título — a "vitrine" (screenshots da loja): clareira noturna, lua,
// névoa, vaga-lumes e o guardião escolhido na fogueira. JOGAR leva à Clareira
// do Guardião (o acampamento caminhável), de onde se parte para a floresta.
import { CHARACTERS } from "../config.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { DEBUG, isNative } from "../systems/Platform.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera } from "../ui/Theme.js";
import { closeTopModal } from "../ui/Widgets.js";
import { MetaPanels } from "../ui/MetaPanels.js";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create() {
    this.events.once("create", () => this._maybeReopenSettings?.());
    fitCamera(this);
    this.meta = new MetaProgression();
    this.sound.volume = 1; // volumes por canal vêm de Settings (ganchos globais)
    this.W = vw(this);
    this.H = vh(this);
    this._modals = [];
    // O Phaser REAPROVEITA a instância da cena: todo estado de "visita" precisa
    // ser zerado aqui, senão sobra da vez anterior (ex.: herói preso andando).
    this._leaving = false;

    this._backdrop();
    this._heroArea();
    this._title();
    this._buttons();

    // Música (desbloqueia áudio no 1º toque, exigência dos navegadores)
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

  _refreshAll() {}

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
    frame(W * 0.08, horizon + 70, "pine1", false);

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

  _heroArea() {
    const W = this.W,
      H = this.H;
    const hx = Math.round(W * 0.3),
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

    this.heroLight = this.add.image(hx, hy - 20, "fx_glow").setScale(4, 3).setTint(0xffc07a).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(hx, hy + 4, "px_shadow").setScale(6, 4);
    this.hero = this.add.sprite(hx, hy + 6, "hero_guardian", 0).setOrigin(0.5, 1).setScale(6);

    const c = CHARACTERS.find((c) => c.id === this.meta.selectedCharacter) || CHARACTERS[0];
    this.hero.setTexture(`hero_${c.id}`, 0).play(`${c.id}_idle`);
  }

  _title() {
    const x = Math.round(this.W * 0.3);
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

  _buttons() {
    const W = this.W,
      H = this.H;
    const cx = Math.round(Math.max(W * 0.74, W - 250));
    this.playBtn = new Button(this, cx, H * 0.56, 380, 86, "JOGAR", () => this._play(), { size: 42, style: "primary", color: CSS.goldHi });
    this.tweens.add({ targets: this.playBtn, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    new Button(this, cx, H * 0.56 + 92, 380, 58, "OPÇÕES", () => !this._modals.length && this._showSettings(), { size: 22, icon: "ico_gear", iconScale: 2.5, style: "dark" });
    new Button(this, cx, H * 0.56 + 160, 380, 58, "CRÉDITOS", () => !this._modals.length && this._showCredits(), { size: 22, style: "dark" });
    // Tela cheia (só navegador)
    if (!isNative()) new Button(this, 44, 40, 52, 52, null, () => this.scale.toggleFullscreen(), { icon: "ico_fullscreen", style: "dark", iconScale: 2.5 });
    if (!this.meta.available) text(this, 20, H - 20, "Modo privado: o progresso não será salvo", { size: 14, color: CSS.redHi, origin: [0, 1] });
    text(this, W - 12, H - 8, "v1.0", { size: 12, color: CSS.dim, origin: [1, 1], shadow: false });
  }

  _play() {
    if (this._leaving) return;
    this._leaving = true;
    haptic(30);
    this.cameras.main.fadeOut(300, 5, 8, 6);
    // 1ª vez: direto para a floresta (primeiro sucesso em segundos); a Clareira
    // aparece depois da 1ª partida
    const firstTime = !(this.meta.data.runsPlayed > 0) && !(this.meta.data.highScoreSeconds > 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(firstTime ? "GameScene" : "CampScene"));
  }
}

Object.assign(TitleScene.prototype, MetaPanels);
