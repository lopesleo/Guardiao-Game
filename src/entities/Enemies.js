// Inimigos + Boss. Arte 100% própria (src/art/Monsters.js): cada tipo tem
// uma tira "mon_<tipo>" e a animação "<tipo>_move".
import { ENEMY, GAME, COLORS, ELITE, MIMIC, BOSS } from "../config.js";
import { dangerZone, shockwave, chargeLine, rootsBurst, summonPulse } from "../art/Telegraph.js";

// textura + animação por tipo (mini-chefes e mímico têm arte própria)
const LOOK = {
  wolf: ["mon_wolf", "wolf_move"],
  crow: ["mon_crow", "crow_move"],
  goblin: ["mon_goblin", "goblin_move"],
  mage: ["mon_mage", "mage_move"],
  brute: ["mon_brute", "brute_move"],
  bee: ["mon_bee", "bee_move"],
  shroom: ["mon_shroom", "shroom_move"],
  alpha: ["mon_alpha", "alpha_move"],
  elder: ["mon_elder", "elder_move"],
  mimic: ["obj_chest", "mimic_bite"],
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "mon_wolf", 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE);

    // Sombra "blob" no chão — aterra o sprite no cenário (segue em update)
    this.shadow = scene.add
      .image(x, y, "px_shadow")
      .setDepth(4)
      .setVisible(false);
    // Contorno luminoso de ELITE/mímico (silhueta chapada atrás do sprite)
    this.rim = scene.add.sprite(x, y, "mon_wolf", 0).setVisible(false);
    this.rimColor = null;

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

  // Aplica a arte do tipo: textura, animação e corpo físico no "pé" do sprite
  _look(type) {
    const [tex, anim] = LOOK[type] ?? LOOK.wolf;
    this.setTexture(tex, 0);
    this.play({ key: anim, startFrame: Math.floor(Math.random() * 2) });
    const w = this.frame.width,
      h = this.frame.height;
    const r = Math.max(4, Math.round(Math.min(w, h) * 0.3));
    this.body.setCircle(r, w / 2 - r, h - 2 * r - 1);
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
    this.rimColor = null;
    this._look(kind);

    if (kind === "wolf") {
      this.speed = ENEMY.SPEED_WOLF;
      this.maxHp *= 0.7;
      this.hp = this.maxHp;
    } else if (kind === "crow") {
      this.speed = ENEMY.SPEED_CROW;
      this.maxHp *= 0.55;
      this.hp = this.maxHp;
    } else if (kind === "goblin") {
      this.speed = ENEMY.SPEED_GOBLIN;
      this.maxHp *= 1.3;
      this.hp = this.maxHp;
    } else if (kind === "mage") {
      // Mago: lento, mantém distância e solta projétil telegrafado (dá pra desviar)
      this.speed = 110; // era 70 (anti-kite; ainda < player 160)
      this.maxHp *= 1.1;
      this.hp = this.maxHp;
      this._shotRange = 300;
    } else if (kind === "brute") {
      // Brutamontes: tanque lento e grande que bate MUITO forte no contato
      this.speed = 85; // era 55: continua o tanque mais lento, mas não dá pra ignorar andando
      this.maxHp *= 3.0;
      this.hp = this.maxHp;
      this.dmg *= 1.8;
      this.contactRadius = 44;
    } else if (kind === "bee") {
      // Vespa: muito rápida e frágil — vem em enxame, pune quem fica parado
      this.speed = 205;
      this.maxHp *= 0.35;
      this.hp = this.maxHp;
      this.dmg *= 0.45;
      this.contactRadius = 22;
    } else if (kind === "shroom") {
      // Cogumelo: lento; ao morrer vira uma nuvem de esporos que fere o player
      this.speed = 80;
      this.maxHp *= 1.2;
      this.hp = this.maxHp;
    } else {
      this.speed = ENEMY.SPEED_WOLF;
    }

    // Elite ('elite' string) ou mimic ('mimic')
    // MINI-CHEFE (evento da partida): grande, contorno dourado, muito HP,
    // derruba baú dourado + gema grande ao morrer.
    if (elite === "alpha" || elite === "elder") {
      const alpha = elite === "alpha";
      this._look(alpha ? "alpha" : "elder");
      this._kind = "wolf"; // perseguição melee
      this.setScale(GAME.PIXEL_SCALE * (alpha ? 1.7 : 1.6));
      this.maxHp = Math.max(ENEMY.HP(wave) * (alpha ? 16 : 28), alpha ? 420 : 950);
      this.hp = this.maxHp;
      this.dmg = ENEMY.DMG(wave) * (alpha ? 1.6 : 2.4);
      this.speed = alpha ? 132 : 95; // < 160 do herói: dá pra kitar
      this.contactRadius = alpha ? 50 : 62;
      this.rimColor = 0xf2c14e;
      this.miniBoss = alpha ? "MULA SEM CABEÇA" : "CORPO-SECO";
    } else this.miniBoss = null;

    if (elite === "mimic") {
      this._look("mimic");
      this.setScale(GAME.PIXEL_SCALE * 1.5);
      // HP com piso (não escala só com wave) + dano e velocidade próprios
      this.maxHp = Math.max(ENEMY.HP(wave) * MIMIC.HP_MULT, MIMIC.HP_FLOOR);
      this.hp = this.maxHp;
      this.dmg = ENEMY.DMG(wave) * MIMIC.DMG_MULT;
      this.speed = MIMIC.SPEED;
      this.contactRadius = MIMIC.CONTACT_RADIUS;
      // Força perseguição melee (não fica atirando de longe como goblin)
      this._kind = "wolf";
      this.rimColor = MIMIC.TINT;
    } else if (elite === true) {
      this.setScale(GAME.PIXEL_SCALE * 1.3);
      this.maxHp *= ELITE.HP_MULT;
      this.hp = this.maxHp;
      this.contactRadius = ELITE.CONTACT_RADIUS;
      this.rimColor = ELITE.TINT;
    }

    // Dificuldade ("Perigo") — escala HP/dano por último, sobre todos os caminhos.
    const diff = this.scene.diff;
    if (diff) {
      this.maxHp *= diff.hpMult;
      this.hp = this.maxHp;
      this.dmg *= diff.dmgMult;
    }
    // Noite Eterna: força composta pelo tempo além da vitória
    const em = this.scene.endlessMult?.();
    if (em) {
      this.maxHp *= em.hp;
      this.hp = this.maxHp;
      this.dmg *= em.dmg;
    }

    this._baseScale = this.scaleX; // squash de crítico é relativo a isto
    // Sombra proporcional ao tamanho final (elite/mímico são maiores)
    this.shadow
      .setScale((this.displayWidth * 0.8) / 14, GAME.PIXEL_SCALE * (this.displayWidth > 90 ? 1.4 : 1))
      .setPosition(x, y + this.displayHeight * 0.46)
      .setVisible(true);
    if (this.rimColor) {
      this.rim
        .setTexture(this.texture.key, this.frame.name)
        .setTintFill(this.rimColor)
        .setVisible(true);
      this._syncRim(0);
    } else this.rim.setVisible(false);
  }

  _syncRim(time) {
    const k = 1 + 2 / this.frame.width; // 1 pixel de arte a mais de cada lado
    this.rim
      .setFrame(this.frame.name)
      .setPosition(this.x, this.y)
      .setScale(this.scaleX * k, this.scaleY * k)
      .setFlipX(this.flipX)
      .setDepth(this.depth - 1)
      .setAlpha(0.65 + Math.sin(time / 120) * 0.3);
  }

  deactivate() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
    this.shadow.setVisible(false);
    this.rim.setVisible(false);
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
        scaleX: (this._baseScale ?? GAME.PIXEL_SCALE) * 1.3,
        scaleY: (this._baseScale ?? GAME.PIXEL_SCALE) * 0.75,
        duration: 80,
        yoyo: true,
        onComplete: () => this.active && this.setScale(this._baseScale ?? GAME.PIXEL_SCALE),
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
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46);

    // CONGELADO: para tudo (não anda, não atira), mas continua tomando dano.
    if (this.isFrozen(time)) {
      this.setVelocity(0, 0);
      this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
      if (!this._frozenVisual) {
        this.setTint(0x8fe3ff);
        this._frozenVisual = true;
        this.anims.pause();
      }
      if (this.rimColor) this._syncRim(time);
      return;
    }
    if (this._frozenVisual) {
      this._frozenVisual = false;
      this.anims.resume();
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
            duration: 350,
            yoyo: true,
          });
        }
      }
    } else {
      // Morcego (e default): perseguição reta
      const sp = this.speed * slow;
      this.setVelocity((dx / len) * sp, (dy / len) * sp);
    }

    this.setFlipX(dx < 0);
    this.setDepth(this.y + this.displayHeight * 0.45 + 10000); // sort com player e cenário
    if (this.rimColor) this._syncRim(time);
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
    proj.fire(
      this.x,
      this.y,
      (dx / len) * sp,
      (dy / len) * sp,
      this.dmg * 1.6,
      2.2,
      0xc26bff,
    );
  }
}

// ============================================================================
// BOSS — Ent (criatura-árvore), 2 fases
// ============================================================================

export class BossEnt extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "mon_boss", 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this._bossScale = GAME.PIXEL_SCALE * 1.1; // arte de 50×56 → ~165px: chefe tem que impor
    this.setScale(this._bossScale);
    this.body.setCircle(10, 15, 34);
    this.play("boss_idle");
    // Sombra grande do boss (mesma mecânica dos inimigos comuns)
    this.shadow = scene.add
      .image(x, y, "px_shadow")
      .setScale((GAME.PIXEL_SCALE * this.displayWidth) / 48)
      .setDepth(4)
      .setVisible(false);
    this.maxHp = 0;
    this.hp = 0;
    this.dmg = BOSS.DMG_MELEE; // a escala do Perigo é aplicada na GameScene
    this.speed = 60;
    this.statuses = {};
    this.phase = 1;
    this.lastSpecialAt = 0;
    this.lastTouchAt = 0;
    this.contactCooldownMs = 450; // boss bate um pouco mais lento que os comuns
    this._kind = "boss";
    this._lungeUntil = 0;
    this._lungeVX = 0;
    this._lungeVY = 0;
    // Transição de fase ("êxtase"): boss invulnerável e parado enquanto a barra recarrega
    this._transitioning = false;
    this._transitionEnd = 0;
    this._displayFill = 1; // fração da barra controlada pela animação de recarga
    this._furyPulse = null;
  }

  activate(maxHp) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.statuses = {};
    this.phase = 1;
    this.lastSpecialAt = 0;
    this.lastTouchAt = 0;
    this._lungeUntil = 0;
    this._transitioning = false;
    this._transitionEnd = 0;
    this._displayFill = 1;
    this._furyPulse?.stop();
    this._furyPulse = null;
    this.clearTint();
    this.play("boss_idle");
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46).setVisible(true);
  }

  deactivate() {
    this.shadow.setVisible(false);
  }

  takeDamage(dmg) {
    // Invulnerável durante o êxtase da virada de fase (a barra está recarregando)
    if (this._transitioning) return false;
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    this.hp -= dmg * iceAmp;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (!this.active) return;
      this.scene.elemental?._updateTint(this);
    });
    if (this.hp <= 0) return true;
    // Transição de fase — entra em FÚRIA (êxtase) e a barra recarrega 0→100%
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this._enterFury();
    }
    return false;
  }

  // Êxtase da virada: boss parado e invulnerável ~1.3s, pulsando, enquanto a
  // barra de vida recarrega de 0 a 100% (ver HUD lê _transitioning/_displayFill).
  _enterFury() {
    const scene = this.scene;
    const DURATION = 1300;
    this.phase = 2;
    this.speed = 90;
    this._transitioning = true;
    this._transitionEnd = scene.time.now + DURATION;
    this._displayFill = 0;
    this.setVelocity(0, 0);
    scene.cameras.main.shake(500, 0.014);
    scene.sound.play("sfx_boss_roar", { volume: 0.85 });
    scene.hud?.showBossBanner("FÚRIA!");

    // Tint quente + pulso de escala (êxtase)
    const base = this._bossScale;
    // Fase 2: a Podridão no Mapinguari entra em brasa (quadros próprios)
    this.play("boss_fury");
    this._furyPulse = scene.tweens.add({
      targets: this,
      scaleX: base * 1.14,
      scaleY: base * 1.14,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // Barra recarrega 0→100% (anima a propriedade lida pela HUD)
    scene.tweens.add({
      targets: this,
      _displayFill: 1,
      duration: DURATION,
      ease: "Cubic.easeOut",
    });
    // Anel de energia expandindo
    shockwave(scene, this.x, this.y, 240, 0xff8a1e);
    scene.time.delayedCall(250, () => this.active && shockwave(scene, this.x, this.y, 180, 0xffb24c));
  }

  // Encerra o êxtase: para o pulso, normaliza escala/tint, libera o boss.
  _endFury() {
    this._transitioning = false;
    this._displayFill = 1;
    this._furyPulse?.stop();
    this._furyPulse = null;
    this.setScale(this._bossScale);
    this.scene.elemental?._updateTint(this);
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46);

    // ÊXTASE: parado, invulnerável e pulsando enquanto a barra recarrega
    if (this._transitioning) {
      if (time >= this._transitionEnd) {
        this._endFury();
      } else {
        this.setVelocity(0, 0);
        this.setFlipX(target.x - this.x < 0);
        this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
        return;
      }
    }

    // INVESTIDA: durante a lunge, voa em linha reta (não persegue, não usa especial)
    if (time < this._lungeUntil) {
      this.setVelocity(this._lungeVX, this._lungeVY);
      this.setFlipX(this._lungeVX < 0);
      this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
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
    this.setDepth(this.y + this.displayHeight * 0.45 + 10000);

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
        if (pick === 0) {
          this._summon("crow", 3);
          this._fanVolley();
        } else if (pick === 1) this._aoeSlam();
        else if (pick === 2) this._roots();
        else if (pick === 3) this._lunge();
        else {
          this._summon("wolf", 2);
          this._fanVolley();
        }
      }
    }
  }

  // BAQUE: zona carrega por 600ms; quem estiver dentro no fim leva o golpe
  _aoeSlam(cx = this.x, cy = this.y) {
    const scene = this.scene;
    const r = 180;
    dangerZone(scene, cx, cy, r, 600, 0xff7a3c, () => {
      if (!this.active) return;
      shockwave(scene, cx, cy, r);
      scene.cameras.main.shake(180, 0.008);
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
      proj.fire(this.x, this.y, Math.cos(ang) * sp, Math.sin(ang) * sp, BOSS.DMG_PROJECTILE * (scene.diff?.dmgMult ?? 1));
    }
  }

  // Fase 2: LEQUE de tiros — arco largo de 7 projéteis mirado no player
  _fanVolley() {
    const scene = this.scene;
    const target = scene.player;
    const base = Math.atan2(target.y - this.y, target.x - this.x);
    const n = 7,
      spread = 0.16;
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * spread;
      const proj = scene.enemyProjPool.acquire();
      const sp = 230;
      proj.fire(this.x, this.y, Math.cos(ang) * sp, Math.sin(ang) * sp, BOSS.DMG_PROJECTILE * (scene.diff?.dmgMult ?? 1));
    }
  }

  // CONTROLE: telegrafa uma área na posição do player; se ele ficar, RAÍZES prendem.
  // Escapa saindo da área durante o aviso OU usando o DASH depois de preso.
  _roots() {
    const scene = this.scene;
    const px = scene.player.x,
      py = scene.player.y;
    const r = 95;
    dangerZone(scene, px, py, r, 720, 0x9ccf62);
    // Durante o aviso, quem está na área é AGARRADO (anda devagar) — dasha pra sair!
    const r2 = r * r;
    scene.time.addEvent({
      delay: 80,
      repeat: 8,
      callback: () => {
        const dx = scene.player.x - px,
          dy = scene.player.y - py;
        if (dx * dx + dy * dy <= r2) scene.player.grabSlow(160);
      },
    });
    scene.time.delayedCall(720, () => {
      const dx = scene.player.x - px,
        dy = scene.player.y - py;
      if (dx * dx + dy * dy <= r2) {
        const dur = 1300;
        const lx = scene.player.x,
          ly = scene.player.y;
        scene.player.root(dur);
        scene.sound.play("sfx_boss_roar", { volume: 0.4, rate: 1.5 });
        this._rootVisual(lx, ly, dur);
        // COMBO Raiz→Baque: preso, leva o slam no local (devia ter desviado a tempo!)
        scene.time.delayedCall(400, () => this._aoeSlam(lx, ly));
      }
    });
  }

  _rootVisual(x, y, dur) {
    rootsBurst(this.scene, x, y, 60, dur);
  }

  // INVESTIDA: telegrafa uma linha na direção do player e avança rápido — desvie de lado!
  _lunge() {
    const scene = this.scene;
    const target = scene.player;
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    chargeLine(scene, this.x, this.y, ang, 340, 600);
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
    const wave = scene.waveIndex();
    // Aviso visual do próprio boss: pulso roxo
    summonPulse(scene, this.x, this.y);

    for (let i = 0; i < count; i++) {
      if (scene.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) break;
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const sx = this.x + Math.cos(ang) * 90;
      const sy = this.y + Math.sin(ang) * 90;
      // Marca visual no ponto de spawn
      summonPulse(scene, sx, sy);

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
    // Tiro inimigo: esfera vermelha pixelada com halo — sempre "cor de perigo"
    this.glow = scene.add
      .image(0, 0, "fx_glow")
      .setScale(0.6)
      .setTint(0xff3040)
      .setAlpha(0.6)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.core = scene.add.image(0, 0, "px_eshot").setScale(GAME.PIXEL_SCALE);
    this.add([this.glow, this.core]);
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
    this.core.setScale(GAME.PIXEL_SCALE * scale).setTint(color === 0xff5a6e ? 0xffffff : color);
    this.glow.setScale(0.6 * scale).setTint(color === 0xff5a6e ? 0xff3040 : color);
    this.setDepth(60);
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
