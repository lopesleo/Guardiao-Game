// Lago NO CHÃO da Clareira: o jogador vai até o trapiche e pesca ali mesmo.
// Lança a linha → espera a boia afundar → toca para fisgar → minijogo de um
// polegar por cima do mundo (segurar sobe a zona verde, soltar desce; manter o
// peixe dentro enche a barra). Pegada sem deixar o peixe sair = qualidade Ouro.
// Mixin da CampScene (Object.assign): usa this.meta e this.pond.
import { GAME, GARDEN, FISHING } from "../config.js";
import { Analytics } from "../systems/Analytics.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { POND_W, POND_H } from "../art/Pond.js";
import { text, drawFrame, haptic } from "../ui/Theme.js";

const S = GAME.PIXEL_SCALE;
const PX = 610,
  PY = 100; // centro da água
const SPOT_X = 462,
  SPOT_Y = 112; // onde o herói fica para pescar (pés)
const Q_COLOR = [CSS.muted, hex(PAL.s4), CSS.goldHi];
const BAR_H = 380;

export const CampPond = {
  _pondWorld() {
    const shown = this._isShown("pond");
    const water = this.add
      .image(PX, PY, "camp_pond")
      .setOrigin(0.5, (POND_H / 2 + 6) / (POND_H + 8))
      .setScale(S)
      .setDepth(-8e5);
    const pier = this.add.image(PX - (POND_W * S) / 2 + 40, PY + 6, "camp_pier").setScale(S).setDepth(-8e5 + 1);
    // A água não se atravessa
    this._solid(PX + 10, PY, POND_W * S - 70, 70);
    this._solid(PX + 10, PY, POND_W * S - 150, POND_H * S - 20);
    const ruin = shown ? null : this.add.image(PX, PY + 40, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(PY + 40);
    if (!shown) [water, pier].forEach((o) => o.setAlpha(0));
    this.buildings.pond = {
      x: PX,
      y: PY + 40,
      img: null,
      ruin,
      shown,
      dot: this._notifyDot(SPOT_X, SPOT_Y - 110).setDepth(this.D_HUD - 10).setVisible(false),
      reveal: () => this.tweens.add({ targets: [water, pier], alpha: 1, duration: 700, delay: 300 }),
    };
    this._addInteract({
      x: SPOT_X,
      y: SPOT_Y,
      top: SPOT_Y - 70,
      r: 80,
      name: "LAGO",
      verb: "PESCAR",
      ruinOf: "pond",
      build: "pond",
      action: () => (this.buildings.pond.shown ? this._startFishing() : this._say("Cure a floresta jogando partidas para revelar o que há aqui.")),
    });
    // Bolhas na água = tem peixe (o lago "descansa" quando não há)
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        if (!this.buildings.pond.shown || this.pond.fish() <= 0 || Math.random() < 0.35) return;
        const a = Math.random() * Math.PI * 2,
          r = Math.random() * 0.7;
        const x = PX + Math.cos(a) * r * 90,
          y = PY + Math.sin(a) * r * 40;
        const b = this.add.image(x, y, "px_ring").setScale(0.6).setTint(PAL.ice3).setAlpha(0.7).setDepth(-8e5 + 2);
        this.tweens.add({ targets: b, scale: 1.6, alpha: 0, duration: 900, onComplete: () => b.destroy() });
      },
    });
  },

  _refreshPondDot() {
    const b = this.buildings.pond;
    if (b) b.dot.setVisible(b.shown && this.pond.fish() > 0 && !(this.meta.data.stats.fishCaught > 0));
  },

  // ---------------------------------------------------------------------------
  // PESCARIA
  // ---------------------------------------------------------------------------
  _startFishing() {
    const pond = this.pond;
    if (pond.fish() <= 0) return this._say("O lago descansa. Os peixes se esconderam — volte mais tarde.");
    const p = this.player;
    // O herói vai para a ponta da margem, virado para a água
    p.setVelocity(0, 0);
    p.setPosition(SPOT_X, SPOT_Y - 20).setFlipX(false);
    p.play(`${this.heroId}_idle`);
    const f = (this._fishing = {
      state: "cast",
      t: 0,
      close: () => this._endFishing(null),
      line: this.add.graphics().setDepth(p.y + 21),
      bobber: this.add.image(p.x + 20, p.y - 30, "px_bobber").setScale(S).setDepth(-8e5 + 3),
      keys: this.input.keyboard.addKeys("E,SPACE"),
    });
    this._modals.push(f);
    this._setTarget(null);
    // Lança: a boia faz um arco até um ponto da água
    const tx = PX - 60 + Math.random() * 90,
      ty = PY - 18 + Math.random() * 36;
    f.bx = tx;
    f.by = ty;
    this.tweens.add({ targets: f.bobber, x: tx, duration: 450, ease: "Sine.easeOut" });
    this.tweens.add({
      targets: f.bobber,
      y: { from: p.y - 30, to: ty },
      duration: 450,
      ease: (k) => k * k,
      onComplete: () => {
        this._splash(tx, ty, 6);
        f.state = "wait";
        f.t = FISHING.BITE_S[0] + Math.random() * (FISHING.BITE_S[1] - FISHING.BITE_S[0]);
        if (!this.meta.data.stats.fishCaught) f.t = 1.4;
      },
    });
    this.sound.play("sfx_dash", { volume: 0.3, rate: 1.4 });
    f.hint = text(this, this.W / 2, this.H - 40, "Espere a boia afundar…", { size: 20, color: CSS.goldHi, origin: 0.5, stroke: true }).setScrollFactor(0).setDepth(this.D_HUD + 8);
    f.onDown = () => this._fishTap();
    this.input.on("pointerdown", f.onDown);
    f.onKey = () => this._fishTap();
    f.keys.E.on("down", f.onKey);
    f.keys.SPACE.on("down", f.onKey);
    f.tick = (time, dtMs) => this._fishUpdate(Math.min(0.05, dtMs / 1000));
    this.events.on("update", f.tick);
    Analytics.track("fish_cast", {});
  },

  _splash(x, y, n) {
    for (let k = 0; k < n; k++) {
      const d = this.add.image(x, y, "px_dot2").setScale(2.5).setTint(PAL.ice3).setDepth(-8e5 + 4);
      const a = -Math.PI * Math.random();
      this.tweens.add({ targets: d, x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 14, alpha: 0, duration: 380, onComplete: () => d.destroy() });
    }
  },

  // Toque/tecla durante a pescaria
  _fishTap() {
    const f = this._fishing;
    if (!f) return;
    if (f.state === "wait") {
      f.hint.setText("Cedo demais! Espere a boia afundar.");
      this._endFishing(null, 900);
    } else if (f.state === "bite") this._fishFight();
    else if (f.state === "result") this._endFishing(f.result);
  },

  _fishUpdate(dt) {
    const f = this._fishing;
    if (!f) return;
    const p = this.player;
    // Linha da ponta do cajado até a boia
    f.line.clear();
    if (f.bobber) {
      const rx = p.x + 20,
        ry = p.y - 34;
      f.line.lineStyle(2, PAL.cream, 0.8);
      f.line.beginPath();
      f.line.moveTo(rx, ry);
      f.line.lineTo((rx + f.bobber.x) / 2, Math.max(ry, f.bobber.y) + 14);
      f.line.lineTo(f.bobber.x, f.bobber.y - 8);
      f.line.strokePath();
    }
    if (f.state === "wait") {
      f.bobber.y = f.by + Math.sin(this.time.now / 300) * 1.5;
      f.t -= dt;
      if (f.t <= 0) {
        // Fisgada!
        f.state = "bite";
        f.t = FISHING.HOOK_S;
        f.bobber.y = f.by + 6;
        this._splash(f.bx, f.by, 8);
        haptic(60);
        this.sound.play("sfx_chest_reel", { volume: 0.6, rate: 1.4 });
        f.hint.setText(this.isTouch ? "PUXE! Toque na tela!" : "PUXE! (E / espaço / clique)").setColor(CSS.redHi);
        f.bang = text(this, p.x, p.y - 80, "!", { size: 40, color: CSS.redHi, origin: 0.5, stroke: true }).setDepth(this.D_HUD - 5);
        this.tweens.add({ targets: f.bang, scale: { from: 1.6, to: 1 }, duration: 200 });
      }
    } else if (f.state === "bite") {
      f.bobber.y = f.by + 6 + Math.sin(this.time.now / 60) * 2;
      f.t -= dt;
      if (f.t <= 0) {
        f.hint.setText("O peixe soltou a isca…").setColor(CSS.muted);
        this._endFishing(null, 1000);
      }
    } else if (f.state === "fight") this._fightUpdate(f, dt);
  },

  // ---- Minijogo ----
  _fishFight() {
    const f = this._fishing;
    f.bang?.destroy();
    const roll = this.pond.roll();
    const fish = FISHING.FISH[roll.id];
    Object.assign(f, {
      state: "fight",
      fishId: roll.id,
      move: roll.tutorial ? "calm" : fish.move,
      speed: roll.tutorial ? 0.2 : fish.speed,
      zh: this.pond.zone * (roll.tutorial ? 1.4 : 1),
      z: 0.1,
      vz: 0,
      pos: 0.4,
      target: 0.5,
      cur: 0.3,
      timer: 0.5,
      prog: FISHING.START,
      inZone: true,
      slips: 0,
    });
    haptic(30);
    f.hint.setText(this.isTouch ? "Segure a tela para subir · solte para descer" : "Segure E / espaço / clique para subir · solte para descer").setColor(CSS.goldHi);
    // Barra na direita da tela
    const x = this.W - 130,
      y = this.H / 2;
    const c = (f.ui = this.add.container(x, y).setScrollFactor(0).setDepth(this.D_HUD + 7));
    const g = this.add.graphics();
    drawFrame(g, -40, -BAR_H / 2 - 16, 80, BAR_H + 32, "gold", { alpha: 0.95 });
    g.fillStyle(PAL.t1, 1).fillRect(-24, -BAR_H / 2, 48, BAR_H);
    g.fillStyle(PAL.t2, 1);
    for (let k = 0; k < 8; k++) g.fillRect(-24, -BAR_H / 2 + k * 48 + 20, 48, 3);
    f.zoneG = this.add.graphics();
    f.fishImg = this.add.image(0, 0, `ico_${roll.id}`).setScale(2.4);
    // Progresso ao lado
    const pg = this.add.graphics();
    drawFrame(pg, 44, -BAR_H / 2 - 16, 30, BAR_H + 32, "dark", { noRivets: true });
    f.progG = this.add.graphics();
    c.add([g, f.zoneG, f.fishImg, pg, f.progG]);
    c.list.forEach((o) => o.setScrollFactor(0));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  },

  _fishTarget(f) {
    const r = Math.random();
    const clamp = (v) => Math.max(0.03, Math.min(0.97, v));
    const away = (d) => clamp(f.pos + (Math.random() < 0.5 ? -1 : 1) * d);
    if (f.move === "darter" && r < 0.35) return [away(0.4 + Math.random() * 0.2), f.speed * 2.8, 0.5];
    if (f.move === "jumper" && r < 0.28) return [away(0.45), f.speed * 6, 0.55];
    if (f.move === "sinker") return [r < 0.8 ? Math.random() * 0.45 : Math.random(), f.speed * 0.8, 1 + Math.random()];
    const slow = f.move === "jumper" ? 0.5 : 1;
    return [Math.random(), f.speed * slow * (0.5 + Math.random() * 0.5), 0.8 + Math.random() * 0.8];
  },

  _fightUpdate(f, dt) {
    const F = FISHING;
    const hold = this.input.manager.pointers.some((pt) => pt.isDown) || f.keys.E.isDown || f.keys.SPACE.isDown;
    f.vz = Math.max(-1.3, Math.min(1.3, f.vz + (hold ? F.RISE : -F.FALL) * dt));
    f.z += f.vz * dt;
    if (f.z < 0) (f.z = 0), (f.vz = 0);
    if (f.z > 1 - f.zh) (f.z = 1 - f.zh), (f.vz = 0);
    // Peixe
    f.timer -= dt;
    if (f.timer <= 0) [f.target, f.cur, f.timer] = this._fishTarget(f);
    const d = f.target - f.pos;
    f.pos += Math.sign(d) * Math.min(Math.abs(d), f.cur * dt);
    // Dentro da zona: enche; fora: esvazia
    const inZone = f.pos >= f.z && f.pos <= f.z + f.zh;
    if (f.inZone && !inZone) {
      f.slips++;
      haptic(10);
    }
    f.inZone = inZone;
    f.prog += inZone ? dt / F.FILL_S : -dt / F.DRAIN_S;
    // Desenho
    const yOf = (v) => BAR_H / 2 - v * BAR_H;
    f.zoneG.clear();
    f.zoneG.fillStyle(inZone ? PAL.g5 : PAL.g3, 0.85).fillRect(-24, yOf(f.z + f.zh), 48, f.zh * BAR_H);
    f.zoneG.fillStyle(PAL.g6, 1).fillRect(-24, yOf(f.z + f.zh), 48, 3);
    f.fishImg.setY(yOf(f.pos)).setX(Math.sin(this.time.now / 90) * (inZone ? 1 : 3));
    f.progG.clear();
    const pr = Math.max(0, Math.min(1, f.prog));
    f.progG.fillStyle(pr > 0.3 ? PAL.yel2 : PAL.red2, 1).fillRect(50, BAR_H / 2 - 10 - pr * (BAR_H - 20), 18, pr * (BAR_H - 20));
    if (f.prog >= 1) this._fishCaught(f);
    else if (f.prog <= 0) {
      this.pond.lose();
      f.hint.setText("Escapou! Tente manter o peixe na zona verde.").setColor(CSS.muted);
      Analytics.track("fish_lost", { id: f.fishId });
      this._endFishing(null, 1200);
    }
  },

  _fishCaught(f) {
    const q = f.slips === 0 ? 2 : f.slips <= 2 ? 1 : 0;
    const r = this.pond.catch(f.fishId, q);
    const fish = FISHING.FISH[r.id];
    f.state = "result";
    f.result = r;
    f.ui?.destroy();
    f.ui = null;
    this.sound.play("sfx_levelup", { volume: 0.5 });
    haptic(40);
    Analytics.track("fish_caught", { id: r.id, q, cm: r.cm });
    // Cartão da pescaria
    const c = (f.card = this.add.container(this.W / 2, this.H / 2 - 40).setScrollFactor(0).setDepth(this.D_HUD + 9));
    const g = this.add.graphics();
    drawFrame(g, -210, -120, 420, 240, "gold", { alpha: 0.97 });
    const tag = r.first ? `Primeiro ${fish.name}!` : r.record ? "NOVO RECORDE!" : "Pegou!";
    c.add([
      g,
      text(this, 0, -92, tag, { size: 24, color: r.record || r.first ? CSS.goldHi : CSS.txt, origin: 0.5, stroke: true }),
      this.add.image(0, -30, `ico_${r.id}`).setScale(6),
      text(this, 0, 30, fish.name, { size: 26, origin: 0.5, stroke: true }),
      text(this, 0, 62, `${r.cm} cm  ·  ${GARDEN.QUALITY[q]}`, { size: 20, color: Q_COLOR[q], origin: 0.5 }),
      text(this, 0, 94, q === 2 ? "Pegada perfeita!" : "Sem deixar o peixe sair = Ouro", { size: 15, color: CSS.muted, origin: 0.5 }),
    ]);
    c.list.forEach((o) => o.setScrollFactor(0));
    c.setScale(0.8);
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: "Back.easeOut" });
    f.hint.setText("Toque para continuar").setColor(CSS.muted);
    f.bobber?.destroy();
    f.bobber = null;
    this.time.delayedCall(2600, () => this._fishing === f && this._endFishing(r));
  },

  // Fecha a pescaria (delay: deixa a mensagem na tela antes)
  _endFishing(result, delay = 0) {
    const f = this._fishing;
    if (!f || f.ending) return;
    f.ending = true;
    const done = () => {
      this.input.off("pointerdown", f.onDown);
      f.keys.E.off("down", f.onKey);
      f.keys.SPACE.off("down", f.onKey);
      this.events.off("update", f.tick);
      [f.line, f.bobber, f.ui, f.card, f.hint, f.bang].forEach((o) => o?.destroy());
      this._modals = this._modals.filter((m) => m !== f);
      this._fishing = null;
      this._refreshAll();
      if (this.pond.fish() <= 0) this._say("O lago descansa. Os peixes se esconderam — volte mais tarde.");
      else if (this.meta.data.stats.fishCaught === 1 && result) this._say("Belo peixe! Leve para a cozinha: com peixe saem pratos mais fortes.");
    };
    if (delay) {
      f.state = "ending";
      this.time.delayedCall(delay, done);
    } else done();
  },
};
