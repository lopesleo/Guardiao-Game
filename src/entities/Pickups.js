// Pickups em pixel-art: gema de XP, moeda, coração e orbe de Despertar.
// Nascem com um "pulinho" (arco) e são puxados por ímã ao chegar perto.
import { ENEMY, GAME } from "../config.js";

const S = GAME.PIXEL_SCALE;

class Pickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, texture, o = {}) {
    super(scene, -9999, -9999, texture, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(S);
    this.body.setCircle(4, this.width / 2 - 4, this.height / 2 - 4);
    this.magnetSpeed = o.magnet ?? 340;
    this.magnetMult = o.magnetMult ?? 4;
    this.anim = o.anim ?? null;
    this.glowTint = o.glow ?? null;
    if (this.glowTint != null) {
      this.glow = scene.add
        .image(0, 0, "fx_glow")
        .setScale(o.glowScale ?? 0.55)
        .setTint(this.glowTint)
        .setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
    }
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this._hop = null;
  }

  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
    this.setDepth(y + 9000);
    this._pulled = false;
    if (this.anim) this.play({ key: this.anim, startFrame: Math.floor(Math.random() * 3) });
    this.glow?.setVisible(true);
    // Pulinho de saída: arco rápido pra cima e quique
    this._hop?.stop();
    this._baseY = y;
    this.y = y;
    this._hop = this.scene.tweens.add({
      targets: this,
      y: { from: y, to: y - 14 },
      duration: 140,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  pickup() {
    this._hop?.stop();
    this.stop();
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.glow?.setVisible(false);
  }

  update(time, dt, player) {
    if (!this.active) return;
    if (this.glow) {
      this.glow.setPosition(this.x, this.y);
      this.glow.setAlpha(0.35 + Math.sin(time / 220 + this.x) * 0.15);
    }
    if (!player?.active) return;
    const dx = player.x - this.x,
      dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    const reach = player.pickupRadius * this.magnetMult;
    // Uma vez puxado, não solta mais (evita gema "orbitando" no limite)
    if (this._pulled || d < reach) {
      this._pulled = true;
      this._hop?.stop();
      const sp = this.magnetSpeed + Math.max(0, 260 - d) * 1.5;
      this.body.setVelocity((dx / (d || 1)) * sp, (dy / (d || 1)) * sp);
    } else this.body.setVelocity(0, 0);
  }
}

export class XPGem extends Pickup {
  constructor(scene) {
    super(scene, "px_gem", { anim: "gem_shine", magnet: 360 });
    this.xpValue = ENEMY.XP_VALUE;
  }
  // tier: 0 verde (normal), 1 azul (×5), 2 dourada (×20) — usado por baús
  spawn(x, y, tier = 0) {
    const T = [
      ["px_gem", "gem_shine", 1],
      ["px_gem_blue", "gem_blue_shine", 5],
      ["px_gem_gold", "gem_gold_shine", 20],
    ][tier] ?? ["px_gem", "gem_shine", 1];
    this.setTexture(T[0]);
    this.anim = T[1];
    this.xpValue = ENEMY.XP_VALUE * T[2];
    super.spawn(x, y);
  }
}

export class CoinPickup extends Pickup {
  constructor(scene) {
    super(scene, "px_coin", { anim: "coin_spin", magnet: 320, magnetMult: 5, glow: 0xf2c14e, glowScale: 0.45 });
  }
}

export class HeartPickup extends Pickup {
  constructor(scene) {
    super(scene, "px_heart", { magnet: 300, glow: 0xe8434f, glowScale: 0.55 });
  }
  update(time, dt, player) {
    if (this.active) this.setScale(S * (1 + Math.sin(time / 160) * 0.08));
    super.update(time, dt, player);
  }
}

export class AwakenOrb extends Pickup {
  constructor(scene) {
    super(scene, "px_awaken", { anim: "awaken_spark", magnet: 320, glow: 0xffe58f, glowScale: 0.7 });
  }
}
