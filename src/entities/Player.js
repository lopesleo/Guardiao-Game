// Player — Guardião da Floresta.
// D1: movimento + sprite. Sistema de armas adicionado via player.addWeapon().

import { PLAYER, GAME, COLORS } from '../config.js';

// Frame do sprite no tilemap_packed do Tiny Dungeon (16x16, 12 cols).
// Linha de personagens humanóides começa por volta do frame 84.
// Ajuste se quiser outro look (vamos tunar visualmente no D3).
const PLAYER_FRAME = 84;

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'dungeon_tiles', PLAYER_FRAME);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(GAME.PIXEL_SCALE);
    this.setCollideWorldBounds(false);
    this.body.setCircle(7, 1, 1);              // hitbox circular 14px
    this.body.setMaxSpeed(PLAYER.SPEED_BASE * 2);

    // Stats (mutáveis por upgrades)
    this.maxHp     = PLAYER.HP_BASE;
    this.hp        = this.maxHp;
    this.speed     = PLAYER.SPEED_BASE;
    this.cdMult    = 1.0;
    this.areaMult  = 1.0;
    this.extraProj = 0;
    this.pickupRadius = PLAYER.PICKUP_RADIUS;

    // Progressão dentro da run
    this.level = 1;
    this.xp    = 0;

    // Estado
    this.invulnUntil = 0;
    this.weapons = [];     // instâncias de Weapon

    // Indicador de direção (pra escolher orientação do sprite)
    this.facingX = 1;
  }

  addWeapon(weapon) {
    this.weapons.push(weapon);
    weapon.owner = this;
  }

  takeDamage(dmg) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnUntil = now + PLAYER.INVULN_MS;
    this.scene.sound.play('sfx_player_hit', { volume: 0.7 });
    // flash vermelho rápido
    this.setTint(0xff5a6e);
    this.scene.time.delayedCall(120, () => this.clearTint());
    return true;
  }

  gainXp(amount) {
    this.xp += amount;
    const need = PLAYER.XP_PER_LEVEL(this.level);
    if (this.xp >= need) {
      this.xp -= need;
      this.level += 1;
      this.scene.events.emit('player:levelup', this.level);
      this.scene.sound.play('sfx_levelup', { volume: 0.6 });
    }
  }

  update(time, dt, input) {
    // Movimento
    const vx = input.move.x * this.speed;
    const vy = input.move.y * this.speed;
    this.setVelocity(vx, vy);

    if (input.move.x !== 0) this.facingX = Math.sign(input.move.x);
    this.setFlipX(this.facingX < 0);

    // Atualiza armas (auto-attack)
    for (const w of this.weapons) w.update(time, dt);
  }

  isDead() { return this.hp <= 0; }
}
