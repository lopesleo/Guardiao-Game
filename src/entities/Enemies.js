// Inimigos: Morcego, Corvo, Goblin (atira) + Boss (D3).
import { ENEMY, GAME, COLORS, ELITE, MIMIC } from "../config.js";

// Frames mapeados pelo catálogo Pimen Tiny Creatures (10 cols, 180 frames).
// IMPORTANTE: Phaser usa 0-indexed. Catálogo do pack é 1-indexed -> subtrai 1.
const FRAMES = {
  WOLF: 24, // Morcego Gigante Sombrio (catalogo pos 140)
  CROW: 136, // Corvo voando (catalogo pos 137)
  GOBLIN: 10, // Goblin (catalogo pos 11)
  BOSS: 114, // Ent Carvalho (catalogo pos 115)
  MAGE: 20, // Mago/caster telegrafado — ajuste o frame se o sprite nao combinar
  BRUTE: 70, // Brutamontes (tanque pesado) — ajuste o frame se preciso
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, frame = FRAMES.WOLF) {
    super(scene, x, y, "creatures", frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE);
    this.body.setCircle(7, 1, 1);

    this.hp = 1;
    this.maxHp = 1;
    this.dmg = 1;
    this.speed = 60;
    this.statuses = {}; // { fire: {until,def,lastTickAt}, ... }
    this.lastTouchAt = 0;
    this.contactCooldownMs = 350; // re-bate mais rápido: inimigo colado é punitivo
    this.contactRadius = 26; // distância de dano de contato (escala com o tamanho)
    this._kind = "wolf";
    this._lastShotAt = 0;
    this._shotCooldownMs = 1800;
    this._shotRange = 260;
    // Mago: canalização telegrafada
    this._casting = false;
    this._castUntil = 0;
    this._castCdUntil = 0;
    // Estado de congelamento (Aura Gélida) — para o inimigo, mas continua tomando dano
    this._frozenUntil = 0; // congelado enquanto time < isso
    this._freezeLockUntil = 0; // imune a novo freeze enquanto time < isso (anti-permafreeze)
    this._auraEnterAt = 0; // quando entrou no campo da aura
    this._auraLastSeen = 0; // última vez visto dentro do campo
    this._frozenVisual = false;
  }

  isFrozen(time) {
    return time < this._frozenUntil;
  }

  // Congela por durMs e trava re-freeze por immuneMs após descongelar.
  freeze(time, durMs, immuneMs) {
    this._frozenUntil = time + durMs;
    this._freezeLockUntil = time + durMs + immuneMs;
  }

  activate(x, y, kind, wave, elite = false) {
    this._kind = kind;
    this._elite = elite;
    this.setActive(true).setVisible(true);
    this.setPosition(x, y);
    this.body.enable = true;
    this.maxHp = ENEMY.HP(wave);
    this.hp = this.maxHp;
    this.dmg = ENEMY.DMG(wave);
    this.statuses = {};
    this.lastTouchAt = 0;
    this._lastShotAt = 0;
    this._casting = false;
    this._castCdUntil = 0;
    this._shotRange = 260;
    this._frozenUntil = 0;
    this._freezeLockUntil = 0;
    this._auraEnterAt = 0;
    this._auraLastSeen = 0;
    this._frozenVisual = false;
    this.clearTint();
    this.setAngle(0);
    this.setScale(GAME.PIXEL_SCALE);
    this.contactRadius = 26;

    if (kind === "wolf") {
      this.setFrame(FRAMES.WOLF);
      this.speed = ENEMY.SPEED_WOLF;
      this.maxHp *= 0.7;
      this.hp = this.maxHp;
    } else if (kind === "crow") {
      this.setFrame(FRAMES.CROW);
      this.speed = ENEMY.SPEED_CROW;
      this.maxHp *= 0.55;
      this.hp = this.maxHp;
    } else if (kind === "goblin") {
      this.setFrame(FRAMES.GOBLIN);
      this.speed = ENEMY.SPEED_GOBLIN;
      this.maxHp *= 1.3;
      this.hp = this.maxHp;
    } else if (kind === "mage") {
      // Mago: lento, mantém distância e solta projétil telegrafado (dá pra desviar)
      this.setFrame(FRAMES.MAGE);
      this.speed = 110; // era 70 (anti-kite; ainda < player 160)
      this.maxHp *= 1.1;
      this.hp = this.maxHp;
      this._shotRange = 300;
      this.setTint(0xc290ff);
    } else if (kind === "brute") {
      // Brutamontes: tanque lento e grande que bate MUITO forte no contato
      this.setFrame(FRAMES.BRUTE);
      this.setScale(GAME.PIXEL_SCALE * 1.6);
      this.speed = 85; // era 55: continua o tanque mais lento, mas não dá pra ignorar andando
      this.maxHp *= 3.0;
      this.hp = this.maxHp;
      this.dmg *= 1.8;
      this.contactRadius = 44;
      this.setTint(0xd98a6a);
    } else {
      this.setFrame(FRAMES.WOLF);
      this.speed = ENEMY.SPEED_WOLF;
    }

    // Elite ('elite' string) ou mimic ('mimic')
    if (elite === "mimic") {
      this.setScale(GAME.PIXEL_SCALE * MIMIC.SCALE_MULT);
      // HP com piso (não escala só com wave) + dano e velocidade próprios
      this.maxHp = Math.max(ENEMY.HP(wave) * MIMIC.HP_MULT, MIMIC.HP_FLOOR);
      this.hp = this.maxHp;
      this.dmg = ENEMY.DMG(wave) * MIMIC.DMG_MULT;
      this.speed = MIMIC.SPEED;
      this.contactRadius = MIMIC.CONTACT_RADIUS;
      // Força perseguição melee (não fica atirando de longe como goblin)
      this._kind = "wolf";
      this.setFrame(FRAMES.WOLF);
      this.setTint(MIMIC.TINT);
    } else if (elite) {
      this.setScale(GAME.PIXEL_SCALE * ELITE.SCALE_MULT);
      this.maxHp *= ELITE.HP_MULT;
      this.hp = this.maxHp;
      this.contactRadius = ELITE.CONTACT_RADIUS;
      this.setTint(ELITE.TINT);
    }
  }

  deactivate() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
  }

  // Aplicar dano. crit = true ativa BONK (knockback + squash forte + flash dourado).
  takeDamage(dmg, element = null, fromX = null, fromY = null, crit = false) {
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    this.hp -= dmg * iceAmp;

    // FLASH: branco normal, DOURADO se crit
    this.setTintFill(crit ? 0xffd96b : 0xffffff);
    this.scene.time.delayedCall(crit ? 110 : 60, () => {
      if (!this.active) return;
      this.scene.elemental?._updateTint(this);
    });

    if (crit) {
      // SQUASH forte
      this.scene.tweens.add({
        targets: this,
        scaleX: GAME.PIXEL_SCALE * 1.3,
        scaleY: GAME.PIXEL_SCALE * 0.75,
        duration: 80,
        yoyo: true,
      });
      // KNOCKBACK
      if (fromX != null && fromY != null && this.body?.enable) {
        const dx = this.x - fromX,
          dy = this.y - fromY;
        const len = Math.hypot(dx, dy) || 1;
        const k = 320;
        this.body.setVelocity(
          this.body.velocity.x + (dx / len) * k,
          this.body.velocity.y + (dy / len) * k,
        );
      }
    }

    if (element) this.scene.elemental?.applyStatus(this, element);
    return this.hp <= 0;
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;

    // CONGELADO: para tudo (não anda, não atira), mas continua tomando dano.
    if (this.isFrozen(time)) {
      this.setVelocity(0, 0);
      this.setDepth(this.y + 10000);
      if (!this._frozenVisual) {
        this.setTint(0x8fe3ff);
        this._frozenVisual = true;
      }
      return;
    }
    if (this._frozenVisual) {
      this._frozenVisual = false;
      this.scene.elemental?._updateTint(this);
    }

    // Slow apenas do gelo (Aura Gélida). Vapor agora causa dano, não slow.
    let slow = 1;
    if (this.statuses.ice) slow *= 0.5;

    const dx = target.x - this.x,
      dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;

    if (this._kind === "goblin") {
      // Atirador: mantém distância (~200px) e atira
      const desired = 200;
      const diff = len - desired;
      const sp = this.speed * slow * Math.sign(diff);
      this.setVelocity((dx / len) * sp, (dy / len) * sp);

      if (
        len <= this._shotRange &&
        time - this._lastShotAt >= this._shotCooldownMs
      ) {
        this._lastShotAt = time;
        this._shoot(target);
      }
    } else if (this._kind === "crow") {
      // Corvo: mergulha em arco E dispara penas ocasionalmente (mergulha-bombardeiro)
      const perpX = -dy / len,
        perpY = dx / len;
      const wob = Math.sin(time / 200 + this.x) * 0.5;
      const sp = this.speed * slow;
      this.setVelocity(
        (dx / len) * sp + perpX * sp * wob,
        (dy / len) * sp + perpY * sp * wob,
      );
      if (len <= this._shotRange && time - this._lastShotAt >= 2400) {
        this._lastShotAt = time;
        this._shoot(target);
      }
    } else if (this._kind === "mage") {
      // Mago: mantém distância; ao alcance, CANALIZA (cresce ~0.7s) e solta tiro lento
      if (this._casting) {
        this.setVelocity(0, 0); // parado enquanto canaliza (telegrafa)
        if (time >= this._castUntil) {
          this._casting = false;
          this._castCdUntil = time + 2600;
          this.setScale(GAME.PIXEL_SCALE);
          this._castBigShot(target);
        }
      } else {
        const desired = 240;
        const diff = len - desired;
        const sp = this.speed * slow * Math.sign(diff);
        this.setVelocity((dx / len) * sp, (dy / len) * sp);
        if (len <= this._shotRange && time >= this._castCdUntil) {
          this._casting = true;
          this._castUntil = time + 700;
          this.setVelocity(0, 0);
          this.scene.tweens.add({
            targets: this,
            scaleX: GAME.PIXEL_SCALE * 1.35,
            scaleY: GAME.PIXEL_SCALE * 1.35,
            duration: 350, yoyo: true,
          });
        }
      }
    } else {
      // Morcego (e default): perseguição reta
      const sp = this.speed * slow;
      this.setVelocity((dx / len) * sp, (dy / len) * sp);
    }

    this.setFlipX(dx < 0);
    this.setDepth(this.y + 10000); // sort com player e cenário
  }

  _shoot(target) {
    const scene = this.scene;
    const proj = scene.enemyProjPool.acquire();
    const dx = target.x - this.x,
      dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = 180;
    proj.fire(this.x, this.y, (dx / len) * sp, (dy / len) * sp, this.dmg * 1.0);
  }

  // Tiro do Mago: LENTO, grande e roxo — telegrafado, fácil de desviar mas dói
  _castBigShot(target) {
    const scene = this.scene;
    const proj = scene.enemyProjPool.acquire();
    const dx = target.x - this.x,
      dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = 135;
    proj.fire(this.x, this.y, (dx / len) * sp, (dy / len) * sp, this.dmg * 1.6, 2.2, 0xc26bff);
  }
}

// ============================================================================
// BOSS — Ent (criatura-árvore), 2 fases
// ============================================================================

export class BossEnt extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "creatures", FRAMES.BOSS);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE * 2.5);
    this.body.setCircle(7, 1, 1);
    this.maxHp = 0;
    this.hp = 0;
    this.dmg = 12;
    this.speed = 60;
    this.statuses = {};
    this.phase = 1;
    this.lastSpecialAt = 0;
    this.lastTouchAt = 0;
    this.contactCooldownMs = 450; // boss bate um pouco mais lento que os comuns
    this._kind = "boss";
    this._lungeUntil = 0;
    this._lungeVX = 0; this._lungeVY = 0;
  }

  activate(maxHp) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.statuses = {};
    this.phase = 1;
    this.lastSpecialAt = 0;
    this.lastTouchAt = 0;
    this._lungeUntil = 0;
    this.clearTint();
    this.setActive(true).setVisible(true);
    this.body.enable = true;
  }

  takeDamage(dmg) {
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    this.hp -= dmg * iceAmp;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (!this.active) return;
      this.scene.elemental?._updateTint(this);
    });
    if (this.hp <= 0) return true;
    // Transição de fase
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.speed = 90;
      this.scene.cameras.main.shake(400, 0.012);
      this.scene.sound.play("sfx_boss_roar", { volume: 0.7 });
    }
    return false;
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;

    // INVESTIDA: durante a lunge, voa em linha reta (não persegue, não usa especial)
    if (time < this._lungeUntil) {
      this.setVelocity(this._lungeVX, this._lungeVY);
      this.setFlipX(this._lungeVX < 0);
      this.setDepth(this.y + 10000);
      return;
    }

    let slow = 1;
    if (this.statuses.ice) slow *= 0.5;
    const dx = target.x - this.x,
      dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.speed * slow;
    this.setVelocity((dx / len) * sp, (dy / len) * sp);
    this.setFlipX(dx < 0);
    this.setDepth(this.y + 10000);

    // Especiais — rotação por fase
    const interval = this.phase === 1 ? 3500 : 2000;
    if (time - this.lastSpecialAt > interval) {
      this.lastSpecialAt = time;
      const c = (this._specialCount = (this._specialCount || 0) + 1);
      if (this.phase === 1) {
        // slam → invoca → RAÍZES (prende o player)
        const pick = c % 3;
        if (pick === 0) this._aoeSlam();
        else if (pick === 1) this._summon("wolf", 3);
        else this._roots();
      } else {
        // Fase 2: mais agressivo — leque, raízes (com combo), investida, slam
        const pick = c % 5;
        if (pick === 0) { this._summon("crow", 3); this._fanVolley(); }
        else if (pick === 1) this._aoeSlam();
        else if (pick === 2) this._roots();
        else if (pick === 3) this._lunge();
        else { this._summon("wolf", 2); this._fanVolley(); }
      }
    }
  }

  _aoeSlam(cx = this.x, cy = this.y) {
    const scene = this.scene;
    const r = 180;
    const ring = scene.add
      .circle(cx, cy, 10, 0xff7a3c, 0)
      .setStrokeStyle(5, 0xff7a3c, 1)
      .setDepth(60);
    scene.tweens.add({
      targets: ring,
      radius: r,
      alpha: 0,
      duration: 600,
      onComplete: () => ring.destroy(),
    });
    scene.time.delayedCall(600, () => {
      const dx = scene.player.x - cx,
        dy = scene.player.y - cy;
      if (dx * dx + dy * dy <= r * r) {
        scene.player.takeDamage(this.dmg);
        if (scene.player.isDead()) scene._onGameOver();
      }
    });
  }

  _volley() {
    const scene = this.scene;
    const target = scene.player;
    for (let i = -1; i <= 1; i++) {
      const ang = Math.atan2(target.y - this.y, target.x - this.x) + i * 0.25;
      const proj = scene.enemyProjPool.acquire();
      const sp = 220;
      proj.fire(this.x, this.y, Math.cos(ang) * sp, Math.sin(ang) * sp, 8);
    }
  }

  // Fase 2: LEQUE de tiros — arco largo de 7 projéteis mirado no player
  _fanVolley() {
    const scene = this.scene;
    const target = scene.player;
    const base = Math.atan2(target.y - this.y, target.x - this.x);
    const n = 7, spread = 0.16;
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * spread;
      const proj = scene.enemyProjPool.acquire();
      const sp = 230;
      proj.fire(this.x, this.y, Math.cos(ang) * sp, Math.sin(ang) * sp, 8);
    }
  }

  // CONTROLE: telegrafa uma área na posição do player; se ele ficar, RAÍZES prendem.
  // Escapa saindo da área durante o aviso OU usando o DASH depois de preso.
  _roots() {
    const scene = this.scene;
    const px = scene.player.x, py = scene.player.y;
    const r = 95;
    const tel = scene.add.circle(px, py, r, 0x6a4a10, 0.22)
      .setStrokeStyle(3, 0x9a6a2a, 0.9).setDepth(55);
    scene.tweens.add({
      targets: tel, alpha: 0.5, yoyo: true, repeat: 2, duration: 230,
      onComplete: () => tel.destroy(),
    });
    // Durante o aviso, quem está na área é AGARRADO (anda devagar) — dasha pra sair!
    const r2 = r * r;
    scene.time.addEvent({
      delay: 80, repeat: 8,
      callback: () => {
        const dx = scene.player.x - px, dy = scene.player.y - py;
        if (dx * dx + dy * dy <= r2) scene.player.grabSlow(160);
      },
    });
    scene.time.delayedCall(720, () => {
      const dx = scene.player.x - px, dy = scene.player.y - py;
      if (dx * dx + dy * dy <= r2) {
        const dur = 1300;
        const lx = scene.player.x, ly = scene.player.y;
        scene.player.root(dur);
        scene.sound.play("sfx_boss_roar", { volume: 0.4, rate: 1.5 });
        this._rootVisual(lx, ly, dur);
        // COMBO Raiz→Baque: preso, leva o slam no local (devia ter desviado a tempo!)
        scene.time.delayedCall(400, () => this._aoeSlam(lx, ly));
      }
    });
  }

  _rootVisual(x, y, dur) {
    const scene = this.scene;
    const g = scene.add.graphics().setDepth(y + 10001);
    g.lineStyle(4, 0x7a4a1a, 1);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const r1 = 12, r2 = 30 + Math.random() * 10;
      const x1 = x + Math.cos(ang) * r1, y1 = y + Math.sin(ang) * r1;
      const mx = x + Math.cos(ang) * (r2 * 0.6) + (Math.random() - 0.5) * 8;
      const my = y + Math.sin(ang) * (r2 * 0.6) - 8;
      const x2 = x + Math.cos(ang) * r2, y2 = y + Math.sin(ang) * r2 - 16;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(mx, my); g.lineTo(x2, y2); g.strokePath();
    }
    scene.tweens.add({ targets: g, alpha: 0, duration: dur, onComplete: () => g.destroy() });
  }

  // INVESTIDA: telegrafa uma linha na direção do player e avança rápido — desvie de lado!
  _lunge() {
    const scene = this.scene;
    const target = scene.player;
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    const ind = scene.add.rectangle(this.x, this.y, 340, 12, 0xff7a3c, 0.5)
      .setOrigin(0, 0.5).setDepth(56).setRotation(ang);
    scene.tweens.add({ targets: ind, alpha: 0, duration: 600, onComplete: () => ind.destroy() });
    scene.time.delayedCall(600, () => {
      if (!this.active) return;
      const sp = 620;
      this._lungeVX = Math.cos(ang) * sp;
      this._lungeVY = Math.sin(ang) * sp;
      this._lungeUntil = scene.time.now + 420;
      scene.sound.play("sfx_boss_roar", { volume: 0.5, rate: 1.1 });
    });
  }

  _summon(kind, count) {
    const scene = this.scene;
    const wave = Math.floor(scene.elapsedMs / 30000);
    // Aviso visual do próprio boss: pulso roxo
    const pulse = scene.add
      .circle(this.x, this.y, 30, 0xd98cff, 0.5)
      .setDepth(55);
    scene.tweens.add({
      targets: pulse,
      radius: 70,
      alpha: 0,
      duration: 500,
      onComplete: () => pulse.destroy(),
    });

    for (let i = 0; i < count; i++) {
      if (scene.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) break;
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const sx = this.x + Math.cos(ang) * 90;
      const sy = this.y + Math.sin(ang) * 90;
      // Marca visual no ponto de spawn
      const spawn = scene.add.circle(sx, sy, 8, 0xd98cff, 0.7).setDepth(55);
      scene.tweens.add({
        targets: spawn,
        radius: 24,
        alpha: 0,
        duration: 350,
        onComplete: () => spawn.destroy(),
      });

      const e = scene.enemyPool.acquire();
      e.activate(sx, sy, kind, wave);
    }
  }
}

// Projétil simples de inimigo (goblin)
export class EnemyProjectile extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.core = scene.add
      .circle(0, 0, 6, 0xff5a6e, 1)
      .setStrokeStyle(2, 0x000000, 0.5);
    this.add([this.core]);
    scene.physics.add.existing(this);
    this.body.setCircle(7, -7, -7);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.dmg = 0;
    this.lifeUntil = 0;
  }
  fire(x, y, vx, vy, dmg, scale = 1, color = 0xff5a6e) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.lifeUntil = this.scene.time.now + 3000;
    this.core.setScale(scale).setFillStyle(color, 1);
  }
  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }
  update(time) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
  }
}
