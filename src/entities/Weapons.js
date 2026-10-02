// Armas: 3 de fogo, 3 de gelo, 3 de raio + evoluções. Números em WEAPONS (config.js).
import { WEAPONS, COLORS, GAME, ELEMENT } from "../config.js";
import { shockwave } from "../art/Telegraph.js";
import { Pix } from "../art/PixelArt.js";
import { PAL } from "../art/Palette.js";

// Anel do campo gélido como TEXTURA (uma por raio, em cache): um Graphics
// redesenhado todo quadro com centenas de retângulos sumia no Phaser 4 (WebGL).
// Imagem girando é mais barata e sempre aparece. strong = Coração do Inverno.
function auraRingTexture(scene, r, strong) {
  const R = Math.round(r);
  const key = `fx_aura_ring_${R}_${strong ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const S = R * 2 + 10,
    c = S / 2;
  const p = new Pix(S, S);
  const dot = (x, y, rgb, size = 2) => {
    const px = Math.round(x / size) * size,
      py = Math.round(y / size) * size;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) p.set(px + i, py + j, rgb);
  };
  const step = 0.8 / R; // ~1 px de arco por passo: linha CONTÍNUA (antes: 18 pontos soltos)
  // Contorno escuro por fora: separa o anel da grama
  for (let a = 0; a < Math.PI * 2; a += step) dot(c + Math.cos(a) * (R + 2), c + Math.sin(a) * (R + 2), PAL.ice0);
  // Linha base
  for (let a = 0; a < Math.PI * 2; a += step) dot(c + Math.cos(a) * R, c + Math.sin(a) * R, PAL.ice1);
  // Arcos claros (6 ou 8) com ponta branca — a imagem gira, então "correm" pelo anel
  const arcs = strong ? 8 : 6,
    len = 0.32;
  for (let k = 0; k < arcs; k++) {
    const a0 = (k / arcs) * Math.PI * 2;
    for (let a = a0; a < a0 + len; a += step) {
      const t = (a - a0) / len;
      dot(c + Math.cos(a) * R, c + Math.sin(a) * R, t > 0.82 ? PAL.white : t > 0.4 ? PAL.ice3 : PAL.ice2);
    }
  }
  // Pontilhado interno (geada no chão), bem discreto
  for (let a = 0; a < Math.PI * 2; a += 9 / R) dot(c + Math.cos(a) * (R - 7), c + Math.sin(a) * (R - 7), PAL.ice1);
  p.register(scene, key);
  return key;
}
function auraCrystalTexture(scene) {
  if (scene.textures.exists("fx_aura_crystal")) return "fx_aura_crystal";
  Pix.fromMap(["...k...", "..kbk..", ".kbcbk.", "kbcwcbk", ".kbcbk.", "..kbk..", "...k..."], {
    k: PAL.ice1,
    b: PAL.ice2,
    c: PAL.ice3,
    w: PAL.white,
  }).register(scene, "fx_aura_crystal");
  return "fx_aura_crystal";
}

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
    // Bola de fogo própria (cabeça à direita do quadro → origem no núcleo)
    this.fball = scene.add.sprite(0, 0, "px_fireball").setScale(2.6).setOrigin(0.72, 0.5).play("fireball_fly");
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
    // Cauda nasce ATRÁS do projétil (na frente, cobria o sprite de branco)
    const v = this.body.velocity,
      vl = Math.hypot(v.x, v.y) || 1;
    this.scene.fx?.trail(this, this.x - (v.x / vl) * 9, this.y - (v.y / vl) * 9, this.element ?? "fire", 14);
    if (this._isFire) {

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
    // Rastro: fantasmas do giro (lê a velocidade) + brasas
    const fx = this.scene.fx;
    if (fx && time >= (this._ghostAt ?? 0)) {
      this._ghostAt = time + 45;
      fx.ghost("px_boomer", this.x, this.y, this.rotation, GAME.PIXEL_SCALE, 0xff9a4a, 170, 0.42);
    }
    fx?.trail(this, this.x, this.y, "fire", 40);

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
      this.def.baseDmg * this.dmgMult * (this.owner?.dmgMultFor?.(this.def.element) ?? this.owner?._blessingDmgMult ?? 1)
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

  // Todo alvo vivo (inimigos do pool + chefe): fn(alvo, éChefe)
  _eachTarget(fn) {
    this.scene.enemyPool.forEachActive((e) => e.active && fn(e, false));
    const boss = this.scene.boss;
    if (boss?.active) fn(boss, true);
  }

  // Acerto padrão: crítico, roubo de vida, número (opcional; crítico sempre mostra),
  // status e morte
  _hit(t, base, element, fromX, fromY, showNum = true) {
    const isBoss = t === this.scene.boss;
    const crit = Math.random() < (this.owner?.critChance ?? 0);
    const dmg = crit ? base * (this.owner?.critMult ?? 2) : base;
    const died = t.takeDamage(dmg, isBoss ? undefined : null, fromX, fromY, crit);
    this.owner?.lifestealFrom(dmg);
    if (showNum || crit) this.scene._showDmg(t.x, t.y, dmg, element, crit);
    this.scene.elemental.applyStatus(t, element);
    if (died) {
      if (isBoss) this.scene._onBossDeath();
      else this.scene._onEnemyDeath(t);
    }
    return died;
  }

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
    // Sai da ponta do cajado (à frente e acima do corpo), não do umbigo
    const ox = this.owner.x + Math.cos(baseAng) * 16,
      oy = this.owner.y - 12 + Math.sin(baseAng) * 10;
    this.scene.fx?.muzzle(ox, oy, baseAng, "fire");
    for (let i = 0; i < total; i++) {
      const offset = (i - (total - 1) / 2) * spread;
      const a = baseAng + offset;
      const proj = this.scene.projectilePool.acquire();
      const { dmg, crit } = this.rollHit();
      proj.fire(
        ox,
        oy,
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
    // Acima do mapa de luz: o campo é magia, tem que brilhar no escuro
    this.ring = scene.add.image(0, 0, "fx_star").setDepth(48550).setVisible(false);
    this.crystals = [];
    this._ringKey = null;
    this._ringStrong = false;
  }
  dispose() {
    this.gfx.destroy();
    this.ring.destroy();
    for (const c of this.crystals) c.destroy();
    this.crystals = [];
  }
  // Anel pontilhado em "pixels" (quadrados de 3px) que gira devagar
  _drawRing(time) {
    const r = this.range;
    const ox = this.owner.x,
      oy = this.owner.y;
    // Textura do raio atual (o raio só muda com cartas de área/alcance)
    const key = auraRingTexture(this.scene, r, this._ringStrong);
    if (key !== this._ringKey) {
      this._ringKey = key;
      this.ring.setTexture(key).setVisible(true);
    }
    this.ring.setPosition(ox, oy).setRotation(time / 2600);
    // Cristais em órbita, no sentido contrário do tracejado
    const k = this._ringStrong ? 6 : 4;
    while (this.crystals.length < k)
      this.crystals.push(this.scene.add.image(0, 0, auraCrystalTexture(this.scene)).setScale(1.5).setDepth(48551));
    for (let i = 0; i < k; i++) {
      const a = -time / 1700 + (i / k) * Math.PI * 2;
      this.crystals[i].setPosition(Math.round(ox + Math.cos(a) * r), Math.round(oy + Math.sin(a) * r));
    }
    // Geada subindo dentro do campo (o ar está frio)
    if (time >= (this._moteAt ?? 0)) {
      this._moteAt = time + 120;
      const a = Math.random() * Math.PI * 2,
        d = Math.sqrt(Math.random()) * r * 0.95;
      this.scene.fx?.burst("frost", ox + Math.cos(a) * d, oy + Math.sin(a) * d, 1, -Math.PI / 2, 30, { min: 8, max: 26 });
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
    const fx = this.scene.fx;
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
      if (hits < 6) fx?.impact(e.x, e.y - 6, "ice", { power: 0.35, crit });
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
        fx?.ring(e.x, e.y + 4, 0xbfeaff, 6, 26, 220);
        fx?.burst("frost", e.x, e.y - 6, 5);
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
    // Pulso do campo: anel que corre até a borda + geada subindo dentro
    if (hits > 0 && fx) {
      fx.ring(this.owner.x, this.owner.y, 0x9fdcff, this.range * 0.45, this.range, 380, 1, 0.55); // redondo como o campo
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2,
          d = Math.random() * this.range * 0.9;
        fx.burst("frost", this.owner.x + Math.cos(a) * d, this.owner.y + Math.sin(a) * d * 0.7, 1, -Math.PI / 2, 40, { min: 10, max: 40 });
      }
    }
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
        // Estalo de cristal: faísca pixelada gelada
        const star = scene.add.image(x2, y2, "px_spark").setScale(3).setTint(0xbfeaff).setDepth(61);
        scene.tweens.add({
          targets: star,
          scale: 6,
          alpha: 0,
          angle: 45,
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
    this.scene.sound.play("sfx_bolt_attack", { volume: 0.5, rate: 0.9 + Math.random() * 0.2 });
    const dmg = this.damage;
    const hx = this.owner.x,
      hy = this.owner.y - 14; // sai da mão erguida
    this.scene.fx?.muzzle(hx, hy, Math.atan2(targets[0].y - hy, targets[0].x - hx), "bolt");
    for (const cur of targets) {
      this.scene.elemental._drawBolt(hx, hy, cur.x, cur.y - 6, COLORS.BOLT, 4);
      this.scene.fx?.impact(cur.x, cur.y - 6, "bolt", { power: 1.3, dir: Math.atan2(cur.y - hy, cur.x - hx) });
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
    if (e.isFrozen?.(now)) return 3; // congelado + raio → CRISTAL forte
    const s = e.statuses || {};
    if (s.fire || s.ice) return 2; // fogo + raio → SOBRECARGA · gelo + raio → CRISTAL
    if (s.bolt) return 1; // já afetado
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
    this.scene.fx?.muzzle(this.owner.x, this.owner.y - 14, Math.atan2(first.y - this.owner.y, first.x - this.owner.x), "bolt");
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
      this.def.nova.dmg * this.dmgMult * (this.owner?.dmgMultFor?.(this.def.element) ?? this.owner?._blessingDmgMult ?? 1);
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
    shockwave(scene, cx, cy, r, COLORS.ICE);
    scene.fx?.ring(cx, cy + 6, 0xffffff, 12, r, 300, 0.62, 1);
    scene.fx?.burst("frost", cx, cy, 14, null, 360, { min: 80, max: 220 });
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
    const dmg = t.dmgPerTick * this.dmgMult * (this.owner?.dmgMultFor?.(this.def.element) ?? this.owner?._blessingDmgMult ?? 1);
    const life = t.ticks * t.tickMs;
    // Visual: mancha de chama que encolhe até sumir
    // Visual: brasa no chão (luz aditiva) + chamas pixeladas subindo
    const patch = scene.add
      .image(x, y, "fx_glow")
      .setScale((r * 2.2) / 64)
      .setTint(COLORS.FIRE)
      .setAlpha(0.45)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(45);
    scene.tweens.add({ targets: patch, alpha: 0, scale: patch.scale * 0.5, duration: life, onComplete: () => patch.destroy() });
    scene.fx?.burst("ember", x, y, 2, -Math.PI / 2, 70, { min: 20, max: 70 });
    for (let i = 0; i < 2; i++) {
      const f = scene.add
        .image(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.6, "px_puff")
        .setScale(1.6)
        .setTint([0xffe58f, 0xffb36b, 0xff7a3c][i])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(y + 10002);
      scene.tweens.add({ targets: f, y: f.y - 26, scale: 0.4, alpha: 0, delay: i * 90, duration: 520, onComplete: () => f.destroy() });
    }
    // Dano em ticks (sem número flutuante — mesmo padrão do DoT do Vapor)
    const burn = () => {
      scene.enemyPool.forEachActive((e) => {
        const dx = e.x - x,
          dy = e.y - y;
        if (dx * dx + dy * dy > rSq) return;
        const died = e.takeDamage(dmg, null, null, null, false, true);
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

// ORBE GÉLIDO: N orbes giram ao redor do player; tocar = dano + gelo.
// Re-acerto no mesmo alvo limitado por `cooldown` (mapa por inimigo).
export class OrbitalIce extends Weapon {
  constructor(scene, defKey = "ORB") {
    super(scene, defKey);
    this.angle = 0;
    this.orbs = [];
    this.lastHit = new Map();
  }
  get count() {
    return this.def.count + this.extraProj;
  }
  get orbitR() {
    return this.def.range * this.rangeMult * (this.owner?.areaMult ?? 1);
  }
  _syncOrbs() {
    const want = this.count;
    while (this.orbs.length < want) {
      const glow = this.scene.add
        .image(0, 0, "fx_glow")
        .setScale(0.6)
        .setTint(COLORS.ICE)
        .setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(41);
      const spr = this.scene.add.image(0, 0, "px_iceorb").setScale(this._orbScale ?? 3);
      this.orbs.push({ glow, spr });
    }
    while (this.orbs.length > want) {
      const o = this.orbs.pop();
      o.glow.destroy();
      o.spr.destroy();
    }
  }
  dispose() {
    for (const o of this.orbs) {
      o.glow.destroy();
      o.spr.destroy();
    }
    this.orbs = [];
  }
  update(time, dt) {
    if (!this.owner) return;
    this._syncOrbs();
    this.angle += this.def.spin * (dt / 1000);
    const n = this.orbs.length;
    const R = this.orbitR;
    const hitR = this.def.hitRadius;
    const hitSq = hitR * hitR;
    const cd = this.cooldown;
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const x = this.owner.x + Math.cos(a) * R;
      const y = this.owner.y + Math.sin(a) * R * 0.9;
      const o = this.orbs[i];
      o.spr.setPosition(x, y).setDepth(y + 14 + 10000).setRotation(a * 2);
      o.glow.setPosition(x, y);
      this.scene.fx?.trail(o, x, y, "ice", 45);
      // Fantasmas do giro: leem a velocidade da órbita
      if (time >= (o._ghostAt ?? 0)) {
        o._ghostAt = time + 40;
        this.scene.fx?.ghost("px_iceorb", x, y, a * 2, (this._orbScale ?? 3) * 0.9, 0x7fd0ff, 150, 0.4);
      }
      const strike = (e, isBoss) => {
        const dx = e.x - x,
          dy = e.y - y;
        if (dx * dx + dy * dy > hitSq) return;
        const last = this.lastHit.get(e) ?? -1e9;
        if (time - last < cd) return;
        this.lastHit.set(e, time);
        const { dmg, crit } = this.rollHit();
        const died = e.takeDamage(dmg, isBoss ? undefined : null, x, y, crit);
        this.owner.lifestealFrom(dmg);
        this.scene._showDmg(e.x, e.y, dmg, ELEMENT.ICE, crit);
        this.scene.elemental.applyStatus(e, ELEMENT.ICE);
        this.scene.fx?.impact(x, y, "ice", { power: 0.8, crit, dir: a + Math.PI / 2 });
        this._onOrbHit?.(e, time, isBoss);
        if (died) {
          if (isBoss) this.scene._onBossDeath();
          else this.scene._onEnemyDeath(e);
        }
      };
      this.scene.enemyPool.forEachActive((e) => e.active && strike(e, false));
      if (this.scene.boss?.active) strike(this.scene.boss, true);
    }
    // Inimigos são pooled: limpa o mapa de acertos de tempos em tempos
    if (this.lastHit.size > 200) this.lastHit.clear();
  }
}

// GELEIRA VIVA (Orbe+Aura): orbes maiores e em maior número que CONGELAM
export class Glacier extends OrbitalIce {
  constructor(scene) {
    super(scene, "GLACIER");
    this.baseKey = this.def.evolvesFrom;
    this._orbScale = 4;
  }
  _onOrbHit(e, time, isBoss) {
    if (isBoss || !e.freeze || e.isFrozen(time) || time < e._freezeLockUntil) return;
    e.freeze(time, this.def.freezeMs, this.def.freezeImmuneMs);
  }
}

// SOPRO FLAMEJANTE: cone de fogo na direção do movimento (parado = mira o
// inimigo mais próximo). Acerta todos dentro do cone.
export class Flamethrower extends Weapon {
  constructor(scene, defKey = "FLAME") {
    super(scene, defKey);
  }
  get range() {
    return this.def.range * this.rangeMult * Math.sqrt(this.owner?.areaMult ?? 1);
  }
  _dir() {
    const p = this.owner;
    if (p.isMoving) return Math.atan2(p.lastMoveY, p.lastMoveX);
    const t = this._nearestEnemyInRange();
    if (t) return Math.atan2(t.y - p.y, t.x - p.x);
    return Math.atan2(p.lastMoveY, p.lastMoveX);
  }
  _fire() {
    if (!this.owner) return false;
    if (!this._nearestEnemyInRange()) return false;
    const dir = this._dir();
    const R = this.range;
    const half = this.def.halfAngle;
    const scene = this.scene;
    const px = this.owner.x,
      py = this.owner.y;
    const strike = (e, isBoss) => {
      const dx = e.x - px,
        dy = e.y - py;
      const d = Math.hypot(dx, dy);
      if (d > R + 10) return;
      let da = Math.atan2(dy, dx) - dir;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > half && d > 30) return;
      const { dmg, crit } = this.rollHit();
      const died = e.takeDamage(dmg, isBoss ? undefined : null, px, py, crit);
      this.owner.lifestealFrom(dmg);
      scene._showDmg(e.x, e.y, dmg, ELEMENT.FIRE, crit);
      scene.elemental.applyStatus(e, ELEMENT.FIRE);
      scene.fx?.impact(e.x, e.y - 6, "fire", { power: 0.5, crit, dir });
      if (died) {
        if (isBoss) scene._onBossDeath();
        else scene._onEnemyDeath(e);
      }
    };
    scene.enemyPool.forEachActive((e) => e.active && strike(e, false));
    if (scene.boss?.active) strike(scene.boss, true);
    this._flameFx(px, py, dir, R, half);
    // Brasas varrendo o cone + fumaça na ponta + luz quente ao longo do sopro
    const fx = scene.fx;
    if (fx) {
      const sx = px + Math.cos(dir) * 14,
        sy = py - 8 + Math.sin(dir) * 14;
      fx.burst("ember", sx, sy, 10, dir, half * 2 * 57.3 * 0.9, { min: R * 0.9, max: R * 1.9 });
      fx.burst("spark", sx, sy, 4, dir, half * 57.3, { min: R, max: R * 2.2 }, [0xffffff, 0xffe58f]);
      fx.burst("smoke", px + Math.cos(dir) * R * 0.85, py + Math.sin(dir) * R * 0.85, 2, -Math.PI / 2, 90);
      fx.light(px + Math.cos(dir) * R * 0.5, py + Math.sin(dir) * R * 0.5, R * 1.1, 0xff7a3c, 260, 1);
    }
    this._afterBurst?.(px, py, dir, R);
    scene.sound.play("sfx_fire_attack", { volume: 0.22, rate: 0.8 + Math.random() * 0.15 });
    return true;
  }
  // Leque de "puffs" de fogo que voam pelo cone e se apagam
  _flameFx(px, py, dir, R, half) {
    const scene = this.scene;
    // Jato: bolas de fogo opacas que saem pequenas do bocal e crescem pelo cone
    // (branco → amarelo → laranja → vinho). Velocidade casada com o alcance.
    const jet = () => {
      if (!this.owner) return;
      const ox = this.owner.x + Math.cos(dir) * 12,
        oy = this.owner.y - 8 + Math.sin(dir) * 12;
      scene.fx?.burst("jet_fire", ox, oy, 4, dir, half * 2 * 57.3 * 0.7, { min: R * 1.1, max: R * 3.3 });
    };
    // Cinco levas em ~120 ms e rapidez bem variada: uma COLUNA contínua, não uma bola
    for (let i = 0; i < 5; i++) scene.time.delayedCall(i * 30, jet);
    const glow = scene.add
      .image(px + Math.cos(dir) * R * 0.5, py + Math.sin(dir) * R * 0.5, "fx_glow")
      .setScale(R / 22, R / 40)
      .setRotation(dir)
      .setTint(0xff7a3c)
      .setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(60);
    scene.tweens.add({ targets: glow, alpha: 0, duration: 380, onComplete: () => glow.destroy() });
  }
}

// INFERNO (Sopro+Bumerangue): cone mais largo que deixa o chão em chamas
export class Inferno extends Flamethrower {
  constructor(scene) {
    super(scene, "INFERNO");
    this.baseKey = this.def.evolvesFrom;
  }
  _afterBurst(px, py, dir, R) {
    for (let i = 1; i <= 3; i++) {
      const d = (R * i) / 3.2;
      Phoenix.prototype._firePatch.call(
        { scene: this.scene, def: { trail: this.def.trail, element: this.def.element }, dmgMult: this.dmgMult, owner: this.owner },
        px + Math.cos(dir) * d,
        py + Math.sin(dir) * d,
      );
    }
  }
}


// ============================================================================
// LEVA 2 — Vaga-lumes, Granizo, Redemoinho (+ evoluções). Ver docs/ARMAS_E_COMBOS.md
// ============================================================================

// VAGA-LUMES (raio): enxame teleguiado. Cada vaga-lume escolhe um alvo diferente,
// voa em curva (virada limitada + bamboleio) e some ao acertar. Alvo morto = caça
// o mais próximo dele. Simulação própria (sem física) — barata no celular.
const MAX_FIREFLIES = 28;
export class Fireflies extends Weapon {
  constructor(scene, defKey = "FIREFLY") {
    super(scene, defKey);
    this.flies = [];
  }
  get count() {
    return this.def.count + (this.owner?.extraProj ?? 0) + this.extraProj;
  }
  dispose() {
    for (const f of this.flies) this._despawn(f);
    this.flies = [];
  }
  _fire() {
    if (!this.owner) return false;
    const targets = this._spreadTargets(this.count);
    if (!targets.length) return false;
    const dmg = this.damage;
    targets.forEach((t, i) => {
      // Saem em leque, cada um para um lado, e depois fazem a curva até o alvo
      const a =
        Math.atan2(t.y - this.owner.y, t.x - this.owner.x) +
        (i - (targets.length - 1) / 2) * 0.6 +
        (Math.random() - 0.5) * 0.4;
      this._spawn(this.owner.x, this.owner.y - 10, a, t, dmg, 0);
    });
    this.scene.sound.play("sfx_bolt_attack", { volume: 0.18, rate: 1.6 + Math.random() * 0.3 });
    return true;
  }
  // Até n alvos distintos no alcance, os mais próximos primeiro
  _spreadTargets(n, from = this.owner, exclude = null, range = this.range) {
    const rSq = range * range;
    const list = [];
    this._eachTarget((e) => {
      if (exclude?.has(e)) return;
      const d2 = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d2 <= rSq) list.push({ e, d2 });
    });
    list.sort((a, b) => a.d2 - b.d2);
    const out = list.slice(0, n).map((o) => o.e);
    // Menos inimigos que vaga-lumes: os que sobram repetem alvos
    const distinct = out.length;
    for (let i = 0; distinct && out.length < n; i++) out.push(out[i % distinct]);
    return out;
  }
  _spawn(x, y, ang, target, dmg, gen) {
    if (this.flies.length >= MAX_FIREFLIES) return;
    const scene = this.scene;
    const glow = scene.add
      .image(x, y, "fx_glow")
      .setScale(gen ? 0.6 : 0.85)
      .setTint(0xf4ff9a)
      .setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(60);
    const spr = scene.add.image(x, y, "px_firefly").setScale(gen ? 2.4 : 3.2);
    const sp = this.def.speed * (gen ? 1.1 : 1);
    this.flies.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      sp,
      target,
      dmg,
      gen,
      glow,
      spr,
      until: scene.time.now + this.def.lifeMs,
      seed: Math.random() * 10,
    });
  }
  _despawn(f) {
    f.glow.destroy();
    f.spr.destroy();
  }
  // Luz no mapa de luz (Lighting chama para cada arma)
  lights(add) {
    for (const f of this.flies) add(f.x, f.y, f.gen ? 50 : 70, 0xe8ff8a, 0.75);
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.flies.length) return;
    const s = dt / 1000;
    const hitSq = this.def.hitRadius * this.def.hitRadius;
    const keep = [];
    for (const f of this.flies) {
      if (time >= f.until) {
        this._despawn(f);
        continue;
      }
      if (!f.target?.active) f.target = this._spreadTargets(1, f, null, 260)[0] ?? null;
      if (f.target) {
        // Virada limitada até o alvo + bamboleio de inseto
        const want = Math.atan2(f.target.y - f.y, f.target.x - f.x);
        const cur = Math.atan2(f.vy, f.vx);
        let da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const maxTurn = this.def.turn * s;
        da = Math.max(-maxTurn, Math.min(maxTurn, da)) + Math.sin(time / 90 + f.seed) * 0.05;
        const a = cur + da;
        f.vx = Math.cos(a) * f.sp;
        f.vy = Math.sin(a) * f.sp;
      }
      f.x += f.vx * s;
      f.y += f.vy * s;
      f.spr.setPosition(f.x, f.y).setDepth(f.y + 10020).setFlipX(f.vx < 0);
      f.glow.setPosition(f.x, f.y).setAlpha(0.55 + Math.sin(time / 70 + f.seed) * 0.2);
      this.scene.fx?.trail(f, f.x, f.y, "firefly", f.gen ? 40 : 26);
      const t = f.target;
      // Raio de acerto = vaga-lume + corpo do inimigo (~12px)
      if (t?.active && (t.x - f.x) ** 2 + (t.y - f.y) ** 2 <= hitSq + 140) {
        this._impact(f, t);
        this._despawn(f);
        continue;
      }
      keep.push(f);
    }
    this.flies = keep;
  }
  _impact(f, t) {
    const scene = this.scene;
    this._hit(t, f.dmg, ELEMENT.BOLT, f.x, f.y);
    // Choque: faíscas lilás no sentido do voo + estouro de luz amarela do vaga-lume
    const fx = scene.fx;
    if (fx) {
      fx.impact(f.x, f.y, "bolt", { power: f.gen ? 0.6 : 0.9, dir: Math.atan2(f.vy, f.vx) });
      fx.burst("glow", f.x, f.y, f.gen ? 3 : 5, null, 360, { min: 30, max: 90 });
    }
    this._afterImpact?.(f, t);
  }
}

// REVOADA (Vaga-lumes + Orbe): cada vaga-lume adulto que acerta se divide em
// filhotes que caçam OUTROS alvos (uma geração só — sem reação em cadeia infinita).
export class Swarm extends Fireflies {
  constructor(scene) {
    super(scene, "SWARM");
    this.baseKey = this.def.evolvesFrom;
  }
  _afterImpact(f, t) {
    if (f.gen > 0) return;
    const sp = this.def.split;
    const targets = this._spreadTargets(sp.n, f, new Set([t]), 240);
    targets.forEach((nt, i) => {
      const a = Math.atan2(nt.y - f.y, nt.x - f.x) + (i ? 0.9 : -0.9);
      this._spawn(f.x, f.y, a, nt, f.dmg * sp.dmgMult, 1);
    });
  }
}

// GRANIZO (gelo): marca inimigos ao acaso no alcance; a sombra cresce no chão e a
// pedra cai. Dano em área + gelo; quem JÁ estava resfriado congela.
export class Hail extends Weapon {
  constructor(scene, defKey = "HAIL") {
    super(scene, defKey);
  }
  get count() {
    return this.def.count + (this.owner?.extraProj ?? 0) + this.extraProj;
  }
  get radius() {
    return this.def.radius * Math.sqrt(this.rangeMult) * (this.owner?.areaMult ?? 1);
  }
  _fire() {
    if (!this.owner) return false;
    const rSq = this.range * this.range;
    const pool = [];
    this._eachTarget((e) => {
      if ((e.x - this.owner.x) ** 2 + (e.y - this.owner.y) ** 2 <= rSq) pool.push(e);
    });
    if (!pool.length) return false;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      // Sorteia sem repetir enquanto houver alvos; depois, cai perto do herói
      const t = pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : null;
      const x = t ? t.x : this.owner.x + (Math.random() - 0.5) * 220;
      const y = t ? t.y : this.owner.y + (Math.random() - 0.5) * 160;
      this.scene.time.delayedCall(i * 110, () => this._drop(x, y));
    }
    return true;
  }
  _drop(x, y) {
    const scene = this.scene;
    const R = this.radius;
    const fall = this.def.fallMs;
    // Sombra que cresce = onde vai cair (azul, não vermelha: o ataque é NOSSO)
    const shadow = scene.add.image(x, y, "px_shadow").setScale(0.4).setAlpha(0.35).setDepth(44);
    scene.tweens.add({ targets: shadow, scaleX: (R * 1.6) / 16, scaleY: (R * 0.9) / 8, alpha: 0.75, duration: fall });
    // Mira de geada fechando sobre o ponto (azul: é ataque NOSSO, não perigo)
    scene.fx?.ring(x, y, 0x9fdcff, R * 1.2, R * 0.35, fall, 0.55, 0.45);
    const stone = scene.add.image(x + 60, y - 280, "px_hail").setScale(3.2).setDepth(y + 10030);
    const glow = scene.add
      .image(stone.x, stone.y, "fx_glow")
      .setScale(0.7)
      .setTint(COLORS.ICE)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(60);
    const tr = {};
    scene.tweens.add({
      targets: [stone, glow],
      x,
      y,
      duration: fall,
      ease: "Quad.easeIn",
      onUpdate: () => scene.fx?.trail(tr, stone.x, stone.y, "ice", 22),
      onComplete: () => {
        stone.destroy();
        glow.destroy();
        shadow.destroy();
        this._impact(x, y, R);
      },
    });
  }
  _impact(x, y, R) {
    const scene = this.scene;
    if (!scene.player?.active) return;
    const now = scene.time.now;
    const rSq = R * R;
    const dmg = this.damage;
    let hits = 0;
    const frozen = [];
    this._eachTarget((e, isBoss) => {
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > rSq) return;
      const chilled = !!e.statuses?.ice;
      const died = this._hit(e, dmg, ELEMENT.ICE, x, y);
      hits++;
      if (died || isBoss || !e.freeze) return;
      if ((chilled || this.def.freezeOnHit) && !e.isFrozen(now) && now >= e._freezeLockUntil)
        e.freeze(now, this.def.freezeMs, this.def.freezeImmuneMs);
      if (e.isFrozen(now)) frozen.push(e);
    });
    // Pancada no chão: estalo, anel de onda, lascas saltando, poeira e geada
    const fx = scene.fx;
    if (fx) {
      fx.star(x, y - 4, 0xffffff, 0.7, 2.4, 120, Math.PI / 4);
      fx.ring(x, y + 2, 0xbfeaff, 6, R, 240, 0.55, 0.7);
      fx.burst("shard", x, y - 4, 7, -Math.PI / 2, 200, { min: 110, max: 260 });
      fx.burst("frost", x, y, 6, null, 360, { min: 40, max: 120 });
      fx.burst("smoke", x, y, 2, -Math.PI / 2, 160);
      fx.decal("fx_frost", x, y, R * 0.75, 1500, 0.6);
      fx.light(x, y, R * 2.4, 0x5cc8ff, 200, 1);
    }
    scene.sound.play("sfx_ice_attack", { volume: hits ? 0.28 : 0.12, rate: 1.15 + Math.random() * 0.2 });
    this._afterImpact?.(x, y, frozen);
  }
}

// TEMPESTADE DE GRANIZO (Granizo + Raio): as pedras congelam na hora e um raio do
// céu cai em até `strike.max` congelados da área → CRISTAL sem precisar do Raio.
export class Hailstorm extends Hail {
  constructor(scene) {
    super(scene, "HAILSTORM");
    this.baseKey = this.def.evolvesFrom;
  }
  _afterImpact(x, y, frozen) {
    const st = this.def.strike;
    const scene = this.scene;
    const dmg = st.dmg * this.dmgMult * (this.owner?.dmgMultFor?.(ELEMENT.BOLT) ?? 1);
    frozen.slice(0, st.max).forEach((e, i) => {
      scene.time.delayedCall(90 + i * 70, () => {
        if (!e.active) return;
        scene.elemental._drawBolt(e.x + 30, e.y - 260, e.x, e.y, COLORS.BOLT, 4);
        this._hit(e, dmg, ELEMENT.BOLT, e.x, e.y - 40);
      });
    });
    if (frozen.length) scene.sound.play("sfx_bolt_attack", { volume: 0.3, rate: 0.8 });
  }
}

// REDEMOINHO (raio): funil que nasce no inimigo mais próximo e anda atrás do
// bando; a cada tique causa dano em área e PUXA quem está em volta (chefe e
// minichefes não são puxados). `extraProj` = mais funis ao mesmo tempo.
export class Whirlwind extends Weapon {
  constructor(scene, defKey = "WHIRL") {
    super(scene, defKey);
    this.whirls = [];
    this._tex = "px_whirl";
    this._anim = "whirl_spin";
    this._glowTint = COLORS.BOLT;
    this._debris = "leaf"; // o que o vento arranca do chão
  }
  get count() {
    return this.def.count + this.extraProj;
  }
  get radius() {
    return this.def.radius * Math.sqrt(this.rangeMult) * (this.owner?.areaMult ?? 1);
  }
  dispose() {
    for (const w of this.whirls) this._despawn(w);
    this.whirls = [];
  }
  _fire() {
    if (!this.owner) return false;
    const first = this._nearestEnemyInRange();
    if (!first) return false;
    const scene = this.scene;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = first.x + (i ? Math.cos(a) * 90 : 0),
        y = first.y + (i ? Math.sin(a) * 90 : 0);
      const ground = scene.add
        .image(x, y, "fx_glow")
        .setTint(this._glowTint)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(44);
      const spr = scene.add.sprite(x, y, this._tex).setOrigin(0.5, 0.92).setScale(0.5).play(this._anim);
      scene.tweens.add({ targets: spr, scale: this._sprScale(), duration: 220, ease: "Back.easeOut" });
      scene.tweens.add({ targets: ground, alpha: 0.3, duration: 220 });
      scene.fx?.ring(x, y, this._glowTint, 8, this.radius * 1.3, 320, 0.5, 0.9);
      scene.fx?.burst("smoke", x, y, 4, null, 360, { min: 30, max: 90 });
      scene.fx?.burst(this._debris, x, y, 6, -Math.PI / 2, 160);
      this.whirls.push({
        x,
        y,
        spr,
        ground,
        until: scene.time.now + this.def.durationMs * Math.sqrt(this.rangeMult),
        nextTick: 0,
        tick: 0,
        seed: Math.random() * 10,
      });
    }
    scene.sound.play("sfx_whoosh", { volume: 0.35, rate: 0.7 });
    return true;
  }
  _sprScale() {
    // 3× exato no raio base (pixel do mesmo tamanho dos outros sprites)
    return 3 * Math.sqrt(this.radius / this.def.radius);
  }
  _despawn(w) {
    this.scene.tweens.add({
      targets: [w.spr, w.ground],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        w.spr.destroy();
        w.ground.destroy();
      },
    });
  }
  update(time, dt) {
    super.update(time, dt);
    if (!this.whirls.length) return;
    const s = dt / 1000;
    const R = this.radius;
    const keep = [];
    for (const w of this.whirls) {
      if (time >= w.until) {
        this._despawn(w);
        continue;
      }
      // Anda atrás do inimigo mais próximo DELE (com zigue-zague de vento)
      let best = null,
        bestSq = 320 * 320;
      this._eachTarget((e) => {
        const d2 = (e.x - w.x) ** 2 + (e.y - w.y) ** 2;
        if (d2 < bestSq) {
          bestSq = d2;
          best = e;
        }
      });
      if (best) {
        const dx = best.x - w.x,
          dy = best.y - w.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = this.def.speed * Math.min(1, len / 20);
        w.x += (dx / len) * sp * s;
        w.y += (dy / len) * sp * s;
      }
      w.x += Math.sin(time / 260 + w.seed) * 30 * s;
      w.spr.setPosition(w.x, w.y).setDepth(w.y + 10010);
      w.ground.setPosition(w.x, w.y).setScale((R * 2.2) / 64, (R * 1.3) / 64);
      // Detritos saindo pela tangente da base (o vento "arranca" do chão)
      if (time >= (w._debrisAt ?? 0)) {
        w._debrisAt = time + 70 / (this.scene.fx?.q ?? 1);
        const a = time / 120 + w.seed;
        const bx = w.x + Math.cos(a) * R * 0.5,
          by = w.y + Math.sin(a) * R * 0.25;
        this.scene.fx?.burst(this._debris, bx, by, 1, a + Math.PI / 2 - 0.5, 50, { min: 60, max: 150 });
      }
      this._pull(w, R, s);
      if (time >= w.nextTick) {
        w.nextTick = time + this.def.tickMs;
        this._tick(w, R, w.tick++);
      }
      keep.push(w);
    }
    this.whirls = keep;
  }
  // Puxa para o centro (mexe na posição: a IA reescreve a velocidade todo quadro)
  _pull(w, R, s) {
    const pr = R * 1.6,
      prSq = pr * pr;
    const k = this.def.pull * s;
    this.scene.enemyPool.forEachActive((e) => {
      if (!e.active || e.miniBoss) return;
      const dx = w.x - e.x,
        dy = w.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > prSq || d2 < 36) return;
      const d = Math.sqrt(d2);
      e.x += (dx / d) * k;
      e.y += (dy / d) * k;
    });
  }
  _tickElement() {
    return ELEMENT.BOLT;
  }
  _tick(w, R, n) {
    const rSq = R * R;
    const dmg = this.damage;
    const el = this._tickElement(n);
    let shown = 0;
    this._eachTarget((e) => {
      if ((e.x - w.x) ** 2 + (e.y - w.y) ** 2 > rSq) return;
      // Número só no crítico: o funil tica muito e poluiria a tela
      this._hit(e, dmg, el, w.x, w.y, false);
      if (shown++ < 4) this.scene.fx?.impact(e.x, e.y - 8, el, { power: 0.45 });
    });
  }
  lights(add) {
    for (const w of this.whirls) add(w.x, w.y - 20, this.radius * 2.2, this._glowTint, 0.55);
  }
}

// REDEMOINHO DE BRASA (Redemoinho + Sopro): maior, puxa mais e alterna FOGO e RAIO
// a cada tique — fogo + raio no mesmo inimigo = SOBRECARGA.
export class FireWhirl extends Whirlwind {
  constructor(scene) {
    super(scene, "FIRE_WHIRL");
    this.baseKey = this.def.evolvesFrom;
    this._tex = "px_whirl_fire";
    this._anim = "whirl_fire_spin";
    this._glowTint = COLORS.FIRE;
    this._debris = "ember";
  }
  _tickElement(n) {
    return n % 2 ? ELEMENT.BOLT : ELEMENT.FIRE;
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
  ORB: OrbitalIce,
  FLAME: Flamethrower,
  GLACIER: Glacier,
  INFERNO: Inferno,
  FIREFLY: Fireflies,
  HAIL: Hail,
  WHIRL: Whirlwind,
  SWARM: Swarm,
  HAILSTORM: Hailstorm,
  FIRE_WHIRL: FireWhirl,
};
