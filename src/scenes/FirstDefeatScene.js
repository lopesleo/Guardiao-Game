// A PRIMEIRA queda (ou a primeira vitória) como CENA: em vez de uma tela seca de resultados,
// um pequeno curta. Dois planos, câmera e som próprios:
//   1 · A QUEDA     floresta corrompida → três lobos → golpe → câmera lenta → baque → escuro
//   2 · A CLAREIRA  título → foco volta → a Anciã chega pela mata → o guardião acorda
// Depois vêm as falas da Anciã (o tutorial narrativo). Uma vez só, sempre pulável.
// Os guardiões são desenhados quadro a quadro em HeroRig.js (não é o sprite de caminhada).
import { CSS } from "../art/Palette.js";
import { text, drawFrame, Button, vw, vh, fitCamera, haptic } from "../ui/Theme.js";
import { formatTime } from "../utils.js";
import { Analytics } from "../systems/Analytics.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Settings } from "../systems/Settings.js";
import { RIG_W, RIG_H, GROUND, RIG_KEYS } from "../art/HeroRig.js";

const SC = 4; // escala dos personagens (a mesma do acampamento)
const TYPE_MS = 24; // ms por letra
const OX = 22 / RIG_W; // origem do sprite do rig: sob o quadril, no chão
const OY = (GROUND + 0.5) / RIG_H;
const FRAME = (k) => RIG_KEYS.indexOf(k);
const BAR_H = 0.1; // altura das faixas de cinema (fração da tela)

export class FirstDefeatScene extends Phaser.Scene {
  constructor() {
    super("FirstDefeatScene");
  }

  create(data) {
    // O Phaser REAPROVEITA a instância da cena: zera todo estado de "visita"
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
    fitCamera(this);
    this._leaving = false;
    this._ready = false;
    this._typing = false;
    this._idx = -1;
    this._t0 = this.time.now;
    this._groups = {};
    this._impacted = false;
    this._arrived = false;
    this._waking = false;
    this.fx = null;
    this.won = !!data.won;
    // modo curto (2ª morte em diante): só o herói caindo, depois a tela de resultados
    this.short = !!data.short;
    this.charId = data.character || "guardian";
    this.next = data.next || {};
    const W = (this.W = vw(this)),
      H = (this.H = vh(this));

    // Segunda câmera só para a interface: o zoom/desfoque do "filme" não a atinge
    this.uiCam = this.cameras.add(0, 0, W, H);
    this._onResize = () => this.uiCam.setSize(vw(this), vh(this));
    this.scale.on("resize", this._onResize);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this._onResize);
      this.tweens.timeScale = 1;
      this.anims.globalTimeScale = 1;
      this._stopSounds();
    });

    if (this.short) {
      Analytics.track("death_scene", {});
    } else {
      // Marca como vista já na entrada: se o app fechar no meio, não repete a cena
      const meta = new MetaProgression();
      meta.data.firstDefeatSeen = true;
      meta.data.campIntroSeen = true; // a Anciã já se apresentou aqui: a Clareira não repete a fala de boas-vindas
      meta._save();
      Analytics.track("first_story_start", { won: this.won });
    }

    this.lines = this._script();
    this._initFx();
    if (!this.short) this._buildClearing();
    if (!this.won) this._buildForest();
    this._buildUi();

    // Avançar (toque / Espaço / Enter) e pular
    this.input.on("pointerdown", (p, over) => {
      if (over.length) return; // clicou num botão
      if (this.short) return this._finish(true); // cena curta: tocar já passa
      this._advance();
    });
    this.input.keyboard.on("keydown-SPACE", () => this._advance());
    this.input.keyboard.on("keydown-ENTER", () => this._advance());
    this.input.keyboard.on("keydown-ESC", () => this._finish(true));

    if (this.won) this._playWin();
    else this._playDefeat();
  }

  update(time) {
    if (this.elderGlow && this.elder) {
      this.elderGlow.setPosition(this.elder.x - 22, this.elder.y - 64 * (this.elder.scaleY / SC));
      this.elderGlow.setAlpha(0.3 + Math.sin(time / 90) * 0.06 + Math.sin(time / 37) * 0.03);
    }
  }

  onBack() {
    this._finish(true);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Utilidades: duas câmeras, grupos de cenário, linha do tempo, som
  // ---------------------------------------------------------------------------
  _w(o, grp) {
    this.uiCam.ignore(o);
    if (grp) (this._groups[grp] ??= []).push(o);
    return o;
  }
  _u(o) {
    this.cameras.main.ignore(o);
    return o;
  }
  _show(grp, on) {
    for (const o of this._groups[grp] || []) o.setVisible(on);
  }
  _at(ms, fn) {
    return this.time.delayedCall(ms, () => !this._leaving && fn());
  }
  _sfx(key, volume = 0.5, rate = 1) {
    this.sound.play(key, { volume, rate });
  }
  _stopSounds() {
    this.fireSnd?.stop();
    this.music?.stop();
    this.tinSnd?.stop();
  }

  // Efeitos de pós-processamento (só WebGL; o resto da cena funciona sem eles)
  _initFx() {
    const cam = this.cameras.main;
    if (!cam.filters || this.sys.game.renderer.type !== Phaser.WEBGL || Settings.get("lighting") === false) return;
    // Phaser 4: efeitos de câmera são filtros (camera.filters.external). Todos criados AGORA e
    // mantidos até o fim: ligar/desligar efeito no meio da cena troca o modo de renderização.
    const ext = cam.filters.external;
    const cm = ext.addColorMatrix();
    const blur = ext.addBlur(1, 2, 2, 0);
    const bloom = Phaser.Actions.AddEffectBloom(cam, { threshold: 0.5, blurRadius: 2, blurSteps: 4, blendAmount: 0 })[0];
    this.fx = {
      vig: ext.addVignette(0.5, 0.5, 1.15, 0.2),
      // mesma interface de antes (reset/saturate), agora sobre a matriz do filtro
      color: { reset: () => cm.colorMatrix.reset(), saturate: (v) => cm.colorMatrix.saturate(v) },
      blur,
      // "strength" do bloom = quanto do brilho é somado à imagem
      bloom: {
        get strength() { return bloom.parallelFilters.blend.amount / 0.5; },
        set strength(v) { bloom.parallelFilters.blend.amount = v * 0.5; }, // 0.5: o bloom do v4 soma mais que o do v3
      },
    };
    this._sat = { s: 1 };
  }
  // Brilho suave nas chamas e lamparinas (entra devagar)
  _bloomIn(ms = 2200) {
    if (this.fx) this.tweens.add({ targets: this.fx.bloom, strength: 0.3, duration: ms });
  }
  _saturate(to, ms) {
    if (!this.fx) return;
    this.tweens.add({
      targets: this._sat,
      s: to,
      duration: ms,
      onUpdate: () => {
        this.fx.color.reset();
        this.fx.color.saturate(this._sat.s - 1);
      },
    });
  }
  _vignette(radius, strength, ms) {
    if (this.fx) this.tweens.add({ targets: this.fx.vig, radius, strength, duration: ms, ease: "Sine.easeInOut" });
  }
  _blurTo(from, to, ms) {
    if (!this.fx) return;
    this.fx.blur.strength = from;
    this.tweens.add({ targets: this.fx.blur, strength: to, duration: ms, ease: "Sine.easeOut" });
  }

  // Câmera lenta de verdade: animações e tweens juntos
  _slow(k, ms = 300) {
    const o = { v: this.tweens.timeScale };
    this.tweens.add({
      targets: o,
      v: k,
      duration: ms,
      onUpdate: () => {
        this.tweens.timeScale = o.v;
        this.anims.globalTimeScale = o.v;
      },
    });
  }
  // Congelamento do impacto
  _hitStop(ms) {
    const prev = this.anims.globalTimeScale;
    this.tweens.timeScale = 0.02;
    this.anims.globalTimeScale = 0.02;
    this.time.delayedCall(ms, () => {
      this.tweens.timeScale = prev;
      this.anims.globalTimeScale = prev;
    });
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
        { t: `Você trouxe ${coins} moedas da mata. Com elas vamos reerguer a Clareira, peça por peça.` },
        { t: "Mas a Podridão tem mais fôlego do que parece. O próximo Perigo será mais cruel. Prepare-se, guardião." },
      ];
    }
    return [
      { t: "Calma, guardião… respire. Você caiu fundo na mata, mas está a salvo ao lado da fogueira." },
      { t: "Eu sou a Anciã da Fogueira. Esta é a Clareira, o último canto da floresta que a Podridão ainda não tomou." },
      { t: `Você resistiu ${time} e derrubou ${kills} criaturas, e ainda trouxe ${coins} moedas. Nada mal para a primeira vez!` },
      { t: "Lá fora, basta caminhar: suas armas atacam sozinhas, e a cada nível a floresta oferece uma carta. Misture fogo, gelo e raio: quando se encontram, nascem reações." },
      { t: "Ninguém vence a Podridão de primeira. Cada queda deixa você mais forte, e as moedas vão reerguer a Clareira. Outras lendas da mata esperam ser libertadas para lutar ao seu lado." },
      { t: "Descanse um instante. Quando estiver pronto, a floresta o espera." },
    ];
  }

  // ---------------------------------------------------------------------------
  // Plano 2 · a Clareira à noite
  // ---------------------------------------------------------------------------
  // Brilhos grandes com gradiente suave (o fx_glow de 64px fica em blocos quando ampliado)
  _glowTex() {
    if (this.textures.exists("fd_glow")) return;
    const c = this.textures.createCanvas("fd_glow", 256, 256);
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    c.refresh();
  }

  // Faixa de neblina escura na base das arvores (esconde o corte seco entre mata e chao)
  _horizonFog(gy, G, tint = 0x000000) {
    const key = "fd_fog";
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, 4, 128);
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 128);
      c.refresh();
    }
    this._w(this.add.image(-400, gy - 36, key).setOrigin(0).setDisplaySize(this.W + 800, 150).setTint(tint).setAlpha(0.7).setDepth(6), G);
  }

  // Massa escura de mata atras das copas: tampa o ceu que aparecia entre os troncos
  _farForest(gy, G, color) {
    this._w(this.add.rectangle(-400, gy - 140, this.W + 800, 150, color).setOrigin(0).setDepth(2.6), G);
  }

  _buildClearing() {
    this._glowTex();
    const W = this.W,
      H = this.H,
      G = "clear";
    const gy = Math.round(H * 0.5);
    const fx = Math.round(W / 2),
      fy = Math.round(H * 0.66);
    this.fireX = fx;
    this.fireY = fy;
    const key = `fd2_sky_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W + 800, H + 600);
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, gy + 340);
      g.addColorStop(0, "#050810");
      g.addColorStop(0.6, "#13203a");
      g.addColorStop(1, "#1d3340");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W + 800, H + 600);
      c.refresh();
    }
    this._w(this.add.image(-400, -300, key).setOrigin(0).setDepth(0), G);
    // Estrelas e lua
    for (let i = 0; i < 70; i++) {
      const s = this._w(this.add.image(-300 + Math.random() * (W + 600), -150 + Math.random() * (gy + 130), "px_dot1").setScale(1.4 + Math.random() * 1.6).setAlpha(0.3 + Math.random() * 0.5).setDepth(1), G);
      this.tweens.add({ targets: s, alpha: 0.12, duration: 900 + Math.random() * 1500, yoyo: true, repeat: -1, delay: Math.random() * 1500 });
    }
    this._w(this.add.image(W * 0.82, 96, "fx_glow").setScale(2.8).setTint(0xcfe2ff).setAlpha(0.24).setBlendMode(Phaser.BlendModes.ADD).setDepth(1), G);
    this._w(this.add.circle(W * 0.82, 96, 20, 0xeaf2ff).setDepth(1), G);
    // Chão e silhueta de árvores (duas camadas: profundidade)
    this._w(this.add.tileSprite(-400, gy, W + 800, H - gy + 400, "env_ground").setOrigin(0).setTileScale(3).setTint(0x3a4e6e).setDepth(2), G);
    const env = this.registry.get("envKeys");
    const trees = [...env.pines, ...env.trees.slice(0, 5)];
    for (const [layer, tint, sc, depth] of [[0, 0x0c1722, 1.7, 3], [1, 0x070e16, 2.4, 4]]) {
      for (let x = -420; x < W + 460; x += 46 + Math.random() * 38) {
        this._w(this.add.image(x, gy + 8 + Math.random() * 18 + layer * 6, "env", trees[Math.floor(Math.random() * trees.length)]).setOrigin(0.5, 1).setScale(sc + Math.random() * 1.1).setTint(tint).setDepth(depth), G);
      }
    }
    this._farForest(gy, G, 0x0a1420);
    this._horizonFog(gy, G, 0x050a12);
    // Fogueira
    this._w(this.add.image(fx, fy + 4, "camp_fire").setScale(3).setDepth(fy - 30), G);
    // luz da fogueira no chao (elipse achatada) e no ar
    this._w(this.add.image(fx, fy + 18, "fd_glow").setScale(7.5, 2.6).setTint(0xff8a3c).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy - 40), G);
    this.glowBig = this._w(this.add.image(fx, fy - 18, "fd_glow").setScale(6.4).setTint(0xff9a4c).setAlpha(0.36).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy + 5), G);
    this._w(this.add.image(fx, fy + 4, "fx_glow").setScale(1.7).setTint(0xff5a1e).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy + 5), G);
    this.tweens.add({ targets: this.glowBig, alpha: 0.24, scale: 5.8, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.time.addEvent({ delay: 70, loop: true, callback: () => this._flame(fx, fy - 4) });
    // Vaga-lumes
    for (let i = 0; i < 20; i++) {
      const p = this._w(this.add.image(-200 + Math.random() * (W + 400), gy + Math.random() * (H - gy), "px_dot2").setScale(2).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(40), G);
      this.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 120, y: p.y - 40 - Math.random() * 60, alpha: { from: 0.1, to: 0.9 }, duration: 2400 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
    // Mobilia da Clareira: toras para sentar e pedras
    this._w(this.add.image(fx + 150, fy + 14, "camp_logseat").setScale(3).setDepth(fy + 14), G);
    this._w(this.add.image(fx - 20, fy + 70, "camp_logseat").setScale(3).setFlipX(true).setDepth(fy + 70), G);
    this._w(this.add.image(fx + 340, fy + 40, "camp_rocks").setScale(3).setDepth(fy + 40), G);
    // Personagens, na altura da fogueira (um pouco à frente dela)
    const by = fy + 26;
    this.baseY = by;
    this.heroX = fx - 300;
    this.shadowH = this._w(this.add.image(this.heroX, by + 2, "px_shadow").setScale(7.5, 3).setAlpha(0.55).setDepth(by - 1), G);
    this.hero = this._w(this.add.sprite(this.heroX, by, `herorig_${this.charId}`, FRAME("lieA")).setOrigin(OX, OY).setScale(SC).setDepth(by), G);
    this.elderX = fx - 168;
    this.elder = this._w(this.add.sprite(W + 160, by, "camp_elder", 0).setOrigin(0.5, 1).setScale(SC).setFlipX(true).setDepth(by), G);
    this.elder.play("elder_idle");
    this.elderShadow = this._w(this.add.image(W + 160, by + 2, "px_shadow").setScale(4.6, 2.4).setAlpha(0.5).setDepth(by - 1), G);
    // a Ancia traz uma lamparina: luz quente que acompanha ela
    this.elderGlow = this._w(this.add.image(W + 160, by - 70, "fd_glow").setScale(3.2).setTint(0xffb36b).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(by + 40), G);
    this._show(G, false);
  }

  _flame(x, y) {
    if (!this._groups.clear?.[0]?.visible) return;
    const f = this._w(
      this.add
        .image(x + (Math.random() - 0.5) * 20, y, "px_puff")
        .setScale(2.2 + Math.random())
        .setTint([0xffe58f, 0xffb36b, 0xff7a3c][Math.floor(Math.random() * 3)])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.fireY + 6),
    );
    this.tweens.add({ targets: f, y: y - 36 - Math.random() * 32, x: f.x + (Math.random() - 0.5) * 12, scale: 0.4, alpha: 0, duration: 520 + Math.random() * 260, onComplete: () => f.destroy() });
    if (Math.random() < 0.22) {
      const e = this._w(this.add.image(x, y - 14, "px_dot1").setScale(3).setTint(0xffe58f).setDepth(this.fireY + 6));
      this.tweens.add({ targets: e, y: y - 110 - Math.random() * 60, x: x + (Math.random() - 0.5) * 60, alpha: 0, duration: 1300, onComplete: () => e.destroy() });
    }
  }

  // ---------------------------------------------------------------------------
  // Plano 1 · a floresta corrompida (só na derrota)
  // ---------------------------------------------------------------------------
  _buildForest() {
    const W = this.W,
      H = this.H,
      G = "forest";
    const gy = Math.round(H * 0.5);
    this._glowTex();
    const key = `fd2_rot_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W + 800, H + 600);
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, gy + 340);
      g.addColorStop(0, "#080410");
      g.addColorStop(0.55, "#1c0e2c");
      g.addColorStop(1, "#1e0f28");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W + 800, H + 600);
      c.refresh();
    }
    this._w(this.add.image(-400, -300, key).setOrigin(0).setDepth(0), G);
    // brilho doentio no horizonte
    this._w(this.add.image(W * 0.55, gy - 70, "fx_glow").setScale(18, 3.4).setTint(0x8a3a90).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(1), G);
    this._w(this.add.tileSprite(-400, gy, W + 800, H - gy + 400, "env_ground").setOrigin(0).setTileScale(3).setTint(0x6c5494).setDepth(2), G);
    this._farForest(gy, G, 0x2a1640);
    this._horizonFog(gy, G, 0x120818);
    const env = this.registry.get("envKeys");
    const trees = [...env.trees.slice(0, 6), ...env.pines];
    this.forestLayers = [];
    for (const [tint, sc, depth, dy] of [[0x3e2860, 2.4, 3, 0], [0x24143c, 3.5, 4, 10]]) {
      const layer = [];
      for (let x = -420; x < W + 460; x += 44 + Math.random() * 40) {
        layer.push(this._w(this.add.image(x, gy + 8 + dy + Math.random() * 16, "env", trees[Math.floor(Math.random() * trees.length)]).setOrigin(0.5, 1).setScale(sc + Math.random() * 1.1).setTint(tint).setDepth(depth), G));
      }
      this.forestLayers.push(layer);
    }
    // névoa baixa arrastando
    for (let i = 0; i < 4; i++) {
      const f = this._w(this.add.image(-100 + i * (W / 3), gy + 50 + i * 26, "fx_glow").setScale(11, 1.5).setTint(0x8a4aa0).setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD).setDepth(5 + i), G);
      this.tweens.add({ targets: f, x: f.x + 90 * (i % 2 ? 1 : -1), duration: 5000 + i * 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    // esporos da Podridão subindo
    for (let i = 0; i < 40; i++) {
      const sp = this._w(this.add.image(-300 + Math.random() * (W + 600), gy + 20 + Math.random() * (H - gy), "px_dot2").setScale(1.6 + Math.random() * 1.8).setTint([0xff7eb6, 0xc78cff, 0x8a3fa0][i % 3]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setDepth(45), G);
      this.tweens.add({ targets: sp, y: sp.y - 120 - Math.random() * 140, x: sp.x + (Math.random() - 0.5) * 90, alpha: { from: 0.1, to: 0.85 }, duration: 3200 + Math.random() * 3200, yoyo: true, repeat: -1, delay: Math.random() * 3000 });
    }
    // herói em pé, de frente para o perigo
    this.fHeroX = Math.round(W * 0.4);
    this.fGround = Math.round(H * 0.74);
    this.fShadow = this._w(this.add.image(this.fHeroX, this.fGround + 2, "px_shadow").setScale(5.6, 2.4).setAlpha(0.6).setDepth(this.fGround - 1), G);
    this.fHero = this._w(this.add.sprite(this.fHeroX, this.fGround, `herorig_${this.charId}`, 0).setOrigin(OX, OY).setScale(SC).setDepth(this.fGround), G);
    this.fHero.play(`herorig_${this.charId}_idleloop`);
    // luz do próprio herói (chama / aura) sobre o chão
    this.fAura = this._w(this.add.image(this.fHeroX, this.fGround - 40, "fd_glow").setScale(3.4).setTint(0xff9a4c).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.fGround - 2), G);
    this.tweens.add({ targets: this.fAura, alpha: 0.08, duration: 300, yoyo: true, repeat: -1 });
    // poca de luz quente no chao sob o heroi (elipse achatada)
    this.fPool = this._w(this.add.image(this.fHeroX, this.fGround - 2, "fd_glow").setScale(5, 1.2).setTint(0xff8a3c).setAlpha(0.07).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.fGround - 3), G);
    // luz de tocha que chega pela esquerda no fim (a Ancia), pronta e invisivel
    this.warm = this._w(this.add.image(this.fHeroX - 760, this.fGround - 80, "fd_glow").setScale(7).setTint(0xffb36b).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.fGround + 30), G);
    this.fWolves = [];
    this._show(G, false);
  }

  // Lobo corrompido (silhueta roxa com olhos brilhando)
  _wolf(x, y) {
    const wolf = this._w(this.add.sprite(x, y, "mon_wolf", 0).setOrigin(0.5, 1).setScale(SC).setFlipX(true).setTint(0x8a6aa8).setDepth(y), "forest");
    wolf.play("wolf_move");
    wolf._sh = this._w(this.add.image(x, y + 2, "px_shadow").setScale(5, 2).setAlpha(0.5).setDepth(y - 1), "forest");
    this.fWolves.push(wolf);
    return wolf;
  }

  // ---------------------------------------------------------------------------
  // Interface (câmera própria): faixas de cinema, grão, título, fala, pular
  // ---------------------------------------------------------------------------
  _buildUi() {
    const W = this.W,
      H = this.H;
    const bh = Math.round(H * BAR_H);
    this.barH = bh;
    this.barTop = this._u(this.add.rectangle(0, -bh, W, bh, 0x000000).setOrigin(0).setDepth(1500));
    this.barBot = this._u(this.add.rectangle(0, H, W, bh, 0x000000).setOrigin(0).setDepth(1500));
    // grão de filme (textura de ruído, deslocada a cada ~70 ms)
    if (!this.textures.exists("fd_grain")) {
      const c = this.textures.createCanvas("fd_grain", 128, 128);
      const ctx = c.getContext();
      const id = ctx.createImageData(128, 128);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = Math.random() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      c.refresh();
    }
    this.grain = this._u(this.add.tileSprite(0, 0, W, H, "fd_grain").setOrigin(0).setAlpha(0.07).setBlendMode(Phaser.BlendModes.ADD).setDepth(1400));
    this.time.addEvent({ delay: 70, loop: true, callback: () => this.grain.setTilePosition(Math.random() * 128, Math.random() * 128) });
    // cortinas: preto total (transições), clarão do golpe e pulso vermelho do coração
    this.black = this._u(this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setDepth(1300));
    this.flash = this._u(this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setDepth(1310));
    this.heartVig = this._u(this.add.rectangle(0, 0, W, H, 0xa01830, 0).setOrigin(0).setDepth(1290));
    // legenda / título
    this.caption = this._u(text(this, W / 2, H - this.barH - 46, "", { size: 26, color: "#d9a0ac", origin: 0.5, stroke: true, strokeW: 6 }).setDepth(1320).setAlpha(0));
    this.title = this._u(text(this, W / 2, H / 2 - 20, "", { size: 46, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 8 }).setDepth(1320).setAlpha(0));
    this.subtitle = this._u(text(this, W / 2, H / 2 + 48, "", { size: 20, color: CSS.muted, origin: 0.5 }).setDepth(1320).setAlpha(0));
    this.rule = this._u(this.add.rectangle(W / 2, H / 2 + 20, 220, 2, 0xf2c14e).setDepth(1320).setScale(0, 1));
    // caixa de fala
    const w = Math.min(820, W - 40);
    const c = (this.box = this.add.container(W / 2, H - 100).setDepth(1600).setAlpha(0).setVisible(false));
    const g = this.add.graphics();
    drawFrame(g, -w / 2, -64, w, 128, "gold", { alpha: 0.97 });
    this.face = this.add.sprite(-w / 2 + 56, 40, "camp_elder", 0).setOrigin(0.5, 1).setScale(4).setFlipX(true);
    this.face.play("elder_idle");
    const who = text(this, -w / 2 + 108, -42, "ANCIÃ DA FOGUEIRA", { size: 15, color: CSS.goldHi, origin: [0, 0.5] });
    this.lineT = text(this, -w / 2 + 108, -26, "", { size: 19, color: CSS.txt, origin: [0, 0], lineSpacing: 3 });
    // texto invisível usado só para medir/quebrar linhas (a digitação não "pula")
    this.measureT = this._u(text(this, 0, 0, "", { size: 19, origin: [0, 0], wrap: w - 140, lineSpacing: 3 }).setVisible(false));
    this.more = this.add.image(w / 2 - 26, 46, "ico_play").setScale(2).setAngle(90).setVisible(false);
    this.tweens.add({ targets: this.more, y: 52, duration: 450, yoyo: true, repeat: -1 });
    c.add([g, this.face, who, this.lineT, this.more]);
    this._u(c);
    this.hint = this._u(text(this, W / 2, H - 20, "toque para continuar", { size: 14, color: CSS.muted, origin: 0.5 }).setDepth(1600).setAlpha(0));
    this.skipBtn = new Button(this, W - 96, 40, 150, 48, "PULAR", () => this._finish(true), { size: 20 });
    this.skipBtn.setDepth(1700).setAlpha(0);
    this._u(this.skipBtn);
    this.tweens.add({ targets: this.skipBtn, alpha: 0.8, duration: 600, delay: 1200 });
  }

  _bars(open, ms = 700) {
    const h = this.barH;
    this.tweens.add({ targets: this.barTop, y: open ? 0 : -h, duration: ms, ease: "Cubic.easeInOut" });
    this.tweens.add({ targets: this.barBot, y: open ? this.H - h : this.H, duration: ms, ease: "Cubic.easeInOut" });
  }
  _fadeBlack(to, ms) {
    this.tweens.add({ targets: this.black, alpha: to, duration: ms, ease: "Sine.easeInOut" });
  }
  _caption(str, inMs = 600, hold = 1500) {
    this.caption.setText(str);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: inMs, yoyo: true, hold, ease: "Sine.easeInOut" });
  }
  _titleCard(main, sub, hold = 1500) {
    this.title.setText(main.split("").join(" "));
    this.subtitle.setText(sub);
    this.tweens.add({ targets: this.rule, scaleX: 1, duration: 700, ease: "Cubic.easeOut" });
    this.tweens.add({ targets: [this.title, this.subtitle], alpha: 1, duration: 800, delay: 150, hold, yoyo: true, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: this.rule, scaleX: 0, duration: 600, delay: 150 + 800 + hold });
  }
  _heartbeat(n, gap, vol, fade = 0.78) {
    for (let i = 0; i < n; i++) {
      this._at(i * gap, () => {
        this._sfx("sfx_heartbeat", vol * Math.pow(fade, i), 1 - i * 0.04);
        this.tweens.add({ targets: this.heartVig, alpha: 0.28 * Math.pow(fade, i), duration: 90, yoyo: true });
        this.cameras.main.shake(70, 0.0015);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PLANO 1 + 2 (derrota)
  // ---------------------------------------------------------------------------
  _playDefeat() {
    const cam = this.cameras.main;
    const W = this.W,
      H = this.H;
    this._show("forest", true);
    this._show("clear", false);
    // zoom fixo (zoom animado faz os pixels tremerem); a câmera só desliza devagar
    cam.setZoom(1.5);
    cam.centerOn(this.fHeroX + 150, this.fGround - 118);
    this._fadeBlack(0, 900);
    this._bars(true, 900);
    // empurra a câmera para o herói durante todo o plano
    cam.pan(this.fHeroX + 30, this.fGround - 100, this.short ? 1800 : 4200, "Sine.easeInOut");
    this.tweens.add({ targets: this.fHero, scaleY: SC * 1.012, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // parallax lento das árvores
    this.forestLayers.forEach((layer, i) => layer.forEach((t) => this.tweens.add({ targets: t, x: t.x - 24 * (i + 1), duration: 4200, ease: "Sine.easeInOut" })));
    this._sfx("sfx_whoosh", 0.12, 0.5);
    this._heartbeat(this.short ? 1 : 3, 920, 0.5);

    // três lobos chegam da direita; o da frente salta (na cena curta, só o que salta, rápido)
    const gy = this.fGround;
    const wolves = this.short
      ? [{ x: W + 260, y: gy + 2, d: 800, delay: 350, lead: true }]
      : [
          { x: W + 520, y: gy - 26, d: 3200, delay: 600, lead: false },
          { x: W + 420, y: gy + 22, d: 2800, delay: 450, lead: false },
          { x: W + 260, y: gy + 2, d: 1500, delay: 750, lead: true },
        ];
    wolves.forEach((cfg) => {
      this._at(cfg.delay, () => {
        const wolf = this._wolf(cfg.x, cfg.y);
        this._sfx("sfx_whoosh", 0.1, 0.9);
        const toX = this.fHeroX + (cfg.lead ? 70 : 220 + Math.random() * 40);
        this.tweens.add({
          targets: [wolf, wolf._sh],
          x: toX,
          duration: cfg.d,
          ease: cfg.lead ? "Cubic.easeIn" : "Sine.easeOut",
          onUpdate: () => wolf.setDepth(wolf.y),
          onComplete: () => {
            if (cfg.lead) return this._strike(wolf);
            wolf.stop();
            wolf.setFrame(0);
            this.tweens.add({ targets: wolf, scaleY: SC * 1.04, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
          },
        });
        if (cfg.lead) {
          // salto em arco
          this.tweens.add({ targets: wolf, y: cfg.y - 90, duration: cfg.d * 0.5, yoyo: true, ease: "Sine.easeOut" });
        }
      });
    });
  }

  // O golpe: clarão, congelamento, sacudida — e a queda em câmera lenta
  _strike(wolf) {
    const cam = this.cameras.main;
    this.flash.setAlpha(0.9);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 320, ease: "Cubic.easeOut" });
    this._sfx("sfx_strike", 0.85);
    this._sfx("sfx_player_hit", 0.6, 0.7);
    cam.shake(300, 0.016);
    haptic(60);
    // o lobo se desfaz em esporos
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = this._w(this.add.image(wolf.x, wolf.y - 40, "px_puff").setScale(1.2 + Math.random() * 1.6).setTint([0xc78cff, 0xff7eb6, 0x8a3fa0][i % 3]).setBlendMode(Phaser.BlendModes.ADD).setDepth(wolf.y + 5));
      this.tweens.add({ targets: p, x: p.x + Math.cos(a) * (50 + Math.random() * 70), y: p.y + Math.sin(a) * (40 + Math.random() * 50) - 20, alpha: 0, scale: 0.3, duration: 700 + Math.random() * 400, onComplete: () => p.destroy() });
    }
    wolf._sh.destroy();
    wolf.destroy();
    this._hitStop(150);
    this.fAura.setAlpha(0.2);
    this._at(170, () => {
      this._slow(0.5, 260);
      this._saturate(0.35, 1800);
      this.tweens.killTweensOf(this.fHero);
      this.fHero.setScale(SC);
      this.fHero.play(`herorig_${this.charId}_fall`);
      this.fHero.on("animationupdate", (anim, frame) => {
        if (frame.index === 6) this._impact();
      });
      this.fHero.once("animationcomplete", () => {
        this.fHero.play(`herorig_${this.charId}_lie`);
        this._slow(0.8, 1200);
      });
      // a câmera cai junto com ele
      cam.pan(this.fHeroX - 20, this.fGround - 70, 2600, "Sine.easeInOut");
      this.tweens.add({ targets: this.fAura, alpha: 0, duration: 1600 });
    });
    if (this.short) {
      // cena curta: o herói cai, fica um instante no chão e a tela escurece para os resultados
      this._at(2800, () => {
        this._fadeBlack(1, 800);
        this._sfx("sfx_heartbeat", 0.3, 0.9);
      });
      this._at(3800, () => this._finish(false));
      return;
    }
    // depois do baque: legenda, uma luz de tocha chega e os lobos fogem
    this._at(3300, () => this._caption("A Podridão te alcançou…", 700, 1200));
    this._at(3900, () => this._torchLight());
    this._at(5300, () => {
      this._fadeBlack(1, 1100);
      this.tinSnd = this.sound.add("sfx_tinnitus", { volume: 0 });
      this.tinSnd.play();
      this.tweens.add({ targets: this.tinSnd, volume: 0.1, duration: 800 });
      this._heartbeat(3, 1050, 0.34, 0.7);
    });
    this._at(6500, () => this._toClearing());
  }

  // Uma luz quente chega pela esquerda: os lobos recuam e fogem para a escuridão
  _torchLight() {
    this.tweens.add({ targets: this.warm, x: this.fHeroX - 330, alpha: 0.62, duration: 1500, ease: "Sine.easeOut" });
    this._sfx("sfx_step", 0.2, 1);
    this._at(500, () => this._sfx("sfx_step", 0.2, 1.05));
    this.fWolves.forEach((w, i) => {
      if (!w.active) return;
      this._at(300 + i * 160, () => {
        this.tweens.killTweensOf(w);
        w.setFlipX(false).setScale(SC);
        w.play("wolf_move");
        this._sfx("sfx_whoosh", 0.12, 1.3);
        this.tweens.add({ targets: [w, w._sh], x: w.x + 900, duration: 1100, ease: "Quad.easeIn", onUpdate: () => w.setDepth(w.y) });
      });
    });
  }

  _impact() {
    if (this._impacted) return;
    this._impacted = true;
    this._sfx("sfx_thud", 0.9);
    this.cameras.main.shake(260, 0.01);
    haptic(40);
    // poeira e folhas voando do baque
    const gx = this.fHeroX - 20,
      gyy = this.fGround;
    for (let i = 0; i < 16; i++) {
      const dir = i % 2 ? 1 : -1;
      const p = this._w(this.add.image(gx + dir * (8 + Math.random() * 30), gyy - 4, "px_puff").setScale(1.6 + Math.random() * 1.8).setTint(i % 3 ? 0xa89cb0 : 0x6a5a7a).setAlpha(0.8).setDepth(gyy + 4));
      this.tweens.add({ targets: p, x: p.x + dir * (40 + Math.random() * 80), y: p.y - 10 - Math.random() * 26, alpha: 0, scale: p.scale * 2.2, duration: 900 + Math.random() * 500, ease: "Cubic.easeOut", onComplete: () => p.destroy() });
    }
    for (let i = 0; i < 8; i++) {
      const l = this._w(this.add.image(gx + (Math.random() - 0.5) * 60, gyy - 10, "px_leaf").setScale(3).setTint(i % 2 ? 0x6a4a8a : 0x4a2a60).setDepth(gyy + 6));
      this.tweens.add({ targets: l, y: l.y - 50 - Math.random() * 60, x: l.x + (Math.random() - 0.5) * 120, rotation: Math.random() * 6, duration: 600, ease: "Quad.easeOut", yoyo: true, onComplete: () => l.destroy() });
    }
  }

  // Corte para o escuro → título → a Clareira entra em foco
  _toClearing() {
    const cam = this.cameras.main;
    const W = this.W,
      H = this.H;
    this.tinSnd?.stop();
    this.tweens.killTweensOf(cam);
    this._show("forest", false);
    this._show("clear", true);
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
    if (this.fx) {
      this._sat.s = 1;
      this.fx.color.reset();
    }
    // deitado, igual ao último quadro do plano anterior
    this.hero.play(`herorig_${this.charId}_lie`);
    // câmera baixa e próxima do herói, bem desfocada
    cam.setZoom(1.5);
    cam.centerOn(this.heroX + 40, this.baseY - 50);
    this._blurTo(5, 0, 3400);
    // áudio antes da imagem
    this.fireSnd = this.sound.add("sfx_fire_loop", { loop: true, volume: 0 });
    this.fireSnd.play();
    this.tweens.add({ targets: this.fireSnd, volume: 0.22, duration: 2400 });
    this._titleCard("A CLAREIRA", "o último canto da floresta", 1100);
    this._at(2900, () => {
      this._bloomIn();
      this._fadeBlack(0, 1700);
      cam.pan(this.fireX - 190, this.baseY - 86, 7000, "Sine.easeInOut");
      if (this.cache.audio.exists("music_menu")) {
        this.music = this.sound.add("music_menu", { loop: true, volume: 0 });
        this.music.play();
        this.tweens.add({ targets: this.music, volume: 0.2, duration: 3200 });
      }
    });
    // a Anciã chega pela mata
    this._at(3300, () => this._elderEnters());
  }

  _elderEnters() {
    const W = this.W;
    const e = this.elder,
      sh = this.elderShadow;
    e.setX(W + 160);
    sh.setX(W + 160);
    const dist = W + 160 - this.elderX;
    const ms = Math.min(4600, dist * 5.6);
    this.tweens.add({ targets: [e, sh], x: this.elderX, duration: ms, ease: "Sine.easeOut" });
    // passos: balanço + som, cada vez mais espaçados ao chegar
    let n = 0;
    const step = () => {
      if (this._leaving) return;
      n++;
      this._sfx("sfx_step", 0.26, 0.9 + Math.random() * 0.2);
      this.tweens.add({ targets: e, y: this.baseY - 4, duration: 110, yoyo: true, ease: "Quad.easeOut" });
      if (e.x > this.elderX + 6) this.time.delayedCall(300 + n * 18, step);
      else this._elderArrives();
    };
    this.time.delayedCall(260, step);
    // o guardião começa a se mexer quando ela se aproxima
    this._at(ms * 0.45, () => this._wake());
  }

  _elderArrives() {
    if (this._arrived) return;
    this._arrived = true;
    // agacha ao lado dele
    this.tweens.add({ targets: this.elder, scaleY: SC * 0.9, scaleX: SC * 1.04, duration: 420, ease: "Sine.easeInOut" });
  }

  // O guardião acorda, desenhado quadro a quadro
  _wake() {
    if (this._waking) return;
    this._waking = true;
    this.hero.play(`herorig_${this.charId}_wake`);
    this.hero.on("animationupdate", (anim, frame) => {
      if (frame.index === 2) this._sfx("sfx_ui_hover", 0.18, 0.5); // primeiro movimento: respira fundo
      if (frame.index === 3) {
        // olhos abertos: a Anciã começa a falar
        this._bars(false, 700);
        this._begin();
      }
      if (frame.index === 5) {
        this._sfx("sfx_dash", 0.22, 0.6);
        // a Anciã se levanta
        this.tweens.add({ targets: this.elder, scaleY: SC, scaleX: SC, duration: 380, ease: "Back.easeOut" });
      }
    });
    this.hero.once("animationcomplete", () => {
      this.hero.play(`herorig_${this.charId}_idleloop`);
      this.tweens.add({ targets: this.hero, scaleY: SC * 1.012, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.shadowH.setScale(5.2, 2.6);
    });
  }

  // ---------------------------------------------------------------------------
  // Vitória: sem queda; o guardião de pé, a Anciã ao lado
  // ---------------------------------------------------------------------------
  _playWin() {
    const cam = this.cameras.main;
    const W = this.W,
      H = this.H;
    this._show("clear", true);
    this.hero.play(`herorig_${this.charId}_idleloop`);
    this.elder.setX(this.elderX);
    this.elderShadow.setX(this.elderX);
    this.shadowH.setScale(5.2, 2.6);
    cam.setZoom(1.5);
    cam.centerOn(this.fireX - 150, this.baseY - 84);
    this.fireSnd = this.sound.add("sfx_fire_loop", { loop: true, volume: 0 });
    this.fireSnd.play();
    this.tweens.add({ targets: this.fireSnd, volume: 0.2, duration: 1800 });
    if (this.cache.audio.exists("music_menu")) {
      this.music = this.sound.add("music_menu", { loop: true, volume: 0 });
      this.music.play();
      this.tweens.add({ targets: this.music, volume: 0.24, duration: 2200 });
    }
    this._bloomIn(1800);
    this._fadeBlack(0, 1200);
    this._at(1100, () => this._begin());
  }

  // ---------------------------------------------------------------------------
  // Diálogo
  // ---------------------------------------------------------------------------
  _begin() {
    if (this._ready) return;
    this._ready = true;
    this._advance();
  }

  _advance() {
    if (this._leaving || !this._ready) return;
    if (this._idx < 0 && !this.box.visible) {
      this.box.setVisible(true).setY(this.H - 82);
      this.tweens.add({ targets: this.box, alpha: 1, y: this.H - 100, duration: 320, ease: "Back.easeOut" });
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
    this._startLine(this.lines[this._idx].t);
  }

  _startLine(str) {
    const wrapped = this.measureT.getWrappedText(str).join("\n");
    this._full = wrapped;
    this._shown = 0;
    this._typing = true;
    this.more.setVisible(false);
    this.lineT.setText("");
    // a Anciã "fala": um pulinho a cada fala
    if (this._arrived || this.won) this.tweens.add({ targets: this.elder, scaleY: this.elder.scaleY * 1.05, duration: 120, yoyo: true });
    this._typeEvt?.remove();
    this._typeEvt = this.time.addEvent({
      delay: TYPE_MS,
      loop: true,
      callback: () => {
        const ch = this._full[this._shown];
        this._shown++;
        this.lineT.setText(this._full.slice(0, this._shown));
        if (this._shown % 3 === 0) this._sfx("sfx_ui_hover", 0.06, 0.9 + Math.random() * 0.4);
        if (this._shown >= this._full.length) return this._completeLine();
        // pausa curtinha nas vírgulas e pontos: a fala "respira"
        if (ch === "," || ch === "." || ch === "…" || ch === "!") {
          this._typeEvt.paused = true;
          this.time.delayedCall(ch === "," ? 120 : 230, () => this._typeEvt && (this._typeEvt.paused = false));
        }
      },
    });
  }

  _completeLine() {
    this._typeEvt?.remove();
    this._typing = false;
    this.lineT.setText(this._full);
    this.more.setVisible(true);
  }

  _finish(skipped) {
    if (this._leaving) return;
    this._leaving = true;
    Analytics.track("first_story_end", { won: this.won, skipped, line: this._idx + 1, of: this.lines.length, ms: Math.round(this.time.now - this._t0) });
    this._typeEvt?.remove();
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
    for (const snd of [this.music, this.fireSnd, this.tinSnd]) if (snd) this.tweens.add({ targets: snd, volume: 0, duration: 500 });
    this.cameras.main.fadeOut(550, 5, 8, 6);
    this.uiCam.fadeOut(550, 5, 8, 6);
    // sai quando o fade termina (ou por tempo: em aparelho lento o fade pode atrasar)
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      this._stopSounds();
      // derrota: direto para a Clareira (o herói chega pela trilha); vitória: ainda mostra os resultados
      if (this.won || this.short) this.scene.start("GameOverScene", { ...this.next, won: this.won }); // won sempre coerente com a cena
      else this.scene.start("CampScene", { fromRun: true });
    };
    this.uiCam.once("camerafadeoutcomplete", go);
    this.time.delayedCall(1100, go);
  }
}
