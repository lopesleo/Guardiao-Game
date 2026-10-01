// A PRIMEIRA queda (ou a primeira vitória): em vez de uma tela seca de resultados, o guardião
// desmaia, acorda ao lado da fogueira e a Anciã explica o jogo em poucas falas. É o tutorial
// narrativo: aparece uma vez só, é pulável e termina na tela de resultados normal.
//   · derrota → desmaio, olhos que abrem, herói deitado que se senta
//   · vitória → herói em pé ao lado da Anciã, tom de festa e aviso do próximo Perigo
import { CSS } from "../art/Palette.js";
import { text, drawFrame, Button, vw, vh, fitCamera, haptic } from "../ui/Theme.js";
import { formatTime } from "../utils.js";
import { Analytics } from "../systems/Analytics.js";
import { MetaProgression } from "../systems/MetaProgression.js";

const SC = 4; // escala dos personagens (a mesma do acampamento)
const TYPE_MS = 24; // ms por letra

export class FirstDefeatScene extends Phaser.Scene {
  constructor() {
    super("FirstDefeatScene");
  }

  create(data) {
    fitCamera(this);
    // O Phaser REAPROVEITA a instância da cena: zera todo estado de "visita"
    this._leaving = false;
    this._ready = false;
    this._typing = false;
    this._idx = -1;
    this._t0 = this.time.now;
    this.won = !!data.won;
    this.charId = data.character || "guardian";
    this.next = data.next || {};
    const W = (this.W = vw(this)),
      H = (this.H = vh(this));

    // Marca como vista já na entrada: se o app fechar no meio, não repete a cena
    const meta = new MetaProgression();
    meta.data.firstDefeatSeen = true;
    meta._save();
    Analytics.track("first_story_start", { won: this.won });

    this.lines = this._script();
    this._buildWorld();
    this._buildDialogBox();

    // Pular (sempre disponível) e avançar (toque / Espaço / Enter)
    this.skipBtn = new Button(this, W - 96, 40, 150, 48, "PULAR", () => this._finish(true), { size: 20 });
    this.skipBtn.setDepth(1200).setAlpha(0.85);
    this.input.on("pointerdown", (p, over) => {
      if (over.length) return; // clicou num botão
      this._advance();
    });
    this.input.keyboard.on("keydown-SPACE", () => this._advance());
    this.input.keyboard.on("keydown-ENTER", () => this._advance());
    this.input.keyboard.on("keydown-ESC", () => this._finish(true));

    if (this.cache.audio.exists("music_menu")) {
      this.music = this.sound.add("music_menu", { loop: true, volume: 0 });
      this.music.play();
      this.tweens.add({ targets: this.music, volume: 0.28, duration: 1800 });
    }

    if (this.won) this._openWin();
    else this._fall(() => this._wake(() => this._begin()));
  }

  onBack() {
    this._finish(true);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Roteiro (dinâmico: usa os números reais da partida)
  // ---------------------------------------------------------------------------
  _script() {
    const n = this.next;
    const secs = Math.floor((n.elapsedMs || 0) / 1000);
    const time = formatTime(secs * 1000);
    const kills = n.kills || 0;
    const coins = n.coinsGained || 0;
    if (this.won) {
      return [
        { t: "Você conseguiu! O Mapinguari está livre da Podridão, e logo na primeira partida!" },
        { t: "Eu sou a Anciã da Fogueira. Esta é a Clareira, o último canto da floresta que a Podridão ainda não tomou." },
        { t: `Você trouxe ${coins} moedas da mata. Com elas vamos reerguer a Clareira, peça por peça.`, sit: true },
        { t: "Mas a Podridão tem mais fôlego do que parece. O próximo Perigo será mais cruel. Prepare-se, guardião." },
      ];
    }
    return [
      { t: "Calma, guardião… respire. Você caiu fundo na mata, mas está a salvo ao lado da fogueira." },
      { t: "Eu sou a Anciã da Fogueira. Esta é a Clareira, o último canto da floresta que a Podridão ainda não tomou.", sit: true },
      { t: `Você resistiu ${time} e derrubou ${kills} criaturas, e ainda trouxe ${coins} moedas. Nada mal para a primeira vez!` },
      { t: "Lá fora, basta caminhar: suas armas atacam sozinhas, e a cada nível a floresta oferece uma carta. Misture fogo, gelo e raio: quando se encontram, nascem reações." },
      { t: "Ninguém vence a Podridão de primeira. Cada queda deixa você mais forte, e as moedas vão reerguer a Clareira. Outras lendas da mata esperam ser libertadas para lutar ao seu lado." },
      { t: "Descanse um instante. Quando estiver pronto, a floresta o espera." },
    ];
  }

  // ---------------------------------------------------------------------------
  // Cenário: clareira à noite com a fogueira, o herói e a Anciã
  // ---------------------------------------------------------------------------
  _buildWorld() {
    const W = this.W,
      H = this.H;
    const gy = Math.round(H * 0.5); // linha do horizonte
    const key = `fd_sky_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W, H);
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, gy + 40);
      g.addColorStop(0, "#070b14");
      g.addColorStop(0.7, "#14213a");
      g.addColorStop(1, "#1d3340");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      c.refresh();
    }
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
    // Estrelas e lua
    for (let i = 0; i < 46; i++) {
      const s = this.add.image(Math.random() * W, Math.random() * (gy - 20), "px_dot1").setScale(1.5 + Math.random() * 1.5).setAlpha(0.3 + Math.random() * 0.5).setDepth(1);
      this.tweens.add({ targets: s, alpha: 0.15, duration: 900 + Math.random() * 1500, yoyo: true, repeat: -1, delay: Math.random() * 1500 });
    }
    this.add.image(W * 0.82, 96, "fx_glow").setScale(2.6).setTint(0xcfe2ff).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    this.add.circle(W * 0.82, 96, 20, 0xeaf2ff).setDepth(1);
    // Chão
    this.add.tileSprite(0, gy, W, H - gy, "env_ground").setOrigin(0).setTileScale(3).setTint(0x3a4e6e).setDepth(2);
    // Silhueta de árvores no horizonte
    const env = this.registry.get("envKeys");
    const trees = [...env.pines, ...env.trees.slice(0, 5)];
    for (let x = -30; x < W + 60; x += 46 + Math.random() * 34) {
      this.add.image(x, gy + 8 + Math.random() * 16, "env", trees[Math.floor(Math.random() * trees.length)]).setOrigin(0.5, 1).setScale(3 + Math.random() * 1.2).setTint(0x0b1620).setDepth(3);
    }
    // Fogueira
    const fx = Math.round(W / 2),
      fy = Math.round(H * 0.66);
    this.fireX = fx;
    this.fireY = fy;
    this.add.image(fx, fy + 4, "camp_fire").setScale(3).setDepth(fy - 30);
    this.glowBig = this.add.image(fx, fy - 18, "fx_glow").setScale(7).setTint(0xff9a4c).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy + 5);
    this.add.image(fx, fy + 4, "fx_glow").setScale(1.6).setTint(0xff5a1e).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy + 5);
    this.tweens.add({ targets: this.glowBig, alpha: 0.24, scale: 6.4, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.time.addEvent({ delay: 70, loop: true, callback: () => this._flame(fx, fy - 4) });
    // Vaga-lumes
    for (let i = 0; i < 14; i++) {
      const p = this.add.image(Math.random() * W, gy + Math.random() * (H - gy), "px_dot2").setScale(2).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
      this.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 120, y: p.y - 40 - Math.random() * 60, alpha: { from: 0.1, to: 0.9 }, duration: 2400 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
    // Personagens, na altura da fogueira (um pouco à frente dela)
    const by = fy + 26;
    this.heroX = fx - 130;
    this.hero = this.add.sprite(this.heroX, by, `hero_${this.charId}`, 0).setOrigin(0.5, 1).setScale(SC).setDepth(by);
    this.elder = this.add.sprite(fx + 130, by, "camp_elder", 0).setOrigin(0.5, 1).setScale(SC).setFlipX(true).setDepth(by);
    this.elder.play("elder_idle");
    this.heroBaseY = by;
    if (!this.won) {
      // Deitado: gira em torno dos pés, com a cabeça virada para a fogueira
      this.hero.setAngle(84).setX(this.heroX - 64);
      this.tweens.add({ targets: this.hero, scaleY: SC * 1.03, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); // respira
    } else {
      this.hero.play(`${this.charId}_idle`);
    }
    // Vinheta
    const vk = `fd_vig_${W}x${H}`;
    if (!this.textures.exists(vk)) {
      const c = this.textures.createCanvas(vk, W, H);
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(4,6,12,0.7)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      c.refresh();
    }
    this.add.image(0, 0, vk).setOrigin(0).setDepth(80);
    // "Pálpebras": cobrem a tela inteira até o herói acordar
    this.lidTop = this.add.rectangle(0, 0, W, H / 2 + 1, 0x000000).setOrigin(0).setDepth(900);
    this.lidBot = this.add.rectangle(0, H / 2, W, H / 2 + 1, 0x000000).setOrigin(0).setDepth(900);
    if (this.won) {
      this.lidTop.setVisible(false);
      this.lidBot.setVisible(false);
    }
  }

  _flame(x, y) {
    const f = this.add
      .image(x + (Math.random() - 0.5) * 20, y, "px_puff")
      .setScale(2.2 + Math.random())
      .setTint([0xffe58f, 0xffb36b, 0xff7a3c][Math.floor(Math.random() * 3)])
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.fireY + 6);
    this.tweens.add({ targets: f, y: y - 36 - Math.random() * 32, x: f.x + (Math.random() - 0.5) * 12, scale: 0.4, alpha: 0, duration: 520 + Math.random() * 260, onComplete: () => f.destroy() });
    if (Math.random() < 0.22) {
      const e = this.add.image(x, y - 14, "px_dot1").setScale(3).setTint(0xffe58f).setDepth(this.fireY + 6);
      this.tweens.add({ targets: e, y: y - 110 - Math.random() * 60, x: x + (Math.random() - 0.5) * 60, alpha: 0, duration: 1300, onComplete: () => e.destroy() });
    }
  }

  // ---------------------------------------------------------------------------
  // Queda (só na derrota): o herói cai no escuro e a tela some
  // ---------------------------------------------------------------------------
  _fall(done) {
    const W = this.W,
      H = this.H;
    const cx = W / 2,
      cy = H / 2;
    const glow = this.add.image(cx, cy + 6, "fx_glow").setScale(6).setTint(0xe8434f).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
    const h = this.add.sprite(cx, cy + 56, `hero_${this.charId}`, 0).setOrigin(0.5, 1).setScale(9).setDepth(951);
    h.play(`${this.charId}_idle`);
    const msg = text(this, cx, H - 150, "A Podridão te alcançou…", { size: 28, color: "#c97a86", origin: 0.5, stroke: true, strokeW: 6 }).setDepth(952).setAlpha(0);
    this.tweens.add({ targets: glow, alpha: 0.45, duration: 600 });
    this.tweens.add({ targets: msg, alpha: 1, duration: 700, delay: 500 });
    // golpe final
    this.time.delayedCall(550, () => {
      h.setTintFill(0xff5a6e);
      this.time.delayedCall(130, () => h.clearTint());
      this.sound.play("sfx_player_hit", { volume: 0.8, rate: 0.8 });
      this.cameras.main.shake(200, 0.008);
      haptic(50);
    });
    // cai
    this.time.delayedCall(1000, () => {
      h.stop();
      this.sound.play("sfx_death", { volume: 0.5, rate: 0.7 });
      this.tweens.add({ targets: h, angle: 84, y: cy + 92, duration: 760, ease: "Quad.easeIn" });
      this.tweens.add({ targets: glow, alpha: 0.12, duration: 900 });
    });
    this.time.delayedCall(1800, () => {
      this.sound.play("sfx_hit", { volume: 0.45, rate: 0.5 });
      this.cameras.main.shake(120, 0.005);
      haptic(25);
    });
    this.time.delayedCall(3300, () => {
      this.tweens.add({ targets: [h, glow, msg], alpha: 0, duration: 700, onComplete: () => [h, glow, msg].forEach((o) => o.destroy()) });
    });
    this.time.delayedCall(4100, done);
  }

  // Olhos abrindo: duas piscadas, a segunda abre de vez
  _wake(done) {
    const H = this.H;
    const openTo = (frac, ms, ease = "Sine.easeInOut") => {
      const off = (H / 2) * frac;
      this.tweens.add({ targets: this.lidTop, y: -off, duration: ms, ease });
      this.tweens.add({ targets: this.lidBot, y: H / 2 + off, duration: ms, ease });
    };
    this.sound.play("sfx_ui_hover", { volume: 0.25, rate: 0.5 });
    openTo(0.22, 700);
    this.time.delayedCall(1000, () => openTo(0, 380));
    this.time.delayedCall(1550, () => {
      openTo(1.02, 1500);
      this.sound.play("sfx_ui_hover", { volume: 0.25, rate: 0.7 });
    });
    this.time.delayedCall(3200, done);
  }

  _openWin() {
    this.cameras.main.fadeIn(900, 5, 8, 6);
    this.time.delayedCall(1100, () => this._begin());
  }

  // Fim da cinematografia: a partir daqui o jogador conduz as falas
  _begin() {
    this._ready = true;
    this._advance();
  }

  // ---------------------------------------------------------------------------
  // Diálogo
  // ---------------------------------------------------------------------------
  _buildDialogBox() {
    const W = this.W,
      H = this.H;
    const w = Math.min(820, W - 40);
    this.boxW = w;
    const c = (this.box = this.add.container(W / 2, H - 100).setDepth(1000).setAlpha(0).setVisible(false));
    const g = this.add.graphics();
    drawFrame(g, -w / 2, -64, w, 128, "gold", { alpha: 0.97 });
    const face = this.add.sprite(-w / 2 + 56, 40, "camp_elder", 0).setOrigin(0.5, 1).setScale(4).setFlipX(true);
    const who = text(this, -w / 2 + 108, -42, "ANCIÃ DA FOGUEIRA", { size: 15, color: CSS.goldHi, origin: [0, 0.5] });
    this.lineT = text(this, -w / 2 + 108, -26, "", { size: 19, color: CSS.txt, origin: [0, 0], lineSpacing: 3 });
    // texto invisível usado só para medir/quebrar linhas (a digitação não "pula")
    this.measureT = text(this, 0, 0, "", { size: 19, origin: [0, 0], wrap: w - 140, lineSpacing: 3 }).setVisible(false);
    this.more = this.add.image(w / 2 - 26, 46, "ico_play").setScale(2).setAngle(90);
    this.tweens.add({ targets: this.more, y: 52, duration: 450, yoyo: true, repeat: -1 });
    this.more.setVisible(false);
    c.add([g, face, who, this.lineT, this.more]);
    this.hint = text(this, W / 2, H - 20, "toque para continuar", { size: 14, color: CSS.muted, origin: 0.5 }).setDepth(1000).setAlpha(0);
  }

  _advance() {
    if (this._leaving || !this._ready) return;
    if (this._idx < 0 && !this.box.visible) {
      // primeira fala: aparece a caixa
      this.box.setVisible(true);
      this.tweens.add({ targets: this.box, alpha: 1, duration: 260 });
      this.tweens.add({ targets: this.hint, alpha: 0.75, duration: 600, delay: 1500 });
    }
    if (this._typing) {
      this._completeLine();
      return;
    }
    if (this._idx + 1 >= this.lines.length) {
      this._finish(false);
      return;
    }
    this._idx++;
    const L = this.lines[this._idx];
    if (L.sit && !this.won) this._sitUp();
    this._startLine(L.t);
  }

  _startLine(str) {
    const wrapped = this.measureT.getWrappedText(str).join("\n");
    this._full = wrapped;
    this._shown = 0;
    this._typing = true;
    this.more.setVisible(false);
    this.lineT.setText("");
    // a Anciã "fala": um pulinho a cada fala
    this.tweens.add({ targets: this.elder, scaleY: SC * 1.06, duration: 120, yoyo: true });
    this._typeEvt?.remove();
    this._typeEvt = this.time.addEvent({
      delay: TYPE_MS,
      loop: true,
      callback: () => {
        this._shown++;
        this.lineT.setText(this._full.slice(0, this._shown));
        if (this._shown % 3 === 0) this.sound.play("sfx_ui_hover", { volume: 0.06, rate: 0.9 + Math.random() * 0.4 });
        if (this._shown >= this._full.length) this._completeLine();
      },
    });
  }

  _completeLine() {
    this._typeEvt?.remove();
    this._typing = false;
    this.lineT.setText(this._full);
    this.more.setVisible(true);
  }

  // O herói acorda de vez: senta/levanta ao lado da fogueira
  _sitUp() {
    if (this._sat) return;
    this._sat = true;
    this.tweens.killTweensOf(this.hero);
    this.tweens.add({
      targets: this.hero,
      angle: 0,
      x: this.heroX,
      y: this.heroBaseY,
      scaleY: SC,
      duration: 700,
      ease: "Back.easeOut",
      onComplete: () => this.hero.play(`${this.charId}_idle`),
    });
    this.sound.play("sfx_dash", { volume: 0.3, rate: 0.6 });
  }

  _finish(skipped) {
    if (this._leaving) return;
    this._leaving = true;
    Analytics.track("first_story_end", { won: this.won, skipped, line: this._idx + 1, of: this.lines.length, ms: Math.round(this.time.now - this._t0) });
    this._typeEvt?.remove();
    if (this.music) this.tweens.add({ targets: this.music, volume: 0, duration: 500, onComplete: () => this.music?.stop() });
    this.cameras.main.fadeOut(550, 5, 8, 6);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.music?.stop();
      this.scene.start("GameOverScene", this.next);
    });
  }
}
