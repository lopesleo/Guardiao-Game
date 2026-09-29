// Kit de UI pixel-art: UMA fonte, molduras chanfradas, botões com estado,
// barras segmentadas e ícones. Todas as telas usam só isto — é o que dá cara
// de produto em vez de "caixas do Phaser".
import { PAL, CSS, hex } from "../art/Palette.js";

export const FONT = '"Pixelify Sans", monospace';
export const P = 3; // 1 "pixel de arte" na UI = 3px de tela (mesma escala dos sprites)

// Largura/altura visível (modo EXPAND: a largura varia com o aparelho)
export const vw = (scene) => scene.scale.width;
export const vh = (scene) => scene.scale.height;

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------
export function text(scene, x, y, str, o = {}) {
  const style = {
    fontFamily: FONT,
    fontSize: `${o.size ?? 18}px`,
    fontStyle: o.bold === false ? "normal" : "bold",
    color: o.color ?? CSS.txt,
    align: o.align ?? "left",
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.lineSpacing != null) style.lineSpacing = o.lineSpacing;
  if (o.stroke !== false && (o.stroke || o.size >= 28)) {
    style.stroke = o.stroke === true || !o.stroke ? CSS.ink : o.stroke;
    style.strokeThickness = o.strokeW ?? Math.max(3, Math.round((o.size ?? 18) / 6));
  }
  const t = scene.add.text(Math.round(x), Math.round(y), str, style).setResolution(2);
  if (o.shadow !== false) t.setShadow(0, o.shadowY ?? Math.max(2, Math.round((o.size ?? 18) / 10)), CSS.ink, 0, true, true);
  if (o.origin != null) Array.isArray(o.origin) ? t.setOrigin(o.origin[0], o.origin[1]) : t.setOrigin(o.origin);
  return t;
}

// ---------------------------------------------------------------------------
// Molduras (Graphics) — cantos chanfrados, borda dupla, luz em cima/sombra embaixo
// ---------------------------------------------------------------------------
export const STYLES = {
  dark: { border: PAL.uiGoldLo, body: PAL.uiPanel, hi: PAL.uiPanel2, lo: PAL.uiLine },
  gold: { border: PAL.uiGold, body: PAL.uiPanel, hi: PAL.uiPanel2, lo: PAL.uiLine, rivet: PAL.uiGoldHi },
  primary: { border: PAL.uiGoldHi, body: 0x2c5a2e, hi: 0x3f7a3a, lo: 0x1b3a1f, rivet: PAL.white },
  button: { border: PAL.uiGold, body: 0x1f3329, hi: 0x2b463a, lo: 0x0d1a14 },
  danger: { border: PAL.red2, body: 0x3a1418, hi: 0x55202a, lo: 0x1e0a0d },
  ice: { border: PAL.ice2, body: 0x15283a, hi: 0x1f3d57, lo: 0x0a1520 },
  purple: { border: PAL.pur2, body: 0x2a1a3e, hi: 0x3d2758, lo: 0x140c20, rivet: PAL.pur3 },
  green: { border: PAL.g5, body: 0x173022, hi: 0x224530, lo: 0x0b1a10 },
  disabled: { border: 0x3a4640, body: 0x141c19, hi: 0x19231f, lo: 0x0b100e },
  glass: { border: PAL.uiGoldLo, body: PAL.uiBg, hi: PAL.uiPanel, lo: PAL.uiLine, alpha: 0.82 },
};

export function drawFrame(g, x, y, w, h, style = "dark", opts = {}) {
  const s = typeof style === "string" ? STYLES[style] : style;
  const a = opts.alpha ?? s.alpha ?? 1;
  const p = opts.p ?? P;
  w = Math.round(w / p) * p;
  h = Math.round(h / p) * p;
  x = Math.round(x);
  y = Math.round(y);
  // Contorno tinta (chanfro de 1 pixel de arte)
  g.fillStyle(PAL.ink, Math.min(1, a + 0.1));
  g.fillRect(x + p, y, w - 2 * p, h);
  g.fillRect(x, y + p, w, h - 2 * p);
  // Borda colorida
  g.fillStyle(s.border, 1 * Math.max(a, 0.9));
  g.fillRect(x + 2 * p, y + p, w - 4 * p, h - 2 * p);
  g.fillRect(x + p, y + 2 * p, w - 2 * p, h - 4 * p);
  // Corpo
  g.fillStyle(s.body, a);
  g.fillRect(x + 2 * p, y + 2 * p, w - 4 * p, h - 4 * p);
  if (!opts.flat) {
    g.fillStyle(s.hi, a);
    g.fillRect(x + 2 * p, y + 2 * p, w - 4 * p, p);
    g.fillStyle(s.lo, a);
    g.fillRect(x + 2 * p, y + h - 3 * p, w - 4 * p, p);
  }
  if (s.rivet && !opts.noRivets && w > 12 * p && h > 10 * p) {
    g.fillStyle(s.rivet, 1);
    for (const [rx, ry] of [
      [x + 3 * p, y + 3 * p],
      [x + w - 4 * p, y + 3 * p],
      [x + 3 * p, y + h - 4 * p],
      [x + w - 4 * p, y + h - 4 * p],
    ])
      g.fillRect(rx, ry, p, p);
  }
  return g;
}

// Painel como objeto (Graphics) com origem centralizada opcional
export function panel(scene, x, y, w, h, style = "dark", opts = {}) {
  const g = scene.add.graphics();
  const ox = opts.center ? -w / 2 : 0,
    oy = opts.center ? -h / 2 : 0;
  drawFrame(g, ox, oy, w, h, style, opts);
  g.setPosition(Math.round(x), Math.round(y));
  return g;
}

// Escurecedor de fundo (modais)
export function dim(scene, alpha = 0.72, depth = 0) {
  return scene.add
    .rectangle(0, 0, vw(scene), vh(scene), PAL.ink, alpha)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(depth)
    .setInteractive();
}

export function icon(scene, x, y, key, scale = 3) {
  return scene.add.image(Math.round(x), Math.round(y), key).setScale(scale);
}

// ---------------------------------------------------------------------------
// Botão: moldura + rótulo (+ícone). Estados: hover, pressionado, desabilitado.
// Dispara no pointerUP dentro do botão (padrão mobile: arrastar pra fora cancela).
// ---------------------------------------------------------------------------
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, label, onClick, o = {}) {
    super(scene, Math.round(x), Math.round(y));
    scene.add.existing(this);
    this.w = w;
    this.h = h;
    this.onClick = onClick;
    this.baseStyle = o.style ?? "button";
    this.enabled = o.enabled !== false;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.content = scene.add.container(0, 0);
    this.add(this.content);

    const size = o.size ?? Math.min(24, Math.round(h * 0.4));
    let lx = 0;
    if (o.icon) {
      const iw = scene.textures.get(o.icon).getSourceImage().width * (o.iconScale ?? 3);
      const tw = label ? measure(scene, label, size) : 0;
      const gap = label ? 10 : 0;
      const total = iw + gap + tw;
      this.ico = scene.add.image(-total / 2 + iw / 2, 0, o.icon).setScale(o.iconScale ?? 3);
      this.content.add(this.ico);
      lx = -total / 2 + iw + gap + tw / 2;
    }
    if (label != null) {
      this.label = text(scene, lx, -1, label, {
        size,
        color: o.color ?? CSS.txt,
        origin: 0.5,
        align: "center",
      });
      this.content.add(this.label);
    }
    this._draw(false, false);
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this._down = false;
    this.on("pointerover", () => {
      if (!this.enabled) return;
      this._draw(true, this._down);
      scene.sound.play("sfx_ui_hover", { volume: 0.18 });
    });
    this.on("pointerout", () => {
      this._down = false;
      this._draw(false, false);
    });
    this.on("pointerdown", () => {
      if (!this.enabled) return;
      this._down = true;
      this._draw(true, true);
    });
    this.on("pointerup", () => {
      if (!this.enabled || !this._down) return;
      this._down = false;
      this._draw(true, false);
      scene.sound.play("sfx_ui_click", { volume: 0.4 });
      haptic(12);
      this.onClick?.();
    });
    if (!this.enabled) this.setEnabled(false);
  }
  _draw(hover, down) {
    const g = this.g;
    g.clear();
    let st = this.enabled ? this.baseStyle : "disabled";
    const s = { ...(typeof st === "string" ? STYLES[st] : st) };
    if (hover && this.enabled) {
      s.border = PAL.uiGoldHi;
      s.body = s.hi;
    }
    const oy = down ? P : 0;
    drawFrame(g, -this.w / 2, -this.h / 2 + oy, this.w, this.h - oy, s, { flat: down });
    this.content.y = oy / 2;
  }
  setEnabled(on) {
    this.enabled = on;
    this.content.setAlpha(on ? 1 : 0.45);
    this._draw(false, false);
    return this;
  }
  setLabel(str) {
    this.label?.setText(str);
    return this;
  }
}

function measure(scene, str, size) {
  const t = scene.add.text(0, 0, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: "bold" });
  const w = t.width;
  t.destroy();
  return w;
}

// ---------------------------------------------------------------------------
// Barra pixelada (HP, XP, Despertar, Boss) — contorno, fundo, preenchimento
// com faixa de brilho e "fantasma" de dano que escorre.
// ---------------------------------------------------------------------------
export class Bar {
  constructor(scene, x, y, w, h, color, o = {}) {
    this.scene = scene;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.w = w;
    this.h = h;
    this.color = color;
    this.ghostColor = o.ghost ?? PAL.cream;
    this.value = 1;
    this.ghost = 1;
    this.segments = o.segments ?? 0;
    this.g = scene.add.graphics().setScrollFactor(0);
    if (o.depth != null) this.g.setDepth(o.depth);
    this._draw();
  }
  set(v, instant = false) {
    v = Phaser.Math.Clamp(v, 0, 1);
    if (v > this.value || instant) this.ghost = v;
    this.value = v;
    this._draw();
  }
  tick(dt) {
    if (this.ghost > this.value) {
      this.ghost = Math.max(this.value, this.ghost - dt * 0.0006);
      this._draw();
    }
  }
  setColor(c) {
    if (c !== this.color) {
      this.color = c;
      this._draw();
    }
  }
  setVisible(v) {
    this.g.setVisible(v);
    return this;
  }
  _draw() {
    const { g, x, y, w, h } = this;
    const p = P;
    g.clear();
    g.fillStyle(PAL.ink, 1);
    g.fillRect(x + p, y, w - 2 * p, h);
    g.fillRect(x, y + p, w, h - 2 * p);
    g.fillStyle(0x0b100e, 1);
    g.fillRect(x + p, y + p, w - 2 * p, h - 2 * p);
    const iw = w - 2 * p;
    const gw = Math.round((iw * this.ghost) / p) * p;
    const fw = Math.round((iw * this.value) / p) * p;
    if (gw > fw) {
      g.fillStyle(this.ghostColor, 0.85);
      g.fillRect(x + p, y + p, gw, h - 2 * p);
    }
    if (fw > 0) {
      g.fillStyle(this.color, 1);
      g.fillRect(x + p, y + p, fw, h - 2 * p);
      g.fillStyle(0xffffff, 0.28);
      g.fillRect(x + p, y + p, fw, p);
      g.fillStyle(0x000000, 0.22);
      g.fillRect(x + p, y + h - 2 * p, fw, p);
    }
    if (this.segments > 1) {
      g.fillStyle(PAL.ink, 0.55);
      for (let i = 1; i < this.segments; i++) {
        const sx = x + p + Math.round((iw * i) / this.segments / p) * p;
        g.fillRect(sx, y + p, p, h - 2 * p);
      }
    }
  }
  destroy() {
    this.g.destroy();
  }
}

// Vibração curta (Android). Respeita a opção do jogador.
export function haptic(ms = 20) {
  try {
    if (localStorage.getItem("guardiao_haptics") === "0") return;
    navigator.vibrate?.(ms);
  } catch {}
}

export { PAL, CSS, hex };
