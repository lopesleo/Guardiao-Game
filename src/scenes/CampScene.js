// A Clareira do Guardião — acampamento CAMINHÁVEL entre partidas (como a Casa
// de Hades ou o alojamento do Dead Cells). O jogador anda com os mesmos
// controles da partida; perto de uma construção aparece o aviso para interagir
// (E no teclado / botão de ação no toque):
//   Fogueira → guardiões · Santuário → bênçãos e dons · Forja → armas ·
//   Mural → Conquistas · Placa da trilha → Perigo · Anciã → conversa.
// A trilha ao norte leva à floresta (começa a partida).
import { GAME, CHARACTERS, DIFFICULTY, META, BLESSINGS } from "../config.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { InputManager } from "../systems/InputManager.js";
import { VirtualJoystick } from "../ui/VirtualJoystick.js";
import { DEBUG } from "../systems/Platform.js";
import { Analytics } from "../systems/Analytics.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera } from "../ui/Theme.js";
import { Modal, closeTopModal } from "../ui/Widgets.js";
import { MetaPanels } from "../ui/MetaPanels.js";

const S = GAME.PIXEL_SCALE;
const CAMP_W = 1500,
  CAMP_H = 1100; // mundo centrado em (0,0)
const TOP = -CAMP_H / 2;
const SPEED = 210;
const TRAIL_HALF = 70; // meia-largura da trilha de saída (norte)
const D_NIGHT = 50000; // camada de "noite" (multiply) e luzes (add) por cima do mundo
const D_HUD = 60000;

// Falas da Anciã (uma por vez, em rodízio): dicas curtas e o tom da floresta
const ELDER_LINES = [
  "A Podridão tomou a mata. Cada partida devolve um pouco da floresta.",
  "Fogo e gelo juntos viram vapor. Misture os elementos, guardião.",
  "Lanternas de cogumelo guardam presentes. Quebre-as quando precisar de fôlego.",
  "No Santuário, as moedas viram bênçãos que ficam para sempre.",
  "A Forja guarda armas para quem junta moedas pela mata.",
  "Dizem que, depois do Ancião, vem uma noite que não acaba…",
  "Uma arma no nível máximo, com a parceira certa, desperta algo maior.",
];

export class CampScene extends Phaser.Scene {
  constructor() {
    super("CampScene");
  }

  create() {
    fitCamera(this);
    this.meta = new MetaProgression();
    this.W = vw(this);
    this.H = vh(this);
    this._modals = [];
    this._leaving = false;
    this._elderLine = this.meta.data.elderLine || 0;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    this.physics.world.setBounds(-CAMP_W / 2, TOP, CAMP_W, CAMP_H);
    this.solids = this.physics.add.staticGroup();
    this.interactables = [];
    this.glows = [];

    this._ground();
    this._forestWall();
    this._trail();
    this._fire(0, 70);
    this._structures();
    this._player();
    this._night();
    this._hud();

    this.inputMgr = new InputManager(this);
    this.joystick = new VirtualJoystick(this.inputMgr);

    const cam = this.cameras.main;
    cam.setBounds(-CAMP_W / 2 - 160, TOP - 260, CAMP_W + 320, CAMP_H + 380);
    cam.startFollow(this.player, true, 0.14, 0.14);

    if (this.cache.audio.exists("music_menu")) {
      this.music = this.sound.add("music_menu", { loop: true, volume: 0.35 });
      const start = () => this.music && !this.music.isPlaying && this.music.play();
      if (!this.sound.locked) start();
      else this.sound.once("unlocked", start);
    }
    this.events.once("shutdown", () => {
      this.joystick?.destroy();
      this.joystick = null;
      this.music?.stop();
      this.music?.destroy();
      this.music = null;
    });
    this.input.keyboard.on("keydown-ESC", () => {
      if (!closeTopModal(this)) this._showSettings();
    });

    this._refreshAll();
    cam.fadeIn(400, 10, 14, 10);
    Analytics.track("camp_enter", {});
  }

  // VOLTAR do Android: fecha o painel aberto; sem painel, volta ao título
  onBack() {
    if (closeTopModal(this)) return true;
    this._go("TitleScene");
    return true;
  }

  // =========================================================================
  // MUNDO
  // =========================================================================
  _ground() {
    this.cameras.main.setBackgroundColor(0x1d3926);
    this.add
      .tileSprite(-CAMP_W / 2 - 300, TOP - 400, CAMP_W + 600, CAMP_H + 700, "env_ground")
      .setOrigin(0)
      .setTileScale(S)
      .setDepth(-1e6);
    const env = this.registry.get("envKeys");
    const rnd = new Phaser.Math.RandomDataGenerator(["clareira"]);
    // Terreiro de terra batida em volta da fogueira
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const d = 60 + rnd.frac() * 110;
      this.add.image(Math.cos(a) * d, 70 + Math.sin(a) * d * 0.7, "env", rnd.pick(env.patches.dirt)).setScale(S).setDepth(-9e5).setAlpha(0.9);
    }
    // Detalhes (sem colisão)
    for (let i = 0; i < 70; i++) {
      const x = rnd.between(-CAMP_W / 2 + 60, CAMP_W / 2 - 60),
        y = rnd.between(TOP + 80, CAMP_H / 2 - 40);
      if (Math.hypot(x, y - 70) < 200 || Math.abs(x) < TRAIL_HALF + 20) continue;
      const list = i % 4 === 0 ? env.flowers : i % 4 === 1 ? env.shrooms : env.tufts;
      this.add.image(x, y, "env", rnd.pick(list)).setOrigin(0.5, 1).setScale(S).setDepth(y);
    }
  }

  // Mata fechada em volta (a borda do mundo), com a abertura da trilha ao norte
  _forestWall() {
    const env = this.registry.get("envKeys");
    const rnd = new Phaser.Math.RandomDataGenerator(["mata"]);
    const trees = [...env.trees, ...env.pines];
    const put = (x, y) => {
      if (y < TOP + 20 && Math.abs(x) < TRAIL_HALF + 30) return; // trilha livre
      this.add.image(x, y + 4, "px_shadow").setScale(7, 3).setAlpha(0.5).setDepth(y - 1);
      this.add.image(x, y, "env", rnd.pick(trees)).setOrigin(0.5, 1).setScale(S).setDepth(y).setFlipX(rnd.frac() < 0.5);
    };
    for (let row = 0; row < 3; row++) {
      const off = row * 70;
      for (let x = -CAMP_W / 2 - 120; x <= CAMP_W / 2 + 120; x += 64 + rnd.between(0, 24)) {
        put(x, TOP + 10 - off + rnd.between(-10, 10)); // norte
        put(x, CAMP_H / 2 + 90 + off + rnd.between(-10, 10)); // sul
      }
      for (let y = TOP; y <= CAMP_H / 2 + 60; y += 60 + rnd.between(0, 20)) {
        put(-CAMP_W / 2 - 30 - off + rnd.between(-10, 10), y); // oeste
        put(CAMP_W / 2 + 30 + off + rnd.between(-10, 10), y); // leste
      }
    }
  }

  // Trilha de terra ao norte, com duas tochas — a saída para a floresta
  _trail() {
    const env = this.registry.get("envKeys");
    for (let y = TOP - 200; y < -120; y += 34) {
      this.add.image((y % 3) * 6, y, "env", env.patches.dirt[Math.abs(y) % env.patches.dirt.length]).setScale(S).setDepth(-9e5);
    }
    for (const side of [-1, 1]) this._torch(side * (TRAIL_HALF + 18), TOP + 120);
    // Placa: escolha do Perigo
    const sx = TRAIL_HALF + 90,
      sy = TOP + 190;
    this.add.image(sx, sy + 4, "px_shadow").setScale(5, 3).setAlpha(0.6).setDepth(sy - 1);
    const sign = this.add.image(sx, sy, "camp_trail").setOrigin(0.5, 1).setScale(S).setDepth(sy);
    this._solid(sx, sy - 6, 20, 12);
    this._addInteract({ x: sx, y: sy, top: sy - sign.displayHeight, r: 90, name: "PERIGO", verb: "ESCOLHER PERIGO", action: () => this._showDifficulty() });
    // Faixa escura no fim da trilha: "a mata começa aqui"
    this.add.image(0, TOP - 40, "fx_glow").setScale(6, 3).setTint(0x000000).setAlpha(0.55).setDepth(TOP + 30);
  }

  _torch(x, y) {
    const g = this.add.graphics().setDepth(y);
    g.fillStyle(PAL.ink, 1).fillRect(x - 4, y - 46, 8, 48);
    g.fillStyle(PAL.n3, 1).fillRect(x - 2, y - 44, 4, 44);
    g.fillStyle(PAL.ink, 1).fillRect(x - 7, y - 52, 14, 8);
    g.fillStyle(PAL.n2, 1).fillRect(x - 5, y - 50, 10, 5);
    this._glow(x, y - 58, 2.2, 0xff9a4c, true);
    this._flames(x, y - 54, 5, 9, 160);
    this._solid(x, y - 4, 10, 8);
  }

  // Fogueira central: trocar de guardião
  _fire(x, y) {
    const g = this.add.graphics().setDepth(y);
    this.add.image(x, y + 6, "px_shadow").setScale(6, 3).setDepth(y - 2);
    g.fillStyle(PAL.ink, 1).fillRect(x - 24, y - 6, 48, 12);
    g.fillStyle(PAL.n2, 1).fillRect(x - 21, y - 3, 42, 6);
    g.fillStyle(PAL.n3, 1).fillRect(x - 21, y - 3, 42, 3);
    for (let i = -3; i <= 3; i++) {
      g.fillStyle(PAL.ink, 1).fillRect(x + i * 9 - 5, y + 3, 10, 8);
      g.fillStyle(i % 2 ? PAL.s2 : PAL.s3, 1).fillRect(x + i * 9 - 3, y + 5, 6, 4);
    }
    this._glow(x, y - 16, 5.5, 0xff9a4c, true);
    this._flames(x, y - 4, 22, 70, 0.25);
    this._solid(x, y, 56, 22);
    this._addInteract({ x, y, top: y - 70, r: 110, name: "FOGUEIRA", verb: "TROCAR GUARDIÃO", action: () => this._showCharacters() });
  }

  // Chamas de partículas (puffs) — mesmas da tela de título
  _flames(x, y, spread, rise, emberChance) {
    this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        const f = this.add
          .image(x + (Math.random() - 0.5) * spread, y, "px_puff")
          .setScale(spread > 10 ? 2.2 + Math.random() : 1.4 + Math.random() * 0.6)
          .setTint([0xffe58f, 0xffb36b, 0xff7a3c][Math.floor(Math.random() * 3)])
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(D_NIGHT + 2);
        this.tweens.add({
          targets: f,
          y: y - rise * 0.55 - Math.random() * rise * 0.45,
          x: f.x + (Math.random() - 0.5) * 14,
          scale: 0.4,
          alpha: 0,
          duration: 520 + Math.random() * 260,
          onComplete: () => f.destroy(),
        });
        if (emberChance < 1 && Math.random() < emberChance) {
          const e = this.add.image(x, y - 16, "px_dot1").setScale(3).setTint(0xffe58f).setDepth(D_NIGHT + 2);
          this.tweens.add({ targets: e, y: y - 140 - Math.random() * 60, x: x + (Math.random() - 0.5) * 60, alpha: 0, duration: 1400, onComplete: () => e.destroy() });
        }
      },
    });
  }

  _structures() {
    this.buildings = {};
    const B = (id, tex, name, verb, x, y, action, glow) => {
      const img = this.add.image(x, y, tex).setOrigin(0.5, 1).setScale(S).setDepth(y);
      this.add.image(x, y + 4, "px_shadow").setScale(img.displayWidth / 16, 4).setAlpha(0.55).setDepth(y - 1);
      if (glow) this._glow(x + glow[0], y + glow[1], glow[3] ?? 2.6, glow[2], true);
      this._solid(x, y - 14, img.displayWidth * 0.8, 30);
      const dot = this._notifyDot(x + img.displayWidth / 2 - 10, y - img.displayHeight + 6).setDepth(D_HUD - 10).setVisible(false);
      this._addInteract({ x, y, top: y - img.displayHeight, r: 130, name, verb, action });
      this.buildings[id] = { img, dot };
    };
    B("shrine", "camp_shrine", "SANTUÁRIO", "BÊNÇÃOS E DONS", -430, -130, () => this._showBlessings(), [0, -75, 0xffe58f, 2.4]);
    B("forge", "camp_forge", "FORJA", "FORJAR ARMAS", 440, -120, () => this._showArsenal(), [-8, -18, 0xff8a3c, 2.8]);
    B("board", "camp_board", "MURAL", "VER CONQUISTAS", -420, 280, () => this._showAchievements());

    // Ninho do João-de-barro (o construtor chega com as obras) + o pássaro
    const nx = 450,
      ny = 290;
    this.add.image(nx, ny + 4, "px_shadow").setScale(4, 3).setAlpha(0.5).setDepth(ny - 1);
    this.add.image(nx, ny, "camp_nest").setOrigin(0.5, 1).setScale(S).setDepth(ny);
    this._solid(nx, ny - 6, 16, 10);
    this.bird = this.add.sprite(nx + 34, ny - 2, "camp_bird", 0).setOrigin(0.5, 1).setScale(S).setDepth(ny + 1).play("bird_idle");

    // Anciã da Fogueira: conversa (uma dica curta por vez)
    const ex = 110,
      ey = 60;
    this.add.image(ex, ey + 4, "px_shadow").setScale(4, 3).setAlpha(0.6).setDepth(ey - 1);
    this.elder = this.add.sprite(ex, ey, "camp_elder", 0).setOrigin(0.5, 1).setScale(S + 1).setFlipX(true).setDepth(ey).play("elder_idle");
    this._solid(ex, ey - 6, 30, 14);
    this._addInteract({ x: ex, y: ey, top: ey - this.elder.displayHeight, r: 90, name: "ANCIÃ", verb: "CONVERSAR", action: () => this._talkElder() });
  }

  _player() {
    const c = CHARACTERS.find((c) => c.id === this.meta.selectedCharacter && this.meta.hasCharacter(c.id)) || CHARACTERS[0];
    this.heroId = c.id;
    // Entra pela trilha (voltando da floresta) ou nasce ao lado da fogueira
    const fromRun = this.scene.settings.data?.fromRun;
    const sx = fromRun ? 0 : -90,
      sy = fromRun ? TOP + 150 : 150;
    this.shadow = this.add.image(sx, sy, "px_shadow").setScale(3.4, 3).setAlpha(0.6);
    this.player = this.physics.add.sprite(sx, sy, `hero_${c.id}`, 0).setScale(S).play(`${c.id}_idle`);
    this.player.body.setCircle(6, 6, 14); // pés (quadro 24×28), igual à partida
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solids);
  }

  // Noite: escurece tudo (multiply) e as luzes somam por cima (add)
  _night() {
    this.nightRect = this.add
      .rectangle(0, 0, this.W, this.H, 0x5a6a9a, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(D_NIGHT);
    // Vaga-lumes
    this.flies = [];
    for (let i = 0; i < 26; i++) {
      const x = Phaser.Math.Between(-CAMP_W / 2, CAMP_W / 2),
        y = Phaser.Math.Between(TOP, CAMP_H / 2);
      const g = this.add.image(x, y, "fx_glow").setScale(0.3).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
      const c = this.add.image(x, y, "px_dot2").setScale(2).setTint(0xfff5b8).setDepth(D_NIGHT + 1);
      this.flies.push({ g, c, ph: Math.random() * 7, ox: x, oy: y });
    }
  }

  _glow(x, y, scale, color, flicker) {
    const g = this.add.image(x, y, "fx_glow").setScale(scale).setTint(color).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    if (flicker) this.glows.push({ g, base: 0.5, ph: Math.random() * 10 });
    return g;
  }

  // Colisor estático invisível (base das construções)
  _solid(x, y, w, h) {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.solids.add(z);
    return z;
  }

  _addInteract(o) {
    this.interactables.push(o);
  }

  _notifyDot(x, y) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(PAL.ink, 1).fillCircle(0, 0, 13);
    g.fillStyle(PAL.red2, 1).fillCircle(0, 0, 10);
    c.add([g, text(this, 0, -1, "!", { size: 16, origin: 0.5, shadow: false })]);
    this.tweens.add({ targets: c, y: y - 6, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    return c;
  }

  // =========================================================================
  // HUD
  // =========================================================================
  _hud() {
    const W = this.W,
      H = this.H;
    const fix = (o) => o.setScrollFactor(0).setDepth(D_HUD);
    // Local + resumo
    const lg = fix(this.add.graphics());
    drawFrame(lg, 14, 14, 330, 62, "dark", { alpha: 0.92 });
    fix(text(this, 30, 32, "CLAREIRA DO GUARDIÃO", { size: 20, color: CSS.goldHi, origin: [0, 0.5], stroke: true }));
    this.hudInfo = fix(text(this, 30, 58, "", { size: 14, color: CSS.muted, origin: [0, 0.5] }));
    // Moedas + guia + opções
    const cg = fix(this.add.graphics());
    drawFrame(cg, W - 204, 14, 186, 52, "dark");
    fix(this.add.image(W - 180, 40, "ico_coin").setScale(3));
    this.coinText = fix(text(this, W - 34, 40, "", { size: 26, color: CSS.goldHi, origin: [1, 0.5], stroke: true }));
    fix(new Button(this, W - 244, 40, 52, 52, "?", () => !this._modals.length && this._showGuide(), { size: 26, style: "dark" }));
    fix(new Button(this, W - 304, 40, 52, 52, null, () => !this._modals.length && this._showSettings(), { icon: "ico_gear", style: "dark", iconScale: 2.5 }));
    if (DEBUG) {
      fix(
        new Button(this, W - 430, 40, 150, 44, "+500 (dev)", () => {
          this.meta.addCoins(500);
          this._refreshAll();
        }, { size: 14, style: "green" }),
      );
    }
    // Aviso de interação (no mundo, sobre o alvo)
    this.prompt = this.add.container(0, 0).setDepth(D_HUD - 5).setVisible(false);
    this.promptG = this.add.graphics();
    this.promptT = text(this, 0, 0, "", { size: 18, color: CSS.goldHi, origin: 0.5, stroke: true });
    this.prompt.add([this.promptG, this.promptT]);
    // Botão de ação (toque)
    if (this.isTouch) {
      this.actionBtn = fix(new Button(this, W - 150, H - 80, 250, 84, "", () => this._interact(), { size: 22, style: "primary", color: CSS.goldHi }));
      this.actionBtn.setVisible(false);
    }
    // Dica de movimento na 1ª visita
    const hint = this.isTouch ? "Arraste à esquerda para andar · toque no botão para interagir" : "WASD/setas para andar · E para interagir · a trilha ao norte leva à floresta";
    this.hint = fix(text(this, W / 2, H - 26, hint, { size: 16, color: CSS.muted, origin: 0.5 }));
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 7000, duration: 800 });
    // Balão de fala da Anciã
    this.bubble = this.add.container(0, 0).setDepth(D_HUD - 4).setVisible(false);
    this.bubbleG = this.add.graphics();
    this.bubbleT = text(this, 0, 0, "", { size: 17, color: CSS.txt, origin: 0.5, align: "center", wrap: 380 });
    this.bubble.add([this.bubbleG, this.bubbleT]);
  }

  _refreshAll() {
    this.meta.checkAchievements?.();
    this.coinText.setText(String(this.meta.coins));
    const c = CHARACTERS.find((c) => c.id === this.meta.selectedCharacter) || CHARACTERS[0];
    const d = DIFFICULTY[Math.min(this.meta.selectedDifficulty, DIFFICULTY.length - 1)];
    this.hudInfo.setText(`${c.name}  ·  Perigo: ${d.name}`);
    const coins = this.meta.coins;
    const canBless =
      BLESSINGS.some((b) => {
        const cost = this.meta.blessingNextCost(b);
        return cost != null && coins >= cost;
      }) ||
      coins >= this.meta.ancestralCost() ||
      Object.entries(META.ABILITY_UNLOCK_COST).some(([k, cost]) => !this.meta.hasAbility(k) && coins >= cost);
    const canArsenal = META.WEAPON_UNLOCK_ORDER.some((k) => !this.meta.isUnlocked(k) && coins >= META.WEAPON_UNLOCK_COST[k]);
    this.buildings.shrine.dot.setVisible(canBless);
    this.buildings.forge.dot.setVisible(canArsenal);
  }

  // Trocou de guardião na Fogueira: o avatar muda na hora (com fumacinha)
  _onCharacterChanged(id) {
    this.heroId = id;
    this.player.setTexture(`hero_${id}`, 0).play(`${id}_idle`);
    for (let i = 0; i < 10; i++) {
      const p = this.add.image(this.player.x, this.player.y - 20, "px_puff").setScale(2).setTint(0xe8e0d0).setDepth(this.player.depth + 1);
      const a = (i / 10) * Math.PI * 2;
      this.tweens.add({ targets: p, x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 20, alpha: 0, duration: 400, onComplete: () => p.destroy() });
    }
    this._refreshAll();
  }

  // =========================================================================
  // LOOP
  // =========================================================================
  update(time, dt) {
    this.inputMgr.update();
    const p = this.player;
    const busy = this._modals.length > 0 || this._leaving;
    const mx = busy ? 0 : this.inputMgr.move.x,
      my = busy ? 0 : this.inputMgr.move.y;
    p.setVelocity(mx * SPEED, my * SPEED);
    if (mx !== 0) p.setFlipX(mx < 0);
    const anim = `${this.heroId}_${Math.abs(mx) + Math.abs(my) > 0.1 ? "walk" : "idle"}`;
    if (p.anims.currentAnim?.key !== anim) p.play(anim);
    p.setDepth(p.y + 20);
    this.shadow.setPosition(p.x, p.y + 20).setDepth(p.y + 19);

    // Alvo de interação mais próximo
    let best = null,
      bd = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(p.x - it.x, p.y + 20 - it.y);
      if (d < it.r && d < bd) {
        best = it;
        bd = d;
      }
    }
    this._setTarget(busy ? null : best);
    if (this.inputMgr.consumeInteract() && !busy) this._interact();

    // Saída: entrou na trilha ao norte
    if (!busy && p.y < TOP + 40 && Math.abs(p.x) < TRAIL_HALF) this._play();

    // Luzes tremulando e vaga-lumes
    for (const g of this.glows) g.g.setAlpha(g.base + Math.sin(time / 90 + g.ph) * 0.06 + Math.random() * 0.04);
    for (const f of this.flies) {
      const x = f.ox + Math.sin(time / 1300 + f.ph) * 40,
        y = f.oy + Math.cos(time / 1700 + f.ph) * 30;
      const a = 0.3 + Math.abs(Math.sin(time / 400 + f.ph)) * 0.6;
      f.g.setPosition(x, y).setAlpha(a * 0.6);
      f.c.setPosition(x, y).setAlpha(a);
    }
    if (this.bubble.visible && this._bubbleUntil < time) this.bubble.setVisible(false);
  }

  _setTarget(it) {
    if (it === this._target) return;
    this._target = it;
    if (!it) {
      this.prompt.setVisible(false);
      this.actionBtn?.setVisible(false);
      return;
    }
    const label = this.isTouch ? it.name : `[E]  ${it.name}`;
    this.promptT.setText(label);
    const w = this.promptT.width + 28;
    this.promptG.clear();
    drawFrame(this.promptG, -w / 2, -17, w, 34, "gold", { noRivets: true, alpha: 0.95 });
    this.prompt.setPosition(it.x, it.top - 24).setVisible(true).setScale(0.8);
    this.tweens.add({ targets: this.prompt, scale: 1, duration: 140, ease: "Back.easeOut" });
    if (this.actionBtn) this.actionBtn.setLabel(it.verb).setVisible(true);
  }

  _interact() {
    const it = this._target;
    if (!it || this._modals.length || this._leaving) return;
    haptic(12);
    this.sound.play("sfx_ui_click", { volume: 0.4 });
    it.action();
  }

  _talkElder() {
    const line = ELDER_LINES[this._elderLine % ELDER_LINES.length];
    this._elderLine++;
    this.meta.data.elderLine = this._elderLine;
    this.meta._save();
    this.bubbleT.setText(line);
    const w = Math.min(420, this.bubbleT.width + 36),
      h = this.bubbleT.height + 24;
    this.bubbleG.clear();
    drawFrame(this.bubbleG, -w / 2, -h / 2, w, h, "glass", { noRivets: true });
    this.bubble.setPosition(this.elder.x, this.elder.y - this.elder.displayHeight - h / 2 - 34).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.bubble, alpha: 1, duration: 160 });
    this._bubbleUntil = this.time.now + 4500;
    this.tweens.add({ targets: this.elder, scaleY: (S + 1) * 1.06, duration: 120, yoyo: true });
  }

  // Placa da trilha: escolher o Perigo (os não vencidos ficam trancados)
  _showDifficulty() {
    const m = new Modal(this, { title: "PERIGO", subtitle: "Mais perigo, mais recompensa. Vença um nível para liberar o próximo.", w: 760, h: 560 });
    const list = this._modalList(m);
    const last = DIFFICULTY.length - 1;
    const maxSel = this.meta.maxSelectableDifficulty(last);
    const cur = Math.min(this.meta.selectedDifficulty, maxSel);
    const colors = [CSS.green, CSS.txt, CSS.goldHi, hex(PAL.org2), CSS.redHi];
    for (const d of DIFFICULTY) {
      const open = d.id <= maxSel;
      const sel = d.id === cur;
      list.addRow(
        this._shopRow({
          h: 70,
          icon: open ? "ico_skull" : "ico_lock",
          dim: !open,
          name: d.name,
          nameColor: open ? colors[d.id] : CSS.dim,
          desc: open ? `Inimigos ${Math.round(d.hpMult * 100)}% de vida · Recompensa ×${d.rewardMult}` : "Vença o Perigo anterior para liberar",
          right: sel ? "ESCOLHIDO" : open ? "ESCOLHER" : "",
          rightColor: sel ? CSS.green : CSS.txt,
          style: sel ? "green" : open ? "button" : "dark",
          onTap:
            open && !sel
              ? () => {
                  this.meta.setSelectedDifficulty(d.id);
                  m.close();
                  this._refreshAll();
                }
              : null,
        }),
      );
    }
  }

  // Atravessou a trilha: parte para a floresta
  _play() {
    if (this._leaving) return;
    this._leaving = true;
    this.meta.setSelectedCharacter(this.heroId);
    haptic(30);
    this.player.setVelocity(0, -SPEED);
    this._go("GameScene");
  }

  _go(key) {
    this._leaving = true;
    this.cameras.main.fadeOut(350, 5, 8, 6);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(key));
  }
}

Object.assign(CampScene.prototype, MetaPanels);
