// Iluminação dinâmica 2D ("cara de ray tracing" sem custar caro):
//  1) MAPA DE LUZ: um RenderTexture do tamanho da tela é pintado com a cor
//     ambiente (entardecer → noite ao longo da partida) e cada fonte de luz é
//     somada por cima (blend ADD) na sua cor. O mapa é desenhado sobre o mundo
//     em MULTIPLY: longe das luzes fica escuro; perto, o chão ganha a COR da
//     luz (fogo alaranja, gelo azula, raio arroxeia).
//  2) SOMBRAS DINÂMICAS: árvores perto do herói projetam sombras alongadas na
//     direção OPOSTA à luz dele — giram e esticam enquanto você anda.
// HUD, números de dano e avisos ficam acima (profundidade maior) e não escurecem.
import { GAME } from "../config.js";
import { Settings } from "../systems/Settings.js";
import { vw, vh } from "../ui/Theme.js";

const D_LIGHTMAP = 48500;
const RES = 4; // mapa de luz em 1/4 da resolução (luz é suave) → 16× menos pixels
const D_TREE_SHADOW = -80;

// Ambiente: início da partida (fim de tarde) → 7:00 (noite) → chefe
const AMB_DUSK = [0xb8, 0xb0, 0xbe];
const AMB_NIGHT = [0x2a, 0x30, 0x52];
const AMB_BOSS = [0x24, 0x1c, 0x3a];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => (Math.round(lerp(c1[0], c2[0], t)) << 16) | (Math.round(lerp(c1[1], c2[1], t)) << 8) | Math.round(lerp(c1[2], c2[2], t));

function ensureTextures(scene) {
  if (!scene.textures.exists("fx_light")) {
    // OPACA: branco no centro → PRETO nas bordas. Em blend aditivo, preto não
    // soma nada — assim os cantos do quad nunca aparecem (com alfa, o desenho
    // em lote do RenderTexture somava os cantos e as luzes viravam quadrados).
    const S = 128;
    const c = scene.textures.createCanvas("fx_light", S, S);
    const ctx = c.getContext();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2 - 1);
    g.addColorStop(0, "rgb(255,255,255)");
    g.addColorStop(0.35, "rgb(178,178,178)");
    g.addColorStop(0.7, "rgb(56,56,56)");
    g.addColorStop(1, "rgb(0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    c.refresh();
  }
  if (!scene.textures.exists("fx_castshadow")) {
    // Sombra projetada: forte no pé, esmaecendo na ponta (origem à esquerda)
    const W = 128,
      H = 32;
    const c = scene.textures.createCanvas("fx_castshadow", W, H);
    const ctx = c.getContext();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(8,6,16,0.9)");
    g.addColorStop(1, "rgba(8,6,16,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    c.refresh();
  }
}

const MAX_LIGHTS = 72; // teto por frame (o resto é descartado)
const REFRESH_MS = 33; // mapa de luz redesenhado a ~30 Hz (luz não precisa de 60)

export class Lighting {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.flashes = [];
    this.shadowPool = [];
    this.stamps = []; // pool de "carimbos" de luz — TODOS desenhados numa chamada só
    this._nextDraw = 0;
    this.rt = null;
    this.setEnabled(Settings.get("lighting") !== false);
  }

  // Liga/desliga na hora (opção em Pausa/Opções), sem reiniciar a partida
  setEnabled(on) {
    this.enabled = on;
    const scene = this.scene;
    if (on && !this.rt) {
      ensureTextures(scene);
      this.rt = scene.add
        .renderTexture(0, 0, Math.ceil(vw(scene) / RES), Math.ceil(vh(scene) / RES))
        .setOrigin(0)
        .setScale(RES)
        .setScrollFactor(0)
        .setDepth(D_LIGHTMAP)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
      this._onResize = () => this.rt?.resize(Math.ceil(vw(scene) / RES), Math.ceil(vh(scene) / RES));
      scene.scale.on("resize", this._onResize);
      scene.events.once("shutdown", () => scene.scale.off("resize", this._onResize));
    }
    this.rt?.setVisible(on);
    if (!on) {
      this.flashes = [];
      for (const sh of this.shadowPool) sh.setVisible(false);
    }
  }

  // Luz passageira (clarão de raio, explosão, reação)
  flash(x, y, r, color, ms = 180, power = 1) {
    if (!this.enabled) return;
    this.flashes.push({ x, y, r, color, t0: this.scene.time.now, ms, power });
  }

  // Enfileira uma luz (em coordenadas do mapa de luz, 1/RES da tela)
  _light(x, y, r, color, alpha = 1) {
    if (this._n >= MAX_LIGHTS || alpha <= 0.02) return;
    const cam = this.scene.cameras.main;
    const sx = x - cam.scrollX,
      sy = y - cam.scrollY;
    if (sx < -r || sy < -r || sx > cam.width + r || sy > cam.height + r) return;
    let st = this.stamps[this._n];
    if (!st) {
      st = this.scene.make.image({ key: "fx_light", add: false }).setBlendMode(Phaser.BlendModes.ADD);
      this.stamps.push(st);
    }
    this._n++;
    // Intensidade = cor escurecida (alfa não é confiável no blend aditivo em lote)
    const k = Math.min(1, alpha);
    const tint = (Math.round(((color >> 16) & 255) * k) << 16) | (Math.round(((color >> 8) & 255) * k) << 8) | Math.round((color & 255) * k);
    st.setPosition(sx / RES, sy / RES)
      .setScale((r * 2) / 128 / RES)
      .setTint(tint);
  }

  update(time) {
    if (!this.enabled) return;
    this._treeShadows(this.scene.player);
    if (time < this._nextDraw) return;
    this._nextDraw = time + REFRESH_MS;
    const s = this.scene;
    const p = s.player;
    this._n = 0;

    // ---- Fontes de luz (em ordem de importância: o teto corta as últimas) ----
    if (p?.active) {
      const awake = p.isAwakened?.();
      this._light(p.x, p.y, awake ? 430 : 330, awake ? 0xffd070 : 0xffe2b8, 1);
      this._light(p.x, p.y, 120, 0xffffff, 0.35); // miolo
    }
    this.flashes = this.flashes.filter((f) => time - f.t0 < f.ms);
    for (const f of this.flashes) {
      const k = 1 - (time - f.t0) / f.ms;
      this._light(f.x, f.y, f.r * (0.8 + 0.2 * k), f.color, k * f.power);
    }
    if (s.boss?.active) {
      const fury = s.boss.phase === 2;
      this._light(s.boss.x, s.boss.y - 30, fury ? 260 : 180, fury ? 0xff6a2a : 0xb03aa0, 0.7);
    }
    s.projectilePool?.forEachActive((pr) => {
      const c = pr.element === "ice" ? 0x5cc8ff : pr.element === "bolt" ? 0xc78cff : 0xff8a3c;
      this._light(pr.x, pr.y, 150, c, 0.9);
    });
    s.boomerPool?.forEachActive((b) => this._light(b.x, b.y, 120, 0xff8a3c, 0.8));
    s.enemyProjPool?.forEachActive((b) => this._light(b.x, b.y, 95, 0xff3050, 0.8));
    for (const w of p?.weapons ?? []) {
      if (w.orbs) for (const o of w.orbs) this._light(o.spr.x, o.spr.y, 110, 0x5cc8ff, 0.8);
      if (w.gfx && w.range && p) this._light(p.x, p.y, w.range * 1.5, 0x3a8ac8, 0.35); // aura gélida
    }
    for (const c of s.chests ?? []) if (!c.opened) this._light(c.x, c.y, 110, 0xf2c14e, 0.55);
    s.awakenOrbPool?.forEachActive((o) => this._light(o.x, o.y, 80, 0xffd070, 0.8));
    s.heartPool?.forEachActive((h) => this._light(h.x, h.y, 60, 0xff5060, 0.6));
    s.lanterns?.lights((x, y, r, c, a) => this._light(x, y, r, c, a));
    // Brilho fraco da corrupção em cada inimigo: legibilidade no escuro
    s.enemyPool?.forEachActive((e) => {
      if (e.active) this._light(e.x, e.y - e.displayHeight * 0.15, e.miniBoss ? 150 : 58, e.miniBoss ? 0xf2c14e : 0xb0308a, e.miniBoss ? 0.6 : 0.4);
    });
    let gems = 0;
    s.xpPool?.forEachActive((g) => {
      if (gems++ < 16) this._light(g.x, g.y, 46, 0x7fe07a, 0.5);
    });
    for (const f of this.world?.ambient ?? []) if (f.kind === "ff") this._light(f.x, f.y, 44, 0xfff2b0, f.core.alpha * 0.8);

    // Ambiente + todas as luzes numa ÚNICA passada no mapa de luz.
    // (Antes: 1 draw por luz = ~100 trocas de framebuffer/frame → travava celular.)
    const tRun = Math.min(1, s.elapsedMs / (s.runDurationS * 1000));
    const amb = s.boss?.active ? mix(AMB_NIGHT, AMB_BOSS, 1) : mix(AMB_DUSK, AMB_NIGHT, Math.pow(tRun, 1.3));
    this.rt.fill(amb);
    if (this._n) this.rt.draw(this.stamps.slice(0, this._n));
  }

  // Sombras projetadas pelas árvores a partir da luz do herói
  _treeShadows(p) {
    let used = 0;
    if (p?.active && this.world) {
      const R = 460;
      for (const t of this.world.trees) {
        if (!t.visible) continue;
        const dx = t.x - p.x,
          dy = t.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > R || d < 20) continue;
        let sh = this.shadowPool[used];
        if (!sh) {
          sh = this.scene.add.image(0, 0, "fx_castshadow").setOrigin(0, 0.5).setDepth(D_TREE_SHADOW);
          this.shadowPool.push(sh);
        }
        used++;
        const k = 1 - d / R;
        const len = t.displayWidth * (0.8 + 2.2 * (1 - k)); // mais longe = sombra mais comprida
        sh.setVisible(true)
          .setPosition(t.x, t.y - 4)
          .setRotation(Math.atan2(dy, dx))
          .setScale(len / 128, (t.displayWidth * 0.45) / 32)
          .setAlpha(0.15 + k * 0.45);
      }
    }
    for (let i = used; i < this.shadowPool.length; i++) this.shadowPool[i].setVisible(false);
  }
}
