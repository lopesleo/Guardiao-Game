// Armas: base + Staff (Cajado, fogo) para D1.
// Aura/Bumerangue/Raio Encadeado + evoluções em D2.
import { WEAPONS, WEAPON_LEVEL_DMG, COLORS, GAME } from '../config.js';

// ------------- Projétil desenhado (graphics + physics body manual) -------------
// Não usa spritesheet: bola colorida com glow, mais bonito e flexível.

export class Projectile extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);

    // Glow externo (círculo grande com alpha)
    this.glow = scene.add.circle(0, 0, 22, 0xff7a3c, 0.4);
    // Núcleo brilhante
    this.core = scene.add.circle(0, 0, 10, 0xffe6b8, 1.0);
    this.add([this.glow, this.core]);

    // Physics
    scene.physics.add.existing(this);
    this.body.setCircle(10, -10, -10);
    this.setActive(false).setVisible(false);
    this.body.enable = false;

    this.dmg = 0;
    this.element = null;
    this.lifeUntil = 0;
  }

  fire(x, y, vx, vy, dmg, element, lifeMs = 2000, color = 0xff7a3c) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.element = element;
    this.lifeUntil = this.scene.time.now + lifeMs;
    this.glow.setFillStyle(color, 0.35);
    this.core.setFillStyle(0xffffff, 1.0);
    // Toque elemental no núcleo
    if (element === 'ice')  this.core.setFillStyle(0xc8e6ff, 1);
    if (element === 'bolt') this.core.setFillStyle(0xf0d4ff, 1);
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }

  update(time) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
    // Pulsação leve do glow
    const s = 1 + Math.sin(time / 60) * 0.12;
    this.glow.setScale(s);
  }
}

// ------------- Arma base + Staff -------------

export class Weapon {
  constructor(scene, defKey) {
    this.scene = scene;
    this.def = WEAPONS[defKey];
    this.key = defKey;
    this.level = 1;
    this.lastFireAt = 0;
    this.owner = null;
  }

  get cooldown() {
    return this.def.cooldown * (this.owner?.cdMult ?? 1);
  }

  get damage() {
    return WEAPON_LEVEL_DMG(this.def.baseDmg, this.level);
  }

  update(time, dt) {
    if (time - this.lastFireAt < this.cooldown) return;
    if (this._fire(time)) this.lastFireAt = time;
  }

  _fire() { return false; /* override */ }

  _nearestEnemyInRange() {
    const range = this.def.range ?? 9999;
    const rangeSq = range * range;
    let best = null, bestSq = Infinity;
    this.scene.enemyPool.forEachActive(e => {
      if (!e.active) return;
      const dx = e.x - this.owner.x, dy = e.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq && d2 <= rangeSq) { bestSq = d2; best = e; }
    });
    return best;
  }
}

export class Staff extends Weapon {
  constructor(scene) { super(scene, 'STAFF'); }

  _fire(time) {
    const target = this._nearestEnemyInRange();
    if (!target) return false;
    const proj = this.scene.projectilePool.acquire();
    const dx = target.x - this.owner.x, dy = target.y - this.owner.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.def.projSpeed;
    proj.fire(this.owner.x, this.owner.y, (dx / len) * sp, (dy / len) * sp,
              this.damage, 'fire', 2000, COLORS.FIRE);
    return true;
  }
}
