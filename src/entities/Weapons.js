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
  }

  fire(x, y, vx, vy, dmg, element, lifeMs = 2000, color = COLORS.FIRE) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.element = element;
    this.lifeUntil = this.scene.time.now + lifeMs;

    if (element === 'ice')      { this.glow.setFillStyle(COLORS.ICE, 0.45); this.core.setFillStyle(0xeaf6ff, 1); }
    else if (element === 'bolt'){ this.glow.setFillStyle(COLORS.BOLT, 0.45); this.core.setFillStyle(0xf5e6ff, 1); }
    else                        { this.glow.setFillStyle(color, 0.4);        this.core.setFillStyle(0xffe6b8, 1); }
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }

  update(time) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
    const s = 1 + Math.sin(time / 60) * 0.12;
    this.glow.setScale(s);
  }
}

// ============================================================================
// BoomerangProj — visual de "L" girando, fase out + retorno até tocar o player
// ============================================================================

export class BoomerangProj extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    // Forma de L: 2 retângulos perpendiculares, com bordas escuras
    const w = 4, l = 18;
    this.armA = scene.add.rectangle(-2, 0, l, w, COLORS.FIRE).setStrokeStyle(1, 0x6a3010, 1);
    this.armB = scene.add.rectangle(0, -2, w, l, COLORS.FIRE).setStrokeStyle(1, 0x6a3010, 1);
    // Glow externo discreto
    this.glow = scene.add.circle(0, 0, 14, COLORS.FIRE, 0.25);
    this.add([this.glow, this.armA, this.armB]);

    scene.physics.add.existing(this);
    this.body.setCircle(12, -12, -12);
    this.setActive(false).setVisible(false);
    this.body.enable = false;

    this.dmg = 0;
    this.element = 'fire';
    this.behavior = 'boomerang';
    this.phase = 'out';
    this.outSpeed = 520;     // alcance maior (era 320)
    this.decel = 320;        // desacelera mais devagar (era 600)
    this.deadline = 0;
    this.lastHit = new Map();
  }

  fire(x, y, dirX, dirY, dmg) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.dmg = dmg;
    this.phase = 'out';
    // Alcance escala com passiva de Area do player
    const areaMult = this.scene.player?.areaMult ?? 1;
    const sp = this.outSpeed * Math.sqrt(areaMult);
    this.deadline = this.scene.time.now + 3800;
    this.body.setVelocity(dirX * sp, dirY * sp);
    this.lastHit.clear();
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }

  // Re-hit no mesmo inimigo só depois de 250ms (passada de ida + volta)
  canHit(enemy, time) {
    const last = this.lastHit.get(enemy) ?? 0;
    if (time - last < 250) return false;
    this.lastHit.set(enemy, time);
    return true;
  }

  update(time, dt) {
    if (!this.active) return;
    // Rotação visual
    this.rotation += dt * 0.03;

    const owner = this.scene.player;
    if (!owner) { this.kill(); return; }

    if (this.phase === 'out') {
      const vx = this.body.velocity.x, vy = this.body.velocity.y;
      const speed = Math.hypot(vx, vy);
      if (speed > 0) {
        const d = this.decel * (dt / 1000);
        const newSp = Math.max(0, speed - d);
        this.body.setVelocity((vx / speed) * newSp, (vy / speed) * newSp);
      }
      if (speed < 80) this.phase = 'back';
    } else {
      // Persegue player com aceleração crescente
      const dx = owner.x - this.x, dy = owner.y - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      const sp = Math.min(520, 240 + (this.scene.time.now - (this.deadline - 2200)) * 0.25);
      this.body.setVelocity((dx / d) * sp, (dy / d) * sp);
      // Tocou no player → morre
      if (d < 26) this.kill();
    }

    if (time >= this.deadline) this.kill();
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
  get cooldown() { return this.def.cooldown * (this.owner?.effectiveCdMult ?? this.owner?.cdMult ?? 1); }
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
    // Inimigos normais
    this.scene.enemyPool.forEachActive(e => {
      if (!e.active) return;
      const dx = e.x - this.owner.x, dy = e.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq && d2 <= rangeSq) { bestSq = d2; best = e; }
    });
    // Boss (não está no pool — checado separado)
    const boss = this.scene.boss;
    if (boss && boss.active) {
      const dx = boss.x - this.owner.x, dy = boss.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq && d2 <= rangeSq) { bestSq = d2; best = boss; }
    }
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
    const dx = target.x - this.owner.x, dy = target.y - this.owner.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.def.projSpeed;
    const baseAng = Math.atan2(dy, dx);

    // 1 projétil + extraProj (passiva +Projétil) com leve spread
    const total = 1 + (this.owner?.extraProj ?? 0);
    const spread = 0.18; // ~10 graus por projétil extra
    for (let i = 0; i < total; i++) {
      const offset = (i - (total - 1) / 2) * spread;
      const a = baseAng + offset;
      const proj = this.scene.projectilePool.acquire();
      proj.fire(this.owner.x, this.owner.y,
                Math.cos(a) * sp, Math.sin(a) * sp,
                this.damage, 'fire', 2000, COLORS.FIRE);
    }
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
    // Boss também sofre da aura
    const boss = this.scene.boss;
    if (boss && boss.active) {
      const dx = boss.x - this.owner.x, dy = boss.y - this.owner.y;
      if (dx * dx + dy * dy <= r2) {
        const died = boss.takeDamage(this.damage);
        this.scene.elemental.applyStatus(boss, 'ice');
        if (died) this.scene._onBossDeath();
        hits++;
      }
    }
    return hits > 0;
  }
}

export class Boomerang extends Weapon {
  constructor(scene) { super(scene, 'BOOMER'); }
  _fire() {
    const target = this._nearestEnemyInRange();
    if (!target) return false;
    const proj = this.scene.boomerPool.acquire();
    const dx = target.x - this.owner.x, dy = target.y - this.owner.y;
    const len = Math.hypot(dx, dy) || 1;
    proj.fire(this.owner.x, this.owner.y, dx / len, dy / len, this.damage);
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
    const areaMult = this.owner?.areaMult ?? 1;
    const jumpMaxSq = (220 * areaMult) * (220 * areaMult);
    const visited = new Set();
    let prev = this.owner;
    let cur = start;
    const dmg = this.damage;
    for (let i = 0; i < jumps && cur; i++) {
      this.scene.elemental._drawBolt(prev.x, prev.y, cur.x, cur.y, COLORS.BOLT);
      const isBoss = cur === this.scene.boss;
      const died = cur.takeDamage(dmg * (1 - i * 0.15), isBoss ? undefined : null);
      this.scene.elemental.applyStatus(cur, 'bolt');
      visited.add(cur);
      if (died) {
        if (isBoss) this.scene._onBossDeath();
        else this.scene._onEnemyDeath(cur);
      }
      // Próximo alvo: enemies do pool OU boss (se ainda não visitado)
      let next = null, bestSq = jumpMaxSq;
      this.scene.enemyPool.forEachActive(e => {
        if (visited.has(e)) return;
        const dx = e.x - cur.x, dy = e.y - cur.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) { bestSq = d2; next = e; }
      });
      const boss = this.scene.boss;
      if (boss && boss.active && !visited.has(boss)) {
        const dx = boss.x - cur.x, dy = boss.y - cur.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) { bestSq = d2; next = boss; }
      }
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
