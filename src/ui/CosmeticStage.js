// Prévia ao vivo do Guarda-roupa: um pedacinho de mata com o guardião escolhido e a peça tocando em
// laço — também nas peças que o jogador ainda não tem (ver antes de comprar é o que vende).
// Roda o MESMO código das peças na partida (systems/CosmeticPieces.js) num "palco" de prévia: as camadas
// ficam num container fora da tela e são desenhadas numa RenderTexture do tamanho da moldura (ela
// recorta o que passa da borda — no Phaser 4, setMask não recorta; ver ScrollList).
//   show(parte, peça)   uma peça em foco, repetindo o momento dela
//   showKit(peças, cb)  o kit inteiro em sequência: Rastro → Libertação → Despertar (cb avisa a fase)
// Momentos: Libertação = um corrompido aparece ao lado do herói e é libertado, a cada ~1 s; Rastro = o
// herói anda de um lado a outro e dá um dash; Despertar = desperta (aura, tinta, clarão) e descansa.
import { PAL } from "../art/Palette.js";
import { registerAuraFX } from "../art/AuraFX.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { Cosmetics } from "../systems/Cosmetics.js";
import { AWAKEN_GOLD } from "../entities/Player.js";

const PX = 3;
const PHASE_MS = { trail: 3000, kill: 3300, awaken: 4000 }; // duração de cada momento no modo kit

export class CosmeticStage {
  // w,h = tamanho da moldura (o chamador posiciona a RT e põe no modal)
  constructor(scene, w, h, heroId) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    this.heroId = heroId;
    registerAuraFX(scene);
    registerCosmeticFX(scene);
    this.rt = scene.add.renderTexture(0, 0, w, h);
    this._tick = (time) => this._update(time);
    scene.events.on("update", this._tick);
  }

  // Uma peça em foco (null = o padrão do jogo)
  show(slot, pieceId) {
    this._build(pieceId ? { [slot]: pieceId } : {}, [slot], null);
  }
  // O kit inteiro, momento a momento
  showKit(eq, onPhase) {
    this._build(eq, ["trail", "kill", "awaken"], onPhase);
  }
  // Skin da Clareira (null = a de sempre): a árvore-marco ao lado do herói, a luz e as folhas caindo
  showCamp(skin) {
    this._build({}, ["camp"], null);
    const s = this.scene;
    const anc = skin === "ancestral";
    const tree = s.add.image(this.w * 0.3, this.h + 40, anc ? "camp_jequitiba" : "camp_kapok").setOrigin(0.5, 1).setScale(anc ? 1.9 : 2.1);
    this.back.add(tree);
    if (anc) this.back.add(s.add.image(this.w * 0.3 + 92, this.h - 14, "camp_plaque").setOrigin(0.5, 1).setScale(2));
    this.heroS.setPosition(this.w * 0.72, this.h * 0.68);
    this.shadow.setPosition(this.heroS.x, this.heroS.y + 30);
    // luz do fim de tarde (a Ancestral) por cima de tudo: o tom quente e os raios de sol da Clareira
    if (anc) {
      this.over.add(s.add.rectangle(0, 0, this.w, this.h, 0xf2b890, 0.12).setOrigin(0));
      for (const [fx, sx, a] of [[0.12, 2.6, 0.55], [0.42, 1.8, 0.4], [0.7, 2.2, 0.45]]) {
        const r = s.add.image(this.w * fx, -30, "fx_shaft").setOrigin(0.5, 0).setScale(sx, (this.h * 1.5) / 256).setAngle(-24).setTint(0xffcf7a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a);
        this.over.add(r);
        s.tweens.add({ targets: r, alpha: a * 0.5, duration: 3600 + Math.random() * 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    this._leafTints = anc ? [0xc88a5a, 0xc7922b, 0xe3c37e, 0x9ccf62] : [0x9ccf62, 0xc7922b, 0x6aab4a];
    this._leafRate = anc ? 260 : 520;
  }

  _build(eq, phases, onPhase) {
    this._clear();
    const s = this.scene,
      w = this.w,
      h = this.h;
    this.root = s.make.container({ x: 0, y: 0 }, false);
    const L = (n) => (this[n] = s.add.container(0, 0));
    // ordem de desenho: chão, aura, "atrás do herói" (asas, arraiá), herói, ar — igual às profundidades da partida
    for (const n of ["bg", "ground", "auraL", "back", "body", "air", "over"]) this.root.add(L(n));
    this._ground(w, h);
    const hx = w / 2,
      hy = h * 0.6;
    this.shadow = s.add.ellipse(hx, hy + 30, 46, 14, PAL.ink, 0.35);
    this.aura = s.add.sprite(hx, hy, "fx_awaken_aura", 0).setScale(PX).setOrigin(0.5, 0.92).setAlpha(0.85).setVisible(false);
    this.heroS = s.add.sprite(hx, hy, `hero_${this.heroId}`, 0).setScale(PX);
    this.auraL.add([this.shadow, this.aura]);
    this.body.add(this.heroS);
    this._foe = s.add.sprite(0, 0, "mon_wolf", 0).setScale(PX).setVisible(false);
    this.body.add(this._foe);
    this.flash = s.add.rectangle(0, 0, w, h, 0xffffff, 0).setOrigin(0);
    this.over.add(this.flash);
    // herói "de mentira" com o que as peças leem do Player
    const hero = this.heroS,
      st = this;
    this.hero = {
      get x() {
        return hero.x;
      },
      get y() {
        return hero.y;
      },
      get displayHeight() {
        return hero.displayHeight;
      },
      get flipX() {
        return hero.flipX;
      },
      depth: 0,
      active: true,
      visible: true,
      body: { velocity: { x: 0, y: 0 } },
      dashDirX: 1,
      dashDirY: 0,
      isDashing: () => s.time.now < st._dashUntil,
      isAwakened: () => s.time.now < st._awakeUntil,
    };
    const host = {
      scene: s,
      put: (o, layer) => (layer === "ground" ? this.ground : layer === "back" ? this.back : this.air).add(o) && o,
      behind() {},
      hero: () => this.hero,
      inView: () => true,
      light() {},
      delay: (ms, fn) => this._timers.push(s.time.delayedCall(ms, fn)),
      q: 1,
      get now() {
        return s.time.now;
      },
    };
    // com a quantidade de efeitos escolhida no Guarda-roupa (a prévia mostra o que vai ver na partida)
    this.cosm = Object.values(eq).some(Boolean) ? new Cosmetics(host, eq) : null;
    this.look = this.cosm?.awakenLook ?? AWAKEN_GOLD;
    this.phases = phases;
    this._onPhase = onPhase;
    this._enter(0);
  }

  // Começa um momento: herói de volta ao meio, parado e sem tinta
  _enter(i) {
    const s = this.scene,
      hero = this.heroS;
    this._phaseI = i;
    this.slot = this.phases[i];
    this._phaseEnd = this.phases.length > 1 ? s.time.now + PHASE_MS[this.slot] : Infinity;
    this._next = s.time.now + 300;
    this._dashUntil = this._awakeUntil = 0;
    this._awakeOn = false;
    this._dir = 1;
    hero.setPosition(this.w / 2, this.h * 0.6).setFlipX(false).clearTint();
    if (s.anims.exists(`${this.heroId}_idle`)) hero.play(`${this.heroId}_idle`);
    this.shadow.x = hero.x;
    this.hero.body.velocity.x = this.hero.body.velocity.y = 0;
    this.aura.setVisible(false).stop();
    this._foe.setVisible(false);
    this._onPhase?.(this.slot);
  }

  // Chão de mata: verde escuro com tufos, no estilo do bioma (pixel de 3)
  _ground(w, h) {
    const g = this.scene.add.graphics();
    g.fillStyle(PAL.g1, 1).fillRect(0, 0, w, h);
    let seed = 7;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(r() < 0.5 ? PAL.g2 : PAL.g0, 1).fillRect(Math.floor((r() * w) / 3) * 3, Math.floor((r() * h) / 3) * 3, 3 * (1 + Math.floor(r() * 3)), 3);
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.floor((r() * w) / 3) * 3,
        y = Math.floor((r() * h) / 3) * 3;
      g.fillStyle(PAL.g4, 1).fillRect(x, y, 3, 6).fillRect(x + 6, y + 3, 3, 3);
    }
    this.bg.add(g);
  }

  _update(time) {
    if (!this.rt?.active || !this.root) return;
    const s = this.scene,
      hero = this.heroS;
    const v = this.hero.body.velocity;
    // modo kit: próximo momento (o Despertar termina antes de trocar)
    if (time >= this._phaseEnd && time >= this._awakeUntil) this._enter((this._phaseI + 1) % this.phases.length);
    if (this.slot === "kill" && time >= this._next) {
      // um corrompido aparece de um lado ou do outro do herói (nunca em cima) e é libertado
      this._next = time + 1050;
      const side = (this._side = -(this._side || 1));
      const fx = hero.x + side * (95 + Math.random() * 50),
        fy = Math.min(this.h - 34, Math.max(44, hero.y + 6 + (Math.random() - 0.5) * 90));
      const foe = this._foe.setPosition(fx, fy).setFlipX(fx > hero.x).setAlpha(1).setScale(PX).setVisible(true);
      s.tweens.add({ targets: foe, y: fy - 4, duration: 180, yoyo: true });
      this._timers.push(
        s.time.delayedCall(420, () => {
          if (!foe.active) return;
          s.tweens.add({ targets: foe, scale: PX * 0.4, alpha: 0, duration: 120, onComplete: () => foe.active && foe.setVisible(false) });
          this.cosm?.kill(fx, fy - 6, Math.random() < 0.15);
        }),
      );
    } else if (this.slot === "trail") {
      // anda de um lado a outro; dash a cada ~2,4 s
      const dashing = time < this._dashUntil;
      const sp = dashing ? 420 : 110;
      hero.x += this._dir * sp * (s.game.loop.delta / 1000);
      if (hero.x > this.w - 50) this._dir = -1;
      if (hero.x < 50) this._dir = 1;
      hero.setFlipX(this._dir < 0);
      v.x = this._dir * sp;
      v.y = 0;
      this.hero.dashDirX = this._dir;
      if (time >= this._next) {
        this._next = time + 2400;
        this._dashUntil = time + 180;
      }
      const walk = `${this.heroId}_walk`;
      if (s.anims.exists(walk) && hero.anims.currentAnim?.key !== walk) hero.play(walk);
      this.shadow.x = hero.x;
    } else if (this.slot === "awaken" && time >= this._next) {
      // desperta e fica desperto 2,8 s (peça em foco: repete a cada 4,2 s; modo kit: uma vez)
      this._next = this.phases.length > 1 ? Infinity : time + 4200;
      this._awakeUntil = time + 2800;
      this._awakeOn = true;
      if (this.look.aura) this.aura.setVisible(true).play(this.look.aura); // null = forma própria (asas, arraiá)
      hero.setTint(this.look.tint);
      const [r, g, b] = this.look.flash;
      this.flash.setFillStyle((r << 16) | (g << 8) | b, 0.55);
      s.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 260 });
      this.cosm?.awaken(hero.x, hero.y + hero.displayHeight * 0.42);
    }
    if (this.slot === "camp" && time >= this._next) {
      // folhas caindo da copa (cobre na Ancestral)
      this._next = time + this._leafRate;
      const leaf = s.add.image(Math.random() * this.w, -8, "px_leaf").setScale(PX).setTint(this._leafTints[(Math.random() * this._leafTints.length) | 0]);
      this.air.add(leaf);
      s.tweens.add({ targets: leaf, y: this.h + 10, x: leaf.x + (Math.random() - 0.5) * 120, duration: 4200 + Math.random() * 1800, ease: "Sine.easeIn", onComplete: () => leaf.active && leaf.destroy() });
      s.tweens.add({ targets: leaf, angle: { from: -40, to: 40 }, duration: 900, yoyo: true, repeat: 6, ease: "Sine.easeInOut" });
    }
    if (this._awakeOn && time >= this._awakeUntil) {
      this._awakeOn = false;
      this.aura.setVisible(false).stop();
      hero.clearTint();
    }
    this.aura.setPosition(hero.x, hero.y + hero.displayHeight * 0.44);
    this.cosm?.update(time);
    this.rt.clear();
    this.rt.draw(this.root, 0, 0);
    this.rt.render(); // Phaser 4: render() executa os desenhos
  }

  // Tira a peça antiga: cancela os atrasos e os tweens dela ANTES de destruir os objetos (um onComplete
  // num sprite destruído jogava exceção no laço do jogo e a prévia congelava)
  _clear() {
    for (const t of this._timers ?? []) t.remove(false);
    this._timers = [];
    const kill = (o) => {
      this.scene.tweens.killTweensOf(o);
      (o.list ?? []).forEach(kill);
    };
    if (this.root) kill(this.root);
    this.root?.destroy();
    this.root = null;
  }

  destroy() {
    this.scene.events.off("update", this._tick);
    this._clear();
    this.rt?.destroy();
  }
}
