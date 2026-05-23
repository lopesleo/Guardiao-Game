// XPGem: dropa quando inimigo morre, segue o player quando próximo.
import { ENEMY, COLORS, GAME } from '../config.js';

// Frame de "gem" no tilemap_packed do Tiny Dungeon (16x16).
const GEM_FRAME = 60;

export class XPGem extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    super(scene, -9999, -9999, 'dungeon_tiles', GEM_FRAME);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE * 0.7);
    this.setTint(COLORS.XP);
    this.body.setCircle(4, 4, 4);
    this.setActive(false).setVisible(false);
    this.body.enable = false;

    this.xpValue = ENEMY.XP_VALUE;
    this.magnetSpeed = 320;
  }

  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setVelocity(0, 0);
  }

  pickup() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
  }

  update(time, dt, player) {
    if (!this.active || !player?.active) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d  = Math.hypot(dx, dy);
    if (d < player.pickupRadius * 4) {
      // magnet: acelera em direção ao player conforme se aproxima
      const sp = this.magnetSpeed * (1 - Math.min(1, d / (player.pickupRadius * 4)) * 0.5);
      this.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else {
      this.setVelocity(0, 0);
    }
  }
}
