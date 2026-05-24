// Baú lootbox. Encosta no player → fica destacado → E abre.
import { CHEST, COLORS, GAME } from '../config.js';

export class Chest extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);

    // Glow dourado pulsante (só visível quando player perto)
    this.glow = scene.add.circle(0, 0, 28, COLORS.GOLD, 0.4).setVisible(false);
    // Sprite do baú
    this.sprite = scene.add.image(0, 0, CHEST.SPRITE_TEXTURE, CHEST.SPRITE_FRAME_CLOSED)
                       .setScale(GAME.PIXEL_SCALE);
    // Prompt "[E] ABRIR" acima do baú (escondido por padrão)
    this.prompt = scene.add.text(0, -38, '[E] ABRIR', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '10px', color: '#ffd96b',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false);

    this.add([this.glow, this.sprite, this.prompt]);
    this.setDepth(y + 9500); // logo abaixo de entidades pra não cobrir player

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

    // Determina tipo de loot
    const r = Math.random();
    let kind;
    if (r < CHEST.GOLDEN_CHANCE)                       kind = 'golden';
    else if (r < CHEST.GOLDEN_CHANCE + CHEST.TRAP_CHANCE) kind = 'trap';
    else                                                kind = 'normal';

    // Animação: escala yoyo + flash branco
    const sc = this.scene;
    sc.tweens.add({ targets: this.sprite, scaleX: GAME.PIXEL_SCALE * 1.5, scaleY: GAME.PIXEL_SCALE * 0.6, duration: 120, yoyo: true });

    if (kind === 'golden') {
      // halo dourado intenso
      const halo = sc.add.circle(this.x, this.y, 12, COLORS.GOLD, 0.9).setDepth(this.depth);
      sc.tweens.add({ targets: halo, radius: 120, alpha: 0, duration: 700, onComplete: () => halo.destroy() });
      sc.cameras.main.flash(250, 240, 200, 80);
    } else if (kind === 'trap') {
      // halo vermelho de aviso
      const halo = sc.add.circle(this.x, this.y, 12, 0xff5a6e, 0.9).setDepth(this.depth);
      sc.tweens.add({ targets: halo, radius: 100, alpha: 0, duration: 500, onComplete: () => halo.destroy() });
      sc.cameras.main.shake(200, 0.015);
    } else {
      // halo dourado leve
      const halo = sc.add.circle(this.x, this.y, 12, COLORS.GOLD, 0.7).setDepth(this.depth);
      sc.tweens.add({ targets: halo, radius: 80, alpha: 0, duration: 500, onComplete: () => halo.destroy() });
    }

    // Fade do baú vazio
    sc.tweens.add({ targets: [this.sprite, this.glow], alpha: 0.3, duration: 200 });

    return { kind, x: this.x, y: this.y };
  }
}
