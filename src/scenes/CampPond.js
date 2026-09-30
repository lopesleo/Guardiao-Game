// Lago NO CHÃO da Clareira: o jogador vai até a ponta do trapiche e pesca
// ali mesmo. Lança a linha → espera a boia afundar → toca para fisgar →
// minijogo de um polegar por cima do mundo (segurar sobe a zona verde, soltar
// desce; manter o peixe dentro enche a barra). Sem deixar o peixe sair = Ouro.
// O lago é um igarapé vivo: brilho da lua correndo na água, bica caindo das
// pedras, vitórias-régias balançando, peixes saltando, lamparina refletida.
// Mixin da CampScene (Object.assign): usa this.meta e this.pond.
import { GAME, GARDEN, FISHING } from "../config.js";
import { Analytics } from "../systems/Analytics.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { POND_AW, POND_AH, pondShape, ISLE } from "../art/Pond.js";
import { text, drawFrame, haptic } from "../ui/Theme.js";

const S = GAME.PIXEL_SCALE;
const D_NIGHT = 50000; // luzes (ADD) por cima da camada de noite
const PX = 548,
  PY = 82; // centro da arte do lago no mapa
const X0 = PX - (POND_AW * S) / 2,
  Y0 = PY - (POND_AH * S) / 2; // canto superior-esquerdo
const FLAT = -8e5; // chão
// Trapiche: entra pela margem oeste; o herói pesca na ponta
const PIER_Y = 36; // linha (em px de arte) do trapiche
const PIER_AX = 4; // começa na terra
const PIER_TIP = 38; // ponta (px de arte)
const SPOT_X = X0 + PIER_TIP * S - 10,
  SPOT_Y = Y0 + PIER_Y * S + 12; // pés do herói na ponta
const Q_COLOR = [CSS.muted, hex(PAL.s4), CSS.goldHi];
const BAR_H = 380;

// px de arte → mundo
const wx = (ax) => X0 + (ax + 0.5) * S;
const wy = (ay) => Y0 + (ay + 0.5) * S;

// Ponto aleatório na água com profundidade mínima (em px de arte)
function waterPoint(minDepth = 2, filter = null) {
  const sh = pondShape();
  for (let k = 0; k < 200; k++) {
    const ax = Math.random() * sh.w,
      ay = Math.random() * sh.h;
    if (sh.inside(ax, ay) && sh.depth(ax, ay) >= minDepth && (!filter || filter(ax, ay))) return { x: X0 + ax * S, y: Y0 + ay * S, ax, ay };
  }
  return { x: PX, y: PY, ax: POND_AW / 2, ay: POND_AH / 2 };
}

export const CampPond = {
  _pondWorld() {
    const shown = this._isShown("pond");
    const sh = pondShape();
    const show = []; // aparecem na cena de revelação
    const lights = []; // luzes (ADD) — só depois de revelado
    const base = this.add.image(X0, Y0, "pond_base").setOrigin(0).setScale(S).setDepth(FLAT);
    show.push(base);

    // Brilho da lua correndo na água (acima da noite, somando luz)
    const glint = this.add.sprite(X0, Y0, "pond_glint", 0).setOrigin(0).setScale(S).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1).play("pond_glint");
    glint.setAlpha(0.5);
    glint._dayMin = 0.45; // de dia, o sol também brilha na água
    lights.push([glint, 0.5]);
    // Reflexo da lua: um clarão largo e riscos que tremem
    const deep = { x: wx(56), y: wy(28) }; // onde a lua bate
    const moon = this.add.image(deep.x, deep.y, "fx_glow").setScale(3.2, 0.9).setTint(0xbfeaff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    lights.push([moon, 0.22]);
    const streaks = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    lights.push([streaks, 0.8]);

    // Bica d'água nas pedras do nordeste + espuma
    const fallX = wx(90),
      fallY = wy(3);
    const fall = this.add.sprite(fallX, fallY, "pond_fall", 0).setOrigin(0.5, 0).setScale(S).setDepth(FLAT + 3).play("pond_fall");
    show.push(fall);
    const fallGlow = this.add.image(fallX, fallY + 40, "fx_glow").setScale(1.2, 0.6).setTint(0x8fd0c0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    lights.push([fallGlow, 0.25]);

    // Vitórias-régias e folhinhas, balançando devagar
    const floaters = [];
    const put = (key, ax, ay, sc = S) => {
      if (!sh.inside(ax, ay)) return;
      const o = this.add.image(wx(ax), wy(ay), key).setScale(sc).setDepth(FLAT + 2);
      show.push(o);
      floaters.push(o);
      this.tweens.add({ targets: o, y: o.y + 2, angle: { from: -1.5, to: 1.5 }, duration: 2200 + Math.random() * 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 1500 });
      return o;
    };
    put("pond_victoria", 74, 52);
    put("pond_victoria", 90, 30);
    for (const [ax, ay] of [[64, 58], [82, 57], [96, 38], [100, 28], [58, 22], [70, 18], [84, 44]]) put("pond_pad", ax, ay);
    // Flor da vitória-régia brilha de leve
    const bloom = this.add.image(wx(77), wy(51), "fx_glow").setScale(0.5).setTint(PAL.pink).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    lights.push([bloom, 0.35]);

    // Açaizeiro em pé na ilhota (balança devagar com o vento) + luar em volta
    const palm = this.add.image(wx(ISLE.x - 1), wy(ISLE.y + 1), "pond_palm").setOrigin(18 / 40, 1).setScale(S).setDepth(wy(ISLE.y + 1));
    show.push(palm);
    this.tweens.add({ targets: palm, angle: { from: -1.2, to: 1.2 }, duration: 3400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // Reflexo do açaizeiro na água (de ponta-cabeça, escuro, tremendo)
    const palmRef = this.add.image(palm.x, wy(ISLE.y + ISLE.ry) - 2, "pond_palm").setOrigin(18 / 40, 1).setScale(S, -S * 0.8).setTint(0x2a5a6a).setAlpha(0.35).setDepth(FLAT + 1);
    show.push(palmRef);
    this.tweens.add({ targets: palmRef, scaleX: { from: S * 0.97, to: S * 1.03 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const isleGlow = this.add.image(wx(ISLE.x), wy(ISLE.y) - 30, "fx_glow").setScale(2.2, 1.6).setTint(0x9fd8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    lights.push([isleGlow, 0.12]);
    this._solid(wx(ISLE.x), wy(ISLE.y), ISLE.rx * 2 * S, ISLE.ry * 2 * S);

    // Trapiche (entra pela margem oeste) + canoa amarrada
    const pier = this.add.image(wx(PIER_AX) - S / 2, wy(PIER_Y) - 11 * S, "camp_pier").setOrigin(0, 0).setScale(S).setDepth(FLAT + 4);
    show.push(pier);
    // canoa encostada na prainha do sul, meio na areia
    const canoe = this.add.image(wx(56), wy(57), "pond_canoe").setScale(S).setDepth(FLAT + 3).setAngle(-8);
    show.push(canoe);
    this.tweens.add({ targets: canoe, y: canoe.y + 2, angle: { from: -9, to: -6 }, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // Lamparina na ponta do trapiche + reflexo na água
    const lampX = pier.x + 35.5 * S,
      lampY = pier.y + 3 * S;
    const lamp = this._glow(lampX, lampY, 1.8, 0xffb36b, true);
    const lampRef = this.add.image(lampX, lampY + 60, "fx_glow").setScale(0.7, 1.6).setTint(0xffb36b).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
    lights.push([lamp, 0.5], [lampRef, 0.18]);

    // Colisão: faixas horizontais da água (a partir da máscara), deixando o
    // corredor do trapiche livre para o herói andar até a ponta
    const band = 4;
    // pés do herói (círculo de raio 18) andam na faixa das tábuas
    const pierY = wy(PIER_Y);
    const pierTop = pierY - 22,
      pierBot = pierY + 28;
    for (let ay = 0; ay < sh.h; ay += band) {
      let x0 = Infinity,
        x1 = -Infinity;
      for (let y = ay; y < Math.min(sh.h, ay + band); y++)
        for (let x = 0; x < sh.w; x++)
          if (sh.inside(x, y) && sh.depth(x, y) >= 1.5) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
          }
      if (x0 > x1) continue;
      const top = Y0 + ay * S,
        h = band * S;
      let left = X0 + x0 * S;
      const right = X0 + (x1 + 1) * S;
      if (top + h > pierTop && top < pierBot) left = Math.max(left, X0 + (PIER_TIP + 3) * S); // corredor
      if (right > left) this._solid((left + right) / 2, top + h / 2, right - left, h);
    }
    // Beiradas do trapiche: não deixam o herói cair na água
    const px0 = X0 + (PIER_AX + 6) * S,
      px1 = X0 + (PIER_TIP + 3) * S;
    this._solid((px0 + px1) / 2, pierTop - 12, px1 - px0, 24);
    this._solid((px0 + px1) / 2, pierBot + 12, px1 - px0, 24);

    // Névoa rasteira passando devagar sobre a água
    const mist = [];
    for (let k = 0; k < 3; k++) {
      const pt = waterPoint(3);
      const m = this.add.image(pt.x, pt.y, "fx_glow").setScale(4, 1.1).setTint(0xcfe8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
      lights.push([m, 0.06]);
      mist.push({ m, ox: pt.x, oy: pt.y, ph: k * 2.1 });
    }
    // Vaga-lumes sobre a água, com o reflexo embaixo
    const flies = [];
    for (let k = 0; k < 6; k++) {
      const pt = waterPoint(3);
      const g = this.add.image(pt.x, pt.y, "fx_glow").setScale(0.28).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 2);
      const c = this.add.image(pt.x, pt.y, "px_dot2").setScale(2).setTint(0xfff5b8).setDepth(D_NIGHT + 2);
      const ref = this.add.image(pt.x, pt.y, "px_dot2").setScale(2, 1).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
      flies.push({ g, c, ref, ox: pt.x, oy: pt.y - 30, ph: Math.random() * 7 });
    }

    lights.forEach(([o, a]) => o.setAlpha(a));
    // Tudo escondido até a revelação
    if (!shown) {
      show.forEach((o) => o.setAlpha(0));
      lights.forEach(([o]) => o.setVisible(false));
      flies.forEach((f) => [f.g, f.c, f.ref].forEach((o) => o.setVisible(false)));
    }
    const ruin = shown ? null : this.add.image(PX, PY + 40, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(PY + 40);
    this.buildings.pond = {
      x: PX - 40,
      y: PY + 60,
      img: null,
      ruin,
      shown,
      dot: this._notifyDot(SPOT_X, SPOT_Y - 110).setDepth(this.D_HUD - 10).setVisible(false),
      reveal: () => {
        this.tweens.add({ targets: show, alpha: (o) => (o === palmRef ? 0.35 : 1), duration: 900, delay: 300 });
        lights.forEach(([o]) => o.setVisible(true));
        flies.forEach((f) => [f.g, f.c, f.ref].forEach((o) => o.setVisible(true)));
      },
    };
    this._addInteract({
      x: SPOT_X,
      y: SPOT_Y,
      top: SPOT_Y - 70,
      r: 70,
      name: "LAGO",
      verb: "PESCAR",
      ruinOf: "pond",
      build: "pond",
      action: () => (this.buildings.pond.shown ? this._startFishing() : this._say("Cure a floresta jogando partidas para revelar o que há aqui.")),
    });
    // Examinar a ruína de longe (antes de revelar, o trapiche nem existe)
    this._addInteract({ x: PX - 40, y: PY + 60, top: PY - 20, r: 130, name: "LAGO", verb: "", ruinOf: "pond", hideWhenShown: "pond", action: () => this._say("Cure a floresta jogando partidas para revelar o que há aqui.") });

    // Vida na água (uma só rotina): ondinhas, bolhas quando há peixe,
    // peixe saltando de vez em quando, espuma da bica
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        if (!this.buildings.pond.shown) return;
        const hasFish = this.pond.fish() > 0;
        const r = Math.random();
        if (r < 0.28) this._ripple(waterPoint(2), 1);
        if (hasFish && r > 0.84) {
          // bolhinhas subindo = tem peixe
          const pt = waterPoint(4);
          for (let k = 0; k < 3; k++)
            this.time.delayedCall(k * 140, () => {
              const b = this.add.image(pt.x + (Math.random() - 0.5) * 8, pt.y, "px_dot1").setScale(3).setTint(PAL.ice3).setDepth(FLAT + 5);
              this.tweens.add({ targets: b, y: pt.y - 6, alpha: 0, duration: 500, onComplete: () => b.destroy() });
            });
        }
        if (hasFish && r > 0.985) this._fishJump();
        if (Math.random() < 0.5) {
          const f = this.add.image(fallX + (Math.random() - 0.5) * 22, fallY + 36 + Math.random() * 8, "px_dot2").setScale(2).setTint(PAL.white).setAlpha(0.8).setDepth(FLAT + 5);
          this.tweens.add({ targets: f, y: f.y + 8, x: f.x + (Math.random() - 0.5) * 14, alpha: 0, duration: 600, onComplete: () => f.destroy() });
        }
      },
    });
    // Animação contínua: lua tremendo, vaga-lumes, reflexos
    this.events.on("update", (time) => {
      if (!this.buildings.pond?.shown) return;
      const t = time / 1000;
      const k = this._lightK ?? 1;
      moon.setAlpha((0.18 + Math.sin(t * 0.9) * 0.05) * k).setScale(3.2 + Math.sin(t * 0.7) * 0.15, 0.9);
      lampRef.setAlpha((0.16 + Math.sin(t * 7) * 0.03 + Math.random() * 0.02) * k);
      bloom.setAlpha((0.28 + Math.sin(t * 1.3) * 0.08) * k);
      streaks.setAlpha(k);
      if (time > (this._moonTick || 0)) {
        // tracejado quebrado que tremula (atualiza em passos, como pixel-art)
        this._moonTick = time + 160;
        streaks.clear();
        for (let k = 0; k < 6; k++) {
          const w = Math.max(1, 4 - Math.abs(k - 1) - Math.floor(Math.random() * 2));
          const off = Math.round((Math.random() - 0.5) * 3 + Math.sin(t * 1.4 + k) * 2);
          const gap = 1 + Math.floor(Math.random() * 2);
          const y = deep.y - 15 + k * 6;
          streaks.fillStyle(0xdff4ff, 0.32 - k * 0.05).fillRect(deep.x + (off - w - gap) * 3, y, w * 3, 3);
          if (k < 4 && Math.random() < 0.7) streaks.fillStyle(0xdff4ff, 0.2 - k * 0.04).fillRect(deep.x + (off + gap) * 3, y, Math.max(1, w - 1) * 3, 3);
        }
      }
      for (const m of mist) m.m.setPosition(m.ox + Math.sin(t * 0.12 + m.ph) * 70, m.oy + Math.sin(t * 0.2 + m.ph) * 6).setAlpha((0.05 + Math.sin(t * 0.3 + m.ph) * 0.025) * (0.5 + k * 0.5));
      for (const f of flies) {
        const x = f.ox + Math.sin(t * 0.8 + f.ph) * 36,
          y = f.oy + Math.cos(t * 0.6 + f.ph) * 10;
        const a = 0.3 + Math.abs(Math.sin(t * 2.4 + f.ph)) * 0.7;
        f.g.setPosition(x, y).setAlpha(a * 0.6 * k);
        f.c.setPosition(x, y).setAlpha(a * k);
        f.ref.setPosition(x, f.oy + 30 + (30 - (y - f.oy)) * 0.4 + 18).setAlpha(a * 0.35 * k);
      }
    });
  },

  // Ondinha de pixel se abrindo na água
  _ripple(pt, s = 1) {
    const r = this.add.image(pt.x, pt.y, "px_ripple").setScale(S * 0.4 * s).setAlpha(0.55).setTint(0xbfeaff).setDepth(FLAT + 1);
    this.tweens.add({ targets: r, scale: S * 1.1 * s, alpha: 0, duration: 1300, ease: "Sine.easeOut", onComplete: () => r.destroy() });
  },

  // Um peixe salta e cai de volta (só quando o lago tem peixe)
  _fishJump() {
    const pt = waterPoint(5);
    const ids = Object.keys(FISHING.FISH);
    const f = this.add.image(pt.x, pt.y, `ico_${ids[Math.floor(Math.random() * 3)]}`).setScale(2).setDepth(FLAT + 6);
    const dir = Math.random() < 0.5 ? -1 : 1;
    f.setFlipX(dir > 0);
    this._ripple(pt, 0.8);
    this.tweens.add({ targets: f, x: pt.x + dir * 34, duration: 620, ease: "Linear" });
    this.tweens.add({ targets: f, y: pt.y - 30, angle: dir * 40, duration: 310, ease: "Sine.easeOut", yoyo: true, onComplete: () => {
      this._ripple({ x: pt.x + dir * 34, y: pt.y }, 1.2);
      for (let k = 0; k < 5; k++) {
        const d = this.add.image(pt.x + dir * 34, pt.y, "px_dot2").setScale(2).setTint(PAL.ice3).setDepth(FLAT + 6);
        this.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 20, y: d.y - 6 - Math.random() * 8, alpha: 0, duration: 380, onComplete: () => d.destroy() });
      }
      f.destroy();
    } });
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
      bobber: this.add.image(p.x + 20, p.y - 30, "px_bobber").setScale(S).setDepth(FLAT + 7),
      keys: this.input.keyboard.addKeys("E,SPACE"),
    });
    this._modals.push(f);
    this._setTarget(null);
    // Lança: a boia faz um arco até um ponto da água
    // A boia cai na água funda à frente do trapiche
    const spot = waterPoint(5, (ax, ay) => ax > PIER_TIP + 6 && ax < PIER_TIP + 40 && Math.abs(ay - PIER_Y) < 16);
    const tx = spot.x,
      ty = spot.y;
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
    this._ripple({ x, y }, 1.3);
    for (let k = 0; k < n; k++) {
      const d = this.add.image(x, y, "px_dot2").setScale(2.5).setTint(PAL.ice3).setDepth(FLAT + 8);
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
    this._dailyBump?.("fish");
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
