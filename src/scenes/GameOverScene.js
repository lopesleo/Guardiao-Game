// Tela final narrativa: stats + opções.
import { COLORS, GAME } from '../config.js';
import { formatTime } from '../utils.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data) {
    const { won, elapsedMs, kills, coinsGained, newUnlocks } = data;
    const cx = GAME.WIDTH / 2;

    this.cameras.main.setBackgroundColor(COLORS.BG);

    // Título
    this.add.text(cx, 80, won ? 'VITÓRIA' : 'GAME OVER', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '42px',
      color: won ? '#6fcf6f' : '#ff5a6e',
    }).setOrigin(0.5);

    this.add.text(cx, 140, won ? 'O Ancião foi derrotado!' : 'Você caiu na floresta…', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#93a89a',
    }).setOrigin(0.5);

    // Stats
    const stats = [
      ['Tempo sobrevivido', formatTime(elapsedMs)],
      ['Inimigos abatidos', String(kills)],
      ['Moedas ganhas',     `+${coinsGained}`],
    ];
    let y = 230;
    for (const [k, v] of stats) {
      this.add.text(cx - 200, y, k, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#e8f0e6',
      }).setOrigin(0, 0.5);
      this.add.text(cx + 200, y, v, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#d9b25c',
      }).setOrigin(1, 0.5);
      y += 36;
    }

    if (newUnlocks && newUnlocks.length) {
      y += 20;
      this.add.text(cx, y, '★ DESBLOQUEADO', {
        fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#d98cff',
      }).setOrigin(0.5);
      for (const u of newUnlocks) {
        y += 28;
        this.add.text(cx, y, u, {
          fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#ffffff',
        }).setOrigin(0.5);
      }
    }

    // Botões
    this._button(cx - 130, GAME.HEIGHT - 100, 'JOGAR DE NOVO', () => this.scene.start('GameScene'));
    this._button(cx + 130, GAME.HEIGHT - 100, 'MENU',          () => this.scene.start('MenuScene'));
  }

  _button(x, y, label, onClick) {
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#e8f0e6',
      backgroundColor: '#1a2a1a', padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    txt.on('pointerover', () => txt.setColor('#d9b25c'));
    txt.on('pointerout',  () => txt.setColor('#e8f0e6'));
    txt.on('pointerdown', onClick);
  }
}
