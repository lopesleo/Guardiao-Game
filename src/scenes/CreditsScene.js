// Tela de créditos — exigência ética + ponto de defesa (D22).
import { COLORS, GAME } from '../config.js';

const CREDITS = [
  { section: 'CÓDIGO', lines: [
    'Aluno (responsável pela entrega)',
    'Engine: Phaser 3.80 (MIT)',
    'Joystick virtual: nipplejs (MIT)',
  ]},
  { section: 'SPRITES', lines: [
    'Tiny Dungeon — Kenney (CC0)',
    'Tiny Town — Kenney (CC0)',
    'Tiny Creatures — Clint Bellanger (CC0)',
  ]},
  { section: 'ÁUDIO', lines: [
    'Impact Sounds — Kenney (CC0)',
    'Loopable Dungeon Ambience — JaggedStone (CC0)',
    'Fantasy Menu Theme — Thalon (CC-BY 4.0)',
  ]},
  { section: 'FONTE', lines: [
    'Press Start 2P — CodeMan38 (OFL)',
  ]},
];

export class CreditsScene extends Phaser.Scene {
  constructor() { super('CreditsScene'); }

  create() {
    const cx = GAME.WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.BG);

    this.add.text(cx, 60, 'CRÉDITOS', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '32px', color: '#d9b25c',
    }).setOrigin(0.5);

    let y = 130;
    for (const { section, lines } of CREDITS) {
      this.add.text(cx, y, section, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '16px', color: '#6fcf6f',
      }).setOrigin(0.5);
      y += 30;
      for (const line of lines) {
        this.add.text(cx, y, line, {
          fontFamily: 'Press Start 2P, monospace', fontSize: '11px', color: '#e8f0e6',
        }).setOrigin(0.5);
        y += 22;
      }
      y += 14;
    }

    const back = this.add.text(cx, GAME.HEIGHT - 50, '< VOLTAR', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#d9b25c',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
  }
}
