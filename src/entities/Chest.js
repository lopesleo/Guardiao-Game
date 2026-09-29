// Baú lootbox com animação real (closed → half → open) e mecânica mímico.
import { CHEST, COLORS, GAME } from '../config.js';

export class Chest extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);

    this.glow = scene.add
      .image(0, 0, "fx_glow")
      .setScale(1.2)
      .setTint(COLORS.GOLD)
      .setAlpha(0.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.shadow = scene.add.image(0, 20, "px_shadow").setScale(3.4, 3);
    this.sprite = scene.add.image(0, 0, CHEST.SPRITE_TEXTURE, CHEST.SPRITE_FRAME_CLOSED)
                       .setScale(GAME.PIXEL_SCALE);
    this.prompt = scene.add.text(0, -42, '', {
      fontFamily: '"Jersey 15", monospace',
      fontSize: '16px', color: '#ffe58f',
      stroke: '#1a1420', strokeThickness: 4, resolution: 2,
    }).setOrigin(0.5).setVisible(false);

    this.add([this.shadow, this.glow, this.sprite, this.prompt]);
    this.setDepth(y + 9500);

    this.opened = false;
    this.playerNear = false;
  }

  update(time, player) {
    if (this.opened) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const near = (dx * dx + dy * dy) < (CHEST.INTERACT_RADIUS * CHEST.INTERACT_RADIUS);
    if (near !== this.playerNear) {
      this.playerNear = near;
      this.glow.setVisible(near);
      this.prompt.setVisible(near);
    }
    if (near) {
      const s = 1 + Math.sin(time / 200) * 0.15;
      this.glow.setScale(s);
    }
  }

  open() {
    if (this.opened) return null;
    this.opened = true;
    this.prompt.setVisible(false);
    this.glow.setVisible(false);

    // Determina tipo
    const r = Math.random();
    let kind;
    if (r < CHEST.GOLDEN_CHANCE)                                                   kind = 'golden';
    else if (r < CHEST.GOLDEN_CHANCE + CHEST.MIMIC_CHANCE)                         kind = 'mimic';
    else if (r < CHEST.GOLDEN_CHANCE + CHEST.MIMIC_CHANCE + CHEST.TRAP_CHANCE)     kind = 'trap';
    else                                                                           kind = 'normal';

    const sc = this.scene;

    if (kind === 'mimic') {
      // Mímico! Sprite vira chest com língua imediatamente, scale jump
      this.sprite.setFrame(CHEST.SPRITE_FRAME_MIMIC);
      sc.tweens.add({
        targets: this.sprite,
        scaleX: GAME.PIXEL_SCALE * 1.8, scaleY: GAME.PIXEL_SCALE * 1.4,
        duration: 250, yoyo: true,
      });
      sc.cameras.main.shake(350, 0.022);
    } else {
      // Animação real: 89 → 90 → 91
      sc.time.delayedCall(120, () => this.sprite.setFrame(CHEST.SPRITE_FRAME_HALF));
      sc.time.delayedCall(240, () => this.sprite.setFrame(CHEST.SPRITE_FRAME_OPEN));
      sc.tweens.add({
        targets: this.sprite,
        scaleX: GAME.PIXEL_SCALE * 1.2, scaleY: GAME.PIXEL_SCALE * 0.95,
        duration: 120, yoyo: true,
      });
    }

    return { kind, x: this.x, y: this.y };
  }
}
