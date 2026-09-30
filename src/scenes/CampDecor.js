// Ambientação da Clareira: trilhas de terra ligando a fogueira a cada lugar,
// varal de bandeirinhas com luzinhas sobre o terreiro, rede, espantalho,
// capim balançando, folhas caindo, faíscas da forja, brilho do santuário e
// vinheta. Nada aqui tem regra de jogo — é só o lugar ficar vivo.
// Mixin da CampScene (Object.assign).
import { GAME, SEASONS } from "../config.js";
import { PAL } from "../art/Palette.js";
import { paintGround, FLAG_COUNT } from "../art/CampDecor.js";
import { Clock } from "../systems/Clock.js";

const S = GAME.PIXEL_SCALE;
const D_NIGHT = 50000;
const HUB = { x: 0, y: 70, r: 175 }; // terreiro em volta da fogueira

// Data comemorativa de hoje (ou null). ?festa=<id> força uma (só com ?debug=1)
export function currentSeason(date = Clock.date()) {
  const q = new URLSearchParams(location.search);
  if (q.get("debug") === "1" && q.get("festa")) return SEASONS.find((s) => s.id === q.get("festa")) || null;
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return SEASONS.find((s) => md >= s.from[0] * 100 + s.from[1] && md <= s.to[0] * 100 + s.to[1]) || null;
}

// Céu pela hora REAL do aparelho: cor da camada de "noite" (multiply) e quanto
// as luzes (fogueira, luzinhas, lamparina, lua, vaga-lumes) aparecem (k).
const SKY = [
  [0, 0x5a6a9a, 1],
  [5, 0x5a6a9a, 1],
  [6.5, 0xc8a0b0, 0.55], // amanhecer rosado
  [8, 0xffffff, 0],
  [16.5, 0xffffff, 0],
  [18, 0xf2b890, 0.35], // fim de tarde dourado
  [19.3, 0x8c78aa, 0.8], // anoitecer roxo
  [20.5, 0x5a6a9a, 1],
  [24, 0x5a6a9a, 1],
];
const lerpColor = (a, b, t) => {
  const ch = (c, s) => (c >> s) & 255;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};
export function skyAt(hour) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0, k0] = SKY[i],
      [h1, c1, k1] = SKY[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = (hour - h0) / (h1 - h0 || 1);
      return { color: lerpColor(c0, c1, t), k: k0 + (k1 - k0) * t };
    }
  }
  return { color: SKY[0][1], k: 1 };
}

// Áreas reservadas (sem cogumelo/flor/capim soltos): horta, lago, celeiro,
// cozinha e o terreiro da fogueira
const RESERVED = [
  [-170, 250, 210, 500],
  [360, -40, 740, 210],
  [-400, 260, -200, 480],
  [200, 280, 420, 480],
];
export const decorFree = (x, y) => !RESERVED.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);

export const CampDecor = {
  // Chão pintado sob medida: terreiro + trilhas (chamado por _ground)
  _paintPaths(bounds) {
    // Rede de trilhas: troncos que saem do terreiro e se ramificam
    const W_ = { x: -300, y: 70 },
      E_ = { x: 290, y: 40 },
      S_ = { x: 10, y: 285 };
    const paths = [
      { x: 0, y: bounds.top - 260, w: 66, bend: 0.12, taper: false }, // a trilha da floresta (norte)
      { ...W_, w: 40, bend: 0.25 }, // tronco oeste
      { from: W_, x: -430, y: -110, w: 30, bend: -0.3 }, // Santuário
      { from: W_, x: -420, y: 300, w: 28, bend: 0.3 }, // Mural
      { from: W_, x: -600, y: 80, w: 20, bend: 0.2 }, // a rede
      { ...E_, w: 40, bend: -0.2 }, // tronco leste
      { from: E_, x: 440, y: -96, w: 30, bend: 0.3 }, // Forja
      { from: E_, x: 410, y: 84, w: 30, bend: -0.2 }, // trapiche do Lago
      { ...S_, w: 44, bend: 0.15 }, // tronco sul (Horta)
      { from: { x: -40, y: 250 }, x: -300, y: 490, w: 28, bend: -0.25 }, // Celeiro
      { from: { x: 70, y: 250 }, x: 300, y: 480, w: 28, bend: 0.25 }, // Cozinha
      { from: { x: 200, y: 360 }, x: 440, y: 312, w: 22, bend: -0.3 }, // ninho do João-de-barro
    ];
    const ground = paintGround(this, "camp_ground_paint", {
      x0: bounds.x0,
      y0: bounds.top - 300,
      w: bounds.w,
      h: bounds.h + 300,
      scale: S,
      hub: HUB,
      paths,
    });
    this.add.image(bounds.x0, bounds.top - 300, "camp_ground_paint").setOrigin(0).setScale(S).setDepth(-9.5e5);
    return ground;
  },

  _decor() {
    this._campfireSeats();
    // Bandeirinhas e luzinhas só na festa junina/julina (data real)
    if ((this._seasonOverride ?? currentSeason()?.id) === "junina") this._bunting();
    // Rede listrada perto da mata, a oeste
    const hx = -600,
      hy = 90;
    this.add.image(hx, hy + 4, "px_shadow").setScale(9, 3).setAlpha(0.45).setDepth(hy - 1);
    this.add.image(hx, hy, "camp_hammock").setOrigin(0.5, 1).setScale(S).setDepth(hy);
    this._solid(hx - 60, hy - 6, 14, 12);
    this._solid(hx + 60, hy - 6, 14, 12);
    // Espantalho guardando a horta + regador
    const sx = -175,
      sy = 350;
    this.add.image(sx, sy + 4, "px_shadow").setScale(4, 2).setAlpha(0.5).setDepth(sy - 1);
    const crow = this.add.image(sx, sy, "camp_scarecrow").setOrigin(0.5, 1).setScale(S).setDepth(sy);
    this.tweens.add({ targets: crow, angle: { from: -2, to: 2 }, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this._solid(sx, sy - 4, 12, 10);
    this.add.image(158, 344, "camp_can").setOrigin(0.5, 1).setScale(S).setDepth(344);
    // Samaúma: a gigante da mata, marco da Clareira (a noroeste)
    const kx = -250,
      ky = -250;
    this.add.image(kx, ky + 6, "px_shadow").setScale(18, 6).setAlpha(0.5).setDepth(ky - 1);
    const kapok = this.add.image(kx, ky, "camp_kapok").setOrigin(0.5, 1).setScale(S).setDepth(ky);
    this._solid(kx, ky - 16, 90, 28);
    this.tweens.add({ targets: kapok, scaleX: { from: S, to: S * 1.01 }, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // Vaga-lumes rondando a copa (entram no mesmo balé dos outros)
    for (let k = 0; k < 9; k++) {
      const x = kx + (Math.random() - 0.5) * 200,
        y = ky - 220 + Math.random() * 120;
      const g = this.add.image(x, y, "fx_glow").setScale(0.3).setTint(0xd8ffb0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
      const c = this.add.image(x, y, "px_dot2").setScale(2).setTint(0xe8ffc8).setDepth(D_NIGHT + 1);
      this.flies.push({ g, c, ph: Math.random() * 7, ox: x, oy: y });
    }
    // Pedras com samambaia (nordeste) e helicônias perto das construções
    this.add.image(230, -300, "camp_rocks").setOrigin(0.5, 1).setScale(S).setDepth(-300);
    this._solid(215, -318, 70, 24);
    for (const [x, y, t] of [[-360, -60, 0], [-500, -150, 1], [520, -60, 0], [360, -150, 1], [-330, 330, 1], [200, 470, 0], [-175, 530, 1], [560, 250, 0], [-650, 220, 0], [120, -250, 1]]) {
      const h = this.add.image(x, y, `camp_heliconia${t}`).setOrigin(0.5, 1).setScale(S).setDepth(y);
      this.tweens.add({ targets: h, angle: { from: -3, to: 3 }, duration: 2000 + Math.random() * 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 1000 });
    }
    this._grassSway();
    this._ambientLife();
    // Vinheta: foca o olhar no meio da tela
    this.vignette = this.add.image(0, 0, "fx_vignette").setOrigin(0).setScrollFactor(0).setDisplaySize(this.W, this.H).setAlpha(0.55).setDepth(D_NIGHT + 3);
    // Céu pela hora real (dia, entardecer, noite, amanhecer)
    this.time.delayedCall(0, () => this._applyTimeOfDay());
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this._applyTimeOfDay() });
  },

  // Aplica o céu da hora atual (chamado ao entrar e a cada 30 s)
  _applyTimeOfDay() {
    const now = Clock.date();
    const hour = this._hourOverride ?? now.getHours() + now.getMinutes() / 60;
    const sky = skyAt(hour);
    this._lightK = sky.k;
    this.nightRect.setFillStyle(sky.color, 1).setVisible(sky.color !== 0xffffff);
    this.vignette?.setAlpha(0.3 + 0.28 * sky.k);
    // Luzes paradas (ADD por cima da noite): guardam o alpha original
    for (const o of this.children.list) {
      if (o.blendMode !== Phaser.BlendModes.ADD || o.depth < D_NIGHT || o.depth > D_NIGHT + 5) continue;
      if (o._baseA == null) o._baseA = o.alpha;
      o.setAlpha(o._baseA * Math.max(sky.k, o._dayMin ?? 0));
    }
  },

  // Troncos de sentar em volta da fogueira
  _campfireSeats() {
    for (const [x, y, flip] of [
      [-122, 40, false],
      [8, 156, true],
      [92, -8, true],
    ]) {
      this.add.image(x, y + 4, "px_shadow").setScale(6, 2).setAlpha(0.5).setDepth(y - 1);
      this.add.image(x, y, "camp_logseat").setOrigin(0.5, 1).setScale(S).setFlipX(flip).setDepth(y);
      this._solid(x, y - 10, 72, 14);
    }
  },

  // Varal de bandeirinhas cruzando o terreiro (festa junina), com luzinhas.
  // Só aparece na época (SEASONS no config)
  _bunting() {
    const poles = [
      [-215, -30],
      [215, -30],
      [215, 205],
      [-215, 205],
    ];
    const H = 96; // altura do topo do poste
    for (const [x, y] of poles) {
      this.add.image(x, y + 3, "px_shadow").setScale(2.5, 2).setAlpha(0.5).setDepth(y - 1);
      this.add.image(x, y, "camp_pole").setOrigin(0.5, 1).setScale(S).setDepth(y);
      this._solid(x, y - 4, 12, 10);
    }
    const lines = [
      [0, 2, 46],
      [1, 3, 46],
      [0, 1, 26],
      [3, 2, 26],
    ];
    const g = this.add.graphics().setDepth(D_NIGHT - 20);
    let k = 0;
    for (const [a, b, sag] of lines) {
      const [x1, y1] = poles[a],
        [x2, y2] = poles[b];
      const p1 = { x: x1, y: y1 - H },
        p2 = { x: x2, y: y2 - H };
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const at = (u) => ({ x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u + Math.sin(u * Math.PI) * sag });
      // o barbante (pixels de 3 px)
      g.fillStyle(PAL.ink, 1);
      for (let u = 0; u <= 1; u += 3 / len) {
        const q = at(u);
        g.fillRect(Math.round(q.x / 3) * 3, Math.round(q.y / 3) * 3, 3, 3);
      }
      // bandeirinhas e, de vez em quando, uma luzinha
      const n = Math.floor(len / 24);
      for (let i = 1; i < n; i++) {
        const q = at(i / n);
        if (i % 4 === 0) {
          this.add.image(q.x, q.y, "camp_bulb").setOrigin(0.5, 0).setScale(S).setDepth(D_NIGHT - 19);
          const glow = this.add.image(q.x, q.y + 9, "fx_glow").setScale(0.55).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(D_NIGHT + 1);
          this.glows.push({ g: glow, base: 0.45, ph: Math.random() * 10 });
          continue;
        }
        const f = this.add.image(q.x, q.y, `camp_flag${k++ % FLAG_COUNT}`).setOrigin(0.5, 0).setScale(S).setDepth(D_NIGHT - 19);
        this.tweens.add({ targets: f, angle: { from: -7, to: 7 }, scaleY: { from: S, to: S * 0.9 }, duration: 700 + Math.random() * 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 800 });
      }
    }
  },

  // Touceiras de capim alto que balançam com o vento
  _grassSway() {
    const env = this.registry.get("envKeys");
    const rnd = new Phaser.Math.RandomDataGenerator(["capim"]);
    const spots = [
      [-640, -200], [-560, 300], [-300, 120], [-330, -300], [250, 200], [620, -300], [640, 330], [180, -330], [-120, -250], [-640, 460], [600, 470], [-450, 440],
    ];
    for (const [cx, cy] of spots) {
      for (let k = 0; k < 6; k++) {
        const x = cx + rnd.between(-40, 40),
          y = cy + rnd.between(-22, 22);
        if (this.groundPaint?.onPath(x, y, 10) || !decorFree(x, y)) continue;
        const t = this.add.image(x, y, "env", rnd.pick(env.tufts)).setOrigin(0.5, 1).setScale(S).setDepth(y);
        this.tweens.add({ targets: t, angle: { from: -4, to: 5 }, duration: 1400 + rnd.between(0, 900), yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: rnd.between(0, 1200) });
      }
      if (rnd.frac() < 0.7) {
        const f = this.add.image(cx + rnd.between(-20, 20), cy + 10, "env", rnd.pick(env.flowers)).setOrigin(0.5, 1).setScale(S).setDepth(cy + 10);
        this.tweens.add({ targets: f, angle: { from: -3, to: 3 }, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
  },

  // Folhas caindo, faíscas da forja, luzinhas subindo do santuário
  _ambientLife() {
    this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        const cam = this.cameras.main;
        if (Math.random() < 0.55) {
          const x = cam.scrollX + Math.random() * this.W,
            y = cam.scrollY - 20;
          const leaf = this.add.image(x, y, "px_leaf").setScale(S).setTint([0x9ccf62, 0xc7922b, 0x6aab4a][Math.floor(Math.random() * 3)]).setDepth(D_NIGHT - 5);
          const drift = (Math.random() - 0.5) * 240;
          this.tweens.add({ targets: leaf, y: y + this.H * (0.6 + Math.random() * 0.5), x: x + drift, duration: 6000 + Math.random() * 3000, ease: "Sine.easeIn", onComplete: () => leaf.destroy() });
          this.tweens.add({ targets: leaf, angle: { from: -40, to: 40 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
          this.tweens.add({ targets: leaf, alpha: 0, delay: 4800, duration: 1500 });
        }
        const forge = this.buildings.forge;
        if (forge?.shown && Math.random() < 0.8) {
          const s = this.add.image(forge.x - 44 + Math.random() * 10, forge.y - 40, "px_dot1").setScale(3).setTint(Math.random() < 0.5 ? 0xffb36b : 0xffe58f).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 2);
          this.tweens.add({ targets: s, y: s.y - 50 - Math.random() * 40, x: s.x + (Math.random() - 0.5) * 30, alpha: 0, duration: 900 + Math.random() * 500, onComplete: () => s.destroy() });
        }
        const shrine = this.buildings.shrine;
        if (shrine?.shown && Math.random() < 0.6) {
          const m = this.add.image(shrine.x + (Math.random() - 0.5) * 70, shrine.y - 30, "px_dot1").setScale(3).setTint(0xffe58f).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 2);
          this.tweens.add({ targets: m, y: m.y - 70 - Math.random() * 30, alpha: { from: 0.9, to: 0 }, duration: 1800, ease: "Sine.easeOut", onComplete: () => m.destroy() });
        }
      },
    });
  },
};
