// Arena principal — TODO D1: Player, 1 inimigo, auto-attack.
// Por ora: placeholder "obra em andamento" para validar pipeline.
import { COLORS, GAME } from '../config.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2;
    this.cameras.main.setBackgroundColor(0x0e1a14);

    this.add.text(cx, cy - 40, 'OBRA EM ANDAMENTO (D1)', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '24px', color: '#d9b25c',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 10, 'D0 ✓ Pipeline OK', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#6fcf6f',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 60, 'Pressione ESC para voltar', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#93a89a',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
  }
}
