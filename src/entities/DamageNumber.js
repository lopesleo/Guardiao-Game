import { fontFamily, fontStyle } from '../ui/Theme.js';
import { PERF } from '../config.js';

const STROKE = '#1a1420';
const styleOf = (color, big) => ({
  resolution: 2,
  fontFamily: fontFamily(), fontStyle: fontStyle(),
  fontSize: big ? '24px' : '16px', color,
  stroke: STROKE, strokeThickness: big ? 5 : 4,
});

// Damage number flutuante reutilizável. Cada objeto nasce num estilo (cor × normal/crítico) e é
// reaproveitado nele: ao mostrar, só o texto muda (1 redesenho do canvas). Antes um pool único
// trocava cor, fonte e contorno a cada número (3–4 redesenhos e uma medida da fonte); numa matança
// eram até 91 redesenhos num quadro.
export class DamageNumber extends Phaser.GameObjects.Text {
  constructor(scene, pool, color = '#ffffff', big = false) {
    super(scene, -9999, -9999, '', styleOf(color, big));
    scene.add.existing(this);
    this.setOrigin(0.5).setDepth(59000);
    this.setActive(false).setVisible(false);
    this._pool = pool;
    this._tween = null;
    this._color = color;
    this._big = big;
  }
  // Raro: o pool passou do teto e reaproveita um número de outro estilo
  restyle(color, big) {
    if (color !== this._color) this.setColor(color);
    if (big !== this._big) {
      this.setFontSize(big ? 24 : 16);
      this.setStroke(STROKE, big ? 5 : 4);
    }
    this._color = color;
    this._big = big;
  }
  show(x, y, value) {
    const big = this._big;
    this.setText(typeof value === 'string' ? value : String(Math.ceil(value)));
    this.setPosition(x + (Math.random() - 0.5) * 16, y - 10);
    this.setActive(true).setVisible(true);
    this.setAlpha(1).setScale(big ? 1.7 : 1); // crítico nasce grande e encolhe (pop)
    if (this._tween) this._tween.stop();
    this._tween = this.scene.tweens.add({
      targets: this,
      y: this.y - (big ? 44 : 30),
      alpha: 0,
      scale: 0.7,
      duration: big ? 750 : 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.setActive(false).setVisible(false);
        this._pool.release(this);
      },
    });
  }
}

// Pool por estilo. show() no lugar do acquire()+show() de antes.
export class DamageNumberPool {
  constructor(scene) {
    this.scene = scene;
    this.free = new Map(); // estilo → números parados
    this.inUse = new Set();
    this.total = 0;
    for (const [color, big, n] of PERF.DMG_NUMBER_PREWARM) {
      for (let i = 0; i < n; i++) this._free(this._make(color, big));
    }
  }
  _key(color, big) {
    return big ? color + '!' : color;
  }
  _make(color, big) {
    this.total++;
    return new DamageNumber(this.scene, this, color, big);
  }
  _free(n) {
    const k = this._key(n._color, n._big);
    let list = this.free.get(k);
    if (!list) this.free.set(k, (list = []));
    list.push(n);
  }
  show(x, y, value, color = '#ffffff', big = false) {
    let n = this.free.get(this._key(color, big))?.pop();
    if (!n && this.total >= PERF.DMG_NUMBER_CAP) {
      // no teto: pega um parado de outro estilo e troca o estilo dele
      for (const list of this.free.values()) if ((n = list.pop())) break;
      n?.restyle(color, big);
    }
    if (!n) n = this._make(color, big);
    this.inUse.add(n);
    n.show(x, y, value);
    return n;
  }
  release(n) {
    if (!this.inUse.delete(n)) return;
    this._free(n);
  }
  get size() {
    return this.inUse.size;
  }
  get available() {
    return [...this.free.values()].flat();
  }
  forEachActive(fn) {
    for (const n of this.inUse) fn(n);
  }
}
