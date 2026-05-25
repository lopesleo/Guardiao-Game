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
    this.dmg = 0; this.element = null; this.lifeUntil = 0; this.crit = false;
  }

  fire(x, y, vx, vy, dmg, element, lifeMs = 2000, color = COLORS.FIRE, crit = false) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.element = element;
    this.crit = crit;
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
    this.outSpeed = 520;
    this.decel = 320;
    this.deadline = 0;
    this.crit = false;
    this.lastHit = new Map();
  }

  fire(x, y, dirX, dirY, dmg, crit = false) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.dmg = dmg;
    this.crit = crit;
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
    // Modificadores acumulativos por upgrades (não só dano)
    this.dmgMult   = 1.0;   // +X% dano
    this.cdMult    = 1.0;   // -X% cooldown
    this.rangeMult = 1.0;   // +X% alcance
    this.extraProj = 0;     // +N projéteis (Staff, Chain)
  }
  get cooldown() {
    return this.def.cooldown * this.cdMult * (this.owner?.effectiveCdMult ?? this.owner?.cdMult ?? 1);
  }
  get damage() {
    return this.def.baseDmg * this.dmgMult * (this.owner?._blessingDmgMult ?? 1);
  }
  get range() { return (this.def.range ?? 9999) * this.rangeMult; }

  rollHit() {
    const base = this.damage;
    const isCrit = Math.random() < (this.owner?.critChance ?? 0);
    return { dmg: isCrit ? base * (this.owner?.critMult ?? 2) : base, crit: isCrit };
  }

  update(time, dt) {
    if (time - this.lastFireAt < this.cooldown) return;
    if (this._fire(time)) this.lastFireAt = time;
  }
  _fire() { return false; }

  _nearestEnemyInRange() {
    const range = this.range;
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

    const total = 1 + (this.owner?.extraProj ?? 0) + this.extraProj;
    const spread = 0.18;
    for (let i = 0; i < total; i++) {
      const offset = (i - (total - 1) / 2) * spread;
      const a = baseAng + offset;
      const proj = this.scene.projectilePool.acquire();
      const { dmg, crit } = this.rollHit();
      proj.fire(this.owner.x, this.owner.y,
                Math.cos(a) * sp, Math.sin(a) * sp,
                dmg, 'fire', 2000, COLORS.FIRE, crit);
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
  // AuraWeapon sobrescreve range pra incluir areaMult do player
  get range() { return this.def.range * this.rangeMult * (this.owner?.areaMult ?? 1); }
  update(time, dt) {
    if (this.owner) { this.gfx.setPosition(this.owner.x, this.owner.y); this.gfx.setRadius(this.range); }
    super.update(time, dt);
  }
  _fire() {
    if (!this.owner) return false;
    const now = this.scene.time.now;
    const r2 = this.range * this.range;
    const cd = this.cooldown;
    const freezeAfter = this.def.freezeAfterMs ?? 1000;
    let hits = 0;
    let froze = false;
    this.scene.enemyPool.forEachActive(e => {
      const dx = e.x - this.owner.x, dy = e.y - this.owner.y;
      if (dx * dx + dy * dy > r2) return;
      // Chip damage + chill (slow + amplificação) enquanto dentro do campo
      const { dmg, crit } = this.rollHit();
      const died = e.takeDamage(dmg, null, this.owner.x, this.owner.y, crit);
      this.owner.lifestealFrom(dmg);
      this.scene._showDmg(e.x, e.y, dmg, 'ice', crit);
      this.scene.elemental.applyStatus(e, 'ice');
      hits++;
      if (died) { this.scene._onEnemyDeath(e); return; }

      // CONGELAMENTO: quem fica ~1s dentro do campo congela (com janela de imunidade)
      if (now - e._auraLastSeen > cd * 1.7 || e._auraEnterAt === 0) e._auraEnterAt = now;
      e._auraLastSeen = now;
      const lingered = now - e._auraEnterAt >= freezeAfter;
      if (lingered && !e.isFrozen(now) && now >= e._freezeLockUntil) {
        e.freeze(now, this.def.freezeMs ?? 1300, this.def.freezeImmuneMs ?? 3000);
        this._iceStreak(this.owner.x, this.owner.y, e.x, e.y);
        froze = true;
      }
    });
    const boss = this.scene.boss;
    if (boss && boss.active) {
      const dx = boss.x - this.owner.x, dy = boss.y - this.owner.y;
      if (dx * dx + dy * dy <= r2) {
        const { dmg, crit } = this.rollHit();
        const died = boss.takeDamage(dmg, null, this.owner.x, this.owner.y, crit);
        this.owner.lifestealFrom(dmg);
        this.scene._showDmg(boss.x, boss.y, dmg, 'ice', crit);
        this.scene.elemental.applyStatus(boss, 'ice'); // boss só leva chill, não congela
        if (died) this.scene._onBossDeath();
        hits++;
      }
    }
    if (froze) this.scene.sound.play('sfx_ice_attack', { volume: 0.4 });
    return hits > 0;
  }

  // Lasca-losango voa do player até o alvo e o congela (estala de cristal ao chegar)
  _iceStreak(x1, y1, x2, y2) {
    const scene = this.scene;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const shard = scene.add
      .polygon(x1, y1, [12, 0, 0, -5, -8, 0, 0, 5], 0xeaf6ff, 1)
      .setStrokeStyle(1, 0x5cc8ff, 1)
      .setDepth(61)
      .setRotation(ang);
    scene.tweens.add({
      targets: shard, x: x2, y: y2,
      duration: 130, ease: "Quad.easeIn",
      onComplete: () => {
        shard.destroy();
        const star = scene.add.star(x2, y2, 6, 4, 13, 0xbfeaff, 0.9).setDepth(61);
        scene.tweens.add({
          targets: star, scaleX: 1.6, scaleY: 1.6, alpha: 0,
          duration: 280, onComplete: () => star.destroy(),
        });
      },
    });
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
    const { dmg, crit } = this.rollHit();
    proj.fire(this.owner.x, this.owner.y, dx / len, dy / len, dmg, crit);
    return true;
  }
}

// CHAIN: raio de dano ALTO focado em 1 alvo (o mais próximo).
// NÃO encadeia — a "corrente entre inimigos" agora é a reação Sobrecarga (fogo+raio).
// extraProj adiciona alvos INDEPENDENTES (multi-tiro), não saltos em cadeia.
export class ChainLightning extends Weapon {
  constructor(scene) { super(scene, 'CHAIN'); }
  _fire() {
    const targets = this._nearestTargets(1 + (this.owner?.extraProj ?? 0) + this.extraProj);
    if (!targets.length) return false;
    this.scene.sound.play('sfx_bolt_attack', { volume: 0.4 });
    const dmg = this.damage;
    for (const cur of targets) {
      this.scene.elemental._drawBolt(this.owner.x, this.owner.y, cur.x, cur.y, COLORS.BOLT);
      const isBoss = cur === this.scene.boss;
      const isCrit = Math.random() < (this.owner?.critChance ?? 0);
      const finalDmg = isCrit ? dmg * this.owner.critMult : dmg;
      const died = cur.takeDamage(finalDmg, isBoss ? undefined : null, this.owner.x, this.owner.y, isCrit);
      this.owner.lifestealFrom(finalDmg);
      this.scene._showDmg(cur.x, cur.y, finalDmg, 'bolt', isCrit);
      this.scene.elemental.applyStatus(cur, 'bolt');
      if (died) {
        if (isBoss) this.scene._onBossDeath();
        else this.scene._onEnemyDeath(cur);
      }
    }
    return true;
  }

  // Retorna até `n` inimigos mais próximos dentro do alcance (inclui boss).
  _nearestTargets(n) {
    const range = this.range, rangeSq = range * range;
    const list = [];
    this.scene.enemyPool.forEachActive(e => {
      if (!e.active) return;
      const dx = e.x - this.owner.x, dy = e.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rangeSq) list.push({ e, d2 });
    });
    const boss = this.scene.boss;
    if (boss && boss.active) {
      const dx = boss.x - this.owner.x, dy = boss.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rangeSq) list.push({ e: boss, d2 });
    }
    list.sort((a, b) => a.d2 - b.d2);
    return list.slice(0, n).map(o => o.e);
  }
}

// Fábrica
export const WEAPON_CLASSES = {
  STAFF:  Staff,
  AURA:   AuraWeapon,
  BOOMER: Boomerang,
  CHAIN:  ChainLightning,
};
