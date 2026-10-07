// Leva 3 de armas (ver docs/ARMAS_E_COMBOS.md e docs/CONTEUDO.md): cada uma traz um
// VERBO que o jogo não tinha — chicotear de perto, ricochetear, atrair, armar
// armadilha, amarrar, pulsar. Simulação própria (sem corpo de física), teto de
// objetos vivos. As evoluções só mudam números + def.also (segundo elemento →
// a reação sai sozinha), então quase não têm código próprio.
// Registro: registerWeapon(chave, Classe) no fim do arquivo.
import { COLORS, ELEMENT } from "../config.js";
import { PAL } from "../art/Palette.js";
import { bayer } from "../art/PixelArt.js";
import { Weapon, registerWeapon } from "./Weapons.js";

const D_WFX = 48545; // acima do mapa de luz (o golpe é "aceso"), abaixo dos avisos de chefe
const CELL = 3;
const snap = (v) => Math.round(v / CELL) * CELL;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Utilidades comuns às armas da leva
class LevaWeapon extends Weapon {
  // Dano de um número da ficha (ex.: burst.dmg) com os mesmos multiplicadores da arma
  _scaled(base) {
    return base * this.dmgMult * (this.owner?.dmgMultFor?.(this.def.element) ?? this.owner?._blessingDmgMult ?? 1);
  }
  get area() {
    return Math.sqrt(this.owner?.areaMult ?? 1);
  }
  // Até n alvos mais perto de (from) dentro de r, sem repetir os de `skip`
  _closest(from, r, n = 1, skip = null) {
    const rSq = r * r;
    const list = [];
    this._eachTarget((e) => {
      if (skip?.has(e)) return;
      const d2 = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d2 <= rSq) list.push({ e, d2 });
    });
    list.sort((a, b) => a.d2 - b.d2);
    return list.slice(0, n).map((o) => o.e);
  }
  // Empurrão (não mexe em chefe nem minichefe)
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
// AÇOITE DE URTIGA (Comadre Fulozinha) — arco corpo a corpo, queima e empurra.
// Cartas "+1 Açoite" estalam outro açoite para o lado oposto.
// ============================================================================
export class Lash extends LevaWeapon {
  constructor(scene, defKey = "LASH") {
    super(scene, defKey);
    this._side = 1;
  }
  get reach() {
    return this.range * this.area;
  }
  _fire() {
    if (!this.owner) return false;
    const t = this._closest(this.owner, this.reach + 30, 1)[0];
    if (!t) return false;
    const dir = Math.atan2(t.y - this.owner.y, t.x - this.owner.x);
    this._lash(dir);
    const extra = (this.owner?.extraProj ?? 0) + this.extraProj;
    for (let i = 1; i <= extra; i++) this.scene.time.delayedCall(i * 120, () => this.owner && this._lash(dir + Math.PI * (i % 2 ? 1 : 0) + (i > 1 ? 0.6 : 0)));
    return true;
  }
  // Açoite avulso (laço Rufar da Mata)
  strike() {
    if (!this.owner) return;
    const t = this._closest(this.owner, this.reach + 60, 1)[0];
    if (t) this._lash(Math.atan2(t.y - this.owner.y, t.x - this.owner.x));
  }
  _lash(dir) {
    const scene = this.scene,
      o = this.owner;
    const R = this.reach,
      half = this.def.halfAngle;
    const px = o.x,
      py = o.y - 6;
    const dmg = this.damage;
    let hits = 0;
    this._eachTarget((e) => {
      const dx = e.x - px,
        dy = e.y - py;
      const d = Math.hypot(dx, dy);
      if (d > R + 14) return;
      if (d > 28 && Math.abs(angDiff(Math.atan2(dy, dx), dir)) > half) return;
      const died = this._hit(e, dmg, ELEMENT.FIRE, px, py);
      hits++;
      if (!died) {
        this._push(e, px, py, this.def.push);
        this._onLashHit?.(e);
      }
      if (hits <= 5) scene.fx?.impact(e.x, e.y - 6, "fire", { power: 0.6, dir });
    });
    this._lashFx(px, py, dir, R, half);
    scene.sound.play("sfx_lash", { volume: hits ? 0.42 : 0.25, rate: 0.95 + Math.random() * 0.15 });
  }
  // O chicote: um cipó que varre o arco (de um lado ao outro), com folhas e a
  // ponta faiscando; deixa por um instante o rastro laranja do arco varrido.
  _lashFx(px, py, dir, R, half) {
    const scene = this.scene;
    const side = (this._side = -this._side);
    const a0 = dir - half * side,
      a1 = dir + half * side;
    const g = scene.add.graphics().setDepth(D_WFX);
    const leaf = this._leafColor ?? PAL.g5;
    const tipC = this._tipColor ?? PAL.org3;
    const k = { t: 0 };
    scene.tweens.add({
      targets: k,
      t: 1,
      duration: 190,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        g.clear();
        const a = a0 + (a1 - a0) * k.t;
        // rastro do arco já varrido, em PIXEL: um crescente com a borda de fora clara, o
        // miolo na cor do golpe e o lado mais velho se desfazendo em pontilhado (nada de
        // fatia translúcida — era a única forma vetorial do jogo)
        const sweep = a - a0;
        const steps = Math.ceil((Math.abs(sweep) * R) / CELL);
        const trail = this._trailColor ?? PAL.org2,
          dark = this._darkColor ?? PAL.red1;
        // espessura em CAMADAS de célula (5 na ponta → 2 no fim velho): mantém o desenho
        // abaixo de ~500 retângulos — Graphics com milhares deles some no Phaser 4
        for (let i = 0; i <= steps; i++) {
          const t = i / Math.max(1, steps); // 0 = começo do arco (velho) … 1 = ponta
          const ang = a0 + sweep * t;
          const age = (1 - t) * (0.55 + 0.45 * k.t);
          const layers = Math.max(2, Math.round(5 - age * 3));
          for (let L = 0; L < layers; L++) {
            const rr = R + CELL - L * CELL;
            const edge = L / layers; // 0 = fora … 1 = dentro
            const x = snap(px + Math.cos(ang) * rr),
              y = snap(py + Math.sin(ang) * rr);
            if (bayer(x / CELL, y / CELL) < age * 1.1 + edge * 0.45 - 0.25) continue;
            g.fillStyle(L === 0 ? (t > 0.8 ? 0xffffff : tipC) : edge < 0.6 ? trail : dark, 1);
            g.fillRect(x - 1, y - 1, CELL, CELL);
          }
        }
        // o cipó: curva cheia da mão até a ponta (2 células de grossura perto da mão),
        // atrasando atrás do movimento como um chicote de verdade
        const N = Math.round(R / 3.2);
        for (let i = 1; i <= N; i++) {
          const u = i / N;
          const ang = a - side * (1 - u) * 0.6 * (1 - k.t);
          const x = px + Math.cos(ang) * R * u,
            y = py + Math.sin(ang) * R * u;
          const col = u > 0.92 ? tipC : i % 5 === 0 ? leaf : PAL.g3;
          g.fillStyle(col, 1);
          g.fillRect(snap(x) - 1, snap(y) - 1, CELL, CELL);
          if (u < 0.55) {
            g.fillStyle(PAL.g2, 1);
            g.fillRect(snap(x + Math.cos(ang + 1.57) * 3) - 1, snap(y + Math.sin(ang + 1.57) * 3) - 1, CELL, CELL);
          }
          if (i % 5 === 2) {
            // folha serrilhada da urtiga
            g.fillStyle(leaf, 1);
            g.fillRect(snap(x + Math.cos(ang + 1.6) * 5) - 1, snap(y + Math.sin(ang + 1.6) * 5) - 1, CELL, CELL);
            g.fillStyle(PAL.g6, 1);
            g.fillRect(snap(x + Math.cos(ang - 1.6) * 5) - 1, snap(y + Math.sin(ang - 1.6) * 5) - 1, CELL, CELL);
          }
        }
        const tx = px + Math.cos(a) * R,
          ty = py + Math.sin(a) * R;
        g.fillStyle(0xffffff, 1).fillRect(snap(tx) - 2, snap(ty) - 2, 5, 5); // ponta acesa
        if (Math.random() < 0.7) scene.fx?.burst(this._tipBurst ?? "ember", tx, ty, 2, null, 360, { min: 20, max: 90 });
      },
      onComplete: () => {
        scene.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
        const tx = px + Math.cos(a1) * R,
          ty = py + Math.sin(a1) * R;
        scene.fx?.star(tx, ty, tipC, 0.5, 1.8, 110, Math.PI / 4);
        scene.fx?.burst("leaf", px + Math.cos(dir) * R * 0.6, py + Math.sin(dir) * R * 0.6, 3, dir, 70, { min: 40, max: 120 });
      },
    });
  }
}

// LAÇADA DE URTIGA (Açoite + Boleadeira): maior, e a ponta enlaça com geada (def.also =
// gelo → VAPOR em cada golpe) e prende um instante.
export class Lacada extends Lash {
  constructor(scene) {
    super(scene, "LACADA");
    this.baseKey = this.def.evolvesFrom;
    this._tipColor = PAL.ice3;
    this._leafColor = PAL.ice2;
    this._trailColor = PAL.ice2;
    this._darkColor = PAL.ice1;
    this._tipBurst = "frost";
  }
  _onLashHit(e) {
    if (e === this.scene.boss) return;
    e._bindUntil = this.scene.time.now + this.def.bindMs;
    e._bindSlow = 0.3;
  }
}

// ============================================================================
// BOLA DE OURO (Mãe-do-Ouro) — bola que RICOCHETEIA de inimigo em inimigo.
// ============================================================================
const MAX_BALLS = 8;
export class GoldBall extends LevaWeapon {
  constructor(scene, defKey = "GOLDBALL") {
    super(scene, defKey);
    this.balls = [];
    this._tex = "px_goldball";
    this._tint = 0xffd060;
    this._elTrail = "bolt";
  }
  dispose() {
    for (const b of this.balls) this._despawn(b);
    this.balls = [];
  }
  _fire() {
    if (!this.owner) return false;
    const n = 1 + (this.owner?.extraProj ?? 0) + this.extraProj;
    const targets = this._closest(this.owner, this.range, n);
    if (!targets.length) return false;
    for (let i = 0; i < n && this.balls.length < MAX_BALLS; i++) this._spawn(targets[i % targets.length]);
    this.scene.sound.play("sfx_goldball", { volume: 0.32, rate: 1 + Math.random() * 0.1 });
    return true;
  }
  _spawn(target) {
    const scene = this.scene,
      o = this.owner;
    const x = o.x,
      y = o.y - 12;
    const glow = scene.add.image(x, y, "fx_glow").setScale(0.75).setTint(this._tint).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(60);
    const spr = scene.add.image(x, y, this._tex).setScale(3).setDepth(D_WFX);
    this.balls.push({ x, y, target, left: this.def.bounces, hit: new Set(), spr, glow, until: scene.time.now + 4500, fade: 0, vx: 0, vy: 0 });
  }
  _despawn(b) {
    b.spr.destroy();
    b.glow.destroy();
  }
  lights(add) {
    for (const b of this.balls) add(b.x, b.y, 90, this._tint, 0.85);
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.balls.length) return;
    const s = dt / 1000;
    const sp = this.def.speed;
    const keep = [];
    for (const b of this.balls) {
      if (time >= b.until) {
        this._despawn(b);
        continue;
      }
      if (b.fade > 0) {
        // sem alvo: segue reto e apaga
        b.fade -= dt;
        b.x += b.vx * s;
        b.y += b.vy * s;
        b.spr.setAlpha(Math.max(0, b.fade / 250));
        b.glow.setAlpha(Math.max(0, b.fade / 250) * 0.7);
        b.spr.setPosition(b.x, b.y);
        b.glow.setPosition(b.x, b.y);
        if (b.fade <= 0) {
          this._despawn(b);
          continue;
        }
        keep.push(b);
        continue;
      }
      const t = b.target;
      if (!t?.active) {
        b.target = this._closest(b, this.def.bounceRange * this.area, 1, b.hit)[0] ?? null;
        if (!b.target) b.fade = 250;
        keep.push(b);
        continue;
      }
      const dx = t.x - b.x,
        dy = t.y - 8 - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      b.x += b.vx * s;
      b.y += b.vy * s;
      b.spr.setPosition(b.x, b.y).setRotation(b.spr.rotation + s * 9);
      b.glow.setPosition(b.x, b.y).setScale(0.7 + Math.sin(time / 60) * 0.08);
      this.scene.fx?.trail(b, b.x, b.y, b.molten ? "fire" : this._elTrail, 26);
      if (this.owner?.links?.active.size) this._emit("goldball:move", { weapon: this, ball: b });
      if (d < 16) {
        this._hit(t, this.damage, ELEMENT.BOLT, b.x, b.y);
        this._emit("goldball:hit", { weapon: this, ball: b, target: t });
        this.scene.fx?.impact(b.x, b.y, "bolt", { power: 0.7, dir: Math.atan2(b.vy, b.vx) });
        this.scene.fx?.star(b.x, b.y, this._tint, 0.4, 1.4, 100);
        this.scene.sound.play("sfx_goldball", { volume: 0.16, rate: 1.3 + (this.def.bounces - b.left) * 0.08 });
        b.hit.add(t);
        b.left--;
        b.target = b.left >= 0 ? this._closest(b, this.def.bounceRange * this.area, 1, b.hit)[0] ?? null : null;
        if (!b.target) b.fade = 250;
      }
      keep.push(b);
    }
    this.balls = keep;
  }
}

// OURO ENCANTADO (Bola de Ouro + Miragem): mais ricochetes e o ouro vira gelo
// encantado (def.also = gelo → CRISTAL em cada acerto).
export class OuroEncantado extends GoldBall {
  constructor(scene) {
    super(scene, "OURO_ENCANTADO");
    this.baseKey = this.def.evolvesFrom;
    this._tex = "px_goldball_ice";
    this._tint = 0x9fe8ff;
    this._elTrail = "ice";
  }
}

// ============================================================================
// MIRAGEM (Anhangá) — ilusão do veado branco que ATRAI o bando; quem encosta
// esfria; no fim, estoura em geada. Chefe e minichefes não são enganados.
// ============================================================================
const MAX_MIRAGES = 6;
export class Mirage extends LevaWeapon {
  constructor(scene, defKey = "MIRAGE") {
    super(scene, defKey);
    this.decoys = [];
    this._tint = COLORS.ICE;
  }
  dispose() {
    for (const m of this.decoys) this._despawn(m);
    this.decoys = [];
  }
  _fire() {
    if (!this.owner) return false;
    const near = this._closest(this.owner, 520, 1)[0];
    if (!near) return false;
    const n = this.def.count + (this.owner?.extraProj ?? 0) + this.extraProj;
    const base = Math.atan2(near.y - this.owner.y, near.x - this.owner.x);
    for (let i = 0; i < n; i++) {
      // na direção do bando, abrindo em leque quando há mais de uma
      const a = base + (i - (n - 1) / 2) * 0.9;
      const d = this.def.range * this.area;
      this._spawn(this.owner.x + Math.cos(a) * d, this.owner.y + Math.sin(a) * d, this.def.durationMs, this.def.lureR * this.area, true);
    }
    this.scene.sound.play("sfx_mirage", { volume: 0.4 });
    return true;
  }
  // Miragem curta (laço Rastro Falso, onde a vara faz a volta)
  spawnEcho(x, y) {
    this._spawn(x, y, 1300, 150 * this.area, false, 0.6);
  }
  _spawn(x, y, ms, lureR, burst, scale = 1) {
    if (this.decoys.length >= MAX_MIRAGES) this._end(this.decoys.shift(), false);
    const scene = this.scene;
    const glow = scene.add.image(x, y, "fx_glow").setScale(1.4 * scale).setTint(this._tint).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    const spr = scene.add.image(x, y, "px_mirage").setScale(3 * scale).setAlpha(0).setDepth(y + 10000).setFlipX(x < (this.owner?.x ?? x));
    scene.tweens.add({ targets: spr, alpha: 0.85, duration: 260 });
    scene.tweens.add({ targets: glow, alpha: 0.5, duration: 260 });
    scene.fx?.ring(x, y, this._tint, 10, lureR * 0.5, 380, 0.55, 0.7);
    scene.fx?.burst("frost", x, y - 10, 8, null, 360, { min: 20, max: 70 });
    this.decoys.push({ x, y, spr, glow, until: scene.time.now + ms, born: scene.time.now, lureR, burst, nextTick: 0, nextLure: 0, scale });
  }
  _despawn(m) {
    m.spr.destroy();
    m.glow.destroy();
  }
  lights(add) {
    for (const m of this.decoys) add(m.x, m.y - 10, 120 * m.scale, this._tint, 0.7);
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.decoys.length) return;
    const keep = [];
    for (const m of this.decoys) {
      if (time >= m.until) {
        this._end(m, m.burst);
        continue;
      }
      // brilho trêmulo de assombração
      m.spr.setAlpha(0.65 + Math.sin(time / 90 + m.x) * 0.2).setY(m.y - 3 + Math.sin(time / 260) * 3);
      if (time >= m.nextLure) {
        m.nextLure = time + 180;
        const rSq = m.lureR * m.lureR;
        this.scene.enemyPool.forEachActive((e) => {
          if (!e.active || e.miniBoss || (e.x - m.x) ** 2 + (e.y - m.y) ** 2 > rSq) return;
          e._lureUntil = time + 320;
          e._lureX = m.x;
          e._lureY = m.y;
        });
      }
      if (time >= m.nextTick) {
        m.nextTick = time + this.def.tickMs;
        const r = this.def.touchR * this.area * m.scale;
        let n = 0;
        this._eachTarget((e) => {
          if ((e.x - m.x) ** 2 + (e.y - m.y) ** 2 > r * r) return;
          this._hit(e, this.damage, ELEMENT.ICE, m.x, m.y, false);
          if (n++ < 3) this.scene.fx?.impact(e.x, e.y - 6, "ice", { power: 0.35 });
        });
      }
      keep.push(m);
    }
    this.decoys = keep;
  }
  // Fim da ilusão: estoura em geada (as evoluções somam o segundo elemento via def.also)
  _end(m, burst) {
    const scene = this.scene;
    if (burst) {
      const R = this.def.burst.r * this.area;
      const dmg = this._scaled(this.def.burst.dmg);
      this._eachTarget((e) => {
        if ((e.x - m.x) ** 2 + (e.y - m.y) ** 2 <= R * R) this._hit(e, dmg, ELEMENT.ICE, m.x, m.y);
      });
      scene.fx?.ring(m.x, m.y, this._burstTint ?? 0xbfeaff, 8, R, 260, 0.6, 0.9);
      scene.fx?.burst("shard", m.x, m.y - 8, 10, null, 360, { min: 80, max: 220 });
      scene.fx?.burst(this._burstKind ?? "frost", m.x, m.y, 10, null, 360, { min: 40, max: 140 });
      scene.fx?.light(m.x, m.y, R * 2.2, this._burstTint ?? 0x5cc8ff, 220, 1);
      scene.sound.play("sfx_ice_attack", { volume: 0.32, rate: 0.8 });
    }
    scene.tweens.add({ targets: [m.spr, m.glow], alpha: 0, duration: 200, onComplete: () => this._despawn(m) });
  }
}

// VISAGEM (Miragem + Fogueira): duas aparições na fumaça; o estouro é fogo E geada
// (def.also = fogo → VAPOR).
export class Visagem extends Mirage {
  constructor(scene) {
    super(scene, "VISAGEM");
    this.baseKey = this.def.evolvesFrom;
    this._burstTint = 0xffc8a0;
    this._burstKind = "ember";
  }
}

// ============================================================================
// FOGUEIRA DE SÃO JOÃO — armadilha: planta fogueiras que queimam quem passa.
// ============================================================================
export class Bonfire extends LevaWeapon {
  constructor(scene, defKey = "BONFIRE") {
    super(scene, defKey);
    this.fires = [];
  }
  get max() {
    return this.def.max + (this.owner?.extraProj ?? 0) + this.extraProj;
  }
  dispose() {
    for (const f of this.fires) this._despawn(f);
    this.fires = [];
  }
  _fire() {
    if (!this.owner) return false;
    if (!this._closest(this.owner, 480, 1).length) return false; // sem bando por perto, guarda
    const o = this.owner;
    // um passo atrás de quem anda: o bando que persegue pisa nela
    const bx = o.x - (o.isMoving ? o.lastMoveX * 26 : 0),
      by = o.y + 14 - (o.isMoving ? o.lastMoveY * 26 : 0);
    if (this.fires.length >= this.max) this._despawn(this.fires.shift());
    // parado, as fogueiras abrem em volta (não nascem uma em cima da outra)
    let x = bx,
      y = by;
    const r = this.def.radius * this.area;
    for (let i = 0; i < 6 && this.fires.some((f) => (f.x - x) ** 2 + (f.y - y) ** 2 < r * r); i++) {
      const a = Math.random() * Math.PI * 2;
      x = bx + Math.cos(a) * r * 1.6;
      y = by + Math.sin(a) * r * 1.1;
    }
    this._light(x, y);
    return true;
  }
  _light(x, y) {
    const scene = this.scene;
    const r = this.def.radius * this.area * Math.sqrt(this.rangeMult);
    const logs = scene.add.image(x, y, "px_logs").setScale(3).setDepth(y + 9998);
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 7,
        fy = y + 2 - (i === 1 ? 2 : 0);
      const f = scene.add.image(fx, fy, i % 2 ? "px_flame1" : "px_flame0").setOrigin(0.5, 1).setScale(3.4, 0).setDepth(y + 9999 + i);
      scene.tweens.add({ targets: f, scaleY: i === 1 ? 4.4 : 3.4, duration: 180, ease: "Back.easeOut" });
      flames.push(f);
    }
    const glow = scene.add.image(x, y, "fx_glow").setScale((r * 2.3) / 64).setTint(COLORS.FIRE).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    scene.fx?.burst("ember", x, y - 8, 10, -Math.PI / 2, 80, { min: 40, max: 120 });
    scene.sound.play("sfx_bonfire", { volume: 0.32, rate: 0.9 + Math.random() * 0.2 });
    this.fires.push({ x, y, r, logs, flames, glow, until: scene.time.now + this.def.durationMs, nextTick: 0, nextWork: scene.time.now + 400 });
  }
  _despawn(f) {
    const objs = [f.logs, f.glow, ...f.flames];
    this.scene.tweens.add({ targets: objs, alpha: 0, duration: 220, onComplete: () => objs.forEach((o) => o.destroy()) });
  }
  lights(add) {
    for (const f of this.fires) add(f.x, f.y - 10, f.r * 3, 0xff8a3c, 0.85);
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.fires.length) return;
    const keep = [];
    const flick = Math.floor(time / 110) % 2;
    for (const f of this.fires) {
      if (time >= f.until) {
        this._despawn(f);
        continue;
      }
      f.flames.forEach((fl, i) => fl.setTexture((i + flick) % 2 ? "px_flame1" : "px_flame0"));
      f.glow.setAlpha(0.32 + Math.sin(time / 80 + f.x) * 0.1);
      if (Math.random() < 0.08) this.scene.fx?.burst("ember", f.x + (Math.random() - 0.5) * 12, f.y - 14, 1, -Math.PI / 2, 40, { min: 30, max: 90 });
      if (time >= f.nextTick) {
        f.nextTick = time + this.def.tickMs;
        const rSq = f.r * f.r;
        this._eachTarget((e) => {
          if ((e.x - f.x) ** 2 + (e.y - f.y) ** 2 > rSq) return;
          // fogueiras sobrepostas não somam: cada inimigo queima numa só por tique
          if (time - (e._bonfireAt ?? -1e9) < this.def.tickMs * 0.8) return;
          e._bonfireAt = time;
          this._hit(e, this.damage, ELEMENT.FIRE, f.x, f.y, false);
        });
      }
      if (time >= f.nextWork) {
        f.nextWork = time + (this.def.fireworks?.everyMs ?? 1e9);
        this._afterTick?.(f);
      }
      keep.push(f);
    }
    this.fires = keep;
  }
}

// ARRAIAL (Fogueira + Bola de Ouro): fogueiras maiores; o fogo é também raio (def.also)
// e cada uma solta FOGOS dourados em quem está perto → SOBRECARGA.
export class Arraial extends Bonfire {
  constructor(scene) {
    super(scene, "ARRAIAL");
    this.baseKey = this.def.evolvesFrom;
  }
  _afterTick(f) {
    const fw = this.def.fireworks;
    const targets = this._closest(f, fw.r * this.area, 2);
    const dmg = this._scaled(fw.dmg);
    targets.forEach((t, i) => {
      this.scene.time.delayedCall(i * 140, () => {
        if (!t.active) return;
        // rojão: sobe da fogueira e cai no alvo, estourando em estrela dourada
        this.scene.fx?.bolt(f.x, f.y - 30, t.x, t.y - 6, 0xffd060, 3, 1);
        this.scene.fx?.star(t.x, t.y - 10, 0xffe58f, 0.6, 2.2, 160, Math.random());
        this.scene.fx?.burst("spark", t.x, t.y - 10, 6, null, 360, { min: 60, max: 160 }, [0xffffff, 0xffe58f, 0xff8a3c]);
        this._hit(t, dmg, ELEMENT.BOLT, f.x, f.y);
      });
    });
    if (targets.length) this.scene.sound.play("sfx_goldball", { volume: 0.18, rate: 1.6 });
  }
}

// ============================================================================
// BOLEADEIRA — três pedras numa corda: amarra até bindN inimigos juntos (puxa um
// para o outro, quase não andam) e esfria.
// ============================================================================
const MAX_BOLAS = 6;
export class Bolas extends LevaWeapon {
  constructor(scene, defKey = "BOLAS") {
    super(scene, defKey);
    this.shots = [];
    this.binds = [];
    this.g = null;
  }
  dispose() {
    for (const b of this.shots) b.spr.destroy();
    this.shots = [];
    this.binds = [];
    this.g?.destroy();
  }
  _fire() {
    if (!this.owner) return false;
    const n = this.def.count + (this.owner?.extraProj ?? 0) + this.extraProj;
    const targets = this._closest(this.owner, this.range, n);
    if (!targets.length) return false;
    for (let i = 0; i < n && this.shots.length < MAX_BOLAS; i++) {
      const ev = this._emit("bolas:target", { weapon: this, target: targets[i % targets.length] });
      const o = this.owner;
      const spr = this.scene.add.image(o.x, o.y - 12, "px_bolas").setScale(3).setDepth(D_WFX);
      this.shots.push({ x: o.x, y: o.y - 12, target: ev.target, spr, until: this.scene.time.now + 1600 });
    }
    this.scene.sound.play("sfx_bolas", { volume: 0.35, rate: 0.95 + Math.random() * 0.1 });
    return true;
  }
  update(time, dt) {
    super.update(time, dt);
    const s = dt / 1000;
    if (this.shots.length) {
      const keep = [];
      for (const b of this.shots) {
        const t = b.target;
        if (time >= b.until || !t?.active) {
          b.spr.destroy();
          continue;
        }
        const dx = t.x - b.x,
          dy = t.y - 8 - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = this.def.speed;
        b.x += (dx / d) * sp * s;
        b.y += (dy / d) * sp * s;
        b.spr.setPosition(b.x, b.y).setRotation(b.spr.rotation + s * 14);
        this.scene.fx?.trail(b, b.x, b.y, "ice", 40);
        if (d < 18) {
          this._bind(t, b.x, b.y);
          b.spr.destroy();
          continue;
        }
        keep.push(b);
      }
      this.shots = keep;
    }
    this._drawBinds(time);
  }
  _bind(target, x, y) {
    const scene = this.scene;
    const R = this.def.bindR * this.area;
    const group = [target, ...this._closest(target, R, this.def.bindN - 1, new Set([target]))].filter((e) => e !== scene.boss);
    const ev = this._emit("bolas:bind", { weapon: this, enemies: group, ms: this.def.bindMs });
    const now = scene.time.now;
    // puxa todos para o centro do grupo (as cordas apertam)
    const cx = group.reduce((a, e) => a + e.x, 0) / (group.length || 1),
      cy = group.reduce((a, e) => a + e.y, 0) / (group.length || 1);
    const dmg = this.damage;
    for (const e of [target, ...group.filter((e) => e !== target)]) {
      if (!e.active) continue;
      const died = this._hit(e, dmg, ELEMENT.ICE, x, y);
      if (died || e === scene.boss) continue;
      if (!e.miniBoss) {
        e.x += (cx - e.x) * 0.4;
        e.y += (cy - e.y) * 0.4;
      }
      e._bindUntil = now + ev.ms;
      e._bindSlow = this.def.bindSlow;
    }
    const live = group.filter((e) => e.active);
    if (live.length) this.binds.push({ enemies: live, until: now + ev.ms });
    scene.fx?.burst("frost", x, y, 8, null, 360, { min: 30, max: 100 });
    scene.fx?.ring(x, y, 0xbfeaff, 6, R * 0.8, 220, 0.6, 0.8);
    scene.sound.play("sfx_ice_attack", { volume: 0.22, rate: 1.3 });
    this._afterBind?.(live);
  }
  // Cordas ligando os amarrados (e 3 pedrinhas no meio)
  _drawBinds(time) {
    if (!this.binds.length) {
      this.g?.clear();
      return;
    }
    this.g ??= this.scene.add.graphics().setDepth(D_WFX - 1);
    const g = this.g;
    g.clear();
    this.binds = this.binds.filter((b) => time < b.until && b.enemies.some((e) => e.active));
    for (const b of this.binds) {
      const es = b.enemies.filter((e) => e.active);
      const cx = es.reduce((a, e) => a + e.x, 0) / es.length,
        cy = es.reduce((a, e) => a + e.y, 0) / es.length - 6;
      for (const e of es) {
        const n = Math.max(2, Math.round(Math.hypot(e.x - cx, e.y - 6 - cy) / 6));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const sag = Math.sin(u * Math.PI) * 3;
          g.fillStyle(i % 2 ? PAL.n4 : PAL.straw2, 0.95);
          g.fillRect(snap(cx + (e.x - cx) * u) - 1, snap(cy + (e.y - 6 - cy) * u + sag) - 1, CELL, CELL);
        }
      }
      g.fillStyle(PAL.s3, 1).fillRect(snap(cx) - 3, snap(cy) - 3, 6, 6);
      g.fillStyle(PAL.ice3, 1).fillRect(snap(cx) - 1, snap(cy) - 1, CELL, CELL);
    }
  }
}

// MINUANO (Boleadeira + Tambor): duas boleadeiras e, pouco depois, um trovão em cada
// amarrado (gelo + raio = CRISTAL); def.also = raio já no laço.
export class Minuano extends Bolas {
  constructor(scene) {
    super(scene, "MINUANO");
    this.baseKey = this.def.evolvesFrom;
  }
  _afterBind(live) {
    const z = this.def.zap;
    const dmg = this._scaled(z.dmg);
    this.scene.time.delayedCall(z.delayMs, () => {
      live.forEach((e, i) => {
        if (!e.active) return;
        this.scene.fx?.bolt(e.x + 20, e.y - 240, e.x, e.y - 6, COLORS.BOLT, 3, 2);
        this._hit(e, dmg, ELEMENT.BOLT, e.x, e.y - 30);
        if (i === 0) this.scene.sound.play("sfx_bolt_attack", { volume: 0.25, rate: 1.2 });
      });
    });
  }
}

// ============================================================================
// TAMBOR DO TROVÃO — onda em anel que sai do herói; acerta cada um uma vez e empurra.
// ============================================================================
const RING_FLAT = 0.7; // a onda é vista em perspectiva (achatada); o acerto segue a elipse
export class Drum extends LevaWeapon {
  constructor(scene, defKey = "DRUM") {
    super(scene, defKey);
    this.rings = [];
    this._tint = COLORS.BOLT;
  }
  get radius() {
    return this.range * this.area * Math.sqrt(this.rangeMult);
  }
  _fire() {
    if (!this.owner) return false;
    if (!this._closest(this.owner, this.radius, 1).length) return false;
    this._pulse();
    if (this.def.double) this.scene.time.delayedCall(260, () => this.owner && this._pulse());
    return true;
  }
  _pulse() {
    const scene = this.scene,
      o = this.owner;
    this.rings.push({ t0: scene.time.now, hit: new Set() });
    // a batida: onda de trovão desenhada (raios correndo pelo anel) + anel branco atrás
    scene.fx?.thunderRing(o.x, o.y + 4, 10, this.radius, this.def.growMs + 120, this._ringCols ?? [PAL.white, PAL.pur3, PAL.pur2, PAL.pur1], RING_FLAT);
    scene.fx?.ring(o.x, o.y + 4, 0xffffff, 6, this.radius * 0.78, this.def.growMs * 0.8, RING_FLAT, 0.6);
    scene.fx?.burst("zap", o.x, o.y, 8, null, 360, { min: 80, max: 200 });
    scene.fx?.light(o.x, o.y, this.radius * 1.6, this._tint, 260, 1);
    scene.cameras.main.shake(70, 0.002);
    scene.sound.play("sfx_drum", { volume: 0.45, rate: 0.95 + Math.random() * 0.1 });
    this._emit("drum:pulse", { weapon: this, x: o.x, y: o.y });
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.rings.length || !this.owner) return;
    const o = this.owner;
    const keep = [];
    for (const r of this.rings) {
      const k = Math.min(1, (time - r.t0) / this.def.growMs);
      const R = this.radius * (1 - (1 - k) * (1 - k)); // sai rápido e desacelera
      const dmg = this.damage;
      this._eachTarget((e) => {
        if (r.hit.has(e)) return;
        const dx = e.x - o.x,
          dy = (e.y - o.y) / RING_FLAT;
        if (dx * dx + dy * dy > R * R) return;
        r.hit.add(e);
        const died = this._hit(e, dmg, ELEMENT.BOLT, o.x, o.y, false);
        if (!died) this._push(e, o.x, o.y, this.def.push);
        this._emit("drum:hit", { weapon: this, target: e });
        if (r.hit.size <= 6) this.scene.fx?.impact(e.x, e.y - 6, "bolt", { power: 0.4 });
      });
      if (k < 1) keep.push(r);
    }
    this.rings = keep;
  }
}

// TROVÃO DE BRASA (Tambor + Açoite): batida dupla; a onda é raio E fogo (def.also =
// fogo → SOBRECARGA no anel).
export class BrasaTrovao extends Drum {
  constructor(scene) {
    super(scene, "BRASA_TROVAO");
    this.baseKey = this.def.evolvesFrom;
    this._tint = COLORS.FIRE;
    this._ringCols = [PAL.white, PAL.yel3, PAL.org2, PAL.red1]; // a onda é raio E brasa
  }
}

registerWeapon("LASH", Lash);
registerWeapon("LACADA", Lacada);
registerWeapon("GOLDBALL", GoldBall);
registerWeapon("OURO_ENCANTADO", OuroEncantado);
registerWeapon("MIRAGE", Mirage);
registerWeapon("VISAGEM", Visagem);
registerWeapon("BONFIRE", Bonfire);
registerWeapon("ARRAIAL", Arraial);
registerWeapon("BOLAS", Bolas);
registerWeapon("MINUANO", Minuano);
registerWeapon("DRUM", Drum);
registerWeapon("BRASA_TROVAO", BrasaTrovao);
