// Componentes compostos do kit de UI: Modal, ScrollList (arrastar pra rolar,
// estilo celular), Slider, Toggle. Tudo desenhado com drawFrame/Theme.
import { PAL, CSS } from "../art/Palette.js";
import { text, drawFrame, dim, Button, P, vw, vh, haptic } from "./Theme.js";

const D_MODAL = 70000;

// ---------------------------------------------------------------------------
// MODAL — escurece o fundo, painel central com título e botão fechar.
// Registra-se na cena pro botão VOLTAR do Android fechar o modal do topo.
// ---------------------------------------------------------------------------
export class Modal {
  constructor(scene, o = {}) {
    this.scene = scene;
    const W = vw(scene),
      H = vh(scene);
    this.w = Math.min(o.w ?? 760, W - 40);
    this.h = Math.min(o.h ?? 560, H - 30);
    this.onClose = o.onClose;
    const depth = D_MODAL + (scene._modals?.length ?? 0) * 10;
    this.bg = dim(scene, 0.75, depth);
    this.root = scene.add.container(W / 2, H / 2).setDepth(depth + 1).setScrollFactor(0);
    const g = scene.add.graphics();
    drawFrame(g, -this.w / 2, -this.h / 2, this.w, this.h, o.style ?? "gold");
    this.root.add(g);
    // Faixa do título
    this.titleText = text(scene, 0, -this.h / 2 + 34, o.title ?? "", { size: 30, color: CSS.goldHi, origin: 0.5, stroke: true });
    this.root.add(this.titleText);
    if (o.subtitle) this.root.add(text(scene, 0, -this.h / 2 + 64, o.subtitle, { size: 16, color: CSS.muted, origin: 0.5 }));
    // Fechar (X) no canto
    if (o.closable !== false) {
      const close = new Button(scene, this.w / 2 - 34, -this.h / 2 + 34, 44, 44, null, () => this.close(), { icon: "ico_close", style: "dark" });
      this.root.add(close);
    }
    // Área de conteúdo (coordenadas locais ao root)
    this.top = -this.h / 2 + (o.subtitle ? 88 : 70);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);

    fixed(this.root);
    scene._modals = scene._modals || [];
    scene._modals.push(this);
    // Entrada
    this.root.setScale(0.9).setAlpha(0);
    scene.tweens.add({ targets: this.root, scale: 1, alpha: 1, duration: 160, ease: "Back.easeOut" });
    scene.sound.play("sfx_ui_click", { volume: 0.3, rate: 1.2 });
  }
  add(obj) {
    this.body.add(obj);
    fixed(obj);
    return obj;
  }
  close() {
    if (this._closed) return;
    this._closed = true;
    const s = this.scene;
    s._modals = (s._modals || []).filter((m) => m !== this);
    this.list?.destroy();
    this.bg.destroy();
    this.root.destroy();
    this.onClose?.();
  }
}

// scrollFactor 0 em tudo dentro do modal. O Phaser testa o toque com o
// scrollFactor do PRÓPRIO objeto (não o do container pai): sem isto, na Clareira
// (câmera seguindo o herói) os botões do painel não respondiam ao toque.
function fixed(obj) {
  obj.setScrollFactor?.(0);
  if (obj.list) for (const c of obj.list) fixed(c);
}

// Fecha o modal do topo (VOLTAR/ESC). true se fechou algum.
export function closeTopModal(scene) {
  const m = scene._modals?.[scene._modals.length - 1];
  if (!m) return false;
  m.close();
  return true;
}

// ---------------------------------------------------------------------------
// SCROLLLIST — janela com máscara; arrastar (toque) ou roda do mouse rola.
// Toque SEM arrasto aciona row.onTap (hit-test manual: objetos mascarados do
// Phaser ainda recebem input fora da janela, então não usamos interactive neles).
// ---------------------------------------------------------------------------
export class ScrollList {
  // x,y = canto superior-esquerdo EM COORDENADAS DE MUNDO/TELA (scrollFactor 0)
  constructor(scene, x, y, w, h, depth = D_MODAL + 5) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.rows = [];
    this.scroll = 0;
    this.contentH = 0;
    // Tudo fixo na tela (scrollFactor 0): funciona também em cenas com câmera
    // que segue o jogador (a Clareira)
    this.content = scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
    const maskG = scene.make.graphics({ add: false }).setScrollFactor(0);
    maskG.fillStyle(0xffffff).fillRect(x, y, w, h);
    this.content.setMask(maskG.createGeometryMask());
    this._maskG = maskG;
    // Barra de rolagem
    this.bar = scene.add.graphics().setDepth(depth + 1).setScrollFactor(0);

    this.zone = scene.add.zone(x, y, w, h).setOrigin(0).setDepth(depth + 2).setScrollFactor(0).setInteractive();
    let startY = 0,
      startScroll = 0,
      dragged = false,
      down = false,
      lastY = 0,
      vel = 0;
    this.zone.on("pointerdown", (p) => {
      down = true;
      dragged = false;
      startY = lastY = p.y;
      startScroll = this.scroll;
      vel = 0;
      this._hover(p);
    });
    this.zone.on("pointermove", (p) => {
      if (!down) return this._hover(p);
      if (Math.abs(p.y - startY) > 8) dragged = true;
      if (dragged) {
        vel = p.y - lastY;
        lastY = p.y;
        this.setScroll(startScroll - (p.y - startY));
      }
    });
    const up = (p) => {
      if (!down) return;
      down = false;
      if (!dragged) this._tap(p);
      else this._fling = vel * 1.2;
    };
    this.zone.on("pointerup", up);
    this.zone.on("pointerout", () => {
      if (down && dragged) this._fling = vel;
      down = false;
      this._hoverRow?.hover?.(false);
      this._hoverRow = null;
    });
    this.zone.on("wheel", (p, dx, dy) => this.setScroll(this.scroll + dy * 0.6));
    this._tick = () => {
      if (Math.abs(this._fling || 0) > 0.3) {
        this.setScroll(this.scroll - this._fling);
        this._fling *= 0.92;
      }
    };
    scene.events.on("update", this._tick);
  }

  // row: { h, build(container, w), onTap?, hover?(on) }
  addRow(row) {
    const c = this.scene.add.container(0, this.contentH);
    row.build(c, this.w);
    row.c = c;
    row.y0 = this.contentH;
    this.content.add(c);
    this.rows.push(row);
    this.contentH += row.h + (row.gap ?? 8);
    this._drawBar();
    return row;
  }

  setScroll(v) {
    const max = Math.max(0, this.contentH - this.h);
    this.scroll = Phaser.Math.Clamp(v, 0, max);
    this.content.y = Math.round(this.y - this.scroll);
    this._drawBar();
  }

  _rowAt(p) {
    const ly = p.y - this.y + this.scroll;
    return this.rows.find((r) => ly >= r.y0 && ly < r.y0 + r.h);
  }
  _tap(p) {
    const r = this._rowAt(p);
    if (r?.onTap) {
      haptic(10);
      r.onTap(p.x - this.x, p.y - this.y + this.scroll - r.y0);
    }
  }
  _hover(p) {
    const r = this._rowAt(p);
    if (r === this._hoverRow) return;
    this._hoverRow?.hover?.(false);
    this._hoverRow = r;
    r?.hover?.(true);
  }

  _drawBar() {
    const g = this.bar;
    g.clear();
    if (this.contentH <= this.h) return;
    const trackX = this.x + this.w + 8;
    g.fillStyle(PAL.ink, 0.8).fillRect(trackX, this.y, 6, this.h);
    const hh = Math.max(30, (this.h * this.h) / this.contentH);
    const t = this.scroll / (this.contentH - this.h);
    g.fillStyle(PAL.uiGold, 1).fillRect(trackX, this.y + t * (this.h - hh), 6, hh);
  }

  destroy() {
    this.scene.events.off("update", this._tick);
    this.content.destroy();
    this.bar.destroy();
    this.zone.destroy();
    this._maskG.destroy();
  }
}

// ---------------------------------------------------------------------------
// SLIDER — trilho pixelado + pegador; arrastar em qualquer ponto do trilho
// ---------------------------------------------------------------------------
export class Slider extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, value, onChange) {
    super(scene, x, y);
    scene.add.existing(this);
    this.w = w;
    this.value = value;
    this.onChange = onChange;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.setSize(w + 30, 44);
    this.setInteractive({ useHandCursor: true, draggable: false });
    const set = (p) => {
      const lx = p.x - this.getWorldTransformMatrix().tx;
      this.value = Phaser.Math.Clamp((lx + w / 2) / w, 0, 1);
      this._draw();
      this.onChange?.(this.value);
    };
    this.on("pointerdown", (p) => {
      this._down = true;
      set(p);
    });
    this.on("pointermove", (p) => this._down && p.isDown && set(p));
    this.on("pointerup", () => (this._down = false));
    this.on("pointerout", () => (this._down = false));
    this._draw();
  }
  _draw() {
    const g = this.g,
      w = this.w;
    g.clear();
    g.fillStyle(PAL.ink, 1).fillRect(-w / 2, -6, w, 12);
    g.fillStyle(0x0b100e, 1).fillRect(-w / 2 + 3, -3, w - 6, 6);
    g.fillStyle(PAL.yel2, 1).fillRect(-w / 2 + 3, -3, (w - 6) * this.value, 6);
    const hx = -w / 2 + w * this.value;
    drawFrame(g, hx - 12, -15, 24, 30, "gold", { noRivets: true });
  }
}

// ---------------------------------------------------------------------------
// TOGGLE — interruptor liga/desliga
// ---------------------------------------------------------------------------
export class Toggle extends Phaser.GameObjects.Container {
  constructor(scene, x, y, on, onChange) {
    super(scene, x, y);
    scene.add.existing(this);
    this.on_ = on;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.lbl = text(scene, 0, -1, "", { size: 14, origin: 0.5, shadow: false });
    this.add(this.lbl);
    this.setSize(84, 40);
    this.setInteractive({ useHandCursor: true });
    this.on("pointerup", () => {
      this.on_ = !this.on_;
      scene.sound.play("sfx_ui_click", { volume: 0.4 });
      haptic(12);
      this._draw();
      onChange?.(this.on_);
    });
    this._draw();
  }
  _draw() {
    const g = this.g;
    g.clear();
    drawFrame(g, -42, -18, 84, 36, this.on_ ? "green" : "disabled", { noRivets: true });
    const kx = this.on_ ? 12 : -36;
    drawFrame(g, kx, -12, 24, 24, this.on_ ? "gold" : "dark", { noRivets: true });
    this.lbl.setText(this.on_ ? "SIM" : "NÃO").setX(this.on_ ? -14 : 12).setColor(this.on_ ? CSS.green : CSS.dim);
  }
}
