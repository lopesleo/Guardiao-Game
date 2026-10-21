// Inimigos (o chefe está em Bosses.js). Arte 100% própria (src/art/Monsters.js): cada tipo tem
// uma tira "mon_<tipo>" e a animação "<tipo>_move".
import { ENEMY, GAME, ELITE, MIMIC, BOSS_FIGHT } from "../config.js";
import { MulaBrain, SecoBrain } from "./Bosses.js";
import { tr } from "../i18n/i18n.js";

// O chefe (Mapinguari) mora em Bosses.js junto com os golpes dos minichefes
export { BossEnt } from "./Bosses.js";

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
  // Caatinga (BIOMES.caatinga.looks): mesma criatura, arte do sertão
  calango: ["mon_calango", "calango_move"],
  carcara: ["mon_carcara", "carcara_move"],
  frade: ["mon_frade", "frade_move"],
  cabra: ["mon_cabra", "cabra_move"],
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
    const [tex, anim] = LOOK[this.scene.biome?.looks?.[type] ?? type] ?? LOOK.wolf;
    this._moveAnim = anim; // os cérebros de minichefe voltam para esta animação
    this.setTexture(tex, 0);
    this.play({ key: anim, startFrame: Math.floor(Math.random() * 2) });
    const w = this.frame.width,
      h = this.frame.height;
    const r = Math.max(4, Math.round(Math.min(w, h) * 0.3));
    this.body.setCircle(r, w / 2 - r, h - 2 * r - 1);
  }

  activate(x, y, kind, wave, elite = false) {
    this._life = (this._life ?? 0) + 1; // vida nova no pool (efeitos atrasados conferem)
    this._kind = kind;
    this._elite = elite;
    this._challengeId = null; // inimigo é reaproveitado (pool): zera a marca de desafio de santuário
    this.setActive(true).setVisible(true);
    this.setPosition(x, y);
    this.body.enable = true;
    this.maxHp = ENEMY.HP(wave);
    this.hp = this.maxHp;
    this.dmg = ENEMY.DMG(wave);
    this.statuses = {};
    this._lastEl = null; // elemento do último golpe (decide o efeito da morte)
    this._punch = 0; // "soco" visual do último golpe (achata e volta)
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
    this._lureUntil = 0; // Miragem: anda até a ilusão em vez do herói
    this._bindUntil = 0; // Boleadeira: amarrado (quase não anda)
    this._bindSlow = 1;
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
      this.miniBoss = this.scene.biome?.minis?.[elite]?.name ?? (alpha ? tr("MULA SEM CABEÇA") : tr("CORPO-SECO"));
    } else this.miniBoss = null;
    // Cérebro de golpes especiais (só minichefes; criado depois da escala final)
    this._brain?.dispose();
    this._brain = null;
    this._exposedUntil = 0;
    this._buried = false;
    this.setAlpha(1).setAngle(0);

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
    if (elite === "alpha") this._brain = new MulaBrain(this);
    else if (elite === "elder") this._brain = new SecoBrain(this);
    // Sombra proporcional ao tamanho final (elite/mímico são maiores)
    this.shadow
      .setScale((this.displayWidth * 0.8) / 14, GAME.PIXEL_SCALE * (this.displayWidth > 90 ? 1.4 : 1))
      .setPosition(x, y + this.displayHeight * 0.46)
      .setVisible(true);
    if (this.rimColor) {
      this.rim
        .setTexture(this.texture.key, this.frame.name)
        .setTint(this.rimColor).setTintMode(Phaser.TintModes.FILL)
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
      .setAlpha((0.65 + Math.sin(time / 120) * 0.3) * this.alpha); // some junto (Corpo-Seco afundando)
  }

  deactivate() {
    this._brain?.dispose();
    this._brain = null;
    this._buried = false;
    this.setAlpha(1).setAngle(0);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
    this.shadow.setVisible(false);
    this.rim.setVisible(false);
  }

  // Aplicar dano. crit = true ativa BONK (knockback + squash forte + flash dourado).
  // soft = tique (queimadura, choque, nuvem): sem pisca-branco nem som de golpe —
  // 8 tiques/s piscando viravam ruído e escondiam os golpes de verdade.
  takeDamage(dmg, element = null, fromX = null, fromY = null, crit = false, soft = false) {
    // Livro de dano (balanceamento): quem bateu marca scene._dmgSrc logo antes; consome aqui
    const src = this.scene._dmgSrc;
    const assist = this.scene._dmgAssist; // reação: armas que montaram o par
    this.scene._dmgSrc = this.scene._dmgAssist = null;
    const before = this.hp;
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    // Ponto fraco aberto (golpe especial de minichefe): leva mais dano
    const amp = this.scene.time.now < this._exposedUntil ? this._exposedMult ?? BOSS_FIGHT.EXPOSED_MULT : 1;
    this.hp -= dmg * iceAmp * amp;
    this.scene._recordDmg?.(src, Math.min(Math.max(before, 0), before - this.hp), assist); // sem o excesso do golpe final
    if (amp > 1) this.scene._markAmp?.(this, amp);

    // "Soco": achata e volta (em update). Golpe empurra 3px no sentido dele.
    this._punch = Math.max(this._punch || 0, soft ? 0.3 : crit ? 1.6 : 1);
    if (soft) {
      if (element) this.scene.elemental?.applyStatus(this, element);
      return this.hp <= 0;
    }
    if (fromX != null && fromY != null && !this.isFrozen(this.scene.time.now)) {
      const dx = this.x - fromX,
        dy = this.y - fromY;
      const len = Math.hypot(dx, dy) || 1;
      this.x += (dx / len) * 3;
      this.y += (dy / len) * 3;
    }

    // FLASH: branco normal, DOURADO se crit ou no ponto fraco
    this.setTint(crit || amp > 1 ? 0xffd96b : 0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(crit ? 110 : 60, () => {
      if (!this.active) return;
      this.scene.elemental?._updateTint(this);
    });

    if (crit) {
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

    this.scene.feel?.hit(this, crit, !!this.miniBoss);
    if (element) this.scene.elemental?.applyStatus(this, element);
    return this.hp <= 0;
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46);
    // Soco do golpe: segura durante o hit-stop (relógio dos tweens) e volta
    if (this._punch > 0) {
      this._punch = Math.max(0, this._punch - (dt * (this.scene.tweens.timeScale ?? 1)) / 120);
      if (!this._casting && !this._brain?.move) {
        const b = this._baseScale ?? GAME.PIXEL_SCALE,
          k = this._punch;
        this.setScale(b * (1 + 0.2 * k), b * (1 - 0.15 * k));
      }
    }

    // CONGELADO: para tudo (não anda, não atira), mas continua tomando dano.
    if (this.isFrozen(time)) {
      this.setVelocity(0, 0);
      this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
      if (!this._frozenVisual) {
        this._frozenVisual = true; // a cor de congelado vem do STATUS_LOOK (ElementalSystem._updateTint)
        this.scene.elemental?._updateTint(this);
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

    // Minichefe: o cérebro anda e golpeia (congelar pausa o golpe junto)
    if (this._brain) {
      this._brain.update(time, dt);
      this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
      if (this.rimColor && !this._buried) this._syncRim(time);
      return;
    }

    // Slow do gelo (Aura Gélida) e das cordas da Boleadeira
    let slow = 1;
    if (this.statuses.ice) slow *= 0.5;
    if (time < this._bindUntil) slow *= this._bindSlow;
    // Vento: mais leve e arrastado para longe do herói (chefe/minichefe não)
    if (this.statuses.wind && !this.miniBoss) {
      slow *= this.statuses.wind.def.slowFactor;
      const ax = this.x - target.x,
        ay = this.y - target.y;
      const al = Math.hypot(ax, ay) || 1;
      const k = (this.statuses.wind.def.drift * dt) / 1000;
      this.x += (ax / al) * k;
      this.y += (ay / al) * k;
    }

    // Miragem: quem foi atraído caminha até a ilusão (o tiro continua mirando o herói)
    const goal = time < this._lureUntil ? { x: this._lureX, y: this._lureY } : target;
    const dx = goal.x - this.x,
      dy = goal.y - this.y;
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
    // Sombra escura (blend normal) sob o halo: recorta o tiro do chão claro da Caatinga, onde o halo
    // aditivo virava só um brilho creme sobre a areia
    this.shade = scene.add.image(0, 0, "fx_glow").setScale(0.34).setTint(0x1a1420).setAlpha(0.45);
    this.add([this.shade, this.glow, this.core]);
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
    this.shade.setScale(0.34 * scale);
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
