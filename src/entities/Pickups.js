// XPGem (verde) + CoinPickup (dourado) + HeartPickup (vermelho) + AwakenOrb (dourado).
import { ENEMY, COLORS, DROPS } from '../config.js';

export class XPGem extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.glow = scene.add.circle(0, 0, 18, COLORS.XP, 0.45);
    this.gem  = scene.add.rectangle(0, 0, 14, 14, COLORS.XP).setStrokeStyle(2, 0xffffff, 1);
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
    this.gem.angle = (this.gem.angle + 1.5) % 360;
    const s = 1 + Math.sin(time / 200) * 0.2;
    this.glow.setScale(s);
    if (!player?.active) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < player.pickupRadius * 4) {
      const sp = this.magnetSpeed * (1 - Math.min(1, d / (player.pickupRadius * 4)) * 0.4);
      this.body.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else {
      this.body.setVelocity(0, 0);
    }
  }
}

// Coração de cura
export class HeartPickup extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.glow = scene.add.circle(0, 0, 16, COLORS.DANGER, 0.45);
    // Coração formado por 2 círculos + triângulo
    this.l = scene.add.circle(-3, -2, 5, 0xff3a55);
    this.r = scene.add.circle( 3, -2, 5, 0xff3a55);
    this.t = scene.add.triangle(0, 4, -8, -2, 8, -2, 0, 8, 0xff3a55);
    this.add([this.glow, this.l, this.r, this.t]);
    scene.physics.add.existing(this);
    this.body.setCircle(8, -8, -8);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
  }
  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
  }
  pickup() { this.setActive(false).setVisible(false); this.body.enable = false; }
  update(time, dt, player) {
    if (!this.active) return;
    const s = 1 + Math.sin(time / 200) * 0.18;
    this.glow.setScale(s);
    if (!player?.active) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < player.pickupRadius * 4) {
      const sp = 300 * (1 - Math.min(1, d / (player.pickupRadius * 4)) * 0.4);
      this.body.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else this.body.setVelocity(0, 0);
  }
}

// Orbe que recupera Despertar
export class AwakenOrb extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.glow = scene.add.circle(0, 0, 18, 0xffd96b, 0.5);
    this.core = scene.add.circle(0, 0, 7, 0xfff5b8).setStrokeStyle(2, 0xb88040, 1);
    this.spark1 = scene.add.rectangle(0, -10, 2, 6, 0xfff5b8);
    this.spark2 = scene.add.rectangle(0,  10, 2, 6, 0xfff5b8);
    this.spark3 = scene.add.rectangle(-10, 0, 6, 2, 0xfff5b8);
    this.spark4 = scene.add.rectangle( 10, 0, 6, 2, 0xfff5b8);
    this.add([this.glow, this.core, this.spark1, this.spark2, this.spark3, this.spark4]);
    scene.physics.add.existing(this);
    this.body.setCircle(8, -8, -8);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
  }
  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
  }
  pickup() { this.setActive(false).setVisible(false); this.body.enable = false; }
  update(time, dt, player) {
    if (!this.active) return;
    this.rotation += dt * 0.003;
    const s = 1 + Math.sin(time / 180) * 0.2;
    this.glow.setScale(s);
    if (!player?.active) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < player.pickupRadius * 4) {
      const sp = 320 * (1 - Math.min(1, d / (player.pickupRadius * 4)) * 0.4);
      this.body.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else this.body.setVelocity(0, 0);
  }
}

export class CoinPickup extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.glow = scene.add.circle(0, 0, 16, COLORS.GOLD, 0.45);
    this.coin = scene.add.circle(0, 0, 8, COLORS.GOLD).setStrokeStyle(2, 0x6a4a10, 1);
    this.add([this.glow, this.coin]);
    scene.physics.add.existing(this);
    this.body.setCircle(8, -8, -8);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.magnetSpeed = 300;
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
    const s = 1 + Math.sin(time / 250) * 0.2;
    this.glow.setScale(s);
    if (!player?.active) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < player.pickupRadius * 5) {
      const sp = this.magnetSpeed * (1 - Math.min(1, d / (player.pickupRadius * 5)) * 0.4);
      this.body.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else {
      this.body.setVelocity(0, 0);
    }
  }
}
