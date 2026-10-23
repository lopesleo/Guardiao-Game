// Kit de UI pixel-art: UMA fonte, molduras chanfradas, botões com estado,
// barras segmentadas e ícones. Todas as telas usam só isto — é o que dá cara
// de produto em vez de "caixas do Phaser".
import { PAL, CSS, hex } from "../art/Palette.js";
import { Settings } from "../systems/Settings.js";
import { tr, lang, isCJK, cjkWrap } from "../i18n/i18n.js";

// Fontes selecionáveis (acessibilidade). `k` compensa o tamanho aparente: a
// Jersey 15 é condensada e "pequena", a Atkinson (feita para baixa visão) é larga.
// Japonês e chinês: Fusion Pixel 12px (OFL; recortada só com os caracteres do jogo,
// ver tools/font-subset.py) nas duas opções; a "Legível" só fica maior.
const CJK = {
  ja: '"Fusion Pixel JA", "Jersey 15", monospace',
  zh: '"Fusion Pixel ZH", "Jersey 15", monospace',
  zht: '"Fusion Pixel ZHT", "Jersey 15", monospace',
};
const CJK_K = 1;
// Nomes dos idiomas (日本語, 简体中文, 繁體中文) em qualquer idioma: recorte mínimo da Fusion Pixel
export const LANG_FONT = '"Jersey 15", "Fusion Pixel Langs", monospace';
export const FONTS = {
  pixel: { label: tr("Pixel"), family: isCJK ? CJK[lang] : '"Jersey 15", monospace', k: isCJK ? CJK_K : 1, style: "normal" },
  legible: { label: tr("Legível"), family: isCJK ? CJK[lang] : '"Atkinson Hyperlegible", sans-serif', k: isCJK ? CJK_K * 1.15 : 0.85, style: isCJK ? "normal" : "bold" },
};
export const TEXT_SIZES = [
  { label: tr("Normal"), k: 1 },
  { label: tr("Grande"), k: 1.2 },
  { label: tr("Muito grande"), k: 1.4 },
];
export const MIN_TEXT = 16; // piso de leitura na escala da Jersey (antes havia 14 px)
const MIN_PX = 14; // …e piso absoluto na tela, qualquer fonte/tamanho
const curFont = () => FONTS[Settings.get("font")] ?? FONTS.pixel;
export const fontFamily = () => curFont().family;
export const fontStyle = () => curFont().style;
export const P = 3; // 1 "pixel de arte" na UI = 3px de tela (mesma escala dos sprites)

// Largura/altura visível (modo EXPAND: a largura varia com o aparelho)
// No modo EXPAND o Phaser mantém scale.width no tamanho de config (1280) e
// põe o tamanho real expandido em baseSize.
export const vw = (scene) => Math.round(scene.scale.baseSize.width);
export const vh = (scene) => Math.round(scene.scale.baseSize.height);

// Câmera principal no tamanho REAL (EXPAND): o Phaser cria a câmera com o
// tamanho de config, e cenas reiniciadas não recebem o resize de novo.
export function fitCamera(scene) {
  const cam = scene.cameras.main;
  cam.setSize(vw(scene), vh(scene));
  const onResize = () => cam.setSize(vw(scene), vh(scene));
  scene.scale.on("resize", onResize);
  scene.events.once("shutdown", () => scene.scale.off("resize", onResize));
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------
// Celular em paisagem tem ~400px CSS de altura pra 720 lógicos: texto pequeno
// fica ilegível. Amplia só os tamanhos pequenos (títulos já são grandes).
const SMALL_SCREEN = Math.min(window.innerWidth, window.innerHeight) < 560;
const fitSize = (s) => (SMALL_SCREEN && s <= 24 ? Math.round(s * (s <= 16 ? 1.3 : 1.18)) : s);

// Tamanho final na tela: piso de leitura, ajuste da fonte e tamanho escolhido.
// Títulos (>26) só recebem metade do aumento para não estourar as molduras.
export function textPx(size) {
  const base = Math.max(MIN_TEXT, fitSize(size));
  const k = curFont().k * (TEXT_SIZES[Settings.get("textSize")]?.k ?? 1);
  const px = Math.max(MIN_PX, Math.round(base * (size > 26 ? 1 + (k - 1) * 0.5 : k)));
  // Fusion Pixel tem grade de 12 px: com o texto em resolução 2, múltiplos de 6 dão pixel
  // inteiro por ponto da fonte (fora disso uns traços engrossam e outros somem)
  return isCJK ? Math.max(12, Math.round(px / 6) * 6) : px;
}

export function text(scene, x, y, str, o = {}) {
  const style = {
    fontFamily: o.family ?? fontFamily(),
    fontSize: `${textPx(o.size ?? 18)}px`,
    fontStyle: fontStyle(), // pixel: peso único (negrito sintético borra); Atkinson já é Bold
    color: o.color ?? CSS.txt,
    align: o.align ?? "left",
  };
  // japonês/chinês não têm espaços: quebra por caractere
  if (o.wrap) style.wordWrap = isCJK ? { width: o.wrap, callback: cjkWrap } : { width: o.wrap, useAdvancedWrap: true };
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

// Texto que muda a cada quadro (HUD, setas): só mexe no que mudou. O setText do Phaser já
// ignora o mesmo texto, mas o setColor SEMPRE redesenha o canvas e reenvia a textura à GPU.
export function setLabel(t, str, color) {
  t.setText(str);
  if (color != null && t.style.color !== color) t.setColor(color);
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
    // NÃO usar "this.w": Transform.setPosition(x, y) zera o "w" do Phaser e o botão reposicionado
    // (linhas das Opções) virava um traço ao ser tocado
    this.bw = w;
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
        family: o.family,
        color: o.color ?? CSS.txt,
        origin: 0.5,
        align: "center",
      });
      this.content.add(this.label);
      this._fitLabel();
    }
    this._draw(false, false);
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this._down = false;
    this.on("pointerover", (p) => {
      if (!this.enabled) return;
      this._draw(true, this._down);
      if (!fromTouch(p)) uiSfx(scene, "sfx_ui_hover", { volume: 0.18 });
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
      uiSfx(scene, "sfx_ui_click", { volume: 0.4 });
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
    drawFrame(g, -this.bw / 2, -this.h / 2 + oy, this.bw, this.h - oy, s, { flat: down });
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
    this._fitLabel();
    return this;
  }
  // Rótulo nunca vaza da moldura: com a fonte Legível ou texto grande, encolhe para caber
  _fitLabel() {
    const t = this.label;
    if (!t) return;
    t.setScale(1);
    const room = this.bw - 8 * P;
    if (!this.ico) {
      if (t.width > room) t.setScale(room / t.width);
      return;
    }
    // com ícone, o conjunto (ícone + espaço + rótulo) é que cabe: o rótulo encolhe e os dois voltam ao centro
    // (também quando o rótulo muda depois, pelo setLabel)
    const iw = this.ico.displayWidth,
      gap = 10;
    if (iw + gap + t.width > room) t.setScale(Math.max(0.5, (room - iw - gap) / t.width));
    const total = iw + gap + t.displayWidth;
    this.ico.x = -total / 2 + iw / 2;
    t.x = -total / 2 + iw + gap + t.displayWidth / 2;
  }
}

function measure(scene, str, size) {
  const t = scene.add.text(0, 0, str, { fontFamily: fontFamily(), fontStyle: fontStyle(), fontSize: `${textPx(size)}px` });
  const w = t.width;
  t.destroy();
  return w;
}

// ---------------------------------------------------------------------------
// Barra pixelada (HP, XP, Despertar, Boss) — contorno, fundo, preenchimento
// com faixa de brilho e "fantasma" de dano que escorre.
// ---------------------------------------------------------------------------
export class Bar {
  // o.gain: cor do que ACABOU de entrar (a barra "enche": o trecho novo aparece claro e assenta na cor da
  // barra em o.fillMs). o.shine: daí para cima um brilho corre pela barra (quase cheia)
  constructor(scene, x, y, w, h, color, o = {}) {
    this.scene = scene;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.w = w;
    this.h = h;
    this.color = color;
    this.ghostColor = o.ghost ?? PAL.cream;
    this.ghostRate = 0.0006; // fração da barra por ms que o fantasma de dano escorre
    this.value = 1;
    this.ghost = 1;
    this.gainColor = o.gain ?? null;
    this.lag = 1; // até onde o que entrou já assentou (≤ value)
    this.fillTau = (o.fillMs ?? 240) / 3;
    this.shine = o.shine ?? null;
    this._shineT = 0;
    this.full = null; // cor da barra cheia em destaque (nível novo), ou null
    this.segments = o.segments ?? 0;
    this.g = scene.add.graphics().setScrollFactor(0);
    if (o.depth != null) this.g.setDepth(o.depth);
    this._draw();
  }
  set(v, instant = false) {
    v = Phaser.Math.Clamp(v, 0, 1);
    if (v > this.value || instant) this.ghost = v;
    if (instant || v < this.lag) this.lag = v;
    this.value = v;
    this._draw();
  }
  tick(dt) {
    if (this.ghost > this.value) {
      this.ghost = Math.max(this.value, this.ghost - dt * this.ghostRate);
      this._draw();
    }
    if (this.gainColor != null && this.lag < this.value) {
      this.lag += (this.value - this.lag) * (1 - Math.exp(-dt / this.fillTau));
      if (this.value - this.lag < 0.004) this.lag = this.value;
      this._draw();
    }
    if (this.shine != null && this.value >= this.shine && !this.full) {
      this._shineT += dt;
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
  // Lido pela HUD (topBand, nome do golpe do chefe); antes não existia e dava sempre undefined
  get visible() {
    return this.g.visible;
  }
  _draw() {
    const { g, x, y, w, h } = this;
    const p = P;
    const iw = w - 2 * p;
    const gw = Math.round((iw * this.ghost) / p) * p;
    const fw = this.full != null ? iw : Math.round((iw * this.value) / p) * p;
    const lw = this.gainColor != null && this.full == null ? Math.min(fw, Math.round((iw * this.lag) / p) * p) : fw;
    // brilho que corre pela barra quase cheia: faixa de 2 px de arte, uma volta a cada 0,9 s
    const sx = this.shine != null && this.value >= this.shine && this.full == null ? Math.round((((this._shineT % 900) / 900) * (fw + 8 * p) - 4 * p) / p) * p : null;
    // A HUD chama set() todo quadro: só refaz o desenho quando algum pixel muda
    if (gw === this._gw && fw === this._fw && lw === this._lw && sx === this._sx && this.color === this._c && this.full === this._full && this.ghostColor === this._gc) return;
    this._gw = gw;
    this._fw = fw;
    this._lw = lw;
    this._sx = sx;
    this._c = this.color;
    this._full = this.full;
    this._gc = this.ghostColor;
    g.clear();
    g.fillStyle(PAL.ink, 1);
    g.fillRect(x + p, y, w - 2 * p, h);
    g.fillRect(x, y + p, w, h - 2 * p);
    g.fillStyle(0x0b100e, 1);
    g.fillRect(x + p, y + p, w - 2 * p, h - 2 * p);
    if (gw > fw) {
      g.fillStyle(this.ghostColor, 0.85);
      g.fillRect(x + p, y + p, gw, h - 2 * p);
    }
    if (fw > 0) {
      g.fillStyle(this.full ?? this.color, 1);
      g.fillRect(x + p, y + p, lw, h - 2 * p);
      if (fw > lw) {
        // o que acabou de entrar: claro, e assenta na cor da barra
        g.fillStyle(this.gainColor, 1);
        g.fillRect(x + p + lw, y + p, fw - lw, h - 2 * p);
      }
      if (sx != null) {
        const a = Math.max(0, sx),
          b = Math.min(fw, sx + 2 * p);
        if (b > a) {
          g.fillStyle(0xffffff, 0.45);
          g.fillRect(x + p + a, y + p, b - a, h - 2 * p);
        }
      }
      g.fillStyle(0xffffff, this.full != null ? 0.55 : 0.28);
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

// Som da interface sem eco: o mesmo som pedido de novo em menos de UI_SFX_GAP ms toca uma vez só. Um toque
// num botão que abre uma janela pedia o clique duas ou três vezes (o botão, a janela, o Guarda-roupa)
const UI_SFX_GAP = 120;
const uiSfxAt = new Map();
export function uiSfx(scene, key, cfg) {
  const now = performance.now();
  if (now - (uiSfxAt.get(key) ?? -Infinity) < UI_SFX_GAP) return;
  uiSfxAt.set(key, now);
  scene.sound.play(key, cfg);
}

// O "passar por cima" que vem de um toque (no celular o pointerover chega junto com o toque): sem o som de
// hover, senão ele sai colado no clique
export const fromTouch = (p) => !!(p?.wasTouch || p?.event?.pointerType === "touch" || p?.event?.type?.startsWith?.("touch"));

// Vibração curta (Android). Respeita a opção do jogador.
export function haptic(ms = 20) {
  try {
    if (localStorage.getItem("guardiao_haptics") === "0") return;
    // No app: vibrador nativo (o navigator.vibrate do WebView é ignorado em vários aparelhos)
    const native = window.Capacitor?.Plugins?.Haptics;
    if (native?.vibrate) {
      native.vibrate({ duration: ms }).catch?.(() => {});
      return;
    }
    navigator.vibrate?.(ms);
  } catch {}
}

export { PAL, CSS, hex };
