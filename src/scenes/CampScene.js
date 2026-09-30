// A Clareira do Guardião — acampamento CAMINHÁVEL entre partidas (como a Casa
// de Hades ou o alojamento do Dead Cells). O jogador anda com os mesmos
// controles da partida; perto de uma construção aparece o aviso para interagir
// (E no teclado / botão de ação no toque):
//   Fogueira → guardiões · Santuário → bênçãos e dons · Forja → armas ·
//   Mural → Conquistas · Horta → plantar/cuidar/colher · Placa da trilha →
//   Perigo · Anciã → conversa.
// A trilha ao norte leva à floresta (começa a partida).
import { GAME, CHARACTERS, DIFFICULTY, META, BLESSINGS, BUILDINGS } from "../config.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Builds, fmtDuration } from "../systems/Builds.js";
import { Garden } from "../systems/Garden.js";
import { REVEALS, pendingReveals } from "../systems/Reveal.js";
import { InputManager } from "../systems/InputManager.js";
import { VirtualJoystick } from "../ui/VirtualJoystick.js";
import { DEBUG } from "../systems/Platform.js";
import { Analytics } from "../systems/Analytics.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera } from "../ui/Theme.js";
import { Modal, closeTopModal } from "../ui/Widgets.js";
import { MetaPanels } from "../ui/MetaPanels.js";
import { CampGarden } from "./CampGarden.js";

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
  "Dizem que, depois do Mapinguari, vem uma noite que não acaba…",
  "Uma arma no nível máximo, com a parceira certa, desperta algo maior.",
  "Planta cuidada em dia sai com qualidade Ouro. Descuidada não morre, só perde o brilho.",
];

export class CampScene extends Phaser.Scene {
  constructor() {
    super("CampScene");
  }

  create() {
    fitCamera(this);
    this.meta = new MetaProgression();
    this.builds = new Builds(this.meta);
    this.garden = new Garden(this.meta, this.builds.level("garden"));
    this.D_HUD = D_HUD;
    // Revelações: pendentes viram cena (1 por visita); o resto aparece normal
    this._pending = pendingReveals(this.meta.data);
    this.meta._save();
    this.W = vw(this);
    this.H = vh(this);
    this._modals = [];
    // O Phaser REAPROVEITA a instância da cena: todo estado de "visita" precisa
    // ser zerado aqui, senão sobra da vez anterior (ex.: herói preso andando).
    this._leaving = false;
    this._exiting = false;
    this._target = null;
    this._bubbleUntil = 0;
    this._nextBuildTick = 0;
    this.scaffold = this.buildTimer = this._birdWork = null;
    this._cutscene = false;
    this.sayBox = null;
    this._elderLine = this.meta.data.elderLine || 0;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Limite antes das árvores da borda (norte: a saída pela trilha dispara antes)
    this.physics.world.setBounds(-CAMP_W / 2 + 40, TOP + 50, CAMP_W - 80, CAMP_H - 50);
    this.solids = this.physics.add.staticGroup();
    this.interactables = [];
    this.glows = [];

    this._ground();
    this._forestWall();
    this._trail();
    this._fire(0, 70);
    this._structures();
    this._gardenWorld();
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
    this._refreshBuildVisuals();
    const adv = this.meta.data.lastRunBuildAdvanceMin || 0;
    if (adv > 0) {
      this.meta.data.lastRunBuildAdvanceMin = 0;
      this.meta._save();
      if (this.builds.job) this.time.delayedCall(900, () => this._toast(`A partida adiantou a obra em ${adv} min`));
    }
    cam.fadeIn(400, 10, 14, 10);
    Analytics.track("camp_enter", {});
    this.time.delayedCall(700, () => this._introSequence());
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
        put(x, CAMP_H / 2 + 240 + off + rnd.between(-10, 10)); // sul: troncos abaixo da câmera, copas só até o limite
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
    this._addInteract({ x, y, top: y - 70, r: 110, name: "FOGUEIRA", verb: "GUARDIÕES", action: () => this._showCharacters(), build: "fire" });
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
      const shown = this._isShown(id);
      const img = this.add.image(x, y, tex).setOrigin(0.5, 1).setScale(S).setDepth(y).setAlpha(shown ? 1 : 0);
      this.add.image(x, y + 4, "px_shadow").setScale(img.displayWidth / 16, 4).setAlpha(0.55).setDepth(y - 1);
      const g = glow ? this._glow(x + glow[0], y + glow[1], glow[3] ?? 2.6, glow[2], true) : null;
      if (g && !shown) g.setVisible(false);
      // Ruína tomada pela Podridão (some na cena de revelação)
      const ruin = shown ? null : this.add.image(x, y, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(y);
      this._solid(x, y - 14, img.displayWidth * 0.8, 30);
      const dot = this._notifyDot(x + img.displayWidth / 2 - 10, y - img.displayHeight + 6).setDepth(D_HUD - 10).setVisible(false);
      const b = { img, dot, x, y, glow: g, ruin, shown };
      this._addInteract({
        x,
        y,
        top: y - img.displayHeight,
        r: 130,
        name,
        verb,
        ruinOf: id,
        action: () => (b.shown ? action() : this._say("Cure a floresta jogando partidas para revelar o que há aqui.")),
        build: BUILDINGS[id] ? id : null,
      });
      this.buildings[id] = b;
    };
    B("shrine", "camp_shrine", "SANTUÁRIO", "BÊNÇÃOS E DONS", -430, -130, () => this._showBlessings(), [0, -75, 0xffe58f, 2.4]);
    B("forge", "camp_forge", "FORJA", "FORJAR ARMAS", 440, -120, () => this._showArsenal(), [-8, -18, 0xff8a3c, 2.8]);
    B("board", "camp_board", "MURAL", "CONQUISTAS E LENDAS", -420, 280, () => this._showBoard());

    // Ninho do João-de-barro (o construtor chega com as obras) + o pássaro
    const nx = 450,
      ny = 290;
    const nestShown = this._isShown("nest");
    const nestShadow = this.add.image(nx, ny + 4, "px_shadow").setScale(4, 3).setAlpha(nestShown ? 0.5 : 0).setDepth(ny - 1);
    const nestImg = this.add.image(nx, ny, "camp_nest").setOrigin(0.5, 1).setScale(S).setDepth(ny).setAlpha(nestShown ? 1 : 0);
    this._solid(nx, ny - 6, 16, 10);
    this.bird = this.add.sprite(nx + 34, ny - 2, "camp_bird", 0).setOrigin(0.5, 1).setScale(S).setDepth(ny + 1).play("bird_idle").setAlpha(nestShown ? 1 : 0);
    this.nest = { x: nx + 34, y: ny - 2 };
    this.buildings.nest = { dot: this._notifyDot(nx, ny - 80).setDepth(D_HUD - 10).setVisible(false), img: nestImg, shadow: nestShadow, x: nx, y: ny, shown: nestShown };
    this._addInteract({ x: nx, y: ny, top: ny - 100, r: 100, name: "JOÃO-DE-BARRO", verb: "OBRAS", action: () => this._showWorks(), hiddenUntil: "nest" });
    // A fogueira também é construção (nível) — posição para a obra aparecer
    this.buildings.fire = { x: 0, y: 70, img: null };

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
    this.woodBox = [
      fix(this.add.graphics()),
      fix(this.add.image(W - 180, 94, "ico_wood").setScale(3)),
      fix(text(this, W - 34, 94, "", { size: 22, color: "#ffc86b", origin: [1, 0.5], stroke: true })),
    ];
    drawFrame(this.woodBox[0], W - 204, 72, 186, 44, "dark");
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
    const wood = this.meta.wood;
    this.woodBox.forEach((o) => o.setVisible(wood > 0));
    this.woodBox[2].setText(String(wood));
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
    this.buildings.shrine.dot.setVisible(canBless && this.buildings.shrine.shown);
    this.buildings.nest.dot.setVisible(this.buildings.nest.shown && !this.builds.job && this._workIds().some((id) => !this.builds.blocker(id)));
    this.buildings.forge.dot.setVisible(canArsenal && this.buildings.forge.shown);
    this._refreshGardenWorld();
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
    // Saindo: segue sozinho pela trilha e some no alto da tela (câmera parada)
    if (this._exiting) {
      p.setVelocity(0, -SPEED * 0.9);
      if (p.anims.currentAnim?.key !== `${this.heroId}_walk`) p.play(`${this.heroId}_walk`);
      p.setDepth(p.y + 20);
      this.shadow.setPosition(p.x, p.y + 20).setDepth(p.y + 19);
      return;
    }
    const busy = this._modals.length > 0 || this._leaving || this._cutscene;
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
      if (it.hiddenUntil && !this.buildings[it.hiddenUntil]?.shown) continue;
      const d = Math.hypot(p.x - it.x, p.y + 20 - it.y);
      if (d < it.r && d < bd) {
        best = it;
        bd = d;
      }
    }
    this._setTarget(busy ? null : best);
    if (this.inputMgr.consumeInteract() && !busy) this._interact();

    // Saída: passou entre as tochas da trilha ao norte
    if (!busy && p.y < TOP + 130 && Math.abs(p.x) < TRAIL_HALF) this._play();

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
    if (time > (this._nextBuildTick || 0)) {
      this._nextBuildTick = time + 500;
      this._tickBuilds();
      this._refreshGardenWorld();
    }
  }

  // =========================================================================
  // REVELAÇÕES (a Clareira sai das ruínas por progresso) + fala da Anciã
  // =========================================================================
  _isShown(id) {
    return !REVEALS.some((r) => r.id === id) || this.meta.data.revealed.includes(id);
  }

  _introSequence() {
    const d = this.meta.data;
    const reveal = () => this._pending[0] && this._playReveal(this._pending[0]);
    if (!d.campIntroSeen) {
      d.campIntroSeen = true;
      this.meta._save();
      this._say("A Podridão tomou nosso lar. Cada partida devolve um pouco da floresta.", reveal);
    } else reveal();
  }

  // Cena: câmera vai até a ruína, os cipós se desfazem, a construção aparece
  // e a Anciã a apresenta em uma frase. Uma por visita (uma novidade por vez).
  _playReveal(r) {
    const b = this.buildings[r.id];
    if (!b) return;
    this._cutscene = true;
    this._setTarget(null);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(b.x, b.y - 80, 700, "Sine.easeInOut");
    this.time.delayedCall(800, () => {
      // Cipós da Podridão se desfazendo
      for (let i = 0; i < 30; i++) {
        const p = this.add.image(b.x + (Math.random() - 0.5) * 110, b.y - Math.random() * 90, "px_dot2").setScale(3).setTint(i % 3 ? 0x8a3fa0 : 0xff7eb6).setDepth(D_HUD - 7);
        this.tweens.add({ targets: p, y: p.y - 40 - Math.random() * 50, alpha: 0, duration: 900 + Math.random() * 500, onComplete: () => p.destroy() });
      }
      if (b.ruin) this.tweens.add({ targets: b.ruin, alpha: 0, duration: 600, onComplete: () => b.ruin.destroy() });
      const show = [b.img, b.shadow].filter(Boolean);
      this.tweens.add({ targets: show, alpha: 1, duration: 700, delay: 300 });
      if (r.id === "nest") this.tweens.add({ targets: this.bird, alpha: 1, duration: 700, delay: 500 });
      if (b.img) this.tweens.add({ targets: b.img, scaleY: { from: S * 0.7, to: S }, duration: 600, delay: 300, ease: "Back.easeOut" });
      b.glow?.setVisible(true);
      b.reveal?.();
      this.sound.play("sfx_levelup", { volume: 0.6 });
      b.shown = true;
      this.meta.data.revealed.push(r.id);
      this.meta._save();
      Analytics.track("camp_reveal", { id: r.id, runs: this.meta.data.runsPlayed || 0 });
      this.time.delayedCall(900, () =>
        this._say(r.line, () => {
          cam.pan(this.player.x, this.player.y, 500, "Sine.easeInOut");
          this.time.delayedCall(520, () => {
            cam.startFollow(this.player, true, 0.14, 0.14);
            this._cutscene = false;
            this._refreshAll();
          });
        }),
      );
    });
  }

  // Fala da Anciã numa caixa na parte de baixo da tela (some sozinha)
  _say(line, onDone) {
    this.sayBox?.destroy();
    const W = this.W,
      H = this.H;
    const w = Math.min(760, W - 40);
    const c = (this.sayBox = this.add.container(W / 2, H - 92).setScrollFactor(0).setDepth(D_HUD + 6));
    const g = this.add.graphics();
    drawFrame(g, -w / 2, -52, w, 104, "gold", { alpha: 0.96 });
    const face = this.add.sprite(-w / 2 + 52, 30, "camp_elder", 0).setOrigin(0.5, 1).setScale(4).setFlipX(true);
    const who = text(this, -w / 2 + 100, -30, "ANCIÃ DA FOGUEIRA", { size: 15, color: CSS.goldHi, origin: [0, 0.5] });
    const t = text(this, -w / 2 + 100, 8, line, { size: 19, color: CSS.txt, origin: [0, 0.5], wrap: w - 130 });
    c.add([g, face, who, t]);
    c.setAlpha(0).setY(H - 70);
    this.tweens.add({ targets: c, alpha: 1, y: H - 92, duration: 220, ease: "Back.easeOut" });
    const ms = Math.max(3200, line.length * 55);
    this.time.delayedCall(ms, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() });
      onDone?.();
    });
  }

  // =========================================================================
  // OBRAS (João-de-barro)
  // =========================================================================
  // Conclui a obra quando o tempo acaba e atualiza o cronômetro no mapa
  _tickBuilds() {
    const done = this.builds.tick();
    if (done) this._onBuildDone(done);
    const job = this.builds.job;
    if (job && this.buildTimer) {
      const free = this.builds.canFinishFree();
      this.buildTimer.setText(free ? "PRONTA!" : fmtDuration(this.builds.remainingMs()));
      this.buildTimer.setColor(free ? CSS.green : CSS.goldHi);
    }
  }

  // Mostra (ou tira) a obra no mapa: andaime, cronômetro e o pássaro trabalhando
  _refreshBuildVisuals() {
    this.scaffold?.destroy();
    this.buildTimer?.destroy();
    this.scaffold = this.buildTimer = null;
    this.tweens.killTweensOf(this.bird);
    this._birdWork?.remove();
    const job = this.builds.job;
    if (!job) {
      // Pássaro volta para o ninho
      this.bird.setFlipX(false);
      this.tweens.add({ targets: this.bird, x: this.nest.x, y: this.nest.y, duration: 900, ease: "Sine.easeInOut", onUpdate: () => this.bird.setDepth(this.bird.y + 1) });
      return;
    }
    const b = this.buildings[job.id];
    const top = b.img ? b.y - b.img.displayHeight : b.y - 70;
    const w = b.img ? b.img.displayWidth : 90;
    // Andaime de madeira na frente da construção
    if (b.img) {
      const g = (this.scaffold = this.add.graphics().setDepth(b.y + 2));
      const x0 = b.x - w / 2 + 6,
        x1 = b.x + w / 2 - 6;
      g.fillStyle(PAL.ink, 1);
      for (const x of [x0, x1]) g.fillRect(x - 3, top + 10, 8, b.y - top - 6);
      g.fillStyle(PAL.n3, 1);
      for (const x of [x0, x1]) g.fillRect(x - 1, top + 12, 4, b.y - top - 10);
      for (let y = top + 30; y < b.y - 10; y += 34) {
        g.fillStyle(PAL.ink, 1).fillRect(x0 - 4, y - 3, x1 - x0 + 10, 9);
        g.fillStyle(PAL.n4, 1).fillRect(x0 - 2, y - 1, x1 - x0 + 6, 5);
      }
    }
    // Cronômetro sobre a obra
    this.buildTimer = text(this, b.x, top - 18, "", { size: 18, color: CSS.goldHi, origin: 0.5, stroke: true }).setDepth(D_HUD - 6);
    // O João-de-barro voa até a obra e fica martelando (lado esquerdo: o
    // canto direito é do selo "!")
    const bx = b.x - w / 2 + 2,
      by = top + 34;
    this.bird.setFlipX(bx < this.bird.x);
    this.tweens.add({
      targets: this.bird,
      x: bx,
      y: by,
      duration: 1100,
      ease: "Sine.easeInOut",
      onUpdate: () => this.bird.setDepth(D_NIGHT - 1),
      onComplete: () => {
        this.bird.setFlipX(false);
        this._birdWork = this.time.addEvent({
          delay: 420,
          loop: true,
          callback: () => {
            this.tweens.add({ targets: this.bird, y: by - 8, duration: 110, yoyo: true });
            const d = this.add.image(bx + 10, by - 4, "px_dot2").setScale(3).setTint(0xc88a5a).setDepth(D_NIGHT - 1);
            this.tweens.add({ targets: d, y: by + 14, x: bx + 20 + Math.random() * 10, alpha: 0, duration: 500, onComplete: () => d.destroy() });
          },
        });
      },
    });
    this._tickBuilds();
  }

  _onBuildStarted() {
    this._refreshBuildVisuals();
    this._refreshAll();
  }

  // Obra pronta: festa curta + efeitos (novo guardião etc.)
  _onBuildDone(r) {
    const name = BUILDINGS[r.id].name;
    if (r.id === "garden") this.garden.setLevel(r.to);
    const b = this.buildings[r.id];
    this.sound.play("sfx_levelup", { volume: 0.6 });
    haptic(40);
    for (let i = 0; i < 26; i++) {
      const c = this.add.image(b.x, b.y - 60, "px_dot2").setScale(3).setTint([0xf2c14e, 0x9ccf62, 0xff7a3c, 0x5cc8ff][i % 4]).setDepth(D_HUD - 7);
      const a = Math.random() * Math.PI * 2;
      this.tweens.add({ targets: c, x: b.x + Math.cos(a) * (60 + Math.random() * 80), y: b.y - 60 + Math.sin(a) * 60 + 40, alpha: 0, duration: 1000 + Math.random() * 500, ease: "Cubic.easeOut", onComplete: () => c.destroy() });
    }
    this._toast(`${name} chegou ao nível ${r.to}!`);
    Analytics.track("build_done", { id: r.id, level: r.to });
    this._refreshBuildVisuals();
    this._refreshAll();
  }

  // Construções que o João-de-barro pode melhorar (as já reveladas)
  _workIds() {
    return ["fire", "shrine", "forge", "garden"].filter((id) => this._isShown(id));
  }

  // Aviso curto no alto da tela
  _toast(msg) {
    const W = this.W;
    const c = this.add.container(W / 2, 110).setScrollFactor(0).setDepth(D_HUD + 5);
    const t = text(this, 0, 0, msg, { size: 22, color: CSS.goldHi, origin: 0.5, stroke: true });
    const g = this.add.graphics();
    drawFrame(g, -t.width / 2 - 20, -22, t.width + 40, 44, "gold", { alpha: 0.95 });
    c.add([g, t]);
    c.setAlpha(0).setY(90);
    this.tweens.add({ targets: c, alpha: 1, y: 110, duration: 240, ease: "Back.easeOut" });
    this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 400, onComplete: () => c.destroy() });
  }

  _setTarget(it) {
    if (it === this._target) return;
    this._target = it;
    if (!it) {
      this.prompt.setVisible(false);
      this.actionBtn?.setVisible(false);
      return;
    }
    const ruin = it.ruinOf && !this.buildings[it.ruinOf]?.shown;
    const name = ruin ? "RUÍNA" : it.build ? `${it.name} · NV ${this.builds.level(it.build)}` : it.name;
    const label = this.isTouch ? name : `[E]  ${name}`;
    this.promptT.setText(label);
    const w = this.promptT.width + 28;
    this.promptG.clear();
    drawFrame(this.promptG, -w / 2, -17, w, 34, "gold", { noRivets: true, alpha: 0.95 });
    this.prompt.setPosition(it.x, it.top - 24).setVisible(true).setScale(0.8);
    this.tweens.add({ targets: this.prompt, scale: 1, duration: 140, ease: "Back.easeOut" });
    if (this.actionBtn) this.actionBtn.setLabel(ruin ? "EXAMINAR" : it.verb).setVisible(true);
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
    this._exiting = true;
    this.meta.setSelectedCharacter(this.heroId);
    haptic(30);
    this._setTarget(null);
    // Câmera desliza até a boca da trilha e para: ele some no alto da tela
    this.cameras.main.stopFollow();
    this.cameras.main.pan(0, TOP + 170, 450, "Sine.easeInOut");
    this.player.setCollideWorldBounds(false);
    this.player.body.checkCollision.none = true;
    this.player.x = Phaser.Math.Clamp(this.player.x, -TRAIL_HALF / 2, TRAIL_HALF / 2);
    this.tweens.add({ targets: this.player, x: 0, duration: 400 }); // centraliza na trilha
    this.tweens.add({ targets: [this.hint, this.hudInfo], alpha: 0, duration: 300 });
    Analytics.track("camp_exit", {});
    // Escurece enquanto ele some entre as árvores e começa a partida
    this.time.delayedCall(650, () => this._go("GameScene"));
  }

  _go(key) {
    this._leaving = true;
    this.cameras.main.fadeOut(key === "GameScene" ? 650 : 350, 5, 8, 6);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(key));
  }
}

Object.assign(CampScene.prototype, MetaPanels, CampGarden);
