// Player — Guardião da Floresta.
// Diferenciais: Despertar (R) e Dash (Shift/Space).
import { PLAYER, GAME, COLORS } from '../config.js';


export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, heroId = 'guardian') {
    super(scene, x, y, `hero_${heroId}`, 0);
    this.heroId = heroId;
    this.play(`${heroId}_idle`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(GAME.PIXEL_SCALE);
    this.setCollideWorldBounds(true);
    this.body.setCircle(6, 6, 14); // corpo na altura dos pés (quadro 24×28)
    this.body.setMaxSpeed(PLAYER.SPEED_BASE * 6); // permitir dash

    // Sombra "blob" no chão (segue em update)
    this.shadow = scene.add
      .image(x, y, "px_shadow")
      .setScale(GAME.PIXEL_SCALE * 1.15, GAME.PIXEL_SCALE)
      .setDepth(4);
    // Luz suave sob o herói — destaca o Guardião no chão escuro da floresta
    this.light = scene.add
      .image(x, y, "fx_glow")
      .setScale(2.6, 1.6)
      .setTint(0xfff2c0)
      .setAlpha(0.13)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5);

    // Stats
    this.maxHp     = PLAYER.HP_BASE;
    this.hp        = this.maxHp;
    this.speed     = PLAYER.SPEED_BASE;
    this.cdMult    = 1.0;
    this.areaMult  = 1.0;
    this.extraProj = 0;
    this.pickupRadius = PLAYER.PICKUP_RADIUS;

    this.level = 1;
    this.xp    = 0;

    this.invulnUntil = 0;
    this.weapons = [];
    this.facingX = 1;
    // Última direção de movimento (Sopro Flamejante mira pra onde você anda)
    this.lastMoveX = 1;
    this.lastMoveY = 0;
    this.isMoving = false;

    // Despertar (default DESTRAVADO até GameScene checar)
    this.awakenUnlocked = true;
    this.awakenMeter = 0;
    this.awakenedUntil = 0;
    this.awakenLockUntil = 0;

    // Dash (default DESTRAVADO até GameScene checar)
    this.dashUnlocked = true;
    this.dashUntil = 0;
    this.dashCdUntil = 0;
    this.dashDirX = 1; this.dashDirY = 0;
    this._rootedUntil = 0;   // preso por raízes (imóvel) — dash não quebra
    this._grabSlowUntil = 0; // área de raízes agarrando: anda devagar, precisa dashar pra sair

    // Passivas acumuláveis
    this.lifestealPct = 0;
    this.regenPerSec = 0;
    this._regenAcc = 0;
    this.critChance = 0.08;   // 8% base
    this.critMult = 2.0;      // 2x dano
    this.dmgTakenMult = 1;    // Casca de Carvalho (armadura %)
    this.luck = 0;            // Trevo da Sorte (+% drops)

    // Multiplicadores de bênçãos (setados via BLESSINGS.apply)
    this._xpMult = 1;
    this._awakenGainMult = 1;
    this._dashCdMult = 1;
    this._blessingDmgMult = 1;
  }

  // Cura por roubo de vida — chamado nos sites de dano em GameScene.
  lifestealFrom(dmg) {
    if (this.lifestealPct <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + dmg * this.lifestealPct);
  }

  // Cura/refill direto (usado por pickups).
  healHp(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  refillAwaken(amount) {
    if (this.scene.time.now < this.awakenLockUntil) return;
    this.awakenMeter = Math.min(this.awakenMax, this.awakenMeter + amount);
  }

  addWeapon(weapon) {
    this.weapons.push(weapon);
    weapon.owner = this;
  }

  takeDamage(dmg) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - dmg * this.dmgTakenMult);
    this.invulnUntil = now + PLAYER.INVULN_MS;
    this._hitFx(now);
    this.scene.feel?.hurt(dmg * this.dmgTakenMult);
    return true;
  }

  _hitFx() {
    this.scene.sound.play('sfx_player_hit', { volume: 0.7 });
    this.setTint(0xff5a6e);
    this.scene.time.delayedCall(120, () => {
      if (this.isAwakened()) this.setTint(0xffd96b);
      else this.clearTint();
    });
  }

  gainXp(amount) {
    this.xp += amount * this._xpMult;
    const need = PLAYER.XP_PER_LEVEL(this.level);
    if (this.xp >= need) {
      this.xp -= need;
      this.level += 1;
      this.scene.events.emit('player:levelup', this.level);
      this.scene.sound.play('sfx_levelup', { volume: 0.6 });
    }
  }

  // --- Despertar ---
  get awakenMax() { return PLAYER.AWAKEN_METER_MAX(this.level); }
  isAwakened() { return this.scene.time.now < this.awakenedUntil; }
  awakenReady() {
    if (!this.awakenUnlocked) return false;
    const now = this.scene.time.now;
    return this.awakenMeter >= this.awakenMax && now >= this.awakenLockUntil && !this.isAwakened();
  }
  addAwakenMeter(amount) {
    if (this.scene.time.now < this.awakenLockUntil) return;
    this.awakenMeter = Math.min(this.awakenMax, this.awakenMeter + amount * this._awakenGainMult);
  }
  tryActivateAwaken() {
    if (!this.awakenReady()) return false;
    const now = this.scene.time.now;
    this.awakenedUntil = now + PLAYER.AWAKEN_DURATION_MS;
    this.awakenMeter = 0;
    this.awakenLockUntil = this.awakenedUntil + PLAYER.AWAKEN_CD_AFTER_MS;
    // Feedback
    this.setTint(0xffd96b);
    this.scene.cameras.main.shake(300, 0.012);
    this.scene.cameras.main.flash(180, 240, 200, 80);
    this.scene.sound.play('sfx_boss_roar', { volume: 0.55, rate: 1.25 });
    return true;
  }
  _endAwakenedIfNeeded() {
    if (this.awakenedUntil && this.scene.time.now >= this.awakenedUntil && this.awakenedUntil > 0) {
      this.awakenedUntil = -1; // sentinel: já encerrou
      this.clearTint();
    }
  }

  // --- Raízes (controle do boss) ---
  isRooted() { return this.scene.time.now < this._rootedUntil; }
  root(durMs) { this._rootedUntil = this.scene.time.now + durMs; }
  isGrabbed() { return this.scene.time.now < this._grabSlowUntil; }
  grabSlow(durMs) { this._grabSlowUntil = this.scene.time.now + durMs; }

  // --- Dash ---
  isDashing() { return this.scene.time.now < this.dashUntil; }
  dashReady() { return this.dashUnlocked && this.scene.time.now >= this.dashCdUntil; }
  tryDash(dirX, dirY) {
    if (!this.dashUnlocked) return false;
    if (this.isRooted()) return false; // preso pelas raízes — o dash é pra DESVIAR antes, não quebrar
    if (!this.dashReady()) return false;
    const now = this.scene.time.now;
    let dx = dirX, dy = dirY;
    if (Math.abs(dx) + Math.abs(dy) < 0.05) { dx = this.facingX; dy = 0; }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len; this.dashDirY = dy / len;
    this.dashUntil = now + PLAYER.DASH_DURATION_MS;
    this.dashCdUntil = now + PLAYER.DASH_CD_MS * this._dashCdMult;
    this.invulnUntil = Math.max(this.invulnUntil, now + PLAYER.DASH_INVULN_MS);
    // trilha + SFX whoosh real
    this._dashTrail();
    this.scene.sound.play('sfx_dash', { volume: 0.5 });
    return true;
  }

  _dashTrail() {
    const scene = this.scene;
    for (let i = 0; i < 4; i++) {
      scene.time.delayedCall(i * 30, () => {
        const ghost = scene.add.sprite(this.x, this.y, this.texture.key, this.frame.name)
                          .setScale(this.scale).setAlpha(0.5).setTint(0xffffff).setDepth(this.depth - 1);
        ghost.setFlipX(this.flipX);
        scene.tweens.add({ targets: ghost, alpha: 0, duration: 250, onComplete: () => ghost.destroy() });
      });
    }
  }

  update(time, dt, input) {
    // Regen passivo (acumula frações de HP por dt)
    if (this.regenPerSec > 0 && this.hp < this.maxHp) {
      this._regenAcc += this.regenPerSec * (dt / 1000);
      if (this._regenAcc >= 1) {
        const amt = Math.floor(this._regenAcc);
        this.hp = Math.min(this.maxHp, this.hp + amt);
        this._regenAcc -= amt;
      }
    }

    // Despertar trigger
    if (input.consumeAwaken()) this.tryActivateAwaken();
    this._endAwakenedIfNeeded();

    // Dash trigger
    if (input.consumeDash()) this.tryDash(input.move.x, input.move.y);

    // Movimento
    let speedMult = 1;
    if (this.isAwakened()) speedMult *= PLAYER.AWAKEN_SPEED_MULT;

    if (this.isDashing()) {
      const sp = this.speed * PLAYER.DASH_SPEED_MULT;
      this.setVelocity(this.dashDirX * sp, this.dashDirY * sp);
    } else if (this.isRooted()) {
      this.setVelocity(0, 0); // preso — devia ter desviado da área com o dash a tempo
      if (input.move.x !== 0) this.facingX = Math.sign(input.move.x);
    } else {
      // Raízes agarrando: anda muito devagar (o dash ignora o slow e te tira a tempo)
      const mv = speedMult * (this.isGrabbed() ? 0.32 : 1);
      const vx = input.move.x * this.speed * mv;
      const vy = input.move.y * this.speed * mv;
      this.setVelocity(vx, vy);
      if (input.move.x !== 0) this.facingX = Math.sign(input.move.x);
    }
    this.setFlipX(this.facingX < 0);
    // Anima: andando vs. parado (troca só quando muda, pra não reiniciar o ciclo)
    const anim = `${this.heroId}_${this.isMoving || this.isDashing() ? 'walk' : 'idle'}`;
    if (this.anims.currentAnim?.key !== anim) this.play(anim);

    this.isMoving = Math.abs(input.move.x) + Math.abs(input.move.y) > 0.1;
    if (this.isMoving) {
      this.lastMoveX = input.move.x;
      this.lastMoveY = input.move.y;
    }

    // Armas (cooldown reduzido durante despertar)
    for (const w of this.weapons) w.update(time, dt);

    // Depth-sort por Y (offset +10000 garante sempre acima do floor deco)
    this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46);
    this.light.setPosition(this.x, this.y + this.displayHeight * 0.3);
  }

  // Multiplicador de cooldown final (usado por Weapon.cooldown)
  get effectiveCdMult() {
    return this.cdMult * (this.isAwakened() ? PLAYER.AWAKEN_CD_MULT : 1);
  }

  isDead() { return this.hp <= 0; }
}
