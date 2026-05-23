// XPGem: diamante verde rotativo. Magnetiza quando próximo do player.
import { ENEMY, COLORS } from '../config.js';

export class XPGem extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);

    // Glow grande
    this.glow = scene.add.circle(0, 0, 18, COLORS.XP, 0.45);
    // Diamante (rectangle rotacionado) — bem visível
    this.gem = scene.add.rectangle(0, 0, 14, 14, COLORS.XP).setStrokeStyle(2, 0xffffff, 1);
    this.gem.setAngle(45);
    this.add([this.glow, this.gem]);

    scene.physics.add.existing(this);
    this.body.setCircle(8, -8, -8);
    this.setActive(false).setVisible(false);
    this.body.enable = false;

    this.xpValue = ENEMY.XP_VALUE;
    this.magnetSpeed = 380;
  }

  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
  }

  pickup() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
  }

  update(time, dt, player) {
    if (!this.active) return;
    // Rotação visual
    this.gem.angle = (this.gem.angle + 1.5) % 360;
    const s = 1 + Math.sin(time / 200) * 0.2;
    this.glow.setScale(s);

    // Magnetismo
    if (!player?.active) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d  = Math.hypot(dx, dy);
    if (d < player.pickupRadius * 4) {
      const sp = this.magnetSpeed * (1 - Math.min(1, d / (player.pickupRadius * 4)) * 0.4);
      this.body.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else {
      this.body.setVelocity(0, 0);
    }
  }
}
