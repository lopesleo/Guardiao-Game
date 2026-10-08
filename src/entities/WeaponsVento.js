// Armas de VENTO (4º elemento — ver docs/ARMAS_E_COMBOS.md). O Redemoinho (Weapons.js)
// também é de vento. Verbos: onda que empurra (Assobio), espiral cortante (Folhas ao
// Vento), torre plantada (Cata-vento). Evoluções com def.also → reação sozinha.
// Registro: registerWeapon() no fim do arquivo.
import { COLORS, ELEMENT } from "../config.js";
import { PAL } from "../art/Palette.js";
import { Weapon, registerWeapon } from "./Weapons.js";

const D_WFX = 48545;
const CELL = 3;
const snap = (v) => Math.round(v / CELL) * CELL;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

class WindWeapon extends Weapon {
  get area() {
    return Math.sqrt(this.owner?.areaMult ?? 1);
  }
  _scaled(base) {
    return base * this.dmgMult * (this.owner?.dmgMultFor?.(this.def.element) ?? this.owner?._blessingDmgMult ?? 1);
  }
  _closest(from, r, n = 1) {
    const rSq = r * r;
    const list = [];
    this._eachTarget((e) => {
      const d2 = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d2 <= rSq) list.push({ e, d2 });
    });
    list.sort((a, b) => a.d2 - b.d2);
    return list.slice(0, n).map((o) => o.e);
  }
  _push(e, fromX, fromY, px) {
    if (!e.active || e === this.scene.boss || e.miniBoss) return;
    const dx = e.x - fromX,
      dy = e.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * px;
    e.y += (dy / d) * px;
  }
}

// ============================================================================
// ASSOBIO — o assobio das lendas da mata: uma ONDA em cone que corre para longe do
// herói, acerta cada um uma vez, empurra e deixa "ventado".
// ============================================================================
export class Assobio extends WindWeapon {
  constructor(scene, defKey = "ASSOBIO") {
    super(scene, defKey);
    this.waves = [];
    this.g = null;
    this._tint = PAL.wnd2;
  }
  dispose() {
    this.g?.destroy();
    this.waves = [];
  }
  _fire() {
    if (!this.owner) return false;
    const t = this._closest(this.owner, this.range * this.area, 1)[0];
    if (!t) return false;
    const dir = Math.atan2(t.y - this.owner.y, t.x - this.owner.x);
    const n = (this.def.waves ?? 1) + (this.owner?.extraProj ?? 0) + this.extraProj;
    for (let i = 0; i < n; i++) this.scene.time.delayedCall(i * 160, () => this.owner && this._wave(dir + (i % 2 ? 0.25 : -0.25) * (i ? 1 : 0)));
    return true;
  }
  _wave(dir) {
    const o = this.owner;
    this.waves.push({ x: o.x, y: o.y - 8, dir, t0: this.scene.time.now, hit: new Set() });
    this.scene.sound.play("sfx_assobio", { volume: 0.32, rate: 0.95 + Math.random() * 0.15 });
    this.scene.fx?.muzzle(o.x + Math.cos(dir) * 12, o.y - 8 + Math.sin(dir) * 12, dir, "wind");
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.waves.length) {
      this.g?.clear();
      return;
    }
    this.g ??= this.scene.add.graphics().setDepth(D_WFX);
    const g = this.g;
    g.clear();
    const R = this.range * this.area;
    const half = this.def.halfAngle;
    const keep = [];
    for (const w of this.waves) {
      const k = Math.min(1, (time - w.t0) / this.def.travelMs);
      const r = 18 + (R - 18) * k;
      // três arcos concêntricos (o som do assobio) que se apagam no fim
      for (let j = 0; j < 3; j++) {
        const rr = r - j * 10;
        if (rr < 10) continue;
        const a0 = w.dir - half * (1 - j * 0.15),
          a1 = w.dir + half * (1 - j * 0.15);
        const nPts = Math.max(6, Math.round(((a1 - a0) * rr) / CELL));
        g.fillStyle(j === 0 ? 0xffffff : j === 1 ? PAL.wnd3 : this._tint, (1 - k * 0.8) * (j === 0 ? 1 : 0.8));
        for (let i = 0; i <= nPts; i++) {
          const a = a0 + ((a1 - a0) * i) / nPts;
          g.fillRect(snap(w.x + Math.cos(a) * rr) - 1, snap(w.y + Math.sin(a) * rr * 0.85) - 1, CELL, CELL);
        }
      }
      // quem a frente da onda alcança: dano, vento e empurrão
      const dmg = this.damage;
      this._eachTarget((e) => {
        if (w.hit.has(e)) return;
        const dx = e.x - w.x,
          dy = (e.y - w.y) / 0.85;
        const d = Math.hypot(dx, dy);
        if (d > r + 10 || d < r - 34) return;
        if (Math.abs(angDiff(Math.atan2(dy, dx), w.dir)) > half + 0.12) return;
        w.hit.add(e);
        const died = this._hit(e, dmg, ELEMENT.WIND, w.x, w.y, false);
        if (!died) this._push(e, w.x, w.y, this.def.push);
        if (w.hit.size <= 6) this.scene.fx?.impact(e.x, e.y - 6, "wind", { power: 0.5, dir: w.dir });
      });
      if (Math.random() < 0.5) this.scene.fx?.burst("gust", w.x + Math.cos(w.dir) * r, w.y + Math.sin(w.dir) * r, 1, w.dir, 60);
      if (k < 1) keep.push(w);
    }
    this.waves = keep;
  }
}

// VENTO SUL (Assobio + Granizo): o assobio gelado do sul — cone mais largo, duas ondas,
// e cada onda leva gelo também (def.also) → GEADA.
export class VentoSul extends Assobio {
  constructor(scene) {
    super(scene, "VENTO_SUL");
    this.baseKey = this.def.evolvesFrom;
    this._tint = PAL.ice2;
  }
}

// ============================================================================
// FOLHAS AO VENTO — folhas cortantes saem do herói girando numa espiral que abre.
// ============================================================================
const MAX_LEAVES = 24;
export class Folhas extends WindWeapon {
  constructor(scene, defKey = "FOLHAS") {
    super(scene, defKey);
    this.leaves = [];
    this._tint = null;
    this._trail = "wind";
  }
  dispose() {
    for (const l of this.leaves) l.spr.destroy();
    this.leaves = [];
  }
  _fire() {
    if (!this.owner) return false;
    if (!this._closest(this.owner, this.range * this.area + 40, 1).length) return false;
    // cada +1 (carta ou Galhos Extras) = +2 folhas, como a carta promete ("+2 Folhas")
    const n = this.def.count + 2 * ((this.owner?.extraProj ?? 0) + this.extraProj);
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n && this.leaves.length < MAX_LEAVES; i++) {
      // folha desenhada que rodopia (px_leaf_tumble); cada uma começa num ponto do giro
      const spr = this.scene.add.sprite(this.owner.x, this.owner.y, "px_leaf_tumble", i % 4).setScale(3).setDepth(D_WFX).play({ key: "leaf_tumble", startFrame: i % 4 });
      if (this._tint) spr.setTint(this._tint);
      this.leaves.push({ a: a0 + (i / n) * Math.PI * 2, t0: this.scene.time.now, spr, last: new Map(), x: this.owner.x, y: this.owner.y });
    }
    this.scene.sound.play("sfx_folhas", { volume: 0.3 });
    return true;
  }
  lights(add) {
    if (this._tint) for (const l of this.leaves) add(l.x, l.y, 40, this._tint, 0.5);
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.leaves.length || !this.owner) return;
    const R = this.range * this.area;
    const life = this.def.lifeMs;
    const spin = this.def.spin;
    const dmg = this.damage;
    const keep = [];
    for (const l of this.leaves) {
      const k = (time - l.t0) / life;
      if (k >= 1) {
        l.spr.destroy();
        continue;
      }
      // espiral: o raio abre e o ângulo gira; a folha acompanha o herói
      const r = 20 + (R - 20) * k;
      const a = l.a + spin * (time - l.t0) / 1000;
      l.x = this.owner.x + Math.cos(a) * r;
      l.y = this.owner.y + Math.sin(a) * r * 0.8;
      l.spr.setPosition(l.x, l.y).setFlipX(Math.cos(a) < 0).setAlpha(k > 0.85 ? (1 - k) / 0.15 : 1); // sem girar o sprite: o rodopio é desenhado
      this.scene.fx?.trail(l, l.x, l.y, this._trail, 60);
      if (this.owner?.links?.active.size) this._emit("folhas:move", { weapon: this, leaf: l });
      this._eachTarget((e) => {
        if ((e.x - l.x) ** 2 + (e.y - 6 - l.y) ** 2 > 22 * 22) return;
        if (time - (l.last.get(e) ?? -1e9) < 420) return;
        l.last.set(e, time);
        this._hit(e, dmg * (l.boost ?? 1), ELEMENT.WIND, l.x, l.y, false);
        this.scene.fx?.impact(e.x, e.y - 6, "wind", { power: 0.35, dir: a + Math.PI / 2 });
      });
      keep.push(l);
    }
    this.leaves = keep;
  }
}

// VENTANIA (Folhas + Vaga-lumes): mais folhas, carregadas de raio (def.also) → TEMPORAL.
export class Ventania extends Folhas {
  constructor(scene) {
    super(scene, "VENTANIA");
    this.baseKey = this.def.evolvesFrom;
    this._tint = 0xe8ccff;
    this._trail = "bolt";
  }
}

// ============================================================================
// CATA-VENTO — torre plantada no chão (como os cata-ventos dos poços do sertão):
// gira e sopra rajadas que atravessam o bando e empurram.
// ============================================================================
const MAX_GUSTS = 30;
export class Catavento extends WindWeapon {
  constructor(scene, defKey = "CATAVENTO") {
    super(scene, defKey);
    this.towers = [];
    this.gusts = [];
    this._gustEl = ELEMENT.WIND;
    this._gustTint = PAL.wnd3;
  }
  get max() {
    return this.def.max + (this.owner?.extraProj ?? 0) + this.extraProj;
  }
  dispose() {
    for (const t of this.towers) this._despawn(t);
    for (const g of this.gusts) g.spr.destroy();
    this.towers = [];
    this.gusts = [];
  }
  _fire() {
    if (!this.owner) return false;
    if (!this._closest(this.owner, 420, 1).length) return false;
    if (this.towers.length >= this.max) this._despawn(this.towers.shift());
    const o = this.owner;
    // ao lado do herói (alternando os lados), nunca escondido atrás dele
    this._side = -(this._side ?? -1);
    const x = o.x + this._side * (40 + Math.random() * 12),
      y = o.y + 10 + (Math.random() - 0.5) * 16;
    const scene = this.scene;
    const stick = scene.add.image(x, y, "px_catavento_stick").setOrigin(0.5, 1).setScale(3).setDepth(y + 10000);
    // pás com o giro DESENHADO (4 quadros pré-girados, sem rotação de sprite)
    const blades = scene.add.sprite(x, y - 36, this._bladeTex ?? "px_catavento_spin", 0).setScale(0).setDepth(y + 10001).play(this._bladeAnim ?? "catavento_spin");
    scene.tweens.add({ targets: blades, scale: 3, duration: 200, ease: "Back.easeOut" });
    scene.fx?.burst("gust", x, y - 30, 8, null, 360);
    scene.sound.play("sfx_catavento", { volume: 0.3 });
    this.towers.push({ x, y, stick, blades, until: scene.time.now + this.def.durationMs, next: scene.time.now + 300 });
    return true;
  }
  _despawn(t) {
    const objs = [t.stick, t.blades];
    this.scene.tweens.add({ targets: objs, alpha: 0, duration: 200, onComplete: () => objs.forEach((o) => o.destroy()) });
  }
  lights(add) {
    for (const g of this.gusts) add(g.x, g.y, 50, this._gustTint, 0.6);
  }
  update(time, dt) {
    super.update(time, dt);
    const s = dt / 1000;
    if (this.towers.length) {
      const keep = [];
      for (const t of this.towers) {
        if (time >= t.until) {
          this._despawn(t);
          continue;
        }
        if (time >= t.next) {
          t.next = time + this.def.everyMs;
          const target = this._closest(t, this.range * this.area, 1)[0];
          if (target && this.gusts.length < MAX_GUSTS) {
            const a = Math.atan2(target.y - (t.y - 36), target.x - t.x);
            const spr = this.scene.add.image(t.x, t.y - 36, "px_gust").setScale(3).setRotation(a).setTint(this._gustTint).setDepth(D_WFX);
            const sp = this.def.speed;
            this.gusts.push({ x: t.x, y: t.y - 36, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spr, until: time + 900, hit: new Set(), a });
          }
        }
        keep.push(t);
      }
      this.towers = keep;
    }
    if (this.gusts.length) {
      const dmg = this.damage;
      const keep = [];
      for (const g of this.gusts) {
        if (time >= g.until) {
          g.spr.destroy();
          continue;
        }
        g.x += g.vx * s;
        g.y += g.vy * s;
        g.spr.setPosition(g.x, g.y);
        this.scene.fx?.trail(g, g.x, g.y, this._gustEl, 40);
        this._eachTarget((e) => {
          if (g.hit.has(e) || (e.x - g.x) ** 2 + (e.y - 6 - g.y) ** 2 > 20 * 20) return;
          g.hit.add(e); // atravessa: cada rajada acerta cada um uma vez
          const died = this._hit(e, dmg, ELEMENT.WIND, g.x, g.y, false);
          if (!died) this._push(e, g.x - g.vx * 0.05, g.y - g.vy * 0.05, this.def.push);
          this.scene.fx?.impact(e.x, e.y - 6, this._gustEl, { power: 0.45, dir: g.a });
        });
        keep.push(g);
      }
      this.gusts = keep;
    }
  }
}

// CATA-VENTO DE BRASA (Cata-vento + Fogueira): o cata-vento abana o fogo — rajadas
// em brasa (def.also = fogo → LABAREDA) e mais torres.
export class CataventoBrasa extends Catavento {
  constructor(scene) {
    super(scene, "CATAVENTO_BRASA");
    this.baseKey = this.def.evolvesFrom;
    this._gustEl = ELEMENT.FIRE;
    this._gustTint = PAL.org3;
    this._bladeTex = "px_catavento_brasa_spin";
    this._bladeAnim = "catavento_brasa_spin";
  }
}

registerWeapon("ASSOBIO", Assobio);
registerWeapon("VENTO_SUL", VentoSul);
registerWeapon("FOLHAS", Folhas);
registerWeapon("VENTANIA", Ventania);
registerWeapon("CATAVENTO", Catavento);
registerWeapon("CATAVENTO_BRASA", CataventoBrasa);
