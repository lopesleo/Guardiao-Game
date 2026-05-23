// Menu principal: título + botões.
// D19: audio unlock no primeiro pointerdown.
import { COLORS, GAME } from '../config.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const cx = GAME.WIDTH / 2;

    // Background
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // Título
    this.add.text(cx, 140, 'GUARDIÃO', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '64px',
      color: '#d9b25c',
    }).setOrigin(0.5);

    this.add.text(cx, 220, 'DA FLORESTA', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '32px',
      color: '#d9b25c',
    }).setOrigin(0.5);

    this.add.text(cx, 280, 'D E S P E R T A R', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '16px',
      color: '#6fcf6f',
    }).setOrigin(0.5);

    // Botões
    this._button(cx, 400, 'JOGAR',    () => this.scene.start('GameScene'));
    this._button(cx, 470, 'CRÉDITOS', () => this.scene.start('CreditsScene'));

    // Dica
    this.add.text(cx, GAME.HEIGHT - 40,
      'WASD / setas: mover  •  ESC: pausar  •  M: mute',
      { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#93a89a' }
    ).setOrigin(0.5);

    // D19: unlock áudio no primeiro input
    this.input.once('pointerdown', () => this.sound.unlock?.());
    this.input.keyboard.once('keydown', () => this.sound.unlock?.());
  }

  _button(x, y, label, onClick) {
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '20px',
      color: '#e8f0e6',
      backgroundColor: '#1a2a1a',
      padding: { x: 22, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    txt.on('pointerover', () => txt.setColor('#d9b25c'));
    txt.on('pointerout',  () => txt.setColor('#e8f0e6'));
    txt.on('pointerdown', onClick);
    return txt;
  }
}
