// Armas: base + Staff (Cajado, fogo) para D1.
// Aura/Bumerangue/Raio Encadeado + evoluções em D2.
import { WEAPONS, WEAPON_LEVEL_DMG, COLORS, GAME } from '../config.js';

// ------------- Projétil reutilizável (pool) -------------

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    super(scene, -9999, -9999, 'dungeon_tiles', 117); // frame arbitrário "gem-ish"
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE * 0.6);
    this.body.setCircle(5, 3, 3);
    this.setActive(false).setVisible(false);
    this.body.enable = false;

    this.dmg = 0;
    this.element = null;
    this.lifeUntil = 0;
  }

  fire(x, y, vx, vy, dmg, element, lifeMs = 2000, tint = 0xffffff) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setVelocity(vx, vy);
    this.dmg = dmg;
    this.element = element;
    this.lifeUntil = this.scene.time.now + lifeMs;
    this.setTint(tint);
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
  }

  update(time) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
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
