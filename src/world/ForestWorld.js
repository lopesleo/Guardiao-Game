// Mundo da floresta: chão, decalques, decoração, muralha de árvores na borda,
// atmosfera (vaga-lumes, folhas, feixes de luz, vinheta). Extraído da
// GameScene pra ela cuidar só de gameplay.
import { GAME } from "../config.js";
import { PAL } from "../art/Palette.js";
import { rng } from "../art/PixelArt.js";
import { vw, vh } from "../ui/Theme.js";

const S = GAME.PIXEL_SCALE;
const D_PATCH = -90;
const D_FLAT = -50; // flores/tufos (sempre embaixo de tudo)
const Y_SORT = 10000; // mesmo offset do player/inimigos

export class ForestWorld {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.R = opts.radius ?? GAME.WORLD_RADIUS;
    this.keys = scene.registry.get("envKeys");
    this.r = rng(opts.seed ?? (Math.random() * 1e9) | 0);
    this.trees = [];
    this.statics = []; // toda decoração fixa — culling por câmera em update()
    this._cullAt = 0;
    this._buildGround();
    this._scatter();
    this._border();
    if (opts.atmosphere !== false) this._atmosphere();
  }

  _pick(list) {
    return list[Math.floor(this.r() * list.length)];
  }

  // Chão: tileSprite do TAMANHO DA TELA, fixo na câmera; o deslocamento da
  // textura acompanha o scroll (1 quad só, em vez de um sprite de 14000px).
  _buildGround() {
    const sc = this.scene;
    sc.cameras.main.setBackgroundColor(0x1d3926);
    this.ground = sc.add
      .tileSprite(0, 0, vw(sc), vh(sc), "env_ground")
      .setOrigin(0)
      .setScrollFactor(0)
      .setTileScale(S)
      .setDepth(-100);
    this._onResize = () => this.ground.setSize(vw(sc), vh(sc));
    sc.scale.on("resize", this._onResize);
    sc.events.once("shutdown", () => sc.scale.off("resize", this._onResize));
  }

  _img(x, y, frame, depth, originY = 1, flip = null) {
    const im = this.scene.add
      .image(Math.round(x), Math.round(y), "env", frame)
      .setOrigin(0.5, originY)
      .setScale(S)
      .setDepth(depth);
    if (flip ?? this.r() < 0.5) im.setFlipX(true);
    this.statics.push(im);
    return im;
  }

  // Sombra pixelada no pé de objetos altos
  _shadow(x, y, w) {
    const sh = this.scene.add
      .image(Math.round(x), Math.round(y), "px_shadow")
      .setScale((w / 14) * 0.9, S)
      .setAlpha(0.8)
      .setDepth(D_PATCH + 5);
    this.statics.push(sh);
  }

  _scatter() {
    const R = this.R,
      k = this.keys;
    const clear = (x, y, r = 240) => x * x + y * y > r * r; // spawn do player livre
    const grid = (cell, fn) => {
      for (let cy = -R; cy < R; cy += cell)
        for (let cx = -R; cx < R; cx += cell) fn(cx + this.r() * cell, cy + this.r() * cell);
    };

    // Decalques grandes no chão (quebram a repetição do tile)
    grid(380, (x, y) => {
      const roll = this.r();
      const list = roll < 0.5 ? k.patches.dark : roll < 0.75 ? k.patches.moss : k.patches.dirt;
      this._img(x, y, this._pick(list), D_PATCH, 0.5).setFlipY(this.r() < 0.5);
    });

    // Detalhes rasteiros (sem y-sort)
    grid(150, (x, y) => {
      if (this.r() > 0.7) return;
      const roll = this.r();
      const f = roll < 0.45 ? this._pick(k.tufts) : roll < 0.8 ? this._pick(k.flowers) : this._pick(k.shrooms);
      this._img(x, y, f, D_FLAT);
      // Tufos em grupinhos
      if (roll < 0.45 && this.r() < 0.6) this._img(x + 18 + this.r() * 12, y + 6, this._pick(k.tufts), D_FLAT);
    });

    // Obstáculos visuais médios (y-sort)
    grid(330, (x, y) => {
      if (!clear(x, y) || this.r() > 0.55) return;
      const roll = this.r();
      const f =
        roll < 0.4 ? this._pick(k.bushes) : roll < 0.7 ? this._pick(k.rocks) : roll < 0.9 ? this._pick(k.stumps) : this._pick(k.logs);
      this._img(x, y, f, y + Y_SORT);
    });

    // Árvores (y-sort + desvanecem quando o player passa atrás)
    grid(430, (x, y) => {
      if (!clear(x, y, 320) || this.r() > 0.5) return;
      this._tree(x, y);
      // Pequenos bosques
      if (this.r() < 0.35) this._tree(x + 60 + this.r() * 50, y + 20 + this.r() * 40);
    });
  }

  _tree(x, y, list = null) {
    const k = this.keys;
    const f = list ? this._pick(list) : this.r() < 0.28 ? this._pick(k.pines) : this._pick(k.trees);
    const im = this._img(x, y, f, y + Y_SORT);
    this._shadow(x, y - 2, im.displayWidth * 0.7);
    this.trees.push(im);
    return im;
  }

  // Muralha de floresta nas bordas: a arena vira uma CLAREIRA fechada
  _border() {
    const R = this.R;
    const k = this.keys;
    const all = [...k.trees, ...k.pines, ...k.pines];
    const step = 74;
    for (let t = -R - 60; t < R + 60; t += step) {
      for (let row = 0; row < 2; row++) {
        const inset = 30 + row * 80 + this.r() * 30;
        const j = () => t + (this.r() - 0.5) * 40;
        this._tree(j(), -R + inset, all); // topo
        this._tree(j(), R - inset + 40, all); // base
        this._tree(-R + inset, j(), all); // esquerda
        this._tree(R - inset, j(), all); // direita
      }
    }
  }

  _atmosphere() {
    const sc = this.scene;
    const W = vw(sc),
      H = vh(sc);

    // Feixes de luz diagonais (aditivos, bem sutis) — dão profundidade
    this.shafts = [];
    for (let i = 0; i < 3; i++) {
      const s = sc.add
        .image(W * (0.2 + i * 0.3), H * 0.3, "fx_glow")
        .setScrollFactor(0)
        .setScale(3.5, 18)
        .setRotation(-0.5)
        .setTint(0xfff2b0)
        .setAlpha(0.05)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(48600); // acima do mapa de luz: os feixes CLAREIAM
      s._phase = i * 2.1;
      this.shafts.push(s);
    }

    // Vaga-lumes e folhas em espaço de MUNDO (renascem ao sair da tela)
    this.ambient = [];
    for (let i = 0; i < 14; i++) {
      const glow = sc.add.image(0, 0, "fx_glow").setScale(0.35).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(20000);
      const core = sc.add.image(0, 0, "px_dot2").setScale(S * 0.7).setTint(0xfff5b8).setDepth(20001);
      const p = { kind: "ff", glow, core, x: 0, y: 0, phase: this.r() * 7 };
      this._respawn(p, true);
      this.ambient.push(p);
    }
    for (let i = 0; i < 9; i++) {
      const leaf = sc.add.image(0, 0, "px_leaf").setScale(S).setDepth(20000);
      if (i % 3 === 0) leaf.setTint(0xe0a050);
      const p = { kind: "leaf", core: leaf, x: 0, y: 0, phase: this.r() * 7, vy: 18 + this.r() * 14, vx: (this.r() - 0.5) * 26 };
      this._respawn(p, true);
      this.ambient.push(p);
    }

    // Vinheta (cantos) + camada vermelha pra HP baixo
    const key = `vignette_${W}x${H}`;
    if (!sc.textures.exists(key)) {
      const c = sc.textures.createCanvas(key, W, H);
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(10,6,16,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      c.refresh();
    }
    sc.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(49000);
    this.lowHp = sc.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(49001).setTint(0xff2038).setAlpha(0);
  }

  _respawn(p, anywhere = false) {
    const cam = this.scene.cameras.main;
    p.x = cam.scrollX + this.r() * cam.width;
    p.y = p.kind === "leaf" && !anywhere ? cam.scrollY - 20 : cam.scrollY + this.r() * cam.height;
  }

  // Esconde decoração fora da câmera (com margem) — o Phaser não faz culling
  // de imagens soltas; sem isto ~2000 objetos iriam pro renderer todo frame.
  _cull() {
    const v = this.scene.cameras.main.worldView;
    const M = 260;
    const x0 = v.x - M,
      x1 = v.right + M,
      y0 = v.y - M,
      y1 = v.bottom + M + 200; // árvores têm origem no pé: copa fica acima
    for (const o of this.statics) {
      const on = o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;
      if (o.visible !== on) o.setVisible(on);
    }
  }

  update(time, dt, player) {
    const cam = this.scene.cameras.main;
    if (time >= this._cullAt) {
      this._cullAt = time + 150;
      this._cull();
    }
    this.ground.tilePositionX = cam.scrollX / S;
    this.ground.tilePositionY = cam.scrollY / S;

    // Árvores na frente do player ficam translúcidas (não esconder o herói)
    if (player) {
      for (const t of this.trees) {
        if (!t.visible) continue;
        const dx = Math.abs(t.x - player.x);
        if (dx > t.displayWidth * 0.5) {
          if (t.alpha < 1) t.setAlpha(1);
          continue;
        }
        const behind = player.y < t.y - 6 && player.y > t.y - t.displayHeight;
        const a = behind ? 0.45 : 1;
        if (t.alpha !== a) t.setAlpha(Phaser.Math.Linear(t.alpha, a, 0.25));
      }
    }

    if (!this.ambient) return;
    for (const s of this.shafts) s.setAlpha(0.035 + Math.sin(time / 2600 + s._phase) * 0.02);
    const M = 40;
    for (const p of this.ambient) {
      if (p.kind === "ff") {
        p.x += Math.sin(time / 900 + p.phase) * 0.35;
        p.y += Math.cos(time / 1100 + p.phase) * 0.3 - 0.08;
        const a = 0.25 + Math.abs(Math.sin(time / 400 + p.phase)) * 0.6;
        p.core.setPosition(p.x, p.y).setAlpha(a);
        p.glow.setPosition(p.x, p.y).setAlpha(a * 0.5);
      } else {
        p.x += (p.vx + Math.sin(time / 600 + p.phase) * 14) * (dt / 1000);
        p.y += p.vy * (dt / 1000);
        p.core.setPosition(p.x, p.y).setRotation(Math.sin(time / 300 + p.phase) * 0.8);
      }
      if (p.x < cam.scrollX - M || p.x > cam.scrollX + cam.width + M || p.y < cam.scrollY - M || p.y > cam.scrollY + cam.height + M)
        this._respawn(p);
    }

    if (player && this.lowHp) {
      const pct = player.hp / player.maxHp;
      this.lowHp.setAlpha(pct < 0.3 ? ((0.3 - pct) / 0.3) * (0.7 + Math.sin(time / 180) * 0.3) : 0);
    }
  }
}
