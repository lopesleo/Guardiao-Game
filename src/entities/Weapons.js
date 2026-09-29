// Armas: Staff(🔥), Aura(❄️), Boomerang(🔥), ChainLightning(⚡) + evoluções (D3).
import { WEAPONS, COLORS, GAME, ELEMENT } from "../config.js";

// ============================================================================
// Projétil reutilizável (graphics container)
// ============================================================================

export class Projectile extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    // Brilho aditivo (luz) + núcleo pixelado; fogo usa a bola de fogo animada
    this.glow = scene.add
      .image(0, 0, "fx_glow")
      .setScale(0.8)
      .setTint(COLORS.FIRE)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.core = scene.add.image(0, 0, "px_puff").setScale(2.4);
    this.fball = scene.add.sprite(0, 0, "fireball").setScale(1.1);
    this.add([this.glow, this.core, this.fball]);
    scene.physics.add.existing(this);
    this.body.setCircle(10, -10, -10);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.dmg = 0;
    this.element = null;
    this.lifeUntil = 0;
    this.crit = false;
    this._isFire = false;
    this.onImpact = null; // hook das evoluções (ex.: nuvem da Tempestade de Vapor)
  }

  fire(
    x,
    y,
    vx,
    vy,
    dmg,
    element,
    lifeMs = 2000,
    color = COLORS.FIRE,
    crit = false,
  ) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.element = element;
    this.crit = crit;
    this.lifeUntil = this.scene.time.now + lifeMs;
    this.onImpact = null; // projétil pooled — reseta o hook a cada disparo

    // Fogo (e genérico) = sprite de bola de fogo; gelo/raio = bolinha colorida
    this._isFire = element === ELEMENT.FIRE || element == null;
    this.fball.setVisible(this._isFire);
    this.core.setVisible(!this._isFire);
    if (this._isFire) {
      this.fball.setRotation(Math.atan2(vy, vx));
      this.glow.setTint(COLORS.FIRE);
    } else if (element === ELEMENT.ICE) {
      this.glow.setTint(COLORS.ICE);
      this.core.setTint(0xeaf6ff);
    } else if (element === ELEMENT.BOLT) {
      this.glow.setTint(COLORS.BOLT);
      this.core.setTint(0xf5e6ff);
    } else {
      this.glow.setTint(color);
      this.core.setTint(0xffe6b8);
    }
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }

  update(time) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
    if (this._isFire) {
      this.fball.setFrame(((time / 90) | 0) % 2);

      this.fball.setRotation(
        Math.atan2(this.body.velocity.y, this.body.velocity.x),
      );
    }
    this.glow.setScale(0.8 + Math.sin(time / 60) * 0.08);
  }
}

// ============================================================================
// BoomerangProj — visual de "L" girando, fase out + retorno até tocar o player
// ============================================================================

export class BoomerangProj extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    // Bumerangue de madeira com fio em brasa (pixel-art) + brilho quente
    this.glow = scene.add
      .image(0, 0, "fx_glow")
      .setScale(0.7)
      .setTint(COLORS.FIRE)
      .setAlpha(0.45)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.spr = scene.add.image(0, 0, "px_boomer").setScale(GAME.PIXEL_SCALE);
    this.add([this.glow, this.spr]);

    scene.physics.add.existing(this);
    this.body.setCircle(12, -12, -12);
    this.setActive(false).setVisible(false);
    this.body.enable = false;

    this.dmg = 0;
    this.element = ELEMENT.FIRE;
    this.behavior = "boomerang";
    this.phase = "out";
    this.outSpeed = 520;
    this.decel = 320;
    this.deadline = 0;
    this.crit = false;
    this.lastHit = new Map();
    // Rastro (evolução Fênix): callback que solta zonas de fogo pelo caminho
    this.trailFn = null;
    this.trailIntervalMs = 150;
    this._nextTrailAt = 0;
  }

  fire(x, y, dirX, dirY, dmg, crit = false) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.dmg = dmg;
    this.crit = crit;
    this.phase = "out";
    this.trailFn = null; // pooled — reseta o rastro a cada disparo
    this._nextTrailAt = 0;
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

    // Rastro de chamas (Fênix)
    if (this.trailFn && time >= this._nextTrailAt) {
      this._nextTrailAt = time + this.trailIntervalMs;
      this.trailFn(this.x, this.y);
    }

    const owner = this.scene.player;
    if (!owner) {
      this.kill();
      return;
    }

    if (this.phase === "out") {
      const vx = this.body.velocity.x,
        vy = this.body.velocity.y;
      const speed = Math.hypot(vx, vy);
      if (speed > 0) {
        const d = this.decel * (dt / 1000);
        const newSp = Math.max(0, speed - d);
        this.body.setVelocity((vx / speed) * newSp, (vy / speed) * newSp);
      }
      if (speed < 80) this.phase = "back";
    } else {
      // Persegue player com aceleração crescente
      const dx = owner.x - this.x,
        dy = owner.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(
        520,
        240 + (this.scene.time.now - (this.deadline - 2200)) * 0.25,
      );
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
    this.dmgMult = 1.0; // +X% dano
    this.cdMult = 1.0; // -X% cooldown
    this.rangeMult = 1.0; // +X% alcance
    this.extraProj = 0; // +N projéteis (Staff, Chain)
  }
  get cooldown() {
    const raw =
      this.def.cooldown *
      this.cdMult *
      (this.owner?.effectiveCdMult ?? this.owner?.cdMult ?? 1);
    // Piso: recarga nunca abaixo de 22% da base. Sem isso, cdMult do player ×
    // cdMult da arma × 0.4 do Despertar empilhavam até ~42ms (fire-rate degenerado).
    return Math.max(this.def.cooldown * 0.22, raw);
  }
  get damage() {
    return (
      this.def.baseDmg * this.dmgMult * (this.owner?._blessingDmgMult ?? 1)
    );
  }
  get range() {
    return (this.def.range ?? 9999) * this.rangeMult;
  }

  rollHit() {
    const base = this.damage;
    const isCrit = Math.random() < (this.owner?.critChance ?? 0);
    return {
      dmg: isCrit ? base * (this.owner?.critMult ?? 2) : base,
      crit: isCrit,
    };
  }

  update(time, dt) {
    if (time - this.lastFireAt < this.cooldown) return;
    if (this._fire(time)) this.lastFireAt = time;
  }
  _fire() {
    return false;
  }

  // Limpeza ao ser SUBSTITUÍDA por uma evolução (armas com gfx persistente
  // sobrescrevem — ex.: círculo da Aura).
  dispose() {}

  _nearestEnemyInRange() {
    const range = this.range;
    const rangeSq = range * range;
    let best = null,
      bestSq = Infinity;
    // Inimigos normais
    this.scene.enemyPool.forEachActive((e) => {
      if (!e.active) return;
      const dx = e.x - this.owner.x,
        dy = e.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq && d2 <= rangeSq) {
        bestSq = d2;
        best = e;
      }
    });
    // Boss (não está no pool — checado separado)
    const boss = this.scene.boss;
    if (boss && boss.active) {
      const dx = boss.x - this.owner.x,
        dy = boss.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq && d2 <= rangeSq) {
        bestSq = d2;
        best = boss;
      }
    }
    return best;
  }
}

// ============================================================================
// Implementações
// ============================================================================

export class Staff extends Weapon {
  // defKey parametrizado pra evolução (Tempestade de Vapor) reusar o disparo
  constructor(scene, defKey = "STAFF") {
    super(scene, defKey);
  }
  _fire() {
    const target = this._nearestEnemyInRange();
    if (!target) return false;
    this.scene.sound.play("sfx_fire_attack", { volume: 0.3 });
    const dx = target.x - this.owner.x,
      dy = target.y - this.owner.y;
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
      proj.fire(
        this.owner.x,
        this.owner.y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        dmg,
        ELEMENT.FIRE,
        2000,
        COLORS.FIRE,
        crit,
      );
      // Hook das evoluções (ex.: Tempestade de Vapor seta onImpact)
      this._decorateProj?.(proj);
    }
    return true;
  }
}

// AURA: dano contínuo em raio ao redor do player
export class AuraWeapon extends Weapon {
  // defKey parametrizado pra evolução (Coração do Inverno) reusar o campo
  constructor(scene, defKey = "AURA") {
    super(scene, defKey);
    // Visual permanente: névoa fria aditiva + anel de cristais girando
    this.gfx = scene.add
      .image(0, 0, "fx_glow")
      .setTint(COLORS.ICE)
      .setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(40);
    this.ring = scene.add.graphics().setDepth(41);
    this._ringStrong = false;
  }
  dispose() {
    this.gfx.destroy();
    this.ring.destroy();
  }
  // Anel pontilhado em "pixels" (quadrados de 3px) que gira devagar
  _drawRing(time) {
    const g = this.ring;
    const r = this.range;
    g.clear();
    const n = Math.max(18, Math.round(r / 7));
    const rot = time / 2600;
    for (let i = 0; i < n; i++) {
      if (i % 3 === 2) continue; // tracejado
      const a = rot + (i / n) * Math.PI * 2;
      const x = Math.round((this.owner.x + Math.cos(a) * r) / 3) * 3;
      const y = Math.round((this.owner.y + Math.sin(a) * r) / 3) * 3;
      g.fillStyle(i % 3 === 0 ? 0xbfeaff : 0x5cc8ff, this._ringStrong ? 0.95 : 0.7);
      g.fillRect(x - 1, y - 1, 3, 3);
    }
  }
  // AuraWeapon sobrescreve range pra incluir areaMult do player
  get range() {
    return this.def.range * this.rangeMult * (this.owner?.areaMult ?? 1);
  }
  update(time, dt) {
    if (this.owner) {
      this.gfx.setPosition(this.owner.x, this.owner.y);
      this.gfx.setScale((this.range * 2.3) / 64);
      this._drawRing(time);
    }
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
    this.scene.enemyPool.forEachActive((e) => {
      const dx = e.x - this.owner.x,
        dy = e.y - this.owner.y;
      if (dx * dx + dy * dy > r2) return;
      // Chip damage + chill (slow + amplificação) enquanto dentro do campo
      const { dmg, crit } = this.rollHit();
      const died = e.takeDamage(dmg, null, this.owner.x, this.owner.y, crit);
      this.owner.lifestealFrom(dmg);
      this.scene._showDmg(e.x, e.y, dmg, ELEMENT.ICE, crit);
      this.scene.elemental.applyStatus(e, ELEMENT.ICE);
      hits++;
      if (died) {
        this.scene._onEnemyDeath(e);
        return;
      }

      // CONGELAMENTO: quem fica ~1s dentro do campo congela (com janela de imunidade)
      if (now - e._auraLastSeen > cd * 1.7 || e._auraEnterAt === 0)
        e._auraEnterAt = now;
      e._auraLastSeen = now;
      const lingered = now - e._auraEnterAt >= freezeAfter;
      if (lingered && !e.isFrozen(now) && now >= e._freezeLockUntil) {
        e.freeze(
          now,
          this.def.freezeMs ?? 1300,
          this.def.freezeImmuneMs ?? 3000,
        );
        this._iceStreak(this.owner.x, this.owner.y, e.x, e.y);
        froze = true;
      }
    });
    const boss = this.scene.boss;
    if (boss && boss.active) {
      const dx = boss.x - this.owner.x,
        dy = boss.y - this.owner.y;
      if (dx * dx + dy * dy <= r2) {
        const { dmg, crit } = this.rollHit();
        const died = boss.takeDamage(
          dmg,
          null,
          this.owner.x,
          this.owner.y,
          crit,
        );
        this.owner.lifestealFrom(dmg);
        this.scene._showDmg(boss.x, boss.y, dmg, ELEMENT.ICE, crit);
        this.scene.elemental.applyStatus(boss, ELEMENT.ICE); // boss só leva chill, não congela
        if (died) this.scene._onBossDeath();
        hits++;
      }
    }
    if (froze) this.scene.sound.play("sfx_ice_attack", { volume: 0.4 });
    return hits > 0;
  }

  // Lasca-losango voa do player até o alvo e o congela (estala de cristal ao chegar)
  _iceStreak(x1, y1, x2, y2) {
    const scene = this.scene;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const shard = scene.add
      .image(x1, y1, "px_shard")
        .setScale(GAME.PIXEL_SCALE)
      .setDepth(61)
      .setRotation(ang);
    scene.tweens.add({
      targets: shard,
      x: x2,
      y: y2,
      duration: 130,
      ease: "Quad.easeIn",
      onComplete: () => {
        shard.destroy();
        const star = scene.add
          .star(x2, y2, 6, 4, 13, 0xbfeaff, 0.9)
          .setDepth(61);
        scene.tweens.add({
          targets: star,
          scaleX: 1.6,
          scaleY: 1.6,
          alpha: 0,
          duration: 280,
          onComplete: () => star.destroy(),
        });
      },
    });
  }
}

export class Boomerang extends Weapon {
  // defKey parametrizado pra evolução (Fênix) reusar o voo
  constructor(scene, defKey = "BOOMER") {
    super(scene, defKey);
  }
  _fire() {
    const target = this._nearestEnemyInRange();
    if (!target) return false;
    const proj = this.scene.boomerPool.acquire();
    const dx = target.x - this.owner.x,
      dy = target.y - this.owner.y;
    const len = Math.hypot(dx, dy) || 1;
    const { dmg, crit } = this.rollHit();
    proj.fire(this.owner.x, this.owner.y, dx / len, dy / len, dmg, crit);
    // Hook das evoluções (Fênix seta o rastro de chamas)
    this._decorateProj?.(proj);
    return true;
  }
}

// CHAIN: raio de dano ALTO focado em 1 alvo (o mais próximo).
// NÃO encadeia — a "corrente entre inimigos" agora é a reação Sobrecarga (fogo+raio).
// extraProj adiciona alvos INDEPENDENTES (multi-tiro), não saltos em cadeia.
export class ChainLightning extends Weapon {
  // defKey parametrizado pra evolução (Sobrecarga Eterna) reusar a priorização
  constructor(scene, defKey = "CHAIN") {
    super(scene, defKey);
  }
  _fire() {
    const targets = this._priorityTargets(
      1 + (this.owner?.extraProj ?? 0) + this.extraProj,
    );
    if (!targets.length) return false;
    this.scene.sound.play("sfx_bolt_attack", { volume: 0.4 });
    const dmg = this.damage;
    for (const cur of targets) {
      this.scene.elemental._drawBolt(
        this.owner.x,
        this.owner.y,
        cur.x,
        cur.y,
        COLORS.BOLT,
      );
      const isBoss = cur === this.scene.boss;
      const isCrit = Math.random() < (this.owner?.critChance ?? 0);
      const finalDmg = isCrit ? dmg * this.owner.critMult : dmg;
      const died = cur.takeDamage(
        finalDmg,
        isBoss ? undefined : null,
        this.owner.x,
        this.owner.y,
        isCrit,
      );
      this.owner.lifestealFrom(finalDmg);
      this.scene._showDmg(cur.x, cur.y, finalDmg, ELEMENT.BOLT, isCrit);
      this.scene.elemental.applyStatus(cur, ELEMENT.BOLT);
      if (died) {
        if (isBoss) this.scene._onBossDeath();
        else this.scene._onEnemyDeath(cur);
      }
    }
    return true;
  }

  // Até `n` alvos no alcance, PRIORIZANDO inimigos já afetados por outros efeitos
  // (congelado → Cristal, fogo → Sobrecarga, qualquer status > nada). Empate = mais próximo.
  _priorityTargets(n) {
    const now = this.scene.time.now;
    const range = this.range,
      rangeSq = range * range;
    const list = [];
    const consider = (e) => {
      const dx = e.x - this.owner.x,
        dy = e.y - this.owner.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rangeSq) list.push({ e, d2, prio: this._affinity(e, now) });
    };
    this.scene.enemyPool.forEachActive((e) => {
      if (e.active) consider(e);
    });
    const boss = this.scene.boss;
    if (boss && boss.active) consider(boss);
    // prioridade desc, depois distância asc
    list.sort((a, b) => b.prio - a.prio || a.d2 - b.d2);
    return list.slice(0, n).map((o) => o.e);
  }

  // Quanto o Raio "quer" acertar este alvo (gera reação ou aproveita controle)
  _affinity(e, now) {
    if (e.isFrozen?.(now)) return 3; // congelado + raio → CRISTAL (estilhaça)
    const s = e.statuses || {};
    if (s.fire) return 2; // fogo + raio → SOBRECARGA
    if (s.ice || s.bolt) return 1; // já afetado por algum status
    return 0;
  }
}

// ============================================================================
// EVOLUÇÕES (Fase 4) — âncora Lv5 + parceira na run. Substituem a arma base
// herdando os multiplicadores; nível fixo em MAX (somem das cartas de upgrade).
// `baseKey` liga a evolução à âncora (conquistas de "arma no Lv5").
// ============================================================================

// TEMPESTADE DE VAPOR (Cajado+Aura): cada projétil explode em nuvem escaldante
// no impacto — reusa a mecânica de DoT em área da reação Vapor.
export class VaporStorm extends Staff {
  constructor(scene) {
    super(scene, "VAPOR_STORM");
    this.baseKey = this.def.evolvesFrom;
  }
  _decorateProj(proj) {
    proj.onImpact = (x, y) => {
      const c = this.def.cloud;
      this.scene.elemental._vapor({ x, y }, c, this.owner?.areaMult ?? 1);
    };
  }
}

// SOBRECARGA ETERNA (Raio+Cajado): o raio ENCADEIA — alvo prioritário e depois
// salta pros vizinhos com dano decrescente, aplicando bolt em cada um.
export class OverloadX extends ChainLightning {
  constructor(scene) {
    super(scene, "OVERLOAD_X");
    this.baseKey = this.def.evolvesFrom;
  }
  _fire() {
    const first = this._priorityTargets(1)[0];
    if (!first) return false;
    this.scene.sound.play("sfx_bolt_attack", { volume: 0.45, rate: 0.9 });
    const jumpR = this.def.jumpRange * (this.owner?.areaMult ?? 1);
    const jumpRSq = jumpR * jumpR;
    const visited = new Set();
    let prev = this.owner,
      cur = first,
      dmg = this.damage;
    for (let i = 0; i <= this.def.jumps && cur; i++) {
      this.scene.elemental._drawBolt(prev.x, prev.y, cur.x, cur.y, COLORS.BOLT, 4);
      const isBoss = cur === this.scene.boss;
      const isCrit = Math.random() < (this.owner?.critChance ?? 0);
      const finalDmg = isCrit ? dmg * this.owner.critMult : dmg;
      const died = cur.takeDamage(
        finalDmg,
        isBoss ? undefined : null,
        this.owner.x,
        this.owner.y,
        isCrit,
      );
      this.owner.lifestealFrom(finalDmg);
      this.scene._showDmg(cur.x, cur.y, finalDmg, ELEMENT.BOLT, isCrit);
      this.scene.elemental.applyStatus(cur, ELEMENT.BOLT);
      if (died) {
        if (isBoss) this.scene._onBossDeath();
        else this.scene._onEnemyDeath(cur);
      }
      visited.add(cur);
      // Próximo salto: inimigo mais próximo do elo atual, ainda não atingido
      let next = null,
        bestSq = jumpRSq;
      this.scene.enemyPool.forEachActive((e) => {
        if (!e.active || visited.has(e)) return;
        const dx = e.x - cur.x,
          dy = e.y - cur.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) {
          bestSq = d2;
          next = e;
        }
      });
      prev = cur;
      cur = next;
      dmg *= this.def.falloff;
    }
    return true;
  }
}

// CORAÇÃO DO INVERNO (Aura+Raio): mantém o campo congelante e ganha uma NOVA
// periódica de estilhaços — dano + gelo num raio bem maior (gelo ofensivo).
export class WinterHeart extends AuraWeapon {
  constructor(scene) {
    super(scene, "WINTER_HEART");
    this.baseKey = this.def.evolvesFrom;
    this._ringStrong = true; // campo mais marcado
    this._nextNovaAt = 0;
  }
  update(time, dt) {
    super.update(time, dt);
    if (this.owner && time >= this._nextNovaAt) {
      this._nextNovaAt = time + this.def.nova.everyMs;
      this._nova();
    }
  }
  _nova() {
    const scene = this.scene;
    const cx = this.owner.x,
      cy = this.owner.y;
    const r = this.range * this.def.nova.radiusMult;
    const rSq = r * r;
    const dmgBase =
      this.def.nova.dmg * this.dmgMult * (this.owner?._blessingDmgMult ?? 1);
    let hits = 0;
    const strike = (t, isBoss) => {
      const dx = t.x - cx,
        dy = t.y - cy;
      if (dx * dx + dy * dy > rSq) return;
      const isCrit = Math.random() < (this.owner?.critChance ?? 0);
      const dmg = isCrit ? dmgBase * this.owner.critMult : dmgBase;
      const died = t.takeDamage(dmg, isBoss ? undefined : null, cx, cy, isCrit);
      this.owner.lifestealFrom(dmg);
      scene._showDmg(t.x, t.y, dmg, ELEMENT.ICE, isCrit);
      scene.elemental.applyStatus(t, ELEMENT.ICE);
      hits++;
      if (died) {
        if (isBoss) scene._onBossDeath();
        else scene._onEnemyDeath(t);
      }
    };
    scene.enemyPool.forEachActive((e) => {
      if (e.active) strike(e, false);
    });
    if (scene.boss?.active) strike(scene.boss, true);

    // Visual: anel expansivo + estilhaços voando pra fora (mesmo estilo do Cristal)
    if (hits > 0) scene.sound.play("sfx_ice_attack", { volume: 0.35, rate: 1.1 });
    const ring = scene.add
      .circle(cx, cy, this.range, COLORS.ICE, 0)
      .setStrokeStyle(3, 0xbfeaff, 0.9)
      .setDepth(60);
    scene.tweens.add({
      targets: ring,
      radius: r,
      alpha: 0,
      duration: 380,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    const n = this.def.nova.shards;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const shard = scene.add
        .image(cx, cy, "px_shard")
        .setScale(GAME.PIXEL_SCALE)
        .setDepth(61)
        .setRotation(ang);
      scene.tweens.add({
        targets: shard,
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r,
        alpha: 0,
        duration: 340,
        ease: "Cubic.easeOut",
        onComplete: () => shard.destroy(),
      });
    }
  }
}

// FÊNIX (Bumerangue+Cajado): o bumerangue deixa um rastro de zonas de fogo que
// queimam (dano + status fire) quem cruza o caminho de ida E de volta.
export class Phoenix extends Boomerang {
  constructor(scene) {
    super(scene, "PHOENIX");
    this.baseKey = this.def.evolvesFrom;
  }
  _decorateProj(proj) {
    proj.trailIntervalMs = this.def.trail.everyMs;
    proj.trailFn = (x, y) => this._firePatch(x, y);
  }
  _firePatch(x, y) {
    const scene = this.scene;
    const t = this.def.trail;
    const r = t.radius * (this.owner?.areaMult ?? 1);
    const rSq = r * r;
    const dmg = t.dmgPerTick * this.dmgMult * (this.owner?._blessingDmgMult ?? 1);
    const life = t.ticks * t.tickMs;
    // Visual: mancha de chama que encolhe até sumir
    const patch = scene.add.circle(x, y, r, COLORS.FIRE, 0.28).setDepth(45);
    scene.tweens.add({
      targets: patch,
      alpha: 0,
      scale: 0.5,
      duration: life,
      onComplete: () => patch.destroy(),
    });
    // Dano em ticks (sem número flutuante — mesmo padrão do DoT do Vapor)
    const burn = () => {
      scene.enemyPool.forEachActive((e) => {
        const dx = e.x - x,
          dy = e.y - y;
        if (dx * dx + dy * dy > rSq) return;
        const died = e.takeDamage(dmg, null);
        scene.elemental.applyStatus(e, ELEMENT.FIRE);
        if (died) scene._onEnemyDeath(e);
      });
      if (scene.boss?.active) {
        const dx = scene.boss.x - x,
          dy = scene.boss.y - y;
        if (dx * dx + dy * dy <= rSq) {
          const died = scene.boss.takeDamage(dmg);
          scene.elemental.applyStatus(scene.boss, ELEMENT.FIRE);
          if (died) scene._onBossDeath();
        }
      }
    };
    scene.time.addEvent({ delay: t.tickMs, repeat: t.ticks - 1, callback: burn });
  }
}

// Fábrica
export const WEAPON_CLASSES = {
  STAFF: Staff,
  AURA: AuraWeapon,
  BOOMER: Boomerang,
  CHAIN: ChainLightning,
  // evoluções
  VAPOR_STORM: VaporStorm,
  OVERLOAD_X: OverloadX,
  WINTER_HEART: WinterHeart,
  PHOENIX: Phoenix,
};
