// Armas: Staff(🔥), Aura(❄️), Boomerang(🔥), ChainLightning(⚡) + evoluções (D3).
import { WEAPONS, WEAPON_LEVEL_DMG, COLORS, GAME } from '../config.js';

// ============================================================================
// Projétil reutilizável (graphics container)
// ============================================================================

export class Projectile extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.glow = scene.add.circle(0, 0, 22, COLORS.FIRE, 0.4);
    this.core = scene.add.circle(0, 0, 10, 0xffe6b8, 1.0);
    this.add([this.glow, this.core]);
    scene.physics.add.existing(this);
    this.body.setCircle(10, -10, -10);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.dmg = 0; this.element = null; this.lifeUntil = 0;
    this.behavior = 'straight';
    this.spawnX = 0; this.spawnY = 0;
    this.travelMs = 0;
  }

  fire(x, y, vx, vy, dmg, element, lifeMs = 2000, color = COLORS.FIRE, behavior = 'straight') {
    this.setPosition(x, y);
    this.spawnX = x; this.spawnY = y;
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.element = element;
    this.lifeUntil = this.scene.time.now + lifeMs;
    this.behavior = behavior;
    this.travelMs = 0;

    // Cor por elemento
    if (element === 'ice')      { this.glow.setFillStyle(COLORS.ICE, 0.45); this.core.setFillStyle(0xeaf6ff, 1); }
    else if (element === 'bolt'){ this.glow.setFillStyle(COLORS.BOLT, 0.45); this.core.setFillStyle(0xf5e6ff, 1); }
    else                        { this.glow.setFillStyle(color, 0.4);        this.core.setFillStyle(0xffe6b8, 1); }
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }

  update(time, dt) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
    const s = 1 + Math.sin(time / 60) * 0.12;
    this.glow.setScale(s);

    if (this.behavior === 'boomerang') {
      this.travelMs += dt;
      const totalMs = 1100;
      const t = this.travelMs / totalMs;
      if (t >= 1) { this.kill(); return; }
      // Trajetória vai-volta: nos primeiros 50% acelera pra frente, depois inverte
      if (t > 0.5) {
        // inverte gradualmente
        const owner = this.scene.player;
        const dx = owner.x - this.x, dy = owner.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = 320;
        this.body.setVelocity((dx / len) * sp, (dy / len) * sp);
      }
      this.rotation += dt * 0.02;
    }
  }
}

// ============================================================================
// Arma base
// ============================================================================

export class Weapon {
  constructor(scene, defKey) {
    this.scene = scene;
    this.def = WEAPONS[defKey];
    this.key = defKey;
    this.level = 1;
    this.lastFireAt = 0;
    this.owner = null;
  }
  get cooldown() { return this.def.cooldown * (this.owner?.cdMult ?? 1); }
  get damage()   { return WEAPON_LEVEL_DMG(this.def.baseDmg, this.level); }

  update(time, dt) {
    if (time - this.lastFireAt < this.cooldown) return;
    if (this._fire(time)) this.lastFireAt = time;
  }
  _fire() { return false; }

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

// ============================================================================
// Implementações
// ============================================================================

export class Staff extends Weapon {
  constructor(scene) { super(scene, 'STAFF'); }
  _fire() {
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

// AURA: dano contínuo em raio ao redor do player
export class AuraWeapon extends Weapon {
  constructor(scene) {
    super(scene, 'AURA');
    // Visual permanente (atualizado em update())
    this.gfx = scene.add.circle(0, 0, this.def.range, COLORS.ICE, 0.15)
                    .setStrokeStyle(2, COLORS.ICE, 0.5).setDepth(40);
  }
  get range() { return this.def.range * (this.owner?.areaMult ?? 1); }
  update(time, dt) {
    if (this.owner) { this.gfx.setPosition(this.owner.x, this.owner.y); this.gfx.setRadius(this.range); }
    super.update(time, dt);
  }
  _fire() {
    if (!this.owner) return false;
    const r2 = this.range * this.range;
    let hits = 0;
    this.scene.enemyPool.forEachActive(e => {
      const dx = e.x - this.owner.x, dy = e.y - this.owner.y;
      if (dx * dx + dy * dy <= r2) {
        const died = e.takeDamage(this.damage, null);
        this.scene.elemental.applyStatus(e, 'ice');
        if (died) this.scene._onEnemyDeath(e);
        hits++;
      }
    });
    return hits > 0; // se nao tem ninguem, nao "esfria" o cooldown
  }
}

export class Boomerang extends Weapon {
  constructor(scene) { super(scene, 'BOOMER'); }
  _fire() {
    const target = this._nearestEnemyInRange();
    if (!target) return false;
    const proj = this.scene.projectilePool.acquire();
    const dx = target.x - this.owner.x, dy = target.y - this.owner.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.def.projSpeed;
    proj.fire(this.owner.x, this.owner.y, (dx / len) * sp, (dy / len) * sp,
              this.damage, 'fire', 1200, COLORS.FIRE, 'boomerang');
    return true;
  }
}

// CHAIN: dispara raio que salta entre inimigos próximos
export class ChainLightning extends Weapon {
  constructor(scene) { super(scene, 'CHAIN'); }
  _fire() {
    const start = this._nearestEnemyInRange();
    if (!start) return false;
    const jumps = (this.def.jumps ?? 3) + (this.owner?.extraProj ?? 0);
    const visited = new Set();
    let prev = this.owner;
    let cur = start;
    const dmg = this.damage;
    for (let i = 0; i < jumps && cur; i++) {
      this.scene.elemental._drawBolt(prev.x, prev.y, cur.x, cur.y, COLORS.BOLT);
      const died = cur.takeDamage(dmg * (1 - i * 0.15), null);
      this.scene.elemental.applyStatus(cur, 'bolt');
      visited.add(cur);
      if (died) this.scene._onEnemyDeath(cur);
      // Próximo alvo: inimigo mais próximo de cur que ainda não foi atingido
      let next = null, bestSq = 220 * 220;
      this.scene.enemyPool.forEachActive(e => {
        if (visited.has(e)) return;
        const dx = e.x - cur.x, dy = e.y - cur.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) { bestSq = d2; next = e; }
      });
      prev = cur;
      cur = next;
    }
    return true;
  }
}

// Fábrica
export const WEAPON_CLASSES = {
  STAFF:  Staff,
  AURA:   AuraWeapon,
  BOOMER: Boomerang,
  CHAIN:  ChainLightning,
};
